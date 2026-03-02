-- Rollback for V074__v5_http_request_events.sql

DROP INDEX IF EXISTS idx_v5_http_request_events_route_time;
DROP INDEX IF EXISTS idx_v5_http_request_events_status_time;
DROP INDEX IF EXISTS idx_v5_http_request_events_path_time;
DROP TABLE IF EXISTS v5_http_request_events;
