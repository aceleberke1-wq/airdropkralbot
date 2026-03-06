import { z } from "zod";

const ApiVersionV2Schema = z.union([z.literal("v2"), z.string()]);

const ApiEnvelopeSchema = z
  .object({
    success: z.boolean(),
    session: z
      .object({
        uid: z.string().optional(),
        ts: z.string().optional(),
        sig: z.string().optional(),
        ttl_sec: z.number().optional()
      })
      .partial()
      .optional(),
    data: z.unknown().optional(),
    error: z.string().optional(),
    message: z.string().optional(),
    details: z.array(z.record(z.unknown())).optional()
  })
  .passthrough();

const HomeFeedSchema = z
  .object({
    api_version: z.literal("v2"),
    generated_at: z.string().optional(),
    profile: z.record(z.unknown()).default({}),
    season: z.record(z.unknown()).default({}),
    daily: z.record(z.unknown()).default({}),
    contract: z.record(z.unknown()).default({}),
    risk: z.record(z.unknown()).default({}),
    mission: z.record(z.unknown()).default({}),
    wallet_quick: z.record(z.unknown()).default({}),
    monetization_quick: z.record(z.unknown()).default({}),
    command_hint: z.array(z.record(z.unknown())).default([])
  })
  .passthrough();

const LeagueOverviewSchema = z
  .object({
    api_version: z.literal("v2"),
    generated_at: z.string().optional(),
    daily_duel: z.record(z.unknown()).default({}),
    weekly_ladder: z.record(z.unknown()).default({}),
    season_arc_boss: z.record(z.unknown()).default({}),
    leaderboard_snippet: z.array(z.record(z.unknown())).default([]),
    last_session_trend: z.array(z.record(z.unknown())).default([]),
    session_snapshot: z.record(z.unknown()).default({})
  })
  .passthrough();

const WalletSessionSchema = z
  .object({
    active: z.boolean(),
    chain: z.string(),
    address: z.string(),
    address_masked: z.string().optional(),
    linked_at: z.string().nullable().optional(),
    expires_at: z.string().nullable().optional(),
    session_ref: z.string(),
    kyc_status: z.string()
  })
  .passthrough();

const VaultOverviewSchema = z
  .object({
    api_version: z.literal("v2"),
    generated_at: z.string().optional(),
    token_summary: z.record(z.unknown()).default({}),
    route_status: z.record(z.unknown()).default({}),
    payout_status: z.record(z.unknown()).default({}),
    wallet_session: WalletSessionSchema.optional(),
    monetization_status: z.record(z.unknown()).default({})
  })
  .passthrough();

const WalletSessionStateSchema = z
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

const WalletSessionResponseSchema = z
  .object({
    api_version: z.literal("v2"),
    wallet_capabilities: z.record(z.unknown()).default({}),
    wallet_session: WalletSessionStateSchema.default({}),
    links: z.array(z.record(z.unknown())).default([]),
    kyc_status: z.record(z.unknown()).default({})
  })
  .passthrough();

const PayoutStatusSchema = z
  .object({
    api_version: ApiVersionV2Schema,
    currency: z.string().optional(),
    can_request: z.boolean().optional(),
    unlock_tier: z.string().optional(),
    unlock_progress: z.number().optional(),
    requestable_btc: z.number().optional(),
    entitled_btc: z.number().optional(),
    latest_request_id: z.number().optional(),
    latest_status: z.string().optional(),
    payout_gate: z.record(z.unknown()).optional(),
    payout_release: z.record(z.unknown()).optional()
  })
  .passthrough();

const MonetizationOverviewSchema = z
  .object({
    api_version: z.literal("v2"),
    generated_at: z.string().optional(),
    catalog: z
      .object({
        pass_catalog: z.array(z.record(z.unknown())).default([]),
        cosmetic_catalog: z.array(z.record(z.unknown())).default([])
      })
      .partial()
      .default({}),
    status: z.record(z.unknown()).default({}),
    active_effects: z.record(z.unknown()).default({})
  })
  .passthrough();

const MonetizationPurchaseSchema = z
  .object({
    api_version: z.literal("v2"),
    purchase: z.record(z.unknown()).optional(),
    balances: z.record(z.unknown()).optional(),
    monetization: z.record(z.unknown()).optional()
  })
  .passthrough();

const DynamicAutoPolicySegmentSchema = z
  .object({
    token_symbol: z.string(),
    segment_key: z.string().min(3).max(64),
    priority: z.number().int().min(1).max(999),
    max_auto_usd: z.number().min(0.5),
    risk_threshold: z.number().min(0).max(1),
    velocity_per_hour: z.number().int().min(1),
    require_onchain_verified: z.boolean(),
    require_kyc_status: z.string(),
    enabled: z.boolean(),
    degrade_factor: z.number().min(0.3).max(1),
    meta_json: z.record(z.unknown()).optional(),
    updated_by: z.number().int().optional(),
    updated_at: z.string().nullable().optional()
  })
  .passthrough();

const DynamicAutoPolicySchema = z
  .object({
    api_version: z.literal("v2"),
    token_symbol: z.string(),
    base_policy: z.record(z.unknown()).default({}),
    anomaly_state: z.record(z.unknown()).default({}),
    segments: z.array(DynamicAutoPolicySegmentSchema).default([]),
    preview: z.record(z.unknown()).nullable().optional(),
    generated_at: z.string().optional(),
    updated_at: z.string().optional()
  })
  .passthrough();

const UiPreferencesSchema = z
  .object({
    ui_mode: z.string(),
    quality_mode: z.string(),
    reduced_motion: z.boolean(),
    large_text: z.boolean(),
    sound_enabled: z.boolean(),
    updated_at: z.string().nullable().optional(),
    prefs_json: z
      .object({
        language: z.enum(["tr", "en"]).optional(),
        onboarding_completed: z.boolean().optional(),
        onboarding_version: z.string().optional(),
        advanced_view: z.boolean().optional(),
        last_tab: z.enum(["home", "pvp", "tasks", "vault"]).optional(),
        workspace: z.enum(["player", "admin"]).optional()
      })
      .passthrough()
      .default({})
  })
  .passthrough();

const UiPreferencesResponseSchema = z
  .object({
    api_version: ApiVersionV2Schema,
    ui_preferences: UiPreferencesSchema
  })
  .passthrough();

const PlayerActionDataSchema = z
  .object({
    api_version: ApiVersionV2Schema,
    action_request_id: z.string().min(6).max(120).optional(),
    snapshot: z.record(z.unknown()).optional()
  })
  .passthrough();

const PvpMutationDataSchema = z
  .object({
    api_version: ApiVersionV2Schema,
    action_request_id: z.string().min(6).max(120).optional(),
    session: z.record(z.unknown()).nullable().optional()
  })
  .passthrough();

const PvpSessionStateDataSchema = z
  .object({
    api_version: ApiVersionV2Schema,
    session: z.record(z.unknown()).nullable().optional()
  })
  .passthrough();

const PvpLiveDataSchema = z
  .object({
    api_version: ApiVersionV2Schema
  })
  .passthrough();

const TokenQueryDataSchema = z
  .object({
    api_version: ApiVersionV2Schema
  })
  .passthrough();

const TokenActionDataSchema = z
  .object({
    api_version: ApiVersionV2Schema,
    action_request_id: z.string().min(6).max(120).optional()
  })
  .passthrough();

function buildContractError(endpointKey, issue, scope = "data") {
  const path = Array.isArray(issue?.path) ? issue.path.join(".") : "";
  const message = String(issue?.message || "invalid_contract");
  const suffix = path ? `${scope}.${path}` : scope;
  return new Error(`contract_invalid:${endpointKey}:${suffix}:${message}`);
}

function parseEnvelopeData(endpointKey, payload, dataSchema) {
  const envelopeResult = ApiEnvelopeSchema.safeParse(payload);
  if (!envelopeResult.success) {
    throw buildContractError(endpointKey, envelopeResult.error.issues?.[0], "envelope");
  }
  const envelope = envelopeResult.data;
  if (!envelope.success || envelope.data == null || !dataSchema) {
    return envelope;
  }
  const dataResult = dataSchema.safeParse(envelope.data);
  if (!dataResult.success) {
    throw buildContractError(endpointKey, dataResult.error.issues?.[0], "data");
  }
  return {
    ...envelope,
    data: dataResult.data
  };
}

export function parseHomeFeedResponse(payload) {
  return parseEnvelopeData("home_feed_v2", payload, HomeFeedSchema);
}

export function parseLeagueOverviewResponse(payload) {
  return parseEnvelopeData("league_overview_v2", payload, LeagueOverviewSchema);
}

export function parseVaultOverviewResponse(payload) {
  return parseEnvelopeData("vault_overview_v2", payload, VaultOverviewSchema);
}

export function parseMonetizationOverviewResponse(payload) {
  return parseEnvelopeData("monetization_overview_v2", payload, MonetizationOverviewSchema);
}

export function parseMonetizationPurchaseResponse(payload) {
  return parseEnvelopeData("monetization_purchase_v2", payload, MonetizationPurchaseSchema);
}

export function parseWalletSessionResponse(payload) {
  return parseEnvelopeData("wallet_session_v2", payload, WalletSessionResponseSchema);
}

export function parsePayoutStatusResponse(payload) {
  return parseEnvelopeData("payout_status_v2", payload, PayoutStatusSchema);
}

export function parseAdminDynamicAutoPolicyResponse(payload) {
  return parseEnvelopeData("admin_dynamic_auto_policy_v2", payload, DynamicAutoPolicySchema);
}

export function parseUiPreferencesResponse(payload) {
  return parseEnvelopeData("ui_preferences_v2", payload, UiPreferencesResponseSchema);
}

export function parsePlayerActionResponse(payload) {
  return parseEnvelopeData("player_action_v2", payload, PlayerActionDataSchema);
}

export function parsePvpMutationResponse(payload) {
  return parseEnvelopeData("pvp_mutation_v2", payload, PvpMutationDataSchema);
}

export function parsePvpSessionStateResponse(payload) {
  return parseEnvelopeData("pvp_session_state_v2", payload, PvpSessionStateDataSchema);
}

export function parsePvpLiveResponse(payload) {
  return parseEnvelopeData("pvp_live_v2", payload, PvpLiveDataSchema);
}

export function parseTokenQueryResponse(payload) {
  return parseEnvelopeData("token_query_v2", payload, TokenQueryDataSchema);
}

export function parseTokenActionResponse(payload) {
  return parseEnvelopeData("token_action_v2", payload, TokenActionDataSchema);
}

export const contractSchemas = {
  ApiEnvelopeSchema,
  HomeFeedSchema,
  LeagueOverviewSchema,
  VaultOverviewSchema,
  MonetizationOverviewSchema,
  MonetizationPurchaseSchema,
  WalletSessionResponseSchema,
  PayoutStatusSchema,
  DynamicAutoPolicySchema,
  UiPreferencesResponseSchema,
  PlayerActionDataSchema,
  PvpMutationDataSchema,
  PvpSessionStateDataSchema,
  PvpLiveDataSchema,
  TokenQueryDataSchema,
  TokenActionDataSchema
};
