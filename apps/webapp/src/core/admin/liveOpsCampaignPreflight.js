import { parseLiveOpsCampaignDraft } from "./adminDraftParsers.js";
import {
  resolveLiveOpsPressureEscalation,
  resolveLiveOpsPressureFocus,
  resolveLiveOpsRecipientCapRecommendation,
  resolveLiveOpsSceneGate,
  resolveLiveOpsTargetingGuidance
} from "../../../../../packages/shared/src/liveOpsSceneGate.mjs";

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asCount(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function resolveRecentSkipPressure(skip24h, skip7d) {
  if (skip24h > 0) {
    return "active";
  }
  if (skip7d > 0) {
    return "watch";
  }
  return "clear";
}

export function buildLiveOpsCampaignPreflight(draftText, sceneRuntimeSummary, schedulerSkipSummary, opsAlertTrendSummary) {
  const schedulerSkip = asRecord(schedulerSkipSummary);
  const skipped24h = asCount(schedulerSkip.skipped_24h);
  const skipped7d = asCount(schedulerSkip.skipped_7d);
  const latestSkipReason = String(schedulerSkip.latest_skip_reason || "").trim();
  const latestSkipAt = String(schedulerSkip.latest_skip_at || "").trim();
  const fallbackCampaign = { targeting: { max_recipients: 50 } };
  const fallbackRecommendation = resolveLiveOpsRecipientCapRecommendation(
    asRecord(sceneRuntimeSummary),
    fallbackCampaign,
    schedulerSkip,
    asRecord(opsAlertTrendSummary)
  );
  const fallbackPressureFocus = resolveLiveOpsPressureFocus(asRecord(opsAlertTrendSummary), fallbackCampaign, fallbackRecommendation);
  const fallbackPressureEscalation = resolveLiveOpsPressureEscalation(fallbackPressureFocus, fallbackRecommendation);
  const parsed = parseLiveOpsCampaignDraft(draftText || "{}");
  if (!parsed.ok || !parsed.campaign) {
    return {
      ok: false,
      error: parsed.error || "live_ops_campaign_invalid_json",
      campaign_key: "",
      segment_key: "",
      max_recipients: 0,
      recent_skip_24h: skipped24h,
      recent_skip_7d: skipped7d,
      recent_skip_pressure: resolveRecentSkipPressure(skipped24h, skipped7d),
      latest_skip_reason: latestSkipReason,
      latest_skip_at: latestSkipAt,
      gate: resolveLiveOpsSceneGate(asRecord(sceneRuntimeSummary), fallbackCampaign),
      recipient_cap_recommendation: fallbackRecommendation,
      pressure_focus: fallbackPressureFocus,
      pressure_escalation: fallbackPressureEscalation,
      targeting_guidance: resolveLiveOpsTargetingGuidance(
        fallbackPressureFocus,
        fallbackRecommendation,
        fallbackPressureEscalation
      )
    };
  }

  const campaign = asRecord(parsed.campaign);
  const targeting = asRecord(campaign.targeting);
  const recommendation = resolveLiveOpsRecipientCapRecommendation(
    asRecord(sceneRuntimeSummary),
    campaign,
    schedulerSkip,
    asRecord(opsAlertTrendSummary)
  );
  const pressureFocus = resolveLiveOpsPressureFocus(asRecord(opsAlertTrendSummary), campaign, recommendation);
  const pressureEscalation = resolveLiveOpsPressureEscalation(pressureFocus, recommendation);
  return {
    ok: true,
    error: "",
    campaign_key: String(campaign.campaign_key || ""),
    segment_key: String(targeting.segment_key || ""),
    max_recipients: Math.max(0, Number(targeting.max_recipients || 0)),
    recent_skip_24h: skipped24h,
    recent_skip_7d: skipped7d,
    recent_skip_pressure: resolveRecentSkipPressure(skipped24h, skipped7d),
    latest_skip_reason: latestSkipReason,
    latest_skip_at: latestSkipAt,
    gate: resolveLiveOpsSceneGate(asRecord(sceneRuntimeSummary), campaign),
    recipient_cap_recommendation: recommendation,
    pressure_focus: pressureFocus,
    pressure_escalation: pressureEscalation,
    targeting_guidance: resolveLiveOpsTargetingGuidance(pressureFocus, recommendation, pressureEscalation)
  };
}
