"use strict";

const TAB_KEYS = new Set(["home", "pvp", "tasks", "vault"]);
const WORKSPACE_KEYS = new Set(["player", "admin"]);

function requireDependency(deps, key, type = "function") {
  const value = deps[key];
  if (type === "function" && typeof value !== "function") {
    throw new Error(`registerWebappV2UiPrefsRoutes requires ${key}`);
  }
  if (type === "object" && (!value || typeof value !== "object")) {
    throw new Error(`registerWebappV2UiPrefsRoutes requires ${key}`);
  }
  return value;
}

function sanitizeLanguage(value, fallback = "tr") {
  const normalized = String(value || fallback)
    .trim()
    .toLowerCase();
  return normalized.startsWith("en") ? "en" : "tr";
}

function sanitizeTabKey(value, fallback = "home") {
  const key = String(value || fallback)
    .trim()
    .toLowerCase();
  return TAB_KEYS.has(key) ? key : fallback;
}

function sanitizeWorkspaceKey(value, fallback = "player") {
  const key = String(value || fallback)
    .trim()
    .toLowerCase();
  return WORKSPACE_KEYS.has(key) ? key : fallback;
}

function normalizePrefsRow(row) {
  const source = row && typeof row === "object" ? row : {};
  const rawPrefs = source.prefs_json && typeof source.prefs_json === "object" ? source.prefs_json : {};
  const prefsJson = {
    ...rawPrefs,
    language: sanitizeLanguage(rawPrefs.language || "tr"),
    onboarding_completed: Boolean(rawPrefs.onboarding_completed),
    onboarding_version: String(rawPrefs.onboarding_version || "v1"),
    advanced_view: Boolean(rawPrefs.advanced_view),
    last_tab: sanitizeTabKey(rawPrefs.last_tab || "home"),
    workspace: sanitizeWorkspaceKey(rawPrefs.workspace || "player")
  };
  return {
    ui_mode: String(source.ui_mode || "hardcore"),
    quality_mode: String(source.quality_mode || "auto"),
    reduced_motion: Boolean(source.reduced_motion),
    large_text: Boolean(source.large_text),
    sound_enabled: source.sound_enabled !== false,
    updated_at: source.updated_at || null,
    prefs_json: prefsJson
  };
}

function buildNextPrefs(current, body = {}) {
  const source = body && typeof body === "object" ? body : {};
  const currentPrefs = normalizePrefsRow(current);
  const incomingPrefsJson = source.prefs_json && typeof source.prefs_json === "object" ? source.prefs_json : {};
  const nextPrefsJson = {
    ...currentPrefs.prefs_json,
    ...incomingPrefsJson
  };
  if (source.language !== undefined) {
    nextPrefsJson.language = sanitizeLanguage(source.language, String(nextPrefsJson.language || "tr"));
  }
  if (source.onboarding_completed !== undefined) {
    nextPrefsJson.onboarding_completed = Boolean(source.onboarding_completed);
  }
  if (source.onboarding_version !== undefined) {
    nextPrefsJson.onboarding_version = String(source.onboarding_version || "v1");
  }
  if (source.advanced_view !== undefined) {
    nextPrefsJson.advanced_view = Boolean(source.advanced_view);
  }
  if (source.last_tab !== undefined) {
    nextPrefsJson.last_tab = sanitizeTabKey(source.last_tab, String(nextPrefsJson.last_tab || "home"));
  }
  if (source.workspace !== undefined) {
    nextPrefsJson.workspace = sanitizeWorkspaceKey(source.workspace, String(nextPrefsJson.workspace || "player"));
  }

  return {
    uiMode: String(source.ui_mode || currentPrefs.ui_mode || "hardcore"),
    qualityMode: String(source.quality_mode || currentPrefs.quality_mode || "auto"),
    reducedMotion: source.reduced_motion === undefined ? Boolean(currentPrefs.reduced_motion) : Boolean(source.reduced_motion),
    largeText: source.large_text === undefined ? Boolean(currentPrefs.large_text) : Boolean(source.large_text),
    soundEnabled: source.sound_enabled === undefined ? Boolean(currentPrefs.sound_enabled) : Boolean(source.sound_enabled),
    prefsJson: {
      ...nextPrefsJson,
      language: sanitizeLanguage(nextPrefsJson.language, "tr"),
      onboarding_completed: Boolean(nextPrefsJson.onboarding_completed),
      onboarding_version: String(nextPrefsJson.onboarding_version || "v1"),
      advanced_view: Boolean(nextPrefsJson.advanced_view),
      last_tab: sanitizeTabKey(nextPrefsJson.last_tab, "home"),
      workspace: sanitizeWorkspaceKey(nextPrefsJson.workspace, "player")
    }
  };
}

function registerWebappV2UiPrefsRoutes(fastify, deps = {}) {
  const pool = requireDependency(deps, "pool", "object");
  const verifyWebAppAuth = requireDependency(deps, "verifyWebAppAuth", "function");
  const issueWebAppSession = requireDependency(deps, "issueWebAppSession", "function");
  const getProfileByTelegram = requireDependency(deps, "getProfileByTelegram", "function");
  const webappStore = requireDependency(deps, "webappStore", "object");

  if (typeof webappStore.getUserUiPrefs !== "function" || typeof webappStore.upsertUserUiPrefs !== "function") {
    throw new Error("registerWebappV2UiPrefsRoutes requires webappStore.getUserUiPrefs and webappStore.upsertUserUiPrefs");
  }

  fastify.get(
    "/webapp/api/v2/ui/preferences",
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
        const profile = await getProfileByTelegram(client, auth.uid);
        if (!profile) {
          reply.code(404).send({ success: false, error: "user_not_started" });
          return;
        }
        const current = await webappStore.getUserUiPrefs(client, profile.user_id).catch((err) => {
          if (err.code === "42P01") return null;
          throw err;
        });
        reply.send({
          success: true,
          session: issueWebAppSession(auth.uid),
          data: {
            api_version: "v2",
            ui_preferences: normalizePrefsRow(current)
          }
        });
      } finally {
        client.release();
      }
    }
  );

  fastify.post(
    "/webapp/api/v2/ui/preferences",
    {
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            ui_mode: { type: "string", maxLength: 40 },
            quality_mode: { type: "string", maxLength: 20 },
            reduced_motion: { type: "boolean" },
            large_text: { type: "boolean" },
            sound_enabled: { type: "boolean" },
            language: { type: "string", maxLength: 8 },
            onboarding_completed: { type: "boolean" },
            onboarding_version: { type: "string", maxLength: 20 },
            advanced_view: { type: "boolean" },
            last_tab: { type: "string", maxLength: 16 },
            workspace: { type: "string", maxLength: 16 },
            prefs_json: { type: "object" }
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
        const profile = await getProfileByTelegram(client, auth.uid);
        if (!profile) {
          await client.query("ROLLBACK");
          reply.code(404).send({ success: false, error: "user_not_started" });
          return;
        }
        const current = await webappStore.getUserUiPrefs(client, profile.user_id).catch((err) => {
          if (err.code === "42P01") return null;
          throw err;
        });
        const next = buildNextPrefs(current, request.body);
        const saved = await webappStore
          .upsertUserUiPrefs(client, {
            userId: profile.user_id,
            uiMode: next.uiMode,
            qualityMode: next.qualityMode,
            reducedMotion: next.reducedMotion,
            largeText: next.largeText,
            soundEnabled: next.soundEnabled,
            prefsJson: next.prefsJson
          })
          .catch((err) => {
            if (err.code === "42P01") {
              const missing = new Error("ui_preferences_tables_missing");
              missing.code = "ui_preferences_tables_missing";
              throw missing;
            }
            throw err;
          });

        await client.query("COMMIT");
        reply.send({
          success: true,
          session: issueWebAppSession(auth.uid),
          data: {
            api_version: "v2",
            ui_preferences: normalizePrefsRow(saved)
          }
        });
      } catch (err) {
        await client.query("ROLLBACK");
        if (err.code === "ui_preferences_tables_missing") {
          reply.code(503).send({ success: false, error: "ui_preferences_tables_missing" });
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
  registerWebappV2UiPrefsRoutes
};
