-- Rollback for V054__v5_wallet_links_and_sessions.sql

DROP INDEX IF EXISTS idx_v5_wallet_sessions_active;
DROP INDEX IF EXISTS idx_v5_wallet_sessions_user_expiry;
DROP TABLE IF EXISTS v5_wallet_sessions;

DROP INDEX IF EXISTS idx_v5_wallet_links_status;
DROP INDEX IF EXISTS idx_v5_wallet_links_user_active;
DROP TABLE IF EXISTS v5_wallet_links;
