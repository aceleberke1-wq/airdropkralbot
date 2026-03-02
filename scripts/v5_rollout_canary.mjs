import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Pool } from "pg";

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

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`missing_env:${name}`);
  return value;
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = String(process.env.ADMIN_API_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
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
      limit: releaseRunLimit,
      apply_rejections: applyRejections
    });
  }

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
}

main().catch((err) => {
  console.error("[err] v5 rollout failed:", err?.message || err);
  process.exitCode = 1;
});
