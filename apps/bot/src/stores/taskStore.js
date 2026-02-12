const crypto = require("crypto");

function randomSeed() {
  return crypto.randomBytes(8).toString("hex");
}

async function expireOldOffers(db, userId) {
  await db.query(
    `UPDATE task_offers
     SET offer_state = 'expired'
     WHERE user_id = $1 AND offer_state = 'offered' AND expires_at <= now();`,
    [userId]
  );
}

async function listActiveOffers(db, userId) {
  const result = await db.query(
    `SELECT id, task_type, difficulty, expires_at, seed
     FROM task_offers
     WHERE user_id = $1 AND offer_state = 'offered' AND expires_at > now()
     ORDER BY created_at ASC;`,
    [userId]
  );
  return result.rows;
}

async function createOffer(db, userId, task) {
  const seed = randomSeed();
  const result = await db.query(
    `INSERT INTO task_offers (user_id, task_type, difficulty, expires_at, offer_state, seed)
     VALUES ($1, $2, $3, now() + make_interval(mins => $4), 'offered', $5)
     RETURNING id, task_type, difficulty, expires_at, seed;`,
    [userId, task.id, task.difficulty, task.durationMinutes, seed]
  );
  return result.rows[0];
}

async function getOffer(db, userId, offerId) {
  const result = await db.query(
    `SELECT id, user_id, task_type, difficulty, expires_at, offer_state, seed
     FROM task_offers
     WHERE id = $1 AND user_id = $2;`,
    [offerId, userId]
  );
  return result.rows[0] || null;
}

async function lockOfferForAccept(db, userId, offerId) {
  const result = await db.query(
    `SELECT id, user_id, task_type, difficulty, expires_at, offer_state, seed, created_at
     FROM task_offers
     WHERE id = $1 AND user_id = $2
     FOR UPDATE;`,
    [offerId, userId]
  );
  return result.rows[0] || null;
}

async function markOfferAccepted(db, offerId) {
  const result = await db.query(
    `UPDATE task_offers
     SET offer_state = 'accepted'
     WHERE id = $1
       AND offer_state = 'offered'
     RETURNING id, offer_state;`,
    [offerId]
  );
  return result.rows[0] || null;
}

async function markOfferConsumed(db, offerId) {
  const result = await db.query(
    `UPDATE task_offers
     SET offer_state = 'consumed'
     WHERE id = $1
       AND offer_state IN ('accepted', 'offered')
     RETURNING id, offer_state;`,
    [offerId]
  );
  return result.rows[0] || null;
}

async function rerollOpenOffers(db, userId) {
  const result = await db.query(
    `UPDATE task_offers
     SET offer_state = 'consumed'
     WHERE user_id = $1
       AND offer_state = 'offered'
     RETURNING id;`,
    [userId]
  );
  return result.rowCount || 0;
}

async function getAttemptByOffer(db, userId, offerId) {
  const result = await db.query(
    `SELECT id, result, started_at, completed_at, anti_abuse_flags
     FROM task_attempts
     WHERE task_offer_id = $1 AND user_id = $2
     ORDER BY id DESC
     LIMIT 1;`,
    [offerId, userId]
  );
  return result.rows[0] || null;
}

async function createAttempt(db, userId, offerId) {
  try {
    const result = await db.query(
      `INSERT INTO task_attempts (task_offer_id, user_id, result)
       VALUES ($1, $2, 'pending')
       RETURNING id, task_offer_id, result, started_at, completed_at, anti_abuse_flags;`,
      [offerId, userId]
    );
    return result.rows[0];
  } catch (err) {
    if (err.code !== "23505") {
      throw err;
    }
    return getAttemptByOffer(db, userId, offerId);
  }
}

async function lockAttempt(db, userId, attemptId) {
  const result = await db.query(
    `SELECT id, task_offer_id, user_id, result, quality_score, started_at, completed_at, anti_abuse_flags
     FROM task_attempts
     WHERE id = $1 AND user_id = $2
     FOR UPDATE;`,
    [attemptId, userId]
  );
  return result.rows[0] || null;
}

async function completeAttemptIfPending(db, attemptId, result, qualityScore, antiAbuseFlags) {
  const update = await db.query(
    `UPDATE task_attempts
     SET result = $2,
         quality_score = $3,
         anti_abuse_flags = COALESCE(anti_abuse_flags, '{}'::jsonb) || $4::jsonb,
         completed_at = now()
     WHERE id = $1
       AND result = 'pending'
     RETURNING id, result, completed_at;`,
    [attemptId, result, qualityScore, JSON.stringify(antiAbuseFlags || {})]
  );
  return update.rows[0] || null;
}

async function getAttempt(db, userId, attemptId) {
  const result = await db.query(
    `SELECT id, task_offer_id, user_id, result, completed_at, anti_abuse_flags
     FROM task_attempts
     WHERE id = $1 AND user_id = $2;`,
    [attemptId, userId]
  );
  return result.rows[0] || null;
}

async function getRecentAttemptResults(db, userId, limit) {
  const result = await db.query(
    `SELECT result
     FROM task_attempts
     WHERE user_id = $1
       AND completed_at IS NOT NULL
     ORDER BY completed_at DESC
     LIMIT $2;`,
    [userId, limit]
  );
  return result.rows.map((row) => row.result);
}

async function getLatestPendingAttempt(db, userId) {
  const result = await db.query(
    `SELECT id, task_offer_id, started_at
     FROM task_attempts
     WHERE user_id = $1
       AND result = 'pending'
     ORDER BY started_at DESC, id DESC
     LIMIT 1;`,
    [userId]
  );
  return result.rows[0] || null;
}

async function getLatestRevealableAttempt(db, userId) {
  const result = await db.query(
    `SELECT a.id, a.task_offer_id, a.completed_at, a.result
     FROM task_attempts a
     LEFT JOIN loot_reveals l ON l.task_attempt_id = a.id
     WHERE a.user_id = $1
       AND a.result <> 'pending'
       AND l.id IS NULL
     ORDER BY a.completed_at DESC NULLS LAST, a.id DESC
     LIMIT 1;`,
    [userId]
  );
  return result.rows[0] || null;
}

async function getLoot(db, attemptId) {
  const result = await db.query(
    `SELECT id, loot_tier, pity_counter_before, pity_counter_after, rng_rolls_json
     FROM loot_reveals
     WHERE task_attempt_id = $1;`,
    [attemptId]
  );
  return result.rows[0] || null;
}

async function createLoot(db, { userId, attemptId, lootTier, pityBefore, pityAfter, rng }) {
  try {
    const result = await db.query(
      `INSERT INTO loot_reveals
        (user_id, task_attempt_id, loot_tier, pity_counter_before, pity_counter_after, rng_rolls_json)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING id, loot_tier, pity_counter_before, pity_counter_after, rng_rolls_json;`,
      [userId, attemptId, lootTier, pityBefore, pityAfter, JSON.stringify(rng || {})]
    );
    return result.rows[0] || null;
  } catch (err) {
    if (err.code === "23505") {
      return null;
    }
    throw err;
  }
}

async function getRecentLootTiers(db, userId, limit) {
  const result = await db.query(
    `SELECT loot_tier
     FROM loot_reveals
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2;`,
    [userId, limit]
  );
  return result.rows.map((row) => row.loot_tier);
}

module.exports = {
  expireOldOffers,
  listActiveOffers,
  createOffer,
  getOffer,
  lockOfferForAccept,
  markOfferAccepted,
  markOfferConsumed,
  rerollOpenOffers,
  getAttemptByOffer,
  createAttempt,
  lockAttempt,
  completeAttemptIfPending,
  getAttempt,
  getRecentAttemptResults,
  getLatestPendingAttempt,
  getLatestRevealableAttempt,
  getLoot,
  createLoot,
  getRecentLootTiers
};
