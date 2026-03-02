"use strict";

function clamp(value, min = 0, max = 1) {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.max(min, Math.min(max, num));
}

const DEFAULT_V5_RELEASE_CONFIG = Object.freeze({
  mode: "tiered_drip",
  global_cap_min_usd: 20_000_000,
  daily_drip_pct_max: 0.005,
  tier_rules: [
    { tier: "T0", min_score: 0, drip_pct: 0 },
    { tier: "T1", min_score: 0.25, drip_pct: 0.002 },
    { tier: "T2", min_score: 0.5, drip_pct: 0.0035 },
    { tier: "T3", min_score: 0.75, drip_pct: 0.005 }
  ],
  score_weights: {
    volume30d: 0.65,
    mission30d: 0.25,
    tenure30d: 0.1
  }
});

function normalizeV5ReleaseConfig(rawConfig) {
  const source = rawConfig && typeof rawConfig === "object" ? rawConfig : {};
  const weights = source.score_weights && typeof source.score_weights === "object" ? source.score_weights : {};
  const rulesRaw = Array.isArray(source.tier_rules) ? source.tier_rules : DEFAULT_V5_RELEASE_CONFIG.tier_rules;
  const tier_rules = rulesRaw
    .map((row) => ({
      tier: String(row?.tier || "T0").trim().toUpperCase(),
      min_score: clamp(Number(row?.min_score || 0), 0, 1),
      drip_pct: clamp(Number(row?.drip_pct || 0), 0, 1)
    }))
    .sort((a, b) => a.min_score - b.min_score);
  return {
    mode: String(source.mode || DEFAULT_V5_RELEASE_CONFIG.mode).trim().toLowerCase() || "tiered_drip",
    global_cap_min_usd: Math.max(0, Number(source.global_cap_min_usd || DEFAULT_V5_RELEASE_CONFIG.global_cap_min_usd)),
    daily_drip_pct_max: clamp(Number(source.daily_drip_pct_max || DEFAULT_V5_RELEASE_CONFIG.daily_drip_pct_max), 0, 1),
    tier_rules,
    score_weights: {
      volume30d: clamp(Number(weights.volume30d ?? DEFAULT_V5_RELEASE_CONFIG.score_weights.volume30d), 0, 1),
      mission30d: clamp(Number(weights.mission30d ?? DEFAULT_V5_RELEASE_CONFIG.score_weights.mission30d), 0, 1),
      tenure30d: clamp(Number(weights.tenure30d ?? DEFAULT_V5_RELEASE_CONFIG.score_weights.tenure30d), 0, 1)
    }
  };
}

function computeUnlockScoreV5(input, rawConfig = null) {
  const factors = input && typeof input === "object" ? input : {};
  const cfg = normalizeV5ReleaseConfig(rawConfig || {});
  const score =
    clamp(Number(factors.volume30d_norm || 0), 0, 1) * cfg.score_weights.volume30d +
    clamp(Number(factors.mission30d_norm || 0), 0, 1) * cfg.score_weights.mission30d +
    clamp(Number(factors.tenure30d_norm || 0), 0, 1) * cfg.score_weights.tenure30d;
  return Number(clamp(score, 0, 1).toFixed(6));
}

function resolveUnlockTierV5(unlockScore, rawConfig = null) {
  const score = clamp(Number(unlockScore || 0), 0, 1);
  const cfg = normalizeV5ReleaseConfig(rawConfig || {});
  let selected = cfg.tier_rules[0] || { tier: "T0", min_score: 0, drip_pct: 0 };
  for (const row of cfg.tier_rules) {
    if (score >= Number(row.min_score || 0)) {
      selected = row;
    }
  }
  return {
    tier: String(selected.tier || "T0"),
    min_score: Number(selected.min_score || 0),
    drip_pct: Number(selected.drip_pct || 0)
  };
}

function computeReleaseDripDecisionV5(input, rawConfig = null) {
  const source = input && typeof input === "object" ? input : {};
  const cfg = normalizeV5ReleaseConfig(rawConfig || {});
  const entitledBtc = Math.max(0, Number(source.entitled_btc || source.entitledBtc || 0));
  const todayUsedBtc = Math.max(0, Number(source.today_used_btc || source.todayUsedBtc || 0));
  const marketCapUsd = Math.max(0, Number(source.market_cap_usd || source.marketCapUsd || 0));
  const unlockScore = computeUnlockScoreV5(source, cfg);
  const tier = resolveUnlockTierV5(unlockScore, cfg);

  const globalGateOpen = marketCapUsd >= cfg.global_cap_min_usd;
  const dailyCap = Math.max(0, entitledBtc * Math.min(cfg.daily_drip_pct_max, tier.drip_pct));
  const dailyRemaining = Math.max(0, dailyCap - todayUsedBtc);
  const allowed = globalGateOpen && dailyRemaining > 0 && tier.drip_pct > 0;

  return {
    mode: cfg.mode,
    global_gate_open: globalGateOpen,
    global_cap_min_usd: cfg.global_cap_min_usd,
    global_cap_current_usd: marketCapUsd,
    unlock_score: unlockScore,
    unlock_tier: tier.tier,
    unlock_tier_drip_pct: tier.drip_pct,
    today_drip_cap_btc: Number(dailyCap.toFixed(8)),
    today_drip_used_btc: Number(todayUsedBtc.toFixed(8)),
    today_drip_btc_remaining: Number(dailyRemaining.toFixed(8)),
    requestable_btc: Number(Math.min(entitledBtc, dailyRemaining).toFixed(8)),
    allowed
  };
}

module.exports = {
  DEFAULT_V5_RELEASE_CONFIG,
  normalizeV5ReleaseConfig,
  computeUnlockScoreV5,
  resolveUnlockTierV5,
  computeReleaseDripDecisionV5
};
