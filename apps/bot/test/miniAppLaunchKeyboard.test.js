const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildPayoutKeyboard,
  buildSeasonKeyboard,
  buildTaskKeyboard,
  buildWalletKeyboard
} = require("../src/ui/keyboards");

test("task keyboard appends mission quarter launch button when url is provided", () => {
  const keyboard = buildTaskKeyboard([{ id: 11 }, { id: 12 }], "en", "https://example.com/app?route_key=missions");
  const rows = keyboard?.reply_markup?.inline_keyboard || [];
  const lastRow = rows.at(-1) || [];
  const launchButton = lastRow[0];

  assert.equal(launchButton.text, "Mission Quarter");
  assert.equal(launchButton.web_app?.url, "https://example.com/app?route_key=missions");
});

test("payout keyboard appends payout screen launch button when url is provided", () => {
  const keyboard = buildPayoutKeyboard(true, "en", "https://example.com/app?route_key=vault");
  const rows = keyboard?.reply_markup?.inline_keyboard || [];
  const lastRow = rows.at(-1) || [];
  const launchButton = lastRow[0];

  assert.equal(launchButton.text, "Payout Screen");
  assert.equal(launchButton.web_app?.url, "https://example.com/app?route_key=vault");
});

test("wallet keyboard builds a dedicated Mini App launch button", () => {
  const keyboard = buildWalletKeyboard("https://example.com/app?route_key=exchange", "en");
  const rows = keyboard?.reply_markup?.inline_keyboard || [];
  const launchButton = rows[0]?.[0];

  assert.equal(launchButton.text, "Wallet Panel");
  assert.equal(launchButton.web_app?.url, "https://example.com/app?route_key=exchange");
});

test("season keyboard exposes season hall and leaderboard launch buttons", () => {
  const keyboard = buildSeasonKeyboard(
    "https://example.com/app?route_key=season",
    "https://example.com/app?route_key=season&panel_key=leaderboard",
    "en"
  );
  const rows = keyboard?.reply_markup?.inline_keyboard || [];
  const buttons = rows.flat();

  assert.equal(buttons[0]?.text, "Season Hall");
  assert.equal(buttons[0]?.web_app?.url, "https://example.com/app?route_key=season");
  assert.equal(buttons[1]?.text, "Leaderboard");
  assert.equal(buttons[1]?.web_app?.url, "https://example.com/app?route_key=season&panel_key=leaderboard");
});
