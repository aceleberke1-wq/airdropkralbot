const test = require("node:test");
const assert = require("node:assert/strict");
const {
  evaluateAdminPolicy,
  buildAdminActionSignature
} = require("../../../packages/shared/src/v5/adminPolicyEngine");

test("evaluateAdminPolicy marks critical actions with confirmation and cooldown", () => {
  const policy = evaluateAdminPolicy({ action_key: "payout_pay" });
  assert.equal(policy.critical, true);
  assert.equal(policy.confirmation_required, true);
  assert.ok(policy.cooldown_ms >= 1000);
});

test("buildAdminActionSignature is deterministic", () => {
  const a = buildAdminActionSignature("freeze_on", { reason: "risk" });
  const b = buildAdminActionSignature("freeze_on", { reason: "risk" });
  assert.equal(a, b);
});
