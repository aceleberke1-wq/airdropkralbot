"use strict";

const DOMAIN_MODEL_NON_NEGOTIABLES = Object.freeze([
  "Postgres is the only source of truth for identity, ledger, payout, review and content state.",
  "Redis may cache, throttle, lease and dedupe, but never owns financial or identity truth.",
  "Financial truth is append-only; convenience balances are rebuildable snapshots only.",
  "Every critical mutation carries an idempotency key or deterministic ref and writes an auditable state transition.",
  "Wallet identity is unambiguous: one canonical user root, one active primary wallet per chain per user, one active primary owner per chain address.",
  "All payout decisions, reversals, disputes and tx proofs remain reconstructable from durable rows.",
  "Localization is key-based and versioned; no business-critical inline copy is stored ad hoc in operational tables.",
  "Analytics raw events must reconstruct funnels, experiments, locale, chain and device context without joining mutable convenience state."
]);

const DOMAIN_MODEL_REJECTED_ALTERNATIVES = Object.freeze([
  { key: "balances_as_truth", why: "Mutable balances cannot explain corrections, holds, reversals or retry races." },
  { key: "json_blob_everything", why: "Opaque JSON blobs destroy auditability, indexing and migration safety." },
  { key: "redis_as_primary_state", why: "Ephemeral memory cannot be the authoritative record for money, identity or review workflows." },
  { key: "wallet_identity_without_history", why: "Without link and revoke history, abuse and ownership disputes are not reconstructable." },
  { key: "inline_localized_copy_in_domain_tables", why: "Multilingual changes become schema debt and event replay becomes inconsistent." },
  { key: "implicit_state_transitions", why: "Critical flows need explicit state machines to survive retries, operators and workers." }
]);

const DOMAIN_MODEL_IMPLEMENTATION_RISKS = Object.freeze([
  { key: "legacy_name_drift", severity: "high" },
  { key: "ledger_snapshot_confusion", severity: "critical" },
  { key: "wallet_primary_ambiguity", severity: "critical" },
  { key: "raw_event_growth_without_partitioning", severity: "high" },
  { key: "missing_redis_contracts", severity: "high" },
  { key: "review_state_sprawl", severity: "high" },
  { key: "localization_version_gap", severity: "medium" }
]);

const DOMAIN_MODEL_MVP_SUBSET = Object.freeze({
  identity: Object.freeze(["users", "user_profiles", "user_ui_prefs", "user_status_history"]),
  wallet: Object.freeze(["v5_wallet_challenges", "v5_wallet_links", "v5_wallet_sessions"]),
  progression: Object.freeze(["task_offers", "task_attempts", "loot_reveals", "streaks", "season_stats"]),
  money: Object.freeze(["currency_ledger", "currency_balances", "payout_requests", "payout_tx"]),
  admin: Object.freeze(["admin_audit", "v5_unified_admin_queue_action_events"]),
  analytics: Object.freeze(["v5_command_events", "v5_intent_resolution_events", "v5_webapp_ui_events"]),
  monetization: Object.freeze(["v5_pass_products", "v5_user_passes", "v5_cosmetic_purchases", "v5_monetization_ledger"])
});

const DOMAIN_MODEL_SCALE_READY_SUBSET = Object.freeze({
  identity: Object.freeze(["telegram_deep_link_entries", "notification_preferences", "notification_delivery_attempts"]),
  wallet: Object.freeze(["v5_wallet_chain_primary_addresses", "wallet_link_audit", "risk_signal_events"]),
  progression: Object.freeze(["kingdom_memberships", "progression_profiles", "district_unlocks", "mission_templates", "mission_evidence", "mission_cooldowns"]),
  live_ops: Object.freeze(["event_definitions", "event_targeting_rules", "event_participation", "content_bundle_versions"]),
  rewards: Object.freeze(["reward_grants", "inventory_items", "chest_definitions", "loot_table_defs"]),
  money: Object.freeze(["ledger_holds", "payout_review_events", "payout_batches", "payout_batch_items", "referral_reward_states"]),
  governance: Object.freeze(["fraud_cases", "fraud_case_events", "admin_operators", "admin_roles", "admin_role_bindings"])
});

const DOMAIN_MODEL_RESOLVED_QUESTIONS = Object.freeze([
  { key: "authoritative_balance", resolution: "currency_ledger remains authoritative; currency_balances is derived only." },
  { key: "wallet_root", resolution: "users is the canonical person root; wallets are linked identities, never person roots." },
  { key: "localized_content_storage", resolution: "Operational rows store content keys, not final localized copy." },
  { key: "analytics_identity_join", resolution: "Raw events carry enough immutable dimensions to analyze without joining mutable state." },
  { key: "payout_review_granularity", resolution: "Payout request current state is mutable, but all decisions and retries append review events." },
  { key: "redis_scope", resolution: "Redis is limited to ephemeral coordination, dedupe, throttling and hot caches." }
]);

const DOMAIN_BOUNDED_CONTEXTS = Object.freeze([
  { key: "identity", entities: ["users", "user_profiles", "user_status_history"], invariants: ["telegram_id_unique", "single_user_root"] },
  { key: "preferences", entities: ["user_ui_prefs", "notification_preferences"], invariants: ["one_pref_row_per_user"] },
  { key: "telegram_surface", entities: ["telegram_deep_link_entries", "v5_command_events", "notification_delivery_attempts"], invariants: ["delivery_attempts_append_only"] },
  { key: "wallet_web3", entities: ["v5_wallet_challenges", "v5_wallet_links", "v5_wallet_chain_primary_addresses", "v5_wallet_sessions", "wallet_link_audit"], invariants: ["one_primary_per_user_chain", "one_active_owner_per_chain_address"] },
  { key: "social_kingdom", entities: ["kingdom_memberships", "progression_profiles", "season_stats"], invariants: ["one_active_kingdom_membership"] },
  { key: "missions", entities: ["mission_templates", "task_offers", "task_attempts", "mission_evidence", "mission_cooldowns"], invariants: ["assignment_idempotent_per_window"] },
  { key: "live_ops", entities: ["event_definitions", "event_targeting_rules", "event_participation"], invariants: ["one_event_lifecycle_state"] },
  { key: "rewards_inventory", entities: ["reward_grants", "inventory_items", "chest_definitions", "loot_table_defs", "loot_reveals"], invariants: ["reward_grant_ref_unique"] },
  { key: "economy", entities: ["currency_definitions", "currency_ledger", "currency_balances", "ledger_holds"], invariants: ["ledger_append_only", "balances_rebuildable"] },
  { key: "payouts", entities: ["payout_requests", "payout_review_events", "payout_batches", "payout_batch_items", "payout_tx"], invariants: ["one_active_payout_request_per_policy_window", "tx_proof_recorded"] },
  { key: "referrals", entities: ["referral_links", "referral_edges", "referral_reward_states"], invariants: ["one_referrer_per_user_per_campaign"] },
  { key: "premium", entities: ["v5_pass_products", "v5_user_passes", "v5_cosmetic_purchases", "v5_monetization_ledger"], invariants: ["purchase_ref_unique"] },
  { key: "fraud_risk", entities: ["risk_scores", "risk_signal_events", "fraud_cases", "fraud_case_events"], invariants: ["risk_event_append_only", "case_state_explicit"] },
  { key: "content_localization", entities: ["content_keys", "content_variants", "content_bundle_versions"], invariants: ["one_published_variant_per_key_locale_channel"] },
  { key: "analytics", entities: ["v5_intent_resolution_events", "v5_webapp_ui_events", "v5_http_request_events"], invariants: ["dedupe_key_optional_but_unique_when_present"] },
  { key: "admin_live_ops", entities: ["admin_operators", "admin_roles", "admin_role_bindings", "admin_audit", "v5_unified_admin_queue_action_events"], invariants: ["critical_actions_audited"] }
]);

const CANONICAL_SCHEMA_STRATEGY = Object.freeze({
  naming: Object.freeze(["bounded_context_prefix_for_new_tables", "BIGSERIAL_or_UUID_pk_only", "TEXT_state_columns_plus_check_constraints", "JSONB_only_for_evidence_or_extensible_payloads"]),
  append_only_tables: Object.freeze(["currency_ledger", "reward_grants", "payout_review_events", "v5_monetization_ledger", "fraud_case_events", "admin_audit", "v5_command_events", "v5_intent_resolution_events", "v5_webapp_ui_events", "notification_delivery_attempts"]),
  snapshot_tables: Object.freeze(["currency_balances", "risk_scores", "progression_profiles", "season_stats", "user_ui_prefs"]),
  partitioned_tables: Object.freeze(["v5_webapp_ui_events", "v5_command_events", "v5_intent_resolution_events", "notification_delivery_attempts", "v5_http_request_events"]),
  archive_first_tables: Object.freeze(["v5_wallet_challenges", "render_quality_snapshots", "device_perf_profiles", "notification_delivery_attempts"]),
  migration_rules: Object.freeze(["additive_first", "no_drop_same_release_as_backfill", "dual_write_before_read_switch", "concurrent_indexes_for_large_tables", "never_rewrite_ledger_rows_use_compensations"])
});

const CANONICAL_TABLE_REGISTRY = Object.freeze([
  { table: "users", domain: "identity", type: "mutable_root" },
  { table: "user_profiles", domain: "identity", type: "mutable_snapshot" },
  { table: "user_status_history", domain: "identity", type: "append_only" },
  { table: "user_ui_prefs", domain: "preferences", type: "mutable_snapshot" },
  { table: "notification_preferences", domain: "preferences", type: "mutable_snapshot" },
  { table: "telegram_deep_link_entries", domain: "telegram_surface", type: "append_only" },
  { table: "notification_delivery_attempts", domain: "telegram_surface", type: "append_only" },
  { table: "v5_wallet_challenges", domain: "wallet_web3", type: "append_only" },
  { table: "v5_wallet_links", domain: "wallet_web3", type: "mutable_relation" },
  { table: "v5_wallet_chain_primary_addresses", domain: "wallet_web3", type: "mutable_relation" },
  { table: "v5_wallet_sessions", domain: "wallet_web3", type: "append_only" },
  { table: "wallet_link_audit", domain: "wallet_web3", type: "append_only" },
  { table: "kingdom_memberships", domain: "social_kingdom", type: "mutable_relation" },
  { table: "progression_profiles", domain: "social_kingdom", type: "mutable_snapshot" },
  { table: "streaks", domain: "social_kingdom", type: "mutable_snapshot" },
  { table: "season_stats", domain: "social_kingdom", type: "mutable_snapshot" },
  { table: "district_unlocks", domain: "social_kingdom", type: "append_only" },
  { table: "mission_templates", domain: "missions", type: "reference_data" },
  { table: "task_offers", domain: "missions", type: "mutable_assignment" },
  { table: "task_attempts", domain: "missions", type: "mutable_assignment" },
  { table: "mission_evidence", domain: "missions", type: "append_only" },
  { table: "mission_cooldowns", domain: "missions", type: "mutable_snapshot" },
  { table: "event_definitions", domain: "live_ops", type: "reference_data" },
  { table: "event_targeting_rules", domain: "live_ops", type: "reference_data" },
  { table: "event_participation", domain: "live_ops", type: "mutable_relation" },
  { table: "chest_definitions", domain: "rewards_inventory", type: "reference_data" },
  { table: "loot_table_defs", domain: "rewards_inventory", type: "reference_data" },
  { table: "loot_reveals", domain: "rewards_inventory", type: "append_only" },
  { table: "reward_grants", domain: "rewards_inventory", type: "append_only" },
  { table: "inventory_items", domain: "rewards_inventory", type: "mutable_snapshot" },
  { table: "currency_definitions", domain: "economy", type: "reference_data" },
  { table: "currency_ledger", domain: "economy", type: "append_only" },
  { table: "currency_balances", domain: "economy", type: "derived_snapshot" },
  { table: "ledger_holds", domain: "economy", type: "append_only" },
  { table: "payout_requests", domain: "payouts", type: "mutable_workflow" },
  { table: "payout_review_events", domain: "payouts", type: "append_only" },
  { table: "payout_batches", domain: "payouts", type: "mutable_workflow" },
  { table: "payout_batch_items", domain: "payouts", type: "append_only" },
  { table: "payout_tx", domain: "payouts", type: "append_only" },
  { table: "referral_links", domain: "referrals", type: "reference_data" },
  { table: "referral_edges", domain: "referrals", type: "append_only" },
  { table: "referral_reward_states", domain: "referrals", type: "mutable_workflow" },
  { table: "v5_pass_products", domain: "premium", type: "reference_data" },
  { table: "v5_user_passes", domain: "premium", type: "mutable_workflow" },
  { table: "v5_cosmetic_purchases", domain: "premium", type: "append_only" },
  { table: "v5_monetization_ledger", domain: "premium", type: "append_only" },
  { table: "risk_scores", domain: "fraud_risk", type: "mutable_snapshot" },
  { table: "risk_signal_events", domain: "fraud_risk", type: "append_only" },
  { table: "fraud_cases", domain: "fraud_risk", type: "mutable_workflow" },
  { table: "fraud_case_events", domain: "fraud_risk", type: "append_only" },
  { table: "content_keys", domain: "content_localization", type: "reference_data" },
  { table: "content_variants", domain: "content_localization", type: "reference_data" },
  { table: "content_bundle_versions", domain: "content_localization", type: "mutable_workflow" },
  { table: "v5_command_events", domain: "analytics", type: "append_only" },
  { table: "v5_intent_resolution_events", domain: "analytics", type: "append_only" },
  { table: "v5_webapp_ui_events", domain: "analytics", type: "append_only" },
  { table: "v5_http_request_events", domain: "analytics", type: "append_only" },
  { table: "admin_operators", domain: "admin_live_ops", type: "mutable_root" },
  { table: "admin_roles", domain: "admin_live_ops", type: "reference_data" },
  { table: "admin_role_bindings", domain: "admin_live_ops", type: "mutable_relation" },
  { table: "admin_audit", domain: "admin_live_ops", type: "append_only" },
  { table: "v5_unified_admin_queue_action_events", domain: "admin_live_ops", type: "append_only" }
]);

const STATE_MACHINE_CATALOG = Object.freeze([
  { key: "user_lifecycle", states: ["new", "active", "restricted", "paused", "closed"], terminal: ["closed"] },
  { key: "wallet_link", states: ["challenge_pending", "verified", "active", "relinked_cooldown", "revoked", "rejected", "expired"], terminal: ["revoked", "rejected", "expired"] },
  { key: "mission_assignment", states: ["eligible", "offered", "accepted", "in_progress", "completed", "revealed", "claimed", "expired", "rejected"], terminal: ["claimed", "expired", "rejected"] },
  { key: "event_lifecycle", states: ["draft", "scheduled", "live", "paused", "completed", "cancelled", "archived"], terminal: ["archived"] },
  { key: "reward_grant", states: ["pending", "granted", "held", "released", "reversed", "expired"], terminal: ["released", "reversed", "expired"] },
  { key: "ledger_hold", states: ["open", "released", "consumed", "voided"], terminal: ["released", "consumed", "voided"] },
  { key: "payout_request", states: ["draft", "requested", "risk_review", "approved", "batched", "submitted", "paid", "failed", "rejected", "cancelled"], terminal: ["paid", "failed", "rejected", "cancelled"] },
  { key: "payout_batch", states: ["open", "sealed", "submitted", "partially_settled", "settled", "failed"], terminal: ["settled", "failed"] },
  { key: "premium_purchase", states: ["pending", "authorized", "active", "expired", "refunded", "cancelled"], terminal: ["expired", "refunded", "cancelled"] },
  { key: "fraud_case", states: ["open", "triaged", "under_review", "actioned", "dismissed", "closed"], terminal: ["closed"] },
  { key: "content_publish", states: ["draft", "review", "approved", "published", "superseded", "rolled_back", "archived"], terminal: ["archived"] },
  { key: "notification_delivery", states: ["queued", "sending", "sent", "delivered", "failed", "suppressed", "expired"], terminal: ["delivered", "failed", "suppressed", "expired"] }
]);

const ANALYTICS_TAXONOMY = Object.freeze({
  event_name_convention: "family.object.verb",
  required_dimensions: Object.freeze(["event_id", "event_name", "occurred_at", "user_id_or_uid", "session_ref", "surface", "locale", "region_code", "app_version"]),
  families: Object.freeze(["onboarding", "locale", "command", "miniapp", "zone", "mission", "loot", "inventory", "event", "season", "wallet", "web3", "premium", "referral", "payout", "fraud", "support", "performance", "crash", "reactivation"])
});

const API_BOUNDARIES = Object.freeze([
  { boundary: "bot_to_backend", auth: "internal_service_or_shared_runtime", idempotency: "command_ref_or_ref_event_id", errors: ["invalid_command", "user_not_started", "rate_limited"] },
  { boundary: "miniapp_to_backend", auth: "telegram_init_or_signed_uid_ts_sig_then_session", idempotency: "action_request_id_required_for_mutations", errors: ["bad_sig", "expired", "missing_fields", "invalid_action_request_id", "idempotency_conflict"] },
  { boundary: "admin_to_backend", auth: "signed_webapp_auth_plus_admin_role_plus_confirm_token_for_critical", idempotency: "action_request_id_and_queue_idempotency_key", errors: ["admin_forbidden", "admin_confirmation_expired", "cooldown_active"] },
  { boundary: "workers_to_backend", auth: "job_signature_or_internal_db_lease", idempotency: "job_ref_unique", errors: ["job_conflict", "lease_lost"] },
  { boundary: "web3_verifier_to_backend", auth: "server_side_only", idempotency: "challenge_ref_unique_and_proof_hash", errors: ["wallet_challenge_not_found", "wallet_challenge_expired", "wallet_signature_invalid"] },
  { boundary: "payout_ops_to_backend", auth: "operator_service_token_plus_ip_or_mtls_allowlist", idempotency: "batch_ref_and_provider_tx_ref", errors: ["batch_not_open", "tx_hash_required", "duplicate_settlement"] }
]);

const REDIS_STRATEGY = Object.freeze([
  { area: "rate_limit", key: "rl:bot:uid:{telegram_id}:cmd:{command_key}:{bucket}", ttl_sec: 120, truth: "postgres_audit_only", fallback: "process_local_throttle" },
  { area: "webapp_rate_limit", key: "rl:webapp:uid:{uid}:route:{route_key}:{bucket}", ttl_sec: 120, truth: "postgres_auth_and_logs", fallback: "edge_reject_and_pg_audit" },
  { area: "idempotency_shadow", key: "idem:webapp:{surface}:{action_request_id}", ttl_sec: 86400, truth: "postgres_unique_constraint", fallback: "postgres_only" },
  { area: "distributed_lock", key: "lock:payout:req:{request_id}", ttl_sec: 30, truth: "postgres_tx_and_status_row", fallback: "pg_advisory_lock" },
  { area: "hot_leaderboard", key: "lb:season:{season_id}:scope:{scope}:top:{limit}", ttl_sec: 15, truth: "season_stats_rollups", fallback: "direct_postgres_query" },
  { area: "session_state", key: "sess:webapp:{uid}:{session_ref}", ttl_sec: 3600, truth: "signed_session_and_db_user_state", fallback: "recreate_from_signed_auth" },
  { area: "notification_dedupe", key: "notify:{channel}:{user_id}:{template}:{dedupe_ref}", ttl_sec: 259200, truth: "notification_delivery_attempts", fallback: "send_with_db_unique_guard" },
  { area: "cooldown_enforcement", key: "cooldown:mission:{user_id}:{mission_key}", ttl_sec: 86400, truth: "mission_cooldowns", fallback: "db_check_only" },
  { area: "fraud_throttle", key: "fraud:wallet:{chain}:{address}:attempts", ttl_sec: 7200, truth: "risk_signal_events", fallback: "slower_db_counter_check" },
  { area: "queue_coordination", key: "queue:{job_type}:lease:{job_id}", ttl_sec: 90, truth: "job_table_or_batch_state", fallback: "db_polling_with_advisory_lock" },
  { area: "district_cache", key: "world:district:{district_key}:snapshot", ttl_sec: 10, truth: "event_and_progression_read_models", fallback: "direct_postgres_rebuild" }
]);

const DATA_LIFECYCLE_POLICY = Object.freeze([
  { dataset: "currency_ledger_and_reward_grants", retention: "permanent", archive: "cold_storage_copy_after_24_months" },
  { dataset: "payout_requests_review_events_tx", retention: "7_years_minimum", archive: "quarterly_worm_archive" },
  { dataset: "admin_audit_and_fraud_cases", retention: "7_years_minimum", archive: "quarterly_worm_archive" },
  { dataset: "v5_webapp_ui_events_raw", retention: "180_days_hot", archive: "daily_rollup_plus_cold_export" },
  { dataset: "command_and_intent_events", retention: "180_days_hot", archive: "daily_rollup_plus_cold_export" },
  { dataset: "wallet_challenges", retention: "30_days_hot", archive: "180_day_cold_export" },
  { dataset: "wallet_sessions", retention: "90_days_hot", archive: "12_month_cold_export" },
  { dataset: "notification_delivery_attempts", retention: "180_days_hot", archive: "12_month_cold_export" },
  { dataset: "device_profiles_and_render_snapshots", retention: "90_days_hot", archive: "drop_after_365_days" },
  { dataset: "content_versions", retention: "keep_all_published_plus_last_5_drafts", archive: "never_delete_published_referenced_versions" }
]);

const ENGINEERING_HANDOFF_CHECKLIST = Object.freeze([
  "Introduce canonical mutable-vs-append-only classification for every existing table before adding new flows.",
  "Create user_profiles and user_status_history; backfill from identities and users without rewriting ids.",
  "Keep users as the canonical person root keyed by telegram_id.",
  "Preserve currency_ledger as authoritative truth; mark currency_balances as derived and rebuildable.",
  "Add ledger_holds and payout_review_events before expanding automated payout paths.",
  "Add wallet_link_audit and enforce one active primary owner per chain address.",
  "Normalize notification preferences and delivery attempts into durable tables before adding more alert types.",
  "Version localization content through content_keys, content_variants and content_bundle_versions.",
  "Store event definitions and targeting rules separately from localized copy.",
  "Create mission_evidence and mission_cooldowns to isolate validation proof from assignment state.",
  "Partition raw analytics tables by month before traffic growth forces emergency migration.",
  "Standardize external error schema while preserving legacy success:false/error string compatibility.",
  "Require action_request_id on all player and admin mutations.",
  "Mirror Redis idempotency with Postgres unique constraints; Redis alone is never enough.",
  "Use compensating ledger entries for corrections, reversals and invalid rewards; never update historical deltas in place.",
  "Split payout batch workflow from payout request workflow and reconcile both with tx proof rows.",
  "Create fraud_cases and fraud_case_events so risk actions stop living only in snapshots.",
  "Backfill legacy inline titles into content key/value version tables before widening locales.",
  "Add admin_operators, admin_roles and admin_role_bindings if operator auth remains inside product data.",
  "Document monthly archive, replay and data-repair procedures before enabling broader experiments."
]);

function getBoundedContext(key) {
  return DOMAIN_BOUNDED_CONTEXTS.find((item) => item.key === String(key || "").trim().toLowerCase()) || null;
}

function getStateMachine(key) {
  return STATE_MACHINE_CATALOG.find((item) => item.key === String(key || "").trim().toLowerCase()) || null;
}

function getTableSpec(table) {
  return CANONICAL_TABLE_REGISTRY.find((item) => item.table === String(table || "").trim()) || null;
}

module.exports = {
  DOMAIN_MODEL_NON_NEGOTIABLES,
  DOMAIN_MODEL_REJECTED_ALTERNATIVES,
  DOMAIN_MODEL_IMPLEMENTATION_RISKS,
  DOMAIN_MODEL_MVP_SUBSET,
  DOMAIN_MODEL_SCALE_READY_SUBSET,
  DOMAIN_MODEL_RESOLVED_QUESTIONS,
  DOMAIN_BOUNDED_CONTEXTS,
  CANONICAL_SCHEMA_STRATEGY,
  CANONICAL_TABLE_REGISTRY,
  STATE_MACHINE_CATALOG,
  ANALYTICS_TAXONOMY,
  API_BOUNDARIES,
  REDIS_STRATEGY,
  DATA_LIFECYCLE_POLICY,
  ENGINEERING_HANDOFF_CHECKLIST,
  getBoundedContext,
  getStateMachine,
  getTableSpec
};
