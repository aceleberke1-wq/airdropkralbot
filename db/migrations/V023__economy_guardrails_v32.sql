-- V023__economy_guardrails_v32.sql
-- Treasury and payout guardrails with velocity tracking buckets.

CREATE TABLE IF NOT EXISTS treasury_guardrails (
  token_symbol TEXT PRIMARY KEY,
  min_market_cap_usd NUMERIC(24,8) NOT NULL DEFAULT 10000000,
  target_market_cap_max_usd NUMERIC(24,8) NOT NULL DEFAULT 20000000,
  auto_usd_limit NUMERIC(18,8) NOT NULL DEFAULT 10,
  risk_threshold NUMERIC(10,6) NOT NULL DEFAULT 0.35,
  velocity_per_hour INT NOT NULL DEFAULT 8,
  require_onchain_verified BOOLEAN NOT NULL DEFAULT TRUE,
  guardrail_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT NOT NULL DEFAULT 0
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'treasury_guardrails_positive_check'
  ) THEN
    ALTER TABLE treasury_guardrails
      ADD CONSTRAINT treasury_guardrails_positive_check
      CHECK (
        min_market_cap_usd >= 0
        AND target_market_cap_max_usd >= 0
        AND auto_usd_limit >= 0
        AND risk_threshold >= 0
        AND risk_threshold <= 1
        AND velocity_per_hour > 0
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS payout_gate_events (
  id BIGSERIAL PRIMARY KEY,
  token_symbol TEXT NOT NULL DEFAULT 'NXT',
  gate_open BOOLEAN NOT NULL DEFAULT FALSE,
  reason TEXT NOT NULL DEFAULT '',
  market_cap_usd NUMERIC(24,8) NOT NULL DEFAULT 0,
  event_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_payout_gate_events_symbol_time
  ON payout_gate_events(token_symbol, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payout_gate_events_gate_time
  ON payout_gate_events(gate_open, created_at DESC);

CREATE TABLE IF NOT EXISTS velocity_buckets (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bucket_hour TIMESTAMPTZ NOT NULL,
  action_key TEXT NOT NULL,
  counter INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, bucket_hour, action_key)
);

CREATE INDEX IF NOT EXISTS idx_velocity_buckets_hour_action
  ON velocity_buckets(bucket_hour DESC, action_key);

INSERT INTO treasury_guardrails (
  token_symbol,
  min_market_cap_usd,
  target_market_cap_max_usd,
  auto_usd_limit,
  risk_threshold,
  velocity_per_hour,
  require_onchain_verified
)
VALUES ('NXT', 10000000, 20000000, 10, 0.35, 8, TRUE)
ON CONFLICT (token_symbol) DO NOTHING;

INSERT INTO feature_flags (flag_key, is_enabled, note)
VALUES
  ('RAID_AUTH_ENABLED', FALSE, 'Authoritative raid sessions'),
  ('WEBAPP_TS_BUNDLE_ENABLED', FALSE, 'Serve TypeScript bundle from webapp/dist')
ON CONFLICT (flag_key) DO NOTHING;
