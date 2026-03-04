"use strict";

const { z } = require("zod");

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

module.exports = {
  AdminQueueActionPayloadV2Schema,
  BootstrapV2DataSchema,
  BootstrapV2UiShellSchema,
  CommandCatalogSchema,
  CommandContractV2Schema,
  ExperimentAssignmentSchema,
  KpiBundleRunRequestSchema,
  KpiBundleSnapshotResponseSchema,
  KpiBundleSnapshotSchema,
  LocalizedStringMapSchema,
  MonetizationTrendPointSchema,
  PayoutDisputeMetricsSchema,
  PayoutLockStateSchema,
  PlayerActionAcceptRequestV2Schema,
  PlayerActionClaimMissionRequestV2Schema,
  PlayerActionCompleteRequestV2Schema,
  PlayerActionRevealRequestV2Schema,
  PvpSessionActionRequestV2Schema,
  PvpSessionResolveRequestV2Schema,
  PvpSessionStartRequestV2Schema,
  RuntimeFlagsEffectiveSchema,
  TokenBuyIntentRequestV2Schema,
  TokenMintRequestV2Schema,
  TokenSubmitTxRequestV2Schema,
  UiPreferencesResponseV2Schema,
  UiPreferencesSchema,
  UiEventBatchAnalyticsConfigSchema,
  UnifiedAdminQueueItemSchema,
  WebAppActionMutationRequestV2Schema,
  WebAppAuthEnvelopeSchema,
  WalletCapabilitiesSchema
};
