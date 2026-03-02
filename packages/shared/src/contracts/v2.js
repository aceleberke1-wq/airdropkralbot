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

module.exports = {
  AdminQueueActionPayloadV2Schema,
  BootstrapV2DataSchema,
  CommandCatalogSchema,
  CommandContractV2Schema,
  KpiBundleRunRequestSchema,
  KpiBundleSnapshotResponseSchema,
  KpiBundleSnapshotSchema,
  LocalizedStringMapSchema,
  MonetizationTrendPointSchema,
  PayoutDisputeMetricsSchema,
  PayoutLockStateSchema,
  RuntimeFlagsEffectiveSchema,
  UnifiedAdminQueueItemSchema,
  WalletCapabilitiesSchema
};
