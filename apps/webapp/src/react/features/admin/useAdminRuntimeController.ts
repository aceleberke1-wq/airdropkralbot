import { useCallback } from "react";
import {
  parseLiveOpsCampaignDraft,
  parseBotReconcileDraft,
  parseDynamicPolicySegmentsDraft,
  parseRuntimeFlagsDraft
} from "../../../core/admin/adminDraftParsers";
import { UI_EVENT_KEY, UI_FUNNEL_KEY, UI_SURFACE_KEY } from "../../../core/telemetry/uiEventTaxonomy";
import type { WebAppApiResponse, WebAppAuth } from "../../types";

type RefetchableQuery = {
  refetch: () => Promise<any>;
};

type MutationRunner = (payload: Record<string, unknown>) => { unwrap: () => Promise<any> };

type AdminRuntimeControllerOptions = {
  adminQueryEnabled: boolean;
  activeAuth: WebAppAuth;
  dynamicPolicyTokenSymbol: string;
  dynamicPolicyDraft: string;
  liveOpsCampaignDraft: string;
  runtimeFlagsDraft: string;
  botReconcileDraft: string;
  setDynamicPolicyDraft: (next: string | ((prev: string) => string)) => void;
  setDynamicPolicyError: (next: string) => void;
  setLiveOpsCampaignDraft: (next: string | ((prev: string) => string)) => void;
  setLiveOpsCampaignError: (next: string) => void;
  setLiveOpsCampaignApprovalError: (next: string) => void;
  setLiveOpsCampaignDispatchError: (next: string) => void;
  setRuntimeFlagsDraft: (next: string | ((prev: string) => string)) => void;
  setRuntimeFlagsError: (next: string) => void;
  setBotReconcileDraft: (next: string | ((prev: string) => string)) => void;
  setBotReconcileError: (next: string) => void;
  setOpsKpiRunError: (next: string) => void;
  setAdminPanels: (updater: (prev: any) => any) => void;
  setAdminRuntime: (summary: Record<string, unknown> | null, queue: Array<Record<string, unknown>>) => void;
  setError: (next: string) => void;
  asError: (payload: WebAppApiResponse | null | undefined, fallback?: string) => string;
  ensureAdminPanelEnabled: (panelKey: "dynamicPolicy" | "liveOps" | "runtimeFlags" | "runtimeBot" | "runtimeMeta") => boolean;
  trackUiEvent: (payload: Record<string, unknown>) => void;
  applySession: (payload: any) => void;
  adminBootstrapQuery: RefetchableQuery;
  adminQueueQuery: RefetchableQuery;
  adminMetricsQuery: RefetchableQuery;
  adminLiveOpsCampaignQuery: RefetchableQuery;
  adminOpsKpiLatestQuery: RefetchableQuery;
  adminAssetsQuery: RefetchableQuery;
  adminRuntimeFlagsQuery: RefetchableQuery;
  adminRuntimeBotQuery: RefetchableQuery;
  adminDeployStatusQuery: RefetchableQuery;
  adminAuditPhaseStatusQuery: RefetchableQuery;
  adminAuditIntegrityQuery: RefetchableQuery;
  adminDynamicPolicyQuery: RefetchableQuery;
  adminLiveOpsCampaignUpsert: MutationRunner;
  adminLiveOpsCampaignApproval: MutationRunner;
  adminLiveOpsCampaignDispatch: MutationRunner;
  adminDynamicPolicyUpsert: MutationRunner;
  adminRuntimeFlagsUpdate: MutationRunner;
  adminRuntimeBotReconcile: MutationRunner;
  adminOpsKpiRun: MutationRunner;
  adminAssetsReload: MutationRunner;
};

export function useAdminRuntimeController(options: AdminRuntimeControllerOptions) {
  const refreshAdmin = useCallback(async () => {
    if (!options.adminQueryEnabled) return;
    const [
      summaryRefetch,
      queueRefetch,
      metricsRefetch,
      liveOpsRefetch,
      opsKpiRefetch,
      assetsRefetch,
      runtimeFlagsRefetch,
      runtimeBotRefetch,
      deployStatusRefetch,
      auditPhaseRefetch,
      auditIntegrityRefetch,
      dynamicPolicyRefetch
    ] = await Promise.all([
      options.adminBootstrapQuery.refetch().catch(() => null),
      options.adminQueueQuery.refetch().catch(() => null),
      options.adminMetricsQuery.refetch().catch(() => null),
      options.adminLiveOpsCampaignQuery.refetch().catch(() => null),
      options.adminOpsKpiLatestQuery.refetch().catch(() => null),
      options.adminAssetsQuery.refetch().catch(() => null),
      options.adminRuntimeFlagsQuery.refetch().catch(() => null),
      options.adminRuntimeBotQuery.refetch().catch(() => null),
      options.adminDeployStatusQuery.refetch().catch(() => null),
      options.adminAuditPhaseStatusQuery.refetch().catch(() => null),
      options.adminAuditIntegrityQuery.refetch().catch(() => null),
      options.adminDynamicPolicyQuery.refetch().catch(() => null)
    ]);
    const summary = (summaryRefetch?.data || null) as WebAppApiResponse | null;
    const queue = (queueRefetch?.data || null) as WebAppApiResponse | null;
    const metrics = (metricsRefetch?.data || null) as WebAppApiResponse | null;
    const liveOpsCampaign = (liveOpsRefetch?.data || null) as WebAppApiResponse | null;
    const opsKpi = (opsKpiRefetch?.data || null) as WebAppApiResponse | null;
    const assets = (assetsRefetch?.data || null) as WebAppApiResponse | null;
    const runtimeFlags = (runtimeFlagsRefetch?.data || null) as WebAppApiResponse | null;
    const runtimeBot = (runtimeBotRefetch?.data || null) as WebAppApiResponse | null;
    const deployStatus = (deployStatusRefetch?.data || null) as WebAppApiResponse | null;
    const auditPhaseStatus = (auditPhaseRefetch?.data || null) as WebAppApiResponse | null;
    const auditDataIntegrity = (auditIntegrityRefetch?.data || null) as WebAppApiResponse | null;
    const dynamicPolicy = (dynamicPolicyRefetch?.data || null) as WebAppApiResponse | null;
    if (summary && !summary.success) {
      options.setError(options.asError(summary, "admin_bootstrap_failed"));
      return;
    }
    options.setAdminRuntime(summary?.data || null, (queue?.data as any)?.items || []);
    options.setAdminPanels((prev: any) => ({
      ...(prev || {}),
      metrics: metrics?.data || null,
      live_ops_campaign: liveOpsCampaign?.data || null,
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
      options.setRuntimeFlagsDraft(JSON.stringify(boolFlags, null, 2));
      options.setRuntimeFlagsError("");
    }
    if (runtimeBot?.success) {
      const fallbackStateKey = String((runtimeBot.data as { latest?: { state_key?: string } } | undefined)?.latest?.state_key || "");
      if (fallbackStateKey) {
        options.setBotReconcileDraft((prev) => {
          const current = String(prev || "").trim();
          if (current && current !== '{"state_key":"","reason":"","force_stop":false}') {
            return prev;
          }
          return JSON.stringify({ state_key: fallbackStateKey, reason: "", force_stop: false }, null, 2);
        });
      }
      options.setBotReconcileError("");
    }
    if (dynamicPolicy?.success) {
      const segments = Array.isArray((dynamicPolicy.data as { segments?: Array<Record<string, unknown>> } | undefined)?.segments)
        ? ((dynamicPolicy.data as { segments?: Array<Record<string, unknown>> }).segments as Array<Record<string, unknown>>)
        : [];
      options.setDynamicPolicyDraft(JSON.stringify(segments, null, 2));
      options.setDynamicPolicyError("");
    }
    if (liveOpsCampaign?.success) {
      const campaignPayload =
        (liveOpsCampaign.data as { campaign?: Record<string, unknown> } | undefined)?.campaign ||
        (liveOpsCampaign.data as Record<string, unknown> | undefined) ||
        {};
      options.setLiveOpsCampaignDraft(JSON.stringify(campaignPayload, null, 2));
      options.setLiveOpsCampaignError("");
      options.setLiveOpsCampaignApprovalError("");
      options.setLiveOpsCampaignDispatchError("");
    }
  }, [options]);

  const refreshDynamicPolicy = useCallback(async () => {
    if (!options.adminQueryEnabled) return;
    if (!options.ensureAdminPanelEnabled("dynamicPolicy")) return;
    options.setDynamicPolicyError("");
    const refetch = await options.adminDynamicPolicyQuery.refetch().catch(() => null);
    const payload = (refetch?.data || null) as WebAppApiResponse | null;
    if (!payload?.success) {
      options.setDynamicPolicyError(options.asError(payload, "dynamic_policy_fetch_failed"));
      return;
    }
    const segments = Array.isArray((payload.data as { segments?: Array<Record<string, unknown>> } | undefined)?.segments)
      ? ((payload.data as { segments?: Array<Record<string, unknown>> }).segments as Array<Record<string, unknown>>)
      : [];
    options.setDynamicPolicyDraft(JSON.stringify(segments, null, 2));
    options.setAdminPanels((prev: any) => ({
      ...(prev || {}),
      dynamic_policy: payload.data || null
    }));
  }, [options]);

  const saveDynamicPolicy = useCallback(async () => {
    if (!options.adminQueryEnabled) return;
    if (!options.ensureAdminPanelEnabled("dynamicPolicy")) return;
    options.setDynamicPolicyError("");
    const parsedDraft = parseDynamicPolicySegmentsDraft(options.dynamicPolicyDraft || "[]");
    if (!parsedDraft.ok) {
      options.setDynamicPolicyError(parsedDraft.error || "dynamic_policy_invalid_json");
      return;
    }
    const payload = await options.adminDynamicPolicyUpsert({
      auth: options.activeAuth,
      token_symbol: String(options.dynamicPolicyTokenSymbol || "").trim().toUpperCase() || undefined,
      replace_missing: true,
      reason: "webapp_admin_dynamic_auto_policy_update",
      segments: parsedDraft.segments as Array<Record<string, unknown>>
    })
      .unwrap()
      .catch(() => null);
    if (!payload?.success) {
      options.setDynamicPolicyError(options.asError(payload, "dynamic_policy_save_failed"));
      return;
    }
    const segments = Array.isArray((payload.data as { segments?: Array<Record<string, unknown>> } | undefined)?.segments)
      ? ((payload.data as { segments?: Array<Record<string, unknown>> }).segments as Array<Record<string, unknown>>)
      : [];
    options.setDynamicPolicyDraft(JSON.stringify(segments, null, 2));
    options.setAdminPanels((prev: any) => ({
      ...(prev || {}),
      dynamic_policy: payload.data || null
    }));
    await refreshAdmin();
  }, [options, refreshAdmin]);

  const refreshRuntimeFlags = useCallback(async () => {
    if (!options.adminQueryEnabled) return;
    if (!options.ensureAdminPanelEnabled("runtimeFlags")) return;
    options.setRuntimeFlagsError("");
    const refetch = await options.adminRuntimeFlagsQuery.refetch().catch(() => null);
    const payload = (refetch?.data || null) as WebAppApiResponse | null;
    if (!payload?.success) {
      options.setRuntimeFlagsError(options.asError(payload, "runtime_flags_fetch_failed"));
      return;
    }
    const flagsPayload = (payload.data as { flags?: Record<string, unknown> } | undefined)?.flags || {};
    const boolFlags = Object.fromEntries(
      Object.entries(flagsPayload).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean")
    );
    options.setRuntimeFlagsDraft(JSON.stringify(boolFlags, null, 2));
    options.setAdminPanels((prev: any) => ({
      ...(prev || {}),
      runtime_flags: payload.data || null
    }));
  }, [options]);

  const refreshLiveOpsCampaign = useCallback(async () => {
    if (!options.adminQueryEnabled) return;
    if (!options.ensureAdminPanelEnabled("liveOps")) return;
    options.setLiveOpsCampaignError("");
    options.setLiveOpsCampaignApprovalError("");
    const refetch = await options.adminLiveOpsCampaignQuery.refetch().catch(() => null);
    const payload = (refetch?.data || null) as WebAppApiResponse | null;
    if (!payload?.success) {
      options.setLiveOpsCampaignError(options.asError(payload, "live_ops_campaign_fetch_failed"));
      return;
    }
    const campaignPayload =
      (payload.data as { campaign?: Record<string, unknown> } | undefined)?.campaign ||
      (payload.data as Record<string, unknown> | undefined) ||
      {};
    options.setLiveOpsCampaignDraft(JSON.stringify(campaignPayload, null, 2));
    options.setAdminPanels((prev: any) => ({
      ...(prev || {}),
      live_ops_campaign: payload.data || null
    }));
  }, [options]);

  const saveLiveOpsCampaign = useCallback(async () => {
    if (!options.adminQueryEnabled) return;
    if (!options.ensureAdminPanelEnabled("liveOps")) return;
    options.setLiveOpsCampaignError("");
    options.setLiveOpsCampaignApprovalError("");
    const parsedDraft = parseLiveOpsCampaignDraft(options.liveOpsCampaignDraft || "{}");
    if (!parsedDraft.ok || !parsedDraft.campaign) {
      options.setLiveOpsCampaignError(parsedDraft.error || "live_ops_campaign_invalid_json");
      return;
    }
    options.trackUiEvent({
      event_key: UI_EVENT_KEY.ACTION_REQUEST,
      panel_key: UI_SURFACE_KEY.PANEL_ADMIN_LIVE_OPS,
      funnel_key: UI_FUNNEL_KEY.ADMIN_OPS,
      surface_key: UI_SURFACE_KEY.PANEL_ADMIN_LIVE_OPS,
      payload_json: {
        action_key: "admin_live_ops_campaign_save"
      }
    });
    const payload = await options.adminLiveOpsCampaignUpsert({
      auth: options.activeAuth,
      reason: "webapp_admin_live_ops_campaign_save",
      campaign: parsedDraft.campaign as Record<string, unknown>
    })
      .unwrap()
      .catch(() => null);
    options.applySession(payload);
    if (!payload?.success) {
      const nextError = options.asError(payload, "live_ops_campaign_save_failed");
      options.setLiveOpsCampaignError(nextError);
      options.trackUiEvent({
        event_key: UI_EVENT_KEY.ACTION_FAILED,
        panel_key: UI_SURFACE_KEY.PANEL_ADMIN_LIVE_OPS,
        funnel_key: UI_FUNNEL_KEY.ADMIN_OPS,
        surface_key: UI_SURFACE_KEY.PANEL_ADMIN_LIVE_OPS,
        payload_json: {
          action_key: "admin_live_ops_campaign_save",
          error: nextError
        }
      });
      return;
    }
    const campaignPayload =
      (payload.data as { campaign?: Record<string, unknown> } | undefined)?.campaign ||
      (payload.data as Record<string, unknown> | undefined) ||
      {};
    options.setLiveOpsCampaignDraft(JSON.stringify(campaignPayload, null, 2));
    options.setAdminPanels((prev: any) => ({
      ...(prev || {}),
      live_ops_campaign: payload.data || null
    }));
    options.trackUiEvent({
      event_key: UI_EVENT_KEY.ACTION_SUCCESS,
      panel_key: UI_SURFACE_KEY.PANEL_ADMIN_LIVE_OPS,
      funnel_key: UI_FUNNEL_KEY.ADMIN_OPS,
      surface_key: UI_SURFACE_KEY.PANEL_ADMIN_LIVE_OPS,
      payload_json: {
        action_key: "admin_live_ops_campaign_save"
      }
    });
  }, [options]);

  const updateLiveOpsCampaignApproval = useCallback(
    async (approvalAction: "request" | "approve" | "revoke") => {
      if (!options.adminQueryEnabled) return;
      if (!options.ensureAdminPanelEnabled("liveOps")) return;
      options.setLiveOpsCampaignApprovalError("");
      const parsedDraft = parseLiveOpsCampaignDraft(options.liveOpsCampaignDraft || "{}");
      if (!parsedDraft.ok || !parsedDraft.campaign) {
        options.setLiveOpsCampaignApprovalError(parsedDraft.error || "live_ops_campaign_invalid_json");
        return;
      }
      const actionKey = `admin_live_ops_campaign_${approvalAction}`;
      options.trackUiEvent({
        event_key: UI_EVENT_KEY.ACTION_REQUEST,
        panel_key: UI_SURFACE_KEY.PANEL_ADMIN_LIVE_OPS,
        funnel_key: UI_FUNNEL_KEY.ADMIN_OPS,
        surface_key: UI_SURFACE_KEY.PANEL_ADMIN_LIVE_OPS,
        payload_json: {
          action_key: actionKey
        }
      });
      const payload = await options.adminLiveOpsCampaignApproval({
        auth: options.activeAuth,
        approval_action: approvalAction,
        reason: `webapp_admin_live_ops_campaign_${approvalAction}`,
        campaign: parsedDraft.campaign as Record<string, unknown>
      })
        .unwrap()
        .catch(() => null);
      options.applySession(payload);
      if (!payload?.success) {
        const nextError = options.asError(payload, "live_ops_campaign_approval_failed");
        options.setLiveOpsCampaignApprovalError(nextError);
        options.trackUiEvent({
          event_key: UI_EVENT_KEY.ACTION_FAILED,
          panel_key: UI_SURFACE_KEY.PANEL_ADMIN_LIVE_OPS,
          funnel_key: UI_FUNNEL_KEY.ADMIN_OPS,
          surface_key: UI_SURFACE_KEY.PANEL_ADMIN_LIVE_OPS,
          payload_json: {
            action_key: actionKey,
            error: nextError
          }
        });
        return;
      }
      const campaignPayload =
        (payload.data as { campaign?: Record<string, unknown> } | undefined)?.campaign ||
        (payload.data as Record<string, unknown> | undefined) ||
        {};
      options.setLiveOpsCampaignDraft(JSON.stringify(campaignPayload, null, 2));
      options.setAdminPanels((prev: any) => ({
        ...(prev || {}),
        live_ops_campaign: payload.data || null
      }));
      options.trackUiEvent({
        event_key: UI_EVENT_KEY.ACTION_SUCCESS,
        panel_key: UI_SURFACE_KEY.PANEL_ADMIN_LIVE_OPS,
        funnel_key: UI_FUNNEL_KEY.ADMIN_OPS,
        surface_key: UI_SURFACE_KEY.PANEL_ADMIN_LIVE_OPS,
        payload_json: {
          action_key: actionKey
        }
      });
    },
    [options]
  );

  const runLiveOpsCampaignDispatch = useCallback(
    async (dryRun = true) => {
      if (!options.adminQueryEnabled) return;
      if (!options.ensureAdminPanelEnabled("liveOps")) return;
      options.setLiveOpsCampaignDispatchError("");
      const parsedDraft = parseLiveOpsCampaignDraft(options.liveOpsCampaignDraft || "{}");
      if (!parsedDraft.ok || !parsedDraft.campaign) {
        options.setLiveOpsCampaignDispatchError(parsedDraft.error || "live_ops_campaign_invalid_json");
        return;
      }
      const actionKey = dryRun ? "admin_live_ops_campaign_dry_run" : "admin_live_ops_campaign_dispatch";
      options.trackUiEvent({
        event_key: UI_EVENT_KEY.ACTION_REQUEST,
        panel_key: UI_SURFACE_KEY.PANEL_ADMIN_LIVE_OPS,
        funnel_key: UI_FUNNEL_KEY.ADMIN_OPS,
        surface_key: UI_SURFACE_KEY.PANEL_ADMIN_LIVE_OPS,
        payload_json: {
          action_key: actionKey
        }
      });
      const payload = await options.adminLiveOpsCampaignDispatch({
        auth: options.activeAuth,
        dry_run: dryRun,
        reason: dryRun ? "webapp_admin_live_ops_campaign_dry_run" : "webapp_admin_live_ops_campaign_dispatch",
        campaign: parsedDraft.campaign as Record<string, unknown>
      })
        .unwrap()
        .catch(() => null);
      options.applySession(payload);
      if (!payload?.success) {
        const nextError = options.asError(payload, "live_ops_campaign_dispatch_failed");
        options.setLiveOpsCampaignDispatchError(nextError);
        options.trackUiEvent({
          event_key: UI_EVENT_KEY.ACTION_FAILED,
          panel_key: UI_SURFACE_KEY.PANEL_ADMIN_LIVE_OPS,
          funnel_key: UI_FUNNEL_KEY.ADMIN_OPS,
          surface_key: UI_SURFACE_KEY.PANEL_ADMIN_LIVE_OPS,
          payload_json: {
            action_key: actionKey,
            error: nextError
          }
        });
        return;
      }
      options.setAdminPanels((prev: any) => ({
        ...(prev || {}),
        live_ops_campaign_dispatch: payload.data || null
      }));
      options.trackUiEvent({
        event_key: UI_EVENT_KEY.ACTION_SUCCESS,
        panel_key: UI_SURFACE_KEY.PANEL_ADMIN_LIVE_OPS,
        funnel_key: UI_FUNNEL_KEY.ADMIN_OPS,
        surface_key: UI_SURFACE_KEY.PANEL_ADMIN_LIVE_OPS,
        payload_json: {
          action_key: actionKey,
          dry_run: dryRun
        }
      });
      await refreshLiveOpsCampaign();
    },
    [options, refreshLiveOpsCampaign]
  );

  const saveRuntimeFlags = useCallback(async () => {
    if (!options.adminQueryEnabled) return;
    if (!options.ensureAdminPanelEnabled("runtimeFlags")) return;
    options.setRuntimeFlagsError("");
    const parsedDraft = parseRuntimeFlagsDraft(options.runtimeFlagsDraft || "{}");
    if (!parsedDraft.ok) {
      options.setRuntimeFlagsError(parsedDraft.error || "runtime_flags_invalid_json");
      return;
    }
    const payload = await options.adminRuntimeFlagsUpdate({
      auth: options.activeAuth,
      source_mode: (parsedDraft.source_mode as "env_locked" | "db_override" | undefined) || undefined,
      source_json: (parsedDraft.source_json as Record<string, unknown> | undefined) || undefined,
      flags: parsedDraft.flags
    })
      .unwrap()
      .catch(() => null);
    if (!payload?.success) {
      options.setRuntimeFlagsError(options.asError(payload, "runtime_flags_save_failed"));
      return;
    }
    options.setRuntimeFlagsDraft(JSON.stringify(parsedDraft.flags, null, 2));
    options.setAdminPanels((prev: any) => ({
      ...(prev || {}),
      runtime_flags: payload.data || null
    }));
    await refreshAdmin();
  }, [options, refreshAdmin]);

  const refreshBotRuntime = useCallback(async () => {
    if (!options.adminQueryEnabled) return;
    if (!options.ensureAdminPanelEnabled("runtimeBot")) return;
    options.setBotReconcileError("");
    const refetch = await options.adminRuntimeBotQuery.refetch().catch(() => null);
    const payload = (refetch?.data || null) as WebAppApiResponse | null;
    if (!payload?.success) {
      options.setBotReconcileError(options.asError(payload, "runtime_bot_fetch_failed"));
      return;
    }
    options.setAdminPanels((prev: any) => ({
      ...(prev || {}),
      runtime_bot: payload.data || null
    }));
  }, [options]);

  const runBotReconcile = useCallback(async () => {
    if (!options.adminQueryEnabled) return;
    if (!options.ensureAdminPanelEnabled("runtimeBot")) return;
    options.setBotReconcileError("");
    const parsedDraft = parseBotReconcileDraft(options.botReconcileDraft || "{}");
    if (!parsedDraft.ok) {
      options.setBotReconcileError(parsedDraft.error || "runtime_bot_invalid_json");
      return;
    }
    const payload = await options.adminRuntimeBotReconcile({
      auth: options.activeAuth,
      state_key: parsedDraft.state_key,
      reason: parsedDraft.reason || undefined,
      force_stop: parsedDraft.force_stop
    })
      .unwrap()
      .catch(() => null);
    if (!payload?.success) {
      options.setBotReconcileError(options.asError(payload, "runtime_bot_reconcile_failed"));
      return;
    }
    options.setAdminPanels((prev: any) => ({
      ...(prev || {}),
      runtime_bot_reconcile: payload.data || null
    }));
    await refreshAdmin();
  }, [options, refreshAdmin]);

  const refreshRuntimeMeta = useCallback(async () => {
    if (!options.adminQueryEnabled) return;
    if (!options.ensureAdminPanelEnabled("runtimeMeta")) return;
    const [opsKpiRefetch, deployRefetch, assetsRefetch, auditPhaseRefetch, auditIntegrityRefetch] = await Promise.all([
      options.adminOpsKpiLatestQuery.refetch().catch(() => null),
      options.adminDeployStatusQuery.refetch().catch(() => null),
      options.adminAssetsQuery.refetch().catch(() => null),
      options.adminAuditPhaseStatusQuery.refetch().catch(() => null),
      options.adminAuditIntegrityQuery.refetch().catch(() => null)
    ]);
    options.setAdminPanels((prev: any) => ({
      ...(prev || {}),
      ops_kpi: (opsKpiRefetch?.data as WebAppApiResponse | undefined)?.data || null,
      deploy_status: (deployRefetch?.data as WebAppApiResponse | undefined)?.data || null,
      assets: (assetsRefetch?.data as WebAppApiResponse | undefined)?.data || null,
      audit_phase_status: (auditPhaseRefetch?.data as WebAppApiResponse | undefined)?.data || null,
      audit_data_integrity: (auditIntegrityRefetch?.data as WebAppApiResponse | undefined)?.data || null
    }));
  }, [options]);

  const refreshOpsKpi = useCallback(async () => {
    if (!options.adminQueryEnabled) return;
    if (!options.ensureAdminPanelEnabled("runtimeMeta")) return;
    options.setOpsKpiRunError("");
    const refetch = await options.adminOpsKpiLatestQuery.refetch().catch(() => null);
    const payload = (refetch?.data || null) as WebAppApiResponse | null;
    if (!payload?.success) {
      options.setOpsKpiRunError(options.asError(payload, "admin_ops_kpi_latest_failed"));
      return;
    }
    options.setAdminPanels((prev: any) => ({
      ...(prev || {}),
      ops_kpi: payload.data || null
    }));
  }, [options]);

  const runOpsKpiBundle = useCallback(async () => {
    if (!options.adminQueryEnabled) return;
    if (!options.ensureAdminPanelEnabled("runtimeMeta")) return;
    options.setOpsKpiRunError("");
    options.trackUiEvent({
      event_key: UI_EVENT_KEY.ACTION_REQUEST,
      panel_key: UI_SURFACE_KEY.PANEL_ADMIN_RUNTIME,
      funnel_key: UI_FUNNEL_KEY.ADMIN_OPS,
      surface_key: UI_SURFACE_KEY.PANEL_ADMIN_RUNTIME,
      payload_json: {
        action_key: "admin_ops_kpi_run"
      }
    });
    const payload = await options.adminOpsKpiRun({
      auth: options.activeAuth,
      hours_short: 24,
      hours_long: 72,
      trend_days: 7,
      emit_slo: true
    })
      .unwrap()
      .catch(() => null);
    options.applySession(payload);
    if (!payload?.success) {
      const nextError = options.asError(payload, "admin_ops_kpi_run_failed");
      options.setOpsKpiRunError(nextError);
      options.trackUiEvent({
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
    options.trackUiEvent({
      event_key: UI_EVENT_KEY.ACTION_SUCCESS,
      panel_key: UI_SURFACE_KEY.PANEL_ADMIN_RUNTIME,
      funnel_key: UI_FUNNEL_KEY.ADMIN_OPS,
      surface_key: UI_SURFACE_KEY.PANEL_ADMIN_RUNTIME,
      payload_json: {
        action_key: "admin_ops_kpi_run"
      }
    });
    options.setAdminPanels((prev: any) => ({
      ...(prev || {}),
      ops_kpi: payload.data || null,
      ops_kpi_run: payload.data || null
    }));
    await refreshOpsKpi();
  }, [options, refreshOpsKpi]);

  const reloadAssets = useCallback(async () => {
    if (!options.adminQueryEnabled) return;
    if (!options.ensureAdminPanelEnabled("runtimeMeta")) return;
    const payload = await options.adminAssetsReload({ auth: options.activeAuth })
      .unwrap()
      .catch(() => null);
    if (!payload?.success) {
      options.setError(options.asError(payload, "assets_reload_failed"));
      return;
    }
    options.setAdminPanels((prev: any) => ({
      ...(prev || {}),
      assets_reload: payload.data || null
    }));
    await refreshAdmin();
  }, [options, refreshAdmin]);

  return {
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
  };
}
