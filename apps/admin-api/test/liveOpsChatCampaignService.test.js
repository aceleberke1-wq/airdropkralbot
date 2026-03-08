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
            if (text.includes("FROM behavior_events") && text.includes("COUNT(*) FILTER") && text.includes("interval '24 hours'")) {
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
            if (text.includes("event_key IN ('runtime.scene.ready', 'runtime.scene.failed')")) {
              return {
                rows: [
                  {
                    ready_24h: 9,
                    failed_24h: 1,
                    low_end_24h: 3,
                    avg_loaded_bundles_24h: 3.2,
                    daily_breakdown_7d: [
                      {
                        day: "2026-03-08",
                        total_count: 4,
                        ready_count: 3,
                        failed_count: 1,
                        low_end_count: 2
                      },
                      {
                        day: "2026-03-07",
                        total_count: 5,
                        ready_count: 5,
                        failed_count: 0,
                        low_end_count: 1
                      }
                    ],
                    quality_breakdown_24h: [{ bucket_key: "medium", item_count: 6 }],
                    perf_breakdown_24h: [{ bucket_key: "mid", item_count: 6 }]
                  }
                ]
              };
            }
            if (text.includes("to_char(date_trunc('day', event_at), 'YYYY-MM-DD') AS day")) {
              return {
                rows: [
                  {
                    day: "2026-03-08",
                    sent_count: 2,
                    unique_users: 2
                  },
                  {
                    day: "2026-03-07",
                    sent_count: 1,
                    unique_users: 1
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
            if (text.includes("action = 'live_ops_campaign_scheduler_skip'") && text.includes("COUNT(*) FILTER")) {
              return {
                rows: [
                  {
                    skipped_24h: 2,
                    skipped_7d: 4
                  }
                ]
              };
            }
            if (text.includes("action = 'live_ops_campaign_scheduler_skip'") && text.includes("ORDER BY created_at DESC") && text.includes("LIMIT 1")) {
              return {
                rows: [
                  {
                    created_at: "2026-03-08T12:22:00.000Z",
                    payload_json: {
                      reason: "scene_runtime_alert_blocked"
                    }
                  }
                ]
              };
            }
            if (text.includes("action = 'live_ops_campaign_scheduler_skip'") && text.includes("GROUP BY 1") && text.includes("bucket_key")) {
              return {
                rows: [
                  { bucket_key: "scene_runtime_alert_blocked", item_count: 3 },
                  { bucket_key: "already_dispatched_for_window", item_count: 1 }
                ]
              };
            }
            if (text.includes("action = 'live_ops_campaign_scheduler_skip'") && text.includes("skip_count")) {
              return {
                rows: [
                  { day: "2026-03-08", skip_count: 2 },
                  { day: "2026-03-07", skip_count: 2 }
                ]
              };
            }
            if (text.includes("lower(a.variant_key)")) {
              return { rows: [{ bucket_key: "treatment", item_count: 2 }, { bucket_key: "control", item_count: 1 }] };
            }
            if (text.includes("a.cohort_bucket::text")) {
              return { rows: [{ bucket_key: "17", item_count: 2 }, { bucket_key: "42", item_count: 1 }] };
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
            if (text.includes("FROM admin_audit") && text.includes("'live_ops_campaign_save'")) {
              return {
                rows: [
                  {
                    admin_id: 7001,
                    action: "live_ops_campaign_dispatch",
                    created_at: "2026-03-08T12:10:00.000Z",
                    payload_json: {
                      campaign_key: "wallet_reconnect",
                      campaign_version: 5,
                      reason: "manual_live_push",
                      enabled: true,
                      status: "ready",
                      approval_state: "approved",
                      schedule_state: "open",
                      dispatch_ref: "wallet_reconnect_k9",
                      dry_run: false
                    }
                  },
                  {
                    admin_id: 7001,
                    action: "live_ops_campaign_approve",
                    created_at: "2026-03-08T12:05:00.000Z",
                    payload_json: {
                      campaign_key: "wallet_reconnect",
                      version: 5,
                      reason: "approve_live",
                      enabled: true,
                      status: "ready",
                      approval_state: "approved",
                      schedule_state: "open",
                      dispatch_ref: "",
                      dry_run: false
                    }
                  }
                ]
              };
            }
            if (text.includes("COALESCE(payload_json->>'dispatch_source', 'manual') = 'scheduler'") && text.includes("LIMIT 1")) {
              return {
                rows: [
                  {
                    admin_id: 7009,
                    created_at: "2026-03-08T12:20:00.000Z",
                    payload_json: {
                      campaign_key: "wallet_reconnect",
                      dispatch_ref: "wallet_reconnect_scheduler_ref",
                      reason: "scheduled_window_dispatch",
                      window_key: "wallet_reconnect:2020-01-01T00:00:00.000Z:2035-01-01T00:00:00.000Z"
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
    nowFactory: () => new Date("2026-03-08T12:30:00.000Z"),
    readLatestTaskArtifactSummary: async () => ({
      artifact_found: true,
      artifact_path: ".runtime-artifacts/liveops/V5_LIVE_OPS_CAMPAIGN_DISPATCH_latest.json",
      artifact_generated_at: "2026-03-08T12:25:00.000Z",
      artifact_age_min: 5,
      ok: true,
      skipped: true,
      reason: "campaign_approval_required",
      dispatch_ref: "",
      dispatch_source: "",
      scene_gate_state: "watch",
      scene_gate_effect: "capped",
      scene_gate_reason: "scene_runtime_watch_capped",
      scene_gate_recipient_cap: 20,
      window_key: "wallet_reconnect:2020-01-01T00:00:00.000Z:2035-01-01T00:00:00.000Z",
      scheduler_skip_24h: 2,
      scheduler_skip_7d: 4,
      scheduler_skip_alarm_state: "alert",
      scheduler_skip_alarm_reason: "scene_runtime_alert_blocked_repeated"
    }),
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
  assert.equal(snapshot.operator_timeline.length, 2);
  assert.equal(snapshot.operator_timeline[0].action, "live_ops_campaign_dispatch");
  assert.equal(snapshot.scheduler_summary.window_key, "wallet_reconnect:2020-01-01T00:00:00.000Z:2035-01-01T00:00:00.000Z");
  assert.equal(snapshot.scheduler_summary.latest_auto_dispatch_ref, "wallet_reconnect_scheduler_ref");
  assert.equal(snapshot.delivery_summary.sent_24h, 2);
  assert.equal(snapshot.delivery_summary.experiment_assignment_available, true);
  assert.equal(snapshot.delivery_summary.experiment_key, "webapp_react_v1");
  assert.equal(snapshot.delivery_summary.locale_breakdown[0].bucket_key, "en");
  assert.equal(snapshot.delivery_summary.surface_breakdown[0].bucket_key, "wallet_panel");
  assert.equal(snapshot.delivery_summary.variant_breakdown[0].bucket_key, "treatment");
  assert.equal(snapshot.delivery_summary.cohort_breakdown[0].bucket_key, "17");
  assert.equal(snapshot.delivery_summary.daily_breakdown[0].day, "2026-03-08");
  assert.equal(snapshot.delivery_summary.daily_breakdown[0].sent_count, 2);
  assert.equal(snapshot.scheduler_skip_summary.skipped_24h, 2);
  assert.equal(snapshot.scheduler_skip_summary.latest_skip_reason, "scene_runtime_alert_blocked");
  assert.equal(snapshot.scheduler_skip_summary.alarm_state, "alert");
  assert.equal(snapshot.scheduler_skip_summary.alarm_reason, "scene_runtime_alert_blocked_repeated");
  assert.equal(snapshot.scheduler_skip_summary.scene_alert_blocked_7d, 3);
  assert.equal(snapshot.scheduler_skip_summary.reason_breakdown[0].bucket_key, "scene_runtime_alert_blocked");
  assert.equal(snapshot.scheduler_skip_summary.daily_breakdown[0].skip_count, 2);
  assert.equal(snapshot.scene_runtime_summary.ready_24h, 9);
  assert.equal(snapshot.scene_runtime_summary.health_band_24h, "yellow");
  assert.equal(snapshot.scene_runtime_summary.trend_direction_7d, "degrading");
  assert.equal(snapshot.scene_runtime_summary.alarm_state_7d, "alert");
  assert.equal(snapshot.scene_runtime_summary.quality_breakdown_24h[0].bucket_key, "medium");
  assert.equal(snapshot.task_summary.artifact_found, true);
  assert.equal(snapshot.task_summary.artifact_age_min, 5);
  assert.equal(snapshot.task_summary.scene_gate_reason, "scene_runtime_watch_capped");
  assert.equal(snapshot.task_summary.scheduler_skip_alarm_state, "alert");
  assert.equal(snapshot.task_summary.scheduler_skip_24h, 2);
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
    if (text.includes("FROM behavior_events") && text.includes("COUNT(*) FILTER") && text.includes("interval '24 hours'")) {
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
    if (text.includes("to_char(date_trunc('day', event_at), 'YYYY-MM-DD') AS day")) {
      return { rows: [] };
    }
    if (
      text.includes("meta_json->>'locale'") ||
      text.includes("meta_json->>'segment_key'") ||
      text.includes("meta_json->>'primary_surface_key'") ||
      text.includes("lower(a.variant_key)") ||
      text.includes("a.cohort_bucket::text")
    ) {
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
    if (text.includes("FROM admin_audit") && text.includes("'live_ops_campaign_save'")) {
      return {
        rows: [
          {
            admin_id: 7002,
            action: "live_ops_campaign_approve",
            created_at: "2026-03-08T12:00:00.000Z",
            payload_json: approvalAudit?.payload || {
              campaign_key: "wallet_reconnect",
              version: 7,
              reason: "approve_live",
              enabled: true,
              status: "ready",
              approval_state: "approved",
              schedule_state: "open",
              dispatch_ref: "",
              dry_run: false
            }
          }
        ]
      };
    }
    if (text.includes("COALESCE(payload_json->>'dispatch_source', 'manual') = 'scheduler'") && text.includes("LIMIT 1")) {
      return { rows: [] };
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
  assert.equal(snapshot.operator_timeline.length, 1);
  assert.equal(snapshot.operator_timeline[0].action, "live_ops_campaign_approve");
  assert.equal(snapshot.scheduler_summary.already_dispatched_for_window, false);
  assert.equal(recordedQueries.some((entry) => entry.sql === "COMMIT"), true);
});

test("live ops chat campaign service runScheduledDispatch skips duplicate scheduler window", async () => {
  let fetchCalled = false;
  let skipAuditPayload = null;
  const service = createLiveOpsChatCampaignService({
    pool: {
      async connect() {
        return {
          async query(sql, params) {
            const text = String(sql || "");
            if (text.includes("FROM config_versions") && text.includes("LIMIT 1")) {
              return {
                rows: [
                  {
                    version: 8,
                    created_at: "2026-03-08T12:00:00.000Z",
                    created_by: 7001,
                    config_json: buildCampaign()
                  }
                ]
              };
            }
            if (text.includes("COUNT(*)::int AS sent_total")) {
              return {
                rows: [
                  {
                    sent_total: 1,
                    sent_72h: 1,
                    last_sent_at: "2026-03-08T12:20:00.000Z",
                    last_segment_key: "wallet_unlinked",
                    last_dispatch_ref: "wallet_reconnect_scheduler_ref"
                  }
                ]
              };
            }
            if (text.includes("COALESCE(payload_json->>'dispatch_source', 'manual') = 'scheduler'")) {
              return {
                rows: [
                  {
                    admin_id: 7010,
                    created_at: "2026-03-08T12:20:00.000Z",
                    payload_json: {
                      campaign_key: "wallet_reconnect",
                      dispatch_ref: "wallet_reconnect_scheduler_ref",
                      reason: "scheduled_window_dispatch",
                      window_key: "wallet_reconnect:2020-01-01T00:00:00.000Z:2035-01-01T00:00:00.000Z"
                    }
                  }
                ]
              };
            }
            if (text.includes("INSERT INTO admin_audit") && text.includes("live_ops_campaign_scheduler_skip")) {
              skipAuditPayload = JSON.parse(String(params[2] || "{}"));
              return { rows: [] };
            }
            return { rows: [] };
          },
          release() {}
        };
      }
    },
    fetchImpl: async () => {
      fetchCalled = true;
      return { ok: true };
    },
    botToken: "bot_token",
    botUsername: "airdropkral_2026_bot",
    webappPublicUrl: "https://example.com/app",
    webappHmacSecret: "secret",
    resolveWebappVersion: async () => ({ version: "abc123" }),
    nowFactory: () => new Date("2026-03-08T12:30:00.000Z"),
    logger: () => {}
  });

  const result = await service.runScheduledDispatch({
    adminId: 7010
  });

  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.equal(result.reason, "already_dispatched_for_window");
  assert.equal(result.window_key, "wallet_reconnect:2020-01-01T00:00:00.000Z:2035-01-01T00:00:00.000Z");
  assert.equal(skipAuditPayload.reason, "already_dispatched_for_window");
  assert.equal(skipAuditPayload.dispatch_ref, "wallet_reconnect_scheduler_ref");
  assert.equal(fetchCalled, false);
});

test("live ops chat campaign service runScheduledDispatch blocks live send on scene alert gate", async () => {
  let fetchCalled = false;
  let skipAuditPayload = null;
  const service = createLiveOpsChatCampaignService({
    pool: {
      async connect() {
        return {
          async query(sql, params) {
            const text = String(sql || "");
            if (text.includes("FROM config_versions") && text.includes("LIMIT 1")) {
              return {
                rows: [
                  {
                    version: 9,
                    created_at: "2026-03-08T12:00:00.000Z",
                    created_by: 7001,
                    config_json: buildCampaign()
                  }
                ]
              };
            }
            if (text.includes("COUNT(*)::int AS sent_total")) {
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
            if (text.includes("event_key IN ('runtime.scene.ready', 'runtime.scene.failed')")) {
              return {
                rows: [
                  {
                    ready_24h: 5,
                    failed_24h: 3,
                    low_end_24h: 3,
                    avg_loaded_bundles_24h: 2.5,
                    daily_breakdown_7d: [
                      { day: "2026-03-08", total_count: 4, ready_count: 2, failed_count: 2, low_end_count: 2 },
                      { day: "2026-03-07", total_count: 4, ready_count: 2, failed_count: 2, low_end_count: 2 }
                    ],
                    quality_breakdown_24h: [],
                    perf_breakdown_24h: []
                  }
                ]
              };
            }
            if (text.includes("COALESCE(payload_json->>'dispatch_source', 'manual') = 'scheduler'")) {
              return { rows: [] };
            }
            if (text.includes("INSERT INTO admin_audit") && text.includes("live_ops_campaign_scheduler_skip")) {
              skipAuditPayload = JSON.parse(String(params[2] || "{}"));
              return { rows: [] };
            }
            return { rows: [] };
          },
          release() {}
        };
      }
    },
    fetchImpl: async () => {
      fetchCalled = true;
      return { ok: true };
    },
    botToken: "bot_token",
    botUsername: "airdropkral_2026_bot",
    webappPublicUrl: "https://example.com/app",
    webappHmacSecret: "secret",
    resolveWebappVersion: async () => ({ version: "abc123" }),
    nowFactory: () => new Date("2026-03-08T12:30:00.000Z"),
    logger: () => {}
  });

  const result = await service.runScheduledDispatch({
    adminId: 7010
  });

  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.equal(result.reason, "scene_runtime_alert_blocked");
  assert.equal(result.scheduler_summary.scene_gate_state, "alert");
  assert.equal(result.scheduler_summary.scene_gate_effect, "blocked");
  assert.equal(result.scheduler_summary.ready_for_auto_dispatch, false);
  assert.equal(skipAuditPayload.reason, "scene_runtime_alert_blocked");
  assert.equal(skipAuditPayload.scene_gate_state, "alert");
  assert.equal(fetchCalled, false);
});

test("live ops chat campaign service scheduler dispatch caps recipients on watch gate", async () => {
  let sendCount = 0;
  const { pool } = createQueryRecorder((text) => {
    if (text.includes("FROM config_versions") && text.includes("LIMIT 1")) {
      return {
        rows: [
          {
            version: 10,
            created_at: "2026-03-08T12:00:00.000Z",
            created_by: 7001,
            config_json: buildCampaign({
              targeting: {
                max_recipients: 40
              }
            })
          }
        ]
      };
    }
    if (text.includes("event_key IN ('runtime.scene.ready', 'runtime.scene.failed')")) {
      return {
        rows: [
          {
            ready_24h: 9,
            failed_24h: 1,
            low_end_24h: 4,
            avg_loaded_bundles_24h: 3.1,
            daily_breakdown_7d: [
              { day: "2026-03-08", total_count: 10, ready_count: 9, failed_count: 1, low_end_count: 4 },
              { day: "2026-03-07", total_count: 10, ready_count: 10, failed_count: 0, low_end_count: 2 }
            ],
            quality_breakdown_24h: [],
            perf_breakdown_24h: []
          }
        ]
      };
    }
    if (text.includes("INSERT INTO behavior_events") || text.includes("INSERT INTO admin_audit")) {
      return { rows: [] };
    }
    return { rows: [] };
  });

  const service = createLiveOpsChatCampaignService({
    pool,
    fetchImpl: async () => {
      sendCount += 1;
      return { ok: true };
    },
    botToken: "bot_token",
    botUsername: "airdropkral_2026_bot",
    webappPublicUrl: "https://example.com/app",
    webappHmacSecret: "secret",
    resolveWebappVersion: async () => ({ version: "abc123" }),
    nowFactory: () => new Date("2026-03-08T12:30:00.000Z"),
    logger: () => {},
    loadCandidates: async () =>
      Array.from({ length: 30 }, (_, index) => ({
        user_id: index + 1,
        telegram_id: 8000 + index,
        locale: "tr",
        last_seen_at: "2026-03-08T10:00:00.000Z",
        prefs_json: {}
      }))
  });

  const result = await service.dispatchCampaign({
    adminId: 7010,
    dryRun: false,
    reason: "scheduled_window_dispatch",
    dispatchSource: "scheduler",
    campaign: buildCampaign({
      targeting: {
        max_recipients: 40
      }
    })
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.sent, 20);
  assert.equal(result.data.scene_gate_state, "watch");
  assert.equal(result.data.scene_gate_effect, "capped");
  assert.equal(result.data.scene_gate_recipient_cap, 20);
  assert.equal(sendCount, 20);
});
