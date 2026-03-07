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
          if (text.includes("COUNT(*) FILTER") && text.includes("FROM behavior_events")) {
            return {
              rows: [
                {
                  sent_24h: 0,
                  sent_7d: 0,
                  unique_users_7d: 0,
                  sent_total: 0,
                  sent_72h: 0,
                  last_sent_at: null,
                  last_segment_key: "",
                  last_dispatch_ref: ""
                }
              ]
            };
          }
          if (text.includes("GROUP BY 1") && text.includes("FROM behavior_events")) {
            return { rows: [] };
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
  const eventInsert = recordedQueries.find((entry) => entry.sql.includes("INSERT INTO behavior_events"));
  assert.equal(eventInsert.params[2].includes("\"locale\":\"en\""), true);
  assert.equal(eventInsert.params[2].includes("\"primary_surface_key\":\"wallet_panel\""), true);
});

test("live ops chat campaign service snapshot includes approval summary and histories", async () => {
  const service = createLiveOpsChatCampaignService({
    pool: {
      async connect() {
        return {
          async query(sql) {
            const text = String(sql || "");
            if (text.includes("FROM config_versions") && text.includes("LIMIT 1")) {
              return {
                rows: [
                  {
                    version: 5,
                    created_at: "2026-03-08T12:00:00.000Z",
                    created_by: 7001,
                    config_json: {
                      api_version: "v2",
                      campaign_key: "wallet_reconnect",
                      enabled: true,
                      status: "ready",
                      targeting: {
                        segment_key: "wallet_unlinked",
                        inactive_hours: 72,
                        max_age_days: 30,
                        active_within_days: 14,
                        locale_filter: "",
                        max_recipients: 40,
                        dedupe_hours: 72
                      },
                      copy: {
                        title: { en: "Wallet ready", tr: "Wallet hazir" },
                        body: { en: "Link wallet", tr: "Wallet bagla" },
                        note: { en: "Open route", tr: "Rotayi ac" }
                      },
                      surfaces: [{ slot_key: "wallet_lane", surface_key: "wallet_panel" }]
                    }
                  }
                ]
              };
            }
            if (text.includes("COUNT(*) FILTER") && text.includes("FROM behavior_events")) {
              return {
                rows: [
                  {
                    sent_24h: 2,
                    sent_7d: 3,
                    unique_users_7d: 3,
                    sent_total: 8,
                    sent_72h: 3,
                    last_sent_at: "2026-03-08T12:10:00.000Z",
                    last_segment_key: "wallet_unlinked",
                    last_dispatch_ref: "wallet_reconnect_k9"
                  }
                ]
              };
            }
            if (text.includes("meta_json->>'locale'")) {
              return { rows: [{ bucket_key: "en", item_count: 2 }, { bucket_key: "tr", item_count: 1 }] };
            }
            if (text.includes("meta_json->>'segment_key'")) {
              return { rows: [{ bucket_key: "wallet_unlinked", item_count: 3 }] };
            }
            if (text.includes("meta_json->>'primary_surface_key'")) {
              return { rows: [{ bucket_key: "wallet_panel", item_count: 3 }] };
            }
            if (text.includes("FROM config_versions") && text.includes("LIMIT 8")) {
              return {
                rows: [
                  {
                    version: 5,
                    created_at: "2026-03-08T12:00:00.000Z",
                    created_by: 7001,
                    config_json: {
                      campaign_key: "wallet_reconnect",
                      enabled: true,
                      status: "ready",
                      targeting: {
                        segment_key: "wallet_unlinked",
                        max_recipients: 40,
                        dedupe_hours: 72
                      },
                      surfaces: [{ slot_key: "wallet_lane", surface_key: "wallet_panel" }]
                    }
                  }
                ]
              };
            }
            if (text.includes("FROM admin_audit")) {
              return {
                rows: [
                  {
                    admin_id: 7001,
                    action: "live_ops_campaign_dispatch",
                    created_at: "2026-03-08T12:10:00.000Z",
                    payload_json: {
                      campaign_key: "wallet_reconnect",
                      campaign_version: 5,
                      dispatch_ref: "wallet_reconnect_k9",
                      segment_key: "wallet_unlinked",
                      reason: "manual_live_push",
                      attempted: 3,
                      sent: 3,
                      recorded: 3,
                      skipped_disabled: 0
                    }
                  }
                ]
              };
            }
            return { rows: [] };
          },
          release() {}
        };
      }
    },
    fetchImpl: async () => ({ ok: true }),
    botToken: "bot_token",
    botUsername: "airdropkral_2026_bot",
    webappPublicUrl: "https://example.com/app",
    webappHmacSecret: "secret",
    resolveWebappVersion: async () => ({ version: "abc123" }),
    logger: () => {}
  });

  const snapshot = await service.getCampaignSnapshot();
  assert.equal(snapshot.approval_summary.live_dispatch_ready, true);
  assert.equal(snapshot.approval_summary.last_dispatch_at, "2026-03-08T12:10:00.000Z");
  assert.equal(snapshot.version_history.length, 1);
  assert.equal(snapshot.dispatch_history.length, 1);
  assert.equal(snapshot.dispatch_history[0].dispatch_ref, "wallet_reconnect_k9");
  assert.equal(snapshot.delivery_summary.sent_24h, 2);
  assert.equal(snapshot.delivery_summary.locale_breakdown[0].bucket_key, "en");
  assert.equal(snapshot.delivery_summary.surface_breakdown[0].bucket_key, "wallet_panel");
});
