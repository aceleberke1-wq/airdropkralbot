# AirdropKralBot Canonical Product Blueprint V1

Kaynak blueprint: `packages/shared/src/architecture/canonicalProductBlueprint.js`

Bu dokuman prompt 1, 2, 3, 4 ve 5 ciktisini tek kanonik urun tasariminda birlestirir. Buradaki kararlar alternatif degil, final architecture lock olarak alinmalidir. Gecis stack'leri, debug shell kararlari veya eski naming'ler kanonik sayilmaz.

## 1. Final Canonical Architecture

### Final architecture lock

1. Telegram chat kokpit, trust surface ve reactivation kanalidir.
2. Telegram Mini App asil gameplay, economy ve immersion surface'idir.
3. Final frontend stack `Next.js App Router + TypeScript + Babylon.js + TanStack Query + Zod` olur.
4. Backend `Node.js + Fastify + additive v2 APIs + worker queues` olarak kalir.
5. `PostgreSQL` identity, ledger, payout, content, experiment ve review truth'tur.
6. `Redis` sadece rate limit, dedupe, locks, cooldown ve hot cache icin vardir.
7. `TON` tek primary identity chain'dir.
8. `EVM` ve `Solana` optional secondary linked wallet rails'dir.
9. `Bitcoin` MVP payout destination rail'idir; primary session wallet degildir.
10. Runtime custody yoktur; final payout transferleri external operator execution ile olur.
11. Event naming kontrati tum surface'lerde `family.object.verb` olur.
12. Chat, Mini App ve admin linkleri tek `route_key + panel_key + focus_key` grammar'ini kullanir.

### Rejected alternatives

1. `Vite + React + Three` son hedef mimari olarak reddedildi.
2. Chain-neutral identity reddedildi.
3. Fully onchain gameplay reddedildi.
4. Chat'in ana gameplay surface olmasi reddedildi.
5. Global tek locale ve tek event takvimi modeli reddedildi.
6. Redis'in financial truth olmasi reddedildi.
7. Direct hot-wallet payout reddedildi.
8. Sabit kalite modu reddedildi.
9. Free-text operator copy sistemi reddedildi.

### Final architecture summary

1. Product identity: Telegram-native Web3 arena.
2. Player surfaces:
   - Telegram chat cockpit
   - Telegram Mini App 3D world
3. Operator surfaces:
   - separate React admin workspace
   - hidden Telegram admin commands only for emergency
4. Content system:
   - versioned locale bundles
   - versioned content bundles
5. Canonical navigation routes:
   - `hub`
   - `missions`
   - `forge`
   - `exchange`
   - `season`
   - `events`
   - `vault`
   - `settings`

### Unified currency model

1. `SC` = Soft Credits
   Primary offchain activity currency. Withdrawable degil.
2. `RC` = Relic Credits
   Scarcity, crafting ve event currency. Withdrawable degil.
3. `HC` = Hard Credits
   Yuksek degerli offchain currency ve entitlement feeder. Withdrawable degil.
4. `payout_available`
   Append-only entitlement truth'ten turetilen withdrawable liability degeridir.
5. `NXT` = Nexus Token
   TON utility ve settlement token'idir. Main gameplay faucet degildir.

### MVP subset

1. Telegram chat cockpit v1
2. Next.js Mini App shell v1
3. Core player routes: `hub`, `missions`, `forge`, `exchange`, `vault`
4. Separate admin workspace
5. TON Connect primary wallet
6. BTC payout destination flow
7. Append-only payout review and entitlement model
8. TR ve EN localization governance

### Scale-ready subset

1. District streaming
2. `season_hall`, `elite_district`, `social_monuments`, `live_event_overlay`
3. TON identity credentials default verified path
4. TON payout rail for verified primary users
5. selected EVM/SOL payout rails
6. global locale rollout lanes
7. screenshot automation
8. fraud queue routing by language coverage

### Critical open questions resolved

1. Final frontend stack: `Next.js + Babylon.js`
2. Primary wallet chain: `TON`
3. BTC role: payout destination only
4. Withdrawable balance definition: `payout_available`
5. Analytics naming: `family.object.verb`
6. Locale precedence: stored override -> Telegram -> profile -> region -> TR
7. Admin surface model: separate workspace, hidden Telegram commands only for emergency

## 2. Final Domain Glossary

1. `user_root`: canonical Telegram-centric person identity
2. `session_ref`: immutable per-session correlation id
3. `route_key`: canonical Mini App route
4. `panel_key`: sub-surface under a route
5. `district_key`: 3D world destination
6. `locale_override`: explicit user language choice
7. `content_bundle`: versioned localized content pack
8. `SC`: Soft Credits
9. `RC`: Relic Credits
10. `HC`: Hard Credits
11. `payout_available`: derived withdrawable liability
12. `NXT`: Nexus Token on TON
13. `entitlement_ledger`: append-only payout liability truth
14. `convenience_balance`: cached non-authoritative balance view
15. `primary_wallet`: single active TON wallet
16. `secondary_wallet`: linked EVM or Solana wallet
17. `wallet_challenge`: short-lived proof request
18. `action_request_id`: mutation idempotency key
19. `risk_band`: normalized fraud segment
20. `event_targeting_rule`: region, locale and cohort targeting definition
21. `experiment_assignment`: stable per-user variant mapping
22. `admin_confirm_token`: critical action confirmation token

## 3. Final User Journey

### First run

1. User enters chat and taps `/start`.
2. Bot applies locale precedence and assigns identity.
3. Chat shows one trust-safe welcome card and one main CTA.
4. CTA opens `hub` with `panel=onboarding`.
5. Hub highlights one mission path and one reward path only.

### Day 0 loop

1. `hub` -> `missions`
2. accept or resume mission
3. `missions` -> `forge`
4. reveal or inspect rewards
5. `forge` -> `exchange` or `vault` only when value is visible

### Returning loop

1. Reactivation alert arrives only on real state change.
2. Alert deep-links to exact `route_key/panel_key`.
3. Mini App restores last valid route and district bookmark.
4. User sees one next safe step, not a feature wall.

### Wallet loop

1. Value is shown before wallet connect.
2. TON Connect is recommended by default.
3. Secondary wallet linking lives under advanced settings.
4. Wallet proof state and chain role stay visible.

### Payout loop

1. User sees `payout_available` and latest payout status.
2. Request opens only through guarded payout flow.
3. Risk, reserve, duplicate and relink checks run.
4. Operator execution writes tx proof and reconciliation state.
5. Chat and Mini App mirror calm localized status copy.

### Admin loop

1. Operator enters separate admin workspace.
2. Queue, payout, runtime, localization and live-ops modules are role-scoped.
3. Critical actions require confirm token + cooldown + audit.
4. Telegram hidden admin commands are emergency-only.

## 4. Final Web3 Boundary Map

### Final wallet rules

1. TON is the only primary wallet chain.
2. EVM and Solana are optional linked wallets.
3. BTC is payout-destination only in MVP.
4. Primary switch and unlink are audited and cooldown-gated.
5. Runtime private key storage does not exist.

### Offchain vs onchain

1. Identity
   Offchain: Telegram identity, profile, locale, sessions, risk
   Onchain: TON identity credential
2. Progression
   Offchain: missions, PvP, streaks, events, loot
   Onchain: none by default
3. Economy
   Offchain: SC, RC, HC, entitlements
   Onchain: NXT only
4. Premium
   Offchain: effects, expiry, entitlement logic
   Onchain: premium ownership proof when justified
5. Events
   Offchain: targeting, windows, progression, rewards
   Onchain: event tickets or claim attestation only when partner trust requires
6. Payout
   Offchain: review, holds, reserve, batching, reconciliation
   Onchain: final settlement transaction only

### Smart contract modules

1. `nxt_jetton`: exists, transferable
2. `identity_credential`: exists, soulbound
3. `season_badge`: exists, soulbound
4. `premium_pass`: exists, semi-transfer-restricted
5. `event_ticket`: exists, semi-transfer-restricted-until-redeemed
6. `claim_attestation_registry`: exists, non-transferable
7. `reputation_anchor`: does not exist

### Final payout rules

1. No full-auto payout mode
2. BTC destination settlement is the MVP payout rail
3. TON payout rail opens only after verified-primary + reconciliation readiness
4. Every payout request is gated by recent auth, risk, reserve and duplicate checks
5. High-value first payout, shared destination, recent relink and event anomaly trigger holds
6. External operator execution is the only transfer path

## 5. Final Database/Ledger Truth Model

### Top-level bounded contexts

1. identity
2. preferences
3. telegram_surface
4. wallet_web3
5. social_kingdom
6. missions
7. live_ops
8. rewards_inventory
9. economy
10. payouts
11. referrals
12. premium
13. fraud_risk
14. content_localization
15. analytics
16. admin_live_ops

### Truth rules

1. `users` canonical person root'tur.
2. Ledger truth append-only'dir.
3. `currency_balances` ve benzeri tablolar derived snapshot'tir.
4. Payout request current state mutable olabilir ama review ve settlement facts append event olarak kalir.
5. Business-critical localized text operational rows icine literal olarak yazilmaz.

### Major table groups

1. Identity:
   `users`, `user_profiles`, `user_status_history`, `user_ui_prefs`, `notification_preferences`
2. Wallet:
   `v5_wallet_challenges`, `v5_wallet_links`, `v5_wallet_chain_primary_addresses`, `v5_wallet_sessions`, `wallet_link_audit`
3. Progression:
   `kingdom_memberships`, `progression_profiles`, `season_stats`, `mission_templates`, `task_offers`, `task_attempts`, `mission_evidence`, `mission_cooldowns`
4. Rewards:
   `reward_grants`, `inventory_items`, `loot_reveals`, `chest_definitions`, `loot_table_defs`
5. Money:
   `currency_ledger`, `currency_balances`, `ledger_holds`, `payout_requests`, `payout_review_events`, `payout_batches`, `payout_batch_items`, `payout_tx`
6. Ops:
   `event_definitions`, `event_targeting_rules`, `event_participation`, `content_keys`, `content_variants`, `content_bundle_versions`, `admin_operators`, `admin_roles`, `admin_role_bindings`, `admin_audit`
7. Analytics:
   `v5_command_events`, `v5_intent_resolution_events`, `v5_webapp_ui_events`, `v5_http_request_events`
8. Fraud:
   `risk_scores`, `risk_signal_events`, `fraud_cases`, `fraud_case_events`

### Unified state machines

1. `user_lifecycle`: `new -> active -> restricted|paused -> closed`
2. `wallet_link`: `challenge_pending -> verified -> active -> relinked_cooldown|revoked|rejected|expired`
3. `mission_assignment`: `eligible -> offered -> accepted -> in_progress -> completed -> revealed -> claimed`
4. `event_lifecycle`: `draft -> scheduled -> live -> paused -> completed|cancelled -> archived`
5. `reward_grant`: `pending -> granted -> held -> released|reversed|expired`
6. `ledger_hold`: `open -> released|consumed|voided`
7. `payout_request`: `draft -> requested -> risk_review -> approved -> batched -> submitted -> paid|failed|rejected|cancelled`
8. `payout_batch`: `open -> sealed -> submitted -> partially_settled|settled|failed`
9. `premium_purchase`: `pending -> authorized -> active -> expired|refunded|cancelled`
10. `fraud_case`: `open -> triaged -> under_review -> actioned|dismissed -> closed`
11. `content_publish`: `draft -> review -> approved -> published -> superseded|rolled_back -> archived`
12. `notification_delivery`: `queued -> sending -> sent -> delivered|failed|suppressed|expired`

### Canonical analytics schema

1. Event names: `family.object.verb`
2. Required dimensions:
   `event_id`, `event_name`, `occurred_at`, `user_id_or_uid`, `session_ref`, `surface`, `route_key`, `panel_key`, `locale`, `region_code`, `device_class`, `wallet_chain`, `campaign_key`, `event_key`, `experiment_key`, `variant_key`, `risk_band`

## 6. Final Chat UX and Command Map

### Chat principles

1. one clear action per message
2. chat is cockpit not maze
3. trust before hype
4. miniapp pull not feature dump
5. low scroll
6. exact route handoff
7. no hidden critical action

### Final command groups

1. Core:
   `/start`, `/play`, `/hub`, `/profile`, `/rewards`
2. Economy / Trust:
   `/wallet`, `/claim`, `/payout`, `/history`, `/status`
3. Progression:
   `/missions`, `/season`, `/rank`, `/streak`, `/inventory`
4. Social / Growth:
   `/invite`, `/friends`, `/kingdom`, `/leaderboard`, `/share`
5. Events / Discovery:
   `/events`, `/news`, `/chests`, `/quests`, `/discover`
6. Settings / Support:
   `/language`, `/settings`, `/help`, `/support`, `/faq`

### Unified command to route map

1. `/start` -> `hub:onboarding`
2. `/play` -> `hub`
3. `/profile` -> `hub:profile`
4. `/rewards` -> `hub:rewards`
5. `/wallet` -> `exchange:wallet`
6. `/claim` -> `missions:claim`
7. `/payout` -> `vault:payout`
8. `/history` -> `vault:history`
9. `/status` -> `hub:status`
10. `/rank` -> `season:rank`
11. `/inventory` -> `forge:inventory`
12. `/leaderboard` -> `season:leaderboard`
13. `/events` -> `events`
14. `/chests` -> `forge:chests`
15. `/language` -> `settings:language`
16. `/support` -> `settings:support`

### Hidden admin commands

1. `admin`
2. `admin_queue`
3. `admin_payouts`
4. `admin_tokens`
5. `admin_metrics`
6. `admin_live`
7. `admin_freeze`
8. `admin_gate`
9. `pay`
10. `reject_payout`
11. `approve_token`
12. `reject_token`

### Alert families

1. chest_ready
2. mission_refresh
3. event_countdown
4. kingdom_war
5. streak_risk
6. payout_update
7. rare_drop
8. comeback_offer
9. season_deadline

## 7. Final Mini App and 3D World Design

### Final stack

1. `Next.js App Router`
2. `TypeScript`
3. `Babylon.js`
4. `TanStack Query`
5. `Zod`
6. typed `scene bridge`

### Package boundaries

1. `apps/miniapp-shell`
2. `packages/ui`
3. `packages/scene`
4. `packages/contracts`
5. `packages/i18n`

### Route to district map

1. `hub` -> `central_hub`
2. `missions` -> `mission_quarter`
3. `forge` -> `loot_forge`
4. `exchange` -> `exchange_district`
5. `season` -> `season_hall`
6. `events` -> `live_event_overlay`
7. `vault` -> `exchange_district`
8. `settings` -> `central_hub`

### District set

1. `central_hub`
2. `mission_quarter`
3. `loot_forge`
4. `exchange_district`
5. `season_hall`
6. `elite_district`
7. `live_event_overlay`
8. `social_monuments`

### Interaction model

1. tap to travel
2. guided onboarding overlay
3. objective tracker
4. fast travel anchors
5. wallet and payout drawers pause/downshift scene
6. resume restores last valid route and district

### Quality profiles

1. `safe_low` target `30fps`
2. `balanced` target `45fps`
3. `immersive_high` target `60fps`

### Hard budgets

1. FMP <= `1200ms`
2. first interactive <= `2200ms`
3. app shell <= `220KB gzip`
4. scene runtime <= `650KB gzip`
5. district bundle <= `900KB gzip`
6. low-end memory <= `220MB`

### Accessibility and Telegram contract

1. reduced motion
2. large text
3. safe-low quality mode
4. 2.5D or reduced-effects fallback
5. BackButton drawer -> route -> exit behavior
6. MainButton mirrors only one next-best action
7. safe-area handling mandatory

## 8. Final Live-Ops and Localization Model

### Locale precedence

1. stored override
2. Telegram language code
3. verified profile locale
4. region default
5. TR

### Content workflow

1. draft
2. localized
3. qa_passed
4. approved
5. scheduled
6. live
7. retired

### Translation families

1. `chat.command.*`
2. `chat.card.*`
3. `miniapp.ui.*`
4. `miniapp.world_label.*`
5. `event.announcement.*`
6. `payout.status.*`
7. `support.macro.*`
8. `wallet.web3.*`
9. `premium.offer.*`

### Locale rollout stages

1. `internal_only`
2. `shadow_readiness`
3. `pilot_5pct`
4. `managed_25pct`
5. `general_100pct`

### Live-ops controls

1. daily rotations in UTC with region windows
2. seasonal campaigns with preload/end caps
3. partner campaigns with region and chain filters
4. scarcity windows with frequency caps
5. event disable flag
6. locale disable flag
7. reward route close
8. broadcast cancel before send

### Experimentation guardrails

1. no payout truth copy tests
2. no wallet safety copy tests
3. user-level randomization only for copy/presentation
4. locale QA required before release
5. high blast-radius live-ops tests require holdout

### Canonical dashboards

1. executive_global
2. product_global
3. localization_health
4. live_ops_runtime
5. payout_and_trust
6. fraud_and_review
7. web3_chain_funnel
8. scene_performance

## 9. Final Fraud/Risk Model

### Scoring inputs

1. identity and device signals
2. wallet graph signals
3. referral velocity
4. event exploitation patterns
5. support abuse patterns
6. translation abuse patterns
7. payout destination reuse

### Review queues

1. wallet_farm_review
2. referral_ring_review
3. payout_hold_review
4. support_abuse_review
5. event_exploitation_review
6. translation_abuse_review

### Hold rules

1. first high-value payout hold
2. shared destination hold
3. recent wallet relink hold
4. event anomaly hold
5. manual release or reject with reason code

### Enforcement ladder

1. shadow_score_only
2. silent_dampening
3. reward_hold
4. manual_review_gate
5. cooldown_extension
6. hard_block_for_confirmed_abuse

### False-positive controls

1. new-region shadow period
2. locale-specific baselines before hard enforcement
3. appealable manual actions
4. review sampling after threshold changes
5. support override with audit

### Emergency controls

1. pause_new_payout_approvals
2. disable_high_risk_auto_paths
3. raise_chain_risk_tier_without_deploy
4. pause_claim_publications
5. event_variant_pause

## 10. Final Build Order

### Engineering team order

1. architecture_and_shared_contracts
2. data_platform
3. web3_backend
4. ops_platform
5. bot_chat
6. frontend_platform
7. miniapp_world
8. player_economy_and_trust
9. fraud_and_analytics
10. localization_and_live_ops
11. scale_content_and_world
12. release_and_qa

### Final dependency map

1. shared_route_and_panel_contract
   depends on: shared_i18n_keys, chat_deeplink_parser, miniapp_router
2. locale_precedence_resolver
   depends on: user_ui_prefs, telegram_language_input, profile_locale, content_bundle_versions
3. wallet_proof_verifier
   depends on: wallet_challenges, signature_validation, wallet_link_tables, risk_service
4. entitlement_and_payout_model
   depends on: currency_ledger, ledger_holds, payout_requests, payout_review_events, operator_gateway
5. content_governance_system
   depends on: content_keys, content_variants, content_bundle_versions, admin_roles
6. canonical_event_pipeline
   depends on: event_contract, ui_event_ingest, command_events, rollups
7. next_shell_and_scene_bridge
   depends on: route_contract, locale_bootstrap, telegram_adapters, scene_package
8. district_asset_registry
   depends on: scene_package, bundle_manifests, perf_budgets
9. live_ops_scheduler_and_targeting
   depends on: event_definitions, event_targeting_rules, content_governance_system, notification_pipeline
10. fraud_queue_and_hold_logic
   depends on: risk_signals, wallet_graph, payout_requests, analytics_rollups, admin_workspace

### Final risk register

1. frontend_target_migration
   owner: frontend_platform
   severity: critical
2. telegram_webview_performance
   owner: miniapp_world
   severity: critical
3. wallet_verification_gap
   owner: web3_backend
   severity: critical
4. ledger_vs_reserve_drift
   owner: data_platform
   severity: critical
5. locale_fallback_breakage
   owner: localization_ops
   severity: high
6. event_targeting_errors
   owner: live_ops
   severity: high
7. fraud_false_positives
   owner: fraud_ops
   severity: high
8. analytics_contract_drift
   owner: data_platform
   severity: high
9. onchain_offchain_divergence
   owner: web3_backend
   severity: high
10. operator_overreach
   owner: ops_platform
   severity: medium

### Exact engineering handoff checklist

1. Freeze shared `route_key` and `panel_key` contract
2. Freeze one shared currency glossary
3. Implement one locale precedence resolver
4. Implement one analytics event contract
5. Move critical trust copy to governed bundles
6. Finish canonical Postgres tables before broad rollout
7. Replace format-only wallet verification
8. Keep gameplay authoritative offchain
9. Build `payout_available` from entitlement truth only
10. Route payouts through external operator execution
11. Ship chat cockpit on shared route grammar
12. Stand up Next.js shell and scene bridge before scale districts
13. Ship safe-low fallback before high-cost districts
14. Separate event scheduling, targeting and copy
15. Enforce confirm token, cooldown and audit on critical admin actions
16. Add dashboard slices for locale, region, device, chain, variant and risk
17. Start new locale fraud models in shadow mode
18. Block payout-truth and wallet-safety experiments
19. Require screenshot QA for live locales and experiment variants
20. Verify locale, event, auto-policy and payout-auto kill switches
21. Publish payout delay, wallet degradation, localization outage and event misfire runbooks
22. Do not delete transition runtime until final stack is proven stable

## 11. Final QA Checklist

### Contracts and data

1. all v2 contracts validate
2. append-only ledger mutation protection works
3. action_request_id required on all mutations
4. payout lifecycle reconstructs end to end

### Chat and navigation

1. every menu command resolves to valid route/panel
2. malformed startapp falls back to hub
3. chat does not duplicate complex Mini App forms
4. alert caps and opt-out rules work

### Mini App and world

1. hub, mission quarter, forge and exchange meet budgets
2. BackButton, safe-area and resume recovery pass inside Telegram webview
3. reduced motion, large text and safe-low mode behave consistently
4. wallet and payout drawers work while scene is paused/downshifted

### Web3 and payout

1. TON proof verification passes real signatures
2. primary wallet uniqueness and relink cooldown enforced
3. payout holds trigger correctly
4. operator settlement writes tx proof and reconciliation state

### Localization and live-ops

1. TR and EN pass screenshot and trust-copy completeness
2. critical trust copy fallback is correct
3. event scheduling respects region windows and quiet hours
4. experiment variants cannot launch without localized QA

### Fraud and analytics

1. canonical analytics families and dimensions emit on critical flows
2. locale, region, device and risk dashboards populate
3. new-region fraud shadow queues populate before hard enforcement
4. performance telemetry captures frame time, district load and context loss

## 12. Final Ship-Readiness Checklist

### Architecture

1. route grammar, currency glossary, locale precedence and analytics contract are frozen
2. no unresolved architecture contradiction remains

### Product

1. chat cockpit, Mini App core routes and admin workspace use real data only
2. one next-best action is visible from chat and hub
3. no critical trust surface has placeholder or untranslated copy

### Web3 and money

1. TON primary verification is live
2. BTC payout destination flow is reconciled
3. reserve vs liability dashboards are live
4. no runtime custody path exists

### Ops and localization

1. TR and EN are fully ready with support macros and payout templates
2. locale, event and auto-policy kill switches are verified
3. operator roles, confirm tokens, cooldowns and audit logs are live

### Quality

1. low-end safe-low profile is usable in Telegram webview
2. core flows pass QA matrix and smoke tests
3. performance, payout failure, fallback and fraud alerts are wired

### Go-live

1. rollout plan and on-call ownership are published
2. forward-fix and emergency disable procedures are rehearsed
3. leadership, trust ops, fraud ops, live-ops and engineering sign off
