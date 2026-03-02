const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const dotenv = require("dotenv");
const fastify = require("fastify")({ logger: true });
const { Pool } = require("pg");
const taskCatalog = require("../../bot/src/taskCatalog");
const missionStore = require("../../bot/src/stores/missionStore");
const seasonStore = require("../../bot/src/stores/seasonStore");
const globalStore = require("../../bot/src/stores/globalStore");
const taskStore = require("../../bot/src/stores/taskStore");
const economyStore = require("../../bot/src/stores/economyStore");
const riskStore = require("../../bot/src/stores/riskStore");
const shopStore = require("../../bot/src/stores/shopStore");
const userStore = require("../../bot/src/stores/userStore");
const arenaStore = require("../../bot/src/stores/arenaStore");
const tokenStore = require("../../bot/src/stores/tokenStore");
const webappStore = require("../../bot/src/stores/webappStore");
const botRuntimeStore = require("../../bot/src/stores/botRuntimeStore");
const payoutStore = require("../../bot/src/stores/payoutStore");
const configService = require("../../bot/src/services/configService");
const economyEngine = require("../../bot/src/services/economyEngine");
const antiAbuseEngine = require("../../bot/src/services/antiAbuseEngine");
const arenaEngine = require("../../bot/src/services/arenaEngine");
const arenaService = require("../../bot/src/services/arenaService");
const tokenEngine = require("../../bot/src/services/tokenEngine");
const txVerifier = require("../../bot/src/services/txVerifier");
const nexusEventEngine = require("../../bot/src/services/nexusEventEngine");
const nexusContractEngine = require("../../bot/src/services/nexusContractEngine");
const { getCommandRegistry, getPrimaryCommands } = require("../../bot/src/commands/registry");
const { normalizeLanguage } = require("../../bot/src/i18n");
const contractsV2 = require("../../../packages/shared/src/contracts");
const { computePvpProgressionState } = require("../../../packages/shared/src/v5/progressionEngine");
const { evaluateAdminPolicy, buildAdminActionSignature: buildAdminPolicySignature } = require("../../../packages/shared/src/v5/adminPolicyEngine");
const walletAuthEngine = require("../../../packages/shared/src/v5/walletAuthEngine");
const { registerWebappV2AdminOpsRoutes } = require("./routes/webapp/v2/adminOpsRoutes");
const { registerWebappV2PayoutRoutes } = require("./routes/webapp/v2/payoutRoutes");
const { registerWebappV2WalletRoutes } = require("./routes/webapp/v2/walletRoutes");
const { registerWebappV2AdminQueueRoutes } = require("./routes/webapp/v2/adminQueueRoutes");
const { registerWebappAdminPayoutReleaseRoutes } = require("./routes/webapp/admin/payoutReleaseRoutes");
const { registerWebappAdminFreezeRoutes } = require("./routes/webapp/admin/freezeRoutes");
const { registerWebappAdminTokenRoutes } = require("./routes/webapp/admin/tokenAdminRoutes");
const { registerWebappAdminKycTokenDecisionRoutes } = require("./routes/webapp/admin/kycTokenDecisionRoutes");
const { registerWebappAdminPayoutDecisionRoutes } = require("./routes/webapp/admin/payoutDecisionRoutes");
const { registerAdminRuntimeRoutes } = require("./routes/admin/runtimeRoutes");
const { registerAdminSystemOpsRoutes } = require("./routes/admin/systemOpsRoutes");
const { registerAdminTokenPolicyRoutes } = require("./routes/admin/tokenPolicyRoutes");
const { registerAdminTokenRequestRoutes } = require("./routes/admin/tokenRequestRoutes");
const { registerAdminPayoutRoutes } = require("./routes/admin/payoutAdminRoutes");
const { createCriticalAdminPolicyService } = require("./services/policy/criticalAdminPolicyService");

const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN;

function parseTelegramId(rawValue, fieldName) {
  const cleaned = String(rawValue || "")
    .trim()
    .replace(/^['"]|['"]$/g, "");
  if (!/^\d+$/.test(cleaned)) {
    throw new Error(`${fieldName} must be a numeric Telegram user id`);
  }
  const parsed = Number(cleaned);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} is out of range`);
  }
  return parsed;
}

const ADMIN_TELEGRAM_ID = parseTelegramId(process.env.ADMIN_TELEGRAM_ID || "", "ADMIN_TELEGRAM_ID");
const DATABASE_URL = process.env.DATABASE_URL;
const DATABASE_SSL = process.env.DATABASE_SSL === "1";
const PORT = Number(process.env.PORT || process.env.ADMIN_API_PORT || 4000);
const WEBAPP_PUBLIC_URL = String(process.env.WEBAPP_PUBLIC_URL || "").trim();
const WEBAPP_VERSION_OVERRIDE = String(process.env.WEBAPP_VERSION_OVERRIDE || "").trim();
const RENDER_GIT_COMMIT = String(process.env.RENDER_GIT_COMMIT || "").trim();
const RELEASE_GIT_REVISION_ENV = String(process.env.RELEASE_GIT_REVISION || process.env.GIT_COMMIT || "").trim();
const WEBAPP_STARTUP_TIMESTAMP = String(Date.now());
const WEBAPP_HMAC_SECRET = process.env.WEBAPP_HMAC_SECRET || "";
const WEBAPP_AUTH_TTL_SEC = Number(process.env.WEBAPP_AUTH_TTL_SEC || 900);
const TOKEN_TX_VERIFY = process.env.TOKEN_TX_VERIFY === "1";
const TOKEN_TX_VERIFY_STRICT = process.env.TOKEN_TX_VERIFY_STRICT === "1";
const HC_TO_BTC_RATE = Number(process.env.HC_TO_BTC_RATE || 0.00001);
const PAYOUT_BTC_THRESHOLD = Number(process.env.PAYOUT_BTC_THRESHOLD || 0.0001);
const PAYOUT_COOLDOWN_HOURS = Math.max(1, Number(process.env.PAYOUT_COOLDOWN_HOURS || 72));
const REPO_ROOT_DIR = path.resolve(__dirname, "../../..");
const WEBAPP_DIR = path.join(__dirname, "../../webapp");
const WEBAPP_DIST_DIR = path.join(WEBAPP_DIR, "dist");
const WEBAPP_ASSETS_DIR = path.join(WEBAPP_DIR, "assets");
const FLAG_DEFAULTS = Object.freeze({
  ARENA_AUTH_ENABLED: process.env.ARENA_AUTH_ENABLED === "1",
  RAID_AUTH_ENABLED: process.env.RAID_AUTH_ENABLED === "1",
  TOKEN_CURVE_ENABLED: process.env.TOKEN_CURVE_ENABLED === "1",
  TOKEN_AUTO_APPROVE_ENABLED: process.env.TOKEN_AUTO_APPROVE_ENABLED === "1",
  PAYOUT_RELEASE_V1_ENABLED: process.env.PAYOUT_RELEASE_V1_ENABLED !== "0",
  PAYOUT_RELEASE_V2_ENABLED: process.env.PAYOUT_RELEASE_V2_ENABLED !== "0",
  UX_V4_ENABLED: process.env.UX_V4_ENABLED !== "0",
  UX_V5_ENABLED: process.env.UX_V5_ENABLED !== "0",
  WEBAPP_PLAYER_MODE_DEFAULT: process.env.WEBAPP_PLAYER_MODE_DEFAULT !== "0",
  I18N_V1_ENABLED: process.env.I18N_V1_ENABLED !== "0",
  I18N_V2_ENABLED: process.env.I18N_V2_ENABLED !== "0",
  PVP_POLL_PRIMARY: process.env.PVP_POLL_PRIMARY !== "0",
  WALLET_AUTH_V1_ENABLED: process.env.WALLET_AUTH_V1_ENABLED !== "0",
  KYC_THRESHOLD_V1_ENABLED: process.env.KYC_THRESHOLD_V1_ENABLED !== "0",
  MONETIZATION_CORE_V1_ENABLED: process.env.MONETIZATION_CORE_V1_ENABLED !== "0",
  WEBAPP_V3_ENABLED: process.env.WEBAPP_V3_ENABLED === "1",
  WEBAPP_TS_BUNDLE_ENABLED: process.env.WEBAPP_TS_BUNDLE_ENABLED === "1"
});
const CRITICAL_ENV_LOCKED_FLAGS = new Set([
  "ARENA_AUTH_ENABLED",
  "RAID_AUTH_ENABLED",
  "PAYOUT_RELEASE_V1_ENABLED",
  "PAYOUT_RELEASE_V2_ENABLED",
  "UX_V4_ENABLED",
  "UX_V5_ENABLED",
  "WEBAPP_PLAYER_MODE_DEFAULT",
  "I18N_V1_ENABLED",
  "I18N_V2_ENABLED",
  "PVP_POLL_PRIMARY",
  "WALLET_AUTH_V1_ENABLED",
  "KYC_THRESHOLD_V1_ENABLED",
  "MONETIZATION_CORE_V1_ENABLED",
  "WEBAPP_V3_ENABLED",
  "WEBAPP_TS_BUNDLE_ENABLED",
  "TOKEN_CURVE_ENABLED",
  "TOKEN_AUTO_APPROVE_ENABLED"
]);
const FLAG_SOURCE_MODES = new Set(["env_locked", "db_override"]);
const FLAG_SOURCE_MODE_ENV = String(process.env.FLAG_SOURCE_MODE || "").trim().toLowerCase();
const RELEASE_ENV = String(process.env.RELEASE_ENV || process.env.NODE_ENV || "production");
const RELEASE_GIT_REVISION = String(RENDER_GIT_COMMIT || RELEASE_GIT_REVISION_ENV || "local").trim();
const RELEASE_DEPLOY_ID = String(
  process.env.RENDER_DEPLOY_ID || process.env.RENDER_SERVICE_ID || process.env.RELEASE_DEPLOY_ID || ""
).trim();
const PVP_WS_ENABLED = process.env.PVP_WS_ENABLED === "1";
const WALLET_CHALLENGE_TTL_SEC = Math.max(60, Math.min(900, Number(process.env.WALLET_CHALLENGE_TTL_SEC || 300)));
const WALLET_SESSION_TTL_SEC = Math.max(900, Math.min(2592000, Number(process.env.WALLET_SESSION_TTL_SEC || 86400)));
const WALLET_VERIFY_MODE = String(process.env.WALLET_VERIFY_MODE || "format_only").trim().toLowerCase();
const KYC_RISK_THRESHOLD = Math.max(0, Math.min(1, Number(process.env.KYC_RISK_THRESHOLD || 0.75)));
const KYC_PAYOUT_BTC_THRESHOLD = Math.max(0, Number(process.env.KYC_PAYOUT_BTC_THRESHOLD || 0.001));
const KYC_REQUIRE_IF_WALLET_UNLINKED = process.env.KYC_REQUIRE_IF_WALLET_UNLINKED === "1";
const SANCTIONED_WALLET_SET = new Set(
  String(process.env.SANCTIONED_WALLET_ADDRESSES || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
);
const DEFAULT_V5_PASS_PRODUCTS = Object.freeze([
  {
    pass_key: "premium_pass_7d",
    title_tr: "Premium Pass 7 Gun",
    title_en: "Premium Pass 7 Days",
    duration_days: 7,
    price_amount: 280,
    price_currency: "SC",
    effects_json: {
      effect_key: "premium_pass",
      sc_multiplier: 0.15,
      season_point_bonus: 0.2,
      objective_speed_mult: 0.05
    }
  },
  {
    pass_key: "premium_pass_30d",
    title_tr: "Premium Pass 30 Gun",
    title_en: "Premium Pass 30 Days",
    duration_days: 30,
    price_amount: 980,
    price_currency: "SC",
    effects_json: {
      effect_key: "premium_pass",
      sc_multiplier: 0.22,
      season_point_bonus: 0.32,
      objective_speed_mult: 0.1
    }
  }
]);
const DEFAULT_V5_COSMETIC_CATALOG = Object.freeze([
  {
    item_key: "cosmetic_profile_frame_crimson",
    category: "profile_prestige",
    title_tr: "Crimson Frame",
    title_en: "Crimson Frame",
    price_amount: 140,
    price_currency: "SC",
    rarity: "rare"
  },
  {
    item_key: "cosmetic_emote_glitch",
    category: "emote",
    title_tr: "Glitch Emote",
    title_en: "Glitch Emote",
    price_amount: 90,
    price_currency: "SC",
    rarity: "uncommon"
  },
  {
    item_key: "cosmetic_banner_nexus",
    category: "visual",
    title_tr: "Nexus Banner",
    title_en: "Nexus Banner",
    price_amount: 210,
    price_currency: "SC",
    rarity: "epic"
  }
]);
const ADMIN_CONFIRM_TTL_MS = Math.max(30000, Number(process.env.ADMIN_CONFIRM_TTL_MS || 90000));
const ADMIN_CRITICAL_COOLDOWN_MS = Math.max(1000, Number(process.env.ADMIN_CRITICAL_COOLDOWN_MS || 8000));
const ADMIN_CRITICAL_TABLES_CACHE_TTL_MS = Math.max(5000, Number(process.env.ADMIN_CRITICAL_TABLES_CACHE_TTL_MS || 30000));

if (!ADMIN_API_TOKEN) {
  throw new Error("Missing required env: ADMIN_API_TOKEN");
}
if (!DATABASE_URL) {
  throw new Error("Missing required env: DATABASE_URL");
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_SSL ? { rejectUnauthorized: false } : undefined
});

pool.on("error", (err) => {
  fastify.log.error(err, "Postgres pool error");
});

const criticalAdminPolicyService = createCriticalAdminPolicyService({
  pool,
  crypto,
  evaluateAdminPolicy,
  buildAdminPolicySignature,
  hasTable,
  adminConfirmTtlMs: ADMIN_CONFIRM_TTL_MS,
  adminCooldownMs: ADMIN_CRITICAL_COOLDOWN_MS,
  tablesCacheTtlMs: ADMIN_CRITICAL_TABLES_CACHE_TTL_MS
});

function parseAdminId(req) {
  const headerValue = req.headers["x-admin-id"];
  if (headerValue === undefined || headerValue === null || String(headerValue).trim() === "") {
    return ADMIN_TELEGRAM_ID;
  }
  try {
    return parseTelegramId(headerValue, "x-admin-id");
  } catch {
    return 0;
  }
}

function isAdminTelegramId(telegramId) {
  const actorId = Number(telegramId || 0);
  return actorId > 0 && String(actorId) === String(ADMIN_TELEGRAM_ID || "");
}

async function requireTables() {
  const check = await pool.query(
    `SELECT
        to_regclass('public.config_versions') AS config_versions,
        to_regclass('public.system_state') AS system_state,
        to_regclass('public.offers') AS offers;`
  );
  const row = check.rows[0] || {};
  return Boolean(row.config_versions && row.system_state && row.offers);
}

async function requirePayoutTables() {
  const check = await pool.query(
    `SELECT
        to_regclass('public.payout_requests') AS payout_requests,
        to_regclass('public.payout_tx') AS payout_tx,
        to_regclass('public.admin_audit') AS admin_audit;`
  );
  const row = check.rows[0] || {};
  return Boolean(row.payout_requests && row.payout_tx && row.admin_audit);
}

function parseLimit(value, fallback = 50, max = 200) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.min(max, Math.floor(parsed)));
}

function parseTruthyQuery(value) {
  if (value === true || value === 1) {
    return true;
  }
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

function createDeterministicUnit(seed) {
  const hex = crypto.createHash("sha1").update(String(seed || "")).digest("hex");
  return parseInt(hex.slice(0, 8), 16) / 0xffffffff;
}

function buildShadowTickDecision(sessionRef, tickSeq, expectedAction, actionWindowMs) {
  const actionPool = ["strike", "guard", "charge"];
  const normalizedExpected = String(expectedAction || "").toLowerCase();
  const expected = actionPool.includes(normalizedExpected) ? normalizedExpected : actionPool[0];
  const followRoll = createDeterministicUnit(`${sessionRef}:shadow:follow:${tickSeq}`);
  const pickRoll = createDeterministicUnit(`${sessionRef}:shadow:pick:${tickSeq}`);
  const latencyRoll = createDeterministicUnit(`${sessionRef}:shadow:latency:${tickSeq}`);
  const followExpected = followRoll <= 0.64;
  const fallbackActions = actionPool.filter((key) => key !== expected);
  const fallbackAction = fallbackActions[Math.floor(pickRoll * fallbackActions.length)] || "guard";
  const inputAction = followExpected ? expected : fallbackAction;
  const windowMs = Math.max(250, Number(actionWindowMs || 800));
  const latencyMs = Math.round(120 + latencyRoll * (windowMs * 0.9));
  return {
    inputAction,
    latencyMs,
    strategy: followExpected ? "mirror_expected" : "mixup"
  };
}

function shouldAdvanceShadowOnTick(sessionView, tickSeq) {
  if (!sessionView || String(sessionView.status || "") !== "active") {
    return false;
  }
  if (String(sessionView.opponent_type || "") !== "shadow") {
    return false;
  }
  if (Number(sessionView.opponent_user_id || 0) > 0) {
    return false;
  }
  const selfActions = Number(sessionView?.action_count?.self || 0);
  const oppActions = Number(sessionView?.action_count?.opponent || 0);
  const drift = selfActions - oppActions;
  if (drift >= 2) {
    return true;
  }
  if (drift <= -1) {
    return false;
  }
  const roll = createDeterministicUnit(`${sessionView.session_ref}:shadow:cadence:${tickSeq}`);
  return roll <= 0.58;
}

async function proxyWebAppApiV1(request, reply, options = {}) {
  const targetPath = String(options.targetPath || "").trim();
  if (!targetPath) {
    reply.code(500).send({ success: false, error: "proxy_target_missing" });
    return;
  }
  const method = String(options.method || request.method || "GET").toUpperCase();
  const query = request.query && typeof request.query === "object" ? new URLSearchParams(request.query).toString() : "";
  const url = query ? `${targetPath}?${query}` : targetPath;
  const payload = method === "GET" ? undefined : request.body;
  const injectRes = await fastify.inject({
    method,
    url,
    payload
  });

  let data = null;
  try {
    data = JSON.parse(injectRes.payload);
  } catch {
    data = null;
  }
  if (data && typeof data === "object") {
    if (typeof options.transform === "function") {
      data = options.transform(data) || data;
    }
    reply.code(injectRes.statusCode).send(data);
    return;
  }
  reply
    .code(injectRes.statusCode)
    .type(String(injectRes.headers["content-type"] || "application/json; charset=utf-8"))
    .send(injectRes.payload);
}

const COMMAND_CATALOG_REGISTRY = Object.freeze(getCommandRegistry());

function buildCommandCatalog(options = {}) {
  const primaryOnly = options.primaryOnly !== false;
  const lang = normalizeLanguage(options.lang || "tr", "tr");
  const source = primaryOnly ? getPrimaryCommands(COMMAND_CATALOG_REGISTRY) : COMMAND_CATALOG_REGISTRY;
  return source.map((command) => ({
    key: String(command.key || ""),
    handler: String(command.handler || command.key || ""),
    aliases: Array.isArray(command.aliases) ? command.aliases.slice() : [],
    description_tr: String(command.description_tr || ""),
    description_en: String(command.description_en || ""),
    description: lang === "en" ? String(command.description_en || command.description_tr || "") : String(command.description_tr || command.description_en || ""),
    intents: Array.isArray(command.intents) ? command.intents.slice(0, 8) : [],
    scenarios: Array.isArray(command.scenarios) ? command.scenarios.slice(0, 8) : [],
    outcomes: Array.isArray(command.outcomes) ? command.outcomes.slice(0, 8) : [],
    adminOnly: Boolean(command.adminOnly),
    min_role: String(command.min_role || (command.adminOnly ? "admin" : "player")),
    primary: Boolean(command.primary)
  }));
}

function buildPvpTickDiagnostics(session, directorPayload) {
  if (!session) {
    return {
      score_drift: 0,
      action_drift: 0,
      queue_pressure: 0,
      urgency: "idle",
      recommendation: "balanced",
      anomaly_bias: "none",
      contract_mode: "open"
    };
  }
  const scoreSelf = Number(session?.score?.self || 0);
  const scoreOpp = Number(session?.score?.opponent || 0);
  const actionsSelf = Number(session?.action_count?.self || 0);
  const actionsOpp = Number(session?.action_count?.opponent || 0);
  const scoreDrift = scoreSelf - scoreOpp;
  const actionDrift = actionsSelf - actionsOpp;
  const queuePressure = clamp(Math.max(0, actionDrift) / 8, 0, 1);
  const ttl = Number(session.ttl_sec_left || 0);
  let urgency = "steady";
  if (String(session.status || "") !== "active") {
    urgency = "idle";
  } else if (ttl <= 10) {
    urgency = "critical";
  } else if (queuePressure >= 0.45 || scoreDrift <= -12) {
    urgency = "pressure";
  } else if (scoreDrift >= 10) {
    urgency = "advantage";
  }
  return {
    score_drift: scoreDrift,
    action_drift: actionDrift,
    queue_pressure: Number(queuePressure.toFixed(3)),
    urgency,
    recommendation: String(
      directorPayload?.director?.recommended_mode ||
        directorPayload?.contract?.required_mode ||
        "balanced"
    ),
    anomaly_bias: String(directorPayload?.anomaly?.preferred_mode || "none"),
    contract_mode: String(directorPayload?.contract?.required_mode || "open")
  };
}

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function summarizeProviderHealthRows(rows = []) {
  const grouped = new Map();
  for (const raw of Array.isArray(rows) ? rows : []) {
    const provider = String(raw.provider || "unknown");
    if (!grouped.has(provider)) {
      grouped.set(provider, {
        provider,
        latest_ok: Boolean(raw.ok),
        latest_status_code: Math.max(0, Math.floor(toFiniteNumber(raw.status_code, 0))),
        latest_latency_ms: Math.max(0, Math.floor(toFiniteNumber(raw.latency_ms, 0))),
        latest_error_code: String(raw.error_code || ""),
        latest_error_message: String(raw.error_message || ""),
        latest_checked_at: raw.checked_at || null,
        checks_15m: 0,
        ok_15m: 0,
        avg_latency_15m: 0
      });
    }
    const entry = grouped.get(provider);
    const checkedAtMs = raw.checked_at ? new Date(raw.checked_at).getTime() : 0;
    if (checkedAtMs > 0 && checkedAtMs >= Date.now() - 15 * 60 * 1000) {
      entry.checks_15m += 1;
      if (raw.ok) {
        entry.ok_15m += 1;
      }
      entry.avg_latency_15m += Math.max(0, toFiniteNumber(raw.latency_ms, 0));
    }
  }

  const providers = Array.from(grouped.values()).map((entry) => ({
    ...entry,
    avg_latency_15m:
      entry.checks_15m > 0 ? Number((entry.avg_latency_15m / entry.checks_15m).toFixed(2)) : 0,
    ok_ratio_15m: entry.checks_15m > 0 ? Number((entry.ok_15m / entry.checks_15m).toFixed(4)) : 0
  }));

  const providerCount = providers.length;
  const okProviderCount = providers.filter((entry) => entry.latest_ok).length;
  return {
    providers,
    provider_count: providerCount,
    ok_provider_count: okProviderCount,
    ok_ratio: providerCount > 0 ? Number((okProviderCount / providerCount).toFixed(4)) : 0
  };
}

const ORACLE_CACHE = {
  ts: 0,
  payload: null
};

const ORACLE_PROVIDERS = Object.freeze([
  {
    provider: "coingecko",
    endpoint: "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
    parsePrice: (body) => Number(body?.bitcoin?.usd || 0)
  },
  {
    provider: "coinbase",
    endpoint: "https://api.coinbase.com/v2/prices/BTC-USD/spot",
    parsePrice: (body) => Number(body?.data?.amount || 0)
  }
]);

function normalizeOraclePayload(raw = {}) {
  return {
    provider: String(raw.provider || "unknown"),
    endpoint: String(raw.endpoint || ""),
    ok: Boolean(raw.ok),
    statusCode: Math.max(0, Math.floor(Number(raw.statusCode || 0))),
    latencyMs: Math.max(0, Math.floor(Number(raw.latencyMs || 0))),
    priceUsd: Number(raw.priceUsd || 0),
    errorCode: String(raw.errorCode || ""),
    errorMessage: String(raw.errorMessage || ""),
    sourceTs: raw.sourceTs || null,
    confidence: clamp(Number(raw.confidence || 0), 0, 1),
    payload: raw.payload && typeof raw.payload === "object" ? raw.payload : {}
  };
}

function summarizeOracleQuorum(providerPayloads = [], fallbackPriceUsd = 0) {
  const providers = Array.isArray(providerPayloads)
    ? providerPayloads.map((item) => normalizeOraclePayload(item))
    : [];
  const okProviders = providers.filter((item) => item.ok && Number(item.priceUsd || 0) > 0);
  const providerCount = providers.length;
  const okProviderCount = okProviders.length;
  const sorted = okProviders.slice().sort((a, b) => Number(a.priceUsd) - Number(b.priceUsd));
  const medianPrice =
    sorted.length === 0
      ? 0
      : sorted.length % 2 === 1
        ? Number(sorted[(sorted.length - 1) / 2].priceUsd)
        : Number(sorted[sorted.length / 2 - 1].priceUsd + sorted[sorted.length / 2].priceUsd) / 2;
  const tolerance = 0.02;
  const agreeingCount =
    medianPrice > 0
      ? sorted.filter((item) => Math.abs(Number(item.priceUsd) - medianPrice) / medianPrice <= tolerance).length
      : 0;
  const agreementRatio = okProviderCount > 0 ? agreeingCount / okProviderCount : 0;
  const quorumPass = okProviderCount >= 2 && agreementRatio >= 0.5;
  const chosen = quorumPass
    ? {
        provider: "quorum",
        endpoint: "multi_provider",
        priceUsd: medianPrice,
        statusCode: 200,
        latencyMs: sorted.reduce((max, item) => Math.max(max, Number(item.latencyMs || 0)), 0),
        confidence: clamp(0.65 + agreementRatio * 0.35, 0, 1),
        sourceTs: new Date().toISOString(),
        errorCode: "",
        errorMessage: "",
        ok: true
      }
    : okProviderCount > 0
      ? {
          ...sorted[0],
          confidence: clamp(Number(sorted[0].confidence || 0.6), 0, 1)
        }
      : {
          provider: "curve_fallback",
          endpoint: "",
          priceUsd: Number(fallbackPriceUsd || 0),
          statusCode: 0,
          latencyMs: 0,
          confidence: 0.1,
          sourceTs: null,
          errorCode: "no_provider_available",
          errorMessage: "No healthy provider response",
          ok: false
        };
  return {
    providers,
    providerCount,
    okProviderCount,
    quorumPriceUsd: Number(medianPrice || 0),
    agreementRatio: Number(agreementRatio.toFixed(6)),
    decision: quorumPass ? "provider_quorum" : okProviderCount > 0 ? "fallback" : "fallback",
    chosen
  };
}

async function fetchWithTimeout(url, timeoutMs = 3500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        accept: "application/json"
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

async function getReliableCoreApiQuote(db, { force = false, fallbackPriceUsd = 0 } = {}) {
  const now = Date.now();
  if (!force && ORACLE_CACHE.payload && now - ORACLE_CACHE.ts < 45000) {
    return ORACLE_CACHE.payload;
  }
  const providerPayloads = [];
  for (const provider of ORACLE_PROVIDERS) {
    const started = Date.now();
    let payload = {
      provider: provider.provider,
      endpoint: provider.endpoint,
      ok: false,
      statusCode: 0,
      latencyMs: 0,
      priceUsd: 0,
      errorCode: "",
      errorMessage: "",
      sourceTs: null,
      confidence: 0.45
    };
    try {
      const res = await fetchWithTimeout(provider.endpoint, 3500);
      const body = await res.json().catch(() => ({}));
      const parsedPrice = Number(provider.parsePrice(body));
      payload.statusCode = Number(res.status || 0);
      payload.latencyMs = Date.now() - started;
      payload.priceUsd = Number.isFinite(parsedPrice) ? parsedPrice : 0;
      payload.ok = Boolean(res.ok && payload.priceUsd > 0);
      payload.sourceTs = payload.ok ? new Date().toISOString() : null;
      payload.confidence = payload.ok ? (payload.statusCode === 200 ? 0.95 : 0.75) : 0.2;
      if (!payload.ok) {
        payload.errorCode = "upstream_invalid_payload";
      }
      payload.payload = body && typeof body === "object" ? body : {};
    } catch (err) {
      payload.latencyMs = Date.now() - started;
      payload.errorCode = err?.name === "AbortError" ? "timeout" : "network_error";
      payload.errorMessage = String(err?.message || "oracle_fetch_failed");
      payload.confidence = 0.1;
    }
    providerPayloads.push(payload);
  }

  const quorum = summarizeOracleQuorum(providerPayloads, fallbackPriceUsd);
  const payload = {
    provider: quorum.chosen.provider,
    endpoint: quorum.chosen.endpoint,
    ok: Boolean(quorum.okProviderCount > 0),
    statusCode: Number(quorum.chosen.statusCode || 0),
    latencyMs: Number(quorum.chosen.latencyMs || 0),
    priceUsd: Number(quorum.chosen.priceUsd || 0),
    errorCode: String(quorum.chosen.errorCode || ""),
    errorMessage: String(quorum.chosen.errorMessage || ""),
    sourceTs: quorum.chosen.sourceTs || null,
    confidence: Number(quorum.chosen.confidence || 0),
    provider_count: quorum.providerCount,
    ok_provider_count: quorum.okProviderCount,
    quorum_price_usd: quorum.quorumPriceUsd,
    agreement_ratio: quorum.agreementRatio,
    decision: quorum.decision,
    providers: quorum.providers
  };

  try {
    for (const entry of quorum.providers) {
      await webappStore.insertExternalApiHealth(db, {
        provider: entry.provider,
        endpoint: entry.endpoint,
        checkName: "token_quote",
        ok: entry.ok,
        statusCode: entry.statusCode,
        latencyMs: entry.latencyMs,
        errorCode: entry.errorCode,
        errorMessage: entry.errorMessage,
        healthJson: {
          price_usd: Number(entry.priceUsd || 0),
          decision: payload.decision
        }
      });
      await tokenStore.insertQuoteProviderHealth(db, {
        provider: entry.provider,
        endpoint: entry.endpoint,
        checkName: "token_quote",
        ok: entry.ok,
        statusCode: entry.statusCode,
        latencyMs: entry.latencyMs,
        errorCode: entry.errorCode,
        errorMessage: entry.errorMessage,
        payloadJson: {
          price_usd: Number(entry.priceUsd || 0),
          confidence: Number(entry.confidence || 0)
        }
      });
      if (entry.ok) {
        await webappStore.insertPriceOracleSnapshot(db, {
          provider: entry.provider,
          symbol: "BTC",
          priceUsd: Number(entry.priceUsd || 0),
          confidence: Number(entry.confidence || 0.75),
          sourceTs: entry.sourceTs || new Date().toISOString(),
          snapshotJson: {
            endpoint: entry.endpoint,
            decision: payload.decision
          }
        });
      }
    }
  } catch (err) {
    if (err.code !== "42P01") {
      throw err;
    }
  }

  ORACLE_CACHE.ts = now;
  ORACLE_CACHE.payload = payload;
  return payload;
}

function deterministicUuid(input) {
  const hex = crypto.createHash("sha1").update(String(input)).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex
    .slice(16, 20)
    .join("")}-${hex.slice(20, 32).join("")}`;
}

function newUuid() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return deterministicUuid(`release:${Date.now()}:${Math.random()}`);
}

async function hasReleaseMarkersTable(db) {
  const check = await db.query(`SELECT to_regclass('public.release_markers') IS NOT NULL AS ok;`);
  return Boolean(check.rows?.[0]?.ok);
}

async function hasTable(db, tableName) {
  const normalized = String(tableName || "").trim().toLowerCase();
  if (!/^[a-z0-9_]+$/.test(normalized)) {
    return false;
  }
  const result = await db.query(`SELECT to_regclass($1) IS NOT NULL AS ok;`, [`public.${normalized}`]);
  return Boolean(result.rows?.[0]?.ok);
}

async function readSchemaHead(db) {
  try {
    const result = await db.query(
      `SELECT filename, applied_at
       FROM schema_migrations
       ORDER BY applied_at DESC, filename DESC
       LIMIT 1;`
    );
    const row = result.rows?.[0] || null;
    return {
      available: true,
      filename: row?.filename || "",
      applied_at: row?.applied_at || null
    };
  } catch (err) {
    if (err.code === "42P01") {
      return {
        available: false,
        filename: "",
        applied_at: null
      };
    }
    throw err;
  }
}

function pickCriticalRuntimeFlags(flags) {
  const subset = {};
  for (const key of Array.from(CRITICAL_ENV_LOCKED_FLAGS.values())) {
    subset[key] = Boolean(flags?.[key]);
  }
  subset.PVP_WS_ENABLED = Boolean(flags?.PVP_WS_ENABLED);
  return subset;
}

function summarizeAssetMode({ sceneMode = "", manifestSummary = null, runtimeAssetSummary = null } = {}) {
  const scene = String(sceneMode || "").toLowerCase();
  if (scene === "minimal") {
    return "lite";
  }

  const manifestTotal = Number(manifestSummary?.total_assets || manifestSummary?.total || 0);
  const manifestReady = Number(manifestSummary?.ready_assets || manifestSummary?.ready || 0);
  const integrityRatio = Number(manifestSummary?.integrity_ratio || 0);
  const runtimeTotal = Number(runtimeAssetSummary?.total_assets || 0);
  const runtimeReady = Number(runtimeAssetSummary?.ready_assets || 0);

  const total = Math.max(manifestTotal, runtimeTotal);
  const ready = Math.max(manifestReady, runtimeReady);

  if (total <= 0) {
    return scene === "lite" ? "lite" : "procedural";
  }
  if (ready <= 0) {
    return "procedural";
  }
  if (ready < total) {
    return "mixed";
  }
  if (integrityRatio > 0 && integrityRatio < 0.999) {
    return "mixed";
  }
  if (scene === "lite") {
    return "lite";
  }
  return "glb";
}

async function readActiveEconomyVersion(db) {
  try {
    const result = await db.query(
      `SELECT version
       FROM config_versions
       WHERE config_key = 'economy_params'
       ORDER BY version DESC, created_at DESC
       LIMIT 1;`
    );
    return Number(result.rows?.[0]?.version || 0);
  } catch (err) {
    if (err.code === "42P01") {
      return 0;
    }
    throw err;
  }
}

async function insertReleaseMarker(db, payload = {}) {
  const marker = {
    releaseRef: String(payload.releaseRef || newUuid()),
    gitRevision: String(payload.gitRevision || RELEASE_GIT_REVISION || "local"),
    deployId: String(payload.deployId || RELEASE_DEPLOY_ID || ""),
    environment: String(payload.environment || RELEASE_ENV || "production"),
    configVersion: Number(payload.configVersion || 0),
    health: payload.health || {},
    notes: String(payload.notes || ""),
    createdBy: Number(payload.createdBy || 0)
  };
  const inserted = await db.query(
    `INSERT INTO release_markers (
       release_ref,
       git_revision,
       deploy_id,
       environment,
       config_version,
       health_json,
       notes,
       created_by
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
     RETURNING *;`,
    [
      marker.releaseRef,
      marker.gitRevision,
      marker.deployId,
      marker.environment,
      marker.configVersion,
      JSON.stringify(marker.health),
      marker.notes,
      marker.createdBy
    ]
  );
  return inserted.rows?.[0] || null;
}

async function readLatestReleaseMarker(db) {
  const result = await db.query(
    `SELECT id, release_ref, git_revision, deploy_id, environment, config_version, health_json, notes, created_at, created_by
     FROM release_markers
     ORDER BY created_at DESC, id DESC
     LIMIT 1;`
  );
  return result.rows?.[0] || null;
}

async function captureReleaseMarker(db, payload = {}) {
  const exists = await hasReleaseMarkersTable(db);
  if (!exists) {
    return null;
  }
  const configVersion = Number(payload.configVersion || (await readActiveEconomyVersion(db)));
  const health = payload.health || (await dependencyHealth());
  return insertReleaseMarker(db, {
    releaseRef: payload.releaseRef,
    gitRevision: payload.gitRevision,
    deployId: payload.deployId,
    environment: payload.environment,
    configVersion,
    health,
    notes: payload.notes,
    createdBy: payload.createdBy
  });
}

function sanitizeWebAppVersion(rawValue) {
  const cleaned = String(rawValue || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 40);
  return cleaned;
}

function buildVersionedWebAppUrl(baseUrl, version) {
  const base = String(baseUrl || "").trim();
  const safeVersion = sanitizeWebAppVersion(version) || sanitizeWebAppVersion(WEBAPP_STARTUP_TIMESTAMP) || "startup";
  if (!base) {
    return "";
  }
  try {
    const parsed = new URL(base);
    parsed.searchParams.set("v", safeVersion);
    return parsed.toString();
  } catch (err) {
    fastify.log.error(
      { err: String(err?.message || err), webapp_public_url: base },
      "Failed to parse WEBAPP_PUBLIC_URL while building versioned launch URL"
    );
    const separator = base.includes("?") ? "&" : "?";
    return `${base}${separator}v=${encodeURIComponent(safeVersion)}`;
  }
}

async function resolveWebAppVersion(db) {
  const overrideVersion = sanitizeWebAppVersion(WEBAPP_VERSION_OVERRIDE);
  if (overrideVersion) {
    return { version: overrideVersion, source: "env_override" };
  }

  if (db) {
    try {
      const hasTable = await hasReleaseMarkersTable(db);
      if (hasTable) {
        const marker = await readLatestReleaseMarker(db);
        const markerVersion = sanitizeWebAppVersion(marker?.git_revision || "");
        if (markerVersion) {
          return { version: markerVersion, source: "release_marker" };
        }
      }
    } catch (err) {
      if (err.code !== "42P01") {
        fastify.log.warn({ err: String(err?.message || err) }, "Failed to read release marker for webapp version");
      }
    }
  }

  const releaseVersion = sanitizeWebAppVersion(RELEASE_GIT_REVISION_ENV);
  if (releaseVersion) {
    return { version: releaseVersion, source: "release_env" };
  }

  const renderCommitVersion = sanitizeWebAppVersion(RENDER_GIT_COMMIT);
  if (renderCommitVersion) {
    return { version: renderCommitVersion, source: "render_git_commit" };
  }

  const startupVersion = sanitizeWebAppVersion(WEBAPP_STARTUP_TIMESTAMP) || "startup";
  return { version: startupVersion, source: "startup_timestamp" };
}

function signWebAppPayload(uid, ts) {
  return crypto.createHmac("sha256", WEBAPP_HMAC_SECRET).update(`${uid}.${ts}`).digest("hex");
}

function issueWebAppSession(uid) {
  const ts = Date.now().toString();
  const sig = signWebAppPayload(uid, ts);
  return {
    uid: String(uid),
    ts,
    sig,
    ttl_sec: WEBAPP_AUTH_TTL_SEC
  };
}

function verifyWebAppAuth(uidRaw, tsRaw, sigRaw) {
  if (!WEBAPP_HMAC_SECRET) {
    return { ok: false, reason: "webapp_secret_missing" };
  }

  const uid = String(uidRaw || "");
  const ts = String(tsRaw || "");
  const sig = String(sigRaw || "");
  if (!uid || !ts || !sig) {
    return { ok: false, reason: "missing_fields" };
  }

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) {
    return { ok: false, reason: "invalid_timestamp" };
  }
  const ageSec = Math.floor((Date.now() - tsNum) / 1000);
  if (ageSec < -30 || ageSec > WEBAPP_AUTH_TTL_SEC) {
    return { ok: false, reason: "expired" };
  }

  const expected = signWebAppPayload(uid, ts);
  const expectedBuffer = Buffer.from(expected, "hex");
  const providedBuffer = Buffer.from(sig, "hex");
  if (expectedBuffer.length !== providedBuffer.length) {
    return { ok: false, reason: "invalid_signature" };
  }
  if (!crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
    return { ok: false, reason: "invalid_signature" };
  }
  return { ok: true, uid: Number(uid) };
}

async function requireWebAppAdmin(client, reply, authUid) {
  if (!isAdminTelegramId(authUid)) {
    reply.code(403).send({ success: false, error: "admin_required" });
    return null;
  }
  const profile = await getProfileByTelegram(client, authUid);
  if (!profile) {
    reply.code(404).send({ success: false, error: "user_not_started" });
    return null;
  }
  return profile;
}

function normalizeBalances(rows) {
  const balances = { SC: 0, HC: 0, RC: 0 };
  for (const row of rows) {
    const currency = String(row.currency || "").toUpperCase();
    balances[currency] = Number(row.balance || 0);
  }
  return balances;
}

function maskAddress(address) {
  const value = String(address || "");
  if (value.length <= 12) {
    return value;
  }
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

function getPaymentAddressBook() {
  return {
    btc: String(process.env.BTC_PAYOUT_ADDRESS_PRIMARY || ""),
    trx: String(process.env.TRX_PAYOUT_ADDRESS || ""),
    eth: String(process.env.ETH_PAYOUT_ADDRESS || ""),
    sol: String(process.env.SOL_PAYOUT_ADDRESS || ""),
    ton: String(process.env.TON_PAYOUT_ADDRESS || "")
  };
}

function getWalletCapabilities(featureFlags = {}) {
  const enabled = isFeatureEnabled(featureFlags, "WALLET_AUTH_V1_ENABLED");
  return {
    enabled,
    verify_mode: WALLET_VERIFY_MODE,
    session_ttl_sec: WALLET_SESSION_TTL_SEC,
    challenge_ttl_sec: WALLET_CHALLENGE_TTL_SEC,
    chains: walletAuthEngine.SUPPORTED_WALLET_CHAINS.map((chain) => ({
      chain,
      auth_mode: chain === "eth" ? "siwe_eip4361" : chain === "sol" ? "sol_sign_message" : "ton_proof_message",
      rollout: "primary",
      enabled
    }))
  };
}

function maskWalletLinkAddress(address) {
  return maskAddress(address);
}

function normalizeWalletChainInput(value) {
  return walletAuthEngine.normalizeWalletChain(value);
}

function normalizeWalletAddressInput(chain, address) {
  return walletAuthEngine.normalizeWalletAddress(chain, address);
}

function isSanctionedWalletAddress(address) {
  const normalized = String(address || "").trim().toLowerCase();
  if (!normalized) return false;
  return SANCTIONED_WALLET_SET.has(normalized);
}

async function hasWalletAuthTables(db) {
  const result = await db.query(
    `SELECT
       to_regclass('public.v5_wallet_challenges') IS NOT NULL AS challenges,
       to_regclass('public.v5_wallet_links') IS NOT NULL AS links,
       to_regclass('public.v5_wallet_sessions') IS NOT NULL AS sessions;`
  );
  const row = result.rows?.[0] || {};
  return Boolean(row.challenges && row.links && row.sessions);
}

async function hasKycTables(db) {
  const result = await db.query(
    `SELECT
       to_regclass('public.v5_kyc_profiles') IS NOT NULL AS profiles,
       to_regclass('public.v5_kyc_screening_events') IS NOT NULL AS screening;`
  );
  const row = result.rows?.[0] || {};
  return Boolean(row.profiles && row.screening);
}

async function insertWalletChallenge(db, payload = {}) {
  const nonceValue = String(payload.nonce || "");
  const nonceHash = crypto.createHash("md5").update(nonceValue).digest("hex");
  const row = await db.query(
    `INSERT INTO v5_wallet_challenges (
       challenge_ref,
       user_id,
       chain,
       address_norm,
       nonce,
       nonce_hash,
       challenge_text,
       issued_at,
       expires_at,
       status,
       payload_json
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10::jsonb)
     RETURNING challenge_ref, user_id, chain, address_norm, nonce, nonce_hash, challenge_text, issued_at, expires_at, status;`,
    [
      String(payload.challenge_ref || ""),
      Number(payload.user_id || 0),
      String(payload.chain || ""),
      String(payload.address_norm || ""),
      nonceValue,
      nonceHash,
      String(payload.challenge_text || ""),
      payload.issued_at || new Date().toISOString(),
      payload.expires_at || new Date(Date.now() + WALLET_CHALLENGE_TTL_SEC * 1000).toISOString(),
      JSON.stringify(payload.payload_json || {})
    ]
  );
  return row.rows?.[0] || null;
}

async function readWalletChallengeForUpdate(db, challengeRef, userId) {
  const result = await db.query(
    `SELECT id, challenge_ref, user_id, chain, address_norm, nonce, challenge_text, issued_at, expires_at, status, consumed_at, payload_json
     FROM v5_wallet_challenges
     WHERE challenge_ref = $1
       AND user_id = $2
     LIMIT 1
     FOR UPDATE;`,
    [String(challengeRef || ""), Number(userId || 0)]
  );
  return result.rows?.[0] || null;
}

async function markWalletChallengeStatus(db, challengeRef, userId, status, meta = {}) {
  const result = await db.query(
    `UPDATE v5_wallet_challenges
     SET status = $3,
         consumed_at = CASE WHEN $3 IN ('verified', 'rejected', 'expired') THEN now() ELSE consumed_at END,
         payload_json = COALESCE(payload_json, '{}'::jsonb) || $4::jsonb
     WHERE challenge_ref = $1
       AND user_id = $2
     RETURNING challenge_ref, status, consumed_at;`,
    [String(challengeRef || ""), Number(userId || 0), String(status || "pending"), JSON.stringify(meta || {})]
  );
  return result.rows?.[0] || null;
}

async function upsertWalletLink(db, payload = {}) {
  const row = await db.query(
    `INSERT INTO v5_wallet_links (
       user_id,
       chain,
       address_norm,
       address_display,
       is_primary,
       verification_state,
       verification_method,
       kyc_status,
       risk_score,
       metadata_json,
       linked_at,
       updated_at,
       unlinked_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, now(), now(), NULL)
     ON CONFLICT (user_id, chain, address_norm)
     DO UPDATE SET
       address_display = EXCLUDED.address_display,
       is_primary = EXCLUDED.is_primary,
       verification_state = EXCLUDED.verification_state,
       verification_method = EXCLUDED.verification_method,
       kyc_status = EXCLUDED.kyc_status,
       risk_score = EXCLUDED.risk_score,
       metadata_json = COALESCE(v5_wallet_links.metadata_json, '{}'::jsonb) || EXCLUDED.metadata_json,
       updated_at = now(),
       unlinked_at = NULL
     RETURNING user_id, chain, address_norm, address_display, is_primary, verification_state, verification_method, kyc_status, risk_score, linked_at, updated_at, unlinked_at;`,
    [
      Number(payload.user_id || 0),
      String(payload.chain || ""),
      String(payload.address_norm || ""),
      String(payload.address_display || ""),
      Boolean(payload.is_primary !== false),
      String(payload.verification_state || "verified_format"),
      String(payload.verification_method || "format_only"),
      String(payload.kyc_status || "unknown"),
      Number(payload.risk_score || 0),
      JSON.stringify(payload.metadata_json || {})
    ]
  );
  return row.rows?.[0] || null;
}

async function insertWalletSession(db, payload = {}) {
  const row = await db.query(
    `INSERT INTO v5_wallet_sessions (
       session_ref,
       user_id,
       chain,
       address_norm,
       proof_hash,
       source_challenge_ref,
       issued_at,
       expires_at,
       revoked_at,
       meta_json
     )
     VALUES ($1, $2, $3, $4, $5, $6, now(), now() + make_interval(secs => $7), NULL, $8::jsonb)
     RETURNING session_ref, user_id, chain, address_norm, issued_at, expires_at, revoked_at, meta_json;`,
    [
      String(payload.session_ref || newUuid()),
      Number(payload.user_id || 0),
      String(payload.chain || ""),
      String(payload.address_norm || ""),
      String(payload.proof_hash || ""),
      String(payload.source_challenge_ref || ""),
      Math.max(60, Number(payload.ttl_sec || WALLET_SESSION_TTL_SEC)),
      JSON.stringify(payload.meta_json || {})
    ]
  );
  return row.rows?.[0] || null;
}

async function readWalletSessionState(db, userId) {
  const result = await db.query(
    `SELECT
       s.session_ref,
       s.chain,
       s.address_norm,
       s.issued_at,
       s.expires_at,
       s.revoked_at,
       l.address_display,
       l.linked_at,
       l.kyc_status
     FROM v5_wallet_sessions s
     LEFT JOIN v5_wallet_links l
       ON l.user_id = s.user_id
      AND l.chain = s.chain
      AND l.address_norm = s.address_norm
      AND l.unlinked_at IS NULL
     WHERE s.user_id = $1
       AND s.revoked_at IS NULL
       AND s.expires_at > now()
     ORDER BY s.expires_at DESC, s.issued_at DESC
     LIMIT 1;`,
    [Number(userId || 0)]
  );
  const row = result.rows?.[0] || null;
  if (!row) {
    return {
      active: false,
      chain: "",
      address: "",
      linked_at: null,
      expires_at: null,
      session_ref: "",
      kyc_status: "unknown"
    };
  }
  return {
    active: true,
    chain: String(row.chain || ""),
    address: String(row.address_display || row.address_norm || ""),
    linked_at: row.linked_at || null,
    expires_at: row.expires_at || null,
    session_ref: String(row.session_ref || ""),
    kyc_status: String(row.kyc_status || "unknown")
  };
}

async function listWalletLinks(db, userId) {
  const result = await db.query(
    `SELECT user_id, chain, address_norm, address_display, is_primary, verification_state, verification_method, kyc_status, risk_score, linked_at, updated_at
     FROM v5_wallet_links
     WHERE user_id = $1
       AND unlinked_at IS NULL
     ORDER BY is_primary DESC, updated_at DESC, id DESC
     LIMIT 12;`,
    [Number(userId || 0)]
  );
  return result.rows || [];
}

async function revokeWalletSessions(db, userId, options = {}) {
  const chain = normalizeWalletChainInput(options.chain || "");
  const addressNorm = normalizeWalletAddressInput(chain, options.address || "");
  if (chain && addressNorm) {
    const result = await db.query(
      `UPDATE v5_wallet_sessions
       SET revoked_at = now(),
           meta_json = COALESCE(meta_json, '{}'::jsonb) || $4::jsonb
       WHERE user_id = $1
         AND chain = $2
         AND address_norm = $3
         AND revoked_at IS NULL
       RETURNING session_ref;`,
      [Number(userId || 0), chain, addressNorm, JSON.stringify({ reason: String(options.reason || "wallet_unlink") })]
    );
    return result.rowCount || 0;
  }
  const result = await db.query(
    `UPDATE v5_wallet_sessions
     SET revoked_at = now(),
         meta_json = COALESCE(meta_json, '{}'::jsonb) || $2::jsonb
     WHERE user_id = $1
       AND revoked_at IS NULL
       AND expires_at > now()
     RETURNING session_ref;`,
    [Number(userId || 0), JSON.stringify({ reason: String(options.reason || "wallet_unlink") })]
  );
  return result.rowCount || 0;
}

async function unlinkWalletLinks(db, userId, options = {}) {
  const chain = normalizeWalletChainInput(options.chain || "");
  const addressNorm = normalizeWalletAddressInput(chain, options.address || "");
  if (chain && addressNorm) {
    const result = await db.query(
      `UPDATE v5_wallet_links
       SET unlinked_at = now(),
           updated_at = now(),
           metadata_json = COALESCE(metadata_json, '{}'::jsonb) || $4::jsonb
       WHERE user_id = $1
         AND chain = $2
         AND address_norm = $3
         AND unlinked_at IS NULL
       RETURNING id;`,
      [Number(userId || 0), chain, addressNorm, JSON.stringify({ unlink_reason: String(options.reason || "wallet_unlink") })]
    );
    return result.rowCount || 0;
  }
  const result = await db.query(
    `UPDATE v5_wallet_links
     SET unlinked_at = now(),
         updated_at = now(),
         metadata_json = COALESCE(metadata_json, '{}'::jsonb) || $2::jsonb
     WHERE user_id = $1
       AND unlinked_at IS NULL
     RETURNING id;`,
    [Number(userId || 0), JSON.stringify({ unlink_reason: String(options.reason || "wallet_unlink_all") })]
  );
  return result.rowCount || 0;
}

async function readKycProfile(db, userId) {
  const result = await db.query(
    `SELECT user_id, status, tier, provider_ref, last_reviewed_at, expires_at, payload_json, updated_at
     FROM v5_kyc_profiles
     WHERE user_id = $1
     LIMIT 1;`,
    [Number(userId || 0)]
  );
  return result.rows?.[0] || null;
}

async function listKycManualQueue(db, limit = 50) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit || 50)));
  const result = await db.query(
    `SELECT
       p.user_id,
       p.status,
       p.tier,
       p.provider_ref,
       p.last_reviewed_at,
       p.updated_at,
       p.expires_at,
       p.payload_json,
       e.chain,
       e.address_norm,
       e.screening_result,
       e.risk_score AS screening_risk_score,
       e.reason_code AS screening_reason_code,
       e.created_at AS screening_created_at
     FROM v5_kyc_profiles p
     LEFT JOIN LATERAL (
       SELECT
         se.user_id,
         se.chain,
         se.address_norm,
         se.screening_result,
         se.risk_score,
         se.reason_code,
         se.created_at
       FROM v5_kyc_screening_events se
       WHERE se.user_id = p.user_id
       ORDER BY se.created_at DESC, se.id DESC
       LIMIT 1
     ) e ON TRUE
     WHERE LOWER(COALESCE(p.status, 'unknown')) IN ('pending', 'manual_review', 'review', 'under_review')
     ORDER BY COALESCE(p.updated_at, p.last_reviewed_at, e.created_at, now()) DESC
     LIMIT $1;`,
    [safeLimit]
  );
  return Array.isArray(result.rows) ? result.rows : [];
}

async function upsertKycProfile(db, payload = {}) {
  const result = await db.query(
    `INSERT INTO v5_kyc_profiles (
       user_id,
       status,
       tier,
       provider_ref,
       last_reviewed_at,
       expires_at,
       payload_json,
       updated_at
     )
     VALUES ($1, $2, $3, $4, now(), $5, $6::jsonb, now())
     ON CONFLICT (user_id)
     DO UPDATE SET
       status = EXCLUDED.status,
       tier = EXCLUDED.tier,
       provider_ref = EXCLUDED.provider_ref,
       last_reviewed_at = EXCLUDED.last_reviewed_at,
       expires_at = EXCLUDED.expires_at,
       payload_json = COALESCE(v5_kyc_profiles.payload_json, '{}'::jsonb) || EXCLUDED.payload_json,
       updated_at = now()
     RETURNING user_id, status, tier, provider_ref, last_reviewed_at, expires_at, payload_json, updated_at;`,
    [
      Number(payload.user_id || 0),
      String(payload.status || "unknown"),
      String(payload.tier || "none"),
      String(payload.provider_ref || ""),
      payload.expires_at || null,
      JSON.stringify(payload.payload_json || {})
    ]
  );
  return result.rows?.[0] || null;
}

async function insertKycScreeningEvent(db, payload = {}) {
  await db.query(
    `INSERT INTO v5_kyc_screening_events (
       user_id,
       chain,
       address_norm,
       screening_result,
       risk_score,
       reason_code,
       payload_json
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb);`,
    [
      Number(payload.user_id || 0),
      String(payload.chain || ""),
      String(payload.address_norm || ""),
      String(payload.screening_result || "pending"),
      Number(payload.risk_score || 0),
      String(payload.reason_code || ""),
      JSON.stringify(payload.payload_json || {})
    ]
  );
}

function normalizeKycState(profile = null) {
  const status = String(profile?.status || "unknown").toLowerCase();
  const tier = String(profile?.tier || "none").toLowerCase();
  const blocked = status === "blocked" || status === "rejected" || status === "sanctioned";
  const approved = status === "verified" || status === "approved";
  return {
    status,
    tier,
    blocked,
    approved
  };
}

function normalizeKycDecision(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (["approve", "approved", "verify", "verified"].includes(raw)) {
    return "approve";
  }
  if (["reject", "rejected"].includes(raw)) {
    return "reject";
  }
  if (["block", "blocked", "ban"].includes(raw)) {
    return "block";
  }
  return "";
}

async function evaluatePayoutKycGuard(db, options = {}) {
  const flags = options.featureFlags || {};
  const enabled = isFeatureEnabled(flags, "KYC_THRESHOLD_V1_ENABLED");
  if (!enabled) {
    return {
      enabled: false,
      required: false,
      allowed: true,
      reason_code: "kyc_disabled",
      risk_score: Number(options.risk_score || 0),
      amount_btc: Number(options.amount_btc || 0),
      wallet_linked: false,
      kyc_status: "unknown",
      kyc_tier: "none"
    };
  }

  const userId = Number(options.user_id || 0);
  const riskScore = Number(options.risk_score || 0);
  const amountBtc = Number(options.amount_btc || 0);
  const hasTables = await hasKycTables(db);
  if (!hasTables) {
    return {
      enabled: true,
      required: true,
      allowed: false,
      reason_code: "kyc_tables_missing",
      risk_score: riskScore,
      amount_btc: amountBtc,
      wallet_linked: false,
      kyc_status: "unknown",
      kyc_tier: "none"
    };
  }

  const kycProfile = await readKycProfile(db, userId);
  const kycState = normalizeKycState(kycProfile);
  const walletLinks = await listWalletLinks(db, userId);
  const walletLinked = walletLinks.length > 0;
  const requiredByRisk = riskScore >= KYC_RISK_THRESHOLD;
  const requiredByAmount = amountBtc >= KYC_PAYOUT_BTC_THRESHOLD;
  const requiredByWallet = KYC_REQUIRE_IF_WALLET_UNLINKED && !walletLinked;
  const required = requiredByRisk || requiredByAmount || requiredByWallet;

  if (kycState.blocked) {
    return {
      enabled: true,
      required: true,
      allowed: false,
      reason_code: "kyc_blocked",
      risk_score: riskScore,
      amount_btc: amountBtc,
      wallet_linked: walletLinked,
      kyc_status: kycState.status,
      kyc_tier: kycState.tier
    };
  }
  if (required && !kycState.approved) {
    return {
      enabled: true,
      required: true,
      allowed: false,
      reason_code: "kyc_required",
      risk_score: riskScore,
      amount_btc: amountBtc,
      wallet_linked: walletLinked,
      kyc_status: kycState.status,
      kyc_tier: kycState.tier
    };
  }
  return {
    enabled: true,
    required,
    allowed: true,
    reason_code: "kyc_ok",
    risk_score: riskScore,
    amount_btc: amountBtc,
    wallet_linked: walletLinked,
    kyc_status: kycState.status,
    kyc_tier: kycState.tier
  };
}

function normalizeMonetizationCurrency(value, fallback = "SC") {
  const key = String(value || fallback)
    .trim()
    .toUpperCase();
  if (["SC", "HC", "RC"].includes(key)) {
    return key;
  }
  return String(fallback || "SC")
    .trim()
    .toUpperCase();
}

function toPositiveNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function mapPassProductView(row, lang = "tr") {
  const safeLang = normalizeLanguage(lang, "tr");
  const titleTr = String(row?.title_tr || "");
  const titleEn = String(row?.title_en || "");
  const effects = row?.effects_json && typeof row.effects_json === "object" ? row.effects_json : {};
  return {
    pass_key: String(row?.pass_key || ""),
    title_tr: titleTr,
    title_en: titleEn,
    title: safeLang === "en" ? titleEn || titleTr : titleTr || titleEn,
    duration_days: Math.max(1, Number(row?.duration_days || 1)),
    price_amount: Number(row?.price_amount || 0),
    price_currency: normalizeMonetizationCurrency(row?.price_currency, "SC"),
    effects
  };
}

function mapCosmeticCatalogView(row, lang = "tr") {
  const safeLang = normalizeLanguage(lang, "tr");
  const titleTr = String(row?.title_tr || "");
  const titleEn = String(row?.title_en || "");
  return {
    item_key: String(row?.item_key || ""),
    category: String(row?.category || "cosmetic"),
    title_tr: titleTr,
    title_en: titleEn,
    title: safeLang === "en" ? titleEn || titleTr : titleTr || titleEn,
    price_amount: Number(row?.price_amount || 0),
    price_currency: normalizeMonetizationCurrency(row?.price_currency, "SC"),
    rarity: String(row?.rarity || "common")
  };
}

async function hasMonetizationTables(db) {
  const result = await db.query(
    `SELECT
       to_regclass('public.v5_pass_products') IS NOT NULL AS pass_products,
       to_regclass('public.v5_user_passes') IS NOT NULL AS user_passes,
       to_regclass('public.v5_cosmetic_purchases') IS NOT NULL AS cosmetic_purchases,
       to_regclass('public.v5_marketplace_fee_events') IS NOT NULL AS fee_events;`
  );
  const row = result.rows?.[0] || {};
  return {
    pass_products: Boolean(row.pass_products),
    user_passes: Boolean(row.user_passes),
    cosmetic_purchases: Boolean(row.cosmetic_purchases),
    fee_events: Boolean(row.fee_events),
    all: Boolean(row.pass_products && row.user_passes && row.cosmetic_purchases && row.fee_events)
  };
}

async function ensureDefaultPassProducts(db) {
  for (const product of DEFAULT_V5_PASS_PRODUCTS) {
    await db.query(
      `INSERT INTO v5_pass_products (
         pass_key,
         title_tr,
         title_en,
         duration_days,
         price_amount,
         price_currency,
         effects_json,
         active
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, true)
       ON CONFLICT (pass_key)
       DO UPDATE SET
         title_tr = EXCLUDED.title_tr,
         title_en = EXCLUDED.title_en,
         duration_days = EXCLUDED.duration_days,
         price_amount = EXCLUDED.price_amount,
         price_currency = EXCLUDED.price_currency,
         effects_json = EXCLUDED.effects_json,
         active = true,
         updated_at = now();`,
      [
        String(product.pass_key || ""),
        String(product.title_tr || ""),
        String(product.title_en || ""),
        Math.max(1, Number(product.duration_days || 1)),
        toPositiveNumber(product.price_amount, 0),
        normalizeMonetizationCurrency(product.price_currency, "SC"),
        JSON.stringify(product.effects_json || {})
      ]
    );
  }
}

async function listPassProducts(db) {
  const result = await db.query(
    `SELECT
       pass_key,
       title_tr,
       title_en,
       duration_days,
       price_amount,
       price_currency,
       effects_json
     FROM v5_pass_products
     WHERE active = true
     ORDER BY duration_days ASC, price_amount ASC, pass_key ASC
     LIMIT 16;`
  );
  return result.rows || [];
}

async function getPassProductForUpdate(db, passKey) {
  const result = await db.query(
    `SELECT
       pass_key,
       title_tr,
       title_en,
       duration_days,
       price_amount,
       price_currency,
       effects_json,
       active
     FROM v5_pass_products
     WHERE pass_key = $1
     LIMIT 1
     FOR UPDATE;`,
    [String(passKey || "").trim().toLowerCase()]
  );
  return result.rows?.[0] || null;
}

async function listActiveUserPasses(db, userId) {
  const result = await db.query(
    `SELECT
       pass_key,
       status,
       starts_at,
       expires_at,
       purchase_ref,
       payload_json
     FROM v5_user_passes
     WHERE user_id = $1
       AND status = 'active'
       AND expires_at > now()
     ORDER BY expires_at DESC, id DESC
     LIMIT 8;`,
    [Number(userId || 0)]
  );
  return result.rows || [];
}

async function listRecentUserPasses(db, userId, limit = 12) {
  const result = await db.query(
    `SELECT
       pass_key,
       status,
       starts_at,
       expires_at,
       purchase_ref,
       payload_json,
       created_at
     FROM v5_user_passes
     WHERE user_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT $2;`,
    [Number(userId || 0), Math.max(1, Math.min(32, Number(limit || 12)))]
  );
  return result.rows || [];
}

async function listRecentCosmeticPurchases(db, userId, limit = 16) {
  const result = await db.query(
    `SELECT
       item_key,
       category,
       amount_paid,
       currency,
       purchase_ref,
       payload_json,
       created_at
     FROM v5_cosmetic_purchases
     WHERE user_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT $2;`,
    [Number(userId || 0), Math.max(1, Math.min(64, Number(limit || 16)))]
  );
  return result.rows || [];
}

async function countOwnedCosmetics(db, userId) {
  const result = await db.query(
    `SELECT COUNT(DISTINCT item_key)::bigint AS owned_count
     FROM v5_cosmetic_purchases
     WHERE user_id = $1;`,
    [Number(userId || 0)]
  );
  return Number(result.rows?.[0]?.owned_count || 0);
}

async function insertUserPassPurchase(db, payload = {}) {
  const result = await db.query(
    `INSERT INTO v5_user_passes (
       user_id,
       pass_key,
       status,
       starts_at,
       expires_at,
       purchase_ref,
       payload_json
     )
     VALUES ($1, $2, 'active', now(), now() + make_interval(days => $3), $4, $5::jsonb)
     RETURNING id, user_id, pass_key, status, starts_at, expires_at, purchase_ref, payload_json, created_at;`,
    [
      Number(payload.user_id || 0),
      String(payload.pass_key || ""),
      Math.max(1, Number(payload.duration_days || 1)),
      String(payload.purchase_ref || newUuid()),
      JSON.stringify(payload.payload_json || {})
    ]
  );
  return result.rows?.[0] || null;
}

async function insertCosmeticPurchase(db, payload = {}) {
  const result = await db.query(
    `INSERT INTO v5_cosmetic_purchases (
       user_id,
       item_key,
       category,
       amount_paid,
       currency,
       purchase_ref,
       payload_json
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     RETURNING id, user_id, item_key, category, amount_paid, currency, purchase_ref, payload_json, created_at;`,
    [
      Number(payload.user_id || 0),
      String(payload.item_key || ""),
      String(payload.category || "cosmetic"),
      toPositiveNumber(payload.amount_paid, 0),
      normalizeMonetizationCurrency(payload.currency, "SC"),
      String(payload.purchase_ref || newUuid()),
      JSON.stringify(payload.payload_json || {})
    ]
  );
  return result.rows?.[0] || null;
}

function summarizeSpendFromRows(passRows = [], cosmeticRows = []) {
  const summary = { SC: 0, HC: 0, RC: 0 };
  for (const row of passRows || []) {
    const payload = row?.payload_json && typeof row.payload_json === "object" ? row.payload_json : {};
    const currency = normalizeMonetizationCurrency(payload.price_currency || "SC", "SC");
    const amount = Number(payload.price_amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      continue;
    }
    summary[currency] = Number((summary[currency] + amount).toFixed(8));
  }
  for (const row of cosmeticRows || []) {
    const currency = normalizeMonetizationCurrency(row?.currency || "SC", "SC");
    const amount = Number(row?.amount_paid || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      continue;
    }
    summary[currency] = Number((summary[currency] + amount).toFixed(8));
  }
  return summary;
}

function mapUserPassView(row) {
  const payload = row?.payload_json && typeof row.payload_json === "object" ? row.payload_json : {};
  const nowMs = Date.now();
  const expiresMs = row?.expires_at ? new Date(row.expires_at).getTime() : 0;
  const remainingSec = expiresMs > 0 ? Math.max(0, Math.floor((expiresMs - nowMs) / 1000)) : 0;
  return {
    pass_key: String(row?.pass_key || ""),
    status: String(row?.status || "active"),
    starts_at: row?.starts_at || null,
    expires_at: row?.expires_at || null,
    purchase_ref: String(row?.purchase_ref || ""),
    remaining_sec: remainingSec,
    effects: payload.effects && typeof payload.effects === "object" ? payload.effects : {},
    price_amount: Number(payload.price_amount || 0),
    price_currency: normalizeMonetizationCurrency(payload.price_currency || "SC", "SC")
  };
}

function mapCosmeticPurchaseView(row) {
  const payload = row?.payload_json && typeof row.payload_json === "object" ? row.payload_json : {};
  return {
    item_key: String(row?.item_key || ""),
    category: String(row?.category || "cosmetic"),
    amount_paid: Number(row?.amount_paid || 0),
    currency: normalizeMonetizationCurrency(row?.currency || "SC", "SC"),
    purchase_ref: String(row?.purchase_ref || ""),
    created_at: row?.created_at || null,
    rarity: String(payload.rarity || "common")
  };
}

function getCosmeticCatalog(lang = "tr") {
  return DEFAULT_V5_COSMETIC_CATALOG.map((item) => mapCosmeticCatalogView(item, lang));
}

function getCosmeticCatalogItem(itemKey) {
  const key = String(itemKey || "").trim().toLowerCase();
  if (!key) {
    return null;
  }
  return (
    DEFAULT_V5_COSMETIC_CATALOG.find((item) => String(item.item_key || "").trim().toLowerCase() === key) || null
  );
}

async function buildMonetizationSummary(db, options = {}) {
  const flags = options.featureFlags || {};
  const enabled = isFeatureEnabled(flags, "MONETIZATION_CORE_V1_ENABLED");
  const userId = Number(options.userId || 0);
  const lang = normalizeLanguage(String(options.lang || "tr"), "tr");
  if (!enabled || userId <= 0) {
    return {
      enabled,
      tables_available: false,
      pass_catalog: [],
      cosmetic_catalog: getCosmeticCatalog(lang),
      active_passes: [],
      pass_history: [],
      cosmetics: {
        owned_count: 0,
        recent: []
      },
      spend_summary: { SC: 0, HC: 0, RC: 0 },
      player_effects: {
        premium_active: false,
        sc_boost_multiplier: 0,
        season_bonus_multiplier: 0
      },
      updated_at: new Date().toISOString()
    };
  }

  const tables = await hasMonetizationTables(db);
  if (!tables.all) {
    return {
      enabled: true,
      tables_available: false,
      pass_catalog: [],
      cosmetic_catalog: getCosmeticCatalog(lang),
      active_passes: [],
      pass_history: [],
      cosmetics: {
        owned_count: 0,
        recent: []
      },
      spend_summary: { SC: 0, HC: 0, RC: 0 },
      player_effects: {
        premium_active: false,
        sc_boost_multiplier: 0,
        season_bonus_multiplier: 0
      },
      updated_at: new Date().toISOString()
    };
  }

  await ensureDefaultPassProducts(db);
  const [passProducts, activePassRows, recentPassRows, recentCosmeticsRows, ownedCosmeticsCount, activeEffects] = await Promise.all([
    listPassProducts(db),
    listActiveUserPasses(db, userId),
    listRecentUserPasses(db, userId, 10),
    listRecentCosmeticPurchases(db, userId, 10),
    countOwnedCosmetics(db, userId),
    shopStore.getActiveEffects(db, userId).catch((err) => {
      if (err.code === "42P01") return [];
      throw err;
    })
  ]);

  const spendSummary = summarizeSpendFromRows(recentPassRows, recentCosmeticsRows);
  const scBoost = Number(shopStore.getScBoostMultiplier(activeEffects || []) || 0);
  const seasonBonus = Number(shopStore.getSeasonBonusMultiplier(activeEffects || []) || 0);
  return {
    enabled: true,
    tables_available: true,
    pass_catalog: passProducts.map((row) => mapPassProductView(row, lang)),
    cosmetic_catalog: getCosmeticCatalog(lang),
    active_passes: activePassRows.map((row) => mapUserPassView(row)),
    pass_history: recentPassRows.map((row) => mapUserPassView(row)),
    cosmetics: {
      owned_count: Number(ownedCosmeticsCount || 0),
      recent: recentCosmeticsRows.map((row) => mapCosmeticPurchaseView(row))
    },
    spend_summary: spendSummary,
    player_effects: {
      premium_active: activePassRows.length > 0,
      sc_boost_multiplier: Number(scBoost.toFixed(4)),
      season_bonus_multiplier: Number(seasonBonus.toFixed(4))
    },
    updated_at: new Date().toISOString()
  };
}

async function getRuntimeConfig(db) {
  const result = await db.query(
    `SELECT config_json
     FROM config_versions
     WHERE config_key = 'economy_params'
     ORDER BY version DESC, created_at DESC
     LIMIT 1;`
  );
  const fallback = {
    loops: {
      meso: { daily_cap_base: 120 },
      macro: { season_length_days: 56 }
    }
  };
  const row = result.rows[0];
  if (!row || !row.config_json || typeof row.config_json !== "object") {
    return fallback;
  }
  return {
    ...fallback,
    ...row.config_json
  };
}

async function getProfileByTelegram(db, telegramId) {
  const result = await db.query(
    `SELECT
        u.id AS user_id,
        u.telegram_id,
        i.public_name,
        i.kingdom_tier,
        i.reputation_score,
        i.prestige_level,
        i.season_rank,
        COALESCE(s.current_streak, 0) AS current_streak,
        COALESCE(s.best_streak, 0) AS best_streak
     FROM users u
     JOIN identities i ON i.user_id = u.id
     LEFT JOIN streaks s ON s.user_id = u.id
     WHERE u.telegram_id = $1
     LIMIT 1;`,
    [telegramId]
  );
  return result.rows[0] || null;
}

async function getProfileByUserId(db, userId) {
  const result = await db.query(
    `SELECT
        u.id AS user_id,
        u.telegram_id,
        i.public_name,
        i.kingdom_tier,
        i.reputation_score,
        i.prestige_level,
        i.season_rank,
        COALESCE(s.current_streak, 0) AS current_streak,
        COALESCE(s.best_streak, 0) AS best_streak
     FROM users u
     JOIN identities i ON i.user_id = u.id
     LEFT JOIN streaks s ON s.user_id = u.id
     WHERE u.id = $1
     LIMIT 1;`,
    [Number(userId || 0)]
  );
  return result.rows[0] || null;
}

function mapOffers(offers) {
  const taskMap = new Map(taskCatalog.getCatalog().map((task) => [task.id, task]));
  return offers.map((offer) => {
    const task = taskMap.get(offer.task_type) || {};
    return {
      id: offer.id,
      task_type: offer.task_type,
      title: task.title || offer.task_type,
      family: task.family || "core",
      difficulty: Number(offer.difficulty || 0),
      duration_minutes: Number(task.durationMinutes || 0),
      reward_preview: task.rewardPreview || "-",
      expires_at: offer.expires_at
    };
  });
}

function mapAttempt(row) {
  if (!row) {
    return null;
  }
  const taskMap = new Map(taskCatalog.getCatalog().map((task) => [task.id, task]));
  const task = taskMap.get(row.task_type) || {};
  return {
    id: Number(row.id),
    task_offer_id: Number(row.task_offer_id || 0),
    task_type: row.task_type,
    task_title: task.title || row.task_type || "Unknown",
    family: task.family || "core",
    started_at: row.started_at || null,
    completed_at: row.completed_at || null,
    result: row.result || "pending",
    difficulty: Number(row.difficulty || 0)
  };
}

async function getFreezeState(db) {
  let result;
  try {
    result = await db.query(
      `SELECT state_json
       FROM system_state
       WHERE state_key = 'freeze'
       LIMIT 1;`
    );
  } catch (err) {
    if (err.code === "42P01") {
      return { freeze: false, reason: "" };
    }
    throw err;
  }
  const json = result.rows[0]?.state_json || {};
  return {
    freeze: Boolean(json.freeze),
    reason: String(json.reason || "")
  };
}

function normalizeFlagKey(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeFlagSourceMode(value, fallback = "env_locked") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (FLAG_SOURCE_MODES.has(normalized)) {
    return normalized;
  }
  return fallback;
}

async function readFlagSourceState(db) {
  const envMode = normalizeFlagSourceMode(FLAG_SOURCE_MODE_ENV, "env_locked");
  try {
    const result = await db.query(
      `SELECT source_mode, source_json
       FROM flag_source_state
       WHERE source_key = 'global'
       LIMIT 1;`
    );
    const row = result.rows[0] || {};
    const dbMode = normalizeFlagSourceMode(row.source_mode, envMode);
    const effectiveMode = FLAG_SOURCE_MODES.has(FLAG_SOURCE_MODE_ENV) ? envMode : dbMode;
    return {
      source_mode: effectiveMode,
      source_json: row.source_json || {},
      env_forced: FLAG_SOURCE_MODES.has(FLAG_SOURCE_MODE_ENV)
    };
  } catch (err) {
    if (err.code !== "42P01") {
      throw err;
    }
    return {
      source_mode: envMode,
      source_json: {},
      env_forced: FLAG_SOURCE_MODES.has(FLAG_SOURCE_MODE_ENV)
    };
  }
}

async function loadFeatureFlags(db, opts = {}) {
  const flags = { ...FLAG_DEFAULTS };
  const withMeta = Boolean(opts.withMeta);
  const sourceState = await readFlagSourceState(db);
  const sourceMode = normalizeFlagSourceMode(opts.sourceMode, sourceState.source_mode || "env_locked");
  const dbRows = [];
  try {
    const result = await db.query(
      `SELECT flag_key, is_enabled, value_json, note, updated_at, updated_by
       FROM feature_flags;`
    );
    for (const row of result.rows) {
      const key = normalizeFlagKey(row.flag_key);
      if (!key) continue;
      dbRows.push({
        flag_key: key,
        is_enabled: Boolean(row.is_enabled),
        value_json: row.value_json || {},
        note: String(row.note || ""),
        updated_at: row.updated_at || null,
        updated_by: Number(row.updated_by || 0)
      });
    }
  } catch (err) {
    if (err.code !== "42P01") {
      throw err;
    }
  }

  for (const row of dbRows) {
    if (sourceMode === "env_locked" && CRITICAL_ENV_LOCKED_FLAGS.has(row.flag_key)) {
      continue;
    }
    flags[row.flag_key] = Boolean(row.is_enabled);
  }

  if (!withMeta) {
    return flags;
  }
  return {
    flags,
    source_mode: sourceMode,
    source_json: sourceState.source_json || {},
    env_forced: Boolean(sourceState.env_forced),
    db_flags: dbRows
  };
}

function isFeatureEnabled(flags, key) {
  const normalizedKey = normalizeFlagKey(key);
  if (!normalizedKey) return false;
  return Boolean(flags?.[normalizedKey]);
}

async function insertFeatureFlagAudit(db, payload) {
  try {
    await db.query(
      `INSERT INTO feature_flag_audit (
         flag_key,
         previous_enabled,
         next_enabled,
         previous_value_json,
         next_value_json,
         note,
         source_mode,
         changed_by
       )
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8);`,
      [
        normalizeFlagKey(payload.flagKey),
        payload.previousEnabled === null ? null : Boolean(payload.previousEnabled),
        Boolean(payload.nextEnabled),
        JSON.stringify(payload.previousValueJson || {}),
        JSON.stringify(payload.nextValueJson || {}),
        String(payload.note || ""),
        normalizeFlagSourceMode(payload.sourceMode, "db_override"),
        Number(payload.changedBy || 0)
      ]
    );
  } catch (err) {
    if (err.code !== "42P01") {
      throw err;
    }
  }
}

async function upsertFeatureFlag(db, { flagKey, enabled, updatedBy, note }) {
  const normalized = normalizeFlagKey(flagKey);
  const previous = await db
    .query(
      `SELECT flag_key, is_enabled, value_json
       FROM feature_flags
       WHERE flag_key = $1
       LIMIT 1;`,
      [normalized]
    )
    .then((res) => res.rows[0] || null)
    .catch((err) => {
      if (err.code === "42P01") return null;
      throw err;
    });
  const result = await db.query(
    `INSERT INTO feature_flags (flag_key, is_enabled, note, updated_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (flag_key)
     DO UPDATE SET
       is_enabled = EXCLUDED.is_enabled,
       note = COALESCE(NULLIF(EXCLUDED.note, ''), feature_flags.note),
       updated_at = now(),
       updated_by = EXCLUDED.updated_by
     RETURNING flag_key, is_enabled, note, updated_at, updated_by;`,
    [normalized, Boolean(enabled), String(note || ""), Number(updatedBy || 0)]
  );
  const next = result.rows[0] || null;
  const sourceState = await readFlagSourceState(db);
  await insertFeatureFlagAudit(db, {
    flagKey: normalized,
    previousEnabled: previous ? Boolean(previous.is_enabled) : null,
    nextEnabled: Boolean(next?.is_enabled),
    previousValueJson: previous?.value_json || {},
    nextValueJson: {},
    note: String(note || ""),
    sourceMode: sourceState.source_mode,
    changedBy: Number(updatedBy || 0)
  });
  return next;
}

async function resolveWebAppVariant(db) {
  const flags = await loadFeatureFlags(db);
  const tsBundleEnabled = isFeatureEnabled(flags, "WEBAPP_TS_BUNDLE_ENABLED");
  if (tsBundleEnabled) {
    const distIndex = path.join(WEBAPP_DIST_DIR, "index.html");
    const distAltIndex = path.join(WEBAPP_DIST_DIR, "index.vite.html");
    if (fs.existsSync(distIndex) || fs.existsSync(distAltIndex)) {
      return {
        source: "dist",
        rootDir: WEBAPP_DIST_DIR,
        assetsDir: path.join(WEBAPP_DIST_DIR, "assets"),
        indexPath: fs.existsSync(distIndex) ? distIndex : distAltIndex
      };
    }
  }
  return {
    source: "legacy",
    rootDir: WEBAPP_DIR,
    assetsDir: WEBAPP_ASSETS_DIR,
    indexPath: path.join(WEBAPP_DIR, "index.html")
  };
}

function buildWebAppAssetServeRoots(variant) {
  const roots = [];
  const pushRoot = (candidate) => {
    const clean = path.resolve(String(candidate || ""));
    if (!clean || roots.includes(clean)) {
      return;
    }
    roots.push(clean);
  };
  pushRoot(variant?.assetsDir);
  pushRoot(path.join(WEBAPP_DIST_DIR, "assets"));
  pushRoot(WEBAPP_ASSETS_DIR);
  return roots.filter((root) => fs.existsSync(root));
}

function resolveAssetRelativePath(assetWebPath = "") {
  const normalized = String(assetWebPath || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  if (!normalized) {
    return "";
  }
  if (normalized.startsWith("webapp/assets/")) {
    return normalized.slice("webapp/assets/".length);
  }
  if (normalized.startsWith("assets/")) {
    return normalized.slice("assets/".length);
  }
  return normalized;
}

function resolveAssetFileFromRoots(roots, relativePath) {
  const cleanRelative = resolveAssetRelativePath(relativePath);
  if (!cleanRelative) {
    return null;
  }
  for (const root of roots || []) {
    const normalizedRoot = path.resolve(String(root || ""));
    const candidate = path.resolve(normalizedRoot, cleanRelative);
    if (!candidate.startsWith(`${normalizedRoot}${path.sep}`)) {
      continue;
    }
    if (fs.existsSync(candidate)) {
      return {
        root: normalizedRoot,
        relativePath: cleanRelative,
        filePath: candidate
      };
    }
  }
  return null;
}

function assertStartupGuards() {
  const tsBundleEnabled = FLAG_DEFAULTS.WEBAPP_TS_BUNDLE_ENABLED;
  if (tsBundleEnabled) {
    const distIndex = path.join(WEBAPP_DIST_DIR, "index.html");
    const distVite = path.join(WEBAPP_DIST_DIR, "index.vite.html");
    if (!fs.existsSync(distIndex) && !fs.existsSync(distVite)) {
      throw new Error(
        "Startup guard failed: WEBAPP_TS_BUNDLE_ENABLED=1 but apps/webapp/dist/index(.vite).html is missing"
      );
    }
  }

  const botEnabled = String(process.env.BOT_ENABLED || "1").trim() === "1";
  if (botEnabled && !String(process.env.BOT_INSTANCE_LOCK_KEY || "").trim()) {
    throw new Error("Startup guard failed: BOT_ENABLED=1 requires BOT_INSTANCE_LOCK_KEY");
  }
}

async function upsertFlagSourceMode(db, { sourceMode, sourceJson, updatedBy }) {
  const normalized = normalizeFlagSourceMode(sourceMode, "env_locked");
  const payload = sourceJson && typeof sourceJson === "object" ? sourceJson : {};
  const result = await db.query(
    `INSERT INTO flag_source_state (source_key, source_mode, source_json, updated_by)
     VALUES ('global', $1, $2::jsonb, $3)
     ON CONFLICT (source_key)
     DO UPDATE SET
       source_mode = EXCLUDED.source_mode,
       source_json = EXCLUDED.source_json,
       updated_at = now(),
       updated_by = EXCLUDED.updated_by
     RETURNING source_key, source_mode, source_json, updated_at, updated_by;`,
    [normalized, JSON.stringify(payload), Number(updatedBy || 0)]
  );
  return result.rows[0] || null;
}

function readAssetManifest() {
  const manifestPath = path.join(WEBAPP_ASSETS_DIR, "manifest.json");
  const fallback = { version: 0, models: {}, notes: "manifest_missing" };
  if (!fs.existsSync(manifestPath)) {
    return { manifestPath, manifest: fallback };
  }
  try {
    const raw = fs.readFileSync(manifestPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      manifestPath,
      manifest: parsed && typeof parsed === "object" ? parsed : fallback
    };
  } catch {
    return { manifestPath, manifest: fallback };
  }
}

function resolveManifestAssetPath(assetWebPath = "") {
  const normalized = String(assetWebPath || "").trim();
  if (!normalized) {
    return "";
  }
  const cleaned = normalized.replace(/^\/+/, "");
  const parts = cleaned.split("/");
  if (parts.length >= 3 && parts[0] === "webapp" && parts[1] === "assets") {
    return path.join(WEBAPP_ASSETS_DIR, parts.slice(2).join(path.sep));
  }
  return path.join(WEBAPP_ASSETS_DIR, path.basename(cleaned));
}

function buildAssetStatusRows() {
  const { manifestPath, manifest } = readAssetManifest();
  const models = manifest?.models && typeof manifest.models === "object" ? manifest.models : {};
  const rows = Object.entries(models).map(([assetKey, value]) => {
    const filePath = resolveManifestAssetPath(value?.path || "");
    const exists = filePath ? fs.existsSync(filePath) : false;
    const stats = exists ? fs.statSync(filePath) : null;
    return {
      asset_key: String(assetKey || ""),
      web_path: String(value?.path || ""),
      file_path: filePath,
      exists,
      size_bytes: exists ? Number(stats?.size || 0) : 0,
      updated_at: exists ? stats?.mtime?.toISOString?.() || null : null
    };
  });
  return {
    manifest_path: manifestPath,
    manifest_version: Number(manifest?.version || 0),
    manifest_notes: String(manifest?.notes || ""),
    rows
  };
}

async function persistAssetRegistry(db, rows, updatedBy = 0) {
  for (const row of rows) {
    await db.query(
      `INSERT INTO webapp_asset_registry (
         asset_key, manifest_path, file_path, file_hash, bytes_size, load_status, meta_json, updated_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
       ON CONFLICT (asset_key)
       DO UPDATE SET
         manifest_path = EXCLUDED.manifest_path,
         file_path = EXCLUDED.file_path,
         file_hash = EXCLUDED.file_hash,
         bytes_size = EXCLUDED.bytes_size,
         load_status = EXCLUDED.load_status,
         meta_json = EXCLUDED.meta_json,
         updated_at = now(),
         updated_by = EXCLUDED.updated_by;`,
      [
        row.asset_key,
        row.web_path,
        row.file_path,
        "",
        Number(row.size_bytes || 0),
        row.exists ? "ready" : "missing",
        JSON.stringify({
          exists: Boolean(row.exists),
          updated_at: row.updated_at || null
        }),
        Number(updatedBy || 0)
      ]
    );
    await db.query(
      `INSERT INTO webapp_asset_load_events (
         asset_key, event_type, event_state, event_json
       )
       VALUES ($1, 'reload', $2, $3::jsonb);`,
      [
        row.asset_key,
        row.exists ? "ok" : "missing",
        JSON.stringify({
          size_bytes: Number(row.size_bytes || 0),
          file_path: row.file_path
        })
      ]
    );
  }
}

async function persistAssetManifestState(db, summary, updatedBy = 0) {
  const revision = `v${Number(summary?.manifest_version || 0)}`;
  await db.query(
    `INSERT INTO webapp_asset_manifest_state (state_key, manifest_revision, state_json, updated_by)
     VALUES ('active', $1, $2::jsonb, $3)
     ON CONFLICT (state_key)
     DO UPDATE SET
       manifest_revision = EXCLUDED.manifest_revision,
       state_json = EXCLUDED.state_json,
       updated_at = now(),
       updated_by = EXCLUDED.updated_by;`,
    [
      revision,
      JSON.stringify({
        manifest_path: String(summary?.manifest_path || ""),
        manifest_version: Number(summary?.manifest_version || 0),
        manifest_notes: String(summary?.manifest_notes || ""),
        total_assets: Array.isArray(summary?.rows) ? summary.rows.length : 0,
        ready_assets: Array.isArray(summary?.rows) ? summary.rows.filter((row) => row.exists).length : 0
      }),
      Number(updatedBy || 0)
    ]
  );
}

const SCENE_MODE_VALUES = new Set(["pro", "lite", "cinematic", "minimal"]);
const PERF_PROFILE_VALUES = new Set(["low", "normal", "high"]);
const QUALITY_MODE_VALUES = new Set(["auto", "low", "normal", "high"]);
const HUD_DENSITY_VALUES = new Set(["compact", "full", "extended"]);

function normalizeSceneEnum(rawValue, allowed, fallback) {
  const normalized = String(rawValue || "")
    .trim()
    .toLowerCase();
  if (allowed.has(normalized)) {
    return normalized;
  }
  return fallback;
}

function clampNumber(rawValue, minValue, maxValue, fallback) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(minValue, Math.min(maxValue, parsed));
}

function buildDefaultSceneProfile({ sceneKey = "nexus_arena", uiPrefs = null, perfProfile = null } = {}) {
  const uiMode = String(uiPrefs?.ui_mode || "hardcore").toLowerCase();
  const qualityModeRaw = String(uiPrefs?.quality_mode || "auto").toLowerCase();
  let sceneMode = "pro";
  if (uiMode === "minimal") {
    sceneMode = "minimal";
  } else if (uiMode === "standard") {
    sceneMode = "lite";
  }
  const perfTier = String(perfProfile?.quality_tier || perfProfile?.profile_json?.perf_tier || "normal").toLowerCase();
  const perf = PERF_PROFILE_VALUES.has(perfTier) ? perfTier : "normal";
  const qualityMode = QUALITY_MODE_VALUES.has(qualityModeRaw) ? qualityModeRaw : "auto";
  return {
    scene_key: String(sceneKey || "nexus_arena"),
    scene_mode: sceneMode,
    perf_profile: perf,
    quality_mode: qualityMode,
    reduced_motion: Boolean(uiPrefs?.reduced_motion),
    large_text: Boolean(uiPrefs?.large_text),
    motion_intensity: Boolean(uiPrefs?.reduced_motion) ? 0.7 : 1,
    postfx_level: qualityMode === "low" ? 0.45 : qualityMode === "high" ? 1.1 : 0.8,
    hud_density: Boolean(uiPrefs?.large_text) ? "compact" : "full",
    prefs_json: uiPrefs?.prefs_json || {},
    source: "default",
    updated_at: null
  };
}

async function readSceneProfile(db, userId, sceneKey = "nexus_arena") {
  const key = String(sceneKey || "nexus_arena").trim() || "nexus_arena";
  const basePrefs = await webappStore.getUserUiPrefs(db, userId).catch((err) => {
    if (err.code === "42P01") return null;
    throw err;
  });
  const basePerf = await webappStore.getLatestPerfProfile(db, userId).catch((err) => {
    if (err.code === "42P01") return null;
    throw err;
  });
  const fallback = buildDefaultSceneProfile({
    sceneKey: key,
    uiPrefs: basePrefs,
    perfProfile: basePerf
  });
  try {
    const result = await db.query(
      `SELECT
         user_id,
         scene_key,
         scene_mode,
         perf_profile,
         quality_mode,
         reduced_motion,
         large_text,
         motion_intensity,
         postfx_level,
         hud_density,
         prefs_json,
         updated_at
       FROM webapp_scene_profiles_v2
       WHERE user_id = $1
         AND scene_key = $2
       LIMIT 1;`,
      [userId, key]
    );
    const row = result.rows?.[0];
    if (!row) {
      return fallback;
    }
    return {
      scene_key: String(row.scene_key || key),
      scene_mode: normalizeSceneEnum(row.scene_mode, SCENE_MODE_VALUES, fallback.scene_mode),
      perf_profile: normalizeSceneEnum(row.perf_profile, PERF_PROFILE_VALUES, fallback.perf_profile),
      quality_mode: normalizeSceneEnum(row.quality_mode, QUALITY_MODE_VALUES, fallback.quality_mode),
      reduced_motion: Boolean(row.reduced_motion),
      large_text: Boolean(row.large_text),
      motion_intensity: clampNumber(row.motion_intensity, 0.25, 2, fallback.motion_intensity),
      postfx_level: clampNumber(row.postfx_level, 0, 2.5, fallback.postfx_level),
      hud_density: normalizeSceneEnum(row.hud_density, HUD_DENSITY_VALUES, fallback.hud_density),
      prefs_json: row.prefs_json || {},
      source: "db",
      updated_at: row.updated_at || null
    };
  } catch (err) {
    if (err.code === "42P01") {
      return fallback;
    }
    throw err;
  }
}

async function upsertSceneProfile(db, payload) {
  const prefsJson = payload?.prefs_json && typeof payload.prefs_json === "object" ? payload.prefs_json : {};
  const result = await db.query(
    `INSERT INTO webapp_scene_profiles_v2 (
       user_id,
       scene_key,
       scene_mode,
       perf_profile,
       quality_mode,
       reduced_motion,
       large_text,
       motion_intensity,
       postfx_level,
       hud_density,
       prefs_json
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
     ON CONFLICT (user_id, scene_key)
     DO UPDATE SET
       scene_mode = EXCLUDED.scene_mode,
       perf_profile = EXCLUDED.perf_profile,
       quality_mode = EXCLUDED.quality_mode,
       reduced_motion = EXCLUDED.reduced_motion,
       large_text = EXCLUDED.large_text,
       motion_intensity = EXCLUDED.motion_intensity,
       postfx_level = EXCLUDED.postfx_level,
       hud_density = EXCLUDED.hud_density,
       prefs_json = webapp_scene_profiles_v2.prefs_json || EXCLUDED.prefs_json,
       updated_at = now()
     RETURNING
       user_id,
       scene_key,
       scene_mode,
       perf_profile,
       quality_mode,
       reduced_motion,
       large_text,
       motion_intensity,
       postfx_level,
       hud_density,
       prefs_json,
       updated_at;`,
    [
      Number(payload.user_id || 0),
      String(payload.scene_key || "nexus_arena"),
      normalizeSceneEnum(payload.scene_mode, SCENE_MODE_VALUES, "pro"),
      normalizeSceneEnum(payload.perf_profile, PERF_PROFILE_VALUES, "normal"),
      normalizeSceneEnum(payload.quality_mode, QUALITY_MODE_VALUES, "auto"),
      Boolean(payload.reduced_motion),
      Boolean(payload.large_text),
      clampNumber(payload.motion_intensity, 0.25, 2, 1),
      clampNumber(payload.postfx_level, 0, 2.5, 0.8),
      normalizeSceneEnum(payload.hud_density, HUD_DENSITY_VALUES, "full"),
      JSON.stringify(prefsJson)
    ]
  );
  return result.rows?.[0] || null;
}

async function readActiveAssetManifest(db, opts = {}) {
  const includeEntries = opts.includeEntries !== false;
  const entryLimit = Math.max(1, Math.min(800, Number(opts.entryLimit || 400)));
  try {
    const revisionRow = await db
      .query(
        `SELECT
           r.id,
           r.manifest_revision,
           r.manifest_hash,
           r.source,
           r.is_active,
           r.manifest_json,
           r.activated_at,
           r.created_at
         FROM asset_manifest_revisions r
         WHERE r.is_active = TRUE
         ORDER BY r.activated_at DESC NULLS LAST, r.created_at DESC, r.id DESC
         LIMIT 1;`
      )
      .then((res) => res.rows?.[0] || null);
    if (!revisionRow) {
      return {
        available: false,
        active_revision: null,
        entries: []
      };
    }
    let entries = [];
    if (includeEntries) {
      entries = await db
        .query(
          `SELECT
             asset_key,
             asset_path,
             fallback_path,
             asset_hash,
             bytes_size,
             integrity_status,
             exists_local,
             meta_json,
             updated_at
           FROM asset_manifest_entries
           WHERE revision_id = $1
           ORDER BY asset_key ASC
           LIMIT $2;`,
          [Number(revisionRow.id || 0), entryLimit]
        )
        .then((res) => res.rows || []);
    }
    return {
      available: true,
      active_revision: revisionRow,
      entries
    };
  } catch (err) {
    if (err.code === "42P01") {
      const fallbackState = await db
        .query(
          `SELECT state_key, manifest_revision, state_json, updated_at, updated_by
           FROM webapp_asset_manifest_state
           WHERE state_key = 'active'
           LIMIT 1;`
        )
        .then((res) => res.rows?.[0] || null)
        .catch((innerErr) => {
          if (innerErr.code === "42P01") return null;
          throw innerErr;
        });
      return {
        available: false,
        active_revision: fallbackState,
        entries: []
      };
    }
    throw err;
  }
}

function summarizeActiveAssetManifest(activeManifest) {
  const entries = Array.isArray(activeManifest?.entries) ? activeManifest.entries : [];
  const total = entries.length;
  const ready = entries.filter((row) => row.exists_local !== false).length;
  const integrityOk = entries.filter((row) => String(row.integrity_status || "").toLowerCase() === "ok").length;
  return {
    available: Boolean(activeManifest?.available),
    active_revision:
      activeManifest?.active_revision?.manifest_revision ||
      activeManifest?.active_revision?.state_json?.manifest_revision ||
      activeManifest?.active_revision?.state_json?.active_revision ||
      "",
    total_assets: total,
    ready_assets: ready,
    missing_assets: Math.max(0, total - ready),
    integrity_ok_assets: integrityOk,
    integrity_ratio: total > 0 ? Number((integrityOk / total).toFixed(4)) : 0
  };
}

function deriveAssetModeFromManifest(summary) {
  const total = Number(summary?.total_assets || 0);
  const ready = Number(summary?.ready_assets || 0);
  const integrityOk = Number(summary?.integrity_ok_assets || 0);
  const available = Boolean(summary?.available);
  if (!available || total <= 0) {
    return "procedural";
  }
  if (ready <= 0) {
    return "lite";
  }
  if (ready >= total && integrityOk >= total) {
    return "glb";
  }
  return "mixed";
}

async function computeSceneEffectiveProfile(
  db,
  {
    userId,
    sceneKey = "nexus_arena",
    persist = true,
    forceRefresh = false,
    persistSource = "scene_profile_effective",
    profileJsonExtras = {}
  } = {}
) {
  const resolvedUserId = Number(userId || 0);
  if (!resolvedUserId) {
    throw new Error("scene_effective_user_required");
  }
  const cleanSceneKey = String(sceneKey || "nexus_arena").trim() || "nexus_arena";
  const [sceneProfile, perfProfile, uiPrefs, activeManifest] = await Promise.all([
    readSceneProfile(db, resolvedUserId, cleanSceneKey),
    webappStore.getLatestPerfProfile(db, resolvedUserId).catch((err) => {
      if (err.code === "42P01") return null;
      throw err;
    }),
    webappStore.getUserUiPrefs(db, resolvedUserId).catch((err) => {
      if (err.code === "42P01") return null;
      throw err;
    }),
    readActiveAssetManifest(db, { includeEntries: true, entryLimit: 600 })
  ]);

  let latestEffective = null;
  if (!forceRefresh) {
    latestEffective = await db
      .query(
        `SELECT
           scene_mode,
           asset_mode,
           perf_profile,
           quality_mode,
           reduced_motion,
           large_text,
           fallback_active,
           profile_json,
           created_at
         FROM scene_effective_profiles
         WHERE user_id = $1
           AND scene_key = $2
         ORDER BY created_at DESC
         LIMIT 1;`,
        [resolvedUserId, cleanSceneKey]
      )
      .then((res) => res.rows?.[0] || null)
      .catch((err) => {
        if (err.code === "42P01") return null;
        throw err;
      });
  }

  const manifestSummary = summarizeActiveAssetManifest(activeManifest);
  const computedAssetMode = deriveAssetModeFromManifest(manifestSummary);
  const effective = {
    scene_key: cleanSceneKey,
    scene_mode: String(latestEffective?.scene_mode || sceneProfile?.scene_mode || "pro"),
    asset_mode: String(latestEffective?.asset_mode || computedAssetMode),
    perf_profile: String(latestEffective?.perf_profile || sceneProfile?.perf_profile || "normal"),
    quality_mode: String(latestEffective?.quality_mode || sceneProfile?.quality_mode || "auto"),
    reduced_motion:
      typeof latestEffective?.reduced_motion === "boolean"
        ? Boolean(latestEffective.reduced_motion)
        : Boolean(sceneProfile?.reduced_motion),
    large_text:
      typeof latestEffective?.large_text === "boolean"
        ? Boolean(latestEffective.large_text)
        : Boolean(sceneProfile?.large_text),
    fallback_active:
      typeof latestEffective?.fallback_active === "boolean"
        ? Boolean(latestEffective.fallback_active)
        : computedAssetMode !== "glb",
    profile_json: latestEffective?.profile_json || {},
    source: latestEffective ? "db_effective" : "computed",
    created_at: latestEffective?.created_at || null
  };

  if (persist) {
    await db
      .query(
        `INSERT INTO scene_effective_profiles (
           user_id,
           scene_key,
           scene_mode,
           asset_mode,
           perf_profile,
           quality_mode,
           reduced_motion,
           large_text,
           fallback_active,
           profile_json
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb);`,
        [
          resolvedUserId,
          cleanSceneKey,
          effective.scene_mode,
          effective.asset_mode,
          effective.perf_profile,
          effective.quality_mode,
          effective.reduced_motion,
          effective.large_text,
          effective.fallback_active,
          JSON.stringify({
            source: persistSource,
            manifest: manifestSummary,
            scene_profile: sceneProfile,
            ui_prefs: uiPrefs || null,
            ...profileJsonExtras
          })
        ]
      )
      .catch((err) => {
        if (err.code !== "42P01") {
          throw err;
        }
      });

    if (effective.fallback_active) {
      await db
        .query(
          `INSERT INTO scene_fallback_events (
             user_id,
             scene_key,
             fallback_mode,
             reason_key,
             event_json
           )
           VALUES ($1, $2, $3, $4, $5::jsonb);`,
          [
            resolvedUserId,
            cleanSceneKey,
            String(effective.asset_mode || "lite"),
            "asset_mode_fallback",
            JSON.stringify({
              source: persistSource,
              asset_mode: effective.asset_mode,
              manifest_revision: manifestSummary.active_revision || "",
              missing_assets: Number(manifestSummary.missing_assets || 0)
            })
          ]
        )
        .catch((err) => {
          if (err.code !== "42P01") {
            throw err;
          }
        });
    }
  }

  return {
    effective_profile: effective,
    scene_profile: sceneProfile,
    perf_profile: perfProfile,
    ui_prefs: uiPrefs,
    asset_manifest: {
      summary: manifestSummary,
      active_revision: activeManifest?.active_revision || null
    }
  };
}

function classifyKeywordFinding(filePath, lineText) {
  const p = String(filePath || "").replace(/\\/g, "/").toLowerCase();
  const line = String(lineText || "").toLowerCase();
  if (p.includes("/test/") || p.endsWith(".test.js") || p.endsWith(".spec.js")) {
    return "test_only";
  }
  if (line.includes("placeholder") || line.includes("orn:") || line.includes("veya hash")) {
    return "ui_placeholder";
  }
  return "runtime_risk";
}

function derivePhaseAuditStatus({ dependency, flagsMeta, variant, botRuntimeHealth }) {
  const findings = [];
  const dep = dependency || {};
  const deps = dep.dependencies || {};
  const flags = flagsMeta?.flags || {};
  const runtime = botRuntimeHealth || dep.bot_runtime || {};
  const sourceMode = String(flagsMeta?.source_mode || "env_locked");
  const bundleMode = String(variant?.source || "unknown");

  const addFinding = (finding_key, status, severity, finding_json) => {
    findings.push({ finding_key, status, severity, finding_json: finding_json || {} });
  };

  if (dep.ok && dep.db) {
    addFinding("db_health", "pass", "info", { db: true });
  } else {
    addFinding("db_health", "fail", "critical", { db: Boolean(dep.db), reason: dep.reason || "" });
  }

  if (bundleMode === "dist") {
    addFinding("webapp_bundle_mode", "pass", "info", { bundle_mode: bundleMode });
  } else {
    addFinding("webapp_bundle_mode", "warn", "warn", { bundle_mode: bundleMode });
  }

  const criticalFlagKeys = Array.from(CRITICAL_ENV_LOCKED_FLAGS.values());
  const disabledCritical = criticalFlagKeys.filter((key) => !Boolean(flags[key]));
  if (disabledCritical.length === 0) {
    addFinding("critical_flags", "pass", "info", { source_mode: sourceMode, disabled: [] });
  } else {
    addFinding("critical_flags", "warn", "warn", {
      source_mode: sourceMode,
      disabled: disabledCritical
    });
  }

  if (Boolean(runtime.alive) && Boolean(runtime.lock_acquired)) {
    addFinding("bot_runtime_lock", "pass", "info", {
      alive: true,
      lock_acquired: true,
      mode: String(runtime.mode || "")
    });
  } else {
    addFinding("bot_runtime_lock", "fail", "critical", {
      alive: Boolean(runtime.alive),
      lock_acquired: Boolean(runtime.lock_acquired),
      mode: String(runtime.mode || ""),
      reason: String(runtime.reason || "")
    });
  }

  const requiredDeps = [
    "arena_session_tables",
    "raid_session_tables",
    "pvp_session_tables",
    "token_market_tables",
    "queue_tables",
    "release_markers"
  ];
  const missingDeps = requiredDeps.filter((key) => !Boolean(deps[key]));
  if (missingDeps.length === 0) {
    addFinding("schema_runtime_core", "pass", "info", { missing: [] });
  } else {
    addFinding("schema_runtime_core", "warn", "warn", { missing: missingDeps });
  }

  const hasFail = findings.some((f) => f.status === "fail");
  const hasWarn = findings.some((f) => f.status === "warn");
  return {
    phase_status: hasFail ? "fail" : hasWarn ? "partial" : "pass",
    findings
  };
}

async function buildPhaseStatusAuditSnapshot(db, opts = {}) {
  const [dependency, flagsMeta, variant, runtimeState, schemaHead, latestRelease] = await Promise.all([
    dependencyHealth(),
    loadFeatureFlags(db, { withMeta: true }),
    resolveWebAppVariant(db),
    readBotRuntimeState(db, { stateKey: botRuntimeStore.DEFAULT_STATE_KEY, limit: 20 }),
    readSchemaHead(db),
    hasReleaseMarkersTable(db).then((exists) => (exists ? readLatestReleaseMarker(db) : null)).catch(() => null)
  ]);
  const botRuntimeHealth = projectBotRuntimeHealth(runtimeState);
  const activeManifest = await readActiveAssetManifest(db, { includeEntries: true, entryLimit: 256 }).catch((err) => {
    if (err?.code === "42P01") {
      return { available: false, active_revision: null, entries: [] };
    }
    throw err;
  });
  const manifestSummary = summarizeActiveAssetManifest(activeManifest);
  const phaseEval = derivePhaseAuditStatus({
    dependency,
    flagsMeta,
    variant,
    botRuntimeHealth
  });
  const releaseRef = String(opts.release_ref || latestRelease?.release_ref || "");
  const gitRevision = String(opts.git_revision || latestRelease?.git_revision || RELEASE_GIT_REVISION || "");
  const phaseName = String(opts.phase_name || "V3.6");
  const bundleMode = String(variant?.source || "unknown");
  const snapshotJson = {
    phase_name: phaseName,
    release_ref: releaseRef,
    git_revision: gitRevision,
    flag_source_mode: String(flagsMeta?.source_mode || "env_locked"),
    runtime_flags_effective: pickCriticalRuntimeFlags(flagsMeta?.flags || {}),
    bundle_mode: bundleMode,
    dependency_health: dependency,
    bot_runtime: {
      state_key: runtimeState?.state_key || botRuntimeStore.DEFAULT_STATE_KEY,
      health: botRuntimeHealth
    },
    schema_head: schemaHead,
    webapp_variant: {
      source: bundleMode,
      root_dir: variant?.rootDir || "",
      index_path: variant?.indexPath || ""
    },
    asset_manifest: manifestSummary,
    latest_release: latestRelease
      ? {
          release_ref: latestRelease.release_ref,
          git_revision: latestRelease.git_revision,
          deploy_id: latestRelease.deploy_id,
          environment: latestRelease.environment,
          config_version: Number(latestRelease.config_version || 0),
          created_at: latestRelease.created_at
        }
      : null
  };
  return {
    phase_name: phaseName,
    phase_status: phaseEval.phase_status,
    release_ref: releaseRef,
    git_revision: gitRevision,
    flag_source_mode: String(flagsMeta?.source_mode || "env_locked"),
    bundle_mode: bundleMode,
    bot_alive: Boolean(botRuntimeHealth.alive),
    bot_lock_acquired: Boolean(botRuntimeHealth.lock_acquired),
    schema_head: String(schemaHead || ""),
    snapshot_json: snapshotJson,
    findings: phaseEval.findings,
    dependency_health: dependency,
    feature_flags: flagsMeta,
    runtime_state: runtimeState,
    bot_runtime_health: botRuntimeHealth,
    active_manifest: activeManifest,
    manifest_summary: manifestSummary,
    latest_release: latestRelease
  };
}

async function insertRuntimeAuditSnapshot(db, payload = {}) {
  try {
    const hasSnapshots = await hasTable(db, "runtime_audit_snapshots");
    const hasFindings = await hasTable(db, "runtime_audit_findings");
    if (!hasSnapshots || !hasFindings) {
      return null;
    }
    const inserted = await db.query(
      `INSERT INTO runtime_audit_snapshots (
         audit_scope,
         phase_name,
         release_ref,
         git_revision,
         flag_source_mode,
         webapp_bundle_mode,
         bot_alive,
         bot_lock_acquired,
         schema_head,
         snapshot_json,
         created_by
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)
       RETURNING id;`,
      [
        String(payload.audit_scope || "phase_status"),
        String(payload.phase_name || "V3.6"),
        String(payload.release_ref || ""),
        String(payload.git_revision || ""),
        String(payload.flag_source_mode || "env_locked"),
        String(payload.webapp_bundle_mode || ""),
        Boolean(payload.bot_alive),
        Boolean(payload.bot_lock_acquired),
        String(payload.schema_head || ""),
        JSON.stringify(payload.snapshot_json || {}),
        Number(payload.created_by || 0)
      ]
    );
    const snapshotId = Number(inserted.rows?.[0]?.id || 0);
    const findings = Array.isArray(payload.findings) ? payload.findings : [];
    for (const finding of findings) {
      await db.query(
        `INSERT INTO runtime_audit_findings (
           snapshot_id, finding_key, severity, status, finding_json
         )
         VALUES ($1,$2,$3,$4,$5::jsonb)
         ON CONFLICT (snapshot_id, finding_key)
         DO UPDATE SET
           severity = EXCLUDED.severity,
           status = EXCLUDED.status,
           finding_json = EXCLUDED.finding_json;`,
        [
          snapshotId,
          String(finding.finding_key || "unknown"),
          String(finding.severity || "info"),
          String(finding.status || "pass"),
          JSON.stringify(finding.finding_json || {})
        ]
      );
    }
    return snapshotId || null;
  } catch (err) {
    if (err.code === "42P01") {
      return null;
    }
    throw err;
  }
}

async function upsertReleasePhaseAlignment(db, payload = {}) {
  try {
    const exists = await hasTable(db, "release_phase_alignment");
    if (!exists) {
      return null;
    }
    const releaseRef = String(payload.release_ref || payload.releaseRef || "");
    const phaseName = String(payload.phase_name || payload.phaseName || "V3.6");
    if (!releaseRef) {
      return null;
    }
    const result = await db.query(
      `INSERT INTO release_phase_alignment (
         release_ref,
         git_revision,
         phase_name,
         phase_status,
         flag_source_mode,
         bundle_mode,
         bot_alive,
         bot_lock_acquired,
         acceptance_json,
         created_by
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
       ON CONFLICT (release_ref, phase_name)
       DO UPDATE SET
         git_revision = EXCLUDED.git_revision,
         phase_status = EXCLUDED.phase_status,
         flag_source_mode = EXCLUDED.flag_source_mode,
         bundle_mode = EXCLUDED.bundle_mode,
         bot_alive = EXCLUDED.bot_alive,
         bot_lock_acquired = EXCLUDED.bot_lock_acquired,
         acceptance_json = EXCLUDED.acceptance_json,
         created_at = now(),
         created_by = EXCLUDED.created_by
       RETURNING *;`,
      [
        releaseRef,
        String(payload.git_revision || payload.gitRevision || ""),
        phaseName,
        String(payload.phase_status || payload.phaseStatus || "partial"),
        String(payload.flag_source_mode || payload.flagSourceMode || "env_locked"),
        String(payload.bundle_mode || payload.bundleMode || ""),
        Boolean(payload.bot_alive ?? payload.botAlive),
        Boolean(payload.bot_lock_acquired ?? payload.botLockAcquired),
        JSON.stringify(payload.acceptance_json || payload.acceptance || {}),
        Number(payload.created_by || payload.createdBy || 0)
      ]
    );
    return result.rows?.[0] || null;
  } catch (err) {
    if (err.code === "42P01") {
      return null;
    }
    throw err;
  }
}

const PLAY_MODES = {
  safe: {
    key: "safe",
    label: "Temkinli",
    difficultyDelta: -0.08,
    rewardMultiplier: 0.88
  },
  balanced: {
    key: "balanced",
    label: "Dengeli",
    difficultyDelta: 0,
    rewardMultiplier: 1
  },
  aggressive: {
    key: "aggressive",
    label: "Saldirgan",
    difficultyDelta: 0.1,
    rewardMultiplier: 1.22
  }
};

function getPlayMode(modeRaw) {
  const key = String(modeRaw || "balanced").toLowerCase();
  return PLAY_MODES[key] || PLAY_MODES.balanced;
}

function applyPlayModeToReward(reward, mode) {
  const safeMode = mode || PLAY_MODES.balanced;
  return {
    sc: Math.max(0, Math.round(Number(reward.sc || 0) * safeMode.rewardMultiplier)),
    hc: Number(reward.hc || 0),
    rc: Math.max(0, Math.round(Number(reward.rc || 0) * (1 + (safeMode.rewardMultiplier - 1) * 0.5)))
  };
}

function computeCombo(results) {
  let combo = 0;
  for (const result of results || []) {
    if (result === "success") {
      combo += 1;
      continue;
    }
    break;
  }
  return combo;
}

function applyComboToReward(reward, combo) {
  if (combo <= 1) {
    return { reward, multiplier: 1 };
  }
  const multiplier = 1 + Math.min(0.25, combo * 0.05);
  return {
    reward: {
      sc: Math.max(1, Math.round(Number(reward.sc || 0) * multiplier)),
      hc: Number(reward.hc || 0),
      rc: Math.max(0, Math.round(Number(reward.rc || 0) * multiplier))
    },
    multiplier
  };
}

function hiddenBonusForAttempt(attemptId, modeKey, result) {
  const seed = crypto.createHash("sha1").update(`hidden:${attemptId}:${modeKey}:${result}`).digest("hex");
  const roll = parseInt(seed.slice(0, 8), 16) / 0xffffffff;
  const threshold = modeKey === "aggressive" ? 0.12 : modeKey === "safe" ? 0.04 : 0.08;
  if (roll >= threshold) {
    return { hit: false, bonus: { sc: 0, hc: 0, rc: 0 }, roll, threshold };
  }
  if (result === "success") {
    return { hit: true, bonus: { sc: 2, hc: 0, rc: 2 }, roll, threshold };
  }
  if (result === "near_miss") {
    return { hit: true, bonus: { sc: 1, hc: 0, rc: 1 }, roll, threshold };
  }
  return { hit: true, bonus: { sc: 1, hc: 0, rc: 0 }, roll, threshold };
}

function mergeRewards(base, extra) {
  return {
    sc: Number(base.sc || 0) + Number(extra.sc || 0),
    hc: Number(base.hc || 0) + Number(extra.hc || 0),
    rc: Number(base.rc || 0) + Number(extra.rc || 0)
  };
}

function calculatePityBefore(recentTiers) {
  let pityBefore = 0;
  for (const tier of recentTiers || []) {
    if (tier === "rare" || tier === "legendary") {
      break;
    }
    pityBefore += 1;
  }
  return pityBefore;
}

function parseRewardFromMeta(meta, tier) {
  if (meta && typeof meta === "object" && meta.reward && typeof meta.reward === "object") {
    return {
      sc: Number(meta.reward.sc || 0),
      hc: Number(meta.reward.hc || 0),
      rc: Number(meta.reward.rc || 0)
    };
  }
  if (tier === "legendary") return { sc: 10, hc: 3, rc: 10 };
  if (tier === "rare") return { sc: 5, hc: 1, rc: 4 };
  if (tier === "uncommon") return { sc: 2, hc: 0, rc: 2 };
  return { sc: 1, hc: 0, rc: 1 };
}

function buildDailyView(runtimeConfig, profile, dailyRaw) {
  return {
    tasks_done: Number(dailyRaw.tasks_done || 0),
    sc_earned: Number(dailyRaw.sc_earned || 0),
    hc_earned: Number(dailyRaw.hc_earned || 0),
    rc_earned: Number(dailyRaw.rc_earned || 0),
    daily_cap: economyEngine.getDailyCap(runtimeConfig, profile.kingdom_tier)
  };
}

async function readOffersAttemptsEvents(db, userId) {
  const offersRes = await db.query(
    `SELECT id, task_type, difficulty, expires_at
     FROM task_offers
     WHERE user_id = $1
       AND offer_state = 'offered'
       AND expires_at > now()
     ORDER BY created_at ASC
     LIMIT 6;`,
    [userId]
  );
  const activeAttemptRes = await db.query(
    `SELECT
        a.id,
        a.task_offer_id,
        a.result,
        a.started_at,
        a.completed_at,
        o.task_type,
        o.difficulty
     FROM task_attempts a
     JOIN task_offers o ON o.id = a.task_offer_id
     WHERE a.user_id = $1
       AND a.result = 'pending'
     ORDER BY a.started_at DESC, a.id DESC
     LIMIT 1;`,
    [userId]
  );
  const revealableAttemptRes = await db.query(
    `SELECT
        a.id,
        a.task_offer_id,
        a.result,
        a.started_at,
        a.completed_at,
        o.task_type,
        o.difficulty
     FROM task_attempts a
     JOIN task_offers o ON o.id = a.task_offer_id
     LEFT JOIN loot_reveals l ON l.task_attempt_id = a.id
     WHERE a.user_id = $1
       AND a.result <> 'pending'
       AND l.id IS NULL
     ORDER BY a.completed_at DESC NULLS LAST, a.id DESC
     LIMIT 1;`,
    [userId]
  );
  const behaviorRes = await db.query(
    `SELECT event_type, event_at, meta_json
     FROM behavior_events
     WHERE user_id = $1
     ORDER BY event_at DESC
     LIMIT 15;`,
    [userId]
  );
  return {
    offers: mapOffers(offersRes.rows),
    attempts: {
      active: mapAttempt(activeAttemptRes.rows[0] || null),
      revealable: mapAttempt(revealableAttemptRes.rows[0] || null)
    },
    events: behaviorRes.rows.map((event) => ({
      event_type: event.event_type,
      event_at: event.event_at,
      meta: event.meta_json || {}
    }))
  };
}

async function listTokenRequestsSafe(db, userId, limit = 5) {
  try {
    return await tokenStore.listUserPurchaseRequests(db, userId, limit);
  } catch (err) {
    if (err.code === "42P01") {
      return [];
    }
    throw err;
  }
}

function mapTokenRequestPreview(rows) {
  return (rows || []).map((row) => ({
    id: Number(row.id),
    chain: row.chain,
    pay_currency: row.pay_currency,
    usd_amount: Number(row.usd_amount || 0),
    token_amount: Number(row.token_amount || 0),
    status: row.status,
    tx_hash: row.tx_hash || "",
    created_at: row.created_at
  }));
}

function computeTokenMarketCapGate(tokenConfig, tokenSupplyTotal, spotUsdOverride = null) {
  const gate = tokenConfig?.payout_gate || {};
  const enabled = Boolean(gate.enabled);
  const minMarketCapUsd = Math.max(0, Number(gate.min_market_cap_usd || 0));
  const spotUsd =
    Number.isFinite(Number(spotUsdOverride)) && Number(spotUsdOverride) > 0
      ? Number(spotUsdOverride)
      : Math.max(0, Number(tokenConfig?.usd_price || 0));
  const marketCapUsd = Number(tokenSupplyTotal || 0) * spotUsd;
  return {
    enabled,
    allowed: !enabled || marketCapUsd >= minMarketCapUsd,
    current: Number(marketCapUsd || 0),
    min: Number(minMarketCapUsd || 0),
    targetMax: Math.max(0, Number(gate.target_band_max_usd || 0)),
    spot_usd: Number(spotUsd || 0)
  };
}

async function computePayoutReleaseScoreInput(db, userId) {
  const [volumeRes, missionRes, tenureRes] = await Promise.all([
    db
      .query(
        `SELECT COALESCE(SUM(usd_amount), 0)::numeric AS usd_volume_30d
         FROM token_purchase_requests
         WHERE user_id = $1
           AND created_at >= now() - interval '30 days'
           AND status IN ('pending_payment', 'tx_submitted', 'approved');`,
        [userId]
      )
      .catch((err) => {
        if (err.code === "42P01") {
          return { rows: [{ usd_volume_30d: 0 }] };
        }
        throw err;
      }),
    db
      .query(
        `SELECT COUNT(*)::bigint AS mission_claims_30d
         FROM mission_claims
         WHERE user_id = $1
           AND claimed_at >= now() - interval '30 days';`,
        [userId]
      )
      .catch((err) => {
        if (err.code === "42703") {
          return db
            .query(
              `SELECT COUNT(*)::bigint AS mission_claims_30d
               FROM mission_claims
               WHERE user_id = $1
                 AND created_at >= now() - interval '30 days';`,
              [userId]
            )
            .catch((legacyErr) => {
              if (legacyErr.code === "42P01") {
                return { rows: [{ mission_claims_30d: 0 }] };
              }
              throw legacyErr;
            });
        }
        if (err.code === "42P01") {
          return { rows: [{ mission_claims_30d: 0 }] };
        }
        throw err;
      }),
    db
      .query(
        `SELECT GREATEST(0, EXTRACT(EPOCH FROM (now() - created_at)) / 86400)::numeric AS tenure_days
         FROM users
         WHERE id = $1
         LIMIT 1;`,
        [userId]
      )
      .catch((err) => {
        if (err.code === "42P01") {
          return { rows: [{ tenure_days: 0 }] };
        }
        throw err;
      })
  ]);
  const volumeUsd = Number(volumeRes.rows?.[0]?.usd_volume_30d || 0);
  const missionClaims = Number(missionRes.rows?.[0]?.mission_claims_30d || 0);
  const tenureDays = Number(tenureRes.rows?.[0]?.tenure_days || 0);
  return {
    volume30d_norm: clamp(volumeUsd / 1000, 0, 1),
    mission30d_norm: clamp(missionClaims / 40, 0, 1),
    tenure30d_norm: clamp(tenureDays / 60, 0, 1),
    metrics: {
      volume_usd_30d: volumeUsd,
      mission_claims_30d: missionClaims,
      tenure_days: tenureDays
    }
  };
}

async function buildPayoutLockState(db, profile, runtimeConfig, balances = {}, tokenSummary = null) {
  const tokenConfig = tokenEngine.normalizeTokenConfig(runtimeConfig);
  const symbol = tokenConfig.symbol;
  const supplyTotal =
    Number(tokenSummary?.supply || 0) > 0
      ? Number(tokenSummary.supply || 0)
      : Number((await economyStore.getCurrencySupply(db, symbol)).total || 0);
  const spotUsd = Number(tokenSummary?.spot_usd || tokenConfig.usd_price || 0);
  const marketCapGate = computeTokenMarketCapGate(tokenConfig, supplyTotal, spotUsd);
  const hc = Number(balances.HC || 0);
  const entitledBtc = Number(hc * HC_TO_BTC_RATE);
  const latest = await payoutStore.getLatestRequest(db, profile.user_id, "BTC");
  const active = await payoutStore.getActiveRequest(db, profile.user_id, "BTC");
  const cooldown = await payoutStore.getCooldownRequest(db, profile.user_id, "BTC");
  const todayUsedBtc = await payoutStore.getTodayRequestedAmount(db, profile.user_id, "BTC").catch((err) => {
    if (err.code === "42P01") {
      return 0;
    }
    throw err;
  });
  const scoreInput = await computePayoutReleaseScoreInput(db, profile.user_id);
  const release = tokenEngine.computePayoutReleaseState({
    releaseConfig: tokenConfig.payout_release || {},
    entitledBtc,
    todayUsedBtc,
    marketCapUsd: Number(marketCapGate.current || 0),
    score: scoreInput
  });
  const requestableBtc = release.enabled
    ? Math.min(entitledBtc, Number(release.todayDripRemainingBtc || 0))
    : entitledBtc;
  const thresholdBtc = release.enabled ? 0 : PAYOUT_BTC_THRESHOLD;
  const canRequest =
    requestableBtc >= thresholdBtc &&
    marketCapGate.allowed &&
    (!release.enabled || release.allowed) &&
    !active &&
    !cooldown;

  await payoutStore
    .upsertUserUnlockScore(db, {
      userId: profile.user_id,
      volume30dNorm: scoreInput.volume30d_norm,
      mission30dNorm: scoreInput.mission30d_norm,
      tenure30dNorm: scoreInput.tenure30d_norm,
      unlockScore: release.unlockScore,
      unlockTier: release.unlockTier,
      factorsJson: {
        ...scoreInput.metrics,
        score_weights: release.weights || {}
      }
    })
    .catch((err) => {
      if (err.code !== "42P01") {
        throw err;
      }
    });
  await payoutStore
    .upsertDailyReleaseUsage(db, {
      userId: profile.user_id,
      currency: "BTC",
      entitledBtc,
      dripCapBtc: release.todayDripCapBtc,
      dripUsedBtc: todayUsedBtc,
      dripRemainingBtc: release.todayDripRemainingBtc,
      unlockTier: release.unlockTier,
      unlockScore: release.unlockScore,
      globalGateOpen: release.globalGateOpen,
      detailsJson: {
        next_tier_target: release.nextTierTarget,
        factors: release.factors || {},
        weights: release.weights || {},
        market_cap_usd: Number(marketCapGate.current || 0)
      }
    })
    .catch((err) => {
      if (err.code !== "42P01") {
        throw err;
      }
    });

  return {
    can_request: canRequest,
    entitled_btc: Number(entitledBtc.toFixed(8)),
    requestable_btc: Number(requestableBtc.toFixed(8)),
    threshold_btc: Number(thresholdBtc.toFixed(8)),
    cooldown_until: cooldown?.cooldown_until || null,
    latest_request_id: Number(latest?.id || 0),
    payout_gate: marketCapGate,
    release: {
      enabled: release.enabled,
      mode: release.mode,
      global_gate_open: release.globalGateOpen,
      global_cap_min_usd: release.globalCapMinUsd,
      global_cap_current_usd: release.globalCapCurrentUsd,
      unlock_score: release.unlockScore,
      unlock_tier: release.unlockTier,
      unlock_progress: release.unlockProgress,
      next_tier_target: release.nextTierTarget,
      today_drip_cap_btc: release.todayDripCapBtc,
      today_drip_used_btc: release.todayDripUsedBtc,
      today_drip_btc_remaining: release.todayDripRemainingBtc
    },
    score_input: {
      volume30d_norm: scoreInput.volume30d_norm,
      mission30d_norm: scoreInput.mission30d_norm,
      tenure30d_norm: scoreInput.tenure30d_norm
    }
  };
}

function isOnchainVerifiedStatus(status) {
  return ["confirmed", "found_unconfirmed", "unsupported", "skipped"].includes(String(status || ""));
}

async function validateAndVerifyTokenTx(chain, txHashRaw) {
  const formatCheck = txVerifier.validateTxHash(chain, txHashRaw);
  if (!formatCheck.ok) {
    return {
      ok: false,
      reason: formatCheck.reason,
      formatCheck,
      verify: { status: "skipped", reason: "format_invalid" }
    };
  }

  const verify = await txVerifier.verifyOnchain(chain, formatCheck.normalizedHash, {
    enabled: TOKEN_TX_VERIFY
  });
  if (TOKEN_TX_VERIFY_STRICT && !isOnchainVerifiedStatus(verify.status)) {
    return {
      ok: false,
      reason: "tx_not_found_onchain",
      formatCheck,
      verify
    };
  }

  return { ok: true, formatCheck, verify };
}

async function buildAdminSummary(db, runtimeConfig) {
  const featureFlags = await loadFeatureFlags(db);
  const freeze = await getFreezeState(db);
  const usersRes = await db.query(`SELECT COUNT(*)::bigint AS c FROM users;`);
  const activeAttemptsRes = await db.query(
    `SELECT COUNT(*)::bigint AS c
     FROM task_attempts
     WHERE result = 'pending';`
  );
  const pendingPayouts = await payoutStore.listRequests(db, { status: "requested", limit: 20 });
  const tokenConfig = tokenEngine.normalizeTokenConfig(runtimeConfig);
  const addressBook = getPaymentAddressBook();
  const routingChains = Object.keys(tokenConfig.purchase?.chains || {}).map((chainKey) => {
    const chainConfig = tokenEngine.getChainConfig(tokenConfig, chainKey);
    const address = tokenEngine.resolvePaymentAddress({ addresses: addressBook }, chainConfig);
    return {
      chain: chainKey,
      pay_currency: chainConfig?.payCurrency || chainKey,
      address: maskAddress(address),
      enabled: Boolean(address)
    };
  });
  const enabledRouteCount = routingChains.filter((row) => row.enabled).length;
  let tokenRows = [];
  try {
    tokenRows = await tokenStore.listPurchaseRequests(db, { limit: 50 });
  } catch (err) {
    if (err.code !== "42P01") {
      throw err;
    }
  }
  const pendingTokenRequests = tokenRows.filter((row) =>
    ["pending_payment", "tx_submitted"].includes(String(row.status || "").toLowerCase())
  );
  let manualTokenQueue = [];
  let autoDecisions = [];
  try {
    manualTokenQueue = await tokenStore.listManualReviewQueue(db, 20);
    autoDecisions = await tokenStore.listTokenAutoDecisions(db, { limit: 20 });
  } catch (err) {
    if (err.code !== "42P01") {
      throw err;
    }
  }
  const tokenSupply = await economyStore.getCurrencySupply(db, tokenConfig.symbol);
  let marketState = null;
  try {
    marketState = await tokenStore.getTokenMarketState(db, tokenConfig.symbol);
  } catch (err) {
    if (err.code !== "42P01") {
      throw err;
    }
  }
  const curveEnabled = Boolean(
    isFeatureEnabled(featureFlags, "TOKEN_CURVE_ENABLED") && tokenConfig.curve?.enabled
  );
  const curveState = tokenEngine.normalizeCurveState(tokenConfig, marketState);
  const autoPolicyEnabled = Boolean(
    isFeatureEnabled(featureFlags, "TOKEN_AUTO_APPROVE_ENABLED") && curveState.autoPolicy.enabled
  );
  const curveQuote = tokenEngine.computeTreasuryCurvePrice({
    tokenConfig,
    marketState,
    totalSupply: Number(tokenSupply.total || 0)
  });
  const spotUsd = curveEnabled ? Number(curveQuote.priceUsd || 0) : Number(tokenConfig.usd_price || 0);
  const gate = computeTokenMarketCapGate(tokenConfig, tokenSupply.total, spotUsd);
  const metrics = await buildAdminMetrics(db);

  return {
    feature_flags: featureFlags,
    freeze,
    total_users: Number(usersRes.rows[0]?.c || 0),
    active_attempts: Number(activeAttemptsRes.rows[0]?.c || 0),
    pending_payout_count: pendingPayouts.length,
    pending_token_count: pendingTokenRequests.length,
    pending_payouts: pendingPayouts.slice(0, 10),
    pending_token_requests: pendingTokenRequests.slice(0, 10),
    manual_token_queue: manualTokenQueue,
    token_auto_decisions: autoDecisions,
    metrics,
    token: {
      symbol: tokenConfig.symbol,
      spot_usd: Number(spotUsd || 0),
      supply: Number(tokenSupply.total || 0),
      holders: Number(tokenSupply.holders || 0),
      market_cap_usd: Number((Number(tokenSupply.total || 0) * Number(spotUsd || 0)).toFixed(8)),
      payout_gate: gate,
      payout_release: tokenConfig.payout_release || {},
      curve_enabled: curveEnabled,
      curve: {
        enabled: curveEnabled,
        admin_floor_usd: Number(curveState.adminFloorUsd || 0),
        base_usd: Number(curveState.curveBaseUsd || 0),
        k: Number(curveState.curveK || 0),
        supply_norm_divisor: Number(curveState.supplyNormDivisor || 1),
        demand_factor: Number(curveState.demandFactor || 1),
        volatility_dampen: Number(curveState.volatilityDampen || 0),
        quote: {
          price_usd: Number(curveQuote.priceUsd || 0),
          supply_norm: Number(curveQuote.supplyNorm || 0),
          demand_factor: Number(curveQuote.demandFactor || 1)
        }
      },
      auto_policy: {
        enabled: autoPolicyEnabled,
        auto_usd_limit: Number(curveState.autoPolicy.autoUsdLimit || 10),
        risk_threshold: Number(curveState.autoPolicy.riskThreshold || 0.35),
        velocity_per_hour: Number(curveState.autoPolicy.velocityPerHour || 8),
        require_onchain_verified: Boolean(curveState.autoPolicy.requireOnchainVerified)
      },
      routing: {
        total_routes: routingChains.length,
        enabled_routes: enabledRouteCount,
        missing_routes: Math.max(0, routingChains.length - enabledRouteCount),
        cold_wallets_configured: enabledRouteCount > 0,
        chains: routingChains
      }
    }
  };
}

async function buildAdminMetrics(db) {
  const metrics = {
    window_hours: 24,
    users_total: 0,
    users_active_24h: 0,
    attempts_started_24h: 0,
    attempts_completed_24h: 0,
    reveals_24h: 0,
    payouts_requested_24h: 0,
    payouts_paid_24h: 0,
    payouts_paid_btc_24h: 0,
    token_intents_24h: 0,
    token_submitted_24h: 0,
    token_approved_24h: 0,
    token_usd_volume_24h: 0,
    risk_high_count: 0,
    risk_medium_count: 0,
    risk_low_count: 0,
    sc_today: 0,
    hc_today: 0,
    rc_today: 0
  };

  const coreRes = await db.query(
    `SELECT
        (SELECT COUNT(*)::bigint FROM users) AS users_total,
        (SELECT COUNT(*)::bigint FROM users WHERE last_seen_at >= now() - interval '24 hours') AS users_active_24h,
        (SELECT COUNT(*)::bigint FROM task_attempts WHERE started_at >= now() - interval '24 hours') AS attempts_started_24h,
        (SELECT COUNT(*)::bigint FROM task_attempts WHERE completed_at >= now() - interval '24 hours') AS attempts_completed_24h,
        (SELECT COUNT(*)::bigint FROM loot_reveals WHERE created_at >= now() - interval '24 hours') AS reveals_24h,
        (SELECT COUNT(*)::bigint FROM payout_requests WHERE created_at >= now() - interval '24 hours') AS payouts_requested_24h,
        (SELECT COUNT(*)::bigint FROM payout_requests WHERE status = 'paid' AND created_at >= now() - interval '24 hours') AS payouts_paid_24h,
        (SELECT COALESCE(SUM(amount), 0)::numeric FROM payout_requests WHERE status = 'paid' AND created_at >= now() - interval '24 hours') AS payouts_paid_btc_24h,
        (SELECT COUNT(*)::bigint FROM risk_scores WHERE risk_score >= 0.80) AS risk_high_count,
        (SELECT COUNT(*)::bigint FROM risk_scores WHERE risk_score >= 0.50 AND risk_score < 0.80) AS risk_medium_count,
        (SELECT COUNT(*)::bigint FROM risk_scores WHERE risk_score < 0.50) AS risk_low_count,
        (SELECT COALESCE(SUM(sc_earned), 0)::numeric FROM daily_counters WHERE day_date = CURRENT_DATE) AS sc_today,
        (SELECT COALESCE(SUM(hc_earned), 0)::numeric FROM daily_counters WHERE day_date = CURRENT_DATE) AS hc_today,
        (SELECT COALESCE(SUM(rc_earned), 0)::numeric FROM daily_counters WHERE day_date = CURRENT_DATE) AS rc_today;`
  );
  const row = coreRes.rows[0] || {};
  for (const [key, value] of Object.entries(row)) {
    metrics[key] = Number(value || 0);
  }

  try {
    const tokenRes = await db.query(
      `SELECT
          (SELECT COUNT(*)::bigint FROM token_purchase_requests WHERE created_at >= now() - interval '24 hours') AS token_intents_24h,
          (SELECT COUNT(*)::bigint FROM token_purchase_requests WHERE status = 'tx_submitted' AND created_at >= now() - interval '24 hours') AS token_submitted_24h,
          (SELECT COUNT(*)::bigint FROM token_purchase_requests WHERE status = 'approved' AND created_at >= now() - interval '24 hours') AS token_approved_24h,
          (SELECT COALESCE(SUM(usd_amount), 0)::numeric FROM token_purchase_requests WHERE created_at >= now() - interval '24 hours') AS token_usd_volume_24h;`
    );
    const tokenRow = tokenRes.rows[0] || {};
    for (const [key, value] of Object.entries(tokenRow)) {
      metrics[key] = Number(value || 0);
    }
  } catch (err) {
    if (err.code !== "42P01") {
      throw err;
    }
  }

  return metrics;
}

async function writeConfigVersion(db, configKey, configJson, adminId) {
  const versionRes = await db.query(
    `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
     FROM config_versions
     WHERE config_key = $1;`,
    [configKey]
  );
  const nextVersion = Number(versionRes.rows?.[0]?.next_version || 1);
  await db.query(
    `INSERT INTO config_versions (config_key, version, config_json, created_by)
     VALUES ($1, $2, $3::jsonb, $4);`,
    [configKey, nextVersion, JSON.stringify(configJson), Number(adminId || 0)]
  );
  return nextVersion;
}

async function patchTokenRuntimeConfig(db, adminId, patchInput) {
  const current = await configService.getEconomyConfig(db, { forceRefresh: true });
  const next = JSON.parse(JSON.stringify(current || {}));
  if (!next.token || typeof next.token !== "object") {
    next.token = {};
  }
  if (!next.token.payout_gate || typeof next.token.payout_gate !== "object") {
    next.token.payout_gate = {};
  }

  if (patchInput && Object.prototype.hasOwnProperty.call(patchInput, "usd_price")) {
    next.token.usd_price = Number(patchInput.usd_price);
  }
  if (patchInput && Object.prototype.hasOwnProperty.call(patchInput, "min_market_cap_usd")) {
    next.token.payout_gate.enabled = true;
    next.token.payout_gate.min_market_cap_usd = Number(patchInput.min_market_cap_usd);
  }
  if (patchInput && Object.prototype.hasOwnProperty.call(patchInput, "target_band_max_usd")) {
    next.token.payout_gate.enabled = true;
    next.token.payout_gate.target_band_max_usd = Number(patchInput.target_band_max_usd);
  }

  const version = await writeConfigVersion(db, configService.ECONOMY_CONFIG_KEY, next, adminId);
  await db.query(
    `INSERT INTO admin_audit (admin_id, action, target, payload_json)
     VALUES ($1, 'webapp_token_config_update', 'config:economy_params', $2::jsonb);`,
    [Number(adminId || 0), JSON.stringify({ version, patch: patchInput || {} })]
  );
  const reloaded = await configService.getEconomyConfig(db, { forceRefresh: true });
  return { version, config: reloaded };
}

async function patchPayoutReleaseRuntimeConfig(db, adminId, patchInput) {
  const current = await configService.getEconomyConfig(db, { forceRefresh: true });
  const next = JSON.parse(JSON.stringify(current || {}));
  if (!next.token || typeof next.token !== "object") {
    next.token = {};
  }
  if (!next.token.payout_gate || typeof next.token.payout_gate !== "object") {
    next.token.payout_gate = {};
  }
  if (!next.token.payout_release || typeof next.token.payout_release !== "object") {
    next.token.payout_release = {};
  }
  next.token.payout_release.enabled =
    typeof patchInput?.enabled === "boolean" ? Boolean(patchInput.enabled) : Boolean(next.token.payout_release.enabled !== false);
  next.token.payout_release.mode = String(patchInput?.mode || next.token.payout_release.mode || "tiered_drip");

  if (patchInput && Object.prototype.hasOwnProperty.call(patchInput, "global_cap_min_usd")) {
    const minCap = Math.max(0, Number(patchInput.global_cap_min_usd || 0));
    next.token.payout_gate.enabled = true;
    next.token.payout_gate.min_market_cap_usd = minCap;
    next.token.payout_release.global_cap_min_usd = minCap;
  }
  if (patchInput && Object.prototype.hasOwnProperty.call(patchInput, "daily_drip_pct_max")) {
    const raw = Number(patchInput.daily_drip_pct_max || 0);
    const pct = raw > 1 ? raw / 100 : raw;
    next.token.payout_release.daily_drip_pct_max = clamp(Number(pct || 0), 0, 1);
  }
  if (patchInput && Array.isArray(patchInput.tier_rules)) {
    next.token.payout_release.tier_rules = patchInput.tier_rules
      .map((row) => ({
        tier: String(row?.tier || "T0").toUpperCase(),
        min_score: clamp(Number(row?.min_score || 0), 0, 1),
        drip_pct: clamp(Number(row?.drip_pct || 0), 0, 1)
      }))
      .sort((a, b) => Number(a.min_score || 0) - Number(b.min_score || 0));
  }
  if (patchInput && patchInput.score_weights && typeof patchInput.score_weights === "object") {
    const sw = patchInput.score_weights || {};
    next.token.payout_release.score_weights = {
      volume30d: Math.max(0, Number(sw.volume30d || 0)),
      mission30d: Math.max(0, Number(sw.mission30d || 0)),
      tenure30d: Math.max(0, Number(sw.tenure30d || 0))
    };
  }

  const version = await writeConfigVersion(db, configService.ECONOMY_CONFIG_KEY, next, adminId);
  await db.query(
    `INSERT INTO admin_audit (admin_id, action, target, payload_json)
     VALUES ($1, 'webapp_payout_release_config_update', 'config:economy_params', $2::jsonb);`,
    [Number(adminId || 0), JSON.stringify({ version, patch: patchInput || {} })]
  );
  const reloaded = await configService.getEconomyConfig(db, { forceRefresh: true });
  return { version, config: reloaded };
}

function toTimeSafe(value) {
  if (!value) {
    return 0;
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function queueAgeSec(queueTs) {
  const ts = toTimeSafe(queueTs);
  if (!ts) {
    return 0;
  }
  return Math.max(0, Math.floor((Date.now() - ts) / 1000));
}

function buildPayoutQueuePolicy(row = {}) {
  const status = String(row.status || "requested").toLowerCase();
  const amountBtc = Number(row.amount || 0);
  const ageSec = queueAgeSec(row.created_at || row.updated_at || row.cooldown_until || null);
  let reasonCode = "requested_pending_release_policy";
  let reasonText = "Payout request release policy kontrolu bekliyor.";
  if (status === "paid") {
    reasonCode = "already_paid";
    reasonText = "Payout request zaten paid durumda.";
  } else if (status === "rejected") {
    reasonCode = "already_rejected";
    reasonText = "Payout request zaten rejected durumda.";
  } else if (amountBtc <= 0) {
    reasonCode = "invalid_amount";
    reasonText = "Payout amount BTC sifir veya gecersiz.";
  } else if (!["requested", "pending", "approved"].includes(status)) {
    reasonCode = `unsupported_status_${status || "unknown"}`.slice(0, 64);
    reasonText = `Payout status '${status || "unknown"}' manuel kontrol gerektiriyor.`;
  } else if (ageSec >= 72 * 3600) {
    reasonCode = "stale_request";
    reasonText = "Request uzun suredir kuyrukta, once reject/pay karari verilmeli.";
  }

  const payPolicy = evaluateAdminPolicy({
    action_key: "payout_pay",
    critical: true,
    cooldown_ms: ADMIN_CRITICAL_COOLDOWN_MS
  });
  const rejectPolicy = evaluateAdminPolicy({
    action_key: "payout_reject",
    critical: true,
    cooldown_ms: ADMIN_CRITICAL_COOLDOWN_MS
  });

  const canPay = ["requested", "pending", "approved"].includes(status) && amountBtc > 0;
  const canReject = ["requested", "pending", "approved"].includes(status);

  return {
    reason_code: reasonCode,
    reason_text: reasonText,
    queue_age_sec: ageSec,
    priority: clamp((ageSec / 86400) * 0.55 + (amountBtc > 0 ? 0.2 : 0) + (status === "requested" ? 0.25 : 0.1), 0, 1),
    action_policy: {
      pay: {
        allowed: canPay,
        confirmation_required: Boolean(payPolicy.confirmation_required),
        cooldown_ms: Number(payPolicy.cooldown_ms || ADMIN_CRITICAL_COOLDOWN_MS)
      },
      reject: {
        allowed: canReject,
        confirmation_required: Boolean(rejectPolicy.confirmation_required),
        cooldown_ms: Number(rejectPolicy.cooldown_ms || ADMIN_CRITICAL_COOLDOWN_MS)
      }
    }
  };
}

function buildTokenManualQueuePolicy(row = {}) {
  const status = String(row.status || "pending_review").toLowerCase();
  const ageSec = queueAgeSec(row.created_at || row.updated_at || null);
  let reasonCode = "manual_review_required";
  let reasonText = "Token talebi manuel admin incelemesine bekliyor.";
  if (status === "approved") {
    reasonCode = "already_approved";
    reasonText = "Token talebi zaten approved.";
  } else if (status === "rejected") {
    reasonCode = "already_rejected";
    reasonText = "Token talebi zaten rejected.";
  } else if (!["pending_review", "pending_payment", "tx_submitted"].includes(status)) {
    reasonCode = `status_${status || "unknown"}`.slice(0, 64);
    reasonText = `Token request status '${status || "unknown"}' manuel kontrolde.`;
  } else if (ageSec >= 48 * 3600) {
    reasonCode = "stale_manual_review";
    reasonText = "Manual review uzun suredir bekliyor, queue temizlenmeli.";
  }
  return {
    reason_code: reasonCode,
    reason_text: reasonText,
    queue_age_sec: ageSec,
    priority: clamp((ageSec / 86400) * 0.45 + (status === "tx_submitted" ? 0.3 : 0.18), 0, 1),
    action_policy: {
      approve: {
        allowed: ["pending_review", "pending_payment", "tx_submitted"].includes(status),
        confirmation_required: false,
        cooldown_ms: 0
      },
      reject: {
        allowed: ["pending_review", "pending_payment", "tx_submitted"].includes(status),
        confirmation_required: false,
        cooldown_ms: 0
      }
    }
  };
}

function buildTokenAutoDecisionPolicy(row = {}) {
  const ageSec = queueAgeSec(row.decided_at || row.created_at || null);
  const reasonRaw = String(row.reason || "").trim();
  return {
    reason_code: reasonRaw ? reasonRaw.toLowerCase().replace(/[^a-z0-9_]+/g, "_").slice(0, 64) : "decision_logged",
    reason_text: reasonRaw || "Auto decision kaydi.",
    queue_age_sec: ageSec,
    priority: clamp((ageSec / 86400) * 0.2 + 0.15, 0, 1),
    action_policy: {
      reopen_manual_review: {
        allowed: true,
        confirmation_required: false,
        cooldown_ms: 0
      }
    }
  };
}

function buildKycManualQueuePolicy(row = {}) {
  const status = String(row.status || "pending").toLowerCase();
  const screeningResult = String(row.screening_result || "pending").toLowerCase();
  const ageSec = queueAgeSec(row.updated_at || row.last_reviewed_at || row.screening_created_at || null);
  let reasonCode = "kyc_manual_review_required";
  let reasonText = "KYC profili manuel admin incelemesi bekliyor.";
  if (["approved", "verified"].includes(status)) {
    reasonCode = "kyc_already_approved";
    reasonText = "KYC profili zaten approved.";
  } else if (["blocked", "sanctioned"].includes(status)) {
    reasonCode = "kyc_already_blocked";
    reasonText = "KYC profili blocked/sanctioned durumda.";
  } else if (status === "rejected") {
    reasonCode = "kyc_already_rejected";
    reasonText = "KYC profili rejected durumda.";
  } else if (screeningResult === "blocked") {
    reasonCode = "kyc_screening_blocked";
    reasonText = "Son screening sonucu blocked, manuel karar zorunlu.";
  } else if (ageSec >= 72 * 3600) {
    reasonCode = "kyc_stale_manual_review";
    reasonText = "KYC manuel inceleme uzun suredir kuyrukta bekliyor.";
  }

  const approvePolicy = evaluateAdminPolicy({
    action_key: "kyc_approve",
    critical: true,
    cooldown_ms: ADMIN_CRITICAL_COOLDOWN_MS
  });
  const rejectPolicy = evaluateAdminPolicy({
    action_key: "kyc_reject",
    critical: true,
    cooldown_ms: ADMIN_CRITICAL_COOLDOWN_MS
  });
  const blockPolicy = evaluateAdminPolicy({
    action_key: "kyc_block",
    critical: true,
    cooldown_ms: ADMIN_CRITICAL_COOLDOWN_MS
  });
  const actionable = ["pending", "manual_review", "review", "under_review", "unknown"].includes(status);

  return {
    reason_code: reasonCode,
    reason_text: reasonText,
    queue_age_sec: ageSec,
    priority: clamp((ageSec / 86400) * 0.38 + (screeningResult === "blocked" ? 0.52 : screeningResult === "manual_review" ? 0.34 : 0.2), 0, 1),
    action_policy: {
      approve: {
        allowed: actionable,
        confirmation_required: Boolean(approvePolicy.confirmation_required),
        cooldown_ms: Number(approvePolicy.cooldown_ms || ADMIN_CRITICAL_COOLDOWN_MS)
      },
      reject: {
        allowed: actionable,
        confirmation_required: Boolean(rejectPolicy.confirmation_required),
        cooldown_ms: Number(rejectPolicy.cooldown_ms || ADMIN_CRITICAL_COOLDOWN_MS)
      },
      block: {
        allowed: actionable || status === "approved",
        confirmation_required: Boolean(blockPolicy.confirmation_required),
        cooldown_ms: Number(blockPolicy.cooldown_ms || ADMIN_CRITICAL_COOLDOWN_MS)
      }
    }
  };
}

function buildUnifiedAdminQueueItems(snapshot = {}) {
  const payoutQueue = Array.isArray(snapshot.payout_queue) ? snapshot.payout_queue : [];
  const tokenManualQueue = Array.isArray(snapshot.token_manual_queue) ? snapshot.token_manual_queue : [];
  const tokenAutoDecisions = Array.isArray(snapshot.token_auto_decisions) ? snapshot.token_auto_decisions : [];
  const kycManualQueue = Array.isArray(snapshot.kyc_manual_queue) ? snapshot.kyc_manual_queue : [];

  const payoutItems = payoutQueue.map((row) => {
    const policy = buildPayoutQueuePolicy(row);
    return {
      kind: "payout_request",
      queue_key: `payout:${Number(row.id || 0)}`,
      queue_ts: row.created_at || row.updated_at || row.cooldown_until || null,
      user_id: Number(row.user_id || 0),
      request_id: Number(row.id || 0),
      status: String(row.status || "requested"),
      amount_btc: Number(row.amount || 0),
      source_hc_amount: Number(row.source_hc_amount || 0),
      queue_age_sec: Number(policy.queue_age_sec || 0),
      priority: Number(policy.priority || 0),
      policy_reason_code: String(policy.reason_code || "policy_unknown"),
      policy_reason_text: String(policy.reason_text || "Policy reason missing."),
      action_policy: policy.action_policy || {},
      payload: row
    };
  });

  const tokenManualItems = tokenManualQueue.map((row) => {
    const policy = buildTokenManualQueuePolicy(row);
    return {
      kind: "token_manual_review",
      queue_key: `token_manual:${Number(row.id || 0)}`,
      queue_ts: row.created_at || row.updated_at || null,
      user_id: Number(row.user_id || 0),
      request_id: Number(row.id || 0),
      status: String(row.status || "pending_review"),
      usd_amount: Number(row.usd_amount || 0),
      token_amount: Number(row.token_amount || 0),
      token_symbol: String(row.token_symbol || "NXT").toUpperCase(),
      chain: String(row.chain || "").toUpperCase(),
      queue_age_sec: Number(policy.queue_age_sec || 0),
      priority: Number(policy.priority || 0),
      policy_reason_code: String(policy.reason_code || "policy_unknown"),
      policy_reason_text: String(policy.reason_text || "Policy reason missing."),
      action_policy: policy.action_policy || {},
      payload: row
    };
  });

  const tokenAutoItems = tokenAutoDecisions.map((row) => {
    const policy = buildTokenAutoDecisionPolicy(row);
    return {
      kind: "token_auto_decision",
      queue_key: `token_auto:${Number(row.id || 0)}`,
      queue_ts: row.decided_at || row.created_at || null,
      user_id: Number(row.user_id || 0),
      request_id: Number(row.request_id || 0),
      status: String(row.decision || "auto"),
      usd_amount: Number(row.usd_amount || 0),
      risk_score: Number(row.risk_score || 0),
      reason: String(row.reason || ""),
      queue_age_sec: Number(policy.queue_age_sec || 0),
      priority: Number(policy.priority || 0),
      policy_reason_code: String(policy.reason_code || "policy_unknown"),
      policy_reason_text: String(policy.reason_text || "Policy reason missing."),
      action_policy: policy.action_policy || {},
      payload: row
    };
  });

  const kycManualItems = kycManualQueue.map((row) => {
    const policy = buildKycManualQueuePolicy(row);
    const payloadJson = row?.payload_json && typeof row.payload_json === "object" ? row.payload_json : {};
    const riskScoreRaw = Number(row.screening_risk_score ?? payloadJson.risk_score ?? 0);
    return {
      kind: "kyc_manual_review",
      queue_key: `kyc_manual:${Number(row.user_id || 0)}`,
      queue_ts: row.updated_at || row.last_reviewed_at || row.screening_created_at || null,
      user_id: Number(row.user_id || 0),
      request_id: Number(row.user_id || 0),
      status: String(row.status || "pending"),
      tier: String(row.tier || "none"),
      provider_ref: String(row.provider_ref || ""),
      chain: String(row.chain || "").toUpperCase(),
      address_masked: maskAddress(String(row.address_norm || "")),
      screening_result: String(row.screening_result || "pending"),
      screening_reason_code: String(row.screening_reason_code || payloadJson.reason_code || ""),
      risk_score: clamp(riskScoreRaw, 0, 1),
      queue_age_sec: Number(policy.queue_age_sec || 0),
      priority: Number(policy.priority || 0),
      policy_reason_code: String(policy.reason_code || "policy_unknown"),
      policy_reason_text: String(policy.reason_text || "Policy reason missing."),
      action_policy: policy.action_policy || {},
      payload: row
    };
  });

  return [...payoutItems, ...tokenManualItems, ...tokenAutoItems, ...kycManualItems]
    .sort((a, b) => {
      const priorityDelta = Number(b?.priority || 0) - Number(a?.priority || 0);
      if (Math.abs(priorityDelta) > 0.0001) {
        return priorityDelta;
      }
      return toTimeSafe(b.queue_ts) - toTimeSafe(a.queue_ts);
    })
    .slice(0, 200);
}

async function readAdminQueueSnapshot(db, limit = 50) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit || 50)));
  const payoutQueue = await payoutStore.listRequests(db, { status: "requested", limit: safeLimit }).catch((err) => {
    if (err.code === "42P01") return [];
    throw err;
  });
  const manualTokenQueue = await tokenStore.listManualReviewQueue(db, safeLimit).catch((err) => {
    if (err.code === "42P01") return [];
    throw err;
  });
  const autoDecisions = await tokenStore.listTokenAutoDecisions(db, { limit: safeLimit }).catch((err) => {
    if (err.code === "42P01") return [];
    throw err;
  });
  let kycManualQueue = [];
  const kycTablesReady = await hasKycTables(db).catch(() => false);
  if (kycTablesReady) {
    kycManualQueue = await listKycManualQueue(db, safeLimit).catch((err) => {
      if (err.code === "42P01") return [];
      throw err;
    });
  }
  const raidQueue = await db
    .query(
      `SELECT id, session_ref, user_id, status, mode_suggested, action_count, score, started_at, expires_at
       FROM raid_sessions
       WHERE status = 'active'
       ORDER BY started_at DESC
       LIMIT $1;`,
      [safeLimit]
    )
    .then((res) => res.rows)
    .catch((err) => {
      if (err.code === "42P01") return [];
      throw err;
    });
  const apiHealth = await webappStore.getLatestExternalApiHealth(db, "coingecko", safeLimit).catch((err) => {
    if (err.code === "42P01") return [];
    throw err;
  });
  const latestRelease = await readLatestReleaseMarker(db).catch((err) => {
    if (err.code === "42P01") return null;
    throw err;
  });
  return {
    payout_queue: payoutQueue,
    token_manual_queue: manualTokenQueue,
    token_auto_decisions: autoDecisions,
    kyc_manual_queue: kycManualQueue,
    raid_active_sessions: raidQueue,
    external_api_health: apiHealth,
    release_latest: latestRelease
  };
}

async function buildTokenSummary(db, profile, runtimeConfig, balances, options = {}) {
  const tokenConfig = tokenEngine.normalizeTokenConfig(runtimeConfig);
  const featureFlags = options.featureFlags || (await loadFeatureFlags(db));
  const symbol = tokenConfig.symbol;
  const balance = Number((balances || {})[symbol] || 0);
  const tokenSupply = await economyStore.getCurrencySupply(db, symbol);
  const unifiedUnits = tokenEngine.computeUnifiedUnits(balances || {}, tokenConfig);
  const mintableFromBalances = tokenEngine.estimateTokenFromBalances(balances || {}, tokenConfig);
  const requests = await listTokenRequestsSafe(db, profile.user_id, 5);
  const addressBook = getPaymentAddressBook();
  const chains = Object.keys(tokenConfig.purchase?.chains || {}).map((chainKey) => {
    const chainConfig = tokenEngine.getChainConfig(tokenConfig, chainKey);
    const address = tokenEngine.resolvePaymentAddress({ addresses: addressBook }, chainConfig);
    return {
      chain: chainKey,
      pay_currency: chainConfig?.payCurrency || chainKey,
      address: maskAddress(address),
      enabled: Boolean(address)
    };
  });

  let marketState = null;
  try {
    marketState = await tokenStore.getTokenMarketState(db, symbol);
  } catch (err) {
    if (err.code !== "42P01") {
      throw err;
    }
  }
  const curveEnabled = Boolean(
    isFeatureEnabled(featureFlags, "TOKEN_CURVE_ENABLED") && tokenConfig.curve?.enabled
  );
  const curveQuote = tokenEngine.computeTreasuryCurvePrice({
    tokenConfig,
    marketState,
    totalSupply: Number(tokenSupply.total || 0)
  });
  const spotUsd = curveEnabled ? Number(curveQuote.priceUsd || 0) : Number(tokenConfig.usd_price || 0);
  const gate = computeTokenMarketCapGate(tokenConfig, tokenSupply.total, spotUsd);

  return {
    enabled: tokenConfig.enabled,
    symbol,
    decimals: tokenConfig.decimals,
    usd_price: Number(spotUsd || 0),
    market_cap_usd: Number((Number(tokenSupply.total || 0) * Number(spotUsd || 0)).toFixed(8)),
    total_supply: Number(tokenSupply.total || 0),
    holders: Number(tokenSupply.holders || 0),
    payout_gate: gate,
    balance,
    unified_units: unifiedUnits,
    mintable_from_balances: mintableFromBalances,
    curve: {
      enabled: curveEnabled,
      market_state: marketState
        ? {
            admin_floor_usd: Number(marketState.admin_floor_usd || 0),
            curve_base_usd: Number(marketState.curve_base_usd || 0),
            curve_k: Number(marketState.curve_k || 0),
            demand_factor: Number(marketState.demand_factor || 1),
            supply_norm_divisor: Number(marketState.supply_norm_divisor || 1)
          }
        : null,
      quote: {
        price_usd: Number(curveQuote.priceUsd || 0),
        supply_norm: Number(curveQuote.supplyNorm || 0),
        demand_factor: Number(curveQuote.demandFactor || 1),
        admin_floor_usd: Number(curveQuote.adminFloorUsd || 0),
        curve_base_usd: Number(curveQuote.curveBaseUsd || 0),
        curve_k: Number(curveQuote.curveK || 0)
      }
    },
    purchase: {
      min_usd: Number(tokenConfig.purchase.min_usd || 0),
      max_usd: Number(tokenConfig.purchase.max_usd || 0),
      slippage_pct: Number(tokenConfig.purchase.slippage_pct || 0),
      chains
    },
    requests: mapTokenRequestPreview(requests)
  };
}

function resolveLiveContract(runtimeConfig, season, anomaly) {
  const contract = nexusContractEngine.resolveDailyContract(runtimeConfig, {
    seasonId: season?.seasonId || 0,
    anomalyId: anomaly?.id || "none"
  });
  return nexusContractEngine.publicContractView(contract);
}

async function buildActionSnapshot(db, profile, runtimeConfig) {
  const season = seasonStore.getSeasonInfo(runtimeConfig);
  const anomaly = nexusEventEngine.publicAnomalyView(
    nexusEventEngine.resolveDailyAnomaly(runtimeConfig, {
      seasonId: season.seasonId
    })
  );
  const contract = resolveLiveContract(runtimeConfig, season, anomaly);
  const balances = await economyStore.getBalances(db, profile.user_id);
  const dailyRaw = await economyStore.getTodayCounter(db, profile.user_id);
  const riskState = await riskStore.getRiskState(db, profile.user_id);
  const live = await readOffersAttemptsEvents(db, profile.user_id);
  const token = await buildTokenSummary(db, profile, runtimeConfig, balances);
  return {
    season: {
      season_id: season.seasonId,
      days_left: season.daysLeft
    },
    nexus: anomaly,
    contract,
    balances,
    daily: buildDailyView(runtimeConfig, profile, dailyRaw),
    risk_score: Number(riskState.riskScore || 0),
    token,
    ...live
  };
}

async function readBotRuntimeState(db, opts = {}) {
  const stateKey = String(opts.stateKey || botRuntimeStore.DEFAULT_STATE_KEY).trim() || botRuntimeStore.DEFAULT_STATE_KEY;
  const limit = Math.max(1, Math.min(200, Number(opts.limit || 25)));
  try {
    const hasTables = await botRuntimeStore.hasBotRuntimeTables(db);
    if (!hasTables) {
      return {
        available: false,
        state: null,
        events: [],
        state_key: stateKey
      };
    }
    const state = await botRuntimeStore.getRuntimeState(db, stateKey);
    const events = await botRuntimeStore.getRecentRuntimeEvents(db, stateKey, limit);
    return {
      available: true,
      state,
      events,
      state_key: stateKey
    };
  } catch (err) {
    if (err?.code === "42P01") {
      return {
        available: false,
        state: null,
        events: [],
        state_key: stateKey
      };
    }
    throw err;
  }
}

function projectBotRuntimeHealth(runtimeState) {
  const state = runtimeState?.state || null;
  if (!state) {
    return {
      available: Boolean(runtimeState?.available),
      alive: false,
      lock_acquired: false,
      mode: "disabled",
      last_heartbeat_at: null,
      heartbeat_lag_sec: null,
      stale: true,
      reason: runtimeState?.available ? "state_missing" : "tables_missing"
    };
  }
  const heartbeatAt = state.last_heartbeat_at ? new Date(state.last_heartbeat_at).getTime() : 0;
  const now = Date.now();
  const lagSec = heartbeatAt ? Math.max(0, Math.floor((now - heartbeatAt) / 1000)) : null;
  const stale = lagSec !== null ? lagSec > 45 : true;
  return {
    available: true,
    alive: Boolean(state.alive),
    lock_acquired: Boolean(state.lock_acquired),
    mode: String(state.mode || "disabled"),
    last_heartbeat_at: state.last_heartbeat_at || null,
    heartbeat_lag_sec: lagSec,
    stale,
    instance_ref: state.instance_ref || "",
    lock_key: Number(state.lock_key || 0),
    last_error: state.last_error || "",
    updated_at: state.updated_at || null
  };
}

async function reconcileBotRuntimeState(db, opts = {}) {
  const stateKey = String(opts.stateKey || botRuntimeStore.DEFAULT_STATE_KEY).trim() || botRuntimeStore.DEFAULT_STATE_KEY;
  const forceStop = Boolean(opts.forceStop);
  const updatedBy = Number(opts.updatedBy || 0);
  const note = String(opts.reason || "manual_reconcile").trim().slice(0, 300) || "manual_reconcile";

  const before = await readBotRuntimeState(db, { stateKey, limit: 30 });
  if (!before.available) {
    return {
      status: "tables_missing",
      state_key: stateKey,
      before,
      after: before,
      health_before: projectBotRuntimeHealth(before),
      health_after: projectBotRuntimeHealth(before)
    };
  }

  const now = new Date();
  const healthBefore = projectBotRuntimeHealth(before);
  const current = before.state || null;

  let status = "noop";
  if (!current) {
    status = "created_disabled_state";
    await botRuntimeStore.upsertRuntimeState(db, {
      stateKey,
      serviceName: "airdropkral-bot",
      mode: "disabled",
      alive: false,
      lockAcquired: false,
      lockKey: Number(process.env.BOT_INSTANCE_LOCK_KEY || 0),
      instanceRef: String(RELEASE_GIT_REVISION || RELEASE_DEPLOY_ID || ""),
      pid: 0,
      hostname: "",
      serviceEnv: process.env.NODE_ENV || "production",
      startedAt: null,
      lastHeartbeatAt: now,
      stoppedAt: now,
      lastError: "runtime_state_was_missing",
      stateJson: {
        phase: "reconciled_missing_state",
        note
      },
      updatedBy
    });
  } else if (forceStop || healthBefore.stale) {
    status = forceStop ? "forced_stop" : "stale_stop";
    const mergedStateJson = {
      ...(current.state_json || {}),
      phase: "reconciled_stop",
      stale_before: Boolean(healthBefore.stale),
      forced: Boolean(forceStop),
      note
    };
    await botRuntimeStore.upsertRuntimeState(db, {
      stateKey,
      serviceName: current.service_name || "airdropkral-bot",
      mode: "disabled",
      alive: false,
      lockAcquired: false,
      lockKey: Number(current.lock_key || process.env.BOT_INSTANCE_LOCK_KEY || 0),
      instanceRef: String(current.instance_ref || ""),
      pid: Number(current.pid || 0),
      hostname: String(current.hostname || ""),
      serviceEnv: String(current.service_env || process.env.NODE_ENV || "production"),
      startedAt: current.started_at || null,
      lastHeartbeatAt: now,
      stoppedAt: now,
      lastError: forceStop ? "manual_reconcile_forced_stop" : "manual_reconcile_stale_stop",
      stateJson: mergedStateJson,
      updatedBy
    });
  } else {
    status = "heartbeat_refreshed";
    const mergedStateJson = {
      ...(current.state_json || {}),
      phase: "reconciled_heartbeat",
      note
    };
    await botRuntimeStore.upsertRuntimeState(db, {
      stateKey,
      serviceName: current.service_name || "airdropkral-bot",
      mode: String(current.mode || "disabled"),
      alive: Boolean(current.alive),
      lockAcquired: Boolean(current.lock_acquired),
      lockKey: Number(current.lock_key || process.env.BOT_INSTANCE_LOCK_KEY || 0),
      instanceRef: String(current.instance_ref || ""),
      pid: Number(current.pid || 0),
      hostname: String(current.hostname || ""),
      serviceEnv: String(current.service_env || process.env.NODE_ENV || "production"),
      startedAt: current.started_at || null,
      lastHeartbeatAt: now,
      stoppedAt: current.stopped_at || null,
      lastError: String(current.last_error || ""),
      stateJson: mergedStateJson,
      updatedBy
    });
  }

  await botRuntimeStore.insertRuntimeEvent(db, {
    stateKey,
    eventType: "runtime_reconcile",
    eventJson: {
      status,
      forced: forceStop,
      note,
      health_before: healthBefore
    }
  });

  const after = await readBotRuntimeState(db, { stateKey, limit: 30 });
  return {
    status,
    state_key: stateKey,
    before,
    after,
    health_before: healthBefore,
    health_after: projectBotRuntimeHealth(after)
  };
}

function dbPingWithTimeout(ms) {
  return Promise.race([
    pool.query("SELECT 1 AS ok;"),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("db_timeout")), ms);
    })
  ]);
}

async function dependencyHealth() {
  let dbOk = false;
  let reason = "";
  try {
    const db = await dbPingWithTimeout(5000);
    dbOk = db.rows[0]?.ok === 1;
  } catch (err) {
    dbOk = false;
    reason = err?.message || "db_unavailable";
  }

  let arenaSessionTables = false;
  let raidSessionTables = false;
  let pvpSessionTables = false;
  let tokenMarketTables = false;
  let queueTables = false;
  let webappPerfTables = false;
  let oracleTables = false;
  let guardrailTables = false;
  let assetRegistryTables = false;
  let runtimeFlagTables = false;
  let treasuryOpsTables = false;
  let releaseMarkersTable = false;
  let botRuntimeTables = false;
  let botRuntime = {
    available: false,
    alive: false,
    lock_acquired: false,
    mode: "disabled",
    last_heartbeat_at: null,
    heartbeat_lag_sec: null,
    stale: true,
    reason: "tables_missing"
  };
  try {
    const check = await pool.query(
      `SELECT
         to_regclass('public.arena_sessions') IS NOT NULL AS arena_sessions,
         to_regclass('public.arena_session_actions') IS NOT NULL AS arena_session_actions,
         to_regclass('public.arena_session_results') IS NOT NULL AS arena_session_results,
         to_regclass('public.raid_sessions') IS NOT NULL AS raid_sessions,
         to_regclass('public.raid_actions') IS NOT NULL AS raid_actions,
         to_regclass('public.raid_results') IS NOT NULL AS raid_results,
         to_regclass('public.pvp_sessions') IS NOT NULL AS pvp_sessions,
         to_regclass('public.pvp_session_actions') IS NOT NULL AS pvp_session_actions,
         to_regclass('public.pvp_session_results') IS NOT NULL AS pvp_session_results,
         to_regclass('public.pvp_matchmaking_queue') IS NOT NULL AS pvp_matchmaking_queue,
         to_regclass('public.token_market_state') IS NOT NULL AS token_market_state,
         to_regclass('public.token_auto_decisions') IS NOT NULL AS token_auto_decisions,
         to_regclass('public.user_ui_prefs') IS NOT NULL AS user_ui_prefs,
         to_regclass('public.device_perf_profiles') IS NOT NULL AS device_perf_profiles,
         to_regclass('public.render_quality_snapshots') IS NOT NULL AS render_quality_snapshots,
         to_regclass('public.combat_frame_stats') IS NOT NULL AS combat_frame_stats,
         to_regclass('public.combat_net_stats') IS NOT NULL AS combat_net_stats,
         to_regclass('public.ui_interaction_events') IS NOT NULL AS ui_interaction_events,
         to_regclass('public.webapp_asset_registry') IS NOT NULL AS webapp_asset_registry,
         to_regclass('public.webapp_asset_load_events') IS NOT NULL AS webapp_asset_load_events,
         to_regclass('public.price_oracle_snapshots') IS NOT NULL AS price_oracle_snapshots,
         to_regclass('public.external_api_health') IS NOT NULL AS external_api_health,
         to_regclass('public.treasury_guardrails') IS NOT NULL AS treasury_guardrails,
         to_regclass('public.velocity_buckets') IS NOT NULL AS velocity_buckets,
         to_regclass('public.feature_flag_audit') IS NOT NULL AS feature_flag_audit,
         to_regclass('public.flag_source_state') IS NOT NULL AS flag_source_state,
         to_regclass('public.bot_runtime_state') IS NOT NULL AS bot_runtime_state,
         to_regclass('public.bot_runtime_events') IS NOT NULL AS bot_runtime_events,
         to_regclass('public.treasury_policy_history') IS NOT NULL AS treasury_policy_history,
         to_regclass('public.payout_gate_snapshots') IS NOT NULL AS payout_gate_snapshots,
         to_regclass('public.token_quote_traces') IS NOT NULL AS token_quote_traces,
         to_regclass('public.feature_flags') IS NOT NULL AS feature_flags,
         to_regclass('public.release_markers') IS NOT NULL AS release_markers;`
    );
    const row = check.rows[0] || {};
    arenaSessionTables = Boolean(row.arena_sessions && row.arena_session_actions && row.arena_session_results);
    raidSessionTables = Boolean(row.raid_sessions && row.raid_actions && row.raid_results);
    pvpSessionTables = Boolean(
      row.pvp_sessions && row.pvp_session_actions && row.pvp_session_results && row.pvp_matchmaking_queue
    );
    tokenMarketTables = Boolean(row.token_market_state);
    queueTables = Boolean(row.token_auto_decisions && row.feature_flags);
    webappPerfTables = Boolean(
      row.user_ui_prefs &&
        row.device_perf_profiles &&
        row.render_quality_snapshots &&
        row.combat_frame_stats &&
        row.combat_net_stats &&
        row.ui_interaction_events
    );
    oracleTables = Boolean(row.price_oracle_snapshots && row.external_api_health);
    guardrailTables = Boolean(row.treasury_guardrails && row.velocity_buckets);
    assetRegistryTables = Boolean(row.webapp_asset_registry && row.webapp_asset_load_events);
    runtimeFlagTables = Boolean(row.feature_flag_audit && row.flag_source_state);
    botRuntimeTables = Boolean(row.bot_runtime_state && row.bot_runtime_events);
    treasuryOpsTables = Boolean(row.treasury_policy_history && row.payout_gate_snapshots && row.token_quote_traces);
    releaseMarkersTable = Boolean(row.release_markers);
    if (botRuntimeTables) {
      const runtimeState = await readBotRuntimeState(pool);
      botRuntime = projectBotRuntimeHealth(runtimeState);
    }
  } catch (err) {
    if (!reason) {
      reason = err?.message || "dependency_check_failed";
    }
  }

  return {
    ok: Boolean(dbOk),
    db: dbOk,
    reason,
    dependencies: {
      arena_session_tables: arenaSessionTables,
      raid_session_tables: raidSessionTables,
      pvp_session_tables: pvpSessionTables,
      token_market_tables: tokenMarketTables,
      queue_tables: queueTables,
      webapp_perf_tables: webappPerfTables,
      webapp_asset_registry_tables: assetRegistryTables,
      oracle_tables: oracleTables,
      guardrail_tables: guardrailTables,
      runtime_flag_tables: runtimeFlagTables,
      bot_runtime_tables: botRuntimeTables,
      treasury_ops_tables: treasuryOpsTables,
      release_markers: releaseMarkersTable
    },
    bot_runtime: botRuntime
  };
}

function arenaSessionErrorCode(error) {
  const key = String(error || "").toLowerCase();
  if (
    [
      "session_not_found",
      "attempt_not_found",
      "user_not_started"
    ].includes(key)
  ) {
    return 404;
  }
  if (["session_expired", "session_not_active", "invalid_action_seq", "arena_auth_disabled"].includes(key)) {
    return 409;
  }
  if (["insufficient_rc"].includes(key)) {
    return 409;
  }
  if (["session_not_ready", "invalid_input_action"].includes(key)) {
    return 400;
  }
  if (key === "freeze_mode") {
    return 409;
  }
  if (["arena_session_tables_missing", "raid_session_tables_missing", "pvp_session_tables_missing"].includes(key)) {
    return 503;
  }
  return 400;
}

fastify.get("/healthz", async () => {
  const health = await dependencyHealth();
  return {
    ok: health.ok,
    service: "up",
    db: health.db,
    dependencies: health.dependencies,
    bot_runtime: health.bot_runtime
  };
});

fastify.get("/health", async () => dependencyHealth());

fastify.get("/webapp", async (request, reply) => {
  const client = await pool.connect();
  try {
    const variant = await resolveWebAppVariant(client);
    const indexPath = variant.indexPath || path.join(variant.rootDir, "index.html");
    if (!fs.existsSync(indexPath)) {
      reply.code(404).type("text/plain").send("webapp_not_found");
      return;
    }
    reply.type("text/html; charset=utf-8").send(fs.readFileSync(indexPath, "utf8"));
  } finally {
    client.release();
  }
});

fastify.get("/webapp/:asset", async (request, reply) => {
  const asset = String(request.params.asset || "");
  const client = await pool.connect();
  try {
    const variant = await resolveWebAppVariant(client);
    const legacyAllowed = new Set(["app.js", "styles.css"]);
    if (variant.source === "legacy" && !legacyAllowed.has(asset)) {
      reply.code(404).type("text/plain").send("asset_not_found");
      return;
    }
    const filePath = path.join(variant.rootDir, asset);
    if (!filePath.startsWith(variant.rootDir) || !fs.existsSync(filePath)) {
      reply.code(404).type("text/plain").send("asset_not_found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type =
      ext === ".js"
        ? "application/javascript; charset=utf-8"
        : ext === ".css"
          ? "text/css; charset=utf-8"
          : "application/octet-stream";
    reply.type(type).send(fs.readFileSync(filePath, ext === ".js" || ext === ".css" ? "utf8" : undefined));
  } finally {
    client.release();
  }
});

fastify.get("/webapp/assets/*", async (request, reply) => {
  const rawPath = String(request.params["*"] || "");
  if (!rawPath || rawPath.includes("..") || rawPath.includes("\\") || rawPath.startsWith("/")) {
    reply.code(404).type("text/plain").send("asset_not_found");
    return;
  }
  const client = await pool.connect();
  try {
    const variant = await resolveWebAppVariant(client);
    const roots = buildWebAppAssetServeRoots(variant);
    const resolved = resolveAssetFileFromRoots(roots, rawPath);
    if (!resolved || !resolved.filePath) {
      reply.code(404).type("text/plain").send("asset_not_found");
      return;
    }
    const filePath = resolved.filePath;

    const ext = path.extname(filePath).toLowerCase();
    const contentType =
      ext === ".glb"
        ? "model/gltf-binary"
        : ext === ".gltf"
          ? "model/gltf+json; charset=utf-8"
          : ext === ".json"
            ? "application/json; charset=utf-8"
          : ext === ".png"
            ? "image/png"
            : ext === ".jpg" || ext === ".jpeg"
              ? "image/jpeg"
              : ext === ".webp"
                ? "image/webp"
                : ext === ".mp3"
                  ? "audio/mpeg"
                  : ext === ".ogg"
                    ? "audio/ogg"
                    : ext === ".wav"
                      ? "audio/wav"
                      : ext === ".js"
                        ? "application/javascript; charset=utf-8"
                        : ext === ".css"
                          ? "text/css; charset=utf-8"
                          : "application/octet-stream";

    reply.type(contentType).send(fs.readFileSync(filePath));
  } finally {
    client.release();
  }
});

fastify.get("/webapp/api/bootstrap", async (request, reply) => {
  const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
  if (!auth.ok) {
    reply.code(401).send({ success: false, error: auth.reason });
    return;
  }
  const scopeRaw = String(request.query.scope || "player").trim().toLowerCase();
  const bootstrapScope = scopeRaw === "full" ? "full" : "player";
  const includeAdminRequested = String(request.query.include_admin || "0") === "1" || bootstrapScope === "full";
  const includeHeavyPayload = bootstrapScope === "full";

  const client = await pool.connect();
  try {
    const profile = await getProfileByTelegram(client, auth.uid);
    if (!profile) {
      reply.code(404).send({ success: false, error: "user_not_started" });
      return;
    }

    const balancesRes = await client.query(
      `SELECT currency, balance
       FROM currency_balances
       WHERE user_id = $1;`,
      [profile.user_id]
    );
    const balances = normalizeBalances(balancesRes.rows);

    const dailyRes = await client.query(
      `SELECT tasks_done, sc_earned, hc_earned, rc_earned
       FROM daily_counters
       WHERE user_id = $1
         AND day_date = CURRENT_DATE
       LIMIT 1;`,
      [profile.user_id]
    );
    const dailyRow = dailyRes.rows[0] || {};

    const runtimeConfig = await configService.getEconomyConfig(client);

    const season = seasonStore.getSeasonInfo(runtimeConfig);
    const anomaly = nexusEventEngine.publicAnomalyView(
      nexusEventEngine.resolveDailyAnomaly(runtimeConfig, {
        seasonId: season.seasonId
      })
    );
    const contract = resolveLiveContract(runtimeConfig, season, anomaly);
    const seasonStat = await seasonStore.getSeasonStat(client, {
      userId: profile.user_id,
      seasonId: season.seasonId
    });

    const war = await globalStore.getWarStatus(client, season.seasonId);
    const missions = await missionStore.getMissionBoard(client, profile.user_id);
    const riskState = await riskStore.getRiskState(client, profile.user_id);
    const live = await readOffersAttemptsEvents(client, profile.user_id);
    const arenaConfig = arenaEngine.getArenaConfig(runtimeConfig);
    const arenaReady = await arenaStore.hasArenaTables(client);
    const arenaState = arenaReady
      ? await arenaStore.getArenaState(client, profile.user_id, arenaConfig.baseRating)
      : null;
    const arenaRank = arenaReady ? await arenaStore.getRank(client, profile.user_id) : null;
    const arenaRuns = arenaReady && includeHeavyPayload ? await arenaStore.getRecentRuns(client, profile.user_id, 5) : [];
    const arenaLeaders = arenaReady && includeHeavyPayload ? await arenaStore.getLeaderboard(client, season.seasonId, 5) : [];
    const director = arenaReady && includeHeavyPayload
      ? await arenaService.buildDirectorView(client, { profile, config: runtimeConfig }).catch(() => null)
      : null;
    const token = await buildTokenSummary(client, profile, runtimeConfig, balances);
    const payoutLockState = await buildPayoutLockState(client, profile, runtimeConfig, balances, token);
    const uiPrefs = await webappStore.getUserUiPrefs(client, profile.user_id).catch((err) => {
      if (err.code === "42P01") return null;
      throw err;
    });
    const perfProfile = await webappStore.getLatestPerfProfile(client, profile.user_id).catch((err) => {
      if (err.code === "42P01") return null;
      throw err;
    });
    const sceneProfile = await readSceneProfile(client, profile.user_id, "nexus_arena").catch((err) => {
      if (err.code === "42P01") return null;
      throw err;
    });
    const featureFlags = await loadFeatureFlags(client, { withMeta: true });
    const walletCapabilities = getWalletCapabilities(featureFlags.flags || {});
    const walletTablesAvailable = walletCapabilities.enabled ? await hasWalletAuthTables(client).catch(() => false) : false;
    const kycTablesAvailable = walletCapabilities.enabled
      ? await hasKycTables(client).catch(() => false)
      : false;
    const walletSessionState = walletCapabilities.enabled && walletTablesAvailable
      ? await readWalletSessionState(client, profile.user_id).catch(() => ({
          active: false,
          chain: "",
          address: "",
          linked_at: null,
          expires_at: null,
          session_ref: "",
          kyc_status: "unknown"
        }))
      : {
          active: false,
          chain: "",
          address: "",
          linked_at: null,
          expires_at: null,
          session_ref: "",
          kyc_status: "unknown"
        };
    const kycProfile = kycTablesAvailable ? await readKycProfile(client, profile.user_id).catch(() => null) : null;
    const kycState = normalizeKycState(kycProfile);
    const monetizationSummary = await buildMonetizationSummary(client, {
      featureFlags: featureFlags.flags || {},
      userId: profile.user_id,
      lang: request.query.lang || "tr"
    }).catch((err) => {
      if (err.code === "42P01") {
        return {
          enabled: isFeatureEnabled(featureFlags.flags || {}, "MONETIZATION_CORE_V1_ENABLED"),
          tables_available: false,
          pass_catalog: [],
          cosmetic_catalog: getCosmeticCatalog(request.query.lang || "tr"),
          active_passes: [],
          pass_history: [],
          cosmetics: { owned_count: 0, recent: [] },
          spend_summary: { SC: 0, HC: 0, RC: 0 },
          player_effects: {
            premium_active: false,
            sc_boost_multiplier: 0,
            season_bonus_multiplier: 0
          },
          updated_at: new Date().toISOString()
        };
      }
      throw err;
    });
    const activeManifest = await readActiveAssetManifest(client, {
      includeEntries: includeHeavyPayload,
      entryLimit: includeHeavyPayload ? 256 : 32
    }).catch((err) => {
      if (err.code === "42P01") {
        return { available: false, active_revision: null, entries: [] };
      }
      throw err;
    });
    let manifestSummary = summarizeActiveAssetManifest(activeManifest);
    if (Number(manifestSummary.total_assets || 0) <= 0) {
      const localAssetStatus = buildAssetStatusRows();
      const localReady = localAssetStatus.rows.filter((row) => row.exists).length;
      const localTotal = localAssetStatus.rows.length;
      manifestSummary = {
        ...manifestSummary,
        available: Boolean(manifestSummary.available || localTotal > 0),
        total_assets: localTotal,
        ready_assets: localReady,
        missing_assets: Math.max(0, localTotal - localReady),
        integrity_ok_assets: Math.max(Number(manifestSummary.integrity_ok_assets || 0), localReady),
        integrity_ratio: localTotal > 0 ? Number((localReady / localTotal).toFixed(4)) : Number(manifestSummary.integrity_ratio || 0)
      };
    }
    const isAdmin = isAdminTelegramId(auth.uid);
    let adminSummary = null;
    if (isAdmin && includeAdminRequested) {
      adminSummary = await buildAdminSummary(client, runtimeConfig);
      const botRuntime = await readBotRuntimeState(client, { stateKey: botRuntimeStore.DEFAULT_STATE_KEY, limit: 15 });
      adminSummary.bot_runtime = {
        state_key: botRuntime.state_key || botRuntimeStore.DEFAULT_STATE_KEY,
        health: projectBotRuntimeHealth(botRuntime),
        state: botRuntime.state || null,
        events: botRuntime.events || []
      };
    }
    const webappVersionState = await resolveWebAppVersion(client);
    const webappLaunchUrl = buildVersionedWebAppUrl(WEBAPP_PUBLIC_URL, webappVersionState.version);
    const effectiveSceneMode = String(
      (sceneProfile && sceneProfile.scene_mode) ||
        (uiPrefs?.ui_mode === "minimal" ? "minimal" : uiPrefs?.ui_mode === "standard" ? "lite" : "pro")
    ).toLowerCase();
    const assetMode = summarizeAssetMode({
      sceneMode: effectiveSceneMode,
      manifestSummary
    });
    const uxV4Enabled = isFeatureEnabled(featureFlags.flags, "UX_V4_ENABLED");
    const uxV5Enabled = isFeatureEnabled(featureFlags.flags, "UX_V5_ENABLED");
    const i18nEnabled = isFeatureEnabled(featureFlags.flags, "I18N_V1_ENABLED") || isFeatureEnabled(featureFlags.flags, "I18N_V2_ENABLED");
    const playerModeDefault = isFeatureEnabled(featureFlags.flags, "WEBAPP_PLAYER_MODE_DEFAULT");
    const pollPrimary = isFeatureEnabled(featureFlags.flags, "PVP_POLL_PRIMARY");
    const requestedLanguage = String(request.query.lang || "tr").toLowerCase().startsWith("en") ? "en" : "tr";
    const language = i18nEnabled ? requestedLanguage : "tr";
    const transport = Boolean(!pollPrimary && PVP_WS_ENABLED && featureFlags.flags?.PVP_WS_ENABLED) ? "ws" : "poll";

    const missionReady = missions.filter((m) => m.completed && !m.claimed).length;
    const missionOpen = missions.filter((m) => !m.claimed).length;

    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      webapp_version: webappVersionState.version,
      webapp_launch_url: webappLaunchUrl,
      data: {
        api_version: "v1",
        bootstrap_scope: bootstrapScope,
        admin_included: Boolean(isAdmin && includeAdminRequested),
        profile,
        balances,
        daily: buildDailyView(runtimeConfig, profile, dailyRow),
        season: {
          season_id: season.seasonId,
          days_left: season.daysLeft,
          points: Number(seasonStat?.season_points || 0)
        },
        nexus: anomaly,
        contract,
        war,
        risk_score: Number(riskState.riskScore || 0),
        missions: {
          total: missions.length,
          ready: missionReady,
          open: missionOpen,
          list: missions
        },
        offers: live.offers,
        attempts: live.attempts,
        events: live.events,
        token,
        payout_lock: {
          global_gate_open: Boolean(payoutLockState.release?.global_gate_open),
          unlock_tier: String(payoutLockState.release?.unlock_tier || "T0"),
          unlock_progress: Number(payoutLockState.release?.unlock_progress || 0),
          next_tier_target: String(payoutLockState.release?.next_tier_target || "score >= 0.25"),
          today_drip_btc_remaining: Number(payoutLockState.release?.today_drip_btc_remaining || 0),
          today_drip_cap_btc: Number(payoutLockState.release?.today_drip_cap_btc || 0),
          requestable_btc: Number(payoutLockState.requestable_btc || 0),
          entitled_btc: Number(payoutLockState.entitled_btc || 0),
          can_request: Boolean(payoutLockState.can_request)
        },
        director,
        pvp_content:
          director?.pvp_content ||
          computePvpProgressionState(
            {},
            runtimeConfig?.events?.pvp_content || {},
            {
              season_id: season.seasonId
            }
          ),
        command_catalog: buildCommandCatalog({
          lang: language,
          primaryOnly: true
        }),
        wallet_capabilities: {
          ...walletCapabilities,
          tables_available: walletTablesAvailable,
          kyc_tables_available: kycTablesAvailable
        },
        wallet_session: {
          ...walletSessionState,
          address_masked: walletSessionState.active ? maskWalletLinkAddress(walletSessionState.address) : ""
        },
        kyc_status: {
          status: kycState.status,
          tier: kycState.tier,
          blocked: kycState.blocked,
          approved: kycState.approved
        },
        monetization: monetizationSummary,
        feature_flags: featureFlags.flags,
        feature_flag_runtime: {
          source_mode: featureFlags.source_mode,
          source_json: featureFlags.source_json || {},
          env_forced: Boolean(featureFlags.env_forced)
        },
        runtime_flags_effective: pickCriticalRuntimeFlags(featureFlags.flags),
        webapp_version: webappVersionState.version,
        webapp_launch_url: webappLaunchUrl,
        webapp_version_source: webappVersionState.source,
        asset_mode: assetMode,
        transport,
        scene_profile: sceneProfile || buildDefaultSceneProfile({ userId: profile.user_id, sceneKey: "nexus_arena" }),
        scene_mode: effectiveSceneMode,
        perf_profile: perfProfile,
        ui_prefs:
          uiPrefs || {
            ui_mode: "hardcore",
            quality_mode: "auto",
            reduced_motion: false,
            large_text: false,
            sound_enabled: true
          },
        ux: {
          default_mode: (uxV5Enabled || uxV4Enabled) && playerModeDefault ? "player" : "legacy",
          language,
          advanced_enabled: !((uxV5Enabled || uxV4Enabled) && playerModeDefault),
          version: uxV5Enabled ? "v5" : uxV4Enabled ? "v4" : "legacy"
        },
        admin: {
          is_admin: isAdmin,
          telegram_id: Number(auth.uid || 0),
          configured_admin_id: Number(ADMIN_TELEGRAM_ID || 0),
          summary: adminSummary
        },
        arena: {
          rating: Number(arenaState?.rating || arenaConfig.baseRating),
          games_played: Number(arenaState?.games_played || 0),
          wins: Number(arenaState?.wins || 0),
          losses: Number(arenaState?.losses || 0),
          last_result: arenaState?.last_result || "",
          rank: Number(arenaRank?.rank || 0),
          ticket_cost_rc: arenaConfig.ticketCostRc,
          cooldown_sec: arenaConfig.cooldownSec,
          ready: arenaReady,
          recent_runs: arenaRuns,
          leaderboard: arenaLeaders
        }
      }
    });
  } finally {
    client.release();
  }
});

fastify.get("/webapp/api/v2/bootstrap", async (request, reply) => {
  await proxyWebAppApiV1(request, reply, {
    targetPath: "/webapp/api/bootstrap",
    method: "GET",
    transform: (payload) => {
      if (!payload || typeof payload !== "object") {
        return payload;
      }
      if (!payload.data || typeof payload.data !== "object") {
        payload.data = {};
      }
      payload.data.api_version = "v2";
      payload.data.pvp_content = payload.data.pvp_content || payload.data.director?.pvp_content || null;
      payload.data.command_catalog =
        Array.isArray(payload.data.command_catalog) && payload.data.command_catalog.length > 0
          ? payload.data.command_catalog
          : buildCommandCatalog({
              lang: String(request.query?.lang || payload.data?.ux?.language || "tr"),
              primaryOnly: true
            });
      payload.data.runtime_flags_effective =
        payload.data.runtime_flags_effective && typeof payload.data.runtime_flags_effective === "object"
          ? payload.data.runtime_flags_effective
          : payload.data.feature_flags && typeof payload.data.feature_flags === "object"
            ? payload.data.feature_flags
            : {};
      payload.data.wallet_capabilities =
        payload.data.wallet_capabilities && typeof payload.data.wallet_capabilities === "object"
          ? payload.data.wallet_capabilities
          : getWalletCapabilities(payload.data.feature_flags || {});
      payload.data.wallet_session =
        payload.data.wallet_session && typeof payload.data.wallet_session === "object"
          ? payload.data.wallet_session
          : {
              active: false,
              chain: "",
              address: "",
              address_masked: "",
              linked_at: null,
              expires_at: null,
              session_ref: "",
              kyc_status: "unknown"
            };
      payload.data.kyc_status =
        payload.data.kyc_status && typeof payload.data.kyc_status === "object"
          ? payload.data.kyc_status
          : {
              status: "unknown",
              tier: "none",
              blocked: false,
              approved: false
            };
      payload.data.monetization =
        payload.data.monetization && typeof payload.data.monetization === "object"
          ? payload.data.monetization
          : {
              enabled: isFeatureEnabled(payload.data.feature_flags || {}, "MONETIZATION_CORE_V1_ENABLED"),
              tables_available: false,
              pass_catalog: [],
              cosmetic_catalog: getCosmeticCatalog(String(request.query?.lang || payload.data?.ux?.language || "tr")),
              active_passes: [],
              pass_history: [],
              cosmetics: { owned_count: 0, recent: [] },
              spend_summary: { SC: 0, HC: 0, RC: 0 },
              player_effects: {
                premium_active: false,
                sc_boost_multiplier: 0,
                season_bonus_multiplier: 0
              },
              updated_at: new Date().toISOString()
            };
      payload.data.ux = {
        ...(payload.data.ux || {}),
        version: String(payload.data?.ux?.version || "v5")
      };
      return payload;
    }
  });
});

fastify.get("/webapp/api/v2/admin/bootstrap", async (request, reply) => {
  await proxyWebAppApiV1(request, reply, {
    targetPath: "/webapp/api/admin/summary",
    method: "GET",
    transform: (payload) => {
      if (!payload || typeof payload !== "object") {
        return payload;
      }
      if (!payload.data || typeof payload.data !== "object") {
        payload.data = {};
      }
      payload.data.api_version = "v2";
      payload.data.bootstrap_scope = "admin";
      payload.data.admin_included = true;
      return payload;
    }
  });
});

fastify.get("/webapp/api/v2/assets/manifest/resolved", async (request, reply) => {
  const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
  if (!auth.ok) {
    reply.code(401).send({ success: false, error: auth.reason });
    return;
  }
  const includeEntries = String(request.query.include_entries || "0") === "1";
  const entryLimit = Math.max(1, Math.min(600, Number(request.query.limit || 200)));
  const client = await pool.connect();
  try {
    const profile = await getProfileByTelegram(client, auth.uid);
    if (!profile) {
      reply.code(404).send({ success: false, error: "user_not_started" });
      return;
    }
    const [variant, activeManifest] = await Promise.all([
      resolveWebAppVariant(client),
      readActiveAssetManifest(client, { includeEntries: true, entryLimit })
    ]);
    const roots = buildWebAppAssetServeRoots(variant);
    const resolvedRoots = roots.map((root) => ({
      root_path: root,
      exists: fs.existsSync(root),
      source: root.startsWith(path.resolve(WEBAPP_DIST_DIR)) ? "dist" : "source"
    }));
    const manifestHit = resolveAssetFileFromRoots(roots, "manifest.json");

    let entries = Array.isArray(activeManifest?.entries) ? activeManifest.entries : [];
    if (!entries.length) {
      const localManifest = readAssetManifest().manifest;
      const localModels = localManifest && typeof localManifest.models === "object" ? localManifest.models : {};
      entries = Object.entries(localModels).map(([assetKey, model]) => ({
        asset_key: String(assetKey || ""),
        asset_path: String(model?.path || ""),
        fallback_path: "",
        exists_local: null,
        integrity_status: "unknown",
        meta_json: model && typeof model === "object" ? model : {}
      }));
    }

    const resolvedEntries = [];
    const missing = [];
    for (const entry of entries) {
      const rawPath = String(entry.asset_path || entry.fallback_path || "").trim();
      const relativePath = resolveAssetRelativePath(rawPath);
      if (!relativePath) {
        continue;
      }
      const hit = resolveAssetFileFromRoots(roots, relativePath);
      if (hit) {
        resolvedEntries.push({
          asset_key: String(entry.asset_key || ""),
          asset_path: rawPath,
          served_relative_path: hit.relativePath,
          served_file_path: hit.filePath,
          served_root: hit.root
        });
      } else {
        missing.push({
          asset_key: String(entry.asset_key || ""),
          asset_path: rawPath,
          served_relative_path: relativePath
        });
      }
    }

    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data: {
        api_version: "v2",
        variant_source: String(variant.source || "legacy"),
        active_revision:
          String(
            activeManifest?.active_revision?.manifest_revision ||
              activeManifest?.active_revision?.state_json?.manifest_revision ||
              activeManifest?.active_revision?.state_json?.active_revision ||
              ""
          ) || "v0",
        served_paths: resolvedRoots,
        manifest: {
          public_path: "/webapp/assets/manifest.json",
          resolved: Boolean(manifestHit),
          resolved_file_path: manifestHit?.filePath || "",
          source_root: manifestHit?.root || ""
        },
        counts: {
          total_entries: entries.length,
          resolved_entries: resolvedEntries.length,
          missing_entries: missing.length
        },
        missing: missing.slice(0, 300),
        entries: includeEntries ? resolvedEntries.slice(0, 300) : []
      }
    });
  } finally {
    client.release();
  }
});

fastify.get("/webapp/api/v2/commands/catalog", async (request, reply) => {
  const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
  if (!auth.ok) {
    reply.code(401).send({ success: false, error: auth.reason });
    return;
  }
  const lang = normalizeLanguage(String(request.query.lang || "tr"), "tr");
  const includeAdmin = String(request.query.include_admin || "0") === "1";
  const includeNonPrimary = String(request.query.include_non_primary || "0") === "1";

  const client = await pool.connect();
  try {
    const profile = await getProfileByTelegram(client, auth.uid);
    if (!profile) {
      reply.code(404).send({ success: false, error: "user_not_started" });
      return;
    }
    let commands = buildCommandCatalog({
      lang,
      primaryOnly: !includeNonPrimary
    });
    if (!includeAdmin) {
      commands = commands.filter((row) => !row.adminOnly);
    }
    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data: {
        api_version: "v2",
        language: lang,
        include_admin: includeAdmin,
        include_non_primary: includeNonPrimary,
        generated_at: new Date().toISOString(),
        commands
      }
    });
  } finally {
    client.release();
  }
});

fastify.get("/webapp/api/v2/monetization/catalog", async (request, reply) => {
  const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
  if (!auth.ok) {
    reply.code(401).send({ success: false, error: auth.reason });
    return;
  }
  const lang = normalizeLanguage(String(request.query.lang || "tr"), "tr");
  const client = await pool.connect();
  try {
    const profile = await getProfileByTelegram(client, auth.uid);
    if (!profile) {
      reply.code(404).send({ success: false, error: "user_not_started" });
      return;
    }
    const featureFlags = await loadFeatureFlags(client);
    const summary = await buildMonetizationSummary(client, {
      featureFlags,
      userId: profile.user_id,
      lang
    });
    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data: {
        api_version: "v2",
        language: lang,
        enabled: Boolean(summary.enabled),
        tables_available: Boolean(summary.tables_available),
        pass_catalog: Array.isArray(summary.pass_catalog) ? summary.pass_catalog : [],
        cosmetic_catalog: Array.isArray(summary.cosmetic_catalog) ? summary.cosmetic_catalog : [],
        player_effects: summary.player_effects || {
          premium_active: false,
          sc_boost_multiplier: 0,
          season_bonus_multiplier: 0
        },
        active_pass_count: Array.isArray(summary.active_passes) ? summary.active_passes.length : 0,
        updated_at: summary.updated_at || new Date().toISOString()
      }
    });
  } catch (err) {
    if (err.code === "42P01") {
      reply.code(503).send({ success: false, error: "monetization_tables_missing" });
      return;
    }
    throw err;
  } finally {
    client.release();
  }
});

fastify.get("/webapp/api/v2/monetization/status", async (request, reply) => {
  const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
  if (!auth.ok) {
    reply.code(401).send({ success: false, error: auth.reason });
    return;
  }
  const lang = normalizeLanguage(String(request.query.lang || "tr"), "tr");
  const client = await pool.connect();
  try {
    const profile = await getProfileByTelegram(client, auth.uid);
    if (!profile) {
      reply.code(404).send({ success: false, error: "user_not_started" });
      return;
    }
    const featureFlags = await loadFeatureFlags(client);
    const summary = await buildMonetizationSummary(client, {
      featureFlags,
      userId: profile.user_id,
      lang
    });
    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data: {
        api_version: "v2",
        language: lang,
        monetization: summary
      }
    });
  } catch (err) {
    if (err.code === "42P01") {
      reply.code(503).send({ success: false, error: "monetization_tables_missing" });
      return;
    }
    throw err;
  } finally {
    client.release();
  }
});

fastify.post(
  "/webapp/api/v2/monetization/pass/purchase",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig", "pass_key"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          pass_key: { type: "string", minLength: 3, maxLength: 64 },
          payment_currency: { type: "string", minLength: 2, maxLength: 8 },
          purchase_ref: { type: "string", minLength: 6, maxLength: 120 }
        }
      }
    }
  },
  async (request, reply) => {
    const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
    if (!auth.ok) {
      reply.code(401).send({ success: false, error: auth.reason });
      return;
    }
    const passKey = String(request.body.pass_key || "").trim().toLowerCase();
    if (!passKey) {
      reply.code(400).send({ success: false, error: "pass_key_invalid" });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const profile = await getProfileByTelegram(client, auth.uid);
      if (!profile) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "user_not_started" });
        return;
      }
      const freeze = await getFreezeState(client);
      if (freeze.freeze) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "freeze_mode", reason: freeze.reason });
        return;
      }
      const featureFlags = await loadFeatureFlags(client);
      if (!isFeatureEnabled(featureFlags, "MONETIZATION_CORE_V1_ENABLED")) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "monetization_feature_disabled" });
        return;
      }
      const tables = await hasMonetizationTables(client);
      if (!tables.all) {
        await client.query("ROLLBACK");
        reply.code(503).send({ success: false, error: "monetization_tables_missing" });
        return;
      }

      await ensureDefaultPassProducts(client);
      const product = await getPassProductForUpdate(client, passKey);
      if (!product || product.active === false) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "pass_product_not_found" });
        return;
      }
      const productCurrency = normalizeMonetizationCurrency(product.price_currency, "SC");
      const paymentCurrency = normalizeMonetizationCurrency(request.body.payment_currency || productCurrency, productCurrency);
      if (paymentCurrency !== productCurrency) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "pass_currency_mismatch" });
        return;
      }
      const priceAmount = toPositiveNumber(product.price_amount, 0);
      if (priceAmount <= 0) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "pass_price_invalid" });
        return;
      }

      const purchaseRefInput = String(request.body.purchase_ref || "").trim();
      const purchaseRef =
        purchaseRefInput ||
        deterministicUuid(`v5_pass_purchase:${profile.user_id}:${passKey}:${Date.now()}:${Math.random()}`);
      const debit = await economyStore.debitCurrency(client, {
        userId: profile.user_id,
        currency: paymentCurrency,
        amount: priceAmount,
        reason: "v5_pass_purchase",
        refEventId: deterministicUuid(`v5_pass_debit:${purchaseRef}`),
        meta: {
          source: "webapp",
          pass_key: passKey,
          purchase_ref: purchaseRef
        }
      });
      if (!debit.applied) {
        await client.query("ROLLBACK");
        if (debit.reason === "insufficient_balance") {
          reply.code(409).send({ success: false, error: "insufficient_balance" });
          return;
        }
        reply.code(409).send({ success: false, error: debit.reason || "pass_debit_failed" });
        return;
      }

      const effects = product.effects_json && typeof product.effects_json === "object" ? product.effects_json : {};
      const durationDays = Math.max(1, Number(product.duration_days || 1));
      const purchase = await insertUserPassPurchase(client, {
        user_id: profile.user_id,
        pass_key: passKey,
        duration_days: durationDays,
        purchase_ref: purchaseRef,
        payload_json: {
          source: "webapp",
          pass_key: passKey,
          price_amount: priceAmount,
          price_currency: paymentCurrency,
          effects
        }
      });

      await shopStore.addOrExtendEffect(client, {
        userId: profile.user_id,
        effectKey: String(effects.effect_key || "premium_pass"),
        level: 1,
        durationHours: durationDays * 24,
        meta: {
          ...effects,
          pass_key: passKey,
          purchase_ref: purchaseRef
        }
      });

      await riskStore.insertBehaviorEvent(client, profile.user_id, "webapp_pass_purchase", {
        pass_key: passKey,
        purchase_ref: purchaseRef,
        price_amount: priceAmount,
        price_currency: paymentCurrency
      }).catch((err) => {
        if (err.code !== "42P01") {
          throw err;
        }
      });

      const monetization = await buildMonetizationSummary(client, {
        featureFlags,
        userId: profile.user_id,
        lang: request.body.lang || "tr"
      });
      const balances = await economyStore.getBalances(client, profile.user_id);
      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: {
          api_version: "v2",
          purchase: mapUserPassView(purchase),
          balances,
          monetization
        }
      });
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === "42P01") {
        reply.code(503).send({ success: false, error: "monetization_tables_missing" });
        return;
      }
      if (err.code === "23505") {
        reply.code(409).send({ success: false, error: "idempotency_conflict" });
        return;
      }
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.post(
  "/webapp/api/v2/monetization/cosmetic/purchase",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig", "item_key"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          item_key: { type: "string", minLength: 3, maxLength: 96 },
          payment_currency: { type: "string", minLength: 2, maxLength: 8 },
          purchase_ref: { type: "string", minLength: 6, maxLength: 120 }
        }
      }
    }
  },
  async (request, reply) => {
    const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
    if (!auth.ok) {
      reply.code(401).send({ success: false, error: auth.reason });
      return;
    }
    const itemKey = String(request.body.item_key || "").trim().toLowerCase();
    if (!itemKey) {
      reply.code(400).send({ success: false, error: "item_key_invalid" });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const profile = await getProfileByTelegram(client, auth.uid);
      if (!profile) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "user_not_started" });
        return;
      }
      const freeze = await getFreezeState(client);
      if (freeze.freeze) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "freeze_mode", reason: freeze.reason });
        return;
      }
      const featureFlags = await loadFeatureFlags(client);
      if (!isFeatureEnabled(featureFlags, "MONETIZATION_CORE_V1_ENABLED")) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "monetization_feature_disabled" });
        return;
      }
      const tables = await hasMonetizationTables(client);
      if (!tables.all) {
        await client.query("ROLLBACK");
        reply.code(503).send({ success: false, error: "monetization_tables_missing" });
        return;
      }

      const item = getCosmeticCatalogItem(itemKey);
      if (!item) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "cosmetic_item_not_found" });
        return;
      }
      const productCurrency = normalizeMonetizationCurrency(item.price_currency, "SC");
      const paymentCurrency = normalizeMonetizationCurrency(request.body.payment_currency || productCurrency, productCurrency);
      if (paymentCurrency !== productCurrency) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "cosmetic_currency_mismatch" });
        return;
      }
      const priceAmount = toPositiveNumber(item.price_amount, 0);
      if (priceAmount <= 0) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "cosmetic_price_invalid" });
        return;
      }

      const purchaseRefInput = String(request.body.purchase_ref || "").trim();
      const purchaseRef =
        purchaseRefInput ||
        deterministicUuid(`v5_cosmetic_purchase:${profile.user_id}:${itemKey}:${Date.now()}:${Math.random()}`);
      const debit = await economyStore.debitCurrency(client, {
        userId: profile.user_id,
        currency: paymentCurrency,
        amount: priceAmount,
        reason: "v5_cosmetic_purchase",
        refEventId: deterministicUuid(`v5_cosmetic_debit:${purchaseRef}`),
        meta: {
          source: "webapp",
          item_key: itemKey,
          purchase_ref: purchaseRef
        }
      });
      if (!debit.applied) {
        await client.query("ROLLBACK");
        if (debit.reason === "insufficient_balance") {
          reply.code(409).send({ success: false, error: "insufficient_balance" });
          return;
        }
        reply.code(409).send({ success: false, error: debit.reason || "cosmetic_debit_failed" });
        return;
      }

      const purchase = await insertCosmeticPurchase(client, {
        user_id: profile.user_id,
        item_key: itemKey,
        category: String(item.category || "cosmetic"),
        amount_paid: priceAmount,
        currency: paymentCurrency,
        purchase_ref: purchaseRef,
        payload_json: {
          source: "webapp",
          rarity: String(item.rarity || "common")
        }
      });

      await riskStore.insertBehaviorEvent(client, profile.user_id, "webapp_cosmetic_purchase", {
        item_key: itemKey,
        purchase_ref: purchaseRef,
        amount_paid: priceAmount,
        currency: paymentCurrency
      }).catch((err) => {
        if (err.code !== "42P01") {
          throw err;
        }
      });

      const monetization = await buildMonetizationSummary(client, {
        featureFlags,
        userId: profile.user_id,
        lang: request.body.lang || "tr"
      });
      const balances = await economyStore.getBalances(client, profile.user_id);
      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: {
          api_version: "v2",
          purchase: mapCosmeticPurchaseView(purchase),
          balances,
          monetization
        }
      });
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === "42P01") {
        reply.code(503).send({ success: false, error: "monetization_tables_missing" });
        return;
      }
      if (err.code === "23505") {
        reply.code(409).send({ success: false, error: "idempotency_conflict" });
        return;
      }
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.post(
  "/webapp/api/v2/admin/monetization/fee-event",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig", "event_ref", "fee_kind", "gross_amount", "fee_amount", "fee_currency"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          event_ref: { type: "string", minLength: 6, maxLength: 128 },
          fee_kind: { type: "string", minLength: 2, maxLength: 40 },
          gross_amount: { type: "number", minimum: 0 },
          fee_amount: { type: "number", minimum: 0 },
          fee_currency: { type: "string", minLength: 2, maxLength: 8 },
          user_id: { type: "integer", minimum: 1 },
          payload_json: { type: "object" }
        }
      }
    }
  },
  async (request, reply) => {
    const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
    if (!auth.ok) {
      reply.code(401).send({ success: false, error: auth.reason });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const adminProfile = await requireWebAppAdmin(client, reply, auth.uid);
      if (!adminProfile) {
        await client.query("ROLLBACK");
        return;
      }
      const featureFlags = await loadFeatureFlags(client);
      if (!isFeatureEnabled(featureFlags, "MONETIZATION_CORE_V1_ENABLED")) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "monetization_feature_disabled" });
        return;
      }
      const tables = await hasMonetizationTables(client);
      if (!tables.all) {
        await client.query("ROLLBACK");
        reply.code(503).send({ success: false, error: "monetization_tables_missing" });
        return;
      }

      const eventRef = String(request.body.event_ref || "").trim();
      const targetUserId = Number(request.body.user_id || adminProfile.user_id || 0);
      const feeCurrency = normalizeMonetizationCurrency(request.body.fee_currency, "SC");
      const payloadJson = request.body.payload_json && typeof request.body.payload_json === "object"
        ? request.body.payload_json
        : {};
      const inserted = await client.query(
        `INSERT INTO v5_marketplace_fee_events (
           event_ref,
           user_id,
           fee_kind,
           gross_amount,
           fee_amount,
           fee_currency,
           payload_json
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
         RETURNING event_ref, user_id, fee_kind, gross_amount, fee_amount, fee_currency, payload_json, created_at;`,
        [
          eventRef,
          targetUserId,
          String(request.body.fee_kind || ""),
          Math.max(0, Number(request.body.gross_amount || 0)),
          Math.max(0, Number(request.body.fee_amount || 0)),
          feeCurrency,
          JSON.stringify(payloadJson)
        ]
      );
      const row = inserted.rows?.[0] || null;
      await client.query(
        `INSERT INTO admin_audit (admin_id, action, target, payload_json)
         VALUES ($1, 'monetization_fee_event', $2, $3::jsonb);`,
        [
          Number(auth.uid),
          `fee_event:${eventRef}`,
          JSON.stringify({
            user_id: targetUserId,
            fee_kind: String(request.body.fee_kind || ""),
            fee_amount: Math.max(0, Number(request.body.fee_amount || 0)),
            fee_currency: feeCurrency
          })
        ]
      );
      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: {
          api_version: "v2",
          event: {
            event_ref: String(row?.event_ref || eventRef),
            user_id: Number(row?.user_id || targetUserId),
            fee_kind: String(row?.fee_kind || request.body.fee_kind || ""),
            gross_amount: Number(row?.gross_amount || request.body.gross_amount || 0),
            fee_amount: Number(row?.fee_amount || request.body.fee_amount || 0),
            fee_currency: String(row?.fee_currency || feeCurrency),
            created_at: row?.created_at || new Date().toISOString()
          }
        }
      });
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === "42P01") {
        reply.code(503).send({ success: false, error: "monetization_tables_missing" });
        return;
      }
      if (err.code === "23505") {
        reply.code(409).send({ success: false, error: "idempotency_conflict" });
        return;
      }
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.get("/webapp/api/telemetry/perf-profile", async (request, reply) => {
  const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
  if (!auth.ok) {
    reply.code(401).send({ success: false, error: auth.reason });
    return;
  }
  const deviceHash = String(request.query.device_hash || "").trim();
  const client = await pool.connect();
  try {
    const profile = await getProfileByTelegram(client, auth.uid);
    if (!profile) {
      reply.code(404).send({ success: false, error: "user_not_started" });
      return;
    }
    const pref = await webappStore.getUserUiPrefs(client, profile.user_id);
    const perf = await webappStore.getLatestPerfProfile(client, profile.user_id, deviceHash);
    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data: {
        perf_profile: perf || null,
        ui_prefs:
          pref || {
            ui_mode: "hardcore",
            quality_mode: "auto",
            reduced_motion: false,
            large_text: false,
            sound_enabled: true
          }
      }
    });
  } catch (err) {
    if (err.code === "42P01") {
      reply.code(503).send({ success: false, error: "perf_profile_tables_missing" });
      return;
    }
    throw err;
  } finally {
    client.release();
  }
});

fastify.post(
  "/webapp/api/telemetry/perf-profile",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          device_hash: { type: "string", minLength: 3, maxLength: 128 },
          ui_mode: { type: "string" },
          quality_mode: { type: "string" },
          reduced_motion: { type: "boolean" },
          large_text: { type: "boolean" },
          sound_enabled: { type: "boolean" },
          platform: { type: "string" },
          gpu_tier: { type: "string" },
          cpu_tier: { type: "string" },
          memory_tier: { type: "string" },
          fps_avg: { type: "number" },
          frame_time_ms: { type: "number" },
          latency_avg_ms: { type: "number" },
          dropped_frames: { type: "integer" },
          gpu_time_ms: { type: "number" },
          cpu_time_ms: { type: "number" },
          profile_json: { type: "object" }
        }
      }
    }
  },
  async (request, reply) => {
    const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
    if (!auth.ok) {
      reply.code(401).send({ success: false, error: auth.reason });
      return;
    }
    const deviceHash = String(request.body.device_hash || "").trim() || "unknown";
    const uiModeRaw = String(request.body.ui_mode || "hardcore").toLowerCase();
    const qualityRaw = String(request.body.quality_mode || "auto").toLowerCase();
    const uiMode = ["hardcore", "standard", "minimal"].includes(uiModeRaw) ? uiModeRaw : "hardcore";
    const qualityMode = ["auto", "high", "normal", "low"].includes(qualityRaw) ? qualityRaw : "auto";

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const profile = await getProfileByTelegram(client, auth.uid);
      if (!profile) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "user_not_started" });
        return;
      }

      const perf = await webappStore.upsertDevicePerfProfile(client, {
        userId: profile.user_id,
        deviceHash,
        platform: String(request.body.platform || ""),
        gpuTier: String(request.body.gpu_tier || "unknown"),
        cpuTier: String(request.body.cpu_tier || "unknown"),
        memoryTier: String(request.body.memory_tier || "unknown"),
        fpsAvg: Number(request.body.fps_avg || 0),
        frameTimeMs: Number(request.body.frame_time_ms || 0),
        latencyAvgMs: Number(request.body.latency_avg_ms || 0),
        profileJson: request.body.profile_json || {}
      });
      const prefs = await webappStore.upsertUserUiPrefs(client, {
        userId: profile.user_id,
        uiMode,
        qualityMode,
        reducedMotion: Boolean(request.body.reduced_motion),
        largeText: Boolean(request.body.large_text),
        soundEnabled: request.body.sound_enabled !== false,
        prefsJson: {
          device_hash: deviceHash
        }
      });
      await webappStore.insertRenderQualitySnapshot(client, {
        userId: profile.user_id,
        deviceHash,
        qualityMode,
        fpsAvg: Number(request.body.fps_avg || 0),
        droppedFrames: Number(request.body.dropped_frames || 0),
        gpuTimeMs: Number(request.body.gpu_time_ms || 0),
        cpuTimeMs: Number(request.body.cpu_time_ms || 0),
        snapshotJson: {
          frame_time_ms: Number(request.body.frame_time_ms || 0),
          latency_avg_ms: Number(request.body.latency_avg_ms || 0),
          profile_json: request.body.profile_json || {}
        }
      });
      await webappStore
        .insertCombatFrameStat(client, {
          userId: profile.user_id,
          sessionRef: String(request.body.profile_json?.session_ref || ""),
          mode: String(request.body.profile_json?.mode || "combat"),
          deviceHash,
          fpsAvg: Number(request.body.fps_avg || 0),
          frameTimeMs: Number(request.body.frame_time_ms || 0),
          droppedFrames: Number(request.body.dropped_frames || 0),
          gpuTimeMs: Number(request.body.gpu_time_ms || 0),
          cpuTimeMs: Number(request.body.cpu_time_ms || 0),
          statsJson: {
            quality_mode: qualityMode,
            perf_tier: request.body.profile_json?.perf_tier || "normal"
          }
        })
        .catch((err) => {
          if (err.code !== "42P01") {
            throw err;
          }
        });
      await webappStore
        .insertCombatNetStat(client, {
          userId: profile.user_id,
          sessionRef: String(request.body.profile_json?.session_ref || ""),
          mode: String(request.body.profile_json?.mode || "combat"),
          transport: String(request.body.profile_json?.transport || "poll"),
          tickMs: Number(request.body.profile_json?.tick_ms || 1000),
          actionWindowMs: Number(request.body.profile_json?.action_window_ms || 800),
          rttMs: Number(request.body.latency_avg_ms || 0),
          jitterMs: Number(request.body.profile_json?.jitter_ms || 0),
          packetLossPct: Number(request.body.profile_json?.packet_loss_pct || 0),
          acceptedActions: Number(request.body.profile_json?.accepted_actions || 0),
          rejectedActions: Number(request.body.profile_json?.rejected_actions || 0),
          statsJson: {
            source: "perf_profile_post"
          }
        })
        .catch((err) => {
          if (err.code !== "42P01") {
            throw err;
          }
        });
      await webappStore
        .insertUiInteractionEvent(client, {
          userId: profile.user_id,
          eventKey: "perf_profile_post",
          eventName: "perf_profile_post",
          eventScope: "webapp",
          eventValue: qualityMode,
          eventJson: {
            device_hash: deviceHash,
            ui_mode: uiMode,
            reduced_motion: Boolean(request.body.reduced_motion),
            large_text: Boolean(request.body.large_text)
          }
        })
        .catch((err) => {
          if (err.code !== "42P01") {
            throw err;
          }
        });
      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: {
          perf_profile: perf,
          ui_prefs: prefs
        }
      });
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === "42P01") {
        reply.code(503).send({ success: false, error: "perf_profile_tables_missing" });
        return;
      }
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.get("/webapp/api/scene/profile", async (request, reply) => {
  const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
  if (!auth.ok) {
    reply.code(401).send({ success: false, error: auth.reason });
    return;
  }
  const sceneKey = String(request.query.scene_key || "nexus_arena").trim() || "nexus_arena";
  const client = await pool.connect();
  try {
    const profile = await getProfileByTelegram(client, auth.uid);
    if (!profile) {
      reply.code(404).send({ success: false, error: "user_not_started" });
      return;
    }
    const sceneProfile = await readSceneProfile(client, profile.user_id, sceneKey);
    const perfProfile = await webappStore.getLatestPerfProfile(client, profile.user_id).catch((err) => {
      if (err.code === "42P01") return null;
      throw err;
    });
    const uiPrefs = await webappStore.getUserUiPrefs(client, profile.user_id).catch((err) => {
      if (err.code === "42P01") return null;
      throw err;
    });
    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data: {
        scene_profile: sceneProfile,
        perf_profile: perfProfile,
        ui_prefs: uiPrefs
      }
    });
  } finally {
    client.release();
  }
});

fastify.post(
  "/webapp/api/scene/profile",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          scene_key: { type: "string", minLength: 3, maxLength: 80 },
          scene_mode: { type: "string", enum: ["pro", "lite", "cinematic", "minimal"] },
          perf_profile: { type: "string", enum: ["low", "normal", "high"] },
          quality_mode: { type: "string", enum: ["auto", "low", "normal", "high"] },
          reduced_motion: { type: "boolean" },
          large_text: { type: "boolean" },
          motion_intensity: { type: "number", minimum: 0.25, maximum: 2 },
          postfx_level: { type: "number", minimum: 0, maximum: 2.5 },
          hud_density: { type: "string", enum: ["compact", "full", "extended"] },
          prefs_json: { type: "object" }
        }
      }
    }
  },
  async (request, reply) => {
    const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
    if (!auth.ok) {
      reply.code(401).send({ success: false, error: auth.reason });
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const profile = await getProfileByTelegram(client, auth.uid);
      if (!profile) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "user_not_started" });
        return;
      }
      const sceneKey = String(request.body.scene_key || "nexus_arena").trim() || "nexus_arena";
      const current = await readSceneProfile(client, profile.user_id, sceneKey);
      const next = {
        user_id: profile.user_id,
        scene_key: sceneKey,
        scene_mode: request.body.scene_mode || current.scene_mode,
        perf_profile: request.body.perf_profile || current.perf_profile,
        quality_mode: request.body.quality_mode || current.quality_mode,
        reduced_motion:
          typeof request.body.reduced_motion === "boolean" ? request.body.reduced_motion : current.reduced_motion,
        large_text: typeof request.body.large_text === "boolean" ? request.body.large_text : current.large_text,
        motion_intensity:
          Number.isFinite(Number(request.body.motion_intensity))
            ? Number(request.body.motion_intensity)
            : current.motion_intensity,
        postfx_level:
          Number.isFinite(Number(request.body.postfx_level)) ? Number(request.body.postfx_level) : current.postfx_level,
        hud_density: request.body.hud_density || current.hud_density,
        prefs_json: request.body.prefs_json || {}
      };
      const saved = await upsertSceneProfile(client, next);
      await webappStore
        .upsertUserUiPrefs(client, {
          userId: profile.user_id,
          uiMode:
            saved.scene_mode === "minimal" ? "minimal" : saved.scene_mode === "lite" ? "standard" : "hardcore",
          qualityMode: saved.quality_mode,
          reducedMotion: Boolean(saved.reduced_motion),
          largeText: Boolean(saved.large_text),
          soundEnabled: true,
          prefsJson: {
            scene_key: saved.scene_key,
            source: "scene_profile_post"
          }
        })
        .catch((err) => {
          if (err.code !== "42P01") {
            throw err;
          }
        });
      await webappStore
        .insertUiInteractionEvent(client, {
          userId: profile.user_id,
          eventKey: "scene_profile_update",
          eventName: "scene_profile_update",
          eventScope: "webapp",
          eventValue: saved.scene_mode,
          eventJson: {
            scene_key: saved.scene_key,
            perf_profile: saved.perf_profile,
            quality_mode: saved.quality_mode
          }
        })
        .catch((err) => {
          if (err.code !== "42P01") {
            throw err;
          }
        });
      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: {
          scene_profile: {
            ...saved,
            source: "db"
          }
        }
      });
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === "42P01") {
        reply.code(503).send({ success: false, error: "scene_profile_tables_missing" });
        return;
      }
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.get("/webapp/api/scene/profile/effective", async (request, reply) => {
  const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
  if (!auth.ok) {
    reply.code(401).send({ success: false, error: auth.reason });
    return;
  }
  const sceneKey = String(request.query.scene_key || "nexus_arena").trim() || "nexus_arena";
  const client = await pool.connect();
  try {
    const profile = await getProfileByTelegram(client, auth.uid);
    if (!profile) {
      reply.code(404).send({ success: false, error: "user_not_started" });
      return;
    }
    const computed = await computeSceneEffectiveProfile(client, {
      userId: profile.user_id,
      sceneKey,
      persist: true,
      forceRefresh: false,
      persistSource: "scene_profile_effective"
    });

    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data: computed
    });
  } finally {
    client.release();
  }
});

fastify.get("/webapp/api/assets/manifest/active", async (request, reply) => {
  const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
  if (!auth.ok) {
    reply.code(401).send({ success: false, error: auth.reason });
    return;
  }
  const includeEntries = String(request.query.include_entries || "1") !== "0";
  const entryLimit = Math.max(1, Math.min(800, Number(request.query.limit || 400)));
  const client = await pool.connect();
  try {
    const profile = await getProfileByTelegram(client, auth.uid);
    if (!profile) {
      reply.code(404).send({ success: false, error: "user_not_started" });
      return;
    }
    const manifest = await readActiveAssetManifest(client, { includeEntries, entryLimit });
    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data: manifest
    });
  } finally {
    client.release();
  }
});

fastify.post(
  "/webapp/api/tasks/reroll",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig", "request_id"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          request_id: { type: "string", minLength: 6, maxLength: 80 }
        }
      }
    }
  },
  async (request, reply) => {
    const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
    if (!auth.ok) {
      reply.code(401).send({ success: false, error: auth.reason });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const profile = await getProfileByTelegram(client, auth.uid);
      if (!profile) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "user_not_started" });
        return;
      }

      const refEventId = deterministicUuid(`webapp_reroll:${profile.user_id}:${request.body.request_id}`);
      const debit = await client.query(
        `WITH ins AS (
          INSERT INTO currency_ledger (user_id, currency, delta, reason, ref_event_id, meta_json)
          VALUES ($1, 'RC', -1, 'webapp_task_reroll', $2, $3::jsonb)
          ON CONFLICT DO NOTHING
          RETURNING id
        )
        SELECT count(*)::int AS inserted FROM ins;`,
        [profile.user_id, refEventId, JSON.stringify({ source: "webapp" })]
      );
      const inserted = Number(debit.rows[0]?.inserted || 0);

      if (inserted > 0) {
        const lockedBalance = await client.query(
          `SELECT balance
           FROM currency_balances
           WHERE user_id = $1
             AND currency = 'RC'
           FOR UPDATE;`,
          [profile.user_id]
        );
        const rcBalance = Number(lockedBalance.rows[0]?.balance || 0);
        if (rcBalance < 1) {
          await client.query(
            `DELETE FROM currency_ledger
             WHERE ref_event_id = $1;`,
            [refEventId]
          );
          await client.query("ROLLBACK");
          reply.code(409).send({ success: false, error: "insufficient_rc" });
          return;
        }
        await client.query(
          `UPDATE currency_balances
           SET balance = balance - 1,
               updated_at = now()
           WHERE user_id = $1
             AND currency = 'RC';`,
          [profile.user_id]
        );
      }

      await client.query(
        `UPDATE task_offers
         SET offer_state = 'consumed'
         WHERE user_id = $1
           AND offer_state = 'offered';`,
        [profile.user_id]
      );

      const riskRes = await client.query(
        `SELECT risk_score
         FROM risk_scores
         WHERE user_id = $1
         LIMIT 1;`,
        [profile.user_id]
      );
      const risk = Number(riskRes.rows[0]?.risk_score || 0);
      const picks = taskCatalog.pickTasks(3, [], {
        kingdomTier: Number(profile.kingdom_tier || 0),
        risk
      });
      const created = [];
      for (const task of picks) {
        const seed = crypto.randomBytes(8).toString("hex");
        const insertedOffer = await client.query(
          `INSERT INTO task_offers (user_id, task_type, difficulty, expires_at, offer_state, seed)
           VALUES ($1, $2, $3, now() + make_interval(mins => $4), 'offered', $5)
           RETURNING id, task_type, difficulty, expires_at;`,
          [profile.user_id, task.id, task.difficulty, task.durationMinutes, seed]
        );
        created.push(insertedOffer.rows[0]);
      }

      await client.query(
        `INSERT INTO behavior_events (user_id, event_type, meta_json)
         VALUES ($1, 'webapp_reroll', $2::jsonb);`,
        [profile.user_id, JSON.stringify({ request_id: request.body.request_id })]
      );

      const balancesRes = await client.query(
        `SELECT currency, balance
         FROM currency_balances
         WHERE user_id = $1;`,
        [profile.user_id]
      );

      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: {
          balances: normalizeBalances(balancesRes.rows),
          offers: mapOffers(created)
        }
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.post(
  "/webapp/api/actions/accept",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig", "offer_id"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          offer_id: { type: "integer", minimum: 1 }
        }
      }
    }
  },
  async (request, reply) => {
    const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
    if (!auth.ok) {
      reply.code(401).send({ success: false, error: auth.reason });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const profile = await getProfileByTelegram(client, auth.uid);
      if (!profile) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "user_not_started" });
        return;
      }

      const freeze = await getFreezeState(client);
      if (freeze.freeze) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "freeze_mode", reason: freeze.reason });
        return;
      }

      const offerId = Number(request.body.offer_id || 0);
      const offer = await taskStore.lockOfferForAccept(client, profile.user_id, offerId);
      if (!offer) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "offer_not_found" });
        return;
      }

      const now = Date.now();
      const expiresAt = offer.expires_at ? new Date(offer.expires_at).getTime() : 0;
      if (offer.offer_state !== "offered" || (expiresAt > 0 && expiresAt <= now)) {
        const existingAttempt = await taskStore.getAttemptByOffer(client, profile.user_id, offer.id);
        const runtimeConfig = await configService.getEconomyConfig(client);
        const snapshot = await buildActionSnapshot(client, profile, runtimeConfig);
        await client.query("COMMIT");
        reply.send({
          success: true,
          session: issueWebAppSession(auth.uid),
          data: {
            duplicate: true,
            offer_state: offer.offer_state,
            attempt: existingAttempt
              ? mapAttempt({
                  id: existingAttempt.id,
                  task_offer_id: offer.id,
                  task_type: offer.task_type,
                  difficulty: offer.difficulty,
                  result: existingAttempt.result,
                  started_at: existingAttempt.started_at || null,
                  completed_at: existingAttempt.completed_at || null
                })
              : null,
            snapshot
          }
        });
        return;
      }

      await taskStore.markOfferAccepted(client, offer.id);
      const attempt = await taskStore.createAttempt(client, profile.user_id, offer.id);
      await riskStore.insertBehaviorEvent(client, profile.user_id, "webapp_task_accept", {
        offer_id: offer.id,
        task_type: offer.task_type
      });

      const runtimeConfig = await configService.getEconomyConfig(client);
      const snapshot = await buildActionSnapshot(client, profile, runtimeConfig);
      await client.query("COMMIT");

      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: {
          duplicate: false,
          attempt: mapAttempt({
            id: attempt.id,
            task_offer_id: offer.id,
            task_type: offer.task_type,
            difficulty: offer.difficulty,
            result: attempt.result,
            started_at: attempt.started_at || null,
            completed_at: null
          }),
          snapshot
        }
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.post(
  "/webapp/api/actions/complete",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          attempt_id: { type: "integer", minimum: 1 },
          mode: { type: "string" }
        }
      }
    }
  },
  async (request, reply) => {
    const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
    if (!auth.ok) {
      reply.code(401).send({ success: false, error: auth.reason });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const profile = await getProfileByTelegram(client, auth.uid);
      if (!profile) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "user_not_started" });
        return;
      }
      const runtimeConfig = await configService.getEconomyConfig(client);
      const season = seasonStore.getSeasonInfo(runtimeConfig);
      const anomaly = nexusEventEngine.resolveDailyAnomaly(runtimeConfig, {
        seasonId: season.seasonId
      });
      const contract = nexusContractEngine.resolveDailyContract(runtimeConfig, {
        seasonId: season.seasonId,
        anomalyId: anomaly.id
      });
      const freeze = await getFreezeState(client);
      if (freeze.freeze) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "freeze_mode", reason: freeze.reason });
        return;
      }

      let attemptId = Number(request.body.attempt_id || 0);
      if (!attemptId) {
        const latest = await taskStore.getLatestPendingAttempt(client, profile.user_id);
        attemptId = Number(latest?.id || 0);
      }
      if (!attemptId) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "no_pending_attempt" });
        return;
      }

      const mode = getPlayMode(request.body.mode);
      const lockedAttempt = await taskStore.lockAttempt(client, profile.user_id, attemptId);
      if (!lockedAttempt) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "attempt_not_found" });
        return;
      }

      if (lockedAttempt.result !== "pending") {
        await antiAbuseEngine.applyRiskEvent(client, riskStore, runtimeConfig, {
          userId: profile.user_id,
          eventType: "callback_duplicate",
          context: { attemptId, where: "webapp_complete" }
        });
        const recentResults = await taskStore.getRecentAttemptResults(client, profile.user_id, 6);
        const combo = computeCombo(recentResults);
        const snapshot = await buildActionSnapshot(client, profile, runtimeConfig);
        await client.query("COMMIT");
        reply.send({
          success: true,
          session: issueWebAppSession(auth.uid),
          data: {
            duplicate: true,
            attempt_id: attemptId,
            result: lockedAttempt.result,
            combo,
            mode: mode.key,
            mode_label: mode.label,
            nexus: nexusEventEngine.publicAnomalyView(anomaly),
            contract: nexusContractEngine.publicContractView(contract),
            snapshot
          }
        });
        return;
      }

      const offer = await taskStore.getOffer(client, profile.user_id, lockedAttempt.task_offer_id);
      if (!offer) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "offer_not_found" });
        return;
      }
      const task = taskCatalog.getTaskById(offer.task_type) || { difficulty: Number(offer.difficulty || 0.4) };
      const taskFamily = String(task.family || "core").toLowerCase();
      const baseDifficulty = Number(task.difficulty || offer.difficulty || 0.4);
      const safeDifficulty = economyEngine.clamp(baseDifficulty + mode.difficultyDelta, 0, 1);
      const risk = (await riskStore.getRiskState(client, profile.user_id)).riskScore;
      const effectiveRisk = nexusEventEngine.applyRiskShift(risk, anomaly);
      const probabilities = economyEngine.getTaskProbabilities(runtimeConfig, {
        difficulty: safeDifficulty,
        streak: Number(profile.current_streak || 0),
        risk: effectiveRisk
      });
      const roll = economyEngine.rollTaskResult(probabilities);
      const durationSec = Math.max(0, Math.floor((Date.now() - new Date(lockedAttempt.started_at).getTime()) / 1000));
      const qualityScore = Number((0.55 + Math.random() * 0.4).toFixed(3));
      const contractEval = nexusContractEngine.evaluateAttempt(contract, {
        modeKey: mode.key,
        family: taskFamily,
        result: roll.result
      });

      const completed = await taskStore.completeAttemptIfPending(client, attemptId, roll.result, qualityScore, {
        duration_sec: durationSec,
        base_difficulty: baseDifficulty,
        effective_difficulty: safeDifficulty,
        probability_success: probabilities.pSuccess,
        roll: roll.roll,
        play_mode: mode.key,
        play_mode_label: mode.label,
        play_mode_reward_multiplier: mode.rewardMultiplier,
        nexus_anomaly_id: anomaly.id,
        nexus_anomaly_title: anomaly.title,
        nexus_risk_shift: Number(anomaly.risk_shift || 0),
        nexus_contract_id: contract.id,
        nexus_contract_title: contract.title,
        nexus_contract_mode_required: contract.required_mode,
        nexus_contract_family: taskFamily,
        nexus_contract_match: contractEval.matched
      });

      if (!completed) {
        const current = await taskStore.getAttempt(client, profile.user_id, attemptId);
        const recentResults = await taskStore.getRecentAttemptResults(client, profile.user_id, 6);
        const snapshot = await buildActionSnapshot(client, profile, runtimeConfig);
        await client.query("COMMIT");
        reply.send({
          success: true,
          session: issueWebAppSession(auth.uid),
          data: {
            duplicate: true,
            attempt_id: attemptId,
            result: current?.result || "pending",
            combo: computeCombo(recentResults),
            mode: mode.key,
            mode_label: mode.label,
            nexus: nexusEventEngine.publicAnomalyView(anomaly),
            contract: nexusContractEngine.publicContractView(contract),
            snapshot
          }
        });
        return;
      }

      await taskStore.markOfferConsumed(client, lockedAttempt.task_offer_id);
      await economyStore.incrementDailyTasks(client, profile.user_id, 1);
      const recentResults = await taskStore.getRecentAttemptResults(client, profile.user_id, 6);
      const combo = computeCombo(recentResults);
      const contractFinalEval = nexusContractEngine.evaluateAttempt(contract, {
        modeKey: mode.key,
        family: taskFamily,
        result: roll.result,
        combo
      });

      await antiAbuseEngine.applyRiskEvent(client, riskStore, runtimeConfig, {
        userId: profile.user_id,
        eventType: "task_complete",
        context: { attemptId, durationSec, result: roll.result, play_mode: mode.key, combo }
      });
      await riskStore.insertBehaviorEvent(client, profile.user_id, "webapp_task_complete", {
        attempt_id: attemptId,
        result: roll.result,
        play_mode: mode.key,
        combo,
        nexus_contract_id: contract.id,
        nexus_contract_match: Boolean(contractFinalEval.matched)
      });

      const snapshot = await buildActionSnapshot(client, profile, runtimeConfig);
      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: {
          duplicate: false,
          attempt_id: attemptId,
          result: roll.result,
          probabilities: {
            p_success: probabilities.pSuccess,
            p_near_miss: probabilities.pNearMiss,
            p_fail: probabilities.pFail
          },
          mode: mode.key,
          mode_label: mode.label,
          nexus: nexusEventEngine.publicAnomalyView(anomaly),
          contract: nexusContractEngine.publicContractView(contract, contractFinalEval),
          combo,
          snapshot
        }
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.post(
  "/webapp/api/actions/reveal",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          attempt_id: { type: "integer", minimum: 1 }
        }
      }
    }
  },
  async (request, reply) => {
    const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
    if (!auth.ok) {
      reply.code(401).send({ success: false, error: auth.reason });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const profile = await getProfileByTelegram(client, auth.uid);
      if (!profile) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "user_not_started" });
        return;
      }
      const runtimeConfig = await configService.getEconomyConfig(client);
      const season = seasonStore.getSeasonInfo(runtimeConfig);
      const anomaly = nexusEventEngine.resolveDailyAnomaly(runtimeConfig, {
        seasonId: season.seasonId
      });
      const contract = nexusContractEngine.resolveDailyContract(runtimeConfig, {
        seasonId: season.seasonId,
        anomalyId: anomaly.id
      });
      const freeze = await getFreezeState(client);
      if (freeze.freeze) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "freeze_mode", reason: freeze.reason });
        return;
      }

      let attemptId = Number(request.body.attempt_id || 0);
      if (!attemptId) {
        const latest = await taskStore.getLatestRevealableAttempt(client, profile.user_id);
        attemptId = Number(latest?.id || 0);
      }
      if (!attemptId) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "no_revealable_attempt" });
        return;
      }

      await antiAbuseEngine.applyRiskEvent(client, riskStore, runtimeConfig, {
        userId: profile.user_id,
        eventType: "callback_reveal",
        context: { attemptId, source: "webapp" }
      });

      const attempt = await taskStore.lockAttempt(client, profile.user_id, attemptId);
      if (!attempt || attempt.result === "pending") {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "attempt_not_ready" });
        return;
      }

      const existingLoot = await taskStore.getLoot(client, attemptId);
      if (existingLoot) {
        await antiAbuseEngine.applyRiskEvent(client, riskStore, runtimeConfig, {
          userId: profile.user_id,
          eventType: "reveal_duplicate",
          context: { attemptId, source: "webapp" }
        });
        const currentProfile = (await getProfileByTelegram(client, auth.uid)) || profile;
        const snapshot = await buildActionSnapshot(client, currentProfile, runtimeConfig);
        await client.query("COMMIT");
        reply.send({
          success: true,
          session: issueWebAppSession(auth.uid),
          data: {
            duplicate: true,
            attempt_id: attemptId,
            tier: existingLoot.loot_tier,
            reward: parseRewardFromMeta(existingLoot.rng_rolls_json, existingLoot.loot_tier),
            pity_after: Number(existingLoot.pity_counter_after || 0),
            mode_label: existingLoot.rng_rolls_json?.play_mode_label || "Dengeli",
            combo: Number(existingLoot.rng_rolls_json?.combo_count || 0),
            nexus: nexusEventEngine.publicAnomalyView(anomaly),
            contract: nexusContractEngine.publicContractView(contract, existingLoot.rng_rolls_json?.nexus_contract_eval || null),
            snapshot
          }
        });
        return;
      }

      const offer = await taskStore.getOffer(client, profile.user_id, attempt.task_offer_id);
      if (!offer) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "offer_not_found" });
        return;
      }

      const task = taskCatalog.getTaskById(offer.task_type);
      const taskFamily = String(task?.family || "core").toLowerCase();
      const difficulty = Number(offer.difficulty || 0.4);
      const dailyRaw = await economyStore.getTodayCounter(client, profile.user_id);
      const activeEffects = await shopStore.getActiveEffects(client, profile.user_id);
      const playMode = getPlayMode(attempt.anti_abuse_flags?.play_mode || "balanced");
      const pityCap = Number(runtimeConfig.economy?.hc?.pity_cap || 40);
      const recentTiers = await taskStore.getRecentLootTiers(client, profile.user_id, pityCap);
      const recentResults = await taskStore.getRecentAttemptResults(client, profile.user_id, 12);
      const combo = computeCombo(recentResults);
      const pityBefore = calculatePityBefore(recentTiers);
      const risk = (await riskStore.getRiskState(client, profile.user_id)).riskScore;
      const effectiveRisk = nexusEventEngine.applyRiskShift(risk, anomaly);

      const outcome = economyEngine.computeRevealOutcome(runtimeConfig, {
        attemptResult: attempt.result,
        difficulty,
        streak: Number(profile.current_streak || 0),
        kingdomTier: Number(profile.kingdom_tier || 0),
        risk: effectiveRisk,
        dailyTasks: Number(dailyRaw.tasks_done || 0),
        pityBefore
      });

      const modeAdjustedReward = applyPlayModeToReward(outcome.reward, playMode);
      const boostedReward = shopStore.applyEffectsToReward(modeAdjustedReward, activeEffects);
      const comboAdjusted = applyComboToReward(boostedReward, combo);
      const hiddenBonus = hiddenBonusForAttempt(attemptId, playMode.key, attempt.result);
      const hiddenAdjusted = hiddenBonus.hit ? mergeRewards(comboAdjusted.reward, hiddenBonus.bonus) : comboAdjusted.reward;
      const anomalyAdjusted = nexusEventEngine.applyAnomalyToReward(hiddenAdjusted, anomaly, {
        modeKey: playMode.key
      });
      const contractEval = nexusContractEngine.evaluateAttempt(contract, {
        modeKey: playMode.key,
        family: taskFamily,
        result: attempt.result,
        combo
      });
      const contractAdjusted = nexusContractEngine.applyContractToReward(anomalyAdjusted.reward, contractEval);
      const reward = contractAdjusted.reward;
      const boostLevel = shopStore.getScBoostMultiplier(activeEffects);

      const createdLoot = await taskStore.createLoot(client, {
        userId: profile.user_id,
        attemptId,
        lootTier: outcome.tier,
        pityBefore,
        pityAfter: outcome.pityAfter,
        rng: {
          reward,
          tier: outcome.tier,
          forced_pity: outcome.forcedPity,
          loot_roll: outcome.lootRoll,
          play_mode: playMode.key,
          play_mode_label: playMode.label,
          play_mode_reward_multiplier: playMode.rewardMultiplier,
          combo_count: combo,
          combo_multiplier: comboAdjusted.multiplier,
          effect_sc_boost: boostLevel,
          hidden_bonus_hit: hiddenBonus.hit,
          hidden_bonus_roll: hiddenBonus.roll,
          hidden_bonus_threshold: hiddenBonus.threshold,
          hidden_bonus: hiddenBonus.bonus,
          nexus_anomaly_id: anomaly.id,
          nexus_anomaly_title: anomaly.title,
          nexus_risk_shift: Number(anomaly.risk_shift || 0),
          nexus_reward_modifiers: anomalyAdjusted.modifiers,
          nexus_contract_id: contract.id,
          nexus_contract_title: contract.title,
          nexus_contract_required_mode: contract.required_mode,
          nexus_contract_family: taskFamily,
          nexus_contract_objective: contract.objective,
          nexus_contract_eval: contractEval,
          nexus_contract_reward_modifiers: contractAdjusted.modifiers,
          hard_currency_probability: outcome.hardCurrency.pHC,
          pity_bonus: outcome.hardCurrency.pityBonus,
          fatigue: outcome.fatigue,
          daily_cap: outcome.dailyCap
        }
      });

      const loot = createdLoot || (await taskStore.getLoot(client, attemptId));
      if (!createdLoot && loot) {
        const currentProfile = (await getProfileByTelegram(client, auth.uid)) || profile;
        const snapshot = await buildActionSnapshot(client, currentProfile, runtimeConfig);
        await client.query("COMMIT");
        reply.send({
          success: true,
          session: issueWebAppSession(auth.uid),
          data: {
            duplicate: true,
            attempt_id: attemptId,
            tier: loot.loot_tier,
            reward: parseRewardFromMeta(loot.rng_rolls_json, loot.loot_tier),
            pity_after: Number(loot.pity_counter_after || 0),
            mode_label: loot.rng_rolls_json?.play_mode_label || playMode.label,
            combo: Number(loot.rng_rolls_json?.combo_count || combo),
            nexus: nexusEventEngine.publicAnomalyView(anomaly),
            contract: nexusContractEngine.publicContractView(contract, loot.rng_rolls_json?.nexus_contract_eval || contractEval),
            snapshot
          }
        });
        return;
      }

      const rewardEventIds = {
        SC: deterministicUuid(`reveal:${attemptId}:SC`),
        HC: deterministicUuid(`reveal:${attemptId}:HC`),
        RC: deterministicUuid(`reveal:${attemptId}:RC`)
      };

      await economyStore.creditReward(client, {
        userId: profile.user_id,
        reward,
        reason: `loot_reveal_${outcome.tier}`,
        meta: { attemptId, tier: outcome.tier },
        refEventIds: rewardEventIds
      });

      await userStore.touchStreakOnAction(client, {
        userId: profile.user_id,
        decayPerDay: Number(runtimeConfig.loops?.meso?.streak_decay_per_day || 1)
      });
      await userStore.addReputation(client, {
        userId: profile.user_id,
        points: Number(reward.rc || 0) + (attempt.result === "success" ? 2 : 1),
        thresholds: runtimeConfig.kingdom?.thresholds
      });

      const baseSeasonPoints = Number(reward.rc || 0) + Number(reward.sc || 0) + Number(reward.hc || 0) * 10;
      const seasonBonus = shopStore.getSeasonBonusMultiplier(activeEffects);
      const seasonPoints = Math.max(
        0,
        Math.round(baseSeasonPoints * (1 + seasonBonus) * Number(anomaly.season_multiplier || 1)) + Number(contractEval.season_bonus || 0)
      );
      await seasonStore.addSeasonPoints(client, {
        userId: profile.user_id,
        seasonId: season.seasonId,
        points: seasonPoints
      });
      await seasonStore.syncIdentitySeasonRank(client, {
        userId: profile.user_id,
        seasonId: season.seasonId
      });

      await riskStore.insertBehaviorEvent(client, profile.user_id, "reveal_result", {
        attempt_id: attemptId,
        tier: outcome.tier,
        play_mode: playMode.key,
        combo,
        season_points: seasonPoints,
        nexus_contract_id: contract.id,
        nexus_contract_match: Boolean(contractEval.matched)
      });

      const warDelta = Math.max(
        1,
        Number(reward.rc || 0) + Math.floor(Number(reward.sc || 0) / 5) + Number(reward.hc || 0) * 2 + Number(contractEval.war_bonus || 0)
      );
      const warCounter = await globalStore.incrementCounter(client, `war_pool_s${season.seasonId}`, warDelta);
      await riskStore.insertBehaviorEvent(client, profile.user_id, "war_contribution", {
        delta: warDelta,
        pool: Number(warCounter.counter_value || 0),
        season_id: season.seasonId
      });

      const nextProfile = (await getProfileByTelegram(client, auth.uid)) || profile;
      const snapshot = await buildActionSnapshot(client, nextProfile, runtimeConfig);
      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: {
          duplicate: false,
          attempt_id: attemptId,
          tier: loot?.loot_tier || outcome.tier,
          reward,
          pity_after: Number(loot?.pity_counter_after || outcome.pityAfter),
          mode_label: playMode.label,
          combo,
          nexus: nexusEventEngine.publicAnomalyView(anomaly),
          contract: nexusContractEngine.publicContractView(contract, contractEval),
          season_points: seasonPoints,
          war_delta: warDelta,
          war_pool: Number(warCounter.counter_value || 0),
          snapshot
        }
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.post(
  "/webapp/api/actions/claim_mission",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig", "mission_key"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          mission_key: { type: "string", minLength: 3, maxLength: 64 }
        }
      }
    }
  },
  async (request, reply) => {
    const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
    if (!auth.ok) {
      reply.code(401).send({ success: false, error: auth.reason });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const profile = await getProfileByTelegram(client, auth.uid);
      if (!profile) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "user_not_started" });
        return;
      }

      const runtimeConfig = await configService.getEconomyConfig(client);
      const freeze = await getFreezeState(client);
      if (freeze.freeze) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "freeze_mode", reason: freeze.reason });
        return;
      }

      const missionKey = String(request.body.mission_key || "").trim().toLowerCase();
      if (!missionKey) {
        await client.query("ROLLBACK");
        reply.code(400).send({ success: false, error: "mission_key_invalid" });
        return;
      }

      const board = await missionStore.getMissionBoard(client, profile.user_id);
      const claim = await missionStore.insertClaimIfEligible(client, {
        userId: profile.user_id,
        missionKey,
        board
      });

      if (claim.status === "claimed") {
        const dayKey = new Date().toISOString().slice(0, 10);
        await economyStore.creditReward(client, {
          userId: profile.user_id,
          reward: claim.mission.reward,
          reason: `mission_claim_${claim.mission.key}`,
          meta: { missionKey: claim.mission.key, day: dayKey, source: "webapp" },
          refEventIds: {
            SC: deterministicUuid(`mission:${profile.user_id}:${dayKey}:${claim.mission.key}:SC`),
            HC: deterministicUuid(`mission:${profile.user_id}:${dayKey}:${claim.mission.key}:HC`),
            RC: deterministicUuid(`mission:${profile.user_id}:${dayKey}:${claim.mission.key}:RC`)
          }
        });
      }

      await riskStore.insertBehaviorEvent(client, profile.user_id, "webapp_mission_claim", {
        mission_key: missionKey,
        status: claim.status
      });

      const missions = await missionStore.getMissionBoard(client, profile.user_id);
      const missionReady = missions.filter((m) => m.completed && !m.claimed).length;
      const missionOpen = missions.filter((m) => !m.claimed).length;
      const snapshot = await buildActionSnapshot(client, profile, runtimeConfig);
      await client.query("COMMIT");

      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: {
          status: claim.status,
          mission: claim.mission || null,
          missions: {
            total: missions.length,
            ready: missionReady,
            open: missionOpen,
            list: missions
          },
          snapshot
        }
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.post(
  "/webapp/api/arena/session/start",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          request_id: { type: "string", minLength: 6, maxLength: 96 },
          mode_suggested: { type: "string" }
        }
      }
    }
  },
  async (request, reply) => {
    const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
    if (!auth.ok) {
      reply.code(401).send({ success: false, error: auth.reason });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const profile = await getProfileByTelegram(client, auth.uid);
      if (!profile) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "user_not_started" });
        return;
      }
      const flags = await loadFeatureFlags(client);
      if (!isFeatureEnabled(flags, "ARENA_AUTH_ENABLED")) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "arena_auth_disabled" });
        return;
      }
      const freeze = await getFreezeState(client);
      if (freeze.freeze) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "freeze_mode", reason: freeze.reason });
        return;
      }
      const runtimeConfig = await configService.getEconomyConfig(client);
      const directorPayload = await arenaService.buildDirectorView(client, { profile, config: runtimeConfig }).catch(() => null);
      const started = await arenaService.startAuthoritativeSession(client, {
        profile,
        config: runtimeConfig,
        requestId: String(request.body.request_id || `webapp:${Date.now()}`),
        modeSuggested: request.body.mode_suggested,
        source: "webapp"
      });
      if (!started.ok) {
        await client.query("ROLLBACK");
        reply.code(arenaSessionErrorCode(started.error)).send({ success: false, error: started.error });
        return;
      }
      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: {
          duplicate: Boolean(started.duplicate),
          session: started.session,
          contract: directorPayload?.contract || null,
          anomaly: directorPayload?.anomaly || null,
          director: directorPayload?.director || null,
          server_tick: Date.now(),
          idempotency_key: started.session?.session_ref || null
        }
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.post(
  "/webapp/api/arena/session/action",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig", "session_ref", "action_seq", "input_action"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          session_ref: { type: "string", minLength: 8, maxLength: 128 },
          action_seq: { type: "integer", minimum: 1 },
          input_action: { type: "string", enum: arenaEngine.SESSION_ACTIONS },
          latency_ms: { type: "integer", minimum: 0 },
          client_ts: { type: "integer", minimum: 0 }
        }
      }
    }
  },
  async (request, reply) => {
    const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
    if (!auth.ok) {
      reply.code(401).send({ success: false, error: auth.reason });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const profile = await getProfileByTelegram(client, auth.uid);
      if (!profile) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "user_not_started" });
        return;
      }
      const flags = await loadFeatureFlags(client);
      if (!isFeatureEnabled(flags, "ARENA_AUTH_ENABLED")) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "arena_auth_disabled" });
        return;
      }
      const freeze = await getFreezeState(client);
      if (freeze.freeze) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "freeze_mode", reason: freeze.reason });
        return;
      }
      const runtimeConfig = await configService.getEconomyConfig(client);
      const directorPayload = await arenaService.buildDirectorView(client, { profile, config: runtimeConfig }).catch(() => null);
      const acted = await arenaService.applyAuthoritativeSessionAction(client, {
        profile,
        config: runtimeConfig,
        sessionRef: String(request.body.session_ref || ""),
        actionSeq: Number(request.body.action_seq || 0),
        inputAction: String(request.body.input_action || ""),
        latencyMs: Number(request.body.latency_ms || 0),
        clientTs: Number(request.body.client_ts || 0),
        source: "webapp"
      });
      if (!acted.ok) {
        await client.query("ROLLBACK");
        reply.code(arenaSessionErrorCode(acted.error)).send({
          success: false,
          error: acted.error,
          min_actions: acted.min_actions || 0,
          action_count: acted.action_count || 0
        });
        return;
      }
      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: {
          ...acted,
          contract: directorPayload?.contract || null,
          anomaly: directorPayload?.anomaly || null,
          director: directorPayload?.director || null,
          server_tick: Date.now(),
          idempotency_key: `${String(request.body.session_ref || "")}:${Number(request.body.action_seq || 0)}`
        }
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.post(
  "/webapp/api/arena/session/resolve",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig", "session_ref"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          session_ref: { type: "string", minLength: 8, maxLength: 128 }
        }
      }
    }
  },
  async (request, reply) => {
    const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
    if (!auth.ok) {
      reply.code(401).send({ success: false, error: auth.reason });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const profile = await getProfileByTelegram(client, auth.uid);
      if (!profile) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "user_not_started" });
        return;
      }
      const flags = await loadFeatureFlags(client);
      if (!isFeatureEnabled(flags, "ARENA_AUTH_ENABLED")) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "arena_auth_disabled" });
        return;
      }
      const freeze = await getFreezeState(client);
      if (freeze.freeze) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "freeze_mode", reason: freeze.reason });
        return;
      }
      const runtimeConfig = await configService.getEconomyConfig(client);
      const directorPayload = await arenaService.buildDirectorView(client, { profile, config: runtimeConfig }).catch(() => null);
      const resolved = await arenaService.resolveAuthoritativeSession(client, {
        profile,
        config: runtimeConfig,
        sessionRef: String(request.body.session_ref || ""),
        source: "webapp"
      });
      if (!resolved.ok) {
        await client.query("ROLLBACK");
        reply.code(arenaSessionErrorCode(resolved.error)).send({
          success: false,
          error: resolved.error,
          min_actions: resolved.min_actions || 0,
          action_count: resolved.action_count || 0
        });
        return;
      }
      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: {
          ...resolved,
          contract: directorPayload?.contract || null,
          anomaly: directorPayload?.anomaly || null,
          director: directorPayload?.director || null,
          server_tick: Date.now(),
          idempotency_key: `${String(request.body.session_ref || "")}:resolve`
        }
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.get("/webapp/api/arena/session/state", async (request, reply) => {
  const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
  if (!auth.ok) {
    reply.code(401).send({ success: false, error: auth.reason });
    return;
  }
  const client = await pool.connect();
  try {
    const profile = await getProfileByTelegram(client, auth.uid);
    if (!profile) {
      reply.code(404).send({ success: false, error: "user_not_started" });
      return;
    }
    const flags = await loadFeatureFlags(client);
    if (!isFeatureEnabled(flags, "ARENA_AUTH_ENABLED")) {
      reply.code(409).send({ success: false, error: "arena_auth_disabled" });
      return;
    }
    const runtimeConfig = await configService.getEconomyConfig(client);
    const directorPayload = await arenaService.buildDirectorView(client, { profile, config: runtimeConfig }).catch(() => null);
    const perfProfile = await webappStore.getLatestPerfProfile(client, profile.user_id, "").catch(() => null);
    const statePayload = await arenaService.getAuthoritativeSessionState(client, {
      profile,
      sessionRef: String(request.query.session_ref || "")
    });
    if (!statePayload.ok) {
      reply.code(arenaSessionErrorCode(statePayload.error)).send({
        success: false,
        error: statePayload.error
      });
      return;
    }
    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data: {
        ...statePayload,
        contract: directorPayload?.contract || null,
        anomaly: directorPayload?.anomaly || null,
        director: directorPayload?.director || null,
        perf_profile: perfProfile,
        idempotency_key: statePayload?.session?.session_ref ? `${statePayload.session.session_ref}:state` : null,
        server_tick: Date.now()
      }
    });
  } finally {
    client.release();
  }
});

fastify.get("/webapp/api/arena/director", async (request, reply) => {
  const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
  if (!auth.ok) {
    reply.code(401).send({ success: false, error: auth.reason });
    return;
  }
  const client = await pool.connect();
  try {
    const profile = await getProfileByTelegram(client, auth.uid);
    if (!profile) {
      reply.code(404).send({ success: false, error: "user_not_started" });
      return;
    }
    const flags = await loadFeatureFlags(client);
    if (!isFeatureEnabled(flags, "ARENA_AUTH_ENABLED")) {
      reply.code(409).send({ success: false, error: "arena_auth_disabled" });
      return;
    }
    const runtimeConfig = await configService.getEconomyConfig(client);
    const director = await arenaService.buildDirectorView(client, { profile, config: runtimeConfig });
    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data: director
    });
  } finally {
    client.release();
  }
});

fastify.post(
  "/webapp/api/arena/raid/session/start",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          request_id: { type: "string", minLength: 6, maxLength: 96 },
          mode_suggested: { type: "string" }
        }
      }
    }
  },
  async (request, reply) => {
    const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
    if (!auth.ok) {
      reply.code(401).send({ success: false, error: auth.reason });
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const profile = await getProfileByTelegram(client, auth.uid);
      if (!profile) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "user_not_started" });
        return;
      }
      const flags = await loadFeatureFlags(client);
      if (!isFeatureEnabled(flags, "ARENA_AUTH_ENABLED") || !isFeatureEnabled(flags, "RAID_AUTH_ENABLED")) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "raid_auth_disabled" });
        return;
      }
      const freeze = await getFreezeState(client);
      if (freeze.freeze) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "freeze_mode", reason: freeze.reason });
        return;
      }
      const runtimeConfig = await configService.getEconomyConfig(client);
      const directorPayload = await arenaService.buildDirectorView(client, { profile, config: runtimeConfig }).catch(() => null);
      const perfProfile = await webappStore.getLatestPerfProfile(client, profile.user_id, "").catch(() => null);
      const started = await arenaService.startAuthoritativeRaidSession(client, {
        profile,
        config: runtimeConfig,
        requestId: String(request.body.request_id || `raid:${Date.now()}`),
        modeSuggested: request.body.mode_suggested,
        source: "webapp"
      });
      if (!started.ok) {
        await client.query("ROLLBACK");
        reply.code(arenaSessionErrorCode(started.error)).send({ success: false, error: started.error });
        return;
      }
      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: {
          ...started,
          contract: directorPayload?.contract || null,
          anomaly: directorPayload?.anomaly || null,
          server_tick: Date.now(),
          idempotency_key: started.session?.request_ref || null,
          director: started.session?.director || directorPayload?.director || {},
          perf_profile: perfProfile
        }
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.post(
  "/webapp/api/arena/raid/session/action",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig", "session_ref", "action_seq", "input_action"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          session_ref: { type: "string", minLength: 8, maxLength: 128 },
          action_seq: { type: "integer", minimum: 1 },
          input_action: { type: "string", enum: arenaEngine.SESSION_ACTIONS },
          latency_ms: { type: "integer", minimum: 0 },
          client_ts: { type: "integer", minimum: 0 }
        }
      }
    }
  },
  async (request, reply) => {
    const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
    if (!auth.ok) {
      reply.code(401).send({ success: false, error: auth.reason });
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const profile = await getProfileByTelegram(client, auth.uid);
      if (!profile) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "user_not_started" });
        return;
      }
      const flags = await loadFeatureFlags(client);
      if (!isFeatureEnabled(flags, "ARENA_AUTH_ENABLED") || !isFeatureEnabled(flags, "RAID_AUTH_ENABLED")) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "raid_auth_disabled" });
        return;
      }
      const freeze = await getFreezeState(client);
      if (freeze.freeze) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "freeze_mode", reason: freeze.reason });
        return;
      }
      const runtimeConfig = await configService.getEconomyConfig(client);
      const directorPayload = await arenaService.buildDirectorView(client, { profile, config: runtimeConfig }).catch(() => null);
      const perfProfile = await webappStore.getLatestPerfProfile(client, profile.user_id, "").catch(() => null);
      const acted = await arenaService.applyAuthoritativeRaidAction(client, {
        profile,
        config: runtimeConfig,
        sessionRef: String(request.body.session_ref || ""),
        actionSeq: Number(request.body.action_seq || 0),
        inputAction: String(request.body.input_action || ""),
        latencyMs: Number(request.body.latency_ms || 0),
        clientTs: Number(request.body.client_ts || 0),
        source: "webapp"
      });
      if (!acted.ok) {
        await client.query("ROLLBACK");
        reply.code(arenaSessionErrorCode(acted.error)).send({
          success: false,
          error: acted.error,
          min_actions: acted.min_actions || 0,
          action_count: acted.action_count || 0
        });
        return;
      }
      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: {
          ...acted,
          contract: directorPayload?.contract || null,
          anomaly: directorPayload?.anomaly || null,
          director: directorPayload?.director || null,
          server_tick: Date.now(),
          idempotency_key: `${String(request.body.session_ref || "")}:${Number(request.body.action_seq || 0)}`,
          perf_profile: perfProfile
        }
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.post(
  "/webapp/api/arena/raid/session/resolve",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig", "session_ref"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          session_ref: { type: "string", minLength: 8, maxLength: 128 }
        }
      }
    }
  },
  async (request, reply) => {
    const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
    if (!auth.ok) {
      reply.code(401).send({ success: false, error: auth.reason });
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const profile = await getProfileByTelegram(client, auth.uid);
      if (!profile) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "user_not_started" });
        return;
      }
      const flags = await loadFeatureFlags(client);
      if (!isFeatureEnabled(flags, "ARENA_AUTH_ENABLED") || !isFeatureEnabled(flags, "RAID_AUTH_ENABLED")) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "raid_auth_disabled" });
        return;
      }
      const freeze = await getFreezeState(client);
      if (freeze.freeze) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "freeze_mode", reason: freeze.reason });
        return;
      }
      const runtimeConfig = await configService.getEconomyConfig(client);
      const directorPayload = await arenaService.buildDirectorView(client, { profile, config: runtimeConfig }).catch(() => null);
      const perfProfile = await webappStore.getLatestPerfProfile(client, profile.user_id, "").catch(() => null);
      const resolved = await arenaService.resolveAuthoritativeRaidSession(client, {
        profile,
        config: runtimeConfig,
        sessionRef: String(request.body.session_ref || ""),
        source: "webapp"
      });
      if (!resolved.ok) {
        await client.query("ROLLBACK");
        reply.code(arenaSessionErrorCode(resolved.error)).send({
          success: false,
          error: resolved.error,
          min_actions: resolved.min_actions || 0,
          action_count: resolved.action_count || 0
        });
        return;
      }
      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: {
          ...resolved,
          contract: directorPayload?.contract || null,
          anomaly: directorPayload?.anomaly || null,
          director: directorPayload?.director || null,
          server_tick: Date.now(),
          idempotency_key: `${String(request.body.session_ref || "")}:resolve`,
          perf_profile: perfProfile
        }
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.get("/webapp/api/arena/raid/session/state", async (request, reply) => {
  const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
  if (!auth.ok) {
    reply.code(401).send({ success: false, error: auth.reason });
    return;
  }
  const client = await pool.connect();
  try {
    const profile = await getProfileByTelegram(client, auth.uid);
    if (!profile) {
      reply.code(404).send({ success: false, error: "user_not_started" });
      return;
    }
    const flags = await loadFeatureFlags(client);
    if (!isFeatureEnabled(flags, "ARENA_AUTH_ENABLED") || !isFeatureEnabled(flags, "RAID_AUTH_ENABLED")) {
      reply.code(409).send({ success: false, error: "raid_auth_disabled" });
      return;
    }
    const runtimeConfig = await configService.getEconomyConfig(client);
    const directorPayload = await arenaService.buildDirectorView(client, { profile, config: runtimeConfig }).catch(() => null);
    const perfProfile = await webappStore.getLatestPerfProfile(client, profile.user_id, "").catch(() => null);
    const statePayload = await arenaService.getAuthoritativeRaidSessionState(client, {
      profile,
      sessionRef: String(request.query.session_ref || "")
    });
    if (!statePayload.ok) {
      reply.code(arenaSessionErrorCode(statePayload.error)).send({
        success: false,
        error: statePayload.error
      });
      return;
    }
    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data: {
        ...statePayload,
        contract: directorPayload?.contract || null,
        anomaly: directorPayload?.anomaly || null,
        director: directorPayload?.director || null,
        perf_profile: perfProfile,
        idempotency_key: statePayload?.session?.session_ref ? `${statePayload.session.session_ref}:state` : null,
        server_tick: Date.now()
      }
    });
  } finally {
    client.release();
  }
});

fastify.post(
  "/webapp/api/arena/raid",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          mode: { type: "string" },
          request_id: { type: "string", minLength: 6, maxLength: 96 }
        }
      }
    }
  },
  async (request, reply) => {
    const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
    if (!auth.ok) {
      reply.code(401).send({ success: false, error: auth.reason });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const profile = await getProfileByTelegram(client, auth.uid);
      if (!profile) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "user_not_started" });
        return;
      }

      const runtimeConfig = await configService.getEconomyConfig(client);
      const freeze = await getFreezeState(client);
      if (freeze.freeze) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "freeze_mode", reason: freeze.reason });
        return;
      }

      const raid = await arenaService.runArenaRaid(client, {
        profile,
        config: runtimeConfig,
        modeKey: request.body.mode,
        requestId: `webapp:${request.body.request_id || Date.now()}`,
        source: "webapp"
      });
      if (!raid.ok) {
        await client.query("ROLLBACK");
        const statusCode =
          raid.error === "arena_cooldown" ? 429 : raid.error === "insufficient_rc" ? 409 : 400;
        reply.code(statusCode).send({ success: false, error: raid.error, cooldown_sec_left: raid.cooldown_sec_left || 0 });
        return;
      }

      const season = seasonStore.getSeasonInfo(runtimeConfig);
      const arenaConfig = arenaEngine.getArenaConfig(runtimeConfig);
      const arenaState = await arenaStore.getArenaState(client, profile.user_id, arenaConfig.baseRating);
      const arenaRank = await arenaStore.getRank(client, profile.user_id);
      const arenaLeaders = await arenaStore.getLeaderboard(client, season.seasonId, 7);
      const arenaRuns = await arenaStore.getRecentRuns(client, profile.user_id, 7);
      const snapshot = await buildActionSnapshot(client, profile, runtimeConfig);

      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: {
          ...raid,
          snapshot,
          arena: {
            rating: Number(arenaState?.rating || arenaConfig.baseRating),
            rank: Number(arenaRank?.rank || 0),
            games_played: Number(arenaState?.games_played || 0),
            wins: Number(arenaState?.wins || 0),
            losses: Number(arenaState?.losses || 0),
            leaderboard: arenaLeaders,
            recent_runs: arenaRuns
          }
        }
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.get("/webapp/api/arena/leaderboard", async (request, reply) => {
  const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
  if (!auth.ok) {
    reply.code(401).send({ success: false, error: auth.reason });
    return;
  }

  const client = await pool.connect();
  try {
    const profile = await getProfileByTelegram(client, auth.uid);
    if (!profile) {
      reply.code(404).send({ success: false, error: "user_not_started" });
      return;
    }
    const runtimeConfig = await configService.getEconomyConfig(client);
    const arenaReady = await arenaStore.hasArenaTables(client);
    if (!arenaReady) {
      reply.code(503).send({ success: false, error: "arena_tables_missing" });
      return;
    }
    const arenaConfig = arenaEngine.getArenaConfig(runtimeConfig);
    const season = seasonStore.getSeasonInfo(runtimeConfig);
    const state = await arenaStore.getArenaState(client, profile.user_id, arenaConfig.baseRating);
    const rank = await arenaStore.getRank(client, profile.user_id);
    const leaderboard = await arenaStore.getLeaderboard(client, season.seasonId, 25);
    const recentRuns = await arenaStore.getRecentRuns(client, profile.user_id, 12);
    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data: {
        rating: Number(state?.rating || arenaConfig.baseRating),
        rank: Number(rank?.rank || 0),
        games_played: Number(state?.games_played || 0),
        wins: Number(state?.wins || 0),
        losses: Number(state?.losses || 0),
        leaderboard,
        recent_runs: recentRuns,
        season_id: season.seasonId
      }
    });
  } finally {
    client.release();
  }
});

fastify.post(
  "/webapp/api/pvp/session/start",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          request_id: { type: "string", minLength: 6, maxLength: 96 },
          mode_suggested: { type: "string", enum: ["safe", "balanced", "aggressive"] },
          transport: { type: "string", enum: ["poll", "ws"] }
        }
      }
    }
  },
  async (request, reply) => {
    const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
    if (!auth.ok) {
      reply.code(401).send({ success: false, error: auth.reason });
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const profile = await getProfileByTelegram(client, auth.uid);
      if (!profile) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "user_not_started" });
        return;
      }
      const flags = await loadFeatureFlags(client);
      if (!isFeatureEnabled(flags, "ARENA_AUTH_ENABLED")) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "arena_auth_disabled" });
        return;
      }
      const freeze = await getFreezeState(client);
      if (freeze.freeze) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "freeze_mode", reason: freeze.reason });
        return;
      }
      const runtimeConfig = await configService.getEconomyConfig(client);
      const directorPayload = await arenaService.buildDirectorView(client, {
        profile,
        config: runtimeConfig
      });
      const perfProfile = await webappStore.getLatestPerfProfile(client, profile.user_id, "").catch(() => null);
      const started = await arenaService.startAuthoritativePvpSession(client, {
        profile,
        config: runtimeConfig,
        requestId: String(request.body.request_id || `pvp:${Date.now()}`),
        modeSuggested: request.body.mode_suggested,
        transportHint: request.body.transport || "poll",
        wsEnabled: PVP_WS_ENABLED,
        source: "webapp"
      });
      if (!started.ok) {
        await client.query("ROLLBACK");
        reply.code(arenaSessionErrorCode(started.error)).send({
          success: false,
          error: started.error
        });
        return;
      }
      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: {
          ...started,
          contract: directorPayload?.contract || null,
          anomaly: directorPayload?.anomaly || null,
          director: directorPayload?.director || null,
          perf_profile: perfProfile,
          server_tick: Date.now(),
          idempotency_key: started.session?.session_ref || null
        }
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.post(
  "/webapp/api/pvp/session/action",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig", "session_ref", "action_seq", "input_action"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          session_ref: { type: "string", minLength: 8, maxLength: 128 },
          action_seq: { type: "integer", minimum: 1 },
          input_action: { type: "string", enum: arenaEngine.SESSION_ACTIONS },
          latency_ms: { type: "integer", minimum: 0 },
          client_ts: { type: "integer", minimum: 0 }
        }
      }
    }
  },
  async (request, reply) => {
    const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
    if (!auth.ok) {
      reply.code(401).send({ success: false, error: auth.reason });
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const profile = await getProfileByTelegram(client, auth.uid);
      if (!profile) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "user_not_started" });
        return;
      }
      const flags = await loadFeatureFlags(client);
      if (!isFeatureEnabled(flags, "ARENA_AUTH_ENABLED")) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "arena_auth_disabled" });
        return;
      }
      const freeze = await getFreezeState(client);
      if (freeze.freeze) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "freeze_mode", reason: freeze.reason });
        return;
      }
      const runtimeConfig = await configService.getEconomyConfig(client);
      const directorPayload = await arenaService.buildDirectorView(client, {
        profile,
        config: runtimeConfig
      });
      const perfProfile = await webappStore.getLatestPerfProfile(client, profile.user_id, "").catch(() => null);
      const acted = await arenaService.applyAuthoritativePvpAction(client, {
        profile,
        config: runtimeConfig,
        sessionRef: String(request.body.session_ref || ""),
        actionSeq: Number(request.body.action_seq || 0),
        inputAction: String(request.body.input_action || ""),
        latencyMs: Number(request.body.latency_ms || 0),
        clientTs: Number(request.body.client_ts || 0),
        source: "webapp"
      });
      if (!acted.ok) {
        await client.query("ROLLBACK");
        reply.code(arenaSessionErrorCode(acted.error)).send({
          success: false,
          error: acted.error,
          min_actions: acted.min_actions || 0,
          action_count: acted.action_count || 0
        });
        return;
      }
      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: {
          ...acted,
          contract: directorPayload?.contract || null,
          anomaly: directorPayload?.anomaly || null,
          director: directorPayload?.director || null,
          perf_profile: perfProfile,
          server_tick: Date.now(),
          idempotency_key: `${String(request.body.session_ref || "")}:${Number(request.body.action_seq || 0)}`
        }
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.post(
  "/webapp/api/pvp/session/resolve",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig", "session_ref"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          session_ref: { type: "string", minLength: 8, maxLength: 128 }
        }
      }
    }
  },
  async (request, reply) => {
    const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
    if (!auth.ok) {
      reply.code(401).send({ success: false, error: auth.reason });
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const profile = await getProfileByTelegram(client, auth.uid);
      if (!profile) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "user_not_started" });
        return;
      }
      const flags = await loadFeatureFlags(client);
      if (!isFeatureEnabled(flags, "ARENA_AUTH_ENABLED")) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "arena_auth_disabled" });
        return;
      }
      const freeze = await getFreezeState(client);
      if (freeze.freeze) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "freeze_mode", reason: freeze.reason });
        return;
      }
      const runtimeConfig = await configService.getEconomyConfig(client);
      const directorPayload = await arenaService.buildDirectorView(client, {
        profile,
        config: runtimeConfig
      });
      const perfProfile = await webappStore.getLatestPerfProfile(client, profile.user_id, "").catch(() => null);
      const resolved = await arenaService.resolveAuthoritativePvpSession(client, {
        profile,
        config: runtimeConfig,
        sessionRef: String(request.body.session_ref || ""),
        source: "webapp"
      });
      if (!resolved.ok) {
        await client.query("ROLLBACK");
        reply.code(arenaSessionErrorCode(resolved.error)).send({
          success: false,
          error: resolved.error,
          min_actions: resolved.min_actions || 0,
          action_count: resolved.action_count || 0
        });
        return;
      }
      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: {
          ...resolved,
          contract: directorPayload?.contract || null,
          anomaly: directorPayload?.anomaly || null,
          director: directorPayload?.director || null,
          perf_profile: perfProfile,
          server_tick: Date.now(),
          idempotency_key: `${String(request.body.session_ref || "")}:resolve`
        }
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.get("/webapp/api/pvp/session/state", async (request, reply) => {
  const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
  if (!auth.ok) {
    reply.code(401).send({ success: false, error: auth.reason });
    return;
  }
  const client = await pool.connect();
  try {
    const profile = await getProfileByTelegram(client, auth.uid);
    if (!profile) {
      reply.code(404).send({ success: false, error: "user_not_started" });
      return;
    }
    const flags = await loadFeatureFlags(client);
    if (!isFeatureEnabled(flags, "ARENA_AUTH_ENABLED")) {
      reply.code(409).send({ success: false, error: "arena_auth_disabled" });
      return;
    }
    const runtimeConfig = await configService.getEconomyConfig(client);
    const directorPayload = await arenaService.buildDirectorView(client, {
      profile,
      config: runtimeConfig
    });
    const perfProfile = await webappStore.getLatestPerfProfile(client, profile.user_id, "").catch(() => null);
    const statePayload = await arenaService.getAuthoritativePvpSessionState(client, {
      profile,
      sessionRef: String(request.query.session_ref || "")
    });
    if (!statePayload.ok) {
      reply.code(arenaSessionErrorCode(statePayload.error)).send({
        success: false,
        error: statePayload.error
      });
      return;
    }
    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data: {
        ...statePayload,
        transport: statePayload.transport || "poll",
        tick_ms: Number(statePayload.tick_ms || 1000),
        action_window_ms: Number(statePayload.action_window_ms || 800),
        contract: directorPayload?.contract || null,
        anomaly: directorPayload?.anomaly || null,
        director: directorPayload?.director || null,
        perf_profile: perfProfile,
        server_tick: Date.now(),
        idempotency_key: statePayload?.session?.session_ref ? `${statePayload.session.session_ref}:state` : null
      }
    });
  } finally {
    client.release();
  }
});

fastify.get("/webapp/api/pvp/match/tick", async (request, reply) => {
  const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
  if (!auth.ok) {
    reply.code(401).send({ success: false, error: auth.reason });
    return;
  }
  const sessionRef = String(request.query.session_ref || "").trim();
  if (!sessionRef) {
    reply.code(400).send({ success: false, error: "session_ref_required" });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const profile = await getProfileByTelegram(client, auth.uid);
    if (!profile) {
      await client.query("ROLLBACK");
      reply.code(404).send({ success: false, error: "user_not_started" });
      return;
    }
    const flags = await loadFeatureFlags(client);
    if (!isFeatureEnabled(flags, "ARENA_AUTH_ENABLED")) {
      await client.query("ROLLBACK");
      reply.code(409).send({ success: false, error: "arena_auth_disabled" });
      return;
    }
    const runtimeConfig = await configService.getEconomyConfig(client);
    const directorPayload = await arenaService.buildDirectorView(client, {
      profile,
      config: runtimeConfig
    });
    let statePayload = await arenaService.getAuthoritativePvpSessionState(client, {
      profile,
      sessionRef
    });
    if (!statePayload.ok) {
      await client.query("ROLLBACK");
      reply.code(arenaSessionErrorCode(statePayload.error)).send({
        success: false,
        error: statePayload.error
      });
      return;
    }
    if (!statePayload.session) {
      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: {
          session: null,
          tick: null,
          transport: "poll",
          tick_ms: 1000,
          action_window_ms: 800
        }
      });
      return;
    }

    const tickMs = Math.max(250, Number(statePayload.tick_ms || 1000));
    const actionWindowMs = Math.max(250, Number(statePayload.action_window_ms || 800));
    let sessionState = statePayload.session.state || {};
    const currentTick = Math.max(0, Number(sessionState.server_tick || 0));
    const tickSeq = Math.max(1, currentTick + 1);
    let shadowDecision = null;
    let shadowEvaluation = null;

    if (shouldAdvanceShadowOnTick(statePayload.session, tickSeq)) {
      const rightActionSeq = Math.max(1, Number(statePayload.session?.action_count?.right || 0) + 1);
      const expectedAction =
        String(sessionState.next_expected_right || "").toLowerCase() ||
        arenaEngine.expectedActionForSequence(`${sessionRef}:right`, rightActionSeq);
      shadowDecision = buildShadowTickDecision(sessionRef, tickSeq, expectedAction, actionWindowMs);
      shadowEvaluation = arenaEngine.evaluateSessionAction(
        {
          sessionRef: `${sessionRef}:right`,
          combo: Number(statePayload.session?.combo?.right || 0),
          hits: Number(sessionState.hits_right || 0),
          misses: Number(sessionState.misses_right || 0),
          score: Number(statePayload.session?.score?.right || 0),
          actionCount: Number(statePayload.session?.action_count?.right || 0),
          comboMax: Number(sessionState.combo_max_right || statePayload.session?.combo?.right || 0)
        },
        {
          actionSeq: rightActionSeq,
          inputAction: shadowDecision.inputAction,
          latencyMs: shadowDecision.latencyMs
        },
        runtimeConfig
      );
      const nextExpectedRight = arenaEngine.expectedActionForSequence(`${sessionRef}:right`, rightActionSeq + 1);
      await arenaStore.updatePvpSessionProgress(client, {
        sessionId: Number(statePayload.session.session_id || 0),
        side: "right",
        score: Number(shadowEvaluation.scoreAfter || 0),
        combo: Number(shadowEvaluation.comboAfter || 0),
        actionCount: Number(shadowEvaluation.actionCount || 0),
        stateJson: {
          hits_right: Number(shadowEvaluation.hitsAfter || 0),
          misses_right: Number(shadowEvaluation.missesAfter || 0),
          combo_right: Number(shadowEvaluation.comboAfter || 0),
          combo_max_right: Math.max(
            Number(sessionState.combo_max_right || 0),
            Number(shadowEvaluation.comboAfter || 0)
          ),
          action_count_right: Number(shadowEvaluation.actionCount || 0),
          last_action_seq_right: rightActionSeq,
          last_latency_ms_right: Number(shadowEvaluation.latencyMs || 0),
          next_expected_right: nextExpectedRight,
          shadow_last_action: String(shadowDecision.inputAction || ""),
          shadow_last_accept: Boolean(shadowEvaluation.accepted),
          shadow_last_reason: String(shadowDecision.strategy || "shadow"),
          shadow_last_score_delta: Number(shadowEvaluation.scoreDelta || 0),
          last_server_tick: Date.now(),
          server_tick: tickSeq
        }
      });
      await client.query(
        `INSERT INTO pvp_match_events (
           session_id,
           session_ref,
           actor_user_id,
           event_key,
           event_name,
           event_scope,
           event_value,
           event_json
         )
         VALUES ($1, $2, NULL, 'shadow_tick_action', 'pvp_shadow_action', 'pvp', $3, $4::jsonb);`,
        [
          Number(statePayload.session.session_id || 0),
          String(statePayload.session.session_ref || sessionRef),
          shadowEvaluation.accepted ? "accepted" : "rejected",
          JSON.stringify({
            tick_seq: tickSeq,
            action_seq: rightActionSeq,
            expected_action: expectedAction,
            input_action: shadowDecision.inputAction,
            latency_ms: shadowDecision.latencyMs,
            score_delta: shadowEvaluation.scoreDelta,
            accepted: shadowEvaluation.accepted,
            strategy: shadowDecision.strategy
          })
        ]
      );
      statePayload = await arenaService.getAuthoritativePvpSessionState(client, {
        profile,
        sessionRef
      });
      if (!statePayload.ok || !statePayload.session) {
        await client.query("ROLLBACK");
        reply.code(409).send({
          success: false,
          error: statePayload.error || "session_refresh_failed"
        });
        return;
      }
      sessionState = statePayload.session.state || {};
    }

    await client.query(
      `UPDATE pvp_sessions
       SET state_json = COALESCE(state_json, '{}'::jsonb) || $2::jsonb,
           updated_at = now()
       WHERE id = $1;`,
      [
        Number(statePayload.session.session_id || 0),
        JSON.stringify({
          server_tick: tickSeq,
          last_server_tick: Date.now()
        })
      ]
    );
    if (statePayload.session && statePayload.session.state) {
      statePayload.session.state.server_tick = tickSeq;
      statePayload.session.state.last_server_tick = Date.now();
    }

    const diagnostics = buildPvpTickDiagnostics(statePayload.session, directorPayload);
    const now = Date.now();
    const tickPayload = {
      session_id: Number(statePayload.session.session_id || 0),
      session_ref: String(statePayload.session.session_ref || sessionRef),
      tick_seq: tickSeq,
      server_tick: now,
      tick_ms: tickMs,
      action_window_ms: actionWindowMs,
      transport: String(statePayload.transport || statePayload.session.transport || "poll"),
      phase:
        statePayload.session.status === "resolved"
          ? "resolve"
          : statePayload.session.status === "active"
            ? "combat"
            : "expired",
      state_json: {
        score: statePayload.session.score || {},
        combo: statePayload.session.combo || {},
        action_count: statePayload.session.action_count || {},
        mode_final: statePayload.session.mode_final || null,
        diagnostics,
        shadow: shadowDecision
          ? {
              input_action: shadowDecision.inputAction,
              strategy: shadowDecision.strategy,
              accepted: Boolean(shadowEvaluation?.accepted),
              score_delta: Number(shadowEvaluation?.scoreDelta || 0)
            }
          : null
      },
      diagnostics,
      shadow: shadowDecision
        ? {
            input_action: shadowDecision.inputAction,
            strategy: shadowDecision.strategy,
            accepted: Boolean(shadowEvaluation?.accepted),
            score_delta: Number(shadowEvaluation?.scoreDelta || 0)
          }
        : null
    };

    await client.query(
      `INSERT INTO pvp_match_ticks (
         session_id,
         session_ref,
         tick_seq,
         server_tick,
         tick_ms,
         action_window_ms,
         transport,
         phase,
         state_json
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       ON CONFLICT (session_id, tick_seq)
       DO UPDATE SET
         server_tick = EXCLUDED.server_tick,
         tick_ms = EXCLUDED.tick_ms,
         action_window_ms = EXCLUDED.action_window_ms,
         transport = EXCLUDED.transport,
         phase = EXCLUDED.phase,
         state_json = EXCLUDED.state_json;`,
      [
        tickPayload.session_id,
        tickPayload.session_ref,
        tickPayload.tick_seq,
        tickPayload.server_tick,
        tickPayload.tick_ms,
        tickPayload.action_window_ms,
        tickPayload.transport,
        tickPayload.phase,
        JSON.stringify(tickPayload.state_json || {})
      ]
    );
    await client.query(
      `INSERT INTO pvp_match_events (
         session_id,
         session_ref,
         actor_user_id,
         event_key,
         event_name,
         event_scope,
         event_value,
         event_json
       )
       VALUES ($1, $2, $3, 'tick', 'pvp_tick', 'pvp', $4, $5::jsonb);`,
      [
        tickPayload.session_id,
        tickPayload.session_ref,
        Number(profile.user_id || 0),
        tickPayload.phase,
        JSON.stringify({
          tick_seq: tickPayload.tick_seq,
          server_tick: tickPayload.server_tick,
          tick_ms: tickPayload.tick_ms,
          action_window_ms: tickPayload.action_window_ms,
          diagnostics
        })
      ]
    );
    await client.query("COMMIT");
    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data: {
        session: statePayload.session,
        tick: tickPayload,
        transport: tickPayload.transport,
        tick_ms: tickPayload.tick_ms,
        action_window_ms: tickPayload.action_window_ms,
        contract: directorPayload?.contract || null,
        anomaly: directorPayload?.anomaly || null,
        director: directorPayload?.director || null,
        diagnostics,
        shadow: tickPayload.shadow,
        idempotency_key: `${tickPayload.session_ref}:tick:${tickPayload.tick_seq}`
      }
    });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "42P01") {
      reply.code(503).send({ success: false, error: "pvp_tick_tables_missing" });
      return;
    }
    throw err;
  } finally {
    client.release();
  }
});

fastify.get("/webapp/api/pvp/leaderboard/live", async (request, reply) => {
  const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
  if (!auth.ok) {
    reply.code(401).send({ success: false, error: auth.reason });
    return;
  }
  const client = await pool.connect();
  try {
    const profile = await getProfileByTelegram(client, auth.uid);
    if (!profile) {
      reply.code(404).send({ success: false, error: "user_not_started" });
      return;
    }
    const flags = await loadFeatureFlags(client);
    if (!isFeatureEnabled(flags, "ARENA_AUTH_ENABLED")) {
      reply.code(409).send({ success: false, error: "arena_auth_disabled" });
      return;
    }
    const limit = Math.max(5, Math.min(100, Number(request.query.limit || 25)));
    const board = await arenaService.getPvpLiveLeaderboard(client, { limit });
    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data: {
        ...board,
        transport: PVP_WS_ENABLED ? "ws" : "poll",
        server_tick: Date.now()
      }
    });
  } finally {
    client.release();
  }
});

fastify.get("/webapp/api/pvp/diagnostics/live", async (request, reply) => {
  const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
  if (!auth.ok) {
    reply.code(401).send({ success: false, error: auth.reason });
    return;
  }
  const windowRaw = String(request.query.window || "5m").trim().toLowerCase();
  const allowedWindows = new Set(["5m", "15m", "1h", "24h"]);
  const bucketWindow = allowedWindows.has(windowRaw) ? windowRaw : "5m";
  const windowMsByKey = {
    "5m": 5 * 60 * 1000,
    "15m": 15 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000
  };
  const sessionRef = String(request.query.session_ref || "").trim();
  const windowStart = new Date(Date.now() - (windowMsByKey[bucketWindow] || 5 * 60 * 1000));
  const client = await pool.connect();
  try {
    const profile = await getProfileByTelegram(client, auth.uid);
    if (!profile) {
      reply.code(404).send({ success: false, error: "user_not_started" });
      return;
    }
    const flags = await loadFeatureFlags(client);
    if (!isFeatureEnabled(flags, "ARENA_AUTH_ENABLED")) {
      reply.code(409).send({ success: false, error: "arena_auth_disabled" });
      return;
    }
    const runtimeConfig = await configService.getEconomyConfig(client);
    const directorPayload = await arenaService.buildDirectorView(client, {
      profile,
      config: runtimeConfig
    });
    const latestDiagWindow = await client
      .query(
        `SELECT
           bucket_window,
           bucket_start,
           bucket_end,
           session_count,
           action_count,
           accepted_count,
           rejected_count,
           median_latency_ms,
           p95_latency_ms,
           drift_avg_ms,
           diagnostics_json,
           created_at
         FROM pvp_diag_windows
         WHERE bucket_window = $1
         ORDER BY bucket_start DESC
         LIMIT 1;`,
        [bucketWindow]
      )
      .then((res) => res.rows?.[0] || null)
      .catch((err) => {
        if (err.code === "42P01") return null;
        throw err;
      });
    let rejectMix = await client
      .query(
        `SELECT
           reason_code,
           hit_count,
           sample_json,
           bucket_start,
           bucket_end,
           created_at
         FROM pvp_reject_reason_rollups
         WHERE bucket_window = $1
         ORDER BY bucket_start DESC, hit_count DESC
         LIMIT 25;`,
        [bucketWindow]
      )
      .then((res) => res.rows || [])
      .catch((err) => {
        if (err.code === "42P01") return [];
        throw err;
      });
    if (!rejectMix.length) {
      rejectMix = await client
        .query(
          `SELECT
             COALESCE(NULLIF(reason_code, ''), 'unknown') AS reason_code,
             COUNT(*)::int AS hit_count
           FROM pvp_action_rejections
           WHERE created_at >= $1::timestamptz
           GROUP BY 1
           ORDER BY hit_count DESC
           LIMIT 25;`,
          [windowStart.toISOString()]
        )
        .then((res) => res.rows || [])
        .catch((err) => {
          if (err.code === "42P01") return [];
          throw err;
        });
    }
    const tickWindowStats = await client
      .query(
        `SELECT
           COUNT(*)::int AS tick_count,
           COALESCE(AVG(tick_ms), 0)::numeric AS avg_tick_ms,
           COALESCE(AVG(action_window_ms), 0)::numeric AS avg_action_window_ms
         FROM pvp_match_ticks
         WHERE created_at >= $1::timestamptz;`,
        [windowStart.toISOString()]
      )
      .then((res) => res.rows?.[0] || null)
      .catch((err) => {
        if (err.code === "42P01") return null;
        throw err;
      });

    let sessionState = null;
    if (sessionRef) {
      const statePayload = await arenaService.getAuthoritativePvpSessionState(client, {
        profile,
        sessionRef
      });
      if (statePayload.ok) {
        sessionState = statePayload.session || null;
      }
    }

    const latestAction = await client
      .query(
        `SELECT
           id,
           session_ref,
           action_seq,
           input_action,
           accepted,
           reject_reason,
           latency_ms,
           created_at
         FROM pvp_session_actions
         WHERE actor_user_id = $1
         ORDER BY created_at DESC
         LIMIT 1;`,
        [profile.user_id]
      )
      .then((res) => res.rows?.[0] || null)
      .catch((err) => {
        if (err.code === "42P01") return null;
        throw err;
      });

    const acceptedCount = Number(latestDiagWindow?.accepted_count || 0);
    const rejectedCount = Number(latestDiagWindow?.rejected_count || 0);
    const actionCount = Math.max(0, Number(latestDiagWindow?.action_count || acceptedCount + rejectedCount));
    const acceptRate = actionCount > 0 ? Number((acceptedCount / actionCount).toFixed(4)) : 0;
    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data: {
        window: bucketWindow,
        diagnostics: latestDiagWindow,
        reject_mix: rejectMix,
        tick_stats: tickWindowStats,
        accept_rate: acceptRate,
        contract: directorPayload?.contract || null,
        anomaly: directorPayload?.anomaly || null,
        director: directorPayload?.director || null,
        live_session: sessionState,
        latest_action: latestAction,
        transport: PVP_WS_ENABLED ? "ws" : "poll",
        server_tick: Date.now()
      }
    });
  } finally {
    client.release();
  }
});

fastify.get("/webapp/api/token/summary", async (request, reply) => {
  const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
  if (!auth.ok) {
    reply.code(401).send({ success: false, error: auth.reason });
    return;
  }

  const client = await pool.connect();
  try {
    const profile = await getProfileByTelegram(client, auth.uid);
    if (!profile) {
      reply.code(404).send({ success: false, error: "user_not_started" });
      return;
    }
    const runtimeConfig = await configService.getEconomyConfig(client);
    const balances = await economyStore.getBalances(client, profile.user_id);
    const token = await buildTokenSummary(client, profile, runtimeConfig, balances);
    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data: token
    });
  } catch (err) {
    if (err.code === "42P01") {
      reply.code(503).send({ success: false, error: "token_tables_missing" });
      return;
    }
    throw err;
  } finally {
    client.release();
  }
});

fastify.get("/webapp/api/token/route/status", async (request, reply) => {
  const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
  if (!auth.ok) {
    reply.code(401).send({ success: false, error: auth.reason });
    return;
  }
  const client = await pool.connect();
  try {
    const profile = await getProfileByTelegram(client, auth.uid);
    if (!profile) {
      reply.code(404).send({ success: false, error: "user_not_started" });
      return;
    }

    const runtimeConfig = await configService.getEconomyConfig(client);
    const tokenConfig = tokenEngine.normalizeTokenConfig(runtimeConfig);
    const featureFlags = await loadFeatureFlags(client);
    const marketState = await tokenStore.getTokenMarketState(client, tokenConfig.symbol).catch((err) => {
      if (err.code === "42P01") return null;
      throw err;
    });
    const supply = await economyStore.getCurrencySupply(client, tokenConfig.symbol);
    const curveEnabled = Boolean(
      isFeatureEnabled(featureFlags, "TOKEN_CURVE_ENABLED") && tokenConfig.curve?.enabled
    );
    const curveQuote = tokenEngine.computeTreasuryCurvePrice({
      tokenConfig,
      marketState,
      totalSupply: Number(supply.total || 0)
    });
    const spotUsd = curveEnabled ? Number(curveQuote.priceUsd || 0) : Number(tokenConfig.usd_price || 0);
    const gate = computeTokenMarketCapGate(tokenConfig, supply.total, spotUsd);
    const guardrail = await tokenStore.getTreasuryGuardrail(client, tokenConfig.symbol).catch((err) => {
      if (err.code === "42P01") return null;
      throw err;
    });
    const routeRows = Object.keys(tokenConfig.purchase?.chains || {}).map((chainKey) => {
      const chainConfig = tokenEngine.getChainConfig(tokenConfig, chainKey);
      const payAddress = tokenEngine.resolvePaymentAddress({ addresses: getPaymentAddressBook() }, chainConfig);
      return {
        chain: String(chainConfig?.chain || chainKey || "").toUpperCase(),
        pay_currency: String(chainConfig?.payCurrency || chainKey || "").toUpperCase(),
        enabled: Boolean(chainConfig && payAddress),
        pay_address_masked: maskAddress(payAddress),
        source: payAddress ? "env" : "missing"
      };
    });
    const providerHealth = await webappStore.getLatestExternalApiHealth(client, "coingecko", 12).catch((err) => {
      if (err.code === "42P01") return [];
      throw err;
    });
    const latestRouteSnapshot = await client
      .query(
        `SELECT
           token_symbol,
           route_count,
           enabled_route_count,
           provider_count,
           ok_provider_count,
           gate_open,
           quote_source_mode,
           snapshot_json,
           created_at
         FROM token_route_runtime_snapshots
         WHERE token_symbol = $1
         ORDER BY created_at DESC
         LIMIT 1;`,
        [tokenConfig.symbol]
      )
      .then((res) => res.rows?.[0] || null)
      .catch((err) => {
        if (err.code === "42P01") return null;
        throw err;
      });
    const latestQuorum = await client
      .query(
        `SELECT
           request_ref,
           token_symbol,
           chain,
           provider_count,
           ok_provider_count,
           agreement_ratio,
           chosen_provider,
           decision,
           created_at
         FROM token_route_provider_quorum_events
         WHERE token_symbol = $1
         ORDER BY created_at DESC
         LIMIT 15;`,
        [tokenConfig.symbol]
      )
      .then((res) => res.rows || [])
      .catch((err) => {
        if (err.code === "42P01") return [];
        throw err;
      });
    const providerCount = latestQuorum.length > 0 ? Number(latestQuorum[0].provider_count || 0) : 0;
    const okProviderCount = latestQuorum.length > 0 ? Number(latestQuorum[0].ok_provider_count || 0) : 0;
    const routeSnapshotPayload = {
      tokenSymbol: tokenConfig.symbol,
      routeCount: routeRows.length,
      enabledRouteCount: routeRows.filter((row) => row.enabled).length,
      providerCount,
      okProviderCount,
      gateOpen: Boolean(gate.allowed),
      quoteSourceMode: curveEnabled ? "curve_and_quorum" : "static_price",
      snapshotJson: {
        source: "token_route_status",
        spot_usd: Number(spotUsd || 0),
        market_cap_usd: Number(gate.current || 0),
        guardrail: guardrail || null
      },
      createdBy: Number(auth.uid || 0)
    };
    await client
      .query(
        `INSERT INTO token_route_runtime_snapshots (
           token_symbol,
           route_count,
           enabled_route_count,
           provider_count,
           ok_provider_count,
           gate_open,
           quote_source_mode,
           snapshot_json,
           created_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9);`,
        [
          routeSnapshotPayload.tokenSymbol,
          routeSnapshotPayload.routeCount,
          routeSnapshotPayload.enabledRouteCount,
          routeSnapshotPayload.providerCount,
          routeSnapshotPayload.okProviderCount,
          routeSnapshotPayload.gateOpen,
          routeSnapshotPayload.quoteSourceMode,
          JSON.stringify(routeSnapshotPayload.snapshotJson),
          routeSnapshotPayload.createdBy
        ]
      )
      .catch((err) => {
        if (err.code !== "42P01") {
          throw err;
        }
      });

    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data: {
        token_symbol: tokenConfig.symbol,
        route_status: {
          routes: routeRows,
          route_count: routeRows.length,
          enabled_route_count: routeRows.filter((row) => row.enabled).length
        },
        quote_status: {
          source_mode: curveEnabled ? "curve_and_quorum" : "static_price",
          spot_usd: Number(spotUsd || 0),
          curve_enabled: Boolean(curveEnabled),
          curve_quote: curveQuote
        },
        payout_gate: {
          ...gate,
          guardrail: guardrail || null
        },
        provider_health: providerHealth,
        provider_quorum_recent: latestQuorum,
        latest_snapshot: latestRouteSnapshot
      }
    });
  } finally {
    client.release();
  }
});

fastify.get("/webapp/api/token/decision/traces", async (request, reply) => {
  const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
  if (!auth.ok) {
    reply.code(401).send({ success: false, error: auth.reason });
    return;
  }
  const limit = Math.max(5, Math.min(100, Number(request.query.limit || 40)));
  const client = await pool.connect();
  try {
    const profile = await getProfileByTelegram(client, auth.uid);
    if (!profile) {
      reply.code(404).send({ success: false, error: "user_not_started" });
      return;
    }
    const isAdmin = isAdminTelegramId(auth.uid);
    const recentDecisions = await tokenStore.listTokenAutoDecisions(client, { limit }).catch((err) => {
      if (err.code === "42P01") return [];
      throw err;
    });
    const ownRequestIds = !isAdmin
      ? new Set(
          (await listTokenRequestsSafe(client, profile.user_id, 200)).map((row) => Number(row.id || 0)).filter((id) => id > 0)
        )
      : null;
    const filteredDecisions = isAdmin
      ? recentDecisions
      : recentDecisions.filter((row) => ownRequestIds.has(Number(row.request_id || 0)));
    const manualQueue = await tokenStore.listManualReviewQueue(client, limit).catch((err) => {
      if (err.code === "42P01") return [];
      throw err;
    });
    const manualQueueScoped = isAdmin
      ? manualQueue
      : manualQueue.filter((row) => Number(row.user_id || 0) === Number(profile.user_id || 0));
    const reasonBuckets = await client
      .query(
        `SELECT
           token_symbol,
           decision_source,
           decision_status,
           reason_key,
           bucket_window,
           bucket_start,
           bucket_end,
           hit_count,
           meta_json,
           created_at
         FROM token_decision_reason_buckets
         ORDER BY bucket_start DESC, hit_count DESC
         LIMIT $1;`,
        [limit]
      )
      .then((res) => res.rows || [])
      .catch((err) => {
        if (err.code === "42P01") return [];
        throw err;
      });
    const windowRollups = await client
      .query(
        `SELECT
           token_symbol,
           bucket_window,
           bucket_start,
           bucket_end,
           auto_count,
           manual_count,
           approve_count,
           reject_count,
           stale_provider_count,
           gate_block_count,
           summary_json,
           created_at
         FROM token_decision_window_rollups
         ORDER BY bucket_start DESC
         LIMIT $1;`,
        [Math.max(5, Math.min(72, limit))]
      )
      .then((res) => res.rows || [])
      .catch((err) => {
        if (err.code === "42P01") return [];
        throw err;
      });
    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data: {
        is_admin: isAdmin,
        recent_decisions: filteredDecisions,
        manual_queue: manualQueueScoped,
        reason_buckets: reasonBuckets,
        window_rollups: windowRollups,
        summary: {
          recent_decision_count: filteredDecisions.length,
          manual_queue_count: manualQueueScoped.length,
          bucket_count: reasonBuckets.length,
          rollup_count: windowRollups.length
        }
      }
    });
  } finally {
    client.release();
  }
});

fastify.get("/webapp/api/token/quote", async (request, reply) => {
  const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
  if (!auth.ok) {
    reply.code(401).send({ success: false, error: auth.reason });
    return;
  }

  const usdAmount = Number(request.query.usd || 0);
  const chain = String(request.query.chain || "").toUpperCase();
  if (!Number.isFinite(usdAmount) || usdAmount <= 0) {
    reply.code(400).send({ success: false, error: "invalid_usd_amount" });
    return;
  }

  const client = await pool.connect();
  try {
    const profile = await getProfileByTelegram(client, auth.uid);
    if (!profile) {
      reply.code(404).send({ success: false, error: "user_not_started" });
      return;
    }

    const runtimeConfig = await configService.getEconomyConfig(client);
    const tokenConfig = tokenEngine.normalizeTokenConfig(runtimeConfig);
    const featureFlags = await loadFeatureFlags(client);
    const marketState = await tokenStore.getTokenMarketState(client, tokenConfig.symbol).catch((err) => {
      if (err.code === "42P01") return null;
      throw err;
    });
    const supply = await economyStore.getCurrencySupply(client, tokenConfig.symbol);
    const curveEnabled = Boolean(
      isFeatureEnabled(featureFlags, "TOKEN_CURVE_ENABLED") && tokenConfig.curve?.enabled
    );
    const curveQuote = tokenEngine.computeTreasuryCurvePrice({
      tokenConfig,
      marketState,
      totalSupply: Number(supply.total || 0)
    });
    const guardrail = await tokenStore.getTreasuryGuardrail(client, tokenConfig.symbol).catch((err) => {
      if (err.code === "42P01") return null;
      throw err;
    });
    const priceUsd = curveEnabled ? Number(curveQuote.priceUsd || 0) : Number(tokenConfig.usd_price || 0);
    const oracleProbe = await getReliableCoreApiQuote(client, { fallbackPriceUsd: priceUsd }).catch((err) => {
      if (err.code === "42P01") {
        return {
          provider: "quorum",
          ok: false,
          statusCode: 0,
          latencyMs: 0,
          priceUsd: 0,
          errorCode: "oracle_tables_missing",
          errorMessage: "oracle tables missing",
          provider_count: 0,
          ok_provider_count: 0,
          quorum_price_usd: 0,
          agreement_ratio: 0,
          decision: "fallback",
          providers: []
        };
      }
      throw err;
    });
    const quote = tokenEngine.quotePurchaseByUsd(usdAmount, tokenConfig, { priceUsd });
    if (!quote.ok) {
      reply.code(409).send({ success: false, error: quote.reason, data: quote });
      return;
    }

    const chainConfig = tokenEngine.getChainConfig(tokenConfig, chain);
    if (!chainConfig) {
      reply.code(400).send({ success: false, error: "chain_not_supported" });
      return;
    }
    const payAddress = tokenEngine.resolvePaymentAddress({ addresses: getPaymentAddressBook() }, chainConfig);
    if (!payAddress) {
      reply.code(409).send({ success: false, error: "chain_not_enabled" });
      return;
    }
    const gate = computeTokenMarketCapGate(tokenConfig, supply.total, priceUsd);
    const velocityPerHour = await tokenStore.countRecentTokenVelocity(client, profile.user_id, 60).catch((err) => {
      if (err.code === "42P01") return 0;
      throw err;
    });
    const riskState = await riskStore.getRiskState(client, profile.user_id).catch((err) => {
      if (err.code === "42P01") return { riskScore: 0 };
      throw err;
    });
    const quoteRequestRef =
      String(request.query.request_ref || "").trim() ||
      `quote:${profile.user_id}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
    const providerRows = Array.isArray(oracleProbe.providers) ? oracleProbe.providers : [];
    for (const providerRow of providerRows) {
      await tokenStore
        .insertQuoteProviderResponse(client, {
          requestRef: quoteRequestRef,
          provider: providerRow.provider,
          symbol: tokenConfig.symbol,
          chain: chainConfig.chain,
          usdAmount: Number(quote.usdAmount || 0),
          tokenAmount: Number(quote.tokenAmount || 0),
          priceUsd: Number(providerRow.priceUsd || 0),
          confidence: Number(providerRow.confidence || 0),
          latencyMs: Number(providerRow.latencyMs || 0),
          ok: Boolean(providerRow.ok),
          responseJson: {
            endpoint: providerRow.endpoint || "",
            status_code: Number(providerRow.statusCode || 0),
            error_code: providerRow.errorCode || "",
            error_message: providerRow.errorMessage || "",
            source_ts: providerRow.sourceTs || null
          }
        })
        .catch((err) => {
          if (err.code !== "42P01") {
            throw err;
          }
        });
    }
    await tokenStore
      .upsertQuoteQuorumDecision(client, {
        requestRef: quoteRequestRef,
        tokenSymbol: tokenConfig.symbol,
        chain: chainConfig.chain,
        usdAmount: Number(quote.usdAmount || 0),
        chosenPriceUsd: Number(oracleProbe.priceUsd || priceUsd || 0),
        quorumPriceUsd: Number(oracleProbe.quorum_price_usd || 0),
        providerCount: Number(oracleProbe.provider_count || providerRows.length || 0),
        okProviderCount: Number(oracleProbe.ok_provider_count || providerRows.filter((item) => item.ok).length || 0),
        agreementRatio: Number(oracleProbe.agreement_ratio || 0),
        decision: String(oracleProbe.decision || "fallback"),
        decisionJson: {
          source: "token_quote",
          provider: oracleProbe.provider || "quorum",
          fallback_price_usd: Number(priceUsd || 0),
          providers: providerRows.map((item) => ({
            provider: item.provider,
            ok: Boolean(item.ok),
            price_usd: Number(item.priceUsd || 0),
            confidence: Number(item.confidence || 0)
          }))
        }
      })
      .catch((err) => {
        if (err.code !== "42P01") {
          throw err;
        }
      });
    await tokenStore
      .insertTokenQuoteTrace(client, {
        requestId: request.query.request_id ? Number(request.query.request_id) || null : null,
        userId: profile.user_id,
        tokenSymbol: tokenConfig.symbol,
        chain: chainConfig.chain,
        usdAmount: Number(quote.usdAmount || 0),
        tokenAmount: Number(quote.tokenAmount || 0),
        priceUsd: Number(priceUsd || 0),
        curveEnabled: Boolean(curveEnabled),
        gateOpen: Boolean(gate.allowed),
        riskScore: Number(riskState.riskScore || 0),
        velocityPerHour,
        traceJson: {
          quote,
          curve: curveQuote,
          guardrail: guardrail || null,
          external_api: oracleProbe,
          quote_request_ref: quoteRequestRef
        }
      })
      .catch((err) => {
        if (err.code !== "42P01") {
          throw err;
        }
      });
    await tokenStore
      .insertPayoutGateSnapshot(client, {
        tokenSymbol: tokenConfig.symbol,
        gateOpen: Boolean(gate.allowed),
        marketCapUsd: Number(gate.current_market_cap_usd || 0),
        minMarketCapUsd: Number(gate.min_market_cap_usd || 0),
        targetMarketCapMaxUsd: Number(tokenConfig.payout_gate?.target_band_max_usd || 0),
        snapshotJson: {
          source: "token_quote",
          user_id: profile.user_id,
          chain: chainConfig.chain,
          velocity_per_hour: Number(velocityPerHour || 0),
          risk_score: Number(riskState.riskScore || 0)
        },
        createdBy: Number(auth.uid || 0)
      })
      .catch((err) => {
        if (err.code !== "42P01") {
          throw err;
        }
      });
    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data: {
        quote,
        chain: chainConfig.chain,
        pay_currency: chainConfig.payCurrency,
        pay_address: payAddress,
        curve: {
          enabled: curveEnabled,
          quote: curveQuote
        },
        payout_gate: {
          ...gate,
          guardrail: guardrail
            ? {
                min_market_cap_usd: Number(guardrail.min_market_cap_usd || 0),
                target_market_cap_max_usd: Number(guardrail.target_market_cap_max_usd || 0),
                auto_usd_limit: Number(guardrail.auto_usd_limit || 0),
                risk_threshold: Number(guardrail.risk_threshold || 0),
                velocity_per_hour: Number(guardrail.velocity_per_hour || 0),
                require_onchain_verified: Boolean(guardrail.require_onchain_verified)
              }
            : null
        },
        external_api: oracleProbe
        ,
        quote_quorum: {
          request_ref: quoteRequestRef,
          decision: String(oracleProbe.decision || "fallback"),
          provider_count: Number(oracleProbe.provider_count || providerRows.length || 0),
          ok_provider_count: Number(oracleProbe.ok_provider_count || providerRows.filter((item) => item.ok).length || 0),
          agreement_ratio: Number(oracleProbe.agreement_ratio || 0),
          quorum_price_usd: Number(oracleProbe.quorum_price_usd || 0),
          chosen_price_usd: Number(oracleProbe.priceUsd || 0)
        }
      }
    });
  } finally {
    client.release();
  }
});

fastify.post(
  "/webapp/api/token/mint",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          amount: { type: "number", minimum: 0.0001 }
        }
      }
    }
  },
  async (request, reply) => {
    const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
    if (!auth.ok) {
      reply.code(401).send({ success: false, error: auth.reason });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const profile = await getProfileByTelegram(client, auth.uid);
      if (!profile) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "user_not_started" });
        return;
      }
      const runtimeConfig = await configService.getEconomyConfig(client);
      const freeze = await getFreezeState(client);
      if (freeze.freeze) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "freeze_mode", reason: freeze.reason });
        return;
      }

      const tokenConfig = tokenEngine.normalizeTokenConfig(runtimeConfig);
      if (!tokenConfig.enabled) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "token_disabled" });
        return;
      }

      const balances = await economyStore.getBalances(client, profile.user_id);
      const plan = tokenEngine.planMintFromBalances(balances, tokenConfig, request.body.amount);
      if (!plan.ok) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: plan.reason, data: plan });
        return;
      }

      const mintRef = deterministicUuid(`webapp:token_mint:${profile.user_id}:${Date.now()}:${Math.random()}`);
      for (const [currency, amount] of Object.entries(plan.debits || {})) {
        const safeAmount = Number(amount || 0);
        if (safeAmount <= 0) {
          continue;
        }
        const debit = await economyStore.debitCurrency(client, {
          userId: profile.user_id,
          currency,
          amount: safeAmount,
          reason: `token_mint_debit_${tokenConfig.symbol.toLowerCase()}`,
          refEventId: deterministicUuid(`${mintRef}:${currency}:debit`),
          meta: {
            source: "webapp",
            token_symbol: tokenConfig.symbol,
            token_amount: plan.tokenAmount
          }
        });
        if (!debit.applied) {
          await client.query("ROLLBACK");
          reply.code(409).send({ success: false, error: debit.reason || "mint_debit_failed" });
          return;
        }
      }

      await economyStore.creditCurrency(client, {
        userId: profile.user_id,
        currency: tokenConfig.symbol,
        amount: plan.tokenAmount,
        reason: "token_mint_from_gameplay",
        refEventId: deterministicUuid(`${mintRef}:${tokenConfig.symbol}:credit`),
        meta: { source: "webapp", units_spent: plan.unitsSpent, debits: plan.debits }
      });

      await riskStore.insertBehaviorEvent(client, profile.user_id, "webapp_token_mint", {
        token_symbol: tokenConfig.symbol,
        token_amount: plan.tokenAmount,
        units_spent: plan.unitsSpent,
        debits: plan.debits
      });

      const snapshot = await buildActionSnapshot(client, profile, runtimeConfig);
      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: {
          plan,
          snapshot
        }
      });
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === "42P01") {
        reply.code(503).send({ success: false, error: "token_tables_missing" });
        return;
      }
      if (err.code === "23505") {
        reply.code(409).send({ success: false, error: "tx_hash_already_used" });
        return;
      }
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.post(
  "/webapp/api/token/buy_intent",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig", "usd_amount", "chain"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          usd_amount: { type: "number", minimum: 0.5 },
          chain: { type: "string", minLength: 2, maxLength: 12 }
        }
      }
    }
  },
  async (request, reply) => {
    const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
    if (!auth.ok) {
      reply.code(401).send({ success: false, error: auth.reason });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const profile = await getProfileByTelegram(client, auth.uid);
      if (!profile) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "user_not_started" });
        return;
      }
      const runtimeConfig = await configService.getEconomyConfig(client);
      const freeze = await getFreezeState(client);
      if (freeze.freeze) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "freeze_mode", reason: freeze.reason });
        return;
      }

      const tokenConfig = tokenEngine.normalizeTokenConfig(runtimeConfig);
      if (!tokenConfig.enabled) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "token_disabled" });
        return;
      }

      const quote = tokenEngine.quotePurchaseByUsd(request.body.usd_amount, tokenConfig);
      if (!quote.ok) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: quote.reason, data: quote });
        return;
      }

      const chainConfig = tokenEngine.getChainConfig(tokenConfig, request.body.chain);
      if (!chainConfig) {
        await client.query("ROLLBACK");
        reply.code(400).send({ success: false, error: "unsupported_chain" });
        return;
      }
      const payAddress = tokenEngine.resolvePaymentAddress({ addresses: getPaymentAddressBook() }, chainConfig);
      if (!payAddress) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "chain_address_missing" });
        return;
      }

      const requestRow = await tokenStore.createPurchaseRequest(client, {
        userId: profile.user_id,
        tokenSymbol: tokenConfig.symbol,
        chain: chainConfig.chain,
        payCurrency: chainConfig.payCurrency,
        payAddress,
        usdAmount: quote.usdAmount,
        tokenAmount: quote.tokenAmount,
        requestRef: deterministicUuid(`webapp:token_buy:${profile.user_id}:${Date.now()}:${Math.random()}`),
        meta: {
          source: "webapp",
          spot_usd: tokenConfig.usd_price,
          token_min_receive: quote.tokenMinReceive
        }
      });
      await tokenStore.incrementVelocityBucket(client, {
        userId: profile.user_id,
        actionKey: "token_buy_intent",
        amount: 1
      }).catch((err) => {
        if (err.code !== "42P01") {
          throw err;
        }
      });

      await riskStore.insertBehaviorEvent(client, profile.user_id, "webapp_token_buy_intent", {
        request_id: requestRow.id,
        chain: requestRow.chain,
        usd_amount: quote.usdAmount,
        token_amount: quote.tokenAmount
      });

      const balances = await economyStore.getBalances(client, profile.user_id);
      const token = await buildTokenSummary(client, profile, runtimeConfig, balances);
      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: {
          request: {
            id: Number(requestRow.id),
            chain: requestRow.chain,
            pay_currency: requestRow.pay_currency,
            pay_address: requestRow.pay_address,
            usd_amount: Number(requestRow.usd_amount || 0),
            token_amount: Number(requestRow.token_amount || 0),
            status: requestRow.status
          },
          quote,
          token
        }
      });
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === "42P01") {
        reply.code(503).send({ success: false, error: "token_tables_missing" });
        return;
      }
      if (err.code === "23505") {
        reply.code(409).send({ success: false, error: "tx_hash_already_used" });
        return;
      }
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.post(
  "/webapp/api/token/submit_tx",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig", "request_id", "tx_hash"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          request_id: { type: "integer", minimum: 1 },
          tx_hash: { type: "string", minLength: 24, maxLength: 256 }
        }
      }
    }
  },
  async (request, reply) => {
    const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
    if (!auth.ok) {
      reply.code(401).send({ success: false, error: auth.reason });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const profile = await getProfileByTelegram(client, auth.uid);
      if (!profile) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "user_not_started" });
        return;
      }
      const requestId = Number(request.body.request_id || 0);
      const txHash = String(request.body.tx_hash || "").trim();
      const purchaseRequest = await tokenStore.getPurchaseRequest(client, requestId);
      if (!purchaseRequest || Number(purchaseRequest.user_id) !== Number(profile.user_id)) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "request_not_found" });
        return;
      }
      if (String(purchaseRequest.status) === "approved") {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "already_approved" });
        return;
      }
      if (String(purchaseRequest.status) === "rejected") {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "already_rejected" });
        return;
      }

      const txCheck = await validateAndVerifyTokenTx(purchaseRequest.chain, txHash);
      await webappStore.insertChainVerifyLog(client, {
        requestId,
        chain: purchaseRequest.chain,
        txHash,
        verifyStatus: txCheck.verify?.status || (txCheck.ok ? "verified" : "failed"),
        latencyMs: Number(txCheck.verify?.latency_ms || 0),
        verifyJson: txCheck.verify || {}
      }).catch((err) => {
        if (err.code !== "42P01") {
          throw err;
        }
      });
      if (!txCheck.ok) {
        await client.query("ROLLBACK");
        const code = txCheck.reason === "tx_not_found_onchain" ? 409 : 400;
        reply.code(code).send({ success: false, error: txCheck.reason, data: txCheck.verify });
        return;
      }

      const updated = await tokenStore.submitPurchaseTxHash(client, {
        requestId,
        userId: profile.user_id,
        txHash: txCheck.formatCheck.normalizedHash,
        metaPatch: {
          tx_validation: {
            chain: txCheck.formatCheck.chain,
            status: txCheck.verify.status,
            provider: txCheck.verify.provider || "none",
            checked_at: new Date().toISOString()
          }
        }
      });
      if (!updated) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "request_update_failed" });
        return;
      }

      await riskStore.insertBehaviorEvent(client, profile.user_id, "webapp_token_tx_submitted", {
        request_id: requestId,
        tx_hash: txCheck.formatCheck.normalizedHash.slice(0, 18)
      });
      await tokenStore.incrementVelocityBucket(client, {
        userId: profile.user_id,
        actionKey: "token_submit_tx",
        amount: 1
      }).catch((err) => {
        if (err.code !== "42P01") {
          throw err;
        }
      });

      const runtimeConfig = await configService.getEconomyConfig(client);
      const tokenConfig = tokenEngine.normalizeTokenConfig(runtimeConfig);
      const featureFlags = await loadFeatureFlags(client);
      const marketState = await tokenStore.getTokenMarketState(client, tokenConfig.symbol).catch((err) => {
        if (err.code === "42P01") return null;
        throw err;
      });
      const curveEnabled = Boolean(
        isFeatureEnabled(featureFlags, "TOKEN_CURVE_ENABLED") && tokenConfig.curve?.enabled
      );
      const curveState = tokenEngine.normalizeCurveState(tokenConfig, marketState);
      const supply = await economyStore.getCurrencySupply(client, tokenConfig.symbol);
      const curveQuote = tokenEngine.computeTreasuryCurvePrice({
        tokenConfig,
        marketState,
        totalSupply: Number(supply.total || 0)
      });
      const spotUsd = curveEnabled ? Number(curveQuote.priceUsd || 0) : Number(tokenConfig.usd_price || 0);
      const marketGate = computeTokenMarketCapGate(tokenConfig, supply.total, spotUsd);
      const guardrail = await tokenStore.getTreasuryGuardrail(client, tokenConfig.symbol).catch((err) => {
        if (err.code === "42P01") return null;
        throw err;
      });
      await tokenStore
        .insertPayoutGateEvent(client, {
          tokenSymbol: tokenConfig.symbol,
          gateOpen: Boolean(marketGate.allowed),
          reason: marketGate.allowed ? "gate_open" : "gate_closed",
          marketCapUsd: Number(marketGate.current_market_cap_usd || 0),
          eventJson: {
            min_market_cap_usd: Number(marketGate.min_market_cap_usd || 0),
            current_market_cap_usd: Number(marketGate.current_market_cap_usd || 0),
            request_id: requestId
          },
          createdBy: Number(auth.uid || 0)
        })
        .catch((err) => {
          if (err.code !== "42P01") {
            throw err;
          }
        });
      await tokenStore
        .insertPayoutGateSnapshot(client, {
          tokenSymbol: tokenConfig.symbol,
          gateOpen: Boolean(marketGate.allowed),
          marketCapUsd: Number(marketGate.current_market_cap_usd || 0),
          minMarketCapUsd: Number(marketGate.min_market_cap_usd || 0),
          targetMarketCapMaxUsd: Number(tokenConfig.payout_gate?.target_band_max_usd || 0),
          snapshotJson: {
            source: "token_submit_tx",
            request_id: requestId,
            tx_hash: txCheck.formatCheck.normalizedHash,
            reason: marketGate.allowed ? "gate_open" : "gate_closed"
          },
          createdBy: Number(auth.uid || 0)
        })
        .catch((err) => {
          if (err.code !== "42P01") {
            throw err;
          }
        });
      const autoPolicyEnabled = Boolean(
        isFeatureEnabled(featureFlags, "TOKEN_AUTO_APPROVE_ENABLED") && curveState.autoPolicy.enabled
      );
      const velocityPerHour = await tokenStore.countRecentTokenVelocity(client, profile.user_id, 60).catch((err) => {
        if (err.code === "42P01") return 0;
        throw err;
      });
      const riskState = await riskStore.getRiskState(client, profile.user_id);
      const onchainVerified = isOnchainVerifiedStatus(txCheck.verify?.status);
      const autoDecision = tokenEngine.evaluateAutoApprovePolicy(
        {
          usdAmount: Number(purchaseRequest.usd_amount || 0),
          riskScore: Number(riskState.riskScore || 0),
          velocityPerHour,
          onchainVerified,
          gateOpen: marketGate.allowed
        },
        {
          enabled: autoPolicyEnabled,
          autoUsdLimit: Number(guardrail?.auto_usd_limit || curveState.autoPolicy.autoUsdLimit || 10),
          riskThreshold: Number(guardrail?.risk_threshold || curveState.autoPolicy.riskThreshold || 0.35),
          velocityPerHour: Number(guardrail?.velocity_per_hour || curveState.autoPolicy.velocityPerHour || 8),
          requireOnchainVerified:
            typeof guardrail?.require_onchain_verified === "boolean"
              ? Boolean(guardrail.require_onchain_verified)
              : Boolean(curveState.autoPolicy.requireOnchainVerified)
        }
      );
      await tokenStore
        .insertTokenAutoDecision(client, {
          requestId,
          tokenSymbol: tokenConfig.symbol,
          decision: autoDecision.decision,
          reason: autoDecision.reason,
          policy: autoDecision.policy,
          riskScore: Number(riskState.riskScore || 0),
          usdAmount: Number(purchaseRequest.usd_amount || 0),
          txHash: txCheck.formatCheck.normalizedHash,
          decidedBy: autoDecision.passed ? "auto_policy" : "manual_queue"
        })
        .catch((err) => {
          if (err.code !== "42P01") {
            throw err;
          }
        });

      let requestView = updated;
      if (autoDecision.passed) {
        const refEventId = deterministicUuid(`token_purchase_credit:${requestId}:${tokenConfig.symbol}`);
        await economyStore.creditCurrency(client, {
          userId: profile.user_id,
          currency: tokenConfig.symbol,
          amount: Number(purchaseRequest.token_amount || 0),
          reason: "token_purchase_auto_approved",
          refEventId,
          meta: {
            request_id: requestId,
            usd_amount: Number(purchaseRequest.usd_amount || 0),
            chain: purchaseRequest.chain,
            tx_hash: txCheck.formatCheck.normalizedHash
          }
        });
        requestView = await tokenStore.markPurchaseApproved(client, {
          requestId,
          adminId: 0,
          adminNote: `auto_approved:${autoDecision.reason}`
        });
      }

      requestView = await tokenStore.patchPurchaseRequestMeta(client, {
        requestId,
        metaPatch: {
          auto_decision: autoDecision.decision,
          auto_decision_reason: autoDecision.reason,
          auto_decision_reasons: autoDecision.reasons || [],
          auto_policy: autoDecision.policy || {},
          market_gate: marketGate,
          curve_price_usd: Number(spotUsd || 0),
          curve_enabled: curveEnabled,
          onchain_verified: onchainVerified,
          velocity_per_hour: Number(velocityPerHour || 0)
        }
      });

      const balances = await economyStore.getBalances(client, profile.user_id);
      const token = await buildTokenSummary(client, profile, runtimeConfig, balances, {
        featureFlags
      });
      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: {
          request: {
            id: Number(requestView?.id || updated.id),
            status: requestView?.status || updated.status,
            tx_hash: requestView?.tx_hash || updated.tx_hash
          },
          decision: {
            decision: autoDecision.decision,
            reason: autoDecision.reason,
            reasons: autoDecision.reasons || [],
            passed: Boolean(autoDecision.passed)
          },
          token
        }
      });
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === "42P01") {
        reply.code(503).send({ success: false, error: "token_tables_missing" });
        return;
      }
      if (err.code === "23505") {
        reply.code(409).send({ success: false, error: "tx_hash_already_used" });
        return;
      }
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.get("/webapp/api/payout/status", async (request, reply) => {
  const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
  if (!auth.ok) {
    reply.code(401).send({ success: false, error: auth.reason });
    return;
  }
  const client = await pool.connect();
  try {
    const profile = await getProfileByTelegram(client, auth.uid);
    if (!profile) {
      reply.code(404).send({ success: false, error: "user_not_started" });
      return;
    }
    const runtimeConfig = await configService.getEconomyConfig(client);
    const featureFlags = await loadFeatureFlags(client);
    const balances = await economyStore.getBalances(client, profile.user_id);
    const token = await buildTokenSummary(client, profile, runtimeConfig, balances);
    const payoutLock = await buildPayoutLockState(client, profile, runtimeConfig, balances, token);
    const riskState = await riskStore.getRiskState(client, profile.user_id).catch((err) => {
      if (err.code === "42P01") return { riskScore: 0 };
      throw err;
    });
    const kycGuard = await evaluatePayoutKycGuard(client, {
      featureFlags,
      user_id: profile.user_id,
      amount_btc: Number(payoutLock.requestable_btc || 0),
      risk_score: Number(riskState?.riskScore || 0)
    });
    const latest = await payoutStore.getLatestRequest(client, profile.user_id, "BTC");
    const latestWithTx = latest ? await payoutStore.getRequestWithTx(client, latest.id) : null;
    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data: {
        payout_lock: payoutLock,
        latest: latestWithTx,
        kyc_guard: kycGuard
      }
    });
  } finally {
    client.release();
  }
});

fastify.post(
  "/webapp/api/payout/request",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          currency: { type: "string", minLength: 3, maxLength: 6 }
        }
      }
    }
  },
  async (request, reply) => {
    const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
    if (!auth.ok) {
      reply.code(401).send({ success: false, error: auth.reason });
      return;
    }
    const currency = String(request.body.currency || "BTC").toUpperCase();
    if (currency !== "BTC") {
      reply.code(400).send({ success: false, error: "unsupported_payout_currency" });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const profile = await getProfileByTelegram(client, auth.uid);
      if (!profile) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "user_not_started" });
        return;
      }
      const freeze = await getFreezeState(client);
      if (freeze.freeze) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "freeze_mode", reason: freeze.reason });
        return;
      }
      const runtimeConfig = await configService.getEconomyConfig(client);
      const featureFlags = await loadFeatureFlags(client);
      const balances = await economyStore.getBalances(client, profile.user_id);
      const token = await buildTokenSummary(client, profile, runtimeConfig, balances);
      const payoutLock = await buildPayoutLockState(client, profile, runtimeConfig, balances, token);
      if (!payoutLock.can_request) {
        await client.query("ROLLBACK");
        if (payoutLock.release?.enabled && payoutLock.release?.global_gate_open === false) {
          reply.code(409).send({ success: false, error: "market_cap_gate", data: { payout_lock: payoutLock } });
          return;
        }
        if (payoutLock.release?.enabled && Number(payoutLock.release?.today_drip_btc_remaining || 0) <= 0) {
          reply.code(409).send({ success: false, error: "daily_drip_exhausted", data: { payout_lock: payoutLock } });
          return;
        }
        reply.code(409).send({ success: false, error: "payout_not_eligible", data: { payout_lock: payoutLock } });
        return;
      }
      const amountBtc = Number(payoutLock.requestable_btc || 0);
      if (!Number.isFinite(amountBtc) || amountBtc <= 0) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "invalid_requestable_amount", data: { payout_lock: payoutLock } });
        return;
      }
      const riskState = await riskStore.getRiskState(client, profile.user_id).catch((err) => {
        if (err.code === "42P01") return { riskScore: 0 };
        throw err;
      });
      const kycGuard = await evaluatePayoutKycGuard(client, {
        featureFlags,
        user_id: profile.user_id,
        amount_btc: amountBtc,
        risk_score: Number(riskState?.riskScore || 0)
      });
      if (!kycGuard.allowed) {
        await client.query("ROLLBACK");
        if (kycGuard.reason_code === "kyc_tables_missing") {
          reply.code(503).send({ success: false, error: "kyc_tables_missing", data: { payout_lock: payoutLock, kyc_guard: kycGuard } });
          return;
        }
        const statusCode = kycGuard.reason_code === "kyc_blocked" ? 403 : 409;
        reply.code(statusCode).send({ success: false, error: kycGuard.reason_code, data: { payout_lock: payoutLock, kyc_guard: kycGuard } });
        return;
      }
      const sourceHcAmount = Number((amountBtc / HC_TO_BTC_RATE).toFixed(8));
      if (sourceHcAmount <= 0) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "no_hc_balance", data: { payout_lock: payoutLock } });
        return;
      }
      const address = String(getPaymentAddressBook().btc || "").trim();
      if (!address) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "payout_address_missing" });
        return;
      }
      const addressHash = crypto.createHash("sha256").update(address).digest("hex");
      const requestRow = await payoutStore.createRequest(client, {
        userId: profile.user_id,
        currency: "BTC",
        amount: Number(amountBtc.toFixed(8)),
        addressType: "BTC_MAIN",
        addressHash,
        cooldownHours: PAYOUT_COOLDOWN_HOURS,
        sourceHcAmount,
        fxRateSnapshot: HC_TO_BTC_RATE
      });
      if (!requestRow) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "duplicate_or_locked_request" });
        return;
      }
      const debit = await economyStore.debitCurrency(client, {
        userId: profile.user_id,
        currency: "HC",
        amount: sourceHcAmount,
        reason: "payout_request_lock_hc",
        refEventId: deterministicUuid(`webapp:payout_lock:${requestRow.id}:HC`),
        meta: {
          source: "webapp",
          payout_request_id: requestRow.id,
          amount_btc: Number(amountBtc.toFixed(8)),
          source_hc_amount: sourceHcAmount,
          fx_rate_snapshot: HC_TO_BTC_RATE
        }
      });
      if (!debit.applied) {
        await payoutStore.markRejectedSystem(client, {
          requestId: requestRow.id,
          reason: debit.reason || "hc_lock_failed"
        });
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: debit.reason || "hc_lock_failed" });
        return;
      }
      await riskStore.insertBehaviorEvent(client, profile.user_id, "webapp_payout_request", {
        request_id: Number(requestRow.id || 0),
        amount_btc: Number(amountBtc || 0),
        source_hc_amount: Number(sourceHcAmount || 0),
        address_masked: maskAddress(address)
      });
      await payoutStore
        .insertPayoutReleaseEvent(client, {
          userId: profile.user_id,
          payoutRequestId: requestRow.id,
          eventType: "webapp_payout_request_created",
          currency: "BTC",
          amountBtc: Number(amountBtc || 0),
          unlockTier: String(payoutLock.release?.unlock_tier || "T0"),
          unlockScore: Number(payoutLock.release?.unlock_score || 0),
          eventJson: {
            source: "webapp",
            requestable_btc: Number(payoutLock.requestable_btc || 0),
            drip_remaining_btc: Number(payoutLock.release?.today_drip_btc_remaining || 0)
          },
          createdBy: Number(auth.uid || 0)
        })
        .catch((err) => {
          if (err.code !== "42P01") {
            throw err;
          }
        });

      const balancesAfter = await economyStore.getBalances(client, profile.user_id);
      const tokenAfter = await buildTokenSummary(client, profile, runtimeConfig, balancesAfter);
      const payoutAfter = await buildPayoutLockState(client, profile, runtimeConfig, balancesAfter, tokenAfter);
      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: {
          request: requestRow,
          payout_lock: payoutAfter,
          kyc_guard: kycGuard
        }
      });
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === "42P01") {
        reply.code(503).send({ success: false, error: "payout_release_tables_missing" });
        return;
      }
      throw err;
    } finally {
      client.release();
    }
  }
);

registerWebappV2PayoutRoutes(fastify, {
  proxyWebAppApiV1
});

registerWebappV2WalletRoutes(fastify, {
  pool,
  verifyWebAppAuth,
  issueWebAppSession,
  normalizeWalletChainInput,
  normalizeWalletAddressInput,
  walletAuthEngine,
  loadFeatureFlags,
  isFeatureEnabled,
  hasWalletAuthTables,
  getProfileByTelegram,
  newUuid,
  insertWalletChallenge,
  riskStore,
  maskWalletLinkAddress,
  readWalletChallengeForUpdate,
  markWalletChallengeStatus,
  isSanctionedWalletAddress,
  hasKycTables,
  insertKycScreeningEvent,
  upsertKycProfile,
  readKycProfile,
  normalizeKycState,
  upsertWalletLink,
  insertWalletSession,
  readWalletSessionState,
  listWalletLinks,
  getWalletCapabilities,
  unlinkWalletLinks,
  revokeWalletSessions,
  walletChallengeTtlSec: WALLET_CHALLENGE_TTL_SEC,
  walletSessionTtlSec: WALLET_SESSION_TTL_SEC,
  walletVerifyMode: WALLET_VERIFY_MODE,
  webappPublicUrl: WEBAPP_PUBLIC_URL,
  kycRiskThreshold: KYC_RISK_THRESHOLD
});

fastify.get("/webapp/api/v2/pvp/progression", async (request, reply) => {
  const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
  if (!auth.ok) {
    reply.code(401).send({ success: false, error: auth.reason });
    return;
  }
  const client = await pool.connect();
  try {
    const profile = await getProfileByTelegram(client, auth.uid);
    if (!profile) {
      reply.code(404).send({ success: false, error: "user_not_started" });
      return;
    }
    const runtimeConfig = await configService.getEconomyConfig(client);
    const season = seasonStore.getSeasonInfo(runtimeConfig);
    const progression =
      (await arenaService.getPvpProgressionSnapshot(client, {
        config: runtimeConfig,
        seasonId: season.seasonId,
        userId: profile.user_id
      })) ||
      computePvpProgressionState(
        {},
        runtimeConfig?.events?.pvp_content || {},
        {
          season_id: season.seasonId
        }
      );
    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data: {
        api_version: "v2",
        season: {
          season_id: season.seasonId,
          days_left: season.daysLeft
        },
        daily_duel: progression.daily_duel || {},
        weekly_ladder: progression.weekly_ladder || {},
        season_arc_boss: progression.season_arc_boss || {},
        read_model: {
          season_id: Number(progression.season_id || season.seasonId),
          day_key: String(progression.day_key || ""),
          week_key: String(progression.week_key || "")
        },
        pvp_content: progression
      }
    });
  } finally {
    client.release();
  }
});

fastify.get("/webapp/api/admin/summary", async (request, reply) => {
  const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
  if (!auth.ok) {
    reply.code(401).send({ success: false, error: auth.reason });
    return;
  }
  const client = await pool.connect();
  try {
    const profile = await requireWebAppAdmin(client, reply, auth.uid);
    if (!profile) {
      return;
    }
    const runtimeConfig = await configService.getEconomyConfig(client);
    const summary = await buildAdminSummary(client, runtimeConfig);
    const botRuntime = await readBotRuntimeState(client, { stateKey: botRuntimeStore.DEFAULT_STATE_KEY, limit: 15 });
    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data: {
        ...summary,
        bot_runtime: {
          state_key: botRuntime.state_key || botRuntimeStore.DEFAULT_STATE_KEY,
          health: projectBotRuntimeHealth(botRuntime),
          state: botRuntime.state || null,
          events: botRuntime.events || []
        }
      }
    });
  } finally {
    client.release();
  }
});

fastify.get("/webapp/api/admin/runtime/bot", async (request, reply) => {
  const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
  if (!auth.ok) {
    reply.code(401).send({ success: false, error: auth.reason });
    return;
  }
  const stateKey = String(request.query.state_key || botRuntimeStore.DEFAULT_STATE_KEY).trim() || botRuntimeStore.DEFAULT_STATE_KEY;
  const limit = Math.max(1, Math.min(100, Number(request.query.limit || 30)));
  const client = await pool.connect();
  try {
    const profile = await requireWebAppAdmin(client, reply, auth.uid);
    if (!profile) {
      return;
    }
    const runtime = await readBotRuntimeState(client, { stateKey, limit });
    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data: {
        state_key: runtime.state_key || stateKey,
        health: projectBotRuntimeHealth(runtime),
        runtime_state: runtime.state || null,
        recent_events: runtime.events || []
      }
    });
  } finally {
    client.release();
  }
});

fastify.post(
  "/webapp/api/admin/runtime/bot/reconcile",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          state_key: { type: "string", minLength: 1, maxLength: 80 },
          reason: { type: "string", maxLength: 300 },
          force_stop: { type: "boolean" }
        }
      }
    }
  },
  async (request, reply) => {
    const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
    if (!auth.ok) {
      reply.code(401).send({ success: false, error: auth.reason });
      return;
    }
    const stateKey = String(request.body.state_key || botRuntimeStore.DEFAULT_STATE_KEY).trim() || botRuntimeStore.DEFAULT_STATE_KEY;
    const forceStop = Boolean(request.body.force_stop);
    const reason = String(request.body.reason || "webapp_admin_reconcile");
    const client = await pool.connect();
    try {
      const profile = await requireWebAppAdmin(client, reply, auth.uid);
      if (!profile) {
        return;
      }
      await client.query("BEGIN");
      const result = await reconcileBotRuntimeState(client, {
        stateKey,
        forceStop,
        reason,
        updatedBy: Number(profile.telegram_id || 0)
      });
      await client.query("COMMIT");
      if (result.status === "tables_missing") {
        reply.code(503).send({ success: false, error: "bot_runtime_tables_missing" });
        return;
      }
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: {
          reconcile_status: result.status,
          state_key: result.state_key,
          health_before: result.health_before,
          health_after: result.health_after,
          runtime_state: result.after?.state || null,
          recent_events: result.after?.events || []
        }
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.get("/webapp/api/admin/runtime/flags", async (request, reply) => {
  const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
  if (!auth.ok) {
    reply.code(401).send({ success: false, error: auth.reason });
    return;
  }
  const client = await pool.connect();
  try {
    const profile = await requireWebAppAdmin(client, reply, auth.uid);
    if (!profile) {
      return;
    }
    const payload = await loadFeatureFlags(client, { withMeta: true });
    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data: {
        source_mode: payload.source_mode,
        source_json: payload.source_json || {},
        env_forced: Boolean(payload.env_forced),
        critical_env_locked_keys: Array.from(CRITICAL_ENV_LOCKED_FLAGS.values()),
        env_defaults: FLAG_DEFAULTS,
        effective_flags: payload.flags,
        db_flags: payload.db_flags || []
      }
    });
  } finally {
    client.release();
  }
});

fastify.post(
  "/webapp/api/admin/runtime/flags",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          source_mode: { type: "string", enum: ["env_locked", "db_override"] },
          source_json: { type: "object" },
          flags: {
            type: "object",
            additionalProperties: { type: "boolean" }
          }
        }
      }
    }
  },
  async (request, reply) => {
    const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
    if (!auth.ok) {
      reply.code(401).send({ success: false, error: auth.reason });
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const profile = await requireWebAppAdmin(client, reply, auth.uid);
      if (!profile) {
        await client.query("ROLLBACK");
        return;
      }
      if (request.body.source_mode) {
        await upsertFlagSourceMode(client, {
          sourceMode: request.body.source_mode,
          sourceJson: request.body.source_json || {},
          updatedBy: Number(auth.uid)
        });
      }
      const incomingFlags =
        request.body.flags && typeof request.body.flags === "object" ? request.body.flags : {};
      for (const [rawKey, rawValue] of Object.entries(incomingFlags)) {
        const key = normalizeFlagKey(rawKey);
        if (!key) {
          continue;
        }
        await upsertFeatureFlag(client, {
          flagKey: key,
          enabled: Boolean(rawValue),
          updatedBy: Number(auth.uid),
          note: "updated via /webapp/api/admin/runtime/flags"
        });
      }
      await client.query(
        `INSERT INTO admin_audit (admin_id, action, target, payload_json)
         VALUES ($1, 'runtime_flags_update', 'feature_flags', $2::jsonb);`,
        [
          Number(auth.uid),
          JSON.stringify({
            source_mode: request.body.source_mode || null,
            flag_count: Object.keys(incomingFlags).length
          })
        ]
      );
      const payload = await loadFeatureFlags(client, { withMeta: true });
      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: {
          source_mode: payload.source_mode,
          source_json: payload.source_json || {},
          env_forced: Boolean(payload.env_forced),
          effective_flags: payload.flags,
          db_flags: payload.db_flags || []
        }
      });
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === "42P01") {
        reply.code(503).send({ success: false, error: "runtime_flag_tables_missing" });
        return;
      }
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.get("/webapp/api/admin/assets/status", async (request, reply) => {
  const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
  if (!auth.ok) {
    reply.code(401).send({ success: false, error: auth.reason });
    return;
  }
  const client = await pool.connect();
  try {
    const profile = await requireWebAppAdmin(client, reply, auth.uid);
    if (!profile) {
      return;
    }
    const local = buildAssetStatusRows();
    const dbRows = await client
      .query(
        `SELECT asset_key, manifest_path, file_path, bytes_size, load_status, meta_json, updated_at, updated_by
         FROM webapp_asset_registry
         ORDER BY asset_key ASC;`
      )
      .then((res) => res.rows)
      .catch((err) => {
        if (err.code === "42P01") return [];
        throw err;
      });
    const manifestState = await client
      .query(
        `SELECT state_key, manifest_revision, state_json, updated_at, updated_by
         FROM webapp_asset_manifest_state
         WHERE state_key = 'active'
         LIMIT 1;`
      )
      .then((res) => res.rows[0] || null)
      .catch((err) => {
        if (err.code === "42P01") return null;
        throw err;
      });
    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data: {
        local_manifest: local,
        db_registry: dbRows,
        active_manifest: manifestState,
        summary: {
          total_assets: local.rows.length,
          ready_assets: local.rows.filter((row) => row.exists).length,
          missing_assets: local.rows.filter((row) => !row.exists).length
        }
      }
    });
  } finally {
    client.release();
  }
});

fastify.post(
  "/webapp/api/admin/assets/reload",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" }
        }
      }
    }
  },
  async (request, reply) => {
    const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
    if (!auth.ok) {
      reply.code(401).send({ success: false, error: auth.reason });
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const profile = await requireWebAppAdmin(client, reply, auth.uid);
      if (!profile) {
        await client.query("ROLLBACK");
        return;
      }
      const local = buildAssetStatusRows();
      await persistAssetRegistry(client, local.rows, Number(auth.uid));
      await persistAssetManifestState(client, local, Number(auth.uid));
      await client.query(
        `INSERT INTO admin_audit (admin_id, action, target, payload_json)
         VALUES ($1, 'webapp_assets_reload', 'webapp_asset_registry', $2::jsonb);`,
        [
          Number(auth.uid),
          JSON.stringify({
            total_assets: local.rows.length,
            ready_assets: local.rows.filter((row) => row.exists).length
          })
        ]
      );
      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: {
          local_manifest: local,
          summary: {
            total_assets: local.rows.length,
            ready_assets: local.rows.filter((row) => row.exists).length,
            missing_assets: local.rows.filter((row) => !row.exists).length
          }
        }
      });
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === "42P01") {
        reply.code(503).send({ success: false, error: "asset_registry_tables_missing" });
        return;
      }
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.post(
  "/webapp/api/admin/runtime/scene/reconcile",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          target_uid: { type: "string", minLength: 1, maxLength: 32 },
          scene_key: { type: "string", minLength: 1, maxLength: 80 },
          reason: { type: "string", maxLength: 280 },
          force_refresh: { type: "boolean" }
        }
      }
    }
  },
  async (request, reply) => {
    const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
    if (!auth.ok) {
      reply.code(401).send({ success: false, error: auth.reason });
      return;
    }

    const sceneKey = String(request.body.scene_key || "nexus_arena").trim() || "nexus_arena";
    const reason = String(request.body.reason || "manual_scene_reconcile").trim() || "manual_scene_reconcile";
    const forceRefresh = Boolean(request.body.force_refresh);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const profile = await requireWebAppAdmin(client, reply, auth.uid);
      if (!profile) {
        await client.query("ROLLBACK");
        return;
      }

      let targetTelegramId = Number(profile.telegram_id || auth.uid || 0);
      if (request.body.target_uid !== undefined && request.body.target_uid !== null && String(request.body.target_uid).trim()) {
        try {
          targetTelegramId = parseTelegramId(request.body.target_uid, "target_uid");
        } catch (err) {
          await client.query("ROLLBACK");
          reply.code(400).send({ success: false, error: "invalid_target_uid", detail: String(err.message || "") });
          return;
        }
      }

      const targetProfile = await getProfileByTelegram(client, targetTelegramId);
      if (!targetProfile) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "target_user_not_started" });
        return;
      }

      const computed = await computeSceneEffectiveProfile(client, {
        userId: targetProfile.user_id,
        sceneKey,
        persist: true,
        forceRefresh,
        persistSource: "admin_scene_reconcile",
        profileJsonExtras: {
          reason,
          actor_telegram_id: Number(profile.telegram_id || 0),
          target_telegram_id: Number(targetProfile.telegram_id || 0),
          force_refresh: forceRefresh
        }
      });

      await client.query(
        `INSERT INTO admin_audit (admin_id, action, target, payload_json)
         VALUES ($1, 'scene_runtime_reconcile', $2, $3::jsonb);`,
        [
          Number(profile.telegram_id || auth.uid || 0),
          `scene:${targetProfile.user_id}:${sceneKey}`,
          JSON.stringify({
            reason,
            force_refresh: forceRefresh,
            target_telegram_id: Number(targetProfile.telegram_id || 0),
            target_user_id: Number(targetProfile.user_id || 0),
            effective_asset_mode: String(computed?.effective_profile?.asset_mode || ""),
            fallback_active: Boolean(computed?.effective_profile?.fallback_active)
          })
        ]
      );

      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: {
          scene_key: sceneKey,
          reason,
          force_refresh: forceRefresh,
          target: {
            telegram_id: Number(targetProfile.telegram_id || 0),
            user_id: Number(targetProfile.user_id || 0)
          },
          ...computed
        }
      });
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === "42P01") {
        reply.code(503).send({ success: false, error: "scene_reconcile_tables_missing" });
        return;
      }
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.get("/webapp/api/admin/metrics", async (request, reply) => {
  const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
  if (!auth.ok) {
    reply.code(401).send({ success: false, error: auth.reason });
    return;
  }
  const client = await pool.connect();
  try {
    const profile = await requireWebAppAdmin(client, reply, auth.uid);
    if (!profile) {
      return;
    }
    const metrics = await buildAdminMetrics(client);
    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data: metrics
    });
  } finally {
    client.release();
  }
});

fastify.get("/webapp/api/admin/queues", async (request, reply) => {
  const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
  if (!auth.ok) {
    reply.code(401).send({ success: false, error: auth.reason });
    return;
  }
  const client = await pool.connect();
  try {
    const profile = await requireWebAppAdmin(client, reply, auth.uid);
    if (!profile) {
      return;
    }
    const limit = parseLimit(request.query.limit, 50, 200);
    const snapshot = await readAdminQueueSnapshot(client, limit);
    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data: snapshot
    });
  } finally {
    client.release();
  }
});

fastify.get("/webapp/api/admin/queue/unified", async (request, reply) => {
  const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
  if (!auth.ok) {
    reply.code(401).send({ success: false, error: auth.reason });
    return;
  }
  const client = await pool.connect();
  try {
    const profile = await requireWebAppAdmin(client, reply, auth.uid);
    if (!profile) {
      return;
    }
    const limit = parseLimit(request.query.limit, 100, 200);
    const snapshot = await readAdminQueueSnapshot(client, Math.max(50, limit));
    const items = buildUnifiedAdminQueueItems(snapshot).slice(0, limit);
    const confirmationRequiredCount = items.filter((item) => {
      const policy = item?.action_policy && typeof item.action_policy === "object" ? item.action_policy : {};
      return Object.values(policy).some((entry) => Boolean(entry && entry.confirmation_required));
    }).length;
    const highPriorityCount = items.filter((item) => Number(item?.priority || 0) >= 0.7).length;
    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data: {
        items,
        total_items: items.length,
        counts: {
          payout_queue: Array.isArray(snapshot.payout_queue) ? snapshot.payout_queue.length : 0,
          token_manual_queue: Array.isArray(snapshot.token_manual_queue) ? snapshot.token_manual_queue.length : 0,
          token_auto_decisions: Array.isArray(snapshot.token_auto_decisions) ? snapshot.token_auto_decisions.length : 0,
          kyc_manual_queue: Array.isArray(snapshot.kyc_manual_queue) ? snapshot.kyc_manual_queue.length : 0
        },
        policy_counts: {
          confirmation_required: confirmationRequiredCount,
          high_priority: highPriorityCount
        },
        queue_snapshot: snapshot
      }
    });
  } finally {
    client.release();
  }
});

registerWebappAdminPayoutReleaseRoutes(fastify, {
  pool,
  verifyWebAppAuth,
  issueWebAppSession,
  requireWebAppAdmin,
  parseLimit,
  configService,
  patchPayoutReleaseRuntimeConfig,
  upsertFeatureFlag,
  tokenEngine,
  buildAdminSummary,
  payoutStore,
  getProfileByUserId,
  economyStore,
  buildTokenSummary,
  buildPayoutLockState,
  policyService: criticalAdminPolicyService,
  proxyWebAppApiV1,
  adminCriticalCooldownMs: ADMIN_CRITICAL_COOLDOWN_MS
});

registerWebappV2AdminQueueRoutes(fastify, {
  pool,
  proxyWebAppApiV1,
  verifyWebAppAuth,
  issueWebAppSession,
  getProfileByTelegram,
  policyService: criticalAdminPolicyService,
  adminCriticalCooldownMs: ADMIN_CRITICAL_COOLDOWN_MS
});

registerWebappAdminFreezeRoutes(fastify, {
  pool,
  verifyWebAppAuth,
  issueWebAppSession,
  requireWebAppAdmin,
  configService,
  buildAdminSummary,
  policyService: criticalAdminPolicyService,
  adminCriticalCooldownMs: ADMIN_CRITICAL_COOLDOWN_MS
});

registerWebappAdminTokenRoutes(fastify, {
  pool,
  verifyWebAppAuth,
  issueWebAppSession,
  requireWebAppAdmin,
  patchTokenRuntimeConfig,
  configService,
  tokenEngine,
  tokenStore,
  upsertFeatureFlag,
  buildAdminSummary
});

registerWebappAdminKycTokenDecisionRoutes(fastify, {
  pool,
  verifyWebAppAuth,
  issueWebAppSession,
  requireWebAppAdmin,
  normalizeKycDecision,
  hasKycTables,
  readKycProfile,
  listWalletLinks,
  upsertKycProfile,
  insertKycScreeningEvent,
  normalizeKycState,
  configService,
  buildAdminSummary,
  tokenStore,
  validateAndVerifyTokenTx,
  tokenEngine,
  economyStore,
  deterministicUuid
});

registerWebappAdminPayoutDecisionRoutes(fastify, {
  pool,
  verifyWebAppAuth,
  issueWebAppSession,
  requireWebAppAdmin,
  payoutStore,
  configService,
  buildAdminSummary
});

fastify.addHook("preHandler", async (request, reply) => {
  if (!request.url.startsWith("/admin")) {
    return;
  }
  const auth = request.headers.authorization || "";
  const token = auth.replace("Bearer ", "").trim();
  if (!token || token !== ADMIN_API_TOKEN) {
    reply.code(401).send({ success: false, error: "unauthorized" });
    return;
  }
});

fastify.get("/admin/whoami", async (request, reply) => {
  const headerId = parseAdminId(request);
  reply.send({
    success: true,
    data: {
      header_admin_id: Number(headerId || 0),
      configured_admin_id: Number(ADMIN_TELEGRAM_ID || 0),
      is_admin: isAdminTelegramId(headerId),
      hint: "Use /whoami in bot and set ADMIN_TELEGRAM_ID to the same value."
    }
  });
});

registerAdminRuntimeRoutes(fastify, {
  pool,
  parseAdminId,
  adminTelegramId: ADMIN_TELEGRAM_ID,
  isAdminTelegramId,
  botRuntimeStore,
  readBotRuntimeState,
  projectBotRuntimeHealth,
  reconcileBotRuntimeState,
  getProfileByTelegram,
  computeSceneEffectiveProfile,
  loadFeatureFlags,
  flagDefaults: FLAG_DEFAULTS,
  criticalEnvLockedFlags: CRITICAL_ENV_LOCKED_FLAGS
});

async function buildRuntimeDeployStatusPayload(client, actorId) {
    const runtime = await readBotRuntimeState(client, { stateKey: botRuntimeStore.DEFAULT_STATE_KEY, limit: 20 });
    const runtimeHealth = projectBotRuntimeHealth(runtime);
    const flags = await loadFeatureFlags(client, { withMeta: true });
    const releaseLatest = await readLatestReleaseMarker(client).catch((err) => {
      if (err.code === "42P01") return null;
      throw err;
    });
    const webappVersionState = await resolveWebAppVersion(client);
    const webappLaunchUrl = buildVersionedWebAppUrl(WEBAPP_PUBLIC_URL, webappVersionState.version);
    const dependency = await dependencyHealth();
    const activeState = await client
      .query(
        `SELECT
           state_key,
           release_ref,
           git_revision,
           deploy_id,
           environment,
           webapp_version,
           webapp_launch_url,
           flag_source_mode,
           bot_enabled,
           bot_alive,
           bot_lock_acquired,
           lock_key,
           deploy_health_ok,
           state_json,
           updated_at,
           updated_by
         FROM runtime_deploy_state
         WHERE state_key = 'active'
         LIMIT 1;`
      )
      .then((res) => res.rows?.[0] || null)
      .catch((err) => {
        if (err.code === "42P01") return null;
        throw err;
      });

    if (activeState) {
      await client
        .query(
          `UPDATE runtime_deploy_state
           SET release_ref = $2,
               git_revision = $3,
               deploy_id = $4,
               environment = $5,
               webapp_version = $6,
               webapp_launch_url = $7,
               flag_source_mode = $8,
               bot_enabled = $9,
               bot_alive = $10,
               bot_lock_acquired = $11,
               lock_key = $12,
               deploy_health_ok = $13,
               state_json = $14::jsonb,
               updated_at = now(),
               updated_by = $15
           WHERE state_key = $1;`,
          [
            "active",
            String(releaseLatest?.release_ref || ""),
            String(releaseLatest?.git_revision || RELEASE_GIT_REVISION || ""),
            String(releaseLatest?.deploy_id || RELEASE_DEPLOY_ID || ""),
            String(releaseLatest?.environment || RELEASE_ENV || "production"),
            String(webappVersionState.version || ""),
            String(webappLaunchUrl || ""),
            String(flags.source_mode || "env_locked"),
            String(process.env.BOT_ENABLED || "1") === "1",
            Boolean(runtimeHealth.alive),
            Boolean(runtimeHealth.lock_acquired),
            Number(runtimeHealth.lock_key || 0),
            Boolean(dependency.ok),
            JSON.stringify({
              webapp_version_source: webappVersionState.source,
              dependency: dependency.dependencies || {},
              bot_runtime: runtimeHealth
            }),
            Number(actorId || 0)
          ]
        )
        .catch((err) => {
          if (err.code !== "42P01") {
            throw err;
          }
        });
      await client
        .query(
          `INSERT INTO runtime_deploy_events (state_key, event_type, event_json, created_by)
           VALUES ('active', 'runtime_status_refresh', $1::jsonb, $2);`,
          [
            JSON.stringify({
              git_revision: String(releaseLatest?.git_revision || RELEASE_GIT_REVISION || ""),
              lock_acquired: Boolean(runtimeHealth.lock_acquired),
              health_ok: Boolean(dependency.ok)
            }),
            Number(actorId || 0)
          ]
        )
        .catch((err) => {
          if (err.code !== "42P01") {
            throw err;
          }
        });
    }

    const refreshedState = await client
      .query(
        `SELECT
           state_key,
           release_ref,
           git_revision,
           deploy_id,
           environment,
           webapp_version,
           webapp_launch_url,
           flag_source_mode,
           bot_enabled,
           bot_alive,
           bot_lock_acquired,
           lock_key,
           deploy_health_ok,
           state_json,
           updated_at,
           updated_by
         FROM runtime_deploy_state
         WHERE state_key = 'active'
         LIMIT 1;`
      )
      .then((res) => res.rows?.[0] || null)
      .catch((err) => {
        if (err.code === "42P01") return null;
        throw err;
      });

    return {
      actor_admin_id: Number(actorId || 0),
      configured_admin_id: Number(ADMIN_TELEGRAM_ID || 0),
      is_admin: isAdminTelegramId(actorId),
      release_latest: releaseLatest,
      webapp_version: webappVersionState.version,
      webapp_version_source: webappVersionState.source,
      webapp_launch_url: webappLaunchUrl,
      runtime_flags: {
        source_mode: flags.source_mode,
        env_forced: Boolean(flags.env_forced),
        effective_flags: flags.flags
      },
      bot_runtime: {
        state_key: runtime.state_key || botRuntimeStore.DEFAULT_STATE_KEY,
        health: runtimeHealth,
        state: runtime.state || null,
        events: runtime.events || []
      },
      dependency_health: dependency,
      runtime_deploy_state: refreshedState
  };
}

async function buildPhaseStatusAuditResponse(client, actorId, options = {}) {
  const snapshot = await buildPhaseStatusAuditSnapshot(client, {
    phase_name: options.phase_name || "V3.6",
    release_ref: options.release_ref || "",
    git_revision: options.git_revision || ""
  });
  const persist = Boolean(options.persist);
  let runtimeAuditSnapshotId = null;
  let phaseAlignment = null;
  if (persist) {
    await client.query("BEGIN");
    runtimeAuditSnapshotId = await insertRuntimeAuditSnapshot(client, {
      audit_scope: "phase_status",
      phase_name: snapshot.phase_name,
      release_ref: snapshot.release_ref,
      git_revision: snapshot.git_revision,
      flag_source_mode: snapshot.flag_source_mode,
      webapp_bundle_mode: snapshot.bundle_mode,
      bot_alive: snapshot.bot_alive,
      bot_lock_acquired: snapshot.bot_lock_acquired,
      schema_head: snapshot.schema_head,
      snapshot_json: snapshot.snapshot_json,
      findings: snapshot.findings,
      created_by: actorId
    });
    phaseAlignment = await upsertReleasePhaseAlignment(client, {
      release_ref: snapshot.release_ref,
      git_revision: snapshot.git_revision,
      phase_name: snapshot.phase_name,
      phase_status: snapshot.phase_status,
      flag_source_mode: snapshot.flag_source_mode,
      bundle_mode: snapshot.bundle_mode,
      bot_alive: snapshot.bot_alive,
      bot_lock_acquired: snapshot.bot_lock_acquired,
      acceptance_json: {
        findings_count: Array.isArray(snapshot.findings) ? snapshot.findings.length : 0,
        dependency_ok: Boolean(snapshot.dependency_health?.ok),
        critical_flags: pickCriticalRuntimeFlags(snapshot.feature_flags?.flags || {})
      },
      created_by: actorId
    });
    await client.query("COMMIT");
  }

  return {
    actor_admin_id: Number(actorId || 0),
    configured_admin_id: Number(ADMIN_TELEGRAM_ID || 0),
    is_admin: isAdminTelegramId(actorId),
    phase_name: snapshot.phase_name,
    phase_status: snapshot.phase_status,
    release_ref: snapshot.release_ref,
    git_revision: snapshot.git_revision,
    flag_source_mode: snapshot.flag_source_mode,
    bundle_mode: snapshot.bundle_mode,
    bot_alive: snapshot.bot_alive,
    bot_lock_acquired: snapshot.bot_lock_acquired,
    schema_head: snapshot.schema_head,
    persisted: persist,
    runtime_audit_snapshot_id: runtimeAuditSnapshotId,
    phase_alignment: phaseAlignment
      ? {
          release_ref: phaseAlignment.release_ref,
          git_revision: phaseAlignment.git_revision,
          phase_name: phaseAlignment.phase_name,
          phase_status: phaseAlignment.phase_status,
          created_at: phaseAlignment.created_at
        }
      : null,
    findings: snapshot.findings,
    snapshot: snapshot.snapshot_json
  };
}

async function buildDataIntegrityAuditPayload(client, actorId) {
  const [dependency, flagsMeta, variant, runtimeState, latestRelease, activeManifest, adminSummary] = await Promise.all([
    dependencyHealth(),
    loadFeatureFlags(client, { withMeta: true }),
    resolveWebAppVariant(client),
    readBotRuntimeState(client, { stateKey: botRuntimeStore.DEFAULT_STATE_KEY, limit: 10 }),
    hasReleaseMarkersTable(client).then((exists) => (exists ? readLatestReleaseMarker(client) : null)).catch(() => null),
    readActiveAssetManifest(client, { includeEntries: true, entryLimit: 256 }).catch((err) => {
      if (err?.code === "42P01") {
        return { available: false, active_revision: null, entries: [] };
      }
      throw err;
    }),
    configService
      .getEconomyConfig(client)
      .then((cfg) => buildAdminSummary(client, cfg))
      .catch((err) => {
        if (err?.code === "42P01") return null;
        throw err;
      })
  ]);
  const botRuntimeHealth = projectBotRuntimeHealth(runtimeState);
  const manifestSummary = summarizeActiveAssetManifest(activeManifest);
  const assetMode = summarizeAssetMode({
    sceneMode: String(adminSummary?.scene_mode || ""),
    manifestSummary,
    runtimeAssetSummary: adminSummary?.assets?.runtime || null
  });
  const queueSummary = adminSummary?.queues || {};
  const externalApiHealth = Array.isArray(queueSummary.external_api_health) ? queueSummary.external_api_health : [];
  const tokenAutoDecisions = Array.isArray(queueSummary.token_auto_decisions) ? queueSummary.token_auto_decisions : [];
  const truthMap = {
    gameplay: {
      source: "backend_authoritative",
      arena_tables: Boolean(dependency?.dependencies?.arena_session_tables),
      raid_tables: Boolean(dependency?.dependencies?.raid_session_tables),
      pvp_tables: Boolean(dependency?.dependencies?.pvp_session_tables),
      status:
        dependency?.dependencies?.arena_session_tables &&
        dependency?.dependencies?.raid_session_tables &&
        dependency?.dependencies?.pvp_session_tables
          ? "real"
          : "partial"
    },
    treasury: {
      source: "backend_authoritative+env_routing",
      token_market_tables: Boolean(dependency?.dependencies?.token_market_tables),
      treasury_ops_tables: Boolean(dependency?.dependencies?.treasury_ops_tables),
      quote_trace_tables: Boolean(dependency?.dependencies?.oracle_tables),
      provider_health_rows: externalApiHealth.length,
      auto_decision_rows: tokenAutoDecisions.length,
      route_chains: adminSummary?.token?.routing?.chains || [],
      payout_gate_status: String(adminSummary?.token?.market?.payout_gate || ""),
      status: dependency?.dependencies?.token_market_tables ? "real" : "partial"
    },
    webapp_ui: {
      source: variant?.source === "dist" ? "vite_ts_bundle" : "legacy_runtime",
      bundle_mode: String(variant?.source || "unknown"),
      ts_bundle_enabled: Boolean(flagsMeta?.flags?.WEBAPP_TS_BUNDLE_ENABLED),
      webapp_v3_enabled: Boolean(flagsMeta?.flags?.WEBAPP_V3_ENABLED),
      status: variant?.source === "dist" ? "real" : "partial"
    },
    scene_assets: {
      source: "manifest+registry+runtime",
      asset_mode: assetMode,
      manifest: manifestSummary,
      runtime_assets: adminSummary?.assets?.runtime || null,
      status: assetMode === "glb" ? "real" : assetMode === "mixed" || assetMode === "lite" ? "mixed" : "procedural"
    },
    bot_runtime: {
      source: "bot_runtime_state",
      health: botRuntimeHealth,
      status: botRuntimeHealth.alive && botRuntimeHealth.lock_acquired ? "real" : "degraded"
    }
  };

  return {
    actor_admin_id: Number(actorId || 0),
    configured_admin_id: Number(ADMIN_TELEGRAM_ID || 0),
    is_admin: isAdminTelegramId(actorId),
    release_latest: latestRelease
      ? {
          release_ref: latestRelease.release_ref,
          git_revision: latestRelease.git_revision,
          created_at: latestRelease.created_at
        }
      : null,
    dependency_health: dependency,
    runtime_flags: {
      source_mode: String(flagsMeta?.source_mode || "env_locked"),
      env_forced: Boolean(flagsMeta?.env_forced),
      effective_flags: flagsMeta?.flags || {}
    },
    truth_map: truthMap,
    notes: [
      "Gameplay/economy/treasury values are backend-authoritative.",
      "Procedural fallback is allowed only for visual scene assets.",
      "This endpoint summarizes runtime truth sources, not repo-wide keyword scans."
    ]
  };
}

fastify.get("/webapp/api/admin/runtime/deploy/status", async (request, reply) => {
  const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
  if (!auth.ok) {
    reply.code(401).send({ success: false, error: auth.reason });
    return;
  }
  const client = await pool.connect();
  try {
    const profile = await requireWebAppAdmin(client, reply, auth.uid);
    if (!profile) {
      return;
    }
    const data = await buildRuntimeDeployStatusPayload(client, auth.uid);
    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data
    });
  } finally {
    client.release();
  }
});

fastify.get("/admin/runtime/deploy/status", async (request, reply) => {
  const actorId = parseAdminId(request);
  const client = await pool.connect();
  try {
    const data = await buildRuntimeDeployStatusPayload(client, actorId);
    reply.send({ success: true, data });
  } finally {
    client.release();
  }
});

fastify.get("/webapp/api/admin/runtime/audit/phase-status", async (request, reply) => {
  const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
  if (!auth.ok) {
    reply.code(401).send({ success: false, error: auth.reason });
    return;
  }
  const persist = parseTruthyQuery(request.query?.persist);
  const client = await pool.connect();
  try {
    const profile = await requireWebAppAdmin(client, reply, auth.uid);
    if (!profile) {
      return;
    }
    const data = await buildPhaseStatusAuditResponse(client, auth.uid, {
      persist,
      phase_name: request.query?.phase_name || "V3.6",
      release_ref: request.query?.release_ref || "",
      git_revision: request.query?.git_revision || ""
    });
    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    throw err;
  } finally {
    client.release();
  }
});

fastify.get(
  "/admin/runtime/audit/phase-status",
  {
    schema: {
      querystring: {
        type: "object",
        properties: {
          persist: { anyOf: [{ type: "boolean" }, { type: "string" }] },
          phase_name: { type: "string", maxLength: 64 },
          release_ref: { type: "string", maxLength: 128 },
          git_revision: { type: "string", maxLength: 200 }
        }
      }
    }
  },
  async (request, reply) => {
    const actorId = parseAdminId(request);
    const client = await pool.connect();
    try {
      const data = await buildPhaseStatusAuditResponse(client, actorId, {
        persist: parseTruthyQuery(request.query?.persist),
        phase_name: request.query?.phase_name || "V3.6",
        release_ref: request.query?.release_ref || "",
        git_revision: request.query?.git_revision || ""
      });
      reply.send({ success: true, data });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.get("/webapp/api/admin/runtime/audit/data-integrity", async (request, reply) => {
  const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
  if (!auth.ok) {
    reply.code(401).send({ success: false, error: auth.reason });
    return;
  }
  const client = await pool.connect();
  try {
    const profile = await requireWebAppAdmin(client, reply, auth.uid);
    if (!profile) {
      return;
    }
    const data = await buildDataIntegrityAuditPayload(client, auth.uid);
    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data
    });
  } finally {
    client.release();
  }
});

fastify.get("/admin/runtime/audit/data-integrity", async (request, reply) => {
  const actorId = parseAdminId(request);
  const client = await pool.connect();
  try {
    const data = await buildDataIntegrityAuditPayload(client, actorId);
    reply.send({ success: true, data });
  } finally {
    client.release();
  }
});

fastify.get("/admin/release/latest", async (request, reply) => {
  const exists = await hasReleaseMarkersTable(pool);
  if (!exists) {
    reply.code(503).send({ success: false, error: "release_markers_missing" });
    return;
  }
  const marker = await readLatestReleaseMarker(pool);
  reply.send({ success: true, data: marker });
});

fastify.post(
  "/admin/release/mark",
  {
    schema: {
      body: {
        type: "object",
        properties: {
          git_revision: { type: "string", maxLength: 200 },
          deploy_id: { type: "string", maxLength: 200 },
          environment: { type: "string", maxLength: 50 },
          config_version: { type: "integer", minimum: 0 },
          notes: { type: "string", maxLength: 500 }
        }
      }
    }
  },
  async (request, reply) => {
    const exists = await hasReleaseMarkersTable(pool);
    if (!exists) {
      reply.code(503).send({ success: false, error: "release_markers_missing" });
      return;
    }
    const adminId = parseAdminId(request);
    const health = await dependencyHealth();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const marker = await captureReleaseMarker(client, {
        gitRevision: request.body?.git_revision || RELEASE_GIT_REVISION || "manual",
        deployId: request.body?.deploy_id || RELEASE_DEPLOY_ID || "",
        environment: request.body?.environment || RELEASE_ENV || "production",
        configVersion: Number(request.body?.config_version || 0),
        notes: request.body?.notes || "manual_release_marker",
        createdBy: adminId,
        health
      });

      let auditSnapshot = null;
      let auditSnapshotId = null;
      let phaseAlignment = null;
      if (marker) {
        auditSnapshot = await buildPhaseStatusAuditSnapshot(client, {
          release_ref: marker.release_ref,
          git_revision: marker.git_revision,
          phase_name: "V3.6"
        });
        auditSnapshotId = await insertRuntimeAuditSnapshot(client, {
          audit_scope: "release_mark",
          phase_name: auditSnapshot.phase_name,
          release_ref: auditSnapshot.release_ref,
          git_revision: auditSnapshot.git_revision,
          flag_source_mode: auditSnapshot.flag_source_mode,
          webapp_bundle_mode: auditSnapshot.bundle_mode,
          bot_alive: auditSnapshot.bot_alive,
          bot_lock_acquired: auditSnapshot.bot_lock_acquired,
          schema_head: auditSnapshot.schema_head,
          snapshot_json: auditSnapshot.snapshot_json,
          findings: auditSnapshot.findings,
          created_by: adminId
        });
        phaseAlignment = await upsertReleasePhaseAlignment(client, {
          release_ref: marker.release_ref,
          git_revision: marker.git_revision,
          phase_name: auditSnapshot.phase_name,
          phase_status: auditSnapshot.phase_status,
          flag_source_mode: auditSnapshot.flag_source_mode,
          bundle_mode: auditSnapshot.bundle_mode,
          bot_alive: auditSnapshot.bot_alive,
          bot_lock_acquired: auditSnapshot.bot_lock_acquired,
          acceptance_json: {
            release_marked: true,
            findings_count: Array.isArray(auditSnapshot.findings) ? auditSnapshot.findings.length : 0,
            critical_flags: pickCriticalRuntimeFlags(auditSnapshot.feature_flags?.flags || {})
          },
          created_by: adminId
        });
      }

      await client.query("COMMIT");
      reply.send({
        success: true,
        data: marker,
        audit: auditSnapshot
          ? {
              phase_name: auditSnapshot.phase_name,
              phase_status: auditSnapshot.phase_status,
              runtime_audit_snapshot_id: auditSnapshotId,
              phase_alignment: phaseAlignment
                ? {
                    release_ref: phaseAlignment.release_ref,
                    git_revision: phaseAlignment.git_revision,
                    phase_name: phaseAlignment.phase_name,
                    phase_status: phaseAlignment.phase_status,
                    created_at: phaseAlignment.created_at
                  }
                : null
            }
          : null
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);

registerAdminSystemOpsRoutes(fastify, {
  pool,
  requireTables,
  parseAdminId
});

registerAdminTokenPolicyRoutes(fastify, {
  pool,
  parseAdminId,
  configService,
  tokenEngine,
  tokenStore,
  upsertFeatureFlag
});

registerAdminPayoutRoutes(fastify, {
  pool,
  requirePayoutTables,
  parseLimit,
  parseAdminId,
  deterministicUuid
});

registerAdminTokenRequestRoutes(fastify, {
  pool,
  tokenStore,
  parseLimit,
  parseAdminId,
  validateAndVerifyTokenTx,
  configService,
  tokenEngine,
  economyStore,
  deterministicUuid
});

registerWebappV2AdminOpsRoutes(fastify, {
  pool,
  verifyWebAppAuth,
  requireWebAppAdmin,
  issueWebAppSession,
  contracts: contractsV2,
  repoRootDir: REPO_ROOT_DIR,
  logger: fastify.log
});

fastify.addHook("onClose", async () => {
  await pool.end();
});

assertStartupGuards();

fastify.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`Admin API listening on ${address}`);
  (async () => {
    try {
      const marker = await captureReleaseMarker(pool, {
        gitRevision: RELEASE_GIT_REVISION || "boot",
        deployId: RELEASE_DEPLOY_ID || "",
        environment: RELEASE_ENV || "production",
        notes: "startup_boot_marker",
        createdBy: Number(ADMIN_TELEGRAM_ID || 0)
      });
      if (marker) {
        fastify.log.info({
          event: "release_marker_created",
          release_ref: marker.release_ref,
          git_revision: marker.git_revision,
          deploy_id: marker.deploy_id
        });
      } else {
        fastify.log.warn({ event: "release_marker_skipped", reason: "table_missing" });
      }
    } catch (markerErr) {
      fastify.log.warn({ err: markerErr, event: "release_marker_failed" });
    }
  })();
});
