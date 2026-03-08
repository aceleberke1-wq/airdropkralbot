"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const contracts = require("../../../packages/shared/src/contracts");
const { registerWebappV2AdminLiveOpsRoutes } = require("../src/routes/webapp/v2/adminLiveOpsRoutes");

function buildCampaign(approvalState = "approved") {
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
      dedupe_hours: 72
    },
    copy: {
      title: { tr: "Wallet hazir", en: "Wallet ready" },
      body: { tr: "Wallet bagla.", en: "Link wallet." },
      note: { tr: "Simdi ac.", en: "Open now." }
    },
    schedule: {
      timezone: "UTC",
      start_at: "2026-03-08T09:00:00.000Z",
      end_at: "2026-03-08T18:00:00.000Z"
    },
    approval: {
      required: true,
      state: approvalState,
      requested_by: approvalState === "not_requested" ? 0 : 7001,
      requested_at: approvalState === "not_requested" ? null : "2026-03-08T10:05:00.000Z",
      approved_by: approvalState === "approved" ? 7001 : 0,
      approved_at: approvalState === "approved" ? "2026-03-08T10:10:00.000Z" : null,
      last_action_by: approvalState === "not_requested" ? 0 : 7001,
      last_action_at: approvalState === "not_requested" ? null : "2026-03-08T10:10:00.000Z",
      note: approvalState
    },
    surfaces: [{ slot_key: "wallet_lane", surface_key: "wallet_panel" }]
  };
}

function buildSnapshot(version, approvalState) {
  return {
    api_version: "v2",
    config_key: "live_ops_chat_campaign_v1",
    version,
    updated_at: "2026-03-08T10:10:00.000Z",
    updated_by: 7001,
    campaign: buildCampaign(approvalState),
    approval_summary: {
      live_dispatch_ready: approvalState === "approved",
      enabled: true,
      status: "ready",
      segment_key: "wallet_unlinked",
      max_recipients: 40,
      dedupe_hours: 72,
      surface_count: 1,
      approval_required: true,
      approval_state: approvalState,
      approval_requested_at: approvalState === "not_requested" ? null : "2026-03-08T10:05:00.000Z",
      approval_requested_by: approvalState === "not_requested" ? 0 : 7001,
      approval_approved_at: approvalState === "approved" ? "2026-03-08T10:10:00.000Z" : null,
      approval_approved_by: approvalState === "approved" ? 7001 : 0,
      schedule_timezone: "UTC",
      schedule_start_at: "2026-03-08T09:00:00.000Z",
      schedule_end_at: "2026-03-08T18:00:00.000Z",
      schedule_state: "open",
      last_saved_at: "2026-03-08T10:10:00.000Z",
      last_dispatch_at: null,
      warnings: approvalState === "approved" ? [] : ["approval_missing"]
    },
    scheduler_summary: {
      ready_for_auto_dispatch: approvalState === "approved",
      schedule_state: "open",
      approval_state: approvalState,
      window_key: "wallet_reconnect:2026-03-08T09:00:00.000Z:2026-03-08T18:00:00.000Z",
      already_dispatched_for_window: false,
      latest_auto_dispatch_at: null,
      latest_auto_dispatch_ref: "",
      latest_auto_dispatch_reason: ""
    },
    version_history: [
      {
        version,
        updated_at: "2026-03-08T10:10:00.000Z",
        updated_by: 7001,
        campaign_key: "wallet_reconnect",
        enabled: true,
        status: "ready",
        segment_key: "wallet_unlinked",
        max_recipients: 40,
        dedupe_hours: 72
      }
    ],
    dispatch_history: [],
    operator_timeline: [
      {
        action: approvalState === "approved" ? "live_ops_campaign_approve" : "live_ops_campaign_request",
        created_at: "2026-03-08T10:10:00.000Z",
        admin_id: 7001,
        campaign_key: "wallet_reconnect",
        campaign_version: version,
        reason: approvalState,
        enabled: true,
        status: "ready",
        approval_state: approvalState,
        schedule_state: "open",
        dispatch_ref: "",
        dry_run: false
      }
    ],
    delivery_summary: {
      sent_24h: 0,
      sent_7d: 0,
      unique_users_7d: 0,
      experiment_key: "webapp_react_v1",
      experiment_assignment_available: true,
      locale_breakdown: [],
      segment_breakdown: [],
      surface_breakdown: [],
      variant_breakdown: [],
      cohort_breakdown: []
    },
    scheduler_skip_summary: {
      skipped_24h: 1,
      skipped_7d: 3,
      latest_skip_at: "2026-03-08T10:11:00.000Z",
      latest_skip_reason: "scene_runtime_alert_blocked",
      alarm_state: "alert",
      alarm_reason: "scene_runtime_alert_blocked_repeated",
      scene_alert_blocked_7d: 3,
      scene_watch_capped_7d: 0,
      daily_breakdown: [{ day: "2026-03-08", skip_count: 1 }],
      reason_breakdown: [{ bucket_key: "scene_runtime_alert_blocked", item_count: 3 }]
    },
    task_summary: {
      artifact_found: true,
      artifact_path: ".runtime-artifacts/liveops/V5_LIVE_OPS_CAMPAIGN_DISPATCH_latest.json",
      artifact_generated_at: "2026-03-08T10:12:00.000Z",
      artifact_age_min: 3,
      ok: true,
      skipped: true,
      reason: "campaign_approval_required",
      dispatch_ref: "",
      dispatch_source: "",
      scene_gate_state: "no_data",
      scene_gate_effect: "open",
      scene_gate_reason: "scene_runtime_no_data",
      scene_gate_recipient_cap: 40,
      window_key: "wallet_reconnect:2026-03-08T09:00:00.000Z:2026-03-08T18:00:00.000Z",
      scheduler_skip_24h: 1,
      scheduler_skip_7d: 3,
      scheduler_skip_alarm_state: "alert",
      scheduler_skip_alarm_reason: "scene_runtime_alert_blocked_repeated"
    },
    latest_dispatch: {
      event_type: "live_ops_campaign_sent",
      sent_total: 0,
      sent_72h: 0,
      last_sent_at: null,
      last_segment_key: "",
      last_dispatch_ref: ""
    }
  };
}

test("v2 admin live ops campaign routes read, save approve and dispatch canonical payloads", async () => {
  const app = Fastify();
  const serviceCalls = [];
  registerWebappV2AdminLiveOpsRoutes(app, {
    pool: {
      async connect() {
        return {
          release() {}
        };
      }
    },
    verifyWebAppAuth(uid) {
      return { ok: true, uid: String(uid || "7001") };
    },
    requireWebAppAdmin: async () => ({ user_id: 7001 }),
    issueWebAppSession: (uid) => ({ uid: String(uid), ts: "2", sig: "next" }),
    contracts,
    service: {
      async getCampaignSnapshot() {
        serviceCalls.push("get");
        return buildSnapshot(3, "not_requested");
      },
      async saveCampaignConfig(input) {
        serviceCalls.push({ save: input });
        return buildSnapshot(4, "not_requested");
      },
      async updateCampaignApproval(input) {
        serviceCalls.push({ approve: input });
        return buildSnapshot(5, "approved");
      },
      async dispatchCampaign(input) {
        serviceCalls.push({ dispatch: input });
        return {
          ok: true,
          data: {
            api_version: "v2",
            campaign_key: "wallet_reconnect",
            version: 5,
            dry_run: true,
            segment_key: "wallet_unlinked",
            attempted: 2,
            sent: 2,
            recorded: 0,
            skipped_disabled: 0,
            dispatch_ref: "wallet_reconnect_ref",
            sample_users: [{ user_id: 41, locale: "en" }],
            generated_at: "2026-03-08T10:15:00.000Z"
          }
        };
      }
    }
  });

  const getRes = await app.inject({
    method: "GET",
    url: "/webapp/api/v2/admin/live-ops/campaign?uid=7001&ts=1&sig=sig"
  });
  assert.equal(getRes.statusCode, 200);
  assert.equal(getRes.json().data.campaign.campaign_key, "wallet_reconnect");
  assert.equal(getRes.json().data.approval_summary.approval_state, "not_requested");
  assert.equal(getRes.json().data.scheduler_skip_summary.skipped_7d, 3);
  assert.equal(getRes.json().data.scheduler_skip_summary.alarm_state, "alert");

  const saveRes = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/admin/live-ops/campaign",
    payload: {
      uid: "7001",
      ts: "1",
      sig: "sig",
      reason: "test_save",
      campaign: buildCampaign("not_requested")
    }
  });
  assert.equal(saveRes.statusCode, 200);
  assert.equal(saveRes.json().data.version, 4);

  const approveRes = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/admin/live-ops/campaign/approval",
    payload: {
      uid: "7001",
      ts: "1",
      sig: "sig",
      approval_action: "approve",
      reason: "approve_now",
      campaign: buildCampaign("pending")
    }
  });
  assert.equal(approveRes.statusCode, 200);
  assert.equal(approveRes.json().data.approval_summary.approval_state, "approved");

  const dispatchRes = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/admin/live-ops/campaign/dispatch",
    payload: {
      uid: "7001",
      ts: "1",
      sig: "sig",
      dry_run: true,
      campaign: buildCampaign("approved")
    }
  });
  assert.equal(dispatchRes.statusCode, 200);
  assert.equal(dispatchRes.json().data.sent, 2);
  assert.equal(serviceCalls.length, 4);
  await app.close();
});

test("v2 admin live ops campaign dispatch returns conflict when service marks schedule blocked", async () => {
  const app = Fastify();
  registerWebappV2AdminLiveOpsRoutes(app, {
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
    service: {
      async dispatchCampaign() {
        return { ok: false, reason: "campaign_schedule_closed", campaign: { campaign_key: "wallet_reconnect" } };
      },
      async getCampaignSnapshot() {
        throw new Error("not_used");
      },
      async saveCampaignConfig() {
        throw new Error("not_used");
      },
      async updateCampaignApproval() {
        throw new Error("not_used");
      }
    }
  });

  const res = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/admin/live-ops/campaign/dispatch",
    payload: {
      uid: "7001",
      ts: "1",
      sig: "sig",
      dry_run: false
    }
  });
  assert.equal(res.statusCode, 409);
  assert.equal(res.json().error, "campaign_schedule_closed");
  await app.close();
});

test("v2 admin live ops campaign approval route validates payload", async () => {
  const app = Fastify();
  registerWebappV2AdminLiveOpsRoutes(app, {
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
    service: {
      async updateCampaignApproval() {
        throw new Error("invalid_approval_action");
      },
      async dispatchCampaign() {
        throw new Error("not_used");
      },
      async getCampaignSnapshot() {
        throw new Error("not_used");
      },
      async saveCampaignConfig() {
        throw new Error("not_used");
      }
    }
  });

  const invalidSchemaRes = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/admin/live-ops/campaign/approval",
    payload: {
      uid: "7001",
      ts: "1",
      sig: "sig",
      approval_action: "request",
      campaign: { campaign_key: "x" }
    }
  });
  assert.equal(invalidSchemaRes.statusCode, 400);
  assert.equal(invalidSchemaRes.json().error, "invalid_live_ops_campaign_approval_payload");

  const invalidActionRes = await app.inject({
    method: "POST",
    url: "/webapp/api/v2/admin/live-ops/campaign/approval",
    payload: {
      uid: "7001",
      ts: "1",
      sig: "sig",
      approval_action: "request"
    }
  });
  assert.equal(invalidActionRes.statusCode, 400);
  assert.equal(invalidActionRes.json().error, "invalid_approval_action");
  await app.close();
});
