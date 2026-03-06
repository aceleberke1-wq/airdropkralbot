import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function loadModule() {
  const target = pathToFileURL(
    path.join(process.cwd(), "apps", "webapp", "src", "core", "player", "vaultViewModel.js")
  ).href;
  return import(target);
}

test("buildVaultViewModel maps summary and latest action fields", async () => {
  const mod = await loadModule();
  const vm = mod.buildVaultViewModel({
    vaultData: {
      overview: {
        token_summary: { symbol: "NXT", chain: "TON", balance: 420, price_usd: 0.0321 },
        route_status: {
          status: "active",
          routes: [{ status: "ok" }, { status: "pending" }, { status: "failed" }]
        },
        payout_status: {
          can_request: true,
          unlock_tier: "T2",
          unlock_progress: 0.66,
          requestable_btc: 0.00123,
          entitled_btc: 0.00456
        },
        wallet_session: { active: true, chain: "TON", address_masked: "UQ...999", kyc_status: "verified" },
        monetization_status: {
          enabled: true,
          active_pass_count: 2,
          player_effects: { premium_active: true },
          spend_summary: { SC: 100, RC: 3, HC: 1 }
        }
      },
      monetization: {
        catalog: {
          pass_catalog: [{ pass_key: "elite_pass", title: "Elite Pass", duration_days: 30, price_amount: 250, price_currency: "SC" }],
          cosmetic_catalog: [
            { item_key: "skin_photon", title: "Photon Skin", rarity: "epic", price_amount: 120, price_currency: "SC" }
          ]
        },
        status: {
          active_passes: [{ pass_key: "elite_pass" }],
          pass_history: [{ pass_key: "old_pass" }],
          cosmetics: { owned_count: 4, recent: [{ item_key: "skin_photon" }] }
        }
      },
      quote: { usd: 25, token_amount: 780, rate: 31.2 },
      buy: { request_id: 99, status: "intent_created" },
      submit: { request_id: 99, status: "submitted", tx_hash: "0xabc" },
      payout: { can_request: true, latest_request_id: 77 },
      payout_request: { request_id: 77, status: "requested", request_ref: "payout_ref_1" },
      pass_purchase: { pass_key: "elite_pass", purchase_ref: "pass_ref_1", price_amount: 250, price_currency: "SC", status: "active" },
      cosmetic_purchase: { item_key: "skin_photon", purchase_ref: "cos_ref_1", amount_paid: 120, currency: "SC", rarity: "epic" }
    }
  });

  assert.equal(vm.summary.token_symbol, "NXT");
  assert.equal(vm.summary.route_total, 3);
  assert.equal(vm.summary.route_ok, 1);
  assert.equal(vm.summary.route_pending, 1);
  assert.equal(vm.summary.route_failed, 1);
  assert.equal(vm.summary.payout_can_request, true);
  assert.equal(vm.summary.pass_history_count, 1);
  assert.equal(vm.summary.cosmetics_owned_count, 4);
  assert.equal(vm.catalog.passes.length, 1);
  assert.equal(vm.catalog.cosmetics.length, 1);
  assert.equal(vm.latest.intent_request_id, 99);
  assert.equal(vm.latest.submit_tx_hash, "0xabc");
  assert.equal(vm.latest.pass_purchase_key, "elite_pass");
  assert.equal(vm.latest.cosmetic_purchase_key, "skin_photon");
  assert.equal(vm.latest.payout_request_id, 77);
  assert.equal(vm.latest.payout_request_status, "requested");
  assert.equal(vm.has_data, true);
});

test("buildVaultViewModel handles empty payload safely", async () => {
  const mod = await loadModule();
  const vm = mod.buildVaultViewModel({});

  assert.equal(vm.summary.token_symbol, "");
  assert.equal(vm.summary.route_total, 0);
  assert.equal(vm.catalog.passes.length, 0);
  assert.equal(vm.latest.intent_request_id, 0);
  assert.equal(vm.latest.payout_request_id, 0);
  assert.equal(vm.has_data, false);
});
