-- V5 dual-run domain core tables.

CREATE TABLE IF NOT EXISTS v5_command_events (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  command_key TEXT NOT NULL,
  handler_key TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'bot',
  locale TEXT NOT NULL DEFAULT 'tr',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS v5_intent_resolution_events (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  input_text TEXT NOT NULL DEFAULT '',
  normalized_text TEXT NOT NULL DEFAULT '',
  matched_key TEXT NOT NULL DEFAULT '',
  resolved_mode TEXT NOT NULL DEFAULT 'balanced',
  confidence NUMERIC(8, 6) NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'bot',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS v5_pvp_progression_daily (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  season_id INT NOT NULL,
  day_key TEXT NOT NULL,
  duel_wins INT NOT NULL DEFAULT 0,
  duel_claimed INT NOT NULL DEFAULT 0,
  points_delta INT NOT NULL DEFAULT 0,
  state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, season_id, day_key)
);

CREATE TABLE IF NOT EXISTS v5_pvp_progression_weekly (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  season_id INT NOT NULL,
  week_key TEXT NOT NULL,
  ladder_points INT NOT NULL DEFAULT 0,
  milestones_claimed INT NOT NULL DEFAULT 0,
  state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, season_id, week_key)
);

CREATE TABLE IF NOT EXISTS v5_pvp_progression_season (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  season_id INT NOT NULL,
  arc_personal_contribution INT NOT NULL DEFAULT 0,
  arc_personal_claimed INT NOT NULL DEFAULT 0,
  arc_global_contribution INT NOT NULL DEFAULT 0,
  state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, season_id)
);

CREATE TABLE IF NOT EXISTS v5_release_drip_usage (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_date DATE NOT NULL DEFAULT CURRENT_DATE,
  currency TEXT NOT NULL DEFAULT 'BTC',
  entitled_btc NUMERIC(24, 8) NOT NULL DEFAULT 0,
  drip_cap_btc NUMERIC(24, 8) NOT NULL DEFAULT 0,
  drip_used_btc NUMERIC(24, 8) NOT NULL DEFAULT 0,
  drip_remaining_btc NUMERIC(24, 8) NOT NULL DEFAULT 0,
  unlock_tier TEXT NOT NULL DEFAULT 'T0',
  unlock_score NUMERIC(12, 6) NOT NULL DEFAULT 0,
  global_gate_open BOOLEAN NOT NULL DEFAULT FALSE,
  decision_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, day_date, currency)
);
