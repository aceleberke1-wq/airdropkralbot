"use strict";

const { createKpiOpsService } = require("../../../services/kpi/kpiOpsService");

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

  const service = createKpiOpsService({ repoRootDir, pool, logger });
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
        const parsedSnapshot = snapshotSchema ? snapshotSchema.safeParse(latest.bundle) : { success: true, data: latest.bundle };
        if (!parsedSnapshot.success) {
          logger.warn({ issues: parsedSnapshot.error?.issues || [] }, "kpi_latest_schema_validation_failed");
          reply.code(500).send({ success: false, error: "kpi_snapshot_contract_invalid" });
          return;
        }

        const payload = {
          api_version: "v2",
          snapshot: parsedSnapshot.data,
          source: "docs_latest"
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
