-- V5.2 story-contract reward effects with versioned effect keys.

ALTER TABLE v5_story_contract_reward_links
  ADD COLUMN IF NOT EXISTS effect_key TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS effect_value NUMERIC(18, 8) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS effect_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS version_key TEXT NOT NULL DEFAULT 'v5.2';

UPDATE v5_story_contract_reward_links
SET effect_key = reward_key
WHERE COALESCE(effect_key, '') = '';

UPDATE v5_story_contract_reward_links
SET effect_value = reward_value
WHERE COALESCE(effect_value, 0) = 0 AND COALESCE(reward_value, 0) <> 0;

UPDATE v5_story_contract_reward_links
SET effect_json = jsonb_build_object(
  'reward_key', reward_key,
  'reward_value', reward_value,
  'source', 'v5_story_contract_reward_links'
)
WHERE COALESCE(effect_json, '{}'::jsonb) = '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_v5_story_reward_effects_contract
  ON v5_story_contract_reward_links(contract_id, effect_key, active, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_story_reward_effects_version
  ON v5_story_contract_reward_links(version_key, updated_at DESC);
