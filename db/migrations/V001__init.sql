-- V001__init.sql
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locale TEXT,
  timezone TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  last_seen_at TIMESTAMPTZ
);

CREATE TABLE identities (
  user_id BIGINT PRIMARY KEY REFERENCES users(id),
  public_name TEXT NOT NULL,
  kingdom_tier INT NOT NULL DEFAULT 0,
  reputation_score INT NOT NULL DEFAULT 0,
  prestige_level INT NOT NULL DEFAULT 0,
  season_rank INT NOT NULL DEFAULT 0,
  visibility_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE currency_ledger (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  currency TEXT NOT NULL,
  delta NUMERIC(18,8) NOT NULL,
  reason TEXT NOT NULL,
  ref_event_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE currency_balances (
  user_id BIGINT NOT NULL REFERENCES users(id),
  currency TEXT NOT NULL,
  balance NUMERIC(18,8) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, currency)
);

CREATE TABLE task_offers (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  task_type TEXT NOT NULL,
  difficulty NUMERIC(4,3) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  offer_state TEXT NOT NULL DEFAULT 'offered',
  seed TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE task_attempts (
  id BIGSERIAL PRIMARY KEY,
  task_offer_id BIGINT NOT NULL REFERENCES task_offers(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  result TEXT NOT NULL DEFAULT 'pending',
  quality_score NUMERIC(4,3) NOT NULL DEFAULT 0,
  anti_abuse_flags JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE loot_reveals (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  task_attempt_id BIGINT NOT NULL REFERENCES task_attempts(id),
  loot_tier TEXT NOT NULL,
  pity_counter_before INT NOT NULL DEFAULT 0,
  pity_counter_after INT NOT NULL DEFAULT 0,
  rng_rolls_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE streaks (
  user_id BIGINT PRIMARY KEY REFERENCES users(id),
  current_streak INT NOT NULL DEFAULT 0,
  best_streak INT NOT NULL DEFAULT 0,
  last_action_at TIMESTAMPTZ,
  grace_until TIMESTAMPTZ,
  decay_state JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE season_stats (
  user_id BIGINT NOT NULL REFERENCES users(id),
  season_id INT NOT NULL,
  season_points INT NOT NULL DEFAULT 0,
  rank INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, season_id)
);

CREATE TABLE kingdom_history (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  from_tier INT NOT NULL,
  to_tier INT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE risk_scores (
  user_id BIGINT PRIMARY KEY REFERENCES users(id),
  risk_score NUMERIC(4,3) NOT NULL DEFAULT 0,
  signals_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payout_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  currency TEXT NOT NULL,
  amount NUMERIC(18,8) NOT NULL,
  address_type TEXT NOT NULL,
  address_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  cooldown_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payout_tx (
  id BIGSERIAL PRIMARY KEY,
  payout_request_id BIGINT NOT NULL REFERENCES payout_requests(id),
  tx_hash TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  admin_id BIGINT NOT NULL
);

CREATE TABLE offers (
  id BIGSERIAL PRIMARY KEY,
  offer_type TEXT NOT NULL,
  price NUMERIC(18,8) NOT NULL,
  currency TEXT NOT NULL,
  benefit_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  limits_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE purchases (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  offer_id BIGINT NOT NULL REFERENCES offers(id),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admin_audit (
  id BIGSERIAL PRIMARY KEY,
  admin_id BIGINT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE config_versions (
  id BIGSERIAL PRIMARY KEY,
  config_key TEXT NOT NULL,
  version INT NOT NULL,
  config_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT NOT NULL
);