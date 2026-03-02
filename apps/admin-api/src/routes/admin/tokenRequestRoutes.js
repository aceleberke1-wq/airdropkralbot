"use strict";

function registerAdminTokenRequestRoutes(fastify, deps = {}) {
  const pool = deps.pool;
  const tokenStore = deps.tokenStore;
  const parseLimit = deps.parseLimit;
  const parseAdminId = deps.parseAdminId;
  const validateAndVerifyTokenTx = deps.validateAndVerifyTokenTx;
  const configService = deps.configService;
  const tokenEngine = deps.tokenEngine;
  const economyStore = deps.economyStore;
  const deterministicUuid = deps.deterministicUuid;

  if (!pool || typeof pool.connect !== "function") {
    throw new Error("registerAdminTokenRequestRoutes requires pool.connect");
  }
  if (!tokenStore || typeof tokenStore.listPurchaseRequests !== "function" || typeof tokenStore.lockPurchaseRequest !== "function") {
    throw new Error("registerAdminTokenRequestRoutes requires tokenStore request methods");
  }
  for (const [name, value] of Object.entries({
    parseLimit,
    parseAdminId,
    validateAndVerifyTokenTx,
    deterministicUuid
  })) {
    if (typeof value !== "function") {
      throw new Error(`registerAdminTokenRequestRoutes requires ${name}`);
    }
  }
  if (!configService || typeof configService.getEconomyConfig !== "function") {
    throw new Error("registerAdminTokenRequestRoutes requires configService.getEconomyConfig");
  }
  if (!tokenEngine || typeof tokenEngine.normalizeTokenConfig !== "function") {
    throw new Error("registerAdminTokenRequestRoutes requires tokenEngine.normalizeTokenConfig");
  }
  if (!economyStore || typeof economyStore.creditCurrency !== "function") {
    throw new Error("registerAdminTokenRequestRoutes requires economyStore.creditCurrency");
  }

  fastify.get(
    "/admin/token/requests",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            status: { type: "string" },
            limit: { type: "integer" }
          }
        }
      }
    },
    async (request, reply) => {
      const status = String(request.query.status || "").trim().toLowerCase();
      const limit = parseLimit(request.query.limit, 50, 200);
      try {
        const rows = await tokenStore.listPurchaseRequests(pool, { status, limit });
        reply.send({ success: true, data: rows });
      } catch (err) {
        if (err.code === "42P01") {
          reply.code(503).send({ success: false, error: "token_tables_missing" });
          return;
        }
        throw err;
      }
    }
  );

  fastify.post(
    "/admin/token/requests/:id/approve",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            token_amount: { type: "number", minimum: 0.00000001 },
            tx_hash: { type: "string", minLength: 8, maxLength: 255 },
            note: { type: "string", maxLength: 500 }
          }
        }
      }
    },
    async (request, reply) => {
      const requestId = Number(request.params.id);
      if (!Number.isFinite(requestId) || requestId <= 0) {
        reply.code(400).send({ success: false, error: "invalid_id" });
        return;
      }

      const adminId = parseAdminId(request);
      const txHash = String(request.body?.tx_hash || "").trim();
      const note = String(request.body?.note || "").trim();

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const locked = await tokenStore.lockPurchaseRequest(client, requestId);
        if (!locked) {
          await client.query("ROLLBACK");
          reply.code(404).send({ success: false, error: "not_found" });
          return;
        }
        if (String(locked.status) === "rejected") {
          await client.query("ROLLBACK");
          reply.code(409).send({ success: false, error: "already_rejected" });
          return;
        }

        const tokenAmount = Number(request.body?.token_amount || locked.token_amount || 0);
        if (!Number.isFinite(tokenAmount) || tokenAmount <= 0) {
          await client.query("ROLLBACK");
          reply.code(400).send({ success: false, error: "invalid_token_amount" });
          return;
        }

        const txHashInput = txHash || String(locked.tx_hash || "").trim();
        if (!txHashInput) {
          await client.query("ROLLBACK");
          reply.code(409).send({ success: false, error: "tx_hash_missing" });
          return;
        }

        const txCheck = await validateAndVerifyTokenTx(locked.chain, txHashInput);
        if (!txCheck.ok) {
          await client.query("ROLLBACK");
          const code = txCheck.reason === "tx_not_found_onchain" ? 409 : 400;
          reply.code(code).send({ success: false, error: txCheck.reason, data: txCheck.verify });
          return;
        }

        await tokenStore.submitPurchaseTxHash(client, {
          requestId,
          userId: locked.user_id,
          txHash: txCheck.formatCheck.normalizedHash,
          metaPatch: {
            tx_validation: {
              chain: txCheck.formatCheck.chain,
              status: txCheck.verify.status,
              provider: txCheck.verify.provider || "none",
              checked_at: new Date().toISOString()
            }
          }
        });

        const runtimeConfig = await configService.getEconomyConfig(client);
        const tokenConfig = tokenEngine.normalizeTokenConfig(runtimeConfig);
        const tokenSymbol = String(locked.token_symbol || tokenConfig.symbol || "NXT").toUpperCase();

        const refEventId = deterministicUuid(`token_purchase_credit:${requestId}:${tokenSymbol}`);
        await economyStore.creditCurrency(client, {
          userId: locked.user_id,
          currency: tokenSymbol,
          amount: tokenAmount,
          reason: "token_purchase_approved",
          refEventId,
          meta: {
            request_id: requestId,
            chain: locked.chain,
            usd_amount: Number(locked.usd_amount || 0),
            tx_hash: txCheck.formatCheck.normalizedHash
          }
        });

        const updated = await tokenStore.markPurchaseApproved(client, {
          requestId,
          adminId,
          adminNote: note || `approved:${tokenAmount}`
        });

        await client.query(
          `INSERT INTO admin_audit (admin_id, action, target, payload_json)
           VALUES ($1, 'token_purchase_approve', $2, $3::jsonb);`,
          [
            adminId,
            `token_purchase_request:${requestId}`,
            JSON.stringify({
              token_amount: tokenAmount,
              token_symbol: tokenSymbol,
              tx_hash: txCheck.formatCheck.normalizedHash
            })
          ]
        );

        await client.query("COMMIT");
        reply.send({ success: true, data: updated });
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
    "/admin/token/requests/:id/reject",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            reason: { type: "string", maxLength: 500 }
          }
        }
      }
    },
    async (request, reply) => {
      const requestId = Number(request.params.id);
      if (!Number.isFinite(requestId) || requestId <= 0) {
        reply.code(400).send({ success: false, error: "invalid_id" });
        return;
      }
      const adminId = parseAdminId(request);
      const reason = String(request.body?.reason || "").trim();

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const locked = await tokenStore.lockPurchaseRequest(client, requestId);
        if (!locked) {
          await client.query("ROLLBACK");
          reply.code(404).send({ success: false, error: "not_found" });
          return;
        }
        if (String(locked.status) === "approved") {
          await client.query("ROLLBACK");
          reply.code(409).send({ success: false, error: "already_approved" });
          return;
        }

        const updated = await tokenStore.markPurchaseRejected(client, {
          requestId,
          adminId,
          reason: reason || "rejected_by_admin"
        });

        await client.query(
          `INSERT INTO admin_audit (admin_id, action, target, payload_json)
           VALUES ($1, 'token_purchase_reject', $2, $3::jsonb);`,
          [adminId, `token_purchase_request:${requestId}`, JSON.stringify({ reason: reason || "rejected_by_admin" })]
        );

        await client.query("COMMIT");
        reply.send({ success: true, data: updated });
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
  registerAdminTokenRequestRoutes
};
