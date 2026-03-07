"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const { registerWebappAdminPayoutReleaseRoutes } = require("../src/routes/webapp/admin/payoutReleaseRoutes");

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
    parseLimit: (value, fallback) => Number(value || fallback || 25),
    configService: { getEconomyConfig: async () => ({}) },
    patchPayoutReleaseRuntimeConfig: async () => ({}),
    upsertFeatureFlag: async () => ({}),
    tokenEngine: { normalizeTokenConfig: () => ({ symbol: "NXT" }) },
    buildAdminSummary: async () => ({ ok: true }),
    payoutStore: {
      listRequests: async () => [{ id: 9, user_id: 77, amount: 0.0003 }],
      markRejected: async () => ({ status: "rejected", request: { id: 9, user_id: 77, currency: "BTC", amount: 0.0003, status: "rejected" } })
    },
    getProfileByUserId: async () => ({ user_id: 77, telegram_id: 777, locale: "tr" }),
    economyStore: { getBalances: async () => ({}) },
    buildTokenSummary: async () => ({ symbol: "NXT" }),
    buildPayoutLockState: async () => ({
      release: {
        enabled: true,
        global_gate_open: false,
        unlock_tier: "T0",
        today_drip_btc_remaining: 0
      }
    }),
    policyService: {
      requireCriticalAdminConfirmation: async () => ({ ok: true }),
      enforceCriticalAdminCooldown: async () => ({ ok: true })
    },
    proxyWebAppApiV1: async () => ({ success: true }),
    adminCriticalCooldownMs: 8000,
    ...overrides
  };
}

test("payout release run sends trust notification for auto-rejected requests", async () => {
  const app = Fastify();
  const calls = [];
  const notifications = [];
  registerWebappAdminPayoutReleaseRoutes(
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
    url: "/webapp/api/admin/payout/release/run",
    payload: {
      uid: "100",
      ts: "1",
      sig: "x",
      limit: 10,
      apply_rejections: true,
      action_request_id: "act_release_1",
      confirm_token: "abcdefghijklmnop"
    }
  });

  assert.equal(res.statusCode, 200);
  assert.ok(calls.some((sql) => sql.includes("COMMIT")));
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].kind, "payout");
  assert.equal(notifications[0].decision, "rejected");
  assert.equal(notifications[0].reason, "release_run_market_cap_gate");
  await app.close();
});
