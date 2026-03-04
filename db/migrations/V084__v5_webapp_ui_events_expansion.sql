-- V5.5 Expand webapp ui events for experiment and route analytics.

ALTER TABLE v5_webapp_ui_events
  ADD COLUMN IF NOT EXISTS route_key TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS variant_key TEXT NOT NULL DEFAULT 'control',
  ADD COLUMN IF NOT EXISTS experiment_key TEXT NOT NULL DEFAULT 'webapp_react_v1',
  ADD COLUMN IF NOT EXISTS cohort_bucket SMALLINT NOT NULL DEFAULT 0 CHECK (cohort_bucket >= 0 AND cohort_bucket <= 99),
  ADD COLUMN IF NOT EXISTS ingest_id TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS client_ts TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS event_seq INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_v5_webapp_ui_events_variant_time
  ON v5_webapp_ui_events(experiment_key, variant_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_webapp_ui_events_route_time
  ON v5_webapp_ui_events(route_key, tab_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_webapp_ui_events_ingest_time
  ON v5_webapp_ui_events(ingest_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_v5_webapp_ui_events_idempotency_key
  ON v5_webapp_ui_events(idempotency_key)
  WHERE idempotency_key IS NOT NULL AND idempotency_key <> '';
