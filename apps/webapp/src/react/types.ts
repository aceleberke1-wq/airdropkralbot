export type TabKey = "home" | "pvp" | "tasks" | "vault";
export type WorkspaceKey = "player" | "admin";
export type ExperimentVariant = "control" | "treatment";
export type LangPrefInput = "tr" | "en" | string | null | undefined;

export type WebAppAuth = {
  uid: string;
  ts: string;
  sig: string;
};

export type WebAppSession = WebAppAuth & {
  ttl_sec?: number;
};

export type WebAppApiResponse<T = Record<string, unknown>> = {
  success: boolean;
  session?: WebAppSession;
  data?: T;
  error?: string;
  message?: string;
  details?: Array<Record<string, unknown>>;
};

export type BootstrapV2UiShell = {
  ui_version: string;
  default_tab: TabKey;
  tabs: TabKey[];
  admin_workspace_enabled: boolean;
  onboarding_version: string;
};

export type ExperimentAssignment = {
  key: string;
  variant: ExperimentVariant;
  assigned_at: string;
  cohort_bucket: number;
};

export type WalletSession = {
  active: boolean;
  chain: string;
  address: string;
  address_masked?: string;
  linked_at: string | null;
  expires_at: string | null;
  session_ref: string;
  kyc_status: string;
};

export type WalletSessionV2Payload = {
  api_version: "v2" | string;
  wallet_capabilities?: Record<string, unknown>;
  wallet_session?: Record<string, unknown>;
  links?: Array<Record<string, unknown>>;
  kyc_status?: Record<string, unknown>;
  [key: string]: unknown;
};

export type PayoutStatusV2Payload = {
  api_version: "v2" | string;
  [key: string]: unknown;
};

export type HomeFeed = {
  api_version: string;
  generated_at?: string;
  profile?: Record<string, unknown>;
  season?: Record<string, unknown>;
  daily?: Record<string, unknown>;
  contract?: Record<string, unknown>;
  risk?: Record<string, unknown>;
  mission?: Record<string, unknown>;
  wallet_quick?: Record<string, unknown>;
  monetization_quick?: Record<string, unknown>;
  command_hint?: Array<Record<string, unknown>>;
};

export type LeagueOverview = {
  api_version: string;
  generated_at?: string;
  daily_duel?: Record<string, unknown>;
  weekly_ladder?: Record<string, unknown>;
  season_arc_boss?: Record<string, unknown>;
  leaderboard_snippet?: Array<Record<string, unknown>>;
  last_session_trend?: Array<Record<string, unknown>>;
  session_snapshot?: Record<string, unknown>;
};

export type VaultOverview = {
  api_version: string;
  generated_at?: string;
  token_summary?: Record<string, unknown>;
  route_status?: Record<string, unknown>;
  payout_status?: Record<string, unknown>;
  wallet_session?: WalletSession;
  monetization_status?: Record<string, unknown>;
};

export type MonetizationOverview = {
  api_version: string;
  generated_at?: string;
  catalog?: {
    pass_catalog?: Array<Record<string, unknown>>;
    cosmetic_catalog?: Array<Record<string, unknown>>;
  };
  status?: Record<string, unknown>;
  active_effects?: Record<string, unknown>;
};

export type DynamicAutoPolicySegment = {
  token_symbol: string;
  segment_key: string;
  priority: number;
  max_auto_usd: number;
  risk_threshold: number;
  velocity_per_hour: number;
  require_onchain_verified: boolean;
  require_kyc_status: string;
  enabled: boolean;
  degrade_factor: number;
  meta_json?: Record<string, unknown>;
  updated_by?: number;
  updated_at?: string | null;
};

export type DynamicAutoPolicy = {
  api_version: string;
  token_symbol: string;
  base_policy?: Record<string, unknown>;
  anomaly_state?: Record<string, unknown>;
  segments: DynamicAutoPolicySegment[];
  preview?: Record<string, unknown> | null;
  generated_at?: string;
  updated_at?: string;
};

export type UiFunnelEvent = {
  funnel_key?: string;
  surface_key?: string;
  economy_event_key?: string;
  focus_key?: string;
  value_usd?: number;
  tx_state?: string;
};

export type UiEventRecord = {
  event_key: string;
  tab_key?: string;
  panel_key?: string;
  route_key?: string;
  focus_key?: string;
  funnel_key?: string;
  surface_key?: string;
  economy_event_key?: string;
  value_usd?: number;
  tx_state?: string;
  event_value?: number;
  payload_json?: Record<string, unknown>;
  client_ts?: string | number;
  variant_key?: ExperimentVariant | string;
  experiment_key?: string;
  cohort_bucket?: number;
};

export type UiEventBatchRequest = {
  uid: string;
  ts: string;
  sig: string;
  session_ref: string;
  language: "tr" | "en";
  tab_key?: string;
  panel_key?: string;
  route_key?: string;
  focus_key?: string;
  funnel_key?: string;
  surface_key?: string;
  economy_event_key?: string;
  value_usd?: number;
  tx_state?: string;
  variant_key?: ExperimentVariant | string;
  experiment_key?: string;
  cohort_bucket?: number;
  idempotency_key?: string;
  events: UiEventRecord[];
};

export type UiEventBatchResponse = WebAppApiResponse<{
  accepted_count: number;
  rejected_count: number;
  ingest_id: string;
}>;

export type AnalyticsConfig = {
  session_ref: string;
  flush_interval_ms: number;
  max_batch_size: number;
  sample_rate: number;
};

export type UiPreferences = {
  ui_mode: string;
  quality_mode: string;
  reduced_motion: boolean;
  large_text: boolean;
  sound_enabled: boolean;
  updated_at?: string | null;
  prefs_json: {
    language?: "tr" | "en";
    onboarding_completed?: boolean;
    onboarding_version?: string;
    advanced_view?: boolean;
    last_tab?: TabKey;
    workspace?: WorkspaceKey;
    [key: string]: unknown;
  };
};

export type MonetizationPurchasePayload = {
  api_version: "v2" | string;
  purchase?: Record<string, unknown>;
  balances?: Record<string, unknown>;
  monetization?: Record<string, unknown>;
  [key: string]: unknown;
};

export type UiPreferencesPatch = {
  ui_mode?: string;
  quality_mode?: string;
  reduced_motion?: boolean;
  large_text?: boolean;
  sound_enabled?: boolean;
  language?: "tr" | "en";
  onboarding_completed?: boolean;
  onboarding_version?: string;
  advanced_view?: boolean;
  last_tab?: TabKey;
  workspace?: WorkspaceKey;
  prefs_json?: Record<string, unknown>;
};

export type UiPreferencesResponse = WebAppApiResponse<{
  api_version: "v2" | string;
  ui_preferences: UiPreferences;
}>;

export type TaskOffer = {
  id: number;
  task_type: string;
  difficulty?: number;
  expires_at?: string;
  [key: string]: unknown;
};

export type TaskAttempt = {
  id: number;
  task_offer_id?: number;
  task_type?: string;
  difficulty?: number;
  result?: string;
  started_at?: string | null;
  completed_at?: string | null;
  [key: string]: unknown;
};

export type MissionRow = {
  key?: string;
  mission_key?: string;
  title?: string;
  title_tr?: string;
  title_en?: string;
  completed?: boolean;
  claimed?: boolean;
  status?: string;
  [key: string]: unknown;
};

export type BootstrapV2Data = {
  api_version: string;
  profile?: {
    public_name?: string;
    kingdom_tier?: string | number;
    current_streak?: number;
    [key: string]: unknown;
  };
  balances?: Record<string, number>;
  season?: {
    season_id?: number;
    days_left?: number;
    points?: number;
    [key: string]: unknown;
  };
  daily?: {
    tasks_done?: number;
    daily_cap?: number;
    sc_earned?: number;
    rc_earned?: number;
    hc_earned?: number;
    [key: string]: unknown;
  };
  offers?: TaskOffer[];
  attempts?: {
    active?: TaskAttempt | null;
    revealable?: TaskAttempt | null;
  };
  missions?: {
    total?: number;
    ready?: number;
    open?: number;
    list?: MissionRow[];
    [key: string]: unknown;
  };
  token?: Record<string, unknown>;
  payout_lock?: Record<string, unknown>;
  ui_prefs?: UiPreferences;
  pvp_content?: Record<string, unknown>;
  command_catalog?: Array<Record<string, unknown>>;
  ux?: {
    default_mode?: string;
    language?: "tr" | "en";
    advanced_enabled?: boolean;
    version?: string;
  };
  admin?: {
    is_admin?: boolean;
    summary?: Record<string, unknown> | null;
  };
  ui_shell?: BootstrapV2UiShell;
  experiment?: ExperimentAssignment;
  analytics?: AnalyticsConfig;
  [key: string]: unknown;
};

export type BootstrapV2Payload = WebAppApiResponse<BootstrapV2Data>;

export type PlayerActionResponse = WebAppApiResponse<{
  api_version?: string;
  action_request_id?: string;
  snapshot?: Record<string, unknown>;
  [key: string]: unknown;
}>;

export type PvpMutationResponse = WebAppApiResponse<{
  api_version?: string;
  action_request_id?: string;
  session?: Record<string, unknown> | null;
  [key: string]: unknown;
}>;

export type PvpSessionStateResponse = WebAppApiResponse<{
  api_version?: string;
  session?: Record<string, unknown> | null;
  [key: string]: unknown;
}>;

export type TokenQueryResponse = WebAppApiResponse<{
  api_version?: string;
  [key: string]: unknown;
}>;

export type TokenActionResponse = WebAppApiResponse<{
  api_version?: string;
  action_request_id?: string;
  [key: string]: unknown;
}>;

export type AdminQueueActionRequest = {
  action_key: string;
  kind?: string;
  request_id: number;
  action_request_id: string;
  confirm_token?: string;
  reason?: string;
  tx_hash?: string;
};

export type AdminApiResponse = WebAppApiResponse<{
  api_version?: string;
  [key: string]: unknown;
}>;
