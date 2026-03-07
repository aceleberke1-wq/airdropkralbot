const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveAdminCommandNavigation } = require("../../../packages/shared/src/adminCommandNavigation");

test("shared admin command navigation resolves admin workspace surfaces", () => {
  assert.deepEqual(resolveAdminCommandNavigation("admin"), {
    route_key: "admin",
    panel_key: "",
    focus_key: "",
    workspace: "admin",
    tab: "home"
  });

  assert.deepEqual(resolveAdminCommandNavigation("admin_queue"), {
    route_key: "admin",
    panel_key: "panel_admin_queue",
    focus_key: "queue_action",
    workspace: "admin",
    tab: "home"
  });

  assert.deepEqual(resolveAdminCommandNavigation("admin_gate"), {
    route_key: "admin",
    panel_key: "panel_admin_policy",
    focus_key: "dynamic_policy",
    workspace: "admin",
    tab: "home"
  });

  assert.deepEqual(resolveAdminCommandNavigation("admin_metrics"), {
    route_key: "admin",
    panel_key: "panel_admin_runtime",
    focus_key: "runtime_meta",
    workspace: "admin",
    tab: "home"
  });

  assert.deepEqual(resolveAdminCommandNavigation("admin_live_ops"), {
    route_key: "admin",
    panel_key: "panel_admin_live_ops",
    focus_key: "campaign_editor",
    workspace: "admin",
    tab: "home"
  });
});

test("shared admin command navigation rejects player and empty commands", () => {
  assert.equal(resolveAdminCommandNavigation("wallet"), null);
  assert.equal(resolveAdminCommandNavigation(""), null);
});
