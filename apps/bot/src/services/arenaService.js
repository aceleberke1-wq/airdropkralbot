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
const nexusContractEngine = require("./nexusContractEngine");

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

function normalizeOutcomeForContract(outcome) {
  if (outcome === "win" || outcome === "near") {
    return "success";
  }
  return "fail";
}

function toSessionView(session, result = null, actions = []) {
  if (!session) {
    return null;
  }
  const state = session.state_json || {};
  const expiresAt = session.expires_at ? new Date(session.expires_at).getTime() : 0;
  const ttlSecLeft = expiresAt > 0 ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)) : 0;
  return {
    session_id: Number(session.id || 0),
    session_ref: session.session_ref,
    status: session.status,
    mode_suggested: session.mode_suggested,
    mode_final: session.mode_final || null,
    score: Number(session.score || 0),
    combo_max: Number(session.combo_max || 0),
    hits: Number(session.hits || 0),
    misses: Number(session.misses || 0),
    action_count: Number(session.action_count || 0),
    ttl_sec_left: ttlSecLeft,
    started_at: session.started_at,
    resolved_at: session.resolved_at || null,
    next_expected_action: String(state.next_expected || ""),
    state: state,
    actions: (actions || []).map((row) => ({
      action_seq: Number(row.action_seq || 0),
      input_action: row.input_action,
      accepted: Boolean(row.accepted),
      latency_ms: Number(row.latency_ms || 0),
      score_delta: Number(row.score_delta || 0),
      combo_after: Number(row.combo_after || 0),
      created_at: row.created_at
    })),
    result: result
      ? {
          id: Number(result.id || 0),
          mode: result.mode,
          outcome: result.outcome,
          reward: {
            sc: Number(result.reward_sc || 0),
            hc: Number(result.reward_hc || 0),
            rc: Number(result.reward_rc || 0)
          },
          rating_delta: Number(result.rating_delta || 0),
          created_at: result.created_at,
          resolved_json: result.resolved_json || {}
        }
      : null
  };
}

async function insertWebappEvent(db, payload) {
  try {
    await db.query(
      `INSERT INTO webapp_events (event_ref, user_id, session_ref, event_type, event_state, latency_ms, meta_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       ON CONFLICT DO NOTHING;`,
      [
        payload.eventRef || null,
        payload.userId || null,
        payload.sessionRef || null,
        payload.eventType || "event",
        payload.eventState || "info",
        Number(payload.latencyMs || 0),
        JSON.stringify(payload.meta || {})
      ]
    );
  } catch (err) {
    if (err.code !== "42P01") {
      throw err;
    }
  }
}

async function insertFunnelEvent(db, payload) {
  try {
    await db.query(
      `INSERT INTO funnel_events (user_id, funnel_name, step_key, step_state, meta_json)
       VALUES ($1, $2, $3, $4, $5::jsonb);`,
      [
        payload.userId || null,
        payload.funnelName || "arena_v3",
        payload.stepKey || "unknown",
        payload.stepState || "enter",
        JSON.stringify(payload.meta || {})
      ]
    );
  } catch (err) {
    if (err.code !== "42P01") {
      throw err;
    }
  }
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

function computeSessionRatingDelta(config, modeKey, outcome, score) {
  const arenaConfig = arenaEngine.getArenaConfig(config);
  const mode = arenaEngine.getRaidMode(modeKey);
  const base =
    outcome === "win"
      ? arenaConfig.rankWin
      : outcome === "near"
        ? arenaConfig.rankNear
        : arenaConfig.rankLoss;
  const momentum = Math.round(Math.min(10, Math.max(-6, (Number(score || 0) - 70) / 15)));
  return Math.round((base + momentum) * Number(mode.deltaMultiplier || 1));
}

async function startAuthoritativeSession(db, { profile, config, requestId, modeSuggested, source }) {
  const ready = await arenaStore.hasArenaSessionTables(db);
  if (!ready) {
    return { ok: false, error: "arena_session_tables_missing" };
  }

  await arenaStore.expireStaleSessions(db, profile.user_id);
  const existingActive = await arenaStore.getActiveSession(db, profile.user_id, { forUpdate: true });
  if (existingActive) {
    const existingResult = await arenaStore.getSessionResultBySessionId(db, existingActive.id);
    const existingActions = await arenaStore.getSessionActions(db, existingActive.id);
    return {
      ok: true,
      duplicate: true,
      session: toSessionView(existingActive, existingResult, existingActions)
    };
  }

  const season = seasonStore.getSeasonInfo(config);
  const riskState = await riskStore.getRiskState(db, profile.user_id);
  const anomaly = nexusEventEngine.resolveDailyAnomaly(config, { seasonId: season.seasonId });
  const contract = nexusContractEngine.resolveDailyContract(config, {
    seasonId: season.seasonId,
    anomalyId: anomaly.id
  });
  const suggested =
    String(modeSuggested || "").trim().toLowerCase() ||
    String(contract.required_mode || anomaly.preferred_mode || (Number(riskState.riskScore || 0) >= 0.24 ? "safe" : "balanced"));
  const mode = arenaEngine.getRaidMode(suggested);
  const sessionRef = buildRunNonce(profile.user_id, requestId || `${Date.now()}:${Math.random()}`);
  const sessionConfig = arenaEngine.getSessionConfig(config);
  const stateJson = {
    combo: 0,
    combo_max: 0,
    hits: 0,
    misses: 0,
    action_count: 0,
    score: 0,
    phase: "combat",
    next_expected: arenaEngine.expectedActionForSequence(sessionRef, 1),
    latency_hard_ms: sessionConfig.latencyHardMs,
    max_actions: sessionConfig.maxActions
  };
  const session = await arenaStore.createSession(db, {
    sessionRef,
    userId: profile.user_id,
    seasonId: season.seasonId,
    modeSuggested: mode.key,
    requestMeta: {
      source: source || "webapp",
      request_id: requestId || null,
      anomaly_id: anomaly.id,
      contract_id: contract.id
    },
    stateJson,
    ttlSec: sessionConfig.ttlSec
  });
  await riskStore.insertBehaviorEvent(db, profile.user_id, "arena_session_start", {
    session_ref: sessionRef,
    mode_suggested: mode.key,
    source: source || "webapp"
  });
  await insertWebappEvent(db, {
    eventRef: deterministicUuid(`webapp:arena:start:${sessionRef}`),
    userId: profile.user_id,
    sessionRef,
    eventType: "arena_session_start",
    eventState: "ok",
    meta: {
      mode_suggested: mode.key,
      source: source || "webapp"
    }
  });
  await insertFunnelEvent(db, {
    userId: profile.user_id,
    funnelName: "arena_v3",
    stepKey: "session_start",
    stepState: "enter",
    meta: { session_ref: sessionRef, mode_suggested: mode.key }
  });
  return {
    ok: true,
    duplicate: false,
    session: toSessionView(session, null, [])
  };
}

async function applyAuthoritativeSessionAction(
  db,
  { profile, config, sessionRef, actionSeq, inputAction, latencyMs, clientTs, source }
) {
  const ready = await arenaStore.hasArenaSessionTables(db);
  if (!ready) {
    return { ok: false, error: "arena_session_tables_missing" };
  }
  await arenaStore.expireStaleSessions(db, profile.user_id);
  const session = await arenaStore.getSessionByRef(db, profile.user_id, sessionRef, { forUpdate: true });
  if (!session) {
    return { ok: false, error: "session_not_found" };
  }
  if (session.status !== "active") {
    const result = await arenaStore.getSessionResultBySessionId(db, session.id);
    const actions = await arenaStore.getSessionActions(db, session.id);
    return {
      ok: true,
      duplicate: true,
      session: toSessionView(session, result, actions)
    };
  }
  if (session.expires_at && new Date(session.expires_at).getTime() <= Date.now()) {
    await db.query(
      `UPDATE arena_sessions
       SET status = 'expired',
           updated_at = now()
       WHERE id = $1;`,
      [session.id]
    );
    return { ok: false, error: "session_expired" };
  }

  const sessionConfig = arenaEngine.getSessionConfig(config);
  const seq = Number(actionSeq || 0);
  if (!Number.isFinite(seq) || seq <= 0 || seq > sessionConfig.maxActions) {
    return { ok: false, error: "invalid_action_seq" };
  }

  const currentState = {
    sessionRef: session.session_ref,
    score: Number(session.score || 0),
    combo: Number(session.state_json?.combo || 0),
    comboMax: Number(session.combo_max || 0),
    hits: Number(session.hits || 0),
    misses: Number(session.misses || 0),
    actionCount: Number(session.action_count || 0)
  };
  const evaluation = arenaEngine.evaluateSessionAction(
    currentState,
    {
      actionSeq: seq,
      inputAction,
      latencyMs: Math.max(0, Number(latencyMs || 0))
    },
    config
  );

  const actionRow = await arenaStore.upsertSessionAction(db, {
    sessionId: session.id,
    actionSeq: seq,
    inputAction: evaluation.inputAction || "guard",
    latencyMs: evaluation.latencyMs,
    accepted: evaluation.accepted,
    scoreDelta: evaluation.scoreDelta,
    comboAfter: evaluation.comboAfter,
    actionJson: {
      expected_action: evaluation.expectedAction,
      client_ts: Number(clientTs || 0),
      source: source || "webapp"
    }
  });

  const duplicate = !Boolean(actionRow?.inserted);
  if (!duplicate) {
    await arenaStore.updateSessionProgress(db, {
      sessionId: session.id,
      score: evaluation.scoreAfter,
      comboMax: evaluation.comboMax,
      hits: evaluation.hitsAfter,
      misses: evaluation.missesAfter,
      actionCount: evaluation.actionCount,
      stateJson: {
        combo: evaluation.comboAfter,
        combo_max: evaluation.comboMax,
        hits: evaluation.hitsAfter,
        misses: evaluation.missesAfter,
        action_count: evaluation.actionCount,
        score: evaluation.scoreAfter,
        next_expected: arenaEngine.expectedActionForSequence(session.session_ref, seq + 1),
        last_action_seq: seq,
        last_client_ts: Number(clientTs || 0),
        last_latency_ms: evaluation.latencyMs
      }
    });
    await riskStore.insertBehaviorEvent(db, profile.user_id, "arena_session_action", {
      session_ref: sessionRef,
      action_seq: seq,
      input_action: evaluation.inputAction,
      accepted: evaluation.accepted,
      latency_ms: evaluation.latencyMs,
      score_after: evaluation.scoreAfter
    });
    await insertWebappEvent(db, {
      eventRef: deterministicUuid(`webapp:arena:action:${sessionRef}:${seq}`),
      userId: profile.user_id,
      sessionRef,
      eventType: "arena_session_action",
      eventState: evaluation.accepted ? "ok" : "miss",
      latencyMs: evaluation.latencyMs,
      meta: {
        action_seq: seq,
        input_action: evaluation.inputAction,
        expected_action: evaluation.expectedAction,
        score_after: evaluation.scoreAfter
      }
    });
  }

  const refreshed = await arenaStore.getSessionByRef(db, profile.user_id, sessionRef);
  const actions = await arenaStore.getSessionActions(db, session.id);
  return {
    ok: true,
    duplicate,
    action: {
      action_seq: seq,
      accepted: evaluation.accepted,
      expected_action: evaluation.expectedAction,
      score_delta: evaluation.scoreDelta,
      score_after: Number(refreshed?.score || evaluation.scoreAfter),
      combo_after: evaluation.comboAfter
    },
    session: toSessionView(refreshed || session, null, actions)
  };
}

async function resolveAuthoritativeSession(db, { profile, config, sessionRef, source }) {
  const ready = await arenaStore.hasArenaSessionTables(db);
  if (!ready) {
    return { ok: false, error: "arena_session_tables_missing" };
  }
  await arenaStore.expireStaleSessions(db, profile.user_id);
  const session = await arenaStore.getSessionByRef(db, profile.user_id, sessionRef, { forUpdate: true });
  if (!session) {
    return { ok: false, error: "session_not_found" };
  }
  const existingResult = await arenaStore.getSessionResultBySessionId(db, session.id);
  if (existingResult) {
    const actions = await arenaStore.getSessionActions(db, session.id);
    return {
      ok: true,
      duplicate: true,
      session: toSessionView(session, existingResult, actions)
    };
  }
  if (session.status !== "active") {
    return { ok: false, error: "session_not_active" };
  }
  if (session.expires_at && new Date(session.expires_at).getTime() <= Date.now()) {
    await db.query(
      `UPDATE arena_sessions
       SET status = 'expired',
           updated_at = now()
       WHERE id = $1;`,
      [session.id]
    );
    return { ok: false, error: "session_expired" };
  }

  const sessionConfig = arenaEngine.getSessionConfig(config);
  if (Number(session.action_count || 0) < sessionConfig.resolveMinActions) {
    return {
      ok: false,
      error: "session_not_ready",
      min_actions: sessionConfig.resolveMinActions,
      action_count: Number(session.action_count || 0)
    };
  }

  const season = seasonStore.getSeasonInfo(config);
  const anomaly = nexusEventEngine.resolveDailyAnomaly(config, { seasonId: season.seasonId });
  const contract = nexusContractEngine.resolveDailyContract(config, {
    seasonId: season.seasonId,
    anomalyId: anomaly.id
  });
  const riskState = await riskStore.getRiskState(db, profile.user_id);
  const adjustedRisk = nexusEventEngine.applyRiskShift(Number(riskState.riskScore || 0), anomaly);
  const arenaConfig = arenaEngine.getArenaConfig(config);
  const arenaState = await arenaStore.getArenaState(db, profile.user_id, arenaConfig.baseRating);
  const comboMax = Number(session.combo_max || 0);
  const score = Number(session.score || 0);
  const mode = arenaEngine.resolveSessionModeByScore(score);
  const outcome = arenaEngine.resolveSessionOutcome({
    score,
    hits: Number(session.hits || 0),
    misses: Number(session.misses || 0)
  });

  const rewardInfo = arenaEngine.computeSessionReward(config, {
    mode,
    outcome,
    score,
    hits: Number(session.hits || 0),
    misses: Number(session.misses || 0),
    risk: adjustedRisk,
    kingdomTier: Number(profile.kingdom_tier || 0),
    streak: Number(profile.current_streak || 0),
    rating: Number(arenaState?.rating || arenaConfig.baseRating)
  });
  const activeEffects = await shopStore.getActiveEffects(db, profile.user_id);
  const boostedReward = shopStore.applyEffectsToReward(rewardInfo.reward, activeEffects);
  const anomalyAdjusted = nexusEventEngine.applyAnomalyToReward(boostedReward, anomaly, { modeKey: mode });
  const contractEval = nexusContractEngine.evaluateAttempt(contract, {
    modeKey: mode,
    family: "combo",
    result: normalizeOutcomeForContract(outcome),
    combo: comboMax
  });
  const contractAdjusted = nexusContractEngine.applyContractToReward(anomalyAdjusted.reward, contractEval);
  const reward = contractAdjusted.reward;
  const ratingDelta = computeSessionRatingDelta(config, mode, outcome, score);

  const rewardRefs = {
    SC: deterministicUuid(`arena_session:${session.id}:SC`),
    HC: deterministicUuid(`arena_session:${session.id}:HC`),
    RC: deterministicUuid(`arena_session:${session.id}:RC`)
  };
  await economyStore.creditReward(db, {
    userId: profile.user_id,
    reward,
    reason: `arena_session_resolve_${outcome}`,
    meta: {
      session_ref: sessionRef,
      mode,
      outcome,
      source: source || "webapp"
    },
    refEventIds: rewardRefs
  });

  const nextArenaState = await arenaStore.applyArenaOutcome(db, {
    userId: profile.user_id,
    ratingDelta,
    outcome
  });
  const baseSeasonPoints = Math.max(
    0,
    Number(reward.rc || 0) * 2 + Number(reward.sc || 0) + Number(reward.hc || 0) * 8 + (outcome === "win" ? 5 : outcome === "near" ? 2 : 0)
  );
  const seasonBonus = shopStore.getSeasonBonusMultiplier(activeEffects);
  const seasonPoints = Math.max(
    0,
    Math.round(baseSeasonPoints * (1 + seasonBonus) * Number(anomaly.season_multiplier || 1)) + Number(contractEval.season_bonus || 0)
  );
  await seasonStore.addSeasonPoints(db, {
    userId: profile.user_id,
    seasonId: season.seasonId,
    points: seasonPoints
  });
  await seasonStore.syncIdentitySeasonRank(db, {
    userId: profile.user_id,
    seasonId: season.seasonId
  });

  const warDelta = Math.max(
    1,
    Number(reward.rc || 0) + Math.floor(Number(reward.sc || 0) / 4) + Number(reward.hc || 0) * 2 + Number(contractEval.war_bonus || 0)
  );
  const warCounter = await globalStore.incrementCounter(db, `war_pool_s${season.seasonId}`, warDelta);
  await userStore.touchStreakOnAction(db, {
    userId: profile.user_id,
    decayPerDay: Number(config.loops?.meso?.streak_decay_per_day || 1)
  });
  await userStore.addReputation(db, {
    userId: profile.user_id,
    points: Number(reward.rc || 0) + (outcome === "win" ? 3 : outcome === "near" ? 1 : 0),
    thresholds: config.kingdom?.thresholds
  });

  await arenaStore.markSessionResolved(db, {
    sessionId: session.id,
    modeFinal: mode,
    stateJson: {
      resolved_outcome: outcome,
      resolved_reward: reward,
      rating_delta: ratingDelta,
      season_points: seasonPoints,
      war_delta: warDelta
    }
  });

  const resultRef = deterministicUuid(`arena_session_result:${session.id}`);
  const result = await arenaStore.createSessionResult(db, {
    sessionId: session.id,
    resultRef,
    mode,
    outcome,
    rewardSc: Number(reward.sc || 0),
    rewardHc: Number(reward.hc || 0),
    rewardRc: Number(reward.rc || 0),
    ratingDelta,
    resolvedJson: {
      season_id: season.seasonId,
      season_points: seasonPoints,
      war_delta: warDelta,
      war_pool: Number(warCounter.counter_value || 0),
      contract_eval: contractEval,
      anomaly_id: anomaly.id,
      anomaly_title: anomaly.title
    }
  });

  await antiAbuseEngine.applyRiskEvent(db, riskStore, config, {
    userId: profile.user_id,
    eventType: "arena_raid",
    context: {
      source: "arena_session",
      outcome,
      mode,
      rating_delta: ratingDelta
    }
  });
  await riskStore.insertBehaviorEvent(db, profile.user_id, "arena_session_resolve", {
    session_ref: sessionRef,
    score,
    mode,
    outcome,
    reward,
    rating_delta: ratingDelta,
    season_points: seasonPoints,
    war_delta: warDelta
  });
  await insertWebappEvent(db, {
    eventRef: deterministicUuid(`webapp:arena:resolve:${sessionRef}`),
    userId: profile.user_id,
    sessionRef,
    eventType: "arena_session_resolve",
    eventState: outcome,
    meta: {
      score,
      mode,
      outcome,
      reward,
      rating_delta: ratingDelta
    }
  });
  await insertFunnelEvent(db, {
    userId: profile.user_id,
    funnelName: "arena_v3",
    stepKey: "session_resolve",
    stepState: outcome,
    meta: { session_ref: sessionRef, mode, outcome, score }
  });

  const refreshed = await arenaStore.getSessionByRef(db, profile.user_id, sessionRef);
  const actions = await arenaStore.getSessionActions(db, session.id);
  const rank = await arenaStore.getRank(db, profile.user_id);
  return {
    ok: true,
    duplicate: false,
    mode,
    outcome,
    reward,
    rating_after: Number(nextArenaState?.rating || arenaConfig.baseRating),
    rating_delta: ratingDelta,
    rank: Number(rank?.rank || 0),
    season_points: seasonPoints,
    war_delta: warDelta,
    war_pool: Number(warCounter.counter_value || 0),
    session: toSessionView(refreshed || session, result, actions)
  };
}

async function getAuthoritativeSessionState(db, { profile, sessionRef }) {
  const ready = await arenaStore.hasArenaSessionTables(db);
  if (!ready) {
    return { ok: false, error: "arena_session_tables_missing" };
  }
  await arenaStore.expireStaleSessions(db, profile.user_id);
  let sessionBundle = null;
  if (sessionRef) {
    sessionBundle = await arenaStore.getSessionWithResult(db, profile.user_id, sessionRef);
  } else {
    const active = await arenaStore.getActiveSession(db, profile.user_id);
    if (active) {
      const result = await arenaStore.getSessionResultBySessionId(db, active.id);
      const actions = await arenaStore.getSessionActions(db, active.id);
      sessionBundle = { session: active, result, actions };
    } else {
      const latest = await arenaStore.getLatestResolvedSession(db, profile.user_id, 180);
      if (latest) {
        const session = await arenaStore.getSessionByRef(db, profile.user_id, latest.session_ref);
        const result = await arenaStore.getSessionResultBySessionId(db, latest.id);
        const actions = await arenaStore.getSessionActions(db, latest.id, 40);
        sessionBundle = { session, result, actions };
      }
    }
  }
  if (!sessionBundle || !sessionBundle.session) {
    return { ok: true, session: null };
  }
  return {
    ok: true,
    session: toSessionView(sessionBundle.session, sessionBundle.result, sessionBundle.actions)
  };
}

module.exports = {
  runArenaRaid,
  buildRunNonce,
  startAuthoritativeSession,
  applyAuthoritativeSessionAction,
  resolveAuthoritativeSession,
  getAuthoritativeSessionState
};
