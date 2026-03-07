"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createLiveOpsChatCampaignService } = require("../src/services/liveOpsChatCampaignService");

function buildCampaign(overrides = {}) {
  return {
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
      dedupe_hours: 72,
      ...(overrides.targeting || {})
    },
    copy: {
      title: { en: "Wallet ready", tr: "Wallet hazir", ...((overrides.copy || {}).title || {}) },
      body: { en: "Link your wallet lane.", tr: "Wallet lane bagla.", ...((overrides.copy || {}).body || {}) },
      note: { en: "Open the secure route.", tr: "Guvenli rotayi ac.", ...((overrides.copy || {}).note || {}) }
    },
    schedule: {
      timezone: "UTC",
      start_at: "2020-01-01T00:00:00.000Z",
      end_at: "2035-01-01T00:00:00.000Z",
      ...(overrides.schedule || {})
    },
    approval: {
      required: true,
      state: "approved",
      requested_by: 7001,
      requested_at: "2026-03-08T10:05:00.000Z",
      approved_by: 7001,
      approved_at: "2026-03-08T10:10:00.000Z",
      last_action_by: 7001,
      last_action_at: "2026-03-08T10:10:00.000Z",
      note: "approved",
      ...(overrides.approval || {})
    },
    surfaces: [{ slot_key: "wallet_lane", surface_key: "wallet_panel" }],
    ...overrides,
    targeting: {
      segment_key: "wallet_unlinked",
      inactive_hours: 72,
      max_age_days: 30,
      active_within_days: 14,
      locale_filter: "",
      max_recipients: 40,
      dedupe_hours: 72,
      ...(overrides.targeting || {})
    },
    copy: {
      title: { en: "Wallet ready", tr: "Wallet hazir", ...((overrides.copy || {}).title || {}) },
      body: { en: "Link your wallet lane.", tr: "Wallet lane bagla.", ...((overrides.copy || {}).body || {}) },
      note: { en: "Open the secure route.", tr: "Guvenli rotayi ac.", ...((overrides.copy || {}).note || {}) }
    },
    schedule: {
      timezone: "UTC",
      start_at: "2020-01-01T00:00:00.000Z",
      end_at: "2035-01-01T00:00:00.000Z",
      ...(overrides.schedule || {})
    },
    approval: {
      required: true,
      state: "approved",
      requested_by: 7001,
      requested_at: "2026-03-08T10:05:00.000Z",
      approved_by: 7001,
      approved_at: "2026-03-08T10:10:00.000Z",
      last_action_by: 7001,
      last_action_at: "2026-03-08T10:10:00.000Z",
      note: "approved",
      ...(overrides.approval || {})
    },
    surfaces: Array.isArray(overrides.surfaces) ? overrides.surfaces : [{ slot_key: "wallet_lane", surface_key: "wallet_panel" }]
  };
}

function createQueryRecorder(handler) {
  const recordedQueries = [];
  return {
    recordedQueries,
    pool: {
      async connect() {
        return {
          async query(sql, params) {
            const text = String(sql || "");
            recordedQueries.push({ sql: text, params });
            return handler(text, params, recordedQueries);
          },
          release() {}
        };
      }
    }
  };
}

test("live ops chat campaign service dispatches canonical wallet reconnect campaign when approval and schedule are open", async () => {
  const sentPayloads = [];
  const { pool, recordedQueries } = createQueryRecorder((text) => {
    if (text.includes("FROM config_versions") && text.includes("LIMIT 1")) {
      return { rows: [] };
    }
    if (text.includes("INSERT INTO behavior_events") || text.includes("INSERT INTO admin_audit")) {
      return { rows: [] };
    }
    return { rows: [] };
  });

  const service = createLiveOpsChatCampaignService({
    pool,
    fetchImpl: async (_url, options) => {
      sentPayloads.push(JSON.parse(String(options.body || "{}")));
      return { ok: true };
    },
    botToken: "bot_token",
    botUsername: "airdropkral_2026_bot",
    webappPublicUrl: "https://example.com/app",
    webappHmacSecret: "secret",
    resolveWebappVersion: async () => ({ version: "abc123" }),
    nowFactory: () => new Date("2026-03-08T12:00:00.000Z"),
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
    campaign: buildCampaign()
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
  const eventInsert = recordedQueries.find((entry) => entry.sql.includes("INSERT INTO behavior_events"));
  assert.ok(eventInsert);
  assert.equal(eventInsert.params[2].includes('"locale":"en"'), true);
  assert.equal(eventInsert.params[2].includes('"primary_surface_key":"wallet_panel"'), true);
  assert.equal(recordedQueries.some((entry) => entry.sql.includes("INSERT INTO admin_audit")), true);
});

test("live ops chat campaign service snapshot includes approval summary schedule state and histories", async () => {
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
                    config_json: buildCampaign()
                  }
                ]
              };
            }
            if (text.includes("COUNT(*)::int AS sent_total") && text.includes("interval '72 hours'")) {
              return {
                rows: [
                  {
                    sent_total: 8,
                    sent_72h: 3,
                    last_sent_at: "2026-03-08T12:10:00.000Z",
                    last_segment_key: "wallet_unlinked",
                    last_dispatch_ref: "wallet_reconnect_k9"
                  }
                ]
              };
            }
            if (text.includes("COUNT(*) FILTER") && text.includes("interval '24 hours'")) {
              return {
                rows: [
                  {
                    sent_24h: 2,
                    sent_7d: 3,
                    unique_users_7d: 3
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
                    config_json: buildCampaign()
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
    nowFactory: () => new Date("2026-03-08T12:30:00.000Z"),
    logger: () => {}
  });

  const snapshot = await service.getCampaignSnapshot();
  assert.equal(snapshot.approval_summary.live_dispatch_ready, true);
  assert.equal(snapshot.approval_summary.approval_state, "approved");
  assert.equal(snapshot.approval_summary.schedule_state, "open");
  assert.equal(snapshot.approval_summary.approval_approved_by, 7001);
  assert.equal(snapshot.approval_summary.last_dispatch_at, "2026-03-08T12:10:00.000Z");
  assert.equal(snapshot.version_history.length, 1);
  assert.equal(snapshot.dispatch_history.length, 1);
  assert.equal(snapshot.dispatch_history[0].dispatch_ref, "wallet_reconnect_k9");
  assert.equal(snapshot.delivery_summary.sent_24h, 2);
  assert.equal(snapshot.delivery_summary.locale_breakdown[0].bucket_key, "en");
  assert.equal(snapshot.delivery_summary.surface_breakdown[0].bucket_key, "wallet_panel");
});

test("live ops chat campaign service updateCampaignApproval promotes pending campaign to approved and writes audit", async () => {
  let insertedConfig = null;
  let approvalAudit = null;
  const { pool, recordedQueries } = createQueryRecorder((text, params) => {
    if (text === "BEGIN" || text === "COMMIT" || text === "ROLLBACK") {
      return { rows: [] };
    }
    if (text.includes("FROM config_versions") && text.includes("LIMIT 1")) {
      return {
        rows: [
          {
            version: 6,
            created_at: "2026-03-08T11:00:00.000Z",
            created_by: 7001,
            config_json: buildCampaign({
              approval: {
                required: true,
                state: "pending",
                requested_by: 7001,
                requested_at: "2026-03-08T10:50:00.000Z",
                approved_by: 0,
                approved_at: null,
                last_action_by: 7001,
                last_action_at: "2026-03-08T10:50:00.000Z",
                note: "pending"
              }
            })
          }
        ]
      };
    }
    if (text.includes("INSERT INTO config_versions")) {
      insertedConfig = JSON.parse(String(params[2] || "{}"));
      return { rows: [] };
    }
    if (text.includes("INSERT INTO admin_audit")) {
      approvalAudit = {
        action: params[1],
        payload: JSON.parse(String(params[3] || "{}"))
      };
      return { rows: [] };
    }
    if (text.includes("COUNT(*)::int AS sent_total") && text.includes("interval '72 hours'")) {
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
    if (text.includes("COUNT(*) FILTER") && text.includes("interval '24 hours'")) {
      return {
        rows: [
          {
            sent_24h: 0,
            sent_7d: 0,
            unique_users_7d: 0
          }
        ]
      };
    }
    if (text.includes("meta_json->>'locale'" ) || text.includes("meta_json->>'segment_key'") || text.includes("meta_json->>'primary_surface_key'")) {
      return { rows: [] };
    }
    if (text.includes("FROM config_versions") && text.includes("LIMIT 8")) {
      return {
        rows: [
          {
            version: 7,
            created_at: "2026-03-08T12:00:00.000Z",
            created_by: 7002,
            config_json: insertedConfig || buildCampaign()
          }
        ]
      };
    }
    if (text.includes("FROM admin_audit")) {
      return { rows: [] };
    }
    return { rows: [] };
  });

  const service = createLiveOpsChatCampaignService({
    pool,
    fetchImpl: async () => ({ ok: true }),
    botToken: "bot_token",
    botUsername: "airdropkral_2026_bot",
    webappPublicUrl: "https://example.com/app",
    webappHmacSecret: "secret",
    resolveWebappVersion: async () => ({ version: "abc123" }),
    nowFactory: () => new Date("2026-03-08T12:00:00.000Z"),
    logger: () => {}
  });

  const snapshot = await service.updateCampaignApproval({
    adminId: 7002,
    approvalAction: "approve",
    reason: "approve_live",
    campaign: buildCampaign({
      approval: {
        required: true,
        state: "pending",
        requested_by: 7001,
        requested_at: "2026-03-08T10:50:00.000Z",
        approved_by: 0,
        approved_at: null,
        last_action_by: 7001,
        last_action_at: "2026-03-08T10:50:00.000Z",
        note: "pending"
      }
    })
  });

  assert.equal(snapshot.version, 7);
  assert.equal(snapshot.approval_summary.live_dispatch_ready, true);
  assert.equal(snapshot.approval_summary.approval_state, "approved");
  assert.equal(snapshot.approval_summary.approval_approved_by, 7002);
  assert.ok(insertedConfig);
  assert.equal(insertedConfig.approval.state, "approved");
  assert.equal(insertedConfig.approval.approved_by, 7002);
  assert.ok(approvalAudit);
  assert.equal(approvalAudit.action, "live_ops_campaign_approve");
  assert.equal(approvalAudit.payload.approval_state, "approved");
  assert.equal(recordedQueries.some((entry) => entry.sql === "COMMIT"), true);
});
