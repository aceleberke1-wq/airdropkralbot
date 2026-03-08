"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  resolveLiveOpsTargetingGuidance,
  resolveLiveOpsPressureEscalation,
  resolveLiveOpsPressureFocus,
  resolveLiveOpsRecipientCapRecommendation,
  resolveLiveOpsSceneGate
} = require("../../../packages/shared/src/liveOpsSceneGate.cjs");

test("resolveLiveOpsSceneGate blocks scheduler on alert band", () => {
  const gate = resolveLiveOpsSceneGate(
    {
      total_24h: 10,
      alarm_state_7d: "alert"
    },
    {
      targeting: {
        max_recipients: 40
      }
    }
  );

  assert.equal(gate.scene_gate_state, "alert");
  assert.equal(gate.scene_gate_effect, "blocked");
  assert.equal(gate.scene_gate_reason, "scene_runtime_alert_blocked");
  assert.equal(gate.scene_gate_recipient_cap, 0);
  assert.equal(gate.ready_for_auto_dispatch, false);
});

test("resolveLiveOpsSceneGate caps scheduler on watch band", () => {
  const gate = resolveLiveOpsSceneGate(
    {
      total_24h: 10,
      alarm_state_7d: "watch"
    },
    {
      targeting: {
        max_recipients: 40
      }
    }
  );

  assert.equal(gate.scene_gate_state, "watch");
  assert.equal(gate.scene_gate_effect, "capped");
  assert.equal(gate.scene_gate_reason, "scene_runtime_watch_capped");
  assert.equal(gate.scene_gate_recipient_cap, 20);
  assert.equal(gate.ready_for_auto_dispatch, true);
});

test("resolveLiveOpsRecipientCapRecommendation tightens cap on matching segment pressure", () => {
  const recommendation = resolveLiveOpsRecipientCapRecommendation(
    {
      total_24h: 10,
      alarm_state_7d: "watch"
    },
    {
      targeting: {
        segment_key: "wallet_unlinked",
        max_recipients: 40
      },
      surfaces: [{ surface_key: "wallet_panel" }]
    },
    {
      skipped_24h: 1,
      skipped_7d: 3,
      alarm_state: "watch"
    },
    {
      raised_24h: 1,
      raised_7d: 3,
      latest_alarm_state: "watch",
      experiment_key: "webapp_react_v1",
      segment_breakdown: [{ bucket_key: "wallet_unlinked", item_count: 3 }],
      locale_breakdown: [{ bucket_key: "tr", item_count: 2 }],
      surface_breakdown: [{ bucket_key: "wallet_panel", item_count: 2 }],
      variant_breakdown: [{ bucket_key: "treatment", item_count: 2 }],
      cohort_breakdown: [{ bucket_key: "17", item_count: 2 }]
    }
  );

  assert.equal(recommendation.scene_gate_recipient_cap, 20);
  assert.equal(recommendation.recommended_recipient_cap, 12);
  assert.equal(recommendation.effective_cap_delta, 28);
  assert.equal(recommendation.pressure_band, "watch");
  assert.equal(recommendation.reason, "ops_alert_segment_pressure");
  assert.equal(recommendation.segment_match, true);
  assert.equal(recommendation.surface_match, true);
});

test("resolveLiveOpsPressureFocus derives warning rows and suggested cap splits", () => {
  const focus = resolveLiveOpsPressureFocus(
    {
      locale_breakdown: [
        { bucket_key: "tr", item_count: 3 },
        { bucket_key: "en", item_count: 1 }
      ],
      segment_breakdown: [{ bucket_key: "wallet_unlinked", item_count: 3 }],
      surface_breakdown: [{ bucket_key: "wallet_panel", item_count: 2 }],
      variant_breakdown: [
        { bucket_key: "treatment", item_count: 3 },
        { bucket_key: "control", item_count: 1 }
      ],
      cohort_breakdown: [
        { bucket_key: "17", item_count: 2 },
        { bucket_key: "42", item_count: 1 }
      ]
    },
    {
      targeting: {
        segment_key: "wallet_unlinked",
        locale_filter: "tr"
      },
      surfaces: [{ surface_key: "wallet_panel" }]
    },
    {
      pressure_band: "watch",
      recommended_recipient_cap: 12
    }
  );

  assert.equal(focus.pressure_band, "watch");
  assert.equal(focus.warning_rows[0].dimension, "segment");
  assert.equal(focus.warning_rows[0].matches_target, true);
  assert.equal(focus.warning_rows[2].dimension, "locale");
  assert.equal(focus.warning_rows[2].matches_target, true);
  assert.equal(focus.locale_cap_split[0].bucket_key, "tr");
  assert.equal(focus.locale_cap_split[0].suggested_recipient_cap, 9);
  assert.equal(focus.locale_cap_split[1].bucket_key, "en");
  assert.equal(focus.locale_cap_split[1].suggested_recipient_cap, 3);
  assert.equal(focus.variant_cap_split[0].bucket_key, "treatment");
  assert.equal(focus.variant_cap_split[0].suggested_recipient_cap, 9);
  assert.equal(focus.cohort_cap_split[0].bucket_key, "17");
  assert.equal(focus.cohort_cap_split[0].suggested_recipient_cap, 8);
});

test("resolveLiveOpsPressureEscalation escalates watch pressure on concentrated locale focus", () => {
  const escalation = resolveLiveOpsPressureEscalation(
    {
      pressure_band: "watch",
      warning_rows: [
        { dimension: "locale", bucket_key: "tr", item_count: 7, matches_target: true }
      ],
      locale_cap_split: [
        { bucket_key: "tr", item_count: 7, suggested_recipient_cap: 7 },
        { bucket_key: "en", item_count: 1, suggested_recipient_cap: 1 }
      ],
      variant_cap_split: [
        { bucket_key: "treatment", item_count: 5, suggested_recipient_cap: 5 }
      ],
      cohort_cap_split: [
        { bucket_key: "17", item_count: 4, suggested_recipient_cap: 4 }
      ]
    },
    {
      configured_recipients: 40,
      recommended_recipient_cap: 8,
      effective_cap_delta: 32,
      pressure_band: "watch"
    }
  );

  assert.equal(escalation.escalation_band, "alert");
  assert.equal(escalation.reason, "watch_state_locale_pressure");
  assert.equal(escalation.focus_dimension, "locale");
  assert.equal(escalation.focus_bucket, "tr");
  assert.equal(escalation.focus_matches_target, true);
  assert.equal(escalation.focus_share_of_recommended_cap, 0.875);
  assert.equal(escalation.effective_cap_delta_ratio, 0.8);
});

test("resolveLiveOpsTargetingGuidance derives protective default when focus escalation is alert", () => {
  const guidance = resolveLiveOpsTargetingGuidance(
    {
      pressure_band: "watch",
      warning_rows: [{ dimension: "locale", bucket_key: "tr", item_count: 7, matches_target: true }],
      locale_cap_split: [
        { bucket_key: "tr", item_count: 7, suggested_recipient_cap: 7 },
        { bucket_key: "en", item_count: 1, suggested_recipient_cap: 1 }
      ],
      variant_cap_split: [{ bucket_key: "treatment", item_count: 5, suggested_recipient_cap: 5 }],
      cohort_cap_split: [{ bucket_key: "17", item_count: 4, suggested_recipient_cap: 4 }]
    },
    {
      configured_recipients: 40,
      scene_gate_recipient_cap: 20,
      recommended_recipient_cap: 8,
      effective_cap_delta: 32,
      pressure_band: "watch"
    },
    {
      escalation_band: "alert",
      reason: "watch_state_locale_pressure",
      focus_dimension: "locale",
      focus_bucket: "tr",
      focus_matches_target: true,
      focus_share_of_recommended_cap: 0.875,
      focus_suggested_recipient_cap: 7,
      effective_cap_delta_ratio: 0.8
    }
  );

  assert.equal(guidance.default_mode, "protective");
  assert.equal(guidance.guidance_state, "alert");
  assert.equal(guidance.focus_dimension, "locale");
  assert.equal(guidance.focus_bucket, "tr");
  assert.equal(guidance.mode_rows[0].mode_key, "protective");
  assert.equal(guidance.mode_rows[0].suggested_recipient_cap, 7);
  assert.equal(guidance.mode_rows[1].mode_key, "balanced");
  assert.equal(guidance.mode_rows[1].suggested_recipient_cap, 8);
  assert.equal(guidance.mode_rows[2].mode_key, "aggressive");
  assert.equal(guidance.mode_rows[2].suggested_recipient_cap, 8);
});
