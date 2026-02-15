-- V018__admin_live_ops.sql
-- Admin live control surface: feature flags, presets, runtime overrides.

CREATE TABLE IF NOT EXISTS feature_flags (
  flag_key TEXT PRIMARY KEY,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  scope TEXT NOT NULL DEFAULT 'global',
  value_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  note TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS admin_presets (
  id BIGSERIAL PRIMARY KEY,
  preset_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  preset_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS admin_runtime_overrides (
  override_key TEXT PRIMARY KEY,
  override_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT NOT NULL DEFAULT 0
);

INSERT INTO feature_flags (flag_key, is_enabled, note)
VALUES
  ('ARENA_AUTH_ENABLED', FALSE, 'Server-authoritative arena sessions'),
  ('TOKEN_CURVE_ENABLED', FALSE, 'Treasury curve pricing'),
  ('TOKEN_AUTO_APPROVE_ENABLED', FALSE, 'Semi-auto token approvals'),
  ('WEBAPP_V3_ENABLED', FALSE, 'WebApp V3 UX and mechanics')
ON CONFLICT (flag_key) DO NOTHING;
