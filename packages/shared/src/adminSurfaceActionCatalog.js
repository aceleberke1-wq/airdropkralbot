"use strict";

const { SHELL_ACTION_KEY, resolveShellActionTarget } = require("./shellActionCatalog");

function toSurfaceAction(slotKey, actionKey) {
  const key = String(actionKey || "").trim().toLowerCase();
  const target = resolveShellActionTarget(key);
  return {
    slot_key: String(slotKey || "").trim().toLowerCase(),
    action_key: key,
    shell_action_key: key,
    ...(target?.route_key ? { route_key: String(target.route_key) } : {}),
    ...(target?.panel_key ? { panel_key: String(target.panel_key) } : {}),
    ...(target?.focus_key ? { focus_key: String(target.focus_key) } : {}),
    ...(target?.tab ? { tab: String(target.tab) } : {})
  };
}

function buildAdminSurfaceActions() {
  return {
    admin_header: [
      toSurfaceAction("queue", SHELL_ACTION_KEY.ADMIN_QUEUE_PANEL),
      toSurfaceAction("policy", SHELL_ACTION_KEY.ADMIN_POLICY_PANEL),
      toSurfaceAction("live_ops", SHELL_ACTION_KEY.ADMIN_LIVE_OPS_PANEL),
      toSurfaceAction("flags", SHELL_ACTION_KEY.ADMIN_RUNTIME_FLAGS),
      toSurfaceAction("bot", SHELL_ACTION_KEY.ADMIN_RUNTIME_BOT),
      toSurfaceAction("runtime", SHELL_ACTION_KEY.ADMIN_RUNTIME_META)
    ],
    admin_queue: [
      toSurfaceAction("policy", SHELL_ACTION_KEY.ADMIN_POLICY_PANEL),
      toSurfaceAction("runtime", SHELL_ACTION_KEY.ADMIN_RUNTIME_META)
    ],
    admin_policy: [
      toSurfaceAction("queue", SHELL_ACTION_KEY.ADMIN_QUEUE_PANEL),
      toSurfaceAction("live_ops", SHELL_ACTION_KEY.ADMIN_LIVE_OPS_PANEL),
      toSurfaceAction("flags", SHELL_ACTION_KEY.ADMIN_RUNTIME_FLAGS),
      toSurfaceAction("runtime", SHELL_ACTION_KEY.ADMIN_RUNTIME_META)
    ],
    admin_live_ops: [
      toSurfaceAction("queue", SHELL_ACTION_KEY.ADMIN_QUEUE_PANEL),
      toSurfaceAction("policy", SHELL_ACTION_KEY.ADMIN_POLICY_PANEL),
      toSurfaceAction("runtime", SHELL_ACTION_KEY.ADMIN_RUNTIME_META)
    ],
    admin_runtime_flags: [
      toSurfaceAction("policy", SHELL_ACTION_KEY.ADMIN_POLICY_PANEL),
      toSurfaceAction("live_ops", SHELL_ACTION_KEY.ADMIN_LIVE_OPS_PANEL),
      toSurfaceAction("bot", SHELL_ACTION_KEY.ADMIN_RUNTIME_BOT),
      toSurfaceAction("runtime", SHELL_ACTION_KEY.ADMIN_RUNTIME_META)
    ],
    admin_runtime_bot: [
      toSurfaceAction("queue", SHELL_ACTION_KEY.ADMIN_QUEUE_PANEL),
      toSurfaceAction("live_ops", SHELL_ACTION_KEY.ADMIN_LIVE_OPS_PANEL),
      toSurfaceAction("flags", SHELL_ACTION_KEY.ADMIN_RUNTIME_FLAGS),
      toSurfaceAction("runtime", SHELL_ACTION_KEY.ADMIN_RUNTIME_META)
    ],
    admin_runtime_meta: [
      toSurfaceAction("queue", SHELL_ACTION_KEY.ADMIN_QUEUE_PANEL),
      toSurfaceAction("policy", SHELL_ACTION_KEY.ADMIN_POLICY_PANEL),
      toSurfaceAction("live_ops", SHELL_ACTION_KEY.ADMIN_LIVE_OPS_PANEL),
      toSurfaceAction("bot", SHELL_ACTION_KEY.ADMIN_RUNTIME_BOT)
    ]
  };
}

module.exports = {
  buildAdminSurfaceActions
};
