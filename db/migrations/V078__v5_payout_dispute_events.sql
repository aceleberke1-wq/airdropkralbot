-- V5.3 payout dispute normalization and tracking.

CREATE TABLE IF NOT EXISTS v5_payout_dispute_events (
  id BIGSERIAL PRIMARY KEY,
  dispute_ref TEXT NOT NULL UNIQUE,
  payout_request_id BIGINT NOT NULL DEFAULT 0,
  uid BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  reason_code TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'normal',
  assigned_admin_id BIGINT NOT NULL DEFAULT 0,
  resolution_code TEXT NOT NULL DEFAULT '',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v5_payout_dispute_events_status_time
  ON v5_payout_dispute_events(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_payout_dispute_events_reason_time
  ON v5_payout_dispute_events(reason_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_payout_dispute_events_request_time
  ON v5_payout_dispute_events(payout_request_id, created_at DESC);
