-- Rollback for V065__v5_admin_confirm_tokens.sql

DROP INDEX IF EXISTS idx_v5_admin_action_cooldowns_action;
DROP TABLE IF EXISTS v5_admin_action_cooldowns;

DROP INDEX IF EXISTS idx_v5_admin_confirm_tokens_expiry;
DROP INDEX IF EXISTS idx_v5_admin_confirm_tokens_lookup;
DROP TABLE IF EXISTS v5_admin_confirm_tokens;
