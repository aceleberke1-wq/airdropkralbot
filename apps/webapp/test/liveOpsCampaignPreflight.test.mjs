import test from "node:test";
import assert from "node:assert/strict";
import { buildLiveOpsCampaignPreflight } from "../src/core/admin/liveOpsCampaignPreflight.js";

test("buildLiveOpsCampaignPreflight exposes capped watch gate for draft campaign", () => {
  const result = buildLiveOpsCampaignPreflight(
    JSON.stringify({
      campaign_key: "wallet_reconnect",
      targeting: {
        segment_key: "wallet_unlinked",
        max_recipients: 40,
        locale_filter: "tr"
      },
      surfaces: [{ surface_key: "wallet_panel" }]
    }),
    {
      total_24h: 12,
      alarm_state_7d: "watch"
    },
    {
      skipped_24h: 2,
      skipped_7d: 5,
      latest_skip_reason: "scene_runtime_watch_capped",
      latest_skip_at: "2026-03-08T11:22:00.000Z"
    },
    {
      raised_24h: 1,
      raised_7d: 3,
      latest_alarm_state: "watch",
      experiment_key: "webapp_react_v1",
      segment_breakdown: [{ bucket_key: "wallet_unlinked", item_count: 3 }],
      locale_breakdown: [
        { bucket_key: "tr", item_count: 7 },
        { bucket_key: "en", item_count: 1 }
      ],
      surface_breakdown: [{ bucket_key: "wallet_panel", item_count: 2 }],
      variant_breakdown: [
        { bucket_key: "treatment", item_count: 7 },
        { bucket_key: "control", item_count: 1 }
      ],
      cohort_breakdown: [
        { bucket_key: "17", item_count: 6 },
        { bucket_key: "42", item_count: 1 }
      ]
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.campaign_key, "wallet_reconnect");
  assert.equal(result.segment_key, "wallet_unlinked");
  assert.equal(result.max_recipients, 40);
  assert.equal(result.recent_skip_24h, 2);
  assert.equal(result.recent_skip_7d, 5);
  assert.equal(result.recent_skip_pressure, "active");
  assert.equal(result.latest_skip_reason, "scene_runtime_watch_capped");
  assert.equal(result.gate.scene_gate_effect, "capped");
  assert.equal(result.gate.scene_gate_recipient_cap, 20);
  assert.equal(result.recipient_cap_recommendation.recommended_recipient_cap, 12);
  assert.equal(result.recipient_cap_recommendation.effective_cap_delta, 28);
  assert.equal(result.recipient_cap_recommendation.reason, "ops_alert_segment_pressure");
  assert.equal(result.recipient_cap_recommendation.experiment_key, "webapp_react_v1");
  assert.equal(result.pressure_focus.warning_rows[0].dimension, "segment");
  assert.equal(result.pressure_focus.warning_rows[0].matches_target, true);
  assert.equal(result.pressure_focus.locale_cap_split[0].bucket_key, "tr");
  assert.equal(result.pressure_focus.locale_cap_split[0].suggested_recipient_cap, 11);
  assert.equal(result.pressure_focus.variant_cap_split[0].bucket_key, "treatment");
  assert.equal(result.pressure_focus.variant_cap_split[0].suggested_recipient_cap, 11);
  assert.equal(result.pressure_escalation.escalation_band, "alert");
  assert.equal(result.pressure_escalation.reason, "watch_state_locale_pressure");
  assert.equal(result.targeting_guidance.default_mode, "protective");
  assert.equal(result.targeting_guidance.guidance_state, "alert");
  assert.equal(result.targeting_guidance.mode_rows[0].mode_key, "protective");
  assert.equal(result.targeting_guidance.mode_rows[0].suggested_recipient_cap, 11);
  assert.equal(result.targeting_guidance.mode_rows[2].mode_key, "aggressive");
  assert.equal(result.targeting_guidance.mode_rows[2].suggested_recipient_cap, 12);
});

test("buildLiveOpsCampaignPreflight returns parse error for invalid draft", () => {
  const result = buildLiveOpsCampaignPreflight(
    "{bad json",
    {
      total_24h: 0,
      alarm_state_7d: "no_data"
    },
    {
      skipped_24h: 0,
      skipped_7d: 1,
      latest_skip_reason: "already_dispatched_for_window"
    },
    {}
  );

  assert.equal(result.ok, false);
  assert.equal(result.error, "live_ops_campaign_invalid_json");
  assert.equal(result.recent_skip_pressure, "watch");
  assert.equal(result.latest_skip_reason, "already_dispatched_for_window");
  assert.equal(result.gate.scene_gate_state, "no_data");
  assert.equal(result.targeting_guidance.default_mode, "aggressive");
});
