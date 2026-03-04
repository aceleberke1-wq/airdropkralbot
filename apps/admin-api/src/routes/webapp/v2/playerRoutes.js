"use strict";

const { normalizeActionRequestId } = require("../shared/actionRequestGuard");

function requireProxy(deps) {
  const proxyWebAppApiV1 = deps.proxyWebAppApiV1;
  if (typeof proxyWebAppApiV1 !== "function") {
    throw new Error("registerWebappV2PlayerRoutes requires proxyWebAppApiV1");
  }
  return proxyWebAppApiV1;
}

function normalizePlayerV2Error(rawError) {
  const key = String(rawError || "").trim();
  if (!key) {
    return key;
  }
  const map = {
    duplicate_or_locked_request: "idempotency_conflict"
  };
  return map[key] || key;
}

function normalizePlayerV2Payload(payload, actionRequestId = "") {
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
  if (payload.success === false && payload.error) {
    payload.error = normalizePlayerV2Error(payload.error);
  }
  return payload;
}

function resolveActionRequestId(body) {
  const row = body && typeof body === "object" ? body : {};
  return normalizeActionRequestId(row.action_request_id || row.request_id);
}

function withActionRequestId(body) {
  const actionRequestId = resolveActionRequestId(body);
  if (!actionRequestId) {
    return { ok: false, error: "invalid_action_request_id" };
  }
  const source = body && typeof body === "object" ? body : {};
  return {
    ok: true,
    actionRequestId,
    body: {
      ...source,
      request_id: actionRequestId,
      action_request_id: actionRequestId
    }
  };
}

function registerWebappV2PlayerRoutes(fastify, deps = {}) {
  const proxyWebAppApiV1 = requireProxy(deps);

  fastify.post(
    "/webapp/api/v2/actions/accept",
    {
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig", "offer_id", "action_request_id"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            offer_id: { type: "integer", minimum: 1 },
            action_request_id: { type: "string", minLength: 6, maxLength: 120 },
            request_id: { type: "string", minLength: 6, maxLength: 120 }
          }
        }
      }
    },
    async (request, reply) => {
      const action = withActionRequestId(request.body);
      if (!action.ok) {
        reply.code(400).send({ success: false, error: action.error });
        return;
      }
      request.body = action.body;
      await proxyWebAppApiV1(request, reply, {
        targetPath: "/webapp/api/actions/accept",
        method: "POST",
        transform: (payload) => normalizePlayerV2Payload(payload, action.actionRequestId)
      });
    }
  );

  fastify.post(
    "/webapp/api/v2/actions/complete",
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
            attempt_id: { type: "integer", minimum: 1 },
            mode: { type: "string", minLength: 2, maxLength: 24 }
          }
        }
      }
    },
    async (request, reply) => {
      const action = withActionRequestId(request.body);
      if (!action.ok) {
        reply.code(400).send({ success: false, error: action.error });
        return;
      }
      request.body = action.body;
      await proxyWebAppApiV1(request, reply, {
        targetPath: "/webapp/api/actions/complete",
        method: "POST",
        transform: (payload) => normalizePlayerV2Payload(payload, action.actionRequestId)
      });
    }
  );

  fastify.post(
    "/webapp/api/v2/actions/reveal",
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
            attempt_id: { type: "integer", minimum: 1 }
          }
        }
      }
    },
    async (request, reply) => {
      const action = withActionRequestId(request.body);
      if (!action.ok) {
        reply.code(400).send({ success: false, error: action.error });
        return;
      }
      request.body = action.body;
      await proxyWebAppApiV1(request, reply, {
        targetPath: "/webapp/api/actions/reveal",
        method: "POST",
        transform: (payload) => normalizePlayerV2Payload(payload, action.actionRequestId)
      });
    }
  );

  fastify.post(
    "/webapp/api/v2/actions/claim-mission",
    {
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig", "mission_key", "action_request_id"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            mission_key: { type: "string", minLength: 3, maxLength: 64 },
            action_request_id: { type: "string", minLength: 6, maxLength: 120 },
            request_id: { type: "string", minLength: 6, maxLength: 120 }
          }
        }
      }
    },
    async (request, reply) => {
      const action = withActionRequestId(request.body);
      if (!action.ok) {
        reply.code(400).send({ success: false, error: action.error });
        return;
      }
      request.body = action.body;
      await proxyWebAppApiV1(request, reply, {
        targetPath: "/webapp/api/actions/claim_mission",
        method: "POST",
        transform: (payload) => normalizePlayerV2Payload(payload, action.actionRequestId)
      });
    }
  );

  fastify.post(
    "/webapp/api/v2/tasks/reroll",
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
            request_id: { type: "string", minLength: 6, maxLength: 120 }
          }
        }
      }
    },
    async (request, reply) => {
      const action = withActionRequestId(request.body);
      if (!action.ok) {
        reply.code(400).send({ success: false, error: action.error });
        return;
      }
      request.body = action.body;
      await proxyWebAppApiV1(request, reply, {
        targetPath: "/webapp/api/tasks/reroll",
        method: "POST",
        transform: (payload) => normalizePlayerV2Payload(payload, action.actionRequestId)
      });
    }
  );
}

module.exports = {
  registerWebappV2PlayerRoutes
};
