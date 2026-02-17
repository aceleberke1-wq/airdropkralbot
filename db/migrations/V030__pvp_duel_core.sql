-- V030__pvp_duel_core.sql
-- PvP duel/runtime hardening on top of V025.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pvp_sessions'
      AND column_name = 'server_tick'
  ) THEN
    ALTER TABLE pvp_sessions
      ADD COLUMN server_tick BIGINT NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pvp_sessions'
      AND column_name = 'last_heartbeat_at'
  ) THEN
    ALTER TABLE pvp_sessions
      ADD COLUMN last_heartbeat_at TIMESTAMPTZ;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pvp_sessions'
      AND column_name = 'transport_version'
  ) THEN
    ALTER TABLE pvp_sessions
      ADD COLUMN transport_version INT NOT NULL DEFAULT 1;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pvp_sessions_status_updated
  ON pvp_sessions(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_pvp_sessions_resolved
  ON pvp_sessions(resolved_at DESC)
  WHERE resolved_at IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pvp_session_actions'
      AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE pvp_session_actions
      ADD COLUMN idempotency_key TEXT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pvp_session_actions_idempotency
  ON pvp_session_actions(session_id, actor_user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pvp_matchmaking_queue'
      AND column_name = 'matchmaking_bucket'
  ) THEN
    ALTER TABLE pvp_matchmaking_queue
      ADD COLUMN matchmaking_bucket TEXT NOT NULL DEFAULT 'default';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pvp_matchmaking_queue_bucket
  ON pvp_matchmaking_queue(status, matchmaking_bucket, queued_at ASC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pvp_session_results'
      AND column_name = 'server_tick_resolved'
  ) THEN
    ALTER TABLE pvp_session_results
      ADD COLUMN server_tick_resolved BIGINT NOT NULL DEFAULT 0;
  END IF;
END $$;
