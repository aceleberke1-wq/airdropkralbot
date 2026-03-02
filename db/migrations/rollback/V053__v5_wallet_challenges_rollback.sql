-- Rollback for V053__v5_wallet_challenges.sql

DROP INDEX IF EXISTS idx_v5_wallet_challenges_expiry;
DROP INDEX IF EXISTS idx_v5_wallet_challenges_user_status_time;
DROP TABLE IF EXISTS v5_wallet_challenges;
