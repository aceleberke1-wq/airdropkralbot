"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const { registerWebappAdminFreezeRoutes } = require("../src/routes/webapp/admin/freezeRoutes");

function createClientStub(calls) {
  return {
    async query(sql) {
      calls.push(String(sql));
      return { rows: [] };
    },
    release() {}
  };
}

test("freeze route returns confirmation required when token missing", async () => {
  const app = Fastify();
  const calls = [];
  const policyService = {
    requireCriticalAdminConfirmation: async () => ({
      ok: false,
      error: "admin_confirmation_required",
      signature: "confirm_sig_1234567890",
      expires_in_sec: 90,
      policy: { action_key: "system_freeze_on", cooldown_ms: 8000 }
    }),
    enforceCriticalAdminCooldown: async () => ({ ok: true, policy: { action_key: "system_freeze_on", cooldown_ms: 8000 } })
  };

  registerWebappAdminFreezeRoutes(app, {
    pool: {
      connect: async () => createClientStub(calls)
    },
    verifyWebAppAuth: () => ({ ok: true, uid: 100 }),
    issueWebAppSession: () => ({ uid: "100", ts: "1", sig: "x" }),
    requireWebAppAdmin: async () => ({ user_id: 1 }),
    configService: { getEconomyConfig: async () => ({}) },
    buildAdminSummary: async () => ({ ok: true }),
    policyService
  });

  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/admin/freeze",
    payload: { uid: "100", ts: "1", sig: "x", freeze: true, action_request_id: "act_freeze_on_1" }
  });
  assert.equal(res.statusCode, 409);
  const payload = JSON.parse(res.payload);
  assert.equal(payload.success, false);
  assert.equal(payload.error, "admin_confirmation_required");
  assert.equal(payload.data.confirmation_required, true);
  assert.ok(payload.data.confirm_token);
  await app.close();
});

test("freeze route applies state update after confirmation and cooldown checks", async () => {
  const app = Fastify();
  const calls = [];
  const policyService = {
    requireCriticalAdminConfirmation: async () => ({
      ok: true,
      signature: "confirm_sig_token_ok_12345",
      expires_in_sec: 0,
      policy: { action_key: "system_freeze_off", cooldown_ms: 8000 }
    }),
    enforceCriticalAdminCooldown: async () => ({
      ok: true,
      wait_sec: 0,
      policy: { action_key: "system_freeze_off", cooldown_ms: 8000 }
    })
  };

  registerWebappAdminFreezeRoutes(app, {
    pool: {
      connect: async () => createClientStub(calls)
    },
    verifyWebAppAuth: () => ({ ok: true, uid: 100 }),
    issueWebAppSession: () => ({ uid: "100", ts: "1", sig: "x" }),
    requireWebAppAdmin: async () => ({ user_id: 1 }),
    configService: { getEconomyConfig: async () => ({}) },
    buildAdminSummary: async () => ({ summary: "ok" }),
    policyService
  });

  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/admin/freeze",
    payload: {
      uid: "100",
      ts: "1",
      sig: "x",
      freeze: false,
      confirm_token: "confirm_sig_token_ok_12345",
      action_request_id: "act_freeze_off_1",
      reason: "test"
    }
  });
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(res.payload);
  assert.equal(payload.success, true);
  assert.ok(calls.some((sql) => sql.includes("INSERT INTO system_state")));
  assert.ok(calls.some((sql) => sql.includes("INSERT INTO admin_audit")));
  await app.close();
});
