export type TabKey = "home" | "pvp" | "tasks" | "vault";
export type WorkspaceKey = "player" | "admin";
export type ExperimentVariant = "control" | "treatment";

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

export type UiEventRecord = {
  event_key: string;
  tab_key?: string;
  panel_key?: string;
  route_key?: string;
  event_value?: number;
  payload_json?: Record<string, unknown>;
  client_ts?: string | number;
  variant_key?: string;
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
  variant_key?: ExperimentVariant;
  experiment_key?: string;
  cohort_bucket?: number;
  idempotency_key?: string;
  events: UiEventRecord[];
};

export type UiEventBatchResponse = {
  success: boolean;
  session?: {
    uid: string;
    ts: string;
    sig: string;
    ttl_sec?: number;
  };
  data?: {
    accepted_count: number;
    rejected_count: number;
    ingest_id: string;
  };
  error?: string;
};

export type AnalyticsConfig = {
  session_ref: string;
  flush_interval_ms: number;
  max_batch_size: number;
  sample_rate: number;
};

export type WebAppAuth = {
  uid: string;
  ts: string;
  sig: string;
};

export type BootstrapV2Data = {
  api_version: string;
  profile?: {
    public_name?: string;
    kingdom_tier?: string | number;
    current_streak?: number;
  };
  balances?: Record<string, number>;
  season?: {
    season_id?: number;
    days_left?: number;
    points?: number;
  };
  daily?: {
    tasks_done?: number;
    daily_cap?: number;
    sc_earned?: number;
    rc_earned?: number;
  };
  missions?: {
    total?: number;
    ready?: number;
    open?: number;
    list?: Array<Record<string, unknown>>;
  };
  token?: Record<string, unknown>;
  payout_lock?: Record<string, unknown>;
  ui_prefs?: {
    quality_mode?: string;
    reduced_motion?: boolean;
    large_text?: boolean;
    [key: string]: unknown;
  };
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
};

export type BootstrapV2Payload = {
  success: boolean;
  session?: {
    uid: string;
    ts: string;
    sig: string;
    ttl_sec?: number;
  };
  data?: BootstrapV2Data;
  error?: string;
};
