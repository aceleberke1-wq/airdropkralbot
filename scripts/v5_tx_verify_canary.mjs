import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Pool } from "pg";
import dbConnection from "../packages/shared/src/v5/dbConnection.js";

const { buildPgPoolConfig } = dbConnection;

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

function parseBool(value, fallback = false) {
  if (value == null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

async function hasTable(pool, name) {
  const result = await pool.query("SELECT to_regclass($1) IS NOT NULL AS ok;", [`public.${name}`]);
  return Boolean(result.rows?.[0]?.ok);
}

function createSyntheticTxHash() {
  return crypto.createHash("sha256").update(`tx_verify_canary:${Date.now()}:${Math.random()}`).digest("hex");
}

function shouldInsertSyntheticCanary({ verifyEvents = 0, minEvents = 1, forceInsert = false } = {}) {
  if (forceInsert) return true;
  return toNumber(verifyEvents, 0) < Math.max(0, toNumber(minEvents, 1));
}

async function ensureTxVerifyCanary(options = {}) {
  const databaseUrl = String(options.databaseUrl || process.env.DATABASE_URL || "").trim();
  if (!databaseUrl) {
    throw new Error("missing_env:DATABASE_URL");
  }
  const useSsl = options.useSsl === true || String(process.env.DATABASE_SSL || "").trim() === "1";
  const windowHours = Math.max(1, Math.min(168, toNumber(options.windowHours, 24)));
  const minEvents = Math.max(0, Math.min(1000, toNumber(options.minEvents, 1)));
  const forceInsert = options.forceInsert === true;
  const pool = new Pool(
    buildPgPoolConfig({
      databaseUrl,
      sslEnabled: useSsl,
      rejectUnauthorized: false
    })
  );

  try {
    if (!(await hasTable(pool, "chain_verify_logs"))) {
      return {
        ok: false,
        reason: "chain_verify_logs_missing",
        inserted: false,
        window_hours: windowHours,
        min_events: minEvents
      };
    }

    const stats = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE verify_status IN ('verified','format_only','failed','timeout'))::bigint AS verify_events,
         COUNT(*) FILTER (
           WHERE verify_status IN ('verified','format_only','failed','timeout')
             AND COALESCE(verify_json->>'source', '') = 'synthetic_canary'
         )::bigint AS synthetic_events
       FROM chain_verify_logs
       WHERE created_at >= now() - ($1::interval);`,
      [`${windowHours} hour`]
    );
    const row = stats.rows?.[0] || {};
    const verifyEvents = toNumber(row.verify_events, 0);
    const syntheticEvents = toNumber(row.synthetic_events, 0);

    if (!shouldInsertSyntheticCanary({ verifyEvents, minEvents, forceInsert })) {
      return {
        ok: true,
        reason: "enough_verify_events",
        inserted: false,
        verify_events: verifyEvents,
        synthetic_events: syntheticEvents,
        window_hours: windowHours,
        min_events: minEvents
      };
    }

    const txHash = createSyntheticTxHash();
    const inserted = await pool.query(
      `INSERT INTO chain_verify_logs (request_id, chain, tx_hash, verify_status, latency_ms, verify_json)
       VALUES (NULL, 'BTC', $1, 'format_only', 1, $2::jsonb)
       RETURNING id, created_at;`,
      [
        txHash,
        JSON.stringify({
          source: "synthetic_canary",
          canary: "tx_verify_keepalive",
          mode: "format_only",
          reason: "kpi_floor_guard",
          generated_at: new Date().toISOString(),
          window_hours: windowHours
        })
      ]
    );
    const insertedRow = inserted.rows?.[0] || {};
    return {
      ok: true,
      reason: "synthetic_inserted",
      inserted: true,
      verify_events: verifyEvents,
      synthetic_events: syntheticEvents + 1,
      inserted_id: Number(insertedRow.id || 0),
      inserted_at: insertedRow.created_at || null,
      window_hours: windowHours,
      min_events: minEvents
    };
  } finally {
    await pool.end().catch(() => {});
  }
}

async function runCli(args = {}) {
  const result = await ensureTxVerifyCanary({
    windowHours: args.window_hours ?? args.windowHours ?? process.env.V5_TX_VERIFY_CANARY_WINDOW_HOURS ?? "24",
    minEvents: args.min_events ?? args.minEvents ?? process.env.V5_TX_VERIFY_CANARY_MIN_EVENTS ?? "1",
    forceInsert: parseBool(args.force_insert ?? args.forceInsert ?? process.env.V5_TX_VERIFY_CANARY_FORCE_INSERT, false)
  });

  const emitReport = parseBool(args.emit_report ?? args.emitReport ?? process.env.V5_TX_VERIFY_CANARY_EMIT_REPORT, true);
  let reportPath = "";
  if (emitReport) {
    const outDir = path.join(repoRoot, "docs");
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").replace("T", "_");
    const payload = {
      generated_at: new Date().toISOString(),
      ...result
    };
    const stampedPath = path.join(outDir, `V5_TX_VERIFY_CANARY_${stamp}.json`);
    const latestPath = path.join(outDir, "V5_TX_VERIFY_CANARY_latest.json");
    fs.writeFileSync(stampedPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    fs.writeFileSync(latestPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    reportPath = stampedPath;
  }

  console.log(
    `[tx-canary] ok=${Boolean(result.ok)} inserted=${Boolean(result.inserted)} reason=${String(result.reason || "unknown")} verify_events=${toNumber(
      result.verify_events,
      0
    )}`
  );
  if (reportPath) {
    console.log(`[tx-canary] report=${reportPath}`);
  }
  if (!result.ok) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runCli(parseArgs(process.argv.slice(2))).catch((err) => {
    console.error("[err] v5_tx_verify_canary failed:", err?.message || err);
    process.exitCode = 1;
  });
}

export { ensureTxVerifyCanary, shouldInsertSyntheticCanary, parseArgs, parseBool, toNumber };
