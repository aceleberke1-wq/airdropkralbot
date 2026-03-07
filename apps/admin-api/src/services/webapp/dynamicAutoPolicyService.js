"use strict";

const { SETTLEMENT_TOKEN_SYMBOL } = require("../../../../../packages/shared/src/currencyGlossary");

const DEFAULT_TOKEN_SYMBOL = SETTLEMENT_TOKEN_SYMBOL;

const DEFAULT_DYNAMIC_AUTO_POLICY_SEGMENTS = Object.freeze([
  {
    segment_key: "s0_trusted",
    priority: 10,
    max_auto_usd: 40,
    risk_threshold: 0.35,
    velocity_per_hour: 12,
    require_onchain_verified: true,
    require_kyc_status: "",
    enabled: true,
    degrade_factor: 1
  },
  {
    segment_key: "s1_normal",
    priority: 20,
    max_auto_usd: 20,
    risk_threshold: 0.28,
    velocity_per_hour: 8,
    require_onchain_verified: true,
    require_kyc_status: "",
    enabled: true,
    degrade_factor: 1
  },
  {
    segment_key: "s2_watch",
    priority: 30,
    max_auto_usd: 8,
    risk_threshold: 0.2,
    velocity_per_hour: 4,
    require_onchain_verified: true,
    require_kyc_status: "",
    enabled: true,
    degrade_factor: 0.9
  },
  {
    segment_key: "s3_review",
    priority: 40,
    max_auto_usd: 1,
    risk_threshold: 0.12,
    velocity_per_hour: 2,
    require_onchain_verified: true,
    require_kyc_status: "",
    enabled: true,
    degrade_factor: 0.75
  },
  {
    segment_key: "s4_blocked",
    priority: 50,
    max_auto_usd: 0.5,
    risk_threshold: 0.05,
    velocity_per_hour: 1,
    require_onchain_verified: true,
    require_kyc_status: "verified",
    enabled: false,
    degrade_factor: 0.5
  }
]);

function toNum(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toText(value, fallback = "") {
  const text = String(value == null ? fallback : value).trim();
  return text || String(fallback || "");
}

function normalizeDynamicSegmentKey(value, fallback = "s1_normal") {
  const key = toText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9:_-]/g, "_")
    .slice(0, 64);
  return key || fallback;
}

function normalizeKycStatus(value) {
  return toText(value, "unknown").toLowerCase();
}

function normalizeKycRequirement(value) {
  const text = toText(value, "")
    .toLowerCase()
    .replace(/[^a-z0-9,_-]/g, "")
    .slice(0, 120);
  return text;
}

function normalizeDynamicSegmentRow(row, tokenSymbol = DEFAULT_TOKEN_SYMBOL) {
  const source = row && typeof row === "object" ? row : {};
  return {
    token_symbol: toText(source.token_symbol || tokenSymbol, DEFAULT_TOKEN_SYMBOL).toUpperCase(),
    segment_key: normalizeDynamicSegmentKey(source.segment_key, "s1_normal"),
    priority: Math.max(1, Math.min(999, Math.floor(toNum(source.priority, 100)))),
    max_auto_usd: Math.max(0.5, toNum(source.max_auto_usd, 10)),
    risk_threshold: clamp(toNum(source.risk_threshold, 0.35), 0, 1),
    velocity_per_hour: Math.max(1, Math.floor(toNum(source.velocity_per_hour, 8))),
    require_onchain_verified: source.require_onchain_verified !== false,
    require_kyc_status: normalizeKycRequirement(source.require_kyc_status || ""),
    enabled: source.enabled !== false,
    degrade_factor: clamp(toNum(source.degrade_factor, 1), 0.3, 1),
    meta_json: source.meta_json && typeof source.meta_json === "object" ? source.meta_json : {},
    updated_by: Math.floor(toNum(source.updated_by, 0)),
    updated_at: source.updated_at || null
  };
}

function getDefaultDynamicAutoPolicySegments(tokenSymbol = DEFAULT_TOKEN_SYMBOL) {
  const symbol = toText(tokenSymbol, DEFAULT_TOKEN_SYMBOL).toUpperCase();
  return DEFAULT_DYNAMIC_AUTO_POLICY_SEGMENTS.map((entry) =>
    normalizeDynamicSegmentRow(
      {
        ...entry,
        token_symbol: symbol,
        meta_json: {
          source: "default_seed"
        }
      },
      symbol
    )
  );
}

async function listDynamicAutoPolicies(db, tokenSymbol = DEFAULT_TOKEN_SYMBOL) {
  const symbol = toText(tokenSymbol, DEFAULT_TOKEN_SYMBOL).toUpperCase();
  try {
    const result = await db.query(
      `SELECT
         token_symbol,
         segment_key,
         priority,
         max_auto_usd,
         risk_threshold,
         velocity_per_hour,
         require_onchain_verified,
         require_kyc_status,
         enabled,
         degrade_factor,
         meta_json,
         updated_by,
         updated_at
       FROM v5_token_auto_policy_dynamic
       WHERE token_symbol = $1
       ORDER BY priority ASC, segment_key ASC;`,
      [symbol]
    );
    const rows = (result.rows || []).map((row) => normalizeDynamicSegmentRow(row, symbol));
    return rows.length > 0 ? rows : getDefaultDynamicAutoPolicySegments(symbol);
  } catch (err) {
    if (err.code === "42P01") {
      return getDefaultDynamicAutoPolicySegments(symbol);
    }
    throw err;
  }
}

async function computeDynamicAutoPolicyAnomaly(db, tokenSymbol = DEFAULT_TOKEN_SYMBOL) {
  const symbol = toText(tokenSymbol, DEFAULT_TOKEN_SYMBOL).toUpperCase();
  let decisionRow = {
    total_24h: 0,
    non_auto_24h: 0,
    manual_review_24h: 0
  };
  let disputeRow = { disputes_24h: 0 };

  try {
    const result = await db.query(
      `SELECT
         COUNT(*)::bigint AS total_24h,
         COUNT(*) FILTER (WHERE decision <> 'auto_approved')::bigint AS non_auto_24h,
         COUNT(*) FILTER (WHERE decision = 'manual_review')::bigint AS manual_review_24h
       FROM token_auto_decisions
       WHERE token_symbol = $1
         AND decided_at >= now() - interval '24 hours';`,
      [symbol]
    );
    decisionRow = result.rows?.[0] || decisionRow;
  } catch (err) {
    if (err.code !== "42P01") {
      throw err;
    }
  }

  try {
    const result = await db.query(
      `SELECT COUNT(*)::bigint AS disputes_24h
       FROM v5_payout_dispute_events
       WHERE created_at >= now() - interval '24 hours';`
    );
    disputeRow = result.rows?.[0] || disputeRow;
  } catch (err) {
    if (err.code !== "42P01") {
      throw err;
    }
  }

  const total24h = Math.max(0, Number(decisionRow.total_24h || 0));
  const nonAuto24h = Math.max(0, Number(decisionRow.non_auto_24h || 0));
  const manualReview24h = Math.max(0, Number(decisionRow.manual_review_24h || 0));
  const disputes24h = Math.max(0, Number(disputeRow.disputes_24h || 0));
  const rejectRate24h = total24h > 0 ? nonAuto24h / total24h : 0;
  const degradeActive = rejectRate24h >= 0.35 || disputes24h >= 3;
  const degradeFactor = degradeActive ? 0.65 : 1;

  return {
    token_symbol: symbol,
    total_decisions_24h: total24h,
    non_auto_decisions_24h: nonAuto24h,
    manual_review_24h: manualReview24h,
    disputes_24h: disputes24h,
    reject_rate_24h: Number(rejectRate24h.toFixed(6)),
    degrade_active: degradeActive,
    degrade_factor: Number(degradeFactor.toFixed(4))
  };
}

function pickDynamicSegmentKey(input = {}) {
  const riskScore = clamp(toNum(input.risk_score, 0), 0, 1);
  const velocityPerHour = Math.max(0, Math.floor(toNum(input.velocity_per_hour, 0)));
  const usdAmount = Math.max(0, toNum(input.usd_amount, 0));
  const gateOpen = input.gate_open !== false;
  const kycStatus = normalizeKycStatus(input.kyc_status);

  if (kycStatus === "sanctioned" || kycStatus === "blocked") {
    return {
      segment_key: "s4_blocked",
      reason: "kyc_blocked"
    };
  }
  if (!gateOpen || riskScore >= 0.8) {
    return {
      segment_key: "s3_review",
      reason: !gateOpen ? "market_gate_closed" : "high_risk"
    };
  }
  if (riskScore >= 0.55 || velocityPerHour >= 16 || usdAmount >= 100) {
    return {
      segment_key: "s2_watch",
      reason: "elevated_risk_or_velocity"
    };
  }
  if (riskScore <= 0.2 && velocityPerHour <= 4 && usdAmount <= 30) {
    return {
      segment_key: "s0_trusted",
      reason: "low_risk_and_low_velocity"
    };
  }
  return {
    segment_key: "s1_normal",
    reason: "default_segment"
  };
}

function hasKycRequirementMismatch(requiredText, kycStatus) {
  const required = toText(requiredText, "")
    .toLowerCase()
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (required.length <= 0) {
    return false;
  }
  const normalizedStatus = normalizeKycStatus(kycStatus);
  return !required.includes(normalizedStatus);
}

async function resolveDynamicAutoPolicyDecision(db, options = {}) {
  const tokenSymbol = toText(options.token_symbol, DEFAULT_TOKEN_SYMBOL).toUpperCase();
  const basePolicy = options.base_policy && typeof options.base_policy === "object" ? options.base_policy : {};
  const baseEnabled = Boolean(basePolicy.enabled);
  const policyBase = {
    enabled: baseEnabled,
    autoUsdLimit: Math.max(0.5, toNum(basePolicy.autoUsdLimit, 10)),
    riskThreshold: clamp(toNum(basePolicy.riskThreshold, 0.35), 0, 1),
    velocityPerHour: Math.max(1, Math.floor(toNum(basePolicy.velocityPerHour, 8))),
    requireOnchainVerified: Boolean(basePolicy.requireOnchainVerified)
  };

  const input = options.input && typeof options.input === "object" ? options.input : {};
  const picked = pickDynamicSegmentKey(input);
  const segments = await listDynamicAutoPolicies(db, tokenSymbol);
  const anomaly = await computeDynamicAutoPolicyAnomaly(db, tokenSymbol);
  const selected =
    segments.find((entry) => entry.segment_key === picked.segment_key) ||
    segments.find((entry) => entry.segment_key === "s1_normal") ||
    normalizeDynamicSegmentRow({}, tokenSymbol);

  const requiredKycMismatch = hasKycRequirementMismatch(selected.require_kyc_status, input.kyc_status);
  const degradeFactor = clamp(
    Number(selected.degrade_factor || 1) * Number(anomaly.degrade_factor || 1),
    0.3,
    1
  );

  const effectivePolicy = {
    enabled: Boolean(policyBase.enabled && selected.enabled && !requiredKycMismatch),
    autoUsdLimit: Math.max(0.5, Number(Math.min(policyBase.autoUsdLimit, selected.max_auto_usd) * degradeFactor)),
    riskThreshold: clamp(Number(Math.min(policyBase.riskThreshold, selected.risk_threshold) * degradeFactor), 0.01, 1),
    velocityPerHour: Math.max(
      1,
      Math.floor(Number(Math.min(policyBase.velocityPerHour, selected.velocity_per_hour) * Math.max(0.5, degradeFactor)))
    ),
    requireOnchainVerified: Boolean(policyBase.requireOnchainVerified || selected.require_onchain_verified)
  };

  return {
    token_symbol: tokenSymbol,
    input: {
      risk_score: clamp(toNum(input.risk_score, 0), 0, 1),
      velocity_per_hour: Math.max(0, Math.floor(toNum(input.velocity_per_hour, 0))),
      usd_amount: Math.max(0, toNum(input.usd_amount, 0)),
      gate_open: input.gate_open !== false,
      kyc_status: normalizeKycStatus(input.kyc_status)
    },
    segment_reason: picked.reason,
    selected_segment_key: selected.segment_key,
    selected_segment: selected,
    required_kyc_mismatch: requiredKycMismatch,
    policy: effectivePolicy,
    base_policy: policyBase,
    anomaly_state: anomaly,
    segments
  };
}

async function upsertDynamicAutoPolicies(db, options = {}) {
  const tokenSymbol = toText(options.token_symbol, DEFAULT_TOKEN_SYMBOL).toUpperCase();
  const actorId = Math.floor(toNum(options.actor_id, 0));
  const reason = toText(options.reason, "admin_dynamic_policy_update").slice(0, 180);
  const note = toText(options.note, "").slice(0, 400);
  const replaceMissing = options.replace_missing !== false;
  const incoming = Array.isArray(options.segments) ? options.segments : [];

  const normalizedSegments = incoming
    .map((entry) =>
      normalizeDynamicSegmentRow(
        {
          ...entry,
          token_symbol: tokenSymbol,
          updated_by: actorId
        },
        tokenSymbol
      )
    )
    .sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0));

  if (normalizedSegments.length <= 0) {
    throw new Error("segments_required");
  }

  for (const segment of normalizedSegments) {
    const previous = await db
      .query(
        `SELECT
           token_symbol,
           segment_key,
           priority,
           max_auto_usd,
           risk_threshold,
           velocity_per_hour,
           require_onchain_verified,
           require_kyc_status,
           enabled,
           degrade_factor,
           meta_json,
           updated_by,
           updated_at
         FROM v5_token_auto_policy_dynamic
         WHERE token_symbol = $1
           AND segment_key = $2
         LIMIT 1;`,
        [tokenSymbol, segment.segment_key]
      )
      .then((res) => (res.rows?.[0] ? normalizeDynamicSegmentRow(res.rows[0], tokenSymbol) : null));

    const upserted = await db.query(
      `INSERT INTO v5_token_auto_policy_dynamic (
         token_symbol,
         segment_key,
         priority,
         max_auto_usd,
         risk_threshold,
         velocity_per_hour,
         require_onchain_verified,
         require_kyc_status,
         enabled,
         degrade_factor,
         meta_json,
         updated_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12)
       ON CONFLICT (token_symbol, segment_key)
       DO UPDATE SET
         priority = EXCLUDED.priority,
         max_auto_usd = EXCLUDED.max_auto_usd,
         risk_threshold = EXCLUDED.risk_threshold,
         velocity_per_hour = EXCLUDED.velocity_per_hour,
         require_onchain_verified = EXCLUDED.require_onchain_verified,
         require_kyc_status = EXCLUDED.require_kyc_status,
         enabled = EXCLUDED.enabled,
         degrade_factor = EXCLUDED.degrade_factor,
         meta_json = EXCLUDED.meta_json,
         updated_by = EXCLUDED.updated_by,
         updated_at = now()
       RETURNING
         token_symbol,
         segment_key,
         priority,
         max_auto_usd,
         risk_threshold,
         velocity_per_hour,
         require_onchain_verified,
         require_kyc_status,
         enabled,
         degrade_factor,
         meta_json,
         updated_by,
         updated_at;`,
      [
        tokenSymbol,
        segment.segment_key,
        Number(segment.priority || 100),
        Number(segment.max_auto_usd || 10),
        Number(segment.risk_threshold || 0.35),
        Number(segment.velocity_per_hour || 8),
        Boolean(segment.require_onchain_verified),
        toText(segment.require_kyc_status, ""),
        Boolean(segment.enabled),
        Number(segment.degrade_factor || 1),
        JSON.stringify(segment.meta_json || {}),
        actorId
      ]
    );
    const next = normalizeDynamicSegmentRow(upserted.rows?.[0] || segment, tokenSymbol);
    await db.query(
      `INSERT INTO v5_token_auto_policy_dynamic_audit (
         token_symbol,
         segment_key,
         previous_policy_json,
         next_policy_json,
         reason,
         note,
         actor_id
       )
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7);`,
      [
        tokenSymbol,
        segment.segment_key,
        JSON.stringify(previous || {}),
        JSON.stringify(next),
        reason,
        note,
        actorId
      ]
    );
  }

  if (replaceMissing) {
    const keepKeys = normalizedSegments.map((entry) => entry.segment_key);
    const staleRows = await db
      .query(
        `SELECT
           token_symbol,
           segment_key,
           priority,
           max_auto_usd,
           risk_threshold,
           velocity_per_hour,
           require_onchain_verified,
           require_kyc_status,
           enabled,
           degrade_factor,
           meta_json,
           updated_by,
           updated_at
         FROM v5_token_auto_policy_dynamic
         WHERE token_symbol = $1
           AND NOT (segment_key = ANY($2::text[]));`,
        [tokenSymbol, keepKeys]
      )
      .then((res) => (res.rows || []).map((row) => normalizeDynamicSegmentRow(row, tokenSymbol)));

    await db.query(
      `DELETE FROM v5_token_auto_policy_dynamic
       WHERE token_symbol = $1
         AND NOT (segment_key = ANY($2::text[]));`,
      [tokenSymbol, keepKeys]
    );

    for (const stale of staleRows) {
      await db.query(
        `INSERT INTO v5_token_auto_policy_dynamic_audit (
           token_symbol,
           segment_key,
           previous_policy_json,
           next_policy_json,
           reason,
           note,
           actor_id
         )
         VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7);`,
        [
          tokenSymbol,
          stale.segment_key,
          JSON.stringify(stale),
          JSON.stringify({}),
          `${reason}_delete_missing`,
          note,
          actorId
        ]
      );
    }
  }

  return listDynamicAutoPolicies(db, tokenSymbol);
}

module.exports = {
  DEFAULT_DYNAMIC_AUTO_POLICY_SEGMENTS,
  normalizeDynamicSegmentKey,
  normalizeKycStatus,
  normalizeDynamicSegmentRow,
  getDefaultDynamicAutoPolicySegments,
  listDynamicAutoPolicies,
  computeDynamicAutoPolicyAnomaly,
  resolveDynamicAutoPolicyDecision,
  upsertDynamicAutoPolicies
};
