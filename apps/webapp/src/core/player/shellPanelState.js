function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export const PLAYER_SHELL_PANEL_KEY = Object.freeze({
  PROFILE: "profile",
  STATUS: "status",
  REWARDS: "rewards",
  SETTINGS: "settings",
  SUPPORT: "support",
  DISCOVER: "discover"
});

export function resolvePlayerShellPanelTab(panelKey) {
  const normalizedPanelKey = normalizeKey(panelKey);
  if (normalizedPanelKey === PLAYER_SHELL_PANEL_KEY.REWARDS) {
    return "vault";
  }
  return "home";
}

function buildTarget(panelKey, sourcePanelKey, focusKey, launchEventKey = "") {
  const normalizedPanelKey = normalizeKey(panelKey);
  const normalizedSourcePanelKey = normalizeKey(sourcePanelKey);
  const normalizedFocusKey = normalizeKey(focusKey);
  const normalizedLaunchEventKey = normalizeKey(launchEventKey);
  return {
    panel_key: normalizedPanelKey,
    source_panel_key: normalizedSourcePanelKey,
    focus_key: normalizedFocusKey,
    ...(normalizedLaunchEventKey ? { launch_event_key: normalizedLaunchEventKey } : {}),
    token: [normalizedPanelKey, normalizedSourcePanelKey, normalizedFocusKey, normalizedLaunchEventKey].filter(Boolean).join(":")
  };
}

export function resolvePlayerShellPanelTarget(input = {}) {
  const launchContext = input.launchContext && typeof input.launchContext === "object" ? input.launchContext : {};
  const tabKey = normalizeKey(input.tab || launchContext.tab || "home");

  const routeKey = normalizeKey(launchContext.route_key || "");
  const panelKey = normalizeKey(launchContext.panel_key || "");
  const focusKey = normalizeKey(launchContext.focus_key || "");
  const launchEventKey = normalizeKey(launchContext.launch_event_key || "");

  if (panelKey === "profile") {
    return tabKey === "home" ? buildTarget(PLAYER_SHELL_PANEL_KEY.PROFILE, panelKey, focusKey || "identity", launchEventKey) : null;
  }

  if (panelKey === "status") {
    return tabKey === "home" ? buildTarget(PLAYER_SHELL_PANEL_KEY.STATUS, panelKey, focusKey || "system_status", launchEventKey) : null;
  }

  if (panelKey === "rewards") {
    return tabKey === "vault" ? buildTarget(PLAYER_SHELL_PANEL_KEY.REWARDS, panelKey, focusKey || "premium_pass", launchEventKey) : null;
  }

  if (panelKey === "language" || routeKey === "settings") {
    return tabKey === "home" ? buildTarget(PLAYER_SHELL_PANEL_KEY.SETTINGS, panelKey || "language", focusKey || "locale_override", launchEventKey) : null;
  }

  if (panelKey === "support" || panelKey === "faq" || panelKey === "help") {
    return tabKey === "home" ? buildTarget(PLAYER_SHELL_PANEL_KEY.SUPPORT, panelKey || "support", focusKey || "faq_cards", launchEventKey) : null;
  }

  if (panelKey === "discover") {
    return tabKey === "home" ? buildTarget(PLAYER_SHELL_PANEL_KEY.DISCOVER, panelKey, focusKey || "command_center", launchEventKey) : null;
  }

  return null;
}
