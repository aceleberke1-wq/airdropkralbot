-- Rollback for V061__v5_command_contract_constraints.sql

DROP INDEX IF EXISTS idx_v5_command_catalog_handler_key;
DROP INDEX IF EXISTS idx_v5_command_catalog_active_role;

ALTER TABLE IF EXISTS v5_command_catalog
  DROP CONSTRAINT IF EXISTS ck_v5_command_catalog_outcomes_json_array,
  DROP CONSTRAINT IF EXISTS ck_v5_command_catalog_scenarios_json_array,
  DROP CONSTRAINT IF EXISTS ck_v5_command_catalog_intents_json_array,
  DROP CONSTRAINT IF EXISTS ck_v5_command_catalog_aliases_json_array,
  DROP CONSTRAINT IF EXISTS ck_v5_command_catalog_handler_key_format,
  DROP CONSTRAINT IF EXISTS ck_v5_command_catalog_command_key_format,
  DROP CONSTRAINT IF EXISTS ck_v5_command_catalog_min_role;

ALTER TABLE IF EXISTS v5_command_catalog
  DROP COLUMN IF EXISTS primary_command,
  DROP COLUMN IF EXISTS handler_key,
  DROP COLUMN IF EXISTS outcomes_json,
  DROP COLUMN IF EXISTS scenarios_json,
  DROP COLUMN IF EXISTS description_en,
  DROP COLUMN IF EXISTS description_tr;
