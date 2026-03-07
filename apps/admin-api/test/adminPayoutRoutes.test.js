"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const { registerAdminPayoutRoutes } = require("../src/routes/admin/payoutAdminRoutes");

function buildPoolStub(calls, queryHandler, clientQueryHandler) {
  return {
    async query(sql, params) {
      const sqlText = String(sql);
      calls.push({ scope: "pool", sql: sqlText, params: params || [] });
      if (typeof queryHandler === "function") {
        return queryHandler(sqlText, params || []);
      }
      return { rows: [] };
    },
    async connect() {
      return {
        async query(sql, params) {
          const sqlText = String(sql);
          calls.push({ scope: "client", sql: sqlText, params: params || [] });
          if (typeof clientQueryHandler === "function") {
            return clientQueryHandler(sqlText, params || []);
          }
          return { rows: [] };
        },
        release() {}
      };
    }
  };
}

function buildDeps(calls, overrides = {}) {
  return {
    pool: buildPoolStub(calls),
    requirePayoutTables: async () => true,
    parseLimit: (_raw, fallback) => fallback,
    parseAdminId: () => 55,
    deterministicUuid: () => "uuid_ref_1",
    ...overrides
  };
}

test("admin payouts list rejects invalid status filter", async () => {
  const app = Fastify();
  const calls = [];
  registerAdminPayoutRoutes(app, buildDeps(calls));

  const res = await app.inject({
    method: "GET",
    url: "/admin/payouts?status=unknown"
  });
  assert.equal(res.statusCode, 400);
  const payload = JSON.parse(res.payload);
  assert.equal(payload.error, "invalid_status");
  assert.equal(calls.length, 0);
  await app.close();
});

test("admin payouts list returns 503 when payout tables are missing", async () => {
  const app = Fastify();
  const calls = [];
  registerAdminPayoutRoutes(
    app,
    buildDeps(calls, {
      requirePayoutTables: async () => false
    })
  );

  const res = await app.inject({ method: "GET", url: "/admin/payouts" });
  assert.equal(res.statusCode, 503);
  const payload = JSON.parse(res.payload);
  assert.equal(payload.error, "missing_tables_run_migrations");
  assert.equal(calls.length, 0);
  await app.close();
});

test("admin payout pay rejects invalid id", async () => {
  const app = Fastify();
  const calls = [];
  registerAdminPayoutRoutes(app, buildDeps(calls));

  const res = await app.inject({
    method: "POST",
    url: "/admin/payouts/0/pay",
    payload: { tx_hash: "0xabc12345" }
  });
  assert.equal(res.statusCode, 400);
  const payload = JSON.parse(res.payload);
  assert.equal(payload.error, "invalid_id");
  assert.equal(calls.length, 0);
  await app.close();
});

test("admin payout pay sends trust notification after commit", async () => {
  const app = Fastify();
  const calls = [];
  const notifications = [];
  registerAdminPayoutRoutes(
    app,
    buildDeps(calls, {
      pool: buildPoolStub(
        calls,
        async () => ({ rows: [] }),
        async (sqlText) => {
          if (sqlText.includes("FROM payout_requests") && sqlText.includes("FOR UPDATE")) {
            return { rows: [{ id: 8, status: "requested" }] };
          }
          if (sqlText.includes("FROM payout_requests r") && sqlText.includes("LEFT JOIN payout_tx")) {
            return {
              rows: [{ id: 8, user_id: 77, currency: "BTC", amount: 0.0002, status: "paid", tx_hash: "0xabc12345" }]
            };
          }
          return { rows: [] };
        }
      ),
      sendTrustNotification: async (payload) => {
        notifications.push(payload);
        return { sent: true };
      }
    })
  );

  const res = await app.inject({
    method: "POST",
    url: "/admin/payouts/8/pay",
    payload: { tx_hash: "0xabc12345" }
  });
  assert.equal(res.statusCode, 200);
  assert.ok(calls.some((call) => call.sql.includes("COMMIT")));
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].kind, "payout");
  assert.equal(notifications[0].decision, "paid");
  await app.close();
});

test("admin payout reject returns not_found when locked row does not exist", async () => {
  const app = Fastify();
  const calls = [];
  registerAdminPayoutRoutes(
    app,
    buildDeps(calls, {
      pool: buildPoolStub(
        calls,
        async () => ({ rows: [] }),
        async (sqlText) => {
          if (sqlText.includes("FROM payout_requests") && sqlText.includes("FOR UPDATE")) {
            return { rows: [] };
          }
          return { rows: [] };
        }
      )
    })
  );

  const res = await app.inject({
    method: "POST",
    url: "/admin/payouts/8/reject",
    payload: { reason: "duplicate" }
  });
  assert.equal(res.statusCode, 404);
  const payload = JSON.parse(res.payload);
  assert.equal(payload.error, "not_found");
  assert.ok(calls.some((call) => call.sql.includes("BEGIN")));
  assert.ok(calls.some((call) => call.sql.includes("ROLLBACK")));
  await app.close();
});

test("admin payout reject sends trust notification after commit", async () => {
  const app = Fastify();
  const calls = [];
  const notifications = [];
  registerAdminPayoutRoutes(
    app,
    buildDeps(calls, {
      pool: buildPoolStub(
        calls,
        async () => ({ rows: [] }),
        async (sqlText) => {
          if (sqlText.includes("FROM payout_requests") && sqlText.includes("FOR UPDATE")) {
            return { rows: [{ id: 8, user_id: 77, status: "requested", source_hc_amount: 2.5 }] };
          }
          if (sqlText.includes("INSERT INTO currency_ledger")) {
            return { rows: [{ delta: 2.5 }] };
          }
          if (sqlText.includes("FROM payout_requests r") && sqlText.includes("LEFT JOIN payout_tx")) {
            return {
              rows: [{ id: 8, user_id: 77, currency: "BTC", amount: 0.0002, status: "rejected", tx_hash: null }]
            };
          }
          return { rows: [] };
        }
      ),
      sendTrustNotification: async (payload) => {
        notifications.push(payload);
        return { sent: true };
      }
    })
  );

  const res = await app.inject({
    method: "POST",
    url: "/admin/payouts/8/reject",
    payload: { reason: "duplicate" }
  });
  assert.equal(res.statusCode, 200);
  assert.ok(calls.some((call) => call.sql.includes("COMMIT")));
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].decision, "rejected");
  await app.close();
});
