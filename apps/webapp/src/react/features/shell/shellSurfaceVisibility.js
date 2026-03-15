export function isCompactPlayerShell(options = {}) {
  const workspace = String(options.workspace || "").trim().toLowerCase();
  const hudDensity = String(options.hudDensity || "").trim().toLowerCase();
  const deviceClass = String(options.deviceClass || "").trim().toLowerCase();
  return workspace !== "admin" && (hudDensity === "compact" || deviceClass === "mobile");
}

export function resolveShellSurfaceVisibility(options = {}) {
  const workspace = String(options.workspace || "").trim().toLowerCase() === "admin" ? "admin" : "player";
  const advanced = Boolean(options.advanced);
  const sceneRuntimePhase = String(options.sceneRuntimePhase || "").trim().toLowerCase();
  const sceneRuntimeError = String(options.sceneRuntimeError || "").trim();
  const hasLaunchSummary = Boolean(options.hasLaunchSummary);
  const compactPlayerShell = isCompactPlayerShell({
    workspace,
    hudDensity: options.hudDensity,
    deviceClass: options.deviceClass
  });
  const showOperatorSurfaces = workspace === "admin" || (advanced && !compactPlayerShell);
  const showSceneRuntimeStrip =
    workspace === "admin" || advanced || (sceneRuntimePhase && sceneRuntimePhase !== "ready") || Boolean(sceneRuntimeError);
  const sceneChromeMode = workspace === "admin" ? "full" : compactPlayerShell ? "backdrop" : "full";

  return {
    compactPlayerShell,
    sceneChromeMode,
    showMetaStrip: showOperatorSurfaces,
    showLaunchHandoffStrip: hasLaunchSummary && showOperatorSurfaces,
    showSceneBridgeDock: showOperatorSurfaces,
    showSceneRuntimeStrip
  };
}
