const test = require("node:test");
const assert = require("node:assert/strict");
const {
  SIMPLE_BOT_ACTION_CATALOG,
  buildSimpleCallbackActionMap,
  buildSimpleWebAppActionMap,
  normalizeCallbackAction,
  normalizeWebAppAction
} = require("../src/commands/callbackActionCatalog");

test("callback action catalog normalizes callback and webapp action keys", () => {
  assert.equal(normalizeCallbackAction(" open_tasks "), "OPEN_TASKS");
  assert.equal(normalizeWebAppAction(" OPEN_TASKS "), "open_tasks");
});

test("callback action catalog keeps core open surfaces covered", () => {
  const handlerKeys = new Set(SIMPLE_BOT_ACTION_CATALOG.map((entry) => entry.handlerKey));

  assert.equal(handlerKeys.has("tasks"), true);
  assert.equal(handlerKeys.has("wallet"), true);
  assert.equal(handlerKeys.has("payout"), true);
  assert.equal(handlerKeys.has("status"), true);
  assert.equal(handlerKeys.has("nexus"), true);
  const walletEntry = SIMPLE_BOT_ACTION_CATALOG.find((entry) => entry.handlerKey === "wallet");
  assert.equal(walletEntry?.callbackLaunchEventKey, "launch.callback.open_wallet.open");
  assert.equal(walletEntry?.webAppLaunchEventKey, "launch.webapp_action.open_wallet.open");
});

test("callback action catalog builds shared callback and webapp handler maps", () => {
  const handlers = {
    tasks: () => "tasks",
    nexus: () => "nexus",
    token_mint: () => "token_mint"
  };

  const callbackMap = buildSimpleCallbackActionMap(handlers);
  const webAppMap = buildSimpleWebAppActionMap(handlers);

  assert.equal(callbackMap.OPEN_TASKS, handlers.tasks);
  assert.equal(callbackMap.OPEN_NEXUS, handlers.nexus);
  assert.equal(callbackMap.TOKEN_MINT, handlers.token_mint);
  assert.equal(webAppMap.open_tasks, handlers.tasks);
  assert.equal(webAppMap.open_nexus, handlers.nexus);
  assert.equal(webAppMap.open_contract, handlers.nexus);
  assert.equal(webAppMap.mint_token, handlers.token_mint);
});
