-- Rollback for V070__v5_story_reward_effects.sql

DROP INDEX IF EXISTS idx_v5_story_reward_effects_version;
DROP INDEX IF EXISTS idx_v5_story_reward_effects_contract;

ALTER TABLE IF EXISTS v5_story_contract_reward_links
  DROP COLUMN IF EXISTS version_key,
  DROP COLUMN IF EXISTS effect_json,
  DROP COLUMN IF EXISTS effect_value,
  DROP COLUMN IF EXISTS effect_key;
