import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchTokenRouteStatusV2,
  fetchTokenSummaryV2,
} from "./api";
import { buildPvpSessionMachine } from "../core/player/pvpSessionMachine";
import { resolveAdminPanelVisibility } from "../core/admin/adminPanelSwitches";
import {
  buildRouteKey,
  buildUiEventRecord,
  UI_EVENT_KEY,
  UI_FUNNEL_KEY,
  UI_SURFACE_KEY
} from "../core/telemetry/uiEventTaxonomy";
import { createUiAnalyticsClient, type UiAnalyticsClient } from "./analytics";
import { normalizeLang } from "./i18n";
import { useReactShellStore } from "./store";
import type {
  AnalyticsConfig,
  BootstrapV2Payload,
  TabKey,
  UiPreferencesPatch,
  WebAppApiResponse,
  WebAppAuth
} from "./types";
import { AdminPanel } from "./features/admin/AdminPanel";
import { useAdminQueueController } from "./features/admin/useAdminQueueController";
import { useAdminRuntimeController } from "./features/admin/useAdminRuntimeController";
import { HomePanel } from "./features/home/HomePanel";
import { OnboardingOverlay } from "./features/onboarding/OnboardingOverlay";
import { usePlayerRefreshController } from "./features/player/usePlayerRefreshController";
import { PvpPanel } from "./features/pvp/PvpPanel";
import { usePvpAutoRefresh } from "./features/pvp/usePvpAutoRefresh";
import { usePvpController } from "./features/pvp/usePvpController";
import { useRetriableAction } from "./features/shared/useRetriableAction";
import { MetaStrip } from "./features/shell/MetaStrip";
import { PlayerTabs } from "./features/shell/PlayerTabs";
import { ShellStatus } from "./features/shell/ShellStatus";
import { TopBar } from "./features/shell/TopBar";
import { TasksPanel } from "./features/tasks/TasksPanel";
import { useTasksController } from "./features/tasks/useTasksController";
import { VaultPanel } from "./features/vault/VaultPanel";
import { useVaultController } from "./features/vault/useVaultController";
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

function resolveAnalyticsConfig(raw: unknown): AnalyticsConfig | null {
  const row = raw && typeof raw === "object" ? (raw as Partial<AnalyticsConfig>) : null;
  const sessionRef = String(row?.session_ref || "").trim();
  if (!sessionRef) return null;
  return {
    session_ref: sessionRef,
    flush_interval_ms: Math.max(1000, Number(row?.flush_interval_ms || 6000)),
    max_batch_size: Math.max(1, Number(row?.max_batch_size || 40)),
    sample_rate: Math.max(0, Math.min(1, Number(row?.sample_rate || 1)))
  };
}

function asError(payload: WebAppApiResponse | null | undefined, fallback = "request_failed"): string {
  return String(payload?.error || payload?.message || fallback);
}

export function ReactWebAppV1(props: ReactWebAppV1Props) {
  const analyticsRef = useRef<UiAnalyticsClient | null>(null);
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
  const adminPanelVisibility = useMemo(
    () =>
      resolveAdminPanelVisibility({
        runtimeFlags:
          (adminPanels?.runtime_flags as Record<string, unknown> | null) ||
          ((adminRuntimeFlagsQuery.data as WebAppApiResponse | undefined)?.data as Record<string, unknown> | null) ||
          null,
        fallbackFlags:
          (data as any)?.feature_flags ||
          ((adminRuntime.summary as Record<string, unknown> | null)?.feature_flags as Record<string, unknown> | undefined) ||
          null
      }),
    [adminPanels?.runtime_flags, adminRuntimeFlagsQuery.data, data, adminRuntime.summary]
  );

  const ensureAdminPanelEnabled = (
    panelKey: "queue" | "dynamicPolicy" | "runtimeFlags" | "runtimeBot" | "runtimeMeta"
  ): boolean => {
    if (adminPanelVisibility[panelKey]) {
      return true;
    }
    setError("admin_panel_disabled_by_flag");
    return false;
  };

  const applySession = (payload: any) => {
    if (payload?.session?.uid && payload?.session?.ts && payload?.session?.sig) {
      setAuth({
        uid: String(payload.session.uid),
        ts: String(payload.session.ts),
        sig: String(payload.session.sig)
      });
    }
  };

  const syncPrefs = async (patch: Record<string, unknown>) => {
    if (!hasActiveAuth) return;
    const res = await patchUiPreferences({
      auth: activeAuth,
      patch: patch as UiPreferencesPatch
    })
      .unwrap()
      .catch(() => null);
    if (!res?.success || !res.data?.ui_preferences) return;
    patchData({ ui_prefs: res.data.ui_preferences });
  };

  const resolveTelemetryTabKey = (): string => (workspace === "admin" ? "admin" : tab);
  const resolveTelemetryRouteKey = (): string => buildRouteKey(workspace, resolveTelemetryTabKey());
  const trackUiEvent = (row: Record<string, unknown>) => {
    if (!analyticsRef.current) return;
    analyticsRef.current.track(
      buildUiEventRecord({
        tab_key: resolveTelemetryTabKey(),
        route_key: resolveTelemetryRouteKey(),
        ...row
      })
    );
  };

  useEffect(() => {
    setAuth(props.auth);
    if (props.bootstrap?.success && props.bootstrap.data) {
      setBootstrap(props.bootstrap.data);
    } else {
      setLoading(false);
      setError(String(props.bootstrap?.error || "bootstrap_failed"));
    }
  }, [props.auth, props.bootstrap, setAuth, setBootstrap, setError, setLoading]);

  useEffect(() => {
    const payload = bootstrapQuery.data;
    if (!payload) return;
    if (!payload.success || !payload.data) {
      setLoading(false);
      setError(asError(payload, "bootstrap_failed"));
      return;
    }
    setBootstrap(payload.data);
  }, [bootstrapQuery.data, setBootstrap, setError, setLoading]);

  useEffect(() => {
    const payload = homeFeedQuery.data;
    if (!payload?.success) return;
    setHomeFeed(payload.data || null);
  }, [homeFeedQuery.data]);

  useEffect(() => {
    const payload = leagueOverviewQuery.data;
    if (!payload?.success) return;
    setLeagueOverview(payload.data || null);
  }, [leagueOverviewQuery.data]);

  useEffect(() => {
    if (!vaultOverviewQuery.data && !monetizationOverviewQuery.data && !walletSessionQuery.data && !payoutStatusQuery.data) return;
    setVaultData((prev: any) => ({
      ...prev,
      ...(vaultOverviewQuery.data?.success ? { overview: vaultOverviewQuery.data.data || null } : {}),
      ...(monetizationOverviewQuery.data?.success ? { monetization: monetizationOverviewQuery.data.data || null } : {}),
      ...(walletSessionQuery.data?.success ? { wallet: walletSessionQuery.data.data || null } : {}),
      ...(payoutStatusQuery.data?.success ? { payout: payoutStatusQuery.data.data || null } : {})
    }));
  }, [vaultOverviewQuery.data, monetizationOverviewQuery.data, walletSessionQuery.data, payoutStatusQuery.data]);

  useEffect(() => {
    if (!adminQueryEnabled) return;
    if (!adminBootstrapQuery.data && !adminQueueQuery.data) return;
    const summary = adminBootstrapQuery.data?.success ? adminBootstrapQuery.data.data || null : null;
    const queueItems = adminQueueQuery.data?.success
      ? ((adminQueueQuery.data.data as { items?: Array<Record<string, unknown>> } | undefined)?.items || [])
      : [];
    setAdminRuntime(summary, Array.isArray(queueItems) ? queueItems : []);
  }, [adminQueryEnabled, adminBootstrapQuery.data, adminQueueQuery.data, setAdminRuntime]);

  useEffect(() => {
    if (!adminQueryEnabled) return;
    if (!adminMetricsQuery.data && !adminAssetsQuery.data && !adminOpsKpiLatestQuery.data) return;
    setAdminPanels((prev: any) => ({
      ...(prev || {}),
      ...(adminMetricsQuery.data?.success ? { metrics: adminMetricsQuery.data.data || null } : {}),
      ...(adminOpsKpiLatestQuery.data?.success ? { ops_kpi: adminOpsKpiLatestQuery.data.data || null } : {}),
      ...(adminAssetsQuery.data?.success ? { assets: adminAssetsQuery.data.data || null } : {})
    }));
  }, [adminQueryEnabled, adminMetricsQuery.data, adminOpsKpiLatestQuery.data, adminAssetsQuery.data]);

  useEffect(() => {
    if (!adminQueryEnabled) return;
    const payload = adminDynamicPolicyQuery.data;
    if (!payload?.success) return;
    const tokenSymbol = String((payload.data as { token_symbol?: string } | undefined)?.token_symbol || "")
      .trim()
      .toUpperCase();
    if (tokenSymbol) {
      setDynamicPolicyTokenSymbol(tokenSymbol);
    }
    const segments = Array.isArray((payload.data as { segments?: Array<Record<string, unknown>> } | undefined)?.segments)
      ? ((payload.data as { segments?: Array<Record<string, unknown>> }).segments as Array<Record<string, unknown>>)
      : [];
    setDynamicPolicyDraft((prev) => (String(prev || "").trim() ? prev : JSON.stringify(segments, null, 2)));
    setAdminPanels((prev: any) => ({
      ...(prev || {}),
      dynamic_policy: payload.data || null
    }));
  }, [adminQueryEnabled, adminDynamicPolicyQuery.data]);

  useEffect(() => {
    if (!adminQueryEnabled) return;
    const payload = adminRuntimeFlagsQuery.data;
    if (!payload?.success) return;
    const flagsPayload = (payload.data as { flags?: Record<string, unknown> } | undefined)?.flags || {};
    const boolFlags = Object.fromEntries(
      Object.entries(flagsPayload).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean")
    );
    setRuntimeFlagsDraft((prev) => {
      const current = String(prev || "").trim();
      if (current && current !== "{}") {
        return prev;
      }
      return JSON.stringify(boolFlags, null, 2);
    });
    setAdminPanels((prev: any) => ({
      ...(prev || {}),
      runtime_flags: payload.data || null
    }));
  }, [adminQueryEnabled, adminRuntimeFlagsQuery.data]);

  useEffect(() => {
    if (!adminQueryEnabled) return;
    const payload = adminRuntimeBotQuery.data;
    if (!payload?.success) return;
    const fallbackStateKey = String((payload.data as { latest?: { state_key?: string } } | undefined)?.latest?.state_key || "");
    if (fallbackStateKey) {
      setBotReconcileDraft((prev) => {
        const current = String(prev || "").trim();
        if (!current || current === '{"state_key":"","reason":"","force_stop":false}') {
          return JSON.stringify({ state_key: fallbackStateKey, reason: "", force_stop: false }, null, 2);
        }
        return prev;
      });
    }
    setAdminPanels((prev: any) => ({
      ...(prev || {}),
      runtime_bot: payload.data || null
    }));
  }, [adminQueryEnabled, adminRuntimeBotQuery.data]);

  useEffect(() => {
    if (!adminQueryEnabled) return;
    setAdminPanels((prev: any) => ({
      ...(prev || {}),
      deploy_status: adminDeployStatusQuery.data?.success ? adminDeployStatusQuery.data.data || null : prev?.deploy_status || null,
      audit_phase_status: adminAuditPhaseStatusQuery.data?.success
        ? adminAuditPhaseStatusQuery.data.data || null
        : prev?.audit_phase_status || null,
      audit_data_integrity: adminAuditIntegrityQuery.data?.success
        ? adminAuditIntegrityQuery.data.data || null
        : prev?.audit_data_integrity || null
    }));
  }, [adminQueryEnabled, adminDeployStatusQuery.data, adminAuditPhaseStatusQuery.data, adminAuditIntegrityQuery.data]);

  useEffect(() => {
    if (!data) return;
    const cfg = resolveAnalyticsConfig(data.analytics);
    if (!cfg) return;
    const client = createUiAnalyticsClient({
      auth: activeAuth,
      config: cfg,
      language: normalizeLang(lang),
      variantKey: data.experiment?.variant === "treatment" ? "treatment" : "control",
      experimentKey: String(data.experiment?.key || "webapp_react_v1"),
      cohortBucket: Number(data.experiment?.cohort_bucket || 0),
      tabKey: workspace === "admin" ? "admin" : tab,
      routeKey: buildRouteKey(workspace, workspace === "admin" ? "admin" : tab)
    });
    analyticsRef.current = client;
    client.track(
      buildUiEventRecord({
        event_key: UI_EVENT_KEY.SHELL_OPEN,
        panel_key: UI_SURFACE_KEY.SHELL,
        funnel_key: workspace === "admin" ? UI_FUNNEL_KEY.ADMIN_OPS : UI_FUNNEL_KEY.PLAYER_LOOP,
        surface_key: UI_SURFACE_KEY.SHELL,
        payload_json: {
          workspace,
          tab,
          ui_version: String(data?.ui_shell?.ui_version || "react_v1")
        },
        event_value: 1
      })
    );
    return () => client.dispose();
  }, [activeAuth.uid, activeAuth.ts, activeAuth.sig, data]);

  useEffect(() => {
    if (!analyticsRef.current) return;
    analyticsRef.current.setContext({
      language: normalizeLang(lang),
      tabKey: workspace === "admin" ? "admin" : tab,
      routeKey: buildRouteKey(workspace, workspace === "admin" ? "admin" : tab)
    });
  }, [lang, tab, workspace]);

  useEffect(() => {
    if (!hasActiveAuth) return;
    if (workspace !== "player") {
      return;
    }
    if (tab === "home") {
      void refreshHome();
      return;
    }
    if (tab === "pvp") {
      void Promise.all([refreshLeagueOverview(), refreshPvpLive()]);
      return;
    }
    if (tab === "vault") {
      void refreshVault();
    }
  }, [tab, workspace, hasActiveAuth, activeAuth.uid, activeAuth.ts, activeAuth.sig]);

  const refreshBootstrap = async () => {
    if (!hasActiveAuth) return;
    setLoading(true);
    setError("");
    trackUiEvent({
      event_key: UI_EVENT_KEY.REFRESH_REQUEST,
      panel_key: UI_SURFACE_KEY.TOPBAR,
      funnel_key: workspace === "admin" ? UI_FUNNEL_KEY.ADMIN_OPS : UI_FUNNEL_KEY.PLAYER_LOOP,
      surface_key: UI_SURFACE_KEY.TOPBAR,
      payload_json: {
        target: "bootstrap",
        workspace
      }
    });
    const refreshed = await bootstrapQuery.refetch().catch(() => null);
    const payload = (refreshed?.data || null) as BootstrapV2Payload | null;
    if (!payload?.success || !payload.data) {
      setLoading(false);
      setError(asError(payload, "bootstrap_failed"));
      trackUiEvent({
        event_key: UI_EVENT_KEY.REFRESH_FAILED,
        panel_key: UI_SURFACE_KEY.TOPBAR,
        funnel_key: workspace === "admin" ? UI_FUNNEL_KEY.ADMIN_OPS : UI_FUNNEL_KEY.PLAYER_LOOP,
        surface_key: UI_SURFACE_KEY.TOPBAR,
        payload_json: {
          target: "bootstrap",
          error: asError(payload, "bootstrap_failed")
        }
      });
      return;
    }
    setBootstrap(payload.data);
    trackUiEvent({
      event_key: UI_EVENT_KEY.REFRESH_SUCCESS,
      panel_key: UI_SURFACE_KEY.TOPBAR,
      funnel_key: workspace === "admin" ? UI_FUNNEL_KEY.ADMIN_OPS : UI_FUNNEL_KEY.PLAYER_LOOP,
      surface_key: UI_SURFACE_KEY.TOPBAR,
      payload_json: {
        target: "bootstrap"
      }
    });
  };

  const {
    refreshAdmin,
    refreshDynamicPolicy,
    saveDynamicPolicy,
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
    runtimeFlagsDraft,
    botReconcileDraft,
    setDynamicPolicyDraft,
    setDynamicPolicyError,
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
    adminOpsKpiLatestQuery,
    adminAssetsQuery,
    adminRuntimeFlagsQuery,
    adminRuntimeBotQuery,
    adminDeployStatusQuery,
    adminAuditPhaseStatusQuery,
    adminAuditIntegrityQuery,
    adminDynamicPolicyQuery,
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

  const runMutation = async (
    runner: (attempt: number) => Promise<any>,
    fallback: string,
    telemetry: {
      panelKey?: string;
      funnelKey?: string;
      surfaceKey?: string;
      economyEventKey?: string;
      txState?: string;
      actionKey?: string;
    } = {}
  ) => {
    setLoading(true);
    const res = await runRetriableApiCall(runner, fallback, {
      maxAttempts: 3,
      baseDelayMs: 220,
      telemetry
    });
    if (!res?.success) {
      setLoading(false);
      return;
    }
    setTaskResult(res.data || null);
    await refreshBootstrap();
  };

  const refreshVault = async () => {
    if (!hasActiveAuth) return;
    trackUiEvent({
      event_key: UI_EVENT_KEY.REFRESH_REQUEST,
      panel_key: UI_SURFACE_KEY.PANEL_VAULT,
      funnel_key: UI_FUNNEL_KEY.VAULT_LOOP,
      surface_key: UI_SURFACE_KEY.PANEL_VAULT,
      payload_json: { target: "vault_overview" }
    });
    const [overviewRefetch, summary, route, monetizationRefetch, walletRefetch, payoutRefetch] = await Promise.all([
      vaultOverviewQuery.refetch().catch(() => null),
      fetchTokenSummaryV2(activeAuth).catch(() => null),
      fetchTokenRouteStatusV2(activeAuth).catch(() => null),
      monetizationOverviewQuery.refetch().catch(() => null),
      walletSessionQuery.refetch().catch(() => null),
      payoutStatusQuery.refetch().catch(() => null)
    ]);
    const overview = (overviewRefetch?.data || null) as WebAppApiResponse | null;
    const monetization = (monetizationRefetch?.data || null) as WebAppApiResponse | null;
    const wallet = (walletRefetch?.data || null) as WebAppApiResponse | null;
    const payout = (payoutRefetch?.data || null) as WebAppApiResponse | null;
    applySession(summary);
    setVaultData((prev: any) => ({
      ...prev,
      overview: overview?.data || null,
      summary: summary?.data || null,
      route: route?.data || null,
      monetization: monetization?.data || null,
      wallet: wallet?.data || null,
      payout: payout?.data || null
    }));
    trackUiEvent({
      event_key:
        overview?.success || monetization?.success ? UI_EVENT_KEY.REFRESH_SUCCESS : UI_EVENT_KEY.REFRESH_FAILED,
      panel_key: UI_SURFACE_KEY.PANEL_VAULT,
      funnel_key: UI_FUNNEL_KEY.VAULT_LOOP,
      surface_key: UI_SURFACE_KEY.PANEL_VAULT,
      payload_json: {
        target: "vault_overview",
        overview_success: Boolean(overview?.success),
        monetization_success: Boolean(monetization?.success),
        wallet_success: Boolean(wallet?.success),
        payout_success: Boolean(payout?.success)
      }
    });
  };

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

  const handleWorkspace = async (next: "player" | "admin") => {
    trackUiEvent({
      event_key: UI_EVENT_KEY.WORKSPACE_SWITCH,
      panel_key: UI_SURFACE_KEY.TOPBAR,
      funnel_key: next === "admin" ? UI_FUNNEL_KEY.ADMIN_OPS : UI_FUNNEL_KEY.PLAYER_LOOP,
      surface_key: UI_SURFACE_KEY.TOPBAR,
      payload_json: {
        from: workspace,
        to: next
      }
    });
    setWorkspace(next);
    void syncPrefs({ workspace: next });
  };

  const reducedMotion = Boolean(data?.ui_prefs?.reduced_motion);
  const largeText = Boolean(data?.ui_prefs?.large_text);
  const patchLocalUiPrefs = (patch: Record<string, unknown>) => {
    patchData({
      ui_prefs: {
        ...(data?.ui_prefs || {}),
        ...(patch || {})
      } as any
    });
  };
  const rootClassName = `akrReactRoot${reducedMotion ? " isReducedMotion" : ""}${largeText ? " isLargeText" : ""}`;
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
        onRefresh={() => void refreshBootstrap()}
        onToggleAdvanced={(next) => {
          trackUiEvent({
            event_key: UI_EVENT_KEY.ADVANCED_TOGGLE,
            panel_key: UI_SURFACE_KEY.TOPBAR,
            funnel_key: workspace === "admin" ? UI_FUNNEL_KEY.ADMIN_OPS : UI_FUNNEL_KEY.PLAYER_LOOP,
            surface_key: UI_SURFACE_KEY.TOPBAR,
            payload_json: {
              next
            }
          });
          toggleAdvanced();
          void syncPrefs({ advanced_view: next });
        }}
        onToggleReducedMotion={(next) => {
          patchLocalUiPrefs({ reduced_motion: next });
          void syncPrefs({ reduced_motion: next });
        }}
        onToggleLargeText={(next) => {
          patchLocalUiPrefs({ large_text: next });
          void syncPrefs({ large_text: next });
        }}
        onToggleLanguage={(next) => {
          trackUiEvent({
            event_key: UI_EVENT_KEY.LANGUAGE_SWITCH,
            panel_key: UI_SURFACE_KEY.TOPBAR,
            funnel_key: workspace === "admin" ? UI_FUNNEL_KEY.ADMIN_OPS : UI_FUNNEL_KEY.PLAYER_LOOP,
            surface_key: UI_SURFACE_KEY.TOPBAR,
            payload_json: {
              next
            }
          });
          setLang(next);
          void syncPrefs({ language: next });
        }}
        onToggleWorkspace={(next) => void handleWorkspace(next)}
      />
      <MetaStrip lang={lang} variant={data?.experiment?.variant || ""} sessionRef={data?.analytics?.session_ref || ""} />

      {workspace === "player" && (
        <>
          <PlayerTabs
            lang={lang}
            tab={tab}
            tabs={tabs}
            onChange={(entry) => {
              trackUiEvent({
                event_key: UI_EVENT_KEY.TAB_SWITCH,
                panel_key: UI_SURFACE_KEY.PLAYER_TABS,
                funnel_key: UI_FUNNEL_KEY.PLAYER_LOOP,
                surface_key: UI_SURFACE_KEY.PLAYER_TABS,
                payload_json: {
                  from: tab,
                  to: entry
                }
              });
              setTab(entry);
              void syncPrefs({ last_tab: entry });
            }}
          />
          <main className="akrPanelGrid">
            {tab === "home" && <HomePanel lang={lang} advanced={advanced} homeFeed={homeFeed} data={data} onRefresh={() => void refreshHome()} />}
            {tab === "pvp" && (
              <PvpPanel
                lang={lang}
                advanced={advanced}
                pvpRuntime={(pvpRuntime.session as Record<string, unknown> | null) || null}
                leagueOverview={leagueOverview}
                liveLeaderboard={(pvpLive?.leaderboard as Record<string, unknown> | null) || null}
                liveDiagnostics={(pvpLive?.diagnostics as Record<string, unknown> | null) || null}
                liveTick={(pvpLive?.tick as Record<string, unknown> | null) || null}
                canStart={pvpSessionMachine.can_start}
                canRefreshState={pvpSessionMachine.can_refresh_state}
                canStrike={pvpSessionMachine.can_strike}
                canResolve={pvpSessionMachine.can_resolve}
                onStart={() => void handlePvpStart()}
                onRefreshState={() => void handlePvpRefreshState()}
                onRefreshLeague={() => void refreshLeagueOverview()}
                onRefreshLive={() => void refreshPvpLive()}
                onStrike={() => void handlePvpStrike()}
                onResolve={() => void handlePvpResolve()}
              />
            )}
            {tab === "tasks" && (
              <TasksPanel
                lang={lang}
                advanced={advanced}
                offers={((data as any)?.offers || []) as Array<Record<string, unknown>>}
                missions={((data?.missions?.list as any[]) || []) as Array<Record<string, unknown>>}
                attempts={(data?.attempts as Record<string, unknown> | null) || null}
                daily={(data?.daily as Record<string, unknown> | null) || null}
                taskResult={taskResult}
                onReroll={() => void handleTasksReroll()}
                onComplete={() => void handleTaskComplete()}
                onReveal={() => void handleTaskReveal()}
                onAccept={(offerId) => void handleTaskAccept(offerId)}
                onClaim={(missionKey) => void handleMissionClaim(missionKey)}
              />
            )}
            {tab === "vault" && (
              <VaultPanel
                lang={lang}
                advanced={advanced}
                vaultData={vaultData}
                quoteUsd={quoteUsd}
                quoteChain={quoteChain}
                submitRequestId={submitRequestId}
                submitTxHash={submitTxHash}
                walletChain={walletChain}
                walletAddress={walletAddress}
                walletChallengeRef={walletChallengeRef}
                walletSignature={walletSignature}
                payoutCurrency={payoutCurrency}
                onRefresh={() => void refreshVault()}
                onQuote={() => void handleTokenQuote()}
                onBuyIntent={() => void handleTokenBuyIntent()}
                onSubmitTx={() => void handleTokenSubmitTx()}
                onWalletChallenge={() => void handleWalletChallenge()}
                onWalletVerify={() => void handleWalletVerify()}
                onWalletUnlink={() => void handleWalletUnlink()}
                onPayoutRequest={() => void handlePayoutRequest()}
                onPassPurchase={(passKey, paymentCurrency) => void handlePassPurchase(passKey, paymentCurrency)}
                onCosmeticPurchase={(itemKey, paymentCurrency) => void handleCosmeticPurchase(itemKey, paymentCurrency)}
                walletChallengeLoading={walletChallengeLoading}
                walletVerifyLoading={walletVerifyLoading}
                walletUnlinkLoading={walletUnlinkLoading}
                payoutRequestLoading={payoutRequestLoading}
                passPurchaseLoading={passPurchaseLoading}
                cosmeticPurchaseLoading={cosmeticPurchaseLoading}
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
          </main>
        </>
      )}

      {workspace === "admin" && (
        <AdminPanel
          lang={lang}
          isAdmin={isAdmin}
          advanced={advanced}
          adminRuntime={adminRuntime}
          adminPanels={adminPanels}
          queueAction={queueAction}
          onQueueActionChange={patchQueueAction}
          onRefresh={() => void refreshAdmin()}
          onRunQueueAction={() => void runQueueAction()}
          dynamicPolicyData={(adminPanels?.dynamic_policy as Record<string, unknown> | null) || null}
          dynamicPolicyTokenSymbol={dynamicPolicyTokenSymbol}
          dynamicPolicyDraft={dynamicPolicyDraft}
          dynamicPolicyError={dynamicPolicyError}
          dynamicPolicySaving={dynamicPolicySaving}
          onDynamicPolicyTokenSymbolChange={(value) => setDynamicPolicyTokenSymbol(value)}
          onDynamicPolicyDraftChange={(value) => setDynamicPolicyDraft(value)}
          onRefreshDynamicPolicy={() => void refreshDynamicPolicy()}
          onSaveDynamicPolicy={() => void saveDynamicPolicy()}
          runtimeFlagsData={(adminPanels?.runtime_flags as Record<string, unknown> | null) || null}
          runtimeFlagsDraft={runtimeFlagsDraft}
          runtimeFlagsError={runtimeFlagsError}
          runtimeFlagsSaving={runtimeFlagsSaving}
          onRuntimeFlagsDraftChange={(value) => setRuntimeFlagsDraft(value)}
          onRefreshRuntimeFlags={() => void refreshRuntimeFlags()}
          onSaveRuntimeFlags={() => void saveRuntimeFlags()}
          botRuntimeData={(adminPanels?.runtime_bot as Record<string, unknown> | null) || null}
          botReconcileDraft={botReconcileDraft}
          botReconcileError={botReconcileError}
          botReconcileSaving={botReconcileSaving}
          onBotReconcileDraftChange={(value) => setBotReconcileDraft(value)}
          onRefreshBotRuntime={() => void refreshBotRuntime()}
          onRunBotReconcile={() => void runBotReconcile()}
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
          onRefreshRuntimeMeta={() => void refreshRuntimeMeta()}
          onRefreshOpsKpi={() => void refreshOpsKpi()}
          onRunOpsKpi={() => void runOpsKpiBundle()}
          onReloadAssets={() => void reloadAssets()}
          panelVisibility={adminPanelVisibility}
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
