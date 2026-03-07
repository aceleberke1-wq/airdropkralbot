export { buildActionRequestId, normalizeApiLang, readWebAppAuth } from "./api/common";
export {
  fetchBootstrapV2,
  normalizeLanguageInput,
  postAcceptActionV2,
  postClaimMissionV2,
  postCompleteActionV2,
  postRevealActionV2,
  postTasksRerollV2
} from "./api/playerApi";
export { fetchHomeFeedV2 } from "./api/homeApi";
export {
  fetchPvpDiagnosticsLiveV2,
  fetchPvpLeaderboardLiveV2,
  fetchPvpLeagueOverviewV2,
  fetchPvpMatchTickV2
} from "./api/leagueApi";
export {
  applyPvpSessionActionV2,
  fetchPvpSessionStateV2,
  resolvePvpSessionV2,
  startPvpSessionV2
} from "./api/pvpApi";
export {
  fetchVaultOverviewV2,
  fetchTokenDecisionTracesV2,
  fetchTokenQuoteV2,
  fetchTokenRouteStatusV2,
  fetchTokenSummaryV2,
  postTokenBuyIntentV2,
  postTokenMintV2,
  postTokenSubmitTxV2
} from "./api/vaultApi";
export {
  fetchWalletSessionV2,
  postWalletChallengeV2,
  postWalletUnlinkV2,
  postWalletVerifyV2
} from "./api/walletApi";
export { fetchPayoutStatusV2, postPayoutRequestV2 } from "./api/payoutApi";
export {
  fetchMonetizationCatalogV2,
  fetchMonetizationOverviewV2,
  fetchMonetizationStatusV2,
  postCosmeticPurchaseV2,
  postPassPurchaseV2
} from "./api/monetizationApi";
export {
  fetchAdminAssetsStatusV2,
  fetchAdminAuditDataIntegrityV2,
  fetchAdminAuditPhaseStatusV2,
  fetchAdminBootstrapV2,
  fetchAdminDeployStatusV2,
  fetchAdminLiveOpsCampaignV2,
  fetchAdminMetricsV2,
  fetchAdminRuntimeBotV2,
  fetchAdminRuntimeFlagsV2,
  fetchAdminUnifiedQueueV2,
  postAdminAssetsReloadV2,
  postAdminLiveOpsCampaignApprovalV2,
  postAdminLiveOpsCampaignDispatchV2,
  postAdminLiveOpsCampaignV2,
  postAdminQueueActionV2,
  postAdminRuntimeBotReconcileV2,
  postAdminRuntimeFlagsV2
} from "./api/adminApi";
export { fetchAdminDynamicAutoPolicyV2, postAdminDynamicAutoPolicyV2 } from "./api/adminPolicyApi";
export { fetchUiPreferencesV2, postUiPreferencesV2 } from "./api/prefsApi";
export { postUiEventsBatch } from "./api/telemetryApi";

import type { WebAppAuth } from "./types";
import { fetchPvpSessionStateV2, startPvpSessionV2 } from "./api/pvpApi";

// Compatibility exports used by existing shell code.
export async function startPvpSession(auth: WebAppAuth): Promise<any> {
  return startPvpSessionV2(auth, {});
}

// Compatibility exports used by existing shell code.
export async function fetchPvpSessionState(auth: WebAppAuth): Promise<any> {
  return fetchPvpSessionStateV2(auth);
}
