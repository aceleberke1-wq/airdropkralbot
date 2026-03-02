"use strict";

function registerWebappAdminTokenRoutes(fastify, deps = {}) {
  const pool = deps.pool;
  const verifyWebAppAuth = deps.verifyWebAppAuth;
  const issueWebAppSession = deps.issueWebAppSession;
  const requireWebAppAdmin = deps.requireWebAppAdmin;
  const patchTokenRuntimeConfig = deps.patchTokenRuntimeConfig;
  const configService = deps.configService;
  const tokenEngine = deps.tokenEngine;
  const tokenStore = deps.tokenStore;
  const upsertFeatureFlag = deps.upsertFeatureFlag;
  const buildAdminSummary = deps.buildAdminSummary;

  if (!pool || typeof pool.connect !== "function") {
    throw new Error("registerWebappAdminTokenRoutes requires pool");
  }
  for (const [name, value] of Object.entries({
    verifyWebAppAuth,
    issueWebAppSession,
    requireWebAppAdmin,
    patchTokenRuntimeConfig,
    buildAdminSummary
  })) {
    if (typeof value !== "function") {
      throw new Error(`registerWebappAdminTokenRoutes requires ${name}`);
    }
  }
  if (!configService || typeof configService.getEconomyConfig !== "function") {
    throw new Error("registerWebappAdminTokenRoutes requires configService.getEconomyConfig");
  }
  if (!tokenEngine || typeof tokenEngine.normalizeTokenConfig !== "function" || typeof tokenEngine.normalizeCurveState !== "function") {
    throw new Error("registerWebappAdminTokenRoutes requires tokenEngine normalize helpers");
  }
  if (
    !tokenStore ||
    typeof tokenStore.getTokenMarketState !== "function" ||
    typeof tokenStore.upsertTokenMarketState !== "function" ||
    typeof tokenStore.insertTreasuryPolicyHistory !== "function" ||
    typeof tokenStore.upsertTreasuryGuardrail !== "function"
  ) {
    throw new Error("registerWebappAdminTokenRoutes requires tokenStore market methods");
  }
  if (typeof upsertFeatureFlag !== "function") {
    throw new Error("registerWebappAdminTokenRoutes requires upsertFeatureFlag");
  }

  fastify.post(
    "/webapp/api/admin/token/config",
    {
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            usd_price: { type: "number", minimum: 0.00000001, maximum: 10 },
            min_market_cap_usd: { type: "number", minimum: 1 },
            target_band_max_usd: { type: "number", minimum: 1 }
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
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const profile = await requireWebAppAdmin(client, reply, auth.uid);
        if (!profile) {
          await client.query("ROLLBACK");
          return;
        }

        const patch = {};
        if (Number.isFinite(Number(request.body.usd_price))) {
          patch.usd_price = Number(request.body.usd_price);
        }
        if (Number.isFinite(Number(request.body.min_market_cap_usd))) {
          patch.min_market_cap_usd = Number(request.body.min_market_cap_usd);
        }
        if (Number.isFinite(Number(request.body.target_band_max_usd))) {
          patch.target_band_max_usd = Number(request.body.target_band_max_usd);
        }
        if (Object.keys(patch).length === 0) {
          await client.query("ROLLBACK");
          reply.code(400).send({ success: false, error: "no_patch_fields" });
          return;
        }
        if (
          patch.min_market_cap_usd &&
          patch.target_band_max_usd &&
          patch.target_band_max_usd < patch.min_market_cap_usd
        ) {
          await client.query("ROLLBACK");
          reply.code(400).send({ success: false, error: "invalid_gate_band" });
          return;
        }

        await patchTokenRuntimeConfig(client, auth.uid, patch);
        const runtimeConfig = await configService.getEconomyConfig(client, { forceRefresh: true });
        const summary = await buildAdminSummary(client, runtimeConfig);
        await client.query("COMMIT");
        reply.send({
          success: true,
          session: issueWebAppSession(auth.uid),
          data: summary
        });
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }
  );

  fastify.post(
    "/webapp/api/admin/token/auto_policy",
    {
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            enabled: { type: "boolean" },
            auto_usd_limit: { type: "number", minimum: 0.5 },
            risk_threshold: { type: "number", minimum: 0, maximum: 1 },
            velocity_per_hour: { type: "integer", minimum: 1, maximum: 1000 },
            require_onchain_verified: { type: "boolean" }
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
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const profile = await requireWebAppAdmin(client, reply, auth.uid);
        if (!profile) {
          await client.query("ROLLBACK");
          return;
        }

        const runtimeConfig = await configService.getEconomyConfig(client, { forceRefresh: true });
        const tokenConfig = tokenEngine.normalizeTokenConfig(runtimeConfig);
        const currentMarketState = await tokenStore.getTokenMarketState(client, tokenConfig.symbol).catch((err) => {
          if (err.code === "42P01") return null;
          throw err;
        });
        const normalized = tokenEngine.normalizeCurveState(tokenConfig, currentMarketState);
        const previousPolicyJson = {
          enabled: Boolean(normalized.autoPolicy?.enabled),
          auto_usd_limit: Number(normalized.autoPolicy?.autoUsdLimit || 10),
          risk_threshold: Number(normalized.autoPolicy?.riskThreshold || 0.35),
          velocity_per_hour: Number(normalized.autoPolicy?.velocityPerHour || 8),
          require_onchain_verified: Boolean(normalized.autoPolicy?.requireOnchainVerified)
        };
        const nextPolicy = {
          ...normalized.autoPolicy
        };
        if (typeof request.body.enabled === "boolean") {
          nextPolicy.enabled = Boolean(request.body.enabled);
        }
        if (Number.isFinite(Number(request.body.auto_usd_limit))) {
          nextPolicy.autoUsdLimit = Math.max(0.5, Number(request.body.auto_usd_limit));
        }
        if (Number.isFinite(Number(request.body.risk_threshold))) {
          nextPolicy.riskThreshold = Math.max(0, Math.min(1, Number(request.body.risk_threshold)));
        }
        if (Number.isFinite(Number(request.body.velocity_per_hour))) {
          nextPolicy.velocityPerHour = Math.max(1, Math.floor(Number(request.body.velocity_per_hour)));
        }
        if (typeof request.body.require_onchain_verified === "boolean") {
          nextPolicy.requireOnchainVerified = Boolean(request.body.require_onchain_verified);
        }

        await tokenStore.upsertTokenMarketState(client, {
          tokenSymbol: tokenConfig.symbol,
          adminFloorUsd: normalized.adminFloorUsd,
          curveBaseUsd: normalized.curveBaseUsd,
          curveK: normalized.curveK,
          supplyNormDivisor: normalized.supplyNormDivisor,
          demandFactor: normalized.demandFactor,
          volatilityDampen: normalized.volatilityDampen,
          autoPolicy: {
            enabled: Boolean(nextPolicy.enabled),
            auto_usd_limit: Number(nextPolicy.autoUsdLimit || 10),
            risk_threshold: Number(nextPolicy.riskThreshold || 0.35),
            velocity_per_hour: Number(nextPolicy.velocityPerHour || 8),
            require_onchain_verified: Boolean(nextPolicy.requireOnchainVerified)
          },
          updatedBy: Number(auth.uid)
        });
        await tokenStore
          .insertTreasuryPolicyHistory(client, {
            tokenSymbol: tokenConfig.symbol,
            source: "webapp_admin_auto_policy",
            actorId: Number(auth.uid),
            previousPolicyJson,
            nextPolicyJson: {
              enabled: Boolean(nextPolicy.enabled),
              auto_usd_limit: Number(nextPolicy.autoUsdLimit || 10),
              risk_threshold: Number(nextPolicy.riskThreshold || 0.35),
              velocity_per_hour: Number(nextPolicy.velocityPerHour || 8),
              require_onchain_verified: Boolean(nextPolicy.requireOnchainVerified)
            },
            reason: "webapp_auto_policy_update"
          })
          .catch((err) => {
            if (err.code !== "42P01") {
              throw err;
            }
          });
        await tokenStore
          .upsertTreasuryGuardrail(client, {
            tokenSymbol: tokenConfig.symbol,
            minMarketCapUsd: Number(tokenConfig.payout_gate?.min_market_cap_usd || 0),
            targetMarketCapMaxUsd: Number(tokenConfig.payout_gate?.target_band_max_usd || 0),
            autoUsdLimit: Number(nextPolicy.autoUsdLimit || 10),
            riskThreshold: Number(nextPolicy.riskThreshold || 0.35),
            velocityPerHour: Number(nextPolicy.velocityPerHour || 8),
            requireOnchainVerified: Boolean(nextPolicy.requireOnchainVerified),
            guardrailJson: {
              source: "webapp_api_admin_token_auto_policy"
            },
            updatedBy: Number(auth.uid)
          })
          .catch((err) => {
            if (err.code !== "42P01") {
              throw err;
            }
          });

        if (typeof request.body.enabled === "boolean") {
          await upsertFeatureFlag(client, {
            flagKey: "TOKEN_AUTO_APPROVE_ENABLED",
            enabled: Boolean(request.body.enabled),
            updatedBy: Number(auth.uid),
            note: "updated via /webapp/api/admin/token/auto_policy"
          }).catch((err) => {
            if (err.code !== "42P01") throw err;
          });
        }

        await client.query(
          `INSERT INTO admin_audit (admin_id, action, target, payload_json)
           VALUES ($1, 'webapp_token_auto_policy_update', 'token_market_state', $2::jsonb);`,
          [
            Number(auth.uid),
            JSON.stringify({
              token_symbol: tokenConfig.symbol,
              policy: {
                enabled: Boolean(nextPolicy.enabled),
                auto_usd_limit: Number(nextPolicy.autoUsdLimit || 10),
                risk_threshold: Number(nextPolicy.riskThreshold || 0.35),
                velocity_per_hour: Number(nextPolicy.velocityPerHour || 8),
                require_onchain_verified: Boolean(nextPolicy.requireOnchainVerified)
              },
              feature_flag_enabled: typeof request.body.enabled === "boolean" ? Boolean(request.body.enabled) : null
            })
          ]
        );

        const summary = await buildAdminSummary(client, runtimeConfig);
        await client.query("COMMIT");
        reply.send({
          success: true,
          session: issueWebAppSession(auth.uid),
          data: summary
        });
      } catch (err) {
        await client.query("ROLLBACK");
        if (err.code === "42P01") {
          reply.code(503).send({ success: false, error: "token_tables_missing" });
          return;
        }
        throw err;
      } finally {
        client.release();
      }
    }
  );

  fastify.post(
    "/webapp/api/admin/token/curve",
    {
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            enabled: { type: "boolean" },
            admin_floor_usd: { type: "number", minimum: 0.00000001 },
            base_usd: { type: "number", minimum: 0.00000001 },
            k: { type: "number", minimum: 0 },
            supply_norm_divisor: { type: "number", minimum: 1 },
            demand_factor: { type: "number", minimum: 0.1 },
            volatility_dampen: { type: "number", minimum: 0, maximum: 1 }
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
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const profile = await requireWebAppAdmin(client, reply, auth.uid);
        if (!profile) {
          await client.query("ROLLBACK");
          return;
        }

        const runtimeConfig = await configService.getEconomyConfig(client, { forceRefresh: true });
        const tokenConfig = tokenEngine.normalizeTokenConfig(runtimeConfig);
        const currentMarketState = await tokenStore.getTokenMarketState(client, tokenConfig.symbol).catch((err) => {
          if (err.code === "42P01") return null;
          throw err;
        });
        const normalized = tokenEngine.normalizeCurveState(tokenConfig, currentMarketState);
        const previousCurveJson = {
          admin_floor_usd: Number(normalized.adminFloorUsd || 0),
          base_usd: Number(normalized.curveBaseUsd || 0),
          k: Number(normalized.curveK || 0),
          supply_norm_divisor: Number(normalized.supplyNormDivisor || 1),
          demand_factor: Number(normalized.demandFactor || 1),
          volatility_dampen: Number(normalized.volatilityDampen || 0)
        };
        const next = {
          adminFloorUsd: normalized.adminFloorUsd,
          curveBaseUsd: normalized.curveBaseUsd,
          curveK: normalized.curveK,
          supplyNormDivisor: normalized.supplyNormDivisor,
          demandFactor: normalized.demandFactor,
          volatilityDampen: normalized.volatilityDampen
        };

        if (Number.isFinite(Number(request.body.admin_floor_usd))) {
          next.adminFloorUsd = Math.max(0.00000001, Number(request.body.admin_floor_usd));
        }
        if (Number.isFinite(Number(request.body.base_usd))) {
          next.curveBaseUsd = Math.max(0.00000001, Number(request.body.base_usd));
        }
        if (Number.isFinite(Number(request.body.k))) {
          next.curveK = Math.max(0, Number(request.body.k));
        }
        if (Number.isFinite(Number(request.body.supply_norm_divisor))) {
          next.supplyNormDivisor = Math.max(1, Number(request.body.supply_norm_divisor));
        }
        if (Number.isFinite(Number(request.body.demand_factor))) {
          next.demandFactor = Math.max(0.1, Number(request.body.demand_factor));
        }
        if (Number.isFinite(Number(request.body.volatility_dampen))) {
          next.volatilityDampen = Math.max(0, Math.min(1, Number(request.body.volatility_dampen)));
        }

        await tokenStore.upsertTokenMarketState(client, {
          tokenSymbol: tokenConfig.symbol,
          adminFloorUsd: next.adminFloorUsd,
          curveBaseUsd: next.curveBaseUsd,
          curveK: next.curveK,
          supplyNormDivisor: next.supplyNormDivisor,
          demandFactor: next.demandFactor,
          volatilityDampen: next.volatilityDampen,
          autoPolicy: normalized.autoPolicy,
          updatedBy: Number(auth.uid)
        });
        await tokenStore
          .insertTreasuryPolicyHistory(client, {
            tokenSymbol: tokenConfig.symbol,
            source: "webapp_admin_curve",
            actorId: Number(auth.uid),
            previousPolicyJson: previousCurveJson,
            nextPolicyJson: {
              admin_floor_usd: Number(next.adminFloorUsd || 0),
              base_usd: Number(next.curveBaseUsd || 0),
              k: Number(next.curveK || 0),
              supply_norm_divisor: Number(next.supplyNormDivisor || 1),
              demand_factor: Number(next.demandFactor || 1),
              volatility_dampen: Number(next.volatilityDampen || 0)
            },
            reason: "webapp_curve_update"
          })
          .catch((err) => {
            if (err.code !== "42P01") {
              throw err;
            }
          });
        await tokenStore
          .upsertTreasuryGuardrail(client, {
            tokenSymbol: tokenConfig.symbol,
            minMarketCapUsd: Number(tokenConfig.payout_gate?.min_market_cap_usd || 0),
            targetMarketCapMaxUsd: Number(tokenConfig.payout_gate?.target_band_max_usd || 0),
            autoUsdLimit: Number(normalized.autoPolicy?.autoUsdLimit || 10),
            riskThreshold: Number(normalized.autoPolicy?.riskThreshold || 0.35),
            velocityPerHour: Number(normalized.autoPolicy?.velocityPerHour || 8),
            requireOnchainVerified: Boolean(normalized.autoPolicy?.requireOnchainVerified),
            guardrailJson: {
              source: "webapp_api_admin_token_curve"
            },
            updatedBy: Number(auth.uid)
          })
          .catch((err) => {
            if (err.code !== "42P01") {
              throw err;
            }
          });

        if (typeof request.body.enabled === "boolean") {
          await upsertFeatureFlag(client, {
            flagKey: "TOKEN_CURVE_ENABLED",
            enabled: Boolean(request.body.enabled),
            updatedBy: Number(auth.uid),
            note: "updated via /webapp/api/admin/token/curve"
          }).catch((err) => {
            if (err.code !== "42P01") throw err;
          });
        }

        await client.query(
          `INSERT INTO admin_audit (admin_id, action, target, payload_json)
           VALUES ($1, 'webapp_token_curve_update', 'token_market_state', $2::jsonb);`,
          [
            Number(auth.uid),
            JSON.stringify({
              token_symbol: tokenConfig.symbol,
              curve: {
                admin_floor_usd: next.adminFloorUsd,
                base_usd: next.curveBaseUsd,
                k: next.curveK,
                supply_norm_divisor: next.supplyNormDivisor,
                demand_factor: next.demandFactor,
                volatility_dampen: next.volatilityDampen
              },
              feature_flag_enabled: typeof request.body.enabled === "boolean" ? Boolean(request.body.enabled) : null
            })
          ]
        );

        const summary = await buildAdminSummary(client, runtimeConfig);
        await client.query("COMMIT");
        reply.send({
          success: true,
          session: issueWebAppSession(auth.uid),
          data: summary
        });
      } catch (err) {
        await client.query("ROLLBACK");
        if (err.code === "42P01") {
          reply.code(503).send({ success: false, error: "token_tables_missing" });
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
  registerWebappAdminTokenRoutes
};
