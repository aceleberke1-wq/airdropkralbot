# Architecture

This repository is a runnable scaffold for the AirdropKralBot system.

## Services
1. Telegram Bot (`apps/bot`)
2. Admin API (`apps/admin-api`)
3. Data stores (Postgres, Redis via `docker-compose.yml`)

## Data
1. Authoritative ledger in Postgres (`db/migrations`)
2. Hot state in Redis

## Event Model
1. Event-sourced economy ledger
2. Idempotent command handling
3. Immutable admin audit trail