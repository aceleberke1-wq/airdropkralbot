import { useCallback } from "react";
import { resolveAdminRouteHandoff } from "../../../core/admin/adminRouteHandoff.js";
import { UI_EVENT_KEY, UI_FUNNEL_KEY, UI_SURFACE_KEY } from "../../../core/telemetry/uiEventTaxonomy";
import { useLaunchFocusController } from "../shell/useLaunchFocusController";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { navigationActions, selectNavigationLaunchContext, selectNavigationRequestKey } from "../../redux/slices/shellSlices";
import type { LaunchContext } from "../../types";

type AdminRouteTargetInput = {
  routeKey?: string;
  panelKey?: string;
  focusKey?: string;
  sourcePanelKey?: string;
};

type AdminNavigationControllerOptions = {
  reducedMotion: boolean;
  trackUiEvent: (payload: Record<string, unknown>) => void;
};

export function useAdminNavigationController(options: AdminNavigationControllerOptions) {
  const dispatch = useAppDispatch();
  const activeRouteContext = useAppSelector(selectNavigationLaunchContext);
  const requestKey = useAppSelector(selectNavigationRequestKey);

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

      dispatch(navigationActions.routeLaunchContext(target));
      const launchEventKey = String(target.launch_event_key || "").trim();
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
          launch_event_key: launchEventKey,
          source_panel_key: input.sourcePanelKey || UI_SURFACE_KEY.PANEL_ADMIN,
          target_panel_key: target.panel_key || "",
          target_focus_key: target.focus_key || ""
        }
      });
    },
    [dispatch, options.trackUiEvent]
  );

  return {
    routeToTarget
  };
}
