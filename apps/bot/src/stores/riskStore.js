async function getRiskState(db, userId) {
  const existing = await db.query(
    `SELECT risk_score, signals_json
     FROM risk_scores
     WHERE user_id = $1;`,
    [userId]
  );
  if (existing.rows.length > 0) {
    return {
      riskScore: Number(existing.rows[0].risk_score || 0),
      signals: existing.rows[0].signals_json || {}
    };
  }

  const inserted = await db.query(
    `INSERT INTO risk_scores (user_id, risk_score, signals_json, last_updated_at)
     VALUES ($1, 0, '{}'::jsonb, now())
     ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
     RETURNING risk_score, signals_json;`,
    [userId]
  );
  return {
    riskScore: Number(inserted.rows[0].risk_score || 0),
    signals: inserted.rows[0].signals_json || {}
  };
}

async function updateRiskState(db, userId, nextRisk, signals) {
  const updated = await db.query(
    `UPDATE risk_scores
     SET risk_score = $2,
         signals_json = COALESCE(signals_json, '{}'::jsonb) || $3::jsonb,
         last_updated_at = now()
     WHERE user_id = $1
     RETURNING risk_score, signals_json;`,
    [userId, nextRisk, JSON.stringify(signals || {})]
  );
  return {
    riskScore: Number(updated.rows[0].risk_score || 0),
    signals: updated.rows[0].signals_json || {}
  };
}

async function insertBehaviorEvent(db, userId, eventType, meta) {
  await db.query(
    `INSERT INTO behavior_events (user_id, event_type, meta_json)
     VALUES ($1, $2, $3::jsonb);`,
    [userId, eventType, JSON.stringify(meta || {})]
  );
}

async function getHourlySnapshot(db, userId) {
  const result = await db.query(
    `SELECT
        count(*) FILTER (WHERE event_type LIKE 'callback_%') AS callback_total,
        count(*) FILTER (WHERE event_type = 'callback_duplicate') AS callback_duplicate_total,
        count(*) FILTER (WHERE event_type = 'task_complete') AS task_complete_total,
        count(*) FILTER (WHERE event_type = 'reveal_duplicate') AS reveal_duplicate_total
     FROM behavior_events
     WHERE user_id = $1
       AND event_at >= now() - interval '1 hour';`,
    [userId]
  );
  return result.rows[0] || {};
}

async function listBehaviorEvents(db, userId, limit = 12) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit || 12)));
  const result = await db.query(
    `SELECT event_type, event_at, meta_json
     FROM behavior_events
     WHERE user_id = $1
     ORDER BY event_at DESC
     LIMIT $2;`,
    [userId, safeLimit]
  );
  return result.rows;
}

module.exports = {
  getRiskState,
  updateRiskState,
  insertBehaviorEvent,
  getHourlySnapshot,
  listBehaviorEvents
};
