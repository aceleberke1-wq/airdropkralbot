"use strict";

const CANONICAL_WORKSPACE_KEY = Object.freeze({
  PLAYER: "player",
  ADMIN: "admin"
});

const CANONICAL_TAB_KEY = Object.freeze({
  HOME: "home",
  PVP: "pvp",
  TASKS: "tasks",
  VAULT: "vault",
  ADMIN: "admin"
});

const CANONICAL_ROUTE_KEY = Object.freeze({
  HUB: "hub",
  MISSIONS: "missions",
  PVP: "pvp",
  FORGE: "forge",
  EXCHANGE: "exchange",
  SEASON: "season",
  EVENTS: "events",
  VAULT: "vault",
  SETTINGS: "settings",
  ADMIN: "admin"
});

const CANONICAL_PANEL_KEY = Object.freeze({
  DEFAULT: "default",
  SHELL: "shell",
  TOPBAR: "topbar",
  PLAYER_TABS: "player_tabs",
  PROFILE: "profile",
  REWARDS: "rewards",
  WALLET: "wallet",
  CLAIM: "claim",
  PAYOUT: "payout",
  HISTORY: "history",
  STATUS: "status",
  RANK: "rank",
  STREAK: "streak",
  INVENTORY: "inventory",
  KINGDOM: "kingdom",
  LEADERBOARD: "leaderboard",
  NEWS: "news",
  CHESTS: "chests",
  QUESTS: "quests",
  DISCOVER: "discover",
  LANGUAGE: "language",
  HELP: "help",
  SUPPORT: "support",
  FAQ: "faq",
  PANEL_HOME: "panel_home",
  PANEL_PVP: "panel_pvp",
  PANEL_TASKS: "panel_tasks",
  PANEL_VAULT: "panel_vault",
  PANEL_ADMIN: "panel_admin",
  PANEL_ADMIN_QUEUE: "panel_admin_queue",
  PANEL_ADMIN_POLICY: "panel_admin_policy",
  PANEL_ADMIN_RUNTIME: "panel_admin_runtime"
});

const ROUTE_KEYS = new Set(Object.values(CANONICAL_ROUTE_KEY));
const TAB_KEYS = new Set(Object.values(CANONICAL_TAB_KEY));

function normalizeNavigationKey(value, fallback = "", maxLen = 80) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, Math.max(1, Number(maxLen) || 80));
  if (!normalized) {
    return String(fallback || "");
  }
  return normalized;
}

function isSafeNavigationKey(value, maxLen = 80) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized.length > maxLen) {
    return false;
  }
  return /^[a-z0-9:_-]{1,80}$/.test(normalized);
}

function normalizeTabKey(value, fallback = CANONICAL_TAB_KEY.HOME) {
  const normalized = normalizeNavigationKey(value, fallback, 24);
  return TAB_KEYS.has(normalized) ? normalized : String(fallback || CANONICAL_TAB_KEY.HOME);
}

function resolveRouteKey(input = {}) {
  const explicit = normalizeNavigationKey(input.routeKey, "", 80);
  if (explicit && ROUTE_KEYS.has(explicit)) {
    return explicit;
  }

  const workspace = normalizeNavigationKey(input.workspace, CANONICAL_WORKSPACE_KEY.PLAYER, 24);
  const tab = normalizeTabKey(
    input.tab,
    workspace === CANONICAL_WORKSPACE_KEY.ADMIN ? CANONICAL_TAB_KEY.ADMIN : CANONICAL_TAB_KEY.HOME
  );

  if (workspace === CANONICAL_WORKSPACE_KEY.ADMIN || tab === CANONICAL_TAB_KEY.ADMIN) {
    return CANONICAL_ROUTE_KEY.ADMIN;
  }

  if (tab === CANONICAL_TAB_KEY.PVP) {
    return CANONICAL_ROUTE_KEY.PVP;
  }
  if (tab === CANONICAL_TAB_KEY.TASKS) {
    return CANONICAL_ROUTE_KEY.MISSIONS;
  }
  if (tab === CANONICAL_TAB_KEY.VAULT) {
    return CANONICAL_ROUTE_KEY.VAULT;
  }
  return CANONICAL_ROUTE_KEY.HUB;
}

function resolvePanelKey(value, fallback = CANONICAL_PANEL_KEY.DEFAULT) {
  return normalizeNavigationKey(value, fallback, 64);
}

function resolveFocusKey(value, fallback = "") {
  return normalizeNavigationKey(value, fallback, 80);
}

function buildStartAppPayload(input = {}) {
  const routeKey = resolveRouteKey(input);
  const panelKey = resolvePanelKey(input.panelKey || input.panel_key || "", "");
  const focusKey = resolveFocusKey(input.focusKey || input.focus_key || "", "");
  const payload = { route_key: routeKey };
  if (panelKey) {
    payload.panel_key = panelKey;
  }
  if (focusKey) {
    payload.focus_key = focusKey;
  }
  return payload;
}

function encodeStartAppPayload(input = {}) {
  const payload = buildStartAppPayload(input);
  const parts = [`r=${payload.route_key}`];
  if (payload.panel_key) {
    parts.push(`p=${payload.panel_key}`);
  }
  if (payload.focus_key) {
    parts.push(`f=${payload.focus_key}`);
  }
  return parts.join(";");
}

function decodeStartAppPayload(rawValue) {
  const raw = String(rawValue || "").trim();
  if (!raw) {
    return buildStartAppPayload({ routeKey: CANONICAL_ROUTE_KEY.HUB });
  }
  const state = {};
  for (const part of raw.split(";")) {
    const [key, value] = String(part || "").split("=");
    if (key === "r") {
      state.routeKey = value;
    } else if (key === "p") {
      state.panelKey = value;
    } else if (key === "f") {
      state.focusKey = value;
    }
  }
  return buildStartAppPayload(state);
}

module.exports = {
  CANONICAL_WORKSPACE_KEY,
  CANONICAL_TAB_KEY,
  CANONICAL_ROUTE_KEY,
  CANONICAL_PANEL_KEY,
  normalizeNavigationKey,
  isSafeNavigationKey,
  normalizeTabKey,
  resolveRouteKey,
  resolvePanelKey,
  resolveFocusKey,
  buildStartAppPayload,
  encodeStartAppPayload,
  decodeStartAppPayload
};
