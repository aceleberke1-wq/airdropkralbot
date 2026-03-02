"use strict";

const UnlockTier = Object.freeze({
  T0: "T0",
  T1: "T1",
  T2: "T2",
  T3: "T3"
});

const V5TypeNames = Object.freeze([
  "CommandContract",
  "CommandContractV2",
  "PayoutLockState",
  "UnlockTier",
  "ReleaseDripDecision",
  "UnifiedAdminQueueItem",
  "AdminQueueActionPayloadV2",
  "KpiBundleSnapshot",
  "MonetizationTrendPoint",
  "PayoutDisputeMetrics",
  "PvpProgressionState",
  "LocalizedStringMap",
  "WalletChallenge",
  "WalletSessionState",
  "KycStatus"
]);

const TypeShapes = Object.freeze({
  CommandContract: Object.freeze({
    key: "menu",
    aliases: ["start"],
    description_tr: "",
    description_en: "",
    intents: ["menu"],
    scenarios: ["menu"],
    outcomes: ["launcher panelini ac"],
    adminOnly: false,
    min_role: "player",
    handler: "menu",
    primary: true
  }),
  CommandContractV2: Object.freeze({
    key: "menu",
    aliases: ["start"],
    description_tr: "Ana paneli acar.",
    description_en: "Opens main panel.",
    intents: ["menu", "ana menu"],
    scenarios: ["/menu", "menuyu ac"],
    outcomes: ["launcher paneli acilir"],
    adminOnly: false,
    min_role: "player",
    handler: "menu"
  }),
  PayoutLockState: Object.freeze({
    can_request: false,
    entitled_btc: 0,
    requestable_btc: 0,
    release: {
      global_gate_open: false,
      unlock_tier: "T0",
      unlock_score: 0,
      today_drip_btc_remaining: 0
    }
  }),
  ReleaseDripDecision: Object.freeze({
    allowed: false,
    unlock_tier: "T0",
    today_drip_btc_remaining: 0,
    requestable_btc: 0
  }),
  UnifiedAdminQueueItem: Object.freeze({
    kind: "payout_request",
    request_id: 0,
    status: "requested",
    priority: 0,
    queue_age_sec: 0,
    policy_reason_code: "policy_unknown",
    policy_reason_text: "Policy reason missing.",
    action_policy: {}
  }),
  AdminQueueActionPayloadV2: Object.freeze({
    action_key: "payout_pay",
    kind: "payout_request",
    request_id: 1,
    confirm_token: "token_123",
    reason: "approved_by_admin",
    tx_hash: "0xabc123"
  }),
  KpiBundleSnapshot: Object.freeze({
    generated_at: "2026-03-02T00:00:00.000Z",
    config: {
      hours_short: 24,
      hours_long: 72,
      trend_days: 7,
      emit_slo: true
    },
    snapshots: {
      h24: {},
      h72: {}
    },
    weekly: {
      trend_days: 7,
      by_day: [],
      totals: {
        revenue_amount: 0,
        payout_total_requests: 0,
        payout_rejected_requests: 0,
        payout_rejected_rate_pct: 0
      }
    }
  }),
  MonetizationTrendPoint: Object.freeze({
    day: "2026-03-02",
    revenue_amount: 0,
    revenue_events: 0,
    payout_total_requests: 0,
    payout_rejected_requests: 0,
    payout_paid_requests: 0,
    payout_rejected_rate_pct: 0
  }),
  PayoutDisputeMetrics: Object.freeze({
    payout_total_requests: 0,
    payout_rejected_requests: 0,
    payout_rejected_rate_pct: 0
  }),
  PvpProgressionState: Object.freeze({
    daily_duel: {},
    weekly_ladder: {},
    season_arc_boss: {}
  }),
  LocalizedStringMap: Object.freeze({
    tr: {},
    en: {}
  }),
  WalletChallenge: Object.freeze({
    challenge_ref: "",
    chain: "eth",
    address: "",
    nonce: "",
    challenge_text: "",
    issued_at: "",
    expires_at: "",
    ttl_sec: 300
  }),
  WalletSessionState: Object.freeze({
    enabled: false,
    verify_mode: "format_only",
    active: false,
    chain: "",
    address: "",
    linked_at: null,
    expires_at: null,
    session_ref: "",
    kyc_status: "unknown"
  }),
  KycStatus: Object.freeze({
    status: "unknown",
    tier: "none",
    required: false,
    blocked: false,
    reason_code: ""
  })
});

module.exports = {
  UnlockTier,
  V5TypeNames,
  TypeShapes
};
