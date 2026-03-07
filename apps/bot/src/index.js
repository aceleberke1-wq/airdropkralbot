const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const dotenv = require("dotenv");
const { Telegraf } = require("telegraf");
const { createPool, ping, withTransaction } = require("./db");
const userStore = require("./stores/userStore");
const taskStore = require("./stores/taskStore");
const economyStore = require("./stores/economyStore");
const riskStore = require("./stores/riskStore");
const systemStore = require("./stores/systemStore");
const seasonStore = require("./stores/seasonStore");
const shopStore = require("./stores/shopStore");
const missionStore = require("./stores/missionStore");
const globalStore = require("./stores/globalStore");
const payoutStore = require("./stores/payoutStore");
const arenaStore = require("./stores/arenaStore");
const tokenStore = require("./stores/tokenStore");
const webappStore = require("./stores/webappStore");
const botRuntimeStore = require("./stores/botRuntimeStore");
const taskCatalog = require("./taskCatalog");
const messages = require("./messages");
const configService = require("./services/configService");
const economyEngine = require("./services/economyEngine");
const antiAbuseEngine = require("./services/antiAbuseEngine");
const arenaEngine = require("./services/arenaEngine");
const arenaService = require("./services/arenaService");
const tokenEngine = require("./services/tokenEngine");
const txVerifier = require("./services/txVerifier");
const nexusEventEngine = require("./services/nexusEventEngine");
const nexusContractEngine = require("./services/nexusContractEngine");
const {
  evaluateAdminPolicy,
  buildAdminActionSignature: buildAdminPolicySignature
} = require("../../../packages/shared/src/v5/adminPolicyEngine");
const {
  CANONICAL_PANEL_KEY,
  CANONICAL_ROUTE_KEY,
  buildStartAppPayload,
  encodeStartAppPayload
} = require("../../../packages/shared/src/navigationContract");
const { resolvePlayerCommandNavigation } = require("../../../packages/shared/src/playerCommandNavigation");
const { resolveAdminCommandNavigation } = require("../../../packages/shared/src/adminCommandNavigation");
const { resolveLocalePreference } = require("../../../packages/shared/src/localeContract");
const { getCommandRegistry, toTelegramCommands, buildAliasLookup } = require("./commands/registry");
const { buildIntentIndex, resolveIntent, normalizeMode } = require("./commands/intentRouter");
const { buildSimpleCallbackActionMap, buildSimpleWebAppActionMap } = require("./commands/callbackActionCatalog");
const { normalizeLanguage } = require("./i18n");
const {
  buildTaskKeyboard,
  buildStartKeyboard,
  buildMoreMenuKeyboard,
  buildGuideKeyboard,
  buildHelpKeyboard,
  buildHelpIndexKeyboard,
  buildHelpCommandCardKeyboard,
  buildCompleteKeyboard,
  buildRevealKeyboard,
  buildPostRevealKeyboard,
  buildShopKeyboard,
  buildMissionKeyboard,
  buildPayoutKeyboard,
  buildTokenKeyboard,
  buildPlayKeyboard,
  buildWalletKeyboard,
  buildProfileKeyboard,
  buildStatusKeyboard,
  buildRewardsKeyboard,
  buildEventKeyboard,
  buildDiscoverKeyboard,
  buildSettingsKeyboard,
  buildSupportKeyboard,
  buildSeasonKeyboard,
  buildRaidKeyboard,
  buildAdminKeyboard,
  buildAdminWorkspaceKeyboard,
  buildAdminPayoutActionKeyboard,
  buildAdminTokenActionKeyboard
} = require("./ui/keyboards");
const {
  buildLaunchSurfaceEntries,
  PLAYER_LAUNCH_SURFACE_CATALOG,
  ADMIN_LAUNCH_SURFACE_CATALOG
} = require("./ui/launchSurfaceCatalog");
const {
  buildHelpCards,
  buildHelpCardMap,
  validateHelpCardsCoverage,
  getHelpCategories,
  categoryLabel,
  resolveHelpTarget,
  suggestHelpKeys
} = require("./commands/helpCards");
const { createSafeMarkdownReplyMiddleware } = require("./utils/safeMarkdownReply");
const { createSlashCommandTelemetryMiddleware } = require("./telemetry/slashTelemetry");
const { resolveLaunchUrlBundle } = require("./utils/miniAppLaunchResolver");

const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

function escapeMarkdownText(value) {
  return String(value || "").replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

function requireEnv(name, opts = {}) {
  const value = process.env[name];
  if (!value && !opts.optional) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

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

function loadConfig() {
  const dryRun = process.env.BOT_DRY_RUN === "1";
  const botToken = dryRun ? process.env.BOT_TOKEN || "" : requireEnv("BOT_TOKEN");
  const adminIdRaw = requireEnv("ADMIN_TELEGRAM_ID");
  const adminTelegramId = parseTelegramId(adminIdRaw, "ADMIN_TELEGRAM_ID");

  const addresses = {
    btc: requireEnv("BTC_PAYOUT_ADDRESS_PRIMARY"),
    trx: requireEnv("TRX_PAYOUT_ADDRESS"),
    eth: requireEnv("ETH_PAYOUT_ADDRESS"),
    sol: requireEnv("SOL_PAYOUT_ADDRESS"),
    ton: requireEnv("TON_PAYOUT_ADDRESS")
  };

  const databaseUrl = requireEnv("DATABASE_URL");
  const databaseSsl = process.env.DATABASE_SSL === "1";
  const loopV2Enabled = process.env.LOOP_V2_ENABLED === "1";
  const payoutThresholdBtc = Number(process.env.PAYOUT_BTC_THRESHOLD || 0.0001);
  const hcToBtcRate = Number(process.env.HC_TO_BTC_RATE || 0.00001);
  const payoutCooldownHours = Number(process.env.PAYOUT_COOLDOWN_HOURS || 72);
  const webappPublicUrl = requireEnv("WEBAPP_PUBLIC_URL", { optional: true }) || "";
  const webappVersionOverride = requireEnv("WEBAPP_VERSION_OVERRIDE", { optional: true }) || "";
  const webappHmacSecret = requireEnv("WEBAPP_HMAC_SECRET", { optional: true }) || "";
  const botUsername = requireEnv("BOT_USERNAME", { optional: true }) || "airdropkral_2026_bot";
  const releaseGitRevision = String(
    process.env.RELEASE_GIT_REVISION || process.env.GIT_COMMIT || process.env.RENDER_GIT_COMMIT || ""
  ).trim();
  const tokenTxVerifyEnabled = process.env.TOKEN_TX_VERIFY === "1";
  const tokenTxVerifyStrict = process.env.TOKEN_TX_VERIFY_STRICT === "1";
  const botInstanceLockKey = Number(process.env.BOT_INSTANCE_LOCK_KEY || 7262026);
  const botEnabled = process.env.BOT_ENABLED !== "0";
  const runtimeStateKey = String(process.env.BOT_RUNTIME_STATE_KEY || botRuntimeStore.DEFAULT_STATE_KEY).trim() || "primary";
  const instanceRef = String(
    process.env.RENDER_DEPLOY_ID || process.env.RENDER_SERVICE_ID || process.env.RELEASE_GIT_REVISION || process.pid
  ).trim();

  const isProd = (process.env.NODE_ENV || "").toLowerCase() === "production";
  if (isProd && /(localhost|127\.0\.0\.1|::1)/i.test(databaseUrl)) {
    throw new Error(
      "Invalid DATABASE_URL for production: localhost detected. " +
        "Set Render/Neon/Supabase Postgres URL in env (DATABASE_URL) and redeploy."
    );
  }

  return {
    dryRun,
    botToken,
    adminTelegramId,
    addresses,
    databaseUrl,
    databaseSsl,
    nodeEnv: process.env.NODE_ENV || "development",
    loopV2Enabled,
    payoutThresholdBtc,
    hcToBtcRate,
    payoutCooldownHours,
    webappPublicUrl,
    webappVersionOverride,
    webappHmacSecret,
    botUsername,
    releaseGitRevision,
    tokenTxVerifyEnabled,
    tokenTxVerifyStrict,
    botInstanceLockKey,
    botEnabled,
    runtimeStateKey,
    instanceRef
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const WEBAPP_VERSION_STARTUP_TS = String(Date.now());
const WEBAPP_VERSION_CACHE_TTL_MS = 60_000;
const WEBAPP_BOOTSTRAP_CACHE_TTL_MS = 45_000;
const BOT_CRITICAL_FLAG_KEYS = [
  "UX_V5_ENABLED",
  "PAYOUT_RELEASE_V2_ENABLED",
  "I18N_V2_ENABLED",
  "UX_V4_ENABLED",
  "PAYOUT_RELEASE_V1_ENABLED",
  "WEBAPP_PLAYER_MODE_DEFAULT",
  "I18N_V1_ENABLED",
  "PVP_POLL_PRIMARY",
  "WEBAPP_TS_BUNDLE_ENABLED",
  "WEBAPP_V3_ENABLED",
  "ARENA_AUTH_ENABLED",
  "RAID_AUTH_ENABLED",
  "TOKEN_CURVE_ENABLED",
  "TOKEN_AUTO_APPROVE_ENABLED"
];
const WEBAPP_VERSION_CACHE = {
  value: "",
  source: "",
  expiresAt: 0
};
const WEBAPP_BOOTSTRAP_CACHE = new Map();
const COMMAND_REGISTRY = getCommandRegistry();
const COMMAND_ALIAS_LOOKUP = buildAliasLookup(COMMAND_REGISTRY);
const COMMAND_INTENT_INDEX = buildIntentIndex(COMMAND_REGISTRY);
const HELP_CARDS = Object.freeze(buildHelpCards(COMMAND_REGISTRY));
const HELP_CARD_MAP = buildHelpCardMap(HELP_CARDS);
const HELP_CARD_COVERAGE = validateHelpCardsCoverage(COMMAND_REGISTRY, HELP_CARDS);
if (!HELP_CARD_COVERAGE.ok) {
  if (HELP_CARD_COVERAGE.missing.length > 0) {
    throw new Error(`missing_help_card:${HELP_CARD_COVERAGE.missing[0]}`);
  }
  throw new Error(`orphan_help_card:${HELP_CARD_COVERAGE.orphan[0]}`);
}
const HELP_INDEX_PAGE_SIZE = 6;
const ADMIN_CONFIRM_TTL_MS = 90_000;
const ADMIN_COOLDOWN_MS = 8_000;
const ADMIN_CONFIRM_STATE = new Map();
const ADMIN_RATE_LIMIT_STATE = new Map();
const PLAYER_ACTION_RATE_STATE = new Map();
const PLAYER_ACTION_DEFAULT_COOLDOWNS_MS = Object.freeze({
  arena_raid: 1500,
  task_accept: 900,
  task_complete: 1100,
  reveal: 1100,
  buy_offer: 1500,
  claim_mission: 1200,
  reroll_tasks: 3000,
  payout_request: 4000
});
const WEBAPP_ACTION_IDEMPOTENCY_TTL_MS = 15 * 60 * 1000;
const WEBAPP_ACTION_IDEMPOTENCY_CACHE = new Map();
const WEBAPP_CRITICAL_ACTIONS = new Set([
  "accept_offer",
  "complete_latest",
  "reveal_latest",
  "mint_token",
  "buy_token",
  "submit_token_tx",
  "reroll_tasks"
]);

function normalizePublicName(ctx) {
  if (ctx.from?.username) {
    return `@${ctx.from.username}`;
  }
  const parts = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean);
  const joined = parts.join(" ").trim();
  return joined || "Kral";
}

function deterministicUuid(input) {
  const hex = crypto.createHash("sha1").update(String(input)).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex
    .slice(16, 20)
    .join("")}-${hex.slice(20, 32).join("")}`;
}

function signWebAppPayload(uid, ts, secret) {
  return crypto.createHmac("sha256", String(secret)).update(`${uid}.${ts}`).digest("hex");
}

function sanitizeWebAppVersion(rawValue) {
  return String(rawValue || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 40);
}

function buildVersionedWebAppUrl(baseUrl, version) {
  const base = String(baseUrl || "").trim();
  const safeVersion = sanitizeWebAppVersion(version) || sanitizeWebAppVersion(WEBAPP_VERSION_STARTUP_TS) || "startup";
  if (!base) {
    return "";
  }
  try {
    const url = new URL(base);
    url.searchParams.set("v", safeVersion);
    return url.toString();
  } catch {
    const separator = base.includes("?") ? "&" : "?";
    return `${base}${separator}v=${encodeURIComponent(safeVersion)}`;
  }
}

async function resolveLocalWebAppVersion(pool, appConfig) {
  const overrideVersion = sanitizeWebAppVersion(appConfig.webappVersionOverride);
  if (overrideVersion) {
    return { version: overrideVersion, source: "env_override" };
  }

  const now = Date.now();
  if (WEBAPP_VERSION_CACHE.value && now < WEBAPP_VERSION_CACHE.expiresAt) {
    return { version: WEBAPP_VERSION_CACHE.value, source: WEBAPP_VERSION_CACHE.source || "cache" };
  }

  const dbVersion = await withTransaction(pool, async (db) => {
    const hasTable = await db
      .query(`SELECT to_regclass('public.release_markers') IS NOT NULL AS ok;`)
      .then((res) => Boolean(res.rows?.[0]?.ok))
      .catch(() => false);
    if (!hasTable) {
      return "";
    }
    const row = await db
      .query(
        `SELECT git_revision
         FROM release_markers
         ORDER BY created_at DESC, id DESC
         LIMIT 1;`
      )
      .then((res) => res.rows?.[0] || null)
      .catch(() => null);
    return sanitizeWebAppVersion(row?.git_revision || "");
  }).catch((err) => {
    logEvent("webapp_version_db_failed", { error: String(err?.message || err) });
    return "";
  });
  if (dbVersion) {
    WEBAPP_VERSION_CACHE.value = dbVersion;
    WEBAPP_VERSION_CACHE.source = "release_marker";
    WEBAPP_VERSION_CACHE.expiresAt = now + WEBAPP_VERSION_CACHE_TTL_MS;
    return { version: dbVersion, source: "release_marker" };
  }

  const releaseVersion = sanitizeWebAppVersion(appConfig.releaseGitRevision);
  if (releaseVersion) {
    return { version: releaseVersion, source: "release_env" };
  }

  return {
    version: sanitizeWebAppVersion(WEBAPP_VERSION_STARTUP_TS) || "startup",
    source: "startup_timestamp"
  };
}

async function fetchBootstrapWebAppUrl(appConfig, telegramId) {
  if (!appConfig.webappPublicUrl || !appConfig.webappHmacSecret) {
    return "";
  }
  const uid = String(telegramId || "").trim();
  if (!uid) {
    return "";
  }
  let origin;
  try {
    origin = new URL(appConfig.webappPublicUrl).origin;
  } catch {
    return "";
  }
  const cacheKey = `${origin}:${uid}`;
  const cached = WEBAPP_BOOTSTRAP_CACHE.get(cacheKey);
  if (cached && Date.now() < Number(cached.expiresAt || 0)) {
    return String(cached.url || "");
  }

  const ts = Date.now().toString();
  const sig = signWebAppPayload(uid, ts, appConfig.webappHmacSecret);
  const endpointPaths = ["/webapp/api/v2/bootstrap", "/webapp/api/bootstrap"];
  for (const endpointPath of endpointPaths) {
    const endpoint = new URL(endpointPath, origin);
    endpoint.searchParams.set("uid", uid);
    endpoint.searchParams.set("ts", ts);
    endpoint.searchParams.set("sig", sig);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2200);
    try {
      const res = await fetch(endpoint.toString(), {
        method: "GET",
        headers: { accept: "application/json" },
        signal: controller.signal
      });
      if (!res.ok) {
        continue;
      }
      const body = await res.json().catch(() => null);
      const launchUrl = String(body?.data?.webapp_launch_url || body?.webapp_launch_url || "").trim();
      if (!launchUrl) {
        continue;
      }
      WEBAPP_BOOTSTRAP_CACHE.set(cacheKey, {
        url: launchUrl,
        expiresAt: Date.now() + WEBAPP_BOOTSTRAP_CACHE_TTL_MS
      });
      return launchUrl;
    } catch {
      continue;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  return "";
}

async function resolveWebAppLaunchBaseUrl(pool, appConfig, telegramId) {
  const bootstrapUrl = await fetchBootstrapWebAppUrl(appConfig, telegramId);
  if (bootstrapUrl) {
    return bootstrapUrl;
  }
  const versionState = await resolveLocalWebAppVersion(pool, appConfig);
  const versioned = buildVersionedWebAppUrl(appConfig.webappPublicUrl, versionState.version);
  return versioned || String(appConfig.webappPublicUrl || "").trim();
}

async function resolveMiniAppRouteUrl(pool, appConfig, telegramId, navigation = {}) {
  if (!appConfig?.webappPublicUrl || !appConfig?.webappHmacSecret) {
    return null;
  }
  const launchBaseUrl = await resolveWebAppLaunchBaseUrl(pool, appConfig, telegramId);
  return buildSignedWebAppUrl(appConfig, telegramId, launchBaseUrl, navigation);
}

async function resolveAdminWorkspaceUrls(pool, appConfig, telegramId) {
  const { admin_workspace = "", admin_queue = "", admin_policy = "", admin_runtime = "" } = await resolveMiniAppAdminLaunchSurfaceBundle(
    pool,
    appConfig,
    telegramId,
    ["admin_workspace", "admin_queue", "admin_policy", "admin_runtime"]
  );
  return {
    adminUrl: admin_workspace,
    queueUrl: admin_queue,
    policyUrl: admin_policy,
    runtimeUrl: admin_runtime
  };
}

async function resolveMiniAppCommandUrlBundle(pool, appConfig, telegramId, entries = []) {
  return resolveLaunchUrlBundle({
    entries,
    resolveNavigation: resolvePlayerCommandNavigation,
    resolveBaseUrl: () => resolveWebAppLaunchBaseUrl(pool, appConfig, telegramId),
    buildSignedUrl: (baseUrl, navigation) => buildSignedWebAppUrl(appConfig, telegramId, baseUrl, navigation)
  });
}

async function resolveMiniAppLaunchSurfaceBundle(pool, appConfig, telegramId, surfaceKeys = []) {
  return resolveMiniAppCommandUrlBundle(pool, appConfig, telegramId, buildLaunchSurfaceEntries(surfaceKeys, PLAYER_LAUNCH_SURFACE_CATALOG));
}

async function resolveMiniAppCommandUrl(pool, appConfig, telegramId, commandKey, overrides = {}) {
  const bundle = await resolveMiniAppCommandUrlBundle(pool, appConfig, telegramId, [{ key: "url", commandKey, overrides }]);
  return bundle.url || null;
}

async function resolveMiniAppAdminCommandUrlBundle(pool, appConfig, telegramId, entries = []) {
  return resolveLaunchUrlBundle({
    entries,
    resolveNavigation: resolveAdminCommandNavigation,
    resolveBaseUrl: () => resolveWebAppLaunchBaseUrl(pool, appConfig, telegramId),
    buildSignedUrl: (baseUrl, navigation) => buildSignedWebAppUrl(appConfig, telegramId, baseUrl, navigation)
  });
}

async function resolveMiniAppAdminLaunchSurfaceBundle(pool, appConfig, telegramId, surfaceKeys = []) {
  return resolveMiniAppAdminCommandUrlBundle(pool, appConfig, telegramId, buildLaunchSurfaceEntries(surfaceKeys, ADMIN_LAUNCH_SURFACE_CATALOG));
}

async function resolveMiniAppAdminCommandUrl(pool, appConfig, telegramId, commandKey, overrides = {}) {
  const bundle = await resolveMiniAppAdminCommandUrlBundle(pool, appConfig, telegramId, [{ key: "url", commandKey, overrides }]);
  return bundle.url || null;
}

function buildSignedWebAppUrl(appConfig, telegramId, baseUrlOverride = "", navigation = {}) {
  const baseUrl = String(baseUrlOverride || appConfig.webappPublicUrl || "").trim();
  if (!baseUrl || !appConfig.webappHmacSecret) {
    return null;
  }
  try {
    const url = new URL(baseUrl);
    const ts = Date.now().toString();
    const uid = String(telegramId);
    const sig = signWebAppPayload(uid, ts, appConfig.webappHmacSecret);
    url.searchParams.set("uid", uid);
    url.searchParams.set("ts", ts);
    url.searchParams.set("sig", sig);
    url.searchParams.set("bot", String(appConfig.botUsername || "airdropkral_2026_bot"));
    const startAppPayload = buildStartAppPayload(navigation);
    if (startAppPayload.route_key) {
      url.searchParams.set("route_key", startAppPayload.route_key);
      url.searchParams.set("startapp", encodeStartAppPayload(startAppPayload));
    }
    if (startAppPayload.panel_key) {
      url.searchParams.set("panel_key", startAppPayload.panel_key);
    }
    if (startAppPayload.focus_key) {
      url.searchParams.set("focus_key", startAppPayload.focus_key);
    }
    if (navigation.launchEventKey) {
      url.searchParams.set("launch_event_key", String(navigation.launchEventKey));
    }
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeTxHash(input) {
  return String(input || "").trim();
}

function parseFloatArg(raw) {
  const normalized = String(raw || "").replace(",", ".").trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function parseTokenBuyArgs(text) {
  const parts = String(text || "")
    .split(" ")
    .map((x) => x.trim())
    .filter(Boolean);
  return {
    usdAmount: parseFloatArg(parts[0]),
    chain: String(parts[1] || "").toUpperCase()
  };
}

function parseWords(text) {
  return String(text || "")
    .split(" ")
    .map((x) => x.trim())
    .filter(Boolean);
}

function resolvePreferredLanguage(profile, ctx, fallback = "tr") {
  const resolved = resolveLocalePreference({
    override: "",
    telegramLanguageCode: ctx?.from?.language_code,
    profileLocale: profile?.locale,
    fallback
  });
  return normalizeLanguage(resolved.language, fallback);
}

function parseLanguageChoice(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) {
    return "";
  }
  if (raw.startsWith("tr")) {
    return "tr";
  }
  if (raw.startsWith("en")) {
    return "en";
  }
  return "";
}

function normalizeHelpPage(rawValue, fallback = 1) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    return Math.max(1, Number(fallback || 1));
  }
  return Math.max(1, Math.floor(parsed));
}

function paginateRows(rows, page = 1, pageSize = HELP_INDEX_PAGE_SIZE) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const safePageSize = Math.max(1, Number(pageSize || HELP_INDEX_PAGE_SIZE));
  const totalPages = Math.max(1, Math.ceil(safeRows.length / safePageSize));
  const safePage = Math.max(1, Math.min(totalPages, normalizeHelpPage(page, 1)));
  const start = (safePage - 1) * safePageSize;
  const items = safeRows.slice(start, start + safePageSize);
  return {
    items,
    page: safePage,
    totalPages,
    totalItems: safeRows.length
  };
}

function resolveHelpSource(ctx, fallback = "slash") {
  if (ctx?.callbackQuery) {
    return "callback";
  }
  const text = String(ctx?.message?.text || "").trim();
  if (text.startsWith("/")) {
    return "slash";
  }
  return fallback;
}

function orderedHelpCards(includeAdmin = false, category = "") {
  const order = new Map(COMMAND_REGISTRY.map((row, idx) => [String(row.key || ""), idx]));
  return HELP_CARDS.filter((card) => {
    if (!includeAdmin && card.scope === "admin") {
      return false;
    }
    if (category && String(card.category) !== String(category)) {
      return false;
    }
    return true;
  }).sort((a, b) => {
    const left = order.get(String(a.key || "")) ?? Number.MAX_SAFE_INTEGER;
    const right = order.get(String(b.key || "")) ?? Number.MAX_SAFE_INTEGER;
    return left - right;
  });
}

function buildHelpCategoriesForView(includeAdmin = false, lang = "tr") {
  const cards = orderedHelpCards(includeAdmin);
  const countByCategory = new Map();
  for (const card of cards) {
    countByCategory.set(card.category, Number(countByCategory.get(card.category) || 0) + 1);
  }
  const categories = getHelpCategories({ includeAdmin }).map((category) => ({
    key: category.key,
    label: categoryLabel(category.key, lang),
    count: Number(countByCategory.get(category.key) || 0)
  }));
  return categories.filter((row) => row.count > 0);
}

function logHelpInteractionEvent(eventName, ctx, payload = {}) {
  logEvent(eventName, {
    user_id: Number(ctx?.from?.id || 0),
    locale: String(payload.locale || "tr"),
    query: String(payload.query || ""),
    resolved_key: String(payload.resolvedKey || ""),
    category: String(payload.category || ""),
    source: String(payload.source || "slash")
  });
}

async function resolveHelpViewerContext(ctx, pool, appConfig) {
  const profile = await ensureProfile(pool, ctx).catch(() => null);
  const locale = resolvePreferredLanguage(profile, ctx, "tr");
  const includeAdmin = isAdminCtx(ctx, appConfig);
  return { profile, locale, includeAdmin };
}

function normalizeHelpAlternatives(suggestions = [], includeAdmin = false, fallback = []) {
  const allowed = new Set(orderedHelpCards(includeAdmin).map((card) => String(card.key || "")));
  const out = [];
  const seen = new Set();
  const source = [...(Array.isArray(suggestions) ? suggestions : []), ...(Array.isArray(fallback) ? fallback : [])];
  for (const key of source) {
    const normalized = String(key || "").trim();
    if (!normalized || seen.has(normalized) || !allowed.has(normalized)) {
      continue;
    }
    out.push(normalized);
    seen.add(normalized);
  }
  return out.slice(0, 6);
}

async function sendHelpIndex(ctx, pool, appConfig, payload = {}) {
  const source = String(payload.source || resolveHelpSource(ctx, "slash"));
  const query = String(payload.query || "").trim();
  const requestedCategory = String(payload.category || "core_loop");
  const requestedPage = normalizeHelpPage(payload.page || 1, 1);
  const viewer = payload.viewer || (await resolveHelpViewerContext(ctx, pool, appConfig));
  const categories = buildHelpCategoriesForView(viewer.includeAdmin, viewer.locale);
  const allowedCategorySet = new Set(categories.map((row) => row.key));
  const fallbackCategory = categories[0]?.key || "core_loop";
  const activeCategory = allowedCategorySet.has(requestedCategory) ? requestedCategory : fallbackCategory;
  const allRows = orderedHelpCards(viewer.includeAdmin, activeCategory);
  const paged = paginateRows(allRows, requestedPage, HELP_INDEX_PAGE_SIZE);
  const categoryItems = categories.map((row) => ({
    ...row,
    active: row.key === activeCategory
  }));
  const text = messages.formatHelpIndex({
    lang: viewer.locale,
    categoryLabel: categoryLabel(activeCategory, viewer.locale),
    categories: categoryItems,
    items: paged.items,
    page: paged.page,
    totalPages: paged.totalPages,
    totalItems: paged.totalItems
  });
  const keyboard = buildHelpIndexKeyboard(
    {
      categories: categoryItems,
      activeCategory,
      items: paged.items,
      page: paged.page,
      totalPages: paged.totalPages
    },
    viewer.locale
  );
  logHelpInteractionEvent("help_index_opened", ctx, {
    locale: viewer.locale,
    query,
    category: activeCategory,
    source
  });
  await ctx.replyWithMarkdown(text, keyboard);
}

async function sendHelpCommandCard(ctx, pool, appConfig, payload = {}) {
  const source = String(payload.source || resolveHelpSource(ctx, "slash"));
  const key = String(payload.key || "").trim().toLowerCase();
  const query = String(payload.query || key).trim();
  const fallbackCategory = String(payload.backCategory || "core_loop");
  const fallbackPage = normalizeHelpPage(payload.backPage || 1, 1);
  const viewer = payload.viewer || (await resolveHelpViewerContext(ctx, pool, appConfig));
  const card = HELP_CARD_MAP.get(key);
  if (!card) {
    const suggestions = suggestHelpKeys(query, {
      cards: HELP_CARDS,
      aliasLookup: COMMAND_ALIAS_LOOKUP,
      includeAdmin: viewer.includeAdmin,
      limit: 4
    });
    logHelpInteractionEvent("help_not_found", ctx, {
      locale: viewer.locale,
      query,
      source
    });
    await ctx.replyWithMarkdown(
      messages.formatHelpNotFound({
        lang: viewer.locale,
        query,
        suggestions
      }),
      buildHelpIndexKeyboard(
        {
          categories: buildHelpCategoriesForView(viewer.includeAdmin, viewer.locale).map((row) => ({ ...row, active: row.key === fallbackCategory })),
          activeCategory: fallbackCategory,
          items: paginateRows(orderedHelpCards(viewer.includeAdmin, fallbackCategory), fallbackPage, HELP_INDEX_PAGE_SIZE).items,
          page: fallbackPage,
          totalPages: paginateRows(orderedHelpCards(viewer.includeAdmin, fallbackCategory), fallbackPage, HELP_INDEX_PAGE_SIZE).totalPages
        },
        viewer.locale
      )
    );
    return;
  }
  if (!viewer.includeAdmin && card.scope === "admin") {
    const alternatives = normalizeHelpAlternatives(
      [...(Array.isArray(card.related_commands) ? card.related_commands : []), ...suggestHelpKeys("status", { cards: HELP_CARDS, includeAdmin: false, aliasLookup: COMMAND_ALIAS_LOOKUP, limit: 4 })],
      false,
      ["status", "help", "menu", "tasks", "wallet"]
    );
    logHelpInteractionEvent("help_card_opened", ctx, {
      locale: viewer.locale,
      query,
      resolvedKey: key,
      category: card.category,
      source
    });
    await ctx.replyWithMarkdown(
      messages.formatHelpAccessDenied({
        lang: viewer.locale,
        commandKey: key,
        alternatives
      }),
      buildHelpCommandCardKeyboard(
        {
          relatedCommands: alternatives,
          backCategory: fallbackCategory,
          backPage: fallbackPage
        },
        viewer.locale
      )
    );
    return;
  }
  const categoryRows = orderedHelpCards(viewer.includeAdmin, card.category);
  const cardIndex = Math.max(
    0,
    categoryRows.findIndex((row) => String(row.key || "") === key)
  );
  const page = Math.floor(cardIndex / HELP_INDEX_PAGE_SIZE) + 1;
  const relatedCommands = normalizeHelpAlternatives(card.related_commands, viewer.includeAdmin, ["help", "menu"]);
  const text = messages.formatHelpCommandCard(card, {
    lang: viewer.locale,
    categoryLabel: categoryLabel(card.category, viewer.locale)
  });
  logHelpInteractionEvent("help_card_opened", ctx, {
    locale: viewer.locale,
    query,
    resolvedKey: key,
    category: card.category,
    source
  });
  await ctx.replyWithMarkdown(
    text,
    buildHelpCommandCardKeyboard(
      {
        relatedCommands,
        backCategory: card.category,
        backPage: page
      },
      viewer.locale
    )
  );
}

async function sendHelpFromCommand(ctx, pool, appConfig) {
  const queryRaw = String(extractCommandArgs(ctx) || "").trim();
  const viewer = await resolveHelpViewerContext(ctx, pool, appConfig);
  const resolved = resolveHelpTarget(queryRaw, {
    includeAdmin: viewer.includeAdmin,
    cards: HELP_CARDS,
    cardMap: HELP_CARD_MAP,
    aliasLookup: COMMAND_ALIAS_LOOKUP
  });
  const source = resolveHelpSource(ctx, "text_intent");
  if (resolved.kind === "index") {
    await sendHelpIndex(ctx, pool, appConfig, {
      source,
      query: queryRaw,
      category: resolved.category,
      page: 1,
      viewer
    });
    return;
  }
  if (resolved.kind === "card") {
    await sendHelpCommandCard(ctx, pool, appConfig, {
      source,
      query: queryRaw,
      key: resolved.key,
      viewer
    });
    return;
  }
  if (resolved.kind === "forbidden") {
    const forbiddenCard = HELP_CARD_MAP.get(String(resolved.key || ""));
    const alternatives = normalizeHelpAlternatives(
      [
        ...(Array.isArray(forbiddenCard?.related_commands) ? forbiddenCard.related_commands : []),
        ...suggestHelpKeys("status", {
          cards: HELP_CARDS,
          aliasLookup: COMMAND_ALIAS_LOOKUP,
          includeAdmin: false,
          limit: 4
        })
      ],
      false,
      ["status", "help", "menu", "tasks", "wallet"]
    );
    logHelpInteractionEvent("help_card_opened", ctx, {
      locale: viewer.locale,
      query: queryRaw,
      resolvedKey: resolved.key,
      category: resolved.category,
      source
    });
    await ctx.replyWithMarkdown(
      messages.formatHelpAccessDenied({
        lang: viewer.locale,
        commandKey: resolved.key,
        alternatives
      }),
      buildHelpCommandCardKeyboard(
        {
          relatedCommands: alternatives,
          backCategory: "core_loop",
          backPage: 1
        },
        viewer.locale
      )
    );
    return;
  }
  const suggestions = normalizeHelpAlternatives(resolved.suggestions, viewer.includeAdmin, ["help", "menu", "tasks", "status"]);
  logHelpInteractionEvent("help_not_found", ctx, {
    locale: viewer.locale,
    query: queryRaw,
    source
  });
  await ctx.replyWithMarkdown(
    messages.formatHelpNotFound({
      lang: viewer.locale,
      query: queryRaw,
      suggestions
    }),
    buildHelpCommandCardKeyboard(
      {
        relatedCommands: suggestions,
        backCategory: "core_loop",
        backPage: 1
      },
      viewer.locale
    )
  );
}

async function insertV5Event(pool, sql, params) {
  try {
    await withTransaction(pool, async (db) => {
      await db.query(sql, params);
      return true;
    });
  } catch (err) {
    if (err.code !== "42P01") {
      throw err;
    }
  }
}

async function logV5IntentResolution(pool, ctx, payload = {}) {
  const userId = Number(payload.userId || 0);
  if (!userId) {
    return;
  }
  await insertV5Event(
    pool,
    `INSERT INTO v5_intent_resolution_events (
       user_id,
       input_text,
       normalized_text,
       matched_key,
       resolved_mode,
       confidence,
       source,
       payload_json
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb);`,
    [
      userId,
      String(payload.inputText || ""),
      String(payload.normalizedText || ""),
      String(payload.matchedKey || ""),
      String(payload.resolvedMode || "balanced"),
      Number(payload.confidence || 0),
      String(payload.source || "bot"),
      JSON.stringify({
        telegram_id: Number(ctx?.from?.id || 0),
        locale: String(payload.locale || "tr"),
        action: String(payload.action || ""),
        args_text: String(payload.argsText || ""),
        ts: String(payload.ts || new Date().toISOString())
      })
    ]
  );
}

async function logV5CommandEvent(pool, ctx, payload = {}) {
  const userId = Number(payload.userId || 0);
  if (!userId) {
    return;
  }
  await insertV5Event(
    pool,
    `INSERT INTO v5_command_events (
       user_id,
       command_key,
       handler_key,
       source,
       locale,
       payload_json
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb);`,
    [
      userId,
      String(payload.commandKey || ""),
      String(payload.handlerKey || payload.commandKey || ""),
      String(payload.source || "bot"),
      String(payload.locale || "tr"),
      JSON.stringify({
        telegram_id: Number(ctx?.from?.id || 0),
        text: String(payload.text || ""),
        args_text: String(payload.argsText || ""),
        is_slash: Boolean(payload.isSlash),
        ok: payload.ok == null ? true : Boolean(payload.ok),
        ts: String(payload.ts || new Date().toISOString())
      })
    ]
  );
}

async function safeLogV5IntentResolution(pool, ctx, payload = {}) {
  try {
    await logV5IntentResolution(pool, ctx, payload);
  } catch (err) {
    logEvent("intent_resolution_log_failed", {
      user_id: Number(ctx?.from?.id || 0),
      error: String(err?.message || err),
      matched_key: String(payload.matchedKey || ""),
      source: String(payload.source || "bot")
    });
  }
}

async function safeLogV5CommandEvent(pool, ctx, payload = {}) {
  try {
    await logV5CommandEvent(pool, ctx, payload);
  } catch (err) {
    logEvent("command_event_log_failed", {
      user_id: Number(ctx?.from?.id || 0),
      error: String(err?.message || err),
      command_key: String(payload.commandKey || ""),
      source: String(payload.source || "bot"),
      is_slash: Boolean(payload.isSlash)
    });
  }
}

function parseConfirmArgs(text) {
  const parts = parseWords(text);
  if (parts.length === 0) {
    return { confirmed: false, parts: [] };
  }
  const first = String(parts[0] || "").toLowerCase();
  if (first === "confirm" || first === "onay") {
    return { confirmed: true, parts: parts.slice(1) };
  }
  return { confirmed: false, parts };
}

function buildAdminActionSignature(action, parts = []) {
  return buildAdminPolicySignature(action, { parts });
}

function cleanupAdminConfirmState() {
  const now = Date.now();
  for (const [key, entry] of ADMIN_CONFIRM_STATE.entries()) {
    if (!entry || now > Number(entry.expiresAt || 0)) {
      ADMIN_CONFIRM_STATE.delete(key);
    }
  }
}

async function ensureAdminCriticalReady(ctx, actionName, parts, confirmed, confirmCommandHint) {
  cleanupAdminConfirmState();
  const policy = evaluateAdminPolicy({ action_key: actionName, critical: true, cooldown_ms: ADMIN_COOLDOWN_MS });
  if (!policy.confirmation_required) {
    return true;
  }
  const actorId = Number(ctx.from?.id || 0);
  const signature = buildAdminActionSignature(actionName, parts);
  const key = `${actorId}:${actionName}:${signature}`;
  const now = Date.now();
  if (!confirmed) {
    ADMIN_CONFIRM_STATE.set(key, {
      createdAt: now,
      expiresAt: now + ADMIN_CONFIRM_TTL_MS
    });
    await ctx.replyWithMarkdown(
      `*Onay Gerekli*\n` +
        `Kritik islem iki adimlidir.\n` +
        `90 sn icinde su komutu tekrar gonder:\n` +
        `\`${confirmCommandHint}\``,
      { parse_mode: "Markdown" }
    );
    return false;
  }
  const entry = ADMIN_CONFIRM_STATE.get(key);
  if (!entry || now > Number(entry.expiresAt || 0)) {
    await ctx.replyWithMarkdown("*Onay Suresi Doldu*\nKomutu tekrar onaysiz gonderip yeni onay al.");
    return false;
  }
  ADMIN_CONFIRM_STATE.delete(key);
  return true;
}

async function ensureAdminCriticalReadyFromCallback(ctx, actionName, parts, buttonLabel) {
  cleanupAdminConfirmState();
  const policy = evaluateAdminPolicy({ action_key: actionName, critical: true, cooldown_ms: ADMIN_COOLDOWN_MS });
  if (!policy.confirmation_required) {
    return true;
  }
  const actorId = Number(ctx.from?.id || 0);
  const signature = buildAdminActionSignature(actionName, parts);
  const key = `${actorId}:${actionName}:${signature}`;
  const now = Date.now();
  const entry = ADMIN_CONFIRM_STATE.get(key);
  if (!entry || now > Number(entry.expiresAt || 0)) {
    ADMIN_CONFIRM_STATE.set(key, {
      createdAt: now,
      expiresAt: now + ADMIN_CONFIRM_TTL_MS
    });
    await ctx.replyWithMarkdown(
      `*Onay Gerekli*\n` +
        `Kritik aksiyon icin 90 sn icinde ayni butona tekrar tikla.\n` +
        `Aksiyon: *${String(buttonLabel || actionName)}*`
    );
    return false;
  }
  ADMIN_CONFIRM_STATE.delete(key);
  return true;
}

async function enforceAdminRateLimit(ctx, actionName) {
  const policy = evaluateAdminPolicy({ action_key: actionName, cooldown_ms: ADMIN_COOLDOWN_MS });
  const cooldownMs = Math.max(1000, Number(policy.cooldown_ms || ADMIN_COOLDOWN_MS));
  const actorId = Number(ctx.from?.id || 0);
  const key = `${actorId}:${String(actionName || "unknown")}`;
  const now = Date.now();
  const prev = Number(ADMIN_RATE_LIMIT_STATE.get(key) || 0);
  if (prev > 0 && now - prev < cooldownMs) {
    const waitSec = Math.max(1, Math.ceil((cooldownMs - (now - prev)) / 1000));
    await ctx.replyWithMarkdown(`*Rate Limit*\nBu kritik aksiyon icin ${waitSec}s bekle.`);
    return false;
  }
  ADMIN_RATE_LIMIT_STATE.set(key, now);
  return true;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function isAdminCtx(ctx, appConfig) {
  const actorId = Number(ctx.from?.id || 0);
  return actorId > 0 && String(actorId) === String(appConfig.adminTelegramId || "");
}

async function ensureAdminCtx(ctx, appConfig) {
  if (isAdminCtx(ctx, appConfig)) {
    return true;
  }
  await ctx.replyWithMarkdown(
    `*Admin Yetkisi Gerekli*\n` +
      `Bu komut sadece admin hesap icin aciktir.\n` +
      `Kontrol: /whoami`
  );
  return false;
}

async function writeConfigVersion(db, appConfig, configKey, configJson) {
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
    [configKey, nextVersion, JSON.stringify(configJson), Number(appConfig.adminTelegramId || 0)]
  );
  return nextVersion;
}

async function updateEconomyConfigByAdmin(db, appConfig, patchFn, auditAction, auditMeta) {
  const current = await configService.getEconomyConfig(db, { forceRefresh: true });
  const next = cloneJson(current);
  patchFn(next);
  const version = await writeConfigVersion(db, appConfig, configService.ECONOMY_CONFIG_KEY, next);
  await db.query(
    `INSERT INTO admin_audit (admin_id, action, target, payload_json)
     VALUES ($1, $2, $3, $4::jsonb);`,
    [
      Number(appConfig.adminTelegramId || 0),
      auditAction,
      "config:economy_params",
      JSON.stringify({ version, ...(auditMeta || {}) })
    ]
  );
  const reloaded = await configService.getEconomyConfig(db, { forceRefresh: true });
  return { version, config: reloaded };
}

function logEvent(event, payload) {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      event,
      ...payload
    })
  );
}

async function tryAcquireBotRuntimeLease(pool, payload) {
  try {
    return await withTransaction(pool, async (db) => {
      const hasTables = await botRuntimeStore.hasBotRuntimeTables(db);
      if (!hasTables) {
        return { acquired: false, reason: "runtime_tables_missing", state: null };
      }
      const state = await botRuntimeStore.tryAcquireRuntimeLease(db, payload);
      if (state) {
        return { acquired: true, reason: "", state };
      }
      const current = await botRuntimeStore.getRuntimeState(db, payload?.stateKey || botRuntimeStore.DEFAULT_STATE_KEY);
      return { acquired: false, reason: "lock_not_acquired", state: current };
    });
  } catch (err) {
    if (err?.code === "42P01") {
      return { acquired: false, reason: "runtime_tables_missing", state: null };
    }
    logEvent("bot_runtime_lease_acquire_failed", {
      error: String(err?.message || err),
      state_key: String(payload?.stateKey || botRuntimeStore.DEFAULT_STATE_KEY)
    });
    return { acquired: false, reason: "lease_acquire_failed", state: null };
  }
}

async function renewBotRuntimeLease(pool, payload) {
  try {
    return await withTransaction(pool, async (db) => {
      const hasTables = await botRuntimeStore.hasBotRuntimeTables(db);
      if (!hasTables) {
        return null;
      }
      return botRuntimeStore.renewRuntimeLease(db, payload);
    });
  } catch (err) {
    if (err?.code === "42P01") {
      return null;
    }
    logEvent("bot_runtime_lease_renew_failed", {
      error: String(err?.message || err),
      state_key: String(payload?.stateKey || botRuntimeStore.DEFAULT_STATE_KEY)
    });
    return null;
  }
}

async function releaseBotRuntimeLease(pool, payload) {
  try {
    return await withTransaction(pool, async (db) => {
      const hasTables = await botRuntimeStore.hasBotRuntimeTables(db);
      if (!hasTables) {
        return null;
      }
      return botRuntimeStore.releaseRuntimeLease(db, payload);
    });
  } catch (err) {
    if (err?.code === "42P01") {
      return null;
    }
    logEvent("bot_runtime_lease_release_failed", {
      error: String(err?.message || err),
      state_key: String(payload?.stateKey || botRuntimeStore.DEFAULT_STATE_KEY)
    });
    return null;
  }
}

async function upsertBotRuntimeState(pool, payload) {
  try {
    return await withTransaction(pool, async (db) => {
      const hasTables = await botRuntimeStore.hasBotRuntimeTables(db);
      if (!hasTables) {
        return null;
      }
      return botRuntimeStore.upsertRuntimeState(db, payload);
    });
  } catch (err) {
    if (err?.code === "42P01") {
      return null;
    }
    logEvent("bot_runtime_state_failed", { error: String(err?.message || err) });
    return null;
  }
}

async function appendBotRuntimeEvent(pool, payload) {
  try {
    return await withTransaction(pool, async (db) => {
      const hasTables = await botRuntimeStore.hasBotRuntimeTables(db);
      if (!hasTables) {
        return null;
      }
      return botRuntimeStore.insertRuntimeEvent(db, payload);
    });
  } catch (err) {
    if (err?.code === "42P01") {
      return null;
    }
    logEvent("bot_runtime_event_failed", { error: String(err?.message || err), event_type: payload?.eventType });
    return null;
  }
}

async function captureStartupFailure(err, extra = {}) {
  const databaseUrl = String(process.env.DATABASE_URL || "").trim();
  if (!databaseUrl) {
    return;
  }
  const runtimePool = createPool({ databaseUrl, ssl: process.env.DATABASE_SSL === "1" });
  const adminRaw = String(process.env.ADMIN_TELEGRAM_ID || "").trim();
  const adminId = /^\d+$/.test(adminRaw) ? Number(adminRaw) : 0;
  const runtimeIdentity = {
    stateKey: String(process.env.BOT_RUNTIME_STATE_KEY || botRuntimeStore.DEFAULT_STATE_KEY).trim() || "primary",
    serviceName: "airdropkral-bot",
    lockKey: Number(process.env.BOT_INSTANCE_LOCK_KEY || 7262026),
    instanceRef: String(
      process.env.RENDER_DEPLOY_ID || process.env.RENDER_SERVICE_ID || process.env.RELEASE_GIT_REVISION || process.pid
    ).trim(),
    pid: process.pid,
    hostname: os.hostname(),
    serviceEnv: String(process.env.NODE_ENV || "development"),
    updatedBy: Number.isSafeInteger(adminId) ? adminId : 0
  };
  try {
    await upsertBotRuntimeState(runtimePool, {
      ...runtimeIdentity,
      mode: "disabled",
      alive: false,
      lockAcquired: false,
      stoppedAt: new Date(),
      lastHeartbeatAt: new Date(),
      lastError: String(err?.message || err || "startup_failed"),
      stateJson: {
        phase: "startup_failed",
        ...extra
      }
    });
    await appendBotRuntimeEvent(runtimePool, {
      stateKey: runtimeIdentity.stateKey,
      eventType: "startup_failed",
      eventJson: {
        error: String(err?.message || err || "startup_failed"),
        ...extra
      }
    });
  } catch {}
  try {
    await runtimePool.end();
  } catch {}
}

function formatReward(reward) {
  const parts = [];
  if (reward.sc > 0) parts.push(`${reward.sc} SC`);
  if (reward.hc > 0) parts.push(`${reward.hc} HC`);
  if (reward.rc > 0) parts.push(`${reward.rc} RC`);
  if (parts.length === 0) return "0";
  return parts.join(" + ");
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
  const next = {
    sc: Math.max(0, Math.round(Number(reward.sc || 0) * safeMode.rewardMultiplier)),
    hc: Number(reward.hc || 0),
    rc: Math.max(0, Math.round(Number(reward.rc || 0) * (1 + (safeMode.rewardMultiplier - 1) * 0.5)))
  };
  return next;
}

function computeCombo(results) {
  let combo = 0;
  for (const result of results || []) {
    if (result === "success") {
      combo += 1;
    } else {
      break;
    }
  }
  return combo;
}

function applyComboToReward(reward, combo) {
  if (combo <= 1) {
    return {
      reward,
      multiplier: 1
    };
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

function legacyTaskProbabilities(difficulty, streak) {
  const pSuccess = Math.max(0.45, Math.min(0.9, 0.68 + Math.min(0.12, streak * 0.01) - difficulty * 0.25));
  const pNearMiss = 0.2;
  const pFail = Math.max(0, 1 - pSuccess - pNearMiss);
  return { pSuccess, pNearMiss, pFail };
}

function legacyRollTaskResult(difficulty, streak) {
  const probabilities = legacyTaskProbabilities(difficulty, streak);
  const roll = Math.random();
  if (roll < probabilities.pSuccess) return { result: "success", probabilities, roll };
  if (roll < probabilities.pSuccess + probabilities.pNearMiss) return { result: "near_miss", probabilities, roll };
  return { result: "fail", probabilities, roll };
}

function legacyRewardForTier(tier, result) {
  let reward;
  if (tier === "legendary") reward = { sc: 10, hc: 3, rc: 10 };
  else if (tier === "rare") reward = { sc: 5, hc: 1, rc: 4 };
  else if (tier === "uncommon") reward = { sc: 2, hc: 0, rc: 2 };
  else reward = { sc: 1, hc: 0, rc: 1 };

  if (result === "near_miss") {
    reward.sc = Math.max(1, Math.floor(reward.sc * 0.7));
    reward.rc = Math.max(1, Math.floor(reward.rc * 0.5));
  } else if (result === "fail") {
    reward.sc = 0;
    reward.rc = 0;
    if (tier !== "rare" && tier !== "legendary") {
      reward.hc = 0;
    }
  }
  return reward;
}

function legacyRollLootTier({ pityBefore, pityCap, streak, result }) {
  if (pityBefore >= pityCap) {
    return { tier: "rare", roll: 0, forced: true };
  }

  let legendaryBase = 0.0015;
  let rareBase = 0.015;
  let uncommonBase = 0.2;

  if (result === "near_miss") {
    rareBase += 0.005;
  }
  if (result === "fail") {
    legendaryBase = 0;
    rareBase = 0.005;
    uncommonBase = 0.12;
  }

  const streakBoost = Math.min(0.01, Number(streak || 0) * 0.0005);
  legendaryBase += streakBoost * 0.2;
  rareBase += streakBoost;

  const roll = Math.random();
  if (roll < legendaryBase) return { tier: "legendary", roll };
  if (roll < legendaryBase + rareBase) return { tier: "rare", roll };
  if (roll < legendaryBase + rareBase + uncommonBase) return { tier: "uncommon", roll };
  return { tier: "common", roll };
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

async function readLatestReleaseMarkerSummary(db) {
  try {
    const hasTable = await db
      .query(`SELECT to_regclass('public.release_markers') IS NOT NULL AS ok;`)
      .then((res) => Boolean(res.rows?.[0]?.ok))
      .catch(() => false);
    if (!hasTable) {
      return null;
    }
    const row = await db
      .query(
        `SELECT release_ref, git_revision, created_at
         FROM release_markers
         ORDER BY created_at DESC, id DESC
         LIMIT 1;`
      )
      .then((res) => res.rows?.[0] || null);
    if (!row) return null;
    return {
      releaseRef: String(row.release_ref || ""),
      gitRevision: String(row.git_revision || ""),
      createdAt: row.created_at || null
    };
  } catch (err) {
    if (String(err?.code || "") === "42P01") {
      return null;
    }
    throw err;
  }
}

async function readBotFeatureFlagSummary(db) {
  const sourceMode = String(process.env.FLAG_SOURCE_MODE || "env_locked").trim().toLowerCase() || "env_locked";
  const rowsByKey = new Map();
  try {
    const hasTable = await db
      .query(`SELECT to_regclass('public.feature_flags') IS NOT NULL AS ok;`)
      .then((res) => Boolean(res.rows?.[0]?.ok))
      .catch(() => false);
    if (hasTable) {
      const res = await db.query(
        `SELECT flag_key, enabled
         FROM feature_flags
         WHERE flag_key = ANY($1::text[]);`,
        [BOT_CRITICAL_FLAG_KEYS]
      );
      for (const row of res.rows || []) {
        rowsByKey.set(String(row.flag_key || ""), Boolean(row.enabled));
      }
    }
  } catch (err) {
    if (String(err?.code || "") !== "42P01") {
      throw err;
    }
  }

  const critical = BOT_CRITICAL_FLAG_KEYS.map((key) => {
    const envEnabled = String(process.env[key] || "0").trim() === "1";
    const dbEnabled = rowsByKey.has(key) ? Boolean(rowsByKey.get(key)) : null;
    const effective = sourceMode === "env_locked" ? envEnabled : dbEnabled == null ? envEnabled : dbEnabled;
    return {
      key,
      enabled: Boolean(effective),
      env_enabled: envEnabled,
      db_enabled: dbEnabled
    };
  });
  return {
    sourceMode,
    critical
  };
}

async function playRevealAnimation(ctx, paceMs) {
  const safePace = Array.isArray(paceMs) && paceMs.length > 0 ? paceMs : [250, 450, 700];
  const frames = [
    "*Reveal Matrix*\nSignal kilidi ##--------",
    "*Reveal Matrix*\nEntropi tarama #####-----",
    "*Reveal Matrix*\nDrop sifresi #######---",
    "*Reveal Matrix*\nKasacik aciliyor ##########"
  ];

  let message = null;
  try {
    message = await ctx.replyWithMarkdown(frames[0]);
  } catch (err) {
    return;
  }

  for (let i = 1; i < frames.length; i += 1) {
    await delay(Number(safePace[Math.min(i - 1, safePace.length - 1)] || 300));
    try {
      await ctx.telegram.editMessageText(ctx.chat.id, message.message_id, undefined, frames[i], {
        parse_mode: "Markdown"
      });
    } catch (err) {
      // Ignore edit failures; animation is best effort.
    }
  }
}

async function ensureProfileTx(db, ctx) {
  const telegramId = ctx.from?.id;
  if (!telegramId) {
    throw new Error("Missing Telegram user id");
  }
  const locale = ctx.from?.language_code || null;
  const timezone = null;
  const publicName = normalizePublicName(ctx);
  const user = await userStore.upsertUser(db, { telegramId, locale, timezone });
  await userStore.upsertIdentity(db, { userId: user.id, publicName });
  await userStore.ensureStreak(db, { userId: user.id });
  return userStore.getProfileByTelegramId(db, telegramId);
}

async function ensureProfile(pool, ctx) {
  return withTransaction(pool, (db) => ensureProfileTx(db, ctx));
}

function resolveLiveContract(runtimeConfig, season, anomaly) {
  const contract = nexusContractEngine.resolveDailyContract(runtimeConfig, {
    seasonId: season?.seasonId || 0,
    anomalyId: anomaly?.id || "none"
  });
  return nexusContractEngine.publicContractView(contract);
}

async function getSnapshot(pool, ctx) {
  return withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    const balances = await economyStore.getBalances(db, profile.user_id);
    const dailyRaw = await economyStore.getTodayCounter(db, profile.user_id);
    const runtimeConfig = await configService.getEconomyConfig(db);
    const dailyCap = economyEngine.getDailyCap(runtimeConfig, profile.kingdom_tier);
    const season = seasonStore.getSeasonInfo(runtimeConfig);
    const anomaly = nexusEventEngine.publicAnomalyView(
      nexusEventEngine.resolveDailyAnomaly(runtimeConfig, {
        seasonId: season.seasonId
      })
    );
    const contract = resolveLiveContract(runtimeConfig, season, anomaly);
    return {
      profile,
      balances,
      season,
      anomaly,
      contract,
      daily: {
        dailyCap,
        tasksDone: Number(dailyRaw.tasks_done || 0),
        scEarned: Number(dailyRaw.sc_earned || 0),
        hcEarned: Number(dailyRaw.hc_earned || 0),
        rcEarned: Number(dailyRaw.rc_earned || 0)
      }
    };
  });
}

async function fetchBotAdminMetrics(db) {
  const core = await db.query(
    `SELECT
        (SELECT COUNT(*)::bigint FROM users) AS users_total,
        (SELECT COUNT(*)::bigint FROM users WHERE last_seen_at >= now() - interval '24 hours') AS users_active_24h,
        (SELECT COUNT(*)::bigint FROM task_attempts WHERE started_at >= now() - interval '24 hours') AS attempts_started_24h,
        (SELECT COUNT(*)::bigint FROM task_attempts WHERE completed_at >= now() - interval '24 hours') AS attempts_completed_24h,
        (SELECT COUNT(*)::bigint FROM loot_reveals WHERE created_at >= now() - interval '24 hours') AS reveals_24h,
        (SELECT COUNT(*)::bigint FROM payout_requests WHERE created_at >= now() - interval '24 hours') AS payouts_requested_24h,
        (SELECT COUNT(*)::bigint FROM payout_requests WHERE status = 'paid' AND created_at >= now() - interval '24 hours') AS payouts_paid_24h,
        (SELECT COALESCE(SUM(amount), 0)::numeric FROM payout_requests WHERE status = 'paid' AND created_at >= now() - interval '24 hours') AS payouts_paid_btc_24h,
        (SELECT COALESCE(SUM(sc_earned), 0)::numeric FROM daily_counters WHERE day_date = CURRENT_DATE) AS sc_today,
        (SELECT COALESCE(SUM(hc_earned), 0)::numeric FROM daily_counters WHERE day_date = CURRENT_DATE) AS hc_today,
        (SELECT COALESCE(SUM(rc_earned), 0)::numeric FROM daily_counters WHERE day_date = CURRENT_DATE) AS rc_today;`
  );
  const out = { ...(core.rows[0] || {}) };
  try {
    const token = await db.query(
      `SELECT
          (SELECT COUNT(*)::bigint FROM token_purchase_requests WHERE created_at >= now() - interval '24 hours') AS token_intents_24h,
          (SELECT COUNT(*)::bigint FROM token_purchase_requests WHERE status = 'approved' AND created_at >= now() - interval '24 hours') AS token_approved_24h,
          (SELECT COALESCE(SUM(usd_amount), 0)::numeric FROM token_purchase_requests WHERE created_at >= now() - interval '24 hours') AS token_usd_volume_24h;`
    );
    Object.assign(out, token.rows[0] || {});
  } catch (err) {
    if (err.code !== "42P01") {
      throw err;
    }
    out.token_intents_24h = 0;
    out.token_approved_24h = 0;
    out.token_usd_volume_24h = 0;
  }
  return out;
}

async function ensureOffersTx(db, profile, options = {}) {
  await taskStore.expireOldOffers(db, profile.user_id);
  let offers = await taskStore.listActiveOffers(db, profile.user_id);
  if (offers.length >= 3) {
    return offers;
  }
  const existingTypes = offers.map((offer) => offer.task_type);
  const needed = 3 - offers.length;
  const picks = taskCatalog.pickTasks(needed, existingTypes, options);
  for (const task of picks) {
    const created = await taskStore.createOffer(db, profile.user_id, task);
    offers.push(created);
  }
  return offers;
}

async function sendTasks(ctx, pool, appConfig) {
  const payload = await withTransaction(pool, async (db) => {
    const runtimeConfig = await configService.getEconomyConfig(db);
    const profile = await ensureProfileTx(db, ctx);
    const freeze = await systemStore.getFreezeState(db);
    if (freeze.freeze) {
      return { freeze };
    }
    const risk = appConfig?.loopV2Enabled ? (await riskStore.getRiskState(db, profile.user_id)).riskScore : 0;
    const offers = await ensureOffersTx(db, profile, {
      kingdomTier: Number(profile.kingdom_tier || 0),
      risk,
      targetSuccess: Number(runtimeConfig.tasks?.target_success_micro || 0.78)
    });
    const season = seasonStore.getSeasonInfo(runtimeConfig);
    const anomaly = nexusEventEngine.publicAnomalyView(
      nexusEventEngine.resolveDailyAnomaly(runtimeConfig, {
        seasonId: season.seasonId
      })
    );
    const contract = resolveLiveContract(runtimeConfig, season, anomaly);
    return { profile, offers, anomaly, contract };
  });

  if (payload.freeze) {
    await ctx.replyWithMarkdown(messages.formatFreezeMessage(payload.freeze.reason));
    return;
  }
  const taskMap = new Map(taskCatalog.getCatalog().map((task) => [task.id, task]));
  const lang = resolvePreferredLanguage(payload.profile, ctx, "tr");
  const tasksUrl = await resolveMiniAppRouteUrl(pool, appConfig, ctx.from?.id, {
    routeKey: CANONICAL_ROUTE_KEY.MISSIONS,
    panelKey: CANONICAL_PANEL_KEY.QUESTS,
    focusKey: "board"
  });
  await ctx.replyWithMarkdown(
    messages.formatTasks(payload.offers, taskMap, {
      anomaly: payload.anomaly,
      contract: payload.contract
    }),
    buildTaskKeyboard(payload.offers, lang, tasksUrl || "")
  );
}

async function rerollTasksTx(db, profile, appConfig, sourceRef) {
  const runtimeConfig = await configService.getEconomyConfig(db);
  const freeze = await systemStore.getFreezeState(db);
  if (freeze.freeze) {
    return { ok: false, reason: "freeze_mode", freeze };
  }

  const rerollCost = 1;
  const refEventId = deterministicUuid(`task_reroll:${profile.user_id}:${sourceRef}`);
  const debit = await economyStore.debitCurrency(db, {
    userId: profile.user_id,
    currency: "RC",
    amount: rerollCost,
    reason: "task_panel_reroll",
    refEventId,
    meta: { source: "task_panel" }
  });
  if (!debit.applied) {
    return { ok: false, reason: debit.reason || "insufficient_rc" };
  }

  await taskStore.rerollOpenOffers(db, profile.user_id);
  const risk = appConfig?.loopV2Enabled ? (await riskStore.getRiskState(db, profile.user_id)).riskScore : 0;
  const offers = await ensureOffersTx(db, profile, {
    kingdomTier: Number(profile.kingdom_tier || 0),
    risk,
    targetSuccess: Number(runtimeConfig.tasks?.target_success_micro || 0.78)
  });
  const season = seasonStore.getSeasonInfo(runtimeConfig);
  const anomaly = nexusEventEngine.publicAnomalyView(
    nexusEventEngine.resolveDailyAnomaly(runtimeConfig, {
      seasonId: season.seasonId
    })
  );
  const contract = resolveLiveContract(runtimeConfig, season, anomaly);
  await riskStore.insertBehaviorEvent(db, profile.user_id, "task_reroll", {
    rc_cost: rerollCost
  });
  return { ok: true, offers, anomaly, contract };
}

async function handleRerollTasks(ctx, pool, appConfig) {
  const payload = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    return rerollTasksTx(db, profile, appConfig, ctx.callbackQuery?.id || Date.now());
  });

  await ctx.answerCbQuery();
  if (!payload.ok) {
    if (payload.reason === "freeze_mode") {
      await ctx.replyWithMarkdown(messages.formatFreezeMessage(payload.freeze.reason));
      return;
    }
    await ctx.replyWithMarkdown("*Yenileme Basarisiz*\nEn az 1 RC gerekli.");
    return;
  }
  const taskMap = new Map(taskCatalog.getCatalog().map((task) => [task.id, task]));
  const tasksUrl = await resolveMiniAppRouteUrl(pool, appConfig, ctx.from?.id, {
    routeKey: CANONICAL_ROUTE_KEY.MISSIONS,
    panelKey: CANONICAL_PANEL_KEY.QUESTS,
    focusKey: "board"
  });
  await ctx.replyWithMarkdown(
    messages.formatTasks(payload.offers, taskMap, {
      anomaly: payload.anomaly,
      contract: payload.contract
    }),
    buildTaskKeyboard(payload.offers, resolvePreferredLanguage(payload.profile, ctx, "tr"), tasksUrl || "")
  );
}

async function handleTaskAccept(ctx, pool, appConfig) {
  const offerId = Number(ctx.match[1]);
  if (!offerId) return;

  const payload = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    const freeze = await systemStore.getFreezeState(db);
    if (freeze.freeze) return { error: "Sistem bakim modunda", freeze };

    const offer = await taskStore.lockOfferForAccept(db, profile.user_id, offerId);
    if (!offer) return { error: "Gorev bulunamadi" };

    if (new Date(offer.expires_at) <= new Date()) {
      await taskStore.expireOldOffers(db, profile.user_id);
      return { error: "Gorev suresi doldu" };
    }

    let attempt = await taskStore.getAttemptByOffer(db, profile.user_id, offerId);
    if (!attempt && offer.offer_state === "offered") {
      await taskStore.markOfferAccepted(db, offerId);
      attempt = await taskStore.createAttempt(db, profile.user_id, offerId);
    } else if (!attempt && offer.offer_state === "accepted") {
      attempt = await taskStore.createAttempt(db, profile.user_id, offerId);
    }

    if (!attempt) {
      return { error: "Gorev bu asamada acilamadi" };
    }

    if (appConfig.loopV2Enabled) {
      await antiAbuseEngine.applyRiskEvent(db, riskStore, await configService.getEconomyConfig(db), {
        userId: profile.user_id,
        eventType: "callback_accept",
        context: { offerId }
      });
    }

    const task = taskCatalog.getTaskById(offer.task_type) || {
      title: offer.task_type,
      durationMinutes: 0,
      rewardPreview: "-"
    };
    return { profile, attempt, task };
  });

  if (payload.error) {
    await ctx.answerCbQuery(payload.error, { show_alert: true });
    return;
  }

  await ctx.answerCbQuery();
  await ctx.replyWithMarkdown(
    messages.formatTaskStarted(payload.task, payload.profile.current_streak),
    buildCompleteKeyboard(payload.attempt.id, resolvePreferredLanguage(payload.profile, ctx, "tr"))
  );
  logEvent("task_accept", {
    user_id: payload.profile.user_id,
    offer_id: offerId,
    attempt_id: payload.attempt.id
  });
}

async function handleTaskComplete(ctx, pool, appConfig) {
  const attemptId = Number(ctx.match[1]);
  const mode = getPlayMode(ctx.match[2]);
  if (!attemptId) return;

  const payload = await withTransaction(pool, async (db) => {
    const runtimeConfig = await configService.getEconomyConfig(db);
    const season = seasonStore.getSeasonInfo(runtimeConfig);
    const anomaly = nexusEventEngine.resolveDailyAnomaly(runtimeConfig, {
      seasonId: season.seasonId
    });
    const contract = nexusContractEngine.resolveDailyContract(runtimeConfig, {
      seasonId: season.seasonId,
      anomalyId: anomaly.id
    });
    const profile = await ensureProfileTx(db, ctx);
    const freeze = await systemStore.getFreezeState(db);
    if (freeze.freeze) return { error: "Sistem bakim modunda", freeze };

    const lockedAttempt = await taskStore.lockAttempt(db, profile.user_id, attemptId);
    if (!lockedAttempt) return { error: "Gorev denemesi bulunamadi" };

    if (lockedAttempt.result !== "pending") {
      if (appConfig.loopV2Enabled) {
        await antiAbuseEngine.applyRiskEvent(db, riskStore, runtimeConfig, {
          userId: profile.user_id,
          eventType: "callback_duplicate",
          context: { attemptId, where: "complete" }
        });
      }
      const recentResults = await taskStore.getRecentAttemptResults(db, profile.user_id, 6);
      return {
        duplicate: true,
        result: lockedAttempt.result,
        probabilities: null,
        attemptId,
        modeLabel: mode.label,
        combo: computeCombo(recentResults),
        anomaly: nexusEventEngine.publicAnomalyView(anomaly),
        contract: nexusContractEngine.publicContractView(contract)
      };
    }

    const offer = await taskStore.getOffer(db, profile.user_id, lockedAttempt.task_offer_id);
    const task = taskCatalog.getTaskById(offer?.task_type || "") || { difficulty: Number(offer?.difficulty || 0.4) };
    const taskFamily = String(task.family || "core").toLowerCase();
    const baseDifficulty = Number(task.difficulty || offer?.difficulty || 0.4);
    const safeDifficulty = economyEngine.clamp(baseDifficulty + mode.difficultyDelta, 0, 1);
    const risk = appConfig.loopV2Enabled ? (await riskStore.getRiskState(db, profile.user_id)).riskScore : 0;
    const effectiveRisk = nexusEventEngine.applyRiskShift(risk, anomaly);
    let roll;
    let probabilities;
    if (appConfig.loopV2Enabled) {
      probabilities = economyEngine.getTaskProbabilities(runtimeConfig, {
        difficulty: safeDifficulty,
        streak: Number(profile.current_streak || 0),
        risk: effectiveRisk
      });
      roll = economyEngine.rollTaskResult(probabilities);
    } else {
      roll = legacyRollTaskResult(safeDifficulty, Number(profile.current_streak || 0));
      probabilities = roll.probabilities;
    }
    const durationSec = Math.max(
      0,
      Math.floor((Date.now() - new Date(lockedAttempt.started_at).getTime()) / 1000)
    );
    const qualityScore = Number((0.55 + Math.random() * 0.4).toFixed(3));
    const contractEval = nexusContractEngine.evaluateAttempt(contract, {
      modeKey: mode.key,
      family: taskFamily,
      result: roll.result
    });

    const completed = await taskStore.completeAttemptIfPending(db, attemptId, roll.result, qualityScore, {
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
      const current = await taskStore.getAttempt(db, profile.user_id, attemptId);
      const recentResults = await taskStore.getRecentAttemptResults(db, profile.user_id, 6);
      return {
        duplicate: true,
        result: current?.result || "pending",
        probabilities,
        attemptId,
        modeLabel: mode.label,
        combo: computeCombo(recentResults),
        anomaly: nexusEventEngine.publicAnomalyView(anomaly),
        contract: nexusContractEngine.publicContractView(contract)
      };
    }

    await taskStore.markOfferConsumed(db, lockedAttempt.task_offer_id);
    await economyStore.incrementDailyTasks(db, profile.user_id, 1);

    const recentResults = await taskStore.getRecentAttemptResults(db, profile.user_id, 6);
    const combo = computeCombo(recentResults);
    const contractFinalEval = nexusContractEngine.evaluateAttempt(contract, {
      modeKey: mode.key,
      family: taskFamily,
      result: roll.result,
      combo
    });

    if (appConfig.loopV2Enabled) {
      await antiAbuseEngine.applyRiskEvent(db, riskStore, runtimeConfig, {
        userId: profile.user_id,
        eventType: "task_complete",
        context: { attemptId, durationSec, result: roll.result, play_mode: mode.key, combo }
      });
    }

    return {
      duplicate: false,
      result: roll.result,
      probabilities,
        attemptId,
        profile,
        modeLabel: mode.label,
        modeKey: mode.key,
        combo,
        anomaly: nexusEventEngine.publicAnomalyView(anomaly),
        contract: nexusContractEngine.publicContractView(contract, contractFinalEval)
      };
  });

  if (payload.error) {
    await ctx.answerCbQuery(payload.error, { show_alert: true });
    return;
  }

  await ctx.answerCbQuery();
  await ctx.replyWithMarkdown(
    messages.formatTaskComplete(payload.result, payload.probabilities, {
      modeLabel: payload.modeLabel,
      combo: payload.combo,
      anomaly: payload.anomaly,
      contract: payload.contract
    })
  );
  await delay(350);
  await ctx.replyWithMarkdown("*Isleniyor...*");
  await delay(400);
  await ctx.replyWithMarkdown("Reveal hazir.", buildRevealKeyboard(attemptId));

  logEvent("task_complete", {
    attempt_id: attemptId,
    result: payload.result,
    duplicate: payload.duplicate,
    nexus_anomaly_id: payload.anomaly?.id || null,
    nexus_contract_id: payload.contract?.id || null,
    nexus_contract_match: Boolean(payload.contract?.match?.matched)
  });
}

function calculatePityBefore(recentTiers) {
  let pityBefore = 0;
  for (const tier of recentTiers) {
    if (tier === "rare" || tier === "legendary") {
      break;
    }
    pityBefore += 1;
  }
  return pityBefore;
}

function buildDailyView(runtimeConfig, profile, dailyRaw) {
  return {
    dailyCap: economyEngine.getDailyCap(runtimeConfig, profile.kingdom_tier),
    tasksDone: Number(dailyRaw.tasks_done || 0),
    scEarned: Number(dailyRaw.sc_earned || 0),
    hcEarned: Number(dailyRaw.hc_earned || 0),
    rcEarned: Number(dailyRaw.rc_earned || 0)
  };
}

function recommendModeFromRisk(riskScore) {
  const risk = Number(riskScore || 0);
  if (risk >= 0.35) return "safe";
  if (risk >= 0.18) return "balanced";
  return "aggressive";
}

function buildNexusTactical(snapshot, anomaly, contract) {
  const hasReveal = Boolean(snapshot?.attempts?.revealable);
  const hasActive = Boolean(snapshot?.attempts?.active);
  const hasOffers = Array.isArray(snapshot?.offers) && snapshot.offers.length > 0;
  const mode = contract?.required_mode || anomaly?.preferred_mode || recommendModeFromRisk(snapshot?.riskScore || 0);
  if (hasReveal) {
    return { recommended_mode: mode, next_step: "reveal" };
  }
  if (hasActive) {
    return { recommended_mode: mode, next_step: `finish ${mode}` };
  }
  if (hasOffers) {
    return { recommended_mode: mode, next_step: "tasks" };
  }
  return { recommended_mode: mode, next_step: "tasks reroll" };
}

async function sendNexus(ctx, pool, appConfig) {
  const payload = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    const runtimeConfig = await configService.getEconomyConfig(db);
    const season = seasonStore.getSeasonInfo(runtimeConfig);
    const anomaly = nexusEventEngine.publicAnomalyView(
      nexusEventEngine.resolveDailyAnomaly(runtimeConfig, {
        seasonId: season.seasonId
      })
    );
    const contract = resolveLiveContract(runtimeConfig, season, anomaly);
    const risk = appConfig.loopV2Enabled ? await riskStore.getRiskState(db, profile.user_id) : { riskScore: 0 };
    const offers = await taskStore.listActiveOffers(db, profile.user_id);
    const activeAttempt = await taskStore.getLatestPendingAttempt(db, profile.user_id);
    const revealable = await taskStore.getLatestRevealableAttempt(db, profile.user_id);
    const tactical = buildNexusTactical(
      {
        offers,
        attempts: { active: activeAttempt, revealable },
        riskScore: Number(risk.riskScore || 0)
      },
      anomaly,
      contract
    );
    return { profile, anomaly, contract, tactical };
  });

  const lang = resolvePreferredLanguage(payload.profile, ctx, "tr");
  const { status_hub = "", discover_panel = "" } = await resolveMiniAppLaunchSurfaceBundle(pool, appConfig, ctx.from?.id, [
    "status_hub",
    "discover_panel"
  ]);
  await ctx.replyWithMarkdown(
    messages.formatNexusPulse(payload),
    buildStatusKeyboard(status_hub, discover_panel, lang) || buildGuideKeyboard(lang)
  );
}

async function sendRaidContract(ctx, pool) {
  const payload = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    const runtimeConfig = await configService.getEconomyConfig(db);
    const season = seasonStore.getSeasonInfo(runtimeConfig);
    const anomaly = nexusEventEngine.publicAnomalyView(
      nexusEventEngine.resolveDailyAnomaly(runtimeConfig, {
        seasonId: season.seasonId
      })
    );
    const contract = resolveLiveContract(runtimeConfig, season, anomaly);
    const risk = await riskStore.getRiskState(db, profile.user_id).catch(() => ({ riskScore: 0 }));
    const tactical = buildNexusTactical(
      {
        offers: [],
        attempts: {},
        riskScore: Number(risk.riskScore || 0)
      },
      anomaly,
      contract
    );
    const war = await globalStore.getWarState(db).catch(() => ({
      tier: "seed",
      value: 0
    }));
    return {
      profile,
      anomaly,
      contract,
      tactical,
      risk: Number(risk.riskScore || 0),
      war
    };
  });
  await ctx.replyWithMarkdown(messages.formatRaidContract(payload));
}

async function sendUiMode(ctx, pool) {
  const payload = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    const prefs = await webappStore.getUserUiPrefs(db, profile.user_id).catch((err) => {
      if (err.code === "42P01") return null;
      throw err;
    });
    const perf = await webappStore.getLatestPerfProfile(db, profile.user_id, "").catch((err) => {
      if (err.code === "42P01") return null;
      throw err;
    });
    return { profile, prefs, perf };
  });
  await ctx.replyWithMarkdown(messages.formatUiMode(payload.profile, payload.prefs, payload.perf), {
    parse_mode: "Markdown"
  });
}

async function sendPerf(ctx, pool) {
  const payload = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    const perf = await webappStore.getLatestPerfProfile(db, profile.user_id, "").catch((err) => {
      if (err.code === "42P01") return null;
      throw err;
    });
    const external = await webappStore.getLatestExternalApiHealth(db, 4).catch((err) => {
      if (err.code === "42P01") return [];
      throw err;
    });
    const runtimeConfig = await configService.getEconomyConfig(db);
    const freeze = await systemStore.getFreezeState(db).catch(() => ({ freeze: false, reason: "" }));
    return {
      profile,
      perf,
      external,
      freeze,
      token: tokenEngine.normalizeTokenConfig(runtimeConfig)
    };
  });
  await ctx.replyWithMarkdown(messages.formatPerf(payload));
}

async function handleReveal(ctx, pool, appConfig) {
  const attemptId = Number(ctx.match[1]);
  if (!attemptId) return;

  await ctx.answerCbQuery();
  const preConfig = await withTransaction(pool, (db) => configService.getEconomyConfig(db));
  await playRevealAnimation(ctx, preConfig.loops?.micro?.reveal_pace_ms);

  const payload = await withTransaction(pool, async (db) => {
    const runtimeConfig = await configService.getEconomyConfig(db);
    const season = seasonStore.getSeasonInfo(runtimeConfig);
    const anomaly = nexusEventEngine.resolveDailyAnomaly(runtimeConfig, {
      seasonId: season.seasonId
    });
    const contract = nexusContractEngine.resolveDailyContract(runtimeConfig, {
      seasonId: season.seasonId,
      anomalyId: anomaly.id
    });
    const profile = await ensureProfileTx(db, ctx);
    const freeze = await systemStore.getFreezeState(db);
    if (freeze.freeze) return { error: "Sistem bakim modunda", freeze };

    if (appConfig.loopV2Enabled) {
      await antiAbuseEngine.applyRiskEvent(db, riskStore, runtimeConfig, {
        userId: profile.user_id,
        eventType: "callback_reveal",
        context: { attemptId }
      });
    }

    const attempt = await taskStore.lockAttempt(db, profile.user_id, attemptId);
    if (!attempt || attempt.result === "pending") {
      return { error: "Gorev tamamlanmamis" };
    }

    const existingLoot = await taskStore.getLoot(db, attemptId);
    if (existingLoot) {
      if (appConfig.loopV2Enabled) {
        await antiAbuseEngine.applyRiskEvent(db, riskStore, runtimeConfig, {
          userId: profile.user_id,
          eventType: "reveal_duplicate",
          context: { attemptId }
        });
      }
      const balances = await economyStore.getBalances(db, profile.user_id);
      const dailyRaw = await economyStore.getTodayCounter(db, profile.user_id);
      return {
        profile,
        balances,
        daily: buildDailyView(runtimeConfig, profile, dailyRaw),
        loot: existingLoot,
        reward: parseRewardFromMeta(existingLoot.rng_rolls_json, existingLoot.loot_tier),
        combo: Number(existingLoot.rng_rolls_json?.combo_count || 0),
        modeLabel: existingLoot.rng_rolls_json?.play_mode_label || "Dengeli",
        boostLevel: Number(existingLoot.rng_rolls_json?.effect_sc_boost || 0),
        hiddenBonusHit: Boolean(existingLoot.rng_rolls_json?.hidden_bonus_hit),
        anomaly: nexusEventEngine.publicAnomalyView(anomaly),
        contract: nexusContractEngine.publicContractView(contract, existingLoot.rng_rolls_json?.nexus_contract_eval || null),
        existing: true
      };
    }

    const offer = await taskStore.getOffer(db, profile.user_id, attempt.task_offer_id);
    const difficulty = Number(offer?.difficulty || 0.4);
    const task = taskCatalog.getTaskById(offer?.task_type || "");
    const taskFamily = String(task?.family || "core").toLowerCase();
    const dailyRaw = await economyStore.getTodayCounter(db, profile.user_id);
    const activeEffects = await shopStore.getActiveEffects(db, profile.user_id);
    const playMode = getPlayMode(attempt.anti_abuse_flags?.play_mode || "balanced");
    const recentTiers = await taskStore.getRecentLootTiers(db, profile.user_id, Number(runtimeConfig.economy?.hc?.pity_cap || 40));
    const recentResults = await taskStore.getRecentAttemptResults(db, profile.user_id, 12);
    const combo = computeCombo(recentResults);
    const pityBefore = calculatePityBefore(recentTiers);
    const risk = appConfig.loopV2Enabled ? (await riskStore.getRiskState(db, profile.user_id)).riskScore : 0;
    const effectiveRisk = nexusEventEngine.applyRiskShift(risk, anomaly);

    const outcome = appConfig.loopV2Enabled
      ? economyEngine.computeRevealOutcome(runtimeConfig, {
          attemptResult: attempt.result,
          difficulty,
          streak: Number(profile.current_streak || 0),
          kingdomTier: Number(profile.kingdom_tier || 0),
          risk: effectiveRisk,
          dailyTasks: Number(dailyRaw.tasks_done || 0),
          pityBefore
        })
      : (() => {
          const pityCap = Number(runtimeConfig.economy?.hc?.pity_cap || 40);
          const legacyTier = legacyRollLootTier({
            pityBefore,
            pityCap,
            streak: Number(profile.current_streak || 0),
            result: attempt.result
          });
          const reward = legacyRewardForTier(legacyTier.tier, attempt.result);
          const gotRareOrBetter = legacyTier.tier === "rare" || legacyTier.tier === "legendary";
          return {
            tier: legacyTier.tier,
            reward,
            pityAfter: gotRareOrBetter ? 0 : pityBefore + 1,
            forcedPity: Boolean(legacyTier.forced),
            lootRoll: legacyTier.roll,
            hardCurrency: {
              pHC: null,
              pityBonus: null
            },
            fatigue: null,
            dailyCap: null
          };
        })();

    const modeAdjustedReward = applyPlayModeToReward(outcome.reward, playMode);
    const boostedReward = appConfig.loopV2Enabled
      ? shopStore.applyEffectsToReward(modeAdjustedReward, activeEffects)
      : modeAdjustedReward;
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
    const createdLoot = await taskStore.createLoot(db, {
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

    if (!createdLoot) {
      const already = await taskStore.getLoot(db, attemptId);
      const balances = await economyStore.getBalances(db, profile.user_id);
      return {
        profile,
        balances,
        daily: buildDailyView(runtimeConfig, profile, dailyRaw),
        loot: already,
        reward: parseRewardFromMeta(already?.rng_rolls_json, already?.loot_tier),
        combo: Number(already?.rng_rolls_json?.combo_count || combo),
        modeLabel: already?.rng_rolls_json?.play_mode_label || playMode.label,
        boostLevel: Number(already?.rng_rolls_json?.effect_sc_boost || boostLevel),
        hiddenBonusHit: Boolean(already?.rng_rolls_json?.hidden_bonus_hit),
        anomaly: nexusEventEngine.publicAnomalyView(anomaly),
        contract: nexusContractEngine.publicContractView(contract, already?.rng_rolls_json?.nexus_contract_eval || contractEval),
        existing: true
      };
    }

    const rewardEventIds = {
      SC: deterministicUuid(`reveal:${attemptId}:SC`),
      HC: deterministicUuid(`reveal:${attemptId}:HC`),
      RC: deterministicUuid(`reveal:${attemptId}:RC`)
    };

    await economyStore.creditReward(db, {
      userId: profile.user_id,
      reward,
      reason: `loot_reveal_${outcome.tier}`,
      meta: { attemptId, tier: outcome.tier },
      refEventIds: rewardEventIds
    });

    await userStore.touchStreakOnAction(db, {
      userId: profile.user_id,
      decayPerDay: Number(runtimeConfig.loops?.meso?.streak_decay_per_day || 1)
    });
    await userStore.addReputation(db, {
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
    await seasonStore.addSeasonPoints(db, {
      userId: profile.user_id,
      seasonId: season.seasonId,
      points: seasonPoints
    });
    await seasonStore.syncIdentitySeasonRank(db, {
      userId: profile.user_id,
      seasonId: season.seasonId
    });

      await riskStore.insertBehaviorEvent(db, profile.user_id, "reveal_result", {
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
    const warCounter = await globalStore.incrementCounter(db, `war_pool_s${season.seasonId}`, warDelta);
    await riskStore.insertBehaviorEvent(db, profile.user_id, "war_contribution", {
      delta: warDelta,
      pool: Number(warCounter.counter_value || 0),
      season_id: season.seasonId
    });

    const balances = await economyStore.getBalances(db, profile.user_id);
    const nextProfile = await userStore.getProfileByTelegramId(db, profile.telegram_id);
    const nextDaily = await economyStore.getTodayCounter(db, profile.user_id);
      return {
        profile: nextProfile,
        balances,
        daily: buildDailyView(runtimeConfig, nextProfile, nextDaily),
        loot: createdLoot,
      reward,
      seasonPoints,
      combo,
      modeLabel: playMode.label,
        boostLevel,
        hiddenBonusHit: hiddenBonus.hit,
        warDelta,
        warPool: Number(warCounter.counter_value || 0),
        anomaly: nexusEventEngine.publicAnomalyView(anomaly),
        contract: nexusContractEngine.publicContractView(contract, contractEval),
        existing: false
      };
  });

  if (payload.error) {
    await ctx.replyWithMarkdown(payload.error);
    return;
  }

  const runtimeConfig = await withTransaction(pool, (db) => configService.getEconomyConfig(db));
  const rewardLine = formatReward(payload.reward);

  await ctx.replyWithMarkdown(
    messages.formatLootReveal(
      payload.loot.loot_tier,
      rewardLine,
      payload.loot.pity_counter_after,
      Number(runtimeConfig.economy?.hc?.pity_cap || 40),
      payload.balances,
      Number(payload.seasonPoints || 0),
      {
        boost: Number(payload.boostLevel || 0),
        hidden: Boolean(payload.hiddenBonusHit),
        modeLabel: payload.modeLabel || "Dengeli",
        combo: Number(payload.combo || 0),
        warDelta: Number(payload.warDelta || 0),
        warPool: Number(payload.warPool || 0),
        anomalyTitle: payload.anomaly?.title || payload.loot?.rng_rolls_json?.nexus_anomaly_title || "",
        anomalyMode: payload.anomaly?.preferred_mode || "balanced",
        contractTitle: payload.contract?.title || payload.loot?.rng_rolls_json?.nexus_contract_title || "",
        contractMatch: Boolean(payload.contract?.match?.matched || payload.loot?.rng_rolls_json?.nexus_contract_eval?.matched)
      }
    ),
    buildPostRevealKeyboard(resolvePreferredLanguage(payload.profile, ctx, "tr"))
  );

  logEvent("reveal", {
    attempt_id: attemptId,
    tier: payload.loot.loot_tier,
    existing: payload.existing,
    reward: payload.reward,
    season_points: payload.seasonPoints || 0,
    combo: payload.combo || 0,
    mode: payload.modeLabel || "Dengeli",
    war_delta: payload.warDelta || 0,
    nexus_anomaly_id: payload.anomaly?.id || null,
    nexus_contract_id: payload.contract?.id || null,
    nexus_contract_match: Boolean(payload.contract?.match?.matched)
  });
}

async function sendProfile(ctx, pool, appConfig) {
  const snapshot = await getSnapshot(pool, ctx);
  const lang = resolvePreferredLanguage(snapshot.profile, ctx, "tr");
  const { profile_hub = "", wallet_panel = "" } = await resolveMiniAppLaunchSurfaceBundle(pool, appConfig, ctx.from?.id, [
    "profile_hub",
    "wallet_panel"
  ]);
  await ctx.replyWithMarkdown(
    messages.formatProfile(snapshot.profile, snapshot.balances),
    buildProfileKeyboard(profile_hub, wallet_panel, lang)
  );
}

async function sendRewards(ctx, pool, appConfig) {
  const payload = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    const balances = await economyStore.getBalances(db, profile.user_id);
    const runtimeConfig = await configService.getEconomyConfig(db);
    const payout = await buildPayoutView(db, profile, appConfig, runtimeConfig);
    return { profile, balances, payout };
  });
  const lang = resolvePreferredLanguage(payload.profile, ctx, "tr");
  const { rewards_vault = "", leaderboard_panel = "" } = await resolveMiniAppLaunchSurfaceBundle(pool, appConfig, ctx.from?.id, [
    "rewards_vault",
    "leaderboard_panel"
  ]);
  const entitled = Number(payload.payout.entitledBtc || 0).toFixed(8);
  const requestable = Number(payload.payout.requestableBtc || 0).toFixed(8);
  const latestRef = escapeMarkdownText(
    payload.payout.latest?.payout_request_ref || payload.payout.latest?.pass_purchase_ref || payload.payout.latest?.submit_tx_hash || "-"
  );
  await ctx.replyWithMarkdown(
    lang === "en"
      ? `*Rewards Center*\n` +
          `Balances: *${Number(payload.balances.SC || 0)} SC / ${Number(payload.balances.HC || 0)} HC / ${Number(payload.balances.RC || 0)} RC*\n` +
          `Entitled: *${entitled} BTC* | Requestable: *${requestable} BTC*\n` +
          `Payout: *${payload.payout.canRequest ? "open" : "locked"}* | Cooldown: *${payload.payout.cooldownUntil ? "active" : "clear"}*\n` +
          `Latest Ref: *${latestRef}*`
      : `*Odul Merkezi*\n` +
          `Bakiyeler: *${Number(payload.balances.SC || 0)} SC / ${Number(payload.balances.HC || 0)} HC / ${Number(payload.balances.RC || 0)} RC*\n` +
          `Hak Edilen: *${entitled} BTC* | Talep Edilebilir: *${requestable} BTC*\n` +
          `Payout: *${payload.payout.canRequest ? "acik" : "kilitli"}* | Cooldown: *${payload.payout.cooldownUntil ? "aktif" : "temiz"}*\n` +
          `Son Ref: *${latestRef}*`,
    buildRewardsKeyboard(rewards_vault, leaderboard_panel, lang)
  );
}

async function sendWallet(ctx, pool, appConfig) {
  const snapshot = await getSnapshot(pool, ctx);
  const lang = resolvePreferredLanguage(snapshot.profile, ctx, "tr");
  const walletUrl = await resolveMiniAppCommandUrl(pool, appConfig, ctx.from?.id, "wallet");
  await ctx.replyWithMarkdown(
    messages.formatWallet(snapshot.profile, snapshot.balances, snapshot.daily, snapshot.anomaly, snapshot.contract),
    buildWalletKeyboard(walletUrl || "", lang)
  );
}

async function sendSeason(ctx, pool, appConfig) {
  const payload = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    const runtimeConfig = await configService.getEconomyConfig(db);
    const season = seasonStore.getSeasonInfo(runtimeConfig);
    const stat = await seasonStore.getSeasonStat(db, { userId: profile.user_id, seasonId: season.seasonId });
    const rank = await seasonStore.getUserRank(db, { userId: profile.user_id, seasonId: season.seasonId });
    return { profile, season, stat, rank };
  });
  const { season_hall = "", leaderboard_panel = "" } = await resolveMiniAppLaunchSurfaceBundle(pool, appConfig, ctx.from?.id, [
    "season_hall",
    "leaderboard_panel"
  ]);
  await ctx.replyWithMarkdown(
    messages.formatSeason(payload.season, payload.stat, payload.rank),
    buildSeasonKeyboard(season_hall, leaderboard_panel, resolvePreferredLanguage(payload.profile, ctx, "tr"))
  );
}

async function sendEvents(ctx, pool, appConfig) {
  const payload = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    const runtimeConfig = await configService.getEconomyConfig(db);
    const season = seasonStore.getSeasonInfo(runtimeConfig);
    const anomaly = nexusEventEngine.publicAnomalyView(
      nexusEventEngine.resolveDailyAnomaly(runtimeConfig, {
        seasonId: season.seasonId
      })
    );
    const contract = resolveLiveContract(runtimeConfig, season, anomaly);
    const war = await globalStore.getWarStatus(db, season.seasonId);
    const rows = await seasonStore.getLeaderboard(db, { seasonId: season.seasonId, limit: 3 });
    return { profile, season, anomaly, contract, war, rows };
  });
  const lang = resolvePreferredLanguage(payload.profile, ctx, "tr");
  const { events_hall = "", season_hall = "", leaderboard_panel = "" } = await resolveMiniAppLaunchSurfaceBundle(
    pool,
    appConfig,
    ctx.from?.id,
    ["events_hall", "season_hall", "leaderboard_panel"]
  );
  const lead = (payload.rows || [])
    .slice(0, 3)
    .map((row, idx) => `${idx + 1}. ${escapeMarkdownText(row.public_name || "player")} (${Math.floor(Number(row.points || 0))})`)
    .join("\n");
  await ctx.replyWithMarkdown(
    lang === "en"
      ? `*Live Events*\n` +
          `Season: *S${payload.season.seasonId}* | *${payload.season.daysLeft} days left*\n` +
          `Nexus: *${escapeMarkdownText(payload.anomaly.title || "-")}* (${Number(payload.anomaly.pressure_pct || 0)}% pressure)\n` +
          `Contract: *${escapeMarkdownText(payload.contract.title || "-")}* [${escapeMarkdownText(payload.contract.required_mode || "balanced")}]\n` +
          `War Tier: *${escapeMarkdownText(payload.war.tier || "seed")}* | Pool *${Math.floor(Number(payload.war.value || 0))}*\n\n` +
          `Top Ladder\n${lead || "-"}`
      : `*Canli Eventler*\n` +
          `Sezon: *S${payload.season.seasonId}* | *${payload.season.daysLeft} gun kaldi*\n` +
          `Nexus: *${escapeMarkdownText(payload.anomaly.title || "-")}* (${Number(payload.anomaly.pressure_pct || 0)}% basinc)\n` +
          `Kontrat: *${escapeMarkdownText(payload.contract.title || "-")}* [${escapeMarkdownText(payload.contract.required_mode || "balanced")}]\n` +
          `War Tier: *${escapeMarkdownText(payload.war.tier || "seed")}* | Havuz *${Math.floor(Number(payload.war.value || 0))}*\n\n` +
          `Top Ladder\n${lead || "-"}`,
    buildEventKeyboard(events_hall, season_hall, leaderboard_panel, lang)
  );
}

async function sendLeaderboard(ctx, pool, appConfig) {
  const payload = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    const runtimeConfig = await configService.getEconomyConfig(db);
    const season = seasonStore.getSeasonInfo(runtimeConfig);
    const rows = await seasonStore.getLeaderboard(db, { seasonId: season.seasonId, limit: 10 });
    return { profile, season, rows };
  });
  const lang = resolvePreferredLanguage(payload.profile, ctx, "tr");
  const { season_hall = "", leaderboard_panel = "" } = await resolveMiniAppLaunchSurfaceBundle(pool, appConfig, ctx.from?.id, [
    "season_hall",
    "leaderboard_panel"
  ]);
  await ctx.replyWithMarkdown(
    messages.formatLeaderboard(payload.season, payload.rows),
    buildSeasonKeyboard(season_hall, leaderboard_panel, lang)
  );
}

async function sendShop(ctx, pool, appConfig) {
  const payload = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    await shopStore.ensureDefaultOffers(db);
    const offers = await shopStore.listActiveOffers(db, 8);
    const balances = await economyStore.getBalances(db, profile.user_id);
    const effects = await shopStore.getActiveEffects(db, profile.user_id);
    return { profile, offers, balances, effects };
  });
  const lang = resolvePreferredLanguage(payload.profile, ctx, "tr");
  const rewardsUrl = await resolveMiniAppCommandUrl(pool, appConfig, ctx.from?.id, "rewards");
  await ctx.replyWithMarkdown(
    messages.formatShop(payload.offers, payload.balances, payload.effects),
    buildShopKeyboard(payload.offers, lang, rewardsUrl || "")
  );
}

async function sendDiscover(ctx, pool, appConfig) {
  const payload = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    const offers = await taskStore.listActiveOffers(db, profile.user_id);
    const missions = await missionStore.getMissionBoard(db, profile.user_id);
    const runtimeConfig = await configService.getEconomyConfig(db);
    const season = seasonStore.getSeasonInfo(runtimeConfig);
    const anomaly = nexusEventEngine.publicAnomalyView(
      nexusEventEngine.resolveDailyAnomaly(runtimeConfig, {
        seasonId: season.seasonId
      })
    );
    return { profile, offers, missions, anomaly };
  });
  const lang = resolvePreferredLanguage(payload.profile, ctx, "tr");
  const readyMissions = payload.missions.filter((row) => row.completed && !row.claimed).length;
  const openOffers = payload.offers.length;
  const { discover_panel = "", mission_quarter = "", play_world = "" } = await resolveMiniAppLaunchSurfaceBundle(
    pool,
    appConfig,
    ctx.from?.id,
    ["discover_panel", "mission_quarter", "play_world"]
  );
  await ctx.replyWithMarkdown(
    lang === "en"
      ? `*Discover*\n` +
          `Active Offers: *${openOffers}* | Ready Missions: *${readyMissions}*\n` +
          `Current Nexus: *${escapeMarkdownText(payload.anomaly.title || "-")}*\n` +
          `Best next move: *${readyMissions > 0 ? "claim missions" : openOffers > 0 ? "open mission quarter" : "enter arena"}*`
      : `*Kesfet*\n` +
          `Aktif Offer: *${openOffers}* | Hazir Misyon: *${readyMissions}*\n` +
          `Guncel Nexus: *${escapeMarkdownText(payload.anomaly.title || "-")}*\n` +
          `En iyi sonraki hamle: *${readyMissions > 0 ? "misyon claim" : openOffers > 0 ? "mission quarter ac" : "arenaya gir"}*`,
    buildDiscoverKeyboard(discover_panel, mission_quarter, play_world, lang)
  );
}

async function sendMissions(ctx, pool, appConfig) {
  const payload = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    const board = await missionStore.getMissionBoard(db, profile.user_id);
    return { profile, board };
  });
  const missionsUrl = await resolveMiniAppCommandUrl(pool, appConfig, ctx.from?.id, "claim");
  await ctx.replyWithMarkdown(
    messages.formatMissions(payload.board),
    buildMissionKeyboard(payload.board, resolvePreferredLanguage(payload.profile, ctx, "tr"), missionsUrl || "")
  );
}

async function sendDaily(ctx, pool, appConfig) {
  const payload = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    const balances = await economyStore.getBalances(db, profile.user_id);
    const dailyRaw = await economyStore.getTodayCounter(db, profile.user_id);
    const runtimeConfig = await configService.getEconomyConfig(db);
    const season = seasonStore.getSeasonInfo(runtimeConfig);
    const anomaly = nexusEventEngine.publicAnomalyView(
      nexusEventEngine.resolveDailyAnomaly(runtimeConfig, {
        seasonId: season.seasonId
      })
    );
    const contract = resolveLiveContract(runtimeConfig, season, anomaly);
    const board = await missionStore.getMissionBoard(db, profile.user_id);
    const daily = buildDailyView(runtimeConfig, profile, dailyRaw);
    return { profile, balances, daily, board, anomaly, contract };
  });
  const missionsUrl = await resolveMiniAppCommandUrl(pool, appConfig, ctx.from?.id, "missions");
  await ctx.replyWithMarkdown(
    messages.formatDaily(payload.profile, payload.daily, payload.board, payload.balances, payload.anomaly, payload.contract),
    buildMissionKeyboard(payload.board, resolvePreferredLanguage(payload.profile, ctx, "tr"), missionsUrl || "")
  );
}

async function sendSettings(ctx, pool, appConfig) {
  const payload = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    const prefs = await webappStore.getUserUiPrefs(db, profile.user_id).catch((err) => {
      if (err.code === "42P01") return null;
      throw err;
    });
    const perf = await webappStore.getLatestPerfProfile(db, profile.user_id, "").catch((err) => {
      if (err.code === "42P01") return null;
      throw err;
    });
    return { profile, prefs, perf };
  });
  const lang = resolvePreferredLanguage(payload.profile, ctx, "tr");
  const { settings_panel = "", support_panel = "" } = await resolveMiniAppLaunchSurfaceBundle(pool, appConfig, ctx.from?.id, [
    "settings_panel",
    "support_panel"
  ]);
  await ctx.replyWithMarkdown(
    lang === "en"
      ? `*Settings*\n` +
          `Locale: *${escapeMarkdownText(payload.profile.locale || "en")}*\n` +
          `UI Mode: *${escapeMarkdownText(payload.prefs?.ui_mode || "hardcore")}* | Quality: *${escapeMarkdownText(payload.prefs?.quality_mode || "auto")}*\n` +
          `Reduced Motion: *${payload.prefs?.reduced_motion ? "on" : "off"}* | Large Text: *${payload.prefs?.large_text ? "on" : "off"}*\n` +
          `Sound: *${payload.prefs?.sound_enabled === false ? "off" : "on"}* | FPS(avg): *${payload.perf?.fps_avg ? Number(payload.perf.fps_avg).toFixed(1) : "-"}*`
      : `*Ayarlar*\n` +
          `Locale: *${escapeMarkdownText(payload.profile.locale || "tr")}*\n` +
          `UI Mod: *${escapeMarkdownText(payload.prefs?.ui_mode || "hardcore")}* | Kalite: *${escapeMarkdownText(payload.prefs?.quality_mode || "auto")}*\n` +
          `Reduced Motion: *${payload.prefs?.reduced_motion ? "acik" : "kapali"}* | Buyuk Metin: *${payload.prefs?.large_text ? "acik" : "kapali"}*\n` +
          `Ses: *${payload.prefs?.sound_enabled === false ? "kapali" : "acik"}* | FPS(avg): *${payload.perf?.fps_avg ? Number(payload.perf.fps_avg).toFixed(1) : "-"}*`,
    buildSettingsKeyboard(settings_panel, support_panel, lang)
  );
}

async function sendSupport(ctx, pool, appConfig) {
  const payload = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    const runtimeConfig = await configService.getEconomyConfig(db);
    const payout = await buildPayoutView(db, profile, appConfig, runtimeConfig);
    const prefs = await webappStore.getUserUiPrefs(db, profile.user_id).catch((err) => {
      if (err.code === "42P01") return null;
      throw err;
    });
    return { profile, payout, prefs };
  });
  const lang = resolvePreferredLanguage(payload.profile, ctx, "tr");
  const { status_hub = "", payout_screen = "", settings_panel = "", faq_panel = "" } = await resolveMiniAppLaunchSurfaceBundle(
    pool,
    appConfig,
    ctx.from?.id,
    ["status_hub", "payout_screen", "settings_panel", "faq_panel"]
  );
  await ctx.replyWithMarkdown(
    lang === "en"
      ? `*Support Triage*\n` +
          `Language: *${escapeMarkdownText(payload.profile.locale || "en")}* | UI mode: *${escapeMarkdownText(payload.prefs?.ui_mode || "hardcore")}*\n` +
          `Payout Route: *${payload.payout.canRequest ? "open" : "review or locked"}*\n\n` +
          `1. Use */status* for runtime or loading issues.\n` +
          `2. Use */vault* for payout or wallet path issues.\n` +
          `3. Use */settings* when language or accessibility feels wrong.\n` +
          `4. Use */faq* before escalation for common answers.`
      : `*Destek Triage*\n` +
          `Dil: *${escapeMarkdownText(payload.profile.locale || "tr")}* | UI mod: *${escapeMarkdownText(payload.prefs?.ui_mode || "hardcore")}*\n` +
          `Payout Yolu: *${payload.payout.canRequest ? "acik" : "inceleme veya kilitli"}*\n\n` +
          `1. Runtime veya yukleme sorunu icin */status*.\n` +
          `2. Payout veya wallet sorunu icin */vault*.\n` +
          `3. Dil/accessibility sorunu icin */settings*.\n` +
          `4. Sik sorular icin once */faq*.`,
    buildSupportKeyboard(status_hub, payout_screen, settings_panel, faq_panel, lang)
  );
}

async function sendFaq(ctx, pool, appConfig) {
  const profile = await ensureProfile(pool, ctx);
  const lang = resolvePreferredLanguage(profile, ctx, "tr");
  const { status_hub = "", payout_screen = "", settings_panel = "", faq_panel = "" } = await resolveMiniAppLaunchSurfaceBundle(
    pool,
    appConfig,
    ctx.from?.id,
    ["status_hub", "payout_screen", "settings_panel", "faq_panel"]
  );
  await ctx.replyWithMarkdown(
    lang === "en"
      ? `*FAQ*\n` +
          `• *Why is payout locked?* Market-cap, drip or review gates may still be active.\n` +
          `• *Why did wallet verify fail?* Address, challenge ref or signature may not match the selected chain.\n` +
          `• *Why is the UI slow?* Use reduced motion or lower quality in settings and retry.\n` +
          `• *Why did a mission not claim?* Claim only opens when mission is completed and not already claimed.`
      : `*SSS*\n` +
          `• *Payout neden kilitli?* Market-cap, drip veya review gate halen aktif olabilir.\n` +
          `• *Wallet verify neden basarisiz?* Adres, challenge ref veya imza secili chain ile eslesmiyor olabilir.\n` +
          `• *UI neden yavas?* Settings icinden reduced motion veya dusuk kaliteyi dene.\n` +
          `• *Misyon neden claim olmadi?* Claim sadece tamamlanan ve daha once alinmayan misyonda acilir.`,
    buildSupportKeyboard(status_hub, payout_screen, settings_panel, faq_panel, lang)
  );
}

function buildKingdomState(profile, thresholds) {
  const list = Array.isArray(thresholds) && thresholds.length > 0 ? thresholds : [0, 1500, 5000, 15000, 40000];
  const tier = Number(profile.kingdom_tier || 0);
  const rep = Number(profile.reputation_score || 0);
  const currentStart = Number(list[Math.max(0, Math.min(tier, list.length - 1))] || 0);
  const nextThreshold = tier + 1 < list.length ? Number(list[tier + 1]) : null;
  const progressMax = nextThreshold === null ? Math.max(1, currentStart) : Math.max(1, nextThreshold - currentStart);
  const progressValue =
    nextThreshold === null
      ? progressMax
      : Math.max(0, Math.min(progressMax, rep - currentStart));

  return {
    nextTier: nextThreshold === null ? tier : tier + 1,
    nextThreshold,
    toNext: nextThreshold === null ? 0 : Math.max(0, nextThreshold - rep),
    progressValue,
    progressMax
  };
}

async function sendKingdom(ctx, pool) {
  const payload = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    const runtimeConfig = await configService.getEconomyConfig(db);
    const history = await userStore.getKingdomHistory(db, profile.user_id, 5);
    const state = buildKingdomState(profile, runtimeConfig.kingdom?.thresholds);
    return { profile, history, state };
  });

  await ctx.replyWithMarkdown(messages.formatKingdom(payload.profile, { ...payload.state, history: payload.history }));
}

async function handleClaimMission(ctx, pool) {
  const missionKey = String(ctx.match[1] || "");
  if (!missionKey) {
    return;
  }
  const payload = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    const board = await missionStore.getMissionBoard(db, profile.user_id);
    const claim = await missionStore.insertClaimIfEligible(db, {
      userId: profile.user_id,
      missionKey,
      board
    });

    if (claim.status === "claimed") {
      const dayKey = new Date().toISOString().slice(0, 10);
      await economyStore.creditReward(db, {
        userId: profile.user_id,
        reward: claim.mission.reward,
        reason: `mission_claim_${claim.mission.key}`,
        meta: { missionKey: claim.mission.key, day: dayKey },
        refEventIds: {
          SC: deterministicUuid(`mission:${profile.user_id}:${dayKey}:${claim.mission.key}:SC`),
          HC: deterministicUuid(`mission:${profile.user_id}:${dayKey}:${claim.mission.key}:HC`),
          RC: deterministicUuid(`mission:${profile.user_id}:${dayKey}:${claim.mission.key}:RC`)
        }
      });
    }

    const nextBoard = await missionStore.getMissionBoard(db, profile.user_id);
    return { claim, board: nextBoard };
  });

  await ctx.answerCbQuery();
  await ctx.replyWithMarkdown(messages.formatMissionClaim(payload.claim), buildMissionKeyboard(payload.board));
}

async function sendWar(ctx, pool) {
  const payload = await withTransaction(pool, async (db) => {
    await ensureProfileTx(db, ctx);
    const runtimeConfig = await configService.getEconomyConfig(db);
    const season = seasonStore.getSeasonInfo(runtimeConfig);
    const status = await globalStore.getWarStatus(db, season.seasonId);
    return { season, status };
  });
  await ctx.replyWithMarkdown(messages.formatWar(payload.status, payload.season));
}

function maskAddress(address) {
  const value = String(address || "");
  if (value.length <= 12) {
    return value;
  }
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

function hashAddress(address) {
  return crypto.createHash("sha256").update(String(address || "")).digest("hex");
}

async function setFreezeState(db, { freeze, reason, updatedBy }) {
  const stateJson = {
    freeze: Boolean(freeze),
    reason: String(reason || "").trim(),
    updated_at: new Date().toISOString(),
    updated_by: Number(updatedBy || 0)
  };
  await db.query(
    `INSERT INTO system_state (state_key, state_json, updated_by)
     VALUES ('freeze', $1::jsonb, $2)
     ON CONFLICT (state_key)
     DO UPDATE SET state_json = EXCLUDED.state_json,
                   updated_at = now(),
                   updated_by = EXCLUDED.updated_by;`,
    [JSON.stringify(stateJson), Number(updatedBy || 0)]
  );
  await db.query(
    `INSERT INTO admin_audit (admin_id, action, target, payload_json)
     VALUES ($1, 'system_freeze_toggle', 'system_state:freeze', $2::jsonb);`,
    [Number(updatedBy || 0), JSON.stringify(stateJson)]
  );
  return stateJson;
}

function computeTokenMarketCapGate(tokenConfig, tokenSupplyTotal) {
  const gate = tokenConfig?.payout_gate || {};
  const enabled = Boolean(gate.enabled);
  const minMarketCapUsd = Math.max(0, Number(gate.min_market_cap_usd || 0));
  const marketCapUsd = Number(tokenSupplyTotal || 0) * Math.max(0, Number(tokenConfig?.usd_price || 0));
  return {
    enabled,
    allowed: !enabled || marketCapUsd >= minMarketCapUsd,
    current: Number(marketCapUsd || 0),
    min: Number(minMarketCapUsd || 0),
    targetMax: Math.max(0, Number(gate.target_band_max_usd || 0))
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
           AND created_at >= now() - interval '30 days';`,
        [userId]
      )
      .catch((err) => {
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
  const volumeNorm = clamp(volumeUsd / 1000, 0, 1);
  const missionNorm = clamp(missionClaims / 40, 0, 1);
  const tenureNorm = clamp(tenureDays / 60, 0, 1);
  return {
    volume30d_norm: Number(volumeNorm.toFixed(6)),
    mission30d_norm: Number(missionNorm.toFixed(6)),
    tenure30d_norm: Number(tenureNorm.toFixed(6)),
    metrics: {
      volume_usd_30d: volumeUsd,
      mission_claims_30d: missionClaims,
      tenure_days: tenureDays
    }
  };
}

async function buildAdminSnapshot(db, appConfig) {
  const runtimeConfig = await configService.getEconomyConfig(db);
  const tokenConfig = tokenEngine.normalizeTokenConfig(runtimeConfig);
  const tokenSupply = await economyStore.getCurrencySupply(db, tokenConfig.symbol);
  const freeze = await systemStore.getFreezeState(db);
  const usersRes = await db.query(`SELECT COUNT(*)::bigint AS c FROM users;`);
  const activeAttemptsRes = await db.query(
    `SELECT COUNT(*)::bigint AS c
     FROM task_attempts
     WHERE result = 'pending';`
  );
  const pendingPayouts = await payoutStore.listRequests(db, { status: "requested", limit: 10 });
  let pendingTokenRequests = [];
  try {
    const tokenRows = await tokenStore.listPurchaseRequests(db, { limit: 40 });
    pendingTokenRequests = tokenRows.filter((row) =>
      ["pending_payment", "tx_submitted"].includes(String(row.status || "").toLowerCase())
    );
  } catch (err) {
    if (err.code !== "42P01") {
      throw err;
    }
  }
  return {
    adminTelegramId: Number(appConfig.adminTelegramId || 0),
    freeze,
    totalUsers: Number(usersRes.rows[0]?.c || 0),
    activeAttempts: Number(activeAttemptsRes.rows[0]?.c || 0),
    pendingPayoutCount: pendingPayouts.length,
    pendingTokenCount: pendingTokenRequests.length,
    pendingPayouts,
    pendingTokenRequests,
    token: {
      symbol: tokenConfig.symbol,
      supply: Number(tokenSupply.total || 0),
      holders: Number(tokenSupply.holders || 0),
      marketCapUsd: Number((Number(tokenSupply.total || 0) * Number(tokenConfig.usd_price || 0)).toFixed(8)),
      spotUsd: Number(tokenConfig.usd_price || 0),
      payoutGate: computeTokenMarketCapGate(tokenConfig, tokenSupply.total)
    }
  };
}

async function buildPayoutView(db, profile, appConfig, runtimeConfigRaw) {
  const balances = await economyStore.getBalances(db, profile.user_id);
  const hc = Number(balances.HC || 0);
  const entitledBtc = hc * Number(appConfig.hcToBtcRate || 0.00001);
  const runtimeConfig = runtimeConfigRaw || (await configService.getEconomyConfig(db));
  const tokenConfig = tokenEngine.normalizeTokenConfig(runtimeConfig);
  const tokenSupply = await economyStore.getCurrencySupply(db, tokenConfig.symbol);
  const marketCapGate = computeTokenMarketCapGate(tokenConfig, tokenSupply.total);
  const scoreInput = await computePayoutReleaseScoreInput(db, profile.user_id);
  const todayUsedBtc = await payoutStore.getTodayRequestedAmount(db, profile.user_id, "BTC").catch((err) => {
    if (err.code === "42P01") {
      return 0;
    }
    throw err;
  });
  const releaseState = tokenEngine.computePayoutReleaseState({
    releaseConfig: tokenConfig.payout_release || {},
    entitledBtc,
    todayUsedBtc,
    marketCapUsd: Number(marketCapGate.current || 0),
    score: scoreInput
  });
  const requestableBtc = releaseState.enabled
    ? Math.min(entitledBtc, Number(releaseState.todayDripRemainingBtc || 0))
    : entitledBtc;
  const latest = await payoutStore.getLatestRequest(db, profile.user_id, "BTC");
  const active = await payoutStore.getActiveRequest(db, profile.user_id, "BTC");
  const cooldown = await payoutStore.getCooldownRequest(db, profile.user_id, "BTC");
  const thresholdBtc = releaseState.enabled ? 0 : Number(appConfig.payoutThresholdBtc || 0.0001);
  const canRequest =
    requestableBtc >= thresholdBtc &&
    marketCapGate.allowed &&
    (!releaseState.enabled || releaseState.allowed) &&
    !active &&
    !cooldown;

  let latestWithTx = latest;
  if (latest) {
    latestWithTx = await payoutStore.getRequestWithTx(db, latest.id);
  }

  await payoutStore
    .upsertUserUnlockScore(db, {
      userId: profile.user_id,
      volume30dNorm: scoreInput.volume30d_norm,
      mission30dNorm: scoreInput.mission30d_norm,
      tenure30dNorm: scoreInput.tenure30d_norm,
      unlockScore: releaseState.unlockScore,
      unlockTier: releaseState.unlockTier,
      factorsJson: {
        ...scoreInput.metrics,
        score_weights: releaseState.weights || {}
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
      dripCapBtc: releaseState.todayDripCapBtc,
      dripUsedBtc: todayUsedBtc,
      dripRemainingBtc: releaseState.todayDripRemainingBtc,
      unlockTier: releaseState.unlockTier,
      unlockScore: releaseState.unlockScore,
      globalGateOpen: releaseState.globalGateOpen,
      detailsJson: {
        next_tier_target: releaseState.nextTierTarget,
        factors: releaseState.factors || {},
        weights: releaseState.weights || {},
        market_cap_usd: Number(marketCapGate.current || 0)
      }
    })
    .catch((err) => {
      if (err.code !== "42P01") {
        throw err;
      }
    });

  return {
    entitledBtc,
    requestableBtc,
    thresholdBtc,
    cooldownUntil: cooldown?.cooldown_until || null,
    canRequest,
    marketCapGate,
    release: {
      enabled: releaseState.enabled,
      mode: releaseState.mode,
      globalGateOpen: releaseState.globalGateOpen,
      globalCapMinUsd: releaseState.globalCapMinUsd,
      globalCapCurrentUsd: releaseState.globalCapCurrentUsd,
      unlockTier: releaseState.unlockTier,
      unlockScore: releaseState.unlockScore,
      unlockProgress: releaseState.unlockProgress,
      nextTierTarget: releaseState.nextTierTarget,
      todayDripCapBtc: releaseState.todayDripCapBtc,
      todayDripUsedBtc: releaseState.todayDripUsedBtc,
      todayDripRemainingBtc: releaseState.todayDripRemainingBtc
    },
    latest: latestWithTx
  };
}

async function sendPayout(ctx, pool, appConfig) {
  const payload = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    const runtimeConfig = await configService.getEconomyConfig(db);
    const view = await buildPayoutView(db, profile, appConfig, runtimeConfig);
    return { profile, view };
  });
  const payoutUrl = await resolveMiniAppCommandUrl(pool, appConfig, ctx.from?.id, "payout");
  await ctx.replyWithMarkdown(
    messages.formatPayout(payload.view),
    buildPayoutKeyboard(payload.view.canRequest, resolvePreferredLanguage(payload.profile, ctx, "tr"), payoutUrl || "")
  );
}

async function sendAdminPanel(ctx, pool, appConfig) {
  if (!(await ensureAdminCtx(ctx, appConfig))) {
    return;
  }
  const snapshot = await withTransaction(pool, async (db) => buildAdminSnapshot(db, appConfig));
  const lang = normalizeLanguage(ctx.from?.language_code, "tr");
  const launch = await resolveAdminWorkspaceUrls(pool, appConfig, ctx.from?.id);
  await ctx.replyWithMarkdown(
    messages.formatAdminPanel(snapshot, true),
    buildAdminKeyboard(snapshot, lang, [
      { label: "Admin Workspace", url: launch.adminUrl },
      { label: "Unified Queue", url: launch.queueUrl },
      { label: "Policy Panel", url: launch.policyUrl },
      { label: "Runtime Panel", url: launch.runtimeUrl }
    ])
  );
}

async function sendAdminPayoutQueue(ctx, pool, appConfig) {
  if (!(await ensureAdminCtx(ctx, appConfig))) {
    return;
  }
  const rows = await withTransaction(pool, async (db) => payoutStore.listRequests(db, { status: "requested", limit: 20 }));
  const lines =
    rows.length > 0
      ? rows
          .map(
            (row) =>
              `#${row.id} u${row.user_id} ${Number(row.amount || 0).toFixed(8)} BTC (${Number(row.source_hc_amount || 0).toFixed(4)} HC)`
          )
          .join("\n")
      : "Bekleyen payout talebi yok.";
  const lang = normalizeLanguage(ctx.from?.language_code, "tr");
  const launch = await resolveAdminWorkspaceUrls(pool, appConfig, ctx.from?.id);
  await ctx.replyWithMarkdown(
    `*Payout Queue*\n${lines}`,
    buildAdminWorkspaceKeyboard(launch.adminUrl, launch.queueUrl, launch.policyUrl, launch.runtimeUrl, lang)
  );
}

async function sendAdminTokenQueue(ctx, pool, appConfig) {
  if (!(await ensureAdminCtx(ctx, appConfig))) {
    return;
  }
  const rows = await withTransaction(pool, async (db) => {
    try {
      const all = await tokenStore.listPurchaseRequests(db, { limit: 30 });
      return all.filter((row) => ["pending_payment", "tx_submitted"].includes(String(row.status || "").toLowerCase()));
    } catch (err) {
      if (err.code === "42P01") {
        return [];
      }
      throw err;
    }
  });

  const lines =
    rows.length > 0
      ? rows
          .map((row) => {
            const txHint = row.tx_hash ? ` tx:${String(row.tx_hash).slice(0, 16)}...` : " tx:yok";
            return `#${row.id} u${row.user_id} ${Number(row.usd_amount || 0).toFixed(2)} USD -> ${Number(row.token_amount || 0).toFixed(4)} ${row.token_symbol} [${String(row.status || "").toUpperCase()}]${txHint}`;
          })
          .join("\n")
      : "Bekleyen token talebi yok.";
  const lang = normalizeLanguage(ctx.from?.language_code, "tr");
  const launch = await resolveAdminWorkspaceUrls(pool, appConfig, ctx.from?.id);
  await ctx.replyWithMarkdown(
    `*Token Queue*\n${lines}`,
    buildAdminWorkspaceKeyboard(launch.adminUrl, launch.queueUrl, launch.policyUrl, launch.runtimeUrl, lang)
  );
}

async function sendAdminQueue(ctx, pool, appConfig) {
  if (!(await ensureAdminCtx(ctx, appConfig))) {
    return;
  }
  const payload = await withTransaction(pool, async (db) => {
    const payouts = await payoutStore.listRequests(db, { status: "requested", limit: 30 });
    let tokens = [];
    try {
      const all = await tokenStore.listPurchaseRequests(db, { limit: 40 });
      tokens = all.filter((row) => ["pending_payment", "tx_submitted"].includes(String(row.status || "").toLowerCase()));
    } catch (err) {
      if (err.code !== "42P01") {
        throw err;
      }
    }
    return { payouts, tokens };
  });
  const lang = normalizeLanguage(ctx.from?.language_code, "tr");
  const launch = await resolveAdminWorkspaceUrls(pool, appConfig, ctx.from?.id);
  await ctx.replyWithMarkdown(
    messages.formatAdminQueue(payload),
    buildAdminWorkspaceKeyboard(launch.adminUrl, launch.queueUrl, launch.policyUrl, launch.runtimeUrl, lang)
  );
}

async function sendAdminMetrics(ctx, pool, appConfig) {
  if (!(await ensureAdminCtx(ctx, appConfig))) {
    return;
  }
  const metrics = await withTransaction(pool, async (db) => fetchBotAdminMetrics(db));

  const lang = normalizeLanguage(ctx.from?.language_code, "tr");
  const launch = await resolveAdminWorkspaceUrls(pool, appConfig, ctx.from?.id);
  await ctx.replyWithMarkdown(
    `*Admin Metrikler (24s)*\n` +
      `Users: *${Number(metrics.users_total || 0)}* | Active: *${Number(metrics.users_active_24h || 0)}*\n` +
      `Attempts: *${Number(metrics.attempts_started_24h || 0)}* start / *${Number(metrics.attempts_completed_24h || 0)}* complete\n` +
      `Reveal: *${Number(metrics.reveals_24h || 0)}*\n` +
      `Payout: *${Number(metrics.payouts_requested_24h || 0)}* req / *${Number(metrics.payouts_paid_24h || 0)}* paid / *${Number(metrics.payouts_paid_btc_24h || 0).toFixed(8)} BTC*\n` +
      `Token: *${Number(metrics.token_intents_24h || 0)}* intents / *${Number(metrics.token_approved_24h || 0)}* approved / *$${Number(metrics.token_usd_volume_24h || 0).toFixed(2)}*\n` +
      `Today emission: *${Number(metrics.sc_today || 0).toFixed(2)} SC* | *${Number(metrics.hc_today || 0).toFixed(2)} HC* | *${Number(metrics.rc_today || 0).toFixed(2)} RC*`,
    buildAdminWorkspaceKeyboard(launch.adminUrl, launch.queueUrl, launch.policyUrl, launch.runtimeUrl, lang)
  );
}

async function sendAdminLive(ctx, pool, appConfig) {
  if (!(await ensureAdminCtx(ctx, appConfig))) {
    return;
  }
  const payload = await withTransaction(pool, async (db) => {
    const snapshot = await buildAdminSnapshot(db, appConfig);
    const metrics = await fetchBotAdminMetrics(db);
    const runtime =
      (await botRuntimeStore.getRuntimeState(db, appConfig.runtimeStateKey).catch(() => null)) ||
      (await botRuntimeStore.getRuntimeState(db, botRuntimeStore.DEFAULT_STATE_KEY).catch(() => null));
    const release = await readLatestReleaseMarkerSummary(db);
    const flags = await readBotFeatureFlagSummary(db);
    return {
      snapshot,
      metrics,
      runtime,
      release,
      flags,
      webappUrl: appConfig.webappPublicUrl || ""
    };
  });
  const lang = normalizeLanguage(ctx.from?.language_code, "tr");
  const launch = await resolveAdminWorkspaceUrls(pool, appConfig, ctx.from?.id);
  await ctx.replyWithMarkdown(
    messages.formatAdminLive(payload),
    buildAdminKeyboard(payload.snapshot, lang, [
      { label: "Admin Workspace", url: launch.adminUrl },
      { label: "Unified Queue", url: launch.queueUrl },
      { label: "Policy Panel", url: launch.policyUrl },
      { label: "Runtime Panel", url: launch.runtimeUrl }
    ])
  );
}

async function sendAdminConfig(ctx, pool, appConfig) {
  if (!(await ensureAdminCtx(ctx, appConfig))) {
    return;
  }
  const payload = await withTransaction(pool, async (db) => {
    const cfg = await configService.getEconomyConfig(db, { forceRefresh: true });
    const token = tokenEngine.normalizeTokenConfig(cfg);
    return {
      source: configService.getConfigCacheStatus().source,
      token
    };
  });
  const gate = payload.token.payout_gate || {};
  const release = payload.token.payout_release || {};
  const lang = normalizeLanguage(ctx.from?.language_code, "tr");
  const launch = await resolveAdminWorkspaceUrls(pool, appConfig, ctx.from?.id);
  await ctx.replyWithMarkdown(
    `*Admin Config*\n` +
      `Kaynak: *${payload.source}*\n` +
      `Token: *${payload.token.symbol}*\n` +
      `Fiyat: *$${Number(payload.token.usd_price || 0).toFixed(8)}*\n` +
      `Min Buy: *$${Number(payload.token.purchase?.min_usd || 0).toFixed(2)}*\n` +
      `Max Buy: *$${Number(payload.token.purchase?.max_usd || 0).toFixed(2)}*\n` +
      `Payout Gate: *${gate.enabled ? "ON" : "OFF"}*\n` +
      `Gate Min Cap: *$${Math.floor(Number(gate.min_market_cap_usd || 0))}*\n` +
      `Gate Target Max: *$${Math.floor(Number(gate.target_band_max_usd || 0))}*\n` +
      `Release: *${release.enabled ? "ON" : "OFF"}* (${String(release.mode || "tiered_drip")})\n` +
      `Release Global Cap: *$${Math.floor(Number(release.global_cap_min_usd || 0))}*\n` +
      `Release Daily Drip Max: *${(Number(release.daily_drip_pct_max || 0) * 100).toFixed(2)}%*`,
    buildAdminWorkspaceKeyboard(launch.adminUrl, launch.queueUrl, launch.policyUrl, launch.runtimeUrl, lang)
  );
}

async function adminSetTokenPrice(ctx, pool, appConfig, usdRaw) {
  if (!(await ensureAdminCtx(ctx, appConfig))) {
    return;
  }
  const usdPrice = parseFloatArg(usdRaw);
  if (!usdPrice || usdPrice <= 0 || usdPrice > 10) {
    await ctx.replyWithMarkdown("*Admin Token Price*\nKullanim: `/admin_token_price 0.0005`", {
      parse_mode: "Markdown"
    });
    return;
  }
  const payload = await withTransaction(pool, async (db) =>
    updateEconomyConfigByAdmin(
      db,
      appConfig,
      (next) => {
        if (!next.token || typeof next.token !== "object") {
          next.token = {};
        }
        next.token.usd_price = Number(usdPrice);
      },
      "config_token_price_update",
      { usd_price: Number(usdPrice) }
    )
  );
  await ctx.replyWithMarkdown(
    messages.formatAdminActionResult("Token Price", `Kaydedildi: $${Number(usdPrice).toFixed(8)} (v${payload.version})`)
  );
}

async function adminSetTokenGate(ctx, pool, appConfig, minRaw, maxRaw, dripRaw) {
  if (!(await ensureAdminCtx(ctx, appConfig))) {
    return;
  }
  const minCap = parseFloatArg(minRaw);
  const maxCap = parseFloatArg(maxRaw);
  const dripPctInput = parseFloatArg(dripRaw);
  if (!minCap || minCap <= 0) {
    await ctx.replyWithMarkdown("*Admin Token Gate*\nKullanim: `/admin_token_gate <minCapUsd> [targetMaxUsd] [dailyDripPct]`", {
      parse_mode: "Markdown"
    });
    return;
  }
  const targetMax = maxCap && maxCap >= minCap ? maxCap : minCap * 2;
  const dripPct = dripPctInput && dripPctInput > 0 ? Math.min(1, dripPctInput / 100) : null;
  const payload = await withTransaction(pool, async (db) =>
    updateEconomyConfigByAdmin(
      db,
      appConfig,
      (next) => {
        if (!next.token || typeof next.token !== "object") {
          next.token = {};
        }
        if (!next.token.payout_gate || typeof next.token.payout_gate !== "object") {
          next.token.payout_gate = {};
        }
        if (!next.token.payout_release || typeof next.token.payout_release !== "object") {
          next.token.payout_release = {};
        }
        next.token.payout_gate.enabled = true;
        next.token.payout_gate.min_market_cap_usd = Number(minCap);
        next.token.payout_gate.target_band_max_usd = Number(targetMax);
        next.token.payout_release.enabled = true;
        next.token.payout_release.mode = String(next.token.payout_release.mode || "tiered_drip");
        next.token.payout_release.global_cap_min_usd = Number(minCap);
        if (dripPct !== null) {
          next.token.payout_release.daily_drip_pct_max = Number(dripPct);
        }
      },
      "config_token_gate_update",
      {
        min_market_cap_usd: Number(minCap),
        target_band_max_usd: Number(targetMax),
        daily_drip_pct_max: dripPct === null ? undefined : Number(dripPct)
      }
    )
  );
  await ctx.replyWithMarkdown(
    messages.formatAdminActionResult(
      "Token Gate",
      `Gate guncellendi: min $${Math.floor(minCap)} / target $${Math.floor(targetMax)}${
        dripPct === null ? "" : ` / drip ${(dripPct * 100).toFixed(2)}%`
      } (v${payload.version})`
    )
  );
}

async function listTokenRequestsSafe(db, userId, limit = 6) {
  try {
    return await tokenStore.listUserPurchaseRequests(db, userId, limit);
  } catch (err) {
    if (err.code === "42P01") {
      return [];
    }
    throw err;
  }
}

async function buildTokenView(db, profile, appConfig) {
  const runtimeConfig = await configService.getEconomyConfig(db);
  const tokenConfig = tokenEngine.normalizeTokenConfig(runtimeConfig);
  const balances = await economyStore.getBalances(db, profile.user_id);
  const symbol = tokenConfig.symbol;
  const tokenBalance = Number(balances[symbol] || 0);
  const unifiedUnits = tokenEngine.computeUnifiedUnits(balances, tokenConfig);
  const equivalentToken = tokenEngine.estimateTokenFromBalances(balances, tokenConfig);
  const requests = await listTokenRequestsSafe(db, profile.user_id, 5);

  const chainEntries = Object.keys(tokenConfig.purchase.chains || {}).map((chainKey) => {
    const chainConfig = tokenEngine.getChainConfig(tokenConfig, chainKey);
    const address = tokenEngine.resolvePaymentAddress(appConfig, chainConfig);
    return {
      chain: chainKey,
      pay_currency: chainConfig?.payCurrency || chainKey,
      address: maskAddress(address),
      enabled: Boolean(address)
    };
  });

  return {
    tokenConfig,
    symbol,
    balance: tokenBalance,
    unifiedUnits,
    equivalentToken,
    spotUsd: tokenConfig.usd_price,
    requests,
    chains: chainEntries
  };
}

function resolveQuickTokenBuyPlan(tokenConfig, appConfig) {
  const minUsdRaw = Number(tokenConfig?.purchase?.min_usd || 0);
  const minUsd = minUsdRaw > 0 ? Number(minUsdRaw.toFixed(2)) : 1;
  const chainKeys = Object.keys(tokenConfig?.purchase?.chains || {});
  for (const chainKey of chainKeys) {
    const chainConfig = tokenEngine.getChainConfig(tokenConfig, chainKey);
    if (!chainConfig) {
      continue;
    }
    const payAddress = tokenEngine.resolvePaymentAddress(appConfig, chainConfig);
    if (!payAddress) {
      continue;
    }
    return {
      usdAmount: minUsd,
      chain: String(chainConfig.chain || chainKey).toUpperCase()
    };
  }
  return null;
}

async function fetchQuickTokenBuyPlan(pool, appConfig) {
  return withTransaction(pool, async (db) => {
    const runtimeConfig = await configService.getEconomyConfig(db);
    const tokenConfig = tokenEngine.normalizeTokenConfig(runtimeConfig);
    if (!tokenConfig.enabled) {
      return null;
    }
    return resolveQuickTokenBuyPlan(tokenConfig, appConfig);
  });
}

async function sendQuickTokenBuyIntent(ctx, pool, appConfig) {
  const quickPlan = await fetchQuickTokenBuyPlan(pool, appConfig).catch(() => null);
  if (!quickPlan) {
    await ctx.replyWithMarkdown("*Token Satin Alma*\nAktif odeme kanali bulunamadi. Token panelinden durumu kontrol et.");
    return;
  }
  await createTokenBuyIntent(ctx, pool, appConfig, quickPlan.usdAmount, quickPlan.chain);
}

async function sendToken(ctx, pool, appConfig) {
  const payload = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    const view = await buildTokenView(db, profile, appConfig);
    return { profile, view };
  });
  await ctx.replyWithMarkdown(messages.formatTokenWallet(payload.profile, payload.view), buildTokenKeyboard());
}

async function mintToken(ctx, pool, appConfig, requestedTokenAmountRaw) {
  const payload = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    const runtimeConfig = await configService.getEconomyConfig(db);
    const freeze = await systemStore.getFreezeState(db);
    if (freeze.freeze) {
      return { ok: false, reason: "freeze_mode", freeze };
    }

    const tokenConfig = tokenEngine.normalizeTokenConfig(runtimeConfig);
    if (!tokenConfig.enabled) {
      return { ok: false, reason: "token_disabled" };
    }

    const balances = await economyStore.getBalances(db, profile.user_id);
    const plan = tokenEngine.planMintFromBalances(balances, tokenConfig, requestedTokenAmountRaw);
    if (!plan.ok) {
      return { ok: false, reason: plan.reason, plan };
    }

    const mintRef = deterministicUuid(`token_mint:${profile.user_id}:${Date.now()}:${Math.random()}`);
    for (const [currency, amount] of Object.entries(plan.debits || {})) {
      const safeAmount = Number(amount || 0);
      if (safeAmount <= 0) {
        continue;
      }
      const debit = await economyStore.debitCurrency(db, {
        userId: profile.user_id,
        currency,
        amount: safeAmount,
        reason: `token_mint_debit_${tokenConfig.symbol.toLowerCase()}`,
        refEventId: deterministicUuid(`${mintRef}:${currency}:debit`),
        meta: {
          token_symbol: tokenConfig.symbol,
          token_amount: plan.tokenAmount,
          units_spent: plan.unitsSpent
        }
      });
      if (!debit.applied) {
        return { ok: false, reason: debit.reason || "mint_debit_failed", plan };
      }
    }

    await economyStore.creditCurrency(db, {
      userId: profile.user_id,
      currency: tokenConfig.symbol,
      amount: plan.tokenAmount,
      reason: "token_mint_from_gameplay",
      refEventId: deterministicUuid(`${mintRef}:${tokenConfig.symbol}:credit`),
      meta: {
        units_spent: plan.unitsSpent,
        debits: plan.debits
      }
    });

    await riskStore.insertBehaviorEvent(db, profile.user_id, "token_mint", {
      token_symbol: tokenConfig.symbol,
      token_amount: plan.tokenAmount,
      debits: plan.debits
    });

    const view = await buildTokenView(db, profile, appConfig);
    return { ok: true, view, plan };
  });

  if (!payload.ok) {
    if (payload.reason === "freeze_mode") {
      await ctx.replyWithMarkdown(messages.formatFreezeMessage(payload.freeze.reason));
      return;
    }
    await ctx.replyWithMarkdown(messages.formatTokenMintError(payload.reason, payload.plan), buildTokenKeyboard());
    return;
  }

  await ctx.replyWithMarkdown(messages.formatTokenMintResult(payload.plan, payload.view), buildTokenKeyboard());
}

async function createTokenBuyIntent(ctx, pool, appConfig, usdAmountRaw, chainRaw) {
  let payload;
  try {
    payload = await withTransaction(pool, async (db) => {
      const profile = await ensureProfileTx(db, ctx);
      const freeze = await systemStore.getFreezeState(db);
      if (freeze.freeze) {
        return { ok: false, reason: "freeze_mode", freeze };
      }

      const runtimeConfig = await configService.getEconomyConfig(db);
      const tokenConfig = tokenEngine.normalizeTokenConfig(runtimeConfig);
      if (!tokenConfig.enabled) {
        return { ok: false, reason: "token_disabled" };
      }

      const quote = tokenEngine.quotePurchaseByUsd(usdAmountRaw, tokenConfig);
      if (!quote.ok) {
        return { ok: false, reason: quote.reason, quote };
      }

      const chainConfig = tokenEngine.getChainConfig(tokenConfig, chainRaw);
      if (!chainConfig) {
        return { ok: false, reason: "unsupported_chain" };
      }
      const payAddress = tokenEngine.resolvePaymentAddress(appConfig, chainConfig);
      if (!payAddress) {
        return { ok: false, reason: "chain_address_missing", chain: chainConfig.chain };
      }

      const request = await tokenStore.createPurchaseRequest(db, {
        userId: profile.user_id,
        tokenSymbol: tokenConfig.symbol,
        chain: chainConfig.chain,
        payCurrency: chainConfig.payCurrency,
        payAddress,
        usdAmount: quote.usdAmount,
        tokenAmount: quote.tokenAmount,
        requestRef: deterministicUuid(`token_purchase:${profile.user_id}:${Date.now()}:${Math.random()}`),
        meta: {
          spot_usd: tokenConfig.usd_price,
          token_min_receive: quote.tokenMinReceive
        }
      });

      await riskStore.insertBehaviorEvent(db, profile.user_id, "token_buy_intent", {
        request_id: request.id,
        usd_amount: quote.usdAmount,
        token_amount: quote.tokenAmount,
        chain: chainConfig.chain,
        pay_currency: chainConfig.payCurrency
      });

      return { ok: true, request, quote, tokenConfig };
    });
  } catch (err) {
    if (err.code === "42P01") {
      await ctx.replyWithMarkdown("*Token Modulu Hazir Degil*\nDB migration calistir: `npm run migrate:node`");
      return;
    }
    if (err.code === "23505") {
      await ctx.replyWithMarkdown(messages.formatTokenTxError("tx_hash_already_used"));
      return;
    }
    throw err;
  }

  if (!payload.ok) {
    if (payload.reason === "freeze_mode") {
      await ctx.replyWithMarkdown(messages.formatFreezeMessage(payload.freeze.reason));
      return;
    }
    await ctx.replyWithMarkdown(messages.formatTokenBuyIntentError(payload.reason, payload.quote, payload.chain));
    return;
  }

  await ctx.replyWithMarkdown(messages.formatTokenBuyIntent(payload.request, payload.quote, payload.tokenConfig), buildTokenKeyboard());
}

async function submitTokenTx(ctx, pool, appConfig, requestIdRaw, txHashRaw) {
  const requestId = Number(requestIdRaw || 0);
  const txHash = normalizeTxHash(txHashRaw);
  if (!requestId || !txHash || txHash.length < 24) {
    await ctx.replyWithMarkdown("*Token TX Hatasi*\nKullanim: `/tx <requestId> <txHash>`", {
      parse_mode: "Markdown"
    });
    return;
  }

  const verifyConfig = appConfig && typeof appConfig === "object" ? appConfig : {};

  let payload;
  try {
    payload = await withTransaction(pool, async (db) => {
      const profile = await ensureProfileTx(db, ctx);
      const request = await tokenStore.getPurchaseRequest(db, requestId);
      if (!request || Number(request.user_id) !== Number(profile.user_id)) {
        return { ok: false, reason: "request_not_found" };
      }
      if (String(request.status) === "approved") {
        return { ok: false, reason: "already_approved", request };
      }
      if (String(request.status) === "rejected") {
        return { ok: false, reason: "already_rejected", request };
      }

      const formatCheck = txVerifier.validateTxHash(request.chain, txHash);
      if (!formatCheck.ok) {
        return { ok: false, reason: formatCheck.reason, request };
      }

      const verifyResult = await txVerifier.verifyOnchain(request.chain, formatCheck.normalizedHash, {
        enabled: Boolean(verifyConfig.tokenTxVerifyEnabled)
      });
      if (
        Boolean(verifyConfig.tokenTxVerifyStrict) &&
        !["confirmed", "found_unconfirmed", "unsupported", "skipped"].includes(verifyResult.status)
      ) {
        return { ok: false, reason: "tx_not_found_onchain", request };
      }

      const updated = await tokenStore.submitPurchaseTxHash(db, {
        requestId,
        userId: profile.user_id,
        txHash: formatCheck.normalizedHash,
        metaPatch: {
          tx_validation: {
            chain: formatCheck.chain,
            status: verifyResult.status,
            provider: verifyResult.provider || "none",
            checked_at: new Date().toISOString()
          }
        }
      });
      if (!updated) {
        return { ok: false, reason: "request_update_failed" };
      }

      await riskStore.insertBehaviorEvent(db, profile.user_id, "token_tx_submitted", {
        request_id: requestId,
        tx_hash: formatCheck.normalizedHash.slice(0, 18),
        tx_verify_mode: Boolean(verifyConfig.tokenTxVerifyEnabled) ? "enabled" : "disabled",
        tx_verify_strict: Boolean(verifyConfig.tokenTxVerifyStrict),
        tx_verify_status: String(verifyResult.status || "unknown"),
        tx_verify_provider: String(verifyResult.provider || "none")
      });

      return { ok: true, request: updated };
    });
  } catch (err) {
    if (err.code === "42P01") {
      await ctx.replyWithMarkdown("*Token Modulu Hazir Degil*\nDB migration calistir: `npm run migrate:node`");
      return;
    }
    throw err;
  }

  if (!payload.ok) {
    await ctx.replyWithMarkdown(messages.formatTokenTxError(payload.reason, payload.request));
    return;
  }

  await ctx.replyWithMarkdown(messages.formatTokenTxSubmitted(payload.request), buildTokenKeyboard());
}

async function adminMarkPayoutPaid(ctx, pool, appConfig, requestIdRaw, txHashRaw) {
  if (!(await ensureAdminCtx(ctx, appConfig))) {
    return;
  }
  const requestId = Number(requestIdRaw || 0);
  const txHash = normalizeTxHash(txHashRaw);
  if (!requestId || !txHash || txHash.length < 12) {
    await ctx.replyWithMarkdown("*Admin Pay*\nKullanim: `/pay <requestId> <txHash>`", { parse_mode: "Markdown" });
    return;
  }

  const result = await withTransaction(pool, async (db) => {
    const paid = await payoutStore.markPaid(db, {
      requestId,
      txHash,
      adminId: Number(appConfig.adminTelegramId || 0)
    });
    await db.query(
      `INSERT INTO admin_audit (admin_id, action, target, payload_json)
       VALUES ($1, 'payout_mark_paid', $2, $3::jsonb);`,
      [Number(appConfig.adminTelegramId || 0), `payout_request:${requestId}`, JSON.stringify({ tx_hash: txHash, status: paid.status })]
    );
    return paid;
  });

  if (result.status === "not_found") {
    await ctx.replyWithMarkdown(messages.formatAdminActionResult("Payout", "Talep bulunamadi."));
    return;
  }
  if (result.status === "rejected") {
    await ctx.replyWithMarkdown(messages.formatAdminActionResult("Payout", "Talep reddedilmis, paid yapilamaz."));
    return;
  }
  await ctx.replyWithMarkdown(
    messages.formatAdminActionResult(
      "Payout Paid",
      `Talep #${requestId} paid olarak kaydedildi. TX: ${txHash.slice(0, 28)}`
    )
  );
}

async function adminRejectPayout(ctx, pool, appConfig, requestIdRaw, reasonRaw) {
  if (!(await ensureAdminCtx(ctx, appConfig))) {
    return;
  }
  const requestId = Number(requestIdRaw || 0);
  const reason = String(reasonRaw || "").trim() || "rejected_by_admin";
  if (!requestId) {
    await ctx.replyWithMarkdown("*Admin Reject Payout*\nKullanim: `/reject_payout <requestId> <sebep>`", {
      parse_mode: "Markdown"
    });
    return;
  }
  const result = await withTransaction(pool, async (db) =>
    payoutStore.markRejected(db, {
      requestId,
      adminId: Number(appConfig.adminTelegramId || 0),
      reason
    })
  );
  const text =
    result.status === "rejected"
      ? `Payout #${requestId} reddedildi.`
      : result.status === "not_found_or_paid"
        ? "Talep bulunamadi veya zaten paid."
        : "Islem tamamlanamadi.";
  await ctx.replyWithMarkdown(messages.formatAdminActionResult("Payout Reject", text));
}

async function approveTokenRequestTx(
  db,
  requestId,
  adminId,
  note,
  txHashOverride,
  tokenAmountOverride,
  verifyOptions = {}
) {
  const locked = await tokenStore.lockPurchaseRequest(db, requestId);
  if (!locked) {
    return { ok: false, reason: "not_found" };
  }
  if (String(locked.status) === "rejected") {
    return { ok: false, reason: "already_rejected" };
  }
  if (String(locked.status) === "approved") {
    return { ok: false, reason: "already_approved" };
  }

  const tokenAmount = Number(tokenAmountOverride || locked.token_amount || 0);
  if (!Number.isFinite(tokenAmount) || tokenAmount <= 0) {
    return { ok: false, reason: "invalid_token_amount" };
  }

  const txHash = String(txHashOverride || locked.tx_hash || "").trim();
  if (!txHash) {
    return { ok: false, reason: "tx_hash_missing" };
  }

  const txCheck = txVerifier.validateTxHash(locked.chain, txHash);
  if (!txCheck.ok) {
    return { ok: false, reason: txCheck.reason };
  }

  const verifyResult = await txVerifier.verifyOnchain(locked.chain, txCheck.normalizedHash, {
    enabled: Boolean(verifyOptions.enabled)
  });
  if (
    verifyOptions.strict &&
    !["confirmed", "found_unconfirmed", "unsupported", "skipped"].includes(String(verifyResult.status || ""))
  ) {
    return { ok: false, reason: "tx_not_found_onchain" };
  }
  await tokenStore.submitPurchaseTxHash(db, {
    requestId,
    userId: locked.user_id,
    txHash: txCheck.normalizedHash,
    metaPatch: {
      tx_validation: {
        chain: txCheck.chain,
        status: verifyResult.status,
        provider: verifyResult.provider || "none",
        checked_at: new Date().toISOString()
      }
    }
  });

  const runtimeConfig = await configService.getEconomyConfig(db);
  const tokenConfig = tokenEngine.normalizeTokenConfig(runtimeConfig);
  const tokenSymbol = String(locked.token_symbol || tokenConfig.symbol || "NXT").toUpperCase();
  const refEventId = deterministicUuid(`token_purchase_credit:${requestId}:${tokenSymbol}`);

  await economyStore.creditCurrency(db, {
    userId: locked.user_id,
    currency: tokenSymbol,
    amount: tokenAmount,
    reason: "token_purchase_approved",
    refEventId,
    meta: {
      request_id: requestId,
      chain: locked.chain,
      usd_amount: Number(locked.usd_amount || 0),
      tx_hash: txCheck.normalizedHash
    }
  });

  const updated = await tokenStore.markPurchaseApproved(db, {
    requestId,
    adminId,
    adminNote: note || `approved:${tokenAmount}`
  });

  await db.query(
    `INSERT INTO admin_audit (admin_id, action, target, payload_json)
     VALUES ($1, 'token_purchase_approve', $2, $3::jsonb);`,
    [
      adminId,
      `token_purchase_request:${requestId}`,
      JSON.stringify({
        token_amount: tokenAmount,
        token_symbol: tokenSymbol,
        tx_hash: txCheck.normalizedHash
      })
    ]
  );

  return { ok: true, updated };
}

async function adminApproveToken(ctx, pool, appConfig, requestIdRaw, noteRaw) {
  if (!(await ensureAdminCtx(ctx, appConfig))) {
    return;
  }
  const requestId = Number(requestIdRaw || 0);
  if (!requestId) {
    await ctx.replyWithMarkdown("*Admin Approve Token*\nKullanim: `/approve_token <requestId> [note]`", {
      parse_mode: "Markdown"
    });
    return;
  }
  const note = String(noteRaw || "").trim();
  let result;
  try {
    result = await withTransaction(pool, async (db) =>
      approveTokenRequestTx(db, requestId, Number(appConfig.adminTelegramId || 0), note, "", 0, {
        enabled: Boolean(appConfig.tokenTxVerifyEnabled),
        strict: Boolean(appConfig.tokenTxVerifyStrict)
      })
    );
  } catch (err) {
    if (err.code === "42P01") {
      await ctx.replyWithMarkdown(messages.formatAdminActionResult("Token", "Token tablolari hazir degil."));
      return;
    }
    if (err.code === "23505") {
      await ctx.replyWithMarkdown(messages.formatAdminActionResult("Token", "TX hash zaten baska talepte kullanilmis."));
      return;
    }
    throw err;
  }

  if (!result.ok) {
    await ctx.replyWithMarkdown(
      messages.formatAdminActionResult("Token Approve", `Basarisiz: ${escapeMarkdownText(result.reason || "unknown_error")}`)
    );
    return;
  }

  await ctx.replyWithMarkdown(
    messages.formatAdminActionResult("Token Approve", `Talep #${requestId} onaylandi.`)
  );
}

async function adminRejectToken(ctx, pool, appConfig, requestIdRaw, reasonRaw) {
  if (!(await ensureAdminCtx(ctx, appConfig))) {
    return;
  }
  const requestId = Number(requestIdRaw || 0);
  if (!requestId) {
    await ctx.replyWithMarkdown("*Admin Reject Token*\nKullanim: `/reject_token <requestId> <sebep>`", {
      parse_mode: "Markdown"
    });
    return;
  }
  const reason = String(reasonRaw || "").trim() || "rejected_by_admin";
  let result;
  try {
    result = await withTransaction(pool, async (db) => {
      const locked = await tokenStore.lockPurchaseRequest(db, requestId);
      if (!locked) {
        return { ok: false, reason: "not_found" };
      }
      if (String(locked.status) === "approved") {
        return { ok: false, reason: "already_approved" };
      }
      await tokenStore.markPurchaseRejected(db, {
        requestId,
        adminId: Number(appConfig.adminTelegramId || 0),
        reason
      });
      await db.query(
        `INSERT INTO admin_audit (admin_id, action, target, payload_json)
         VALUES ($1, 'token_purchase_reject', $2, $3::jsonb);`,
        [
          Number(appConfig.adminTelegramId || 0),
          `token_purchase_request:${requestId}`,
          JSON.stringify({ reason })
        ]
      );
      return { ok: true };
    });
  } catch (err) {
    if (err.code === "42P01") {
      await ctx.replyWithMarkdown(messages.formatAdminActionResult("Token", "Token tablolari hazir degil."));
      return;
    }
    throw err;
  }

  const msg = result.ok ? `Talep #${requestId} reddedildi.` : `Basarisiz: ${result.reason}`;
  await ctx.replyWithMarkdown(messages.formatAdminActionResult("Token Reject", msg));
}

async function adminSetFreeze(ctx, pool, appConfig, freeze, reasonRaw) {
  if (!(await ensureAdminCtx(ctx, appConfig))) {
    return;
  }
  const reason = String(reasonRaw || "").trim() || (freeze ? "manual_freeze" : "");
  await withTransaction(pool, async (db) =>
    setFreezeState(db, {
      freeze: Boolean(freeze),
      reason,
      updatedBy: Number(appConfig.adminTelegramId || 0)
    })
  );
  await ctx.replyWithMarkdown(
    messages.formatAdminActionResult("Freeze Durumu", freeze ? `ACIK (${reason})` : "KAPALI")
  );
}

async function handlePayoutRequest(ctx, pool, appConfig) {
  const currency = String(ctx.match[1] || "").toUpperCase();
  if (currency !== "BTC") {
    await ctx.answerCbQuery("Desteklenmeyen cekim tipi", { show_alert: true });
    return;
  }

  const payload = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    const freeze = await systemStore.getFreezeState(db);
    if (freeze.freeze) {
      const runtimeConfig = await configService.getEconomyConfig(db);
      const frozenView = await buildPayoutView(db, profile, appConfig, runtimeConfig);
      return { ok: false, reason: "freeze_mode", view: frozenView };
    }
    const runtimeConfig = await configService.getEconomyConfig(db);
    const view = await buildPayoutView(db, profile, appConfig, runtimeConfig);
    if (!view.canRequest) {
      if (view.release?.enabled && view.release.globalGateOpen === false) {
        return { ok: false, reason: "market_cap_gate", view };
      }
      if (view.release?.enabled && Number(view.release.todayDripRemainingBtc || 0) <= 0) {
        return { ok: false, reason: "daily_drip_exhausted", view };
      }
      if (view.marketCapGate?.enabled && !view.marketCapGate.allowed) {
        return { ok: false, reason: "market_cap_gate", view };
      }
      return { ok: false, reason: "not_eligible", view };
    }

    const address = appConfig.addresses.btc;
    const addressHash = hashAddress(address);
    const fxRate = Number(appConfig.hcToBtcRate || 0.00001);
    if (fxRate <= 0) {
      return { ok: false, reason: "invalid_fx_rate", view };
    }
    const sourceHcAmount = Number((Number(view.requestableBtc || 0) / fxRate).toFixed(8));
    if (sourceHcAmount <= 0) {
      return { ok: false, reason: "no_hc_balance", view };
    }
    const amount = Number(Number(view.requestableBtc || 0).toFixed(8));
    if (amount <= 0) {
      return { ok: false, reason: "invalid_amount", view };
    }
    const request = await payoutStore.createRequest(db, {
      userId: profile.user_id,
      currency: "BTC",
      amount,
      addressType: "BTC_MAIN",
      addressHash,
      cooldownHours: Number(appConfig.payoutCooldownHours || 72),
      sourceHcAmount,
      fxRateSnapshot: fxRate
    });
    if (!request) {
      const freshView = await buildPayoutView(db, profile, appConfig, runtimeConfig);
      return { ok: false, reason: "duplicate_or_locked", view: freshView };
    }

    const burn = await economyStore.debitCurrency(db, {
      userId: profile.user_id,
      currency: "HC",
      amount: sourceHcAmount,
      reason: "payout_request_lock_hc",
      refEventId: deterministicUuid(`payout_lock:${request.id}:HC`),
      meta: {
        payoutRequestId: request.id,
        currency: "BTC",
        amountBtc: amount,
        sourceHcAmount,
        fxRateSnapshot: fxRate
      }
    });
    if (!burn.applied) {
      await payoutStore.markRejectedSystem(db, {
        requestId: request.id,
        reason: burn.reason || "hc_lock_failed"
      });
      const freshView = await buildPayoutView(db, profile, appConfig, runtimeConfig);
      return { ok: false, reason: "hc_lock_failed", view: freshView };
    }

    await riskStore.insertBehaviorEvent(db, profile.user_id, "payout_request", {
      currency: "BTC",
      amount,
      source_hc_amount: sourceHcAmount,
      address_masked: maskAddress(address)
    });
    await payoutStore
      .insertPayoutReleaseEvent(db, {
        userId: profile.user_id,
        payoutRequestId: request.id,
        eventType: "payout_request_created",
        currency: "BTC",
        amountBtc: amount,
        unlockTier: String(view.release?.unlockTier || "T0"),
        unlockScore: Number(view.release?.unlockScore || 0),
        eventJson: {
          request_id: request.id,
          requestable_btc: Number(view.requestableBtc || 0),
          drip_remaining_btc: Number(view.release?.todayDripRemainingBtc || 0)
        },
        createdBy: Number(appConfig.adminTelegramId || 0)
      })
      .catch((err) => {
        if (err.code !== "42P01") {
          throw err;
        }
      });

    const nextView = await buildPayoutView(db, profile, appConfig, runtimeConfig);
    return { ok: true, request, view: nextView };
  });

  await ctx.answerCbQuery();
  const payoutUrl = await resolveMiniAppCommandUrl(pool, appConfig, ctx.from?.id, "payout");
  const payoutKeyboard = buildPayoutKeyboard(
    payload.view.canRequest,
    normalizeLanguage(ctx.from?.language_code, "tr"),
    payoutUrl || ""
  );
  if (!payload.ok) {
    if (payload.reason === "freeze_mode") {
      await ctx.replyWithMarkdown(messages.formatFreezeMessage("Bakim aktif, payout talebi kapali."));
    } else if (payload.reason === "daily_drip_exhausted") {
      await ctx.replyWithMarkdown("*Gunluk Damla Limiti Doldu*\nYeni payout icin ertesi gun dene.");
    }
    await ctx.replyWithMarkdown(messages.formatPayout(payload.view), payoutKeyboard);
    return;
  }

  await ctx.replyWithMarkdown(
    `*Cekim Talebi Alindi*\nTalep #${payload.request.id}\nMiktar: *${Number(payload.request.amount).toFixed(8)} BTC*\nDurum: *requested*`
  );
  await ctx.replyWithMarkdown(messages.formatPayout(payload.view), payoutKeyboard);
  logEvent("payout_request", {
    request_id: payload.request.id,
    currency: "BTC",
    amount: Number(payload.request.amount || 0),
    source_hc_amount: Number(payload.request.source_hc_amount || 0)
  });
}

async function sendStatus(ctx, pool, appConfig) {
  const payload = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    const runtimeConfig = await configService.getEconomyConfig(db);
    const freeze = await systemStore.getFreezeState(db);
    const season = seasonStore.getSeasonInfo(runtimeConfig);
    const anomaly = nexusEventEngine.publicAnomalyView(
      nexusEventEngine.resolveDailyAnomaly(runtimeConfig, {
        seasonId: season.seasonId
      })
    );
    const contract = resolveLiveContract(runtimeConfig, season, anomaly);
    const war = await globalStore.getWarStatus(db, season.seasonId);
    const missions = await missionStore.getMissionBoard(db, profile.user_id);
    const payout = await buildPayoutView(db, profile, appConfig, runtimeConfig);
    const openMissions = missions.filter((m) => !m.claimed).length;
    const readyMissions = missions.filter((m) => m.completed && !m.claimed).length;
    const risk = await riskStore.getRiskState(db, profile.user_id);
    const tokenView = await buildTokenView(db, profile, appConfig);
    return {
      profile,
      freeze,
      season,
      anomaly,
      contract,
      war,
      payout,
      tokenView,
      openMissions,
      readyMissions,
      risk: risk.riskScore,
      configCache: configService.getConfigCacheStatus()
    };
  });

  const lang = resolvePreferredLanguage(payload.profile, ctx, "tr");
  const freezeText = payload.freeze.freeze ? (lang === "en" ? "on" : "acik") : lang === "en" ? "off" : "kapali";
  const loopText = appConfig.loopV2Enabled ? (lang === "en" ? "enabled" : "acik") : lang === "en" ? "disabled" : "kapali";
  const payoutText = payload.payout.canRequest ? (lang === "en" ? "yes" : "evet") : lang === "en" ? "no" : "hayir";
  const safeAnomalyTitle = escapeMarkdownText(payload.anomaly.title || "-");
  const safeAnomalyMode = escapeMarkdownText(payload.anomaly.preferred_mode || "balanced");
  const safeContractTitle = escapeMarkdownText(payload.contract.title || "-");
  const safeContractMode = escapeMarkdownText(payload.contract.required_mode || "balanced");
  const safeTokenSymbol = escapeMarkdownText(payload.tokenView.symbol || "NXT");
  const safeWarTier = escapeMarkdownText(payload.war.tier || "seed");
  const { status_hub = "", discover_panel = "" } = await resolveMiniAppLaunchSurfaceBundle(pool, appConfig, ctx.from?.id, [
    "status_hub",
    "discover_panel"
  ]);

  await ctx.replyWithMarkdown(
    lang === "en"
      ? `*System Status*\n` +
        `Loop v2: *${loopText}*\n` +
        `Freeze: *${freezeText}*\n` +
        `Config Source: *${escapeMarkdownText(payload.configCache.source || "unknown")}*\n` +
        `Season: *S${payload.season.seasonId}* (${payload.season.daysLeft} days)\n` +
        `Nexus: *${safeAnomalyTitle}* (${payload.anomaly.pressure_pct}% pressure, ${safeAnomalyMode})\n` +
        `Contract: *${safeContractTitle}* [${safeContractMode}]\n` +
        `War Tier: *${safeWarTier}* (${Math.floor(payload.war.value)})\n` +
        `Missions: *${payload.readyMissions} ready / ${payload.openMissions} active*\n` +
        `Risk: *${Math.round(payload.risk * 100)}%*\n` +
        `Payout Eligible: *${payoutText}*\n` +
        `${safeTokenSymbol}: *${Number(payload.tokenView.balance || 0).toFixed(payload.tokenView.tokenConfig.decimals)}*`
      : `*Sistem Durumu*\n` +
        `Loop v2: *${loopText}*\n` +
        `Freeze: *${freezeText}*\n` +
        `Config Kaynagi: *${escapeMarkdownText(payload.configCache.source || "bilinmeyen")}*\n` +
        `Sezon: *S${payload.season.seasonId}* (${payload.season.daysLeft} gun)\n` +
        `Nexus: *${safeAnomalyTitle}* (${payload.anomaly.pressure_pct}% basinc, ${safeAnomalyMode})\n` +
        `Kontrat: *${safeContractTitle}* [${safeContractMode}]\n` +
        `War Tier: *${safeWarTier}* (${Math.floor(payload.war.value)})\n` +
        `Misyon: *${payload.readyMissions} hazir / ${payload.openMissions} aktif*\n` +
        `Risk: *${Math.round(payload.risk * 100)}%*\n` +
        `Payout Uygunluk: *${payoutText}*\n` +
        `${safeTokenSymbol}: *${Number(payload.tokenView.balance || 0).toFixed(payload.tokenView.tokenConfig.decimals)}*`,
    buildStatusKeyboard(status_hub, discover_panel, lang)
  );
}

async function sendOps(ctx, pool) {
  const payload = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    const risk = await riskStore.getRiskState(db, profile.user_id);
    const hourly = await riskStore.getHourlySnapshot(db, profile.user_id);
    const events = await riskStore.listBehaviorEvents(db, profile.user_id, 8);
    const activeAttempt = await taskStore.getLatestPendingAttempt(db, profile.user_id);
    const revealAttempt = await taskStore.getLatestRevealableAttempt(db, profile.user_id);
    const effects = await shopStore.getActiveEffects(db, profile.user_id);
    const runtimeConfig = await configService.getEconomyConfig(db);
    const season = seasonStore.getSeasonInfo(runtimeConfig);
    const anomaly = nexusEventEngine.publicAnomalyView(
      nexusEventEngine.resolveDailyAnomaly(runtimeConfig, {
        seasonId: season.seasonId
      })
    );

    const activeOffer = activeAttempt ? await taskStore.getOffer(db, profile.user_id, activeAttempt.task_offer_id) : null;
    const revealOffer = revealAttempt ? await taskStore.getOffer(db, profile.user_id, revealAttempt.task_offer_id) : null;
    const callbackTotal = Number(hourly.callback_total || 0);
    const callbackDuplicate = Number(hourly.callback_duplicate_total || 0);
    const duplicateRatio = callbackTotal > 0 ? (callbackDuplicate / callbackTotal) * 100 : 0;

    return {
      riskPct: Math.round(Number(risk.riskScore || 0) * 100),
      hourlyComplete: Number(hourly.task_complete_total || 0),
      duplicateRatio: Number(duplicateRatio.toFixed(1)),
      activeAttempt: activeAttempt
        ? {
            id: activeAttempt.id,
            taskType: activeOffer?.task_type || "unknown",
            startedAt: new Date(activeAttempt.started_at).toISOString().slice(11, 16)
          }
        : null,
      revealAttempt: revealAttempt
        ? {
            id: revealAttempt.id,
            taskType: revealOffer?.task_type || "unknown",
            completedAt: revealAttempt.completed_at
              ? new Date(revealAttempt.completed_at).toISOString().slice(11, 16)
              : "--:--"
          }
        : null,
      effects: (effects || []).map((effect) => ({
        effect_key: effect.effect_key,
        expires_at: new Date(effect.expires_at).toISOString().slice(5, 16).replace("T", " ")
      })),
      events: (events || []).map((event) => ({
        event_type: event.event_type,
        time: new Date(event.event_at).toISOString().slice(11, 16),
        hint: event.meta_json?.play_mode || event.meta_json?.tier || event.meta_json?.result || ""
      })),
      anomaly
    };
  });

  await ctx.replyWithMarkdown(messages.formatOps(payload));
}

async function sendArenaRank(ctx, pool) {
  const payload = await withTransaction(pool, async (db) => {
    const arenaReady = await arenaStore.hasArenaTables(db);
    if (!arenaReady) {
      return { error: "arena_tables_missing" };
    }
    const profile = await ensureProfileTx(db, ctx);
    const runtimeConfig = await configService.getEconomyConfig(db);
    const arenaConfig = arenaEngine.getArenaConfig(runtimeConfig);
    const season = seasonStore.getSeasonInfo(runtimeConfig);
    const state = await arenaStore.getArenaState(db, profile.user_id, arenaConfig.baseRating);
    const rank = await arenaStore.getRank(db, profile.user_id);
    const leaderboard = await arenaStore.getLeaderboard(db, season.seasonId, 10);
    const recentRuns = await arenaStore.getRecentRuns(db, profile.user_id, 6);
    return {
      rating: Number(state?.rating || arenaConfig.baseRating),
      gamesPlayed: Number(state?.games_played || 0),
      wins: Number(state?.wins || 0),
      losses: Number(state?.losses || 0),
      lastResult: state?.last_result || "",
      rank: Number(rank?.rank || 0),
      leaderboard,
      recentRuns,
      ticketCost: arenaConfig.ticketCostRc,
      cooldownSec: arenaConfig.cooldownSec
    };
  });

  if (payload.error === "arena_tables_missing") {
    await ctx.replyWithMarkdown("*Arena Hazir Degil*\nMigration calistir: `scripts/migrate.ps1`");
    return;
  }

  await ctx.replyWithMarkdown(messages.formatArenaStatus(payload), buildRaidKeyboard());
}

async function handleArenaRaid(ctx, pool) {
  const modeRaw = ctx.match?.[1] || normalizeModeFromText(extractCommandArgs(ctx));
  const requestSeed = ctx.callbackQuery?.id || `${ctx.from?.id || "u"}:${Date.now()}`;
  const payload = await withTransaction(pool, async (db) => {
    const arenaReady = await arenaStore.hasArenaTables(db);
    if (!arenaReady) {
      return { ok: false, error: "arena_tables_missing" };
    }
    const profile = await ensureProfileTx(db, ctx);
    const freeze = await systemStore.getFreezeState(db);
    if (freeze.freeze) {
      return { ok: false, error: "freeze_mode", freeze };
    }
    const runtimeConfig = await configService.getEconomyConfig(db);
    return arenaService.runArenaRaid(db, {
      profile,
      config: runtimeConfig,
      modeKey: modeRaw,
      requestId: `bot:${requestSeed}`,
      source: "bot"
    });
  });

  if (ctx.answerCbQuery) {
    await ctx.answerCbQuery();
  }

  if (!payload.ok) {
    if (payload.error === "freeze_mode") {
      await ctx.replyWithMarkdown(messages.formatFreezeMessage(payload.freeze?.reason));
      return;
    }
    if (payload.error === "insufficient_rc") {
      await ctx.replyWithMarkdown("*Arena Ticket Yetersiz*\nRaid icin en az 1 RC gerekli.");
      return;
    }
    if (payload.error === "arena_cooldown") {
      await ctx.replyWithMarkdown(`*Arena Cooldown*\nTekrar denemek icin ${payload.cooldown_sec_left || 0}s bekle.`);
      return;
    }
    if (payload.error === "arena_tables_missing") {
      await ctx.replyWithMarkdown("*Arena Hazir Degil*\nMigration calistir: `scripts/migrate.ps1`");
      return;
    }
    await ctx.replyWithMarkdown(`*Arena Hatasi*\n${escapeMarkdownText(payload.error || "bilinmeyen_hata")}`);
    return;
  }

  if (payload.duplicate) {
    await ctx.replyWithMarkdown("*Raid Tekrari*\nBu raid zaten islenmis.", buildRaidKeyboard());
    return;
  }

  await ctx.replyWithMarkdown(messages.formatArenaRaidResult(payload), buildRaidKeyboard());
}

async function sendGuide(ctx, pool) {
  const snapshot = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    const balances = await economyStore.getBalances(db, profile.user_id);
    const dailyRaw = await economyStore.getTodayCounter(db, profile.user_id);
    const runtimeConfig = await configService.getEconomyConfig(db);
    const season = seasonStore.getSeasonInfo(runtimeConfig);
    const anomaly = nexusEventEngine.publicAnomalyView(
      nexusEventEngine.resolveDailyAnomaly(runtimeConfig, {
        seasonId: season.seasonId
      })
    );
    const contract = resolveLiveContract(runtimeConfig, season, anomaly);
    const pvpContent = await arenaService.getPvpProgressionSnapshot(db, {
      config: runtimeConfig,
      seasonId: season.seasonId,
      userId: profile.user_id
    });
    const offers = await taskStore.listActiveOffers(db, profile.user_id);
    const active = await taskStore.getLatestPendingAttempt(db, profile.user_id);
    const revealable = await taskStore.getLatestRevealableAttempt(db, profile.user_id);
    const risk = await riskStore.getRiskState(db, profile.user_id);
    return {
      profile,
      balances,
      daily: buildDailyView(runtimeConfig, profile, dailyRaw),
      anomaly,
      contract,
      pvpContent,
      offers,
      attempts: { active, revealable },
      riskScore: Number(risk.riskScore || 0)
    };
  });
  const lang = resolvePreferredLanguage(snapshot.profile, ctx, "tr");
  await ctx.replyWithMarkdown(messages.formatGuide(snapshot, { lang }), buildGuideKeyboard(lang));
}

async function sendOnboard(ctx, pool, appConfig) {
  const payload = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    const balances = await economyStore.getBalances(db, profile.user_id);
    const dailyRaw = await economyStore.getTodayCounter(db, profile.user_id);
    const runtimeConfig = await configService.getEconomyConfig(db);
    const season = seasonStore.getSeasonInfo(runtimeConfig);
    const tokenView = await buildTokenView(db, profile, appConfig);
    return {
      profile,
      balances,
      daily: buildDailyView(runtimeConfig, profile, dailyRaw),
      season,
      token: {
        symbol: tokenView.symbol,
        balance: Number(tokenView.balance || 0),
        spotUsd: Number(tokenView.spotUsd || 0)
      }
    };
  });
  const lang = resolvePreferredLanguage(payload.profile, ctx, "tr");
  await ctx.replyWithMarkdown(messages.formatOnboard(payload, { lang }), buildGuideKeyboard(lang));
}

async function sendPlay(ctx, pool, appConfig) {
  const profile = await ensureProfile(pool, ctx);
  const lang = resolvePreferredLanguage(profile, ctx, "tr");
  const launchBaseUrl = await resolveWebAppLaunchBaseUrl(pool, appConfig, ctx.from?.id);
  const url = buildSignedWebAppUrl(appConfig, ctx.from?.id, launchBaseUrl, {
    routeKey: CANONICAL_ROUTE_KEY.HUB
  });
  if (!url) {
    await ctx.replyWithMarkdown(
      lang === "en"
        ? "*Arena 3D Not Ready*\nWEBAPP_PUBLIC_URL or WEBAPP_HMAC_SECRET is missing."
        : "*Arena 3D Hazir Degil*\nWEBAPP_PUBLIC_URL veya WEBAPP_HMAC_SECRET eksik."
    );
    return;
  }

  const safeName = escapeMarkdownText(profile.public_name || "Kral");
  await ctx.replyWithMarkdown(
    /^https:\/\//i.test(String(url))
      ? lang === "en"
        ? `*Arena 3D*\nPlayer: *${safeName}*\nLive UI, animation and task panels are here.`
        : `*Arena 3D*\nKral: *${safeName}*\nCanli UI, animasyon ve gorev panelleri burada.`
      : lang === "en"
        ? `*Arena 3D (Local Test)*\nPlayer: *${safeName}*\nTelegram Mini App buttons require HTTPS. Use URL button for local test.`
        : `*Arena 3D (Local Test)*\nKral: *${safeName}*\nTelegram Mini App butonu HTTPS ister. Local test icin URL butonu ile ac.`,
    buildPlayKeyboard(url, lang)
  );
}

async function sendLauncherMenu(ctx, pool) {
  const freeze = await withTransaction(pool, (db) => systemStore.getFreezeState(db));
  if (freeze.freeze) {
    await ctx.replyWithMarkdown(messages.formatFreezeMessage(freeze.reason));
    return false;
  }
  const snapshot = await getSnapshot(pool, ctx);
  const lang = resolvePreferredLanguage(snapshot.profile, ctx, "tr");
  await ctx.replyWithMarkdown(
    messages.formatStart(snapshot.profile, snapshot.balances, snapshot.season, snapshot.anomaly, snapshot.contract, { lang }),
    buildStartKeyboard(lang)
  );
  return true;
}

async function sendUnknownIntentHint(ctx, pool) {
  const profile = await ensureProfile(pool, ctx).catch(() => null);
  const lang = resolvePreferredLanguage(profile, ctx, "tr");
  const text =
    lang === "en"
      ? `*I couldn't resolve that command.*\nTry one of these quick routes:\n` +
        `- \`/menu\` -> launcher and shortcuts\n` +
        `- \`tasks\` or \`/tasks\`\n` +
        `- \`finish balanced\`\n` +
        `- \`reveal\`\n` +
        `- \`pvp aggressive\`\n\n` +
        `Open \`/help\` for detailed cards, or \`/lang tr\` / \`/lang en\` to switch language.`
      : `*Bu komutu anlayamadim.*\nSu hizli rotalardan biriyle devam et:\n` +
        `- \`/menu\` -> launcher ve kisayollar\n` +
        `- \`gorev\` veya \`/tasks\`\n` +
        `- \`bitir dengeli\`\n` +
        `- \`reveal\`\n` +
        `- \`pvp aggressive\`\n\n` +
        `Detayli kartlar icin \`/help\`, dil degisimi icin \`/lang tr\` veya \`/lang en\` kullan.`;
  await ctx.replyWithMarkdown(text, buildHelpKeyboard(lang));
}

async function setLanguagePreference(ctx, pool, rawArgs = "") {
  const parts = parseWords(rawArgs);
  const selected = parseLanguageChoice(parts[0] || "");
  const currentProfile = await ensureProfile(pool, ctx);
  const current = resolvePreferredLanguage(currentProfile, ctx, "tr");
  if (!selected) {
    const usage =
      current === "en"
        ? `*Language Preference*\nUsage: \`/lang tr\` or \`/lang en\`\nCurrent: *${String(current).toUpperCase()}*`
        : `*Dil Tercihi*\nKullanim: \`/lang tr\` veya \`/lang en\`\nMevcut: *${String(current).toUpperCase()}*`;
    await ctx.replyWithMarkdown(usage, buildHelpKeyboard(current));
    return;
  }

  await withTransaction(pool, async (db) => {
    await ensureProfileTx(db, ctx);
    await userStore.setLocaleByTelegramId(db, {
      telegramId: Number(ctx.from?.id || 0),
      locale: selected
    });
    return true;
  });

  if (selected === "en") {
    await ctx.replyWithMarkdown(
      `*Language Updated*\nBot language is now set to *EN*.\nUse \`/help\` for command cards.`,
      buildHelpKeyboard("en")
    );
    return;
  }

  await ctx.replyWithMarkdown(
    `*Dil Guncellendi*\nBot dili *TR* olarak kaydedildi.\nKomut kartlari icin \`/help\` yazabilirsin.`,
    buildHelpKeyboard("tr")
  );
}

function reserveWebAppActionIdempotency(ctx, action, payload = {}) {
  const normalizedAction = String(action || "")
    .trim()
    .toLowerCase();
  if (!WEBAPP_CRITICAL_ACTIONS.has(normalizedAction)) {
    return { ok: true, requestId: "" };
  }

  const requestId = String(payload.action_request_id || payload.request_id || "")
    .trim()
    .slice(0, 128);
  if (!requestId || requestId.length < 6) {
    return { ok: false, reason: "missing_request_id" };
  }

  const now = Date.now();
  for (const [key, expireAt] of WEBAPP_ACTION_IDEMPOTENCY_CACHE.entries()) {
    if (expireAt <= now) {
      WEBAPP_ACTION_IDEMPOTENCY_CACHE.delete(key);
    }
  }

  const actorId = Number(ctx.from?.id || 0);
  const key = `${actorId}:${normalizedAction}:${requestId}`;
  const existing = Number(WEBAPP_ACTION_IDEMPOTENCY_CACHE.get(key) || 0);
  if (existing > now) {
    return { ok: false, reason: "idempotency_conflict", requestId };
  }

  WEBAPP_ACTION_IDEMPOTENCY_CACHE.set(key, now + WEBAPP_ACTION_IDEMPOTENCY_TTL_MS);
  return { ok: true, requestId };
}

async function handleWebAppAction(ctx, pool, appConfig, simpleWebAppActionHandlers = {}) {
  const raw = ctx.message?.web_app_data?.data;
  if (!raw) {
    return;
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (err) {
    await ctx.replyWithMarkdown("*WebApp Veri Hatasi*\nGecersiz paket.");
    return;
  }

  const action = String(payload.action || "").toLowerCase();
  if (!action) {
    await ctx.replyWithMarkdown("*WebApp Veri Hatasi*\nAksiyon eksik.");
    return;
  }

  const idempotency = reserveWebAppActionIdempotency(ctx, action, payload);
  if (!idempotency.ok) {
    if (idempotency.reason === "missing_request_id") {
      await ctx.replyWithMarkdown("*WebApp Veri Hatasi*\nKritik aksiyonlarda `request_id` zorunlu.");
      return;
    }
    await ctx.replyWithMarkdown("*WebApp Aksiyon Tekrari*\nAyni istek zaten islenmis, paneli yenile.");
    return;
  }

  const simpleActionHandler = simpleWebAppActionHandlers[action];
  if (typeof simpleActionHandler === "function") {
    await simpleActionHandler(ctx);
    return;
  }
  if (action === "accept_offer") {
    const offerId = Number(payload.offer_id || payload.offerId);
    if (!offerId) {
      await ctx.replyWithMarkdown("*WebApp Veri Hatasi*\noffer_id gecersiz.");
      return;
    }
    const synthetic = buildSyntheticCallbackCtx(ctx, [null, String(offerId)]);
    await handleTaskAccept(synthetic, pool, appConfig);
    return;
  }
  if (action === "complete_latest") {
    await completeLatestAttemptFromCommand(ctx, pool, appConfig, payload.mode || payload.play_mode);
    return;
  }
  if (action === "reveal_latest") {
    await revealLatestFromCommand(ctx, pool, appConfig);
    return;
  }
  if (action === "mint_token") {
    await mintToken(ctx, pool, appConfig, payload.amount);
    return;
  }
  if (action === "buy_token") {
    await createTokenBuyIntent(ctx, pool, appConfig, payload.usd_amount, payload.chain);
    return;
  }
  if (action === "submit_token_tx") {
    await submitTokenTx(ctx, pool, appConfig, payload.request_id, payload.tx_hash);
    return;
  }
  if (action === "reroll_tasks") {
    const sourceRef = payload.action_request_id || payload.request_id || payload.client_ts || Date.now();
    const result = await withTransaction(pool, async (db) => {
      const profile = await ensureProfileTx(db, ctx);
      return rerollTasksTx(db, profile, appConfig, `webapp:${sourceRef}`);
    });
    if (!result.ok) {
      if (result.reason === "freeze_mode") {
        await ctx.replyWithMarkdown(messages.formatFreezeMessage(result.freeze.reason));
        return;
      }
      await ctx.replyWithMarkdown("*Yenileme Basarisiz*\nEn az 1 RC gerekli.");
      return;
    }
    const taskMap = new Map(taskCatalog.getCatalog().map((task) => [task.id, task]));
    const tasksUrl = await resolveMiniAppRouteUrl(pool, appConfig, ctx.from?.id, {
      routeKey: CANONICAL_ROUTE_KEY.MISSIONS,
      panelKey: CANONICAL_PANEL_KEY.QUESTS,
      focusKey: "board"
    });
    await ctx.replyWithMarkdown(
      messages.formatTasks(result.offers, taskMap, {
        anomaly: result.anomaly,
        contract: result.contract
      }),
      buildTaskKeyboard(result.offers, normalizeLanguage(ctx.from?.language_code, "tr"), tasksUrl || "")
    );
    return;
  }

  await ctx.replyWithMarkdown(`*WebApp Aksiyon Bilinmiyor*\n${escapeMarkdownText(action)}`);
}

function buildSimpleBotActionHandlers({ pool, appConfig }) {
  return {
    tasks: async (ctx) => sendTasks(ctx, pool, appConfig),
    wallet: async (ctx) => sendWallet(ctx, pool, appConfig),
    token: async (ctx) => sendToken(ctx, pool, appConfig),
    season: async (ctx) => sendSeason(ctx, pool, appConfig),
    leaderboard: async (ctx) => sendLeaderboard(ctx, pool, appConfig),
    shop: async (ctx) => sendShop(ctx, pool, appConfig),
    missions: async (ctx) => sendMissions(ctx, pool, appConfig),
    daily: async (ctx) => sendDaily(ctx, pool, appConfig),
    kingdom: async (ctx) => sendKingdom(ctx, pool),
    war: async (ctx) => sendWar(ctx, pool),
    payout: async (ctx) => sendPayout(ctx, pool, appConfig),
    status: async (ctx) => sendStatus(ctx, pool, appConfig),
    nexus: async (ctx) => sendNexus(ctx, pool, appConfig),
    guide: async (ctx) => sendGuide(ctx, pool),
    onboard: async (ctx) => sendOnboard(ctx, pool, appConfig),
    more_menu: async (ctx) => {
      const profile = await ensureProfile(pool, ctx).catch(() => null);
      const lang = resolvePreferredLanguage(profile, ctx, "tr");
      const text =
        lang === "en"
          ? "*Extra Command Hub*\nAdvanced panels, economy actions and meta controls:"
          : "*Ek Komut Merkezi*\nIleri paneller, ekonomi aksiyonlari ve meta kontroller:";
      return ctx.replyWithMarkdown(text, buildMoreMenuKeyboard(lang));
    },
    home_menu: async (ctx) => sendLauncherMenu(ctx, pool),
    guide_finish_balanced: async (ctx) => completeLatestAttemptFromCommand(ctx, pool, appConfig, "balanced"),
    guide_reveal: async (ctx) => revealLatestFromCommand(ctx, pool, appConfig),
    play: async (ctx) => sendPlay(ctx, pool, appConfig),
    arena_rank: async (ctx) => sendArenaRank(ctx, pool),
    token_mint: async (ctx) => mintToken(ctx, pool, appConfig),
    token_buy_quick: async (ctx) => sendQuickTokenBuyIntent(ctx, pool, appConfig),
    admin_panel_refresh: async (ctx) => sendAdminPanel(ctx, pool, appConfig),
    admin_open_payouts: async (ctx) => sendAdminPayoutQueue(ctx, pool, appConfig),
    admin_open_queue: async (ctx) => sendAdminQueue(ctx, pool, appConfig),
    admin_open_tokens: async (ctx) => sendAdminTokenQueue(ctx, pool, appConfig)
  };
}

function normalizeModeFromText(input) {
  return normalizeMode(String(input || "").trim().toLowerCase());
}

function extractCommandArgs(ctx) {
  const stateArgs = String(ctx?.state?.commandArgsText || "").trim();
  if (stateArgs) {
    return stateArgs;
  }
  const text = String(ctx.message?.text || "").trim();
  if (!text) {
    return "";
  }
  const spaceIndex = text.indexOf(" ");
  if (spaceIndex === -1) {
    return "";
  }
  return text.slice(spaceIndex + 1).trim();
}

function extractModeArg(ctx) {
  const fromArgs = String(extractCommandArgs(ctx) || "").trim();
  if (fromArgs) {
    return normalizeModeFromText(fromArgs);
  }
  const fromIntent = String(ctx?.state?.intentMode || "").trim();
  if (fromIntent) {
    return normalizeModeFromText(fromIntent);
  }
  return "balanced";
}

function parseSlashCommandText(text) {
  const raw = String(text || "").trim();
  if (!raw.startsWith("/")) {
    return null;
  }
  const head = raw.split(/\s+/, 1)[0];
  const cleaned = head
    .replace(/^\//, "")
    .split("@")[0]
    .trim()
    .toLowerCase();
  if (!cleaned) {
    return null;
  }
  const args = raw.slice(head.length).trim();
  return { key: cleaned, argsText: args };
}

function normalizeIntentText(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/[ı]/g, "i")
    .replace(/[ğ]/g, "g")
    .replace(/[ü]/g, "u")
    .replace(/[ş]/g, "s")
    .replace(/[ö]/g, "o")
    .replace(/[ç]/g, "c")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveTextIntent(input) {
  const intent = resolveIntent(input, COMMAND_INTENT_INDEX);
  if (!intent) {
    return null;
  }
  return {
    commandKey: intent.commandKey,
    mode: intent.mode || "balanced",
    argsText: intent.argsText || ""
  };
}

async function runIntentCommandHandler(ctx, intent, handler) {
  if (typeof handler !== "function") {
    return false;
  }
  if (!ctx.state || typeof ctx.state !== "object") {
    ctx.state = {};
  }
  const hasArgsOverride = Object.prototype.hasOwnProperty.call(ctx.state, "commandArgsText");
  const hasModeOverride = Object.prototype.hasOwnProperty.call(ctx.state, "intentMode");
  const previousArgs = ctx.state.commandArgsText;
  const previousMode = ctx.state.intentMode;
  ctx.state.commandArgsText = String(intent.argsText || "").trim();
  ctx.state.intentMode = String(intent.mode || "balanced");
  try {
    await handler(ctx);
    return true;
  } finally {
    if (hasArgsOverride) {
      ctx.state.commandArgsText = previousArgs;
    } else {
      delete ctx.state.commandArgsText;
    }
    if (hasModeOverride) {
      ctx.state.intentMode = previousMode;
    } else {
      delete ctx.state.intentMode;
    }
  }
}

function buildSyntheticCallbackCtx(ctx, matchArray) {
  return {
    ...ctx,
    match: matchArray,
    answerCbQuery: async () => {}
  };
}

async function completeLatestAttemptFromCommand(ctx, pool, appConfig, modeText) {
  const modeKey = normalizeModeFromText(modeText);
  const payload = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    const latest = await taskStore.getLatestPendingAttempt(db, profile.user_id);
    return { latest };
  });

  if (!payload.latest) {
    await ctx.replyWithMarkdown("*Bitirilecek Gorev Yok*\nAktif bir deneme bulunamadi. Once /tasks ile gorev baslat.");
    return;
  }

  const synthetic = buildSyntheticCallbackCtx(ctx, [null, String(payload.latest.id), modeKey]);
  await handleTaskComplete(synthetic, pool, appConfig);
}

async function revealLatestFromCommand(ctx, pool, appConfig) {
  const payload = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    const latest = await taskStore.getLatestRevealableAttempt(db, profile.user_id);
    return { latest };
  });

  if (!payload.latest) {
    await ctx.replyWithMarkdown("*Reveal Hazir Degil*\nBitmis ama acilmamis bir deneme bulunamadi.");
    return;
  }

  const synthetic = buildSyntheticCallbackCtx(ctx, [null, String(payload.latest.id)]);
  await handleReveal(synthetic, pool, appConfig);
}

async function handleTextIntent(ctx, pool, commandHandlerMap) {
  const text = String(ctx.message?.text || "").trim();
  const intent = resolveTextIntent(text);
  if (!intent) {
    return false;
  }
  const handler = commandHandlerMap.get(String(intent.commandKey || ""));
  if (typeof handler !== "function") {
    return false;
  }
  const profile = await ensureProfile(pool, ctx);
  const locale = resolvePreferredLanguage(profile, ctx, "tr");
  const eventTs = new Date().toISOString();
  await safeLogV5IntentResolution(pool, ctx, {
    userId: Number(profile.user_id || 0),
    inputText: text,
    normalizedText: normalizeIntentText(text),
    matchedKey: String(intent.commandKey || ""),
    resolvedMode: String(intent.mode || "balanced"),
    confidence: 1,
    source: "bot_text_intent",
    locale,
    action: String(intent.commandKey || ""),
    argsText: String(intent.argsText || ""),
    ts: eventTs
  });
  await safeLogV5CommandEvent(pool, ctx, {
    userId: Number(profile.user_id || 0),
    commandKey: String(intent.commandKey || ""),
    handlerKey: String(intent.commandKey || ""),
    source: "bot_text_intent",
    locale,
    text,
    argsText: String(intent.argsText || ""),
    isSlash: false,
    ok: true,
    ts: eventTs
  });
  return runIntentCommandHandler(ctx, intent, handler);
}

async function handleBuyOffer(ctx, pool) {
  const offerId = Number(ctx.match[1]);
  if (!offerId) {
    return;
  }

  const result = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    const freeze = await systemStore.getFreezeState(db);
    if (freeze.freeze) {
      return { success: false, reason: "freeze_mode" };
    }

    const offer = await shopStore.getOfferById(db, offerId);
    if (!offer) {
      return { success: false, reason: "offer_not_found" };
    }

    const starts = offer.start_at ? new Date(offer.start_at).getTime() : 0;
    const ends = offer.end_at ? new Date(offer.end_at).getTime() : Number.MAX_SAFE_INTEGER;
    const nowMs = Date.now();
    if (nowMs < starts || nowMs > ends) {
      return { success: false, reason: "offer_inactive" };
    }

    const price = Number(offer.price || 0);
    const currency = String(offer.currency || "").toUpperCase();
    const debit = await economyStore.debitCurrency(db, {
      userId: profile.user_id,
      currency,
      amount: price,
      reason: `shop_purchase_${offer.id}`,
      refEventId: deterministicUuid(`purchase:${profile.user_id}:${offer.id}`),
      meta: { offerId: offer.id, offerType: offer.offer_type }
    });
    if (!debit.applied) {
      return { success: false, reason: debit.reason || "insufficient_balance" };
    }

    await shopStore.createPurchase(db, { userId: profile.user_id, offerId: offer.id, status: "paid" });

    let effect = null;
    const benefit = offer.benefit_json || {};
    if (benefit.effect_key && benefit.duration_hours) {
      effect = await shopStore.addOrExtendEffect(db, {
        userId: profile.user_id,
        effectKey: benefit.effect_key,
        level: 1,
        durationHours: Number(benefit.duration_hours),
        meta: benefit
      });
    }

    return { success: true, offer, effect, balanceAfter: debit.balance };
  });

  await ctx.answerCbQuery();
  await ctx.replyWithMarkdown(messages.formatPurchaseResult(result));
}

function registerRegistryCommandHandlers(bot, registry, handlerMap) {
  const registered = new Set();
  const missing = [];
  for (const item of registry || []) {
    if (!item || !item.key) {
      continue;
    }
    const handler = handlerMap.get(item.key);
    if (typeof handler !== "function") {
      missing.push(String(item.key));
      continue;
    }
    const names = [String(item.key), ...(Array.isArray(item.aliases) ? item.aliases : [])];
    for (const rawName of names) {
      const name = String(rawName || "")
        .trim()
        .toLowerCase();
      if (!name || name === "start" || registered.has(name)) {
        continue;
      }
      bot.command(name, async (ctx) => {
        await handler(ctx);
      });
      registered.add(name);
    }
  }
  return {
    registeredCount: registered.size,
    missing
  };
}

function registerSimpleActionHandlers(bot, actionMap) {
  const entries = Object.entries(actionMap || {});
  for (const [action, handler] of entries) {
    if (!action || typeof handler !== "function") {
      continue;
    }
    bot.action(action, async (ctx) => {
      await ctx.answerCbQuery();
      await handler(ctx);
    });
  }
}

function cleanupPlayerActionRateState() {
  const now = Date.now();
  for (const [key, ts] of PLAYER_ACTION_RATE_STATE.entries()) {
    if (!ts || now - Number(ts) > 120_000) {
      PLAYER_ACTION_RATE_STATE.delete(key);
    }
  }
}

async function enforcePlayerActionRateLimit(ctx, actionKey, cooldownMs) {
  const cooldown = Math.max(0, Number(cooldownMs || 0));
  if (!cooldown) {
    return true;
  }
  const actorId = Number(ctx.from?.id || 0);
  if (!actorId) {
    return true;
  }
  cleanupPlayerActionRateState();
  const key = `${actorId}:${String(actionKey || "player_action")}`;
  const now = Date.now();
  const previous = Number(PLAYER_ACTION_RATE_STATE.get(key) || 0);
  if (previous > 0 && now - previous < cooldown) {
    const waitSec = Math.max(1, Math.ceil((cooldown - (now - previous)) / 1000));
    logEvent("player_callback_rate_limited", {
      action: String(actionKey || "player_action"),
      user_id: actorId,
      wait_sec: waitSec
    });
    try {
      await ctx.answerCbQuery(`Yavas: ${waitSec}s bekle`, { show_alert: false });
    } catch {}
    return false;
  }
  PLAYER_ACTION_RATE_STATE.set(key, now);
  return true;
}

async function runPlayerCallbackRail(ctx, policy, handler) {
  const resolvedPolicy = policy || {};
  const actionKey = String(resolvedPolicy.actionKey || "player_action");
  const defaultCooldown = Number(PLAYER_ACTION_DEFAULT_COOLDOWNS_MS[actionKey] || 0);
  const cooldownMs = Number.isFinite(Number(resolvedPolicy.cooldownMs))
    ? Number(resolvedPolicy.cooldownMs)
    : defaultCooldown;
  if (!(await enforcePlayerActionRateLimit(ctx, actionKey, cooldownMs))) {
    return false;
  }
  const t0 = Date.now();
  await handler(ctx);
  logEvent("player_callback_processed", {
    action: actionKey,
    user_id: Number(ctx.from?.id || 0),
    latency_ms: Math.max(0, Date.now() - t0)
  });
  return true;
}

function registerPlayerActionHandlers(bot, definitions) {
  for (const def of definitions || []) {
    if (!def || (!def.action && !def.pattern) || typeof def.handler !== "function") {
      continue;
    }
    const actionOrPattern = def.action || def.pattern;
    bot.action(actionOrPattern, async (ctx) => {
      if (def.answerCbQuery === true) {
        await ctx.answerCbQuery();
      }
      await runPlayerCallbackRail(ctx, def.policy || {}, def.handler);
    });
  }
}

async function runAdminCallbackRail(ctx, appConfig, policy, handler) {
  if (!(await ensureAdminCtx(ctx, appConfig))) {
    return false;
  }
  const resolvedPolicy = policy || {};
  const actionKey = String(resolvedPolicy.actionKey || "admin_callback");
  if (resolvedPolicy.critical) {
    const confirmParts =
      typeof resolvedPolicy.confirmParts === "function"
        ? resolvedPolicy.confirmParts(ctx)
        : Array.isArray(resolvedPolicy.confirmParts)
          ? resolvedPolicy.confirmParts
          : [];
    if (
      !(await ensureAdminCriticalReadyFromCallback(
        ctx,
        actionKey,
        confirmParts,
        String(resolvedPolicy.label || actionKey)
      ))
    ) {
      return false;
    }
  }
  if (resolvedPolicy.rateLimited !== false) {
    if (!(await enforceAdminRateLimit(ctx, actionKey))) {
      return false;
    }
  }
  await handler(ctx);
  return true;
}

function registerAdminActionHandlers(bot, appConfig, definitions) {
  for (const def of definitions || []) {
    if (!def || (!def.action && !def.pattern) || typeof def.handler !== "function") {
      continue;
    }
    const actionOrPattern = def.action || def.pattern;
    bot.action(actionOrPattern, async (ctx) => {
      if (def.answerCbQuery !== false) {
        await ctx.answerCbQuery();
      }
      await runAdminCallbackRail(ctx, appConfig, def.policy || {}, def.handler);
    });
  }
}

function buildCommandHandlerMap({ pool, appConfig }) {
  const map = new Map();

  map.set("profile", async (ctx) => sendProfile(ctx, pool, appConfig));
  map.set("rewards", async (ctx) => sendRewards(ctx, pool, appConfig));
  map.set("tasks", async (ctx) => sendTasks(ctx, pool, appConfig));
  map.set("wallet", async (ctx) => sendWallet(ctx, pool, appConfig));
  map.set("token", async (ctx) => sendToken(ctx, pool, appConfig));
  map.set("mint", async (ctx) => {
    const amount = extractCommandArgs(ctx);
    await mintToken(ctx, pool, appConfig, amount);
  });
  map.set("buytoken", async (ctx) => {
    const args = parseTokenBuyArgs(extractCommandArgs(ctx));
    if (!args.usdAmount || !args.chain) {
      const quickPlan = await fetchQuickTokenBuyPlan(pool, appConfig).catch(() => null);
      if (!quickPlan) {
        await ctx.replyWithMarkdown("*Token Satin Alma*\nAktif odeme kanali bulunamadi. Token panelinden durumu kontrol et.");
        return;
      }
      await ctx.replyWithMarkdown(
        `*Token Satin Alma*\nHazir komut: \`/buytoken ${Number(quickPlan.usdAmount).toFixed(2)} ${quickPlan.chain}\``,
        { parse_mode: "Markdown" }
      );
      return;
    }
    await createTokenBuyIntent(ctx, pool, appConfig, args.usdAmount, args.chain);
  });
  map.set("tx", async (ctx) => {
    const parts = String(extractCommandArgs(ctx))
      .split(" ")
      .map((x) => x.trim())
      .filter(Boolean);
    await submitTokenTx(ctx, pool, appConfig, parts[0], parts.slice(1).join(" "));
  });
  map.set("daily", async (ctx) => sendDaily(ctx, pool, appConfig));
  map.set("kingdom", async (ctx) => sendKingdom(ctx, pool));
  map.set("season", async (ctx) => sendSeason(ctx, pool, appConfig));
  map.set("leaderboard", async (ctx) => sendLeaderboard(ctx, pool, appConfig));
  map.set("events", async (ctx) => sendEvents(ctx, pool, appConfig));
  map.set("discover", async (ctx) => sendDiscover(ctx, pool, appConfig));
  map.set("shop", async (ctx) => sendShop(ctx, pool, appConfig));
  map.set("missions", async (ctx) => sendMissions(ctx, pool, appConfig));
  map.set("war", async (ctx) => sendWar(ctx, pool));
  map.set("streak", async (ctx) => {
    const profile = await ensureProfile(pool, ctx);
    await ctx.replyWithMarkdown(messages.formatStreak(profile));
  });
  map.set("vault", async (ctx) => sendPayout(ctx, pool, appConfig));
  map.set("status", async (ctx) => sendStatus(ctx, pool, appConfig));
  map.set("settings", async (ctx) => sendSettings(ctx, pool, appConfig));
  map.set("support", async (ctx) => sendSupport(ctx, pool, appConfig));
  map.set("faq", async (ctx) => sendFaq(ctx, pool, appConfig));
  map.set("nexus", async (ctx) => sendNexus(ctx, pool, appConfig));
  map.set("ops", async (ctx) => sendOps(ctx, pool));
  map.set("pvp", async (ctx) => {
    const mode = extractModeArg(ctx);
    const synthetic = buildSyntheticCallbackCtx(ctx, [null, mode]);
    await handleArenaRaid(synthetic, pool);
  });
  map.set("arena_rank", async (ctx) => sendArenaRank(ctx, pool));
  map.set("play", async (ctx) => sendPlay(ctx, pool, appConfig));
  map.set("finish", async (ctx) => {
    const mode = extractModeArg(ctx);
    await completeLatestAttemptFromCommand(ctx, pool, appConfig, mode);
  });
  map.set("reveal", async (ctx) => revealLatestFromCommand(ctx, pool, appConfig));
  map.set("help", async (ctx) => {
    await sendHelpFromCommand(ctx, pool, appConfig);
  });
  map.set("menu", async (ctx) => sendLauncherMenu(ctx, pool));
  map.set("story", async (ctx) => sendGuide(ctx, pool));
  map.set("onboard", async (ctx) => sendOnboard(ctx, pool, appConfig));
  map.set("ui_mode", async (ctx) => sendUiMode(ctx, pool));
  map.set("perf", async (ctx) => sendPerf(ctx, pool));
  map.set("raid_contract", async (ctx) => sendRaidContract(ctx, pool));
  map.set("whoami", async (ctx) => {
    await ctx.replyWithMarkdown(messages.formatAdminWhoami(ctx.from?.id, appConfig.adminTelegramId));
  });
  map.set("lang", async (ctx) => {
    await setLanguagePreference(ctx, pool, extractCommandArgs(ctx));
  });

  map.set("admin", async (ctx) => sendAdminPanel(ctx, pool, appConfig));
  map.set("admin_live", async (ctx) => sendAdminLive(ctx, pool, appConfig));
  map.set("admin_queue", async (ctx) => sendAdminQueue(ctx, pool, appConfig));
  map.set("admin_payouts", async (ctx) => sendAdminPayoutQueue(ctx, pool, appConfig));
  map.set("admin_tokens", async (ctx) => sendAdminTokenQueue(ctx, pool, appConfig));
  map.set("admin_metrics", async (ctx) => sendAdminMetrics(ctx, pool, appConfig));
  map.set("admin_config", async (ctx) => sendAdminConfig(ctx, pool, appConfig));
  map.set("admin_token_price", async (ctx) => adminSetTokenPrice(ctx, pool, appConfig, extractCommandArgs(ctx)));
  map.set("admin_gate", async (ctx) => {
    const parsed = parseConfirmArgs(extractCommandArgs(ctx));
    const signatureParts = parsed.parts.slice(0, 3);
    const hint = `/admin_gate confirm ${signatureParts.join(" ")}`.trim();
    if (!(await ensureAdminCriticalReady(ctx, "admin_gate", signatureParts, parsed.confirmed, hint))) {
      return;
    }
    if (!(await enforceAdminRateLimit(ctx, "admin_gate"))) {
      return;
    }
    await adminSetTokenGate(ctx, pool, appConfig, parsed.parts[0], parsed.parts[1], parsed.parts[2]);
  });
  map.set("admin_freeze", async (ctx) => {
    if (!(await ensureAdminCtx(ctx, appConfig))) {
      return;
    }
    const parsed = parseConfirmArgs(extractCommandArgs(ctx));
    const parts = parsed.parts;
    if (parts.length === 0) {
      await ctx.replyWithMarkdown("*Admin Freeze*\nKullanim: `/admin_freeze on <sebep>` veya `/admin_freeze off`", {
        parse_mode: "Markdown"
      });
      return;
    }
    const mode = String(parts[0] || "").toLowerCase();
    if (!["on", "off"].includes(mode)) {
      await ctx.replyWithMarkdown("*Admin Freeze*\nMode sadece `on` veya `off` olabilir.", {
        parse_mode: "Markdown"
      });
      return;
    }
    const reason = parts.slice(1).join(" ");
    const hint = `/admin_freeze confirm ${mode}${reason ? ` ${reason}` : ""}`.trim();
    if (!(await ensureAdminCriticalReady(ctx, `admin_freeze_${mode}`, [mode, reason], parsed.confirmed, hint))) {
      return;
    }
    if (!(await enforceAdminRateLimit(ctx, `admin_freeze_${mode}`))) {
      return;
    }
    await adminSetFreeze(ctx, pool, appConfig, mode === "on", reason);
  });
  map.set("pay", async (ctx) => {
    const parsed = parseConfirmArgs(extractCommandArgs(ctx));
    const parts = parsed.parts;
    const hint = `/pay confirm ${parts.join(" ")}`.trim();
    if (!(await ensureAdminCriticalReady(ctx, "pay", parts, parsed.confirmed, hint))) {
      return;
    }
    if (!(await enforceAdminRateLimit(ctx, "pay"))) {
      return;
    }
    await adminMarkPayoutPaid(ctx, pool, appConfig, parts[0], parts.slice(1).join(" "));
  });
  map.set("reject_payout", async (ctx) => {
    const parsed = parseConfirmArgs(extractCommandArgs(ctx));
    const parts = parsed.parts;
    const hint = `/reject_payout confirm ${parts.join(" ")}`.trim();
    if (!(await ensureAdminCriticalReady(ctx, "reject_payout", parts, parsed.confirmed, hint))) {
      return;
    }
    if (!(await enforceAdminRateLimit(ctx, "reject_payout"))) {
      return;
    }
    await adminRejectPayout(ctx, pool, appConfig, parts[0], parts.slice(1).join(" "));
  });
  map.set("approve_token", async (ctx) => {
    const parts = parseWords(extractCommandArgs(ctx));
    await adminApproveToken(ctx, pool, appConfig, parts[0], parts.slice(1).join(" "));
  });
  map.set("reject_token", async (ctx) => {
    const parts = parseWords(extractCommandArgs(ctx));
    await adminRejectToken(ctx, pool, appConfig, parts[0], parts.slice(1).join(" "));
  });

  return map;
}

async function start() {
  const appConfig = loadConfig();
  const pool = createPool({ databaseUrl: appConfig.databaseUrl, ssl: appConfig.databaseSsl });
  const runtimeIdentity = {
    stateKey: appConfig.runtimeStateKey,
    serviceName: "airdropkral-bot",
    lockKey: appConfig.botInstanceLockKey,
    instanceRef: appConfig.instanceRef,
    pid: process.pid,
    hostname: os.hostname(),
    serviceEnv: appConfig.nodeEnv,
    updatedBy: Number(appConfig.adminTelegramId || 0)
  };
  let heartbeatTimer = null;

  await ping(pool);
  console.log("Database connection OK");
  logEvent("boot", { loop_v2_enabled: appConfig.loopV2Enabled });

  if (!appConfig.botEnabled) {
    console.log("BOT_ENABLED=0, bot process disabled.");
    await upsertBotRuntimeState(pool, {
      ...runtimeIdentity,
      mode: "disabled",
      alive: false,
      lockAcquired: false,
      stoppedAt: new Date(),
      lastError: "",
      stateJson: {
        phase: "disabled",
        reason: "BOT_ENABLED=0"
      }
    });
    await appendBotRuntimeEvent(pool, {
      stateKey: runtimeIdentity.stateKey,
      eventType: "startup_disabled",
      eventJson: {
        reason: "BOT_ENABLED=0"
      }
    });
    await pool.end();
    return;
  }

  if (appConfig.dryRun) {
    console.log("BOT_DRY_RUN=1, Telegram baglantisi atlandi.");
    await upsertBotRuntimeState(pool, {
      ...runtimeIdentity,
      mode: "disabled",
      alive: false,
      lockAcquired: false,
      stoppedAt: new Date(),
      lastError: "",
      stateJson: {
        phase: "dry_run",
        reason: "BOT_DRY_RUN=1"
      }
    });
    await appendBotRuntimeEvent(pool, {
      stateKey: runtimeIdentity.stateKey,
      eventType: "startup_dry_run",
      eventJson: {
        reason: "BOT_DRY_RUN=1"
      }
    });
    await pool.end();
    return;
  }

  const lease = await tryAcquireBotRuntimeLease(pool, {
    ...runtimeIdentity,
    startedAt: new Date(),
    lastHeartbeatAt: new Date(),
    lastError: "",
    stateJson: {
      phase: "lock_acquired",
      lock_key: appConfig.botInstanceLockKey
    },
    staleAfterSec: botRuntimeStore.DEFAULT_LEASE_STALE_AFTER_SEC
  });
  if (!lease.acquired) {
    const holder = lease.state || {};
    console.error(
      "Bot startup skipped: another instance likely running (instance lock not acquired). " +
        "Ayni BOT_TOKEN ile birden fazla polling instance calistirma."
    );
    await appendBotRuntimeEvent(pool, {
      stateKey: runtimeIdentity.stateKey,
      eventType: "lock_not_acquired",
      eventJson: {
        reason: lease.reason || "lock_not_acquired",
        lock_key: appConfig.botInstanceLockKey,
        holder_instance_ref: String(holder.instance_ref || ""),
        holder_pid: Number(holder.pid || 0),
        holder_hostname: String(holder.hostname || "")
      }
    });
    await pool.end();
    return;
  }

  await appendBotRuntimeEvent(pool, {
    stateKey: runtimeIdentity.stateKey,
    eventType: "startup_begin",
    eventJson: {
      node_env: appConfig.nodeEnv,
      lock_key: appConfig.botInstanceLockKey,
      bot_enabled: appConfig.botEnabled,
      dry_run: appConfig.dryRun
    }
  });
  await appendBotRuntimeEvent(pool, {
    stateKey: runtimeIdentity.stateKey,
    eventType: "lock_acquired",
    eventJson: {
      lock_key: appConfig.botInstanceLockKey
    }
  });

  const bot = new Telegraf(appConfig.botToken);
  bot.use(createSafeMarkdownReplyMiddleware({ logEvent }));
  bot.use(
    createSlashCommandTelemetryMiddleware({
      parseSlashCommandText,
      commandAliasLookup: COMMAND_ALIAS_LOOKUP,
      ensureProfile: (ctx) => ensureProfile(pool, ctx),
      resolvePreferredLanguage,
      logV5CommandEvent: (ctx, payload) => safeLogV5CommandEvent(pool, ctx, payload),
      logEvent
    })
  );

  bot.start(async (ctx) => {
    await sendLauncherMenu(ctx, pool);
  });

  const commandHandlerMap = buildCommandHandlerMap({ pool, appConfig });
  const simpleBotActionHandlers = buildSimpleBotActionHandlers({ pool, appConfig });
  const simpleWebAppActionHandlers = buildSimpleWebAppActionMap(simpleBotActionHandlers);
  const registration = registerRegistryCommandHandlers(bot, COMMAND_REGISTRY, commandHandlerMap);
  if (registration.missing.length > 0) {
    console.warn("command handler missing for registry keys:", registration.missing.join(","));
  }

  bot.on("message", async (ctx, next) => {
    if (ctx.message?.web_app_data?.data) {
      await handleWebAppAction(ctx, pool, appConfig, simpleWebAppActionHandlers);
      return;
    }
    if (typeof ctx.message?.text === "string") {
      const incomingText = String(ctx.message.text || "").trim();
      const slash = parseSlashCommandText(incomingText);
      const handled = await handleTextIntent(ctx, pool, commandHandlerMap);
      if (handled) {
        return;
      }
      const slashKnown = slash ? COMMAND_ALIAS_LOOKUP.has(slash.key) : false;
      const isPrivateChat = String(ctx.chat?.type || "private") === "private";
      if (incomingText && !slashKnown && isPrivateChat) {
        await sendUnknownIntentHint(ctx, pool);
        return;
      }
    }
    if (typeof next === "function") {
      await next();
    }
  });

  registerSimpleActionHandlers(bot, buildSimpleCallbackActionMap(simpleBotActionHandlers));

  registerPlayerActionHandlers(bot, [
    {
      pattern: /ARENA_RAID:([a-z_]+)/,
      policy: { actionKey: "arena_raid" },
      handler: async (ctx) => handleArenaRaid(ctx, pool)
    },
    {
      pattern: /TASK_ACCEPT:(\d+)/,
      policy: { actionKey: "task_accept" },
      handler: async (ctx) => handleTaskAccept(ctx, pool, appConfig)
    },
    {
      pattern: /TASK_COMPLETE:(\d+)(?::([a-z_]+))?/,
      policy: { actionKey: "task_complete" },
      handler: async (ctx) => handleTaskComplete(ctx, pool, appConfig)
    },
    {
      pattern: /REVEAL:(\d+)/,
      policy: { actionKey: "reveal" },
      handler: async (ctx) => handleReveal(ctx, pool, appConfig)
    },
    {
      pattern: /BUY_OFFER:(\d+)/,
      policy: { actionKey: "buy_offer" },
      handler: async (ctx) => handleBuyOffer(ctx, pool)
    },
    {
      pattern: /CLAIM_MISSION:([a-z0-9_]+)/,
      policy: { actionKey: "claim_mission" },
      handler: async (ctx) => handleClaimMission(ctx, pool)
    },
    {
      action: "REROLL_TASKS",
      policy: { actionKey: "reroll_tasks" },
      handler: async (ctx) => handleRerollTasks(ctx, pool, appConfig)
    },
    {
      pattern: /REQ_PAYOUT:([A-Z]+)/,
      policy: { actionKey: "payout_request" },
      handler: async (ctx) => handlePayoutRequest(ctx, pool, appConfig)
    },
    {
      pattern: /HELP_SECTION:([a-z_]+):(\d+)/,
      policy: { actionKey: "help_nav", cooldownMs: 700 },
      answerCbQuery: true,
      handler: async (ctx) => {
        const category = String(ctx.match?.[1] || "core_loop");
        const page = normalizeHelpPage(ctx.match?.[2] || 1, 1);
        await sendHelpIndex(ctx, pool, appConfig, {
          source: "callback",
          query: category,
          category,
          page
        });
      }
    },
    {
      pattern: /HELP_CARD:([a-z0-9_]+)/,
      policy: { actionKey: "help_nav", cooldownMs: 700 },
      answerCbQuery: true,
      handler: async (ctx) => {
        const key = String(ctx.match?.[1] || "").trim().toLowerCase();
        const card = HELP_CARD_MAP.get(key);
        await sendHelpCommandCard(ctx, pool, appConfig, {
          source: "callback",
          query: key,
          key,
          backCategory: card?.category || "core_loop",
          backPage: 1
        });
      }
    },
    {
      pattern: /HELP_BACK:([a-z_]+):(\d+)/,
      policy: { actionKey: "help_nav", cooldownMs: 700 },
      answerCbQuery: true,
      handler: async (ctx) => {
        const category = String(ctx.match?.[1] || "core_loop");
        const page = normalizeHelpPage(ctx.match?.[2] || 1, 1);
        await sendHelpIndex(ctx, pool, appConfig, {
          source: "callback",
          query: category,
          category,
          page
        });
      }
    }
  ]);

  registerAdminActionHandlers(bot, appConfig, [
    {
      action: "ADMIN_FREEZE_ON",
      policy: {
        actionKey: "admin_freeze_on",
        critical: true,
        confirmParts: ["on", "admin_panel"],
        label: "Freeze On"
      },
      handler: async (ctx) => {
        await adminSetFreeze(ctx, pool, appConfig, true, "admin_panel");
        await sendAdminPanel(ctx, pool, appConfig);
      }
    },
    {
      action: "ADMIN_FREEZE_OFF",
      policy: {
        actionKey: "admin_freeze_off",
        critical: true,
        confirmParts: ["off", ""],
        label: "Freeze Off"
      },
      handler: async (ctx) => {
        await adminSetFreeze(ctx, pool, appConfig, false, "");
        await sendAdminPanel(ctx, pool, appConfig);
      }
    },
    {
      pattern: /ADMIN_PAYOUT_PICK:(\d+)/,
      policy: {
        actionKey: "admin_payout_pick",
        rateLimited: false
      },
      handler: async (ctx) => {
        const requestId = Number(ctx.match?.[1] || 0);
        const row = await withTransaction(pool, async (db) => payoutStore.getRequestWithTx(db, requestId));
        if (!row) {
          await ctx.replyWithMarkdown(messages.formatAdminActionResult("Payout", "Talep bulunamadi."));
          return;
        }
        await ctx.replyWithMarkdown(
          `*Payout Talebi #${row.id}*\n` +
            `User: *${row.user_id}*\n` +
            `Durum: *${row.status}*\n` +
            `Miktar: *${Number(row.amount || 0).toFixed(8)} BTC*\n` +
            `Kaynak HC: *${Number(row.source_hc_amount || 0).toFixed(4)}*\n` +
            `Onay icin: \`/pay ${row.id} <txHash>\`\n` +
            `Hizli red: asagidaki *Payout Reddet* butonu (2 adim onayli)`,
          buildAdminPayoutActionKeyboard(row.id)
        );
      }
    },
    {
      pattern: /ADMIN_TOKEN_PICK:(\d+)/,
      policy: {
        actionKey: "admin_token_pick",
        rateLimited: false
      },
      handler: async (ctx) => {
        const requestId = Number(ctx.match?.[1] || 0);
        const row = await withTransaction(pool, async (db) => tokenStore.getPurchaseRequest(db, requestId));
        if (!row) {
          await ctx.replyWithMarkdown(messages.formatAdminActionResult("Token", "Talep bulunamadi."));
          return;
        }
        await ctx.replyWithMarkdown(
          `*Token Talebi #${row.id}*\n` +
            `User: *${row.user_id}*\n` +
            `Durum: *${String(row.status || "").toUpperCase()}*\n` +
            `Odeme: *${Number(row.usd_amount || 0).toFixed(2)} USD* (${row.chain})\n` +
            `Token: *${Number(row.token_amount || 0).toFixed(4)} ${row.token_symbol}*\n` +
            `TX: ${row.tx_hash ? `\`${String(row.tx_hash)}\`` : "yok"}\n` +
            `Onay: ${row.tx_hash ? "*Butondan hizli onay* veya" : "TX yoksa once"} \`/approve_token ${row.id}\`\n` +
            `Red: \`/reject_token ${row.id} <sebep>\` veya butondan hizli red`,
          buildAdminTokenActionKeyboard(row)
        );
      }
    },
    {
      pattern: /ADMIN_PAYOUT_REJECT:(\d+)/,
      policy: {
        actionKey: "admin_payout_reject_callback",
        critical: true,
        confirmParts: (ctx) => [String(ctx.match?.[1] || "")],
        label: "Payout Reject"
      },
      handler: async (ctx) => {
        const requestId = Number(ctx.match?.[1] || 0);
        await adminRejectPayout(ctx, pool, appConfig, requestId, "rejected_via_callback");
        await sendAdminQueue(ctx, pool, appConfig);
      }
    },
    {
      pattern: /ADMIN_TOKEN_APPROVE:(\d+)/,
      policy: {
        actionKey: "admin_token_approve_callback",
        critical: true,
        confirmParts: (ctx) => [String(ctx.match?.[1] || "")],
        label: "Token Approve"
      },
      handler: async (ctx) => {
        const requestId = Number(ctx.match?.[1] || 0);
        await adminApproveToken(ctx, pool, appConfig, requestId, "approved_via_callback");
        await sendAdminQueue(ctx, pool, appConfig);
      }
    },
    {
      pattern: /ADMIN_TOKEN_REJECT:(\d+)/,
      policy: {
        actionKey: "admin_token_reject_callback",
        critical: true,
        confirmParts: (ctx) => [String(ctx.match?.[1] || "")],
        label: "Token Reject"
      },
      handler: async (ctx) => {
        const requestId = Number(ctx.match?.[1] || 0);
        await adminRejectToken(ctx, pool, appConfig, requestId, "rejected_via_callback");
        await sendAdminQueue(ctx, pool, appConfig);
      }
    }
  ]);

  bot.catch((err) => {
    console.error("Bot error", err);
    appendBotRuntimeEvent(pool, {
      stateKey: runtimeIdentity.stateKey,
      eventType: "polling_error",
      eventJson: {
        error: String(err?.message || err)
      }
    }).catch(() => {});
    renewBotRuntimeLease(pool, {
      ...runtimeIdentity,
      lastHeartbeatAt: new Date(),
      lastError: String(err?.message || "polling_error"),
      stateJson: {
        phase: "polling_error"
      }
    }).catch(() => {});
  });

  const commandLocales = [
    { lang: "tr", scope: undefined },
    { lang: "tr", scope: { language_code: "tr" } },
    { lang: "en", scope: { language_code: "en" } }
  ];
  for (const item of commandLocales) {
    try {
      if (item.scope) {
        await bot.telegram.setMyCommands(toTelegramCommands(COMMAND_REGISTRY, item.lang), item.scope);
      } else {
        await bot.telegram.setMyCommands(toTelegramCommands(COMMAND_REGISTRY, item.lang));
      }
    } catch (err) {
      console.warn(`setMyCommands failed (${item.lang}${item.scope ? ":scoped" : ":default"})`, err?.message || err);
    }
  }

  async function verifyTelegramCommandPublication(locales = []) {
    for (const item of locales) {
      const expected = toTelegramCommands(COMMAND_REGISTRY, item.lang).map((row) => String(row.command || ""));
      try {
        const listed = item.scope ? await bot.telegram.getMyCommands(item.scope) : await bot.telegram.getMyCommands();
        const actual = Array.isArray(listed) ? listed.map((row) => String(row.command || "")) : [];
        const missing = expected.filter((key) => !actual.includes(key));
        if (missing.length > 0) {
          logEvent("setMyCommands_verify_mismatch", {
            lang: item.lang,
            scoped: Boolean(item.scope),
            expected_count: expected.length,
            actual_count: actual.length,
            missing_keys: missing.slice(0, 12)
          });
          console.warn(
            `setMyCommands verify mismatch (${item.lang}${item.scope ? ":scoped" : ":default"})`,
            `missing=${missing.join(",")}`
          );
          continue;
        }
        logEvent("setMyCommands_verify_ok", {
          lang: item.lang,
          scoped: Boolean(item.scope),
          command_count: actual.length
        });
      } catch (err) {
        logEvent("setMyCommands_verify_failed", {
          lang: item.lang,
          scoped: Boolean(item.scope),
          error: String(err?.message || err)
        });
        console.warn(`setMyCommands verify failed (${item.lang}${item.scope ? ":scoped" : ":default"})`, err?.message || err);
      }
    }
  }

  await verifyTelegramCommandPublication(commandLocales);

  bot.launch();
  console.log("Bot running...");
  let shuttingDown = false;
  let heartbeatInFlight = false;
  await appendBotRuntimeEvent(pool, {
    stateKey: runtimeIdentity.stateKey,
    eventType: "polling_start",
    eventJson: {
      lock_key: appConfig.botInstanceLockKey
    }
  });
  const activatedLease = await renewBotRuntimeLease(pool, {
    ...runtimeIdentity,
    lastHeartbeatAt: new Date(),
    lastError: "",
    stateJson: {
      phase: "polling_active"
    }
  });
  if (!activatedLease) {
    throw new Error("runtime_lease_lost_after_launch");
  }

  async function shutdown(signal) {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    try {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    } catch {}
    await appendBotRuntimeEvent(pool, {
      stateKey: runtimeIdentity.stateKey,
      eventType: "shutdown_begin",
      eventJson: {
        signal: String(signal || "")
      }
    }).catch(() => {});
    try {
      bot.stop(signal);
    } catch {}
    await releaseBotRuntimeLease(pool, {
      ...runtimeIdentity,
      stoppedAt: new Date(),
      lastHeartbeatAt: new Date(),
      lastError: "",
      stateJson: {
        phase: "stopped",
        signal: String(signal || "")
      }
    }).catch(() => {});
    await appendBotRuntimeEvent(pool, {
      stateKey: runtimeIdentity.stateKey,
      eventType: "shutdown_complete",
      eventJson: {
        signal: String(signal || "")
      }
    }).catch(() => {});
    try {
      await pool.end();
    } catch {}
  }

  heartbeatTimer = setInterval(() => {
    if (heartbeatInFlight || shuttingDown) {
      return;
    }
    heartbeatInFlight = true;
    renewBotRuntimeLease(pool, {
      ...runtimeIdentity,
      lastHeartbeatAt: new Date(),
      lastError: "",
      stateJson: {
        phase: "heartbeat"
      }
    })
      .then(async (leaseState) => {
        if (leaseState) {
          return;
        }
        logEvent("bot_runtime_lease_lost", {
          state_key: runtimeIdentity.stateKey,
          instance_ref: runtimeIdentity.instanceRef
        });
        await appendBotRuntimeEvent(pool, {
          stateKey: runtimeIdentity.stateKey,
          eventType: "lease_lost",
          eventJson: {
            state_key: runtimeIdentity.stateKey,
            instance_ref: runtimeIdentity.instanceRef
          }
        }).catch(() => {});
        await shutdown("LEASE_LOST").catch(() => {});
      })
      .finally(() => {
        heartbeatInFlight = false;
      });
  }, 10000);
  heartbeatTimer.unref?.();

  process.once("SIGINT", () => {
    shutdown("SIGINT").catch(() => {});
  });
  process.once("SIGTERM", () => {
    shutdown("SIGTERM").catch(() => {});
  });
}

start().catch((err) => {
  const errorCode = Number(err?.response?.error_code || 0);
  const description = String(err?.response?.description || "");
  if (errorCode === 409 && description.toLowerCase().includes("getupdates")) {
    captureStartupFailure(err, {
      phase: "startup_conflict",
      error_code: 409,
      reason: "telegram_getupdates_conflict"
    }).catch(() => {});
    console.error(
      "Startup failed: Telegram 409 conflict. Ayni BOT_TOKEN ile birden fazla bot instance calisiyor. Digerini kapatip yeniden baslatin."
    );
    process.exit(1);
    return;
  }
  captureStartupFailure(err, {
    phase: "startup_error",
    error_code: errorCode || 0
  }).catch(() => {});
  console.error("Startup failed", err);
  process.exit(1);
});


