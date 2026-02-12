-- V002__indexes.sql
CREATE INDEX users_status_idx ON users(status);
CREATE INDEX users_last_seen_idx ON users(last_seen_at);

CREATE INDEX identities_tier_idx ON identities(kingdom_tier);
CREATE INDEX identities_rep_idx ON identities(reputation_score);
CREATE INDEX identities_season_rank_idx ON identities(season_rank);

CREATE INDEX currency_ledger_user_idx ON currency_ledger(user_id);
CREATE INDEX currency_ledger_currency_idx ON currency_ledger(currency);
CREATE INDEX currency_ledger_created_idx ON currency_ledger(created_at);

CREATE INDEX task_offers_user_state_idx ON task_offers(user_id, offer_state);
CREATE INDEX task_offers_expires_idx ON task_offers(expires_at);

CREATE INDEX task_attempts_user_result_idx ON task_attempts(user_id, result);
CREATE INDEX task_attempts_completed_idx ON task_attempts(completed_at);

CREATE INDEX loot_reveals_user_idx ON loot_reveals(user_id);
CREATE INDEX season_stats_points_idx ON season_stats(season_id, season_points);

CREATE INDEX payout_requests_user_status_idx ON payout_requests(user_id, status);
CREATE INDEX payout_tx_hash_idx ON payout_tx(tx_hash);