import { useCallback } from "react";
import { resolvePlayerRouteHandoff } from "../../../core/player/playerRouteHandoff.js";
import { UI_EVENT_KEY, UI_FUNNEL_KEY, UI_SURFACE_KEY } from "../../../core/telemetry/uiEventTaxonomy";
import { useLaunchFocusController } from "../shell/useLaunchFocusController";
import { usePlayerShellPanelController } from "./usePlayerShellPanelController";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { navigationActions, selectNavigationLaunchContext, selectNavigationRequestKey } from "../../redux/slices/shellSlices";
import type { LaunchContext, TabKey } from "../../types";

type RouteTargetInput = {
  routeKey?: string;
  panelKey?: string;
  focusKey?: string;
  tab?: TabKey | string;
  sourcePanelKey?: string;
};

type PlayerNavigationControllerOptions = {
  tab: TabKey;
  reducedMotion: boolean;
  onTabChange: (next: TabKey) => void;
  trackUiEvent: (payload: Record<string, unknown>) => void;
};

function resolveFunnelKey(tab: TabKey) {
  if (tab === "pvp") {
    return UI_FUNNEL_KEY.PVP_LOOP;
  }
  if (tab === "tasks") {
    return UI_FUNNEL_KEY.TASKS_LOOP;
  }
  if (tab === "vault") {
    return UI_FUNNEL_KEY.VAULT_LOOP;
  }
  return UI_FUNNEL_KEY.PLAYER_LOOP;
}

export function usePlayerNavigationController(options: PlayerNavigationControllerOptions) {
  const dispatch = useAppDispatch();
  const activeRouteContext = useAppSelector(selectNavigationLaunchContext);
  const requestKey = useAppSelector(selectNavigationRequestKey);

  useLaunchFocusController({
    launchContext: activeRouteContext,
    workspace: "player",
    tab: options.tab,
    reducedMotion: options.reducedMotion,
    requestKey,
    enableFocus: true
  });

  const { activePanelKey, activeFocusKey, openPanel, closePanel } = usePlayerShellPanelController({
    launchContext: activeRouteContext,
    tab: options.tab,
    trackUiEvent: options.trackUiEvent
  });

  const routeToTarget = useCallback(
    (input: RouteTargetInput) => {
      const target = resolvePlayerRouteHandoff({
        routeKey: input.routeKey,
        panelKey: input.panelKey,
        focusKey: input.focusKey,
        tab: input.tab
      }) as LaunchContext;
      const targetTab = (target.tab || "home") as TabKey;

      dispatch(navigationActions.routeLaunchContext(target));
      const launchEventKey = String(target.launch_event_key || "").trim();
      options.trackUiEvent({
        event_key: UI_EVENT_KEY.PANEL_OPEN,
        tab_key: targetTab,
        panel_key: target.panel_key || UI_SURFACE_KEY.SHELL,
        route_key: target.route_key || "",
        focus_key: target.focus_key || "",
        funnel_key: resolveFunnelKey(targetTab),
        surface_key: input.sourcePanelKey || UI_SURFACE_KEY.SHELL,
        payload_json: {
          source: "player_route_handoff",
          launch_event_key: launchEventKey,
          source_panel_key: input.sourcePanelKey || UI_SURFACE_KEY.SHELL,
          target_panel_key: target.panel_key || "",
          from_tab: options.tab,
          cross_tab: targetTab !== options.tab
        }
      });

      if (targetTab !== options.tab) {
        options.onTabChange(targetTab);
      }
    },
    [dispatch, options.onTabChange, options.tab, options.trackUiEvent]
  );

  return {
    activeRouteContext,
    activePanelKey,
    activeFocusKey,
    openPanel,
    closePanel,
    routeToTarget
  };
}
