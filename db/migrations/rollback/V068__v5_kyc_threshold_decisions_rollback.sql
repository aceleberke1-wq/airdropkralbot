-- Rollback for V068__v5_kyc_threshold_decisions.sql

DROP INDEX IF EXISTS idx_v5_kyc_threshold_decisions_manual;
DROP INDEX IF EXISTS idx_v5_kyc_threshold_decisions_reason;
DROP INDEX IF EXISTS idx_v5_kyc_threshold_decisions_user_time;
DROP TABLE IF EXISTS v5_kyc_threshold_decisions;
