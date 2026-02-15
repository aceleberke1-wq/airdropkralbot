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

test("expectedActionForSequence is deterministic and in allowed set", () => {
  const sessionRef = "session-demo-001";
  const seq3a = arenaEngine.expectedActionForSequence(sessionRef, 3);
  const seq3b = arenaEngine.expectedActionForSequence(sessionRef, 3);
  const seq4 = arenaEngine.expectedActionForSequence(sessionRef, 4);

  assert.equal(seq3a, seq3b);
  assert.ok(arenaEngine.SESSION_ACTIONS.includes(seq3a));
  assert.ok(arenaEngine.SESSION_ACTIONS.includes(seq4));
});

test("evaluateSessionAction rewards correct action and penalizes high latency", () => {
  const sessionRef = "session-auth-123";
  const expected = arenaEngine.expectedActionForSequence(sessionRef, 1);

  const ok = arenaEngine.evaluateSessionAction(
    {
      sessionRef,
      score: 0,
      combo: 0,
      comboMax: 0,
      hits: 0,
      misses: 0,
      actionCount: 0
    },
    {
      actionSeq: 1,
      inputAction: expected,
      latencyMs: 80
    },
    config
  );

  assert.equal(ok.accepted, true);
  assert.ok(ok.scoreAfter > 0);
  assert.equal(ok.hitsAfter, 1);

  const bad = arenaEngine.evaluateSessionAction(
    {
      sessionRef,
      score: ok.scoreAfter,
      combo: ok.comboAfter,
      comboMax: ok.comboMax,
      hits: ok.hitsAfter,
      misses: ok.missesAfter,
      actionCount: ok.actionCount
    },
    {
      actionSeq: 2,
      inputAction: "strike",
      latencyMs: 9999
    },
    config
  );

  assert.equal(bad.accepted, false);
  assert.ok(bad.scoreDelta < 0);
  assert.equal(bad.comboAfter, 0);
  assert.equal(bad.missesAfter, 1);
});
