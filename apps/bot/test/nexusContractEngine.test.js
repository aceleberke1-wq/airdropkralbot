const test = require("node:test");
const assert = require("node:assert/strict");
const contractEngine = require("../src/services/nexusContractEngine");

test("resolveDailyContract stays deterministic for same seed", () => {
  const config = {
    events: {
      contracts: [
        { id: "a", required_mode: "safe" },
        { id: "b", required_mode: "balanced" },
        { id: "c", required_mode: "aggressive" }
      ]
    }
  };

  const one = contractEngine.resolveDailyContract(config, {
    seasonId: 7,
    nowMs: Date.parse("2026-02-13T00:00:00Z"),
    anomalyId: "flux"
  });
  const two = contractEngine.resolveDailyContract(config, {
    seasonId: 7,
    nowMs: Date.parse("2026-02-13T12:00:00Z"),
    anomalyId: "flux"
  });

  assert.equal(one.id, two.id);
  assert.equal(one.required_mode, two.required_mode);
});

test("evaluateAttempt enforces mode family result rules", () => {
  const contract = {
    id: "shield_protocol",
    required_mode: "safe",
    focus_families: ["timer", "war"],
    require_result: "success_or_near",
    sc_multiplier: 1.1,
    rc_flat_bonus: 2,
    season_bonus: 3,
    war_bonus: 1
  };

  const ok = contractEngine.evaluateAttempt(contract, {
    modeKey: "safe",
    family: "timer",
    result: "near_miss",
    combo: 4
  });
  assert.equal(ok.matched, true);
  assert.ok(ok.sc_multiplier > 1.1);
  assert.equal(ok.rc_flat_bonus, 2);

  const fail = contractEngine.evaluateAttempt(contract, {
    modeKey: "aggressive",
    family: "timer",
    result: "success",
    combo: 2
  });
  assert.equal(fail.matched, false);
  assert.equal(fail.rc_flat_bonus, 0);
  assert.equal(fail.sc_multiplier, 1);
});

test("applyContractToReward boosts only SC and RC by evaluation", () => {
  const baseReward = { sc: 10, hc: 1, rc: 3 };
  const applied = contractEngine.applyContractToReward(baseReward, {
    sc_multiplier: 1.2,
    rc_flat_bonus: 2
  });
  assert.deepEqual(applied.reward, { sc: 12, hc: 1, rc: 5 });
});
