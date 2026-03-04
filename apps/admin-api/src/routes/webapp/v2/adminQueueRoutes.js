"use strict";

const { buildActionPayloadHash, createRequireActionRequestIdPreValidation } = require("../shared/actionRequestGuard");

const IDEMPOTENCY_FALLBACK_TTL_MS = 15 * 60 * 1000;
const queueActionIdempotencyFallback = new Map();

function cleanupQueueActionFallback(now = Date.now()) {
  for (const [key, entry] of queueActionIdempotencyFallback.entries()) {
    const expiresAt = Number(entry && typeof entry === "object" ? entry.expiresAt : entry);
    if (!expiresAt || expiresAt <= now) {
      queueActionIdempotencyFallback.delete(key);
    }
  }
}

function reserveQueueActionFallback(idempotencyKey, payloadHash, ttlMs = IDEMPOTENCY_FALLBACK_TTL_MS) {
  const now = Date.now();
  cleanupQueueActionFallback(now);
  const key = String(idempotencyKey || "").trim();
  if (!key) {
    return { ok: false, reason: "missing_idempotency_key" };
  }
  const existingRaw = queueActionIdempotencyFallback.get(key);
  const existing =
    existingRaw && typeof existingRaw === "object"
      ? {
          expiresAt: Number(existingRaw.expiresAt || 0),
          payloadHash: String(existingRaw.payloadHash || "")
        }
      : {
          expiresAt: Number(existingRaw || 0),
          payloadHash: ""
        };
  if (existing.expiresAt > now) {
    if (existing.payloadHash && payloadHash && existing.payloadHash !== String(payloadHash)) {
      return { ok: false, reason: "action_request_payload_conflict" };
    }
    return { ok: false, reason: "idempotency_conflict" };
  }
  queueActionIdempotencyFallback.set(key, {
    expiresAt: now + Math.max(1000, Number(ttlMs || IDEMPOTENCY_FALLBACK_TTL_MS)),
    payloadHash: String(payloadHash || "")
  });
  return { ok: true };
}

function normalizeUnifiedQueueActionPolicy(actionPolicy) {
  const input = actionPolicy && typeof actionPolicy === "object" ? actionPolicy : {};
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    const row = value && typeof value === "object" ? value : {};
    out[String(key)] = {
      allowed: Boolean(row.allowed),
      confirmation_required: Boolean(row.confirmation_required),
      cooldown_ms: Math.max(0, Number(row.cooldown_ms || 0))
    };
  }
  return out;
}

function normalizeUnifiedQueueItem(item) {
  const row = item && typeof item === "object" ? item : {};
  return {
    kind: String(row.kind || ""),
    request_id: Math.max(0, Number(row.request_id || 0)),
    status: String(row.status || ""),
    priority: Number(row.priority || 0),
    queue_age_sec: Math.max(0, Number(row.queue_age_sec || 0)),
    policy_reason_code: String(row.policy_reason_code || "policy_unknown"),
    policy_reason_text: String(row.policy_reason_text || "Policy reason missing."),
    action_policy: normalizeUnifiedQueueActionPolicy(row.action_policy),
    queue_key: String(row.queue_key || ""),
    user_id: Math.max(0, Number(row.user_id || 0)),
    queue_ts: row.queue_ts || null,
    payload: row.payload && typeof row.payload === "object" ? row.payload : {}
  };
}

function registerWebappV2AdminQueueRoutes(fastify, deps = {}) {
  const pool = deps.pool;
  const proxyWebAppApiV1 = deps.proxyWebAppApiV1;
  const verifyWebAppAuth = deps.verifyWebAppAuth;
  const issueWebAppSession = deps.issueWebAppSession;
  const getProfileByTelegram = deps.getProfileByTelegram;
  const policyService = deps.policyService;
  const adminCriticalCooldownMs = Math.max(1000, Number(deps.adminCriticalCooldownMs || 8000));

  if (!pool || typeof pool.connect !== "function") {
    throw new Error("registerWebappV2AdminQueueRoutes requires pool");
  }
  if (typeof proxyWebAppApiV1 !== "function") {
    throw new Error("registerWebappV2AdminQueueRoutes requires proxyWebAppApiV1");
  }
  if (typeof verifyWebAppAuth !== "function") {
    throw new Error("registerWebappV2AdminQueueRoutes requires verifyWebAppAuth");
  }
  if (typeof issueWebAppSession !== "function") {
    throw new Error("registerWebappV2AdminQueueRoutes requires issueWebAppSession");
  }
  if (typeof getProfileByTelegram !== "function") {
    throw new Error("registerWebappV2AdminQueueRoutes requires getProfileByTelegram");
  }
  if (!policyService || typeof policyService.requireCriticalAdminConfirmation !== "function") {
    throw new Error("registerWebappV2AdminQueueRoutes requires policyService");
  }

  fastify.get("/webapp/api/v2/admin/queue/unified", async (request, reply) => {
    await proxyWebAppApiV1(request, reply, {
      targetPath: "/webapp/api/admin/queue/unified",
      method: "GET",
      transform: (payload) => {
        if (!payload || typeof payload !== "object") {
          return payload;
        }
        if (!payload.data || typeof payload.data !== "object") {
          payload.data = {};
        }
        payload.data.api_version = "v2";
        payload.data.items = Array.isArray(payload.data.items)
          ? payload.data.items.map((item) => normalizeUnifiedQueueItem(item))
          : [];
        payload.data.counts =
          payload.data.counts && typeof payload.data.counts === "object"
            ? payload.data.counts
            : {
                payout_queue: 0,
                token_manual_queue: 0,
                token_auto_decisions: 0,
                kyc_manual_queue: 0
              };
        payload.data.policy_counts =
          payload.data.policy_counts && typeof payload.data.policy_counts === "object"
            ? payload.data.policy_counts
            : {
                confirmation_required: 0,
                high_priority: 0
              };
        return payload;
      }
    });
  });

  fastify.post(
    "/webapp/api/v2/admin/queue/action",
    {
      preValidation: createRequireActionRequestIdPreValidation({ field: "action_request_id", statusCode: 400 }),
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig", "action_key", "request_id", "action_request_id"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            action_key: { type: "string", minLength: 3, maxLength: 64 },
            kind: { type: "string", minLength: 3, maxLength: 64 },
            request_id: { type: "integer", minimum: 1 },
            action_request_id: { type: "string", minLength: 6, maxLength: 120, pattern: "^[a-zA-Z0-9:_-]{6,120}$" },
            confirm_token: { type: "string", minLength: 16, maxLength: 128 },
            reason: { type: "string", maxLength: 300 },
            tx_hash: { type: "string", maxLength: 180 }
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

      const actionKey = String(request.body.action_key || "").trim().toLowerCase();
      const kind = String(request.body.kind || "").trim().toLowerCase();
      const requestId = Math.max(0, Number(request.body.request_id || 0));
      const actionRequestId = String(request.adminActionRequestId || request.body.action_request_id || "").trim();
      if (!actionKey || requestId <= 0) {
        reply.code(400).send({ success: false, error: "invalid_admin_queue_action_payload" });
        return;
      }

      const confirmToken = String(request.body.confirm_token || "").trim();
      const basePayload = {
        uid: request.body.uid,
        ts: request.body.ts,
        sig: request.body.sig
      };
      basePayload.action_request_id = actionRequestId;
      if (confirmToken) {
        basePayload.confirm_token = confirmToken;
      }

      let targetPath = "";
      const forwardPayload = { ...basePayload, request_id: requestId };
      let reason = "";
      let txHash = "";
      if (actionKey === "payout_pay") {
        if (kind && kind !== "payout_request") {
          reply.code(400).send({ success: false, error: "invalid_admin_queue_action_kind" });
          return;
        }
        txHash = String(request.body.tx_hash || "").trim();
        if (!txHash) {
          reply.code(400).send({ success: false, error: "tx_hash_required" });
          return;
        }
        targetPath = "/webapp/api/admin/payout/pay";
        forwardPayload.tx_hash = txHash;
      } else if (actionKey === "payout_reject") {
        if (kind && kind !== "payout_request") {
          reply.code(400).send({ success: false, error: "invalid_admin_queue_action_kind" });
          return;
        }
        targetPath = "/webapp/api/admin/payout/reject";
        reason = String(request.body.reason || "").trim() || "rejected_by_admin";
        forwardPayload.reason = reason;
      } else if (actionKey === "token_approve") {
        if (kind && kind !== "token_manual_review" && kind !== "token_auto_decision") {
          reply.code(400).send({ success: false, error: "invalid_admin_queue_action_kind" });
          return;
        }
        targetPath = "/webapp/api/admin/token/approve";
      } else if (actionKey === "token_reject") {
        if (kind && kind !== "token_manual_review" && kind !== "token_auto_decision") {
          reply.code(400).send({ success: false, error: "invalid_admin_queue_action_kind" });
          return;
        }
        targetPath = "/webapp/api/admin/token/reject";
        reason = String(request.body.reason || "").trim() || "rejected_by_admin";
        forwardPayload.reason = reason;
      } else if (actionKey === "kyc_approve" || actionKey === "kyc_reject" || actionKey === "kyc_block") {
        if (kind && kind !== "kyc_manual_review") {
          reply.code(400).send({ success: false, error: "invalid_admin_queue_action_kind" });
          return;
        }
        targetPath = "/webapp/api/admin/kyc/decision";
        const decision = actionKey === "kyc_approve" ? "approve" : actionKey === "kyc_reject" ? "reject" : "block";
        reason =
          String(request.body.reason || "").trim() ||
          (decision === "approve" ? "approved_by_admin" : decision === "reject" ? "rejected_by_admin" : "blocked_by_admin");
        forwardPayload.decision = decision;
        forwardPayload.reason = reason;
      } else {
        reply.code(400).send({ success: false, error: "unsupported_admin_queue_action" });
        return;
      }

      const queueCriticalAction = `queue_${actionKey}`;
      const confirmation = await policyService.requireCriticalAdminConfirmation({
        db: pool,
        actionKey: queueCriticalAction,
        adminId: Number(auth.uid || 0),
        payload: {
          kind,
          request_id: requestId,
          action_request_id: actionRequestId,
          reason,
          tx_hash: txHash
        },
        confirmToken
      });
      if (!confirmation.ok) {
        reply.code(409).send({
          success: false,
          error: confirmation.error,
          session: issueWebAppSession(auth.uid),
          data: {
            action_key: String(confirmation.policy?.action_key || queueCriticalAction),
            action_request_id: actionRequestId,
            confirmation_required: true,
            confirm_token: confirmation.signature,
            expires_in_sec: Number(confirmation.expires_in_sec || 0),
            cooldown_ms: Number(confirmation.policy?.cooldown_ms || adminCriticalCooldownMs)
          }
        });
        return;
      }
      const cooldown = await policyService.enforceCriticalAdminCooldown({
        db: pool,
        actionKey: queueCriticalAction,
        adminId: Number(auth.uid || 0),
        cooldownMs: adminCriticalCooldownMs
      });
      if (!cooldown.ok) {
        reply.code(429).send({
          success: false,
          error: "admin_cooldown_active",
          session: issueWebAppSession(auth.uid),
          data: {
            action_key: String(cooldown.policy?.action_key || queueCriticalAction),
            wait_sec: Number(cooldown.wait_sec || 1),
            cooldown_ms: Number(cooldown.policy?.cooldown_ms || adminCriticalCooldownMs)
          }
        });
        return;
      }

      const idempotencyKey = policyService.buildQueueActionIdempotencyKey({
        uid: auth.uid,
        actionKey,
        kind,
        requestId,
        actionRequestId,
        confirmToken,
        reason,
        txHash
      });
      const idempotencyContext = {
        uid: auth.uid,
        actionKey,
        kind,
        requestId,
        actionRequestId,
        confirmToken,
        reason,
        txHash,
        decision: String(forwardPayload.decision || "")
      };
      const actionPayloadHash =
        typeof policyService.buildQueueActionPayloadHash === "function"
          ? String(policyService.buildQueueActionPayloadHash(idempotencyContext) || "")
          : buildActionPayloadHash(idempotencyContext);
      const fallbackIdempotency = reserveQueueActionFallback(idempotencyKey, actionPayloadHash);
      if (!fallbackIdempotency.ok) {
        if (fallbackIdempotency.reason === "action_request_payload_conflict") {
          fastify.log.warn(
            {
              event: "admin_queue_action_request_payload_conflict",
              uid: Number(auth.uid || 0),
              action_key: actionKey,
              request_id: requestId,
              action_request_id: actionRequestId
            },
            "Queue action replay with different payload."
          );
        }
        reply.code(409).send({
          success: false,
          error: fallbackIdempotency.reason === "action_request_payload_conflict" ? "action_request_payload_conflict" : "idempotency_conflict",
          data: {
            action_request_id: actionRequestId
          }
        });
        return;
      }
      let queueActionEventAvailable = true;
      const queueActionEventClient = await pool.connect();
      try {
        let adminUserId = null;
        try {
          const adminProfile = await getProfileByTelegram(queueActionEventClient, auth.uid);
          const parsedUserId = Number(adminProfile?.user_id || 0);
          adminUserId = parsedUserId > 0 ? parsedUserId : null;
        } catch (profileErr) {
          if (profileErr.code !== "42P01") {
            throw profileErr;
          }
        }
        await queueActionEventClient.query(
          `INSERT INTO v5_unified_admin_queue_action_events
             (kind, request_id, action_key, status, admin_user_id, confirm_token, reason, tx_hash, payload_json, idempotency_key)
           VALUES
             ($1, $2, $3, 'queued', $4, $5, $6, $7, $8::jsonb, $9);`,
          [
            kind || "",
            requestId,
            actionKey,
            adminUserId,
            confirmToken,
            reason,
            txHash,
            JSON.stringify({
              uid: String(auth.uid || ""),
              action_key: actionKey,
              kind: kind || null,
              request_id: requestId,
              action_request_id: actionRequestId,
              payload_hash: actionPayloadHash,
              confirm_token: confirmToken || null,
              reason: reason || null,
              tx_hash: txHash || null
            }),
            idempotencyKey
          ]
        );
      } catch (err) {
        if (err.code === "23505") {
          const existing = await queueActionEventClient
            .query(
              `SELECT payload_json
                 FROM v5_unified_admin_queue_action_events
                WHERE idempotency_key = $1
                ORDER BY id DESC
                LIMIT 1;`,
              [idempotencyKey]
            )
            .then((res) => res.rows?.[0] || null)
            .catch(() => null);
          const existingPayloadHash = String(existing?.payload_json?.payload_hash || existing?.payload_json?.idempotency_context?.payload_hash || "");
          if (existingPayloadHash && actionPayloadHash && existingPayloadHash !== actionPayloadHash) {
            fastify.log.warn(
              {
                event: "admin_queue_action_request_payload_conflict",
                uid: Number(auth.uid || 0),
                action_key: actionKey,
                request_id: requestId,
                action_request_id: actionRequestId
              },
              "Queue action replay with different payload."
            );
            reply.code(409).send({
              success: false,
              error: "action_request_payload_conflict",
              data: {
                action_request_id: actionRequestId
              }
            });
            return;
          }
          reply.code(409).send({ success: false, error: "idempotency_conflict" });
          return;
        }
        if (err.code === "42P01") {
          queueActionEventAvailable = false;
        } else {
          throw err;
        }
      } finally {
        queueActionEventClient.release();
      }

      const injectRes = await fastify.inject({
        method: "POST",
        url: targetPath,
        payload: forwardPayload
      });
      let payload = null;
      try {
        payload = JSON.parse(injectRes.payload);
      } catch {
        payload = null;
      }

      if (queueActionEventAvailable) {
        const resultPayload =
          payload && typeof payload === "object"
            ? payload
            : {
                raw_payload: String(injectRes.payload || ""),
                status_code: injectRes.statusCode
              };
        const resultStatus = injectRes.statusCode >= 200 && injectRes.statusCode < 300 ? "completed" : "failed";
        const queueActionResultClient = await pool.connect();
        try {
          await queueActionResultClient.query(
            `UPDATE v5_unified_admin_queue_action_events
             SET status = $1, result_json = $2::jsonb
             WHERE idempotency_key = $3;`,
            [resultStatus, JSON.stringify(resultPayload), idempotencyKey]
          );
        } catch (err) {
          if (err.code !== "42P01") {
            throw err;
          }
        } finally {
          queueActionResultClient.release();
        }
      }

      if (payload && typeof payload === "object") {
        if (!payload.data || typeof payload.data !== "object") {
          payload.data = {};
        }
        payload.data.api_version = "v2";
        payload.data.action_key = actionKey;
        payload.data.kind = kind || null;
        payload.data.request_id = requestId;
        payload.data.action_request_id = actionRequestId;
        reply.code(injectRes.statusCode).send(payload);
        return;
      }
      reply
        .code(injectRes.statusCode)
        .type(String(injectRes.headers["content-type"] || "application/json; charset=utf-8"))
        .send(injectRes.payload);
    }
  );
}

module.exports = {
  registerWebappV2AdminQueueRoutes
};
