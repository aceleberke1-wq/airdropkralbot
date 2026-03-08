"use strict";

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Math.max(1, Number(fallback || 1));
  }
  return Math.max(1, Math.floor(parsed));
}

function resolveLiveOpsSceneGate(sceneRuntimeSummary, campaign) {
  const safeSummary = sceneRuntimeSummary && typeof sceneRuntimeSummary === "object" && !Array.isArray(sceneRuntimeSummary)
    ? sceneRuntimeSummary
    : {};
  const configuredRecipients = Math.max(1, toPositiveInt(campaign?.targeting?.max_recipients, 50));
  const alarmState = String(safeSummary.alarm_state_7d || "no_data");
  const total24h = Math.max(0, Number(safeSummary.total_24h || 0));

  if (alarmState === "alert") {
    return {
      scene_gate_state: "alert",
      scene_gate_effect: "blocked",
      scene_gate_reason: "scene_runtime_alert_blocked",
      scene_gate_recipient_cap: 0,
      ready_for_auto_dispatch: false
    };
  }

  if (alarmState === "watch") {
    const cappedRecipients = Math.min(configuredRecipients, 20);
    const effect = cappedRecipients < configuredRecipients ? "capped" : "open";
    return {
      scene_gate_state: "watch",
      scene_gate_effect: effect,
      scene_gate_reason: effect === "capped" ? "scene_runtime_watch_capped" : "scene_runtime_watch_observed",
      scene_gate_recipient_cap: cappedRecipients,
      ready_for_auto_dispatch: true
    };
  }

  if (!total24h) {
    return {
      scene_gate_state: "no_data",
      scene_gate_effect: "open",
      scene_gate_reason: "scene_runtime_no_data",
      scene_gate_recipient_cap: configuredRecipients,
      ready_for_auto_dispatch: true
    };
  }

  return {
    scene_gate_state: "clear",
    scene_gate_effect: "open",
    scene_gate_reason: "",
    scene_gate_recipient_cap: configuredRecipients,
    ready_for_auto_dispatch: true
  };
}

module.exports = {
  resolveLiveOpsSceneGate
};
