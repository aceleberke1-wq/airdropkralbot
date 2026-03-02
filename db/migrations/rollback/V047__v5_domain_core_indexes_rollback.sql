-- Rollback for V047__v5_domain_core_indexes.sql

DROP INDEX IF EXISTS idx_v5_release_drip_usage_day;
DROP INDEX IF EXISTS idx_v5_pvp_season_state;
DROP INDEX IF EXISTS idx_v5_pvp_weekly_season_week;
DROP INDEX IF EXISTS idx_v5_pvp_daily_season_day;
DROP INDEX IF EXISTS idx_v5_intent_events_match_time;
DROP INDEX IF EXISTS idx_v5_intent_events_user_time;
DROP INDEX IF EXISTS idx_v5_command_events_key_time;
DROP INDEX IF EXISTS idx_v5_command_events_user_time;
