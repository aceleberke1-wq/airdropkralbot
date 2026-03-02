"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { createCriticalAdminPolicyService } = require("../src/services/policy/criticalAdminPolicyService");
const { evaluateAdminPolicy, buildAdminActionSignature } = require("../../../packages/shared/src/v5/adminPolicyEngine");

function createPoolStub() {
  return {
    query: async () => ({ rows: [] })
  };
}

test("critical policy requires confirm token and then accepts it", async () => {
  const service = createCriticalAdminPolicyService({
    pool: createPoolStub(),
    crypto,
    evaluateAdminPolicy,
    buildAdminPolicySignature: buildAdminActionSignature,
    hasTable: async () => false,
    adminConfirmTtlMs: 90000,
    adminCooldownMs: 2000
  });

  const first = await service.requireCriticalAdminConfirmation({
    actionKey: "freeze_on",
    adminId: 42,
    payload: { freeze: true },
    confirmToken: ""
  });
  assert.equal(first.ok, false);
  assert.equal(first.error, "admin_confirmation_required");
  assert.ok(first.signature);

  const second = await service.requireCriticalAdminConfirmation({
    actionKey: "freeze_on",
    adminId: 42,
    payload: { freeze: true },
    confirmToken: first.signature
  });
  assert.equal(second.ok, true);
  assert.equal(second.signature, first.signature);
});

test("critical policy cooldown blocks rapid repeats", async () => {
  const service = createCriticalAdminPolicyService({
    pool: createPoolStub(),
    crypto,
    evaluateAdminPolicy,
    buildAdminPolicySignature: buildAdminActionSignature,
    hasTable: async () => false,
    adminConfirmTtlMs: 90000,
    adminCooldownMs: 5000
  });

  const first = await service.enforceCriticalAdminCooldown({
    actionKey: "queue_payout_pay",
    adminId: 11
  });
  assert.equal(first.ok, true);

  const second = await service.enforceCriticalAdminCooldown({
    actionKey: "queue_payout_pay",
    adminId: 11
  });
  assert.equal(second.ok, false);
  assert.ok(Number(second.wait_sec) >= 1);
});

test("queue idempotency key is deterministic", () => {
  const service = createCriticalAdminPolicyService({
    pool: createPoolStub(),
    crypto,
    evaluateAdminPolicy,
    buildAdminPolicySignature: buildAdminActionSignature,
    hasTable: async () => false
  });
  const a = service.buildQueueActionIdempotencyKey({
    uid: 1,
    actionKey: "payout_pay",
    kind: "payout_request",
    requestId: 99,
    confirmToken: "token_x",
    reason: "ok",
    txHash: "0xabc"
  });
  const b = service.buildQueueActionIdempotencyKey({
    uid: 1,
    actionKey: "payout_pay",
    kind: "payout_request",
    requestId: 99,
    confirmToken: "token_x",
    reason: "ok",
    txHash: "0xabc"
  });
  assert.equal(a, b);
  assert.ok(String(a).startsWith("uqa_"));
});
