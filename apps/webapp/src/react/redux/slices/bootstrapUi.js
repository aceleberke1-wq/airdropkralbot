function sanitizeTab(value, fallback) {
  const key = String(value || "")
    .trim()
    .toLowerCase();
  return ["home", "pvp", "tasks", "vault"].includes(key) ? key : fallback;
}

export function deriveBootstrapUiState(data, current) {
  const shell = data?.ui_shell || null;
  const shellTabs =
    Array.isArray(shell?.tabs) && shell?.tabs.length
      ? shell.tabs.filter((entry) => ["home", "pvp", "tasks", "vault"].includes(entry))
      : ["home", "pvp", "tasks", "vault"];
  const launchContext = data?.launch_context && typeof data.launch_context === "object" ? data.launch_context : null;
  const prefsJson = data?.ui_prefs?.prefs_json && typeof data.ui_prefs.prefs_json === "object" ? data.ui_prefs.prefs_json : {};
  const preferredTab = sanitizeTab(prefsJson.last_tab || shell?.default_tab || current.tab || "home", "home");
  const nextTab = shellTabs.includes(preferredTab) ? preferredTab : sanitizeTab(shell?.default_tab || "home", "home");
  const nextLang = ["tr", "en"].includes(String(prefsJson.language || data?.ux?.language || current.lang).trim().toLowerCase())
    ? String(prefsJson.language || data?.ux?.language || current.lang).trim().toLowerCase()
    : "tr";
  const advancedPref =
    typeof prefsJson.advanced_view === "boolean" ? Boolean(prefsJson.advanced_view) : Boolean(data?.ux?.advanced_enabled);
  const onboardingCompleted = Boolean(prefsJson.onboarding_completed);
  const launchedWorkspace =
    launchContext?.workspace === "admin" || launchContext?.workspace === "player" ? launchContext.workspace : null;
  const nextWorkspace = launchedWorkspace || "player";
  const nextAdvanced = nextWorkspace === "admin" ? Boolean(current.advanced || advancedPref) : Boolean(current.advanced);

  return {
    tab: nextTab,
    workspace: nextWorkspace,
    lang: nextLang,
    advanced: nextAdvanced,
    onboardingVisible: onboardingCompleted ? false : current.onboardingVisible
  };
}
