-- Rollback for V057__v5_command_help_cards_i18n.sql

DROP INDEX IF EXISTS idx_v5_command_help_cards_active_order;
DROP TABLE IF EXISTS v5_command_help_cards;
