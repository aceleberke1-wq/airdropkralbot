# AirdropKralBot V5.2 System Audit

## Summary

This document captures the current V5.2 implementation baseline and the execution order for hardening.
Scope covers bot command runtime, admin-api v2 interface shape, wallet/KYC rails, payout policy rails, and migration readiness.

## Module Inventory

1. Bot Adapter: `apps/bot/src/index.js`, command registry/intent routing, Telegram callback layer.
2. Admin API Orchestrator: `apps/admin-api/src/index.js`, `/webapp/api/v2/*` shaping and policy rails.
3. V5 Domain Core: `packages/shared/src/v5/*` (`commandEngine`, `payoutLockEngine`, `progressionEngine`, `adminPolicyEngine`, `walletAuthEngine`).
4. WebApp Surface: `apps/webapp/app.js`, `apps/webapp/src/main.ts`, player-mode UX + advanced ops rails.
5. Data Layer: `db/migrations/*`, `db/migrations/rollback/*`.

## Command Contract Baseline

Mandatory contract fields are now normalized and validated for every command:

- `key`
- `aliases`
- `description_tr`
- `description_en`
- `intents`
- `scenarios`
- `outcomes`
- `adminOnly`
- `min_role`
- `handler`
- `primary`

Fallback policy:

1. Missing `intents` -> fallback from `key`.
2. Missing `scenarios` -> fallback to `/<key>`.
3. Missing `outcomes` -> fallback from description or key-derived panel text.

## API Shape Baseline

### `/webapp/api/v2/bootstrap`

Guaranteed fields:

1. `api_version`
2. `command_catalog`
3. `runtime_flags_effective`
4. `wallet_capabilities`
5. `wallet_session`
6. `kyc_status`
7. `monetization`

### `/webapp/api/v2/admin/queue/unified`

Unified item schema is normalized:

1. `kind`
2. `request_id`
3. `status`
4. `priority`
5. `queue_age_sec`
6. `policy_reason_code`
7. `policy_reason_text`
8. `action_policy`
9. `queue_key`
10. `user_id`
11. `queue_ts`
12. `payload`

## Migration Matrix (V5.2 Additions)

1. `V061` command catalog constraints and contract columns.
2. `V062` command catalog and help-card seed (TR/EN).
3. `V063` intent resolution quality telemetry columns/indexes.
4. `V064` unified queue state transition + policy reason dictionary.
5. `V065` admin confirm token and cooldown tables.
6. `V066` wallet nonce hardening.
7. `V067` multichain wallet primary-address model.
8. `V068` KYC threshold decision logs.
9. `V069` PvP contract template catalog.
10. `V070` story reward effect versioning.
11. `V071` monetization ledger model.
12. `V072` cutover compare metrics + primary switch events.

Each migration has a rollback under `db/migrations/rollback`.

## Validation Checklist

1. `npm run test:bot` must pass.
2. `node --check apps/admin-api/src/index.js` must pass.
3. `node --check packages/shared/src/v5/commandEngine.js` must pass.
4. Apply migrations in sequence (`V061 -> V072`) on staging.
5. Run smoke with v2 bootstrap + queue endpoints.

## Open Operational Follow-ups

1. None at this stage; previous operational gaps were closed in this pass.

## Completed in this pass

1. Admin critical confirm/cooldown is now DB-backed in `apps/admin-api/src/index.js` when `v5_admin_confirm_tokens` and `v5_admin_action_cooldowns` tables exist, with in-memory fallback.
2. `scripts/smoke_v5_1.ps1` now enforces integration-level schema assertions for `/webapp/api/v2/bootstrap`, `/webapp/api/v2/commands/catalog`, and `/webapp/api/v2/admin/queue/unified` item transforms.
3. `scripts/v5_rollout_canary.mjs` now blocks canary rollout when DB is missing any `V061..V072` migration and supports explicit bypass via `--skip-migration-guard true`.
