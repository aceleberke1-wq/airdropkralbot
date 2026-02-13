const crypto = require("crypto");

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

const DEFAULT_ANOMALIES = [
  {
    id: "quantum_echo",
    title: "Quantum Echo",
    subtitle: "Drop amplification",
    description: "SC akisi yukselir, risk hafif duser.",
    sc_multiplier: 1.18,
    rc_multiplier: 1.0,
    hc_multiplier: 1.0,
    season_multiplier: 1.03,
    risk_shift: -0.05,
    preferred_mode: "aggressive"
  },
  {
    id: "war_fog",
    title: "War Fog",
    subtitle: "Control pressure",
    description: "RC agirlikli dongu, risk yukselir.",
    sc_multiplier: 0.9,
    rc_multiplier: 1.35,
    hc_multiplier: 1.0,
    season_multiplier: 1.08,
    risk_shift: 0.09,
    preferred_mode: "safe"
  },
  {
    id: "stability_window",
    title: "Stability Window",
    subtitle: "Balanced uptime",
    description: "Tum oduller dengelenir, risk azalir.",
    sc_multiplier: 1.05,
    rc_multiplier: 1.07,
    hc_multiplier: 1.0,
    season_multiplier: 1.02,
    risk_shift: -0.08,
    preferred_mode: "balanced"
  },
  {
    id: "flux_storm",
    title: "Flux Storm",
    subtitle: "High variance",
    description: "HC ihtimali artar, risk yukselir.",
    sc_multiplier: 1.0,
    rc_multiplier: 1.0,
    hc_multiplier: 1.25,
    season_multiplier: 1.06,
    risk_shift: 0.12,
    preferred_mode: "aggressive"
  },
  {
    id: "relic_bloom",
    title: "Relic Bloom",
    subtitle: "Season push",
    description: "SP basinci artar, RC guclenir.",
    sc_multiplier: 0.95,
    rc_multiplier: 1.22,
    hc_multiplier: 1.0,
    season_multiplier: 1.12,
    risk_shift: 0.02,
    preferred_mode: "balanced"
  }
];

function sanitizeAnomaly(raw, fallbackIndex) {
  const source = raw && typeof raw === "object" ? raw : {};
  const id = String(source.id || `anomaly_${fallbackIndex}`).toLowerCase();
  const title = String(source.title || id).slice(0, 64);
  const subtitle = String(source.subtitle || "Nexus pulse").slice(0, 64);
  const description = String(source.description || "").slice(0, 240);
  const preferredMode = ["safe", "balanced", "aggressive"].includes(String(source.preferred_mode || "").toLowerCase())
    ? String(source.preferred_mode).toLowerCase()
    : "balanced";

  return {
    id,
    title,
    subtitle,
    description,
    sc_multiplier: clamp(source.sc_multiplier ?? 1, 0.5, 2),
    rc_multiplier: clamp(source.rc_multiplier ?? 1, 0.5, 2),
    hc_multiplier: clamp(source.hc_multiplier ?? 1, 0.5, 2),
    season_multiplier: clamp(source.season_multiplier ?? 1, 0.7, 2),
    risk_shift: clamp(source.risk_shift ?? 0, -0.25, 0.25),
    preferred_mode: preferredMode
  };
}

function getAnomalyCatalog(config) {
  const raw = config?.events?.anomalies;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((item, index) => sanitizeAnomaly(item, index)).filter(Boolean);
  }
  return DEFAULT_ANOMALIES.map((item, index) => sanitizeAnomaly(item, index));
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

function resolveDailyAnomaly(config, options = {}) {
  const seasonId = Number(options.seasonId || 0);
  const dateKey = toDateKey(options.nowMs || Date.now());
  const catalog = getAnomalyCatalog(config);
  const index = getSeedIndex(`${seasonId}:${dateKey}`, catalog.length);
  const anomaly = catalog[index] || catalog[0];
  const pressure = clamp(
    0.5 + anomaly.risk_shift * 1.8 + (anomaly.sc_multiplier - 1) * 0.35 + (anomaly.rc_multiplier - 1) * 0.25,
    0.1,
    0.95
  );
  return {
    ...anomaly,
    date_key: dateKey,
    season_id: seasonId,
    pressure
  };
}

function applyRiskShift(riskScore, anomaly) {
  return clamp(Number(riskScore || 0) + Number(anomaly?.risk_shift || 0), 0, 1);
}

function applyAnomalyToReward(reward, anomaly, options = {}) {
  const base = {
    sc: Math.max(0, Number(reward?.sc || 0)),
    hc: Math.max(0, Number(reward?.hc || 0)),
    rc: Math.max(0, Number(reward?.rc || 0))
  };
  const modeKey = String(options.modeKey || "balanced").toLowerCase();
  const modeBonus = modeKey === String(anomaly?.preferred_mode || "balanced") ? 1.07 : 1;
  const sc = Math.max(0, Math.round(base.sc * Number(anomaly?.sc_multiplier || 1) * modeBonus));
  const rc = Math.max(0, Math.round(base.rc * Number(anomaly?.rc_multiplier || 1) * modeBonus));
  const hc = Math.max(0, Math.round(base.hc * Number(anomaly?.hc_multiplier || 1)));
  return {
    reward: { sc, hc, rc },
    modifiers: {
      sc_multiplier: Number(anomaly?.sc_multiplier || 1),
      rc_multiplier: Number(anomaly?.rc_multiplier || 1),
      hc_multiplier: Number(anomaly?.hc_multiplier || 1),
      preferred_mode_bonus: modeBonus
    }
  };
}

function publicAnomalyView(anomaly) {
  if (!anomaly) {
    return null;
  }
  return {
    id: anomaly.id,
    title: anomaly.title,
    subtitle: anomaly.subtitle,
    description: anomaly.description,
    preferred_mode: anomaly.preferred_mode,
    pressure_pct: Math.round(Number(anomaly.pressure || 0) * 100),
    risk_shift_pct: Math.round(Number(anomaly.risk_shift || 0) * 100),
    sc_multiplier: Number(anomaly.sc_multiplier || 1),
    rc_multiplier: Number(anomaly.rc_multiplier || 1),
    hc_multiplier: Number(anomaly.hc_multiplier || 1),
    season_multiplier: Number(anomaly.season_multiplier || 1),
    date_key: anomaly.date_key,
    season_id: anomaly.season_id
  };
}

module.exports = {
  resolveDailyAnomaly,
  applyRiskShift,
  applyAnomalyToReward,
  publicAnomalyView
};
