-- V014__virtual_token_economy.sql
-- In-bot virtual token purchase intents + approval flow (non-custodial, entitlement based)

CREATE TABLE IF NOT EXISTS token_purchase_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  token_symbol TEXT NOT NULL,
  chain TEXT NOT NULL,
  pay_currency TEXT NOT NULL,
  pay_address TEXT NOT NULL,
  usd_amount NUMERIC(18,8) NOT NULL,
  token_amount NUMERIC(18,8) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_payment',
  tx_hash TEXT,
  request_ref UUID NOT NULL UNIQUE,
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  admin_id BIGINT,
  admin_note TEXT
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'token_purchase_requests_status_check'
  ) THEN
    ALTER TABLE token_purchase_requests
      ADD CONSTRAINT token_purchase_requests_status_check
      CHECK (status IN ('pending_payment', 'tx_submitted', 'approved', 'rejected', 'expired'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'token_purchase_requests_amounts_positive_check'
  ) THEN
    ALTER TABLE token_purchase_requests
      ADD CONSTRAINT token_purchase_requests_amounts_positive_check
      CHECK (usd_amount > 0 AND token_amount > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_token_purchase_requests_user_created
  ON token_purchase_requests(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_token_purchase_requests_status_created
  ON token_purchase_requests(status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_token_purchase_requests_tx_hash_unique
  ON token_purchase_requests(tx_hash)
  WHERE tx_hash IS NOT NULL;
