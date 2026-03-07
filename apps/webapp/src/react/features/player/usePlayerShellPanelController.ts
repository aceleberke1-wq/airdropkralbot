import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolvePlayerShellPanelTarget, resolvePlayerShellPanelTab } from "../../../core/player/shellPanelState.js";
import { UI_EVENT_KEY, UI_FUNNEL_KEY } from "../../../core/telemetry/uiEventTaxonomy";
import type { LaunchContext, TabKey } from "../../types";

export type PlayerShellPanelKey = "profile" | "status" | "rewards" | "settings" | "support" | "discover";

type PlayerShellPanelControllerOptions = {
  launchContext: LaunchContext | null;
  tab: TabKey;
  trackUiEvent: (payload: Record<string, unknown>) => void;
};

export function usePlayerShellPanelController(options: PlayerShellPanelControllerOptions) {
  const launchTarget = useMemo(
    () => resolvePlayerShellPanelTarget({ launchContext: options.launchContext, tab: options.tab }),
    [options.launchContext, options.tab]
  );
  const launchTokenRef = useRef("");
  const [activePanelKey, setActivePanelKey] = useState<PlayerShellPanelKey | null>(
    (launchTarget?.panel_key as PlayerShellPanelKey | undefined) || null
  );
  const [activeFocusKey, setActiveFocusKey] = useState<string>(launchTarget?.focus_key || "");

  useEffect(() => {
    if (activePanelKey && resolvePlayerShellPanelTab(activePanelKey) !== options.tab) {
      setActivePanelKey(null);
      setActiveFocusKey("");
    }
  }, [activePanelKey, options.tab]);

  useEffect(() => {
    if (!launchTarget) {
      return;
    }
    if (launchTokenRef.current === launchTarget.token) {
      return;
    }
    launchTokenRef.current = launchTarget.token;
    setActivePanelKey(launchTarget.panel_key as PlayerShellPanelKey);
    setActiveFocusKey(launchTarget.focus_key || "");
    options.trackUiEvent({
      event_key: UI_EVENT_KEY.PANEL_OPEN,
      panel_key: launchTarget.source_panel_key || launchTarget.panel_key,
      funnel_key: UI_FUNNEL_KEY.PLAYER_LOOP,
      surface_key: launchTarget.panel_key,
      focus_key: launchTarget.focus_key || "",
      payload_json: {
        source: "launch_handoff",
        shell_panel: launchTarget.panel_key
      }
    });
  }, [launchTarget, options.trackUiEvent]);

  const openPanel = useCallback(
    (panelKey: PlayerShellPanelKey, focusKey = "") => {
      setActivePanelKey(panelKey);
      setActiveFocusKey(String(focusKey || "").trim().toLowerCase());
      options.trackUiEvent({
        event_key: UI_EVENT_KEY.PANEL_OPEN,
        panel_key: panelKey,
        funnel_key: UI_FUNNEL_KEY.PLAYER_LOOP,
        surface_key: panelKey,
        focus_key: String(focusKey || "").trim().toLowerCase(),
        payload_json: {
          source: "manual",
          shell_panel: panelKey
        }
      });
    },
    [options.trackUiEvent]
  );

  const closePanel = useCallback(() => {
    if (!activePanelKey) {
      return;
    }
    options.trackUiEvent({
      event_key: UI_EVENT_KEY.PANEL_CLOSE,
      panel_key: activePanelKey,
      funnel_key: UI_FUNNEL_KEY.PLAYER_LOOP,
      surface_key: activePanelKey,
      focus_key: activeFocusKey || "",
      payload_json: {
        source: "manual",
        shell_panel: activePanelKey
      }
    });
    setActivePanelKey(null);
    setActiveFocusKey("");
  }, [activeFocusKey, activePanelKey, options.trackUiEvent]);

  return {
    activePanelKey,
    activeFocusKey,
    openPanel,
    closePanel
  };
}
