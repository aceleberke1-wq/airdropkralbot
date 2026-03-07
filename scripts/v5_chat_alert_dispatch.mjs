import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import dotenv from "dotenv";
import pg from "pg";

const require = createRequire(import.meta.url);
const { buildPgPoolConfig } = require("../packages/shared/src/v5/dbConnection");
const { resolveChatAlertArtifactPaths } = require("../packages/shared/src/runtimeArtifactPaths");
const configService = require("../apps/bot/src/services/configService");
const seasonStore = require("../apps/bot/src/stores/seasonStore");
const { createChatAlertDispatchService } = require("../apps/admin-api/src/services/chatAlertDispatchService");

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

  const service = createChatAlertDispatchService({
    pool,
    fetchImpl: typeof fetch === "function" ? fetch.bind(globalThis) : null,
    botToken: String(process.env.BOT_TOKEN || "").trim(),
    botUsername: String(process.env.BOT_USERNAME || "airdropkral_2026_bot").trim(),
    webappPublicUrl: String(process.env.WEBAPP_PUBLIC_URL || "").trim(),
    webappHmacSecret: String(process.env.WEBAPP_HMAC_SECRET || "").trim(),
    configService,
    seasonStore,
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
    const result = await service.runDispatchCycle({
      dryRun: parseBool(args.dry_run ?? args.dryRun, false),
      chestReadyLimit: toNumber(args.chest_limit ?? args.chestLimit, 25),
      missionRefreshLimit: toNumber(args.mission_limit ?? args.missionLimit, 25),
      rareDropLimit: toNumber(args.rare_limit ?? args.rareLimit, 15),
      streakRiskLimit: toNumber(args.streak_limit ?? args.streakLimit, 25),
      eventCountdownLimit: toNumber(args.event_limit ?? args.eventLimit, 25),
      seasonDeadlineLimit: toNumber(args.season_limit ?? args.seasonLimit, 25),
      comebackOfferLimit: toNumber(args.comeback_limit ?? args.comebackLimit, 25),
      streakRiskWindowMinutes: toNumber(args.streak_window_min ?? args.streakWindowMin, 90),
      comebackInactiveHours: toNumber(args.comeback_hours ?? args.comebackHours, 72),
      eventCountdownTargetDays: String(args.event_days ?? args.eventDays ?? "3,1")
        .split(",")
        .map((value) => Number(String(value || "").trim()))
        .filter((value) => Number.isFinite(value) && value > 0)
      ,
      seasonDeadlineTargetDays: String(args.season_days ?? args.seasonDays ?? "7,3,1")
        .split(",")
        .map((value) => Number(String(value || "").trim()))
        .filter((value) => Number.isFinite(value) && value > 0)
    });
    const emitReport = parseBool(args.emit_report ?? args.emitReport ?? process.env.V5_CHAT_ALERT_DISPATCH_EMIT_REPORT, true);
    let reportPath = "";
    if (emitReport) {
      const artifactPaths = resolveChatAlertArtifactPaths(repoRoot);
      if (!fs.existsSync(artifactPaths.outDir)) {
        fs.mkdirSync(artifactPaths.outDir, { recursive: true });
      }
      const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").replace("T", "_");
      const stampedPath = path.join(artifactPaths.outDir, `V5_CHAT_ALERT_DISPATCH_${stamp}.json`);
      const payload = {
        generated_at: new Date().toISOString(),
        ...result
      };
      fs.writeFileSync(stampedPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
      fs.writeFileSync(artifactPaths.latestJsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
      reportPath = stampedPath;
    }
    console.log(JSON.stringify(result, null, 2));
    if (reportPath) {
      console.log(`[alerts] report=${reportPath}`);
    }
    if (result.ok !== true) {
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[err] v5_chat_alert_dispatch failed:", err?.message || err);
  process.exitCode = 1;
});
