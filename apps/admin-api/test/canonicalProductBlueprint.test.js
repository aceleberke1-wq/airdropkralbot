const test = require("node:test");
const assert = require("node:assert/strict");
const {
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
} = require("../../../packages/shared/src/architecture/canonicalProductBlueprint");

test("canonical product blueprint exposes all final sections", () => {
  assert.ok(CANONICAL_PRODUCT_NON_NEGOTIABLES.length >= 10);
  assert.ok(CANONICAL_PRODUCT_REJECTED_ALTERNATIVES.length >= 7);
  assert.ok(CANONICAL_PRODUCT_IMPLEMENTATION_RISKS.length >= 10);
  assert.ok(CANONICAL_PRODUCT_MVP_SUBSET.surfaces.length >= 3);
  assert.ok(CANONICAL_PRODUCT_SCALE_READY_SUBSET.surfaces.length >= 3);
  assert.ok(CANONICAL_PRODUCT_RESOLVED_QUESTIONS.length >= 6);
  assert.equal(FINAL_CANONICAL_ARCHITECTURE.stack.frontend, "Next.js App Router plus TypeScript plus Babylon.js plus TanStack Query plus Zod");
  assert.ok(FINAL_DOMAIN_GLOSSARY.length >= 18);
  assert.ok(FINAL_USER_JOURNEY.first_run.length >= 4);
  assert.ok(FINAL_WEB3_BOUNDARY_MAP.boundary_map.length >= 5);
  assert.ok(FINAL_DATABASE_LEDGER_TRUTH_MODEL.unified_state_machines.length >= 10);
  assert.ok(FINAL_CHAT_COMMAND_MAP.commands.length >= 25);
  assert.ok(FINAL_MINIAPP_3D_WORLD_DESIGN.districts.length >= 8);
  assert.ok(FINAL_LIVEOPS_LOCALIZATION_MODEL.rollout_stages.length >= 4);
  assert.ok(FINAL_FRAUD_RISK_MODEL.review_queues.length >= 5);
  assert.ok(FINAL_BUILD_ORDER.length >= 10);
  assert.ok(FINAL_DEPENDENCY_MAP.length >= 8);
  assert.ok(FINAL_RISK_REGISTER.length >= 8);
  assert.ok(ENGINEERING_HANDOFF_CHECKLIST.length >= 18);
});

test("final architecture locks one route grammar, one analytics contract and one currency glossary", () => {
  assert.equal(FINAL_CANONICAL_ARCHITECTURE.canonical_navigation.grammar, "route_key plus optional panel_key plus optional focus_key");
  assert.equal(FINAL_CANONICAL_ARCHITECTURE.analytics_contract.event_name_convention, "family.object.verb");
  assert.equal(FINAL_CANONICAL_ARCHITECTURE.currencies.SC.name, "Soft Credits");
  assert.equal(FINAL_CANONICAL_ARCHITECTURE.currencies.RC.name, "Relic Credits");
  assert.equal(FINAL_CANONICAL_ARCHITECTURE.currencies.HC.name, "Hard Credits");
  assert.equal(FINAL_CANONICAL_ARCHITECTURE.currencies.NXT.chain, "TON");
  assert.equal(getGlossaryTerm("payout_available").term, "payout_available");
});

test("wallet, payout and state machine rules stay unified", () => {
  assert.ok(FINAL_WEB3_BOUNDARY_MAP.wallet_rules.includes("TON is the only primary wallet chain."));
  assert.ok(FINAL_WEB3_BOUNDARY_MAP.payout_rules.includes("No full-auto payout mode exists."));
  const payoutStateMachine = getStateMachine("payout_request");
  assert.ok(payoutStateMachine);
  assert.deepEqual(payoutStateMachine.states.slice(0, 4), ["draft", "requested", "risk_review", "approved"]);
  assert.ok(payoutStateMachine.states.includes("paid"));
  assert.ok(payoutStateMachine.states.includes("failed"));
});

test("chat command map resolves to unified miniapp destinations", () => {
  const play = getCommandSpec("play");
  const wallet = getCommandSpec("wallet");
  const payout = getCommandSpec("payout");
  const leaderboard = getCommandSpec("leaderboard");
  assert.equal(play.route_key, "hub");
  assert.equal(wallet.route_key, "exchange");
  assert.equal(wallet.panel_key, "wallet");
  assert.equal(payout.route_key, "vault");
  assert.equal(payout.panel_key, "payout");
  assert.equal(leaderboard.route_key, "season");
  assert.equal(leaderboard.panel_key, "leaderboard");
});

test("build order, dependency map and risk register stay concrete", () => {
  const first = getBuildStep(1);
  const risk = getRiskRegisterItem("wallet_verification_gap");
  assert.equal(first.team, "architecture_and_shared_contracts");
  assert.ok(first.deliverable.includes("canonical route"));
  assert.equal(risk.owner, "web3_backend");
  assert.match(risk.mitigation, /TON proof verification/i);
  assert.ok(FINAL_DEPENDENCY_MAP.some((item) => item.component === "wallet_proof_verifier"));
  assert.ok(FINAL_DEPENDENCY_MAP.some((item) => item.component === "next_shell_and_scene_bridge"));
});

test("qa and ship readiness keep global quality and trust gates explicit", () => {
  assert.ok(FINAL_QA_CHECKLIST.localization_and_live_ops.includes("TR and EN pass screenshot, overflow and trust-copy completeness checks."));
  assert.ok(FINAL_QA_CHECKLIST.web3_and_payout.includes("TON Connect proof verification passes real signature tests."));
  assert.ok(FINAL_SHIP_READINESS_CHECKLIST.web3_and_money.includes("No direct runtime custody path exists."));
  assert.ok(FINAL_SHIP_READINESS_CHECKLIST.ops_and_localization.includes("TR and EN are fully ready with support macros and payout templates."));
});
