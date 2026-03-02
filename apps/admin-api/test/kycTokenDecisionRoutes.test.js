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
      markPurchaseApproved: async () => ({}),
      markPurchaseRejected: async () => ({})
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
    payload: { uid: "100", ts: "1", sig: "x", request_id: 77, decision: "maybe" }
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
    payload: { uid: "100", ts: "1", sig: "bad", request_id: 9, tx_hash: "0xabc12345", token_amount: 10 }
  });
  assert.equal(res.statusCode, 401);
  const payload = JSON.parse(res.payload);
  assert.equal(payload.error, "invalid_sig");
  assert.equal(calls.length, 0);
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
    payload: { uid: "100", ts: "1", sig: "bad", request_id: 9, reason: "x" }
  });
  assert.equal(res.statusCode, 401);
  const payload = JSON.parse(res.payload);
  assert.equal(payload.error, "invalid_sig");
  assert.equal(calls.length, 0);
  await app.close();
});
