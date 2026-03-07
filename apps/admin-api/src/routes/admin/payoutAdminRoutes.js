"use strict";

function registerAdminPayoutRoutes(fastify, deps = {}) {
  const pool = deps.pool;
  const requirePayoutTables = deps.requirePayoutTables;
  const parseLimit = deps.parseLimit;
  const parseAdminId = deps.parseAdminId;
  const deterministicUuid = deps.deterministicUuid;
  const sendTrustNotification = deps.sendTrustNotification;

  if (!pool || typeof pool.query !== "function" || typeof pool.connect !== "function") {
    throw new Error("registerAdminPayoutRoutes requires pool query/connect");
  }
  for (const [name, value] of Object.entries({
    requirePayoutTables,
    parseLimit,
    parseAdminId,
    deterministicUuid
  })) {
    if (typeof value !== "function") {
      throw new Error(`registerAdminPayoutRoutes requires ${name}`);
    }
  }

  fastify.get(
    "/admin/payouts",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            status: { type: "string" },
            limit: { type: "integer" }
          }
        }
      }
    },
    async (request, reply) => {
      if (!(await requirePayoutTables())) {
        reply.code(503).send({ success: false, error: "missing_tables_run_migrations" });
        return;
      }

      const allowedStatuses = new Set(["requested", "pending", "approved", "paid", "rejected"]);
      const status = request.query.status ? String(request.query.status).toLowerCase() : "";
      if (status && !allowedStatuses.has(status)) {
        reply.code(400).send({ success: false, error: "invalid_status" });
        return;
      }

      const limit = parseLimit(request.query.limit, 50, 200);
      let result;
      if (status) {
        result = await pool.query(
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
           WHERE r.status = $1
           ORDER BY r.created_at DESC
           LIMIT $2;`,
          [status, limit]
        );
      } else {
        result = await pool.query(
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
           ORDER BY r.created_at DESC
           LIMIT $1;`,
          [limit]
        );
      }

      reply.send({ success: true, data: result.rows });
    }
  );

  fastify.get("/admin/payouts/:id", async (request, reply) => {
    if (!(await requirePayoutTables())) {
      reply.code(503).send({ success: false, error: "missing_tables_run_migrations" });
      return;
    }
    const requestId = Number(request.params.id);
    if (!Number.isFinite(requestId) || requestId <= 0) {
      reply.code(400).send({ success: false, error: "invalid_id" });
      return;
    }

    const result = await pool.query(
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

    if (result.rows.length === 0) {
      reply.code(404).send({ success: false, error: "not_found" });
      return;
    }

    reply.send({ success: true, data: result.rows[0] });
  });

  fastify.post(
    "/admin/payouts/:id/pay",
    {
      schema: {
        body: {
          type: "object",
          required: ["tx_hash"],
          properties: {
            tx_hash: { type: "string", minLength: 8, maxLength: 255 }
          }
        }
      }
    },
    async (request, reply) => {
      if (!(await requirePayoutTables())) {
        reply.code(503).send({ success: false, error: "missing_tables_run_migrations" });
        return;
      }

      const requestId = Number(request.params.id);
      if (!Number.isFinite(requestId) || requestId <= 0) {
        reply.code(400).send({ success: false, error: "invalid_id" });
        return;
      }
      const txHash = String(request.body.tx_hash || "").trim();
      if (!txHash) {
        reply.code(400).send({ success: false, error: "invalid_tx_hash" });
        return;
      }

      const adminId = parseAdminId(request);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const locked = await client.query(
          `SELECT id, status
           FROM payout_requests
           WHERE id = $1
           FOR UPDATE;`,
          [requestId]
        );
        if (locked.rows.length === 0) {
          await client.query("ROLLBACK");
          reply.code(404).send({ success: false, error: "not_found" });
          return;
        }

        const current = locked.rows[0];
        if (current.status === "rejected") {
          await client.query("ROLLBACK");
          reply.code(409).send({ success: false, error: "already_rejected" });
          return;
        }

        if (current.status !== "paid") {
          await client.query(
            `UPDATE payout_requests
             SET status = 'paid'
             WHERE id = $1;`,
            [requestId]
          );
        }

        await client.query(
          `INSERT INTO payout_tx (payout_request_id, tx_hash, admin_id)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING;`,
          [requestId, txHash, adminId]
        );

        await client.query(
          `INSERT INTO admin_audit (admin_id, action, target, payload_json)
           VALUES ($1, 'payout_paid', $2, $3::jsonb);`,
          [adminId, `payout_request:${requestId}`, JSON.stringify({ tx_hash: txHash })]
        );

        const out = await client.query(
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
        await client.query("COMMIT");
        if (typeof sendTrustNotification === "function" && out.rows?.[0]?.user_id && current.status !== "paid") {
          await sendTrustNotification({
            kind: "payout",
            decision: "paid",
            userId: Number(out.rows[0].user_id || 0),
            request: out.rows[0],
            txHash
          });
        }
        reply.send({ success: true, data: out.rows[0] });
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }
  );

  fastify.post(
    "/admin/payouts/:id/reject",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            reason: { type: "string", maxLength: 500 }
          }
        }
      }
    },
    async (request, reply) => {
      if (!(await requirePayoutTables())) {
        reply.code(503).send({ success: false, error: "missing_tables_run_migrations" });
        return;
      }

      const requestId = Number(request.params.id);
      if (!Number.isFinite(requestId) || requestId <= 0) {
        reply.code(400).send({ success: false, error: "invalid_id" });
        return;
      }
      const reason = String(request.body?.reason || "");
      const adminId = parseAdminId(request);

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const locked = await client.query(
          `SELECT id, user_id, status, source_hc_amount
           FROM payout_requests
           WHERE id = $1
           FOR UPDATE;`,
          [requestId]
        );
        if (locked.rows.length === 0) {
          await client.query("ROLLBACK");
          reply.code(404).send({ success: false, error: "not_found" });
          return;
        }

        const current = locked.rows[0];
        if (current.status === "paid") {
          await client.query("ROLLBACK");
          reply.code(409).send({ success: false, error: "already_paid" });
          return;
        }

        if (current.status !== "rejected") {
          await client.query(
            `UPDATE payout_requests
             SET status = 'rejected'
             WHERE id = $1;`,
            [requestId]
          );
        }

        const refundAmount = Number(current.source_hc_amount || 0);
        if (refundAmount > 0) {
          const refundRef = deterministicUuid(`payout_refund:${requestId}:HC`);
          const inserted = await client.query(
            `INSERT INTO currency_ledger (user_id, currency, delta, reason, ref_event_id, meta_json)
             VALUES ($1, 'HC', $2, 'payout_reject_refund', $3, $4::jsonb)
             ON CONFLICT DO NOTHING
             RETURNING delta;`,
            [
              current.user_id,
              refundAmount,
              refundRef,
              JSON.stringify({ payout_request_id: requestId, reason })
            ]
          );

          if (inserted.rows.length > 0) {
            await client.query(
              `INSERT INTO currency_balances (user_id, currency, balance)
               VALUES ($1, 'HC', $2)
               ON CONFLICT (user_id, currency)
               DO UPDATE SET balance = currency_balances.balance + EXCLUDED.balance,
                             updated_at = now();`,
              [current.user_id, refundAmount]
            );
          }
        }

        await client.query(
          `INSERT INTO admin_audit (admin_id, action, target, payload_json)
           VALUES ($1, 'payout_reject', $2, $3::jsonb);`,
          [adminId, `payout_request:${requestId}`, JSON.stringify({ reason })]
        );

        const out = await client.query(
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

        await client.query("COMMIT");
        if (typeof sendTrustNotification === "function" && out.rows?.[0]?.user_id) {
          await sendTrustNotification({
            kind: "payout",
            decision: "rejected",
            userId: Number(out.rows[0].user_id || 0),
            request: out.rows[0],
            reason
          });
        }
        reply.send({ success: true, data: out.rows[0] });
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }
  );
}

module.exports = {
  registerAdminPayoutRoutes
};
