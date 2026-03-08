"use strict";

const { createKpiOpsService } = require("../../../services/kpi/kpiOpsService");
const { createLiveOpsChatCampaignService } = require("../../../services/liveOpsChatCampaignService");

function parseNumericInput(value) {
  if (value == null || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return parsed;
}

function parseBooleanInput(value) {
  if (value == null || value === "") {
    return undefined;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return undefined;
}

function normalizeBreakdownRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .map((row) => ({
      bucket_key: String(row?.bucket_key || "unknown"),
      item_count: Math.max(0, Number(row?.item_count || 0))
    }))
    .filter((row) => row.bucket_key)
    .slice(0, 8);
}

function normalizeDailyRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .map((row) => ({
      day: String(row?.day || ""),
      sent_count: Math.max(0, Number(row?.sent_count || 0)),
      unique_users: Math.max(0, Number(row?.unique_users || 0))
    }))
    .filter((row) => row.day)
    .slice(0, 7);
}

function buildLiveOpsCampaignKpiSummary(snapshot) {
  const safeSnapshot = snapshot && typeof snapshot === "object" ? snapshot : {};
  const campaign = safeSnapshot.campaign && typeof safeSnapshot.campaign === "object" ? safeSnapshot.campaign : {};
  const approval = safeSnapshot.approval_summary && typeof safeSnapshot.approval_summary === "object" ? safeSnapshot.approval_summary : {};
  const scheduler = safeSnapshot.scheduler_summary && typeof safeSnapshot.scheduler_summary === "object" ? safeSnapshot.scheduler_summary : {};
  const delivery = safeSnapshot.delivery_summary && typeof safeSnapshot.delivery_summary === "object" ? safeSnapshot.delivery_summary : {};
  const sceneRuntime = safeSnapshot.scene_runtime_summary && typeof safeSnapshot.scene_runtime_summary === "object"
    ? safeSnapshot.scene_runtime_summary
    : {};
  const latestDispatch = safeSnapshot.latest_dispatch && typeof safeSnapshot.latest_dispatch === "object" ? safeSnapshot.latest_dispatch : {};
  return {
    available: true,
    error_code: "",
    campaign_key: String(campaign.campaign_key || ""),
    version: Math.max(0, Number(safeSnapshot.version || 0)),
    enabled: campaign.enabled === true,
    status: String(campaign.status || ""),
    approval_state: String(approval.approval_state || "not_requested"),
    schedule_state: String(scheduler.schedule_state || approval.schedule_state || "missing"),
    ready_for_auto_dispatch: scheduler.ready_for_auto_dispatch === true,
    latest_dispatch_ref: String(latestDispatch.last_dispatch_ref || ""),
    latest_dispatch_at: latestDispatch.last_sent_at || null,
    latest_auto_dispatch_ref: String(scheduler.latest_auto_dispatch_ref || ""),
    latest_auto_dispatch_at: scheduler.latest_auto_dispatch_at || null,
    sent_24h: Math.max(0, Number(delivery.sent_24h || 0)),
    sent_7d: Math.max(0, Number(delivery.sent_7d || 0)),
    unique_users_7d: Math.max(0, Number(delivery.unique_users_7d || 0)),
    experiment_key: String(delivery.experiment_key || "webapp_react_v1"),
    experiment_assignment_available: delivery.experiment_assignment_available === true,
    daily_breakdown: normalizeDailyRows(delivery.daily_breakdown),
    locale_breakdown: normalizeBreakdownRows(delivery.locale_breakdown),
    segment_breakdown: normalizeBreakdownRows(delivery.segment_breakdown),
    surface_breakdown: normalizeBreakdownRows(delivery.surface_breakdown),
    variant_breakdown: normalizeBreakdownRows(delivery.variant_breakdown),
    cohort_breakdown: normalizeBreakdownRows(delivery.cohort_breakdown),
    scene_runtime: sceneRuntime
  };
}

async function getLiveOpsCampaignKpiSummary(service, logger) {
  try {
    const snapshot = await service.getCampaignSnapshot();
    return buildLiveOpsCampaignKpiSummary(snapshot);
  } catch (err) {
    if (logger && typeof logger.warn === "function") {
      logger.warn({ err }, "live_ops_campaign_kpi_summary_failed");
    }
    return {
      available: false,
      error_code: String(err?.code || err?.message || "live_ops_campaign_kpi_summary_failed"),
      campaign_key: "",
      version: 0,
      enabled: false,
      status: "",
      approval_state: "not_requested",
      schedule_state: "missing",
      ready_for_auto_dispatch: false,
      latest_dispatch_ref: "",
      latest_dispatch_at: null,
      latest_auto_dispatch_ref: "",
      latest_auto_dispatch_at: null,
      sent_24h: 0,
      sent_7d: 0,
      unique_users_7d: 0,
      experiment_key: "webapp_react_v1",
      experiment_assignment_available: false,
      daily_breakdown: [],
      locale_breakdown: [],
      segment_breakdown: [],
      surface_breakdown: [],
      variant_breakdown: [],
      cohort_breakdown: [],
      scene_runtime: {}
    };
  }
}

function registerWebappV2AdminOpsRoutes(fastify, deps = {}) {
  const pool = deps.pool;
  const verifyWebAppAuth = deps.verifyWebAppAuth;
  const requireWebAppAdmin = deps.requireWebAppAdmin;
  const issueWebAppSession = deps.issueWebAppSession;
  const contracts = deps.contracts || {};
  const repoRootDir = deps.repoRootDir || process.cwd();
  const logger = deps.logger || fastify.log;

  if (!pool || typeof pool.connect !== "function") {
    throw new Error("registerWebappV2AdminOpsRoutes requires pg pool");
  }
  if (typeof verifyWebAppAuth !== "function") {
    throw new Error("registerWebappV2AdminOpsRoutes requires verifyWebAppAuth");
  }
  if (typeof requireWebAppAdmin !== "function") {
    throw new Error("registerWebappV2AdminOpsRoutes requires requireWebAppAdmin");
  }
  if (typeof issueWebAppSession !== "function") {
    throw new Error("registerWebappV2AdminOpsRoutes requires issueWebAppSession");
  }

  const service = deps.service || createKpiOpsService({ repoRootDir, pool, logger });
  const liveOpsService =
    deps.liveOpsService ||
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
  const latestResponseSchema = contracts.KpiBundleSnapshotResponseSchema;
  const runRequestSchema = contracts.KpiBundleRunRequestSchema;
  const snapshotSchema = contracts.KpiBundleSnapshotSchema;

  fastify.get(
    "/webapp/api/v2/admin/ops/kpi/latest",
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
      const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
      if (!auth.ok) {
        reply.code(401).send({ success: false, error: auth.reason });
        return;
      }

      const client = await pool.connect();
      try {
        const profile = await requireWebAppAdmin(client, reply, auth.uid);
        if (!profile) {
          return;
        }
      } finally {
        client.release();
      }

      try {
        const latest = await service.getLatestBundle();
        const webappExperiment = await service.getWebappExperimentSummary({
          experiment_key: "webapp_react_v1"
        });
        const liveOpsCampaign = await getLiveOpsCampaignKpiSummary(liveOpsService, logger);
        const parsedSnapshot = snapshotSchema ? snapshotSchema.safeParse(latest.bundle) : { success: true, data: latest.bundle };
        if (!parsedSnapshot.success) {
          logger.warn({ issues: parsedSnapshot.error?.issues || [] }, "kpi_latest_schema_validation_failed");
          reply.code(500).send({ success: false, error: "kpi_snapshot_contract_invalid" });
          return;
        }

        const payload = {
          api_version: "v2",
          snapshot: parsedSnapshot.data,
          source: "docs_latest",
          webapp_experiment: webappExperiment,
          live_ops_campaign: liveOpsCampaign
        };
        if (latestResponseSchema) {
          const parsedPayload = latestResponseSchema.safeParse(payload);
          if (!parsedPayload.success) {
            logger.warn({ issues: parsedPayload.error?.issues || [] }, "kpi_latest_response_schema_validation_failed");
            reply.code(500).send({ success: false, error: "kpi_latest_response_invalid" });
            return;
          }
        }

        reply.send({
          success: true,
          session: issueWebAppSession(auth.uid),
          data: {
            ...payload,
            updated_at: latest.updated_at
          }
        });
      } catch (err) {
        if (err.code === "kpi_bundle_not_found") {
          reply.code(404).send({ success: false, error: "kpi_bundle_not_found" });
          return;
        }
        throw err;
      }
    }
  );

  fastify.post(
    "/webapp/api/v2/admin/ops/kpi/run",
    {
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            hours_short: { type: "integer", minimum: 1, maximum: 168 },
            hours_long: { type: "integer", minimum: 1, maximum: 168 },
            trend_days: { type: "integer", minimum: 1, maximum: 30 },
            emit_slo: { type: "boolean" }
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
        const profile = await requireWebAppAdmin(client, reply, auth.uid);
        if (!profile) {
          return;
        }
      } finally {
        client.release();
      }

      const requestPayload = {
        uid: String(request.body.uid || ""),
        ts: String(request.body.ts || ""),
        sig: String(request.body.sig || ""),
        hours_short: parseNumericInput(request.body.hours_short),
        hours_long: parseNumericInput(request.body.hours_long),
        trend_days: parseNumericInput(request.body.trend_days),
        emit_slo: parseBooleanInput(request.body.emit_slo)
      };
      if (runRequestSchema) {
        const parseRequest = runRequestSchema.safeParse(requestPayload);
        if (!parseRequest.success) {
          reply.code(400).send({
            success: false,
            error: "invalid_kpi_run_payload",
            details: parseRequest.error.issues.map((issue) => ({
              path: issue.path,
              message: issue.message
            }))
          });
          return;
        }
      }

      const run = await service.runBundle({
        requestedBy: Number(auth.uid || 0),
        config: requestPayload
      });
      const webappExperiment = await service.getWebappExperimentSummary({
        experiment_key: "webapp_react_v1"
      });
      const liveOpsCampaign = await getLiveOpsCampaignKpiSummary(liveOpsService, logger);

      if (!run.snapshot) {
        reply.code(502).send({
          success: false,
          error: "kpi_bundle_run_missing_snapshot",
          data: {
            run_ref: run.run_ref,
            status: run.status,
            exit_code: run.exit_code,
            stderr: String(run.stderr || "").slice(0, 500)
          }
        });
        return;
      }

      const parsedSnapshot = snapshotSchema ? snapshotSchema.safeParse(run.snapshot) : { success: true, data: run.snapshot };
      if (!parsedSnapshot.success) {
        logger.warn({ issues: parsedSnapshot.error?.issues || [] }, "kpi_run_snapshot_schema_validation_failed");
        reply.code(500).send({ success: false, error: "kpi_snapshot_contract_invalid" });
        return;
      }

      const payload = {
        api_version: "v2",
        source: "kpi_bundle_runner",
        snapshot: parsedSnapshot.data,
        webapp_experiment: webappExperiment,
        live_ops_campaign: liveOpsCampaign,
        run: {
          run_ref: run.run_ref,
          status: run.status,
          duration_ms: run.duration_ms,
          started_at: run.started_at,
          finished_at: run.finished_at
        }
      };
      if (latestResponseSchema) {
        const parsedPayload = latestResponseSchema.safeParse(payload);
        if (!parsedPayload.success) {
          logger.warn({ issues: parsedPayload.error?.issues || [] }, "kpi_run_response_schema_validation_failed");
          reply.code(500).send({ success: false, error: "kpi_run_response_invalid" });
          return;
        }
      }

      const statusCode = run.status === "success" ? 200 : 502;
      reply.code(statusCode).send({
        success: run.status === "success",
        session: issueWebAppSession(auth.uid),
        data: {
          ...payload,
          exit_code: run.exit_code,
          signal: run.signal,
          stdout_tail: String(run.stdout || "").split("\n").slice(-8).join("\n"),
          stderr_tail: String(run.stderr || "").split("\n").slice(-8).join("\n")
        }
      });
    }
  );
}

module.exports = {
  registerWebappV2AdminOpsRoutes
};
