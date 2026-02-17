-- V031__webapp_perf_and_assets.sql
-- Additional WebApp performance profiling and asset fallback metadata.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'device_perf_profiles'
      AND column_name = 'fps_target'
  ) THEN
    ALTER TABLE device_perf_profiles
      ADD COLUMN fps_target INT NOT NULL DEFAULT 60;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'device_perf_profiles'
      AND column_name = 'quality_tier'
  ) THEN
    ALTER TABLE device_perf_profiles
      ADD COLUMN quality_tier TEXT NOT NULL DEFAULT 'auto';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'device_perf_profiles_quality_tier_check'
  ) THEN
    ALTER TABLE device_perf_profiles
      ADD CONSTRAINT device_perf_profiles_quality_tier_check
      CHECK (quality_tier IN ('auto', 'low', 'normal', 'high'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'webapp_asset_registry'
      AND column_name = 'load_mode'
  ) THEN
    ALTER TABLE webapp_asset_registry
      ADD COLUMN load_mode TEXT NOT NULL DEFAULT 'hybrid';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'webapp_asset_registry'
      AND column_name = 'render_hint'
  ) THEN
    ALTER TABLE webapp_asset_registry
      ADD COLUMN render_hint TEXT NOT NULL DEFAULT 'default';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'webapp_asset_registry'
      AND column_name = 'lite_fallback'
  ) THEN
    ALTER TABLE webapp_asset_registry
      ADD COLUMN lite_fallback BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'webapp_asset_load_events'
      AND column_name = 'fallback_used'
  ) THEN
    ALTER TABLE webapp_asset_load_events
      ADD COLUMN fallback_used BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_webapp_asset_load_events_time
  ON webapp_asset_load_events(created_at DESC);

CREATE TABLE IF NOT EXISTS webapp_scene_profiles (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  scene_key TEXT NOT NULL DEFAULT 'nexus_arena',
  perf_profile TEXT NOT NULL DEFAULT 'normal',
  reduced_motion BOOLEAN NOT NULL DEFAULT FALSE,
  large_text BOOLEAN NOT NULL DEFAULT FALSE,
  profile_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'webapp_scene_profiles_perf_profile_check'
  ) THEN
    ALTER TABLE webapp_scene_profiles
      ADD CONSTRAINT webapp_scene_profiles_perf_profile_check
      CHECK (perf_profile IN ('low', 'normal', 'high'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_webapp_scene_profiles_user_scene
  ON webapp_scene_profiles(user_id, scene_key);

CREATE INDEX IF NOT EXISTS idx_webapp_scene_profiles_updated
  ON webapp_scene_profiles(updated_at DESC);
