-- V5 dual-run indexes.

CREATE INDEX IF NOT EXISTS idx_v5_command_events_user_time
  ON v5_command_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_command_events_key_time
  ON v5_command_events(command_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_intent_events_user_time
  ON v5_intent_resolution_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_intent_events_match_time
  ON v5_intent_resolution_events(matched_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_pvp_daily_season_day
  ON v5_pvp_progression_daily(season_id, day_key, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_pvp_weekly_season_week
  ON v5_pvp_progression_weekly(season_id, week_key, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_pvp_season_state
  ON v5_pvp_progression_season(season_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_release_drip_usage_day
  ON v5_release_drip_usage(day_date DESC, currency, unlock_tier);
