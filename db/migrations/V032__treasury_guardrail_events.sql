-- V032__treasury_guardrail_events.sql
-- Treasury guardrail trace extensions and runtime events.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'treasury_policy_history'
      AND column_name = 'guardrail_key'
  ) THEN
    ALTER TABLE treasury_policy_history
      ADD COLUMN guardrail_key TEXT NOT NULL DEFAULT 'default';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'treasury_policy_history'
      AND column_name = 'policy_version'
  ) THEN
    ALTER TABLE treasury_policy_history
      ADD COLUMN policy_version INT NOT NULL DEFAULT 1;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_treasury_policy_history_guardrail
  ON treasury_policy_history(token_symbol, guardrail_key, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payout_gate_snapshots'
      AND column_name = 'gate_reason'
  ) THEN
    ALTER TABLE payout_gate_snapshots
      ADD COLUMN gate_reason TEXT NOT NULL DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payout_gate_snapshots'
      AND column_name = 'policy_json'
  ) THEN
    ALTER TABLE payout_gate_snapshots
      ADD COLUMN policy_json JSONB NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payout_gate_snapshots_reason
  ON payout_gate_snapshots(gate_open, gate_reason, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'token_quote_traces'
      AND column_name = 'quote_source'
  ) THEN
    ALTER TABLE token_quote_traces
      ADD COLUMN quote_source TEXT NOT NULL DEFAULT 'curve';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'token_quote_traces'
      AND column_name = 'guardrail_state_json'
  ) THEN
    ALTER TABLE token_quote_traces
      ADD COLUMN guardrail_state_json JSONB NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_token_quote_traces_source_time
  ON token_quote_traces(quote_source, created_at DESC);

CREATE TABLE IF NOT EXISTS treasury_runtime_events (
  id BIGSERIAL PRIMARY KEY,
  token_symbol TEXT NOT NULL DEFAULT 'NXT',
  event_type TEXT NOT NULL DEFAULT 'runtime',
  event_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_treasury_runtime_events_symbol_time
  ON treasury_runtime_events(token_symbol, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_treasury_runtime_events_type_time
  ON treasury_runtime_events(event_type, created_at DESC);
