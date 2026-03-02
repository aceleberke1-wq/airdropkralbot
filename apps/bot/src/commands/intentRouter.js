const { buildAliasLookup, getCommandRegistry } = require("./registry");

const MODE_ALIASES = Object.freeze({
  safe: "safe",
  temkinli: "safe",
  s: "safe",
  "1": "safe",
  balanced: "balanced",
  dengeli: "balanced",
  b: "balanced",
  "2": "balanced",
  aggressive: "aggressive",
  saldirgan: "aggressive",
  a: "aggressive",
  "3": "aggressive"
});

function normalizeIntentText(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/[ı]/g, "i")
    .replace(/[ğ]/g, "g")
    .replace(/[ü]/g, "u")
    .replace(/[ş]/g, "s")
    .replace(/[ö]/g, "o")
    .replace(/[ç]/g, "c")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMode(rawValue) {
  const key = String(rawValue || "").trim().toLowerCase();
  return MODE_ALIASES[key] || "balanced";
}

function extractModeFromText(text) {
  const tokens = normalizeIntentText(text)
    .split(" ")
    .filter(Boolean);
  for (const token of tokens) {
    if (Object.prototype.hasOwnProperty.call(MODE_ALIASES, token)) {
      return MODE_ALIASES[token];
    }
  }
  return "balanced";
}

function buildIntentIndex(registryInput) {
  const registry = Array.isArray(registryInput) ? registryInput : getCommandRegistry();
  const aliasLookup = buildAliasLookup(registry);
  const phraseMap = new Map();
  const singleTokenPhrases = new Map();
  for (const item of registry) {
    if (!item || !item.key) {
      continue;
    }
    phraseMap.set(String(item.key).toLowerCase(), item.key);
    singleTokenPhrases.set(String(item.key).toLowerCase(), item.key);
    for (const alias of item.aliases || []) {
      const normalizedAlias = String(alias || "").toLowerCase();
      phraseMap.set(normalizedAlias, item.key);
      if (normalizedAlias && !normalizedAlias.includes(" ")) {
        singleTokenPhrases.set(normalizedAlias, item.key);
      }
    }
    for (const phrase of item.intents || []) {
      const normalizedPhrase = normalizeIntentText(phrase);
      if (normalizedPhrase) {
        phraseMap.set(normalizedPhrase, item.key);
        if (!normalizedPhrase.includes(" ")) {
          singleTokenPhrases.set(normalizedPhrase, item.key);
        }
      }
    }
  }
  return {
    registry,
    aliasLookup,
    phraseMap,
    singleTokenPhrases
  };
}

function editDistanceWithinLimit(a, b, limit = 1) {
  const left = String(a || "");
  const right = String(b || "");
  if (!left || !right) {
    return false;
  }
  if (Math.abs(left.length - right.length) > limit) {
    return false;
  }
  let mismatches = 0;
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      i += 1;
      j += 1;
      continue;
    }
    mismatches += 1;
    if (mismatches > limit) {
      return false;
    }
    if (left.length > right.length) {
      i += 1;
    } else if (left.length < right.length) {
      j += 1;
    } else {
      i += 1;
      j += 1;
    }
  }
  mismatches += (left.length - i) + (right.length - j);
  return mismatches <= limit;
}

function resolveIntent(input, intentIndexInput) {
  const normalized = normalizeIntentText(input);
  if (!normalized || normalized.startsWith("/")) {
    return null;
  }
  const index = intentIndexInput && intentIndexInput.phraseMap ? intentIndexInput : buildIntentIndex();
  const tokens = normalized.split(" ").filter(Boolean);

  for (let width = Math.min(4, tokens.length); width >= 1; width -= 1) {
    for (let start = 0; start <= tokens.length - width; start += 1) {
      const phrase = tokens.slice(start, start + width).join(" ");
      const commandKey = index.phraseMap.get(phrase);
      if (!commandKey) {
        continue;
      }
      const argsText = tokens.slice(start + width).join(" ").trim();
      const mode = start > 0 ? extractModeFromText(normalized) : extractModeFromText(argsText);
      return {
        commandKey,
        argsText,
        mode
      };
    }
  }

  for (let idx = 0; idx < tokens.length; idx += 1) {
    const token = tokens[idx];
    if (!token) {
      continue;
    }
    if (index.aliasLookup.has(token)) {
      const commandKey = index.aliasLookup.get(token);
      const argsText = tokens.slice(idx + 1).join(" ").trim();
      const mode = idx > 0 ? extractModeFromText(normalized) : extractModeFromText(argsText);
      return {
        commandKey,
        argsText,
        mode
      };
    }
  }

  for (let idx = 0; idx < tokens.length; idx += 1) {
    const token = tokens[idx];
    if (!token || !index.singleTokenPhrases || token.length < 4) {
      continue;
    }
    for (const [phrase, commandKey] of index.singleTokenPhrases.entries()) {
      if (editDistanceWithinLimit(token, phrase, 1)) {
        const argsText = tokens.slice(idx + 1).join(" ").trim();
        const mode = idx > 0 ? extractModeFromText(normalized) : extractModeFromText(argsText);
        return {
          commandKey,
          argsText,
          mode
        };
      }
    }
  }

  return null;
}

module.exports = {
  normalizeIntentText,
  normalizeMode,
  extractModeFromText,
  buildIntentIndex,
  resolveIntent
};

