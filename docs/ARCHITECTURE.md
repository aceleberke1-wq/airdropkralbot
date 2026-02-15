# Architecture

This repository runs AirdropKralBot as a single-service production stack.

## Services
1. Telegram Bot (`apps/bot`) - gameplay, rewards, payout entitlement flows
2. Admin API + WebApp host (`apps/admin-api`) - REST, WebApp, admin operations
3. WebApp (`apps/webapp`) - Three.js Nexus UI + authoritative action client + adaptive quality/accessibility toggles
4. Data store: Postgres (authoritative source of truth)

## Data
1. Core economy + identity + payouts tables (`V001+`)
2. Authoritative arena session tables (`V015`)
3. Token market curve + auto decision tables (`V016`)
4. Telemetry/funnel tables (`V017`)
5. Feature flags + runtime ops tables (`V018`)
6. Release revision markers (`V019`)
7. Raid sessions + boss cycles (`V020`)
8. Device perf/ui preference tables (`V021`)
9. External API health + oracle snapshots (`V022`)
10. Treasury guardrails + payout gate events (`V023`)

## Authoritative game loop
1. WebApp starts session: `/webapp/api/arena/session/start`
2. Client actions are queued and sent with `session_ref + action_seq`
3. Backend validates action window/latency/replay and writes once
4. Resolve endpoint computes reward server-side only
5. Credits use idempotent ledger refs (exactly-once)
6. Raid loop mirrors same model:
   `/webapp/api/arena/raid/session/start|action|resolve|state`

## Token treasury model
1. Quote endpoint uses curve price:
   `price = max(admin_floor, base * (1 + k*ln(1+supply_norm)) * demand_factor)`
2. Buy intent -> tx submit -> policy evaluation
3. Semi-auto approval requires:
   `usd <= limit`, `risk <= threshold`, `velocity pass`, `onchain verified`, `gate open`
4. Fail policy => manual review queue

## Control plane
1. Admin endpoints for freeze, curve, auto-policy, payout/token queue decisions
2. Runtime switches via feature flags
   `ARENA_AUTH_ENABLED`, `RAID_AUTH_ENABLED`, `TOKEN_CURVE_ENABLED`,
   `TOKEN_AUTO_APPROVE_ENABLED`, `WEBAPP_V3_ENABLED`, `WEBAPP_TS_BUNDLE_ENABLED`
3. Immutable `admin_audit` trail for sensitive operations
4. Release traceability via `release_markers` (`/admin/release/mark`, `/admin/release/latest`)

## Reliability
1. `/healthz` for process liveness
2. `/health` for DB/dependency checks (arena/token/queue/release marker tables)
3. Single-instance polling protection via DB lock key
