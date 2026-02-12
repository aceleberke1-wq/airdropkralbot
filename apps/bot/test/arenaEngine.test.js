const test = require("node:test");
const assert = require("node:assert/strict");
const arenaEngine = require("../src/services/arenaEngine");

const config = {
  economy: {
    sc: {
      risk_dampen: 0.25
    }
  },
  arena: {
    ticket_cost_rc: 1,
    cooldown_sec: 20,
    base_rating: 1000,
    rewards: {
      base_sc: 3,
      base_rc: 1,
      hc_win_chance: 0.02
    },
    rank_delta: {
      win: 22,
      near: 6,
      loss: -14
    }
  }
};

test("arena simulation returns bounded probabilities", () => {
  const result = arenaEngine.simulateRaid(
    config,
    {
      mode: "balanced",
      kingdomTier: 2,
      streak: 4,
      reputation: 1800,
      rating: 1040,
      risk: 0.3
    },
    { jitter: 0.5, enemy: 0.5, outcome: 0.5, hc: 0.5 }
  );

  assert.ok(result.probabilities.win >= 0.12 && result.probabilities.win <= 0.9);
  assert.ok(result.probabilities.near >= 0.08 && result.probabilities.near <= 0.34);
  assert.ok(result.probabilities.loss >= 0);
});

test("aggressive mode has higher reward curve than safe on same win path", () => {
  const input = {
    kingdomTier: 3,
    streak: 8,
    reputation: 5200,
    rating: 1200,
    risk: 0.1
  };
  const randoms = { jitter: 0.6, enemy: 0.2, outcome: 0.01, hc: 0.99 };

  const safe = arenaEngine.simulateRaid(config, { ...input, mode: "safe" }, randoms);
  const aggressive = arenaEngine.simulateRaid(config, { ...input, mode: "aggressive" }, randoms);

  assert.equal(safe.outcome, "win");
  assert.equal(aggressive.outcome, "win");
  assert.ok(aggressive.reward.sc >= safe.reward.sc);
  assert.ok(aggressive.ratingDelta >= safe.ratingDelta);
});

test("loss produces negative rating delta", () => {
  const result = arenaEngine.simulateRaid(
    config,
    {
      mode: "balanced",
      kingdomTier: 0,
      streak: 0,
      reputation: 0,
      rating: 1000,
      risk: 0.7
    },
    { jitter: 0.2, enemy: 0.99, outcome: 0.999, hc: 0.9 }
  );

  assert.equal(result.outcome, "loss");
  assert.ok(result.ratingDelta < 0);
});
