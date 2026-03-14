import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildDistrictWorldState } from "../../../core/runtime/districtWorldState.js";
import { t, type Lang } from "../../i18n";

type BabylonDistrictSceneHostProps = {
  lang: Lang;
  workspace: "player" | "admin";
  tab: "home" | "pvp" | "tasks" | "vault";
  navigationContext: Record<string, unknown> | null;
  scene: Record<string, unknown>;
  sceneRuntime: Record<string, unknown>;
  data: Record<string, unknown> | null;
  homeFeed: Record<string, unknown> | null;
  taskResult: Record<string, unknown> | null;
  pvpRuntime: Record<string, unknown> | null;
  leagueOverview: Record<string, unknown> | null;
  pvpLive: {
    leaderboard: Record<string, unknown> | null;
    diagnostics: Record<string, unknown> | null;
    tick: Record<string, unknown> | null;
  };
  vaultData: Record<string, unknown> | null;
  adminRuntime: {
    summary: Record<string, unknown> | null;
    queue: Array<Record<string, unknown>>;
  };
  onLoopStateChange?: (payload:
    | {
    districtKey: string;
    workspace: "player" | "admin";
    tab: "home" | "pvp" | "tasks" | "vault";
    protocolCardKey: string;
    protocolPodKey: string;
    microflowKey: string;
    focusKey?: string;
    riskKey?: string;
    riskFocusKey?: string;
    actionContextSignature?: string;
    riskContextSignature?: string;
    actionContext?: RiskContext | null;
    riskContext?: RiskContext | null;
    entryKindKey: string;
    sequenceKindKey: string;
    loopStatusKey: string;
    loopStatusLabelKey?: string;
    loopStageValue: string;
    directorPaceLabelKey?: string;
    hudToneLabelKey?: string;
    personalityKey?: string;
    personalityLabelKey?: string;
    personalityCaptionKey?: string;
    personalityBandKey?: string;
    densityLabelKey?: string;
    loopRows?: Array<{ label_key: string; value: string; status_key: string }>;
    loopSignalRows?: Array<{ label_key: string; value: string; status_key: string }>;
    sequenceRows?: Array<{ label_key: string; value: string; status_key: string }>;
    actorKey?: string;
    clusterKey?: string;
    hotspotKey?: string;
    sourceType: string;
  }
    | null) => void;
  onNodeAction?: (payload: {
    actionKey: string;
    nodeKey: string;
    laneKey: string;
    label: string;
    labelKey?: string;
    familyKey?: string;
    flowKey?: string;
    microflowKey?: string;
    focusKey?: string;
    riskKey?: string;
    riskFocusKey?: string;
    actionContext?: RiskContext | null;
    riskHealthBandKey?: string;
    riskAttentionBandKey?: string;
    riskTrendDirectionKey?: string;
    actionContextSignature?: string;
    riskContextSignature?: string;
    riskContext?: RiskContext | null;
    entryKindKey?: string;
    sequenceKindKey?: string;
    sourceType?: string;
    actorKey?: string;
    interactionKind?: string;
    clusterKey?: string;
    isSecondary?: boolean;
    workspace: "player" | "admin";
    tab: "home" | "pvp" | "tasks" | "vault";
    districtKey: string;
  }) => void;
};

type BabylonSceneHandle = {
  dispose: () => void;
};

type HoverPreview = {
  key: string;
  label: string;
  labelKey: string;
  hintLabelKey: string;
  intentLabelKey: string;
  intentToneKey: string;
  interactionKind: string;
  sourceType: string;
};

type RiskContext = {
  district_key?: string;
  family_key?: string;
  flow_key?: string;
  microflow_key?: string;
  focus_key?: string;
  risk_key?: string;
  risk_focus_key?: string;
  risk_health_band_key?: string;
  risk_attention_band_key?: string;
  risk_trend_direction_key?: string;
  entry_kind_key?: string;
  sequence_kind_key?: string;
  action_context_signature?: string;
  risk_context_signature?: string;
  context_lookup_required?: boolean;
  context_lookup_resolved?: boolean;
  contract_state_key?: string;
  contract_ready?: boolean;
  contract_missing_keys?: string[];
};

type ClusterActionItem = {
  key: string;
  label: string;
  label_key: string;
  action_key: string;
  surface_slot_key?: string;
  actor_key: string;
  cluster_key: string;
  hint_label_key: string;
  interaction_kind: string;
  intent_profile_key: string;
  intent_profile: {
    intent_label_key?: string;
    intent_tone_key?: string;
    rail_class_key?: string;
  };
  is_secondary: boolean;
  is_primary_surface_action?: boolean;
  family_key?: string;
  flow_key?: string;
  microflow_key?: string;
  focus_key?: string;
  risk_key?: string;
  risk_focus_key?: string;
  risk_health_band_key?: string;
  risk_attention_band_key?: string;
  risk_trend_direction_key?: string;
  entry_kind_key?: string;
  sequence_kind_key?: string;
  action_context_signature?: string;
  risk_context_signature?: string;
  contract_ready?: boolean;
  contract_missing_keys?: string[];
  risk_context?: RiskContext;
  action_context?: {
    district_key?: string;
    family_key?: string;
    flow_key?: string;
    microflow_key?: string;
    focus_key?: string;
    risk_key?: string;
    risk_focus_key?: string;
    risk_health_band_key?: string;
    risk_attention_band_key?: string;
    risk_trend_direction_key?: string;
    entry_kind_key?: string;
    sequence_kind_key?: string;
    action_context_signature?: string;
    risk_context_signature?: string;
    contract_ready?: boolean;
    contract_missing_keys?: string[];
  };
};

type ProtocolCardActionItem = {
  item_key: string;
  action_key: string;
  label_key: string;
  hint_label_key?: string;
  tone_key?: string;
  intent_profile_key?: string;
  family_key?: string;
  flow_key?: string;
  microflow_key?: string;
  focus_key?: string;
  risk_key?: string;
  risk_focus_key?: string;
  risk_health_band_key?: string;
  risk_attention_band_key?: string;
  risk_trend_direction_key?: string;
  action_context_signature?: string;
  risk_context_signature?: string;
  contract_ready?: boolean;
  contract_missing_keys?: string[];
  risk_context?: RiskContext;
  action_context?: ClusterActionItem["action_context"];
};

type PrimaryActionSummary = {
  primary_action_key?: string;
  primary_action_label_key?: string;
  primary_action_hint_label_key?: string;
  primary_family_key?: string;
  primary_flow_key?: string;
  primary_microflow_key?: string;
  primary_focus_key?: string;
  primary_risk_key?: string;
  primary_risk_focus_key?: string;
  primary_risk_health_band_key?: string;
  primary_risk_attention_band_key?: string;
  primary_risk_trend_direction_key?: string;
  primary_entry_kind_key?: string;
  primary_sequence_kind_key?: string;
  primary_action_context_signature?: string;
  primary_risk_context_signature?: string;
  primary_contract_ready?: boolean;
  primary_contract_state_key?: string;
  primary_contract_missing_keys?: string[];
  primary_action_context?: ClusterActionItem["action_context"];
  primary_risk_context?: RiskContext;
};

type InteractionModalLaneCard = PrimaryActionSummary & {
  card_key: string;
  label_key: string;
  value: string;
  status_key: string;
  tone_key?: string;
  protocol_card_key?: string;
  protocol_pod_key?: string;
  family_key?: string;
  flow_key?: string;
  microflow_key?: string;
  action_key?: string;
  action_label_key?: string;
  hint_label_key?: string;
  focus_key?: string;
  risk_key?: string;
  risk_focus_key?: string;
  risk_health_band_key?: string;
  risk_attention_band_key?: string;
  risk_trend_direction_key?: string;
  entry_kind_key?: string;
  sequence_kind_key?: string;
  action_context_signature?: string;
  risk_context_signature?: string;
  risk_context?: RiskContext;
  action_context?: ClusterActionItem["action_context"];
};

type ProtocolCardFlowPod = PrimaryActionSummary & {
  pod_key: string;
  label_key: string;
  value: string;
  status_key: string;
  status_label_key?: string;
  tone_key?: string;
  hint_label_key?: string;
  entry_kind_key?: string;
  sequence_kind_key?: string;
  tempo_label_key?: string;
  camera_profile_label_key?: string;
  camera_radius_scale?: number;
  camera_focus_y_offset?: number;
  motion_scalar?: number;
  stage_label_key?: string;
  stage_value?: string;
  stage_status_key?: string;
  family_key?: string;
  flow_key?: string;
  microflow_key?: string;
  focus_key?: string;
  risk_key?: string;
  risk_focus_key?: string;
  risk_health_band_key?: string;
  risk_attention_band_key?: string;
  risk_trend_direction_key?: string;
  action_context_signature?: string;
  risk_context_signature?: string;
  action_context?: ClusterActionItem["action_context"];
  rows?: Array<{ label_key: string; value: string; status_key: string }>;
  signal_rows?: Array<{ label_key: string; value: string; status_key: string }>;
  flow_rows?: Array<{ label_key: string; value: string; status_key: string }>;
  sequence_rows?: Array<{ label_key: string; value: string; status_key: string }>;
  microflow_cards?: Array<PrimaryActionSummary & {
    microflow_key: string;
    label_key: string;
    value: string;
    status_key: string;
    tone_key?: string;
    action_key?: string;
    action_label_key?: string;
    hint_label_key?: string;
    family_key?: string;
    flow_key?: string;
    focus_key?: string;
    risk_key?: string;
    risk_focus_key?: string;
    risk_health_band_key?: string;
    risk_attention_band_key?: string;
    risk_trend_direction_key?: string;
    action_context_signature?: string;
    risk_context_signature?: string;
    risk_context?: RiskContext;
    action_context?: {
      district_key?: string;
      family_key?: string;
      flow_key?: string;
      microflow_key?: string;
      focus_key?: string;
      risk_key?: string;
      risk_focus_key?: string;
      risk_health_band_key?: string;
    risk_attention_band_key?: string;
    risk_trend_direction_key?: string;
    risk_context_signature?: string;
    entry_kind_key?: string;
    sequence_kind_key?: string;
      action_context_signature?: string;
    };
    entry_kind_key?: string;
    sequence_kind_key?: string;
    tempo_label_key?: string;
    camera_profile_label_key?: string;
    director_pace_label_key?: string;
    hud_tone_label_key?: string;
    personality_key?: string;
    personality_label_key?: string;
    personality_caption_key?: string;
    personality_band_key?: string;
    density_label_key?: string;
    light_profile_key?: string;
    surface_glow_band_key?: string;
    chrome_band_key?: string;
    risk_light_band_key?: string;
    risk_glow_band_key?: string;
    risk_motion_band_key?: string;
    composition_profile_key?: string;
    camera_frame_key?: string;
    hud_anchor_key?: string;
    rail_anchor_key?: string;
    sheet_anchor_key?: string;
    entry_anchor_key?: string;
    console_anchor_key?: string;
    modal_anchor_key?: string;
    hud_focus_mode_key?: string;
    rail_presence_key?: string;
    sheet_presence_key?: string;
    entry_presence_key?: string;
    console_presence_key?: string;
    modal_presence_key?: string;
    hud_density_profile_key?: string;
    rail_layout_key?: string;
    console_layout_key?: string;
    modal_layout_key?: string;
    focus_hold_scalar?: number;
    camera_heading_offset?: number;
    camera_target_x_offset?: number;
    camera_bank_scalar?: number;
    camera_fov_scalar?: number;
    focus_spread_scalar?: number;
    hud_width_scalar?: number;
    rail_width_scalar?: number;
    sheet_width_scalar?: number;
    entry_width_scalar?: number;
    console_width_scalar?: number;
    modal_width_scalar?: number;
    surface_gap_scalar?: number;
    surface_stack_scalar?: number;
    light_intensity_scalar?: number;
    glow_intensity_scalar?: number;
    surface_glow_scalar?: number;
    chrome_opacity_scalar?: number;
    risk_light_scalar?: number;
    risk_glow_scalar?: number;
    risk_surface_glow_scalar?: number;
    risk_chrome_scalar?: number;
    risk_pulse_scalar?: number;
    risk_motion_scalar?: number;
    camera_radius_scale?: number;
    camera_focus_y_offset?: number;
    motion_scalar?: number;
    alpha_offset?: number;
    beta_offset?: number;
    focus_lerp_scalar?: number;
    radius_lerp_scalar?: number;
    orbit_spin_scalar?: number;
    sway_scalar?: number;
    alpha_lerp_scalar?: number;
    beta_lerp_scalar?: number;
    hud_emphasis_scalar?: number;
    actor_motion_scalar?: number;
    hotspot_motion_scalar?: number;
    ring_pulse_scalar?: number;
    satellite_orbit_scalar?: number;
    hud_layout_key?: string;
    hud_emphasis_band_key?: string;
    camera_drift_scalar?: number;
    camera_tilt_scalar?: number;
    camera_target_lift_scalar?: number;
    camera_orbit_bias_scalar?: number;
    stage_label_key?: string;
    stage_value?: string;
    stage_status_key?: string;
    sequence_rows?: Array<{ label_key: string; value: string; status_key: string }>;
    sequence_cards?: Array<{ card_key: string; label_key: string; value: string; value_key?: string; status_key: string }>;
    loop_status_key?: string;
    loop_status_label_key?: string;
    loop_stage_value?: string;
    loop_rows?: Array<{ label_key: string; value: string; status_key: string }>;
    loop_signal_rows?: Array<{ label_key: string; value: string; status_key: string }>;
    rows?: Array<{ label_key: string; value: string; status_key: string }>;
  }>;
  action_items?: ProtocolCardActionItem[];
};

type ProtocolCard = PrimaryActionSummary & {
  card_key: string;
  label_key: string;
  value: string;
  status_key: string;
  status_label_key?: string;
  tone_key?: string;
  action_key?: string;
  action_label_key?: string;
  is_actionable?: boolean;
  family_key?: string;
  flow_key?: string;
  microflow_key?: string;
  focus_key?: string;
  risk_key?: string;
  risk_focus_key?: string;
  risk_health_band_key?: string;
  risk_attention_band_key?: string;
  risk_trend_direction_key?: string;
  entry_kind_key?: string;
  sequence_kind_key?: string;
  action_context_signature?: string;
  risk_context_signature?: string;
  risk_context?: RiskContext;
  action_context?: ClusterActionItem["action_context"];
  preview_rows?: Array<{ label_key: string; value: string; status_key: string }>;
  flow_rows?: Array<{ label_key: string; value: string; status_key: string }>;
  signal_rows?: Array<{ label_key: string; value: string; status_key: string }>;
  track_rows?: Array<{ label_key: string; value: string; status_key: string }>;
  flow_pods?: ProtocolCardFlowPod[];
  action_items?: ProtocolCardActionItem[];
};

type SceneActionLike = {
  [key: string]: unknown;
  risk_context?: RiskContext;
  action_context?: ClusterActionItem["action_context"];
  family_key?: string;
  flow_key?: string;
  microflow_key?: string;
  focus_key?: string;
  risk_key?: string;
  risk_focus_key?: string;
  risk_health_band_key?: string;
  risk_attention_band_key?: string;
  risk_trend_direction_key?: string;
  entry_kind_key?: string;
  sequence_kind_key?: string;
  action_context_signature?: string;
  risk_context_signature?: string;
  context_lookup_required?: boolean;
  context_lookup_resolved?: boolean;
};

type ResolvedSceneActionContext = {
  familyKey: string;
  flowKey: string;
  microflowKey: string;
  focusKey: string;
  riskKey: string;
  riskFocusKey: string;
  riskContextSignature: string;
  actionContextSignature: string;
  entryKindKey: string;
  sequenceKindKey: string;
  riskHealthBandKey: string;
  riskAttentionBandKey: string;
  riskTrendDirectionKey: string;
  contextLookupRequired: boolean;
  contextLookupResolved: boolean;
  contractStateKey: string;
  contractReady: boolean;
  contractMissingKeys: string[];
  actionContext: RiskContext | null;
  riskContext: RiskContext | null;
};

function asRiskContext(value: unknown): RiskContext {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RiskContext) : {};
}

function readSceneActionText(...values: unknown[]) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) {
      return normalized;
    }
  }
  return "";
}

function buildSceneActionContextSignature(
  flowKey: string,
  focusKey: string,
  entryKindKey: string,
  sequenceKindKey: string
) {
  return [flowKey, focusKey, entryKindKey, sequenceKindKey].filter(Boolean).join("|");
}

function buildSceneRiskContextSignature(
  flowKey: string,
  riskFocusKey: string,
  entryKindKey: string,
  sequenceKindKey: string
) {
  return [flowKey, riskFocusKey, entryKindKey, sequenceKindKey].filter(Boolean).join("|");
}

function buildPrimarySceneActionSource(source?: PrimaryActionSummary | Record<string, unknown> | null) {
  const primary =
    source && typeof source === "object" && !Array.isArray(source) ? (source as Record<string, unknown>) : {};
  return {
    action_key: readSceneActionText(primary.primary_action_key),
    action_label_key: readSceneActionText(primary.primary_action_label_key),
    hint_label_key: readSceneActionText(primary.primary_action_hint_label_key),
    family_key: readSceneActionText(primary.primary_family_key),
    flow_key: readSceneActionText(primary.primary_flow_key),
    microflow_key: readSceneActionText(primary.primary_microflow_key),
    focus_key: readSceneActionText(primary.primary_focus_key),
    risk_key: readSceneActionText(primary.primary_risk_key),
    risk_focus_key: readSceneActionText(primary.primary_risk_focus_key),
    risk_health_band_key: readSceneActionText(primary.primary_risk_health_band_key),
    risk_attention_band_key: readSceneActionText(primary.primary_risk_attention_band_key),
    risk_trend_direction_key: readSceneActionText(primary.primary_risk_trend_direction_key),
    entry_kind_key: readSceneActionText(primary.primary_entry_kind_key),
    sequence_kind_key: readSceneActionText(primary.primary_sequence_kind_key),
    action_context_signature: readSceneActionText(primary.primary_action_context_signature),
    risk_context_signature: readSceneActionText(primary.primary_risk_context_signature),
    contract_ready:
      typeof primary.primary_contract_ready === "boolean" ? primary.primary_contract_ready : undefined,
    contract_state_key: readSceneActionText(primary.primary_contract_state_key),
    contract_missing_keys: Array.isArray(primary.primary_contract_missing_keys)
      ? primary.primary_contract_missing_keys.map((value) => readSceneActionText(value)).filter(Boolean)
      : [],
    action_context: asRiskContext(primary.primary_action_context),
    risk_context: asRiskContext(primary.primary_risk_context)
  };
}

function buildSceneContractMeta(source?: Record<string, unknown> | null) {
  const primary = source && typeof source === "object" && !Array.isArray(source) ? source : {};
  const explicitLookupRequired =
    typeof primary.context_lookup_required === "boolean" ? primary.context_lookup_required : null;
  const explicitLookupResolved =
    typeof primary.context_lookup_resolved === "boolean" ? primary.context_lookup_resolved : null;
  const resolved = {
    flow_key: readSceneActionText(primary.flow_key),
    focus_key: readSceneActionText(primary.focus_key),
    risk_key: readSceneActionText(primary.risk_key),
    risk_focus_key: readSceneActionText(primary.risk_focus_key),
    entry_kind_key: readSceneActionText(primary.entry_kind_key),
    sequence_kind_key: readSceneActionText(primary.sequence_kind_key),
    action_context_signature: readSceneActionText(primary.action_context_signature),
    risk_context_signature: readSceneActionText(primary.risk_context_signature)
  };
  const contractMissingKeys = Object.entries(resolved)
    .filter(([, value]) => !readSceneActionText(value))
    .map(([key]) => key);
  const explicitMissingKeys = Array.isArray(primary.contract_missing_keys)
    ? primary.contract_missing_keys.map((value) => readSceneActionText(value)).filter(Boolean)
    : [];
  if (explicitLookupRequired === true && explicitLookupResolved !== true) {
    explicitMissingKeys.push("action_context_lookup");
  }
  const mergedMissingKeys = [...new Set([...contractMissingKeys, ...explicitMissingKeys])];
  const explicitReady = typeof primary.contract_ready === "boolean" ? primary.contract_ready : null;
  const explicitStateKey = readSceneActionText(primary.contract_state_key);
  const contractReady =
    explicitReady ??
    (explicitStateKey ? explicitStateKey === "ready" : mergedMissingKeys.length === 0);
  return {
    contractStateKey: contractReady ? "ready" : "missing",
    contractReady,
    contractMissingKeys: mergedMissingKeys,
    contextLookupRequired: explicitLookupRequired === true,
    contextLookupResolved: explicitLookupRequired === true ? explicitLookupResolved === true : true
  };
}

function normalizeSceneActionContext(source?: SceneActionLike | Record<string, unknown> | null): ResolvedSceneActionContext {
  const primary = source && typeof source === "object" && !Array.isArray(source) ? (source as Record<string, unknown>) : {};
  const riskContext = asRiskContext(primary.risk_context);
  const actionContext = asRiskContext(primary.action_context);
  const familyKey = readSceneActionText(riskContext.family_key, actionContext.family_key, primary.family_key);
  const flowKey = readSceneActionText(riskContext.flow_key, actionContext.flow_key, primary.flow_key);
  const microflowKey = readSceneActionText(
    riskContext.microflow_key,
    actionContext.microflow_key,
    primary.microflow_key
  );
  const focusKey = readSceneActionText(riskContext.focus_key, actionContext.focus_key, primary.focus_key);
  const riskKey = readSceneActionText(riskContext.risk_key, actionContext.risk_key, primary.risk_key);
  const riskFocusKey = readSceneActionText(
    riskContext.risk_focus_key,
    actionContext.risk_focus_key,
    primary.risk_focus_key
  );
  const entryKindKey = readSceneActionText(
    riskContext.entry_kind_key,
    actionContext.entry_kind_key,
    primary.entry_kind_key
  );
  const sequenceKindKey = readSceneActionText(
    riskContext.sequence_kind_key,
    actionContext.sequence_kind_key,
    primary.sequence_kind_key
  );
  const actionContextSignature =
    readSceneActionText(
      actionContext.action_context_signature,
      primary.action_context_signature,
      riskContext.action_context_signature
    ) || buildSceneActionContextSignature(flowKey, focusKey, entryKindKey, sequenceKindKey);
  const riskContextSignature =
    readSceneActionText(
      riskContext.risk_context_signature,
      actionContext.risk_context_signature,
      primary.risk_context_signature
    ) || buildSceneRiskContextSignature(flowKey, riskFocusKey, entryKindKey, sequenceKindKey);
  const contextLookupRequired =
    typeof primary.context_lookup_required === "boolean"
      ? primary.context_lookup_required
      : typeof riskContext.context_lookup_required === "boolean"
        ? riskContext.context_lookup_required
        : typeof actionContext.context_lookup_required === "boolean"
          ? actionContext.context_lookup_required
          : false;
  const contextLookupResolved =
    typeof primary.context_lookup_resolved === "boolean"
      ? primary.context_lookup_resolved
      : typeof riskContext.context_lookup_resolved === "boolean"
        ? riskContext.context_lookup_resolved
        : typeof actionContext.context_lookup_resolved === "boolean"
          ? actionContext.context_lookup_resolved
          : !contextLookupRequired;
  const resolvedActionContext: RiskContext | null = familyKey || flowKey || microflowKey || focusKey || riskKey || riskFocusKey
    ? {
        district_key: readSceneActionText(actionContext.district_key, riskContext.district_key, primary.district_key),
        family_key: familyKey,
        flow_key: flowKey,
        microflow_key: microflowKey,
        focus_key: focusKey,
        risk_key: riskKey,
        risk_focus_key: riskFocusKey,
        risk_health_band_key: readSceneActionText(
          riskContext.risk_health_band_key,
          actionContext.risk_health_band_key,
          primary.risk_health_band_key
        ),
        risk_attention_band_key: readSceneActionText(
          riskContext.risk_attention_band_key,
          actionContext.risk_attention_band_key,
          primary.risk_attention_band_key
        ),
        risk_trend_direction_key: readSceneActionText(
          riskContext.risk_trend_direction_key,
          actionContext.risk_trend_direction_key,
          primary.risk_trend_direction_key
        ),
        contract_state_key: readSceneActionText(
          actionContext.contract_state_key,
          riskContext.contract_state_key,
          primary.contract_state_key
        ),
        context_lookup_required: contextLookupRequired,
        context_lookup_resolved: contextLookupResolved,
        entry_kind_key: entryKindKey,
        sequence_kind_key: sequenceKindKey,
        action_context_signature: actionContextSignature
      }
    : null;
  const resolvedRiskContext: RiskContext | null =
    resolvedActionContext || riskContext.risk_context_signature || primary.risk_context_signature
      ? {
          ...(resolvedActionContext || {}),
          contract_state_key: readSceneActionText(
            riskContext.contract_state_key,
            actionContext.contract_state_key,
            primary.contract_state_key
          ),
          context_lookup_required: contextLookupRequired,
          context_lookup_resolved: contextLookupResolved,
          risk_context_signature: riskContextSignature
        }
      : null;
  const contractMeta = buildSceneContractMeta({
    flow_key: flowKey,
    focus_key: focusKey,
    risk_key: riskKey,
    risk_focus_key: riskFocusKey,
    entry_kind_key: entryKindKey,
    sequence_kind_key: sequenceKindKey,
    contract_state_key: readSceneActionText(
      primary.contract_state_key,
      riskContext.contract_state_key,
      actionContext.contract_state_key
    ),
    context_lookup_required: contextLookupRequired,
    context_lookup_resolved: contextLookupResolved,
    action_context_signature: actionContextSignature,
    risk_context_signature: riskContextSignature,
    contract_ready:
      typeof primary.contract_ready === "boolean"
        ? primary.contract_ready
        : typeof riskContext.contract_ready === "boolean"
          ? riskContext.contract_ready
          : typeof actionContext.contract_ready === "boolean"
            ? actionContext.contract_ready
            : undefined,
    contract_missing_keys:
      (Array.isArray(primary.contract_missing_keys) && primary.contract_missing_keys) ||
      (Array.isArray(riskContext.contract_missing_keys) && riskContext.contract_missing_keys) ||
      (Array.isArray(actionContext.contract_missing_keys) && actionContext.contract_missing_keys) ||
      []
  });
  if (resolvedActionContext) {
    resolvedActionContext.contract_state_key = contractMeta.contractStateKey;
    resolvedActionContext.contract_ready = contractMeta.contractReady;
    resolvedActionContext.contract_missing_keys = contractMeta.contractMissingKeys;
    resolvedActionContext.context_lookup_required = contractMeta.contextLookupRequired;
    resolvedActionContext.context_lookup_resolved = contractMeta.contextLookupResolved;
  }
  if (resolvedRiskContext) {
    resolvedRiskContext.contract_state_key = contractMeta.contractStateKey;
    resolvedRiskContext.contract_ready = contractMeta.contractReady;
    resolvedRiskContext.contract_missing_keys = contractMeta.contractMissingKeys;
    resolvedRiskContext.context_lookup_required = contractMeta.contextLookupRequired;
    resolvedRiskContext.context_lookup_resolved = contractMeta.contextLookupResolved;
  }
  return {
    familyKey,
    flowKey,
    microflowKey,
    focusKey,
    riskKey,
    riskFocusKey,
    riskContextSignature,
    actionContextSignature,
    entryKindKey,
    sequenceKindKey,
    riskHealthBandKey: readSceneActionText(
      riskContext.risk_health_band_key,
      actionContext.risk_health_band_key,
      primary.risk_health_band_key
    ),
    riskAttentionBandKey: readSceneActionText(
      riskContext.risk_attention_band_key,
      actionContext.risk_attention_band_key,
      primary.risk_attention_band_key
    ),
    riskTrendDirectionKey: readSceneActionText(
      riskContext.risk_trend_direction_key,
      actionContext.risk_trend_direction_key,
      primary.risk_trend_direction_key
    ),
    contextLookupRequired: contractMeta.contextLookupRequired,
    contextLookupResolved: contractMeta.contextLookupResolved,
    contractStateKey: contractMeta.contractStateKey,
    contractReady: contractMeta.contractReady,
    contractMissingKeys: contractMeta.contractMissingKeys,
    actionContext: resolvedActionContext,
    riskContext: resolvedRiskContext
  };
}

function mergeSceneActionContexts(...contexts: Array<ResolvedSceneActionContext | null | undefined>): ResolvedSceneActionContext {
  const pick = (selector: (context: ResolvedSceneActionContext) => string) =>
    readSceneActionText(...contexts.map((context) => selector(context || ({} as ResolvedSceneActionContext))));
  const flowKey = pick((context) => context.flowKey);
  const focusKey = pick((context) => context.focusKey);
  const riskFocusKey = pick((context) => context.riskFocusKey);
  const entryKindKey = pick((context) => context.entryKindKey);
  const sequenceKindKey = pick((context) => context.sequenceKindKey);
  const contractStateKey =
    pick((context) => context.contractStateKey) ||
    (contexts.every((context) => !context || context.contractStateKey === "ready") ? "ready" : "missing");
  return {
    familyKey: pick((context) => context.familyKey),
    flowKey,
    microflowKey: pick((context) => context.microflowKey),
    focusKey,
    riskKey: pick((context) => context.riskKey),
    riskFocusKey,
    riskContextSignature:
      pick((context) => context.riskContextSignature) ||
      buildSceneRiskContextSignature(flowKey, riskFocusKey, entryKindKey, sequenceKindKey),
    actionContextSignature:
      pick((context) => context.actionContextSignature) ||
      buildSceneActionContextSignature(flowKey, focusKey, entryKindKey, sequenceKindKey),
    entryKindKey,
    sequenceKindKey,
    riskHealthBandKey: pick((context) => context.riskHealthBandKey),
    riskAttentionBandKey: pick((context) => context.riskAttentionBandKey),
    riskTrendDirectionKey: pick((context) => context.riskTrendDirectionKey),
    contextLookupRequired: contexts.some((context) => context?.contextLookupRequired === true),
    contextLookupResolved: contexts.every(
      (context) => !context || context.contextLookupRequired !== true || context.contextLookupResolved === true
    ),
    contractStateKey,
    contractReady: contexts.every((context) => !context || context.contractReady),
    contractMissingKeys: [...new Set(contexts.flatMap((context) => context?.contractMissingKeys || []))],
    actionContext:
      contexts.map((context) => context?.actionContext).find((context) => Boolean(context)) || null,
    riskContext:
      contexts.map((context) => context?.riskContext).find((context) => Boolean(context)) || null
  };
}

function isStrictSceneActionContractReady(context: ResolvedSceneActionContext | null | undefined) {
  if (!context) {
    return false;
  }
  if (context.contextLookupRequired && !context.contextLookupResolved) {
    return false;
  }
  if (!context.contractReady || context.contractStateKey !== "ready") {
    return false;
  }
  if (
    !context.flowKey ||
    !context.focusKey ||
    !context.riskKey ||
    !context.riskFocusKey ||
    !context.entryKindKey ||
    !context.sequenceKindKey ||
    !context.actionContextSignature ||
    !context.riskContextSignature
  ) {
    return false;
  }
  const actionContext = context.actionContext || null;
  const riskContext = context.riskContext || null;
  if (!actionContext || !riskContext) {
    return false;
  }
  if (
    actionContext.context_lookup_required === true && actionContext.context_lookup_resolved !== true
  ) {
    return false;
  }
  if (
    riskContext.context_lookup_required === true && riskContext.context_lookup_resolved !== true
  ) {
    return false;
  }
  if (
    actionContext.contract_state_key !== "ready" ||
    riskContext.contract_state_key !== "ready" ||
    actionContext.contract_ready !== true ||
    riskContext.contract_ready !== true
  ) {
    return false;
  }
  if (
    !actionContext.action_context_signature ||
    !riskContext.risk_context_signature ||
    !actionContext.flow_key ||
    !actionContext.focus_key ||
    !riskContext.risk_focus_key ||
    !riskContext.entry_kind_key ||
    !riskContext.sequence_kind_key
  ) {
    return false;
  }
  return true;
}

async function loadBabylonSceneModules() {
  const [
    { Engine },
    { Scene },
    { ArcRotateCamera },
    { Vector3 },
    { Color3, Color4 },
    { HemisphericLight },
    { PointLight },
    { GlowLayer },
    { CreateDisc },
    { CreateBox },
    { CreateTorus },
    { CreateCylinder },
    { CreateSphere },
    { StandardMaterial }
  ] = await Promise.all([
    import("@babylonjs/core/Engines/engine"),
    import("@babylonjs/core/scene"),
    import("@babylonjs/core/Cameras/arcRotateCamera"),
    import("@babylonjs/core/Maths/math.vector"),
    import("@babylonjs/core/Maths/math.color"),
    import("@babylonjs/core/Lights/hemisphericLight"),
    import("@babylonjs/core/Lights/pointLight"),
    import("@babylonjs/core/Layers/glowLayer"),
    import("@babylonjs/core/Meshes/Builders/discBuilder"),
    import("@babylonjs/core/Meshes/Builders/boxBuilder"),
    import("@babylonjs/core/Meshes/Builders/torusBuilder"),
    import("@babylonjs/core/Meshes/Builders/cylinderBuilder"),
    import("@babylonjs/core/Meshes/Builders/sphereBuilder"),
    import("@babylonjs/core/Materials/standardMaterial")
  ]);
  return {
    ArcRotateCamera,
    Color3,
    Color4,
    CreateBox,
    CreateCylinder,
    CreateDisc,
    CreateSphere,
    CreateTorus,
    Engine,
    GlowLayer,
    HemisphericLight,
    PointLight,
    Scene,
    StandardMaterial,
    Vector3
  };
}

export function BabylonDistrictSceneHost(props: BabylonDistrictSceneHostProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modalOpenRef = useRef(false);
  const selectedProtocolPodRef = useRef<ProtocolCardFlowPod | null>(null);
  const selectedMicroflowRef = useRef<NonNullable<ProtocolCardFlowPod["microflow_cards"]>[number] | null>(null);
  const lastLoopSignatureRef = useRef("");
  const [status, setStatus] = useState<"idle" | "ready" | "failed">("idle");
  const [hoverPreview, setHoverPreview] = useState<HoverPreview | null>(null);
  const [hoveredClusterKeyState, setHoveredClusterKeyState] = useState("");
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeProtocolCardKey, setActiveProtocolCardKey] = useState("");
  const [activeProtocolPodKey, setActiveProtocolPodKey] = useState("");
  const [activeMicroflowKey, setActiveMicroflowKey] = useState("");
  const worldState = useMemo(
    () =>
      buildDistrictWorldState({
        workspace: props.workspace,
        tab: props.tab,
        scene: props.scene,
        sceneRuntime: props.sceneRuntime,
        navigationContext: props.navigationContext,
        data: props.data,
        homeFeed: props.homeFeed,
        taskResult: props.taskResult,
        pvpRuntime: props.pvpRuntime,
        leagueOverview: props.leagueOverview,
        pvpLive: props.pvpLive,
        vaultData: props.vaultData,
        adminRuntime: props.adminRuntime
      }),
    [
      props.adminRuntime,
      props.data,
      props.homeFeed,
      props.leagueOverview,
      props.navigationContext,
      props.pvpLive,
      props.pvpRuntime,
      props.scene,
      props.sceneRuntime,
      props.tab,
      props.taskResult,
      props.vaultData,
      props.workspace
    ]
  );
  const worldSignature = useMemo(
    () =>
      JSON.stringify({
        world_key: worldState.world_key,
        effective_quality: worldState.effective_quality,
        hud_density: worldState.hud_density,
        low_end_mode: worldState.low_end_mode,
        reduced_motion: worldState.reduced_motion,
        district_theme_key: worldState.district_theme_key,
        director_profile_key: worldState.director_profile_key,
        active_node_key: worldState.active_node_key,
        camera_profile_key: worldState.camera_profile_key,
        active_hotspot_key: worldState.active_hotspot_key,
        active_hotspot_cluster_key: worldState.active_hotspot_cluster_key,
        active_cluster_key: worldState.active_cluster_key,
        ambient_energy: worldState.ambient_energy,
        actors: worldState.actors.map((actor) => ({
          key: actor.key,
          kind: actor.kind,
          energy: actor.energy
        })),
        hotspots: worldState.hotspots.map((hotspot) => ({
          key: hotspot.key,
          action_key: hotspot.action_key,
          is_active: hotspot.is_active,
          is_secondary: hotspot.is_secondary,
          cluster_key: hotspot.cluster_key,
          energy: hotspot.energy
        })),
        interaction_clusters: worldState.interaction_clusters.map((cluster) => ({
          cluster_key: cluster.cluster_key,
          hotspot_count: cluster.hotspot_count,
          secondary_count: cluster.secondary_count,
          is_active: cluster.is_active,
          energy: cluster.energy,
          action_items: cluster.action_items.map((item: ClusterActionItem) => ({
            key: item.key,
            intent_profile_key: item.intent_profile_key,
            rail_class_key: String(item.intent_profile?.rail_class_key || "")
          })),
          intent_slots: cluster.intent_slots.map((slot: any) => ({
            slot_key: slot.slot_key,
            band_key: slot.band_key,
            orbit_scale: slot.orbit_scale,
            size_scalar: slot.size_scalar
          }))
        })),
        nodes: worldState.nodes.map((node) => ({
          key: node.key,
          action_key: node.action_key,
          is_active: node.is_active,
          energy: node.energy,
          status_key: node.status_key,
          metric: node.metric
        }))
      }),
    [worldState]
  );
  const focusedCluster = useMemo(() => {
    const focusClusterKey = hoveredClusterKeyState || worldState.active_cluster_key;
    if (!focusClusterKey) {
      return null;
    }
    return worldState.interaction_clusters.find((cluster) => cluster.cluster_key === focusClusterKey) || null;
  }, [hoveredClusterKeyState, worldState.active_cluster_key, worldState.interaction_clusters]);
  const focusedClusterActions = useMemo(
    () => ((focusedCluster?.action_items as Array<ClusterActionItem> | undefined) || []).filter((item) => item.action_key),
    [focusedCluster]
  );
  const selectedProtocolCard = useMemo(() => {
    const cards = (worldState.interaction_modal?.protocol_cards as Array<ProtocolCard> | undefined) || [];
    if (!cards.length) {
      return null;
    }
    return cards.find((card) => card.card_key === activeProtocolCardKey) || cards[0] || null;
  }, [activeProtocolCardKey, worldState.interaction_modal?.protocol_cards]);
  const selectedProtocolPod = useMemo(() => {
    const pods = (selectedProtocolCard?.flow_pods as Array<ProtocolCardFlowPod> | undefined) || [];
    if (!pods.length) {
      return null;
    }
    return pods.find((pod) => pod.pod_key === activeProtocolPodKey) || pods[0] || null;
  }, [activeProtocolPodKey, selectedProtocolCard]);
  const selectedMicroflow = useMemo(() => {
    const flows = selectedProtocolPod?.microflow_cards || [];
    if (!flows.length) {
      return null;
    }
    return flows.find((flow) => flow.microflow_key === activeMicroflowKey) || flows[0] || null;
  }, [activeMicroflowKey, selectedProtocolPod]);
  const selectedModalLane = useMemo(() => {
    const cards = (worldState.interaction_modal?.modal_cards as Array<InteractionModalLaneCard> | undefined) || [];
    if (!cards.length) {
      return null;
    }
    return (
      cards.find((card) => card.protocol_pod_key && card.protocol_pod_key === selectedProtocolPod?.pod_key) ||
      cards.find((card) => card.protocol_card_key && card.protocol_card_key === selectedProtocolCard?.card_key) ||
      cards[0] ||
      null
    );
  }, [selectedProtocolCard, selectedProtocolPod, worldState.interaction_modal?.modal_cards]);
  const selectedLoopActionContext = useMemo(
    () => normalizeSceneActionContext(selectedMicroflow),
    [selectedMicroflow]
  );
  const resolveSceneActionContext = useCallback(
    (action?: SceneActionLike | null, fallback?: SceneActionLike | null) => {
      return mergeSceneActionContexts(
        normalizeSceneActionContext(action),
        normalizeSceneActionContext(fallback),
        selectedLoopActionContext
      );
    },
    [selectedLoopActionContext]
  );
  const activateModalLane = useCallback((card: InteractionModalLaneCard | null) => {
    if (!card) {
      return;
    }
    if (card.protocol_card_key) {
      setActiveProtocolCardKey(card.protocol_card_key);
    }
    if (card.protocol_pod_key) {
      setActiveProtocolPodKey(card.protocol_pod_key);
    }
    if (card.microflow_key) {
      setActiveMicroflowKey(card.microflow_key);
    }
  }, []);
  const buildSceneActionDataAttrs = useCallback(
    (action?: SceneActionLike | null, fallback?: SceneActionLike | null) => {
      const context = resolveSceneActionContext(action, fallback);
      const contractReady = isStrictSceneActionContractReady(context);
      return {
        "data-family-key": context.familyKey || "",
        "data-flow-key": context.flowKey || "",
        "data-microflow-key": context.microflowKey || "",
        "data-focus-key": context.focusKey || "",
        "data-risk-key": context.riskKey || "",
        "data-risk-focus-key": context.riskFocusKey || "",
        "data-action-context-signature": context.actionContextSignature || "",
        "data-risk-context-signature": context.riskContextSignature || "",
        "data-entry-kind-key": context.entryKindKey || "",
        "data-sequence-kind-key": context.sequenceKindKey || "",
        "data-risk-health-band": context.riskHealthBandKey || "",
        "data-risk-attention-band": context.riskAttentionBandKey || "",
        "data-risk-trend-direction": context.riskTrendDirectionKey || "",
        "data-context-lookup-required": context.contextLookupRequired ? "true" : "false",
        "data-context-lookup-resolved": context.contextLookupResolved ? "true" : "false",
        "data-contract-state": context.contractStateKey || "",
        "data-contract-ready": contractReady ? "true" : "false",
        "data-contract-missing-keys": context.contractMissingKeys.join(",")
      };
    },
    [resolveSceneActionContext]
  );
  const hasSceneActionContract = useCallback(
    (action?: SceneActionLike | null, fallback?: SceneActionLike | null) => {
      const context = resolveSceneActionContext(action, fallback);
      return isStrictSceneActionContractReady(context);
    },
    [resolveSceneActionContext]
  );
  const buildMeshActionMetadata = useCallback(
    (action: Record<string, any>, patch: Record<string, any>) => {
      const context = resolveSceneActionContext(action);
      return {
        ...patch,
        familyKey: context.familyKey || "",
        flowKey: context.flowKey || "",
        microflowKey: context.microflowKey || "",
        focusKey: context.focusKey || "",
        riskKey: context.riskKey || "",
        riskFocusKey: context.riskFocusKey || "",
        actionContextSignature: context.actionContextSignature || "",
        riskContextSignature: context.riskContextSignature || "",
        actionContext: context.actionContext || null,
        riskContext: context.riskContext || null,
        riskHealthBandKey: context.riskHealthBandKey || "",
        riskAttentionBandKey: context.riskAttentionBandKey || "",
        riskTrendDirectionKey: context.riskTrendDirectionKey || "",
        contractStateKey: context.contractStateKey || "",
        entryKindKey: context.entryKindKey || "",
        sequenceKindKey: context.sequenceKindKey || "",
        contractReady: context.contractReady,
        contractMissingKeys: context.contractMissingKeys
      };
    },
    [resolveSceneActionContext]
  );
  const renderSceneActionContextMeta = useCallback(
    (action?: SceneActionLike | null, fallback?: SceneActionLike | null) => {
      const context = resolveSceneActionContext(action, fallback);
      const parts = [];
      if (context.familyKey) {
        parts.push(`FAM ${context.familyKey}`);
      }
      if (context.microflowKey) {
        parts.push(`MICRO ${context.microflowKey}`);
      }
      if (context.entryKindKey) {
        parts.push(`ENTRY ${context.entryKindKey}`);
      }
      if (context.sequenceKindKey) {
        parts.push(`SEQ ${context.sequenceKindKey}`);
      }
      if (context.riskFocusKey) {
        parts.push(`RFK ${context.riskFocusKey}`);
      }
      if (context.actionContextSignature) {
        parts.push(`ACS ${context.actionContextSignature}`);
      }
      if (context.riskContextSignature) {
        parts.push(`RCS ${context.riskContextSignature}`);
      }
      if (context.contextLookupRequired) {
        parts.push(`LOOKUP ${context.contextLookupResolved ? "ok" : "miss"}`);
      }
      if (context.contractStateKey) {
        parts.push(`CSTATE ${context.contractStateKey}`);
      }
      if (context.contractMissingKeys.length) {
        parts.push(`MISS ${context.contractMissingKeys.join(",")}`);
      }
      if (!parts.length) {
        return null;
      }
      return <small className="akrSceneActionContextMeta">{parts.join(" | ")}</small>;
    },
    [resolveSceneActionContext]
  );
  const renderSceneActionContextChips = useCallback(
    (action?: SceneActionLike | null, fallback?: SceneActionLike | null) => {
      const context = resolveSceneActionContext(action, fallback);
      const chips = [
        context.flowKey ? { label: "FLOW", value: context.flowKey, tone: "flow" } : null,
        context.entryKindKey ? { label: "ENTRY", value: context.entryKindKey, tone: "entry" } : null,
        context.sequenceKindKey ? { label: "SEQ", value: context.sequenceKindKey, tone: "sequence" } : null,
        context.riskHealthBandKey ? { label: "HB", value: context.riskHealthBandKey, tone: context.riskHealthBandKey } : null,
        context.riskAttentionBandKey
          ? { label: "ATTN", value: context.riskAttentionBandKey, tone: context.riskAttentionBandKey }
          : null,
        context.riskTrendDirectionKey ? { label: "TREND", value: context.riskTrendDirectionKey, tone: "trend" } : null,
        context.contextLookupRequired
          ? {
              label: "LOOKUP",
              value: context.contextLookupResolved ? "ok" : "miss",
              tone: context.contextLookupResolved ? "green" : "red"
            }
          : null,
        context.contractStateKey ? { label: "CSTATE", value: context.contractStateKey, tone: context.contractStateKey } : null,
        context.actionContextSignature
          ? { label: "ACS", value: context.actionContextSignature, tone: "signature" }
          : null,
        context.riskContextSignature
          ? { label: "RCS", value: context.riskContextSignature, tone: "signature" }
          : null,
        context.contractReady
          ? { label: "READY", value: "true", tone: "green" }
          : null,
        !context.contractReady && context.contractMissingKeys.length
          ? { label: "MISS", value: context.contractMissingKeys.join(","), tone: "red" }
          : null
      ].filter(Boolean) as Array<{ label: string; value: string; tone: string }>;
      if (!chips.length) {
        return null;
      }
      return (
        <div className="akrSceneActionContextChips">
          {chips.map((chip) => (
            <div key={`${chip.label}:${chip.value}`} className={`akrSceneActionContextChip is-${chip.tone}`}>
              <span>{chip.label}</span>
              <strong>{chip.value}</strong>
            </div>
          ))}
        </div>
      );
    },
    [resolveSceneActionContext]
  );
  const renderPrimaryActionSummary = useCallback(
    (
      source?: PrimaryActionSummary | Record<string, unknown> | null,
      options?: { compact?: boolean; fallback?: SceneActionLike | null }
    ) => {
      const compact = options?.compact === true;
      const primarySource = buildPrimarySceneActionSource(source);
      const primaryContext = resolveSceneActionContext(primarySource, options?.fallback);
      const primaryContractReady = isStrictSceneActionContractReady(primaryContext);
      const actionLabelKey = readSceneActionText(primarySource.action_label_key);
      const actionHintLabelKey = readSceneActionText(primarySource.hint_label_key);
      const hasPrimarySummary = Boolean(
        readSceneActionText(
          primarySource.action_key,
          actionLabelKey,
          primaryContext.flowKey,
          primaryContext.focusKey,
          primaryContext.riskFocusKey
        )
      );
      if (!hasPrimarySummary) {
        return null;
      }
      const chips = [
        actionLabelKey
          ? {
              label: t(props.lang, "world_modal_chip_primary_action" as never),
              value: t(props.lang, actionLabelKey as never),
              tone: "flow"
            }
          : null,
        primaryContext.familyKey
          ? {
              label: t(props.lang, "world_modal_chip_primary_family" as never),
              value: primaryContext.familyKey,
              tone: "entry"
            }
          : null,
        primaryContext.flowKey
          ? {
              label: t(props.lang, "world_modal_chip_primary_flow" as never),
              value: primaryContext.flowKey,
              tone: "flow"
            }
          : null,
        primaryContext.microflowKey
          ? {
              label: t(props.lang, "world_modal_chip_primary_microflow" as never),
              value: primaryContext.microflowKey,
              tone: "sequence"
            }
          : null,
        primaryContext.focusKey
          ? {
              label: t(props.lang, "world_modal_chip_primary_focus" as never),
              value: primaryContext.focusKey,
              tone: "signature"
            }
          : null,
        primaryContext.riskFocusKey
          ? {
              label: t(props.lang, "world_modal_chip_primary_risk_focus" as never),
              value: primaryContext.riskFocusKey,
              tone: primaryContext.riskHealthBandKey || "trend"
            }
          : null,
        primaryContext.entryKindKey
          ? {
              label: t(props.lang, "world_modal_chip_entry_kind" as never),
              value: t(props.lang, primaryContext.entryKindKey as never),
              tone: "entry"
            }
          : null,
        primaryContext.sequenceKindKey
          ? {
              label: t(props.lang, "world_modal_chip_sequence_kind" as never),
              value: t(props.lang, primaryContext.sequenceKindKey as never),
              tone: "sequence"
            }
          : null,
        {
          label: t(props.lang, "world_modal_chip_primary_contract" as never),
          value: primaryContractReady ? "ready" : "missing",
          tone: primaryContractReady ? "green" : "red"
        }
      ].filter(Boolean) as Array<{ label: string; value: string; tone: string }>;
      return (
        <div
          className={`akrScenePrimaryActionSummary ${compact ? "is-compact" : "is-full"} ${
            primaryContractReady ? "is-contract-ready" : "is-contract-missing"
          }`}
          {...buildSceneActionDataAttrs(primarySource, options?.fallback)}
        >
          <div className="akrScenePrimaryActionSummaryHeader">
            <span>{t(props.lang, "world_modal_section_primary_summary" as never)}</span>
            <strong>
              {actionLabelKey
                ? t(props.lang, actionLabelKey as never)
                : primaryContext.focusKey || primaryContext.flowKey || primarySource.action_key}
            </strong>
          </div>
          <div className="akrScenePrimaryActionSummaryChips">
            {(compact ? chips.slice(0, 4) : chips).map((chip) => (
              <div key={`${chip.label}:${chip.value}`} className={`akrSceneInteractionModalChip is-${chip.tone}`}>
                <span>{chip.label}</span>
                <strong>{chip.value}</strong>
              </div>
            ))}
          </div>
          {actionHintLabelKey ? (
            <small className="akrSceneActionContextMeta">{t(props.lang, actionHintLabelKey as never)}</small>
          ) : null}
          {!compact ? renderSceneActionContextChips(primarySource, options?.fallback) : null}
        </div>
      );
    },
    [buildSceneActionDataAttrs, props.lang, renderSceneActionContextChips, resolveSceneActionContext]
  );

  useEffect(() => {
    setTerminalOpen(false);
    setModalOpen(false);
    setActiveProtocolCardKey("");
    setActiveProtocolPodKey("");
  }, [worldState.interaction_terminal?.terminal_key]);

  useEffect(() => {
    const cards = (worldState.interaction_modal?.protocol_cards as Array<ProtocolCard> | undefined) || [];
    if (!cards.length) {
      if (activeProtocolCardKey) {
        setActiveProtocolCardKey("");
      }
      return;
    }
    if (!cards.some((card) => card.card_key === activeProtocolCardKey)) {
      setActiveProtocolCardKey(cards[0].card_key);
    }
  }, [activeProtocolCardKey, worldState.interaction_modal?.modal_key, worldState.interaction_modal?.protocol_cards]);

  useEffect(() => {
    const pods = (selectedProtocolCard?.flow_pods as Array<ProtocolCardFlowPod> | undefined) || [];
    if (!pods.length) {
      if (activeProtocolPodKey) {
        setActiveProtocolPodKey("");
      }
      return;
    }
    if (!pods.some((pod) => pod.pod_key === activeProtocolPodKey)) {
      setActiveProtocolPodKey(pods[0].pod_key);
    }
  }, [activeProtocolPodKey, selectedProtocolCard]);

  useEffect(() => {
    const flows = selectedProtocolPod?.microflow_cards || [];
    if (!flows.length) {
      if (activeMicroflowKey) {
        setActiveMicroflowKey("");
      }
      return;
    }
    if (!flows.some((flow) => flow.microflow_key === activeMicroflowKey)) {
      setActiveMicroflowKey(flows[0].microflow_key);
    }
  }, [activeMicroflowKey, selectedProtocolPod]);

  useEffect(() => {
    modalOpenRef.current = modalOpen;
    selectedProtocolPodRef.current = selectedProtocolPod;
    selectedMicroflowRef.current = selectedMicroflow;
  }, [modalOpen, selectedProtocolPod, selectedMicroflow]);

  useEffect(() => {
    if (!props.onLoopStateChange) {
      return;
    }
    if (!modalOpen || !selectedProtocolCard || !selectedProtocolPod || !selectedMicroflow) {
      if (lastLoopSignatureRef.current) {
        props.onLoopStateChange(null);
      }
      lastLoopSignatureRef.current = "";
      return;
    }
    const signature = JSON.stringify({
      district_key: worldState.district_key,
      protocol_card_key: selectedProtocolCard.card_key,
      protocol_pod_key: selectedProtocolPod.pod_key,
      microflow_key: selectedMicroflow.microflow_key,
      focus_key: selectedMicroflow.focus_key || "",
      risk_key: selectedMicroflow.risk_key || "",
      risk_focus_key: selectedMicroflow.risk_focus_key || "",
      action_context_signature: selectedMicroflow.action_context_signature || "",
      risk_context_signature: selectedMicroflow.risk_context_signature || "",
      loop_status_key: selectedMicroflow.loop_status_key || selectedMicroflow.status_key || "",
      loop_stage_value: selectedMicroflow.loop_stage_value || selectedMicroflow.stage_value || "",
      sequence_kind_key: selectedMicroflow.sequence_kind_key || "",
      entry_kind_key: selectedMicroflow.entry_kind_key || "",
      director_pace_label_key: selectedMicroflow.director_pace_label_key || "",
      hud_tone_label_key: selectedMicroflow.hud_tone_label_key || "",
      personality_key: selectedMicroflow.personality_key || "",
      personality_label_key: selectedMicroflow.personality_label_key || "",
      personality_caption_key: selectedMicroflow.personality_caption_key || "",
      personality_band_key: selectedMicroflow.personality_band_key || "",
      density_label_key: selectedMicroflow.density_label_key || ""
    });
    if (signature === lastLoopSignatureRef.current) {
      return;
    }
    lastLoopSignatureRef.current = signature;
    props.onLoopStateChange({
      districtKey: worldState.district_key,
      workspace: props.workspace,
      tab: props.tab,
      protocolCardKey: selectedProtocolCard.card_key,
      protocolPodKey: selectedProtocolPod.pod_key,
      microflowKey: selectedMicroflow.microflow_key,
      focusKey: selectedMicroflow.focus_key || undefined,
      riskKey: selectedMicroflow.risk_key || undefined,
      riskFocusKey: selectedMicroflow.risk_focus_key || undefined,
      actionContextSignature: selectedMicroflow.action_context_signature || undefined,
      riskContextSignature: selectedMicroflow.risk_context_signature || undefined,
      actionContext:
        selectedMicroflow.action_context && typeof selectedMicroflow.action_context === "object"
          ? (selectedMicroflow.action_context as RiskContext)
          : null,
      riskContext:
        selectedMicroflow.risk_context && typeof selectedMicroflow.risk_context === "object"
          ? (selectedMicroflow.risk_context as RiskContext)
          : null,
      entryKindKey: String(selectedMicroflow.entry_kind_key || ""),
      sequenceKindKey: String(selectedMicroflow.sequence_kind_key || ""),
      loopStatusKey: String(selectedMicroflow.loop_status_key || selectedMicroflow.status_key || ""),
      loopStatusLabelKey: selectedMicroflow.loop_status_label_key || undefined,
      loopStageValue: String(selectedMicroflow.loop_stage_value || selectedMicroflow.stage_value || ""),
      directorPaceLabelKey: selectedMicroflow.director_pace_label_key || undefined,
      hudToneLabelKey: selectedMicroflow.hud_tone_label_key || undefined,
      personalityKey: selectedMicroflow.personality_key || undefined,
      personalityLabelKey: selectedMicroflow.personality_label_key || undefined,
      personalityCaptionKey: selectedMicroflow.personality_caption_key || undefined,
      personalityBandKey: selectedMicroflow.personality_band_key || undefined,
      densityLabelKey: selectedMicroflow.density_label_key || undefined,
      loopRows: Array.isArray(selectedMicroflow.loop_rows) ? selectedMicroflow.loop_rows.slice(0, 3) : [],
      loopSignalRows: Array.isArray(selectedMicroflow.loop_signal_rows) ? selectedMicroflow.loop_signal_rows.slice(0, 2) : [],
      sequenceRows: Array.isArray(selectedMicroflow.sequence_rows) ? selectedMicroflow.sequence_rows.slice(0, 3) : [],
      actorKey: worldState.active_hotspot_key || undefined,
      clusterKey: worldState.active_cluster_key || undefined,
      hotspotKey: worldState.active_hotspot_key || undefined,
      sourceType: "district_scene_live_loop"
    });
  }, [
    modalOpen,
    props.onLoopStateChange,
    props.tab,
    props.workspace,
    selectedMicroflow,
    selectedProtocolCard,
    selectedProtocolPod,
    worldState.active_cluster_key,
    worldState.active_hotspot_key,
    worldState.district_key
  ]);

  const triggerSceneAction = useCallback(
    (payload: {
      actionKey: string;
      nodeKey: string;
      laneKey: string;
      label: string;
      labelKey?: string;
      familyKey?: string;
      flowKey?: string;
      microflowKey?: string;
      focusKey?: string;
      riskKey?: string;
      riskFocusKey?: string;
      actionContextSignature?: string;
      actionContext?: RiskContext | null;
      riskHealthBandKey?: string;
      riskAttentionBandKey?: string;
      riskTrendDirectionKey?: string;
      riskContextSignature?: string;
      riskContext?: RiskContext | null;
      entryKindKey?: string;
      sequenceKindKey?: string;
      sourceType?: string;
      actorKey?: string;
      interactionKind?: string;
      clusterKey?: string;
      isSecondary?: boolean;
      workspace: "player" | "admin";
      tab: "home" | "pvp" | "tasks" | "vault";
      districtKey: string;
    }) => {
      props.onNodeAction?.(payload);
    },
    [props.onNodeAction]
  );

  useEffect(() => {
    let disposed = false;
    let handle: BabylonSceneHandle | null = null;
    let hoveredHotspotKey = "";
    let hoveredClusterKey = "";

    const buildScene = async () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      try {
        const BABYLON = await loadBabylonSceneModules();
        if (disposed) {
          return;
        }
        const {
          ArcRotateCamera,
          Color3,
          Color4,
          CreateBox,
          CreateCylinder,
          CreateDisc,
          CreateSphere,
          CreateTorus,
          Engine,
          GlowLayer,
          HemisphericLight,
          PointLight,
          Scene,
          StandardMaterial,
          Vector3
        } = BABYLON;

        const engine = new Engine(
          canvas,
          worldState.effective_quality === "high" && !worldState.low_end_mode,
          {
            preserveDrawingBuffer: false,
            stencil: false,
            antialias: worldState.effective_quality === "high" && !worldState.low_end_mode,
            powerPreference: worldState.low_end_mode ? "low-power" : "high-performance"
          },
          false
        );
        engine.setHardwareScalingLevel(worldState.hardware_scaling);

        const scene = new Scene(engine);
        scene.clearColor = new Color4(0, 0, 0, 0);
        const theme = worldState.theme;
        const cameraProfile = worldState.camera_profile;
        const directorProfile = worldState.director_profile;
        const activeHotspot =
          worldState.hotspots.find((hotspot) => hotspot.key === worldState.active_hotspot_key) || worldState.hotspots[0] || null;
        const hotspotMap = new Map(worldState.hotspots.map((hotspot) => [hotspot.key, hotspot]));

        const camera = new ArcRotateCamera(
          "akrDistrictCamera",
          cameraProfile.alpha_base,
          cameraProfile.beta_base,
          cameraProfile.radius,
          new Vector3(0, cameraProfile.target_y, 0),
          scene
        );
        camera.lowerRadiusLimit = cameraProfile.radius - cameraProfile.lower_radius_delta;
        camera.upperRadiusLimit = cameraProfile.radius + cameraProfile.upper_radius_delta;
        camera.wheelDeltaPercentage = 0.01;
        camera.panningSensibility = 0;
        const cameraBaseFov = camera.fov;

        const hemi = new HemisphericLight("akrDistrictHemi", new Vector3(0, 1, 0), scene);
        const hemiBaseIntensity = worldState.low_end_mode ? 0.7 : 0.92;
        hemi.intensity = hemiBaseIntensity;

        const point = new PointLight("akrDistrictPoint", new Vector3(0, 3.2, 0), scene);
        const pointBaseIntensity = 1.2 + worldState.ambient_energy * 0.6;
        point.intensity = pointBaseIntensity;
        point.diffuse = Color3.FromHexString(theme.light_hex);
        const pointDiffuseBase = Color3.FromHexString(theme.light_hex);

        let glow: any = null;
        const glowBaseIntensity = worldState.effective_quality === "high" ? 0.48 : 0.22;
        if (!worldState.low_end_mode) {
          glow = new GlowLayer("akrDistrictGlow", scene, {
            mainTextureFixedSize: worldState.effective_quality === "high" ? 1024 : 512,
            blurKernelSize: 32
          });
          glow.intensity = glowBaseIntensity;
        }

        const ground = CreateDisc(
          "akrDistrictGround",
          {
            radius: worldState.workspace === "admin" ? 5.6 : 5,
            tessellation: worldState.low_end_mode ? 36 : 64
          },
          scene
        );
        ground.rotation.x = Math.PI / 2;
        const groundMaterial = new StandardMaterial("akrDistrictGroundMaterial", scene);
        groundMaterial.alpha = 0.86;
        groundMaterial.diffuseColor = Color3.FromHexString(theme.ground_hex);
        const groundEmissiveBase = Color3.FromHexString(theme.ground_glow_hex);
        groundMaterial.emissiveColor = groundEmissiveBase;
        ground.material = groundMaterial;

        const ring = CreateTorus(
          "akrDistrictRing",
          {
            diameter: theme.orbit_radius * 2.45,
            thickness: 0.08,
            tessellation: worldState.low_end_mode ? 44 : 72
          },
          scene
        );
        ring.rotation.x = Math.PI / 2;
        const ringMaterial = new StandardMaterial("akrDistrictRingMaterial", scene);
        ringMaterial.diffuseColor = Color3.FromHexString(theme.ground_glow_hex);
        const ringEmissiveBase = Color3.FromHexString(theme.ring_hex);
        ringMaterial.emissiveColor = ringEmissiveBase;
        ring.material = ringMaterial;

        let outerRing: any = null;
        let outerRingMaterial: any = null;
        let outerRingEmissiveBase: any = null;
        if (!worldState.low_end_mode) {
          outerRing = CreateTorus(
            "akrDistrictOuterRing",
            {
              diameter: theme.orbit_radius * 2.9,
              thickness: 0.05,
              tessellation: 48
            },
            scene
          );
          outerRing.rotation.x = Math.PI / 2.4;
          outerRing.rotation.z = districtTilt(theme.theme_key);
          outerRingMaterial = new StandardMaterial("akrDistrictOuterRingMaterial", scene);
          outerRingMaterial.diffuseColor = Color3.FromHexString(theme.ring_secondary_hex);
          outerRingEmissiveBase = Color3.FromHexString(theme.ring_secondary_hex);
          outerRingMaterial.emissiveColor = outerRingEmissiveBase;
          outerRing.material = outerRingMaterial;
        }

        const coreColumn = CreateCylinder(
          "akrDistrictCoreColumn",
          { height: worldState.workspace === "admin" ? 1.45 : 1.2, diameter: 0.5, tessellation: worldState.low_end_mode ? 8 : 16 },
          scene
        );
        coreColumn.position.y = 0.52;
        const coreColumnMaterial = new StandardMaterial("akrDistrictCoreColumnMaterial", scene);
        coreColumnMaterial.diffuseColor = Color3.FromHexString(theme.ground_glow_hex);
        const coreColumnEmissiveBase = Color3.FromHexString(theme.ring_secondary_hex);
        coreColumnMaterial.emissiveColor = coreColumnEmissiveBase;
        coreColumn.material = coreColumnMaterial;

        const coreOrb = CreateSphere(
          "akrDistrictCoreOrb",
          {
            diameter: worldState.workspace === "admin" ? 1.25 : 1.1,
            segments: worldState.low_end_mode ? 10 : 18
          },
          scene
        );
        coreOrb.position.y = 1.35;
        const coreOrbMaterial = new StandardMaterial("akrDistrictCoreOrbMaterial", scene);
        coreOrbMaterial.diffuseColor = Color3.FromHexString(theme.ground_glow_hex);
        const coreOrbEmissiveBase = Color3.FromHexString(theme.core_hex);
        coreOrbMaterial.emissiveColor = coreOrbEmissiveBase;
        coreOrb.material = coreOrbMaterial;

        const satellites = Array.from({ length: theme.satellite_count }, (_, index) => {
          const angle = (Math.PI * 2 * index) / Math.max(1, theme.satellite_count);
          const orb = CreateSphere(
            `akrDistrictSatellite-${index}`,
            {
              diameter: worldState.low_end_mode ? 0.12 : 0.16,
              segments: worldState.low_end_mode ? 6 : 12
            },
            scene
          );
          orb.position = new Vector3(
            Math.cos(angle) * theme.satellite_radius,
            theme.satellite_height,
            Math.sin(angle) * theme.satellite_radius
          );
          const material = new StandardMaterial(`akrDistrictSatelliteMaterial-${index}`, scene);
          material.diffuseColor = Color3.FromHexString(theme.satellite_hex);
          const emissiveBase = Color3.FromHexString(theme.satellite_hex);
          material.emissiveColor = emissiveBase;
          orb.material = material;
          return { orb, baseAngle: angle, material, emissiveBase };
        });

        const actorHandles = worldState.actors.flatMap((actor) =>
          createDistrictActorHandles({
            actor,
            scene,
            theme,
            lowEndMode: worldState.low_end_mode,
            CreateBox,
            CreateCylinder,
            CreateSphere,
            CreateTorus,
            StandardMaterial,
            Color3,
            Vector3
          })
        );

        const clusterHandles = worldState.interaction_clusters.map((cluster, index) => {
          const primaryHotspot =
            hotspotMap.get(cluster.active_hotspot_key) ||
            hotspotMap.get(cluster.primary_hotspot_key) ||
            hotspotMap.get(cluster.hotspot_keys[0]) ||
            null;
          const typedPrimaryHotspot = (primaryHotspot || null) as Record<string, any> | null;
          const ring = CreateTorus(
            `akrDistrictClusterRing-${cluster.cluster_key}`,
            {
              diameter: cluster.orbit_radius * 2,
              thickness: cluster.is_active ? 0.07 : 0.04,
              tessellation: worldState.low_end_mode ? 24 : 38
            },
            scene
          );
          ring.rotation.x = Math.PI / 2;
          ring.position = new Vector3(cluster.x, cluster.y + 0.16, cluster.z);
          const ringMaterial = new StandardMaterial(`akrDistrictClusterRingMaterial-${cluster.cluster_key}`, scene);
          ringMaterial.diffuseColor = Color3.FromHexString(typedPrimaryHotspot?.accent_hex || theme.ring_hex);
          ringMaterial.emissiveColor = Color3.FromHexString(
            cluster.is_active ? theme.core_hex : typedPrimaryHotspot?.accent_hex || theme.ring_hex
          );
          ring.material = ringMaterial;

          const slots = cluster.intent_slots
            .map((slot: any, slotIndex: number) => {
              const hotspot = hotspotMap.get(slot.key) as Record<string, any> | undefined;
              if (!hotspot || !slot.action_key) {
                return null;
              }
              const ring = CreateTorus(
                `akrDistrictClusterSlotRing-${cluster.cluster_key}-${slot.slot_key}`,
                {
                  diameter: (hotspot.is_secondary ? 0.2 : 0.26) * slot.size_scalar,
                  thickness: hotspot.is_secondary ? 0.022 : 0.03,
                  tessellation: worldState.low_end_mode ? 16 : 24
                },
                scene
              );
              ring.rotation.x = Math.PI / 2;
              const ringMaterial = new StandardMaterial(
                `akrDistrictClusterSlotRingMaterial-${cluster.cluster_key}-${slot.slot_key}`,
                scene
              );
              ringMaterial.diffuseColor = Color3.FromHexString(hotspot.accent_hex);
              ringMaterial.emissiveColor = Color3.FromHexString(hotspot.is_active ? theme.core_hex : hotspot.accent_hex);
              ring.material = ringMaterial;

              const pad = CreateDisc(
                `akrDistrictClusterSlotPad-${cluster.cluster_key}-${slot.slot_key}`,
                {
                  radius: (hotspot.is_secondary ? 0.1 : 0.14) * slot.size_scalar,
                  tessellation: worldState.low_end_mode ? 18 : 28
                },
                scene
              );
              pad.rotation.x = Math.PI / 2;
              const padMaterial = new StandardMaterial(
                `akrDistrictClusterSlotPadMaterial-${cluster.cluster_key}-${slot.slot_key}`,
                scene
              );
              padMaterial.alpha = hotspot.is_secondary ? 0.16 : 0.24;
              padMaterial.diffuseColor = Color3.FromHexString(hotspot.accent_hex);
              padMaterial.emissiveColor = Color3.FromHexString(hotspot.is_active ? theme.ring_secondary_hex : hotspot.accent_hex);
              pad.material = padMaterial;

              const orb = CreateSphere(
                `akrDistrictClusterSlotOrb-${cluster.cluster_key}-${slot.slot_key}`,
                {
                  diameter: (hotspot.is_secondary ? 0.09 : 0.13) * slot.size_scalar,
                  segments: worldState.low_end_mode ? 5 : 8
                },
                scene
              );
              const orbMaterial = new StandardMaterial(
                `akrDistrictClusterSlotOrbMaterial-${cluster.cluster_key}-${slot.slot_key}`,
                scene
              );
              orbMaterial.diffuseColor = Color3.FromHexString(theme.ground_glow_hex);
              orbMaterial.emissiveColor = Color3.FromHexString(hotspot.is_active ? theme.core_hex : hotspot.accent_hex);
              orb.material = orbMaterial;

              const metadata = buildMeshActionMetadata(slot, {
                actionKey: slot.action_key,
                nodeKey: slot.key,
                laneKey: cluster.actor_key,
                label: slot.label,
                labelKey: slot.label_key,
                hintLabelKey: slot.hint_label_key,
                intentLabelKey: String(slot.intent_profile?.intent_label_key || "world_intent_open"),
                intentToneKey: String(slot.intent_profile?.intent_tone_key || "world_intent_tone_open"),
                sourceType: "district_scene_cluster_slot",
                actorKey: slot.actor_key,
                interactionKind: slot.interaction_kind,
                clusterKey: slot.cluster_key,
                isSecondary: slot.is_secondary
              });
              [ring, pad, orb].forEach((mesh) => {
                mesh.isPickable = true;
                mesh.metadata = metadata;
              });

              return { ring, pad, orb, slot, hotspot, slotIndex };
            })
            .filter(Boolean) as Array<{
              ring: any;
              pad: any;
              orb: any;
              slot: any;
              hotspot: Record<string, any>;
              slotIndex: number;
            }>;

          return {
            cluster,
            ring,
            slots,
            animate: (now: number, motionScalar: number) => {
              const focusClusterKey = hoveredClusterKey || worldState.active_cluster_key;
              const isFocused = focusClusterKey === cluster.cluster_key;
              ring.rotation.z = now * (0.18 + index * 0.03) * motionScalar * directorProfile.cluster_spin_scalar;
              const ringScale = isFocused ? 1.06 : cluster.is_active ? 1.03 : 1;
              ring.scaling.setAll(ringScale);
              slots.forEach((entry) => {
                const angle =
                  entry.slot.angle_offset_scalar +
                  now * (0.4 + entry.slotIndex * 0.06) * motionScalar * directorProfile.cluster_spin_scalar;
                const radius = cluster.orbit_radius * Number(entry.slot.orbit_scale || 1);
                const x = cluster.x + Math.cos(angle) * radius;
                const z = cluster.z + Math.sin(angle) * radius;
                entry.ring.position.x = x;
                entry.ring.position.z = z;
                entry.ring.position.y = cluster.y + 0.18 + (isFocused ? 0.02 : 0);
                entry.pad.position.x = x;
                entry.pad.position.z = z;
                entry.pad.position.y = cluster.y + 0.2 + (isFocused ? 0.02 : 0);
                entry.orb.position.x = x;
                entry.orb.position.z = z;
                entry.orb.position.y =
                  cluster.y +
                  0.32 +
                  Math.sin(now * (1 + entry.slotIndex * 0.12)) * 0.04 * motionScalar +
                  (isFocused ? 0.06 : 0);
                const scale =
                  1 +
                  Math.sin(now * (1.2 + entry.slotIndex * 0.14)) * 0.06 * motionScalar * Number(entry.slot.size_scalar || 1) +
                  (entry.hotspot.is_active ? 0.14 : 0) +
                  (isFocused ? 0.08 : 0);
                entry.orb.scaling.setAll(scale);
                entry.ring.scaling.setAll(1 + (isFocused ? 0.08 : 0));
                entry.pad.scaling.setAll(1 + (isFocused ? 0.06 : 0));
              });
            }
          };
        });

        const hotspotHandles = worldState.hotspots.map((hotspot, index) => {
          const ring = CreateTorus(
            `akrDistrictHotspotRing-${hotspot.key}`,
            {
              diameter: hotspot.ring_radius * 2,
              thickness: hotspot.is_active ? 0.08 : hotspot.is_secondary ? 0.034 : 0.05,
              tessellation: worldState.low_end_mode ? 22 : 34
            },
            scene
          );
          ring.rotation.x = Math.PI / 2;
          ring.position = new Vector3(hotspot.x, hotspot.y, hotspot.z);
          const ringMaterial = new StandardMaterial(`akrDistrictHotspotRingMaterial-${hotspot.key}`, scene);
          ringMaterial.diffuseColor = Color3.FromHexString(hotspot.accent_hex);
          ringMaterial.emissiveColor = Color3.FromHexString(hotspot.is_active ? theme.core_hex : hotspot.accent_hex);
          ring.material = ringMaterial;

          const pad = CreateDisc(
            `akrDistrictHotspotPad-${hotspot.key}`,
            {
              radius: hotspot.radius,
              tessellation: worldState.low_end_mode ? 24 : 40
            },
            scene
          );
          pad.rotation.x = Math.PI / 2;
          pad.position = new Vector3(hotspot.x, hotspot.y + 0.02, hotspot.z);
          const padMaterial = new StandardMaterial(`akrDistrictHotspotPadMaterial-${hotspot.key}`, scene);
          padMaterial.alpha = hotspot.is_active ? 0.42 : hotspot.is_secondary ? 0.15 : 0.22;
          padMaterial.diffuseColor = Color3.FromHexString(hotspot.accent_hex);
          padMaterial.emissiveColor = Color3.FromHexString(hotspot.is_active ? theme.ring_secondary_hex : hotspot.accent_hex);
          pad.material = padMaterial;

          const beacon = CreateSphere(
            `akrDistrictHotspotBeacon-${hotspot.key}`,
            {
              diameter: hotspot.is_active ? 0.24 : hotspot.is_secondary ? 0.14 : 0.18,
              segments: worldState.low_end_mode ? 6 : 10
            },
            scene
          );
          beacon.position = new Vector3(hotspot.x, hotspot.y + 0.28, hotspot.z);
          const beaconMaterial = new StandardMaterial(`akrDistrictHotspotBeaconMaterial-${hotspot.key}`, scene);
          beaconMaterial.diffuseColor = Color3.FromHexString(theme.ground_glow_hex);
          beaconMaterial.emissiveColor = Color3.FromHexString(hotspot.is_active ? theme.core_hex : hotspot.accent_hex);
          beacon.material = beaconMaterial;

          const metadata = buildMeshActionMetadata(hotspot, {
            actionKey: hotspot.action_key,
            nodeKey: hotspot.key,
            laneKey: hotspot.actor_key,
            label: hotspot.label,
            labelKey: hotspot.label_key,
            hintLabelKey: hotspot.hint_label_key,
            intentLabelKey: String(hotspot.intent_profile?.intent_label_key || "world_intent_open"),
            intentToneKey: String(hotspot.intent_profile?.intent_tone_key || "world_intent_tone_open"),
            sourceType: hotspot.source_type,
            actorKey: hotspot.actor_key,
            interactionKind: hotspot.interaction_kind,
            clusterKey: hotspot.cluster_key,
            isSecondary: hotspot.is_secondary
          });
          [ring, pad, beacon].forEach((mesh) => {
            mesh.isPickable = Boolean(hotspot.action_key);
            mesh.metadata = metadata;
          });

          return {
            animate: (now: number, motionScalar: number) => {
              ring.rotation.z = now * (0.25 + index * 0.03) * motionScalar * directorProfile.cluster_spin_scalar;
              beacon.position.y = hotspot.y + 0.28 + Math.sin(now * (1.1 + index * 0.17)) * 0.06 * motionScalar;
              const isHovered = hoveredHotspotKey === hotspot.key;
              const pulse =
                1 +
                Math.sin(now * (1.3 + index * 0.14)) *
                  (hotspot.is_secondary ? 0.05 : 0.08) *
                  motionScalar *
                  Number(hotspot.intent_profile?.pulse_scalar || 1) +
                (hotspot.is_active ? 0.12 : 0) +
                (isHovered ? 0.08 : 0);
              beacon.scaling.setAll(pulse);
              pad.scaling.setAll(1 + Math.sin(now * (0.9 + index * 0.13)) * 0.04 * motionScalar + (isHovered ? 0.06 : 0));
            }
          };
        });

        const nodeHandles = worldState.nodes.map((node, index) => {
          const angle = (Math.PI * 2 * index) / Math.max(1, worldState.nodes.length);
          const radius = theme.orbit_radius;
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          const isActive = Boolean(node.is_active);

          const pillar = CreateCylinder(
            `akrDistrictNodePillar-${node.key}`,
            {
              height: 1 + node.energy * 1.7 + (isActive ? 0.3 : 0),
              diameter: isActive ? 0.3 : 0.24,
              tessellation: worldState.low_end_mode ? 8 : 14
            },
            scene
          );
          pillar.position = new Vector3(x, 0.48 + pillar.scaling.y * 0.12, z);

          const orb = CreateSphere(
            `akrDistrictNodeOrb-${node.key}`,
            { diameter: 0.38 + node.energy * 0.5 + (isActive ? 0.14 : 0), segments: worldState.low_end_mode ? 8 : 16 },
            scene
          );
          orb.position = new Vector3(x, 1.25 + node.energy * 0.8, z);

          const pillarMaterial = new StandardMaterial(`akrDistrictNodePillarMaterial-${node.key}`, scene);
          pillarMaterial.diffuseColor = Color3.FromHexString(isActive ? theme.ring_secondary_hex : theme.ground_hex);
          pillarMaterial.emissiveColor = Color3.FromHexString(isActive ? theme.core_hex : node.accent_hex);
          pillar.material = pillarMaterial;

          const orbMaterial = new StandardMaterial(`akrDistrictNodeOrbMaterial-${node.key}`, scene);
          orbMaterial.diffuseColor = Color3.FromHexString(isActive ? theme.core_hex : node.accent_hex);
          orbMaterial.emissiveColor = Color3.FromHexString(isActive ? theme.ring_hex : node.accent_hex);
          orb.material = orbMaterial;

          let halo: any = null;
          if (!worldState.low_end_mode) {
            halo = CreateTorus(
              `akrDistrictNodeHalo-${node.key}`,
              { diameter: 0.7 + node.energy * 0.46 + (isActive ? 0.12 : 0), thickness: isActive ? 0.06 : 0.04, tessellation: 24 },
              scene
            );
            halo.rotation.x = Math.PI / 2;
            halo.position = new Vector3(x, 0.12 + node.energy * 0.18, z);
            const haloMaterial = new StandardMaterial(`akrDistrictNodeHaloMaterial-${node.key}`, scene);
            haloMaterial.diffuseColor = Color3.FromHexString(isActive ? theme.ring_secondary_hex : node.accent_hex);
            haloMaterial.emissiveColor = Color3.FromHexString(isActive ? theme.ring_secondary_hex : node.accent_hex);
            halo.material = haloMaterial;
          }

          const interactiveMeshes = [pillar, orb, halo].filter(Boolean);
          const metadata = buildMeshActionMetadata(node, {
            actionKey: node.action_key,
            nodeKey: node.key,
            laneKey: node.laneKey,
            label: node.label,
            labelKey: node.label_key,
            hintLabelKey: "world_hotspot_hint_open",
            intentLabelKey: "world_intent_open",
            intentToneKey: "world_intent_tone_open",
            sourceType: "district_scene_node",
            actorKey: "",
            interactionKind: "open",
            clusterKey: node.key,
            isSecondary: false
          });
          interactiveMeshes.forEach((mesh) => {
            mesh.isPickable = Boolean(node.action_key);
            mesh.metadata = metadata;
          });

          return { node, pillar, orb, halo, angle, isActive };
        });

        scene.hoverCursor = "pointer";
        scene.onPointerMove = (_event, pickInfo) => {
          const metadata = pickInfo?.pickedMesh?.metadata || null;
          const actionKey = String(metadata?.actionKey || "").trim();
          canvas.style.cursor = actionKey ? "pointer" : "default";
          if (!actionKey) {
            hoveredHotspotKey = "";
            hoveredClusterKey = "";
            setHoveredClusterKeyState((prev) => (prev ? "" : prev));
            setHoverPreview((prev) => (prev ? null : prev));
            return;
          }
          const nextHotspotKey =
            String(metadata?.sourceType || "") === "district_scene_hotspot"
              ? String(metadata?.nodeKey || "")
              : String(
                  worldState.hotspots.find((hotspot) => hotspot.action_key === actionKey)?.key ||
                    metadata?.nodeKey ||
                    ""
                );
          hoveredHotspotKey = nextHotspotKey;
          hoveredClusterKey = String(metadata?.clusterKey || "");
          setHoveredClusterKeyState((prev) => {
            const nextClusterKey = String(metadata?.clusterKey || "");
            return prev === nextClusterKey ? prev : nextClusterKey;
          });
          setHoverPreview((prev) => {
            const next = {
              key: String(metadata?.nodeKey || ""),
              label: String(metadata?.label || ""),
              labelKey: String(metadata?.labelKey || ""),
              hintLabelKey: String(metadata?.hintLabelKey || "world_hotspot_hint_open"),
              intentLabelKey: String(metadata?.intentLabelKey || "world_intent_open"),
              intentToneKey: String(metadata?.intentToneKey || "world_intent_tone_open"),
              interactionKind: String(metadata?.interactionKind || "open"),
              sourceType: String(metadata?.sourceType || "district_scene_node")
            };
            if (
              prev &&
              prev.key === next.key &&
              prev.labelKey === next.labelKey &&
              prev.hintLabelKey === next.hintLabelKey &&
              prev.sourceType === next.sourceType
            ) {
              return prev;
            }
            return next;
          });
        };
        scene.onPointerDown = (_event, pickInfo) => {
          const metadata = pickInfo?.pickedMesh?.metadata || null;
          const actionKey = String(metadata?.actionKey || "").trim();
          if (!actionKey) {
            return;
          }
          triggerSceneAction({
            actionKey,
            nodeKey: String(metadata?.nodeKey || ""),
            laneKey: String(metadata?.laneKey || ""),
            label: String(metadata?.label || ""),
            labelKey: String(metadata?.labelKey || ""),
            sourceType: String(metadata?.sourceType || "district_scene_node"),
            actorKey: String(metadata?.actorKey || ""),
            interactionKind: String(metadata?.interactionKind || "open"),
            clusterKey: String(metadata?.clusterKey || ""),
            isSecondary: Boolean(metadata?.isSecondary),
            familyKey: String(metadata?.familyKey || ""),
            flowKey: String(metadata?.flowKey || ""),
            microflowKey: String(metadata?.microflowKey || ""),
            focusKey: String(metadata?.focusKey || ""),
            riskKey: String(metadata?.riskKey || ""),
            riskFocusKey: String(metadata?.riskFocusKey || ""),
            actionContext:
              metadata?.actionContext && typeof metadata.actionContext === "object"
                ? (metadata.actionContext as RiskContext)
                : null,
            riskHealthBandKey: String(metadata?.riskHealthBandKey || ""),
            riskAttentionBandKey: String(metadata?.riskAttentionBandKey || ""),
            riskTrendDirectionKey: String(metadata?.riskTrendDirectionKey || ""),
            actionContextSignature: String(metadata?.actionContextSignature || ""),
            riskContextSignature: String(metadata?.riskContextSignature || ""),
            riskContext:
              metadata?.riskContext && typeof metadata.riskContext === "object"
                ? (metadata.riskContext as RiskContext)
                : null,
            entryKindKey: String(metadata?.entryKindKey || ""),
            sequenceKindKey: String(metadata?.sequenceKindKey || ""),
            workspace: props.workspace,
            tab: props.tab,
            districtKey: worldState.district_key
          });
        };

        const resize = () => engine.resize();
        window.addEventListener("resize", resize);

        engine.runRenderLoop(() => {
          const now = performance.now() * 0.001;
          const podFocus = modalOpenRef.current ? selectedProtocolPodRef.current : null;
          const microflowFocus = modalOpenRef.current ? selectedMicroflowRef.current : null;
          const podMotionScalar = Number.isFinite(Number(podFocus?.motion_scalar)) ? Number(podFocus?.motion_scalar) : 1;
          const podRadiusScale = Number.isFinite(Number(podFocus?.camera_radius_scale)) ? Number(podFocus?.camera_radius_scale) : 1;
          const podFocusYOffset = Number.isFinite(Number(podFocus?.camera_focus_y_offset))
            ? Number(podFocus?.camera_focus_y_offset)
            : 0;
          const microflowMotionScalar = Number.isFinite(Number(microflowFocus?.motion_scalar)) ? Number(microflowFocus?.motion_scalar) : 1;
          const microflowRadiusScale = Number.isFinite(Number(microflowFocus?.camera_radius_scale))
            ? Number(microflowFocus?.camera_radius_scale)
            : 1;
          const microflowFocusYOffset = Number.isFinite(Number(microflowFocus?.camera_focus_y_offset))
            ? Number(microflowFocus?.camera_focus_y_offset)
            : 0;
          const microflowAlphaOffset = Number.isFinite(Number(microflowFocus?.alpha_offset)) ? Number(microflowFocus?.alpha_offset) : 0;
          const microflowBetaOffset = Number.isFinite(Number(microflowFocus?.beta_offset)) ? Number(microflowFocus?.beta_offset) : 0;
          const microflowFocusLerpScalar = Number.isFinite(Number(microflowFocus?.focus_lerp_scalar))
            ? Number(microflowFocus?.focus_lerp_scalar)
            : 1;
          const microflowRadiusLerpScalar = Number.isFinite(Number(microflowFocus?.radius_lerp_scalar))
            ? Number(microflowFocus?.radius_lerp_scalar)
            : 1;
          const microflowOrbitSpinScalar = Number.isFinite(Number(microflowFocus?.orbit_spin_scalar))
            ? Number(microflowFocus?.orbit_spin_scalar)
            : 1;
          const microflowSwayScalar = Number.isFinite(Number(microflowFocus?.sway_scalar))
            ? Number(microflowFocus?.sway_scalar)
            : 1;
          const microflowAlphaLerpScalar = Number.isFinite(Number(microflowFocus?.alpha_lerp_scalar))
            ? Number(microflowFocus?.alpha_lerp_scalar)
            : 1;
          const microflowBetaLerpScalar = Number.isFinite(Number(microflowFocus?.beta_lerp_scalar))
            ? Number(microflowFocus?.beta_lerp_scalar)
            : 1;
          const microflowHudEmphasisScalar = Number.isFinite(Number(microflowFocus?.hud_emphasis_scalar))
            ? Number(microflowFocus?.hud_emphasis_scalar)
            : 1;
          const microflowActorMotionScalar = Number.isFinite(Number(microflowFocus?.actor_motion_scalar))
            ? Number(microflowFocus?.actor_motion_scalar)
            : 1;
          const microflowHotspotMotionScalar = Number.isFinite(Number(microflowFocus?.hotspot_motion_scalar))
            ? Number(microflowFocus?.hotspot_motion_scalar)
            : 1;
          const microflowRingPulseScalar = Number.isFinite(Number(microflowFocus?.ring_pulse_scalar))
            ? Number(microflowFocus?.ring_pulse_scalar)
            : 1;
          const microflowSatelliteOrbitScalar = Number.isFinite(Number(microflowFocus?.satellite_orbit_scalar))
            ? Number(microflowFocus?.satellite_orbit_scalar)
            : 1;
          const microflowCameraDriftScalar = Number.isFinite(Number(microflowFocus?.camera_drift_scalar))
            ? Number(microflowFocus?.camera_drift_scalar)
            : 1;
          const microflowCameraTiltScalar = Number.isFinite(Number(microflowFocus?.camera_tilt_scalar))
            ? Number(microflowFocus?.camera_tilt_scalar)
            : 1;
          const microflowCameraTargetLiftScalar = Number.isFinite(Number(microflowFocus?.camera_target_lift_scalar))
            ? Number(microflowFocus?.camera_target_lift_scalar)
            : 1;
          const microflowCameraOrbitBiasScalar = Number.isFinite(Number(microflowFocus?.camera_orbit_bias_scalar))
            ? Number(microflowFocus?.camera_orbit_bias_scalar)
            : 1;
          const microflowFocusHoldScalar = Number.isFinite(Number(microflowFocus?.focus_hold_scalar))
            ? Number(microflowFocus?.focus_hold_scalar)
            : 1;
          const microflowCameraHeadingOffset = Number.isFinite(Number(microflowFocus?.camera_heading_offset))
            ? Number(microflowFocus?.camera_heading_offset)
            : 0;
          const microflowCameraTargetXOffset = Number.isFinite(Number(microflowFocus?.camera_target_x_offset))
            ? Number(microflowFocus?.camera_target_x_offset)
            : 0;
          const microflowCameraBankScalar = Number.isFinite(Number(microflowFocus?.camera_bank_scalar))
            ? Number(microflowFocus?.camera_bank_scalar)
            : 1;
          const microflowCameraFovScalar = Number.isFinite(Number(microflowFocus?.camera_fov_scalar))
            ? Number(microflowFocus?.camera_fov_scalar)
            : 1;
          const microflowFocusSpreadScalar = Number.isFinite(Number(microflowFocus?.focus_spread_scalar))
            ? Number(microflowFocus?.focus_spread_scalar)
            : 1;
          const microflowLightIntensityScalar = Number.isFinite(Number(microflowFocus?.light_intensity_scalar))
            ? Number(microflowFocus?.light_intensity_scalar)
            : 1;
          const microflowGlowIntensityScalar = Number.isFinite(Number(microflowFocus?.glow_intensity_scalar))
            ? Number(microflowFocus?.glow_intensity_scalar)
            : 1;
          const microflowSurfaceGlowScalar = Number.isFinite(Number(microflowFocus?.surface_glow_scalar))
            ? Number(microflowFocus?.surface_glow_scalar)
            : 1;
          const microflowChromeOpacityScalar = Number.isFinite(Number(microflowFocus?.chrome_opacity_scalar))
            ? Number(microflowFocus?.chrome_opacity_scalar)
            : 1;
          const microflowRiskLightScalar = Number.isFinite(Number(microflowFocus?.risk_light_scalar))
            ? Number(microflowFocus?.risk_light_scalar)
            : 1;
          const microflowRiskGlowScalar = Number.isFinite(Number(microflowFocus?.risk_glow_scalar))
            ? Number(microflowFocus?.risk_glow_scalar)
            : 1;
          const microflowRiskSurfaceGlowScalar = Number.isFinite(Number(microflowFocus?.risk_surface_glow_scalar))
            ? Number(microflowFocus?.risk_surface_glow_scalar)
            : 1;
          const microflowRiskChromeScalar = Number.isFinite(Number(microflowFocus?.risk_chrome_scalar))
            ? Number(microflowFocus?.risk_chrome_scalar)
            : 1;
          const microflowRiskPulseScalar = Number.isFinite(Number(microflowFocus?.risk_pulse_scalar))
            ? Number(microflowFocus?.risk_pulse_scalar)
            : 1;
          const microflowRiskMotionScalar = Number.isFinite(Number(microflowFocus?.risk_motion_scalar))
            ? Number(microflowFocus?.risk_motion_scalar)
            : 1;
          const motionScalar =
            (worldState.reduced_motion ? 0.22 : 1) *
            directorProfile.motion_scalar *
            podMotionScalar *
            microflowMotionScalar *
            microflowRiskMotionScalar;
          const focusHotspot =
            worldState.hotspots.find((hotspot) => hotspot.key === hoveredHotspotKey) || activeHotspot;
          ring.rotation.z =
            now *
            worldState.orbit_speed *
            22 *
            directorProfile.orbit_spin_scalar *
            microflowOrbitSpinScalar *
            microflowRingPulseScalar *
            microflowRiskPulseScalar;
          if (outerRing) {
            outerRing.rotation.y =
              now *
              worldState.orbit_speed *
              14 *
              directorProfile.orbit_spin_scalar *
              microflowOrbitSpinScalar *
              microflowRingPulseScalar *
              microflowRiskPulseScalar;
          }
          coreOrb.position.y =
            1.2 +
            Math.sin(now * 1.4) *
              0.12 *
              motionScalar *
              directorProfile.node_pulse_scalar *
              microflowHudEmphasisScalar *
              microflowRingPulseScalar *
              microflowRiskPulseScalar;
          const orbScale =
            1 +
            worldState.ambient_energy * 0.16 +
            Math.sin(now * 1.7) *
              0.04 *
              motionScalar *
              directorProfile.node_pulse_scalar *
              microflowHudEmphasisScalar *
              microflowRingPulseScalar *
              microflowRiskPulseScalar;
          coreOrb.scaling.setAll(orbScale);
          point.intensity =
            pointBaseIntensity * microflowLightIntensityScalar * microflowRiskLightScalar +
            Math.sin(now) *
              0.08 *
              motionScalar *
              microflowHudEmphasisScalar *
              microflowRingPulseScalar *
              microflowRiskPulseScalar *
              microflowSurfaceGlowScalar *
              microflowRiskSurfaceGlowScalar;
          point.diffuse = pointDiffuseBase.scale(
            Math.max(0.84, microflowLightIntensityScalar * microflowRiskLightScalar)
          );
          hemi.intensity =
            hemiBaseIntensity *
            (0.9 + (microflowChromeOpacityScalar * microflowRiskChromeScalar - 1) * 0.38) *
            (0.96 + microflowLightIntensityScalar * microflowRiskLightScalar * 0.06);
          if (glow) {
            glow.intensity =
              glowBaseIntensity *
              microflowGlowIntensityScalar *
              microflowRiskGlowScalar *
              microflowSurfaceGlowScalar *
              microflowRiskSurfaceGlowScalar;
          }
          camera.fov +=
            (cameraBaseFov * microflowCameraFovScalar - camera.fov) *
            Math.min(0.18, 0.08 * microflowFocusHoldScalar);
          groundMaterial.alpha = Math.min(0.98, 0.84 * microflowChromeOpacityScalar * microflowRiskChromeScalar);
          groundMaterial.emissiveColor = groundEmissiveBase.scale(microflowSurfaceGlowScalar * microflowRiskSurfaceGlowScalar);
          ringMaterial.emissiveColor = ringEmissiveBase.scale(microflowSurfaceGlowScalar * microflowRiskSurfaceGlowScalar);
          coreColumnMaterial.emissiveColor = coreColumnEmissiveBase.scale(
            microflowSurfaceGlowScalar * microflowRiskSurfaceGlowScalar
          );
          coreOrbMaterial.emissiveColor = coreOrbEmissiveBase.scale(
            Math.max(
              microflowSurfaceGlowScalar * microflowRiskSurfaceGlowScalar,
              microflowLightIntensityScalar * microflowRiskLightScalar
            )
          );
          if (outerRing && outerRingMaterial && outerRingEmissiveBase) {
            outerRingMaterial.emissiveColor = outerRingEmissiveBase.scale(
              microflowSurfaceGlowScalar * microflowRiskSurfaceGlowScalar
            );
          }
          const targetAlpha =
            cameraProfile.alpha_base +
            now * worldState.orbit_speed * cameraProfile.orbit_scalar * microflowCameraOrbitBiasScalar +
            Math.sin(now * 0.27) * 0.018 * cameraProfile.sway_scalar * motionScalar * microflowCameraDriftScalar +
            (focusHotspot?.camera_alpha_offset || 0) +
            microflowCameraHeadingOffset +
            microflowAlphaOffset;
          const targetBeta =
            cameraProfile.beta_base +
            Math.sin(now * 0.32) * 0.03 * cameraProfile.sway_scalar * motionScalar * microflowSwayScalar * microflowCameraTiltScalar +
            Math.cos(now * 0.23) * 0.014 * motionScalar * microflowCameraTiltScalar +
            (microflowCameraBankScalar - 1) * 0.028 +
            (focusHotspot?.camera_beta_offset || 0) +
            microflowBetaOffset;
          camera.alpha +=
            (targetAlpha - camera.alpha) *
            cameraProfile.alpha_lerp *
            microflowFocusLerpScalar *
            microflowAlphaLerpScalar *
            microflowFocusHoldScalar;
          camera.beta +=
            (targetBeta - camera.beta) *
            cameraProfile.beta_lerp *
            microflowFocusLerpScalar *
            microflowBetaLerpScalar *
            microflowFocusHoldScalar;
          if (focusHotspot) {
            camera.target.x +=
              (focusHotspot.x + microflowCameraTargetXOffset - camera.target.x) *
              cameraProfile.focus_lerp *
              microflowFocusLerpScalar *
              microflowFocusHoldScalar;
            camera.target.y +=
              (focusHotspot.focus_y * microflowCameraTargetLiftScalar + podFocusYOffset + microflowFocusYOffset - camera.target.y) *
              cameraProfile.focus_lerp *
              microflowFocusLerpScalar *
              microflowFocusHoldScalar;
            camera.target.z +=
              (focusHotspot.z - camera.target.z) *
              cameraProfile.focus_lerp *
              microflowFocusLerpScalar *
              microflowFocusHoldScalar;
            const desiredRadius =
              cameraProfile.radius *
              focusHotspot.camera_radius_scale *
              podRadiusScale *
              microflowRadiusScale *
              microflowCameraOrbitBiasScalar *
              microflowFocusSpreadScalar;
            camera.radius +=
              (desiredRadius - camera.radius) *
              cameraProfile.radius_lerp *
              microflowRadiusLerpScalar *
              microflowFocusHoldScalar;
          }
          satellites.forEach((entry, index) => {
            entry.material.emissiveColor = entry.emissiveBase.scale(
              microflowSurfaceGlowScalar * microflowRiskSurfaceGlowScalar
            );
            const radiusPulse =
              theme.satellite_radius +
              Math.sin(now * (0.8 + index * 0.07)) *
                0.06 *
                motionScalar *
                microflowSatelliteOrbitScalar *
                microflowRiskPulseScalar;
            entry.orb.position.x =
              Math.cos(
                entry.baseAngle +
                  now *
                    worldState.orbit_speed *
                    10 *
                    directorProfile.orbit_spin_scalar *
                    microflowSatelliteOrbitScalar *
                    microflowRiskPulseScalar
              ) * radiusPulse;
            entry.orb.position.z =
              Math.sin(
                entry.baseAngle +
                  now *
                    worldState.orbit_speed *
                    10 *
                    directorProfile.orbit_spin_scalar *
                    microflowSatelliteOrbitScalar *
                    microflowRiskPulseScalar
              ) * radiusPulse;
            entry.orb.position.y =
              theme.satellite_height +
              Math.sin(now * (1 + index * 0.09)) *
                0.06 *
                motionScalar *
                microflowSatelliteOrbitScalar *
                microflowRiskPulseScalar;
          });
          actorHandles.forEach((entry, index) => {
            entry.animate?.(now, motionScalar * microflowActorMotionScalar, index);
          });
          clusterHandles.forEach((entry) => {
            entry.animate(now, motionScalar * microflowHotspotMotionScalar);
          });
          hotspotHandles.forEach((entry) => {
            entry.animate(now, motionScalar * microflowHotspotMotionScalar);
          });
          nodeHandles.forEach((entry, index) => {
            const activePulse = entry.isActive ? 0.16 : 0.04;
            entry.orb.position.y =
              1.15 +
              entry.node.energy * 0.95 +
              Math.sin(now * (1.2 + index * 0.17)) *
                (0.18 + activePulse) *
                motionScalar *
                directorProfile.node_pulse_scalar *
                microflowRingPulseScalar *
                microflowRiskPulseScalar;
            entry.pillar.scaling.y =
              1 +
              entry.node.energy * 0.65 +
              Math.sin(now * (0.8 + index * 0.11)) *
                0.04 *
                motionScalar *
                directorProfile.node_pulse_scalar *
                microflowRingPulseScalar *
                microflowRiskPulseScalar;
            entry.orb.scaling.setAll(
              1 +
                Math.sin(now * (1.4 + index * 0.12)) *
                  activePulse *
                  motionScalar *
                  directorProfile.node_pulse_scalar *
                  microflowRiskPulseScalar +
                (entry.isActive ? 0.12 : 0)
            );
            if (entry.halo) {
              entry.halo.rotation.z =
                now * (0.42 + index * 0.06 + (entry.isActive ? 0.18 : 0)) * motionScalar * directorProfile.cluster_spin_scalar;
            }
          });
          scene.render();
        });

        handle = {
          dispose: () => {
            window.removeEventListener("resize", resize);
            canvas.style.cursor = "default";
            scene.onPointerMove = null;
            scene.onPointerDown = null;
            scene.dispose();
            engine.dispose();
          }
        };
        setStatus("ready");
      } catch {
        if (!disposed) {
          setStatus("failed");
        }
      }
    };

    setStatus("idle");
    void buildScene();

    return () => {
      disposed = true;
      handle?.dispose();
    };
  }, [props.tab, props.workspace, triggerSceneAction, worldSignature, worldState]);

  return (
    <div
      className="akrSceneWorldLayer"
      data-status={status}
      data-district={worldState.district_key}
      data-personality={selectedMicroflow?.personality_key || ""}
      data-personality-band={selectedMicroflow?.personality_band_key || ""}
      data-light-profile={selectedMicroflow?.light_profile_key || ""}
      data-surface-glow={selectedMicroflow?.surface_glow_band_key || ""}
      data-chrome-band={selectedMicroflow?.chrome_band_key || ""}
      data-risk-health-band={selectedMicroflow?.risk_health_band_key || ""}
      data-risk-attention-band={selectedMicroflow?.risk_attention_band_key || ""}
      data-risk-trend-direction={selectedMicroflow?.risk_trend_direction_key || ""}
      data-risk-light-band={selectedMicroflow?.risk_light_band_key || ""}
      data-risk-glow-band={selectedMicroflow?.risk_glow_band_key || ""}
      data-risk-motion-band={selectedMicroflow?.risk_motion_band_key || ""}
      data-composition-profile={selectedMicroflow?.composition_profile_key || ""}
      data-camera-frame={selectedMicroflow?.camera_frame_key || ""}
      data-hud-anchor={selectedMicroflow?.hud_anchor_key || ""}
      data-rail-anchor={selectedMicroflow?.rail_anchor_key || ""}
      data-sheet-anchor={selectedMicroflow?.sheet_anchor_key || ""}
      data-entry-anchor={selectedMicroflow?.entry_anchor_key || ""}
      data-console-anchor={selectedMicroflow?.console_anchor_key || ""}
      data-modal-anchor={selectedMicroflow?.modal_anchor_key || ""}
      data-hud-focus-mode={selectedMicroflow?.hud_focus_mode_key || ""}
      data-rail-presence={selectedMicroflow?.rail_presence_key || ""}
      data-sheet-presence={selectedMicroflow?.sheet_presence_key || ""}
      data-entry-presence={selectedMicroflow?.entry_presence_key || ""}
      data-console-presence={selectedMicroflow?.console_presence_key || ""}
      data-modal-presence={selectedMicroflow?.modal_presence_key || ""}
      data-hud-layout={selectedMicroflow?.hud_layout_key || worldState.hud_profile.hud_profile_key}
      data-hud-emphasis={selectedMicroflow?.hud_emphasis_band_key || ""}
      data-hud-density={selectedMicroflow?.hud_density_profile_key || ""}
      data-rail-layout={selectedMicroflow?.rail_layout_key || worldState.rail_profile.rail_layout_key}
      data-modal-layout={selectedMicroflow?.modal_layout_key || ""}
      data-console-layout={selectedMicroflow?.console_layout_key || ""}
      style={
        {
          "--akr-scene-chrome-opacity": String(selectedMicroflow?.chrome_opacity_scalar || 1),
          "--akr-scene-hud-width-scale": String(selectedMicroflow?.hud_width_scalar || 1),
          "--akr-scene-rail-width-scale": String(selectedMicroflow?.rail_width_scalar || 1),
          "--akr-scene-sheet-width-scale": String(selectedMicroflow?.sheet_width_scalar || 1),
          "--akr-scene-entry-width-scale": String(selectedMicroflow?.entry_width_scalar || 1),
          "--akr-scene-console-width-scale": String(selectedMicroflow?.console_width_scalar || 1),
          "--akr-scene-modal-width-scale": String(selectedMicroflow?.modal_width_scalar || 1),
          "--akr-scene-surface-gap-scale": String(selectedMicroflow?.surface_gap_scalar || 1),
          "--akr-scene-surface-stack-scale": String(selectedMicroflow?.surface_stack_scalar || 1)
        } as React.CSSProperties
      }
    >
      <canvas
        ref={canvasRef}
        className="akrSceneWorldCanvas"
        aria-label={`${t(props.lang, "world_scene_title")} ${t(props.lang, worldState.district_label_key as never)}`}
      />
      <div
        className="akrSceneWorldHud akrGlass"
        data-tone={selectedMicroflow?.personality_band_key || ""}
        data-light-profile={selectedMicroflow?.light_profile_key || ""}
        data-surface-glow={selectedMicroflow?.surface_glow_band_key || ""}
        data-chrome-band={selectedMicroflow?.chrome_band_key || ""}
        data-risk-health-band={selectedMicroflow?.risk_health_band_key || ""}
        data-risk-attention-band={selectedMicroflow?.risk_attention_band_key || ""}
        data-risk-trend-direction={selectedMicroflow?.risk_trend_direction_key || ""}
        data-risk-light-band={selectedMicroflow?.risk_light_band_key || ""}
        data-risk-glow-band={selectedMicroflow?.risk_glow_band_key || ""}
        data-risk-motion-band={selectedMicroflow?.risk_motion_band_key || ""}
        data-composition-profile={selectedMicroflow?.composition_profile_key || ""}
        data-hud-anchor={selectedMicroflow?.hud_anchor_key || ""}
        data-hud-focus-mode={selectedMicroflow?.hud_focus_mode_key || ""}
        data-hud-layout={selectedMicroflow?.hud_layout_key || worldState.hud_profile.hud_profile_key}
        data-hud-emphasis={selectedMicroflow?.hud_emphasis_band_key || ""}
        data-hud-density={selectedMicroflow?.hud_density_profile_key || ""}
      >
        <strong>{t(props.lang, worldState.district_label_key as never)}</strong>
        <span>{t(props.lang, worldState.mode_label_key as never)}</span>
        {worldState.hud_profile.show_density_chip ? (
          <span>{t(props.lang, worldState.hud_profile.density_label_key as never)}</span>
        ) : null}
        <span>{t(props.lang, worldState.director_profile.pace_label_key as never)}</span>
        <span>{t(props.lang, worldState.hud_profile.tone_label_key as never)}</span>
        <span>{props.workspace === "admin" ? "OPS" : props.tab.toUpperCase()}</span>
        <span>
          {worldState.beacon_count} / {worldState.hot_nodes + worldState.warn_nodes}
        </span>
        {worldState.hud_profile.show_caption ? (
          <span>{t(props.lang, worldState.hud_profile.caption_label_key as never)}</span>
        ) : null}
        {worldState.active_hotspot_label ? (
          <span className="akrSceneWorldFocus">
            {hoverPreview?.labelKey
              ? t(props.lang, hoverPreview.labelKey as never)
              : hoverPreview?.label || (worldState.active_hotspot_label_key
                  ? t(props.lang, worldState.active_hotspot_label_key as never)
                  : worldState.active_hotspot_label)}
          </span>
        ) : null}
        {worldState.active_hotspot_hint_key || hoverPreview?.hintLabelKey ? (
          <span className="akrSceneWorldFocus">
            {t(props.lang, (hoverPreview?.hintLabelKey || worldState.active_hotspot_hint_key) as never)}
          </span>
        ) : null}
        {worldState.active_hotspot_intent_label_key || hoverPreview?.intentLabelKey ? (
          <span className="akrSceneWorldFocus">
            {t(props.lang, (hoverPreview?.intentLabelKey || worldState.active_hotspot_intent_label_key) as never)}
          </span>
        ) : null}
        {worldState.active_hotspot_intent_tone_key || hoverPreview?.intentToneKey ? (
          <span className="akrSceneWorldFocus">
            {t(props.lang, (hoverPreview?.intentToneKey || worldState.active_hotspot_intent_tone_key) as never)}
          </span>
        ) : null}
        {modalOpen && selectedProtocolPod?.entry_kind_key ? (
          <span className="akrSceneWorldFocus">{t(props.lang, selectedProtocolPod.entry_kind_key as never)}</span>
        ) : null}
        {modalOpen && selectedProtocolPod?.tempo_label_key ? (
          <span className="akrSceneWorldFocus">{t(props.lang, selectedProtocolPod.tempo_label_key as never)}</span>
        ) : null}
        {modalOpen && selectedMicroflow?.sequence_kind_key ? (
          <span className="akrSceneWorldFocus">{t(props.lang, selectedMicroflow.sequence_kind_key as never)}</span>
        ) : null}
        {modalOpen && selectedMicroflow?.personality_label_key ? (
          <span className={`akrSceneWorldFocus isPersonality is-${selectedMicroflow.personality_band_key || "glide"}`}>
            {t(props.lang, selectedMicroflow.personality_label_key as never)}
          </span>
        ) : null}
        {modalOpen && selectedMicroflow?.tempo_label_key ? (
          <span className="akrSceneWorldFocus">{t(props.lang, selectedMicroflow.tempo_label_key as never)}</span>
        ) : null}
        {modalOpen && selectedMicroflow?.density_label_key ? (
          <span className="akrSceneWorldFocus">{t(props.lang, selectedMicroflow.density_label_key as never)}</span>
        ) : null}
        {modalOpen && selectedMicroflow?.personality_caption_key ? (
          <span className={`akrSceneWorldFocus isCaption is-${selectedMicroflow.personality_band_key || "glide"}`}>
            {t(props.lang, selectedMicroflow.personality_caption_key as never)}
          </span>
        ) : null}
        {worldState.hud_profile.show_node_label && worldState.active_node_label ? (
          <span className="akrSceneWorldFocus">
            {worldState.active_node_label_key ? t(props.lang, worldState.active_node_label_key as never) : worldState.active_node_label}
          </span>
        ) : null}
      </div>
      {focusedClusterActions.length ? (
        <div
          className={`akrSceneWorldRail akrGlass is-${worldState.rail_profile.rail_profile_key} is-${worldState.rail_profile.rail_layout_key}`}
          data-rail-layout={selectedMicroflow?.rail_layout_key || worldState.rail_profile.rail_layout_key}
          data-emphasis={selectedMicroflow?.hud_emphasis_band_key || ""}
          data-light-profile={selectedMicroflow?.light_profile_key || ""}
          data-surface-glow={selectedMicroflow?.surface_glow_band_key || ""}
          data-chrome-band={selectedMicroflow?.chrome_band_key || ""}
          data-risk-health-band={selectedMicroflow?.risk_health_band_key || ""}
          data-risk-attention-band={selectedMicroflow?.risk_attention_band_key || ""}
          data-risk-trend-direction={selectedMicroflow?.risk_trend_direction_key || ""}
          data-risk-light-band={selectedMicroflow?.risk_light_band_key || ""}
          data-risk-glow-band={selectedMicroflow?.risk_glow_band_key || ""}
          data-risk-motion-band={selectedMicroflow?.risk_motion_band_key || ""}
          data-composition-profile={selectedMicroflow?.composition_profile_key || ""}
          data-rail-anchor={selectedMicroflow?.rail_anchor_key || ""}
          data-rail-presence={selectedMicroflow?.rail_presence_key || ""}
        >
          <div className="akrSceneWorldRailHeader">
            <strong>
              {t(props.lang, worldState.rail_profile.rail_label_key as never)}
            </strong>
            <span>
              {focusedCluster?.hotspot_count} {t(props.lang, "world_interaction_routes" as never)}
            </span>
          </div>
          {worldState.rail_profile.show_caption ? (
            <div className="akrSceneWorldRailCaption">
              <span>{t(props.lang, worldState.rail_profile.rail_caption_key as never)}</span>
              {focusedCluster?.label_key ? <strong>{t(props.lang, focusedCluster.label_key as never)}</strong> : null}
            </div>
          ) : null}
          <div className="akrSceneWorldRailActions">
            {focusedClusterActions.map((action) => {
              const actionContractReady = hasSceneActionContract(action, focusedCluster);
              return (
                <button
                  key={action.key}
                  type="button"
                  className={`akrSceneWorldAction ${action.is_secondary ? "isSecondary" : "isPrimary"} is-${
                    action.intent_profile?.rail_class_key || action.intent_profile_key || "open_primary"
                  } ${actionContractReady ? "is-contract-ready" : "is-contract-missing"}`}
                  {...buildSceneActionDataAttrs(action, focusedCluster)}
                  onClick={() =>
                    actionContractReady
                      ? triggerSceneAction({
                          actionKey: action.action_key,
                          nodeKey: action.key,
                          laneKey: focusedCluster?.cluster_key || "",
                          label: action.label,
                          labelKey: action.label_key,
                          sourceType: "district_scene_cluster_action",
                          actorKey: action.actor_key,
                          interactionKind: action.interaction_kind,
                          clusterKey: action.cluster_key,
                          isSecondary: action.is_secondary,
                          ...resolveSceneActionContext(action),
                          workspace: props.workspace,
                          tab: props.tab,
                          districtKey: worldState.district_key
                        })
                      : undefined
                  }
                  disabled={!actionContractReady}
                >
                  <span className="akrSceneWorldActionMeta">
                    {t(props.lang, (action.is_secondary ? "world_interaction_secondary" : "world_interaction_primary") as never)}
                  </span>
                  <strong>{action.label_key ? t(props.lang, action.label_key as never) : action.label}</strong>
                  <span>{t(props.lang, (action.intent_profile?.intent_label_key || "world_intent_open") as never)}</span>
                  <span>{t(props.lang, (action.intent_profile?.intent_tone_key || "world_intent_tone_open") as never)}</span>
                  <span>{t(props.lang, action.hint_label_key as never)}</span>
                  {renderSceneActionContextMeta(action, focusedCluster)}
                  {renderSceneActionContextChips(action, focusedCluster)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {worldState.interaction_sheet?.rows?.length ? (
        <div
          className={`akrSceneWorldSheet akrGlass is-${worldState.interaction_sheet.variant_key}`}
          data-sheet-layout={selectedMicroflow?.rail_layout_key || ""}
          data-emphasis={selectedMicroflow?.hud_emphasis_band_key || ""}
          data-light-profile={selectedMicroflow?.light_profile_key || ""}
          data-surface-glow={selectedMicroflow?.surface_glow_band_key || ""}
          data-chrome-band={selectedMicroflow?.chrome_band_key || ""}
          data-risk-health-band={selectedMicroflow?.risk_health_band_key || ""}
          data-risk-attention-band={selectedMicroflow?.risk_attention_band_key || ""}
          data-risk-trend-direction={selectedMicroflow?.risk_trend_direction_key || ""}
          data-risk-light-band={selectedMicroflow?.risk_light_band_key || ""}
          data-risk-glow-band={selectedMicroflow?.risk_glow_band_key || ""}
          data-risk-motion-band={selectedMicroflow?.risk_motion_band_key || ""}
          data-composition-profile={selectedMicroflow?.composition_profile_key || ""}
          data-sheet-anchor={selectedMicroflow?.sheet_anchor_key || ""}
          data-sheet-presence={selectedMicroflow?.sheet_presence_key || ""}
          {...buildSceneActionDataAttrs(worldState.interaction_sheet)}
        >
          <div className="akrSceneWorldSheetHeader">
            <strong>
              {worldState.interaction_sheet.title_key
                ? t(props.lang, worldState.interaction_sheet.title_key as never)
                : worldState.interaction_sheet.title}
            </strong>
            {worldState.interaction_sheet.intent_label_key ? (
              <span>{t(props.lang, worldState.interaction_sheet.intent_label_key as never)}</span>
            ) : null}
          </div>
          {worldState.interaction_sheet.intent_tone_key ? (
            <div className="akrSceneWorldSheetTone">
              <span>{t(props.lang, worldState.interaction_sheet.intent_tone_key as never)}</span>
              {worldState.interaction_sheet.cluster_label_key ? (
                <strong>{t(props.lang, worldState.interaction_sheet.cluster_label_key as never)}</strong>
              ) : worldState.interaction_sheet.cluster_label ? (
                <strong>{worldState.interaction_sheet.cluster_label}</strong>
              ) : null}
            </div>
          ) : null}
          {worldState.interaction_sheet.focus_key || worldState.interaction_sheet.risk_focus_key ? (
            <div className="akrSceneWorldSheetContext">
              {worldState.interaction_sheet.focus_key ? <small>{worldState.interaction_sheet.focus_key}</small> : null}
              {worldState.interaction_sheet.risk_focus_key ? (
                <small>{worldState.interaction_sheet.risk_focus_key}</small>
              ) : null}
            </div>
          ) : null}
          {renderSceneActionContextMeta(worldState.interaction_sheet)}
          {renderSceneActionContextChips(worldState.interaction_sheet)}
          <div className="akrSceneWorldSheetRows">
            {worldState.interaction_sheet.rows.map((row: { label_key: string; value: string }) => (
              <div key={`${worldState.interaction_sheet.sheet_key}:${row.label_key}`} className="akrSceneWorldSheetRow">
                <span>{t(props.lang, row.label_key as never)}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {worldState.interaction_surface?.action_items?.length ? (
        <div
          className={`akrSceneEntrySurface akrGlass is-${worldState.interaction_surface.surface_class_key}`}
          data-surface-layout={selectedMicroflow?.modal_layout_key || ""}
          data-emphasis={selectedMicroflow?.hud_emphasis_band_key || ""}
          data-light-profile={selectedMicroflow?.light_profile_key || ""}
          data-surface-glow={selectedMicroflow?.surface_glow_band_key || ""}
          data-chrome-band={selectedMicroflow?.chrome_band_key || ""}
          data-risk-health-band={selectedMicroflow?.risk_health_band_key || ""}
          data-risk-attention-band={selectedMicroflow?.risk_attention_band_key || ""}
          data-risk-trend-direction={selectedMicroflow?.risk_trend_direction_key || ""}
          data-risk-light-band={selectedMicroflow?.risk_light_band_key || ""}
          data-risk-glow-band={selectedMicroflow?.risk_glow_band_key || ""}
          data-risk-motion-band={selectedMicroflow?.risk_motion_band_key || ""}
          data-composition-profile={selectedMicroflow?.composition_profile_key || ""}
          data-entry-anchor={selectedMicroflow?.entry_anchor_key || ""}
          data-entry-presence={selectedMicroflow?.entry_presence_key || ""}
          {...buildSceneActionDataAttrs(worldState.interaction_surface)}
        >
          <div className="akrSceneEntrySurfaceHeader">
            <span>{t(props.lang, worldState.interaction_surface.surface_kind_key as never)}</span>
            {worldState.interaction_surface.intent_label_key ? (
              <strong>{t(props.lang, worldState.interaction_surface.intent_label_key as never)}</strong>
            ) : null}
          </div>
          <div className="akrSceneEntrySurfaceTitle">
            <strong>
              {worldState.interaction_surface.title_key
                ? t(props.lang, worldState.interaction_surface.title_key as never)
                : worldState.interaction_surface.title}
            </strong>
            {worldState.interaction_surface.cluster_label_key ? (
              <span>{t(props.lang, worldState.interaction_surface.cluster_label_key as never)}</span>
            ) : worldState.interaction_surface.cluster_label ? (
              <span>{worldState.interaction_surface.cluster_label}</span>
            ) : null}
          </div>
          <div className="akrSceneEntrySurfaceStatus">
            <div className="akrSceneEntrySurfaceStatusRow">
              <span>{t(props.lang, worldState.interaction_surface.hero_label_key as never)}</span>
              <strong>{worldState.interaction_surface.hero_value}</strong>
            </div>
            {worldState.interaction_surface.support_label_key && worldState.interaction_surface.support_value ? (
              <div className="akrSceneEntrySurfaceStatusRow">
                <span>{t(props.lang, worldState.interaction_surface.support_label_key as never)}</span>
                <strong>{worldState.interaction_surface.support_value}</strong>
              </div>
            ) : null}
          </div>
          <div className="akrSceneEntrySurfaceMeta">
            {worldState.interaction_surface.intent_tone_key ? (
              <span>{t(props.lang, worldState.interaction_surface.intent_tone_key as never)}</span>
            ) : null}
            {worldState.interaction_surface.hint_label_key ? (
              <strong>{t(props.lang, worldState.interaction_surface.hint_label_key as never)}</strong>
            ) : null}
          </div>
          {worldState.interaction_surface.focus_key || worldState.interaction_surface.risk_focus_key ? (
            <div className="akrSceneEntrySurfaceContext">
              {worldState.interaction_surface.focus_key ? (
                <small>{worldState.interaction_surface.focus_key}</small>
              ) : null}
              {worldState.interaction_surface.risk_focus_key ? (
                <small>{worldState.interaction_surface.risk_focus_key}</small>
              ) : null}
            </div>
          ) : null}
          {renderSceneActionContextMeta(worldState.interaction_surface)}
          {renderSceneActionContextChips(worldState.interaction_surface)}
          {worldState.interaction_entry ? (
            <div
              className={`akrSceneEntrySurfaceMode is-${worldState.interaction_entry.entry_class_key} is-${worldState.interaction_entry.status_key}`}
              {...buildSceneActionDataAttrs(worldState.interaction_entry)}
            >
              <div className="akrSceneEntrySurfaceModeHeader">
                <span>{t(props.lang, worldState.interaction_entry.entry_kind_key as never)}</span>
                <strong>{t(props.lang, worldState.interaction_entry.status_label_key as never)}</strong>
              </div>
              {worldState.interaction_entry.focus_key || worldState.interaction_entry.risk_focus_key ? (
                <div className="akrSceneEntrySurfaceModeContext">
                  {worldState.interaction_entry.focus_key ? (
                    <small>{worldState.interaction_entry.focus_key}</small>
                  ) : null}
                  {worldState.interaction_entry.risk_focus_key ? (
                    <small>{worldState.interaction_entry.risk_focus_key}</small>
                  ) : null}
                </div>
              ) : null}
              {renderSceneActionContextMeta(worldState.interaction_entry)}
              {renderSceneActionContextChips(worldState.interaction_entry)}
              <div className="akrSceneEntrySurfaceModeRows">
                {worldState.interaction_entry.preview_rows.map((row: { label_key: string; value: string; status_key: string }) => (
                  <div key={`${worldState.interaction_entry.entry_key}:${row.label_key}`} className={`akrSceneEntrySurfaceModeRow is-${row.status_key}`}>
                    <span>{t(props.lang, row.label_key as never)}</span>
                    <strong>{row.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {worldState.interaction_terminal ? (
            <div className="akrSceneEntrySurfaceConsoleBar">
              <button
                type="button"
                className={`akrSceneEntrySurfaceConsoleToggle ${
                  hasSceneActionContract(worldState.interaction_terminal) ? "is-contract-ready" : "is-contract-missing"
                } ${terminalOpen ? "isOpen" : ""}`}
                {...buildSceneActionDataAttrs(worldState.interaction_terminal)}
                onClick={() =>
                  hasSceneActionContract(worldState.interaction_terminal) ? setTerminalOpen((current) => !current) : undefined
                }
                disabled={!hasSceneActionContract(worldState.interaction_terminal)}
              >
                <span>{t(props.lang, terminalOpen ? ("world_terminal_close" as never) : ("world_terminal_open" as never))}</span>
                <strong>{t(props.lang, worldState.interaction_terminal.terminal_kind_key as never)}</strong>
              </button>
              {worldState.interaction_modal ? (
                <button
                  type="button"
                  className={`akrSceneEntrySurfaceConsoleToggle isAccent ${
                    hasSceneActionContract(worldState.interaction_modal) ? "is-contract-ready" : "is-contract-missing"
                  } ${modalOpen ? "isOpen" : ""}`}
                  {...buildSceneActionDataAttrs(worldState.interaction_modal)}
                  onClick={() =>
                    hasSceneActionContract(worldState.interaction_modal) ? setModalOpen((current) => !current) : undefined
                  }
                  disabled={!hasSceneActionContract(worldState.interaction_modal)}
                >
                  <span>{t(props.lang, modalOpen ? ("world_modal_close" as never) : ("world_modal_open" as never))}</span>
                  <strong>{t(props.lang, worldState.interaction_modal.modal_kind_key as never)}</strong>
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="akrSceneEntrySurfaceActions">
            {worldState.interaction_surface.action_items.map((action: ClusterActionItem) => {
              const actionContractReady = hasSceneActionContract(action);
              return (
                <button
                  key={action.surface_slot_key}
                  type="button"
                  className={`akrSceneEntrySurfaceAction ${action.is_primary_surface_action ? "isPrimary" : "isSecondary"} is-${
                    action.intent_profile_key || "open"
                  } ${actionContractReady ? "is-contract-ready" : "is-contract-missing"}`}
                  {...buildSceneActionDataAttrs(action)}
                  onClick={() =>
                    actionContractReady
                      ? triggerSceneAction({
                          actionKey: action.action_key,
                          nodeKey: action.key,
                          laneKey: action.cluster_key,
                          label: action.label,
                          labelKey: action.label_key,
                          sourceType: "district_scene_entry_surface",
                          actorKey: action.actor_key,
                          interactionKind: action.interaction_kind,
                          clusterKey: action.cluster_key,
                          isSecondary: action.is_secondary,
                          ...resolveSceneActionContext(action),
                          workspace: props.workspace,
                          tab: props.tab,
                          districtKey: worldState.district_key
                        })
                      : undefined
                  }
                  disabled={!actionContractReady}
                >
                  <span>{t(props.lang, (action.intent_profile?.intent_label_key || "world_intent_open") as never)}</span>
                  <strong>{action.label_key ? t(props.lang, action.label_key as never) : action.label}</strong>
                  {renderSceneActionContextMeta(action)}
                  {renderSceneActionContextChips(action)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {terminalOpen && worldState.interaction_terminal ? (
        <div
          className={`akrSceneTerminalConsole akrGlass is-${worldState.interaction_terminal.terminal_class_key}`}
          data-console-layout={selectedMicroflow?.console_layout_key || ""}
          data-emphasis={selectedMicroflow?.hud_emphasis_band_key || ""}
          data-light-profile={selectedMicroflow?.light_profile_key || ""}
          data-surface-glow={selectedMicroflow?.surface_glow_band_key || ""}
          data-chrome-band={selectedMicroflow?.chrome_band_key || ""}
          data-risk-health-band={selectedMicroflow?.risk_health_band_key || ""}
          data-risk-attention-band={selectedMicroflow?.risk_attention_band_key || ""}
          data-risk-trend-direction={selectedMicroflow?.risk_trend_direction_key || ""}
          data-risk-light-band={selectedMicroflow?.risk_light_band_key || ""}
          data-risk-glow-band={selectedMicroflow?.risk_glow_band_key || ""}
          data-risk-motion-band={selectedMicroflow?.risk_motion_band_key || ""}
          data-composition-profile={selectedMicroflow?.composition_profile_key || ""}
          data-console-anchor={selectedMicroflow?.console_anchor_key || ""}
          data-console-presence={selectedMicroflow?.console_presence_key || ""}
          {...buildSceneActionDataAttrs(worldState.interaction_terminal)}
        >
          <div className="akrSceneTerminalConsoleHeader">
            <div className="akrSceneTerminalConsoleTitle">
              <span>{t(props.lang, worldState.interaction_terminal.terminal_kind_key as never)}</span>
              <strong>
                {worldState.interaction_terminal.terminal_title_key
                  ? t(props.lang, worldState.interaction_terminal.terminal_title_key as never)
                  : worldState.interaction_terminal.terminal_title}
              </strong>
            </div>
            <button type="button" className="akrSceneTerminalConsoleClose" onClick={() => setTerminalOpen(false)}>
              {t(props.lang, "world_terminal_close" as never)}
            </button>
          </div>
          <div className="akrSceneTerminalConsoleMeta">
            <span>{t(props.lang, worldState.interaction_terminal.status_label_key as never)}</span>
            {worldState.interaction_terminal.cluster_label_key ? (
              <strong>{t(props.lang, worldState.interaction_terminal.cluster_label_key as never)}</strong>
            ) : worldState.interaction_terminal.cluster_label ? (
              <strong>{worldState.interaction_terminal.cluster_label}</strong>
            ) : null}
            {worldState.interaction_terminal.intent_label_key ? (
              <span>{t(props.lang, worldState.interaction_terminal.intent_label_key as never)}</span>
            ) : null}
            {worldState.interaction_terminal.intent_tone_key ? (
              <span>{t(props.lang, worldState.interaction_terminal.intent_tone_key as never)}</span>
            ) : null}
          </div>
          {renderSceneActionContextMeta(worldState.interaction_terminal)}
          {renderSceneActionContextChips(worldState.interaction_terminal)}
          {worldState.interaction_terminal.focus_key || worldState.interaction_terminal.risk_focus_key ? (
            <div className="akrSceneTerminalConsoleContext">
              {worldState.interaction_terminal.focus_key ? (
                <strong>{worldState.interaction_terminal.focus_key}</strong>
              ) : null}
              {worldState.interaction_terminal.risk_focus_key ? (
                <small>{worldState.interaction_terminal.risk_focus_key}</small>
              ) : null}
            </div>
          ) : null}
          <div className="akrSceneTerminalConsoleGrid">
            <section className="akrSceneTerminalConsoleSection">
              <div className="akrSceneTerminalConsoleSectionHeader">
                <span>{t(props.lang, "world_terminal_section_signals" as never)}</span>
                <strong>{worldState.interaction_terminal.action_count}</strong>
              </div>
              <div className="akrSceneTerminalConsoleRows">
                {worldState.interaction_terminal.signal_rows.map((row: { label_key: string; value: string; status_key: string }) => (
                  <div key={`${worldState.interaction_terminal.terminal_key}:signal:${row.label_key}`} className={`akrSceneTerminalConsoleRow is-${row.status_key}`}>
                    <span>{t(props.lang, row.label_key as never)}</span>
                    <strong>{row.value}</strong>
                  </div>
                ))}
              </div>
            </section>
            <section className="akrSceneTerminalConsoleSection">
              <div className="akrSceneTerminalConsoleSectionHeader">
                <span>{t(props.lang, "world_terminal_section_preview" as never)}</span>
                <strong>{t(props.lang, worldState.interaction_terminal.status_label_key as never)}</strong>
              </div>
              <div className="akrSceneTerminalConsoleRows">
                {worldState.interaction_terminal.preview_rows.map((row: { label_key: string; value: string; status_key: string }) => (
                  <div key={`${worldState.interaction_terminal.terminal_key}:preview:${row.label_key}`} className={`akrSceneTerminalConsoleRow is-${row.status_key}`}>
                    <span>{t(props.lang, row.label_key as never)}</span>
                    <strong>{row.value}</strong>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <div className="akrSceneTerminalConsoleFlow">
            <div className="akrSceneTerminalConsoleSectionHeader">
              <span>{t(props.lang, "world_terminal_section_flow" as never)}</span>
              <strong>{t(props.lang, worldState.interaction_terminal.stage_value_key as never)}</strong>
            </div>
            <div className="akrSceneTerminalConsoleChips">
              <div className={`akrSceneTerminalConsoleChip is-${worldState.interaction_terminal.status_key}`}>
                <span>{t(props.lang, worldState.interaction_terminal.stage_label_key as never)}</span>
                <strong>{t(props.lang, worldState.interaction_terminal.stage_value_key as never)}</strong>
              </div>
              <div className={`akrSceneTerminalConsoleChip is-${worldState.interaction_terminal.status_key}`}>
                <span>{t(props.lang, worldState.interaction_terminal.readiness_label_key as never)}</span>
                <strong>{t(props.lang, worldState.interaction_terminal.readiness_value_key as never)}</strong>
              </div>
              <div className="akrSceneTerminalConsoleChip is-tempo">
                <span>{t(props.lang, worldState.interaction_terminal.tempo_label_key as never)}</span>
                <strong>{worldState.interaction_terminal.tempo_value}</strong>
              </div>
            </div>
            <div className="akrSceneTerminalConsoleRows">
              {worldState.interaction_terminal.flow_rows.map((row: { label_key: string; value: string; status_key: string }) => (
                <div key={`${worldState.interaction_terminal.terminal_key}:flow:${row.label_key}`} className={`akrSceneTerminalConsoleRow is-${row.status_key}`}>
                  <span>{t(props.lang, row.label_key as never)}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
          </div>
          <div className="akrSceneTerminalConsoleActions">
            <div className="akrSceneTerminalConsoleSectionHeader">
              <span>{t(props.lang, "world_terminal_section_actions" as never)}</span>
              {worldState.interaction_terminal.hint_label_key ? (
                <strong>{t(props.lang, worldState.interaction_terminal.hint_label_key as never)}</strong>
              ) : null}
            </div>
            <div className="akrSceneTerminalConsoleActionGrid">
              {worldState.interaction_terminal.action_items.map((action: ClusterActionItem) => {
                const actionContractReady = hasSceneActionContract(action);
                return (
                  <button
                    key={`${worldState.interaction_terminal.terminal_key}:${action.surface_slot_key || action.key}`}
                    type="button"
                    className={`akrSceneTerminalConsoleAction ${
                      action.is_primary_surface_action ? "isPrimary" : "isSecondary"
                    } is-${action.intent_profile_key || "open"} ${actionContractReady ? "is-contract-ready" : "is-contract-missing"}`}
                    {...buildSceneActionDataAttrs(action)}
                    onClick={() =>
                      actionContractReady
                        ? triggerSceneAction({
                            actionKey: action.action_key,
                            nodeKey: action.key,
                            laneKey: action.cluster_key,
                            label: action.label,
                            labelKey: action.label_key,
                            sourceType: "district_scene_terminal_console",
                            actorKey: action.actor_key,
                            interactionKind: action.interaction_kind,
                            clusterKey: action.cluster_key,
                            isSecondary: action.is_secondary,
                            ...resolveSceneActionContext(action),
                            workspace: props.workspace,
                            tab: props.tab,
                            districtKey: worldState.district_key
                          })
                        : undefined
                    }
                    disabled={!actionContractReady}
                  >
                    <span>{t(props.lang, (action.intent_profile?.intent_label_key || "world_intent_open") as never)}</span>
                    <strong>{action.label_key ? t(props.lang, action.label_key as never) : action.label}</strong>
                    <span>{t(props.lang, action.hint_label_key as never)}</span>
                    {renderSceneActionContextMeta(action)}
                    {renderSceneActionContextChips(action)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
      {modalOpen && worldState.interaction_modal ? (
        <div
          className={`akrSceneInteractionModal akrGlass is-${worldState.interaction_modal.modal_class_key}`}
          data-modal-layout={selectedMicroflow?.modal_layout_key || ""}
          data-emphasis={selectedMicroflow?.hud_emphasis_band_key || ""}
          data-light-profile={selectedMicroflow?.light_profile_key || ""}
          data-surface-glow={selectedMicroflow?.surface_glow_band_key || ""}
          data-chrome-band={selectedMicroflow?.chrome_band_key || ""}
          data-risk-health-band={selectedMicroflow?.risk_health_band_key || ""}
          data-risk-attention-band={selectedMicroflow?.risk_attention_band_key || ""}
          data-risk-trend-direction={selectedMicroflow?.risk_trend_direction_key || ""}
          data-risk-light-band={selectedMicroflow?.risk_light_band_key || ""}
          data-risk-glow-band={selectedMicroflow?.risk_glow_band_key || ""}
          data-risk-motion-band={selectedMicroflow?.risk_motion_band_key || ""}
          data-composition-profile={selectedMicroflow?.composition_profile_key || ""}
          data-modal-anchor={selectedMicroflow?.modal_anchor_key || ""}
          data-modal-presence={selectedMicroflow?.modal_presence_key || ""}
          {...buildSceneActionDataAttrs(worldState.interaction_modal)}
        >
          <div className="akrSceneInteractionModalHeader">
            <div className="akrSceneInteractionModalTitle">
              <span>{t(props.lang, worldState.interaction_modal.modal_kind_key as never)}</span>
              <strong>
                {worldState.interaction_modal.title_key
                  ? t(props.lang, worldState.interaction_modal.title_key as never)
                  : worldState.interaction_modal.title}
              </strong>
            </div>
            <button type="button" className="akrSceneInteractionModalClose" onClick={() => setModalOpen(false)}>
              {t(props.lang, "world_modal_close" as never)}
            </button>
          </div>
          <div className="akrSceneInteractionModalMeta">
            <strong>{t(props.lang, worldState.interaction_modal.status_label_key as never)}</strong>
            {worldState.interaction_modal.intent_label_key ? (
              <span>{t(props.lang, worldState.interaction_modal.intent_label_key as never)}</span>
            ) : null}
            {worldState.interaction_modal.intent_tone_key ? (
              <span>{t(props.lang, worldState.interaction_modal.intent_tone_key as never)}</span>
            ) : null}
            {worldState.interaction_modal.hint_label_key ? (
              <span>{t(props.lang, worldState.interaction_modal.hint_label_key as never)}</span>
            ) : null}
          </div>
          {worldState.interaction_modal.focus_key || worldState.interaction_modal.risk_focus_key ? (
            <div className="akrSceneInteractionModalContext">
              {worldState.interaction_modal.focus_key ? (
                <strong>{worldState.interaction_modal.focus_key}</strong>
              ) : null}
              {worldState.interaction_modal.risk_focus_key ? (
                <small>{worldState.interaction_modal.risk_focus_key}</small>
              ) : null}
            </div>
          ) : null}
          {renderSceneActionContextMeta(worldState.interaction_modal)}
          {renderSceneActionContextChips(worldState.interaction_modal)}
          <div className="akrSceneInteractionModalGrid">
            <section className="akrSceneInteractionModalSection">
              <div className="akrSceneInteractionModalSectionHeader">
                <span>{t(props.lang, "world_modal_section_preview" as never)}</span>
                <strong>{t(props.lang, worldState.interaction_modal.status_label_key as never)}</strong>
              </div>
              <div className="akrSceneInteractionModalRows">
                {worldState.interaction_modal.preview_rows.map((row: { label_key: string; value: string; status_key: string }) => (
                  <div key={`${worldState.interaction_modal.modal_key}:preview:${row.label_key}`} className={`akrSceneInteractionModalRow is-${row.status_key}`}>
                    <span>{t(props.lang, row.label_key as never)}</span>
                    <strong>{row.value}</strong>
                  </div>
                ))}
              </div>
            </section>
            <section className="akrSceneInteractionModalSection">
              <div className="akrSceneInteractionModalSectionHeader">
                <span>{t(props.lang, "world_modal_section_protocol" as never)}</span>
                <strong>{worldState.interaction_modal.action_count}</strong>
              </div>
              <div className="akrSceneInteractionModalRows">
                {worldState.interaction_modal.signal_rows.map((row: { label_key: string; value: string; status_key: string }) => (
                  <div key={`${worldState.interaction_modal.modal_key}:signal:${row.label_key}`} className={`akrSceneInteractionModalRow is-${row.status_key}`}>
                    <span>{t(props.lang, row.label_key as never)}</span>
                    <strong>{row.value}</strong>
                  </div>
                ))}
              </div>
            </section>
          </div>
          {worldState.interaction_modal.modal_cards?.length ? (
            <div className="akrSceneInteractionModalLanes">
              <div className="akrSceneInteractionModalSectionHeader">
                <span>{t(props.lang, "world_modal_section_lanes" as never)}</span>
                <strong>{worldState.interaction_modal.modal_cards.length}</strong>
              </div>
              <div className="akrSceneInteractionModalLaneGrid">
                {worldState.interaction_modal.modal_cards.map((card: InteractionModalLaneCard) => {
                  const laneContractReady = hasSceneActionContract(card);
                  const laneInteractive = Boolean(
                    laneContractReady && (card.protocol_card_key || card.protocol_pod_key || card.microflow_key)
                  );
                  return (
                    <button
                      key={`${worldState.interaction_modal.modal_key}:${card.card_key}`}
                      type="button"
                      className={`akrSceneInteractionModalLane is-${card.status_key} ${
                        selectedModalLane?.card_key === card.card_key ? "is-selected" : ""
                      } ${laneInteractive ? "is-actionable" : "is-passive"} ${
                        laneContractReady ? "is-contract-ready" : "is-contract-missing"
                      }`}
                      {...buildSceneActionDataAttrs(card)}
                      onMouseEnter={() => (laneInteractive ? activateModalLane(card) : undefined)}
                      onFocus={() => (laneInteractive ? activateModalLane(card) : undefined)}
                      onClick={() => (laneInteractive ? activateModalLane(card) : undefined)}
                      disabled={!laneInteractive}
                      aria-pressed={selectedModalLane?.card_key === card.card_key}
                    >
                      <span>{t(props.lang, card.label_key as never)}</span>
                      <strong>{card.value}</strong>
                      {card.tone_key ? <em>{t(props.lang, card.tone_key as never)}</em> : null}
                      {card.action_label_key ? <b>{t(props.lang, card.action_label_key as never)}</b> : null}
                      {selectedModalLane?.card_key === card.card_key && card.risk_focus_key ? (
                        <small>{card.risk_focus_key}</small>
                      ) : null}
                      {renderSceneActionContextChips(card)}
                      {selectedModalLane?.card_key === card.card_key ? renderPrimaryActionSummary(card, { compact: true }) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {worldState.interaction_modal.protocol_cards?.length ? (
            <div className="akrSceneInteractionModalDecks">
              <div className="akrSceneInteractionModalSectionHeader">
                <span>{t(props.lang, "world_modal_section_protocol_decks" as never)}</span>
                <strong>{worldState.interaction_modal.protocol_cards.length}</strong>
              </div>
              <div className="akrSceneInteractionModalDeckGrid">
                {worldState.interaction_modal.protocol_cards.map((card: ProtocolCard) => {
                  const cardContractReady = hasSceneActionContract(card);
                  return (
                    <button
                      key={`${worldState.interaction_modal.modal_key}:${card.card_key}`}
                      type="button"
                      className={`akrSceneInteractionModalDeck is-${card.status_key} ${
                        card.is_actionable ? "is-actionable" : "is-passive"
                      } ${selectedProtocolCard?.card_key === card.card_key ? "is-selected" : ""} ${
                        cardContractReady ? "is-contract-ready" : "is-contract-missing"
                      }`}
                      {...buildSceneActionDataAttrs(card)}
                      onMouseEnter={() => setActiveProtocolCardKey(card.card_key)}
                      onFocus={() => setActiveProtocolCardKey(card.card_key)}
                      onClick={() => {
                        setActiveProtocolCardKey(card.card_key);
                        if (card.action_key && cardContractReady) {
                          triggerSceneAction({
                            actionKey: card.action_key,
                            nodeKey: card.card_key,
                            laneKey: "modal_protocol_deck",
                            label: card.value,
                            labelKey: card.label_key,
                            sourceType: "district_scene_protocol_deck",
                            actorKey: worldState.active_hotspot_key,
                            interactionKind: "protocol",
                            clusterKey: worldState.active_cluster_key,
                            ...resolveSceneActionContext(card),
                            workspace: props.workspace,
                            tab: props.tab,
                            districtKey: worldState.district_key
                          });
                        }
                      }}
                      aria-pressed={selectedProtocolCard?.card_key === card.card_key}
                    >
                      <span>{t(props.lang, card.label_key as never)}</span>
                      <strong>{card.value}</strong>
                      {card.tone_key ? <em>{t(props.lang, card.tone_key as never)}</em> : null}
                      {card.action_label_key ? <b>{t(props.lang, card.action_label_key as never)}</b> : null}
                      {renderSceneActionContextMeta(card)}
                      {renderSceneActionContextChips(card)}
                      {selectedProtocolCard?.card_key === card.card_key ? renderPrimaryActionSummary(card, { compact: true }) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {selectedProtocolCard ? (
            <div
              className="akrSceneInteractionModalProtocolDetail"
              {...buildSceneActionDataAttrs(selectedProtocolCard)}
            >
              <div className="akrSceneInteractionModalSectionHeader">
                <span>{t(props.lang, "world_modal_section_protocol_focus" as never)}</span>
                <strong>{selectedProtocolCard.status_label_key ? t(props.lang, selectedProtocolCard.status_label_key as never) : selectedProtocolCard.value}</strong>
              </div>
              {renderSceneActionContextMeta(selectedProtocolCard)}
              {renderSceneActionContextChips(selectedProtocolCard)}
              {renderPrimaryActionSummary(selectedProtocolCard)}
              <div className="akrSceneInteractionModalChips">
                <div className={`akrSceneInteractionModalChip is-${selectedProtocolCard.status_key}`}>
                  <span>{t(props.lang, selectedProtocolCard.label_key as never)}</span>
                  <strong>{selectedProtocolCard.value}</strong>
                </div>
                {selectedProtocolCard.tone_key ? (
                  <div className={`akrSceneInteractionModalChip is-${selectedProtocolCard.status_key}`}>
                    <span>{t(props.lang, "world_modal_section_protocol" as never)}</span>
                    <strong>{t(props.lang, selectedProtocolCard.tone_key as never)}</strong>
                  </div>
                ) : null}
                {selectedProtocolCard.family_key ? (
                  <div className={`akrSceneInteractionModalChip is-${selectedProtocolCard.status_key}`}>
                    <span>Family</span>
                    <strong>{selectedProtocolCard.family_key}</strong>
                  </div>
                ) : null}
                {selectedProtocolCard.microflow_key ? (
                  <div className={`akrSceneInteractionModalChip is-${selectedProtocolCard.status_key}`}>
                    <span>Micro</span>
                    <strong>{selectedProtocolCard.microflow_key}</strong>
                  </div>
                ) : null}
                {selectedProtocolCard.focus_key ? (
                  <div className={`akrSceneInteractionModalChip is-${selectedProtocolCard.status_key}`}>
                    <span>Focus</span>
                    <strong>{selectedProtocolCard.focus_key}</strong>
                  </div>
                ) : null}
                {selectedProtocolCard.risk_focus_key ? (
                  <div className={`akrSceneInteractionModalChip is-${selectedProtocolCard.status_key}`}>
                    <span>RFK</span>
                    <strong>{selectedProtocolCard.risk_focus_key}</strong>
                  </div>
                ) : null}
                {selectedProtocolCard.action_items?.length ? (
                  <div className="akrSceneInteractionModalChip is-tempo">
                    <span>{t(props.lang, "world_modal_section_actions" as never)}</span>
                    <strong>{selectedProtocolCard.action_items.length}</strong>
                  </div>
                ) : null}
              </div>
              <div className="akrSceneInteractionModalGrid">
                {selectedProtocolCard.preview_rows?.length ? (
                  <section className="akrSceneInteractionModalSection">
                    <div className="akrSceneInteractionModalSectionHeader">
                      <span>{t(props.lang, "world_modal_section_preview" as never)}</span>
                      <strong>{t(props.lang, selectedProtocolCard.label_key as never)}</strong>
                    </div>
                    <div className="akrSceneInteractionModalRows">
                      {selectedProtocolCard.preview_rows.map((row) => (
                        <div key={`${selectedProtocolCard.card_key}:preview:${row.label_key}`} className={`akrSceneInteractionModalRow is-${row.status_key}`}>
                          <span>{t(props.lang, row.label_key as never)}</span>
                          <strong>{row.value}</strong>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
                {selectedProtocolCard.signal_rows?.length ? (
                  <section className="akrSceneInteractionModalSection">
                    <div className="akrSceneInteractionModalSectionHeader">
                      <span>{t(props.lang, "world_modal_section_signals" as never)}</span>
                      <strong>{selectedProtocolCard.signal_rows.length}</strong>
                    </div>
                    <div className="akrSceneInteractionModalRows">
                      {selectedProtocolCard.signal_rows.map((row) => (
                        <div key={`${selectedProtocolCard.card_key}:signal:${row.label_key}`} className={`akrSceneInteractionModalRow is-${row.status_key}`}>
                          <span>{t(props.lang, row.label_key as never)}</span>
                          <strong>{row.value}</strong>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
                {selectedProtocolCard.flow_rows?.length ? (
                  <section className="akrSceneInteractionModalSection">
                    <div className="akrSceneInteractionModalSectionHeader">
                      <span>{t(props.lang, "world_modal_section_flow" as never)}</span>
                      <strong>{selectedProtocolCard.status_label_key ? t(props.lang, selectedProtocolCard.status_label_key as never) : selectedProtocolCard.value}</strong>
                    </div>
                    <div className="akrSceneInteractionModalRows">
                      {selectedProtocolCard.flow_rows.map((row) => (
                        <div key={`${selectedProtocolCard.card_key}:flow:${row.label_key}`} className={`akrSceneInteractionModalRow is-${row.status_key}`}>
                          <span>{t(props.lang, row.label_key as never)}</span>
                          <strong>{row.value}</strong>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
                {selectedProtocolCard.track_rows?.length ? (
                  <section className="akrSceneInteractionModalSection">
                    <div className="akrSceneInteractionModalSectionHeader">
                      <span>{t(props.lang, "world_modal_section_tracks" as never)}</span>
                      <strong>{selectedProtocolCard.track_rows.length}</strong>
                    </div>
                    <div className="akrSceneInteractionModalRows">
                      {selectedProtocolCard.track_rows.map((row) => (
                        <div key={`${selectedProtocolCard.card_key}:track:${row.label_key}`} className={`akrSceneInteractionModalRow is-${row.status_key}`}>
                          <span>{t(props.lang, row.label_key as never)}</span>
                          <strong>{row.value}</strong>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
                {selectedProtocolCard.flow_pods?.length ? (
                  <section className="akrSceneInteractionModalSection">
                    <div className="akrSceneInteractionModalSectionHeader">
                      <span>{t(props.lang, "world_modal_section_pods" as never)}</span>
                      <strong>{selectedProtocolCard.flow_pods.length}</strong>
                    </div>
                    <div className="akrSceneInteractionModalPodGrid">
                      {selectedProtocolCard.flow_pods.map((pod) => {
                        const podContractReady = hasSceneActionContract(pod, selectedProtocolCard);
                        return (
                          <button
                            key={`${selectedProtocolCard.card_key}:pod:${pod.pod_key}`}
                            type="button"
                            className={`akrSceneInteractionModalPod is-${pod.status_key} ${
                              selectedProtocolPod?.pod_key === pod.pod_key ? "is-selected" : ""
                            } ${podContractReady ? "is-contract-ready" : "is-contract-missing"}`}
                            {...buildSceneActionDataAttrs(pod, selectedProtocolCard)}
                            onMouseEnter={() => (podContractReady ? setActiveProtocolPodKey(pod.pod_key) : undefined)}
                            onFocus={() => (podContractReady ? setActiveProtocolPodKey(pod.pod_key) : undefined)}
                            onClick={() => (podContractReady ? setActiveProtocolPodKey(pod.pod_key) : undefined)}
                            disabled={!podContractReady}
                            aria-pressed={selectedProtocolPod?.pod_key === pod.pod_key}
                          >
                            <div className="akrSceneInteractionModalPodHeader">
                              <span>{t(props.lang, pod.label_key as never)}</span>
                              <strong>{pod.value}</strong>
                            </div>
                            {pod.tone_key ? <em>{t(props.lang, pod.tone_key as never)}</em> : null}
                            {pod.hint_label_key ? <b>{t(props.lang, pod.hint_label_key as never)}</b> : null}
                            {renderSceneActionContextMeta(pod, selectedProtocolCard)}
                            {renderSceneActionContextChips(pod, selectedProtocolCard)}
                            <div className="akrSceneInteractionModalPodMeta">
                              <span>{pod.status_label_key ? t(props.lang, pod.status_label_key as never) : pod.value}</span>
                              <strong>{pod.action_items?.length || 0}</strong>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ) : null}
                {selectedProtocolPod ? (
                  <section
                    className="akrSceneInteractionModalSection"
                    {...buildSceneActionDataAttrs(selectedProtocolPod, selectedProtocolCard)}
                  >
                    <div className="akrSceneInteractionModalSectionHeader">
                      <span>{t(props.lang, "world_modal_section_pod_focus" as never)}</span>
                      <strong>{selectedProtocolPod.status_label_key ? t(props.lang, selectedProtocolPod.status_label_key as never) : selectedProtocolPod.value}</strong>
                    </div>
                    {renderSceneActionContextMeta(selectedProtocolPod, selectedProtocolCard)}
                    {renderSceneActionContextChips(selectedProtocolPod, selectedProtocolCard)}
                    {renderPrimaryActionSummary(selectedProtocolPod, { fallback: selectedProtocolCard })}
                    <div className="akrSceneInteractionModalChips">
                      <div className={`akrSceneInteractionModalChip is-${selectedProtocolPod.status_key}`}>
                        <span>{t(props.lang, selectedProtocolPod.label_key as never)}</span>
                        <strong>{selectedProtocolPod.value}</strong>
                      </div>
                      {selectedProtocolPod.tone_key ? (
                        <div className={`akrSceneInteractionModalChip is-${selectedProtocolPod.status_key}`}>
                          <span>{t(props.lang, "world_modal_section_pods" as never)}</span>
                          <strong>{t(props.lang, selectedProtocolPod.tone_key as never)}</strong>
                        </div>
                      ) : null}
                      {selectedProtocolPod.family_key ? (
                        <div className={`akrSceneInteractionModalChip is-${selectedProtocolPod.status_key}`}>
                          <span>Family</span>
                          <strong>{selectedProtocolPod.family_key}</strong>
                        </div>
                      ) : null}
                      {selectedProtocolPod.microflow_key ? (
                        <div className={`akrSceneInteractionModalChip is-${selectedProtocolPod.status_key}`}>
                          <span>Micro</span>
                          <strong>{selectedProtocolPod.microflow_key}</strong>
                        </div>
                      ) : null}
                      {selectedProtocolPod.entry_kind_key ? (
                        <div className={`akrSceneInteractionModalChip is-${selectedProtocolPod.status_key}`}>
                          <span>{t(props.lang, "world_modal_chip_entry_kind" as never)}</span>
                          <strong>{t(props.lang, selectedProtocolPod.entry_kind_key as never)}</strong>
                        </div>
                      ) : null}
                      {selectedProtocolPod.sequence_kind_key ? (
                        <div className={`akrSceneInteractionModalChip is-${selectedProtocolPod.status_key}`}>
                          <span>{t(props.lang, "world_modal_chip_sequence_kind" as never)}</span>
                          <strong>{t(props.lang, selectedProtocolPod.sequence_kind_key as never)}</strong>
                        </div>
                      ) : null}
                      {selectedProtocolPod.tempo_label_key ? (
                        <div className="akrSceneInteractionModalChip is-tempo">
                          <span>{t(props.lang, "world_modal_chip_tempo" as never)}</span>
                          <strong>{t(props.lang, selectedProtocolPod.tempo_label_key as never)}</strong>
                        </div>
                      ) : null}
                      {selectedProtocolPod.camera_profile_label_key ? (
                        <div className="akrSceneInteractionModalChip is-tempo">
                          <span>{t(props.lang, "world_modal_chip_camera" as never)}</span>
                          <strong>{t(props.lang, selectedProtocolPod.camera_profile_label_key as never)}</strong>
                        </div>
                      ) : null}
                      {selectedProtocolPod.action_items?.length ? (
                        <div className="akrSceneInteractionModalChip is-tempo">
                          <span>{t(props.lang, "world_modal_section_actions" as never)}</span>
                          <strong>{selectedProtocolPod.action_items.length}</strong>
                        </div>
                      ) : null}
                      {selectedProtocolPod.focus_key ? (
                        <div className={`akrSceneInteractionModalChip is-${selectedProtocolPod.status_key}`}>
                          <span>Focus</span>
                          <strong>{selectedProtocolPod.focus_key}</strong>
                        </div>
                      ) : null}
                      {selectedProtocolPod.risk_focus_key ? (
                        <div className={`akrSceneInteractionModalChip is-${selectedProtocolPod.status_key}`}>
                          <span>RFK</span>
                          <strong>{selectedProtocolPod.risk_focus_key}</strong>
                        </div>
                      ) : null}
                    </div>
                    <div className="akrSceneInteractionModalGrid">
                      {selectedProtocolPod.sequence_rows?.length ? (
                        <section className="akrSceneInteractionModalSection">
                          <div className="akrSceneInteractionModalSectionHeader">
                            <span>{t(props.lang, "world_modal_section_sequence" as never)}</span>
                            <strong>
                              {selectedProtocolPod.sequence_kind_key
                                ? t(props.lang, selectedProtocolPod.sequence_kind_key as never)
                                : selectedProtocolPod.stage_value || selectedProtocolPod.value}
                            </strong>
                          </div>
                          <div className="akrSceneInteractionModalRows">
                            {selectedProtocolPod.sequence_rows.map((row) => (
                              <div key={`${selectedProtocolPod.pod_key}:sequence:${row.label_key}`} className={`akrSceneInteractionModalRow is-${row.status_key}`}>
                                <span>{t(props.lang, row.label_key as never)}</span>
                                <strong>{row.value}</strong>
                              </div>
                            ))}
                          </div>
                        </section>
                      ) : null}
                      {selectedProtocolPod.microflow_cards?.length ? (
                        <section className="akrSceneInteractionModalSection">
                          <div className="akrSceneInteractionModalSectionHeader">
                            <span>{t(props.lang, "world_modal_section_microflows" as never)}</span>
                            <strong>{selectedProtocolPod.microflow_cards.length}</strong>
                          </div>
                          <div className="akrSceneInteractionModalMicroGrid">
                            {selectedProtocolPod.microflow_cards.map((item) => {
                              const microflowContractReady = hasSceneActionContract(item, selectedProtocolPod);
                              return (
                                <button
                                  key={`${selectedProtocolPod.pod_key}:microflow:${item.microflow_key}`}
                                  type="button"
                                  className={`akrSceneInteractionModalMicroflow is-${item.status_key} ${
                                    selectedMicroflow?.microflow_key === item.microflow_key ? "is-selected" : ""
                                  } ${microflowContractReady ? "is-contract-ready" : "is-contract-missing"}`}
                                  {...buildSceneActionDataAttrs(item, selectedProtocolPod)}
                                  onMouseEnter={() => (microflowContractReady ? setActiveMicroflowKey(item.microflow_key) : undefined)}
                                  onFocus={() => (microflowContractReady ? setActiveMicroflowKey(item.microflow_key) : undefined)}
                                  onClick={() => (microflowContractReady ? setActiveMicroflowKey(item.microflow_key) : undefined)}
                                  disabled={!microflowContractReady}
                                  aria-pressed={selectedMicroflow?.microflow_key === item.microflow_key}
                                >
                                  <div className="akrSceneInteractionModalMicroflowHeader">
                                    <span>{t(props.lang, item.label_key as never)}</span>
                                    <strong>{item.value}</strong>
                                  </div>
                                  {item.tone_key ? <em>{t(props.lang, item.tone_key as never)}</em> : null}
                                  {item.rows?.length ? (
                                    <div className="akrSceneInteractionModalRows">
                                      {item.rows.slice(0, 2).map((row) => (
                                        <div key={`${item.microflow_key}:${row.label_key}`} className={`akrSceneInteractionModalRow is-${row.status_key}`}>
                                          <span>{t(props.lang, row.label_key as never)}</span>
                                          <strong>{row.value}</strong>
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                  {item.action_label_key ? <b>{t(props.lang, item.action_label_key as never)}</b> : null}
                                  {renderSceneActionContextMeta(item, selectedProtocolPod)}
                                  {renderSceneActionContextChips(item, selectedProtocolPod)}
                                  {selectedMicroflow?.microflow_key === item.microflow_key
                                    ? renderPrimaryActionSummary(item, { compact: true, fallback: selectedProtocolPod })
                                    : null}
                                </button>
                              );
                            })}
                          </div>
                        </section>
                      ) : null}
                      {selectedMicroflow ? (
                        <section
                          className="akrSceneInteractionModalSection"
                          {...buildSceneActionDataAttrs(selectedMicroflow, selectedProtocolPod)}
                        >
                          <div className="akrSceneInteractionModalSectionHeader">
                            <span>{t(props.lang, "world_modal_section_microflow_focus" as never)}</span>
                            <strong>
                              {selectedMicroflow.sequence_kind_key
                                ? t(props.lang, selectedMicroflow.sequence_kind_key as never)
                                : selectedMicroflow.stage_value || selectedMicroflow.value}
                            </strong>
                          </div>
                          {renderSceneActionContextMeta(selectedMicroflow, selectedProtocolPod)}
                          {renderSceneActionContextChips(selectedMicroflow, selectedProtocolPod)}
                          {renderPrimaryActionSummary(selectedMicroflow, { fallback: selectedProtocolPod })}
                          <div className="akrSceneInteractionModalChips">
                            {selectedMicroflow.entry_kind_key ? (
                              <div className={`akrSceneInteractionModalChip is-${selectedMicroflow.status_key}`}>
                                <span>{t(props.lang, "world_modal_chip_entry_kind" as never)}</span>
                                <strong>{t(props.lang, selectedMicroflow.entry_kind_key as never)}</strong>
                              </div>
                            ) : null}
                            {selectedMicroflow.tempo_label_key ? (
                              <div className="akrSceneInteractionModalChip is-tempo">
                                <span>{t(props.lang, "world_modal_chip_tempo" as never)}</span>
                                <strong>{t(props.lang, selectedMicroflow.tempo_label_key as never)}</strong>
                              </div>
                            ) : null}
                            {selectedMicroflow.camera_profile_label_key ? (
                              <div className="akrSceneInteractionModalChip is-tempo">
                                <span>{t(props.lang, "world_modal_chip_camera" as never)}</span>
                                <strong>{t(props.lang, selectedMicroflow.camera_profile_label_key as never)}</strong>
                              </div>
                            ) : null}
                            {selectedMicroflow.director_pace_label_key ? (
                              <div className="akrSceneInteractionModalChip is-tempo">
                                <span>{t(props.lang, "world_modal_chip_director" as never)}</span>
                                <strong>{t(props.lang, selectedMicroflow.director_pace_label_key as never)}</strong>
                              </div>
                            ) : null}
                            {selectedMicroflow.hud_tone_label_key ? (
                              <div className="akrSceneInteractionModalChip is-tempo">
                                <span>{t(props.lang, "world_modal_chip_hud" as never)}</span>
                                <strong>{t(props.lang, selectedMicroflow.hud_tone_label_key as never)}</strong>
                              </div>
                            ) : null}
                            {selectedMicroflow.personality_label_key ? (
                              <div className={`akrSceneInteractionModalChip is-personality is-${selectedMicroflow.personality_band_key || "glide"}`}>
                                <span>{t(props.lang, "world_modal_chip_personality" as never)}</span>
                                <strong>{t(props.lang, selectedMicroflow.personality_label_key as never)}</strong>
                              </div>
                            ) : null}
                            {selectedMicroflow.density_label_key ? (
                              <div className="akrSceneInteractionModalChip is-tempo">
                                <span>{t(props.lang, "world_modal_chip_density" as never)}</span>
                                <strong>{t(props.lang, selectedMicroflow.density_label_key as never)}</strong>
                              </div>
                            ) : null}
                            {selectedMicroflow.loop_status_label_key ? (
                              <div className={`akrSceneInteractionModalChip is-${selectedMicroflow.loop_status_key || selectedMicroflow.status_key}`}>
                                <span>{t(props.lang, "world_flow_readiness_label" as never)}</span>
                                <strong>{t(props.lang, selectedMicroflow.loop_status_label_key as never)}</strong>
                              </div>
                            ) : null}
                            {selectedMicroflow.loop_stage_value ? (
                              <div className={`akrSceneInteractionModalChip is-${selectedMicroflow.loop_status_key || selectedMicroflow.status_key}`}>
                                <span>{t(props.lang, "world_flow_stage_label" as never)}</span>
                                <strong>{selectedMicroflow.loop_stage_value}</strong>
                              </div>
                            ) : null}
                            {selectedMicroflow.focus_key ? (
                              <div className={`akrSceneInteractionModalChip is-${selectedMicroflow.loop_status_key || selectedMicroflow.status_key}`}>
                                <span>Focus</span>
                                <strong>{selectedMicroflow.focus_key}</strong>
                              </div>
                            ) : null}
                            {selectedMicroflow.risk_key ? (
                              <div className={`akrSceneInteractionModalChip is-${selectedMicroflow.loop_status_key || selectedMicroflow.status_key}`}>
                                <span>Risk</span>
                                <strong>{selectedMicroflow.risk_key}</strong>
                              </div>
                            ) : null}
                            {selectedMicroflow.risk_focus_key ? (
                              <div className={`akrSceneInteractionModalChip is-${selectedMicroflow.loop_status_key || selectedMicroflow.status_key}`}>
                                <span>RFK</span>
                                <strong>{selectedMicroflow.risk_focus_key}</strong>
                              </div>
                            ) : null}
                          </div>
                          <div className="akrSceneInteractionModalGrid">
                            {selectedMicroflow.loop_rows?.length ? (
                              <section className="akrSceneInteractionModalSection">
                                <div className="akrSceneInteractionModalSectionHeader">
                                  <span>{t(props.lang, "world_modal_section_live_loop" as never)}</span>
                                  <strong>{selectedMicroflow.loop_rows.length}</strong>
                                </div>
                                <div className="akrSceneInteractionModalRows">
                                  {selectedMicroflow.loop_rows.map((row) => (
                                    <div key={`${selectedMicroflow.microflow_key}:loop:${row.label_key}`} className={`akrSceneInteractionModalRow is-${row.status_key}`}>
                                      <span>{t(props.lang, row.label_key as never)}</span>
                                      <strong>{row.value}</strong>
                                    </div>
                                  ))}
                                </div>
                                {selectedMicroflow.loop_signal_rows?.length ? (
                                  <div className="akrSceneInteractionModalRows">
                                    {selectedMicroflow.loop_signal_rows.map((row) => (
                                      <div key={`${selectedMicroflow.microflow_key}:loop-signal:${row.label_key}`} className={`akrSceneInteractionModalRow is-${row.status_key}`}>
                                        <span>{t(props.lang, row.label_key as never)}</span>
                                        <strong>{row.value}</strong>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </section>
                            ) : null}
                            {selectedMicroflow.sequence_cards?.length ? (
                              <section className="akrSceneInteractionModalSection">
                                <div className="akrSceneInteractionModalSectionHeader">
                                  <span>{t(props.lang, "world_modal_section_microflow_sequence" as never)}</span>
                                  <strong>{selectedMicroflow.sequence_cards.length}</strong>
                                </div>
                                <div className="akrSceneInteractionModalFocusCards">
                                  {selectedMicroflow.sequence_cards.map((card) => (
                                    <div key={`${selectedMicroflow.microflow_key}:card:${card.card_key}`} className={`akrSceneInteractionModalFocusCard is-${card.status_key}`}>
                                      <span>{t(props.lang, card.label_key as never)}</span>
                                      <strong>{card.value_key ? t(props.lang, card.value_key as never) : card.value}</strong>
                                    </div>
                                  ))}
                                </div>
                              </section>
                            ) : null}
                            {selectedMicroflow.sequence_rows?.length ? (
                              <div className="akrSceneInteractionModalRows">
                                {selectedMicroflow.sequence_rows.map((row) => (
                                  <div key={`${selectedMicroflow.microflow_key}:sequence:${row.label_key}`} className={`akrSceneInteractionModalRow is-${row.status_key}`}>
                                    <span>{t(props.lang, row.label_key as never)}</span>
                                    <strong>{row.value}</strong>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            {selectedMicroflow.rows?.length ? (
                              <div className="akrSceneInteractionModalRows">
                                {selectedMicroflow.rows.map((row) => (
                                  <div key={`${selectedMicroflow.microflow_key}:row:${row.label_key}`} className={`akrSceneInteractionModalRow is-${row.status_key}`}>
                                    <span>{t(props.lang, row.label_key as never)}</span>
                                    <strong>{row.value}</strong>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            {selectedMicroflow.risk_focus_key ? (
                              <div className="akrSceneInteractionModalRows">
                                <div
                                  key={`${selectedMicroflow.microflow_key}:risk-focus`}
                                  className={`akrSceneInteractionModalRow is-${selectedMicroflow.loop_status_key || selectedMicroflow.status_key}`}
                                >
                                  <span>Risk focus</span>
                                  <strong>{selectedMicroflow.risk_focus_key}</strong>
                                </div>
                              </div>
                            ) : null}
                          </div>
                          {selectedMicroflow.action_key ? (
                            <div className="akrSceneInteractionModalActionGrid">
                              <button
                                type="button"
                                className={`akrSceneInteractionModalAction ${
                                  hasSceneActionContract(selectedMicroflow) ? "is-contract-ready" : "is-contract-missing"
                                }`}
                                {...buildSceneActionDataAttrs(selectedMicroflow)}
                                onClick={() =>
                                  hasSceneActionContract(selectedMicroflow)
                                    ? triggerSceneAction({
                                        actionKey: selectedMicroflow.action_key || "",
                                        nodeKey: selectedMicroflow.microflow_key,
                                        laneKey: "modal_protocol_microflow_focus",
                                        label: selectedMicroflow.value || selectedProtocolPod.value,
                                        labelKey: selectedMicroflow.label_key,
                                        ...resolveSceneActionContext(selectedMicroflow),
                                        sourceType: "district_scene_protocol_microflow_focus",
                                        actorKey: worldState.active_hotspot_key,
                                        interactionKind: "protocol_microflow_focus",
                                        clusterKey: worldState.active_cluster_key,
                                        workspace: props.workspace,
                                        tab: props.tab,
                                        districtKey: worldState.district_key
                                      })
                                    : undefined
                                }
                                disabled={!hasSceneActionContract(selectedMicroflow)}
                              >
                                <span>
                                  {selectedMicroflow.hint_label_key
                                    ? t(props.lang, selectedMicroflow.hint_label_key as never)
                                    : t(props.lang, selectedMicroflow.label_key as never)}
                                </span>
                                <strong>
                                  {selectedMicroflow.action_label_key
                                    ? t(props.lang, selectedMicroflow.action_label_key as never)
                                    : t(props.lang, selectedMicroflow.label_key as never)}
                                </strong>
                                {renderSceneActionContextMeta(selectedMicroflow)}
                                {renderSceneActionContextChips(selectedMicroflow)}
                              </button>
                            </div>
                          ) : null}
                        </section>
                      ) : null}
                      {selectedProtocolPod.rows?.length ? (
                        <div className="akrSceneInteractionModalRows">
                          {selectedProtocolPod.rows.map((row) => (
                            <div key={`${selectedProtocolPod.pod_key}:row:${row.label_key}`} className={`akrSceneInteractionModalRow is-${row.status_key}`}>
                              <span>{t(props.lang, row.label_key as never)}</span>
                              <strong>{row.value}</strong>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {selectedProtocolPod.signal_rows?.length ? (
                        <div className="akrSceneInteractionModalRows">
                          {selectedProtocolPod.signal_rows.map((row) => (
                            <div key={`${selectedProtocolPod.pod_key}:signal:${row.label_key}`} className={`akrSceneInteractionModalRow is-${row.status_key}`}>
                              <span>{t(props.lang, row.label_key as never)}</span>
                              <strong>{row.value}</strong>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {selectedProtocolPod.flow_rows?.length ? (
                        <div className="akrSceneInteractionModalRows">
                          {selectedProtocolPod.flow_rows.map((row) => (
                            <div key={`${selectedProtocolPod.pod_key}:flow:${row.label_key}`} className={`akrSceneInteractionModalRow is-${row.status_key}`}>
                              <span>{t(props.lang, row.label_key as never)}</span>
                              <strong>{row.value}</strong>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {selectedProtocolPod.action_items?.length ? (
                      <div className="akrSceneInteractionModalActionGrid">
                        {selectedProtocolPod.action_items.map((action) => {
                          const actionContractReady = hasSceneActionContract(action, selectedProtocolPod);
                          return (
                            <button
                              key={`${selectedProtocolPod.pod_key}:${action.item_key}`}
                              type="button"
                              className={`akrSceneInteractionModalAction ${action.intent_profile_key ? `is-${action.intent_profile_key}` : ""} ${
                                actionContractReady ? "is-contract-ready" : "is-contract-missing"
                              }`}
                              {...buildSceneActionDataAttrs(action, selectedProtocolPod)}
                              onClick={() =>
                                actionContractReady
                                  ? triggerSceneAction({
                                      actionKey: action.action_key,
                                      nodeKey: selectedProtocolPod.pod_key,
                                      laneKey: "modal_protocol_pod_focus",
                                      label: selectedProtocolPod.value,
                                      labelKey: selectedProtocolPod.label_key,
                                      sourceType: "district_scene_protocol_pod_focus",
                                      actorKey: worldState.active_hotspot_key,
                                      interactionKind: "protocol_pod_focus",
                                      clusterKey: worldState.active_cluster_key,
                                      ...resolveSceneActionContext(action, selectedProtocolPod),
                                      workspace: props.workspace,
                                      tab: props.tab,
                                      districtKey: worldState.district_key
                                    })
                                  : undefined
                              }
                              disabled={!actionContractReady}
                            >
                              <span>{action.hint_label_key ? t(props.lang, action.hint_label_key as never) : t(props.lang, selectedProtocolPod.label_key as never)}</span>
                              <strong>{t(props.lang, action.label_key as never)}</strong>
                              {action.tone_key ? <span>{t(props.lang, action.tone_key as never)}</span> : null}
                              {renderSceneActionContextMeta(action, selectedProtocolPod)}
                              {renderSceneActionContextChips(action, selectedProtocolPod)}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </section>
                ) : null}
              </div>
              {selectedProtocolCard.action_items?.length ? (
                <div className="akrSceneInteractionModalActions">
                  <div className="akrSceneInteractionModalSectionHeader">
                    <span>{t(props.lang, "world_modal_section_actions" as never)}</span>
                    <strong>{selectedProtocolCard.action_items.length}</strong>
                  </div>
                  <div className="akrSceneInteractionModalActionGrid">
                    {selectedProtocolCard.action_items.map((action) => {
                      const actionContractReady = hasSceneActionContract(action, selectedProtocolCard);
                      return (
                        <button
                          key={`${selectedProtocolCard.card_key}:${action.item_key}`}
                          type="button"
                          className={`akrSceneInteractionModalAction ${action.intent_profile_key ? `is-${action.intent_profile_key}` : ""} ${
                            actionContractReady ? "is-contract-ready" : "is-contract-missing"
                          }`}
                          {...buildSceneActionDataAttrs(action, selectedProtocolCard)}
                          onClick={() =>
                            actionContractReady
                              ? triggerSceneAction({
                                  actionKey: action.action_key,
                                  nodeKey: selectedProtocolCard.card_key,
                                  laneKey: "modal_protocol_focus",
                                  label: selectedProtocolCard.value,
                                  labelKey: selectedProtocolCard.label_key,
                                  sourceType: "district_scene_protocol_focus",
                                  actorKey: worldState.active_hotspot_key,
                                  interactionKind: "protocol_focus",
                                  clusterKey: worldState.active_cluster_key,
                                  ...resolveSceneActionContext(action, selectedProtocolCard),
                                  workspace: props.workspace,
                                  tab: props.tab,
                                  districtKey: worldState.district_key
                                })
                              : undefined
                          }
                          disabled={!actionContractReady}
                        >
                          <span>{action.hint_label_key ? t(props.lang, action.hint_label_key as never) : t(props.lang, selectedProtocolCard.label_key as never)}</span>
                          <strong>{t(props.lang, action.label_key as never)}</strong>
                          {action.tone_key ? <span>{t(props.lang, action.tone_key as never)}</span> : null}
                          {renderSceneActionContextMeta(action, selectedProtocolCard)}
                          {renderSceneActionContextChips(action, selectedProtocolCard)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="akrSceneInteractionModalFlow">
            <div className="akrSceneInteractionModalSectionHeader">
              <span>{t(props.lang, "world_modal_section_flow" as never)}</span>
              <strong>{t(props.lang, worldState.interaction_modal.stage_value_key as never)}</strong>
            </div>
            <div className="akrSceneInteractionModalChips">
              <div className={`akrSceneInteractionModalChip is-${worldState.interaction_modal.status_key}`}>
                <span>{t(props.lang, worldState.interaction_modal.stage_label_key as never)}</span>
                <strong>{t(props.lang, worldState.interaction_modal.stage_value_key as never)}</strong>
              </div>
              <div className={`akrSceneInteractionModalChip is-${worldState.interaction_modal.status_key}`}>
                <span>{t(props.lang, worldState.interaction_modal.readiness_label_key as never)}</span>
                <strong>{t(props.lang, worldState.interaction_modal.readiness_value_key as never)}</strong>
              </div>
              <div className="akrSceneInteractionModalChip is-tempo">
                <span>{t(props.lang, worldState.interaction_modal.tempo_label_key as never)}</span>
                <strong>{worldState.interaction_modal.tempo_value}</strong>
              </div>
            </div>
            <div className="akrSceneInteractionModalRows">
              {worldState.interaction_modal.flow_rows.map((row: { label_key: string; value: string; status_key: string }) => (
                <div key={`${worldState.interaction_modal.modal_key}:flow:${row.label_key}`} className={`akrSceneInteractionModalRow is-${row.status_key}`}>
                  <span>{t(props.lang, row.label_key as never)}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
          </div>
          <div className="akrSceneInteractionModalActions">
            <div className="akrSceneInteractionModalSectionHeader">
              <span>{t(props.lang, "world_modal_section_actions" as never)}</span>
              {worldState.interaction_modal.hint_label_key ? (
                <strong>{t(props.lang, worldState.interaction_modal.hint_label_key as never)}</strong>
              ) : null}
            </div>
            <div className="akrSceneInteractionModalActionGrid">
              {worldState.interaction_modal.action_items.map((action: ClusterActionItem) => {
                const actionContractReady = hasSceneActionContract(action);
                return (
                  <button
                    key={`${worldState.interaction_modal.modal_key}:${action.surface_slot_key || action.key}`}
                    type="button"
                    className={`akrSceneInteractionModalAction ${
                      action.is_primary_surface_action ? "isPrimary" : "isSecondary"
                    } is-${action.intent_profile_key || "open"} ${actionContractReady ? "is-contract-ready" : "is-contract-missing"}`}
                    {...buildSceneActionDataAttrs(action)}
                    onClick={() =>
                      actionContractReady
                        ? triggerSceneAction({
                            actionKey: action.action_key,
                            nodeKey: action.key,
                            laneKey: action.cluster_key,
                            label: action.label,
                            labelKey: action.label_key,
                            sourceType: "district_scene_interaction_modal",
                            actorKey: action.actor_key,
                            interactionKind: action.interaction_kind,
                            clusterKey: action.cluster_key,
                            isSecondary: action.is_secondary,
                            ...resolveSceneActionContext(action),
                            workspace: props.workspace,
                            tab: props.tab,
                            districtKey: worldState.district_key
                          })
                        : undefined
                    }
                    disabled={!actionContractReady}
                  >
                    <span>{t(props.lang, (action.intent_profile?.intent_label_key || "world_intent_open") as never)}</span>
                    <strong>{action.label_key ? t(props.lang, action.label_key as never) : action.label}</strong>
                    <span>{t(props.lang, action.hint_label_key as never)}</span>
                    {renderSceneActionContextMeta(action)}
                    {renderSceneActionContextChips(action)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
      {worldState.interaction_flow?.step_rows?.length ? (
        <div
          className={`akrSceneEntryFlow akrGlass is-${worldState.interaction_flow.readiness_status_key}`}
          {...buildSceneActionDataAttrs(worldState.interaction_flow)}
        >
          <div className="akrSceneEntryFlowHeader">
            <span>{t(props.lang, worldState.interaction_flow.flow_kind_key as never)}</span>
            <strong>{t(props.lang, worldState.interaction_flow.stage_value_key as never)}</strong>
          </div>
          <div className="akrSceneEntryFlowMeta">
            <div className={`akrSceneEntryFlowChip is-${worldState.interaction_flow.readiness_status_key}`}>
              <span>{t(props.lang, worldState.interaction_flow.readiness_label_key as never)}</span>
              <strong>{t(props.lang, worldState.interaction_flow.readiness_value_key as never)}</strong>
            </div>
            {worldState.interaction_flow.tempo_value ? (
              <div className="akrSceneEntryFlowChip is-tempo">
                <span>{t(props.lang, worldState.interaction_flow.tempo_label_key as never)}</span>
                <strong>{worldState.interaction_flow.tempo_value}</strong>
              </div>
            ) : null}
          </div>
          {renderSceneActionContextMeta(worldState.interaction_flow)}
          <div className="akrSceneEntryFlowSteps">
            {worldState.interaction_flow.step_rows.map((row: { label_key: string; value: string; status_key: string }) => (
              <div key={`${worldState.interaction_flow.flow_key}:${row.label_key}`} className={`akrSceneEntryFlowStep is-${row.status_key}`}>
                <span>{t(props.lang, row.label_key as never)}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function districtTilt(themeKey: string) {
  switch (themeKey) {
    case "arena_prime":
      return Math.PI / 4.4;
    case "mission_quarter":
      return Math.PI / 6;
    case "exchange_district":
      return Math.PI / 3.6;
    case "ops_citadel":
      return Math.PI / 5.2;
    default:
      return Math.PI / 7;
  }
}

type DistrictActorHandle = {
  animate?: (now: number, motionScalar: number, index: number) => void;
};

function createStandardActorMaterial({
  scene,
  StandardMaterial,
  Color3,
  diffuseHex,
  emissiveHex
}: {
  scene: any;
  StandardMaterial: any;
  Color3: any;
  diffuseHex: string;
  emissiveHex: string;
}) {
  const material = new StandardMaterial(`akrDistrictActorMaterial-${diffuseHex}-${emissiveHex}`, scene);
  material.diffuseColor = Color3.FromHexString(diffuseHex);
  material.emissiveColor = Color3.FromHexString(emissiveHex);
  return material;
}

function createDistrictActorHandles({
  actor,
  scene,
  theme,
  lowEndMode,
  CreateBox,
  CreateCylinder,
  CreateSphere,
  CreateTorus,
  StandardMaterial,
  Color3,
  Vector3
}: {
  actor: any;
  scene: any;
  theme: Record<string, unknown>;
  lowEndMode: boolean;
  CreateBox: any;
  CreateCylinder: any;
  CreateSphere: any;
  CreateTorus: any;
  StandardMaterial: any;
  Color3: any;
  Vector3: any;
}): DistrictActorHandle[] {
  const baseMaterial = createStandardActorMaterial({
    scene,
    StandardMaterial,
    Color3,
    diffuseHex: String(actor.accent_hex || theme.ground_glow_hex || "#103254"),
    emissiveHex: String(actor.glow_hex || actor.accent_hex || theme.ring_hex || "#52bfff")
  });

  const capMaterial = createStandardActorMaterial({
    scene,
    StandardMaterial,
    Color3,
    diffuseHex: String(theme.ground_glow_hex || actor.accent_hex || "#103254"),
    emissiveHex: String(theme.core_hex || actor.glow_hex || "#d6f6ff")
  });

  const handles: DistrictActorHandle[] = [];
  const x = Number(actor.x || 0);
  const y = Number(actor.y || 0);
  const z = Number(actor.z || 0);
  const width = Number(actor.width || 0.4);
  const height = Number(actor.height || 1);
  const depth = Number(actor.depth || width);
  const energy = Number(actor.energy || 0.3);
  const rotationY = Number(actor.rotation_y || 0);

  if (actor.kind === "gate") {
    const left = CreateBox(`${actor.key}-left`, { width: 0.22, height, depth }, scene);
    const right = CreateBox(`${actor.key}-right`, { width: 0.22, height, depth }, scene);
    const lintel = CreateBox(`${actor.key}-lintel`, { width, height: 0.18, depth }, scene);
    left.position = new Vector3(x - width / 2.4, y, z);
    right.position = new Vector3(x + width / 2.4, y, z);
    lintel.position = new Vector3(x, y + height / 2.1, z);
    [left, right, lintel].forEach((mesh) => {
      mesh.rotation.y = rotationY;
      mesh.material = baseMaterial;
    });
    handles.push({
      animate: (now, motionScalar) => {
        lintel.position.y = y + height / 2.1 + Math.sin(now * 1.1) * 0.04 * motionScalar;
      }
    });
  } else if (actor.kind === "arch") {
    const arch = CreateTorus(
      `${actor.key}-arch`,
      { diameter: width, thickness: Math.max(depth, 0.1), tessellation: lowEndMode ? 26 : 42 },
      scene
    );
    arch.position = new Vector3(x, y, z);
    arch.rotation.y = rotationY;
    arch.material = baseMaterial;
    handles.push({
      animate: (now, motionScalar, index) => {
        arch.rotation.z = now * (0.18 + index * 0.02) * motionScalar;
      }
    });
  } else if (actor.kind === "rail") {
    const rail = CreateBox(`${actor.key}-rail`, { width, height: Math.max(height, 0.12), depth }, scene);
    rail.position = new Vector3(x, y, z);
    rail.rotation.y = rotationY;
    rail.material = baseMaterial;
    handles.push({
      animate: (now, motionScalar) => {
        rail.scaling.x = 1 + Math.sin(now * 0.9) * 0.03 * motionScalar;
      }
    });
  } else if (actor.kind === "array") {
    const spine = CreateBox(`${actor.key}-spine`, { width, height: Math.max(height * 0.18, 0.12), depth }, scene);
    spine.position = new Vector3(x, y, z);
    spine.material = baseMaterial;
    const sensors = [-1, 0, 1].map((offset, index) => {
      const orb = CreateSphere(
        `${actor.key}-sensor-${index}`,
        { diameter: lowEndMode ? 0.18 : 0.24, segments: lowEndMode ? 6 : 10 },
        scene
      );
      orb.position = new Vector3(x + offset * (width / 3.2), y + 0.42, z);
      orb.material = capMaterial;
      return orb;
    });
    handles.push({
      animate: (now, motionScalar) => {
        sensors.forEach((orb: any, index: number) => {
          orb.position.y = y + 0.42 + Math.sin(now * (1 + index * 0.18)) * 0.05 * motionScalar;
        });
      }
    });
  } else {
    const shaft =
      actor.kind === "terminal" || actor.kind === "vault"
        ? CreateBox(`${actor.key}-shaft`, { width, height, depth }, scene)
        : CreateCylinder(
            `${actor.key}-shaft`,
            { height, diameter: Math.max(width, depth), tessellation: lowEndMode ? 8 : 14 },
            scene
          );
    shaft.position = new Vector3(x, y, z);
    shaft.rotation.y = rotationY;
    shaft.material = baseMaterial;

    const cap = CreateSphere(
      `${actor.key}-cap`,
      { diameter: actor.kind === "watchtower" ? 0.34 : 0.28, segments: lowEndMode ? 6 : 12 },
      scene
    );
    cap.position = new Vector3(x, y + height / 2 + 0.28, z);
    cap.material = capMaterial;

    if (actor.kind === "blade_tower") {
      const blade = CreateTorus(
        `${actor.key}-blade`,
        { diameter: Math.max(width * 2.6, 0.9), thickness: 0.06, tessellation: lowEndMode ? 20 : 32 },
        scene
      );
      blade.position = new Vector3(x, y + height / 2, z);
      blade.rotation.x = Math.PI / 2;
      blade.material = capMaterial;
      handles.push({
        animate: (now, motionScalar, index) => {
          blade.rotation.z = now * (0.55 + index * 0.03) * motionScalar;
          cap.position.y = y + height / 2 + 0.28 + Math.sin(now * 1.3) * 0.04 * motionScalar;
        }
      });
    } else {
      handles.push({
        animate: (now, motionScalar, index) => {
          cap.position.y = y + height / 2 + 0.28 + Math.sin(now * (1 + index * 0.11)) * (0.04 + energy * 0.03) * motionScalar;
          if (actor.kind === "spine" || actor.kind === "watchtower") {
            shaft.scaling.y = 1 + Math.sin(now * (0.72 + index * 0.09)) * 0.03 * motionScalar;
          }
        }
      });
    }
  }

  return handles;
}
