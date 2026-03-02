-- V5 command catalog + localized help cards.

CREATE TABLE IF NOT EXISTS v5_command_catalog (
  command_key TEXT PRIMARY KEY,
  aliases_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  intents_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  admin_only BOOLEAN NOT NULL DEFAULT FALSE,
  min_role TEXT NOT NULL DEFAULT 'player',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS v5_command_help_cards (
  id BIGSERIAL PRIMARY KEY,
  command_key TEXT NOT NULL REFERENCES v5_command_catalog(command_key) ON DELETE CASCADE,
  locale TEXT NOT NULL DEFAULT 'tr',
  title TEXT NOT NULL DEFAULT '',
  purpose_text TEXT NOT NULL DEFAULT '',
  scenarios_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  outcomes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  examples_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (command_key, locale)
);

CREATE INDEX IF NOT EXISTS idx_v5_command_help_cards_locale
  ON v5_command_help_cards(locale, command_key);
