const test = require("node:test");
const assert = require("node:assert/strict");
const arenaService = require("../src/services/arenaService");

const hooks = arenaService.__testHooks || {};

test("pvp retention config falls back to strict defaults", () => {
  const cfg = hooks.getPvpRetentionConfig({});
  assert.equal(cfg.daily_duel.target_wins, 1);
  assert.equal(cfg.weekly_ladder.target_points, 180);
  assert.equal(cfg.weekly_ladder.max_milestones, 3);
  assert.equal(cfg.season_arc_boss.wave_total, 5);
  assert.equal(cfg.season_arc_boss.wave_hp, 6000);
});

test("date keys are deterministic in UTC", () => {
  const date = new Date("2026-03-02T12:34:56.000Z");
  assert.equal(hooks.toUtcDayKey(date), "20260302");
  assert.equal(hooks.toIsoWeekKey(date), "2026w10");
});

test("progression view computes daily weekly and arc state", () => {
  const cfg = hooks.getPvpRetentionConfig({});
  const view = hooks.buildPvpProgressionView(
    cfg,
    {
      dailyWins: 1,
      dailyClaimed: 1,
      weeklyPoints: 220,
      weeklyClaimed: 1,
      arcPersonal: 900,
      arcPersonalClaimed: 2,
      arcGlobal: 7300
    },
    {
      seasonId: 12,
      dayKey: "20260302",
      weekKey: "2026w10"
    }
  );

  assert.equal(view.season_id, 12);
  assert.equal(view.daily_duel.completed, true);
  assert.equal(view.daily_duel.claimed, true);
  assert.equal(view.weekly_ladder.milestones_reached, 1);
  assert.equal(view.weekly_ladder.milestones_claimed, 1);
  assert.equal(view.season_arc_boss.wave_index, 2);
  assert.equal(view.season_arc_boss.personal_milestones_reached, 2);
});
