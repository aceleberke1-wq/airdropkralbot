"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const { registerWebappV2TokenRoutes } = require("../src/routes/webapp/v2/tokenRoutes");

function createApp(deps = {}) {
  const app = Fastify();
  registerWebappV2TokenRoutes(app, {
    proxyWebAppApiV1: async (_request, reply) => {
      reply.send({ success: true, data: {} });
    },
    pool: {
      async connect() {
        return {
          async query() {
            return { rows: [] };
          },
          release() {}
        };
      }
    },
    verifyWebAppAuth: () => ({ ok: true, uid: 7001 }),
    requireWebAppAdmin: async () => ({ user_id: 91 }),
    ...deps
  });
  return app;
}

test("v2 token buy-intent maps action_request_id into request_id", async () => {
  const app = Fastify();
  let capturedBody = null;
  registerWebappV2TokenRoutes(app, {
    proxyWebAppApiV1: async (request, reply) => {
      capturedBody = request.body;
      reply.send({ success: true, data: {} });
    },
    pool: {
      async connect() {
        return {
          async query() {
            return { rows: [] };
          },
          release() {}
        };
      }
    },
    verifyWebAppAuth: () => ({ ok: true, uid: 7001 }),
    requireWebAppAdmin: async () => ({ user_id: 91 })
  });

  const actionRequestId = "buy_req_123456";
  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/token/buy-intent",
    payload: {
      uid: "7001",
      ts: "1",
      sig: "sig",
      usd_amount: 12,
      chain: "TON",
      action_request_id: actionRequestId
    }
  });
  assert.equal(res.statusCode, 200);
  assert.equal(capturedBody.request_id, actionRequestId);
  await app.close();
});

test("v2 token decision traces requires admin scope", async () => {
  const app = createApp({
    requireWebAppAdmin: async (_client, reply) => {
      reply.code(403).send({ success: false, error: "forbidden" });
      return null;
    }
  });
  const res = await app.inject({
    method: "GET",
    url: "/webapp/api/v2/token/decision/traces?uid=7001&ts=1&sig=sig"
  });
  assert.equal(res.statusCode, 403);
  await app.close();
});
