import * as navigationContract from "../shared/navigationContract.js";
import * as launchEventContract from "../shared/launchEventContract.js";
import * as shellActionCatalog from "../shared/shellActionCatalog.js";

const { resolveLaunchTarget } = navigationContract;
const { normalizeLaunchEventKey } = launchEventContract;
const { normalizeShellActionKey } = shellActionCatalog;

function readInputValue(input = {}, camelKey, snakeKey, fallback = undefined) {
  if (Object.prototype.hasOwnProperty.call(input, camelKey)) {
    return input[camelKey];
  }
  if (Object.prototype.hasOwnProperty.call(input, snakeKey)) {
    return input[snakeKey];
  }
  return fallback;
}

export function normalizeLaunchContext(input = null, defaults = {}) {
  if (!input || typeof input !== "object") {
    return null;
  }
  const explicitLaunchEventKey = readInputValue(input, "launchEventKey", "launch_event_key", defaults.launch_event_key || "");
  const explicitShellActionKey = readInputValue(input, "shellActionKey", "shell_action_key", defaults.shell_action_key || "");

  const target = resolveLaunchTarget({
    workspace: input.workspace || defaults.workspace || "",
    routeKey: input.routeKey || input.route_key || defaults.route_key || "",
    panelKey: input.panelKey || input.panel_key || defaults.panel_key || "",
    focusKey: input.focusKey || input.focus_key || defaults.focus_key || "",
    tab: input.tab || defaults.tab || "",
    launch_event_key: explicitLaunchEventKey,
    shell_action_key: explicitShellActionKey
  });
  const launchEventKey = normalizeLaunchEventKey(explicitLaunchEventKey, "");
  const shellActionKey = normalizeShellActionKey(explicitShellActionKey);

  if (!target.route_key && !target.panel_key && !target.focus_key) {
    return null;
  }

  return {
    route_key: String(target.route_key || ""),
    panel_key: String(target.panel_key || ""),
    focus_key: String(target.focus_key || ""),
    launch_event_key: launchEventKey,
    shell_action_key: shellActionKey,
    workspace: String(target.workspace || defaults.workspace || "player"),
    tab: String(target.tab || defaults.tab || "home")
  };
}

export function buildLaunchContextToken(input = null, defaults = {}) {
  const target = normalizeLaunchContext(input, defaults);
  if (!target) {
    return "";
  }
  return [target.route_key, target.panel_key, target.focus_key, target.launch_event_key || "", target.shell_action_key || "", target.workspace, target.tab].join(":");
}
