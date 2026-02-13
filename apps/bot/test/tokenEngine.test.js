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
