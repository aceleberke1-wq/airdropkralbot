const test = require("node:test");
const assert = require("node:assert/strict");
const pvpProgressionStore = require("../src/stores/pvpProgressionStore");

test("getSnapshot maps v5 progression rows", async () => {
  const db = {
    query: async (sql) => {
      if (sql.includes("FROM v5_pvp_progression_daily")) {
        return {
          rows: [
            {
              duel_wins: 2,
              duel_claimed: 1,
              points_delta: 64,
              state_json: { source: "dual_run_v5" },
              updated_at: "2026-03-02T10:00:00.000Z"
            }
          ]
        };
      }
      if (sql.includes("FROM v5_pvp_progression_weekly")) {
        return {
          rows: [
            {
              ladder_points: 245,
              milestones_claimed: 1,
              state_json: { source: "dual_run_v5" },
              updated_at: "2026-03-02T10:00:00.000Z"
            }
          ]
        };
      }
      if (sql.includes("FROM v5_pvp_progression_season")) {
        return {
          rows: [
            {
              arc_personal_contribution: 930,
              arc_personal_claimed: 2,
              arc_global_contribution: 8120,
              state_json: { source: "dual_run_v5" },
              updated_at: "2026-03-02T10:00:00.000Z"
            }
          ]
        };
      }
      return { rows: [] };
    }
  };

  const snapshot = await pvpProgressionStore.getSnapshot(db, {
    userId: 9,
    seasonId: 12,
    dayKey: "20260302",
    weekKey: "2026w10"
  });

  assert.equal(snapshot.source, "v5");
  assert.equal(snapshot.dailyWins, 2);
  assert.equal(snapshot.dailyClaimed, 1);
  assert.equal(snapshot.weeklyPoints, 245);
  assert.equal(snapshot.weeklyClaimed, 1);
  assert.equal(snapshot.arcPersonal, 930);
  assert.equal(snapshot.arcPersonalClaimed, 2);
  assert.equal(snapshot.arcGlobal, 8120);
});

test("getSnapshot returns null when v5 tables are missing", async () => {
  const db = {
    query: async () => {
      const err = new Error("relation does not exist");
      err.code = "42P01";
      throw err;
    }
  };

  const snapshot = await pvpProgressionStore.getSnapshot(db, {
    userId: 9,
    seasonId: 12,
    dayKey: "20260302",
    weekKey: "2026w10"
  });
  assert.equal(snapshot, null);
});

test("upsertSnapshot dual-writes all layers and reports persisted", async () => {
  let queryCount = 0;
  const db = {
    query: async (sql) => {
      queryCount += 1;
      if (sql.includes("INSERT INTO v5_pvp_progression_daily")) {
        return { rows: [{ user_id: 9, season_id: 12, day_key: "20260302" }] };
      }
      if (sql.includes("INSERT INTO v5_pvp_progression_weekly")) {
        return { rows: [{ user_id: 9, season_id: 12, week_key: "2026w10" }] };
      }
      if (sql.includes("INSERT INTO v5_pvp_progression_season")) {
        return { rows: [{ user_id: 9, season_id: 12 }] };
      }
      return { rows: [] };
    }
  };

  const result = await pvpProgressionStore.upsertSnapshot(db, {
    userId: 9,
    seasonId: 12,
    dayKey: "20260302",
    weekKey: "2026w10",
    dailyWins: 2,
    dailyClaimed: 1,
    weeklyPoints: 245,
    weeklyClaimed: 1,
    weeklyPointsGain: 64,
    arcPersonal: 930,
    arcPersonalClaimed: 2,
    arcGlobal: 8120,
    arcContributionGain: 71,
    outcome: "win",
    score: 87,
    combo: 5,
    contractMatched: true,
    signals: ["daily_duel_complete"]
  });

  assert.equal(queryCount, 3);
  assert.equal(result.persisted, true);
});
