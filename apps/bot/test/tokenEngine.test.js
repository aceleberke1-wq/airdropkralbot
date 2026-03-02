const test = require("node:test");
const assert = require("node:assert/strict");
const tokenEngine = require("../src/services/tokenEngine");

test("normalizeTokenConfig falls back safely", () => {
  const cfg = tokenEngine.normalizeTokenConfig({});
  assert.equal(cfg.symbol, "NXT");
  assert.equal(cfg.enabled, true);
  assert.ok(cfg.mint.units_per_token > 0);
});

test("quotePurchaseByUsd enforces min max and computes token amount", () => {
  const cfg = tokenEngine.normalizeTokenConfig({
    token: {
      usd_price: 0.001,
      purchase: { min_usd: 2, max_usd: 10, slippage_pct: 0.05 }
    }
  });

  const tooLow = tokenEngine.quotePurchaseByUsd(1, cfg);
  assert.equal(tooLow.ok, false);
  assert.equal(tooLow.reason, "purchase_below_min");

  const ok = tokenEngine.quotePurchaseByUsd(5, cfg);
  assert.equal(ok.ok, true);
  assert.equal(ok.tokenAmount, 5000);
  assert.equal(ok.tokenMinReceive, 4750);
});

test("planMintFromBalances creates debit plan from priority", () => {
  const cfg = tokenEngine.normalizeTokenConfig({
    token: {
      symbol: "K99",
      decimals: 4,
      mint: {
        units_per_token: 100,
        min_tokens: 0.01,
        weights: { sc: 1, hc: 20, rc: 4 },
        burn_priority: ["rc", "sc", "hc"]
      }
    }
  });

  const balances = { SC: 50, HC: 2, RC: 40 };
  const plan = tokenEngine.planMintFromBalances(balances, cfg, 1);
  assert.equal(plan.ok, true);
  assert.equal(plan.tokenAmount, 1);
  assert.equal(plan.debits.RC, 25);
  assert.equal(plan.debits.SC, 0);
  assert.equal(plan.debits.HC, 0);
});

test("planMintFromBalances returns insufficient when requested too high", () => {
  const cfg = tokenEngine.normalizeTokenConfig({
    token: {
      mint: {
        units_per_token: 100,
        weights: { sc: 1, hc: 20, rc: 4 }
      }
    }
  });

  const balances = { SC: 10, HC: 0, RC: 0 };
  const plan = tokenEngine.planMintFromBalances(balances, cfg, 5);
  assert.equal(plan.ok, false);
  assert.equal(plan.reason, "insufficient_balance");
});

test("computeTreasuryCurvePrice is monotonic and clamps to admin floor", () => {
  const cfg = tokenEngine.normalizeTokenConfig({
    token: {
      usd_price: 0.0005,
      curve: {
        enabled: true,
        admin_floor_usd: 0.0008,
        base_usd: 0.0003,
        k: 0.12,
        supply_norm_divisor: 1000,
        demand_factor: 1
      }
    }
  });

  const low = tokenEngine.computeTreasuryCurvePrice({
    tokenConfig: cfg,
    marketState: null,
    totalSupply: 100
  });
  const high = tokenEngine.computeTreasuryCurvePrice({
    tokenConfig: cfg,
    marketState: null,
    totalSupply: 100000
  });

  assert.ok(low.priceUsd >= 0.0008);
  assert.ok(high.priceUsd >= low.priceUsd);
});

test("evaluateAutoApprovePolicy enforces usd/risk/velocity/onchain and gate", () => {
  const policy = {
    enabled: true,
    autoUsdLimit: 10,
    riskThreshold: 0.35,
    velocityPerHour: 8,
    requireOnchainVerified: true
  };

  const pass = tokenEngine.evaluateAutoApprovePolicy(
    {
      usdAmount: 5,
      riskScore: 0.12,
      velocityPerHour: 2,
      onchainVerified: true,
      gateOpen: true
    },
    policy
  );
  assert.equal(pass.passed, true);
  assert.equal(pass.decision, "auto_approved");

  const failRisk = tokenEngine.evaluateAutoApprovePolicy(
    {
      usdAmount: 5,
      riskScore: 0.8,
      velocityPerHour: 2,
      onchainVerified: true,
      gateOpen: true
    },
    policy
  );
  assert.equal(failRisk.passed, false);
  assert.equal(failRisk.decision, "manual_review");
  assert.equal(failRisk.reason, "risk_threshold_exceeded");

  const failOnchain = tokenEngine.evaluateAutoApprovePolicy(
    {
      usdAmount: 5,
      riskScore: 0.1,
      velocityPerHour: 2,
      onchainVerified: false,
      gateOpen: true
    },
    policy
  );
  assert.equal(failOnchain.passed, false);
  assert.equal(failOnchain.reason, "onchain_verification_required");
});

test("computePayoutReleaseState applies 20M gate and drip cap tiers", () => {
  const cfg = tokenEngine.normalizeTokenConfig({
    token: {
      payout_release: {
        enabled: true,
        mode: "tiered_drip",
        global_cap_min_usd: 20000000,
        daily_drip_pct_max: 0.005,
        tier_rules: [
          { tier: "T0", min_score: 0, drip_pct: 0 },
          { tier: "T1", min_score: 0.25, drip_pct: 0.002 },
          { tier: "T2", min_score: 0.5, drip_pct: 0.0035 },
          { tier: "T3", min_score: 0.75, drip_pct: 0.005 }
        ],
        score_weights: { volume30d: 0.65, mission30d: 0.25, tenure30d: 0.1 }
      }
    }
  });

  const locked = tokenEngine.computePayoutReleaseState({
    releaseConfig: cfg.payout_release,
    entitledBtc: 1,
    todayUsedBtc: 0,
    marketCapUsd: 10000000,
    score: { volume30d_norm: 1, mission30d_norm: 1, tenure30d_norm: 1 }
  });
  assert.equal(locked.globalGateOpen, false);
  assert.equal(locked.allowed, false);

  const t3 = tokenEngine.computePayoutReleaseState({
    releaseConfig: cfg.payout_release,
    entitledBtc: 1,
    todayUsedBtc: 0.001,
    marketCapUsd: 25000000,
    score: { volume30d_norm: 1, mission30d_norm: 1, tenure30d_norm: 1 }
  });
  assert.equal(t3.unlockTier, "T3");
  assert.equal(t3.todayDripCapBtc, 0.005);
  assert.equal(t3.todayDripRemainingBtc, 0.004);
  assert.equal(t3.allowed, true);
});

test("evaluateUnlockScore uses v1 fixed weights", () => {
  const score = tokenEngine.evaluateUnlockScore(
    {
      volume30d_norm: 0.5,
      mission30d_norm: 0.4,
      tenure30d_norm: 0.3
    },
    {
      score_weights: { volume30d: 0.65, mission30d: 0.25, tenure30d: 0.1 }
    }
  );
  assert.equal(Number(score.unlockScore.toFixed(4)), 0.455);
});
