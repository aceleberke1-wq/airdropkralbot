-- V035__pvp_tick_and_match_events.sql
-- PvP tick loop telemetry + rejection audit for hybrid realtime transport.

CREATE TABLE IF NOT EXISTS pvp_match_ticks (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES pvp_sessions(id) ON DELETE CASCADE,
  session_ref TEXT NOT NULL,
  tick_seq BIGINT NOT NULL,
  server_tick BIGINT NOT NULL DEFAULT 0,
  tick_ms INT NOT NULL DEFAULT 1000,
  action_window_ms INT NOT NULL DEFAULT 800,
  transport TEXT NOT NULL DEFAULT 'poll',
  phase TEXT NOT NULL DEFAULT 'combat',
  state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, tick_seq)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pvp_match_ticks_transport_check'
  ) THEN
    ALTER TABLE pvp_match_ticks
      ADD CONSTRAINT pvp_match_ticks_transport_check
      CHECK (transport IN ('poll', 'ws'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pvp_match_ticks_phase_check'
  ) THEN
    ALTER TABLE pvp_match_ticks
      ADD CONSTRAINT pvp_match_ticks_phase_check
      CHECK (phase IN ('queue', 'combat', 'resolve', 'expired', 'cancelled'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pvp_match_ticks_session_created
  ON pvp_match_ticks(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pvp_match_ticks_ref_seq
  ON pvp_match_ticks(session_ref, tick_seq DESC);

CREATE TABLE IF NOT EXISTS pvp_match_events (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT REFERENCES pvp_sessions(id) ON DELETE CASCADE,
  session_ref TEXT NOT NULL DEFAULT '',
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  event_key TEXT NOT NULL,
  event_name TEXT NOT NULL DEFAULT '',
  event_scope TEXT NOT NULL DEFAULT 'pvp',
  event_value TEXT NOT NULL DEFAULT '',
  event_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pvp_match_events_session_time
  ON pvp_match_events(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pvp_match_events_key_time
  ON pvp_match_events(event_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pvp_match_events_actor_time
  ON pvp_match_events(actor_user_id, created_at DESC)
  WHERE actor_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS pvp_action_rejections (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES pvp_sessions(id) ON DELETE CASCADE,
  session_ref TEXT NOT NULL,
  actor_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_seq INT NOT NULL,
  input_action TEXT NOT NULL DEFAULT '',
  reason_code TEXT NOT NULL,
  latency_ms INT NOT NULL DEFAULT 0,
  transport TEXT NOT NULL DEFAULT 'poll',
  reject_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pvp_action_rejections_transport_check'
  ) THEN
    ALTER TABLE pvp_action_rejections
      ADD CONSTRAINT pvp_action_rejections_transport_check
      CHECK (transport IN ('poll', 'ws'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pvp_action_rejections_session_seq
  ON pvp_action_rejections(session_id, action_seq DESC);

CREATE INDEX IF NOT EXISTS idx_pvp_action_rejections_reason_time
  ON pvp_action_rejections(reason_code, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pvp_action_rejections_dedupe
  ON pvp_action_rejections(session_id, actor_user_id, action_seq, reason_code);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pvp_session_actions'
      AND column_name = 'server_tick'
  ) THEN
    ALTER TABLE pvp_session_actions
      ADD COLUMN server_tick BIGINT NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pvp_session_actions'
      AND column_name = 'reject_reason'
  ) THEN
    ALTER TABLE pvp_session_actions
      ADD COLUMN reject_reason TEXT NOT NULL DEFAULT '';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pvp_session_actions_server_tick
  ON pvp_session_actions(session_id, server_tick DESC);

INSERT INTO pvp_action_rejections (
  session_id,
  session_ref,
  actor_user_id,
  action_seq,
  input_action,
  reason_code,
  latency_ms,
  transport,
  reject_json
)
SELECT
  s.id,
  s.session_ref,
  a.actor_user_id,
  a.action_seq,
  a.input_action,
  COALESCE(NULLIF(a.reject_reason, ''), 'rejected'),
  a.latency_ms,
  COALESCE(NULLIF(s.transport, ''), 'poll'),
  COALESCE(a.action_json, '{}'::jsonb)
FROM pvp_session_actions a
JOIN pvp_sessions s ON s.id = a.session_id
WHERE a.accepted = FALSE
ON CONFLICT (session_id, actor_user_id, action_seq, reason_code) DO NOTHING;
