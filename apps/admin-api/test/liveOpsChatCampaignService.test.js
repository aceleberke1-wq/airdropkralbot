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
            if (text.includes("action = 'live_ops_campaign_ops_alert'") && text.includes("telegram_sent_24h")) {
              return {
                rows: [
                  {
                    raised_24h: 1,
                    raised_7d: 3,
                    telegram_sent_24h: 1,
                    telegram_sent_7d: 2,
                    effective_cap_delta_24h: 40,
                    effective_cap_delta_7d: 68,
                    max_effective_cap_delta_7d: 40
                  }
                ]
              };
            }
            if (text.includes("action = 'live_ops_campaign_ops_alert'") && text.includes("notification_reason")) {
              return {
                rows: [
                  { bucket_key: "alert_state", item_count: 2 },
                  { bucket_key: "watch_state", item_count: 1 }
                ]
              };
            }
            if (text.includes("action = 'live_ops_campaign_ops_alert'") && text.includes("payload_json->>'locale_bucket'")) {
              return {
                rows: [
                  { bucket_key: "tr", item_count: 2 },
                  { bucket_key: "en", item_count: 1 }
                ]
              };
            }
            if (text.includes("action = 'live_ops_campaign_ops_alert'") && text.includes("payload_json->>'segment_key'")) {
              return {
                rows: [
                  { bucket_key: "wallet_unlinked", item_count: 2 },
                  { bucket_key: "inactive_returning", item_count: 1 }
                ]
              };
            }
            if (text.includes("action = 'live_ops_campaign_ops_alert'") && text.includes("payload_json->>'surface_bucket'")) {
              return {
                rows: [
                  { bucket_key: "wallet_panel", item_count: 2 },
                  { bucket_key: "support_panel", item_count: 1 }
                ]
              };
            }
            if (text.includes("action = 'live_ops_campaign_ops_alert'") && text.includes("payload_json->>'variant_bucket'")) {
              return {
                rows: [
                  { bucket_key: "treatment", item_count: 2 },
                  { bucket_key: "control", item_count: 1 }
                ]
              };
            }
            if (text.includes("action = 'live_ops_campaign_ops_alert'") && text.includes("payload_json->>'cohort_bucket'")) {
              return {
                rows: [
                  { bucket_key: "17", item_count: 2 },
                  { bucket_key: "42", item_count: 1 }
                ]
              };
            }
            if (text.includes("action = 'live_ops_campaign_ops_alert'") && text.includes("telegram_sent_count")) {
              return {
                rows: [
                  { day: "2026-03-08", alert_count: 1, telegram_sent_count: 1, effective_cap_delta_sum: 40, effective_cap_delta_max: 40 },
                  { day: "2026-03-07", alert_count: 2, telegram_sent_count: 1, effective_cap_delta_sum: 28, effective_cap_delta_max: 20 }
                ]
              };
            }
            if (text.includes("action = 'live_ops_campaign_ops_alert'") && text.includes("ORDER BY created_at DESC") && text.includes("LIMIT 1")) {
              return {
                rows: [
                  {
                    created_at: "2026-03-08T12:27:00.000Z",
                    payload_json: {
                      alarm_state: "alert",
                      notification_reason: "alert_state",
                      experiment_key: "webapp_react_v1",
                      effective_cap_delta: 40,
                      telegram_sent: true,
                      telegram_sent_at: "2026-03-08T12:26:30.000Z"
                    }
                  }
                ]
              };
            }
            if (text.includes("action = 'live_ops_campaign_dispatch'") && text.includes("dispatches_24h")) {
              return {
                rows: [
                  {
                    dispatches_24h: 1,
                    dispatches_7d: 3,
                    query_strategy_applied_24h: 1,
                    query_strategy_applied_7d: 3,
                    query_adjustment_applied_24h: 1,
                    query_adjustment_applied_7d: 2,
                    query_adjustment_total_delta_24h: 7,
                    query_adjustment_total_delta_7d: 9,
                    prefilter_applied_24h: 1,
                    prefilter_applied_7d: 2,
                    prefilter_delta_24h: 4,
                    prefilter_delta_7d: 6,
                    prioritized_focus_matches_24h: 5,
                    prioritized_focus_matches_7d: 11,
                    selected_focus_matches_24h: 0,
                    selected_focus_matches_7d: 1
                  }
                ]
              };
            }
            if (text.includes("action = 'live_ops_campaign_dispatch'") && text.includes("prefilter_applied_count")) {
              return {
                rows: [
                  {
                    day: "2026-03-08",
                    dispatch_count: 1,
                    query_strategy_applied_count: 1,
                    prefilter_applied_count: 1,
                    prefilter_delta_sum: 4,
                    prioritized_focus_matches: 5,
                    selected_focus_matches: 0
                  },
                  {
                    day: "2026-03-07",
                    dispatch_count: 2,
                    query_strategy_applied_count: 2,
                    prefilter_applied_count: 1,
                    prefilter_delta_sum: 2,
                    prioritized_focus_matches: 6,
                    selected_focus_matches: 1
                  }
                ]
              };
            }
            if (text.includes("action = 'live_ops_campaign_dispatch'") && text.includes("adjustment_count")) {
              return {
                rows: [
                  { day: "2026-03-08", adjustment_count: 1, total_delta_sum: 7, max_delta_value: 7 },
                  { day: "2026-03-07", adjustment_count: 1, total_delta_sum: 2, max_delta_value: 2 }
                ]
              };
            }
            if (text.includes("action = 'live_ops_campaign_dispatch'") && text.includes("targeting_selection_summary,prefilter_summary,reason")) {
              return {
                rows: [
                  { bucket_key: "prefilter_applied", item_count: 2 },
                  { bucket_key: "prefilter_shifted_to_query_strategy", item_count: 1 }
                ]
              };
            }
            if (
              text.includes("action = 'live_ops_campaign_dispatch'") &&
              text.includes("CROSS JOIN LATERAL jsonb_array_elements") &&
              text.includes("query_strategy_summary,segment_strategy_reason") &&
              text.includes("to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day")
            ) {
              return {
                rows: [
                  { day: "2026-03-08", bucket_key: "segment_query_active_window_tight", item_count: 7 },
                  { day: "2026-03-07", bucket_key: "segment_query_active_window_tight", item_count: 2 }
                ]
              };
            }
            if (
              text.includes("action = 'live_ops_campaign_dispatch'") &&
              text.includes("to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day") &&
              text.includes("targeting_selection_summary,query_strategy_summary,segment_strategy_reason")
            ) {
              return {
                rows: [
                  { day: "2026-03-08", bucket_key: "segment_query_active_window_tight", item_count: 2 },
                  { day: "2026-03-07", bucket_key: "segment_query_active_window_tight", item_count: 1 },
                  { day: "2026-03-06", bucket_key: "segment_query_offer_window_tight", item_count: 1 }
                ]
              };
            }
            if (
              text.includes("action = 'live_ops_campaign_dispatch'") &&
              text.includes("CROSS JOIN LATERAL jsonb_array_elements") &&
              text.includes("query_strategy_summary,reason") &&
              text.includes("to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day")
            ) {
              return {
                rows: [
                  { day: "2026-03-08", bucket_key: "query_strategy_locale_and_segment", item_count: 7 },
                  { day: "2026-03-07", bucket_key: "query_strategy_locale_and_segment", item_count: 2 }
                ]
              };
            }
            if (
              text.includes("action = 'live_ops_campaign_dispatch'") &&
              text.includes("to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day") &&
              text.includes("targeting_selection_summary,query_strategy_summary,reason")
            ) {
              return {
                rows: [
                  { day: "2026-03-08", bucket_key: "query_strategy_locale_and_segment", item_count: 2 },
                  { day: "2026-03-07", bucket_key: "query_strategy_locale_and_segment", item_count: 1 },
                  { day: "2026-03-06", bucket_key: "query_strategy_locale_and_segment", item_count: 1 }
                ]
              };
            }
            if (
              text.includes("action = 'live_ops_campaign_dispatch'") &&
              text.includes("CROSS JOIN LATERAL jsonb_array_elements") &&
              text.includes("adj->>'field_key'")
            ) {
              if (text.includes("to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day")) {
                return {
                  rows: [
                    { day: "2026-03-08", bucket_key: "active_within_days_cap", item_count: 7 },
                    { day: "2026-03-08", bucket_key: "pool_limit_multiplier", item_count: 2 }
                  ]
                };
              }
              return {
                rows: [
                  { bucket_key: "active_within_days_cap", item_count: 7 },
                  { bucket_key: "pool_limit_multiplier", item_count: 2 }
                ]
              };
            }
            if (
              text.includes("action = 'live_ops_campaign_dispatch'") &&
              text.includes("CROSS JOIN LATERAL jsonb_array_elements") &&
              text.includes("adj->>'reason_code'")
            ) {
              return {
                rows: [
                  { bucket_key: "selection_family_risk_tightened", item_count: 9 }
                ]
              };
            }
            if (text.includes("action = 'live_ops_campaign_dispatch'") && text.includes("targeting_selection_summary,query_strategy_summary,segment_strategy_reason")) {
              return {
                rows: [
                  { bucket_key: "segment_query_active_window_tight", item_count: 2 },
                  { bucket_key: "segment_query_offer_window_tight", item_count: 1 }
                ]
              };
            }
            if (
              text.includes("action = 'live_ops_campaign_dispatch'") &&
              text.includes("CROSS JOIN LATERAL jsonb_array_elements") &&
              text.includes("query_strategy_summary,segment_strategy_reason")
            ) {
              return {
                rows: [
                  { bucket_key: "segment_query_active_window_tight", item_count: 9 }
                ]
              };
            }
            if (text.includes("action = 'live_ops_campaign_dispatch'") && text.includes("targeting_selection_summary,query_strategy_summary,reason")) {
              return {
                rows: [
                  { bucket_key: "query_strategy_locale_and_segment", item_count: 3 }
                ]
              };
            }
            if (
              text.includes("action = 'live_ops_campaign_dispatch'") &&
              text.includes("CROSS JOIN LATERAL jsonb_array_elements") &&
              text.includes("query_strategy_summary,reason")
            ) {
              return {
                rows: [
                  { bucket_key: "query_strategy_locale_and_segment", item_count: 9 }
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
                      window_key: "wallet_reconnect:2020-01-01T00:00:00.000Z:2035-01-01T00:00:00.000Z",
                      targeting_selection_summary: {
                        guidance_mode: "protective",
                        focus_dimension: "locale",
                        focus_bucket: "tr",
                        query_strategy_summary: {
                          reason: "query_strategy_locale_and_segment",
                          segment_strategy_reason: "segment_query_active_window_tight",
                          adjustment_rows: [
                            {
                              field_key: "pool_limit_multiplier",
                              before_value: 3,
                              after_value: 2,
                              delta_value: -1,
                              direction: "decrease",
                              reason_code: "selection_family_risk_tightened"
                            },
                            {
                              field_key: "active_within_days_cap",
                              before_value: 14,
                              after_value: 7,
                              delta_value: -7,
                              direction: "decrease",
                              reason_code: "selection_family_risk_tightened"
                            }
                          ]
                        },
                        prefilter_summary: {
                          reason: "prefilter_applied"
                        }
                      }
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
      recommended_recipient_cap: 0,
      effective_cap_delta: 40,
      recommendation_pressure_band: "alert",
      recommendation_reason: "scene_runtime_alert_blocked",
      targeting_guidance_default_mode: "protective",
      targeting_guidance_state: "alert",
      targeting_guidance_cap: 10,
      targeting_guidance_reason: "watch_state_locale_pressure",
      selection_summary: {
        guidance_mode: "protective",
        guidance_state: "alert",
        guidance_reason: "watch_state_locale_pressure",
        focus_dimension: "locale",
        focus_bucket: "tr",
        focus_matches_target: true,
        prioritized_candidates: 12,
        selected_candidates: 4,
        prioritized_focus_matches: 5,
        selected_focus_matches: 0,
        prioritized_top_locale_matches: 7,
        selected_top_locale_matches: 0,
        prioritized_top_variant_matches: 6,
        selected_top_variant_matches: 1,
        prioritized_top_cohort_matches: 5,
        selected_top_cohort_matches: 1,
        query_strategy_summary: {
          applied: true,
          reason: "query_strategy_locale_and_segment",
          mode_key: "protective",
          segment_key: "wallet_unlinked",
          focus_matches_target: true,
          dimension: "locale",
          bucket: "tr",
          exclude_locale_prefix: "tr",
          locale_strategy_reason: "query_strategy_locale_exclusion",
          segment_strategy_reason: "segment_query_active_window_tight",
          pool_limit_multiplier: 2,
          active_within_days_cap: 7,
          inactive_hours_floor: 0,
          max_age_days_cap: 0,
          offer_age_days_cap: 0
        },
        prefilter_summary: {
          applied: true,
          dimension: "locale",
          bucket: "tr",
          reason: "prefilter_applied",
          candidates_before: 12,
          candidates_after: 5
        }
      },
      selection_trend: {
        dispatches_24h: 1,
        dispatches_7d: 3,
        query_strategy_applied_24h: 1,
        query_strategy_applied_7d: 3,
        query_adjustment_applied_24h: 1,
        query_adjustment_applied_7d: 2,
        query_adjustment_total_delta_24h: 7,
        query_adjustment_total_delta_7d: 9,
        prefilter_applied_24h: 1,
        prefilter_applied_7d: 2,
        prefilter_delta_24h: 4,
        prefilter_delta_7d: 6,
        prioritized_focus_matches_24h: 5,
        prioritized_focus_matches_7d: 11,
        selected_focus_matches_24h: 0,
        selected_focus_matches_7d: 1,
        latest_selection_at: "2026-03-08T12:25:00.000Z",
        latest_guidance_mode: "protective",
        latest_focus_dimension: "locale",
        latest_focus_bucket: "tr",
        latest_query_strategy_reason: "query_strategy_locale_and_segment",
        latest_query_strategy_family: "locale_and_segment",
        latest_segment_strategy_reason: "segment_query_active_window_tight",
        latest_segment_strategy_family: "active_window",
        latest_query_adjustment_field: "active_within_days_cap",
        latest_query_adjustment_field_family: "activity_window",
        latest_query_adjustment_reason: "selection_family_risk_tightened",
        latest_query_adjustment_total_delta: 7,
        latest_prefilter_reason: "prefilter_applied",
        daily_breakdown: [
          {
            day: "2026-03-08",
            dispatch_count: 1,
            query_strategy_applied_count: 1,
            prefilter_applied_count: 1,
            prefilter_delta_sum: 4,
            prioritized_focus_matches: 5,
            selected_focus_matches: 0
          }
        ],
        query_adjustment_daily_breakdown: [
          { day: "2026-03-08", adjustment_count: 1, total_delta_sum: 7, max_delta_value: 7 },
          { day: "2026-03-07", adjustment_count: 1, total_delta_sum: 2, max_delta_value: 2 }
        ],
        query_strategy_reason_breakdown: [
          { bucket_key: "query_strategy_locale_and_segment", item_count: 3 }
        ],
        query_strategy_family_breakdown: [
          { bucket_key: "locale_and_segment", item_count: 3 }
        ],
        query_adjustment_field_breakdown: [
          { bucket_key: "active_within_days_cap", item_count: 7 },
          { bucket_key: "pool_limit_multiplier", item_count: 2 }
        ],
        query_adjustment_reason_breakdown: [
          { bucket_key: "selection_family_risk_tightened", item_count: 9 }
        ],
        query_adjustment_query_family_breakdown: [
          { bucket_key: "locale_and_segment", item_count: 9 }
        ],
        query_strategy_family_daily_breakdown: [
          { day: "2026-03-08", bucket_key: "locale_and_segment", item_count: 2 },
          { day: "2026-03-07", bucket_key: "locale_and_segment", item_count: 1 },
          { day: "2026-03-06", bucket_key: "locale_and_segment", item_count: 1 }
        ],
        query_adjustment_query_family_daily_breakdown: [
          { day: "2026-03-08", bucket_key: "locale_and_segment", item_count: 7 },
          { day: "2026-03-07", bucket_key: "locale_and_segment", item_count: 2 }
        ],
        segment_strategy_reason_breakdown: [
          { bucket_key: "segment_query_active_window_tight", item_count: 2 }
        ],
        segment_strategy_family_breakdown: [
          { bucket_key: "active_window", item_count: 2 }
        ],
        query_adjustment_segment_family_breakdown: [
          { bucket_key: "active_window", item_count: 9 }
        ],
        segment_strategy_family_daily_breakdown: [
          { day: "2026-03-08", bucket_key: "active_window", item_count: 2 },
          { day: "2026-03-07", bucket_key: "active_window", item_count: 1 },
          { day: "2026-03-06", bucket_key: "offer_window", item_count: 1 }
        ],
        query_adjustment_segment_family_daily_breakdown: [
          { day: "2026-03-08", bucket_key: "active_window", item_count: 7 },
          { day: "2026-03-07", bucket_key: "active_window", item_count: 2 }
        ],
        query_adjustment_field_family_daily_breakdown: [
          { day: "2026-03-08", bucket_key: "activity_window", item_count: 7 },
          { day: "2026-03-07", bucket_key: "pool_limit", item_count: 2 }
        ],
        prefilter_reason_breakdown: [
          { bucket_key: "prefilter_applied", item_count: 2 }
        ],
        query_adjustment_field_family_breakdown: [
          { bucket_key: "activity_window", item_count: 7 },
          { bucket_key: "pool_limit", item_count: 2 }
        ]
      },
      window_key: "wallet_reconnect:2020-01-01T00:00:00.000Z:2035-01-01T00:00:00.000Z",
      scheduler_skip_24h: 2,
      scheduler_skip_7d: 4,
      scheduler_skip_alarm_state: "alert",
      scheduler_skip_alarm_reason: "scene_runtime_alert_blocked_repeated"
    }),
    readLatestOpsAlertArtifactSummary: async () => ({
      artifact_found: true,
      artifact_path: ".runtime-artifacts/liveops/V5_LIVE_OPS_OPS_ALERT_latest.json",
      artifact_generated_at: "2026-03-08T12:26:00.000Z",
      artifact_age_min: 4,
      alarm_state: "alert",
      should_notify: true,
      notification_reason: "scene_runtime_alert_blocked_repeated",
      fingerprint: "alert|scene_runtime_alert_blocked_repeated|2026-03-08T12:26:00.000Z",
      pressure_focus_escalation_band: "alert",
      pressure_focus_escalation_reason: "watch_state_locale_pressure",
      pressure_focus_escalation_dimension: "locale",
      pressure_focus_escalation_bucket: "tr",
      pressure_focus_escalation_share: 0.875,
      pressure_focus_effective_delta_ratio: 0.8,
      selection_family_escalation_band: "alert",
      selection_family_escalation_reason: "watch_state_query_family_pressure",
      selection_family_escalation_dimension: "query_family",
      selection_family_escalation_bucket: "locale_and_segment",
      selection_family_escalation_score: 8,
      selection_family_daily_weight: 2,
      selection_query_family_weight: 4,
      selection_segment_family_weight: 3,
      selection_field_family_weight: 0,
      selection_query_family_match_days: 4,
      selection_segment_family_match_days: 2,
      selection_field_family_match_days: 0,
      selection_query_strategy_applied_24h: 1,
      selection_query_strategy_applied_7d: 3,
      selection_latest_query_strategy_reason: "query_strategy_locale_and_segment",
      selection_latest_query_strategy_family: "locale_and_segment",
      selection_latest_segment_strategy_reason: "segment_query_active_window_tight",
      selection_latest_segment_strategy_family: "active_window",
      selection_top_query_strategy_reason: "query_strategy_locale_and_segment",
      selection_top_query_strategy_family: "locale_and_segment",
      selection_top_query_strategy_reason_count: 3,
      selection_top_segment_strategy_reason: "segment_query_active_window_tight",
      selection_top_segment_strategy_family: "active_window",
      selection_top_segment_strategy_reason_count: 2,
      selection_query_adjustment_applied: true,
      selection_query_adjustment_count: 2,
      selection_query_adjustment_total_delta: 9,
      selection_query_adjustment_top_field: "active_within_days_cap",
      selection_query_adjustment_top_after_value: 7,
      selection_query_adjustment_top_delta: -7,
      selection_query_adjustment_top_direction: "decrease",
      selection_query_adjustment_top_reason: "selection_family_risk_tightened",
      selection_query_adjustment_escalation_band: "alert",
      selection_query_adjustment_escalation_reason: "watch_state_query_adjustment_pressure",
      selection_query_adjustment_escalation_dimension: "query_family",
      selection_query_adjustment_escalation_bucket: "locale_and_segment",
      selection_query_adjustment_escalation_field: "active_within_days_cap",
      selection_query_adjustment_escalation_score: 11,
      selection_query_adjustment_daily_weight: 1,
      selection_query_adjustment_total_delta_weight: 3,
      selection_query_adjustment_top_delta_weight: 2,
      selection_query_adjustment_field_weight: 3,
      selection_query_adjustment_field_family: "activity_window",
      selection_query_adjustment_field_family_weight: 3,
      selection_query_adjustment_query_family_match_days: 2,
      selection_query_adjustment_segment_family_match_days: 1,
      selection_query_adjustment_field_family_match_days: 1,
      telegram_sent: true,
      telegram_reason: "",
      telegram_sent_at: "2026-03-08T12:26:30.000Z"
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
  assert.equal(snapshot.scheduler_summary.recipient_cap_recommendation.recommended_recipient_cap, 0);
  assert.equal(snapshot.scheduler_summary.recipient_cap_recommendation.effective_cap_delta, 40);
  assert.equal(snapshot.scheduler_summary.recipient_cap_recommendation.reason, "scene_runtime_alert_blocked");
  assert.equal(snapshot.scheduler_summary.recipient_cap_recommendation.experiment_key, "webapp_react_v1");
  assert.equal(snapshot.scheduler_summary.targeting_guidance.default_mode, "protective");
  assert.equal(snapshot.scheduler_summary.targeting_guidance.guidance_state, "alert");
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
  assert.equal(snapshot.task_summary.recommended_recipient_cap, 0);
  assert.equal(snapshot.task_summary.effective_cap_delta, 40);
  assert.equal(snapshot.task_summary.targeting_guidance_default_mode, "protective");
  assert.equal(snapshot.task_summary.targeting_guidance_cap, 10);
  assert.equal(snapshot.task_summary.selection_summary.guidance_mode, "protective");
  assert.equal(snapshot.task_summary.selection_summary.selected_candidates, 4);
  assert.equal(snapshot.task_summary.selection_summary.selected_top_locale_matches, 0);
  assert.equal(snapshot.task_summary.selection_summary.query_strategy_summary.applied, true);
  assert.equal(snapshot.task_summary.selection_summary.query_strategy_summary.pool_limit_multiplier, 2);
  assert.equal(snapshot.task_summary.selection_summary.query_strategy_summary.active_within_days_cap, 7);
  assert.equal(snapshot.task_summary.selection_summary.prefilter_summary.applied, true);
  assert.equal(snapshot.task_summary.selection_summary.prefilter_summary.candidates_after, 5);
  assert.equal(snapshot.task_summary.selection_trend.query_strategy_applied_7d, 3);
  assert.equal(snapshot.task_summary.selection_trend.latest_query_strategy_reason, "query_strategy_locale_and_segment");
  assert.equal(snapshot.task_summary.selection_trend.latest_query_strategy_family, "locale_and_segment");
  assert.equal(snapshot.task_summary.selection_trend.latest_segment_strategy_reason, "segment_query_active_window_tight");
  assert.equal(snapshot.task_summary.selection_trend.latest_segment_strategy_family, "active_window");
  assert.equal(snapshot.task_summary.selection_trend.query_strategy_reason_breakdown[0].bucket_key, "query_strategy_locale_and_segment");
  assert.equal(snapshot.task_summary.selection_trend.query_strategy_family_breakdown[0].bucket_key, "locale_and_segment");
  assert.equal(snapshot.task_summary.scheduler_skip_alarm_state, "alert");
  assert.equal(snapshot.task_summary.scheduler_skip_24h, 2);
  assert.equal(snapshot.selection_trend_summary.dispatches_24h, 1);
  assert.equal(snapshot.selection_trend_summary.dispatches_7d, 3);
  assert.equal(snapshot.selection_trend_summary.query_strategy_applied_24h, 1);
  assert.equal(snapshot.selection_trend_summary.query_strategy_applied_7d, 3);
  assert.equal(snapshot.selection_trend_summary.query_adjustment_applied_24h, 1);
  assert.equal(snapshot.selection_trend_summary.query_adjustment_applied_7d, 2);
  assert.equal(snapshot.selection_trend_summary.query_adjustment_total_delta_24h, 7);
  assert.equal(snapshot.selection_trend_summary.query_adjustment_total_delta_7d, 9);
  assert.equal(snapshot.selection_trend_summary.prefilter_applied_7d, 2);
  assert.equal(snapshot.selection_trend_summary.prefilter_delta_7d, 6);
  assert.equal(snapshot.selection_trend_summary.latest_guidance_mode, "protective");
  assert.equal(snapshot.selection_trend_summary.latest_focus_bucket, "tr");
  assert.equal(snapshot.selection_trend_summary.latest_query_strategy_reason, "query_strategy_locale_and_segment");
  assert.equal(snapshot.selection_trend_summary.latest_query_strategy_family, "locale_and_segment");
  assert.equal(snapshot.selection_trend_summary.latest_segment_strategy_reason, "segment_query_active_window_tight");
  assert.equal(snapshot.selection_trend_summary.latest_segment_strategy_family, "active_window");
  assert.equal(snapshot.selection_trend_summary.latest_query_adjustment_field, "active_within_days_cap");
  assert.equal(snapshot.selection_trend_summary.latest_query_adjustment_field_family, "activity_window");
  assert.equal(snapshot.selection_trend_summary.latest_query_adjustment_reason, "selection_family_risk_tightened");
  assert.equal(snapshot.selection_trend_summary.latest_query_adjustment_total_delta, 7);
  assert.equal(snapshot.selection_trend_summary.latest_prefilter_reason, "prefilter_applied");
  assert.equal(snapshot.selection_trend_summary.latest_family_risk_state, "watch");
  assert.equal(snapshot.selection_trend_summary.latest_family_risk_reason, "query_strategy_family_streak_watch");
  assert.equal(snapshot.selection_trend_summary.latest_family_risk_bucket, "locale_and_segment");
  assert.equal(snapshot.selection_trend_summary.latest_family_risk_score, 4);
  assert.equal(snapshot.selection_trend_summary.daily_breakdown[0].query_strategy_applied_count, 1);
  assert.equal(snapshot.selection_trend_summary.daily_breakdown[0].prefilter_delta_sum, 4);
  assert.equal(snapshot.selection_trend_summary.query_adjustment_daily_breakdown[0].adjustment_count, 1);
  assert.equal(snapshot.selection_trend_summary.query_adjustment_daily_breakdown[0].total_delta_sum, 7);
  assert.equal(snapshot.selection_trend_summary.query_adjustment_daily_breakdown[0].max_delta_value, 7);
  assert.equal(snapshot.selection_trend_summary.query_strategy_reason_breakdown[0].bucket_key, "query_strategy_locale_and_segment");
  assert.equal(snapshot.selection_trend_summary.query_strategy_family_breakdown[0].bucket_key, "locale_and_segment");
  assert.equal(snapshot.selection_trend_summary.query_adjustment_field_breakdown[0].bucket_key, "active_within_days_cap");
  assert.equal(snapshot.selection_trend_summary.query_adjustment_field_family_breakdown[0].bucket_key, "activity_window");
  assert.equal(snapshot.selection_trend_summary.query_adjustment_reason_breakdown[0].bucket_key, "selection_family_risk_tightened");
  assert.equal(snapshot.selection_trend_summary.query_adjustment_query_family_breakdown[0].bucket_key, "locale_and_segment");
  assert.equal(snapshot.selection_trend_summary.query_strategy_family_daily_breakdown[0].bucket_key, "locale_and_segment");
  assert.equal(snapshot.selection_trend_summary.query_adjustment_query_family_daily_breakdown[0].bucket_key, "locale_and_segment");
  assert.equal(snapshot.selection_trend_summary.query_adjustment_field_family_daily_breakdown[0].bucket_key, "activity_window");
  assert.equal(snapshot.selection_trend_summary.segment_strategy_reason_breakdown[0].bucket_key, "segment_query_active_window_tight");
  assert.equal(snapshot.selection_trend_summary.segment_strategy_family_breakdown[0].bucket_key, "active_window");
  assert.equal(snapshot.selection_trend_summary.query_adjustment_segment_family_breakdown[0].bucket_key, "active_window");
  assert.equal(snapshot.selection_trend_summary.segment_strategy_family_daily_breakdown[0].bucket_key, "active_window");
  assert.equal(snapshot.selection_trend_summary.query_adjustment_segment_family_daily_breakdown[0].bucket_key, "active_window");
  assert.equal(snapshot.selection_trend_summary.family_risk_daily_breakdown[0].risk_state, "watch");
  assert.equal(snapshot.selection_trend_summary.family_risk_daily_breakdown[0].risk_score, 4);
  assert.equal(snapshot.selection_trend_summary.family_risk_band_breakdown[0].bucket_key, "watch");
  assert.equal(snapshot.selection_trend_summary.family_risk_band_breakdown[0].item_count, 3);
  assert.equal(snapshot.selection_trend_summary.prefilter_reason_breakdown[0].bucket_key, "prefilter_applied");
  assert.equal(snapshot.ops_alert_summary.artifact_found, true);
  assert.equal(snapshot.ops_alert_summary.alarm_state, "alert");
  assert.equal(snapshot.ops_alert_summary.telegram_sent, true);
  assert.equal(snapshot.ops_alert_summary.notification_reason, "scene_runtime_alert_blocked_repeated");
  assert.equal(snapshot.ops_alert_summary.pressure_focus_escalation_band, "alert");
  assert.equal(snapshot.ops_alert_summary.pressure_focus_escalation_reason, "watch_state_locale_pressure");
  assert.equal(snapshot.ops_alert_summary.pressure_focus_escalation_dimension, "locale");
  assert.equal(snapshot.ops_alert_summary.pressure_focus_escalation_bucket, "tr");
  assert.equal(snapshot.ops_alert_summary.selection_family_escalation_band, "alert");
  assert.equal(snapshot.ops_alert_summary.selection_family_escalation_reason, "watch_state_query_family_pressure");
  assert.equal(snapshot.ops_alert_summary.selection_family_escalation_dimension, "query_family");
  assert.equal(snapshot.ops_alert_summary.selection_family_escalation_bucket, "locale_and_segment");
  assert.equal(snapshot.ops_alert_summary.selection_family_escalation_score, 8);
  assert.equal(snapshot.ops_alert_summary.selection_field_family_weight, 0);
  assert.equal(snapshot.ops_alert_summary.selection_family_daily_weight, 2);
  assert.equal(snapshot.ops_alert_summary.selection_query_family_match_days, 4);
  assert.equal(snapshot.ops_alert_summary.selection_segment_family_match_days, 2);
  assert.equal(snapshot.ops_alert_summary.selection_query_strategy_applied_7d, 3);
  assert.equal(snapshot.ops_alert_summary.selection_latest_query_strategy_reason, "query_strategy_locale_and_segment");
  assert.equal(snapshot.ops_alert_summary.selection_latest_query_strategy_family, "locale_and_segment");
  assert.equal(snapshot.ops_alert_summary.selection_top_query_strategy_family, "locale_and_segment");
  assert.equal(snapshot.ops_alert_summary.selection_top_segment_strategy_reason, "segment_query_active_window_tight");
  assert.equal(snapshot.ops_alert_summary.selection_latest_segment_strategy_family, "active_window");
  assert.equal(snapshot.ops_alert_summary.selection_top_segment_strategy_family, "active_window");
  assert.equal(snapshot.ops_alert_summary.selection_query_adjustment_applied, true);
  assert.equal(snapshot.ops_alert_summary.selection_query_adjustment_count, 2);
  assert.equal(snapshot.ops_alert_summary.selection_query_adjustment_total_delta, 9);
  assert.equal(snapshot.ops_alert_summary.selection_query_adjustment_top_field, "active_within_days_cap");
  assert.equal(snapshot.ops_alert_summary.selection_query_adjustment_top_after_value, 7);
  assert.equal(snapshot.ops_alert_summary.selection_query_adjustment_top_delta, -7);
  assert.equal(snapshot.ops_alert_summary.selection_query_adjustment_top_direction, "decrease");
  assert.equal(snapshot.ops_alert_summary.selection_query_adjustment_top_reason, "selection_family_risk_tightened");
  assert.equal(snapshot.ops_alert_summary.selection_query_adjustment_escalation_band, "alert");
  assert.equal(snapshot.ops_alert_summary.selection_query_adjustment_escalation_reason, "watch_state_query_adjustment_pressure");
  assert.equal(snapshot.ops_alert_summary.selection_query_adjustment_escalation_field, "active_within_days_cap");
  assert.equal(snapshot.ops_alert_summary.selection_query_adjustment_escalation_score, 11);
  assert.equal(snapshot.ops_alert_summary.selection_query_adjustment_field_family, "activity_window");
  assert.equal(snapshot.ops_alert_summary.selection_query_adjustment_field_family_weight, 3);
  assert.equal(snapshot.ops_alert_trend_summary.raised_24h, 1);
  assert.equal(snapshot.ops_alert_trend_summary.raised_7d, 3);
  assert.equal(snapshot.ops_alert_trend_summary.experiment_key, "webapp_react_v1");
  assert.equal(snapshot.ops_alert_trend_summary.effective_cap_delta_24h, 40);
  assert.equal(snapshot.ops_alert_trend_summary.effective_cap_delta_7d, 68);
  assert.equal(snapshot.ops_alert_trend_summary.latest_effective_cap_delta, 40);
  assert.equal(snapshot.ops_alert_trend_summary.max_effective_cap_delta_7d, 40);
  assert.equal(snapshot.ops_alert_trend_summary.reason_breakdown[0].bucket_key, "alert_state");
  assert.equal(snapshot.ops_alert_trend_summary.daily_breakdown[0].alert_count, 1);
  assert.equal(snapshot.ops_alert_trend_summary.daily_breakdown[0].effective_cap_delta_sum, 40);
  assert.equal(snapshot.ops_alert_trend_summary.daily_breakdown[1].effective_cap_delta_max, 20);
  assert.equal(snapshot.ops_alert_trend_summary.locale_breakdown[0].bucket_key, "tr");
  assert.equal(snapshot.ops_alert_trend_summary.segment_breakdown[0].bucket_key, "wallet_unlinked");
  assert.equal(snapshot.ops_alert_trend_summary.surface_breakdown[0].bucket_key, "wallet_panel");
  assert.equal(snapshot.ops_alert_trend_summary.variant_breakdown[0].bucket_key, "treatment");
  assert.equal(snapshot.ops_alert_trend_summary.cohort_breakdown[0].bucket_key, "17");
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
  assert.equal(result.data.recommendation_mode, "aggressive");
  assert.equal(result.data.recommendation_mode_cap, 20);
  assert.equal(result.data.recommendation_guidance_state, "clear");
  assert.equal(sendCount, 20);
});

test("live ops chat campaign service scheduler prioritizes away from pressured locale and variant buckets", async () => {
  const sentChatIds = [];
  const { pool } = createQueryRecorder((text) => {
    if (text.includes("FROM config_versions") && text.includes("LIMIT 1")) {
      return { rows: [{ version: 8, created_at: "2026-03-08T12:00:00.000Z", created_by: 7001, config_json: buildCampaign() }] };
    }
    if (text.includes("COUNT(*)::int AS sent_total") && text.includes("interval '72 hours'")) {
      return {
        rows: [{ sent_total: 0, sent_72h: 0, last_sent_at: null, last_segment_key: "", last_dispatch_ref: "" }]
      };
    }
    if (text.includes("event_key IN ('runtime.scene.ready', 'runtime.scene.failed')")) {
      return {
        rows: [
          {
            ready_24h: 10,
            failed_24h: 0,
            low_end_24h: 1,
            avg_loaded_bundles_24h: 3.2,
            daily_breakdown_7d: [{ day: "2026-03-08", total_count: 10, ready_count: 10, failed_count: 0, low_end_count: 1 }],
            quality_breakdown_24h: [],
            perf_breakdown_24h: []
          }
        ]
      };
    }
    if (text.includes("COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours')::bigint AS raised_24h")) {
      return {
        rows: [
          {
            raised_24h: 2,
            raised_7d: 4,
            telegram_sent_24h: 1,
            telegram_sent_7d: 2,
            effective_cap_delta_24h: 6,
            effective_cap_delta_7d: 12,
            max_effective_cap_delta_7d: 6
          }
        ]
      };
    }
    if (text.includes("FROM admin_audit") && text.includes("ORDER BY created_at DESC") && text.includes("live_ops_campaign_ops_alert")) {
      return {
        rows: [
          {
            created_at: "2026-03-08T12:20:00.000Z",
            payload_json: {
              alarm_state: "alert",
              notification_reason: "alert_state",
              telegram_sent: true,
              telegram_sent_at: "2026-03-08T12:20:00.000Z",
              effective_cap_delta: 6
            }
          }
        ]
      };
    }
    if (text.includes("payload_json->>'notification_reason'")) {
      return { rows: [{ bucket_key: "alert_state", item_count: 4 }] };
    }
    if (text.includes("to_char(date_trunc('day', created_at), 'YYYY-MM-DD')")) {
      return {
        rows: [{ day: "2026-03-08", alert_count: 4, telegram_sent_count: 1, effective_cap_delta_sum: 6, effective_cap_delta_max: 6 }]
      };
    }
    if (text.includes("payload_json->>'locale_bucket'")) {
      return { rows: [{ bucket_key: "tr", item_count: 7 }, { bucket_key: "en", item_count: 1 }] };
    }
    if (text.includes("payload_json->>'segment_key'")) {
      return { rows: [{ bucket_key: "wallet_unlinked", item_count: 4 }] };
    }
    if (text.includes("payload_json->>'surface_bucket'")) {
      return { rows: [{ bucket_key: "wallet_panel", item_count: 4 }] };
    }
    if (text.includes("payload_json->>'variant_bucket'")) {
      return { rows: [{ bucket_key: "treatment", item_count: 6 }, { bucket_key: "control", item_count: 2 }] };
    }
    if (text.includes("payload_json->>'cohort_bucket'")) {
      return { rows: [{ bucket_key: "17", item_count: 5 }, { bucket_key: "42", item_count: 1 }] };
    }
    if (text.includes("FROM v5_webapp_experiment_assignments")) {
      return {
        rows: [
          { uid: 1, variant_key: "treatment", cohort_bucket: 17 },
          { uid: 2, variant_key: "treatment", cohort_bucket: 17 },
          { uid: 3, variant_key: "control", cohort_bucket: 42 },
          { uid: 4, variant_key: "control", cohort_bucket: 42 },
          { uid: 5, variant_key: "control", cohort_bucket: 42 }
        ]
      };
    }
    if (text.includes("WHERE u.id = ANY($1::bigint[])") && text.includes("NOT (lower(COALESCE(u.locale, '')) LIKE CONCAT($2, '%'))")) {
      return {
        rows: [{ user_id: 3 }, { user_id: 4 }, { user_id: 5 }]
      };
    }
    if (text.includes("INSERT INTO behavior_events") || text.includes("INSERT INTO admin_audit")) {
      return { rows: [] };
    }
    return { rows: [] };
  });

  const service = createLiveOpsChatCampaignService({
    pool,
    fetchImpl: async (_url, options) => {
      const payload = JSON.parse(String(options.body || "{}"));
      sentChatIds.push(Number(payload.chat_id || 0));
      return { ok: true };
    },
    botToken: "bot_token",
    botUsername: "airdropkral_2026_bot",
    webappPublicUrl: "https://example.com/app",
    webappHmacSecret: "secret",
    resolveWebappVersion: async () => ({ version: "abc123" }),
    nowFactory: () => new Date("2026-03-08T12:30:00.000Z"),
    logger: () => {},
    loadCandidates: async () => [
      { user_id: 1, telegram_id: 8101, locale: "tr", last_seen_at: "2026-03-08T10:00:00.000Z", prefs_json: {} },
      { user_id: 2, telegram_id: 8102, locale: "tr", last_seen_at: "2026-03-08T10:00:00.000Z", prefs_json: {} },
      { user_id: 3, telegram_id: 8103, locale: "en", last_seen_at: "2026-03-08T10:00:00.000Z", prefs_json: {} },
      { user_id: 4, telegram_id: 8104, locale: "en", last_seen_at: "2026-03-08T10:00:00.000Z", prefs_json: {} },
      { user_id: 5, telegram_id: 8105, locale: "en", last_seen_at: "2026-03-08T10:00:00.000Z", prefs_json: {} }
    ]
  });

  const result = await service.dispatchCampaign({
    adminId: 7010,
    dryRun: false,
    reason: "scheduled_window_dispatch",
    dispatchSource: "scheduler",
    campaign: buildCampaign({
      targeting: {
        max_recipients: 6
      }
    })
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.sent, 2);
  assert.equal(result.data.recommendation_mode, "protective");
  assert.equal(result.data.recommendation_guidance_state, "alert");
  assert.deepEqual(
    result.data.sample_users.map((row) => Number(row.user_id || 0)),
    [3, 4]
  );
  assert.deepEqual(sentChatIds, [8103, 8104]);
  assert.equal(result.data.selection_summary.guidance_mode, "protective");
  assert.equal(result.data.selection_summary.prefilter_summary.applied, true);
  assert.equal(result.data.selection_summary.prefilter_summary.reason, "prefilter_applied");
  assert.equal(result.data.selection_summary.prefilter_summary.candidates_before, 5);
  assert.equal(result.data.selection_summary.prefilter_summary.candidates_after, 3);
  assert.equal(result.data.selection_summary.query_strategy_summary.applied, false);
  assert.equal(result.data.selection_summary.selected_top_locale_matches, 0);
  assert.equal(result.data.selection_summary.selected_top_variant_matches, 0);
  assert.equal(result.data.selection_summary.prioritized_top_locale_matches, 0);
});

test("live ops chat campaign service applies locale-aware query strategy before scheduler selection", async () => {
  const sentChatIds = [];
  const { pool, recordedQueries } = createQueryRecorder((text) => {
    if (text.includes("FROM config_versions") && text.includes("LIMIT 1")) {
      return { rows: [{ version: 8, created_at: "2026-03-08T12:00:00.000Z", created_by: 7001, config_json: buildCampaign() }] };
    }
    if (text.includes("COUNT(*)::int AS sent_total") && text.includes("interval '72 hours'")) {
      return { rows: [{ sent_total: 0, sent_72h: 0, last_sent_at: null, last_segment_key: "", last_dispatch_ref: "" }] };
    }
    if (text.includes("event_key IN ('runtime.scene.ready', 'runtime.scene.failed')")) {
      return {
        rows: [
          {
            ready_24h: 10,
            failed_24h: 0,
            low_end_24h: 1,
            avg_loaded_bundles_24h: 3.2,
            daily_breakdown_7d: [{ day: "2026-03-08", total_count: 10, ready_count: 10, failed_count: 0, low_end_count: 1 }],
            quality_breakdown_24h: [],
            perf_breakdown_24h: []
          }
        ]
      };
    }
    if (text.includes("COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours')::bigint AS raised_24h")) {
      return {
        rows: [
          {
            raised_24h: 2,
            raised_7d: 4,
            telegram_sent_24h: 1,
            telegram_sent_7d: 2,
            effective_cap_delta_24h: 6,
            effective_cap_delta_7d: 12,
            max_effective_cap_delta_7d: 6
          }
        ]
      };
    }
    if (text.includes("FROM admin_audit") && text.includes("ORDER BY created_at DESC") && text.includes("live_ops_campaign_ops_alert")) {
      return {
        rows: [
          {
            created_at: "2026-03-08T12:20:00.000Z",
            payload_json: {
              alarm_state: "alert",
              notification_reason: "alert_state",
              telegram_sent: true,
              telegram_sent_at: "2026-03-08T12:20:00.000Z",
              effective_cap_delta: 6
            }
          }
        ]
      };
    }
    if (text.includes("payload_json->>'notification_reason'")) {
      return { rows: [{ bucket_key: "alert_state", item_count: 4 }] };
    }
    if (text.includes("to_char(date_trunc('day', created_at), 'YYYY-MM-DD')")) {
      return {
        rows: [{ day: "2026-03-08", alert_count: 4, telegram_sent_count: 1, effective_cap_delta_sum: 6, effective_cap_delta_max: 6 }]
      };
    }
    if (text.includes("payload_json->>'locale_bucket'")) {
      return { rows: [{ bucket_key: "tr", item_count: 7 }, { bucket_key: "en", item_count: 1 }] };
    }
    if (text.includes("payload_json->>'segment_key'")) {
      return { rows: [{ bucket_key: "wallet_unlinked", item_count: 4 }] };
    }
    if (text.includes("payload_json->>'surface_bucket'")) {
      return { rows: [{ bucket_key: "wallet_panel", item_count: 4 }] };
    }
    if (text.includes("payload_json->>'variant_bucket'")) {
      return { rows: [{ bucket_key: "treatment", item_count: 6 }, { bucket_key: "control", item_count: 2 }] };
    }
    if (text.includes("payload_json->>'cohort_bucket'")) {
      return { rows: [{ bucket_key: "17", item_count: 5 }, { bucket_key: "42", item_count: 1 }] };
    }
    if (text.includes("FROM users u") && text.includes("FROM v5_wallet_links wl") && text.includes("NOT (lower(COALESCE(u.locale, '')) LIKE CONCAT($3, '%'))")) {
      return {
        rows: [
          { user_id: 3, telegram_id: 8203, locale: "en", last_seen_at: "2026-03-08T10:00:00.000Z", public_name: "e3", prefs_json: {} },
          { user_id: 4, telegram_id: 8204, locale: "en", last_seen_at: "2026-03-08T10:00:00.000Z", public_name: "e4", prefs_json: {} },
          { user_id: 5, telegram_id: 8205, locale: "en", last_seen_at: "2026-03-08T10:00:00.000Z", public_name: "e5", prefs_json: {} }
        ]
      };
    }
    if (text.includes("FROM v5_webapp_experiment_assignments")) {
      return {
        rows: [
          { uid: 3, variant_key: "control", cohort_bucket: 42 },
          { uid: 4, variant_key: "control", cohort_bucket: 42 },
          { uid: 5, variant_key: "control", cohort_bucket: 42 }
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
    fetchImpl: async (_url, options) => {
      const payload = JSON.parse(String(options.body || "{}"));
      sentChatIds.push(Number(payload.chat_id || 0));
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

  const result = await service.dispatchCampaign({
    adminId: 7010,
    dryRun: false,
    reason: "scheduled_window_dispatch",
    dispatchSource: "scheduler",
    campaign: buildCampaign({
      targeting: {
        max_recipients: 2
      }
    })
  });

  const candidateQuery = recordedQueries.find((entry) =>
    entry.sql.includes("FROM users u") &&
    entry.sql.includes("NOT (lower(COALESCE(u.locale, '')) LIKE CONCAT($3, '%'))")
  );
  assert.ok(candidateQuery);
  assert.equal(candidateQuery.params[0], 7);
  assert.equal(candidateQuery.params[2], "tr");
  assert.equal(candidateQuery.params[6], 4);
  assert.equal(result.ok, true);
  assert.deepEqual(sentChatIds, [8203]);
  assert.equal(result.data.selection_summary.query_strategy_summary.applied, true);
  assert.equal(result.data.selection_summary.query_strategy_summary.reason, "query_strategy_locale_and_segment");
  assert.equal(result.data.selection_summary.query_strategy_summary.locale_strategy_reason, "query_strategy_locale_exclusion");
  assert.equal(result.data.selection_summary.query_strategy_summary.segment_strategy_reason, "segment_query_active_window_tight");
  assert.equal(result.data.selection_summary.query_strategy_summary.pool_limit_multiplier, 2);
  assert.equal(result.data.selection_summary.query_strategy_summary.active_within_days_cap, 7);
  assert.equal(result.data.selection_summary.prefilter_summary.reason, "prefilter_shifted_to_query_strategy");
  assert.equal(result.data.selection_summary.prefilter_summary.candidates_before, 3);
  assert.equal(result.data.selection_summary.prefilter_summary.candidates_after, 3);
});

test("live ops chat campaign service tightens scheduler query windows when selection family risk is elevated", async () => {
  const sentChatIds = [];
  const { pool, recordedQueries } = createQueryRecorder((text) => {
    if (text.includes("FROM config_versions") && text.includes("LIMIT 1")) {
      return { rows: [{ version: 10, created_at: "2026-03-08T12:00:00.000Z", created_by: 7001, config_json: buildCampaign() }] };
    }
    if (text.includes("COUNT(*)::int AS sent_total") && text.includes("interval '72 hours'")) {
      return { rows: [{ sent_total: 0, sent_72h: 0, last_sent_at: null, last_segment_key: "", last_dispatch_ref: "" }] };
    }
    if (text.includes("event_key IN ('runtime.scene.ready', 'runtime.scene.failed')")) {
      return {
        rows: [
          {
            ready_24h: 10,
            failed_24h: 0,
            low_end_24h: 1,
            avg_loaded_bundles_24h: 3.2,
            daily_breakdown_7d: [{ day: "2026-03-08", total_count: 10, ready_count: 10, failed_count: 0, low_end_count: 1 }],
            quality_breakdown_24h: [],
            perf_breakdown_24h: []
          }
        ]
      };
    }
    if (text.includes("COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours')::bigint AS raised_24h")) {
      return {
        rows: [
          {
            raised_24h: 2,
            raised_7d: 4,
            telegram_sent_24h: 1,
            telegram_sent_7d: 2,
            effective_cap_delta_24h: 6,
            effective_cap_delta_7d: 12,
            max_effective_cap_delta_7d: 6
          }
        ]
      };
    }
    if (text.includes("FROM admin_audit") && text.includes("action = 'live_ops_campaign_dispatch'") && text.includes("query_strategy_applied_24h")) {
      return {
        rows: [
          {
            dispatches_24h: 4,
            dispatches_7d: 4,
            query_strategy_applied_24h: 4,
            query_strategy_applied_7d: 4,
            prefilter_applied_24h: 0,
            prefilter_applied_7d: 0,
            prefilter_delta_24h: 0,
            prefilter_delta_7d: 0,
            prioritized_focus_matches_24h: 4,
            prioritized_focus_matches_7d: 4,
            selected_focus_matches_24h: 1,
            selected_focus_matches_7d: 1
          }
        ]
      };
    }
    if (text.includes("FROM admin_audit") && text.includes("action = 'live_ops_campaign_dispatch'") && text.includes("ORDER BY created_at DESC") && text.includes("LIMIT 1;")) {
      return {
        rows: [
          {
            created_at: "2026-03-08T12:20:00.000Z",
            payload_json: {
              targeting_selection_summary: {
                guidance_mode: "protective",
                focus_dimension: "locale",
                focus_bucket: "tr",
                query_strategy_summary: {
                  reason: "query_strategy_locale_and_segment",
                  segment_strategy_reason: "segment_query_active_window_tight"
                },
                prefilter_summary: {
                  reason: "prefilter_shifted_to_query_strategy"
                }
              }
            }
          }
        ]
      };
    }
    if (text.includes("FROM admin_audit") && text.includes("dispatch_count") && text.includes("query_strategy_applied_count")) {
      return {
        rows: [
          {
            day: "2026-03-08",
            dispatch_count: 2,
            query_strategy_applied_count: 2,
            prefilter_applied_count: 0,
            prefilter_delta_sum: 0,
            prioritized_focus_matches: 2,
            selected_focus_matches: 1
          },
          {
            day: "2026-03-07",
            dispatch_count: 2,
            query_strategy_applied_count: 2,
            prefilter_applied_count: 0,
            prefilter_delta_sum: 0,
            prioritized_focus_matches: 2,
            selected_focus_matches: 0
          }
        ]
      };
    }
    if (text.includes("FROM admin_audit") && text.includes("targeting_selection_summary,prefilter_summary,reason")) {
      return { rows: [{ bucket_key: "prefilter_shifted_to_query_strategy", item_count: 4 }] };
    }
    if (
      text.includes("FROM admin_audit") &&
      text.includes("targeting_selection_summary,query_strategy_summary,reason") &&
      !text.includes("segment_strategy_reason") &&
      !text.includes("GROUP BY 1, 2")
    ) {
      return { rows: [{ bucket_key: "query_strategy_locale_and_segment", item_count: 4 }] };
    }
    if (
      text.includes("FROM admin_audit") &&
      text.includes("targeting_selection_summary,query_strategy_summary,segment_strategy_reason") &&
      !text.includes("GROUP BY 1, 2")
    ) {
      return { rows: [{ bucket_key: "segment_query_active_window_tight", item_count: 4 }] };
    }
    if (
      text.includes("FROM admin_audit") &&
      text.includes("targeting_selection_summary,query_strategy_summary,reason") &&
      text.includes("GROUP BY 1, 2")
    ) {
      return {
        rows: [
          { day: "2026-03-08", bucket_key: "query_strategy_locale_and_segment", item_count: 2 },
          { day: "2026-03-07", bucket_key: "query_strategy_locale_and_segment", item_count: 2 }
        ]
      };
    }
    if (
      text.includes("FROM admin_audit") &&
      text.includes("targeting_selection_summary,query_strategy_summary,segment_strategy_reason") &&
      text.includes("GROUP BY 1, 2")
    ) {
      return {
        rows: [
          { day: "2026-03-08", bucket_key: "segment_query_active_window_tight", item_count: 2 },
          { day: "2026-03-07", bucket_key: "segment_query_active_window_tight", item_count: 2 }
        ]
      };
    }
    if (text.includes("FROM admin_audit") && text.includes("live_ops_campaign_ops_alert") && text.includes("ORDER BY created_at DESC")) {
      return {
        rows: [
          {
            created_at: "2026-03-08T12:20:00.000Z",
            payload_json: {
              alarm_state: "alert",
              notification_reason: "alert_state",
              telegram_sent: true,
              telegram_sent_at: "2026-03-08T12:20:00.000Z",
              effective_cap_delta: 6
            }
          }
        ]
      };
    }
    if (text.includes("payload_json->>'notification_reason'")) {
      return { rows: [{ bucket_key: "alert_state", item_count: 4 }] };
    }
    if (text.includes("to_char(date_trunc('day', created_at), 'YYYY-MM-DD')")) {
      return {
        rows: [{ day: "2026-03-08", alert_count: 4, telegram_sent_count: 1, effective_cap_delta_sum: 6, effective_cap_delta_max: 6 }]
      };
    }
    if (text.includes("payload_json->>'locale_bucket'")) {
      return { rows: [{ bucket_key: "tr", item_count: 7 }, { bucket_key: "en", item_count: 1 }] };
    }
    if (text.includes("payload_json->>'segment_key'")) {
      return { rows: [{ bucket_key: "wallet_unlinked", item_count: 4 }] };
    }
    if (text.includes("payload_json->>'surface_bucket'")) {
      return { rows: [{ bucket_key: "wallet_panel", item_count: 4 }] };
    }
    if (text.includes("payload_json->>'variant_bucket'")) {
      return { rows: [{ bucket_key: "treatment", item_count: 6 }, { bucket_key: "control", item_count: 2 }] };
    }
    if (text.includes("payload_json->>'cohort_bucket'")) {
      return { rows: [{ bucket_key: "17", item_count: 5 }, { bucket_key: "42", item_count: 1 }] };
    }
    if (text.includes("FROM users u") && text.includes("FROM v5_wallet_links wl") && text.includes("NOT (lower(COALESCE(u.locale, '')) LIKE CONCAT($3, '%'))")) {
      return {
        rows: [
          { user_id: 3, telegram_id: 8203, locale: "en", last_seen_at: "2026-03-08T10:00:00.000Z", public_name: "e3", prefs_json: {} },
          { user_id: 4, telegram_id: 8204, locale: "en", last_seen_at: "2026-03-08T10:00:00.000Z", public_name: "e4", prefs_json: {} },
          { user_id: 5, telegram_id: 8205, locale: "en", last_seen_at: "2026-03-08T10:00:00.000Z", public_name: "e5", prefs_json: {} }
        ]
      };
    }
    if (text.includes("FROM v5_webapp_experiment_assignments")) {
      return {
        rows: [
          { uid: 3, variant_key: "control", cohort_bucket: 42 },
          { uid: 4, variant_key: "control", cohort_bucket: 42 },
          { uid: 5, variant_key: "control", cohort_bucket: 42 }
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
    fetchImpl: async (_url, options) => {
      const payload = JSON.parse(String(options.body || "{}"));
      sentChatIds.push(Number(payload.chat_id || 0));
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

  const result = await service.dispatchCampaign({
    adminId: 7010,
    dryRun: false,
    reason: "scheduled_window_dispatch",
    dispatchSource: "scheduler",
    campaign: buildCampaign({
      targeting: {
        max_recipients: 2
      }
    })
  });

  const candidateQuery = recordedQueries.find((entry) =>
    entry.sql.includes("FROM users u") &&
    entry.sql.includes("NOT (lower(COALESCE(u.locale, '')) LIKE CONCAT($3, '%'))")
  );
  assert.ok(candidateQuery);
  assert.equal(candidateQuery.params[0], 6);
  assert.equal(candidateQuery.params[2], "tr");
  assert.equal(candidateQuery.params[6], 2);
  assert.equal(result.ok, true);
  assert.deepEqual(sentChatIds, [8203]);
  assert.equal(result.data.selection_summary.query_strategy_summary.applied, true);
  assert.equal(result.data.selection_summary.query_strategy_summary.strategy_family, "locale_and_segment");
  assert.equal(result.data.selection_summary.query_strategy_summary.family_risk_state, "watch");
  assert.equal(result.data.selection_summary.query_strategy_summary.family_risk_reason, "query_strategy_family_streak_watch");
  assert.equal(result.data.selection_summary.query_strategy_summary.family_risk_dimension, "query_family");
  assert.equal(result.data.selection_summary.query_strategy_summary.family_risk_bucket, "locale_and_segment");
  assert.equal(result.data.selection_summary.query_strategy_summary.family_risk_match_days, 2);
  assert.equal(result.data.selection_summary.query_strategy_summary.family_risk_weight, 4);
  assert.equal(result.data.selection_summary.query_strategy_summary.family_risk_tightened, true);
  assert.equal(result.data.selection_summary.query_strategy_summary.pool_limit_multiplier, 1);
  assert.equal(result.data.selection_summary.query_strategy_summary.active_within_days_cap, 6);
  const queryAdjustments = result.data.selection_summary.query_strategy_summary.adjustment_rows;
  assert.equal(queryAdjustments.find((row) => row.field_key === "pool_limit_multiplier")?.after_value, 1);
  assert.equal(queryAdjustments.find((row) => row.field_key === "active_within_days_cap")?.delta_value, -1);
  assert.equal(result.data.selection_summary.prefilter_summary.reason, "prefilter_shifted_to_query_strategy");
});

test("live ops chat campaign service narrows mission-idle scheduler query windows before selection", async () => {
  const sentChatIds = [];
  const { pool, recordedQueries } = createQueryRecorder((text) => {
    if (text.includes("FROM config_versions") && text.includes("LIMIT 1")) {
      return { rows: [{ version: 9, created_at: "2026-03-08T12:00:00.000Z", created_by: 7001, config_json: buildCampaign({ targeting: { segment_key: "mission_idle" } }) }] };
    }
    if (text.includes("COUNT(*)::int AS sent_total") && text.includes("interval '72 hours'")) {
      return { rows: [{ sent_total: 0, sent_72h: 0, last_sent_at: null, last_segment_key: "", last_dispatch_ref: "" }] };
    }
    if (text.includes("event_key IN ('runtime.scene.ready', 'runtime.scene.failed')")) {
      return {
        rows: [
          {
            ready_24h: 10,
            failed_24h: 0,
            low_end_24h: 1,
            avg_loaded_bundles_24h: 3.2,
            daily_breakdown_7d: [{ day: "2026-03-08", total_count: 10, ready_count: 10, failed_count: 0, low_end_count: 1 }],
            quality_breakdown_24h: [],
            perf_breakdown_24h: []
          }
        ]
      };
    }
    if (text.includes("COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours')::bigint AS raised_24h")) {
      return {
        rows: [
          {
            raised_24h: 2,
            raised_7d: 4,
            telegram_sent_24h: 1,
            telegram_sent_7d: 2,
            effective_cap_delta_24h: 6,
            effective_cap_delta_7d: 12,
            max_effective_cap_delta_7d: 6
          }
        ]
      };
    }
    if (text.includes("FROM admin_audit") && text.includes("ORDER BY created_at DESC") && text.includes("live_ops_campaign_ops_alert")) {
      return {
        rows: [
          {
            created_at: "2026-03-08T12:20:00.000Z",
            payload_json: {
              alarm_state: "alert",
              notification_reason: "alert_state",
              telegram_sent: true,
              telegram_sent_at: "2026-03-08T12:20:00.000Z",
              effective_cap_delta: 6
            }
          }
        ]
      };
    }
    if (text.includes("payload_json->>'notification_reason'")) {
      return { rows: [{ bucket_key: "alert_state", item_count: 4 }] };
    }
    if (text.includes("to_char(date_trunc('day', created_at), 'YYYY-MM-DD')")) {
      return {
        rows: [{ day: "2026-03-08", alert_count: 4, telegram_sent_count: 1, effective_cap_delta_sum: 6, effective_cap_delta_max: 6 }]
      };
    }
    if (text.includes("payload_json->>'locale_bucket'")) {
      return { rows: [{ bucket_key: "tr", item_count: 7 }, { bucket_key: "en", item_count: 1 }] };
    }
    if (text.includes("payload_json->>'segment_key'")) {
      return { rows: [{ bucket_key: "mission_idle", item_count: 4 }] };
    }
    if (text.includes("payload_json->>'surface_bucket'")) {
      return { rows: [{ bucket_key: "missions_panel", item_count: 4 }] };
    }
    if (text.includes("payload_json->>'variant_bucket'")) {
      return { rows: [{ bucket_key: "treatment", item_count: 6 }, { bucket_key: "control", item_count: 2 }] };
    }
    if (text.includes("payload_json->>'cohort_bucket'")) {
      return { rows: [{ bucket_key: "17", item_count: 5 }, { bucket_key: "42", item_count: 1 }] };
    }
    if (text.includes("WITH mission_windows AS")) {
      return {
        rows: [
          { user_id: 31, telegram_id: 8301, locale: "en", last_seen_at: "2026-03-08T10:00:00.000Z", public_name: "m1", prefs_json: {}, latest_offer_id: 501, active_offer_count: 2, latest_offer_created_at: "2026-03-08T09:00:00.000Z" },
          { user_id: 32, telegram_id: 8302, locale: "en", last_seen_at: "2026-03-08T10:00:00.000Z", public_name: "m2", prefs_json: {}, latest_offer_id: 502, active_offer_count: 2, latest_offer_created_at: "2026-03-08T08:00:00.000Z" },
          { user_id: 33, telegram_id: 8303, locale: "en", last_seen_at: "2026-03-08T10:00:00.000Z", public_name: "m3", prefs_json: {}, latest_offer_id: 503, active_offer_count: 1, latest_offer_created_at: "2026-03-08T07:00:00.000Z" }
        ]
      };
    }
    if (text.includes("FROM v5_webapp_experiment_assignments")) {
      return {
        rows: [
          { uid: 31, variant_key: "control", cohort_bucket: 42 },
          { uid: 32, variant_key: "control", cohort_bucket: 42 },
          { uid: 33, variant_key: "control", cohort_bucket: 42 }
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
    fetchImpl: async (_url, options) => {
      const payload = JSON.parse(String(options.body || "{}"));
      sentChatIds.push(Number(payload.chat_id || 0));
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

  const result = await service.dispatchCampaign({
    adminId: 7010,
    dryRun: false,
    reason: "scheduled_window_dispatch",
    dispatchSource: "scheduler",
    campaign: buildCampaign({
      targeting: {
        segment_key: "mission_idle",
        max_recipients: 2
      },
      surfaces: [{ slot_key: "mission_lane", surface_key: "missions_panel" }]
    })
  });

  const candidateQuery = recordedQueries.find((entry) => entry.sql.includes("WITH mission_windows AS"));
  assert.ok(candidateQuery);
  assert.match(candidateQuery.sql, /mw\.latest_offer_created_at >= now\(\) - make_interval\(days => \$4::int\)/);
  assert.match(candidateQuery.sql, /be\.event_type = \$5/);
  assert.match(candidateQuery.sql, /LIMIT \$8;/);
  assert.equal(candidateQuery.params[0], 7);
  assert.equal(candidateQuery.params[2], "tr");
  assert.equal(candidateQuery.params[3], 3);
  assert.equal(candidateQuery.params[7], 4);
  assert.equal(result.ok, true);
  assert.deepEqual(sentChatIds, [8301]);
  assert.equal(result.data.selection_summary.query_strategy_summary.applied, true);
  assert.equal(result.data.selection_summary.query_strategy_summary.reason, "query_strategy_locale_and_segment");
  assert.equal(result.data.selection_summary.query_strategy_summary.locale_strategy_reason, "query_strategy_locale_exclusion");
  assert.equal(result.data.selection_summary.query_strategy_summary.segment_strategy_reason, "segment_query_offer_window_tight");
  assert.equal(result.data.selection_summary.query_strategy_summary.pool_limit_multiplier, 2);
  assert.equal(result.data.selection_summary.query_strategy_summary.active_within_days_cap, 7);
  assert.equal(result.data.selection_summary.query_strategy_summary.offer_age_days_cap, 3);
  assert.deepEqual(result.data.selection_summary.query_strategy_summary.adjustment_rows, []);
  assert.equal(result.data.selection_summary.prefilter_summary.reason, "prefilter_shifted_to_query_strategy");
});
