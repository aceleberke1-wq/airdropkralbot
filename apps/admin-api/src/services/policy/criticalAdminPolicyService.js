"use strict";

function createCriticalAdminPolicyService(options = {}) {
  const pool = options.pool;
  const crypto = options.crypto;
  const evaluateAdminPolicy = options.evaluateAdminPolicy;
  const buildAdminPolicySignature = options.buildAdminPolicySignature;
  const hasTable = options.hasTable;
  const adminConfirmTtlMs = Math.max(30000, Number(options.adminConfirmTtlMs || 90000));
  const adminCooldownMs = Math.max(1000, Number(options.adminCooldownMs || 8000));
  const tablesCacheTtlMs = Math.max(5000, Number(options.tablesCacheTtlMs || 30000));

  if (!pool || typeof pool.query !== "function") {
    throw new Error("critical_admin_policy_service_requires_pool");
  }
  if (!crypto || typeof crypto.createHash !== "function") {
    throw new Error("critical_admin_policy_service_requires_crypto");
  }
  if (typeof evaluateAdminPolicy !== "function") {
    throw new Error("critical_admin_policy_service_requires_evaluateAdminPolicy");
  }
  if (typeof buildAdminPolicySignature !== "function") {
    throw new Error("critical_admin_policy_service_requires_buildAdminPolicySignature");
  }
  if (typeof hasTable !== "function") {
    throw new Error("critical_admin_policy_service_requires_hasTable");
  }

  const confirmState = new Map();
  const rateLimitState = new Map();
  const criticalTablesCache = {
    checkedAt: 0,
    hasConfirmTokens: false,
    hasCooldowns: false
  };

  function cleanupAdminActionState() {
    const now = Date.now();
    for (const [key, entry] of confirmState.entries()) {
      if (!entry || now > Number(entry.expiresAt || 0)) {
        confirmState.delete(key);
      }
    }
  }

  function buildCriticalActionContext(actionKey, adminId, payload) {
    const action = String(actionKey || "").trim().toLowerCase();
    const actorId = Number(adminId || 0);
    const payloadJson = JSON.stringify(payload && typeof payload === "object" ? payload : {});
    const payloadHash = crypto.createHash("sha256").update(payloadJson).digest("hex");
    const signature = buildAdminPolicySignature(action, {
      admin_id: actorId,
      payload: payload && typeof payload === "object" ? payload : {}
    });
    const mapKey = `${actorId}:${action}:${signature}`;
    return { action, actorId, signature, mapKey, payloadHash };
  }

  async function resolveAdminCriticalTableState(db) {
    const now = Date.now();
    const maybeDb = db && typeof db.query === "function" ? db : pool;
    if (now - Number(criticalTablesCache.checkedAt || 0) < tablesCacheTtlMs) {
      return {
        hasConfirmTokens: Boolean(criticalTablesCache.hasConfirmTokens),
        hasCooldowns: Boolean(criticalTablesCache.hasCooldowns)
      };
    }
    try {
      const [hasConfirmTokens, hasCooldowns] = await Promise.all([
        hasTable(maybeDb, "v5_admin_confirm_tokens"),
        hasTable(maybeDb, "v5_admin_action_cooldowns")
      ]);
      criticalTablesCache.checkedAt = now;
      criticalTablesCache.hasConfirmTokens = Boolean(hasConfirmTokens);
      criticalTablesCache.hasCooldowns = Boolean(hasCooldowns);
      return { hasConfirmTokens: Boolean(hasConfirmTokens), hasCooldowns: Boolean(hasCooldowns) };
    } catch {
      criticalTablesCache.checkedAt = now;
      criticalTablesCache.hasConfirmTokens = false;
      criticalTablesCache.hasCooldowns = false;
      return { hasConfirmTokens: false, hasCooldowns: false };
    }
  }

  async function requireCriticalAdminConfirmation({ db, actionKey, adminId, payload, confirmToken }) {
    cleanupAdminActionState();
    const policy = evaluateAdminPolicy({
      action_key: actionKey,
      critical: true,
      cooldown_ms: adminCooldownMs
    });
    if (!policy.confirmation_required) {
      return { ok: true, policy, signature: "", expires_in_sec: 0 };
    }
    const ctx = buildCriticalActionContext(policy.action_key, adminId, payload);
    const now = Date.now();
    const token = String(confirmToken || "").trim();
    const maybeDb = db && typeof db.query === "function" ? db : pool;
    const tableState = await resolveAdminCriticalTableState(maybeDb);
    const tokenDb = tableState.hasConfirmTokens ? pool : maybeDb;

    if (!token) {
      confirmState.set(ctx.mapKey, {
        createdAt: now,
        expiresAt: now + adminConfirmTtlMs
      });
      if (tableState.hasConfirmTokens) {
        await tokenDb
          .query(
            `INSERT INTO v5_admin_confirm_tokens
               (confirm_token, admin_id, action_key, signature, payload_hash, issued_at, expires_at, status, meta_json)
             VALUES
               ($1, $2, $3, $4, $5, now(), now() + ($6::int * interval '1 millisecond'), 'issued', $7::jsonb)
             ON CONFLICT (confirm_token)
             DO UPDATE SET
               admin_id = EXCLUDED.admin_id,
               action_key = EXCLUDED.action_key,
               signature = EXCLUDED.signature,
               payload_hash = EXCLUDED.payload_hash,
               issued_at = now(),
               expires_at = EXCLUDED.expires_at,
               consumed_at = NULL,
               status = 'issued',
               meta_json = COALESCE(v5_admin_confirm_tokens.meta_json, '{}'::jsonb) || EXCLUDED.meta_json;`,
            [
              ctx.signature,
              Number(ctx.actorId || 0),
              String(ctx.action || ""),
              ctx.signature,
              ctx.payloadHash,
              Number(adminConfirmTtlMs || 90000),
              JSON.stringify({
                source: "requireCriticalAdminConfirmation",
                policy_action_key: String(policy.action_key || actionKey || "")
              })
            ]
          )
          .catch((err) => {
            if (err.code === "42P01") {
              criticalTablesCache.hasConfirmTokens = false;
              return;
            }
            throw err;
          });
      }
      return {
        ok: false,
        error: "admin_confirmation_required",
        policy,
        signature: ctx.signature,
        expires_in_sec: Math.ceil(adminConfirmTtlMs / 1000)
      };
    }

    if (token !== ctx.signature) {
      return {
        ok: false,
        error: "admin_confirmation_token_invalid",
        policy,
        signature: ctx.signature,
        expires_in_sec: Math.ceil(adminConfirmTtlMs / 1000)
      };
    }

    if (tableState.hasConfirmTokens) {
      const row = await tokenDb
        .query(
          `SELECT id, expires_at, status
           FROM v5_admin_confirm_tokens
           WHERE confirm_token = $1
             AND admin_id = $2
             AND action_key = $3
           ORDER BY id DESC
           LIMIT 1;`,
          [ctx.signature, Number(ctx.actorId || 0), String(ctx.action || "")]
        )
        .then((res) => res.rows?.[0] || null)
        .catch((err) => {
          if (err.code === "42P01") {
            criticalTablesCache.hasConfirmTokens = false;
            return null;
          }
          throw err;
        });
      if (!row) {
        return {
          ok: false,
          error: "admin_confirmation_expired",
          policy,
          signature: ctx.signature,
          expires_in_sec: Math.ceil(adminConfirmTtlMs / 1000)
        };
      }
      const expiresAtMs = new Date(row.expires_at).getTime();
      if (String(row.status || "") !== "issued" || !Number.isFinite(expiresAtMs) || expiresAtMs <= now) {
        return {
          ok: false,
          error: "admin_confirmation_expired",
          policy,
          signature: ctx.signature,
          expires_in_sec: Math.ceil(adminConfirmTtlMs / 1000)
        };
      }
      await tokenDb
        .query(
          `UPDATE v5_admin_confirm_tokens
           SET status = 'consumed',
               consumed_at = now()
           WHERE id = $1
             AND status = 'issued';`,
          [Number(row.id || 0)]
        )
        .catch((err) => {
          if (err.code === "42P01") {
            criticalTablesCache.hasConfirmTokens = false;
            return;
          }
          throw err;
        });
      confirmState.delete(ctx.mapKey);
      return { ok: true, policy, signature: ctx.signature, expires_in_sec: 0 };
    }

    const entry = confirmState.get(ctx.mapKey);
    if (!entry || now > Number(entry.expiresAt || 0)) {
      confirmState.delete(ctx.mapKey);
      return {
        ok: false,
        error: "admin_confirmation_expired",
        policy,
        signature: ctx.signature,
        expires_in_sec: Math.ceil(adminConfirmTtlMs / 1000)
      };
    }
    confirmState.delete(ctx.mapKey);
    return { ok: true, policy, signature: ctx.signature, expires_in_sec: 0 };
  }

  async function enforceCriticalAdminCooldown({ db, actionKey, adminId, cooldownMs = adminCooldownMs }) {
    const policy = evaluateAdminPolicy({
      action_key: actionKey,
      critical: true,
      cooldown_ms: cooldownMs
    });
    const action = String(policy.action_key || actionKey || "").trim().toLowerCase();
    const actorId = Number(adminId || 0);
    const maybeDb = db && typeof db.query === "function" ? db : pool;
    const tableState = await resolveAdminCriticalTableState(maybeDb);
    if (tableState.hasCooldowns) {
      const row = await maybeDb
        .query(
          `SELECT cooldown_ms, last_action_at
           FROM v5_admin_action_cooldowns
           WHERE admin_id = $1
             AND action_key = $2
           LIMIT 1;`,
          [actorId, action]
        )
        .then((res) => res.rows?.[0] || null)
        .catch((err) => {
          if (err.code === "42P01") {
            criticalTablesCache.hasCooldowns = false;
            return null;
          }
          throw err;
        });
      if (row) {
        const prevAt = new Date(row.last_action_at).getTime();
        const effectiveCooldownMs = Math.max(0, Number(row.cooldown_ms || policy.cooldown_ms || cooldownMs));
        const elapsedMs = Date.now() - prevAt;
        if (Number.isFinite(prevAt) && prevAt > 0 && elapsedMs < effectiveCooldownMs) {
          const waitSec = Math.max(1, Math.ceil((effectiveCooldownMs - elapsedMs) / 1000));
          return { ok: false, policy, wait_sec: waitSec };
        }
      }
      await maybeDb
        .query(
          `INSERT INTO v5_admin_action_cooldowns
             (admin_id, action_key, cooldown_ms, last_action_at, meta_json)
           VALUES
             ($1, $2, $3, now(), $4::jsonb)
           ON CONFLICT (admin_id, action_key)
           DO UPDATE SET
             cooldown_ms = EXCLUDED.cooldown_ms,
             last_action_at = EXCLUDED.last_action_at,
             meta_json = COALESCE(v5_admin_action_cooldowns.meta_json, '{}'::jsonb) || EXCLUDED.meta_json;`,
          [
            actorId,
            action,
            Number(policy.cooldown_ms || cooldownMs || adminCooldownMs),
            JSON.stringify({
              source: "enforceCriticalAdminCooldown",
              action_key: action
            })
          ]
        )
        .catch((err) => {
          if (err.code === "42P01") {
            criticalTablesCache.hasCooldowns = false;
            return;
          }
          throw err;
        });
      return { ok: true, policy, wait_sec: 0 };
    }

    const key = `${actorId}:${action}`;
    const now = Date.now();
    const prev = Number(rateLimitState.get(key) || 0);
    if (prev > 0 && now - prev < Number(policy.cooldown_ms || cooldownMs)) {
      const waitSec = Math.max(1, Math.ceil((Number(policy.cooldown_ms || cooldownMs) - (now - prev)) / 1000));
      return { ok: false, policy, wait_sec: waitSec };
    }
    rateLimitState.set(key, now);
    return { ok: true, policy, wait_sec: 0 };
  }

  function buildQueueActionIdempotencyKey(input = {}) {
    const parts = [
      String(input.uid || "").trim(),
      String(input.actionKey || "").trim().toLowerCase(),
      String(input.kind || "").trim().toLowerCase(),
      String(input.requestId || "").trim(),
      String(input.confirmToken || "").trim(),
      String(input.reason || "").trim(),
      String(input.txHash || "").trim()
    ];
    return `uqa_${crypto.createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 48)}`;
  }

  return {
    buildQueueActionIdempotencyKey,
    enforceCriticalAdminCooldown,
    requireCriticalAdminConfirmation
  };
}

module.exports = {
  createCriticalAdminPolicyService
};
