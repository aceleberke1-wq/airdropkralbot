function normalizeWorkspace(value) {
  const key = String(value || "").trim().toLowerCase();
  return key === "admin" ? "admin" : "player";
}

function normalizeTab(value) {
  const key = String(value || "").trim().toLowerCase();
  return ["home", "pvp", "tasks", "vault"].includes(key) ? key : "home";
}

function normalizeQuality(value) {
  const key = String(value || "").trim().toLowerCase();
  return ["high", "medium", "low"].includes(key) ? key : "medium";
}

export function resolveSceneBundlePlan(input = {}) {
  const workspace = normalizeWorkspace(input.workspace);
  const tab = normalizeTab(input.tab);
  const effectiveQuality = normalizeQuality(input.effectiveQuality);
  const lowEndMode = Boolean(input.lowEndMode) || effectiveQuality === "low";
  const profileKey = String(input.profileKey || "").trim() || `${workspace}_${tab}_${effectiveQuality}`;
  const bundles = ["runtime_core"];
  const skippedBundles = [];
  let districtKey = workspace === "admin" ? "ops_citadel" : tab === "pvp" ? "arena_prime" : tab === "vault" ? "exchange_district" : tab === "tasks" ? "mission_quarter" : "central_hub";

  if (workspace === "admin") {
    bundles.push("admin_surface");
  } else {
    bundles.push("player_surface");
    if (tab === "vault") {
      bundles.push("vault_surface");
    }
    if (tab === "pvp") {
      bundles.push("pvp_core");
      if (lowEndMode) {
        skippedBundles.push("pvp_cinematic");
      } else {
        bundles.push("pvp_cinematic");
      }
    }
  }

  return {
    workspace,
    tab,
    district_key: districtKey,
    profile_key: profileKey,
    effective_quality: effectiveQuality,
    low_end_mode: lowEndMode,
    bundles,
    skipped_bundles: skippedBundles
  };
}
