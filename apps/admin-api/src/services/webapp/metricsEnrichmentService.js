"use strict";

function toNum(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

function toRate(numerator, denominator) {
  const top = Math.max(0, toNum(numerator, 0));
  const bottom = Math.max(0, toNum(denominator, 0));
  if (bottom <= 0) {
    return 0;
  }
  return Number((top / bottom).toFixed(4));
}

function resolveQualityBand(score) {
  const safe = clamp(toNum(score, 0), 0, 1);
  if (safe >= 0.97) return "green";
  if (safe >= 0.92) return "yellow";
  return "red";
}

function resolveConversionBand(intentToSubmitRate, submitToApprovedRate, intentCount) {
  const submitRate = clamp(toNum(intentToSubmitRate, 0), 0, 1);
  const approveRate = clamp(toNum(submitToApprovedRate, 0), 0, 1);
  const count = Math.max(0, Math.floor(toNum(intentCount, 0)));
  if (count < 20) {
    return "low_volume";
  }
  if (submitRate >= 0.55 && approveRate >= 0.55) {
    return "green";
  }
  if (submitRate >= 0.35 && approveRate >= 0.35) {
    return "yellow";
  }
  return "red";
}

function normalizeBreakdownRows(rows, limit = 6) {
  const source = Array.isArray(rows) ? rows : [];
  return source
    .map((row) => ({
      bucket_key: String(row?.bucket_key || "unknown"),
      item_count: Math.max(0, Math.floor(toNum(row?.item_count, 0)))
    }))
    .filter((row) => row.bucket_key)
    .slice(0, Math.max(1, Math.floor(toNum(limit, 6))));
}

function resolveSceneRuntimeHealthBand(readyRate, totalCount, failedCount) {
  const safeReadyRate = clamp(toNum(readyRate, 0), 0, 1);
  const total = Math.max(0, Math.floor(toNum(totalCount, 0)));
  const failed = Math.max(0, Math.floor(toNum(failedCount, 0)));
  if (total <= 0) {
    return "no_data";
  }
  if (safeReadyRate >= 0.96 && failed <= 3) {
    return "green";
  }
  if (safeReadyRate >= 0.9) {
    return "yellow";
  }
  return "red";
}

function enrichWebappRevenueMetrics(rawMetrics = {}) {
  const metrics = rawMetrics && typeof rawMetrics === "object" ? rawMetrics : {};
  const uiIngested = Math.max(0, Math.floor(toNum(metrics.ui_events_ingested_24h, 0)));
  const uiValid = Math.max(0, Math.floor(toNum(metrics.ui_events_valid_24h, 0)));
  const qualityScore = uiIngested > 0 ? Number((uiValid / uiIngested).toFixed(4)) : 1;
  const intent = Math.max(0, Math.floor(toNum(metrics.funnel_intent_24h, 0)));
  const submit = Math.max(0, Math.floor(toNum(metrics.funnel_tx_submit_24h, 0)));
  const approved = Math.max(0, Math.floor(toNum(metrics.funnel_approved_24h, 0)));
  const intentToSubmitRate = toRate(submit, intent);
  const submitToApprovedRate = toRate(approved, submit);

  metrics.ui_events_ingested_24h = uiIngested;
  metrics.ui_events_valid_24h = uiValid;
  metrics.ui_events_with_funnel_24h = Math.max(0, Math.floor(toNum(metrics.ui_events_with_funnel_24h, 0)));
  metrics.ui_events_value_usd_24h = Number(toNum(metrics.ui_events_value_usd_24h, 0).toFixed(8));
  metrics.ui_event_quality_score_24h = qualityScore;
  metrics.ui_event_quality_band_24h = resolveQualityBand(qualityScore);

  metrics.funnel_intent_24h = intent;
  metrics.funnel_tx_submit_24h = submit;
  metrics.funnel_approved_24h = approved;
  metrics.funnel_pass_purchase_24h = Math.max(0, Math.floor(toNum(metrics.funnel_pass_purchase_24h, 0)));
  metrics.funnel_cosmetic_purchase_24h = Math.max(0, Math.floor(toNum(metrics.funnel_cosmetic_purchase_24h, 0)));
  metrics.funnel_value_usd_24h = Number(toNum(metrics.funnel_value_usd_24h, 0).toFixed(8));
  metrics.funnel_intent_to_submit_rate_24h = intentToSubmitRate;
  metrics.funnel_submit_to_approved_rate_24h = submitToApprovedRate;
  metrics.funnel_conversion_band_24h = resolveConversionBand(intentToSubmitRate, submitToApprovedRate, intent);

  const sceneReady = Math.max(0, Math.floor(toNum(metrics.scene_runtime_ready_24h, 0)));
  const sceneFailed = Math.max(0, Math.floor(toNum(metrics.scene_runtime_failed_24h, 0)));
  const sceneLowEnd = Math.max(0, Math.floor(toNum(metrics.scene_runtime_low_end_24h, 0)));
  const sceneTotal = sceneReady + sceneFailed;
  const sceneReadyRate = toRate(sceneReady, sceneTotal);
  const sceneFailureRate = toRate(sceneFailed, sceneTotal);
  const sceneLowEndShare = toRate(sceneLowEnd, sceneTotal);
  metrics.scene_runtime_ready_24h = sceneReady;
  metrics.scene_runtime_failed_24h = sceneFailed;
  metrics.scene_runtime_low_end_24h = sceneLowEnd;
  metrics.scene_runtime_total_24h = sceneTotal;
  metrics.scene_runtime_ready_rate_24h = sceneReadyRate;
  metrics.scene_runtime_failure_rate_24h = sceneFailureRate;
  metrics.scene_runtime_low_end_share_24h = sceneLowEndShare;
  metrics.scene_runtime_avg_loaded_bundles_24h = Number(toNum(metrics.scene_runtime_avg_loaded_bundles_24h, 0).toFixed(2));
  metrics.scene_runtime_health_band_24h = resolveSceneRuntimeHealthBand(sceneReadyRate, sceneTotal, sceneFailed);
  metrics.scene_runtime_quality_breakdown_24h = normalizeBreakdownRows(metrics.scene_runtime_quality_breakdown_24h);
  metrics.scene_runtime_perf_breakdown_24h = normalizeBreakdownRows(metrics.scene_runtime_perf_breakdown_24h);
  metrics.scene_runtime_device_breakdown_24h = normalizeBreakdownRows(metrics.scene_runtime_device_breakdown_24h);
  metrics.scene_runtime_profile_breakdown_24h = normalizeBreakdownRows(metrics.scene_runtime_profile_breakdown_24h);
  return metrics;
}

module.exports = {
  toRate,
  resolveQualityBand,
  resolveConversionBand,
  resolveSceneRuntimeHealthBand,
  normalizeBreakdownRows,
  enrichWebappRevenueMetrics
};
