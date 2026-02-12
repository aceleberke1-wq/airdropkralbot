-- Loop v2 phase 3: system state and config lookup performance.

CREATE TABLE IF NOT EXISTS system_state (
  state_key TEXT PRIMARY KEY,
  state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS config_versions_lookup_idx
  ON config_versions(config_key, version DESC, created_at DESC);
