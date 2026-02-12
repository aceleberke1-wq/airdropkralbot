function normalizeBalances(rows) {
  const balances = { SC: 0, HC: 0, RC: 0 };
  for (const row of rows) {
    const key = row.currency;
    const value = Number(row.balance || 0);
    if (Object.prototype.hasOwnProperty.call(balances, key)) {
      balances[key] = Number.isFinite(value) ? value : 0;
    }
  }
  return balances;
}

async function getBalances(db, userId) {
  const result = await db.query(
    `SELECT currency, balance
     FROM currency_balances
     WHERE user_id = $1;`,
    [userId]
  );
  return normalizeBalances(result.rows);
}

async function getTodayCounter(db, userId) {
  const result = await db.query(
    `SELECT day_date, tasks_done, sc_earned, hc_earned, rc_earned
     FROM daily_counters
     WHERE user_id = $1
       AND day_date = CURRENT_DATE;`,
    [userId]
  );
  if (result.rows.length === 0) {
    return {
      day_date: null,
      tasks_done: 0,
      sc_earned: 0,
      hc_earned: 0,
      rc_earned: 0
    };
  }
  const row = result.rows[0];
  return {
    day_date: row.day_date,
    tasks_done: Number(row.tasks_done || 0),
    sc_earned: Number(row.sc_earned || 0),
    hc_earned: Number(row.hc_earned || 0),
    rc_earned: Number(row.rc_earned || 0)
  };
}

async function incrementDailyTasks(db, userId, amount = 1) {
  if (!amount || amount <= 0) {
    return;
  }
  await db.query(
    `INSERT INTO daily_counters (user_id, day_date, tasks_done)
     VALUES ($1, CURRENT_DATE, $2)
     ON CONFLICT (user_id, day_date)
     DO UPDATE SET tasks_done = daily_counters.tasks_done + EXCLUDED.tasks_done,
                   updated_at = now();`,
    [userId, amount]
  );
}

async function incrementDailyEarned(db, userId, currency, amount) {
  if (!amount || amount <= 0) {
    return;
  }
  const key = String(currency || "").toUpperCase();
  if (!["SC", "HC", "RC"].includes(key)) {
    return;
  }
  const field = `${key.toLowerCase()}_earned`;
  await db.query(
    `INSERT INTO daily_counters (user_id, day_date, ${field})
     VALUES ($1, CURRENT_DATE, $2)
     ON CONFLICT (user_id, day_date)
     DO UPDATE SET ${field} = daily_counters.${field} + EXCLUDED.${field},
                   updated_at = now();`,
    [userId, amount]
  );
}

async function debitCurrency(db, { userId, currency, amount, reason, meta, refEventId }) {
  const safeAmount = Number(amount || 0);
  if (safeAmount <= 0) {
    return { applied: false, reason: "invalid_amount", balance: null };
  }

  if (refEventId) {
    const existingRef = await db.query(
      `SELECT id
       FROM currency_ledger
       WHERE ref_event_id = $1
       LIMIT 1;`,
      [refEventId]
    );
    if (existingRef.rows.length > 0) {
      const balanceRow = await db.query(
        `SELECT balance
         FROM currency_balances
         WHERE user_id = $1 AND currency = $2;`,
        [userId, currency]
      );
      return {
        applied: false,
        reason: "duplicate_ref",
        balance: balanceRow.rows[0] ? Number(balanceRow.rows[0].balance || 0) : 0
      };
    }
  }

  const locked = await db.query(
    `SELECT balance
     FROM currency_balances
     WHERE user_id = $1 AND currency = $2
     FOR UPDATE;`,
    [userId, currency]
  );
  const balance = locked.rows[0] ? Number(locked.rows[0].balance || 0) : 0;
  if (balance < safeAmount) {
    return { applied: false, reason: "insufficient_balance", balance };
  }

  await db.query(
    `INSERT INTO currency_ledger (user_id, currency, delta, reason, ref_event_id, meta_json)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb);`,
    [userId, currency, -safeAmount, reason, refEventId || null, JSON.stringify(meta || {})]
  );
  const updated = await db.query(
    `UPDATE currency_balances
     SET balance = balance - $3,
         updated_at = now()
     WHERE user_id = $1
       AND currency = $2
     RETURNING balance;`,
    [userId, currency, safeAmount]
  );
  return { applied: true, balance: Number(updated.rows[0].balance || 0) };
}

async function creditCurrency(db, { userId, currency, amount, reason, meta, refEventId }) {
  if (!amount || amount <= 0) {
    return { applied: false, balance: null };
  }

  try {
    await db.query(
      `INSERT INTO currency_ledger (user_id, currency, delta, reason, ref_event_id, meta_json)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb);`,
      [userId, currency, amount, reason, refEventId || null, JSON.stringify(meta || {})]
    );
  } catch (err) {
    if (err.code === "23505" && refEventId) {
      const existing = await db.query(
        `SELECT balance
         FROM currency_balances
         WHERE user_id = $1 AND currency = $2;`,
        [userId, currency]
      );
      return {
        applied: false,
        balance: existing.rows[0] ? Number(existing.rows[0].balance || 0) : 0
      };
    }
    throw err;
  }

  const balanceResult = await db.query(
    `INSERT INTO currency_balances (user_id, currency, balance)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, currency)
     DO UPDATE SET balance = currency_balances.balance + EXCLUDED.balance,
                   updated_at = now()
     RETURNING balance;`,
    [userId, currency, amount]
  );
  await incrementDailyEarned(db, userId, currency, amount);
  return {
    applied: true,
    balance: Number(balanceResult.rows[0].balance || 0)
  };
}

async function creditReward(db, { userId, reward, reason, meta, refEventIds }) {
  const sc = reward.sc || 0;
  const hc = reward.hc || 0;
  const rc = reward.rc || 0;

  const results = {
    SC: await creditCurrency(db, {
      userId,
      currency: "SC",
      amount: sc,
      reason,
      meta,
      refEventId: refEventIds?.SC || null
    }),
    HC: await creditCurrency(db, {
      userId,
      currency: "HC",
      amount: hc,
      reason,
      meta,
      refEventId: refEventIds?.HC || null
    }),
    RC: await creditCurrency(db, {
      userId,
      currency: "RC",
      amount: rc,
      reason,
      meta,
      refEventId: refEventIds?.RC || null
    })
  };
  return results;
}

module.exports = {
  getBalances,
  getTodayCounter,
  incrementDailyTasks,
  debitCurrency,
  creditCurrency,
  creditReward
};
