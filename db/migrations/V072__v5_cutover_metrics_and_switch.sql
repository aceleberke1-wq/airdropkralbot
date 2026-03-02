-- V5.2 cutover compare metrics and primary switch event log.

CREATE TABLE IF NOT EXISTS v5_cutover_compare_metrics (
  id BIGSERIAL PRIMARY KEY,
  metric_key TEXT NOT NULL,
  stream_key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  v1_value NUMERIC(24, 8) NOT NULL DEFAULT 0,
  v5_value NUMERIC(24, 8) NOT NULL DEFAULT 0,
  delta_value NUMERIC(24, 8) NOT NULL DEFAULT 0,
  delta_ratio NUMERIC(24, 8) NOT NULL DEFAULT 0,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v5_cutover_compare_metrics_stream_time
  ON v5_cutover_compare_metrics(stream_key, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_cutover_compare_metrics_metric_time
  ON v5_cutover_compare_metrics(metric_key, recorded_at DESC);

CREATE TABLE IF NOT EXISTS v5_cutover_primary_switch_events (
  id BIGSERIAL PRIMARY KEY,
  switch_key TEXT NOT NULL,
  previous_primary_read_model TEXT NOT NULL DEFAULT 'v1',
  next_primary_read_model TEXT NOT NULL DEFAULT 'v5',
  shadow_enabled BOOLEAN NOT NULL DEFAULT true,
  switched_by BIGINT NOT NULL DEFAULT 0,
  reason_code TEXT NOT NULL DEFAULT '',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v5_cutover_primary_switch_events_time
  ON v5_cutover_primary_switch_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_cutover_primary_switch_events_switch
  ON v5_cutover_primary_switch_events(switch_key, created_at DESC);
