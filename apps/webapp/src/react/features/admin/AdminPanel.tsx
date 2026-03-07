import { t, type Lang } from "../../i18n";
import { AdminQueueCard } from "./cards/AdminQueueCard";
import { DynamicPolicyCard } from "./cards/DynamicPolicyCard";
import { RuntimeBotCard } from "./cards/RuntimeBotCard";
import { RuntimeFlagsCard } from "./cards/RuntimeFlagsCard";
import { RuntimeMetaCard } from "./cards/RuntimeMetaCard";

type QueueActionState = {
  action_key: string;
  kind: string;
  request_id: string;
  tx_hash: string;
  reason: string;
  confirm_token: string;
};

type AdminPanelProps = {
  lang: Lang;
  isAdmin: boolean;
  advanced: boolean;
  onRouteTarget: (input: { routeKey?: string; panelKey?: string; focusKey?: string; sourcePanelKey?: string }) => void;
  adminRuntime: {
    summary: Record<string, unknown> | null;
    queue: Array<Record<string, unknown>>;
  };
  adminPanels: Record<string, unknown> | null;
  queueAction: QueueActionState;
  onQueueActionChange: (patch: Partial<QueueActionState>) => void;
  onRefresh: () => void;
  onRunQueueAction: () => void;
  dynamicPolicyData: Record<string, unknown> | null;
  dynamicPolicyTokenSymbol: string;
  dynamicPolicyDraft: string;
  dynamicPolicyError: string;
  dynamicPolicySaving: boolean;
  onDynamicPolicyTokenSymbolChange: (value: string) => void;
  onDynamicPolicyDraftChange: (value: string) => void;
  onRefreshDynamicPolicy: () => void;
  onSaveDynamicPolicy: () => void;
  runtimeFlagsData: Record<string, unknown> | null;
  runtimeFlagsDraft: string;
  runtimeFlagsError: string;
  runtimeFlagsSaving: boolean;
  onRuntimeFlagsDraftChange: (value: string) => void;
  onRefreshRuntimeFlags: () => void;
  onSaveRuntimeFlags: () => void;
  botRuntimeData: Record<string, unknown> | null;
  botReconcileDraft: string;
  botReconcileError: string;
  botReconcileSaving: boolean;
  onBotReconcileDraftChange: (value: string) => void;
  onRefreshBotRuntime: () => void;
  onRunBotReconcile: () => void;
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
  onRefreshRuntimeMeta: () => void;
  onRefreshOpsKpi: () => void;
  onRunOpsKpi: () => void;
  onReloadAssets: () => void;
  panelVisibility: {
    queue: boolean;
    dynamicPolicy: boolean;
    runtimeFlags: boolean;
    runtimeBot: boolean;
    runtimeMeta: boolean;
  };
};

function DisabledPanel(props: { lang: Lang; title: string }) {
  return (
    <section className="akrCard akrCardWide">
      <h3>{props.title}</h3>
      <p className="akrErrorLine">{t(props.lang, "admin_panel_disabled")}</p>
    </section>
  );
}

export function AdminPanel(props: AdminPanelProps) {
  return (
    <main className="akrPanelGrid">
      <section className="akrCard akrCardWide" data-akr-panel-key="panel_admin" data-akr-focus-key="admin_summary">
        <h2>{t(props.lang, "admin_title")}</h2>
        {!props.isAdmin && <p className="akrErrorLine">{t(props.lang, "admin_access_denied")}</p>}
        {props.isAdmin ? (
          <div className="akrActionRow">
            {props.panelVisibility.queue ? (
              <button
                className="akrBtn akrBtnGhost"
                onClick={() =>
                  props.onRouteTarget({
                    routeKey: "admin",
                    panelKey: "panel_admin_queue",
                    focusKey: "queue_action",
                    sourcePanelKey: "panel_admin"
                  })
                }
              >
                {t(props.lang, "admin_nav_queue")}
              </button>
            ) : null}
            {props.panelVisibility.dynamicPolicy ? (
              <button
                className="akrBtn akrBtnGhost"
                onClick={() =>
                  props.onRouteTarget({
                    routeKey: "admin",
                    panelKey: "panel_admin_policy",
                    focusKey: "dynamic_policy",
                    sourcePanelKey: "panel_admin"
                  })
                }
              >
                {t(props.lang, "admin_nav_policy")}
              </button>
            ) : null}
            {props.panelVisibility.runtimeFlags ? (
              <button
                className="akrBtn akrBtnGhost"
                onClick={() =>
                  props.onRouteTarget({
                    routeKey: "admin",
                    panelKey: "panel_admin_runtime",
                    focusKey: "runtime_flags",
                    sourcePanelKey: "panel_admin"
                  })
                }
              >
                {t(props.lang, "admin_nav_flags")}
              </button>
            ) : null}
            {props.panelVisibility.runtimeBot ? (
              <button
                className="akrBtn akrBtnGhost"
                onClick={() =>
                  props.onRouteTarget({
                    routeKey: "admin",
                    panelKey: "panel_admin_runtime",
                    focusKey: "runtime_bot",
                    sourcePanelKey: "panel_admin"
                  })
                }
              >
                {t(props.lang, "admin_nav_bot")}
              </button>
            ) : null}
            {props.panelVisibility.runtimeMeta ? (
              <button
                className="akrBtn akrBtnGhost"
                onClick={() =>
                  props.onRouteTarget({
                    routeKey: "admin",
                    panelKey: "panel_admin_runtime",
                    focusKey: "runtime_meta",
                    sourcePanelKey: "panel_admin"
                  })
                }
              >
                {t(props.lang, "admin_nav_runtime")}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      {props.isAdmin && (
        <>
          {props.panelVisibility.queue ? (
            <AdminQueueCard
              lang={props.lang}
              advanced={props.advanced}
              adminRuntime={props.adminRuntime}
              queueAction={props.queueAction}
              onQueueActionChange={props.onQueueActionChange}
              onRefresh={props.onRefresh}
              onRunQueueAction={props.onRunQueueAction}
            />
          ) : (
            <DisabledPanel lang={props.lang} title={t(props.lang, "admin_queue_title")} />
          )}
          {props.panelVisibility.dynamicPolicy ? (
            <DynamicPolicyCard
              lang={props.lang}
              dynamicPolicyData={props.dynamicPolicyData}
              dynamicPolicyTokenSymbol={props.dynamicPolicyTokenSymbol}
              dynamicPolicyDraft={props.dynamicPolicyDraft}
              dynamicPolicyError={props.dynamicPolicyError}
              dynamicPolicySaving={props.dynamicPolicySaving}
              onDynamicPolicyTokenSymbolChange={props.onDynamicPolicyTokenSymbolChange}
              onDynamicPolicyDraftChange={props.onDynamicPolicyDraftChange}
              onRefreshDynamicPolicy={props.onRefreshDynamicPolicy}
              onSaveDynamicPolicy={props.onSaveDynamicPolicy}
            />
          ) : (
            <DisabledPanel lang={props.lang} title={t(props.lang, "admin_dynamic_policy_title")} />
          )}
          {props.panelVisibility.runtimeFlags ? (
            <RuntimeFlagsCard
              lang={props.lang}
              runtimeFlagsData={props.runtimeFlagsData}
              runtimeFlagsDraft={props.runtimeFlagsDraft}
              runtimeFlagsError={props.runtimeFlagsError}
              runtimeFlagsSaving={props.runtimeFlagsSaving}
              onRuntimeFlagsDraftChange={props.onRuntimeFlagsDraftChange}
              onRefreshRuntimeFlags={props.onRefreshRuntimeFlags}
              onSaveRuntimeFlags={props.onSaveRuntimeFlags}
            />
          ) : (
            <DisabledPanel lang={props.lang} title={t(props.lang, "admin_runtime_flags_title")} />
          )}
          {props.panelVisibility.runtimeBot ? (
            <RuntimeBotCard
              lang={props.lang}
              botRuntimeData={props.botRuntimeData}
              botReconcileDraft={props.botReconcileDraft}
              botReconcileError={props.botReconcileError}
              botReconcileSaving={props.botReconcileSaving}
              onBotReconcileDraftChange={props.onBotReconcileDraftChange}
              onRefreshBotRuntime={props.onRefreshBotRuntime}
              onRunBotReconcile={props.onRunBotReconcile}
            />
          ) : (
            <DisabledPanel lang={props.lang} title={t(props.lang, "admin_runtime_bot_title")} />
          )}
          {props.panelVisibility.runtimeMeta ? (
            <RuntimeMetaCard
              lang={props.lang}
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
            />
          ) : (
            <DisabledPanel lang={props.lang} title={t(props.lang, "admin_runtime_meta_title")} />
          )}
        </>
      )}

      {props.isAdmin && (
        <section className="akrCard akrCardWide">
          <h3>{t(props.lang, "admin_panel_dump_title")}</h3>
          <pre className="akrJsonBlock">{JSON.stringify(props.adminPanels || {}, null, 2)}</pre>
        </section>
      )}
    </main>
  );
}
