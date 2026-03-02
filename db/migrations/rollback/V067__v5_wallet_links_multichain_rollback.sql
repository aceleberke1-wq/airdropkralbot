-- Rollback for V067__v5_wallet_links_multichain.sql

DROP INDEX IF EXISTS idx_v5_wallet_chain_primary_address;
DROP TABLE IF EXISTS v5_wallet_chain_primary_addresses;

DROP INDEX IF EXISTS uq_v5_wallet_links_user_chain_primary_active;

ALTER TABLE IF EXISTS v5_wallet_links
  DROP COLUMN IF EXISTS label;
