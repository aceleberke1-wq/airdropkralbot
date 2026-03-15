import { Suspense, lazy, useCallback, useMemo, useRef, useState } from "react";
import { resolveAdminRouteHandoff } from "../core/admin/adminRouteHandoff.js";
import { resolveShellActionTarget } from "../core/navigation/shellActions.js";
import { resolvePlayerRouteHandoff } from "../core/player/playerRouteHandoff.js";
import { buildPvpSessionMachine } from "../core/player/pvpSessionMachine";
import {
  UI_EVENT_KEY,
  UI_FUNNEL_KEY,
  UI_SURFACE_KEY
} from "../core/telemetry/uiEventTaxonomy";
import { useAppDispatch } from "./redux/hooks";
import { useReactShellStore } from "./store";
import type {
  BootstrapV2Payload,
  LaunchContext,
  TabKey,
  WebAppApiResponse,
  WebAppAuth
} from "./types";
import { useAdminQueueController } from "./features/admin/useAdminQueueController";
import { useAdminRuntimeController } from "./features/admin/useAdminRuntimeController";
import { usePlayerRefreshController } from "./features/player/usePlayerRefreshController";
import { usePvpAutoRefresh } from "./features/pvp/usePvpAutoRefresh";
import { usePvpController } from "./features/pvp/usePvpController";
import { useRetriableAction } from "./features/shared/useRetriableAction";
import { useBootstrapRefreshController } from "./features/shell/useBootstrapRefreshController";
import { LaunchHandoffStrip } from "./features/shell/LaunchHandoffStrip";
import { MetaStrip } from "./features/shell/MetaStrip";
import { SceneBridgeDock } from "./features/shell/SceneBridgeDock";
import { SceneRuntimeStrip } from "./features/shell/SceneRuntimeStrip";
import { resolveShellSurfaceVisibility } from "./features/shell/shellSurfaceVisibility.js";
import { useSceneBridgeFeed } from "./features/shell/useSceneBridgeFeed";
import { useLaunchFocusController } from "./features/shell/useLaunchFocusController";
import { usePlayerTabsController } from "./features/shell/usePlayerTabsController";
import { useSceneRuntimeLoader } from "./features/shell/useSceneRuntimeLoader";
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
import { navigationActions, sceneActions } from "./redux/slices/shellSlices";
import "./styles.css";

const PlayerWorkspace = lazy(async () => {
  const mod = await import("./features/player/PlayerWorkspace");
  return { default: mod.PlayerWorkspace };
});

const AdminWorkspace = lazy(async () => {
  const mod = await import("./features/admin/AdminWorkspace");
  return { default: mod.AdminWorkspace };
});

const OnboardingOverlay = lazy(async () => {
  const mod = await import("./features/onboarding/OnboardingOverlay");
  return { default: mod.OnboardingOverlay };
});

const BabylonDistrictSceneHost = lazy(async () => {
  const mod = await import("./features/shell/BabylonDistrictSceneHost");
  return { default: mod.BabylonDistrictSceneHost };
});

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

function resolveWorkspaceFunnelKey(workspace: "player" | "admin", tab: TabKey) {
  if (workspace === "admin") {
    return UI_FUNNEL_KEY.ADMIN_OPS;
  }
  if (tab === "pvp") {
    return UI_FUNNEL_KEY.PVP_LOOP;
  }
  if (tab === "tasks") {
    return UI_FUNNEL_KEY.TASKS_LOOP;
  }
  if (tab === "vault") {
    return UI_FUNNEL_KEY.VAULT_LOOP;
  }
  return UI_FUNNEL_KEY.PLAYER_LOOP;
}

function WorkspaceLoadingFallback() {
  return (
    <main className="akrPanelGrid">
      <section className="akrCard akrCardWide">
        <p className="akrKicker">workspace</p>
        <h2>Loading interface</h2>
        <p className="akrMuted">Segmented shell is preparing the active surface.</p>
      </section>
    </main>
  );
}

export function ReactWebAppV1(props: ReactWebAppV1Props) {
  const dispatch = useAppDispatch();
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
    scene,
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
    launchContext: navigationContext,
    scene: {
      qualityMode: scene.qualityMode,
      effectiveQuality: scene.effectiveQuality,
      hudDensity: scene.hudDensity,
      reducedMotion: scene.reducedMotion,
      capabilityProfile: (scene.capabilityProfile as Record<string, unknown> | null) || null
    }
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

  const reducedMotion = Boolean(scene.reducedMotion);
  const largeText = Boolean(scene.largeText);
  const effectiveQuality = String(scene.effectiveQuality || "medium");
  const hudDensity = String(scene.hudDensity || "normal");
  const capabilityProfile = (scene.capabilityProfile as Record<string, unknown> | null) || null;
  const deviceClass = String(capabilityProfile?.device_class || "");
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
  const { sceneRuntime } = useSceneRuntimeLoader({
    workspace,
    tab,
    trackUiEvent,
    scene: {
      effectiveQuality: scene.effectiveQuality,
      capabilityProfile
    }
  });
  const shellSurfaceVisibility = resolveShellSurfaceVisibility({
    workspace,
    advanced,
    hudDensity,
    deviceClass,
    sceneRuntimePhase: sceneRuntime.phase,
    sceneRuntimeError: sceneRuntime.error,
    hasLaunchSummary: Boolean(launchSummary)
  });
  const rootClassName = `akrReactRoot${reducedMotion ? " isReducedMotion" : ""}${largeText ? " isLargeText" : ""}${
    hudDensity === "compact" ? " isCompactHud" : ""
  }${effectiveQuality === "low" ? " isQualityLow" : effectiveQuality === "high" ? " isQualityHigh" : " isQualityMedium"}${
    shellSurfaceVisibility.sceneChromeMode === "backdrop" ? " isBackdropScene" : ""
  }`;
  const handleDistrictNodeAction = useCallback(
    (payload: {
      actionKey: string;
      nodeKey: string;
      laneKey: string;
      label: string;
      labelKey?: string;
      familyKey?: string;
      flowKey?: string;
      microflowKey?: string;
      focusKey?: string;
      riskKey?: string;
      riskFocusKey?: string;
      actionContextSignature?: string;
      riskContextSignature?: string;
      actionContext?: Record<string, unknown> | null;
      riskContext?: Record<string, unknown> | null;
      riskHealthBandKey?: string;
      riskAttentionBandKey?: string;
      riskTrendDirectionKey?: string;
      entryKindKey?: string;
      sequenceKindKey?: string;
      sourceType?: string;
      actorKey?: string;
      interactionKind?: string;
      clusterKey?: string;
      isSecondary?: boolean;
      workspace: "player" | "admin";
      tab: TabKey;
      districtKey: string;
    }) => {
      const actionKey = String(payload.actionKey || "").trim();
      const target = resolveShellActionTarget(actionKey);
      if (!target) {
        return;
      }
      if (target.workspace === "admin" && !isAdmin) {
        return;
      }

      let launchContext: LaunchContext;
      let nextTab: TabKey = tab;

      if (target.workspace === "admin") {
        setWorkspace("admin");
        launchContext = resolveAdminRouteHandoff({
          routeKey: target.route_key,
          panelKey: target.panel_key,
          focusKey: target.focus_key,
          actionKey: target.action_key
        }) as LaunchContext;
      } else {
        launchContext = resolvePlayerRouteHandoff({
          routeKey: target.route_key,
          panelKey: target.panel_key,
          focusKey: target.focus_key,
          actionKey: target.action_key
        }) as LaunchContext;
        nextTab = (launchContext.tab || "home") as TabKey;
        setWorkspace("player");
        if (nextTab !== tab) {
          setTab(nextTab);
        }
      }

      dispatch(navigationActions.routeLaunchContext(launchContext));
      trackUiEvent({
        event_key: UI_EVENT_KEY.PANEL_OPEN,
        tab_key: nextTab,
        panel_key: String(launchContext.panel_key || UI_SURFACE_KEY.SHELL),
        route_key: String(launchContext.route_key || ""),
        focus_key: String(launchContext.focus_key || ""),
        funnel_key: resolveWorkspaceFunnelKey(target.workspace as "player" | "admin", nextTab),
        surface_key: UI_SURFACE_KEY.SHELL,
      payload_json: {
          source: String(payload.sourceType || "district_scene_node"),
          source_panel_key: "scene_world",
          shell_action_key: String(launchContext.shell_action_key || actionKey),
          action_key: String(launchContext.shell_action_key || actionKey),
          source_workspace: payload.workspace,
          source_tab: payload.tab,
          source_district_key: payload.districtKey,
          node_key: payload.nodeKey,
          lane_key: payload.laneKey,
          actor_key: String(payload.actorKey || ""),
          cluster_key: String(payload.clusterKey || ""),
          interaction_kind: String(payload.interactionKind || "open"),
          is_secondary: Boolean(payload.isSecondary),
          source_family_key: String(payload.familyKey || ""),
          source_flow_key: String(payload.flowKey || ""),
          source_microflow_key: String(payload.microflowKey || ""),
          source_focus_key: String(payload.focusKey || ""),
          source_risk_key: String(payload.riskKey || ""),
          source_risk_focus_key: String(payload.riskFocusKey || ""),
          source_action_context_signature: String(payload.actionContextSignature || ""),
          source_risk_context_signature: String(payload.riskContextSignature || ""),
          source_action_context: payload.actionContext || null,
          source_risk_context: payload.riskContext || null,
          source_risk_health_band_key: String(payload.riskHealthBandKey || ""),
          source_risk_attention_band_key: String(payload.riskAttentionBandKey || ""),
          source_risk_trend_direction_key: String(payload.riskTrendDirectionKey || ""),
          source_entry_kind_key: String(payload.entryKindKey || ""),
          source_sequence_kind_key: String(payload.sequenceKindKey || ""),
          node_label: payload.label,
          node_label_key: String(payload.labelKey || ""),
          target_workspace: target.workspace,
          target_tab: nextTab,
          target_panel_key: String(launchContext.panel_key || ""),
          target_focus_key: String(launchContext.focus_key || "")
        }
      });
    },
    [dispatch, isAdmin, setTab, setWorkspace, tab, trackUiEvent]
  );
  const handleDistrictLoopStateChange = useCallback(
    (payload:
      | {
      districtKey: string;
      workspace: "player" | "admin";
      tab: "home" | "pvp" | "tasks" | "vault";
      protocolCardKey: string;
      protocolPodKey: string;
      microflowKey: string;
      focusKey?: string;
      riskKey?: string;
      riskFocusKey?: string;
      actionContextSignature?: string;
      riskContextSignature?: string;
      actionContext?: Record<string, unknown> | null;
      riskContext?: Record<string, unknown> | null;
      entryKindKey: string;
      sequenceKindKey: string;
      loopStatusKey: string;
      loopStatusLabelKey?: string;
      loopStageValue: string;
      directorPaceLabelKey?: string;
      hudToneLabelKey?: string;
      personalityKey?: string;
      personalityLabelKey?: string;
      personalityCaptionKey?: string;
      personalityBandKey?: string;
      densityLabelKey?: string;
      loopRows?: Array<{ label_key: string; value: string; status_key: string }>;
      loopSignalRows?: Array<{ label_key: string; value: string; status_key: string }>;
      sequenceRows?: Array<{ label_key: string; value: string; status_key: string }>;
      actorKey?: string;
      clusterKey?: string;
      hotspotKey?: string;
      sourceType: string;
    }
      | null) => {
      dispatch(sceneActions.setSelectedLoop(payload || null));
      if (!payload) {
        return;
      }
      const nextTab = payload.workspace === "admin" ? "home" : payload.tab;
      trackUiEvent({
        event_key: UI_EVENT_KEY.SCENE_RUNTIME_LOOP,
        tab_key: payload.workspace === "admin" ? "admin" : nextTab,
        panel_key: payload.workspace === "admin" ? UI_SURFACE_KEY.PANEL_ADMIN : UI_SURFACE_KEY.SHELL,
        route_key: payload.workspace === "admin" ? "admin.home" : `player.${nextTab}`,
        focus_key: payload.focusKey || payload.microflowKey,
        funnel_key: resolveWorkspaceFunnelKey(payload.workspace, nextTab),
        surface_key: "scene_world",
        payload_json: {
          source: payload.sourceType,
          source_panel_key: "scene_world",
          district_key: payload.districtKey,
          protocol_card_key: payload.protocolCardKey,
          protocol_pod_key: payload.protocolPodKey,
          microflow_key: payload.microflowKey,
          focus_key: String(payload.focusKey || ""),
          risk_key: String(payload.riskKey || ""),
          risk_focus_key: String(payload.riskFocusKey || ""),
          action_context_signature: String(payload.actionContextSignature || ""),
          risk_context_signature: String(payload.riskContextSignature || ""),
          action_context: payload.actionContext || null,
          risk_context: payload.riskContext || null,
          entry_kind_key: payload.entryKindKey,
          sequence_kind_key: payload.sequenceKindKey,
          loop_status_key: payload.loopStatusKey,
          loop_status_label_key: String(payload.loopStatusLabelKey || ""),
          loop_stage_value: payload.loopStageValue,
          director_pace_label_key: String(payload.directorPaceLabelKey || ""),
          hud_tone_label_key: String(payload.hudToneLabelKey || ""),
          personality_key: String(payload.personalityKey || ""),
          personality_label_key: String(payload.personalityLabelKey || ""),
          personality_caption_key: String(payload.personalityCaptionKey || ""),
          personality_band_key: String(payload.personalityBandKey || ""),
          density_label_key: String(payload.densityLabelKey || ""),
          actor_key: String(payload.actorKey || ""),
          cluster_key: String(payload.clusterKey || ""),
          hotspot_key: String(payload.hotspotKey || ""),
          workspace: payload.workspace,
          tab: payload.tab
        },
        event_value: 1
      });
    },
    [dispatch, trackUiEvent]
  );
  const pvpLiveState = useMemo(
    () => ({
      leaderboard: (pvpLive?.leaderboard as Record<string, unknown> | null) || null,
      diagnostics: (pvpLive?.diagnostics as Record<string, unknown> | null) || null,
      tick: (pvpLive?.tick as Record<string, unknown> | null) || null
    }),
    [pvpLive?.diagnostics, pvpLive?.leaderboard, pvpLive?.tick]
  );
  const adminRuntimeState = useMemo(
    () => ({
      summary: (adminRuntime.summary as Record<string, unknown> | null) || null,
      queue: Array.isArray(adminRuntime.queue) ? (adminRuntime.queue as Array<Record<string, unknown>>) : []
    }),
    [adminRuntime.queue, adminRuntime.summary]
  );
  const bridgeDockEnabled = advanced || workspace === "admin";
  useSceneBridgeFeed({
    enabled: bridgeDockEnabled,
    workspace,
    tab,
    scene: (scene as Record<string, unknown>) || {},
    sceneRuntime: (sceneRuntime as Record<string, unknown>) || {},
    data: (data as Record<string, unknown> | null) || null,
    homeFeed: (homeFeed as Record<string, unknown> | null) || null,
    taskResult: (taskResult as Record<string, unknown> | null) || null,
    pvpRuntime: (pvpRuntime.session as Record<string, unknown> | null) || null,
    leagueOverview: (leagueOverview as Record<string, unknown> | null) || null,
    pvpLive: pvpLiveState,
    vaultData: (vaultData as Record<string, unknown> | null) || null,
    adminRuntime: adminRuntimeState,
    adminPanels: (adminPanels as Record<string, unknown> | null) || null
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
  const hidePlayerShellForOnboarding = onboardingVisible && workspace === "player";

  return (
    <div className={rootClassName}>
      <div className="akrBgAura" />
      <Suspense fallback={null}>
        <BabylonDistrictSceneHost
          lang={lang}
          workspace={workspace}
          tab={tab}
          sceneChromeMode={shellSurfaceVisibility.sceneChromeMode as "full" | "backdrop"}
          navigationContext={(navigationContext as Record<string, unknown> | null) || null}
          scene={(scene as Record<string, unknown>) || {}}
          sceneRuntime={(sceneRuntime as Record<string, unknown>) || {}}
          data={(data as Record<string, unknown> | null) || null}
          homeFeed={(homeFeed as Record<string, unknown> | null) || null}
          taskResult={(taskResult as Record<string, unknown> | null) || null}
          pvpRuntime={(pvpRuntime.session as Record<string, unknown> | null) || null}
          leagueOverview={(leagueOverview as Record<string, unknown> | null) || null}
          pvpLive={pvpLiveState}
          vaultData={(vaultData as Record<string, unknown> | null) || null}
          adminRuntime={adminRuntimeState}
          onNodeAction={handleDistrictNodeAction}
          onLoopStateChange={handleDistrictLoopStateChange}
        />
      </Suspense>
      {!hidePlayerShellForOnboarding ? (
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
      ) : null}
      {!hidePlayerShellForOnboarding && shellSurfaceVisibility.showMetaStrip ? (
        <MetaStrip
          lang={lang}
          variant={data?.experiment?.variant || ""}
          sessionRef={data?.analytics?.session_ref || ""}
          qualityMode={scene.qualityMode}
          effectiveQuality={scene.effectiveQuality}
          perfTier={String(capabilityProfile?.perf_tier || "-")}
          deviceClass={String(capabilityProfile?.device_class || "-")}
          sceneProfile={String(capabilityProfile?.scene_profile || "-")}
        />
      ) : null}
      {!hidePlayerShellForOnboarding && shellSurfaceVisibility.showSceneRuntimeStrip ? (
        <SceneRuntimeStrip
          lang={lang}
          phase={sceneRuntime.phase}
          districtKey={sceneRuntime.districtKey}
          profileKey={sceneRuntime.profileKey}
          effectiveQuality={sceneRuntime.effectiveQuality}
          lowEndMode={sceneRuntime.lowEndMode}
          loadedBundles={sceneRuntime.loadedBundles}
          skippedBundles={sceneRuntime.skippedBundles}
          error={sceneRuntime.error}
        />
      ) : null}
      {!hidePlayerShellForOnboarding && shellSurfaceVisibility.showLaunchHandoffStrip && launchSummary ? (
        <LaunchHandoffStrip
          lang={lang}
          routeLabel={launchSummary.routeLabel}
          panelLabel={launchSummary.panelLabel}
          focusLabel={launchSummary.focusLabel}
        />
      ) : null}
      {!hidePlayerShellForOnboarding && shellSurfaceVisibility.showSceneBridgeDock ? (
        <SceneBridgeDock lang={lang} workspace={workspace} tab={tab} advanced={advanced} />
      ) : null}
      <Suspense fallback={<WorkspaceLoadingFallback />}>
        {workspace === "player" && !hidePlayerShellForOnboarding && (
          <PlayerWorkspace
            lang={lang}
            tab={tab}
            tabs={tabs}
            advanced={advanced}
            reducedMotion={reducedMotion}
            sceneProfile={{
              qualityMode: scene.qualityMode,
              effectiveQuality: scene.effectiveQuality,
              hudDensity,
              perfTier: String(capabilityProfile?.perf_tier || "-"),
              deviceClass: String(capabilityProfile?.device_class || "-"),
              sceneProfile: String(capabilityProfile?.scene_profile || "-")
            }}
            data={data}
            homeFeed={(homeFeed as Record<string, unknown> | null) || null}
            pvpRuntime={(pvpRuntime.session as Record<string, unknown> | null) || null}
            leagueOverview={(leagueOverview as Record<string, unknown> | null) || null}
            pvpLive={pvpLiveState}
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
      </Suspense>

      <ShellStatus lang={lang} loading={loading} error={error} />

      {onboardingVisible && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}
    </div>
  );
}
