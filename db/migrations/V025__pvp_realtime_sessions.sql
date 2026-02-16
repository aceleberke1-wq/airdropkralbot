-- V025__pvp_realtime_sessions.sql
-- Hybrid realtime PvP (poll/ws compatible) with authoritative idempotency.

CREATE TABLE IF NOT EXISTS pvp_matchmaking_queue (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  queue_ref TEXT NOT NULL UNIQUE,
  desired_mode TEXT NOT NULL DEFAULT 'balanced',
  status TEXT NOT NULL DEFAULT 'waiting',
  ticket_cost_rc INT NOT NULL DEFAULT 1,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '90 seconds',
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pvp_matchmaking_queue_status_check'
  ) THEN
    ALTER TABLE pvp_matchmaking_queue
      ADD CONSTRAINT pvp_matchmaking_queue_status_check
      CHECK (status IN ('waiting', 'matched', 'cancelled', 'expired'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pvp_matchmaking_queue_user_waiting_unique
  ON pvp_matchmaking_queue(user_id)
  WHERE status = 'waiting';

CREATE INDEX IF NOT EXISTS idx_pvp_matchmaking_queue_status_expiry
  ON pvp_matchmaking_queue(status, expires_at);

CREATE TABLE IF NOT EXISTS pvp_sessions (
  id BIGSERIAL PRIMARY KEY,
  session_ref TEXT NOT NULL UNIQUE,
  request_ref TEXT UNIQUE,
  transport TEXT NOT NULL DEFAULT 'poll',
  tick_ms INT NOT NULL DEFAULT 1000,
  action_window_ms INT NOT NULL DEFAULT 800,
  status TEXT NOT NULL DEFAULT 'active',
  user_left_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_right_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  opponent_type TEXT NOT NULL DEFAULT 'shadow',
  mode_suggested TEXT NOT NULL DEFAULT 'balanced',
  mode_final TEXT,
  score_left INT NOT NULL DEFAULT 0,
  score_right INT NOT NULL DEFAULT 0,
  combo_left INT NOT NULL DEFAULT 0,
  combo_right INT NOT NULL DEFAULT 0,
  action_count_left INT NOT NULL DEFAULT 0,
  action_count_right INT NOT NULL DEFAULT 0,
  winner_side TEXT NOT NULL DEFAULT 'none',
  state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  seed_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '75 seconds',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pvp_sessions_transport_check'
  ) THEN
    ALTER TABLE pvp_sessions
      ADD CONSTRAINT pvp_sessions_transport_check
      CHECK (transport IN ('poll', 'ws'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pvp_sessions_status_check'
  ) THEN
    ALTER TABLE pvp_sessions
      ADD CONSTRAINT pvp_sessions_status_check
      CHECK (status IN ('active', 'resolved', 'expired', 'cancelled'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pvp_sessions_opponent_type_check'
  ) THEN
    ALTER TABLE pvp_sessions
      ADD CONSTRAINT pvp_sessions_opponent_type_check
      CHECK (opponent_type IN ('shadow', 'live'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pvp_sessions_mode_suggested_check'
  ) THEN
    ALTER TABLE pvp_sessions
      ADD CONSTRAINT pvp_sessions_mode_suggested_check
      CHECK (mode_suggested IN ('safe', 'balanced', 'aggressive'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pvp_sessions_mode_final_check'
  ) THEN
    ALTER TABLE pvp_sessions
      ADD CONSTRAINT pvp_sessions_mode_final_check
      CHECK (mode_final IS NULL OR mode_final IN ('safe', 'balanced', 'aggressive'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pvp_sessions_winner_side_check'
  ) THEN
    ALTER TABLE pvp_sessions
      ADD CONSTRAINT pvp_sessions_winner_side_check
      CHECK (winner_side IN ('left', 'right', 'draw', 'none'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pvp_sessions_left_active_unique
  ON pvp_sessions(user_left_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_pvp_sessions_left_started
  ON pvp_sessions(user_left_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_pvp_sessions_status_expiry
  ON pvp_sessions(status, expires_at);

CREATE TABLE IF NOT EXISTS pvp_session_actions (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES pvp_sessions(id) ON DELETE CASCADE,
  actor_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_seq INT NOT NULL,
  input_action TEXT NOT NULL,
  latency_ms INT NOT NULL DEFAULT 0,
  accepted BOOLEAN NOT NULL DEFAULT FALSE,
  score_delta INT NOT NULL DEFAULT 0,
  action_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, actor_user_id, action_seq)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pvp_session_actions_input_action_check'
  ) THEN
    ALTER TABLE pvp_session_actions
      ADD CONSTRAINT pvp_session_actions_input_action_check
      CHECK (input_action IN ('strike', 'guard', 'charge'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pvp_session_actions_session_seq
  ON pvp_session_actions(session_id, action_seq ASC);

CREATE TABLE IF NOT EXISTS pvp_session_results (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL UNIQUE REFERENCES pvp_sessions(id) ON DELETE CASCADE,
  result_ref TEXT NOT NULL UNIQUE,
  winner_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  mode TEXT NOT NULL DEFAULT 'balanced',
  outcome TEXT NOT NULL DEFAULT 'near',
  score_left INT NOT NULL DEFAULT 0,
  score_right INT NOT NULL DEFAULT 0,
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
    SELECT 1 FROM pg_constraint WHERE conname = 'pvp_session_results_mode_check'
  ) THEN
    ALTER TABLE pvp_session_results
      ADD CONSTRAINT pvp_session_results_mode_check
      CHECK (mode IN ('safe', 'balanced', 'aggressive'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pvp_session_results_outcome_check'
  ) THEN
    ALTER TABLE pvp_session_results
      ADD CONSTRAINT pvp_session_results_outcome_check
      CHECK (outcome IN ('win', 'near', 'loss', 'draw'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pvp_session_results_created
  ON pvp_session_results(created_at DESC);

CREATE TABLE IF NOT EXISTS pvp_rating_history (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id BIGINT REFERENCES pvp_sessions(id) ON DELETE SET NULL,
  rating_before INT NOT NULL DEFAULT 1000,
  rating_delta INT NOT NULL DEFAULT 0,
  rating_after INT NOT NULL DEFAULT 1000,
  outcome TEXT NOT NULL DEFAULT 'near',
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pvp_rating_history_outcome_check'
  ) THEN
    ALTER TABLE pvp_rating_history
      ADD CONSTRAINT pvp_rating_history_outcome_check
      CHECK (outcome IN ('win', 'near', 'loss', 'draw'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pvp_rating_history_user_time
  ON pvp_rating_history(user_id, created_at DESC);
