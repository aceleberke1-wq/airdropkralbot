const crypto = require("crypto");
const arenaStore = require("../stores/arenaStore");
const economyStore = require("../stores/economyStore");
const riskStore = require("../stores/riskStore");
const shopStore = require("../stores/shopStore");
const seasonStore = require("../stores/seasonStore");
const globalStore = require("../stores/globalStore");
const userStore = require("../stores/userStore");
const antiAbuseEngine = require("./antiAbuseEngine");
const arenaEngine = require("./arenaEngine");
const nexusEventEngine = require("./nexusEventEngine");

function deterministicUuid(input) {
  const hex = crypto.createHash("sha1").update(String(input)).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex
    .slice(16, 20)
    .join("")}-${hex.slice(20, 32).join("")}`;
}

function buildRunNonce(userId, requestId) {
  if (requestId) {
    return deterministicUuid(`arena:${userId}:${requestId}`);
  }
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return deterministicUuid(`arena:${userId}:${Date.now()}:${Math.random()}`);
}

function summarizeRun(run) {
  return {
    id: Number(run.id || 0),
    mode: run.mode,
    outcome: run.outcome,
    rating_delta: Number(run.rating_delta || 0),
    rating_after: Number(run.rating_after || 0),
    reward: {
      sc: Number(run.reward_sc || 0),
      hc: Number(run.reward_hc || 0),
      rc: Number(run.reward_rc || 0)
    },
    created_at: run.created_at
  };
}

async function runArenaRaid(db, { profile, config, modeKey, requestId, source }) {
  const mode = arenaEngine.getRaidMode(modeKey);
  const arenaConfig = arenaEngine.getArenaConfig(config);
  const runNonce = buildRunNonce(profile.user_id, requestId);
  const existing = await arenaStore.getRunByNonce(db, runNonce);
  if (existing) {
    return {
      ok: true,
      duplicate: true,
      run: summarizeRun(existing),
      mode: arenaEngine.getRaidMode(existing.mode)
    };
  }

  const state = await arenaStore.getArenaState(db, profile.user_id, arenaConfig.baseRating);
  const now = Date.now();
  const lastPlay = state?.last_play_at ? new Date(state.last_play_at).getTime() : 0;
  const cooldownMs = Math.max(0, arenaConfig.cooldownSec) * 1000;
  if (cooldownMs > 0 && lastPlay && now - lastPlay < cooldownMs) {
    return {
      ok: false,
      error: "arena_cooldown",
      cooldown_sec_left: Math.ceil((cooldownMs - (now - lastPlay)) / 1000)
    };
  }

  const debit = await economyStore.debitCurrency(db, {
    userId: profile.user_id,
    currency: "RC",
    amount: arenaConfig.ticketCostRc,
    reason: "arena_ticket_spend",
    refEventId: deterministicUuid(`arena_ticket:${runNonce}:RC`),
    meta: {
      mode: mode.key,
      source: source || "bot",
      run_nonce: runNonce
    }
  });
  if (!debit.applied) {
    return {
      ok: false,
      error: debit.reason === "insufficient_balance" ? "insufficient_rc" : debit.reason || "arena_ticket_error"
    };
  }

  const riskState = await riskStore.getRiskState(db, profile.user_id);
  const season = seasonStore.getSeasonInfo(config);
  const anomaly = nexusEventEngine.resolveDailyAnomaly(config, {
    seasonId: season.seasonId
  });
  const adjustedRisk = nexusEventEngine.applyRiskShift(Number(riskState.riskScore || 0), anomaly);
  const simulation = arenaEngine.simulateRaid(config, {
    mode: mode.key,
    kingdomTier: Number(profile.kingdom_tier || 0),
    streak: Number(profile.current_streak || 0),
    reputation: Number(profile.reputation_score || 0),
    rating: Number(state?.rating || arenaConfig.baseRating),
    risk: adjustedRisk
  });

  const activeEffects = await shopStore.getActiveEffects(db, profile.user_id);
  const boostedReward = shopStore.applyEffectsToReward(simulation.reward, activeEffects);
  const anomalyAdjusted = nexusEventEngine.applyAnomalyToReward(boostedReward, anomaly, {
    modeKey: mode.key
  });
  const reward = anomalyAdjusted.reward;
  const rewardRefIds = {
    SC: deterministicUuid(`arena:${runNonce}:SC`),
    HC: deterministicUuid(`arena:${runNonce}:HC`),
    RC: deterministicUuid(`arena:${runNonce}:RC_REWARD`)
  };
  await economyStore.creditReward(db, {
    userId: profile.user_id,
    reward,
    reason: `arena_raid_${simulation.outcome}`,
    meta: {
      mode: mode.key,
      run_nonce: runNonce,
      outcome: simulation.outcome
    },
    refEventIds: rewardRefIds
  });

  const ratingDelta = simulation.ratingDelta;
  const nextState = await arenaStore.applyArenaOutcome(db, {
    userId: profile.user_id,
    ratingDelta,
    outcome: simulation.outcome
  });
  const nextRating = Number(nextState?.rating || 0);
  const rawSeasonPoints = Math.max(
    0,
    Number(reward.rc || 0) * 2 + Number(reward.sc || 0) + Number(reward.hc || 0) * 8 + (simulation.outcome === "win" ? 4 : 1)
  );
  const seasonPoints = Math.max(0, Math.round(rawSeasonPoints * Number(anomaly.season_multiplier || 1)));
  await seasonStore.addSeasonPoints(db, {
    userId: profile.user_id,
    seasonId: season.seasonId,
    points: seasonPoints
  });
  await seasonStore.syncIdentitySeasonRank(db, {
    userId: profile.user_id,
    seasonId: season.seasonId
  });

  const warDelta = Math.max(1, Number(reward.rc || 0) + Math.floor(Number(reward.sc || 0) / 3));
  const warCounter = await globalStore.incrementCounter(db, `war_pool_s${season.seasonId}`, warDelta);
  await userStore.touchStreakOnAction(db, {
    userId: profile.user_id,
    decayPerDay: Number(config.loops?.meso?.streak_decay_per_day || 1)
  });
  await userStore.addReputation(db, {
    userId: profile.user_id,
    points: Number(reward.rc || 0) + (simulation.outcome === "win" ? 3 : simulation.outcome === "near" ? 1 : 0),
    thresholds: config.kingdom?.thresholds
  });

  await antiAbuseEngine.applyRiskEvent(db, riskStore, config, {
    userId: profile.user_id,
    eventType: "arena_raid",
    context: {
      mode: mode.key,
      outcome: simulation.outcome,
      rating_delta: ratingDelta
    }
  });

  const run = await arenaStore.createRunIdempotent(db, {
    runNonce,
    userId: profile.user_id,
    seasonId: season.seasonId,
    mode: mode.key,
    riskBefore: adjustedRisk,
    playerPower: simulation.playerPower,
    enemyPower: simulation.enemyPower,
    winProbability: simulation.probabilities.win,
    outcome: simulation.outcome,
    ratingDelta,
    ratingAfter: nextRating,
    reward,
    meta: {
      source: source || "bot",
      probabilities: simulation.probabilities,
      roll: simulation.roll,
      hc_chance: simulation.hcChance,
      nexus_anomaly_id: anomaly.id,
      nexus_anomaly_title: anomaly.title,
      nexus_risk_shift: Number(anomaly.risk_shift || 0),
      nexus_reward_modifiers: anomalyAdjusted.modifiers,
      war_delta: warDelta,
      war_pool: Number(warCounter.counter_value || 0),
      season_points: seasonPoints
    }
  });

  const rank = await arenaStore.getRank(db, profile.user_id);
  const leaderboard = await arenaStore.getLeaderboard(db, season.seasonId, 7);
  const recentRuns = await arenaStore.getRecentRuns(db, profile.user_id, 5);
  const balances = await economyStore.getBalances(db, profile.user_id);
  const daily = await economyStore.getTodayCounter(db, profile.user_id);

  return {
    ok: true,
    duplicate: false,
    mode,
    run: summarizeRun(run),
    reward,
    rating_after: nextRating,
    rank: Number(rank?.rank || 0),
    war_delta: warDelta,
    war_pool: Number(warCounter.counter_value || 0),
    season_points: seasonPoints,
    anomaly: nexusEventEngine.publicAnomalyView(anomaly),
    balances,
    daily,
    leaderboard,
    recent_runs: recentRuns
  };
}

module.exports = {
  runArenaRaid,
  buildRunNonce
};
