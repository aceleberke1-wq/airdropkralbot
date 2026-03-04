DROP INDEX IF EXISTS uq_v5_webapp_ui_events_idempotency_key;
DROP INDEX IF EXISTS idx_v5_webapp_ui_events_ingest_time;
DROP INDEX IF EXISTS idx_v5_webapp_ui_events_route_time;
DROP INDEX IF EXISTS idx_v5_webapp_ui_events_variant_time;

ALTER TABLE v5_webapp_ui_events
  DROP COLUMN IF EXISTS event_seq,
  DROP COLUMN IF EXISTS client_ts,
  DROP COLUMN IF EXISTS idempotency_key,
  DROP COLUMN IF EXISTS ingest_id,
  DROP COLUMN IF EXISTS cohort_bucket,
  DROP COLUMN IF EXISTS experiment_key,
  DROP COLUMN IF EXISTS variant_key,
  DROP COLUMN IF EXISTS route_key;
