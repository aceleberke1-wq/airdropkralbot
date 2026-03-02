-- V5.2 intent resolution quality telemetry extensions.

ALTER TABLE v5_intent_resolution_events
  ADD COLUMN IF NOT EXISTS intent_source TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS resolution_version TEXT NOT NULL DEFAULT 'v5.2',
  ADD COLUMN IF NOT EXISTS typo_distance INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mode_extracted BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_v5_intent_typo_distance_non_negative'
  ) THEN
    ALTER TABLE v5_intent_resolution_events
      ADD CONSTRAINT ck_v5_intent_typo_distance_non_negative
      CHECK (typo_distance >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_v5_intent_events_source_time
  ON v5_intent_resolution_events(intent_source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_intent_events_resolution_version
  ON v5_intent_resolution_events(resolution_version, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_intent_events_unknown_time
  ON v5_intent_resolution_events(created_at DESC)
  WHERE matched_key = '';
