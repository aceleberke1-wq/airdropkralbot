"use strict";

const { createRequireActionRequestIdPreValidation } = require("../shared/actionRequestGuard");

function registerWebappAdminPayoutDecisionRoutes(fastify, deps = {}) {
  const pool = deps.pool;
  const verifyWebAppAuth = deps.verifyWebAppAuth;
  const issueWebAppSession = deps.issueWebAppSession;
  const requireWebAppAdmin = deps.requireWebAppAdmin;
  const payoutStore = deps.payoutStore;
  const configService = deps.configService;
  const buildAdminSummary = deps.buildAdminSummary;

  if (!pool || typeof pool.connect !== "function") {
    throw new Error("registerWebappAdminPayoutDecisionRoutes requires pool");
  }
  for (const [name, value] of Object.entries({
    verifyWebAppAuth,
    issueWebAppSession,
    requireWebAppAdmin,
    buildAdminSummary
  })) {
    if (typeof value !== "function") {
      throw new Error(`registerWebappAdminPayoutDecisionRoutes requires ${name}`);
    }
  }
  if (!payoutStore || typeof payoutStore.markPaid !== "function" || typeof payoutStore.markRejected !== "function") {
    throw new Error("registerWebappAdminPayoutDecisionRoutes requires payoutStore markPaid/markRejected");
  }
  if (!configService || typeof configService.getEconomyConfig !== "function") {
    throw new Error("registerWebappAdminPayoutDecisionRoutes requires configService.getEconomyConfig");
  }
  const requireActionRequestId = createRequireActionRequestIdPreValidation({ field: "action_request_id", statusCode: 400 });

  fastify.post(
    "/webapp/api/admin/payout/pay",
    {
      preValidation: requireActionRequestId,
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig", "request_id", "tx_hash", "action_request_id"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            request_id: { type: "integer", minimum: 1 },
            tx_hash: { type: "string", minLength: 8, maxLength: 255 },
            action_request_id: { type: "string", minLength: 6, maxLength: 120, pattern: "^[a-zA-Z0-9:_-]{6,120}$" }
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

      const requestId = Number(request.body.request_id || 0);
      const txHash = String(request.body.tx_hash || "").trim();
      if (!requestId || !txHash) {
        reply.code(400).send({ success: false, error: "invalid_payload" });
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

        const paid = await payoutStore.markPaid(client, {
          requestId,
          txHash,
          adminId: Number(auth.uid)
        });
        if (paid.status === "not_found") {
          await client.query("ROLLBACK");
          reply.code(404).send({ success: false, error: "not_found" });
          return;
        }
        if (paid.status === "rejected") {
          await client.query("ROLLBACK");
          reply.code(409).send({ success: false, error: "already_rejected" });
          return;
        }

        await client.query(
          `INSERT INTO admin_audit (admin_id, action, target, payload_json)
           VALUES ($1, 'payout_mark_paid', $2, $3::jsonb);`,
          [Number(auth.uid), `payout_request:${requestId}`, JSON.stringify({ tx_hash: txHash, status: paid.status })]
        );

        const runtimeConfig = await configService.getEconomyConfig(client);
        const summary = await buildAdminSummary(client, runtimeConfig);
        await client.query("COMMIT");
        reply.send({
          success: true,
          session: issueWebAppSession(auth.uid),
          data: { payout: paid.request || null, status: paid.status, summary }
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
    "/webapp/api/admin/payout/reject",
    {
      preValidation: requireActionRequestId,
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig", "request_id", "action_request_id"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            request_id: { type: "integer", minimum: 1 },
            action_request_id: { type: "string", minLength: 6, maxLength: 120, pattern: "^[a-zA-Z0-9:_-]{6,120}$" },
            reason: { type: "string", maxLength: 500 }
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
      const requestId = Number(request.body.request_id || 0);
      if (!requestId) {
        reply.code(400).send({ success: false, error: "invalid_id" });
        return;
      }
      const reason = String(request.body.reason || "").trim() || "rejected_by_admin";

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const profile = await requireWebAppAdmin(client, reply, auth.uid);
        if (!profile) {
          await client.query("ROLLBACK");
          return;
        }
        const result = await payoutStore.markRejected(client, {
          requestId,
          adminId: Number(auth.uid),
          reason
        });
        if (result.status !== "rejected") {
          await client.query("ROLLBACK");
          reply.code(409).send({ success: false, error: result.status || "reject_failed" });
          return;
        }
        const runtimeConfig = await configService.getEconomyConfig(client);
        const summary = await buildAdminSummary(client, runtimeConfig);
        await client.query("COMMIT");
        reply.send({
          success: true,
          session: issueWebAppSession(auth.uid),
          data: { payout: result.request, summary }
        });
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }
  );
}

module.exports = {
  registerWebappAdminPayoutDecisionRoutes
};
