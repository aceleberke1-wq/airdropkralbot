"use strict";

const { normalizeV2Payload } = require("./shared/v2ResponseNormalizer");

function resolveProxy(deps) {
  const proxyWebAppApiV1 = deps.proxyWebAppApiV1;
  if (typeof proxyWebAppApiV1 !== "function") {
    throw new Error("registerWebappV2AdminRuntimeRoutes requires proxyWebAppApiV1");
  }
  return proxyWebAppApiV1;
}

function normalizeAdminRuntimePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }
  return normalizeV2Payload(payload);
}

function registerWebappV2AdminRuntimeRoutes(fastify, deps = {}) {
  const proxyWebAppApiV1 = resolveProxy(deps);

  fastify.get("/webapp/api/v2/admin/metrics", async (request, reply) => {
    await proxyWebAppApiV1(request, reply, {
      targetPath: "/webapp/api/admin/metrics",
      method: "GET",
      transform: (payload) => normalizeAdminRuntimePayload(payload)
    });
  });

  fastify.get("/webapp/api/v2/admin/runtime/flags", async (request, reply) => {
    await proxyWebAppApiV1(request, reply, {
      targetPath: "/webapp/api/admin/runtime/flags",
      method: "GET",
      transform: (payload) => normalizeAdminRuntimePayload(payload)
    });
  });

  fastify.post(
    "/webapp/api/v2/admin/runtime/flags",
    {
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            source_mode: { type: "string", enum: ["env_locked", "db_override"] },
            source_json: { type: "object" },
            flags: {
              type: "object",
              additionalProperties: { type: "boolean" }
            }
          }
        }
      }
    },
    async (request, reply) => {
      await proxyWebAppApiV1(request, reply, {
        targetPath: "/webapp/api/admin/runtime/flags",
        method: "POST",
        transform: (payload) => normalizeAdminRuntimePayload(payload)
      });
    }
  );

  fastify.get("/webapp/api/v2/admin/runtime/bot", async (request, reply) => {
    await proxyWebAppApiV1(request, reply, {
      targetPath: "/webapp/api/admin/runtime/bot",
      method: "GET",
      transform: (payload) => normalizeAdminRuntimePayload(payload)
    });
  });

  fastify.post(
    "/webapp/api/v2/admin/runtime/bot/reconcile",
    {
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            state_key: { type: "string", minLength: 1, maxLength: 80 },
            reason: { type: "string", maxLength: 300 },
            force_stop: { type: "boolean" }
          }
        }
      }
    },
    async (request, reply) => {
      await proxyWebAppApiV1(request, reply, {
        targetPath: "/webapp/api/admin/runtime/bot/reconcile",
        method: "POST",
        transform: (payload) => normalizeAdminRuntimePayload(payload)
      });
    }
  );

  fastify.get("/webapp/api/v2/admin/runtime/deploy/status", async (request, reply) => {
    await proxyWebAppApiV1(request, reply, {
      targetPath: "/webapp/api/admin/runtime/deploy/status",
      method: "GET",
      transform: (payload) => normalizeAdminRuntimePayload(payload)
    });
  });

  fastify.get("/webapp/api/v2/admin/assets/status", async (request, reply) => {
    await proxyWebAppApiV1(request, reply, {
      targetPath: "/webapp/api/admin/assets/status",
      method: "GET",
      transform: (payload) => normalizeAdminRuntimePayload(payload)
    });
  });

  fastify.post(
    "/webapp/api/v2/admin/assets/reload",
    {
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" }
          }
        }
      }
    },
    async (request, reply) => {
      await proxyWebAppApiV1(request, reply, {
        targetPath: "/webapp/api/admin/assets/reload",
        method: "POST",
        transform: (payload) => normalizeAdminRuntimePayload(payload)
      });
    }
  );

  fastify.get("/webapp/api/v2/admin/runtime/audit/phase-status", async (request, reply) => {
    await proxyWebAppApiV1(request, reply, {
      targetPath: "/webapp/api/admin/runtime/audit/phase-status",
      method: "GET",
      transform: (payload) => normalizeAdminRuntimePayload(payload)
    });
  });

  fastify.get("/webapp/api/v2/admin/runtime/audit/data-integrity", async (request, reply) => {
    await proxyWebAppApiV1(request, reply, {
      targetPath: "/webapp/api/admin/runtime/audit/data-integrity",
      method: "GET",
      transform: (payload) => normalizeAdminRuntimePayload(payload)
    });
  });
}

module.exports = {
  registerWebappV2AdminRuntimeRoutes
};
