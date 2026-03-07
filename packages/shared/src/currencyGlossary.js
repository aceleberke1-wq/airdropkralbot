"use strict";

const CANONICAL_CURRENCY_KEY = Object.freeze({
  SC: "SC",
  RC: "RC",
  HC: "HC",
  PAYOUT_AVAILABLE: "payout_available",
  NXT: "NXT"
});

const SETTLEMENT_TOKEN_SYMBOL = CANONICAL_CURRENCY_KEY.NXT;

const CANONICAL_CURRENCY_META = Object.freeze({
  [CANONICAL_CURRENCY_KEY.SC]: Object.freeze({
    label: "Soft Credits",
    withdrawable: false,
    category: "gameplay"
  }),
  [CANONICAL_CURRENCY_KEY.RC]: Object.freeze({
    label: "Relic Credits",
    withdrawable: false,
    category: "gameplay"
  }),
  [CANONICAL_CURRENCY_KEY.HC]: Object.freeze({
    label: "Hard Credits",
    withdrawable: false,
    category: "gameplay"
  }),
  [CANONICAL_CURRENCY_KEY.PAYOUT_AVAILABLE]: Object.freeze({
    label: "Payout Available",
    withdrawable: true,
    category: "derived_liability"
  }),
  [CANONICAL_CURRENCY_KEY.NXT]: Object.freeze({
    label: "Nexus Token",
    withdrawable: true,
    category: "settlement"
  })
});

const GAMEPLAY_CURRENCY_KEYS = Object.freeze([
  CANONICAL_CURRENCY_KEY.SC,
  CANONICAL_CURRENCY_KEY.RC,
  CANONICAL_CURRENCY_KEY.HC
]);

function normalizeCurrencyKey(value, fallback = CANONICAL_CURRENCY_KEY.SC) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (!raw) {
    return normalizeCurrencyKey(fallback, CANONICAL_CURRENCY_KEY.SC);
  }
  if (raw === "payout_available") {
    return CANONICAL_CURRENCY_KEY.PAYOUT_AVAILABLE;
  }
  const upper = raw.toUpperCase();
  if (upper === CANONICAL_CURRENCY_KEY.SC || upper === CANONICAL_CURRENCY_KEY.RC || upper === CANONICAL_CURRENCY_KEY.HC) {
    return upper;
  }
  if (upper === CANONICAL_CURRENCY_KEY.NXT) {
    return CANONICAL_CURRENCY_KEY.NXT;
  }
  return normalizeCurrencyKey(fallback, CANONICAL_CURRENCY_KEY.SC);
}

function isGameplayCurrency(value) {
  return GAMEPLAY_CURRENCY_KEYS.includes(normalizeCurrencyKey(value, ""));
}

module.exports = {
  CANONICAL_CURRENCY_KEY,
  CANONICAL_CURRENCY_META,
  GAMEPLAY_CURRENCY_KEYS,
  SETTLEMENT_TOKEN_SYMBOL,
  normalizeCurrencyKey,
  isGameplayCurrency
};
