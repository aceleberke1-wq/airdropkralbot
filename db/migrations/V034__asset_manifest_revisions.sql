-- V034__asset_manifest_revisions.sql
-- Revisioned manifest model with integrity metadata and active pointer.

CREATE TABLE IF NOT EXISTS asset_manifest_revisions (
  id BIGSERIAL PRIMARY KEY,
  manifest_revision TEXT NOT NULL UNIQUE,
  manifest_hash TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'local',
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  manifest_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_manifest_revisions_active_unique
  ON asset_manifest_revisions(is_active)
  WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_asset_manifest_revisions_created
  ON asset_manifest_revisions(created_at DESC);

CREATE TABLE IF NOT EXISTS asset_manifest_entries (
  id BIGSERIAL PRIMARY KEY,
  revision_id BIGINT NOT NULL REFERENCES asset_manifest_revisions(id) ON DELETE CASCADE,
  asset_key TEXT NOT NULL,
  asset_path TEXT NOT NULL DEFAULT '',
  fallback_path TEXT NOT NULL DEFAULT '',
  asset_hash TEXT NOT NULL DEFAULT '',
  bytes_size BIGINT NOT NULL DEFAULT 0,
  integrity_status TEXT NOT NULL DEFAULT 'unknown',
  exists_local BOOLEAN NOT NULL DEFAULT FALSE,
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (revision_id, asset_key)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'asset_manifest_entries_integrity_status_check'
  ) THEN
    ALTER TABLE asset_manifest_entries
      ADD CONSTRAINT asset_manifest_entries_integrity_status_check
      CHECK (integrity_status IN ('ok', 'missing', 'hash_mismatch', 'invalid', 'unknown'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_asset_manifest_entries_status
  ON asset_manifest_entries(integrity_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_asset_manifest_entries_asset_key
  ON asset_manifest_entries(asset_key, updated_at DESC);

WITH base AS (
  SELECT
    COALESCE((SELECT manifest_revision FROM webapp_asset_manifest_state WHERE state_key = 'active' LIMIT 1), 'v0') AS revision,
    COALESCE((SELECT state_json FROM webapp_asset_manifest_state WHERE state_key = 'active' LIMIT 1), '{}'::jsonb) AS state_json
)
INSERT INTO asset_manifest_revisions (
  manifest_revision,
  manifest_hash,
  source,
  is_active,
  manifest_json,
  activated_at,
  created_by
)
SELECT
  b.revision,
  '',
  'migration_v034',
  TRUE,
  b.state_json,
  now(),
  0
FROM base b
ON CONFLICT (manifest_revision) DO UPDATE SET
  is_active = TRUE,
  activated_at = now();

INSERT INTO asset_manifest_entries (
  revision_id,
  asset_key,
  asset_path,
  fallback_path,
  asset_hash,
  bytes_size,
  integrity_status,
  exists_local,
  meta_json
)
SELECT
  r.id,
  reg.asset_key,
  reg.manifest_path,
  '',
  reg.file_hash,
  reg.bytes_size,
  CASE
    WHEN reg.load_status = 'ready' THEN 'ok'
    WHEN reg.load_status = 'missing' THEN 'missing'
    WHEN reg.load_status = 'error' THEN 'invalid'
    WHEN reg.load_status = 'loading' THEN 'unknown'
    ELSE 'unknown'
  END,
  reg.load_status = 'ready',
  COALESCE(reg.meta_json, '{}'::jsonb)
FROM webapp_asset_registry reg
JOIN asset_manifest_revisions r
  ON r.manifest_revision = COALESCE(reg.manifest_revision, 'v0')
ON CONFLICT (revision_id, asset_key) DO UPDATE SET
  asset_path = EXCLUDED.asset_path,
  asset_hash = EXCLUDED.asset_hash,
  bytes_size = EXCLUDED.bytes_size,
  integrity_status = EXCLUDED.integrity_status,
  exists_local = EXCLUDED.exists_local,
  meta_json = EXCLUDED.meta_json,
  updated_at = now();
