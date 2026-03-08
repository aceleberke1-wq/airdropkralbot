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

function roundRatio(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return Number(parsed.toFixed(4));
}

function buildWarningMatchIndex(warningRows) {
  const index = new Map();
  asRows(warningRows).forEach((row) => {
    const dimension = String(row.dimension || "").trim();
    const bucketKey = String(row.bucket_key || "").trim();
    if (!dimension || !bucketKey) {
      return;
    }
    index.set(`${dimension}:${bucketKey}`, row.matches_target === true);
  });
  return index;
}

function pickPressureSplitCandidate(dimension, rows, recommendedCap, warningIndex) {
  const topRow = asRows(rows)[0] || null;
  if (!topRow) {
    return null;
  }
  const bucketKey = String(topRow.bucket_key || "").trim();
  const suggestedCap = Math.max(0, Number(topRow.suggested_recipient_cap || 0));
  const itemCount = Math.max(0, Number(topRow.item_count || 0));
  if (!bucketKey || suggestedCap <= 0 || itemCount <= 0 || recommendedCap <= 0) {
    return null;
  }
  return {
    dimension,
    bucket_key: bucketKey,
    suggested_recipient_cap: suggestedCap,
    item_count: itemCount,
    share_of_recommended_cap: roundRatio(suggestedCap / recommendedCap),
    matches_target: warningIndex.get(`${dimension}:${bucketKey}`) === true
  };
}

function sortPressureCandidates(candidates) {
  return candidates
    .filter(Boolean)
    .slice()
    .sort((left, right) => {
      if (right.share_of_recommended_cap !== left.share_of_recommended_cap) {
        return right.share_of_recommended_cap - left.share_of_recommended_cap;
      }
      if (right.item_count !== left.item_count) {
        return right.item_count - left.item_count;
      }
      return left.dimension.localeCompare(right.dimension);
    });
}

function clampRecipientCap(value, maxCap) {
  const safeMax = Math.max(0, Number(maxCap || 0));
  const parsed = Math.max(0, Math.floor(Number(value || 0)));
  if (safeMax <= 0) {
    return 0;
  }
  return Math.max(1, Math.min(safeMax, parsed));
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

function resolveLiveOpsPressureEscalation(pressureFocusSummary, recommendation) {
  const safeFocus = asRecord(pressureFocusSummary);
  const safeRecommendation = asRecord(recommendation);
  const pressureBand = String(safeRecommendation.pressure_band || safeFocus.pressure_band || "clear").trim().toLowerCase();
  const configuredRecipients = Math.max(0, Number(safeRecommendation.configured_recipients || 0));
  const recommendedCap = Math.max(0, Number(safeRecommendation.recommended_recipient_cap || 0));
  const effectiveCapDelta = Math.max(0, Number(safeRecommendation.effective_cap_delta || 0));
  const effectiveCapDeltaRatio = configuredRecipients > 0 ? roundRatio(effectiveCapDelta / configuredRecipients) : 0;
  const warningIndex = buildWarningMatchIndex(safeFocus.warning_rows);
  const localeCandidate = pickPressureSplitCandidate("locale", safeFocus.locale_cap_split, recommendedCap, warningIndex);
  const variantCandidate = pickPressureSplitCandidate("variant", safeFocus.variant_cap_split, recommendedCap, warningIndex);
  const cohortCandidate = pickPressureSplitCandidate("cohort", safeFocus.cohort_cap_split, recommendedCap, warningIndex);
  let escalationBand = pressureBand === "alert" ? "alert" : pressureBand === "watch" ? "watch" : "clear";
  let reason = pressureBand === "alert" ? "pressure_band_alert" : "";
  let focusDimension = "";
  let focusBucket = "";
  let focusShare = 0;
  let focusMatchesTarget = false;
  let focusSuggestedCap = 0;

  if (pressureBand === "watch" && recommendedCap > 0 && effectiveCapDelta > 0) {
    const candidates = [localeCandidate, variantCandidate, cohortCandidate].filter(Boolean);
    const localeAlertCandidate =
      localeCandidate &&
      localeCandidate.share_of_recommended_cap >= 0.85 &&
      (effectiveCapDeltaRatio >= 0.5 || localeCandidate.matches_target === true)
        ? localeCandidate
        : null;
    const variantAlertCandidate =
      variantCandidate &&
      variantCandidate.share_of_recommended_cap >= 0.85 &&
      effectiveCapDeltaRatio >= 0.5
        ? variantCandidate
        : null;
    const cohortAlertCandidate =
      cohortCandidate &&
      cohortCandidate.share_of_recommended_cap >= 0.9 &&
      effectiveCapDeltaRatio >= 0.6
        ? cohortCandidate
        : null;
    const escalationCandidate = localeAlertCandidate || variantAlertCandidate || cohortAlertCandidate || null;
    if (escalationCandidate) {
      escalationBand = "alert";
      reason = `watch_state_${escalationCandidate.dimension}_pressure`;
      focusDimension = escalationCandidate.dimension;
      focusBucket = escalationCandidate.bucket_key;
      focusShare = escalationCandidate.share_of_recommended_cap;
      focusMatchesTarget = escalationCandidate.matches_target === true;
      focusSuggestedCap = escalationCandidate.suggested_recipient_cap;
    } else if (candidates.length) {
      const topCandidate = candidates
        .slice()
        .sort((left, right) => {
          if (right.share_of_recommended_cap !== left.share_of_recommended_cap) {
            return right.share_of_recommended_cap - left.share_of_recommended_cap;
          }
          if (right.item_count !== left.item_count) {
            return right.item_count - left.item_count;
          }
          return left.dimension.localeCompare(right.dimension);
        })[0];
      focusDimension = topCandidate.dimension;
      focusBucket = topCandidate.bucket_key;
      focusShare = topCandidate.share_of_recommended_cap;
      focusMatchesTarget = topCandidate.matches_target === true;
      focusSuggestedCap = topCandidate.suggested_recipient_cap;
    }
  }

  return {
    escalation_band: ["clear", "watch", "alert"].includes(escalationBand) ? escalationBand : "clear",
    reason,
    configured_recipients: configuredRecipients,
    recommended_recipient_cap: recommendedCap,
    effective_cap_delta: effectiveCapDelta,
    effective_cap_delta_ratio: effectiveCapDeltaRatio,
    focus_dimension: focusDimension,
    focus_bucket: focusBucket,
    focus_share_of_recommended_cap: focusShare,
    focus_matches_target: focusMatchesTarget,
    focus_suggested_recipient_cap: focusSuggestedCap
  };
}

function resolveLiveOpsTargetingGuidance(pressureFocusSummary, recommendation, pressureEscalation) {
  const safeFocus = asRecord(pressureFocusSummary);
  const safeRecommendation = asRecord(recommendation);
  const safeEscalation = asRecord(pressureEscalation);
  const configuredRecipients = Math.max(0, Number(safeRecommendation.configured_recipients || 0));
  const sceneGateCap = Math.max(
    0,
    Number(safeRecommendation.scene_gate_recipient_cap || safeRecommendation.recommended_recipient_cap || configuredRecipients)
  );
  const maxCap = Math.max(sceneGateCap, configuredRecipients, Number(safeRecommendation.recommended_recipient_cap || 0));
  const recommendedCap = clampRecipientCap(safeRecommendation.recommended_recipient_cap, maxCap);
  const pressureBand = String(safeRecommendation.pressure_band || safeFocus.pressure_band || "clear").trim().toLowerCase();
  const escalationBand = String(safeEscalation.escalation_band || pressureBand || "clear").trim().toLowerCase();
  const warningIndex = buildWarningMatchIndex(safeFocus.warning_rows);
  const focusCandidates = sortPressureCandidates([
    pickPressureSplitCandidate("locale", safeFocus.locale_cap_split, recommendedCap, warningIndex),
    pickPressureSplitCandidate("variant", safeFocus.variant_cap_split, recommendedCap, warningIndex),
    pickPressureSplitCandidate("cohort", safeFocus.cohort_cap_split, recommendedCap, warningIndex)
  ]);
  const topCandidate = focusCandidates[0] || null;
  const focusDimension = String(safeEscalation.focus_dimension || ((topCandidate && topCandidate.dimension) || "")).trim();
  const focusBucket = String(safeEscalation.focus_bucket || ((topCandidate && topCandidate.bucket_key) || "")).trim();
  const focusMatchesTarget = safeEscalation.focus_matches_target === true || (topCandidate && topCandidate.matches_target === true);
  const focusShare = Math.max(
    0,
    Number(safeEscalation.focus_share_of_recommended_cap || ((topCandidate && topCandidate.share_of_recommended_cap) || 0))
  );
  const focusSuggestedCap = clampRecipientCap(
    safeEscalation.focus_suggested_recipient_cap || ((topCandidate && topCandidate.suggested_recipient_cap) || 0),
    maxCap
  );
  const effectiveCapDeltaRatio = Math.max(0, Number(safeEscalation.effective_cap_delta_ratio || 0));
  const balancedCap = clampRecipientCap(recommendedCap || sceneGateCap || configuredRecipients, maxCap);
  let protectiveCap = focusSuggestedCap;

  if (!protectiveCap) {
    if (escalationBand === "alert" || pressureBand === "alert") {
      protectiveCap = clampRecipientCap(Math.ceil(balancedCap * 0.75), maxCap);
    } else if (pressureBand === "watch") {
      protectiveCap = clampRecipientCap(Math.ceil(balancedCap * 0.85), maxCap);
    } else {
      protectiveCap = balancedCap;
    }
  }
  protectiveCap = clampRecipientCap(Math.min(protectiveCap, balancedCap || protectiveCap), maxCap);

  let aggressiveCap = 0;
  if (escalationBand === "alert" || pressureBand === "alert") {
    aggressiveCap = balancedCap;
  } else if (pressureBand === "watch") {
    aggressiveCap = clampRecipientCap(Math.ceil((balancedCap + sceneGateCap) / 2), maxCap);
  } else {
    aggressiveCap = clampRecipientCap(sceneGateCap || configuredRecipients, maxCap);
  }
  aggressiveCap = Math.max(aggressiveCap, balancedCap);

  return {
    default_mode:
      escalationBand === "alert" || pressureBand === "alert"
        ? "protective"
        : pressureBand === "watch"
          ? "balanced"
          : "aggressive",
    guidance_state: escalationBand === "alert" ? "alert" : pressureBand === "watch" ? "watch" : "clear",
    guidance_reason: String(safeEscalation.reason || safeRecommendation.reason || "").trim(),
    focus_dimension: focusDimension,
    focus_bucket: focusBucket,
    focus_matches_target: focusMatchesTarget,
    focus_share_of_recommended_cap: roundRatio(focusShare),
    focus_suggested_recipient_cap: focusSuggestedCap,
    effective_cap_delta_ratio: roundRatio(effectiveCapDeltaRatio),
    mode_rows: [
      {
        mode_key: "protective",
        suggested_recipient_cap: protectiveCap,
        effective_cap_delta: Math.max(0, configuredRecipients - protectiveCap),
        delta_vs_recommended: Math.max(0, balancedCap - protectiveCap),
        reason_code:
          focusDimension && focusBucket
            ? `focus_${focusDimension}_protective`
            : pressureBand === "clear"
              ? "steady_state"
              : "pressure_band_protective"
      },
      {
        mode_key: "balanced",
        suggested_recipient_cap: balancedCap,
        effective_cap_delta: Math.max(0, configuredRecipients - balancedCap),
        delta_vs_recommended: 0,
        reason_code: "recommended_cap"
      },
      {
        mode_key: "aggressive",
        suggested_recipient_cap: aggressiveCap,
        effective_cap_delta: Math.max(0, configuredRecipients - aggressiveCap),
        delta_vs_recommended: Math.max(0, aggressiveCap - balancedCap),
        reason_code:
          aggressiveCap === balancedCap
            ? "scene_gate_locked"
            : pressureBand === "watch"
              ? "scene_gate_headroom_watch"
              : "scene_gate_headroom_clear"
      }
    ]
  };
}

module.exports = {
  resolveLiveOpsSceneGate,
  resolveLiveOpsRecipientCapRecommendation,
  resolveLiveOpsPressureFocus,
  resolveLiveOpsPressureEscalation,
  resolveLiveOpsTargetingGuidance
};
