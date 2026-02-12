function getSeasonInfo(config, now = new Date()) {
  const seasonDays = Math.max(1, Number(config.loops?.macro?.season_length_days || 56));
  const seasonMs = seasonDays * 86400000;
  const epochMs = Date.UTC(2026, 0, 1, 0, 0, 0);
  const nowMs = now.getTime();
  const offset = Math.max(0, nowMs - epochMs);
  const seasonId = Math.floor(offset / seasonMs) + 1;
  const seasonStartMs = epochMs + (seasonId - 1) * seasonMs;
  const seasonEndMs = seasonStartMs + seasonMs;
  const seasonStart = new Date(seasonStartMs);
  const seasonEnd = new Date(seasonEndMs);
  const daysLeft = Math.max(0, Math.ceil((seasonEndMs - nowMs) / 86400000));
  return { seasonId, seasonStart, seasonEnd, seasonDays, daysLeft };
}

async function addSeasonPoints(db, { userId, seasonId, points }) {
  const delta = Math.max(0, Number(points || 0));
  if (delta <= 0) {
    return;
  }
  await db.query(
    `INSERT INTO season_stats (user_id, season_id, season_points, rank, updated_at)
     VALUES ($1, $2, $3, 0, now())
     ON CONFLICT (user_id, season_id)
     DO UPDATE SET season_points = season_stats.season_points + EXCLUDED.season_points,
                   updated_at = now();`,
    [userId, seasonId, delta]
  );
}

async function getSeasonStat(db, { userId, seasonId }) {
  const result = await db.query(
    `SELECT season_points, rank, updated_at
     FROM season_stats
     WHERE user_id = $1 AND season_id = $2;`,
    [userId, seasonId]
  );
  if (result.rows.length === 0) {
    return { season_points: 0, rank: 0, updated_at: null };
  }
  return result.rows[0];
}

async function getLeaderboard(db, { seasonId, limit = 10 }) {
  const result = await db.query(
    `SELECT
        s.user_id,
        i.public_name,
        s.season_points
     FROM season_stats s
     JOIN identities i ON i.user_id = s.user_id
     WHERE s.season_id = $1
     ORDER BY s.season_points DESC, s.updated_at ASC
     LIMIT $2;`,
    [seasonId, limit]
  );
  return result.rows;
}

async function getUserRank(db, { userId, seasonId }) {
  const result = await db.query(
    `WITH ranked AS (
       SELECT
         user_id,
         ROW_NUMBER() OVER (ORDER BY season_points DESC, updated_at ASC) AS rank
       FROM season_stats
       WHERE season_id = $1
     )
     SELECT rank
     FROM ranked
     WHERE user_id = $2;`,
    [seasonId, userId]
  );
  return result.rows[0] ? Number(result.rows[0].rank || 0) : 0;
}

async function syncIdentitySeasonRank(db, { userId, seasonId }) {
  const rank = await getUserRank(db, { userId, seasonId });
  await db.query(
    `UPDATE identities
     SET season_rank = $2,
         updated_at = now()
     WHERE user_id = $1;`,
    [userId, rank]
  );
  return rank;
}

module.exports = {
  getSeasonInfo,
  addSeasonPoints,
  getSeasonStat,
  getLeaderboard,
  getUserRank,
  syncIdentitySeasonRank
};
