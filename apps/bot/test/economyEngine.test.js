const test = require("node:test");
const assert = require("node:assert/strict");
const economyEngine = require("../src/services/economyEngine");

const config = {
  loops: {
    meso: {
      daily_cap_base: 120
    }
  },
  economy: {
    sc: {
      base: 1,
      diff_coeff: 0.8,
      streak_coeff: 0.12,
      kingdom_coeff: 0.05,
      fatigue_coeff: 0.18,
      risk_dampen: 0.25
    },
    hc: {
      p0: 0.002,
      p_min: 0.001,
      p_max: 0.02,
      streak_coeff: 0.0015,
      pity_cap: 40
    }
  },
  tasks: {
    target_success_micro: 0.78,
    near_miss_rate: 0.18
  },
  anti_abuse: {
    risk_soft_dampen: 0.2
  }
};

test("probabilities are clamped to expected bounds", () => {
  const probs = economyEngine.getTaskProbabilities(config, {
    difficulty: 1,
    streak: 0,
    risk: 1
  });
  assert.ok(probs.pSuccess >= 0.4);
  assert.ok(probs.pSuccess <= 0.93);
  assert.ok(probs.pNearMiss >= 0.1);
  assert.ok(probs.pNearMiss <= 0.3);
  assert.ok(probs.pFail >= 0);
});

test("daily cap increases with kingdom tier", () => {
  const cap0 = economyEngine.getDailyCap(config, 0);
  const cap3 = economyEngine.getDailyCap(config, 3);
  assert.equal(cap0, 120);
  assert.equal(cap3, 180);
});

test("fatigue drops after daily cap is exceeded", () => {
  const cap = economyEngine.getDailyCap(config, 0);
  const fatigueAtCap = economyEngine.getFatigue(config, cap, cap);
  const fatigueAbove = economyEngine.getFatigue(config, cap + 40, cap);
  assert.equal(fatigueAtCap, 1);
  assert.ok(fatigueAbove < 1);
});

test("hard currency probability is clamped and pity-aware", () => {
  const low = economyEngine.getHardCurrencyProbability(config, {
    streak: 0,
    risk: 1,
    pityBefore: 0
  });
  const highPity = economyEngine.getHardCurrencyProbability(config, {
    streak: 30,
    risk: 0,
    pityBefore: 40
  });
  assert.ok(low.pHC >= 0.001 && low.pHC <= 0.02);
  assert.ok(highPity.pHC >= low.pHC);
});

test("reveal outcome forces rare on pity cap", () => {
  const outcome = economyEngine.computeRevealOutcome(config, {
    attemptResult: "success",
    difficulty: 0.4,
    streak: 1,
    kingdomTier: 1,
    risk: 0,
    dailyTasks: 0,
    pityBefore: 40,
    lootRoll: 0.99
  });
  assert.equal(outcome.tier, "rare");
  assert.equal(outcome.forcedPity, true);
  assert.equal(outcome.pityAfter, 0);
});
