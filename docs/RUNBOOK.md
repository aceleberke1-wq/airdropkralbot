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
1. `ARENA_AUTH_ENABLED=1`
2. `RAID_AUTH_ENABLED=1`
3. `TOKEN_CURVE_ENABLED=1`
4. `TOKEN_AUTO_APPROVE_ENABLED=1`
5. `WEBAPP_V3_ENABLED=1`
6. `WEBAPP_TS_BUNDLE_ENABLED=0|1` (`1` icin once `npm run build:webapp`)
7. Degisimlerden sonra Render redeploy yap.

## Health checks
1. `/healthz` -> proses sagligi
2. `/health` -> DB + V3 tablo bagimliliklari
3. Beklenen: `ok=true`, dependency bayraklari `true`.

## Release readiness gate
1. Release oncesi:
`npm run check:release`
2. Script su adimlari zorunlu kontrol eder:
- strict env check
- `npm run test:bot`
- `npm run build:webapp` (skip edilmediyse)
- `npm run migrate:node`
- `.env` vs `.env.example` key diff
- `/healthz`, `/health`, `/webapp` smoke
3. `/whoami` id'si sabitse ek kontrol:
`powershell -ExecutionPolicy Bypass -File scripts/check_release_readiness.ps1 -ExpectedAdminTelegramId <whoami_id>`

## Freeze mode
1. Admin panelden freeze ac: `/admin_freeze on <reason>` veya WebApp admin freeze.
2. Freeze acikken yeni task/session baslatma bloklanir.
3. Kuyruklar (payout/token) incelenir, riskli talepler manual review'da tutulur.

## Token treasury ops
1. Curve degisikligi: WebApp admin `Curve Kaydet` veya `/admin/token/curve`.
2. Auto policy degisikligi: WebApp admin `Auto Policy Kaydet` veya `/admin/token/auto-policy`.
3. Otomatik onay sadece policy + gate + onchain verify kosullari gecerse aktif olur.

## Rollout
1. Once backend migration + deploy.
2. Sonra WebApp V3 endpoint/arayuz deploy.
3. En son curve + auto-policy aktif et.
4. Canary kullanici grubunda duplicate action, reveal conversion, auto-approve oranlarini izle.

## Rollback
1. Feature flag kapat (`ARENA_AUTH_ENABLED=0` vb).
2. Gerekirse token curve flag kapatip spot modele don.
3. Config geri alma: `config_versions` son stabil versiyona don.
4. Incident varsa freeze acik tut, audit log + queue export al.
5. Son release marker kontrolu:
`GET /admin/release/latest`
