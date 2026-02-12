async function hasArenaTables(db) {
  const result = await db.query(
    `SELECT
        to_regclass('public.arena_state') AS arena_state,
        to_regclass('public.arena_runs') AS arena_runs;`
  );
  const row = result.rows[0] || {};
  return Boolean(row.arena_state && row.arena_runs);
}

async function ensureArenaState(db, userId, baseRating = 1000) {
  const safeBase = Math.max(100, Number(baseRating || 1000));
  await db.query(
    `INSERT INTO arena_state (user_id, rating)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO NOTHING;`,
    [userId, safeBase]
  );
}

async function getArenaState(db, userId, baseRating = 1000) {
  await ensureArenaState(db, userId, baseRating);
  const result = await db.query(
    `SELECT user_id, rating, games_played, wins, losses, last_result, last_play_at, updated_at
     FROM arena_state
     WHERE user_id = $1
     LIMIT 1;`,
    [userId]
  );
  return result.rows[0] || null;
}

async function applyArenaOutcome(db, { userId, ratingDelta, outcome }) {
  const safeDelta = Number(ratingDelta || 0);
  const safeOutcome = String(outcome || "loss");
  const result = await db.query(
    `UPDATE arena_state
     SET rating = GREATEST(0, rating + $2),
         games_played = games_played + 1,
         wins = wins + CASE WHEN $3 = 'win' THEN 1 ELSE 0 END,
         losses = losses + CASE WHEN $3 = 'loss' THEN 1 ELSE 0 END,
         last_result = $3,
         last_play_at = now(),
         updated_at = now()
     WHERE user_id = $1
     RETURNING user_id, rating, games_played, wins, losses, last_result, last_play_at, updated_at;`,
    [userId, safeDelta, safeOutcome]
  );
  return result.rows[0] || null;
}

async function touchArenaCooldown(db, userId) {
  const result = await db.query(
    `UPDATE arena_state
     SET last_play_at = now(),
         updated_at = now()
     WHERE user_id = $1
     RETURNING last_play_at;`,
    [userId]
  );
  return result.rows[0] || null;
}

async function getRunByNonce(db, runNonce) {
  const result = await db.query(
    `SELECT *
     FROM arena_runs
     WHERE run_nonce = $1
     LIMIT 1;`,
    [runNonce]
  );
  return result.rows[0] || null;
}

async function createRun(db, payload) {
  const result = await db.query(
    `INSERT INTO arena_runs (
        run_nonce,
        user_id,
        season_id,
        mode,
        risk_before,
        player_power,
        enemy_power,
        win_probability,
        outcome,
        rating_delta,
        rating_after,
        reward_sc,
        reward_hc,
        reward_rc,
        meta_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
      RETURNING *;`,
    [
      payload.runNonce,
      payload.userId,
      payload.seasonId,
      payload.mode,
      payload.riskBefore,
      payload.playerPower,
      payload.enemyPower,
      payload.winProbability,
      payload.outcome,
      payload.ratingDelta,
      payload.ratingAfter,
      payload.reward.sc,
      payload.reward.hc,
      payload.reward.rc,
      JSON.stringify(payload.meta || {})
    ]
  );
  return result.rows[0] || null;
}

async function createRunIdempotent(db, payload) {
  try {
    return await createRun(db, payload);
  } catch (err) {
    if (err.code !== "23505") {
      throw err;
    }
    return getRunByNonce(db, payload.runNonce);
  }
}

async function getRecentRuns(db, userId, limit = 8) {
  const safeLimit = Math.max(1, Math.min(50, Number(limit || 8)));
  const result = await db.query(
    `SELECT id, mode, outcome, rating_delta, rating_after, reward_sc, reward_hc, reward_rc, created_at
     FROM arena_runs
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2;`,
    [userId, safeLimit]
  );
  return result.rows;
}

async function getLeaderboard(db, seasonId, limit = 10) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit || 10)));
  const result = await db.query(
    `SELECT
        s.user_id,
        i.public_name,
        s.rating,
        s.games_played,
        s.wins,
        s.losses,
        COALESCE(sr.season_points, 0) AS season_points
     FROM arena_state s
     JOIN identities i ON i.user_id = s.user_id
     LEFT JOIN season_stats sr ON sr.user_id = s.user_id AND sr.season_id = $1
     ORDER BY s.rating DESC, s.updated_at ASC
     LIMIT $2;`,
    [seasonId, safeLimit]
  );
  return result.rows;
}

async function getRank(db, userId) {
  const result = await db.query(
    `WITH ranked AS (
       SELECT
         user_id,
         rating,
         rank() OVER (ORDER BY rating DESC, updated_at ASC) AS rank
       FROM arena_state
     )
     SELECT user_id, rating, rank
     FROM ranked
     WHERE user_id = $1
     LIMIT 1;`,
    [userId]
  );
  return result.rows[0] || null;
}

module.exports = {
  hasArenaTables,
  ensureArenaState,
  getArenaState,
  applyArenaOutcome,
  touchArenaCooldown,
  getRunByNonce,
  createRun,
  createRunIdempotent,
  getRecentRuns,
  getLeaderboard,
  getRank
};
