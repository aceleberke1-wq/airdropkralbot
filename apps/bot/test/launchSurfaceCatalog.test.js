const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildLaunchSurfaceEntries,
  resolveLaunchSurface
} = require("../src/ui/launchSurfaceCatalog");

test("launch surface catalog resolves core player and admin surfaces", () => {
  assert.deepEqual(resolveLaunchSurface("profile_hub"), {
    key: "profile_hub",
    commandKey: "profile",
    labelKey: "open_profile_hub",
    overrides: {}
  });

  assert.deepEqual(resolveLaunchSurface("admin_runtime"), {
    key: "admin_runtime",
    commandKey: "admin_metrics",
    labelKey: "admin_runtime_panel",
    overrides: {}
  });
});

test("buildLaunchSurfaceEntries converts surface keys into command bundle entries", () => {
  assert.deepEqual(buildLaunchSurfaceEntries(["discover_panel", "payout_screen", "missing_surface"]), [
    { key: "discover_panel", commandKey: "discover", overrides: {} },
    { key: "payout_screen", commandKey: "payout", overrides: {} }
  ]);
});
