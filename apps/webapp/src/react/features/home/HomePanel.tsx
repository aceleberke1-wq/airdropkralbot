import { buildHomeFeedViewModel } from "../../../core/player/homeFeedViewModel.js";
import { resolvePlayerCommandHintNavigation } from "../../../core/player/commandHintNavigation.js";
import { SHELL_ACTION_KEY } from "../../../core/navigation/shellActions.js";
import { t, type Lang } from "../../i18n";
import type { BootstrapV2Data } from "../../types";

type HomePanelProps = {
  lang: Lang;
  advanced: boolean;
  homeFeed: Record<string, unknown> | null;
  data: BootstrapV2Data | null;
  onRefresh: () => void;
  onShellAction: (actionKey: string, sourcePanelKey?: string) => void;
  onRouteTarget: (input: {
    routeKey?: string;
    panelKey?: string;
    focusKey?: string;
    tab?: "home" | "pvp" | "tasks" | "vault" | string;
    sourcePanelKey?: string;
  }) => void;
};

export function HomePanel(props: HomePanelProps) {
  const view = buildHomeFeedViewModel({
    homeFeed: props.homeFeed,
    bootstrap: props.data
  });
  const resolveSurfaceActionKey = (sectionKey: string, slotKey: string, fallbackActionKey: string) => {
    const rows = Array.isArray((view.surface_actions as Record<string, Array<Record<string, unknown>>> | undefined)?.[sectionKey])
      ? ((view.surface_actions as Record<string, Array<Record<string, unknown>>>)[sectionKey] || [])
      : [];
    const match = rows.find((row) => String(row.slot_key || "").trim().toLowerCase() === String(slotKey || "").trim().toLowerCase());
    return String(match?.action_key || fallbackActionKey || "");
  };
  const runSurfaceAction = (sectionKey: string, slotKey: string, fallbackActionKey: string) => {
    const actionKey = resolveSurfaceActionKey(sectionKey, slotKey, fallbackActionKey);
    if (!actionKey) {
      return;
    }
    props.onShellAction(actionKey, "panel_home");
  };
  const runCommandHint = (row: Record<string, unknown>) => {
    const target = resolvePlayerCommandHintNavigation(row);
    if (!target) {
      return;
    }
    if (target.kind === "action") {
      props.onShellAction(target.action_key, "panel_home");
      return;
    }
    props.onRouteTarget({
      routeKey: target.route_key,
      panelKey: target.panel_key,
      focusKey: target.focus_key,
      tab: target.tab,
      sourcePanelKey: "panel_home"
    });
  };
  const summary = view.summary;
  const prefs = (props.data?.ui_prefs as {
    reduced_motion?: boolean;
    large_text?: boolean;
    sound_enabled?: boolean;
  } | null) || { reduced_motion: false, large_text: false, sound_enabled: true };
  const openArena = () =>
    props.onRouteTarget({
      routeKey: "pvp",
      tab: "pvp",
      sourcePanelKey: "panel_home"
    });
  const openMissions = () =>
    props.onRouteTarget({
      routeKey: "missions",
      tab: "tasks",
      sourcePanelKey: "panel_home"
    });
  const openVault = () =>
    props.onRouteTarget({
      routeKey: "vault",
      tab: "vault",
      sourcePanelKey: "panel_home"
    });
  const openDiscover = () => runSurfaceAction("home_discover", "discover", SHELL_ACTION_KEY.PLAYER_DISCOVER_CENTER);
  const walletStateKey = summary.wallet_active ? "home_wallet_live" : "home_wallet_dormant";
  const premiumStateKey = summary.premium_active ? "home_premium_live" : "home_premium_standard";

  return (
    <section className="akrCard akrCardWide akrGameHub" data-akr-panel-key="profile" data-akr-focus-key="identity">
      <div className="akrGameHero">
        <div className="akrGameHeroCopy">
          <p className="akrKicker">{t(props.lang, "home_hub_kicker")}</p>
          <h2>{t(props.lang, "home_hub_title")}</h2>
          <p>{t(props.lang, "home_hub_body")}</p>
        </div>
        <div className="akrGameHeroStats">
          <span className="akrChip">{summary.player_name}</span>
          <span className="akrChip">{t(props.lang, "home_stat_tier")} {Math.floor(summary.kingdom_tier)}</span>
          <span className="akrChip">{t(props.lang, "home_stat_streak")} {Math.floor(summary.streak)}</span>
          <span className="akrChip">{t(props.lang, "home_stat_season")} #{Math.floor(summary.season_id)}</span>
          <span className="akrChip">{Math.floor(summary.season_days_left)}d</span>
          <span className="akrChip">{t(props.lang, "home_action_points")} {Math.floor(summary.season_points)}</span>
        </div>
      </div>

      <div className="akrGameActionGrid">
        <button className="akrActionFeatureCard isPrimary" onClick={openArena}>
          <p className="akrKicker">{t(props.lang, "home_action_arena_kicker")}</p>
          <h3>{t(props.lang, "home_action_arena_title")}</h3>
          <p>{t(props.lang, "home_action_arena_body")}</p>
          <span className="akrChip">
            {Math.floor(summary.season_points)} {t(props.lang, "home_action_points")}
          </span>
        </button>
        <button className="akrActionFeatureCard" onClick={openMissions}>
          <p className="akrKicker">{t(props.lang, "home_action_missions_kicker")}</p>
          <h3>{t(props.lang, "home_action_missions_title")}</h3>
          <p>{t(props.lang, "home_action_missions_body")}</p>
          <span className="akrChip">
            {Math.floor(summary.mission_ready)}/{Math.floor(summary.mission_total)} {t(props.lang, "home_action_ready")}
          </span>
        </button>
        <button className="akrActionFeatureCard" onClick={openVault}>
          <p className="akrKicker">{t(props.lang, "home_action_vault_kicker")}</p>
          <h3>{t(props.lang, "home_action_vault_title")}</h3>
          <p>{t(props.lang, "home_action_vault_body")}</p>
          <span className="akrChip">{t(props.lang, walletStateKey as any)}</span>
        </button>
        <button className="akrActionFeatureCard" onClick={openDiscover}>
          <p className="akrKicker">{t(props.lang, "home_action_discover_kicker")}</p>
          <h3>{t(props.lang, "home_action_discover_title")}</h3>
          <p>{t(props.lang, "home_action_discover_body")}</p>
          <span className="akrChip">{t(props.lang, "home_action_discover_chip")}</span>
        </button>
      </div>

      <div className="akrStatRail">
        <div className="akrMetricCard">
          <span>{t(props.lang, "home_metric_daily")}</span>
          <strong>
            {Math.floor(summary.tasks_done)}/{Math.floor(summary.daily_cap)}
          </strong>
        </div>
        <div className="akrMetricCard">
          <span>{t(props.lang, "home_metric_wallet")}</span>
          <strong>{summary.wallet_chain || (summary.wallet_active ? "active" : "inactive")}</strong>
        </div>
        <div className="akrMetricCard">
          <span>{t(props.lang, "home_metric_premium")}</span>
          <strong>{summary.premium_active ? "premium" : "standard"}</strong>
        </div>
        <div className="akrMetricCard">
          <span>{t(props.lang, "home_metric_passes")}</span>
          <strong>{Math.floor(summary.active_pass_count)}</strong>
        </div>
      </div>

      <div className="akrGameFocusGrid">
        <section className="akrMiniPanel" data-akr-panel-key="status" data-akr-focus-key="mission_status">
          <h4>{t(props.lang, "home_mission_title")}</h4>
          <p className="akrMuted akrMiniPanelBody">{t(props.lang, "home_mission_caption")}</p>
          {view.mission_preview.length ? (
            <ul className="akrList">
              {view.mission_preview.slice(0, 3).map((row) => (
                <li key={row.mission_key || row.title}>
                  <strong>{row.title || row.mission_key}</strong>
                  <span>{row.claimed ? t(props.lang, "home_task_claimed") : row.completed ? t(props.lang, "home_task_ready") : t(props.lang, "home_task_open")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="akrMuted">{t(props.lang, "home_mission_empty")}</p>
          )}
          <div className="akrActionRow">
            <button
              className="akrBtn akrBtnGhost"
              onClick={() => runSurfaceAction("home_mission", "tasks", SHELL_ACTION_KEY.PLAYER_TASKS_BOARD)}
            >
              {t(props.lang, "shell_panel_go_tasks")}
            </button>
          </div>
        </section>

        <section className="akrMiniPanel" data-akr-panel-key="status" data-akr-focus-key="system_status">
          <h4>{t(props.lang, "home_wallet_title")}</h4>
          <p className="akrMuted akrMiniPanelBody">{t(props.lang, "home_wallet_caption")}</p>
          <div className="akrChipRow">
            <span className="akrChip">{t(props.lang, walletStateKey as any)}</span>
            <span className="akrChip">{summary.wallet_chain || "-"}</span>
            <span className="akrChip">{summary.wallet_kyc_status || "-"}</span>
          </div>
          <p className="akrMuted">{summary.wallet_address_masked || "-"}</p>
          <div className="akrActionRow">
            <button
              className="akrBtn akrBtnGhost"
              onClick={() => runSurfaceAction("home_wallet", "wallet", SHELL_ACTION_KEY.PLAYER_WALLET_CONNECT)}
            >
              {t(props.lang, "shell_panel_go_wallet")}
            </button>
            <button
              className="akrBtn akrBtnGhost"
              onClick={() => runSurfaceAction("home_wallet", "payout", SHELL_ACTION_KEY.PLAYER_PAYOUT_REQUEST)}
            >
              {t(props.lang, "shell_panel_go_payout")}
            </button>
          </div>
        </section>

        <section className="akrMiniPanel" data-akr-panel-key="rewards" data-akr-focus-key="premium_status">
          <h4>{t(props.lang, "home_rewards_title")}</h4>
          <p className="akrMuted akrMiniPanelBody">{t(props.lang, "home_rewards_caption")}</p>
          <div className="akrChipRow">
            <span className="akrChip">{t(props.lang, premiumStateKey as any)}</span>
            <span className="akrChip">
              {Math.floor(summary.active_pass_count)} {t(props.lang, "home_metric_passes")}
            </span>
            <span className="akrChip">
              {Math.floor(summary.sc_earned)} SC / {Math.floor(summary.hc_earned)} HC
            </span>
          </div>
          <div className="akrActionRow">
            <button className="akrBtn akrBtnGhost" onClick={() => runSurfaceAction("home_rewards", "rewards", SHELL_ACTION_KEY.PLAYER_REWARDS_PANEL)}>
              {t(props.lang, "home_rewards_cta")}
            </button>
          </div>
        </section>
      </div>

      <div className="akrActionRow akrHomeFooterActions">
        <button className="akrBtn akrBtnGhost" onClick={props.onRefresh}>
          {t(props.lang, "home_feed_refresh")}
        </button>
        <button className="akrBtn akrBtnGhost" onClick={() => runSurfaceAction("home_settings", "settings", SHELL_ACTION_KEY.PLAYER_SETTINGS_LOCALE)}>
          {t(props.lang, "shell_panel_open_settings")}
        </button>
        <button className="akrBtn akrBtnGhost" onClick={() => runSurfaceAction("home_support", "support", SHELL_ACTION_KEY.PLAYER_SUPPORT_FAQ)}>
          {t(props.lang, "shell_panel_open_support")}
        </button>
        <span className="akrChip">{String(props.lang).toUpperCase()}</span>
        <span className="akrChip">{prefs.sound_enabled === false ? t(props.lang, "home_sound_off") : t(props.lang, "home_sound_on")}</span>
      </div>

      {props.advanced ? (
        <pre className="akrJsonBlock">{JSON.stringify(props.homeFeed || props.data || {}, null, 2)}</pre>
      ) : null}
    </section>
  );
}
