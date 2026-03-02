-- V5.2 monetization ledger references (pass/cosmetic/fee).

CREATE TABLE IF NOT EXISTS v5_monetization_ledger (
  id BIGSERIAL PRIMARY KEY,
  event_ref TEXT NOT NULL UNIQUE,
  user_id BIGINT NOT NULL,
  event_kind TEXT NOT NULL,
  source_table TEXT NOT NULL DEFAULT '',
  source_id BIGINT NOT NULL DEFAULT 0,
  amount NUMERIC(24, 8) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'SC',
  status TEXT NOT NULL DEFAULT 'recorded',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v5_monetization_ledger_user_time
  ON v5_monetization_ledger(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_monetization_ledger_kind_status
  ON v5_monetization_ledger(event_kind, status, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_v5_monetization_ledger_event_kind'
  ) THEN
    ALTER TABLE v5_monetization_ledger
      ADD CONSTRAINT ck_v5_monetization_ledger_event_kind
      CHECK (event_kind IN ('pass_purchase', 'cosmetic_purchase', 'marketplace_fee'));
  END IF;
END $$;
