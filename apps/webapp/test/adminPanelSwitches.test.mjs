import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function loadSwitchModule() {
  const target = pathToFileURL(
    path.join(process.cwd(), "apps", "webapp", "src", "core", "admin", "adminPanelSwitches.js")
  ).href;
  return import(target);
}

test("extractBooleanFlags reads nested flags map", async () => {
  const mod = await loadSwitchModule();
  const flags = mod.extractBooleanFlags({
    flags: {
      A: true,
      B: false,
      C: "nope"
    }
  });
  assert.deepEqual(flags, { A: true, B: false });
});

test("resolveAdminPanelVisibility defaults to all enabled", async () => {
  const mod = await loadSwitchModule();
  const vis = mod.resolveAdminPanelVisibility({});
  assert.deepEqual(vis, {
    queue: true,
    dynamicPolicy: true,
    runtimeFlags: true,
    runtimeBot: true,
    runtimeMeta: true
  });
});

test("resolveAdminPanelVisibility honors runtime kill switches", async () => {
  const mod = await loadSwitchModule();
  const vis = mod.resolveAdminPanelVisibility({
    runtimeFlags: {
      flags: {
        [mod.PANEL_FLAG_KEYS.queue]: false,
        [mod.PANEL_FLAG_KEYS.dynamicPolicy]: false,
        [mod.PANEL_FLAG_KEYS.runtimeFlags]: true,
        [mod.PANEL_FLAG_KEYS.runtimeBot]: false,
        [mod.PANEL_FLAG_KEYS.runtimeMeta]: true
      }
    }
  });
  assert.deepEqual(vis, {
    queue: false,
    dynamicPolicy: false,
    runtimeFlags: true,
    runtimeBot: false,
    runtimeMeta: true
  });
});

test("resolveAdminPanelVisibility applies fallback flags when runtime missing", async () => {
  const mod = await loadSwitchModule();
  const vis = mod.resolveAdminPanelVisibility({
    fallbackFlags: {
      [mod.PANEL_FLAG_KEYS.queue]: false,
      [mod.PANEL_FLAG_KEYS.runtimeMeta]: false
    }
  });
  assert.deepEqual(vis, {
    queue: false,
    dynamicPolicy: true,
    runtimeFlags: true,
    runtimeBot: true,
    runtimeMeta: false
  });
});
