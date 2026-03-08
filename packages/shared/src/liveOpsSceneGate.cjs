"use strict";

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Math.max(1, Number(fallback || 1));
  }
  return Math.max(1, Math.floor(parsed));
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asRows(value) {
  return Array.isArray(value)
    ? value.filter((row) => row && typeof row === "object" && !Array.isArray(row))
    : [];
}

function pickTopBucket(rows) {
  const topRow = asRows(rows)[0] || {};
  return String(topRow.bucket_key || "").trim();
}

function hasSurfaceMatch(campaign, surfaceBucket) {
  const safeSurface = String(surfaceBucket || "").trim();
  if (!safeSurface) {
    return false;
  }
  const surfaces = Array.isArray(campaign?.surfaces) ? campaign.surfaces : [];
  return surfaces.some((row) => String(row?.surface_key || "").trim() === safeSurface);
}

function normalizeBucketRows(rows, limit = 3) {
  return asRows(rows)
    .map((row) => ({
      bucket_key: String(row.bucket_key || "").trim(),
      item_count: Math.max(0, Number(row.item_count || 0))
    }))
    .filter((row) => row.bucket_key && row.item_count > 0)
    .sort((left, right) => (right.item_count - left.item_count) || left.bucket_key.localeCompare(right.bucket_key))
    .slice(0, Math.max(1, Number(limit || 3)));
}

function allocateSuggestedCap(rows, recommendedCap) {
  const safeRows = normalizeBucketRows(rows, 3);
  const cap = Math.max(0, Number(recommendedCap || 0));
  if (!safeRows.length || cap <= 0) {
    return [];
  }
  const total = safeRows.reduce((sum, row) => sum + row.item_count, 0);
  if (!total) {
    return safeRows.map((row) => ({ ...row, suggested_recipient_cap: 0 }));
  }
  const allocations = safeRows.map((row) => ({
    ...row,
    suggested_recipient_cap: Math.floor((cap * row.item_count) / total)
  }));
  let remainder = cap - allocations.reduce((sum, row) => sum + row.suggested_recipient_cap, 0);
  for (let index = 0; remainder > 0 && allocations.length > 0; index = (index + 1) % allocations.length) {
    allocations[index].suggested_recipient_cap += 1;
    remainder -= 1;
  }
  return allocations;
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

function resolveLiveOpsRecipientCapRecommendation(sceneRuntimeSummary, campaign, schedulerSkipSummary, opsAlertTrendSummary) {
  const safeCampaign = asRecord(campaign);
  const safeTargeting = asRecord(safeCampaign.targeting);
  const safeSkip = asRecord(schedulerSkipSummary);
  const safeTrend = asRecord(opsAlertTrendSummary);
  const sceneGate = resolveLiveOpsSceneGate(sceneRuntimeSummary, safeCampaign);
  const configuredRecipients = Math.max(1, toPositiveInt(safeTargeting.max_recipients, 50));
  const baseCap = Math.max(0, Number(sceneGate.scene_gate_recipient_cap || configuredRecipients));
  const experimentKey = String(safeTrend.experiment_key || "webapp_react_v1").trim() || "webapp_react_v1";
  const localeBucket = pickTopBucket(safeTrend.locale_breakdown);
  const segmentBucket = pickTopBucket(safeTrend.segment_breakdown);
  const surfaceBucket = pickTopBucket(safeTrend.surface_breakdown);
  const variantBucket = pickTopBucket(safeTrend.variant_breakdown);
  const cohortBucket = pickTopBucket(safeTrend.cohort_breakdown);
  const campaignSegmentKey = String(safeTargeting.segment_key || "").trim();
  const segmentMatch = Boolean(campaignSegmentKey && segmentBucket && campaignSegmentKey === segmentBucket);
  const surfaceMatch = hasSurfaceMatch(safeCampaign, surfaceBucket);
  const latestAlarmState = String(safeTrend.latest_alarm_state || safeSkip.alarm_state || "clear").trim().toLowerCase();
  const raised24h = Math.max(0, Number(safeTrend.raised_24h || 0));
  const raised7d = Math.max(0, Number(safeTrend.raised_7d || 0));
  let pressureBand = "clear";
  let reason = sceneGate.scene_gate_effect === "capped" ? "scene_gate_watch_cap" : sceneGate.scene_gate_reason || "";
  let multiplier = 1;

  if (sceneGate.scene_gate_effect === "blocked" || baseCap <= 0) {
    return {
      configured_recipients: configuredRecipients,
      scene_gate_recipient_cap: baseCap,
      recommended_recipient_cap: 0,
      effective_cap_delta: Math.max(0, configuredRecipients),
      pressure_band: "alert",
      reason: sceneGate.scene_gate_reason || "scene_gate_blocked",
      experiment_key: experimentKey,
      locale_bucket: localeBucket,
      segment_key: segmentBucket,
      surface_bucket: surfaceBucket,
      variant_bucket: variantBucket,
      cohort_bucket: cohortBucket,
      segment_match: segmentMatch,
      surface_match: surfaceMatch
    };
  }

  if (latestAlarmState === "alert" || raised24h >= 2 || raised7d >= 4) {
    pressureBand = "alert";
    multiplier = 0.55;
    reason = "ops_alert_pressure_high";
  } else if (latestAlarmState === "watch" || raised24h >= 1 || raised7d >= 2) {
    pressureBand = "watch";
    multiplier = 0.75;
    reason = "ops_alert_pressure_watch";
  }

  if (segmentMatch && pressureBand !== "clear") {
    multiplier = Math.min(multiplier, pressureBand === "alert" ? 0.45 : 0.6);
    reason = "ops_alert_segment_pressure";
  } else if (surfaceMatch && pressureBand !== "clear") {
    multiplier = Math.min(multiplier, pressureBand === "alert" ? 0.5 : 0.7);
    reason = "ops_alert_surface_pressure";
  }

  const recommendedCap =
    pressureBand === "clear" ? baseCap : Math.max(1, Math.min(baseCap, Math.floor(baseCap * multiplier)));
  const effectiveCapDelta = Math.max(0, configuredRecipients - recommendedCap);

  return {
    configured_recipients: configuredRecipients,
    scene_gate_recipient_cap: baseCap,
    recommended_recipient_cap: recommendedCap,
    effective_cap_delta: effectiveCapDelta,
    pressure_band: pressureBand,
    reason,
    experiment_key: experimentKey,
    locale_bucket: localeBucket,
    segment_key: segmentBucket,
    surface_bucket: surfaceBucket,
    variant_bucket: variantBucket,
    cohort_bucket: cohortBucket,
    segment_match: segmentMatch,
    surface_match: surfaceMatch
  };
}

function resolveLiveOpsPressureFocus(opsAlertTrendSummary, campaign, recommendation) {
  const safeTrend = asRecord(opsAlertTrendSummary);
  const safeCampaign = asRecord(campaign);
  const safeTargeting = asRecord(safeCampaign.targeting);
  const safeRecommendation = asRecord(recommendation);
  const pressureBand = String(safeRecommendation.pressure_band || "clear").trim().toLowerCase();
  const localeFilter = String(safeTargeting.locale_filter || "").trim().toLowerCase();
  const segmentKey = String(safeTargeting.segment_key || "").trim();
  const localeRows = normalizeBucketRows(safeTrend.locale_breakdown);
  const segmentRows = normalizeBucketRows(safeTrend.segment_breakdown, 1);
  const surfaceRows = normalizeBucketRows(safeTrend.surface_breakdown, 1);
  const variantRows = normalizeBucketRows(safeTrend.variant_breakdown);
  const cohortRows = normalizeBucketRows(safeTrend.cohort_breakdown);
  const focusWarnings = [];

  if (segmentRows[0]) {
    focusWarnings.push({
      dimension: "segment",
      bucket_key: segmentRows[0].bucket_key,
      item_count: segmentRows[0].item_count,
      matches_target: Boolean(segmentKey && segmentRows[0].bucket_key === segmentKey)
    });
  }
  if (surfaceRows[0]) {
    focusWarnings.push({
      dimension: "surface",
      bucket_key: surfaceRows[0].bucket_key,
      item_count: surfaceRows[0].item_count,
      matches_target: hasSurfaceMatch(safeCampaign, surfaceRows[0].bucket_key)
    });
  }
  if (localeRows[0]) {
    focusWarnings.push({
      dimension: "locale",
      bucket_key: localeRows[0].bucket_key,
      item_count: localeRows[0].item_count,
      matches_target: Boolean(localeFilter && localeRows[0].bucket_key.toLowerCase() === localeFilter)
    });
  }
  if (variantRows[0]) {
    focusWarnings.push({
      dimension: "variant",
      bucket_key: variantRows[0].bucket_key,
      item_count: variantRows[0].item_count,
      matches_target: false
    });
  }
  if (cohortRows[0]) {
    focusWarnings.push({
      dimension: "cohort",
      bucket_key: cohortRows[0].bucket_key,
      item_count: cohortRows[0].item_count,
      matches_target: false
    });
  }

  return {
    pressure_band: ["clear", "watch", "alert"].includes(pressureBand) ? pressureBand : "clear",
    warning_rows: focusWarnings,
    locale_cap_split: allocateSuggestedCap(localeRows, safeRecommendation.recommended_recipient_cap),
    variant_cap_split: allocateSuggestedCap(variantRows, safeRecommendation.recommended_recipient_cap),
    cohort_cap_split: allocateSuggestedCap(cohortRows, safeRecommendation.recommended_recipient_cap)
  };
}

module.exports = {
  resolveLiveOpsSceneGate,
  resolveLiveOpsRecipientCapRecommendation,
  resolveLiveOpsPressureFocus
};
