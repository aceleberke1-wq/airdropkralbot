-- Rollback for V063__v5_intent_resolution_events.sql

DROP INDEX IF EXISTS idx_v5_intent_events_unknown_time;
DROP INDEX IF EXISTS idx_v5_intent_events_resolution_version;
DROP INDEX IF EXISTS idx_v5_intent_events_source_time;

ALTER TABLE IF EXISTS v5_intent_resolution_events
  DROP CONSTRAINT IF EXISTS ck_v5_intent_typo_distance_non_negative;

ALTER TABLE IF EXISTS v5_intent_resolution_events
  DROP COLUMN IF EXISTS mode_extracted,
  DROP COLUMN IF EXISTS typo_distance,
  DROP COLUMN IF EXISTS resolution_version,
  DROP COLUMN IF EXISTS intent_source;
