const test = require("node:test");
const assert = require("node:assert/strict");
const {
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
} = require("../src/architecture/web3CoreBlueprint");

test("web3 blueprint exposes required sections", () => {
  assert.ok(WEB3_NON_NEGOTIABLE_DECISIONS.length >= 6);
  assert.ok(WEB3_REJECTED_ALTERNATIVES.length >= 5);
  assert.ok(WEB3_IMPLEMENTATION_RISKS.length >= 5);
  assert.ok(WEB3_MVP_SUBSET.identity.length >= 3);
  assert.ok(WEB3_SCALE_READY_SUBSET.identity.length >= 3);
  assert.ok(WEB3_RESOLVED_OPEN_QUESTIONS.length >= 5);
  assert.ok(WEB3_SYSTEM_PHILOSOPHY.principles.length >= 5);
  assert.ok(TON_FIRST_ARCHITECTURE.wallet_connect_flow.length >= 5);
  assert.ok(OFFCHAIN_ONCHAIN_BOUNDARY_MAP.length >= 5);
  assert.ok(MULTI_CHAIN_WALLET_STRATEGY.secondary_wallets.length >= 3);
  assert.ok(SMART_CONTRACT_MODULE_BLUEPRINT.length >= 6);
  assert.ok(CRYPTOECONOMIC_MODEL.offchain_currencies.length === 3);
  assert.ok(PAYOUT_TREASURY_ARCHITECTURE.payout_model.length >= 6);
  assert.ok(TELEGRAM_WEB3_UX.beginner_path.length >= 3);
  assert.ok(SECURITY_AND_ADVERSARIAL_DEFENSE.wallet_binding_rules.length >= 4);
  assert.ok(WEB3_ROLLOUT_PHASES.length >= 4);
  assert.ok(ENGINEERING_HANDOFF_CHECKLIST.length >= 20);
});

test("blueprint locks core chain and custody decisions", () => {
  assert.match(getNonNegotiableDecision("ton_is_primary_identity").decision, /TON/i);
  assert.match(getNonNegotiableDecision("gameplay_stays_offchain").decision, /offchain/i);
  assert.match(getNonNegotiableDecision("no_runtime_custody").decision, /never holds/i);
  assert.equal(MULTI_CHAIN_WALLET_STRATEGY.primary_wallet.chain, "TON");
  assert.ok(MULTI_CHAIN_WALLET_STRATEGY.payout_preference_logic.includes("default_payout_chain_is_BTC_in_MVP"));
});

test("module choices preserve restraint and transferability rules", () => {
  assert.equal(getSmartContractModule("identity_credential").transferability, "soulbound");
  assert.equal(getSmartContractModule("season_badge").transferability, "soulbound");
  assert.equal(getSmartContractModule("claim_attestation_registry").should_exist, true);
  assert.equal(getSmartContractModule("reputation_anchor").should_exist, false);
});

test("economy and payout policy keep token and rails bounded", () => {
  assert.equal(CRYPTOECONOMIC_MODEL.token_policy.exists, true);
  assert.equal(CRYPTOECONOMIC_MODEL.token_policy.chain, "TON");
  assert.ok(CRYPTOECONOMIC_MODEL.token_policy.forbidden_uses.includes("direct_drop_per_arena_micro-event"));
  const btc = PAYOUT_TREASURY_ARCHITECTURE.chain_rules.find((row) => row.chain === "BTC");
  const ton = PAYOUT_TREASURY_ARCHITECTURE.chain_rules.find((row) => row.chain === "TON");
  assert.equal(btc.role, "mvp_primary_payout_rail_and_reserve_friendly_settlement");
  assert.equal(ton.role, "future_primary_payout_for_verified_wallets");
  assert.ok(PAYOUT_TREASURY_ARCHITECTURE.safe_auto_path_criteria.includes("reserve_gate_open"));
});

test("engineering handoff keeps production gates explicit", () => {
  const joined = ENGINEERING_HANDOFF_CHECKLIST.join(" ");
  assert.match(joined, /TON Connect proof verification/i);
  assert.match(joined, /append-only ledgers/i);
  assert.match(joined, /BTC as MVP payout rail/i);
  assert.match(joined, /external operator path only/i);
  assert.match(joined, /pause payouts/i);
});
