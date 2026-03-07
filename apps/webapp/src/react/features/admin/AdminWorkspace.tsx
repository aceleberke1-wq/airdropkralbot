import type { Lang } from "../../i18n";
import type { LaunchContext } from "../../types";
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
  launchContext: LaunchContext | null;
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
    runtimeFlags: boolean;
    runtimeBot: boolean;
    runtimeMeta: boolean;
  };
  dynamicPolicyData: Record<string, unknown> | null;
  dynamicPolicyTokenSymbol: string;
  dynamicPolicyDraft: string;
  dynamicPolicyError: string;
  dynamicPolicySaving: boolean;
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
    launchContext: props.launchContext,
    reducedMotion: props.reducedMotion,
    trackUiEvent: props.trackUiEvent
  });

  return (
    <AdminPanel
      lang={props.lang}
      isAdmin={props.isAdmin}
      advanced={props.advanced}
      onRouteTarget={routeToTarget}
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
