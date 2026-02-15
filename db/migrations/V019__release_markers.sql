-- V019__release_markers.sql
-- Deployment revision markers with health/config snapshot for release traceability.

CREATE TABLE IF NOT EXISTS release_markers (
  id BIGSERIAL PRIMARY KEY,
  release_ref UUID NOT NULL UNIQUE,
  git_revision TEXT NOT NULL,
  deploy_id TEXT NOT NULL DEFAULT '',
  environment TEXT NOT NULL DEFAULT 'production',
  config_version BIGINT NOT NULL DEFAULT 0,
  health_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_release_markers_created
  ON release_markers(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_release_markers_git_revision
  ON release_markers(git_revision, created_at DESC);
