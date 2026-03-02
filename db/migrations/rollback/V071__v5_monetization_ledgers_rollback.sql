-- Rollback for V071__v5_monetization_ledgers.sql

ALTER TABLE IF EXISTS v5_monetization_ledger
  DROP CONSTRAINT IF EXISTS ck_v5_monetization_ledger_event_kind;

DROP INDEX IF EXISTS idx_v5_monetization_ledger_kind_status;
DROP INDEX IF EXISTS idx_v5_monetization_ledger_user_time;
DROP TABLE IF EXISTS v5_monetization_ledger;
