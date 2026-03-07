"use strict";

const { resolveLaunchTarget } = require("./navigationContract");

function normalizeAdminCommandKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^\/+/, "");
}

function buildAdminCommandTarget(routeKey, panelKey, focusKey) {
  const target = resolveLaunchTarget({
    workspace: "admin",
    routeKey,
    panelKey,
    focusKey
  });
  return {
    route_key: String(target.route_key || "admin"),
    panel_key: String(target.panel_key || ""),
    focus_key: String(target.focus_key || ""),
    workspace: "admin",
    tab: String(target.tab || "home")
  };
}

function resolveAdminCommandNavigation(commandKey) {
  const key = normalizeAdminCommandKey(commandKey);
  if (!key) {
    return null;
  }

  if (key === "admin" || key === "admin_live") {
    return buildAdminCommandTarget("admin", "", "");
  }

  if (key === "admin_queue" || key === "admin_payouts" || key === "admin_tokens" || key === "pay" || key === "reject_payout" || key === "approve_token" || key === "reject_token") {
    return buildAdminCommandTarget("admin", "panel_admin_queue", "queue_action");
  }

  if (key === "admin_metrics" || key === "admin_config") {
    return buildAdminCommandTarget("admin", "panel_admin_runtime", "runtime_meta");
  }

  if (key === "admin_live_ops") {
    return buildAdminCommandTarget("admin", "panel_admin_live_ops", "campaign_editor");
  }

  if (key === "admin_gate" || key === "admin_token_price") {
    return buildAdminCommandTarget("admin", "panel_admin_policy", "dynamic_policy");
  }

  if (key === "admin_freeze") {
    return buildAdminCommandTarget("admin", "panel_admin_runtime", "runtime_flags");
  }

  return null;
}

module.exports = {
  normalizeAdminCommandKey,
  buildAdminCommandTarget,
  resolveAdminCommandNavigation
};
