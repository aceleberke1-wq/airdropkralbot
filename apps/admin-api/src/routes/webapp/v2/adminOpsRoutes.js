"use strict";

const { createKpiOpsService } = require("../../../services/kpi/kpiOpsService");
const { createLiveOpsChatCampaignService } = require("../../../services/liveOpsChatCampaignService");

function parseNumericInput(value) {
  if (value == null || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return parsed;
}

function parseBooleanInput(value) {
  if (value == null || value === "") {
    return undefined;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return undefined;
}

function normalizeBreakdownRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .map((row) => ({
      bucket_key: String(row?.bucket_key || "unknown"),
      item_count: Math.max(0, Number(row?.item_count || 0))
    }))
    .filter((row) => row.bucket_key)
    .slice(0, 8);
}

function normalizeDailyRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .map((row) => ({
      day: String(row?.day || ""),
      sent_count: Math.max(0, Number(row?.sent_count || 0)),
      unique_users: Math.max(0, Number(row?.unique_users || 0))
    }))
    .filter((row) => row.day)
    .slice(0, 7);
}

function normalizeSkipDailyRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .map((row) => ({
      day: String(row?.day || ""),
      skip_count: Math.max(0, Number(row?.skip_count || 0))
    }))
    .filter((row) => row.day)
    .slice(0, 7);
}

function normalizeOpsAlertDailyRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .map((row) => ({
      day: String(row?.day || ""),
      alert_count: Math.max(0, Number(row?.alert_count || 0)),
      telegram_sent_count: Math.max(0, Number(row?.telegram_sent_count || 0)),
      effective_cap_delta_sum: Math.max(0, Number(row?.effective_cap_delta_sum || 0)),
      effective_cap_delta_max: Math.max(0, Number(row?.effective_cap_delta_max || 0))
    }))
    .filter((row) => row.day)
    .slice(0, 7);
}

function normalizeSelectionTrendDailyRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .map((row) => ({
      day: String(row?.day || ""),
      dispatch_count: Math.max(0, Number(row?.dispatch_count || 0)),
      query_strategy_applied_count: Math.max(0, Number(row?.query_strategy_applied_count || 0)),
      prefilter_applied_count: Math.max(0, Number(row?.prefilter_applied_count || 0)),
      prefilter_delta_sum: Math.max(0, Number(row?.prefilter_delta_sum || 0)),
      prioritized_focus_matches: Math.max(0, Number(row?.prioritized_focus_matches || 0)),
      selected_focus_matches: Math.max(0, Number(row?.selected_focus_matches || 0))
    }))
    .filter((row) => row.day)
    .slice(0, 7);
}

function normalizeSelectionFamilyDailyRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .map((row) => ({
      day: String(row?.day || ""),
      bucket_key: String(row?.bucket_key || "unknown"),
      item_count: Math.max(0, Number(row?.item_count || 0))
    }))
    .filter((row) => row.day)
    .slice(0, 7);
}

function buildLiveOpsCampaignKpiSummary(snapshot) {
  const safeSnapshot = snapshot && typeof snapshot === "object" ? snapshot : {};
  const campaign = safeSnapshot.campaign && typeof safeSnapshot.campaign === "object" ? safeSnapshot.campaign : {};
  const approval = safeSnapshot.approval_summary && typeof safeSnapshot.approval_summary === "object" ? safeSnapshot.approval_summary : {};
  const scheduler = safeSnapshot.scheduler_summary && typeof safeSnapshot.scheduler_summary === "object" ? safeSnapshot.scheduler_summary : {};
  const delivery = safeSnapshot.delivery_summary && typeof safeSnapshot.delivery_summary === "object" ? safeSnapshot.delivery_summary : {};
  const schedulerSkip = safeSnapshot.scheduler_skip_summary && typeof safeSnapshot.scheduler_skip_summary === "object"
    ? safeSnapshot.scheduler_skip_summary
    : {};
  const opsAlert = safeSnapshot.ops_alert_summary && typeof safeSnapshot.ops_alert_summary === "object"
    ? safeSnapshot.ops_alert_summary
    : {};
  const opsAlertTrend = safeSnapshot.ops_alert_trend_summary && typeof safeSnapshot.ops_alert_trend_summary === "object"
    ? safeSnapshot.ops_alert_trend_summary
    : {};
  const sceneRuntime = safeSnapshot.scene_runtime_summary && typeof safeSnapshot.scene_runtime_summary === "object"
    ? safeSnapshot.scene_runtime_summary
    : {};
  const selectionTrend = safeSnapshot.selection_trend_summary && typeof safeSnapshot.selection_trend_summary === "object"
    ? safeSnapshot.selection_trend_summary
    : {};
  const taskSummary = safeSnapshot.task_summary && typeof safeSnapshot.task_summary === "object"
    ? safeSnapshot.task_summary
    : {};
  const recipientCapRecommendation =
    scheduler.recipient_cap_recommendation && typeof scheduler.recipient_cap_recommendation === "object"
      ? scheduler.recipient_cap_recommendation
      : {};
  const targetingGuidance =
    scheduler.targeting_guidance && typeof scheduler.targeting_guidance === "object"
      ? scheduler.targeting_guidance
      : {};
  const selectionSummary =
    taskSummary.selection_summary && typeof taskSummary.selection_summary === "object"
      ? taskSummary.selection_summary
      : {};
  const latestDispatch = safeSnapshot.latest_dispatch && typeof safeSnapshot.latest_dispatch === "object" ? safeSnapshot.latest_dispatch : {};
  return {
    available: true,
    error_code: "",
    campaign_key: String(campaign.campaign_key || ""),
    version: Math.max(0, Number(safeSnapshot.version || 0)),
    enabled: campaign.enabled === true,
    status: String(campaign.status || ""),
    approval_state: String(approval.approval_state || "not_requested"),
    schedule_state: String(scheduler.schedule_state || approval.schedule_state || "missing"),
    ready_for_auto_dispatch: scheduler.ready_for_auto_dispatch === true,
    scene_gate_state: String(scheduler.scene_gate_state || "no_data"),
    scene_gate_effect: String(scheduler.scene_gate_effect || "open"),
    scene_gate_reason: String(scheduler.scene_gate_reason || ""),
    scene_gate_recipient_cap: Math.max(0, Number(scheduler.scene_gate_recipient_cap || 0)),
    latest_dispatch_ref: String(latestDispatch.last_dispatch_ref || ""),
    latest_dispatch_at: latestDispatch.last_sent_at || null,
    latest_auto_dispatch_ref: String(scheduler.latest_auto_dispatch_ref || ""),
    latest_auto_dispatch_at: scheduler.latest_auto_dispatch_at || null,
    sent_24h: Math.max(0, Number(delivery.sent_24h || 0)),
    sent_7d: Math.max(0, Number(delivery.sent_7d || 0)),
    unique_users_7d: Math.max(0, Number(delivery.unique_users_7d || 0)),
    experiment_key: String(delivery.experiment_key || "webapp_react_v1"),
    experiment_assignment_available: delivery.experiment_assignment_available === true,
    daily_breakdown: normalizeDailyRows(delivery.daily_breakdown),
    locale_breakdown: normalizeBreakdownRows(delivery.locale_breakdown),
    segment_breakdown: normalizeBreakdownRows(delivery.segment_breakdown),
    surface_breakdown: normalizeBreakdownRows(delivery.surface_breakdown),
    variant_breakdown: normalizeBreakdownRows(delivery.variant_breakdown),
    cohort_breakdown: normalizeBreakdownRows(delivery.cohort_breakdown),
    recipient_cap_recommendation: {
      configured_recipients: Math.max(0, Number(recipientCapRecommendation.configured_recipients || 0)),
      scene_gate_recipient_cap: Math.max(0, Number(recipientCapRecommendation.scene_gate_recipient_cap || 0)),
      recommended_recipient_cap: Math.max(0, Number(recipientCapRecommendation.recommended_recipient_cap || 0)),
      effective_cap_delta: Math.max(0, Number(recipientCapRecommendation.effective_cap_delta || 0)),
      pressure_band: String(recipientCapRecommendation.pressure_band || "clear"),
      reason: String(recipientCapRecommendation.reason || ""),
      experiment_key: String(recipientCapRecommendation.experiment_key || "webapp_react_v1"),
      locale_bucket: String(recipientCapRecommendation.locale_bucket || ""),
      segment_key: String(recipientCapRecommendation.segment_key || ""),
      surface_bucket: String(recipientCapRecommendation.surface_bucket || ""),
      variant_bucket: String(recipientCapRecommendation.variant_bucket || ""),
      cohort_bucket: String(recipientCapRecommendation.cohort_bucket || ""),
      segment_match: recipientCapRecommendation.segment_match === true,
      surface_match: recipientCapRecommendation.surface_match === true
    },
    targeting_guidance: {
      default_mode: String(targetingGuidance.default_mode || "balanced"),
      guidance_state: String(targetingGuidance.guidance_state || "clear"),
      guidance_reason: String(targetingGuidance.guidance_reason || ""),
      focus_dimension: String(targetingGuidance.focus_dimension || ""),
      focus_bucket: String(targetingGuidance.focus_bucket || ""),
      focus_matches_target: targetingGuidance.focus_matches_target === true,
      focus_share_of_recommended_cap: Math.max(0, Number(targetingGuidance.focus_share_of_recommended_cap || 0)),
      focus_suggested_recipient_cap: Math.max(0, Number(targetingGuidance.focus_suggested_recipient_cap || 0)),
      effective_cap_delta_ratio: Math.max(0, Number(targetingGuidance.effective_cap_delta_ratio || 0)),
      mode_rows: Array.isArray(targetingGuidance.mode_rows)
        ? targetingGuidance.mode_rows.map((row) => ({
            mode_key: String(row?.mode_key || "balanced"),
            suggested_recipient_cap: Math.max(0, Number(row?.suggested_recipient_cap || 0)),
            effective_cap_delta: Math.max(0, Number(row?.effective_cap_delta || 0)),
            delta_vs_recommended: Math.max(0, Number(row?.delta_vs_recommended || 0)),
            reason_code: String(row?.reason_code || "")
          }))
        : []
    },
    selection_summary: {
      guidance_mode: String(selectionSummary.guidance_mode || "balanced"),
      guidance_state: String(selectionSummary.guidance_state || "clear"),
      guidance_reason: String(selectionSummary.guidance_reason || ""),
      focus_dimension: String(selectionSummary.focus_dimension || ""),
      focus_bucket: String(selectionSummary.focus_bucket || ""),
      focus_matches_target: selectionSummary.focus_matches_target === true,
      prioritized_candidates: Math.max(0, Number(selectionSummary.prioritized_candidates || 0)),
      selected_candidates: Math.max(0, Number(selectionSummary.selected_candidates || 0)),
      prioritized_focus_matches: Math.max(0, Number(selectionSummary.prioritized_focus_matches || 0)),
      selected_focus_matches: Math.max(0, Number(selectionSummary.selected_focus_matches || 0)),
      prioritized_top_locale_matches: Math.max(0, Number(selectionSummary.prioritized_top_locale_matches || 0)),
      selected_top_locale_matches: Math.max(0, Number(selectionSummary.selected_top_locale_matches || 0)),
      prioritized_top_variant_matches: Math.max(0, Number(selectionSummary.prioritized_top_variant_matches || 0)),
      selected_top_variant_matches: Math.max(0, Number(selectionSummary.selected_top_variant_matches || 0)),
      prioritized_top_cohort_matches: Math.max(0, Number(selectionSummary.prioritized_top_cohort_matches || 0)),
      selected_top_cohort_matches: Math.max(0, Number(selectionSummary.selected_top_cohort_matches || 0)),
      query_strategy_summary: {
        applied: selectionSummary.query_strategy_summary?.applied === true,
        reason: String(selectionSummary.query_strategy_summary?.reason || ""),
        mode_key: String(selectionSummary.query_strategy_summary?.mode_key || "balanced"),
        segment_key: String(selectionSummary.query_strategy_summary?.segment_key || ""),
        focus_matches_target: selectionSummary.query_strategy_summary?.focus_matches_target === true,
        dimension: String(selectionSummary.query_strategy_summary?.dimension || ""),
        bucket: String(selectionSummary.query_strategy_summary?.bucket || ""),
        exclude_locale_prefix: String(selectionSummary.query_strategy_summary?.exclude_locale_prefix || ""),
        locale_strategy_reason: String(selectionSummary.query_strategy_summary?.locale_strategy_reason || ""),
        segment_strategy_reason: String(selectionSummary.query_strategy_summary?.segment_strategy_reason || ""),
        strategy_family: String(selectionSummary.query_strategy_summary?.strategy_family || ""),
        locale_strategy_family: String(selectionSummary.query_strategy_summary?.locale_strategy_family || ""),
        segment_strategy_family: String(selectionSummary.query_strategy_summary?.segment_strategy_family || ""),
        family_risk_state: String(selectionSummary.query_strategy_summary?.family_risk_state || "clear"),
        family_risk_reason: String(selectionSummary.query_strategy_summary?.family_risk_reason || ""),
        family_risk_dimension: String(selectionSummary.query_strategy_summary?.family_risk_dimension || ""),
        family_risk_bucket: String(selectionSummary.query_strategy_summary?.family_risk_bucket || ""),
        family_risk_match_days: Math.max(0, Number(selectionSummary.query_strategy_summary?.family_risk_match_days || 0)),
        family_risk_weight: Math.max(0, Number(selectionSummary.query_strategy_summary?.family_risk_weight || 0)),
        family_risk_tightened: selectionSummary.query_strategy_summary?.family_risk_tightened === true,
        pool_limit_multiplier: Math.max(1, Number(selectionSummary.query_strategy_summary?.pool_limit_multiplier || 4)),
        active_within_days_cap: Math.max(0, Number(selectionSummary.query_strategy_summary?.active_within_days_cap || 0)),
        inactive_hours_floor: Math.max(0, Number(selectionSummary.query_strategy_summary?.inactive_hours_floor || 0)),
        max_age_days_cap: Math.max(0, Number(selectionSummary.query_strategy_summary?.max_age_days_cap || 0)),
        offer_age_days_cap: Math.max(0, Number(selectionSummary.query_strategy_summary?.offer_age_days_cap || 0))
      },
      prefilter_summary: {
        applied: selectionSummary.prefilter_summary?.applied === true,
        dimension: String(selectionSummary.prefilter_summary?.dimension || ""),
        bucket: String(selectionSummary.prefilter_summary?.bucket || ""),
        reason: String(selectionSummary.prefilter_summary?.reason || ""),
        candidates_before: Math.max(0, Number(selectionSummary.prefilter_summary?.candidates_before || 0)),
        candidates_after: Math.max(0, Number(selectionSummary.prefilter_summary?.candidates_after || 0))
      }
    },
    scheduler_skip: {
      skipped_24h: Math.max(0, Number(schedulerSkip.skipped_24h || 0)),
      skipped_7d: Math.max(0, Number(schedulerSkip.skipped_7d || 0)),
      latest_skip_at: schedulerSkip.latest_skip_at || null,
      latest_skip_reason: String(schedulerSkip.latest_skip_reason || ""),
      alarm_state: String(schedulerSkip.alarm_state || "clear"),
      alarm_reason: String(schedulerSkip.alarm_reason || ""),
      scene_alert_blocked_7d: Math.max(0, Number(schedulerSkip.scene_alert_blocked_7d || 0)),
      scene_watch_capped_7d: Math.max(0, Number(schedulerSkip.scene_watch_capped_7d || 0)),
      daily_breakdown: normalizeSkipDailyRows(schedulerSkip.daily_breakdown),
      reason_breakdown: normalizeBreakdownRows(schedulerSkip.reason_breakdown)
    },
    ops_alert: {
      artifact_found: opsAlert.artifact_found === true,
      artifact_path: String(opsAlert.artifact_path || ""),
      artifact_generated_at: opsAlert.artifact_generated_at || null,
      artifact_age_min: Math.max(0, Number(opsAlert.artifact_age_min || 0)),
      alarm_state: String(opsAlert.alarm_state || "clear"),
      should_notify: opsAlert.should_notify === true,
      notification_reason: String(opsAlert.notification_reason || ""),
      fingerprint: String(opsAlert.fingerprint || ""),
      pressure_focus_escalation_band: String(opsAlert.pressure_focus_escalation_band || "clear"),
      pressure_focus_escalation_reason: String(opsAlert.pressure_focus_escalation_reason || ""),
      pressure_focus_escalation_dimension: String(opsAlert.pressure_focus_escalation_dimension || ""),
      pressure_focus_escalation_bucket: String(opsAlert.pressure_focus_escalation_bucket || ""),
      pressure_focus_escalation_share: Math.max(0, Number(opsAlert.pressure_focus_escalation_share || 0)),
      pressure_focus_effective_delta_ratio: Math.max(0, Number(opsAlert.pressure_focus_effective_delta_ratio || 0)),
      selection_family_escalation_band: String(opsAlert.selection_family_escalation_band || "clear"),
      selection_family_escalation_reason: String(opsAlert.selection_family_escalation_reason || ""),
      selection_family_escalation_dimension: String(opsAlert.selection_family_escalation_dimension || ""),
      selection_family_escalation_bucket: String(opsAlert.selection_family_escalation_bucket || ""),
      selection_family_escalation_score: Math.max(0, Number(opsAlert.selection_family_escalation_score || 0)),
      selection_family_daily_weight: Math.max(0, Number(opsAlert.selection_family_daily_weight || 0)),
      selection_query_family_weight: Math.max(0, Number(opsAlert.selection_query_family_weight || 0)),
      selection_segment_family_weight: Math.max(0, Number(opsAlert.selection_segment_family_weight || 0)),
      selection_query_family_match_days: Math.max(0, Number(opsAlert.selection_query_family_match_days || 0)),
      selection_segment_family_match_days: Math.max(0, Number(opsAlert.selection_segment_family_match_days || 0)),
      selection_query_strategy_applied_24h: Math.max(0, Number(opsAlert.selection_query_strategy_applied_24h || 0)),
      selection_query_strategy_applied_7d: Math.max(0, Number(opsAlert.selection_query_strategy_applied_7d || 0)),
      selection_latest_query_strategy_reason: String(opsAlert.selection_latest_query_strategy_reason || ""),
      selection_latest_query_strategy_family: String(opsAlert.selection_latest_query_strategy_family || ""),
      selection_latest_segment_strategy_reason: String(opsAlert.selection_latest_segment_strategy_reason || ""),
      selection_latest_segment_strategy_family: String(opsAlert.selection_latest_segment_strategy_family || ""),
      selection_top_query_strategy_reason: String(opsAlert.selection_top_query_strategy_reason || ""),
      selection_top_query_strategy_family: String(opsAlert.selection_top_query_strategy_family || ""),
      selection_top_query_strategy_reason_count: Math.max(0, Number(opsAlert.selection_top_query_strategy_reason_count || 0)),
      selection_top_segment_strategy_reason: String(opsAlert.selection_top_segment_strategy_reason || ""),
      selection_top_segment_strategy_family: String(opsAlert.selection_top_segment_strategy_family || ""),
      selection_top_segment_strategy_reason_count: Math.max(0, Number(opsAlert.selection_top_segment_strategy_reason_count || 0)),
      telegram_sent: opsAlert.telegram_sent === true,
      telegram_reason: String(opsAlert.telegram_reason || ""),
      telegram_sent_at: opsAlert.telegram_sent_at || null
    },
    ops_alert_trend: {
      raised_24h: Math.max(0, Number(opsAlertTrend.raised_24h || 0)),
      raised_7d: Math.max(0, Number(opsAlertTrend.raised_7d || 0)),
      telegram_sent_24h: Math.max(0, Number(opsAlertTrend.telegram_sent_24h || 0)),
      telegram_sent_7d: Math.max(0, Number(opsAlertTrend.telegram_sent_7d || 0)),
      effective_cap_delta_24h: Math.max(0, Number(opsAlertTrend.effective_cap_delta_24h || 0)),
      effective_cap_delta_7d: Math.max(0, Number(opsAlertTrend.effective_cap_delta_7d || 0)),
      experiment_key: String(opsAlertTrend.experiment_key || "webapp_react_v1"),
      latest_alert_at: opsAlertTrend.latest_alert_at || null,
      latest_alarm_state: String(opsAlertTrend.latest_alarm_state || "clear"),
      latest_notification_reason: String(opsAlertTrend.latest_notification_reason || ""),
      latest_telegram_sent_at: opsAlertTrend.latest_telegram_sent_at || null,
      latest_effective_cap_delta: Math.max(0, Number(opsAlertTrend.latest_effective_cap_delta || 0)),
      max_effective_cap_delta_7d: Math.max(0, Number(opsAlertTrend.max_effective_cap_delta_7d || 0)),
      daily_breakdown: normalizeOpsAlertDailyRows(opsAlertTrend.daily_breakdown),
      reason_breakdown: normalizeBreakdownRows(opsAlertTrend.reason_breakdown),
      locale_breakdown: normalizeBreakdownRows(opsAlertTrend.locale_breakdown),
      segment_breakdown: normalizeBreakdownRows(opsAlertTrend.segment_breakdown),
      surface_breakdown: normalizeBreakdownRows(opsAlertTrend.surface_breakdown),
      variant_breakdown: normalizeBreakdownRows(opsAlertTrend.variant_breakdown),
      cohort_breakdown: normalizeBreakdownRows(opsAlertTrend.cohort_breakdown)
    },
    selection_trend: {
      dispatches_24h: Math.max(0, Number(selectionTrend.dispatches_24h || 0)),
      dispatches_7d: Math.max(0, Number(selectionTrend.dispatches_7d || 0)),
      query_strategy_applied_24h: Math.max(0, Number(selectionTrend.query_strategy_applied_24h || 0)),
      query_strategy_applied_7d: Math.max(0, Number(selectionTrend.query_strategy_applied_7d || 0)),
      prefilter_applied_24h: Math.max(0, Number(selectionTrend.prefilter_applied_24h || 0)),
      prefilter_applied_7d: Math.max(0, Number(selectionTrend.prefilter_applied_7d || 0)),
      prefilter_delta_24h: Math.max(0, Number(selectionTrend.prefilter_delta_24h || 0)),
      prefilter_delta_7d: Math.max(0, Number(selectionTrend.prefilter_delta_7d || 0)),
      prioritized_focus_matches_24h: Math.max(0, Number(selectionTrend.prioritized_focus_matches_24h || 0)),
      prioritized_focus_matches_7d: Math.max(0, Number(selectionTrend.prioritized_focus_matches_7d || 0)),
      selected_focus_matches_24h: Math.max(0, Number(selectionTrend.selected_focus_matches_24h || 0)),
      selected_focus_matches_7d: Math.max(0, Number(selectionTrend.selected_focus_matches_7d || 0)),
      latest_selection_at: selectionTrend.latest_selection_at || null,
      latest_guidance_mode: String(selectionTrend.latest_guidance_mode || "balanced"),
      latest_focus_dimension: String(selectionTrend.latest_focus_dimension || ""),
      latest_focus_bucket: String(selectionTrend.latest_focus_bucket || ""),
      latest_query_strategy_reason: String(selectionTrend.latest_query_strategy_reason || ""),
      latest_query_strategy_family: String(selectionTrend.latest_query_strategy_family || ""),
      latest_segment_strategy_reason: String(selectionTrend.latest_segment_strategy_reason || ""),
      latest_segment_strategy_family: String(selectionTrend.latest_segment_strategy_family || ""),
      latest_prefilter_reason: String(selectionTrend.latest_prefilter_reason || ""),
      latest_family_risk_state: String(selectionTrend.latest_family_risk_state || "clear"),
      latest_family_risk_reason: String(selectionTrend.latest_family_risk_reason || ""),
      latest_family_risk_dimension: String(selectionTrend.latest_family_risk_dimension || ""),
      latest_family_risk_bucket: String(selectionTrend.latest_family_risk_bucket || ""),
      latest_family_risk_score: Math.max(0, Number(selectionTrend.latest_family_risk_score || 0)),
      daily_breakdown: normalizeSelectionTrendDailyRows(selectionTrend.daily_breakdown),
      query_strategy_family_daily_breakdown: normalizeSelectionFamilyDailyRows(selectionTrend.query_strategy_family_daily_breakdown),
      segment_strategy_family_daily_breakdown: normalizeSelectionFamilyDailyRows(selectionTrend.segment_strategy_family_daily_breakdown),
      family_risk_daily_breakdown: Array.isArray(selectionTrend.family_risk_daily_breakdown)
        ? selectionTrend.family_risk_daily_breakdown
            .map((row) => ({
              day: String(row?.day || ""),
              risk_state: String(row?.risk_state || "clear"),
              risk_reason: String(row?.risk_reason || ""),
              risk_dimension: String(row?.risk_dimension || ""),
              risk_bucket: String(row?.risk_bucket || ""),
              risk_score: Math.max(0, Number(row?.risk_score || 0)),
              query_family: String(row?.query_family || ""),
              segment_family: String(row?.segment_family || ""),
              query_match_days: Math.max(0, Number(row?.query_match_days || 0)),
              segment_match_days: Math.max(0, Number(row?.segment_match_days || 0)),
              query_weight: Math.max(0, Number(row?.query_weight || 0)),
              segment_weight: Math.max(0, Number(row?.segment_weight || 0))
            }))
            .filter((row) => row.day)
            .slice(0, 7)
        : [],
      query_strategy_reason_breakdown: normalizeBreakdownRows(selectionTrend.query_strategy_reason_breakdown),
      query_strategy_family_breakdown: normalizeBreakdownRows(selectionTrend.query_strategy_family_breakdown),
      segment_strategy_reason_breakdown: normalizeBreakdownRows(selectionTrend.segment_strategy_reason_breakdown),
      segment_strategy_family_breakdown: normalizeBreakdownRows(selectionTrend.segment_strategy_family_breakdown),
      family_risk_band_breakdown: normalizeBreakdownRows(selectionTrend.family_risk_band_breakdown),
      prefilter_reason_breakdown: normalizeBreakdownRows(selectionTrend.prefilter_reason_breakdown)
    },
    scene_runtime: sceneRuntime
  };
}

async function getLiveOpsCampaignKpiSummary(service, logger) {
  try {
    const snapshot = await service.getCampaignSnapshot();
    return buildLiveOpsCampaignKpiSummary(snapshot);
  } catch (err) {
    if (logger && typeof logger.warn === "function") {
      logger.warn({ err }, "live_ops_campaign_kpi_summary_failed");
    }
    return {
      available: false,
      error_code: String(err?.code || err?.message || "live_ops_campaign_kpi_summary_failed"),
      campaign_key: "",
      version: 0,
      enabled: false,
      status: "",
      approval_state: "not_requested",
      schedule_state: "missing",
      ready_for_auto_dispatch: false,
      scene_gate_state: "no_data",
      scene_gate_effect: "open",
      scene_gate_reason: "",
      scene_gate_recipient_cap: 0,
      latest_dispatch_ref: "",
      latest_dispatch_at: null,
      latest_auto_dispatch_ref: "",
      latest_auto_dispatch_at: null,
      sent_24h: 0,
      sent_7d: 0,
      unique_users_7d: 0,
      experiment_key: "webapp_react_v1",
      experiment_assignment_available: false,
      daily_breakdown: [],
      locale_breakdown: [],
      segment_breakdown: [],
      surface_breakdown: [],
      variant_breakdown: [],
      cohort_breakdown: [],
      recipient_cap_recommendation: {
        configured_recipients: 0,
        scene_gate_recipient_cap: 0,
        recommended_recipient_cap: 0,
        effective_cap_delta: 0,
        pressure_band: "clear",
        reason: "",
        experiment_key: "webapp_react_v1",
        locale_bucket: "",
        segment_key: "",
        surface_bucket: "",
        variant_bucket: "",
        cohort_bucket: "",
        segment_match: false,
        surface_match: false
      },
      targeting_guidance: {
        default_mode: "balanced",
        guidance_state: "clear",
        guidance_reason: "",
        focus_dimension: "",
        focus_bucket: "",
        focus_matches_target: false,
        focus_share_of_recommended_cap: 0,
        focus_suggested_recipient_cap: 0,
        effective_cap_delta_ratio: 0,
        mode_rows: []
      },
      selection_summary: {
        guidance_mode: "balanced",
        guidance_state: "clear",
        guidance_reason: "",
        focus_dimension: "",
        focus_bucket: "",
        focus_matches_target: false,
        prioritized_candidates: 0,
        selected_candidates: 0,
        prioritized_focus_matches: 0,
        selected_focus_matches: 0,
        prioritized_top_locale_matches: 0,
        selected_top_locale_matches: 0,
        prioritized_top_variant_matches: 0,
        selected_top_variant_matches: 0,
        prioritized_top_cohort_matches: 0,
        selected_top_cohort_matches: 0,
        query_strategy_summary: {
          applied: false,
          reason: "",
          mode_key: "balanced",
          segment_key: "",
          focus_matches_target: false,
          dimension: "",
          bucket: "",
          exclude_locale_prefix: "",
          locale_strategy_reason: "",
          segment_strategy_reason: "",
          strategy_family: "",
          locale_strategy_family: "",
          segment_strategy_family: "",
          family_risk_state: "clear",
          family_risk_reason: "",
          family_risk_dimension: "",
          family_risk_bucket: "",
          family_risk_match_days: 0,
          family_risk_weight: 0,
          family_risk_tightened: false,
          pool_limit_multiplier: 4,
          active_within_days_cap: 0,
          inactive_hours_floor: 0,
          max_age_days_cap: 0,
          offer_age_days_cap: 0
        },
        prefilter_summary: {
          applied: false,
          dimension: "",
          bucket: "",
          reason: "",
          candidates_before: 0,
          candidates_after: 0
        }
      },
      scheduler_skip: {
        skipped_24h: 0,
        skipped_7d: 0,
        latest_skip_at: null,
        latest_skip_reason: "",
        alarm_state: "clear",
        alarm_reason: "",
        scene_alert_blocked_7d: 0,
        scene_watch_capped_7d: 0,
        daily_breakdown: [],
        reason_breakdown: []
      },
      ops_alert: {
        artifact_found: false,
        artifact_path: "",
        artifact_generated_at: null,
        artifact_age_min: 0,
        alarm_state: "clear",
        should_notify: false,
        notification_reason: "",
        fingerprint: "",
        pressure_focus_escalation_band: "clear",
        pressure_focus_escalation_reason: "",
        pressure_focus_escalation_dimension: "",
        pressure_focus_escalation_bucket: "",
        pressure_focus_escalation_share: 0,
        pressure_focus_effective_delta_ratio: 0,
        selection_family_escalation_band: "clear",
        selection_family_escalation_reason: "",
        selection_family_escalation_dimension: "",
        selection_family_escalation_bucket: "",
        selection_family_escalation_score: 0,
        selection_family_daily_weight: 0,
        selection_query_family_weight: 0,
        selection_segment_family_weight: 0,
        selection_query_family_match_days: 0,
        selection_segment_family_match_days: 0,
        selection_query_strategy_applied_24h: 0,
        selection_query_strategy_applied_7d: 0,
        selection_latest_query_strategy_reason: "",
        selection_latest_query_strategy_family: "",
        selection_latest_segment_strategy_reason: "",
        selection_latest_segment_strategy_family: "",
        selection_top_query_strategy_reason: "",
        selection_top_query_strategy_family: "",
        selection_top_query_strategy_reason_count: 0,
        selection_top_segment_strategy_reason: "",
        selection_top_segment_strategy_family: "",
        selection_top_segment_strategy_reason_count: 0,
        telegram_sent: false,
        telegram_reason: "",
        telegram_sent_at: null
      },
      ops_alert_trend: {
        raised_24h: 0,
        raised_7d: 0,
        telegram_sent_24h: 0,
        telegram_sent_7d: 0,
        effective_cap_delta_24h: 0,
        effective_cap_delta_7d: 0,
        experiment_key: "webapp_react_v1",
        latest_alert_at: null,
        latest_alarm_state: "clear",
        latest_notification_reason: "",
        latest_telegram_sent_at: null,
        latest_effective_cap_delta: 0,
        max_effective_cap_delta_7d: 0,
        daily_breakdown: [],
        reason_breakdown: [],
        locale_breakdown: [],
        segment_breakdown: [],
        surface_breakdown: [],
        variant_breakdown: [],
        cohort_breakdown: []
      },
      selection_trend: {
        dispatches_24h: 0,
        dispatches_7d: 0,
        query_strategy_applied_24h: 0,
        query_strategy_applied_7d: 0,
        prefilter_applied_24h: 0,
        prefilter_applied_7d: 0,
        prefilter_delta_24h: 0,
        prefilter_delta_7d: 0,
        prioritized_focus_matches_24h: 0,
        prioritized_focus_matches_7d: 0,
        selected_focus_matches_24h: 0,
        selected_focus_matches_7d: 0,
        latest_selection_at: null,
        latest_guidance_mode: "balanced",
        latest_focus_dimension: "",
        latest_focus_bucket: "",
        latest_query_strategy_reason: "",
        latest_query_strategy_family: "",
        latest_segment_strategy_reason: "",
        latest_segment_strategy_family: "",
        latest_prefilter_reason: "",
        latest_family_risk_state: "clear",
        latest_family_risk_reason: "",
        latest_family_risk_dimension: "",
        latest_family_risk_bucket: "",
        latest_family_risk_score: 0,
        daily_breakdown: [],
        query_strategy_family_daily_breakdown: [],
        segment_strategy_family_daily_breakdown: [],
        family_risk_daily_breakdown: [],
        query_strategy_reason_breakdown: [],
        query_strategy_family_breakdown: [],
        segment_strategy_reason_breakdown: [],
        segment_strategy_family_breakdown: [],
        family_risk_band_breakdown: [],
        prefilter_reason_breakdown: []
      },
      scene_runtime: {}
    };
  }
}

function registerWebappV2AdminOpsRoutes(fastify, deps = {}) {
  const pool = deps.pool;
  const verifyWebAppAuth = deps.verifyWebAppAuth;
  const requireWebAppAdmin = deps.requireWebAppAdmin;
  const issueWebAppSession = deps.issueWebAppSession;
  const contracts = deps.contracts || {};
  const repoRootDir = deps.repoRootDir || process.cwd();
  const logger = deps.logger || fastify.log;

  if (!pool || typeof pool.connect !== "function") {
    throw new Error("registerWebappV2AdminOpsRoutes requires pg pool");
  }
  if (typeof verifyWebAppAuth !== "function") {
    throw new Error("registerWebappV2AdminOpsRoutes requires verifyWebAppAuth");
  }
  if (typeof requireWebAppAdmin !== "function") {
    throw new Error("registerWebappV2AdminOpsRoutes requires requireWebAppAdmin");
  }
  if (typeof issueWebAppSession !== "function") {
    throw new Error("registerWebappV2AdminOpsRoutes requires issueWebAppSession");
  }

  const service = deps.service || createKpiOpsService({ repoRootDir, pool, logger });
  const liveOpsService =
    deps.liveOpsService ||
    createLiveOpsChatCampaignService({
      pool,
      fetchImpl: deps.fetchImpl,
      botToken: deps.botToken,
      botUsername: deps.botUsername,
      webappPublicUrl: deps.webappPublicUrl,
      webappHmacSecret: deps.webappHmacSecret,
      resolveWebappVersion: deps.resolveWebappVersion,
      logger(level, payload) {
        if (typeof deps.logger?.[level] === "function") {
          deps.logger[level](payload);
          return;
        }
        if (typeof deps.logger === "function") {
          deps.logger(level, payload);
        }
      }
    });
  const latestResponseSchema = contracts.KpiBundleSnapshotResponseSchema;
  const runRequestSchema = contracts.KpiBundleRunRequestSchema;
  const snapshotSchema = contracts.KpiBundleSnapshotSchema;

  fastify.get(
    "/webapp/api/v2/admin/ops/kpi/latest",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["uid", "ts", "sig"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" }
          }
        }
      }
    },
    async (request, reply) => {
      const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
      if (!auth.ok) {
        reply.code(401).send({ success: false, error: auth.reason });
        return;
      }

      const client = await pool.connect();
      try {
        const profile = await requireWebAppAdmin(client, reply, auth.uid);
        if (!profile) {
          return;
        }
      } finally {
        client.release();
      }

      try {
        const latest = await service.getLatestBundle();
        const webappExperiment = await service.getWebappExperimentSummary({
          experiment_key: "webapp_react_v1"
        });
        const liveOpsCampaign = await getLiveOpsCampaignKpiSummary(liveOpsService, logger);
        const parsedSnapshot = snapshotSchema ? snapshotSchema.safeParse(latest.bundle) : { success: true, data: latest.bundle };
        if (!parsedSnapshot.success) {
          logger.warn({ issues: parsedSnapshot.error?.issues || [] }, "kpi_latest_schema_validation_failed");
          reply.code(500).send({ success: false, error: "kpi_snapshot_contract_invalid" });
          return;
        }

        const payload = {
          api_version: "v2",
          snapshot: parsedSnapshot.data,
          source: "docs_latest",
          webapp_experiment: webappExperiment,
          live_ops_campaign: liveOpsCampaign
        };
        if (latestResponseSchema) {
          const parsedPayload = latestResponseSchema.safeParse(payload);
          if (!parsedPayload.success) {
            logger.warn({ issues: parsedPayload.error?.issues || [] }, "kpi_latest_response_schema_validation_failed");
            reply.code(500).send({ success: false, error: "kpi_latest_response_invalid" });
            return;
          }
        }

        reply.send({
          success: true,
          session: issueWebAppSession(auth.uid),
          data: {
            ...payload,
            updated_at: latest.updated_at
          }
        });
      } catch (err) {
        if (err.code === "kpi_bundle_not_found") {
          reply.code(404).send({ success: false, error: "kpi_bundle_not_found" });
          return;
        }
        throw err;
      }
    }
  );

  fastify.post(
    "/webapp/api/v2/admin/ops/kpi/run",
    {
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            hours_short: { type: "integer", minimum: 1, maximum: 168 },
            hours_long: { type: "integer", minimum: 1, maximum: 168 },
            trend_days: { type: "integer", minimum: 1, maximum: 30 },
            emit_slo: { type: "boolean" }
          }
        }
      }
    },
    async (request, reply) => {
      const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
      if (!auth.ok) {
        reply.code(401).send({ success: false, error: auth.reason });
        return;
      }

      const client = await pool.connect();
      try {
        const profile = await requireWebAppAdmin(client, reply, auth.uid);
        if (!profile) {
          return;
        }
      } finally {
        client.release();
      }

      const requestPayload = {
        uid: String(request.body.uid || ""),
        ts: String(request.body.ts || ""),
        sig: String(request.body.sig || ""),
        hours_short: parseNumericInput(request.body.hours_short),
        hours_long: parseNumericInput(request.body.hours_long),
        trend_days: parseNumericInput(request.body.trend_days),
        emit_slo: parseBooleanInput(request.body.emit_slo)
      };
      if (runRequestSchema) {
        const parseRequest = runRequestSchema.safeParse(requestPayload);
        if (!parseRequest.success) {
          reply.code(400).send({
            success: false,
            error: "invalid_kpi_run_payload",
            details: parseRequest.error.issues.map((issue) => ({
              path: issue.path,
              message: issue.message
            }))
          });
          return;
        }
      }

      const run = await service.runBundle({
        requestedBy: Number(auth.uid || 0),
        config: requestPayload
      });
      const webappExperiment = await service.getWebappExperimentSummary({
        experiment_key: "webapp_react_v1"
      });
      const liveOpsCampaign = await getLiveOpsCampaignKpiSummary(liveOpsService, logger);

      if (!run.snapshot) {
        reply.code(502).send({
          success: false,
          error: "kpi_bundle_run_missing_snapshot",
          data: {
            run_ref: run.run_ref,
            status: run.status,
            exit_code: run.exit_code,
            stderr: String(run.stderr || "").slice(0, 500)
          }
        });
        return;
      }

      const parsedSnapshot = snapshotSchema ? snapshotSchema.safeParse(run.snapshot) : { success: true, data: run.snapshot };
      if (!parsedSnapshot.success) {
        logger.warn({ issues: parsedSnapshot.error?.issues || [] }, "kpi_run_snapshot_schema_validation_failed");
        reply.code(500).send({ success: false, error: "kpi_snapshot_contract_invalid" });
        return;
      }

      const payload = {
        api_version: "v2",
        source: "kpi_bundle_runner",
        snapshot: parsedSnapshot.data,
        webapp_experiment: webappExperiment,
        live_ops_campaign: liveOpsCampaign,
        run: {
          run_ref: run.run_ref,
          status: run.status,
          duration_ms: run.duration_ms,
          started_at: run.started_at,
          finished_at: run.finished_at
        }
      };
      if (latestResponseSchema) {
        const parsedPayload = latestResponseSchema.safeParse(payload);
        if (!parsedPayload.success) {
          logger.warn({ issues: parsedPayload.error?.issues || [] }, "kpi_run_response_schema_validation_failed");
          reply.code(500).send({ success: false, error: "kpi_run_response_invalid" });
          return;
        }
      }

      const statusCode = run.status === "success" ? 200 : 502;
      reply.code(statusCode).send({
        success: run.status === "success",
        session: issueWebAppSession(auth.uid),
        data: {
          ...payload,
          exit_code: run.exit_code,
          signal: run.signal,
          stdout_tail: String(run.stdout || "").split("\n").slice(-8).join("\n"),
          stderr_tail: String(run.stderr || "").split("\n").slice(-8).join("\n")
        }
      });
    }
  );
}

module.exports = {
  registerWebappV2AdminOpsRoutes
};
