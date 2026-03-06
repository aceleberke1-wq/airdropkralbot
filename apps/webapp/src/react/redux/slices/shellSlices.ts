import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { normalizeLang, type Lang } from "../../i18n";
import type { BootstrapV2Data, ExperimentAssignment, TabKey, WebAppAuth, WorkspaceKey } from "../../types";

const TAB_KEYS: TabKey[] = ["home", "pvp", "tasks", "vault"];

function isTabKey(value: unknown): value is TabKey {
  return TAB_KEYS.includes(value as TabKey);
}

function sanitizeTab(value: unknown, fallback: TabKey): TabKey {
  const key = String(value || "")
    .trim()
    .toLowerCase();
  return isTabKey(key) ? key : fallback;
}

function sanitizeWorkspace(value: unknown, fallback: WorkspaceKey): WorkspaceKey {
  const key = String(value || "")
    .trim()
    .toLowerCase();
  return key === "admin" || key === "player" ? key : fallback;
}

export type AdminRuntimeData = {
  summary: Record<string, unknown> | null;
  queue: Array<Record<string, unknown>>;
  updatedAt: string;
};

export type PvpRuntimeData = {
  session: Record<string, unknown> | null;
  updatedAt: string;
};

type SessionState = {
  auth: WebAppAuth;
};

type UiState = {
  tab: TabKey;
  workspace: WorkspaceKey;
  lang: Lang;
  advanced: boolean;
  onboardingVisible: boolean;
  loading: boolean;
  error: string;
};

type BootstrapDerivedUi = {
  tab: TabKey;
  workspace: WorkspaceKey;
  lang: Lang;
  advanced: boolean;
  onboardingVisible: boolean;
};

type PlayerState = {
  data: BootstrapV2Data | null;
  experiment: ExperimentAssignment;
};

type VaultState = {
  data: Record<string, unknown> | null;
  updatedAt: string;
};

type WalletState = {
  data: Record<string, unknown> | null;
  updatedAt: string;
};

type MonetizationState = {
  data: Record<string, unknown> | null;
  updatedAt: string;
};

type AdminState = {
  runtime: AdminRuntimeData;
  panels: Record<string, unknown> | null;
};

type TelemetryState = {
  sessionRef: string;
  lastIngestId: string;
  rejectedCount: number;
};

type SceneState = {
  qualityMode: "auto" | "high" | "medium" | "low";
  hudDensity: "compact" | "normal";
  reducedMotion: boolean;
  largeText: boolean;
};

export function deriveUiFromBootstrap(
  data: BootstrapV2Data,
  current: Pick<UiState, "tab" | "workspace" | "lang" | "onboardingVisible">
): BootstrapDerivedUi {
  const shell = data?.ui_shell || null;
  const shellTabs = Array.isArray(shell?.tabs) && shell?.tabs.length ? shell.tabs.filter((entry) => isTabKey(entry)) : TAB_KEYS;
  const prefsJson = data?.ui_prefs?.prefs_json && typeof data.ui_prefs.prefs_json === "object" ? data.ui_prefs.prefs_json : {};
  const preferredTab = sanitizeTab(prefsJson.last_tab || shell?.default_tab || current.tab || "home", "home");
  const nextTab = shellTabs.includes(preferredTab) ? preferredTab : sanitizeTab(shell?.default_tab || "home", "home");
  const nextLang = normalizeLang(prefsJson.language || data?.ux?.language || current.lang);
  const advancedPref =
    typeof prefsJson.advanced_view === "boolean" ? Boolean(prefsJson.advanced_view) : Boolean(data?.ux?.advanced_enabled);
  const onboardingCompleted = Boolean(prefsJson.onboarding_completed);
  const nextWorkspace = sanitizeWorkspace(prefsJson.workspace || current.workspace || "player", "player");

  return {
    tab: nextTab,
    workspace: nextWorkspace,
    lang: nextLang,
    advanced: advancedPref,
    onboardingVisible: onboardingCompleted ? false : current.onboardingVisible
  };
}

const sessionSlice = createSlice({
  name: "session",
  initialState: {
    auth: { uid: "", ts: "", sig: "" }
  } as SessionState,
  reducers: {
    setAuth(state, action: PayloadAction<WebAppAuth>) {
      state.auth = action.payload;
    },
    mergeAuth(state, action: PayloadAction<Partial<WebAppAuth>>) {
      state.auth = {
        ...state.auth,
        ...(action.payload || {})
      };
    }
  }
});

const uiSlice = createSlice({
  name: "ui",
  initialState: {
    tab: "home",
    workspace: "player",
    lang: "tr",
    advanced: false,
    onboardingVisible: true,
    loading: true,
    error: ""
  } as UiState,
  reducers: {
    applyBootstrapUi(state, action: PayloadAction<BootstrapDerivedUi>) {
      state.tab = action.payload.tab;
      state.workspace = action.payload.workspace;
      state.lang = action.payload.lang;
      state.advanced = action.payload.advanced;
      state.onboardingVisible = action.payload.onboardingVisible;
      state.loading = false;
      state.error = "";
    },
    setTab(state, action: PayloadAction<TabKey>) {
      state.tab = sanitizeTab(action.payload, state.tab);
    },
    setWorkspace(state, action: PayloadAction<WorkspaceKey>) {
      state.workspace = sanitizeWorkspace(action.payload, state.workspace);
    },
    setLang(state, action: PayloadAction<Lang>) {
      state.lang = normalizeLang(action.payload);
    },
    toggleAdvanced(state) {
      state.advanced = !state.advanced;
    },
    hideOnboarding(state) {
      state.onboardingVisible = false;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = Boolean(action.payload);
    },
    setError(state, action: PayloadAction<string>) {
      state.error = String(action.payload || "");
    }
  }
});

const playerSlice = createSlice({
  name: "player",
  initialState: {
    data: null,
    experiment: {
      key: "webapp_react_v1",
      variant: "control",
      assigned_at: "",
      cohort_bucket: 0
    }
  } as PlayerState,
  reducers: {
    setBootstrap(state, action: PayloadAction<BootstrapV2Data>) {
      state.data = action.payload;
      state.experiment = {
        key: String(action.payload?.experiment?.key || state.experiment.key || "webapp_react_v1"),
        variant: action.payload?.experiment?.variant === "treatment" ? "treatment" : "control",
        assigned_at: String(action.payload?.experiment?.assigned_at || state.experiment.assigned_at || ""),
        cohort_bucket: Math.max(0, Math.min(99, Number(action.payload?.experiment?.cohort_bucket || 0)))
      };
    },
    patchData(state, action: PayloadAction<Partial<BootstrapV2Data>>) {
      state.data = state.data
        ? {
            ...state.data,
            ...(action.payload || {})
          }
        : ({ ...(action.payload || {}) } as BootstrapV2Data);
      if (action.payload?.experiment) {
        state.experiment = {
          key: String(action.payload.experiment.key || state.experiment.key || "webapp_react_v1"),
          variant: action.payload.experiment.variant === "treatment" ? "treatment" : "control",
          assigned_at: String(action.payload.experiment.assigned_at || state.experiment.assigned_at || ""),
          cohort_bucket: Math.max(0, Math.min(99, Number(action.payload.experiment.cohort_bucket || 0)))
        };
      }
    }
  }
});

const pvpSlice = createSlice({
  name: "pvp",
  initialState: {
    session: null,
    updatedAt: ""
  } as PvpRuntimeData,
  reducers: {
    setPvpRuntime(state, action: PayloadAction<Record<string, unknown> | null>) {
      state.session = action.payload || null;
      state.updatedAt = new Date().toISOString();
    }
  }
});

const vaultSlice = createSlice({
  name: "vault",
  initialState: {
    data: null,
    updatedAt: ""
  } as VaultState,
  reducers: {
    setVaultData(state, action: PayloadAction<Record<string, unknown> | null>) {
      state.data = action.payload || null;
      state.updatedAt = new Date().toISOString();
    }
  }
});

const walletSlice = createSlice({
  name: "wallet",
  initialState: {
    data: null,
    updatedAt: ""
  } as WalletState,
  reducers: {
    setWalletData(state, action: PayloadAction<Record<string, unknown> | null>) {
      state.data = action.payload || null;
      state.updatedAt = new Date().toISOString();
    }
  }
});

const monetizationSlice = createSlice({
  name: "monetization",
  initialState: {
    data: null,
    updatedAt: ""
  } as MonetizationState,
  reducers: {
    setMonetizationData(state, action: PayloadAction<Record<string, unknown> | null>) {
      state.data = action.payload || null;
      state.updatedAt = new Date().toISOString();
    }
  }
});

const adminSlice = createSlice({
  name: "admin",
  initialState: {
    runtime: {
      summary: null,
      queue: [],
      updatedAt: ""
    },
    panels: null
  } as AdminState,
  reducers: {
    setAdminRuntime(
      state,
      action: PayloadAction<{ summary: Record<string, unknown> | null; queue?: Array<Record<string, unknown>> }>
    ) {
      state.runtime = {
        summary: action.payload.summary || null,
        queue: Array.isArray(action.payload.queue) ? action.payload.queue : [],
        updatedAt: new Date().toISOString()
      };
    },
    setAdminPanels(state, action: PayloadAction<Record<string, unknown> | null>) {
      state.panels = action.payload || null;
    }
  }
});

const telemetrySlice = createSlice({
  name: "telemetry",
  initialState: {
    sessionRef: "",
    lastIngestId: "",
    rejectedCount: 0
  } as TelemetryState,
  reducers: {
    setTelemetrySessionRef(state, action: PayloadAction<string>) {
      state.sessionRef = String(action.payload || "");
    },
    setTelemetryIngest(state, action: PayloadAction<{ ingestId: string; rejectedCount: number }>) {
      state.lastIngestId = String(action.payload.ingestId || "");
      state.rejectedCount = Math.max(0, Number(action.payload.rejectedCount || 0));
    }
  }
});

const sceneSlice = createSlice({
  name: "scene",
  initialState: {
    qualityMode: "auto",
    hudDensity: "normal",
    reducedMotion: false,
    largeText: false
  } as SceneState,
  reducers: {
    setScenePreferences(state, action: PayloadAction<Partial<SceneState>>) {
      const patch = action.payload || {};
      if (patch.qualityMode) {
        state.qualityMode = patch.qualityMode;
      }
      if (patch.hudDensity) {
        state.hudDensity = patch.hudDensity;
      }
      if (typeof patch.reducedMotion === "boolean") {
        state.reducedMotion = patch.reducedMotion;
      }
      if (typeof patch.largeText === "boolean") {
        state.largeText = patch.largeText;
      }
    }
  }
});

export const sessionActions = sessionSlice.actions;
export const uiActions = uiSlice.actions;
export const playerActions = playerSlice.actions;
export const pvpActions = pvpSlice.actions;
export const vaultActions = vaultSlice.actions;
export const walletActions = walletSlice.actions;
export const monetizationActions = monetizationSlice.actions;
export const adminActions = adminSlice.actions;
export const telemetryActions = telemetrySlice.actions;
export const sceneActions = sceneSlice.actions;

export const sessionReducer = sessionSlice.reducer;
export const uiReducer = uiSlice.reducer;
export const playerReducer = playerSlice.reducer;
export const pvpReducer = pvpSlice.reducer;
export const vaultReducer = vaultSlice.reducer;
export const walletReducer = walletSlice.reducer;
export const monetizationReducer = monetizationSlice.reducer;
export const adminReducer = adminSlice.reducer;
export const telemetryReducer = telemetrySlice.reducer;
export const sceneReducer = sceneSlice.reducer;

export const selectAuth = (state: any): WebAppAuth => state.session.auth;
export const selectUi = (state: any): UiState => state.ui;
export const selectPlayerData = (state: any): BootstrapV2Data | null => state.player.data;
export const selectExperiment = (state: any): ExperimentAssignment => state.player.experiment;
export const selectPvpRuntime = (state: any): PvpRuntimeData => state.pvp;
export const selectAdminRuntime = (state: any): AdminRuntimeData => state.admin.runtime;
export const selectAdminPanels = (state: any): Record<string, unknown> | null => state.admin.panels;
export const selectVaultData = (state: any): Record<string, unknown> | null => state.vault.data;

