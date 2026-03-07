import { useCallback, useMemo } from "react";
import { resolveAdminPanelVisibility } from "../../../core/admin/adminPanelSwitches";
import type { WebAppAuth, WebAppApiResponse } from "../../types";

type PanelKey = "queue" | "dynamicPolicy" | "liveOps" | "runtimeFlags" | "runtimeBot" | "runtimeMeta";

type PatchUiPreferencesMutation = (payload: Record<string, unknown>) => { unwrap: () => Promise<any> };

type ShellSessionPrefsControllerOptions = {
  adminPanelsRuntimeFlags: Record<string, unknown> | null;
  runtimeFlagsQueryData: WebAppApiResponse | null;
  fallbackFeatureFlags: Record<string, unknown> | null;
  setError: (next: string) => void;
  setAuth: (next: WebAppAuth) => void;
  hasActiveAuth: boolean;
  activeAuth: WebAppAuth;
  patchUiPreferences: PatchUiPreferencesMutation;
  patchData: (patch: Record<string, unknown>) => void;
};

export function useShellSessionPrefsController(options: ShellSessionPrefsControllerOptions) {
  const adminPanelVisibility = useMemo(
    () =>
      resolveAdminPanelVisibility({
        runtimeFlags: options.adminPanelsRuntimeFlags || ((options.runtimeFlagsQueryData?.data as Record<string, unknown> | undefined) || null),
        fallbackFlags: options.fallbackFeatureFlags
      }),
    [options.adminPanelsRuntimeFlags, options.runtimeFlagsQueryData, options.fallbackFeatureFlags]
  );

  const ensureAdminPanelEnabled = useCallback(
    (panelKey: PanelKey): boolean => {
      if (adminPanelVisibility[panelKey]) {
        return true;
      }
      options.setError("admin_panel_disabled_by_flag");
      return false;
    },
    [adminPanelVisibility, options]
  );

  const applySession = useCallback(
    (payload: any) => {
      if (payload?.session?.uid && payload?.session?.ts && payload?.session?.sig) {
        options.setAuth({
          uid: String(payload.session.uid),
          ts: String(payload.session.ts),
          sig: String(payload.session.sig)
        });
      }
    },
    [options]
  );

  const syncPrefs = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!options.hasActiveAuth) return;
      const res = await options
        .patchUiPreferences({
          auth: options.activeAuth,
          patch
        })
        .unwrap()
        .catch(() => null);
      if (!res?.success || !res.data?.ui_preferences) return;
      options.patchData({ ui_prefs: res.data.ui_preferences });
    },
    [options]
  );

  return {
    adminPanelVisibility,
    ensureAdminPanelEnabled,
    applySession,
    syncPrefs
  };
}
