import { buildHomeFeedViewModel } from "../../../core/player/homeFeedViewModel.js";
import { t, type Lang } from "../../i18n";
import type { BootstrapV2Data } from "../../types";

type HomePanelProps = {
  lang: Lang;
  advanced: boolean;
  homeFeed: Record<string, unknown> | null;
  data: BootstrapV2Data | null;
  onRefresh: () => void;
};

export function HomePanel(props: HomePanelProps) {
  const view = buildHomeFeedViewModel({
    homeFeed: props.homeFeed,
    bootstrap: props.data
  });
  const summary = view.summary;

  return (
    <section className="akrCard akrCardWide" data-akr-panel-key="profile" data-akr-focus-key="identity">
      <div className="akrActionRow">
        <button className="akrBtn akrBtnGhost" onClick={props.onRefresh}>
          {t(props.lang, "home_feed_refresh")}
        </button>
      </div>
      <h3>{t(props.lang, "home_overview")}</h3>
      <div className="akrChipRow">
        <span className="akrChip">{summary.player_name}</span>
        <span className="akrChip">Tier {Math.floor(summary.kingdom_tier)}</span>
        <span className="akrChip">Streak {Math.floor(summary.streak)}</span>
        <span className="akrChip">Season #{Math.floor(summary.season_id)}</span>
        <span className="akrChip">{Math.floor(summary.season_days_left)}d</span>
        <span className="akrChip">Pts {Math.floor(summary.season_points)}</span>
        <span className="akrChip">
          Tasks {Math.floor(summary.tasks_done)}/{Math.floor(summary.daily_cap)} ({Math.floor(summary.task_fill_pct)}%)
        </span>
      </div>

      <div className="akrSplit">
        <section className="akrMiniPanel" data-akr-panel-key="status" data-akr-focus-key="mission_status">
          <h4>{t(props.lang, "home_mission_title")}</h4>
          <div className="akrChipRow">
            <span className="akrChip">Total {Math.floor(summary.mission_total)}</span>
            <span className="akrChip">Ready {Math.floor(summary.mission_ready)}</span>
            <span className="akrChip">Open {Math.floor(summary.mission_open)}</span>
          </div>
          {view.mission_preview.length ? (
            <ul className="akrList">
              {view.mission_preview.map((row) => (
                <li key={row.mission_key || row.title}>
                  <strong>{row.title || row.mission_key}</strong>
                  <span>{row.claimed ? "claimed" : row.completed ? "ready" : "open"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="akrMuted">{t(props.lang, "home_mission_empty")}</p>
          )}
        </section>

        <section className="akrMiniPanel" data-akr-panel-key="status" data-akr-focus-key="system_status">
          <h4>{t(props.lang, "home_wallet_title")}</h4>
          <div className="akrChipRow">
            <span className="akrChip">{summary.wallet_active ? "active" : "inactive"}</span>
            <span className="akrChip">{summary.wallet_chain || "-"}</span>
            <span className="akrChip">{summary.wallet_kyc_status || "-"}</span>
          </div>
          <p className="akrMuted">{summary.wallet_address_masked || "-"}</p>
          <h4>{t(props.lang, "home_monetization_title")}</h4>
          <div className="akrChipRow">
            <span className="akrChip">{summary.monetization_enabled ? "enabled" : "disabled"}</span>
            <span className="akrChip">{summary.premium_active ? "premium" : "standard"}</span>
            <span className="akrChip">Pass {Math.floor(summary.active_pass_count)}</span>
            <span className="akrChip">SC {Math.floor(summary.spend_sc)}</span>
            <span className="akrChip">RC {Math.floor(summary.spend_rc)}</span>
            <span className="akrChip">HC {Math.floor(summary.spend_hc)}</span>
          </div>
        </section>
      </div>

      <section className="akrMiniPanel" data-akr-panel-key="discover" data-akr-focus-key="command_center">
        <h4>{t(props.lang, "home_commands_title")}</h4>
        {view.command_hints.length ? (
          <ul className="akrList">
            {view.command_hints.map((row) => (
              <li key={row.key}>
                <strong>/{row.key}</strong>
                <span>{row.description || "-"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="akrMuted">{t(props.lang, "home_commands_empty")}</p>
        )}
      </section>

      {!view.has_data ? <p className="akrMuted">{t(props.lang, "home_empty")}</p> : null}

      {props.advanced ? (
        <pre className="akrJsonBlock">{JSON.stringify(props.homeFeed || props.data || {}, null, 2)}</pre>
      ) : null}
    </section>
  );
}
