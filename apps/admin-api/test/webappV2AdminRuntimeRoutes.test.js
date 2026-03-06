"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const { registerWebappV2AdminRuntimeRoutes } = require("../src/routes/webapp/v2/adminRuntimeRoutes");

test("v2 admin runtime metrics wrapper proxies to v1 path with v2 marker", async () => {
  const app = Fastify();
  let hitPath = "";
  registerWebappV2AdminRuntimeRoutes(app, {
    proxyWebAppApiV1: async (_request, reply, options = {}) => {
      hitPath = String(options.targetPath || "");
      const payload = options.transform
        ? options.transform({
            success: true,
            data: {
              release_stage: "staging",
              uptime_sec: 321
            }
          })
        : { success: true, data: {} };
      reply.send(payload);
    }
  });

  const res = await app.inject({
    method: "GET",
    url: "/webapp/api/v2/admin/metrics?uid=7001&ts=1&sig=sig"
  });
  assert.equal(res.statusCode, 200);
  assert.equal(hitPath, "/webapp/api/admin/metrics");
  const payload = res.json();
  assert.equal(payload.success, true);
  assert.equal(payload.data.api_version, "v2");
  assert.equal(payload.data.release_stage, "staging");
  await app.close();
});

test("v2 admin runtime flags POST wrapper preserves payload and adds v2 marker", async () => {
  const app = Fastify();
  let hitPath = "";
  let capturedBody = null;
  registerWebappV2AdminRuntimeRoutes(app, {
    proxyWebAppApiV1: async (request, reply, options = {}) => {
      hitPath = String(options.targetPath || "");
      capturedBody = request.body;
      const payload = options.transform
        ? options.transform({
            success: true,
            data: {
              source_mode: "db_override",
              flags: {
                WEBAPP_REACT_V1_ENABLED: true
              }
            }
          })
        : { success: true, data: {} };
      reply.send(payload);
    }
  });

  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/admin/runtime/flags",
    payload: {
      uid: "7001",
      ts: "1",
      sig: "sig",
      source_mode: "db_override",
      flags: {
        WEBAPP_REACT_V1_ENABLED: true
      }
    }
  });
  assert.equal(res.statusCode, 200);
  assert.equal(hitPath, "/webapp/api/admin/runtime/flags");
  assert.equal(capturedBody.source_mode, "db_override");
  assert.equal(capturedBody.flags.WEBAPP_REACT_V1_ENABLED, true);
  const payload = res.json();
  assert.equal(payload.success, true);
  assert.equal(payload.data.api_version, "v2");
  assert.equal(payload.data.flags.WEBAPP_REACT_V1_ENABLED, true);
  await app.close();
});
