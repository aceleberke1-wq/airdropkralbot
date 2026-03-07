"use strict";

const CHAT_ALERT_KEY = Object.freeze({
  CHEST_READY: "chest_ready",
  MISSION_REFRESH: "mission_refresh",
  EVENT_COUNTDOWN: "event_countdown",
  KINGDOM_WAR: "kingdom_war",
  STREAK_RISK: "streak_risk",
  PAYOUT_UPDATE: "payout_update",
  RARE_DROP: "rare_drop",
  COMEBACK_OFFER: "comeback_offer",
  SEASON_DEADLINE: "season_deadline"
});

const CHAT_ALERT_CATALOG = Object.freeze({
  [CHAT_ALERT_KEY.CHEST_READY]: Object.freeze({
    tone: "reward",
    throttle_key: "reward_alert_toggle",
    surfaces: Object.freeze([
      Object.freeze({ slot_key: "reward_lane", surface_key: "rewards_vault" }),
      Object.freeze({ slot_key: "payout_lane", surface_key: "payout_screen" })
    ])
  }),
  [CHAT_ALERT_KEY.MISSION_REFRESH]: Object.freeze({
    tone: "progress",
    throttle_key: "progress_alert_toggle",
    surfaces: Object.freeze([
      Object.freeze({ slot_key: "mission_board", surface_key: "mission_quarter" }),
      Object.freeze({ slot_key: "world_hub", surface_key: "play_world" })
    ])
  }),
  [CHAT_ALERT_KEY.EVENT_COUNTDOWN]: Object.freeze({
    tone: "event",
    throttle_key: "event_alert_toggle",
    surfaces: Object.freeze([
      Object.freeze({ slot_key: "event_hall", surface_key: "events_hall" }),
      Object.freeze({ slot_key: "discover", surface_key: "discover_panel" })
    ])
  }),
  [CHAT_ALERT_KEY.KINGDOM_WAR]: Object.freeze({
    tone: "social",
    throttle_key: "social_alert_toggle",
    surfaces: Object.freeze([
      Object.freeze({ slot_key: "event_hall", surface_key: "events_hall" }),
      Object.freeze({ slot_key: "leaderboard", surface_key: "leaderboard_panel" })
    ])
  }),
  [CHAT_ALERT_KEY.STREAK_RISK]: Object.freeze({
    tone: "progress",
    throttle_key: "progress_alert_toggle",
    surfaces: Object.freeze([
      Object.freeze({ slot_key: "mission_board", surface_key: "mission_quarter" }),
      Object.freeze({ slot_key: "status_hub", surface_key: "status_hub" })
    ])
  }),
  [CHAT_ALERT_KEY.PAYOUT_UPDATE]: Object.freeze({
    tone: "trust",
    throttle_key: "payout_alert_toggle",
    surfaces: Object.freeze([
      Object.freeze({ slot_key: "payout_lane", surface_key: "payout_screen" }),
      Object.freeze({ slot_key: "support", surface_key: "support_panel" })
    ])
  }),
  [CHAT_ALERT_KEY.RARE_DROP]: Object.freeze({
    tone: "reward",
    throttle_key: "reward_alert_toggle",
    surfaces: Object.freeze([
      Object.freeze({ slot_key: "reward_lane", surface_key: "rewards_vault" }),
      Object.freeze({ slot_key: "discover", surface_key: "discover_panel" })
    ])
  }),
  [CHAT_ALERT_KEY.COMEBACK_OFFER]: Object.freeze({
    tone: "reactivation",
    throttle_key: "marketing_alert_toggle",
    surfaces: Object.freeze([
      Object.freeze({ slot_key: "world_hub", surface_key: "play_world" }),
      Object.freeze({ slot_key: "reward_lane", surface_key: "rewards_vault" })
    ])
  }),
  [CHAT_ALERT_KEY.SEASON_DEADLINE]: Object.freeze({
    tone: "event",
    throttle_key: "event_alert_toggle",
    surfaces: Object.freeze([
      Object.freeze({ slot_key: "season_hall", surface_key: "season_hall" }),
      Object.freeze({ slot_key: "leaderboard", surface_key: "leaderboard_panel" })
    ])
  })
});

function normalizeChatAlertKey(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
}

function resolveChatAlertConfig(alertKey) {
  const key = normalizeChatAlertKey(alertKey);
  if (!key) {
    return null;
  }
  const config = CHAT_ALERT_CATALOG[key];
  if (!config) {
    return null;
  }
  return Object.freeze({
    key,
    tone: config.tone,
    throttle_key: config.throttle_key,
    surfaces: Array.isArray(config.surfaces) ? config.surfaces : []
  });
}

module.exports = {
  CHAT_ALERT_KEY,
  CHAT_ALERT_CATALOG,
  normalizeChatAlertKey,
  resolveChatAlertConfig
};
