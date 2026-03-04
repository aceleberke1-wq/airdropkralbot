import { create } from "zustand";
import type {
  BootstrapV2Data,
  ExperimentAssignment,
  TabKey,
  WebAppAuth,
  WorkspaceKey
} from "./types";
import { normalizeLang, type Lang } from "./i18n";

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

export const useReactShellStore = create<ReactShellState>((set) => ({
  auth: { uid: "", ts: "", sig: "" },
  data: null,
  experiment: {
    key: "webapp_react_v1",
    variant: "control",
    assigned_at: "",
    cohort_bucket: 0
  },
  tab: "home",
  workspace: "player",
  lang: "tr",
  advanced: false,
  onboardingVisible: true,
  loading: true,
  error: "",
  adminRuntime: {
    summary: null,
    queue: [],
    updatedAt: ""
  },
  pvpRuntime: {
    session: null,
    updatedAt: ""
  },
  setBootstrap: (data) =>
    set((state) => {
      const shell = data?.ui_shell || null;
      const defaultTab = (shell?.default_tab || "home") as TabKey;
      const nextLang = normalizeLang(data?.ux?.language || state.lang);
      return {
        data,
        experiment: {
          key: String(data?.experiment?.key || state.experiment.key || "webapp_react_v1"),
          variant: data?.experiment?.variant === "treatment" ? "treatment" : "control",
          assigned_at: String(data?.experiment?.assigned_at || state.experiment.assigned_at || ""),
          cohort_bucket: Math.max(0, Math.min(99, Number(data?.experiment?.cohort_bucket || 0)))
        },
        tab: defaultTab,
        lang: nextLang,
        advanced: Boolean(data?.ux?.advanced_enabled),
        onboardingVisible: state.onboardingVisible,
        loading: false,
        error: ""
      };
    }),
  setAuth: (auth) => set({ auth }),
  setTab: (tab) => set({ tab }),
  setWorkspace: (workspace) => set({ workspace }),
  setLang: (lang) => set({ lang: normalizeLang(lang) }),
  toggleAdvanced: () => set((state) => ({ advanced: !state.advanced })),
  hideOnboarding: () => set({ onboardingVisible: false }),
  setLoading: (next) => set({ loading: Boolean(next) }),
  setError: (message) => set({ error: String(message || "") }),
  setAdminRuntime: (summary, queue = []) =>
    set({
      adminRuntime: {
        summary: summary || null,
        queue: Array.isArray(queue) ? queue : [],
        updatedAt: new Date().toISOString()
      }
    }),
  setPvpRuntime: (session) =>
    set({
      pvpRuntime: {
        session: session || null,
        updatedAt: new Date().toISOString()
      }
    })
}));
