"use strict";

const { normalizeV2Payload } = require("./shared/v2ResponseNormalizer");

const PAYOUT_V2_ERROR_MAP = Object.freeze({
  market_cap_gate: "market_cap_gate_closed",
  payout_not_eligible: "tier_locked",
  duplicate_or_locked_request: "idempotency_conflict",
  kyc_tables_missing: "kyc_unavailable"
});

function registerWebappV2PayoutRoutes(fastify, deps = {}) {
  const proxyWebAppApiV1 = deps.proxyWebAppApiV1;
  if (typeof proxyWebAppApiV1 !== "function") {
    throw new Error("registerWebappV2PayoutRoutes requires proxyWebAppApiV1");
  }

  fastify.get("/webapp/api/v2/payout/status", async (request, reply) => {
    await proxyWebAppApiV1(request, reply, {
      targetPath: "/webapp/api/payout/status",
      method: "GET",
      transform: (payload) => normalizeV2Payload(payload, { errorMap: PAYOUT_V2_ERROR_MAP })
    });
  });

  fastify.post(
    "/webapp/api/v2/payout/request",
    {
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            currency: { type: "string", minLength: 3, maxLength: 6 }
          }
        }
      }
    },
    async (request, reply) => {
      await proxyWebAppApiV1(request, reply, {
        targetPath: "/webapp/api/payout/request",
        method: "POST",
        transform: (payload) => normalizeV2Payload(payload, { errorMap: PAYOUT_V2_ERROR_MAP })
      });
    }
  );
}

module.exports = {
  registerWebappV2PayoutRoutes
};
