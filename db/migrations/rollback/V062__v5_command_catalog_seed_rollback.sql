-- Rollback for V062__v5_command_catalog_seed.sql

DELETE FROM v5_command_help_cards
WHERE command_key IN ('menu','play','tasks','finish','reveal','pvp','arena_rank','wallet','vault','token','story','help')
  AND locale IN ('tr', 'en');

DELETE FROM v5_command_catalog
WHERE command_key IN ('menu','play','tasks','finish','reveal','pvp','arena_rank','wallet','vault','token','story','help')
  AND meta_json ->> 'seed' = 'v5.2';
