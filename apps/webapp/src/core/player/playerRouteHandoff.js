import * as navigationContract from "../../../../../packages/shared/src/navigationContract.js";
import * as launchEventContract from "../../../../../packages/shared/src/launchEventContract.js";

const { CANONICAL_WORKSPACE_KEY, resolveLaunchTarget } = navigationContract;
const { resolveInternalLaunchEventKey } = launchEventContract;

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
    workspace: CANONICAL_WORKSPACE_KEY.PLAYER,
    tab: String(target.tab || "home")
  };
}
