import * as navigationContract from "../../../../../packages/shared/src/navigationContract.js";
import * as launchEventContract from "../../../../../packages/shared/src/launchEventContract.js";

const { resolveLaunchTarget } = navigationContract;
const { normalizeLaunchEventKey } = launchEventContract;

export function normalizeLaunchContext(input = null, defaults = {}) {
  if (!input || typeof input !== "object") {
    return null;
  }

  const target = resolveLaunchTarget({
    workspace: input.workspace || defaults.workspace || "",
    routeKey: input.routeKey || input.route_key || defaults.route_key || "",
    panelKey: input.panelKey || input.panel_key || defaults.panel_key || "",
    focusKey: input.focusKey || input.focus_key || defaults.focus_key || "",
    tab: input.tab || defaults.tab || "",
    launch_event_key: input.launchEventKey || input.launch_event_key || defaults.launch_event_key || ""
  });
  const launchEventKey = normalizeLaunchEventKey(
    input.launchEventKey || input.launch_event_key || defaults.launch_event_key || "",
    ""
  );

  if (!target.route_key && !target.panel_key && !target.focus_key) {
    return null;
  }

  return {
    route_key: String(target.route_key || ""),
    panel_key: String(target.panel_key || ""),
    focus_key: String(target.focus_key || ""),
    launch_event_key: launchEventKey,
    workspace: String(target.workspace || defaults.workspace || "player"),
    tab: String(target.tab || defaults.tab || "home")
  };
}

export function buildLaunchContextToken(input = null, defaults = {}) {
  const target = normalizeLaunchContext(input, defaults);
  if (!target) {
    return "";
  }
  return [target.route_key, target.panel_key, target.focus_key, target.launch_event_key || "", target.workspace, target.tab].join(":");
}
