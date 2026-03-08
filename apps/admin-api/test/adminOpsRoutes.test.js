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
      daily_breakdown: [
        { day: "2026-03-08", skip_count: 2 },
        { day: "2026-03-07", skip_count: 3 }
      ],
      reason_breakdown: [
        { bucket_key: "scene_runtime_watch_capped", item_count: 4 },
        { bucket_key: "already_dispatched_for_window", item_count: 1 }
      ]
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
  assert.equal(body.data.live_ops_campaign.scene_runtime.trend_direction_7d, "stable");
  await app.close();
});
