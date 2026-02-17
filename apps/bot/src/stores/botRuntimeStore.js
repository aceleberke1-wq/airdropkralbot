const DEFAULT_STATE_KEY = "primary";

async function hasBotRuntimeTables(db) {
  const result = await db.query(
    `SELECT
        to_regclass('public.bot_runtime_state') IS NOT NULL AS bot_runtime_state,
        to_regclass('public.bot_runtime_events') IS NOT NULL AS bot_runtime_events;`
  );
  const row = result.rows[0] || {};
  return Boolean(row.bot_runtime_state && row.bot_runtime_events);
}

async function upsertRuntimeState(db, payload) {
  const result = await db.query(
    `INSERT INTO bot_runtime_state (
       state_key,
       service_name,
       mode,
       alive,
       lock_acquired,
       lock_key,
       instance_ref,
       pid,
       hostname,
       service_env,
       started_at,
       last_heartbeat_at,
       stopped_at,
       last_error,
       state_json,
       updated_at,
       updated_by
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
       $11, $12, $13, $14, $15::jsonb, now(), $16
     )
     ON CONFLICT (state_key)
     DO UPDATE SET
       service_name = EXCLUDED.service_name,
       mode = EXCLUDED.mode,
       alive = EXCLUDED.alive,
       lock_acquired = EXCLUDED.lock_acquired,
       lock_key = EXCLUDED.lock_key,
       instance_ref = EXCLUDED.instance_ref,
       pid = EXCLUDED.pid,
       hostname = EXCLUDED.hostname,
       service_env = EXCLUDED.service_env,
       started_at = COALESCE(EXCLUDED.started_at, bot_runtime_state.started_at),
       last_heartbeat_at = EXCLUDED.last_heartbeat_at,
       stopped_at = EXCLUDED.stopped_at,
       last_error = EXCLUDED.last_error,
       state_json = COALESCE(bot_runtime_state.state_json, '{}'::jsonb) || EXCLUDED.state_json,
       updated_at = now(),
       updated_by = EXCLUDED.updated_by
     RETURNING *;`,
    [
      String(payload.stateKey || DEFAULT_STATE_KEY),
      String(payload.serviceName || "airdropkral-bot"),
      String(payload.mode || "disabled"),
      Boolean(payload.alive),
      Boolean(payload.lockAcquired),
      Number(payload.lockKey || 0),
      String(payload.instanceRef || ""),
      Number(payload.pid || 0),
      String(payload.hostname || ""),
      String(payload.serviceEnv || ""),
      payload.startedAt || null,
      payload.lastHeartbeatAt || null,
      payload.stoppedAt || null,
      String(payload.lastError || ""),
      JSON.stringify(payload.stateJson || {}),
      Number(payload.updatedBy || 0)
    ]
  );
  return result.rows[0] || null;
}

async function touchHeartbeat(db, payload = {}) {
  return upsertRuntimeState(db, {
    ...payload,
    stateKey: payload.stateKey || DEFAULT_STATE_KEY,
    mode: payload.mode || "polling",
    alive: payload.alive !== false,
    lastHeartbeatAt: payload.lastHeartbeatAt || new Date(),
    stoppedAt: payload.stoppedAt || null
  });
}

async function insertRuntimeEvent(db, payload) {
  const result = await db.query(
    `INSERT INTO bot_runtime_events (
       state_key,
       event_type,
       event_json
     )
     VALUES ($1, $2, $3::jsonb)
     RETURNING id, state_key, event_type, event_json, created_at;`,
    [
      String(payload.stateKey || DEFAULT_STATE_KEY),
      String(payload.eventType || "runtime"),
      JSON.stringify(payload.eventJson || {})
    ]
  );
  return result.rows[0] || null;
}

async function getRuntimeState(db, stateKey = DEFAULT_STATE_KEY) {
  const result = await db.query(
    `SELECT state_key, service_name, mode, alive, lock_acquired, lock_key, instance_ref, pid, hostname,
            service_env, started_at, last_heartbeat_at, stopped_at, last_error, state_json, updated_at, updated_by
     FROM bot_runtime_state
     WHERE state_key = $1
     LIMIT 1;`,
    [String(stateKey || DEFAULT_STATE_KEY)]
  );
  return result.rows[0] || null;
}

async function getRecentRuntimeEvents(db, stateKey = DEFAULT_STATE_KEY, limit = 20) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit || 20)));
  const result = await db.query(
    `SELECT id, state_key, event_type, event_json, created_at
     FROM bot_runtime_events
     WHERE state_key = $1
     ORDER BY created_at DESC, id DESC
     LIMIT $2;`,
    [String(stateKey || DEFAULT_STATE_KEY), safeLimit]
  );
  return result.rows;
}

module.exports = {
  DEFAULT_STATE_KEY,
  hasBotRuntimeTables,
  upsertRuntimeState,
  touchHeartbeat,
  insertRuntimeEvent,
  getRuntimeState,
  getRecentRuntimeEvents
};
