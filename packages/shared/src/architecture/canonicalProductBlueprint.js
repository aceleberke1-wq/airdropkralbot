"use strict";

const CANONICAL_PRODUCT_NON_NEGOTIABLES = Object.freeze([
  {
    key: "chat_is_cockpit_miniapp_is_world",
    decision: "Telegram chat is the cockpit, trust surface and reactivation channel; the Mini App is the primary gameplay and economy surface.",
    why: "Complex progression stays immersive and discoverable, while fast actions remain low-friction in chat."
  },
  {
    key: "single_frontend_target_architecture",
    decision: "The canonical frontend architecture is Next.js App Router plus TypeScript plus Babylon.js plus TanStack Query plus Zod.",
    why: "The current Vite plus React plus Three stack is a migration baseline only, not the end state."
  },
  {
    key: "ton_first_identity",
    decision: "TON is the only primary identity chain; EVM and Solana are optional secondary links; Bitcoin is a payout destination rail in MVP, not a primary session wallet.",
    why: "Telegram-native wallet trust requires one root chain and one simple default."
  },
  {
    key: "no_runtime_custody",
    decision: "User keys and treasury keys never live in app runtime; final transfers execute through segregated external operator flows.",
    why: "Runtime custody collapses both security and trust."
  },
  {
    key: "postgres_ledger_truth",
    decision: "PostgreSQL is the only source of truth for identity, ledger, payout, content, experiment and review state; Redis stays ephemeral.",
    why: "Financial, trust and localization truth must survive retries, failures and audits."
  },
  {
    key: "append_only_financial_truth",
    decision: "Authoritative financial truth is append-only; balances, rollups and caches are derived views only.",
    why: "Corrections, holds, reversals and payout liability must remain reconstructable."
  },
  {
    key: "economy_is_hybrid_not_speculation_first",
    decision: "SC, RC and HC stay offchain gameplay currencies; NXT is the TON utility and settlement token, not the main gameplay faucet.",
    why: "Gameplay must not be hijacked by liquid extraction behavior."
  },
  {
    key: "single_navigation_language",
    decision: "Chat commands, startapp links and Mini App routing share one canonical grammar: route_key plus optional panel_key plus optional focus_key.",
    why: "Users should never land in a dead-end or semantically different surface."
  },
  {
    key: "single_locale_precedence",
    decision: "Locale precedence is stored override, then Telegram language code, then verified profile locale, then region default, then TR.",
    why: "Explicit user preference and predictable fallback behavior matter more than raw detection."
  },
  {
    key: "critical_copy_is_not_experimented",
    decision: "Payout truth, wallet safety, fraud review and support blocker copy are strict, fully localized and not experiment targets.",
    why: "Trust semantics cannot vary by cohort."
  },
  {
    key: "canonical_event_naming",
    decision: "Analytics event names use the canonical family.object.verb convention across chat, Mini App, admin and worker flows.",
    why: "Funnel reconstruction and ops visibility fail when naming drifts by surface."
  },
  {
    key: "separate_admin_workspace",
    decision: "Player UI and admin operations stay separated: players use chat and Mini App surfaces, operators use a dedicated React admin workspace plus hidden Telegram emergency commands.",
    why: "Operational safety and player clarity have different constraints."
  }
]);

const CANONICAL_PRODUCT_REJECTED_ALTERNATIVES = Object.freeze([
  {
    key: "v2_debug_shell_as_final_product",
    why: "The current Vite plus React plus Three shell is useful for migration, but it is not the final product architecture."
  },
  {
    key: "chain_neutral_identity",
    why: "Multiple equal primary wallet chains would fragment product trust, support policy and UX."
  },
  {
    key: "fully_onchain_gameplay",
    why: "Micro-event writes are too slow, too expensive and too abuse-prone for core loops."
  },
  {
    key: "chat_as_main_gameplay_surface",
    why: "Chat must remain compact; deep progression and wallet flows belong in the Mini App."
  },
  {
    key: "single_global_copy_and_event_schedule",
    why: "Locale-blind copy and region-blind schedules fail globally and increase support load."
  },
  {
    key: "redis_as_financial_truth",
    why: "Ephemeral memory cannot own money, payout or content governance truth."
  },
  {
    key: "direct_hot_wallet_payouts_from_main_app",
    why: "Treasury execution must be segregated from the main runtime and protected by operator policy."
  },
  {
    key: "one_quality_mode_for_all_devices",
    why: "Telegram mobile webviews vary too much in memory and GPU capacity for a fixed render profile."
  },
  {
    key: "ad_hoc_operator_copy_edits",
    why: "Literal text edits without bundles, approvals and audits create contradictions across surfaces."
  }
]);

const CANONICAL_PRODUCT_IMPLEMENTATION_RISKS = Object.freeze([
  { key: "frontend_migration_execution", severity: "critical", owner: "frontend_platform" },
  { key: "telegram_webview_memory_ceiling", severity: "critical", owner: "frontend_platform" },
  { key: "wallet_proof_verification_gap", severity: "critical", owner: "web3_backend" },
  { key: "ledger_reserve_drift", severity: "critical", owner: "data_platform" },
  { key: "locale_fallback_drift", severity: "high", owner: "localization_ops" },
  { key: "event_targeting_misfire", severity: "high", owner: "live_ops" },
  { key: "false_positive_spike_in_new_regions", severity: "high", owner: "fraud_ops" },
  { key: "scene_shell_sync_drift", severity: "high", owner: "frontend_platform" },
  { key: "analytics_dimension_inconsistency", severity: "high", owner: "data_platform" },
  { key: "admin_role_overreach", severity: "medium", owner: "ops_platform" },
  { key: "onchain_offchain_state_divergence", severity: "high", owner: "web3_backend" },
  { key: "content_bundle_staleness", severity: "medium", owner: "content_ops" }
]);

const CANONICAL_PRODUCT_MVP_SUBSET = Object.freeze({
  surfaces: Object.freeze([
    "telegram_chat_cockpit_v1",
    "miniapp_next_shell_v1",
    "core_player_hub_missions_forge_exchange_vault_routes",
    "separate_admin_workspace_for_queue_payout_and_runtime"
  ]),
  web3: Object.freeze([
    "ton_connect_primary_wallet",
    "evm_and_sol_secondary_linking_hidden_under_advanced",
    "btc_payout_destination_only",
    "ton_identity_credential_pilot",
    "no_gameplay_micro_event_minting"
  ]),
  economy: Object.freeze([
    "sc_soft_credits_offchain",
    "rc_relic_credits_offchain",
    "hc_hard_credits_offchain",
    "entitlement_ledger_for_payout_available",
    "nxt_utility_token_no_gameplay_faucet"
  ]),
  data_and_ops: Object.freeze([
    "append_only_ledger_and_payout_review_events",
    "locale_bundle_governance_for_tr_and_en",
    "daily_missions_and_seasonal_events",
    "locale_device_segment_kpi_dashboards",
    "fraud_shadow_mode_for_new_regions"
  ])
});

const CANONICAL_PRODUCT_SCALE_READY_SUBSET = Object.freeze({
  surfaces: Object.freeze([
    "district_streaming_season_hall_elite_district_social_monuments",
    "full_live_event_overlays",
    "npc_and_microgame_layers",
    "world_label_locale_bundles_and_rtl_ready_primitives"
  ]),
  web3: Object.freeze([
    "ton_identity_credentials_default_for_verified_users",
    "season_badges_and_premium_pass_ownership_on_ton",
    "claim_attestation_registry_when_partner_demand_exists",
    "ton_payout_rail_for_verified_primary_wallets",
    "selected_evm_sol_payout_rails_by_policy"
  ]),
  economy: Object.freeze([
    "dynamic_auto_policy_by_segment_and_chain",
    "reserve_vs_liability_dashboards",
    "partner_chain_routing",
    "content_fatigue_and_reactivation_optimization"
  ]),
  data_and_ops: Object.freeze([
    "global_locale_rollout_lanes",
    "fraud_queue_routing_by_language_coverage",
    "full_cross_surface_funnel_stitching",
    "automated_screenshot_qa_and_alerting"
  ])
});

const CANONICAL_PRODUCT_RESOLVED_QUESTIONS = Object.freeze([
  {
    key: "final_frontend_stack",
    resolution: "Next.js App Router plus Babylon.js is the final target; Vite plus Three remains transitional only."
  },
  {
    key: "primary_wallet_chain",
    resolution: "TON is the only primary wallet chain."
  },
  {
    key: "btc_role",
    resolution: "BTC is a payout destination rail in MVP, not a connected primary session wallet."
  },
  {
    key: "withdrawable_balance_definition",
    resolution: "Withdrawable value is payout_available derived from the entitlement ledger, not raw SC, RC or HC convenience balances."
  },
  {
    key: "command_to_route_mapping",
    resolution: "All chat commands map to the same route_key and optional panel_key grammar used by the Mini App."
  },
  {
    key: "analytics_contract",
    resolution: "family.object.verb naming plus a shared immutable dimension contract is mandatory across all surfaces."
  },
  {
    key: "locale_fallback_policy",
    resolution: "Critical trust copy must use same-locale or controlled regional fallback before global default."
  },
  {
    key: "admin_surface_model",
    resolution: "Admin work happens in a dedicated React workspace with hidden Telegram emergency commands only for exceptional cases."
  }
]);

const FINAL_CANONICAL_ARCHITECTURE = Object.freeze({
  product_identity: "Telegram-native Web3 arena with a chat cockpit, a 3D Mini App world and a separate operator workspace.",
  stack: Object.freeze({
    frontend: "Next.js App Router plus TypeScript plus Babylon.js plus TanStack Query plus Zod",
    backend: "Node.js plus Fastify plus additive v2 APIs plus worker queue infrastructure",
    data: "PostgreSQL source of truth plus Redis for locks, dedupe, throttles and hot caches",
    web3: "TON Connect primary wallet verification plus optional EVM and Solana linking plus Bitcoin payout destination support",
    content: "versioned localization bundles and content bundles served across chat, Mini App and admin",
    analytics: "canonical event contract with rollups and dashboard slices by locale, device, segment and variant"
  }),
  primary_surfaces: Object.freeze([
    "Telegram chat cockpit",
    "Telegram Mini App world",
    "separate React admin workspace",
    "worker and payout operator control plane"
  ]),
  canonical_navigation: Object.freeze({
    grammar: "route_key plus optional panel_key plus optional focus_key",
    primary_routes: Object.freeze(["hub", "missions", "forge", "exchange", "season", "events", "vault", "settings"]),
    primary_panels: Object.freeze([
      "onboarding",
      "profile",
      "rewards",
      "claim",
      "wallet",
      "payout",
      "leaderboard",
      "kingdom",
      "inventory",
      "support",
      "premium",
      "status"
    ]),
    handoff_rule: "Chat never invents alternate destinations; every button opens a valid Mini App route or panel using the same grammar."
  }),
  currencies: Object.freeze({
    SC: Object.freeze({ name: "Soft Credits", role: "primary offchain activity currency", withdrawable: false }),
    RC: Object.freeze({ name: "Relic Credits", role: "offchain scarcity, crafting and event currency", withdrawable: false }),
    HC: Object.freeze({ name: "Hard Credits", role: "offchain high-value currency and entitlement feeder", withdrawable: false }),
    payout_available: Object.freeze({
      name: "Payout Available",
      role: "derived withdrawable liability after holds, pending payout and settlement state",
      withdrawable: true
    }),
    NXT: Object.freeze({ name: "Nexus Token", role: "TON utility and settlement token", withdrawable: true, chain: "TON" })
  }),
  analytics_contract: Object.freeze({
    event_name_convention: "family.object.verb",
    required_dimensions: Object.freeze([
      "event_id",
      "event_name",
      "occurred_at",
      "user_id_or_uid",
      "session_ref",
      "surface",
      "route_key",
      "panel_key",
      "locale",
      "region_code",
      "device_class",
      "wallet_chain",
      "experiment_key",
      "variant_key",
      "risk_band",
      "app_version"
    ]),
    families: Object.freeze([
      "onboarding",
      "locale",
      "command",
      "miniapp",
      "zone",
      "mission",
      "loot",
      "inventory",
      "event",
      "season",
      "wallet",
      "web3",
      "premium",
      "referral",
      "payout",
      "fraud",
      "support",
      "performance",
      "crash",
      "reactivation",
      "admin"
    ])
  }),
  admin_control_model: Object.freeze({
    workspace: "separate React admin workspace with queue, treasury, runtime, localization and live-ops modules",
    roles: Object.freeze([
      "viewer",
      "content_editor",
      "localization_reviewer",
      "live_ops_scheduler",
      "treasury_operator",
      "trust_approver",
      "fraud_operator",
      "global_ops_admin"
    ]),
    safeguards: Object.freeze([
      "critical_confirm_token",
      "cooldown_enforcement",
      "two_person_rule_for_high_blast_radius_changes",
      "full_audit_log",
      "kill_switch_without_deploy"
    ])
  }),
  api_boundaries: Object.freeze([
    "bot_to_backend",
    "miniapp_to_backend",
    "admin_to_backend",
    "worker_to_backend",
    "web3_verifier_to_backend",
    "payout_ops_to_backend"
  ])
});

const FINAL_DOMAIN_GLOSSARY = Object.freeze([
  { term: "user_root", definition: "The canonical product identity anchored on Telegram user identity and stored in users." },
  { term: "session_ref", definition: "The immutable per-session correlation id shared across chat, Mini App and analytics." },
  { term: "route_key", definition: "The canonical Mini App route such as hub, missions or vault." },
  { term: "panel_key", definition: "The secondary surface inside a route, such as wallet, payout or support." },
  { term: "district_key", definition: "The scene-level 3D world destination mapped to a route or live overlay." },
  { term: "locale_override", definition: "The explicit user language choice stored independently from detected Telegram language." },
  { term: "content_bundle", definition: "A versioned set of localized copy and world labels for one or more surfaces." },
  { term: "SC", definition: "Soft Credits, the primary offchain activity and progression currency." },
  { term: "RC", definition: "Relic Credits, the offchain scarcity, crafting and event currency." },
  { term: "HC", definition: "Hard Credits, the offchain high-value currency used for premium, gated rewards and entitlement feeds." },
  { term: "payout_available", definition: "The derived withdrawable liability computed from append-only entitlement entries minus holds, pending payouts and settled debits." },
  { term: "NXT", definition: "Nexus Token, the TON utility and settlement token, not the main gameplay emission asset." },
  { term: "entitlement_ledger", definition: "The append-only liability ledger that determines payout availability and reserve exposure." },
  { term: "convenience_balance", definition: "A cached or derived balance view shown to users for speed, never the financial truth source." },
  { term: "primary_wallet", definition: "The single active TON wallet bound as the user's root Web3 identity." },
  { term: "secondary_wallet", definition: "An optional linked EVM or Solana wallet used for partner campaigns or optional future payout rails." },
  { term: "wallet_challenge", definition: "A short-lived, scoped proof request used to verify wallet control server-side." },
  { term: "action_request_id", definition: "The mandatory idempotency key for all player and admin mutations." },
  { term: "risk_band", definition: "The normalized fraud or abuse segment used for routing, throttling and review policy." },
  { term: "event_targeting_rule", definition: "The runtime targeting rule that decides which locale, region, segment or cohort receives an event." },
  { term: "experiment_assignment", definition: "The stable per-user variant mapping for copy, timing or presentation experiments." },
  { term: "admin_confirm_token", definition: "A time-limited confirmation token required for critical operator actions." }
]);

const FINAL_USER_JOURNEY = Object.freeze({
  first_run: Object.freeze([
    "User lands in Telegram chat and sends or taps start.",
    "Bot detects locale, applies stored override if present, assigns identity and shows one premium trust-safe welcome card.",
    "Primary CTA opens Mini App route hub with panel onboarding.",
    "Hub scene highlights one mission path and one reward path only.",
    "If user avoids the Mini App, chat still provides profile, rewards, payout status and support entry points."
  ]),
  first_day_loop: Object.freeze([
    "User moves from hub to missions, accepts or resumes a mission, returns to forge for reveals, then checks exchange or vault only when value is visible.",
    "Chat sends only state-change alerts such as chest ready, payout update or event countdown.",
    "The next-best action is always available in one tap from chat or the Mini App dock."
  ]),
  returning_loop: Object.freeze([
    "Reactivation alert deep-links into the exact route and panel that explain why the return matters now.",
    "Mini App resumes last valid route, panel and district bookmark.",
    "Streak and event countdown messages explain one next safe step, not the whole product."
  ]),
  wallet_journey: Object.freeze([
    "User sees value before connect wallet.",
    "TON Connect is the default recommendation and uses server-side proof verification.",
    "EVM and Solana linking live under advanced settings only.",
    "Wallet status, proof status and chain role are visible in chat and Mini App trust surfaces."
  ]),
  payout_journey: Object.freeze([
    "User sees payout_available and latest payout status before starting a request.",
    "Payout request creates a mutable workflow row plus append-only review events.",
    "Risk, reserve, duplicate destination and relink checks gate every request.",
    "External operator execution records tx proof and reconciliation status.",
    "Chat and Mini App show calm, localized status copy through the whole lifecycle."
  ]),
  admin_journey: Object.freeze([
    "Operators authenticate into the separate admin workspace.",
    "Queue review, payout review, localization rollout, live-ops scheduling and runtime flags use role-based modules.",
    "Critical actions require confirm token, cooldown and audit trail.",
    "Hidden Telegram admin commands exist only for emergency quick actions and are never the primary admin UI."
  ])
});

const FINAL_WEB3_BOUNDARY_MAP = Object.freeze({
  wallet_rules: Object.freeze([
    "TON is the only primary wallet chain.",
    "EVM and Solana are optional linked wallets for campaign compatibility and optional future payout rails.",
    "Bitcoin is payout-destination only in MVP.",
    "Primary wallet switches and unlink operations are audited and cooldown-gated.",
    "No private key storage exists in app runtime."
  ]),
  boundary_map: Object.freeze([
    {
      domain: "identity",
      offchain: "Telegram identity, user profile, locale, sessions, risk and wallet link history",
      onchain: "TON identity credential for verified users",
      notes: "The product root stays offchain even when identity credentials are minted."
    },
    {
      domain: "progression",
      offchain: "missions, tasks, PvP, loot, streaks, ranks and event participation",
      onchain: "none by default",
      notes: "Gameplay micro-events never write directly onchain."
    },
    {
      domain: "economy",
      offchain: "SC, RC, HC balances, sinks, sources and entitlement state",
      onchain: "NXT as TON utility and settlement token only",
      notes: "NXT is not the main faucet for gameplay reward loops."
    },
    {
      domain: "premium",
      offchain: "purchase authorization, effects, expiry logic and entitlement state",
      onchain: "TON premium pass ownership proof when justified",
      notes: "Premium value comes from product utility, not transfer speculation."
    },
    {
      domain: "events",
      offchain: "targeting, windows, progression and rewards",
      onchain: "selected event tickets or claim attestations when partner trust requires them",
      notes: "Only outcome proofs or access credentials justify chain writes."
    },
    {
      domain: "payout",
      offchain: "liability, holds, review, batching, reconciliation and reserve checks",
      onchain: "final settlement transaction only",
      notes: "Payout policy and user eligibility are not smart contract logic."
    }
  ]),
  smart_contract_modules: Object.freeze([
    { key: "nxt_jetton", purpose: "utility and settlement asset", transferability: "transferable", exists: true },
    { key: "identity_credential", purpose: "verified TON-linked identity proof", transferability: "soulbound", exists: true },
    { key: "season_badge", purpose: "season prestige proof", transferability: "soulbound", exists: true },
    { key: "premium_pass", purpose: "premium ownership proof", transferability: "semi_transfer_restricted", exists: true },
    { key: "event_ticket", purpose: "partner or live-event access proof", transferability: "semi_transfer_restricted_until_redeemed", exists: true },
    { key: "claim_attestation_registry", purpose: "partner-facing claim proofs", transferability: "non_transferable", exists: true },
    { key: "reputation_anchor", purpose: "global reputation anchor", transferability: "non_transferable", exists: false }
  ]),
  payout_rules: Object.freeze([
    "No full-auto payout mode exists.",
    "MVP default payout rail is BTC destination settlement.",
    "Scale-ready TON payout opens only for verified primary TON wallets with reconciliation tooling live.",
    "Every payout request requires recent auth, risk review, reserve gate and duplicate-destination checks.",
    "First high-value payout, shared destination, recent wallet relink and event anomaly states trigger holds.",
    "External operator execution is the only settlement path."
  ])
});

const FINAL_DATABASE_LEDGER_TRUTH_MODEL = Object.freeze({
  bounded_contexts: Object.freeze([
    "identity",
    "preferences",
    "telegram_surface",
    "wallet_web3",
    "social_kingdom",
    "missions",
    "live_ops",
    "rewards_inventory",
    "economy",
    "payouts",
    "referrals",
    "premium",
    "fraud_risk",
    "content_localization",
    "analytics",
    "admin_live_ops"
  ]),
  authoritative_truth_rules: Object.freeze([
    "users is the canonical person root.",
    "currency_ledger and entitlement ledger entries are append-only truths.",
    "currency_balances and other summaries are rebuildable snapshots only.",
    "payout request current state is mutable, but review and settlement facts append events.",
    "localized content stores keys and versions, not literal business-critical strings in domain tables."
  ]),
  table_groups: Object.freeze({
    identity: Object.freeze(["users", "user_profiles", "user_status_history", "user_ui_prefs", "notification_preferences"]),
    wallet: Object.freeze(["v5_wallet_challenges", "v5_wallet_links", "v5_wallet_chain_primary_addresses", "v5_wallet_sessions", "wallet_link_audit"]),
    progression: Object.freeze(["kingdom_memberships", "progression_profiles", "season_stats", "mission_templates", "task_offers", "task_attempts", "mission_evidence", "mission_cooldowns"]),
    rewards: Object.freeze(["reward_grants", "inventory_items", "loot_reveals", "chest_definitions", "loot_table_defs"]),
    money: Object.freeze(["currency_ledger", "currency_balances", "ledger_holds", "payout_requests", "payout_review_events", "payout_batches", "payout_batch_items", "payout_tx"]),
    growth: Object.freeze(["referral_links", "referral_edges", "referral_reward_states"]),
    premium: Object.freeze(["v5_pass_products", "v5_user_passes", "v5_cosmetic_purchases", "v5_monetization_ledger"]),
    ops: Object.freeze(["event_definitions", "event_targeting_rules", "event_participation", "content_keys", "content_variants", "content_bundle_versions", "admin_operators", "admin_roles", "admin_role_bindings", "admin_audit"]),
    analytics: Object.freeze(["v5_command_events", "v5_intent_resolution_events", "v5_webapp_ui_events", "v5_http_request_events"]),
    fraud: Object.freeze(["risk_scores", "risk_signal_events", "fraud_cases", "fraud_case_events"])
  }),
  unified_state_machines: Object.freeze([
    { key: "user_lifecycle", states: ["new", "active", "restricted", "paused", "closed"] },
    { key: "wallet_link", states: ["challenge_pending", "verified", "active", "relinked_cooldown", "revoked", "rejected", "expired"] },
    { key: "mission_assignment", states: ["eligible", "offered", "accepted", "in_progress", "completed", "revealed", "claimed", "expired", "rejected"] },
    { key: "event_lifecycle", states: ["draft", "scheduled", "live", "paused", "completed", "cancelled", "archived"] },
    { key: "reward_grant", states: ["pending", "granted", "held", "released", "reversed", "expired"] },
    { key: "ledger_hold", states: ["open", "released", "consumed", "voided"] },
    { key: "payout_request", states: ["draft", "requested", "risk_review", "approved", "batched", "submitted", "paid", "failed", "rejected", "cancelled"] },
    { key: "payout_batch", states: ["open", "sealed", "submitted", "partially_settled", "settled", "failed"] },
    { key: "premium_purchase", states: ["pending", "authorized", "active", "expired", "refunded", "cancelled"] },
    { key: "fraud_case", states: ["open", "triaged", "under_review", "actioned", "dismissed", "closed"] },
    { key: "content_publish", states: ["draft", "review", "approved", "published", "superseded", "rolled_back", "archived"] },
    { key: "notification_delivery", states: ["queued", "sending", "sent", "delivered", "failed", "suppressed", "expired"] }
  ]),
  analytics_schema: Object.freeze({
    event_name_convention: "family.object.verb",
    required_dimensions: Object.freeze([
      "event_id",
      "event_name",
      "occurred_at",
      "user_id_or_uid",
      "session_ref",
      "surface",
      "route_key",
      "panel_key",
      "locale",
      "region_code",
      "device_class",
      "wallet_chain",
      "campaign_key",
      "event_key",
      "experiment_key",
      "variant_key",
      "risk_band"
    ])
  }),
  redis_contracts: Object.freeze([
    "rate_limit",
    "idempotency_shadow",
    "distributed_lock",
    "hot_leaderboard",
    "session_state",
    "notification_dedupe",
    "cooldown_enforcement",
    "fraud_throttle",
    "queue_coordination",
    "district_cache"
  ])
});

const FINAL_CHAT_COMMAND_MAP = Object.freeze({
  principles: Object.freeze([
    "one clear action per message",
    "chat is a cockpit not a maze",
    "trust before hype",
    "miniapp pull not feature dump",
    "compact keyboard and low scroll",
    "safe quick actions only",
    "exact route handoff",
    "never let the user get lost"
  ]),
  navigation_contract: Object.freeze({
    quick_summary_commands_render_in_chat: true,
    complex_actions_route_to_miniapp: true,
    startapp_grammar: "route_key plus optional panel_key plus optional focus_key"
  }),
  commands: Object.freeze([
    { key: "start", group: "core", menu: true, purpose: "first entry and identity setup", route_key: "hub", panel_key: "onboarding" },
    { key: "play", group: "core", menu: true, purpose: "resume last safe route or open hub", route_key: "hub", panel_key: null },
    { key: "hub", group: "core", menu: true, purpose: "chat cockpit summary", route_key: "hub", panel_key: null },
    { key: "profile", group: "core", menu: true, purpose: "identity and kingdom summary", route_key: "hub", panel_key: "profile" },
    { key: "rewards", group: "core", menu: true, purpose: "ready rewards and next reward path", route_key: "hub", panel_key: "rewards" },
    { key: "wallet", group: "economy_trust", menu: true, purpose: "wallet state and balances", route_key: "exchange", panel_key: "wallet" },
    { key: "claim", group: "economy_trust", menu: true, purpose: "safe quick claim when allowed", route_key: "missions", panel_key: "claim" },
    { key: "payout", group: "economy_trust", menu: true, purpose: "payout eligibility and request status", route_key: "vault", panel_key: "payout" },
    { key: "history", group: "economy_trust", menu: false, purpose: "financial and payout history", route_key: "vault", panel_key: "history" },
    { key: "status", group: "economy_trust", menu: false, purpose: "runtime and trust status summary", route_key: "hub", panel_key: "status" },
    { key: "missions", group: "progression", menu: true, purpose: "mission board summary", route_key: "missions", panel_key: null },
    { key: "season", group: "progression", menu: true, purpose: "season progress and deadline", route_key: "season", panel_key: null },
    { key: "rank", group: "progression", menu: false, purpose: "personal rank surface", route_key: "season", panel_key: "rank" },
    { key: "streak", group: "progression", menu: false, purpose: "streak risk and grace window", route_key: "season", panel_key: "streak" },
    { key: "inventory", group: "progression", menu: false, purpose: "owned effects and items", route_key: "forge", panel_key: "inventory" },
    { key: "invite", group: "social_growth", menu: false, purpose: "referral and share entry", route_key: "hub", panel_key: "invite" },
    { key: "friends", group: "social_growth", menu: false, purpose: "social entry point", route_key: "season", panel_key: "kingdom" },
    { key: "kingdom", group: "social_growth", menu: false, purpose: "kingdom and faction standing", route_key: "season", panel_key: "kingdom" },
    { key: "leaderboard", group: "social_growth", menu: false, purpose: "top list teaser and self rank", route_key: "season", panel_key: "leaderboard" },
    { key: "share", group: "social_growth", menu: false, purpose: "localized premium share copy", route_key: "hub", panel_key: "share" },
    { key: "events", group: "events_discovery", menu: true, purpose: "active events and anomalies", route_key: "events", panel_key: null },
    { key: "news", group: "events_discovery", menu: false, purpose: "localized bulletin and updates", route_key: "events", panel_key: "news" },
    { key: "chests", group: "events_discovery", menu: false, purpose: "chest and reveal summary", route_key: "forge", panel_key: "chests" },
    { key: "quests", group: "events_discovery", menu: false, purpose: "quest teaser and next path", route_key: "missions", panel_key: "quests" },
    { key: "discover", group: "events_discovery", menu: false, purpose: "3D world discovery handoff", route_key: "hub", panel_key: "discover" },
    { key: "language", group: "settings_support", menu: true, purpose: "persistent language override", route_key: "settings", panel_key: "language" },
    { key: "settings", group: "settings_support", menu: true, purpose: "notification and accessibility settings", route_key: "settings", panel_key: null },
    { key: "help", group: "settings_support", menu: true, purpose: "help index", route_key: "settings", panel_key: "help" },
    { key: "support", group: "settings_support", menu: false, purpose: "support issue routing", route_key: "settings", panel_key: "support" },
    { key: "faq", group: "settings_support", menu: false, purpose: "localized faq cards", route_key: "settings", panel_key: "faq" }
  ]),
  hidden_admin_commands: Object.freeze([
    "admin",
    "admin_queue",
    "admin_payouts",
    "admin_tokens",
    "admin_metrics",
    "admin_live",
    "admin_freeze",
    "admin_gate",
    "pay",
    "reject_payout",
    "approve_token",
    "reject_token"
  ]),
  alerts: Object.freeze([
    "chest_ready",
    "mission_refresh",
    "event_countdown",
    "kingdom_war",
    "streak_risk",
    "payout_update",
    "rare_drop",
    "comeback_offer",
    "season_deadline"
  ])
});

const FINAL_MINIAPP_3D_WORLD_DESIGN = Object.freeze({
  target_stack: Object.freeze({
    framework: "Next.js App Router",
    language: "TypeScript",
    renderer: "Babylon.js",
    server_state: "TanStack Query",
    validation: "Zod",
    shell_and_scene_boundary: "typed scene bridge"
  }),
  package_boundaries: Object.freeze([
    "apps/miniapp-shell",
    "packages/ui",
    "packages/scene",
    "packages/contracts",
    "packages/i18n"
  ]),
  routes_to_districts: Object.freeze([
    { route_key: "hub", district_key: "central_hub" },
    { route_key: "missions", district_key: "mission_quarter" },
    { route_key: "forge", district_key: "loot_forge" },
    { route_key: "exchange", district_key: "exchange_district" },
    { route_key: "season", district_key: "season_hall" },
    { route_key: "events", district_key: "live_event_overlay" },
    { route_key: "vault", district_key: "exchange_district" },
    { route_key: "settings", district_key: "central_hub" }
  ]),
  districts: Object.freeze([
    { key: "central_hub", purpose: "orientation and next-best action", perf_budget: "<= 140 draw calls, <= 70MB gpu memory" },
    { key: "mission_quarter", purpose: "mission pickup and progression", perf_budget: "<= 160 draw calls, <= 80MB gpu memory" },
    { key: "loot_forge", purpose: "chest opening and reveals", perf_budget: "<= 180 draw calls, <= 90MB gpu memory" },
    { key: "exchange_district", purpose: "wallet, NXT, monetization and route status", perf_budget: "<= 150 draw calls, <= 75MB gpu memory" },
    { key: "season_hall", purpose: "rank, ladder and kingdom prestige", perf_budget: "<= 170 draw calls, <= 85MB gpu memory" },
    { key: "elite_district", purpose: "high-risk and premium gates", perf_budget: "<= 165 draw calls, <= 80MB gpu memory" },
    { key: "live_event_overlay", purpose: "temporary event takeover layers", perf_budget: "<= +25 draw calls over base district" },
    { key: "social_monuments", purpose: "leaderboard and kingdom identity", perf_budget: "<= 145 draw calls, <= 72MB gpu memory" }
  ]),
  interaction_model: Object.freeze([
    "tap_to_travel",
    "guided_onboarding_overlay",
    "objective_tracker",
    "fast_travel_on_unlocked_anchors",
    "wallet_and_payout_drawers_pause_or_downshift_scene",
    "background_resume_restores_last_valid_route_and_district"
  ]),
  quality_profiles: Object.freeze([
    { key: "safe_low", target_fps: 30 },
    { key: "balanced", target_fps: 45 },
    { key: "immersive_high", target_fps: 60 }
  ]),
  performance_budgets: Object.freeze({
    first_meaningful_paint_ms: 1200,
    first_interactive_ms: 2200,
    app_shell_gzip_kb: 220,
    scene_runtime_gzip_kb: 650,
    district_bundle_gzip_kb: 900,
    memory_budget_mb_low: 220
  }),
  accessibility_contract: Object.freeze([
    "reduced_motion",
    "large_text",
    "safe_low_quality_mode",
    "2_5d_or_reduced_effects_fallback",
    "all_world_information_mirrored_in_2d_overlays"
  ]),
  telegram_contract: Object.freeze([
    "typed_startapp_params",
    "BackButton_pops_drawer_then_route_then_exits",
    "MainButton_mirrors_one_next_best_action",
    "safe_area_handling",
    "share_bridge_with_route_and_panel",
    "resume_restore_after_reopen"
  ])
});

const FINAL_LIVEOPS_LOCALIZATION_MODEL = Object.freeze({
  locale_precedence: Object.freeze([
    "stored_user_override",
    "telegram_ui_language_code",
    "verified_profile_locale",
    "region_default_language",
    "product_default_tr"
  ]),
  content_workflow: Object.freeze([
    "draft",
    "localized",
    "qa_passed",
    "approved",
    "scheduled",
    "live",
    "retired"
  ]),
  translation_key_families: Object.freeze([
    "chat.command.*",
    "chat.card.*",
    "miniapp.ui.*",
    "miniapp.world_label.*",
    "event.announcement.*",
    "payout.status.*",
    "support.macro.*",
    "wallet.web3.*",
    "premium.offer.*"
  ]),
  rollout_stages: Object.freeze([
    "internal_only",
    "shadow_readiness",
    "pilot_5pct",
    "managed_25pct",
    "general_100pct"
  ]),
  live_ops_controls: Object.freeze([
    "daily_rotations_in_utc_with_region_windows",
    "seasonal_campaigns_with_preload_and_end_caps",
    "partner_campaigns_with_region_and_chain_filters",
    "scarcity_windows_with_frequency_caps",
    "event_disable_flag",
    "locale_disable_flag",
    "reward_route_close",
    "broadcast_cancel_before_send"
  ]),
  experimentation_guardrails: Object.freeze([
    "no_experiment_on_payout_truth_copy",
    "no_experiment_on_wallet_safety_copy",
    "user_level_randomization_for_copy_only",
    "locale_qa_required_before_variant_release",
    "holdout_required_for_high_blast_radius_live_ops_tests"
  ]),
  dashboards: Object.freeze([
    "executive_global",
    "product_global",
    "localization_health",
    "live_ops_runtime",
    "payout_and_trust",
    "fraud_and_review",
    "web3_chain_funnel",
    "scene_performance"
  ])
});

const FINAL_FRAUD_RISK_MODEL = Object.freeze({
  scoring_inputs: Object.freeze([
    "identity_and_device_signals",
    "wallet_graph_signals",
    "referral_velocity",
    "event_exploitation_patterns",
    "support_abuse_patterns",
    "translation_abuse_patterns",
    "payout_destination_reuse"
  ]),
  review_queues: Object.freeze([
    "wallet_farm_review",
    "referral_ring_review",
    "payout_hold_review",
    "support_abuse_review",
    "event_exploitation_review",
    "translation_abuse_review"
  ]),
  hold_rules: Object.freeze([
    "first_high_value_payout_hold",
    "shared_destination_hold",
    "recent_wallet_relink_hold",
    "event_anomaly_hold",
    "manual_release_or_reject_with_reason_code"
  ]),
  enforcement_ladder: Object.freeze([
    "shadow_score_only",
    "silent_dampening",
    "reward_hold",
    "manual_review_gate",
    "cooldown_extension",
    "hard_block_for_confirmed_abuse"
  ]),
  false_positive_controls: Object.freeze([
    "new_region_shadow_period",
    "locale_specific_baselines_before_hard_enforcement",
    "appealable_manual_actions",
    "review_sampling_after_threshold_changes",
    "support_override_with_audit"
  ]),
  emergency_controls: Object.freeze([
    "pause_new_payout_approvals",
    "disable_high_risk_auto_paths",
    "raise_chain_risk_tier_without_deploy",
    "pause_claim_publications",
    "event_variant_pause"
  ]),
  user_messaging_rules: Object.freeze([
    "non_accusatory_copy",
    "calm_status_language",
    "no_public_fraud_label_without_user_specific_action",
    "show_next_safe_step",
    "never_promise_out_of_policy_timing"
  ])
});

const FINAL_BUILD_ORDER = Object.freeze([
  {
    order: 1,
    team: "architecture_and_shared_contracts",
    deliverable: "lock canonical route, currency, locale and analytics contracts in shared packages",
    depends_on: Object.freeze([])
  },
  {
    order: 2,
    team: "data_platform",
    deliverable: "finish canonical tables, append-only ledger paths, state machines, content bundles and analytics partitions",
    depends_on: Object.freeze([1])
  },
  {
    order: 3,
    team: "web3_backend",
    deliverable: "ship server-side TON proof verification, linked-wallet model, relink cooldown and payout operator boundary",
    depends_on: Object.freeze([1, 2])
  },
  {
    order: 4,
    team: "ops_platform",
    deliverable: "ship admin roles, confirm-token controls, audit trails, content governance and live-ops scheduling primitives",
    depends_on: Object.freeze([1, 2])
  },
  {
    order: 5,
    team: "bot_chat",
    deliverable: "ship canonical chat cockpit and command map with the unified route grammar",
    depends_on: Object.freeze([1, 2, 4])
  },
  {
    order: 6,
    team: "frontend_platform",
    deliverable: "stand up Next.js shell, typed startapp parser, Telegram adapters, locale bootstrap and scene bridge",
    depends_on: Object.freeze([1, 2, 4])
  },
  {
    order: 7,
    team: "miniapp_world",
    deliverable: "ship central hub, mission quarter, loot forge, exchange district and safe-low fallback profile",
    depends_on: Object.freeze([3, 5, 6])
  },
  {
    order: 8,
    team: "player_economy_and_trust",
    deliverable: "ship wallet drawer, payout drawer, entitlement views, calm trust copy and BTC payout request flow",
    depends_on: Object.freeze([2, 3, 4, 6, 7])
  },
  {
    order: 9,
    team: "fraud_and_analytics",
    deliverable: "ship canonical event pipeline, dashboards, risk queues, hold logic and false-positive controls",
    depends_on: Object.freeze([2, 3, 4, 5, 7, 8])
  },
  {
    order: 10,
    team: "localization_and_live_ops",
    deliverable: "ship locale rollout lanes, screenshot QA, event targeting, notification controls and experiment guardrails",
    depends_on: Object.freeze([4, 5, 6, 9])
  },
  {
    order: 11,
    team: "scale_content_and_world",
    deliverable: "ship season hall, elite district, social monuments, live event overlays and premium surfaces",
    depends_on: Object.freeze([7, 8, 9, 10])
  },
  {
    order: 12,
    team: "release_and_qa",
    deliverable: "run full QA matrix, ship-readiness gates, cutover and go-live command center",
    depends_on: Object.freeze([5, 7, 8, 9, 10, 11])
  }
]);

const FINAL_DEPENDENCY_MAP = Object.freeze([
  {
    component: "shared_route_and_panel_contract",
    depends_on: Object.freeze(["shared_i18n_keys", "chat_deeplink_parser", "miniapp_router"]),
    blocks: Object.freeze(["chat_handoff", "resume_restore", "admin_linkouts"])
  },
  {
    component: "locale_precedence_resolver",
    depends_on: Object.freeze(["user_ui_prefs", "telegram_language_input", "profile_locale", "content_bundle_versions"]),
    blocks: Object.freeze(["chat_localization", "miniapp_localization", "support_templates"])
  },
  {
    component: "wallet_proof_verifier",
    depends_on: Object.freeze(["wallet_challenges", "signature_validation", "wallet_link_tables", "risk_service"]),
    blocks: Object.freeze(["primary_wallet_binding", "payout_eligibility", "ton_identity_credential_pilot"])
  },
  {
    component: "entitlement_and_payout_model",
    depends_on: Object.freeze(["currency_ledger", "ledger_holds", "payout_requests", "payout_review_events", "operator_gateway"]),
    blocks: Object.freeze(["payout_available_views", "reserve_dashboard", "auto_policy"])
  },
  {
    component: "content_governance_system",
    depends_on: Object.freeze(["content_keys", "content_variants", "content_bundle_versions", "admin_roles"]),
    blocks: Object.freeze(["locale_rollout", "live_ops_publish", "support_macro_catalog"])
  },
  {
    component: "canonical_event_pipeline",
    depends_on: Object.freeze(["event_contract", "ui_event_ingest", "command_events", "rollups"]),
    blocks: Object.freeze(["dashboards", "experimentation", "fraud_evidence"])
  },
  {
    component: "next_shell_and_scene_bridge",
    depends_on: Object.freeze(["route_contract", "locale_bootstrap", "telegram_adapters", "scene_package"]),
    blocks: Object.freeze(["district_loading", "route_resume", "drawer_controls"])
  },
  {
    component: "district_asset_registry",
    depends_on: Object.freeze(["scene_package", "bundle_manifests", "perf_budgets"]),
    blocks: Object.freeze(["hub", "mission_quarter", "forge", "exchange", "event_overlays"])
  },
  {
    component: "live_ops_scheduler_and_targeting",
    depends_on: Object.freeze(["event_definitions", "event_targeting_rules", "content_governance_system", "notification_pipeline"]),
    blocks: Object.freeze(["regional_events", "comeback_campaigns", "scarcity_windows"])
  },
  {
    component: "fraud_queue_and_hold_logic",
    depends_on: Object.freeze(["risk_signals", "wallet_graph", "payout_requests", "analytics_rollups", "admin_workspace"]),
    blocks: Object.freeze(["safe_auto_paths", "new_region_launch", "payout_release"])
  }
]);

const FINAL_RISK_REGISTER = Object.freeze([
  {
    key: "frontend_target_migration",
    severity: "critical",
    owner: "frontend_platform",
    mitigation: "Ship Next.js shell and scene bridge before deleting transition runtime; gate by district budgets and resume tests."
  },
  {
    key: "telegram_webview_performance",
    severity: "critical",
    owner: "miniapp_world",
    mitigation: "Use strict quality profiles, safe-low fallback, asset manifests and district load budgets."
  },
  {
    key: "wallet_verification_gap",
    severity: "critical",
    owner: "web3_backend",
    mitigation: "Replace format-only verification with TON proof verification and chain-native linked-wallet checks before broad wallet rollout."
  },
  {
    key: "ledger_vs_reserve_drift",
    severity: "critical",
    owner: "data_platform",
    mitigation: "Maintain append-only entitlement truth, reserve comparisons, reconciliation jobs and operator review gates."
  },
  {
    key: "locale_fallback_breakage",
    severity: "high",
    owner: "localization_ops",
    mitigation: "Use one precedence resolver, readiness gates, screenshot QA and live fallback alerts."
  },
  {
    key: "event_targeting_errors",
    severity: "high",
    owner: "live_ops",
    mitigation: "Separate timing, targeting and copy; require preview diff, quiet-hours rules and kill switches."
  },
  {
    key: "fraud_false_positives",
    severity: "high",
    owner: "fraud_ops",
    mitigation: "Keep new regions in shadow mode, sample reviews after model changes and expose appeal paths."
  },
  {
    key: "analytics_contract_drift",
    severity: "high",
    owner: "data_platform",
    mitigation: "Enforce family.object.verb, shared required dimensions and contract tests across surfaces."
  },
  {
    key: "onchain_offchain_divergence",
    severity: "high",
    owner: "web3_backend",
    mitigation: "Index contract events before granting ownership-sensitive benefits and keep gameplay authoritative offchain."
  },
  {
    key: "operator_overreach",
    severity: "medium",
    owner: "ops_platform",
    mitigation: "Role separation, confirm tokens, cooldowns, two-person rule and complete admin audit logs."
  }
]);

const FINAL_QA_CHECKLIST = Object.freeze({
  contracts_and_data: Object.freeze([
    "All v2 request and response schemas validate against the shared canonical contract.",
    "Append-only ledger paths reject in-place mutation of historical deltas.",
    "All player and admin mutations require action_request_id and deterministic idempotency behavior.",
    "Payout and settlement tables reconstruct the full payout lifecycle with tx proof."
  ]),
  chat_and_navigation: Object.freeze([
    "Every menu command resolves to a valid route_key and optional panel_key.",
    "Unknown or malformed startapp params always recover to hub.",
    "Chat quick actions never duplicate complex Mini App forms.",
    "Alert frequency caps and opt-out controls work per alert family."
  ]),
  miniapp_and_world: Object.freeze([
    "Hub, mission quarter, forge and exchange districts meet draw-call, memory and bundle budgets.",
    "BackButton, safe-area handling and resume recovery pass inside Telegram mobile webview.",
    "Reduced motion, large text and safe-low quality mode behave consistently across shell and scene.",
    "Wallet and payout drawers work even when the scene is paused or downshifted."
  ]),
  web3_and_payout: Object.freeze([
    "TON Connect proof verification passes real signature tests.",
    "Primary wallet uniqueness and relink cooldown rules are enforced.",
    "Payout request holds trigger on duplicate destination, relink and high-risk conditions.",
    "Operator settlement writes tx proof and reconciliation status deterministically."
  ]),
  localization_and_live_ops: Object.freeze([
    "TR and EN pass screenshot, overflow and trust-copy completeness checks.",
    "Critical trust copy does not fall back incorrectly.",
    "Event scheduling respects region windows and quiet hours.",
    "Experiment variants cannot launch without localized copy and QA approval."
  ]),
  fraud_and_analytics: Object.freeze([
    "All critical flows emit canonical analytics families and dimensions.",
    "Locale, region, device class and risk band dashboard slices are populated.",
    "Fraud shadow-mode review queues populate before hard enforcement in new regions.",
    "Performance telemetry captures frame time, district load and context loss."
  ])
});

const FINAL_SHIP_READINESS_CHECKLIST = Object.freeze({
  architecture: Object.freeze([
    "Canonical route grammar, currency glossary, locale precedence and analytics contract are frozen in shared packages.",
    "No unresolved architecture contradiction remains between chat, Mini App, Web3 and admin surfaces."
  ]),
  product: Object.freeze([
    "Chat cockpit, Mini App core routes and admin workspace all run on real data only.",
    "One next-best action is visible from chat and hub for all key user states.",
    "No critical trust surface depends on placeholder, fake or untranslated copy."
  ]),
  web3_and_money: Object.freeze([
    "TON primary wallet verification is live.",
    "BTC payout destination MVP flow is reconciled end to end.",
    "Reserve versus liability dashboards are available to operators.",
    "No direct runtime custody path exists."
  ]),
  ops_and_localization: Object.freeze([
    "TR and EN are fully ready with support macros and payout templates.",
    "Kill switches for locale, event and auto-policy paths are verified.",
    "Operator roles, confirm tokens, cooldowns and audit logs are live."
  ]),
  quality: Object.freeze([
    "Low-end safe-low profile is usable in Telegram mobile webview.",
    "All core flows pass QA matrix, contract tests and smoke tests.",
    "Performance, payout failure, fallback rate and fraud hold alerts are wired."
  ]),
  go_live: Object.freeze([
    "Rollout plan, on-call ownership and emergency copy templates are published.",
    "Forward-fix and emergency disable procedures are rehearsed.",
    "Leadership, trust ops, fraud ops, live-ops and engineering all sign off on the final gate."
  ])
});

const ENGINEERING_HANDOFF_CHECKLIST = Object.freeze([
  "Freeze one shared route_key and panel_key contract and remove duplicate navigation vocabularies.",
  "Freeze one shared currency glossary: SC Soft Credits, RC Relic Credits, HC Hard Credits, payout_available and NXT Nexus Token.",
  "Implement one shared locale precedence resolver across bot, admin-api and Mini App.",
  "Implement one shared analytics event contract using family.object.verb and immutable required dimensions.",
  "Move all critical trust copy into versioned content bundles with readiness gates.",
  "Complete canonical Postgres tables for ledger, payout review, content governance, fraud cases and admin roles before broad feature rollout.",
  "Replace format-only wallet verification with TON proof verification and linked-wallet history.",
  "Keep gameplay authoritative offchain and mint only trust-bearing or premium-related TON modules.",
  "Build payout_available from append-only entitlement truth; never from convenience balances alone.",
  "Route all final payouts through external operator execution with tx proof and reconciliation rows.",
  "Ship the chat cockpit on the same route grammar used by the Mini App.",
  "Stand up the Next.js shell and typed scene bridge before expanding district content.",
  "Ship safe-low performance fallback before any high-cost or elite district content.",
  "Separate event scheduling, targeting and localized copy in the live-ops model.",
  "Enforce confirm token, cooldown and audit log on critical admin actions.",
  "Create dashboard slices for locale, region, device class, chain, variant and risk band.",
  "Put new locale fraud models in shadow mode first and sample false positives before hard gates.",
  "Block experimentation on payout truth, wallet safety and fraud decision semantics.",
  "Require screenshot QA for every live locale and experiment variant on critical surfaces.",
  "Verify kill switches for locale, event, auto-policy and payout-auto paths before go-live.",
  "Publish runbooks for payout delay, wallet provider degradation, localization outage and event misfire incidents.",
  "Do not delete the transition runtime until Next.js, Babylon.js, route recovery and safe-low fallback are all proven stable."
]);

function getGlossaryTerm(term) {
  return FINAL_DOMAIN_GLOSSARY.find((item) => item.term === String(term || "").trim()) || null;
}

function getCommandSpec(key) {
  return FINAL_CHAT_COMMAND_MAP.commands.find((item) => item.key === String(key || "").trim().toLowerCase()) || null;
}

function getBuildStep(order) {
  return FINAL_BUILD_ORDER.find((item) => Number(item.order) === Number(order)) || null;
}

function getRiskRegisterItem(key) {
  return FINAL_RISK_REGISTER.find((item) => item.key === String(key || "").trim().toLowerCase()) || null;
}

function getStateMachine(key) {
  return FINAL_DATABASE_LEDGER_TRUTH_MODEL.unified_state_machines.find(
    (item) => item.key === String(key || "").trim().toLowerCase()
  ) || null;
}

module.exports = {
  CANONICAL_PRODUCT_NON_NEGOTIABLES,
  CANONICAL_PRODUCT_REJECTED_ALTERNATIVES,
  CANONICAL_PRODUCT_IMPLEMENTATION_RISKS,
  CANONICAL_PRODUCT_MVP_SUBSET,
  CANONICAL_PRODUCT_SCALE_READY_SUBSET,
  CANONICAL_PRODUCT_RESOLVED_QUESTIONS,
  FINAL_CANONICAL_ARCHITECTURE,
  FINAL_DOMAIN_GLOSSARY,
  FINAL_USER_JOURNEY,
  FINAL_WEB3_BOUNDARY_MAP,
  FINAL_DATABASE_LEDGER_TRUTH_MODEL,
  FINAL_CHAT_COMMAND_MAP,
  FINAL_MINIAPP_3D_WORLD_DESIGN,
  FINAL_LIVEOPS_LOCALIZATION_MODEL,
  FINAL_FRAUD_RISK_MODEL,
  FINAL_BUILD_ORDER,
  FINAL_DEPENDENCY_MAP,
  FINAL_RISK_REGISTER,
  FINAL_QA_CHECKLIST,
  FINAL_SHIP_READINESS_CHECKLIST,
  ENGINEERING_HANDOFF_CHECKLIST,
  getGlossaryTerm,
  getCommandSpec,
  getBuildStep,
  getRiskRegisterItem,
  getStateMachine
};
