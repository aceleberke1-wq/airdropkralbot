-- V013__arena_layers.sql
CREATE TABLE IF NOT EXISTS arena_state (
  user_id BIGINT PRIMARY KEY REFERENCES users(id),
  rating INT NOT NULL DEFAULT 1000,
  games_played INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  last_result TEXT,
  last_play_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS arena_runs (
  id BIGSERIAL PRIMARY KEY,
  run_nonce UUID NOT NULL UNIQUE,
  user_id BIGINT NOT NULL REFERENCES users(id),
  season_id INT NOT NULL,
  mode TEXT NOT NULL,
  risk_before NUMERIC(4,3) NOT NULL DEFAULT 0,
  player_power NUMERIC(9,3) NOT NULL,
  enemy_power NUMERIC(9,3) NOT NULL,
  win_probability NUMERIC(6,5) NOT NULL,
  outcome TEXT NOT NULL,
  rating_delta INT NOT NULL,
  rating_after INT NOT NULL,
  reward_sc INT NOT NULL DEFAULT 0,
  reward_hc INT NOT NULL DEFAULT 0,
  reward_rc INT NOT NULL DEFAULT 0,
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'arena_runs_mode_check'
  ) THEN
    ALTER TABLE arena_runs
      ADD CONSTRAINT arena_runs_mode_check CHECK (mode IN ('safe', 'balanced', 'aggressive'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'arena_runs_outcome_check'
  ) THEN
    ALTER TABLE arena_runs
      ADD CONSTRAINT arena_runs_outcome_check CHECK (outcome IN ('win', 'near', 'loss'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_arena_runs_user_created
  ON arena_runs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_arena_runs_season_rating
  ON arena_runs(season_id, rating_after DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_arena_state_rating
  ON arena_state(rating DESC, updated_at DESC);
