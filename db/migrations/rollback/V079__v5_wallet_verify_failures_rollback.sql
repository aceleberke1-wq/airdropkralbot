-- Rollback for V079__v5_wallet_verify_failures.sql

DROP INDEX IF EXISTS idx_v5_wallet_verify_failures_chain_time;
DROP INDEX IF EXISTS idx_v5_wallet_verify_failures_uid_time;
DROP INDEX IF EXISTS idx_v5_wallet_verify_failures_reason_time;
DROP TABLE IF EXISTS v5_wallet_verify_failures;
