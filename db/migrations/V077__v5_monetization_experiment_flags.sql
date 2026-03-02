-- V5.3 monetization experiment and pricing flag catalog.

CREATE TABLE IF NOT EXISTS v5_monetization_experiment_flags (
  id BIGSERIAL PRIMARY KEY,
  experiment_key TEXT NOT NULL,
  variant_key TEXT NOT NULL DEFAULT 'control',
  active BOOLEAN NOT NULL DEFAULT false,
  traffic_pct NUMERIC(5, 2) NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_v5_monetization_experiment_flags_unique
  ON v5_monetization_experiment_flags(experiment_key, variant_key);

CREATE INDEX IF NOT EXISTS idx_v5_monetization_experiment_flags_active
  ON v5_monetization_experiment_flags(active, experiment_key);
