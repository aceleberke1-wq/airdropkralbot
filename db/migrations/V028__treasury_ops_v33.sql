-- V028__treasury_ops_v33.sql
-- Treasury policy and payout gate operational traces for production audits.

CREATE TABLE IF NOT EXISTS treasury_policy_history (
  id BIGSERIAL PRIMARY KEY,
  token_symbol TEXT NOT NULL DEFAULT 'NXT',
  source TEXT NOT NULL DEFAULT 'runtime',
  actor_id BIGINT NOT NULL DEFAULT 0,
  previous_policy_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  next_policy_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_treasury_policy_history_symbol_time
  ON treasury_policy_history(token_symbol, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_treasury_policy_history_source_time
  ON treasury_policy_history(source, created_at DESC);

CREATE TABLE IF NOT EXISTS payout_gate_snapshots (
  id BIGSERIAL PRIMARY KEY,
  token_symbol TEXT NOT NULL DEFAULT 'NXT',
  gate_open BOOLEAN NOT NULL DEFAULT FALSE,
  market_cap_usd NUMERIC(24,8) NOT NULL DEFAULT 0,
  min_market_cap_usd NUMERIC(24,8) NOT NULL DEFAULT 0,
  target_market_cap_max_usd NUMERIC(24,8) NOT NULL DEFAULT 0,
  snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_payout_gate_snapshots_symbol_time
  ON payout_gate_snapshots(token_symbol, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payout_gate_snapshots_open_time
  ON payout_gate_snapshots(gate_open, created_at DESC);

CREATE TABLE IF NOT EXISTS token_quote_traces (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  token_symbol TEXT NOT NULL DEFAULT 'NXT',
  chain TEXT NOT NULL DEFAULT '',
  usd_amount NUMERIC(24,8) NOT NULL DEFAULT 0,
  token_amount NUMERIC(24,8) NOT NULL DEFAULT 0,
  price_usd NUMERIC(24,8) NOT NULL DEFAULT 0,
  curve_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  gate_open BOOLEAN NOT NULL DEFAULT FALSE,
  risk_score NUMERIC(10,6) NOT NULL DEFAULT 0,
  velocity_per_hour INT NOT NULL DEFAULT 0,
  trace_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_token_quote_traces_user_time
  ON token_quote_traces(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_token_quote_traces_symbol_time
  ON token_quote_traces(token_symbol, created_at DESC);
