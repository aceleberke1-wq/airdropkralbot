-- Rollback for V059__v5_operational_slo_metrics.sql

DROP INDEX IF EXISTS idx_v5_operational_slo_alerts_status_time;
DROP TABLE IF EXISTS v5_operational_slo_alerts;

DROP INDEX IF EXISTS idx_v5_operational_slo_metrics_key_time;
DROP TABLE IF EXISTS v5_operational_slo_metrics;
