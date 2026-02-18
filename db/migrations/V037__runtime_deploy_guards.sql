-- V037__runtime_deploy_guards.sql
-- Runtime deploy snapshots and guard events for regression-free releases.

CREATE TABLE IF NOT EXISTS runtime_deploy_state (
  state_key TEXT PRIMARY KEY,
  release_ref TEXT NOT NULL DEFAULT '',
  git_revision TEXT NOT NULL DEFAULT '',
  deploy_id TEXT NOT NULL DEFAULT '',
  environment TEXT NOT NULL DEFAULT 'production',
  webapp_version TEXT NOT NULL DEFAULT '',
  webapp_launch_url TEXT NOT NULL DEFAULT '',
  flag_source_mode TEXT NOT NULL DEFAULT 'env_locked',
  bot_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  bot_alive BOOLEAN NOT NULL DEFAULT FALSE,
  bot_lock_acquired BOOLEAN NOT NULL DEFAULT FALSE,
  lock_key BIGINT NOT NULL DEFAULT 0,
  deploy_health_ok BOOLEAN NOT NULL DEFAULT FALSE,
  state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT NOT NULL DEFAULT 0
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'runtime_deploy_state_flag_source_mode_check'
  ) THEN
    ALTER TABLE runtime_deploy_state
      ADD CONSTRAINT runtime_deploy_state_flag_source_mode_check
      CHECK (flag_source_mode IN ('env_locked', 'db_override'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS runtime_deploy_events (
  id BIGSERIAL PRIMARY KEY,
  state_key TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_runtime_deploy_events_state_time
  ON runtime_deploy_events(state_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_runtime_deploy_events_type_time
  ON runtime_deploy_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_runtime_deploy_state_updated
  ON runtime_deploy_state(updated_at DESC);

WITH latest_release AS (
  SELECT
    COALESCE(release_ref::text, '') AS release_ref,
    COALESCE(git_revision, '') AS git_revision,
    COALESCE(deploy_id, '') AS deploy_id,
    COALESCE(environment, 'production') AS environment,
    COALESCE(health_json, '{}'::jsonb) AS health_json
  FROM release_markers
  ORDER BY created_at DESC, id DESC
  LIMIT 1
), runtime AS (
  SELECT
    COALESCE(alive, FALSE) AS alive,
    COALESCE(lock_acquired, FALSE) AS lock_acquired,
    COALESCE(lock_key, 0) AS lock_key,
    COALESCE(mode, 'disabled') AS mode,
    COALESCE(last_error, '') AS last_error,
    COALESCE(state_json, '{}'::jsonb) AS state_json
  FROM bot_runtime_state
  WHERE state_key = 'primary'
  LIMIT 1
), flag_source AS (
  SELECT
    COALESCE(source_mode, 'env_locked') AS source_mode,
    COALESCE(source_json, '{}'::jsonb) AS source_json
  FROM flag_source_state
  WHERE source_key = 'global'
  LIMIT 1
)
INSERT INTO runtime_deploy_state (
  state_key,
  release_ref,
  git_revision,
  deploy_id,
  environment,
  webapp_version,
  webapp_launch_url,
  flag_source_mode,
  bot_enabled,
  bot_alive,
  bot_lock_acquired,
  lock_key,
  deploy_health_ok,
  state_json,
  updated_by
)
SELECT
  'active',
  COALESCE(r.release_ref, ''),
  COALESCE(r.git_revision, ''),
  COALESCE(r.deploy_id, ''),
  COALESCE(r.environment, 'production'),
  COALESCE(r.git_revision, ''),
  '',
  COALESCE(f.source_mode, 'env_locked'),
  TRUE,
  COALESCE(rt.alive, FALSE),
  COALESCE(rt.lock_acquired, FALSE),
  COALESCE(rt.lock_key, 0),
  COALESCE((r.health_json->>'ok')::boolean, FALSE),
  jsonb_build_object(
    'release_health', COALESCE(r.health_json, '{}'::jsonb),
    'runtime_mode', COALESCE(rt.mode, 'disabled'),
    'runtime_last_error', COALESCE(rt.last_error, ''),
    'flag_source_json', COALESCE(f.source_json, '{}'::jsonb),
    'runtime_state_json', COALESCE(rt.state_json, '{}'::jsonb)
  ),
  0
FROM latest_release r
FULL OUTER JOIN runtime rt ON TRUE
FULL OUTER JOIN flag_source f ON TRUE
ON CONFLICT (state_key) DO UPDATE SET
  release_ref = EXCLUDED.release_ref,
  git_revision = EXCLUDED.git_revision,
  deploy_id = EXCLUDED.deploy_id,
  environment = EXCLUDED.environment,
  webapp_version = EXCLUDED.webapp_version,
  flag_source_mode = EXCLUDED.flag_source_mode,
  bot_alive = EXCLUDED.bot_alive,
  bot_lock_acquired = EXCLUDED.bot_lock_acquired,
  lock_key = EXCLUDED.lock_key,
  deploy_health_ok = EXCLUDED.deploy_health_ok,
  state_json = EXCLUDED.state_json,
  updated_at = now();

INSERT INTO runtime_deploy_events (
  state_key,
  event_type,
  event_json,
  created_by
)
VALUES (
  'active',
  'migration_v037_snapshot',
  jsonb_build_object(
    'note', 'initial deploy state snapshot created by migration',
    'created_at', now()
  ),
  0
);
