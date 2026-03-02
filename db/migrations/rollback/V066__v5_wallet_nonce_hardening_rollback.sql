-- Rollback for V066__v5_wallet_nonce_hardening.sql

DROP INDEX IF EXISTS idx_v5_wallet_challenges_ref_user;
DROP INDEX IF EXISTS uq_v5_wallet_challenges_chain_nonce_hash_active;

ALTER TABLE IF EXISTS v5_wallet_challenges
  DROP CONSTRAINT IF EXISTS ck_v5_wallet_challenges_expiry_order;

ALTER TABLE IF EXISTS v5_wallet_challenges
  DROP COLUMN IF EXISTS nonce_hash;
