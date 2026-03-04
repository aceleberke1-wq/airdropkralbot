"use strict";

const { createRequireActionRequestIdPreValidation } = require("../shared/actionRequestGuard");

function registerWebappAdminFreezeRoutes(fastify, deps = {}) {
  const pool = deps.pool;
  const verifyWebAppAuth = deps.verifyWebAppAuth;
  const issueWebAppSession = deps.issueWebAppSession;
  const requireWebAppAdmin = deps.requireWebAppAdmin;
  const configService = deps.configService;
  const buildAdminSummary = deps.buildAdminSummary;
  const policyService = deps.policyService;
  const adminCriticalCooldownMs = Math.max(1000, Number(deps.adminCriticalCooldownMs || 8000));

  if (!pool || typeof pool.connect !== "function") {
    throw new Error("registerWebappAdminFreezeRoutes requires pool");
  }
  for (const [name, value] of Object.entries({
    verifyWebAppAuth,
    issueWebAppSession,
    requireWebAppAdmin,
    buildAdminSummary
  })) {
    if (typeof value !== "function") {
      throw new Error(`registerWebappAdminFreezeRoutes requires ${name}`);
    }
  }
  if (!policyService || typeof policyService.requireCriticalAdminConfirmation !== "function") {
    throw new Error("registerWebappAdminFreezeRoutes requires policyService");
  }
  const requireActionRequestId = createRequireActionRequestIdPreValidation({ field: "action_request_id", statusCode: 400 });

  fastify.post(
    "/webapp/api/admin/freeze",
    {
      preValidation: requireActionRequestId,
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig", "freeze", "action_request_id"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            freeze: { type: "boolean" },
            action_request_id: { type: "string", minLength: 6, maxLength: 120, pattern: "^[a-zA-Z0-9:_-]{6,120}$" },
            confirm_token: { type: "string", minLength: 16, maxLength: 128 },
            reason: { type: "string", maxLength: 240 }
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

        const freeze = Boolean(request.body.freeze);
        const reason = String(request.body.reason || "").trim();
        const actionKey = freeze ? "system_freeze_on" : "system_freeze_off";
        const confirmation = await policyService.requireCriticalAdminConfirmation({
          db: client,
          actionKey,
          adminId: Number(auth.uid),
          payload: {
            freeze,
            reason
          },
          confirmToken: request.body.confirm_token
        });
        if (!confirmation.ok) {
          await client.query("ROLLBACK");
          reply.code(409).send({
            success: false,
            error: confirmation.error,
            session: issueWebAppSession(auth.uid),
            data: {
              action_key: String(confirmation.policy?.action_key || actionKey),
              confirmation_required: true,
              confirm_token: confirmation.signature,
              expires_in_sec: Number(confirmation.expires_in_sec || 0),
              cooldown_ms: Number(confirmation.policy?.cooldown_ms || adminCriticalCooldownMs)
            }
          });
          return;
        }
        const cooldown = await policyService.enforceCriticalAdminCooldown({
          db: client,
          actionKey,
          adminId: Number(auth.uid),
          cooldownMs: adminCriticalCooldownMs
        });
        if (!cooldown.ok) {
          await client.query("ROLLBACK");
          reply.code(429).send({
            success: false,
            error: "admin_cooldown_active",
            session: issueWebAppSession(auth.uid),
            data: {
              action_key: String(cooldown.policy?.action_key || actionKey),
              wait_sec: Number(cooldown.wait_sec || 1),
              cooldown_ms: Number(cooldown.policy?.cooldown_ms || adminCriticalCooldownMs)
            }
          });
          return;
        }

        const stateJson = {
          freeze,
          reason,
          updated_by: Number(auth.uid),
          updated_at: new Date().toISOString()
        };

        await client.query(
          `INSERT INTO system_state (state_key, state_json, updated_by)
           VALUES ('freeze', $1::jsonb, $2)
           ON CONFLICT (state_key)
           DO UPDATE SET state_json = EXCLUDED.state_json,
                         updated_at = now(),
                         updated_by = EXCLUDED.updated_by;`,
          [JSON.stringify(stateJson), Number(auth.uid)]
        );
        await client.query(
          `INSERT INTO admin_audit (admin_id, action, target, payload_json)
           VALUES ($1, 'system_freeze_toggle', 'system_state:freeze', $2::jsonb);`,
          [Number(auth.uid), JSON.stringify(stateJson)]
        );

        const runtimeConfig = await configService.getEconomyConfig(client);
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
}

module.exports = {
  registerWebappAdminFreezeRoutes
};
