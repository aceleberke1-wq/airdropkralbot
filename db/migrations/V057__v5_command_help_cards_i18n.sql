-- V5 command/help card localized runtime tables (compatible with V048 schema).

CREATE TABLE IF NOT EXISTS v5_command_help_cards (
  id BIGSERIAL PRIMARY KEY,
  command_key TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'tr',
  title TEXT NOT NULL DEFAULT '',
  purpose TEXT NOT NULL DEFAULT '',
  purpose_text TEXT NOT NULL DEFAULT '',
  scenario_text TEXT NOT NULL DEFAULT '',
  outcome_text TEXT NOT NULL DEFAULT '',
  ordering INT NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT true,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE v5_command_help_cards
  ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS purpose_text TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS scenario_text TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS outcome_text TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ordering INT NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS payload_json JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE v5_command_help_cards
SET purpose = COALESCE(NULLIF(purpose, ''), purpose_text, '')
WHERE purpose IS NULL OR purpose = '';

UPDATE v5_command_help_cards
SET purpose_text = COALESCE(NULLIF(purpose_text, ''), purpose, '')
WHERE purpose_text IS NULL OR purpose_text = '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_v5_command_help_cards_key_locale
  ON v5_command_help_cards(command_key, locale);

CREATE INDEX IF NOT EXISTS idx_v5_command_help_cards_active_order
  ON v5_command_help_cards(active, ordering ASC, command_key ASC);
