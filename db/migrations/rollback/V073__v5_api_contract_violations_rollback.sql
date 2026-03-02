-- Rollback for V073__v5_api_contract_violations.sql

DROP INDEX IF EXISTS idx_v5_api_contract_violations_contract_time;
DROP INDEX IF EXISTS idx_v5_api_contract_violations_code_time;
DROP INDEX IF EXISTS idx_v5_api_contract_violations_endpoint_time;
DROP TABLE IF EXISTS v5_api_contract_violations;
