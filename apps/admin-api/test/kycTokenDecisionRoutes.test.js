"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const { registerWebappAdminKycTokenDecisionRoutes } = require("../src/routes/webapp/admin/kycTokenDecisionRoutes");

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
    normalizeKycDecision: () => "approve",
    hasKycTables: async () => true,
    readKycProfile: async () => ({ user_id: 7, status: "pending", tier: "threshold_review", payload_json: {} }),
    listWalletLinks: async () => [],
    upsertKycProfile: async (_db, profile) => profile,
    insertKycScreeningEvent: async () => {},
    normalizeKycState: (profile) => profile,
    configService: { getEconomyConfig: async () => ({ token: {} }) },
    buildAdminSummary: async () => ({ ok: true }),
    tokenStore: {
      lockPurchaseRequest: async () => null,
      submitPurchaseTxHash: async () => {},
      markPurchaseApproved: async () => ({ id: 9, user_id: 77, status: "approved", chain: "eth", token_symbol: "NXT" }),
      markPurchaseRejected: async () => ({ id: 9, user_id: 77, status: "rejected", chain: "eth", token_symbol: "NXT" })
    },
    validateAndVerifyTokenTx: async () => ({
      ok: true,
      formatCheck: { normalizedHash: "0xabc12345", chain: "eth" },
      verify: { status: "confirmed", provider: "mock" }
    }),
    tokenEngine: {
      normalizeTokenConfig: () => ({ symbol: "NXT" })
    },
    economyStore: {
      creditCurrency: async () => {}
    },
    deterministicUuid: () => "uuid_1",
    ...overrides
  };
}

test("kyc decision rejects unsupported decision value", async () => {
  const app = Fastify();
  const calls = [];
  registerWebappAdminKycTokenDecisionRoutes(
    app,
    buildDeps(calls, {
      normalizeKycDecision: () => null
    })
  );

  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/admin/kyc/decision",
    payload: { uid: "100", ts: "1", sig: "x", request_id: 77, decision: "maybe", action_request_id: "act_kyc_77_1" }
  });
  assert.equal(res.statusCode, 400);
  const payload = JSON.parse(res.payload);
  assert.equal(payload.error, "invalid_kyc_decision");
  assert.equal(calls.length, 0);
  await app.close();
});

test("token approve rejects unauthorized admin signature", async () => {
  const app = Fastify();
  const calls = [];
  registerWebappAdminKycTokenDecisionRoutes(
    app,
    buildDeps(calls, {
      verifyWebAppAuth: () => ({ ok: false, reason: "invalid_sig" })
    })
  );

  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/admin/token/approve",
    payload: {
      uid: "100",
      ts: "1",
      sig: "bad",
      request_id: 9,
      tx_hash: "0xabc12345",
      token_amount: 10,
      action_request_id: "act_token_approve_9"
    }
  });
  assert.equal(res.statusCode, 401);
  const payload = JSON.parse(res.payload);
  assert.equal(payload.error, "invalid_sig");
  assert.equal(calls.length, 0);
  await app.close();
});

test("token approve sends trust notification after commit", async () => {
  const app = Fastify();
  const calls = [];
  const notifications = [];
  registerWebappAdminKycTokenDecisionRoutes(
    app,
    buildDeps(calls, {
      tokenStore: {
        lockPurchaseRequest: async () => ({
          user_id: 77,
          chain: "eth",
          status: "pending",
          token_amount: 10,
          tx_hash: "0xabc12345",
          token_symbol: "NXT",
          usd_amount: 15
        }),
        submitPurchaseTxHash: async () => {},
        markPurchaseApproved: async () => ({ id: 9, user_id: 77, status: "approved", chain: "eth", token_symbol: "NXT", tx_hash: "0xabc12345" }),
        markPurchaseRejected: async () => ({})
      },
      sendTrustNotification: async (payload) => {
        notifications.push(payload);
        return { sent: true };
      }
    })
  );

  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/admin/token/approve",
    payload: {
      uid: "100",
      ts: "1",
      sig: "x",
      request_id: 9,
      tx_hash: "0xabc12345",
      token_amount: 10,
      action_request_id: "act_token_approve_10"
    }
  });
  assert.equal(res.statusCode, 200);
  assert.ok(calls.some((sql) => sql.includes("COMMIT")));
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].kind, "token");
  assert.equal(notifications[0].decision, "approved");
  assert.equal(notifications[0].userId, 77);
  await app.close();
});

test("token reject rejects unauthorized admin signature", async () => {
  const app = Fastify();
  const calls = [];
  registerWebappAdminKycTokenDecisionRoutes(
    app,
    buildDeps(calls, {
      verifyWebAppAuth: () => ({ ok: false, reason: "invalid_sig" })
    })
  );

  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/admin/token/reject",
    payload: { uid: "100", ts: "1", sig: "bad", request_id: 9, reason: "x", action_request_id: "act_token_reject_9" }
  });
  assert.equal(res.statusCode, 401);
  const payload = JSON.parse(res.payload);
  assert.equal(payload.error, "invalid_sig");
  assert.equal(calls.length, 0);
  await app.close();
});

test("token reject sends trust notification after commit", async () => {
  const app = Fastify();
  const calls = [];
  const notifications = [];
  registerWebappAdminKycTokenDecisionRoutes(
    app,
    buildDeps(calls, {
      tokenStore: {
        lockPurchaseRequest: async () => ({
          id: 9,
          user_id: 77,
          chain: "eth",
          status: "pending",
          token_amount: 10,
          tx_hash: "0xabc12345",
          token_symbol: "NXT",
          usd_amount: 15
        }),
        submitPurchaseTxHash: async () => {},
        markPurchaseApproved: async () => ({}),
        markPurchaseRejected: async () => ({ id: 9, user_id: 77, status: "rejected", chain: "eth", token_symbol: "NXT" })
      },
      sendTrustNotification: async (payload) => {
        notifications.push(payload);
        return { sent: true };
      }
    })
  );

  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/admin/token/reject",
    payload: { uid: "100", ts: "1", sig: "x", request_id: 9, reason: "duplicate", action_request_id: "act_token_reject_10" }
  });
  assert.equal(res.statusCode, 200);
  assert.ok(calls.some((sql) => sql.includes("COMMIT")));
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].decision, "rejected");
  await app.close();
});
