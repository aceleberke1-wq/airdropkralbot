-- V5 wallet challenge lifecycle storage.

CREATE TABLE IF NOT EXISTS v5_wallet_challenges (
  id BIGSERIAL PRIMARY KEY,
  challenge_ref UUID NOT NULL UNIQUE,
  user_id BIGINT NOT NULL,
  chain TEXT NOT NULL,
  address_norm TEXT NOT NULL,
  nonce TEXT NOT NULL,
  challenge_text TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  consumed_at TIMESTAMPTZ NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v5_wallet_challenges_user_status_time
  ON v5_wallet_challenges(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_wallet_challenges_expiry
  ON v5_wallet_challenges(expires_at);
