import { useCallback, useEffect, useMemo, useState } from "react";
import { resolvePlayerRouteHandoff } from "../../../core/player/playerRouteHandoff.js";
import { UI_EVENT_KEY, UI_FUNNEL_KEY, UI_SURFACE_KEY } from "../../../core/telemetry/uiEventTaxonomy";
import { useLaunchFocusController } from "../shell/useLaunchFocusController";
import { usePlayerShellPanelController } from "./usePlayerShellPanelController";
import type { LaunchContext, TabKey } from "../../types";

type RouteTargetInput = {
  routeKey?: string;
  panelKey?: string;
  focusKey?: string;
  tab?: TabKey | string;
  sourcePanelKey?: string;
};

type PlayerNavigationControllerOptions = {
  launchContext: LaunchContext | null;
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

export function usePlayerNavigationController(options: PlayerNavigationControllerOptions) {
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

      setActiveRouteContext(target);
      setRequestKey((value) => value + 1);
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
    [options.onTabChange, options.tab, options.trackUiEvent]
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
