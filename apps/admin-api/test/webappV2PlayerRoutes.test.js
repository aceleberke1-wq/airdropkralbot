"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const { registerWebappV2PlayerRoutes } = require("../src/routes/webapp/v2/playerRoutes");

test("v2 player accept wrapper maps action_request_id to request_id", async () => {
  const app = Fastify();
  let capturedBody = null;
  registerWebappV2PlayerRoutes(app, {
    proxyWebAppApiV1: async (request, reply) => {
      capturedBody = request.body;
      reply.send({ success: true, data: {} });
    }
  });

  const actionRequestId = "accept_req_12345";
  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/actions/accept",
    payload: {
      uid: "1001",
      ts: "1",
      sig: "sig",
      offer_id: 44,
      action_request_id: actionRequestId
    }
  });
  assert.equal(res.statusCode, 200);
  assert.equal(String(capturedBody.request_id || ""), actionRequestId);
  assert.equal(String(capturedBody.action_request_id || ""), actionRequestId);
  await app.close();
});

test("v2 player wrappers reject invalid action_request_id", async () => {
  const app = Fastify();
  registerWebappV2PlayerRoutes(app, {
    proxyWebAppApiV1: async (_request, reply) => {
      reply.send({ success: true, data: {} });
    }
  });

  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/actions/complete",
    payload: {
      uid: "1001",
      ts: "1",
      sig: "sig",
      action_request_id: "bad req id"
    }
  });
  assert.equal(res.statusCode, 400);
  const payload = res.json();
  assert.equal(payload.error, "invalid_action_request_id");
  await app.close();
});
