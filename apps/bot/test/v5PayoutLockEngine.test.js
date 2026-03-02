const test = require("node:test");
const assert = require("node:assert/strict");
const {
  computeUnlockScoreV5,
  resolveUnlockTierV5,
  computeReleaseDripDecisionV5
} = require("../../../packages/shared/src/v5/payoutLockEngine");

test("computeUnlockScoreV5 uses fixed weights", () => {
  const score = computeUnlockScoreV5({
    volume30d_norm: 1,
    mission30d_norm: 0.5,
    tenure30d_norm: 0
  });
  assert.equal(score, 0.775);
});

test("resolveUnlockTierV5 maps score to expected tier", () => {
  assert.equal(resolveUnlockTierV5(0.1).tier, "T0");
  assert.equal(resolveUnlockTierV5(0.3).tier, "T1");
  assert.equal(resolveUnlockTierV5(0.55).tier, "T2");
  assert.equal(resolveUnlockTierV5(0.9).tier, "T3");
});

test("computeReleaseDripDecisionV5 enforces 20M market cap gate", () => {
  const locked = computeReleaseDripDecisionV5({
    volume30d_norm: 1,
    mission30d_norm: 1,
    tenure30d_norm: 1,
    market_cap_usd: 10_000_000,
    entitled_btc: 0.01,
    today_used_btc: 0
  });
  assert.equal(locked.global_gate_open, false);
  assert.equal(locked.allowed, false);

  const open = computeReleaseDripDecisionV5({
    volume30d_norm: 1,
    mission30d_norm: 1,
    tenure30d_norm: 1,
    market_cap_usd: 25_000_000,
    entitled_btc: 0.02,
    today_used_btc: 0.00002
  });
  assert.equal(open.global_gate_open, true);
  assert.ok(open.today_drip_btc_remaining > 0);
});
