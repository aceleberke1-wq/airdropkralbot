"use strict";

const { normalizeActionRequestId } = require("../shared/actionRequestGuard");

function resolveProxy(deps) {
  const proxyWebAppApiV1 = deps.proxyWebAppApiV1;
  if (typeof proxyWebAppApiV1 !== "function") {
    throw new Error("registerWebappV2PvpRoutes requires proxyWebAppApiV1");
  }
  return proxyWebAppApiV1;
}

function normalizePvpV2Payload(payload, actionRequestId = "") {
  if (!payload || typeof payload !== "object") {
    return payload;
  }
  if (!payload.data || typeof payload.data !== "object") {
    payload.data = {};
  }
  payload.data.api_version = "v2";
  if (actionRequestId) {
    payload.data.action_request_id = actionRequestId;
  }
  return payload;
}

function resolveActionRequestId(body) {
  return normalizeActionRequestId(body?.action_request_id || body?.request_id);
}

function registerWebappV2PvpRoutes(fastify, deps = {}) {
  const proxyWebAppApiV1 = resolveProxy(deps);

  fastify.post(
    "/webapp/api/v2/pvp/session/start",
    {
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig", "action_request_id"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            action_request_id: { type: "string", minLength: 6, maxLength: 120 },
            request_id: { type: "string", minLength: 6, maxLength: 120 },
            mode_suggested: { type: "string", enum: ["safe", "balanced", "aggressive"] },
            transport: { type: "string", enum: ["poll", "ws"] }
          }
        }
      }
    },
    async (request, reply) => {
      const actionRequestId = resolveActionRequestId(request.body);
      if (!actionRequestId) {
        reply.code(400).send({ success: false, error: "invalid_action_request_id" });
        return;
      }
      request.body = {
        ...(request.body || {}),
        request_id: actionRequestId,
        action_request_id: actionRequestId
      };
      await proxyWebAppApiV1(request, reply, {
        targetPath: "/webapp/api/pvp/session/start",
        method: "POST",
        transform: (payload) => normalizePvpV2Payload(payload, actionRequestId)
      });
    }
  );

  fastify.post(
    "/webapp/api/v2/pvp/session/action",
    {
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig", "session_ref", "action_seq", "input_action"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            session_ref: { type: "string", minLength: 8, maxLength: 128 },
            action_seq: { type: "integer", minimum: 1 },
            input_action: { type: "string", minLength: 3, maxLength: 24 },
            latency_ms: { type: "integer", minimum: 0 },
            client_ts: { type: "integer", minimum: 0 },
            action_request_id: { type: "string", minLength: 6, maxLength: 120 }
          }
        }
      }
    },
    async (request, reply) => {
      const actionRequestId = resolveActionRequestId(request.body);
      await proxyWebAppApiV1(request, reply, {
        targetPath: "/webapp/api/pvp/session/action",
        method: "POST",
        transform: (payload) => normalizePvpV2Payload(payload, actionRequestId)
      });
    }
  );

  fastify.post(
    "/webapp/api/v2/pvp/session/resolve",
    {
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig", "session_ref"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            session_ref: { type: "string", minLength: 8, maxLength: 128 },
            action_request_id: { type: "string", minLength: 6, maxLength: 120 }
          }
        }
      }
    },
    async (request, reply) => {
      const actionRequestId = resolveActionRequestId(request.body);
      await proxyWebAppApiV1(request, reply, {
        targetPath: "/webapp/api/pvp/session/resolve",
        method: "POST",
        transform: (payload) => normalizePvpV2Payload(payload, actionRequestId)
      });
    }
  );

  fastify.get("/webapp/api/v2/pvp/session/state", async (request, reply) => {
    await proxyWebAppApiV1(request, reply, {
      targetPath: "/webapp/api/pvp/session/state",
      method: "GET",
      transform: (payload) => normalizePvpV2Payload(payload, "")
    });
  });
}

module.exports = {
  registerWebappV2PvpRoutes
};
