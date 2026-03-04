"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const { registerWebappAdminTokenRoutes } = require("../src/routes/webapp/admin/tokenAdminRoutes");

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
    patchTokenRuntimeConfig: async () => ({ version: 1 }),
    configService: { getEconomyConfig: async () => ({ token: {} }) },
    tokenEngine: {
      normalizeTokenConfig: () => ({ symbol: "NXT", payout_gate: { min_market_cap_usd: 0, target_band_max_usd: 0 } }),
      normalizeCurveState: () => ({
        adminFloorUsd: 1,
        curveBaseUsd: 1,
        curveK: 0,
        supplyNormDivisor: 1,
        demandFactor: 1,
        volatilityDampen: 0,
        autoPolicy: {
          enabled: true,
          autoUsdLimit: 10,
          riskThreshold: 0.35,
          velocityPerHour: 8,
          requireOnchainVerified: false
        }
      })
    },
    tokenStore: {
      getTokenMarketState: async () => null,
      upsertTokenMarketState: async () => {},
      insertTreasuryPolicyHistory: async () => {},
      upsertTreasuryGuardrail: async () => {}
    },
    upsertFeatureFlag: async () => {},
    buildAdminSummary: async () => ({ ok: true }),
    ...overrides
  };
}

test("token config rejects empty patch", async () => {
  const app = Fastify();
  const calls = [];
  registerWebappAdminTokenRoutes(app, buildDeps(calls));

  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/admin/token/config",
    payload: { uid: "100", ts: "1", sig: "x", action_request_id: "act_token_cfg_1" }
  });
  assert.equal(res.statusCode, 400);
  const payload = JSON.parse(res.payload);
  assert.equal(payload.error, "no_patch_fields");
  await app.close();
});

test("token config rejects invalid market cap band", async () => {
  const app = Fastify();
  const calls = [];
  registerWebappAdminTokenRoutes(app, buildDeps(calls));

  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/admin/token/config",
    payload: {
      uid: "100",
      ts: "1",
      sig: "x",
      action_request_id: "act_token_cfg_2",
      min_market_cap_usd: 500,
      target_band_max_usd: 100
    }
  });
  assert.equal(res.statusCode, 400);
  const payload = JSON.parse(res.payload);
  assert.equal(payload.error, "invalid_gate_band");
  await app.close();
});

test("token config applies patch and returns summary", async () => {
  const app = Fastify();
  const calls = [];
  const seen = { patch: null };
  registerWebappAdminTokenRoutes(
    app,
    buildDeps(calls, {
      patchTokenRuntimeConfig: async (_db, _uid, patch) => {
        seen.patch = patch;
        return { version: 3 };
      },
      buildAdminSummary: async () => ({ token: { ok: true } })
    })
  );

  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/admin/token/config",
    payload: {
      uid: "100",
      ts: "1",
      sig: "x",
      action_request_id: "act_token_cfg_3",
      usd_price: 0.25,
      min_market_cap_usd: 20000000,
      target_band_max_usd: 25000000
    }
  });
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(res.payload);
  assert.equal(payload.success, true);
  assert.deepEqual(seen.patch, {
    usd_price: 0.25,
    min_market_cap_usd: 20000000,
    target_band_max_usd: 25000000
  });
  assert.ok(calls.some((sql) => sql.includes("BEGIN")));
  assert.ok(calls.some((sql) => sql.includes("COMMIT")));
  await app.close();
});
