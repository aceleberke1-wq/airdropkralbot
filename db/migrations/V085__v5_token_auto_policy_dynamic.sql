-- V5.6 Dynamic segment policy for aggressive auto-approve guardrails.

CREATE TABLE IF NOT EXISTS v5_token_auto_policy_dynamic (
  id BIGSERIAL PRIMARY KEY,
  token_symbol TEXT NOT NULL DEFAULT 'NXT',
  segment_key TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  max_auto_usd NUMERIC(18,8) NOT NULL DEFAULT 10,
  risk_threshold NUMERIC(8,6) NOT NULL DEFAULT 0.35,
  velocity_per_hour INTEGER NOT NULL DEFAULT 8,
  require_onchain_verified BOOLEAN NOT NULL DEFAULT TRUE,
  require_kyc_status TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  degrade_factor NUMERIC(8,6) NOT NULL DEFAULT 1,
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (token_symbol, segment_key)
);

CREATE INDEX IF NOT EXISTS idx_v5_token_auto_policy_dynamic_priority
  ON v5_token_auto_policy_dynamic (token_symbol, priority ASC, segment_key ASC);

CREATE INDEX IF NOT EXISTS idx_v5_token_auto_policy_dynamic_enabled
  ON v5_token_auto_policy_dynamic (token_symbol, enabled, updated_at DESC);

CREATE TABLE IF NOT EXISTS v5_token_auto_policy_dynamic_audit (
  id BIGSERIAL PRIMARY KEY,
  token_symbol TEXT NOT NULL DEFAULT 'NXT',
  segment_key TEXT NOT NULL,
  previous_policy_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  next_policy_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  actor_id BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v5_token_auto_policy_dynamic_audit_token_time
  ON v5_token_auto_policy_dynamic_audit (token_symbol, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_token_auto_policy_dynamic_audit_actor_time
  ON v5_token_auto_policy_dynamic_audit (actor_id, created_at DESC);

INSERT INTO v5_token_auto_policy_dynamic (
  token_symbol,
  segment_key,
  priority,
  max_auto_usd,
  risk_threshold,
  velocity_per_hour,
  require_onchain_verified,
  require_kyc_status,
  enabled,
  degrade_factor,
  meta_json,
  updated_by
)
VALUES
  ('NXT', 's0_trusted', 10, 40, 0.35, 12, TRUE, '', TRUE, 1, '{"source":"migration_seed"}'::jsonb, 0),
  ('NXT', 's1_normal', 20, 20, 0.28, 8, TRUE, '', TRUE, 1, '{"source":"migration_seed"}'::jsonb, 0),
  ('NXT', 's2_watch', 30, 8, 0.20, 4, TRUE, '', TRUE, 0.9, '{"source":"migration_seed"}'::jsonb, 0),
  ('NXT', 's3_review', 40, 1, 0.12, 2, TRUE, '', TRUE, 0.75, '{"source":"migration_seed"}'::jsonb, 0),
  ('NXT', 's4_blocked', 50, 0.5, 0.05, 1, TRUE, 'verified', FALSE, 0.5, '{"source":"migration_seed"}'::jsonb, 0)
ON CONFLICT (token_symbol, segment_key) DO NOTHING;

