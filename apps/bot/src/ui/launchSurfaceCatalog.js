"use strict";

const { resolveSurfaceLaunchEventKey } = require("../../../../packages/shared/src/launchEventContract");

const PLAYER_LAUNCH_SURFACE_CATALOG = Object.freeze({
  play_world: Object.freeze({ commandKey: "play", labelKey: "open_play" }),
  mission_quarter: Object.freeze({ commandKey: "missions", labelKey: "open_mission_quarter" }),
  profile_hub: Object.freeze({ commandKey: "profile", labelKey: "open_profile_hub" }),
  wallet_panel: Object.freeze({ commandKey: "wallet", labelKey: "open_wallet_panel" }),
  status_hub: Object.freeze({ commandKey: "status", labelKey: "open_status_hub" }),
  discover_panel: Object.freeze({ commandKey: "discover", labelKey: "open_discover_panel" }),
  rewards_vault: Object.freeze({ commandKey: "rewards", labelKey: "open_rewards_vault" }),
  events_hall: Object.freeze({ commandKey: "events", labelKey: "open_events_hall" }),
  settings_panel: Object.freeze({ commandKey: "settings", labelKey: "open_settings_panel" }),
  support_panel: Object.freeze({ commandKey: "support", labelKey: "open_support_panel" }),
  faq_panel: Object.freeze({ commandKey: "faq", labelKey: "open_faq_panel" }),
  payout_screen: Object.freeze({ commandKey: "payout", labelKey: "open_payout_screen" }),
  season_hall: Object.freeze({ commandKey: "season", labelKey: "open_season_hall" }),
  leaderboard_panel: Object.freeze({ commandKey: "leaderboard", labelKey: "open_leaderboard_panel" })
});

const ADMIN_LAUNCH_SURFACE_CATALOG = Object.freeze({
  admin_workspace: Object.freeze({ commandKey: "admin", labelKey: "open_admin_workspace" }),
  admin_queue: Object.freeze({ commandKey: "admin_queue", labelKey: "admin_unified_queue" }),
  admin_policy: Object.freeze({ commandKey: "admin_gate", labelKey: "admin_policy_panel" }),
  admin_runtime: Object.freeze({ commandKey: "admin_metrics", labelKey: "admin_runtime_panel" })
});

const COMBINED_LAUNCH_SURFACE_CATALOG = Object.freeze({
  ...PLAYER_LAUNCH_SURFACE_CATALOG,
  ...ADMIN_LAUNCH_SURFACE_CATALOG
});

function buildLaunchSurfaceEntries(surfaceKeys = [], catalog = COMBINED_LAUNCH_SURFACE_CATALOG) {
  return (Array.isArray(surfaceKeys) ? surfaceKeys : [])
    .map((surfaceKey) => {
      const key = String(surfaceKey || "").trim();
      const config = catalog[key];
      if (!key || !config?.commandKey) {
        return null;
      }
      return {
        key,
        commandKey: config.commandKey,
        overrides: {
          ...(config.overrides || {}),
          launchEventKey: resolveSurfaceLaunchEventKey(key)
        }
      };
    })
    .filter(Boolean);
}

function resolveLaunchSurface(surfaceKey, catalog = COMBINED_LAUNCH_SURFACE_CATALOG) {
  const key = String(surfaceKey || "").trim();
  if (!key) {
    return null;
  }
  const config = catalog[key];
  if (!config) {
    return null;
  }
  return Object.freeze({
    key,
    commandKey: config.commandKey,
    labelKey: config.labelKey,
    overrides: {
      ...(config.overrides || {}),
      launchEventKey: resolveSurfaceLaunchEventKey(key)
    }
  });
}

module.exports = {
  PLAYER_LAUNCH_SURFACE_CATALOG,
  ADMIN_LAUNCH_SURFACE_CATALOG,
  COMBINED_LAUNCH_SURFACE_CATALOG,
  buildLaunchSurfaceEntries,
  resolveLaunchSurface
};
