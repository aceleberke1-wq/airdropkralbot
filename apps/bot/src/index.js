const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { Telegraf, Markup } = require("telegraf");
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
const taskCatalog = require("./taskCatalog");
const messages = require("./messages");
const configService = require("./services/configService");
const economyEngine = require("./services/economyEngine");
const antiAbuseEngine = require("./services/antiAbuseEngine");
const arenaEngine = require("./services/arenaEngine");
const arenaService = require("./services/arenaService");
const tokenEngine = require("./services/tokenEngine");
const txVerifier = require("./services/txVerifier");

const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

function requireEnv(name, opts = {}) {
  const value = process.env[name];
  if (!value && !opts.optional) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function loadConfig() {
  const dryRun = process.env.BOT_DRY_RUN === "1";
  const botToken = dryRun ? process.env.BOT_TOKEN || "" : requireEnv("BOT_TOKEN");
  const adminIdRaw = requireEnv("ADMIN_TELEGRAM_ID");
  const adminTelegramId = Number(adminIdRaw);
  if (Number.isNaN(adminTelegramId)) {
    throw new Error("ADMIN_TELEGRAM_ID must be a number");
  }

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
  const webappHmacSecret = requireEnv("WEBAPP_HMAC_SECRET", { optional: true }) || "";
  const botUsername = requireEnv("BOT_USERNAME", { optional: true }) || "airdropkral_2026_bot";
  const tokenTxVerifyEnabled = process.env.TOKEN_TX_VERIFY === "1";
  const tokenTxVerifyStrict = process.env.TOKEN_TX_VERIFY_STRICT === "1";
  const botInstanceLockKey = Number(process.env.BOT_INSTANCE_LOCK_KEY || 7262026);

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
    webappHmacSecret,
    botUsername,
    tokenTxVerifyEnabled,
    tokenTxVerifyStrict,
    botInstanceLockKey
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function buildSignedWebAppUrl(appConfig, telegramId) {
  if (!appConfig.webappPublicUrl || !appConfig.webappHmacSecret) {
    return null;
  }
  try {
    const url = new URL(appConfig.webappPublicUrl);
    const ts = Date.now().toString();
    const uid = String(telegramId);
    const sig = signWebAppPayload(uid, ts, appConfig.webappHmacSecret);
    url.searchParams.set("uid", uid);
    url.searchParams.set("ts", ts);
    url.searchParams.set("sig", sig);
    url.searchParams.set("bot", String(appConfig.botUsername || "airdropkral_2026_bot"));
    return url.toString();
  } catch (err) {
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

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function isAdminCtx(ctx, appConfig) {
  return Number(ctx.from?.id || 0) === Number(appConfig.adminTelegramId || 0);
}

async function ensureAdminCtx(ctx, appConfig) {
  if (isAdminCtx(ctx, appConfig)) {
    return true;
  }
  await ctx.replyWithMarkdown("*Admin Yetkisi Gerekli*\nBu komut sadece admin hesap icin aciktir.");
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

async function acquireInstanceLock(pool, lockKey) {
  const client = await pool.connect();
  try {
    const key = Number(lockKey || 0);
    if (!Number.isFinite(key) || key <= 0) {
      client.release();
      return { acquired: false, client: null, reason: "invalid_lock_key" };
    }
    const lockRes = await client.query("SELECT pg_try_advisory_lock($1) AS acquired;", [key]);
    const acquired = Boolean(lockRes.rows?.[0]?.acquired);
    if (!acquired) {
      client.release();
      return { acquired: false, client: null, reason: "lock_not_acquired" };
    }
    return { acquired: true, client, key };
  } catch (err) {
    try {
      client.release();
    } catch {}
    throw err;
  }
}

async function releaseInstanceLock(lock) {
  if (!lock?.client || !lock?.acquired || !lock?.key) {
    return;
  }
  try {
    await lock.client.query("SELECT pg_advisory_unlock($1);", [lock.key]);
  } catch {}
  try {
    lock.client.release();
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

function buildTaskKeyboard(offers) {
  const buttons = offers.map((offer, index) => Markup.button.callback(`Gorev ${index + 1}`, `TASK_ACCEPT:${offer.id}`));
  const rows = [];
  for (let i = 0; i < buttons.length; i += 3) {
    rows.push(buttons.slice(i, i + 3));
  }
  rows.push([
    Markup.button.callback("Panel Yenile (1 RC)", "REROLL_TASKS"),
    Markup.button.callback("Gunluk", "OPEN_DAILY")
  ]);
  return Markup.inlineKeyboard(rows);
}

function buildStartKeyboard() {
  return Markup.inlineKeyboard(
    [
      Markup.button.callback("Gorevleri Ac", "OPEN_TASKS"),
      Markup.button.callback("Cuzdani Goster", "OPEN_WALLET"),
      Markup.button.callback("Sezon", "OPEN_SEASON"),
      Markup.button.callback("Dukkan", "OPEN_SHOP"),
      Markup.button.callback("Misyonlar", "OPEN_MISSIONS"),
      Markup.button.callback("Gunluk", "OPEN_DAILY"),
      Markup.button.callback("Kingdom", "OPEN_KINGDOM"),
      Markup.button.callback("Arena 3D", "OPEN_PLAY"),
      Markup.button.callback("Arena Raid", "OPEN_ARENA_RANK"),
      Markup.button.callback("Token", "OPEN_TOKEN"),
      Markup.button.callback("War Room", "OPEN_WAR"),
      Markup.button.callback("Cekim", "OPEN_PAYOUT"),
      Markup.button.callback("Durum", "OPEN_STATUS")
    ],
    { columns: 2 }
  );
}

function buildCompleteKeyboard(attemptId) {
  return Markup.inlineKeyboard(
    [
      Markup.button.callback("Temkinli Bitir", `TASK_COMPLETE:${attemptId}:safe`),
      Markup.button.callback("Dengeli Bitir", `TASK_COMPLETE:${attemptId}:balanced`),
      Markup.button.callback("Saldirgan Bitir", `TASK_COMPLETE:${attemptId}:aggressive`)
    ],
    { columns: 1 }
  );
}

function buildRevealKeyboard(attemptId) {
  return Markup.inlineKeyboard([Markup.button.callback("Reveal", `REVEAL:${attemptId}`)]);
}

function buildPostRevealKeyboard() {
  return Markup.inlineKeyboard(
    [
      Markup.button.callback("Yeni Gorev", "OPEN_TASKS"),
      Markup.button.callback("Cuzdan", "OPEN_WALLET"),
      Markup.button.callback("Token", "OPEN_TOKEN"),
      Markup.button.callback("Liderlik", "OPEN_LEADERBOARD"),
      Markup.button.callback("Dukkan", "OPEN_SHOP"),
      Markup.button.callback("Misyonlar", "OPEN_MISSIONS")
    ],
    { columns: 2 }
  );
}

function buildShopKeyboard(offers) {
  const buttons = offers.map((offer, index) =>
    Markup.button.callback(`Satin Al ${index + 1}`, `BUY_OFFER:${offer.id}`)
  );
  return Markup.inlineKeyboard(buttons, { columns: 2 });
}

function buildMissionKeyboard(board) {
  const buttons = (board || [])
    .filter((mission) => mission.completed && !mission.claimed)
    .map((mission) => Markup.button.callback(`Odulu Al: ${mission.title}`, `CLAIM_MISSION:${mission.key}`));

  if (buttons.length === 0) {
    return undefined;
  }
  return Markup.inlineKeyboard(buttons, { columns: 1 });
}

function buildPayoutKeyboard(canRequest) {
  const buttons = [];
  if (canRequest) {
    buttons.push(Markup.button.callback("BTC Cekim Talebi", "REQ_PAYOUT:BTC"));
  }
  buttons.push(Markup.button.callback("Durumu Yenile", "OPEN_PAYOUT"));
  return Markup.inlineKeyboard(buttons, { columns: 1 });
}

function buildTokenKeyboard() {
  return Markup.inlineKeyboard(
    [
      [
        Markup.button.callback("Token Durumu", "OPEN_TOKEN"),
        Markup.button.callback("Token Mint (Max)", "TOKEN_MINT")
      ],
      [Markup.button.callback("Satinalma Talep Ornegi", "TOKEN_BUY_SAMPLE")],
      [Markup.button.callback("Bot Paneline Don", "OPEN_TASKS")]
    ],
    { columns: 1 }
  );
}

function buildPlayKeyboard(url) {
  const isHttps = /^https:\/\//i.test(String(url || ""));
  const canUseWebAppButton = isHttps && typeof Markup.button.webApp === "function";
  const openButton = canUseWebAppButton
    ? Markup.button.webApp("Arena 3D Ac", url)
    : Markup.button.url("Arena 3D Ac", url);
  return Markup.inlineKeyboard(
    [
      [openButton],
      [Markup.button.url("Tarayici ile Ac", url)],
      [Markup.button.callback("Bot Paneline Don", "OPEN_TASKS")]
    ],
    { columns: 1 }
  );
}

function buildRaidKeyboard() {
  return Markup.inlineKeyboard(
    [
      Markup.button.callback("Raid Temkinli", "ARENA_RAID:safe"),
      Markup.button.callback("Raid Dengeli", "ARENA_RAID:balanced"),
      Markup.button.callback("Raid Saldirgan", "ARENA_RAID:aggressive"),
      Markup.button.callback("Arena Siralama", "OPEN_ARENA_RANK"),
      Markup.button.callback("Arena 3D", "OPEN_PLAY")
    ],
    { columns: 1 }
  );
}

function buildAdminKeyboard(snapshot = {}) {
  const payoutButtons = (snapshot.pendingPayouts || [])
    .slice(0, 3)
    .map((row) => [Markup.button.callback(`Payout #${row.id}`, `ADMIN_PAYOUT_PICK:${row.id}`)]);
  const tokenButtons = (snapshot.pendingTokenRequests || [])
    .slice(0, 3)
    .map((row) => [Markup.button.callback(`Token #${row.id}`, `ADMIN_TOKEN_PICK:${row.id}`)]);

  const freezeToggle = snapshot.freeze?.freeze
    ? Markup.button.callback("Freeze Kapat", "ADMIN_FREEZE_OFF")
    : Markup.button.callback("Freeze Ac", "ADMIN_FREEZE_ON");

  return Markup.inlineKeyboard(
    [
      [Markup.button.callback("Yenile", "ADMIN_PANEL_REFRESH"), freezeToggle],
      [Markup.button.callback("Payout Queue", "ADMIN_OPEN_PAYOUTS"), Markup.button.callback("Token Queue", "ADMIN_OPEN_TOKENS")],
      ...payoutButtons,
      ...tokenButtons
    ],
    { columns: 1 }
  );
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

async function getSnapshot(pool, ctx) {
  return withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    const balances = await economyStore.getBalances(db, profile.user_id);
    const dailyRaw = await economyStore.getTodayCounter(db, profile.user_id);
    const runtimeConfig = await configService.getEconomyConfig(db);
    const dailyCap = economyEngine.getDailyCap(runtimeConfig, profile.kingdom_tier);
    return {
      profile,
      balances,
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
    return { profile, offers };
  });

  if (payload.freeze) {
    await ctx.replyWithMarkdown(messages.formatFreezeMessage(payload.freeze.reason));
    return;
  }
  const taskMap = new Map(taskCatalog.getCatalog().map((task) => [task.id, task]));
  await ctx.replyWithMarkdown(messages.formatTasks(payload.offers, taskMap), buildTaskKeyboard(payload.offers));
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
  await riskStore.insertBehaviorEvent(db, profile.user_id, "task_reroll", {
    rc_cost: rerollCost
  });
  return { ok: true, offers };
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
  await ctx.replyWithMarkdown(messages.formatTasks(payload.offers, taskMap), buildTaskKeyboard(payload.offers));
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
  await ctx.replyWithMarkdown(messages.formatTaskStarted(payload.task, payload.profile.current_streak), buildCompleteKeyboard(payload.attempt.id));
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
        combo: computeCombo(recentResults)
      };
    }

    const offer = await taskStore.getOffer(db, profile.user_id, lockedAttempt.task_offer_id);
    const task = taskCatalog.getTaskById(offer?.task_type || "") || { difficulty: Number(offer?.difficulty || 0.4) };
    const baseDifficulty = Number(task.difficulty || offer?.difficulty || 0.4);
    const safeDifficulty = economyEngine.clamp(baseDifficulty + mode.difficultyDelta, 0, 1);
    const risk = appConfig.loopV2Enabled ? (await riskStore.getRiskState(db, profile.user_id)).riskScore : 0;
    let roll;
    let probabilities;
    if (appConfig.loopV2Enabled) {
      probabilities = economyEngine.getTaskProbabilities(runtimeConfig, {
        difficulty: safeDifficulty,
        streak: Number(profile.current_streak || 0),
        risk
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

    const completed = await taskStore.completeAttemptIfPending(db, attemptId, roll.result, qualityScore, {
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
      const current = await taskStore.getAttempt(db, profile.user_id, attemptId);
      const recentResults = await taskStore.getRecentAttemptResults(db, profile.user_id, 6);
      return {
        duplicate: true,
        result: current?.result || "pending",
        probabilities,
        attemptId,
        modeLabel: mode.label,
        combo: computeCombo(recentResults)
      };
    }

    await taskStore.markOfferConsumed(db, lockedAttempt.task_offer_id);
    await economyStore.incrementDailyTasks(db, profile.user_id, 1);

    const recentResults = await taskStore.getRecentAttemptResults(db, profile.user_id, 6);
    const combo = computeCombo(recentResults);

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
      combo
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
      combo: payload.combo
    })
  );
  await delay(350);
  await ctx.replyWithMarkdown("*Isleniyor...*");
  await delay(400);
  await ctx.replyWithMarkdown("Reveal hazir.", buildRevealKeyboard(attemptId));

  logEvent("task_complete", {
    attempt_id: attemptId,
    result: payload.result,
    duplicate: payload.duplicate
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

async function handleReveal(ctx, pool, appConfig) {
  const attemptId = Number(ctx.match[1]);
  if (!attemptId) return;

  await ctx.answerCbQuery();
  const preConfig = await withTransaction(pool, (db) => configService.getEconomyConfig(db));
  await playRevealAnimation(ctx, preConfig.loops?.micro?.reveal_pace_ms);

  const payload = await withTransaction(pool, async (db) => {
    const runtimeConfig = await configService.getEconomyConfig(db);
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
        existing: true
      };
    }

    const offer = await taskStore.getOffer(db, profile.user_id, attempt.task_offer_id);
    const difficulty = Number(offer?.difficulty || 0.4);
    const dailyRaw = await economyStore.getTodayCounter(db, profile.user_id);
    const activeEffects = await shopStore.getActiveEffects(db, profile.user_id);
    const playMode = getPlayMode(attempt.anti_abuse_flags?.play_mode || "balanced");
    const recentTiers = await taskStore.getRecentLootTiers(db, profile.user_id, Number(runtimeConfig.economy?.hc?.pity_cap || 40));
    const recentResults = await taskStore.getRecentAttemptResults(db, profile.user_id, 12);
    const combo = computeCombo(recentResults);
    const pityBefore = calculatePityBefore(recentTiers);
    const risk = appConfig.loopV2Enabled ? (await riskStore.getRiskState(db, profile.user_id)).riskScore : 0;

    const outcome = appConfig.loopV2Enabled
      ? economyEngine.computeRevealOutcome(runtimeConfig, {
          attemptResult: attempt.result,
          difficulty,
          streak: Number(profile.current_streak || 0),
          kingdomTier: Number(profile.kingdom_tier || 0),
          risk,
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
    const reward = hiddenBonus.hit ? mergeRewards(comboAdjusted.reward, hiddenBonus.bonus) : comboAdjusted.reward;
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

    const season = seasonStore.getSeasonInfo(runtimeConfig);
    const baseSeasonPoints = Number(reward.rc || 0) + Number(reward.sc || 0) + Number(reward.hc || 0) * 10;
    const seasonBonus = shopStore.getSeasonBonusMultiplier(activeEffects);
    const seasonPoints = Math.max(0, Math.round(baseSeasonPoints * (1 + seasonBonus)));
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
      season_points: seasonPoints
    });

    const warDelta = Math.max(
      1,
      Number(reward.rc || 0) + Math.floor(Number(reward.sc || 0) / 5) + Number(reward.hc || 0) * 2
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
        warPool: Number(payload.warPool || 0)
      }
    ),
    buildPostRevealKeyboard()
  );

  logEvent("reveal", {
    attempt_id: attemptId,
    tier: payload.loot.loot_tier,
    existing: payload.existing,
    reward: payload.reward,
    season_points: payload.seasonPoints || 0,
    combo: payload.combo || 0,
    mode: payload.modeLabel || "Dengeli",
    war_delta: payload.warDelta || 0
  });
}

async function sendWallet(ctx, pool) {
  const snapshot = await getSnapshot(pool, ctx);
  await ctx.replyWithMarkdown(messages.formatWallet(snapshot.profile, snapshot.balances, snapshot.daily));
}

async function sendSeason(ctx, pool) {
  const payload = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    const runtimeConfig = await configService.getEconomyConfig(db);
    const season = seasonStore.getSeasonInfo(runtimeConfig);
    const stat = await seasonStore.getSeasonStat(db, { userId: profile.user_id, seasonId: season.seasonId });
    const rank = await seasonStore.getUserRank(db, { userId: profile.user_id, seasonId: season.seasonId });
    return { season, stat, rank };
  });
  await ctx.replyWithMarkdown(messages.formatSeason(payload.season, payload.stat, payload.rank));
}

async function sendLeaderboard(ctx, pool) {
  const payload = await withTransaction(pool, async (db) => {
    await ensureProfileTx(db, ctx);
    const runtimeConfig = await configService.getEconomyConfig(db);
    const season = seasonStore.getSeasonInfo(runtimeConfig);
    const rows = await seasonStore.getLeaderboard(db, { seasonId: season.seasonId, limit: 10 });
    return { season, rows };
  });
  await ctx.replyWithMarkdown(messages.formatLeaderboard(payload.season, payload.rows));
}

async function sendShop(ctx, pool) {
  const payload = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    await shopStore.ensureDefaultOffers(db);
    const offers = await shopStore.listActiveOffers(db, 8);
    const balances = await economyStore.getBalances(db, profile.user_id);
    const effects = await shopStore.getActiveEffects(db, profile.user_id);
    return { offers, balances, effects };
  });
  await ctx.replyWithMarkdown(
    messages.formatShop(payload.offers, payload.balances, payload.effects),
    buildShopKeyboard(payload.offers)
  );
}

async function sendMissions(ctx, pool) {
  const payload = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    const board = await missionStore.getMissionBoard(db, profile.user_id);
    return { board };
  });
  await ctx.replyWithMarkdown(messages.formatMissions(payload.board), buildMissionKeyboard(payload.board));
}

async function sendDaily(ctx, pool) {
  const payload = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    const balances = await economyStore.getBalances(db, profile.user_id);
    const dailyRaw = await economyStore.getTodayCounter(db, profile.user_id);
    const runtimeConfig = await configService.getEconomyConfig(db);
    const board = await missionStore.getMissionBoard(db, profile.user_id);
    const daily = buildDailyView(runtimeConfig, profile, dailyRaw);
    return { profile, balances, daily, board };
  });
  await ctx.replyWithMarkdown(messages.formatDaily(payload.profile, payload.daily, payload.board, payload.balances), buildMissionKeyboard(payload.board));
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
  const latest = await payoutStore.getLatestRequest(db, profile.user_id, "BTC");
  const active = await payoutStore.getActiveRequest(db, profile.user_id, "BTC");
  const cooldown = await payoutStore.getCooldownRequest(db, profile.user_id, "BTC");
  const canRequest =
    entitledBtc >= Number(appConfig.payoutThresholdBtc || 0.0001) &&
    marketCapGate.allowed &&
    !active &&
    !cooldown;

  let latestWithTx = latest;
  if (latest) {
    latestWithTx = await payoutStore.getRequestWithTx(db, latest.id);
  }

  return {
    entitledBtc,
    thresholdBtc: Number(appConfig.payoutThresholdBtc || 0.0001),
    cooldownUntil: cooldown?.cooldown_until || null,
    canRequest,
    marketCapGate,
    latest: latestWithTx
  };
}

async function sendPayout(ctx, pool, appConfig) {
  const payload = await withTransaction(pool, async (db) => {
    const profile = await ensureProfileTx(db, ctx);
    const runtimeConfig = await configService.getEconomyConfig(db);
    const view = await buildPayoutView(db, profile, appConfig, runtimeConfig);
    return { view };
  });
  await ctx.replyWithMarkdown(messages.formatPayout(payload.view), buildPayoutKeyboard(payload.view.canRequest));
}

async function sendAdminPanel(ctx, pool, appConfig) {
  if (!(await ensureAdminCtx(ctx, appConfig))) {
    return;
  }
  const snapshot = await withTransaction(pool, async (db) => buildAdminSnapshot(db, appConfig));
  await ctx.replyWithMarkdown(messages.formatAdminPanel(snapshot, true), buildAdminKeyboard(snapshot));
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
  await ctx.replyWithMarkdown(`*Payout Queue*\n${lines}`);
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
  await ctx.replyWithMarkdown(`*Token Queue*\n${lines}`);
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
  await ctx.replyWithMarkdown(
    `*Admin Config*\n` +
      `Kaynak: *${payload.source}*\n` +
      `Token: *${payload.token.symbol}*\n` +
      `Fiyat: *$${Number(payload.token.usd_price || 0).toFixed(8)}*\n` +
      `Min Buy: *$${Number(payload.token.purchase?.min_usd || 0).toFixed(2)}*\n` +
      `Max Buy: *$${Number(payload.token.purchase?.max_usd || 0).toFixed(2)}*\n` +
      `Payout Gate: *${gate.enabled ? "ON" : "OFF"}*\n` +
      `Gate Min Cap: *$${Math.floor(Number(gate.min_market_cap_usd || 0))}*\n` +
      `Gate Target Max: *$${Math.floor(Number(gate.target_band_max_usd || 0))}*`
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

async function adminSetTokenGate(ctx, pool, appConfig, minRaw, maxRaw) {
  if (!(await ensureAdminCtx(ctx, appConfig))) {
    return;
  }
  const minCap = parseFloatArg(minRaw);
  const maxCap = parseFloatArg(maxRaw);
  if (!minCap || minCap <= 0) {
    await ctx.replyWithMarkdown("*Admin Token Gate*\nKullanim: `/admin_token_gate 10000000 20000000`", {
      parse_mode: "Markdown"
    });
    return;
  }
  const targetMax = maxCap && maxCap >= minCap ? maxCap : minCap * 2;
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
        next.token.payout_gate.enabled = true;
        next.token.payout_gate.min_market_cap_usd = Number(minCap);
        next.token.payout_gate.target_band_max_usd = Number(targetMax);
      },
      "config_token_gate_update",
      {
        min_market_cap_usd: Number(minCap),
        target_band_max_usd: Number(targetMax)
      }
    )
  );
  await ctx.replyWithMarkdown(
    messages.formatAdminActionResult(
      "Token Gate",
      `Gate guncellendi: min $${Math.floor(minCap)} / target $${Math.floor(targetMax)} (v${payload.version})`
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

async function submitTokenTx(ctx, pool, requestIdRaw, txHashRaw) {
  const requestId = Number(requestIdRaw || 0);
  const txHash = normalizeTxHash(txHashRaw);
  if (!requestId || !txHash || txHash.length < 24) {
    await ctx.replyWithMarkdown("*Token TX Hatasi*\nKullanim: `/tx <requestId> <txHash>`", {
      parse_mode: "Markdown"
    });
    return;
  }

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
        enabled: Boolean(appConfig.tokenTxVerifyEnabled)
      });
      if (
        appConfig.tokenTxVerifyStrict &&
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
        tx_hash: formatCheck.normalizedHash.slice(0, 18)
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
    await ctx.replyWithMarkdown(messages.formatAdminActionResult("Token Approve", `Basarisiz: ${result.reason}`));
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
    const sourceHcAmount = Number((view.entitledBtc / fxRate).toFixed(8));
    if (sourceHcAmount <= 0) {
      return { ok: false, reason: "no_hc_balance", view };
    }
    const amount = Number(view.entitledBtc.toFixed(8));
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

    const nextView = await buildPayoutView(db, profile, appConfig, runtimeConfig);
    return { ok: true, request, view: nextView };
  });

  await ctx.answerCbQuery();
  if (!payload.ok) {
    if (payload.reason === "freeze_mode") {
      await ctx.replyWithMarkdown(messages.formatFreezeMessage("Bakim aktif, payout talebi kapali."));
    }
    await ctx.replyWithMarkdown(messages.formatPayout(payload.view), buildPayoutKeyboard(payload.view.canRequest));
    return;
  }

  await ctx.replyWithMarkdown(
    `*Cekim Talebi Alindi*\nTalep #${payload.request.id}\nMiktar: *${Number(payload.request.amount).toFixed(8)} BTC*\nDurum: *requested*`
  );
  await ctx.replyWithMarkdown(messages.formatPayout(payload.view), buildPayoutKeyboard(payload.view.canRequest));
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
    const war = await globalStore.getWarStatus(db, season.seasonId);
    const missions = await missionStore.getMissionBoard(db, profile.user_id);
    const payout = await buildPayoutView(db, profile, appConfig, runtimeConfig);
    const openMissions = missions.filter((m) => !m.claimed).length;
    const readyMissions = missions.filter((m) => m.completed && !m.claimed).length;
    const risk = await riskStore.getRiskState(db, profile.user_id);
    const tokenView = await buildTokenView(db, profile, appConfig);
    return {
      freeze,
      season,
      war,
      payout,
      tokenView,
      openMissions,
      readyMissions,
      risk: risk.riskScore,
      configCache: configService.getConfigCacheStatus()
    };
  });

  await ctx.replyWithMarkdown(
    `*Sistem Durumu*\n` +
      `Loop v2: *${appConfig.loopV2Enabled ? "acik" : "kapali"}*\n` +
      `Freeze: *${payload.freeze.freeze ? "acik" : "kapali"}*\n` +
      `Config Kaynagi: *${payload.configCache.source}*\n` +
      `Sezon: *S${payload.season.seasonId}* (${payload.season.daysLeft} gun)\n` +
      `War Tier: *${payload.war.tier}* (${Math.floor(payload.war.value)})\n` +
      `Misyon: *${payload.readyMissions} hazir / ${payload.openMissions} aktif*\n` +
      `Risk: *${Math.round(payload.risk * 100)}%*\n` +
      `Payout Uygunluk: *${payload.payout.canRequest ? "evet" : "hayir"}*\n` +
      `${payload.tokenView.symbol}: *${Number(payload.tokenView.balance || 0).toFixed(payload.tokenView.tokenConfig.decimals)}*`
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
      }))
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
    await ctx.replyWithMarkdown(`*Arena Hatasi*\n${payload.error}`);
    return;
  }

  if (payload.duplicate) {
    await ctx.replyWithMarkdown("*Raid Tekrari*\nBu raid zaten islenmis.", buildRaidKeyboard());
    return;
  }

  await ctx.replyWithMarkdown(messages.formatArenaRaidResult(payload), buildRaidKeyboard());
}

async function sendPlay(ctx, pool, appConfig) {
  const profile = await ensureProfile(pool, ctx);
  const url = buildSignedWebAppUrl(appConfig, ctx.from?.id);
  if (!url) {
    await ctx.replyWithMarkdown(
      "*Arena 3D Hazir Degil*\nWEBAPP_PUBLIC_URL veya WEBAPP_HMAC_SECRET eksik."
    );
    return;
  }

  await ctx.replyWithMarkdown(
    /^https:\/\//i.test(String(url))
      ? `*Arena 3D*\nKral: *${profile.public_name}*\nCanli UI, animasyon ve gorev panelleri burada.`
      : `*Arena 3D (Local Test)*\nKral: *${profile.public_name}*\nTelegram Mini App butonu HTTPS ister. Local test icin URL butonu ile ac.`,
    buildPlayKeyboard(url)
  );
}

async function handleWebAppAction(ctx, pool, appConfig) {
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

  if (action === "open_tasks") {
    await sendTasks(ctx, pool, appConfig);
    return;
  }
  if (action === "open_daily") {
    await sendDaily(ctx, pool);
    return;
  }
  if (action === "open_kingdom") {
    await sendKingdom(ctx, pool);
    return;
  }
  if (action === "open_wallet") {
    await sendWallet(ctx, pool);
    return;
  }
  if (action === "open_token") {
    await sendToken(ctx, pool, appConfig);
    return;
  }
  if (action === "open_war") {
    await sendWar(ctx, pool);
    return;
  }
  if (action === "open_missions") {
    await sendMissions(ctx, pool);
    return;
  }
  if (action === "open_status") {
    await sendStatus(ctx, pool, appConfig);
    return;
  }
  if (action === "open_payout") {
    await sendPayout(ctx, pool, appConfig);
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
    await submitTokenTx(ctx, pool, payload.request_id, payload.tx_hash);
    return;
  }
  if (action === "reroll_tasks") {
    const sourceRef = payload.request_id || payload.client_ts || Date.now();
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
    await ctx.replyWithMarkdown(messages.formatTasks(result.offers, taskMap), buildTaskKeyboard(result.offers));
    return;
  }

  await ctx.replyWithMarkdown(`*WebApp Aksiyon Bilinmiyor*\n${action}`);
}

function normalizeModeFromText(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return "balanced";
  if (["temkinli", "safe", "s", "1"].includes(raw)) return "safe";
  if (["dengeli", "balanced", "b", "2"].includes(raw)) return "balanced";
  if (["saldirgan", "aggressive", "a", "3"].includes(raw)) return "aggressive";
  return "balanced";
}

function extractCommandArgs(ctx) {
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

function normalizeIntentText(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/[ıi]/g, "i")
    .replace(/[ğ]/g, "g")
    .replace(/[ü]/g, "u")
    .replace(/[ş]/g, "s")
    .replace(/[ö]/g, "o")
    .replace(/[ç]/g, "c")
    .replace(/\s+/g, " ")
    .trim();
}

function extractModeFromIntentText(input) {
  const normalized = normalizeIntentText(input);
  const tokens = normalized.split(" ").filter(Boolean);
  for (const token of tokens) {
    const mode = normalizeModeFromText(token);
    if (mode !== "balanced" || ["balanced", "dengeli", "2", "b"].includes(token)) {
      return mode;
    }
  }
  return "balanced";
}

function resolveTextIntent(input) {
  const normalized = normalizeIntentText(input);
  if (!normalized || normalized.startsWith("/")) {
    return null;
  }

  if (/^(play|arena|arena3d|arena3|arena 3d|3d arena|arena ui)\b/.test(normalized)) {
    return { action: "play" };
  }
  if (/^(raid|arena raid)\b/.test(normalized)) {
    return { action: "raid", mode: extractModeFromIntentText(normalized) };
  }
  if (/^(finish|bitir|tamamla)\b/.test(normalized)) {
    return { action: "finish", mode: extractModeFromIntentText(normalized) };
  }
  if (/^(reveal|revealnow|loot)\b/.test(normalized)) {
    return { action: "reveal" };
  }
  if (/^(tasks|task|gorev|gorevler)\b/.test(normalized)) {
    return { action: "tasks" };
  }
  if (/^(wallet|cuzdan)\b/.test(normalized)) {
    return { action: "wallet" };
  }
  if (/^(token|jeton)\b/.test(normalized)) {
    return { action: "token" };
  }
  if (/^(mint|donustur|cevir)\b/.test(normalized)) {
    return { action: "mint" };
  }
  if (/^(buytoken|tokencik|token al)\b/.test(normalized)) {
    return { action: "buytoken" };
  }
  if (/^(daily|gunluk)\b/.test(normalized)) {
    return { action: "daily" };
  }
  if (/^(missions|misyon|misyonlar)\b/.test(normalized)) {
    return { action: "missions" };
  }
  if (/^(status|durum)\b/.test(normalized)) {
    return { action: "status" };
  }

  return null;
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

async function handleTextIntent(ctx, pool, appConfig) {
  const text = String(ctx.message?.text || "").trim();
  const intent = resolveTextIntent(text);
  if (!intent) {
    return false;
  }

  if (intent.action === "play") {
    await sendPlay(ctx, pool, appConfig);
    return true;
  }
  if (intent.action === "raid") {
    const synthetic = buildSyntheticCallbackCtx(ctx, [null, intent.mode || "balanced"]);
    await handleArenaRaid(synthetic, pool);
    return true;
  }
  if (intent.action === "finish") {
    await completeLatestAttemptFromCommand(ctx, pool, appConfig, intent.mode || "balanced");
    return true;
  }
  if (intent.action === "reveal") {
    await revealLatestFromCommand(ctx, pool, appConfig);
    return true;
  }
  if (intent.action === "tasks") {
    await sendTasks(ctx, pool, appConfig);
    return true;
  }
  if (intent.action === "wallet") {
    await sendWallet(ctx, pool);
    return true;
  }
  if (intent.action === "token") {
    await sendToken(ctx, pool, appConfig);
    return true;
  }
  if (intent.action === "mint") {
    await mintToken(ctx, pool, appConfig);
    return true;
  }
  if (intent.action === "buytoken") {
    await ctx.replyWithMarkdown(
      "*Token Satin Alma*\nKullanim: `/buytoken <usd> <chain>`\nOrnek: `/buytoken 5 TON`",
      { parse_mode: "Markdown" }
    );
    return true;
  }
  if (intent.action === "daily") {
    await sendDaily(ctx, pool);
    return true;
  }
  if (intent.action === "missions") {
    await sendMissions(ctx, pool);
    return true;
  }
  if (intent.action === "status") {
    await sendStatus(ctx, pool, appConfig);
    return true;
  }

  return false;
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

async function start() {
  const appConfig = loadConfig();
  const pool = createPool({ databaseUrl: appConfig.databaseUrl, ssl: appConfig.databaseSsl });
  let lock = null;

  await ping(pool);
  console.log("Database connection OK");
  logEvent("boot", { loop_v2_enabled: appConfig.loopV2Enabled });

  if (appConfig.dryRun) {
    console.log("BOT_DRY_RUN=1, Telegram baglantisi atlandi.");
    await pool.end();
    return;
  }

  lock = await acquireInstanceLock(pool, appConfig.botInstanceLockKey);
  if (!lock.acquired) {
    console.error(
      "Bot startup skipped: another instance likely running (instance lock not acquired). " +
        "Ayni BOT_TOKEN ile birden fazla polling instance calistirma."
    );
    await pool.end();
    return;
  }

  const bot = new Telegraf(appConfig.botToken);

  bot.start(async (ctx) => {
    const snapshot = await getSnapshot(pool, ctx);
    const freeze = await withTransaction(pool, (db) => systemStore.getFreezeState(db));
    if (freeze.freeze) {
      await ctx.replyWithMarkdown(messages.formatFreezeMessage(freeze.reason));
      return;
    }
    const season = await withTransaction(pool, async (db) => {
      const runtimeConfig = await configService.getEconomyConfig(db);
      return seasonStore.getSeasonInfo(runtimeConfig);
    });
    await ctx.replyWithMarkdown(messages.formatStart(snapshot.profile, snapshot.balances, season), buildStartKeyboard());
  });

  bot.command("profile", async (ctx) => {
    const snapshot = await getSnapshot(pool, ctx);
    await ctx.replyWithMarkdown(messages.formatProfile(snapshot.profile, snapshot.balances));
  });

  bot.command("tasks", async (ctx) => {
    await sendTasks(ctx, pool, appConfig);
  });

  bot.command("gorev", async (ctx) => {
    await sendTasks(ctx, pool, appConfig);
  });

  bot.command("task", async (ctx) => {
    await sendTasks(ctx, pool, appConfig);
  });

  bot.command("wallet", async (ctx) => {
    await sendWallet(ctx, pool);
  });

  bot.command("cuzdan", async (ctx) => {
    await sendWallet(ctx, pool);
  });

  bot.command("token", async (ctx) => {
    await sendToken(ctx, pool, appConfig);
  });

  bot.command("mint", async (ctx) => {
    const amount = extractCommandArgs(ctx);
    await mintToken(ctx, pool, appConfig, amount);
  });

  bot.command("buytoken", async (ctx) => {
    const args = parseTokenBuyArgs(extractCommandArgs(ctx));
    if (!args.usdAmount || !args.chain) {
      await ctx.replyWithMarkdown(
        "*Token Satin Alma*\nKullanim: `/buytoken <usd> <chain>`\nOrnek: `/buytoken 5 TON`",
        { parse_mode: "Markdown" }
      );
      return;
    }
    await createTokenBuyIntent(ctx, pool, appConfig, args.usdAmount, args.chain);
  });

  bot.command("tx", async (ctx) => {
    const parts = String(extractCommandArgs(ctx))
      .split(" ")
      .map((x) => x.trim())
      .filter(Boolean);
    await submitTokenTx(ctx, pool, parts[0], parts.slice(1).join(" "));
  });

  bot.command("daily", async (ctx) => {
    await sendDaily(ctx, pool);
  });

  bot.command("gunluk", async (ctx) => {
    await sendDaily(ctx, pool);
  });

  bot.command("kingdom", async (ctx) => {
    await sendKingdom(ctx, pool);
  });

  bot.command("season", async (ctx) => {
    await sendSeason(ctx, pool);
  });

  bot.command("leaderboard", async (ctx) => {
    await sendLeaderboard(ctx, pool);
  });

  bot.command("shop", async (ctx) => {
    await sendShop(ctx, pool);
  });

  bot.command("missions", async (ctx) => {
    await sendMissions(ctx, pool);
  });

  bot.command("misyon", async (ctx) => {
    await sendMissions(ctx, pool);
  });

  bot.command("war", async (ctx) => {
    await sendWar(ctx, pool);
  });

  bot.command("streak", async (ctx) => {
    const profile = await ensureProfile(pool, ctx);
    await ctx.replyWithMarkdown(messages.formatStreak(profile));
  });

  bot.command("payout", async (ctx) => {
    await sendPayout(ctx, pool, appConfig);
  });

  bot.command("status", async (ctx) => {
    await sendStatus(ctx, pool, appConfig);
  });

  bot.command("durum", async (ctx) => {
    await sendStatus(ctx, pool, appConfig);
  });

  bot.command("ops", async (ctx) => {
    await sendOps(ctx, pool);
  });

  bot.command("raid", async (ctx) => {
    const mode = normalizeModeFromText(extractCommandArgs(ctx));
    const synthetic = buildSyntheticCallbackCtx(ctx, [null, mode]);
    await handleArenaRaid(synthetic, pool);
  });

  bot.command("arena_rank", async (ctx) => {
    await sendArenaRank(ctx, pool);
  });

  bot.command("play", async (ctx) => {
    await sendPlay(ctx, pool, appConfig);
  });

  bot.command("arena", async (ctx) => {
    await sendPlay(ctx, pool, appConfig);
  });

  bot.command("arena3d", async (ctx) => {
    await sendPlay(ctx, pool, appConfig);
  });

  bot.command("finish", async (ctx) => {
    const mode = extractCommandArgs(ctx);
    await completeLatestAttemptFromCommand(ctx, pool, appConfig, mode);
  });

  bot.command("bitir", async (ctx) => {
    const mode = extractCommandArgs(ctx);
    await completeLatestAttemptFromCommand(ctx, pool, appConfig, mode);
  });

  bot.command("reveal", async (ctx) => {
    await revealLatestFromCommand(ctx, pool, appConfig);
  });

  bot.command("revealnow", async (ctx) => {
    await revealLatestFromCommand(ctx, pool, appConfig);
  });

  bot.command("help", async (ctx) => {
    await ensureProfile(pool, ctx);
    await ctx.replyWithMarkdown(messages.formatHelp());
  });

  bot.command("whoami", async (ctx) => {
    await ctx.replyWithMarkdown(messages.formatAdminWhoami(ctx.from?.id, appConfig.adminTelegramId));
  });

  bot.command("admin", async (ctx) => {
    await sendAdminPanel(ctx, pool, appConfig);
  });

  bot.command("admin_payouts", async (ctx) => {
    await sendAdminPayoutQueue(ctx, pool, appConfig);
  });

  bot.command("admin_tokens", async (ctx) => {
    await sendAdminTokenQueue(ctx, pool, appConfig);
  });

  bot.command("admin_config", async (ctx) => {
    await sendAdminConfig(ctx, pool, appConfig);
  });

  bot.command("admin_token_price", async (ctx) => {
    await adminSetTokenPrice(ctx, pool, appConfig, extractCommandArgs(ctx));
  });

  bot.command("admin_token_gate", async (ctx) => {
    const parts = parseWords(extractCommandArgs(ctx));
    await adminSetTokenGate(ctx, pool, appConfig, parts[0], parts[1]);
  });

  bot.command("admin_freeze", async (ctx) => {
    if (!(await ensureAdminCtx(ctx, appConfig))) {
      return;
    }
    const parts = parseWords(extractCommandArgs(ctx));
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
    await adminSetFreeze(ctx, pool, appConfig, mode === "on", reason);
  });

  bot.command("pay", async (ctx) => {
    const parts = parseWords(extractCommandArgs(ctx));
    await adminMarkPayoutPaid(ctx, pool, appConfig, parts[0], parts.slice(1).join(" "));
  });

  bot.command("reject_payout", async (ctx) => {
    const parts = parseWords(extractCommandArgs(ctx));
    await adminRejectPayout(ctx, pool, appConfig, parts[0], parts.slice(1).join(" "));
  });

  bot.command("approve_token", async (ctx) => {
    const parts = parseWords(extractCommandArgs(ctx));
    await adminApproveToken(ctx, pool, appConfig, parts[0], parts.slice(1).join(" "));
  });

  bot.command("reject_token", async (ctx) => {
    const parts = parseWords(extractCommandArgs(ctx));
    await adminRejectToken(ctx, pool, appConfig, parts[0], parts.slice(1).join(" "));
  });

  bot.on("message", async (ctx, next) => {
    if (ctx.message?.web_app_data?.data) {
      await handleWebAppAction(ctx, pool, appConfig);
      return;
    }
    if (typeof ctx.message?.text === "string") {
      const handled = await handleTextIntent(ctx, pool, appConfig);
      if (handled) {
        return;
      }
    }
    if (typeof next === "function") {
      await next();
    }
  });

  bot.action("OPEN_TASKS", async (ctx) => {
    await ctx.answerCbQuery();
    await sendTasks(ctx, pool, appConfig);
  });

  bot.action("OPEN_WALLET", async (ctx) => {
    await ctx.answerCbQuery();
    await sendWallet(ctx, pool);
  });

  bot.action("OPEN_TOKEN", async (ctx) => {
    await ctx.answerCbQuery();
    await sendToken(ctx, pool, appConfig);
  });

  bot.action("OPEN_SEASON", async (ctx) => {
    await ctx.answerCbQuery();
    await sendSeason(ctx, pool);
  });

  bot.action("OPEN_LEADERBOARD", async (ctx) => {
    await ctx.answerCbQuery();
    await sendLeaderboard(ctx, pool);
  });

  bot.action("OPEN_SHOP", async (ctx) => {
    await ctx.answerCbQuery();
    await sendShop(ctx, pool);
  });

  bot.action("OPEN_MISSIONS", async (ctx) => {
    await ctx.answerCbQuery();
    await sendMissions(ctx, pool);
  });

  bot.action("OPEN_DAILY", async (ctx) => {
    await ctx.answerCbQuery();
    await sendDaily(ctx, pool);
  });

  bot.action("OPEN_KINGDOM", async (ctx) => {
    await ctx.answerCbQuery();
    await sendKingdom(ctx, pool);
  });

  bot.action("OPEN_WAR", async (ctx) => {
    await ctx.answerCbQuery();
    await sendWar(ctx, pool);
  });

  bot.action("OPEN_PAYOUT", async (ctx) => {
    await ctx.answerCbQuery();
    await sendPayout(ctx, pool, appConfig);
  });

  bot.action("OPEN_STATUS", async (ctx) => {
    await ctx.answerCbQuery();
    await sendStatus(ctx, pool, appConfig);
  });

  bot.action("OPEN_PLAY", async (ctx) => {
    await ctx.answerCbQuery();
    await sendPlay(ctx, pool, appConfig);
  });

  bot.action("OPEN_ARENA_RANK", async (ctx) => {
    await ctx.answerCbQuery();
    await sendArenaRank(ctx, pool);
  });

  bot.action("TOKEN_MINT", async (ctx) => {
    await ctx.answerCbQuery();
    await mintToken(ctx, pool, appConfig);
  });

  bot.action("TOKEN_BUY_SAMPLE", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.replyWithMarkdown(
      "*Token Satin Alma Ornegi*\n`/buytoken 5 TON`\nOdemeden sonra tx gonder:\n`/tx <requestId> <txHash>`",
      { parse_mode: "Markdown" }
    );
  });

  bot.action(/ARENA_RAID:([a-z_]+)/, async (ctx) => {
    await handleArenaRaid(ctx, pool);
  });

  bot.action(/TASK_ACCEPT:(\d+)/, async (ctx) => {
    await handleTaskAccept(ctx, pool, appConfig);
  });

  bot.action(/TASK_COMPLETE:(\d+)(?::([a-z_]+))?/, async (ctx) => {
    await handleTaskComplete(ctx, pool, appConfig);
  });

  bot.action(/REVEAL:(\d+)/, async (ctx) => {
    await handleReveal(ctx, pool, appConfig);
  });

  bot.action(/BUY_OFFER:(\d+)/, async (ctx) => {
    await handleBuyOffer(ctx, pool);
  });

  bot.action(/CLAIM_MISSION:([a-z0-9_]+)/, async (ctx) => {
    await handleClaimMission(ctx, pool);
  });

  bot.action("REROLL_TASKS", async (ctx) => {
    await handleRerollTasks(ctx, pool, appConfig);
  });

  bot.action(/REQ_PAYOUT:([A-Z]+)/, async (ctx) => {
    await handlePayoutRequest(ctx, pool, appConfig);
  });

  bot.action("ADMIN_PANEL_REFRESH", async (ctx) => {
    await ctx.answerCbQuery();
    await sendAdminPanel(ctx, pool, appConfig);
  });

  bot.action("ADMIN_OPEN_PAYOUTS", async (ctx) => {
    await ctx.answerCbQuery();
    await sendAdminPayoutQueue(ctx, pool, appConfig);
  });

  bot.action("ADMIN_OPEN_TOKENS", async (ctx) => {
    await ctx.answerCbQuery();
    await sendAdminTokenQueue(ctx, pool, appConfig);
  });

  bot.action("ADMIN_FREEZE_ON", async (ctx) => {
    await ctx.answerCbQuery();
    await adminSetFreeze(ctx, pool, appConfig, true, "admin_panel");
    await sendAdminPanel(ctx, pool, appConfig);
  });

  bot.action("ADMIN_FREEZE_OFF", async (ctx) => {
    await ctx.answerCbQuery();
    await adminSetFreeze(ctx, pool, appConfig, false, "");
    await sendAdminPanel(ctx, pool, appConfig);
  });

  bot.action(/ADMIN_PAYOUT_PICK:(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!(await ensureAdminCtx(ctx, appConfig))) {
      return;
    }
    const requestId = Number(ctx.match[1] || 0);
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
        `Red icin: \`/reject_payout ${row.id} <sebep>\``,
      { parse_mode: "Markdown" }
    );
  });

  bot.action(/ADMIN_TOKEN_PICK:(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!(await ensureAdminCtx(ctx, appConfig))) {
      return;
    }
    const requestId = Number(ctx.match[1] || 0);
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
        `Onay: \`/approve_token ${row.id}\`\n` +
        `Red: \`/reject_token ${row.id} <sebep>\``,
      { parse_mode: "Markdown" }
    );
  });

  bot.catch((err) => {
    console.error("Bot error", err);
  });

  try {
    await bot.telegram.setMyCommands([
      { command: "start", description: "Kontrol panelini ac" },
      { command: "tasks", description: "Gorev havuzunu goster" },
      { command: "finish", description: "Aktif gorevi bitir (safe/balanced/aggressive)" },
      { command: "reveal", description: "Son biten gorevi ac" },
      { command: "raid", description: "Arena raid baslat" },
      { command: "arena_rank", description: "Arena rating ve siralama" },
      { command: "wallet", description: "Bakiye durumunu goster" },
      { command: "token", description: "Sanal token cuzdani ve talepler" },
      { command: "mint", description: "SC/HC/RC -> token donustur" },
      { command: "buytoken", description: "Token alim talebi olustur" },
      { command: "tx", description: "Token alim tx hash gonder" },
      { command: "daily", description: "Gunluk panel" },
      { command: "missions", description: "Misyon paneli" },
      { command: "shop", description: "Dukkan" },
      { command: "play", description: "Arena 3D web arayuzu" },
      { command: "arena3d", description: "Arena 3D web arayuzu (alias)" },
      { command: "ops", description: "Risk ve event operasyon paneli" },
      { command: "status", description: "Sistem durumu" },
      { command: "whoami", description: "Telegram ID + admin kontrol" },
      { command: "admin", description: "Admin kontrol merkezi (yetkili)" },
      { command: "admin_config", description: "Admin ekonomi/token config ozeti" },
      { command: "help", description: "Komut listesi" }
    ]);
  } catch (err) {
    console.warn("setMyCommands failed", err?.message || err);
  }

  bot.launch();
  console.log("Bot running...");

  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    try {
      bot.stop(signal);
    } catch {}
    try {
      await releaseInstanceLock(lock);
    } catch {}
    try {
      await pool.end();
    } catch {}
  }

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
    console.error(
      "Startup failed: Telegram 409 conflict. Ayni BOT_TOKEN ile birden fazla bot instance calisiyor. Digerini kapatip yeniden baslatin."
    );
    process.exit(1);
    return;
  }
  console.error("Startup failed", err);
  process.exit(1);
});
