-- Payout flow integrity and performance improvements.

CREATE UNIQUE INDEX IF NOT EXISTS payout_tx_request_unique_idx
  ON payout_tx(payout_request_id);

CREATE INDEX IF NOT EXISTS payout_requests_status_created_idx
  ON payout_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS payout_requests_user_currency_idx
  ON payout_requests(user_id, currency, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payout_requests_amount_positive_chk'
  ) THEN
    ALTER TABLE payout_requests
      ADD CONSTRAINT payout_requests_amount_positive_chk
      CHECK (amount > 0);
  END IF;
END $$;
