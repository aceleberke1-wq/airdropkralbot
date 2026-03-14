import * as navigationContract from "../shared/navigationContract.js";
import * as launchEventContract from "../shared/launchEventContract.js";
import * as shellActionCatalog from "../shared/shellActionCatalog.js";

const { CANONICAL_WORKSPACE_KEY, resolveLaunchTarget } = navigationContract;
const { resolveInternalLaunchEventKey } = launchEventContract;
const { normalizeShellActionKey } = shellActionCatalog;

export function resolvePlayerRouteHandoff(input = {}) {
  const target = resolveLaunchTarget({
    workspace: CANONICAL_WORKSPACE_KEY.PLAYER,
    routeKey: input.routeKey || input.route_key || "",
    panelKey: input.panelKey || input.panel_key || "",
    focusKey: input.focusKey || input.focus_key || "",
    tab: input.tab || ""
  });

  return {
    route_key: String(target.route_key || "hub"),
    panel_key: String(target.panel_key || ""),
    focus_key: String(target.focus_key || ""),
    launch_event_key: resolveInternalLaunchEventKey(`player_route_${String(target.panel_key || target.route_key || "hub")}`),
    shell_action_key: normalizeShellActionKey(input.actionKey || input.action_key || ""),
    workspace: CANONICAL_WORKSPACE_KEY.PLAYER,
    tab: String(target.tab || "home")
  };
}
