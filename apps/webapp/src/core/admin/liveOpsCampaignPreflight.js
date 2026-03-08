import { parseLiveOpsCampaignDraft } from "./adminDraftParsers.js";
import { resolveLiveOpsSceneGate } from "../../../../../packages/shared/src/liveOpsSceneGate.mjs";

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function buildLiveOpsCampaignPreflight(draftText, sceneRuntimeSummary) {
  const parsed = parseLiveOpsCampaignDraft(draftText || "{}");
  if (!parsed.ok || !parsed.campaign) {
    return {
      ok: false,
      error: parsed.error || "live_ops_campaign_invalid_json",
      campaign_key: "",
      segment_key: "",
      max_recipients: 0,
      gate: resolveLiveOpsSceneGate(asRecord(sceneRuntimeSummary), { targeting: { max_recipients: 50 } })
    };
  }

  const campaign = asRecord(parsed.campaign);
  const targeting = asRecord(campaign.targeting);
  return {
    ok: true,
    error: "",
    campaign_key: String(campaign.campaign_key || ""),
    segment_key: String(targeting.segment_key || ""),
    max_recipients: Math.max(0, Number(targeting.max_recipients || 0)),
    gate: resolveLiveOpsSceneGate(asRecord(sceneRuntimeSummary), campaign)
  };
}
