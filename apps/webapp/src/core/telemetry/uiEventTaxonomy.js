const SAFE_DIMENSION = /^[a-z0-9:_-]{2,80}$/;
const SAFE_TX_STATE = /^[a-z0-9:_-]{2,32}$/;
const TAB_KEYS = new Set(["home", "pvp", "tasks", "vault", "admin"]);

export const UI_EVENT_KEY = Object.freeze({
  SHELL_OPEN: "shell_open",
  TAB_SWITCH: "tab_switch",
  WORKSPACE_SWITCH: "workspace_switch",
  LANGUAGE_SWITCH: "language_switch",
  ADVANCED_TOGGLE: "advanced_toggle",
  ONBOARDING_COMPLETE: "onboarding_complete",
  REFRESH_REQUEST: "refresh_request",
  REFRESH_SUCCESS: "refresh_success",
  REFRESH_FAILED: "refresh_failed",
  ACTION_REQUEST: "action_request",
  ACTION_RETRY: "action_retry",
  ACTION_SUCCESS: "action_success",
  ACTION_FAILED: "action_failed"
});

export const UI_FUNNEL_KEY = Object.freeze({
  PLAYER_LOOP: "player_loop",
  PVP_LOOP: "pvp_loop",
  TASKS_LOOP: "tasks_loop",
  VAULT_LOOP: "vault_loop",
  TOKEN_REVENUE: "token_revenue",
  ADMIN_OPS: "admin_ops",
  ONBOARDING: "onboarding"
});

export const UI_SURFACE_KEY = Object.freeze({
  SHELL: "shell",
  TOPBAR: "topbar",
  PLAYER_TABS: "player_tabs",
  PANEL_HOME: "panel_home",
  PANEL_PVP: "panel_pvp",
  PANEL_TASKS: "panel_tasks",
  PANEL_VAULT: "panel_vault",
  PANEL_ADMIN: "panel_admin",
  PANEL_ADMIN_QUEUE: "panel_admin_queue",
  PANEL_ADMIN_POLICY: "panel_admin_policy",
  PANEL_ADMIN_RUNTIME: "panel_admin_runtime"
});

export const UI_ECONOMY_EVENT_KEY = Object.freeze({
  TOKEN_QUOTE: "token_quote",
  TOKEN_BUY_INTENT: "token_buy_intent",
  TOKEN_SUBMIT_TX: "token_submit_tx",
  PASS_PURCHASE: "pass_purchase",
  COSMETIC_PURCHASE: "cosmetic_purchase",
  PAYOUT_REQUEST: "payout_request"
});

function normalizeDimension(value, fallback = "") {
  const text = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]/g, "_")
    .slice(0, 80);
  if (!text) return String(fallback || "");
  return SAFE_DIMENSION.test(text) ? text : String(fallback || "");
}

function normalizeTab(value, fallback = "home") {
  const key = String(value || "")
    .trim()
    .toLowerCase();
  if (TAB_KEYS.has(key)) {
    return key;
  }
  return String(fallback || "home");
}

function normalizeTxState(value) {
  const state = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]/g, "_")
    .slice(0, 32);
  if (!state) return "";
  return SAFE_TX_STATE.test(state) ? state : "";
}

export function buildRouteKey(workspace, tab) {
  const ws = normalizeDimension(workspace, "player");
  const tabKey = normalizeTab(tab, ws === "admin" ? "admin" : "home");
  return normalizeDimension(`${ws}_${tabKey}`, `${ws}_home`);
}

export function buildUiEventRecord(input = {}) {
  const row = input && typeof input === "object" ? input : {};
  const payload = row.payload_json && typeof row.payload_json === "object" ? row.payload_json : {};
  const eventValue = Number(row.event_value);

  return {
    event_key: normalizeDimension(row.event_key, UI_EVENT_KEY.ACTION_REQUEST),
    tab_key: normalizeTab(row.tab_key, "home"),
    panel_key: normalizeDimension(row.panel_key, UI_SURFACE_KEY.SHELL),
    route_key: normalizeDimension(row.route_key, ""),
    funnel_key: normalizeDimension(row.funnel_key, ""),
    surface_key: normalizeDimension(row.surface_key, ""),
    economy_event_key: normalizeDimension(row.economy_event_key, ""),
    value_usd: Math.max(0, Number(row.value_usd || 0)),
    tx_state: normalizeTxState(row.tx_state),
    event_value: Number.isFinite(eventValue) ? eventValue : 0,
    payload_json: payload,
    client_ts: row.client_ts || new Date().toISOString()
  };
}

