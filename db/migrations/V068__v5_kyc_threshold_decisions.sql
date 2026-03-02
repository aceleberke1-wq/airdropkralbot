-- V5.2 threshold KYC decision log model.

CREATE TABLE IF NOT EXISTS v5_kyc_threshold_decisions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  decision_key TEXT NOT NULL,
  status_before TEXT NOT NULL DEFAULT '',
  status_after TEXT NOT NULL DEFAULT '',
  tier_before TEXT NOT NULL DEFAULT '',
  tier_after TEXT NOT NULL DEFAULT '',
  reason_code TEXT NOT NULL DEFAULT '',
  risk_score NUMERIC(10, 6) NOT NULL DEFAULT 0,
  amount_btc NUMERIC(24, 8) NOT NULL DEFAULT 0,
  requires_manual_review BOOLEAN NOT NULL DEFAULT false,
  decided_by BIGINT NOT NULL DEFAULT 0,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v5_kyc_threshold_decisions_user_time
  ON v5_kyc_threshold_decisions(user_id, decided_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_kyc_threshold_decisions_reason
  ON v5_kyc_threshold_decisions(reason_code, decided_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_kyc_threshold_decisions_manual
  ON v5_kyc_threshold_decisions(requires_manual_review, decided_at DESC);
