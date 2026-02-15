-- V020__raid_sessions_and_boss_cycles.sql
-- Authoritative raid sessions, raid actions/results, and rotating boss cycles.

CREATE TABLE IF NOT EXISTS boss_cycles (
  id BIGSERIAL PRIMARY KEY,
  cycle_ref UUID NOT NULL UNIQUE,
  season_id INT NOT NULL DEFAULT 0,
  cycle_key TEXT NOT NULL UNIQUE,
  boss_name TEXT NOT NULL DEFAULT 'Nexus Warden',
  tier TEXT NOT NULL DEFAULT 'seed',
  wave_total INT NOT NULL DEFAULT 3,
  wave_index INT NOT NULL DEFAULT 1,
  hp_total INT NOT NULL DEFAULT 1000,
  hp_remaining INT NOT NULL DEFAULT 1000,
  state TEXT NOT NULL DEFAULT 'active',
  cycle_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '1 day',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'boss_cycles_tier_check'
  ) THEN
    ALTER TABLE boss_cycles
      ADD CONSTRAINT boss_cycles_tier_check
      CHECK (tier IN ('seed', 'prime', 'elite', 'mythic'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'boss_cycles_state_check'
  ) THEN
    ALTER TABLE boss_cycles
      ADD CONSTRAINT boss_cycles_state_check
      CHECK (state IN ('active', 'cooldown', 'closed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_boss_cycles_season_time
  ON boss_cycles(season_id, starts_at DESC);

CREATE TABLE IF NOT EXISTS raid_sessions (
  id BIGSERIAL PRIMARY KEY,
  session_ref UUID NOT NULL UNIQUE,
  request_ref TEXT,
  user_id BIGINT NOT NULL REFERENCES users(id),
  season_id INT NOT NULL DEFAULT 0,
  boss_cycle_id BIGINT REFERENCES boss_cycles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  mode_suggested TEXT NOT NULL DEFAULT 'balanced',
  mode_final TEXT,
  score INT NOT NULL DEFAULT 0,
  combo_max INT NOT NULL DEFAULT 0,
  hits INT NOT NULL DEFAULT 0,
  misses INT NOT NULL DEFAULT 0,
  action_count INT NOT NULL DEFAULT 0,
  contract_key TEXT NOT NULL DEFAULT '',
  anomaly_id TEXT NOT NULL DEFAULT '',
  director_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '8 minutes',
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'raid_sessions_status_check'
  ) THEN
    ALTER TABLE raid_sessions
      ADD CONSTRAINT raid_sessions_status_check
      CHECK (status IN ('active', 'resolved', 'expired', 'cancelled'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'raid_sessions_mode_suggested_check'
  ) THEN
    ALTER TABLE raid_sessions
      ADD CONSTRAINT raid_sessions_mode_suggested_check
      CHECK (mode_suggested IN ('safe', 'balanced', 'aggressive'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'raid_sessions_mode_final_check'
  ) THEN
    ALTER TABLE raid_sessions
      ADD CONSTRAINT raid_sessions_mode_final_check
      CHECK (mode_final IS NULL OR mode_final IN ('safe', 'balanced', 'aggressive'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_raid_sessions_user_active_unique
  ON raid_sessions(user_id)
  WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_raid_sessions_request_ref_unique
  ON raid_sessions(request_ref)
  WHERE request_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_raid_sessions_status_expiry
  ON raid_sessions(status, expires_at);

CREATE INDEX IF NOT EXISTS idx_raid_sessions_user_started
  ON raid_sessions(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS raid_actions (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES raid_sessions(id) ON DELETE CASCADE,
  action_seq INT NOT NULL,
  input_action TEXT NOT NULL,
  latency_ms INT NOT NULL DEFAULT 0,
  accepted BOOLEAN NOT NULL DEFAULT FALSE,
  score_delta INT NOT NULL DEFAULT 0,
  combo_after INT NOT NULL DEFAULT 0,
  action_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, action_seq)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'raid_actions_input_action_check'
  ) THEN
    ALTER TABLE raid_actions
      ADD CONSTRAINT raid_actions_input_action_check
      CHECK (input_action IN ('strike', 'guard', 'charge'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_raid_actions_session_seq
  ON raid_actions(session_id, action_seq ASC);

CREATE TABLE IF NOT EXISTS raid_results (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL UNIQUE REFERENCES raid_sessions(id) ON DELETE CASCADE,
  result_ref UUID NOT NULL UNIQUE,
  boss_cycle_id BIGINT REFERENCES boss_cycles(id) ON DELETE SET NULL,
  mode TEXT NOT NULL,
  outcome TEXT NOT NULL,
  reward_sc INT NOT NULL DEFAULT 0,
  reward_hc INT NOT NULL DEFAULT 0,
  reward_rc INT NOT NULL DEFAULT 0,
  rating_delta INT NOT NULL DEFAULT 0,
  damage_done INT NOT NULL DEFAULT 0,
  resolved_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'raid_results_mode_check'
  ) THEN
    ALTER TABLE raid_results
      ADD CONSTRAINT raid_results_mode_check
      CHECK (mode IN ('safe', 'balanced', 'aggressive'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'raid_results_outcome_check'
  ) THEN
    ALTER TABLE raid_results
      ADD CONSTRAINT raid_results_outcome_check
      CHECK (outcome IN ('win', 'near', 'loss'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_raid_results_created
  ON raid_results(created_at DESC);
