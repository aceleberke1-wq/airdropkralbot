"use strict";

const LIVE_OPS_CAMPAIGN_CONFIG_KEY = "live_ops_chat_campaign_v1";
const LIVE_OPS_CAMPAIGN_EVENT_TYPE = "live_ops_campaign_sent";

const LIVE_OPS_SEGMENT_KEY = Object.freeze({
  INACTIVE_RETURNING: "inactive_returning",
  WALLET_UNLINKED: "wallet_unlinked",
  MISSION_IDLE: "mission_idle",
  ALL_ACTIVE: "all_active"
});

const LIVE_OPS_CAMPAIGN_STATUS = Object.freeze({
  DRAFT: "draft",
  READY: "ready",
  PAUSED: "paused"
});

const LIVE_OPS_APPROVAL_STATE = Object.freeze({
  NOT_REQUESTED: "not_requested",
  PENDING: "pending",
  APPROVED: "approved",
  REVOKED: "revoked"
});

const DEFAULT_LIVE_OPS_CAMPAIGN = Object.freeze({
  api_version: "v2",
  campaign_key: "comeback_pulse",
  enabled: false,
  status: LIVE_OPS_CAMPAIGN_STATUS.DRAFT,
  targeting: Object.freeze({
    segment_key: LIVE_OPS_SEGMENT_KEY.INACTIVE_RETURNING,
    inactive_hours: 72,
    max_age_days: 30,
    active_within_days: 14,
    locale_filter: "",
    max_recipients: 50,
    dedupe_hours: 72
  }),
  copy: Object.freeze({
    title: Object.freeze({
      tr: "Nexus hazir",
      en: "Nexus is ready"
    }),
    body: Object.freeze({
      tr: "Kasanda bekleyen oduller ve yenilenen rota seni bekliyor.",
      en: "Waiting rewards and a refreshed route are ready for you."
    }),
    note: Object.freeze({
      tr: "Guvenli sonraki adim icin dunyaya don.",
      en: "Return to the world for the next safe step."
    })
  }),
  schedule: Object.freeze({
    timezone: "UTC",
    start_at: null,
    end_at: null
  }),
  approval: Object.freeze({
    required: true,
    state: LIVE_OPS_APPROVAL_STATE.NOT_REQUESTED,
    requested_by: 0,
    requested_at: null,
    approved_by: 0,
    approved_at: null,
    last_action_by: 0,
    last_action_at: null,
    note: ""
  }),
  surfaces: Object.freeze([
    Object.freeze({ slot_key: "primary", surface_key: "play_world" }),
    Object.freeze({ slot_key: "secondary", surface_key: "rewards_vault" })
  ])
});

function normalizeSegmentKey(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_");
  return Object.values(LIVE_OPS_SEGMENT_KEY).includes(normalized)
    ? normalized
    : LIVE_OPS_SEGMENT_KEY.INACTIVE_RETURNING;
}

function normalizeStatus(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_");
  return Object.values(LIVE_OPS_CAMPAIGN_STATUS).includes(normalized)
    ? normalized
    : LIVE_OPS_CAMPAIGN_STATUS.DRAFT;
}

function normalizeLocalizedMap(value, fallback = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    tr: String(source.tr || fallback.tr || "").trim(),
    en: String(source.en || fallback.en || "").trim()
  };
}

function normalizeIsoDateTime(value) {
  if (value == null || value === "") {
    return null;
  }
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

function normalizeTimezone(value, fallback = "UTC") {
  const raw = String(value || fallback || "UTC")
    .trim()
    .slice(0, 64);
  if (!raw) {
    return "UTC";
  }
  return raw;
}

function normalizeApprovalState(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_");
  return Object.values(LIVE_OPS_APPROVAL_STATE).includes(normalized)
    ? normalized
    : LIVE_OPS_APPROVAL_STATE.NOT_REQUESTED;
}

function normalizeApproval(value, fallback = DEFAULT_LIVE_OPS_CAMPAIGN.approval) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    required: source.required !== false,
    state: normalizeApprovalState(source.state || fallback.state),
    requested_by: Math.max(0, Number(source.requested_by || fallback.requested_by || 0)),
    requested_at: normalizeIsoDateTime(source.requested_at || fallback.requested_at),
    approved_by: Math.max(0, Number(source.approved_by || fallback.approved_by || 0)),
    approved_at: normalizeIsoDateTime(source.approved_at || fallback.approved_at),
    last_action_by: Math.max(0, Number(source.last_action_by || fallback.last_action_by || 0)),
    last_action_at: normalizeIsoDateTime(source.last_action_at || fallback.last_action_at),
    note: String(source.note || fallback.note || "").trim().slice(0, 240)
  };
}

function normalizeSchedule(value, fallback = DEFAULT_LIVE_OPS_CAMPAIGN.schedule) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const startAt = normalizeIsoDateTime(source.start_at || fallback.start_at);
  const endAt = normalizeIsoDateTime(source.end_at || fallback.end_at);
  return {
    timezone: normalizeTimezone(source.timezone || fallback.timezone || "UTC"),
    start_at: startAt,
    end_at: endAt
  };
}

function normalizeSurfaces(value, fallback = DEFAULT_LIVE_OPS_CAMPAIGN.surfaces) {
  const source = Array.isArray(value) ? value : fallback;
  const normalized = source
    .map((row, index) => {
      const item = row && typeof row === "object" && !Array.isArray(row) ? row : {};
      const slotKey = String(item.slot_key || item.slotKey || `slot_${index + 1}`)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_:-]+/g, "_")
        .slice(0, 32);
      const surfaceKey = String(item.surface_key || item.surfaceKey || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_:-]+/g, "_")
        .slice(0, 64);
      if (!slotKey || !surfaceKey) {
        return null;
      }
      return {
        slot_key: slotKey,
        surface_key: surfaceKey
      };
    })
    .filter(Boolean)
    .slice(0, 3);
  return normalized.length ? normalized : Array.from(DEFAULT_LIVE_OPS_CAMPAIGN.surfaces);
}

function buildDefaultLiveOpsCampaignConfig(overrides = {}) {
  const source = overrides && typeof overrides === "object" && !Array.isArray(overrides) ? overrides : {};
  const targeting = source.targeting && typeof source.targeting === "object" && !Array.isArray(source.targeting) ? source.targeting : {};
  const copy = source.copy && typeof source.copy === "object" && !Array.isArray(source.copy) ? source.copy : {};
  return {
    api_version: "v2",
    campaign_key: String(source.campaign_key || DEFAULT_LIVE_OPS_CAMPAIGN.campaign_key)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_:-]+/g, "_")
      .slice(0, 64),
    enabled: source.enabled === true,
    status: normalizeStatus(source.status),
    targeting: {
      segment_key: normalizeSegmentKey(targeting.segment_key),
      inactive_hours: Math.max(24, Math.min(720, Number(targeting.inactive_hours || DEFAULT_LIVE_OPS_CAMPAIGN.targeting.inactive_hours))),
      max_age_days: Math.max(3, Math.min(120, Number(targeting.max_age_days || DEFAULT_LIVE_OPS_CAMPAIGN.targeting.max_age_days))),
      active_within_days: Math.max(
        1,
        Math.min(60, Number(targeting.active_within_days || DEFAULT_LIVE_OPS_CAMPAIGN.targeting.active_within_days))
      ),
      locale_filter: String(targeting.locale_filter || "")
        .trim()
        .toLowerCase()
        .slice(0, 8),
      max_recipients: Math.max(
        1,
        Math.min(500, Number(targeting.max_recipients || DEFAULT_LIVE_OPS_CAMPAIGN.targeting.max_recipients))
      ),
      dedupe_hours: Math.max(1, Math.min(720, Number(targeting.dedupe_hours || DEFAULT_LIVE_OPS_CAMPAIGN.targeting.dedupe_hours)))
    },
    copy: {
      title: normalizeLocalizedMap(copy.title, DEFAULT_LIVE_OPS_CAMPAIGN.copy.title),
      body: normalizeLocalizedMap(copy.body, DEFAULT_LIVE_OPS_CAMPAIGN.copy.body),
      note: normalizeLocalizedMap(copy.note, DEFAULT_LIVE_OPS_CAMPAIGN.copy.note)
    },
    schedule: normalizeSchedule(source.schedule),
    approval: normalizeApproval(source.approval),
    surfaces: normalizeSurfaces(source.surfaces)
  };
}

module.exports = {
  LIVE_OPS_CAMPAIGN_CONFIG_KEY,
  LIVE_OPS_CAMPAIGN_EVENT_TYPE,
  LIVE_OPS_SEGMENT_KEY,
  LIVE_OPS_CAMPAIGN_STATUS,
  LIVE_OPS_APPROVAL_STATE,
  DEFAULT_LIVE_OPS_CAMPAIGN,
  normalizeSegmentKey,
  normalizeStatus,
  normalizeLocalizedMap,
  normalizeIsoDateTime,
  normalizeTimezone,
  normalizeApprovalState,
  normalizeApproval,
  normalizeSchedule,
  normalizeSurfaces,
  buildDefaultLiveOpsCampaignConfig
};
