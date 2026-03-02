-- Rollback for V060__v5_cutover_read_switch.sql

DROP INDEX IF EXISTS idx_v5_cutover_read_diffs_stream_entity;
DROP INDEX IF EXISTS idx_v5_cutover_read_diffs_switch_time;
DROP TABLE IF EXISTS v5_cutover_read_diffs;

DROP TABLE IF EXISTS v5_cutover_read_switch;
