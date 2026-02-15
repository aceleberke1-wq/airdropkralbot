-- V017__event_telemetry_and_funnels.sql
-- Webapp telemetry, funnel tracking, and retention snapshots.

CREATE TABLE IF NOT EXISTS webapp_events (
  id BIGSERIAL PRIMARY KEY,
  event_ref UUID,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  session_ref UUID,
  event_type TEXT NOT NULL,
  event_state TEXT NOT NULL DEFAULT 'info',
  latency_ms INT NOT NULL DEFAULT 0,
  event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webapp_events_event_ref_unique
  ON webapp_events(event_ref)
  WHERE event_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_webapp_events_type_time
  ON webapp_events(event_type, event_at DESC);

CREATE INDEX IF NOT EXISTS idx_webapp_events_user_time
  ON webapp_events(user_id, event_at DESC);

CREATE INDEX IF NOT EXISTS idx_webapp_events_session_time
  ON webapp_events(session_ref, event_at DESC);

CREATE TABLE IF NOT EXISTS funnel_events (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  funnel_name TEXT NOT NULL DEFAULT 'core_loop',
  step_key TEXT NOT NULL,
  step_state TEXT NOT NULL DEFAULT 'enter',
  step_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_funnel_events_user_step_time
  ON funnel_events(user_id, step_at DESC);

CREATE INDEX IF NOT EXISTS idx_funnel_events_name_step_time
  ON funnel_events(funnel_name, step_key, step_at DESC);

CREATE TABLE IF NOT EXISTS retention_snapshots (
  day_date DATE NOT NULL,
  cohort_date DATE NOT NULL,
  active_users INT NOT NULL DEFAULT 0,
  d1_users INT NOT NULL DEFAULT 0,
  d7_users INT NOT NULL DEFAULT 0,
  d30_users INT NOT NULL DEFAULT 0,
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (day_date, cohort_date)
);

CREATE INDEX IF NOT EXISTS idx_retention_snapshots_cohort
  ON retention_snapshots(cohort_date, day_date DESC);
