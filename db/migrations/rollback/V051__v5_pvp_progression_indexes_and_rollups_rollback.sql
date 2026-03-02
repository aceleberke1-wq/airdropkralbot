-- Rollback for V051__v5_pvp_progression_indexes_and_rollups.sql

DROP INDEX IF EXISTS idx_v5_pvp_weekly_rollup_unique;
DROP INDEX IF EXISTS idx_v5_pvp_daily_rollup_unique;
DROP MATERIALIZED VIEW IF EXISTS v5_pvp_progression_weekly_rollup;
DROP MATERIALIZED VIEW IF EXISTS v5_pvp_progression_daily_rollup;
DROP INDEX IF EXISTS idx_v5_pvp_season_user_updated;
DROP INDEX IF EXISTS idx_v5_pvp_weekly_user_updated;
DROP INDEX IF EXISTS idx_v5_pvp_daily_user_updated;
