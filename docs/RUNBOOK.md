# Runbook

## Production topology
1. Tek Render web service kullan: `npm run start:all` (admin API + bot ayni proses grubu).
2. Worker kullanilmiyorsa `BOT_ENABLED=1`, `KEEP_ADMIN_ON_BOT_EXIT=1`, `BOT_AUTO_RESTART=1`.
3. Telegram polling conflict icin ayni tokenla ikinci bot instance calistirma.

## Admin authority lock
1. Telegram'da `/whoami` calistir ve `Telegram ID` degerini al.
2. Bu degeri local `.env` + Render `ADMIN_TELEGRAM_ID` icin birebir kullan.
3. Dogrulama:
`/admin` + `/admin_config` + `/admin_live` komutlari admin hesapta acik olmali.
4. API dogrulama:
`GET /admin/whoami` (Bearer token ile) `is_admin=true` donmeli.

## V3 flags
0. `FLAG_SOURCE_MODE=env_locked`
1. `ARENA_AUTH_ENABLED=1`
2. `RAID_AUTH_ENABLED=1`
3. `TOKEN_CURVE_ENABLED=1`
4. `TOKEN_AUTO_APPROVE_ENABLED=1`
5. `WALLET_AUTH_V1_ENABLED=1`
6. `KYC_THRESHOLD_V1_ENABLED=1`
7. `MONETIZATION_CORE_V1_ENABLED=1`
8. `WEBAPP_V3_ENABLED=1`
9. `WEBAPP_TS_BUNDLE_ENABLED=0|1` (`1` icin once `npm run build:webapp`; build sonu asset sync otomatik calisir)
10. `WALLET_VERIFY_MODE=format_only|strict_crypto`
11. `WALLET_CHALLENGE_TTL_SEC=300`, `WALLET_SESSION_TTL_SEC=86400`
12. `KYC_RISK_THRESHOLD=0.75`, `KYC_PAYOUT_BTC_THRESHOLD=0.001`
13. `SANCTIONED_WALLET_ADDRESSES=` (ops emergency blocklist, comma separated)
14. Degisimlerden sonra Render redeploy yap.
15. `WEBAPP_PUBLIC_URL=https://webapp.k99-exchange.xyz/webapp`
16. `WEBAPP_VERSION_OVERRIDE=` (normalde bos birak; runtime release marker SHA kullanir)

## Health checks
1. `/healthz` -> proses sagligi
2. `/health` -> DB + V3 tablo bagimliliklari
3. Beklenen: `ok=true`, dependency bayraklari `true`.
4. Bot runtime zorunlu alanlar:
- `bot_runtime.alive`
- `bot_runtime.lock_acquired`
- `bot_runtime.last_heartbeat_at`
- `bot_runtime.mode` (`polling|disabled`)
5. Admin runtime endpointleri:
- `GET /admin/runtime/bot`
- `POST /admin/runtime/bot/reconcile` (stale state toparlama / force stop kaydi)
- `GET /admin/runtime/flags/effective` (env/db effective bayraklar)
- `GET /admin/runtime/deploy/status` (release + lock + launch URL snapshot)
- `GET /webapp/api/admin/assets/status` (GLB manifest + registry durumu)
- `POST /webapp/api/admin/assets/reload` (asset registry/manifest cache yenile)
- `GET /webapp/api/v2/assets/manifest/resolved` (runtime serve edilen asset kaynaklari + missing list)

## WebApp recovery checks (v5.3-R)
1. Player bootstrap hizli yol:
- `GET /webapp/api/v2/bootstrap?uid=<uid>&ts=<ts>&sig=<sig>&scope=player&include_admin=0`
2. Admin heavy bootstrap lazy yol:
- `GET /webapp/api/v2/admin/bootstrap?uid=<uid>&ts=<ts>&sig=<sig>`
3. TS bundle asset zinciri:
- `GET /webapp/assets/manifest.json` -> `200`
- Manifestteki her `path` icin `GET /webapp/assets/<file>` -> `200`
4. Auth hata kurtarma kodlari:
- `expired`, `invalid_signature`, `missing_fields`, `webapp_secret_missing`
- Frontend bu kodlarda blocking recovery modal gostermelidir.

## Release readiness gate
1. Release oncesi:
`npm run check:release`
2. Script su adimlari zorunlu kontrol eder:
- strict env check
- `npm run test:bot`
- `npm run build:webapp` (skip edilmediyse)
- `npm run migrate:node`
- `npm run smoke:v5.1` (v2 bootstrap/payout/pvp/wallet/admin queue + confirm/cooldown rail)
- `.env` vs `.env.example` key diff
- `/healthz`, `/health`, `/webapp` smoke
- `/admin/runtime/bot` smoke
- bot runtime alanlari (`alive`, `lock_acquired`, `mode`) kontrolu
3. `/whoami` id'si sabitse ek kontrol:
`powershell -ExecutionPolicy Bypass -File scripts/check_release_readiness.ps1 -ExpectedAdminTelegramId <whoami_id>`

## KPI automation
1. Tek snapshot:
`npm run kpi:v5:snapshot -- --hours 24`
2. Bundle rapor (24h + 72h + 7d trend + markdown):
`npm run kpi:v5:bundle`
3. Haftalik trend preset:
`npm run kpi:v5:weekly`
4. Periyodik calisma (6 saatte bir):
`npm run kpi:v5:daemon`
5. Tek sefer daemon smoke:
`node scripts/v5_kpi_daemon.mjs --once true --interval_min 360`
6. Windows Task Scheduler kaydi (opsiyonel):
`powershell -ExecutionPolicy Bypass -File scripts/register_v5_kpi_tasks.ps1 -TaskName "AirdropKralBot-V5-KPI-6H" -EveryHours 6`
7. Scheduler kaldirma:
`powershell -ExecutionPolicy Bypass -File scripts/register_v5_kpi_tasks.ps1 -TaskName "AirdropKralBot-V5-KPI-6H" -UnregisterOnly`
8. Scheduler health kontrolu:
`npm run kpi:v5:task:check`
9. Uretilen dosyalar:
- `.runtime-artifacts/kpi/V5_KPI_BUNDLE_latest.json`
- `.runtime-artifacts/kpi/V5_KPI_BUNDLE_latest.md`
- `docs/V5_KPI_SNAPSHOT_latest.json`
10. KPI bundle scripti `v5_operational_slo_metrics` tablosuna metrik yazar (emit_slo=true).
11. SLO yazimini kapatmak icin:
`node scripts/v5_kpi_bundle.mjs --emit_slo false`
12. Admin v2 ops endpointleri:
- `GET /webapp/api/v2/admin/ops/kpi/latest?uid=<uid>&ts=<ts>&sig=<sig>`
- `POST /webapp/api/v2/admin/ops/kpi/run` (`uid, ts, sig, hours_short, hours_long, trend_days, emit_slo`)
13. V5.3 migration cift kontrolu:
`npm run validate:migrations:v5.3`
14. TS foundation check:
`npm run typecheck`
15. Admin API integration test paketi:
`npm run test:admin-api`
16. Canary guard (snapshot tabanli alarm esikleri):
`npm run canary:v5:guard`

## Chat alert automation
1. Tek dispatch smoke:
`npm run alerts:v5:dispatch -- --dry_run true --chest_limit 1 --mission_limit 1 --rare_limit 1 --war_limit 1 --season_limit 1 --event_limit 1 --comeback_limit 1 --streak_limit 1`
2. Normal dispatch:
`npm run alerts:v5:dispatch`
3. Windows Task Scheduler kaydi (saatlik):
`powershell -ExecutionPolicy Bypass -File scripts/register_v5_chat_alert_tasks.ps1 -TaskName "AirdropKralBot-V5-ChatAlerts-1H" -EveryHours 1`
4. Scheduler kaldirma:
`powershell -ExecutionPolicy Bypass -File scripts/register_v5_chat_alert_tasks.ps1 -TaskName "AirdropKralBot-V5-ChatAlerts-1H" -UnregisterOnly`
5. Scheduler health kontrolu:
`npm run alerts:v5:task:check`
6. Uretilen artifact:
- `.runtime-artifacts/alerts/V5_CHAT_ALERT_DISPATCH_latest.json`
7. Canli alert kapsamı:
- `chest_ready`
- `mission_refresh`
- `rare_drop`
- `kingdom_war`
- `streak_risk`
- `event_countdown`
- `season_deadline`
- `comeback_offer`
8. Dedupe ve anti-spam kaynagi:
- `behavior_events.event_type = chat_alert_sent`
9. Opt-out kaynagi:
- `user_ui_prefs.prefs_json`

## Live ops campaign scheduler
1. Tek dispatch smoke:
`npm run liveops:v5:dispatch -- --dry_run true`
2. Normal scheduler dispatch:
`npm run liveops:v5:dispatch`
3. Windows Task Scheduler kaydi (15 dakikada bir):
`powershell -ExecutionPolicy Bypass -File scripts/register_v5_live_ops_campaign_tasks.ps1 -TaskName "AirdropKralBot-V5-LiveOps-15M" -EveryMinutes 15`
4. Scheduler kaldirma:
`powershell -ExecutionPolicy Bypass -File scripts/register_v5_live_ops_campaign_tasks.ps1 -TaskName "AirdropKralBot-V5-LiveOps-15M" -UnregisterOnly`
5. Scheduler health kontrolu:
`npm run liveops:v5:task:check`
6. Uretilen artifact:
- `.runtime-artifacts/liveops/V5_LIVE_OPS_CAMPAIGN_DISPATCH_latest.json`
7. Duplicate window guard:
- `admin_audit.action = live_ops_campaign_dispatch`
- `payload_json.dispatch_source = scheduler`
- `payload_json.window_key`

## V5.3 staging + canary checklist
1. Staging preflight:
`npm run test:bot`
2. Staging preflight:
`npm run test:admin-api`
3. Staging KPI snapshot:
`npm run kpi:v5:snapshot -- --hours 24`
4. Staging canary guard:
`npm run canary:v5:guard -- --snapshot docs/V5_KPI_SNAPSHOT_latest.json`
5. Canary 24h izleme (opsiyonel taze snapshot):
`npm run canary:v5:guard -- --refresh_snapshot true --hours 24`
6. Varsayilan alarm esikleri:
- `command_events_24h >= 1`
- `queue_success_rate_pct >= 80`
- `queue_failed_rate_pct <= 25`
- `queue_queued_events <= 3`
- `tx_verify_error_rate_pct <= 20`
- `idempotency_conflict_events_24h <= 3`
- `invalid_action_request_id_events_24h <= 1`
7. Gerekirse esik override:
`npm run canary:v5:guard -- --max_queue_failed_rate_pct 15 --max_tx_verify_error_rate_pct 10 --max_idempotency_conflict_events_24h 1`
8. Guard rapor dosyalari:
- `docs/V5_CANARY_GUARD_latest.json`
- `docs/V5_CANARY_GUARD_<UTCSTAMP>.json`

## Freeze mode
1. Admin panelden freeze ac: `/admin_freeze on <reason>` veya WebApp admin freeze.
2. Freeze acikken yeni task/session baslatma bloklanir.
3. Kuyruklar (payout/token) incelenir, riskli talepler manual review'da tutulur.

## Token treasury ops
1. Curve degisikligi: WebApp admin `Curve Kaydet` veya `/admin/token/curve`.
2. Auto policy degisikligi: WebApp admin `Auto Policy Kaydet` veya `/admin/token/auto-policy`.
3. Quote quorum kontrolu:
   `GET /webapp/api/token/quote` payloadinda `quote_quorum` alaninda `decision`, `provider_count`, `agreement_ratio` degerlerini izle.
4. Otomatik onay sadece policy + gate + onchain verify kosullari gecerse aktif olur.

## Rollout
1. Once backend migration + deploy.
2. Sonra WebApp V3 endpoint/arayuz deploy.
3. En son curve + auto-policy aktif et.
4. Canary kullanici grubunda duplicate action, reveal conversion, auto-approve oranlarini izle.
5. V4 rollout scriptleri:
`npm run rollout:v4` -> admin canary
`npm run rollout:v4:25` -> %25 rollout + payout release run
`npm run rollout:v4:100` -> %100 rollout + payout release run
6. V5 rollout scriptleri:
`npm run rollout:v5` -> admin canary
`npm run rollout:v5:25` -> %25 rollout + payout release run
`npm run rollout:v5:100` -> %100 rollout + payout release run
7. `rollout:v5`, `rollout:v5:25`, `rollout:v5:100` stage sonlarinda canary guard otomatik calisir.
8. Stage default guardrail seviyesi:
- `admin_canary`: temel esikler (lenient)
- `rollout_25`: daha siki esikler
- `rollout_100`: en siki esikler
9. Stage varsayilan canary esikleri:
- `admin_canary`: `queue_success>=80`, `queue_failed<=25`, `queued<=3`, `tx_verify_error<=20`, `idempotency_conflict<=3`, `invalid_action_request_id<=1`
- `rollout_25`: `queue_success>=85`, `queue_failed<=15`, `queued<=2`, `tx_verify_error<=12`, `idempotency_conflict<=2`, `invalid_action_request_id<=1`
- `rollout_100`: `queue_success>=90`, `queue_failed<=10`, `queued<=1`, `tx_verify_error<=8`, `idempotency_conflict<=1`, `invalid_action_request_id<=0`
10. Acil bypass gerekiyorsa (onerilmez):
`npm run rollout:v5 -- --skip_canary_guard true`
11. Rollout gate raporu:
- `docs/V5_CANARY_GUARD_rollout_latest.json`
- `docs/V5_CANARY_GUARD_rollout_<UTCSTAMP>.json`
12. API hedefi:
- `ADMIN_API_BASE_URL` set edilirse scriptler onu kullanir.
- `ADMIN_API_BASE_URL` bos ise scriptler `http://127.0.0.1:${ADMIN_API_PORT}` (default `4000`) fallback ile calisir.
13. Go-live strict checklist + auto dogrulama:
- `npm run golive:v5:check` -> strict metrik readiness raporu uretir (`docs/V5_GOLIVE_CHECK_latest.json`, `docs/V5_GOLIVE_CHECK_latest.md`).
- `npm run golive:v5:auto` -> once strict readiness kontrolu yapar, gecerse otomatik `rollout_25 -> rollout_100` strict zinciri tetikler.
- `golive:v5:auto` hicbir fake/backfill veri yazmaz; yalnizca canli metrikler gecerliyse rollout calisir.

## Rollback
1. Feature flag kapat (`ARENA_AUTH_ENABLED=0` vb).
2. Gerekirse token curve flag kapatip spot modele don.
3. Config geri alma: `config_versions` son stabil versiyona don.
4. Incident varsa freeze acik tut, audit log + queue export al.
5. Son release marker kontrolu:
`GET /admin/release/latest`
6. V4 hizli geri donus:
`npm run rollback:v4`
7. V5 hizli geri donus:
`npm run rollback:v5`
