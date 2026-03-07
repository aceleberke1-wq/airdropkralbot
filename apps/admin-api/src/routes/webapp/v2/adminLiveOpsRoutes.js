"use strict";

const { createLiveOpsChatCampaignService } = require("../../../services/liveOpsChatCampaignService");

function formatZodIssues(error) {
  const issues = Array.isArray(error?.issues) ? error.issues : [];
  return issues.map((issue) => ({
    path: issue.path,
    message: issue.message
  }));
}

function registerWebappV2AdminLiveOpsRoutes(fastify, deps = {}) {
  const pool = deps.pool;
  const verifyWebAppAuth = deps.verifyWebAppAuth;
  const requireWebAppAdmin = deps.requireWebAppAdmin;
  const issueWebAppSession = deps.issueWebAppSession;
  const contracts = deps.contracts || {};

  if (!pool || typeof pool.connect !== "function") {
    throw new Error("registerWebappV2AdminLiveOpsRoutes requires pg pool");
  }
  if (typeof verifyWebAppAuth !== "function") {
    throw new Error("registerWebappV2AdminLiveOpsRoutes requires verifyWebAppAuth");
  }
  if (typeof requireWebAppAdmin !== "function") {
    throw new Error("registerWebappV2AdminLiveOpsRoutes requires requireWebAppAdmin");
  }
  if (typeof issueWebAppSession !== "function") {
    throw new Error("registerWebappV2AdminLiveOpsRoutes requires issueWebAppSession");
  }

  const service =
    deps.service ||
    createLiveOpsChatCampaignService({
      pool,
      fetchImpl: deps.fetchImpl,
      botToken: deps.botToken,
      botUsername: deps.botUsername,
      webappPublicUrl: deps.webappPublicUrl,
      webappHmacSecret: deps.webappHmacSecret,
      resolveWebappVersion: deps.resolveWebappVersion,
      logger(level, payload) {
        if (typeof deps.logger?.[level] === "function") {
          deps.logger[level](payload);
          return;
        }
        if (typeof deps.logger === "function") {
          deps.logger(level, payload);
        }
      }
    });
  const upsertSchema = contracts.LiveOpsCampaignUpsertRequestSchema;
  const approvalSchema = contracts.LiveOpsCampaignApprovalRequestSchema;
  const dispatchSchema = contracts.LiveOpsCampaignDispatchRequestSchema;
  const snapshotSchema = contracts.LiveOpsCampaignSnapshotSchema;
  const dispatchResponseSchema = contracts.LiveOpsCampaignDispatchResponseSchema;

  async function requireAdminProfile(requestLike, reply) {
    const auth = verifyWebAppAuth(requestLike.uid, requestLike.ts, requestLike.sig);
    if (!auth.ok) {
      reply.code(401).send({ success: false, error: auth.reason });
      return null;
    }
    const client = await pool.connect();
    try {
      const profile = await requireWebAppAdmin(client, reply, auth.uid);
      if (!profile) {
        return null;
      }
      return { auth, profile };
    } finally {
      client.release();
    }
  }

  fastify.get(
    "/webapp/api/v2/admin/live-ops/campaign",
    {
      schema: {
        querystring: {
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
      const authState = await requireAdminProfile(request.query, reply);
      if (!authState) {
        return;
      }
      const snapshot = await service.getCampaignSnapshot();
      if (snapshotSchema) {
        const parsed = snapshotSchema.safeParse(snapshot);
        if (!parsed.success) {
          reply.code(500).send({ success: false, error: "live_ops_campaign_snapshot_invalid" });
          return;
        }
      }
      reply.send({
        success: true,
        session: issueWebAppSession(authState.auth.uid),
        data: snapshot
      });
    }
  );

  fastify.post(
    "/webapp/api/v2/admin/live-ops/campaign",
    {
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig", "campaign"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            reason: { type: "string", maxLength: 240 },
            campaign: { type: "object" }
          }
        }
      }
    },
    async (request, reply) => {
      const authState = await requireAdminProfile(request.body, reply);
      if (!authState) {
        return;
      }
      if (upsertSchema) {
        const parsed = upsertSchema.safeParse(request.body);
        if (!parsed.success) {
          reply.code(400).send({
            success: false,
            error: "invalid_live_ops_campaign_payload",
            details: formatZodIssues(parsed.error)
          });
          return;
        }
      }
      const snapshot = await service.saveCampaignConfig({
        adminId: Number(authState.auth.uid || 0),
        reason: request.body.reason,
        campaign: request.body.campaign
      });
      reply.send({
        success: true,
        session: issueWebAppSession(authState.auth.uid),
        data: snapshot
      });
    }
  );

  fastify.post(
    "/webapp/api/v2/admin/live-ops/campaign/approval",
    {
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig", "approval_action"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            approval_action: { type: "string", enum: ["request", "approve", "revoke"] },
            reason: { type: "string", maxLength: 240 },
            campaign: { type: "object" }
          }
        }
      }
    },
    async (request, reply) => {
      const authState = await requireAdminProfile(request.body, reply);
      if (!authState) {
        return;
      }
      if (approvalSchema) {
        const parsed = approvalSchema.safeParse(request.body);
        if (!parsed.success) {
          reply.code(400).send({
            success: false,
            error: "invalid_live_ops_campaign_approval_payload",
            details: formatZodIssues(parsed.error)
          });
          return;
        }
      }
      try {
        const snapshot = await service.updateCampaignApproval({
          adminId: Number(authState.auth.uid || 0),
          reason: request.body.reason,
          approvalAction: request.body.approval_action,
          campaign: request.body.campaign
        });
        reply.send({
          success: true,
          session: issueWebAppSession(authState.auth.uid),
          data: snapshot
        });
      } catch (err) {
        const reason = String(err?.message || "live_ops_campaign_approval_failed");
        const statusCode = reason === "invalid_approval_action" ? 400 : 502;
        reply.code(statusCode).send({ success: false, error: reason });
      }
    }
  );

  fastify.post(
    "/webapp/api/v2/admin/live-ops/campaign/dispatch",
    {
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            dry_run: { type: "boolean" },
            max_recipients: { type: "integer", minimum: 1, maximum: 500 },
            reason: { type: "string", maxLength: 240 },
            campaign: { type: "object" }
          }
        }
      }
    },
    async (request, reply) => {
      const authState = await requireAdminProfile(request.body, reply);
      if (!authState) {
        return;
      }
      if (dispatchSchema) {
        const parsed = dispatchSchema.safeParse(request.body);
        if (!parsed.success) {
          reply.code(400).send({
            success: false,
            error: "invalid_live_ops_campaign_dispatch_payload",
            details: formatZodIssues(parsed.error)
          });
          return;
        }
      }
      const result = await service.dispatchCampaign({
        adminId: Number(authState.auth.uid || 0),
        dryRun: request.body.dry_run !== false,
        maxRecipients: request.body.max_recipients,
        reason: request.body.reason,
        campaign: request.body.campaign
      });
      if (!result?.ok) {
        const reason = String(result?.reason || "live_ops_campaign_dispatch_failed");
        const statusCode =
          reason === "campaign_not_ready" ||
          reason === "campaign_approval_required" ||
          reason === "campaign_schedule_closed" ||
          reason === "campaign_schedule_expired" ||
          reason === "campaign_schedule_invalid"
            ? 409
            : reason === "service_disabled"
              ? 503
              : 502;
        reply.code(statusCode).send({ success: false, error: reason, data: result?.campaign ? { campaign: result.campaign } : undefined });
        return;
      }
      if (dispatchResponseSchema) {
        const parsed = dispatchResponseSchema.safeParse(result.data || {});
        if (!parsed.success) {
          reply.code(500).send({ success: false, error: "live_ops_campaign_dispatch_response_invalid" });
          return;
        }
      }
      reply.send({
        success: true,
        session: issueWebAppSession(authState.auth.uid),
        data: result.data
      });
    }
  );
}

module.exports = {
  registerWebappV2AdminLiveOpsRoutes
};
