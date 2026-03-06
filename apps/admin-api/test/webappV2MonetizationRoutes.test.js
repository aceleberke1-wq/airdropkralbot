"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const { registerWebappV2MonetizationRoutes } = require("../src/routes/webapp/v2/monetizationRoutes");
const {
  AdminMonetizationFeeEventResponseV2Schema,
  MonetizationPurchaseResponseV2Schema
} = require("../../../packages/shared/src/contracts/v2");

function createDeps(overrides = {}) {
  return {
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
    issueWebAppSession: (uid) => ({ uid: String(uid), ts: "1", sig: "sig" }),
    normalizeLanguage: (value, fallback = "tr") => {
      const raw = String(value || fallback).trim().toLowerCase();
      return raw === "en" ? "en" : "tr";
    },
    getProfileByTelegram: async () => ({ user_id: 7001 }),
    loadFeatureFlags: async () => ({}),
    buildMonetizationSummary: async () => ({
      enabled: true,
      tables_available: true,
      pass_catalog: [{ pass_key: "gold" }],
      cosmetic_catalog: [{ item_key: "skin_shadow" }],
      active_passes: [{ pass_key: "gold" }],
      player_effects: {
        premium_active: true,
        sc_boost_multiplier: 0.15,
        season_bonus_multiplier: 0.05
      },
      updated_at: "2026-03-05T00:00:00.000Z"
    }),
    getFreezeState: async () => ({ freeze: false, reason: "" }),
    isFeatureEnabled: (_flags, key) => key === "MONETIZATION_CORE_V1_ENABLED",
    hasMonetizationTables: async () => ({ all: true }),
    ensureDefaultPassProducts: async () => {},
    getPassProductForUpdate: async () => ({
      pass_key: "gold",
      active: true,
      price_currency: "SC",
      price_amount: 100,
      duration_days: 7,
      effects_json: {
        effect_key: "premium_pass"
      }
    }),
    normalizeMonetizationCurrency: (value, fallback = "SC") => String(value || fallback).trim().toUpperCase(),
    toPositiveNumber: (value, fallback = 0) => {
      const num = Number(value);
      return Number.isFinite(num) && num > 0 ? num : Number(fallback || 0);
    },
    deterministicUuid: (seed) => `uuid_${String(seed || "").slice(0, 16)}`,
    requireWebAppAdmin: async () => ({ user_id: 7001 }),
    economyStore: {
      async debitCurrency() {
        return { applied: true };
      },
      async getBalances() {
        return { SC: 900 };
      }
    },
    insertUserPassPurchase: async () => ({
      pass_key: "gold",
      purchase_ref: "pass_purchase_1"
    }),
    shopStore: {
      async addOrExtendEffect() {}
    },
    riskStore: {
      async insertBehaviorEvent() {}
    },
    mapUserPassView: (row = {}) => ({
      pass_key: String(row.pass_key || ""),
      purchase_ref: String(row.purchase_ref || "")
    }),
    getCosmeticCatalogItem: (itemKey) => ({
      item_key: String(itemKey || ""),
      category: "cosmetic",
      rarity: "rare",
      price_currency: "SC",
      price_amount: 50
    }),
    insertCosmeticPurchase: async () => ({
      item_key: "skin_shadow",
      purchase_ref: "cosmetic_purchase_1"
    }),
    mapCosmeticPurchaseView: (row = {}) => ({
      item_key: String(row.item_key || ""),
      purchase_ref: String(row.purchase_ref || "")
    }),
    ...overrides
  };
}

test("v2 monetization catalog rejects bad auth signature", async () => {
  const app = Fastify();
  registerWebappV2MonetizationRoutes(
    app,
    createDeps({
      verifyWebAppAuth: () => ({ ok: false, reason: "bad_sig" })
    })
  );
  const res = await app.inject({
    method: "GET",
    url: "/webapp/api/v2/monetization/catalog?uid=7001&ts=1&sig=bad"
  });
  assert.equal(res.statusCode, 401);
  assert.equal(res.json().error, "bad_sig");
  await app.close();
});

test("v2 monetization status returns v2 summary envelope", async () => {
  const app = Fastify();
  registerWebappV2MonetizationRoutes(app, createDeps());
  const res = await app.inject({
    method: "GET",
    url: "/webapp/api/v2/monetization/status?uid=7001&ts=1&sig=sig&lang=tr"
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.success, true);
  assert.equal(body.data.api_version, "v2");
  assert.equal(body.data.language, "tr");
  assert.equal(body.data.monetization.enabled, true);
  await app.close();
});

test("v2 pass purchase rejects currency mismatch", async () => {
  const app = Fastify();
  registerWebappV2MonetizationRoutes(app, createDeps());
  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/monetization/pass/purchase",
    payload: {
      uid: "7001",
      ts: "1",
      sig: "sig",
      pass_key: "gold",
      payment_currency: "BTC"
    }
  });
  assert.equal(res.statusCode, 409);
  assert.equal(res.json().error, "pass_currency_mismatch");
  await app.close();
});

test("v2 pass purchase returns contract-compatible purchase payload", async () => {
  const app = Fastify();
  registerWebappV2MonetizationRoutes(app, createDeps());
  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/monetization/pass/purchase",
    payload: {
      uid: "7001",
      ts: "1",
      sig: "sig",
      pass_key: "gold",
      payment_currency: "SC",
      purchase_ref: "pass_purchase_1"
    }
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.success, true);
  const parsed = MonetizationPurchaseResponseV2Schema.parse(body.data);
  assert.equal(parsed.api_version, "v2");
  assert.equal(parsed.purchase.pass_key, "gold");
  await app.close();
});

test("v2 cosmetic purchase maps duplicate key to idempotency_conflict", async () => {
  const app = Fastify();
  registerWebappV2MonetizationRoutes(
    app,
    createDeps({
      insertCosmeticPurchase: async () => {
        const err = new Error("duplicate");
        err.code = "23505";
        throw err;
      }
    })
  );
  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/monetization/cosmetic/purchase",
    payload: {
      uid: "7001",
      ts: "1",
      sig: "sig",
      item_key: "skin_shadow",
      payment_currency: "SC",
      purchase_ref: "cosmetic_purchase_1"
    }
  });
  assert.equal(res.statusCode, 409);
  assert.equal(res.json().error, "idempotency_conflict");
  await app.close();
});

test("v2 admin fee-event requires admin scope", async () => {
  const app = Fastify();
  registerWebappV2MonetizationRoutes(
    app,
    createDeps({
      requireWebAppAdmin: async (_client, reply) => {
        reply.code(403).send({ success: false, error: "forbidden" });
        return null;
      }
    })
  );

  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/admin/monetization/fee-event",
    payload: {
      uid: "7001",
      ts: "1",
      sig: "sig",
      event_ref: "fee_event_001",
      fee_kind: "marketplace_fee",
      gross_amount: 100,
      fee_amount: 10,
      fee_currency: "SC"
    }
  });
  assert.equal(res.statusCode, 403);
  assert.equal(res.json().error, "forbidden");
  await app.close();
});

test("v2 admin fee-event returns contract-compatible response", async () => {
  const app = Fastify();
  registerWebappV2MonetizationRoutes(
    app,
    createDeps({
      pool: {
        async connect() {
          return {
            async query(sql) {
              if (String(sql || "").includes("RETURNING event_ref")) {
                return {
                  rows: [
                    {
                      event_ref: "fee_event_001",
                      user_id: 7001,
                      fee_kind: "marketplace_fee",
                      gross_amount: 100,
                      fee_amount: 10,
                      fee_currency: "SC",
                      created_at: "2026-03-06T00:00:00.000Z"
                    }
                  ]
                };
              }
              return { rows: [] };
            },
            release() {}
          };
        }
      }
    })
  );

  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/admin/monetization/fee-event",
    payload: {
      uid: "7001",
      ts: "1",
      sig: "sig",
      event_ref: "fee_event_001",
      fee_kind: "marketplace_fee",
      gross_amount: 100,
      fee_amount: 10,
      fee_currency: "SC",
      user_id: 7001,
      payload_json: {
        source: "test"
      }
    }
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.success, true);
  const parsed = AdminMonetizationFeeEventResponseV2Schema.parse(body.data);
  assert.equal(parsed.api_version, "v2");
  assert.equal(parsed.event.event_ref, "fee_event_001");
  assert.equal(parsed.event.fee_currency, "SC");
  await app.close();
});

test("v2 admin fee-event maps duplicate key to idempotency_conflict", async () => {
  const app = Fastify();
  registerWebappV2MonetizationRoutes(
    app,
    createDeps({
      pool: {
        async connect() {
          return {
            async query(sql) {
              if (String(sql || "").includes("RETURNING event_ref")) {
                const err = new Error("duplicate");
                err.code = "23505";
                throw err;
              }
              return { rows: [] };
            },
            release() {}
          };
        }
      }
    })
  );

  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/admin/monetization/fee-event",
    payload: {
      uid: "7001",
      ts: "1",
      sig: "sig",
      event_ref: "fee_event_001",
      fee_kind: "marketplace_fee",
      gross_amount: 100,
      fee_amount: 10,
      fee_currency: "SC"
    }
  });
  assert.equal(res.statusCode, 409);
  assert.equal(res.json().error, "idempotency_conflict");
  await app.close();
});
