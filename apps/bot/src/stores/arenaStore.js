async function hasArenaTables(db) {
  const result = await db.query(
    `SELECT
        to_regclass('public.arena_state') AS arena_state,
        to_regclass('public.arena_runs') AS arena_runs;`
  );
  const row = result.rows[0] || {};
  return Boolean(row.arena_state && row.arena_runs);
}

async function hasArenaSessionTables(db) {
  const result = await db.query(
    `SELECT
        to_regclass('public.arena_sessions') AS arena_sessions,
        to_regclass('public.arena_session_actions') AS arena_session_actions,
        to_regclass('public.arena_session_results') AS arena_session_results;`
  );
  const row = result.rows[0] || {};
  return Boolean(row.arena_sessions && row.arena_session_actions && row.arena_session_results);
}

async function ensureArenaState(db, userId, baseRating = 1000) {
  const safeBase = Math.max(100, Number(baseRating || 1000));
  await db.query(
    `INSERT INTO arena_state (user_id, rating)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO NOTHING;`,
    [userId, safeBase]
  );
}

async function getArenaState(db, userId, baseRating = 1000) {
  await ensureArenaState(db, userId, baseRating);
  const result = await db.query(
    `SELECT user_id, rating, games_played, wins, losses, last_result, last_play_at, updated_at
     FROM arena_state
     WHERE user_id = $1
     LIMIT 1;`,
    [userId]
  );
  return result.rows[0] || null;
}

async function applyArenaOutcome(db, { userId, ratingDelta, outcome }) {
  const safeDelta = Number(ratingDelta || 0);
  const safeOutcome = String(outcome || "loss");
  const result = await db.query(
    `UPDATE arena_state
     SET rating = GREATEST(0, rating + $2),
         games_played = games_played + 1,
         wins = wins + CASE WHEN $3 = 'win' THEN 1 ELSE 0 END,
         losses = losses + CASE WHEN $3 = 'loss' THEN 1 ELSE 0 END,
         last_result = $3,
         last_play_at = now(),
         updated_at = now()
     WHERE user_id = $1
     RETURNING user_id, rating, games_played, wins, losses, last_result, last_play_at, updated_at;`,
    [userId, safeDelta, safeOutcome]
  );
  return result.rows[0] || null;
}

async function touchArenaCooldown(db, userId) {
  const result = await db.query(
    `UPDATE arena_state
     SET last_play_at = now(),
         updated_at = now()
     WHERE user_id = $1
     RETURNING last_play_at;`,
    [userId]
  );
  return result.rows[0] || null;
}

async function getRunByNonce(db, runNonce) {
  const result = await db.query(
    `SELECT *
     FROM arena_runs
     WHERE run_nonce = $1
     LIMIT 1;`,
    [runNonce]
  );
  return result.rows[0] || null;
}

async function createRun(db, payload) {
  const result = await db.query(
    `INSERT INTO arena_runs (
        run_nonce,
        user_id,
        season_id,
        mode,
        risk_before,
        player_power,
        enemy_power,
        win_probability,
        outcome,
        rating_delta,
        rating_after,
        reward_sc,
        reward_hc,
        reward_rc,
        meta_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
      RETURNING *;`,
    [
      payload.runNonce,
      payload.userId,
      payload.seasonId,
      payload.mode,
      payload.riskBefore,
      payload.playerPower,
      payload.enemyPower,
      payload.winProbability,
      payload.outcome,
      payload.ratingDelta,
      payload.ratingAfter,
      payload.reward.sc,
      payload.reward.hc,
      payload.reward.rc,
      JSON.stringify(payload.meta || {})
    ]
  );
  return result.rows[0] || null;
}

async function createRunIdempotent(db, payload) {
  try {
    return await createRun(db, payload);
  } catch (err) {
    if (err.code !== "23505") {
      throw err;
    }
    return getRunByNonce(db, payload.runNonce);
  }
}

async function getRecentRuns(db, userId, limit = 8) {
  const safeLimit = Math.max(1, Math.min(50, Number(limit || 8)));
  const result = await db.query(
    `SELECT id, mode, outcome, rating_delta, rating_after, reward_sc, reward_hc, reward_rc, created_at
     FROM arena_runs
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2;`,
    [userId, safeLimit]
  );
  return result.rows;
}

async function getLeaderboard(db, seasonId, limit = 10) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit || 10)));
  const result = await db.query(
    `SELECT
        s.user_id,
        i.public_name,
        s.rating,
        s.games_played,
        s.wins,
        s.losses,
        COALESCE(sr.season_points, 0) AS season_points
     FROM arena_state s
     JOIN identities i ON i.user_id = s.user_id
     LEFT JOIN season_stats sr ON sr.user_id = s.user_id AND sr.season_id = $1
     ORDER BY s.rating DESC, s.updated_at ASC
     LIMIT $2;`,
    [seasonId, safeLimit]
  );
  return result.rows;
}

async function getRank(db, userId) {
  const result = await db.query(
    `WITH ranked AS (
       SELECT
         user_id,
         rating,
         rank() OVER (ORDER BY rating DESC, updated_at ASC) AS rank
       FROM arena_state
     )
     SELECT user_id, rating, rank
     FROM ranked
     WHERE user_id = $1
     LIMIT 1;`,
    [userId]
  );
  return result.rows[0] || null;
}

async function expireStaleSessions(db, userId = null) {
  if (userId) {
    await db.query(
      `UPDATE arena_sessions
       SET status = 'expired',
           updated_at = now()
       WHERE user_id = $1
         AND status = 'active'
         AND expires_at <= now();`,
      [userId]
    );
    return;
  }

  await db.query(
    `UPDATE arena_sessions
     SET status = 'expired',
         updated_at = now()
     WHERE status = 'active'
       AND expires_at <= now();`
  );
}

async function getActiveSession(db, userId, { forUpdate = false } = {}) {
  const suffix = forUpdate ? "FOR UPDATE" : "";
  const result = await db.query(
    `SELECT *
     FROM arena_sessions
     WHERE user_id = $1
       AND status = 'active'
       AND expires_at > now()
     ORDER BY started_at DESC, id DESC
     LIMIT 1
     ${suffix};`,
    [userId]
  );
  return result.rows[0] || null;
}

async function getSessionByRef(db, userId, sessionRef, { forUpdate = false } = {}) {
  const suffix = forUpdate ? "FOR UPDATE" : "";
  const result = await db.query(
    `SELECT *
     FROM arena_sessions
     WHERE user_id = $1
       AND session_ref = $2
     LIMIT 1
     ${suffix};`,
    [userId, sessionRef]
  );
  return result.rows[0] || null;
}

async function createSession(db, payload) {
  const ttlSec = Math.max(30, Math.min(3600, Number(payload.ttlSec || 180)));
  try {
    const result = await db.query(
      `INSERT INTO arena_sessions (
          session_ref,
          user_id,
          season_id,
          mode_suggested,
          request_meta,
          state_json,
          expires_at
       )
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, now() + make_interval(secs => $7))
       RETURNING *;`,
      [
        payload.sessionRef,
        payload.userId,
        Number(payload.seasonId || 0),
        payload.modeSuggested || "balanced",
        JSON.stringify(payload.requestMeta || {}),
        JSON.stringify(payload.stateJson || {}),
        ttlSec
      ]
    );
    return result.rows[0] || null;
  } catch (err) {
    if (err.code !== "23505") {
      throw err;
    }
    if (payload.sessionRef) {
      const byRef = await getSessionByRef(db, payload.userId, payload.sessionRef);
      if (byRef) {
        return byRef;
      }
    }
    return getActiveSession(db, payload.userId);
  }
}

async function upsertSessionAction(db, payload) {
  const result = await db.query(
    `WITH upsert AS (
       INSERT INTO arena_session_actions (
         session_id,
         action_seq,
         input_action,
         latency_ms,
         accepted,
         score_delta,
         combo_after,
         action_json
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       ON CONFLICT (session_id, action_seq)
       DO UPDATE SET action_json = arena_session_actions.action_json
       RETURNING id, session_id, action_seq, input_action, latency_ms, accepted, score_delta, combo_after, action_json, created_at, (xmax = 0) AS inserted
     )
     SELECT * FROM upsert;`,
    [
      payload.sessionId,
      Number(payload.actionSeq || 0),
      payload.inputAction,
      Math.max(0, Number(payload.latencyMs || 0)),
      Boolean(payload.accepted),
      Number(payload.scoreDelta || 0),
      Number(payload.comboAfter || 0),
      JSON.stringify(payload.actionJson || {})
    ]
  );
  return result.rows[0] || null;
}

async function updateSessionProgress(db, payload) {
  const result = await db.query(
    `UPDATE arena_sessions
     SET score = $2,
         combo_max = $3,
         hits = $4,
         misses = $5,
         action_count = $6,
         state_json = COALESCE(state_json, '{}'::jsonb) || $7::jsonb,
         updated_at = now()
     WHERE id = $1
     RETURNING *;`,
    [
      payload.sessionId,
      Number(payload.score || 0),
      Number(payload.comboMax || 0),
      Number(payload.hits || 0),
      Number(payload.misses || 0),
      Number(payload.actionCount || 0),
      JSON.stringify(payload.stateJson || {})
    ]
  );
  return result.rows[0] || null;
}

async function markSessionResolved(db, payload) {
  const result = await db.query(
    `UPDATE arena_sessions
     SET status = 'resolved',
         mode_final = $2,
         resolved_at = now(),
         state_json = COALESCE(state_json, '{}'::jsonb) || $3::jsonb,
         updated_at = now()
     WHERE id = $1
       AND status IN ('active', 'resolved')
     RETURNING *;`,
    [payload.sessionId, payload.modeFinal || "balanced", JSON.stringify(payload.stateJson || {})]
  );
  return result.rows[0] || null;
}

async function createSessionResult(db, payload) {
  try {
    const result = await db.query(
      `INSERT INTO arena_session_results (
          session_id,
          result_ref,
          mode,
          outcome,
          reward_sc,
          reward_hc,
          reward_rc,
          rating_delta,
          resolved_json
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       RETURNING *;`,
      [
        payload.sessionId,
        payload.resultRef,
        payload.mode || "balanced",
        payload.outcome || "near",
        Number(payload.rewardSc || 0),
        Number(payload.rewardHc || 0),
        Number(payload.rewardRc || 0),
        Number(payload.ratingDelta || 0),
        JSON.stringify(payload.resolvedJson || {})
      ]
    );
    return result.rows[0] || null;
  } catch (err) {
    if (err.code !== "23505") {
      throw err;
    }
    const existing = await db.query(
      `SELECT *
       FROM arena_session_results
       WHERE session_id = $1
       LIMIT 1;`,
      [payload.sessionId]
    );
    return existing.rows[0] || null;
  }
}

async function getSessionResultBySessionId(db, sessionId) {
  const result = await db.query(
    `SELECT *
     FROM arena_session_results
     WHERE session_id = $1
     LIMIT 1;`,
    [sessionId]
  );
  return result.rows[0] || null;
}

async function getSessionActions(db, sessionId, limit = 120) {
  const safeLimit = Math.max(1, Math.min(500, Number(limit || 120)));
  const result = await db.query(
    `SELECT id, session_id, action_seq, input_action, latency_ms, accepted, score_delta, combo_after, action_json, created_at
     FROM arena_session_actions
     WHERE session_id = $1
     ORDER BY action_seq ASC, id ASC
     LIMIT $2;`,
    [sessionId, safeLimit]
  );
  return result.rows;
}

async function getSessionWithResult(db, userId, sessionRef, { forUpdate = false } = {}) {
  const session = await getSessionByRef(db, userId, sessionRef, { forUpdate });
  if (!session) {
    return null;
  }
  const result = await getSessionResultBySessionId(db, session.id);
  const actions = await getSessionActions(db, session.id);
  return {
    session,
    result,
    actions
  };
}

async function getLatestResolvedSession(db, userId, limitMinutes = 30) {
  const safeLimit = Math.max(1, Math.min(720, Number(limitMinutes || 30)));
  const result = await db.query(
    `SELECT s.*, r.mode, r.outcome, r.reward_sc, r.reward_hc, r.reward_rc, r.rating_delta, r.created_at AS result_created_at
     FROM arena_sessions s
     JOIN arena_session_results r ON r.session_id = s.id
     WHERE s.user_id = $1
       AND s.status = 'resolved'
       AND s.resolved_at >= now() - make_interval(mins => $2)
     ORDER BY s.resolved_at DESC, s.id DESC
     LIMIT 1;`,
    [userId, safeLimit]
  );
  return result.rows[0] || null;
}

module.exports = {
  hasArenaTables,
  hasArenaSessionTables,
  ensureArenaState,
  getArenaState,
  applyArenaOutcome,
  touchArenaCooldown,
  getRunByNonce,
  createRun,
  createRunIdempotent,
  getRecentRuns,
  getLeaderboard,
  getRank,
  expireStaleSessions,
  getActiveSession,
  getSessionByRef,
  createSession,
  upsertSessionAction,
  updateSessionProgress,
  markSessionResolved,
  createSessionResult,
  getSessionResultBySessionId,
  getSessionActions,
  getSessionWithResult,
  getLatestResolvedSession
};
