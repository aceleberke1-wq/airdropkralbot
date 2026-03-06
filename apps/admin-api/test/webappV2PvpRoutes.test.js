"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const { registerWebappV2PvpRoutes } = require("../src/routes/webapp/v2/pvpRoutes");

test("v2 pvp session start maps action_request_id and request_id", async () => {
  const app = Fastify();
  let capturedBody = null;
  let capturedPath = "";
  registerWebappV2PvpRoutes(app, {
    proxyWebAppApiV1: async (request, reply, options) => {
      capturedBody = request.body;
      capturedPath = String(options?.targetPath || "");
      reply.send({ success: true, data: {} });
    }
  });

  const actionRequestId = "pvp_start_req_12345";
  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/pvp/session/start",
    payload: {
      uid: "77",
      ts: "1",
      sig: "sig",
      action_request_id: actionRequestId
    }
  });
  assert.equal(res.statusCode, 200);
  assert.equal(capturedPath, "/webapp/api/pvp/session/start");
  assert.equal(String(capturedBody.request_id || ""), actionRequestId);
  assert.equal(String(capturedBody.action_request_id || ""), actionRequestId);
  await app.close();
});

test("v2 pvp session start rejects invalid action_request_id", async () => {
  const app = Fastify();
  registerWebappV2PvpRoutes(app, {
    proxyWebAppApiV1: async (_request, reply) => {
      reply.send({ success: true, data: {} });
    }
  });

  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/pvp/session/start",
    payload: {
      uid: "77",
      ts: "1",
      sig: "sig",
      action_request_id: "bad id with space"
    }
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error, "invalid_action_request_id");
  await app.close();
});

test("v2 pvp live wrappers proxy to v1 live endpoints", async () => {
  const app = Fastify();
  const hitPaths = [];
  registerWebappV2PvpRoutes(app, {
    proxyWebAppApiV1: async (_request, reply, options) => {
      hitPaths.push(String(options?.targetPath || ""));
      reply.send({ success: true, data: {} });
    }
  });

  const baseAuth = "uid=77&ts=1&sig=s";
  const leaderboard = await app.inject({
    method: "GET",
    url: `/webapp/api/v2/pvp/leaderboard/live?${baseAuth}`
  });
  const diagnostics = await app.inject({
    method: "GET",
    url: `/webapp/api/v2/pvp/diagnostics/live?${baseAuth}`
  });
  const tick = await app.inject({
    method: "GET",
    url: `/webapp/api/v2/pvp/match/tick?${baseAuth}&session_ref=sess_1`
  });

  assert.equal(leaderboard.statusCode, 200);
  assert.equal(diagnostics.statusCode, 200);
  assert.equal(tick.statusCode, 200);
  assert.deepEqual(hitPaths, [
    "/webapp/api/pvp/leaderboard/live",
    "/webapp/api/pvp/diagnostics/live",
    "/webapp/api/pvp/match/tick"
  ]);
  await app.close();
});

