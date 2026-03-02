-- Rollback for V055__v5_kyc_profiles_and_screening.sql

DROP INDEX IF EXISTS idx_v5_kyc_screening_result;
DROP INDEX IF EXISTS idx_v5_kyc_screening_user_time;
DROP TABLE IF EXISTS v5_kyc_screening_events;

DROP INDEX IF EXISTS idx_v5_kyc_profiles_status_updated;
DROP TABLE IF EXISTS v5_kyc_profiles;
