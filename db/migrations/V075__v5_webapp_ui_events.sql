-- V5.3 WebApp UI usage/funnel telemetry.

CREATE TABLE IF NOT EXISTS v5_webapp_ui_events (
  id BIGSERIAL PRIMARY KEY,
  uid BIGINT NOT NULL DEFAULT 0,
  session_ref TEXT NOT NULL DEFAULT '',
  tab_key TEXT NOT NULL DEFAULT '',
  panel_key TEXT NOT NULL DEFAULT '',
  event_key TEXT NOT NULL,
  event_value NUMERIC(24, 8) NOT NULL DEFAULT 0,
  language TEXT NOT NULL DEFAULT 'tr',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v5_webapp_ui_events_uid_time
  ON v5_webapp_ui_events(uid, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_webapp_ui_events_tab_time
  ON v5_webapp_ui_events(tab_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_webapp_ui_events_event_time
  ON v5_webapp_ui_events(event_key, created_at DESC);
