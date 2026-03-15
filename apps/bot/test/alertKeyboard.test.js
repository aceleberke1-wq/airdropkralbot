const test = require("node:test");
const assert = require("node:assert/strict");
const { buildAlertSurfaceKeyboard, mergeInlineKeyboards, buildStatusKeyboard } = require("../src/ui/keyboards");

test("buildAlertSurfaceKeyboard resolves alert launch surface labels", () => {
  const keyboard = buildAlertSurfaceKeyboard(
    [
      { surfaceKey: "payout_screen", url: "https://example.com/payout" },
      { surfaceKey: "support_panel", url: "https://example.com/support" }
    ],
    "en"
  );

  assert.equal(keyboard?.reply_markup?.inline_keyboard?.[0]?.[0]?.text, "💎 Payout Screen");
  assert.equal(keyboard?.reply_markup?.inline_keyboard?.[0]?.[1]?.text, "🆘 Support");
});

test("mergeInlineKeyboards deduplicates identical launch buttons", () => {
  const base = buildStatusKeyboard("https://example.com/status", "https://example.com/discover", "en");
  const alert = buildAlertSurfaceKeyboard(
    [
      { surfaceKey: "status_hub", url: "https://example.com/status" },
      { surfaceKey: "mission_quarter", url: "https://example.com/tasks" }
    ],
    "en"
  );

  const merged = mergeInlineKeyboards(base, alert);
  const rows = merged?.reply_markup?.inline_keyboard || [];
  const texts = rows.flat().map((button) => button.text);

  assert.equal(texts.filter((text) => text === "📊 Status Hub").length, 1);
  assert.equal(texts.includes("🎯 Mission Quarter"), true);
});
