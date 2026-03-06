"use strict";

const WEB3_NON_NEGOTIABLE_DECISIONS = Object.freeze([
  { key: "ton_is_primary_identity", decision: "TON is the only primary identity chain.", why: "Telegram-native trust and wallet UX need one root chain." },
  { key: "gameplay_stays_offchain", decision: "Gameplay and entitlement logic remain offchain.", why: "Micro-events are too fast and too abuse-prone for chain writes." },
  { key: "no_runtime_custody", decision: "The app runtime never holds user or treasury private keys.", why: "Runtime custody collapses the security model." },
  { key: "nxt_is_utility_not_loop", decision: "NXT is a utility and settlement token, not the main gameplay reward loop.", why: "Liquid emissions would hijack the game." },
  { key: "btc_is_payout_only", decision: "BTC is a payout rail, not a primary session wallet.", why: "Bitcoin connect UX is not Telegram-grade." },
  { key: "multi_chain_is_secondary", decision: "EVM and Solana are optional secondary rails under a TON-first model.", why: "Symmetric multi-chain would fragment trust and product identity." },
  { key: "payouts_are_risk_gated", decision: "Every payout request is reviewed by reserve, risk and duplicate controls.", why: "Blind withdrawals destroy trust fastest." }
]);

const WEB3_REJECTED_ALTERNATIVES = Object.freeze([
  { key: "chain_neutral_identity", why: "Three equal identity chains would fracture UX and policy." },
  { key: "fully_onchain_gameplay", why: "Gas and latency would break retention." },
  { key: "app_managed_hot_wallet", why: "Runtime compromise would become treasury compromise." },
  { key: "liquid_farming_rewards", why: "Extraction behavior would dominate gameplay." },
  { key: "nft_everything", why: "Most gameplay items do not deserve chain friction." },
  { key: "btc_as_primary_wallet", why: "Bitcoin does not offer a clean mainstream Telegram wallet flow." }
]);

const WEB3_IMPLEMENTATION_RISKS = Object.freeze([
  { key: "wallet_verification_gap", severity: "critical" },
  { key: "ledger_treasury_drift", severity: "critical" },
  { key: "wallet_rebind_abuse", severity: "high" },
  { key: "token_speculation_overhang", severity: "high" },
  { key: "onchain_offchain_divergence", severity: "high" },
  { key: "operator_key_concentration", severity: "high" }
]);

const WEB3_MVP_SUBSET = Object.freeze({
  identity: Object.freeze(["TON Connect primary wallet", "EVM and SOL secondary optional", "BTC payout destination only"]),
  economy: Object.freeze(["SC offchain", "RC offchain", "HC offchain", "NXT no gameplay emission"]),
  payouts: Object.freeze(["BTC primary payout rail", "manual review", "limited safe auto path"]),
  onchain: Object.freeze(["TON identity credential pilot only", "no micro-event minting"]) 
});

const WEB3_SCALE_READY_SUBSET = Object.freeze({
  identity: Object.freeze(["TON credentials default", "season badges", "wallet graph scoring"]),
  economy: Object.freeze(["NXT governed settlement rail", "claim attestation registry", "campaign chain routing"]),
  payouts: Object.freeze(["TON payout rail", "selected EVM/SOL payout rails", "dynamic auto-policy by segment"]),
  operations: Object.freeze(["reserve-vs-liability dashboard", "chain-by-chain reconciliation", "anomaly watchdog"]) 
});

const WEB3_RESOLVED_OPEN_QUESTIONS = Object.freeze([
  { key: "public_token", resolution: "Yes, but only as TON utility and settlement." },
  { key: "gameplay_onchain", resolution: "No." },
  { key: "multi_chain_equal", resolution: "No." },
  { key: "badge_transferability", resolution: "Identity and season are soulbound; tickets and passes are restricted." },
  { key: "btc_primary_wallet", resolution: "No." },
  { key: "full_auto_payout", resolution: "No." }
]);

const WEB3_SYSTEM_PHILOSOPHY = Object.freeze({
  principles: Object.freeze(["one_primary_chain", "users_keep_keys", "fast_offchain_gameplay", "selective_onchain_truth", "treasury_visibility", "no_complexity_before_value"])
});

const TON_FIRST_ARCHITECTURE = Object.freeze({
  wallet_connect_flow: Object.freeze(["connect_ton", "receive_proof", "verify_server_side", "bind_primary_wallet", "issue_wallet_session"]),
  ton_surfaces: Object.freeze(["identity_credential", "season_badge", "premium_pass", "event_ticket", "claim_attestation", "nxt_jetton"]),
  mint_when: Object.freeze(["verified_wallet_link", "season_completion", "premium_purchase", "event_finalization", "claim_batch_finalization"]),
  do_not_mint_when: Object.freeze(["task_accept", "task_complete", "loot_reveal", "pvp_tick", "referral_click"]),
  transferability: Object.freeze({ identity_credential: "soulbound", season_badge: "soulbound", premium_pass: "semi_transfer_restricted", event_ticket: "semi_transfer_restricted_until_redeemed", claim_attestation: "non_transferable", nxt_jetton: "transferable" })
});

const OFFCHAIN_ONCHAIN_BOUNDARY_MAP = Object.freeze([
  { domain: "identity", offchain: "session and risk", onchain: "TON identity credential" },
  { domain: "gameplay", offchain: "missions, pvp, loot, progression", onchain: "none by default" },
  { domain: "economy", offchain: "SC, RC, HC", onchain: "NXT only" },
  { domain: "premium", offchain: "effects and expiry logic", onchain: "premium pass proof" },
  { domain: "campaigns", offchain: "eligibility and orchestration", onchain: "ticket or claim attestation" },
  { domain: "payout", offchain: "review and liability", onchain: "final settlement tx only" }
]);

const MULTI_CHAIN_WALLET_STRATEGY = Object.freeze({
  primary_wallet: Object.freeze({ chain: "TON", connect_mode: "ton_connect" }),
  secondary_wallets: Object.freeze([
    { chain: "EVM", role: "campaign_and_payout_optional" },
    { chain: "SOL", role: "campaign_and_payout_optional" },
    { chain: "BTC", role: "payout_destination" }
  ]),
  ton_exclusive_features: Object.freeze(["identity_credentials", "season_badges", "premium_pass_onchain_ownership", "fastest_auto_review_path"]),
  payout_preference_logic: Object.freeze(["default_payout_chain_is_BTC_in_MVP", "TON_payout_enabled_for_verified_primary_users_in_scale_phase"])
});

const SMART_CONTRACT_MODULE_BLUEPRINT = Object.freeze([
  { key: "nxt_jetton", should_exist: true, transferability: "transferable" },
  { key: "identity_credential", should_exist: true, transferability: "soulbound" },
  { key: "season_badge", should_exist: true, transferability: "soulbound" },
  { key: "event_ticket", should_exist: true, transferability: "semi_transfer_restricted_until_redeemed" },
  { key: "premium_pass", should_exist: true, transferability: "semi_transfer_restricted" },
  { key: "claim_attestation_registry", should_exist: true, transferability: "non_transferable" },
  { key: "reputation_anchor", should_exist: false, transferability: "non_transferable" }
]);

const CRYPTOECONOMIC_MODEL = Object.freeze({
  offchain_currencies: Object.freeze(["SC", "RC", "HC"]),
  token_policy: Object.freeze({ exists: true, symbol: "NXT", chain: "TON", forbidden_uses: Object.freeze(["direct_drop_per_arena_micro-event", "referral_spam_reward_loop", "unbounded_inflation_faucet"]) }),
  reserve_rules: Object.freeze(["entitlements_separate_from_reserves", "reserve_views_by_chain", "payout_release_caps_below_risk_budget"])
});

const PAYOUT_TREASURY_ARCHITECTURE = Object.freeze({
  payout_model: Object.freeze(["earn_offchain", "ledger_record", "request", "risk_check", "auto_or_manual_review", "external_operator_transfer", "tx_proof", "reconciliation"]),
  chain_rules: Object.freeze([
    { chain: "TON", role: "future_primary_payout_for_verified_wallets" },
    { chain: "EVM", role: "optional_partner_or_high_value_payout" },
    { chain: "SOL", role: "optional_partner_or_campaign_payout" },
    { chain: "BTC", role: "mvp_primary_payout_rail_and_reserve_friendly_settlement" }
  ]),
  safe_auto_path_criteria: Object.freeze(["verified_wallet_binding", "low_risk_segment", "velocity_under_limit", "reserve_gate_open", "chain_policy_enabled"])
});

const TELEGRAM_WEB3_UX = Object.freeze({
  beginner_path: Object.freeze(["show_value_before_connect_wallet", "recommend_ton_connect", "hide_secondary_wallets_under_advanced"]),
  signature_copy_rules: Object.freeze(["not_a_payment", "proves_wallet_ownership", "show_nonce_and_expiry", "cancel_is_safe"]),
  transaction_copy_rules: Object.freeze(["show_asset", "show_amount", "show_chain", "show_reason", "show_cancel_is_safe"])
});

const SECURITY_AND_ADVERSARIAL_DEFENSE = Object.freeze({
  wallet_binding_rules: Object.freeze(["nonce_bound_wallet_proof", "short_lived_challenge", "primary_wallet_uniqueness", "wallet_relink_cooldown"]),
  anti_sybil_and_graph_signals: Object.freeze(["many_accounts_one_wallet", "many_wallets_one_device_cluster", "shared_payout_destination", "wallet_hop_pattern", "referral_tree_velocity_spike"]),
  treasury_emergency_controls: Object.freeze(["pause_new_payout_approvals", "pause_claim_publications", "disable_high_risk_auto_paths", "raise_chain_risk_tier_without_code_deploy"])
});

const WEB3_ROLLOUT_PHASES = Object.freeze([
  { phase: "phase_1_mvp", scope: Object.freeze(["TON Connect", "offchain economy", "BTC payout rail"]) },
  { phase: "phase_2_trust_assets", scope: Object.freeze(["TON identity credential pilot", "season badges", "reserve dashboard"]) },
  { phase: "phase_3_chain_optional_expansion", scope: Object.freeze(["EVM and SOL secondary linking", "partner chain routing", "TON premium modules"]) },
  { phase: "phase_4_scale_ready", scope: Object.freeze(["NXT governed settlement rail", "claim registry", "TON payout rail", "dynamic auto policy"]) }
]);

const ENGINEERING_HANDOFF_CHECKLIST = Object.freeze([
  "Replace format-only wallet proof validation with TON Connect proof verification and chain-native EVM and SOL verification.",
  "Store wallet challenges with domain, expiry and action scope.",
  "Keep TON as the single primary wallet field.",
  "Move secondary wallets into a linked-wallets table.",
  "Add wallet binding history and relink cooldown.",
  "Audit every unlink and primary switch.",
  "Keep gameplay writes offchain only.",
  "Add TON identity credential flow behind a flag.",
  "Define NXT treasury policy before broad distribution.",
  "Store SC, RC, HC and entitlements in append-only ledgers.",
  "Add liability rollup and reserve comparison jobs.",
  "Keep BTC as MVP payout rail.",
  "Do not ship TON/EVM/SOL payout rails before reconciliation tooling is live.",
  "Require risk scoring, duplicate-destination checks and recent auth for payout requests.",
  "Use idempotent payout request ids.",
  "Execute final payouts via external operator path only.",
  "Record operator id, request id, tx hash and reconciliation status on payout completion.",
  "Unify manual review reason enums across ops, support and analytics.",
  "Manage chain risk tiers and auto-limits in admin policy, not code constants.",
  "Create claim attestation registry only when partner proof demand is real.",
  "Index own TON contract events before granting ownership-sensitive benefits.",
  "Expose wallet status, payout status and proof state in user trust surfaces.",
  "Keep beginner UX wallet-light and hide secondary chains.",
  "Add anomaly watchdogs for wallet hopping and shared payout destinations.",
  "Document pause payouts, disable auto and raise risk-tier emergency controls."
]);

function getSmartContractModule(key) {
  return SMART_CONTRACT_MODULE_BLUEPRINT.find((item) => item.key === String(key || "").trim().toLowerCase()) || null;
}

function getNonNegotiableDecision(key) {
  return WEB3_NON_NEGOTIABLE_DECISIONS.find((item) => item.key === String(key || "").trim().toLowerCase()) || null;
}

module.exports = {
  WEB3_NON_NEGOTIABLE_DECISIONS,
  WEB3_REJECTED_ALTERNATIVES,
  WEB3_IMPLEMENTATION_RISKS,
  WEB3_MVP_SUBSET,
  WEB3_SCALE_READY_SUBSET,
  WEB3_RESOLVED_OPEN_QUESTIONS,
  WEB3_SYSTEM_PHILOSOPHY,
  TON_FIRST_ARCHITECTURE,
  OFFCHAIN_ONCHAIN_BOUNDARY_MAP,
  MULTI_CHAIN_WALLET_STRATEGY,
  SMART_CONTRACT_MODULE_BLUEPRINT,
  CRYPTOECONOMIC_MODEL,
  PAYOUT_TREASURY_ARCHITECTURE,
  TELEGRAM_WEB3_UX,
  SECURITY_AND_ADVERSARIAL_DEFENSE,
  WEB3_ROLLOUT_PHASES,
  ENGINEERING_HANDOFF_CHECKLIST,
  getSmartContractModule,
  getNonNegotiableDecision
};
