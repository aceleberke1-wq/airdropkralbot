-- V5.2 command catalog and help card seed.

INSERT INTO v5_command_catalog (
  command_key,
  aliases_json,
  intents_json,
  scenarios_json,
  outcomes_json,
  description_tr,
  description_en,
  admin_only,
  min_role,
  active,
  handler_key,
  primary_command,
  meta_json
)
VALUES
  ('menu', '["start"]'::jsonb, '["menu","launcher","start","home","ana menu"]'::jsonb, '["/menu","ana menu"]'::jsonb, '["launcher panelini ac"]'::jsonb, 'Launcher kisayol menusu', 'Open launcher shortcuts', false, 'player', true, 'menu', true, '{"seed":"v5.2"}'::jsonb),
  ('play', '["arena","arena3d"]'::jsonb, '["play","arena","arena 3d","battle"]'::jsonb, '["/play","arena 3d ac"]'::jsonb, '["webapp oyuncu panelini ac"]'::jsonb, 'Arena 3D web arayuzu', 'Open Arena 3D web app', false, 'player', true, 'play', true, '{"seed":"v5.2"}'::jsonb),
  ('tasks', '["task","gorev"]'::jsonb, '["tasks","task","gorev","quest"]'::jsonb, '["/tasks","gorev"]'::jsonb, '["aktif gorev havuzunu listele"]'::jsonb, 'Gorev havuzunu goster', 'Show task pool', false, 'player', true, 'tasks', true, '{"seed":"v5.2"}'::jsonb),
  ('finish', '["bitir"]'::jsonb, '["finish","bitir","tamamla"]'::jsonb, '["/finish balanced","bitir saldirgan"]'::jsonb, '["aktif gorevi sonuclandir"]'::jsonb, 'Aktif gorevi bitir', 'Finish active task', false, 'player', true, 'finish', true, '{"seed":"v5.2"}'::jsonb),
  ('reveal', '["revealnow"]'::jsonb, '["reveal","loot","kasa ac"]'::jsonb, '["/reveal","kasa ac"]'::jsonb, '["son biten gorev odulunu dagit"]'::jsonb, 'Son biten gorevi ac', 'Reveal latest completed run', false, 'player', true, 'reveal', true, '{"seed":"v5.2"}'::jsonb),
  ('pvp', '["raid"]'::jsonb, '["pvp","raid","arena raid","duel"]'::jsonb, '["/pvp","raid aggressive"]'::jsonb, '["pvp raid baslat ve progression ilerlet"]'::jsonb, 'PvP raid baslat', 'Start PvP raid', false, 'player', true, 'pvp', true, '{"seed":"v5.2"}'::jsonb),
  ('arena_rank', '[]'::jsonb, '["arena rank","rank","leaderboard arena"]'::jsonb, '["/arena_rank"]'::jsonb, '["arena rating ve siralamayi goster"]'::jsonb, 'Arena rating ve siralama', 'Arena rating and leaderboard', false, 'player', true, 'arena_rank', true, '{"seed":"v5.2"}'::jsonb),
  ('wallet', '["cuzdan"]'::jsonb, '["wallet","cuzdan","balance"]'::jsonb, '["/wallet","cuzdan"]'::jsonb, '["SC HC RC bakiyesini goster"]'::jsonb, 'Bakiye durumunu goster', 'Show balances', false, 'player', true, 'wallet', true, '{"seed":"v5.2"}'::jsonb),
  ('vault', '["payout"]'::jsonb, '["vault","payout","withdraw","cekim"]'::jsonb, '["/vault","payout"]'::jsonb, '["payout kilit durumunu goster"]'::jsonb, 'Payout/Vault paneli', 'Open payout vault panel', false, 'player', true, 'vault', true, '{"seed":"v5.2"}'::jsonb),
  ('token', '[]'::jsonb, '["token","coin","jeton","treasury"]'::jsonb, '["/token","token wallet"]'::jsonb, '["token bakiye ve talepleri goster"]'::jsonb, 'Sanal token cuzdani ve talepler', 'Virtual token wallet and requests', false, 'player', true, 'token', true, '{"seed":"v5.2"}'::jsonb),
  ('story', '["guide"]'::jsonb, '["story","guide","rehber"]'::jsonb, '["/story","guide"]'::jsonb, '["story ve kontrat baglamini goster"]'::jsonb, 'Hikaye ve hizli baslangic', 'Story and quick guide', false, 'player', true, 'story', true, '{"seed":"v5.2"}'::jsonb),
  ('help', '[]'::jsonb, '["help","komutlar","commands"]'::jsonb, '["/help","komutlar"]'::jsonb, '["komut kartlarini listeler"]'::jsonb, 'Komut listesi', 'Command list', false, 'player', true, 'help', true, '{"seed":"v5.2"}'::jsonb)
ON CONFLICT (command_key)
DO UPDATE SET
  aliases_json = EXCLUDED.aliases_json,
  intents_json = EXCLUDED.intents_json,
  scenarios_json = EXCLUDED.scenarios_json,
  outcomes_json = EXCLUDED.outcomes_json,
  description_tr = EXCLUDED.description_tr,
  description_en = EXCLUDED.description_en,
  admin_only = EXCLUDED.admin_only,
  min_role = EXCLUDED.min_role,
  active = EXCLUDED.active,
  handler_key = EXCLUDED.handler_key,
  primary_command = EXCLUDED.primary_command,
  meta_json = COALESCE(v5_command_catalog.meta_json, '{}'::jsonb) || EXCLUDED.meta_json,
  updated_at = now();

INSERT INTO v5_command_help_cards (
  command_key,
  locale,
  title,
  purpose,
  purpose_text,
  scenario_text,
  outcome_text,
  ordering,
  active,
  payload_json
)
VALUES
  ('menu','tr','/menu','Baslangic panelini acar','Baslangic panelini acar','/menu veya ana menu','Launcher ve kisayollar gorunur',10,true,'{"seed":"v5.2"}'::jsonb),
  ('play','tr','/play','WebApp oyuncu modunu acar','WebApp oyuncu modunu acar','/play veya arena','Home/PvP/Tasks/Vault acilir',20,true,'{"seed":"v5.2"}'::jsonb),
  ('tasks','tr','/tasks','Aktif gorev havuzunu listeler','Aktif gorev havuzunu listeler','/tasks veya gorev','Gorev secim listesi doner',30,true,'{"seed":"v5.2"}'::jsonb),
  ('finish','tr','/finish','Aktif gorevi safe/balanced/aggressive ile kapatir','Aktif gorevi safe/balanced/aggressive ile kapatir','/finish balanced','Sonuc ve olasilik ozeti doner',40,true,'{"seed":"v5.2"}'::jsonb),
  ('reveal','tr','/reveal','Son tamamlanan gorevin odulunu aciklar','Son tamamlanan gorevin odulunu aciklar','/reveal','Loot payout ve pity guncellenir',50,true,'{"seed":"v5.2"}'::jsonb),
  ('pvp','tr','/pvp','PvP duel/raid baslatir','PvP duel/raid baslatir','/pvp aggressive','PvP progression state ilerler',60,true,'{"seed":"v5.2"}'::jsonb),
  ('arena_rank','tr','/arena_rank','Arena rating ve liderlik durumunu gosterir','Arena rating ve liderlik durumunu gosterir','/arena_rank','Rating/rank paneli doner',70,true,'{"seed":"v5.2"}'::jsonb),
  ('wallet','tr','/wallet','SC HC RC bakiyesini gosterir','SC HC RC bakiyesini gosterir','/wallet','Bakiye ve gunluk cap bilgisi gelir',80,true,'{"seed":"v5.2"}'::jsonb),
  ('vault','tr','/vault','Payout lock/tier/drip durumunu gosterir','Payout lock/tier/drip durumunu gosterir','/vault','Talep uygunlugu ve kalan drip gorunur',90,true,'{"seed":"v5.2"}'::jsonb),
  ('token','tr','/token','Token cuzdani ve talep durumlarini gosterir','Token cuzdani ve talep durumlarini gosterir','/token','Token paneli ve son talepler doner',100,true,'{"seed":"v5.2"}'::jsonb),
  ('story','tr','/story','Story chapter ve kontrat baglamini aciklar','Story chapter ve kontrat baglamini aciklar','/story','Mekanik etki notlariyla card doner',110,true,'{"seed":"v5.2"}'::jsonb),
  ('help','tr','/help','Komut kartlarini TR/EN listeler','Komut kartlarini TR/EN listeler','/help','Senaryo ve beklenen cikti listesi gelir',120,true,'{"seed":"v5.2"}'::jsonb),

  ('menu','en','/menu','Opens launcher shortcuts','Opens launcher shortcuts','/menu or main menu','Launcher shortcuts are displayed',10,true,'{"seed":"v5.2"}'::jsonb),
  ('play','en','/play','Opens the WebApp player mode','Opens the WebApp player mode','/play or arena','Home/PvP/Tasks/Vault opens',20,true,'{"seed":"v5.2"}'::jsonb),
  ('tasks','en','/tasks','Lists active task pool','Lists active task pool','/tasks or tasks','Task selection list is returned',30,true,'{"seed":"v5.2"}'::jsonb),
  ('finish','en','/finish','Finishes active task in safe/balanced/aggressive mode','Finishes active task in safe/balanced/aggressive mode','/finish balanced','Result and probability summary is returned',40,true,'{"seed":"v5.2"}'::jsonb),
  ('reveal','en','/reveal','Reveals reward for latest completed run','Reveals reward for latest completed run','/reveal','Loot payout and pity are updated',50,true,'{"seed":"v5.2"}'::jsonb),
  ('pvp','en','/pvp','Starts PvP duel/raid','Starts PvP duel/raid','/pvp aggressive','PvP progression state advances',60,true,'{"seed":"v5.2"}'::jsonb),
  ('arena_rank','en','/arena_rank','Shows arena rating and leaderboard','Shows arena rating and leaderboard','/arena_rank','Rating/rank panel is returned',70,true,'{"seed":"v5.2"}'::jsonb),
  ('wallet','en','/wallet','Shows SC HC RC balances','Shows SC HC RC balances','/wallet','Balance and daily cap info is returned',80,true,'{"seed":"v5.2"}'::jsonb),
  ('vault','en','/vault','Shows payout lock/tier/drip status','Shows payout lock/tier/drip status','/vault','Eligibility and remaining drip are shown',90,true,'{"seed":"v5.2"}'::jsonb),
  ('token','en','/token','Shows token wallet and request states','Shows token wallet and request states','/token','Token panel and latest requests are returned',100,true,'{"seed":"v5.2"}'::jsonb),
  ('story','en','/story','Shows story chapters and contract context','Shows story chapters and contract context','/story','Mechanic-effect notes are returned',110,true,'{"seed":"v5.2"}'::jsonb),
  ('help','en','/help','Lists command cards in TR/EN','Lists command cards in TR/EN','/help','Scenario and expected outcomes are listed',120,true,'{"seed":"v5.2"}'::jsonb)
ON CONFLICT (command_key, locale)
DO UPDATE SET
  title = EXCLUDED.title,
  purpose = EXCLUDED.purpose,
  purpose_text = EXCLUDED.purpose_text,
  scenario_text = EXCLUDED.scenario_text,
  outcome_text = EXCLUDED.outcome_text,
  ordering = EXCLUDED.ordering,
  active = EXCLUDED.active,
  payload_json = COALESCE(v5_command_help_cards.payload_json, '{}'::jsonb) || EXCLUDED.payload_json,
  updated_at = now();
