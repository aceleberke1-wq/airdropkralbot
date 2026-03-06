"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const { registerWebappV2AdminTokenDynamicPolicyRoutes } = require("../src/routes/webapp/v2/adminTokenDynamicPolicyRoutes");
const { DynamicAutoPolicySchema } = require("../../../packages/shared/src/contracts/v2");

function createHarness() {
  const client = {
    async query(sql, params = []) {
      const text = String(sql || "");
      if (/FROM v5_token_auto_policy_dynamic/.test(text) && /ORDER BY priority/.test(text)) {
        return { rows: [] };
      }
      if (/INSERT INTO v5_token_auto_policy_dynamic\s*\(/.test(text)) {
        return {
          rows: [
            {
              token_symbol: String(params[0] || "NXT"),
              segment_key: String(params[1] || "s1_normal"),
              priority: Number(params[2] || 20),
              max_auto_usd: Number(params[3] || 20),
              risk_threshold: Number(params[4] || 0.28),
              velocity_per_hour: Number(params[5] || 8),
              require_onchain_verified: Boolean(params[6] !== false),
              require_kyc_status: String(params[7] || ""),
              enabled: Boolean(params[8] !== false),
              degrade_factor: Number(params[9] || 1),
              meta_json: {},
              updated_by: Number(params[11] || 0),
              updated_at: new Date().toISOString()
            }
          ]
        };
      }
      if (/SELECT .* FROM token_auto_decisions/.test(text) || /FROM v5_payout_dispute_events/.test(text)) {
        return { rows: [{ total_24h: 0, non_auto_24h: 0, manual_review_24h: 0, disputes_24h: 0 }] };
      }
      return { rows: [] };
    },
    async release() {}
  };

  const app = Fastify({ logger: false });
  registerWebappV2AdminTokenDynamicPolicyRoutes(app, {
    pool: {
      async connect() {
        return client;
      }
    },
    verifyWebAppAuth: () => ({ ok: true, uid: 7001 }),
    issueWebAppSession: () => ({ uid: "7001", ts: "1", sig: "ok" }),
    requireWebAppAdmin: async () => ({ user_id: 99 }),
    loadFeatureFlags: async () => ({ TOKEN_AUTO_APPROVE_ENABLED: true }),
    isFeatureEnabled: (flags, key) => Boolean(flags?.[key]),
    configService: {
      async getEconomyConfig() {
        return {};
      }
    },
    tokenEngine: {
      normalizeTokenConfig() {
        return { symbol: "NXT" };
      },
      normalizeCurveState() {
        return {
          autoPolicy: {
            enabled: true,
            autoUsdLimit: 10,
            riskThreshold: 0.35,
            velocityPerHour: 8,
            requireOnchainVerified: true
          }
        };
      }
    },
    tokenStore: {
      async getTokenMarketState() {
        return null;
      },
      async getTreasuryGuardrail() {
        return null;
      }
    }
  });
  return app;
}

test("v2 dynamic auto policy GET returns base policy and segments", async () => {
  const app = createHarness();
  await app.ready();
  const res = await app.inject({
    method: "GET",
    url: "/webapp/api/v2/admin/token/auto-policy/dynamic?uid=7001&ts=1&sig=sig"
  });
  assert.equal(res.statusCode, 200);
  const payload = res.json();
  assert.equal(payload.success, true);
  assert.equal(payload.data.api_version, "v2");
  assert.equal(payload.data.token_symbol, "NXT");
  assert.ok(Array.isArray(payload.data.segments));
  const contractData = DynamicAutoPolicySchema.parse(payload.data);
  assert.equal(contractData.api_version, "v2");
  await app.close();
});

test("v2 dynamic auto policy POST rejects empty segments", async () => {
  const app = createHarness();
  await app.ready();
  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/admin/token/auto-policy/dynamic",
    payload: {
      uid: "7001",
      ts: "1",
      sig: "sig",
      segments: []
    }
  });
  assert.equal(res.statusCode, 400);
  await app.close();
});

test("v2 dynamic auto policy POST stores segment payload", async () => {
  const app = createHarness();
  await app.ready();
  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/admin/token/auto-policy/dynamic",
    payload: {
      uid: "7001",
      ts: "1",
      sig: "sig",
      segments: [
        {
          segment_key: "s1_normal",
          priority: 20,
          max_auto_usd: 16,
          risk_threshold: 0.3,
          velocity_per_hour: 8,
          enabled: true
        }
      ]
    }
  });
  assert.equal(res.statusCode, 200);
  const payload = res.json();
  assert.equal(payload.success, true);
  assert.equal(payload.data.api_version, "v2");
  assert.ok(Array.isArray(payload.data.segments));
  const contractData = DynamicAutoPolicySchema.parse(payload.data);
  assert.equal(contractData.api_version, "v2");
  assert.equal(contractData.token_symbol, "NXT");
  await app.close();
});

test("v2 dynamic auto policy GET preview returns selected segment decision", async () => {
  const app = createHarness();
  await app.ready();
  const res = await app.inject({
    method: "GET",
    url: "/webapp/api/v2/admin/token/auto-policy/dynamic?uid=7001&ts=1&sig=sig&risk_score=0.65&velocity_per_hour=14&usd_amount=120&kyc_status=verified"
  });
  assert.equal(res.statusCode, 200);
  const payload = res.json();
  assert.equal(payload.success, true);
  const preview = payload.data.preview || {};
  assert.equal(String(preview.selected_segment_key || ""), "s2_watch");
  assert.equal(Boolean(preview.policy?.enabled), true);
  await app.close();
});
