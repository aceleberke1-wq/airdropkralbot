-- V5.3 story/contract content version pinning.

CREATE TABLE IF NOT EXISTS v5_contract_content_versions (
  id BIGSERIAL PRIMARY KEY,
  content_type TEXT NOT NULL,
  content_key TEXT NOT NULL,
  version_tag TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  checksum_sha256 TEXT NOT NULL DEFAULT '',
  source_ref TEXT NOT NULL DEFAULT '',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_by BIGINT NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_v5_contract_content_versions_unique
  ON v5_contract_content_versions(content_type, content_key, version_tag);

CREATE INDEX IF NOT EXISTS idx_v5_contract_content_versions_active
  ON v5_contract_content_versions(content_type, content_key, is_active, published_at DESC);
