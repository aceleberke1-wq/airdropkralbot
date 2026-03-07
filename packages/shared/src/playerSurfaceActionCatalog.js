"use strict";

const { SHELL_ACTION_KEY, resolveShellActionTarget } = require("./shellActionCatalog");

function toSurfaceAction(slotKey, actionKey) {
  const key = String(actionKey || "").trim().toLowerCase();
  const target = resolveShellActionTarget(key);
  return {
    slot_key: String(slotKey || "").trim().toLowerCase(),
    action_key: key,
    shell_action_key: key,
    ...(target?.route_key ? { route_key: String(target.route_key) } : {}),
    ...(target?.panel_key ? { panel_key: String(target.panel_key) } : {}),
    ...(target?.focus_key ? { focus_key: String(target.focus_key) } : {}),
    ...(target?.tab ? { tab: String(target.tab) } : {})
  };
}

function buildPlayerSurfaceActions() {
  return {
    home_header: [
      toSurfaceAction("profile", SHELL_ACTION_KEY.PLAYER_PROFILE_PANEL),
      toSurfaceAction("status", SHELL_ACTION_KEY.PLAYER_STATUS_PANEL)
    ],
    home_mission: [toSurfaceAction("tasks", SHELL_ACTION_KEY.PLAYER_TASKS_BOARD)],
    home_wallet: [
      toSurfaceAction("wallet", SHELL_ACTION_KEY.PLAYER_WALLET_CONNECT),
      toSurfaceAction("payout", SHELL_ACTION_KEY.PLAYER_PAYOUT_REQUEST)
    ],
    home_discover: [toSurfaceAction("discover", SHELL_ACTION_KEY.PLAYER_DISCOVER_CENTER)],
    home_settings: [toSurfaceAction("settings", SHELL_ACTION_KEY.PLAYER_SETTINGS_LOCALE)],
    home_support: [
      toSurfaceAction("support", SHELL_ACTION_KEY.PLAYER_SUPPORT_FAQ),
      toSurfaceAction("status", SHELL_ACTION_KEY.PLAYER_STATUS_PANEL),
      toSurfaceAction("payout", SHELL_ACTION_KEY.PLAYER_PAYOUT_REQUEST),
      toSurfaceAction("settings", SHELL_ACTION_KEY.PLAYER_SETTINGS_LOCALE)
    ],
    shell_profile: [
      toSurfaceAction("status", SHELL_ACTION_KEY.PLAYER_STATUS_PANEL),
      toSurfaceAction("wallet", SHELL_ACTION_KEY.PLAYER_WALLET_CONNECT)
    ],
    shell_status_primary: [
      toSurfaceAction("tasks", SHELL_ACTION_KEY.PLAYER_TASKS_BOARD),
      toSurfaceAction("support", SHELL_ACTION_KEY.PLAYER_SUPPORT_STATUS)
    ],
    shell_status_economy: [
      toSurfaceAction("rewards", SHELL_ACTION_KEY.PLAYER_REWARDS_PANEL),
      toSurfaceAction("payout", SHELL_ACTION_KEY.PLAYER_PAYOUT_REQUEST)
    ],
    shell_support: [
      toSurfaceAction("payout", SHELL_ACTION_KEY.PLAYER_PAYOUT_REQUEST),
      toSurfaceAction("wallet", SHELL_ACTION_KEY.PLAYER_WALLET_CONNECT),
      toSurfaceAction("settings", SHELL_ACTION_KEY.PLAYER_SETTINGS_ACCESSIBILITY)
    ],
    shell_discover: [
      toSurfaceAction("tasks", SHELL_ACTION_KEY.PLAYER_TASKS_BOARD),
      toSurfaceAction("pvp", SHELL_ACTION_KEY.PLAYER_PVP_DAILY_DUEL),
      toSurfaceAction("vault", SHELL_ACTION_KEY.PLAYER_PAYOUT_REQUEST)
    ],
    shell_rewards: [
      toSurfaceAction("support", SHELL_ACTION_KEY.PLAYER_SUPPORT_FAQ),
      toSurfaceAction("payout", SHELL_ACTION_KEY.PLAYER_PAYOUT_REQUEST)
    ]
  };
}

module.exports = {
  buildPlayerSurfaceActions
};
