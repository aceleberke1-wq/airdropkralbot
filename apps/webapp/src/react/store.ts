import type { BootstrapV2Data, ExperimentAssignment, LaunchContext, TabKey, WebAppAuth, WorkspaceKey } from "./types";
import { type Lang } from "./i18n";
import { useCallback, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "./redux/hooks";
import {
  adminActions,
  deriveUiFromBootstrap,
  navigationActions,
  playerActions,
  pvpActions,
  sceneActions,
  selectScene,
  selectAdminRuntime,
  selectAuth,
  selectExperiment,
  selectNavigationLaunchContext,
  selectNavigationRequestKey,
  selectPlayerData,
  selectPvpRuntime,
  selectUi,
  sessionActions,
  uiActions
} from "./redux/slices/shellSlices";
import { collectCapabilityProfile } from "../core/runtime/capabilityProfile.js";

type AdminRuntimeData = {
  summary: Record<string, unknown> | null;
  queue: Array<Record<string, unknown>>;
  updatedAt: string;
};

type PvpRuntimeData = {
  session: Record<string, unknown> | null;
  updatedAt: string;
};

type ReactShellState = {
  auth: WebAppAuth;
  data: BootstrapV2Data | null;
  experiment: ExperimentAssignment;
  tab: TabKey;
  workspace: WorkspaceKey;
  lang: Lang;
  advanced: boolean;
  onboardingVisible: boolean;
  loading: boolean;
  error: string;
  adminRuntime: AdminRuntimeData;
  pvpRuntime: PvpRuntimeData;
  scene: {
    qualityMode: "auto" | "high" | "medium" | "low";
    effectiveQuality: "high" | "medium" | "low";
    hudDensity: "compact" | "normal";
    reducedMotion: boolean;
    largeText: boolean;
    capabilityProfile: Record<string, unknown> | null;
    selectedLoop: Record<string, unknown> | null;
  };
  navigationContext: LaunchContext | null;
  navigationRequestKey: number;
  setBootstrap: (data: BootstrapV2Data) => void;
  patchData: (patch: Partial<BootstrapV2Data>) => void;
  setAuth: (auth: WebAppAuth) => void;
  setTab: (tab: TabKey) => void;
  setWorkspace: (workspace: WorkspaceKey) => void;
  setLang: (lang: Lang) => void;
  toggleAdvanced: () => void;
  hideOnboarding: () => void;
  setLoading: (next: boolean) => void;
  setError: (message: string) => void;
  setAdminRuntime: (summary: Record<string, unknown> | null, queue?: Array<Record<string, unknown>>) => void;
  setPvpRuntime: (session: Record<string, unknown> | null) => void;
};

export function useReactShellStore(): ReactShellState {
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const data = useAppSelector(selectPlayerData);
  const experiment = useAppSelector(selectExperiment);
  const ui = useAppSelector(selectUi);
  const adminRuntime = useAppSelector(selectAdminRuntime);
  const pvpRuntime = useAppSelector(selectPvpRuntime);
  const scene = useAppSelector(selectScene);
  const navigationContext = useAppSelector(selectNavigationLaunchContext);
  const navigationRequestKey = useAppSelector(selectNavigationRequestKey);

  const setBootstrap = useCallback(
    (nextData: BootstrapV2Data) => {
      const rawLaunchContext =
        nextData?.launch_context && typeof nextData.launch_context === "object" ? nextData.launch_context : null;
      const effectiveLaunchContext = rawLaunchContext || navigationContext || null;
      const rawUiPrefs =
        nextData?.ui_prefs && typeof nextData.ui_prefs === "object" ? (nextData.ui_prefs as Record<string, unknown>) : {};
      const rawPrefsJson =
        rawUiPrefs.prefs_json && typeof rawUiPrefs.prefs_json === "object"
          ? (rawUiPrefs.prefs_json as Record<string, unknown>)
          : {};
      const normalizedData = {
        ...nextData,
        launch_context: effectiveLaunchContext,
        ui_prefs: {
          ...rawUiPrefs,
          prefs_json: {
            ...rawPrefsJson,
            ...(effectiveLaunchContext?.tab ? { last_tab: effectiveLaunchContext.tab } : {}),
            ...(effectiveLaunchContext?.workspace
              ? { workspace: effectiveLaunchContext.workspace === "admin" ? "admin" : "player" }
              : {})
          }
        }
      } as BootstrapV2Data;
      const capabilityProfile = collectCapabilityProfile({
        qualityMode: String(normalizedData?.ui_prefs?.quality_mode || "auto"),
        reducedMotion: Boolean(normalizedData?.ui_prefs?.reduced_motion),
        largeText: Boolean(normalizedData?.ui_prefs?.large_text)
      });
      dispatch(playerActions.setBootstrap(normalizedData));
      dispatch(navigationActions.hydrateLaunchContext(effectiveLaunchContext));
      dispatch(
        uiActions.applyBootstrapUi(
          deriveUiFromBootstrap(normalizedData, {
            tab: ui.tab,
            workspace: ui.workspace,
            lang: ui.lang,
            advanced: ui.advanced,
            onboardingVisible: ui.onboardingVisible
          })
        )
      );
      dispatch(
        sceneActions.setScenePreferences({
          reducedMotion: Boolean(capabilityProfile.effective_reduced_motion),
          largeText: Boolean(capabilityProfile.large_text),
          qualityMode: String(capabilityProfile.requested_quality || "auto") as "auto" | "high" | "medium" | "low",
          effectiveQuality: String(capabilityProfile.effective_quality || "medium") as "high" | "medium" | "low",
          hudDensity: String(capabilityProfile.effective_hud_density || "normal") as "compact" | "normal",
          capabilityProfile
        })
      );
    },
    [dispatch, navigationContext, ui.tab, ui.workspace, ui.lang, ui.advanced, ui.onboardingVisible]
  );

  const patchData = useCallback(
    (patch: Partial<BootstrapV2Data>) => {
      dispatch(playerActions.patchData(patch));
      if (Object.prototype.hasOwnProperty.call(patch || {}, "launch_context")) {
        dispatch(navigationActions.hydrateLaunchContext((patch || {}).launch_context || null));
      }
      if (Object.prototype.hasOwnProperty.call(patch || {}, "ui_prefs")) {
        const nextPrefs = patch?.ui_prefs && typeof patch.ui_prefs === "object" ? patch.ui_prefs : {};
        const nextPrefsRecord = nextPrefs as Record<string, unknown>;
        const capabilityProfile = collectCapabilityProfile({
          qualityMode: String(nextPrefsRecord.quality_mode || scene.qualityMode || "auto"),
          reducedMotion:
            typeof nextPrefsRecord.reduced_motion === "boolean" ? Boolean(nextPrefsRecord.reduced_motion) : scene.reducedMotion,
          largeText: typeof nextPrefsRecord.large_text === "boolean" ? Boolean(nextPrefsRecord.large_text) : scene.largeText
        });
        dispatch(
          sceneActions.setScenePreferences({
            reducedMotion: Boolean(capabilityProfile.effective_reduced_motion),
            largeText: Boolean(capabilityProfile.large_text),
            qualityMode: String(capabilityProfile.requested_quality || "auto") as "auto" | "high" | "medium" | "low",
            effectiveQuality: String(capabilityProfile.effective_quality || "medium") as "high" | "medium" | "low",
            hudDensity: String(capabilityProfile.effective_hud_density || "normal") as "compact" | "normal",
            capabilityProfile
          })
        );
      }
    },
    [dispatch, scene.qualityMode, scene.reducedMotion, scene.largeText, scene.hudDensity]
  );

  const setAuth = useCallback((nextAuth: WebAppAuth) => {
    dispatch(sessionActions.setAuth(nextAuth));
  }, [dispatch]);

  const setTab = useCallback((nextTab: TabKey) => {
    dispatch(uiActions.setTab(nextTab));
  }, [dispatch]);

  const setWorkspace = useCallback((nextWorkspace: WorkspaceKey) => {
    dispatch(uiActions.setWorkspace(nextWorkspace));
  }, [dispatch]);

  const setLang = useCallback((nextLang: Lang) => {
    dispatch(uiActions.setLang(nextLang));
  }, [dispatch]);

  const toggleAdvanced = useCallback(() => {
    dispatch(uiActions.toggleAdvanced());
  }, [dispatch]);

  const hideOnboarding = useCallback(() => {
    dispatch(uiActions.hideOnboarding());
  }, [dispatch]);

  const setLoading = useCallback((next: boolean) => {
    dispatch(uiActions.setLoading(next));
  }, [dispatch]);

  const setError = useCallback((message: string) => {
    dispatch(uiActions.setError(message));
  }, [dispatch]);

  const setAdminRuntime = useCallback((summary: Record<string, unknown> | null, queue: Array<Record<string, unknown>> = []) => {
      dispatch(
        adminActions.setAdminRuntime({
          summary: summary || null,
          queue: Array.isArray(queue) ? queue : []
        })
      );
    }, [dispatch]);

  const setPvpRuntime = useCallback((session: Record<string, unknown> | null) => {
    dispatch(pvpActions.setPvpRuntime(session || null));
  }, [dispatch]);

  return useMemo(
    () => ({
      auth,
      data,
      experiment,
      tab: ui.tab,
      workspace: ui.workspace,
      lang: ui.lang,
      advanced: ui.advanced,
      onboardingVisible: ui.onboardingVisible,
      loading: ui.loading,
      error: ui.error,
      adminRuntime,
      pvpRuntime,
      scene,
      navigationContext,
      navigationRequestKey,
      setBootstrap,
      patchData,
      setAuth,
      setTab,
      setWorkspace,
      setLang,
      toggleAdvanced,
      hideOnboarding,
      setLoading,
      setError,
      setAdminRuntime,
      setPvpRuntime
    }),
    [
      auth,
      data,
      experiment,
      ui.tab,
      ui.workspace,
      ui.lang,
      ui.advanced,
      ui.onboardingVisible,
      ui.loading,
      ui.error,
      adminRuntime,
      pvpRuntime,
      scene,
      navigationContext,
      navigationRequestKey,
      setBootstrap,
      patchData,
      setAuth,
      setTab,
      setWorkspace,
      setLang,
      toggleAdvanced,
      hideOnboarding,
      setLoading,
      setError,
      setAdminRuntime,
      setPvpRuntime
    ]
  );
}
