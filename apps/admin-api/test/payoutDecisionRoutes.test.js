"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const { registerWebappAdminPayoutDecisionRoutes } = require("../src/routes/webapp/admin/payoutDecisionRoutes");

function createClientStub(calls) {
  return {
    async query(sql) {
      calls.push(String(sql));
      return { rows: [] };
    },
    release() {}
  };
}

function buildDeps(calls, overrides = {}) {
  return {
    pool: { connect: async () => createClientStub(calls) },
    verifyWebAppAuth: () => ({ ok: true, uid: 100 }),
    issueWebAppSession: () => ({ uid: "100", ts: "1", sig: "x" }),
    requireWebAppAdmin: async () => ({ user_id: 1 }),
    payoutStore: {
      markPaid: async () => ({ status: "paid", request: { id: 9, user_id: 77 } }),
      markRejected: async () => ({ status: "rejected", request: { id: 9, user_id: 77 } })
    },
    configService: { getEconomyConfig: async () => ({}) },
    buildAdminSummary: async () => ({ ok: true }),
    ...overrides
  };
}

test("payout pay rejects unauthorized admin signature", async () => {
  const app = Fastify();
  const calls = [];
  registerWebappAdminPayoutDecisionRoutes(
    app,
    buildDeps(calls, {
      verifyWebAppAuth: () => ({ ok: false, reason: "invalid_sig" })
    })
  );

  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/admin/payout/pay",
    payload: { uid: "100", ts: "1", sig: "bad", request_id: 9, tx_hash: "0xabc12345", action_request_id: "act_100_pay_1" }
  });
  assert.equal(res.statusCode, 401);
  const payload = JSON.parse(res.payload);
  assert.equal(payload.error, "invalid_sig");
  assert.equal(calls.length, 0);
  await app.close();
});

test("payout pay returns not found when request is missing", async () => {
  const app = Fastify();
  const calls = [];
  registerWebappAdminPayoutDecisionRoutes(
    app,
    buildDeps(calls, {
      payoutStore: {
        markPaid: async () => ({ status: "not_found" }),
        markRejected: async () => ({ status: "rejected", request: {} })
      }
    })
  );

  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/admin/payout/pay",
    payload: { uid: "100", ts: "1", sig: "x", request_id: 999, tx_hash: "0xabc12345", action_request_id: "act_100_pay_2" }
  });
  assert.equal(res.statusCode, 404);
  const payload = JSON.parse(res.payload);
  assert.equal(payload.error, "not_found");
  assert.ok(calls.some((sql) => sql.includes("BEGIN")));
  assert.ok(calls.some((sql) => sql.includes("ROLLBACK")));
  await app.close();
});

test("payout pay sends trust notification after commit", async () => {
  const app = Fastify();
  const calls = [];
  const notifications = [];
  registerWebappAdminPayoutDecisionRoutes(
    app,
    buildDeps(calls, {
      sendTrustNotification: async (payload) => {
        notifications.push(payload);
        return { sent: true };
      }
    })
  );

  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/admin/payout/pay",
    payload: { uid: "100", ts: "1", sig: "x", request_id: 9, tx_hash: "0xabc12345", action_request_id: "act_100_pay_3" }
  });
  assert.equal(res.statusCode, 200);
  assert.ok(calls.some((sql) => sql.includes("COMMIT")));
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].kind, "payout");
  assert.equal(notifications[0].decision, "paid");
  assert.equal(notifications[0].userId, 77);
  await app.close();
});

test("payout reject updates request and returns summary", async () => {
  const app = Fastify();
  const calls = [];
  const notifications = [];
  registerWebappAdminPayoutDecisionRoutes(
    app,
    buildDeps(calls, {
      sendTrustNotification: async (payload) => {
        notifications.push(payload);
        return { sent: true };
      }
    })
  );

  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/admin/payout/reject",
    payload: { uid: "100", ts: "1", sig: "x", request_id: 9, action_request_id: "act_100_reject_1", reason: "duplicate" }
  });
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(res.payload);
  assert.equal(payload.success, true);
  assert.ok(calls.some((sql) => sql.includes("COMMIT")));
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].decision, "rejected");
  await app.close();
});
