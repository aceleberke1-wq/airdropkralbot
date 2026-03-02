-- Rollback for V081__v5_contract_content_versions.sql

DROP INDEX IF EXISTS idx_v5_contract_content_versions_active;
DROP INDEX IF EXISTS idx_v5_contract_content_versions_unique;
DROP TABLE IF EXISTS v5_contract_content_versions;
