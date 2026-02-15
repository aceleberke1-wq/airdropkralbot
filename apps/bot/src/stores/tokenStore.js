async function listUserPurchaseRequests(db, userId, limit = 6) {
  const result = await db.query(
    `SELECT id, token_symbol, chain, pay_currency, pay_address, usd_amount, token_amount, status, tx_hash,
            created_at, updated_at, submitted_at, decided_at, admin_id, admin_note, meta_json
     FROM token_purchase_requests
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2;`,
    [userId, Math.max(1, Math.min(50, Number(limit || 6)))]
  );
  return result.rows;
}

async function patchPurchaseRequestMeta(db, { requestId, metaPatch, status }) {
  const patch = metaPatch && typeof metaPatch === "object" ? metaPatch : {};
  const result = await db.query(
    `UPDATE token_purchase_requests
     SET meta_json = COALESCE(meta_json, '{}'::jsonb) || $2::jsonb,
         status = COALESCE($3, status),
         updated_at = now()
     WHERE id = $1
     RETURNING id, user_id, token_symbol, chain, pay_currency, pay_address, usd_amount, token_amount, status, tx_hash,
               request_ref, created_at, updated_at, submitted_at, decided_at, admin_id, admin_note, meta_json;`,
    [requestId, JSON.stringify(patch), status || null]
  );
  return result.rows[0] || null;
}

async function getPurchaseRequest(db, requestId) {
  const result = await db.query(
    `SELECT id, user_id, token_symbol, chain, pay_currency, pay_address, usd_amount, token_amount, status, tx_hash,
            request_ref, created_at, updated_at, submitted_at, decided_at, admin_id, admin_note, meta_json
     FROM token_purchase_requests
     WHERE id = $1
     LIMIT 1;`,
    [requestId]
  );
  return result.rows[0] || null;
}

async function lockPurchaseRequest(db, requestId) {
  const result = await db.query(
    `SELECT id, user_id, token_symbol, chain, pay_currency, pay_address, usd_amount, token_amount, status, tx_hash,
            request_ref, created_at, updated_at, submitted_at, decided_at, admin_id, admin_note, meta_json
     FROM token_purchase_requests
     WHERE id = $1
     FOR UPDATE;`,
    [requestId]
  );
  return result.rows[0] || null;
}

async function createPurchaseRequest(db, payload) {
  const result = await db.query(
    `INSERT INTO token_purchase_requests (
        user_id, token_symbol, chain, pay_currency, pay_address, usd_amount, token_amount, status, request_ref, meta_json
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending_payment', $8, $9::jsonb)
     RETURNING id, user_id, token_symbol, chain, pay_currency, pay_address, usd_amount, token_amount, status, tx_hash,
               request_ref, created_at, updated_at, submitted_at, decided_at, admin_id, admin_note, meta_json;`,
    [
      payload.userId,
      payload.tokenSymbol,
      payload.chain,
      payload.payCurrency,
      payload.payAddress,
      payload.usdAmount,
      payload.tokenAmount,
      payload.requestRef,
      JSON.stringify(payload.meta || {})
    ]
  );
  return result.rows[0];
}

async function submitPurchaseTxHash(db, { requestId, userId, txHash, metaPatch }) {
  const patch = metaPatch && typeof metaPatch === "object" ? metaPatch : {};
  const result = await db.query(
    `UPDATE token_purchase_requests
     SET tx_hash = $3,
         meta_json = COALESCE(meta_json, '{}'::jsonb) || $4::jsonb,
         status = CASE
                    WHEN status = 'approved' THEN status
                    WHEN status = 'rejected' THEN status
                    ELSE 'tx_submitted'
                  END,
         submitted_at = now(),
         updated_at = now()
     WHERE id = $1
       AND user_id = $2
       AND status IN ('pending_payment', 'tx_submitted')
     RETURNING id, user_id, token_symbol, chain, pay_currency, pay_address, usd_amount, token_amount, status, tx_hash,
               request_ref, created_at, updated_at, submitted_at, decided_at, admin_id, admin_note, meta_json;`,
    [requestId, userId, txHash, JSON.stringify(patch)]
  );
  return result.rows[0] || null;
}

async function listPurchaseRequests(db, filters = {}) {
  const limit = Math.max(1, Math.min(200, Number(filters.limit || 50)));
  const status = String(filters.status || "").trim().toLowerCase();
  if (status) {
    const result = await db.query(
      `SELECT id, user_id, token_symbol, chain, pay_currency, pay_address, usd_amount, token_amount, status, tx_hash,
              request_ref, created_at, updated_at, submitted_at, decided_at, admin_id, admin_note, meta_json
       FROM token_purchase_requests
       WHERE status = $1
       ORDER BY created_at DESC
       LIMIT $2;`,
      [status, limit]
    );
    return result.rows;
  }

  const result = await db.query(
    `SELECT id, user_id, token_symbol, chain, pay_currency, pay_address, usd_amount, token_amount, status, tx_hash,
            request_ref, created_at, updated_at, submitted_at, decided_at, admin_id, admin_note, meta_json
     FROM token_purchase_requests
     ORDER BY created_at DESC
     LIMIT $1;`,
    [limit]
  );
  return result.rows;
}

async function markPurchaseApproved(db, { requestId, adminId, adminNote }) {
  const result = await db.query(
    `UPDATE token_purchase_requests
     SET status = 'approved',
         admin_id = $2,
         admin_note = $3,
         decided_at = now(),
         updated_at = now()
     WHERE id = $1
     RETURNING id, user_id, token_symbol, chain, pay_currency, pay_address, usd_amount, token_amount, status, tx_hash,
               request_ref, created_at, updated_at, submitted_at, decided_at, admin_id, admin_note, meta_json;`,
    [requestId, adminId, adminNote || null]
  );
  return result.rows[0] || null;
}

async function markPurchaseRejected(db, { requestId, adminId, reason }) {
  const result = await db.query(
    `UPDATE token_purchase_requests
     SET status = 'rejected',
         admin_id = $2,
         admin_note = $3,
         decided_at = now(),
         updated_at = now()
     WHERE id = $1
     RETURNING id, user_id, token_symbol, chain, pay_currency, pay_address, usd_amount, token_amount, status, tx_hash,
               request_ref, created_at, updated_at, submitted_at, decided_at, admin_id, admin_note, meta_json;`,
    [requestId, adminId, reason || null]
  );
  return result.rows[0] || null;
}

async function getTokenMarketState(db, tokenSymbol) {
  const result = await db.query(
    `SELECT token_symbol, admin_floor_usd, curve_base_usd, curve_k, supply_norm_divisor, demand_factor, volatility_dampen,
            auto_policy_json, updated_at, updated_by
     FROM token_market_state
     WHERE token_symbol = $1
     LIMIT 1;`,
    [String(tokenSymbol || "NXT").toUpperCase()]
  );
  return result.rows[0] || null;
}

async function upsertTokenMarketState(db, payload) {
  const symbol = String(payload.tokenSymbol || "NXT").toUpperCase();
  const result = await db.query(
    `INSERT INTO token_market_state (
       token_symbol, admin_floor_usd, curve_base_usd, curve_k, supply_norm_divisor, demand_factor, volatility_dampen, auto_policy_json, updated_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
     ON CONFLICT (token_symbol)
     DO UPDATE SET
       admin_floor_usd = EXCLUDED.admin_floor_usd,
       curve_base_usd = EXCLUDED.curve_base_usd,
       curve_k = EXCLUDED.curve_k,
       supply_norm_divisor = EXCLUDED.supply_norm_divisor,
       demand_factor = EXCLUDED.demand_factor,
       volatility_dampen = EXCLUDED.volatility_dampen,
       auto_policy_json = EXCLUDED.auto_policy_json,
       updated_at = now(),
       updated_by = EXCLUDED.updated_by
     RETURNING token_symbol, admin_floor_usd, curve_base_usd, curve_k, supply_norm_divisor, demand_factor, volatility_dampen,
               auto_policy_json, updated_at, updated_by;`,
    [
      symbol,
      Number(payload.adminFloorUsd || 0.0005),
      Number(payload.curveBaseUsd || 0.0005),
      Number(payload.curveK || 0.08),
      Number(payload.supplyNormDivisor || 100000),
      Number(payload.demandFactor || 1),
      Number(payload.volatilityDampen || 0.15),
      JSON.stringify(payload.autoPolicy || {}),
      Number(payload.updatedBy || 0)
    ]
  );
  return result.rows[0] || null;
}

async function insertTokenPriceTick(db, payload) {
  const result = await db.query(
    `INSERT INTO token_price_ticks (
       token_symbol, supply_total, demand_factor, admin_floor_usd, price_usd, context_json
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING id, token_symbol, supply_total, demand_factor, admin_floor_usd, price_usd, context_json, created_at;`,
    [
      String(payload.tokenSymbol || "NXT").toUpperCase(),
      Number(payload.supplyTotal || 0),
      Number(payload.demandFactor || 1),
      Number(payload.adminFloorUsd || 0),
      Number(payload.priceUsd || 0),
      JSON.stringify(payload.context || {})
    ]
  );
  return result.rows[0] || null;
}

async function insertTokenAutoDecision(db, payload) {
  const result = await db.query(
    `INSERT INTO token_auto_decisions (
       request_id, token_symbol, decision, reason, policy_json, risk_score, usd_amount, tx_hash, decided_by
     )
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9)
     RETURNING id, request_id, token_symbol, decision, reason, policy_json, risk_score, usd_amount, tx_hash, decided_by, decided_at;`,
    [
      payload.requestId || null,
      String(payload.tokenSymbol || "NXT").toUpperCase(),
      String(payload.decision || "skipped"),
      String(payload.reason || ""),
      JSON.stringify(payload.policy || {}),
      Number(payload.riskScore || 0),
      Number(payload.usdAmount || 0),
      payload.txHash || null,
      String(payload.decidedBy || "system")
    ]
  );
  return result.rows[0] || null;
}

async function listTokenAutoDecisions(db, { limit = 50, decision = "" } = {}) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit || 50)));
  const normalizedDecision = String(decision || "").trim().toLowerCase();
  if (normalizedDecision) {
    const result = await db.query(
      `SELECT id, request_id, token_symbol, decision, reason, policy_json, risk_score, usd_amount, tx_hash, decided_by, decided_at
       FROM token_auto_decisions
       WHERE decision = $1
       ORDER BY decided_at DESC
       LIMIT $2;`,
      [normalizedDecision, safeLimit]
    );
    return result.rows;
  }
  const result = await db.query(
    `SELECT id, request_id, token_symbol, decision, reason, policy_json, risk_score, usd_amount, tx_hash, decided_by, decided_at
     FROM token_auto_decisions
     ORDER BY decided_at DESC
     LIMIT $1;`,
    [safeLimit]
  );
  return result.rows;
}

async function insertTokenLiquiditySnapshot(db, payload) {
  const result = await db.query(
    `INSERT INTO token_liquidity_snapshots (
       token_symbol, total_supply, holders, market_cap_usd, gate_open, gate_min_cap_usd, snapshot_json
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     RETURNING id, token_symbol, total_supply, holders, market_cap_usd, gate_open, gate_min_cap_usd, snapshot_json, created_at;`,
    [
      String(payload.tokenSymbol || "NXT").toUpperCase(),
      Number(payload.totalSupply || 0),
      Number(payload.holders || 0),
      Number(payload.marketCapUsd || 0),
      Boolean(payload.gateOpen),
      Number(payload.gateMinCapUsd || 0),
      JSON.stringify(payload.snapshot || {})
    ]
  );
  return result.rows[0] || null;
}

async function countRecentTokenVelocity(db, userId, minutes = 60) {
  const safeMinutes = Math.max(1, Math.min(720, Number(minutes || 60)));
  const result = await db.query(
    `SELECT COUNT(*)::bigint AS c
     FROM token_purchase_requests
     WHERE user_id = $1
       AND created_at >= now() - make_interval(mins => $2);`,
    [userId, safeMinutes]
  );
  return Number(result.rows[0]?.c || 0);
}

async function listManualReviewQueue(db, limit = 30) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit || 30)));
  const result = await db.query(
    `SELECT id, user_id, token_symbol, chain, pay_currency, usd_amount, token_amount, status, tx_hash, created_at, updated_at, submitted_at, meta_json
     FROM token_purchase_requests
     WHERE status IN ('tx_submitted', 'pending_payment')
       AND (
         COALESCE(meta_json->>'auto_decision', '') = 'manual_review'
         OR status = 'tx_submitted'
       )
     ORDER BY updated_at DESC, created_at DESC
     LIMIT $1;`,
    [safeLimit]
  );
  return result.rows;
}

module.exports = {
  listUserPurchaseRequests,
  getPurchaseRequest,
  lockPurchaseRequest,
  createPurchaseRequest,
  patchPurchaseRequestMeta,
  submitPurchaseTxHash,
  listPurchaseRequests,
  markPurchaseApproved,
  markPurchaseRejected,
  getTokenMarketState,
  upsertTokenMarketState,
  insertTokenPriceTick,
  insertTokenAutoDecision,
  listTokenAutoDecisions,
  insertTokenLiquiditySnapshot,
  countRecentTokenVelocity,
  listManualReviewQueue
};
