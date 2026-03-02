const test = require("node:test");
const assert = require("node:assert/strict");
const { computePvpProgressionState } = require("../../../packages/shared/src/v5/progressionEngine");

test("computePvpProgressionState returns layered pvp progression", () => {
  const state = computePvpProgressionState(
    {
      daily_wins: 1,
      daily_claimed: 1,
      weekly_points: 240,
      weekly_claimed: 1,
      arc_global: 7200,
      arc_personal: 900,
      arc_personal_claimed: 2
    },
    null,
    { season_id: 5, day_key: "20260302", week_key: "2026w10" }
  );
  assert.equal(state.season_id, 5);
  assert.equal(state.daily_duel.completed, true);
  assert.equal(state.weekly_ladder.milestones_reached, 1);
  assert.equal(state.season_arc_boss.wave_index, 2);
  assert.equal(state.season_arc_boss.personal_milestones_reached, 2);
});
