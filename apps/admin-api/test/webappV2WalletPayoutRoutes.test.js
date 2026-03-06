"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const { registerWebappV2PayoutRoutes } = require("../src/routes/webapp/v2/payoutRoutes");
const { registerWebappV2WalletRoutes } = require("../src/routes/webapp/v2/walletRoutes");
const {
  PayoutMutationResponseV2Schema,
  PayoutStatusResponseV2Schema,
  WalletSessionResponseV2Schema
} = require("../../../packages/shared/src/contracts/v2");

function createWalletDeps(overrides = {}) {
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
    normalizeWalletChainInput: (value) => String(value || "").trim().toUpperCase(),
    normalizeWalletAddressInput: (_chain, value) => String(value || "").trim(),
    walletAuthEngine: {
      validateWalletAddress: () => ({ ok: true }),
      buildWalletChallenge: () => ({
        ok: true,
        challenge_ref: "challenge_1",
        chain: "TON",
        address: "UQabc123",
        nonce: "nonce",
        challenge_text: "challenge-text",
        issued_at: "2026-03-05T00:00:00.000Z",
        expires_at: "2026-03-06T00:00:00.000Z",
        statement: "statement",
        domain: "example.com"
      }),
      verifyWalletProof: () => ({ ok: true })
    },
    loadFeatureFlags: async () => ({}),
    isFeatureEnabled: (_flags, key) => key === "WALLET_AUTH_V1_ENABLED",
    hasWalletAuthTables: async () => true,
    getProfileByTelegram: async () => ({ user_id: 7001 }),
    newUuid: () => "uuid_1",
    insertWalletChallenge: async (_client, payload) => payload,
    riskStore: {
      insertBehaviorEvent: async () => {}
    },
    maskWalletLinkAddress: (address) => {
      const raw = String(address || "");
      if (!raw) return "";
      if (raw.length < 6) return raw;
      return `${raw.slice(0, 2)}...${raw.slice(-3)}`;
    },
    readWalletChallengeForUpdate: async () => null,
    markWalletChallengeStatus: async () => {},
    isSanctionedWalletAddress: async () => false,
    hasKycTables: async () => true,
    insertKycScreeningEvent: async () => {},
    upsertKycProfile: async () => ({}),
    readKycProfile: async () => ({ status: "verified", tier: "t1" }),
    normalizeKycState: (profile = {}) => ({
      status: String(profile.status || "unknown"),
      tier: String(profile.tier || "none"),
      blocked: false,
      approved: String(profile.status || "") === "verified"
    }),
    upsertWalletLink: async () => ({
      chain: "TON",
      address_display: "UQabc123",
      kyc_status: "verified",
      linked_at: "2026-03-05T00:00:00.000Z"
    }),
    insertWalletSession: async () => ({
      chain: "TON",
      address: "UQabc123",
      session_ref: "wallet_session_1",
      expires_at: "2026-03-06T00:00:00.000Z"
    }),
    readWalletSessionState: async () => ({
      active: true,
      chain: "TON",
      address: "UQabc123",
      linked_at: "2026-03-05T00:00:00.000Z",
      expires_at: "2026-03-06T00:00:00.000Z",
      session_ref: "wallet_session_1",
      kyc_status: "verified"
    }),
    listWalletLinks: async () => [],
    getWalletCapabilities: () => ({
      enabled: true,
      verify_mode: "format_only",
      session_ttl_sec: 86400,
      challenge_ttl_sec: 300,
      chains: [{ chain: "TON", auth_mode: "format_only", rollout: "primary", enabled: true }]
    }),
    unlinkWalletLinks: async () => 1,
    revokeWalletSessions: async () => 1,
    ...overrides
  };
}

test("v2 payout status normalizes market cap gate error into v2 code", async () => {
  const app = Fastify();
  let hitPath = "";
  registerWebappV2PayoutRoutes(app, {
    proxyWebAppApiV1: async (_request, reply, options = {}) => {
      hitPath = String(options.targetPath || "");
      const payload = options.transform
        ? options.transform({ success: false, error: "market_cap_gate", data: {} })
        : { success: false, error: "market_cap_gate", data: {} };
      reply.send(payload);
    }
  });

  const res = await app.inject({
    method: "GET",
    url: "/webapp/api/v2/payout/status?uid=7001&ts=1&sig=sig"
  });
  assert.equal(res.statusCode, 200);
  assert.equal(hitPath, "/webapp/api/payout/status");
  assert.equal(res.json().error, "market_cap_gate_closed");
  assert.equal(res.json().data.api_version, "v2");
  await app.close();
});

test("v2 payout request normalizes idempotency conflict and keeps v2 contract", async () => {
  const app = Fastify();
  let hitPath = "";
  registerWebappV2PayoutRoutes(app, {
    proxyWebAppApiV1: async (_request, reply, options = {}) => {
      hitPath = String(options.targetPath || "");
      const payload = options.transform
        ? options.transform({ success: false, error: "duplicate_or_locked_request", data: { request_id: 9 } })
        : { success: false, error: "duplicate_or_locked_request", data: { request_id: 9 } };
      reply.send(payload);
    }
  });

  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/payout/request",
    payload: {
      uid: "7001",
      ts: "1",
      sig: "sig",
      currency: "BTC"
    }
  });
  assert.equal(res.statusCode, 200);
  assert.equal(hitPath, "/webapp/api/payout/request");
  assert.equal(res.json().error, "idempotency_conflict");
  const parsed = PayoutMutationResponseV2Schema.parse(res.json().data);
  assert.equal(parsed.api_version, "v2");
  await app.close();
});

test("v2 wallet session returns disabled payload when wallet capability is disabled", async () => {
  const app = Fastify();
  registerWebappV2WalletRoutes(
    app,
    createWalletDeps({
      getWalletCapabilities: () => ({
        enabled: false,
        verify_mode: "format_only",
        session_ttl_sec: 86400,
        challenge_ttl_sec: 300,
        chains: []
      })
    })
  );

  const res = await app.inject({
    method: "GET",
    url: "/webapp/api/v2/wallet/session?uid=7001&ts=1&sig=sig"
  });
  assert.equal(res.statusCode, 200);
  const payload = res.json();
  assert.equal(payload.success, true);
  const parsed = WalletSessionResponseV2Schema.parse(payload.data);
  assert.equal(parsed.api_version, "v2");
  assert.equal(parsed.wallet_session.enabled, false);
  assert.equal(parsed.wallet_session.active, false);
  await app.close();
});

test("v2 wallet session returns active linked session in enabled mode", async () => {
  const app = Fastify();
  registerWebappV2WalletRoutes(
    app,
    createWalletDeps({
      listWalletLinks: async () => [
        {
          chain: "TON",
          address_display: "UQabc123",
          is_primary: true,
          verification_state: "verified",
          verification_method: "wallet_auth",
          kyc_status: "verified",
          risk_score: 0.05,
          linked_at: "2026-03-05T00:00:00.000Z"
        }
      ]
    })
  );

  const res = await app.inject({
    method: "GET",
    url: "/webapp/api/v2/wallet/session?uid=7001&ts=1&sig=sig"
  });
  assert.equal(res.statusCode, 200);
  const payload = res.json();
  assert.equal(payload.success, true);
  const parsed = WalletSessionResponseV2Schema.parse(payload.data);
  assert.equal(parsed.api_version, "v2");
  assert.equal(parsed.wallet_session.active, true);
  assert.equal(parsed.wallet_session.chain, "TON");
  assert.equal(Array.isArray(parsed.links), true);
  assert.equal(parsed.links.length, 1);
  assert.equal(String(parsed.links[0].address_masked || "").includes("..."), true);
  await app.close();
});

test("v2 wallet session rejects invalid auth", async () => {
  const app = Fastify();
  registerWebappV2WalletRoutes(
    app,
    createWalletDeps({
      verifyWebAppAuth: () => ({ ok: false, reason: "bad_sig" })
    })
  );

  const res = await app.inject({
    method: "GET",
    url: "/webapp/api/v2/wallet/session?uid=7001&ts=1&sig=bad"
  });
  assert.equal(res.statusCode, 401);
  assert.equal(res.json().error, "bad_sig");
  await app.close();
});

test("v2 payout status success payload stays contract-compatible", async () => {
  const app = Fastify();
  registerWebappV2PayoutRoutes(app, {
    proxyWebAppApiV1: async (_request, reply, options = {}) => {
      const payload = options.transform
        ? options.transform({
            success: true,
            data: {
              can_request: true,
              unlock_tier: "T2",
              unlock_progress: 0.55,
              requestable_btc: 0.0011
            }
          })
        : { success: true, data: {} };
      reply.send(payload);
    }
  });

  const res = await app.inject({
    method: "GET",
    url: "/webapp/api/v2/payout/status?uid=7001&ts=1&sig=sig"
  });
  assert.equal(res.statusCode, 200);
  const parsed = PayoutStatusResponseV2Schema.parse(res.json().data);
  assert.equal(parsed.api_version, "v2");
  assert.equal(parsed.can_request, true);
  assert.equal(parsed.unlock_tier, "T2");
  await app.close();
});

