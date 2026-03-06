import type { BootstrapV2Data, ExperimentAssignment, TabKey, WebAppAuth, WorkspaceKey } from "./types";
import { type Lang } from "./i18n";
import { useAppDispatch, useAppSelector } from "./redux/hooks";
import {
  adminActions,
  deriveUiFromBootstrap,
  playerActions,
  pvpActions,
  sceneActions,
  selectAdminRuntime,
  selectAuth,
  selectExperiment,
  selectPlayerData,
  selectPvpRuntime,
  selectUi,
  sessionActions,
  uiActions
} from "./redux/slices/shellSlices";

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

  return {
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
    setBootstrap: (nextData) => {
      dispatch(playerActions.setBootstrap(nextData));
      dispatch(
        uiActions.applyBootstrapUi(
          deriveUiFromBootstrap(nextData, {
            tab: ui.tab,
            workspace: ui.workspace,
            lang: ui.lang,
            onboardingVisible: ui.onboardingVisible
          })
        )
      );
      dispatch(
        sceneActions.setScenePreferences({
          reducedMotion: Boolean(nextData?.ui_prefs?.reduced_motion),
          largeText: Boolean(nextData?.ui_prefs?.large_text),
          qualityMode: String(nextData?.ui_prefs?.quality_mode || "auto") as "auto" | "high" | "medium" | "low"
        })
      );
    },
    patchData: (patch) => {
      dispatch(playerActions.patchData(patch));
    },
    setAuth: (nextAuth) => {
      dispatch(sessionActions.setAuth(nextAuth));
    },
    setTab: (nextTab) => {
      dispatch(uiActions.setTab(nextTab));
    },
    setWorkspace: (nextWorkspace) => {
      dispatch(uiActions.setWorkspace(nextWorkspace));
    },
    setLang: (nextLang) => {
      dispatch(uiActions.setLang(nextLang));
    },
    toggleAdvanced: () => {
      dispatch(uiActions.toggleAdvanced());
    },
    hideOnboarding: () => {
      dispatch(uiActions.hideOnboarding());
    },
    setLoading: (next) => {
      dispatch(uiActions.setLoading(next));
    },
    setError: (message) => {
      dispatch(uiActions.setError(message));
    },
    setAdminRuntime: (summary, queue = []) => {
      dispatch(
        adminActions.setAdminRuntime({
          summary: summary || null,
          queue: Array.isArray(queue) ? queue : []
        })
      );
    },
    setPvpRuntime: (session) => {
      dispatch(pvpActions.setPvpRuntime(session || null));
    }
  };
}

