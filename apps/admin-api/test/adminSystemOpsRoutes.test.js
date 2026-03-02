"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const { registerAdminSystemOpsRoutes } = require("../src/routes/admin/systemOpsRoutes");

function buildPoolStub(calls, handler) {
  return {
    async query(sql, params) {
      const sqlText = String(sql);
      calls.push({ sql: sqlText, params: params || [] });
      if (typeof handler === "function") {
        return handler(sqlText, params || []);
      }
      return { rows: [] };
    }
  };
}

test("admin configs create returns 503 when required tables are missing", async () => {
  const app = Fastify();
  const calls = [];
  registerAdminSystemOpsRoutes(app, {
    pool: buildPoolStub(calls),
    requireTables: async () => false,
    parseAdminId: () => 100
  });

  const res = await app.inject({
    method: "POST",
    url: "/admin/configs",
    payload: {
      config_key: "economy",
      version: 1,
      config_json: { enabled: true }
    }
  });
  assert.equal(res.statusCode, 503);
  const payload = JSON.parse(res.payload);
  assert.equal(payload.error, "missing_tables_run_migrations");
  assert.equal(calls.length, 0);
  await app.close();
});

test("admin config read returns 404 when key is not found", async () => {
  const app = Fastify();
  const calls = [];
  registerAdminSystemOpsRoutes(app, {
    pool: buildPoolStub(calls, async () => ({ rows: [] })),
    requireTables: async () => true,
    parseAdminId: () => 100
  });

  const res = await app.inject({
    method: "GET",
    url: "/admin/configs/economy"
  });
  assert.equal(res.statusCode, 404);
  const payload = JSON.parse(res.payload);
  assert.equal(payload.error, "not_found");
  assert.equal(calls.length, 1);
  assert.ok(calls[0].sql.includes("FROM config_versions"));
  await app.close();
});

test("admin system freeze upserts state and writes audit", async () => {
  const app = Fastify();
  const calls = [];
  registerAdminSystemOpsRoutes(app, {
    pool: buildPoolStub(calls, async () => ({ rows: [] })),
    requireTables: async () => true,
    parseAdminId: () => 42
  });

  const res = await app.inject({
    method: "POST",
    url: "/admin/system/freeze",
    payload: { freeze: true, reason: "incident" }
  });
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(res.payload);
  assert.equal(payload.success, true);
  assert.equal(payload.data.freeze, true);
  assert.ok(calls.some((call) => call.sql.includes("INSERT INTO system_state")));
  assert.ok(calls.some((call) => call.sql.includes("INSERT INTO admin_audit")));
  await app.close();
});
