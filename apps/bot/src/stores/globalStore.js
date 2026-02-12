function getWarTier(value) {
  const v = Number(value || 0);
  if (v >= 20000) return { tier: "Omega", next: null };
  if (v >= 7000) return { tier: "Gamma", next: 20000 };
  if (v >= 2000) return { tier: "Beta", next: 7000 };
  if (v >= 500) return { tier: "Alpha", next: 2000 };
  return { tier: "Seed", next: 500 };
}

async function incrementCounter(db, key, delta) {
  const amount = Number(delta || 0);
  if (!amount) {
    return getCounter(db, key);
  }
  const result = await db.query(
    `INSERT INTO global_counters (counter_key, counter_value, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (counter_key)
     DO UPDATE SET counter_value = global_counters.counter_value + EXCLUDED.counter_value,
                   updated_at = now()
     RETURNING counter_key, counter_value, updated_at;`,
    [key, amount]
  );
  return result.rows[0];
}

async function getCounter(db, key) {
  const result = await db.query(
    `SELECT counter_key, counter_value, updated_at
     FROM global_counters
     WHERE counter_key = $1;`,
    [key]
  );
  if (result.rows.length === 0) {
    return { counter_key: key, counter_value: 0, updated_at: null };
  }
  return result.rows[0];
}

async function getWarStatus(db, seasonId) {
  const key = `war_pool_s${seasonId}`;
  const counter = await getCounter(db, key);
  const value = Number(counter.counter_value || 0);
  const tier = getWarTier(value);
  return {
    key,
    value,
    tier: tier.tier,
    next: tier.next,
    updated_at: counter.updated_at
  };
}

module.exports = {
  incrementCounter,
  getCounter,
  getWarStatus,
  getWarTier
};
