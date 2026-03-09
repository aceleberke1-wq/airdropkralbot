const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function loadModule() {
  const target = pathToFileURL(path.join(process.cwd(), "scripts", "v5_live_ops_ops_alert.mjs")).href;
  return import(target);
}

test("evaluateOpsAlert notifies on alert state and dedupes repeated fingerprint", async () => {
  const mod = await loadModule();
  const dispatchArtifact = {
    scheduler_skip_summary: {
      alarm_state: "alert",
      alarm_reason: "scene_runtime_alert_blocked_repeated",
      skipped_24h: 2,
      skipped_7d: 4,
      latest_skip_reason: "scene_runtime_alert_blocked",
      latest_skip_at: "2026-03-08T15:00:00.000Z"
    }
  };

  const first = mod.evaluateOpsAlert(dispatchArtifact, null, {
    now: new Date("2026-03-08T15:10:00.000Z"),
    cooldownMinutes: 180
  });
  assert.equal(first.should_notify, true);
  assert.equal(first.notification_reason, "alert_state");

  const second = mod.evaluateOpsAlert(
    dispatchArtifact,
    {
      evaluation: { fingerprint: first.fingerprint },
      telegram: { sent_at: "2026-03-08T15:05:00.000Z" }
    },
    {
      now: new Date("2026-03-08T15:10:00.000Z"),
      cooldownMinutes: 180
    }
  );
  assert.equal(second.should_notify, false);
  assert.equal(second.notification_reason, "cooldown_active");
});

test("evaluateOpsAlert escalates watch state when recipient cap pressure is alert", async () => {
  const mod = await loadModule();
  const result = mod.evaluateOpsAlert(
    {
      scheduler_skip_summary: {
        alarm_state: "watch",
        alarm_reason: "scene_runtime_watch_capped_repeated",
        skipped_24h: 1,
        skipped_7d: 3,
        latest_skip_reason: "scene_runtime_watch_capped",
        latest_skip_at: "2026-03-08T15:00:00.000Z"
      },
      scheduler_summary: {
        recipient_cap_recommendation: {
          pressure_band: "alert",
          recommended_recipient_cap: 8,
          effective_cap_delta: 32,
          reason: "ops_alert_segment_pressure"
        }
      },
      pressure_focus_summary: {
        pressure_band: "alert",
        warning_rows: [
          {
            dimension: "segment",
            bucket_key: "wallet_unlinked",
            item_count: 4,
            matches_target: true
          }
        ],
        locale_cap_split: [
          {
            bucket_key: "tr",
            item_count: 3,
            suggested_recipient_cap: 6
          }
        ],
        variant_cap_split: [
          {
            bucket_key: "treatment",
            item_count: 3,
            suggested_recipient_cap: 5
          }
        ],
        cohort_cap_split: [
          {
            bucket_key: "17",
            item_count: 2,
            suggested_recipient_cap: 4
          }
        ]
      },
      selection_trend_summary: {
        query_strategy_applied_24h: 1,
        query_strategy_applied_7d: 4,
        latest_query_strategy_reason: "query_strategy_locale_and_segment",
        latest_segment_strategy_reason: "segment_query_active_window_tight",
        query_strategy_reason_breakdown: [
          { bucket_key: "query_strategy_locale_and_segment", item_count: 4 }
        ],
        segment_strategy_reason_breakdown: [
          { bucket_key: "segment_query_active_window_tight", item_count: 3 }
        ]
      }
    },
    null,
    {
      now: new Date("2026-03-08T15:10:00.000Z"),
      cooldownMinutes: 180
    }
  );

  assert.equal(result.should_notify, true);
  assert.equal(result.notification_reason, "watch_state_pressure");
  assert.equal(result.recommended_recipient_cap, 8);
  assert.equal(result.effective_cap_delta, 32);
  assert.equal(result.recommendation_pressure_band, "alert");
  assert.equal(result.pressure_focus_band, "alert");
  assert.equal(result.pressure_focus_warning_dimension, "segment");
  assert.equal(result.pressure_focus_warning_bucket, "wallet_unlinked");
  assert.equal(result.pressure_focus_warning_matches_target, true);
  assert.equal(result.pressure_focus_locale_bucket, "tr");
  assert.equal(result.pressure_focus_locale_cap, 6);
  assert.equal(result.pressure_focus_variant_bucket, "treatment");
  assert.equal(result.pressure_focus_variant_cap, 5);
  assert.equal(result.pressure_focus_cohort_bucket, "17");
  assert.equal(result.pressure_focus_cohort_cap, 4);
  assert.equal(result.selection_query_strategy_applied_24h, 1);
  assert.equal(result.selection_query_strategy_applied_7d, 4);
  assert.equal(result.selection_latest_query_strategy_reason, "query_strategy_locale_and_segment");
  assert.equal(result.selection_latest_segment_strategy_reason, "segment_query_active_window_tight");
  assert.equal(result.selection_top_query_strategy_reason, "query_strategy_locale_and_segment");
  assert.equal(result.selection_top_query_strategy_reason_count, 4);
  assert.equal(result.selection_top_segment_strategy_reason, "segment_query_active_window_tight");
  assert.equal(result.selection_top_segment_strategy_reason_count, 3);
});

test("evaluateOpsAlert escalates watch state on concentrated locale pressure focus", async () => {
  const mod = await loadModule();
  const result = mod.evaluateOpsAlert(
    {
      scheduler_skip_summary: {
        alarm_state: "watch",
        alarm_reason: "scene_runtime_watch_capped_repeated",
        skipped_24h: 1,
        skipped_7d: 3,
        latest_skip_reason: "scene_runtime_watch_capped",
        latest_skip_at: "2026-03-08T15:00:00.000Z"
      },
      scheduler_summary: {
        recipient_cap_recommendation: {
          pressure_band: "watch",
          configured_recipients: 40,
          recommended_recipient_cap: 8,
          effective_cap_delta: 32,
          reason: "ops_alert_segment_pressure"
        }
      },
      pressure_focus_summary: {
        pressure_band: "watch",
        warning_rows: [
          {
            dimension: "locale",
            bucket_key: "tr",
            item_count: 7,
            matches_target: true
          }
        ],
        locale_cap_split: [
          {
            bucket_key: "tr",
            item_count: 7,
            suggested_recipient_cap: 7
          },
          {
            bucket_key: "en",
            item_count: 1,
            suggested_recipient_cap: 1
          }
        ],
        variant_cap_split: [
          {
            bucket_key: "treatment",
            item_count: 5,
            suggested_recipient_cap: 5
          }
        ],
        cohort_cap_split: [
          {
            bucket_key: "17",
            item_count: 4,
            suggested_recipient_cap: 4
          }
        ]
      }
    },
    null,
    {
      now: new Date("2026-03-08T15:10:00.000Z"),
      cooldownMinutes: 180
    }
  );

  assert.equal(result.should_notify, true);
  assert.equal(result.notification_reason, "watch_state_locale_pressure");
  assert.equal(result.pressure_focus_escalation_band, "alert");
  assert.equal(result.pressure_focus_escalation_reason, "watch_state_locale_pressure");
  assert.equal(result.pressure_focus_escalation_dimension, "locale");
  assert.equal(result.pressure_focus_escalation_bucket, "tr");
  assert.equal(result.pressure_focus_escalation_share, 0.875);
  assert.equal(result.pressure_focus_escalation_matches_target, true);
  assert.equal(result.pressure_focus_effective_delta_ratio, 0.8);
});

test("evaluateOpsAlert escalates watch state on severe selection prefilter pressure", async () => {
  const mod = await loadModule();
  const result = mod.evaluateOpsAlert(
    {
      scheduler_skip_summary: {
        alarm_state: "watch",
        alarm_reason: "scene_runtime_watch_capped_repeated",
        skipped_24h: 1,
        skipped_7d: 2,
        latest_skip_reason: "scene_runtime_watch_capped",
        latest_skip_at: "2026-03-08T15:00:00.000Z"
      },
      scheduler_summary: {
        recipient_cap_recommendation: {
          pressure_band: "watch",
          configured_recipients: 40,
          recommended_recipient_cap: 12,
          effective_cap_delta: 28,
          reason: "ops_alert_segment_pressure"
        }
      },
      selection_summary: {
        focus_dimension: "locale",
        focus_bucket: "tr",
        selected_focus_matches: 0,
        prioritized_focus_matches: 0,
        prefilter_summary: {
          applied: true,
          dimension: "locale",
          bucket: "tr",
          reason: "prefilter_applied",
          candidates_before: 10,
          candidates_after: 4
        }
      },
      pressure_focus_summary: {
        pressure_band: "watch",
        warning_rows: []
      }
    },
    null,
    {
      now: new Date("2026-03-08T15:10:00.000Z"),
      cooldownMinutes: 180
    }
  );

  assert.equal(result.should_notify, true);
  assert.equal(result.notification_reason, "watch_state_prefilter_pressure");
  assert.equal(result.selection_prefilter_applied, true);
  assert.equal(result.selection_prefilter_dimension, "locale");
  assert.equal(result.selection_prefilter_bucket, "tr");
  assert.equal(result.selection_prefilter_candidates_before, 10);
  assert.equal(result.selection_prefilter_candidates_after, 4);
  assert.equal(result.selection_prefilter_reduction_count, 6);
  assert.equal(result.selection_prefilter_reduction_share, 0.6);
});

test("runLiveOpsOpsAlert writes latest artifact and skips telegram on clear state", async () => {
  const mod = await loadModule();
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "akr-liveops-alert-"));
  const liveopsDir = path.join(repoRoot, ".runtime-artifacts", "liveops");
  fs.mkdirSync(liveopsDir, { recursive: true });
  fs.writeFileSync(
    path.join(liveopsDir, "V5_LIVE_OPS_CAMPAIGN_DISPATCH_latest.json"),
    `${JSON.stringify({
      generated_at: "2026-03-08T15:00:00.000Z",
      ok: true,
      skipped: true,
      reason: "campaign_approval_required",
      campaign_key: "comeback_pulse",
      scheduler_skip_summary: {
        alarm_state: "clear",
        alarm_reason: "",
        skipped_24h: 0,
        skipped_7d: 0,
        latest_skip_reason: "",
        latest_skip_at: null
      },
      scheduler_summary: {
        scene_gate_state: "no_data",
        scene_gate_effect: "open",
        scene_gate_reason: "scene_runtime_no_data"
      }
    }, null, 2)}\n`,
    "utf8"
  );

  let fetchCalled = false;
  const result = await mod.runLiveOpsOpsAlert(
    { notify_telegram: "true", apply_exit_code: "false" },
    {
      repoRoot,
      nowFactory: () => new Date("2026-03-08T15:15:00.000Z"),
      fetchImpl: async () => {
        fetchCalled = true;
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      },
      botToken: "bot_token",
      adminTelegramId: "42"
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.evaluation.should_notify, false);
  assert.equal(fetchCalled, false);
  const alertArtifact = JSON.parse(
    fs.readFileSync(path.join(liveopsDir, "V5_LIVE_OPS_OPS_ALERT_latest.json"), "utf8")
  );
  assert.equal(alertArtifact.evaluation.alarm_state, "clear");
  assert.equal(alertArtifact.telegram.sent, false);
});

test("runLiveOpsOpsAlert records audit when alert fingerprint changes", async () => {
  const mod = await loadModule();
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "akr-liveops-alert-audit-"));
  const liveopsDir = path.join(repoRoot, ".runtime-artifacts", "liveops");
  fs.mkdirSync(liveopsDir, { recursive: true });
  fs.writeFileSync(
    path.join(liveopsDir, "V5_LIVE_OPS_CAMPAIGN_DISPATCH_latest.json"),
    `${JSON.stringify({
      generated_at: "2026-03-08T15:00:00.000Z",
      ok: false,
      skipped: true,
      reason: "scene_runtime_alert_blocked",
      campaign_key: "wallet_reconnect",
      version: 9,
      dispatch_ref: "",
      campaign_context: {
        experiment_key: "webapp_react_v1",
        segment_key: "wallet_unlinked",
        locale_bucket: "tr",
        surface_bucket: "wallet_panel",
        variant_bucket: "treatment",
        cohort_bucket: "17"
      },
      scheduler_skip_summary: {
        alarm_state: "alert",
        alarm_reason: "scene_runtime_alert_blocked_repeated",
        skipped_24h: 2,
        skipped_7d: 4,
        latest_skip_reason: "scene_runtime_alert_blocked",
        latest_skip_at: "2026-03-08T15:00:00.000Z"
      },
      scheduler_summary: {
        scene_gate_state: "alert",
        scene_gate_effect: "blocked",
        scene_gate_reason: "scene_runtime_alert_blocked",
        recipient_cap_recommendation: {
          configured_recipients: 40,
          scene_gate_recipient_cap: 0,
          recommended_recipient_cap: 0,
          effective_cap_delta: 40,
          pressure_band: "alert",
          reason: "scene_runtime_alert_blocked",
          experiment_key: "webapp_react_v1",
          locale_bucket: "tr",
          segment_key: "wallet_unlinked",
          surface_bucket: "wallet_panel",
          variant_bucket: "treatment",
          cohort_bucket: "17"
        }
      },
      pressure_focus_summary: {
        pressure_band: "alert",
        warning_rows: [
          {
            dimension: "segment",
            bucket_key: "wallet_unlinked",
            item_count: 3,
            matches_target: true
          }
        ],
        locale_cap_split: [
          {
            bucket_key: "tr",
            item_count: 3,
            suggested_recipient_cap: 0
          }
        ],
        variant_cap_split: [
          {
            bucket_key: "treatment",
            item_count: 2,
            suggested_recipient_cap: 0
          }
        ],
        cohort_cap_split: [
          {
            bucket_key: "17",
            item_count: 2,
            suggested_recipient_cap: 0
          }
        ]
      },
      selection_summary: {
        focus_dimension: "locale",
        focus_bucket: "tr",
        selected_focus_matches: 0,
        prioritized_focus_matches: 0,
        prefilter_summary: {
          applied: true,
          dimension: "locale",
          bucket: "tr",
          reason: "prefilter_applied",
          candidates_before: 12,
          candidates_after: 5
        }
      }
    }, null, 2)}\n`,
    "utf8"
  );

  const auditPayloads = [];
  const result = await mod.runLiveOpsOpsAlert(
    { notify_telegram: "false", admin_id: "7009", apply_exit_code: "false" },
    {
      repoRoot,
      nowFactory: () => new Date("2026-03-08T15:15:00.000Z"),
      recordOpsAlertAudit: async (payload) => {
        auditPayloads.push(payload);
        return {
          attempted: true,
          recorded: true,
          reason: "",
          created_at: "2026-03-08T15:15:00.000Z"
        };
      }
    }
  );

  assert.equal(result.audit.recorded, true);
  assert.equal(auditPayloads.length, 1);
  assert.equal(auditPayloads[0].campaign_key, "wallet_reconnect");
  assert.equal(auditPayloads[0].alarm_state, "alert");
  assert.equal(auditPayloads[0].admin_id, 7009);
  assert.equal(auditPayloads[0].experiment_key, "webapp_react_v1");
  assert.equal(auditPayloads[0].locale_bucket, "tr");
  assert.equal(auditPayloads[0].segment_key, "wallet_unlinked");
  assert.equal(auditPayloads[0].surface_bucket, "wallet_panel");
  assert.equal(auditPayloads[0].variant_bucket, "treatment");
  assert.equal(auditPayloads[0].cohort_bucket, "17");
  assert.equal(auditPayloads[0].recommendation_pressure_band, "alert");
  assert.equal(auditPayloads[0].recommended_recipient_cap, 0);
  assert.equal(auditPayloads[0].effective_cap_delta, 40);
  assert.equal(auditPayloads[0].recommendation_reason, "scene_runtime_alert_blocked");
  assert.equal(auditPayloads[0].pressure_focus_band, "alert");
  assert.equal(auditPayloads[0].pressure_focus_warning_dimension, "segment");
  assert.equal(auditPayloads[0].pressure_focus_warning_bucket, "wallet_unlinked");
  assert.equal(auditPayloads[0].pressure_focus_warning_matches_target, true);
  assert.equal(auditPayloads[0].pressure_focus_locale_bucket, "tr");
  assert.equal(auditPayloads[0].pressure_focus_locale_cap, 0);
  assert.equal(auditPayloads[0].pressure_focus_variant_bucket, "treatment");
  assert.equal(auditPayloads[0].pressure_focus_variant_cap, 0);
  assert.equal(auditPayloads[0].pressure_focus_cohort_bucket, "17");
  assert.equal(auditPayloads[0].pressure_focus_cohort_cap, 0);
  assert.equal(auditPayloads[0].pressure_focus_escalation_band, "alert");
  assert.equal(auditPayloads[0].pressure_focus_escalation_reason, "pressure_band_alert");
  assert.equal(auditPayloads[0].pressure_focus_effective_delta_ratio, 1);
  assert.equal(auditPayloads[0].selection_prefilter_applied, true);
  assert.equal(auditPayloads[0].selection_prefilter_dimension, "locale");
  assert.equal(auditPayloads[0].selection_prefilter_bucket, "tr");
  assert.equal(auditPayloads[0].selection_prefilter_reason, "prefilter_applied");
  assert.equal(auditPayloads[0].selection_prefilter_candidates_before, 12);
  assert.equal(auditPayloads[0].selection_prefilter_candidates_after, 5);
  assert.equal(auditPayloads[0].selection_prefilter_reduction_count, 7);
  assert.equal(auditPayloads[0].selection_prefilter_reduction_share, 7 / 12);
});
