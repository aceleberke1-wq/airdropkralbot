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
    overrides: { launchEventKey: "launch.surface.profile_hub.open" }
  });

  assert.deepEqual(resolveLaunchSurface("admin_runtime"), {
    key: "admin_runtime",
    commandKey: "admin_metrics",
    labelKey: "admin_runtime_panel",
    overrides: { launchEventKey: "launch.surface.admin_runtime.open" }
  });
});

test("buildLaunchSurfaceEntries converts surface keys into command bundle entries", () => {
  assert.deepEqual(buildLaunchSurfaceEntries(["discover_panel", "payout_screen", "missing_surface"]), [
    { key: "discover_panel", commandKey: "discover", overrides: { launchEventKey: "launch.surface.discover_panel.open" } },
    { key: "payout_screen", commandKey: "payout", overrides: { launchEventKey: "launch.surface.payout_screen.open" } }
  ]);
});
