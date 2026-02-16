-- V026__webapp_asset_registry.sql
-- Asset registry + load telemetry for Nexus Pro webapp pipeline.

CREATE TABLE IF NOT EXISTS webapp_asset_registry (
  asset_key TEXT PRIMARY KEY,
  manifest_revision TEXT NOT NULL DEFAULT 'v0',
  manifest_path TEXT NOT NULL DEFAULT '',
  file_path TEXT NOT NULL DEFAULT '',
  file_hash TEXT NOT NULL DEFAULT '',
  bytes_size BIGINT NOT NULL DEFAULT 0,
  load_status TEXT NOT NULL DEFAULT 'missing',
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT NOT NULL DEFAULT 0
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'webapp_asset_registry_load_status_check'
  ) THEN
    ALTER TABLE webapp_asset_registry
      ADD CONSTRAINT webapp_asset_registry_load_status_check
      CHECK (load_status IN ('ready', 'missing', 'error', 'loading'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_webapp_asset_registry_status_time
  ON webapp_asset_registry(load_status, updated_at DESC);

CREATE TABLE IF NOT EXISTS webapp_asset_load_events (
  id BIGSERIAL PRIMARY KEY,
  asset_key TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'reload',
  event_state TEXT NOT NULL DEFAULT 'ok',
  event_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webapp_asset_load_events_asset_time
  ON webapp_asset_load_events(asset_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webapp_asset_load_events_state_time
  ON webapp_asset_load_events(event_state, created_at DESC);

CREATE TABLE IF NOT EXISTS webapp_asset_manifest_state (
  state_key TEXT PRIMARY KEY,
  manifest_revision TEXT NOT NULL DEFAULT 'v0',
  state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT NOT NULL DEFAULT 0
);

INSERT INTO webapp_asset_manifest_state (state_key, manifest_revision, state_json, updated_by)
VALUES ('active', 'v0', '{"source":"migration_v026"}'::jsonb, 0)
ON CONFLICT (state_key) DO NOTHING;
