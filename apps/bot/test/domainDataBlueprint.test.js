const test = require("node:test");
const assert = require("node:assert/strict");
const {
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
} = require("../src/architecture/domainDataBlueprint");

test("domain blueprint exposes required sections", () => {
  assert.ok(DOMAIN_MODEL_NON_NEGOTIABLES.length >= 7);
  assert.ok(DOMAIN_MODEL_REJECTED_ALTERNATIVES.length >= 5);
  assert.ok(DOMAIN_MODEL_IMPLEMENTATION_RISKS.length >= 5);
  assert.ok(DOMAIN_MODEL_MVP_SUBSET.identity.length >= 3);
  assert.ok(DOMAIN_MODEL_SCALE_READY_SUBSET.money.length >= 3);
  assert.ok(DOMAIN_MODEL_RESOLVED_QUESTIONS.length >= 5);
  assert.ok(DOMAIN_BOUNDED_CONTEXTS.length >= 14);
  assert.ok(CANONICAL_SCHEMA_STRATEGY.append_only_tables.length >= 8);
  assert.ok(CANONICAL_TABLE_REGISTRY.length >= 50);
  assert.ok(STATE_MACHINE_CATALOG.length >= 10);
  assert.equal(ANALYTICS_TAXONOMY.event_name_convention, "family.object.verb");
  assert.ok(API_BOUNDARIES.length >= 5);
  assert.ok(REDIS_STRATEGY.length >= 8);
  assert.ok(DATA_LIFECYCLE_POLICY.length >= 8);
  assert.ok(ENGINEERING_HANDOFF_CHECKLIST.length >= 15);
});

test("core contexts and tables are locked", () => {
  assert.ok(getBoundedContext("identity"));
  assert.ok(getBoundedContext("wallet_web3"));
  assert.ok(getBoundedContext("payouts"));
  assert.ok(getBoundedContext("content_localization"));
  assert.ok(getTableSpec("users"));
  assert.ok(getTableSpec("currency_ledger"));
  assert.ok(getTableSpec("payout_requests"));
  assert.ok(getTableSpec("v5_wallet_links"));
  assert.ok(getTableSpec("v5_wallet_challenges"));
  assert.ok(getTableSpec("v5_webapp_ui_events"));
  assert.ok(getTableSpec("v5_unified_admin_queue_action_events"));
  assert.ok(getTableSpec("v5_monetization_ledger"));
});

test("state machines cover explicit critical workflows", () => {
  assert.ok(getStateMachine("user_lifecycle"));
  assert.ok(getStateMachine("wallet_link"));
  assert.ok(getStateMachine("mission_assignment"));
  assert.ok(getStateMachine("payout_request"));
  assert.ok(getStateMachine("payout_batch"));
  assert.ok(getStateMachine("fraud_case"));
  assert.ok(getStateMachine("content_publish"));
  assert.ok(getStateMachine("notification_delivery"));
});

test("schema strategy preserves append-only and redis boundaries", () => {
  assert.ok(CANONICAL_SCHEMA_STRATEGY.append_only_tables.includes("currency_ledger"));
  assert.ok(CANONICAL_SCHEMA_STRATEGY.append_only_tables.includes("v5_webapp_ui_events"));
  const joined = DOMAIN_MODEL_NON_NEGOTIABLES.join(" ");
  assert.match(joined, /Redis may cache/i);
  assert.match(joined, /append-only/i);
  assert.match(joined, /Wallet identity is unambiguous/i);
});

test("handoff checklist keeps critical migration and audit rules explicit", () => {
  const joined = ENGINEERING_HANDOFF_CHECKLIST.join(" ");
  assert.match(joined, /currency_ledger as authoritative/i);
  assert.match(joined, /ledger_holds/i);
  assert.match(joined, /action_request_id/i);
  assert.match(joined, /compensating ledger entries/i);
  assert.match(joined, /Partition raw analytics tables by month/i);
});
