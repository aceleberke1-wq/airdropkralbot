"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
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
