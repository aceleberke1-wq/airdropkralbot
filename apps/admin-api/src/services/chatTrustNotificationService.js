"use strict";

const crypto = require("crypto");
const {
  buildStartAppPayload,
  encodeStartAppPayload
} = require("../../../../packages/shared/src/navigationContract");
const { resolveChatAlertConfig } = require("../../../../packages/shared/src/chatAlertCatalog");
const { resolveAlertLaunchEventKey } = require("../../../../packages/shared/src/launchEventContract");
const {
  formatTokenDecisionUpdate,
  formatPayoutDecisionUpdate,
  normalizeTrustMessageLanguage
} = require("../../../../packages/shared/src/chatTrustMessages");
const { resolveLaunchSurface } = require("../../../bot/src/ui/launchSurfaceCatalog");
const { buildNavigationFromCommand } = require("../../../bot/src/utils/miniAppLaunchResolver");
const { resolvePlayerCommandNavigation } = require("../../../../packages/shared/src/playerCommandNavigation");

const TOKEN_ALERT_SURFACES = Object.freeze([
  Object.freeze({ slotKey: "wallet_lane", surfaceKey: "wallet_panel" }),
  Object.freeze({ slotKey: "support", surfaceKey: "support_panel" })
]);

const SURFACE_LABELS = Object.freeze({
  tr: Object.freeze({
    wallet_panel: "Wallet Panel",
    support_panel: "Destek",
    payout_screen: "Payout Ekrani"
  }),
  en: Object.freeze({
    wallet_panel: "Wallet Panel",
    support_panel: "Support",
    payout_screen: "Payout Screen"
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

function localizeSurfaceLabel(surfaceKey, lang = "tr") {
  const locale = normalizeTrustMessageLanguage(lang);
  return SURFACE_LABELS[locale]?.[surfaceKey] || SURFACE_LABELS.tr[surfaceKey] || surfaceKey;
}

function createChatTrustNotificationService(deps = {}) {
  const pool = deps.pool;
  const getProfileByUserId = deps.getProfileByUserId;
  const fetchImpl = deps.fetchImpl || global.fetch;
  const botToken = String(deps.botToken || "").trim();
  const botUsername = String(deps.botUsername || "airdropkral_2026_bot").trim();
  const webappPublicUrl = String(deps.webappPublicUrl || "").trim();
  const webappHmacSecret = String(deps.webappHmacSecret || "").trim();
  const logger = typeof deps.logger === "function" ? deps.logger : () => {};
  const resolveWebappVersion =
    typeof deps.resolveWebappVersion === "function" ? deps.resolveWebappVersion : async () => ({ version: "" });

  function isEnabled() {
    return Boolean(pool?.connect && typeof getProfileByUserId === "function" && fetchImpl && botToken && webappPublicUrl && webappHmacSecret);
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

  async function loadProfileByUserId(userId) {
    const client = await pool.connect();
    try {
      return await getProfileByUserId(client, userId);
    } finally {
      client.release();
    }
  }

  async function resolveAlertSurfaceEntries(telegramId, alertKey, options = {}) {
    const alertConfig = resolveChatAlertConfig(alertKey);
    if (!alertConfig) {
      return [];
    }
    const launchBaseUrl = await resolveLaunchBaseUrl();
    if (!launchBaseUrl) {
      return [];
    }

    const overrideSurfaces = Array.isArray(options.surfaces) ? options.surfaces : [];
    const overrideBySlot = new Map(
      overrideSurfaces
        .map((slot) => {
          const slotKey = String(slot?.slotKey || slot?.slot_key || "").trim();
          const surfaceKey = String(slot?.surfaceKey || slot?.surface_key || "").trim();
          if (!slotKey || !surfaceKey) {
            return null;
          }
          return [slotKey, { slotKey, surfaceKey }];
        })
        .filter(Boolean)
    );

    return alertConfig.surfaces
      .map((slot, index) => {
        const baseSlotKey = String(slot.slot_key || "").trim();
        const indexedOverride = overrideSurfaces[index];
        const override = overrideBySlot.get(baseSlotKey) || indexedOverride || null;
        const slotKey = String(override?.slotKey || baseSlotKey || `slot_${index + 1}`).trim();
        const surfaceKey = String(override?.surfaceKey || slot.surface_key || "").trim();
        const surface = resolveLaunchSurface(surfaceKey);
        if (!surface?.commandKey) {
          return null;
        }
        const navigation = buildNavigationFromCommand(surface.commandKey, resolvePlayerCommandNavigation, {
          ...(surface.overrides || {}),
          shellActionKey: surface.shellActionKey || surface.overrides?.shellActionKey || "",
          launchEventKey: resolveAlertLaunchEventKey(alertConfig.key, slotKey || surface.key || "")
        });
        const url = buildSignedWebAppUrl(telegramId, navigation, launchBaseUrl);
        if (!url) {
          return null;
        }
        return {
          surfaceKey: surface.key,
          text: localizeSurfaceLabel(surface.key, options.lang),
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
        if (/^https:\/\//i.test(String(entry.url))) {
          return [{ text: String(entry.text), web_app: { url: String(entry.url) } }];
        }
        return [{ text: String(entry.text), url: String(entry.url) }];
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

  async function sendTrustNotification(payload = {}) {
    if (!isEnabled()) {
      return { sent: false, reason: "service_disabled" };
    }

    const userId = Number(payload.userId || payload.request?.user_id || 0);
    if (!userId) {
      return { sent: false, reason: "user_id_missing" };
    }

    const profile = payload.profile?.telegram_id ? payload.profile : await loadProfileByUserId(userId);
    if (!profile?.telegram_id) {
      return { sent: false, reason: "profile_not_found" };
    }

    const lang = normalizeTrustMessageLanguage(payload.lang || profile.locale);
    const alertKey = String(payload.alertKey || "payout_update");
    const text =
      payload.kind === "token"
        ? formatTokenDecisionUpdate(payload.request, {
            lang,
            decision: payload.decision,
            txHash: payload.txHash,
            reason: payload.reason
          })
        : formatPayoutDecisionUpdate(payload.request, {
            lang,
            decision: payload.decision,
            txHash: payload.txHash,
            reason: payload.reason
          });
    const surfaces =
      payload.kind === "token" ? payload.surfaces || TOKEN_ALERT_SURFACES : Array.isArray(payload.surfaces) ? payload.surfaces : [];
    const entries = await resolveAlertSurfaceEntries(profile.telegram_id, alertKey, { surfaces, lang });
    const replyMarkup = buildReplyMarkup(entries);

    try {
      await postTelegramMessage(profile.telegram_id, text, replyMarkup);
      logger("info", {
        event: "chat_trust_notification_sent",
        kind: String(payload.kind || "payout"),
        decision: String(payload.decision || ""),
        user_id: Number(profile.user_id || userId),
        telegram_id: Number(profile.telegram_id || 0),
        request_id: Number(payload.request?.id || 0),
        alert_key: alertKey,
        surface_count: entries.length
      });
      return { sent: true };
    } catch (err) {
      logger("warn", {
        event: "chat_trust_notification_failed",
        kind: String(payload.kind || "payout"),
        decision: String(payload.decision || ""),
        user_id: Number(profile.user_id || userId),
        telegram_id: Number(profile.telegram_id || 0),
        request_id: Number(payload.request?.id || 0),
        alert_key: alertKey,
        error: String(err?.message || err).slice(0, 240)
      });
      return { sent: false, reason: "telegram_send_failed" };
    }
  }

  return {
    sendTrustNotification
  };
}

module.exports = {
  TOKEN_ALERT_SURFACES,
  createChatTrustNotificationService
};
