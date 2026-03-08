function clampNumber(value, fallback, min, max) {
  const next = Number(value);
  if (!Number.isFinite(next)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, next));
}

function readConnection(rawNavigator) {
  const connection = rawNavigator && typeof rawNavigator === "object" ? rawNavigator.connection || rawNavigator.mozConnection || rawNavigator.webkitConnection : null;
  return connection && typeof connection === "object" ? connection : null;
}

export function resolvePerfTier(input = {}) {
  const cores = clampNumber(input.cores, 4, 1, 32);
  const memoryGb = clampNumber(input.memoryGb, 4, 1, 32);
  const viewportWidth = clampNumber(input.viewportWidth, 1280, 320, 4096);
  if (cores <= 4 || memoryGb <= 4 || viewportWidth <= 900) {
    return "low";
  }
  if (cores >= 10 && memoryGb >= 8 && viewportWidth >= 1440) {
    return "high";
  }
  return "normal";
}

export function resolveDeviceClass(input = {}) {
  const viewportWidth = clampNumber(input.viewportWidth, 1280, 320, 4096);
  const touch = Boolean(input.touch);
  if (viewportWidth <= 640) {
    return "mobile";
  }
  if (viewportWidth <= 1024 && touch) {
    return "tablet";
  }
  if (viewportWidth <= 900) {
    return "mobile";
  }
  if (viewportWidth <= 1280 && touch) {
    return "tablet";
  }
  return "desktop";
}

export function resolveCapabilityProfile(input = {}) {
  const viewportWidth = clampNumber(input.viewportWidth, 1280, 320, 4096);
  const viewportHeight = clampNumber(input.viewportHeight, 720, 320, 4096);
  const dpr = clampNumber(input.dpr, 1, 1, 3);
  const cores = clampNumber(input.cores, 4, 1, 32);
  const memoryGb = clampNumber(input.memoryGb, 4, 1, 32);
  const touch = Boolean(input.touch);
  const saveData = Boolean(input.saveData);
  const prefersReducedMotion = Boolean(input.prefersReducedMotion);
  const largeText = Boolean(input.largeText);
  const explicitReducedMotion = Boolean(input.reducedMotion);
  const connectionType = String(input.connectionType || "unknown").trim().toLowerCase() || "unknown";
  const perfTier = resolvePerfTier({ cores, memoryGb, viewportWidth });
  const deviceClass = resolveDeviceClass({ viewportWidth, touch });

  let recommendedQuality = perfTier === "high" ? "high" : perfTier === "normal" ? "medium" : "low";
  if (saveData || connectionType === "slow-2g" || connectionType === "2g") {
    recommendedQuality = "low";
  } else if (connectionType === "3g" && recommendedQuality === "high") {
    recommendedQuality = "medium";
  }
  if (deviceClass === "mobile" && recommendedQuality === "high") {
    recommendedQuality = "medium";
  }

  const requestedQuality = ["high", "medium", "low"].includes(String(input.qualityMode || "").trim().toLowerCase())
    ? String(input.qualityMode || "").trim().toLowerCase()
    : "auto";
  const effectiveQuality = requestedQuality === "auto" ? recommendedQuality : requestedQuality;
  const recommendedHudDensity = deviceClass === "mobile" || viewportWidth <= 430 || largeText || perfTier === "low" ? "compact" : "normal";
  const effectiveHudDensity = largeText ? "compact" : recommendedHudDensity;
  const effectiveReducedMotion = explicitReducedMotion || prefersReducedMotion || (perfTier === "low" && touch);
  const lowEndMode = effectiveQuality === "low" || perfTier === "low" || saveData;
  const sceneProfile = effectiveQuality === "high" ? "cinematic" : effectiveQuality === "medium" ? "balanced" : "lite";
  const profileKey = `${deviceClass}_${perfTier}_${effectiveQuality}_${effectiveHudDensity}${effectiveReducedMotion ? "_rm" : ""}`;

  return {
    profile_key: profileKey,
    perf_tier: perfTier,
    device_class: deviceClass,
    scene_profile: sceneProfile,
    requested_quality: requestedQuality,
    recommended_quality: recommendedQuality,
    effective_quality: effectiveQuality,
    recommended_hud_density: recommendedHudDensity,
    effective_hud_density: effectiveHudDensity,
    effective_reduced_motion: effectiveReducedMotion,
    large_text: largeText,
    touch,
    save_data: saveData,
    connection_type: connectionType,
    dpr,
    cores,
    memory_gb: memoryGb,
    viewport_width: viewportWidth,
    viewport_height: viewportHeight,
    low_end_mode: lowEndMode
  };
}

export function collectCapabilityInput(override = {}) {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      viewportWidth: 1280,
      viewportHeight: 720,
      dpr: 1,
      cores: 4,
      memoryGb: 4,
      touch: false,
      saveData: false,
      prefersReducedMotion: false,
      connectionType: "unknown",
      ...override
    };
  }

  const connection = readConnection(navigator);
  const mediaQuery =
    typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

  return {
    viewportWidth: window.innerWidth || window.screen?.width || 1280,
    viewportHeight: window.innerHeight || window.screen?.height || 720,
    dpr: window.devicePixelRatio || 1,
    cores: Number(navigator.hardwareConcurrency || 4),
    memoryGb: Number(navigator.deviceMemory || 4),
    touch:
      "ontouchstart" in window ||
      Number(navigator.maxTouchPoints || 0) > 0 ||
      Number(navigator.msMaxTouchPoints || 0) > 0,
    saveData: Boolean(connection?.saveData),
    prefersReducedMotion: Boolean(mediaQuery?.matches),
    connectionType: String(connection?.effectiveType || "unknown"),
    ...override
  };
}

export function collectCapabilityProfile(options = {}) {
  return resolveCapabilityProfile(collectCapabilityInput(options));
}
