-- V5.5 React V1 webapp experiment assignments.

CREATE TABLE IF NOT EXISTS v5_webapp_experiment_assignments (
  id BIGSERIAL PRIMARY KEY,
  uid BIGINT NOT NULL,
  experiment_key TEXT NOT NULL,
  variant_key TEXT NOT NULL,
  cohort_bucket SMALLINT NOT NULL DEFAULT 0 CHECK (cohort_bucket >= 0 AND cohort_bucket <= 99),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assignment_meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (uid, experiment_key)
);

CREATE INDEX IF NOT EXISTS idx_v5_webapp_experiment_assignments_variant_time
  ON v5_webapp_experiment_assignments (experiment_key, variant_key, assigned_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_webapp_experiment_assignments_uid_time
  ON v5_webapp_experiment_assignments (uid, assigned_at DESC);
