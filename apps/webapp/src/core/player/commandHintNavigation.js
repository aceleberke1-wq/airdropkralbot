import * as playerCommandNavigation from "../shared/playerCommandNavigation.js";

const { resolvePlayerCommandActionKey, resolvePlayerCommandNavigation } = playerCommandNavigation;

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asText(value) {
  return String(value || "").trim();
}

export function resolvePlayerCommandHintNavigation(row = {}) {
  const item = asRecord(row);
  const commandKey = asText(item.key || item.command_key || "").replace(/^\/+/, "");
  const actionKey = asText(item.action_key || item.shell_action_key || resolvePlayerCommandActionKey(commandKey));
  if (actionKey) {
    return {
      kind: "action",
      action_key: actionKey
    };
  }

  const directRoute = asText(item.route_key || item.routeKey || "");
  const directPanel = asText(item.panel_key || item.panelKey || "");
  const directFocus = asText(item.focus_key || item.focusKey || "");
  const directTab = asText(item.tab || "");
  if (directRoute || directPanel || directFocus) {
    return {
      kind: "route",
      route_key: directRoute,
      panel_key: directPanel,
      focus_key: directFocus,
      tab: directTab
    };
  }

  const fallbackTarget = resolvePlayerCommandNavigation(commandKey);
  if (!fallbackTarget) {
    return null;
  }
  return {
    kind: "route",
    route_key: String(fallbackTarget.route_key || ""),
    panel_key: String(fallbackTarget.panel_key || ""),
    focus_key: String(fallbackTarget.focus_key || ""),
    tab: String(fallbackTarget.tab || "")
  };
}
