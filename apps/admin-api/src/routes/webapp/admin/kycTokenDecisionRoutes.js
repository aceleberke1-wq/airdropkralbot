"use strict";

const { createRequireActionRequestIdPreValidation } = require("../shared/actionRequestGuard");

function registerWebappAdminKycTokenDecisionRoutes(fastify, deps = {}) {
  const pool = deps.pool;
  const verifyWebAppAuth = deps.verifyWebAppAuth;
  const issueWebAppSession = deps.issueWebAppSession;
  const requireWebAppAdmin = deps.requireWebAppAdmin;
  const normalizeKycDecision = deps.normalizeKycDecision;
  const hasKycTables = deps.hasKycTables;
  const readKycProfile = deps.readKycProfile;
  const listWalletLinks = deps.listWalletLinks;
  const upsertKycProfile = deps.upsertKycProfile;
  const insertKycScreeningEvent = deps.insertKycScreeningEvent;
  const normalizeKycState = deps.normalizeKycState;
  const configService = deps.configService;
  const buildAdminSummary = deps.buildAdminSummary;
  const tokenStore = deps.tokenStore;
  const validateAndVerifyTokenTx = deps.validateAndVerifyTokenTx;
  const tokenEngine = deps.tokenEngine;
  const economyStore = deps.economyStore;
  const deterministicUuid = deps.deterministicUuid;

  if (!pool || typeof pool.connect !== "function") {
    throw new Error("registerWebappAdminKycTokenDecisionRoutes requires pool");
  }
  for (const [name, value] of Object.entries({
    verifyWebAppAuth,
    issueWebAppSession,
    requireWebAppAdmin,
    normalizeKycDecision,
    hasKycTables,
    readKycProfile,
    listWalletLinks,
    upsertKycProfile,
    insertKycScreeningEvent,
    normalizeKycState,
    buildAdminSummary,
    validateAndVerifyTokenTx,
    deterministicUuid
  })) {
    if (typeof value !== "function") {
      throw new Error(`registerWebappAdminKycTokenDecisionRoutes requires ${name}`);
    }
  }
  if (!configService || typeof configService.getEconomyConfig !== "function") {
    throw new Error("registerWebappAdminKycTokenDecisionRoutes requires configService.getEconomyConfig");
  }
  if (!tokenStore || typeof tokenStore.lockPurchaseRequest !== "function") {
    throw new Error("registerWebappAdminKycTokenDecisionRoutes requires tokenStore purchase methods");
  }
  if (!tokenEngine || typeof tokenEngine.normalizeTokenConfig !== "function") {
    throw new Error("registerWebappAdminKycTokenDecisionRoutes requires tokenEngine.normalizeTokenConfig");
  }
  if (!economyStore || typeof economyStore.creditCurrency !== "function") {
    throw new Error("registerWebappAdminKycTokenDecisionRoutes requires economyStore.creditCurrency");
  }
  const requireActionRequestId = createRequireActionRequestIdPreValidation({ field: "action_request_id", statusCode: 400 });

  fastify.post(
    "/webapp/api/admin/kyc/decision",
    {
      preValidation: requireActionRequestId,
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig", "request_id", "decision", "action_request_id"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            request_id: { type: "integer", minimum: 1 },
            action_request_id: { type: "string", minLength: 6, maxLength: 120, pattern: "^[a-zA-Z0-9:_-]{6,120}$" },
            decision: { type: "string", minLength: 3, maxLength: 32 },
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
      const targetUserId = Number(request.body.request_id || 0);
      if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
        reply.code(400).send({ success: false, error: "invalid_id" });
        return;
      }
      const decision = normalizeKycDecision(request.body.decision);
      if (!decision) {
        reply.code(400).send({ success: false, error: "invalid_kyc_decision" });
        return;
      }
      const reason =
        String(request.body.reason || "").trim() ||
        (decision === "approve" ? "approved_by_admin" : decision === "reject" ? "rejected_by_admin" : "blocked_by_admin");

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const profile = await requireWebAppAdmin(client, reply, auth.uid);
        if (!profile) {
          await client.query("ROLLBACK");
          return;
        }
        const kycTablesReady = await hasKycTables(client);
        if (!kycTablesReady) {
          await client.query("ROLLBACK");
          reply.code(503).send({ success: false, error: "kyc_tables_missing" });
          return;
        }

        const currentProfile = await readKycProfile(client, targetUserId);
        if (!currentProfile) {
          await client.query("ROLLBACK");
          reply.code(404).send({ success: false, error: "kyc_profile_not_found" });
          return;
        }

        const currentPayload =
          currentProfile.payload_json && typeof currentProfile.payload_json === "object" ? currentProfile.payload_json : {};
        const walletLinks = await listWalletLinks(client, targetUserId).catch((err) => {
          if (err.code === "42P01") return [];
          throw err;
        });
        const primaryWallet = walletLinks.find((row) => row && row.is_primary) || walletLinks[0] || {};
        const riskScore = Number(primaryWallet.risk_score ?? currentPayload.risk_score ?? 0);
        let nextStatus = "pending";
        let nextTier = String(currentProfile.tier || "threshold_review");
        let screeningResult = "manual_review";
        let reasonCode = "manual_review";
        if (decision === "approve") {
          nextStatus = "approved";
          nextTier = nextTier === "none" ? "threshold_review_passed" : nextTier;
          screeningResult = "pass";
          reasonCode = "manual_approve";
        } else if (decision === "reject") {
          nextStatus = "rejected";
          nextTier = nextTier === "none" ? "threshold_review_rejected" : nextTier;
          screeningResult = "manual_review";
          reasonCode = "manual_reject";
        } else if (decision === "block") {
          nextStatus = "blocked";
          nextTier = "blocked";
          screeningResult = "blocked";
          reasonCode = "manual_block";
        }

        const updatedProfile = await upsertKycProfile(client, {
          user_id: targetUserId,
          status: nextStatus,
          tier: nextTier,
          provider_ref: "admin_manual",
          payload_json: {
            ...currentPayload,
            reason_code: reasonCode,
            review_decision: decision,
            review_reason: reason,
            reviewed_by: Number(auth.uid || 0),
            reviewed_at: new Date().toISOString(),
            previous_status: String(currentProfile.status || "unknown"),
            previous_tier: String(currentProfile.tier || "none")
          }
        });

        await insertKycScreeningEvent(client, {
          user_id: targetUserId,
          chain: String(primaryWallet.chain || "manual"),
          address_norm: String(primaryWallet.address_norm || ""),
          screening_result: screeningResult,
          risk_score: Number.isFinite(riskScore) ? riskScore : 0,
          reason_code: reasonCode,
          payload_json: {
            source: "admin_manual_decision",
            decision,
            reason,
            admin_uid: Number(auth.uid || 0)
          }
        });

        await client
          .query(
            `UPDATE v5_wallet_links
             SET kyc_status = $2,
                 updated_at = now(),
                 metadata_json = COALESCE(metadata_json, '{}'::jsonb) || $3::jsonb
             WHERE user_id = $1
               AND unlinked_at IS NULL;`,
            [
              targetUserId,
              nextStatus,
              JSON.stringify({
                kyc_decision: decision,
                kyc_reason: reason,
                kyc_reason_code: reasonCode,
                reviewed_by: Number(auth.uid || 0),
                reviewed_at: new Date().toISOString()
              })
            ]
          )
          .catch((err) => {
            if (err.code !== "42P01") {
              throw err;
            }
          });

        await client.query(
          `INSERT INTO admin_audit (admin_id, action, target, payload_json)
           VALUES ($1, 'kyc_manual_decision', $2, $3::jsonb);`,
          [
            Number(auth.uid),
            `kyc_profile:${targetUserId}`,
            JSON.stringify({
              request_id: targetUserId,
              decision,
              reason,
              reason_code: reasonCode,
              previous_status: String(currentProfile.status || "unknown"),
              previous_tier: String(currentProfile.tier || "none"),
              next_status: nextStatus,
              next_tier: nextTier
            })
          ]
        );

        const runtimeConfig = await configService.getEconomyConfig(client);
        const summary = await buildAdminSummary(client, runtimeConfig);
        await client.query("COMMIT");
        const kycState = normalizeKycState(updatedProfile);
        reply.send({
          success: true,
          session: issueWebAppSession(auth.uid),
          data: {
            request: {
              user_id: Number(updatedProfile.user_id || targetUserId),
              status: String(updatedProfile.status || nextStatus),
              tier: String(updatedProfile.tier || nextTier),
              review_decision: decision,
              review_reason: reason
            },
            kyc_status: kycState,
            summary
          }
        });
      } catch (err) {
        await client.query("ROLLBACK");
        if (err.code === "42P01") {
          reply.code(503).send({ success: false, error: "kyc_tables_missing" });
          return;
        }
        throw err;
      } finally {
        client.release();
      }
    }
  );

  fastify.post(
    "/webapp/api/admin/token/approve",
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
            token_amount: { type: "number", minimum: 0.00000001 },
            tx_hash: { type: "string", minLength: 8, maxLength: 255 },
            note: { type: "string", maxLength: 500 }
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
      const requestId = Number(request.body.request_id);
      if (!Number.isFinite(requestId) || requestId <= 0) {
        reply.code(400).send({ success: false, error: "invalid_id" });
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
        if (String(locked.status) === "approved") {
          await client.query("ROLLBACK");
          reply.code(409).send({ success: false, error: "already_approved" });
          return;
        }
        if (String(locked.status) === "approved") {
          await client.query("ROLLBACK");
          reply.code(409).send({ success: false, error: "already_approved" });
          return;
        }

        const tokenAmount = Number(request.body.token_amount || locked.token_amount || 0);
        if (!Number.isFinite(tokenAmount) || tokenAmount <= 0) {
          await client.query("ROLLBACK");
          reply.code(400).send({ success: false, error: "invalid_token_amount" });
          return;
        }

        const txHashInput = String(request.body.tx_hash || locked.tx_hash || "").trim();
        const note = String(request.body.note || "").trim();

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
          adminId: Number(auth.uid),
          adminNote: note || `approved:${tokenAmount}`
        });

        await client.query(
          `INSERT INTO admin_audit (admin_id, action, target, payload_json)
           VALUES ($1, 'token_purchase_approve', $2, $3::jsonb);`,
          [
            Number(auth.uid),
            `token_purchase_request:${requestId}`,
            JSON.stringify({
              token_amount: tokenAmount,
              token_symbol: tokenSymbol,
              tx_hash: txCheck.formatCheck.normalizedHash
            })
          ]
        );

        const summary = await buildAdminSummary(client, runtimeConfig);
        await client.query("COMMIT");
        reply.send({
          success: true,
          session: issueWebAppSession(auth.uid),
          data: { request: updated, summary }
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
    "/webapp/api/admin/token/reject",
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
      const requestId = Number(request.body.request_id);
      if (!Number.isFinite(requestId) || requestId <= 0) {
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
          adminId: Number(auth.uid),
          reason
        });

        await client.query(
          `INSERT INTO admin_audit (admin_id, action, target, payload_json)
           VALUES ($1, 'token_purchase_reject', $2, $3::jsonb);`,
          [Number(auth.uid), `token_purchase_request:${requestId}`, JSON.stringify({ reason })]
        );

        const runtimeConfig = await configService.getEconomyConfig(client);
        const summary = await buildAdminSummary(client, runtimeConfig);
        await client.query("COMMIT");
        reply.send({
          success: true,
          session: issueWebAppSession(auth.uid),
          data: { request: updated, summary }
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
  registerWebappAdminKycTokenDecisionRoutes
};
