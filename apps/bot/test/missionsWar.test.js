const test = require("node:test");
const assert = require("node:assert/strict");
const missionStore = require("../src/stores/missionStore");
const globalStore = require("../src/stores/globalStore");

test("war tier thresholds are stable", () => {
  assert.equal(globalStore.getWarTier(0).tier, "Seed");
  assert.equal(globalStore.getWarTier(800).tier, "Alpha");
  assert.equal(globalStore.getWarTier(3000).tier, "Beta");
  assert.equal(globalStore.getWarTier(10000).tier, "Gamma");
  assert.equal(globalStore.getWarTier(25000).tier, "Omega");
});

test("mission definitions include expected keys", () => {
  const defs = missionStore.getDefinitions();
  const keys = defs.map((d) => d.key).sort();
  assert.deepEqual(keys, [
    "aggressive_win",
    "combo_3plus",
    "daily_3_tasks",
    "daily_8_tasks",
    "rare_hunt",
    "war_contributor"
  ]);
  assert.ok(missionStore.getDefinitionByKey("rare_hunt"));
  assert.ok(missionStore.getDefinitionByKey("war_contributor"));
});

test("insertClaimIfEligible enforces mission completion", async () => {
  const db = {
    async query() {
      return { rows: [{ user_id: 1, mission_key: "daily_3_tasks", day_date: "2026-02-11", claimed_at: new Date().toISOString() }] };
    }
  };
  const board = [
    {
      key: "daily_3_tasks",
      title: "Rhythm Runner",
      completed: true,
      claimed: false,
      reward: { sc: 15, hc: 0, rc: 5 }
    },
    {
      key: "aggressive_win",
      title: "Risk Master",
      completed: false,
      claimed: false,
      reward: { sc: 10, hc: 1, rc: 10 }
    }
  ];

  const ok = await missionStore.insertClaimIfEligible(db, { userId: 1, missionKey: "daily_3_tasks", board });
  assert.equal(ok.status, "claimed");
  const notReady = await missionStore.insertClaimIfEligible(db, { userId: 1, missionKey: "aggressive_win", board });
  assert.equal(notReady.status, "not_ready");
});
