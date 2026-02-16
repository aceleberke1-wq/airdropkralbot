async function getUserUiPrefs(db, userId) {
  const result = await db.query(
    `SELECT user_id, ui_mode, quality_mode, reduced_motion, large_text, sound_enabled, prefs_json, updated_at
     FROM user_ui_prefs
     WHERE user_id = $1
     LIMIT 1;`,
    [userId]
  );
  return result.rows[0] || null;
}

async function upsertUserUiPrefs(db, payload) {
  const result = await db.query(
    `INSERT INTO user_ui_prefs (
       user_id,
       ui_mode,
       quality_mode,
       reduced_motion,
       large_text,
       sound_enabled,
       prefs_json
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     ON CONFLICT (user_id)
     DO UPDATE SET
       ui_mode = EXCLUDED.ui_mode,
       quality_mode = EXCLUDED.quality_mode,
       reduced_motion = EXCLUDED.reduced_motion,
       large_text = EXCLUDED.large_text,
       sound_enabled = EXCLUDED.sound_enabled,
       prefs_json = user_ui_prefs.prefs_json || EXCLUDED.prefs_json,
       updated_at = now()
     RETURNING user_id, ui_mode, quality_mode, reduced_motion, large_text, sound_enabled, prefs_json, updated_at;`,
    [
      payload.userId,
      String(payload.uiMode || "hardcore"),
      String(payload.qualityMode || "auto"),
      Boolean(payload.reducedMotion),
      Boolean(payload.largeText),
      payload.soundEnabled !== false,
      JSON.stringify(payload.prefsJson || {})
    ]
  );
  return result.rows[0] || null;
}

async function upsertDevicePerfProfile(db, payload) {
  const result = await db.query(
    `INSERT INTO device_perf_profiles (
       user_id,
       device_hash,
       platform,
       gpu_tier,
       cpu_tier,
       memory_tier,
       fps_avg,
       frame_time_ms,
       latency_avg_ms,
       profile_json
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
     ON CONFLICT (user_id, device_hash)
     DO UPDATE SET
       platform = EXCLUDED.platform,
       gpu_tier = EXCLUDED.gpu_tier,
       cpu_tier = EXCLUDED.cpu_tier,
       memory_tier = EXCLUDED.memory_tier,
       fps_avg = EXCLUDED.fps_avg,
       frame_time_ms = EXCLUDED.frame_time_ms,
       latency_avg_ms = EXCLUDED.latency_avg_ms,
       profile_json = device_perf_profiles.profile_json || EXCLUDED.profile_json,
       last_seen_at = now()
     RETURNING id, user_id, device_hash, platform, gpu_tier, cpu_tier, memory_tier, fps_avg, frame_time_ms, latency_avg_ms, profile_json, first_seen_at, last_seen_at;`,
    [
      payload.userId || null,
      String(payload.deviceHash || "unknown"),
      String(payload.platform || ""),
      String(payload.gpuTier || "unknown"),
      String(payload.cpuTier || "unknown"),
      String(payload.memoryTier || "unknown"),
      Number(payload.fpsAvg || 0),
      Number(payload.frameTimeMs || 0),
      Number(payload.latencyAvgMs || 0),
      JSON.stringify(payload.profileJson || {})
    ]
  );
  return result.rows[0] || null;
}

async function insertRenderQualitySnapshot(db, payload) {
  const result = await db.query(
    `INSERT INTO render_quality_snapshots (
       user_id,
       device_hash,
       quality_mode,
       fps_avg,
       dropped_frames,
       gpu_time_ms,
       cpu_time_ms,
       snapshot_json
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     RETURNING id, user_id, device_hash, quality_mode, fps_avg, dropped_frames, gpu_time_ms, cpu_time_ms, snapshot_json, created_at;`,
    [
      payload.userId || null,
      String(payload.deviceHash || "unknown"),
      String(payload.qualityMode || "auto"),
      Number(payload.fpsAvg || 0),
      Math.max(0, Math.floor(Number(payload.droppedFrames || 0))),
      Number(payload.gpuTimeMs || 0),
      Number(payload.cpuTimeMs || 0),
      JSON.stringify(payload.snapshotJson || {})
    ]
  );
  return result.rows[0] || null;
}

async function getLatestPerfProfile(db, userId, deviceHash = "") {
  if (deviceHash) {
    const byDevice = await db.query(
      `SELECT id, user_id, device_hash, platform, gpu_tier, cpu_tier, memory_tier, fps_avg, frame_time_ms, latency_avg_ms, profile_json, first_seen_at, last_seen_at
       FROM device_perf_profiles
       WHERE user_id = $1
         AND device_hash = $2
       LIMIT 1;`,
      [userId, String(deviceHash)]
    );
    if (byDevice.rows[0]) {
      return byDevice.rows[0];
    }
  }
  const result = await db.query(
    `SELECT id, user_id, device_hash, platform, gpu_tier, cpu_tier, memory_tier, fps_avg, frame_time_ms, latency_avg_ms, profile_json, first_seen_at, last_seen_at
     FROM device_perf_profiles
     WHERE user_id = $1
     ORDER BY last_seen_at DESC
     LIMIT 1;`,
    [userId]
  );
  return result.rows[0] || null;
}

async function insertPriceOracleSnapshot(db, payload) {
  const result = await db.query(
    `INSERT INTO price_oracle_snapshots (
       provider,
       symbol,
       price_usd,
       confidence,
       source_ts,
       snapshot_json
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING id, provider, symbol, price_usd, confidence, source_ts, snapshot_json, created_at;`,
    [
      String(payload.provider || "unknown"),
      String(payload.symbol || "NXT").toUpperCase(),
      Number(payload.priceUsd || 0),
      Number(payload.confidence || 0),
      payload.sourceTs || null,
      JSON.stringify(payload.snapshotJson || {})
    ]
  );
  return result.rows[0] || null;
}

async function insertChainVerifyLog(db, payload) {
  const result = await db.query(
    `INSERT INTO chain_verify_logs (
       request_id,
       chain,
       tx_hash,
       verify_status,
       latency_ms,
       verify_json
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING id, request_id, chain, tx_hash, verify_status, latency_ms, verify_json, created_at;`,
    [
      payload.requestId || null,
      String(payload.chain || "UNKNOWN").toUpperCase(),
      String(payload.txHash || ""),
      String(payload.verifyStatus || "unknown"),
      Math.max(0, Math.floor(Number(payload.latencyMs || 0))),
      JSON.stringify(payload.verifyJson || {})
    ]
  );
  return result.rows[0] || null;
}

async function insertExternalApiHealth(db, payload) {
  const result = await db.query(
    `INSERT INTO external_api_health (
       provider,
       endpoint,
       check_name,
       ok,
       status_code,
       latency_ms,
       error_code,
       error_message,
       health_json
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
     RETURNING id, provider, endpoint, check_name, ok, status_code, latency_ms, error_code, error_message, health_json, checked_at;`,
    [
      String(payload.provider || "unknown"),
      String(payload.endpoint || ""),
      String(payload.checkName || "default"),
      Boolean(payload.ok),
      Math.max(0, Math.floor(Number(payload.statusCode || 0))),
      Math.max(0, Math.floor(Number(payload.latencyMs || 0))),
      String(payload.errorCode || ""),
      String(payload.errorMessage || ""),
      JSON.stringify(payload.healthJson || {})
    ]
  );
  return result.rows[0] || null;
}

async function insertCombatFrameStat(db, payload) {
  const result = await db.query(
    `INSERT INTO combat_frame_stats (
       user_id,
       session_ref,
       mode,
       device_hash,
       fps_avg,
       frame_time_ms,
       dropped_frames,
       gpu_time_ms,
       cpu_time_ms,
       stats_json
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
     RETURNING id, user_id, session_ref, mode, device_hash, fps_avg, frame_time_ms, dropped_frames, gpu_time_ms, cpu_time_ms, stats_json, created_at;`,
    [
      payload.userId || null,
      String(payload.sessionRef || ""),
      String(payload.mode || "combat"),
      String(payload.deviceHash || "unknown"),
      Number(payload.fpsAvg || 0),
      Number(payload.frameTimeMs || 0),
      Math.max(0, Math.floor(Number(payload.droppedFrames || 0))),
      Number(payload.gpuTimeMs || 0),
      Number(payload.cpuTimeMs || 0),
      JSON.stringify(payload.statsJson || {})
    ]
  );
  return result.rows[0] || null;
}

async function insertCombatNetStat(db, payload) {
  const result = await db.query(
    `INSERT INTO combat_net_stats (
       user_id,
       session_ref,
       mode,
       transport,
       tick_ms,
       action_window_ms,
       rtt_ms,
       jitter_ms,
       packet_loss_pct,
       accepted_actions,
       rejected_actions,
       stats_json
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
     RETURNING id, user_id, session_ref, mode, transport, tick_ms, action_window_ms, rtt_ms, jitter_ms, packet_loss_pct,
               accepted_actions, rejected_actions, stats_json, created_at;`,
    [
      payload.userId || null,
      String(payload.sessionRef || ""),
      String(payload.mode || "combat"),
      String(payload.transport || "poll"),
      Math.max(1, Math.floor(Number(payload.tickMs || 1000))),
      Math.max(1, Math.floor(Number(payload.actionWindowMs || 800))),
      Number(payload.rttMs || 0),
      Number(payload.jitterMs || 0),
      Math.max(0, Number(payload.packetLossPct || 0)),
      Math.max(0, Math.floor(Number(payload.acceptedActions || 0))),
      Math.max(0, Math.floor(Number(payload.rejectedActions || 0))),
      JSON.stringify(payload.statsJson || {})
    ]
  );
  return result.rows[0] || null;
}

async function insertUiInteractionEvent(db, payload) {
  const result = await db.query(
    `INSERT INTO ui_interaction_events (
       user_id,
       event_key,
       event_name,
       event_scope,
       event_value,
       event_json
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING id, user_id, event_key, event_name, event_scope, event_value, event_json, created_at;`,
    [
      payload.userId || null,
      String(payload.eventKey || "unknown"),
      String(payload.eventName || ""),
      String(payload.eventScope || "webapp"),
      String(payload.eventValue || ""),
      JSON.stringify(payload.eventJson || {})
    ]
  );
  return result.rows[0] || null;
}

async function getLatestExternalApiHealth(db, provider, limit = 20) {
  const result = await db.query(
    `SELECT id, provider, endpoint, check_name, ok, status_code, latency_ms, error_code, error_message, health_json, checked_at
     FROM external_api_health
     WHERE provider = $1
     ORDER BY checked_at DESC
     LIMIT $2;`,
    [String(provider || "unknown"), Math.max(1, Math.min(200, Number(limit || 20)))]
  );
  return result.rows;
}

module.exports = {
  getUserUiPrefs,
  upsertUserUiPrefs,
  upsertDevicePerfProfile,
  insertRenderQualitySnapshot,
  getLatestPerfProfile,
  insertPriceOracleSnapshot,
  insertChainVerifyLog,
  insertExternalApiHealth,
  insertCombatFrameStat,
  insertCombatNetStat,
  insertUiInteractionEvent,
  getLatestExternalApiHealth
};
