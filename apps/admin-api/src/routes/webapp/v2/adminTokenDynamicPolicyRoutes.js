"use strict";

const {
  listDynamicAutoPolicies,
  computeDynamicAutoPolicyAnomaly,
  resolveDynamicAutoPolicyDecision,
  upsertDynamicAutoPolicies
} = require("../../../services/webapp/dynamicAutoPolicyService");

function requireDependency(deps, key, type = "function") {
  const value = deps[key];
  if (type === "function" && typeof value !== "function") {
    throw new Error(`registerWebappV2AdminTokenDynamicPolicyRoutes requires ${key}`);
  }
  if (type === "object" && (!value || typeof value !== "object")) {
    throw new Error(`registerWebappV2AdminTokenDynamicPolicyRoutes requires ${key}`);
  }
  return value;
}

function normalizeBasePolicy(curveState, guardrail, enabled) {
  const fallback = curveState?.autoPolicy || {};
  return {
    enabled: Boolean(enabled),
    autoUsdLimit: Number(guardrail?.auto_usd_limit || fallback.autoUsdLimit || 10),
    riskThreshold: Number(guardrail?.risk_threshold || fallback.riskThreshold || 0.35),
    velocityPerHour: Number(guardrail?.velocity_per_hour || fallback.velocityPerHour || 8),
    requireOnchainVerified:
      typeof guardrail?.require_onchain_verified === "boolean"
        ? Boolean(guardrail.require_onchain_verified)
        : Boolean(fallback.requireOnchainVerified)
  };
}

function normalizeSegmentsInput(rawSegments) {
  return Array.isArray(rawSegments) ? rawSegments : [];
}

function normalizePreviewInput(query = {}) {
  const hasPreview =
    query.risk_score !== undefined ||
    query.velocity_per_hour !== undefined ||
    query.usd_amount !== undefined ||
    query.kyc_status !== undefined ||
    query.gate_open !== undefined;
  if (!hasPreview) {
    return null;
  }
  return {
    risk_score: Number(query.risk_score || 0),
    velocity_per_hour: Number(query.velocity_per_hour || 0),
    usd_amount: Number(query.usd_amount || 0),
    kyc_status: String(query.kyc_status || "unknown"),
    gate_open: String(query.gate_open || "1") !== "0"
  };
}

function registerWebappV2AdminTokenDynamicPolicyRoutes(fastify, deps = {}) {
  const pool = requireDependency(deps, "pool", "object");
  const verifyWebAppAuth = requireDependency(deps, "verifyWebAppAuth");
  const issueWebAppSession = requireDependency(deps, "issueWebAppSession");
  const requireWebAppAdmin = requireDependency(deps, "requireWebAppAdmin");
  const loadFeatureFlags = requireDependency(deps, "loadFeatureFlags");
  const isFeatureEnabled = requireDependency(deps, "isFeatureEnabled");
  const configService = requireDependency(deps, "configService", "object");
  const tokenEngine = requireDependency(deps, "tokenEngine", "object");
  const tokenStore = requireDependency(deps, "tokenStore", "object");

  if (
    typeof configService.getEconomyConfig !== "function" ||
    typeof tokenEngine.normalizeTokenConfig !== "function" ||
    typeof tokenEngine.normalizeCurveState !== "function" ||
    typeof tokenStore.getTokenMarketState !== "function" ||
    typeof tokenStore.getTreasuryGuardrail !== "function"
  ) {
    throw new Error("registerWebappV2AdminTokenDynamicPolicyRoutes requires token/runtime helpers");
  }

  fastify.get(
    "/webapp/api/v2/admin/token/auto-policy/dynamic",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["uid", "ts", "sig"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            token_symbol: { type: "string", maxLength: 16 },
            risk_score: { type: "number", minimum: 0, maximum: 1 },
            velocity_per_hour: { type: "integer", minimum: 0, maximum: 5000 },
            usd_amount: { type: "number", minimum: 0 },
            kyc_status: { type: "string", maxLength: 64 },
            gate_open: { type: "string", maxLength: 8 }
          }
        }
      }
    },
    async (request, reply) => {
      const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
      if (!auth.ok) {
        reply.code(401).send({ success: false, error: auth.reason });
        return;
      }

      const tokenSymbolInput = String(request.query.token_symbol || "").trim().toUpperCase();
      const client = await pool.connect();
      try {
        const adminProfile = await requireWebAppAdmin(client, reply, auth.uid);
        if (!adminProfile) {
          return;
        }
        const runtimeConfig = await configService.getEconomyConfig(client, { forceRefresh: true });
        const tokenConfig = tokenEngine.normalizeTokenConfig(runtimeConfig);
        const tokenSymbol = tokenSymbolInput || String(tokenConfig.symbol || "NXT").toUpperCase();
        const marketState = await tokenStore.getTokenMarketState(client, tokenSymbol).catch((err) => {
          if (err.code === "42P01") return null;
          throw err;
        });
        const guardrail = await tokenStore.getTreasuryGuardrail(client, tokenSymbol).catch((err) => {
          if (err.code === "42P01") return null;
          throw err;
        });
        const curveState = tokenEngine.normalizeCurveState(tokenConfig, marketState);
        const featureFlags = await loadFeatureFlags(client);
        const basePolicy = normalizeBasePolicy(
          curveState,
          guardrail,
          Boolean(isFeatureEnabled(featureFlags, "TOKEN_AUTO_APPROVE_ENABLED") && curveState.autoPolicy?.enabled)
        );
        const segments = await listDynamicAutoPolicies(client, tokenSymbol);
        const anomalyState = await computeDynamicAutoPolicyAnomaly(client, tokenSymbol);

        const previewInput = normalizePreviewInput(request.query);
        const preview = previewInput
          ? await resolveDynamicAutoPolicyDecision(client, {
              token_symbol: tokenSymbol,
              base_policy: basePolicy,
              input: previewInput
            })
          : null;

        reply.send({
          success: true,
          session: issueWebAppSession(auth.uid),
          data: {
            api_version: "v2",
            token_symbol: tokenSymbol,
            base_policy: basePolicy,
            anomaly_state: anomalyState,
            segments,
            preview,
            generated_at: new Date().toISOString()
          }
        });
      } finally {
        client.release();
      }
    }
  );

  fastify.post(
    "/webapp/api/v2/admin/token/auto-policy/dynamic",
    {
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig", "segments"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            token_symbol: { type: "string", maxLength: 16 },
            replace_missing: { type: "boolean" },
            reason: { type: "string", maxLength: 180 },
            note: { type: "string", maxLength: 400 },
            segments: {
              type: "array",
              minItems: 1,
              maxItems: 16,
              items: {
                type: "object",
                required: ["segment_key"],
                properties: {
                  segment_key: { type: "string", minLength: 3, maxLength: 64 },
                  priority: { type: "integer", minimum: 1, maximum: 999 },
                  max_auto_usd: { type: "number", minimum: 0.5, maximum: 1000000 },
                  risk_threshold: { type: "number", minimum: 0, maximum: 1 },
                  velocity_per_hour: { type: "integer", minimum: 1, maximum: 5000 },
                  require_onchain_verified: { type: "boolean" },
                  require_kyc_status: { type: "string", maxLength: 120 },
                  enabled: { type: "boolean" },
                  degrade_factor: { type: "number", minimum: 0.3, maximum: 1 },
                  meta_json: { type: "object" }
                }
              }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
      if (!auth.ok) {
        reply.code(401).send({ success: false, error: auth.reason });
        return;
      }
      const segments = normalizeSegmentsInput(request.body.segments);
      if (segments.length <= 0) {
        reply.code(400).send({ success: false, error: "segments_required" });
        return;
      }

      const tokenSymbolInput = String(request.body.token_symbol || "").trim().toUpperCase();
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const adminProfile = await requireWebAppAdmin(client, reply, auth.uid);
        if (!adminProfile) {
          await client.query("ROLLBACK");
          return;
        }
        const runtimeConfig = await configService.getEconomyConfig(client, { forceRefresh: true });
        const tokenConfig = tokenEngine.normalizeTokenConfig(runtimeConfig);
        const tokenSymbol = tokenSymbolInput || String(tokenConfig.symbol || "NXT").toUpperCase();

        await upsertDynamicAutoPolicies(client, {
          token_symbol: tokenSymbol,
          actor_id: Number(auth.uid || 0),
          reason: String(request.body.reason || "webapp_admin_dynamic_auto_policy_update"),
          note: String(request.body.note || ""),
          replace_missing: request.body.replace_missing !== false,
          segments
        });

        const marketState = await tokenStore.getTokenMarketState(client, tokenSymbol).catch((err) => {
          if (err.code === "42P01") return null;
          throw err;
        });
        const guardrail = await tokenStore.getTreasuryGuardrail(client, tokenSymbol).catch((err) => {
          if (err.code === "42P01") return null;
          throw err;
        });
        const curveState = tokenEngine.normalizeCurveState(tokenConfig, marketState);
        const featureFlags = await loadFeatureFlags(client);
        const basePolicy = normalizeBasePolicy(
          curveState,
          guardrail,
          Boolean(isFeatureEnabled(featureFlags, "TOKEN_AUTO_APPROVE_ENABLED") && curveState.autoPolicy?.enabled)
        );
        const nextSegments = await listDynamicAutoPolicies(client, tokenSymbol);
        const anomalyState = await computeDynamicAutoPolicyAnomaly(client, tokenSymbol);
        await client.query(
          `INSERT INTO admin_audit (admin_id, action, target, payload_json)
           VALUES ($1, 'webapp_v2_dynamic_auto_policy_update', 'v5_token_auto_policy_dynamic', $2::jsonb);`,
          [
            Number(auth.uid || 0),
            JSON.stringify({
              token_symbol: tokenSymbol,
              replace_missing: request.body.replace_missing !== false,
              segment_count: nextSegments.length,
              reason: String(request.body.reason || "webapp_admin_dynamic_auto_policy_update")
            })
          ]
        );
        await client.query("COMMIT");

        reply.send({
          success: true,
          session: issueWebAppSession(auth.uid),
          data: {
            api_version: "v2",
            token_symbol: tokenSymbol,
            base_policy: basePolicy,
            anomaly_state: anomalyState,
            segments: nextSegments,
            updated_at: new Date().toISOString()
          }
        });
      } catch (err) {
        await client.query("ROLLBACK");
        if (String(err.message || "") === "segments_required") {
          reply.code(400).send({ success: false, error: "segments_required" });
          return;
        }
        if (err.code === "42P01") {
          reply.code(503).send({ success: false, error: "dynamic_auto_policy_tables_missing" });
          return;
        }
        throw err;
      } finally {
        client.release();
      }
    }
  );
}

module.exports = {
  registerWebappV2AdminTokenDynamicPolicyRoutes
};

