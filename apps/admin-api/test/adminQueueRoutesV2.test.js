"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const { registerWebappV2AdminQueueRoutes } = require("../src/routes/webapp/v2/adminQueueRoutes");

function createPoolStub() {
  return {
    connect: async () => ({
      async query() {
        return { rows: [] };
      },
      release() {}
    })
  };
}

function buildDeps(overrides = {}) {
  return {
    pool: createPoolStub(),
    proxyWebAppApiV1: async (_request, reply) => {
      reply.send({ success: true, data: {} });
    },
    verifyWebAppAuth: () => ({ ok: true, uid: 7001 }),
    issueWebAppSession: (uid) => ({ uid: String(uid), ts: "1", sig: "sig" }),
    getProfileByTelegram: async () => ({ user_id: 91 }),
    policyService: {
      requireCriticalAdminConfirmation: async () => ({
        ok: true,
        policy: { action_key: "queue_payout_pay", cooldown_ms: 8000 }
      }),
      enforceCriticalAdminCooldown: async () => ({
        ok: true,
        policy: { action_key: "queue_payout_pay", cooldown_ms: 8000 }
      }),
      buildQueueActionIdempotencyKey: () => "uqa_test_key",
      buildQueueActionPayloadHash: () => "payload_hash_default"
    },
    ...overrides
  };
}

test("v2 queue action rejects payload without action_request_id", async () => {
  const app = Fastify();
  registerWebappV2AdminQueueRoutes(app, buildDeps());
  app.post("/webapp/api/admin/payout/pay", async () => ({ success: true, data: { ok: true } }));

  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/admin/queue/action",
    payload: {
      uid: "7001",
      ts: "1",
      sig: "sig",
      action_key: "payout_pay",
      kind: "payout_request",
      request_id: 44,
      tx_hash: "0xabc12345"
    }
  });
  assert.equal(res.statusCode, 400);
  const payload = JSON.parse(res.payload);
  assert.match(String(payload.message || payload.error || ""), /action_request_id/i);
  await app.close();
});

test("v2 queue action includes action_request_id in idempotency context and response", async () => {
  const buildCalls = [];
  const app = Fastify();
  registerWebappV2AdminQueueRoutes(
    app,
    buildDeps({
      policyService: {
        requireCriticalAdminConfirmation: async () => ({
          ok: true,
          policy: { action_key: "queue_payout_pay", cooldown_ms: 8000 }
        }),
        enforceCriticalAdminCooldown: async () => ({
          ok: true,
          policy: { action_key: "queue_payout_pay", cooldown_ms: 8000 }
        }),
        buildQueueActionIdempotencyKey: (input) => {
          buildCalls.push({ ...input });
          return "uqa_test_key";
        }
      }
    })
  );
  app.post("/webapp/api/admin/payout/pay", async () => ({
    success: true,
    data: { decision: "paid" }
  }));

  const actionRequestId = "admin_action_44_ab12";
  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/admin/queue/action",
    payload: {
      uid: "7001",
      ts: "1",
      sig: "sig",
      action_key: "payout_pay",
      kind: "payout_request",
      request_id: 44,
      action_request_id: actionRequestId,
      tx_hash: "0xabc12345"
    }
  });
  assert.equal(res.statusCode, 200);
  assert.equal(buildCalls.length, 1);
  assert.equal(buildCalls[0].actionRequestId, actionRequestId);
  const payload = JSON.parse(res.payload);
  assert.equal(payload.success, true);
  assert.equal(payload.data.action_request_id, actionRequestId);
  await app.close();
});

test("v2 queue action returns payload conflict when same action_request_id is reused with different payload", async () => {
  const app = Fastify();
  registerWebappV2AdminQueueRoutes(
    app,
    buildDeps({
      pool: {
        connect: async () => ({
          async query(sql) {
            const text = String(sql || "");
            if (text.includes("INSERT INTO v5_unified_admin_queue_action_events")) {
              const err = new Error("duplicate");
              err.code = "23505";
              throw err;
            }
            if (text.includes("SELECT payload_json")) {
              return {
                rows: [
                  {
                    payload_json: {
                      payload_hash: "payload_hash_existing"
                    }
                  }
                ]
              };
            }
            return { rows: [] };
          },
          release() {}
        })
      },
      policyService: {
        requireCriticalAdminConfirmation: async () => ({
          ok: true,
          policy: { action_key: "queue_payout_pay", cooldown_ms: 8000 }
        }),
        enforceCriticalAdminCooldown: async () => ({
          ok: true,
          policy: { action_key: "queue_payout_pay", cooldown_ms: 8000 }
        }),
        buildQueueActionIdempotencyKey: () => "uqa_test_conflict_key",
        buildQueueActionPayloadHash: () => "payload_hash_new"
      }
    })
  );
  app.post("/webapp/api/admin/payout/pay", async () => ({ success: true, data: { decision: "paid" } }));

  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/admin/queue/action",
    payload: {
      uid: "7001",
      ts: "1",
      sig: "sig",
      action_key: "payout_pay",
      kind: "payout_request",
      request_id: 44,
      action_request_id: "admin_action_conflict_44",
      tx_hash: "0xabc12345"
    }
  });
  assert.equal(res.statusCode, 409);
  const payload = JSON.parse(res.payload);
  assert.equal(payload.error, "action_request_payload_conflict");
  await app.close();
});
