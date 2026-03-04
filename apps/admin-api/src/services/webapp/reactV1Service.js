"use strict";

const crypto = require("crypto");

const DEFAULT_EXPERIMENT_KEY = "webapp_react_v1";
const DEFAULT_VARIANT_CONTROL = "control";
const DEFAULT_VARIANT_TREATMENT = "treatment";

function clampInt(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function toSafeText(value, maxLen = 160, fallback = "") {
  const raw = String(value == null ? fallback : value).trim();
  if (!raw) {
    return String(fallback || "");
  }
  return raw.slice(0, Math.max(0, Number(maxLen) || 0));
}

function toEventValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Number(parsed);
}

function toIsoOrNull(value) {
  if (!value) {
    return null;
  }
  const ts = Number(value);
  const asDate = Number.isFinite(ts) ? new Date(ts) : new Date(value);
  if (!Number.isFinite(asDate.getTime())) {
    return null;
  }
  return asDate.toISOString();
}

function stableUnit(seed) {
  const hex = crypto.createHash("sha1").update(String(seed || "")).digest("hex");
  return parseInt(hex.slice(0, 8), 16) / 0xffffffff;
}

function computeCohortBucket(uid, experimentKey = DEFAULT_EXPERIMENT_KEY) {
  const key = `${Number(uid || 0)}:${String(experimentKey || DEFAULT_EXPERIMENT_KEY)}`;
  return clampInt(stableUnit(key) * 100, 0, 99, 0);
}

function computeVariantByBucket({
  bucket,
  enabled,
  treatmentPercent
}) {
  if (!enabled) {
    return DEFAULT_VARIANT_CONTROL;
  }
  const pct = clampInt(treatmentPercent, 0, 100, 0);
  return Number(bucket) < pct ? DEFAULT_VARIANT_TREATMENT : DEFAULT_VARIANT_CONTROL;
}

function buildExperimentAssignment({
  uid,
  experimentKey = DEFAULT_EXPERIMENT_KEY,
  enabled = false,
  treatmentPercent = 0
} = {}) {
  const safeUid = Math.max(0, Number(uid || 0));
  const key = toSafeText(experimentKey, 80, DEFAULT_EXPERIMENT_KEY) || DEFAULT_EXPERIMENT_KEY;
  const bucket = computeCohortBucket(safeUid, key);
  const variant = computeVariantByBucket({
    bucket,
    enabled: Boolean(enabled),
    treatmentPercent
  });
  return {
    uid: safeUid,
    key,
    variant,
    cohort_bucket: bucket,
    assigned_at: new Date().toISOString()
  };
}

async function resolveExperimentAssignment(db, options = {}) {
  const safeUid = Math.max(0, Number(options.uid || 0));
  const experimentKey = toSafeText(options.experimentKey, 80, DEFAULT_EXPERIMENT_KEY) || DEFAULT_EXPERIMENT_KEY;
  const enabled = Boolean(options.enabled);
  const treatmentPercent = clampInt(options.treatmentPercent, 0, 100, 0);
  const forceTreatment = Boolean(options.forceTreatment);
  const fallback = buildExperimentAssignment({
    uid: safeUid,
    experimentKey,
    enabled,
    treatmentPercent
  });

  if (!db || typeof db.query !== "function" || safeUid <= 0) {
    return {
      ...fallback,
      source: "fallback"
    };
  }

  try {
    const read = await db.query(
      `SELECT uid, experiment_key, variant_key, cohort_bucket, assigned_at
       FROM v5_webapp_experiment_assignments
       WHERE uid = $1
         AND experiment_key = $2
       LIMIT 1;`,
      [safeUid, experimentKey]
    );
    if (read.rows?.[0]) {
      const row = read.rows[0];
      const existingVariant =
        String(row.variant_key || DEFAULT_VARIANT_CONTROL) === DEFAULT_VARIANT_TREATMENT
          ? DEFAULT_VARIANT_TREATMENT
          : DEFAULT_VARIANT_CONTROL;
      if (forceTreatment && existingVariant !== DEFAULT_VARIANT_TREATMENT) {
        const forced = await db.query(
          `UPDATE v5_webapp_experiment_assignments
           SET variant_key = $3,
               assignment_meta_json = assignment_meta_json || $4::jsonb
           WHERE uid = $1
             AND experiment_key = $2
           RETURNING uid, experiment_key, variant_key, cohort_bucket, assigned_at;`,
          [
            safeUid,
            experimentKey,
            DEFAULT_VARIANT_TREATMENT,
            JSON.stringify({
              force_treatment: true,
              forced_at: new Date().toISOString(),
              treatment_percent: treatmentPercent,
              enabled: Boolean(enabled),
              source: "webapp_cutover"
            })
          ]
        );
        const forcedRow = forced.rows?.[0] || {
          ...row,
          variant_key: DEFAULT_VARIANT_TREATMENT
        };
        return {
          uid: Math.max(0, Number(forcedRow.uid || safeUid)),
          key: toSafeText(forcedRow.experiment_key, 80, experimentKey) || experimentKey,
          variant: DEFAULT_VARIANT_TREATMENT,
          cohort_bucket: clampInt(forcedRow.cohort_bucket, 0, 99, fallback.cohort_bucket),
          assigned_at: toIsoOrNull(forcedRow.assigned_at) || fallback.assigned_at,
          source: "db_forced_treatment"
        };
      }
      return {
        uid: Math.max(0, Number(row.uid || safeUid)),
        key: toSafeText(row.experiment_key, 80, experimentKey) || experimentKey,
        variant: existingVariant,
        cohort_bucket: clampInt(row.cohort_bucket, 0, 99, fallback.cohort_bucket),
        assigned_at: toIsoOrNull(row.assigned_at) || fallback.assigned_at,
        source: "db_existing"
      };
    }

    const assignment = buildExperimentAssignment({
      uid: safeUid,
      experimentKey,
      enabled,
      treatmentPercent
    });
    await db.query(
      `INSERT INTO v5_webapp_experiment_assignments
         (uid, experiment_key, variant_key, cohort_bucket, assignment_meta_json)
       VALUES
         ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (uid, experiment_key)
       DO NOTHING;`,
      [
        assignment.uid,
        assignment.key,
        assignment.variant,
        assignment.cohort_bucket,
        JSON.stringify({
          treatment_percent: treatmentPercent,
          enabled: Boolean(enabled),
          source: "webapp_bootstrap"
        })
      ]
    );

    const finalRead = await db.query(
      `SELECT uid, experiment_key, variant_key, cohort_bucket, assigned_at
       FROM v5_webapp_experiment_assignments
       WHERE uid = $1
         AND experiment_key = $2
       LIMIT 1;`,
      [safeUid, experimentKey]
    );
    const finalRow = finalRead.rows?.[0] || null;
    if (!finalRow) {
      return {
        ...assignment,
        source: "computed_no_row"
      };
    }
    return {
      uid: Math.max(0, Number(finalRow.uid || safeUid)),
      key: toSafeText(finalRow.experiment_key, 80, experimentKey) || experimentKey,
      variant: String(finalRow.variant_key || DEFAULT_VARIANT_CONTROL) === DEFAULT_VARIANT_TREATMENT ? DEFAULT_VARIANT_TREATMENT : DEFAULT_VARIANT_CONTROL,
      cohort_bucket: clampInt(finalRow.cohort_bucket, 0, 99, assignment.cohort_bucket),
      assigned_at: toIsoOrNull(finalRow.assigned_at) || assignment.assigned_at,
      source: "db_inserted"
    };
  } catch (err) {
    if (err.code === "42P01") {
      return {
        ...fallback,
        source: "fallback_table_missing"
      };
    }
    throw err;
  }
}

function isSafeEventKey(value) {
  const clean = String(value || "")
    .trim()
    .toLowerCase();
  return /^[a-z0-9:_-]{2,80}$/.test(clean);
}

function normalizeUiEvent(rawEvent, defaults = {}) {
  const raw = rawEvent && typeof rawEvent === "object" ? rawEvent : null;
  if (!raw) {
    return null;
  }
  const eventKey = toSafeText(raw.event_key, 80, "").toLowerCase();
  if (!isSafeEventKey(eventKey)) {
    return null;
  }
  const tabKey = toSafeText(raw.tab_key || defaults.tab_key || "home", 40, "home").toLowerCase();
  const panelKey = toSafeText(raw.panel_key || defaults.panel_key || "unknown", 64, "unknown").toLowerCase();
  const routeKey = toSafeText(raw.route_key || defaults.route_key || "", 80, "").toLowerCase();
  const variantKey = toSafeText(raw.variant_key || defaults.variant_key || DEFAULT_VARIANT_CONTROL, 24, DEFAULT_VARIANT_CONTROL).toLowerCase();
  const experimentKey = toSafeText(
    raw.experiment_key || defaults.experiment_key || DEFAULT_EXPERIMENT_KEY,
    80,
    DEFAULT_EXPERIMENT_KEY
  ).toLowerCase();
  const payloadJson = raw.payload_json && typeof raw.payload_json === "object" ? raw.payload_json : {};
  const payloadText = JSON.stringify(payloadJson);
  if (Buffer.byteLength(payloadText, "utf8") > 4096) {
    return null;
  }
  const cohortBucket = clampInt(raw.cohort_bucket ?? defaults.cohort_bucket, 0, 99, 0);
  const eventValue = toEventValue(raw.event_value);
  const clientTsIso = toIsoOrNull(raw.client_ts) || toIsoOrNull(raw.client_at) || new Date().toISOString();

  return {
    event_key: eventKey,
    tab_key: tabKey,
    panel_key: panelKey,
    route_key: routeKey,
    variant_key: variantKey,
    experiment_key: experimentKey,
    cohort_bucket: cohortBucket,
    event_value: eventValue,
    payload_json: payloadJson,
    client_ts: clientTsIso
  };
}

function normalizeUiEventBatch(rawEvents, defaults = {}) {
  const list = Array.isArray(rawEvents) ? rawEvents : [];
  const accepted = [];
  let rejected = 0;
  for (const item of list) {
    const normalized = normalizeUiEvent(item, defaults);
    if (!normalized) {
      rejected += 1;
      continue;
    }
    accepted.push(normalized);
  }
  return {
    accepted,
    rejected
  };
}

function buildUiEventIngestId(uid, sessionRef, eventCount = 0) {
  const seed = `${Number(uid || 0)}:${String(sessionRef || "")}:${Number(eventCount || 0)}:${Date.now()}:${Math.random()}`;
  return crypto.createHash("sha1").update(seed).digest("hex").slice(0, 28);
}

function buildUiEventIdempotencyKey(uid, sessionRef, events, explicitKey = "") {
  const provided = toSafeText(explicitKey, 160, "");
  if (provided) {
    return provided;
  }
  const normalizedEvents = Array.isArray(events) ? events : [];
  const seed = JSON.stringify({
    uid: Number(uid || 0),
    session_ref: String(sessionRef || ""),
    count: normalizedEvents.length,
    first: normalizedEvents[0]?.event_key || "",
    last: normalizedEvents[normalizedEvents.length - 1]?.event_key || "",
    first_ts: normalizedEvents[0]?.client_ts || "",
    last_ts: normalizedEvents[normalizedEvents.length - 1]?.client_ts || ""
  });
  return crypto.createHash("sha1").update(seed).digest("hex");
}

module.exports = {
  DEFAULT_EXPERIMENT_KEY,
  DEFAULT_VARIANT_CONTROL,
  DEFAULT_VARIANT_TREATMENT,
  buildExperimentAssignment,
  resolveExperimentAssignment,
  computeCohortBucket,
  normalizeUiEvent,
  normalizeUiEventBatch,
  buildUiEventIngestId,
  buildUiEventIdempotencyKey
};
