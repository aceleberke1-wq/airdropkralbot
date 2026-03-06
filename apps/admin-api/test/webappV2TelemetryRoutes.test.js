const test = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const path = require("node:path");

const { registerWebappV2TelemetryRoutes } = require(path.join(
  process.cwd(),
  "apps",
  "admin-api",
  "src",
  "routes",
  "webapp",
  "v2",
  "telemetryRoutes.js"
));

async function createHarness(options = {}) {
  const inserts = [];
  let duplicateInjected = false;
  const client = {
    async query(sql, params = []) {
      const line = String(sql || "");
      if (/INSERT INTO v5_webapp_ui_events/.test(line)) {
        if (options.duplicate && !duplicateInjected) {
          duplicateInjected = true;
          const err = new Error("duplicate");
          err.code = "23505";
          throw err;
        }
        inserts.push(params);
        return { rows: [] };
      }
      return { rows: [] };
    },
    release() {}
  };

  const app = Fastify({ logger: false });
  registerWebappV2TelemetryRoutes(app, {
    pool: {
      async connect() {
        return client;
      }
    },
    verifyWebAppAuth: () => options.auth || { ok: true, uid: 12345 },
    issueWebAppSession: () => ({ uid: "12345", ts: "1", sig: "x" }),
    getProfileByTelegram: async () => options.profile || { user_id: 77 }
  });
  await app.ready();
  return { app, inserts };
}

test("webapp v2 telemetry route rejects unauthorized requests", async () => {
  const { app } = await createHarness({ auth: { ok: false, reason: "bad_sig" } });
  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/telemetry/ui-events/batch",
    payload: {
      uid: "1",
      ts: "1",
      sig: "x",
      session_ref: "sess_1",
      events: [{ event_key: "tab_open" }]
    }
  });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test("webapp v2 telemetry route accepts valid events and reports rejected count", async () => {
  const { app, inserts } = await createHarness();
  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/telemetry/ui-events/batch",
    payload: {
      uid: "12345",
      ts: "1",
      sig: "ok",
      session_ref: "sess_abc",
      variant_key: "treatment",
      experiment_key: "webapp_react_v1",
      funnel_key: "vault_intent",
      surface_key: "vault_panel",
      economy_event_key: "token_intent",
      value_usd: 12.5,
      tx_state: "intent",
      events: [
        { event_key: "tab_open", tab_key: "home", panel_key: "hero", event_value: 1, value_usd: 12.5 },
        { event_key: "invalid key with spaces" }
      ]
    }
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.success, true);
  assert.equal(body.data.accepted_count, 1);
  assert.equal(body.data.rejected_count, 1);
  assert.equal(inserts.length, 1);
  assert.equal(String(inserts[0][9] || ""), "vault_intent");
  assert.equal(String(inserts[0][10] || ""), "vault_panel");
  assert.equal(String(inserts[0][11] || ""), "token_intent");
  assert.equal(Number(inserts[0][12] || 0), 12.5);
  assert.equal(String(inserts[0][13] || ""), "intent");
  await app.close();
});

test("webapp v2 telemetry route returns idempotency conflict on duplicate key", async () => {
  const { app } = await createHarness({ duplicate: true });
  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/telemetry/ui-events/batch",
    payload: {
      uid: "12345",
      ts: "1",
      sig: "ok",
      session_ref: "sess_abc",
      idempotency_key: "fixed_batch_key_1",
      events: [{ event_key: "tab_open", tab_key: "home", panel_key: "hero" }]
    }
  });
  assert.equal(res.statusCode, 409);
  const body = res.json();
  assert.equal(body.success, false);
  assert.equal(body.error, "idempotency_conflict");
  await app.close();
});

test("webapp v2 telemetry route enforces per-user batch rate limit", async () => {
  const uid = "55555";
  const { app } = await createHarness({ auth: { ok: true, uid: Number(uid) } });
  const eightyEvents = Array.from({ length: 80 }, (_, idx) => ({
    event_key: "tab_open",
    panel_key: "hero",
    tab_key: "home",
    client_ts: `2026-03-05T00:00:${String(idx).padStart(2, "0")}.000Z`
  }));

  const requestPayload = {
    uid,
    ts: "1",
    sig: "ok",
    session_ref: "sess_rate",
    events: eightyEvents
  };

  const first = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/telemetry/ui-events/batch",
    payload: requestPayload
  });
  const second = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/telemetry/ui-events/batch",
    payload: requestPayload
  });
  const third = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/telemetry/ui-events/batch",
    payload: requestPayload
  });

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(third.statusCode, 429);
  assert.equal(third.json().error, "ui_events_rate_limited");
  await app.close();
});
