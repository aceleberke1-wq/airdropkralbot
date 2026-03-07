"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createLiveOpsChatCampaignService } = require("../src/services/liveOpsChatCampaignService");

function createPoolStub(recordedQueries) {
  return {
    async connect() {
      return {
        async query(sql, params) {
          const text = String(sql || "");
          recordedQueries.push({ sql: text, params });
          if (text.includes("FROM config_versions")) {
            return { rows: [] };
          }
          if (text.includes("FROM behavior_events")) {
            return {
              rows: [
                {
                  sent_total: 0,
                  sent_72h: 0,
                  last_sent_at: null,
                  last_segment_key: "",
                  last_dispatch_ref: ""
                }
              ]
            };
          }
          return { rows: [] };
        },
        release() {}
      };
    }
  };
}

test("live ops chat campaign service dispatches canonical wallet reconnect campaign", async () => {
  const recordedQueries = [];
  const sentPayloads = [];
  const service = createLiveOpsChatCampaignService({
    pool: createPoolStub(recordedQueries),
    fetchImpl: async (_url, options) => {
      sentPayloads.push(JSON.parse(String(options.body || "{}")));
      return { ok: true };
    },
    botToken: "bot_token",
    botUsername: "airdropkral_2026_bot",
    webappPublicUrl: "https://example.com/app",
    webappHmacSecret: "secret",
    resolveWebappVersion: async () => ({ version: "abc123" }),
    logger: () => {},
    loadCandidates: async () => [
      {
        user_id: 41,
        telegram_id: 777,
        locale: "en",
        last_seen_at: "2026-03-07T10:00:00.000Z",
        prefs_json: {}
      }
    ]
  });

  const result = await service.dispatchCampaign({
    adminId: 7001,
    dryRun: false,
    reason: "test_wallet_reconnect",
    campaign: {
      api_version: "v2",
      campaign_key: "wallet_reconnect",
      enabled: true,
      status: "ready",
      targeting: {
        segment_key: "wallet_unlinked",
        active_within_days: 14,
        max_recipients: 10,
        dedupe_hours: 72
      },
      copy: {
        title: { en: "Wallet ready", tr: "Wallet hazir" },
        body: { en: "Link your wallet lane.", tr: "Wallet lane bagla." },
        note: { en: "Open the secure route.", tr: "Guvenli rotayi ac." }
      },
      surfaces: [{ slot_key: "wallet_lane", surface_key: "wallet_panel" }]
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.sent, 1);
  assert.equal(sentPayloads.length, 1);
  assert.match(sentPayloads[0].text, /\*Wallet ready\*/);
  const firstButton = sentPayloads[0].reply_markup.inline_keyboard[0][0];
  assert.ok(firstButton.web_app.url.includes("route_key=vault"));
  assert.ok(firstButton.web_app.url.includes("panel_key=wallet"));
  assert.ok(firstButton.web_app.url.includes("shell_action_key=player.route.wallet_connect"));
  assert.ok(firstButton.web_app.url.includes("launch_event_key=launch.alert.wallet_reconnect_wallet_lane.open"));
  assert.equal(recordedQueries.some((entry) => entry.sql.includes("INSERT INTO behavior_events")), true);
  assert.equal(recordedQueries.some((entry) => entry.sql.includes("INSERT INTO admin_audit")), true);
});
