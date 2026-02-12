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
2. `/wallet` balances + daily cap
3. `/daily` daily operations panel
4. `/kingdom` tier/reputation progress panel
5. `/season` season stats
6. `/leaderboard` top players
7. `/shop` live offers and boosts
8. `/missions` daily mission rewards
9. `/war` global community war room
10. `/payout` entitlement payout panel (request only, no custody)
11. `/status` live system snapshot
12. `/play` rich Arena UI (3D + animated dashboard)
13. `/finish [safe|balanced|aggressive]` command fallback to complete latest pending attempt
14. `/reveal` command fallback to reveal latest completed attempt
15. Slashsiz intent fallback: `gorev`, `bitir dengeli`, `reveal`, `raid aggressive`, `arena 3d`
15. `/ops` risk/event operation console
16. `/raid [safe|balanced|aggressive]` arena raid loop (RC ticket sink + rating)
17. `/arena_rank` arena rating + leaderboard

## Micro Loop Extras
1. Task panel includes `Panel Yenile (1 RC)` sink for fresh lineup.
2. Daily mission board now tracks combo, aggressive win, rare hunt, and war contribution.

## WebApp (Rich UI)
1. Open `/play` in bot to launch the Arena interface.
2. Keep admin API running (`npm run dev:admin`) because WebApp is served there.
3. Served from `apps/webapp` via admin API routes:
`GET /webapp`, `GET /webapp/app.js`, `GET /webapp/styles.css`.
4. Data endpoints:
`GET /webapp/api/bootstrap`, `POST /webapp/api/tasks/reroll`,
`POST /webapp/api/actions/accept`, `POST /webapp/api/actions/complete`, `POST /webapp/api/actions/reveal`,
`POST /webapp/api/actions/claim_mission`,
`POST /webapp/api/arena/raid`, `GET /webapp/api/arena/leaderboard`.
5. Arena flow in WebApp can now run end-to-end (accept, complete, reveal) without leaving the WebApp.
6. Telegram `web_app` button requires `https://`. If `WEBAPP_PUBLIC_URL` is `http://localhost...`, bot now falls back to normal URL button (local test mode).
7. Real 3D asset pipeline is enabled:
`apps/webapp/assets/manifest.json` -> `models.arena_core` path (GLB).  
If model exists, GLTF animations auto-play. If not, procedural fallback scene stays active.

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
1. Repo includes `render.yaml` with **single free web service** (admin API + bot in one process).
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

## Tests
Run bot tests with:
1. `npm run test:bot`

## Admin API Notes
1. `POST /admin/configs` writes versioned configs to DB (`config_versions`)
2. `GET /admin/configs/:key` reads active config
3. `POST /admin/system/freeze` toggles freeze state
4. `GET /admin/system/state` returns freeze + active config versions
5. `GET /admin/payouts` payout queue list
6. `GET /admin/payouts/:id` payout detail
7. `POST /admin/payouts/:id/pay` mark paid + tx hash
8. `POST /admin/payouts/:id/reject` reject request

## Migrations
SQL migrations are in `db/migrations`. Apply them with your preferred migration tool.

## Structure
1. `apps/bot` Telegram bot stub
2. `apps/admin-api` Admin API stub
3. `db/migrations` Postgres schema
4. `config` Economy parameters
5. `docs` Architecture and security notes
If `psql` is not installed, use Node migration runner:
`npm run migrate:node`
