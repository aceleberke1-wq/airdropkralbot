const crypto = require("crypto");

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

const DEFAULT_CONTRACTS = [
  {
    id: "overclock_chain",
    title: "Overclock Chain",
    subtitle: "Hiz + combo odakli",
    objective: "COMBO ve RUSH ailelerinde agresif cikislar",
    required_mode: "aggressive",
    focus_families: ["combo", "rush", "micro"],
    require_result: "success",
    sc_multiplier: 1.12,
    rc_flat_bonus: 1,
    season_bonus: 2,
    war_bonus: 1
  },
  {
    id: "shield_protocol",
    title: "Shield Protocol",
    subtitle: "Temkinli stabil kazanc",
    objective: "TIMER ve WAR akisini kayipsiz ilerlet",
    required_mode: "safe",
    focus_families: ["timer", "war", "social"],
    require_result: "success_or_near",
    sc_multiplier: 1.05,
    rc_flat_bonus: 2,
    season_bonus: 3,
    war_bonus: 2
  },
  {
    id: "balance_grid",
    title: "Balance Grid",
    subtitle: "Dengeli throughput",
    objective: "INTEL, MICRO ve SPONSOR gorevlerinde dengeli performans",
    required_mode: "balanced",
    focus_families: ["intel", "micro", "sponsor"],
    require_result: "success_or_near",
    sc_multiplier: 1.08,
    rc_flat_bonus: 1,
    season_bonus: 2,
    war_bonus: 1
  },
  {
    id: "boss_window",
    title: "Boss Window",
    subtitle: "Yuksek risk yuksek tavan",
    objective: "BOSS ve HEIST gorevlerinde agresif zafer",
    required_mode: "aggressive",
    focus_families: ["boss", "heist", "risk"],
    require_result: "success",
    sc_multiplier: 1.15,
    rc_flat_bonus: 2,
    season_bonus: 4,
    war_bonus: 2
  },
  {
    id: "war_fabric",
    title: "War Fabric",
    subtitle: "Topluluk havuzu baskisi",
    objective: "WAR gorevleriyle havuza ivme ver",
    required_mode: "balanced",
    focus_families: ["war", "social", "timer"],
    require_result: "success_or_near",
    sc_multiplier: 1.04,
    rc_flat_bonus: 3,
    season_bonus: 3,
    war_bonus: 3
  }
];

function sanitizeMode(input) {
  const mode = String(input || "").toLowerCase();
  if (["safe", "balanced", "aggressive"].includes(mode)) {
    return mode;
  }
  return "balanced";
}

function sanitizeContract(raw, fallbackIndex) {
  const source = raw && typeof raw === "object" ? raw : {};
  const id = String(source.id || `contract_${fallbackIndex}`).toLowerCase();
  const title = String(source.title || id).slice(0, 64);
  const subtitle = String(source.subtitle || "Nexus contract").slice(0, 80);
  const objective = String(source.objective || "Gunluk kontrat").slice(0, 180);
  const requiredMode = sanitizeMode(source.required_mode);
  const requireResultRaw = String(source.require_result || "success_or_near").toLowerCase();
  const requireResult = ["success", "success_or_near", "any"].includes(requireResultRaw)
    ? requireResultRaw
    : "success_or_near";
  const families = Array.isArray(source.focus_families)
    ? source.focus_families
        .map((entry) => String(entry || "").toLowerCase().trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];

  return {
    id,
    title,
    subtitle,
    objective,
    required_mode: requiredMode,
    require_result: requireResult,
    focus_families: families,
    sc_multiplier: clamp(source.sc_multiplier ?? 1, 1, 1.5),
    rc_flat_bonus: Math.max(0, Math.round(Number(source.rc_flat_bonus ?? 0))),
    season_bonus: Math.max(0, Math.round(Number(source.season_bonus ?? 0))),
    war_bonus: Math.max(0, Math.round(Number(source.war_bonus ?? 0)))
  };
}

function getCatalog(config) {
  const raw = config?.events?.contracts;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((item, index) => sanitizeContract(item, index));
  }
  return DEFAULT_CONTRACTS.map((item, index) => sanitizeContract(item, index));
}

function toDateKey(nowMs = Date.now()) {
  return new Date(nowMs).toISOString().slice(0, 10);
}

function getSeedIndex(seedInput, length) {
  const hash = crypto.createHash("sha1").update(String(seedInput)).digest("hex").slice(0, 8);
  const parsed = parseInt(hash, 16);
  if (!Number.isFinite(parsed) || length <= 0) {
    return 0;
  }
  return parsed % length;
}

function resolveDailyContract(config, options = {}) {
  const seasonId = Number(options.seasonId || 0);
  const dateKey = toDateKey(options.nowMs || Date.now());
  const anomalyId = String(options.anomalyId || "none");
  const catalog = getCatalog(config);
  const index = getSeedIndex(`${seasonId}:${dateKey}:${anomalyId}`, catalog.length);
  const contract = catalog[index] || catalog[0];
  return {
    ...contract,
    date_key: dateKey,
    season_id: seasonId
  };
}

function evaluateAttempt(contract, context = {}) {
  const modeKey = sanitizeMode(context.modeKey || "balanced");
  const family = String(context.family || "").toLowerCase();
  const result = String(context.result || "fail").toLowerCase();
  const combo = Math.max(0, Number(context.combo || 0));

  const modeMatch = modeKey === sanitizeMode(contract?.required_mode || "balanced");
  const familyMatch =
    !Array.isArray(contract?.focus_families) ||
    contract.focus_families.length === 0 ||
    contract.focus_families.includes(family);
  const resultRule = String(contract?.require_result || "success_or_near");
  const resultMatch =
    resultRule === "any" ||
    (resultRule === "success" && result === "success") ||
    (resultRule === "success_or_near" && (result === "success" || result === "near_miss"));

  const matched = modeMatch && familyMatch && resultMatch;
  const comboBoost = matched ? 1 + Math.min(0.1, combo * 0.015) : 1;
  const scMultiplier = matched ? Number(contract?.sc_multiplier || 1) * comboBoost : 1;

  return {
    matched,
    mode_match: modeMatch,
    family_match: familyMatch,
    result_match: resultMatch,
    family,
    mode_key: modeKey,
    combo,
    sc_multiplier: Number(scMultiplier.toFixed(4)),
    rc_flat_bonus: matched ? Math.max(0, Number(contract?.rc_flat_bonus || 0)) : 0,
    season_bonus: matched ? Math.max(0, Number(contract?.season_bonus || 0)) : 0,
    war_bonus: matched ? Math.max(0, Number(contract?.war_bonus || 0)) : 0
  };
}

function applyContractToReward(reward, evaluation) {
  const base = {
    sc: Math.max(0, Number(reward?.sc || 0)),
    hc: Math.max(0, Number(reward?.hc || 0)),
    rc: Math.max(0, Number(reward?.rc || 0))
  };
  const sc = Math.max(0, Math.round(base.sc * Number(evaluation?.sc_multiplier || 1)));
  const rc = Math.max(0, Math.round(base.rc + Number(evaluation?.rc_flat_bonus || 0)));
  return {
    reward: { sc, hc: base.hc, rc },
    modifiers: {
      sc_multiplier: Number(evaluation?.sc_multiplier || 1),
      rc_flat_bonus: Number(evaluation?.rc_flat_bonus || 0),
      season_bonus: Number(evaluation?.season_bonus || 0),
      war_bonus: Number(evaluation?.war_bonus || 0)
    }
  };
}

function publicContractView(contract, evaluation = null) {
  if (!contract) {
    return null;
  }
  return {
    id: contract.id,
    title: contract.title,
    subtitle: contract.subtitle,
    objective: contract.objective,
    required_mode: contract.required_mode,
    focus_families: Array.isArray(contract.focus_families) ? contract.focus_families.slice(0, 6) : [],
    require_result: contract.require_result,
    sc_multiplier: Number(contract.sc_multiplier || 1),
    rc_flat_bonus: Number(contract.rc_flat_bonus || 0),
    season_bonus: Number(contract.season_bonus || 0),
    war_bonus: Number(contract.war_bonus || 0),
    date_key: contract.date_key,
    season_id: contract.season_id,
    match: evaluation
      ? {
          matched: Boolean(evaluation.matched),
          mode_match: Boolean(evaluation.mode_match),
          family_match: Boolean(evaluation.family_match),
          result_match: Boolean(evaluation.result_match),
          sc_multiplier: Number(evaluation.sc_multiplier || 1),
          rc_flat_bonus: Number(evaluation.rc_flat_bonus || 0),
          season_bonus: Number(evaluation.season_bonus || 0),
          war_bonus: Number(evaluation.war_bonus || 0)
        }
      : null
  };
}

module.exports = {
  resolveDailyContract,
  evaluateAttempt,
  applyContractToReward,
  publicContractView
};
