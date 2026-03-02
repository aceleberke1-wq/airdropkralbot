-- V5.3 KPI bundle run metadata and execution history.

CREATE TABLE IF NOT EXISTS v5_kpi_bundle_runs (
  id BIGSERIAL PRIMARY KEY,
  run_ref TEXT NOT NULL UNIQUE,
  requested_by BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued',
  trigger_source TEXT NOT NULL DEFAULT 'manual',
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  error_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v5_kpi_bundle_runs_status_time
  ON v5_kpi_bundle_runs(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_kpi_bundle_runs_requested_by_time
  ON v5_kpi_bundle_runs(requested_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_kpi_bundle_runs_trigger_time
  ON v5_kpi_bundle_runs(trigger_source, created_at DESC);
