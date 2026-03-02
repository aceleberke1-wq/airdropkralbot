-- V5 SLO and operational metric rollups.

CREATE TABLE IF NOT EXISTS v5_operational_slo_metrics (
  id BIGSERIAL PRIMARY KEY,
  metric_key TEXT NOT NULL,
  metric_value NUMERIC(24, 8) NOT NULL DEFAULT 0,
  sample_size BIGINT NOT NULL DEFAULT 0,
  window_key TEXT NOT NULL DEFAULT 'daily',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v5_operational_slo_metrics_key_time
  ON v5_operational_slo_metrics(metric_key, measured_at DESC);

CREATE TABLE IF NOT EXISTS v5_operational_slo_alerts (
  id BIGSERIAL PRIMARY KEY,
  metric_key TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warn',
  status TEXT NOT NULL DEFAULT 'open',
  threshold_value NUMERIC(24, 8) NOT NULL DEFAULT 0,
  observed_value NUMERIC(24, 8) NOT NULL DEFAULT 0,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_v5_operational_slo_alerts_status_time
  ON v5_operational_slo_alerts(status, opened_at DESC);
