-- V5.3 API contract violation telemetry.

CREATE TABLE IF NOT EXISTS v5_api_contract_violations (
  id BIGSERIAL PRIMARY KEY,
  endpoint_path TEXT NOT NULL,
  http_method TEXT NOT NULL DEFAULT 'GET',
  contract_key TEXT NOT NULL DEFAULT '',
  violation_code TEXT NOT NULL DEFAULT '',
  violation_count INTEGER NOT NULL DEFAULT 1,
  request_ref TEXT NOT NULL DEFAULT '',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v5_api_contract_violations_endpoint_time
  ON v5_api_contract_violations(endpoint_path, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_api_contract_violations_code_time
  ON v5_api_contract_violations(violation_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_api_contract_violations_contract_time
  ON v5_api_contract_violations(contract_key, created_at DESC);
