"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const contracts = require("../../../packages/shared/src/contracts");
const { registerWebappV2AdminOpsRoutes } = require("../src/routes/webapp/v2/adminOpsRoutes");

function buildKpiSnapshot() {
  return {
    generated_at: "2026-03-08T01:00:00.000Z",
    config: {
      hours_short: 24,
      hours_long: 72,
      trend_days: 7,
      emit_slo: false
    },
    snapshots: {
      h24: {
        generated_at: "2026-03-08T01:00:00.000Z",
        window_hours: 24,
        kpis: {
          arpdau: 1.25
        },
        details: {},
        schema: {}
      },
      h72: {
        generated_at: "2026-03-08T01:00:00.000Z",
        window_hours: 72,
        kpis: {
          arpdau: 1.18
        },
        details: {},
        schema: {}
      }
    },
    weekly: {
      trend_days: 7,
      by_day: [],
      totals: {
        revenue_amount: 15.5,
        payout_total_requests: 4,
        payout_rejected_requests: 1,
        payout_rejected_rate_pct: 25
      },
      monetization: {}
    }
  };
}

function buildLiveOpsSnapshot() {
  return {
    api_version: "v2",
    config_key: "live_ops_chat_campaign_v1",
    version: 7,
    updated_at: "2026-03-08T02:00:00.000Z",
    updated_by: 7001,
    campaign: {
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
        title: { tr: "Hazir", en: "Ready" },
        body: { tr: "Don", en: "Return" },
        note: { tr: "Ac", en: "Open" }
      },
      schedule: {
        timezone: "UTC",
        start_at: "2026-03-08T00:00:00.000Z",
        end_at: "2026-03-08T23:59:59.000Z"
      },
      approval: {
        required: true,
        state: "approved",
        requested_by: 7001,
        requested_at: "2026-03-08T01:30:00.000Z",
        approved_by: 7001,
        approved_at: "2026-03-08T01:40:00.000Z",
        last_action_by: 7001,
        last_action_at: "2026-03-08T01:40:00.000Z",
        note: ""
      },
      surfaces: [{ slot_key: "primary", surface_key: "wallet_panel" }]
    },
    approval_summary: {
      live_dispatch_ready: true,
      enabled: true,
      status: "ready",
      segment_key: "wallet_unlinked",
      max_recipients: 40,
      dedupe_hours: 72,
      surface_count: 1,
      approval_required: true,
      approval_state: "approved",
      approval_requested_at: "2026-03-08T01:30:00.000Z",
      approval_requested_by: 7001,
      approval_approved_at: "2026-03-08T01:40:00.000Z",
      approval_approved_by: 7001,
      schedule_timezone: "UTC",
      schedule_start_at: "2026-03-08T00:00:00.000Z",
      schedule_end_at: "2026-03-08T23:59:59.000Z",
      schedule_state: "open",
      last_saved_at: "2026-03-08T01:30:00.000Z",
      last_dispatch_at: "2026-03-08T02:05:00.000Z",
      warnings: []
    },
    scheduler_summary: {
      ready_for_auto_dispatch: true,
      schedule_state: "open",
      approval_state: "approved",
      scene_gate_state: "watch",
      scene_gate_effect: "capped",
      scene_gate_reason: "scene_runtime_watch_capped",
      scene_gate_recipient_cap: 20,
      recipient_cap_recommendation: {
        configured_recipients: 40,
        scene_gate_recipient_cap: 20,
        recommended_recipient_cap: 12,
        effective_cap_delta: 28,
        pressure_band: "watch",
        reason: "ops_alert_segment_pressure",
        experiment_key: "webapp_react_v1",
        locale_bucket: "tr",
        segment_key: "wallet_unlinked",
        surface_bucket: "wallet_panel",
        variant_bucket: "treatment",
        cohort_bucket: "17",
        segment_match: true,
        surface_match: true
      },
      targeting_guidance: {
        default_mode: "protective",
        guidance_state: "alert",
        guidance_reason: "watch_state_locale_pressure",
        focus_dimension: "locale",
        focus_bucket: "tr",
        focus_matches_target: true,
        focus_share_of_recommended_cap: 0.875,
        focus_suggested_recipient_cap: 10,
        effective_cap_delta_ratio: 0.7,
        mode_rows: [
          { mode_key: "protective", suggested_recipient_cap: 10, effective_cap_delta: 30, delta_vs_recommended: 2, reason_code: "focus_locale_protective" },
          { mode_key: "balanced", suggested_recipient_cap: 12, effective_cap_delta: 28, delta_vs_recommended: 0, reason_code: "recommended_cap" },
          { mode_key: "aggressive", suggested_recipient_cap: 16, effective_cap_delta: 24, delta_vs_recommended: 4, reason_code: "scene_gate_headroom_watch" }
        ]
      },
      window_key: "wallet_reconnect:2026-03-08T00:00:00.000Z:2026-03-08T23:59:59.000Z",
      already_dispatched_for_window: true,
      latest_auto_dispatch_at: "2026-03-08T02:05:00.000Z",
      latest_auto_dispatch_ref: "dispatch_auto_1",
      latest_auto_dispatch_reason: "scheduled_window_dispatch"
    },
    version_history: [],
    dispatch_history: [],
    operator_timeline: [],
    delivery_summary: {
      sent_24h: 12,
      sent_7d: 33,
      unique_users_7d: 28,
      experiment_key: "webapp_react_v1",
      experiment_assignment_available: true,
      daily_breakdown: [
        { day: "2026-03-08", sent_count: 12, unique_users: 10 },
        { day: "2026-03-07", sent_count: 9, unique_users: 8 }
      ],
      locale_breakdown: [{ bucket_key: "tr", item_count: 21 }],
      segment_breakdown: [{ bucket_key: "wallet_unlinked", item_count: 33 }],
      surface_breakdown: [{ bucket_key: "wallet_panel", item_count: 33 }],
      variant_breakdown: [{ bucket_key: "treatment", item_count: 25 }],
      cohort_breakdown: [{ bucket_key: "17", item_count: 6 }]
    },
    scheduler_skip_summary: {
      skipped_24h: 2,
      skipped_7d: 5,
      latest_skip_at: "2026-03-08T04:00:00.000Z",
      latest_skip_reason: "scene_runtime_watch_capped",
      alarm_state: "watch",
      alarm_reason: "scene_runtime_watch_capped_repeated",
      scene_alert_blocked_7d: 0,
      scene_watch_capped_7d: 4,
      daily_breakdown: [
        { day: "2026-03-08", skip_count: 2 },
        { day: "2026-03-07", skip_count: 3 }
      ],
      reason_breakdown: [
        { bucket_key: "scene_runtime_watch_capped", item_count: 4 },
        { bucket_key: "already_dispatched_for_window", item_count: 1 }
      ]
    },
    ops_alert_summary: {
      artifact_found: true,
      artifact_path: ".runtime-artifacts/liveops/V5_LIVE_OPS_OPS_ALERT_latest.json",
      artifact_generated_at: "2026-03-08T04:05:00.000Z",
      artifact_age_min: 6,
      alarm_state: "watch",
      should_notify: false,
      notification_reason: "scene_runtime_watch_capped_repeated",
      fingerprint: "watch|scene_runtime_watch_capped_repeated|2026-03-08T04:05:00.000Z",
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
      selection_latest_query_strategy_family: "locale_and_segment",
      selection_latest_segment_strategy_family: "active_window",
      selection_top_query_strategy_family: "locale_and_segment",
      selection_top_segment_strategy_family: "active_window",
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
      telegram_sent: false,
      telegram_reason: "watch_band_no_notify",
      telegram_sent_at: null
    },
    ops_alert_trend_summary: {
      raised_24h: 2,
      raised_7d: 4,
      telegram_sent_24h: 0,
      telegram_sent_7d: 1,
      effective_cap_delta_24h: 28,
      effective_cap_delta_7d: 56,
      experiment_key: "webapp_react_v1",
      latest_alert_at: "2026-03-08T04:05:00.000Z",
      latest_alarm_state: "watch",
      latest_notification_reason: "scene_runtime_watch_capped_repeated",
      latest_telegram_sent_at: "2026-03-07T03:05:00.000Z",
      latest_effective_cap_delta: 28,
      max_effective_cap_delta_7d: 28,
      daily_breakdown: [
        { day: "2026-03-08", alert_count: 2, telegram_sent_count: 0, effective_cap_delta_sum: 28, effective_cap_delta_max: 28 },
        { day: "2026-03-07", alert_count: 2, telegram_sent_count: 1, effective_cap_delta_sum: 28, effective_cap_delta_max: 20 }
      ],
      reason_breakdown: [{ bucket_key: "scene_runtime_watch_capped_repeated", item_count: 4 }],
      locale_breakdown: [{ bucket_key: "tr", item_count: 3 }],
      segment_breakdown: [{ bucket_key: "wallet_unlinked", item_count: 4 }],
      surface_breakdown: [{ bucket_key: "wallet_panel", item_count: 4 }],
      variant_breakdown: [{ bucket_key: "treatment", item_count: 3 }],
      cohort_breakdown: [{ bucket_key: "17", item_count: 2 }]
    },
    scene_runtime_summary: {
      ready_24h: 18,
      failed_24h: 2,
      total_24h: 20,
      low_end_24h: 5,
      ready_rate_24h: 0.9,
      failure_rate_24h: 0.1,
      low_end_share_24h: 0.25,
      avg_loaded_bundles_24h: 3.5,
      health_band_24h: "yellow",
      ready_rate_7d_avg: 0.88,
      failure_rate_7d_avg: 0.12,
      low_end_share_7d_avg: 0.29,
      trend_direction_7d: "stable",
      trend_delta_ready_rate_7d: 0.01,
      alarm_state_7d: "watch",
      alarm_reasons_7d: ["latest_watch_band"],
      band_breakdown_7d: [{ bucket_key: "yellow", item_count: 4 }],
      quality_breakdown_24h: [{ bucket_key: "medium", item_count: 14 }],
      perf_breakdown_24h: [{ bucket_key: "mid", item_count: 14 }],
      daily_breakdown_7d: [
        {
          day: "2026-03-08",
          total_count: 5,
          ready_count: 4,
          failed_count: 1,
          low_end_count: 2,
          ready_rate: 0.8,
          failure_rate: 0.2,
          low_end_share: 0.4,
          health_band: "yellow"
        }
      ],
      worst_day_7d: {
        day: "2026-03-08",
        total_count: 5,
        ready_count: 4,
        failed_count: 1,
        low_end_count: 2,
        ready_rate: 0.8,
        failure_rate: 0.2,
        low_end_share: 0.4,
        health_band: "yellow"
      }
    },
    task_summary: {
      artifact_found: true,
      artifact_path: ".runtime-artifacts/liveops/V5_LIVE_OPS_CAMPAIGN_DISPATCH_latest.json",
      artifact_generated_at: "2026-03-08T04:06:00.000Z",
      artifact_age_min: 5,
      ok: true,
      skipped: false,
      reason: "scheduled_window_dispatch",
      dispatch_ref: "dispatch_auto_1",
      dispatch_source: "scheduler",
      scene_gate_state: "watch",
      scene_gate_effect: "capped",
      scene_gate_reason: "scene_runtime_watch_capped",
      scene_gate_recipient_cap: 10,
      recommended_recipient_cap: 12,
      effective_cap_delta: 28,
      recommendation_pressure_band: "watch",
      recommendation_reason: "ops_alert_segment_pressure",
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
        prioritized_top_cohort_matches: 4,
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
          strategy_family: "locale_and_segment",
          locale_strategy_family: "locale",
          segment_strategy_family: "active_window",
          family_risk_state: "alert",
          family_risk_reason: "query_strategy_family_streak_alert",
          family_risk_dimension: "query_family",
          family_risk_bucket: "locale_and_segment",
          family_risk_match_days: 4,
          family_risk_weight: 5,
          family_risk_tightened: true,
          pool_limit_multiplier: 2,
          active_within_days_cap: 7,
          inactive_hours_floor: 0,
          max_age_days_cap: 0,
          offer_age_days_cap: 0,
          adjustment_rows: [
            {
              field_key: "pool_limit_multiplier",
              before_value: 4,
              after_value: 2,
              delta_value: -2,
              direction_key: "decrease",
              reason_code: "query_strategy_family_streak_alert"
            },
            {
              field_key: "active_within_days_cap",
              before_value: 10,
              after_value: 7,
              delta_value: -3,
              direction_key: "decrease",
              reason_code: "query_strategy_family_streak_alert"
            }
          ]
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
      window_key: "wallet_reconnect:2026-03-08T00:00:00.000Z:2026-03-08T23:59:59.000Z",
      scheduler_skip_24h: 2,
      scheduler_skip_7d: 5,
      scheduler_skip_alarm_state: "watch",
      scheduler_skip_alarm_reason: "scene_runtime_watch_capped_repeated"
    },
    selection_trend_summary: {
      dispatches_24h: 2,
      dispatches_7d: 5,
      query_strategy_applied_24h: 2,
      query_strategy_applied_7d: 5,
      query_adjustment_applied_24h: 2,
      query_adjustment_applied_7d: 4,
      query_adjustment_total_delta_24h: 11,
      query_adjustment_total_delta_7d: 19,
      prefilter_applied_24h: 2,
      prefilter_applied_7d: 4,
      prefilter_delta_24h: 7,
      prefilter_delta_7d: 15,
      prioritized_focus_matches_24h: 5,
      prioritized_focus_matches_7d: 13,
      selected_focus_matches_24h: 0,
      selected_focus_matches_7d: 1,
      latest_selection_at: "2026-03-08T02:05:00.000Z",
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
      latest_family_risk_state: "watch",
      latest_family_risk_reason: "query_strategy_family_streak_watch",
      latest_family_risk_dimension: "query_family",
      latest_family_risk_bucket: "locale_and_segment",
      latest_family_risk_score: 4,
      daily_breakdown: [
        { day: "2026-03-08", dispatch_count: 2, query_strategy_applied_count: 2, prefilter_applied_count: 2, prefilter_delta_sum: 7, prioritized_focus_matches: 5, selected_focus_matches: 0 },
        { day: "2026-03-07", dispatch_count: 3, query_strategy_applied_count: 3, prefilter_applied_count: 2, prefilter_delta_sum: 8, prioritized_focus_matches: 8, selected_focus_matches: 1 }
      ],
      query_adjustment_daily_breakdown: [
        { day: "2026-03-08", adjustment_count: 2, total_delta_sum: 11, max_delta_value: 7 },
        { day: "2026-03-07", adjustment_count: 2, total_delta_sum: 8, max_delta_value: 5 }
      ],
      query_strategy_family_daily_breakdown: [
        { day: "2026-03-08", bucket_key: "locale_and_segment", item_count: 2 },
        { day: "2026-03-07", bucket_key: "locale_and_segment", item_count: 3 }
      ],
      query_adjustment_query_family_daily_breakdown: [
        { day: "2026-03-08", bucket_key: "locale_and_segment", item_count: 11 },
        { day: "2026-03-07", bucket_key: "locale_and_segment", item_count: 8 }
      ],
      segment_strategy_family_daily_breakdown: [
        { day: "2026-03-08", bucket_key: "active_window", item_count: 2 },
        { day: "2026-03-07", bucket_key: "active_window", item_count: 2 }
      ],
      query_adjustment_segment_family_daily_breakdown: [
        { day: "2026-03-08", bucket_key: "active_window", item_count: 11 },
        { day: "2026-03-07", bucket_key: "active_window", item_count: 8 }
      ],
      query_adjustment_field_family_daily_breakdown: [
        { day: "2026-03-08", bucket_key: "activity_window", item_count: 12 },
        { day: "2026-03-07", bucket_key: "pool_limit", item_count: 7 }
      ],
      family_risk_daily_breakdown: [
        { day: "2026-03-08", risk_state: "watch", risk_reason: "query_strategy_family_streak_watch", risk_dimension: "query_family", risk_bucket: "locale_and_segment", risk_score: 4, query_family: "locale_and_segment", segment_family: "active_window", query_match_days: 2, segment_match_days: 2, query_weight: 4, segment_weight: 3 },
        { day: "2026-03-07", risk_state: "watch", risk_reason: "query_strategy_family_streak_watch", risk_dimension: "query_family", risk_bucket: "locale_and_segment", risk_score: 3, query_family: "locale_and_segment", segment_family: "active_window", query_match_days: 1, segment_match_days: 1, query_weight: 3, segment_weight: 2 }
      ],
      query_strategy_reason_breakdown: [{ bucket_key: "query_strategy_locale_and_segment", item_count: 5 }],
      query_strategy_family_breakdown: [{ bucket_key: "locale_and_segment", item_count: 5 }],
      query_adjustment_field_breakdown: [
        { bucket_key: "active_within_days_cap", item_count: 12 },
        { bucket_key: "pool_limit_multiplier", item_count: 7 }
      ],
      query_adjustment_field_family_breakdown: [
        { bucket_key: "activity_window", item_count: 12 },
        { bucket_key: "pool_limit", item_count: 7 }
      ],
      query_adjustment_reason_breakdown: [{ bucket_key: "selection_family_risk_tightened", item_count: 19 }],
      query_adjustment_query_family_breakdown: [{ bucket_key: "locale_and_segment", item_count: 19 }],
      segment_strategy_reason_breakdown: [{ bucket_key: "segment_query_active_window_tight", item_count: 4 }],
      segment_strategy_family_breakdown: [{ bucket_key: "active_window", item_count: 4 }],
      query_adjustment_segment_family_breakdown: [{ bucket_key: "active_window", item_count: 19 }],
      family_risk_band_breakdown: [{ bucket_key: "watch", item_count: 2 }],
      prefilter_reason_breakdown: [{ bucket_key: "prefilter_applied", item_count: 4 }]
    },
    latest_dispatch: {
      event_type: "live_ops_campaign_sent",
      sent_total: 33,
      sent_72h: 20,
      last_sent_at: "2026-03-08T02:05:00.000Z",
      last_segment_key: "wallet_unlinked",
      last_dispatch_ref: "dispatch_manual_1"
    }
  };
}

function createTestApp(overrides = {}) {
  const app = Fastify();
  registerWebappV2AdminOpsRoutes(app, {
    pool: {
      async connect() {
        return {
          release() {}
        };
      }
    },
    verifyWebAppAuth: () => ({ ok: true, uid: "7001" }),
    requireWebAppAdmin: async () => ({ user_id: 7001 }),
    issueWebAppSession: (uid) => ({ uid: String(uid), ts: "2", sig: "next" }),
    contracts,
    service: overrides.service,
    liveOpsService: overrides.liveOpsService,
    logger: {
      warn() {}
    }
  });
  return app;
}

test("v2 admin ops kpi latest includes live ops campaign breakdowns", async () => {
  const app = createTestApp({
    service: {
      async getLatestBundle() {
        return {
          bundle: buildKpiSnapshot(),
          source_file: "bundle.json",
          markdown_file: "bundle.md",
          updated_at: "2026-03-08T02:10:00.000Z"
        };
      },
      async getWebappExperimentSummary() {
        return {
          available: true,
          experiment_key: "webapp_react_v1",
          generated_at: "2026-03-08T02:10:00.000Z",
          variants: {
            control: {
              assigned_users: 10,
              active_users_24h: 5,
              active_users_7d: 8,
              sessions_24h: 4,
              events_24h: 18,
              avg_events_per_user_24h: 3.6,
              avg_events_per_session_24h: 4.5
            },
            treatment: {
              assigned_users: 11,
              active_users_24h: 7,
              active_users_7d: 9,
              sessions_24h: 6,
              events_24h: 22,
              avg_events_per_user_24h: 3.1429,
              avg_events_per_session_24h: 3.6667
            }
          }
        };
      }
    },
    liveOpsService: {
      async getCampaignSnapshot() {
        return buildLiveOpsSnapshot();
      }
    }
  });

  const res = await app.inject({
    method: "GET",
    url: "/webapp/api/v2/admin/ops/kpi/latest?uid=7001&ts=1&sig=validsignature"
  });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.success, true);
  assert.equal(body.data.live_ops_campaign.campaign_key, "wallet_reconnect");
  assert.equal(body.data.live_ops_campaign.sent_7d, 33);
  assert.equal(body.data.live_ops_campaign.variant_breakdown[0].bucket_key, "treatment");
  assert.equal(body.data.live_ops_campaign.segment_breakdown[0].bucket_key, "wallet_unlinked");
  assert.equal(body.data.live_ops_campaign.daily_breakdown[0].day, "2026-03-08");
  assert.equal(body.data.live_ops_campaign.scheduler_skip.skipped_7d, 5);
  assert.equal(body.data.live_ops_campaign.scheduler_skip.reason_breakdown[0].bucket_key, "scene_runtime_watch_capped");
  assert.equal(body.data.live_ops_campaign.scheduler_skip.alarm_state, "watch");
  assert.equal(body.data.live_ops_campaign.scheduler_skip.scene_watch_capped_7d, 4);
  assert.equal(body.data.live_ops_campaign.ops_alert.alarm_state, "watch");
  assert.equal(body.data.live_ops_campaign.ops_alert.telegram_sent, false);
  assert.equal(body.data.live_ops_campaign.ops_alert.selection_family_escalation_band, "alert");
  assert.equal(body.data.live_ops_campaign.ops_alert.selection_family_escalation_bucket, "locale_and_segment");
  assert.equal(body.data.live_ops_campaign.ops_alert.selection_field_family_weight, 0);
  assert.equal(body.data.live_ops_campaign.ops_alert.selection_family_daily_weight, 2);
  assert.equal(body.data.live_ops_campaign.ops_alert.selection_query_family_match_days, 4);
  assert.equal(body.data.live_ops_campaign.ops_alert.selection_latest_query_strategy_family, "locale_and_segment");
  assert.equal(body.data.live_ops_campaign.ops_alert.selection_top_segment_strategy_family, "active_window");
  assert.equal(body.data.live_ops_campaign.ops_alert.selection_query_adjustment_applied, true);
  assert.equal(body.data.live_ops_campaign.ops_alert.selection_query_adjustment_count, 2);
  assert.equal(body.data.live_ops_campaign.ops_alert.selection_query_adjustment_total_delta, 9);
  assert.equal(body.data.live_ops_campaign.ops_alert.selection_query_adjustment_top_field, "active_within_days_cap");
  assert.equal(body.data.live_ops_campaign.ops_alert.selection_query_adjustment_escalation_band, "alert");
  assert.equal(body.data.live_ops_campaign.ops_alert.selection_query_adjustment_escalation_reason, "watch_state_query_adjustment_pressure");
  assert.equal(body.data.live_ops_campaign.ops_alert.selection_query_adjustment_escalation_field, "active_within_days_cap");
  assert.equal(body.data.live_ops_campaign.ops_alert.selection_query_adjustment_escalation_score, 11);
  assert.equal(body.data.live_ops_campaign.ops_alert.selection_query_adjustment_field_family, "activity_window");
  assert.equal(body.data.live_ops_campaign.ops_alert.selection_query_adjustment_field_family_weight, 3);
  assert.equal(body.data.live_ops_campaign.ops_alert_trend.raised_7d, 4);
  assert.equal(body.data.live_ops_campaign.ops_alert_trend.experiment_key, "webapp_react_v1");
  assert.equal(body.data.live_ops_campaign.ops_alert_trend.effective_cap_delta_24h, 28);
  assert.equal(body.data.live_ops_campaign.ops_alert_trend.effective_cap_delta_7d, 56);
  assert.equal(body.data.live_ops_campaign.ops_alert_trend.max_effective_cap_delta_7d, 28);
  assert.equal(body.data.live_ops_campaign.ops_alert_trend.daily_breakdown[0].effective_cap_delta_sum, 28);
  assert.equal(body.data.live_ops_campaign.ops_alert_trend.reason_breakdown[0].bucket_key, "scene_runtime_watch_capped_repeated");
  assert.equal(body.data.live_ops_campaign.ops_alert_trend.surface_breakdown[0].bucket_key, "wallet_panel");
  assert.equal(body.data.live_ops_campaign.recipient_cap_recommendation.recommended_recipient_cap, 12);
  assert.equal(body.data.live_ops_campaign.recipient_cap_recommendation.effective_cap_delta, 28);
  assert.equal(body.data.live_ops_campaign.recipient_cap_recommendation.reason, "ops_alert_segment_pressure");
  assert.equal(body.data.live_ops_campaign.targeting_guidance.default_mode, "protective");
  assert.equal(body.data.live_ops_campaign.targeting_guidance.mode_rows[0].suggested_recipient_cap, 10);
  assert.equal(body.data.live_ops_campaign.selection_summary.guidance_mode, "protective");
  assert.equal(body.data.live_ops_campaign.selection_summary.selected_candidates, 4);
  assert.equal(body.data.live_ops_campaign.selection_summary.selected_top_locale_matches, 0);
  assert.equal(body.data.live_ops_campaign.selection_summary.query_strategy_summary.applied, true);
  assert.equal(body.data.live_ops_campaign.selection_summary.query_strategy_summary.strategy_family, "locale_and_segment");
  assert.equal(body.data.live_ops_campaign.selection_summary.query_strategy_summary.family_risk_state, "alert");
  assert.equal(body.data.live_ops_campaign.selection_summary.query_strategy_summary.family_risk_reason, "query_strategy_family_streak_alert");
  assert.equal(body.data.live_ops_campaign.selection_summary.query_strategy_summary.family_risk_dimension, "query_family");
  assert.equal(body.data.live_ops_campaign.selection_summary.query_strategy_summary.family_risk_bucket, "locale_and_segment");
  assert.equal(body.data.live_ops_campaign.selection_summary.query_strategy_summary.family_risk_match_days, 4);
  assert.equal(body.data.live_ops_campaign.selection_summary.query_strategy_summary.family_risk_weight, 5);
  assert.equal(body.data.live_ops_campaign.selection_summary.query_strategy_summary.family_risk_tightened, true);
  assert.equal(body.data.live_ops_campaign.selection_summary.query_strategy_summary.pool_limit_multiplier, 2);
  assert.equal(body.data.live_ops_campaign.selection_summary.query_strategy_summary.active_within_days_cap, 7);
  assert.equal(body.data.live_ops_campaign.selection_summary.query_strategy_summary.adjustment_rows[0].field_key, "pool_limit_multiplier");
  assert.equal(body.data.live_ops_campaign.selection_summary.query_strategy_summary.adjustment_rows[0].after_value, 2);
  assert.equal(body.data.live_ops_campaign.selection_summary.query_strategy_summary.adjustment_rows[1].field_key, "active_within_days_cap");
  assert.equal(body.data.live_ops_campaign.selection_summary.query_strategy_summary.adjustment_rows[1].delta_value, -3);
  assert.equal(body.data.live_ops_campaign.selection_summary.prefilter_summary.applied, true);
  assert.equal(body.data.live_ops_campaign.selection_summary.prefilter_summary.candidates_after, 5);
  assert.equal(body.data.live_ops_campaign.selection_trend.dispatches_7d, 5);
  assert.equal(body.data.live_ops_campaign.selection_trend.query_strategy_applied_7d, 5);
  assert.equal(body.data.live_ops_campaign.selection_trend.query_adjustment_applied_24h, 2);
  assert.equal(body.data.live_ops_campaign.selection_trend.query_adjustment_applied_7d, 4);
  assert.equal(body.data.live_ops_campaign.selection_trend.query_adjustment_total_delta_24h, 11);
  assert.equal(body.data.live_ops_campaign.selection_trend.query_adjustment_total_delta_7d, 19);
  assert.equal(body.data.live_ops_campaign.selection_trend.prefilter_applied_7d, 4);
  assert.equal(body.data.live_ops_campaign.selection_trend.prefilter_delta_7d, 15);
  assert.equal(body.data.live_ops_campaign.selection_trend.daily_breakdown[0].query_strategy_applied_count, 2);
  assert.equal(body.data.live_ops_campaign.selection_trend.daily_breakdown[0].prefilter_delta_sum, 7);
  assert.equal(body.data.live_ops_campaign.selection_trend.query_adjustment_daily_breakdown[0].adjustment_count, 2);
  assert.equal(body.data.live_ops_campaign.selection_trend.query_adjustment_daily_breakdown[0].total_delta_sum, 11);
  assert.equal(body.data.live_ops_campaign.selection_trend.query_strategy_reason_breakdown[0].bucket_key, "query_strategy_locale_and_segment");
  assert.equal(body.data.live_ops_campaign.selection_trend.query_adjustment_reason_breakdown[0].bucket_key, "selection_family_risk_tightened");
  assert.equal(body.data.live_ops_campaign.selection_trend.segment_strategy_reason_breakdown[0].bucket_key, "segment_query_active_window_tight");
  assert.equal(body.data.live_ops_campaign.selection_trend.query_adjustment_field_breakdown[0].bucket_key, "active_within_days_cap");
  assert.equal(body.data.live_ops_campaign.selection_trend.prefilter_reason_breakdown[0].bucket_key, "prefilter_applied");
  assert.equal(body.data.live_ops_campaign.scene_gate_effect, "capped");
  assert.equal(body.data.live_ops_campaign.scene_runtime.health_band_24h, "yellow");
  assert.equal(body.data.live_ops_campaign.scene_runtime.alarm_state_7d, "watch");
  await app.close();
});

test("v2 admin ops kpi run includes live ops campaign summary", async () => {
  const app = createTestApp({
    service: {
      async runBundle() {
        return {
          run_ref: "kpi_run_1",
          status: "success",
          duration_ms: 1200,
          started_at: "2026-03-08T02:00:00.000Z",
          finished_at: "2026-03-08T02:00:01.200Z",
          stdout: "ok",
          stderr: "",
          exit_code: 0,
          signal: "",
          snapshot: buildKpiSnapshot()
        };
      },
      async getWebappExperimentSummary() {
        return {
          available: true,
          experiment_key: "webapp_react_v1",
          generated_at: "2026-03-08T02:10:00.000Z",
          variants: {
            control: {
              assigned_users: 10,
              active_users_24h: 5,
              active_users_7d: 8,
              sessions_24h: 4,
              events_24h: 18,
              avg_events_per_user_24h: 3.6,
              avg_events_per_session_24h: 4.5
            },
            treatment: {
              assigned_users: 11,
              active_users_24h: 7,
              active_users_7d: 9,
              sessions_24h: 6,
              events_24h: 22,
              avg_events_per_user_24h: 3.1429,
              avg_events_per_session_24h: 3.6667
            }
          }
        };
      }
    },
    liveOpsService: {
      async getCampaignSnapshot() {
        return buildLiveOpsSnapshot();
      }
    }
  });

  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/admin/ops/kpi/run",
    payload: {
      uid: "7001",
      ts: "1",
      sig: "validsignature",
      hours_short: 24,
      hours_long: 72,
      trend_days: 7,
      emit_slo: false
    }
  });

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.success, true);
  assert.equal(body.data.live_ops_campaign.ready_for_auto_dispatch, true);
  assert.equal(body.data.live_ops_campaign.scene_gate_state, "watch");
  assert.equal(body.data.live_ops_campaign.latest_auto_dispatch_ref, "dispatch_auto_1");
  assert.equal(body.data.live_ops_campaign.locale_breakdown[0].bucket_key, "tr");
  assert.equal(body.data.live_ops_campaign.daily_breakdown[1].sent_count, 9);
  assert.equal(body.data.live_ops_campaign.scheduler_skip.latest_skip_reason, "scene_runtime_watch_capped");
  assert.equal(body.data.live_ops_campaign.scheduler_skip.alarm_reason, "scene_runtime_watch_capped_repeated");
  assert.equal(body.data.live_ops_campaign.ops_alert.notification_reason, "scene_runtime_watch_capped_repeated");
  assert.equal(body.data.live_ops_campaign.targeting_guidance.guidance_state, "alert");
  assert.equal(body.data.live_ops_campaign.selection_summary.focus_dimension, "locale");
  assert.equal(body.data.live_ops_campaign.selection_summary.prioritized_top_variant_matches, 6);
  assert.equal(body.data.live_ops_campaign.selection_summary.query_strategy_summary.reason, "query_strategy_locale_and_segment");
  assert.equal(body.data.live_ops_campaign.selection_summary.query_strategy_summary.segment_strategy_reason, "segment_query_active_window_tight");
  assert.equal(body.data.live_ops_campaign.selection_trend.latest_query_strategy_reason, "query_strategy_locale_and_segment");
  assert.equal(body.data.live_ops_campaign.selection_trend.latest_query_strategy_family, "locale_and_segment");
  assert.equal(body.data.live_ops_campaign.selection_trend.latest_segment_strategy_reason, "segment_query_active_window_tight");
  assert.equal(body.data.live_ops_campaign.selection_trend.latest_segment_strategy_family, "active_window");
  assert.equal(body.data.live_ops_campaign.selection_trend.latest_query_adjustment_field, "active_within_days_cap");
  assert.equal(body.data.live_ops_campaign.selection_trend.latest_query_adjustment_field_family, "activity_window");
  assert.equal(body.data.live_ops_campaign.selection_trend.latest_query_adjustment_reason, "selection_family_risk_tightened");
  assert.equal(body.data.live_ops_campaign.selection_trend.latest_query_adjustment_total_delta, 7);
  assert.equal(body.data.live_ops_campaign.selection_trend.latest_family_risk_state, "watch");
  assert.equal(body.data.live_ops_campaign.selection_trend.latest_family_risk_reason, "query_strategy_family_streak_watch");
  assert.equal(body.data.live_ops_campaign.selection_trend.latest_family_risk_bucket, "locale_and_segment");
  assert.equal(body.data.live_ops_campaign.selection_trend.latest_family_risk_score, 4);
  assert.equal(body.data.live_ops_campaign.selection_trend.query_strategy_family_breakdown[0].bucket_key, "locale_and_segment");
  assert.equal(body.data.live_ops_campaign.selection_trend.query_strategy_family_daily_breakdown[0].bucket_key, "locale_and_segment");
  assert.equal(body.data.live_ops_campaign.selection_trend.query_adjustment_field_family_breakdown[0].bucket_key, "activity_window");
  assert.equal(body.data.live_ops_campaign.selection_trend.query_adjustment_query_family_breakdown[0].bucket_key, "locale_and_segment");
  assert.equal(body.data.live_ops_campaign.selection_trend.query_adjustment_query_family_daily_breakdown[0].bucket_key, "locale_and_segment");
  assert.equal(body.data.live_ops_campaign.selection_trend.query_adjustment_field_family_daily_breakdown[0].bucket_key, "activity_window");
  assert.equal(body.data.live_ops_campaign.selection_trend.segment_strategy_family_breakdown[0].bucket_key, "active_window");
  assert.equal(body.data.live_ops_campaign.selection_trend.segment_strategy_family_daily_breakdown[0].bucket_key, "active_window");
  assert.equal(body.data.live_ops_campaign.selection_trend.query_adjustment_segment_family_breakdown[0].bucket_key, "active_window");
  assert.equal(body.data.live_ops_campaign.selection_trend.query_adjustment_segment_family_daily_breakdown[0].bucket_key, "active_window");
  assert.equal(body.data.live_ops_campaign.selection_trend.family_risk_daily_breakdown[0].risk_state, "watch");
  assert.equal(body.data.live_ops_campaign.selection_trend.family_risk_daily_breakdown[0].risk_score, 4);
  assert.equal(body.data.live_ops_campaign.selection_trend.family_risk_band_breakdown[0].bucket_key, "watch");
  assert.equal(body.data.live_ops_campaign.selection_summary.prefilter_summary.reason, "prefilter_applied");
  assert.equal(body.data.live_ops_campaign.selection_trend.latest_prefilter_reason, "prefilter_applied");
  assert.equal(body.data.live_ops_campaign.selection_trend.latest_focus_bucket, "tr");
  assert.equal(body.data.live_ops_campaign.ops_alert_trend.telegram_sent_7d, 1);
  assert.equal(body.data.live_ops_campaign.ops_alert_trend.variant_breakdown[0].bucket_key, "treatment");
  assert.equal(body.data.live_ops_campaign.scene_runtime.trend_direction_7d, "stable");
  await app.close();
});
