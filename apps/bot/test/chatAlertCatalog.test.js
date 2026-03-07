const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveChatAlertConfig } = require("../../../packages/shared/src/chatAlertCatalog");
const { resolveAlertLaunchEventKey } = require("../../../packages/shared/src/launchEventContract");

test("chat alert catalog resolves canonical alert surfaces", () => {
  const payout = resolveChatAlertConfig("payout_update");
  assert.equal(payout?.tone, "trust");
  assert.equal(payout?.surfaces?.[0]?.surface_key, "payout_screen");
  assert.equal(payout?.surfaces?.[1]?.surface_key, "support_panel");

  const streak = resolveChatAlertConfig("streak_risk");
  assert.equal(streak?.surfaces?.[0]?.slot_key, "mission_board");
  assert.equal(streak?.surfaces?.[1]?.surface_key, "status_hub");
});

test("alert launch event key keeps alert and slot in canonical format", () => {
  assert.equal(resolveAlertLaunchEventKey("payout_update", "support"), "launch.alert.payout_update_support.open");
  assert.equal(resolveAlertLaunchEventKey("season_deadline", "leaderboard"), "launch.alert.season_deadline_leaderboard.open");
});
