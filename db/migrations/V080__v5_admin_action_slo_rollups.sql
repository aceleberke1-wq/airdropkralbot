-- V5.3 admin action SLO rollups (confirmation/cooldown latency).

CREATE TABLE IF NOT EXISTS v5_admin_action_slo_rollups (
  id BIGSERIAL PRIMARY KEY,
  metric_day DATE NOT NULL,
  action_key TEXT NOT NULL,
  total_events BIGINT NOT NULL DEFAULT 0,
  confirmation_required_events BIGINT NOT NULL DEFAULT 0,
  cooldown_block_events BIGINT NOT NULL DEFAULT 0,
  success_events BIGINT NOT NULL DEFAULT 0,
  p50_latency_ms NUMERIC(16, 4) NOT NULL DEFAULT 0,
  p95_latency_ms NUMERIC(16, 4) NOT NULL DEFAULT 0,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_v5_admin_action_slo_rollups_unique
  ON v5_admin_action_slo_rollups(metric_day, action_key);

CREATE INDEX IF NOT EXISTS idx_v5_admin_action_slo_rollups_action_day
  ON v5_admin_action_slo_rollups(action_key, metric_day DESC);
