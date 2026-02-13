const DEFAULT_TOKEN_CONFIG = {
  enabled: true,
  symbol: "NXT",
  decimals: 4,
  usd_price: 0.0005,
  mint: {
    units_per_token: 100,
    min_tokens: 0.01,
    weights: {
      SC: 1,
      HC: 25,
      RC: 4
    },
    burn_priority: ["RC", "SC", "HC"]
  },
  purchase: {
    min_usd: 1,
    max_usd: 250,
    slippage_pct: 0.03,
    chains: {
      BTC: { pay_currency: "BTC", env_key: "btc" },
      ETH: { pay_currency: "ETH", env_key: "eth" },
      TRX: { pay_currency: "TRX", env_key: "trx" },
      SOL: { pay_currency: "SOL", env_key: "sol" },
      TON: { pay_currency: "TON", env_key: "ton" }
    }
  },
  payout_gate: {
    enabled: false,
    min_market_cap_usd: 10000000,
    target_band_max_usd: 20000000
  }
};

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundTo(value, decimals = 8) {
  const m = 10 ** Math.max(0, decimals);
  return Math.round(value * m) / m;
}

function floorTo(value, decimals = 8) {
  const m = 10 ** Math.max(0, decimals);
  return Math.floor(value * m) / m;
}

function normalizeTokenConfig(runtimeConfig) {
  const incoming = runtimeConfig?.token || {};
  const incomingWeights = incoming.mint?.weights || {};
  const incomingChains = incoming.purchase?.chains || {};
  const normalizedChains = {};
  for (const [key, value] of Object.entries(incomingChains)) {
    normalizedChains[String(key || "").toUpperCase()] = value;
  }
  const merged = {
    enabled: incoming.enabled !== false,
    symbol: String(incoming.symbol || DEFAULT_TOKEN_CONFIG.symbol).toUpperCase(),
    decimals: clamp(Math.floor(toNum(incoming.decimals, DEFAULT_TOKEN_CONFIG.decimals)), 2, 8),
    usd_price: Math.max(0.00000001, toNum(incoming.usd_price, DEFAULT_TOKEN_CONFIG.usd_price)),
    mint: {
      units_per_token: Math.max(
        1,
        toNum(incoming.mint?.units_per_token, DEFAULT_TOKEN_CONFIG.mint.units_per_token)
      ),
      min_tokens: Math.max(0.0001, toNum(incoming.mint?.min_tokens, DEFAULT_TOKEN_CONFIG.mint.min_tokens)),
      weights: {
        SC: Math.max(
          0,
          toNum(incomingWeights.SC ?? incomingWeights.sc, DEFAULT_TOKEN_CONFIG.mint.weights.SC)
        ),
        HC: Math.max(
          0,
          toNum(incomingWeights.HC ?? incomingWeights.hc, DEFAULT_TOKEN_CONFIG.mint.weights.HC)
        ),
        RC: Math.max(
          0,
          toNum(incomingWeights.RC ?? incomingWeights.rc, DEFAULT_TOKEN_CONFIG.mint.weights.RC)
        )
      },
      burn_priority: Array.isArray(incoming.mint?.burn_priority)
        ? incoming.mint.burn_priority.map((x) => String(x || "").toUpperCase()).filter(Boolean)
        : DEFAULT_TOKEN_CONFIG.mint.burn_priority
    },
    purchase: {
      min_usd: Math.max(0.5, toNum(incoming.purchase?.min_usd, DEFAULT_TOKEN_CONFIG.purchase.min_usd)),
      max_usd: Math.max(1, toNum(incoming.purchase?.max_usd, DEFAULT_TOKEN_CONFIG.purchase.max_usd)),
      slippage_pct: clamp(
        toNum(incoming.purchase?.slippage_pct, DEFAULT_TOKEN_CONFIG.purchase.slippage_pct),
        0,
        0.2
      ),
      chains:
        Object.keys(normalizedChains).length > 0
          ? normalizedChains
          : DEFAULT_TOKEN_CONFIG.purchase.chains
    },
    payout_gate: {
      enabled:
        typeof incoming.payout_gate?.enabled === "boolean"
          ? incoming.payout_gate.enabled
          : DEFAULT_TOKEN_CONFIG.payout_gate.enabled,
      min_market_cap_usd: Math.max(
        0,
        toNum(incoming.payout_gate?.min_market_cap_usd, DEFAULT_TOKEN_CONFIG.payout_gate.min_market_cap_usd)
      ),
      target_band_max_usd: Math.max(
        0,
        toNum(incoming.payout_gate?.target_band_max_usd, DEFAULT_TOKEN_CONFIG.payout_gate.target_band_max_usd)
      )
    }
  };

  if (merged.purchase.max_usd < merged.purchase.min_usd) {
    merged.purchase.max_usd = merged.purchase.min_usd;
  }
  return merged;
}

function normalizeChain(chainRaw) {
  return String(chainRaw || "").trim().toUpperCase();
}

function getChainConfig(tokenConfig, chainRaw) {
  const chain = normalizeChain(chainRaw);
  const chains = tokenConfig?.purchase?.chains || {};
  const entry = chains[chain];
  if (!entry) {
    return null;
  }
  return {
    chain,
    payCurrency: String(entry.pay_currency || chain).toUpperCase(),
    envKey: String(entry.env_key || chain.toLowerCase()).toLowerCase()
  };
}

function resolvePaymentAddress(appConfig, chainConfig) {
  if (!chainConfig) {
    return "";
  }
  const map = appConfig?.addresses || {};
  return String(map[chainConfig.envKey] || "").trim();
}

function computeUnifiedUnits(balances, tokenConfig) {
  const weights = tokenConfig.mint.weights;
  const sc = toNum(balances?.SC, 0);
  const hc = toNum(balances?.HC, 0);
  const rc = toNum(balances?.RC, 0);
  const units = sc * weights.SC + hc * weights.HC + rc * weights.RC;
  return roundTo(Math.max(0, units), 8);
}

function estimateTokenFromBalances(balances, tokenConfig) {
  const units = computeUnifiedUnits(balances, tokenConfig);
  return floorTo(units / tokenConfig.mint.units_per_token, tokenConfig.decimals);
}

function quotePurchaseByUsd(usdRaw, tokenConfig) {
  const usd = toNum(usdRaw, 0);
  if (!Number.isFinite(usd) || usd <= 0) {
    return { ok: false, reason: "invalid_usd_amount" };
  }
  if (usd < tokenConfig.purchase.min_usd) {
    return { ok: false, reason: "purchase_below_min", minUsd: tokenConfig.purchase.min_usd };
  }
  if (usd > tokenConfig.purchase.max_usd) {
    return { ok: false, reason: "purchase_above_max", maxUsd: tokenConfig.purchase.max_usd };
  }

  const tokenAmount = roundTo(usd / tokenConfig.usd_price, tokenConfig.decimals);
  const slippage = roundTo(tokenAmount * tokenConfig.purchase.slippage_pct, tokenConfig.decimals);
  return {
    ok: true,
    usdAmount: roundTo(usd, 8),
    tokenAmount,
    tokenMinReceive: Math.max(0, roundTo(tokenAmount - slippage, tokenConfig.decimals)),
    tokenSymbol: tokenConfig.symbol
  };
}

function planMintFromBalances(balances, tokenConfig, requestedTokenRaw) {
  const decimals = tokenConfig.decimals;
  const unitsPerToken = tokenConfig.mint.units_per_token;
  const totalUnits = computeUnifiedUnits(balances, tokenConfig);
  const maxMintable = floorTo(totalUnits / unitsPerToken, decimals);
  const minMint = tokenConfig.mint.min_tokens;
  if (maxMintable < minMint) {
    return {
      ok: false,
      reason: "mint_below_min",
      minTokens: minMint,
      maxMintable
    };
  }

  let targetToken = maxMintable;
  if (requestedTokenRaw !== undefined && requestedTokenRaw !== null && String(requestedTokenRaw).trim() !== "") {
    const parsed = toNum(requestedTokenRaw, 0);
    if (parsed <= 0) {
      return { ok: false, reason: "invalid_mint_amount" };
    }
    targetToken = floorTo(parsed, decimals);
    if (targetToken < minMint) {
      return { ok: false, reason: "mint_below_min", minTokens: minMint, maxMintable };
    }
    if (targetToken > maxMintable) {
      return { ok: false, reason: "insufficient_balance", maxMintable };
    }
  }

  const requiredUnits = roundTo(targetToken * unitsPerToken, 8);
  const debits = { SC: 0, HC: 0, RC: 0 };
  const priority = tokenConfig.mint.burn_priority || ["RC", "SC", "HC"];
  const weights = tokenConfig.mint.weights;
  let remaining = requiredUnits;

  for (const currency of priority) {
    if (remaining <= 0.00000001) {
      break;
    }
    const key = String(currency || "").toUpperCase();
    const weight = toNum(weights[key], 0);
    if (weight <= 0) {
      continue;
    }
    const available = Math.max(0, toNum(balances?.[key], 0) - debits[key]);
    if (available <= 0) {
      continue;
    }
    const availableUnits = available * weight;
    const useUnits = Math.min(remaining, availableUnits);
    const useAmount = roundTo(useUnits / weight, 8);
    if (useAmount <= 0) {
      continue;
    }
    debits[key] = roundTo(debits[key] + useAmount, 8);
    remaining = roundTo(remaining - useAmount * weight, 8);
  }

  if (remaining > 0.0001) {
    return { ok: false, reason: "mint_plan_failed", maxMintable };
  }

  return {
    ok: true,
    tokenAmount: targetToken,
    tokenSymbol: tokenConfig.symbol,
    unitsSpent: requiredUnits,
    debits,
    maxMintable
  };
}

module.exports = {
  DEFAULT_TOKEN_CONFIG,
  normalizeTokenConfig,
  normalizeChain,
  getChainConfig,
  resolvePaymentAddress,
  computeUnifiedUnits,
  estimateTokenFromBalances,
  quotePurchaseByUsd,
  planMintFromBalances
};
