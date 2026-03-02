-- Rollback for V056__v5_revenue_events_and_passes.sql

DROP INDEX IF EXISTS idx_v5_marketplace_fee_events_user_time;
DROP TABLE IF EXISTS v5_marketplace_fee_events;

DROP INDEX IF EXISTS idx_v5_cosmetic_purchases_user_time;
DROP TABLE IF EXISTS v5_cosmetic_purchases;

DROP INDEX IF EXISTS idx_v5_user_passes_user_status_expiry;
DROP TABLE IF EXISTS v5_user_passes;

DROP TABLE IF EXISTS v5_pass_products;
