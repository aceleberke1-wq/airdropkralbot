import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import dotenv from "dotenv";
import { Pool } from "pg";
import { buildSnapshot } from "./v5_kpi_snapshot.mjs";
import { evaluateCanary, parseThresholds } from "./v5_canary_guard.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const envPath = path.join(repoRoot, ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const REQUIRED_V52_MIGRATION_PREFIXES = Object.freeze(
  Array.from({ length: 12 }, (_, idx) => `V${String(61 + idx).padStart(3, "0")}__`)
);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || "").trim();
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || String(next).startsWith("--")) {
      out[key] = "true";
      continue;
    }
    out[key] = String(next);
    i += 1;
  }
  return out;
}

function parseBool(value, fallback = false) {
  if (value == null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`missing_env:${name}`);
  return value;
}

function resolveAdminApiBaseUrl() {
  const explicitBaseUrl = String(process.env.ADMIN_API_BASE_URL || "").trim();
  if (explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/+$/, "");
  }
  const rawPort = String(process.env.ADMIN_API_PORT || "4000").trim();
  const parsedPort = Number.parseInt(rawPort, 10);
  const port = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535 ? parsedPort : 4000;
  return `http://127.0.0.1:${port}`;
}

function sign(secret, uid, ts) {
  return crypto.createHmac("sha256", secret).update(`${uid}.${ts}`).digest("hex");
}

function buildAuth(secret, uid) {
  const ts = Date.now().toString();
  return {
    uid: String(uid),
    ts,
    sig: sign(secret, uid, ts)
  };
}

function createActionRequestId(prefix = "rollout") {
  const cleanPrefix = String(prefix || "rollout")
    .replace(/[^a-zA-Z0-9:_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  return `${cleanPrefix || "rollout"}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`.slice(0, 120);
}

async function postJson(baseUrl, path, payload) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok && data.success !== false) {
    return data;
  }
  throw new Error(`request_failed:${path}:${data?.error || res.status}`);
}

function isConfirmationRequiredResponse(response) {
  if (!response || typeof response !== "object") return false;
  const error = String(response?.error || "").trim().toLowerCase();
  const token = String(response?.data?.confirm_token || "").trim();
  return error === "admin_confirmation_required" && token.length >= 16;
}

async function postJsonWithCriticalConfirm(baseUrl, path, payload) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));

  if (res.ok && data.success !== false) {
    return data;
  }

  if (res.status === 409 && isConfirmationRequiredResponse(data)) {
    const confirmToken = String(data?.data?.confirm_token || "").trim();
    const confirmedPayload = { ...payload, confirm_token: confirmToken };
    const confirmedRes = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(confirmedPayload)
    });
    const confirmedData = await confirmedRes.json().catch(() => ({}));
    if (confirmedRes.ok && confirmedData.success !== false) {
      return confirmedData;
    }
    throw new Error(`request_failed:${path}:${confirmedData?.error || confirmedRes.status}`);
  }

  throw new Error(`request_failed:${path}:${data?.error || res.status}`);
}

async function assertV52MigrationDependencies({ skip = false } = {}) {
  if (skip) {
    console.log("[guard] migration dependency check skipped");
    return;
  }

  const databaseUrl = String(process.env.DATABASE_URL || "").trim();
  if (!databaseUrl) {
    throw new Error("missing_env:DATABASE_URL (required for v5 rollout migration guard)");
  }

  const useSsl = parseBool(process.env.DATABASE_SSL, false);
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined
  });

  try {
    const regclassRes = await pool.query("SELECT to_regclass('public.schema_migrations') AS table_name;");
    const tableName = String(regclassRes?.rows?.[0]?.table_name || "").trim();
    if (!tableName) {
      throw new Error("schema_migrations_missing (run migrations before rollout)");
    }

    const rows = await pool.query(
      "SELECT filename FROM schema_migrations WHERE filename >= 'V061__' AND filename < 'V073__' ORDER BY filename ASC;"
    );
    const filenames = new Set((rows?.rows || []).map((row) => String(row?.filename || "")));
    const missing = REQUIRED_V52_MIGRATION_PREFIXES.filter((prefix) => {
      for (const fileName of filenames) {
        if (fileName.startsWith(prefix)) return false;
      }
      return true;
    });

    if (missing.length > 0) {
      throw new Error(`missing_migrations_for_rollout:${missing.join(",")}`);
    }

    console.log("[guard] migration dependency check passed (V061..V072 applied)");
  } finally {
    await pool.end().catch(() => {});
  }
}

function resolveStage(rawStage) {
  const stage = String(rawStage || "admin").toLowerCase();
  if (stage === "25" || stage === "rollout25") {
    return { key: "rollout_25", pct: 25, run: true };
  }
  if (stage === "100" || stage === "rollout100" || stage === "full") {
    return { key: "rollout_100", pct: 100, run: true };
  }
  return { key: "admin_canary", pct: 5, run: false };
}

const STAGE_CANARY_DEFAULTS = Object.freeze({
  admin_canary: Object.freeze({
    min_command_events_24h: 1,
    min_queue_success_rate_pct: 80,
    max_queue_failed_rate_pct: 25,
    max_queue_queued_events: 3,
    max_tx_verify_error_rate_pct: 20,
    max_idempotency_conflict_events_24h: 3,
    max_invalid_action_request_id_events_24h: 1,
    max_snapshot_age_sec: 1800,
    require_command_events: false,
    require_queue_events: false,
    require_tx_verify_events: false
  }),
  rollout_25: Object.freeze({
    min_command_events_24h: 2,
    min_queue_success_rate_pct: 85,
    max_queue_failed_rate_pct: 15,
    max_queue_queued_events: 2,
    max_tx_verify_error_rate_pct: 12,
    max_idempotency_conflict_events_24h: 2,
    max_invalid_action_request_id_events_24h: 1,
    max_snapshot_age_sec: 1800,
    require_command_events: true,
    require_queue_events: true,
    require_tx_verify_events: false
  }),
  rollout_100: Object.freeze({
    min_command_events_24h: 3,
    min_queue_success_rate_pct: 90,
    max_queue_failed_rate_pct: 10,
    max_queue_queued_events: 1,
    max_tx_verify_error_rate_pct: 8,
    max_idempotency_conflict_events_24h: 1,
    max_invalid_action_request_id_events_24h: 0,
    max_snapshot_age_sec: 1800,
    require_command_events: true,
    require_queue_events: true,
    require_tx_verify_events: false
  })
});

function buildCanaryThresholdInput(args = {}, stageKey = "admin_canary") {
  const defaults = STAGE_CANARY_DEFAULTS[stageKey] || STAGE_CANARY_DEFAULTS.admin_canary;

  return {
    min_command_events_24h:
      args.canary_min_command_events_24h ?? process.env.V5_CANARY_MIN_COMMAND_EVENTS_24H ?? defaults.min_command_events_24h,
    min_queue_success_rate_pct:
      args.canary_min_queue_success_rate_pct ??
      process.env.V5_CANARY_MIN_QUEUE_SUCCESS_RATE_PCT ??
      defaults.min_queue_success_rate_pct,
    max_queue_failed_rate_pct:
      args.canary_max_queue_failed_rate_pct ??
      process.env.V5_CANARY_MAX_QUEUE_FAILED_RATE_PCT ??
      defaults.max_queue_failed_rate_pct,
    max_queue_queued_events:
      args.canary_max_queue_queued_events ?? process.env.V5_CANARY_MAX_QUEUE_QUEUED_EVENTS ?? defaults.max_queue_queued_events,
    max_tx_verify_error_rate_pct:
      args.canary_max_tx_verify_error_rate_pct ??
      process.env.V5_CANARY_MAX_TX_VERIFY_ERROR_RATE_PCT ??
      defaults.max_tx_verify_error_rate_pct,
    max_idempotency_conflict_events_24h:
      args.canary_max_idempotency_conflict_events_24h ??
      process.env.V5_CANARY_MAX_IDEMPOTENCY_CONFLICT_EVENTS_24H ??
      defaults.max_idempotency_conflict_events_24h,
    max_invalid_action_request_id_events_24h:
      args.canary_max_invalid_action_request_id_events_24h ??
      process.env.V5_CANARY_MAX_INVALID_ACTION_REQUEST_ID_EVENTS_24H ??
      defaults.max_invalid_action_request_id_events_24h,
    max_snapshot_age_sec:
      args.canary_max_snapshot_age_sec ?? process.env.V5_CANARY_MAX_SNAPSHOT_AGE_SEC ?? defaults.max_snapshot_age_sec,
    require_command_events:
      args.canary_require_command_events ?? process.env.V5_CANARY_REQUIRE_COMMAND_EVENTS ?? String(defaults.require_command_events),
    require_queue_events:
      args.canary_require_queue_events ?? process.env.V5_CANARY_REQUIRE_QUEUE_EVENTS ?? String(defaults.require_queue_events),
    require_tx_verify_events:
      args.canary_require_tx_verify_events ?? process.env.V5_CANARY_REQUIRE_TX_VERIFY_EVENTS ?? String(defaults.require_tx_verify_events)
  };
}

async function runRolloutCanaryGate({ args, stage }) {
  const skipCanaryGuard = parseBool(args.skip_canary_guard ?? process.env.V5_SKIP_CANARY_GUARD, false);
  if (skipCanaryGuard) {
    console.log("[canary] gate skipped by override (--skip_canary_guard)");
    return { ok: true, skipped: true };
  }

  const canaryHours = Math.max(1, Math.min(168, toNumber(args.canary_hours ?? process.env.V5_CANARY_WINDOW_HOURS, 24)));
  const thresholdInput = buildCanaryThresholdInput(args, stage.key);
  const thresholds = parseThresholds(thresholdInput);
  const snapshot = await buildSnapshot({ windowHours: canaryHours });
  const evaluation = evaluateCanary(snapshot, thresholds);

  const outDir = path.join(repoRoot, "docs");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(
    2,
    "0"
  )}_${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}${String(
    now.getUTCSeconds()
  ).padStart(2, "0")}Z`;
  const reportPayload = {
    generated_at: new Date().toISOString(),
    stage: stage.key,
    rollout_pct: stage.pct,
    snapshot_generated_at: String(snapshot?.generated_at || ""),
    window_hours: canaryHours,
    thresholds,
    evaluation
  };
  const reportPath = path.join(outDir, `V5_CANARY_GUARD_rollout_${stamp}.json`);
  const latestPath = path.join(outDir, "V5_CANARY_GUARD_rollout_latest.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(reportPayload, null, 2)}\n`, "utf8");
  fs.writeFileSync(latestPath, `${JSON.stringify(reportPayload, null, 2)}\n`, "utf8");

  console.log(`[canary] gate ok=${evaluation.ok} failed=${evaluation.failed_checks} warned=${evaluation.warned_checks}`);
  for (const check of evaluation.checks) {
    const note = check.note ? ` | ${check.note}` : "";
    console.log(`[canary:${check.status}] ${check.metric} observed=${check.observed} threshold=${check.threshold}${note}`);
  }
  console.log(`[canary] rollout gate report: ${reportPath}`);

  if (!evaluation.ok) {
    throw new Error(`canary_guard_failed:${evaluation.failed_checks}_checks`);
  }
  return {
    ok: true,
    skipped: false,
    reportPath,
    latestPath,
    failedChecks: evaluation.failed_checks,
    warnedChecks: evaluation.warned_checks
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = resolveAdminApiBaseUrl();
  const secret = requireEnv("WEBAPP_HMAC_SECRET");
  const adminUid = requireEnv("ADMIN_TELEGRAM_ID");
  const stage = resolveStage(args.stage || process.env.V5_STAGE || "admin");
  const releaseRunLimit = Math.max(1, Math.min(200, Number(args.limit || process.env.V5_RELEASE_RUN_LIMIT || 25)));
  const applyRejections = parseBool(args.apply_rejections || process.env.V5_RELEASE_APPLY_REJECTIONS, false);
  const skipMigrationGuard = parseBool(args.skip_migration_guard || process.env.V5_SKIP_MIGRATION_GUARD, false);

  await assertV52MigrationDependencies({ skip: skipMigrationGuard });

  const flags = {
    UX_V5_ENABLED: true,
    UX_V4_ENABLED: true,
    PAYOUT_RELEASE_V2_ENABLED: true,
    PAYOUT_RELEASE_V1_ENABLED: true,
    WEBAPP_PLAYER_MODE_DEFAULT: true,
    I18N_V2_ENABLED: true,
    I18N_V1_ENABLED: true,
    PVP_POLL_PRIMARY: true
  };

  const runtimeRes = await postJson(baseUrl, "/webapp/api/admin/runtime/flags", {
    ...buildAuth(secret, adminUid),
    source_mode: "db_override",
    source_json: {
      rollout: {
        version: "v5",
        stage: stage.key,
        rollout_pct: stage.pct,
        updated_at: new Date().toISOString()
      }
    },
    flags
  });

  const payoutRes = await postJsonWithCriticalConfirm(baseUrl, "/webapp/api/v2/admin/economy/payout-release", {
    ...buildAuth(secret, adminUid),
    action_request_id: createActionRequestId("rollout_payout_release"),
    enabled: true,
    mode: "tiered_drip",
    global_cap_min_usd: 20000000,
    daily_drip_pct_max: 0.005,
    tier_rules: [
      { tier: "T0", min_score: 0, drip_pct: 0 },
      { tier: "T1", min_score: 0.25, drip_pct: 0.002 },
      { tier: "T2", min_score: 0.5, drip_pct: 0.0035 },
      { tier: "T3", min_score: 0.75, drip_pct: 0.005 }
    ],
    score_weights: {
      volume30d: 0.65,
      mission30d: 0.25,
      tenure30d: 0.1
    }
  });

  let runRes = null;
  if (stage.run) {
    runRes = await postJsonWithCriticalConfirm(baseUrl, "/webapp/api/v2/admin/payout/release/run", {
      ...buildAuth(secret, adminUid),
      action_request_id: createActionRequestId("rollout_release_run"),
      limit: releaseRunLimit,
      apply_rejections: applyRejections
    });
  }

  const canaryGate = await runRolloutCanaryGate({ args, stage });

  const effective = runtimeRes?.data?.effective_flags || {};
  console.log(`[ok] v5 rollout stage=${stage.key} pct=${stage.pct}`);
  console.log(`[flags] UX_V5=${Boolean(effective.UX_V5_ENABLED)} PAYOUT_RELEASE_V2=${Boolean(effective.PAYOUT_RELEASE_V2_ENABLED)}`);
  console.log(`[payout_release] enabled=${Boolean(payoutRes?.data?.payout_release?.enabled)} mode=${String(payoutRes?.data?.payout_release?.mode || "tiered_drip")}`);
  if (runRes) {
    console.log(
      `[release_run] total=${Number(runRes?.data?.total || 0)} eligible=${Number(runRes?.data?.eligible || 0)} rejected=${Number(
        runRes?.data?.rejected || 0
      )}`
    );
  } else {
    console.log("[release_run] skipped");
  }
  if (canaryGate && !canaryGate.skipped) {
    console.log(`[canary] rollout gate passed report=${canaryGate.reportPath}`);
  }
}

export { resolveStage, buildCanaryThresholdInput, STAGE_CANARY_DEFAULTS, resolveAdminApiBaseUrl };

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  main().catch((err) => {
    console.error("[err] v5 rollout failed:", err?.message || err);
    process.exitCode = 1;
  });
}
