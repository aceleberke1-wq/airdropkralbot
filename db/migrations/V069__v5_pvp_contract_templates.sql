-- V5.2 PvP contract templates (daily/weekly/season).

CREATE TABLE IF NOT EXISTS v5_pvp_contract_templates (
  id BIGSERIAL PRIMARY KEY,
  template_key TEXT NOT NULL,
  layer_key TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'tr',
  title TEXT NOT NULL DEFAULT '',
  objective_text TEXT NOT NULL DEFAULT '',
  cadence_text TEXT NOT NULL DEFAULT '',
  reward_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  version_key TEXT NOT NULL DEFAULT 'v5.2',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_v5_pvp_contract_templates UNIQUE (template_key, locale)
);

CREATE INDEX IF NOT EXISTS idx_v5_pvp_contract_templates_layer_active
  ON v5_pvp_contract_templates(layer_key, active, updated_at DESC);

INSERT INTO v5_pvp_contract_templates (
  template_key,
  layer_key,
  locale,
  title,
  objective_text,
  cadence_text,
  reward_json,
  payload_json,
  version_key,
  active
)
VALUES
  ('daily_duel_contract', 'daily', 'tr', 'Gunluk Duel Kontrati', 'Gun icinde en az 1 PvP galibiyeti al.', 'Gunluk reset', '{"sc":2,"rc":1,"season":4}'::jsonb, '{"source":"v5.2_seed"}'::jsonb, 'v5.2', true),
  ('weekly_ladder_objective', 'weekly', 'tr', 'Haftalik Ladder Hedefi', 'Haftalik ladder puan hedefini milestone bazli tamamla.', 'Haftalik reset', '{"milestone_sc":3,"milestone_rc":2,"milestone_season":6}'::jsonb, '{"source":"v5.2_seed"}'::jsonb, 'v5.2', true),
  ('season_arc_boss', 'season', 'tr', 'Sezon Arc Boss', 'Wave tabanli boss katkisini tamamla, kisisel ve global odul al.', 'Sezon sonu', '{"personal_sc":2,"personal_rc":2,"wave_sc":2,"wave_rc":3}'::jsonb, '{"source":"v5.2_seed"}'::jsonb, 'v5.2', true),
  ('daily_duel_contract', 'daily', 'en', 'Daily Duel Contract', 'Get at least one PvP win for the day.', 'Daily reset', '{"sc":2,"rc":1,"season":4}'::jsonb, '{"source":"v5.2_seed"}'::jsonb, 'v5.2', true),
  ('weekly_ladder_objective', 'weekly', 'en', 'Weekly Ladder Objective', 'Reach weekly ladder point milestones.', 'Weekly reset', '{"milestone_sc":3,"milestone_rc":2,"milestone_season":6}'::jsonb, '{"source":"v5.2_seed"}'::jsonb, 'v5.2', true),
  ('season_arc_boss', 'season', 'en', 'Season Arc Boss', 'Complete wave-based boss contribution objectives.', 'Season end', '{"personal_sc":2,"personal_rc":2,"wave_sc":2,"wave_rc":3}'::jsonb, '{"source":"v5.2_seed"}'::jsonb, 'v5.2', true)
ON CONFLICT (template_key, locale)
DO UPDATE SET
  layer_key = EXCLUDED.layer_key,
  title = EXCLUDED.title,
  objective_text = EXCLUDED.objective_text,
  cadence_text = EXCLUDED.cadence_text,
  reward_json = EXCLUDED.reward_json,
  payload_json = COALESCE(v5_pvp_contract_templates.payload_json, '{}'::jsonb) || EXCLUDED.payload_json,
  version_key = EXCLUDED.version_key,
  active = EXCLUDED.active,
  updated_at = now();
