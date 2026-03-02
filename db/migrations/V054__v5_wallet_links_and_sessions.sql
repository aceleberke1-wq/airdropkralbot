-- V5 wallet links and ephemeral sessions.

CREATE TABLE IF NOT EXISTS v5_wallet_links (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  chain TEXT NOT NULL,
  address_norm TEXT NOT NULL,
  address_display TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT true,
  verification_state TEXT NOT NULL DEFAULT 'verified_format',
  verification_method TEXT NOT NULL DEFAULT 'format_only',
  kyc_status TEXT NOT NULL DEFAULT 'unknown',
  risk_score NUMERIC(10, 6) NOT NULL DEFAULT 0,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unlinked_at TIMESTAMPTZ NULL,
  CONSTRAINT uq_v5_wallet_links_user_chain_address UNIQUE (user_id, chain, address_norm)
);

CREATE INDEX IF NOT EXISTS idx_v5_wallet_links_user_active
  ON v5_wallet_links(user_id, chain, updated_at DESC)
  WHERE unlinked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_v5_wallet_links_status
  ON v5_wallet_links(kyc_status, verification_state, updated_at DESC);

CREATE TABLE IF NOT EXISTS v5_wallet_sessions (
  id BIGSERIAL PRIMARY KEY,
  session_ref UUID NOT NULL UNIQUE,
  user_id BIGINT NOT NULL,
  chain TEXT NOT NULL,
  address_norm TEXT NOT NULL,
  proof_hash TEXT NOT NULL,
  source_challenge_ref UUID NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_v5_wallet_sessions_user_expiry
  ON v5_wallet_sessions(user_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_wallet_sessions_active
  ON v5_wallet_sessions(user_id, chain, address_norm, issued_at DESC)
  WHERE revoked_at IS NULL;
