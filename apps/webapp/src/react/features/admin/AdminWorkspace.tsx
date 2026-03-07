import type { Lang } from "../../i18n";
import { resolveShellActionTarget } from "../../../core/navigation/shellActions.js";
import { AdminPanel } from "./AdminPanel";
import { useAdminNavigationController } from "./useAdminNavigationController";

type QueueActionState = {
  action_key: string;
  kind: string;
  request_id: string;
  tx_hash: string;
  reason: string;
  confirm_token: string;
};

type AdminWorkspaceProps = {
  lang: Lang;
  isAdmin: boolean;
  advanced: boolean;
  reducedMotion: boolean;
  trackUiEvent: (payload: Record<string, unknown>) => void;
  adminRuntime: {
    summary: Record<string, unknown> | null;
    queue: Array<Record<string, unknown>>;
  };
  adminPanels: Record<string, unknown> | null;
  queueAction: QueueActionState;
  panelVisibility: {
    queue: boolean;
    dynamicPolicy: boolean;
    liveOps: boolean;
    runtimeFlags: boolean;
    runtimeBot: boolean;
    runtimeMeta: boolean;
  };
  dynamicPolicyData: Record<string, unknown> | null;
  dynamicPolicyTokenSymbol: string;
  dynamicPolicyDraft: string;
  dynamicPolicyError: string;
  dynamicPolicySaving: boolean;
  liveOpsCampaignData: Record<string, unknown> | null;
  liveOpsCampaignDispatchData: Record<string, unknown> | null;
  liveOpsCampaignDraft: string;
  liveOpsCampaignError: string;
  liveOpsCampaignApprovalError: string;
  liveOpsCampaignDispatchError: string;
  liveOpsCampaignSaving: boolean;
  liveOpsCampaignApprovaling: boolean;
  liveOpsCampaignDispatching: boolean;
  runtimeFlagsData: Record<string, unknown> | null;
  runtimeFlagsDraft: string;
  runtimeFlagsError: string;
  runtimeFlagsSaving: boolean;
  botRuntimeData: Record<string, unknown> | null;
  botReconcileDraft: string;
  botReconcileError: string;
  botReconcileSaving: boolean;
  metricsData: Record<string, unknown> | null;
  opsKpiData: Record<string, unknown> | null;
  opsKpiRunData: Record<string, unknown> | null;
  opsKpiRunError: string;
  opsKpiRunning: boolean;
  deployStatusData: Record<string, unknown> | null;
  assetsStatusData: Record<string, unknown> | null;
  assetsReloading: boolean;
  auditPhaseStatusData: Record<string, unknown> | null;
  auditIntegrityData: Record<string, unknown> | null;
  onQueueActionChange: (patch: Partial<QueueActionState>) => void;
  onRefresh: () => void;
  onRunQueueAction: () => void;
  onDynamicPolicyTokenSymbolChange: (value: string) => void;
  onDynamicPolicyDraftChange: (value: string) => void;
  onRefreshDynamicPolicy: () => void;
  onSaveDynamicPolicy: () => void;
  onLiveOpsCampaignDraftChange: (value: string) => void;
  onRefreshLiveOpsCampaign: () => void;
  onSaveLiveOpsCampaign: () => void;
  onRequestLiveOpsCampaignApproval: () => void;
  onApproveLiveOpsCampaign: () => void;
  onRevokeLiveOpsCampaignApproval: () => void;
  onDryRunLiveOpsCampaign: () => void;
  onDispatchLiveOpsCampaign: () => void;
  onRuntimeFlagsDraftChange: (value: string) => void;
  onRefreshRuntimeFlags: () => void;
  onSaveRuntimeFlags: () => void;
  onBotReconcileDraftChange: (value: string) => void;
  onRefreshBotRuntime: () => void;
  onRunBotReconcile: () => void;
  onRefreshRuntimeMeta: () => void;
  onRefreshOpsKpi: () => void;
  onRunOpsKpi: () => void;
  onReloadAssets: () => void;
};

export function AdminWorkspace(props: AdminWorkspaceProps) {
  const { routeToTarget } = useAdminNavigationController({
    reducedMotion: props.reducedMotion,
    trackUiEvent: props.trackUiEvent
  });
  const runShellAction = (actionKey: string, sourcePanelKey = "") => {
    const target = resolveShellActionTarget(actionKey);
    if (!target || target.workspace !== "admin") {
      return;
    }
    routeToTarget({
      routeKey: target.route_key,
      panelKey: target.panel_key,
      focusKey: target.focus_key,
      actionKey: target.action_key,
      sourcePanelKey
    });
  };

  return (
    <AdminPanel
      lang={props.lang}
      isAdmin={props.isAdmin}
      advanced={props.advanced}
      onShellAction={runShellAction}
      adminRuntime={props.adminRuntime}
      adminPanels={props.adminPanels}
      queueAction={props.queueAction}
      onQueueActionChange={props.onQueueActionChange}
      onRefresh={props.onRefresh}
      onRunQueueAction={props.onRunQueueAction}
      dynamicPolicyData={props.dynamicPolicyData}
      dynamicPolicyTokenSymbol={props.dynamicPolicyTokenSymbol}
      dynamicPolicyDraft={props.dynamicPolicyDraft}
      dynamicPolicyError={props.dynamicPolicyError}
      dynamicPolicySaving={props.dynamicPolicySaving}
      onDynamicPolicyTokenSymbolChange={props.onDynamicPolicyTokenSymbolChange}
      onDynamicPolicyDraftChange={props.onDynamicPolicyDraftChange}
      onRefreshDynamicPolicy={props.onRefreshDynamicPolicy}
      onSaveDynamicPolicy={props.onSaveDynamicPolicy}
      liveOpsCampaignData={props.liveOpsCampaignData}
      liveOpsCampaignDispatchData={props.liveOpsCampaignDispatchData}
      liveOpsCampaignDraft={props.liveOpsCampaignDraft}
      liveOpsCampaignError={props.liveOpsCampaignError}
      liveOpsCampaignApprovalError={props.liveOpsCampaignApprovalError}
      liveOpsCampaignDispatchError={props.liveOpsCampaignDispatchError}
      liveOpsCampaignSaving={props.liveOpsCampaignSaving}
      liveOpsCampaignApprovaling={props.liveOpsCampaignApprovaling}
      liveOpsCampaignDispatching={props.liveOpsCampaignDispatching}
      onLiveOpsCampaignDraftChange={props.onLiveOpsCampaignDraftChange}
      onRefreshLiveOpsCampaign={props.onRefreshLiveOpsCampaign}
      onSaveLiveOpsCampaign={props.onSaveLiveOpsCampaign}
      onRequestLiveOpsCampaignApproval={props.onRequestLiveOpsCampaignApproval}
      onApproveLiveOpsCampaign={props.onApproveLiveOpsCampaign}
      onRevokeLiveOpsCampaignApproval={props.onRevokeLiveOpsCampaignApproval}
      onDryRunLiveOpsCampaign={props.onDryRunLiveOpsCampaign}
      onDispatchLiveOpsCampaign={props.onDispatchLiveOpsCampaign}
      runtimeFlagsData={props.runtimeFlagsData}
      runtimeFlagsDraft={props.runtimeFlagsDraft}
      runtimeFlagsError={props.runtimeFlagsError}
      runtimeFlagsSaving={props.runtimeFlagsSaving}
      onRuntimeFlagsDraftChange={props.onRuntimeFlagsDraftChange}
      onRefreshRuntimeFlags={props.onRefreshRuntimeFlags}
      onSaveRuntimeFlags={props.onSaveRuntimeFlags}
      botRuntimeData={props.botRuntimeData}
      botReconcileDraft={props.botReconcileDraft}
      botReconcileError={props.botReconcileError}
      botReconcileSaving={props.botReconcileSaving}
      onBotReconcileDraftChange={props.onBotReconcileDraftChange}
      onRefreshBotRuntime={props.onRefreshBotRuntime}
      onRunBotReconcile={props.onRunBotReconcile}
      metricsData={props.metricsData}
      opsKpiData={props.opsKpiData}
      opsKpiRunData={props.opsKpiRunData}
      opsKpiRunError={props.opsKpiRunError}
      opsKpiRunning={props.opsKpiRunning}
      deployStatusData={props.deployStatusData}
      assetsStatusData={props.assetsStatusData}
      assetsReloading={props.assetsReloading}
      auditPhaseStatusData={props.auditPhaseStatusData}
      auditIntegrityData={props.auditIntegrityData}
      onRefreshRuntimeMeta={props.onRefreshRuntimeMeta}
      onRefreshOpsKpi={props.onRefreshOpsKpi}
      onRunOpsKpi={props.onRunOpsKpi}
      onReloadAssets={props.onReloadAssets}
      panelVisibility={props.panelVisibility}
    />
  );
}
