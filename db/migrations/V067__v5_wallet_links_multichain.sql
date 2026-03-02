-- V5.2 multichain wallet link primary-address model.

ALTER TABLE v5_wallet_links
  ADD COLUMN IF NOT EXISTS label TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_v5_wallet_links_user_chain_primary_active
  ON v5_wallet_links(user_id, chain)
  WHERE is_primary = true AND unlinked_at IS NULL;

CREATE TABLE IF NOT EXISTS v5_wallet_chain_primary_addresses (
  user_id BIGINT NOT NULL,
  chain TEXT NOT NULL,
  address_norm TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (user_id, chain)
);

INSERT INTO v5_wallet_chain_primary_addresses (user_id, chain, address_norm, payload_json)
SELECT
  wl.user_id,
  wl.chain,
  wl.address_norm,
  jsonb_build_object('source', 'wallet_links_primary_seed')
FROM v5_wallet_links wl
WHERE wl.is_primary = true
  AND wl.unlinked_at IS NULL
ON CONFLICT (user_id, chain)
DO UPDATE SET
  address_norm = EXCLUDED.address_norm,
  updated_at = now(),
  payload_json = COALESCE(v5_wallet_chain_primary_addresses.payload_json, '{}'::jsonb) || EXCLUDED.payload_json;

CREATE INDEX IF NOT EXISTS idx_v5_wallet_chain_primary_address
  ON v5_wallet_chain_primary_addresses(address_norm);
