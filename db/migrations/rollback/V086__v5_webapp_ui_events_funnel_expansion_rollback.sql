DROP INDEX IF EXISTS idx_v5_webapp_ui_events_variant_funnel_time;
DROP INDEX IF EXISTS idx_v5_webapp_ui_events_economy_time;
DROP INDEX IF EXISTS idx_v5_webapp_ui_events_surface_time;
DROP INDEX IF EXISTS idx_v5_webapp_ui_events_funnel_time;

ALTER TABLE v5_webapp_ui_events
  DROP COLUMN IF EXISTS tx_state,
  DROP COLUMN IF EXISTS value_usd,
  DROP COLUMN IF EXISTS economy_event_key,
  DROP COLUMN IF EXISTS surface_key,
  DROP COLUMN IF EXISTS funnel_key;

