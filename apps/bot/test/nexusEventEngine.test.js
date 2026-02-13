const test = require("node:test");
const assert = require("node:assert/strict");
const nexusEventEngine = require("../src/services/nexusEventEngine");

const baseConfig = {
  events: {
    anomalies: [
      {
        id: "alpha",
        title: "Alpha",
        sc_multiplier: 1.1,
        rc_multiplier: 1.2,
        hc_multiplier: 1,
        season_multiplier: 1.05,
        risk_shift: 0.1,
        preferred_mode: "safe"
      },
      {
        id: "beta",
        title: "Beta",
        sc_multiplier: 0.9,
        rc_multiplier: 1.3,
        hc_multiplier: 1.1,
        season_multiplier: 1.02,
        risk_shift: -0.07,
        preferred_mode: "balanced"
      }
    ]
  }
};

test("resolveDailyAnomaly is deterministic by day and season", () => {
  const nowMs = Date.parse("2026-02-13T10:30:00.000Z");
  const a = nexusEventEngine.resolveDailyAnomaly(baseConfig, { seasonId: 7, nowMs });
  const b = nexusEventEngine.resolveDailyAnomaly(baseConfig, { seasonId: 7, nowMs });
  assert.equal(a.id, b.id);
  assert.equal(a.date_key, "2026-02-13");
  assert.equal(a.season_id, 7);
});

test("applyRiskShift clamps risk bounds", () => {
  const anomaly = { risk_shift: 0.25 };
  assert.equal(nexusEventEngine.applyRiskShift(0.9, anomaly), 1);
  assert.equal(nexusEventEngine.applyRiskShift(0.1, { risk_shift: -0.4 }), 0);
});

test("applyAnomalyToReward boosts preferred mode", () => {
  const anomaly = {
    sc_multiplier: 1.2,
    rc_multiplier: 1.1,
    hc_multiplier: 1,
    preferred_mode: "aggressive"
  };
  const base = { sc: 10, hc: 1, rc: 5 };
  const aggressive = nexusEventEngine.applyAnomalyToReward(base, anomaly, { modeKey: "aggressive" });
  const safe = nexusEventEngine.applyAnomalyToReward(base, anomaly, { modeKey: "safe" });
  assert.ok(aggressive.reward.sc >= safe.reward.sc);
  assert.ok(aggressive.reward.rc >= safe.reward.rc);
  assert.equal(aggressive.reward.hc, safe.reward.hc);
});
