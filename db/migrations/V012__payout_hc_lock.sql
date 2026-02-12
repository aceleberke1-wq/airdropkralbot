-- Track payout source amount/rate to lock HC on request and allow deterministic refunds.

ALTER TABLE payout_requests
  ADD COLUMN IF NOT EXISTS source_hc_amount NUMERIC(18,8) NOT NULL DEFAULT 0;

ALTER TABLE payout_requests
  ADD COLUMN IF NOT EXISTS fx_rate_snapshot NUMERIC(18,12) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payout_requests_source_hc_non_negative_chk'
  ) THEN
    ALTER TABLE payout_requests
      ADD CONSTRAINT payout_requests_source_hc_non_negative_chk
      CHECK (source_hc_amount >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payout_requests_fx_rate_non_negative_chk'
  ) THEN
    ALTER TABLE payout_requests
      ADD CONSTRAINT payout_requests_fx_rate_non_negative_chk
      CHECK (fx_rate_snapshot >= 0);
  END IF;
END $$;
