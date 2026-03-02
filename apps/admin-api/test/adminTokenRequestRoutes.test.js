"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const { registerAdminTokenRequestRoutes } = require("../src/routes/admin/tokenRequestRoutes");

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
    tokenStore: {
      listPurchaseRequests: async () => [],
      lockPurchaseRequest: async () => ({
        user_id: 5,
        chain: "eth",
        status: "pending",
        token_amount: 10,
        tx_hash: "0xabc12345",
        token_symbol: "NXT",
        usd_amount: 100
      }),
      submitPurchaseTxHash: async () => {},
      markPurchaseApproved: async () => ({ id: 1, status: "approved" }),
      markPurchaseRejected: async () => ({ id: 1, status: "rejected" })
    },
    parseLimit: () => 50,
    parseAdminId: () => 12,
    validateAndVerifyTokenTx: async () => ({
      ok: true,
      formatCheck: { normalizedHash: "0xabc12345", chain: "eth" },
      verify: { status: "confirmed", provider: "mock" }
    }),
    configService: { getEconomyConfig: async () => ({ token: {} }) },
    tokenEngine: { normalizeTokenConfig: () => ({ symbol: "NXT" }) },
    economyStore: { creditCurrency: async () => {} },
    deterministicUuid: () => "uuid_1",
    ...overrides
  };
}

test("admin token requests list returns 503 when token tables are missing", async () => {
  const app = Fastify();
  const calls = [];
  registerAdminTokenRequestRoutes(
    app,
    buildDeps(calls, {
      tokenStore: {
        listPurchaseRequests: async () => {
          const err = new Error("missing");
          err.code = "42P01";
          throw err;
        },
        lockPurchaseRequest: async () => null
      }
    })
  );

  const res = await app.inject({ method: "GET", url: "/admin/token/requests?status=pending&limit=20" });
  assert.equal(res.statusCode, 503);
  const payload = JSON.parse(res.payload);
  assert.equal(payload.error, "token_tables_missing");
  assert.equal(calls.length, 0);
  await app.close();
});

test("admin token approve rejects invalid id", async () => {
  const app = Fastify();
  const calls = [];
  registerAdminTokenRequestRoutes(app, buildDeps(calls));

  const res = await app.inject({
    method: "POST",
    url: "/admin/token/requests/0/approve",
    payload: { token_amount: 1, tx_hash: "0xabc12345" }
  });
  assert.equal(res.statusCode, 400);
  const payload = JSON.parse(res.payload);
  assert.equal(payload.error, "invalid_id");
  assert.equal(calls.length, 0);
  await app.close();
});

test("admin token approve returns not_found when request cannot be locked", async () => {
  const app = Fastify();
  const calls = [];
  registerAdminTokenRequestRoutes(
    app,
    buildDeps(calls, {
      tokenStore: {
        listPurchaseRequests: async () => [],
        lockPurchaseRequest: async () => null,
        submitPurchaseTxHash: async () => {},
        markPurchaseApproved: async () => ({}),
        markPurchaseRejected: async () => ({})
      }
    })
  );

  const res = await app.inject({
    method: "POST",
    url: "/admin/token/requests/8/approve",
    payload: { token_amount: 1, tx_hash: "0xabc12345" }
  });
  assert.equal(res.statusCode, 404);
  const payload = JSON.parse(res.payload);
  assert.equal(payload.error, "not_found");
  assert.ok(calls.some((sql) => sql.includes("BEGIN")));
  assert.ok(calls.some((sql) => sql.includes("ROLLBACK")));
  await app.close();
});

test("admin token reject blocks already approved requests", async () => {
  const app = Fastify();
  const calls = [];
  registerAdminTokenRequestRoutes(
    app,
    buildDeps(calls, {
      tokenStore: {
        listPurchaseRequests: async () => [],
        lockPurchaseRequest: async () => ({ status: "approved" }),
        submitPurchaseTxHash: async () => {},
        markPurchaseApproved: async () => ({}),
        markPurchaseRejected: async () => ({})
      }
    })
  );

  const res = await app.inject({
    method: "POST",
    url: "/admin/token/requests/9/reject",
    payload: { reason: "already processed" }
  });
  assert.equal(res.statusCode, 409);
  const payload = JSON.parse(res.payload);
  assert.equal(payload.error, "already_approved");
  await app.close();
});
