"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const { registerAdminTokenPolicyRoutes } = require("../src/routes/admin/tokenPolicyRoutes");

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
  const state = { featureFlagCalls: [] };
  return {
    state,
    deps: {
      pool: { connect: async () => createClientStub(calls) },
      parseAdminId: () => 77,
      configService: { getEconomyConfig: async () => ({ token: {} }) },
      tokenEngine: {
        normalizeTokenConfig: () => ({
          symbol: "NXT",
          payout_gate: { min_market_cap_usd: 20000000, target_band_max_usd: 25000000 }
        }),
        normalizeCurveState: () => ({
          adminFloorUsd: 0.1,
          curveBaseUsd: 0.2,
          curveK: 0.01,
          supplyNormDivisor: 1000,
          demandFactor: 1.1,
          volatilityDampen: 0.2,
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
        upsertTokenMarketState: async () => ({
          auto_policy_json: { enabled: true, auto_usd_limit: 10 },
          admin_floor_usd: 0.1,
          curve_base_usd: 0.2,
          curve_k: 0.01,
          supply_norm_divisor: 1000,
          demand_factor: 1.1,
          volatility_dampen: 0.2,
          updated_at: "2026-03-02T00:00:00.000Z"
        }),
        insertTreasuryPolicyHistory: async () => {},
        upsertTreasuryGuardrail: async () => {}
      },
      upsertFeatureFlag: async (_db, payload) => {
        state.featureFlagCalls.push(payload);
      },
      ...overrides
    }
  };
}

test("admin token auto-policy returns 503 when token tables are missing", async () => {
  const app = Fastify();
  const calls = [];
  const { deps } = buildDeps(calls, {
    tokenStore: {
      getTokenMarketState: async () => null,
      upsertTokenMarketState: async () => {
        const err = new Error("missing");
        err.code = "42P01";
        throw err;
      },
      insertTreasuryPolicyHistory: async () => {},
      upsertTreasuryGuardrail: async () => {}
    }
  });
  registerAdminTokenPolicyRoutes(app, deps);

  const res = await app.inject({
    method: "POST",
    url: "/admin/token/auto-policy",
    payload: { enabled: true, auto_usd_limit: 12 }
  });
  assert.equal(res.statusCode, 503);
  const payload = JSON.parse(res.payload);
  assert.equal(payload.error, "token_tables_missing");
  assert.ok(calls.some((sql) => sql.includes("ROLLBACK")));
  await app.close();
});

test("admin token auto-policy applies updates and optional feature flag", async () => {
  const app = Fastify();
  const calls = [];
  const { deps, state } = buildDeps(calls);
  registerAdminTokenPolicyRoutes(app, deps);

  const res = await app.inject({
    method: "POST",
    url: "/admin/token/auto-policy",
    payload: { enabled: false, auto_usd_limit: 15, risk_threshold: 0.2, velocity_per_hour: 14 }
  });
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(res.payload);
  assert.equal(payload.success, true);
  assert.equal(payload.data.token_symbol, "NXT");
  assert.ok(calls.some((sql) => sql.includes("COMMIT")));
  assert.equal(state.featureFlagCalls.length, 1);
  assert.equal(state.featureFlagCalls[0].flagKey, "TOKEN_AUTO_APPROVE_ENABLED");
  await app.close();
});

test("admin token curve applies curve updates and toggles curve flag", async () => {
  const app = Fastify();
  const calls = [];
  const { deps, state } = buildDeps(calls);
  registerAdminTokenPolicyRoutes(app, deps);

  const res = await app.inject({
    method: "POST",
    url: "/admin/token/curve",
    payload: {
      enabled: true,
      admin_floor_usd: 0.25,
      base_usd: 0.5,
      k: 0.02,
      supply_norm_divisor: 1200,
      demand_factor: 1.5,
      volatility_dampen: 0.4
    }
  });
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(res.payload);
  assert.equal(payload.success, true);
  assert.equal(payload.data.token_symbol, "NXT");
  assert.equal(state.featureFlagCalls.length, 1);
  assert.equal(state.featureFlagCalls[0].flagKey, "TOKEN_CURVE_ENABLED");
  assert.ok(calls.some((sql) => sql.includes("token_curve_update")));
  await app.close();
});
