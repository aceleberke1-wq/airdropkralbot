"use strict";

function normalizeV2Payload(payload) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }
  if (!payload.data || typeof payload.data !== "object") {
    payload.data = {};
  }
  payload.data.api_version = "v2";
  return payload;
}

function registerWebappAdminPayoutReleaseRoutes(fastify, deps = {}) {
  const pool = deps.pool;
  const verifyWebAppAuth = deps.verifyWebAppAuth;
  const issueWebAppSession = deps.issueWebAppSession;
  const requireWebAppAdmin = deps.requireWebAppAdmin;
  const parseLimit = deps.parseLimit;
  const configService = deps.configService;
  const patchPayoutReleaseRuntimeConfig = deps.patchPayoutReleaseRuntimeConfig;
  const upsertFeatureFlag = deps.upsertFeatureFlag;
  const tokenEngine = deps.tokenEngine;
  const buildAdminSummary = deps.buildAdminSummary;
  const payoutStore = deps.payoutStore;
  const getProfileByUserId = deps.getProfileByUserId;
  const economyStore = deps.economyStore;
  const buildTokenSummary = deps.buildTokenSummary;
  const buildPayoutLockState = deps.buildPayoutLockState;
  const policyService = deps.policyService;
  const proxyWebAppApiV1 = deps.proxyWebAppApiV1;
  const adminCriticalCooldownMs = Math.max(1000, Number(deps.adminCriticalCooldownMs || 8000));

  if (!pool || typeof pool.connect !== "function") {
    throw new Error("registerWebappAdminPayoutReleaseRoutes requires pool");
  }
  for (const [name, value] of Object.entries({
    verifyWebAppAuth,
    issueWebAppSession,
    requireWebAppAdmin,
    parseLimit,
    patchPayoutReleaseRuntimeConfig,
    buildAdminSummary,
    getProfileByUserId,
    buildTokenSummary,
    buildPayoutLockState,
    proxyWebAppApiV1
  })) {
    if (typeof value !== "function") {
      throw new Error(`registerWebappAdminPayoutReleaseRoutes requires ${name}`);
    }
  }
  if (!policyService || typeof policyService.requireCriticalAdminConfirmation !== "function") {
    throw new Error("registerWebappAdminPayoutReleaseRoutes requires policyService");
  }

  fastify.post(
    "/webapp/api/admin/economy/payout-release",
    {
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            confirm_token: { type: "string", minLength: 16, maxLength: 128 },
            enabled: { type: "boolean" },
            mode: { type: "string", minLength: 2, maxLength: 48 },
            global_cap_min_usd: { type: "number", minimum: 1 },
            daily_drip_pct_max: { type: "number", minimum: 0, maximum: 100 },
            tier_rules: {
              type: "array",
              maxItems: 12,
              items: {
                type: "object",
                properties: {
                  tier: { type: "string", minLength: 2, maxLength: 8 },
                  min_score: { type: "number", minimum: 0, maximum: 1 },
                  drip_pct: { type: "number", minimum: 0, maximum: 1 }
                }
              }
            },
            score_weights: {
              type: "object",
              properties: {
                volume30d: { type: "number", minimum: 0 },
                mission30d: { type: "number", minimum: 0 },
                tenure30d: { type: "number", minimum: 0 }
              }
            }
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
      const patch = {};
      if (typeof request.body.enabled === "boolean") {
        patch.enabled = Boolean(request.body.enabled);
      }
      if (request.body.mode) {
        patch.mode = String(request.body.mode).trim().toLowerCase();
      }
      if (Number.isFinite(Number(request.body.global_cap_min_usd))) {
        patch.global_cap_min_usd = Math.max(1, Number(request.body.global_cap_min_usd));
      }
      if (Number.isFinite(Number(request.body.daily_drip_pct_max))) {
        patch.daily_drip_pct_max = Number(request.body.daily_drip_pct_max);
      }
      if (Array.isArray(request.body.tier_rules)) {
        patch.tier_rules = request.body.tier_rules.map((row) => ({
          tier: String(row?.tier || "").trim().toUpperCase(),
          min_score: Number(row?.min_score || 0),
          drip_pct: Number(row?.drip_pct || 0)
        }));
      }
      if (request.body.score_weights && typeof request.body.score_weights === "object") {
        patch.score_weights = {
          volume30d: Number(request.body.score_weights.volume30d || 0),
          mission30d: Number(request.body.score_weights.mission30d || 0),
          tenure30d: Number(request.body.score_weights.tenure30d || 0)
        };
      }
      if (Object.keys(patch).length === 0) {
        reply.code(400).send({ success: false, error: "no_patch_fields" });
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
        const confirmation = await policyService.requireCriticalAdminConfirmation({
          db: client,
          actionKey: "payout_release_update",
          adminId: Number(auth.uid),
          payload: { patch },
          confirmToken: request.body.confirm_token
        });
        if (!confirmation.ok) {
          await client.query("ROLLBACK");
          reply.code(409).send({
            success: false,
            error: confirmation.error,
            session: issueWebAppSession(auth.uid),
            data: {
              action_key: String(confirmation.policy?.action_key || "payout_release_update"),
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
          actionKey: "payout_release_update",
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
              action_key: String(cooldown.policy?.action_key || "payout_release_update"),
              wait_sec: Number(cooldown.wait_sec || 1),
              cooldown_ms: Number(cooldown.policy?.cooldown_ms || adminCriticalCooldownMs)
            }
          });
          return;
        }
        const result = await patchPayoutReleaseRuntimeConfig(client, auth.uid, patch);
        if (typeof request.body.enabled === "boolean") {
          await upsertFeatureFlag(client, {
            flagKey: "PAYOUT_RELEASE_V1_ENABLED",
            enabled: Boolean(request.body.enabled),
            updatedBy: Number(auth.uid),
            note: "updated via /webapp/api/admin/economy/payout-release"
          }).catch((err) => {
            if (err.code !== "42P01") throw err;
          });
        }
        const runtimeConfig = await configService.getEconomyConfig(client, { forceRefresh: true });
        const tokenConfig = tokenEngine.normalizeTokenConfig(runtimeConfig);
        const summary = await buildAdminSummary(client, runtimeConfig);
        await client.query("COMMIT");
        reply.send({
          success: true,
          session: issueWebAppSession(auth.uid),
          data: {
            version: Number(result.version || 0),
            payout_release: tokenConfig.payout_release || {},
            summary
          }
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
    "/webapp/api/admin/payout/release/run",
    {
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            confirm_token: { type: "string", minLength: 16, maxLength: 128 },
            limit: { type: "integer", minimum: 1, maximum: 200 },
            apply_rejections: { type: "boolean" }
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
      const limit = parseLimit(request.body.limit, 25, 200);
      const applyRejections = Boolean(request.body.apply_rejections);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const profile = await requireWebAppAdmin(client, reply, auth.uid);
        if (!profile) {
          await client.query("ROLLBACK");
          return;
        }
        const actionKey = applyRejections ? "payout_release_run_reject" : "payout_release_run";
        const confirmation = await policyService.requireCriticalAdminConfirmation({
          db: client,
          actionKey,
          adminId: Number(auth.uid),
          payload: { limit, apply_rejections: applyRejections },
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
        const runtimeConfig = await configService.getEconomyConfig(client);
        const requestedRows = await payoutStore.listRequests(client, { status: "requested", limit }).catch((err) => {
          if (err.code === "42P01") {
            return [];
          }
          throw err;
        });

        const decisions = [];
        let eligibleCount = 0;
        let rejectedCount = 0;
        for (const row of requestedRows) {
          const requestId = Number(row.id || 0);
          const userId = Number(row.user_id || 0);
          const amountBtc = Number(row.amount || 0);
          const targetProfile = await getProfileByUserId(client, userId);
          if (!targetProfile) {
            decisions.push({
              request_id: requestId,
              user_id: userId,
              amount_btc: amountBtc,
              eligible: false,
              reason: "user_not_found",
              policy_reason_code: "user_not_found",
              policy_reason_text: "User profile bulunamadi.",
              action: "skip"
            });
            continue;
          }
          const balances = await economyStore.getBalances(client, userId);
          const token = await buildTokenSummary(client, targetProfile, runtimeConfig, balances);
          const payoutLock = await buildPayoutLockState(client, targetProfile, runtimeConfig, balances, token);
          const globalGateOpen = Boolean(payoutLock.release?.global_gate_open);
          const unlockTier = String(payoutLock.release?.unlock_tier || "T0");
          const dripRemaining = Number(payoutLock.release?.today_drip_btc_remaining || 0);
          const lockEnabled = Boolean(payoutLock.release?.enabled);
          const eligible =
            !lockEnabled || (globalGateOpen && dripRemaining > 0 && amountBtc > 0 && amountBtc <= dripRemaining + 0.00000001);
          let reason = "eligible";
          let reasonText = "Policy kontrolleri gecti, request eligible.";
          if (lockEnabled && !globalGateOpen) {
            reason = "market_cap_gate";
            reasonText = "Market cap global gate kapali oldugu icin request kilitli.";
          } else if (lockEnabled && dripRemaining <= 0) {
            reason = "daily_drip_exhausted";
            reasonText = "Kullanici gunluk drip limiti dolmus.";
          } else if (lockEnabled && amountBtc > dripRemaining) {
            reason = "exceeds_user_drip_remaining";
            reasonText = "Talep miktari bugunku drip remaining degerini asiyor.";
          } else if (amountBtc <= 0) {
            reason = "invalid_amount";
            reasonText = "Payout amount gecersiz.";
          } else if (!lockEnabled) {
            reason = "release_policy_disabled";
            reasonText = "Release policy devre disi, request lock bypass ile eligible.";
          }

          let action = "keep";
          if (eligible) {
            eligibleCount += 1;
          } else if (applyRejections) {
            const rejectResult = await payoutStore.markRejected(client, {
              requestId,
              adminId: Number(auth.uid),
              reason: `release_run_${reason}`.slice(0, 120)
            });
            if (String(rejectResult.status || "") === "rejected") {
              rejectedCount += 1;
              action = "rejected";
            } else {
              action = String(rejectResult.status || "skip");
            }
          }

          decisions.push({
            request_id: requestId,
            user_id: userId,
            amount_btc: Number(amountBtc.toFixed(8)),
            eligible,
            reason,
            policy_reason_code: reason,
            policy_reason_text: reasonText,
            unlock_tier: unlockTier,
            drip_remaining_btc: Number(dripRemaining.toFixed(8)),
            global_gate_open: globalGateOpen,
            action
          });
        }

        await client.query(
          `INSERT INTO admin_audit (admin_id, action, target, payload_json)
           VALUES ($1, 'webapp_payout_release_run', 'payout_release:run', $2::jsonb);`,
          [
            Number(auth.uid),
            JSON.stringify({
              action_key: actionKey,
              limit,
              apply_rejections: applyRejections,
              total: requestedRows.length,
              eligible: eligibleCount,
              rejected: rejectedCount
            })
          ]
        );

        await client.query("COMMIT");
        reply.send({
          success: true,
          session: issueWebAppSession(auth.uid),
          data: {
            total: requestedRows.length,
            eligible: eligibleCount,
            rejected: rejectedCount,
            apply_rejections: applyRejections,
            decisions
          }
        });
      } catch (err) {
        await client.query("ROLLBACK");
        if (err.code === "42P01") {
          reply.code(503).send({ success: false, error: "payout_release_tables_missing" });
          return;
        }
        throw err;
      } finally {
        client.release();
      }
    }
  );

  fastify.post(
    "/webapp/api/v2/admin/economy/payout-release",
    {
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" }
          },
          additionalProperties: true
        }
      }
    },
    async (request, reply) => {
      await proxyWebAppApiV1(request, reply, {
        targetPath: "/webapp/api/admin/economy/payout-release",
        method: "POST",
        transform: (payload) => normalizeV2Payload(payload)
      });
    }
  );

  fastify.post(
    "/webapp/api/v2/admin/payout/release/run",
    {
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            confirm_token: { type: "string", minLength: 16, maxLength: 128 },
            limit: { type: "integer", minimum: 1, maximum: 200 },
            apply_rejections: { type: "boolean" }
          }
        }
      }
    },
    async (request, reply) => {
      await proxyWebAppApiV1(request, reply, {
        targetPath: "/webapp/api/admin/payout/release/run",
        method: "POST",
        transform: (payload) => normalizeV2Payload(payload)
      });
    }
  );
}

module.exports = {
  registerWebappAdminPayoutReleaseRoutes
};
