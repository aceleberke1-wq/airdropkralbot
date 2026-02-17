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
const WEBAPP_DIR = path.join(__dirname, "../../webapp");
const WEBAPP_DIST_DIR = path.join(WEBAPP_DIR, "dist");
const WEBAPP_ASSETS_DIR = path.join(WEBAPP_DIR, "assets");
const FLAG_DEFAULTS = Object.freeze({
  ARENA_AUTH_ENABLED: process.env.ARENA_AUTH_ENABLED === "1",
  RAID_AUTH_ENABLED: process.env.RAID_AUTH_ENABLED === "1",
  TOKEN_CURVE_ENABLED: process.env.TOKEN_CURVE_ENABLED === "1",
  TOKEN_AUTO_APPROVE_ENABLED: process.env.TOKEN_AUTO_APPROVE_ENABLED === "1",
  WEBAPP_V3_ENABLED: process.env.WEBAPP_V3_ENABLED === "1",
  WEBAPP_TS_BUNDLE_ENABLED: process.env.WEBAPP_TS_BUNDLE_ENABLED === "1"
});
const CRITICAL_ENV_LOCKED_FLAGS = new Set([
  "ARENA_AUTH_ENABLED",
  "RAID_AUTH_ENABLED",
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

const ORACLE_CACHE = {
  ts: 0,
  payload: null
};

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

async function getReliableCoreApiQuote(db, { force = false } = {}) {
  const now = Date.now();
  if (!force && ORACLE_CACHE.payload && now - ORACLE_CACHE.ts < 45000) {
    return ORACLE_CACHE.payload;
  }

  const endpoint = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd";
  const started = Date.now();
  let payload = {
    provider: "coingecko",
    endpoint,
    ok: false,
    statusCode: 0,
    latencyMs: 0,
    priceUsd: 0,
    errorCode: "",
    errorMessage: "",
    sourceTs: null
  };
  try {
    const res = await fetchWithTimeout(endpoint, 3500);
    payload.statusCode = Number(res.status || 0);
    payload.latencyMs = Date.now() - started;
    const body = await res.json().catch(() => ({}));
    const price = Number(body?.bitcoin?.usd || 0);
    payload.priceUsd = Number.isFinite(price) ? price : 0;
    payload.ok = res.ok && payload.priceUsd > 0;
    if (!payload.ok && !payload.errorCode) {
      payload.errorCode = "upstream_invalid_payload";
    }
  } catch (err) {
    payload.latencyMs = Date.now() - started;
    payload.errorCode = err?.name === "AbortError" ? "timeout" : "network_error";
    payload.errorMessage = String(err?.message || "oracle_fetch_failed");
  }

  if (payload.ok) {
    payload.sourceTs = new Date().toISOString();
  }

  try {
    await webappStore.insertExternalApiHealth(db, {
      provider: payload.provider,
      endpoint: payload.endpoint,
      checkName: "token_quote",
      ok: payload.ok,
      statusCode: payload.statusCode,
      latencyMs: payload.latencyMs,
      errorCode: payload.errorCode,
      errorMessage: payload.errorMessage,
      healthJson: {
        price_usd: payload.priceUsd
      }
    });
    if (payload.ok) {
      await webappStore.insertPriceOracleSnapshot(db, {
        provider: payload.provider,
        symbol: "BTC",
        priceUsd: payload.priceUsd,
        confidence: payload.statusCode === 200 ? 0.95 : 0.6,
        sourceTs: payload.sourceTs,
        snapshotJson: {
          endpoint: payload.endpoint
        }
      });
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
    const filePath = path.join(variant.assetsDir, rawPath);
    if (!filePath.startsWith(variant.assetsDir) || !fs.existsSync(filePath)) {
      reply.code(404).type("text/plain").send("asset_not_found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType =
      ext === ".glb"
        ? "model/gltf-binary"
        : ext === ".gltf"
          ? "model/gltf+json; charset=utf-8"
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
    const arenaRuns = arenaReady ? await arenaStore.getRecentRuns(client, profile.user_id, 5) : [];
    const arenaLeaders = arenaReady ? await arenaStore.getLeaderboard(client, season.seasonId, 5) : [];
    const director = arenaReady
      ? await arenaService.buildDirectorView(client, { profile, config: runtimeConfig }).catch(() => null)
      : null;
    const token = await buildTokenSummary(client, profile, runtimeConfig, balances);
    const uiPrefs = await webappStore.getUserUiPrefs(client, profile.user_id).catch((err) => {
      if (err.code === "42P01") return null;
      throw err;
    });
    const perfProfile = await webappStore.getLatestPerfProfile(client, profile.user_id).catch((err) => {
      if (err.code === "42P01") return null;
      throw err;
    });
    const featureFlags = await loadFeatureFlags(client, { withMeta: true });
    const isAdmin = isAdminTelegramId(auth.uid);
    const adminSummary = isAdmin ? await buildAdminSummary(client, runtimeConfig) : null;
    const webappVersionState = await resolveWebAppVersion(client);
    const webappLaunchUrl = buildVersionedWebAppUrl(WEBAPP_PUBLIC_URL, webappVersionState.version);

    const missionReady = missions.filter((m) => m.completed && !m.claimed).length;
    const missionOpen = missions.filter((m) => !m.claimed).length;

    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      webapp_version: webappVersionState.version,
      webapp_launch_url: webappLaunchUrl,
      data: {
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
        director,
        feature_flags: featureFlags.flags,
        feature_flag_runtime: {
          source_mode: featureFlags.source_mode,
          source_json: featureFlags.source_json || {},
          env_forced: Boolean(featureFlags.env_forced)
        },
        webapp_version: webappVersionState.version,
        webapp_launch_url: webappLaunchUrl,
        webapp_version_source: webappVersionState.source,
        perf_profile: perfProfile,
        ui_prefs:
          uiPrefs || {
            ui_mode: "hardcore",
            quality_mode: "auto",
            reduced_motion: false,
            large_text: false,
            sound_enabled: true
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
    const oracleProbe = await getReliableCoreApiQuote(client).catch((err) => {
      if (err.code === "42P01") {
        return {
          provider: "coingecko",
          ok: false,
          statusCode: 0,
          latencyMs: 0,
          priceUsd: 0,
          errorCode: "oracle_tables_missing",
          errorMessage: "oracle tables missing"
        };
      }
      throw err;
    });
    const guardrail = await tokenStore.getTreasuryGuardrail(client, tokenConfig.symbol).catch((err) => {
      if (err.code === "42P01") return null;
      throw err;
    });
    const priceUsd = curveEnabled ? Number(curveQuote.priceUsd || 0) : Number(tokenConfig.usd_price || 0);
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
          external_api: oracleProbe
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
    const payoutQueue = await payoutStore.listRequests(client, { status: "requested", limit: 50 }).catch((err) => {
      if (err.code === "42P01") return [];
      throw err;
    });
    const manualTokenQueue = await tokenStore.listManualReviewQueue(client, 50).catch((err) => {
      if (err.code === "42P01") return [];
      throw err;
    });
    const autoDecisions = await tokenStore.listTokenAutoDecisions(client, { limit: 50 }).catch((err) => {
      if (err.code === "42P01") return [];
      throw err;
    });
    const raidQueue = await client
      .query(
        `SELECT id, session_ref, user_id, status, mode_suggested, action_count, score, started_at, expires_at
         FROM raid_sessions
         WHERE status = 'active'
         ORDER BY started_at DESC
         LIMIT 50;`
      )
      .then((res) => res.rows)
      .catch((err) => {
        if (err.code === "42P01") return [];
        throw err;
      });
    const apiHealth = await webappStore.getLatestExternalApiHealth(client, "coingecko", 20).catch((err) => {
      if (err.code === "42P01") return [];
      throw err;
    });
    const latestRelease = await readLatestReleaseMarker(client).catch((err) => {
      if (err.code === "42P01") return null;
      throw err;
    });
    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data: {
        payout_queue: payoutQueue,
        token_manual_queue: manualTokenQueue,
        token_auto_decisions: autoDecisions,
        raid_active_sessions: raidQueue,
        external_api_health: apiHealth,
        release_latest: latestRelease
      }
    });
  } finally {
    client.release();
  }
});

fastify.post(
  "/webapp/api/admin/freeze",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig", "freeze"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          freeze: { type: "boolean" },
          reason: { type: "string", maxLength: 240 }
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

      const freeze = Boolean(request.body.freeze);
      const reason = String(request.body.reason || "").trim();
      const stateJson = {
        freeze,
        reason,
        updated_by: Number(auth.uid),
        updated_at: new Date().toISOString()
      };

      await client.query(
        `INSERT INTO system_state (state_key, state_json, updated_by)
         VALUES ('freeze', $1::jsonb, $2)
         ON CONFLICT (state_key)
         DO UPDATE SET state_json = EXCLUDED.state_json,
                       updated_at = now(),
                       updated_by = EXCLUDED.updated_by;`,
        [JSON.stringify(stateJson), Number(auth.uid)]
      );
      await client.query(
        `INSERT INTO admin_audit (admin_id, action, target, payload_json)
         VALUES ($1, 'system_freeze_toggle', 'system_state:freeze', $2::jsonb);`,
        [Number(auth.uid), JSON.stringify(stateJson)]
      );

      const runtimeConfig = await configService.getEconomyConfig(client);
      const summary = await buildAdminSummary(client, runtimeConfig);
      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: summary
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
  "/webapp/api/admin/token/config",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          usd_price: { type: "number", minimum: 0.00000001, maximum: 10 },
          min_market_cap_usd: { type: "number", minimum: 1 },
          target_band_max_usd: { type: "number", minimum: 1 }
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

      const patch = {};
      if (Number.isFinite(Number(request.body.usd_price))) {
        patch.usd_price = Number(request.body.usd_price);
      }
      if (Number.isFinite(Number(request.body.min_market_cap_usd))) {
        patch.min_market_cap_usd = Number(request.body.min_market_cap_usd);
      }
      if (Number.isFinite(Number(request.body.target_band_max_usd))) {
        patch.target_band_max_usd = Number(request.body.target_band_max_usd);
      }
      if (Object.keys(patch).length === 0) {
        await client.query("ROLLBACK");
        reply.code(400).send({ success: false, error: "no_patch_fields" });
        return;
      }
      if (
        patch.min_market_cap_usd &&
        patch.target_band_max_usd &&
        patch.target_band_max_usd < patch.min_market_cap_usd
      ) {
        await client.query("ROLLBACK");
        reply.code(400).send({ success: false, error: "invalid_gate_band" });
        return;
      }

      await patchTokenRuntimeConfig(client, auth.uid, patch);
      const runtimeConfig = await configService.getEconomyConfig(client, { forceRefresh: true });
      const summary = await buildAdminSummary(client, runtimeConfig);
      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: summary
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
  "/webapp/api/admin/token/auto_policy",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          enabled: { type: "boolean" },
          auto_usd_limit: { type: "number", minimum: 0.5 },
          risk_threshold: { type: "number", minimum: 0, maximum: 1 },
          velocity_per_hour: { type: "integer", minimum: 1, maximum: 1000 },
          require_onchain_verified: { type: "boolean" }
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

      const runtimeConfig = await configService.getEconomyConfig(client, { forceRefresh: true });
      const tokenConfig = tokenEngine.normalizeTokenConfig(runtimeConfig);
      const currentMarketState = await tokenStore.getTokenMarketState(client, tokenConfig.symbol).catch((err) => {
        if (err.code === "42P01") return null;
        throw err;
      });
      const normalized = tokenEngine.normalizeCurveState(tokenConfig, currentMarketState);
      const previousPolicyJson = {
        enabled: Boolean(normalized.autoPolicy?.enabled),
        auto_usd_limit: Number(normalized.autoPolicy?.autoUsdLimit || 10),
        risk_threshold: Number(normalized.autoPolicy?.riskThreshold || 0.35),
        velocity_per_hour: Number(normalized.autoPolicy?.velocityPerHour || 8),
        require_onchain_verified: Boolean(normalized.autoPolicy?.requireOnchainVerified)
      };
      const nextPolicy = {
        ...normalized.autoPolicy
      };
      if (typeof request.body.enabled === "boolean") {
        nextPolicy.enabled = Boolean(request.body.enabled);
      }
      if (Number.isFinite(Number(request.body.auto_usd_limit))) {
        nextPolicy.autoUsdLimit = Math.max(0.5, Number(request.body.auto_usd_limit));
      }
      if (Number.isFinite(Number(request.body.risk_threshold))) {
        nextPolicy.riskThreshold = Math.max(0, Math.min(1, Number(request.body.risk_threshold)));
      }
      if (Number.isFinite(Number(request.body.velocity_per_hour))) {
        nextPolicy.velocityPerHour = Math.max(1, Math.floor(Number(request.body.velocity_per_hour)));
      }
      if (typeof request.body.require_onchain_verified === "boolean") {
        nextPolicy.requireOnchainVerified = Boolean(request.body.require_onchain_verified);
      }

      await tokenStore.upsertTokenMarketState(client, {
        tokenSymbol: tokenConfig.symbol,
        adminFloorUsd: normalized.adminFloorUsd,
        curveBaseUsd: normalized.curveBaseUsd,
        curveK: normalized.curveK,
        supplyNormDivisor: normalized.supplyNormDivisor,
        demandFactor: normalized.demandFactor,
        volatilityDampen: normalized.volatilityDampen,
        autoPolicy: {
          enabled: Boolean(nextPolicy.enabled),
          auto_usd_limit: Number(nextPolicy.autoUsdLimit || 10),
          risk_threshold: Number(nextPolicy.riskThreshold || 0.35),
          velocity_per_hour: Number(nextPolicy.velocityPerHour || 8),
          require_onchain_verified: Boolean(nextPolicy.requireOnchainVerified)
        },
        updatedBy: Number(auth.uid)
      });
      await tokenStore
        .insertTreasuryPolicyHistory(client, {
          tokenSymbol: tokenConfig.symbol,
          source: "webapp_admin_auto_policy",
          actorId: Number(auth.uid),
          previousPolicyJson,
          nextPolicyJson: {
            enabled: Boolean(nextPolicy.enabled),
            auto_usd_limit: Number(nextPolicy.autoUsdLimit || 10),
            risk_threshold: Number(nextPolicy.riskThreshold || 0.35),
            velocity_per_hour: Number(nextPolicy.velocityPerHour || 8),
            require_onchain_verified: Boolean(nextPolicy.requireOnchainVerified)
          },
          reason: "webapp_auto_policy_update"
        })
        .catch((err) => {
          if (err.code !== "42P01") {
            throw err;
          }
        });
      await tokenStore
        .upsertTreasuryGuardrail(client, {
          tokenSymbol: tokenConfig.symbol,
          minMarketCapUsd: Number(tokenConfig.payout_gate?.min_market_cap_usd || 0),
          targetMarketCapMaxUsd: Number(tokenConfig.payout_gate?.target_band_max_usd || 0),
          autoUsdLimit: Number(nextPolicy.autoUsdLimit || 10),
          riskThreshold: Number(nextPolicy.riskThreshold || 0.35),
          velocityPerHour: Number(nextPolicy.velocityPerHour || 8),
          requireOnchainVerified: Boolean(nextPolicy.requireOnchainVerified),
          guardrailJson: {
            source: "webapp_api_admin_token_auto_policy"
          },
          updatedBy: Number(auth.uid)
        })
        .catch((err) => {
          if (err.code !== "42P01") {
            throw err;
          }
        });

      if (typeof request.body.enabled === "boolean") {
        await upsertFeatureFlag(client, {
          flagKey: "TOKEN_AUTO_APPROVE_ENABLED",
          enabled: Boolean(request.body.enabled),
          updatedBy: Number(auth.uid),
          note: "updated via /webapp/api/admin/token/auto_policy"
        }).catch((err) => {
          if (err.code !== "42P01") throw err;
        });
      }

      await client.query(
        `INSERT INTO admin_audit (admin_id, action, target, payload_json)
         VALUES ($1, 'webapp_token_auto_policy_update', 'token_market_state', $2::jsonb);`,
        [
          Number(auth.uid),
          JSON.stringify({
            token_symbol: tokenConfig.symbol,
            policy: {
              enabled: Boolean(nextPolicy.enabled),
              auto_usd_limit: Number(nextPolicy.autoUsdLimit || 10),
              risk_threshold: Number(nextPolicy.riskThreshold || 0.35),
              velocity_per_hour: Number(nextPolicy.velocityPerHour || 8),
              require_onchain_verified: Boolean(nextPolicy.requireOnchainVerified)
            },
            feature_flag_enabled: typeof request.body.enabled === "boolean" ? Boolean(request.body.enabled) : null
          })
        ]
      );

      const summary = await buildAdminSummary(client, runtimeConfig);
      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: summary
      });
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === "42P01") {
        reply.code(503).send({ success: false, error: "token_tables_missing" });
        return;
      }
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.post(
  "/webapp/api/admin/token/curve",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          enabled: { type: "boolean" },
          admin_floor_usd: { type: "number", minimum: 0.00000001 },
          base_usd: { type: "number", minimum: 0.00000001 },
          k: { type: "number", minimum: 0 },
          supply_norm_divisor: { type: "number", minimum: 1 },
          demand_factor: { type: "number", minimum: 0.1 },
          volatility_dampen: { type: "number", minimum: 0, maximum: 1 }
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

      const runtimeConfig = await configService.getEconomyConfig(client, { forceRefresh: true });
      const tokenConfig = tokenEngine.normalizeTokenConfig(runtimeConfig);
      const currentMarketState = await tokenStore.getTokenMarketState(client, tokenConfig.symbol).catch((err) => {
        if (err.code === "42P01") return null;
        throw err;
      });
      const normalized = tokenEngine.normalizeCurveState(tokenConfig, currentMarketState);
      const previousCurveJson = {
        admin_floor_usd: Number(normalized.adminFloorUsd || 0),
        base_usd: Number(normalized.curveBaseUsd || 0),
        k: Number(normalized.curveK || 0),
        supply_norm_divisor: Number(normalized.supplyNormDivisor || 1),
        demand_factor: Number(normalized.demandFactor || 1),
        volatility_dampen: Number(normalized.volatilityDampen || 0)
      };
      const next = {
        adminFloorUsd: normalized.adminFloorUsd,
        curveBaseUsd: normalized.curveBaseUsd,
        curveK: normalized.curveK,
        supplyNormDivisor: normalized.supplyNormDivisor,
        demandFactor: normalized.demandFactor,
        volatilityDampen: normalized.volatilityDampen
      };

      if (Number.isFinite(Number(request.body.admin_floor_usd))) {
        next.adminFloorUsd = Math.max(0.00000001, Number(request.body.admin_floor_usd));
      }
      if (Number.isFinite(Number(request.body.base_usd))) {
        next.curveBaseUsd = Math.max(0.00000001, Number(request.body.base_usd));
      }
      if (Number.isFinite(Number(request.body.k))) {
        next.curveK = Math.max(0, Number(request.body.k));
      }
      if (Number.isFinite(Number(request.body.supply_norm_divisor))) {
        next.supplyNormDivisor = Math.max(1, Number(request.body.supply_norm_divisor));
      }
      if (Number.isFinite(Number(request.body.demand_factor))) {
        next.demandFactor = Math.max(0.1, Number(request.body.demand_factor));
      }
      if (Number.isFinite(Number(request.body.volatility_dampen))) {
        next.volatilityDampen = Math.max(0, Math.min(1, Number(request.body.volatility_dampen)));
      }

      await tokenStore.upsertTokenMarketState(client, {
        tokenSymbol: tokenConfig.symbol,
        adminFloorUsd: next.adminFloorUsd,
        curveBaseUsd: next.curveBaseUsd,
        curveK: next.curveK,
        supplyNormDivisor: next.supplyNormDivisor,
        demandFactor: next.demandFactor,
        volatilityDampen: next.volatilityDampen,
        autoPolicy: normalized.autoPolicy,
        updatedBy: Number(auth.uid)
      });
      await tokenStore
        .insertTreasuryPolicyHistory(client, {
          tokenSymbol: tokenConfig.symbol,
          source: "webapp_admin_curve",
          actorId: Number(auth.uid),
          previousPolicyJson: previousCurveJson,
          nextPolicyJson: {
            admin_floor_usd: Number(next.adminFloorUsd || 0),
            base_usd: Number(next.curveBaseUsd || 0),
            k: Number(next.curveK || 0),
            supply_norm_divisor: Number(next.supplyNormDivisor || 1),
            demand_factor: Number(next.demandFactor || 1),
            volatility_dampen: Number(next.volatilityDampen || 0)
          },
          reason: "webapp_curve_update"
        })
        .catch((err) => {
          if (err.code !== "42P01") {
            throw err;
          }
        });
      await tokenStore
        .upsertTreasuryGuardrail(client, {
          tokenSymbol: tokenConfig.symbol,
          minMarketCapUsd: Number(tokenConfig.payout_gate?.min_market_cap_usd || 0),
          targetMarketCapMaxUsd: Number(tokenConfig.payout_gate?.target_band_max_usd || 0),
          autoUsdLimit: Number(normalized.autoPolicy?.autoUsdLimit || 10),
          riskThreshold: Number(normalized.autoPolicy?.riskThreshold || 0.35),
          velocityPerHour: Number(normalized.autoPolicy?.velocityPerHour || 8),
          requireOnchainVerified: Boolean(normalized.autoPolicy?.requireOnchainVerified),
          guardrailJson: {
            source: "webapp_api_admin_token_curve"
          },
          updatedBy: Number(auth.uid)
        })
        .catch((err) => {
          if (err.code !== "42P01") {
            throw err;
          }
        });

      if (typeof request.body.enabled === "boolean") {
        await upsertFeatureFlag(client, {
          flagKey: "TOKEN_CURVE_ENABLED",
          enabled: Boolean(request.body.enabled),
          updatedBy: Number(auth.uid),
          note: "updated via /webapp/api/admin/token/curve"
        }).catch((err) => {
          if (err.code !== "42P01") throw err;
        });
      }

      await client.query(
        `INSERT INTO admin_audit (admin_id, action, target, payload_json)
         VALUES ($1, 'webapp_token_curve_update', 'token_market_state', $2::jsonb);`,
        [
          Number(auth.uid),
          JSON.stringify({
            token_symbol: tokenConfig.symbol,
            curve: {
              admin_floor_usd: next.adminFloorUsd,
              base_usd: next.curveBaseUsd,
              k: next.curveK,
              supply_norm_divisor: next.supplyNormDivisor,
              demand_factor: next.demandFactor,
              volatility_dampen: next.volatilityDampen
            },
            feature_flag_enabled: typeof request.body.enabled === "boolean" ? Boolean(request.body.enabled) : null
          })
        ]
      );

      const summary = await buildAdminSummary(client, runtimeConfig);
      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: summary
      });
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === "42P01") {
        reply.code(503).send({ success: false, error: "token_tables_missing" });
        return;
      }
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.post(
  "/webapp/api/admin/token/approve",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig", "request_id"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          request_id: { type: "integer", minimum: 1 },
          token_amount: { type: "number", minimum: 0.00000001 },
          tx_hash: { type: "string", minLength: 8, maxLength: 255 },
          note: { type: "string", maxLength: 500 }
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
    const requestId = Number(request.body.request_id);
    if (!Number.isFinite(requestId) || requestId <= 0) {
      reply.code(400).send({ success: false, error: "invalid_id" });
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

      const locked = await tokenStore.lockPurchaseRequest(client, requestId);
      if (!locked) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "not_found" });
        return;
      }
      if (String(locked.status) === "rejected") {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "already_rejected" });
        return;
      }
      if (String(locked.status) === "approved") {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "already_approved" });
        return;
      }
      if (String(locked.status) === "approved") {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "already_approved" });
        return;
      }

      const tokenAmount = Number(request.body.token_amount || locked.token_amount || 0);
      if (!Number.isFinite(tokenAmount) || tokenAmount <= 0) {
        await client.query("ROLLBACK");
        reply.code(400).send({ success: false, error: "invalid_token_amount" });
        return;
      }

      const txHashInput = String(request.body.tx_hash || locked.tx_hash || "").trim();
      const note = String(request.body.note || "").trim();

      if (!txHashInput) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "tx_hash_missing" });
        return;
      }

      const txCheck = await validateAndVerifyTokenTx(locked.chain, txHashInput);
      if (!txCheck.ok) {
        await client.query("ROLLBACK");
        const code = txCheck.reason === "tx_not_found_onchain" ? 409 : 400;
        reply.code(code).send({ success: false, error: txCheck.reason, data: txCheck.verify });
        return;
      }

      await tokenStore.submitPurchaseTxHash(client, {
        requestId,
        userId: locked.user_id,
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

      const runtimeConfig = await configService.getEconomyConfig(client);
      const tokenConfig = tokenEngine.normalizeTokenConfig(runtimeConfig);
      const tokenSymbol = String(locked.token_symbol || tokenConfig.symbol || "NXT").toUpperCase();
      const refEventId = deterministicUuid(`token_purchase_credit:${requestId}:${tokenSymbol}`);

      await economyStore.creditCurrency(client, {
        userId: locked.user_id,
        currency: tokenSymbol,
        amount: tokenAmount,
        reason: "token_purchase_approved",
        refEventId,
        meta: {
          request_id: requestId,
          chain: locked.chain,
          usd_amount: Number(locked.usd_amount || 0),
          tx_hash: txCheck.formatCheck.normalizedHash
        }
      });

      const updated = await tokenStore.markPurchaseApproved(client, {
        requestId,
        adminId: Number(auth.uid),
        adminNote: note || `approved:${tokenAmount}`
      });

      await client.query(
        `INSERT INTO admin_audit (admin_id, action, target, payload_json)
         VALUES ($1, 'token_purchase_approve', $2, $3::jsonb);`,
        [
          Number(auth.uid),
          `token_purchase_request:${requestId}`,
          JSON.stringify({
            token_amount: tokenAmount,
            token_symbol: tokenSymbol,
            tx_hash: txCheck.formatCheck.normalizedHash
          })
        ]
      );

      const summary = await buildAdminSummary(client, runtimeConfig);
      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: { request: updated, summary }
      });
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === "42P01") {
        reply.code(503).send({ success: false, error: "token_tables_missing" });
        return;
      }
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.post(
  "/webapp/api/admin/token/reject",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig", "request_id"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          request_id: { type: "integer", minimum: 1 },
          reason: { type: "string", maxLength: 500 }
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
    const requestId = Number(request.body.request_id);
    if (!Number.isFinite(requestId) || requestId <= 0) {
      reply.code(400).send({ success: false, error: "invalid_id" });
      return;
    }
    const reason = String(request.body.reason || "").trim() || "rejected_by_admin";

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const profile = await requireWebAppAdmin(client, reply, auth.uid);
      if (!profile) {
        await client.query("ROLLBACK");
        return;
      }

      const locked = await tokenStore.lockPurchaseRequest(client, requestId);
      if (!locked) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "not_found" });
        return;
      }
      if (String(locked.status) === "approved") {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "already_approved" });
        return;
      }

      const updated = await tokenStore.markPurchaseRejected(client, {
        requestId,
        adminId: Number(auth.uid),
        reason
      });

      await client.query(
        `INSERT INTO admin_audit (admin_id, action, target, payload_json)
         VALUES ($1, 'token_purchase_reject', $2, $3::jsonb);`,
        [Number(auth.uid), `token_purchase_request:${requestId}`, JSON.stringify({ reason })]
      );

      const runtimeConfig = await configService.getEconomyConfig(client);
      const summary = await buildAdminSummary(client, runtimeConfig);
      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: { request: updated, summary }
      });
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === "42P01") {
        reply.code(503).send({ success: false, error: "token_tables_missing" });
        return;
      }
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.post(
  "/webapp/api/admin/payout/pay",
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
          tx_hash: { type: "string", minLength: 8, maxLength: 255 }
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

    const requestId = Number(request.body.request_id || 0);
    const txHash = String(request.body.tx_hash || "").trim();
    if (!requestId || !txHash) {
      reply.code(400).send({ success: false, error: "invalid_payload" });
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

      const paid = await payoutStore.markPaid(client, {
        requestId,
        txHash,
        adminId: Number(auth.uid)
      });
      if (paid.status === "not_found") {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "not_found" });
        return;
      }
      if (paid.status === "rejected") {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "already_rejected" });
        return;
      }

      await client.query(
        `INSERT INTO admin_audit (admin_id, action, target, payload_json)
         VALUES ($1, 'payout_mark_paid', $2, $3::jsonb);`,
        [Number(auth.uid), `payout_request:${requestId}`, JSON.stringify({ tx_hash: txHash, status: paid.status })]
      );

      const runtimeConfig = await configService.getEconomyConfig(client);
      const summary = await buildAdminSummary(client, runtimeConfig);
      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: { payout: paid.request || null, status: paid.status, summary }
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
  "/webapp/api/admin/payout/reject",
  {
    schema: {
      body: {
        type: "object",
        required: ["uid", "ts", "sig", "request_id"],
        properties: {
          uid: { type: "string" },
          ts: { type: "string" },
          sig: { type: "string" },
          request_id: { type: "integer", minimum: 1 },
          reason: { type: "string", maxLength: 500 }
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
    const requestId = Number(request.body.request_id || 0);
    if (!requestId) {
      reply.code(400).send({ success: false, error: "invalid_id" });
      return;
    }
    const reason = String(request.body.reason || "").trim() || "rejected_by_admin";

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const profile = await requireWebAppAdmin(client, reply, auth.uid);
      if (!profile) {
        await client.query("ROLLBACK");
        return;
      }
      const result = await payoutStore.markRejected(client, {
        requestId,
        adminId: Number(auth.uid),
        reason
      });
      if (result.status !== "rejected") {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: result.status || "reject_failed" });
        return;
      }
      const runtimeConfig = await configService.getEconomyConfig(client);
      const summary = await buildAdminSummary(client, runtimeConfig);
      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: { payout: result.request, summary }
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);

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

fastify.get("/admin/runtime/bot", async (request, reply) => {
  const stateKey = String(request.query?.state_key || botRuntimeStore.DEFAULT_STATE_KEY).trim() || botRuntimeStore.DEFAULT_STATE_KEY;
  const limit = Math.max(1, Math.min(100, Number(request.query?.limit || 30)));
  const client = await pool.connect();
  try {
    const runtime = await readBotRuntimeState(client, { stateKey, limit });
    const health = projectBotRuntimeHealth(runtime);
    const actorId = parseAdminId(request);
    reply.send({
      success: true,
      data: {
        actor_admin_id: Number(actorId || 0),
        configured_admin_id: Number(ADMIN_TELEGRAM_ID || 0),
        is_admin: isAdminTelegramId(actorId),
        state_key: runtime.state_key || stateKey,
        health,
        runtime_state: runtime.state,
        recent_events: runtime.events,
        env: {
          bot_enabled: String(process.env.BOT_ENABLED || "1") === "1",
          bot_auto_restart: String(process.env.BOT_AUTO_RESTART || "1") === "1",
          keep_admin_on_bot_exit: String(process.env.KEEP_ADMIN_ON_BOT_EXIT || "1") === "1",
          bot_instance_lock_key: Number(process.env.BOT_INSTANCE_LOCK_KEY || 0)
        }
      }
    });
  } finally {
    client.release();
  }
});

fastify.post(
  "/admin/runtime/bot/reconcile",
  {
    schema: {
      body: {
        type: "object",
        properties: {
          state_key: { type: "string", minLength: 1, maxLength: 80 },
          reason: { type: "string", maxLength: 300 },
          force_stop: { type: "boolean" }
        }
      }
    }
  },
  async (request, reply) => {
    const body = request.body || {};
    const stateKey = String(body.state_key || botRuntimeStore.DEFAULT_STATE_KEY).trim() || botRuntimeStore.DEFAULT_STATE_KEY;
    const forceStop = Boolean(body.force_stop);
    const reason = String(body.reason || "manual_reconcile");
    const actorId = parseAdminId(request);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await reconcileBotRuntimeState(client, {
        stateKey,
        forceStop,
        reason,
        updatedBy: actorId
      });
      await client.query("COMMIT");

      if (result.status === "tables_missing") {
        reply.code(503).send({ success: false, error: "bot_runtime_tables_missing" });
        return;
      }

      reply.send({
        success: true,
        data: {
          actor_admin_id: Number(actorId || 0),
          configured_admin_id: Number(ADMIN_TELEGRAM_ID || 0),
          is_admin: isAdminTelegramId(actorId),
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
    const marker = await captureReleaseMarker(pool, {
      gitRevision: request.body?.git_revision || RELEASE_GIT_REVISION || "manual",
      deployId: request.body?.deploy_id || RELEASE_DEPLOY_ID || "",
      environment: request.body?.environment || RELEASE_ENV || "production",
      configVersion: Number(request.body?.config_version || 0),
      notes: request.body?.notes || "manual_release_marker",
      createdBy: adminId,
      health
    });
    reply.send({ success: true, data: marker });
  }
);

fastify.post(
  "/admin/configs",
  {
    schema: {
      body: {
        type: "object",
        required: ["config_key", "version", "config_json"],
        properties: {
          config_key: { type: "string" },
          version: { type: "integer" },
          config_json: { type: "object" }
        }
      }
    }
  },
  async (request, reply) => {
    if (!(await requireTables())) {
      reply.code(503).send({ success: false, error: "missing_tables_run_migrations" });
      return;
    }

    const { config_key: configKey, version, config_json: configJson } = request.body;
    const adminId = parseAdminId(request);
    await pool.query(
      `INSERT INTO config_versions (config_key, version, config_json, created_by)
       VALUES ($1, $2, $3::jsonb, $4);`,
      [configKey, version, JSON.stringify(configJson), adminId]
    );
    reply.code(201).send({ success: true, data: { config_key: configKey, version } });
  }
);

fastify.get("/admin/configs/:key", async (request, reply) => {
  if (!(await requireTables())) {
    reply.code(503).send({ success: false, error: "missing_tables_run_migrations" });
    return;
  }
  const key = request.params.key;
  const result = await pool.query(
    `SELECT config_key, version, config_json, created_at, created_by
     FROM config_versions
     WHERE config_key = $1
     ORDER BY version DESC, created_at DESC
     LIMIT 1;`,
    [key]
  );
  const row = result.rows[0];
  if (!row) {
    reply.code(404).send({ success: false, error: "not_found" });
    return;
  }
  reply.send({
    success: true,
    data: {
      config_key: row.config_key,
      version: row.version,
      config_json: row.config_json,
      created_at: row.created_at,
      created_by: row.created_by
    }
  });
});

fastify.post(
  "/admin/offers",
  {
    schema: {
      body: {
        type: "object",
        required: ["offer_type", "price", "currency", "benefit_json"],
        properties: {
          offer_type: { type: "string" },
          price: { type: "number" },
          currency: { type: "string" },
          benefit_json: { type: "object" },
          start_at: { type: "string" },
          end_at: { type: "string" },
          limits_json: { type: "object" }
        }
      }
    }
  },
  async (request, reply) => {
    if (!(await requireTables())) {
      reply.code(503).send({ success: false, error: "missing_tables_run_migrations" });
      return;
    }
    const body = request.body;
    const result = await pool.query(
      `INSERT INTO offers (offer_type, price, currency, benefit_json, start_at, end_at, limits_json)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7::jsonb)
       RETURNING id, offer_type, price, currency, benefit_json, start_at, end_at;`,
      [
        body.offer_type,
        body.price,
        body.currency,
        JSON.stringify(body.benefit_json || {}),
        body.start_at || null,
        body.end_at || null,
        JSON.stringify(body.limits_json || {})
      ]
    );
    reply.code(201).send({ success: true, data: result.rows[0] });
  }
);

fastify.get("/admin/offers", async (request, reply) => {
  if (!(await requireTables())) {
    reply.code(503).send({ success: false, error: "missing_tables_run_migrations" });
    return;
  }
  const result = await pool.query(
    `SELECT id, offer_type, price, currency, benefit_json, start_at, end_at
     FROM offers
     ORDER BY id DESC
     LIMIT 100;`
  );
  reply.send({ success: true, data: result.rows });
});

fastify.post(
  "/admin/system/freeze",
  {
    schema: {
      body: {
        type: "object",
        required: ["freeze"],
        properties: {
          freeze: { type: "boolean" },
          reason: { type: "string" }
        }
      }
    }
  },
  async (request, reply) => {
    if (!(await requireTables())) {
      reply.code(503).send({ success: false, error: "missing_tables_run_migrations" });
      return;
    }
    const adminId = parseAdminId(request);
    const freeze = Boolean(request.body.freeze);
    const reason = request.body.reason || "";
    const stateJson = { freeze, reason, updated_by: adminId, updated_at: new Date().toISOString() };
    await pool.query(
      `INSERT INTO system_state (state_key, state_json, updated_by)
       VALUES ('freeze', $1::jsonb, $2)
       ON CONFLICT (state_key)
       DO UPDATE SET state_json = EXCLUDED.state_json,
                     updated_by = EXCLUDED.updated_by,
                     updated_at = now();`,
      [JSON.stringify(stateJson), adminId]
    );

    await pool.query(
      `INSERT INTO admin_audit (admin_id, action, target, payload_json)
       VALUES ($1, 'system_freeze_toggle', 'system_state:freeze', $2::jsonb);`,
      [adminId, JSON.stringify(stateJson)]
    );
    reply.send({ success: true, data: stateJson });
  }
);

fastify.get("/admin/system/state", async (request, reply) => {
  if (!(await requireTables())) {
    reply.code(503).send({ success: false, error: "missing_tables_run_migrations" });
    return;
  }

  const freezeRes = await pool.query(
    `SELECT state_json, updated_at, updated_by
     FROM system_state
     WHERE state_key = 'freeze';`
  );
  const configRes = await pool.query(
    `SELECT DISTINCT ON (config_key) config_key, version, created_at
     FROM config_versions
     ORDER BY config_key, version DESC, created_at DESC;`
  );

  const freezeRow = freezeRes.rows[0];
  const freezeState = freezeRow
    ? {
        freeze: Boolean(freezeRow.state_json?.freeze),
        reason: freezeRow.state_json?.reason || "",
        updated_at: freezeRow.updated_at,
        updated_by: freezeRow.updated_by
      }
    : { freeze: false, reason: "", updated_at: null, updated_by: 0 };

  reply.send({
    success: true,
    data: {
      freeze: freezeState,
      active_configs: configRes.rows
    }
  });
});

fastify.post(
  "/admin/token/auto-policy",
  {
    schema: {
      body: {
        type: "object",
        properties: {
          enabled: { type: "boolean" },
          auto_usd_limit: { type: "number", minimum: 0.5 },
          risk_threshold: { type: "number", minimum: 0, maximum: 1 },
          velocity_per_hour: { type: "integer", minimum: 1, maximum: 1000 },
          require_onchain_verified: { type: "boolean" }
        }
      }
    }
  },
  async (request, reply) => {
    const adminId = parseAdminId(request);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const runtimeConfig = await configService.getEconomyConfig(client, { forceRefresh: true });
      const tokenConfig = tokenEngine.normalizeTokenConfig(runtimeConfig);
      const currentMarketState = await tokenStore.getTokenMarketState(client, tokenConfig.symbol).catch((err) => {
        if (err.code === "42P01") return null;
        throw err;
      });
      const normalized = tokenEngine.normalizeCurveState(tokenConfig, currentMarketState);
      const previousPolicyJson = {
        enabled: Boolean(normalized.autoPolicy?.enabled),
        auto_usd_limit: Number(normalized.autoPolicy?.autoUsdLimit || 10),
        risk_threshold: Number(normalized.autoPolicy?.riskThreshold || 0.35),
        velocity_per_hour: Number(normalized.autoPolicy?.velocityPerHour || 8),
        require_onchain_verified: Boolean(normalized.autoPolicy?.requireOnchainVerified)
      };
      const nextPolicy = {
        ...normalized.autoPolicy
      };

      if (typeof request.body.enabled === "boolean") {
        nextPolicy.enabled = Boolean(request.body.enabled);
      }
      if (Number.isFinite(Number(request.body.auto_usd_limit))) {
        nextPolicy.autoUsdLimit = Math.max(0.5, Number(request.body.auto_usd_limit));
      }
      if (Number.isFinite(Number(request.body.risk_threshold))) {
        nextPolicy.riskThreshold = Math.max(0, Math.min(1, Number(request.body.risk_threshold)));
      }
      if (Number.isFinite(Number(request.body.velocity_per_hour))) {
        nextPolicy.velocityPerHour = Math.max(1, Math.floor(Number(request.body.velocity_per_hour)));
      }
      if (typeof request.body.require_onchain_verified === "boolean") {
        nextPolicy.requireOnchainVerified = Boolean(request.body.require_onchain_verified);
      }

      const upserted = await tokenStore.upsertTokenMarketState(client, {
        tokenSymbol: tokenConfig.symbol,
        adminFloorUsd: normalized.adminFloorUsd,
        curveBaseUsd: normalized.curveBaseUsd,
        curveK: normalized.curveK,
        supplyNormDivisor: normalized.supplyNormDivisor,
        demandFactor: normalized.demandFactor,
        volatilityDampen: normalized.volatilityDampen,
        autoPolicy: {
          enabled: Boolean(nextPolicy.enabled),
          auto_usd_limit: Number(nextPolicy.autoUsdLimit || 10),
          risk_threshold: Number(nextPolicy.riskThreshold || 0.35),
          velocity_per_hour: Number(nextPolicy.velocityPerHour || 8),
          require_onchain_verified: Boolean(nextPolicy.requireOnchainVerified)
        },
        updatedBy: adminId
      });
      await tokenStore
        .insertTreasuryPolicyHistory(client, {
          tokenSymbol: tokenConfig.symbol,
          source: "admin_auto_policy",
          actorId: adminId,
          previousPolicyJson,
          nextPolicyJson: {
            enabled: Boolean(nextPolicy.enabled),
            auto_usd_limit: Number(nextPolicy.autoUsdLimit || 10),
            risk_threshold: Number(nextPolicy.riskThreshold || 0.35),
            velocity_per_hour: Number(nextPolicy.velocityPerHour || 8),
            require_onchain_verified: Boolean(nextPolicy.requireOnchainVerified)
          },
          reason: "admin_auto_policy_update"
        })
        .catch((err) => {
          if (err.code !== "42P01") {
            throw err;
          }
        });
      await tokenStore
        .upsertTreasuryGuardrail(client, {
          tokenSymbol: tokenConfig.symbol,
          minMarketCapUsd: Number(tokenConfig.payout_gate?.min_market_cap_usd || 0),
          targetMarketCapMaxUsd: Number(tokenConfig.payout_gate?.target_band_max_usd || 0),
          autoUsdLimit: Number(nextPolicy.autoUsdLimit || 10),
          riskThreshold: Number(nextPolicy.riskThreshold || 0.35),
          velocityPerHour: Number(nextPolicy.velocityPerHour || 8),
          requireOnchainVerified: Boolean(nextPolicy.requireOnchainVerified),
          guardrailJson: {
            source: "admin_token_auto_policy"
          },
          updatedBy: adminId
        })
        .catch((err) => {
          if (err.code !== "42P01") {
            throw err;
          }
        });

      if (typeof request.body.enabled === "boolean") {
        await upsertFeatureFlag(client, {
          flagKey: "TOKEN_AUTO_APPROVE_ENABLED",
          enabled: Boolean(request.body.enabled),
          updatedBy: adminId,
          note: "updated via /admin/token/auto-policy"
        }).catch((err) => {
          if (err.code !== "42P01") throw err;
        });
      }

      await client.query(
        `INSERT INTO admin_audit (admin_id, action, target, payload_json)
         VALUES ($1, 'token_auto_policy_update', 'token_market_state', $2::jsonb);`,
        [
          adminId,
          JSON.stringify({
            token_symbol: tokenConfig.symbol,
            policy: upserted?.auto_policy_json || {},
            feature_flag_enabled:
              typeof request.body.enabled === "boolean" ? Boolean(request.body.enabled) : null
          })
        ]
      );
      await client.query("COMMIT");
      reply.send({
        success: true,
        data: {
          token_symbol: tokenConfig.symbol,
          auto_policy: upserted?.auto_policy_json || {},
          updated_at: upserted?.updated_at || null
        }
      });
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === "42P01") {
        reply.code(503).send({ success: false, error: "token_tables_missing" });
        return;
      }
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.post(
  "/admin/token/curve",
  {
    schema: {
      body: {
        type: "object",
        properties: {
          enabled: { type: "boolean" },
          admin_floor_usd: { type: "number", minimum: 0.00000001 },
          base_usd: { type: "number", minimum: 0.00000001 },
          k: { type: "number", minimum: 0 },
          supply_norm_divisor: { type: "number", minimum: 1 },
          demand_factor: { type: "number", minimum: 0.1 },
          volatility_dampen: { type: "number", minimum: 0, maximum: 1 }
        }
      }
    }
  },
  async (request, reply) => {
    const adminId = parseAdminId(request);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const runtimeConfig = await configService.getEconomyConfig(client, { forceRefresh: true });
      const tokenConfig = tokenEngine.normalizeTokenConfig(runtimeConfig);
      const currentMarketState = await tokenStore.getTokenMarketState(client, tokenConfig.symbol).catch((err) => {
        if (err.code === "42P01") return null;
        throw err;
      });
      const normalized = tokenEngine.normalizeCurveState(tokenConfig, currentMarketState);
      const previousCurveJson = {
        admin_floor_usd: Number(normalized.adminFloorUsd || 0),
        base_usd: Number(normalized.curveBaseUsd || 0),
        k: Number(normalized.curveK || 0),
        supply_norm_divisor: Number(normalized.supplyNormDivisor || 1),
        demand_factor: Number(normalized.demandFactor || 1),
        volatility_dampen: Number(normalized.volatilityDampen || 0)
      };
      const next = {
        adminFloorUsd: normalized.adminFloorUsd,
        curveBaseUsd: normalized.curveBaseUsd,
        curveK: normalized.curveK,
        supplyNormDivisor: normalized.supplyNormDivisor,
        demandFactor: normalized.demandFactor,
        volatilityDampen: normalized.volatilityDampen
      };

      if (Number.isFinite(Number(request.body.admin_floor_usd))) {
        next.adminFloorUsd = Math.max(0.00000001, Number(request.body.admin_floor_usd));
      }
      if (Number.isFinite(Number(request.body.base_usd))) {
        next.curveBaseUsd = Math.max(0.00000001, Number(request.body.base_usd));
      }
      if (Number.isFinite(Number(request.body.k))) {
        next.curveK = Math.max(0, Number(request.body.k));
      }
      if (Number.isFinite(Number(request.body.supply_norm_divisor))) {
        next.supplyNormDivisor = Math.max(1, Number(request.body.supply_norm_divisor));
      }
      if (Number.isFinite(Number(request.body.demand_factor))) {
        next.demandFactor = Math.max(0.1, Number(request.body.demand_factor));
      }
      if (Number.isFinite(Number(request.body.volatility_dampen))) {
        next.volatilityDampen = Math.max(0, Math.min(1, Number(request.body.volatility_dampen)));
      }

      const upserted = await tokenStore.upsertTokenMarketState(client, {
        tokenSymbol: tokenConfig.symbol,
        adminFloorUsd: next.adminFloorUsd,
        curveBaseUsd: next.curveBaseUsd,
        curveK: next.curveK,
        supplyNormDivisor: next.supplyNormDivisor,
        demandFactor: next.demandFactor,
        volatilityDampen: next.volatilityDampen,
        autoPolicy: normalized.autoPolicy,
        updatedBy: adminId
      });
      await tokenStore
        .insertTreasuryPolicyHistory(client, {
          tokenSymbol: tokenConfig.symbol,
          source: "admin_curve",
          actorId: adminId,
          previousPolicyJson: previousCurveJson,
          nextPolicyJson: {
            admin_floor_usd: Number(next.adminFloorUsd || 0),
            base_usd: Number(next.curveBaseUsd || 0),
            k: Number(next.curveK || 0),
            supply_norm_divisor: Number(next.supplyNormDivisor || 1),
            demand_factor: Number(next.demandFactor || 1),
            volatility_dampen: Number(next.volatilityDampen || 0)
          },
          reason: "admin_curve_update"
        })
        .catch((err) => {
          if (err.code !== "42P01") {
            throw err;
          }
        });
      await tokenStore
        .upsertTreasuryGuardrail(client, {
          tokenSymbol: tokenConfig.symbol,
          minMarketCapUsd: Number(tokenConfig.payout_gate?.min_market_cap_usd || 0),
          targetMarketCapMaxUsd: Number(tokenConfig.payout_gate?.target_band_max_usd || 0),
          autoUsdLimit: Number(normalized.autoPolicy?.autoUsdLimit || 10),
          riskThreshold: Number(normalized.autoPolicy?.riskThreshold || 0.35),
          velocityPerHour: Number(normalized.autoPolicy?.velocityPerHour || 8),
          requireOnchainVerified: Boolean(normalized.autoPolicy?.requireOnchainVerified),
          guardrailJson: {
            source: "admin_token_curve"
          },
          updatedBy: adminId
        })
        .catch((err) => {
          if (err.code !== "42P01") {
            throw err;
          }
        });

      if (typeof request.body.enabled === "boolean") {
        await upsertFeatureFlag(client, {
          flagKey: "TOKEN_CURVE_ENABLED",
          enabled: Boolean(request.body.enabled),
          updatedBy: adminId,
          note: "updated via /admin/token/curve"
        }).catch((err) => {
          if (err.code !== "42P01") throw err;
        });
      }

      await client.query(
        `INSERT INTO admin_audit (admin_id, action, target, payload_json)
         VALUES ($1, 'token_curve_update', 'token_market_state', $2::jsonb);`,
        [
          adminId,
          JSON.stringify({
            token_symbol: tokenConfig.symbol,
            curve: {
              admin_floor_usd: next.adminFloorUsd,
              base_usd: next.curveBaseUsd,
              k: next.curveK,
              supply_norm_divisor: next.supplyNormDivisor,
              demand_factor: next.demandFactor,
              volatility_dampen: next.volatilityDampen
            },
            feature_flag_enabled:
              typeof request.body.enabled === "boolean" ? Boolean(request.body.enabled) : null
          })
        ]
      );

      await client.query("COMMIT");
      reply.send({
        success: true,
        data: {
          token_symbol: tokenConfig.symbol,
          curve: {
            admin_floor_usd: Number(upserted?.admin_floor_usd || next.adminFloorUsd),
            base_usd: Number(upserted?.curve_base_usd || next.curveBaseUsd),
            k: Number(upserted?.curve_k || next.curveK),
            supply_norm_divisor: Number(upserted?.supply_norm_divisor || next.supplyNormDivisor),
            demand_factor: Number(upserted?.demand_factor || next.demandFactor),
            volatility_dampen: Number(upserted?.volatility_dampen || next.volatilityDampen)
          },
          updated_at: upserted?.updated_at || null
        }
      });
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === "42P01") {
        reply.code(503).send({ success: false, error: "token_tables_missing" });
        return;
      }
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.get(
  "/admin/payouts",
  {
    schema: {
      querystring: {
        type: "object",
        properties: {
          status: { type: "string" },
          limit: { type: "integer" }
        }
      }
    }
  },
  async (request, reply) => {
    if (!(await requirePayoutTables())) {
      reply.code(503).send({ success: false, error: "missing_tables_run_migrations" });
      return;
    }

    const allowedStatuses = new Set(["requested", "pending", "approved", "paid", "rejected"]);
    const status = request.query.status ? String(request.query.status).toLowerCase() : "";
    if (status && !allowedStatuses.has(status)) {
      reply.code(400).send({ success: false, error: "invalid_status" });
      return;
    }

    const limit = parseLimit(request.query.limit, 50, 200);
    let result;
    if (status) {
      result = await pool.query(
        `SELECT
            r.id,
            r.user_id,
            r.currency,
            r.amount,
            r.source_hc_amount,
            r.fx_rate_snapshot,
            r.status,
            r.cooldown_until,
            r.created_at,
            t.tx_hash,
            t.recorded_at,
            t.admin_id
         FROM payout_requests r
         LEFT JOIN payout_tx t ON t.payout_request_id = r.id
         WHERE r.status = $1
         ORDER BY r.created_at DESC
         LIMIT $2;`,
        [status, limit]
      );
    } else {
      result = await pool.query(
        `SELECT
            r.id,
            r.user_id,
            r.currency,
            r.amount,
            r.source_hc_amount,
            r.fx_rate_snapshot,
            r.status,
            r.cooldown_until,
            r.created_at,
            t.tx_hash,
            t.recorded_at,
            t.admin_id
         FROM payout_requests r
         LEFT JOIN payout_tx t ON t.payout_request_id = r.id
         ORDER BY r.created_at DESC
         LIMIT $1;`,
        [limit]
      );
    }

    reply.send({ success: true, data: result.rows });
  }
);

fastify.get("/admin/payouts/:id", async (request, reply) => {
  if (!(await requirePayoutTables())) {
    reply.code(503).send({ success: false, error: "missing_tables_run_migrations" });
    return;
  }
  const requestId = Number(request.params.id);
  if (!Number.isFinite(requestId) || requestId <= 0) {
    reply.code(400).send({ success: false, error: "invalid_id" });
    return;
  }

  const result = await pool.query(
    `SELECT
        r.id,
        r.user_id,
        r.currency,
        r.amount,
        r.source_hc_amount,
        r.fx_rate_snapshot,
        r.status,
        r.cooldown_until,
        r.created_at,
        t.tx_hash,
        t.recorded_at,
        t.admin_id
     FROM payout_requests r
     LEFT JOIN payout_tx t ON t.payout_request_id = r.id
     WHERE r.id = $1
     LIMIT 1;`,
    [requestId]
  );

  if (result.rows.length === 0) {
    reply.code(404).send({ success: false, error: "not_found" });
    return;
  }

  reply.send({ success: true, data: result.rows[0] });
});

fastify.post(
  "/admin/payouts/:id/pay",
  {
    schema: {
      body: {
        type: "object",
        required: ["tx_hash"],
        properties: {
          tx_hash: { type: "string", minLength: 8, maxLength: 255 }
        }
      }
    }
  },
  async (request, reply) => {
    if (!(await requirePayoutTables())) {
      reply.code(503).send({ success: false, error: "missing_tables_run_migrations" });
      return;
    }

    const requestId = Number(request.params.id);
    if (!Number.isFinite(requestId) || requestId <= 0) {
      reply.code(400).send({ success: false, error: "invalid_id" });
      return;
    }
    const txHash = String(request.body.tx_hash || "").trim();
    if (!txHash) {
      reply.code(400).send({ success: false, error: "invalid_tx_hash" });
      return;
    }

    const adminId = parseAdminId(request);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query(
        `SELECT id, status
         FROM payout_requests
         WHERE id = $1
         FOR UPDATE;`,
        [requestId]
      );
      if (locked.rows.length === 0) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "not_found" });
        return;
      }

      const current = locked.rows[0];
      if (current.status === "rejected") {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "already_rejected" });
        return;
      }

      if (current.status !== "paid") {
        await client.query(
          `UPDATE payout_requests
           SET status = 'paid'
           WHERE id = $1;`,
          [requestId]
        );
      }

      await client.query(
        `INSERT INTO payout_tx (payout_request_id, tx_hash, admin_id)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING;`,
        [requestId, txHash, adminId]
      );

      await client.query(
        `INSERT INTO admin_audit (admin_id, action, target, payload_json)
         VALUES ($1, 'payout_paid', $2, $3::jsonb);`,
        [adminId, `payout_request:${requestId}`, JSON.stringify({ tx_hash: txHash })]
      );

      const out = await client.query(
        `SELECT
            r.id,
            r.user_id,
            r.currency,
            r.amount,
            r.source_hc_amount,
            r.fx_rate_snapshot,
            r.status,
            r.cooldown_until,
            r.created_at,
            t.tx_hash,
            t.recorded_at,
            t.admin_id
         FROM payout_requests r
         LEFT JOIN payout_tx t ON t.payout_request_id = r.id
         WHERE r.id = $1
         LIMIT 1;`,
        [requestId]
      );
      await client.query("COMMIT");
      reply.send({ success: true, data: out.rows[0] });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.post(
  "/admin/payouts/:id/reject",
  {
    schema: {
      body: {
        type: "object",
        properties: {
          reason: { type: "string", maxLength: 500 }
        }
      }
    }
  },
  async (request, reply) => {
    if (!(await requirePayoutTables())) {
      reply.code(503).send({ success: false, error: "missing_tables_run_migrations" });
      return;
    }

    const requestId = Number(request.params.id);
    if (!Number.isFinite(requestId) || requestId <= 0) {
      reply.code(400).send({ success: false, error: "invalid_id" });
      return;
    }
    const reason = String(request.body?.reason || "");
    const adminId = parseAdminId(request);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query(
        `SELECT id, user_id, status, source_hc_amount
         FROM payout_requests
         WHERE id = $1
         FOR UPDATE;`,
        [requestId]
      );
      if (locked.rows.length === 0) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "not_found" });
        return;
      }

      const current = locked.rows[0];
      if (current.status === "paid") {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "already_paid" });
        return;
      }

      if (current.status !== "rejected") {
        await client.query(
          `UPDATE payout_requests
           SET status = 'rejected'
           WHERE id = $1;`,
          [requestId]
        );
      }

      const refundAmount = Number(current.source_hc_amount || 0);
      if (refundAmount > 0) {
        const refundRef = deterministicUuid(`payout_refund:${requestId}:HC`);
        const inserted = await client.query(
          `INSERT INTO currency_ledger (user_id, currency, delta, reason, ref_event_id, meta_json)
           VALUES ($1, 'HC', $2, 'payout_reject_refund', $3, $4::jsonb)
           ON CONFLICT DO NOTHING
           RETURNING delta;`,
          [
            current.user_id,
            refundAmount,
            refundRef,
            JSON.stringify({ payout_request_id: requestId, reason })
          ]
        );

        if (inserted.rows.length > 0) {
          await client.query(
            `INSERT INTO currency_balances (user_id, currency, balance)
             VALUES ($1, 'HC', $2)
             ON CONFLICT (user_id, currency)
             DO UPDATE SET balance = currency_balances.balance + EXCLUDED.balance,
                           updated_at = now();`,
            [current.user_id, refundAmount]
          );
        }
      }

      await client.query(
        `INSERT INTO admin_audit (admin_id, action, target, payload_json)
         VALUES ($1, 'payout_reject', $2, $3::jsonb);`,
        [adminId, `payout_request:${requestId}`, JSON.stringify({ reason })]
      );

      const out = await client.query(
        `SELECT
            r.id,
            r.user_id,
            r.currency,
            r.amount,
            r.source_hc_amount,
            r.fx_rate_snapshot,
            r.status,
            r.cooldown_until,
            r.created_at,
            t.tx_hash,
            t.recorded_at,
            t.admin_id
         FROM payout_requests r
         LEFT JOIN payout_tx t ON t.payout_request_id = r.id
         WHERE r.id = $1
         LIMIT 1;`,
        [requestId]
      );

      await client.query("COMMIT");
      reply.send({ success: true, data: out.rows[0] });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.get(
  "/admin/token/requests",
  {
    schema: {
      querystring: {
        type: "object",
        properties: {
          status: { type: "string" },
          limit: { type: "integer" }
        }
      }
    }
  },
  async (request, reply) => {
    const status = String(request.query.status || "").trim().toLowerCase();
    const limit = parseLimit(request.query.limit, 50, 200);
    try {
      const rows = await tokenStore.listPurchaseRequests(pool, { status, limit });
      reply.send({ success: true, data: rows });
    } catch (err) {
      if (err.code === "42P01") {
        reply.code(503).send({ success: false, error: "token_tables_missing" });
        return;
      }
      throw err;
    }
  }
);

fastify.post(
  "/admin/token/requests/:id/approve",
  {
    schema: {
      body: {
        type: "object",
        properties: {
          token_amount: { type: "number", minimum: 0.00000001 },
          tx_hash: { type: "string", minLength: 8, maxLength: 255 },
          note: { type: "string", maxLength: 500 }
        }
      }
    }
  },
  async (request, reply) => {
    const requestId = Number(request.params.id);
    if (!Number.isFinite(requestId) || requestId <= 0) {
      reply.code(400).send({ success: false, error: "invalid_id" });
      return;
    }

    const adminId = parseAdminId(request);
    const txHash = String(request.body?.tx_hash || "").trim();
    const note = String(request.body?.note || "").trim();

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await tokenStore.lockPurchaseRequest(client, requestId);
      if (!locked) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "not_found" });
        return;
      }
      if (String(locked.status) === "rejected") {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "already_rejected" });
        return;
      }

      const tokenAmount = Number(request.body?.token_amount || locked.token_amount || 0);
      if (!Number.isFinite(tokenAmount) || tokenAmount <= 0) {
        await client.query("ROLLBACK");
        reply.code(400).send({ success: false, error: "invalid_token_amount" });
        return;
      }

      const txHashInput = txHash || String(locked.tx_hash || "").trim();
      if (!txHashInput) {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "tx_hash_missing" });
        return;
      }

      const txCheck = await validateAndVerifyTokenTx(locked.chain, txHashInput);
      if (!txCheck.ok) {
        await client.query("ROLLBACK");
        const code = txCheck.reason === "tx_not_found_onchain" ? 409 : 400;
        reply.code(code).send({ success: false, error: txCheck.reason, data: txCheck.verify });
        return;
      }

      await tokenStore.submitPurchaseTxHash(client, {
        requestId,
        userId: locked.user_id,
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

      const runtimeConfig = await configService.getEconomyConfig(client);
      const tokenConfig = tokenEngine.normalizeTokenConfig(runtimeConfig);
      const tokenSymbol = String(locked.token_symbol || tokenConfig.symbol || "NXT").toUpperCase();

      const refEventId = deterministicUuid(`token_purchase_credit:${requestId}:${tokenSymbol}`);
      await economyStore.creditCurrency(client, {
        userId: locked.user_id,
        currency: tokenSymbol,
        amount: tokenAmount,
        reason: "token_purchase_approved",
        refEventId,
        meta: {
          request_id: requestId,
          chain: locked.chain,
          usd_amount: Number(locked.usd_amount || 0),
          tx_hash: txCheck.formatCheck.normalizedHash
        }
      });

      const updated = await tokenStore.markPurchaseApproved(client, {
        requestId,
        adminId,
        adminNote: note || `approved:${tokenAmount}`
      });

      await client.query(
        `INSERT INTO admin_audit (admin_id, action, target, payload_json)
         VALUES ($1, 'token_purchase_approve', $2, $3::jsonb);`,
        [
          adminId,
          `token_purchase_request:${requestId}`,
          JSON.stringify({
            token_amount: tokenAmount,
            token_symbol: tokenSymbol,
            tx_hash: txCheck.formatCheck.normalizedHash
          })
        ]
      );

      await client.query("COMMIT");
      reply.send({ success: true, data: updated });
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === "42P01") {
        reply.code(503).send({ success: false, error: "token_tables_missing" });
        return;
      }
      throw err;
    } finally {
      client.release();
    }
  }
);

fastify.post(
  "/admin/token/requests/:id/reject",
  {
    schema: {
      body: {
        type: "object",
        properties: {
          reason: { type: "string", maxLength: 500 }
        }
      }
    }
  },
  async (request, reply) => {
    const requestId = Number(request.params.id);
    if (!Number.isFinite(requestId) || requestId <= 0) {
      reply.code(400).send({ success: false, error: "invalid_id" });
      return;
    }
    const adminId = parseAdminId(request);
    const reason = String(request.body?.reason || "").trim();

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await tokenStore.lockPurchaseRequest(client, requestId);
      if (!locked) {
        await client.query("ROLLBACK");
        reply.code(404).send({ success: false, error: "not_found" });
        return;
      }
      if (String(locked.status) === "approved") {
        await client.query("ROLLBACK");
        reply.code(409).send({ success: false, error: "already_approved" });
        return;
      }

      const updated = await tokenStore.markPurchaseRejected(client, {
        requestId,
        adminId,
        reason: reason || "rejected_by_admin"
      });

      await client.query(
        `INSERT INTO admin_audit (admin_id, action, target, payload_json)
         VALUES ($1, 'token_purchase_reject', $2, $3::jsonb);`,
        [adminId, `token_purchase_request:${requestId}`, JSON.stringify({ reason: reason || "rejected_by_admin" })]
      );

      await client.query("COMMIT");
      reply.send({ success: true, data: updated });
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.code === "42P01") {
        reply.code(503).send({ success: false, error: "token_tables_missing" });
        return;
      }
      throw err;
    } finally {
      client.release();
    }
  }
);

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
