-- V027__combat_telemetry_v33.sql
-- Combat and UI interaction telemetry for Nexus Pro runtime diagnostics.

CREATE TABLE IF NOT EXISTS combat_frame_stats (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  session_ref TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL DEFAULT 'combat',
  device_hash TEXT NOT NULL DEFAULT 'unknown',
  fps_avg NUMERIC(10,4) NOT NULL DEFAULT 0,
  frame_time_ms NUMERIC(12,4) NOT NULL DEFAULT 0,
  dropped_frames INT NOT NULL DEFAULT 0,
  gpu_time_ms NUMERIC(12,4) NOT NULL DEFAULT 0,
  cpu_time_ms NUMERIC(12,4) NOT NULL DEFAULT 0,
  stats_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_combat_frame_stats_user_time
  ON combat_frame_stats(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_combat_frame_stats_session_time
  ON combat_frame_stats(session_ref, created_at DESC);

CREATE TABLE IF NOT EXISTS combat_net_stats (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  session_ref TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL DEFAULT 'combat',
  transport TEXT NOT NULL DEFAULT 'poll',
  tick_ms INT NOT NULL DEFAULT 1000,
  action_window_ms INT NOT NULL DEFAULT 800,
  rtt_ms NUMERIC(12,4) NOT NULL DEFAULT 0,
  jitter_ms NUMERIC(12,4) NOT NULL DEFAULT 0,
  packet_loss_pct NUMERIC(10,4) NOT NULL DEFAULT 0,
  accepted_actions INT NOT NULL DEFAULT 0,
  rejected_actions INT NOT NULL DEFAULT 0,
  stats_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'combat_net_stats_transport_check'
  ) THEN
    ALTER TABLE combat_net_stats
      ADD CONSTRAINT combat_net_stats_transport_check
      CHECK (transport IN ('poll', 'ws'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_combat_net_stats_user_time
  ON combat_net_stats(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_combat_net_stats_session_time
  ON combat_net_stats(session_ref, created_at DESC);

CREATE TABLE IF NOT EXISTS ui_interaction_events (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  event_key TEXT NOT NULL,
  event_name TEXT NOT NULL DEFAULT '',
  event_scope TEXT NOT NULL DEFAULT 'webapp',
  event_value TEXT NOT NULL DEFAULT '',
  event_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ui_interaction_events_user_time
  ON ui_interaction_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ui_interaction_events_key_time
  ON ui_interaction_events(event_key, created_at DESC);
