"use strict";

function registerAdminRuntimeRoutes(fastify, deps = {}) {
  const pool = deps.pool;
  const parseAdminId = deps.parseAdminId;
  const adminTelegramId = Number(deps.adminTelegramId || 0);
  const isAdminTelegramId = deps.isAdminTelegramId;
  const botRuntimeStore = deps.botRuntimeStore;
  const readBotRuntimeState = deps.readBotRuntimeState;
  const projectBotRuntimeHealth = deps.projectBotRuntimeHealth;
  const reconcileBotRuntimeState = deps.reconcileBotRuntimeState;
  const getProfileByTelegram = deps.getProfileByTelegram;
  const computeSceneEffectiveProfile = deps.computeSceneEffectiveProfile;
  const loadFeatureFlags = deps.loadFeatureFlags;
  const flagDefaults = deps.flagDefaults || {};
  const criticalEnvLockedFlags = deps.criticalEnvLockedFlags;

  if (!pool || typeof pool.connect !== "function") {
    throw new Error("registerAdminRuntimeRoutes requires pool");
  }
  for (const [name, value] of Object.entries({
    parseAdminId,
    isAdminTelegramId,
    readBotRuntimeState,
    projectBotRuntimeHealth,
    reconcileBotRuntimeState,
    getProfileByTelegram,
    computeSceneEffectiveProfile,
    loadFeatureFlags
  })) {
    if (typeof value !== "function") {
      throw new Error(`registerAdminRuntimeRoutes requires ${name}`);
    }
  }
  if (!botRuntimeStore || typeof botRuntimeStore.DEFAULT_STATE_KEY !== "string") {
    throw new Error("registerAdminRuntimeRoutes requires botRuntimeStore.DEFAULT_STATE_KEY");
  }
  if (!criticalEnvLockedFlags || typeof criticalEnvLockedFlags.values !== "function") {
    throw new Error("registerAdminRuntimeRoutes requires criticalEnvLockedFlags set");
  }

  fastify.get("/admin/runtime/bot", async (request, reply) => {
    const stateKey = String(request.query?.state_key || botRuntimeStore.DEFAULT_STATE_KEY).trim() || botRuntimeStore.DEFAULT_STATE_KEY;
    const limit = Math.max(1, Math.min(100, Number(request.query?.limit || 30)));
    const client = await pool.connect();
    try {
      const runtime = await readBotRuntimeState(client, { stateKey, limit });
      const health = projectBotRuntimeHealth(runtime);
      const actorId = parseAdminId(request);
      reply.send({
        success: true,
        data: {
          actor_admin_id: Number(actorId || 0),
          configured_admin_id: Number(adminTelegramId || 0),
          is_admin: isAdminTelegramId(actorId),
          state_key: runtime.state_key || stateKey,
          health,
          runtime_state: runtime.state,
          recent_events: runtime.events,
          env: {
            bot_enabled: String(process.env.BOT_ENABLED || "1") === "1",
            bot_auto_restart: String(process.env.BOT_AUTO_RESTART || "1") === "1",
            keep_admin_on_bot_exit: String(process.env.KEEP_ADMIN_ON_BOT_EXIT || "1") === "1",
            bot_instance_lock_key: Number(process.env.BOT_INSTANCE_LOCK_KEY || 0)
          }
        }
      });
    } finally {
      client.release();
    }
  });

  fastify.post(
    "/admin/runtime/bot/reconcile",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            state_key: { type: "string", minLength: 1, maxLength: 80 },
            reason: { type: "string", maxLength: 300 },
            force_stop: { type: "boolean" }
          }
        }
      }
    },
    async (request, reply) => {
      const body = request.body || {};
      const stateKey = String(body.state_key || botRuntimeStore.DEFAULT_STATE_KEY).trim() || botRuntimeStore.DEFAULT_STATE_KEY;
      const forceStop = Boolean(body.force_stop);
      const reason = String(body.reason || "manual_reconcile");
      const actorId = parseAdminId(request);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await reconcileBotRuntimeState(client, {
          stateKey,
          forceStop,
          reason,
          updatedBy: actorId
        });
        await client.query("COMMIT");

        if (result.status === "tables_missing") {
          reply.code(503).send({ success: false, error: "bot_runtime_tables_missing" });
          return;
        }

        reply.send({
          success: true,
          data: {
            actor_admin_id: Number(actorId || 0),
            configured_admin_id: Number(adminTelegramId || 0),
            is_admin: isAdminTelegramId(actorId),
            reconcile_status: result.status,
            state_key: result.state_key,
            health_before: result.health_before,
            health_after: result.health_after,
            runtime_state: result.after?.state || null,
            recent_events: result.after?.events || []
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
    "/admin/runtime/scene/reconcile",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            target_telegram_id: { type: "integer", minimum: 1 },
            scene_key: { type: "string", minLength: 1, maxLength: 80 },
            reason: { type: "string", maxLength: 280 },
            force_refresh: { type: "boolean" }
          }
        }
      }
    },
    async (request, reply) => {
      const body = request.body || {};
      const actorId = parseAdminId(request);
      const sceneKey = String(body.scene_key || "nexus_arena").trim() || "nexus_arena";
      const reason = String(body.reason || "admin_runtime_scene_reconcile").trim() || "admin_runtime_scene_reconcile";
      const forceRefresh = Boolean(body.force_refresh);
      const targetTelegramId = Number(body.target_telegram_id || actorId || adminTelegramId || 0);

      if (!targetTelegramId) {
        reply.code(400).send({ success: false, error: "target_telegram_id_required" });
        return;
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const targetProfile = await getProfileByTelegram(client, targetTelegramId);
        if (!targetProfile) {
          await client.query("ROLLBACK");
          reply.code(404).send({ success: false, error: "target_user_not_started" });
          return;
        }

        const computed = await computeSceneEffectiveProfile(client, {
          userId: targetProfile.user_id,
          sceneKey,
          persist: true,
          forceRefresh,
          persistSource: "admin_runtime_scene_reconcile",
          profileJsonExtras: {
            reason,
            actor_telegram_id: Number(actorId || 0),
            target_telegram_id: Number(targetProfile.telegram_id || 0),
            force_refresh: forceRefresh
          }
        });

        await client.query(
          `INSERT INTO admin_audit (admin_id, action, target, payload_json)
           VALUES ($1, 'scene_runtime_reconcile', $2, $3::jsonb);`,
          [
            Number(actorId || 0),
            `scene:${targetProfile.user_id}:${sceneKey}`,
            JSON.stringify({
              reason,
              force_refresh: forceRefresh,
              target_telegram_id: Number(targetProfile.telegram_id || 0),
              target_user_id: Number(targetProfile.user_id || 0),
              effective_asset_mode: String(computed?.effective_profile?.asset_mode || ""),
              fallback_active: Boolean(computed?.effective_profile?.fallback_active)
            })
          ]
        );

        await client.query("COMMIT");
        reply.send({
          success: true,
          data: {
            actor_admin_id: Number(actorId || 0),
            configured_admin_id: Number(adminTelegramId || 0),
            is_admin: isAdminTelegramId(actorId),
            scene_key: sceneKey,
            reason,
            force_refresh: forceRefresh,
            target: {
              telegram_id: Number(targetProfile.telegram_id || 0),
              user_id: Number(targetProfile.user_id || 0)
            },
            ...computed
          }
        });
      } catch (err) {
        await client.query("ROLLBACK");
        if (err.code === "42P01") {
          reply.code(503).send({ success: false, error: "scene_reconcile_tables_missing" });
          return;
        }
        throw err;
      } finally {
        client.release();
      }
    }
  );

  fastify.get("/admin/runtime/flags/effective", async (request, reply) => {
    const actorId = parseAdminId(request);
    const client = await pool.connect();
    try {
      const payload = await loadFeatureFlags(client, { withMeta: true });
      reply.send({
        success: true,
        data: {
          actor_admin_id: Number(actorId || 0),
          configured_admin_id: Number(adminTelegramId || 0),
          is_admin: isAdminTelegramId(actorId),
          source_mode: payload.source_mode,
          source_json: payload.source_json || {},
          env_forced: Boolean(payload.env_forced),
          env_defaults: flagDefaults,
          critical_env_locked_keys: Array.from(criticalEnvLockedFlags.values()),
          effective_flags: payload.flags,
          db_flags: payload.db_flags || []
        }
      });
    } finally {
      client.release();
    }
  });
}

module.exports = {
  registerAdminRuntimeRoutes
};
