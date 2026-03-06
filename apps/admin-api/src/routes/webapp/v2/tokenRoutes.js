"use strict";

const { normalizeActionRequestId } = require("../shared/actionRequestGuard");
const { normalizeV2Payload } = require("./shared/v2ResponseNormalizer");

const TOKEN_V2_ERROR_MAP = Object.freeze({
  duplicate_or_locked_request: "idempotency_conflict"
});

function requireDependency(deps, key, type = "function") {
  const value = deps[key];
  if (type === "function" && typeof value !== "function") {
    throw new Error(`registerWebappV2TokenRoutes requires ${key}`);
  }
  if (type === "object" && (!value || typeof value !== "object")) {
    throw new Error(`registerWebappV2TokenRoutes requires ${key}`);
  }
  return value;
}

function resolveActionRequestId(body) {
  const row = body && typeof body === "object" ? body : {};
  return normalizeActionRequestId(row.action_request_id || row.request_id);
}

function registerWebappV2TokenRoutes(fastify, deps = {}) {
  const proxyWebAppApiV1 = requireDependency(deps, "proxyWebAppApiV1", "function");
  const pool = requireDependency(deps, "pool", "object");
  const verifyWebAppAuth = requireDependency(deps, "verifyWebAppAuth", "function");
  const requireWebAppAdmin = requireDependency(deps, "requireWebAppAdmin", "function");

  fastify.get("/webapp/api/v2/token/summary", async (request, reply) => {
    await proxyWebAppApiV1(request, reply, {
      targetPath: "/webapp/api/token/summary",
      method: "GET",
      transform: (payload) => normalizeV2Payload(payload, { errorMap: TOKEN_V2_ERROR_MAP })
    });
  });

  fastify.get("/webapp/api/v2/token/quote", async (request, reply) => {
    await proxyWebAppApiV1(request, reply, {
      targetPath: "/webapp/api/token/quote",
      method: "GET",
      transform: (payload) => normalizeV2Payload(payload, { errorMap: TOKEN_V2_ERROR_MAP })
    });
  });

  fastify.post(
    "/webapp/api/v2/token/mint",
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
            amount: { type: "number", minimum: 0.0001 }
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
        targetPath: "/webapp/api/token/mint",
        method: "POST",
        transform: (payload) =>
          normalizeV2Payload(payload, { actionRequestId, errorMap: TOKEN_V2_ERROR_MAP })
      });
    }
  );

  fastify.post(
    "/webapp/api/v2/token/buy-intent",
    {
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig", "usd_amount", "chain", "action_request_id"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            action_request_id: { type: "string", minLength: 6, maxLength: 120 },
            request_id: { type: "string", minLength: 6, maxLength: 120 },
            usd_amount: { type: "number", minimum: 0.5 },
            chain: { type: "string", minLength: 2, maxLength: 12 }
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
        targetPath: "/webapp/api/token/buy_intent",
        method: "POST",
        transform: (payload) =>
          normalizeV2Payload(payload, { actionRequestId, errorMap: TOKEN_V2_ERROR_MAP })
      });
    }
  );

  fastify.post(
    "/webapp/api/v2/token/submit-tx",
    {
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig", "request_id", "tx_hash", "action_request_id"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            request_id: { type: "integer", minimum: 1 },
            tx_hash: { type: "string", minLength: 24, maxLength: 256 },
            action_request_id: { type: "string", minLength: 6, maxLength: 120 }
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
        action_request_id: actionRequestId
      };
      await proxyWebAppApiV1(request, reply, {
        targetPath: "/webapp/api/token/submit_tx",
        method: "POST",
        transform: (payload) =>
          normalizeV2Payload(payload, { actionRequestId, errorMap: TOKEN_V2_ERROR_MAP })
      });
    }
  );

  fastify.get("/webapp/api/v2/token/route/status", async (request, reply) => {
    await proxyWebAppApiV1(request, reply, {
      targetPath: "/webapp/api/token/route/status",
      method: "GET",
      transform: (payload) => normalizeV2Payload(payload, { errorMap: TOKEN_V2_ERROR_MAP })
    });
  });

  fastify.get("/webapp/api/v2/token/decision/traces", async (request, reply) => {
    const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
    if (!auth.ok) {
      reply.code(401).send({ success: false, error: auth.reason });
      return;
    }
    const client = await pool.connect();
    try {
      const profile = await requireWebAppAdmin(client, reply, auth.uid);
      if (!profile) {
        return;
      }
    } finally {
      client.release();
    }
    await proxyWebAppApiV1(request, reply, {
      targetPath: "/webapp/api/token/decision/traces",
      method: "GET",
      transform: (payload) => normalizeV2Payload(payload, { errorMap: TOKEN_V2_ERROR_MAP })
    });
  });
}

module.exports = {
  registerWebappV2TokenRoutes
};
