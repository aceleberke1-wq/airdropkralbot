-- V5 KYC profile and screening log tables.

CREATE TABLE IF NOT EXISTS v5_kyc_profiles (
  user_id BIGINT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'unknown',
  tier TEXT NOT NULL DEFAULT 'none',
  provider_ref TEXT NOT NULL DEFAULT '',
  last_reviewed_at TIMESTAMPTZ NULL,
  expires_at TIMESTAMPTZ NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v5_kyc_profiles_status_updated
  ON v5_kyc_profiles(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS v5_kyc_screening_events (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  chain TEXT NOT NULL,
  address_norm TEXT NOT NULL,
  screening_result TEXT NOT NULL DEFAULT 'pending',
  risk_score NUMERIC(10, 6) NOT NULL DEFAULT 0,
  reason_code TEXT NOT NULL DEFAULT '',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v5_kyc_screening_user_time
  ON v5_kyc_screening_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_kyc_screening_result
  ON v5_kyc_screening_events(screening_result, created_at DESC);
