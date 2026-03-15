import test from "node:test";
import assert from "node:assert/strict";

import { resolveShellSurfaceVisibility } from "../src/react/features/shell/shellSurfaceVisibility.js";

test("player shell hides operator telemetry surfaces even when advanced was previously enabled", () => {
  const result = resolveShellSurfaceVisibility({
    workspace: "player",
    advanced: true,
    hudDensity: "normal",
    deviceClass: "desktop",
    sceneRuntimePhase: "ready",
    sceneRuntimeError: "",
    hasLaunchSummary: true
  });

  assert.equal(result.sceneChromeMode, "backdrop");
  assert.equal(result.showMetaStrip, false);
  assert.equal(result.showLaunchHandoffStrip, false);
  assert.equal(result.showSceneBridgeDock, false);
  assert.equal(result.showSceneRuntimeStrip, false);
});

test("compact player shell drops runtime strip once runtime is stable", () => {
  const result = resolveShellSurfaceVisibility({
    workspace: "player",
    advanced: false,
    hudDensity: "compact",
    deviceClass: "mobile",
    sceneRuntimePhase: "ready",
    sceneRuntimeError: "",
    hasLaunchSummary: false
  });

  assert.equal(result.showSceneRuntimeStrip, false);
  assert.equal(result.sceneChromeMode, "backdrop");
});

test("idle runtime does not surface scene runtime strip", () => {
  const result = resolveShellSurfaceVisibility({
    workspace: "admin",
    advanced: false,
    hudDensity: "normal",
    deviceClass: "desktop",
    sceneRuntimePhase: "idle",
    sceneRuntimeError: "",
    hasLaunchSummary: false
  });

  assert.equal(result.showSceneRuntimeStrip, false);
});

test("admin shell defaults to backdrop mode when advanced tools are off", () => {
  const result = resolveShellSurfaceVisibility({
    workspace: "admin",
    advanced: false,
    hudDensity: "normal",
    deviceClass: "desktop",
    sceneRuntimePhase: "ready",
    sceneRuntimeError: "",
    hasLaunchSummary: true
  });

  assert.equal(result.compactPlayerShell, false);
  assert.equal(result.sceneChromeMode, "backdrop");
  assert.equal(result.showMetaStrip, false);
  assert.equal(result.showLaunchHandoffStrip, false);
  assert.equal(result.showSceneBridgeDock, false);
  assert.equal(result.showSceneRuntimeStrip, false);
});

test("admin shell only shows operator telemetry surfaces in explicit advanced mode", () => {
  const result = resolveShellSurfaceVisibility({
    workspace: "admin",
    advanced: true,
    hudDensity: "normal",
    deviceClass: "desktop",
    sceneRuntimePhase: "ready",
    sceneRuntimeError: "",
    hasLaunchSummary: true
  });

  assert.equal(result.sceneChromeMode, "full");
  assert.equal(result.showMetaStrip, true);
  assert.equal(result.showLaunchHandoffStrip, true);
  assert.equal(result.showSceneBridgeDock, true);
  assert.equal(result.showSceneRuntimeStrip, false);
});
