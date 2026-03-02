-- V5.2 wallet challenge nonce hardening.

ALTER TABLE v5_wallet_challenges
  ADD COLUMN IF NOT EXISTS nonce_hash TEXT NOT NULL DEFAULT '';

UPDATE v5_wallet_challenges
SET nonce_hash = md5(COALESCE(nonce, ''))
WHERE COALESCE(nonce_hash, '') = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_v5_wallet_challenges_expiry_order'
  ) THEN
    ALTER TABLE v5_wallet_challenges
      ADD CONSTRAINT ck_v5_wallet_challenges_expiry_order
      CHECK (expires_at > issued_at);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_v5_wallet_challenges_chain_nonce_hash_active
  ON v5_wallet_challenges(chain, nonce_hash)
  WHERE status IN ('pending', 'verified');

CREATE INDEX IF NOT EXISTS idx_v5_wallet_challenges_ref_user
  ON v5_wallet_challenges(challenge_ref, user_id);
