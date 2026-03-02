-- V5 unified admin queue action events + idempotency keys.

CREATE TABLE IF NOT EXISTS v5_unified_admin_queue_action_events (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT '',
  request_id BIGINT NOT NULL,
  action_key TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'accepted',
  admin_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  confirm_token TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  tx_hash TEXT NOT NULL DEFAULT '',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_v5_unified_admin_queue_action_events_lookup
  ON v5_unified_admin_queue_action_events(kind, request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_unified_admin_queue_action_events_admin
  ON v5_unified_admin_queue_action_events(admin_user_id, created_at DESC);
