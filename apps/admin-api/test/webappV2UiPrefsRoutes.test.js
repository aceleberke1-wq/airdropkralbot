"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const { registerWebappV2UiPrefsRoutes } = require("../src/routes/webapp/v2/uiPrefsRoutes");

function createHarness() {
  let stored = null;
  const app = Fastify();
  registerWebappV2UiPrefsRoutes(app, {
    pool: {
      async connect() {
        return {
          async query() {
            return { rows: [] };
          },
          release() {}
        };
      }
    },
    verifyWebAppAuth: () => ({ ok: true, uid: 7001 }),
    issueWebAppSession: (uid) => ({ uid: String(uid), ts: "1", sig: "sig" }),
    getProfileByTelegram: async () => ({ user_id: 91 }),
    webappStore: {
      async getUserUiPrefs() {
        return stored;
      },
      async upsertUserUiPrefs(_db, payload) {
        stored = {
          user_id: payload.userId,
          ui_mode: payload.uiMode,
          quality_mode: payload.qualityMode,
          reduced_motion: Boolean(payload.reducedMotion),
          large_text: Boolean(payload.largeText),
          sound_enabled: payload.soundEnabled !== false,
          prefs_json: payload.prefsJson || {},
          updated_at: new Date().toISOString()
        };
        return stored;
      }
    }
  });
  return app;
}

test("v2 ui preferences post persists onboarding and tab fields", async () => {
  const app = createHarness();
  const saveRes = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/ui/preferences",
    payload: {
      uid: "7001",
      ts: "1",
      sig: "sig",
      language: "en",
      onboarding_completed: true,
      advanced_view: true,
      last_tab: "vault",
      workspace: "admin"
    }
  });
  assert.equal(saveRes.statusCode, 200);
  const saveBody = saveRes.json();
  assert.equal(saveBody.success, true);
  assert.equal(saveBody.data.ui_preferences.prefs_json.language, "en");
  assert.equal(saveBody.data.ui_preferences.prefs_json.onboarding_completed, true);
  assert.equal(saveBody.data.ui_preferences.prefs_json.last_tab, "vault");

  const readRes = await app.inject({
    method: "GET",
    url: "/webapp/api/v2/ui/preferences?uid=7001&ts=1&sig=sig"
  });
  assert.equal(readRes.statusCode, 200);
  const readBody = readRes.json();
  assert.equal(readBody.data.ui_preferences.prefs_json.workspace, "admin");
  await app.close();
});
