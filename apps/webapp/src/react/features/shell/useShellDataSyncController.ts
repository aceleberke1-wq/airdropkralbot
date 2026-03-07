import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { BootstrapV2Data, BootstrapV2Payload, TabKey, WebAppApiResponse, WebAppAuth } from "../../types";

type QueryPayload<T = Record<string, unknown>> = WebAppApiResponse<T> | null | undefined;
type SetState<T> = Dispatch<SetStateAction<T>>;

type ShellDataSyncControllerOptions = {
  propsAuth: WebAppAuth;
  propsBootstrap: BootstrapV2Payload;
  activeAuth: WebAppAuth;
  hasActiveAuth: boolean;
  workspace: "player" | "admin";
  tab: TabKey;
  adminQueryEnabled: boolean;
  bootstrapQueryData: BootstrapV2Payload | null | undefined;
  homeFeedQueryData: QueryPayload;
  leagueOverviewQueryData: QueryPayload;
  vaultOverviewQueryData: QueryPayload;
  monetizationOverviewQueryData: QueryPayload;
  walletSessionQueryData: QueryPayload;
  payoutStatusQueryData: QueryPayload;
  adminBootstrapQueryData: QueryPayload;
  adminQueueQueryData: QueryPayload;
  adminMetricsQueryData: QueryPayload;
  adminLiveOpsCampaignQueryData: QueryPayload;
  adminOpsKpiLatestQueryData: QueryPayload;
  adminAssetsQueryData: QueryPayload;
  adminRuntimeFlagsQueryData: QueryPayload;
  adminRuntimeBotQueryData: QueryPayload;
  adminDeployStatusQueryData: QueryPayload;
  adminAuditPhaseStatusQueryData: QueryPayload;
  adminAuditIntegrityQueryData: QueryPayload;
  adminDynamicPolicyQueryData: QueryPayload;
  setAuth: (auth: WebAppAuth) => void;
  setBootstrap: (data: BootstrapV2Data) => void;
  setLoading: (next: boolean) => void;
  setError: (next: string) => void;
  setHomeFeed: SetState<any>;
  setLeagueOverview: SetState<any>;
  setVaultData: SetState<any>;
  setAdminRuntime: (summary: Record<string, unknown> | null, queue?: Array<Record<string, unknown>>) => void;
  setAdminPanels: SetState<any>;
  setDynamicPolicyTokenSymbol: SetState<string>;
  setDynamicPolicyDraft: SetState<string>;
  setLiveOpsCampaignDraft: SetState<string>;
  setRuntimeFlagsDraft: SetState<string>;
  setBotReconcileDraft: SetState<string>;
  refreshHome: () => Promise<any>;
  refreshLeagueOverview: () => Promise<any>;
  refreshPvpLive: (sessionRefHint?: string) => Promise<any>;
  refreshVault: () => Promise<any>;
  asError: (payload: WebAppApiResponse | null | undefined, fallback?: string) => string;
};

export function useShellDataSyncController(options: ShellDataSyncControllerOptions) {
  useEffect(() => {
    options.setAuth(options.propsAuth);
    if (options.propsBootstrap?.success && options.propsBootstrap.data) {
      options.setBootstrap(options.propsBootstrap.data);
      return;
    }
    options.setLoading(false);
    options.setError(String(options.propsBootstrap?.error || "bootstrap_failed"));
  }, [options.propsAuth, options.propsBootstrap, options.setAuth, options.setBootstrap, options.setError, options.setLoading]);

  useEffect(() => {
    const payload = options.bootstrapQueryData;
    if (!payload) return;
    if (!payload.success || !payload.data) {
      options.setLoading(false);
      options.setError(options.asError(payload, "bootstrap_failed"));
      return;
    }
    options.setBootstrap(payload.data);
  }, [options.bootstrapQueryData, options.setBootstrap, options.setError, options.setLoading, options.asError]);

  useEffect(() => {
    const payload = options.homeFeedQueryData;
    if (!payload?.success) return;
    options.setHomeFeed(payload.data || null);
  }, [options.homeFeedQueryData, options.setHomeFeed]);

  useEffect(() => {
    const payload = options.leagueOverviewQueryData;
    if (!payload?.success) return;
    options.setLeagueOverview(payload.data || null);
  }, [options.leagueOverviewQueryData, options.setLeagueOverview]);

  useEffect(() => {
    if (
      !options.vaultOverviewQueryData &&
      !options.monetizationOverviewQueryData &&
      !options.walletSessionQueryData &&
      !options.payoutStatusQueryData
    ) {
      return;
    }
    options.setVaultData((prev: any) => ({
      ...prev,
      ...(options.vaultOverviewQueryData?.success ? { overview: options.vaultOverviewQueryData.data || null } : {}),
      ...(options.monetizationOverviewQueryData?.success ? { monetization: options.monetizationOverviewQueryData.data || null } : {}),
      ...(options.walletSessionQueryData?.success ? { wallet: options.walletSessionQueryData.data || null } : {}),
      ...(options.payoutStatusQueryData?.success ? { payout: options.payoutStatusQueryData.data || null } : {})
    }));
  }, [
    options.vaultOverviewQueryData,
    options.monetizationOverviewQueryData,
    options.walletSessionQueryData,
    options.payoutStatusQueryData,
    options.setVaultData
  ]);

  useEffect(() => {
    if (!options.adminQueryEnabled) return;
    if (!options.adminBootstrapQueryData && !options.adminQueueQueryData) return;
    const summary = options.adminBootstrapQueryData?.success ? options.adminBootstrapQueryData.data || null : null;
    const queueItems = options.adminQueueQueryData?.success
      ? ((options.adminQueueQueryData.data as { items?: Array<Record<string, unknown>> } | undefined)?.items || [])
      : [];
    options.setAdminRuntime(summary, Array.isArray(queueItems) ? queueItems : []);
    if (
      options.adminBootstrapQueryData?.success &&
      summary &&
      typeof summary === "object" &&
      (summary as Record<string, unknown>).surface_actions &&
      typeof (summary as Record<string, unknown>).surface_actions === "object"
    ) {
      options.setAdminPanels((prev: any) => ({
        ...(prev || {}),
        surface_actions: (summary as Record<string, unknown>).surface_actions
      }));
    }
  }, [
    options.adminQueryEnabled,
    options.adminBootstrapQueryData,
    options.adminQueueQueryData,
    options.setAdminRuntime,
    options.setAdminPanels
  ]);

  useEffect(() => {
    if (!options.adminQueryEnabled) return;
    if (
      !options.adminMetricsQueryData &&
      !options.adminLiveOpsCampaignQueryData &&
      !options.adminAssetsQueryData &&
      !options.adminOpsKpiLatestQueryData
    ) {
      return;
    }
    options.setAdminPanels((prev: any) => ({
      ...(prev || {}),
      ...(options.adminMetricsQueryData?.success ? { metrics: options.adminMetricsQueryData.data || null } : {}),
      ...(options.adminLiveOpsCampaignQueryData?.success ? { live_ops_campaign: options.adminLiveOpsCampaignQueryData.data || null } : {}),
      ...(options.adminOpsKpiLatestQueryData?.success ? { ops_kpi: options.adminOpsKpiLatestQueryData.data || null } : {}),
      ...(options.adminAssetsQueryData?.success ? { assets: options.adminAssetsQueryData.data || null } : {})
    }));
  }, [
    options.adminQueryEnabled,
    options.adminMetricsQueryData,
    options.adminLiveOpsCampaignQueryData,
    options.adminOpsKpiLatestQueryData,
    options.adminAssetsQueryData,
    options.setAdminPanels
  ]);

  useEffect(() => {
    if (!options.adminQueryEnabled) return;
    const payload = options.adminDynamicPolicyQueryData;
    if (!payload?.success) return;
    const tokenSymbol = String((payload.data as { token_symbol?: string } | undefined)?.token_symbol || "")
      .trim()
      .toUpperCase();
    if (tokenSymbol) {
      options.setDynamicPolicyTokenSymbol(tokenSymbol);
    }
    const segments = Array.isArray((payload.data as { segments?: Array<Record<string, unknown>> } | undefined)?.segments)
      ? ((payload.data as { segments?: Array<Record<string, unknown>> }).segments as Array<Record<string, unknown>>)
      : [];
    options.setDynamicPolicyDraft((prev) => (String(prev || "").trim() ? prev : JSON.stringify(segments, null, 2)));
    options.setAdminPanels((prev: any) => ({
      ...(prev || {}),
      dynamic_policy: payload.data || null
    }));
  }, [
    options.adminQueryEnabled,
    options.adminDynamicPolicyQueryData,
    options.setDynamicPolicyTokenSymbol,
    options.setDynamicPolicyDraft,
    options.setAdminPanels
  ]);

  useEffect(() => {
    if (!options.adminQueryEnabled) return;
    const payload = options.adminLiveOpsCampaignQueryData;
    if (!payload?.success) return;
    const campaignPayload =
      (payload.data as { campaign?: Record<string, unknown> } | undefined)?.campaign ||
      (payload.data as Record<string, unknown> | undefined) ||
      {};
    options.setLiveOpsCampaignDraft((prev) => {
      const current = String(prev || "").trim();
      if (current && current !== "{}") {
        return prev;
      }
      return JSON.stringify(campaignPayload, null, 2);
    });
    options.setAdminPanels((prev: any) => ({
      ...(prev || {}),
      live_ops_campaign: payload.data || null
    }));
  }, [options.adminQueryEnabled, options.adminLiveOpsCampaignQueryData, options.setAdminPanels, options.setLiveOpsCampaignDraft]);

  useEffect(() => {
    if (!options.adminQueryEnabled) return;
    const payload = options.adminRuntimeFlagsQueryData;
    if (!payload?.success) return;
    const flagsPayload = (payload.data as { flags?: Record<string, unknown> } | undefined)?.flags || {};
    const boolFlags = Object.fromEntries(
      Object.entries(flagsPayload).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean")
    );
    options.setRuntimeFlagsDraft((prev) => {
      const current = String(prev || "").trim();
      if (current && current !== "{}") {
        return prev;
      }
      return JSON.stringify(boolFlags, null, 2);
    });
    options.setAdminPanels((prev: any) => ({
      ...(prev || {}),
      runtime_flags: payload.data || null
    }));
  }, [options.adminQueryEnabled, options.adminRuntimeFlagsQueryData, options.setRuntimeFlagsDraft, options.setAdminPanels]);

  useEffect(() => {
    if (!options.adminQueryEnabled) return;
    const payload = options.adminRuntimeBotQueryData;
    if (!payload?.success) return;
    const fallbackStateKey = String((payload.data as { latest?: { state_key?: string } } | undefined)?.latest?.state_key || "");
    if (fallbackStateKey) {
      options.setBotReconcileDraft((prev) => {
        const current = String(prev || "").trim();
        if (!current || current === '{"state_key":"","reason":"","force_stop":false}') {
          return JSON.stringify({ state_key: fallbackStateKey, reason: "", force_stop: false }, null, 2);
        }
        return prev;
      });
    }
    options.setAdminPanels((prev: any) => ({
      ...(prev || {}),
      runtime_bot: payload.data || null
    }));
  }, [options.adminQueryEnabled, options.adminRuntimeBotQueryData, options.setBotReconcileDraft, options.setAdminPanels]);

  useEffect(() => {
    if (!options.adminQueryEnabled) return;
    options.setAdminPanels((prev: any) => ({
      ...(prev || {}),
      deploy_status: options.adminDeployStatusQueryData?.success
        ? options.adminDeployStatusQueryData.data || null
        : prev?.deploy_status || null,
      audit_phase_status: options.adminAuditPhaseStatusQueryData?.success
        ? options.adminAuditPhaseStatusQueryData.data || null
        : prev?.audit_phase_status || null,
      audit_data_integrity: options.adminAuditIntegrityQueryData?.success
        ? options.adminAuditIntegrityQueryData.data || null
        : prev?.audit_data_integrity || null
    }));
  }, [
    options.adminQueryEnabled,
    options.adminDeployStatusQueryData,
    options.adminAuditPhaseStatusQueryData,
    options.adminAuditIntegrityQueryData,
    options.setAdminPanels
  ]);

  useEffect(() => {
    if (!options.hasActiveAuth || options.workspace !== "player") {
      return;
    }
    if (options.tab === "home") {
      void options.refreshHome();
      return;
    }
    if (options.tab === "pvp") {
      void Promise.all([options.refreshLeagueOverview(), options.refreshPvpLive()]);
      return;
    }
    if (options.tab === "vault") {
      void options.refreshVault();
    }
  }, [
    options.tab,
    options.workspace,
    options.hasActiveAuth,
    options.activeAuth.uid,
    options.activeAuth.ts,
    options.activeAuth.sig
  ]);
}
