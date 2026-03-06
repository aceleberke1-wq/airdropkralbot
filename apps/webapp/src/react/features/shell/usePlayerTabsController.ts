import { useCallback } from "react";
import { UI_EVENT_KEY, UI_FUNNEL_KEY, UI_SURFACE_KEY } from "../../../core/telemetry/uiEventTaxonomy";
import type { TabKey } from "../../types";

type PlayerTabsControllerOptions = {
  tab: TabKey;
  setTab: (next: TabKey) => void;
  trackUiEvent: (payload: Record<string, unknown>) => void;
  syncPrefs: (patch: Record<string, unknown>) => Promise<void> | void;
};

export function usePlayerTabsController(options: PlayerTabsControllerOptions) {
  const onTabChange = useCallback(
    (entry: TabKey) => {
      options.trackUiEvent({
        event_key: UI_EVENT_KEY.TAB_SWITCH,
        panel_key: UI_SURFACE_KEY.PLAYER_TABS,
        funnel_key: UI_FUNNEL_KEY.PLAYER_LOOP,
        surface_key: UI_SURFACE_KEY.PLAYER_TABS,
        payload_json: {
          from: options.tab,
          to: entry
        }
      });
      options.setTab(entry);
      void options.syncPrefs({ last_tab: entry });
    },
    [options]
  );

  return {
    onTabChange
  };
}
