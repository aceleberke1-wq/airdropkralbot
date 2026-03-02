-- Rollback for V076__v5_kpi_bundle_runs.sql

DROP INDEX IF EXISTS idx_v5_kpi_bundle_runs_trigger_time;
DROP INDEX IF EXISTS idx_v5_kpi_bundle_runs_requested_by_time;
DROP INDEX IF EXISTS idx_v5_kpi_bundle_runs_status_time;
DROP TABLE IF EXISTS v5_kpi_bundle_runs;
