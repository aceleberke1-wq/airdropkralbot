-- V5.2 admin critical confirmation tokens and cooldown state.

CREATE TABLE IF NOT EXISTS v5_admin_confirm_tokens (
  id BIGSERIAL PRIMARY KEY,
  confirm_token TEXT NOT NULL UNIQUE,
  admin_id BIGINT NOT NULL,
  action_key TEXT NOT NULL,
  signature TEXT NOT NULL DEFAULT '',
  payload_hash TEXT NOT NULL DEFAULT '',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ NULL,
  status TEXT NOT NULL DEFAULT 'issued',
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_v5_admin_confirm_tokens_lookup
  ON v5_admin_confirm_tokens(admin_id, action_key, status, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_admin_confirm_tokens_expiry
  ON v5_admin_confirm_tokens(expires_at);

CREATE TABLE IF NOT EXISTS v5_admin_action_cooldowns (
  admin_id BIGINT NOT NULL,
  action_key TEXT NOT NULL,
  cooldown_ms INT NOT NULL DEFAULT 0,
  last_action_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (admin_id, action_key)
);

CREATE INDEX IF NOT EXISTS idx_v5_admin_action_cooldowns_action
  ON v5_admin_action_cooldowns(action_key, last_action_at DESC);
