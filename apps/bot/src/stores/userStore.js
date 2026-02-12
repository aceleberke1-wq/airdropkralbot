async function upsertUser(db, { telegramId, locale, timezone }) {
  const result = await db.query(
    `INSERT INTO users (telegram_id, locale, timezone, status, last_seen_at)
     VALUES ($1, $2, $3, 'active', now())
     ON CONFLICT (telegram_id)
     DO UPDATE SET locale = EXCLUDED.locale,
                   timezone = EXCLUDED.timezone,
                   last_seen_at = now()
     RETURNING id, telegram_id;`,
    [telegramId, locale, timezone]
  );
  return result.rows[0];
}

async function upsertIdentity(db, { userId, publicName }) {
  const result = await db.query(
    `INSERT INTO identities (user_id, public_name)
     VALUES ($1, $2)
     ON CONFLICT (user_id)
     DO UPDATE SET public_name = EXCLUDED.public_name,
                   updated_at = now()
     RETURNING user_id, public_name, kingdom_tier, reputation_score, prestige_level, season_rank;`,
    [userId, publicName]
  );
  return result.rows[0];
}

async function ensureStreak(db, { userId }) {
  await db.query(
    `INSERT INTO streaks (user_id, current_streak, best_streak, last_action_at, grace_until)
     VALUES ($1, 0, 0, now(), now() + interval '6 hours')
     ON CONFLICT (user_id) DO NOTHING;`,
    [userId]
  );
}

function computeNextStreak({ currentStreak, lastActionAt, now = new Date(), decayPerDay = 1 }) {
  const current = Number(currentStreak || 0);
  const decay = Math.max(0, Number(decayPerDay || 1));
  if (!lastActionAt) {
    return 1;
  }

  const last = new Date(lastActionAt);
  const lastDay = Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate());
  const nowDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const diffDays = Math.floor((nowDay - lastDay) / 86400000);

  if (diffDays <= 0) {
    return current;
  }
  if (diffDays === 1) {
    return current + 1;
  }

  const missedDays = diffDays - 1;
  const decayed = Math.max(0, current - missedDays * decay);
  return decayed + 1;
}

async function getProfileByTelegramId(db, telegramId) {
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
       COALESCE(s.best_streak, 0) AS best_streak,
       s.grace_until
     FROM users u
     JOIN identities i ON i.user_id = u.id
     LEFT JOIN streaks s ON s.user_id = u.id
     WHERE u.telegram_id = $1;`,
    [telegramId]
  );
  return result.rows[0] || null;
}

async function touchStreakOnAction(db, { userId, decayPerDay = 1 }) {
  const locked = await db.query(
    `SELECT current_streak, best_streak, last_action_at
     FROM streaks
     WHERE user_id = $1
     FOR UPDATE;`,
    [userId]
  );

  if (locked.rows.length === 0) {
    const inserted = await db.query(
      `INSERT INTO streaks (user_id, current_streak, best_streak, last_action_at, grace_until)
       VALUES ($1, 1, 1, now(), now() + interval '6 hours')
       RETURNING current_streak, best_streak, grace_until;`,
      [userId]
    );
    return inserted.rows[0];
  }

  const row = locked.rows[0];
  const last = row.last_action_at ? new Date(row.last_action_at) : null;
  const now = new Date();
  const nextStreak = computeNextStreak({
    currentStreak: row.current_streak,
    lastActionAt: last,
    now,
    decayPerDay
  });

  const bestStreak = Math.max(Number(row.best_streak || 0), nextStreak);
  const updated = await db.query(
    `UPDATE streaks
     SET current_streak = $2,
         best_streak = $3,
         last_action_at = now(),
         grace_until = now() + interval '6 hours'
     WHERE user_id = $1
     RETURNING current_streak, best_streak, grace_until;`,
    [userId, nextStreak, bestStreak]
  );
  return updated.rows[0];
}

function tierFromReputation(score, thresholds) {
  const safeScore = Number(score || 0);
  const list = Array.isArray(thresholds) && thresholds.length > 0 ? thresholds : [0, 1500, 5000, 15000, 40000];
  let tier = 0;
  for (let i = 0; i < list.length; i += 1) {
    if (safeScore >= Number(list[i] || 0)) {
      tier = i;
    }
  }
  return tier;
}

async function addReputation(db, { userId, points, thresholds }) {
  const delta = Number(points || 0);
  if (delta <= 0) {
    const existing = await db.query(
      `SELECT reputation_score, kingdom_tier
       FROM identities
       WHERE user_id = $1;`,
      [userId]
    );
    return existing.rows[0];
  }

  const updatedRep = await db.query(
    `UPDATE identities
     SET reputation_score = reputation_score + $2,
         updated_at = now()
     WHERE user_id = $1
     RETURNING reputation_score, kingdom_tier;`,
    [userId, delta]
  );

  const current = updatedRep.rows[0];
  const nextTier = tierFromReputation(Number(current.reputation_score || 0), thresholds);
  if (nextTier !== Number(current.kingdom_tier || 0)) {
    await db.query(
      `UPDATE identities
       SET kingdom_tier = $2,
           updated_at = now()
       WHERE user_id = $1;`,
      [userId, nextTier]
    );
    await db.query(
      `INSERT INTO kingdom_history (user_id, from_tier, to_tier, reason)
       VALUES ($1, $2, $3, $4);`,
      [userId, current.kingdom_tier, nextTier, "reputation_threshold"]
    );
    current.kingdom_tier = nextTier;
  }
  return current;
}

async function getKingdomHistory(db, userId, limit = 5) {
  const safeLimit = Math.max(1, Math.min(20, Number(limit || 5)));
  const result = await db.query(
    `SELECT from_tier, to_tier, reason, created_at
     FROM kingdom_history
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2;`,
    [userId, safeLimit]
  );
  return result.rows;
}

module.exports = {
  upsertUser,
  upsertIdentity,
  ensureStreak,
  computeNextStreak,
  getProfileByTelegramId,
  touchStreakOnAction,
  addReputation,
  getKingdomHistory
};
