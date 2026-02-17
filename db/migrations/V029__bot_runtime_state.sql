-- V029__bot_runtime_state.sql
-- Runtime observability for single-instance Telegram polling bot.

CREATE TABLE IF NOT EXISTS bot_runtime_state (
  state_key TEXT PRIMARY KEY,
  service_name TEXT NOT NULL DEFAULT 'airdropkral-bot',
  mode TEXT NOT NULL DEFAULT 'disabled',
  alive BOOLEAN NOT NULL DEFAULT FALSE,
  lock_acquired BOOLEAN NOT NULL DEFAULT FALSE,
  lock_key BIGINT NOT NULL DEFAULT 0,
  instance_ref TEXT NOT NULL DEFAULT '',
  pid INT NOT NULL DEFAULT 0,
  hostname TEXT NOT NULL DEFAULT '',
  service_env TEXT NOT NULL DEFAULT '',
  started_at TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  last_error TEXT NOT NULL DEFAULT '',
  state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT NOT NULL DEFAULT 0
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bot_runtime_state_mode_check'
  ) THEN
    ALTER TABLE bot_runtime_state
      ADD CONSTRAINT bot_runtime_state_mode_check
      CHECK (mode IN ('polling', 'disabled'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bot_runtime_state_updated
  ON bot_runtime_state(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_bot_runtime_state_heartbeat
  ON bot_runtime_state(last_heartbeat_at DESC);

CREATE TABLE IF NOT EXISTS bot_runtime_events (
  id BIGSERIAL PRIMARY KEY,
  state_key TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'runtime',
  event_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bot_runtime_events_state_key_fkey'
  ) THEN
    ALTER TABLE bot_runtime_events
      ADD CONSTRAINT bot_runtime_events_state_key_fkey
      FOREIGN KEY (state_key)
      REFERENCES bot_runtime_state(state_key)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bot_runtime_events_state_time
  ON bot_runtime_events(state_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bot_runtime_events_type_time
  ON bot_runtime_events(event_type, created_at DESC);

INSERT INTO bot_runtime_state (state_key, service_name, mode, alive, lock_acquired, lock_key, state_json, updated_by)
VALUES ('primary', 'airdropkral-bot', 'disabled', FALSE, FALSE, 0, '{"source":"migration_v029"}'::jsonb, 0)
ON CONFLICT (state_key) DO NOTHING;
