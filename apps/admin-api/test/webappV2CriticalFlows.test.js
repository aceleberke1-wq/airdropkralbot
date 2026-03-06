"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const { registerWebappV2PlayerRoutes } = require("../src/routes/webapp/v2/playerRoutes");
const { registerWebappV2PvpRoutes } = require("../src/routes/webapp/v2/pvpRoutes");
const { registerWebappV2TokenRoutes } = require("../src/routes/webapp/v2/tokenRoutes");
const {
  PlayerActionResponseV2Schema,
  PvpMutationResponseV2Schema,
  PvpSessionStateResponseV2Schema,
  TokenActionResponseV2Schema,
  TokenQueryResponseV2Schema
} = require("../../../packages/shared/src/contracts/v2");

function createTokenDeps(proxyWebAppApiV1) {
  return {
    proxyWebAppApiV1,
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
    verifyWebAppAuth: () => ({ ok: true, uid: 9001 }),
    requireWebAppAdmin: async () => ({ user_id: 91 })
  };
}

test("v2 player task loop wrappers keep parity and normalize idempotency errors", async () => {
  const app = Fastify();
  const hits = [];
  registerWebappV2PlayerRoutes(app, {
    proxyWebAppApiV1: async (request, reply, options = {}) => {
      const targetPath = String(options.targetPath || "");
      const body = request.body && typeof request.body === "object" ? request.body : {};
      hits.push({
        targetPath,
        requestId: String(body.request_id || ""),
        actionRequestId: String(body.action_request_id || "")
      });
      if (targetPath === "/webapp/api/actions/complete") {
        const payload = options.transform
          ? options.transform({ success: false, error: "duplicate_or_locked_request", data: {} })
          : { success: false, error: "duplicate_or_locked_request", data: {} };
        reply.send(payload);
        return;
      }
      const payload = options.transform
        ? options.transform({
            success: true,
            data: {
              snapshot: {
                mission_ready: 1
              }
            }
          })
        : { success: true, data: {} };
      reply.send(payload);
    }
  });

  const accept = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/actions/accept",
    payload: {
      uid: "9001",
      ts: "1",
      sig: "sig",
      offer_id: 10,
      action_request_id: "task_accept_0001"
    }
  });
  const complete = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/actions/complete",
    payload: {
      uid: "9001",
      ts: "1",
      sig: "sig",
      attempt_id: 44,
      action_request_id: "task_complete_0001"
    }
  });
  const reveal = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/actions/reveal",
    payload: {
      uid: "9001",
      ts: "1",
      sig: "sig",
      attempt_id: 44,
      action_request_id: "task_reveal_0001"
    }
  });
  const claim = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/actions/claim-mission",
    payload: {
      uid: "9001",
      ts: "1",
      sig: "sig",
      mission_key: "mission_alpha",
      action_request_id: "task_claim_0001"
    }
  });

  assert.equal(accept.statusCode, 200);
  assert.equal(complete.statusCode, 200);
  assert.equal(reveal.statusCode, 200);
  assert.equal(claim.statusCode, 200);
  const acceptContract = PlayerActionResponseV2Schema.parse(accept.json().data);
  const revealContract = PlayerActionResponseV2Schema.parse(reveal.json().data);
  const claimContract = PlayerActionResponseV2Schema.parse(claim.json().data);
  assert.equal(acceptContract.api_version, "v2");
  assert.equal(revealContract.api_version, "v2");
  assert.equal(claimContract.api_version, "v2");
  assert.equal(complete.json().error, "idempotency_conflict");
  assert.deepEqual(
    hits.map((row) => row.targetPath),
    [
      "/webapp/api/actions/accept",
      "/webapp/api/actions/complete",
      "/webapp/api/actions/reveal",
      "/webapp/api/actions/claim_mission"
    ]
  );
  assert.deepEqual(
    hits.map((row) => row.requestId),
    ["task_accept_0001", "task_complete_0001", "task_reveal_0001", "task_claim_0001"]
  );
  assert.deepEqual(
    hits.map((row) => row.actionRequestId),
    ["task_accept_0001", "task_complete_0001", "task_reveal_0001", "task_claim_0001"]
  );
  await app.close();
});

test("v2 pvp loop wrappers map start action resolve state with v2 payload marker", async () => {
  const app = Fastify();
  const hits = [];
  registerWebappV2PvpRoutes(app, {
    proxyWebAppApiV1: async (request, reply, options = {}) => {
      const targetPath = String(options.targetPath || "");
      const body = request.body && typeof request.body === "object" ? request.body : {};
      hits.push({
        targetPath,
        requestId: String(body.request_id || ""),
        actionRequestId: String(body.action_request_id || "")
      });
      const payload = options.transform
        ? options.transform({
            success: true,
            data: {
              session: {
                session_ref: "pvp_session_0001",
                phase: targetPath.endsWith("/state") ? "resolved" : "running"
              }
            }
          })
        : { success: true, data: {} };
      reply.send(payload);
    }
  });

  const start = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/pvp/session/start",
    payload: {
      uid: "9001",
      ts: "1",
      sig: "sig",
      action_request_id: "pvp_start_0001",
      mode_suggested: "balanced",
      transport: "poll"
    }
  });
  const action = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/pvp/session/action",
    payload: {
      uid: "9001",
      ts: "1",
      sig: "sig",
      session_ref: "pvp_session_0001",
      action_seq: 1,
      input_action: "strike",
      action_request_id: "pvp_action_0001"
    }
  });
  const resolve = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/pvp/session/resolve",
    payload: {
      uid: "9001",
      ts: "1",
      sig: "sig",
      session_ref: "pvp_session_0001",
      action_request_id: "pvp_resolve_0001"
    }
  });
  const state = await app.inject({
    method: "GET",
    url: "/webapp/api/v2/pvp/session/state?uid=9001&ts=1&sig=sig&session_ref=pvp_session_0001"
  });

  assert.equal(start.statusCode, 200);
  assert.equal(action.statusCode, 200);
  assert.equal(resolve.statusCode, 200);
  assert.equal(state.statusCode, 200);
  const startContract = PvpMutationResponseV2Schema.parse(start.json().data);
  const actionContract = PvpMutationResponseV2Schema.parse(action.json().data);
  const resolveContract = PvpMutationResponseV2Schema.parse(resolve.json().data);
  const stateContract = PvpSessionStateResponseV2Schema.parse(state.json().data);
  assert.equal(startContract.api_version, "v2");
  assert.equal(actionContract.api_version, "v2");
  assert.equal(resolveContract.api_version, "v2");
  assert.equal(stateContract.api_version, "v2");
  assert.deepEqual(
    hits.map((row) => row.targetPath),
    [
      "/webapp/api/pvp/session/start",
      "/webapp/api/pvp/session/action",
      "/webapp/api/pvp/session/resolve",
      "/webapp/api/pvp/session/state"
    ]
  );
  assert.equal(hits[0].requestId, "pvp_start_0001");
  assert.equal(hits[0].actionRequestId, "pvp_start_0001");
  await app.close();
});

test("v2 vault token loop wrappers cover quote buy-intent submit-tx route-status and normalize conflicts", async () => {
  const app = Fastify();
  const hits = [];
  registerWebappV2TokenRoutes(
    app,
    createTokenDeps(async (request, reply, options = {}) => {
      const targetPath = String(options.targetPath || "");
      const body = request.body && typeof request.body === "object" ? request.body : {};
      hits.push({
        targetPath,
        requestId: body.request_id,
        actionRequestId: String(body.action_request_id || "")
      });
      if (targetPath === "/webapp/api/token/submit_tx") {
        const payload = options.transform
          ? options.transform({
              success: false,
              error: "duplicate_or_locked_request",
              data: {}
            })
          : { success: false, error: "duplicate_or_locked_request", data: {} };
        reply.send(payload);
        return;
      }
      const payload = options.transform
        ? options.transform({
            success: true,
            data: {
              quote_id: "q1",
              route_state: "pending"
            }
          })
        : { success: true, data: {} };
      reply.send(payload);
    })
  );

  const quote = await app.inject({
    method: "GET",
    url: "/webapp/api/v2/token/quote?uid=9001&ts=1&sig=sig&usd=15&chain=TON"
  });
  const buyIntent = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/token/buy-intent",
    payload: {
      uid: "9001",
      ts: "1",
      sig: "sig",
      usd_amount: 15,
      chain: "TON",
      action_request_id: "token_buy_0001"
    }
  });
  const submitTx = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/token/submit-tx",
    payload: {
      uid: "9001",
      ts: "1",
      sig: "sig",
      request_id: 123,
      tx_hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd",
      action_request_id: "token_submit_0001"
    }
  });
  const routeStatus = await app.inject({
    method: "GET",
    url: "/webapp/api/v2/token/route/status?uid=9001&ts=1&sig=sig"
  });

  assert.equal(quote.statusCode, 200);
  assert.equal(buyIntent.statusCode, 200);
  assert.equal(submitTx.statusCode, 200);
  assert.equal(routeStatus.statusCode, 200);
  const quoteContract = TokenQueryResponseV2Schema.parse(quote.json().data);
  const buyIntentContract = TokenActionResponseV2Schema.parse(buyIntent.json().data);
  const routeStatusContract = TokenQueryResponseV2Schema.parse(routeStatus.json().data);
  assert.equal(quoteContract.api_version, "v2");
  assert.equal(buyIntentContract.api_version, "v2");
  assert.equal(routeStatusContract.api_version, "v2");
  assert.equal(submitTx.json().error, "idempotency_conflict");
  assert.deepEqual(
    hits.map((row) => row.targetPath),
    [
      "/webapp/api/token/quote",
      "/webapp/api/token/buy_intent",
      "/webapp/api/token/submit_tx",
      "/webapp/api/token/route/status"
    ]
  );
  assert.equal(String(hits[1].requestId || ""), "token_buy_0001");
  assert.equal(String(hits[1].actionRequestId || ""), "token_buy_0001");
  assert.equal(String(hits[2].actionRequestId || ""), "token_submit_0001");
  await app.close();
});
