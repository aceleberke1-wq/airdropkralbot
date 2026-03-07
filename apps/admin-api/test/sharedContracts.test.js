const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const localeContract = require(path.join(process.cwd(), "packages", "shared", "src", "localeContract.js"));
const currencyGlossary = require(path.join(process.cwd(), "packages", "shared", "src", "currencyGlossary.js"));
const navigationContract = require(path.join(process.cwd(), "packages", "shared", "src", "navigationContract.js"));
const telemetryContract = require(path.join(process.cwd(), "packages", "shared", "src", "telemetryContract.js"));

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
