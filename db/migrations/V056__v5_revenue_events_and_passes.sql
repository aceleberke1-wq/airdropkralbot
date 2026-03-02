-- V5 monetization core tables (pass, cosmetics, marketplace fee events).

CREATE TABLE IF NOT EXISTS v5_pass_products (
  id BIGSERIAL PRIMARY KEY,
  pass_key TEXT NOT NULL UNIQUE,
  title_tr TEXT NOT NULL,
  title_en TEXT NOT NULL,
  duration_days INT NOT NULL,
  price_amount NUMERIC(18, 8) NOT NULL,
  price_currency TEXT NOT NULL,
  effects_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS v5_user_passes (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  pass_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  purchase_ref TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_v5_user_pass_purchase_ref UNIQUE (purchase_ref)
);

CREATE INDEX IF NOT EXISTS idx_v5_user_passes_user_status_expiry
  ON v5_user_passes(user_id, status, expires_at DESC);

CREATE TABLE IF NOT EXISTS v5_cosmetic_purchases (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  item_key TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'cosmetic',
  amount_paid NUMERIC(18, 8) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'SC',
  purchase_ref TEXT NOT NULL UNIQUE,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v5_cosmetic_purchases_user_time
  ON v5_cosmetic_purchases(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS v5_marketplace_fee_events (
  id BIGSERIAL PRIMARY KEY,
  event_ref TEXT NOT NULL UNIQUE,
  user_id BIGINT NOT NULL,
  fee_kind TEXT NOT NULL,
  gross_amount NUMERIC(18, 8) NOT NULL DEFAULT 0,
  fee_amount NUMERIC(18, 8) NOT NULL DEFAULT 0,
  fee_currency TEXT NOT NULL DEFAULT 'SC',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v5_marketplace_fee_events_user_time
  ON v5_marketplace_fee_events(user_id, created_at DESC);
