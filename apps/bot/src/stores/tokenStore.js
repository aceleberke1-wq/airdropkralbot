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

module.exports = {
  listUserPurchaseRequests,
  getPurchaseRequest,
  lockPurchaseRequest,
  createPurchaseRequest,
  submitPurchaseTxHash,
  listPurchaseRequests,
  markPurchaseApproved,
  markPurchaseRejected
};
