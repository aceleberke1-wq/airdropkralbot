"use strict";

const {
  CANONICAL_PANEL_KEY,
  CANONICAL_TAB_KEY,
  normalizeNavigationKey,
  normalizeTabKey,
  resolveFocusKey,
  resolvePanelKey,
  resolveRouteKey
} = require("./navigationContract");

const SAFE_ANALYTICS_KEY = /^[a-z0-9]+(?:[._:-][a-z0-9]+)+$/;
const SAFE_TX_STATE = /^[a-z0-9:_-]{2,32}$/;

const UI_EVENT_KEY = Object.freeze({
  SHELL_OPEN: "ui.shell.open",
  PANEL_OPEN: "ui.panel.open",
  PANEL_CLOSE: "ui.panel.close",
  TAB_SWITCH: "ui.tab.switch",
  WORKSPACE_SWITCH: "ui.workspace.switch",
  LANGUAGE_SWITCH: "ui.locale.switch",
  ADVANCED_TOGGLE: "ui.mode.toggle",
  ONBOARDING_COMPLETE: "onboarding.flow.complete",
  REFRESH_REQUEST: "data.refresh.request",
  REFRESH_SUCCESS: "data.refresh.success",
  REFRESH_FAILED: "data.refresh.failed",
  ACTION_REQUEST: "action.mutation.request",
  ACTION_RETRY: "action.mutation.retry",
  ACTION_SUCCESS: "action.mutation.success",
  ACTION_FAILED: "action.mutation.failed",
  SCENE_RUNTIME_READY: "runtime.scene.ready",
  SCENE_RUNTIME_FAILED: "runtime.scene.failed",
  SCENE_RUNTIME_LOOP: "runtime.scene.loop"
});

const UI_FUNNEL_KEY = Object.freeze({
  PLAYER_LOOP: "player_loop",
  PVP_LOOP: "pvp_loop",
  TASKS_LOOP: "tasks_loop",
  VAULT_LOOP: "vault_loop",
  TOKEN_REVENUE: "token_revenue",
  ADMIN_OPS: "admin_ops",
  ONBOARDING: "onboarding"
});

const UI_SURFACE_KEY = Object.freeze({
  SHELL: CANONICAL_PANEL_KEY.SHELL,
  TOPBAR: CANONICAL_PANEL_KEY.TOPBAR,
  PLAYER_TABS: CANONICAL_PANEL_KEY.PLAYER_TABS,
  PANEL_HOME: CANONICAL_PANEL_KEY.PANEL_HOME,
  PANEL_PVP: CANONICAL_PANEL_KEY.PANEL_PVP,
  PANEL_TASKS: CANONICAL_PANEL_KEY.PANEL_TASKS,
  PANEL_VAULT: CANONICAL_PANEL_KEY.PANEL_VAULT,
  PANEL_ADMIN: CANONICAL_PANEL_KEY.PANEL_ADMIN,
  PANEL_ADMIN_QUEUE: CANONICAL_PANEL_KEY.PANEL_ADMIN_QUEUE,
  PANEL_ADMIN_POLICY: CANONICAL_PANEL_KEY.PANEL_ADMIN_POLICY,
  PANEL_ADMIN_RUNTIME: CANONICAL_PANEL_KEY.PANEL_ADMIN_RUNTIME,
  PANEL_ADMIN_LIVE_OPS: CANONICAL_PANEL_KEY.PANEL_ADMIN_LIVE_OPS
});

const UI_ECONOMY_EVENT_KEY = Object.freeze({
  TOKEN_QUOTE: "economy.token.quote",
  TOKEN_BUY_INTENT: "economy.token.intent",
  TOKEN_SUBMIT_TX: "economy.token.submit",
  PASS_PURCHASE: "economy.pass.purchase",
  COSMETIC_PURCHASE: "economy.cosmetic.purchase",
  PAYOUT_REQUEST: "economy.payout.request"
});

function buildAnalyticsEventKey(family, object, verb) {
  return normalizeAnalyticsKey([family, object, verb].join("."), "");
}

function normalizeAnalyticsKey(value, fallback = "", maxLen = 80) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, ".")
    .replace(/[._:-]{2,}/g, ".")
    .replace(/^[._:-]+|[._:-]+$/g, "")
    .slice(0, Math.max(2, Number(maxLen) || 80));
  if (!normalized) {
    return String(fallback || "");
  }
  if (SAFE_ANALYTICS_KEY.test(normalized)) {
    return normalized;
  }
  return String(fallback || "");
}

function isSafeAnalyticsKey(value, maxLen = 80) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized.length > maxLen) {
    return false;
  }
  return SAFE_ANALYTICS_KEY.test(normalized);
}

function normalizeTelemetryDimension(value, fallback = "", maxLen = 80) {
  return normalizeNavigationKey(value, fallback, maxLen);
}

function normalizeTxState(value) {
  const normalized = normalizeNavigationKey(value, "", 32);
  if (!normalized) {
    return "";
  }
  return SAFE_TX_STATE.test(normalized) ? normalized : "";
}

function toEventValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed) : 0;
}

function toIsoOrNow(value) {
  if (!value) {
    return new Date().toISOString();
  }
  const ts = Number(value);
  const parsed = Number.isFinite(ts) ? new Date(ts) : new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}

function getUtf8ByteLength(value) {
  const text = String(value || "");
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(text).length;
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.byteLength(text, "utf8");
  }
  return unescape(encodeURIComponent(text)).length;
}

function normalizeUiEvent(rawEvent, defaults = {}) {
  const raw = rawEvent && typeof rawEvent === "object" ? rawEvent : null;
  if (!raw) {
    return null;
  }

  const eventKey = normalizeAnalyticsKey(raw.event_key, "");
  if (!eventKey) {
    return null;
  }

  const tabKey = normalizeTabKey(raw.tab_key || defaults.tab_key || CANONICAL_TAB_KEY.HOME, CANONICAL_TAB_KEY.HOME);
  const workspace = String(raw.workspace || defaults.workspace || "").trim().toLowerCase();
  const payloadJson = raw.payload_json && typeof raw.payload_json === "object" ? raw.payload_json : {};
  const payloadText = JSON.stringify(payloadJson);
  if (getUtf8ByteLength(payloadText) > 4096) {
    return null;
  }

  return {
    event_key: eventKey,
    tab_key: tabKey,
    panel_key: resolvePanelKey(raw.panel_key || defaults.panel_key || CANONICAL_PANEL_KEY.DEFAULT),
    route_key: resolveRouteKey({
      workspace,
      tab: tabKey,
      routeKey: raw.route_key || defaults.route_key || ""
    }),
    focus_key: resolveFocusKey(raw.focus_key || defaults.focus_key || ""),
    funnel_key: normalizeTelemetryDimension(raw.funnel_key || defaults.funnel_key || "", "", 64),
    surface_key: normalizeTelemetryDimension(raw.surface_key || defaults.surface_key || "", "", 64),
    economy_event_key: normalizeAnalyticsKey(raw.economy_event_key || defaults.economy_event_key || "", "", 80),
    value_usd: Math.max(0, toEventValue(raw.value_usd)),
    tx_state: normalizeTxState(raw.tx_state || defaults.tx_state || ""),
    variant_key: normalizeTelemetryDimension(raw.variant_key || defaults.variant_key || "control", "control", 24),
    experiment_key: normalizeTelemetryDimension(
      raw.experiment_key || defaults.experiment_key || "webapp_react_v1",
      "webapp_react_v1",
      80
    ),
    cohort_bucket: Math.max(0, Math.min(99, Math.floor(Number(raw.cohort_bucket ?? defaults.cohort_bucket ?? 0) || 0))),
    event_value: toEventValue(raw.event_value),
    payload_json: payloadJson,
    client_ts: toIsoOrNow(raw.client_ts || raw.client_at)
  };
}

function normalizeUiEventBatch(rawEvents, defaults = {}) {
  const list = Array.isArray(rawEvents) ? rawEvents : [];
  const accepted = [];
  let rejected = 0;
  for (const item of list) {
    const normalized = normalizeUiEvent(item, defaults);
    if (!normalized) {
      rejected += 1;
      continue;
    }
    accepted.push(normalized);
  }
  return { accepted, rejected };
}

function buildUiEventRecord(input = {}) {
  const normalized = normalizeUiEvent(input, {
    event_key: UI_EVENT_KEY.ACTION_REQUEST,
    panel_key: UI_SURFACE_KEY.SHELL,
    tab_key: CANONICAL_TAB_KEY.HOME
  });
  return normalized || normalizeUiEvent({ event_key: UI_EVENT_KEY.ACTION_REQUEST }, {});
}

module.exports = {
  UI_EVENT_KEY,
  UI_FUNNEL_KEY,
  UI_SURFACE_KEY,
  UI_ECONOMY_EVENT_KEY,
  buildAnalyticsEventKey,
  isSafeAnalyticsKey,
  normalizeAnalyticsKey,
  normalizeTelemetryDimension,
  normalizeTxState,
  normalizeUiEvent,
  normalizeUiEventBatch,
  buildUiEventRecord,
  resolveRouteKey
};
