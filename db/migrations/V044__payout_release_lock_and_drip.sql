-- V044__payout_release_lock_and_drip.sql
-- Adds daily drip accounting and lock snapshots for payout release model.

CREATE TABLE IF NOT EXISTS payout_release_daily_usage (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'BTC',
  day_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entitled_btc NUMERIC(18,8) NOT NULL DEFAULT 0,
  drip_cap_btc NUMERIC(18,8) NOT NULL DEFAULT 0,
  drip_used_btc NUMERIC(18,8) NOT NULL DEFAULT 0,
  drip_remaining_btc NUMERIC(18,8) NOT NULL DEFAULT 0,
  unlock_tier TEXT NOT NULL DEFAULT 'T0',
  unlock_score NUMERIC(6,5) NOT NULL DEFAULT 0,
  global_gate_open BOOLEAN NOT NULL DEFAULT FALSE,
  details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, currency, day_date)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payout_release_daily_usage_non_negative_check'
  ) THEN
    ALTER TABLE payout_release_daily_usage
      ADD CONSTRAINT payout_release_daily_usage_non_negative_check
      CHECK (
        entitled_btc >= 0
        AND drip_cap_btc >= 0
        AND drip_used_btc >= 0
        AND drip_remaining_btc >= 0
        AND unlock_score >= 0
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payout_release_daily_usage_user_day
  ON payout_release_daily_usage(user_id, day_date DESC);

CREATE INDEX IF NOT EXISTS idx_payout_release_daily_usage_currency_day
  ON payout_release_daily_usage(currency, day_date DESC);

