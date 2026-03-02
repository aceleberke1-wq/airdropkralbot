"use strict";

const COMMAND_ROLES = Object.freeze(["player", "admin", "superadmin"]);

function sanitizeWord(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function sanitizeIntent(value) {
  let out = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  const normalizers = [
    [/\u0131/g, "i"],
    [/\u011f/g, "g"],
    [/\u00fc/g, "u"],
    [/\u015f/g, "s"],
    [/\u00f6/g, "o"],
    [/\u00e7/g, "c"],
    [/Ä±/g, "i"],
    [/ÄŸ/g, "g"],
    [/Ã¼/g, "u"],
    [/ÅŸ/g, "s"],
    [/Ã¶/g, "o"],
    [/Ã§/g, "c"]
  ];
  for (const [matcher, replacement] of normalizers) {
    out = out.replace(matcher, replacement);
  }
  return out.replace(/[^a-z0-9_:+\-/. ]+/g, " ").replace(/\s+/g, " ").trim();
}

function uniqueStrings(items, normalizer) {
  const out = [];
  const seen = new Set();
  for (const item of Array.isArray(items) ? items : []) {
    const next = normalizer(item);
    if (!next || seen.has(next)) {
      continue;
    }
    out.push(next);
    seen.add(next);
  }
  return out;
}

function normalizeDisplayText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function buildFallbackIntents(key) {
  const phrase = String(key || "").replace(/_/g, " ").trim();
  if (!phrase) {
    return [];
  }
  if (phrase === key) {
    return [phrase];
  }
  return [phrase, String(key || "")];
}

function buildFallbackScenarios(key) {
  const normalized = sanitizeWord(key);
  if (!normalized) {
    return [];
  }
  return [`/${normalized}`];
}

function buildFallbackOutcomes(key, descriptionTr, descriptionEn) {
  const bestDescription = normalizeDisplayText(descriptionTr || descriptionEn);
  if (bestDescription) {
    return [bestDescription];
  }
  const fallback = normalizeDisplayText(String(key || "").replace(/_/g, " "));
  return fallback ? [`${fallback} panelini goster`] : [];
}

function normalizeCommandContract(entry) {
  const item = entry && typeof entry === "object" ? entry : {};
  const key = sanitizeWord(item.key);
  const adminOnly = Boolean(item.adminOnly);
  const minRoleRaw = sanitizeWord(item.min_role || item.minRole || (adminOnly ? "admin" : "player"));
  const min_role = COMMAND_ROLES.includes(minRoleRaw) ? minRoleRaw : adminOnly ? "admin" : "player";
  const handler = sanitizeWord(item.handler || key);
  const aliases = uniqueStrings(item.aliases, sanitizeWord).filter((alias) => alias && alias !== key);
  const description_tr = String(item.description_tr || item.descriptionTr || item.description || "").trim();
  const description_en = String(item.description_en || item.descriptionEn || item.description || "").trim();

  const intentSource = Array.isArray(item.intents) && item.intents.length > 0 ? item.intents : buildFallbackIntents(key);
  const scenarioSource =
    Array.isArray(item.scenarios) && item.scenarios.length > 0 ? item.scenarios : buildFallbackScenarios(key);
  const outcomeSource =
    Array.isArray(item.outcomes) && item.outcomes.length > 0
      ? item.outcomes
      : buildFallbackOutcomes(key, description_tr, description_en);

  const intents = uniqueStrings(intentSource, sanitizeIntent).slice(0, 12);
  const scenarios = uniqueStrings(scenarioSource, normalizeDisplayText).slice(0, 8);
  const outcomes = uniqueStrings(outcomeSource, normalizeDisplayText).slice(0, 8);
  const primary = Boolean(item.primary);
  return {
    key,
    aliases,
    description_tr,
    description_en,
    intents,
    scenarios,
    outcomes,
    adminOnly: adminOnly || min_role !== "player",
    min_role,
    handler,
    primary
  };
}

function normalizeCommandRegistry(entries) {
  const out = [];
  const seen = new Set();
  for (const entry of Array.isArray(entries) ? entries : []) {
    const contract = normalizeCommandContract(entry);
    if (!contract.key || seen.has(contract.key)) {
      continue;
    }
    out.push(contract);
    seen.add(contract.key);
  }
  return out;
}

function validateCommandRegistry(entries) {
  const errors = [];
  const registry = normalizeCommandRegistry(entries);
  const keys = new Set(registry.map((item) => item.key));
  const aliasOwners = new Map();

  for (const item of registry) {
    if (!item.description_tr && !item.description_en) {
      errors.push(`missing_description:${item.key}`);
    }
    if (!item.handler) {
      errors.push(`missing_handler:${item.key}`);
    }
    if (!Array.isArray(item.intents) || item.intents.length === 0) {
      errors.push(`missing_intents:${item.key}`);
    }
    if (!Array.isArray(item.scenarios) || item.scenarios.length === 0) {
      errors.push(`missing_scenarios:${item.key}`);
    }
    if (!Array.isArray(item.outcomes) || item.outcomes.length === 0) {
      errors.push(`missing_outcomes:${item.key}`);
    }
    if (!COMMAND_ROLES.includes(item.min_role)) {
      errors.push(`invalid_role:${item.key}:${item.min_role}`);
    }
    for (const alias of item.aliases) {
      if (keys.has(alias)) {
        errors.push(`alias_conflicts_with_key:${alias}`);
      }
      const owner = aliasOwners.get(alias);
      if (owner && owner !== item.key) {
        errors.push(`alias_conflict:${alias}:${owner}:${item.key}`);
      } else {
        aliasOwners.set(alias, item.key);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    registry
  };
}

function buildHandlerTable(registryEntries, handlers) {
  const table = new Map();
  const handlerSource = handlers && typeof handlers === "object" ? handlers : {};
  const { registry } = validateCommandRegistry(registryEntries);
  for (const item of registry) {
    const fn = handlerSource[item.handler];
    if (typeof fn === "function") {
      table.set(item.key, fn);
    }
  }
  return table;
}

module.exports = {
  COMMAND_ROLES,
  normalizeCommandContract,
  normalizeCommandRegistry,
  validateCommandRegistry,
  buildHandlerTable
};
