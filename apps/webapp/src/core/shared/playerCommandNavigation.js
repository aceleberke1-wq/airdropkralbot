import { resolveLaunchTarget } from "./navigationContract.js";
import { resolveShellActionTarget, SHELL_ACTION_KEY } from "./shellActionCatalog.js";

export const PLAYER_COMMAND_SHELL_ACTION_KEY = Object.freeze({
  menu: SHELL_ACTION_KEY.PLAYER_WORLD_HUB,
  hub: SHELL_ACTION_KEY.PLAYER_WORLD_HUB,
  play: SHELL_ACTION_KEY.PLAYER_WORLD_HUB,
  profile: SHELL_ACTION_KEY.PLAYER_PROFILE_PANEL,
  nexus: SHELL_ACTION_KEY.PLAYER_PROFILE_PANEL,
  tasks: SHELL_ACTION_KEY.PLAYER_TASKS_BOARD,
  missions: SHELL_ACTION_KEY.PLAYER_TASKS_BOARD,
  daily: SHELL_ACTION_KEY.PLAYER_TASKS_BOARD,
  finish: SHELL_ACTION_KEY.PLAYER_TASKS_BOARD,
  reveal: SHELL_ACTION_KEY.PLAYER_TASKS_CLAIMS,
  claim: SHELL_ACTION_KEY.PLAYER_TASKS_CLAIMS,
  pvp: SHELL_ACTION_KEY.PLAYER_PVP_DAILY_DUEL,
  arena_rank: SHELL_ACTION_KEY.PLAYER_PVP_LEADERBOARD,
  leaderboard: SHELL_ACTION_KEY.PLAYER_PVP_LEADERBOARD,
  season: SHELL_ACTION_KEY.PLAYER_SEASON_HALL,
  war: SHELL_ACTION_KEY.PLAYER_EVENTS_HALL,
  events: SHELL_ACTION_KEY.PLAYER_EVENTS_HALL,
  wallet: SHELL_ACTION_KEY.PLAYER_WALLET_CONNECT,
  token: SHELL_ACTION_KEY.PLAYER_WALLET_CONNECT,
  mint: SHELL_ACTION_KEY.PLAYER_WALLET_CONNECT,
  buytoken: SHELL_ACTION_KEY.PLAYER_WALLET_CONNECT,
  tx: SHELL_ACTION_KEY.PLAYER_WALLET_CONNECT,
  vault: SHELL_ACTION_KEY.PLAYER_PAYOUT_REQUEST,
  payout: SHELL_ACTION_KEY.PLAYER_PAYOUT_REQUEST,
  rewards: SHELL_ACTION_KEY.PLAYER_REWARDS_PANEL,
  shop: SHELL_ACTION_KEY.PLAYER_REWARDS_PANEL,
  discover: SHELL_ACTION_KEY.PLAYER_DISCOVER_CENTER,
  status: SHELL_ACTION_KEY.PLAYER_STATUS_PANEL,
  settings: SHELL_ACTION_KEY.PLAYER_SETTINGS_PANEL,
  lang: SHELL_ACTION_KEY.PLAYER_SETTINGS_LOCALE,
  language: SHELL_ACTION_KEY.PLAYER_SETTINGS_LOCALE,
  ui_mode: SHELL_ACTION_KEY.PLAYER_SETTINGS_ACCESSIBILITY,
  perf: SHELL_ACTION_KEY.PLAYER_SETTINGS_ACCESSIBILITY,
  help: SHELL_ACTION_KEY.PLAYER_SUPPORT_FAQ,
  story: SHELL_ACTION_KEY.PLAYER_SUPPORT_FAQ,
  support: SHELL_ACTION_KEY.PLAYER_SUPPORT_PANEL,
  faq: SHELL_ACTION_KEY.PLAYER_SUPPORT_FAQ
});

export function normalizePlayerCommandKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^\/+/, "");
}

export function buildPlayerCommandTarget(routeKey, panelKey, focusKey) {
  const target = resolveLaunchTarget({
    workspace: "player",
    routeKey,
    panelKey,
    focusKey
  });
  return {
    route_key: String(target.route_key || "hub"),
    panel_key: String(target.panel_key || ""),
    focus_key: String(target.focus_key || ""),
    workspace: "player",
    tab: String(target.tab || "home")
  };
}

function toNavigationFromAction(actionKey) {
  const target = resolveShellActionTarget(actionKey);
  if (!target || target.workspace !== "player") {
    return null;
  }
  return {
    route_key: String(target.route_key || "hub"),
    panel_key: String(target.panel_key || ""),
    focus_key: String(target.focus_key || ""),
    workspace: "player",
    tab: String(target.tab || "home")
  };
}

export function resolvePlayerCommandActionKey(commandKey) {
  const key = normalizePlayerCommandKey(commandKey);
  if (!key) {
    return "";
  }
  return PLAYER_COMMAND_SHELL_ACTION_KEY[key] || "";
}

export function resolvePlayerCommandNavigation(commandKey) {
  const key = normalizePlayerCommandKey(commandKey);
  if (!key) {
    return null;
  }

  const actionNavigation = toNavigationFromAction(resolvePlayerCommandActionKey(key));
  if (actionNavigation) {
    return actionNavigation;
  }

  if (key === "kingdom") {
    return buildPlayerCommandTarget("season", "kingdom", "weekly_ladder");
  }

  if (key === "streak") {
    return buildPlayerCommandTarget("season", "streak", "weekly_ladder");
  }

  return null;
}
