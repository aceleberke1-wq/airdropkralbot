-- V5.2 command contract hardening.

ALTER TABLE v5_command_catalog
  ADD COLUMN IF NOT EXISTS description_tr TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS description_en TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS scenarios_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS outcomes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS handler_key TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS primary_command BOOLEAN NOT NULL DEFAULT false;

UPDATE v5_command_catalog
SET handler_key = command_key
WHERE COALESCE(handler_key, '') = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_v5_command_catalog_min_role'
  ) THEN
    ALTER TABLE v5_command_catalog
      ADD CONSTRAINT ck_v5_command_catalog_min_role
      CHECK (min_role IN ('player', 'admin', 'superadmin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_v5_command_catalog_command_key_format'
  ) THEN
    ALTER TABLE v5_command_catalog
      ADD CONSTRAINT ck_v5_command_catalog_command_key_format
      CHECK (command_key ~ '^[a-z0-9_]+$');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_v5_command_catalog_handler_key_format'
  ) THEN
    ALTER TABLE v5_command_catalog
      ADD CONSTRAINT ck_v5_command_catalog_handler_key_format
      CHECK (handler_key ~ '^[a-z0-9_]+$');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_v5_command_catalog_aliases_json_array'
  ) THEN
    ALTER TABLE v5_command_catalog
      ADD CONSTRAINT ck_v5_command_catalog_aliases_json_array
      CHECK (jsonb_typeof(aliases_json) = 'array');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_v5_command_catalog_intents_json_array'
  ) THEN
    ALTER TABLE v5_command_catalog
      ADD CONSTRAINT ck_v5_command_catalog_intents_json_array
      CHECK (jsonb_typeof(intents_json) = 'array');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_v5_command_catalog_scenarios_json_array'
  ) THEN
    ALTER TABLE v5_command_catalog
      ADD CONSTRAINT ck_v5_command_catalog_scenarios_json_array
      CHECK (jsonb_typeof(scenarios_json) = 'array');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_v5_command_catalog_outcomes_json_array'
  ) THEN
    ALTER TABLE v5_command_catalog
      ADD CONSTRAINT ck_v5_command_catalog_outcomes_json_array
      CHECK (jsonb_typeof(outcomes_json) = 'array');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_v5_command_catalog_active_role
  ON v5_command_catalog(active, min_role, primary_command, command_key);

CREATE INDEX IF NOT EXISTS idx_v5_command_catalog_handler_key
  ON v5_command_catalog(handler_key);
