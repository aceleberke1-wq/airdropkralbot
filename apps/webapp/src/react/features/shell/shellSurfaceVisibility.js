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
  const adminAdvanced = workspace === "admin" && advanced;
  const showOperatorSurfaces = adminAdvanced;
  const showSceneRuntimeStrip =
    sceneRuntimePhase === "preparing" || sceneRuntimePhase === "error" || Boolean(sceneRuntimeError);
  const sceneChromeMode = adminAdvanced ? "full" : "backdrop";

  return {
    adminAdvanced,
    compactPlayerShell,
    sceneChromeMode,
    showMetaStrip: showOperatorSurfaces,
    showLaunchHandoffStrip: hasLaunchSummary && showOperatorSurfaces,
    showSceneBridgeDock: showOperatorSurfaces,
    showSceneRuntimeStrip
  };
}
