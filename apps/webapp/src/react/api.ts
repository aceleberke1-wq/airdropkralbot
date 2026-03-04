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
export {
  applyPvpSessionActionV2,
  fetchPvpSessionStateV2,
  resolvePvpSessionV2,
  startPvpSessionV2
} from "./api/pvpApi";
export {
  fetchTokenDecisionTracesV2,
  fetchTokenQuoteV2,
  fetchTokenRouteStatusV2,
  fetchTokenSummaryV2,
  postTokenBuyIntentV2,
  postTokenMintV2,
  postTokenSubmitTxV2
} from "./api/vaultApi";
export {
  fetchAdminAssetsStatusV2,
  fetchAdminAuditDataIntegrityV2,
  fetchAdminAuditPhaseStatusV2,
  fetchAdminBootstrapV2,
  fetchAdminDeployStatusV2,
  fetchAdminMetricsV2,
  fetchAdminRuntimeBotV2,
  fetchAdminRuntimeFlagsV2,
  fetchAdminUnifiedQueueV2,
  postAdminAssetsReloadV2,
  postAdminQueueActionV2,
  postAdminRuntimeBotReconcileV2,
  postAdminRuntimeFlagsV2
} from "./api/adminApi";
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
