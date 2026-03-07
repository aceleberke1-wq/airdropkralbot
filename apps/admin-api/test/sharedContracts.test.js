const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const localeContract = require(path.join(process.cwd(), "packages", "shared", "src", "localeContract.js"));
const currencyGlossary = require(path.join(process.cwd(), "packages", "shared", "src", "currencyGlossary.js"));
const navigationContract = require(path.join(process.cwd(), "packages", "shared", "src", "navigationContract.js"));
const telemetryContract = require(path.join(process.cwd(), "packages", "shared", "src", "telemetryContract.js"));
const launchEventContract = require(path.join(process.cwd(), "packages", "shared", "src", "launchEventContract.js"));
const shellActionCatalog = require(path.join(process.cwd(), "packages", "shared", "src", "shellActionCatalog.js"));

test("resolveLocalePreference honors canonical precedence", () => {
  const override = localeContract.resolveLocalePreference({
    override: "en",
    telegramLanguageCode: "tr",
    profileLocale: "tr"
  });
  assert.equal(override.language, "en");
  assert.equal(override.source, "stored_user_override");

  const telegram = localeContract.resolveLocalePreference({
    override: "",
    telegramLanguageCode: "en-US",
    profileLocale: "tr"
  });
  assert.equal(telegram.language, "en");
  assert.equal(telegram.source, "telegram_ui_language_code");
});

test("currency glossary normalizes gameplay and settlement keys", () => {
  assert.equal(currencyGlossary.normalizeCurrencyKey("sc"), currencyGlossary.CANONICAL_CURRENCY_KEY.SC);
  assert.equal(currencyGlossary.normalizeCurrencyKey("payout_available"), currencyGlossary.CANONICAL_CURRENCY_KEY.PAYOUT_AVAILABLE);
  assert.equal(currencyGlossary.normalizeCurrencyKey("nxt"), currencyGlossary.SETTLEMENT_TOKEN_SYMBOL);
  assert.equal(currencyGlossary.isGameplayCurrency("HC"), true);
  assert.equal(currencyGlossary.isGameplayCurrency("NXT"), false);
});

test("navigation contract resolves canonical route grammar and startapp payloads", () => {
  assert.equal(navigationContract.resolveRouteKey({ workspace: "player", tab: "home" }), "hub");
  assert.equal(navigationContract.resolveRouteKey({ workspace: "player", tab: "pvp" }), "pvp");
  assert.equal(navigationContract.resolveRouteKey({ workspace: "player", tab: "tasks" }), "missions");
  assert.equal(navigationContract.resolveRouteKey({ workspace: "admin", tab: "home" }), "admin");

  const encoded = navigationContract.encodeStartAppPayload({
    routeKey: "vault",
    panelKey: "payout",
    focusKey: "request"
  });
  assert.equal(encoded, "r=vault;p=payout;f=request");
  assert.deepEqual(navigationContract.decodeStartAppPayload(encoded), {
    route_key: "vault",
    panel_key: "payout",
    focus_key: "request"
  });

  assert.deepEqual(
    navigationContract.resolveLaunchTarget({
      panelKey: "support",
      focusKey: "faq_cards"
    }),
    {
      route_key: "settings",
      panel_key: "support",
      focus_key: "faq_cards",
      workspace: "player",
      tab: "home"
    }
  );

  assert.deepEqual(
    navigationContract.resolveLaunchTarget({
      panelKey: "panel_admin_queue",
      focusKey: "queue_action"
    }),
    {
      route_key: "admin",
      panel_key: "panel_admin_queue",
      focus_key: "queue_action",
      workspace: "admin",
      tab: "home"
    }
  );
});

test("telemetry contract builds canonical analytics keys and UI event records", () => {
  assert.equal(telemetryContract.buildAnalyticsEventKey("ui", "shell", "open"), "ui.shell.open");
  assert.equal(telemetryContract.normalizeAnalyticsKey("Action Success"), "action.success");

  const event = telemetryContract.buildUiEventRecord({
    event_key: "Action Success",
    tab_key: "tasks",
    panel_key: "panel tasks",
    focus_key: "claim cta",
    economy_event_key: "token quote"
  });

  assert.equal(event.event_key, "action.success");
  assert.equal(event.route_key, "missions");
  assert.equal(event.panel_key, "panel_tasks");
  assert.equal(event.focus_key, "claim_cta");
  assert.equal(event.economy_event_key, "token.quote");
});

test("launch event contract keeps command, surface and callback launch reasons canonical", () => {
  assert.equal(launchEventContract.resolveCommandLaunchEventKey("wallet"), "launch.command.wallet.open");
  assert.equal(launchEventContract.resolveSurfaceLaunchEventKey("profile_hub"), "launch.surface.profile_hub.open");
  assert.equal(launchEventContract.resolveCallbackLaunchEventKey("OPEN_WALLET"), "launch.callback.open_wallet.open");
  assert.equal(launchEventContract.resolveWebAppActionLaunchEventKey("open_wallet"), "launch.webapp_action.open_wallet.open");
  assert.equal(launchEventContract.resolveInternalLaunchEventKey("player_route_wallet"), "launch.internal.player_route_wallet.open");
});

test("shell action catalog resolves canonical player and admin targets", () => {
  assert.deepEqual(shellActionCatalog.resolveShellActionTarget(shellActionCatalog.SHELL_ACTION_KEY.PLAYER_WORLD_HUB), {
    action_key: "player.route.world_hub",
    workspace: "player",
    route_key: "hub",
    panel_key: "",
    focus_key: "",
    tab: "home"
  });

  assert.deepEqual(shellActionCatalog.resolveShellActionTarget(shellActionCatalog.SHELL_ACTION_KEY.PLAYER_WALLET_CONNECT), {
    action_key: "player.route.wallet_connect",
    workspace: "player",
    route_key: "vault",
    panel_key: "wallet",
    focus_key: "connect",
    tab: "vault"
  });

  assert.deepEqual(shellActionCatalog.resolveShellActionTarget(shellActionCatalog.SHELL_ACTION_KEY.ADMIN_RUNTIME_FLAGS), {
    action_key: "admin.route.runtime_flags",
    workspace: "admin",
    route_key: "admin",
    panel_key: "panel_admin_runtime",
    focus_key: "runtime_flags",
    tab: "home"
  });

  assert.deepEqual(shellActionCatalog.resolveShellActionTarget(shellActionCatalog.SHELL_ACTION_KEY.ADMIN_LIVE_OPS_PANEL), {
    action_key: "admin.route.live_ops_panel",
    workspace: "admin",
    route_key: "admin",
    panel_key: "panel_admin_live_ops",
    focus_key: "campaign_editor",
    tab: "home"
  });

  assert.equal(shellActionCatalog.resolveShellActionKeyForBotHandler("wallet"), shellActionCatalog.SHELL_ACTION_KEY.PLAYER_WALLET_CONNECT);
  assert.equal(shellActionCatalog.resolveShellActionKeyForLaunchSurface("play_world"), shellActionCatalog.SHELL_ACTION_KEY.PLAYER_WORLD_HUB);
  assert.equal(shellActionCatalog.resolveShellActionKeyForLaunchSurface("admin_workspace"), shellActionCatalog.SHELL_ACTION_KEY.ADMIN_WORKSPACE);
});
