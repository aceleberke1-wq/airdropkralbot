"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildAdminSurfaceActions } = require("../../../packages/shared/src/adminSurfaceActionCatalog");

test("buildAdminSurfaceActions returns canonical admin header targets", () => {
  const actions = buildAdminSurfaceActions();

  assert.equal(actions.admin_header[0].slot_key, "queue");
  assert.equal(actions.admin_header[0].action_key, "admin.route.queue_panel");
  assert.equal(actions.admin_header[0].panel_key, "panel_admin_queue");
  assert.equal(actions.admin_header[1].slot_key, "policy");
  assert.equal(actions.admin_header[2].focus_key, "runtime_flags");
  assert.equal(actions.admin_header[4].action_key, "admin.route.runtime_meta");
  assert.equal(actions.admin_queue[0].slot_key, "policy");
  assert.equal(actions.admin_policy[0].slot_key, "queue");
  assert.equal(actions.admin_runtime_bot[1].slot_key, "flags");
  assert.equal(actions.admin_runtime_meta[2].slot_key, "bot");
});
