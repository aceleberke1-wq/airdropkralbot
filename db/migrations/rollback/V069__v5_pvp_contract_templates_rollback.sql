-- Rollback for V069__v5_pvp_contract_templates.sql

DROP INDEX IF EXISTS idx_v5_pvp_contract_templates_layer_active;
DROP TABLE IF EXISTS v5_pvp_contract_templates;
