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
const { resolveLiveOpsSceneGate } = require("../../../../packages/shared/src/liveOpsSceneGate.cjs");
const { resolveLiveOpsDispatchArtifactPaths } = require("../../../../packages/shared/src/runtimeArtifactPaths");
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

async function queryInactiveReturningCandidates(client, campaign) {
  const targeting = campaign.targeting || {};
  const limit = Math.max(1, toPositiveInt(targeting.max_recipients, 50));
  const inactiveHours = Math.max(24, toPositiveInt(targeting.inactive_hours, 72));
  const maxAgeDays = Math.max(3, toPositiveInt(targeting.max_age_days, 30));
  const localeFilter = String(targeting.locale_filter || "").trim().toLowerCase();
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
       AND NOT EXISTS (
         SELECT 1
         FROM behavior_events be
         WHERE be.user_id = u.id
           AND be.event_type = $4
           AND COALESCE(be.meta_json->>'campaign_key', '') = $5
           AND be.event_at >= now() - make_interval(hours => $6::int)
       )
     ORDER BY u.last_seen_at ASC
     LIMIT $7;`,
    [inactiveHours, maxAgeDays, localeFilter, LIVE_OPS_CAMPAIGN_EVENT_TYPE, campaign.campaign_key, campaign.targeting.dedupe_hours, limit * 4]
  );
  return result.rows;
}

async function queryWalletUnlinkedCandidates(client, campaign) {
  const targeting = campaign.targeting || {};
  const limit = Math.max(1, toPositiveInt(targeting.max_recipients, 50));
  const activeWithinDays = Math.max(1, toPositiveInt(targeting.active_within_days, 14));
  const localeFilter = String(targeting.locale_filter || "").trim().toLowerCase();
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
           AND be.event_type = $3
           AND COALESCE(be.meta_json->>'campaign_key', '') = $4
           AND be.event_at >= now() - make_interval(hours => $5::int)
       )
     ORDER BY u.last_seen_at DESC
     LIMIT $6;`,
    [activeWithinDays, localeFilter, LIVE_OPS_CAMPAIGN_EVENT_TYPE, campaign.campaign_key, campaign.targeting.dedupe_hours, limit * 4]
  );
  return result.rows;
}

async function queryMissionIdleCandidates(client, campaign) {
  const targeting = campaign.targeting || {};
  const limit = Math.max(1, toPositiveInt(targeting.max_recipients, 50));
  const activeWithinDays = Math.max(1, toPositiveInt(targeting.active_within_days, 14));
  const localeFilter = String(targeting.locale_filter || "").trim().toLowerCase();
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
           AND be.event_type = $3
           AND COALESCE(be.meta_json->>'campaign_key', '') = $4
           AND be.event_at >= now() - make_interval(hours => $5::int)
       )
     ORDER BY mw.latest_offer_created_at DESC
     LIMIT $6;`,
    [activeWithinDays, localeFilter, LIVE_OPS_CAMPAIGN_EVENT_TYPE, campaign.campaign_key, campaign.targeting.dedupe_hours, limit * 4]
  );
  return result.rows;
}

async function queryAllActiveCandidates(client, campaign) {
  const targeting = campaign.targeting || {};
  const limit = Math.max(1, toPositiveInt(targeting.max_recipients, 50));
  const activeWithinDays = Math.max(1, toPositiveInt(targeting.active_within_days, 14));
  const localeFilter = String(targeting.locale_filter || "").trim().toLowerCase();
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
       AND NOT EXISTS (
         SELECT 1
         FROM behavior_events be
         WHERE be.user_id = u.id
           AND be.event_type = $3
           AND COALESCE(be.meta_json->>'campaign_key', '') = $4
           AND be.event_at >= now() - make_interval(hours => $5::int)
       )
     ORDER BY u.last_seen_at DESC
     LIMIT $6;`,
    [activeWithinDays, localeFilter, LIVE_OPS_CAMPAIGN_EVENT_TYPE, campaign.campaign_key, campaign.targeting.dedupe_hours, limit * 4]
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
  return {
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
    window_key: ""
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
    const data = payload && typeof payload.data === "object" ? payload.data : {};
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
      window_key: String(scheduler?.window_key || data?.window_key || "").trim()
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

function buildSchedulerSummary(campaign, approvalSummary, latestSchedulerDispatch, windowDispatch, sceneRuntimeSummary) {
  const sceneGate = resolveLiveOpsSceneGate(sceneRuntimeSummary, campaign);
  return {
    ready_for_auto_dispatch: approvalSummary?.live_dispatch_ready === true && sceneGate.ready_for_auto_dispatch === true,
    schedule_state: String(approvalSummary?.schedule_state || "missing"),
    approval_state: String(approvalSummary?.approval_state || LIVE_OPS_APPROVAL_STATE.NOT_REQUESTED),
    scene_gate_state: sceneGate.scene_gate_state,
    scene_gate_effect: sceneGate.scene_gate_effect,
    scene_gate_reason: sceneGate.scene_gate_reason,
    scene_gate_recipient_cap: sceneGate.scene_gate_recipient_cap,
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
  const [versionHistory, dispatchHistory, operatorTimeline, deliverySummary, schedulerSkipSummary, latestSchedulerDispatch, schedulerWindowDispatch, sceneRuntimeSummary, taskSummary] = await Promise.all([
    loadVersionHistory(client),
    loadDispatchHistory(client, snapshotState.campaign.campaign_key),
    loadOperatorTimeline(client, snapshotState.campaign.campaign_key),
    loadDeliverySummary(client, snapshotState.campaign.campaign_key),
    loadSchedulerSkipSummary(client, snapshotState.campaign.campaign_key),
    loadLatestSchedulerDispatch(client, snapshotState.campaign.campaign_key),
    loadSchedulerWindowDispatch(client, snapshotState.campaign.campaign_key, currentWindowKey),
    loadSceneRuntimeSummary(client),
    readLatestTaskArtifactSummary()
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
      sceneRuntimeSummary
    ),
    version_history: versionHistory,
    dispatch_history: dispatchHistory,
    operator_timeline: operatorTimeline,
    delivery_summary: deliverySummary,
    scheduler_skip_summary: schedulerSkipSummary,
    scene_runtime_summary: sceneRuntimeSummary,
    task_summary: taskSummary,
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
      const sceneRuntimeSummary = dispatchSource === "scheduler" ? await loadSceneRuntimeSummary(client) : buildEmptySceneRuntimeSummary();
      const sceneGate = resolveLiveOpsSceneGate(sceneRuntimeSummary, campaign);
      const maxRecipientsBase = Math.max(
        1,
        Math.min(500, Number(input.maxRecipients || campaign.targeting.max_recipients || 50))
      );
      const maxRecipients = dispatchSource === "scheduler" && !dryRun
        ? Math.max(1, Math.min(maxRecipientsBase, Number(sceneGate.scene_gate_recipient_cap || maxRecipientsBase)))
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

      const candidateLoader = loadCandidates || selectCandidateLoader(campaign);
      const candidateResult = await candidateLoader(client, campaign);
      const candidates = Array.isArray(candidateResult) ? candidateResult : [];
      const now = nowFactory();
      const dispatchRef = `${campaign.campaign_key}_${now.getTime().toString(36)}`;
      const sampleUsers = [];
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
          sent += 1;
          continue;
        }
        try {
          await postTelegramMessage(candidate.telegram_id, text, replyMarkup);
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
      const sceneRuntimeSummary = await loadSceneRuntimeSummary(client);
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
          scheduler_summary: buildSchedulerSummary(campaign, approvalSummary, null, null, sceneRuntimeSummary)
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
          scheduler_summary: buildSchedulerSummary(campaign, approvalSummary, null, null, sceneRuntimeSummary)
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
          scheduler_summary: buildSchedulerSummary(campaign, approvalSummary, existing, existing, sceneRuntimeSummary)
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
