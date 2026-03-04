import crypto from "node:crypto";
import process from "node:process";
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";
import { Pool } from "pg";
import dbConnection from "../packages/shared/src/v5/dbConnection.js";

const { buildPgPoolConfig } = dbConnection;

const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

function getEnv(name, fallback = "") {
  const value = String(process.env[name] || fallback).trim();
  return value;
}

function buildPool() {
  const connectionString = getEnv("DATABASE_URL");
  if (!connectionString) {
    throw new Error("missing_env:DATABASE_URL");
  }
  const useSsl = getEnv("DATABASE_SSL") === "1";
  return new Pool(
    buildPgPoolConfig({
      databaseUrl: connectionString,
      sslEnabled: useSsl,
      rejectUnauthorized: false
    })
  );
}

function parseArgs(argv) {
  const args = { mode: "setup", requestId: 0, kycUserId: 0 };
  if (argv.length > 0) {
    args.mode = String(argv[0] || "setup").trim().toLowerCase();
  }
  for (let i = 1; i < argv.length; i += 1) {
    const token = String(argv[i] || "").trim();
    if (token === "--request-id" && argv[i + 1]) {
      args.requestId = Number(argv[i + 1] || 0);
      i += 1;
      continue;
    }
    if (token === "--kyc-user-id" && argv[i + 1]) {
      args.kycUserId = Number(argv[i + 1] || 0);
      i += 1;
    }
  }
  return args;
}

async function hasKycTables(client) {
  const res = await client.query(
    `SELECT
       to_regclass('public.v5_kyc_profiles') IS NOT NULL AS profiles,
       to_regclass('public.v5_kyc_screening_events') IS NOT NULL AS screening;`
  );
  const row = res.rows?.[0] || {};
  return Boolean(row.profiles && row.screening);
}

async function ensureAdminProfile(client) {
  const adminTelegramId = Number(getEnv("ADMIN_TELEGRAM_ID") || 0);
  if (!Number.isFinite(adminTelegramId) || adminTelegramId <= 0) {
    return { ok: false, reason: "admin_telegram_id_invalid", user_id: 0, telegram_id: 0 };
  }

  let user = await client
    .query(
      `SELECT id, telegram_id
       FROM users
       WHERE telegram_id = $1
       LIMIT 1;`,
      [adminTelegramId]
    )
    .then((res) => res.rows?.[0] || null);
  let createdUser = false;
  if (!user) {
    user = await client.query(
      `INSERT INTO users (telegram_id, locale, timezone, status, last_seen_at)
       VALUES ($1, 'tr', 'Europe/Istanbul', 'active', now())
       RETURNING id, telegram_id;`,
      [adminTelegramId]
    );
    user = user.rows?.[0] || null;
    createdUser = Boolean(user && Number(user.id || 0) > 0);
  }
  const userId = Number(user?.id || 0);
  if (!userId) {
    return {
      ok: false,
      reason: "admin_user_missing_after_insert",
      user_id: 0,
      telegram_id: adminTelegramId
    };
  }

  const identityInsert = await client.query(
    `INSERT INTO identities (user_id, public_name, kingdom_tier, reputation_score, prestige_level, season_rank, visibility_flags, updated_at)
     VALUES ($1, $2, 0, 0, 0, 0, '{}'::jsonb, now())
     ON CONFLICT (user_id) DO NOTHING
     RETURNING user_id;`,
    [userId, `smoke_admin_${adminTelegramId}`]
  );
  const streakInsert = await client.query(
    `INSERT INTO streaks (user_id, current_streak, best_streak, last_action_at, grace_until, decay_state)
     VALUES ($1, 0, 0, NULL, NULL, '{}'::jsonb)
     ON CONFLICT (user_id) DO NOTHING
     RETURNING user_id;`,
    [userId]
  );

  return {
    ok: true,
    user_id: userId,
    telegram_id: adminTelegramId,
    created_user: createdUser,
    created_identity: Number(identityInsert.rowCount || 0) > 0,
    created_streak: Number(streakInsert.rowCount || 0) > 0
  };
}

async function findFixtureUserId(client) {
  const adminTelegramId = Number(getEnv("ADMIN_TELEGRAM_ID") || 0);
  const res = await client.query(
    `SELECT u.id
     FROM users u
     WHERE NOT EXISTS (
       SELECT 1
       FROM payout_requests p
       WHERE p.user_id = u.id
         AND p.currency = 'BTC'
         AND p.status IN ('requested', 'pending', 'approved')
     )
     ORDER BY CASE WHEN u.telegram_id = $1 THEN 0 ELSE 1 END, u.id ASC
     LIMIT 1;`,
    [adminTelegramId]
  );
  const found = Number(res.rows?.[0]?.id || 0);
  if (found > 0) {
    return found;
  }

  // Fallback: create a dedicated smoke user if every existing user has an active payout request.
  const smokeTelegramId = Number(`9${Date.now()}`.slice(0, 15));
  const created = await client.query(
    `INSERT INTO users (telegram_id, locale, timezone, status)
     VALUES ($1, 'tr', 'Europe/Istanbul', 'active')
     RETURNING id;`,
    [smokeTelegramId]
  );
  return Number(created.rows?.[0]?.id || 0);
}

async function createDedicatedFixtureUser(client, label = "smoke_v5_1") {
  const entropy = `${Date.now()}${Math.floor(Math.random() * 1000000)}`;
  const telegramId = Number(`8${entropy}`.slice(0, 15));
  const created = await client.query(
    `INSERT INTO users (telegram_id, locale, timezone, status)
     VALUES ($1, 'tr', 'Europe/Istanbul', 'active')
     RETURNING id;`,
    [telegramId]
  );
  return {
    user_id: Number(created.rows?.[0]?.id || 0),
    telegram_id: telegramId,
    label: String(label || "smoke_v5_1")
  };
}

async function setupKycFixture(client) {
  const dedicatedUser = await createDedicatedFixtureUser(client, "smoke_v5_1_kyc");
  const userId = Number(dedicatedUser.user_id || 0);
  if (!userId) {
    return { ok: false, reason: "kyc_fixture_user_not_created", user_id: 0 };
  }

  const marker = `smoke_v5_1:kyc:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
  const addressNorm = `0x${crypto.createHash("sha256").update(marker).digest("hex").slice(0, 40)}`;
  const payloadJson = {
    source: "smoke_fixture",
    fixture_marker: marker,
    reason_code: "risk_threshold",
    seeded_at: new Date().toISOString()
  };
  await client.query(
    `INSERT INTO v5_kyc_profiles (user_id, status, tier, provider_ref, payload_json, updated_at)
     VALUES ($1, 'pending', 'threshold_review', 'smoke_fixture', $2::jsonb, now())
     ON CONFLICT (user_id)
     DO UPDATE SET
       status = 'pending',
       tier = 'threshold_review',
       provider_ref = 'smoke_fixture',
       payload_json = COALESCE(v5_kyc_profiles.payload_json, '{}'::jsonb) || $2::jsonb,
       updated_at = now();`,
    [userId, JSON.stringify(payloadJson)]
  );
  await client.query(
    `INSERT INTO v5_kyc_screening_events (user_id, chain, address_norm, screening_result, risk_score, reason_code, payload_json)
     VALUES ($1, 'eth', $2, 'manual_review', $3, 'risk_threshold', $4::jsonb);`,
    [userId, addressNorm, 0.91, JSON.stringify(payloadJson)]
  );

  return {
    ok: true,
    user_id: userId,
    telegram_id: Number(dedicatedUser.telegram_id || 0),
    marker
  };
}

async function setupFixture(client) {
  const adminProfile = await ensureAdminProfile(client);
  if (!adminProfile.ok) {
    return {
      ok: false,
      reason: String(adminProfile.reason || "admin_profile_not_ready"),
      admin_user_id: Number(adminProfile.user_id || 0),
      admin_telegram_id: Number(adminProfile.telegram_id || 0)
    };
  }

  const userId = await findFixtureUserId(client);
  if (!userId) {
    return {
      ok: false,
      reason: "fixture_user_not_found"
    };
  }
  const marker = `smoke_v5_1:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
  const addressHash = crypto.createHash("sha256").update(marker).digest("hex");
  const insert = await client.query(
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
     VALUES ($1, 'BTC', $2, 'SMOKE_FIXTURE', $3, 0, 0, 'requested', now() + interval '72 hours')
     RETURNING id, user_id;`,
    [userId, 0.00010001, addressHash]
  );

  let kyc = {
    ok: false,
    skipped: true,
    reason: "kyc_tables_missing",
    user_id: 0
  };
  const kycReady = await hasKycTables(client).catch(() => false);
  if (kycReady) {
    kyc = await setupKycFixture(client);
  }

  return {
    ok: true,
    request_id: Number(insert.rows?.[0]?.id || 0),
    user_id: Number(insert.rows?.[0]?.user_id || 0),
    marker: addressHash,
    admin_ready: true,
    admin_user_id: Number(adminProfile.user_id || 0),
    admin_telegram_id: Number(adminProfile.telegram_id || 0),
    admin_created_user: Boolean(adminProfile.created_user),
    admin_created_identity: Boolean(adminProfile.created_identity),
    admin_created_streak: Boolean(adminProfile.created_streak),
    kyc_ready: kycReady,
    kyc_ok: Boolean(kyc?.ok),
    kyc_user_id: Number(kyc?.user_id || 0),
    kyc_marker: String(kyc?.marker || ""),
    kyc_reason: String(kyc?.reason || "")
  };
}

async function cleanupPayoutFixture(client, requestId) {
  const id = Number(requestId || 0);
  if (!id) {
    return { ok: false, reason: "invalid_request_id" };
  }
  const row = await client.query(
    `SELECT id, address_type
     FROM payout_requests
     WHERE id = $1
     LIMIT 1;`,
    [id]
  );
  const addressType = String(row.rows?.[0]?.address_type || "");
  if (!row.rows?.length) {
    return { ok: true, deleted: false, reason: "already_absent" };
  }
  if (addressType !== "SMOKE_FIXTURE") {
    return { ok: false, deleted: false, reason: "fixture_guard_mismatch" };
  }

  await client.query("DELETE FROM payout_tx WHERE payout_request_id = $1;", [id]);
  await client.query("DELETE FROM payout_release_events WHERE payout_request_id = $1;", [id]).catch((err) => {
    if (err.code !== "42P01") throw err;
  });
  await client.query("DELETE FROM v5_unified_admin_queue_action_events WHERE request_id = $1;", [id]).catch((err) => {
    if (err.code !== "42P01") throw err;
  });
  await client.query("DELETE FROM admin_audit WHERE target = $1;", [`payout_request:${id}`]).catch((err) => {
    if (err.code !== "42P01") throw err;
  });
  await client.query("DELETE FROM payout_requests WHERE id = $1;", [id]);
  return { ok: true, deleted: true, request_id: id };
}

async function cleanupKycFixture(client, kycUserId) {
  const userId = Number(kycUserId || 0);
  if (!userId) {
    return { ok: false, reason: "invalid_kyc_user_id" };
  }
  const profile = await client
    .query(
      `SELECT user_id, provider_ref, payload_json
       FROM v5_kyc_profiles
       WHERE user_id = $1
       LIMIT 1;`,
      [userId]
    )
    .then((res) => res.rows?.[0] || null)
    .catch((err) => {
      if (err.code === "42P01") return null;
      throw err;
    });
  if (!profile) {
    return { ok: true, deleted: false, reason: "kyc_profile_absent", user_id: userId };
  }
  if (String(profile.provider_ref || "") !== "smoke_fixture") {
    return { ok: false, deleted: false, reason: "kyc_fixture_guard_mismatch", user_id: userId };
  }

  await client
    .query("DELETE FROM v5_unified_admin_queue_action_events WHERE kind = 'kyc_manual_review' AND request_id = $1;", [userId])
    .catch((err) => {
      if (err.code !== "42P01") throw err;
    });
  await client
    .query("DELETE FROM admin_audit WHERE target = $1;", [`kyc_profile:${userId}`])
    .catch((err) => {
      if (err.code !== "42P01") throw err;
    });
  await client
    .query("DELETE FROM v5_kyc_screening_events WHERE user_id = $1;", [userId])
    .catch((err) => {
      if (err.code !== "42P01") throw err;
    });
  await client
    .query("DELETE FROM v5_kyc_profiles WHERE user_id = $1;", [userId])
    .catch((err) => {
      if (err.code !== "42P01") throw err;
    });
  await client
    .query("DELETE FROM v5_wallet_sessions WHERE user_id = $1;", [userId])
    .catch((err) => {
      if (err.code !== "42P01") throw err;
    });
  await client
    .query("DELETE FROM v5_wallet_challenges WHERE user_id = $1;", [userId])
    .catch((err) => {
      if (err.code !== "42P01") throw err;
    });
  await client
    .query("DELETE FROM v5_wallet_links WHERE user_id = $1;", [userId])
    .catch((err) => {
      if (err.code !== "42P01") throw err;
    });
  const deletedUser = await client
    .query("DELETE FROM users WHERE id = $1;", [userId])
    .then((res) => Number(res.rowCount || 0) > 0)
    .catch(() => false);
  return { ok: true, deleted: true, user_id: userId, user_deleted: deletedUser };
}

async function cleanupFixture(client, options = {}) {
  const payoutRequestId = Number(options.requestId || 0);
  const kycUserId = Number(options.kycUserId || 0);
  const payoutResult =
    payoutRequestId > 0
      ? await cleanupPayoutFixture(client, payoutRequestId)
      : { ok: false, skipped: true, reason: "invalid_request_id" };
  const kycResult =
    kycUserId > 0
      ? await cleanupKycFixture(client, kycUserId)
      : { ok: false, skipped: true, reason: "invalid_kyc_user_id" };
  return {
    ok: Boolean(payoutResult.ok || kycResult.ok),
    payout: payoutResult,
    kyc: kycResult
  };
}

async function main() {
  const { mode, requestId, kycUserId } = parseArgs(process.argv.slice(2));
  const pool = buildPool();
  const client = await pool.connect();
  try {
    if (mode === "setup") {
      const result = await setupFixture(client);
      console.log(JSON.stringify(result));
      return;
    }
    if (mode === "cleanup") {
      const result = await cleanupFixture(client, { requestId, kycUserId });
      console.log(JSON.stringify(result));
      return;
    }
    throw new Error(`invalid_mode:${mode}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  process.stderr.write(`${err?.message || err}`);
  process.exit(1);
});
