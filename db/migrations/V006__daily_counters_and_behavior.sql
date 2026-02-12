-- Loop v2 phase 2: daily counters and behavior telemetry for risk scoring.

CREATE TABLE IF NOT EXISTS daily_counters (
  user_id BIGINT NOT NULL REFERENCES users(id),
  day_date DATE NOT NULL,
  tasks_done INT NOT NULL DEFAULT 0,
  sc_earned NUMERIC(18,8) NOT NULL DEFAULT 0,
  hc_earned NUMERIC(18,8) NOT NULL DEFAULT 0,
  rc_earned NUMERIC(18,8) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day_date)
);

CREATE TABLE IF NOT EXISTS behavior_events (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL,
  event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS behavior_events_user_time_idx
  ON behavior_events(user_id, event_at DESC);

CREATE INDEX IF NOT EXISTS behavior_events_type_time_idx
  ON behavior_events(event_type, event_at DESC);

CREATE INDEX IF NOT EXISTS risk_scores_updated_idx
  ON risk_scores(last_updated_at DESC);

CREATE INDEX IF NOT EXISTS risk_scores_score_idx
  ON risk_scores(risk_score DESC);
