"use strict";

const { CANONICAL_WORKSPACE_KEY, resolveLaunchTarget } = require("./navigationContract");

const SHELL_ACTION_KEY = Object.freeze({
  PLAYER_WORLD_HUB: "player.route.world_hub",
  PLAYER_PROFILE_PANEL: "player.panel.profile",
  PLAYER_STATUS_PANEL: "player.panel.status",
  PLAYER_SETTINGS_PANEL: "player.panel.settings",
  PLAYER_SETTINGS_LOCALE: "player.panel.settings_locale",
  PLAYER_SETTINGS_ACCESSIBILITY: "player.panel.settings_accessibility",
  PLAYER_SUPPORT_PANEL: "player.panel.support",
  PLAYER_SUPPORT_FAQ: "player.panel.support_faq",
  PLAYER_SUPPORT_STATUS: "player.panel.support_status",
  PLAYER_DISCOVER_CENTER: "player.panel.discover",
  PLAYER_EVENTS_HALL: "player.route.events_hall",
  PLAYER_SEASON_HALL: "player.route.season_hall",
  PLAYER_REWARDS_PANEL: "player.route.rewards",
  PLAYER_WALLET_CONNECT: "player.route.wallet_connect",
  PLAYER_PAYOUT_REQUEST: "player.route.payout_request",
  PLAYER_TASKS_BOARD: "player.route.tasks_board",
  PLAYER_TASKS_CLAIMS: "player.route.tasks_claims",
  PLAYER_PVP_DAILY_DUEL: "player.route.pvp_daily_duel",
  PLAYER_PVP_WEEKLY_LADDER: "player.route.pvp_weekly_ladder",
  PLAYER_PVP_LEADERBOARD: "player.route.pvp_leaderboard",
  ADMIN_WORKSPACE: "admin.route.workspace",
  ADMIN_QUEUE_PANEL: "admin.route.queue_panel",
  ADMIN_POLICY_PANEL: "admin.route.policy_panel",
  ADMIN_LIVE_OPS_PANEL: "admin.route.live_ops_panel",
  ADMIN_RUNTIME_FLAGS: "admin.route.runtime_flags",
  ADMIN_RUNTIME_BOT: "admin.route.runtime_bot",
  ADMIN_RUNTIME_META: "admin.route.runtime_meta"
});

const SHELL_ACTION_CATALOG = Object.freeze({
  [SHELL_ACTION_KEY.PLAYER_WORLD_HUB]: Object.freeze({
    workspace: CANONICAL_WORKSPACE_KEY.PLAYER,
    routeKey: "hub",
    panelKey: "",
    focusKey: "",
    tab: "home"
  }),
  [SHELL_ACTION_KEY.PLAYER_PROFILE_PANEL]: Object.freeze({
    workspace: CANONICAL_WORKSPACE_KEY.PLAYER,
    routeKey: "hub",
    panelKey: "profile",
    focusKey: "identity",
    tab: "home"
  }),
  [SHELL_ACTION_KEY.PLAYER_STATUS_PANEL]: Object.freeze({
    workspace: CANONICAL_WORKSPACE_KEY.PLAYER,
    routeKey: "hub",
    panelKey: "status",
    focusKey: "system_status",
    tab: "home"
  }),
  [SHELL_ACTION_KEY.PLAYER_SETTINGS_PANEL]: Object.freeze({
    workspace: CANONICAL_WORKSPACE_KEY.PLAYER,
    routeKey: "settings",
    panelKey: "language",
    focusKey: "locale_override",
    tab: "home"
  }),
  [SHELL_ACTION_KEY.PLAYER_SETTINGS_LOCALE]: Object.freeze({
    workspace: CANONICAL_WORKSPACE_KEY.PLAYER,
    routeKey: "settings",
    panelKey: "language",
    focusKey: "locale_override",
    tab: "home"
  }),
  [SHELL_ACTION_KEY.PLAYER_SETTINGS_ACCESSIBILITY]: Object.freeze({
    workspace: CANONICAL_WORKSPACE_KEY.PLAYER,
    routeKey: "settings",
    panelKey: "language",
    focusKey: "accessibility",
    tab: "home"
  }),
  [SHELL_ACTION_KEY.PLAYER_SUPPORT_PANEL]: Object.freeze({
    workspace: CANONICAL_WORKSPACE_KEY.PLAYER,
    routeKey: "settings",
    panelKey: "support",
    focusKey: "faq_cards",
    tab: "home"
  }),
  [SHELL_ACTION_KEY.PLAYER_SUPPORT_FAQ]: Object.freeze({
    workspace: CANONICAL_WORKSPACE_KEY.PLAYER,
    routeKey: "settings",
    panelKey: "support",
    focusKey: "faq_cards",
    tab: "home"
  }),
  [SHELL_ACTION_KEY.PLAYER_SUPPORT_STATUS]: Object.freeze({
    workspace: CANONICAL_WORKSPACE_KEY.PLAYER,
    routeKey: "settings",
    panelKey: "support",
    focusKey: "system_status",
    tab: "home"
  }),
  [SHELL_ACTION_KEY.PLAYER_DISCOVER_CENTER]: Object.freeze({
    workspace: CANONICAL_WORKSPACE_KEY.PLAYER,
    routeKey: "hub",
    panelKey: "discover",
    focusKey: "command_center",
    tab: "home"
  }),
  [SHELL_ACTION_KEY.PLAYER_EVENTS_HALL]: Object.freeze({
    workspace: CANONICAL_WORKSPACE_KEY.PLAYER,
    routeKey: "events",
    panelKey: "discover",
    focusKey: "command_center",
    tab: "pvp"
  }),
  [SHELL_ACTION_KEY.PLAYER_SEASON_HALL]: Object.freeze({
    workspace: CANONICAL_WORKSPACE_KEY.PLAYER,
    routeKey: "season",
    panelKey: "rank",
    focusKey: "weekly_ladder",
    tab: "pvp"
  }),
  [SHELL_ACTION_KEY.PLAYER_REWARDS_PANEL]: Object.freeze({
    workspace: CANONICAL_WORKSPACE_KEY.PLAYER,
    routeKey: "vault",
    panelKey: "rewards",
    focusKey: "premium_pass",
    tab: "vault"
  }),
  [SHELL_ACTION_KEY.PLAYER_WALLET_CONNECT]: Object.freeze({
    workspace: CANONICAL_WORKSPACE_KEY.PLAYER,
    routeKey: "vault",
    panelKey: "wallet",
    focusKey: "connect",
    tab: "vault"
  }),
  [SHELL_ACTION_KEY.PLAYER_PAYOUT_REQUEST]: Object.freeze({
    workspace: CANONICAL_WORKSPACE_KEY.PLAYER,
    routeKey: "vault",
    panelKey: "payout",
    focusKey: "request",
    tab: "vault"
  }),
  [SHELL_ACTION_KEY.PLAYER_TASKS_BOARD]: Object.freeze({
    workspace: CANONICAL_WORKSPACE_KEY.PLAYER,
    routeKey: "missions",
    panelKey: "quests",
    focusKey: "board",
    tab: "tasks"
  }),
  [SHELL_ACTION_KEY.PLAYER_TASKS_CLAIMS]: Object.freeze({
    workspace: CANONICAL_WORKSPACE_KEY.PLAYER,
    routeKey: "missions",
    panelKey: "claim",
    focusKey: "missions",
    tab: "tasks"
  }),
  [SHELL_ACTION_KEY.PLAYER_PVP_DAILY_DUEL]: Object.freeze({
    workspace: CANONICAL_WORKSPACE_KEY.PLAYER,
    routeKey: "pvp",
    panelKey: "panel_pvp",
    focusKey: "daily_duel",
    tab: "pvp"
  }),
  [SHELL_ACTION_KEY.PLAYER_PVP_WEEKLY_LADDER]: Object.freeze({
    workspace: CANONICAL_WORKSPACE_KEY.PLAYER,
    routeKey: "season",
    panelKey: "rank",
    focusKey: "weekly_ladder",
    tab: "pvp"
  }),
  [SHELL_ACTION_KEY.PLAYER_PVP_LEADERBOARD]: Object.freeze({
    workspace: CANONICAL_WORKSPACE_KEY.PLAYER,
    routeKey: "season",
    panelKey: "leaderboard",
    focusKey: "leaderboard",
    tab: "pvp"
  }),
  [SHELL_ACTION_KEY.ADMIN_WORKSPACE]: Object.freeze({
    workspace: CANONICAL_WORKSPACE_KEY.ADMIN,
    routeKey: "admin",
    panelKey: "",
    focusKey: "",
    tab: "home"
  }),
  [SHELL_ACTION_KEY.ADMIN_QUEUE_PANEL]: Object.freeze({
    workspace: CANONICAL_WORKSPACE_KEY.ADMIN,
    routeKey: "admin",
    panelKey: "panel_admin_queue",
    focusKey: "queue_action",
    tab: "home"
  }),
  [SHELL_ACTION_KEY.ADMIN_POLICY_PANEL]: Object.freeze({
    workspace: CANONICAL_WORKSPACE_KEY.ADMIN,
    routeKey: "admin",
    panelKey: "panel_admin_policy",
    focusKey: "dynamic_policy",
    tab: "home"
  }),
  [SHELL_ACTION_KEY.ADMIN_LIVE_OPS_PANEL]: Object.freeze({
    workspace: CANONICAL_WORKSPACE_KEY.ADMIN,
    routeKey: "admin",
    panelKey: "panel_admin_live_ops",
    focusKey: "campaign_editor",
    tab: "home"
  }),
  [SHELL_ACTION_KEY.ADMIN_RUNTIME_FLAGS]: Object.freeze({
    workspace: CANONICAL_WORKSPACE_KEY.ADMIN,
    routeKey: "admin",
    panelKey: "panel_admin_runtime",
    focusKey: "runtime_flags",
    tab: "home"
  }),
  [SHELL_ACTION_KEY.ADMIN_RUNTIME_BOT]: Object.freeze({
    workspace: CANONICAL_WORKSPACE_KEY.ADMIN,
    routeKey: "admin",
    panelKey: "panel_admin_runtime",
    focusKey: "runtime_bot",
    tab: "home"
  }),
  [SHELL_ACTION_KEY.ADMIN_RUNTIME_META]: Object.freeze({
    workspace: CANONICAL_WORKSPACE_KEY.ADMIN,
    routeKey: "admin",
    panelKey: "panel_admin_runtime",
    focusKey: "runtime_meta",
    tab: "home"
  })
});

const LAUNCH_SURFACE_SHELL_ACTION_KEY = Object.freeze({
  play_world: SHELL_ACTION_KEY.PLAYER_WORLD_HUB,
  mission_quarter: SHELL_ACTION_KEY.PLAYER_TASKS_BOARD,
  profile_hub: SHELL_ACTION_KEY.PLAYER_PROFILE_PANEL,
  wallet_panel: SHELL_ACTION_KEY.PLAYER_WALLET_CONNECT,
  status_hub: SHELL_ACTION_KEY.PLAYER_STATUS_PANEL,
  discover_panel: SHELL_ACTION_KEY.PLAYER_DISCOVER_CENTER,
  rewards_vault: SHELL_ACTION_KEY.PLAYER_REWARDS_PANEL,
  events_hall: SHELL_ACTION_KEY.PLAYER_EVENTS_HALL,
  settings_panel: SHELL_ACTION_KEY.PLAYER_SETTINGS_PANEL,
  support_panel: SHELL_ACTION_KEY.PLAYER_SUPPORT_PANEL,
  faq_panel: SHELL_ACTION_KEY.PLAYER_SUPPORT_FAQ,
  payout_screen: SHELL_ACTION_KEY.PLAYER_PAYOUT_REQUEST,
  season_hall: SHELL_ACTION_KEY.PLAYER_SEASON_HALL,
  leaderboard_panel: SHELL_ACTION_KEY.PLAYER_PVP_LEADERBOARD,
  admin_workspace: SHELL_ACTION_KEY.ADMIN_WORKSPACE,
  admin_queue: SHELL_ACTION_KEY.ADMIN_QUEUE_PANEL,
  admin_policy: SHELL_ACTION_KEY.ADMIN_POLICY_PANEL,
  admin_runtime: SHELL_ACTION_KEY.ADMIN_RUNTIME_META,
  admin_live_ops: SHELL_ACTION_KEY.ADMIN_LIVE_OPS_PANEL
});

const BOT_HANDLER_SHELL_ACTION_KEY = Object.freeze({
  play: SHELL_ACTION_KEY.PLAYER_WORLD_HUB,
  profile: SHELL_ACTION_KEY.PLAYER_PROFILE_PANEL,
  rewards: SHELL_ACTION_KEY.PLAYER_REWARDS_PANEL,
  tasks: SHELL_ACTION_KEY.PLAYER_TASKS_BOARD,
  discover: SHELL_ACTION_KEY.PLAYER_DISCOVER_CENTER,
  events: SHELL_ACTION_KEY.PLAYER_EVENTS_HALL,
  wallet: SHELL_ACTION_KEY.PLAYER_WALLET_CONNECT,
  token: SHELL_ACTION_KEY.PLAYER_WALLET_CONNECT,
  season: SHELL_ACTION_KEY.PLAYER_SEASON_HALL,
  leaderboard: SHELL_ACTION_KEY.PLAYER_PVP_LEADERBOARD,
  shop: SHELL_ACTION_KEY.PLAYER_REWARDS_PANEL,
  missions: SHELL_ACTION_KEY.PLAYER_TASKS_BOARD,
  daily: SHELL_ACTION_KEY.PLAYER_TASKS_BOARD,
  claim: SHELL_ACTION_KEY.PLAYER_TASKS_CLAIMS,
  payout: SHELL_ACTION_KEY.PLAYER_PAYOUT_REQUEST,
  status: SHELL_ACTION_KEY.PLAYER_STATUS_PANEL,
  settings: SHELL_ACTION_KEY.PLAYER_SETTINGS_PANEL,
  support: SHELL_ACTION_KEY.PLAYER_SUPPORT_PANEL,
  faq: SHELL_ACTION_KEY.PLAYER_SUPPORT_FAQ,
  nexus: SHELL_ACTION_KEY.PLAYER_PROFILE_PANEL,
  admin: SHELL_ACTION_KEY.ADMIN_WORKSPACE,
  admin_live: SHELL_ACTION_KEY.ADMIN_WORKSPACE,
  admin_queue: SHELL_ACTION_KEY.ADMIN_QUEUE_PANEL,
  admin_live_ops: SHELL_ACTION_KEY.ADMIN_LIVE_OPS_PANEL,
  admin_metrics: SHELL_ACTION_KEY.ADMIN_RUNTIME_META,
  admin_gate: SHELL_ACTION_KEY.ADMIN_POLICY_PANEL,
  admin_open_payouts: SHELL_ACTION_KEY.ADMIN_QUEUE_PANEL,
  admin_open_queue: SHELL_ACTION_KEY.ADMIN_QUEUE_PANEL,
  admin_open_tokens: SHELL_ACTION_KEY.ADMIN_QUEUE_PANEL
});

function normalizeShellActionKey(value) {
  return String(value || "").trim().toLowerCase();
}

function resolveShellActionTarget(actionKey) {
  const key = normalizeShellActionKey(actionKey);
  if (!key) {
    return null;
  }
  const config = SHELL_ACTION_CATALOG[key];
  if (!config) {
    return null;
  }
  const target = resolveLaunchTarget({
    workspace: config.workspace,
    routeKey: config.routeKey,
    panelKey: config.panelKey,
    focusKey: config.focusKey,
    tab: config.tab
  });
  return Object.freeze({
    action_key: key,
    workspace: config.workspace,
    route_key: String(target.route_key || config.routeKey || ""),
    panel_key: String(target.panel_key || config.panelKey || ""),
    focus_key: String(target.focus_key || config.focusKey || ""),
    tab: String(target.tab || config.tab || "home")
  });
}

function resolveShellActionKeyForBotHandler(handlerKey) {
  const key = normalizeShellActionKey(handlerKey);
  return BOT_HANDLER_SHELL_ACTION_KEY[key] || "";
}

function resolveShellActionKeyForLaunchSurface(surfaceKey) {
  const key = normalizeShellActionKey(surfaceKey);
  return LAUNCH_SURFACE_SHELL_ACTION_KEY[key] || "";
}

module.exports = {
  SHELL_ACTION_KEY,
  SHELL_ACTION_CATALOG,
  LAUNCH_SURFACE_SHELL_ACTION_KEY,
  BOT_HANDLER_SHELL_ACTION_KEY,
  normalizeShellActionKey,
  resolveShellActionTarget,
  resolveShellActionKeyForBotHandler,
  resolveShellActionKeyForLaunchSurface
};
