-- V5 story + contract content link tables.

CREATE TABLE IF NOT EXISTS v5_story_chapters (
  id BIGSERIAL PRIMARY KEY,
  chapter_key TEXT NOT NULL UNIQUE,
  season_id INT,
  chapter_order INT NOT NULL DEFAULT 0,
  title_tr TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  body_tr TEXT NOT NULL DEFAULT '',
  body_en TEXT NOT NULL DEFAULT '',
  teaser_tr TEXT NOT NULL DEFAULT '',
  teaser_en TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS v5_story_contract_links (
  id BIGSERIAL PRIMARY KEY,
  chapter_id BIGINT NOT NULL REFERENCES v5_story_chapters(id) ON DELETE CASCADE,
  contract_key TEXT NOT NULL DEFAULT '',
  objective_key TEXT NOT NULL DEFAULT '',
  objective_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  reward_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chapter_id, contract_key, objective_key)
);

CREATE INDEX IF NOT EXISTS idx_v5_story_chapters_season_order
  ON v5_story_chapters(season_id, chapter_order);

CREATE INDEX IF NOT EXISTS idx_v5_story_contract_links_contract
  ON v5_story_contract_links(contract_key, active, updated_at DESC);
