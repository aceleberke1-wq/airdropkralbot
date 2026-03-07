import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function loadModule() {
  const target = pathToFileURL(
    path.join(process.cwd(), "apps", "webapp", "src", "core", "admin", "adminRouteHandoff.js")
  ).href;
  return import(target);
}

test("resolveAdminRouteHandoff maps queue and runtime panel targets into admin workspace", async () => {
  const mod = await loadModule();

  assert.deepEqual(
    mod.resolveAdminRouteHandoff({
      panelKey: "panel_admin_queue",
      focusKey: "queue_action"
    }),
    {
      route_key: "admin",
      panel_key: "panel_admin_queue",
      focus_key: "queue_action",
      launch_event_key: "launch.internal.admin_route_panel_admin_queue.open",
      workspace: "admin",
      tab: "home"
    }
  );

  assert.deepEqual(
    mod.resolveAdminRouteHandoff({
      panelKey: "panel_admin_runtime",
      focusKey: "runtime_flags"
    }),
    {
      route_key: "admin",
      panel_key: "panel_admin_runtime",
      focus_key: "runtime_flags",
      launch_event_key: "launch.internal.admin_route_panel_admin_runtime.open",
      workspace: "admin",
      tab: "home"
    }
  );
});
