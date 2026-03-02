-- Rollback for V075__v5_webapp_ui_events.sql

DROP INDEX IF EXISTS idx_v5_webapp_ui_events_event_time;
DROP INDEX IF EXISTS idx_v5_webapp_ui_events_tab_time;
DROP INDEX IF EXISTS idx_v5_webapp_ui_events_uid_time;
DROP TABLE IF EXISTS v5_webapp_ui_events;
