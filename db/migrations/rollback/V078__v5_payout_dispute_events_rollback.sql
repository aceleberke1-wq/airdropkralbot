-- Rollback for V078__v5_payout_dispute_events.sql

DROP INDEX IF EXISTS idx_v5_payout_dispute_events_request_time;
DROP INDEX IF EXISTS idx_v5_payout_dispute_events_reason_time;
DROP INDEX IF EXISTS idx_v5_payout_dispute_events_status_time;
DROP TABLE IF EXISTS v5_payout_dispute_events;
