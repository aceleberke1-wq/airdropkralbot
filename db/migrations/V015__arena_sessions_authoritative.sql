-- V015__arena_sessions_authoritative.sql
-- Server-authoritative arena sessions and deterministic action ledger.

CREATE TABLE IF NOT EXISTS arena_sessions (
  id BIGSERIAL PRIMARY KEY,
  session_ref UUID NOT NULL UNIQUE,
  user_id BIGINT NOT NULL REFERENCES users(id),
  season_id INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  mode_suggested TEXT NOT NULL DEFAULT 'balanced',
  mode_final TEXT,
  score INT NOT NULL DEFAULT 0,
  combo_max INT NOT NULL DEFAULT 0,
  hits INT NOT NULL DEFAULT 0,
  misses INT NOT NULL DEFAULT 0,
  action_count INT NOT NULL DEFAULT 0,
  request_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '12 minutes',
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'arena_sessions_status_check'
  ) THEN
    ALTER TABLE arena_sessions
      ADD CONSTRAINT arena_sessions_status_check
      CHECK (status IN ('active', 'resolved', 'expired', 'cancelled'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'arena_sessions_mode_suggested_check'
  ) THEN
    ALTER TABLE arena_sessions
      ADD CONSTRAINT arena_sessions_mode_suggested_check
      CHECK (mode_suggested IN ('safe', 'balanced', 'aggressive'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'arena_sessions_mode_final_check'
  ) THEN
    ALTER TABLE arena_sessions
      ADD CONSTRAINT arena_sessions_mode_final_check
      CHECK (mode_final IS NULL OR mode_final IN ('safe', 'balanced', 'aggressive'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_arena_sessions_user_active_unique
  ON arena_sessions(user_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_arena_sessions_status_expiry
  ON arena_sessions(status, expires_at);

CREATE INDEX IF NOT EXISTS idx_arena_sessions_user_started
  ON arena_sessions(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS arena_session_actions (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES arena_sessions(id) ON DELETE CASCADE,
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
    SELECT 1 FROM pg_constraint WHERE conname = 'arena_session_actions_input_action_check'
  ) THEN
    ALTER TABLE arena_session_actions
      ADD CONSTRAINT arena_session_actions_input_action_check
      CHECK (input_action IN ('strike', 'guard', 'charge'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_arena_session_actions_session_created
  ON arena_session_actions(session_id, created_at ASC);

CREATE TABLE IF NOT EXISTS arena_session_results (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL UNIQUE REFERENCES arena_sessions(id) ON DELETE CASCADE,
  result_ref UUID NOT NULL UNIQUE,
  mode TEXT NOT NULL,
  outcome TEXT NOT NULL,
  reward_sc INT NOT NULL DEFAULT 0,
  reward_hc INT NOT NULL DEFAULT 0,
  reward_rc INT NOT NULL DEFAULT 0,
  rating_delta INT NOT NULL DEFAULT 0,
  resolved_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'arena_session_results_mode_check'
  ) THEN
    ALTER TABLE arena_session_results
      ADD CONSTRAINT arena_session_results_mode_check
      CHECK (mode IN ('safe', 'balanced', 'aggressive'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'arena_session_results_outcome_check'
  ) THEN
    ALTER TABLE arena_session_results
      ADD CONSTRAINT arena_session_results_outcome_check
      CHECK (outcome IN ('win', 'near', 'loss'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_arena_session_results_created
  ON arena_session_results(created_at DESC);
