-- Rollback for V052__v5_cutover_compat_metrics.sql

DROP INDEX IF EXISTS idx_v5_cutover_readiness_status_time;
DROP TABLE IF EXISTS v5_cutover_readiness_snapshots;
DROP INDEX IF EXISTS idx_v5_cutover_compat_metrics_key_time;
DROP TABLE IF EXISTS v5_cutover_compat_metrics;
