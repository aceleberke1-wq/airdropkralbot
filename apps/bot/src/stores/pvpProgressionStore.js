function toSafeInt(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.floor(num));
}

function normalizeJson(value) {
  return value && typeof value === "object" ? value : {};
}

function isMissingRelationError(err) {
  return err && (err.code === "42P01" || err.code === "42703");
}

async function queryFirstOrNull(db, text, values) {
  try {
    const result = await db.query(text, values);
    return result.rows?.[0] || null;
  } catch (err) {
    if (isMissingRelationError(err)) {
      return null;
    }
    throw err;
  }
}

async function getSnapshot(
  db,
  { userId, seasonId, dayKey, weekKey }
) {
  const safeUserId = toSafeInt(userId);
  const safeSeasonId = toSafeInt(seasonId);
  const safeDayKey = String(dayKey || "").trim();
  const safeWeekKey = String(weekKey || "").trim();
  if (!safeUserId || !safeSeasonId || !safeDayKey || !safeWeekKey) {
    return null;
  }

  const [daily, weekly, season] = await Promise.all([
    queryFirstOrNull(
      db,
      `SELECT duel_wins, duel_claimed, points_delta, state_json, updated_at
       FROM v5_pvp_progression_daily
       WHERE user_id = $1 AND season_id = $2 AND day_key = $3
       LIMIT 1;`,
      [safeUserId, safeSeasonId, safeDayKey]
    ),
    queryFirstOrNull(
      db,
      `SELECT ladder_points, milestones_claimed, state_json, updated_at
       FROM v5_pvp_progression_weekly
       WHERE user_id = $1 AND season_id = $2 AND week_key = $3
       LIMIT 1;`,
      [safeUserId, safeSeasonId, safeWeekKey]
    ),
    queryFirstOrNull(
      db,
      `SELECT arc_personal_contribution, arc_personal_claimed, arc_global_contribution, state_json, updated_at
       FROM v5_pvp_progression_season
       WHERE user_id = $1 AND season_id = $2
       LIMIT 1;`,
      [safeUserId, safeSeasonId]
    )
  ]);

  if (!daily && !weekly && !season) {
    return null;
  }

  return {
    source: "v5",
    dailyWins: toSafeInt(daily?.duel_wins),
    dailyClaimed: toSafeInt(daily?.duel_claimed),
    weeklyPoints: toSafeInt(weekly?.ladder_points),
    weeklyClaimed: toSafeInt(weekly?.milestones_claimed),
    arcPersonal: toSafeInt(season?.arc_personal_contribution),
    arcPersonalClaimed: toSafeInt(season?.arc_personal_claimed),
    arcGlobal: toSafeInt(season?.arc_global_contribution),
    state: {
      daily: normalizeJson(daily?.state_json),
      weekly: normalizeJson(weekly?.state_json),
      season: normalizeJson(season?.state_json)
    }
  };
}

async function upsertDailyState(db, payload = {}) {
  return queryFirstOrNull(
    db,
    `INSERT INTO v5_pvp_progression_daily (
       user_id,
       season_id,
       day_key,
       duel_wins,
       duel_claimed,
       points_delta,
       state_json,
       updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now())
     ON CONFLICT (user_id, season_id, day_key)
     DO UPDATE SET duel_wins = EXCLUDED.duel_wins,
                   duel_claimed = EXCLUDED.duel_claimed,
                   points_delta = EXCLUDED.points_delta,
                   state_json = COALESCE(v5_pvp_progression_daily.state_json, '{}'::jsonb) || EXCLUDED.state_json,
                   updated_at = now()
     RETURNING user_id, season_id, day_key, duel_wins, duel_claimed, points_delta, state_json, updated_at;`,
    [
      toSafeInt(payload.userId),
      toSafeInt(payload.seasonId),
      String(payload.dayKey || "").trim(),
      toSafeInt(payload.dailyWins),
      toSafeInt(payload.dailyClaimed),
      toSafeInt(payload.pointsDelta),
      JSON.stringify(normalizeJson(payload.stateJson))
    ]
  );
}

async function upsertWeeklyState(db, payload = {}) {
  return queryFirstOrNull(
    db,
    `INSERT INTO v5_pvp_progression_weekly (
       user_id,
       season_id,
       week_key,
       ladder_points,
       milestones_claimed,
       state_json,
       updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, now())
     ON CONFLICT (user_id, season_id, week_key)
     DO UPDATE SET ladder_points = EXCLUDED.ladder_points,
                   milestones_claimed = EXCLUDED.milestones_claimed,
                   state_json = COALESCE(v5_pvp_progression_weekly.state_json, '{}'::jsonb) || EXCLUDED.state_json,
                   updated_at = now()
     RETURNING user_id, season_id, week_key, ladder_points, milestones_claimed, state_json, updated_at;`,
    [
      toSafeInt(payload.userId),
      toSafeInt(payload.seasonId),
      String(payload.weekKey || "").trim(),
      toSafeInt(payload.weeklyPoints),
      toSafeInt(payload.weeklyClaimed),
      JSON.stringify(normalizeJson(payload.stateJson))
    ]
  );
}

async function upsertSeasonState(db, payload = {}) {
  return queryFirstOrNull(
    db,
    `INSERT INTO v5_pvp_progression_season (
       user_id,
       season_id,
       arc_personal_contribution,
       arc_personal_claimed,
       arc_global_contribution,
       state_json,
       updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, now())
     ON CONFLICT (user_id, season_id)
     DO UPDATE SET arc_personal_contribution = EXCLUDED.arc_personal_contribution,
                   arc_personal_claimed = EXCLUDED.arc_personal_claimed,
                   arc_global_contribution = EXCLUDED.arc_global_contribution,
                   state_json = COALESCE(v5_pvp_progression_season.state_json, '{}'::jsonb) || EXCLUDED.state_json,
                   updated_at = now()
     RETURNING user_id, season_id, arc_personal_contribution, arc_personal_claimed, arc_global_contribution, state_json, updated_at;`,
    [
      toSafeInt(payload.userId),
      toSafeInt(payload.seasonId),
      toSafeInt(payload.arcPersonal),
      toSafeInt(payload.arcPersonalClaimed),
      toSafeInt(payload.arcGlobal),
      JSON.stringify(normalizeJson(payload.stateJson))
    ]
  );
}

async function upsertSnapshot(db, payload = {}) {
  const signals = Array.isArray(payload.signals)
    ? payload.signals.map((entry) => String(entry || "").trim()).filter(Boolean).slice(0, 12)
    : [];
  const baseState = {
    source: "dual_run_v5",
    updated_at: new Date().toISOString(),
    outcome: String(payload.outcome || "loss"),
    score: toSafeInt(payload.score),
    combo: toSafeInt(payload.combo),
    contract_matched: Boolean(payload.contractMatched),
    signals
  };

  const [daily, weekly, season] = await Promise.all([
    upsertDailyState(db, {
      userId: payload.userId,
      seasonId: payload.seasonId,
      dayKey: payload.dayKey,
      dailyWins: payload.dailyWins,
      dailyClaimed: payload.dailyClaimed,
      pointsDelta: payload.weeklyPointsGain,
      stateJson: {
        ...baseState,
        weekly_points_gain: toSafeInt(payload.weeklyPointsGain),
        arc_contribution_gain: toSafeInt(payload.arcContributionGain)
      }
    }),
    upsertWeeklyState(db, {
      userId: payload.userId,
      seasonId: payload.seasonId,
      weekKey: payload.weekKey,
      weeklyPoints: payload.weeklyPoints,
      weeklyClaimed: payload.weeklyClaimed,
      stateJson: {
        ...baseState,
        weekly_points_gain: toSafeInt(payload.weeklyPointsGain)
      }
    }),
    upsertSeasonState(db, {
      userId: payload.userId,
      seasonId: payload.seasonId,
      arcPersonal: payload.arcPersonal,
      arcPersonalClaimed: payload.arcPersonalClaimed,
      arcGlobal: payload.arcGlobal,
      stateJson: {
        ...baseState,
        arc_contribution_gain: toSafeInt(payload.arcContributionGain)
      }
    })
  ]);

  return {
    persisted: Boolean(daily || weekly || season),
    daily,
    weekly,
    season
  };
}

module.exports = {
  getSnapshot,
  upsertDailyState,
  upsertWeeklyState,
  upsertSeasonState,
  upsertSnapshot,
  __testHooks: {
    isMissingRelationError
  }
};
