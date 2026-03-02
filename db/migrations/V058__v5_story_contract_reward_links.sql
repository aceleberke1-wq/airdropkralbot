-- V5 story chapter and reward linkage tables.

CREATE TABLE IF NOT EXISTS v5_story_chapters (
  id BIGSERIAL PRIMARY KEY,
  chapter_key TEXT NOT NULL UNIQUE,
  title_tr TEXT NOT NULL,
  title_en TEXT NOT NULL,
  narrative_tr TEXT NOT NULL,
  narrative_en TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 100,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS v5_story_contract_reward_links (
  id BIGSERIAL PRIMARY KEY,
  chapter_key TEXT NOT NULL,
  contract_id TEXT NOT NULL,
  reward_key TEXT NOT NULL,
  reward_value NUMERIC(18, 8) NOT NULL DEFAULT 0,
  reward_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_v5_story_contract_links_chapter
  ON v5_story_contract_reward_links(chapter_key, active, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_v5_story_contract_links_contract
  ON v5_story_contract_reward_links(contract_id, active, updated_at DESC);
