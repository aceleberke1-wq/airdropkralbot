-- V033__scene_profiles_and_preferences.sql
-- Nexus Pro scene profile persistence and user-level UI defaults.

CREATE TABLE IF NOT EXISTS webapp_scene_profiles_v2 (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scene_key TEXT NOT NULL DEFAULT 'nexus_arena',
  scene_mode TEXT NOT NULL DEFAULT 'pro',
  perf_profile TEXT NOT NULL DEFAULT 'normal',
  quality_mode TEXT NOT NULL DEFAULT 'auto',
  reduced_motion BOOLEAN NOT NULL DEFAULT FALSE,
  large_text BOOLEAN NOT NULL DEFAULT FALSE,
  motion_intensity NUMERIC(10,4) NOT NULL DEFAULT 1,
  postfx_level NUMERIC(10,4) NOT NULL DEFAULT 1,
  hud_density TEXT NOT NULL DEFAULT 'full',
  prefs_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, scene_key)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'webapp_scene_profiles_v2_scene_mode_check'
  ) THEN
    ALTER TABLE webapp_scene_profiles_v2
      ADD CONSTRAINT webapp_scene_profiles_v2_scene_mode_check
      CHECK (scene_mode IN ('pro', 'lite', 'cinematic', 'minimal'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'webapp_scene_profiles_v2_perf_profile_check'
  ) THEN
    ALTER TABLE webapp_scene_profiles_v2
      ADD CONSTRAINT webapp_scene_profiles_v2_perf_profile_check
      CHECK (perf_profile IN ('low', 'normal', 'high'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'webapp_scene_profiles_v2_quality_mode_check'
  ) THEN
    ALTER TABLE webapp_scene_profiles_v2
      ADD CONSTRAINT webapp_scene_profiles_v2_quality_mode_check
      CHECK (quality_mode IN ('auto', 'low', 'normal', 'high'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'webapp_scene_profiles_v2_hud_density_check'
  ) THEN
    ALTER TABLE webapp_scene_profiles_v2
      ADD CONSTRAINT webapp_scene_profiles_v2_hud_density_check
      CHECK (hud_density IN ('compact', 'full', 'extended'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_webapp_scene_profiles_v2_updated
  ON webapp_scene_profiles_v2(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_webapp_scene_profiles_v2_user_mode
  ON webapp_scene_profiles_v2(user_id, scene_mode);

-- Backfill from previous preference tables when available.
INSERT INTO webapp_scene_profiles_v2 (
  user_id,
  scene_key,
  scene_mode,
  perf_profile,
  quality_mode,
  reduced_motion,
  large_text,
  motion_intensity,
  postfx_level,
  hud_density,
  prefs_json
)
SELECT
  up.user_id,
  'nexus_arena',
  CASE
    WHEN up.ui_mode = 'minimal' THEN 'minimal'
    WHEN up.ui_mode = 'standard' THEN 'lite'
    ELSE 'pro'
  END AS scene_mode,
  CASE
    WHEN dp.quality_tier IN ('low', 'normal', 'high') THEN dp.quality_tier
    ELSE 'normal'
  END AS perf_profile,
  CASE
    WHEN up.quality_mode IN ('auto', 'low', 'normal', 'high') THEN up.quality_mode
    ELSE 'auto'
  END AS quality_mode,
  up.reduced_motion,
  up.large_text,
  CASE WHEN up.reduced_motion THEN 0.70 ELSE 1 END AS motion_intensity,
  CASE
    WHEN up.quality_mode = 'low' THEN 0.45
    WHEN up.quality_mode = 'high' THEN 1.10
    ELSE 0.80
  END AS postfx_level,
  CASE
    WHEN up.large_text THEN 'compact'
    ELSE 'full'
  END AS hud_density,
  COALESCE(up.prefs_json, '{}'::jsonb)
FROM user_ui_prefs up
LEFT JOIN LATERAL (
  SELECT quality_tier
  FROM device_perf_profiles dp
  WHERE dp.user_id = up.user_id
  ORDER BY dp.last_seen_at DESC
  LIMIT 1
) dp ON TRUE
ON CONFLICT (user_id, scene_key) DO NOTHING;
