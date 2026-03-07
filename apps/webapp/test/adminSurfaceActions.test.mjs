import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function loadModule() {
  const target = pathToFileURL(
    path.join(process.cwd(), "apps", "webapp", "src", "core", "admin", "adminSurfaceActions.js")
  ).href;
  return import(target);
}

test("buildAdminSurfaceActionsView prefers admin summary surface actions", async () => {
  const mod = await loadModule();
  const view = mod.buildAdminSurfaceActionsView({
    adminSummary: {
      surface_actions: {
        admin_header: [{ slot_key: "queue", action_key: "admin.route.queue_panel" }]
      }
    }
  });

  assert.equal(view.admin_header[0].slot_key, "queue");
  assert.equal(view.admin_header[0].action_key, "admin.route.queue_panel");
});

test("buildAdminSurfaceActionsView falls back to canonical catalog", async () => {
  const mod = await loadModule();
  const view = mod.buildAdminSurfaceActionsView({});

  assert.equal(view.admin_header[0].slot_key, "queue");
  assert.equal(view.admin_header[0].action_key, "admin.route.queue_panel");
  assert.equal(view.admin_header[2].slot_key, "live_ops");
  assert.equal(view.admin_header[2].focus_key, "campaign_editor");
  assert.equal(view.admin_header[5].slot_key, "runtime");
  assert.equal(view.admin_header[5].focus_key, "runtime_meta");
});
