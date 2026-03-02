-- V5 primary read path switch and shadow comparison state.

CREATE TABLE IF NOT EXISTS v5_cutover_read_switch (
  id BIGSERIAL PRIMARY KEY,
  switch_key TEXT NOT NULL UNIQUE,
  primary_read_model TEXT NOT NULL DEFAULT 'v1',
  shadow_enabled BOOLEAN NOT NULL DEFAULT true,
  shadow_model TEXT NOT NULL DEFAULT 'v5',
  switched_by BIGINT NOT NULL DEFAULT 0,
  switched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS v5_cutover_read_diffs (
  id BIGSERIAL PRIMARY KEY,
  switch_key TEXT NOT NULL,
  stream_key TEXT NOT NULL,
  entity_ref TEXT NOT NULL,
  diff_score NUMERIC(12, 6) NOT NULL DEFAULT 0,
  diff_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v5_cutover_read_diffs_switch_time
  ON v5_cutover_read_diffs(switch_key, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_cutover_read_diffs_stream_entity
  ON v5_cutover_read_diffs(stream_key, entity_ref, recorded_at DESC);
