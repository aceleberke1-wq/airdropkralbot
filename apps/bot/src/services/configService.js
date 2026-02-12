const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const CACHE_TTL_MS = 60000;
const ECONOMY_CONFIG_KEY = "economy_params";
const ECONOMY_CONFIG_PATH = path.join(process.cwd(), "config", "economy_params.yaml");

let cached = null;
let cachedAt = 0;
let cachedSource = "none";

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function readYamlFile() {
  const raw = fs.readFileSync(ECONOMY_CONFIG_PATH, "utf8");
  const parsed = yaml.load(raw);
  if (!isObject(parsed)) {
    throw new Error("Invalid economy_params.yaml format");
  }
  return parsed;
}

function validateConfig(config) {
  if (!isObject(config.loops) || !isObject(config.economy) || !isObject(config.tasks) || !isObject(config.anti_abuse)) {
    throw new Error("Economy config missing required sections");
  }
  return config;
}

async function loadFromDb(db) {
  if (!db) {
    return null;
  }
  let result;
  try {
    result = await db.query(
      `SELECT version, config_json
       FROM config_versions
       WHERE config_key = $1
       ORDER BY version DESC, created_at DESC
       LIMIT 1;`,
      [ECONOMY_CONFIG_KEY]
    );
  } catch (err) {
    if (err.code === "42P01") {
      return null;
    }
    throw err;
  }

  const row = result.rows[0];
  if (!row || !isObject(row.config_json)) {
    return null;
  }
  return validateConfig(row.config_json);
}

async function getEconomyConfig(db, opts = {}) {
  const now = Date.now();
  const forceRefresh = opts.forceRefresh === true;
  if (!forceRefresh && cached && now - cachedAt < CACHE_TTL_MS) {
    return cached;
  }

  let config = null;
  let source = "file";
  try {
    config = await loadFromDb(db);
    if (config) {
      source = "db";
    }
  } catch (err) {
    console.warn("Config DB lookup failed, falling back to YAML", err.message);
  }

  if (!config) {
    config = validateConfig(readYamlFile());
  }

  cached = config;
  cachedAt = now;
  cachedSource = source;
  return config;
}

function getConfigCacheStatus() {
  return {
    source: cachedSource,
    cachedAt,
    ttlMs: CACHE_TTL_MS
  };
}

module.exports = {
  getEconomyConfig,
  getConfigCacheStatus,
  ECONOMY_CONFIG_KEY
};
