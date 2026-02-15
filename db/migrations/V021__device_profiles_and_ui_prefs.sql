-- V021__device_profiles_and_ui_prefs.sql
-- User UI preferences and runtime performance profiling for adaptive rendering.

CREATE TABLE IF NOT EXISTS user_ui_prefs (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  ui_mode TEXT NOT NULL DEFAULT 'hardcore',
  quality_mode TEXT NOT NULL DEFAULT 'auto',
  reduced_motion BOOLEAN NOT NULL DEFAULT FALSE,
  large_text BOOLEAN NOT NULL DEFAULT FALSE,
  sound_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  prefs_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_ui_prefs_ui_mode_check'
  ) THEN
    ALTER TABLE user_ui_prefs
      ADD CONSTRAINT user_ui_prefs_ui_mode_check
      CHECK (ui_mode IN ('hardcore', 'standard', 'minimal'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_ui_prefs_quality_mode_check'
  ) THEN
    ALTER TABLE user_ui_prefs
      ADD CONSTRAINT user_ui_prefs_quality_mode_check
      CHECK (quality_mode IN ('auto', 'high', 'normal', 'low'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS device_perf_profiles (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  device_hash TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT '',
  gpu_tier TEXT NOT NULL DEFAULT 'unknown',
  cpu_tier TEXT NOT NULL DEFAULT 'unknown',
  memory_tier TEXT NOT NULL DEFAULT 'unknown',
  fps_avg NUMERIC(10,3) NOT NULL DEFAULT 0,
  frame_time_ms NUMERIC(10,3) NOT NULL DEFAULT 0,
  latency_avg_ms NUMERIC(10,3) NOT NULL DEFAULT 0,
  profile_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_hash)
);

CREATE INDEX IF NOT EXISTS idx_device_perf_profiles_seen
  ON device_perf_profiles(last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_device_perf_profiles_user
  ON device_perf_profiles(user_id, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS render_quality_snapshots (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  device_hash TEXT NOT NULL DEFAULT '',
  quality_mode TEXT NOT NULL DEFAULT 'auto',
  fps_avg NUMERIC(10,3) NOT NULL DEFAULT 0,
  dropped_frames INT NOT NULL DEFAULT 0,
  gpu_time_ms NUMERIC(10,3) NOT NULL DEFAULT 0,
  cpu_time_ms NUMERIC(10,3) NOT NULL DEFAULT 0,
  snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_render_quality_snapshots_user_time
  ON render_quality_snapshots(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_render_quality_snapshots_device_time
  ON render_quality_snapshots(device_hash, created_at DESC);
