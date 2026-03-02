-- V045__user_unlock_scores_and_release_events.sql
-- Persists unlock score snapshots and payout release event trail.

CREATE TABLE IF NOT EXISTS user_unlock_scores (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_date DATE NOT NULL DEFAULT CURRENT_DATE,
  volume30d_norm NUMERIC(6,5) NOT NULL DEFAULT 0,
  mission30d_norm NUMERIC(6,5) NOT NULL DEFAULT 0,
  tenure30d_norm NUMERIC(6,5) NOT NULL DEFAULT 0,
  unlock_score NUMERIC(6,5) NOT NULL DEFAULT 0,
  unlock_tier TEXT NOT NULL DEFAULT 'T0',
  factors_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, day_date)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_unlock_scores_norm_range_check'
  ) THEN
    ALTER TABLE user_unlock_scores
      ADD CONSTRAINT user_unlock_scores_norm_range_check
      CHECK (
        volume30d_norm >= 0 AND volume30d_norm <= 1
        AND mission30d_norm >= 0 AND mission30d_norm <= 1
        AND tenure30d_norm >= 0 AND tenure30d_norm <= 1
        AND unlock_score >= 0 AND unlock_score <= 1
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_unlock_scores_day
  ON user_unlock_scores(day_date DESC);

CREATE TABLE IF NOT EXISTS payout_release_events (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payout_request_id BIGINT REFERENCES payout_requests(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BTC',
  amount_btc NUMERIC(18,8) NOT NULL DEFAULT 0,
  unlock_tier TEXT NOT NULL DEFAULT 'T0',
  unlock_score NUMERIC(6,5) NOT NULL DEFAULT 0,
  event_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_payout_release_events_user_time
  ON payout_release_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payout_release_events_type_time
  ON payout_release_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payout_release_events_request
  ON payout_release_events(payout_request_id);

