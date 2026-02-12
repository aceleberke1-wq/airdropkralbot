const test = require("node:test");
const assert = require("node:assert/strict");
const antiAbuseEngine = require("../src/services/antiAbuseEngine");

const config = {
  anti_abuse: {
    ewma_alpha: 0.2,
    short_complete_sec: 10,
    very_short_complete_sec: 4,
    hourly_task_soft: 20,
    hourly_task_hard: 40,
    duplicate_ratio_soft: 0.1,
    duplicate_ratio_hard: 0.2
  }
};

test("signal increases with short duration and duplicate ratio", () => {
  const output = antiAbuseEngine.computeSignal(
    config,
    "task_complete",
    { durationSec: 2 },
    {
      callback_total: 20,
      callback_duplicate_total: 5,
      task_complete_total: 10,
      reveal_duplicate_total: 1
    }
  );
  assert.ok(output.signal > 0.6);
  assert.ok(output.duplicateRatio >= 0.2);
});

test("EWMA keeps risk bounded", () => {
  const high = antiAbuseEngine.computeNextRisk(config, 0.9, 1);
  const low = antiAbuseEngine.computeNextRisk(config, 0.1, 0);
  assert.ok(high <= 1 && high >= 0);
  assert.ok(low <= 1 && low >= 0);
});

test("applyRiskEvent uses store contracts", async () => {
  const calls = [];
  const mockStore = {
    async getRiskState() {
      calls.push("getRiskState");
      return { riskScore: 0.2, signals: {} };
    },
    async insertBehaviorEvent() {
      calls.push("insertBehaviorEvent");
    },
    async getHourlySnapshot() {
      calls.push("getHourlySnapshot");
      return {
        callback_total: 8,
        callback_duplicate_total: 2,
        task_complete_total: 5,
        reveal_duplicate_total: 0
      };
    },
    async updateRiskState(_db, _userId, nextRisk) {
      calls.push("updateRiskState");
      assert.ok(nextRisk >= 0 && nextRisk <= 1);
    }
  };

  const res = await antiAbuseEngine.applyRiskEvent({}, mockStore, config, {
    userId: 1,
    eventType: "callback_duplicate",
    context: {}
  });
  assert.ok(res.risk >= 0 && res.risk <= 1);
  assert.deepEqual(calls, ["getRiskState", "insertBehaviorEvent", "getHourlySnapshot", "updateRiskState"]);
});
