-- Rollback for V058__v5_story_contract_reward_links.sql

DROP INDEX IF EXISTS idx_v5_story_contract_links_contract;
DROP INDEX IF EXISTS idx_v5_story_contract_links_chapter;
DROP TABLE IF EXISTS v5_story_contract_reward_links;
DROP TABLE IF EXISTS v5_story_chapters;
