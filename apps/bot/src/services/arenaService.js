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

function normalizePvpRejectCode(code, fallback = "rejected") {
  return String(code || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .slice(0, 64) || fallback;
}

async function logPvpActionRejection(db, payload) {
  const sessionId = Number(payload.sessionId || 0);
  const actorUserId = Number(payload.actorUserId || 0);
  if (!sessionId || !actorUserId) {
    return;
  }
  const reasonCode = normalizePvpRejectCode(payload.reasonCode, "rejected");
  const sessionRef = String(payload.sessionRef || "");
  const actionSeq = Math.max(0, Number(payload.actionSeq || 0));
  const latencyMs = Math.max(0, Number(payload.latencyMs || 0));
  const inputAction = String(payload.inputAction || "");
  const transport = String(payload.transport || "poll");
  const rejectJson = payload.rejectJson && typeof payload.rejectJson === "object" ? payload.rejectJson : {};

  await arenaStore.insertPvpActionRejection(db, {
    sessionId,
    sessionRef,
    actorUserId,
    actionSeq,
    inputAction,
    reasonCode,
    latencyMs,
    transport,
    rejectJson
  });

  await riskStore.insertBehaviorEvent(db, actorUserId, "pvp_action_reject", {
    session_ref: sessionRef,
    action_seq: actionSeq,
    input_action: inputAction,
    reason_code: reasonCode,
    latency_ms: latencyMs,
    source: String(payload.source || "webapp")
  });

  await insertWebappEvent(db, {
    eventRef: deterministicUuid(`webapp:pvp:reject:${sessionRef}:${actorUserId}:${actionSeq}:${reasonCode}`),
    userId: actorUserId,
    sessionRef,
    eventType: "pvp_action_reject",
    eventState: reasonCode,
    latencyMs,
    meta: {
      action_seq: actionSeq,
      input_action: inputAction,
      reason_code: reasonCode,
      transport,
      ...(rejectJson || {})
    }
  });
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

function toRaidSessionView(session, result = null, actions = [], bossCycle = null) {
  if (!session) {
    return null;
  }
  const state = session.state_json || {};
  const expiresAt = session.expires_at ? new Date(session.expires_at).getTime() : 0;
  const ttlSecLeft = expiresAt > 0 ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)) : 0;
  return {
    session_id: Number(session.id || 0),
    session_ref: session.session_ref,
    request_ref: session.request_ref || "",
    status: session.status,
    mode_suggested: session.mode_suggested,
    mode_final: session.mode_final || null,
    score: Number(session.score || 0),
    combo_max: Number(session.combo_max || 0),
    hits: Number(session.hits || 0),
    misses: Number(session.misses || 0),
    action_count: Number(session.action_count || 0),
    contract_key: session.contract_key || "",
    anomaly_id: session.anomaly_id || "",
    boss_cycle_id: Number(session.boss_cycle_id || 0),
    ttl_sec_left: ttlSecLeft,
    started_at: session.started_at,
    resolved_at: session.resolved_at || null,
    next_expected_action: String(state.next_expected || ""),
    director: session.director_json || {},
    state,
    boss_cycle: bossCycle
      ? {
          id: Number(bossCycle.id || 0),
          cycle_ref: bossCycle.cycle_ref,
          cycle_key: bossCycle.cycle_key,
          boss_name: bossCycle.boss_name,
          tier: bossCycle.tier,
          wave_total: Number(bossCycle.wave_total || 0),
          wave_index: Number(bossCycle.wave_index || 0),
          hp_total: Number(bossCycle.hp_total || 0),
          hp_remaining: Number(bossCycle.hp_remaining || 0),
          state: bossCycle.state,
          ends_at: bossCycle.ends_at
        }
      : null,
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
          damage_done: Number(result.damage_done || 0),
          created_at: result.created_at,
          resolved_json: result.resolved_json || {}
        }
      : null
  };
}

function resolvePvpSide(session, userId) {
  const actorId = Number(userId || 0);
  if (Number(session?.user_left_id || 0) === actorId) {
    return "left";
  }
  if (Number(session?.user_right_id || 0) === actorId) {
    return "right";
  }
  return "left";
}

function pvpOutcomeForSide(winnerSide, side) {
  const normalizedWinner = String(winnerSide || "none").toLowerCase();
  const normalizedSide = String(side || "left").toLowerCase();
  if (normalizedWinner === "draw" || normalizedWinner === "none") {
    return "draw";
  }
  return normalizedWinner === normalizedSide ? "win" : "loss";
}

function computePvpShadowScore(sessionRef, scoreLeft, actionCountLeft) {
  const base = Math.max(0, Number(scoreLeft || 0));
  const actionFactor = Math.max(1, Number(actionCountLeft || 1));
  const hashHex = crypto.createHash("sha1").update(`pvp-shadow:${String(sessionRef || "")}`).digest("hex");
  const seed = parseInt(hashHex.slice(0, 8), 16) / 0xffffffff;
  const multiplier = 0.76 + seed * 0.42;
  const variance = Math.round((actionFactor % 5) - 2);
  return Math.max(0, Math.round(base * multiplier + variance));
}

function toPvpSessionView(session, result = null, actions = [], viewerUserId = null) {
  if (!session) {
    return null;
  }
  const state = session.state_json || {};
  const viewerSide = resolvePvpSide(session, viewerUserId);
  const opponentSide = viewerSide === "left" ? "right" : "left";
  const expiresAt = session.expires_at ? new Date(session.expires_at).getTime() : 0;
  const ttlSecLeft = expiresAt > 0 ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)) : 0;
  const outcomeForViewer = result ? pvpOutcomeForSide(result.resolved_json?.winner_side || session.winner_side, viewerSide) : null;
  return {
    session_id: Number(session.id || 0),
    session_ref: session.session_ref,
    request_ref: session.request_ref || "",
    status: session.status,
    transport: session.transport || "poll",
    tick_ms: Number(session.tick_ms || 1000),
    action_window_ms: Number(session.action_window_ms || 800),
    mode_suggested: session.mode_suggested,
    mode_final: session.mode_final || null,
    opponent_type: session.opponent_type || "shadow",
    viewer_side: viewerSide,
    player_user_id: Number(viewerSide === "left" ? session.user_left_id || 0 : session.user_right_id || 0),
    opponent_user_id: Number(opponentSide === "left" ? session.user_left_id || 0 : session.user_right_id || 0) || null,
    score: {
      left: Number(session.score_left || 0),
      right: Number(session.score_right || 0),
      self: Number(viewerSide === "left" ? session.score_left || 0 : session.score_right || 0),
      opponent: Number(opponentSide === "left" ? session.score_left || 0 : session.score_right || 0)
    },
    combo: {
      left: Number(session.combo_left || 0),
      right: Number(session.combo_right || 0),
      self: Number(viewerSide === "left" ? session.combo_left || 0 : session.combo_right || 0),
      opponent: Number(opponentSide === "left" ? session.combo_left || 0 : session.combo_right || 0)
    },
    action_count: {
      left: Number(session.action_count_left || 0),
      right: Number(session.action_count_right || 0),
      self: Number(viewerSide === "left" ? session.action_count_left || 0 : session.action_count_right || 0),
      opponent: Number(opponentSide === "left" ? session.action_count_left || 0 : session.action_count_right || 0)
    },
    ttl_sec_left: ttlSecLeft,
    started_at: session.started_at,
    resolved_at: session.resolved_at || null,
    next_expected_action: String(state[`next_expected_${viewerSide}`] || ""),
    state,
    actions: (actions || []).map((row) => {
      const actorSide = Number(row.actor_user_id || 0) === Number(session.user_left_id || 0) ? "left" : "right";
      return {
        action_seq: Number(row.action_seq || 0),
        actor_user_id: Number(row.actor_user_id || 0),
        actor_side: actorSide,
        input_action: row.input_action,
        accepted: Boolean(row.accepted),
        reject_reason: String(row.reject_reason || row.action_json?.reject_reason || ""),
        latency_ms: Number(row.latency_ms || 0),
        score_delta: Number(row.score_delta || 0),
        created_at: row.created_at
      };
    }),
    result: result
      ? (() => {
          const rewardsBySide = result.resolved_json?.rewards_by_side || {};
          const ratingsBySide = result.resolved_json?.ratings_by_side || {};
          const viewerReward = rewardsBySide?.[viewerSide];
          const viewerRating = ratingsBySide?.[viewerSide];
          return {
            id: Number(result.id || 0),
            mode: result.mode,
            outcome: result.outcome,
            outcome_for_viewer: outcomeForViewer,
            winner_user_id: Number(result.winner_user_id || 0) || null,
            winner_side: result.resolved_json?.winner_side || session.winner_side || "none",
            score_left: Number(result.score_left || 0),
            score_right: Number(result.score_right || 0),
            reward: viewerReward
              ? {
                  sc: Number(viewerReward.sc || 0),
                  hc: Number(viewerReward.hc || 0),
                  rc: Number(viewerReward.rc || 0)
                }
              : {
                  sc: Number(result.reward_sc || 0),
                  hc: Number(result.reward_hc || 0),
                  rc: Number(result.reward_rc || 0)
                },
            rating_delta: viewerRating ? Number(viewerRating.delta || 0) : Number(result.rating_delta || 0),
            created_at: result.created_at,
            resolved_json: result.resolved_json || {}
          };
        })()
      : null
  };
}

async function getIdentityProfileSnapshot(db, userId) {
  const safeUserId = Number(userId || 0);
  if (!safeUserId) {
    return null;
  }
  const result = await db.query(
    `SELECT
       i.user_id,
       COALESCE(i.public_name, CONCAT('u', i.user_id::text)) AS public_name,
       COALESCE(i.kingdom_tier, 0) AS kingdom_tier,
       COALESCE(i.current_streak, 0) AS current_streak,
       COALESCE(i.reputation_score, 0) AS reputation_score
     FROM identities i
     WHERE i.user_id = $1
     LIMIT 1;`,
    [safeUserId]
  );
  if (result.rows[0]) {
    return result.rows[0];
  }
  return {
    user_id: safeUserId,
    public_name: `u${safeUserId}`,
    kingdom_tier: 0,
    current_streak: 0,
    reputation_score: 0
  };
}

function dailyCapForProfile(config, profile) {
  const base = Number(config?.loops?.meso?.daily_cap_base || 120);
  const tier = Number(profile?.kingdom_tier || 0);
  return Math.max(20, Math.round(base + tier * 20));
}

function buildDirectorDecision({
  profile,
  config,
  riskScore,
  dailyCounter,
  activeArenaSession,
  activeRaidSession,
  anomaly,
  contract
}) {
  const dailyTasks = Number(dailyCounter?.tasks_done || 0);
  const dailyCap = dailyCapForProfile(config, profile);
  const capRatio = dailyCap > 0 ? Math.min(1.5, dailyTasks / dailyCap) : 0;
  const risk = Math.max(0, Math.min(1, Number(riskScore || 0)));
  const hasActionableSession = Boolean(activeArenaSession || activeRaidSession);
  const shouldReveal = hasActionableSession && Number(activeArenaSession?.action_count || 0) >= 6;
  const recommendedMode =
    contract?.required_mode ||
    anomaly?.preferred_mode ||
    (risk >= 0.3 ? "safe" : risk <= 0.12 ? "aggressive" : "balanced");

  let recommendedAction = "start_task";
  let stateLabel = "Hazir";
  let style = "info";
  if (activeRaidSession) {
    recommendedAction = Number(activeRaidSession.action_count || 0) >= 7 ? "resolve_raid" : "continue_raid";
    stateLabel = "Raid Aktif";
    style = "warn";
  } else if (activeArenaSession) {
    recommendedAction = shouldReveal ? "resolve_arena" : "continue_arena";
    stateLabel = "Arena Aktif";
    style = "warn";
  } else if (capRatio >= 1) {
    recommendedAction = "play_safe";
    stateLabel = "Cap Uzeri";
    style = "danger";
  }

  return {
    stateLabel,
    style,
    recommended_action: recommendedAction,
    recommended_mode: recommendedMode,
    risk_band: risk >= 0.35 ? "high" : risk >= 0.2 ? "mid" : "low",
    cap_ratio: Number(capRatio.toFixed(3))
  };
}

function formatCycleKey(seasonId) {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `s${seasonId}_${yyyy}${mm}${dd}`;
}

function defaultBossForSeason(seasonId) {
  const roster = ["Nexus Warden", "Flux Hydra", "Aether Golem", "Chrono Specter", "Iron Leviathan"];
  const idx = Math.abs(Number(seasonId || 0)) % roster.length;
  return roster[idx];
}

async function ensureActiveBossCycle(db, seasonId) {
  const existing = await arenaStore.getActiveBossCycle(db, seasonId, { forUpdate: true });
  if (existing) {
    return existing;
  }
  const cycleKey = formatCycleKey(seasonId);
  return arenaStore.createBossCycle(db, {
    cycleRef: deterministicUuid(`boss_cycle:${cycleKey}`),
    cycleKey,
    seasonId,
    bossName: defaultBossForSeason(seasonId),
    tier: "seed",
    waveTotal: 3,
    waveIndex: 1,
    hpTotal: 1800,
    hpRemaining: 1800,
    cycleJson: { source: "auto_seed" }
  });
}

async function buildDirectorView(db, { profile, config }) {
  const season = seasonStore.getSeasonInfo(config);
  const anomaly = nexusEventEngine.publicAnomalyView(
    nexusEventEngine.resolveDailyAnomaly(config, { seasonId: season.seasonId })
  );
  const contract = nexusContractEngine.publicContractView(
    nexusContractEngine.resolveDailyContract(config, {
      seasonId: season.seasonId,
      anomalyId: anomaly.id
    })
  );
  const riskState = await riskStore.getRiskState(db, profile.user_id);
  const dailyCounter = await economyStore.getTodayCounter(db, profile.user_id);
  const activeArenaSession = await arenaStore.getActiveSession(db, profile.user_id);
  const activeRaidSession = await arenaStore.getActiveRaidSession(db, profile.user_id);
  const decision = buildDirectorDecision({
    profile,
    config,
    riskScore: Number(riskState.riskScore || 0),
    dailyCounter,
    activeArenaSession,
    activeRaidSession,
    anomaly,
    contract
  });

  return {
    server_tick: Date.now(),
    season: {
      season_id: season.seasonId,
      days_left: season.daysLeft
    },
    risk_score: Number(riskState.riskScore || 0),
    daily: {
      tasks_done: Number(dailyCounter.tasks_done || 0),
      sc_earned: Number(dailyCounter.sc_earned || 0),
      hc_earned: Number(dailyCounter.hc_earned || 0),
      rc_earned: Number(dailyCounter.rc_earned || 0),
      cap: dailyCapForProfile(config, profile)
    },
    active: {
      arena_session_ref: activeArenaSession?.session_ref || null,
      raid_session_ref: activeRaidSession?.session_ref || null
    },
    anomaly,
    contract,
    director: decision
  };
}

async function startAuthoritativeRaidSession(db, { profile, config, requestId, modeSuggested, source }) {
  const ready = await arenaStore.hasRaidSessionTables(db);
  if (!ready) {
    return { ok: false, error: "raid_session_tables_missing" };
  }

  await arenaStore.expireStaleRaidSessions(db, profile.user_id);
  const existingActive = await arenaStore.getActiveRaidSession(db, profile.user_id, { forUpdate: true });
  if (existingActive) {
    const existingResult = await arenaStore.getRaidResultBySessionId(db, existingActive.id);
    const existingActions = await arenaStore.getRaidActions(db, existingActive.id);
    const bossCycle = existingActive.boss_cycle_id
      ? await db.query(`SELECT * FROM boss_cycles WHERE id = $1 LIMIT 1;`, [existingActive.boss_cycle_id]).then((r) => r.rows[0] || null)
      : null;
    return {
      ok: true,
      duplicate: true,
      session: toRaidSessionView(existingActive, existingResult, existingActions, bossCycle)
    };
  }

  const season = seasonStore.getSeasonInfo(config);
  const anomaly = nexusEventEngine.resolveDailyAnomaly(config, { seasonId: season.seasonId });
  const contract = nexusContractEngine.resolveDailyContract(config, {
    seasonId: season.seasonId,
    anomalyId: anomaly.id
  });
  const riskState = await riskStore.getRiskState(db, profile.user_id);
  const directorView = await buildDirectorView(db, { profile, config });
  const suggested =
    String(modeSuggested || "").trim().toLowerCase() ||
    String(contract.required_mode || anomaly.preferred_mode || (Number(riskState.riskScore || 0) > 0.27 ? "safe" : "balanced"));
  const mode = arenaEngine.getRaidMode(suggested);
  const sessionRef = buildRunNonce(profile.user_id, requestId || `${Date.now()}:${Math.random()}`);
  const requestRef = requestId ? `raid:${profile.user_id}:${requestId}` : null;
  const sessionConfig = arenaEngine.getSessionConfig(config);
  const bossCycle = await ensureActiveBossCycle(db, season.seasonId);
  const arenaConfig = arenaEngine.getArenaConfig(config);

  const debit = await economyStore.debitCurrency(db, {
    userId: profile.user_id,
    currency: "RC",
    amount: arenaConfig.ticketCostRc,
    reason: "raid_ticket_spend",
    refEventId: deterministicUuid(`raid_ticket:${sessionRef}:RC`),
    meta: {
      mode: mode.key,
      source: source || "webapp",
      session_ref: sessionRef
    }
  });
  if (!debit.applied) {
    return {
      ok: false,
      error: debit.reason === "insufficient_balance" ? "insufficient_rc" : "raid_ticket_error"
    };
  }

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
  const created = await arenaStore.createRaidSession(db, {
    sessionRef,
    requestRef,
    userId: profile.user_id,
    seasonId: season.seasonId,
    bossCycleId: bossCycle?.id || null,
    modeSuggested: mode.key,
    contractKey: String(contract.id || ""),
    anomalyId: String(anomaly.id || ""),
    directorJson: directorView,
    requestMeta: {
      source: source || "webapp",
      request_id: requestId || null
    },
    stateJson,
    ttlSec: Math.max(45, sessionConfig.ttlSec)
  });

  await riskStore.insertBehaviorEvent(db, profile.user_id, "raid_session_start", {
    session_ref: sessionRef,
    mode_suggested: mode.key,
    boss_cycle_id: Number(bossCycle?.id || 0),
    source: source || "webapp"
  });
  await insertWebappEvent(db, {
    eventRef: deterministicUuid(`webapp:raid:start:${sessionRef}`),
    userId: profile.user_id,
    sessionRef,
    eventType: "raid_session_start",
    eventState: "ok",
    meta: {
      mode_suggested: mode.key,
      boss_cycle_id: Number(bossCycle?.id || 0)
    }
  });
  await insertFunnelEvent(db, {
    userId: profile.user_id,
    funnelName: "raid_v3",
    stepKey: "session_start",
    stepState: "enter",
    meta: { session_ref: sessionRef, mode_suggested: mode.key }
  });

  return {
    ok: true,
    duplicate: false,
    session: toRaidSessionView(created, null, [], bossCycle)
  };
}

async function applyAuthoritativeRaidAction(
  db,
  { profile, config, sessionRef, actionSeq, inputAction, latencyMs, clientTs, source }
) {
  const ready = await arenaStore.hasRaidSessionTables(db);
  if (!ready) {
    return { ok: false, error: "raid_session_tables_missing" };
  }
  await arenaStore.expireStaleRaidSessions(db, profile.user_id);
  const session = await arenaStore.getRaidSessionByRef(db, profile.user_id, sessionRef, { forUpdate: true });
  if (!session) {
    return { ok: false, error: "session_not_found" };
  }
  if (session.status !== "active") {
    const result = await arenaStore.getRaidResultBySessionId(db, session.id);
    const actions = await arenaStore.getRaidActions(db, session.id);
    const bossCycle = session.boss_cycle_id
      ? await db.query(`SELECT * FROM boss_cycles WHERE id = $1 LIMIT 1;`, [session.boss_cycle_id]).then((r) => r.rows[0] || null)
      : null;
    return {
      ok: true,
      duplicate: true,
      session: toRaidSessionView(session, result, actions, bossCycle)
    };
  }
  if (session.expires_at && new Date(session.expires_at).getTime() <= Date.now()) {
    await db.query(
      `UPDATE raid_sessions
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

  const actionRow = await arenaStore.upsertRaidAction(db, {
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
    await arenaStore.updateRaidSessionProgress(db, {
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
    await riskStore.insertBehaviorEvent(db, profile.user_id, "raid_session_action", {
      session_ref: sessionRef,
      action_seq: seq,
      input_action: evaluation.inputAction,
      accepted: evaluation.accepted,
      latency_ms: evaluation.latencyMs
    });
    await insertWebappEvent(db, {
      eventRef: deterministicUuid(`webapp:raid:action:${sessionRef}:${seq}`),
      userId: profile.user_id,
      sessionRef,
      eventType: "raid_session_action",
      eventState: evaluation.accepted ? "ok" : "miss",
      latencyMs: evaluation.latencyMs,
      meta: {
        action_seq: seq,
        input_action: evaluation.inputAction,
        expected_action: evaluation.expectedAction
      }
    });
  }
  const refreshed = await arenaStore.getRaidSessionByRef(db, profile.user_id, sessionRef);
  const actions = await arenaStore.getRaidActions(db, session.id);
  const bossCycle = refreshed?.boss_cycle_id
    ? await db.query(`SELECT * FROM boss_cycles WHERE id = $1 LIMIT 1;`, [refreshed.boss_cycle_id]).then((r) => r.rows[0] || null)
    : null;
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
    session: toRaidSessionView(refreshed || session, null, actions, bossCycle)
  };
}

async function resolveAuthoritativeRaidSession(db, { profile, config, sessionRef, source }) {
  const ready = await arenaStore.hasRaidSessionTables(db);
  if (!ready) {
    return { ok: false, error: "raid_session_tables_missing" };
  }
  await arenaStore.expireStaleRaidSessions(db, profile.user_id);
  const session = await arenaStore.getRaidSessionByRef(db, profile.user_id, sessionRef, { forUpdate: true });
  if (!session) {
    return { ok: false, error: "session_not_found" };
  }
  const existingResult = await arenaStore.getRaidResultBySessionId(db, session.id);
  if (existingResult) {
    const actions = await arenaStore.getRaidActions(db, session.id);
    const bossCycle = session.boss_cycle_id
      ? await db.query(`SELECT * FROM boss_cycles WHERE id = $1 LIMIT 1;`, [session.boss_cycle_id]).then((r) => r.rows[0] || null)
      : null;
    return {
      ok: true,
      duplicate: true,
      session: toRaidSessionView(session, existingResult, actions, bossCycle)
    };
  }
  if (session.status !== "active") {
    return { ok: false, error: "session_not_active" };
  }
  if (session.expires_at && new Date(session.expires_at).getTime() <= Date.now()) {
    await db.query(
      `UPDATE raid_sessions
       SET status = 'expired',
           updated_at = now()
       WHERE id = $1;`,
      [session.id]
    );
    return { ok: false, error: "session_expired" };
  }

  const sessionConfig = arenaEngine.getSessionConfig(config);
  if (Number(session.action_count || 0) < Math.max(4, sessionConfig.resolveMinActions)) {
    return {
      ok: false,
      error: "session_not_ready",
      min_actions: Math.max(4, sessionConfig.resolveMinActions),
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
    family: "boss",
    result: normalizeOutcomeForContract(outcome),
    combo: comboMax
  });
  const contractAdjusted = nexusContractEngine.applyContractToReward(anomalyAdjusted.reward, contractEval);
  const reward = contractAdjusted.reward;
  const ratingDelta = computeSessionRatingDelta(config, mode, outcome, score);
  const damageDone = Math.max(
    18,
    Math.round(Number(score || 0) * 1.1 + Number(comboMax || 0) * 3 + (outcome === "win" ? 60 : outcome === "near" ? 22 : 8))
  );

  const rewardRefs = {
    SC: deterministicUuid(`raid_session:${session.id}:SC`),
    HC: deterministicUuid(`raid_session:${session.id}:HC`),
    RC: deterministicUuid(`raid_session:${session.id}:RC`)
  };
  await economyStore.creditReward(db, {
    userId: profile.user_id,
    reward,
    reason: `raid_session_resolve_${outcome}`,
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
    Number(reward.rc || 0) * 3 + Number(reward.sc || 0) + Number(reward.hc || 0) * 10 + (outcome === "win" ? 7 : outcome === "near" ? 3 : 0)
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
    Number(reward.rc || 0) * 2 + Math.floor(Number(reward.sc || 0) / 2) + Number(reward.hc || 0) * 3 + Number(contractEval.war_bonus || 0)
  );
  const warCounter = await globalStore.incrementCounter(db, `war_pool_s${season.seasonId}`, warDelta);
  await userStore.touchStreakOnAction(db, {
    userId: profile.user_id,
    decayPerDay: Number(config.loops?.meso?.streak_decay_per_day || 1)
  });
  await userStore.addReputation(db, {
    userId: profile.user_id,
    points: Number(reward.rc || 0) + (outcome === "win" ? 4 : outcome === "near" ? 2 : 0),
    thresholds: config.kingdom?.thresholds
  });

  let bossCycle = null;
  if (session.boss_cycle_id) {
    bossCycle = await arenaStore.applyBossCycleDamage(db, {
      bossCycleId: session.boss_cycle_id,
      damageDone,
      metaPatch: {
        last_session_ref: sessionRef,
        last_outcome: outcome
      }
    });
  }

  await arenaStore.markRaidSessionResolved(db, {
    sessionId: session.id,
    modeFinal: mode,
    stateJson: {
      resolved_outcome: outcome,
      resolved_reward: reward,
      rating_delta: ratingDelta,
      season_points: seasonPoints,
      war_delta: warDelta,
      damage_done: damageDone
    }
  });

  const resultRef = deterministicUuid(`raid_session_result:${session.id}`);
  const result = await arenaStore.createRaidResult(db, {
    sessionId: session.id,
    resultRef,
    bossCycleId: session.boss_cycle_id || null,
    mode,
    outcome,
    rewardSc: Number(reward.sc || 0),
    rewardHc: Number(reward.hc || 0),
    rewardRc: Number(reward.rc || 0),
    ratingDelta,
    damageDone,
    resolvedJson: {
      season_id: season.seasonId,
      season_points: seasonPoints,
      war_delta: warDelta,
      war_pool: Number(warCounter.counter_value || 0),
      contract_eval: contractEval,
      anomaly_id: anomaly.id,
      anomaly_title: anomaly.title,
      boss_cycle: bossCycle
        ? {
            id: Number(bossCycle.id || 0),
            hp_remaining: Number(bossCycle.hp_remaining || 0),
            state: bossCycle.state
          }
        : null
    }
  });

  await antiAbuseEngine.applyRiskEvent(db, riskStore, config, {
    userId: profile.user_id,
    eventType: "arena_raid",
    context: {
      source: "raid_session",
      outcome,
      mode,
      rating_delta: ratingDelta
    }
  });
  await riskStore.insertBehaviorEvent(db, profile.user_id, "raid_session_resolve", {
    session_ref: sessionRef,
    score,
    mode,
    outcome,
    reward,
    rating_delta: ratingDelta,
    season_points: seasonPoints,
    war_delta: warDelta,
    damage_done: damageDone
  });
  await insertWebappEvent(db, {
    eventRef: deterministicUuid(`webapp:raid:resolve:${sessionRef}`),
    userId: profile.user_id,
    sessionRef,
    eventType: "raid_session_resolve",
    eventState: outcome,
    meta: {
      score,
      mode,
      outcome,
      reward,
      rating_delta: ratingDelta,
      damage_done: damageDone
    }
  });
  await insertFunnelEvent(db, {
    userId: profile.user_id,
    funnelName: "raid_v3",
    stepKey: "session_resolve",
    stepState: outcome,
    meta: { session_ref: sessionRef, mode, outcome, score }
  });

  const refreshed = await arenaStore.getRaidSessionByRef(db, profile.user_id, sessionRef);
  const actions = await arenaStore.getRaidActions(db, session.id);
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
    damage_done: damageDone,
    session: toRaidSessionView(refreshed || session, result, actions, bossCycle)
  };
}

async function getAuthoritativeRaidSessionState(db, { profile, sessionRef }) {
  const ready = await arenaStore.hasRaidSessionTables(db);
  if (!ready) {
    return { ok: false, error: "raid_session_tables_missing" };
  }
  await arenaStore.expireStaleRaidSessions(db, profile.user_id);
  let sessionBundle = null;
  if (sessionRef) {
    sessionBundle = await arenaStore.getRaidSessionWithResult(db, profile.user_id, sessionRef);
  } else {
    const active = await arenaStore.getActiveRaidSession(db, profile.user_id);
    if (active) {
      const result = await arenaStore.getRaidResultBySessionId(db, active.id);
      const actions = await arenaStore.getRaidActions(db, active.id);
      sessionBundle = { session: active, result, actions };
    } else {
      const latest = await arenaStore.getLatestResolvedRaidSession(db, profile.user_id, 180);
      if (latest) {
        const session = await arenaStore.getRaidSessionByRef(db, profile.user_id, latest.session_ref);
        const result = await arenaStore.getRaidResultBySessionId(db, latest.id);
        const actions = await arenaStore.getRaidActions(db, latest.id, 40);
        sessionBundle = { session, result, actions };
      }
    }
  }
  if (!sessionBundle || !sessionBundle.session) {
    return { ok: true, session: null };
  }
  const bossCycle = sessionBundle.session.boss_cycle_id
    ? await db.query(`SELECT * FROM boss_cycles WHERE id = $1 LIMIT 1;`, [sessionBundle.session.boss_cycle_id]).then((r) => r.rows[0] || null)
    : null;
  return {
    ok: true,
    session: toRaidSessionView(sessionBundle.session, sessionBundle.result, sessionBundle.actions, bossCycle)
  };
}

async function startAuthoritativePvpSession(
  db,
  { profile, config, requestId, modeSuggested, source, transportHint = "poll", wsEnabled = false }
) {
  const ready = await arenaStore.hasPvpSessionTables(db);
  if (!ready) {
    return { ok: false, error: "pvp_session_tables_missing" };
  }

  await arenaStore.expireStalePvpQueue(db, profile.user_id);
  await arenaStore.expireStalePvpSessions(db, profile.user_id);

  const existingActive = await arenaStore.getActivePvpSession(db, profile.user_id, { forUpdate: true });
  if (existingActive) {
    const existingResult = await arenaStore.getPvpResultBySessionId(db, existingActive.id);
    const existingActions = await arenaStore.getPvpActions(db, existingActive.id);
    return {
      ok: true,
      duplicate: true,
      transport: existingActive.transport || "poll",
      tick_ms: Number(existingActive.tick_ms || 1000),
      action_window_ms: Number(existingActive.action_window_ms || 800),
      session: toPvpSessionView(existingActive, existingResult, existingActions, profile.user_id)
    };
  }

  const arenaConfig = arenaEngine.getArenaConfig(config);
  const ticketRef = deterministicUuid(`pvp_ticket:${profile.user_id}:${requestId || Date.now()}`);
  const debit = await economyStore.debitCurrency(db, {
    userId: profile.user_id,
    currency: "RC",
    amount: arenaConfig.ticketCostRc,
    reason: "pvp_ticket_spend",
    refEventId: ticketRef,
    meta: {
      source: source || "webapp",
      request_id: requestId || null
    }
  });
  if (!debit.applied) {
    return {
      ok: false,
      error: debit.reason === "insufficient_balance" ? "insufficient_rc" : "pvp_ticket_error"
    };
  }

  let waitingSelf = await arenaStore.getWaitingQueueEntry(db, profile.user_id, { forUpdate: true });
  if (!waitingSelf) {
    waitingSelf = await arenaStore.createQueueEntry(db, {
      userId: profile.user_id,
      queueRef: deterministicUuid(`pvp_queue:${profile.user_id}:${requestId || Date.now()}`),
      desiredMode: String(modeSuggested || "balanced").toLowerCase(),
      ticketCostRc: arenaConfig.ticketCostRc,
      ttlSec: 90,
      metaJson: { source: source || "webapp" }
    });
    waitingSelf = await arenaStore.getWaitingQueueEntry(db, profile.user_id, { forUpdate: true });
  }

  let candidate = await arenaStore.findQueueCandidate(db, profile.user_id, { forUpdate: true });
  let opponentType = "shadow";
  let userRightId = null;
  if (candidate) {
    const candidateActive = await arenaStore.getActivePvpSession(db, candidate.user_id, { forUpdate: true });
    if (candidateActive) {
      await arenaStore.markQueueEntry(db, candidate.id, "cancelled", {
        cancel_reason: "already_in_session"
      });
      candidate = null;
    } else {
      opponentType = "live";
      userRightId = Number(candidate.user_id || 0);
      await arenaStore.markQueueEntry(db, candidate.id, "matched", {
        matched_with_user_id: profile.user_id
      });
      if (waitingSelf) {
        await arenaStore.markQueueEntry(db, waitingSelf.id, "matched", {
          matched_with_user_id: userRightId
        });
      }
    }
  }
  if (!candidate && waitingSelf) {
    await arenaStore.markQueueEntry(db, waitingSelf.id, "cancelled", {
      cancel_reason: "shadow_fallback"
    });
  }

  const season = seasonStore.getSeasonInfo(config);
  const mode = arenaEngine.getRaidMode(String(modeSuggested || "balanced").toLowerCase());
  const sessionRef = buildRunNonce(profile.user_id, requestId || `pvp:${Date.now()}`);
  const requestRef = requestId ? `pvp:${profile.user_id}:${requestId}` : null;
  const tickMs = 1000;
  const actionWindowMs = 800;
  const transport = wsEnabled && String(transportHint || "").toLowerCase() === "ws" ? "ws" : "poll";
  const stateJson = {
    phase: "combat",
    server_tick: 0,
    last_server_tick: Date.now(),
    hits_left: 0,
    misses_left: 0,
    hits_right: 0,
    misses_right: 0,
    next_expected_left: arenaEngine.expectedActionForSequence(`${sessionRef}:left`, 1),
    next_expected_right: arenaEngine.expectedActionForSequence(`${sessionRef}:right`, 1)
  };
  const seedJson = {
    season_id: season.seasonId,
    shadow_seed: opponentType === "shadow" ? deterministicUuid(`shadow:${sessionRef}`) : null,
    source: source || "webapp"
  };
  const created = await arenaStore.createPvpSession(db, {
    sessionRef,
    requestRef,
    transport,
    tickMs,
    actionWindowMs,
    userLeftId: profile.user_id,
    userRightId,
    opponentType,
    modeSuggested: mode.key,
    stateJson,
    seedJson,
    ttlSec: 75
  });

  await riskStore.insertBehaviorEvent(db, profile.user_id, "pvp_session_start", {
    session_ref: sessionRef,
    mode_suggested: mode.key,
    opponent_type: opponentType,
    transport
  });
  await insertWebappEvent(db, {
    eventRef: deterministicUuid(`webapp:pvp:start:${sessionRef}`),
    userId: profile.user_id,
    sessionRef,
    eventType: "pvp_session_start",
    eventState: opponentType,
    meta: {
      mode_suggested: mode.key,
      opponent_type: opponentType,
      transport
    }
  });
  await insertFunnelEvent(db, {
    userId: profile.user_id,
    funnelName: "pvp_v33",
    stepKey: "session_start",
    stepState: opponentType,
    meta: { session_ref: sessionRef, mode_suggested: mode.key }
  });

  return {
    ok: true,
    duplicate: false,
    transport,
    tick_ms: tickMs,
    action_window_ms: actionWindowMs,
    session: toPvpSessionView(created, null, [], profile.user_id)
  };
}

async function applyAuthoritativePvpAction(
  db,
  { profile, config, sessionRef, actionSeq, inputAction, latencyMs, clientTs, source }
) {
  const ready = await arenaStore.hasPvpSessionTables(db);
  if (!ready) {
    return { ok: false, error: "pvp_session_tables_missing" };
  }

  await arenaStore.expireStalePvpSessions(db, profile.user_id);
  const session = await arenaStore.getPvpSessionByRef(db, profile.user_id, sessionRef, { forUpdate: true });
  if (!session) {
    return { ok: false, error: "session_not_found" };
  }
  if (session.status !== "active") {
    const result = await arenaStore.getPvpResultBySessionId(db, session.id);
    const actions = await arenaStore.getPvpActions(db, session.id);
    return {
      ok: true,
      duplicate: true,
      transport: session.transport || "poll",
      tick_ms: Number(session.tick_ms || 1000),
      action_window_ms: Number(session.action_window_ms || 800),
      session: toPvpSessionView(session, result, actions, profile.user_id)
    };
  }
  if (session.expires_at && new Date(session.expires_at).getTime() <= Date.now()) {
    await db.query(
      `UPDATE pvp_sessions
       SET status = 'expired',
           updated_at = now()
       WHERE id = $1;`,
      [session.id]
    );
    await logPvpActionRejection(db, {
      sessionId: Number(session.id || 0),
      sessionRef: String(session.session_ref || sessionRef || ""),
      actorUserId: Number(profile.user_id || 0),
      actionSeq: Number(actionSeq || 0),
      inputAction: String(inputAction || ""),
      latencyMs: Number(latencyMs || 0),
      reasonCode: "session_expired",
      transport: String(session.transport || "poll"),
      source,
      rejectJson: {
        side: resolvePvpSide(session, profile.user_id),
        status: String(session.status || "expired")
      }
    });
    return { ok: false, error: "session_expired" };
  }

  const side = resolvePvpSide(session, profile.user_id);
  const sessionConfig = arenaEngine.getSessionConfig(config);
  const seq = Number(actionSeq || 0);
  if (!Number.isFinite(seq) || seq <= 0 || seq > sessionConfig.maxActions) {
    await logPvpActionRejection(db, {
      sessionId: Number(session.id || 0),
      sessionRef: String(session.session_ref || sessionRef || ""),
      actorUserId: Number(profile.user_id || 0),
      actionSeq: seq,
      inputAction: String(inputAction || ""),
      latencyMs: Number(latencyMs || 0),
      reasonCode: "invalid_action_seq_range",
      transport: String(session.transport || "poll"),
      source,
      rejectJson: {
        max_actions: Number(sessionConfig.maxActions || 0)
      }
    });
    return { ok: false, error: "invalid_action_seq" };
  }

  const state = session.state_json || {};
  const lastSeq = Number(state[`last_action_seq_${side}`] || 0);
  if (seq > lastSeq + 1) {
    await logPvpActionRejection(db, {
      sessionId: Number(session.id || 0),
      sessionRef: String(session.session_ref || sessionRef || ""),
      actorUserId: Number(profile.user_id || 0),
      actionSeq: seq,
      inputAction: String(inputAction || ""),
      latencyMs: Number(latencyMs || 0),
      reasonCode: "invalid_action_seq_gap",
      transport: String(session.transport || "poll"),
      source,
      rejectJson: {
        last_seq: lastSeq
      }
    });
    return { ok: false, error: "invalid_action_seq" };
  }
  if (seq <= lastSeq) {
    const existing = await arenaStore.getPvpActionBySeq(db, {
      sessionId: session.id,
      actorUserId: profile.user_id,
      actionSeq: seq
    });
    if (existing) {
      const actions = await arenaStore.getPvpActions(db, session.id);
      return {
        ok: true,
        duplicate: true,
        action: {
          action_seq: Number(existing.action_seq || seq),
          accepted: Boolean(existing.accepted),
          expected_action: String(existing.action_json?.expected_action || ""),
          score_delta: Number(existing.score_delta || 0),
          reject_reason: String(existing.reject_reason || existing.action_json?.reject_reason || "")
        },
        transport: session.transport || "poll",
        tick_ms: Number(session.tick_ms || 1000),
        action_window_ms: Number(session.action_window_ms || 800),
        session: toPvpSessionView(session, null, actions, profile.user_id)
      };
    }
  }

  const scoreCurrent = Number(side === "left" ? session.score_left || 0 : session.score_right || 0);
  const comboCurrent = Number(side === "left" ? session.combo_left || 0 : session.combo_right || 0);
  const actionCountCurrent = Number(side === "left" ? session.action_count_left || 0 : session.action_count_right || 0);
  const hitsCurrent = Number(state[`hits_${side}`] || 0);
  const missesCurrent = Number(state[`misses_${side}`] || 0);
  const evaluation = arenaEngine.evaluateSessionAction(
    {
      sessionRef: `${session.session_ref}:${side}`,
      score: scoreCurrent,
      combo: comboCurrent,
      comboMax: comboCurrent,
      hits: hitsCurrent,
      misses: missesCurrent,
      actionCount: actionCountCurrent
    },
    {
      actionSeq: seq,
      inputAction,
      latencyMs: Math.max(0, Number(latencyMs || 0))
    },
    config
  );

  if (evaluation.latencyMs > Number(session.action_window_ms || 800)) {
    evaluation.accepted = false;
    evaluation.scoreDelta = -Math.max(3, Math.round(evaluation.latencyMs / 500));
    evaluation.comboAfter = 0;
    evaluation.hitsAfter = hitsCurrent;
    evaluation.missesAfter = missesCurrent + 1;
    evaluation.actionCount = actionCountCurrent + 1;
    evaluation.scoreAfter = Math.max(0, scoreCurrent + evaluation.scoreDelta);
    evaluation.comboMax = Math.max(comboCurrent, 0);
    evaluation.rejectReason = "latency_window_exceeded";
    evaluation.rejectMeta = {
      action_window_ms: Number(session.action_window_ms || 800),
      latency_ms: Number(evaluation.latencyMs || 0)
    };
  }
  if (!evaluation.accepted && !evaluation.rejectReason) {
    evaluation.rejectReason = "pattern_miss";
    evaluation.rejectMeta = {
      expected_action: String(evaluation.expectedAction || ""),
      input_action: String(evaluation.inputAction || "")
    };
  }

  const actionRow = await arenaStore.upsertPvpAction(db, {
    sessionId: session.id,
    actorUserId: profile.user_id,
    actionSeq: seq,
    inputAction: evaluation.inputAction || "guard",
    latencyMs: evaluation.latencyMs,
    accepted: evaluation.accepted,
    scoreDelta: evaluation.scoreDelta,
    serverTick: Number(state.server_tick || 0) + 1,
    rejectReason: String(evaluation.rejectReason || ""),
    actionJson: {
      expected_action: evaluation.expectedAction,
      side,
      client_ts: Number(clientTs || 0),
      source: source || "webapp",
      reject_reason: String(evaluation.rejectReason || "")
    }
  });
  const duplicate = !Boolean(actionRow?.inserted);
  if (!duplicate) {
    const statePatch = {
      [`hits_${side}`]: evaluation.hitsAfter,
      [`misses_${side}`]: evaluation.missesAfter,
      [`combo_${side}`]: evaluation.comboAfter,
      [`action_count_${side}`]: evaluation.actionCount,
      [`last_action_seq_${side}`]: seq,
      [`last_latency_ms_${side}`]: evaluation.latencyMs,
      [`next_expected_${side}`]: arenaEngine.expectedActionForSequence(`${session.session_ref}:${side}`, seq + 1),
      last_server_tick: Date.now(),
      server_tick: Number(state.server_tick || 0) + 1
    };
    await arenaStore.updatePvpSessionProgress(db, {
      sessionId: session.id,
      side,
      score: evaluation.scoreAfter,
      combo: evaluation.comboAfter,
      actionCount: evaluation.actionCount,
      stateJson: statePatch
    });
    await riskStore.insertBehaviorEvent(db, profile.user_id, "pvp_session_action", {
      session_ref: sessionRef,
      side,
      action_seq: seq,
      input_action: evaluation.inputAction,
      accepted: evaluation.accepted,
      latency_ms: evaluation.latencyMs
    });
    await insertWebappEvent(db, {
      eventRef: deterministicUuid(`webapp:pvp:action:${sessionRef}:${profile.user_id}:${seq}`),
      userId: profile.user_id,
      sessionRef,
      eventType: "pvp_session_action",
      eventState: evaluation.accepted ? "ok" : "miss",
      latencyMs: evaluation.latencyMs,
      meta: {
        side,
        action_seq: seq,
        input_action: evaluation.inputAction,
        expected_action: evaluation.expectedAction
      }
    });

    if (!evaluation.accepted) {
      await logPvpActionRejection(db, {
        sessionId: Number(session.id || 0),
        sessionRef: String(session.session_ref || sessionRef || ""),
        actorUserId: Number(profile.user_id || 0),
        actionSeq: seq,
        inputAction: evaluation.inputAction || "guard",
        latencyMs: Number(evaluation.latencyMs || 0),
        reasonCode: String(evaluation.rejectReason || "rejected"),
        transport: String(session.transport || "poll"),
        source,
        rejectJson: {
          side,
          expected_action: String(evaluation.expectedAction || ""),
          score_delta: Number(evaluation.scoreDelta || 0),
          ...(evaluation.rejectMeta || {})
        }
      });
    }
  }

  const refreshed = await arenaStore.getPvpSessionByRef(db, profile.user_id, sessionRef);
  const actions = await arenaStore.getPvpActions(db, session.id);
  return {
    ok: true,
    duplicate,
    transport: refreshed?.transport || session.transport || "poll",
    tick_ms: Number(refreshed?.tick_ms || session.tick_ms || 1000),
    action_window_ms: Number(refreshed?.action_window_ms || session.action_window_ms || 800),
    action: {
      action_seq: seq,
      accepted: evaluation.accepted,
      expected_action: evaluation.expectedAction,
      score_delta: evaluation.scoreDelta,
      reject_reason: String(evaluation.rejectReason || ""),
      score_after: Number(
        side === "left" ? refreshed?.score_left || evaluation.scoreAfter : refreshed?.score_right || evaluation.scoreAfter
      ),
      combo_after: evaluation.comboAfter
    },
    session: toPvpSessionView(refreshed || session, null, actions, profile.user_id)
  };
}

async function resolveAuthoritativePvpSession(db, { profile, config, sessionRef, source }) {
  const ready = await arenaStore.hasPvpSessionTables(db);
  if (!ready) {
    return { ok: false, error: "pvp_session_tables_missing" };
  }
  await arenaStore.expireStalePvpSessions(db, profile.user_id);
  const session = await arenaStore.getPvpSessionByRef(db, profile.user_id, sessionRef, { forUpdate: true });
  if (!session) {
    return { ok: false, error: "session_not_found" };
  }
  const existingResult = await arenaStore.getPvpResultBySessionId(db, session.id);
  if (existingResult) {
    const actions = await arenaStore.getPvpActions(db, session.id);
    return {
      ok: true,
      duplicate: true,
      transport: session.transport || "poll",
      tick_ms: Number(session.tick_ms || 1000),
      action_window_ms: Number(session.action_window_ms || 800),
      session: toPvpSessionView(session, existingResult, actions, profile.user_id)
    };
  }
  if (session.status !== "active") {
    return { ok: false, error: "session_not_active" };
  }
  if (session.expires_at && new Date(session.expires_at).getTime() <= Date.now()) {
    await db.query(
      `UPDATE pvp_sessions
       SET status = 'expired',
           updated_at = now()
       WHERE id = $1;`,
      [session.id]
    );
    return { ok: false, error: "session_expired" };
  }

  const minActions = Math.max(4, Math.min(12, Number(arenaEngine.getSessionConfig(config).resolveMinActions || 6)));
  const leftActions = Number(session.action_count_left || 0);
  const rightActions = Number(session.action_count_right || 0);
  if (leftActions < minActions || (session.opponent_type === "live" && rightActions < minActions)) {
    return {
      ok: false,
      error: "session_not_ready",
      min_actions: minActions,
      action_count: {
        left: leftActions,
        right: rightActions
      }
    };
  }

  let scoreLeft = Number(session.score_left || 0);
  let scoreRight = Number(session.score_right || 0);
  if (session.opponent_type === "shadow" && Number(session.user_right_id || 0) === 0) {
    scoreRight = computePvpShadowScore(session.session_ref, scoreLeft, leftActions);
  }
  const diff = scoreLeft - scoreRight;
  const winnerSide = Math.abs(diff) <= 6 ? "draw" : diff > 0 ? "left" : "right";
  const mode = arenaEngine.resolveSessionModeByScore(Math.max(scoreLeft, scoreRight));
  const season = seasonStore.getSeasonInfo(config);
  const anomaly = nexusEventEngine.resolveDailyAnomaly(config, { seasonId: season.seasonId });
  const contract = nexusContractEngine.resolveDailyContract(config, {
    seasonId: season.seasonId,
    anomalyId: anomaly.id
  });

  const participantRows = [
    {
      side: "left",
      userId: Number(session.user_left_id || 0),
      score: scoreLeft,
      combo: Number(session.combo_left || 0),
      actionCount: leftActions,
      hits: Number(session.state_json?.hits_left || 0),
      misses: Number(session.state_json?.misses_left || 0)
    }
  ];
  if (Number(session.user_right_id || 0) > 0) {
    participantRows.push({
      side: "right",
      userId: Number(session.user_right_id || 0),
      score: scoreRight,
      combo: Number(session.combo_right || 0),
      actionCount: rightActions,
      hits: Number(session.state_json?.hits_right || 0),
      misses: Number(session.state_json?.misses_right || 0)
    });
  }

  const rewardsBySide = {};
  const ratingsBySide = {};
  let winnerUserId = null;
  for (const row of participantRows) {
    const participantProfile =
      Number(row.userId || 0) === Number(profile.user_id || 0)
        ? profile
        : await getIdentityProfileSnapshot(db, row.userId);
    if (!participantProfile) {
      continue;
    }
    const participantOutcomeRaw = pvpOutcomeForSide(winnerSide, row.side);
    const participantOutcome = participantOutcomeRaw === "draw" ? "near" : participantOutcomeRaw;
    const riskState = await riskStore.getRiskState(db, row.userId);
    const arenaConfig = arenaEngine.getArenaConfig(config);
    const arenaState = await arenaStore.getArenaState(db, row.userId, arenaConfig.baseRating);
    const rewardInfo = arenaEngine.computeSessionReward(config, {
      mode,
      outcome: participantOutcome,
      score: row.score,
      hits: row.hits,
      misses: row.misses,
      risk: Number(riskState.riskScore || 0),
      kingdomTier: Number(participantProfile.kingdom_tier || 0),
      streak: Number(participantProfile.current_streak || 0),
      rating: Number(arenaState?.rating || arenaConfig.baseRating)
    });
    const activeEffects = await shopStore.getActiveEffects(db, row.userId);
    const boostedReward = shopStore.applyEffectsToReward(rewardInfo.reward, activeEffects);
    const anomalyAdjusted = nexusEventEngine.applyAnomalyToReward(boostedReward, anomaly, { modeKey: mode });
    const contractEval = nexusContractEngine.evaluateAttempt(contract, {
      modeKey: mode,
      family: "duel",
      result: normalizeOutcomeForContract(participantOutcome),
      combo: row.combo
    });
    const reward = nexusContractEngine.applyContractToReward(anomalyAdjusted.reward, contractEval).reward;
    const ratingDelta = computeSessionRatingDelta(config, mode, participantOutcome, row.score);
    const rewardRefs = {
      SC: deterministicUuid(`pvp_session:${session.id}:${row.side}:SC`),
      HC: deterministicUuid(`pvp_session:${session.id}:${row.side}:HC`),
      RC: deterministicUuid(`pvp_session:${session.id}:${row.side}:RC`)
    };
    await economyStore.creditReward(db, {
      userId: row.userId,
      reward,
      reason: `pvp_session_resolve_${participantOutcome}`,
      meta: {
        session_ref: sessionRef,
        side: row.side,
        mode,
        outcome: participantOutcome,
        source: source || "webapp"
      },
      refEventIds: rewardRefs
    });
    const nextArena = await arenaStore.applyArenaOutcome(db, {
      userId: row.userId,
      ratingDelta,
      outcome: participantOutcome
    });
    const seasonPoints = Math.max(
      0,
      Math.round(
        Number(reward.rc || 0) * 2 +
          Number(reward.sc || 0) +
          Number(reward.hc || 0) * 8 +
          (participantOutcome === "win" ? 5 : participantOutcome === "near" ? 2 : 0)
      )
    );
    await seasonStore.addSeasonPoints(db, {
      userId: row.userId,
      seasonId: season.seasonId,
      points: seasonPoints
    });
    await seasonStore.syncIdentitySeasonRank(db, {
      userId: row.userId,
      seasonId: season.seasonId
    });
    const warDelta = Math.max(1, Number(reward.rc || 0) + Math.floor(Number(reward.sc || 0) / 3));
    await globalStore.incrementCounter(db, `war_pool_s${season.seasonId}`, warDelta);
    await userStore.touchStreakOnAction(db, {
      userId: row.userId,
      decayPerDay: Number(config.loops?.meso?.streak_decay_per_day || 1)
    });
    await userStore.addReputation(db, {
      userId: row.userId,
      points: Number(reward.rc || 0) + (participantOutcome === "win" ? 3 : participantOutcome === "near" ? 1 : 0),
      thresholds: config.kingdom?.thresholds
    });
    await arenaStore.insertPvpRatingHistory(db, {
      userId: row.userId,
      sessionId: session.id,
      ratingBefore: Number(arenaState?.rating || arenaConfig.baseRating),
      ratingDelta,
      ratingAfter: Number(nextArena?.rating || arenaConfig.baseRating),
      outcome: participantOutcomeRaw,
      metaJson: {
        session_ref: sessionRef,
        side: row.side,
        score: row.score,
        mode,
        outcome: participantOutcomeRaw
      }
    });
    await antiAbuseEngine.applyRiskEvent(db, riskStore, config, {
      userId: row.userId,
      eventType: "arena_pvp",
      context: {
        session_ref: sessionRef,
        side: row.side,
        outcome: participantOutcomeRaw,
        mode,
        rating_delta: ratingDelta
      }
    });
    await riskStore.insertBehaviorEvent(db, row.userId, "pvp_session_resolve", {
      session_ref: sessionRef,
      side: row.side,
      mode,
      outcome: participantOutcomeRaw,
      reward,
      rating_delta: ratingDelta
    });
    rewardsBySide[row.side] = {
      sc: Number(reward.sc || 0),
      hc: Number(reward.hc || 0),
      rc: Number(reward.rc || 0),
      outcome: participantOutcomeRaw
    };
    ratingsBySide[row.side] = {
      delta: Number(ratingDelta || 0),
      after: Number(nextArena?.rating || 0)
    };
    if (winnerSide === row.side) {
      winnerUserId = row.userId;
    }
  }

  await arenaStore.markPvpSessionResolved(db, {
    sessionId: session.id,
    modeFinal: mode,
    winnerSide,
    scoreLeft,
    scoreRight,
    stateJson: {
      resolved_outcome: winnerSide === "draw" ? "draw" : winnerSide === "left" ? "left_win" : "right_win",
      last_server_tick: Date.now(),
      server_tick: Number(session.state_json?.server_tick || 0) + 1
    }
  });

  const leftOutcome = pvpOutcomeForSide(winnerSide, "left");
  const leftReward = rewardsBySide.left || { sc: 0, hc: 0, rc: 0 };
  const leftRating = ratingsBySide.left || { delta: 0 };
  const result = await arenaStore.createPvpResult(db, {
    sessionId: session.id,
    resultRef: deterministicUuid(`pvp_session_result:${session.id}`),
    winnerUserId,
    mode,
    outcome: leftOutcome === "draw" ? "draw" : leftOutcome === "win" ? "win" : "loss",
    scoreLeft,
    scoreRight,
    rewardSc: Number(leftReward.sc || 0),
    rewardHc: Number(leftReward.hc || 0),
    rewardRc: Number(leftReward.rc || 0),
    ratingDelta: Number(leftRating.delta || 0),
    resolvedJson: {
      winner_side: winnerSide,
      transport: session.transport || "poll",
      tick_ms: Number(session.tick_ms || 1000),
      action_window_ms: Number(session.action_window_ms || 800),
      rewards_by_side: rewardsBySide,
      ratings_by_side: ratingsBySide,
      anomaly_id: anomaly.id,
      anomaly_title: anomaly.title,
      contract_id: contract.id,
      contract_title: contract.title
    }
  });

  await insertWebappEvent(db, {
    eventRef: deterministicUuid(`webapp:pvp:resolve:${sessionRef}`),
    userId: profile.user_id,
    sessionRef,
    eventType: "pvp_session_resolve",
    eventState: winnerSide,
    meta: {
      winner_side: winnerSide,
      score_left: scoreLeft,
      score_right: scoreRight
    }
  });
  await insertFunnelEvent(db, {
    userId: profile.user_id,
    funnelName: "pvp_v33",
    stepKey: "session_resolve",
    stepState: winnerSide,
    meta: { session_ref: sessionRef, mode, winner_side: winnerSide }
  });

  const refreshed = await arenaStore.getPvpSessionByRef(db, profile.user_id, sessionRef);
  const actions = await arenaStore.getPvpActions(db, session.id);
  return {
    ok: true,
    duplicate: false,
    transport: session.transport || "poll",
    tick_ms: Number(session.tick_ms || 1000),
    action_window_ms: Number(session.action_window_ms || 800),
    winner_side: winnerSide,
    session: toPvpSessionView(refreshed || session, result, actions, profile.user_id)
  };
}

async function getAuthoritativePvpSessionState(db, { profile, sessionRef }) {
  const ready = await arenaStore.hasPvpSessionTables(db);
  if (!ready) {
    return { ok: false, error: "pvp_session_tables_missing" };
  }
  await arenaStore.expireStalePvpQueue(db, profile.user_id);
  await arenaStore.expireStalePvpSessions(db, profile.user_id);

  let sessionBundle = null;
  if (sessionRef) {
    sessionBundle = await arenaStore.getPvpSessionWithResult(db, profile.user_id, sessionRef);
  } else {
    const active = await arenaStore.getActivePvpSession(db, profile.user_id);
    if (active) {
      const result = await arenaStore.getPvpResultBySessionId(db, active.id);
      const actions = await arenaStore.getPvpActions(db, active.id);
      sessionBundle = { session: active, result, actions };
    } else {
      const latest = await arenaStore.getLatestResolvedPvpSession(db, profile.user_id, 180);
      if (latest) {
        const session = await arenaStore.getPvpSessionByRef(db, profile.user_id, latest.session_ref);
        const result = await arenaStore.getPvpResultBySessionId(db, latest.id);
        const actions = await arenaStore.getPvpActions(db, latest.id, 80);
        sessionBundle = { session, result, actions };
      }
    }
  }
  if (!sessionBundle || !sessionBundle.session) {
    return { ok: true, session: null };
  }
  return {
    ok: true,
    transport: sessionBundle.session.transport || "poll",
    tick_ms: Number(sessionBundle.session.tick_ms || 1000),
    action_window_ms: Number(sessionBundle.session.action_window_ms || 800),
    session: toPvpSessionView(sessionBundle.session, sessionBundle.result, sessionBundle.actions, profile.user_id)
  };
}

async function getPvpLiveLeaderboard(db, { limit = 25 } = {}) {
  const leaders = await arenaStore.getPvpLeaderboardLive(db, limit);
  return {
    ok: true,
    leaderboard: (leaders || []).map((row, idx) => ({
      rank: idx + 1,
      user_id: Number(row.user_id || 0),
      public_name: row.public_name || `u${row.user_id}`,
      rating: Number(row.rating || 1000),
      matches_total: Number(row.matches_total || 0),
      matches_24h: Number(row.matches_24h || 0),
      last_match_at: row.last_match_at || null
    }))
  };
}

module.exports = {
  runArenaRaid,
  buildRunNonce,
  startAuthoritativeSession,
  applyAuthoritativeSessionAction,
  resolveAuthoritativeSession,
  getAuthoritativeSessionState,
  startAuthoritativeRaidSession,
  applyAuthoritativeRaidAction,
  resolveAuthoritativeRaidSession,
  getAuthoritativeRaidSessionState,
  startAuthoritativePvpSession,
  applyAuthoritativePvpAction,
  resolveAuthoritativePvpSession,
  getAuthoritativePvpSessionState,
  getPvpLiveLeaderboard,
  buildDirectorView
};
