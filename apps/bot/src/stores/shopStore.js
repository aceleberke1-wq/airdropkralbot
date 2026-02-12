const DEFAULT_OFFERS = [
  {
    offer_type: "kingdom_boost_2h",
    price: 150,
    currency: "SC",
    benefit_json: {
      title: "Kingdom Boost 2H",
      effect_key: "sc_boost",
      sc_multiplier: 0.25,
      duration_hours: 2
    }
  },
  {
    offer_type: "streak_shield_24h",
    price: 80,
    currency: "SC",
    benefit_json: {
      title: "Streak Shield 24H",
      effect_key: "streak_shield",
      duration_hours: 24
    }
  },
  {
    offer_type: "premium_pass_7d",
    price: 1,
    currency: "HC",
    benefit_json: {
      title: "Premium Pass 7D",
      effect_key: "premium_pass",
      sc_multiplier: 0.15,
      season_point_bonus: 0.2,
      duration_hours: 168
    }
  }
];

async function ensureDefaultOffers(db) {
  const check = await db.query(
    `SELECT count(*) AS total
     FROM offers
     WHERE (start_at IS NULL OR start_at <= now())
       AND (end_at IS NULL OR end_at > now());`
  );
  const total = Number(check.rows[0]?.total || 0);
  if (total > 0) {
    return;
  }
  for (const offer of DEFAULT_OFFERS) {
    await db.query(
      `INSERT INTO offers (offer_type, price, currency, benefit_json, start_at, end_at, limits_json)
       VALUES ($1, $2, $3, $4::jsonb, now(), now() + interval '365 days', '{}'::jsonb);`,
      [offer.offer_type, offer.price, offer.currency, JSON.stringify(offer.benefit_json)]
    );
  }
}

async function listActiveOffers(db, limit = 8) {
  const result = await db.query(
    `SELECT id, offer_type, price, currency, benefit_json, start_at, end_at
     FROM offers
     WHERE (start_at IS NULL OR start_at <= now())
       AND (end_at IS NULL OR end_at > now())
     ORDER BY id DESC
     LIMIT $1;`,
    [limit]
  );
  return result.rows;
}

async function getOfferById(db, offerId) {
  const result = await db.query(
    `SELECT id, offer_type, price, currency, benefit_json, start_at, end_at
     FROM offers
     WHERE id = $1;`,
    [offerId]
  );
  return result.rows[0] || null;
}

async function getActiveEffects(db, userId) {
  const result = await db.query(
    `SELECT effect_key, effect_level, expires_at, meta_json
     FROM user_effects
     WHERE user_id = $1
       AND expires_at > now();`,
    [userId]
  );
  return result.rows;
}

function getScBoostMultiplier(effects) {
  let total = 0;
  for (const effect of effects || []) {
    if (effect.effect_key === "sc_boost") {
      total += Number(effect.meta_json?.sc_multiplier || 0);
    }
    if (effect.effect_key === "premium_pass") {
      total += Number(effect.meta_json?.sc_multiplier || 0);
    }
  }
  return total;
}

function getSeasonBonusMultiplier(effects) {
  let total = 0;
  for (const effect of effects || []) {
    if (effect.effect_key === "premium_pass") {
      total += Number(effect.meta_json?.season_point_bonus || 0);
    }
  }
  return total;
}

function applyEffectsToReward(reward, effects) {
  const scBoost = getScBoostMultiplier(effects);
  const next = {
    sc: Number(reward.sc || 0),
    hc: Number(reward.hc || 0),
    rc: Number(reward.rc || 0)
  };
  if (scBoost > 0 && next.sc > 0) {
    next.sc = Math.max(1, Math.round(next.sc * (1 + scBoost)));
  }
  return next;
}

async function addOrExtendEffect(db, { userId, effectKey, level = 1, durationHours, meta }) {
  const safeHours = Math.max(1, Number(durationHours || 1));
  const active = await db.query(
    `SELECT id, expires_at
     FROM user_effects
     WHERE user_id = $1
       AND effect_key = $2
       AND expires_at > now()
     ORDER BY expires_at DESC
     LIMIT 1
     FOR UPDATE;`,
    [userId, effectKey]
  );

  if (active.rows.length > 0) {
    const current = active.rows[0];
    const updated = await db.query(
      `UPDATE user_effects
       SET expires_at = expires_at + make_interval(hours => $2),
           effect_level = GREATEST(effect_level, $3),
           meta_json = COALESCE(meta_json, '{}'::jsonb) || $4::jsonb,
           updated_at = now()
       WHERE id = $1
       RETURNING id, effect_key, expires_at;`,
      [current.id, safeHours, level, JSON.stringify(meta || {})]
    );
    return updated.rows[0];
  }

  const inserted = await db.query(
    `INSERT INTO user_effects (user_id, effect_key, effect_level, expires_at, meta_json)
     VALUES ($1, $2, $3, now() + make_interval(hours => $4), $5::jsonb)
     RETURNING id, effect_key, expires_at;`,
    [userId, effectKey, level, safeHours, JSON.stringify(meta || {})]
  );
  return inserted.rows[0];
}

async function createPurchase(db, { userId, offerId, status = "paid" }) {
  const result = await db.query(
    `INSERT INTO purchases (user_id, offer_id, status)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, offer_id, status, created_at;`,
    [userId, offerId, status]
  );
  return result.rows[0];
}

module.exports = {
  ensureDefaultOffers,
  listActiveOffers,
  getOfferById,
  getActiveEffects,
  getScBoostMultiplier,
  getSeasonBonusMultiplier,
  applyEffectsToReward,
  addOrExtendEffect,
  createPurchase
};
