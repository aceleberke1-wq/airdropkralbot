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
const payoutStore = require("../../bot/src/stores/payoutStore");
const configService = require("../../bot/src/services/configService");
const economyEngine = require("../../bot/src/services/economyEngine");
const antiAbuseEngine = require("../../bot/src/services/antiAbuseEngine");
const arenaEngine = require("../../bot/src/services/arenaEngine");
const arenaService = require("../../bot/src/services/arenaService");
const tokenEngine = require("../../bot/src/services/tokenEngine");
const txVerifier = require("../../bot/src/services/txVerifier");

const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN;
const ADMIN_TELEGRAM_ID = Number(process.env.ADMIN_TELEGRAM_ID || 0);
const DATABASE_URL = process.env.DATABASE_URL;
const DATABASE_SSL = process.env.DATABASE_SSL === "1";
const PORT = Number(process.env.PORT || process.env.ADMIN_API_PORT || 4000);
const WEBAPP_HMAC_SECRET = process.env.WEBAPP_HMAC_SECRET || "";
const WEBAPP_AUTH_TTL_SEC = Number(process.env.WEBAPP_AUTH_TTL_SEC || 900);
const TOKEN_TX_VERIFY = process.env.TOKEN_TX_VERIFY === "1";
const TOKEN_TX_VERIFY_STRICT = process.env.TOKEN_TX_VERIFY_STRICT === "1";
const WEBAPP_DIR = path.join(__dirname, "../../webapp");
const WEBAPP_ASSETS_DIR = path.join(WEBAPP_DIR, "assets");

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
  const parsed = Number(headerValue || ADMIN_TELEGRAM_ID || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isAdminTelegramId(telegramId) {
  return Number(telegramId || 0) === Number(ADMIN_TELEGRAM_ID || 0);
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

function deterministicUuid(input) {
  const hex = crypto.createHash("sha1").update(String(input)).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex
    .slice(16, 20)
    .join("")}-${hex.slice(20, 32).join("")}`;
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
  const tokenSupply = await economyStore.getCurrencySupply(db, tokenConfig.symbol);
  const gate = computeTokenMarketCapGate(tokenConfig, tokenSupply.total);

  return {
    freeze,
    total_users: Number(usersRes.rows[0]?.c || 0),
    active_attempts: Number(activeAttemptsRes.rows[0]?.c || 0),
    pending_payout_count: pendingPayouts.length,
    pending_token_count: pendingTokenRequests.length,
    pending_payouts: pendingPayouts.slice(0, 10),
    pending_token_requests: pendingTokenRequests.slice(0, 10),
    token: {
      symbol: tokenConfig.symbol,
      spot_usd: Number(tokenConfig.usd_price || 0),
      supply: Number(tokenSupply.total || 0),
      holders: Number(tokenSupply.holders || 0),
      market_cap_usd: Number((Number(tokenSupply.total || 0) * Number(tokenConfig.usd_price || 0)).toFixed(8)),
      payout_gate: gate
    }
  };
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

async function buildTokenSummary(db, profile, runtimeConfig, balances) {
  const tokenConfig = tokenEngine.normalizeTokenConfig(runtimeConfig);
  const symbol = tokenConfig.symbol;
  const balance = Number((balances || {})[symbol] || 0);
  const tokenSupply = await economyStore.getCurrencySupply(db, symbol);
  const gate = computeTokenMarketCapGate(tokenConfig, tokenSupply.total);
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

  return {
    enabled: tokenConfig.enabled,
    symbol,
    decimals: tokenConfig.decimals,
    usd_price: Number(tokenConfig.usd_price || 0),
    market_cap_usd: Number((Number(tokenSupply.total || 0) * Number(tokenConfig.usd_price || 0)).toFixed(8)),
    total_supply: Number(tokenSupply.total || 0),
    holders: Number(tokenSupply.holders || 0),
    payout_gate: gate,
    balance,
    unified_units: unifiedUnits,
    mintable_from_balances: mintableFromBalances,
    purchase: {
      min_usd: Number(tokenConfig.purchase.min_usd || 0),
      max_usd: Number(tokenConfig.purchase.max_usd || 0),
      slippage_pct: Number(tokenConfig.purchase.slippage_pct || 0),
      chains
    },
    requests: mapTokenRequestPreview(requests)
  };
}

async function buildActionSnapshot(db, profile, runtimeConfig) {
  const balances = await economyStore.getBalances(db, profile.user_id);
  const dailyRaw = await economyStore.getTodayCounter(db, profile.user_id);
  const riskState = await riskStore.getRiskState(db, profile.user_id);
  const live = await readOffersAttemptsEvents(db, profile.user_id);
  const token = await buildTokenSummary(db, profile, runtimeConfig, balances);
  return {
    balances,
    daily: buildDailyView(runtimeConfig, profile, dailyRaw),
    risk_score: Number(riskState.riskScore || 0),
    token,
    ...live
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

fastify.get("/healthz", async () => ({ ok: true, service: "up" }));

fastify.get("/health", async () => {
  try {
    const db = await dbPingWithTimeout(5000);
    return { ok: true, db: db.rows[0]?.ok === 1 };
  } catch (err) {
    return { ok: true, db: false, reason: err?.message || "db_unavailable" };
  }
});

fastify.get("/webapp", async (request, reply) => {
  const indexPath = path.join(WEBAPP_DIR, "index.html");
  if (!fs.existsSync(indexPath)) {
    reply.code(404).type("text/plain").send("webapp_not_found");
    return;
  }
  reply.type("text/html; charset=utf-8").send(fs.readFileSync(indexPath, "utf8"));
});

fastify.get("/webapp/:asset", async (request, reply) => {
  const asset = String(request.params.asset || "");
  const allowed = new Set(["app.js", "styles.css"]);
  if (!allowed.has(asset)) {
    reply.code(404).type("text/plain").send("asset_not_found");
    return;
  }
  const filePath = path.join(WEBAPP_DIR, asset);
  if (!fs.existsSync(filePath)) {
    reply.code(404).type("text/plain").send("asset_not_found");
    return;
  }
  const type = asset.endsWith(".js") ? "application/javascript; charset=utf-8" : "text/css; charset=utf-8";
  reply.type(type).send(fs.readFileSync(filePath, "utf8"));
});

fastify.get("/webapp/assets/*", async (request, reply) => {
  const rawPath = String(request.params["*"] || "");
  if (!rawPath || rawPath.includes("..") || rawPath.includes("\\") || rawPath.startsWith("/")) {
    reply.code(404).type("text/plain").send("asset_not_found");
    return;
  }
  const filePath = path.join(WEBAPP_ASSETS_DIR, rawPath);
  if (!filePath.startsWith(WEBAPP_ASSETS_DIR) || !fs.existsSync(filePath)) {
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
                    : "application/octet-stream";

  reply.type(contentType).send(fs.readFileSync(filePath));
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
    const token = await buildTokenSummary(client, profile, runtimeConfig, balances);
    const isAdmin = isAdminTelegramId(auth.uid);
    const adminSummary = isAdmin ? await buildAdminSummary(client, runtimeConfig) : null;

    const missionReady = missions.filter((m) => m.completed && !m.claimed).length;
    const missionOpen = missions.filter((m) => !m.claimed).length;

    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data: {
        profile,
        balances,
        daily: buildDailyView(runtimeConfig, profile, dailyRow),
        season: {
          season_id: season.seasonId,
          days_left: season.daysLeft,
          points: Number(seasonStat?.season_points || 0)
        },
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
      const baseDifficulty = Number(task.difficulty || offer.difficulty || 0.4);
      const safeDifficulty = economyEngine.clamp(baseDifficulty + mode.difficultyDelta, 0, 1);
      const risk = (await riskStore.getRiskState(client, profile.user_id)).riskScore;
      const probabilities = economyEngine.getTaskProbabilities(runtimeConfig, {
        difficulty: safeDifficulty,
        streak: Number(profile.current_streak || 0),
        risk
      });
      const roll = economyEngine.rollTaskResult(probabilities);
      const durationSec = Math.max(0, Math.floor((Date.now() - new Date(lockedAttempt.started_at).getTime()) / 1000));
      const qualityScore = Number((0.55 + Math.random() * 0.4).toFixed(3));

      const completed = await taskStore.completeAttemptIfPending(client, attemptId, roll.result, qualityScore, {
        duration_sec: durationSec,
        base_difficulty: baseDifficulty,
        effective_difficulty: safeDifficulty,
        probability_success: probabilities.pSuccess,
        roll: roll.roll,
        play_mode: mode.key,
        play_mode_label: mode.label,
        play_mode_reward_multiplier: mode.rewardMultiplier
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
            snapshot
          }
        });
        return;
      }

      await taskStore.markOfferConsumed(client, lockedAttempt.task_offer_id);
      await economyStore.incrementDailyTasks(client, profile.user_id, 1);
      const recentResults = await taskStore.getRecentAttemptResults(client, profile.user_id, 6);
      const combo = computeCombo(recentResults);

      await antiAbuseEngine.applyRiskEvent(client, riskStore, runtimeConfig, {
        userId: profile.user_id,
        eventType: "task_complete",
        context: { attemptId, durationSec, result: roll.result, play_mode: mode.key, combo }
      });
      await riskStore.insertBehaviorEvent(client, profile.user_id, "webapp_task_complete", {
        attempt_id: attemptId,
        result: roll.result,
        play_mode: mode.key,
        combo
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

      const outcome = economyEngine.computeRevealOutcome(runtimeConfig, {
        attemptResult: attempt.result,
        difficulty,
        streak: Number(profile.current_streak || 0),
        kingdomTier: Number(profile.kingdom_tier || 0),
        risk,
        dailyTasks: Number(dailyRaw.tasks_done || 0),
        pityBefore
      });

      const modeAdjustedReward = applyPlayModeToReward(outcome.reward, playMode);
      const boostedReward = shopStore.applyEffectsToReward(modeAdjustedReward, activeEffects);
      const comboAdjusted = applyComboToReward(boostedReward, combo);
      const hiddenBonus = hiddenBonusForAttempt(attemptId, playMode.key, attempt.result);
      const reward = hiddenBonus.hit ? mergeRewards(comboAdjusted.reward, hiddenBonus.bonus) : comboAdjusted.reward;
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

      const season = seasonStore.getSeasonInfo(runtimeConfig);
      const baseSeasonPoints = Number(reward.rc || 0) + Number(reward.sc || 0) + Number(reward.hc || 0) * 10;
      const seasonBonus = shopStore.getSeasonBonusMultiplier(activeEffects);
      const seasonPoints = Math.max(0, Math.round(baseSeasonPoints * (1 + seasonBonus)));
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
        season_points: seasonPoints
      });

      const warDelta = Math.max(
        1,
        Number(reward.rc || 0) + Math.floor(Number(reward.sc || 0) / 5) + Number(reward.hc || 0) * 2
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

      const runtimeConfig = await configService.getEconomyConfig(client);
      const balances = await economyStore.getBalances(client, profile.user_id);
      const token = await buildTokenSummary(client, profile, runtimeConfig, balances);
      await client.query("COMMIT");
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: {
          request: {
            id: Number(updated.id),
            status: updated.status,
            tx_hash: updated.tx_hash
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
    reply.send({
      success: true,
      session: issueWebAppSession(auth.uid),
      data: summary
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

fastify.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`Admin API listening on ${address}`);
});
