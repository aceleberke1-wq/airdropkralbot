import { useCallback, useEffect, useMemo, useState } from "react";
import { resolveAdminRouteHandoff } from "../../../core/admin/adminRouteHandoff.js";
import { UI_EVENT_KEY, UI_FUNNEL_KEY, UI_SURFACE_KEY } from "../../../core/telemetry/uiEventTaxonomy";
import { useLaunchFocusController } from "../shell/useLaunchFocusController";
import type { LaunchContext } from "../../types";

type AdminRouteTargetInput = {
  routeKey?: string;
  panelKey?: string;
  focusKey?: string;
  sourcePanelKey?: string;
};

type AdminNavigationControllerOptions = {
  launchContext: LaunchContext | null;
  reducedMotion: boolean;
  trackUiEvent: (payload: Record<string, unknown>) => void;
};

function buildLaunchToken(value: LaunchContext | null) {
  if (!value) {
    return "";
  }
  return [
    String(value.route_key || ""),
    String(value.panel_key || ""),
    String(value.focus_key || ""),
    String(value.workspace || ""),
    String(value.tab || "")
  ].join(":");
}

export function useAdminNavigationController(options: AdminNavigationControllerOptions) {
  const externalLaunchToken = useMemo(() => buildLaunchToken(options.launchContext), [options.launchContext]);
  const [activeRouteContext, setActiveRouteContext] = useState<LaunchContext | null>(options.launchContext);
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    setActiveRouteContext(options.launchContext);
    if (externalLaunchToken) {
      setRequestKey((value) => value + 1);
    }
  }, [externalLaunchToken, options.launchContext]);

  useLaunchFocusController({
    launchContext: activeRouteContext,
    workspace: "admin",
    tab: "home",
    reducedMotion: options.reducedMotion,
    requestKey,
    enableFocus: true
  });

  const routeToTarget = useCallback(
    (input: AdminRouteTargetInput) => {
      const target = resolveAdminRouteHandoff({
        routeKey: input.routeKey,
        panelKey: input.panelKey,
        focusKey: input.focusKey
      }) as LaunchContext;

      setActiveRouteContext(target);
      setRequestKey((value) => value + 1);
      options.trackUiEvent({
        event_key: UI_EVENT_KEY.PANEL_OPEN,
        tab_key: "home",
        panel_key: target.panel_key || UI_SURFACE_KEY.PANEL_ADMIN,
        route_key: target.route_key || "admin",
        focus_key: target.focus_key || "",
        funnel_key: UI_FUNNEL_KEY.ADMIN_OPS,
        surface_key: input.sourcePanelKey || UI_SURFACE_KEY.PANEL_ADMIN,
        payload_json: {
          source: "admin_route_handoff",
          source_panel_key: input.sourcePanelKey || UI_SURFACE_KEY.PANEL_ADMIN,
          target_panel_key: target.panel_key || "",
          target_focus_key: target.focus_key || ""
        }
      });
    },
    [options.trackUiEvent]
  );

  return {
    routeToTarget
  };
}
