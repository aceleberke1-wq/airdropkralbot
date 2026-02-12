-- Monetization and macro loop support.

CREATE TABLE IF NOT EXISTS user_effects (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  effect_key TEXT NOT NULL,
  effect_level INT NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ NOT NULL,
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_effects_user_idx
  ON user_effects(user_id, effect_key, expires_at DESC);

CREATE INDEX IF NOT EXISTS offers_active_idx
  ON offers(start_at, end_at);

CREATE INDEX IF NOT EXISTS purchases_user_status_idx
  ON purchases(user_id, status, created_at DESC);
