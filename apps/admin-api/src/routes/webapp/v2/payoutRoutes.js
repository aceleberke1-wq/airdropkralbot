"use strict";

function normalizePayoutV2ErrorCode(rawError) {
  const key = String(rawError || "").trim();
  if (!key) {
    return key;
  }
  const map = {
    market_cap_gate: "market_cap_gate_closed",
    payout_not_eligible: "tier_locked",
    duplicate_or_locked_request: "idempotency_conflict",
    kyc_tables_missing: "kyc_unavailable"
  };
  return map[key] || key;
}

function normalizePayoutV2Payload(payload) {
  const out = payload && typeof payload === "object" ? payload : {};
  if (!out.data || typeof out.data !== "object") {
    out.data = {};
  }
  out.data.api_version = "v2";
  if (out.success === false && out.error) {
    out.error = normalizePayoutV2ErrorCode(out.error);
  }
  return out;
}

function registerWebappV2PayoutRoutes(fastify, deps = {}) {
  const proxyWebAppApiV1 = deps.proxyWebAppApiV1;
  if (typeof proxyWebAppApiV1 !== "function") {
    throw new Error("registerWebappV2PayoutRoutes requires proxyWebAppApiV1");
  }

  fastify.get("/webapp/api/v2/payout/status", async (request, reply) => {
    await proxyWebAppApiV1(request, reply, {
      targetPath: "/webapp/api/payout/status",
      method: "GET",
      transform: (payload) => normalizePayoutV2Payload(payload)
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
        transform: (payload) => normalizePayoutV2Payload(payload)
      });
    }
  );
}

module.exports = {
  registerWebappV2PayoutRoutes
};
