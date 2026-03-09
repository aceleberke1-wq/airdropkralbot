"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  buildStartAppPayload,
  encodeStartAppPayload
} = require("../../../../packages/shared/src/navigationContract");
const { resolveAlertLaunchEventKey } = require("../../../../packages/shared/src/launchEventContract");
const {
  LIVE_OPS_CAMPAIGN_CONFIG_KEY,
  LIVE_OPS_CAMPAIGN_EVENT_TYPE,
  LIVE_OPS_SEGMENT_KEY,
  LIVE_OPS_APPROVAL_STATE,
  buildDefaultLiveOpsCampaignConfig
} = require("../../../../packages/shared/src/liveOpsCampaignContract");
const {
  resolveLiveOpsPressureEscalation,
  resolveLiveOpsPressureFocus,
  resolveLiveOpsRecipientCapRecommendation,
  resolveLiveOpsTargetingGuidance,
  resolveLiveOpsSceneGate
} = require("../../../../packages/shared/src/liveOpsSceneGate.cjs");
const {
  resolveLiveOpsDispatchArtifactPaths,
  resolveLiveOpsOpsAlertArtifactPaths
} = require("../../../../packages/shared/src/runtimeArtifactPaths");
const { normalizeTrustMessageLanguage, escapeMarkdown } = require("../../../../packages/shared/src/chatTrustMessages");
const { DEFAULT_EXPERIMENT_KEY } = require("./webapp/reactV1Service");
const {
  toRate,
  normalizeBreakdownRows,
  normalizeSceneDailyRows,
  resolveSceneRuntimeHealthBand,
  resolveSceneTrendDirection,
  resolveSceneAlarmState,
  buildSceneBandBreakdown,
  buildSceneAlarmReasons
} = require("./webapp/metricsEnrichmentService");
const { resolveLaunchSurface } = require("../../../bot/src/ui/launchSurfaceCatalog");
const { buildNavigationFromCommand } = require("../../../bot/src/utils/miniAppLaunchResolver");
const { resolvePlayerCommandNavigation } = require("../../../../packages/shared/src/playerCommandNavigation");

const SURFACE_LABELS = Object.freeze({
  tr: Object.freeze({
    play_world: "Dunyaya Don",
    rewards_vault: "Odul Kasasi",
    mission_quarter: "Gorev Mahallesi",
    wallet_panel: "Wallet",
    status_hub: "Durum",
    events_hall: "Etkinlikler",
    discover_panel: "Kesfet",
    support_panel: "Destek",
    payout_screen: "Payout",
    season_hall: "Sezon",
    leaderboard_panel: "Liderlik"
  }),
  en: Object.freeze({
    play_world: "Open World",
    rewards_vault: "Rewards Vault",
    mission_quarter: "Mission Quarter",
    wallet_panel: "Wallet",
    status_hub: "Status",
    events_hall: "Events",
    discover_panel: "Discover",
    support_panel: "Support",
    payout_screen: "Payout",
    season_hall: "Season",
    leaderboard_panel: "Leaderboard"
  })
});

function buildVersionedWebAppUrl(baseUrl, version) {
  const base = String(baseUrl || "").trim();
  const safeVersion = String(version || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 40);
  if (!base) {
    return "";
  }
  if (!safeVersion) {
    return base;
  }
  try {
    const url = new URL(base);
    url.searchParams.set("v", safeVersion);
    return url.toString();
  } catch {
    const separator = base.includes("?") ? "&" : "?";
    return `${base}${separator}v=${encodeURIComponent(safeVersion)}`;
  }
}

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Math.max(1, Number(fallback || 1));
  }
  return Math.max(1, Math.floor(parsed));
}

function localizeSurfaceLabel(surfaceKey, lang = "tr") {
  const locale = normalizeTrustMessageLanguage(lang);
  return SURFACE_LABELS[locale]?.[surfaceKey] || SURFACE_LABELS.tr[surfaceKey] || surfaceKey;
}

function normalizePrefsJson(prefsJson) {
  return prefsJson && typeof prefsJson === "object" && !Array.isArray(prefsJson) ? prefsJson : {};
}

function readBooleanToggle(source, key) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return null;
  }
  if (typeof source[key] === "boolean") {
    return source[key];
  }
  return null;
}

function isCampaignEnabledForPrefs(prefsJson) {
  const prefs = normalizePrefsJson(prefsJson);
  if (readBooleanToggle(prefs, "chat_alerts_enabled") === false) {
    return false;
  }
  if (readBooleanToggle(prefs, "notifications_enabled") === false) {
    return false;
  }
  const nestedNotifications = normalizePrefsJson(prefs.notifications);
  const nestedAlerts = normalizePrefsJson(prefs.alerts);
  if (readBooleanToggle(prefs, "marketing_alert_toggle") === false) {
    return false;
  }
  if (readBooleanToggle(nestedNotifications, "marketing_alert_toggle") === false) {
    return false;
  }
  if (readBooleanToggle(nestedAlerts, "marketing_alert_toggle") === false) {
    return false;
  }
  return true;
}

function formatCampaignMessage(campaign, lang = "tr") {
  const locale = normalizeTrustMessageLanguage(lang);
  const copy = campaign && typeof campaign === "object" ? campaign.copy || {} : {};
  const title = String(copy?.title?.[locale] || copy?.title?.tr || "").trim();
  const body = String(copy?.body?.[locale] || copy?.body?.tr || "").trim();
  const note = String(copy?.note?.[locale] || copy?.note?.tr || "").trim();
  const lines = [];
  if (title) {
    lines.push(`*${escapeMarkdown(title)}*`);
  }
  if (body) {
    lines.push(escapeMarkdown(body));
  }
  if (note) {
    lines.push(escapeMarkdown(note));
  }
  return lines.join("\n\n").trim();
}

function hasLocalizedCopy(copyValue) {
  const copy = copyValue && typeof copyValue === "object" && !Array.isArray(copyValue) ? copyValue : {};
  return ["tr", "en"].some((localeKey) => String(copy[localeKey] || "").trim().length > 0);
}

function resolveScheduleWindowState(schedule, now) {
  const scheduleState = schedule && typeof schedule === "object" && !Array.isArray(schedule) ? schedule : {};
  const startAt = scheduleState.start_at ? new Date(String(scheduleState.start_at)) : null;
  const endAt = scheduleState.end_at ? new Date(String(scheduleState.end_at)) : null;
  const startValid = !startAt || !Number.isNaN(startAt.getTime());
  const endValid = !endAt || !Number.isNaN(endAt.getTime());
  if (!startValid || !endValid) {
    return { state: "invalid", start_at: scheduleState.start_at || null, end_at: scheduleState.end_at || null };
  }
  if (!startAt && !endAt) {
    return { state: "missing", start_at: null, end_at: null };
  }
  if (startAt && endAt && startAt.getTime() >= endAt.getTime()) {
    return { state: "invalid", start_at: startAt.toISOString(), end_at: endAt.toISOString() };
  }
  const currentTs = now.getTime();
  if (startAt && currentTs < startAt.getTime()) {
    return { state: "scheduled", start_at: startAt.toISOString(), end_at: endAt ? endAt.toISOString() : null };
  }
  if (endAt && currentTs > endAt.getTime()) {
    return { state: "expired", start_at: startAt ? startAt.toISOString() : null, end_at: endAt.toISOString() };
  }
  return {
    state: "open",
    start_at: startAt ? startAt.toISOString() : null,
    end_at: endAt ? endAt.toISOString() : null
  };
}

function buildPersistedCampaign(currentCampaign, nextCampaignInput) {
  const current = buildDefaultLiveOpsCampaignConfig(currentCampaign || {});
  const next = buildDefaultLiveOpsCampaignConfig({
    ...current,
    ...(nextCampaignInput || {}),
    schedule: {
      ...(current.schedule || {}),
      ...(((nextCampaignInput || {}).schedule && typeof (nextCampaignInput || {}).schedule === "object" && !Array.isArray((nextCampaignInput || {}).schedule))
        ? (nextCampaignInput || {}).schedule
        : {})
    },
    approval: {
      ...(current.approval || {}),
      ...(((nextCampaignInput || {}).approval && typeof (nextCampaignInput || {}).approval === "object" && !Array.isArray((nextCampaignInput || {}).approval))
        ? (nextCampaignInput || {}).approval
        : {})
    }
  });
  return next;
}

async function queryInactiveReturningCandidates(client, campaign, queryStrategy = {}) {
  const targeting = campaign.targeting || {};
  const limit = Math.max(1, toPositiveInt(targeting.max_recipients, 50));
  const poolLimitMultiplier = Math.max(1, Math.min(4, toPositiveInt(queryStrategy?.pool_limit_multiplier, 4)));
  const inactiveHoursBase = Math.max(24, toPositiveInt(targeting.inactive_hours, 72));
  const inactiveHours = Math.max(inactiveHoursBase, Math.max(0, Number(queryStrategy?.inactive_hours_floor || 0) || 0));
  const maxAgeDaysBase = Math.max(3, toPositiveInt(targeting.max_age_days, 30));
  const maxAgeDaysCap = Math.max(0, Number(queryStrategy?.max_age_days_cap || 0) || 0);
  const maxAgeDays = maxAgeDaysCap > 0 ? Math.max(3, Math.min(maxAgeDaysBase, maxAgeDaysCap)) : maxAgeDaysBase;
  const localeFilter = String(targeting.locale_filter || "").trim().toLowerCase();
  const excludeLocalePrefix = String(queryStrategy?.exclude_locale_prefix || "").trim().toLowerCase();
  const result = await client.query(
    `SELECT
       u.id AS user_id,
       u.telegram_id,
       u.locale,
       u.last_seen_at,
       i.public_name,
       up.prefs_json
     FROM users u
     LEFT JOIN identities i ON i.user_id = u.id
     LEFT JOIN user_ui_prefs up ON up.user_id = u.id
     WHERE u.telegram_id IS NOT NULL
       AND COALESCE(u.status, 'active') = 'active'
       AND u.last_seen_at <= now() - make_interval(hours => $1::int)
       AND u.last_seen_at >= now() - make_interval(days => $2::int)
       AND ($3 = '' OR lower(COALESCE(u.locale, '')) LIKE CONCAT($3, '%'))
       AND ($4 = '' OR NOT (lower(COALESCE(u.locale, '')) LIKE CONCAT($4, '%')))
       AND NOT EXISTS (
         SELECT 1
         FROM behavior_events be
         WHERE be.user_id = u.id
           AND be.event_type = $5
           AND COALESCE(be.meta_json->>'campaign_key', '') = $6
           AND be.event_at >= now() - make_interval(hours => $7::int)
       )
     ORDER BY u.last_seen_at ASC
     LIMIT $8;`,
    [inactiveHours, maxAgeDays, localeFilter, excludeLocalePrefix, LIVE_OPS_CAMPAIGN_EVENT_TYPE, campaign.campaign_key, campaign.targeting.dedupe_hours, limit * poolLimitMultiplier]
  );
  return result.rows;
}

async function queryWalletUnlinkedCandidates(client, campaign, queryStrategy = {}) {
  const targeting = campaign.targeting || {};
  const limit = Math.max(1, toPositiveInt(targeting.max_recipients, 50));
  const poolLimitMultiplier = Math.max(1, Math.min(4, toPositiveInt(queryStrategy?.pool_limit_multiplier, 4)));
  const activeWithinDaysBase = Math.max(1, toPositiveInt(targeting.active_within_days, 14));
  const activeWithinDaysCap = Math.max(0, Number(queryStrategy?.active_within_days_cap || 0) || 0);
  const activeWithinDays = activeWithinDaysCap > 0 ? Math.max(1, Math.min(activeWithinDaysBase, activeWithinDaysCap)) : activeWithinDaysBase;
  const localeFilter = String(targeting.locale_filter || "").trim().toLowerCase();
  const excludeLocalePrefix = String(queryStrategy?.exclude_locale_prefix || "").trim().toLowerCase();
  const result = await client.query(
    `SELECT
       u.id AS user_id,
       u.telegram_id,
       u.locale,
       u.last_seen_at,
       i.public_name,
       up.prefs_json
     FROM users u
     LEFT JOIN identities i ON i.user_id = u.id
     LEFT JOIN user_ui_prefs up ON up.user_id = u.id
     WHERE u.telegram_id IS NOT NULL
       AND COALESCE(u.status, 'active') = 'active'
       AND u.last_seen_at >= now() - make_interval(days => $1::int)
       AND ($2 = '' OR lower(COALESCE(u.locale, '')) LIKE CONCAT($2, '%'))
       AND ($3 = '' OR NOT (lower(COALESCE(u.locale, '')) LIKE CONCAT($3, '%')))
       AND NOT EXISTS (
         SELECT 1
         FROM v5_wallet_links wl
         WHERE wl.user_id = u.id
           AND wl.unlinked_at IS NULL
       )
       AND NOT EXISTS (
         SELECT 1
         FROM behavior_events be
         WHERE be.user_id = u.id
           AND be.event_type = $4
           AND COALESCE(be.meta_json->>'campaign_key', '') = $5
           AND be.event_at >= now() - make_interval(hours => $6::int)
       )
     ORDER BY u.last_seen_at DESC
     LIMIT $7;`,
    [activeWithinDays, localeFilter, excludeLocalePrefix, LIVE_OPS_CAMPAIGN_EVENT_TYPE, campaign.campaign_key, campaign.targeting.dedupe_hours, limit * poolLimitMultiplier]
  );
  return result.rows;
}

async function queryMissionIdleCandidates(client, campaign, queryStrategy = {}) {
  const targeting = campaign.targeting || {};
  const limit = Math.max(1, toPositiveInt(targeting.max_recipients, 50));
  const poolLimitMultiplier = Math.max(1, Math.min(4, toPositiveInt(queryStrategy?.pool_limit_multiplier, 4)));
  const activeWithinDaysBase = Math.max(1, toPositiveInt(targeting.active_within_days, 14));
  const activeWithinDaysCap = Math.max(0, Number(queryStrategy?.active_within_days_cap || 0) || 0);
  const activeWithinDays = activeWithinDaysCap > 0 ? Math.max(1, Math.min(activeWithinDaysBase, activeWithinDaysCap)) : activeWithinDaysBase;
  const offerAgeDaysCap = Math.max(0, Number(queryStrategy?.offer_age_days_cap || 0) || 0);
  const localeFilter = String(targeting.locale_filter || "").trim().toLowerCase();
  const excludeLocalePrefix = String(queryStrategy?.exclude_locale_prefix || "").trim().toLowerCase();
  const result = await client.query(
    `WITH mission_windows AS (
       SELECT
         o.user_id,
         MAX(o.id) AS latest_offer_id,
         COUNT(*)::int AS active_offer_count,
         MAX(o.created_at) AS latest_offer_created_at
       FROM task_offers o
       WHERE o.offer_state = 'offered'
         AND o.expires_at > now()
       GROUP BY o.user_id
     )
     SELECT
       u.id AS user_id,
       u.telegram_id,
       u.locale,
       u.last_seen_at,
       i.public_name,
       up.prefs_json,
       mw.latest_offer_id,
       mw.active_offer_count,
       mw.latest_offer_created_at
     FROM mission_windows mw
     JOIN users u ON u.id = mw.user_id
     LEFT JOIN identities i ON i.user_id = u.id
     LEFT JOIN user_ui_prefs up ON up.user_id = u.id
     WHERE u.telegram_id IS NOT NULL
       AND COALESCE(u.status, 'active') = 'active'
       AND u.last_seen_at >= now() - make_interval(days => $1::int)
       AND ($2 = '' OR lower(COALESCE(u.locale, '')) LIKE CONCAT($2, '%'))
       AND ($3 = '' OR NOT (lower(COALESCE(u.locale, '')) LIKE CONCAT($3, '%')))
       AND ($4 = 0 OR mw.latest_offer_created_at >= now() - make_interval(days => $4::int))
       AND NOT EXISTS (
         SELECT 1
         FROM task_attempts a
         WHERE a.user_id = u.id
           AND a.result = 'pending'
       )
       AND NOT EXISTS (
         SELECT 1
         FROM behavior_events be
         WHERE be.user_id = u.id
          AND be.event_type = $5
          AND COALESCE(be.meta_json->>'campaign_key', '') = $6
          AND be.event_at >= now() - make_interval(hours => $7::int)
       )
     ORDER BY mw.latest_offer_created_at DESC
     LIMIT $8;`,
    [activeWithinDays, localeFilter, excludeLocalePrefix, offerAgeDaysCap, LIVE_OPS_CAMPAIGN_EVENT_TYPE, campaign.campaign_key, campaign.targeting.dedupe_hours, limit * poolLimitMultiplier]
  );
  return result.rows;
}

async function queryAllActiveCandidates(client, campaign, queryStrategy = {}) {
  const targeting = campaign.targeting || {};
  const limit = Math.max(1, toPositiveInt(targeting.max_recipients, 50));
  const poolLimitMultiplier = Math.max(1, Math.min(4, toPositiveInt(queryStrategy?.pool_limit_multiplier, 4)));
  const activeWithinDaysBase = Math.max(1, toPositiveInt(targeting.active_within_days, 14));
  const activeWithinDaysCap = Math.max(0, Number(queryStrategy?.active_within_days_cap || 0) || 0);
  const activeWithinDays = activeWithinDaysCap > 0 ? Math.max(1, Math.min(activeWithinDaysBase, activeWithinDaysCap)) : activeWithinDaysBase;
  const localeFilter = String(targeting.locale_filter || "").trim().toLowerCase();
  const excludeLocalePrefix = String(queryStrategy?.exclude_locale_prefix || "").trim().toLowerCase();
  const result = await client.query(
    `SELECT
       u.id AS user_id,
       u.telegram_id,
       u.locale,
       u.last_seen_at,
       i.public_name,
       up.prefs_json
     FROM users u
     LEFT JOIN identities i ON i.user_id = u.id
     LEFT JOIN user_ui_prefs up ON up.user_id = u.id
     WHERE u.telegram_id IS NOT NULL
       AND COALESCE(u.status, 'active') = 'active'
       AND u.last_seen_at >= now() - make_interval(days => $1::int)
       AND ($2 = '' OR lower(COALESCE(u.locale, '')) LIKE CONCAT($2, '%'))
       AND ($3 = '' OR NOT (lower(COALESCE(u.locale, '')) LIKE CONCAT($3, '%')))
       AND NOT EXISTS (
         SELECT 1
         FROM behavior_events be
         WHERE be.user_id = u.id
           AND be.event_type = $4
           AND COALESCE(be.meta_json->>'campaign_key', '') = $5
           AND be.event_at >= now() - make_interval(hours => $6::int)
       )
     ORDER BY u.last_seen_at DESC
     LIMIT $7;`,
    [activeWithinDays, localeFilter, excludeLocalePrefix, LIVE_OPS_CAMPAIGN_EVENT_TYPE, campaign.campaign_key, campaign.targeting.dedupe_hours, limit * poolLimitMultiplier]
  );
  return result.rows;
}

function selectCandidateLoader(campaign) {
  const segmentKey = String(campaign?.targeting?.segment_key || LIVE_OPS_SEGMENT_KEY.INACTIVE_RETURNING).trim().toLowerCase();
  if (segmentKey === LIVE_OPS_SEGMENT_KEY.WALLET_UNLINKED) {
    return queryWalletUnlinkedCandidates;
  }
  if (segmentKey === LIVE_OPS_SEGMENT_KEY.MISSION_IDLE) {
    return queryMissionIdleCandidates;
  }
  if (segmentKey === LIVE_OPS_SEGMENT_KEY.ALL_ACTIVE) {
    return queryAllActiveCandidates;
  }
  return queryInactiveReturningCandidates;
}

function normalizeLiveOpsCandidateBucket(value, fallback = "unknown") {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized || fallback;
}

async function loadCandidateExperimentAssignments(client, candidates, experimentKey) {
  const userIds = (Array.isArray(candidates) ? candidates : [])
    .map((candidate) => Number(candidate?.user_id || 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!userIds.length) {
    return new Map();
  }
  try {
    const result = await client.query(
      `SELECT uid, variant_key, cohort_bucket
       FROM v5_webapp_experiment_assignments
       WHERE experiment_key = $1
         AND uid = ANY($2::bigint[]);`,
      [String(experimentKey || DEFAULT_EXPERIMENT_KEY), userIds]
    );
    return (Array.isArray(result.rows) ? result.rows : []).reduce((map, row) => {
      const userId = Number(row.uid || 0);
      if (!Number.isFinite(userId) || userId <= 0) {
        return map;
      }
      map.set(userId, {
        variant_bucket: normalizeLiveOpsCandidateBucket(row.variant_key || "control", "control"),
        cohort_bucket: normalizeLiveOpsCandidateBucket(row.cohort_bucket || "unknown", "unknown")
      });
      return map;
    }, new Map());
  } catch (err) {
    if (err?.code === "42P01" || err?.code === "42703") {
      return new Map();
    }
    throw err;
  }
}

function buildLiveOpsCandidateSelectionProfile(targetingGuidance, pressureFocus, pressureEscalation) {
  const guidance = targetingGuidance && typeof targetingGuidance === "object" && !Array.isArray(targetingGuidance)
    ? targetingGuidance
    : {};
  const focus = pressureFocus && typeof pressureFocus === "object" && !Array.isArray(pressureFocus)
    ? pressureFocus
    : {};
  const escalation = pressureEscalation && typeof pressureEscalation === "object" && !Array.isArray(pressureEscalation)
    ? pressureEscalation
    : {};
  const guidanceMode = String(guidance.default_mode || "balanced").trim().toLowerCase() || "balanced";
  const modeScale = guidanceMode === "protective" ? 1 : guidanceMode === "balanced" ? 0.55 : 0.2;
  const topLocale = Array.isArray(focus.locale_cap_split) ? focus.locale_cap_split[0] || null : null;
  const topVariant = Array.isArray(focus.variant_cap_split) ? focus.variant_cap_split[0] || null : null;
  const topCohort = Array.isArray(focus.cohort_cap_split) ? focus.cohort_cap_split[0] || null : null;
  return {
    guidance_mode: guidanceMode,
    guidance_state: String(guidance.guidance_state || "clear").trim().toLowerCase() || "clear",
    guidance_reason: String(guidance.guidance_reason || "").trim(),
    focus_dimension: String(escalation.focus_dimension || guidance.focus_dimension || "").trim().toLowerCase(),
    focus_bucket: normalizeLiveOpsCandidateBucket(escalation.focus_bucket || guidance.focus_bucket || "", ""),
    focus_matches_target: escalation.focus_matches_target === true || guidance.focus_matches_target === true,
    top_locale_bucket: normalizeLiveOpsCandidateBucket(topLocale?.bucket_key || "", ""),
    top_variant_bucket: normalizeLiveOpsCandidateBucket(topVariant?.bucket_key || "", ""),
    top_cohort_bucket: normalizeLiveOpsCandidateBucket(topCohort?.bucket_key || "", ""),
    mode_scale: modeScale
  };
}

function buildLiveOpsCandidatePrefilterSummary(summary = {}) {
  return {
    applied: summary.applied === true,
    dimension: String(summary.dimension || "").trim().toLowerCase(),
    bucket: String(summary.bucket || "").trim().toLowerCase(),
    reason: String(summary.reason || "").trim(),
    candidates_before: Math.max(0, Number(summary.candidates_before || 0) || 0),
    candidates_after: Math.max(0, Number(summary.candidates_after || 0) || 0)
  };
}

function resolveLiveOpsQueryStrategyFamily(reason) {
  const safeReason = String(reason || "").trim().toLowerCase();
  if (!safeReason) {
    return "";
  }
  if (safeReason === "query_strategy_locale_and_segment") {
    return "locale_and_segment";
  }
  if (safeReason.startsWith("query_strategy_locale_")) {
    return "locale";
  }
  if (safeReason.startsWith("query_strategy_prefilter_")) {
    return "prefilter_only";
  }
  if (safeReason.startsWith("segment_query_")) {
    return "segment_only";
  }
  if (safeReason === "query_strategy_not_applied") {
    return "not_applied";
  }
  return "other";
}

function resolveLiveOpsLocaleStrategyFamily(reason) {
  const safeReason = String(reason || "").trim().toLowerCase();
  if (!safeReason) {
    return "";
  }
  if (safeReason === "query_strategy_locale_exclusion") {
    return "locale_exclusion";
  }
  if (safeReason === "query_strategy_locale_conflict") {
    return "locale_conflict";
  }
  if (safeReason === "query_strategy_prefilter_only") {
    return "prefilter_only";
  }
  if (safeReason === "prefilter_ready") {
    return "prefilter_ready";
  }
  if (safeReason === "query_strategy_not_applied") {
    return "not_applied";
  }
  return "other";
}

function resolveLiveOpsSegmentStrategyFamily(reason) {
  const safeReason = String(reason || "").trim().toLowerCase();
  if (!safeReason) {
    return "";
  }
  if (safeReason.includes("inactive_window")) {
    return "inactive_window";
  }
  if (safeReason.includes("active_window")) {
    return "active_window";
  }
  if (safeReason.includes("offer_window")) {
    return "offer_window";
  }
  if (safeReason === "segment_query_not_needed") {
    return "not_needed";
  }
  if (safeReason === "segment_query_segment_unsupported") {
    return "unsupported";
  }
  return "other";
}

function buildLiveOpsCandidateQueryStrategySummary(summary = {}) {
  const reason = String(summary.reason || "").trim();
  const localeStrategyReason = String(summary.locale_strategy_reason || "").trim();
  const segmentStrategyReason = String(summary.segment_strategy_reason || "").trim();
  const adjustmentRows = Array.isArray(summary.adjustment_rows)
    ? summary.adjustment_rows
        .filter((row) => row && typeof row === "object" && !Array.isArray(row))
        .map((row) => {
          const beforeValue = Math.max(0, Math.floor(Number(row.before_value || 0) || 0));
          const afterValue = Math.max(0, Math.floor(Number(row.after_value || 0) || 0));
          const deltaValue = Math.floor(Number(row.delta_value ?? afterValue - beforeValue) || 0);
          const directionKey = String(row.direction_key || (deltaValue === 0 ? "same" : deltaValue > 0 ? "increase" : "decrease"))
            .trim()
            .toLowerCase();
          return {
            field_key: String(row.field_key || "").trim().toLowerCase(),
            before_value: beforeValue,
            after_value: afterValue,
            delta_value: deltaValue,
            direction_key: ["same", "increase", "decrease"].includes(directionKey) ? directionKey : "same",
            reason_code: String(row.reason_code || "").trim()
          };
        })
        .filter((row) => row.field_key)
    : [];
  return {
    applied: summary.applied === true,
    reason,
    strategy_family: resolveLiveOpsQueryStrategyFamily(reason),
    mode_key: String(summary.mode_key || "balanced").trim().toLowerCase() || "balanced",
    segment_key: String(summary.segment_key || "").trim().toLowerCase(),
    focus_matches_target: summary.focus_matches_target === true,
    dimension: String(summary.dimension || "").trim().toLowerCase(),
    bucket: String(summary.bucket || "").trim().toLowerCase(),
    exclude_locale_prefix: String(summary.exclude_locale_prefix || "").trim().toLowerCase(),
    locale_strategy_reason: localeStrategyReason,
    locale_strategy_family: resolveLiveOpsLocaleStrategyFamily(localeStrategyReason),
    segment_strategy_reason: segmentStrategyReason,
    segment_strategy_family: resolveLiveOpsSegmentStrategyFamily(segmentStrategyReason),
    family_risk_state: ["clear", "watch", "alert"].includes(String(summary.family_risk_state || "").trim().toLowerCase())
      ? String(summary.family_risk_state || "").trim().toLowerCase()
      : "clear",
    family_risk_reason: String(summary.family_risk_reason || "").trim(),
    family_risk_dimension: String(summary.family_risk_dimension || "").trim().toLowerCase(),
    family_risk_bucket: String(summary.family_risk_bucket || "").trim().toLowerCase(),
    family_risk_match_days: Math.max(0, Math.floor(Number(summary.family_risk_match_days || 0) || 0)),
    family_risk_weight: Math.max(0, Math.floor(Number(summary.family_risk_weight || 0) || 0)),
    family_risk_tightened: summary.family_risk_tightened === true,
    pool_limit_multiplier: Math.max(1, Math.min(4, toPositiveInt(summary.pool_limit_multiplier, 4))),
    active_within_days_cap: Math.max(0, Math.floor(Number(summary.active_within_days_cap || 0) || 0)),
    inactive_hours_floor: Math.max(0, Math.floor(Number(summary.inactive_hours_floor || 0) || 0)),
    max_age_days_cap: Math.max(0, Math.floor(Number(summary.max_age_days_cap || 0) || 0)),
    offer_age_days_cap: Math.max(0, Math.floor(Number(summary.offer_age_days_cap || 0) || 0)),
    adjustment_rows: adjustmentRows
  };
}

function buildLiveOpsQueryStrategyAdjustmentRows(beforeStrategy, nextValues, reasonCode) {
  const safeBefore = beforeStrategy && typeof beforeStrategy === "object" && !Array.isArray(beforeStrategy)
    ? beforeStrategy
    : {};
  const safeNext = nextValues && typeof nextValues === "object" && !Array.isArray(nextValues)
    ? nextValues
    : {};
  return [
    "pool_limit_multiplier",
    "active_within_days_cap",
    "inactive_hours_floor",
    "max_age_days_cap",
    "offer_age_days_cap"
  ].reduce((rows, fieldKey) => {
    const beforeValue = Math.max(0, Math.floor(Number(safeBefore[fieldKey] || 0) || 0));
    const afterValue = Math.max(0, Math.floor(Number(safeNext[fieldKey] ?? beforeValue) || 0));
    if (beforeValue === afterValue) {
      return rows;
    }
    const deltaValue = afterValue - beforeValue;
    rows.push({
      field_key: fieldKey,
      before_value: beforeValue,
      after_value: afterValue,
      delta_value: deltaValue,
      direction_key: deltaValue > 0 ? "increase" : "decrease",
      reason_code: String(reasonCode || "").trim()
    });
    return rows;
  }, []);
}

function resolveSelectionFamilyRiskDailyWeight(matchDays) {
  const safeMatchDays = Math.max(0, Number(matchDays || 0));
  if (safeMatchDays >= 4) {
    return 2;
  }
  if (safeMatchDays >= 2) {
    return 1;
  }
  return 0;
}

function resolveSelectionQueryFamilyRiskWeight(familyKey) {
  switch (String(familyKey || "").trim().toLowerCase()) {
    case "locale_and_segment":
      return 3;
    case "locale":
      return 2;
    case "segment_only":
      return 1;
    default:
      return 0;
  }
}

function resolveSelectionSegmentFamilyRiskWeight(familyKey) {
  switch (String(familyKey || "").trim().toLowerCase()) {
    case "active_window":
    case "inactive_window":
      return 2;
    case "offer_window":
      return 1;
    default:
      return 0;
  }
}

function countSelectionFamilyMatchDays(rows, familyKey) {
  const safeFamilyKey = String(familyKey || "").trim().toLowerCase();
  if (!safeFamilyKey) {
    return 0;
  }
  return (Array.isArray(rows) ? rows : []).reduce((count, row) => {
    const bucketKey = String(row?.bucket_key || "").trim().toLowerCase();
    return bucketKey === safeFamilyKey ? count + 1 : count;
  }, 0);
}

function resolveLiveOpsSelectionFamilyQueryRisk(selectionTrendSummary) {
  const safeTrend = selectionTrendSummary && typeof selectionTrendSummary === "object" && !Array.isArray(selectionTrendSummary)
    ? selectionTrendSummary
    : {};
  const queryFamily = String(safeTrend.latest_query_strategy_family || "").trim().toLowerCase();
  const segmentFamily = String(safeTrend.latest_segment_strategy_family || "").trim().toLowerCase();
  const queryMatchDays = countSelectionFamilyMatchDays(safeTrend.query_strategy_family_daily_breakdown, queryFamily);
  const segmentMatchDays = countSelectionFamilyMatchDays(safeTrend.segment_strategy_family_daily_breakdown, segmentFamily);
  const queryWeight = resolveSelectionQueryFamilyRiskWeight(queryFamily) + resolveSelectionFamilyRiskDailyWeight(queryMatchDays);
  const segmentWeight = resolveSelectionSegmentFamilyRiskWeight(segmentFamily) + resolveSelectionFamilyRiskDailyWeight(segmentMatchDays);
  const dominantDimension = queryWeight >= segmentWeight ? "query_family" : "segment_family";
  const dominantBucket = dominantDimension === "query_family" ? queryFamily : segmentFamily;
  const dominantMatchDays = dominantDimension === "query_family" ? queryMatchDays : segmentMatchDays;
  const dominantWeight = dominantDimension === "query_family" ? queryWeight : segmentWeight;
  let state = "clear";
  let reason = "";
  if (dominantWeight >= 5) {
    state = "alert";
    reason = dominantDimension === "query_family"
      ? "query_strategy_family_streak_alert"
      : "segment_strategy_family_streak_alert";
  } else if (dominantWeight >= 3) {
    state = "watch";
    reason = dominantDimension === "query_family"
      ? "query_strategy_family_streak_watch"
      : "segment_strategy_family_streak_watch";
  }
  return {
    state,
    reason,
    dimension: dominantWeight > 0 ? dominantDimension : "",
    bucket: dominantWeight > 0 ? dominantBucket : "",
    match_days: dominantWeight > 0 ? dominantMatchDays : 0,
    weight: dominantWeight,
    query_match_days: queryMatchDays,
    segment_match_days: segmentMatchDays,
    query_weight: queryWeight,
    segment_weight: segmentWeight
  };
}

function applySelectionFamilyRiskToQueryStrategy(strategySummary, campaign) {
  const strategy = buildLiveOpsCandidateQueryStrategySummary(strategySummary);
  const targeting = campaign && typeof campaign === "object" && !Array.isArray(campaign) &&
    campaign.targeting && typeof campaign.targeting === "object" && !Array.isArray(campaign.targeting)
    ? campaign.targeting
    : {};
  const segmentKey = String(targeting.segment_key || LIVE_OPS_SEGMENT_KEY.INACTIVE_RETURNING).trim().toLowerCase();
  if (strategy.applied !== true || strategy.family_risk_state === "clear") {
    return strategy;
  }

  let poolLimitMultiplier = strategy.pool_limit_multiplier;
  let activeWithinDaysCap = strategy.active_within_days_cap;
  let inactiveHoursFloor = strategy.inactive_hours_floor;
  let maxAgeDaysCap = strategy.max_age_days_cap;
  let offerAgeDaysCap = strategy.offer_age_days_cap;
  let tightened = false;

  if (strategy.family_risk_dimension === "query_family") {
    if (["locale_and_segment", "locale"].includes(strategy.family_risk_bucket)) {
      poolLimitMultiplier = 1;
      tightened = true;
      if (activeWithinDaysCap > 0) {
        activeWithinDaysCap = Math.max(3, activeWithinDaysCap - (strategy.family_risk_state === "alert" ? 3 : 1));
      }
      if (offerAgeDaysCap > 0) {
        offerAgeDaysCap = Math.max(1, offerAgeDaysCap - 1);
      }
      if (inactiveHoursFloor > 0) {
        inactiveHoursFloor += strategy.family_risk_state === "alert" ? 24 : 12;
      }
      if (maxAgeDaysCap > 0) {
        maxAgeDaysCap = Math.max(7, maxAgeDaysCap - (strategy.family_risk_state === "alert" ? 7 : 3));
      }
    }
  } else if (strategy.family_risk_dimension === "segment_family") {
    if (strategy.family_risk_bucket === "active_window") {
      poolLimitMultiplier = 1;
      tightened = true;
      if (activeWithinDaysCap > 0) {
        activeWithinDaysCap = Math.max(3, activeWithinDaysCap - (strategy.family_risk_state === "alert" ? 2 : 1));
      }
    } else if (strategy.family_risk_bucket === "inactive_window") {
      poolLimitMultiplier = 1;
      tightened = true;
      inactiveHoursFloor = Math.max(inactiveHoursFloor, strategy.family_risk_state === "alert" ? 120 : 96);
      if (maxAgeDaysCap > 0) {
        maxAgeDaysCap = Math.max(7, maxAgeDaysCap - (strategy.family_risk_state === "alert" ? 7 : 3));
      }
    } else if (strategy.family_risk_bucket === "offer_window") {
      poolLimitMultiplier = 1;
      tightened = true;
      if (offerAgeDaysCap > 0) {
        offerAgeDaysCap = Math.max(1, offerAgeDaysCap - 1);
      }
      if (activeWithinDaysCap > 0) {
        activeWithinDaysCap = Math.max(3, activeWithinDaysCap - 1);
      }
    }
  }

  if (segmentKey === LIVE_OPS_SEGMENT_KEY.ALL_ACTIVE && activeWithinDaysCap > 0) {
    activeWithinDaysCap = Math.max(2, activeWithinDaysCap);
  }

  const adjustmentRows = tightened
    ? buildLiveOpsQueryStrategyAdjustmentRows(
        strategy,
        {
          pool_limit_multiplier: poolLimitMultiplier,
          active_within_days_cap: activeWithinDaysCap,
          inactive_hours_floor: inactiveHoursFloor,
          max_age_days_cap: maxAgeDaysCap,
          offer_age_days_cap: offerAgeDaysCap
        },
        strategy.family_risk_reason || "family_risk_tightened"
      )
    : [];

  return buildLiveOpsCandidateQueryStrategySummary({
    ...strategy,
    family_risk_tightened: tightened,
    pool_limit_multiplier: poolLimitMultiplier,
    active_within_days_cap: activeWithinDaysCap,
    inactive_hours_floor: inactiveHoursFloor,
    max_age_days_cap: maxAgeDaysCap,
    offer_age_days_cap: offerAgeDaysCap,
    adjustment_rows: adjustmentRows
  });
}

function buildLiveOpsCandidateSqlPrefilter(selectionProfile) {
  const profile = selectionProfile && typeof selectionProfile === "object" && !Array.isArray(selectionProfile)
    ? selectionProfile
    : {};
  const guidanceMode = String(profile.guidance_mode || "balanced").trim().toLowerCase();
  const guidanceState = String(profile.guidance_state || "clear").trim().toLowerCase();
  const focusDimension = String(profile.focus_dimension || "").trim().toLowerCase();
  const focusBucket = normalizeLiveOpsCandidateBucket(profile.focus_bucket || "", "");
  if (guidanceState === "clear" || guidanceMode !== "protective") {
    return buildLiveOpsCandidatePrefilterSummary({
      applied: false,
      dimension: focusDimension,
      bucket: focusBucket,
      reason: "prefilter_not_needed"
    });
  }
  if (!focusDimension || !focusBucket) {
    return buildLiveOpsCandidatePrefilterSummary({
      applied: false,
      dimension: focusDimension,
      bucket: focusBucket,
      reason: "prefilter_focus_missing"
    });
  }
  if (profile.focus_matches_target === true) {
    return buildLiveOpsCandidatePrefilterSummary({
      applied: false,
      dimension: focusDimension,
      bucket: focusBucket,
      reason: "prefilter_focus_matches_target"
    });
  }
  if (!["locale", "variant", "cohort"].includes(focusDimension)) {
    return buildLiveOpsCandidatePrefilterSummary({
      applied: false,
      dimension: focusDimension,
      bucket: focusBucket,
      reason: "prefilter_dimension_unsupported"
    });
  }
  return buildLiveOpsCandidatePrefilterSummary({
    applied: false,
    dimension: focusDimension,
    bucket: focusBucket,
    reason: "prefilter_ready"
  });
}

function buildLiveOpsSegmentQueryStrategy(campaign, selectionProfile) {
  const safeCampaign = campaign && typeof campaign === "object" && !Array.isArray(campaign) ? campaign : {};
  const targeting = safeCampaign.targeting && typeof safeCampaign.targeting === "object" && !Array.isArray(safeCampaign.targeting)
    ? safeCampaign.targeting
    : {};
  const profile = selectionProfile && typeof selectionProfile === "object" && !Array.isArray(selectionProfile)
    ? selectionProfile
    : {};
  const segmentKey = String(targeting.segment_key || LIVE_OPS_SEGMENT_KEY.INACTIVE_RETURNING).trim().toLowerCase();
  const guidanceMode = String(profile.guidance_mode || "balanced").trim().toLowerCase();
  const guidanceState = String(profile.guidance_state || "clear").trim().toLowerCase();
  const focusMatchesTarget = profile.focus_matches_target === true;
  if (guidanceMode !== "protective" || guidanceState === "clear") {
    return buildLiveOpsCandidateQueryStrategySummary({
      applied: false,
      mode_key: guidanceMode,
      segment_key: segmentKey,
      focus_matches_target: focusMatchesTarget,
      reason: "segment_query_not_needed"
    });
  }

  const tightWindow = guidanceState === "alert" || focusMatchesTarget;
  const poolLimitMultiplier = tightWindow ? 2 : 3;

  if (segmentKey === LIVE_OPS_SEGMENT_KEY.INACTIVE_RETURNING) {
    return buildLiveOpsCandidateQueryStrategySummary({
      applied: true,
      mode_key: guidanceMode,
      segment_key: segmentKey,
      focus_matches_target: focusMatchesTarget,
      reason: tightWindow ? "segment_query_inactive_window_tight" : "segment_query_inactive_window_watch",
      pool_limit_multiplier: poolLimitMultiplier,
      inactive_hours_floor: tightWindow ? 120 : 96,
      max_age_days_cap: tightWindow ? 21 : 28
    });
  }
  if (segmentKey === LIVE_OPS_SEGMENT_KEY.WALLET_UNLINKED) {
    return buildLiveOpsCandidateQueryStrategySummary({
      applied: true,
      mode_key: guidanceMode,
      segment_key: segmentKey,
      focus_matches_target: focusMatchesTarget,
      reason: tightWindow ? "segment_query_active_window_tight" : "segment_query_active_window_watch",
      pool_limit_multiplier: poolLimitMultiplier,
      active_within_days_cap: tightWindow ? 7 : 10
    });
  }
  if (segmentKey === LIVE_OPS_SEGMENT_KEY.MISSION_IDLE) {
    return buildLiveOpsCandidateQueryStrategySummary({
      applied: true,
      mode_key: guidanceMode,
      segment_key: segmentKey,
      focus_matches_target: focusMatchesTarget,
      reason: tightWindow ? "segment_query_offer_window_tight" : "segment_query_offer_window_watch",
      pool_limit_multiplier: poolLimitMultiplier,
      active_within_days_cap: tightWindow ? 7 : 10,
      offer_age_days_cap: tightWindow ? 3 : 5
    });
  }
  if (segmentKey === LIVE_OPS_SEGMENT_KEY.ALL_ACTIVE) {
    return buildLiveOpsCandidateQueryStrategySummary({
      applied: true,
      mode_key: guidanceMode,
      segment_key: segmentKey,
      focus_matches_target: focusMatchesTarget,
      reason: tightWindow ? "segment_query_active_window_tight" : "segment_query_active_window_watch",
      pool_limit_multiplier: poolLimitMultiplier,
      active_within_days_cap: tightWindow ? 5 : 7
    });
  }

  return buildLiveOpsCandidateQueryStrategySummary({
    applied: false,
    mode_key: guidanceMode,
    segment_key: segmentKey,
    focus_matches_target: focusMatchesTarget,
    reason: "segment_query_segment_unsupported"
  });
}

function buildLiveOpsCandidateQueryStrategy(campaign, selectionProfile, selectionTrendSummary) {
  const prefilter = buildLiveOpsCandidateSqlPrefilter(selectionProfile);
  const localeFilter = normalizeLiveOpsCandidateBucket(campaign?.targeting?.locale_filter || "", "");
  const segmentStrategy = buildLiveOpsSegmentQueryStrategy(campaign, selectionProfile);
  const familyRisk = resolveLiveOpsSelectionFamilyQueryRisk(selectionTrendSummary);
  let localeStrategy = buildLiveOpsCandidateQueryStrategySummary({
    applied: false,
    mode_key: selectionProfile?.guidance_mode,
    segment_key: campaign?.targeting?.segment_key,
    focus_matches_target: selectionProfile?.focus_matches_target === true,
    dimension: prefilter.dimension,
    bucket: prefilter.bucket,
    reason: prefilter.reason
  });
  if (prefilter.reason === "prefilter_ready") {
    if (prefilter.dimension !== "locale") {
      localeStrategy = buildLiveOpsCandidateQueryStrategySummary({
        applied: false,
        mode_key: selectionProfile?.guidance_mode,
        segment_key: campaign?.targeting?.segment_key,
        focus_matches_target: selectionProfile?.focus_matches_target === true,
        dimension: prefilter.dimension,
        bucket: prefilter.bucket,
        reason: "query_strategy_prefilter_only"
      });
    } else if (localeFilter && localeFilter === prefilter.bucket) {
      localeStrategy = buildLiveOpsCandidateQueryStrategySummary({
        applied: false,
        mode_key: selectionProfile?.guidance_mode,
        segment_key: campaign?.targeting?.segment_key,
        focus_matches_target: selectionProfile?.focus_matches_target === true,
        dimension: prefilter.dimension,
        bucket: prefilter.bucket,
        reason: "query_strategy_locale_conflict"
      });
    } else {
      localeStrategy = buildLiveOpsCandidateQueryStrategySummary({
        applied: true,
        mode_key: selectionProfile?.guidance_mode,
        segment_key: campaign?.targeting?.segment_key,
        focus_matches_target: selectionProfile?.focus_matches_target === true,
        dimension: "locale",
        bucket: prefilter.bucket,
        reason: "query_strategy_locale_exclusion",
        exclude_locale_prefix: prefilter.bucket
      });
    }
  }

  const applied = localeStrategy.applied === true || segmentStrategy.applied === true;
  let reason = localeStrategy.reason || segmentStrategy.reason || "query_strategy_not_applied";
  if (localeStrategy.applied === true && segmentStrategy.applied === true) {
    reason = "query_strategy_locale_and_segment";
  } else if (segmentStrategy.applied === true) {
    reason = segmentStrategy.reason;
  }

  return applySelectionFamilyRiskToQueryStrategy({
    applied,
    reason,
    mode_key: selectionProfile?.guidance_mode,
    segment_key: campaign?.targeting?.segment_key,
    focus_matches_target: selectionProfile?.focus_matches_target === true,
    dimension: localeStrategy.dimension,
    bucket: localeStrategy.bucket,
    exclude_locale_prefix: localeStrategy.exclude_locale_prefix,
    locale_strategy_reason: localeStrategy.reason,
    segment_strategy_reason: segmentStrategy.reason,
    family_risk_state: familyRisk.state,
    family_risk_reason: familyRisk.reason,
    family_risk_dimension: familyRisk.dimension,
    family_risk_bucket: familyRisk.bucket,
    family_risk_match_days: familyRisk.match_days,
    family_risk_weight: familyRisk.weight,
    pool_limit_multiplier: segmentStrategy.pool_limit_multiplier || 4,
    active_within_days_cap: segmentStrategy.active_within_days_cap,
    inactive_hours_floor: segmentStrategy.inactive_hours_floor,
    max_age_days_cap: segmentStrategy.max_age_days_cap,
    offer_age_days_cap: segmentStrategy.offer_age_days_cap
  }, campaign);
}

async function applyLiveOpsCandidateSqlPrefilter(client, candidates, experimentKey, selectionProfile) {
  const safeCandidates = Array.isArray(candidates) ? candidates : [];
  const prefilter = buildLiveOpsCandidateSqlPrefilter(selectionProfile);
  if (!safeCandidates.length) {
    return {
      candidates: safeCandidates,
      prefilter_summary: buildLiveOpsCandidatePrefilterSummary({
        ...prefilter,
        reason: prefilter.reason || "prefilter_empty_input",
        candidates_before: 0,
        candidates_after: 0
      })
    };
  }
  if (prefilter.reason !== "prefilter_ready") {
    return {
      candidates: safeCandidates,
      prefilter_summary: buildLiveOpsCandidatePrefilterSummary({
        ...prefilter,
        candidates_before: safeCandidates.length,
        candidates_after: safeCandidates.length
      })
    };
  }

  const userIds = safeCandidates
    .map((candidate) => Number(candidate?.user_id || 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!userIds.length) {
    return {
      candidates: safeCandidates,
      prefilter_summary: buildLiveOpsCandidatePrefilterSummary({
        ...prefilter,
        reason: "prefilter_empty_user_ids",
        candidates_before: safeCandidates.length,
        candidates_after: safeCandidates.length
      })
    };
  }

  const safeExperimentKey = String(experimentKey || DEFAULT_EXPERIMENT_KEY).trim() || DEFAULT_EXPERIMENT_KEY;
  const focusDimension = prefilter.dimension;
  const focusBucket = prefilter.bucket;
  const params = [userIds];
  let sql = "";
  if (focusDimension === "locale") {
    params.push(focusBucket);
    sql = `SELECT u.id AS user_id
      FROM users u
      WHERE u.id = ANY($1::bigint[])
        AND NOT (lower(COALESCE(u.locale, '')) LIKE CONCAT($2, '%'));`;
  } else if (focusDimension === "variant") {
    params.push(safeExperimentKey, focusBucket);
    sql = `SELECT u.id AS user_id
      FROM users u
      LEFT JOIN v5_webapp_experiment_assignments ea
        ON ea.uid = u.id
       AND ea.experiment_key = $2
      WHERE u.id = ANY($1::bigint[])
        AND COALESCE(lower(ea.variant_key), 'control') <> $3;`;
  } else if (focusDimension === "cohort") {
    params.push(safeExperimentKey, focusBucket);
    sql = `SELECT u.id AS user_id
      FROM users u
      LEFT JOIN v5_webapp_experiment_assignments ea
        ON ea.uid = u.id
       AND ea.experiment_key = $2
      WHERE u.id = ANY($1::bigint[])
        AND COALESCE(lower(ea.cohort_bucket::text), 'unknown') <> $3;`;
  }

  if (!sql) {
    return {
      candidates: safeCandidates,
      prefilter_summary: buildLiveOpsCandidatePrefilterSummary({
        ...prefilter,
        reason: "prefilter_sql_missing",
        candidates_before: safeCandidates.length,
        candidates_after: safeCandidates.length
      })
    };
  }

  try {
    const result = await client.query(sql, params);
    const allowedIds = new Set(
      (Array.isArray(result.rows) ? result.rows : [])
        .map((row) => Number(row.user_id || 0))
        .filter((value) => Number.isFinite(value) && value > 0)
    );
    const filteredCandidates = safeCandidates.filter((candidate) => allowedIds.has(Number(candidate?.user_id || 0)));
    if (!filteredCandidates.length) {
      return {
        candidates: safeCandidates,
        prefilter_summary: buildLiveOpsCandidatePrefilterSummary({
          ...prefilter,
          reason: "prefilter_zero_result_fallback",
          candidates_before: safeCandidates.length,
          candidates_after: safeCandidates.length
        })
      };
    }
    if (filteredCandidates.length >= safeCandidates.length) {
      return {
        candidates: safeCandidates,
        prefilter_summary: buildLiveOpsCandidatePrefilterSummary({
          ...prefilter,
          reason: "prefilter_no_reduction",
          candidates_before: safeCandidates.length,
          candidates_after: safeCandidates.length
        })
      };
    }
    return {
      candidates: filteredCandidates,
      prefilter_summary: buildLiveOpsCandidatePrefilterSummary({
        applied: true,
        dimension: focusDimension,
        bucket: focusBucket,
        reason: "prefilter_applied",
        candidates_before: safeCandidates.length,
        candidates_after: filteredCandidates.length
      })
    };
  } catch (err) {
    if ((focusDimension === "variant" || focusDimension === "cohort") && (err?.code === "42P01" || err?.code === "42703")) {
      return {
        candidates: safeCandidates,
        prefilter_summary: buildLiveOpsCandidatePrefilterSummary({
          ...prefilter,
          reason: "prefilter_assignment_unavailable",
          candidates_before: safeCandidates.length,
          candidates_after: safeCandidates.length
        })
      };
    }
    throw err;
  }
}

function scoreLiveOpsCandidateForSelection(candidate, selectionProfile) {
  const profile = selectionProfile && typeof selectionProfile === "object" && !Array.isArray(selectionProfile)
    ? selectionProfile
    : {};
  const modeScale = Math.max(0, Number(profile.mode_scale || 0));
  if (!modeScale || String(profile.guidance_state || "clear") === "clear") {
    return 0;
  }
  const localeBucket = normalizeLiveOpsCandidateBucket(candidate?.locale_bucket || candidate?.locale || "", "unknown");
  const variantBucket = normalizeLiveOpsCandidateBucket(candidate?.variant_bucket || "control", "control");
  const cohortBucket = normalizeLiveOpsCandidateBucket(candidate?.cohort_bucket || "unknown", "unknown");
  let penalty = 0;

  if (profile.focus_dimension === "locale" && profile.focus_bucket && localeBucket === profile.focus_bucket) {
    penalty += 100 * modeScale;
  }
  if (profile.focus_dimension === "variant" && profile.focus_bucket && variantBucket === profile.focus_bucket) {
    penalty += 80 * modeScale;
  }
  if (profile.focus_dimension === "cohort" && profile.focus_bucket && cohortBucket === profile.focus_bucket) {
    penalty += 70 * modeScale;
  }
  if (profile.focus_matches_target && profile.focus_bucket) {
    if (
      (profile.focus_dimension === "locale" && localeBucket === profile.focus_bucket) ||
      (profile.focus_dimension === "variant" && variantBucket === profile.focus_bucket) ||
      (profile.focus_dimension === "cohort" && cohortBucket === profile.focus_bucket)
    ) {
      penalty += 25 * modeScale;
    }
  }
  if (profile.top_locale_bucket && localeBucket === profile.top_locale_bucket) {
    penalty += 35 * modeScale;
  }
  if (profile.top_variant_bucket && variantBucket === profile.top_variant_bucket) {
    penalty += 24 * modeScale;
  }
  if (profile.top_cohort_bucket && cohortBucket === profile.top_cohort_bucket) {
    penalty += 18 * modeScale;
  }
  return Number(penalty.toFixed(4));
}

async function prioritizeLiveOpsCandidates(client, candidates, experimentKey, selectionProfile) {
  const safeCandidates = Array.isArray(candidates) ? candidates : [];
  const assignmentMap = await loadCandidateExperimentAssignments(client, safeCandidates, experimentKey);
  const safeSelectionProfile = selectionProfile && typeof selectionProfile === "object" && !Array.isArray(selectionProfile)
    ? selectionProfile
    : buildLiveOpsCandidateSelectionProfile({}, {}, {});
  const prioritized = safeCandidates
    .map((candidate, index) => {
      const assignment = assignmentMap.get(Number(candidate?.user_id || 0)) || {};
      const localeBucket = normalizeLiveOpsCandidateBucket(
        normalizeTrustMessageLanguage(candidate?.locale || "tr"),
        "unknown"
      );
      const variantBucket = normalizeLiveOpsCandidateBucket(assignment.variant_bucket || "control", "control");
      const cohortBucket = normalizeLiveOpsCandidateBucket(assignment.cohort_bucket || "unknown", "unknown");
      const annotatedCandidate = {
        ...candidate,
        locale_bucket: localeBucket,
        variant_bucket: variantBucket,
        cohort_bucket: cohortBucket
      };
      return {
        candidate: annotatedCandidate,
        index,
        penalty: scoreLiveOpsCandidateForSelection(annotatedCandidate, safeSelectionProfile)
      };
    })
    .sort((left, right) => {
      if (left.penalty !== right.penalty) {
        return left.penalty - right.penalty;
      }
      return left.index - right.index;
    });
  return {
    candidates: prioritized.map((entry) => entry.candidate),
    selection_profile: safeSelectionProfile
  };
}

function buildLiveOpsSelectionSummary(selectionProfile, prioritizedCandidates, selectedCandidates, prefilterSummary, queryStrategySummary) {
  const profile = selectionProfile && typeof selectionProfile === "object" && !Array.isArray(selectionProfile)
    ? selectionProfile
    : {};
  const prioritized = Array.isArray(prioritizedCandidates) ? prioritizedCandidates : [];
  const selected = Array.isArray(selectedCandidates) ? selectedCandidates : [];
  const safePrefilterSummary = buildLiveOpsCandidatePrefilterSummary(prefilterSummary);
  const safeQueryStrategySummary = buildLiveOpsCandidateQueryStrategySummary(queryStrategySummary);
  const countMatches = (rows, dimension, bucketKey) => {
    if (!bucketKey) {
      return 0;
    }
    return rows.filter((row) => normalizeLiveOpsCandidateBucket(row?.[`${dimension}_bucket`] || "", "") === bucketKey).length;
  };
  return {
    guidance_mode: String(profile.guidance_mode || "balanced").trim() || "balanced",
    guidance_state: String(profile.guidance_state || "clear").trim() || "clear",
    guidance_reason: String(profile.guidance_reason || "").trim(),
    focus_dimension: String(profile.focus_dimension || "").trim(),
    focus_bucket: String(profile.focus_bucket || "").trim(),
    focus_matches_target: profile.focus_matches_target === true,
    prioritized_candidates: prioritized.length,
    selected_candidates: selected.length,
    prioritized_focus_matches: countMatches(prioritized, String(profile.focus_dimension || ""), String(profile.focus_bucket || "")),
    selected_focus_matches: countMatches(selected, String(profile.focus_dimension || ""), String(profile.focus_bucket || "")),
    prioritized_top_locale_matches: countMatches(prioritized, "locale", String(profile.top_locale_bucket || "")),
    selected_top_locale_matches: countMatches(selected, "locale", String(profile.top_locale_bucket || "")),
    prioritized_top_variant_matches: countMatches(prioritized, "variant", String(profile.top_variant_bucket || "")),
    selected_top_variant_matches: countMatches(selected, "variant", String(profile.top_variant_bucket || "")),
    prioritized_top_cohort_matches: countMatches(prioritized, "cohort", String(profile.top_cohort_bucket || "")),
    selected_top_cohort_matches: countMatches(selected, "cohort", String(profile.top_cohort_bucket || "")),
    query_strategy_summary: safeQueryStrategySummary,
    prefilter_summary: safePrefilterSummary
  };
}

function createLiveOpsChatCampaignService(deps = {}) {
  const pool = deps.pool;
  const fetchImpl = deps.fetchImpl || global.fetch;
  const botToken = String(deps.botToken || "").trim();
  const botUsername = String(deps.botUsername || "airdropkral_2026_bot").trim();
  const webappPublicUrl = String(deps.webappPublicUrl || "").trim();
  const webappHmacSecret = String(deps.webappHmacSecret || "").trim();
  const logger = typeof deps.logger === "function" ? deps.logger : () => {};
  const resolveWebappVersion = typeof deps.resolveWebappVersion === "function" ? deps.resolveWebappVersion : async () => ({ version: "" });
  const loadCandidates = typeof deps.loadCandidates === "function" ? deps.loadCandidates : null;
  const nowFactory = typeof deps.nowFactory === "function" ? deps.nowFactory : () => new Date();
  const runtimeArtifactRepoRoot = String(deps.runtimeArtifactRepoRoot || path.resolve(__dirname, "../../../..")).trim();
  const readLatestTaskArtifactSummary =
    typeof deps.readLatestTaskArtifactSummary === "function"
      ? deps.readLatestTaskArtifactSummary
      : async () => readLatestTaskArtifactSummaryFromDisk(nowFactory(), runtimeArtifactRepoRoot);
  const readLatestOpsAlertArtifactSummary =
    typeof deps.readLatestOpsAlertArtifactSummary === "function"
      ? deps.readLatestOpsAlertArtifactSummary
      : async () => readLatestOpsAlertArtifactSummaryFromDisk(nowFactory(), runtimeArtifactRepoRoot);

  function isEnabled() {
    return Boolean(pool?.connect && fetchImpl && botToken && webappPublicUrl && webappHmacSecret);
  }

  function signWebAppPayload(uid, ts) {
    return crypto.createHmac("sha256", webappHmacSecret).update(`${uid}.${ts}`).digest("hex");
  }

  async function resolveLaunchBaseUrl() {
    const versionState = await resolveWebappVersion();
    return buildVersionedWebAppUrl(webappPublicUrl, versionState?.version || "");
  }

  function buildSignedWebAppUrl(telegramId, navigation = {}, baseUrl) {
    const launchBaseUrl = String(baseUrl || "").trim();
    if (!launchBaseUrl) {
      return "";
    }
    try {
      const url = new URL(launchBaseUrl);
      const ts = Date.now().toString();
      const uid = String(telegramId || "");
      const sig = signWebAppPayload(uid, ts);
      url.searchParams.set("uid", uid);
      url.searchParams.set("ts", ts);
      url.searchParams.set("sig", sig);
      url.searchParams.set("bot", botUsername);
      const startAppPayload = buildStartAppPayload(navigation);
      if (startAppPayload.route_key) {
        url.searchParams.set("route_key", startAppPayload.route_key);
        url.searchParams.set("startapp", encodeStartAppPayload(startAppPayload));
      }
      if (startAppPayload.panel_key) {
        url.searchParams.set("panel_key", startAppPayload.panel_key);
      }
      if (startAppPayload.focus_key) {
        url.searchParams.set("focus_key", startAppPayload.focus_key);
      }
      if (navigation.launchEventKey) {
        url.searchParams.set("launch_event_key", String(navigation.launchEventKey));
      }
      if (navigation.shellActionKey) {
        url.searchParams.set("shell_action_key", String(navigation.shellActionKey));
      }
      return url.toString();
    } catch {
      return "";
    }
  }

  async function resolveSurfaceEntries(telegramId, campaign, lang) {
    const launchBaseUrl = await resolveLaunchBaseUrl();
    if (!launchBaseUrl) {
      return [];
    }
    return (Array.isArray(campaign.surfaces) ? campaign.surfaces : [])
      .map((slot, index) => {
        const slotKey = String(slot?.slot_key || `slot_${index + 1}`).trim();
        const surfaceKey = String(slot?.surface_key || "").trim();
        const surface = resolveLaunchSurface(surfaceKey);
        if (!surface?.commandKey) {
          return null;
        }
        const navigation = buildNavigationFromCommand(surface.commandKey, resolvePlayerCommandNavigation, {
          ...(surface.overrides || {}),
          shellActionKey: surface.shellActionKey || surface.overrides?.shellActionKey || "",
          launchEventKey: resolveAlertLaunchEventKey(campaign.campaign_key, slotKey)
        });
        const url = buildSignedWebAppUrl(telegramId, navigation, launchBaseUrl);
        if (!url) {
          return null;
        }
        return {
          slot_key: slotKey,
          surface_key: surfaceKey,
          text: localizeSurfaceLabel(surfaceKey, lang),
          url
        };
      })
      .filter(Boolean);
  }

  function buildReplyMarkup(entries = []) {
    const rows = (Array.isArray(entries) ? entries : [])
      .map((entry) => {
        if (!entry?.url || !entry?.text) {
          return null;
        }
        return [{ text: String(entry.text), web_app: { url: String(entry.url) } }];
      })
      .filter(Boolean);
    if (!rows.length) {
      return undefined;
    }
    return { inline_keyboard: rows };
  }

  async function postTelegramMessage(telegramId, text, replyMarkup) {
    const res = await fetchImpl(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        chat_id: Number(telegramId || 0),
        text: String(text || ""),
        parse_mode: "Markdown",
        ...(replyMarkup ? { reply_markup: replyMarkup } : {})
      })
    });
    if (!res?.ok) {
      const bodyText = typeof res?.text === "function" ? await res.text().catch(() => "") : "";
      throw new Error(`telegram_send_failed:${res?.status || 0}:${bodyText.slice(0, 120)}`);
    }
    return true;
  }

  async function loadLatestConfig(client) {
    const result = await client.query(
      `SELECT version, config_json, created_at, created_by
       FROM config_versions
       WHERE config_key = $1
       ORDER BY version DESC, created_at DESC
       LIMIT 1;`,
      [LIVE_OPS_CAMPAIGN_CONFIG_KEY]
    );
    const row = result.rows[0];
    if (!row) {
      return {
        version: 0,
        created_at: null,
        created_by: 0,
        campaign: buildDefaultLiveOpsCampaignConfig()
      };
    }
    return {
      version: Number(row.version || 0),
      created_at: row.created_at || null,
      created_by: Number(row.created_by || 0),
      campaign: buildDefaultLiveOpsCampaignConfig(row.config_json || {})
    };
  }

async function loadLatestDispatchSummary(client, campaignKey) {
    const summaryRes = await client.query(
      `SELECT
         COUNT(*)::int AS sent_total,
         COUNT(*) FILTER (WHERE event_at >= now() - interval '72 hours')::int AS sent_72h,
         MAX(event_at) AS last_sent_at,
         MAX(COALESCE(meta_json->>'segment_key', '')) AS last_segment_key,
         MAX(COALESCE(meta_json->>'dispatch_ref', '')) AS last_dispatch_ref
       FROM behavior_events
       WHERE event_type = $1
         AND COALESCE(meta_json->>'campaign_key', '') = $2;`,
      [LIVE_OPS_CAMPAIGN_EVENT_TYPE, String(campaignKey || "")]
    );
    const row = summaryRes.rows[0] || {};
  return {
    event_type: LIVE_OPS_CAMPAIGN_EVENT_TYPE,
    sent_total: Number(row.sent_total || 0),
      sent_72h: Number(row.sent_72h || 0),
      last_sent_at: row.last_sent_at || null,
      last_segment_key: String(row.last_segment_key || ""),
    last_dispatch_ref: String(row.last_dispatch_ref || "")
  };
}

async function loadDeliverySummary(client, campaignKey) {
  const params = [LIVE_OPS_CAMPAIGN_EVENT_TYPE, String(campaignKey || "")];
  const [totalsRes, dailyRes, localeRes, segmentRes, surfaceRes] = await Promise.all([
    client.query(
      `SELECT
         COUNT(*) FILTER (WHERE event_at >= now() - interval '24 hours')::int AS sent_24h,
         COUNT(*) FILTER (WHERE event_at >= now() - interval '7 days')::int AS sent_7d,
         COUNT(DISTINCT user_id) FILTER (WHERE event_at >= now() - interval '7 days')::int AS unique_users_7d
       FROM behavior_events
       WHERE event_type = $1
         AND COALESCE(meta_json->>'campaign_key', '') = $2;`,
      params
    ),
    client.query(
      `SELECT
         to_char(date_trunc('day', event_at), 'YYYY-MM-DD') AS day,
         COUNT(*)::int AS sent_count,
         COUNT(DISTINCT user_id)::int AS unique_users
       FROM behavior_events
       WHERE event_type = $1
         AND COALESCE(meta_json->>'campaign_key', '') = $2
         AND event_at >= now() - interval '7 days'
       GROUP BY 1
       ORDER BY day DESC
       LIMIT 7;`,
      params
    ),
    client.query(
      `SELECT
         COALESCE(NULLIF(meta_json->>'locale', ''), 'unknown') AS bucket_key,
         COUNT(*)::int AS item_count
       FROM behavior_events
       WHERE event_type = $1
         AND COALESCE(meta_json->>'campaign_key', '') = $2
         AND event_at >= now() - interval '7 days'
       GROUP BY 1
       ORDER BY item_count DESC, bucket_key ASC
       LIMIT 6;`,
      params
    ),
    client.query(
      `SELECT
         COALESCE(NULLIF(meta_json->>'segment_key', ''), 'unknown') AS bucket_key,
         COUNT(*)::int AS item_count
       FROM behavior_events
       WHERE event_type = $1
         AND COALESCE(meta_json->>'campaign_key', '') = $2
         AND event_at >= now() - interval '7 days'
       GROUP BY 1
       ORDER BY item_count DESC, bucket_key ASC
       LIMIT 6;`,
      params
    ),
    client.query(
      `SELECT
         COALESCE(NULLIF(meta_json->>'primary_surface_key', ''), 'unknown') AS bucket_key,
         COUNT(*)::int AS item_count
       FROM behavior_events
       WHERE event_type = $1
         AND COALESCE(meta_json->>'campaign_key', '') = $2
         AND event_at >= now() - interval '7 days'
       GROUP BY 1
       ORDER BY item_count DESC, bucket_key ASC
       LIMIT 6;`,
      params
    )
  ]);

  const totals = totalsRes.rows[0] || {};
  const normalizeBuckets = (rows = []) =>
    rows.map((row) => ({
      bucket_key: String(row.bucket_key || "unknown"),
      item_count: Number(row.item_count || 0)
    }));
  const normalizeDailyBreakdown = (rows = []) =>
    rows.map((row) => ({
      day: String(row.day || ""),
      sent_count: Number(row.sent_count || 0),
      unique_users: Number(row.unique_users || 0)
    }));

  let experimentAssignmentAvailable = false;
  let variantBreakdown = [];
  let cohortBreakdown = [];

  try {
    const assignmentParams = [LIVE_OPS_CAMPAIGN_EVENT_TYPE, String(campaignKey || ""), DEFAULT_EXPERIMENT_KEY];
    const [variantRes, cohortRes] = await Promise.all([
      client.query(
        `SELECT
           COALESCE(NULLIF(lower(a.variant_key), ''), 'control') AS bucket_key,
           COUNT(*)::int AS item_count
         FROM behavior_events be
         JOIN v5_webapp_experiment_assignments a
           ON a.uid = be.user_id
          AND a.experiment_key = $3
         WHERE be.event_type = $1
           AND COALESCE(be.meta_json->>'campaign_key', '') = $2
           AND be.event_at >= now() - interval '7 days'
         GROUP BY 1
         ORDER BY item_count DESC, bucket_key ASC
         LIMIT 4;`,
        assignmentParams
      ),
      client.query(
        `SELECT
           a.cohort_bucket::text AS bucket_key,
           COUNT(*)::int AS item_count
         FROM behavior_events be
         JOIN v5_webapp_experiment_assignments a
           ON a.uid = be.user_id
          AND a.experiment_key = $3
         WHERE be.event_type = $1
           AND COALESCE(be.meta_json->>'campaign_key', '') = $2
           AND be.event_at >= now() - interval '7 days'
         GROUP BY 1
         ORDER BY item_count DESC, bucket_key ASC
         LIMIT 8;`,
        assignmentParams
      )
    ]);
    experimentAssignmentAvailable = true;
    variantBreakdown = normalizeBuckets(variantRes.rows);
    cohortBreakdown = normalizeBuckets(cohortRes.rows);
  } catch (err) {
    if (err.code !== "42P01") {
      throw err;
    }
  }

  return {
    sent_24h: Number(totals.sent_24h || 0),
    sent_7d: Number(totals.sent_7d || 0),
    unique_users_7d: Number(totals.unique_users_7d || 0),
    experiment_key: DEFAULT_EXPERIMENT_KEY,
    experiment_assignment_available: experimentAssignmentAvailable,
    daily_breakdown: normalizeDailyBreakdown(dailyRes.rows),
    locale_breakdown: normalizeBuckets(localeRes.rows),
    segment_breakdown: normalizeBuckets(segmentRes.rows),
    surface_breakdown: normalizeBuckets(surfaceRes.rows),
    variant_breakdown: variantBreakdown,
    cohort_breakdown: cohortBreakdown
  };
}

function buildApprovalSummary(campaign, meta = {}) {
  const warnings = [];
  const enabled = campaign?.enabled === true;
  const status = String(campaign?.status || "draft");
  const surfaces = Array.isArray(campaign?.surfaces) ? campaign.surfaces : [];
  const surfaceCount = surfaces.length;
  const titleReady = hasLocalizedCopy(campaign?.copy?.title);
  const bodyReady = hasLocalizedCopy(campaign?.copy?.body);
  const approval = campaign?.approval && typeof campaign.approval === "object" ? campaign.approval : {};
  const approvalRequired = approval.required !== false;
  const approvalState = String(approval.state || LIVE_OPS_APPROVAL_STATE.NOT_REQUESTED);
  const scheduleWindow = resolveScheduleWindowState(campaign?.schedule, meta.now instanceof Date ? meta.now : new Date());

  if (!enabled) {
    warnings.push("campaign_disabled");
  }
  if (status !== "ready") {
    warnings.push("campaign_not_ready");
  }
  if (!surfaceCount) {
    warnings.push("surface_missing");
  }
  if (!titleReady) {
    warnings.push("title_missing");
  }
  if (!bodyReady) {
    warnings.push("body_missing");
  }
  if (approvalRequired && approvalState !== LIVE_OPS_APPROVAL_STATE.APPROVED) {
    warnings.push(approvalState === LIVE_OPS_APPROVAL_STATE.PENDING ? "approval_pending" : "approval_missing");
  }
  if (scheduleWindow.state === "missing") {
    warnings.push("schedule_missing");
  }
  if (scheduleWindow.state === "invalid") {
    warnings.push("schedule_invalid");
  }
  if (scheduleWindow.state === "scheduled") {
    warnings.push("schedule_not_open");
  }
  if (scheduleWindow.state === "expired") {
    warnings.push("schedule_expired");
  }

  return {
    live_dispatch_ready: warnings.length === 0,
    enabled,
    status,
    segment_key: String(campaign?.targeting?.segment_key || LIVE_OPS_SEGMENT_KEY.INACTIVE_RETURNING),
    max_recipients: Number(campaign?.targeting?.max_recipients || 0),
    dedupe_hours: Number(campaign?.targeting?.dedupe_hours || 0),
    surface_count: surfaceCount,
    last_saved_at: meta.updated_at || null,
    last_dispatch_at: meta.last_dispatch_at || null,
    approval_required: approvalRequired,
    approval_state: approvalState,
    approval_requested_at: approval.requested_at || null,
    approval_requested_by: Number(approval.requested_by || 0),
    approval_approved_at: approval.approved_at || null,
    approval_approved_by: Number(approval.approved_by || 0),
    schedule_timezone: String(campaign?.schedule?.timezone || "UTC"),
    schedule_start_at: scheduleWindow.start_at,
    schedule_end_at: scheduleWindow.end_at,
    schedule_state: scheduleWindow.state,
    warnings
  };
}

function buildScheduleWindowKey(campaign) {
  const safeCampaign = buildDefaultLiveOpsCampaignConfig(campaign || {});
  const schedule = safeCampaign.schedule && typeof safeCampaign.schedule === "object" ? safeCampaign.schedule : {};
  const startAt = String(schedule.start_at || "").trim();
  const endAt = String(schedule.end_at || "").trim();
  if (!startAt && !endAt) {
    return "";
  }
  return `${safeCampaign.campaign_key}:${startAt || "open"}:${endAt || "open"}`;
}

function buildCampaignAuditPayload(campaign, meta = {}) {
  const safeCampaign = buildDefaultLiveOpsCampaignConfig(campaign || {});
  const now = meta.now instanceof Date ? meta.now : new Date();
  const scheduleWindow = resolveScheduleWindowState(safeCampaign.schedule, now);
  return {
    reason: String(meta.reason || "").trim().slice(0, 240),
    version: Number(meta.version || 0),
    campaign_version: Number(meta.version || 0),
    campaign_key: String(safeCampaign.campaign_key || ""),
    enabled: safeCampaign.enabled === true,
    status: String(safeCampaign.status || "draft"),
    segment_key: String(safeCampaign.targeting?.segment_key || LIVE_OPS_SEGMENT_KEY.INACTIVE_RETURNING),
    max_recipients: Number(safeCampaign.targeting?.max_recipients || 0),
    dedupe_hours: Number(safeCampaign.targeting?.dedupe_hours || 0),
    approval_state: String(safeCampaign.approval?.state || LIVE_OPS_APPROVAL_STATE.NOT_REQUESTED),
    schedule_state: scheduleWindow.state,
    schedule_start_at: scheduleWindow.start_at,
    schedule_end_at: scheduleWindow.end_at,
    dispatch_ref: String(meta.dispatchRef || ""),
    dispatch_source: String(meta.dispatchSource || "manual").trim().toLowerCase() === "scheduler" ? "scheduler" : "manual",
    window_key: String(meta.windowKey || buildScheduleWindowKey(safeCampaign) || ""),
    scene_gate_state: String(meta.sceneGateState || "no_data"),
    scene_gate_effect: String(meta.sceneGateEffect || "open"),
    scene_gate_reason: String(meta.sceneGateReason || ""),
    scene_gate_recipient_cap: Number(meta.sceneGateRecipientCap || 0),
    targeting_guidance_default_mode: String(meta.targetingGuidanceDefaultMode || "balanced"),
    targeting_guidance_cap: Number(meta.targetingGuidanceCap || 0),
    targeting_guidance_reason: String(meta.targetingGuidanceReason || ""),
    targeting_selection_summary:
      meta.targetingSelectionSummary && typeof meta.targetingSelectionSummary === "object" && !Array.isArray(meta.targetingSelectionSummary)
        ? meta.targetingSelectionSummary
        : null,
    dry_run: meta.dryRun === true,
    attempted: Number(meta.attempted || 0),
    sent: Number(meta.sent || 0),
    recorded: Number(meta.recorded || 0),
    skipped_disabled: Number(meta.skippedDisabled || 0),
    surface_keys: (Array.isArray(safeCampaign.surfaces) ? safeCampaign.surfaces : [])
      .map((row) => String(row?.surface_key || ""))
      .filter(Boolean)
  };
}

async function writeSchedulerSkipAudit(client, campaign, meta = {}) {
  const safeCampaign = buildDefaultLiveOpsCampaignConfig(campaign || {});
  const sceneGate = meta.sceneGate && typeof meta.sceneGate === "object"
    ? meta.sceneGate
    : resolveLiveOpsSceneGate(meta.sceneRuntimeSummary, safeCampaign);
  const now = meta.now instanceof Date ? meta.now : new Date();
  await client.query(
    `INSERT INTO admin_audit (admin_id, action, target, payload_json)
     VALUES ($1, 'live_ops_campaign_scheduler_skip', $2, $3::jsonb);`,
    [
      Number(meta.adminId || 0),
      `config:${LIVE_OPS_CAMPAIGN_CONFIG_KEY}`,
      JSON.stringify(
        buildCampaignAuditPayload(safeCampaign, {
          now,
          reason: String(meta.reason || "").trim().slice(0, 240),
          version: Number(meta.version || 0),
          dispatchRef: String(meta.dispatchRef || "").trim(),
          dispatchSource: "scheduler",
          windowKey: String(meta.windowKey || buildScheduleWindowKey(safeCampaign) || "").trim(),
          sceneGateState: sceneGate.scene_gate_state,
          sceneGateEffect: sceneGate.scene_gate_effect,
          sceneGateReason: sceneGate.scene_gate_reason,
          sceneGateRecipientCap: Number(sceneGate.scene_gate_recipient_cap || 0),
          dryRun: false
        })
      )
    ]
  );
}

async function loadVersionHistory(client) {
  const result = await client.query(
    `SELECT version, created_at, created_by, config_json
     FROM config_versions
     WHERE config_key = $1
     ORDER BY version DESC, created_at DESC
     LIMIT 8;`,
    [LIVE_OPS_CAMPAIGN_CONFIG_KEY]
  );
  return result.rows.map((row) => {
    const campaign = buildDefaultLiveOpsCampaignConfig(row.config_json || {});
    return {
      version: Number(row.version || 0),
      updated_at: row.created_at || null,
      updated_by: Number(row.created_by || 0),
      campaign_key: String(campaign.campaign_key || ""),
      enabled: campaign.enabled === true,
      status: String(campaign.status || "draft"),
      segment_key: String(campaign.targeting?.segment_key || LIVE_OPS_SEGMENT_KEY.INACTIVE_RETURNING),
      max_recipients: Number(campaign.targeting?.max_recipients || 0),
      dedupe_hours: Number(campaign.targeting?.dedupe_hours || 0)
    };
  });
}

async function loadDispatchHistory(client, campaignKey) {
  const result = await client.query(
    `SELECT admin_id, action, payload_json, created_at
     FROM admin_audit
     WHERE target = $1
       AND action IN ('live_ops_campaign_dry_run', 'live_ops_campaign_dispatch')
       AND COALESCE(payload_json->>'campaign_key', '') = $2
     ORDER BY created_at DESC
     LIMIT 8;`,
    [`config:${LIVE_OPS_CAMPAIGN_CONFIG_KEY}`, String(campaignKey || "")]
  );
  return result.rows.map((row) => {
    const payload = row.payload_json && typeof row.payload_json === "object" && !Array.isArray(row.payload_json) ? row.payload_json : {};
    const action = String(row.action || "live_ops_campaign_dry_run");
    return {
      action,
      created_at: row.created_at || null,
      admin_id: Number(row.admin_id || 0),
      campaign_key: String(payload.campaign_key || campaignKey || ""),
      campaign_version: Number(payload.campaign_version || 0),
      dispatch_ref: String(payload.dispatch_ref || ""),
      dispatch_source: String(payload.dispatch_source || "manual"),
      window_key: String(payload.window_key || ""),
      segment_key: String(payload.segment_key || ""),
      reason: String(payload.reason || ""),
      dry_run: action === "live_ops_campaign_dry_run",
      attempted: Number(payload.attempted || 0),
      sent: Number(payload.sent || 0),
      recorded: Number(payload.recorded || 0),
      skipped_disabled: Number(payload.skipped_disabled || 0)
    };
  });
}

async function loadSchedulerSkipSummary(client, campaignKey) {
  const target = `config:${LIVE_OPS_CAMPAIGN_CONFIG_KEY}`;
  const key = String(campaignKey || "");
  const [totalsResult, latestResult, reasonResult, dailyResult] = await Promise.all([
    client.query(
      `SELECT
         COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours')::bigint AS skipped_24h,
         COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days')::bigint AS skipped_7d
       FROM admin_audit
       WHERE target = $1
         AND action = 'live_ops_campaign_scheduler_skip'
         AND COALESCE(payload_json->>'campaign_key', '') = $2;`,
      [target, key]
    ),
    client.query(
      `SELECT created_at, payload_json
       FROM admin_audit
       WHERE target = $1
         AND action = 'live_ops_campaign_scheduler_skip'
         AND COALESCE(payload_json->>'campaign_key', '') = $2
       ORDER BY created_at DESC
       LIMIT 1;`,
      [target, key]
    ),
    client.query(
      `SELECT
         COALESCE(payload_json->>'reason', 'unknown') AS bucket_key,
         COUNT(*)::bigint AS item_count
       FROM admin_audit
       WHERE target = $1
         AND action = 'live_ops_campaign_scheduler_skip'
         AND COALESCE(payload_json->>'campaign_key', '') = $2
         AND created_at >= now() - interval '7 days'
       GROUP BY 1
       ORDER BY item_count DESC, bucket_key ASC
       LIMIT 8;`,
      [target, key]
    ),
    client.query(
      `SELECT
         to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
         COUNT(*)::bigint AS skip_count
       FROM admin_audit
       WHERE target = $1
         AND action = 'live_ops_campaign_scheduler_skip'
         AND COALESCE(payload_json->>'campaign_key', '') = $2
         AND created_at >= now() - interval '7 days'
       GROUP BY 1
       ORDER BY day DESC
       LIMIT 7;`,
      [target, key]
    )
  ]);

  const totals = totalsResult.rows[0] || {};
  const latest = latestResult.rows[0] || {};
  const latestPayload = latest.payload_json && typeof latest.payload_json === "object" && !Array.isArray(latest.payload_json) ? latest.payload_json : {};
  const summary = {
    skipped_24h: Math.max(0, Number(totals.skipped_24h || 0)),
    skipped_7d: Math.max(0, Number(totals.skipped_7d || 0)),
    latest_skip_at: latest.created_at || null,
    latest_skip_reason: String(latestPayload.reason || ""),
    reason_breakdown: normalizeBreakdownRows(reasonResult.rows),
    daily_breakdown: (Array.isArray(dailyResult.rows) ? dailyResult.rows : [])
      .map((row) => ({
        day: String(row.day || ""),
        skip_count: Math.max(0, Number(row.skip_count || 0))
      }))
      .filter((row) => row.day)
  };
  return buildSchedulerSkipAlarmSummary(summary);
}

function countSkipReason(rows, reasonKey) {
  const safeReason = String(reasonKey || "").trim();
  if (!safeReason || !Array.isArray(rows)) {
    return 0;
  }
  const match = rows.find((row) => String(row?.bucket_key || "").trim() === safeReason);
  return Math.max(0, Number(match?.item_count || 0));
}

function buildSchedulerSkipAlarmSummary(summary = {}) {
  const reasonBreakdown = Array.isArray(summary.reason_breakdown) ? summary.reason_breakdown : [];
  const alertBlocked7d = countSkipReason(reasonBreakdown, "scene_runtime_alert_blocked");
  const watchCapped7d = countSkipReason(reasonBreakdown, "scene_runtime_watch_capped");
  let alarmState = "clear";
  let alarmReason = "";
  if (alertBlocked7d >= 2) {
    alarmState = "alert";
    alarmReason = "scene_runtime_alert_blocked_repeated";
  } else if (watchCapped7d >= 3) {
    alarmState = "watch";
    alarmReason = "scene_runtime_watch_capped_repeated";
  }
  return {
    skipped_24h: Math.max(0, Number(summary.skipped_24h || 0)),
    skipped_7d: Math.max(0, Number(summary.skipped_7d || 0)),
    latest_skip_at: summary.latest_skip_at || null,
    latest_skip_reason: String(summary.latest_skip_reason || ""),
    alarm_state: alarmState,
    alarm_reason: alarmReason,
    scene_alert_blocked_7d: alertBlocked7d,
    scene_watch_capped_7d: watchCapped7d,
    reason_breakdown: normalizeBreakdownRows(reasonBreakdown),
    daily_breakdown: Array.isArray(summary.daily_breakdown) ? summary.daily_breakdown : []
  };
}

function normalizeOpsAlertDailyRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      day: String(row?.day || "").trim(),
      alert_count: Math.max(0, Number(row?.alert_count || 0)),
      telegram_sent_count: Math.max(0, Number(row?.telegram_sent_count || 0)),
      effective_cap_delta_sum: Math.max(0, Number(row?.effective_cap_delta_sum || 0)),
      effective_cap_delta_max: Math.max(0, Number(row?.effective_cap_delta_max || 0))
    }))
    .filter((row) => row.day)
    .slice(0, 7);
}

function normalizeSelectionTrendDailyRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      day: String(row?.day || "").trim(),
      dispatch_count: Math.max(0, Number(row?.dispatch_count || 0)),
      query_strategy_applied_count: Math.max(0, Number(row?.query_strategy_applied_count || 0)),
      prefilter_applied_count: Math.max(0, Number(row?.prefilter_applied_count || 0)),
      prefilter_delta_sum: Math.max(0, Number(row?.prefilter_delta_sum || 0)),
      prioritized_focus_matches: Math.max(0, Number(row?.prioritized_focus_matches || 0)),
      selected_focus_matches: Math.max(0, Number(row?.selected_focus_matches || 0))
    }))
    .filter((row) => row.day)
    .slice(0, 7);
}

function normalizeSelectionAdjustmentDailyRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      day: String(row?.day || "").trim(),
      adjustment_count: Math.max(0, Number(row?.adjustment_count || 0)),
      total_delta_sum: Math.max(0, Number(row?.total_delta_sum || 0)),
      max_delta_value: Math.max(0, Number(row?.max_delta_value || 0))
    }))
    .filter((row) => row.day)
    .slice(0, 7);
}

function normalizeSelectionFamilyDailyRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      day: String(row?.day || "").trim(),
      bucket_key: String(row?.bucket_key || "unknown").trim() || "unknown",
      item_count: Math.max(0, Number(row?.item_count || 0))
    }))
    .filter((row) => row.day)
    .slice(0, 7);
}

function buildFamilyBreakdown(rows, resolver) {
  const counts = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const familyKey = String(resolver?.(row?.bucket_key) || "").trim().toLowerCase();
    if (!familyKey) {
      continue;
    }
    counts.set(familyKey, (counts.get(familyKey) || 0) + Math.max(0, Number(row?.item_count || 0)));
  }
  return Array.from(counts.entries())
    .map(([bucket_key, item_count]) => ({ bucket_key, item_count }))
    .sort((left, right) => {
      if (right.item_count !== left.item_count) {
        return right.item_count - left.item_count;
      }
      return String(left.bucket_key).localeCompare(String(right.bucket_key));
    })
    .slice(0, 8);
}

function buildFamilyDailyBreakdown(rows, resolver) {
  const countsByDay = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const dayKey = String(row?.day || "").trim();
    const familyKey = String(resolver?.(row?.bucket_key) || "").trim().toLowerCase();
    if (!dayKey || !familyKey) {
      continue;
    }
    const itemCount = Math.max(0, Number(row?.item_count || 0));
    if (!countsByDay.has(dayKey)) {
      countsByDay.set(dayKey, new Map());
    }
    const dayCounts = countsByDay.get(dayKey);
    dayCounts.set(familyKey, (dayCounts.get(familyKey) || 0) + itemCount);
  }
  return Array.from(countsByDay.entries())
    .map(([day, dayCounts]) => {
      const topRow = Array.from(dayCounts.entries())
        .map(([bucket_key, item_count]) => ({ bucket_key, item_count }))
        .sort((left, right) => {
          if (right.item_count !== left.item_count) {
            return right.item_count - left.item_count;
          }
          return String(left.bucket_key).localeCompare(String(right.bucket_key));
        })[0];
      return topRow ? { day, bucket_key: topRow.bucket_key, item_count: topRow.item_count } : null;
    })
    .filter(Boolean)
    .sort((left, right) => String(right.day).localeCompare(String(left.day)))
    .slice(0, 7);
}

function buildSelectionFamilyRiskBandBreakdown(rows) {
  const counts = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const bucketKey = String(row?.risk_state || "clear").trim().toLowerCase() || "clear";
    counts.set(bucketKey, (counts.get(bucketKey) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([bucket_key, item_count]) => ({ bucket_key, item_count }))
    .sort((left, right) => {
      if (right.item_count !== left.item_count) {
        return right.item_count - left.item_count;
      }
      return String(left.bucket_key).localeCompare(String(right.bucket_key));
    })
    .slice(0, 8);
}

function buildSelectionFamilyRiskDailyBreakdown(queryFamilyDailyRows, segmentFamilyDailyRows) {
  const safeQueryRows = normalizeSelectionFamilyDailyRows(queryFamilyDailyRows);
  const safeSegmentRows = normalizeSelectionFamilyDailyRows(segmentFamilyDailyRows);
  const queryRowByDay = new Map(safeQueryRows.map((row) => [row.day, row]));
  const segmentRowByDay = new Map(safeSegmentRows.map((row) => [row.day, row]));
  const days = Array.from(
    new Set([
      ...safeQueryRows.map((row) => row.day),
      ...safeSegmentRows.map((row) => row.day)
    ])
  )
    .filter(Boolean)
    .sort((left, right) => String(right).localeCompare(String(left)))
    .slice(0, 7);

  return days.map((day) => {
    const queryRow = queryRowByDay.get(day);
    const segmentRow = segmentRowByDay.get(day);
    const risk = resolveLiveOpsSelectionFamilyQueryRisk({
      latest_query_strategy_family: queryRow?.bucket_key || "",
      latest_segment_strategy_family: segmentRow?.bucket_key || "",
      query_strategy_family_daily_breakdown: safeQueryRows.filter((row) => String(row.day).localeCompare(day) <= 0),
      segment_strategy_family_daily_breakdown: safeSegmentRows.filter((row) => String(row.day).localeCompare(day) <= 0)
    });
    return {
      day,
      risk_state: risk.state,
      risk_reason: risk.reason,
      risk_dimension: risk.dimension,
      risk_bucket: risk.bucket,
      risk_score: Math.max(0, Number(risk.weight || 0)),
      query_family: String(queryRow?.bucket_key || "").trim(),
      segment_family: String(segmentRow?.bucket_key || "").trim(),
      query_match_days: Math.max(0, Number(risk.query_match_days || 0)),
      segment_match_days: Math.max(0, Number(risk.segment_match_days || 0)),
      query_weight: Math.max(0, Number(risk.query_weight || 0)),
      segment_weight: Math.max(0, Number(risk.segment_weight || 0))
    };
  });
}

function normalizeSelectionTrendSummary(summary) {
  const safeSummary = summary && typeof summary === "object" && !Array.isArray(summary) ? summary : {};
  return {
    dispatches_24h: Math.max(0, Number(safeSummary.dispatches_24h || 0)),
    dispatches_7d: Math.max(0, Number(safeSummary.dispatches_7d || 0)),
    query_strategy_applied_24h: Math.max(0, Number(safeSummary.query_strategy_applied_24h || 0)),
    query_strategy_applied_7d: Math.max(0, Number(safeSummary.query_strategy_applied_7d || 0)),
    prefilter_applied_24h: Math.max(0, Number(safeSummary.prefilter_applied_24h || 0)),
    prefilter_applied_7d: Math.max(0, Number(safeSummary.prefilter_applied_7d || 0)),
    prefilter_delta_24h: Math.max(0, Number(safeSummary.prefilter_delta_24h || 0)),
    prefilter_delta_7d: Math.max(0, Number(safeSummary.prefilter_delta_7d || 0)),
    prioritized_focus_matches_24h: Math.max(0, Number(safeSummary.prioritized_focus_matches_24h || 0)),
    prioritized_focus_matches_7d: Math.max(0, Number(safeSummary.prioritized_focus_matches_7d || 0)),
    selected_focus_matches_24h: Math.max(0, Number(safeSummary.selected_focus_matches_24h || 0)),
    selected_focus_matches_7d: Math.max(0, Number(safeSummary.selected_focus_matches_7d || 0)),
    query_adjustment_applied_24h: Math.max(0, Number(safeSummary.query_adjustment_applied_24h || 0)),
    query_adjustment_applied_7d: Math.max(0, Number(safeSummary.query_adjustment_applied_7d || 0)),
    query_adjustment_total_delta_24h: Math.max(0, Number(safeSummary.query_adjustment_total_delta_24h || 0)),
    query_adjustment_total_delta_7d: Math.max(0, Number(safeSummary.query_adjustment_total_delta_7d || 0)),
    latest_selection_at: safeSummary.latest_selection_at || null,
    latest_guidance_mode: String(safeSummary.latest_guidance_mode || "balanced").trim() || "balanced",
    latest_focus_dimension: String(safeSummary.latest_focus_dimension || "").trim(),
    latest_focus_bucket: String(safeSummary.latest_focus_bucket || "").trim(),
    latest_query_strategy_reason: String(safeSummary.latest_query_strategy_reason || "").trim(),
    latest_query_strategy_family: String(safeSummary.latest_query_strategy_family || "").trim(),
    latest_segment_strategy_reason: String(safeSummary.latest_segment_strategy_reason || "").trim(),
    latest_segment_strategy_family: String(safeSummary.latest_segment_strategy_family || "").trim(),
    latest_query_adjustment_field: String(safeSummary.latest_query_adjustment_field || "").trim(),
    latest_query_adjustment_reason: String(safeSummary.latest_query_adjustment_reason || "").trim(),
    latest_query_adjustment_total_delta: Math.max(0, Number(safeSummary.latest_query_adjustment_total_delta || 0)),
    latest_prefilter_reason: String(safeSummary.latest_prefilter_reason || "").trim(),
    latest_family_risk_state: ["clear", "watch", "alert"].includes(String(safeSummary.latest_family_risk_state || "").trim().toLowerCase())
      ? String(safeSummary.latest_family_risk_state || "").trim().toLowerCase()
      : "clear",
    latest_family_risk_reason: String(safeSummary.latest_family_risk_reason || "").trim(),
    latest_family_risk_dimension: String(safeSummary.latest_family_risk_dimension || "").trim(),
    latest_family_risk_bucket: String(safeSummary.latest_family_risk_bucket || "").trim(),
    latest_family_risk_score: Math.max(0, Number(safeSummary.latest_family_risk_score || 0)),
    daily_breakdown: normalizeSelectionTrendDailyRows(safeSummary.daily_breakdown),
    query_adjustment_daily_breakdown: normalizeSelectionAdjustmentDailyRows(safeSummary.query_adjustment_daily_breakdown),
    query_strategy_family_daily_breakdown: normalizeSelectionFamilyDailyRows(safeSummary.query_strategy_family_daily_breakdown),
    query_adjustment_query_family_daily_breakdown: normalizeSelectionFamilyDailyRows(safeSummary.query_adjustment_query_family_daily_breakdown),
    segment_strategy_family_daily_breakdown: normalizeSelectionFamilyDailyRows(safeSummary.segment_strategy_family_daily_breakdown),
    query_adjustment_segment_family_daily_breakdown: normalizeSelectionFamilyDailyRows(safeSummary.query_adjustment_segment_family_daily_breakdown),
    family_risk_daily_breakdown: (Array.isArray(safeSummary.family_risk_daily_breakdown) ? safeSummary.family_risk_daily_breakdown : [])
      .map((row) => ({
        day: String(row?.day || "").trim(),
        risk_state: ["clear", "watch", "alert"].includes(String(row?.risk_state || "").trim().toLowerCase())
          ? String(row?.risk_state || "").trim().toLowerCase()
          : "clear",
        risk_reason: String(row?.risk_reason || "").trim(),
        risk_dimension: String(row?.risk_dimension || "").trim(),
        risk_bucket: String(row?.risk_bucket || "").trim(),
        risk_score: Math.max(0, Number(row?.risk_score || 0)),
        query_family: String(row?.query_family || "").trim(),
        segment_family: String(row?.segment_family || "").trim(),
        query_match_days: Math.max(0, Number(row?.query_match_days || 0)),
        segment_match_days: Math.max(0, Number(row?.segment_match_days || 0)),
        query_weight: Math.max(0, Number(row?.query_weight || 0)),
        segment_weight: Math.max(0, Number(row?.segment_weight || 0))
      }))
      .filter((row) => row.day)
      .slice(0, 7),
    query_adjustment_field_breakdown: normalizeBreakdownRows(safeSummary.query_adjustment_field_breakdown),
    query_adjustment_reason_breakdown: normalizeBreakdownRows(safeSummary.query_adjustment_reason_breakdown),
    query_strategy_reason_breakdown: normalizeBreakdownRows(safeSummary.query_strategy_reason_breakdown),
    query_strategy_family_breakdown: normalizeBreakdownRows(safeSummary.query_strategy_family_breakdown),
    query_adjustment_query_family_breakdown: normalizeBreakdownRows(safeSummary.query_adjustment_query_family_breakdown),
    segment_strategy_reason_breakdown: normalizeBreakdownRows(safeSummary.segment_strategy_reason_breakdown),
    query_adjustment_segment_family_breakdown: normalizeBreakdownRows(safeSummary.query_adjustment_segment_family_breakdown),
    segment_strategy_family_breakdown: normalizeBreakdownRows(safeSummary.segment_strategy_family_breakdown),
    family_risk_band_breakdown: normalizeBreakdownRows(safeSummary.family_risk_band_breakdown),
    prefilter_reason_breakdown: normalizeBreakdownRows(safeSummary.prefilter_reason_breakdown)
  };
}

async function loadSelectionTrendSummary(client, campaignKey) {
  const target = `config:${LIVE_OPS_CAMPAIGN_CONFIG_KEY}`;
  const key = String(campaignKey || "");
  const [
    totalsResult,
    latestResult,
    dailyResult,
    adjustmentDailyResult,
    prefilterReasonResult,
    adjustmentFieldResult,
    adjustmentReasonResult,
    queryReasonResult,
    adjustmentQueryReasonResult,
    segmentReasonResult,
    queryReasonDailyResult,
    adjustmentQueryReasonDailyResult,
    segmentReasonDailyResult,
    adjustmentSegmentReasonResult,
    adjustmentSegmentReasonDailyResult
  ] = await Promise.all([
    client.query(
      `SELECT
         COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours')::bigint AS dispatches_24h,
         COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days')::bigint AS dispatches_7d,
         COUNT(*) FILTER (
           WHERE created_at >= now() - interval '24 hours'
             AND COALESCE(lower(payload_json#>>'{targeting_selection_summary,query_strategy_summary,applied}'), 'false') IN ('true', '1', 'yes', 'on')
         )::bigint AS query_strategy_applied_24h,
         COUNT(*) FILTER (
           WHERE created_at >= now() - interval '7 days'
             AND COALESCE(lower(payload_json#>>'{targeting_selection_summary,query_strategy_summary,applied}'), 'false') IN ('true', '1', 'yes', 'on')
         )::bigint AS query_strategy_applied_7d,
         COUNT(*) FILTER (
           WHERE created_at >= now() - interval '24 hours'
             AND COALESCE(lower(payload_json#>>'{targeting_selection_summary,prefilter_summary,applied}'), 'false') IN ('true', '1', 'yes', 'on')
         )::bigint AS prefilter_applied_24h,
         COUNT(*) FILTER (
           WHERE created_at >= now() - interval '7 days'
             AND COALESCE(lower(payload_json#>>'{targeting_selection_summary,prefilter_summary,applied}'), 'false') IN ('true', '1', 'yes', 'on')
         )::bigint AS prefilter_applied_7d,
         COALESCE(
           SUM(
             CASE
               WHEN created_at >= now() - interval '24 hours'
                AND NULLIF(payload_json#>>'{targeting_selection_summary,prefilter_summary,candidates_before}', '') IS NOT NULL
                AND NULLIF(payload_json#>>'{targeting_selection_summary,prefilter_summary,candidates_after}', '') IS NOT NULL
                 THEN GREATEST(
                   (payload_json#>>'{targeting_selection_summary,prefilter_summary,candidates_before}')::int -
                   (payload_json#>>'{targeting_selection_summary,prefilter_summary,candidates_after}')::int,
                   0
                 )
               ELSE 0
             END
           ),
           0
         )::bigint AS prefilter_delta_24h,
         COALESCE(
           SUM(
             CASE
               WHEN created_at >= now() - interval '7 days'
                AND NULLIF(payload_json#>>'{targeting_selection_summary,prefilter_summary,candidates_before}', '') IS NOT NULL
                AND NULLIF(payload_json#>>'{targeting_selection_summary,prefilter_summary,candidates_after}', '') IS NOT NULL
                 THEN GREATEST(
                   (payload_json#>>'{targeting_selection_summary,prefilter_summary,candidates_before}')::int -
                   (payload_json#>>'{targeting_selection_summary,prefilter_summary,candidates_after}')::int,
                   0
                 )
               ELSE 0
             END
           ),
           0
         )::bigint AS prefilter_delta_7d,
         COALESCE(
           SUM(
             CASE
               WHEN created_at >= now() - interval '24 hours'
                AND NULLIF(payload_json#>>'{targeting_selection_summary,prioritized_focus_matches}', '') IS NOT NULL
                 THEN (payload_json#>>'{targeting_selection_summary,prioritized_focus_matches}')::int
               ELSE 0
             END
           ),
           0
         )::bigint AS prioritized_focus_matches_24h,
         COALESCE(
           SUM(
             CASE
               WHEN created_at >= now() - interval '7 days'
                AND NULLIF(payload_json#>>'{targeting_selection_summary,prioritized_focus_matches}', '') IS NOT NULL
                 THEN (payload_json#>>'{targeting_selection_summary,prioritized_focus_matches}')::int
               ELSE 0
             END
           ),
           0
         )::bigint AS prioritized_focus_matches_7d,
         COALESCE(
           SUM(
             CASE
               WHEN created_at >= now() - interval '24 hours'
                AND NULLIF(payload_json#>>'{targeting_selection_summary,selected_focus_matches}', '') IS NOT NULL
                 THEN (payload_json#>>'{targeting_selection_summary,selected_focus_matches}')::int
               ELSE 0
             END
           ),
           0
         )::bigint AS selected_focus_matches_24h,
         COALESCE(
           SUM(
             CASE
               WHEN created_at >= now() - interval '7 days'
                AND NULLIF(payload_json#>>'{targeting_selection_summary,selected_focus_matches}', '') IS NOT NULL
                 THEN (payload_json#>>'{targeting_selection_summary,selected_focus_matches}')::int
               ELSE 0
             END
           ),
           0
         )::bigint AS selected_focus_matches_7d,
         COUNT(*) FILTER (
           WHERE created_at >= now() - interval '24 hours'
             AND jsonb_array_length(COALESCE(payload_json#>'{targeting_selection_summary,query_strategy_summary,adjustment_rows}', '[]'::jsonb)) > 0
         )::bigint AS query_adjustment_applied_24h,
         COUNT(*) FILTER (
           WHERE created_at >= now() - interval '7 days'
             AND jsonb_array_length(COALESCE(payload_json#>'{targeting_selection_summary,query_strategy_summary,adjustment_rows}', '[]'::jsonb)) > 0
         )::bigint AS query_adjustment_applied_7d,
         COALESCE(
           SUM(
             CASE
               WHEN created_at >= now() - interval '24 hours'
                 THEN (
                   SELECT COALESCE(SUM(ABS(COALESCE(NULLIF(adj->>'delta_value', ''), '0')::int)), 0)
                   FROM jsonb_array_elements(COALESCE(payload_json#>'{targeting_selection_summary,query_strategy_summary,adjustment_rows}', '[]'::jsonb)) adj
                 )
               ELSE 0
             END
           ),
           0
         )::bigint AS query_adjustment_total_delta_24h,
         COALESCE(
           SUM(
             CASE
               WHEN created_at >= now() - interval '7 days'
                 THEN (
                   SELECT COALESCE(SUM(ABS(COALESCE(NULLIF(adj->>'delta_value', ''), '0')::int)), 0)
                   FROM jsonb_array_elements(COALESCE(payload_json#>'{targeting_selection_summary,query_strategy_summary,adjustment_rows}', '[]'::jsonb)) adj
                 )
               ELSE 0
             END
           ),
           0
         )::bigint AS query_adjustment_total_delta_7d
       FROM admin_audit
       WHERE target = $1
         AND action = 'live_ops_campaign_dispatch'
         AND COALESCE(payload_json->>'campaign_key', '') = $2
         AND COALESCE(payload_json->>'dispatch_source', 'manual') = 'scheduler';`,
      [target, key]
    ),
    client.query(
      `SELECT created_at, payload_json
       FROM admin_audit
       WHERE target = $1
         AND action = 'live_ops_campaign_dispatch'
         AND COALESCE(payload_json->>'campaign_key', '') = $2
         AND COALESCE(payload_json->>'dispatch_source', 'manual') = 'scheduler'
       ORDER BY created_at DESC
       LIMIT 1;`,
      [target, key]
    ),
    client.query(
      `SELECT
         to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
         COUNT(*)::bigint AS dispatch_count,
         COUNT(*) FILTER (
           WHERE COALESCE(lower(payload_json#>>'{targeting_selection_summary,query_strategy_summary,applied}'), 'false') IN ('true', '1', 'yes', 'on')
         )::bigint AS query_strategy_applied_count,
         COUNT(*) FILTER (
           WHERE COALESCE(lower(payload_json#>>'{targeting_selection_summary,prefilter_summary,applied}'), 'false') IN ('true', '1', 'yes', 'on')
         )::bigint AS prefilter_applied_count,
         COALESCE(
           SUM(
             CASE
               WHEN NULLIF(payload_json#>>'{targeting_selection_summary,prefilter_summary,candidates_before}', '') IS NOT NULL
                AND NULLIF(payload_json#>>'{targeting_selection_summary,prefilter_summary,candidates_after}', '') IS NOT NULL
                 THEN GREATEST(
                   (payload_json#>>'{targeting_selection_summary,prefilter_summary,candidates_before}')::int -
                   (payload_json#>>'{targeting_selection_summary,prefilter_summary,candidates_after}')::int,
                   0
                 )
               ELSE 0
             END
           ),
           0
         )::bigint AS prefilter_delta_sum,
         COALESCE(
           SUM(
             CASE
               WHEN NULLIF(payload_json#>>'{targeting_selection_summary,prioritized_focus_matches}', '') IS NOT NULL
                 THEN (payload_json#>>'{targeting_selection_summary,prioritized_focus_matches}')::int
               ELSE 0
             END
           ),
           0
         )::bigint AS prioritized_focus_matches,
         COALESCE(
           SUM(
             CASE
               WHEN NULLIF(payload_json#>>'{targeting_selection_summary,selected_focus_matches}', '') IS NOT NULL
                 THEN (payload_json#>>'{targeting_selection_summary,selected_focus_matches}')::int
               ELSE 0
             END
           ),
           0
         )::bigint AS selected_focus_matches
       FROM admin_audit
       WHERE target = $1
         AND action = 'live_ops_campaign_dispatch'
         AND COALESCE(payload_json->>'campaign_key', '') = $2
         AND COALESCE(payload_json->>'dispatch_source', 'manual') = 'scheduler'
         AND created_at >= now() - interval '7 days'
       GROUP BY 1
       ORDER BY day DESC
       LIMIT 7;`,
      [target, key]
    ),
    client.query(
      `SELECT
         to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
         COUNT(*) FILTER (
           WHERE jsonb_array_length(COALESCE(payload_json#>'{targeting_selection_summary,query_strategy_summary,adjustment_rows}', '[]'::jsonb)) > 0
         )::bigint AS adjustment_count,
         COALESCE(
           SUM(
             (
               SELECT COALESCE(SUM(ABS(COALESCE(NULLIF(adj->>'delta_value', ''), '0')::int)), 0)
               FROM jsonb_array_elements(COALESCE(payload_json#>'{targeting_selection_summary,query_strategy_summary,adjustment_rows}', '[]'::jsonb)) adj
             )
           ),
           0
         )::bigint AS total_delta_sum,
         COALESCE(
           MAX(
             (
               SELECT COALESCE(MAX(ABS(COALESCE(NULLIF(adj->>'delta_value', ''), '0')::int)), 0)
               FROM jsonb_array_elements(COALESCE(payload_json#>'{targeting_selection_summary,query_strategy_summary,adjustment_rows}', '[]'::jsonb)) adj
             )
           ),
           0
         )::bigint AS max_delta_value
       FROM admin_audit
       WHERE target = $1
         AND action = 'live_ops_campaign_dispatch'
         AND COALESCE(payload_json->>'campaign_key', '') = $2
         AND COALESCE(payload_json->>'dispatch_source', 'manual') = 'scheduler'
         AND created_at >= now() - interval '7 days'
       GROUP BY 1
       ORDER BY day DESC
       LIMIT 7;`,
      [target, key]
    ),
    client.query(
      `SELECT
         COALESCE(NULLIF(payload_json#>>'{targeting_selection_summary,prefilter_summary,reason}', ''), 'unknown') AS bucket_key,
         COUNT(*)::bigint AS item_count
       FROM admin_audit
       WHERE target = $1
         AND action = 'live_ops_campaign_dispatch'
         AND COALESCE(payload_json->>'campaign_key', '') = $2
         AND COALESCE(payload_json->>'dispatch_source', 'manual') = 'scheduler'
         AND created_at >= now() - interval '7 days'
       GROUP BY 1
       ORDER BY item_count DESC, bucket_key ASC
       LIMIT 8;`,
      [target, key]
    ),
    client.query(
      `SELECT
         COALESCE(NULLIF(adj->>'field_key', ''), 'unknown') AS bucket_key,
         COALESCE(SUM(ABS(COALESCE(NULLIF(adj->>'delta_value', ''), '0')::int)), 0)::bigint AS item_count
       FROM admin_audit
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(payload_json#>'{targeting_selection_summary,query_strategy_summary,adjustment_rows}', '[]'::jsonb)) adj
       WHERE target = $1
         AND action = 'live_ops_campaign_dispatch'
         AND COALESCE(payload_json->>'campaign_key', '') = $2
         AND COALESCE(payload_json->>'dispatch_source', 'manual') = 'scheduler'
         AND created_at >= now() - interval '7 days'
       GROUP BY 1
       ORDER BY item_count DESC, bucket_key ASC
       LIMIT 8;`,
      [target, key]
    ),
    client.query(
      `SELECT
         COALESCE(NULLIF(adj->>'reason_code', ''), 'unknown') AS bucket_key,
         COALESCE(SUM(ABS(COALESCE(NULLIF(adj->>'delta_value', ''), '0')::int)), 0)::bigint AS item_count
       FROM admin_audit
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(payload_json#>'{targeting_selection_summary,query_strategy_summary,adjustment_rows}', '[]'::jsonb)) adj
       WHERE target = $1
         AND action = 'live_ops_campaign_dispatch'
         AND COALESCE(payload_json->>'campaign_key', '') = $2
         AND COALESCE(payload_json->>'dispatch_source', 'manual') = 'scheduler'
         AND created_at >= now() - interval '7 days'
       GROUP BY 1
       ORDER BY item_count DESC, bucket_key ASC
       LIMIT 8;`,
      [target, key]
    ),
    client.query(
      `SELECT
         COALESCE(NULLIF(payload_json#>>'{targeting_selection_summary,query_strategy_summary,reason}', ''), 'unknown') AS bucket_key,
         COUNT(*)::bigint AS item_count
       FROM admin_audit
       WHERE target = $1
         AND action = 'live_ops_campaign_dispatch'
         AND COALESCE(payload_json->>'campaign_key', '') = $2
         AND COALESCE(payload_json->>'dispatch_source', 'manual') = 'scheduler'
         AND created_at >= now() - interval '7 days'
       GROUP BY 1
       ORDER BY item_count DESC, bucket_key ASC
       LIMIT 8;`,
      [target, key]
    ),
    client.query(
      `SELECT
         COALESCE(NULLIF(payload_json#>>'{targeting_selection_summary,query_strategy_summary,reason}', ''), 'unknown') AS bucket_key,
         COALESCE(SUM(ABS(COALESCE(NULLIF(adj->>'delta_value', ''), '0')::int)), 0)::bigint AS item_count
       FROM admin_audit
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(payload_json#>'{targeting_selection_summary,query_strategy_summary,adjustment_rows}', '[]'::jsonb)) adj
       WHERE target = $1
         AND action = 'live_ops_campaign_dispatch'
         AND COALESCE(payload_json->>'campaign_key', '') = $2
         AND COALESCE(payload_json->>'dispatch_source', 'manual') = 'scheduler'
         AND created_at >= now() - interval '7 days'
       GROUP BY 1
       ORDER BY item_count DESC, bucket_key ASC
       LIMIT 8;`,
      [target, key]
    ),
    client.query(
      `SELECT
         COALESCE(NULLIF(payload_json#>>'{targeting_selection_summary,query_strategy_summary,segment_strategy_reason}', ''), 'unknown') AS bucket_key,
         COUNT(*)::bigint AS item_count
       FROM admin_audit
       WHERE target = $1
         AND action = 'live_ops_campaign_dispatch'
         AND COALESCE(payload_json->>'campaign_key', '') = $2
         AND COALESCE(payload_json->>'dispatch_source', 'manual') = 'scheduler'
         AND created_at >= now() - interval '7 days'
       GROUP BY 1
       ORDER BY item_count DESC, bucket_key ASC
       LIMIT 8;`,
      [target, key]
    ),
    client.query(
      `SELECT
         to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
         COALESCE(NULLIF(payload_json#>>'{targeting_selection_summary,query_strategy_summary,reason}', ''), 'unknown') AS bucket_key,
         COUNT(*)::bigint AS item_count
       FROM admin_audit
       WHERE target = $1
         AND action = 'live_ops_campaign_dispatch'
         AND COALESCE(payload_json->>'campaign_key', '') = $2
         AND COALESCE(payload_json->>'dispatch_source', 'manual') = 'scheduler'
         AND created_at >= now() - interval '7 days'
       GROUP BY 1, 2
       ORDER BY day DESC, item_count DESC, bucket_key ASC;`,
      [target, key]
    ),
    client.query(
      `SELECT
         to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
         COALESCE(NULLIF(payload_json#>>'{targeting_selection_summary,query_strategy_summary,reason}', ''), 'unknown') AS bucket_key,
         COALESCE(SUM(ABS(COALESCE(NULLIF(adj->>'delta_value', ''), '0')::int)), 0)::bigint AS item_count
       FROM admin_audit
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(payload_json#>'{targeting_selection_summary,query_strategy_summary,adjustment_rows}', '[]'::jsonb)) adj
       WHERE target = $1
         AND action = 'live_ops_campaign_dispatch'
         AND COALESCE(payload_json->>'campaign_key', '') = $2
         AND COALESCE(payload_json->>'dispatch_source', 'manual') = 'scheduler'
         AND created_at >= now() - interval '7 days'
       GROUP BY 1, 2
       ORDER BY day DESC, item_count DESC, bucket_key ASC;`,
      [target, key]
    ),
    client.query(
      `SELECT
         to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
         COALESCE(NULLIF(payload_json#>>'{targeting_selection_summary,query_strategy_summary,segment_strategy_reason}', ''), 'unknown') AS bucket_key,
         COUNT(*)::bigint AS item_count
       FROM admin_audit
       WHERE target = $1
         AND action = 'live_ops_campaign_dispatch'
         AND COALESCE(payload_json->>'campaign_key', '') = $2
         AND COALESCE(payload_json->>'dispatch_source', 'manual') = 'scheduler'
         AND created_at >= now() - interval '7 days'
       GROUP BY 1, 2
       ORDER BY day DESC, item_count DESC, bucket_key ASC;`,
      [target, key]
    ),
    client.query(
      `SELECT
         COALESCE(NULLIF(payload_json#>>'{targeting_selection_summary,query_strategy_summary,segment_strategy_reason}', ''), 'unknown') AS bucket_key,
         COALESCE(SUM(ABS(COALESCE(NULLIF(adj->>'delta_value', ''), '0')::int)), 0)::bigint AS item_count
       FROM admin_audit
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(payload_json#>'{targeting_selection_summary,query_strategy_summary,adjustment_rows}', '[]'::jsonb)) adj
       WHERE target = $1
         AND action = 'live_ops_campaign_dispatch'
         AND COALESCE(payload_json->>'campaign_key', '') = $2
         AND COALESCE(payload_json->>'dispatch_source', 'manual') = 'scheduler'
         AND created_at >= now() - interval '7 days'
       GROUP BY 1
       ORDER BY item_count DESC, bucket_key ASC
       LIMIT 8;`,
      [target, key]
    ),
    client.query(
      `SELECT
         to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
         COALESCE(NULLIF(payload_json#>>'{targeting_selection_summary,query_strategy_summary,segment_strategy_reason}', ''), 'unknown') AS bucket_key,
         COALESCE(SUM(ABS(COALESCE(NULLIF(adj->>'delta_value', ''), '0')::int)), 0)::bigint AS item_count
       FROM admin_audit
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(payload_json#>'{targeting_selection_summary,query_strategy_summary,adjustment_rows}', '[]'::jsonb)) adj
       WHERE target = $1
         AND action = 'live_ops_campaign_dispatch'
         AND COALESCE(payload_json->>'campaign_key', '') = $2
         AND COALESCE(payload_json->>'dispatch_source', 'manual') = 'scheduler'
         AND created_at >= now() - interval '7 days'
       GROUP BY 1, 2
       ORDER BY day DESC, item_count DESC, bucket_key ASC;`,
      [target, key]
    )
  ]);

  const totals = totalsResult.rows[0] || {};
  const latest = latestResult.rows[0] || {};
  const latestPayload = latest.payload_json && typeof latest.payload_json === "object" && !Array.isArray(latest.payload_json)
    ? latest.payload_json
    : {};
  const latestSelection =
    latestPayload.targeting_selection_summary &&
    typeof latestPayload.targeting_selection_summary === "object" &&
    !Array.isArray(latestPayload.targeting_selection_summary)
      ? latestPayload.targeting_selection_summary
      : {};
  const latestQueryStrategy =
    latestSelection.query_strategy_summary &&
    typeof latestSelection.query_strategy_summary === "object" &&
    !Array.isArray(latestSelection.query_strategy_summary)
      ? latestSelection.query_strategy_summary
      : {};
  const latestQueryStrategySummary = buildLiveOpsCandidateQueryStrategySummary(latestQueryStrategy);
  const latestTopAdjustment = Array.isArray(latestQueryStrategySummary.adjustment_rows) && latestQueryStrategySummary.adjustment_rows[0]
    ? latestQueryStrategySummary.adjustment_rows
        .slice()
        .sort((left, right) => Math.abs(Number(right?.delta_value || 0)) - Math.abs(Number(left?.delta_value || 0)))[0]
    : null;
  const latestPrefilter =
    latestSelection.prefilter_summary &&
    typeof latestSelection.prefilter_summary === "object" &&
    !Array.isArray(latestSelection.prefilter_summary)
      ? latestSelection.prefilter_summary
      : {};
  const queryFamilyDailyBreakdown = buildFamilyDailyBreakdown(queryReasonDailyResult.rows, resolveLiveOpsQueryStrategyFamily);
  const adjustmentQueryFamilyDailyBreakdown = buildFamilyDailyBreakdown(adjustmentQueryReasonDailyResult.rows, resolveLiveOpsQueryStrategyFamily);
  const segmentFamilyDailyBreakdown = buildFamilyDailyBreakdown(segmentReasonDailyResult.rows, resolveLiveOpsSegmentStrategyFamily);
  const adjustmentSegmentFamilyDailyBreakdown = buildFamilyDailyBreakdown(adjustmentSegmentReasonDailyResult.rows, resolveLiveOpsSegmentStrategyFamily);
  const familyRiskDailyBreakdown = buildSelectionFamilyRiskDailyBreakdown(queryFamilyDailyBreakdown, segmentFamilyDailyBreakdown);
  const latestFamilyRisk = familyRiskDailyBreakdown[0] || {};
  return {
    dispatches_24h: Math.max(0, Number(totals.dispatches_24h || 0)),
    dispatches_7d: Math.max(0, Number(totals.dispatches_7d || 0)),
    query_strategy_applied_24h: Math.max(0, Number(totals.query_strategy_applied_24h || 0)),
    query_strategy_applied_7d: Math.max(0, Number(totals.query_strategy_applied_7d || 0)),
    prefilter_applied_24h: Math.max(0, Number(totals.prefilter_applied_24h || 0)),
    prefilter_applied_7d: Math.max(0, Number(totals.prefilter_applied_7d || 0)),
    prefilter_delta_24h: Math.max(0, Number(totals.prefilter_delta_24h || 0)),
    prefilter_delta_7d: Math.max(0, Number(totals.prefilter_delta_7d || 0)),
    prioritized_focus_matches_24h: Math.max(0, Number(totals.prioritized_focus_matches_24h || 0)),
    prioritized_focus_matches_7d: Math.max(0, Number(totals.prioritized_focus_matches_7d || 0)),
    selected_focus_matches_24h: Math.max(0, Number(totals.selected_focus_matches_24h || 0)),
    selected_focus_matches_7d: Math.max(0, Number(totals.selected_focus_matches_7d || 0)),
    query_adjustment_applied_24h: Math.max(0, Number(totals.query_adjustment_applied_24h || 0)),
    query_adjustment_applied_7d: Math.max(0, Number(totals.query_adjustment_applied_7d || 0)),
    query_adjustment_total_delta_24h: Math.max(0, Number(totals.query_adjustment_total_delta_24h || 0)),
    query_adjustment_total_delta_7d: Math.max(0, Number(totals.query_adjustment_total_delta_7d || 0)),
    latest_selection_at: latest.created_at || null,
    latest_guidance_mode: String(latestSelection.guidance_mode || "balanced"),
    latest_focus_dimension: String(latestSelection.focus_dimension || ""),
    latest_focus_bucket: String(latestSelection.focus_bucket || ""),
    latest_query_strategy_reason: String(latestQueryStrategy.reason || ""),
    latest_query_strategy_family: resolveLiveOpsQueryStrategyFamily(latestQueryStrategy.reason),
    latest_segment_strategy_reason: String(latestQueryStrategy.segment_strategy_reason || ""),
    latest_segment_strategy_family: resolveLiveOpsSegmentStrategyFamily(latestQueryStrategy.segment_strategy_reason),
    latest_query_adjustment_field: String(latestTopAdjustment?.field_key || ""),
    latest_query_adjustment_reason: String(latestTopAdjustment?.reason_code || ""),
    latest_query_adjustment_total_delta: Math.max(0, Math.abs(Number(latestTopAdjustment?.delta_value || 0))),
    latest_prefilter_reason: String(latestPrefilter.reason || ""),
    latest_family_risk_state: String(latestFamilyRisk.risk_state || "clear"),
    latest_family_risk_reason: String(latestFamilyRisk.risk_reason || ""),
    latest_family_risk_dimension: String(latestFamilyRisk.risk_dimension || ""),
    latest_family_risk_bucket: String(latestFamilyRisk.risk_bucket || ""),
    latest_family_risk_score: Math.max(0, Number(latestFamilyRisk.risk_score || 0)),
    daily_breakdown: normalizeSelectionTrendDailyRows(dailyResult.rows),
    query_adjustment_daily_breakdown: normalizeSelectionAdjustmentDailyRows(adjustmentDailyResult.rows),
    query_strategy_family_daily_breakdown: queryFamilyDailyBreakdown,
    query_adjustment_query_family_daily_breakdown: adjustmentQueryFamilyDailyBreakdown,
    segment_strategy_family_daily_breakdown: segmentFamilyDailyBreakdown,
    query_adjustment_segment_family_daily_breakdown: adjustmentSegmentFamilyDailyBreakdown,
    family_risk_daily_breakdown: familyRiskDailyBreakdown,
    query_adjustment_field_breakdown: normalizeBreakdownRows(adjustmentFieldResult.rows),
    query_adjustment_reason_breakdown: normalizeBreakdownRows(adjustmentReasonResult.rows),
    query_strategy_reason_breakdown: normalizeBreakdownRows(queryReasonResult.rows),
    query_strategy_family_breakdown: buildFamilyBreakdown(queryReasonResult.rows, resolveLiveOpsQueryStrategyFamily),
    query_adjustment_query_family_breakdown: buildFamilyBreakdown(adjustmentQueryReasonResult.rows, resolveLiveOpsQueryStrategyFamily),
    segment_strategy_reason_breakdown: normalizeBreakdownRows(segmentReasonResult.rows),
    query_adjustment_segment_family_breakdown: buildFamilyBreakdown(adjustmentSegmentReasonResult.rows, resolveLiveOpsSegmentStrategyFamily),
    segment_strategy_family_breakdown: buildFamilyBreakdown(segmentReasonResult.rows, resolveLiveOpsSegmentStrategyFamily),
    family_risk_band_breakdown: buildSelectionFamilyRiskBandBreakdown(familyRiskDailyBreakdown),
    prefilter_reason_breakdown: normalizeBreakdownRows(prefilterReasonResult.rows)
  };
}

async function loadOpsAlertTrendSummary(client, campaignKey) {
  const target = `config:${LIVE_OPS_CAMPAIGN_CONFIG_KEY}`;
  const key = String(campaignKey || "");
  const [totalsResult, latestResult, reasonResult, dailyResult, localeResult, segmentResult, surfaceResult, variantResult, cohortResult] = await Promise.all([
    client.query(
      `SELECT
         COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours')::bigint AS raised_24h,
         COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days')::bigint AS raised_7d,
         COUNT(*) FILTER (
           WHERE created_at >= now() - interval '24 hours'
             AND COALESCE(lower(payload_json->>'telegram_sent'), 'false') IN ('true', '1', 'yes', 'on')
         )::bigint AS telegram_sent_24h,
         COUNT(*) FILTER (
           WHERE created_at >= now() - interval '7 days'
             AND COALESCE(lower(payload_json->>'telegram_sent'), 'false') IN ('true', '1', 'yes', 'on')
        )::bigint AS telegram_sent_7d,
        COALESCE(
          SUM(
            CASE
              WHEN created_at >= now() - interval '24 hours'
               AND NULLIF(payload_json->>'effective_cap_delta', '') IS NOT NULL
                THEN (payload_json->>'effective_cap_delta')::int
              ELSE 0
            END
          ),
          0
        )::bigint AS effective_cap_delta_24h,
        COALESCE(
          SUM(
            CASE
              WHEN created_at >= now() - interval '7 days'
               AND NULLIF(payload_json->>'effective_cap_delta', '') IS NOT NULL
                THEN (payload_json->>'effective_cap_delta')::int
              ELSE 0
            END
          ),
          0
        )::bigint AS effective_cap_delta_7d,
        MAX(
          CASE
            WHEN NULLIF(payload_json->>'effective_cap_delta', '') IS NOT NULL
              THEN (payload_json->>'effective_cap_delta')::int
            ELSE 0
          END
        ) FILTER (WHERE created_at >= now() - interval '7 days')::bigint AS max_effective_cap_delta_7d
       FROM admin_audit
       WHERE target = $1
         AND action = 'live_ops_campaign_ops_alert'
         AND COALESCE(payload_json->>'campaign_key', '') = $2;`,
      [target, key]
    ),
    client.query(
      `SELECT created_at, payload_json
       FROM admin_audit
       WHERE target = $1
         AND action = 'live_ops_campaign_ops_alert'
         AND COALESCE(payload_json->>'campaign_key', '') = $2
       ORDER BY created_at DESC
       LIMIT 1;`,
      [target, key]
    ),
    client.query(
      `SELECT
         COALESCE(payload_json->>'notification_reason', 'unknown') AS bucket_key,
         COUNT(*)::bigint AS item_count
       FROM admin_audit
       WHERE target = $1
         AND action = 'live_ops_campaign_ops_alert'
         AND COALESCE(payload_json->>'campaign_key', '') = $2
         AND created_at >= now() - interval '7 days'
       GROUP BY 1
       ORDER BY item_count DESC, bucket_key ASC
       LIMIT 8;`,
      [target, key]
    ),
    client.query(
      `SELECT
         to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
         COUNT(*)::bigint AS alert_count,
         COUNT(*) FILTER (
           WHERE COALESCE(lower(payload_json->>'telegram_sent'), 'false') IN ('true', '1', 'yes', 'on')
         )::bigint AS telegram_sent_count,
         COALESCE(
           SUM(
             CASE
               WHEN NULLIF(payload_json->>'effective_cap_delta', '') IS NOT NULL
                 THEN (payload_json->>'effective_cap_delta')::int
               ELSE 0
             END
           ),
           0
         )::bigint AS effective_cap_delta_sum,
         MAX(
           CASE
             WHEN NULLIF(payload_json->>'effective_cap_delta', '') IS NOT NULL
               THEN (payload_json->>'effective_cap_delta')::int
             ELSE 0
           END
         )::bigint AS effective_cap_delta_max
       FROM admin_audit
       WHERE target = $1
         AND action = 'live_ops_campaign_ops_alert'
         AND COALESCE(payload_json->>'campaign_key', '') = $2
         AND created_at >= now() - interval '7 days'
       GROUP BY 1
       ORDER BY day DESC
       LIMIT 7;`,
      [target, key]
    ),
    client.query(
      `SELECT
         COALESCE(NULLIF(payload_json->>'locale_bucket', ''), 'unknown') AS bucket_key,
         COUNT(*)::bigint AS item_count
       FROM admin_audit
       WHERE target = $1
         AND action = 'live_ops_campaign_ops_alert'
         AND COALESCE(payload_json->>'campaign_key', '') = $2
         AND created_at >= now() - interval '7 days'
       GROUP BY 1
       ORDER BY item_count DESC, bucket_key ASC
       LIMIT 8;`,
      [target, key]
    ),
    client.query(
      `SELECT
         COALESCE(NULLIF(payload_json->>'segment_key', ''), 'unknown') AS bucket_key,
         COUNT(*)::bigint AS item_count
       FROM admin_audit
       WHERE target = $1
         AND action = 'live_ops_campaign_ops_alert'
         AND COALESCE(payload_json->>'campaign_key', '') = $2
         AND created_at >= now() - interval '7 days'
       GROUP BY 1
       ORDER BY item_count DESC, bucket_key ASC
       LIMIT 8;`,
      [target, key]
    ),
    client.query(
      `SELECT
         COALESCE(NULLIF(payload_json->>'surface_bucket', ''), 'unknown') AS bucket_key,
         COUNT(*)::bigint AS item_count
       FROM admin_audit
       WHERE target = $1
         AND action = 'live_ops_campaign_ops_alert'
         AND COALESCE(payload_json->>'campaign_key', '') = $2
         AND created_at >= now() - interval '7 days'
       GROUP BY 1
       ORDER BY item_count DESC, bucket_key ASC
       LIMIT 8;`,
      [target, key]
    ),
    client.query(
      `SELECT
         COALESCE(NULLIF(payload_json->>'variant_bucket', ''), 'unknown') AS bucket_key,
         COUNT(*)::bigint AS item_count
       FROM admin_audit
       WHERE target = $1
         AND action = 'live_ops_campaign_ops_alert'
         AND COALESCE(payload_json->>'campaign_key', '') = $2
         AND created_at >= now() - interval '7 days'
       GROUP BY 1
       ORDER BY item_count DESC, bucket_key ASC
       LIMIT 8;`,
      [target, key]
    ),
    client.query(
      `SELECT
         COALESCE(NULLIF(payload_json->>'cohort_bucket', ''), 'unknown') AS bucket_key,
         COUNT(*)::bigint AS item_count
       FROM admin_audit
       WHERE target = $1
         AND action = 'live_ops_campaign_ops_alert'
         AND COALESCE(payload_json->>'campaign_key', '') = $2
         AND created_at >= now() - interval '7 days'
       GROUP BY 1
       ORDER BY item_count DESC, bucket_key ASC
       LIMIT 8;`,
      [target, key]
    )
  ]);

  const totals = totalsResult.rows[0] || {};
  const latest = latestResult.rows[0] || {};
  const latestPayload = latest.payload_json && typeof latest.payload_json === "object" && !Array.isArray(latest.payload_json)
    ? latest.payload_json
    : {};
  return {
    raised_24h: Math.max(0, Number(totals.raised_24h || 0)),
    raised_7d: Math.max(0, Number(totals.raised_7d || 0)),
    telegram_sent_24h: Math.max(0, Number(totals.telegram_sent_24h || 0)),
    telegram_sent_7d: Math.max(0, Number(totals.telegram_sent_7d || 0)),
    effective_cap_delta_24h: Math.max(0, Number(totals.effective_cap_delta_24h || 0)),
    effective_cap_delta_7d: Math.max(0, Number(totals.effective_cap_delta_7d || 0)),
    experiment_key: String(latestPayload.experiment_key || "webapp_react_v1"),
    latest_alert_at: latest.created_at || null,
    latest_alarm_state: String(latestPayload.alarm_state || "clear"),
    latest_notification_reason: String(latestPayload.notification_reason || ""),
    latest_telegram_sent_at: latestPayload.telegram_sent === true
      ? String(latestPayload.telegram_sent_at || "").trim() || null
      : null,
    latest_effective_cap_delta: Math.max(0, Number(latestPayload.effective_cap_delta || 0)),
    max_effective_cap_delta_7d: Math.max(0, Number(totals.max_effective_cap_delta_7d || 0)),
    daily_breakdown: normalizeOpsAlertDailyRows(dailyResult.rows),
    reason_breakdown: normalizeBreakdownRows(reasonResult.rows),
    locale_breakdown: normalizeBreakdownRows(localeResult.rows),
    segment_breakdown: normalizeBreakdownRows(segmentResult.rows),
    surface_breakdown: normalizeBreakdownRows(surfaceResult.rows),
    variant_breakdown: normalizeBreakdownRows(variantResult.rows),
    cohort_breakdown: normalizeBreakdownRows(cohortResult.rows)
  };
}

async function loadOperatorTimeline(client, campaignKey) {
  const result = await client.query(
    `SELECT admin_id, action, payload_json, created_at
     FROM admin_audit
     WHERE target = $1
       AND action IN (
         'live_ops_campaign_save',
         'live_ops_campaign_request',
         'live_ops_campaign_approve',
         'live_ops_campaign_revoke',
         'live_ops_campaign_scheduler_skip',
         'live_ops_campaign_ops_alert',
         'live_ops_campaign_dry_run',
         'live_ops_campaign_dispatch'
       )
       AND COALESCE(payload_json->>'campaign_key', '') = $2
     ORDER BY created_at DESC
     LIMIT 12;`,
    [`config:${LIVE_OPS_CAMPAIGN_CONFIG_KEY}`, String(campaignKey || "")]
  );
  return result.rows.map((row) => {
    const payload = row.payload_json && typeof row.payload_json === "object" && !Array.isArray(row.payload_json) ? row.payload_json : {};
    const action = String(row.action || "live_ops_campaign_save");
    return {
      action,
      created_at: row.created_at || null,
      admin_id: Number(row.admin_id || 0),
      campaign_key: String(payload.campaign_key || campaignKey || ""),
      campaign_version: Number(payload.version || payload.campaign_version || 0),
      reason: String(payload.reason || ""),
      enabled: payload.enabled === true,
      status: String(payload.status || "draft"),
      approval_state: String(payload.approval_state || LIVE_OPS_APPROVAL_STATE.NOT_REQUESTED),
      schedule_state: String(payload.schedule_state || "missing"),
      dispatch_ref: String(payload.dispatch_ref || ""),
      dispatch_source: String(payload.dispatch_source || "manual"),
      window_key: String(payload.window_key || ""),
      dry_run: action === "live_ops_campaign_dry_run" || payload.dry_run === true
    };
  });
}

async function loadLatestSchedulerDispatch(client, campaignKey) {
  const result = await client.query(
    `SELECT admin_id, action, payload_json, created_at
     FROM admin_audit
     WHERE target = $1
       AND action = 'live_ops_campaign_dispatch'
       AND COALESCE(payload_json->>'campaign_key', '') = $2
       AND COALESCE(payload_json->>'dispatch_source', 'manual') = 'scheduler'
     ORDER BY created_at DESC
     LIMIT 1;`,
    [`config:${LIVE_OPS_CAMPAIGN_CONFIG_KEY}`, String(campaignKey || "")]
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  const payload = row.payload_json && typeof row.payload_json === "object" && !Array.isArray(row.payload_json) ? row.payload_json : {};
  return {
    created_at: row.created_at || null,
    dispatch_ref: String(payload.dispatch_ref || ""),
    reason: String(payload.reason || ""),
    window_key: String(payload.window_key || ""),
    admin_id: Number(row.admin_id || 0)
  };
}

async function loadSchedulerWindowDispatch(client, campaignKey, windowKey) {
  if (!windowKey) {
    return null;
  }
  const result = await client.query(
    `SELECT admin_id, payload_json, created_at
     FROM admin_audit
     WHERE target = $1
       AND action = 'live_ops_campaign_dispatch'
       AND COALESCE(payload_json->>'campaign_key', '') = $2
       AND COALESCE(payload_json->>'dispatch_source', 'manual') = 'scheduler'
       AND COALESCE(payload_json->>'window_key', '') = $3
     ORDER BY created_at DESC
     LIMIT 1;`,
    [`config:${LIVE_OPS_CAMPAIGN_CONFIG_KEY}`, String(campaignKey || ""), String(windowKey || "")]
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  const payload = row.payload_json && typeof row.payload_json === "object" && !Array.isArray(row.payload_json) ? row.payload_json : {};
  return {
    created_at: row.created_at || null,
    dispatch_ref: String(payload.dispatch_ref || ""),
    reason: String(payload.reason || ""),
    window_key: String(payload.window_key || ""),
    admin_id: Number(row.admin_id || 0)
  };
}

function buildEmptySceneRuntimeSummary() {
  return {
    ready_24h: 0,
    failed_24h: 0,
    total_24h: 0,
    low_end_24h: 0,
    ready_rate_24h: 0,
    failure_rate_24h: 0,
    low_end_share_24h: 0,
    avg_loaded_bundles_24h: 0,
    health_band_24h: "no_data",
    ready_rate_7d_avg: 0,
    failure_rate_7d_avg: 0,
    low_end_share_7d_avg: 0,
    trend_direction_7d: "no_data",
    trend_delta_ready_rate_7d: 0,
    alarm_state_7d: "no_data",
    alarm_reasons_7d: [],
    band_breakdown_7d: [],
    quality_breakdown_24h: [],
    perf_breakdown_24h: [],
    daily_breakdown_7d: [],
    worst_day_7d: null
  };
}

function buildEmptyLiveOpsTaskSummary() {
  return {
    artifact_found: false,
    artifact_path: "",
    artifact_generated_at: null,
    artifact_age_min: null,
    ok: false,
    skipped: false,
    reason: "",
    dispatch_ref: "",
    dispatch_source: "",
    scene_gate_state: "no_data",
    scene_gate_effect: "open",
    scene_gate_reason: "",
    scene_gate_recipient_cap: 0,
    recommended_recipient_cap: 0,
    effective_cap_delta: 0,
    recommendation_pressure_band: "clear",
    recommendation_reason: "",
    targeting_guidance_default_mode: "balanced",
    targeting_guidance_state: "clear",
    targeting_guidance_cap: 0,
    targeting_guidance_reason: "",
    selection_summary: {
      guidance_mode: "balanced",
      guidance_state: "clear",
      guidance_reason: "",
      focus_dimension: "",
      focus_bucket: "",
      focus_matches_target: false,
      prioritized_candidates: 0,
      selected_candidates: 0,
      prioritized_focus_matches: 0,
      selected_focus_matches: 0,
      prioritized_top_locale_matches: 0,
      selected_top_locale_matches: 0,
      prioritized_top_variant_matches: 0,
      selected_top_variant_matches: 0,
      prioritized_top_cohort_matches: 0,
      selected_top_cohort_matches: 0,
      query_strategy_summary: buildLiveOpsCandidateQueryStrategySummary(),
      prefilter_summary: buildLiveOpsCandidatePrefilterSummary()
    },
    selection_trend: buildEmptyLiveOpsSelectionTrendSummary(),
    window_key: "",
    scheduler_skip_24h: 0,
    scheduler_skip_7d: 0,
    scheduler_skip_alarm_state: "clear",
    scheduler_skip_alarm_reason: ""
  };
}

function findGuidanceModeRow(targetingGuidance, modeKey) {
  const rows = Array.isArray(targetingGuidance?.mode_rows) ? targetingGuidance.mode_rows : [];
  const safeMode = String(modeKey || "").trim().toLowerCase();
  return rows.find((row) => String(row?.mode_key || "").trim().toLowerCase() === safeMode) || null;
}

function buildEmptyLiveOpsOpsAlertSummary() {
  return {
    artifact_found: false,
    artifact_path: "",
    artifact_generated_at: null,
    artifact_age_min: null,
    alarm_state: "clear",
    should_notify: false,
    notification_reason: "",
    fingerprint: "",
    pressure_focus_escalation_band: "clear",
    pressure_focus_escalation_reason: "",
    pressure_focus_escalation_dimension: "",
    pressure_focus_escalation_bucket: "",
    pressure_focus_escalation_share: 0,
    pressure_focus_effective_delta_ratio: 0,
    selection_family_escalation_band: "clear",
    selection_family_escalation_reason: "",
    selection_family_escalation_dimension: "",
    selection_family_escalation_bucket: "",
    selection_family_escalation_score: 0,
    selection_family_daily_weight: 0,
    selection_query_family_weight: 0,
    selection_segment_family_weight: 0,
    selection_query_family_match_days: 0,
    selection_segment_family_match_days: 0,
    selection_query_strategy_applied_24h: 0,
    selection_query_strategy_applied_7d: 0,
    selection_latest_query_strategy_reason: "",
    selection_latest_query_strategy_family: "",
    selection_latest_segment_strategy_reason: "",
    selection_latest_segment_strategy_family: "",
    selection_top_query_strategy_reason: "",
    selection_top_query_strategy_family: "",
    selection_top_query_strategy_reason_count: 0,
    selection_top_segment_strategy_reason: "",
    selection_top_segment_strategy_family: "",
    selection_top_segment_strategy_reason_count: 0,
    selection_query_adjustment_applied: false,
    selection_query_adjustment_count: 0,
    selection_query_adjustment_total_delta: 0,
    selection_query_adjustment_top_field: "",
    selection_query_adjustment_top_after_value: 0,
    selection_query_adjustment_top_delta: 0,
    selection_query_adjustment_top_direction: "",
    selection_query_adjustment_top_reason: "",
    selection_query_adjustment_escalation_band: "clear",
    selection_query_adjustment_escalation_reason: "",
    selection_query_adjustment_escalation_dimension: "",
    selection_query_adjustment_escalation_bucket: "",
    selection_query_adjustment_escalation_field: "",
    selection_query_adjustment_escalation_score: 0,
    selection_query_adjustment_daily_weight: 0,
    selection_query_adjustment_total_delta_weight: 0,
    selection_query_adjustment_top_delta_weight: 0,
    selection_query_adjustment_field_weight: 0,
    selection_query_adjustment_query_family_match_days: 0,
    selection_query_adjustment_segment_family_match_days: 0,
    telegram_sent: false,
    telegram_reason: "",
    telegram_sent_at: null
  };
}

function buildEmptyLiveOpsOpsAlertTrendSummary() {
  return {
    raised_24h: 0,
    raised_7d: 0,
    telegram_sent_24h: 0,
    telegram_sent_7d: 0,
    effective_cap_delta_24h: 0,
    effective_cap_delta_7d: 0,
    experiment_key: "webapp_react_v1",
    latest_alert_at: null,
    latest_alarm_state: "clear",
    latest_notification_reason: "",
    latest_telegram_sent_at: null,
    latest_effective_cap_delta: 0,
    max_effective_cap_delta_7d: 0,
    daily_breakdown: [],
    reason_breakdown: [],
    locale_breakdown: [],
    segment_breakdown: [],
    surface_breakdown: [],
    variant_breakdown: [],
    cohort_breakdown: []
  };
}

function buildEmptyLiveOpsSelectionTrendSummary() {
  return {
    dispatches_24h: 0,
    dispatches_7d: 0,
    query_strategy_applied_24h: 0,
    query_strategy_applied_7d: 0,
    prefilter_applied_24h: 0,
    prefilter_applied_7d: 0,
    prefilter_delta_24h: 0,
    prefilter_delta_7d: 0,
    prioritized_focus_matches_24h: 0,
    prioritized_focus_matches_7d: 0,
    selected_focus_matches_24h: 0,
    selected_focus_matches_7d: 0,
    query_adjustment_applied_24h: 0,
    query_adjustment_applied_7d: 0,
    query_adjustment_total_delta_24h: 0,
    query_adjustment_total_delta_7d: 0,
    latest_selection_at: null,
    latest_guidance_mode: "balanced",
    latest_focus_dimension: "",
    latest_focus_bucket: "",
    latest_query_strategy_reason: "",
    latest_query_strategy_family: "",
    latest_segment_strategy_reason: "",
    latest_segment_strategy_family: "",
    latest_query_adjustment_field: "",
    latest_query_adjustment_reason: "",
    latest_query_adjustment_total_delta: 0,
    latest_prefilter_reason: "",
    latest_family_risk_state: "clear",
    latest_family_risk_reason: "",
    latest_family_risk_dimension: "",
    latest_family_risk_bucket: "",
    latest_family_risk_score: 0,
    daily_breakdown: [],
    query_adjustment_daily_breakdown: [],
    query_strategy_family_daily_breakdown: [],
    query_adjustment_query_family_daily_breakdown: [],
    segment_strategy_family_daily_breakdown: [],
    query_adjustment_segment_family_daily_breakdown: [],
    family_risk_daily_breakdown: [],
    query_adjustment_field_breakdown: [],
    query_adjustment_reason_breakdown: [],
    query_strategy_reason_breakdown: [],
    query_strategy_family_breakdown: [],
    query_adjustment_query_family_breakdown: [],
    segment_strategy_reason_breakdown: [],
    query_adjustment_segment_family_breakdown: [],
    segment_strategy_family_breakdown: [],
    family_risk_band_breakdown: [],
    prefilter_reason_breakdown: []
  };
}

function toTaskAgeMinutes(now, stat) {
  if (!stat?.mtime) {
    return null;
  }
  const ageMinutes = ((now.getTime() - stat.mtime.getTime()) / 60000);
  if (!Number.isFinite(ageMinutes) || ageMinutes < 0) {
    return null;
  }
  return Number(ageMinutes.toFixed(2));
}

function readLatestTaskArtifactSummaryFromDisk(now, repoRootDir) {
  const artifactPaths = resolveLiveOpsDispatchArtifactPaths(repoRootDir || process.cwd());
  const empty = buildEmptyLiveOpsTaskSummary();
  if (!artifactPaths?.latestJsonPath || !fs.existsSync(artifactPaths.latestJsonPath)) {
    return empty;
  }

  try {
    const stat = fs.statSync(artifactPaths.latestJsonPath);
    const payload = JSON.parse(fs.readFileSync(artifactPaths.latestJsonPath, "utf8"));
    const scheduler = payload && typeof payload.scheduler_summary === "object" ? payload.scheduler_summary : {};
    const schedulerSkip = payload && typeof payload.scheduler_skip_summary === "object" ? payload.scheduler_skip_summary : {};
    const recommendation =
      scheduler && typeof scheduler.recipient_cap_recommendation === "object" ? scheduler.recipient_cap_recommendation : {};
    const targetingGuidance =
      payload && typeof payload.targeting_guidance_summary === "object"
        ? payload.targeting_guidance_summary
        : scheduler && typeof scheduler.targeting_guidance === "object"
          ? scheduler.targeting_guidance
          : {};
    const data = payload && typeof payload.data === "object" ? payload.data : {};
    const selectionSummary =
      payload && typeof payload.selection_summary === "object" && !Array.isArray(payload.selection_summary)
        ? payload.selection_summary
        : data && typeof data.selection_summary === "object" && !Array.isArray(data.selection_summary)
          ? data.selection_summary
          : {};
    const selectionTrendSummary =
      payload && typeof payload.selection_trend_summary === "object" && !Array.isArray(payload.selection_trend_summary)
        ? payload.selection_trend_summary
        : payload && typeof payload.selection_trend === "object" && !Array.isArray(payload.selection_trend)
          ? payload.selection_trend
          : {};
    const selectedMode = String(targetingGuidance?.default_mode || data?.recommendation_mode || "balanced").trim() || "balanced";
    const selectedModeRow = findGuidanceModeRow(targetingGuidance, selectedMode);
    return {
      artifact_found: true,
      artifact_path: artifactPaths.latestJsonPath,
      artifact_generated_at: String(payload.generated_at || data.generated_at || "").trim() || null,
      artifact_age_min: toTaskAgeMinutes(now, stat),
      ok: payload?.ok === true,
      skipped: payload?.skipped === true,
      reason: String(payload?.reason || "").trim(),
      dispatch_ref: String(data?.dispatch_ref || "").trim(),
      dispatch_source: String(data?.dispatch_source || "").trim(),
      scene_gate_state: String(scheduler?.scene_gate_state || data?.scene_gate_state || "no_data").trim() || "no_data",
      scene_gate_effect: String(scheduler?.scene_gate_effect || data?.scene_gate_effect || "open").trim() || "open",
      scene_gate_reason: String(scheduler?.scene_gate_reason || data?.scene_gate_reason || "").trim(),
      scene_gate_recipient_cap: Math.max(0, Number(scheduler?.scene_gate_recipient_cap || data?.scene_gate_recipient_cap || 0) || 0),
      recommended_recipient_cap: Math.max(0, Number(recommendation?.recommended_recipient_cap || 0) || 0),
      effective_cap_delta: Math.max(0, Number(recommendation?.effective_cap_delta || 0) || 0),
      recommendation_pressure_band: String(recommendation?.pressure_band || "clear").trim() || "clear",
      recommendation_reason: String(recommendation?.reason || "").trim(),
      targeting_guidance_default_mode: selectedMode,
      targeting_guidance_state: String(targetingGuidance?.guidance_state || "clear").trim() || "clear",
      targeting_guidance_cap: Math.max(
        0,
        Number(
          selectedModeRow?.suggested_recipient_cap ||
          data?.recommendation_mode_cap ||
          targetingGuidance?.focus_suggested_recipient_cap ||
          0
        ) || 0
      ),
      targeting_guidance_reason: String(targetingGuidance?.guidance_reason || data?.recommendation_guidance_state || "").trim(),
      selection_summary: {
        guidance_mode: String(selectionSummary.guidance_mode || selectedMode).trim() || selectedMode,
        guidance_state: String(selectionSummary.guidance_state || targetingGuidance?.guidance_state || "clear").trim() || "clear",
        guidance_reason: String(selectionSummary.guidance_reason || targetingGuidance?.guidance_reason || "").trim(),
        focus_dimension: String(selectionSummary.focus_dimension || "").trim(),
        focus_bucket: String(selectionSummary.focus_bucket || "").trim(),
        focus_matches_target: selectionSummary.focus_matches_target === true,
        prioritized_candidates: Math.max(0, Number(selectionSummary.prioritized_candidates || 0) || 0),
        selected_candidates: Math.max(0, Number(selectionSummary.selected_candidates || 0) || 0),
        prioritized_focus_matches: Math.max(0, Number(selectionSummary.prioritized_focus_matches || 0) || 0),
        selected_focus_matches: Math.max(0, Number(selectionSummary.selected_focus_matches || 0) || 0),
        prioritized_top_locale_matches: Math.max(0, Number(selectionSummary.prioritized_top_locale_matches || 0) || 0),
        selected_top_locale_matches: Math.max(0, Number(selectionSummary.selected_top_locale_matches || 0) || 0),
        prioritized_top_variant_matches: Math.max(0, Number(selectionSummary.prioritized_top_variant_matches || 0) || 0),
        selected_top_variant_matches: Math.max(0, Number(selectionSummary.selected_top_variant_matches || 0) || 0),
        prioritized_top_cohort_matches: Math.max(0, Number(selectionSummary.prioritized_top_cohort_matches || 0) || 0),
        selected_top_cohort_matches: Math.max(0, Number(selectionSummary.selected_top_cohort_matches || 0) || 0),
        query_strategy_summary: buildLiveOpsCandidateQueryStrategySummary(selectionSummary.query_strategy_summary),
        prefilter_summary: buildLiveOpsCandidatePrefilterSummary(selectionSummary.prefilter_summary)
      },
      selection_trend: normalizeSelectionTrendSummary(selectionTrendSummary),
      window_key: String(scheduler?.window_key || data?.window_key || "").trim(),
      scheduler_skip_24h: Math.max(0, Number(schedulerSkip?.skipped_24h || 0) || 0),
      scheduler_skip_7d: Math.max(0, Number(schedulerSkip?.skipped_7d || 0) || 0),
      scheduler_skip_alarm_state: String(schedulerSkip?.alarm_state || "clear").trim() || "clear",
      scheduler_skip_alarm_reason: String(schedulerSkip?.alarm_reason || "").trim()
    };
  } catch {
    return {
      ...empty,
      artifact_found: true,
      artifact_path: artifactPaths.latestJsonPath,
      reason: "task_artifact_invalid"
    };
  }
}

function readLatestOpsAlertArtifactSummaryFromDisk(now, repoRootDir) {
  const artifactPaths = resolveLiveOpsOpsAlertArtifactPaths(repoRootDir || process.cwd());
  const empty = buildEmptyLiveOpsOpsAlertSummary();
  if (!artifactPaths?.latestJsonPath || !fs.existsSync(artifactPaths.latestJsonPath)) {
    return empty;
  }

  try {
    const stat = fs.statSync(artifactPaths.latestJsonPath);
    const payload = JSON.parse(fs.readFileSync(artifactPaths.latestJsonPath, "utf8"));
    const evaluation = payload && typeof payload.evaluation === "object" ? payload.evaluation : {};
    const telegram = payload && typeof payload.telegram === "object" ? payload.telegram : {};
    return {
      artifact_found: true,
      artifact_path: artifactPaths.latestJsonPath,
      artifact_generated_at: String(payload.generated_at || "").trim() || null,
      artifact_age_min: toTaskAgeMinutes(now, stat),
      alarm_state: String(evaluation.alarm_state || "clear").trim() || "clear",
      should_notify: evaluation.should_notify === true,
      notification_reason: String(evaluation.notification_reason || "").trim(),
      fingerprint: String(evaluation.fingerprint || "").trim(),
      pressure_focus_escalation_band: String(evaluation.pressure_focus_escalation_band || "clear").trim() || "clear",
      pressure_focus_escalation_reason: String(evaluation.pressure_focus_escalation_reason || "").trim(),
      pressure_focus_escalation_dimension: String(evaluation.pressure_focus_escalation_dimension || "").trim(),
      pressure_focus_escalation_bucket: String(evaluation.pressure_focus_escalation_bucket || "").trim(),
      pressure_focus_escalation_share: Math.max(0, Number(evaluation.pressure_focus_escalation_share || 0)),
      pressure_focus_effective_delta_ratio: Math.max(0, Number(evaluation.pressure_focus_effective_delta_ratio || 0)),
      selection_family_escalation_band: String(evaluation.selection_family_escalation_band || "clear").trim() || "clear",
      selection_family_escalation_reason: String(evaluation.selection_family_escalation_reason || "").trim(),
      selection_family_escalation_dimension: String(evaluation.selection_family_escalation_dimension || "").trim(),
      selection_family_escalation_bucket: String(evaluation.selection_family_escalation_bucket || "").trim(),
      selection_family_escalation_score: Math.max(0, Number(evaluation.selection_family_escalation_score || 0)),
      selection_family_daily_weight: Math.max(0, Number(evaluation.selection_family_daily_weight || 0)),
      selection_query_family_weight: Math.max(0, Number(evaluation.selection_query_family_weight || 0)),
      selection_segment_family_weight: Math.max(0, Number(evaluation.selection_segment_family_weight || 0)),
      selection_query_family_match_days: Math.max(0, Number(evaluation.selection_query_family_match_days || 0)),
      selection_segment_family_match_days: Math.max(0, Number(evaluation.selection_segment_family_match_days || 0)),
      selection_query_strategy_applied_24h: Math.max(0, Number(evaluation.selection_query_strategy_applied_24h || 0)),
      selection_query_strategy_applied_7d: Math.max(0, Number(evaluation.selection_query_strategy_applied_7d || 0)),
      selection_latest_query_strategy_reason: String(evaluation.selection_latest_query_strategy_reason || "").trim(),
      selection_latest_query_strategy_family: String(evaluation.selection_latest_query_strategy_family || "").trim(),
      selection_latest_segment_strategy_reason: String(evaluation.selection_latest_segment_strategy_reason || "").trim(),
      selection_latest_segment_strategy_family: String(evaluation.selection_latest_segment_strategy_family || "").trim(),
      selection_top_query_strategy_reason: String(evaluation.selection_top_query_strategy_reason || "").trim(),
      selection_top_query_strategy_family: String(evaluation.selection_top_query_strategy_family || "").trim(),
      selection_top_query_strategy_reason_count: Math.max(0, Number(evaluation.selection_top_query_strategy_reason_count || 0)),
      selection_top_segment_strategy_reason: String(evaluation.selection_top_segment_strategy_reason || "").trim(),
      selection_top_segment_strategy_family: String(evaluation.selection_top_segment_strategy_family || "").trim(),
      selection_top_segment_strategy_reason_count: Math.max(0, Number(evaluation.selection_top_segment_strategy_reason_count || 0)),
      selection_query_adjustment_applied: evaluation.selection_query_adjustment_applied === true,
      selection_query_adjustment_count: Math.max(0, Number(evaluation.selection_query_adjustment_count || 0)),
      selection_query_adjustment_total_delta: Math.max(0, Number(evaluation.selection_query_adjustment_total_delta || 0)),
      selection_query_adjustment_top_field: String(evaluation.selection_query_adjustment_top_field || "").trim(),
      selection_query_adjustment_top_after_value: Math.max(0, Number(evaluation.selection_query_adjustment_top_after_value || 0)),
      selection_query_adjustment_top_delta: Number(evaluation.selection_query_adjustment_top_delta || 0),
      selection_query_adjustment_top_direction: String(evaluation.selection_query_adjustment_top_direction || "").trim(),
      selection_query_adjustment_top_reason: String(evaluation.selection_query_adjustment_top_reason || "").trim(),
      selection_query_adjustment_escalation_band: String(evaluation.selection_query_adjustment_escalation_band || "clear").trim(),
      selection_query_adjustment_escalation_reason: String(evaluation.selection_query_adjustment_escalation_reason || "").trim(),
      selection_query_adjustment_escalation_dimension: String(evaluation.selection_query_adjustment_escalation_dimension || "").trim(),
      selection_query_adjustment_escalation_bucket: String(evaluation.selection_query_adjustment_escalation_bucket || "").trim(),
      selection_query_adjustment_escalation_field: String(evaluation.selection_query_adjustment_escalation_field || "").trim(),
      selection_query_adjustment_escalation_score: Math.max(0, Number(evaluation.selection_query_adjustment_escalation_score || 0)),
      selection_query_adjustment_daily_weight: Math.max(0, Number(evaluation.selection_query_adjustment_daily_weight || 0)),
      selection_query_adjustment_total_delta_weight: Math.max(0, Number(evaluation.selection_query_adjustment_total_delta_weight || 0)),
      selection_query_adjustment_top_delta_weight: Math.max(0, Number(evaluation.selection_query_adjustment_top_delta_weight || 0)),
      selection_query_adjustment_field_weight: Math.max(0, Number(evaluation.selection_query_adjustment_field_weight || 0)),
      selection_query_adjustment_query_family_match_days: Math.max(0, Number(evaluation.selection_query_adjustment_query_family_match_days || 0)),
      selection_query_adjustment_segment_family_match_days: Math.max(0, Number(evaluation.selection_query_adjustment_segment_family_match_days || 0)),
      telegram_sent: telegram.sent === true,
      telegram_reason: String(telegram.reason || "").trim(),
      telegram_sent_at: String(telegram.sent_at || "").trim() || null
    };
  } catch {
    return {
      ...empty,
      artifact_found: true,
      artifact_path: artifactPaths.latestJsonPath,
      notification_reason: "ops_alert_artifact_invalid"
    };
  }
}

function buildSchedulerSummary(
  campaign,
  approvalSummary,
  latestSchedulerDispatch,
  windowDispatch,
  sceneRuntimeSummary,
  schedulerSkipSummary,
  opsAlertTrendSummary
) {
  const sceneGate = resolveLiveOpsSceneGate(sceneRuntimeSummary, campaign);
  const recipientCapRecommendation = resolveLiveOpsRecipientCapRecommendation(
    sceneRuntimeSummary,
    campaign,
    schedulerSkipSummary,
    opsAlertTrendSummary
  );
  const pressureFocus = resolveLiveOpsPressureFocus(
    opsAlertTrendSummary,
    campaign,
    recipientCapRecommendation
  );
  const pressureEscalation = resolveLiveOpsPressureEscalation(
    pressureFocus,
    recipientCapRecommendation
  );
  const targetingGuidance = resolveLiveOpsTargetingGuidance(
    pressureFocus,
    recipientCapRecommendation,
    pressureEscalation
  );
  return {
    ready_for_auto_dispatch: approvalSummary?.live_dispatch_ready === true && sceneGate.ready_for_auto_dispatch === true,
    schedule_state: String(approvalSummary?.schedule_state || "missing"),
    approval_state: String(approvalSummary?.approval_state || LIVE_OPS_APPROVAL_STATE.NOT_REQUESTED),
    scene_gate_state: sceneGate.scene_gate_state,
    scene_gate_effect: sceneGate.scene_gate_effect,
    scene_gate_reason: sceneGate.scene_gate_reason,
    scene_gate_recipient_cap: sceneGate.scene_gate_recipient_cap,
    recipient_cap_recommendation: recipientCapRecommendation,
    targeting_guidance: targetingGuidance,
    window_key: buildScheduleWindowKey(campaign),
    already_dispatched_for_window: Boolean(windowDispatch),
    latest_auto_dispatch_at: latestSchedulerDispatch?.created_at || null,
    latest_auto_dispatch_ref: String(latestSchedulerDispatch?.dispatch_ref || ""),
    latest_auto_dispatch_reason: String(latestSchedulerDispatch?.reason || "")
  };
}

async function loadSceneRuntimeSummary(client) {
  try {
    const result = await client.query(
      `WITH scoped AS (
         SELECT event_key, payload_json, created_at
         FROM v5_webapp_ui_events
         WHERE created_at >= now() - interval '24 hours'
           AND event_key IN ('runtime.scene.ready', 'runtime.scene.failed')
       )
       SELECT
         COUNT(*) FILTER (WHERE event_key = 'runtime.scene.ready')::bigint AS ready_24h,
         COUNT(*) FILTER (WHERE event_key = 'runtime.scene.failed')::bigint AS failed_24h,
         COUNT(*) FILTER (
           WHERE COALESCE(lower(payload_json->>'low_end_mode'), 'false') IN ('true', '1', 'yes', 'on')
         )::bigint AS low_end_24h,
         COALESCE(
           AVG(
             CASE
               WHEN jsonb_typeof(payload_json->'loaded_bundles') = 'array'
                 THEN jsonb_array_length(payload_json->'loaded_bundles')
               ELSE NULL
             END
           ),
           0
         )::numeric AS avg_loaded_bundles_24h,
         (
           SELECT COALESCE(
             json_agg(
               json_build_object(
                 'day', day,
                 'total_count', total_count,
                 'ready_count', ready_count,
                 'failed_count', failed_count,
                 'low_end_count', low_end_count
               )
               ORDER BY day DESC
             ),
             '[]'::json
           )
           FROM (
             SELECT
               to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
               COUNT(*)::int AS total_count,
               COUNT(*) FILTER (WHERE event_key = 'runtime.scene.ready')::int AS ready_count,
               COUNT(*) FILTER (WHERE event_key = 'runtime.scene.failed')::int AS failed_count,
               COUNT(*) FILTER (
                 WHERE COALESCE(lower(payload_json->>'low_end_mode'), 'false') IN ('true', '1', 'yes', 'on')
               )::int AS low_end_count
             FROM v5_webapp_ui_events
             WHERE created_at >= now() - interval '7 days'
               AND event_key IN ('runtime.scene.ready', 'runtime.scene.failed')
             GROUP BY 1
             ORDER BY day DESC
             LIMIT 7
           ) daily_rows
         ) AS daily_breakdown_7d,
         (
           SELECT COALESCE(
             json_agg(json_build_object('bucket_key', bucket_key, 'item_count', item_count) ORDER BY item_count DESC, bucket_key),
             '[]'::json
           )
           FROM (
             SELECT COALESCE(NULLIF(lower(payload_json->>'effective_quality'), ''), 'unknown') AS bucket_key,
                    COUNT(*)::int AS item_count
             FROM scoped
             GROUP BY 1
             ORDER BY item_count DESC, bucket_key
             LIMIT 6
           ) quality_rows
         ) AS quality_breakdown_24h,
         (
           SELECT COALESCE(
             json_agg(json_build_object('bucket_key', bucket_key, 'item_count', item_count) ORDER BY item_count DESC, bucket_key),
             '[]'::json
           )
           FROM (
             SELECT COALESCE(NULLIF(lower(payload_json->>'perf_tier'), ''), 'unknown') AS bucket_key,
                    COUNT(*)::int AS item_count
             FROM scoped
             GROUP BY 1
             ORDER BY item_count DESC, bucket_key
             LIMIT 6
           ) perf_rows
         ) AS perf_breakdown_24h
       FROM scoped;`
    );
    const row = result.rows[0] || {};
    const ready24h = Math.max(0, Number(row.ready_24h || 0));
    const failed24h = Math.max(0, Number(row.failed_24h || 0));
    const lowEnd24h = Math.max(0, Number(row.low_end_24h || 0));
    const total24h = ready24h + failed24h;
    const readyRate24h = toRate(ready24h, total24h);
    const failureRate24h = toRate(failed24h, total24h);
    const lowEndShare24h = toRate(lowEnd24h, total24h);
    const dailyRows = normalizeSceneDailyRows(row.daily_breakdown_7d, 7);
    const readyRate7dAvg = dailyRows.length
      ? Number((dailyRows.reduce((sum, entry) => sum + Number(entry.ready_rate || 0), 0) / dailyRows.length).toFixed(4))
      : 0;
    const failureRate7dAvg = dailyRows.length
      ? Number((dailyRows.reduce((sum, entry) => sum + Number(entry.failure_rate || 0), 0) / dailyRows.length).toFixed(4))
      : 0;
    const lowEndShare7dAvg = dailyRows.length
      ? Number((dailyRows.reduce((sum, entry) => sum + Number(entry.low_end_share || 0), 0) / dailyRows.length).toFixed(4))
      : 0;
    const latestRow = dailyRows[0] || null;
    const earliestRow = dailyRows[dailyRows.length - 1] || null;
    const trendDirection = resolveSceneTrendDirection(
      Number(latestRow?.ready_rate || 0),
      Number(earliestRow?.ready_rate || 0),
      dailyRows.length
    );
    const trendDelta = latestRow && earliestRow
      ? Number((Number(latestRow.ready_rate || 0) - Number(earliestRow.ready_rate || 0)).toFixed(4))
      : 0;
    const worstDay = dailyRows.reduce((worst, rowEntry) => {
      if (!worst) {
        return rowEntry;
      }
      const currentFail = Number(rowEntry.failure_rate || 0);
      const worstFail = Number(worst.failure_rate || 0);
      if (currentFail > worstFail) {
        return rowEntry;
      }
      if (currentFail === worstFail && Number(rowEntry.total_count || 0) > Number(worst.total_count || 0)) {
        return rowEntry;
      }
      return worst;
    }, null);
    return {
      ready_24h: ready24h,
      failed_24h: failed24h,
      total_24h: total24h,
      low_end_24h: lowEnd24h,
      ready_rate_24h: readyRate24h,
      failure_rate_24h: failureRate24h,
      low_end_share_24h: lowEndShare24h,
      avg_loaded_bundles_24h: Number(Number(row.avg_loaded_bundles_24h || 0).toFixed(2)),
      health_band_24h: resolveSceneRuntimeHealthBand(readyRate24h, total24h, failed24h),
      ready_rate_7d_avg: readyRate7dAvg,
      failure_rate_7d_avg: failureRate7dAvg,
      low_end_share_7d_avg: lowEndShare7dAvg,
      trend_direction_7d: trendDirection,
      trend_delta_ready_rate_7d: trendDelta,
      alarm_state_7d: resolveSceneAlarmState(dailyRows),
      alarm_reasons_7d: buildSceneAlarmReasons(dailyRows),
      band_breakdown_7d: buildSceneBandBreakdown(dailyRows),
      quality_breakdown_24h: normalizeBreakdownRows(row.quality_breakdown_24h),
      perf_breakdown_24h: normalizeBreakdownRows(row.perf_breakdown_24h),
      daily_breakdown_7d: dailyRows,
      worst_day_7d: worstDay
        ? {
            day: String(worstDay.day || ""),
            total_count: Math.max(0, Number(worstDay.total_count || 0)),
            ready_count: Math.max(0, Number(worstDay.ready_count || 0)),
            failed_count: Math.max(0, Number(worstDay.failed_count || 0)),
            low_end_count: Math.max(0, Number(worstDay.low_end_count || 0)),
            ready_rate: Number(worstDay.ready_rate || 0),
            failure_rate: Number(worstDay.failure_rate || 0),
            low_end_share: Number(worstDay.low_end_share || 0),
            health_band: String(worstDay.health_band || "no_data")
          }
        : null
    };
  } catch (err) {
    if (err.code === "42P01" || err.code === "42703") {
      return buildEmptySceneRuntimeSummary();
    }
    throw err;
  }
}

async function buildCampaignSnapshot(client, current) {
  const snapshotState = current || (await loadLatestConfig(client));
  const latestDispatch = await loadLatestDispatchSummary(client, snapshotState.campaign.campaign_key);
  const approvalSummary = buildApprovalSummary(snapshotState.campaign, {
    updated_at: snapshotState.created_at || null,
    last_dispatch_at: latestDispatch.last_sent_at || null
  });
  const currentWindowKey = buildScheduleWindowKey(snapshotState.campaign);
  const [
    versionHistory,
    dispatchHistory,
    operatorTimeline,
    deliverySummary,
    schedulerSkipSummary,
    latestSchedulerDispatch,
    schedulerWindowDispatch,
    sceneRuntimeSummary,
    taskSummary,
    opsAlertSummary,
    opsAlertTrendSummary,
    selectionTrendSummary
  ] = await Promise.all([
    loadVersionHistory(client),
    loadDispatchHistory(client, snapshotState.campaign.campaign_key),
    loadOperatorTimeline(client, snapshotState.campaign.campaign_key),
    loadDeliverySummary(client, snapshotState.campaign.campaign_key),
    loadSchedulerSkipSummary(client, snapshotState.campaign.campaign_key),
    loadLatestSchedulerDispatch(client, snapshotState.campaign.campaign_key),
    loadSchedulerWindowDispatch(client, snapshotState.campaign.campaign_key, currentWindowKey),
    loadSceneRuntimeSummary(client),
    readLatestTaskArtifactSummary(),
    readLatestOpsAlertArtifactSummary(),
    loadOpsAlertTrendSummary(client, snapshotState.campaign.campaign_key).catch((err) => {
      if (err?.code === "42P01" || err?.code === "42703") {
        return buildEmptyLiveOpsOpsAlertTrendSummary();
      }
      throw err;
    }),
    loadSelectionTrendSummary(client, snapshotState.campaign.campaign_key).catch((err) => {
      if (err?.code === "42P01" || err?.code === "42703") {
        return buildEmptyLiveOpsSelectionTrendSummary();
      }
      throw err;
    })
  ]);
  return {
    api_version: "v2",
    config_key: LIVE_OPS_CAMPAIGN_CONFIG_KEY,
    version: snapshotState.version,
    updated_at: snapshotState.created_at,
    updated_by: snapshotState.created_by,
    campaign: snapshotState.campaign,
    approval_summary: approvalSummary,
    scheduler_summary: buildSchedulerSummary(
      snapshotState.campaign,
      approvalSummary,
      latestSchedulerDispatch,
      schedulerWindowDispatch,
      sceneRuntimeSummary,
      schedulerSkipSummary,
      opsAlertTrendSummary
    ),
    version_history: versionHistory,
    dispatch_history: dispatchHistory,
    operator_timeline: operatorTimeline,
    delivery_summary: deliverySummary,
    scheduler_skip_summary: schedulerSkipSummary,
    scene_runtime_summary: sceneRuntimeSummary,
    task_summary: taskSummary,
    ops_alert_summary: opsAlertSummary,
    ops_alert_trend_summary: opsAlertTrendSummary,
    selection_trend_summary: selectionTrendSummary,
    latest_dispatch: latestDispatch
  };
}

  async function getCampaignSnapshot() {
    const client = await pool.connect();
    try {
      return await buildCampaignSnapshot(client);
    } finally {
      client.release();
    }
  }

  async function saveCampaignConfig(input = {}) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const current = await loadLatestConfig(client);
      const nextVersion = current.version + 1;
      const adminId = Number(input.adminId || 0);
      const reason = String(input.reason || "live_ops_campaign_update").trim().slice(0, 240);
      const campaign = buildPersistedCampaign(current.campaign, input.campaign || {});
      const nowIso = nowFactory().toISOString();
      await client.query(
        `INSERT INTO config_versions (config_key, version, config_json, created_by)
         VALUES ($1, $2, $3::jsonb, $4);`,
        [LIVE_OPS_CAMPAIGN_CONFIG_KEY, nextVersion, JSON.stringify(campaign), adminId]
      );
      await client.query(
        `INSERT INTO admin_audit (admin_id, action, target, payload_json)
         VALUES ($1, 'live_ops_campaign_save', $2, $3::jsonb);`,
        [
          adminId,
          `config:${LIVE_OPS_CAMPAIGN_CONFIG_KEY}`,
          JSON.stringify(buildCampaignAuditPayload(campaign, { now: new Date(nowIso), reason, version: nextVersion }))
        ]
      );
      const snapshot = await buildCampaignSnapshot(client, {
        version: nextVersion,
        created_at: nowIso,
        created_by: adminId,
        campaign
      });
      await client.query("COMMIT");
      logger("info", {
        event: "live_ops_campaign_saved",
        admin_id: adminId,
        version: nextVersion,
        campaign_key: campaign.campaign_key,
        reason
      });
      return snapshot;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => null);
      throw err;
    } finally {
      client.release();
    }
  }

  async function updateCampaignApproval(input = {}) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const current = await loadLatestConfig(client);
      const nextVersion = current.version + 1;
      const adminId = Number(input.adminId || 0);
      const reason = String(input.reason || "live_ops_campaign_approval_update").trim().slice(0, 240);
      const approvalAction = String(input.approvalAction || "").trim().toLowerCase();
      const nowIso = nowFactory().toISOString();
      const baseCampaign = buildPersistedCampaign(current.campaign, input.campaign || {});
      const nextApproval = {
        ...(baseCampaign.approval || {}),
        required: baseCampaign.approval?.required !== false,
        last_action_by: adminId,
        last_action_at: nowIso,
        note: reason
      };

      if (approvalAction === "request") {
        nextApproval.state = LIVE_OPS_APPROVAL_STATE.PENDING;
        nextApproval.requested_by = adminId;
        nextApproval.requested_at = nowIso;
      } else if (approvalAction === "approve") {
        nextApproval.state = LIVE_OPS_APPROVAL_STATE.APPROVED;
        nextApproval.approved_by = adminId;
        nextApproval.approved_at = nowIso;
        if (!nextApproval.requested_at) {
          nextApproval.requested_at = nowIso;
          nextApproval.requested_by = adminId;
        }
      } else if (approvalAction === "revoke") {
        nextApproval.state = LIVE_OPS_APPROVAL_STATE.REVOKED;
      } else {
        throw new Error("invalid_approval_action");
      }

      const campaign = buildPersistedCampaign(baseCampaign, {
        approval: nextApproval
      });

      await client.query(
        `INSERT INTO config_versions (config_key, version, config_json, created_by)
         VALUES ($1, $2, $3::jsonb, $4);`,
        [LIVE_OPS_CAMPAIGN_CONFIG_KEY, nextVersion, JSON.stringify(campaign), adminId]
      );
      await client.query(
        `INSERT INTO admin_audit (admin_id, action, target, payload_json)
         VALUES ($1, $2, $3, $4::jsonb);`,
        [
          adminId,
          `live_ops_campaign_${approvalAction}`,
          `config:${LIVE_OPS_CAMPAIGN_CONFIG_KEY}`,
          JSON.stringify(buildCampaignAuditPayload(campaign, { now: new Date(nowIso), reason, version: nextVersion }))
        ]
      );
      const snapshot = await buildCampaignSnapshot(client, {
        version: nextVersion,
        created_at: nowIso,
        created_by: adminId,
        campaign
      });
      await client.query("COMMIT");
      logger("info", {
        event: "live_ops_campaign_approval_updated",
        admin_id: adminId,
        version: nextVersion,
        campaign_key: campaign.campaign_key,
        approval_action: approvalAction
      });
      return snapshot;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => null);
      throw err;
    } finally {
      client.release();
    }
  }

  async function recordDispatchEvent(client, userId, payload) {
    await client.query(
      `INSERT INTO behavior_events (user_id, event_type, meta_json)
       VALUES ($1, $2, $3::jsonb);`,
      [userId, LIVE_OPS_CAMPAIGN_EVENT_TYPE, JSON.stringify(payload)]
    );
  }

  async function dispatchCampaign(input = {}) {
    if (!isEnabled()) {
      return { ok: false, reason: "service_disabled" };
    }

    const client = await pool.connect();
    try {
      const snapshot = await loadLatestConfig(client);
      const campaign = buildDefaultLiveOpsCampaignConfig(input.campaign || snapshot.campaign);
      const version = input.campaign ? snapshot.version : snapshot.version;
      const dryRun = input.dryRun !== false;
      const adminId = Number(input.adminId || 0);
      const reason = String(input.reason || "live_ops_campaign_dispatch").trim().slice(0, 240);
      const dispatchSource = String(input.dispatchSource || "manual").trim().toLowerCase() === "scheduler" ? "scheduler" : "manual";
      const windowKey = String(input.windowKey || buildScheduleWindowKey(campaign) || "");
      const [sceneRuntimeSummary, schedulerSkipSummary, opsAlertTrendSummary, selectionTrendSummary] =
        dispatchSource === "scheduler"
          ? await Promise.all([
              loadSceneRuntimeSummary(client),
              loadSchedulerSkipSummary(client, campaign.campaign_key),
              loadOpsAlertTrendSummary(client, campaign.campaign_key).catch((err) => {
                if (err?.code === "42P01" || err?.code === "42703") {
                  return buildEmptyLiveOpsOpsAlertTrendSummary();
                }
                throw err;
              }),
              loadSelectionTrendSummary(client, campaign.campaign_key).catch((err) => {
                if (err?.code === "42P01" || err?.code === "42703") {
                  return buildEmptyLiveOpsSelectionTrendSummary();
                }
                throw err;
              })
            ])
          : [
              buildEmptySceneRuntimeSummary(),
              buildSchedulerSkipAlarmSummary(),
              buildEmptyLiveOpsOpsAlertTrendSummary(),
              buildEmptyLiveOpsSelectionTrendSummary()
            ];
      const sceneGate = resolveLiveOpsSceneGate(sceneRuntimeSummary, campaign);
      const recipientCapRecommendation = resolveLiveOpsRecipientCapRecommendation(
        sceneRuntimeSummary,
        campaign,
        schedulerSkipSummary,
        opsAlertTrendSummary
      );
      const pressureFocus = resolveLiveOpsPressureFocus(
        opsAlertTrendSummary,
        campaign,
        recipientCapRecommendation
      );
      const pressureEscalation = resolveLiveOpsPressureEscalation(
        pressureFocus,
        recipientCapRecommendation
      );
      const targetingGuidance = resolveLiveOpsTargetingGuidance(
        pressureFocus,
        recipientCapRecommendation,
        pressureEscalation
      );
      const guidanceMode = String(targetingGuidance.default_mode || "balanced").trim() || "balanced";
      const guidanceModeRow = findGuidanceModeRow(targetingGuidance, guidanceMode);
      const guidanceModeCap = Math.max(
        0,
        Number(
          guidanceModeRow?.suggested_recipient_cap ||
          recipientCapRecommendation.recommended_recipient_cap ||
          0
        ) || 0
      );
      const maxRecipientsBase = Math.max(
        1,
        Math.min(500, Number(input.maxRecipients || campaign.targeting.max_recipients || 50))
      );
      const maxRecipients = dispatchSource === "scheduler" && !dryRun
        ? Math.max(
            1,
            Math.min(
              maxRecipientsBase,
              Number(sceneGate.scene_gate_recipient_cap || maxRecipientsBase),
              guidanceModeCap || Number(recipientCapRecommendation.recommended_recipient_cap || maxRecipientsBase) || maxRecipientsBase
            )
          )
        : maxRecipientsBase;

      if (!dryRun) {
        const approvalSummary = buildApprovalSummary(campaign, { now: nowFactory() });
        if (!approvalSummary.live_dispatch_ready) {
          const reasonCode =
            approvalSummary.warnings.includes("approval_missing") || approvalSummary.warnings.includes("approval_pending")
              ? "campaign_approval_required"
              : approvalSummary.warnings.includes("schedule_not_open") || approvalSummary.warnings.includes("schedule_missing")
                ? "campaign_schedule_closed"
                : approvalSummary.warnings.includes("schedule_expired")
                  ? "campaign_schedule_expired"
                  : approvalSummary.warnings.includes("schedule_invalid")
                    ? "campaign_schedule_invalid"
                    : "campaign_not_ready";
          return { ok: false, reason: reasonCode, campaign, version };
        }
        if (dispatchSource === "scheduler" && sceneGate.ready_for_auto_dispatch !== true) {
          return { ok: false, reason: sceneGate.scene_gate_reason || "scene_runtime_scheduler_blocked", campaign, version };
        }
      }

      const selectionProfile = buildLiveOpsCandidateSelectionProfile(
        targetingGuidance,
        pressureFocus,
        pressureEscalation
      );
      const hasExternalCandidateLoader = typeof loadCandidates === "function";
      const candidateLoader = loadCandidates || selectCandidateLoader(campaign);
      const candidateQueryStrategy =
        dispatchSource === "scheduler"
          ? hasExternalCandidateLoader
            ? { applied: false, reason: "query_strategy_external_loader" }
            : buildLiveOpsCandidateQueryStrategy(campaign, selectionProfile, selectionTrendSummary)
          : { applied: false, reason: "query_strategy_not_requested" };
      const candidateResult = await candidateLoader(client, campaign, candidateQueryStrategy);
      const loadedCandidates = Array.isArray(candidateResult) ? candidateResult : [];
      const prefilterResult =
        dispatchSource === "scheduler"
          ? candidateQueryStrategy.applied === true
            ? {
                candidates: loadedCandidates,
                prefilter_summary: buildLiveOpsCandidatePrefilterSummary({
                  applied: false,
                  dimension: String(candidateQueryStrategy.dimension || "").trim(),
                  bucket: String(candidateQueryStrategy.bucket || "").trim(),
                  reason: "prefilter_shifted_to_query_strategy",
                  candidates_before: loadedCandidates.length,
                  candidates_after: loadedCandidates.length
                })
              }
            : await applyLiveOpsCandidateSqlPrefilter(
                client,
                loadedCandidates,
                recipientCapRecommendation.experiment_key || DEFAULT_EXPERIMENT_KEY,
                selectionProfile
              )
          : {
              candidates: loadedCandidates,
              prefilter_summary: buildLiveOpsCandidatePrefilterSummary({
                applied: false,
                reason: "prefilter_not_requested",
                candidates_before: loadedCandidates.length,
                candidates_after: loadedCandidates.length
              })
            };
      const prioritization =
        dispatchSource === "scheduler"
          ? await prioritizeLiveOpsCandidates(
              client,
              prefilterResult.candidates,
              recipientCapRecommendation.experiment_key || DEFAULT_EXPERIMENT_KEY,
              selectionProfile
            )
          : { candidates: loadedCandidates, selection_profile: buildLiveOpsCandidateSelectionProfile({}, {}, {}) };
      const candidates = Array.isArray(prioritization.candidates) ? prioritization.candidates : prefilterResult.candidates;
      const now = nowFactory();
      const dispatchRef = `${campaign.campaign_key}_${now.getTime().toString(36)}`;
      const sampleUsers = [];
      const selectedCandidates = [];
      let attempted = 0;
      let sent = 0;
      let recorded = 0;
      let skippedDisabled = 0;

      for (const candidate of candidates) {
        if (sent >= maxRecipients) {
          break;
        }
        attempted += 1;
        if (!candidate?.telegram_id) {
          continue;
        }
        if (!isCampaignEnabledForPrefs(candidate.prefs_json)) {
          skippedDisabled += 1;
          continue;
        }
        const lang = normalizeTrustMessageLanguage(candidate.locale);
        const text = formatCampaignMessage(campaign, lang);
        if (!text) {
          continue;
        }
        const surfaceEntries = await resolveSurfaceEntries(candidate.telegram_id, campaign, lang);
        const replyMarkup = buildReplyMarkup(surfaceEntries);
        sampleUsers.push({
          user_id: Number(candidate.user_id || 0),
          locale: lang,
          last_seen_at: candidate.last_seen_at || null
        });
        if (dryRun) {
          selectedCandidates.push(candidate);
          sent += 1;
          continue;
        }
        try {
          await postTelegramMessage(candidate.telegram_id, text, replyMarkup);
          selectedCandidates.push(candidate);
          sent += 1;
          const primarySurfaceKey = String(surfaceEntries[0]?.surface_key || "");
          await recordDispatchEvent(client, candidate.user_id, {
            campaign_key: campaign.campaign_key,
            campaign_version: version,
            dispatch_ref: dispatchRef,
            segment_key: campaign.targeting.segment_key,
            locale: lang,
            primary_surface_key: primarySurfaceKey,
            surface_count: surfaceEntries.length,
            reason,
            sent_at: now.toISOString()
          });
          recorded += 1;
        } catch (err) {
          logger("warn", {
            event: "live_ops_campaign_send_failed",
            campaign_key: campaign.campaign_key,
            user_id: Number(candidate.user_id || 0),
            telegram_id: Number(candidate.telegram_id || 0),
            error: String(err?.message || err).slice(0, 240)
          });
        }
      }

      const auditAction = dryRun ? "live_ops_campaign_dry_run" : "live_ops_campaign_dispatch";
      const selectionSummary =
        dispatchSource === "scheduler"
          ? buildLiveOpsSelectionSummary(
              prioritization.selection_profile,
              candidates,
              selectedCandidates,
              prefilterResult.prefilter_summary,
              candidateQueryStrategy
            )
          : null;
      await client.query(
        `INSERT INTO admin_audit (admin_id, action, target, payload_json)
         VALUES ($1, $2, $3, $4::jsonb);`,
        [
          adminId,
          auditAction,
          `config:${LIVE_OPS_CAMPAIGN_CONFIG_KEY}`,
          JSON.stringify(
            buildCampaignAuditPayload(campaign, {
              now,
              reason,
              version,
              dispatchRef,
              dispatchSource,
              windowKey,
              sceneGateState: sceneGate.scene_gate_state,
              sceneGateEffect: sceneGate.scene_gate_effect,
              sceneGateReason: sceneGate.scene_gate_reason,
              sceneGateRecipientCap: dispatchSource === "scheduler" ? maxRecipients : maxRecipientsBase,
              targetingGuidanceDefaultMode: guidanceMode,
              targetingGuidanceCap: dispatchSource === "scheduler" ? maxRecipients : guidanceModeCap,
              targetingGuidanceReason: String(targetingGuidance.guidance_reason || ""),
              targetingSelectionSummary: selectionSummary,
              dryRun,
              sent,
              attempted,
              recorded,
              skippedDisabled
            })
          )
        ]
      );

      logger("info", {
        event: "live_ops_campaign_dispatched",
        campaign_key: campaign.campaign_key,
        campaign_version: version,
        dry_run: dryRun,
        attempted,
        sent,
        recorded,
        skipped_disabled: skippedDisabled,
        dispatch_ref: dispatchRef,
        segment_key: campaign.targeting.segment_key
      });

      return {
        ok: true,
        data: {
          api_version: "v2",
          campaign_key: campaign.campaign_key,
          version,
          dry_run: dryRun,
          segment_key: campaign.targeting.segment_key,
          attempted,
          sent,
          recorded,
          skipped_disabled: skippedDisabled,
          dispatch_ref: dispatchRef,
          dispatch_source: dispatchSource,
          window_key: windowKey,
          scene_gate_state: sceneGate.scene_gate_state,
          scene_gate_effect: sceneGate.scene_gate_effect,
          scene_gate_reason: sceneGate.scene_gate_reason,
          scene_gate_recipient_cap: dispatchSource === "scheduler" ? maxRecipients : maxRecipientsBase,
          recommendation_mode: guidanceMode,
          recommendation_mode_cap: dispatchSource === "scheduler" ? maxRecipients : guidanceModeCap,
          recommendation_guidance_state: String(targetingGuidance.guidance_state || "clear"),
          selection_summary: selectionSummary,
          sample_users: sampleUsers.slice(0, 5),
          generated_at: now.toISOString()
        }
      };
    } finally {
      client.release();
    }
  }

  async function runScheduledDispatch(input = {}) {
    if (!isEnabled()) {
      return { ok: false, reason: "service_disabled" };
    }

    let campaign = buildDefaultLiveOpsCampaignConfig();
    let windowKey = "";
    const client = await pool.connect();
    try {
      const current = await loadLatestConfig(client);
      campaign = current.campaign;
      const now = nowFactory();
      const latestDispatch = await loadLatestDispatchSummary(client, campaign.campaign_key);
      const [sceneRuntimeSummary, schedulerSkipSummary, opsAlertTrendSummary] = await Promise.all([
        loadSceneRuntimeSummary(client),
        loadSchedulerSkipSummary(client, campaign.campaign_key),
        loadOpsAlertTrendSummary(client, campaign.campaign_key).catch((err) => {
          if (err?.code === "42P01" || err?.code === "42703") {
            return buildEmptyLiveOpsOpsAlertTrendSummary();
          }
          throw err;
        })
      ]);
      const approvalSummary = buildApprovalSummary(campaign, {
        now,
        updated_at: current.created_at || null,
        last_dispatch_at: latestDispatch.last_sent_at || null
      });
      windowKey = buildScheduleWindowKey(campaign);
      const sceneGate = resolveLiveOpsSceneGate(sceneRuntimeSummary, campaign);
      if (!approvalSummary.live_dispatch_ready) {
        const reason =
          approvalSummary.warnings.includes("approval_missing") || approvalSummary.warnings.includes("approval_pending")
            ? "campaign_approval_required"
            : approvalSummary.warnings.includes("schedule_not_open") || approvalSummary.warnings.includes("schedule_missing")
              ? "campaign_schedule_closed"
              : approvalSummary.warnings.includes("schedule_expired")
                ? "campaign_schedule_expired"
                : approvalSummary.warnings.includes("schedule_invalid")
                  ? "campaign_schedule_invalid"
                  : "campaign_not_ready";
        if (input.dryRun !== true) {
          await writeSchedulerSkipAudit(client, campaign, {
            adminId: Number(input.adminId || 0),
            reason,
            version: current.version,
            now,
            windowKey,
            sceneGate
          });
        }
        return {
          ok: true,
          skipped: true,
          reason,
          campaign_key: campaign.campaign_key,
          version: current.version,
          window_key: windowKey,
          scheduler_summary: buildSchedulerSummary(
            campaign,
            approvalSummary,
            null,
            null,
            sceneRuntimeSummary,
            schedulerSkipSummary,
            opsAlertTrendSummary
          )
        };
      }
      if (input.dryRun !== true && sceneGate.ready_for_auto_dispatch !== true) {
        const reason = sceneGate.scene_gate_reason || "scene_runtime_scheduler_blocked";
        await writeSchedulerSkipAudit(client, campaign, {
          adminId: Number(input.adminId || 0),
          reason,
          version: current.version,
          now,
          windowKey,
          sceneGate
        });
        return {
          ok: true,
          skipped: true,
          reason,
          campaign_key: campaign.campaign_key,
          version: current.version,
          window_key: windowKey,
          scheduler_summary: buildSchedulerSummary(
            campaign,
            approvalSummary,
            null,
            null,
            sceneRuntimeSummary,
            schedulerSkipSummary,
            opsAlertTrendSummary
          )
        };
      }

      const existing = input.dryRun === true ? null : await loadSchedulerWindowDispatch(client, campaign.campaign_key, windowKey);
      if (existing) {
        await writeSchedulerSkipAudit(client, campaign, {
          adminId: Number(input.adminId || 0),
          reason: "already_dispatched_for_window",
          version: current.version,
          now,
          windowKey,
          dispatchRef: existing.dispatch_ref,
          sceneGate
        });
        return {
          ok: true,
          skipped: true,
          reason: "already_dispatched_for_window",
          campaign_key: campaign.campaign_key,
          version: current.version,
          window_key: windowKey,
          latest_dispatch_ref: existing.dispatch_ref,
          latest_dispatch_at: existing.created_at || null,
          scheduler_summary: buildSchedulerSummary(
            campaign,
            approvalSummary,
            existing,
            existing,
            sceneRuntimeSummary,
            schedulerSkipSummary,
            opsAlertTrendSummary
          )
        };
      }
    } finally {
      client.release();
    }

    const result = await dispatchCampaign({
      adminId: Number(input.adminId || 0),
      dryRun: input.dryRun === true,
      maxRecipients: input.maxRecipients,
      reason: String(input.reason || "scheduled_window_dispatch"),
      campaign,
      dispatchSource: "scheduler",
      windowKey
    });
    if (result?.ok && result.data && !result.data.window_key) {
      result.data.window_key = windowKey;
    }
    return result;
  }

  return {
    getCampaignSnapshot,
    saveCampaignConfig,
    updateCampaignApproval,
    dispatchCampaign,
    runScheduledDispatch
  };
}

module.exports = {
  createLiveOpsChatCampaignService
};
