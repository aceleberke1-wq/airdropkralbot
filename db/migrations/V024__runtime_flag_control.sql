-- V024__runtime_flag_control.sql
-- Runtime flag source authority, audit trail and bootstrap metadata.

CREATE TABLE IF NOT EXISTS feature_flag_audit (
  id BIGSERIAL PRIMARY KEY,
  flag_key TEXT NOT NULL,
  previous_enabled BOOLEAN,
  next_enabled BOOLEAN NOT NULL,
  previous_value_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  next_value_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  note TEXT NOT NULL DEFAULT '',
  source_mode TEXT NOT NULL DEFAULT 'db_override',
  changed_by BIGINT NOT NULL DEFAULT 0,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feature_flag_audit_flag_time
  ON feature_flag_audit(flag_key, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_feature_flag_audit_mode_time
  ON feature_flag_audit(source_mode, changed_at DESC);

CREATE TABLE IF NOT EXISTS flag_source_state (
  source_key TEXT PRIMARY KEY,
  source_mode TEXT NOT NULL DEFAULT 'env_locked',
  source_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT NOT NULL DEFAULT 0
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'flag_source_state_mode_check'
  ) THEN
    ALTER TABLE flag_source_state
      ADD CONSTRAINT flag_source_state_mode_check
      CHECK (source_mode IN ('env_locked', 'db_override'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS feature_flag_bootstrap_meta (
  flag_key TEXT PRIMARY KEY REFERENCES feature_flags(flag_key) ON DELETE CASCADE,
  enforce_from_env BOOLEAN NOT NULL DEFAULT FALSE,
  env_key TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT NOT NULL DEFAULT 0
);

INSERT INTO flag_source_state (source_key, source_mode, source_json, updated_by)
VALUES (
  'global',
  'env_locked',
  jsonb_build_object(
    'reason', 'safe_default',
    'critical_keys', jsonb_build_array(
      'ARENA_AUTH_ENABLED',
      'RAID_AUTH_ENABLED',
      'WEBAPP_V3_ENABLED',
      'WEBAPP_TS_BUNDLE_ENABLED',
      'TOKEN_CURVE_ENABLED',
      'TOKEN_AUTO_APPROVE_ENABLED'
    )
  ),
  0
)
ON CONFLICT (source_key) DO NOTHING;

INSERT INTO feature_flag_bootstrap_meta (
  flag_key,
  enforce_from_env,
  env_key,
  description,
  meta_json
)
VALUES
  (
    'ARENA_AUTH_ENABLED',
    TRUE,
    'ARENA_AUTH_ENABLED',
    'Authoritative arena gameplay',
    '{"critical":true,"phase":"gameplay_core"}'::jsonb
  ),
  (
    'RAID_AUTH_ENABLED',
    TRUE,
    'RAID_AUTH_ENABLED',
    'Authoritative raid gameplay',
    '{"critical":true,"phase":"gameplay_core"}'::jsonb
  ),
  (
    'WEBAPP_V3_ENABLED',
    TRUE,
    'WEBAPP_V3_ENABLED',
    'Nexus Pro webapp variant',
    '{"critical":true,"phase":"ux"}'::jsonb
  ),
  (
    'WEBAPP_TS_BUNDLE_ENABLED',
    TRUE,
    'WEBAPP_TS_BUNDLE_ENABLED',
    'Serve TS/Vite bundle',
    '{"critical":true,"phase":"deploy"}'::jsonb
  ),
  (
    'TOKEN_CURVE_ENABLED',
    TRUE,
    'TOKEN_CURVE_ENABLED',
    'Treasury pricing curve',
    '{"critical":true,"phase":"economy"}'::jsonb
  ),
  (
    'TOKEN_AUTO_APPROVE_ENABLED',
    TRUE,
    'TOKEN_AUTO_APPROVE_ENABLED',
    'Semi-auto token approval',
    '{"critical":true,"phase":"economy"}'::jsonb
  )
ON CONFLICT (flag_key) DO UPDATE SET
  enforce_from_env = EXCLUDED.enforce_from_env,
  env_key = EXCLUDED.env_key,
  description = EXCLUDED.description,
  meta_json = EXCLUDED.meta_json,
  updated_at = now();
