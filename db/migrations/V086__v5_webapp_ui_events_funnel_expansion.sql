-- V5.6 UI funnel expansion for revenue telemetry.

ALTER TABLE v5_webapp_ui_events
  ADD COLUMN IF NOT EXISTS funnel_key TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS surface_key TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS economy_event_key TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS value_usd NUMERIC(24,8) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tx_state TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_v5_webapp_ui_events_funnel_time
  ON v5_webapp_ui_events (funnel_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_webapp_ui_events_surface_time
  ON v5_webapp_ui_events (surface_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_webapp_ui_events_economy_time
  ON v5_webapp_ui_events (economy_event_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_webapp_ui_events_variant_funnel_time
  ON v5_webapp_ui_events (experiment_key, variant_key, funnel_key, created_at DESC);

