# AirdropKralBot

This is a runnable scaffold for the AirdropKralBot system. It includes a Telegram bot stub, an admin API stub, database migrations, and configuration files.

## Quick Start
1. Open PowerShell and switch to the repo root.
2. Copy `.env.example` to `.env` and set required values.
3. Install dependencies with `npm install` at the repo root.
4. Start data stores with `docker compose up -d` (or `docker-compose up -d`).
5. Apply migrations with `powershell -ExecutionPolicy Bypass -File scripts/migrate.ps1`.
6. Run the bot with `npm run dev:bot`.
7. Run the admin API with `npm run dev:admin`.

## Doctor
Run `powershell -ExecutionPolicy Bypass -File scripts/doctor.ps1` to check required tools.

## Env Bootstrap
Run `powershell -ExecutionPolicy Bypass -File scripts/bootstrap_env.ps1` to auto-fill missing runtime vars and generate `ADMIN_API_TOKEN` if needed.

## Dry Run
Set `BOT_DRY_RUN=1` in `.env` to run the bot without connecting to Telegram. The bot still validates the database connection.

## Loop v2 Flag
Set `LOOP_V2_ENABLED=1` in `.env` to enable the Loop v2 economy/anti-abuse flow.

## Gameplay Commands
1. `/tasks` task loop
2. `/onboard` 3 adim hizli baslangic
3. `/wallet` balances + daily cap
4. `/daily` daily operations panel
5. `/kingdom` tier/reputation progress panel
6. `/season` season stats
7. `/leaderboard` top players
8. `/shop` live offers and boosts
9. `/missions` daily mission rewards
10. `/war` global community war room
11. `/payout` entitlement payout panel (request only, no custody)
12. `/status` live system snapshot
13. `/play` rich Arena UI (3D + animated dashboard)
14. `/finish [safe|balanced|aggressive]` command fallback to complete latest pending attempt
15. `/reveal` command fallback to reveal latest completed attempt
16. `/token` virtual token wallet + payment requests
17. `/mint [amount]` convert SC/HC/RC into in-bot token
18. `/buytoken <usd> <chain>` create payment intent to payout addresses
19. `/tx <requestId> <txHash>` submit payment proof tx hash
20. `/ops` risk/event operation console
21. `/raid [safe|balanced|aggressive]` arena raid loop (RC ticket sink + rating)
22. `/arena_rank` arena rating + leaderboard
23. `/nexus` daily anomaly pulse + tactical recommendation
24. `/contract` daily Nexus contract target and reward model
25. `/whoami` current telegram id + admin match check
26. `/admin` admin panel
27. `/admin_live` canli queue + gate + freeze ozeti
28. `/admin_payouts` payout queue quick view
29. `/admin_tokens` token queue quick view
30. `/admin_freeze on|off [reason]` freeze control
31. `/admin_config` active economy/token config summary
32. `/admin_token_price <usd>` token spot update
33. `/admin_token_gate <minCapUsd> [targetMaxUsd]` payout gate update
34. `/admin_metrics` 24 saatlik operasyon metrikleri
35. `/pay <requestId> <txHash>` mark payout paid
36. `/reject_payout <requestId> <reason>` reject payout
37. `/approve_token <requestId> [note]` approve token buy request
38. `/reject_token <requestId> <reason>` reject token buy request
39. Slashsiz intent fallback: `gorev`, `bitir dengeli`, `reveal`, `raid aggressive`, `arena 3d`, `kontrat`
40. Admin lock rule: `/whoami` Telegram ID must exactly match `ADMIN_TELEGRAM_ID` (local + Render env)
41. `/raid_contract` canli raid kontrat + bonus paketi
42. `/ui_mode` son UI preference + kalite ozeti
43. `/perf` fps/latency + provider health ozeti

## Micro Loop Extras
1. Task panel includes `Panel Yenile (1 RC)` sink for fresh lineup.
2. Daily mission board now tracks combo, aggressive win, rare hunt, and war contribution.
3. Daily `Nexus Contract` loop now adds mode+family+result objectives with SC/RC/SP/War modifiers.

## WebApp (Rich UI)
1. Open `/play` in bot to launch the Arena interface.
2. Keep admin API running (`npm run dev:admin`) because WebApp is served there.
3. Served from `apps/webapp` via admin API routes:
`GET /webapp`, `GET /webapp/app.js`, `GET /webapp/styles.css`.
4. Data endpoints:
`GET /webapp/api/bootstrap`, `POST /webapp/api/tasks/reroll`,
`POST /webapp/api/actions/accept`, `POST /webapp/api/actions/complete`, `POST /webapp/api/actions/reveal`,
`POST /webapp/api/actions/claim_mission`,
`POST /webapp/api/arena/raid`, `GET /webapp/api/arena/leaderboard`,
`POST /webapp/api/arena/session/start`, `POST /webapp/api/arena/session/action`,
`POST /webapp/api/arena/session/resolve`, `GET /webapp/api/arena/session/state`,
`POST /webapp/api/arena/raid/session/start`, `POST /webapp/api/arena/raid/session/action`,
`POST /webapp/api/arena/raid/session/resolve`, `GET /webapp/api/arena/raid/session/state`,
`GET /webapp/api/arena/director`,
`GET /webapp/api/token/summary`, `POST /webapp/api/token/mint`,
`POST /webapp/api/token/buy_intent`, `POST /webapp/api/token/submit_tx`,
`GET /webapp/api/token/quote`,
`GET /webapp/api/telemetry/perf-profile`, `POST /webapp/api/telemetry/perf-profile`.
Admin WebApp endpoints:
`GET /webapp/api/admin/summary`, `GET /webapp/api/admin/metrics`,
`POST /webapp/api/admin/freeze`, `POST /webapp/api/admin/token/config`,
`GET /webapp/api/admin/queues`, `POST /webapp/api/admin/token/curve`,
`POST /webapp/api/admin/token/auto_policy`,
`POST /webapp/api/admin/token/approve`, `POST /webapp/api/admin/token/reject`,
`POST /webapp/api/admin/payout/pay`, `POST /webapp/api/admin/payout/reject`.
5. Arena flow in WebApp can now run end-to-end (accept, complete, reveal) without leaving the WebApp.
6. Telegram `web_app` button requires `https://`. If `WEBAPP_PUBLIC_URL` is `http://localhost...`, bot now falls back to normal URL button (local test mode).
7. Real 3D asset pipeline is enabled:
`apps/webapp/assets/manifest.json` -> `models.arena_core` path (GLB).  
If model exists, GLTF animations auto-play. If not, procedural fallback scene stays active.
8. WebApp now includes adaptive performance controls (Auto/High/Low), reduced-motion mode, and large typography mode.
9. WebApp TS bundle (Vite) optional rollout:
`npm run build:webapp` then set `WEBAPP_TS_BUNDLE_ENABLED=1`.

## Domain + DNS (k99-exchange.xyz)
1. For Telegram Mini App mode, `WEBAPP_PUBLIC_URL` must be `https://.../webapp`.
2. Use helper script:
`powershell -ExecutionPolicy Bypass -File scripts/config_webapp_domain.ps1 -WebAppHost "webapp.k99-exchange.xyz" -DnsTarget "airdropkral-admin.onrender.com"`
3. DNS record required:
`CNAME webapp -> airdropkral-admin.onrender.com`
4. If your NS is `ns1.vercel-dns.com / ns2.vercel-dns.com`, DNS must be edited in Vercel DNS (Namecheap Advanced DNS will not apply).
5. If you want to manage DNS in Namecheap, switch nameservers to Namecheap BasicDNS first.
6. Validate DNS + HTTPS routing:
`powershell -ExecutionPolicy Bypass -File scripts/check_webapp_dns.ps1`

## Render Alternative (Local HTTPS via ngrok)
If Render setup is blocked, run local and expose HTTPS:

1. Start admin API locally (`npm run dev:admin`)
2. Run:
`powershell -ExecutionPolicy Bypass -File scripts/use_ngrok_local.ps1 -StartBot`
3. Script creates an HTTPS tunnel, updates `.env` `WEBAPP_PUBLIC_URL`, and can start bot.
4. Telegram `/play` will use the ngrok HTTPS URL.

The script now tries `ngrok` first, then automatically falls back to `cloudflared` quick tunnel.

Note: free tunnel URL changes on each restart. Re-run script when it changes.

## Render Deploy (for domain-backed WebApp)
1. Repo includes `render.yaml` with **single free web service**.
2. Create Blueprint in Render from this repo.
3. Set required secrets:
`BOT_TOKEN`, `BOT_USERNAME`, `ADMIN_TELEGRAM_ID`, payout addresses, `DATABASE_URL`, `ADMIN_API_TOKEN`, `WEBAPP_HMAC_SECRET`, `WEBAPP_PUBLIC_URL`.
4. Keep `WEBAPP_PUBLIC_URL=https://webapp.k99-exchange.xyz/webapp`.
5. Add custom domain `webapp.k99-exchange.xyz` to the admin web service.
6. DNS:
if NS is Vercel -> add CNAME in Vercel DNS (`webapp -> <render-service>.onrender.com`).
if NS is Namecheap -> add the same CNAME in Namecheap Advanced DNS.
7. Start command should be `npm run start:all`.
8. If free web service sleeps, configure an external uptime ping to `/health` every 5 minutes.
9. `DATABASE_URL` must be cloud DB URL (Neon/Render DB). Do not use `localhost`.
10. Free plan recommended flags:
`BOT_ENABLED=1`, `BOT_AUTO_RESTART=1`, `KEEP_ADMIN_ON_BOT_EXIT=1`, `BOT_INSTANCE_LOCK_KEY=7262026`
V3 feature flags:
`ARENA_AUTH_ENABLED=1`, `RAID_AUTH_ENABLED=1`, `TOKEN_CURVE_ENABLED=1`, `TOKEN_AUTO_APPROVE_ENABLED=1`, `WEBAPP_V3_ENABLED=1`, `WEBAPP_TS_BUNDLE_ENABLED=0|1`
Run only one polling instance per token. If local and Render use same DB lock key, duplicate instance auto-stops.
11. Validate local `.env` before copying to Render:
`powershell -ExecutionPolicy Bypass -File scripts/check_render_env.ps1`
12. Run release gate before pushing `main`:
`npm run check:release`
13. If admin commands fail, run `/whoami` in Telegram and set the exact value as `ADMIN_TELEGRAM_ID`.
14. Optional strict release check with explicit admin ID:
`powershell -ExecutionPolicy Bypass -File scripts/check_release_readiness.ps1 -ExpectedAdminTelegramId <whoami_id>`
15. Optional chain verification flags:
`TOKEN_TX_VERIFY=1` enables explorer/RPC lookup on tx submission.
`TOKEN_TX_VERIFY_STRICT=1` rejects tx hashes not found on-chain.

### Fast Deploy Checklist (current repo)
1. Push latest main branch.
2. In Render service (`airdropkral-admin`), set start command to `npm run start:all`.
3. Ensure env includes:
`BOT_ENABLED=1`, `KEEP_ADMIN_ON_BOT_EXIT=1`, `BOT_AUTO_RESTART=1`, `BOT_INSTANCE_LOCK_KEY=7262026`, `BOT_DRY_RUN=0`.
4. Ensure `DATABASE_URL` is Neon/managed DB URL (not localhost), `DATABASE_SSL=1`.
5. Run one-time migration from local with the same cloud DB:
`npm run migrate:node`
6. Redeploy service.
7. Validate:
`https://<render-service>.onrender.com/health`
`https://webapp.k99-exchange.xyz/webapp`

### Why this matters
- Telegram allows only one polling consumer for the same bot token.
- If local bot and Render bot poll together, bot exits with `409`.
- Instance lock (`BOT_INSTANCE_LOCK_KEY`) prevents double-start when both point to same Postgres.

## GitHub Push (required for Render)
1. Publish this local folder to GitHub:
`powershell -ExecutionPolicy Bypass -File scripts/publish_github.ps1 -RepoName "airdropkralbot" -Private`
or explicitly:
`powershell -ExecutionPolicy Bypass -File scripts/publish_github.ps1 -Owner "YOUR_GITHUB_USER" -RepoName "airdropkralbot"`
2. Script will:
- initialize git repo
- commit files (without `.env`)
- create GitHub repo via `gh` CLI
- push `main` branch
3. Then in Render, select that repo and deploy Blueprint (`render.yaml`).

## Local Dev Quick Start (Windows)

If Telegram returns `409 Conflict: terminated by other getUpdates request`, you have multiple bot instances.

Use one command to reset and relaunch:

`powershell -ExecutionPolicy Bypass -File scripts/dev_up.ps1`
6. Auth model:
signed query/body fields (`uid`, `ts`, `sig`) with `WEBAPP_HMAC_SECRET`.

## Payout Semantics
1. User requests are entitlement-based and BTC-only.
2. On request, source HC is locked (debited from wallet) using idempotent ledger refs.
3. On admin reject, locked HC is refunded exactly-once.
4. On admin pay, TX hash is stored and visible in payout panel.

## Virtual Token Semantics
1. In-bot token is ledger-based (`currency_balances`) and non-custodial.
2. Users can mint by burning SC/HC/RC with deterministic conversion rules from `config/economy_params.yaml`.
3. Users can open buy intents by chain; payment addresses come from env payout addresses.
4. Users submit tx hash as proof; admin approves/rejects in admin API.
5. Approval credits token exactly once using idempotent `ref_event_id`.
6. TX hash format is chain-validated (BTC/ETH/TRX/SOL/TON).
7. If `TOKEN_TX_VERIFY=1`, on-chain check runs against public explorer/RPC APIs before saving tx proof.
8. Payout panel is market-cap gated via `token.payout_gate` (e.g. min `$10,000,000`).

## Tests
Run bot tests with:
1. `npm run test:bot`
2. Full release readiness: `npm run check:release`

## Admin API Notes
1. `POST /admin/configs` writes versioned configs to DB (`config_versions`)
2. `GET /admin/configs/:key` reads active config
3. `POST /admin/system/freeze` toggles freeze state
4. `GET /admin/system/state` returns freeze + active config versions
5. `GET /admin/payouts` payout queue list
6. `GET /admin/payouts/:id` payout detail
7. `POST /admin/payouts/:id/pay` mark paid + tx hash
8. `POST /admin/payouts/:id/reject` reject request
9. `GET /admin/token/requests` token buy request queue
10. `POST /admin/token/requests/:id/approve` approve + credit token
11. `POST /admin/token/requests/:id/reject` reject token request
12. `GET /admin/whoami` compares `x-admin-id` with configured `ADMIN_TELEGRAM_ID`
13. `POST /admin/release/mark` writes deploy/config/health release marker
14. `GET /admin/release/latest` returns latest release marker

## Migrations
SQL migrations are in `db/migrations`. Apply them with your preferred migration tool.
Latest baseline for V3.2: `V015..V023`.

## Structure
1. `apps/bot` Telegram bot stub
2. `apps/admin-api` Admin API stub
3. `db/migrations` Postgres schema
4. `config` Economy parameters
5. `docs` Architecture and security notes
If `psql` is not installed, use Node migration runner:
`npm run migrate:node`
