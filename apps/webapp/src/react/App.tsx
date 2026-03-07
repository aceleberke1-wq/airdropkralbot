import { useMemo, useRef, useState } from "react";
import { buildPvpSessionMachine } from "../core/player/pvpSessionMachine";
import {
  UI_EVENT_KEY,
  UI_FUNNEL_KEY,
  UI_SURFACE_KEY
} from "../core/telemetry/uiEventTaxonomy";
import { useReactShellStore } from "./store";
import type {
  BootstrapV2Payload,
  TabKey,
  WebAppApiResponse,
  WebAppAuth
} from "./types";
import { AdminWorkspace } from "./features/admin/AdminWorkspace";
import { useAdminQueueController } from "./features/admin/useAdminQueueController";
import { useAdminRuntimeController } from "./features/admin/useAdminRuntimeController";
import { OnboardingOverlay } from "./features/onboarding/OnboardingOverlay";
import { PlayerWorkspace } from "./features/player/PlayerWorkspace";
import { usePlayerRefreshController } from "./features/player/usePlayerRefreshController";
import { usePvpAutoRefresh } from "./features/pvp/usePvpAutoRefresh";
import { usePvpController } from "./features/pvp/usePvpController";
import { useRetriableAction } from "./features/shared/useRetriableAction";
import { useBootstrapRefreshController } from "./features/shell/useBootstrapRefreshController";
import { LaunchHandoffStrip } from "./features/shell/LaunchHandoffStrip";
import { MetaStrip } from "./features/shell/MetaStrip";
import { useLaunchFocusController } from "./features/shell/useLaunchFocusController";
import { usePlayerTabsController } from "./features/shell/usePlayerTabsController";
import { useShellDataSyncController } from "./features/shell/useShellDataSyncController";
import { useShellSessionPrefsController } from "./features/shell/useShellSessionPrefsController";
import { useShellTelemetryController } from "./features/shell/useShellTelemetryController";
import { useShellTopBarController } from "./features/shell/useShellTopBarController";
import { ShellStatus } from "./features/shell/ShellStatus";
import { TopBar } from "./features/shell/TopBar";
import { useTaskMutationRunner } from "./features/tasks/useTaskMutationRunner";
import { useTasksController } from "./features/tasks/useTasksController";
import { useVaultController } from "./features/vault/useVaultController";
import { useVaultRefreshController } from "./features/vault/useVaultRefreshController";
import {
  useActionAcceptV2Mutation,
  useActionClaimMissionV2Mutation,
  useActionCompleteV2Mutation,
  useActionRevealV2Mutation,
  useAdminAssetsReloadV2Mutation,
  useAdminAssetsStatusV2Query,
  useAdminAuditDataIntegrityV2Query,
  useAdminAuditPhaseStatusV2Query,
  useAdminBootstrapV2Query,
  useAdminDeployStatusV2Query,
  useAdminDynamicAutoPolicyUpsertV2Mutation,
  useAdminDynamicAutoPolicyV2Query,
  useAdminLiveOpsCampaignApprovalV2Mutation,
  useAdminLiveOpsCampaignDispatchV2Mutation,
  useAdminLiveOpsCampaignUpsertV2Mutation,
  useAdminLiveOpsCampaignV2Query,
  useAdminMetricsV2Query,
  useAdminOpsKpiLatestV2Query,
  useAdminOpsKpiRunV2Mutation,
  useAdminRuntimeBotReconcileV2Mutation,
  useAdminRuntimeBotV2Query,
  useAdminRuntimeFlagsUpdateV2Mutation,
  useAdminRuntimeFlagsV2Query,
  useAdminQueueActionV2Mutation,
  useAdminUnifiedQueueV2Query,
  useBootstrapV2Query,
  useHomeFeedV2Query,
  useLazyPvpDiagnosticsLiveV2Query,
  useLazyPvpLeaderboardLiveV2Query,
  useLazyPvpMatchTickV2Query,
  useLazyPvpSessionStateV2Query,
  useLazyTokenQuoteV2Query,
  useLeagueOverviewV2Query,
  useMonetizationOverviewV2Query,
  useMonetizationPassPurchaseV2Mutation,
  useMonetizationCosmeticPurchaseV2Mutation,
  usePatchUiPreferencesV2Mutation,
  usePayoutRequestV2Mutation,
  usePayoutStatusV2Query,
  usePvpSessionActionV2Mutation,
  usePvpSessionResolveV2Mutation,
  usePvpSessionStartV2Mutation,
  useTasksRerollV2Mutation,
  useTokenBuyIntentV2Mutation,
  useTokenSubmitTxV2Mutation,
  useWalletChallengeV2Mutation,
  useWalletSessionV2Query,
  useWalletUnlinkV2Mutation,
  useWalletVerifyV2Mutation,
  useVaultOverviewV2Query
} from "./redux/api/webappApi";
import "./styles.css";

type ReactWebAppV1Props = {
  auth: WebAppAuth;
  bootstrap: BootstrapV2Payload;
};

type QueueActionForm = {
  action_key: string;
  kind: string;
  request_id: string;
  tx_hash: string;
  reason: string;
  confirm_token: string;
};

function asError(payload: WebAppApiResponse | null | undefined, fallback = "request_failed"): string {
  return String(payload?.error || payload?.message || fallback);
}

export function ReactWebAppV1(props: ReactWebAppV1Props) {
  const pvpLiveRefreshInFlightRef = useRef(false);
  const {
    auth,
    data,
    tab,
    workspace,
    lang,
    advanced,
    loading,
    error,
    onboardingVisible,
    adminRuntime,
    pvpRuntime,
    navigationContext,
    navigationRequestKey,
    setBootstrap,
    patchData,
    setAuth,
    setTab,
    setWorkspace,
    setLang,
    toggleAdvanced,
    hideOnboarding,
    setLoading,
    setError,
    setAdminRuntime,
    setPvpRuntime
  } = useReactShellStore();

  const [taskResult, setTaskResult] = useState<any>(null);
  const [vaultData, setVaultData] = useState<any>({});
  const [quoteUsd, setQuoteUsd] = useState("10");
  const [quoteChain, setQuoteChain] = useState("TON");
  const [submitRequestId, setSubmitRequestId] = useState("");
  const [submitTxHash, setSubmitTxHash] = useState("");
  const [walletChain, setWalletChain] = useState("TON");
  const [walletAddress, setWalletAddress] = useState("");
  const [walletChallengeRef, setWalletChallengeRef] = useState("");
  const [walletSignature, setWalletSignature] = useState("");
  const [payoutCurrency, setPayoutCurrency] = useState("BTC");
  const [adminPanels, setAdminPanels] = useState<any>({});
  const [homeFeed, setHomeFeed] = useState<any>(null);
  const [leagueOverview, setLeagueOverview] = useState<any>(null);
  const [pvpLive, setPvpLive] = useState<any>({
    leaderboard: null,
    diagnostics: null,
    tick: null
  });
  const [dynamicPolicyTokenSymbol, setDynamicPolicyTokenSymbol] = useState("NXT");
  const [dynamicPolicyDraft, setDynamicPolicyDraft] = useState("[]");
  const [dynamicPolicyError, setDynamicPolicyError] = useState("");
  const [liveOpsCampaignDraft, setLiveOpsCampaignDraft] = useState("{}");
  const [liveOpsCampaignError, setLiveOpsCampaignError] = useState("");
  const [liveOpsCampaignApprovalError, setLiveOpsCampaignApprovalError] = useState("");
  const [liveOpsCampaignDispatchError, setLiveOpsCampaignDispatchError] = useState("");
  const [runtimeFlagsDraft, setRuntimeFlagsDraft] = useState("{}");
  const [runtimeFlagsError, setRuntimeFlagsError] = useState("");
  const [botReconcileDraft, setBotReconcileDraft] = useState('{"state_key":"","reason":"","force_stop":false}');
  const [botReconcileError, setBotReconcileError] = useState("");
  const [opsKpiRunError, setOpsKpiRunError] = useState("");
  const [queueAction, setQueueAction] = useState<QueueActionForm>({
    action_key: "payout_pay",
    kind: "payout_request",
    request_id: "",
    tx_hash: "",
    reason: "",
    confirm_token: ""
  });

  const isAdmin = Boolean(data?.admin?.is_admin);
  const tabs = useMemo<TabKey[]>(
    () => (Array.isArray(data?.ui_shell?.tabs) && data?.ui_shell?.tabs.length ? data.ui_shell.tabs : ["home", "pvp", "tasks", "vault"]),
    [data?.ui_shell?.tabs]
  );
  const activeAuth = useMemo<WebAppAuth>(() => {
    if (auth?.uid && auth?.ts && auth?.sig) {
      return auth;
    }
    return props.auth;
  }, [auth, props.auth]);
  const hasActiveAuth = Boolean(activeAuth.uid && activeAuth.ts && activeAuth.sig);
  const bootstrapQuery = useBootstrapV2Query(
    { auth: activeAuth, language: lang },
    { skip: !hasActiveAuth, refetchOnMountOrArgChange: true }
  );
  const homeFeedQuery = useHomeFeedV2Query({ auth: activeAuth }, { skip: !hasActiveAuth });
  const leagueOverviewQuery = useLeagueOverviewV2Query({ auth: activeAuth }, { skip: !hasActiveAuth });
  const vaultOverviewQuery = useVaultOverviewV2Query({ auth: activeAuth }, { skip: !hasActiveAuth });
  const monetizationOverviewQuery = useMonetizationOverviewV2Query({ auth: activeAuth }, { skip: !hasActiveAuth });
  const walletSessionQuery = useWalletSessionV2Query({ auth: activeAuth }, { skip: !hasActiveAuth });
  const payoutStatusQuery = usePayoutStatusV2Query({ auth: activeAuth }, { skip: !hasActiveAuth });
  const adminQueryEnabled = hasActiveAuth && workspace === "admin" && isAdmin;
  const adminBootstrapQuery = useAdminBootstrapV2Query({ auth: activeAuth }, { skip: !adminQueryEnabled });
  const adminQueueQuery = useAdminUnifiedQueueV2Query({ auth: activeAuth, limit: 80 }, { skip: !adminQueryEnabled });
  const adminMetricsQuery = useAdminMetricsV2Query({ auth: activeAuth }, { skip: !adminQueryEnabled });
  const adminLiveOpsCampaignQuery = useAdminLiveOpsCampaignV2Query({ auth: activeAuth }, { skip: !adminQueryEnabled });
  const adminOpsKpiLatestQuery = useAdminOpsKpiLatestV2Query({ auth: activeAuth }, { skip: !adminQueryEnabled });
  const adminAssetsQuery = useAdminAssetsStatusV2Query({ auth: activeAuth }, { skip: !adminQueryEnabled });
  const adminRuntimeFlagsQuery = useAdminRuntimeFlagsV2Query({ auth: activeAuth }, { skip: !adminQueryEnabled });
  const adminRuntimeBotQuery = useAdminRuntimeBotV2Query({ auth: activeAuth, limit: 40 }, { skip: !adminQueryEnabled });
  const adminDeployStatusQuery = useAdminDeployStatusV2Query({ auth: activeAuth }, { skip: !adminQueryEnabled });
  const adminAuditPhaseStatusQuery = useAdminAuditPhaseStatusV2Query({ auth: activeAuth }, { skip: !adminQueryEnabled });
  const adminAuditIntegrityQuery = useAdminAuditDataIntegrityV2Query({ auth: activeAuth }, { skip: !adminQueryEnabled });
  const adminDynamicPolicyQuery = useAdminDynamicAutoPolicyV2Query(
    {
      auth: activeAuth,
      token_symbol: String(dynamicPolicyTokenSymbol || "").trim().toUpperCase() || undefined
    },
    { skip: !adminQueryEnabled }
  );
  const [patchUiPreferences] = usePatchUiPreferencesV2Mutation();
  const [adminQueueAction] = useAdminQueueActionV2Mutation();
  const [adminLiveOpsCampaignUpsert, { isLoading: liveOpsCampaignSaving }] = useAdminLiveOpsCampaignUpsertV2Mutation();
  const [adminLiveOpsCampaignApproval, { isLoading: liveOpsCampaignApprovaling }] =
    useAdminLiveOpsCampaignApprovalV2Mutation();
  const [adminLiveOpsCampaignDispatch, { isLoading: liveOpsCampaignDispatching }] =
    useAdminLiveOpsCampaignDispatchV2Mutation();
  const [adminRuntimeFlagsUpdate, { isLoading: runtimeFlagsSaving }] = useAdminRuntimeFlagsUpdateV2Mutation();
  const [adminRuntimeBotReconcile, { isLoading: botReconcileSaving }] = useAdminRuntimeBotReconcileV2Mutation();
  const [adminAssetsReload, { isLoading: assetsReloading }] = useAdminAssetsReloadV2Mutation();
  const [adminDynamicPolicyUpsert, { isLoading: dynamicPolicySaving }] = useAdminDynamicAutoPolicyUpsertV2Mutation();
  const [adminOpsKpiRun, { isLoading: opsKpiRunning }] = useAdminOpsKpiRunV2Mutation();
  const [acceptAction] = useActionAcceptV2Mutation();
  const [completeAction] = useActionCompleteV2Mutation();
  const [revealAction] = useActionRevealV2Mutation();
  const [claimMissionAction] = useActionClaimMissionV2Mutation();
  const [tasksRerollAction] = useTasksRerollV2Mutation();
  const [pvpSessionStart] = usePvpSessionStartV2Mutation();
  const [pvpSessionAction] = usePvpSessionActionV2Mutation();
  const [pvpSessionResolve] = usePvpSessionResolveV2Mutation();
  const [loadPvpLeaderboardLive] = useLazyPvpLeaderboardLiveV2Query();
  const [loadPvpDiagnosticsLive] = useLazyPvpDiagnosticsLiveV2Query();
  const [loadPvpMatchTick] = useLazyPvpMatchTickV2Query();
  const [loadPvpSessionState] = useLazyPvpSessionStateV2Query();
  const [loadTokenQuote] = useLazyTokenQuoteV2Query();
  const [tokenBuyIntent] = useTokenBuyIntentV2Mutation();
  const [tokenSubmitTx] = useTokenSubmitTxV2Mutation();
  const [monetizationPassPurchase, { isLoading: passPurchaseLoading }] = useMonetizationPassPurchaseV2Mutation();
  const [monetizationCosmeticPurchase, { isLoading: cosmeticPurchaseLoading }] = useMonetizationCosmeticPurchaseV2Mutation();
  const [walletChallenge, { isLoading: walletChallengeLoading }] = useWalletChallengeV2Mutation();
  const [walletVerify, { isLoading: walletVerifyLoading }] = useWalletVerifyV2Mutation();
  const [walletUnlink, { isLoading: walletUnlinkLoading }] = useWalletUnlinkV2Mutation();
  const [payoutRequest, { isLoading: payoutRequestLoading }] = usePayoutRequestV2Mutation();
  const { adminPanelVisibility, ensureAdminPanelEnabled, applySession, syncPrefs } = useShellSessionPrefsController({
    adminPanelsRuntimeFlags: (adminPanels?.runtime_flags as Record<string, unknown> | null) || null,
    runtimeFlagsQueryData: (adminRuntimeFlagsQuery.data as WebAppApiResponse | null | undefined) || null,
    fallbackFeatureFlags:
      ((data as any)?.feature_flags as Record<string, unknown> | undefined) ||
      (((adminRuntime.summary as Record<string, unknown> | null)?.feature_flags as Record<string, unknown> | undefined) || null),
    setError,
    setAuth,
    hasActiveAuth,
    activeAuth,
    patchUiPreferences: patchUiPreferences as any,
    patchData
  });
  const { trackUiEvent } = useShellTelemetryController({
    activeAuth,
    lang,
    tab,
    workspace,
    data: (data as Record<string, any> | null | undefined) || null,
    launchContext: navigationContext
  });

  const { refreshBootstrap } = useBootstrapRefreshController({
    hasActiveAuth,
    workspace,
    bootstrapQuery,
    setLoading,
    setError,
    setBootstrap,
    trackUiEvent,
    asError
  });

  const {
    refreshAdmin,
    refreshDynamicPolicy,
    saveDynamicPolicy,
    refreshLiveOpsCampaign,
    saveLiveOpsCampaign,
    updateLiveOpsCampaignApproval,
    runLiveOpsCampaignDispatch,
    refreshRuntimeFlags,
    saveRuntimeFlags,
    refreshBotRuntime,
    runBotReconcile,
    refreshRuntimeMeta,
    refreshOpsKpi,
    runOpsKpiBundle,
    reloadAssets
  } = useAdminRuntimeController({
    adminQueryEnabled,
    activeAuth,
    dynamicPolicyTokenSymbol,
    dynamicPolicyDraft,
    liveOpsCampaignDraft,
    runtimeFlagsDraft,
    botReconcileDraft,
    setDynamicPolicyDraft,
    setDynamicPolicyError,
    setLiveOpsCampaignDraft,
    setLiveOpsCampaignError,
    setLiveOpsCampaignApprovalError,
    setLiveOpsCampaignDispatchError,
    setRuntimeFlagsDraft,
    setRuntimeFlagsError,
    setBotReconcileDraft,
    setBotReconcileError,
    setOpsKpiRunError,
    setAdminPanels,
    setAdminRuntime,
    setError,
    asError,
    ensureAdminPanelEnabled,
    trackUiEvent,
    applySession,
    adminBootstrapQuery,
    adminQueueQuery,
    adminMetricsQuery,
    adminLiveOpsCampaignQuery,
    adminOpsKpiLatestQuery,
    adminAssetsQuery,
    adminRuntimeFlagsQuery,
    adminRuntimeBotQuery,
    adminDeployStatusQuery,
    adminAuditPhaseStatusQuery,
    adminAuditIntegrityQuery,
    adminDynamicPolicyQuery,
    adminLiveOpsCampaignUpsert,
    adminLiveOpsCampaignApproval,
    adminLiveOpsCampaignDispatch,
    adminDynamicPolicyUpsert,
    adminRuntimeFlagsUpdate,
    adminRuntimeBotReconcile,
    adminOpsKpiRun,
    adminAssetsReload
  });

  const { refreshHome, refreshLeagueOverview, refreshPvpLive } = usePlayerRefreshController({
    hasActiveAuth,
    activeAuth,
    pvpRuntimeSession: (pvpRuntime.session as Record<string, unknown> | null) || null,
    pvpLiveRefreshInFlightRef,
    trackUiEvent,
    setError,
    asError,
    applySession,
    setHomeFeed,
    setLeagueOverview,
    setPvpLive,
    homeFeedQuery,
    leagueOverviewQuery,
    loadPvpLeaderboardLive,
    loadPvpDiagnosticsLive,
    loadPvpMatchTick
  });
  const { runRetriableApiCall } = useRetriableAction({
    trackUiEvent,
    setError,
    applySession,
    asError
  });
  const { runMutation } = useTaskMutationRunner({
    runRetriableApiCall,
    setLoading,
    setTaskResult,
    refreshBootstrap
  });
  const { refreshVault } = useVaultRefreshController({
    hasActiveAuth,
    activeAuth,
    trackUiEvent,
    applySession,
    setVaultData,
    vaultOverviewQuery,
    monetizationOverviewQuery,
    walletSessionQuery,
    payoutStatusQuery
  });
  useShellDataSyncController({
    propsAuth: props.auth,
    propsBootstrap: props.bootstrap,
    activeAuth,
    hasActiveAuth,
    workspace,
    tab,
    adminQueryEnabled,
    bootstrapQueryData: bootstrapQuery.data,
    homeFeedQueryData: homeFeedQuery.data,
    leagueOverviewQueryData: leagueOverviewQuery.data,
    vaultOverviewQueryData: vaultOverviewQuery.data,
    monetizationOverviewQueryData: monetizationOverviewQuery.data,
    walletSessionQueryData: walletSessionQuery.data,
    payoutStatusQueryData: payoutStatusQuery.data,
    adminBootstrapQueryData: adminBootstrapQuery.data,
    adminQueueQueryData: adminQueueQuery.data,
    adminMetricsQueryData: adminMetricsQuery.data,
    adminLiveOpsCampaignQueryData: adminLiveOpsCampaignQuery.data,
    adminOpsKpiLatestQueryData: adminOpsKpiLatestQuery.data,
    adminAssetsQueryData: adminAssetsQuery.data,
    adminRuntimeFlagsQueryData: adminRuntimeFlagsQuery.data,
    adminRuntimeBotQueryData: adminRuntimeBotQuery.data,
    adminDeployStatusQueryData: adminDeployStatusQuery.data,
    adminAuditPhaseStatusQueryData: adminAuditPhaseStatusQuery.data,
    adminAuditIntegrityQueryData: adminAuditIntegrityQuery.data,
    adminDynamicPolicyQueryData: adminDynamicPolicyQuery.data,
    setAuth,
    setBootstrap,
    setLoading,
    setError,
    setHomeFeed,
    setLeagueOverview,
    setVaultData,
    setAdminRuntime,
    setAdminPanels,
    setDynamicPolicyTokenSymbol,
    setDynamicPolicyDraft,
    setLiveOpsCampaignDraft,
    setRuntimeFlagsDraft,
    setBotReconcileDraft,
    refreshHome,
    refreshLeagueOverview,
    refreshPvpLive,
    refreshVault,
    asError
  });

  const { runQueueAction, patchQueueAction } = useAdminQueueController({
    hasActiveAuth,
    activeAuth,
    queueAction,
    setQueueAction: (updater) => setQueueAction(updater),
    setError,
    asError,
    ensureAdminPanelEnabled,
    trackUiEvent,
    adminQueueAction,
    refreshAdmin
  });

  const reducedMotion = Boolean(data?.ui_prefs?.reduced_motion);
  const largeText = Boolean(data?.ui_prefs?.large_text);
  const rootClassName = `akrReactRoot${reducedMotion ? " isReducedMotion" : ""}${largeText ? " isLargeText" : ""}`;
  const { launchSummary } = useLaunchFocusController({
    launchContext: navigationContext,
    workspace,
    tab,
    reducedMotion,
    requestKey: navigationRequestKey,
    enableFocus: false
  });
  const {
    onRefresh,
    onToggleAdvanced,
    onToggleReducedMotion,
    onToggleLargeText,
    onToggleLanguage,
    onToggleWorkspace
  } = useShellTopBarController({
    workspace,
    uiPrefs: (data?.ui_prefs as Record<string, unknown> | undefined) || null,
    patchData,
    trackUiEvent,
    syncPrefs,
    toggleAdvanced,
    setLang,
    setWorkspace,
    refreshBootstrap
  });
  const { onTabChange } = usePlayerTabsController({
    tab,
    setTab,
    trackUiEvent,
    syncPrefs
  });
  const pvpSessionMachine = useMemo(
    () =>
      buildPvpSessionMachine({
        pvpRuntime: (pvpRuntime.session as Record<string, unknown> | null) || null
      }),
    [pvpRuntime.session]
  );
  usePvpAutoRefresh({
    enabled: hasActiveAuth && workspace === "player" && tab === "pvp",
    sessionRef: String(pvpSessionMachine.session_ref || ""),
    refreshIntervalMs: Number(pvpSessionMachine.refresh_interval_ms || 9000),
    shouldRefreshNow: Boolean(pvpSessionMachine.should_refresh_now),
    authUid: String(activeAuth.uid || ""),
    authTs: String(activeAuth.ts || ""),
    authSig: String(activeAuth.sig || ""),
    onRefreshLive: (sessionRef) => refreshPvpLive(sessionRef),
    onRefreshLeague: () => refreshLeagueOverview()
  });
  const { handlePvpStart, handlePvpRefreshState, handlePvpStrike, handlePvpResolve } = usePvpController({
    machine: pvpSessionMachine,
    activeAuth,
    runRetriableApiCall,
    setError,
    setPvpRuntime,
    refreshPvpLive,
    pvpSessionStart,
    pvpSessionAction,
    pvpSessionResolve,
    loadPvpSessionState
  });
  const {
    handleTasksReroll,
    handleTaskComplete,
    handleTaskReveal,
    handleTaskAccept,
    handleMissionClaim
  } = useTasksController({
    activeAuth,
    runMutation,
    acceptAction,
    completeAction,
    revealAction,
    claimMissionAction,
    tasksRerollAction
  });
  const {
    handleTokenQuote,
    handleTokenBuyIntent,
    handleTokenSubmitTx,
    handleWalletChallenge,
    handleWalletVerify,
    handleWalletUnlink,
    handlePayoutRequest,
    handlePassPurchase,
    handleCosmeticPurchase
  } = useVaultController({
    activeAuth,
    quoteUsd,
    quoteChain,
    submitRequestId,
    submitTxHash,
    walletChain,
    walletAddress,
    walletChallengeRef,
    walletSignature,
    payoutCurrency,
    runRetriableApiCall,
    setError,
    setVaultData,
    setWalletChallengeRef,
    refreshVault,
    loadTokenQuote,
    tokenBuyIntent,
    tokenSubmitTx,
    walletChallenge,
    walletVerify,
    walletUnlink,
    payoutRequest,
    monetizationPassPurchase,
    monetizationCosmeticPurchase
  });

  return (
    <div className={rootClassName}>
      <div className="akrBgAura" />
      <TopBar
        lang={lang}
        advanced={advanced}
        reducedMotion={reducedMotion}
        largeText={largeText}
        workspace={workspace}
        onRefresh={onRefresh}
        onToggleAdvanced={onToggleAdvanced}
        onToggleReducedMotion={onToggleReducedMotion}
        onToggleLargeText={onToggleLargeText}
        onToggleLanguage={onToggleLanguage}
        onToggleWorkspace={onToggleWorkspace}
      />
      <MetaStrip lang={lang} variant={data?.experiment?.variant || ""} sessionRef={data?.analytics?.session_ref || ""} />
      {launchSummary ? (
        <LaunchHandoffStrip
          lang={lang}
          routeLabel={launchSummary.routeLabel}
          panelLabel={launchSummary.panelLabel}
          focusLabel={launchSummary.focusLabel}
        />
      ) : null}
      {workspace === "player" && (
        <PlayerWorkspace
          lang={lang}
          tab={tab}
          tabs={tabs}
          advanced={advanced}
          data={data}
          homeFeed={(homeFeed as Record<string, unknown> | null) || null}
          pvpRuntime={(pvpRuntime.session as Record<string, unknown> | null) || null}
          leagueOverview={(leagueOverview as Record<string, unknown> | null) || null}
          pvpLive={{
            leaderboard: (pvpLive?.leaderboard as Record<string, unknown> | null) || null,
            diagnostics: (pvpLive?.diagnostics as Record<string, unknown> | null) || null,
            tick: (pvpLive?.tick as Record<string, unknown> | null) || null
          }}
          pvpCapabilities={{
            canStart: pvpSessionMachine.can_start,
            canRefreshState: pvpSessionMachine.can_refresh_state,
            canStrike: pvpSessionMachine.can_strike,
            canResolve: pvpSessionMachine.can_resolve
          }}
          taskResult={(taskResult as Record<string, unknown> | null) || null}
          vaultData={(vaultData as Record<string, unknown> | null) || null}
          quoteUsd={quoteUsd}
          quoteChain={quoteChain}
          submitRequestId={submitRequestId}
          submitTxHash={submitTxHash}
          walletChain={walletChain}
          walletAddress={walletAddress}
          walletChallengeRef={walletChallengeRef}
          walletSignature={walletSignature}
          payoutCurrency={payoutCurrency}
          walletChallengeLoading={walletChallengeLoading}
          walletVerifyLoading={walletVerifyLoading}
          walletUnlinkLoading={walletUnlinkLoading}
          payoutRequestLoading={payoutRequestLoading}
          passPurchaseLoading={passPurchaseLoading}
          cosmeticPurchaseLoading={cosmeticPurchaseLoading}
          trackUiEvent={trackUiEvent}
          onTabChange={onTabChange}
          onToggleReducedMotion={onToggleReducedMotion}
          onToggleLargeText={onToggleLargeText}
          onToggleLanguage={onToggleLanguage}
          onRefreshHome={() => void refreshHome()}
          onPvpStart={() => void handlePvpStart()}
          onPvpRefreshState={() => void handlePvpRefreshState()}
          onPvpRefreshLeague={() => void refreshLeagueOverview()}
          onPvpRefreshLive={() => void refreshPvpLive()}
          onPvpStrike={() => void handlePvpStrike()}
          onPvpResolve={() => void handlePvpResolve()}
          onTasksReroll={() => void handleTasksReroll()}
          onTaskComplete={() => void handleTaskComplete()}
          onTaskReveal={() => void handleTaskReveal()}
          onTaskAccept={(offerId) => void handleTaskAccept(offerId)}
          onMissionClaim={(missionKey) => void handleMissionClaim(missionKey)}
          onVaultRefresh={() => void refreshVault()}
          onTokenQuote={() => void handleTokenQuote()}
          onTokenBuyIntent={() => void handleTokenBuyIntent()}
          onTokenSubmitTx={() => void handleTokenSubmitTx()}
          onWalletChallenge={() => void handleWalletChallenge()}
          onWalletVerify={() => void handleWalletVerify()}
          onWalletUnlink={() => void handleWalletUnlink()}
          onPayoutRequest={() => void handlePayoutRequest()}
          onPassPurchase={(passKey, paymentCurrency) => void handlePassPurchase(passKey, paymentCurrency)}
          onCosmeticPurchase={(itemKey, paymentCurrency) => void handleCosmeticPurchase(itemKey, paymentCurrency)}
          onQuoteUsdChange={setQuoteUsd}
          onQuoteChainChange={setQuoteChain}
          onSubmitRequestIdChange={setSubmitRequestId}
          onSubmitTxHashChange={setSubmitTxHash}
          onWalletChainChange={setWalletChain}
          onWalletAddressChange={setWalletAddress}
          onWalletChallengeRefChange={setWalletChallengeRef}
          onWalletSignatureChange={setWalletSignature}
          onPayoutCurrencyChange={setPayoutCurrency}
        />
      )}

      {workspace === "admin" && (
        <AdminWorkspace
          lang={lang}
          isAdmin={isAdmin}
          advanced={advanced}
          reducedMotion={reducedMotion}
          trackUiEvent={trackUiEvent}
          adminRuntime={adminRuntime}
          adminPanels={adminPanels}
          queueAction={queueAction}
          panelVisibility={adminPanelVisibility}
          dynamicPolicyData={(adminPanels?.dynamic_policy as Record<string, unknown> | null) || null}
          dynamicPolicyTokenSymbol={dynamicPolicyTokenSymbol}
          dynamicPolicyDraft={dynamicPolicyDraft}
          dynamicPolicyError={dynamicPolicyError}
          dynamicPolicySaving={dynamicPolicySaving}
          liveOpsCampaignData={(adminPanels?.live_ops_campaign as Record<string, unknown> | null) || null}
          liveOpsCampaignDispatchData={(adminPanels?.live_ops_campaign_dispatch as Record<string, unknown> | null) || null}
          liveOpsCampaignDraft={liveOpsCampaignDraft}
          liveOpsCampaignError={liveOpsCampaignError}
          liveOpsCampaignApprovalError={liveOpsCampaignApprovalError}
          liveOpsCampaignDispatchError={liveOpsCampaignDispatchError}
          liveOpsCampaignSaving={liveOpsCampaignSaving}
          liveOpsCampaignApprovaling={liveOpsCampaignApprovaling}
          liveOpsCampaignDispatching={liveOpsCampaignDispatching}
          runtimeFlagsData={(adminPanels?.runtime_flags as Record<string, unknown> | null) || null}
          runtimeFlagsDraft={runtimeFlagsDraft}
          runtimeFlagsError={runtimeFlagsError}
          runtimeFlagsSaving={runtimeFlagsSaving}
          botRuntimeData={(adminPanels?.runtime_bot as Record<string, unknown> | null) || null}
          botReconcileDraft={botReconcileDraft}
          botReconcileError={botReconcileError}
          botReconcileSaving={botReconcileSaving}
          metricsData={(adminPanels?.metrics as Record<string, unknown> | null) || null}
          opsKpiData={(adminPanels?.ops_kpi as Record<string, unknown> | null) || null}
          opsKpiRunData={(adminPanels?.ops_kpi_run as Record<string, unknown> | null) || null}
          opsKpiRunError={opsKpiRunError}
          opsKpiRunning={opsKpiRunning}
          deployStatusData={(adminPanels?.deploy_status as Record<string, unknown> | null) || null}
          assetsStatusData={(adminPanels?.assets as Record<string, unknown> | null) || null}
          assetsReloading={assetsReloading}
          auditPhaseStatusData={(adminPanels?.audit_phase_status as Record<string, unknown> | null) || null}
          auditIntegrityData={(adminPanels?.audit_data_integrity as Record<string, unknown> | null) || null}
          onQueueActionChange={patchQueueAction}
          onRefresh={() => void refreshAdmin()}
          onRunQueueAction={() => void runQueueAction()}
          onDynamicPolicyTokenSymbolChange={setDynamicPolicyTokenSymbol}
          onDynamicPolicyDraftChange={setDynamicPolicyDraft}
          onRefreshDynamicPolicy={() => void refreshDynamicPolicy()}
          onSaveDynamicPolicy={() => void saveDynamicPolicy()}
          onLiveOpsCampaignDraftChange={setLiveOpsCampaignDraft}
          onRefreshLiveOpsCampaign={() => void refreshLiveOpsCampaign()}
          onSaveLiveOpsCampaign={() => void saveLiveOpsCampaign()}
          onRequestLiveOpsCampaignApproval={() => void updateLiveOpsCampaignApproval("request")}
          onApproveLiveOpsCampaign={() => void updateLiveOpsCampaignApproval("approve")}
          onRevokeLiveOpsCampaignApproval={() => void updateLiveOpsCampaignApproval("revoke")}
          onDryRunLiveOpsCampaign={() => void runLiveOpsCampaignDispatch(true)}
          onDispatchLiveOpsCampaign={() => void runLiveOpsCampaignDispatch(false)}
          onRuntimeFlagsDraftChange={setRuntimeFlagsDraft}
          onRefreshRuntimeFlags={() => void refreshRuntimeFlags()}
          onSaveRuntimeFlags={() => void saveRuntimeFlags()}
          onBotReconcileDraftChange={setBotReconcileDraft}
          onRefreshBotRuntime={() => void refreshBotRuntime()}
          onRunBotReconcile={() => void runBotReconcile()}
          onRefreshRuntimeMeta={() => void refreshRuntimeMeta()}
          onRefreshOpsKpi={() => void refreshOpsKpi()}
          onRunOpsKpi={() => void runOpsKpiBundle()}
          onReloadAssets={() => void reloadAssets()}
        />
      )}

      <ShellStatus lang={lang} loading={loading} error={error} />

      {onboardingVisible && (
        <OnboardingOverlay
          lang={lang}
          onContinue={() => {
            trackUiEvent({
              event_key: UI_EVENT_KEY.ONBOARDING_COMPLETE,
              panel_key: UI_SURFACE_KEY.SHELL,
              funnel_key: UI_FUNNEL_KEY.ONBOARDING,
              surface_key: UI_SURFACE_KEY.SHELL,
              payload_json: {
                onboarding_version: String(data?.ui_shell?.onboarding_version || "v1")
              }
            });
            hideOnboarding();
            void syncPrefs({ onboarding_completed: true });
          }}
        />
      )}
    </div>
  );
}
