-- Rollback for V077__v5_monetization_experiment_flags.sql

DROP INDEX IF EXISTS idx_v5_monetization_experiment_flags_active;
DROP INDEX IF EXISTS idx_v5_monetization_experiment_flags_unique;
DROP TABLE IF EXISTS v5_monetization_experiment_flags;
