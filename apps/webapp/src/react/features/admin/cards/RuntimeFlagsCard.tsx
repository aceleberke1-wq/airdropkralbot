import { t, type Lang } from "../../../i18n";
import { SHELL_ACTION_KEY } from "../../../../core/navigation/shellActions.js";

type RuntimeFlagsCardProps = {
  lang: Lang;
  runtimeFlagsData: Record<string, unknown> | null;
  runtimeFlagsDraft: string;
  runtimeFlagsError: string;
  runtimeFlagsSaving: boolean;
  onRuntimeFlagsDraftChange: (value: string) => void;
  onRefreshRuntimeFlags: () => void;
  onSaveRuntimeFlags: () => void;
  onSurfaceAction: (sectionKey: string, slotKey: string, fallbackActionKey: string, sourcePanelKey?: string) => void;
};

export function RuntimeFlagsCard(props: RuntimeFlagsCardProps) {
  return (
    <section className="akrCard akrCardWide" data-akr-panel-key="panel_admin_runtime" data-akr-focus-key="runtime_flags">
      <h3>{t(props.lang, "admin_runtime_flags_title")}</h3>
      <div className="akrActionRow">
        <button className="akrBtn akrBtnGhost" onClick={props.onRefreshRuntimeFlags}>
          {t(props.lang, "admin_runtime_flags_refresh")}
        </button>
        <button
          className="akrBtn akrBtnGhost"
          onClick={() => props.onSurfaceAction("admin_runtime_flags", "policy", SHELL_ACTION_KEY.ADMIN_POLICY_PANEL, "panel_admin_runtime")}
        >
          {t(props.lang, "admin_nav_policy")}
        </button>
        <button
          className="akrBtn akrBtnGhost"
          onClick={() => props.onSurfaceAction("admin_runtime_flags", "bot", SHELL_ACTION_KEY.ADMIN_RUNTIME_BOT, "panel_admin_runtime")}
        >
          {t(props.lang, "admin_nav_bot")}
        </button>
        <button
          className="akrBtn akrBtnGhost"
          onClick={() => props.onSurfaceAction("admin_runtime_flags", "runtime", SHELL_ACTION_KEY.ADMIN_RUNTIME_META, "panel_admin_runtime")}
        >
          {t(props.lang, "admin_nav_runtime")}
        </button>
        <button className="akrBtn akrBtnAccent" onClick={props.onSaveRuntimeFlags} disabled={props.runtimeFlagsSaving}>
          {props.runtimeFlagsSaving ? t(props.lang, "admin_runtime_flags_saving") : t(props.lang, "admin_runtime_flags_save")}
        </button>
      </div>
      <textarea
        className="akrTextarea"
        value={props.runtimeFlagsDraft}
        onChange={(e) => props.onRuntimeFlagsDraftChange(e.target.value)}
        aria-label="runtime-flags-draft"
        spellCheck={false}
      />
      {props.runtimeFlagsError ? <p className="akrErrorLine">{props.runtimeFlagsError}</p> : null}
      <pre className="akrJsonBlock">{JSON.stringify(props.runtimeFlagsData || {}, null, 2)}</pre>
    </section>
  );
}
