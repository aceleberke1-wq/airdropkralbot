# V5 Runtime Guard + TX Verify Canary

## Scripts

- `npm run canary:v5:tx-verify`
  - Ensures `tx_verify_events_24h` floor by inserting a synthetic `chain_verify_logs` row when needed.
  - Synthetic rows use `verify_json.source="synthetic_canary"`.
- `npm run runtime:v5:guard`
  - Checks `/health` bot runtime (`alive`, `lock_acquired`, `mode`, `heartbeat_lag_sec`).
  - Writes report to `docs/V5_RUNTIME_GUARD_latest.json`.
- `node scripts/v5_kpi_daemon.mjs --once true`
  - Now runs `runtime guard` and `tx_verify canary` before KPI bundle cycle.

## Optional Env Vars

- `V5_TX_VERIFY_CANARY_ENABLED=1`
- `V5_TX_VERIFY_CANARY_WINDOW_HOURS=24`
- `V5_TX_VERIFY_CANARY_MIN_EVENTS=1`
- `V5_TX_VERIFY_CANARY_FORCE_INSERT=0`
- `V5_TX_VERIFY_CANARY_EMIT_REPORT=1`
- `V5_RUNTIME_GUARD_ENABLED=1`
- `RUNTIME_GUARD_BASE_URL=https://webapp.k99-exchange.xyz`
- `V5_RUNTIME_GUARD_EMIT_REPORT=1`
- `V5_RUNTIME_GUARD_NOTIFY_TELEGRAM=0`

