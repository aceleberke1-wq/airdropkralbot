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
const configService = require("../../bot/src/services/configService");
const economyEngine = require("../../bot/src/services/economyEngine");
const antiAbuseEngine = require("../../bot/src/services/antiAbuseEngine");
const arenaEngine = require("../../bot/src/services/arenaEngine");
const arenaService = require("../../bot/src/services/arenaService");

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

function normalizeBalances(rows) {
  const balances = { SC: 0, HC: 0, RC: 0 };
  for (const row of rows) {
    const currency = String(row.currency || "").toUpperCase();
    if (Object.prototype.hasOwnProperty.call(balances, currency)) {
      balances[currency] = Number(row.balance || 0);
    }
  }
  return balances;
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

async function buildActionSnapshot(db, profile, runtimeConfig) {
  const balances = await economyStore.getBalances(db, profile.user_id);
  const dailyRaw = await economyStore.getTodayCounter(db, profile.user_id);
  const riskState = await riskStore.getRiskState(db, profile.user_id);
  const live = await readOffersAttemptsEvents(db, profile.user_id);
  return {
    balances,
    daily: buildDailyView(runtimeConfig, profile, dailyRaw),
    risk_score: Number(riskState.riskScore || 0),
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
