-- Rollback for V049__v5_story_contract_content.sql

DROP INDEX IF EXISTS idx_v5_story_contract_links_contract;
DROP INDEX IF EXISTS idx_v5_story_chapters_season_order;
DROP TABLE IF EXISTS v5_story_contract_links;
DROP TABLE IF EXISTS v5_story_chapters;
