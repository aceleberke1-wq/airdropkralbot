-- V022__api_integrations_and_oracle_snapshots.sql
-- External API observability, oracle snapshots, and chain verification traces.

CREATE TABLE IF NOT EXISTS price_oracle_snapshots (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  symbol TEXT NOT NULL,
  price_usd NUMERIC(24,10) NOT NULL DEFAULT 0,
  confidence NUMERIC(10,6) NOT NULL DEFAULT 0,
  source_ts TIMESTAMPTZ,
  snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_oracle_snapshots_symbol_time
  ON price_oracle_snapshots(symbol, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_oracle_snapshots_provider_time
  ON price_oracle_snapshots(provider, created_at DESC);

CREATE TABLE IF NOT EXISTS chain_verify_logs (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT REFERENCES token_purchase_requests(id) ON DELETE SET NULL,
  chain TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  verify_status TEXT NOT NULL DEFAULT 'unknown',
  latency_ms INT NOT NULL DEFAULT 0,
  verify_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chain_verify_logs_status_check'
  ) THEN
    ALTER TABLE chain_verify_logs
      ADD CONSTRAINT chain_verify_logs_status_check
      CHECK (verify_status IN ('verified', 'format_only', 'failed', 'timeout', 'unknown'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chain_verify_logs_request_time
  ON chain_verify_logs(request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chain_verify_logs_chain_time
  ON chain_verify_logs(chain, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chain_verify_logs_hash
  ON chain_verify_logs(tx_hash);

CREATE TABLE IF NOT EXISTS external_api_health (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  endpoint TEXT NOT NULL DEFAULT '',
  check_name TEXT NOT NULL DEFAULT 'default',
  ok BOOLEAN NOT NULL DEFAULT FALSE,
  status_code INT NOT NULL DEFAULT 0,
  latency_ms INT NOT NULL DEFAULT 0,
  error_code TEXT NOT NULL DEFAULT '',
  error_message TEXT NOT NULL DEFAULT '',
  health_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_external_api_health_provider_time
  ON external_api_health(provider, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_external_api_health_ok_time
  ON external_api_health(ok, checked_at DESC);
