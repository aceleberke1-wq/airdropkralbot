const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildAdminWorkspaceKeyboard,
  buildDiscoverKeyboard,
  buildEventKeyboard,
  buildPayoutKeyboard,
  buildProfileKeyboard,
  buildRewardsKeyboard,
  buildSettingsKeyboard,
  buildStatusKeyboard,
  buildSupportKeyboard,
  buildSeasonKeyboard,
  buildTaskKeyboard,
  buildWalletKeyboard
} = require("../src/ui/keyboards");

test("task keyboard appends mission quarter launch button when url is provided", () => {
  const keyboard = buildTaskKeyboard([{ id: 11 }, { id: 12 }], "en", "https://example.com/app?route_key=missions");
  const rows = keyboard?.reply_markup?.inline_keyboard || [];
  const lastRow = rows.at(-1) || [];
  const launchButton = lastRow[0];

  assert.equal(launchButton.text, "🎯 Mission Quarter");
  assert.equal(launchButton.web_app?.url, "https://example.com/app?route_key=missions");
});

test("payout keyboard appends payout screen launch button when url is provided", () => {
  const keyboard = buildPayoutKeyboard(true, "en", "https://example.com/app?route_key=vault");
  const rows = keyboard?.reply_markup?.inline_keyboard || [];
  const lastRow = rows.at(-1) || [];
  const launchButton = lastRow[0];

  assert.equal(launchButton.text, "💎 Payout Screen");
  assert.equal(launchButton.web_app?.url, "https://example.com/app?route_key=vault");
});

test("wallet keyboard builds a dedicated Mini App launch button", () => {
  const keyboard = buildWalletKeyboard("https://example.com/app?route_key=exchange", "en");
  const rows = keyboard?.reply_markup?.inline_keyboard || [];
  const launchButton = rows[0]?.[0];

  assert.equal(launchButton.text, "💰 Wallet Panel");
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

  assert.equal(buttons[0]?.text, "📅 Season Hall");
  assert.equal(buttons[0]?.web_app?.url, "https://example.com/app?route_key=season");
  assert.equal(buttons[1]?.text, "🏆 Leaderboard");
  assert.equal(buttons[1]?.web_app?.url, "https://example.com/app?route_key=season&panel_key=leaderboard");
});

test("profile keyboard exposes profile and wallet launch buttons", () => {
  const keyboard = buildProfileKeyboard(
    "https://example.com/app?route_key=hub&panel_key=profile",
    "https://example.com/app?route_key=exchange&panel_key=wallet",
    "en"
  );
  const buttons = (keyboard?.reply_markup?.inline_keyboard || []).flat();

  assert.equal(buttons[0]?.text, "👤 Profile Hub");
  assert.equal(buttons[0]?.web_app?.url, "https://example.com/app?route_key=hub&panel_key=profile");
  assert.equal(buttons[1]?.text, "💰 Wallet Panel");
  assert.equal(buttons[1]?.web_app?.url, "https://example.com/app?route_key=exchange&panel_key=wallet");
});

test("status keyboard exposes status and discover launch buttons", () => {
  const keyboard = buildStatusKeyboard(
    "https://example.com/app?route_key=hub&panel_key=status",
    "https://example.com/app?route_key=events&panel_key=discover",
    "en"
  );
  const buttons = (keyboard?.reply_markup?.inline_keyboard || []).flat();

  assert.equal(buttons[0]?.text, "📊 Status Hub");
  assert.equal(buttons[0]?.web_app?.url, "https://example.com/app?route_key=hub&panel_key=status");
  assert.equal(buttons[1]?.text, "🔍 Discover");
  assert.equal(buttons[1]?.web_app?.url, "https://example.com/app?route_key=events&panel_key=discover");
});

test("rewards keyboard exposes rewards vault and leaderboard launch buttons", () => {
  const keyboard = buildRewardsKeyboard(
    "https://example.com/app?route_key=vault&panel_key=rewards",
    "https://example.com/app?route_key=season&panel_key=leaderboard",
    "en"
  );
  const buttons = (keyboard?.reply_markup?.inline_keyboard || []).flat();

  assert.equal(buttons[0]?.text, "🎁 Rewards Vault");
  assert.equal(buttons[0]?.web_app?.url, "https://example.com/app?route_key=vault&panel_key=rewards");
  assert.equal(buttons[1]?.text, "🏆 Leaderboard");
  assert.equal(buttons[1]?.web_app?.url, "https://example.com/app?route_key=season&panel_key=leaderboard");
});

test("event keyboard exposes event season and leaderboard launch buttons", () => {
  const keyboard = buildEventKeyboard(
    "https://example.com/app?route_key=events&panel_key=discover",
    "https://example.com/app?route_key=season",
    "https://example.com/app?route_key=season&panel_key=leaderboard",
    "en"
  );
  const buttons = (keyboard?.reply_markup?.inline_keyboard || []).flat();

  assert.equal(buttons[0]?.text, "🎪 Events Hub");
  assert.equal(buttons[1]?.text, "📅 Season Hall");
  assert.equal(buttons[2]?.text, "🏆 Leaderboard");
});

test("discover keyboard exposes discover mission and play launch buttons", () => {
  const keyboard = buildDiscoverKeyboard(
    "https://example.com/app?route_key=events&panel_key=discover",
    "https://example.com/app?route_key=missions&panel_key=quests",
    "https://example.com/app?route_key=hub",
    "en"
  );
  const buttons = (keyboard?.reply_markup?.inline_keyboard || []).flat();

  assert.equal(buttons[0]?.text, "🔍 Discover");
  assert.equal(buttons[1]?.text, "🎯 Mission Quarter");
  assert.equal(buttons[2]?.text, "🎮 Open Arena 3D");
});

test("settings keyboard exposes settings and support launch buttons", () => {
  const keyboard = buildSettingsKeyboard(
    "https://example.com/app?route_key=settings&panel_key=language",
    "https://example.com/app?route_key=settings&panel_key=support",
    "en"
  );
  const buttons = (keyboard?.reply_markup?.inline_keyboard || []).flat();

  assert.equal(buttons[0]?.text, "⚙️ Settings");
  assert.equal(buttons[1]?.text, "🆘 Support");
});

test("support keyboard exposes status payout settings and faq launch buttons", () => {
  const keyboard = buildSupportKeyboard(
    "https://example.com/app?route_key=hub&panel_key=status",
    "https://example.com/app?route_key=vault&panel_key=payout",
    "https://example.com/app?route_key=settings&panel_key=language",
    "https://example.com/app?route_key=settings&panel_key=faq",
    "en"
  );
  const buttons = (keyboard?.reply_markup?.inline_keyboard || []).flat();

  assert.equal(buttons[0]?.text, "📊 Status Hub");
  assert.equal(buttons[1]?.text, "💎 Payout Screen");
  assert.equal(buttons[2]?.text, "⚙️ Settings");
  assert.equal(buttons[3]?.text, "❓ FAQ");
});

test("admin workspace keyboard exposes admin route panels", () => {
  const keyboard = buildAdminWorkspaceKeyboard(
    "https://example.com/app?route_key=admin",
    "https://example.com/app?route_key=admin&panel_key=panel_admin_queue",
    "https://example.com/app?route_key=admin&panel_key=panel_admin_policy",
    "https://example.com/app?route_key=admin&panel_key=panel_admin_runtime",
    "en"
  );
  const buttons = (keyboard?.reply_markup?.inline_keyboard || []).flat();

  assert.equal(buttons[0]?.text, "🛡 Admin Workspace");
  assert.equal(buttons[1]?.text, "📋 Unified Queue");
  assert.equal(buttons[2]?.text, "📋 Policy Panel");
  assert.equal(buttons[3]?.text, "⚙️ Runtime Panel");
});
