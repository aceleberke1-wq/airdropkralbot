import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function loadValidators() {
  const target = pathToFileURL(
    path.join(process.cwd(), "apps", "webapp", "src", "core", "contracts", "v2Validators.js")
  ).href;
  return import(target);
}

test("parseHomeFeedResponse validates v2 payload and preserves envelope fields", async () => {
  const validators = await loadValidators();
  const parsed = validators.parseHomeFeedResponse({
    success: true,
    session: { uid: "1", ts: "1", sig: "s" },
    data: {
      api_version: "v2",
      generated_at: "2026-03-05T00:00:00.000Z",
      profile: { public_name: "Player" },
      season: {},
      daily: {},
      contract: {},
      risk: {},
      mission: {},
      wallet_quick: {},
      monetization_quick: {},
      command_hint: [{ key: "play" }]
    }
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.api_version, "v2");
  assert.equal(Array.isArray(parsed.data.command_hint), true);
});

test("parseHomeFeedResponse throws on invalid contract", async () => {
  const validators = await loadValidators();
  assert.throws(() =>
    validators.parseHomeFeedResponse({
      success: true,
      data: {
        api_version: "v1",
        command_hint: []
      }
    })
  );
});

test("parseAdminDynamicAutoPolicyResponse validates segment shape", async () => {
  const validators = await loadValidators();
  const parsed = validators.parseAdminDynamicAutoPolicyResponse({
    success: true,
    data: {
      api_version: "v2",
      token_symbol: "NXT",
      base_policy: {},
      anomaly_state: {},
      segments: [
        {
          token_symbol: "NXT",
          segment_key: "s1_normal",
          priority: 20,
          max_auto_usd: 20,
          risk_threshold: 0.3,
          velocity_per_hour: 8,
          require_onchain_verified: true,
          require_kyc_status: "",
          enabled: true,
          degrade_factor: 1
        }
      ]
    }
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.token_symbol, "NXT");
  assert.equal(parsed.data.segments.length, 1);
});

test("parseUiPreferencesResponse allows non-success envelopes without forcing data parse", async () => {
  const validators = await loadValidators();
  const parsed = validators.parseUiPreferencesResponse({
    success: false,
    error: "expired"
  });
  assert.equal(parsed.success, false);
  assert.equal(parsed.error, "expired");
});

test("parseWalletSessionResponse validates wallet session envelope", async () => {
  const validators = await loadValidators();
  const parsed = validators.parseWalletSessionResponse({
    success: true,
    data: {
      api_version: "v2",
      wallet_capabilities: {
        enabled: true
      },
      wallet_session: {
        enabled: true,
        verify_mode: "format_only",
        active: true,
        chain: "TON",
        address: "UQabc123",
        address_masked: "UQ...123",
        linked_at: "2026-03-05T00:00:00.000Z",
        expires_at: "2026-03-06T00:00:00.000Z",
        session_ref: "wallet_sess_1",
        kyc_status: "verified"
      },
      links: [],
      kyc_status: {
        status: "verified"
      }
    }
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.api_version, "v2");
  assert.equal(parsed.data.wallet_session.active, true);
});

test("parsePayoutStatusResponse validates payout status envelope", async () => {
  const validators = await loadValidators();
  const parsed = validators.parsePayoutStatusResponse({
    success: true,
    data: {
      api_version: "v2",
      can_request: true,
      unlock_tier: "T2",
      unlock_progress: 0.4,
      requestable_btc: 0.0012,
      entitled_btc: 0.002
    }
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.api_version, "v2");
  assert.equal(parsed.data.can_request, true);
});

test("parsePlayerActionResponse validates action mutation envelope", async () => {
  const validators = await loadValidators();
  const parsed = validators.parsePlayerActionResponse({
    success: true,
    data: {
      api_version: "v2",
      action_request_id: "act_20260305_001",
      snapshot: { points: 12 }
    }
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.api_version, "v2");
  assert.equal(parsed.data.action_request_id, "act_20260305_001");
});

test("parsePvpMutationResponse validates pvp mutation envelope", async () => {
  const validators = await loadValidators();
  const parsed = validators.parsePvpMutationResponse({
    success: true,
    data: {
      api_version: "v2",
      action_request_id: "pvp_20260305_001",
      session: { session_ref: "sess_01", phase: "running" }
    }
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.api_version, "v2");
  assert.equal(parsed.data.session.session_ref, "sess_01");
});

test("parsePvpSessionStateResponse validates pvp session state envelope", async () => {
  const validators = await loadValidators();
  const parsed = validators.parsePvpSessionStateResponse({
    success: true,
    data: {
      api_version: "v2",
      session: { session_ref: "sess_02", phase: "resolved" }
    }
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.api_version, "v2");
  assert.equal(parsed.data.session.phase, "resolved");
});

test("parseTokenQueryResponse validates token query envelope", async () => {
  const validators = await loadValidators();
  const parsed = validators.parseTokenQueryResponse({
    success: true,
    data: {
      api_version: "v2",
      quote: { usd: 10, token: 123 }
    }
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.api_version, "v2");
  assert.equal(parsed.data.quote.token, 123);
});

test("parseTokenActionResponse validates token action envelope", async () => {
  const validators = await loadValidators();
  const parsed = validators.parseTokenActionResponse({
    success: true,
    data: {
      api_version: "v2",
      action_request_id: "token_20260305_001",
      request_id: 77
    }
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.api_version, "v2");
  assert.equal(parsed.data.action_request_id, "token_20260305_001");
});

test("parsePvpLiveResponse validates pvp live envelope", async () => {
  const validators = await loadValidators();
  const parsed = validators.parsePvpLiveResponse({
    success: true,
    data: {
      api_version: "v2",
      items: []
    }
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.api_version, "v2");
});

test("parseMonetizationPurchaseResponse validates purchase envelope", async () => {
  const validators = await loadValidators();
  const parsed = validators.parseMonetizationPurchaseResponse({
    success: true,
    data: {
      api_version: "v2",
      purchase: {
        pass_key: "gold",
        purchase_ref: "purchase_001"
      },
      balances: {
        SC: 120
      },
      monetization: {
        enabled: true
      }
    }
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.api_version, "v2");
  assert.equal(parsed.data.purchase.pass_key, "gold");
});
