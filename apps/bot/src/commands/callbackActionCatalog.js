"use strict";

const SIMPLE_BOT_ACTION_CATALOG = Object.freeze([
  Object.freeze({ handlerKey: "tasks", callbackAction: "OPEN_TASKS", webAppAction: "open_tasks" }),
  Object.freeze({ handlerKey: "wallet", callbackAction: "OPEN_WALLET", webAppAction: "open_wallet" }),
  Object.freeze({ handlerKey: "token", callbackAction: "OPEN_TOKEN", webAppAction: "open_token" }),
  Object.freeze({ handlerKey: "season", callbackAction: "OPEN_SEASON" }),
  Object.freeze({ handlerKey: "leaderboard", callbackAction: "OPEN_LEADERBOARD", webAppAction: "open_leaderboard" }),
  Object.freeze({ handlerKey: "shop", callbackAction: "OPEN_SHOP" }),
  Object.freeze({ handlerKey: "missions", callbackAction: "OPEN_MISSIONS", webAppAction: "open_missions" }),
  Object.freeze({ handlerKey: "daily", callbackAction: "OPEN_DAILY", webAppAction: "open_daily" }),
  Object.freeze({ handlerKey: "kingdom", callbackAction: "OPEN_KINGDOM", webAppAction: "open_kingdom" }),
  Object.freeze({ handlerKey: "war", callbackAction: "OPEN_WAR", webAppAction: "open_war" }),
  Object.freeze({ handlerKey: "payout", callbackAction: "OPEN_PAYOUT", webAppAction: "open_payout" }),
  Object.freeze({ handlerKey: "status", callbackAction: "OPEN_STATUS", webAppAction: "open_status" }),
  Object.freeze({ handlerKey: "nexus", callbackAction: "OPEN_NEXUS", webAppAction: "open_nexus", webAppAliases: ["open_contract"] }),
  Object.freeze({ handlerKey: "guide", callbackAction: "OPEN_GUIDE" }),
  Object.freeze({ handlerKey: "onboard", callbackAction: "OPEN_ONBOARD" }),
  Object.freeze({ handlerKey: "more_menu", callbackAction: "OPEN_MORE_MENU" }),
  Object.freeze({ handlerKey: "home_menu", callbackAction: "OPEN_HOME_MENU" }),
  Object.freeze({ handlerKey: "guide_finish_balanced", callbackAction: "GUIDE_FINISH_BALANCED" }),
  Object.freeze({ handlerKey: "guide_reveal", callbackAction: "GUIDE_REVEAL" }),
  Object.freeze({ handlerKey: "play", callbackAction: "OPEN_PLAY", webAppAction: "open_play" }),
  Object.freeze({ handlerKey: "arena_rank", callbackAction: "OPEN_ARENA_RANK" }),
  Object.freeze({ handlerKey: "token_mint", callbackAction: "TOKEN_MINT", webAppAction: "mint_token" }),
  Object.freeze({ handlerKey: "token_buy_quick", callbackAction: "TOKEN_BUY_QUICK" }),
  Object.freeze({ handlerKey: "admin_panel_refresh", callbackAction: "ADMIN_PANEL_REFRESH" }),
  Object.freeze({ handlerKey: "admin_open_payouts", callbackAction: "ADMIN_OPEN_PAYOUTS" }),
  Object.freeze({ handlerKey: "admin_open_queue", callbackAction: "ADMIN_OPEN_QUEUE" }),
  Object.freeze({ handlerKey: "admin_open_tokens", callbackAction: "ADMIN_OPEN_TOKENS" })
]);

function normalizeCallbackAction(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeWebAppAction(value) {
  return String(value || "").trim().toLowerCase();
}

function buildSimpleCallbackActionMap(handlerMap = {}) {
  return Object.fromEntries(
    SIMPLE_BOT_ACTION_CATALOG
      .map((entry) => {
        const handler = handlerMap[entry.handlerKey];
        if (!entry.callbackAction || typeof handler !== "function") {
          return null;
        }
        return [entry.callbackAction, handler];
      })
      .filter(Boolean)
  );
}

function buildSimpleWebAppActionMap(handlerMap = {}) {
  const actions = [];
  for (const entry of SIMPLE_BOT_ACTION_CATALOG) {
    const handler = handlerMap[entry.handlerKey];
    if (typeof handler !== "function") {
      continue;
    }
    const action = normalizeWebAppAction(entry.webAppAction);
    if (action) {
      actions.push([action, handler]);
    }
    for (const alias of Array.isArray(entry.webAppAliases) ? entry.webAppAliases : []) {
      const normalized = normalizeWebAppAction(alias);
      if (normalized) {
        actions.push([normalized, handler]);
      }
    }
  }
  return Object.fromEntries(actions);
}

module.exports = {
  SIMPLE_BOT_ACTION_CATALOG,
  normalizeCallbackAction,
  normalizeWebAppAction,
  buildSimpleCallbackActionMap,
  buildSimpleWebAppActionMap
};
