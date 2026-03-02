-- Rollback for V080__v5_admin_action_slo_rollups.sql

DROP INDEX IF EXISTS idx_v5_admin_action_slo_rollups_action_day;
DROP INDEX IF EXISTS idx_v5_admin_action_slo_rollups_unique;
DROP TABLE IF EXISTS v5_admin_action_slo_rollups;
