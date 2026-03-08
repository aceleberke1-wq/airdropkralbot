import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import dotenv from "dotenv";
import pg from "pg";

const require = createRequire(import.meta.url);
const { buildPgPoolConfig } = require("../packages/shared/src/v5/dbConnection");
const { resolveLiveOpsDispatchArtifactPaths } = require("../packages/shared/src/runtimeArtifactPaths");
const { createLiveOpsChatCampaignService } = require("../apps/admin-api/src/services/liveOpsChatCampaignService");

const { Pool } = pg;
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
    if (!token.startsWith("--")) {
      continue;
    }
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
  if (value == null || value === "") {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeVersion(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 40);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = String(process.env.DATABASE_URL || "").trim();
  if (!databaseUrl) {
    throw new Error("missing_database_url");
  }

  const pool = new Pool(
    buildPgPoolConfig({
      databaseUrl,
      sslEnabled: process.env.DATABASE_SSL === "1",
      rejectUnauthorized: false
    })
  );

  const service = createLiveOpsChatCampaignService({
    pool,
    fetchImpl: typeof fetch === "function" ? fetch.bind(globalThis) : null,
    botToken: String(process.env.BOT_TOKEN || "").trim(),
    botUsername: String(process.env.BOT_USERNAME || "airdropkral_2026_bot").trim(),
    webappPublicUrl: String(process.env.WEBAPP_PUBLIC_URL || "").trim(),
    webappHmacSecret: String(process.env.WEBAPP_HMAC_SECRET || "").trim(),
    resolveWebappVersion: async () => ({
      version:
        sanitizeVersion(process.env.WEBAPP_VERSION_OVERRIDE) ||
        sanitizeVersion(process.env.RENDER_GIT_COMMIT) ||
        sanitizeVersion(process.env.RELEASE_GIT_REVISION) ||
        ""
    }),
    logger(level, payload) {
      const line = JSON.stringify({
        level,
        ts: new Date().toISOString(),
        ...(payload || {})
      });
      if (level === "warn" || level === "error") {
        console.error(line);
        return;
      }
      console.log(line);
    }
  });

  try {
    const result = await service.runScheduledDispatch({
      adminId: toNumber(args.admin_id ?? args.adminId ?? process.env.LIVE_OPS_SCHEDULER_ADMIN_ID, 0),
      dryRun: parseBool(args.dry_run ?? args.dryRun, false),
      maxRecipients: toNumber(args.max_recipients ?? args.maxRecipients, 0) || undefined,
      reason: String(args.reason || process.env.LIVE_OPS_SCHEDULER_REASON || "scheduled_window_dispatch").trim().slice(0, 240)
    });
    let snapshot = null;
    try {
      snapshot = await service.getCampaignSnapshot();
    } catch (snapshotErr) {
      console.warn(`[liveops] snapshot_summary_failed=${snapshotErr?.message || snapshotErr}`);
    }
    const emitReport = parseBool(args.emit_report ?? args.emitReport ?? process.env.V5_LIVE_OPS_DISPATCH_EMIT_REPORT, true);
    let reportPath = "";
    if (emitReport) {
      const artifactPaths = resolveLiveOpsDispatchArtifactPaths(repoRoot);
      if (!fs.existsSync(artifactPaths.outDir)) {
        fs.mkdirSync(artifactPaths.outDir, { recursive: true });
      }
      const schedulerSkipSummary =
        snapshot && snapshot.scheduler_skip_summary && typeof snapshot.scheduler_skip_summary === "object"
          ? snapshot.scheduler_skip_summary
          : {};
      const sceneRuntimeSummary =
        snapshot && snapshot.scene_runtime_summary && typeof snapshot.scene_runtime_summary === "object"
          ? {
              health_band_24h: String(snapshot.scene_runtime_summary.health_band_24h || "no_data"),
              trend_direction_7d: String(snapshot.scene_runtime_summary.trend_direction_7d || "no_data"),
              alarm_state_7d: String(snapshot.scene_runtime_summary.alarm_state_7d || "no_data"),
              alarm_reasons_7d: Array.isArray(snapshot.scene_runtime_summary.alarm_reasons_7d)
                ? snapshot.scene_runtime_summary.alarm_reasons_7d
                : []
            }
          : {};
      const payload = {
        generated_at: new Date().toISOString(),
        ...result,
        scheduler_skip_summary: schedulerSkipSummary,
        scene_runtime_summary: sceneRuntimeSummary,
        ops_alarm: {
          state: String(schedulerSkipSummary.alarm_state || "clear"),
          reason: String(schedulerSkipSummary.alarm_reason || ""),
          skipped_24h: Math.max(0, Number(schedulerSkipSummary.skipped_24h || 0)),
          skipped_7d: Math.max(0, Number(schedulerSkipSummary.skipped_7d || 0)),
          latest_skip_reason: String(schedulerSkipSummary.latest_skip_reason || ""),
          latest_skip_at: schedulerSkipSummary.latest_skip_at || null
        }
      };
      fs.writeFileSync(artifactPaths.latestJsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
      reportPath = artifactPaths.latestJsonPath;
    }
    console.log(JSON.stringify(result, null, 2));
    if (reportPath) {
      console.log(`[liveops] report=${reportPath}`);
    }
    if (result.ok !== true) {
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[err] v5_live_ops_campaign_dispatch failed:", err?.message || err);
  process.exitCode = 1;
});
