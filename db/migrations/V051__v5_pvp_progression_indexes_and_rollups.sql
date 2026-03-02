-- V5 PvP progression query indexes + materialized rollups.

CREATE INDEX IF NOT EXISTS idx_v5_pvp_daily_user_updated
  ON v5_pvp_progression_daily(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_pvp_weekly_user_updated
  ON v5_pvp_progression_weekly(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_pvp_season_user_updated
  ON v5_pvp_progression_season(user_id, updated_at DESC);

CREATE MATERIALIZED VIEW IF NOT EXISTS v5_pvp_progression_daily_rollup AS
SELECT
  season_id,
  day_key,
  count(*)::BIGINT AS active_users,
  coalesce(sum(duel_wins), 0)::BIGINT AS duel_wins_total,
  coalesce(sum(points_delta), 0)::BIGINT AS points_delta_total,
  max(updated_at) AS last_update_at
FROM v5_pvp_progression_daily
GROUP BY season_id, day_key;

CREATE MATERIALIZED VIEW IF NOT EXISTS v5_pvp_progression_weekly_rollup AS
SELECT
  season_id,
  week_key,
  count(*)::BIGINT AS active_users,
  coalesce(sum(ladder_points), 0)::BIGINT AS ladder_points_total,
  coalesce(sum(milestones_claimed), 0)::BIGINT AS milestones_claimed_total,
  max(updated_at) AS last_update_at
FROM v5_pvp_progression_weekly
GROUP BY season_id, week_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_v5_pvp_daily_rollup_unique
  ON v5_pvp_progression_daily_rollup(season_id, day_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_v5_pvp_weekly_rollup_unique
  ON v5_pvp_progression_weekly_rollup(season_id, week_key);
