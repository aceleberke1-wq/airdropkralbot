-- V5 cutover compatibility metrics and snapshots.

CREATE TABLE IF NOT EXISTS v5_cutover_compat_metrics (
  id BIGSERIAL PRIMARY KEY,
  metric_key TEXT NOT NULL,
  metric_value NUMERIC(24, 8) NOT NULL DEFAULT 0,
  sample_size BIGINT NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'system',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v5_cutover_compat_metrics_key_time
  ON v5_cutover_compat_metrics(metric_key, measured_at DESC);

CREATE TABLE IF NOT EXISTS v5_cutover_readiness_snapshots (
  id BIGSERIAL PRIMARY KEY,
  snapshot_key TEXT NOT NULL UNIQUE,
  readiness_score NUMERIC(12, 6) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  checks_total INT NOT NULL DEFAULT 0,
  checks_passing INT NOT NULL DEFAULT 0,
  notes_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v5_cutover_readiness_status_time
  ON v5_cutover_readiness_snapshots(status, created_at DESC);
