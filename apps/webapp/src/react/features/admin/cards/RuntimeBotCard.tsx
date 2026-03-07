import { t, type Lang } from "../../../i18n";

type RuntimeBotCardProps = {
  lang: Lang;
  botRuntimeData: Record<string, unknown> | null;
  botReconcileDraft: string;
  botReconcileError: string;
  botReconcileSaving: boolean;
  onBotReconcileDraftChange: (value: string) => void;
  onRefreshBotRuntime: () => void;
  onRunBotReconcile: () => void;
};

export function RuntimeBotCard(props: RuntimeBotCardProps) {
  return (
    <section className="akrCard akrCardWide" data-akr-panel-key="panel_admin_runtime" data-akr-focus-key="runtime_bot">
      <h3>{t(props.lang, "admin_runtime_bot_title")}</h3>
      <div className="akrActionRow">
        <button className="akrBtn akrBtnGhost" onClick={props.onRefreshBotRuntime}>
          {t(props.lang, "admin_runtime_bot_refresh")}
        </button>
        <button className="akrBtn akrBtnAccent" onClick={props.onRunBotReconcile} disabled={props.botReconcileSaving}>
          {props.botReconcileSaving ? t(props.lang, "admin_runtime_bot_reconciling") : t(props.lang, "admin_runtime_bot_reconcile")}
        </button>
      </div>
      <textarea
        className="akrTextarea"
        value={props.botReconcileDraft}
        onChange={(e) => props.onBotReconcileDraftChange(e.target.value)}
        aria-label="runtime-bot-reconcile-draft"
        spellCheck={false}
      />
      {props.botReconcileError ? <p className="akrErrorLine">{props.botReconcileError}</p> : null}
      <pre className="akrJsonBlock">{JSON.stringify(props.botRuntimeData || {}, null, 2)}</pre>
    </section>
  );
}
