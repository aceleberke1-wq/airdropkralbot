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
    shellActionKey: "player.panel.profile",
    overrides: { shellActionKey: "player.panel.profile", launchEventKey: "launch.surface.profile_hub.open" }
  });

  assert.deepEqual(resolveLaunchSurface("admin_runtime"), {
    key: "admin_runtime",
    commandKey: "admin_metrics",
    labelKey: "admin_runtime_panel",
    shellActionKey: "admin.route.runtime_meta",
    overrides: { shellActionKey: "admin.route.runtime_meta", launchEventKey: "launch.surface.admin_runtime.open" }
  });

  assert.deepEqual(resolveLaunchSurface("admin_live_ops"), {
    key: "admin_live_ops",
    commandKey: "admin_live_ops",
    labelKey: "admin_live_ops_panel",
    shellActionKey: "admin.route.live_ops_panel",
    overrides: { shellActionKey: "admin.route.live_ops_panel", launchEventKey: "launch.surface.admin_live_ops.open" }
  });
});

test("buildLaunchSurfaceEntries converts surface keys into command bundle entries", () => {
  assert.deepEqual(buildLaunchSurfaceEntries(["discover_panel", "payout_screen", "missing_surface"]), [
    {
      key: "discover_panel",
      commandKey: "discover",
      overrides: { shellActionKey: "player.panel.discover", launchEventKey: "launch.surface.discover_panel.open" }
    },
    {
      key: "payout_screen",
      commandKey: "payout",
      overrides: { shellActionKey: "player.route.payout_request", launchEventKey: "launch.surface.payout_screen.open" }
    }
  ]);
});
