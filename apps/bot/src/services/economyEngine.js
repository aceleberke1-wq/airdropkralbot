function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundReward(value) {
  return Math.max(0, Math.round(value));
}

function ln1p(value) {
  return Math.log(1 + Math.max(0, value));
}

function getDailyCap(config, kingdomTier) {
  const base = Number(config.loops?.meso?.daily_cap_base || 120);
  return Math.max(1, base + Number(kingdomTier || 0) * 20);
}

function getFatigue(config, dailyTasks, dailyCap) {
  const coeff = Number(config.economy?.sc?.fatigue_coeff || 0.18);
  const over = Math.max(0, Number(dailyTasks || 0) - Math.max(1, dailyCap));
  return 1 / (1 + (coeff * over) / Math.max(1, dailyCap));
}

function getTaskProbabilities(config, { difficulty, streak, risk }) {
  const target = Number(config.tasks?.target_success_micro || 0.78);
  const safeDifficulty = clamp(Number(difficulty || 0.4), 0, 1);
  const safeStreak = Math.max(0, Number(streak || 0));
  const safeRisk = clamp(Number(risk || 0), 0, 1);

  const pSuccess = clamp(target - safeDifficulty * 0.25 - safeRisk * 0.15 + Math.min(0.08, safeStreak * 0.01), 0.4, 0.93);
  const nearMissRate = Number(config.tasks?.near_miss_rate || 0.18);
  const pNearMiss = clamp(nearMissRate + (1 - pSuccess) * 0.12, 0.1, 0.3);
  const pFail = clamp(1 - pSuccess - pNearMiss, 0, 1);

  return { pSuccess, pNearMiss, pFail };
}

function rollTaskResult(probabilities, randomValue = Math.random()) {
  const roll = clamp(randomValue, 0, 1);
  if (roll < probabilities.pSuccess) {
    return { result: "success", roll };
  }
  if (roll < probabilities.pSuccess + probabilities.pNearMiss) {
    return { result: "near_miss", roll };
  }
  return { result: "fail", roll };
}

function getScBase(config, { difficulty, streak, kingdomTier, dailyTasks, risk }) {
  const sc = config.economy?.sc || {};
  const base = Number(sc.base || 1);
  const diffCoeff = Number(sc.diff_coeff || 0.8);
  const streakCoeff = Number(sc.streak_coeff || 0.12);
  const kingdomCoeff = Number(sc.kingdom_coeff || 0.05);
  const riskDampen = Number(sc.risk_dampen || 0.25);

  const dailyCap = getDailyCap(config, kingdomTier);
  const fatigue = getFatigue(config, dailyTasks, dailyCap);
  const safeDifficulty = clamp(Number(difficulty || 0.4), 0, 1);
  const safeStreak = Math.max(0, Number(streak || 0));
  const safeTier = Math.max(0, Number(kingdomTier || 0));
  const safeRisk = clamp(Number(risk || 0), 0, 1);

  const scValue =
    base *
    (1 + diffCoeff * (1 - safeDifficulty)) *
    (1 + streakCoeff * ln1p(safeStreak)) *
    (1 + kingdomCoeff * safeTier) *
    fatigue *
    (1 - riskDampen * safeRisk);

  return {
    scValue: Math.max(0, scValue),
    dailyCap,
    fatigue
  };
}

function getPityBonus(config, pityBefore) {
  const hc = config.economy?.hc || {};
  const pityCap = Math.max(1, Number(hc.pity_cap || 40));
  const p0 = Number(hc.p0 || 0.002);
  const pMax = Number(hc.p_max || 0.02);
  const progress = clamp(Number(pityBefore || 0) / pityCap, 0, 1);
  const bonus = progress * (pMax - p0) * 0.6;
  return { pityCap, bonus, progress };
}

function getHardCurrencyProbability(config, { streak, risk, pityBefore }) {
  const hc = config.economy?.hc || {};
  const p0 = Number(hc.p0 || 0.002);
  const pMin = Number(hc.p_min || 0.001);
  const pMax = Number(hc.p_max || 0.02);
  const streakCoeff = Number(hc.streak_coeff || 0.0015);
  const safeStreak = Math.max(0, Number(streak || 0));
  const safeRisk = clamp(Number(risk || 0), 0, 1);
  const pity = getPityBonus(config, pityBefore);

  const pHC = clamp(p0 + streakCoeff * ln1p(safeStreak) + pity.bonus - safeRisk * 0.005, pMin, pMax);
  return {
    pHC,
    pityCap: pity.pityCap,
    pityBonus: pity.bonus,
    pityProgress: pity.progress
  };
}

function getTierByRoll({ pHC, pityBefore, pityCap, randomValue }) {
  if (Number(pityBefore || 0) >= pityCap) {
    return { tier: "rare", forced: true };
  }

  const roll = clamp(randomValue, 0, 1);
  const legendaryChance = Math.min(0.08, pHC * 0.15);
  const rareChance = pHC;
  const uncommonChance = 0.2;

  if (roll < legendaryChance) {
    return { tier: "legendary", forced: false, roll };
  }
  if (roll < legendaryChance + rareChance) {
    return { tier: "rare", forced: false, roll };
  }
  if (roll < legendaryChance + rareChance + uncommonChance) {
    return { tier: "uncommon", forced: false, roll };
  }
  return { tier: "common", forced: false, roll };
}

function getRewardByTier(config, { tier, result, baseSc, risk }) {
  const softDampen = Number(config.anti_abuse?.risk_soft_dampen || 0.2);
  const dampen = clamp(1 - clamp(Number(risk || 0), 0, 1) * softDampen, 0.4, 1);
  let sc = baseSc;
  let hc = 0;
  let rc = 0;

  switch (tier) {
    case "legendary":
      sc = baseSc * 3;
      hc = 2;
      rc = 8;
      break;
    case "rare":
      sc = baseSc * 2;
      hc = 1;
      rc = 4;
      break;
    case "uncommon":
      sc = baseSc * 1.4;
      hc = 0;
      rc = 2;
      break;
    default:
      sc = baseSc;
      hc = 0;
      rc = 1;
      break;
  }

  if (result === "near_miss") {
    sc *= 0.55;
    rc = Math.max(1, Math.floor(rc / 2));
  } else if (result === "fail") {
    sc = Math.min(1, sc * 0.1);
    if (tier === "common" || tier === "uncommon") {
      hc = 0;
    }
    rc = 0;
  }

  return {
    sc: roundReward(sc * dampen),
    hc: roundReward(hc),
    rc: roundReward(rc * dampen),
    dampen
  };
}

function computeRevealOutcome(config, params) {
  const {
    attemptResult,
    difficulty,
    streak,
    kingdomTier,
    risk,
    dailyTasks,
    pityBefore,
    taskRoll = Math.random(),
    lootRoll = Math.random()
  } = params;

  const probabilities = getTaskProbabilities(config, { difficulty, streak, risk });
  const rolledTask = rollTaskResult(probabilities, taskRoll);
  const taskResult = attemptResult || rolledTask.result;
  const scBaseInfo = getScBase(config, { difficulty, streak, kingdomTier, dailyTasks, risk });
  const baseSc = Math.max(1, roundReward(scBaseInfo.scValue));
  const hardCurrency = getHardCurrencyProbability(config, { streak, risk, pityBefore });
  const tierResult = getTierByRoll({
    pHC: hardCurrency.pHC,
    pityBefore,
    pityCap: hardCurrency.pityCap,
    randomValue: lootRoll
  });
  const reward = getRewardByTier(config, {
    tier: tierResult.tier,
    result: taskResult,
    baseSc,
    risk
  });
  const gotRareOrBetter = tierResult.tier === "rare" || tierResult.tier === "legendary";

  return {
    taskResult,
    taskRoll: rolledTask.roll,
    probabilities,
    tier: tierResult.tier,
    forcedPity: Boolean(tierResult.forced),
    lootRoll: typeof tierResult.roll === "number" ? tierResult.roll : null,
    reward,
    pityAfter: gotRareOrBetter ? 0 : Number(pityBefore || 0) + 1,
    hardCurrency,
    dailyCap: scBaseInfo.dailyCap,
    fatigue: scBaseInfo.fatigue
  };
}

module.exports = {
  clamp,
  getDailyCap,
  getFatigue,
  getTaskProbabilities,
  rollTaskResult,
  getHardCurrencyProbability,
  computeRevealOutcome
};
