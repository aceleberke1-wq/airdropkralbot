"use strict";

const { z } = require("zod");
const { SETTLEMENT_TOKEN_SYMBOL } = require("../currencyGlossary");
const { isSafeNavigationKey, normalizeTabKey } = require("../navigationContract");
const { isSafeAnalyticsKey } = require("../telemetryContract");
const {
  LIVE_OPS_SEGMENT_KEY,
  LIVE_OPS_CAMPAIGN_STATUS,
  LIVE_OPS_APPROVAL_STATE
} = require("../liveOpsCampaignContract");

const LocalizedStringMapSchema = z
  .object({
    tr: z.string().default(""),
    en: z.string().default("")
  })
  .partial()
  .default({});

const CommandContractV2Schema = z.object({
  key: z.string().min(1),
  aliases: z.array(z.string().min(1)).default([]),
  description_tr: z.string().default(""),
  description_en: z.string().default(""),
  intents: z.array(z.string().min(1)).default([]),
  scenarios: z.array(z.string().min(1)).default([]),
  outcomes: z.array(z.string().min(1)).default([]),
  adminOnly: z.boolean().default(false),
  min_role: z.enum(["player", "admin", "superadmin"]).default("player"),
  handler: z.string().min(1),
  primary: z.boolean().optional()
});

const CommandCatalogSchema = z.array(CommandContractV2Schema).default([]);

const PayoutLockStateSchema = z.object({
  global_gate_open: z.boolean(),
  unlock_tier: z.enum(["T0", "T1", "T2", "T3"]).default("T0"),
  unlock_progress: z.number().min(0).max(1).default(0),
  next_tier_target: z.string().default(""),
  today_drip_btc_remaining: z.number().min(0).default(0)
});

const WalletCapabilitySchema = z.object({
  chain: z.string().min(2),
  auth_mode: z.string().min(2),
  rollout: z.string().default("primary"),
  enabled: z.boolean().default(false)
});

const WalletCapabilitiesSchema = z.object({
  enabled: z.boolean().default(false),
  verify_mode: z.string().default("format_only"),
  session_ttl_sec: z.number().int().min(60).default(86400),
  challenge_ttl_sec: z.number().int().min(60).default(300),
  chains: z.array(WalletCapabilitySchema).default([])
});

const UnifiedAdminQueueItemSchema = z.object({
  kind: z.string().min(2),
  request_id: z.number().int().nonnegative(),
  status: z.string().min(2),
  priority: z.number().int().default(0),
  queue_age_sec: z.number().int().nonnegative().default(0),
  policy_reason_code: z.string().default("policy_unknown"),
  policy_reason_text: z.string().default(""),
  action_policy: z.record(z.any()).default({})
});

const RuntimeFlagsEffectiveSchema = z.record(z.boolean()).default({});

const BootstrapV2UiShellSchema = z.object({
  ui_version: z.string().default("react_v1_neon_arena"),
  default_tab: z.enum(["home", "pvp", "tasks", "vault"]).default("home"),
  tabs: z.array(z.enum(["home", "pvp", "tasks", "vault"])).default(["home", "pvp", "tasks", "vault"]),
  admin_workspace_enabled: z.boolean().default(false),
  onboarding_version: z.string().default("v1")
});

const ExperimentAssignmentSchema = z.object({
  key: z.string().default("webapp_react_v1"),
  variant: z.enum(["control", "treatment"]).default("control"),
  assigned_at: z.string().default(""),
  cohort_bucket: z.number().int().min(0).max(99).default(0)
});

const UiEventBatchAnalyticsConfigSchema = z.object({
  session_ref: z.string().default(""),
  flush_interval_ms: z.number().int().min(500).max(60000).default(6000),
  max_batch_size: z.number().int().min(1).max(200).default(40),
  sample_rate: z.number().min(0).max(1).default(1)
});

const BootstrapV2DataSchema = z.object({
  ux: z
    .object({
      default_mode: z.enum(["player", "ops", "advanced"]).default("player"),
      language: z.enum(["tr", "en"]).default("tr"),
      advanced_enabled: z.boolean().default(false)
    })
    .default({ default_mode: "player", language: "tr", advanced_enabled: false }),
  payout_lock: PayoutLockStateSchema.optional(),
  pvp_content: z
    .object({
      daily_duel: z.record(z.any()).default({}),
      weekly_ladder: z.record(z.any()).default({}),
      season_arc_boss: z.record(z.any()).default({})
    })
    .partial()
    .default({}),
  command_catalog: CommandCatalogSchema.optional(),
  runtime_flags_effective: RuntimeFlagsEffectiveSchema.optional(),
  wallet_capabilities: WalletCapabilitiesSchema.optional(),
  ui_shell: BootstrapV2UiShellSchema.optional(),
  experiment: ExperimentAssignmentSchema.optional(),
  analytics: UiEventBatchAnalyticsConfigSchema.optional(),
  api_version: z.string().default("v2")
});

const KpiWindowSnapshotSchema = z.object({
  generated_at: z.string().optional(),
  window_hours: z.number().optional(),
  kpis: z.record(z.number()).optional(),
  details: z.record(z.any()).optional(),
  schema: z.record(z.any()).optional()
});

const MonetizationTrendPointSchema = z.object({
  day: z.string(),
  revenue_amount: z.number().default(0),
  revenue_events: z.number().int().default(0),
  payout_total_requests: z.number().int().default(0),
  payout_rejected_requests: z.number().int().default(0),
  payout_paid_requests: z.number().int().default(0),
  payout_rejected_rate_pct: z.number().default(0)
});

const PayoutDisputeMetricsSchema = z.object({
  payout_total_requests: z.number().int().default(0),
  payout_rejected_requests: z.number().int().default(0),
  payout_rejected_rate_pct: z.number().default(0)
});

const KpiBundleSnapshotSchema = z.object({
  generated_at: z.string(),
  config: z.object({
    hours_short: z.number().int().positive(),
    hours_long: z.number().int().positive(),
    trend_days: z.number().int().positive(),
    emit_slo: z.boolean()
  }),
  snapshots: z.object({
    h24: KpiWindowSnapshotSchema,
    h72: KpiWindowSnapshotSchema
  }),
  weekly: z.object({
    trend_days: z.number().int().positive(),
    by_day: z.array(MonetizationTrendPointSchema).default([]),
    totals: PayoutDisputeMetricsSchema.extend({
      revenue_amount: z.number().default(0)
    }).default({
      revenue_amount: 0,
      payout_total_requests: 0,
      payout_rejected_requests: 0,
      payout_rejected_rate_pct: 0
    }),
    monetization: z.record(z.any()).default({})
  })
});

const KpiBundleRunRequestSchema = z.object({
  uid: z.string().min(1),
  ts: z.string().min(1),
  sig: z.string().min(12),
  hours_short: z.number().int().min(1).max(168).optional(),
  hours_long: z.number().int().min(1).max(168).optional(),
  trend_days: z.number().int().min(1).max(30).optional(),
  emit_slo: z.boolean().optional()
});

const LiveOpsCampaignDailyTrendPointSchema = z.object({
  day: z.string().default(""),
  sent_count: z.number().int().nonnegative().default(0),
  unique_users: z.number().int().nonnegative().default(0)
});

const KpiLiveOpsCampaignBreakdownSchema = z.object({
  bucket_key: z.string().default("unknown"),
  item_count: z.number().int().nonnegative().default(0)
});

const SceneRuntimeDailySummarySchema = z.object({
  day: z.string().default(""),
  total_count: z.number().int().nonnegative().default(0),
  ready_count: z.number().int().nonnegative().default(0),
  failed_count: z.number().int().nonnegative().default(0),
  low_end_count: z.number().int().nonnegative().default(0),
  ready_rate: z.number().min(0).max(1).default(0),
  failure_rate: z.number().min(0).max(1).default(0),
  low_end_share: z.number().min(0).max(1).default(0),
  health_band: z.string().default("no_data")
});

const SceneRuntimeCompactSummarySchema = z.object({
  ready_24h: z.number().int().nonnegative().default(0),
  failed_24h: z.number().int().nonnegative().default(0),
  total_24h: z.number().int().nonnegative().default(0),
  low_end_24h: z.number().int().nonnegative().default(0),
  ready_rate_24h: z.number().min(0).max(1).default(0),
  failure_rate_24h: z.number().min(0).max(1).default(0),
  low_end_share_24h: z.number().min(0).max(1).default(0),
  avg_loaded_bundles_24h: z.number().nonnegative().default(0),
  health_band_24h: z.string().default("no_data"),
  ready_rate_7d_avg: z.number().min(0).max(1).default(0),
  failure_rate_7d_avg: z.number().min(0).max(1).default(0),
  low_end_share_7d_avg: z.number().min(0).max(1).default(0),
  trend_direction_7d: z.string().default("no_data"),
  trend_delta_ready_rate_7d: z.number().default(0),
  alarm_state_7d: z.string().default("no_data"),
  alarm_reasons_7d: z.array(z.string()).default([]),
  band_breakdown_7d: z.array(KpiLiveOpsCampaignBreakdownSchema).default([]),
  quality_breakdown_24h: z.array(KpiLiveOpsCampaignBreakdownSchema).default([]),
  perf_breakdown_24h: z.array(KpiLiveOpsCampaignBreakdownSchema).default([]),
  daily_breakdown_7d: z.array(SceneRuntimeDailySummarySchema).default([]),
  worst_day_7d: SceneRuntimeDailySummarySchema.nullable().default(null)
});

const KpiLiveOpsCampaignSummarySchema = z.object({
  available: z.boolean().default(false),
  error_code: z.string().default(""),
  campaign_key: z.string().default(""),
  version: z.number().int().nonnegative().default(0),
  enabled: z.boolean().default(false),
  status: z.string().default(""),
  approval_state: z.string().default("not_requested"),
  schedule_state: z.string().default("missing"),
  ready_for_auto_dispatch: z.boolean().default(false),
  scene_gate_state: z.enum(["clear", "watch", "alert", "no_data"]).default("no_data"),
  scene_gate_effect: z.enum(["open", "capped", "blocked"]).default("open"),
  scene_gate_reason: z.string().default(""),
  scene_gate_recipient_cap: z.number().int().nonnegative().default(0),
  latest_dispatch_ref: z.string().default(""),
  latest_dispatch_at: z.string().nullable().default(null),
  latest_auto_dispatch_ref: z.string().default(""),
  latest_auto_dispatch_at: z.string().nullable().default(null),
  sent_24h: z.number().int().nonnegative().default(0),
  sent_7d: z.number().int().nonnegative().default(0),
  unique_users_7d: z.number().int().nonnegative().default(0),
  experiment_key: z.string().default("webapp_react_v1"),
  experiment_assignment_available: z.boolean().default(false),
  daily_breakdown: z.array(LiveOpsCampaignDailyTrendPointSchema).default([]),
  locale_breakdown: z.array(KpiLiveOpsCampaignBreakdownSchema).default([]),
  segment_breakdown: z.array(KpiLiveOpsCampaignBreakdownSchema).default([]),
  surface_breakdown: z.array(KpiLiveOpsCampaignBreakdownSchema).default([]),
  variant_breakdown: z.array(KpiLiveOpsCampaignBreakdownSchema).default([]),
  cohort_breakdown: z.array(KpiLiveOpsCampaignBreakdownSchema).default([]),
  scene_runtime: SceneRuntimeCompactSummarySchema.default({})
});

const KpiBundleSnapshotResponseSchema = z.object({
  api_version: z.literal("v2"),
  snapshot: KpiBundleSnapshotSchema,
  webapp_experiment: z
    .object({
      available: z.boolean().default(false),
      experiment_key: z.string().default("webapp_react_v1"),
      generated_at: z.string().default(""),
      variants: z.record(
        z.object({
          assigned_users: z.number().int().nonnegative().default(0),
          active_users_24h: z.number().int().nonnegative().default(0),
          active_users_7d: z.number().int().nonnegative().default(0),
          sessions_24h: z.number().int().nonnegative().default(0),
          events_24h: z.number().int().nonnegative().default(0),
          avg_events_per_user_24h: z.number().nonnegative().default(0),
          avg_events_per_session_24h: z.number().nonnegative().default(0)
        })
      )
    })
    .optional(),
  live_ops_campaign: KpiLiveOpsCampaignSummarySchema.optional(),
  run: z
    .object({
      run_ref: z.string().min(4),
      status: z.enum(["success", "failed", "timeout"]),
      duration_ms: z.number().int().nonnegative(),
      started_at: z.string(),
      finished_at: z.string()
    })
    .optional(),
  source: z.enum(["docs_latest", "kpi_bundle_runner"]).default("docs_latest")
});

const AdminQueueActionPayloadV2Schema = z.object({
  action_key: z.string().min(3).max(64),
  kind: z.string().min(3).max(64).optional(),
  request_id: z.number().int().positive(),
  confirm_token: z.string().min(16).max(128).optional(),
  reason: z.string().max(300).optional(),
  tx_hash: z.string().max(180).optional()
});

const WebAppAuthEnvelopeSchema = z.object({
  uid: z.string().min(1),
  ts: z.string().min(1),
  sig: z.string().min(1)
});

const WebAppActionMutationRequestV2Schema = WebAppAuthEnvelopeSchema.extend({
  action_request_id: z.string().min(6).max(120)
});

const PlayerActionAcceptRequestV2Schema = WebAppActionMutationRequestV2Schema.extend({
  offer_id: z.number().int().positive()
});

const PlayerActionCompleteRequestV2Schema = WebAppActionMutationRequestV2Schema.extend({
  attempt_id: z.number().int().positive().optional(),
  mode: z.string().min(2).max(24).optional()
});

const PlayerActionRevealRequestV2Schema = WebAppActionMutationRequestV2Schema.extend({
  attempt_id: z.number().int().positive().optional()
});

const PlayerActionClaimMissionRequestV2Schema = WebAppActionMutationRequestV2Schema.extend({
  mission_key: z.string().min(3).max(64)
});

const PvpSessionStartRequestV2Schema = WebAppActionMutationRequestV2Schema.extend({
  mode_suggested: z.enum(["safe", "balanced", "aggressive"]).optional(),
  transport: z.enum(["poll", "ws"]).optional()
});

const PvpSessionActionRequestV2Schema = WebAppAuthEnvelopeSchema.extend({
  session_ref: z.string().min(8).max(128),
  action_seq: z.number().int().positive(),
  input_action: z.string().min(3).max(24),
  latency_ms: z.number().int().min(0).optional(),
  client_ts: z.number().int().min(0).optional(),
  action_request_id: z.string().min(6).max(120).optional()
});

const PvpSessionResolveRequestV2Schema = WebAppAuthEnvelopeSchema.extend({
  session_ref: z.string().min(8).max(128),
  action_request_id: z.string().min(6).max(120).optional()
});

const TokenMintRequestV2Schema = WebAppActionMutationRequestV2Schema.extend({
  amount: z.number().positive().optional()
});

const TokenBuyIntentRequestV2Schema = WebAppActionMutationRequestV2Schema.extend({
  usd_amount: z.number().min(0.5),
  chain: z.string().min(2).max(12)
});

const TokenSubmitTxRequestV2Schema = WebAppAuthEnvelopeSchema.extend({
  request_id: z.number().int().positive(),
  tx_hash: z.string().min(24).max(256),
  action_request_id: z.string().min(6).max(120)
});

const PlayerActionResponseV2Schema = z
  .object({
    api_version: z.literal("v2"),
    action_request_id: z.string().min(6).max(120).optional(),
    snapshot: z.record(z.any()).optional()
  })
  .passthrough();

const PvpMutationResponseV2Schema = z
  .object({
    api_version: z.literal("v2"),
    action_request_id: z.string().min(6).max(120).optional(),
    session: z.record(z.any()).nullable().optional()
  })
  .passthrough();

const PvpSessionStateResponseV2Schema = z
  .object({
    api_version: z.literal("v2"),
    session: z.record(z.any()).nullable().optional()
  })
  .passthrough();

const PvpLiveResponseV2Schema = z
  .object({
    api_version: z.literal("v2")
  })
  .passthrough();

const TokenQueryResponseV2Schema = z
  .object({
    api_version: z.literal("v2")
  })
  .passthrough();

const TokenActionResponseV2Schema = z
  .object({
    api_version: z.literal("v2"),
    action_request_id: z.string().min(6).max(120).optional()
  })
  .passthrough();

const WalletSessionStateV2Schema = z
  .object({
    enabled: z.boolean().optional(),
    verify_mode: z.string().optional(),
    active: z.boolean().optional(),
    chain: z.string().optional(),
    address: z.string().optional(),
    address_masked: z.string().optional(),
    linked_at: z.string().nullable().optional(),
    expires_at: z.string().nullable().optional(),
    session_ref: z.string().optional(),
    kyc_status: z.string().optional()
  })
  .passthrough();

const WalletSessionResponseV2Schema = z
  .object({
    api_version: z.literal("v2"),
    wallet_capabilities: z.record(z.any()).default({}),
    wallet_session: WalletSessionStateV2Schema.default({}),
    links: z.array(z.record(z.any())).default([]),
    kyc_status: z.record(z.any()).default({})
  })
  .passthrough();

const PayoutStatusResponseV2Schema = z
  .object({
    api_version: z.literal("v2"),
    currency: z.string().optional(),
    can_request: z.boolean().optional(),
    unlock_tier: z.string().optional(),
    unlock_progress: z.number().optional(),
    requestable_btc: z.number().optional(),
    entitled_btc: z.number().optional(),
    latest_request_id: z.number().optional(),
    latest_status: z.string().optional(),
    payout_gate: z.record(z.any()).optional(),
    payout_release: z.record(z.any()).optional()
  })
  .passthrough();

const PayoutMutationResponseV2Schema = z
  .object({
    api_version: z.literal("v2")
  })
  .passthrough();

const UiPreferencesSchema = z.object({
  ui_mode: z.string().default("hardcore"),
  quality_mode: z.string().default("auto"),
  reduced_motion: z.boolean().default(false),
  large_text: z.boolean().default(false),
  sound_enabled: z.boolean().default(true),
  updated_at: z.string().nullable().default(null),
  prefs_json: z
    .object({
      language: z.enum(["tr", "en"]).default("tr"),
      onboarding_completed: z.boolean().default(false),
      onboarding_version: z.string().default("v1"),
      advanced_view: z.boolean().default(false),
      last_tab: z.enum(["home", "pvp", "tasks", "vault"]).default("home"),
      workspace: z.enum(["player", "admin"]).default("player")
    })
    .passthrough()
    .default({
      language: "tr",
      onboarding_completed: false,
      onboarding_version: "v1",
      advanced_view: false,
      last_tab: "home",
      workspace: "player"
    })
});

const UiPreferencesResponseV2Schema = z.object({
  api_version: z.literal("v2"),
  ui_preferences: UiPreferencesSchema
});

const UiEventSchema = z.object({
  event_key: z.string().min(2).max(80).refine((value) => isSafeAnalyticsKey(value), "invalid_event_key"),
  tab_key: z
    .string()
    .min(1)
    .max(40)
    .transform((value) => normalizeTabKey(value, "home"))
    .default("home"),
  panel_key: z
    .string()
    .min(1)
    .max(64)
    .refine((value) => isSafeNavigationKey(value, 64), "invalid_panel_key")
    .default("default"),
  route_key: z
    .string()
    .max(80)
    .refine((value) => !value || isSafeNavigationKey(value, 80), "invalid_route_key")
    .default(""),
  focus_key: z
    .string()
    .max(80)
    .refine((value) => !value || isSafeNavigationKey(value, 80), "invalid_focus_key")
    .default(""),
  funnel_key: z.string().max(64).default(""),
  surface_key: z.string().max(64).default(""),
  economy_event_key: z.string().max(80).refine((value) => !value || isSafeAnalyticsKey(value), "invalid_economy_event_key").default(""),
  tx_state: z.string().max(32).default(""),
  event_value: z.number().default(0),
  value_usd: z.number().min(0).default(0),
  payload_json: z.record(z.any()).default({}),
  client_ts: z.string().default(""),
  variant_key: z.string().max(24).default("control"),
  experiment_key: z.string().max(80).default("webapp_react_v1"),
  cohort_bucket: z.number().int().min(0).max(99).default(0)
});

const HomeFeedV2Schema = z.object({
  api_version: z.literal("v2"),
  generated_at: z.string(),
  profile: z.record(z.any()).default({}),
  season: z.record(z.any()).default({}),
  daily: z.record(z.any()).default({}),
  contract: z.record(z.any()).default({}),
  risk: z.record(z.any()).default({}),
  mission: z.record(z.any()).default({}),
  wallet_quick: z.record(z.any()).default({}),
  monetization_quick: z.record(z.any()).default({}),
  surface_actions: z.record(z.array(z.record(z.any()))).default({}),
  command_hint: z.array(z.record(z.any())).default([])
});

const PvpLeagueOverviewV2Schema = z.object({
  api_version: z.literal("v2"),
  generated_at: z.string(),
  daily_duel: z.record(z.any()).default({}),
  weekly_ladder: z.record(z.any()).default({}),
  season_arc_boss: z.record(z.any()).default({}),
  leaderboard_snippet: z.array(z.record(z.any())).default([]),
  last_session_trend: z.array(z.record(z.any())).default([]),
  session_snapshot: z.record(z.any()).default({})
});

const VaultOverviewV2Schema = z.object({
  api_version: z.literal("v2"),
  generated_at: z.string(),
  token_summary: z.record(z.any()).default({}),
  route_status: z.record(z.any()).default({}),
  payout_status: z.record(z.any()).default({}),
  wallet_session: z.record(z.any()).default({}),
  monetization_status: z.record(z.any()).default({})
});

const MonetizationOverviewV2Schema = z.object({
  api_version: z.literal("v2"),
  generated_at: z.string(),
  catalog: z.record(z.any()).default({}),
  status: z.record(z.any()).default({}),
  active_effects: z.record(z.any()).default({})
});

const MonetizationPurchaseResponseV2Schema = z
  .object({
    api_version: z.literal("v2"),
    purchase: z.record(z.any()).optional(),
    balances: z.record(z.any()).optional(),
    monetization: z.record(z.any()).optional()
  })
  .passthrough();

const AdminMonetizationFeeEventResponseV2Schema = z
  .object({
    api_version: z.literal("v2"),
    event: z
      .object({
        event_ref: z.string().min(1),
        user_id: z.number().int().positive(),
        fee_kind: z.string().min(1),
        gross_amount: z.number().min(0),
        fee_amount: z.number().min(0),
        fee_currency: z.string().min(2).max(8),
        created_at: z.string().min(1)
      })
      .passthrough()
  })
  .passthrough();

const DynamicAutoPolicySegmentSchema = z.object({
  token_symbol: z.string().default(SETTLEMENT_TOKEN_SYMBOL),
  segment_key: z.string().min(3).max(64),
  priority: z.number().int().min(1).max(999).default(100),
  max_auto_usd: z.number().min(0.5).default(10),
  risk_threshold: z.number().min(0).max(1).default(0.35),
  velocity_per_hour: z.number().int().min(1).default(8),
  require_onchain_verified: z.boolean().default(true),
  require_kyc_status: z.string().default(""),
  enabled: z.boolean().default(true),
  degrade_factor: z.number().min(0.3).max(1).default(1),
  meta_json: z.record(z.any()).default({}),
  updated_by: z.number().int().default(0),
  updated_at: z.string().nullable().default(null)
});

const DynamicAutoPolicySchema = z.object({
  api_version: z.literal("v2"),
  token_symbol: z.string().default(SETTLEMENT_TOKEN_SYMBOL),
  base_policy: z.record(z.any()).default({}),
  anomaly_state: z.record(z.any()).default({}),
  segments: z.array(DynamicAutoPolicySegmentSchema).default([]),
  preview: z.record(z.any()).nullable().default(null),
  generated_at: z.string().optional(),
  updated_at: z.string().optional()
});

const LiveOpsCampaignSurfaceSchema = z.object({
  slot_key: z.string().min(1).max(32),
  surface_key: z.string().min(1).max(64)
});

const LiveOpsCampaignTargetingSchema = z.object({
  segment_key: z.enum(Object.values(LIVE_OPS_SEGMENT_KEY)).default(LIVE_OPS_SEGMENT_KEY.INACTIVE_RETURNING),
  inactive_hours: z.number().int().min(24).max(720).default(72),
  max_age_days: z.number().int().min(3).max(120).default(30),
  active_within_days: z.number().int().min(1).max(60).default(14),
  locale_filter: z.string().max(8).default(""),
  max_recipients: z.number().int().min(1).max(500).default(50),
  dedupe_hours: z.number().int().min(1).max(720).default(72)
});

const LiveOpsCampaignScheduleSchema = z.object({
  timezone: z.string().min(1).max(64).default("UTC"),
  start_at: z.string().datetime().nullable().default(null),
  end_at: z.string().datetime().nullable().default(null)
});

const LiveOpsCampaignApprovalSchema = z.object({
  required: z.boolean().default(true),
  state: z.enum(Object.values(LIVE_OPS_APPROVAL_STATE)).default(LIVE_OPS_APPROVAL_STATE.NOT_REQUESTED),
  requested_by: z.number().int().nonnegative().default(0),
  requested_at: z.string().datetime().nullable().default(null),
  approved_by: z.number().int().nonnegative().default(0),
  approved_at: z.string().datetime().nullable().default(null),
  last_action_by: z.number().int().nonnegative().default(0),
  last_action_at: z.string().datetime().nullable().default(null),
  note: z.string().max(240).default("")
});

const LiveOpsCampaignConfigSchema = z.object({
  api_version: z.literal("v2").default("v2"),
  campaign_key: z.string().min(3).max(64),
  enabled: z.boolean().default(false),
  status: z.enum(Object.values(LIVE_OPS_CAMPAIGN_STATUS)).default(LIVE_OPS_CAMPAIGN_STATUS.DRAFT),
  targeting: LiveOpsCampaignTargetingSchema.default({}),
  copy: z
    .object({
      title: LocalizedStringMapSchema.default({}),
      body: LocalizedStringMapSchema.default({}),
      note: LocalizedStringMapSchema.default({})
    })
    .default({}),
  schedule: LiveOpsCampaignScheduleSchema.default({}),
  approval: LiveOpsCampaignApprovalSchema.default({}),
  surfaces: z.array(LiveOpsCampaignSurfaceSchema).min(1).max(3).default([])
});

const LiveOpsCampaignApprovalSummarySchema = z.object({
  live_dispatch_ready: z.boolean().default(false),
  enabled: z.boolean().default(false),
  status: z.enum(Object.values(LIVE_OPS_CAMPAIGN_STATUS)).default(LIVE_OPS_CAMPAIGN_STATUS.DRAFT),
  segment_key: z.enum(Object.values(LIVE_OPS_SEGMENT_KEY)).default(LIVE_OPS_SEGMENT_KEY.INACTIVE_RETURNING),
  max_recipients: z.number().int().min(1).max(500).default(50),
  dedupe_hours: z.number().int().min(1).max(720).default(72),
  surface_count: z.number().int().nonnegative().default(0),
  last_saved_at: z.string().nullable().default(null),
  last_dispatch_at: z.string().nullable().default(null),
  approval_required: z.boolean().default(true),
  approval_state: z.enum(Object.values(LIVE_OPS_APPROVAL_STATE)).default(LIVE_OPS_APPROVAL_STATE.NOT_REQUESTED),
  approval_requested_at: z.string().nullable().default(null),
  approval_requested_by: z.number().int().nonnegative().default(0),
  approval_approved_at: z.string().nullable().default(null),
  approval_approved_by: z.number().int().nonnegative().default(0),
  schedule_timezone: z.string().default("UTC"),
  schedule_start_at: z.string().nullable().default(null),
  schedule_end_at: z.string().nullable().default(null),
  schedule_state: z.enum(["missing", "invalid", "scheduled", "open", "expired"]).default("missing"),
  warnings: z.array(z.string()).default([])
});

const LiveOpsCampaignVersionHistoryRowSchema = z.object({
  version: z.number().int().nonnegative().default(0),
  updated_at: z.string().nullable().default(null),
  updated_by: z.number().int().nonnegative().default(0),
  campaign_key: z.string().default(""),
  enabled: z.boolean().default(false),
  status: z.enum(Object.values(LIVE_OPS_CAMPAIGN_STATUS)).default(LIVE_OPS_CAMPAIGN_STATUS.DRAFT),
  segment_key: z.enum(Object.values(LIVE_OPS_SEGMENT_KEY)).default(LIVE_OPS_SEGMENT_KEY.INACTIVE_RETURNING),
  max_recipients: z.number().int().min(1).max(500).default(50),
  dedupe_hours: z.number().int().min(1).max(720).default(72)
});

const LiveOpsCampaignDispatchHistoryRowSchema = z.object({
  action: z.enum(["live_ops_campaign_dry_run", "live_ops_campaign_dispatch"]).default("live_ops_campaign_dry_run"),
  created_at: z.string().nullable().default(null),
  admin_id: z.number().int().nonnegative().default(0),
  campaign_key: z.string().default(""),
  campaign_version: z.number().int().nonnegative().default(0),
  dispatch_ref: z.string().default(""),
  dispatch_source: z.enum(["manual", "scheduler"]).default("manual"),
  window_key: z.string().default(""),
  segment_key: z.string().default(""),
  reason: z.string().default(""),
  dry_run: z.boolean().default(true),
  attempted: z.number().int().nonnegative().default(0),
  sent: z.number().int().nonnegative().default(0),
  recorded: z.number().int().nonnegative().default(0),
  skipped_disabled: z.number().int().nonnegative().default(0)
});

const LiveOpsCampaignOperatorTimelineRowSchema = z.object({
  action: z
    .enum([
      "live_ops_campaign_save",
      "live_ops_campaign_request",
      "live_ops_campaign_approve",
      "live_ops_campaign_revoke",
      "live_ops_campaign_scheduler_skip",
      "live_ops_campaign_dry_run",
      "live_ops_campaign_dispatch"
    ])
    .default("live_ops_campaign_save"),
  created_at: z.string().nullable().default(null),
  admin_id: z.number().int().nonnegative().default(0),
  campaign_key: z.string().default(""),
  campaign_version: z.number().int().nonnegative().default(0),
  reason: z.string().default(""),
  enabled: z.boolean().default(false),
  status: z.enum(Object.values(LIVE_OPS_CAMPAIGN_STATUS)).default(LIVE_OPS_CAMPAIGN_STATUS.DRAFT),
  approval_state: z.enum(Object.values(LIVE_OPS_APPROVAL_STATE)).default(LIVE_OPS_APPROVAL_STATE.NOT_REQUESTED),
  schedule_state: z.enum(["missing", "invalid", "scheduled", "open", "expired"]).default("missing"),
  dispatch_ref: z.string().default(""),
  dispatch_source: z.enum(["manual", "scheduler"]).default("manual"),
  window_key: z.string().default(""),
  dry_run: z.boolean().default(false)
});

const LiveOpsCampaignSchedulerSummarySchema = z.object({
  ready_for_auto_dispatch: z.boolean().default(false),
  schedule_state: z.enum(["missing", "invalid", "scheduled", "open", "expired"]).default("missing"),
  approval_state: z.enum(Object.values(LIVE_OPS_APPROVAL_STATE)).default(LIVE_OPS_APPROVAL_STATE.NOT_REQUESTED),
  scene_gate_state: z.enum(["clear", "watch", "alert", "no_data"]).default("no_data"),
  scene_gate_effect: z.enum(["open", "capped", "blocked"]).default("open"),
  scene_gate_reason: z.string().default(""),
  scene_gate_recipient_cap: z.number().int().nonnegative().default(0),
  window_key: z.string().default(""),
  already_dispatched_for_window: z.boolean().default(false),
  latest_auto_dispatch_at: z.string().nullable().default(null),
  latest_auto_dispatch_ref: z.string().default(""),
  latest_auto_dispatch_reason: z.string().default("")
});

const LiveOpsCampaignTaskSummarySchema = z.object({
  artifact_found: z.boolean().default(false),
  artifact_path: z.string().default(""),
  artifact_generated_at: z.string().nullable().default(null),
  artifact_age_min: z.number().nonnegative().nullable().default(null),
  ok: z.boolean().default(false),
  skipped: z.boolean().default(false),
  reason: z.string().default(""),
  dispatch_ref: z.string().default(""),
  dispatch_source: z.string().default(""),
  scene_gate_state: z.enum(["clear", "watch", "alert", "no_data"]).default("no_data"),
  scene_gate_effect: z.enum(["open", "capped", "blocked"]).default("open"),
  scene_gate_reason: z.string().default(""),
  scene_gate_recipient_cap: z.number().int().nonnegative().default(0),
  window_key: z.string().default("")
});

const LiveOpsCampaignAnalyticsBucketSchema = z.object({
  bucket_key: z.string().default("unknown"),
  item_count: z.number().int().nonnegative().default(0)
});

const LiveOpsCampaignDeliverySummarySchema = z.object({
  sent_24h: z.number().int().nonnegative().default(0),
  sent_7d: z.number().int().nonnegative().default(0),
  unique_users_7d: z.number().int().nonnegative().default(0),
  experiment_key: z.string().default("webapp_react_v1"),
  experiment_assignment_available: z.boolean().default(false),
  daily_breakdown: z.array(LiveOpsCampaignDailyTrendPointSchema).default([]),
  locale_breakdown: z.array(LiveOpsCampaignAnalyticsBucketSchema).default([]),
  segment_breakdown: z.array(LiveOpsCampaignAnalyticsBucketSchema).default([]),
  surface_breakdown: z.array(LiveOpsCampaignAnalyticsBucketSchema).default([]),
  variant_breakdown: z.array(LiveOpsCampaignAnalyticsBucketSchema).default([]),
  cohort_breakdown: z.array(LiveOpsCampaignAnalyticsBucketSchema).default([])
});

const LiveOpsCampaignSnapshotSchema = z.object({
  api_version: z.literal("v2"),
  config_key: z.string().default("live_ops_chat_campaign_v1"),
  version: z.number().int().nonnegative().default(0),
  updated_at: z.string().nullable().default(null),
  updated_by: z.number().int().nonnegative().default(0),
  campaign: LiveOpsCampaignConfigSchema,
  approval_summary: LiveOpsCampaignApprovalSummarySchema.default({}),
  scheduler_summary: LiveOpsCampaignSchedulerSummarySchema.default({}),
  version_history: z.array(LiveOpsCampaignVersionHistoryRowSchema).default([]),
  dispatch_history: z.array(LiveOpsCampaignDispatchHistoryRowSchema).default([]),
  operator_timeline: z.array(LiveOpsCampaignOperatorTimelineRowSchema).default([]),
  delivery_summary: LiveOpsCampaignDeliverySummarySchema.default({}),
  scene_runtime_summary: SceneRuntimeCompactSummarySchema.default({}),
  task_summary: LiveOpsCampaignTaskSummarySchema.default({}),
  latest_dispatch: z
    .object({
      event_type: z.string().default("live_ops_campaign_sent"),
      sent_total: z.number().int().nonnegative().default(0),
      sent_72h: z.number().int().nonnegative().default(0),
      last_sent_at: z.string().nullable().default(null),
      last_segment_key: z.string().default(""),
      last_dispatch_ref: z.string().default("")
    })
    .default({})
});

const LiveOpsCampaignUpsertRequestSchema = WebAppAuthEnvelopeSchema.extend({
  reason: z.string().max(240).optional(),
  campaign: LiveOpsCampaignConfigSchema
});

const LiveOpsCampaignDispatchRequestSchema = WebAppAuthEnvelopeSchema.extend({
  dry_run: z.boolean().default(true),
  max_recipients: z.number().int().min(1).max(500).optional(),
  reason: z.string().max(240).optional(),
  campaign: LiveOpsCampaignConfigSchema.optional()
});

const LiveOpsCampaignDispatchResponseSchema = z.object({
  api_version: z.literal("v2"),
  campaign_key: z.string().min(3).max(64),
  version: z.number().int().nonnegative().default(0),
  dry_run: z.boolean().default(true),
  segment_key: z.string().default(""),
  attempted: z.number().int().nonnegative().default(0),
  sent: z.number().int().nonnegative().default(0),
  recorded: z.number().int().nonnegative().default(0),
  skipped_disabled: z.number().int().nonnegative().default(0),
  dispatch_ref: z.string().default(""),
  dispatch_source: z.enum(["manual", "scheduler"]).default("manual"),
  window_key: z.string().default(""),
  sample_users: z.array(z.record(z.any())).default([]),
  generated_at: z.string()
});

const LiveOpsCampaignApprovalActionSchema = z.enum(["request", "approve", "revoke"]);

const LiveOpsCampaignApprovalRequestSchema = WebAppAuthEnvelopeSchema.extend({
  approval_action: LiveOpsCampaignApprovalActionSchema,
  reason: z.string().max(240).optional(),
  campaign: LiveOpsCampaignConfigSchema.optional()
});

module.exports = {
  AdminQueueActionPayloadV2Schema,
  BootstrapV2DataSchema,
  BootstrapV2UiShellSchema,
  CommandCatalogSchema,
  CommandContractV2Schema,
  ExperimentAssignmentSchema,
  KpiBundleRunRequestSchema,
  KpiLiveOpsCampaignSummarySchema,
  KpiBundleSnapshotResponseSchema,
  KpiBundleSnapshotSchema,
  SceneRuntimeCompactSummarySchema,
  SceneRuntimeDailySummarySchema,
  LiveOpsCampaignDailyTrendPointSchema,
  LocalizedStringMapSchema,
  MonetizationTrendPointSchema,
  PayoutDisputeMetricsSchema,
  PayoutLockStateSchema,
  PlayerActionAcceptRequestV2Schema,
  PlayerActionClaimMissionRequestV2Schema,
  PlayerActionCompleteRequestV2Schema,
  PlayerActionRevealRequestV2Schema,
  PlayerActionResponseV2Schema,
  DynamicAutoPolicySchema,
  DynamicAutoPolicySegmentSchema,
  LiveOpsCampaignAnalyticsBucketSchema,
  LiveOpsCampaignApprovalActionSchema,
  LiveOpsCampaignApprovalRequestSchema,
  LiveOpsCampaignApprovalSchema,
  LiveOpsCampaignApprovalSummarySchema,
  LiveOpsCampaignConfigSchema,
  LiveOpsCampaignDeliverySummarySchema,
  LiveOpsCampaignDispatchRequestSchema,
  LiveOpsCampaignDispatchResponseSchema,
  LiveOpsCampaignDispatchHistoryRowSchema,
  LiveOpsCampaignSchedulerSummarySchema,
  LiveOpsCampaignOperatorTimelineRowSchema,
  LiveOpsCampaignScheduleSchema,
  LiveOpsCampaignSnapshotSchema,
  LiveOpsCampaignSurfaceSchema,
  LiveOpsCampaignTargetingSchema,
  LiveOpsCampaignVersionHistoryRowSchema,
  LiveOpsCampaignUpsertRequestSchema,
  HomeFeedV2Schema,
  AdminMonetizationFeeEventResponseV2Schema,
  MonetizationOverviewV2Schema,
  MonetizationPurchaseResponseV2Schema,
  PvpLeagueOverviewV2Schema,
  PvpLiveResponseV2Schema,
  PvpMutationResponseV2Schema,
  PvpSessionStateResponseV2Schema,
  PvpSessionActionRequestV2Schema,
  PvpSessionResolveRequestV2Schema,
  PvpSessionStartRequestV2Schema,
  RuntimeFlagsEffectiveSchema,
  TokenBuyIntentRequestV2Schema,
  TokenActionResponseV2Schema,
  TokenMintRequestV2Schema,
  TokenQueryResponseV2Schema,
  TokenSubmitTxRequestV2Schema,
  WalletSessionResponseV2Schema,
  WalletSessionStateV2Schema,
  PayoutStatusResponseV2Schema,
  PayoutMutationResponseV2Schema,
  UiEventSchema,
  UiPreferencesResponseV2Schema,
  UiPreferencesSchema,
  UiEventBatchAnalyticsConfigSchema,
  UnifiedAdminQueueItemSchema,
  VaultOverviewV2Schema,
  WebAppActionMutationRequestV2Schema,
  WebAppAuthEnvelopeSchema,
  WalletCapabilitiesSchema
};
