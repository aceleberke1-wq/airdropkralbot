"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  AdminMonetizationFeeEventResponseV2Schema,
  MonetizationPurchaseResponseV2Schema
} = require("../../../packages/shared/src/contracts/v2");

test("MonetizationPurchaseResponseV2Schema accepts pass purchase payload", async () => {
  const parsed = MonetizationPurchaseResponseV2Schema.parse({
    api_version: "v2",
    purchase: {
      pass_key: "gold_pass",
      purchase_ref: "pass_purchase_001"
    },
    balances: {
      SC: 840
    },
    monetization: {
      enabled: true
    }
  });
  assert.equal(parsed.api_version, "v2");
  assert.equal(parsed.purchase.pass_key, "gold_pass");
});

test("MonetizationPurchaseResponseV2Schema accepts cosmetic purchase payload", async () => {
  const parsed = MonetizationPurchaseResponseV2Schema.parse({
    api_version: "v2",
    purchase: {
      item_key: "skin_shadow",
      purchase_ref: "cosmetic_purchase_001"
    },
    balances: {
      SC: 120
    },
    monetization: {
      enabled: true,
      active_passes: []
    }
  });
  assert.equal(parsed.api_version, "v2");
  assert.equal(parsed.purchase.item_key, "skin_shadow");
});

test("MonetizationPurchaseResponseV2Schema rejects non-v2 api_version", async () => {
  assert.throws(() =>
    MonetizationPurchaseResponseV2Schema.parse({
      api_version: "v1",
      purchase: {}
    })
  );
});

test("AdminMonetizationFeeEventResponseV2Schema accepts fee event payload", async () => {
  const parsed = AdminMonetizationFeeEventResponseV2Schema.parse({
    api_version: "v2",
    event: {
      event_ref: "fee_event_001",
      user_id: 7001,
      fee_kind: "marketplace_fee",
      gross_amount: 100,
      fee_amount: 10,
      fee_currency: "SC",
      created_at: "2026-03-06T00:00:00.000Z"
    }
  });
  assert.equal(parsed.api_version, "v2");
  assert.equal(parsed.event.event_ref, "fee_event_001");
});
