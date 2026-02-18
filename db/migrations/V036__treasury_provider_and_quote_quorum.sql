-- V036__treasury_provider_and_quote_quorum.sql
-- Quote provider observability, quorum decisions, and trace hardening.

CREATE TABLE IF NOT EXISTS quote_provider_health (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  endpoint TEXT NOT NULL DEFAULT '',
  check_name TEXT NOT NULL DEFAULT 'quote',
  ok BOOLEAN NOT NULL DEFAULT FALSE,
  status_code INT NOT NULL DEFAULT 0,
  latency_ms INT NOT NULL DEFAULT 0,
  error_code TEXT NOT NULL DEFAULT '',
  error_message TEXT NOT NULL DEFAULT '',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_provider_health_provider_time
  ON quote_provider_health(provider, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_quote_provider_health_ok_time
  ON quote_provider_health(ok, checked_at DESC);

CREATE TABLE IF NOT EXISTS quote_provider_responses (
  id BIGSERIAL PRIMARY KEY,
  request_ref TEXT NOT NULL,
  provider TEXT NOT NULL,
  symbol TEXT NOT NULL DEFAULT 'NXT',
  chain TEXT NOT NULL DEFAULT 'BTC',
  usd_amount NUMERIC(24,10) NOT NULL DEFAULT 0,
  token_amount NUMERIC(24,10) NOT NULL DEFAULT 0,
  price_usd NUMERIC(24,10) NOT NULL DEFAULT 0,
  confidence NUMERIC(12,6) NOT NULL DEFAULT 0,
  latency_ms INT NOT NULL DEFAULT 0,
  ok BOOLEAN NOT NULL DEFAULT FALSE,
  response_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (request_ref, provider)
);

CREATE INDEX IF NOT EXISTS idx_quote_provider_responses_request
  ON quote_provider_responses(request_ref, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quote_provider_responses_provider
  ON quote_provider_responses(provider, created_at DESC);

CREATE TABLE IF NOT EXISTS quote_quorum_decisions (
  id BIGSERIAL PRIMARY KEY,
  request_ref TEXT NOT NULL UNIQUE,
  token_symbol TEXT NOT NULL DEFAULT 'NXT',
  chain TEXT NOT NULL DEFAULT 'BTC',
  usd_amount NUMERIC(24,10) NOT NULL DEFAULT 0,
  chosen_price_usd NUMERIC(24,10) NOT NULL DEFAULT 0,
  quorum_price_usd NUMERIC(24,10) NOT NULL DEFAULT 0,
  provider_count INT NOT NULL DEFAULT 0,
  ok_provider_count INT NOT NULL DEFAULT 0,
  agreement_ratio NUMERIC(12,6) NOT NULL DEFAULT 0,
  decision TEXT NOT NULL DEFAULT 'curve_only',
  decision_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quote_quorum_decisions_decision_check'
  ) THEN
    ALTER TABLE quote_quorum_decisions
      ADD CONSTRAINT quote_quorum_decisions_decision_check
      CHECK (decision IN ('curve_only', 'provider_quorum', 'fallback', 'blocked'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_quote_quorum_decisions_token_time
  ON quote_quorum_decisions(token_symbol, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quote_quorum_decisions_decision_time
  ON quote_quorum_decisions(decision, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'token_quote_traces'
      AND column_name = 'provider_count'
  ) THEN
    ALTER TABLE token_quote_traces
      ADD COLUMN provider_count INT NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'token_quote_traces'
      AND column_name = 'quorum_decision'
  ) THEN
    ALTER TABLE token_quote_traces
      ADD COLUMN quorum_decision TEXT NOT NULL DEFAULT 'curve_only';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'token_quote_traces'
      AND column_name = 'quorum_ratio'
  ) THEN
    ALTER TABLE token_quote_traces
      ADD COLUMN quorum_ratio NUMERIC(12,6) NOT NULL DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_token_quote_traces_quorum
  ON token_quote_traces(quorum_decision, created_at DESC);

INSERT INTO quote_provider_health (
  provider,
  endpoint,
  check_name,
  ok,
  status_code,
  latency_ms,
  error_code,
  error_message,
  payload_json,
  checked_at
)
SELECT
  provider,
  endpoint,
  check_name,
  ok,
  status_code,
  latency_ms,
  error_code,
  error_message,
  COALESCE(health_json, '{}'::jsonb),
  checked_at
FROM external_api_health
ON CONFLICT DO NOTHING;

INSERT INTO quote_quorum_decisions (
  request_ref,
  token_symbol,
  chain,
  usd_amount,
  chosen_price_usd,
  quorum_price_usd,
  provider_count,
  ok_provider_count,
  agreement_ratio,
  decision,
  decision_json
)
SELECT
  CONCAT('legacy:', id::text),
  COALESCE(NULLIF(token_symbol, ''), 'NXT'),
  COALESCE(NULLIF(chain, ''), 'BTC'),
  COALESCE(usd_amount, 0),
  COALESCE(price_usd, 0),
  COALESCE(price_usd, 0),
  COALESCE(provider_count, 0),
  CASE WHEN quote_source = 'oracle' THEN 1 ELSE 0 END,
  COALESCE(quorum_ratio, 0),
  CASE
    WHEN gate_open IS FALSE THEN 'blocked'
    WHEN quote_source = 'oracle' THEN 'provider_quorum'
    ELSE 'curve_only'
  END,
  jsonb_build_object(
    'source', quote_source,
    'trace_id', id,
    'gate_open', gate_open
  )
FROM token_quote_traces
ON CONFLICT (request_ref) DO NOTHING;
