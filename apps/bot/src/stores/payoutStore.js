async function getLatestRequest(db, userId, currency) {
  const result = await db.query(
    `SELECT id, currency, amount, source_hc_amount, fx_rate_snapshot, status, cooldown_until, created_at
     FROM payout_requests
     WHERE user_id = $1 AND currency = $2
     ORDER BY created_at DESC
     LIMIT 1;`,
    [userId, currency]
  );
  return result.rows[0] || null;
}

async function getActiveRequest(db, userId, currency) {
  const result = await db.query(
    `SELECT id, currency, amount, source_hc_amount, fx_rate_snapshot, status, cooldown_until, created_at
     FROM payout_requests
     WHERE user_id = $1
       AND currency = $2
       AND status IN ('requested', 'pending', 'approved')
     ORDER BY created_at DESC
     LIMIT 1;`,
    [userId, currency]
  );
  return result.rows[0] || null;
}

async function getCooldownRequest(db, userId, currency) {
  const result = await db.query(
    `SELECT id, status, cooldown_until, source_hc_amount, fx_rate_snapshot
     FROM payout_requests
     WHERE user_id = $1
       AND currency = $2
       AND cooldown_until > now()
     ORDER BY cooldown_until DESC
     LIMIT 1;`,
    [userId, currency]
  );
  return result.rows[0] || null;
}

async function createRequest(db, { userId, currency, amount, addressType, addressHash, cooldownHours, sourceHcAmount, fxRateSnapshot }) {
  const safeCooldownHours = Math.max(1, Number(cooldownHours || 72));
  const safeSourceHc = Math.max(0, Number(sourceHcAmount || 0));
  const safeRate = Math.max(0, Number(fxRateSnapshot || 0));
  try {
    const result = await db.query(
      `INSERT INTO payout_requests (
         user_id,
         currency,
         amount,
         address_type,
         address_hash,
         source_hc_amount,
         fx_rate_snapshot,
         status,
         cooldown_until
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'requested', now() + make_interval(hours => $8))
       RETURNING id, currency, amount, source_hc_amount, fx_rate_snapshot, status, cooldown_until, created_at;`,
      [userId, currency, amount, addressType, addressHash, safeSourceHc, safeRate, safeCooldownHours]
    );
    return result.rows[0];
  } catch (err) {
    if (err.code === "23505") {
      return null;
    }
    throw err;
  }
}

async function getRequestWithTx(db, requestId) {
  const result = await db.query(
    `SELECT
        r.id,
        r.user_id,
        r.currency,
        r.amount,
        r.source_hc_amount,
        r.fx_rate_snapshot,
        r.status,
        r.cooldown_until,
        r.created_at,
        t.tx_hash,
        t.recorded_at,
        t.admin_id
     FROM payout_requests r
     LEFT JOIN payout_tx t ON t.payout_request_id = r.id
     WHERE r.id = $1
     LIMIT 1;`,
    [requestId]
  );
  return result.rows[0] || null;
}

async function listRequests(db, { status, limit = 50 }) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit || 50)));
  if (status) {
    const filtered = await db.query(
      `SELECT id, user_id, currency, amount, source_hc_amount, fx_rate_snapshot, status, cooldown_until, created_at
       FROM payout_requests
       WHERE status = $1
       ORDER BY created_at DESC
       LIMIT $2;`,
      [status, safeLimit]
    );
    return filtered.rows;
  }
  const all = await db.query(
    `SELECT id, user_id, currency, amount, source_hc_amount, fx_rate_snapshot, status, cooldown_until, created_at
     FROM payout_requests
     ORDER BY created_at DESC
     LIMIT $1;`,
    [safeLimit]
  );
  return all.rows;
}

async function markPaid(db, { requestId, txHash, adminId }) {
  const locked = await db.query(
    `SELECT id, status
     FROM payout_requests
     WHERE id = $1
     FOR UPDATE;`,
    [requestId]
  );
  if (locked.rows.length === 0) {
    return { status: "not_found" };
  }
  const current = locked.rows[0];
  if (current.status === "rejected") {
    return { status: "rejected" };
  }
  if (current.status === "paid") {
    const existing = await getRequestWithTx(db, requestId);
    return { status: "already_paid", request: existing };
  }

  await db.query(
    `UPDATE payout_requests
     SET status = 'paid'
     WHERE id = $1;`,
    [requestId]
  );

  try {
    await db.query(
      `INSERT INTO payout_tx (payout_request_id, tx_hash, admin_id)
       VALUES ($1, $2, $3);`,
      [requestId, txHash, adminId]
    );
  } catch (err) {
    if (err.code !== "23505") {
      throw err;
    }
  }

  const request = await getRequestWithTx(db, requestId);
  return { status: "paid", request };
}

async function markRejected(db, { requestId, adminId, reason }) {
  const updated = await db.query(
    `UPDATE payout_requests
     SET status = 'rejected'
     WHERE id = $1
       AND status <> 'paid'
     RETURNING id, user_id, currency, amount, status, created_at;`,
    [requestId]
  );
  if (updated.rows.length === 0) {
    return { status: "not_found_or_paid" };
  }
  await db.query(
    `INSERT INTO admin_audit (admin_id, action, target, payload_json)
     VALUES ($1, 'payout_reject', $2, $3::jsonb);`,
    [adminId, `payout_request:${requestId}`, JSON.stringify({ reason: reason || "" })]
  );
  return { status: "rejected", request: updated.rows[0] };
}

async function markRejectedSystem(db, { requestId, reason }) {
  const updated = await db.query(
    `UPDATE payout_requests
     SET status = 'rejected'
     WHERE id = $1
       AND status IN ('requested', 'pending', 'approved')
     RETURNING id, user_id, currency, amount, source_hc_amount, fx_rate_snapshot, status, created_at;`,
    [requestId]
  );
  if (updated.rows.length === 0) {
    return { status: "not_found_or_final" };
  }

  const meta = {
    reason: reason || "system_reject"
  };
  await db.query(
    `INSERT INTO admin_audit (admin_id, action, target, payload_json)
     VALUES (0, 'payout_system_reject', $1, $2::jsonb);`,
    [`payout_request:${requestId}`, JSON.stringify(meta)]
  );

  return { status: "rejected", request: updated.rows[0] };
}

async function getTodayRequestedAmount(db, userId, currency = "BTC") {
  const res = await db.query(
    `SELECT COALESCE(SUM(amount), 0)::numeric AS total
     FROM payout_requests
     WHERE user_id = $1
       AND currency = $2
       AND created_at::date = CURRENT_DATE
       AND status IN ('requested', 'pending', 'approved', 'paid');`,
    [userId, currency]
  );
  return Number(res.rows?.[0]?.total || 0);
}

async function upsertDailyReleaseUsage(db, payload = {}) {
  const result = await db.query(
    `INSERT INTO payout_release_daily_usage (
       user_id,
       currency,
       day_date,
       entitled_btc,
       drip_cap_btc,
       drip_used_btc,
       drip_remaining_btc,
       unlock_tier,
       unlock_score,
       global_gate_open,
       details_json,
       updated_at
     )
     VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, now())
     ON CONFLICT (user_id, currency, day_date)
     DO UPDATE SET entitled_btc = EXCLUDED.entitled_btc,
                   drip_cap_btc = EXCLUDED.drip_cap_btc,
                   drip_used_btc = EXCLUDED.drip_used_btc,
                   drip_remaining_btc = EXCLUDED.drip_remaining_btc,
                   unlock_tier = EXCLUDED.unlock_tier,
                   unlock_score = EXCLUDED.unlock_score,
                   global_gate_open = EXCLUDED.global_gate_open,
                   details_json = EXCLUDED.details_json,
                   updated_at = now()
     RETURNING id, user_id, currency, day_date, entitled_btc, drip_cap_btc, drip_used_btc, drip_remaining_btc, unlock_tier, unlock_score, global_gate_open, updated_at;`,
    [
      Number(payload.userId || 0),
      String(payload.currency || "BTC").toUpperCase(),
      Number(payload.entitledBtc || 0),
      Number(payload.dripCapBtc || 0),
      Number(payload.dripUsedBtc || 0),
      Number(payload.dripRemainingBtc || 0),
      String(payload.unlockTier || "T0").toUpperCase(),
      Number(payload.unlockScore || 0),
      Boolean(payload.globalGateOpen),
      JSON.stringify(payload.detailsJson || {})
    ]
  );
  return result.rows[0] || null;
}

async function upsertUserUnlockScore(db, payload = {}) {
  const result = await db.query(
    `INSERT INTO user_unlock_scores (
       user_id,
       day_date,
       volume30d_norm,
       mission30d_norm,
       tenure30d_norm,
       unlock_score,
       unlock_tier,
       factors_json,
       updated_at
     )
     VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7::jsonb, now())
     ON CONFLICT (user_id, day_date)
     DO UPDATE SET volume30d_norm = EXCLUDED.volume30d_norm,
                   mission30d_norm = EXCLUDED.mission30d_norm,
                   tenure30d_norm = EXCLUDED.tenure30d_norm,
                   unlock_score = EXCLUDED.unlock_score,
                   unlock_tier = EXCLUDED.unlock_tier,
                   factors_json = EXCLUDED.factors_json,
                   updated_at = now()
     RETURNING id, user_id, day_date, volume30d_norm, mission30d_norm, tenure30d_norm, unlock_score, unlock_tier, updated_at;`,
    [
      Number(payload.userId || 0),
      Number(payload.volume30dNorm || 0),
      Number(payload.mission30dNorm || 0),
      Number(payload.tenure30dNorm || 0),
      Number(payload.unlockScore || 0),
      String(payload.unlockTier || "T0").toUpperCase(),
      JSON.stringify(payload.factorsJson || {})
    ]
  );
  return result.rows[0] || null;
}

async function insertPayoutReleaseEvent(db, payload = {}) {
  const result = await db.query(
    `INSERT INTO payout_release_events (
       user_id,
       payout_request_id,
       event_type,
       currency,
       amount_btc,
       unlock_tier,
       unlock_score,
       event_json,
       created_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
     RETURNING id, user_id, payout_request_id, event_type, currency, amount_btc, unlock_tier, unlock_score, created_at;`,
    [
      Number(payload.userId || 0),
      payload.payoutRequestId ? Number(payload.payoutRequestId) : null,
      String(payload.eventType || "payout_release_event"),
      String(payload.currency || "BTC").toUpperCase(),
      Number(payload.amountBtc || 0),
      String(payload.unlockTier || "T0").toUpperCase(),
      Number(payload.unlockScore || 0),
      JSON.stringify(payload.eventJson || {}),
      Number(payload.createdBy || 0)
    ]
  );
  return result.rows[0] || null;
}

module.exports = {
  getLatestRequest,
  getActiveRequest,
  getCooldownRequest,
  createRequest,
  getRequestWithTx,
  listRequests,
  markPaid,
  markRejected,
  markRejectedSystem,
  getTodayRequestedAmount,
  upsertDailyReleaseUsage,
  upsertUserUnlockScore,
  insertPayoutReleaseEvent
};
