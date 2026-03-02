-- Rollback for V072__v5_cutover_metrics_and_switch.sql

DROP INDEX IF EXISTS idx_v5_cutover_primary_switch_events_switch;
DROP INDEX IF EXISTS idx_v5_cutover_primary_switch_events_time;
DROP TABLE IF EXISTS v5_cutover_primary_switch_events;

DROP INDEX IF EXISTS idx_v5_cutover_compare_metrics_metric_time;
DROP INDEX IF EXISTS idx_v5_cutover_compare_metrics_stream_time;
DROP TABLE IF EXISTS v5_cutover_compare_metrics;
