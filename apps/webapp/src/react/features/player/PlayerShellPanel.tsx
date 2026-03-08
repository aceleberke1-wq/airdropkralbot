import { buildHomeFeedViewModel } from "../../../core/player/homeFeedViewModel.js";
import { resolvePlayerCommandHintNavigation } from "../../../core/player/commandHintNavigation.js";
import { buildVaultViewModel } from "../../../core/player/vaultViewModel.js";
import { SHELL_ACTION_KEY } from "../../../core/navigation/shellActions.js";
import { normalizeLang, t, type Lang } from "../../i18n";
import type { BootstrapV2Data } from "../../types";
import type { PlayerShellPanelKey } from "./usePlayerShellPanelController";

type PlayerShellPanelProps = {
  lang: Lang;
  panelKey: PlayerShellPanelKey;
  focusKey: string;
  data: BootstrapV2Data | null;
  sceneProfile: {
    qualityMode: string;
    effectiveQuality: string;
    hudDensity: string;
    perfTier: string;
    deviceClass: string;
    sceneProfile: string;
  };
  homeFeed: Record<string, unknown> | null;
  vaultData: Record<string, unknown> | null;
  onClose: () => void;
  onShellAction: (actionKey: string, sourcePanelKey?: string) => void;
  onTabChange: (tab: "home" | "pvp" | "tasks" | "vault") => void;
  onRouteTarget: (input: {
    routeKey?: string;
    panelKey?: string;
    focusKey?: string;
    tab?: "home" | "pvp" | "tasks" | "vault" | string;
    sourcePanelKey?: string;
  }) => void;
  onToggleReducedMotion: (next: boolean) => void;
  onToggleLargeText: (next: boolean) => void;
  onToggleLanguage: (next: Lang) => void;
};

function resolveRootPanelKey(panelKey: PlayerShellPanelKey): string {
  if (panelKey === "settings") {
    return "language";
  }
  return panelKey;
}

export function PlayerShellPanel(props: PlayerShellPanelProps) {
  const homeView = buildHomeFeedViewModel({
    homeFeed: props.homeFeed,
    bootstrap: props.data
  });
  const vaultView = buildVaultViewModel({
    vaultData: props.vaultData || {}
  });
  const prefs = props.data?.ui_prefs || null;
  const prefsJson = prefs?.prefs_json && typeof prefs.prefs_json === "object" ? prefs.prefs_json : {};
  const nextLang = normalizeLang(props.lang) === "tr" ? "en" : "tr";
  const rootPanelKey = resolveRootPanelKey(props.panelKey);
  const resolveSurfaceActionKey = (sectionKey: string, slotKey: string, fallbackActionKey: string) => {
    const rows = Array.isArray((homeView.surface_actions as Record<string, Array<Record<string, unknown>>> | undefined)?.[sectionKey])
      ? ((homeView.surface_actions as Record<string, Array<Record<string, unknown>>>)[sectionKey] || [])
      : [];
    const match = rows.find((row) => String(row.slot_key || "").trim().toLowerCase() === String(slotKey || "").trim().toLowerCase());
    return String(match?.action_key || fallbackActionKey || "");
  };
  const runSurfaceAction = (sectionKey: string, slotKey: string, fallbackActionKey: string) => {
    const actionKey = resolveSurfaceActionKey(sectionKey, slotKey, fallbackActionKey);
    if (!actionKey) {
      return;
    }
    props.onShellAction(actionKey, rootPanelKey);
  };
  const runCommandHint = (row: Record<string, unknown>) => {
    const target = resolvePlayerCommandHintNavigation(row);
    if (!target) {
      return;
    }
    if (target.kind === "action") {
      props.onShellAction(target.action_key, rootPanelKey);
      return;
    }
    props.onRouteTarget({
      routeKey: target.route_key,
      panelKey: target.panel_key,
      focusKey: target.focus_key,
      tab: target.tab,
      sourcePanelKey: rootPanelKey
    });
  };
  const supportStatus = [
    props.data?.analytics?.session_ref
      ? `${props.lang === "tr" ? "Oturum" : "Session"} ${String(props.data.analytics.session_ref).slice(0, 10)}`
      : "",
    vaultView.summary.wallet_active
      ? `${props.lang === "tr" ? "Wallet" : "Wallet"} ${vaultView.summary.wallet_chain || "-"}`
      : props.lang === "tr"
        ? "Wallet kapali"
        : "Wallet idle",
    vaultView.summary.payout_can_request
      ? `${vaultView.summary.payout_requestable_btc.toFixed(8)} BTC`
      : vaultView.latest.payout_request_status || t(props.lang, "status_unknown")
  ].filter(Boolean);

  return (
    <section className="akrCard akrCardWide akrShellSurface" data-akr-panel-key={rootPanelKey}>
      <div className="akrShellSurfaceHero">
        <div>
          <p className="akrKicker">{t(props.lang, "launch_handoff_title")}</p>
          <h3>{t(props.lang, `shell_panel_${props.panelKey}_title` as any)}</h3>
          <p className="akrMuted">{t(props.lang, `shell_panel_${props.panelKey}_body` as any)}</p>
        </div>
        <div className="akrActionRow">
          {props.panelKey !== "discover" ? (
            <button className="akrBtn akrBtnGhost" onClick={() => props.onShellAction(SHELL_ACTION_KEY.PLAYER_DISCOVER_CENTER, rootPanelKey)}>
              {t(props.lang, "shell_panel_open_discover")}
            </button>
          ) : null}
          {props.panelKey !== "settings" ? (
            <button className="akrBtn akrBtnGhost" onClick={() => props.onShellAction(SHELL_ACTION_KEY.PLAYER_SETTINGS_LOCALE, rootPanelKey)}>
              {t(props.lang, "shell_panel_open_settings")}
            </button>
          ) : null}
          {props.panelKey !== "support" ? (
            <button className="akrBtn akrBtnGhost" onClick={() => props.onShellAction(SHELL_ACTION_KEY.PLAYER_SUPPORT_FAQ, rootPanelKey)}>
              {t(props.lang, "shell_panel_open_support")}
            </button>
          ) : null}
          <button className="akrBtn akrBtnAccent" onClick={props.onClose}>
            {t(props.lang, "shell_panel_close")}
          </button>
        </div>
      </div>

      {props.panelKey === "settings" ? (
        <div className="akrSplit">
          <section className="akrMiniPanel" data-akr-focus-key="locale_override">
            <h4>{t(props.lang, "shell_panel_settings_language")}</h4>
            <div className="akrChipRow">
              <span className="akrChip">{String(props.lang).toUpperCase()}</span>
              <span className="akrChip">{String(props.sceneProfile.qualityMode || prefs?.quality_mode || "auto")}</span>
              <span className="akrChip">{String(props.sceneProfile.effectiveQuality || "medium")}</span>
              <span className="akrChip">{String(props.sceneProfile.hudDensity || "normal")}</span>
              <span className="akrChip">{String(prefsJson.workspace || "player")}</span>
            </div>
            <div className="akrActionRow">
              <button className="akrBtn akrBtnAccent" onClick={() => props.onToggleLanguage(nextLang)}>
                {t(props.lang, "language")}: {String(nextLang).toUpperCase()}
              </button>
            </div>
          </section>
          <section className="akrMiniPanel" data-akr-focus-key="accessibility">
            <h4>{t(props.lang, "shell_panel_settings_accessibility")}</h4>
            <div className="akrChipRow">
              <span className="akrChip">{prefs?.reduced_motion ? "motion_reduced" : "motion_normal"}</span>
              <span className="akrChip">{prefs?.large_text ? "large_text" : "base_text"}</span>
              <span className="akrChip">{prefs?.sound_enabled === false ? "sound_off" : "sound_on"}</span>
              <span className="akrChip">{String(props.sceneProfile.perfTier || "-")}</span>
              <span className="akrChip">{String(props.sceneProfile.deviceClass || "-")}</span>
              <span className="akrChip">{String(props.sceneProfile.sceneProfile || "-")}</span>
            </div>
            <div className="akrActionRow">
              <button className="akrBtn akrBtnGhost" onClick={() => props.onToggleReducedMotion(!Boolean(prefs?.reduced_motion))}>
                {t(props.lang, "shell_panel_toggle_motion")}
              </button>
              <button className="akrBtn akrBtnGhost" onClick={() => props.onToggleLargeText(!Boolean(prefs?.large_text))}>
                {t(props.lang, "shell_panel_toggle_text")}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {props.panelKey === "profile" ? (
        <div className="akrSplit">
          <section className="akrMiniPanel" data-akr-focus-key="identity">
            <h4>{t(props.lang, "shell_panel_profile_identity_title")}</h4>
            <div className="akrChipRow">
              <span className="akrChip">{homeView.summary.player_name || t(props.lang, "unknown_player")}</span>
              <span className="akrChip">Tier {Math.floor(homeView.summary.kingdom_tier)}</span>
              <span className="akrChip">Streak {Math.floor(homeView.summary.streak)}</span>
              <span className="akrChip">Season #{Math.floor(homeView.summary.season_id)}</span>
              <span className="akrChip">Pts {Math.floor(homeView.summary.season_points)}</span>
            </div>
            <div className="akrActionRow">
              <button className="akrBtn akrBtnAccent" onClick={() => props.onTabChange("pvp")}>
                {t(props.lang, "shell_panel_go_pvp")}
              </button>
              <button className="akrBtn akrBtnGhost" onClick={() => props.onTabChange("tasks")}>
                {t(props.lang, "shell_panel_go_tasks")}
              </button>
            </div>
          </section>
          <section className="akrMiniPanel" data-akr-focus-key={props.focusKey || "balances"}>
            <h4>{t(props.lang, "shell_panel_profile_balance_title")}</h4>
            <div className="akrChipRow">
              <span className="akrChip">SC {Math.floor(homeView.summary.sc_earned)}</span>
              <span className="akrChip">RC {Math.floor(homeView.summary.rc_earned)}</span>
              <span className="akrChip">HC {Math.floor(homeView.summary.hc_earned)}</span>
              <span className="akrChip">{homeView.summary.wallet_active ? "wallet_on" : "wallet_off"}</span>
              <span className="akrChip">{homeView.summary.wallet_chain || "-"}</span>
            </div>
            <div className="akrActionRow">
              <button className="akrBtn akrBtnGhost" onClick={() => runSurfaceAction("shell_profile", "status", SHELL_ACTION_KEY.PLAYER_STATUS_PANEL)}>
                {t(props.lang, "shell_panel_open_status")}
              </button>
              <button
                className="akrBtn akrBtnGhost"
                onClick={() => runSurfaceAction("shell_profile", "wallet", SHELL_ACTION_KEY.PLAYER_WALLET_CONNECT)}
              >
                {t(props.lang, "shell_panel_go_wallet")}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {props.panelKey === "status" ? (
        <div className="akrSplit">
          <section className="akrMiniPanel" data-akr-focus-key="system_status">
            <h4>{t(props.lang, "shell_panel_status_runtime_title")}</h4>
            <div className="akrChipRow">
              <span className="akrChip">Tasks {Math.floor(homeView.summary.tasks_done)}/{Math.floor(homeView.summary.daily_cap)}</span>
              <span className="akrChip">Ready {Math.floor(homeView.summary.mission_ready)}</span>
              <span className="akrChip">Open {Math.floor(homeView.summary.mission_open)}</span>
              <span className="akrChip">{homeView.summary.wallet_active ? "wallet_on" : "wallet_off"}</span>
              <span className="akrChip">{homeView.summary.wallet_kyc_status || t(props.lang, "status_unknown")}</span>
            </div>
            <div className="akrActionRow">
              <button className="akrBtn akrBtnAccent" onClick={() => props.onTabChange("tasks")}>
                {t(props.lang, "shell_panel_go_tasks")}
              </button>
              <button className="akrBtn akrBtnGhost" onClick={() => runSurfaceAction("shell_status_primary", "support", SHELL_ACTION_KEY.PLAYER_SUPPORT_STATUS)}>
                {t(props.lang, "shell_panel_open_support")}
              </button>
            </div>
          </section>
          <section className="akrMiniPanel" data-akr-focus-key={props.focusKey || "economy_status"}>
            <h4>{t(props.lang, "shell_panel_status_economy_title")}</h4>
            <div className="akrChipRow">
              <span className="akrChip">{vaultView.summary.token_symbol || "-"}</span>
              <span className="akrChip">{vaultView.summary.route_status || "-"}</span>
              <span className="akrChip">Req {vaultView.summary.payout_requestable_btc.toFixed(8)} BTC</span>
              <span className="akrChip">Pass {Math.floor(vaultView.summary.active_pass_count)}</span>
              <span className="akrChip">Premium {vaultView.summary.premium_active ? "on" : "off"}</span>
            </div>
            <div className="akrActionRow">
              <button className="akrBtn akrBtnGhost" onClick={() => runSurfaceAction("shell_status_economy", "rewards", SHELL_ACTION_KEY.PLAYER_REWARDS_PANEL)}>
                {t(props.lang, "shell_panel_open_rewards")}
              </button>
              <button
                className="akrBtn akrBtnGhost"
                onClick={() => runSurfaceAction("shell_status_economy", "payout", SHELL_ACTION_KEY.PLAYER_PAYOUT_REQUEST)}
              >
                {t(props.lang, "shell_panel_go_payout")}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {props.panelKey === "support" ? (
        <div className="akrSplit">
          <section className="akrMiniPanel" data-akr-focus-key="system_status">
            <h4>{t(props.lang, "shell_panel_support_status_title")}</h4>
            <div className="akrChipRow">
              {supportStatus.map((entry) => (
                <span className="akrChip" key={entry}>
                  {entry}
                </span>
              ))}
              <span className="akrChip">{homeView.summary.wallet_kyc_status || t(props.lang, "status_unknown")}</span>
            </div>
            <div className="akrActionRow">
              <button
                className="akrBtn akrBtnAccent"
                onClick={() => runSurfaceAction("shell_support", "payout", SHELL_ACTION_KEY.PLAYER_PAYOUT_REQUEST)}
              >
                {t(props.lang, "shell_panel_go_payout")}
              </button>
              <button
                className="akrBtn akrBtnGhost"
                onClick={() => runSurfaceAction("shell_support", "wallet", SHELL_ACTION_KEY.PLAYER_WALLET_CONNECT)}
              >
                {t(props.lang, "shell_panel_go_wallet")}
              </button>
              <button className="akrBtn akrBtnGhost" onClick={() => runSurfaceAction("shell_support", "settings", SHELL_ACTION_KEY.PLAYER_SETTINGS_ACCESSIBILITY)}>
                {t(props.lang, "shell_panel_open_settings")}
              </button>
            </div>
          </section>
          <section className="akrMiniPanel" data-akr-focus-key={props.focusKey || "faq_cards"}>
            <h4>{t(props.lang, "shell_panel_support_faq_title")}</h4>
            <ul className="akrList">
              <li>
                <strong>{t(props.lang, "shell_panel_support_faq_1_title")}</strong>
                <span>{t(props.lang, "shell_panel_support_faq_1_body")}</span>
              </li>
              <li>
                <strong>{t(props.lang, "shell_panel_support_faq_2_title")}</strong>
                <span>{t(props.lang, "shell_panel_support_faq_2_body")}</span>
              </li>
              <li>
                <strong>{t(props.lang, "shell_panel_support_faq_3_title")}</strong>
                <span>{t(props.lang, "shell_panel_support_faq_3_body")}</span>
              </li>
            </ul>
          </section>
        </div>
      ) : null}

      {props.panelKey === "discover" ? (
        <div className="akrSplit">
          <section className="akrMiniPanel" data-akr-focus-key="next_steps">
            <h4>{t(props.lang, "shell_panel_discover_next_title")}</h4>
            <div className="akrChipRow">
              <span className="akrChip">Ready {Math.floor(homeView.summary.mission_ready)}</span>
              <span className="akrChip">Open {Math.floor(homeView.summary.mission_open)}</span>
              <span className="akrChip">Wallet {homeView.summary.wallet_active ? "on" : "off"}</span>
              <span className="akrChip">Premium {homeView.summary.premium_active ? "on" : "off"}</span>
            </div>
            <div className="akrActionRow">
              <button className="akrBtn akrBtnAccent" onClick={() => props.onTabChange("tasks")}>
                {t(props.lang, "shell_panel_go_tasks")}
              </button>
              <button
                className="akrBtn akrBtnGhost"
                onClick={() => runSurfaceAction("shell_discover", "pvp", SHELL_ACTION_KEY.PLAYER_PVP_DAILY_DUEL)}
              >
                {t(props.lang, "shell_panel_go_pvp")}
              </button>
              <button
                className="akrBtn akrBtnGhost"
                onClick={() => runSurfaceAction("shell_discover", "vault", SHELL_ACTION_KEY.PLAYER_PAYOUT_REQUEST)}
              >
                {t(props.lang, "shell_panel_go_vault")}
              </button>
            </div>
          </section>
          <section className="akrMiniPanel" data-akr-focus-key={props.focusKey || "command_center"}>
            <h4>{t(props.lang, "shell_panel_discover_commands_title")}</h4>
            {homeView.command_hints.length ? (
              <ul className="akrList">
                {homeView.command_hints.map((row) => (
                  <li key={row.key}>
                    <strong>/{row.key}</strong>
                    <span>
                      {row.description || "-"}
                      {resolvePlayerCommandHintNavigation(row) ? (
                        <button
                          className="akrBtn akrBtnGhost"
                          onClick={() => runCommandHint(row as Record<string, unknown>)}
                        >
                          {t(props.lang, "command_handoff_open")}
                        </button>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="akrMuted">{t(props.lang, "shell_panel_discover_empty")}</p>
            )}
          </section>
        </div>
      ) : null}

      {props.panelKey === "rewards" ? (
        <div className="akrSplit">
          <section className="akrMiniPanel" data-akr-focus-key="premium_pass">
            <h4>{t(props.lang, "shell_panel_rewards_catalog_title")}</h4>
            <div className="akrChipRow">
              <span className="akrChip">Pass {vaultView.catalog.passes.length}</span>
              <span className="akrChip">Cosmetics {vaultView.catalog.cosmetics.length}</span>
              <span className="akrChip">Owned {Math.floor(vaultView.summary.cosmetics_owned_count)}</span>
              <span className="akrChip">History {Math.floor(vaultView.summary.pass_history_count)}</span>
            </div>
            <div className="akrActionRow">
              <button className="akrBtn akrBtnAccent" onClick={() => runSurfaceAction("shell_rewards", "support", SHELL_ACTION_KEY.PLAYER_SUPPORT_FAQ)}>
                {t(props.lang, "shell_panel_open_support")}
              </button>
              <button
                className="akrBtn akrBtnGhost"
                onClick={() => runSurfaceAction("shell_rewards", "payout", SHELL_ACTION_KEY.PLAYER_PAYOUT_REQUEST)}
              >
                {t(props.lang, "shell_panel_go_payout")}
              </button>
            </div>
          </section>
          <section className="akrMiniPanel" data-akr-focus-key={props.focusKey || "payout_lane"}>
            <h4>{t(props.lang, "shell_panel_rewards_payout_title")}</h4>
            <div className="akrChipRow">
              <span className="akrChip">{vaultView.summary.payout_can_request ? "can_request" : "locked"}</span>
              <span className="akrChip">{vaultView.summary.payout_unlock_tier || "-"}</span>
              <span className="akrChip">Req {vaultView.summary.payout_requestable_btc.toFixed(8)} BTC</span>
              <span className="akrChip">Entitled {vaultView.summary.payout_entitled_btc.toFixed(8)} BTC</span>
            </div>
            <p className="akrMuted">
              {vaultView.latest.payout_request_status || t(props.lang, "status_unknown")} | {vaultView.latest.submit_tx_hash || "-"}
            </p>
          </section>
        </div>
      ) : null}
    </section>
  );
}
