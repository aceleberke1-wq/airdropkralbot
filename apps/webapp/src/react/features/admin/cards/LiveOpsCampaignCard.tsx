import { t, type Lang } from "../../../i18n";
import { SHELL_ACTION_KEY } from "../../../../core/navigation/shellActions.js";

type LiveOpsCampaignCardProps = {
  lang: Lang;
  liveOpsCampaignData: Record<string, unknown> | null;
  liveOpsCampaignDispatchData: Record<string, unknown> | null;
  liveOpsCampaignDraft: string;
  liveOpsCampaignError: string;
  liveOpsCampaignDispatchError: string;
  liveOpsCampaignSaving: boolean;
  liveOpsCampaignDispatching: boolean;
  onLiveOpsCampaignDraftChange: (value: string) => void;
  onRefreshLiveOpsCampaign: () => void;
  onSaveLiveOpsCampaign: () => void;
  onDryRunLiveOpsCampaign: () => void;
  onDispatchLiveOpsCampaign: () => void;
  onSurfaceAction: (sectionKey: string, slotKey: string, fallbackActionKey: string, sourcePanelKey?: string) => void;
};

export function LiveOpsCampaignCard(props: LiveOpsCampaignCardProps) {
  return (
    <section className="akrCard akrCardWide" data-akr-panel-key="panel_admin_live_ops" data-akr-focus-key="campaign_editor">
      <h3>{t(props.lang, "admin_live_ops_title")}</h3>
      <div className="akrActionRow">
        <button className="akrBtn akrBtnGhost" onClick={props.onRefreshLiveOpsCampaign}>
          {t(props.lang, "admin_live_ops_refresh")}
        </button>
        <button
          className="akrBtn akrBtnGhost"
          onClick={() => props.onSurfaceAction("admin_live_ops", "queue", SHELL_ACTION_KEY.ADMIN_QUEUE_PANEL, "panel_admin_live_ops")}
        >
          {t(props.lang, "admin_nav_queue")}
        </button>
        <button
          className="akrBtn akrBtnGhost"
          onClick={() => props.onSurfaceAction("admin_live_ops", "policy", SHELL_ACTION_KEY.ADMIN_POLICY_PANEL, "panel_admin_live_ops")}
        >
          {t(props.lang, "admin_nav_policy")}
        </button>
        <button
          className="akrBtn akrBtnGhost"
          onClick={() => props.onSurfaceAction("admin_live_ops", "runtime", SHELL_ACTION_KEY.ADMIN_RUNTIME_META, "panel_admin_live_ops")}
        >
          {t(props.lang, "admin_nav_runtime")}
        </button>
        <button className="akrBtn akrBtnAccent" onClick={props.onSaveLiveOpsCampaign} disabled={props.liveOpsCampaignSaving}>
          {props.liveOpsCampaignSaving ? t(props.lang, "admin_live_ops_saving") : t(props.lang, "admin_live_ops_save")}
        </button>
        <button className="akrBtn akrBtnGhost" onClick={props.onDryRunLiveOpsCampaign} disabled={props.liveOpsCampaignDispatching}>
          {props.liveOpsCampaignDispatching ? t(props.lang, "admin_live_ops_dispatching") : t(props.lang, "admin_live_ops_dry_run")}
        </button>
        <button className="akrBtn akrBtnAccent" onClick={props.onDispatchLiveOpsCampaign} disabled={props.liveOpsCampaignDispatching}>
          {props.liveOpsCampaignDispatching ? t(props.lang, "admin_live_ops_dispatching") : t(props.lang, "admin_live_ops_dispatch")}
        </button>
      </div>
      <textarea
        className="akrTextarea"
        value={props.liveOpsCampaignDraft}
        onChange={(e) => props.onLiveOpsCampaignDraftChange(e.target.value)}
        aria-label="live-ops-campaign-draft"
        spellCheck={false}
      />
      {props.liveOpsCampaignError ? <p className="akrErrorLine">{props.liveOpsCampaignError}</p> : null}
      {props.liveOpsCampaignDispatchError ? <p className="akrErrorLine">{props.liveOpsCampaignDispatchError}</p> : null}
      <h3>{t(props.lang, "admin_live_ops_latest_title")}</h3>
      <pre className="akrJsonBlock">{JSON.stringify(props.liveOpsCampaignData || {}, null, 2)}</pre>
      <h3>{t(props.lang, "admin_live_ops_dispatch_dump_title")}</h3>
      <pre className="akrJsonBlock">{JSON.stringify(props.liveOpsCampaignDispatchData || {}, null, 2)}</pre>
    </section>
  );
}
