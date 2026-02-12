-- Deeper live-ops loop: daily missions and global war counters.

CREATE TABLE IF NOT EXISTS mission_claims (
  user_id BIGINT NOT NULL REFERENCES users(id),
  mission_key TEXT NOT NULL,
  day_date DATE NOT NULL DEFAULT CURRENT_DATE,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (user_id, mission_key, day_date)
);

CREATE TABLE IF NOT EXISTS global_counters (
  counter_key TEXT PRIMARY KEY,
  counter_value NUMERIC(20,8) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mission_claims_day_idx
  ON mission_claims(day_date, mission_key);
