-- V5.3 HTTP request telemetry with latency/status rollups.

CREATE TABLE IF NOT EXISTS v5_http_request_events (
  id BIGSERIAL PRIMARY KEY,
  request_ref TEXT NOT NULL DEFAULT '',
  endpoint_path TEXT NOT NULL,
  route_group TEXT NOT NULL DEFAULT '',
  http_method TEXT NOT NULL DEFAULT 'GET',
  status_code INTEGER NOT NULL DEFAULT 200,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  request_size_bytes INTEGER NOT NULL DEFAULT 0,
  response_size_bytes INTEGER NOT NULL DEFAULT 0,
  actor_uid BIGINT NOT NULL DEFAULT 0,
  source_ip TEXT NOT NULL DEFAULT '',
  user_agent_hash TEXT NOT NULL DEFAULT '',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v5_http_request_events_path_time
  ON v5_http_request_events(endpoint_path, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_http_request_events_status_time
  ON v5_http_request_events(status_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_http_request_events_route_time
  ON v5_http_request_events(route_group, created_at DESC);
