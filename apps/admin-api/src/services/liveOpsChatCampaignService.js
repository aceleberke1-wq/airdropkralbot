"use strict";

const crypto = require("crypto");
const {
  buildStartAppPayload,
  encodeStartAppPayload
} = require("../../../../packages/shared/src/navigationContract");
const { resolveAlertLaunchEventKey } = require("../../../../packages/shared/src/launchEventContract");
const {
  LIVE_OPS_CAMPAIGN_CONFIG_KEY,
  LIVE_OPS_CAMPAIGN_EVENT_TYPE,
  LIVE_OPS_SEGMENT_KEY,
  buildDefaultLiveOpsCampaignConfig
} = require("../../../../packages/shared/src/liveOpsCampaignContract");
const { normalizeTrustMessageLanguage, escapeMarkdown } = require("../../../../packages/shared/src/chatTrustMessages");
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

  async function getCampaignSnapshot() {
    const client = await pool.connect();
    try {
      const current = await loadLatestConfig(client);
      const latestDispatch = await loadLatestDispatchSummary(client, current.campaign.campaign_key);
      return {
        api_version: "v2",
        config_key: LIVE_OPS_CAMPAIGN_CONFIG_KEY,
        version: current.version,
        updated_at: current.created_at,
        updated_by: current.created_by,
        campaign: current.campaign,
        latest_dispatch: latestDispatch
      };
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
      const campaign = buildDefaultLiveOpsCampaignConfig(input.campaign || {});
      await client.query(
        `INSERT INTO config_versions (config_key, version, config_json, created_by)
         VALUES ($1, $2, $3::jsonb, $4);`,
        [LIVE_OPS_CAMPAIGN_CONFIG_KEY, nextVersion, JSON.stringify(campaign), adminId]
      );
      await client.query(
        `INSERT INTO admin_audit (admin_id, action, target, payload_json)
         VALUES ($1, 'live_ops_campaign_save', $2, $3::jsonb);`,
        [adminId, `config:${LIVE_OPS_CAMPAIGN_CONFIG_KEY}`, JSON.stringify({ reason, version: nextVersion, campaign_key: campaign.campaign_key })]
      );
      await client.query("COMMIT");
      logger("info", {
        event: "live_ops_campaign_saved",
        admin_id: adminId,
        version: nextVersion,
        campaign_key: campaign.campaign_key,
        reason
      });
      const latestDispatch = await loadLatestDispatchSummary(client, campaign.campaign_key);
      return {
        api_version: "v2",
        config_key: LIVE_OPS_CAMPAIGN_CONFIG_KEY,
        version: nextVersion,
        updated_at: new Date().toISOString(),
        updated_by: adminId,
        campaign,
        latest_dispatch: latestDispatch
      };
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
      const maxRecipients = Math.max(
        1,
        Math.min(500, Number(input.maxRecipients || campaign.targeting.max_recipients || 50))
      );

      if (!dryRun && (!campaign.enabled || campaign.status !== "ready")) {
        return { ok: false, reason: "campaign_not_ready", campaign, version };
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
          await recordDispatchEvent(client, candidate.user_id, {
            campaign_key: campaign.campaign_key,
            campaign_version: version,
            dispatch_ref: dispatchRef,
            segment_key: campaign.targeting.segment_key,
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

      if (!dryRun) {
        await client.query(
          `INSERT INTO admin_audit (admin_id, action, target, payload_json)
           VALUES ($1, 'live_ops_campaign_dispatch', $2, $3::jsonb);`,
          [
            adminId,
            `config:${LIVE_OPS_CAMPAIGN_CONFIG_KEY}`,
            JSON.stringify({
              reason,
              campaign_key: campaign.campaign_key,
              campaign_version: version,
              dispatch_ref: dispatchRef,
              sent,
              attempted,
              segment_key: campaign.targeting.segment_key
            })
          ]
        );
      }

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
          sample_users: sampleUsers.slice(0, 5),
          generated_at: now.toISOString()
        }
      };
    } finally {
      client.release();
    }
  }

  return {
    getCampaignSnapshot,
    saveCampaignConfig,
    dispatchCampaign
  };
}

module.exports = {
  createLiveOpsChatCampaignService
};
