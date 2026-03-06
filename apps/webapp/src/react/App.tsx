import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildActionRequestId,
  fetchTokenRouteStatusV2,
  fetchTokenSummaryV2,
} from "./api";
import {
  parseBotReconcileDraft,
  parseDynamicPolicySegmentsDraft,
  parseRuntimeFlagsDraft
} from "../core/admin/adminDraftParsers";
import { buildPvpSessionMachine } from "../core/player/pvpSessionMachine";
import { resolveAdminPanelVisibility } from "../core/admin/adminPanelSwitches";
import { runMutationWithBackoff } from "../core/player/mutationPolicy";
import {
  buildRouteKey,
  buildUiEventRecord,
  UI_ECONOMY_EVENT_KEY,
  UI_EVENT_KEY,
  UI_FUNNEL_KEY,
  UI_SURFACE_KEY
} from "../core/telemetry/uiEventTaxonomy";
import { createUiAnalyticsClient, type UiAnalyticsClient } from "./analytics";
import { normalizeLang } from "./i18n";
import { useReactShellStore } from "./store";
import type {
  AdminQueueActionRequest,
  AnalyticsConfig,
  BootstrapV2Payload,
  TabKey,
  UiPreferencesPatch,
  WebAppApiResponse,
  WebAppAuth
} from "./types";
import { AdminPanel } from "./features/admin/AdminPanel";
import { HomePanel } from "./features/home/HomePanel";
import { OnboardingOverlay } from "./features/onboarding/OnboardingOverlay";
import { PvpPanel } from "./features/pvp/PvpPanel";
import { usePvpAutoRefresh } from "./features/pvp/usePvpAutoRefresh";
import { usePvpController } from "./features/pvp/usePvpController";
import { MetaStrip } from "./features/shell/MetaStrip";
import { PlayerTabs } from "./features/shell/PlayerTabs";
import { ShellStatus } from "./features/shell/ShellStatus";
import { TopBar } from "./features/shell/TopBar";
import { TasksPanel } from "./features/tasks/TasksPanel";
import { useTasksController } from "./features/tasks/useTasksController";
import { VaultPanel } from "./features/vault/VaultPanel";
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

function readSessionRef(payload: any): string {
  return String(payload?.session?.session_ref || payload?.session_ref || "").trim();
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

  const refreshAdmin = async () => {
    if (!adminQueryEnabled) return;
    const [
      summaryRefetch,
      queueRefetch,
      metricsRefetch,
      opsKpiRefetch,
      assetsRefetch,
      runtimeFlagsRefetch,
      runtimeBotRefetch,
      deployStatusRefetch,
      auditPhaseRefetch,
      auditIntegrityRefetch,
      dynamicPolicyRefetch
    ] = await Promise.all([
      adminBootstrapQuery.refetch().catch(() => null),
      adminQueueQuery.refetch().catch(() => null),
      adminMetricsQuery.refetch().catch(() => null),
      adminOpsKpiLatestQuery.refetch().catch(() => null),
      adminAssetsQuery.refetch().catch(() => null),
      adminRuntimeFlagsQuery.refetch().catch(() => null),
      adminRuntimeBotQuery.refetch().catch(() => null),
      adminDeployStatusQuery.refetch().catch(() => null),
      adminAuditPhaseStatusQuery.refetch().catch(() => null),
      adminAuditIntegrityQuery.refetch().catch(() => null),
      adminDynamicPolicyQuery.refetch().catch(() => null)
    ]);
    const summary = (summaryRefetch?.data || null) as WebAppApiResponse | null;
    const queue = (queueRefetch?.data || null) as WebAppApiResponse | null;
    const metrics = (metricsRefetch?.data || null) as WebAppApiResponse | null;
    const opsKpi = (opsKpiRefetch?.data || null) as WebAppApiResponse | null;
    const assets = (assetsRefetch?.data || null) as WebAppApiResponse | null;
    const runtimeFlags = (runtimeFlagsRefetch?.data || null) as WebAppApiResponse | null;
    const runtimeBot = (runtimeBotRefetch?.data || null) as WebAppApiResponse | null;
    const deployStatus = (deployStatusRefetch?.data || null) as WebAppApiResponse | null;
    const auditPhaseStatus = (auditPhaseRefetch?.data || null) as WebAppApiResponse | null;
    const auditDataIntegrity = (auditIntegrityRefetch?.data || null) as WebAppApiResponse | null;
    const dynamicPolicy = (dynamicPolicyRefetch?.data || null) as WebAppApiResponse | null;
    if (summary && !summary.success) {
      setError(asError(summary, "admin_bootstrap_failed"));
      return;
    }
    setAdminRuntime(summary?.data || null, (queue?.data as any)?.items || []);
    setAdminPanels((prev: any) => ({
      ...(prev || {}),
      metrics: metrics?.data || null,
      ops_kpi: opsKpi?.data || null,
      assets: assets?.data || null,
      runtime_flags: runtimeFlags?.data || null,
      runtime_bot: runtimeBot?.data || null,
      deploy_status: deployStatus?.data || null,
      audit_phase_status: auditPhaseStatus?.data || null,
      audit_data_integrity: auditDataIntegrity?.data || null,
      dynamic_policy: dynamicPolicy?.data || null
    }));
    if (runtimeFlags?.success) {
      const flagsPayload = (runtimeFlags.data as { flags?: Record<string, unknown> } | undefined)?.flags || {};
      const boolFlags = Object.fromEntries(
        Object.entries(flagsPayload).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean")
      );
      setRuntimeFlagsDraft(JSON.stringify(boolFlags, null, 2));
      setRuntimeFlagsError("");
    }
    if (runtimeBot?.success) {
      const fallbackStateKey = String((runtimeBot.data as { latest?: { state_key?: string } } | undefined)?.latest?.state_key || "");
      if (fallbackStateKey) {
        setBotReconcileDraft((prev) => {
          const current = String(prev || "").trim();
          if (current && current !== '{"state_key":"","reason":"","force_stop":false}') {
            return prev;
          }
          return JSON.stringify({ state_key: fallbackStateKey, reason: "", force_stop: false }, null, 2);
        });
      }
      setBotReconcileError("");
    }
    if (dynamicPolicy?.success) {
      const segments = Array.isArray((dynamicPolicy.data as { segments?: Array<Record<string, unknown>> } | undefined)?.segments)
        ? ((dynamicPolicy.data as { segments?: Array<Record<string, unknown>> }).segments as Array<Record<string, unknown>>)
        : [];
      setDynamicPolicyDraft(JSON.stringify(segments, null, 2));
      setDynamicPolicyError("");
    }
  };

  const refreshDynamicPolicy = async () => {
    if (!adminQueryEnabled) return;
    if (!ensureAdminPanelEnabled("dynamicPolicy")) return;
    setDynamicPolicyError("");
    const refetch = await adminDynamicPolicyQuery.refetch().catch(() => null);
    const payload = (refetch?.data || null) as WebAppApiResponse | null;
    if (!payload?.success) {
      setDynamicPolicyError(asError(payload, "dynamic_policy_fetch_failed"));
      return;
    }
    const segments = Array.isArray((payload.data as { segments?: Array<Record<string, unknown>> } | undefined)?.segments)
      ? ((payload.data as { segments?: Array<Record<string, unknown>> }).segments as Array<Record<string, unknown>>)
      : [];
    setDynamicPolicyDraft(JSON.stringify(segments, null, 2));
    setAdminPanels((prev: any) => ({
      ...(prev || {}),
      dynamic_policy: payload.data || null
    }));
  };

  const saveDynamicPolicy = async () => {
    if (!adminQueryEnabled) return;
    if (!ensureAdminPanelEnabled("dynamicPolicy")) return;
    setDynamicPolicyError("");
    const parsedDraft = parseDynamicPolicySegmentsDraft(dynamicPolicyDraft || "[]");
    if (!parsedDraft.ok) {
      setDynamicPolicyError(parsedDraft.error || "dynamic_policy_invalid_json");
      return;
    }
    const payload = await adminDynamicPolicyUpsert({
      auth: activeAuth,
      token_symbol: String(dynamicPolicyTokenSymbol || "").trim().toUpperCase() || undefined,
      replace_missing: true,
      reason: "webapp_admin_dynamic_auto_policy_update",
      segments: parsedDraft.segments as Array<Record<string, unknown>>
    })
      .unwrap()
      .catch(() => null);
    if (!payload?.success) {
      setDynamicPolicyError(asError(payload, "dynamic_policy_save_failed"));
      return;
    }
    const segments = Array.isArray((payload.data as { segments?: Array<Record<string, unknown>> } | undefined)?.segments)
      ? ((payload.data as { segments?: Array<Record<string, unknown>> }).segments as Array<Record<string, unknown>>)
      : [];
    setDynamicPolicyDraft(JSON.stringify(segments, null, 2));
    setAdminPanels((prev: any) => ({
      ...(prev || {}),
      dynamic_policy: payload.data || null
    }));
    await refreshAdmin();
  };

  const refreshRuntimeFlags = async () => {
    if (!adminQueryEnabled) return;
    if (!ensureAdminPanelEnabled("runtimeFlags")) return;
    setRuntimeFlagsError("");
    const refetch = await adminRuntimeFlagsQuery.refetch().catch(() => null);
    const payload = (refetch?.data || null) as WebAppApiResponse | null;
    if (!payload?.success) {
      setRuntimeFlagsError(asError(payload, "runtime_flags_fetch_failed"));
      return;
    }
    const flagsPayload = (payload.data as { flags?: Record<string, unknown> } | undefined)?.flags || {};
    const boolFlags = Object.fromEntries(
      Object.entries(flagsPayload).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean")
    );
    setRuntimeFlagsDraft(JSON.stringify(boolFlags, null, 2));
    setAdminPanels((prev: any) => ({
      ...(prev || {}),
      runtime_flags: payload.data || null
    }));
  };

  const saveRuntimeFlags = async () => {
    if (!adminQueryEnabled) return;
    if (!ensureAdminPanelEnabled("runtimeFlags")) return;
    setRuntimeFlagsError("");
    const parsedDraft = parseRuntimeFlagsDraft(runtimeFlagsDraft || "{}");
    if (!parsedDraft.ok) {
      setRuntimeFlagsError(parsedDraft.error || "runtime_flags_invalid_json");
      return;
    }
    const payload = await adminRuntimeFlagsUpdate({
      auth: activeAuth,
      source_mode: (parsedDraft.source_mode as "env_locked" | "db_override" | undefined) || undefined,
      source_json: (parsedDraft.source_json as Record<string, unknown> | undefined) || undefined,
      flags: parsedDraft.flags
    })
      .unwrap()
      .catch(() => null);
    if (!payload?.success) {
      setRuntimeFlagsError(asError(payload, "runtime_flags_save_failed"));
      return;
    }
    setRuntimeFlagsDraft(JSON.stringify(parsedDraft.flags, null, 2));
    setAdminPanels((prev: any) => ({
      ...(prev || {}),
      runtime_flags: payload.data || null
    }));
    await refreshAdmin();
  };

  const refreshBotRuntime = async () => {
    if (!adminQueryEnabled) return;
    if (!ensureAdminPanelEnabled("runtimeBot")) return;
    setBotReconcileError("");
    const refetch = await adminRuntimeBotQuery.refetch().catch(() => null);
    const payload = (refetch?.data || null) as WebAppApiResponse | null;
    if (!payload?.success) {
      setBotReconcileError(asError(payload, "runtime_bot_fetch_failed"));
      return;
    }
    setAdminPanels((prev: any) => ({
      ...(prev || {}),
      runtime_bot: payload.data || null
    }));
  };

  const runBotReconcile = async () => {
    if (!adminQueryEnabled) return;
    if (!ensureAdminPanelEnabled("runtimeBot")) return;
    setBotReconcileError("");
    const parsedDraft = parseBotReconcileDraft(botReconcileDraft || "{}");
    if (!parsedDraft.ok) {
      setBotReconcileError(parsedDraft.error || "runtime_bot_invalid_json");
      return;
    }
    const payload = await adminRuntimeBotReconcile({
      auth: activeAuth,
      state_key: parsedDraft.state_key,
      reason: parsedDraft.reason || undefined,
      force_stop: parsedDraft.force_stop
    })
      .unwrap()
      .catch(() => null);
    if (!payload?.success) {
      setBotReconcileError(asError(payload, "runtime_bot_reconcile_failed"));
      return;
    }
    setAdminPanels((prev: any) => ({
      ...(prev || {}),
      runtime_bot_reconcile: payload.data || null
    }));
    await refreshAdmin();
  };

  const refreshRuntimeMeta = async () => {
    if (!adminQueryEnabled) return;
    if (!ensureAdminPanelEnabled("runtimeMeta")) return;
    const [opsKpiRefetch, deployRefetch, assetsRefetch, auditPhaseRefetch, auditIntegrityRefetch] = await Promise.all([
      adminOpsKpiLatestQuery.refetch().catch(() => null),
      adminDeployStatusQuery.refetch().catch(() => null),
      adminAssetsQuery.refetch().catch(() => null),
      adminAuditPhaseStatusQuery.refetch().catch(() => null),
      adminAuditIntegrityQuery.refetch().catch(() => null)
    ]);
    setAdminPanels((prev: any) => ({
      ...(prev || {}),
      ops_kpi: (opsKpiRefetch?.data as WebAppApiResponse | undefined)?.data || null,
      deploy_status: (deployRefetch?.data as WebAppApiResponse | undefined)?.data || null,
      assets: (assetsRefetch?.data as WebAppApiResponse | undefined)?.data || null,
      audit_phase_status: (auditPhaseRefetch?.data as WebAppApiResponse | undefined)?.data || null,
      audit_data_integrity: (auditIntegrityRefetch?.data as WebAppApiResponse | undefined)?.data || null
    }));
  };

  const refreshOpsKpi = async () => {
    if (!adminQueryEnabled) return;
    if (!ensureAdminPanelEnabled("runtimeMeta")) return;
    setOpsKpiRunError("");
    const refetch = await adminOpsKpiLatestQuery.refetch().catch(() => null);
    const payload = (refetch?.data || null) as WebAppApiResponse | null;
    if (!payload?.success) {
      setOpsKpiRunError(asError(payload, "admin_ops_kpi_latest_failed"));
      return;
    }
    setAdminPanels((prev: any) => ({
      ...(prev || {}),
      ops_kpi: payload.data || null
    }));
  };

  const runOpsKpiBundle = async () => {
    if (!adminQueryEnabled) return;
    if (!ensureAdminPanelEnabled("runtimeMeta")) return;
    setOpsKpiRunError("");
    trackUiEvent({
      event_key: UI_EVENT_KEY.ACTION_REQUEST,
      panel_key: UI_SURFACE_KEY.PANEL_ADMIN_RUNTIME,
      funnel_key: UI_FUNNEL_KEY.ADMIN_OPS,
      surface_key: UI_SURFACE_KEY.PANEL_ADMIN_RUNTIME,
      payload_json: {
        action_key: "admin_ops_kpi_run"
      }
    });
    const payload = await adminOpsKpiRun({
      auth: activeAuth,
      hours_short: 24,
      hours_long: 72,
      trend_days: 7,
      emit_slo: true
    })
      .unwrap()
      .catch(() => null);
    applySession(payload);
    if (!payload?.success) {
      const nextError = asError(payload, "admin_ops_kpi_run_failed");
      setOpsKpiRunError(nextError);
      trackUiEvent({
        event_key: UI_EVENT_KEY.ACTION_FAILED,
        panel_key: UI_SURFACE_KEY.PANEL_ADMIN_RUNTIME,
        funnel_key: UI_FUNNEL_KEY.ADMIN_OPS,
        surface_key: UI_SURFACE_KEY.PANEL_ADMIN_RUNTIME,
        payload_json: {
          action_key: "admin_ops_kpi_run",
          error: nextError
        }
      });
      return;
    }
    trackUiEvent({
      event_key: UI_EVENT_KEY.ACTION_SUCCESS,
      panel_key: UI_SURFACE_KEY.PANEL_ADMIN_RUNTIME,
      funnel_key: UI_FUNNEL_KEY.ADMIN_OPS,
      surface_key: UI_SURFACE_KEY.PANEL_ADMIN_RUNTIME,
      payload_json: {
        action_key: "admin_ops_kpi_run"
      }
    });
    setAdminPanels((prev: any) => ({
      ...(prev || {}),
      ops_kpi: payload.data || null,
      ops_kpi_run: payload.data || null
    }));
    await refreshOpsKpi();
  };

  const reloadAssets = async () => {
    if (!adminQueryEnabled) return;
    if (!ensureAdminPanelEnabled("runtimeMeta")) return;
    const payload = await adminAssetsReload({ auth: activeAuth })
      .unwrap()
      .catch(() => null);
    if (!payload?.success) {
      setError(asError(payload, "assets_reload_failed"));
      return;
    }
    setAdminPanels((prev: any) => ({
      ...(prev || {}),
      assets_reload: payload.data || null
    }));
    await refreshAdmin();
  };

  const refreshHome = async () => {
    if (!hasActiveAuth) return;
    trackUiEvent({
      event_key: UI_EVENT_KEY.REFRESH_REQUEST,
      panel_key: UI_SURFACE_KEY.PANEL_HOME,
      funnel_key: UI_FUNNEL_KEY.PLAYER_LOOP,
      surface_key: UI_SURFACE_KEY.PANEL_HOME,
      payload_json: { target: "home_feed" }
    });
    const refreshed = await homeFeedQuery.refetch().catch(() => null);
    const payload = (refreshed?.data || null) as WebAppApiResponse | null;
    if (!payload?.success) {
      setError(asError(payload, "home_feed_failed"));
      trackUiEvent({
        event_key: UI_EVENT_KEY.REFRESH_FAILED,
        panel_key: UI_SURFACE_KEY.PANEL_HOME,
        funnel_key: UI_FUNNEL_KEY.PLAYER_LOOP,
        surface_key: UI_SURFACE_KEY.PANEL_HOME,
        payload_json: { target: "home_feed", error: asError(payload, "home_feed_failed") }
      });
      return;
    }
    setHomeFeed(payload.data || null);
    trackUiEvent({
      event_key: UI_EVENT_KEY.REFRESH_SUCCESS,
      panel_key: UI_SURFACE_KEY.PANEL_HOME,
      funnel_key: UI_FUNNEL_KEY.PLAYER_LOOP,
      surface_key: UI_SURFACE_KEY.PANEL_HOME,
      payload_json: { target: "home_feed" }
    });
  };

  const refreshLeagueOverview = async () => {
    if (!hasActiveAuth) return;
    trackUiEvent({
      event_key: UI_EVENT_KEY.REFRESH_REQUEST,
      panel_key: UI_SURFACE_KEY.PANEL_PVP,
      funnel_key: UI_FUNNEL_KEY.PVP_LOOP,
      surface_key: UI_SURFACE_KEY.PANEL_PVP,
      payload_json: { target: "league_overview" }
    });
    const refreshed = await leagueOverviewQuery.refetch().catch(() => null);
    const payload = (refreshed?.data || null) as WebAppApiResponse | null;
    if (!payload?.success) {
      setError(asError(payload, "league_overview_failed"));
      trackUiEvent({
        event_key: UI_EVENT_KEY.REFRESH_FAILED,
        panel_key: UI_SURFACE_KEY.PANEL_PVP,
        funnel_key: UI_FUNNEL_KEY.PVP_LOOP,
        surface_key: UI_SURFACE_KEY.PANEL_PVP,
        payload_json: { target: "league_overview", error: asError(payload, "league_overview_failed") }
      });
      return;
    }
    setLeagueOverview(payload.data || null);
    trackUiEvent({
      event_key: UI_EVENT_KEY.REFRESH_SUCCESS,
      panel_key: UI_SURFACE_KEY.PANEL_PVP,
      funnel_key: UI_FUNNEL_KEY.PVP_LOOP,
      surface_key: UI_SURFACE_KEY.PANEL_PVP,
      payload_json: { target: "league_overview" }
    });
  };

  const refreshPvpLive = async (sessionRefHint = "") => {
    if (!hasActiveAuth) return;
    if (pvpLiveRefreshInFlightRef.current) return;
    pvpLiveRefreshInFlightRef.current = true;
    const sessionRef = String(sessionRefHint || readSessionRef(pvpRuntime.session || null) || "").trim();
    try {
      trackUiEvent({
        event_key: UI_EVENT_KEY.REFRESH_REQUEST,
        panel_key: UI_SURFACE_KEY.PANEL_PVP,
        funnel_key: UI_FUNNEL_KEY.PVP_LOOP,
        surface_key: UI_SURFACE_KEY.PANEL_PVP,
        payload_json: { target: "pvp_live" }
      });
      const [leaderboard, diagnostics, tick] = await Promise.all([
        loadPvpLeaderboardLive({
          auth: activeAuth,
          limit: 25
        })
          .unwrap()
          .catch(() => null),
        loadPvpDiagnosticsLive({
          auth: activeAuth,
          window: "1h"
        })
          .unwrap()
          .catch(() => null),
        sessionRef
          ? loadPvpMatchTick({
              auth: activeAuth,
              session_ref: sessionRef
            })
              .unwrap()
              .catch(() => null)
          : Promise.resolve(null)
      ]);
      applySession(leaderboard);
      applySession(diagnostics);
      applySession(tick);
      const hasData = Boolean(leaderboard?.success || diagnostics?.success || tick?.success);
      if (!hasData) {
        setError("pvp_live_failed");
        trackUiEvent({
          event_key: UI_EVENT_KEY.REFRESH_FAILED,
          panel_key: UI_SURFACE_KEY.PANEL_PVP,
          funnel_key: UI_FUNNEL_KEY.PVP_LOOP,
          surface_key: UI_SURFACE_KEY.PANEL_PVP,
          payload_json: { target: "pvp_live", error: "pvp_live_failed" }
        });
        return;
      }
      setPvpLive({
        leaderboard: leaderboard?.data || null,
        diagnostics: diagnostics?.data || null,
        tick: tick?.data || null
      });
      trackUiEvent({
        event_key: UI_EVENT_KEY.REFRESH_SUCCESS,
        panel_key: UI_SURFACE_KEY.PANEL_PVP,
        funnel_key: UI_FUNNEL_KEY.PVP_LOOP,
        surface_key: UI_SURFACE_KEY.PANEL_PVP,
        payload_json: {
          target: "pvp_live",
          leaderboard_success: Boolean(leaderboard?.success),
          diagnostics_success: Boolean(diagnostics?.success),
          tick_success: Boolean(tick?.success)
        }
      });
    } finally {
      pvpLiveRefreshInFlightRef.current = false;
    }
  };

  const runRetriableApiCall = async (
    runner: (attempt: number) => Promise<any>,
    fallback: string,
    options: {
      maxAttempts?: number;
      baseDelayMs?: number;
      telemetry?: {
        panelKey?: string;
        funnelKey?: string;
        surfaceKey?: string;
        economyEventKey?: string;
        txState?: string;
        actionKey?: string;
      };
    } = {}
  ) => {
    setError("");
    const telemetry = options.telemetry || {};
    trackUiEvent({
      event_key: UI_EVENT_KEY.ACTION_REQUEST,
      panel_key: telemetry.panelKey || UI_SURFACE_KEY.SHELL,
      funnel_key: telemetry.funnelKey || UI_FUNNEL_KEY.PLAYER_LOOP,
      surface_key: telemetry.surfaceKey || UI_SURFACE_KEY.SHELL,
      economy_event_key: telemetry.economyEventKey || "",
      tx_state: telemetry.txState || "",
      payload_json: {
        action_key: telemetry.actionKey || fallback,
        fallback
      }
    });
    const outcome = await runMutationWithBackoff(
      async (attemptNo) => runner(Number(attemptNo || 1)),
      {
        maxAttempts: options.maxAttempts || 3,
        baseDelayMs: options.baseDelayMs || 220,
        jitterMs: 90,
        maxDelayMs: 1500,
        onRetry: ({ attempt, error }) => {
          trackUiEvent({
            event_key: UI_EVENT_KEY.ACTION_RETRY,
            panel_key: telemetry.panelKey || UI_SURFACE_KEY.SHELL,
            funnel_key: telemetry.funnelKey || UI_FUNNEL_KEY.PLAYER_LOOP,
            surface_key: telemetry.surfaceKey || UI_SURFACE_KEY.SHELL,
            economy_event_key: telemetry.economyEventKey || "",
            tx_state: telemetry.txState || "retrying",
            event_value: Number(attempt || 0),
            payload_json: {
              action_key: telemetry.actionKey || fallback,
              error_code: String(error?.code || "")
            }
          });
        }
      }
    );
    const payload = (outcome.payload || null) as WebAppApiResponse | null;
    applySession(payload);
    if (!outcome.ok || !payload?.success) {
      const code = String(outcome.error?.code || "").trim().toLowerCase();
      setError(asError(payload, code || fallback));
      trackUiEvent({
        event_key: UI_EVENT_KEY.ACTION_FAILED,
        panel_key: telemetry.panelKey || UI_SURFACE_KEY.SHELL,
        funnel_key: telemetry.funnelKey || UI_FUNNEL_KEY.PLAYER_LOOP,
        surface_key: telemetry.surfaceKey || UI_SURFACE_KEY.SHELL,
        economy_event_key: telemetry.economyEventKey || "",
        tx_state: telemetry.txState || "failed",
        event_value: Number(outcome.attempts || 0),
        payload_json: {
          action_key: telemetry.actionKey || fallback,
          error_code: code || fallback,
          status: Number(outcome.error?.status || 0)
        }
      });
      return null;
    }
    trackUiEvent({
      event_key: UI_EVENT_KEY.ACTION_SUCCESS,
      panel_key: telemetry.panelKey || UI_SURFACE_KEY.SHELL,
      funnel_key: telemetry.funnelKey || UI_FUNNEL_KEY.PLAYER_LOOP,
      surface_key: telemetry.surfaceKey || UI_SURFACE_KEY.SHELL,
      economy_event_key: telemetry.economyEventKey || "",
      tx_state: telemetry.txState || "ok",
      event_value: Number(outcome.attempts || 1),
      payload_json: {
        action_key: telemetry.actionKey || fallback,
        attempts: Number(outcome.attempts || 1)
      }
    });
    return payload;
  };

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

  const runQueueAction = async () => {
    if (!hasActiveAuth) return;
    if (!ensureAdminPanelEnabled("queue")) return;
    const payload: AdminQueueActionRequest = {
      action_key: String(queueAction.action_key || ""),
      kind: String(queueAction.kind || "") || undefined,
      request_id: Math.max(1, Number(queueAction.request_id || 0)),
      action_request_id: buildActionRequestId("admin_queue"),
      tx_hash: String(queueAction.tx_hash || "") || undefined,
      reason: String(queueAction.reason || "") || undefined,
      confirm_token: String(queueAction.confirm_token || "") || undefined
    };
    trackUiEvent({
      event_key: UI_EVENT_KEY.ACTION_REQUEST,
      panel_key: UI_SURFACE_KEY.PANEL_ADMIN_QUEUE,
      funnel_key: UI_FUNNEL_KEY.ADMIN_OPS,
      surface_key: UI_SURFACE_KEY.PANEL_ADMIN_QUEUE,
      payload_json: {
        action_key: payload.action_key,
        request_id: payload.request_id
      }
    });
    const res = await adminQueueAction({
      auth: activeAuth,
      payload
    })
      .unwrap()
      .catch(() => null);
    if (!res?.success) {
      setError(asError(res, "admin_queue_action_failed"));
      trackUiEvent({
        event_key: UI_EVENT_KEY.ACTION_FAILED,
        panel_key: UI_SURFACE_KEY.PANEL_ADMIN_QUEUE,
        funnel_key: UI_FUNNEL_KEY.ADMIN_OPS,
        surface_key: UI_SURFACE_KEY.PANEL_ADMIN_QUEUE,
        payload_json: {
          action_key: payload.action_key,
          request_id: payload.request_id,
          error: asError(res, "admin_queue_action_failed")
        }
      });
      return;
    }
    trackUiEvent({
      event_key: UI_EVENT_KEY.ACTION_SUCCESS,
      panel_key: UI_SURFACE_KEY.PANEL_ADMIN_QUEUE,
      funnel_key: UI_FUNNEL_KEY.ADMIN_OPS,
      surface_key: UI_SURFACE_KEY.PANEL_ADMIN_QUEUE,
      payload_json: {
        action_key: payload.action_key,
        request_id: payload.request_id
      }
    });
    await refreshAdmin();
  };

  const patchQueueAction = (patch: Partial<QueueActionForm>) => {
    setQueueAction((prev) => ({
      ...prev,
      ...(patch || {})
    }));
  };

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

  const handleTokenQuote = async () => {
    const payload = await runRetriableApiCall(
      async () =>
        loadTokenQuote({
          auth: activeAuth,
          usd: Number(quoteUsd || 0),
          chain: quoteChain
        }).unwrap(),
      "token_quote_failed",
      {
        maxAttempts: 2,
        baseDelayMs: 140,
        telemetry: {
          panelKey: UI_SURFACE_KEY.PANEL_VAULT,
          funnelKey: UI_FUNNEL_KEY.TOKEN_REVENUE,
          surfaceKey: UI_SURFACE_KEY.PANEL_VAULT,
          economyEventKey: UI_ECONOMY_EVENT_KEY.TOKEN_QUOTE,
          actionKey: "token_quote",
          txState: "quote"
        }
      }
    );
    if (!payload?.success) return;
    setVaultData((prev: any) => ({ ...prev, quote: payload.data || null }));
  };

  const handleTokenBuyIntent = async () => {
    const actionRequestId = buildActionRequestId("buy");
    const payload = await runRetriableApiCall(
      async () =>
        tokenBuyIntent({
          auth: activeAuth,
          usd_amount: Number(quoteUsd || 0),
          chain: quoteChain,
          action_request_id: actionRequestId
        }).unwrap(),
      "token_buy_intent_failed",
      {
        maxAttempts: 3,
        baseDelayMs: 200,
        telemetry: {
          panelKey: UI_SURFACE_KEY.PANEL_VAULT,
          funnelKey: UI_FUNNEL_KEY.TOKEN_REVENUE,
          surfaceKey: UI_SURFACE_KEY.PANEL_VAULT,
          economyEventKey: UI_ECONOMY_EVENT_KEY.TOKEN_BUY_INTENT,
          actionKey: "token_buy_intent",
          txState: "intent"
        }
      }
    );
    if (!payload?.success) return;
    setVaultData((prev: any) => ({ ...prev, buy: payload.data || null }));
    await refreshVault();
  };

  const handleTokenSubmitTx = async () => {
    const actionRequestId = buildActionRequestId("submit");
    const payload = await runRetriableApiCall(
      async () =>
        tokenSubmitTx({
          auth: activeAuth,
          request_id: Number(submitRequestId || 0),
          tx_hash: submitTxHash,
          action_request_id: actionRequestId
        }).unwrap(),
      "token_submit_failed",
      {
        maxAttempts: 3,
        baseDelayMs: 220,
        telemetry: {
          panelKey: UI_SURFACE_KEY.PANEL_VAULT,
          funnelKey: UI_FUNNEL_KEY.TOKEN_REVENUE,
          surfaceKey: UI_SURFACE_KEY.PANEL_VAULT,
          economyEventKey: UI_ECONOMY_EVENT_KEY.TOKEN_SUBMIT_TX,
          actionKey: "token_submit_tx",
          txState: "submit"
        }
      }
    );
    if (!payload?.success) return;
    setVaultData((prev: any) => ({ ...prev, submit: payload.data || null }));
    await refreshVault();
  };

  const handleWalletChallenge = async () => {
    const chain = String(walletChain || "").trim().toUpperCase();
    const address = String(walletAddress || "").trim();
    if (!chain || !address) {
      setError("wallet_input_missing");
      return;
    }
    const payload = await runRetriableApiCall(
      async () =>
        walletChallenge({
          auth: activeAuth,
          chain,
          address,
          statement: "AirdropKralBot wallet link challenge"
        }).unwrap(),
      "wallet_challenge_failed",
      {
        maxAttempts: 2,
        baseDelayMs: 180,
        telemetry: {
          panelKey: UI_SURFACE_KEY.PANEL_VAULT,
          funnelKey: UI_FUNNEL_KEY.VAULT_LOOP,
          surfaceKey: UI_SURFACE_KEY.PANEL_VAULT,
          actionKey: "wallet_challenge",
          txState: "challenge"
        }
      }
    );
    if (!payload?.success) return;
    const payloadData = (payload.data as Record<string, unknown> | undefined) || {};
    const challenge = (payloadData.challenge as Record<string, unknown> | undefined) || null;
    const challengeRef = String((challenge?.challenge_ref as string | undefined) || "").trim();
    if (challengeRef) {
      setWalletChallengeRef(challengeRef);
    }
    setVaultData((prev: any) => ({
      ...prev,
      wallet_challenge: challenge
    }));
  };

  const handleWalletVerify = async () => {
    const chain = String(walletChain || "").trim().toUpperCase();
    const address = String(walletAddress || "").trim();
    const challengeRef = String(walletChallengeRef || "").trim();
    const signature = String(walletSignature || "").trim();
    if (!chain || !address || !challengeRef || !signature) {
      setError("wallet_verify_input_missing");
      return;
    }
    const payload = await runRetriableApiCall(
      async () =>
        walletVerify({
          auth: activeAuth,
          challenge_ref: challengeRef,
          chain,
          address,
          signature
        }).unwrap(),
      "wallet_verify_failed",
      {
        maxAttempts: 2,
        baseDelayMs: 180,
        telemetry: {
          panelKey: UI_SURFACE_KEY.PANEL_VAULT,
          funnelKey: UI_FUNNEL_KEY.VAULT_LOOP,
          surfaceKey: UI_SURFACE_KEY.PANEL_VAULT,
          actionKey: "wallet_verify",
          txState: "verify"
        }
      }
    );
    if (!payload?.success) return;
    const payloadData = (payload.data as Record<string, unknown> | undefined) || {};
    setVaultData((prev: any) => ({
      ...prev,
      wallet_verify: payloadData,
      wallet: payloadData
    }));
    await refreshVault();
  };

  const handleWalletUnlink = async () => {
    const chain = String(walletChain || "").trim().toUpperCase();
    const address = String(walletAddress || "").trim();
    const payload = await runRetriableApiCall(
      async () =>
        walletUnlink({
          auth: activeAuth,
          chain: chain || undefined,
          address: address || undefined,
          reason: "user_requested_unlink"
        }).unwrap(),
      "wallet_unlink_failed",
      {
        maxAttempts: 2,
        baseDelayMs: 180,
        telemetry: {
          panelKey: UI_SURFACE_KEY.PANEL_VAULT,
          funnelKey: UI_FUNNEL_KEY.VAULT_LOOP,
          surfaceKey: UI_SURFACE_KEY.PANEL_VAULT,
          actionKey: "wallet_unlink",
          txState: "unlink"
        }
      }
    );
    if (!payload?.success) return;
    const payloadData = (payload.data as Record<string, unknown> | undefined) || {};
    setVaultData((prev: any) => ({
      ...prev,
      wallet_unlink: payloadData,
      wallet: payloadData
    }));
    await refreshVault();
  };

  const handlePayoutRequest = async () => {
    const currency = String(payoutCurrency || "BTC").trim().toUpperCase() || "BTC";
    const payload = await runRetriableApiCall(
      async () =>
        payoutRequest({
          auth: activeAuth,
          currency
        }).unwrap(),
      "payout_request_failed",
      {
        maxAttempts: 3,
        baseDelayMs: 200,
        telemetry: {
          panelKey: UI_SURFACE_KEY.PANEL_VAULT,
          funnelKey: UI_FUNNEL_KEY.VAULT_LOOP,
          surfaceKey: UI_SURFACE_KEY.PANEL_VAULT,
          economyEventKey: UI_ECONOMY_EVENT_KEY.PAYOUT_REQUEST,
          actionKey: "payout_request",
          txState: "request"
        }
      }
    );
    if (!payload?.success) return;
    const payloadData = (payload.data as Record<string, unknown> | undefined) || {};
    setVaultData((prev: any) => ({
      ...prev,
      payout_request: payloadData,
      payout: payloadData
    }));
    await refreshVault();
  };

  const handlePassPurchase = async (passKey: string, paymentCurrency?: string) => {
    const safePassKey = String(passKey || "").trim();
    if (!safePassKey) return;
    const purchaseRef = buildActionRequestId("pass_purchase");
    const payload = await runRetriableApiCall(
      async () =>
        monetizationPassPurchase({
          auth: activeAuth,
          pass_key: safePassKey,
          payment_currency: paymentCurrency ? String(paymentCurrency).toUpperCase() : undefined,
          purchase_ref: purchaseRef
        }).unwrap(),
      "pass_purchase_failed",
      {
        maxAttempts: 3,
        baseDelayMs: 220,
        telemetry: {
          panelKey: UI_SURFACE_KEY.PANEL_VAULT,
          funnelKey: UI_FUNNEL_KEY.TOKEN_REVENUE,
          surfaceKey: UI_SURFACE_KEY.PANEL_VAULT,
          economyEventKey: UI_ECONOMY_EVENT_KEY.PASS_PURCHASE,
          actionKey: "monetization_pass_purchase",
          txState: "purchase"
        }
      }
    );
    if (!payload?.success) return;
    const payloadData = (payload.data as Record<string, unknown> | undefined) || {};
    setVaultData((prev: any) => ({
      ...prev,
      pass_purchase: (payloadData.purchase as Record<string, unknown> | undefined) || null,
      monetization: (payloadData.monetization as Record<string, unknown> | undefined) || prev?.monetization || null
    }));
    await refreshVault();
  };

  const handleCosmeticPurchase = async (itemKey: string, paymentCurrency?: string) => {
    const safeItemKey = String(itemKey || "").trim();
    if (!safeItemKey) return;
    const purchaseRef = buildActionRequestId("cosmetic_purchase");
    const payload = await runRetriableApiCall(
      async () =>
        monetizationCosmeticPurchase({
          auth: activeAuth,
          item_key: safeItemKey,
          payment_currency: paymentCurrency ? String(paymentCurrency).toUpperCase() : undefined,
          purchase_ref: purchaseRef
        }).unwrap(),
      "cosmetic_purchase_failed",
      {
        maxAttempts: 3,
        baseDelayMs: 220,
        telemetry: {
          panelKey: UI_SURFACE_KEY.PANEL_VAULT,
          funnelKey: UI_FUNNEL_KEY.TOKEN_REVENUE,
          surfaceKey: UI_SURFACE_KEY.PANEL_VAULT,
          economyEventKey: UI_ECONOMY_EVENT_KEY.COSMETIC_PURCHASE,
          actionKey: "monetization_cosmetic_purchase",
          txState: "purchase"
        }
      }
    );
    if (!payload?.success) return;
    const payloadData = (payload.data as Record<string, unknown> | undefined) || {};
    setVaultData((prev: any) => ({
      ...prev,
      cosmetic_purchase: (payloadData.purchase as Record<string, unknown> | undefined) || null,
      monetization: (payloadData.monetization as Record<string, unknown> | undefined) || prev?.monetization || null
    }));
    await refreshVault();
  };

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
