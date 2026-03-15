import test from "node:test";
import assert from "node:assert/strict";

import { resolveShellSurfaceVisibility } from "../src/react/features/shell/shellSurfaceVisibility.js";

test("compact player shell hides operator telemetry surfaces after runtime is ready", () => {
  const result = resolveShellSurfaceVisibility({
    workspace: "player",
    advanced: true,
    hudDensity: "compact",
    deviceClass: "mobile",
    sceneRuntimePhase: "ready",
    sceneRuntimeError: "",
    hasLaunchSummary: true
  });

  assert.equal(result.compactPlayerShell, true);
  assert.equal(result.sceneChromeMode, "backdrop");
  assert.equal(result.showMetaStrip, false);
  assert.equal(result.showLaunchHandoffStrip, false);
  assert.equal(result.showSceneBridgeDock, false);
  assert.equal(result.showSceneRuntimeStrip, true);
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

test("admin shell keeps operator surfaces visible on compact devices", () => {
  const result = resolveShellSurfaceVisibility({
    workspace: "admin",
    advanced: false,
    hudDensity: "compact",
    deviceClass: "mobile",
    sceneRuntimePhase: "ready",
    sceneRuntimeError: "",
    hasLaunchSummary: true
  });

  assert.equal(result.compactPlayerShell, false);
  assert.equal(result.sceneChromeMode, "full");
  assert.equal(result.showMetaStrip, true);
  assert.equal(result.showLaunchHandoffStrip, true);
  assert.equal(result.showSceneBridgeDock, true);
  assert.equal(result.showSceneRuntimeStrip, true);
});
