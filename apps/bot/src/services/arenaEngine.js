const { clamp } = require("./economyEngine");

const RAID_MODES = {
  safe: {
    key: "safe",
    label: "Temkinli",
    rewardMultiplier: 0.85,
    deltaMultiplier: 0.82,
    hcMultiplier: 0.75,
    enemyMin: 0.78,
    enemyMax: 1.06
  },
  balanced: {
    key: "balanced",
    label: "Dengeli",
    rewardMultiplier: 1,
    deltaMultiplier: 1,
    hcMultiplier: 1,
    enemyMin: 0.9,
    enemyMax: 1.12
  },
  aggressive: {
    key: "aggressive",
    label: "Saldirgan",
    rewardMultiplier: 1.27,
    deltaMultiplier: 1.25,
    hcMultiplier: 1.5,
    enemyMin: 0.98,
    enemyMax: 1.22
  }
};

function ln1p(value) {
  return Math.log(1 + Math.max(0, Number(value || 0)));
}

function roundReward(value) {
  return Math.max(0, Math.round(Number(value || 0)));
}

function getRaidMode(modeRaw) {
  const key = String(modeRaw || "balanced").toLowerCase();
  return RAID_MODES[key] || RAID_MODES.balanced;
}

function getArenaConfig(config) {
  const arena = config?.arena || {};
  return {
    ticketCostRc: Math.max(1, Number(arena.ticket_cost_rc || 1)),
    cooldownSec: Math.max(0, Number(arena.cooldown_sec || 20)),
    baseRating: Math.max(100, Number(arena.base_rating || 1000)),
    rewardBaseSc: Math.max(1, Number(arena.rewards?.base_sc || 3)),
    rewardBaseRc: Math.max(0, Number(arena.rewards?.base_rc || 1)),
    hcWinChance: clamp(Number(arena.rewards?.hc_win_chance || 0.02), 0.001, 0.08),
    rankWin: Math.max(1, Number(arena.rank_delta?.win || 22)),
    rankNear: Math.max(-8, Number(arena.rank_delta?.near || 6)),
    rankLoss: Math.min(-1, Number(arena.rank_delta?.loss || -14))
  };
}

function computePlayerPower({
  kingdomTier,
  streak,
  reputation,
  rating,
  risk,
  randomJitter = Math.random()
}) {
  const tier = Math.max(0, Number(kingdomTier || 0));
  const safeStreak = Math.max(0, Number(streak || 0));
  const rep = Math.max(0, Number(reputation || 0));
  const safeRating = Math.max(100, Number(rating || 1000));
  const safeRisk = clamp(Number(risk || 0), 0, 1);
  const jitter = (clamp(randomJitter, 0, 1) - 0.5) * 18;

  const power =
    118 +
    tier * 34 +
    ln1p(safeStreak) * 14 +
    ln1p(rep / 120) * 18 +
    (safeRating - 1000) * 0.065 -
    safeRisk * 12 +
    jitter;
  return Math.max(30, power);
}

function computeEnemyPower(playerPower, mode, randomEnemy = Math.random()) {
  const modeSpec = mode || RAID_MODES.balanced;
  const factor = modeSpec.enemyMin + (modeSpec.enemyMax - modeSpec.enemyMin) * clamp(randomEnemy, 0, 1);
  return Math.max(25, playerPower * factor);
}

function computeWinProbability(playerPower, enemyPower, risk) {
  const delta = Number(playerPower || 0) - Number(enemyPower || 0);
  const safeRisk = clamp(Number(risk || 0), 0, 1);
  return clamp(0.5 + delta / 220 - safeRisk * 0.14, 0.12, 0.9);
}

function resolveOutcome({ winProbability, randomRoll = Math.random() }) {
  const pWin = clamp(Number(winProbability || 0.5), 0.12, 0.9);
  const pNear = clamp(0.14 + (1 - pWin) * 0.22, 0.08, 0.34);
  const roll = clamp(randomRoll, 0, 1);
  if (roll < pWin) {
    return { outcome: "win", roll, pWin, pNear };
  }
  if (roll < pWin + pNear) {
    return { outcome: "near", roll, pWin, pNear };
  }
  return { outcome: "loss", roll, pWin, pNear };
}

function computeReward({ config, mode, outcome, kingdomTier, streak, rating, risk, randomHc = Math.random() }) {
  const arena = getArenaConfig(config);
  const modeSpec = mode || RAID_MODES.balanced;
  const tier = Math.max(0, Number(kingdomTier || 0));
  const safeStreak = Math.max(0, Number(streak || 0));
  const safeRating = Math.max(100, Number(rating || 1000));
  const safeRisk = clamp(Number(risk || 0), 0, 1);
  const riskDampen = clamp(1 - safeRisk * Number(config?.economy?.sc?.risk_dampen || 0.25), 0.4, 1);
  const streakBoost = 1 + Math.min(0.32, ln1p(safeStreak) * 0.11);
  const tierBoost = 1 + tier * 0.06;
  const ratingBoost = 1 + Math.max(0, safeRating - 1000) / 5000;
  const baseSc = arena.rewardBaseSc * streakBoost * tierBoost * ratingBoost * modeSpec.rewardMultiplier * riskDampen;
  const baseRc = arena.rewardBaseRc * (1 + tier * 0.08) * modeSpec.rewardMultiplier * riskDampen;

  let sc = baseSc;
  let rc = baseRc;
  if (outcome === "near") {
    sc *= 0.48;
    rc = Math.max(1, Math.round(rc * 0.65));
  } else if (outcome === "loss") {
    sc = Math.min(1, sc * 0.12);
    rc = 0;
  }

  let hc = 0;
  const hcChance = clamp(arena.hcWinChance * modeSpec.hcMultiplier + ln1p(safeStreak) * 0.001 - safeRisk * 0.008, 0.001, 0.08);
  if (outcome === "win" && clamp(randomHc, 0, 1) < hcChance) {
    hc = 1;
  }

  return {
    reward: {
      sc: roundReward(sc),
      hc,
      rc: roundReward(rc)
    },
    hcChance
  };
}

function computeRatingDelta({ config, mode, outcome, playerPower, enemyPower }) {
  const arena = getArenaConfig(config);
  const modeSpec = mode || RAID_MODES.balanced;
  const ratioBoost = clamp((enemyPower - playerPower) / 24, -8, 10);
  let delta;
  if (outcome === "win") {
    delta = arena.rankWin + ratioBoost;
  } else if (outcome === "near") {
    delta = arena.rankNear + ratioBoost * 0.3;
  } else {
    delta = arena.rankLoss + ratioBoost * 0.4;
  }
  return Math.round(delta * modeSpec.deltaMultiplier);
}

function simulateRaid(config, input = {}, randoms = {}) {
  const mode = getRaidMode(input.mode);
  const risk = clamp(Number(input.risk || 0), 0, 1);
  const playerPower = computePlayerPower({
    kingdomTier: input.kingdomTier,
    streak: input.streak,
    reputation: input.reputation,
    rating: input.rating,
    risk,
    randomJitter: typeof randoms.jitter === "number" ? randoms.jitter : Math.random()
  });
  const enemyPower = computeEnemyPower(playerPower, mode, typeof randoms.enemy === "number" ? randoms.enemy : Math.random());
  const winProbability = computeWinProbability(playerPower, enemyPower, risk);
  const outcomeRoll = resolveOutcome({
    winProbability,
    randomRoll: typeof randoms.outcome === "number" ? randoms.outcome : Math.random()
  });
  const rewardInfo = computeReward({
    config,
    mode,
    outcome: outcomeRoll.outcome,
    kingdomTier: input.kingdomTier,
    streak: input.streak,
    rating: input.rating,
    risk,
    randomHc: typeof randoms.hc === "number" ? randoms.hc : Math.random()
  });
  const ratingDelta = computeRatingDelta({
    config,
    mode,
    outcome: outcomeRoll.outcome,
    playerPower,
    enemyPower
  });

  return {
    mode,
    outcome: outcomeRoll.outcome,
    roll: outcomeRoll.roll,
    probabilities: {
      win: outcomeRoll.pWin,
      near: outcomeRoll.pNear,
      loss: clamp(1 - outcomeRoll.pWin - outcomeRoll.pNear, 0, 1)
    },
    playerPower: Number(playerPower.toFixed(3)),
    enemyPower: Number(enemyPower.toFixed(3)),
    reward: rewardInfo.reward,
    hcChance: rewardInfo.hcChance,
    ratingDelta
  };
}

module.exports = {
  getRaidMode,
  getArenaConfig,
  simulateRaid
};
