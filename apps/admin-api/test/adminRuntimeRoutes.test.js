"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const { registerAdminRuntimeRoutes } = require("../src/routes/admin/runtimeRoutes");

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
    parseAdminId: () => 111,
    adminTelegramId: 222,
    isAdminTelegramId: (id) => Number(id) === 111,
    botRuntimeStore: { DEFAULT_STATE_KEY: "default" },
    readBotRuntimeState: async () => ({ state_key: "default", state: { bot_enabled: true }, events: [] }),
    projectBotRuntimeHealth: () => ({ ok: true }),
    reconcileBotRuntimeState: async () => ({ status: "ok", state_key: "default", health_before: {}, health_after: {}, after: {} }),
    getProfileByTelegram: async () => ({ user_id: 7, telegram_id: 777 }),
    computeSceneEffectiveProfile: async () => ({ effective_profile: { asset_mode: "safe", fallback_active: false } }),
    loadFeatureFlags: async () => ({
      source_mode: "env_locked",
      source_json: {},
      env_forced: true,
      flags: { UX_V5_ENABLED: true },
      db_flags: []
    }),
    flagDefaults: { UX_V5_ENABLED: false },
    criticalEnvLockedFlags: new Set(["UX_V5_ENABLED"]),
    ...overrides
  };
}

test("admin runtime flags effective returns normalized payload", async () => {
  const app = Fastify();
  const calls = [];
  registerAdminRuntimeRoutes(app, buildDeps(calls));

  const res = await app.inject({ method: "GET", url: "/admin/runtime/flags/effective" });
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(res.payload);
  assert.equal(payload.success, true);
  assert.equal(payload.data.source_mode, "env_locked");
  assert.equal(payload.data.is_admin, true);
  assert.ok(Array.isArray(payload.data.critical_env_locked_keys));
  await app.close();
});

test("admin scene reconcile requires explicit target when actor and config ids are missing", async () => {
  const app = Fastify();
  const calls = [];
  registerAdminRuntimeRoutes(
    app,
    buildDeps(calls, {
      parseAdminId: () => 0,
      adminTelegramId: 0
    })
  );

  const res = await app.inject({
    method: "POST",
    url: "/admin/runtime/scene/reconcile",
    payload: { scene_key: "nexus_arena" }
  });
  assert.equal(res.statusCode, 400);
  const payload = JSON.parse(res.payload);
  assert.equal(payload.error, "target_telegram_id_required");
  await app.close();
});

test("admin bot reconcile returns service unavailable when tables are missing", async () => {
  const app = Fastify();
  const calls = [];
  registerAdminRuntimeRoutes(
    app,
    buildDeps(calls, {
      reconcileBotRuntimeState: async () => ({ status: "tables_missing", state_key: "default" })
    })
  );

  const res = await app.inject({
    method: "POST",
    url: "/admin/runtime/bot/reconcile",
    payload: { reason: "test" }
  });
  assert.equal(res.statusCode, 503);
  const payload = JSON.parse(res.payload);
  assert.equal(payload.error, "bot_runtime_tables_missing");
  assert.ok(calls.some((sql) => sql.includes("BEGIN")));
  assert.ok(calls.some((sql) => sql.includes("COMMIT")));
  await app.close();
});
