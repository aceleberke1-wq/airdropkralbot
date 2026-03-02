-- Rollback for V064__v5_unified_queue_state_machine.sql

DROP TABLE IF EXISTS v5_unified_admin_queue_policy_reasons;

DROP INDEX IF EXISTS idx_v5_uq_transitions_reason;
DROP INDEX IF EXISTS idx_v5_uq_transitions_lookup;
DROP TABLE IF EXISTS v5_unified_admin_queue_state_transitions;
