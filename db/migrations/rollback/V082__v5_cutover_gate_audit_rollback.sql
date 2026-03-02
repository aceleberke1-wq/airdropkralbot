-- Rollback for V082__v5_cutover_gate_audit.sql

DROP INDEX IF EXISTS idx_v5_cutover_gate_audit_decision_time;
DROP INDEX IF EXISTS idx_v5_cutover_gate_audit_gate_time;
DROP INDEX IF EXISTS idx_v5_cutover_gate_audit_stage_time;
DROP TABLE IF EXISTS v5_cutover_gate_audit;
