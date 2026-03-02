import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import dotenv from "dotenv";
import { Pool } from "pg";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const envPath = path.join(repoRoot, ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

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

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pct(numerator, denominator) {
  const d = toNumber(denominator, 0);
  if (d <= 0) return 0;
  return Number(((toNumber(numerator, 0) / d) * 100).toFixed(2));
}

function sign(secret, uid, ts) {
  return crypto.createHmac("sha256", secret).update(`${uid}.${ts}`).digest("hex");
}

async function hasTable(db, name) {
  const result = await db.query("SELECT to_regclass($1) IS NOT NULL AS ok;", [`public.${name}`]);
  return Boolean(result.rows?.[0]?.ok);
}

async function queryOne(db, sql, params = []) {
  const result = await db.query(sql, params);
  return result.rows?.[0] || {};
}

async function queryRows(db, sql, params = []) {
  const result = await db.query(sql, params);
  return result.rows || [];
}

async function fetchBootstrap(baseUrl, uid, secret, lang = "tr") {
  if (!baseUrl || !uid || !secret) return null;
  const ts = Date.now().toString();
  const sig = sign(secret, uid, ts);
  const url = `${baseUrl.replace(/\/+$/, "")}/webapp/api/v2/bootstrap?lang=${encodeURIComponent(lang)}&uid=${encodeURIComponent(
    uid
  )}&ts=${encodeURIComponent(ts)}&sig=${encodeURIComponent(sig)}`;
  try {
    const res = await fetch(url, { method: "GET" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) return null;
    return data?.data || null;
  } catch {
    return null;
  }
}

async function buildSnapshot({ windowHours = 24 }) {
  const databaseUrl = String(process.env.DATABASE_URL || "").trim();
  if (!databaseUrl) {
    throw new Error("missing_env:DATABASE_URL");
  }
  const useSsl = String(process.env.DATABASE_SSL || "").trim() === "1";
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined
  });

  const nowIso = new Date().toISOString();
  const windowHoursSafe = Math.max(1, Math.min(168, toNumber(windowHours, 24)));

  try {
    const windowExpr = `${windowHoursSafe} hour`;

    const exists = {
      v5_command_events: await hasTable(pool, "v5_command_events"),
      v5_intent_resolution_events: await hasTable(pool, "v5_intent_resolution_events"),
      payout_requests: await hasTable(pool, "payout_requests"),
      payout_release_events: await hasTable(pool, "payout_release_events"),
      v5_unified_admin_queue_action_events: await hasTable(pool, "v5_unified_admin_queue_action_events"),
      admin_audit: await hasTable(pool, "admin_audit"),
      v5_wallet_challenges: await hasTable(pool, "v5_wallet_challenges"),
      v5_kyc_threshold_decisions: await hasTable(pool, "v5_kyc_threshold_decisions"),
      v5_pvp_progression_daily: await hasTable(pool, "v5_pvp_progression_daily"),
      v5_operational_slo_metrics: await hasTable(pool, "v5_operational_slo_metrics"),
      v5_cutover_primary_switch_events: await hasTable(pool, "v5_cutover_primary_switch_events")
    };

    const commandStats = exists.v5_command_events
      ? await queryOne(
          pool,
          `SELECT
             COUNT(*)::bigint AS total_events,
             COUNT(DISTINCT user_id)::bigint AS unique_users
           FROM v5_command_events
           WHERE created_at >= now() - ($1::interval);`,
          [windowExpr]
        )
      : {};

    const intentStats = exists.v5_intent_resolution_events
      ? await queryOne(
          pool,
          `SELECT
             COUNT(*)::bigint AS total_events,
             COUNT(*) FILTER (WHERE COALESCE(matched_key, '') = '')::bigint AS unknown_events,
             COUNT(*) FILTER (WHERE mode_extracted = true)::bigint AS mode_extracted_events
           FROM v5_intent_resolution_events
           WHERE created_at >= now() - ($1::interval);`,
          [windowExpr]
        )
      : {};

    const payoutStats = exists.payout_requests
      ? await queryOne(
          pool,
          `SELECT
             COUNT(*)::bigint AS total_requests,
             COUNT(*) FILTER (WHERE status = 'paid')::bigint AS paid_requests,
             COUNT(*) FILTER (WHERE status = 'rejected')::bigint AS rejected_requests,
             COUNT(*) FILTER (WHERE status IN ('requested','pending','approved'))::bigint AS active_requests
           FROM payout_requests
           WHERE created_at >= now() - ($1::interval);`,
          [windowExpr]
        )
      : {};

    const releaseEventStats = exists.payout_release_events
      ? await queryRows(
          pool,
          `SELECT event_type, COUNT(*)::bigint AS event_count
             FROM payout_release_events
            WHERE created_at >= now() - ($1::interval)
            GROUP BY event_type
            ORDER BY event_count DESC, event_type ASC;`,
          [windowExpr]
        )
      : [];

    const queueActionStats = exists.v5_unified_admin_queue_action_events
      ? await queryOne(
          pool,
          `SELECT
             COUNT(*)::bigint AS total_events,
             COUNT(*) FILTER (WHERE status = 'ok')::bigint AS success_events,
             COUNT(*) FILTER (WHERE status <> 'ok')::bigint AS non_ok_events
           FROM v5_unified_admin_queue_action_events
           WHERE created_at >= now() - ($1::interval);`,
          [windowExpr]
        )
      : {};

    const auditStats = exists.admin_audit
      ? await queryOne(
          pool,
          `SELECT COUNT(*)::bigint AS total_entries
             FROM admin_audit
            WHERE created_at >= now() - ($1::interval);`,
          [windowExpr]
        )
      : {};

    const walletStats = exists.v5_wallet_challenges
      ? await queryOne(
          pool,
          `SELECT
             COUNT(*)::bigint AS issued_challenges,
             COUNT(*) FILTER (WHERE consumed_at IS NOT NULL)::bigint AS consumed_challenges
           FROM v5_wallet_challenges
           WHERE issued_at >= now() - ($1::interval);`,
          [windowExpr]
        )
      : {};

    const kycStats = exists.v5_kyc_threshold_decisions
      ? await queryOne(
          pool,
          `SELECT
             COUNT(*)::bigint AS total_decisions,
             COUNT(*) FILTER (WHERE requires_manual_review = true)::bigint AS manual_review_decisions,
             COUNT(*) FILTER (WHERE status_after = 'blocked')::bigint AS blocked_decisions
           FROM v5_kyc_threshold_decisions
           WHERE decided_at >= now() - ($1::interval);`,
          [windowExpr]
        )
      : {};

    const pvpStats = exists.v5_pvp_progression_daily
      ? await queryOne(
          pool,
          `SELECT
             COUNT(*)::bigint AS updated_rows,
             COUNT(DISTINCT user_id)::bigint AS unique_users
           FROM v5_pvp_progression_daily
           WHERE updated_at >= now() - ($1::interval);`,
          [windowExpr]
        )
      : {};

    const sloLatest = exists.v5_operational_slo_metrics
      ? await queryRows(
          pool,
          `SELECT metric_key, metric_value, sample_size, window_key, measured_at
             FROM (
               SELECT
                 metric_key,
                 metric_value,
                 sample_size,
                 window_key,
                 measured_at,
                 ROW_NUMBER() OVER (PARTITION BY metric_key ORDER BY measured_at DESC) AS rn
               FROM v5_operational_slo_metrics
               WHERE measured_at >= now() - ($1::interval)
             ) t
            WHERE rn = 1
            ORDER BY metric_key ASC;`,
          [windowExpr]
        )
      : [];

    const cutoverSwitchEvents = exists.v5_cutover_primary_switch_events
      ? await queryRows(
          pool,
          `SELECT switch_key, previous_primary_read_model, next_primary_read_model, reason_code, created_at
             FROM v5_cutover_primary_switch_events
            WHERE created_at >= now() - ($1::interval)
            ORDER BY created_at DESC
            LIMIT 20;`,
          [windowExpr]
        )
      : [];

    const bootstrap = await fetchBootstrap(
      String(process.env.ADMIN_API_BASE_URL || "http://127.0.0.1:4000").trim(),
      String(process.env.ADMIN_TELEGRAM_ID || "").trim(),
      String(process.env.WEBAPP_HMAC_SECRET || "").trim(),
      "tr"
    );

    const intentTotal = toNumber(intentStats.total_events, 0);
    const intentUnknown = toNumber(intentStats.unknown_events, 0);
    const queueEventsTotal = toNumber(queueActionStats.total_events, 0);
    const auditEventsTotal = toNumber(auditStats.total_entries, 0);

    return {
      generated_at: nowIso,
      window_hours: windowHoursSafe,
      schema: {
        tables_checked: exists
      },
      kpis: {
        command_events_24h: toNumber(commandStats.total_events, 0),
        command_unique_users_24h: toNumber(commandStats.unique_users, 0),
        unknown_intent_rate_pct: pct(intentUnknown, intentTotal),
        unknown_intent_events_24h: intentUnknown,
        payout_requests_24h: toNumber(payoutStats.total_requests, 0),
        payout_rejected_24h: toNumber(payoutStats.rejected_requests, 0),
        payout_rejected_rate_pct: pct(toNumber(payoutStats.rejected_requests, 0), toNumber(payoutStats.total_requests, 0)),
        queue_action_events_24h: queueEventsTotal,
        admin_audit_entries_24h: auditEventsTotal,
        audit_coverage_proxy_pct: pct(auditEventsTotal, queueEventsTotal),
        wallet_challenge_verify_rate_pct: pct(toNumber(walletStats.consumed_challenges, 0), toNumber(walletStats.issued_challenges, 0)),
        kyc_manual_review_rate_pct: pct(toNumber(kycStats.manual_review_decisions, 0), toNumber(kycStats.total_decisions, 0)),
        pvp_progression_updates_24h: toNumber(pvpStats.updated_rows, 0),
        pvp_progression_unique_users_24h: toNumber(pvpStats.unique_users, 0)
      },
      details: {
        intent: intentStats,
        payout: payoutStats,
        payout_release_events: releaseEventStats,
        queue_actions: queueActionStats,
        admin_audit: auditStats,
        wallet: walletStats,
        kyc: kycStats,
        pvp: pvpStats,
        slo_latest_by_key: sloLatest,
        cutover_switch_events: cutoverSwitchEvents,
        bootstrap: bootstrap
          ? {
              api_version: String(bootstrap.api_version || ""),
              runtime_flags_effective: bootstrap.runtime_flags_effective || {},
              command_catalog_size: Array.isArray(bootstrap.command_catalog) ? bootstrap.command_catalog.length : 0
            }
          : null
      }
    };
  } finally {
    await pool.end().catch(() => {});
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const windowHours = Math.max(1, Math.min(168, toNumber(args.hours, 24)));
  const outDir = path.join(repoRoot, "docs");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const snapshot = await buildSnapshot({ windowHours });
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(
    2,
    "0"
  )}_${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}${String(
    now.getUTCSeconds()
  ).padStart(2, "0")}Z`;
  const snapshotPath = path.join(outDir, `V5_KPI_SNAPSHOT_${stamp}.json`);
  const latestPath = path.join(outDir, "V5_KPI_SNAPSHOT_latest.json");
  fs.writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  fs.writeFileSync(latestPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  console.log(`[ok] KPI snapshot generated: ${snapshotPath}`);
  console.log(
    `[summary] unknown_intent_rate_pct=${snapshot.kpis.unknown_intent_rate_pct} audit_coverage_proxy_pct=${snapshot.kpis.audit_coverage_proxy_pct} payout_rejected_rate_pct=${snapshot.kpis.payout_rejected_rate_pct}`
  );
}

export { buildSnapshot, parseArgs, toNumber, pct };

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  main().catch((err) => {
    console.error("[err] v5_kpi_snapshot failed:", err?.message || err);
    process.exitCode = 1;
  });
}
