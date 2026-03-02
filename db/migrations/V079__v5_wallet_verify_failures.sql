-- V5.3 wallet verification failure telemetry with reason codes.

CREATE TABLE IF NOT EXISTS v5_wallet_verify_failures (
  id BIGSERIAL PRIMARY KEY,
  challenge_ref TEXT NOT NULL DEFAULT '',
  uid BIGINT NOT NULL DEFAULT 0,
  chain TEXT NOT NULL DEFAULT '',
  address_masked TEXT NOT NULL DEFAULT '',
  reason_code TEXT NOT NULL,
  reason_text TEXT NOT NULL DEFAULT '',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v5_wallet_verify_failures_reason_time
  ON v5_wallet_verify_failures(reason_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_wallet_verify_failures_uid_time
  ON v5_wallet_verify_failures(uid, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_wallet_verify_failures_chain_time
  ON v5_wallet_verify_failures(chain, created_at DESC);
