const test = require("node:test");
const assert = require("node:assert/strict");
const seasonStore = require("../src/stores/seasonStore");
const shopStore = require("../src/stores/shopStore");

test("season info uses fixed epoch and length", () => {
  const config = { loops: { macro: { season_length_days: 56 } } };
  const season = seasonStore.getSeasonInfo(config, new Date("2026-01-01T00:00:00Z"));
  assert.equal(season.seasonId, 1);
  assert.equal(season.daysLeft, 56);

  const next = seasonStore.getSeasonInfo(config, new Date("2026-03-05T00:00:00Z"));
  assert.ok(next.seasonId >= 2);
});

test("shop effects multiply SC reward and season bonus", () => {
  const effects = [
    { effect_key: "sc_boost", meta_json: { sc_multiplier: 0.25 } },
    { effect_key: "premium_pass", meta_json: { sc_multiplier: 0.15, season_point_bonus: 0.2 } }
  ];
  const reward = shopStore.applyEffectsToReward({ sc: 10, hc: 1, rc: 3 }, effects);
  assert.equal(reward.sc, 14);
  assert.equal(reward.hc, 1);
  assert.equal(reward.rc, 3);
  assert.equal(shopStore.getSeasonBonusMultiplier(effects), 0.2);
});
