-- V016__token_market_curve.sql
-- Dynamic token market state, pricing ticks, and semi-auto treasury decisions.

CREATE TABLE IF NOT EXISTS token_market_state (
  token_symbol TEXT PRIMARY KEY,
  admin_floor_usd NUMERIC(18,8) NOT NULL DEFAULT 0.00050000,
  curve_base_usd NUMERIC(18,8) NOT NULL DEFAULT 0.00050000,
  curve_k NUMERIC(18,8) NOT NULL DEFAULT 0.08000000,
  supply_norm_divisor NUMERIC(18,8) NOT NULL DEFAULT 100000.00000000,
  demand_factor NUMERIC(18,8) NOT NULL DEFAULT 1.00000000,
  volatility_dampen NUMERIC(18,8) NOT NULL DEFAULT 0.15000000,
  auto_policy_json JSONB NOT NULL DEFAULT '{
    "auto_usd_limit": 10,
    "risk_threshold": 0.35,
    "velocity_per_hour": 8,
    "require_onchain_verified": true
  }'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT NOT NULL DEFAULT 0
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'token_market_state_floor_positive_check'
  ) THEN
    ALTER TABLE token_market_state
      ADD CONSTRAINT token_market_state_floor_positive_check
      CHECK (
        admin_floor_usd > 0
        AND curve_base_usd > 0
        AND curve_k >= 0
        AND supply_norm_divisor > 0
        AND demand_factor > 0
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS token_price_ticks (
  id BIGSERIAL PRIMARY KEY,
  token_symbol TEXT NOT NULL,
  supply_total NUMERIC(24,8) NOT NULL DEFAULT 0,
  demand_factor NUMERIC(18,8) NOT NULL DEFAULT 1,
  admin_floor_usd NUMERIC(18,8) NOT NULL DEFAULT 0,
  price_usd NUMERIC(18,8) NOT NULL DEFAULT 0,
  context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_token_price_ticks_symbol_created
  ON token_price_ticks(token_symbol, created_at DESC);

CREATE TABLE IF NOT EXISTS token_auto_decisions (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT REFERENCES token_purchase_requests(id) ON DELETE SET NULL,
  token_symbol TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  policy_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_score NUMERIC(6,5) NOT NULL DEFAULT 0,
  usd_amount NUMERIC(18,8) NOT NULL DEFAULT 0,
  tx_hash TEXT,
  decided_by TEXT NOT NULL DEFAULT 'system',
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'token_auto_decisions_decision_check'
  ) THEN
    ALTER TABLE token_auto_decisions
      ADD CONSTRAINT token_auto_decisions_decision_check
      CHECK (decision IN ('auto_approved', 'manual_review', 'auto_rejected', 'skipped'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_token_auto_decisions_decision_time
  ON token_auto_decisions(decision, decided_at DESC);

CREATE INDEX IF NOT EXISTS idx_token_auto_decisions_request
  ON token_auto_decisions(request_id, decided_at DESC);

CREATE TABLE IF NOT EXISTS token_liquidity_snapshots (
  id BIGSERIAL PRIMARY KEY,
  token_symbol TEXT NOT NULL,
  total_supply NUMERIC(24,8) NOT NULL DEFAULT 0,
  holders INT NOT NULL DEFAULT 0,
  market_cap_usd NUMERIC(24,8) NOT NULL DEFAULT 0,
  gate_open BOOLEAN NOT NULL DEFAULT FALSE,
  gate_min_cap_usd NUMERIC(24,8) NOT NULL DEFAULT 0,
  snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_token_liquidity_snapshots_symbol_created
  ON token_liquidity_snapshots(token_symbol, created_at DESC);

INSERT INTO token_market_state (token_symbol)
VALUES ('NXT')
ON CONFLICT (token_symbol) DO NOTHING;
