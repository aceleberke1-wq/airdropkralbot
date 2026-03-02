"use strict";

function registerAdminTokenPolicyRoutes(fastify, deps = {}) {
  const pool = deps.pool;
  const parseAdminId = deps.parseAdminId;
  const configService = deps.configService;
  const tokenEngine = deps.tokenEngine;
  const tokenStore = deps.tokenStore;
  const upsertFeatureFlag = deps.upsertFeatureFlag;

  if (!pool || typeof pool.connect !== "function") {
    throw new Error("registerAdminTokenPolicyRoutes requires pool.connect");
  }
  for (const [name, value] of Object.entries({
    parseAdminId,
    upsertFeatureFlag
  })) {
    if (typeof value !== "function") {
      throw new Error(`registerAdminTokenPolicyRoutes requires ${name}`);
    }
  }
  if (!configService || typeof configService.getEconomyConfig !== "function") {
    throw new Error("registerAdminTokenPolicyRoutes requires configService.getEconomyConfig");
  }
  if (
    !tokenEngine ||
    typeof tokenEngine.normalizeTokenConfig !== "function" ||
    typeof tokenEngine.normalizeCurveState !== "function"
  ) {
    throw new Error("registerAdminTokenPolicyRoutes requires tokenEngine normalize methods");
  }
  if (
    !tokenStore ||
    typeof tokenStore.getTokenMarketState !== "function" ||
    typeof tokenStore.upsertTokenMarketState !== "function" ||
    typeof tokenStore.insertTreasuryPolicyHistory !== "function" ||
    typeof tokenStore.upsertTreasuryGuardrail !== "function"
  ) {
    throw new Error("registerAdminTokenPolicyRoutes requires tokenStore policy methods");
  }

  fastify.post(
    "/admin/token/auto-policy",
    {
      schema: {
        body: {
          type: "object",
          properties: {
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
      const adminId = parseAdminId(request);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
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

        const upserted = await tokenStore.upsertTokenMarketState(client, {
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
          updatedBy: adminId
        });
        await tokenStore
          .insertTreasuryPolicyHistory(client, {
            tokenSymbol: tokenConfig.symbol,
            source: "admin_auto_policy",
            actorId: adminId,
            previousPolicyJson,
            nextPolicyJson: {
              enabled: Boolean(nextPolicy.enabled),
              auto_usd_limit: Number(nextPolicy.autoUsdLimit || 10),
              risk_threshold: Number(nextPolicy.riskThreshold || 0.35),
              velocity_per_hour: Number(nextPolicy.velocityPerHour || 8),
              require_onchain_verified: Boolean(nextPolicy.requireOnchainVerified)
            },
            reason: "admin_auto_policy_update"
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
              source: "admin_token_auto_policy"
            },
            updatedBy: adminId
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
            updatedBy: adminId,
            note: "updated via /admin/token/auto-policy"
          }).catch((err) => {
            if (err.code !== "42P01") throw err;
          });
        }

        await client.query(
          `INSERT INTO admin_audit (admin_id, action, target, payload_json)
           VALUES ($1, 'token_auto_policy_update', 'token_market_state', $2::jsonb);`,
          [
            adminId,
            JSON.stringify({
              token_symbol: tokenConfig.symbol,
              policy: upserted?.auto_policy_json || {},
              feature_flag_enabled:
                typeof request.body.enabled === "boolean" ? Boolean(request.body.enabled) : null
            })
          ]
        );
        await client.query("COMMIT");
        reply.send({
          success: true,
          data: {
            token_symbol: tokenConfig.symbol,
            auto_policy: upserted?.auto_policy_json || {},
            updated_at: upserted?.updated_at || null
          }
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
    "/admin/token/curve",
    {
      schema: {
        body: {
          type: "object",
          properties: {
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
      const adminId = parseAdminId(request);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
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

        const upserted = await tokenStore.upsertTokenMarketState(client, {
          tokenSymbol: tokenConfig.symbol,
          adminFloorUsd: next.adminFloorUsd,
          curveBaseUsd: next.curveBaseUsd,
          curveK: next.curveK,
          supplyNormDivisor: next.supplyNormDivisor,
          demandFactor: next.demandFactor,
          volatilityDampen: next.volatilityDampen,
          autoPolicy: normalized.autoPolicy,
          updatedBy: adminId
        });
        await tokenStore
          .insertTreasuryPolicyHistory(client, {
            tokenSymbol: tokenConfig.symbol,
            source: "admin_curve",
            actorId: adminId,
            previousPolicyJson: previousCurveJson,
            nextPolicyJson: {
              admin_floor_usd: Number(next.adminFloorUsd || 0),
              base_usd: Number(next.curveBaseUsd || 0),
              k: Number(next.curveK || 0),
              supply_norm_divisor: Number(next.supplyNormDivisor || 1),
              demand_factor: Number(next.demandFactor || 1),
              volatility_dampen: Number(next.volatilityDampen || 0)
            },
            reason: "admin_curve_update"
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
              source: "admin_token_curve"
            },
            updatedBy: adminId
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
            updatedBy: adminId,
            note: "updated via /admin/token/curve"
          }).catch((err) => {
            if (err.code !== "42P01") throw err;
          });
        }

        await client.query(
          `INSERT INTO admin_audit (admin_id, action, target, payload_json)
           VALUES ($1, 'token_curve_update', 'token_market_state', $2::jsonb);`,
          [
            adminId,
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
              feature_flag_enabled:
                typeof request.body.enabled === "boolean" ? Boolean(request.body.enabled) : null
            })
          ]
        );

        await client.query("COMMIT");
        reply.send({
          success: true,
          data: {
            token_symbol: tokenConfig.symbol,
            curve: {
              admin_floor_usd: Number(upserted?.admin_floor_usd || next.adminFloorUsd),
              base_usd: Number(upserted?.curve_base_usd || next.curveBaseUsd),
              k: Number(upserted?.curve_k || next.curveK),
              supply_norm_divisor: Number(upserted?.supply_norm_divisor || next.supplyNormDivisor),
              demand_factor: Number(upserted?.demand_factor || next.demandFactor),
              volatility_dampen: Number(upserted?.volatility_dampen || next.volatilityDampen)
            },
            updated_at: upserted?.updated_at || null
          }
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
  registerAdminTokenPolicyRoutes
};
