import * as adminSurfaceActionCatalog from "../shared/adminSurfaceActionCatalog.js";

const { buildAdminSurfaceActions } = adminSurfaceActionCatalog;

function asRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toText(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizeActionRef(row) {
  const item = asRecord(row);
  return {
    slot_key: toText(item.slot_key || item.slotKey || ""),
    action_key: toText(item.action_key || item.shell_action_key || ""),
    shell_action_key: toText(item.shell_action_key || item.action_key || ""),
    route_key: toText(item.route_key || ""),
    panel_key: toText(item.panel_key || ""),
    focus_key: toText(item.focus_key || ""),
    tab: toText(item.tab || "")
  };
}

function normalizeSurfaceActions(source = {}) {
  const payload = asRecord(source);
  return Object.fromEntries(
    Object.entries(payload).map(([sectionKey, rows]) => [
      String(sectionKey || "").trim().toLowerCase(),
      asArray(rows)
        .map((row) => normalizeActionRef(row))
        .filter((row) => row.slot_key && row.action_key)
    ])
  );
}

export function buildAdminSurfaceActionsView(input = {}) {
  const adminSummary = asRecord(input.adminSummary);
  const adminPanels = asRecord(input.adminPanels);
  const source = Object.keys(asRecord(adminSummary.surface_actions)).length
    ? asRecord(adminSummary.surface_actions)
    : Object.keys(asRecord(adminPanels.surface_actions)).length
      ? asRecord(adminPanels.surface_actions)
      : buildAdminSurfaceActions();
  return normalizeSurfaceActions(source);
}
