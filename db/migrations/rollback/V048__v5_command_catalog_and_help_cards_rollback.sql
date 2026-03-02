-- Rollback for V048__v5_command_catalog_and_help_cards.sql

DROP INDEX IF EXISTS idx_v5_command_help_cards_locale;
DROP TABLE IF EXISTS v5_command_help_cards;
DROP TABLE IF EXISTS v5_command_catalog;
