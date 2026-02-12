# Runbook

## Freeze Mode
1. Set system.freeze to true
2. Disable task generation
3. Show maintenance message

## Degraded Mode
1. Switch to deterministic rewards
2. Throttle payouts

## Recovery
1. Roll back config via config_versions
2. Restore DB snapshot if needed
3. Re-enable services gradually