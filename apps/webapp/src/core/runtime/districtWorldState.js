import { SHELL_ACTION_KEY } from "../navigation/shellActions.js";

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function toText(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function toKeyToken(value, fallback = "") {
  return toText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toNum(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeWorkspace(value) {
  return String(value || "").trim().toLowerCase() === "admin" ? "admin" : "player";
}

function normalizeTab(value) {
  const key = String(value || "").trim().toLowerCase();
  return ["home", "pvp", "tasks", "vault"].includes(key) ? key : "home";
}

function normalizeQuality(value) {
  const key = String(value || "").trim().toLowerCase();
  return ["high", "medium", "low"].includes(key) ? key : "medium";
}

function normalizeHudDensity(value) {
  return String(value || "").trim().toLowerCase() === "compact" ? "compact" : "normal";
}

function resolveDistrictKey(workspace, tab) {
  if (workspace === "admin") {
    return "ops_citadel";
  }
  if (tab === "pvp") {
    return "arena_prime";
  }
  if (tab === "tasks") {
    return "mission_quarter";
  }
  if (tab === "vault") {
    return "exchange_district";
  }
  return "central_hub";
}

function resolveProtocolMicroFlowFamilyFromSequence(sequenceKindKey) {
  switch (toText(sequenceKindKey, "")) {
    case "world_modal_kind_duel_sequence":
      return "duel";
    case "world_modal_kind_ladder_sequence":
      return "ladder";
    case "world_modal_kind_telemetry_scan":
      return "telemetry";
    case "world_modal_kind_mission_terminal":
      return "offer";
    case "world_modal_kind_contract_sequence":
      return "claim";
    case "world_modal_kind_streak_sync":
      return "streak";
    case "world_modal_kind_wallet_terminal":
      return "wallet";
    case "world_modal_kind_payout_route":
      return "route";
    case "world_modal_kind_premium_unlock":
      return "premium";
    case "world_modal_kind_queue_review":
      return "queue";
    case "world_modal_kind_runtime_scan":
      return "runtime";
    case "world_modal_kind_dispatch_sequence":
      return "dispatch";
    case "world_modal_kind_loot_reveal":
      return "loot";
    case "world_modal_kind_travel_gate":
      return "travel";
    default:
      return "";
  }
}

function resolveProtocolMicroFlowFamilyKey(microflow) {
  const row = asRecord(microflow);
  const explicit = toKeyToken(row.family_key || row.familyKey, "");
  if (explicit) {
    return explicit;
  }
  const microflowKey = toText(row.microflow_key || row.microflowKey, "");
  const suffix = toKeyToken(microflowKey.split(":").pop(), "");
  if (suffix && suffix !== "sequence" && suffix !== "stack" && suffix !== "scan" && suffix !== "watch") {
    return suffix;
  }
  if (suffix === "stack") {
    return "offer";
  }
  if (suffix === "scan" || suffix === "watch") {
    return "telemetry";
  }
  const fromSequence = resolveProtocolMicroFlowFamilyFromSequence(row.sequence_kind_key || row.sequenceKindKey);
  if (fromSequence) {
    return fromSequence;
  }
  return suffix || "flow";
}

function resolveProtocolMicroFlowFlowKey(microflow) {
  const row = asRecord(microflow);
  const explicit = toKeyToken(row.flow_key || row.flowKey, "");
  if (explicit) {
    return explicit;
  }
  const familyKey = resolveProtocolMicroFlowFamilyKey(row);
  return familyKey ? `${familyKey}_flow` : "flow";
}

function resolveProtocolMicroFlowRiskBands(loopState, microflow) {
  const primaryStatus = toKeyToken(asRecord(loopState).loop_status_key || asRecord(microflow).status_key, "");
  const rowStatuses = [
    ...asList(asRecord(loopState).loop_rows).map((row) => toKeyToken(asRecord(row).status_key, "")),
    ...asList(asRecord(loopState).loop_signal_rows).map((row) => toKeyToken(asRecord(row).status_key, ""))
  ].filter(Boolean);
  const statuses = [primaryStatus, ...rowStatuses];
  const has = (key) => statuses.includes(key);
  if (has("alert")) {
    return {
      risk_health_band_key: "red",
      risk_attention_band_key: "alert",
      risk_trend_direction_key: "degrading"
    };
  }
  if (has("locked")) {
    return {
      risk_health_band_key: "yellow",
      risk_attention_band_key: "watch",
      risk_trend_direction_key: "degrading"
    };
  }
  if (has("watch")) {
    return {
      risk_health_band_key: "yellow",
      risk_attention_band_key: "watch",
      risk_trend_direction_key: "flat"
    };
  }
  if (has("live") || has("ready")) {
    return {
      risk_health_band_key: "green",
      risk_attention_band_key: "stable",
      risk_trend_direction_key: "flat"
    };
  }
  if (has("idle")) {
    return {
      risk_health_band_key: "yellow",
      risk_attention_band_key: "watch",
      risk_trend_direction_key: "flat"
    };
  }
  return {
    risk_health_band_key: "no_data",
    risk_attention_band_key: "no_data",
    risk_trend_direction_key: "no_data"
  };
}

function buildProtocolMicroFlowRiskVisualMeta(loopState, microflow) {
  const bands = resolveProtocolMicroFlowRiskBands(loopState, microflow);
  const healthBand = toText(bands.risk_health_band_key, "no_data");
  const attentionBand = toText(bands.risk_attention_band_key, "no_data");
  const trendBand = toText(bands.risk_trend_direction_key, "no_data");

  if (healthBand === "red" || attentionBand === "alert") {
    return {
      risk_light_band_key: "critical",
      risk_glow_band_key: "critical",
      risk_motion_band_key: "tense",
      risk_light_scalar: 1.12,
      risk_glow_scalar: 1.16,
      risk_surface_glow_scalar: 1.14,
      risk_chrome_scalar: 1.06,
      risk_pulse_scalar: 1.14,
      risk_motion_scalar: 1.08
    };
  }

  if (healthBand === "yellow" && trendBand === "degrading") {
    return {
      risk_light_band_key: "watch_hot",
      risk_glow_band_key: "watch_hot",
      risk_motion_band_key: "tense",
      risk_light_scalar: 1.08,
      risk_glow_scalar: 1.1,
      risk_surface_glow_scalar: 1.08,
      risk_chrome_scalar: 1.04,
      risk_pulse_scalar: 1.1,
      risk_motion_scalar: 1.05
    };
  }

  if (healthBand === "yellow" || attentionBand === "watch") {
    return {
      risk_light_band_key: "watch",
      risk_glow_band_key: "watch",
      risk_motion_band_key: "alerted",
      risk_light_scalar: 1.04,
      risk_glow_scalar: 1.06,
      risk_surface_glow_scalar: 1.05,
      risk_chrome_scalar: 1.03,
      risk_pulse_scalar: 1.06,
      risk_motion_scalar: 1.03
    };
  }

  if (healthBand === "green" && attentionBand === "stable") {
    return {
      risk_light_band_key: "stable",
      risk_glow_band_key: "stable",
      risk_motion_band_key: "steady",
      risk_light_scalar: 1,
      risk_glow_scalar: 1,
      risk_surface_glow_scalar: 1,
      risk_chrome_scalar: 1,
      risk_pulse_scalar: 1,
      risk_motion_scalar: 1
    };
  }

  return {
    risk_light_band_key: "muted",
    risk_glow_band_key: "muted",
    risk_motion_band_key: "idle",
    risk_light_scalar: 0.92,
    risk_glow_scalar: 0.9,
    risk_surface_glow_scalar: 0.92,
    risk_chrome_scalar: 0.95,
    risk_pulse_scalar: 0.92,
    risk_motion_scalar: 0.94
  };
}

function buildProtocolMicroFlowFocusKey(districtKey, microflow) {
  const safeDistrictKey = toKeyToken(districtKey, "");
  const familyKey = resolveProtocolMicroFlowFamilyKey(microflow);
  const flowKey = resolveProtocolMicroFlowFlowKey(microflow);
  return [safeDistrictKey, familyKey, flowKey].filter(Boolean).join(":");
}

function buildProtocolMicroFlowRiskKey(loopState, microflow) {
  const bands = resolveProtocolMicroFlowRiskBands(loopState, microflow);
  return [bands.risk_health_band_key, bands.risk_attention_band_key, bands.risk_trend_direction_key].filter(Boolean).join(":");
}

function buildRiskContextSignature(source, fallback = {}) {
  const primary = asRecord(source);
  const secondary = asRecord(fallback);
  const flowKey = toText(primary.flow_key, toText(secondary.flow_key, ""));
  const focusKey = toText(primary.focus_key, toText(secondary.focus_key, ""));
  const riskKey = toText(primary.risk_key, toText(secondary.risk_key, ""));
  const entryKindKey = toText(primary.entry_kind_key, toText(secondary.entry_kind_key, ""));
  const sequenceKindKey = toText(primary.sequence_kind_key, toText(secondary.sequence_kind_key, ""));
  return [flowKey, focusKey, riskKey, entryKindKey, sequenceKindKey].filter(Boolean).join("|");
}

function buildActionContextSignature(source, fallback = {}) {
  const primary = asRecord(source);
  const secondary = asRecord(fallback);
  const flowKey = toText(primary.flow_key, toText(secondary.flow_key, ""));
  const focusKey = toText(primary.focus_key, toText(secondary.focus_key, ""));
  const entryKindKey = toText(primary.entry_kind_key, toText(secondary.entry_kind_key, ""));
  const sequenceKindKey = toText(primary.sequence_kind_key, toText(secondary.sequence_kind_key, ""));
  return [flowKey, focusKey, entryKindKey, sequenceKindKey].filter(Boolean).join("|");
}

function buildSceneContractMeta(source, fallback = {}) {
  const primary = asRecord(source);
  const secondary = asRecord(fallback);
  const contextLookupRequired =
    typeof primary?.context_lookup_required === "boolean"
      ? primary.context_lookup_required
      : typeof secondary?.context_lookup_required === "boolean"
        ? secondary.context_lookup_required
        : false;
  const contextLookupResolved =
    typeof primary?.context_lookup_resolved === "boolean"
      ? primary.context_lookup_resolved
      : typeof secondary?.context_lookup_resolved === "boolean"
        ? secondary.context_lookup_resolved
        : !contextLookupRequired;
  const resolved = {
    flow_key: toText(primary.flow_key, toText(secondary.flow_key, "")),
    focus_key: toText(primary.focus_key, toText(secondary.focus_key, "")),
    risk_key: toText(primary.risk_key, toText(secondary.risk_key, "")),
    risk_focus_key: toText(primary.risk_focus_key, toText(secondary.risk_focus_key, "")),
    entry_kind_key: toText(primary.entry_kind_key, toText(secondary.entry_kind_key, "")),
    sequence_kind_key: toText(primary.sequence_kind_key, toText(secondary.sequence_kind_key, "")),
    action_context_signature: toText(
      primary.action_context_signature,
      toText(secondary.action_context_signature, "")
    ),
    risk_context_signature: toText(primary.risk_context_signature, toText(secondary.risk_context_signature, ""))
  };
  const contractMissingKeys = Object.entries(resolved)
    .filter(([, value]) => !toText(value, ""))
    .map(([key]) => key);
  if (contextLookupRequired && !contextLookupResolved) {
    contractMissingKeys.push("action_context_lookup");
  }
  const explicitStateKey = toText(primary.contract_state_key, toText(secondary.contract_state_key, ""));
  const contractReady = explicitStateKey
    ? explicitStateKey === "ready"
    : contractMissingKeys.length === 0;
  return {
    context_lookup_required: contextLookupRequired,
    context_lookup_resolved: contextLookupResolved,
    contract_ready: contractReady,
    contract_state_key: contractReady ? "ready" : "missing",
    contract_missing_keys: [...new Set(contractMissingKeys)]
  };
}

function buildActionContextShape(source, fallback = {}) {
  const primary = asRecord(source);
  const secondary = asRecord(fallback);
  const actionContextSignature = buildActionContextSignature(primary, secondary);
  const riskContextSignature = buildRiskContextSignature(primary, secondary);
  const shape = {
    district_key: toText(primary.district_key, toText(secondary.district_key, "")),
    family_key: toText(primary.family_key, toText(secondary.family_key, "")),
    flow_key: toText(primary.flow_key, toText(secondary.flow_key, "")),
    microflow_key: toText(primary.microflow_key, toText(secondary.microflow_key, "")),
    focus_key: toText(primary.focus_key, toText(secondary.focus_key, "")),
    risk_key: toText(primary.risk_key, toText(secondary.risk_key, "")),
    risk_focus_key: toText(primary.risk_focus_key, toText(secondary.risk_focus_key, "")),
    risk_health_band_key: toText(
      primary.risk_health_band_key,
      toText(secondary.risk_health_band_key, "")
    ),
    risk_attention_band_key: toText(
      primary.risk_attention_band_key,
      toText(secondary.risk_attention_band_key, "")
    ),
    risk_trend_direction_key: toText(
      primary.risk_trend_direction_key,
      toText(secondary.risk_trend_direction_key, "")
    ),
    entry_kind_key: toText(primary.entry_kind_key, toText(secondary.entry_kind_key, "")),
    sequence_kind_key: toText(
      primary.sequence_kind_key,
      toText(secondary.sequence_kind_key, "")
    ),
    context_lookup_required:
      typeof primary.context_lookup_required === "boolean"
        ? primary.context_lookup_required
        : typeof secondary.context_lookup_required === "boolean"
          ? secondary.context_lookup_required
          : false,
    context_lookup_resolved:
      typeof primary.context_lookup_resolved === "boolean"
        ? primary.context_lookup_resolved
        : typeof secondary.context_lookup_resolved === "boolean"
          ? secondary.context_lookup_resolved
          : undefined,
    action_context_signature: actionContextSignature,
    risk_context_signature: riskContextSignature
  };
  return {
    ...shape,
    ...buildSceneContractMeta(shape)
  };
}

function buildRiskContextShape(source, fallback = {}) {
  const primary = asRecord(source);
  const secondary = asRecord(fallback);
  const actionContextSignature = buildActionContextSignature(primary, secondary);
  const riskContextSignature = buildRiskContextSignature(primary, secondary);
  const shape = {
    district_key: toText(primary.district_key, toText(secondary.district_key, "")),
    family_key: toText(primary.family_key, toText(secondary.family_key, "")),
    flow_key: toText(primary.flow_key, toText(secondary.flow_key, "")),
    microflow_key: toText(primary.microflow_key, toText(secondary.microflow_key, "")),
    focus_key: toText(primary.focus_key, toText(secondary.focus_key, "")),
    risk_key: toText(primary.risk_key, toText(secondary.risk_key, "")),
    risk_focus_key: toText(primary.risk_focus_key, toText(secondary.risk_focus_key, "")),
    risk_health_band_key: toText(
      primary.risk_health_band_key,
      toText(secondary.risk_health_band_key, "")
    ),
    risk_attention_band_key: toText(
      primary.risk_attention_band_key,
      toText(secondary.risk_attention_band_key, "")
    ),
    risk_trend_direction_key: toText(
      primary.risk_trend_direction_key,
      toText(secondary.risk_trend_direction_key, "")
    ),
    entry_kind_key: toText(primary.entry_kind_key, toText(secondary.entry_kind_key, "")),
    sequence_kind_key: toText(
      primary.sequence_kind_key,
      toText(secondary.sequence_kind_key, "")
    ),
    context_lookup_required:
      typeof primary.context_lookup_required === "boolean"
        ? primary.context_lookup_required
        : typeof secondary.context_lookup_required === "boolean"
          ? secondary.context_lookup_required
          : false,
    context_lookup_resolved:
      typeof primary.context_lookup_resolved === "boolean"
        ? primary.context_lookup_resolved
        : typeof secondary.context_lookup_resolved === "boolean"
          ? secondary.context_lookup_resolved
          : undefined,
    action_context_signature: actionContextSignature,
    risk_context_signature: riskContextSignature
  };
  return {
    ...shape,
    ...buildSceneContractMeta(shape)
  };
}

function buildInteractionContextMeta(source, fallback = {}) {
  const item = asRecord(source);
  const fallbackItem = asRecord(fallback);
  const actionContextSource = asRecord(item.action_context);
  const riskContextSource = asRecord(item.risk_context);
  const fallbackActionContext = asRecord(fallbackItem.action_context);
  const fallbackRiskContext = asRecord(fallbackItem.risk_context);
  const contextSeed = {
    district_key: toText(
      item.district_key,
      toText(
        actionContextSource.district_key,
        toText(
          riskContextSource.district_key,
          toText(
            fallbackItem.district_key,
            toText(fallbackActionContext.district_key, toText(fallbackRiskContext.district_key, ""))
          )
        )
      )
    ),
    family_key: toText(
      item.family_key,
      toText(
        actionContextSource.family_key,
        toText(
          riskContextSource.family_key,
          toText(fallbackItem.family_key, toText(fallbackActionContext.family_key, toText(fallbackRiskContext.family_key, "")))
        )
      )
    ),
    flow_key: toText(
      item.flow_key,
      toText(
        actionContextSource.flow_key,
        toText(
          riskContextSource.flow_key,
          toText(fallbackItem.flow_key, toText(fallbackActionContext.flow_key, toText(fallbackRiskContext.flow_key, "")))
        )
      )
    ),
    microflow_key: toText(
      item.microflow_key,
      toText(
        actionContextSource.microflow_key,
        toText(
          riskContextSource.microflow_key,
          toText(
            fallbackItem.microflow_key,
            toText(fallbackActionContext.microflow_key, toText(fallbackRiskContext.microflow_key, ""))
          )
        )
      )
    ),
    focus_key: toText(
      item.focus_key,
      toText(
        actionContextSource.focus_key,
        toText(
          riskContextSource.focus_key,
          toText(fallbackItem.focus_key, toText(fallbackActionContext.focus_key, toText(fallbackRiskContext.focus_key, "")))
        )
      )
    ),
    risk_key: toText(
      item.risk_key,
      toText(
        actionContextSource.risk_key,
        toText(
          riskContextSource.risk_key,
          toText(fallbackItem.risk_key, toText(fallbackActionContext.risk_key, toText(fallbackRiskContext.risk_key, "")))
        )
      )
    ),
    risk_focus_key: toText(
      item.risk_focus_key,
      toText(
        actionContextSource.risk_focus_key,
        toText(
          riskContextSource.risk_focus_key,
          toText(
            fallbackItem.risk_focus_key,
            toText(fallbackActionContext.risk_focus_key, toText(fallbackRiskContext.risk_focus_key, ""))
          )
        )
      )
    ),
    risk_health_band_key: toText(
      item.risk_health_band_key,
      toText(
        actionContextSource.risk_health_band_key,
        toText(
          riskContextSource.risk_health_band_key,
          toText(
            fallbackItem.risk_health_band_key,
            toText(
              fallbackActionContext.risk_health_band_key,
              toText(fallbackRiskContext.risk_health_band_key, "")
            )
          )
        )
      )
    ),
    risk_attention_band_key: toText(
      item.risk_attention_band_key,
      toText(
        actionContextSource.risk_attention_band_key,
        toText(
          riskContextSource.risk_attention_band_key,
          toText(
            fallbackItem.risk_attention_band_key,
            toText(
              fallbackActionContext.risk_attention_band_key,
              toText(fallbackRiskContext.risk_attention_band_key, "")
            )
          )
        )
      )
    ),
    risk_trend_direction_key: toText(
      item.risk_trend_direction_key,
      toText(
        actionContextSource.risk_trend_direction_key,
        toText(
          riskContextSource.risk_trend_direction_key,
          toText(
            fallbackItem.risk_trend_direction_key,
            toText(
              fallbackActionContext.risk_trend_direction_key,
              toText(fallbackRiskContext.risk_trend_direction_key, "")
            )
          )
        )
      )
    ),
    entry_kind_key: toText(
      item.entry_kind_key,
      toText(
        actionContextSource.entry_kind_key,
        toText(
          riskContextSource.entry_kind_key,
          toText(
            fallbackItem.entry_kind_key,
            toText(fallbackActionContext.entry_kind_key, toText(fallbackRiskContext.entry_kind_key, ""))
          )
        )
      )
    ),
    sequence_kind_key: toText(
      item.sequence_kind_key,
      toText(
        actionContextSource.sequence_kind_key,
        toText(
          riskContextSource.sequence_kind_key,
          toText(
            fallbackItem.sequence_kind_key,
            toText(fallbackActionContext.sequence_kind_key, toText(fallbackRiskContext.sequence_kind_key, ""))
          )
        )
      )
    ),
    context_lookup_required:
      typeof item.context_lookup_required === "boolean"
        ? item.context_lookup_required
        : typeof actionContextSource.context_lookup_required === "boolean"
          ? actionContextSource.context_lookup_required
          : typeof riskContextSource.context_lookup_required === "boolean"
            ? riskContextSource.context_lookup_required
            : typeof fallbackItem.context_lookup_required === "boolean"
              ? fallbackItem.context_lookup_required
              : typeof fallbackActionContext.context_lookup_required === "boolean"
                ? fallbackActionContext.context_lookup_required
                : typeof fallbackRiskContext.context_lookup_required === "boolean"
                  ? fallbackRiskContext.context_lookup_required
                  : false,
    context_lookup_resolved:
      typeof item.context_lookup_resolved === "boolean"
        ? item.context_lookup_resolved
        : typeof actionContextSource.context_lookup_resolved === "boolean"
          ? actionContextSource.context_lookup_resolved
          : typeof riskContextSource.context_lookup_resolved === "boolean"
            ? riskContextSource.context_lookup_resolved
            : typeof fallbackItem.context_lookup_resolved === "boolean"
              ? fallbackItem.context_lookup_resolved
              : typeof fallbackActionContext.context_lookup_resolved === "boolean"
                ? fallbackActionContext.context_lookup_resolved
                : typeof fallbackRiskContext.context_lookup_resolved === "boolean"
                  ? fallbackRiskContext.context_lookup_resolved
                  : undefined
  };
  const actionContextShape =
    contextSeed.family_key ||
    contextSeed.flow_key ||
    contextSeed.microflow_key ||
    contextSeed.focus_key ||
    contextSeed.risk_key ||
    contextSeed.risk_focus_key
      ? buildActionContextShape(contextSeed, item)
      : undefined;
  const riskContextShape = buildRiskContextShape(contextSeed, item);
  const actionContextSignature = buildActionContextSignature(contextSeed, item);
  const riskContextSignature = buildRiskContextSignature(contextSeed, item);
  const contractMeta = buildSceneContractMeta(
    {
      ...contextSeed,
      action_context_signature: actionContextSignature,
      risk_context_signature: riskContextSignature
    },
    item
  );
  if (actionContextShape) {
    actionContextShape.contract_ready = contractMeta.contract_ready;
    actionContextShape.contract_missing_keys = contractMeta.contract_missing_keys;
  }
  riskContextShape.contract_ready = contractMeta.contract_ready;
  riskContextShape.contract_missing_keys = contractMeta.contract_missing_keys;
  return {
    ...contextSeed,
    action_context: actionContextShape,
    risk_context: riskContextShape,
    action_context_signature: actionContextSignature,
    risk_context_signature: riskContextSignature,
    contract_ready: contractMeta.contract_ready,
    contract_state_key: contractMeta.contract_state_key,
    contract_missing_keys: contractMeta.contract_missing_keys
  };
}

function applyResolvedInteractionContext(target, rootContext, actionContext, riskContext, overrides = {}) {
  const base = asRecord(target);
  const root = asRecord(rootContext);
  const patch = asRecord(overrides);
  const resolvedActionContext = asRecord(actionContext);
  const resolvedRiskContext = asRecord(riskContext);
  const mergedContext = {
    ...root,
    ...patch
  };
  return {
    ...base,
    ...mergedContext,
    action_context: resolvedActionContext,
    action_context_signature: toText(
      resolvedActionContext.action_context_signature,
      toText(base.action_context_signature, "")
    ),
    risk_context: resolvedRiskContext,
    risk_context_signature: toText(
      resolvedRiskContext.risk_context_signature,
      toText(base.risk_context_signature, "")
    ),
    ...buildSceneContractMeta(
      {
        ...base,
        ...mergedContext,
        action_context_signature: toText(
          resolvedActionContext.action_context_signature,
          toText(base.action_context_signature, "")
        ),
        risk_context_signature: toText(
          resolvedRiskContext.risk_context_signature,
          toText(base.risk_context_signature, "")
        )
      },
      base
    )
  };
}

function applyResolvedActionRiskMeta(target, contextSource, fallback = {}, overrides = {}) {
  const base = asRecord(target);
  const primary = asRecord(contextSource);
  const secondary = asRecord(fallback);
  const patch = asRecord(overrides);
  const actionContext = buildActionContextShape(primary, secondary);
  const riskContext = buildRiskContextShape(primary, secondary);
  const resolved = {
    ...base,
    ...patch,
    district_key: toText(patch.district_key, toText(actionContext.district_key, toText(base.district_key, ""))),
    family_key: toText(patch.family_key, toText(actionContext.family_key, toText(base.family_key, ""))),
    flow_key: toText(patch.flow_key, toText(actionContext.flow_key, toText(base.flow_key, ""))),
    microflow_key: toText(patch.microflow_key, toText(actionContext.microflow_key, toText(base.microflow_key, ""))),
    focus_key: toText(patch.focus_key, toText(actionContext.focus_key, toText(base.focus_key, ""))),
    risk_key: toText(patch.risk_key, toText(actionContext.risk_key, toText(base.risk_key, ""))),
    risk_focus_key: toText(
      patch.risk_focus_key,
      toText(actionContext.risk_focus_key, toText(base.risk_focus_key, ""))
    ),
    risk_health_band_key: toText(
      patch.risk_health_band_key,
      toText(actionContext.risk_health_band_key, toText(base.risk_health_band_key, ""))
    ),
    risk_attention_band_key: toText(
      patch.risk_attention_band_key,
      toText(actionContext.risk_attention_band_key, toText(base.risk_attention_band_key, ""))
    ),
    risk_trend_direction_key: toText(
      patch.risk_trend_direction_key,
      toText(actionContext.risk_trend_direction_key, toText(base.risk_trend_direction_key, ""))
    ),
    entry_kind_key: toText(
      patch.entry_kind_key,
      toText(actionContext.entry_kind_key, toText(base.entry_kind_key, ""))
    ),
    sequence_kind_key: toText(
      patch.sequence_kind_key,
      toText(actionContext.sequence_kind_key, toText(base.sequence_kind_key, ""))
    ),
    action_context: actionContext,
    action_context_signature: toText(
      patch.action_context_signature,
      toText(actionContext.action_context_signature, toText(base.action_context_signature, ""))
    ),
    risk_context: riskContext,
    risk_context_signature: toText(
      patch.risk_context_signature,
      toText(riskContext.risk_context_signature, toText(base.risk_context_signature, ""))
    )
  };
  return {
    ...resolved,
    ...buildSceneContractMeta(resolved, base)
  };
}

function attachPrimaryActionMeta(target, action, fallback = {}) {
  const base = asRecord(target);
  if (!Object.keys(base).length) {
    return target;
  }
  const primaryAction = asRecord(action);
  const fallbackRecord = asRecord(fallback);
  const resolvedAction = toText(primaryAction.action_key, "")
    ? primaryAction
    : asRecord(asList(base.action_items)[0]);
  const primaryMeta = buildInteractionContextMeta(resolvedAction, fallbackRecord);
  const primaryActionContext = asRecord(primaryMeta.action_context);
  const primaryRiskContext = asRecord(primaryMeta.risk_context);
  return {
    ...base,
    primary_action_key: toText(resolvedAction.action_key, toText(base.primary_action_key, "")),
    primary_action_label_key: toText(resolvedAction.label_key, toText(base.primary_action_label_key, "")),
    primary_action_hint_label_key: toText(resolvedAction.hint_label_key, toText(base.primary_action_hint_label_key, "")),
    primary_family_key: toText(primaryMeta.family_key, toText(base.primary_family_key, "")),
    primary_flow_key: toText(primaryMeta.flow_key, toText(base.primary_flow_key, "")),
    primary_microflow_key: toText(primaryMeta.microflow_key, toText(base.primary_microflow_key, "")),
    primary_focus_key: toText(primaryMeta.focus_key, toText(base.primary_focus_key, "")),
    primary_risk_key: toText(primaryMeta.risk_key, toText(base.primary_risk_key, "")),
    primary_risk_focus_key: toText(primaryMeta.risk_focus_key, toText(base.primary_risk_focus_key, "")),
    primary_risk_health_band_key: toText(
      primaryMeta.risk_health_band_key,
      toText(base.primary_risk_health_band_key, "")
    ),
    primary_risk_attention_band_key: toText(
      primaryMeta.risk_attention_band_key,
      toText(base.primary_risk_attention_band_key, "")
    ),
    primary_risk_trend_direction_key: toText(
      primaryMeta.risk_trend_direction_key,
      toText(base.primary_risk_trend_direction_key, "")
    ),
    primary_entry_kind_key: toText(primaryMeta.entry_kind_key, toText(base.primary_entry_kind_key, "")),
    primary_sequence_kind_key: toText(
      primaryMeta.sequence_kind_key,
      toText(base.primary_sequence_kind_key, "")
    ),
    primary_action_context_signature: toText(
      primaryMeta.action_context_signature,
      toText(base.primary_action_context_signature, "")
    ),
    primary_risk_context_signature: toText(
      primaryMeta.risk_context_signature,
      toText(base.primary_risk_context_signature, "")
    ),
    primary_contract_ready:
      typeof primaryMeta.contract_ready === "boolean"
        ? primaryMeta.contract_ready
        : typeof base.primary_contract_ready === "boolean"
          ? base.primary_contract_ready
          : undefined,
    primary_contract_state_key: toText(
      primaryMeta.contract_state_key,
      toText(base.primary_contract_state_key, "")
    ),
    primary_contract_missing_keys: Array.isArray(primaryMeta.contract_missing_keys)
      ? primaryMeta.contract_missing_keys
      : asList(base.primary_contract_missing_keys),
    primary_action_context: primaryActionContext,
    primary_risk_context: primaryRiskContext
  };
}

function resolveDistrictLabelKey(districtKey) {
  switch (districtKey) {
    case "arena_prime":
      return "world_district_arena_prime";
    case "mission_quarter":
      return "world_district_mission_quarter";
    case "exchange_district":
      return "world_district_exchange_district";
    case "ops_citadel":
      return "world_district_ops_citadel";
    default:
      return "world_district_central_hub";
  }
}

function resolveDistrictTheme(districtKey) {
  switch (districtKey) {
    case "arena_prime":
      return {
        theme_key: "arena_prime",
        ground_hex: "#2f1320",
        ground_glow_hex: "#5a1f34",
        ring_hex: "#ff6f91",
        ring_secondary_hex: "#ffb45d",
        core_hex: "#ffd1df",
        light_hex: "#ff7c8d",
        satellite_hex: "#ff9f6e",
        satellite_count: 5,
        satellite_radius: 1.6,
        satellite_height: 1.5,
        orbit_radius: 3.4,
        camera_radius: 9.2
      };
    case "mission_quarter":
      return {
        theme_key: "mission_quarter",
        ground_hex: "#2e260f",
        ground_glow_hex: "#544522",
        ring_hex: "#ffd36f",
        ring_secondary_hex: "#ffb45d",
        core_hex: "#fff3c7",
        light_hex: "#ffd36f",
        satellite_hex: "#ffe39a",
        satellite_count: 4,
        satellite_radius: 1.9,
        satellite_height: 1.35,
        orbit_radius: 3.15,
        camera_radius: 10.4
      };
    case "exchange_district":
      return {
        theme_key: "exchange_district",
        ground_hex: "#0c2a24",
        ground_glow_hex: "#15483d",
        ring_hex: "#2fffb5",
        ring_secondary_hex: "#6cf6e8",
        core_hex: "#caffef",
        light_hex: "#35f1c9",
        satellite_hex: "#6cf6e8",
        satellite_count: 6,
        satellite_radius: 1.95,
        satellite_height: 1.45,
        orbit_radius: 3.3,
        camera_radius: 10.5
      };
    case "ops_citadel":
      return {
        theme_key: "ops_citadel",
        ground_hex: "#10263b",
        ground_glow_hex: "#1a4259",
        ring_hex: "#45ffca",
        ring_secondary_hex: "#8ef4ff",
        core_hex: "#d5fff4",
        light_hex: "#45ffca",
        satellite_hex: "#8ef4ff",
        satellite_count: 4,
        satellite_radius: 2.1,
        satellite_height: 1.8,
        orbit_radius: 3.7,
        camera_radius: 10.2
      };
    default:
      return {
        theme_key: "central_hub",
        ground_hex: "#0e2a44",
        ground_glow_hex: "#103254",
        ring_hex: "#00d6ff",
        ring_secondary_hex: "#7be6ff",
        core_hex: "#d6f6ff",
        light_hex: "#5ad7ff",
        satellite_hex: "#7be6ff",
        satellite_count: 3,
        satellite_radius: 1.75,
        satellite_height: 1.4,
        orbit_radius: 3.25,
        camera_radius: 10.8
      };
  }
}

function resolveDistrictCameraProfile(districtKey, lowEndMode, effectiveQuality, hudDensity, sceneProfile) {
  const compact = lowEndMode || effectiveQuality === "low" || hudDensity === "compact" || sceneProfile === "lite";
  const cinematic = !compact && sceneProfile === "cinematic";
  switch (districtKey) {
    case "arena_prime":
      return {
        camera_profile_key: "arena_focus",
        alpha_base: -Math.PI / 2.45,
        beta_base: compact ? Math.PI / 3.3 : Math.PI / 3.55,
        radius: compact ? 8.8 : 9.4,
        target_y: 1,
        lower_radius_delta: 0.9,
        upper_radius_delta: 1.25,
        orbit_scalar: compact ? 13 : cinematic ? 24 : 20,
        sway_scalar: compact ? 0.64 : cinematic ? 1.14 : 0.96,
        focus_lerp: compact ? 0.04 : 0.07,
        radius_lerp: compact ? 0.03 : 0.06,
        alpha_lerp: compact ? 0.026 : cinematic ? 0.072 : 0.05,
        beta_lerp: compact ? 0.024 : cinematic ? 0.066 : 0.045
      };
    case "mission_quarter":
      return {
        camera_profile_key: "mission_sweep",
        alpha_base: -Math.PI / 1.95,
        beta_base: compact ? Math.PI / 3.15 : Math.PI / 3.35,
        radius: compact ? 9.7 : 10.4,
        target_y: 0.9,
        lower_radius_delta: 1,
        upper_radius_delta: 1.3,
        orbit_scalar: compact ? 9 : cinematic ? 18 : 14,
        sway_scalar: compact ? 0.5 : cinematic ? 0.92 : 0.74,
        focus_lerp: compact ? 0.035 : 0.06,
        radius_lerp: compact ? 0.028 : 0.05,
        alpha_lerp: compact ? 0.022 : cinematic ? 0.06 : 0.042,
        beta_lerp: compact ? 0.02 : cinematic ? 0.056 : 0.038
      };
    case "exchange_district":
      return {
        camera_profile_key: "exchange_orbit",
        alpha_base: -Math.PI / 2.05,
        beta_base: compact ? Math.PI / 3.2 : Math.PI / 3.42,
        radius: compact ? 9.8 : 10.6,
        target_y: 0.85,
        lower_radius_delta: 1,
        upper_radius_delta: 1.35,
        orbit_scalar: compact ? 11 : cinematic ? 20 : 16,
        sway_scalar: compact ? 0.54 : cinematic ? 1 : 0.82,
        focus_lerp: compact ? 0.038 : 0.065,
        radius_lerp: compact ? 0.03 : 0.055,
        alpha_lerp: compact ? 0.024 : cinematic ? 0.064 : 0.046,
        beta_lerp: compact ? 0.022 : cinematic ? 0.06 : 0.042
      };
    case "ops_citadel":
      return {
        camera_profile_key: "ops_overwatch",
        alpha_base: -Math.PI / 1.82,
        beta_base: compact ? Math.PI / 3.05 : Math.PI / 3.18,
        radius: compact ? 9.4 : 10.1,
        target_y: 1.15,
        lower_radius_delta: 0.95,
        upper_radius_delta: 1.2,
        orbit_scalar: compact ? 7 : cinematic ? 13 : 11,
        sway_scalar: compact ? 0.38 : cinematic ? 0.72 : 0.58,
        focus_lerp: compact ? 0.03 : 0.05,
        radius_lerp: compact ? 0.024 : 0.04,
        alpha_lerp: compact ? 0.02 : cinematic ? 0.05 : 0.036,
        beta_lerp: compact ? 0.018 : cinematic ? 0.046 : 0.032
      };
    default:
      return {
        camera_profile_key: "hub_glide",
        alpha_base: -Math.PI / 2.08,
        beta_base: compact ? Math.PI / 3.05 : Math.PI / 3.15,
        radius: compact ? 10 : 10.8,
        target_y: 0.8,
        lower_radius_delta: 1.05,
        upper_radius_delta: 1.2,
        orbit_scalar: compact ? 11 : cinematic ? 20 : 16,
        sway_scalar: compact ? 0.46 : cinematic ? 0.82 : 0.66,
        focus_lerp: compact ? 0.035 : 0.058,
        radius_lerp: compact ? 0.026 : 0.046,
        alpha_lerp: compact ? 0.022 : cinematic ? 0.056 : 0.04,
        beta_lerp: compact ? 0.02 : cinematic ? 0.052 : 0.036
      };
  }
}

function resolveDistrictHudProfile(districtKey, hudDensity, lowEndMode, sceneProfile) {
  const compact = lowEndMode || hudDensity === "compact" || sceneProfile === "lite";
  const shared = {
    density_label_key: compact ? "world_hud_density_compact" : "world_hud_density_expanded",
    compact_mode: compact,
    show_caption: !compact,
    show_node_label: !compact,
    show_density_chip: true
  };
  switch (districtKey) {
    case "arena_prime":
      return {
        ...shared,
        hud_profile_key: "arena_prime",
        tone_label_key: "world_hud_tone_arena_prime",
        caption_label_key: "world_hud_caption_arena_prime"
      };
    case "mission_quarter":
      return {
        ...shared,
        hud_profile_key: "mission_quarter",
        tone_label_key: "world_hud_tone_mission_quarter",
        caption_label_key: "world_hud_caption_mission_quarter"
      };
    case "exchange_district":
      return {
        ...shared,
        hud_profile_key: "exchange_district",
        tone_label_key: "world_hud_tone_exchange_district",
        caption_label_key: "world_hud_caption_exchange_district"
      };
    case "ops_citadel":
      return {
        ...shared,
        hud_profile_key: "ops_citadel",
        tone_label_key: "world_hud_tone_ops_citadel",
        caption_label_key: "world_hud_caption_ops_citadel"
      };
    default:
      return {
        ...shared,
        hud_profile_key: "central_hub",
        tone_label_key: "world_hud_tone_central_hub",
        caption_label_key: "world_hud_caption_central_hub"
      };
  }
}

function resolveDistrictDirectorProfile(districtKey, hudDensity, lowEndMode, sceneProfile) {
  const compact = lowEndMode || hudDensity === "compact" || sceneProfile === "lite";
  switch (districtKey) {
    case "arena_prime":
      return {
        director_profile_key: "arena_vector",
        pace_label_key: "world_director_pace_arena",
        motion_scalar: compact ? 0.82 : 1.18,
        orbit_spin_scalar: compact ? 0.82 : 1.22,
        cluster_spin_scalar: compact ? 0.76 : 1.18,
        node_pulse_scalar: compact ? 0.78 : 1.16
      };
    case "mission_quarter":
      return {
        director_profile_key: "mission_vector",
        pace_label_key: "world_director_pace_mission",
        motion_scalar: compact ? 0.68 : 0.94,
        orbit_spin_scalar: compact ? 0.7 : 0.9,
        cluster_spin_scalar: compact ? 0.66 : 0.88,
        node_pulse_scalar: compact ? 0.74 : 0.96
      };
    case "exchange_district":
      return {
        director_profile_key: "exchange_vector",
        pace_label_key: "world_director_pace_exchange",
        motion_scalar: compact ? 0.74 : 1.02,
        orbit_spin_scalar: compact ? 0.78 : 1.04,
        cluster_spin_scalar: compact ? 0.76 : 1,
        node_pulse_scalar: compact ? 0.78 : 1.02
      };
    case "ops_citadel":
      return {
        director_profile_key: "ops_vector",
        pace_label_key: "world_director_pace_ops",
        motion_scalar: compact ? 0.58 : 0.82,
        orbit_spin_scalar: compact ? 0.58 : 0.78,
        cluster_spin_scalar: compact ? 0.56 : 0.72,
        node_pulse_scalar: compact ? 0.66 : 0.84
      };
    default:
      return {
        director_profile_key: "hub_vector",
        pace_label_key: "world_director_pace_hub",
        motion_scalar: compact ? 0.7 : 0.96,
        orbit_spin_scalar: compact ? 0.74 : 0.98,
        cluster_spin_scalar: compact ? 0.72 : 0.94,
        node_pulse_scalar: compact ? 0.76 : 0.98
      };
  }
}

function resolveDistrictRailProfile(districtKey, hudDensity, lowEndMode, sceneProfile) {
  const compact = lowEndMode || hudDensity === "compact" || sceneProfile === "lite";
  const shared = {
    compact,
    rail_layout_key: compact ? "compact_stack" : "stack",
    show_caption: !compact
  };
  switch (districtKey) {
    case "arena_prime":
      return {
        ...shared,
        rail_profile_key: "arena_prime",
        rail_label_key: "world_rail_label_arena_prime",
        rail_caption_key: "world_rail_caption_arena_prime"
      };
    case "mission_quarter":
      return {
        ...shared,
        rail_profile_key: "mission_quarter",
        rail_label_key: "world_rail_label_mission_quarter",
        rail_caption_key: "world_rail_caption_mission_quarter"
      };
    case "exchange_district":
      return {
        ...shared,
        rail_profile_key: "exchange_district",
        rail_label_key: "world_rail_label_exchange_district",
        rail_caption_key: "world_rail_caption_exchange_district"
      };
    case "ops_citadel":
      return {
        ...shared,
        rail_profile_key: "ops_citadel",
        rail_label_key: "world_rail_label_ops_citadel",
        rail_caption_key: "world_rail_caption_ops_citadel"
      };
    default:
      return {
        ...shared,
        rail_profile_key: "central_hub",
        rail_label_key: "world_rail_label_central_hub",
        rail_caption_key: "world_rail_caption_central_hub"
      };
  }
}

function resolveInteractionIntentProfile(interactionKind, isSecondary) {
  const kind = toText(interactionKind, "open");
  const secondary = Boolean(isSecondary);
  switch (kind) {
    case "travel":
      return {
        intent_profile_key: secondary ? "travel_secondary" : "travel_primary",
        intent_label_key: "world_intent_travel",
        intent_tone_key: "world_intent_tone_travel",
        rail_class_key: secondary ? "travel_secondary" : "travel_primary",
        pulse_scalar: secondary ? 0.9 : 1.12
      };
    case "launch":
      return {
        intent_profile_key: secondary ? "launch_secondary" : "launch_primary",
        intent_label_key: "world_intent_launch",
        intent_tone_key: "world_intent_tone_launch",
        rail_class_key: secondary ? "launch_secondary" : "launch_primary",
        pulse_scalar: secondary ? 0.94 : 1.08
      };
    case "connect":
      return {
        intent_profile_key: secondary ? "connect_secondary" : "connect_primary",
        intent_label_key: "world_intent_connect",
        intent_tone_key: "world_intent_tone_connect",
        rail_class_key: secondary ? "connect_secondary" : "connect_primary",
        pulse_scalar: secondary ? 0.9 : 1
      };
    case "payout":
      return {
        intent_profile_key: secondary ? "payout_secondary" : "payout_primary",
        intent_label_key: "world_intent_payout",
        intent_tone_key: "world_intent_tone_payout",
        rail_class_key: secondary ? "payout_secondary" : "payout_primary",
        pulse_scalar: secondary ? 0.9 : 1.02
      };
    case "upgrade":
      return {
        intent_profile_key: secondary ? "upgrade_secondary" : "upgrade_primary",
        intent_label_key: "world_intent_upgrade",
        intent_tone_key: "world_intent_tone_upgrade",
        rail_class_key: secondary ? "upgrade_secondary" : "upgrade_primary",
        pulse_scalar: secondary ? 0.92 : 1.04
      };
    case "compete":
      return {
        intent_profile_key: secondary ? "compete_secondary" : "compete_primary",
        intent_label_key: "world_intent_compete",
        intent_tone_key: "world_intent_tone_compete",
        rail_class_key: secondary ? "compete_secondary" : "compete_primary",
        pulse_scalar: secondary ? 0.94 : 1.16
      };
    case "climb":
      return {
        intent_profile_key: secondary ? "climb_secondary" : "climb_primary",
        intent_label_key: "world_intent_climb",
        intent_tone_key: "world_intent_tone_climb",
        rail_class_key: secondary ? "climb_secondary" : "climb_primary",
        pulse_scalar: secondary ? 0.9 : 1.06
      };
    case "review":
      return {
        intent_profile_key: secondary ? "review_secondary" : "review_primary",
        intent_label_key: "world_intent_review",
        intent_tone_key: "world_intent_tone_review",
        rail_class_key: secondary ? "review_secondary" : "review_primary",
        pulse_scalar: secondary ? 0.84 : 0.94
      };
    case "track":
      return {
        intent_profile_key: secondary ? "track_secondary" : "track_primary",
        intent_label_key: "world_intent_track",
        intent_tone_key: "world_intent_tone_track",
        rail_class_key: secondary ? "track_secondary" : "track_primary",
        pulse_scalar: secondary ? 0.86 : 0.98
      };
    case "claim":
      return {
        intent_profile_key: secondary ? "claim_secondary" : "claim_primary",
        intent_label_key: "world_intent_claim",
        intent_tone_key: "world_intent_tone_claim",
        rail_class_key: secondary ? "claim_secondary" : "claim_primary",
        pulse_scalar: secondary ? 0.9 : 1.02
      };
    case "monitor":
      return {
        intent_profile_key: secondary ? "monitor_secondary" : "monitor_primary",
        intent_label_key: "world_intent_monitor",
        intent_tone_key: "world_intent_tone_monitor",
        rail_class_key: secondary ? "monitor_secondary" : "monitor_primary",
        pulse_scalar: secondary ? 0.84 : 0.92
      };
    case "dispatch":
      return {
        intent_profile_key: secondary ? "dispatch_secondary" : "dispatch_primary",
        intent_label_key: "world_intent_dispatch",
        intent_tone_key: "world_intent_tone_dispatch",
        rail_class_key: secondary ? "dispatch_secondary" : "dispatch_primary",
        pulse_scalar: secondary ? 0.9 : 1.04
      };
    default:
      return {
        intent_profile_key: secondary ? "open_secondary" : "open_primary",
        intent_label_key: "world_intent_open",
        intent_tone_key: "world_intent_tone_open",
        rail_class_key: secondary ? "open_secondary" : "open_primary",
        pulse_scalar: secondary ? 0.84 : 0.94
      };
  }
}

function resolveModeKey(sceneProfile, lowEndMode) {
  if (lowEndMode || sceneProfile === "lite") {
    return "world_scene_mode_lite";
  }
  if (sceneProfile === "cinematic") {
    return "world_scene_mode_cinematic";
  }
  return "world_scene_mode_balanced";
}

function pickNumber(source, candidates, fallback = 0) {
  const record = asRecord(source);
  for (const key of candidates) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      const value = toNum(record[key], Number.NaN);
      if (Number.isFinite(value)) {
        return value;
      }
    }
  }
  return fallback;
}

function pickTruthy(source, candidates) {
  const record = asRecord(source);
  return candidates.some((key) => Boolean(record[key]));
}

function resolveStatusFromEnergy(energy, preferred = "") {
  const explicit = String(preferred || "").trim().toLowerCase();
  if (["good", "warn", "hot", "neutral"].includes(explicit)) {
    return explicit;
  }
  if (energy >= 0.82) {
    return "hot";
  }
  if (energy >= 0.58) {
    return "warn";
  }
  if (energy >= 0.34) {
    return "good";
  }
  return "neutral";
}

function statusColor(statusKey) {
  switch (statusKey) {
    case "hot":
      return "#ff6f91";
    case "warn":
      return "#ffb45d";
    case "good":
      return "#29ffbf";
    default:
      return "#52bfff";
  }
}

function buildNode(input) {
  const energy = clamp(toNum(input.energy, 0), 0.08, 1);
  const statusKey = resolveStatusFromEnergy(energy, input.statusKey);
  return {
    key: toText(input.key, "node"),
    laneKey: toText(input.laneKey, "lane"),
    label: toText(input.label, "Node"),
    label_key: toText(input.labelKey, ""),
    metric: toText(input.metric, "--"),
    action_key: toText(input.actionKey, ""),
    energy,
    status_key: statusKey,
    accent_hex: statusColor(statusKey)
  };
}

function buildActor(input) {
  return {
    key: toText(input.key, "actor"),
    kind: toText(input.kind, "tower"),
    accent_hex: toText(input.accentHex, "#52bfff"),
    glow_hex: toText(input.glowHex, input.accentHex || "#52bfff"),
    x: toNum(input.x, 0),
    y: toNum(input.y, 0),
    z: toNum(input.z, 0),
    width: clamp(toNum(input.width, 0.5), 0.08, 8),
    height: clamp(toNum(input.height, 0.5), 0.08, 8),
    depth: clamp(toNum(input.depth, 0.5), 0.08, 8),
    energy: clamp(toNum(input.energy, 0.3), 0.08, 1),
    rotation_y: toNum(input.rotationY, 0)
  };
}

function buildHotspot(input) {
  const intentProfile = resolveInteractionIntentProfile(input.interactionKind, input.isSecondary);
  return {
    key: toText(input.key, "hotspot"),
    label: toText(input.label, "Hotspot"),
    label_key: toText(input.labelKey, ""),
    source_type: "district_scene_hotspot",
    action_key: toText(input.actionKey, ""),
    actor_key: toText(input.actorKey, ""),
    cluster_key: toText(input.clusterKey || input.actorKey, toText(input.actorKey, "")),
    interaction_kind: toText(input.interactionKind, "open"),
    intent_profile_key: intentProfile.intent_profile_key,
    intent_profile: intentProfile,
    hint_label_key: toText(input.hintLabelKey, "world_hotspot_hint_open"),
    is_secondary: Boolean(input.isSecondary),
    x: toNum(input.x, 0),
    y: toNum(input.y, 0),
    z: toNum(input.z, 0),
    focus_y: toNum(input.focusY, toNum(input.y, 0.16) + 0.52),
    radius: clamp(toNum(input.radius, 0.42), 0.12, 4),
    ring_radius: clamp(toNum(input.ringRadius, toNum(input.radius, 0.42) * 1.55), 0.18, 6),
    camera_radius_scale: clamp(toNum(input.cameraRadiusScale, 1), 0.7, 1.25),
    camera_alpha_offset: clamp(toNum(input.cameraAlphaOffset, 0), -0.45, 0.45),
    camera_beta_offset: clamp(toNum(input.cameraBetaOffset, 0), -0.18, 0.18),
    accent_hex: toText(input.accentHex, "#52bfff"),
    energy: clamp(toNum(input.energy, 0.3), 0.08, 1)
  };
}

function finalizeHotspots(hotspots) {
  const counts = new Map();
  hotspots.forEach((hotspot) => {
    const clusterKey = toText(hotspot.cluster_key || hotspot.actor_key || hotspot.key, hotspot.key);
    counts.set(clusterKey, (counts.get(clusterKey) || 0) + 1);
  });
  const seen = new Map();
  return hotspots.map((hotspot) => {
    const clusterKey = toText(hotspot.cluster_key || hotspot.actor_key || hotspot.key, hotspot.key);
    const clusterIndex = seen.get(clusterKey) || 0;
    seen.set(clusterKey, clusterIndex + 1);
    return {
      ...hotspot,
      cluster_key: clusterKey,
      cluster_index: clusterIndex,
      cluster_size: counts.get(clusterKey) || 1
    };
  });
}

function buildInteractionClusters(actors, hotspots, activeHotspotKey) {
  const actorMap = new Map(actors.map((actor) => [actor.key, actor]));
  const grouped = new Map();
  hotspots.forEach((hotspot) => {
    const clusterKey = toText(hotspot.cluster_key || hotspot.actor_key || hotspot.key, hotspot.key);
    const current = grouped.get(clusterKey) || {
      cluster_key: clusterKey,
      actor_key: toText(hotspot.actor_key, clusterKey),
      label: toText(hotspot.label, "Cluster"),
      label_key: toText(hotspot.label_key, ""),
      primary_hotspot_key: toText(hotspot.key, ""),
      active_hotspot_key: "",
      primary_action_key: toText(hotspot.action_key, ""),
      primary_hint_label_key: toText(hotspot.hint_label_key, "world_hotspot_hint_open"),
      primary_interaction_kind: toText(hotspot.interaction_kind, "open"),
      hotspot_keys: [],
      action_items: [],
      hotspot_count: 0,
      secondary_count: 0,
      energy: 0,
      x: toNum(hotspot.x, 0),
      y: toNum(hotspot.y, 0.2),
      z: toNum(hotspot.z, 0)
    };
    current.hotspot_keys.push(hotspot.key);
    current.action_items.push({
      key: toText(hotspot.key, ""),
      label: toText(hotspot.label, ""),
      label_key: toText(hotspot.label_key, ""),
      action_key: toText(hotspot.action_key, ""),
      actor_key: toText(hotspot.actor_key, ""),
      cluster_key: clusterKey,
      hint_label_key: toText(hotspot.hint_label_key, "world_hotspot_hint_open"),
      interaction_kind: toText(hotspot.interaction_kind, "open"),
      intent_profile_key: toText(hotspot.intent_profile_key, ""),
      intent_profile: asRecord(hotspot.intent_profile),
      is_secondary: Boolean(hotspot.is_secondary),
      family_key: toText(hotspot.family_key, ""),
      flow_key: toText(hotspot.flow_key, ""),
      microflow_key: toText(hotspot.microflow_key, ""),
      focus_key: toText(hotspot.focus_key, ""),
      risk_key: toText(hotspot.risk_key, ""),
      risk_focus_key: toText(hotspot.risk_focus_key, ""),
      risk_health_band_key: toText(hotspot.risk_health_band_key, ""),
      risk_attention_band_key: toText(hotspot.risk_attention_band_key, ""),
      risk_trend_direction_key: toText(hotspot.risk_trend_direction_key, ""),
      entry_kind_key: toText(hotspot.entry_kind_key, ""),
      sequence_kind_key: toText(hotspot.sequence_kind_key, ""),
      context_lookup_required:
        typeof hotspot.context_lookup_required === "boolean" ? hotspot.context_lookup_required : undefined,
      context_lookup_resolved:
        typeof hotspot.context_lookup_resolved === "boolean" ? hotspot.context_lookup_resolved : undefined,
      action_context_signature: toText(hotspot.action_context_signature, ""),
      risk_context_signature: toText(hotspot.risk_context_signature, ""),
      contract_ready: typeof hotspot.contract_ready === "boolean" ? hotspot.contract_ready : undefined,
      contract_state_key: toText(hotspot.contract_state_key, ""),
      contract_missing_keys: asList(hotspot.contract_missing_keys),
      action_context: asRecord(hotspot.action_context),
      risk_context: asRecord(hotspot.risk_context)
    });
    current.hotspot_count += 1;
    current.secondary_count += hotspot.is_secondary ? 1 : 0;
    current.energy = clamp(Math.max(current.energy, toNum(hotspot.energy, 0.2)), 0.08, 1);
    if (!hotspot.is_secondary && !current.label_key) {
      current.label = toText(hotspot.label, current.label);
      current.label_key = toText(hotspot.label_key, current.label_key);
      current.primary_hotspot_key = toText(hotspot.key, current.primary_hotspot_key);
      current.primary_action_key = toText(hotspot.action_key, current.primary_action_key);
      current.primary_hint_label_key = toText(hotspot.hint_label_key, current.primary_hint_label_key);
      current.primary_interaction_kind = toText(hotspot.interaction_kind, current.primary_interaction_kind);
    }
    if (hotspot.key === activeHotspotKey) {
      current.active_hotspot_key = hotspot.key;
      current.label = toText(hotspot.label, current.label);
      current.label_key = toText(hotspot.label_key, current.label_key);
    }
    grouped.set(clusterKey, current);
  });
  return Array.from(grouped.values()).map((cluster) => {
    const actor = actorMap.get(cluster.actor_key);
    const actionItems = asList(cluster.action_items)
      .filter((item) => toText(item.action_key, "") !== "")
      .sort((left, right) => {
        const leftSecondary = Boolean(left.is_secondary);
        const rightSecondary = Boolean(right.is_secondary);
        if (leftSecondary !== rightSecondary) {
          return leftSecondary ? 1 : -1;
        }
        return toText(left.label_key || left.label, "").localeCompare(toText(right.label_key || right.label, ""));
      });
    const intentSlots = actionItems.map((item, slotIndex) => ({
      ...item,
      slot_key: `${cluster.cluster_key}:${item.key}`,
      slot_index: slotIndex,
      slot_count: actionItems.length,
      band_key: item.is_secondary ? "outer" : "inner",
      orbit_scale: item.is_secondary ? 1.22 : 1,
      size_scalar: item.is_secondary ? 0.82 : 1,
      angle_offset_scalar: (Math.PI * 2 * slotIndex) / Math.max(1, actionItems.length)
    }));
    return {
      ...cluster,
      x: toNum(actor?.x, cluster.x),
      y: toNum(actor?.y, cluster.y + 0.44),
      z: toNum(actor?.z, cluster.z),
      orbit_radius: clamp(0.56 + cluster.hotspot_count * 0.18, 0.52, 1.28),
      is_active: cluster.active_hotspot_key !== "",
      action_items: actionItems,
      intent_slots: intentSlots
    };
  });
}

function actorEnergy(nodes, index, fallback = 0.3) {
  return clamp(toNum(nodes[index]?.energy, fallback), 0.08, 1);
}

function buildDistrictActors(districtKey, nodes, theme, ambientEnergy, lowEndMode) {
  const sharedGlow = theme.ring_secondary_hex;
  const sharedCore = theme.core_hex;

  switch (districtKey) {
    case "arena_prime":
      return [
        buildActor({
          key: "arena_crown_east",
          kind: "blade_tower",
          x: 4.25,
          y: 1.2,
          z: 0,
          width: 0.46,
          height: 2.8 + actorEnergy(nodes, 0, ambientEnergy),
          depth: 0.46,
          accentHex: theme.ring_hex,
          glowHex: sharedGlow,
          energy: actorEnergy(nodes, 0, ambientEnergy)
        }),
        buildActor({
          key: "arena_crown_west",
          kind: "blade_tower",
          x: -4.25,
          y: 1.1,
          z: 0,
          width: 0.42,
          height: 2.5 + actorEnergy(nodes, 1, ambientEnergy),
          depth: 0.42,
          accentHex: theme.ring_secondary_hex,
          glowHex: sharedCore,
          energy: actorEnergy(nodes, 1, ambientEnergy)
        }),
        buildActor({
          key: "arena_hazard_arc",
          kind: "arch",
          x: 0,
          y: 1.7,
          z: 0,
          width: 3.8,
          height: 3.8,
          depth: 0.18,
          accentHex: sharedGlow,
          glowHex: sharedGlow,
          energy: clamp(ambientEnergy + 0.08, 0.08, 1),
          rotationY: Math.PI / 2
        }),
        buildActor({
          key: "arena_spine",
          kind: "spine",
          x: 0,
          y: 1.15,
          z: -3.9,
          width: 0.28,
          height: 2 + actorEnergy(nodes, 2, ambientEnergy),
          depth: 0.28,
          accentHex: theme.light_hex,
          glowHex: sharedCore,
          energy: actorEnergy(nodes, 2, ambientEnergy)
        })
      ];
    case "mission_quarter":
      return [
        buildActor({
          key: "mission_terminal_alpha",
          kind: "terminal",
          x: -3.7,
          y: 0.9,
          z: -1.4,
          width: 0.9,
          height: 1.8,
          depth: 0.9,
          accentHex: theme.ring_hex,
          glowHex: sharedCore,
          energy: actorEnergy(nodes, 0, ambientEnergy)
        }),
        buildActor({
          key: "mission_terminal_beta",
          kind: "terminal",
          x: 3.7,
          y: 0.9,
          z: -1.1,
          width: 0.82,
          height: 1.65,
          depth: 0.82,
          accentHex: theme.ring_secondary_hex,
          glowHex: sharedGlow,
          energy: actorEnergy(nodes, 1, ambientEnergy)
        }),
        buildActor({
          key: "mission_contract_spine",
          kind: "spine",
          x: 0,
          y: 1.25,
          z: 3.95,
          width: 0.24,
          height: 2.2 + actorEnergy(nodes, 3, ambientEnergy),
          depth: 0.24,
          accentHex: theme.light_hex,
          glowHex: sharedCore,
          energy: actorEnergy(nodes, 3, ambientEnergy)
        })
      ];
    case "exchange_district":
      return [
        buildActor({
          key: "exchange_vault_west",
          kind: "vault",
          x: -4.05,
          y: 1.1,
          z: 0.6,
          width: 0.78,
          height: 2.2,
          depth: 0.78,
          accentHex: theme.ring_hex,
          glowHex: sharedCore,
          energy: actorEnergy(nodes, 0, ambientEnergy)
        }),
        buildActor({
          key: "exchange_vault_east",
          kind: "vault",
          x: 4.05,
          y: 1.1,
          z: -0.6,
          width: 0.78,
          height: 2.2,
          depth: 0.78,
          accentHex: theme.ring_secondary_hex,
          glowHex: sharedGlow,
          energy: actorEnergy(nodes, 1, ambientEnergy)
        }),
        buildActor({
          key: "exchange_route_rail",
          kind: "rail",
          x: 0,
          y: 0.45,
          z: 3.8,
          width: 5.8,
          height: 0.16,
          depth: 0.22,
          accentHex: theme.light_hex,
          glowHex: sharedGlow,
          energy: clamp(ambientEnergy + 0.06, 0.08, 1)
        }),
        buildActor({
          key: "exchange_pass_arc",
          kind: "arch",
          x: 0,
          y: 1.5,
          z: -3.6,
          width: 3.1,
          height: 3.1,
          depth: 0.16,
          accentHex: sharedGlow,
          glowHex: sharedCore,
          energy: actorEnergy(nodes, 2, ambientEnergy),
          rotationY: Math.PI / 6
        })
      ];
    case "ops_citadel":
      return [
        buildActor({
          key: "ops_watchtower_west",
          kind: "watchtower",
          x: -4.2,
          y: 1.25,
          z: -0.8,
          width: 0.64,
          height: 2.7 + actorEnergy(nodes, 0, ambientEnergy),
          depth: 0.64,
          accentHex: theme.ring_hex,
          glowHex: sharedGlow,
          energy: actorEnergy(nodes, 0, ambientEnergy)
        }),
        buildActor({
          key: "ops_watchtower_east",
          kind: "watchtower",
          x: 4.2,
          y: 1.2,
          z: 0.8,
          width: 0.6,
          height: 2.5 + actorEnergy(nodes, 1, ambientEnergy),
          depth: 0.6,
          accentHex: theme.ring_secondary_hex,
          glowHex: sharedCore,
          energy: actorEnergy(nodes, 1, ambientEnergy)
        }),
        buildActor({
          key: "ops_signal_array",
          kind: "array",
          x: 0,
          y: 1.05,
          z: -4.05,
          width: 3.6,
          height: 1.2,
          depth: 0.2,
          accentHex: theme.light_hex,
          glowHex: sharedGlow,
          energy: actorEnergy(nodes, 2, ambientEnergy)
        }),
        buildActor({
          key: "ops_audit_spine",
          kind: "spine",
          x: 0,
          y: 1.25,
          z: 4.1,
          width: 0.24,
          height: 2.4 + actorEnergy(nodes, 3, ambientEnergy),
          depth: 0.24,
          accentHex: sharedCore,
          glowHex: sharedCore,
          energy: actorEnergy(nodes, 3, ambientEnergy)
        })
      ];
    default:
      return [
        buildActor({
          key: "hub_gate_north",
          kind: "gate",
          x: 0,
          y: 1.1,
          z: -4.05,
          width: 3.2,
          height: 2.2,
          depth: 0.28,
          accentHex: theme.ring_hex,
          glowHex: sharedGlow,
          energy: actorEnergy(nodes, 0, ambientEnergy)
        }),
        buildActor({
          key: "hub_gate_south",
          kind: "gate",
          x: 0,
          y: 1.05,
          z: 4.05,
          width: 2.8,
          height: 2,
          depth: 0.24,
          accentHex: theme.ring_secondary_hex,
          glowHex: sharedCore,
          energy: actorEnergy(nodes, 1, ambientEnergy)
        }),
        buildActor({
          key: "hub_guidance_arch",
          kind: "arch",
          x: 0,
          y: 1.55,
          z: 0,
          width: 3.4,
          height: 3.4,
          depth: 0.14,
          accentHex: theme.light_hex,
          glowHex: sharedGlow,
          energy: clamp(ambientEnergy, 0.08, 1),
          rotationY: Math.PI / 8
        })
      ].slice(0, lowEndMode ? 2 : 3);
  }
}

function buildDistrictHotspots(districtKey, nodes, theme, ambientEnergy, lowEndMode, allowSecondaryHotspots) {
  const compactRadius = lowEndMode ? 0.34 : 0.42;
  const expanded = !lowEndMode && allowSecondaryHotspots;
  switch (districtKey) {
    case "arena_prime":
      return finalizeHotspots([
        buildHotspot({
          key: "duel_pit",
          label: "Duel Pit",
          labelKey: "world_hotspot_duel_pit",
          actionKey: nodes[0]?.action_key,
          actorKey: "arena_hazard_arc",
          interactionKind: "compete",
          hintLabelKey: "world_hotspot_hint_compete",
          x: 0,
          y: 0.2,
          z: 0.1,
          focusY: 0.9,
          cameraRadiusScale: 0.9,
          cameraBetaOffset: -0.02,
          radius: compactRadius + 0.06,
          accentHex: theme.ring_hex,
          energy: actorEnergy(nodes, 0, ambientEnergy)
        }),
        ...(expanded
          ? [
              buildHotspot({
                key: "arena_event_gate",
                label: "Event Gate",
                labelKey: "world_hotspot_arena_event_gate",
                actionKey: SHELL_ACTION_KEY.PLAYER_EVENTS_HALL,
                actorKey: "arena_hazard_arc",
                interactionKind: "travel",
                hintLabelKey: "world_hotspot_hint_travel",
                isSecondary: true,
                x: 1.1,
                y: 0.18,
                z: -1.15,
                focusY: 0.88,
                cameraRadiusScale: 0.94,
                cameraAlphaOffset: -0.08,
                cameraBetaOffset: -0.015,
                radius: compactRadius - 0.08,
                accentHex: theme.ring_secondary_hex,
                energy: actorEnergy(nodes, 0, ambientEnergy)
              })
            ]
          : []),
        buildHotspot({
          key: "ladder_bridge",
          label: "Ladder Bridge",
          labelKey: "world_hotspot_ladder_bridge",
          actionKey: nodes[1]?.action_key,
          actorKey: "arena_crown_east",
          interactionKind: "climb",
          hintLabelKey: "world_hotspot_hint_climb",
          x: 4.25,
          y: 0.18,
          z: 0.9,
          focusY: 0.84,
          cameraRadiusScale: 0.92,
          cameraAlphaOffset: 0.05,
          radius: compactRadius,
          accentHex: theme.ring_secondary_hex,
          energy: actorEnergy(nodes, 1, ambientEnergy)
        }),
        ...(expanded
          ? [
              buildHotspot({
                key: "ranking_orbit",
                label: "Ranking Orbit",
                labelKey: "world_hotspot_ranking_orbit",
                actionKey: SHELL_ACTION_KEY.PLAYER_PVP_LEADERBOARD,
                actorKey: "arena_crown_east",
                interactionKind: "review",
                hintLabelKey: "world_hotspot_hint_review",
                isSecondary: true,
                x: 3.3,
                y: 0.16,
                z: -0.95,
                focusY: 0.78,
                cameraRadiusScale: 0.97,
                cameraAlphaOffset: 0.08,
                cameraBetaOffset: 0.01,
                radius: compactRadius - 0.08,
                accentHex: theme.light_hex,
                energy: actorEnergy(nodes, 1, ambientEnergy)
              })
            ]
          : []),
        buildHotspot({
          key: "diagnostics_rail",
          label: "Diagnostics Rail",
          labelKey: "world_hotspot_diagnostics_rail",
          actionKey: nodes[2]?.action_key,
          actorKey: "arena_spine",
          interactionKind: "review",
          hintLabelKey: "world_hotspot_hint_review",
          x: 0,
          y: 0.14,
          z: -3.35,
          focusY: 0.72,
          cameraRadiusScale: 0.96,
          cameraAlphaOffset: -0.03,
          radius: compactRadius - 0.04,
          accentHex: theme.light_hex,
          energy: actorEnergy(nodes, 2, ambientEnergy)
        }),
        ...(expanded && nodes[3]?.action_key
          ? [
              buildHotspot({
                key: "tick_chamber",
                label: "Tick Chamber",
                labelKey: "world_hotspot_tick_chamber",
                actionKey: nodes[3]?.action_key,
                actorKey: "arena_spine",
                interactionKind: "launch",
                hintLabelKey: "world_hotspot_hint_launch",
                isSecondary: true,
                x: -1.15,
                y: 0.14,
                z: -2.65,
                focusY: 0.72,
                cameraRadiusScale: 1,
                cameraAlphaOffset: -0.11,
                radius: compactRadius - 0.1,
                accentHex: theme.ring_hex,
                energy: actorEnergy(nodes, 3, ambientEnergy)
              })
            ]
          : [])
      ]);
    case "mission_quarter":
      return finalizeHotspots([
        buildHotspot({
          key: "offer_desk",
          label: "Offer Desk",
          labelKey: "world_hotspot_offer_desk",
          actionKey: nodes[0]?.action_key,
          actorKey: "mission_terminal_alpha",
          interactionKind: "launch",
          hintLabelKey: "world_hotspot_hint_launch",
          x: -3.7,
          y: 0.12,
          z: -1.4,
          focusY: 0.78,
          cameraRadiusScale: 0.94,
          radius: compactRadius,
          accentHex: theme.ring_hex,
          energy: actorEnergy(nodes, 0, ambientEnergy)
        }),
        ...(expanded
          ? [
              buildHotspot({
                key: "briefing_arc",
                label: "Briefing Arc",
                labelKey: "world_hotspot_briefing_arc",
                actionKey: SHELL_ACTION_KEY.PLAYER_DISCOVER_CENTER,
                actorKey: "mission_terminal_alpha",
                interactionKind: "review",
                hintLabelKey: "world_hotspot_hint_review",
                isSecondary: true,
                x: -2.7,
                y: 0.12,
                z: -2.35,
                focusY: 0.8,
                cameraRadiusScale: 0.98,
                cameraAlphaOffset: -0.07,
                radius: compactRadius - 0.08,
                accentHex: theme.ring_secondary_hex,
                energy: actorEnergy(nodes, 0, ambientEnergy)
              })
            ]
          : []),
        buildHotspot({
          key: "streak_pulse",
          label: "Streak Pulse",
          labelKey: "world_hotspot_streak_pulse",
          actionKey: nodes[1]?.action_key,
          actorKey: "mission_terminal_beta",
          interactionKind: "track",
          hintLabelKey: "world_hotspot_hint_track",
          x: 3.7,
          y: 0.12,
          z: -1.1,
          focusY: 0.76,
          cameraRadiusScale: 0.95,
          radius: compactRadius - 0.02,
          accentHex: theme.ring_secondary_hex,
          energy: actorEnergy(nodes, 1, ambientEnergy)
        }),
        buildHotspot({
          key: "claim_dais",
          label: "Claim Dais",
          labelKey: "world_hotspot_claim_dais",
          actionKey: nodes[2]?.action_key,
          actorKey: "mission_contract_spine",
          interactionKind: "claim",
          hintLabelKey: "world_hotspot_hint_claim",
          x: 0,
          y: 0.14,
          z: 3.45,
          focusY: 0.78,
          cameraRadiusScale: 0.92,
          radius: compactRadius,
          accentHex: theme.light_hex,
          energy: actorEnergy(nodes, 2, ambientEnergy)
        }),
        ...(expanded && nodes[3]?.action_key
          ? [
              buildHotspot({
                key: "contract_pulse",
                label: "Contract Pulse",
                labelKey: "world_hotspot_contract_pulse",
                actionKey: nodes[3]?.action_key,
                actorKey: "mission_contract_spine",
                interactionKind: "track",
                hintLabelKey: "world_hotspot_hint_track",
                isSecondary: true,
                x: 1.05,
                y: 0.16,
                z: 2.55,
                focusY: 0.8,
                cameraRadiusScale: 0.98,
                cameraAlphaOffset: 0.09,
                radius: compactRadius - 0.08,
                accentHex: theme.ring_hex,
                energy: actorEnergy(nodes, 3, ambientEnergy)
              })
            ]
          : [])
      ]);
    case "exchange_district":
      return finalizeHotspots([
        buildHotspot({
          key: "wallet_dock",
          label: "Wallet Dock",
          labelKey: "world_hotspot_wallet_dock",
          actionKey: nodes[0]?.action_key,
          actorKey: "exchange_vault_west",
          interactionKind: "connect",
          hintLabelKey: "world_hotspot_hint_connect",
          x: -4.05,
          y: 0.14,
          z: 0.9,
          focusY: 0.78,
          cameraRadiusScale: 0.95,
          radius: compactRadius,
          accentHex: theme.ring_hex,
          energy: actorEnergy(nodes, 0, ambientEnergy)
        }),
        ...(expanded
          ? [
              buildHotspot({
                key: "rewards_vault",
                label: "Rewards Vault",
                labelKey: "world_hotspot_rewards_vault",
                actionKey: SHELL_ACTION_KEY.PLAYER_REWARDS_PANEL,
                actorKey: "exchange_vault_west",
                interactionKind: "claim",
                hintLabelKey: "world_hotspot_hint_claim",
                isSecondary: true,
                x: -2.9,
                y: 0.12,
                z: -0.8,
                focusY: 0.78,
                cameraRadiusScale: 1,
                cameraAlphaOffset: -0.08,
                radius: compactRadius - 0.08,
                accentHex: theme.ring_secondary_hex,
                energy: actorEnergy(nodes, 2, ambientEnergy)
              })
            ]
          : []),
        buildHotspot({
          key: "payout_bay",
          label: "Payout Bay",
          labelKey: "world_hotspot_payout_bay",
          actionKey: nodes[1]?.action_key,
          actorKey: "exchange_vault_east",
          interactionKind: "payout",
          hintLabelKey: "world_hotspot_hint_payout",
          x: 4.05,
          y: 0.14,
          z: -0.9,
          focusY: 0.82,
          cameraRadiusScale: 0.93,
          radius: compactRadius,
          accentHex: theme.ring_secondary_hex,
          energy: actorEnergy(nodes, 1, ambientEnergy)
        }),
        ...(expanded
          ? [
              buildHotspot({
                key: "support_bay",
                label: "Support Bay",
                labelKey: "world_hotspot_support_bay",
                actionKey: SHELL_ACTION_KEY.PLAYER_SUPPORT_STATUS,
                actorKey: "exchange_vault_east",
                interactionKind: "review",
                hintLabelKey: "world_hotspot_hint_review",
                isSecondary: true,
                x: 2.95,
                y: 0.14,
                z: 1.1,
                focusY: 0.78,
                cameraRadiusScale: 0.98,
                cameraAlphaOffset: 0.08,
                radius: compactRadius - 0.08,
                accentHex: theme.light_hex,
                energy: actorEnergy(nodes, 1, ambientEnergy)
              })
            ]
          : []),
        buildHotspot({
          key: "premium_lane",
          label: "Premium Lane",
          labelKey: "world_hotspot_premium_lane",
          actionKey: nodes[2]?.action_key,
          actorKey: "exchange_pass_arc",
          interactionKind: "upgrade",
          hintLabelKey: "world_hotspot_hint_upgrade",
          x: 0,
          y: 0.16,
          z: -3.1,
          focusY: 0.86,
          cameraRadiusScale: 0.9,
          radius: compactRadius - 0.02,
          accentHex: theme.light_hex,
          energy: actorEnergy(nodes, 2, ambientEnergy)
        })
      ]);
    case "ops_citadel":
      return finalizeHotspots([
        buildHotspot({
          key: "queue_gate",
          label: "Queue Gate",
          labelKey: "world_hotspot_queue_gate",
          actionKey: nodes[0]?.action_key,
          actorKey: "ops_watchtower_west",
          interactionKind: "review",
          hintLabelKey: "world_hotspot_hint_review",
          x: -4.15,
          y: 0.16,
          z: -0.2,
          focusY: 0.82,
          cameraRadiusScale: 0.96,
          radius: compactRadius,
          accentHex: theme.ring_hex,
          energy: actorEnergy(nodes, 0, ambientEnergy)
        }),
        ...(expanded
          ? [
              buildHotspot({
                key: "policy_lens",
                label: "Policy Lens",
                labelKey: "world_hotspot_policy_lens",
                actionKey: SHELL_ACTION_KEY.ADMIN_POLICY_PANEL,
                actorKey: "ops_watchtower_west",
                interactionKind: "review",
                hintLabelKey: "world_hotspot_hint_review",
                isSecondary: true,
                x: -2.9,
                y: 0.14,
                z: 1.15,
                focusY: 0.8,
                cameraRadiusScale: 0.99,
                cameraAlphaOffset: -0.08,
                radius: compactRadius - 0.08,
                accentHex: theme.ring_secondary_hex,
                energy: actorEnergy(nodes, 0, ambientEnergy)
              })
            ]
          : []),
        buildHotspot({
          key: "runtime_dais",
          label: "Runtime Dais",
          labelKey: "world_hotspot_runtime_dais",
          actionKey: nodes[1]?.action_key,
          actorKey: "ops_watchtower_east",
          interactionKind: "monitor",
          hintLabelKey: "world_hotspot_hint_monitor",
          x: 4.15,
          y: 0.16,
          z: 0.2,
          focusY: 0.84,
          cameraRadiusScale: 0.94,
          radius: compactRadius,
          accentHex: theme.ring_secondary_hex,
          energy: actorEnergy(nodes, 1, ambientEnergy)
        }),
        ...(expanded
          ? [
              buildHotspot({
                key: "flags_console",
                label: "Flags Console",
                labelKey: "world_hotspot_flags_console",
                actionKey: SHELL_ACTION_KEY.ADMIN_RUNTIME_FLAGS,
                actorKey: "ops_watchtower_east",
                interactionKind: "monitor",
                hintLabelKey: "world_hotspot_hint_monitor",
                isSecondary: true,
                x: 2.95,
                y: 0.14,
                z: -1.05,
                focusY: 0.8,
                cameraRadiusScale: 1,
                cameraAlphaOffset: 0.08,
                radius: compactRadius - 0.08,
                accentHex: theme.light_hex,
                energy: actorEnergy(nodes, 1, ambientEnergy)
              })
            ]
          : []),
        buildHotspot({
          key: "liveops_table",
          label: "LiveOps Table",
          labelKey: "world_hotspot_liveops_table",
          actionKey: nodes[2]?.action_key,
          actorKey: "ops_signal_array",
          interactionKind: "dispatch",
          hintLabelKey: "world_hotspot_hint_dispatch",
          x: 0,
          y: 0.16,
          z: -3.45,
          focusY: 0.86,
          cameraRadiusScale: 0.92,
          radius: compactRadius - 0.02,
          accentHex: theme.light_hex,
          energy: actorEnergy(nodes, 2, ambientEnergy)
        }),
        ...(expanded
          ? [
              buildHotspot({
                key: "bot_relay",
                label: "Bot Relay",
                labelKey: "world_hotspot_bot_relay",
                actionKey: SHELL_ACTION_KEY.ADMIN_RUNTIME_BOT,
                actorKey: "ops_signal_array",
                interactionKind: "monitor",
                hintLabelKey: "world_hotspot_hint_monitor",
                isSecondary: true,
                x: 1.05,
                y: 0.15,
                z: -2.35,
                focusY: 0.84,
                cameraRadiusScale: 0.98,
                cameraAlphaOffset: 0.1,
                radius: compactRadius - 0.08,
                accentHex: theme.ring_hex,
                energy: actorEnergy(nodes, 2, ambientEnergy)
              })
            ]
          : [])
      ]);
    default:
      return finalizeHotspots([
        buildHotspot({
          key: "season_gate",
          label: "Season Gate",
          labelKey: "world_hotspot_season_gate",
          actionKey: nodes[0]?.action_key,
          actorKey: "hub_gate_north",
          interactionKind: "travel",
          hintLabelKey: "world_hotspot_hint_travel",
          x: 0,
          y: 0.16,
          z: -3.45,
          focusY: 0.8,
          cameraRadiusScale: 0.92,
          radius: compactRadius,
          accentHex: theme.ring_hex,
          energy: actorEnergy(nodes, 0, ambientEnergy)
        }),
        ...(expanded
          ? [
              buildHotspot({
                key: "events_portal",
                label: "Events Portal",
                labelKey: "world_hotspot_events_portal",
                actionKey: SHELL_ACTION_KEY.PLAYER_EVENTS_HALL,
                actorKey: "hub_gate_north",
                interactionKind: "travel",
                hintLabelKey: "world_hotspot_hint_travel",
                isSecondary: true,
                x: 1.2,
                y: 0.16,
                z: -2.55,
                focusY: 0.8,
                cameraRadiusScale: 0.98,
                cameraAlphaOffset: -0.08,
                radius: compactRadius - 0.08,
                accentHex: theme.ring_secondary_hex,
                energy: actorEnergy(nodes, 0, ambientEnergy)
              })
            ]
          : []),
        buildHotspot({
          key: "mission_desk",
          label: "Mission Desk",
          labelKey: "world_hotspot_mission_desk",
          actionKey: nodes[1]?.action_key,
          actorKey: "hub_guidance_arch",
          interactionKind: "launch",
          hintLabelKey: "world_hotspot_hint_launch",
          x: -2.35,
          y: 0.16,
          z: 1.55,
          focusY: 0.76,
          cameraRadiusScale: 0.96,
          radius: compactRadius - 0.02,
          accentHex: theme.ring_secondary_hex,
          energy: actorEnergy(nodes, 1, ambientEnergy)
        }),
        ...(expanded
          ? [
              buildHotspot({
                key: "discover_arc",
                label: "Discover Arc",
                labelKey: "world_hotspot_discover_arc",
                actionKey: SHELL_ACTION_KEY.PLAYER_DISCOVER_CENTER,
                actorKey: "hub_guidance_arch",
                interactionKind: "review",
                hintLabelKey: "world_hotspot_hint_review",
                isSecondary: true,
                x: -1.15,
                y: 0.16,
                z: 2.35,
                focusY: 0.78,
                cameraRadiusScale: 0.98,
                cameraAlphaOffset: 0.08,
                radius: compactRadius - 0.08,
                accentHex: theme.light_hex,
                energy: actorEnergy(nodes, 1, ambientEnergy)
              })
            ]
          : []),
        buildHotspot({
          key: "wallet_port",
          label: "Wallet Port",
          labelKey: "world_hotspot_wallet_port",
          actionKey: nodes[2]?.action_key,
          actorKey: "hub_gate_south",
          interactionKind: "connect",
          hintLabelKey: "world_hotspot_hint_connect",
          x: 2.35,
          y: 0.16,
          z: 1.55,
          focusY: 0.76,
          cameraRadiusScale: 0.96,
          radius: compactRadius - 0.02,
          accentHex: theme.light_hex,
          energy: actorEnergy(nodes, 2, ambientEnergy)
        }),
        ...(expanded
          ? [
              buildHotspot({
                key: "rewards_cache",
                label: "Rewards Cache",
                labelKey: "world_hotspot_rewards_cache",
                actionKey: SHELL_ACTION_KEY.PLAYER_REWARDS_PANEL,
                actorKey: "hub_gate_south",
                interactionKind: "claim",
                hintLabelKey: "world_hotspot_hint_claim",
                isSecondary: true,
                x: 1.15,
                y: 0.16,
                z: 2.35,
                focusY: 0.78,
                cameraRadiusScale: 0.98,
                cameraAlphaOffset: -0.08,
                radius: compactRadius - 0.08,
                accentHex: theme.ring_hex,
                energy: actorEnergy(nodes, 2, ambientEnergy)
              })
            ]
          : [])
      ]);
  }
}

function resolveFallbackActiveNodeKey(workspace, tab) {
  if (workspace === "admin") {
    return "queue_bastion";
  }
  if (tab === "pvp") {
    return "duel_core";
  }
  if (tab === "tasks") {
    return "offers_terminal";
  }
  if (tab === "vault") {
    return "wallet_gate";
  }
  return "season_arc";
}

function resolveActiveNodeKey(nodes, navigationContext, workspace, tab) {
  const context = asRecord(navigationContext);
  const actionKey = toText(context.shell_action_key || context.action_key || "");
  if (actionKey) {
    const byAction = nodes.find((node) => node.action_key === actionKey);
    if (byAction) {
      return byAction.key;
    }
  }

  const panelKey = toText(context.panel_key || "");
  if (panelKey) {
    const byPanel = nodes.find((node) => panelKey.includes(String(node.laneKey || "")) || String(node.laneKey || "").includes(panelKey));
    if (byPanel) {
      return byPanel.key;
    }
  }

  return resolveFallbackActiveNodeKey(workspace, tab);
}

function resolveActiveHotspotKey(hotspots, navigationContext, activeNode) {
  const context = asRecord(navigationContext);
  const actionKey = toText(context.shell_action_key || context.action_key || activeNode?.action_key || "");
  if (actionKey) {
    const byAction = hotspots.find((hotspot) => hotspot.action_key === actionKey);
    if (byAction) {
      return byAction.key;
    }
  }
  return toText(hotspots[0]?.key, "");
}

function buildPlayerHomeNodes(input) {
  const homeFeed = asRecord(input.homeFeed);
  const season = asRecord(homeFeed.season);
  const mission = asRecord(homeFeed.mission);
  const walletQuick = asRecord(homeFeed.wallet_quick);
  const risk = asRecord(homeFeed.risk);
  const commandHints = asList(homeFeed.command_hint);
  const seasonEnergy = clamp(
    Math.max(
      pickNumber(season, ["progress_pct", "progress", "completion_pct"], 0) / 100,
      pickNumber(season, ["heat_pct", "power_pct"], 0) / 100,
      commandHints.length ? 0.36 : 0.2
    ),
    0.18,
    1
  );
  const missionEnergy = clamp(
    Math.max(
      pickNumber(mission, ["active_count", "offer_count", "pending_count"], 0) / 5,
      pickNumber(mission, ["completion_pct"], 0) / 100
    ),
    0.16,
    1
  );
  const walletEnergy = clamp(
    pickTruthy(walletQuick, ["linked", "wallet_linked", "active"]) ? 0.72 : 0.28,
    0.18,
    1
  );
  const riskEnergy = clamp(
    Math.max(
      pickNumber(risk, ["score_pct", "heat_pct"], 0) / 100,
      ["warn", "review", "high"].includes(toText(risk.band || risk.state || "").toLowerCase()) ? 0.72 : 0.24
    ),
    0.12,
    1
  );
  return [
    buildNode({
      key: "season_arc",
      laneKey: "season",
      label: "Season Arc",
      labelKey: "world_node_season_arc",
      metric: `${Math.round(seasonEnergy * 100)}%`,
      actionKey: SHELL_ACTION_KEY.PLAYER_SEASON_HALL,
      energy: seasonEnergy
    }),
    buildNode({
      key: "mission_lane",
      laneKey: "tasks",
      label: "Mission Lane",
      labelKey: "world_node_mission_lane",
      metric: `${Math.round(missionEnergy * 100)}%`,
      actionKey: SHELL_ACTION_KEY.PLAYER_TASKS_BOARD,
      energy: missionEnergy
    }),
    buildNode({
      key: "wallet_lane",
      laneKey: "vault",
      label: "Wallet Lane",
      labelKey: "world_node_wallet_lane",
      metric: pickTruthy(walletQuick, ["linked", "wallet_linked", "active"]) ? "LIVE" : "LOCKED",
      actionKey: SHELL_ACTION_KEY.PLAYER_WALLET_CONNECT,
      energy: walletEnergy
    }),
    buildNode({
      key: "risk_lane",
      laneKey: "risk",
      label: "Risk Pulse",
      labelKey: "world_node_risk_lane",
      metric: toText(risk.band || risk.state || "stable").toUpperCase(),
      actionKey: SHELL_ACTION_KEY.PLAYER_SUPPORT_STATUS,
      energy: riskEnergy,
      statusKey: riskEnergy >= 0.7 ? "warn" : "good"
    })
  ];
}

function buildPlayerPvpNodes(input) {
  const pvpRuntime = asRecord(input.pvpRuntime);
  const leagueOverview = asRecord(input.leagueOverview);
  const pvpLive = asRecord(input.pvpLive);
  const session = asRecord(pvpRuntime.session || pvpRuntime);
  const dailyDuel = asRecord(leagueOverview.daily_duel);
  const weeklyLadder = asRecord(leagueOverview.weekly_ladder);
  const diagnostics = asRecord(pvpLive.diagnostics);
  const tick = asRecord(pvpLive.tick);
  return [
    buildNode({
      key: "duel_core",
      laneKey: "pvp_daily_duel",
      label: "Daily Duel",
      labelKey: "world_node_duel_core",
      metric: toText(session.phase || dailyDuel.phase || "idle").toUpperCase(),
      actionKey: SHELL_ACTION_KEY.PLAYER_PVP_DAILY_DUEL,
      energy: clamp(Math.max(pickNumber(session, ["tempo_pct", "pressure_pct"], 0) / 100, 0.44), 0.18, 1)
    }),
    buildNode({
      key: "ladder_spire",
      laneKey: "pvp_weekly_ladder",
      label: "Weekly Ladder",
      labelKey: "world_node_ladder_spire",
      metric: `${Math.round(clamp(pickNumber(weeklyLadder, ["completion_pct", "rank_progress_pct"], 36) / 100, 0.18, 1) * 100)}%`,
      actionKey: SHELL_ACTION_KEY.PLAYER_PVP_WEEKLY_LADDER,
      energy: clamp(Math.max(pickNumber(weeklyLadder, ["completion_pct", "rank_progress_pct"], 0) / 100, 0.36), 0.18, 1)
    }),
    buildNode({
      key: "diagnostic_array",
      laneKey: "pvp_diagnostics",
      label: "Diagnostics",
      labelKey: "world_node_diagnostic_array",
      metric: toText(diagnostics.category || diagnostics.state || "clean").toUpperCase(),
      actionKey: SHELL_ACTION_KEY.PLAYER_PVP_LEADERBOARD,
      energy: clamp(Math.max(pickNumber(diagnostics, ["risk_pct", "reject_pct"], 0) / 100, 0.24), 0.12, 1),
      statusKey: toText(diagnostics.category || diagnostics.state || "").toLowerCase().includes("clean") ? "good" : ""
    }),
    buildNode({
      key: "tick_theater",
      laneKey: "pvp_tick",
      label: "Tick Theater",
      labelKey: "world_node_tick_theater",
      metric: `${Math.max(0, Math.round(pickNumber(tick, ["tempo_ms", "tick_ms"], 0)))}ms`,
      actionKey: SHELL_ACTION_KEY.PLAYER_PVP_DAILY_DUEL,
      energy: clamp(Math.max(1 - pickNumber(tick, ["tempo_ms", "tick_ms"], 1000) / 1400, 0.22), 0.12, 1)
    })
  ];
}

function buildPlayerTasksNodes(input) {
  const taskResult = asRecord(input.taskResult);
  const homeFeed = asRecord(input.homeFeed);
  const mission = asRecord(homeFeed.mission);
  const daily = asRecord(homeFeed.daily);
  const contract = asRecord(homeFeed.contract);
  return [
    buildNode({
      key: "offers_terminal",
      laneKey: "tasks_offers",
      label: "Offer Grid",
      labelKey: "world_node_offers_terminal",
      metric: String(Math.max(0, pickNumber(taskResult, ["offer_count", "offers_count"], pickNumber(mission, ["offer_count", "active_count"], 0)))),
      actionKey: SHELL_ACTION_KEY.PLAYER_TASKS_BOARD,
      energy: clamp(Math.max(pickNumber(taskResult, ["offer_count", "offers_count"], pickNumber(mission, ["offer_count", "active_count"], 0)) / 4, 0.24), 0.12, 1)
    }),
    buildNode({
      key: "streak_tower",
      laneKey: "daily_streak",
      label: "Streak Tower",
      labelKey: "world_node_streak_tower",
      metric: `${Math.max(0, Math.round(pickNumber(daily, ["streak_days", "streak"], 0)))}d`,
      actionKey: SHELL_ACTION_KEY.PLAYER_TASKS_BOARD,
      energy: clamp(Math.max(pickNumber(daily, ["streak_days", "streak"], 0) / 7, 0.18), 0.12, 1)
    }),
    buildNode({
      key: "claim_bridge",
      laneKey: "mission_claim",
      label: "Claim Bridge",
      labelKey: "world_node_claim_bridge",
      metric: String(Math.max(0, pickNumber(taskResult, ["claimable_count"], pickNumber(mission, ["claimable_count"], 0)))),
      actionKey: SHELL_ACTION_KEY.PLAYER_TASKS_CLAIMS,
      energy: clamp(Math.max(pickNumber(taskResult, ["claimable_count"], pickNumber(mission, ["claimable_count"], 0)) / 3, 0.18), 0.12, 1)
    }),
    buildNode({
      key: "contract_spire",
      laneKey: "contract",
      label: "Contract Pulse",
      labelKey: "world_node_contract_spire",
      metric: toText(contract.band || contract.state || "open").toUpperCase(),
      actionKey: SHELL_ACTION_KEY.PLAYER_TASKS_CLAIMS,
      energy: clamp(Math.max(pickNumber(contract, ["completion_pct", "heat_pct"], 0) / 100, 0.28), 0.12, 1)
    })
  ];
}

function buildPlayerVaultNodes(input) {
  const vaultData = asRecord(input.vaultData);
  const walletSession = asRecord(vaultData.wallet_session);
  const payoutStatus = asRecord(vaultData.payout_status);
  const monetization = asRecord(vaultData.monetization_status);
  const routeStatus = asRecord(vaultData.route_status);
  return [
    buildNode({
      key: "wallet_gate",
      laneKey: "wallet",
      label: "Wallet Gate",
      labelKey: "world_node_wallet_gate",
      metric: pickTruthy(walletSession, ["active", "linked"]) ? "LIVE" : "OPEN",
      actionKey: SHELL_ACTION_KEY.PLAYER_WALLET_CONNECT,
      energy: pickTruthy(walletSession, ["active", "linked"]) ? 0.78 : 0.32
    }),
    buildNode({
      key: "payout_lift",
      laneKey: "payout",
      label: "Payout Lift",
      labelKey: "world_node_payout_lift",
      metric: toText(payoutStatus.state || payoutStatus.status || "idle").toUpperCase(),
      actionKey: SHELL_ACTION_KEY.PLAYER_PAYOUT_REQUEST,
      energy: clamp(Math.max(pickNumber(payoutStatus, ["readiness_pct", "eligible_pct"], 0) / 100, 0.24), 0.12, 1)
    }),
    buildNode({
      key: "premium_arcade",
      laneKey: "premium",
      label: "Premium Pass",
      labelKey: "world_node_premium_arcade",
      metric: pickTruthy(monetization, ["pass_active", "active", "premium_active"]) ? "ACTIVE" : "READY",
      actionKey: SHELL_ACTION_KEY.PLAYER_REWARDS_PANEL,
      energy: pickTruthy(monetization, ["pass_active", "active", "premium_active"]) ? 0.7 : 0.3
    }),
    buildNode({
      key: "route_engine",
      laneKey: "route",
      label: "Route Engine",
      labelKey: "world_node_route_engine",
      metric: toText(routeStatus.state || routeStatus.health || "ready").toUpperCase(),
      actionKey: SHELL_ACTION_KEY.PLAYER_REWARDS_PANEL,
      energy: clamp(Math.max(pickNumber(routeStatus, ["coverage_pct", "completion_pct"], 0) / 100, 0.26), 0.12, 1)
    })
  ];
}

function buildAdminNodes(input) {
  const adminRuntime = asRecord(input.adminRuntime);
  const summary = asRecord(adminRuntime.summary);
  const queue = asList(adminRuntime.queue);
  const queueCount = queue.length;
  const schedulerState = toText(summary.live_ops_scheduler_state || summary.scheduler_state || "ready");
  const sceneHealth = toText(summary.scene_runtime_health_band_24h || summary.scene_health_band || "clear");
  return [
    buildNode({
      key: "queue_bastion",
      laneKey: "admin_queue",
      label: "Queue Bastion",
      labelKey: "world_node_queue_bastion",
      metric: String(queueCount),
      actionKey: SHELL_ACTION_KEY.ADMIN_QUEUE_PANEL,
      energy: clamp(Math.max(queueCount / 8, 0.22), 0.12, 1),
      statusKey: queueCount >= 6 ? "warn" : ""
    }),
    buildNode({
      key: "runtime_core",
      laneKey: "admin_runtime",
      label: "Runtime Core",
      labelKey: "world_node_runtime_core",
      metric: sceneHealth.toUpperCase(),
      actionKey: SHELL_ACTION_KEY.ADMIN_RUNTIME_META,
      energy: clamp(Math.max(pickNumber(summary, ["scene_runtime_ready_rate_24h"], 0) / 100, 0.34), 0.12, 1),
      statusKey: sceneHealth === "alert" ? "hot" : sceneHealth === "watch" ? "warn" : "good"
    }),
    buildNode({
      key: "liveops_spine",
      laneKey: "admin_liveops",
      label: "LiveOps Spine",
      labelKey: "world_node_liveops_spine",
      metric: schedulerState.toUpperCase(),
      actionKey: SHELL_ACTION_KEY.ADMIN_LIVE_OPS_PANEL,
      energy: clamp(Math.max(pickNumber(summary, ["live_ops_sent_24h", "sent_24h"], 0) / 20, 0.24), 0.12, 1)
    }),
    buildNode({
      key: "audit_orbit",
      laneKey: "admin_audit",
      label: "Audit Orbit",
      labelKey: "world_node_audit_orbit",
      metric: String(Math.max(0, pickNumber(summary, ["ops_alert_raised_24h", "alerts_24h"], 0))),
      actionKey: SHELL_ACTION_KEY.ADMIN_RUNTIME_META,
      energy: clamp(Math.max(pickNumber(summary, ["ops_alert_raised_24h", "alerts_24h"], 0) / 5, 0.18), 0.12, 1),
      statusKey: pickNumber(summary, ["ops_alert_raised_24h", "alerts_24h"], 0) > 0 ? "warn" : "good"
    })
  ];
}

function metricRow(labelKey, value) {
  const text = toText(value, "");
  if (!text) {
    return null;
  }
  return {
    label_key: labelKey,
    value: text
  };
}

function percentText(value) {
  const parsed = toNum(value, Number.NaN);
  if (!Number.isFinite(parsed)) {
    return "";
  }
  return `${Math.max(0, Math.round(parsed))}%`;
}

function countText(value) {
  const parsed = toNum(value, Number.NaN);
  if (!Number.isFinite(parsed)) {
    return "";
  }
  return String(Math.max(0, Math.round(parsed)));
}

function upperText(value) {
  return toText(value, "").toUpperCase();
}

function buildDistrictInteractionSheet(input, districtKey, activeHotspot, activeCluster) {
  if (!activeHotspot) {
    return null;
  }

  const homeFeed = asRecord(input.homeFeed);
  const season = asRecord(homeFeed.season);
  const mission = asRecord(homeFeed.mission);
  const walletQuick = asRecord(homeFeed.wallet_quick);
  const risk = asRecord(homeFeed.risk);
  const daily = asRecord(homeFeed.daily);
  const contract = asRecord(homeFeed.contract);
  const taskResult = asRecord(input.taskResult);
  const pvpRuntime = asRecord(input.pvpRuntime);
  const leagueOverview = asRecord(input.leagueOverview);
  const dailyDuel = asRecord(leagueOverview.daily_duel);
  const weeklyLadder = asRecord(leagueOverview.weekly_ladder);
  const pvpLive = asRecord(input.pvpLive);
  const diagnostics = asRecord(pvpLive.diagnostics);
  const tick = asRecord(pvpLive.tick);
  const vaultData = asRecord(input.vaultData);
  const walletSession = asRecord(vaultData.wallet_session);
  const payoutStatus = asRecord(vaultData.payout_status);
  const monetization = asRecord(vaultData.monetization_status);
  const routeStatus = asRecord(vaultData.route_status);
  const adminRuntime = asRecord(input.adminRuntime);
  const summary = asRecord(adminRuntime.summary);
  const queue = asList(adminRuntime.queue);

  let rows = [];
  let variantKey = districtKey;

  switch (districtKey) {
    case "arena_prime":
      rows = [
        metricRow("world_sheet_metric_duel_phase", upperText(pvpRuntime.phase || dailyDuel.phase)),
        metricRow("world_sheet_metric_ladder_charge", percentText(weeklyLadder.completion_pct || weeklyLadder.rank_progress_pct)),
        metricRow("world_sheet_metric_diag_band", upperText(diagnostics.category || diagnostics.state)),
        metricRow("world_sheet_metric_tick_tempo", toNum(tick.tempo_ms || tick.tick_ms, Number.NaN) ? `${Math.round(toNum(tick.tempo_ms || tick.tick_ms, 0))}ms` : "")
      ].filter(Boolean);
      break;
    case "mission_quarter":
      rows = [
        metricRow("world_sheet_metric_offer_count", countText(taskResult.offer_count || taskResult.offers_count || mission.offer_count || mission.active_count)),
        metricRow("world_sheet_metric_streak", countText(daily.streak_days || daily.streak) ? `${countText(daily.streak_days || daily.streak)}d` : ""),
        metricRow("world_sheet_metric_claimable", countText(taskResult.claimable_count || mission.claimable_count)),
        metricRow("world_sheet_metric_contract_band", upperText(contract.band || contract.state))
      ].filter(Boolean);
      break;
    case "exchange_district":
      rows = [
        metricRow("world_sheet_metric_wallet_state", pickTruthy(walletSession, ["active", "linked"]) ? "LIVE" : "OPEN"),
        metricRow("world_sheet_metric_payout_state", upperText(payoutStatus.state || payoutStatus.status)),
        metricRow(
          "world_sheet_metric_premium_state",
          pickTruthy(monetization, ["pass_active", "active", "premium_active"]) ? "ACTIVE" : "READY"
        ),
        metricRow("world_sheet_metric_route_state", upperText(routeStatus.state || routeStatus.health))
      ].filter(Boolean);
      break;
    case "ops_citadel":
      rows = [
        metricRow("world_sheet_metric_queue_depth", countText(queue.length)),
        metricRow("world_sheet_metric_scene_health", upperText(summary.scene_runtime_health_band_24h || summary.scene_health_band)),
        metricRow("world_sheet_metric_liveops_sent", countText(summary.live_ops_sent_24h || summary.sent_24h)),
        metricRow("world_sheet_metric_alerts", countText(summary.ops_alert_raised_24h || summary.alerts_24h))
      ].filter(Boolean);
      break;
    default:
      rows = [
        metricRow("world_sheet_metric_progress", percentText(season.progress_pct || season.progress || season.completion_pct)),
        metricRow("world_sheet_metric_active_missions", countText(mission.active_count || mission.offer_count)),
        metricRow("world_sheet_metric_wallet_state", pickTruthy(walletQuick, ["linked", "wallet_linked", "active"]) ? "LIVE" : "OPEN"),
        metricRow("world_sheet_metric_risk_band", upperText(risk.band || risk.state))
      ].filter(Boolean);
      variantKey = "central_hub";
      break;
  }

  return {
    sheet_key: `${districtKey}:${toText(activeHotspot.key, "sheet")}`,
    variant_key: variantKey,
    title_key: toText(activeHotspot.label_key, ""),
    title: toText(activeHotspot.label, ""),
    intent_label_key: toText(activeHotspot.intent_profile?.intent_label_key, ""),
    intent_tone_key: toText(activeHotspot.intent_profile?.intent_tone_key, ""),
    cluster_label_key: toText(activeCluster?.label_key, ""),
    cluster_label: toText(activeCluster?.label, ""),
    rows
  };
}

function resolveDistrictInteractionSurfaceKind(districtKey, activeHotspot) {
  const hotspotKey = toText(activeHotspot?.key, "");
  switch (districtKey) {
    case "arena_prime":
      return {
        surface_kind_key: "world_surface_kind_arena_console",
        surface_class_key: "arena_console"
      };
    case "mission_quarter":
      if (hotspotKey === "claim_dais") {
        return {
          surface_kind_key: "world_surface_kind_loot_reveal",
          surface_class_key: "loot_reveal"
        };
      }
      return {
        surface_kind_key: "world_surface_kind_contract_terminal",
        surface_class_key: "contract_terminal"
      };
    case "exchange_district":
      if (hotspotKey === "rewards_vault") {
        return {
          surface_kind_key: "world_surface_kind_loot_reveal",
          surface_class_key: "loot_reveal"
        };
      }
      if (hotspotKey === "premium_lane") {
        return {
          surface_kind_key: "world_surface_kind_premium_terminal",
          surface_class_key: "premium_terminal"
        };
      }
      return {
        surface_kind_key: "world_surface_kind_vault_terminal",
        surface_class_key: "vault_terminal"
      };
    case "ops_citadel":
      if (hotspotKey === "liveops_table") {
        return {
          surface_kind_key: "world_surface_kind_dispatch_console",
          surface_class_key: "dispatch_console"
        };
      }
      return {
        surface_kind_key: "world_surface_kind_ops_console",
        surface_class_key: "ops_console"
      };
    default:
      if (hotspotKey === "rewards_cache") {
        return {
          surface_kind_key: "world_surface_kind_loot_reveal",
          surface_class_key: "loot_reveal"
        };
      }
      return {
        surface_kind_key: "world_surface_kind_travel_portal",
        surface_class_key: "travel_portal"
      };
  }
}

function buildDistrictInteractionSurface(districtKey, activeHotspot, activeCluster, interactionSheet) {
  if (!activeHotspot || !activeCluster || !interactionSheet?.rows?.length) {
    return null;
  }

  const surfaceKind = resolveDistrictInteractionSurfaceKind(districtKey, activeHotspot);
  const actions = asList(activeCluster.action_items)
    .filter((item) => toText(item.action_key, ""))
    .slice(0, 3)
    .map((item, index) => ({
      ...item,
      surface_slot_key: `${toText(activeHotspot.key, "surface")}:${toText(item.key, index)}`,
      is_primary_surface_action: index === 0
    }));
  const heroRow = interactionSheet.rows[0] || null;
  const supportRow = interactionSheet.rows[1] || null;

  return {
    surface_key: `${districtKey}:${toText(activeHotspot.key, "surface")}`,
    surface_kind_key: surfaceKind.surface_kind_key,
    surface_class_key: surfaceKind.surface_class_key,
    variant_key: districtKey,
    title_key: toText(activeHotspot.label_key, ""),
    title: toText(activeHotspot.label, ""),
    hint_label_key: toText(activeHotspot.hint_label_key, ""),
    intent_label_key: toText(activeHotspot.intent_profile?.intent_label_key, ""),
    intent_tone_key: toText(activeHotspot.intent_profile?.intent_tone_key, ""),
    cluster_label_key: toText(activeCluster.label_key, ""),
    cluster_label: toText(activeCluster.label, ""),
    hero_label_key: toText(heroRow?.label_key, ""),
    hero_value: toText(heroRow?.value, ""),
    support_label_key: toText(supportRow?.label_key, ""),
    support_value: toText(supportRow?.value, ""),
    action_items: actions,
    action_count: actions.length
  };
}

function resolveFlowStatusKey(value, fallback = "idle") {
  const key = toText(value, "").toLowerCase();
  if (!key) {
    return fallback;
  }
  if (key.includes("alert") || key.includes("hot") || key.includes("blocked") || key.includes("reject")) {
    return "alert";
  }
  if (key.includes("watch") || key.includes("warn") || key.includes("review") || key.includes("hold")) {
    return "watch";
  }
  if (key.includes("lock") || key.includes("expired") || key.includes("off")) {
    return "locked";
  }
  if (key.includes("live") || key.includes("claim") || key.includes("active") || key.includes("dispatch") || key.includes("strike")) {
    return "live";
  }
  if (key.includes("ready") || key.includes("clear") || key.includes("clean") || key.includes("open") || key.includes("stable")) {
    return "ready";
  }
  return fallback;
}

function flowStatusLabelKey(statusKey) {
  switch (statusKey) {
    case "alert":
      return "world_flow_state_alert";
    case "watch":
      return "world_flow_state_watch";
    case "locked":
      return "world_flow_state_locked";
    case "live":
      return "world_flow_state_live";
    case "ready":
      return "world_flow_state_ready";
    default:
      return "world_flow_state_idle";
  }
}

function buildFlowStep(labelKey, value, statusKey = "ready") {
  const text = toText(value, "");
  if (!text) {
    return null;
  }
  return {
    label_key: labelKey,
    value: text,
    status_key: statusKey
  };
}

function buildDistrictInteractionFlow(input, districtKey, activeHotspot, interactionSheet) {
  if (!activeHotspot || !interactionSheet?.rows?.length) {
    return null;
  }

  const homeFeed = asRecord(input.homeFeed);
  const season = asRecord(homeFeed.season);
  const mission = asRecord(homeFeed.mission);
  const walletQuick = asRecord(homeFeed.wallet_quick);
  const risk = asRecord(homeFeed.risk);
  const daily = asRecord(homeFeed.daily);
  const contract = asRecord(homeFeed.contract);
  const taskResult = asRecord(input.taskResult);
  const pvpRuntime = asRecord(input.pvpRuntime);
  const leagueOverview = asRecord(input.leagueOverview);
  const dailyDuel = asRecord(leagueOverview.daily_duel);
  const weeklyLadder = asRecord(leagueOverview.weekly_ladder);
  const pvpLive = asRecord(input.pvpLive);
  const diagnostics = asRecord(pvpLive.diagnostics);
  const tick = asRecord(pvpLive.tick);
  const vaultData = asRecord(input.vaultData);
  const walletSession = asRecord(vaultData.wallet_session);
  const payoutStatus = asRecord(vaultData.payout_status);
  const monetization = asRecord(vaultData.monetization_status);
  const routeStatus = asRecord(vaultData.route_status);
  const adminRuntime = asRecord(input.adminRuntime);
  const summary = asRecord(adminRuntime.summary);
  const queue = asList(adminRuntime.queue);
  const hotspotKey = toText(activeHotspot.key, "");

  let flowKindKey = "world_flow_kind_travel";
  let stageStatusKey = "idle";
  let readinessStatusKey = "ready";
  let tempoLabelKey = "world_flow_tempo_label";
  let tempoValue = "";
  let steps = [];

  switch (districtKey) {
    case "arena_prime": {
      const duelPhase = toText(pvpRuntime.phase || dailyDuel.phase, "");
      const diagnosticsBand = toText(diagnostics.category || diagnostics.state, "");
      const tickTempo = toNum(tick.tempo_ms || tick.tick_ms, Number.NaN);
      flowKindKey = "world_flow_kind_arena_loop";
      stageStatusKey = resolveFlowStatusKey(duelPhase || diagnosticsBand, "live");
      readinessStatusKey = resolveFlowStatusKey(diagnosticsBand, "ready");
      tempoValue = Number.isFinite(tickTempo) ? `${Math.round(tickTempo)}ms` : percentText(weeklyLadder.completion_pct || weeklyLadder.rank_progress_pct);
      steps = [
        buildFlowStep("world_sheet_metric_duel_phase", upperText(duelPhase || "live"), stageStatusKey),
        buildFlowStep(
          "world_sheet_metric_ladder_charge",
          percentText(weeklyLadder.completion_pct || weeklyLadder.rank_progress_pct),
          resolveFlowStatusKey(weeklyLadder.phase || "live", "live")
        ),
        buildFlowStep("world_sheet_metric_diag_band", upperText(diagnosticsBand), readinessStatusKey)
      ].filter(Boolean);
      break;
    }
    case "mission_quarter": {
      const offerCount = toNum(taskResult.offer_count || taskResult.offers_count || mission.offer_count || mission.active_count, 0);
      const claimableCount = toNum(taskResult.claimable_count || mission.claimable_count, 0);
      const contractBand = toText(contract.band || contract.state, "");
      flowKindKey = hotspotKey === "claim_dais" ? "world_flow_kind_loot_reveal" : "world_flow_kind_contract_loop";
      stageStatusKey = claimableCount > 0 ? "ready" : offerCount > 0 ? "live" : "idle";
      readinessStatusKey = resolveFlowStatusKey(contractBand, claimableCount > 0 ? "ready" : "watch");
      tempoValue = claimableCount > 0 ? `${claimableCount} ready` : offerCount > 0 ? `${offerCount} live` : "idle";
      steps = [
        buildFlowStep("world_sheet_metric_offer_count", countText(offerCount), offerCount > 0 ? "live" : "idle"),
        buildFlowStep(
          "world_sheet_metric_streak",
          countText(daily.streak_days || daily.streak) ? `${countText(daily.streak_days || daily.streak)}d` : "",
          toNum(daily.streak_days || daily.streak, 0) > 0 ? "live" : "idle"
        ),
        buildFlowStep("world_sheet_metric_claimable", countText(claimableCount), claimableCount > 0 ? "ready" : "idle")
      ].filter(Boolean);
      break;
    }
    case "exchange_district": {
      const walletState = pickTruthy(walletSession, ["active", "linked"]) ? "live" : "watch";
      const payoutState = toText(payoutStatus.state || payoutStatus.status, "");
      const routeState = toText(routeStatus.state || routeStatus.health, "");
      const premiumActive = pickTruthy(monetization, ["pass_active", "active", "premium_active"]);
      flowKindKey =
        hotspotKey === "premium_lane"
          ? "world_flow_kind_premium_loop"
          : hotspotKey === "rewards_vault"
            ? "world_flow_kind_loot_reveal"
            : "world_flow_kind_vault_loop";
      stageStatusKey =
        hotspotKey === "premium_lane"
          ? premiumActive
            ? "live"
            : "ready"
          : resolveFlowStatusKey(payoutState || routeState, walletState);
      readinessStatusKey = resolveFlowStatusKey(routeState || payoutState, premiumActive ? "ready" : walletState);
      tempoValue = upperText(routeState || payoutState || (premiumActive ? "active" : "ready"));
      steps = [
        buildFlowStep("world_sheet_metric_wallet_state", pickTruthy(walletSession, ["active", "linked"]) ? "LIVE" : "OPEN", walletState),
        buildFlowStep("world_sheet_metric_payout_state", upperText(payoutState), resolveFlowStatusKey(payoutState, "watch")),
        buildFlowStep("world_sheet_metric_route_state", upperText(routeState), readinessStatusKey)
      ].filter(Boolean);
      break;
    }
    case "ops_citadel": {
      const schedulerState = toText(summary.live_ops_scheduler_state || summary.scheduler_state, "");
      const sceneHealth = toText(summary.scene_runtime_health_band_24h || summary.scene_health_band, "");
      const alertCount = toNum(summary.ops_alert_raised_24h || summary.alerts_24h, 0);
      flowKindKey = hotspotKey === "liveops_table" ? "world_flow_kind_dispatch_loop" : "world_flow_kind_ops_loop";
      stageStatusKey = resolveFlowStatusKey(schedulerState || sceneHealth, sceneHealth ? "watch" : "idle");
      readinessStatusKey = resolveFlowStatusKey(sceneHealth, "watch");
      tempoValue = upperText(schedulerState || sceneHealth || "ready");
      steps = [
        buildFlowStep("world_sheet_metric_queue_depth", countText(queue.length), queue.length > 0 ? "live" : "ready"),
        buildFlowStep("world_sheet_metric_scene_health", upperText(sceneHealth), readinessStatusKey),
        buildFlowStep("world_sheet_metric_alerts", countText(alertCount), alertCount > 0 ? "watch" : "ready")
      ].filter(Boolean);
      break;
    }
    default: {
      const missionCount = toNum(mission.active_count || mission.offer_count, 0);
      const progress = percentText(season.progress_pct || season.progress || season.completion_pct);
      const walletLinked = pickTruthy(walletQuick, ["linked", "wallet_linked", "active"]);
      flowKindKey = hotspotKey === "rewards_cache" ? "world_flow_kind_loot_reveal" : "world_flow_kind_travel";
      stageStatusKey = missionCount > 0 ? "live" : "ready";
      readinessStatusKey = resolveFlowStatusKey(risk.band || risk.state, walletLinked ? "ready" : "watch");
      tempoValue = progress || (walletLinked ? "LIVE" : "OPEN");
      steps = [
        buildFlowStep("world_sheet_metric_progress", progress, missionCount > 0 ? "live" : "ready"),
        buildFlowStep("world_sheet_metric_active_missions", countText(missionCount), missionCount > 0 ? "live" : "idle"),
        buildFlowStep("world_sheet_metric_wallet_state", walletLinked ? "LIVE" : "OPEN", walletLinked ? "ready" : "watch")
      ].filter(Boolean);
      break;
    }
  }

  return {
    flow_key: `${districtKey}:${hotspotKey || "flow"}`,
    flow_kind_key: flowKindKey,
    stage_label_key: "world_flow_stage_label",
    stage_value_key: flowStatusLabelKey(stageStatusKey),
    stage_status_key: stageStatusKey,
    readiness_label_key: "world_flow_readiness_label",
    readiness_value_key: flowStatusLabelKey(readinessStatusKey),
    readiness_status_key: readinessStatusKey,
    tempo_label_key: tempoLabelKey,
    tempo_value: toText(tempoValue, ""),
    step_rows: steps.slice(0, 3)
  };
}

function buildDistrictInteractionEntry(districtKey, activeHotspot, interactionSurface, interactionFlow, interactionSheet) {
  if (!activeHotspot || !interactionSurface || !interactionFlow || !interactionSheet?.rows?.length) {
    return null;
  }

  const hotspotKey = toText(activeHotspot.key, "");
  const flowStepMap = new Map(asList(interactionFlow.step_rows).map((row) => [toText(row.label_key, ""), row]));
  let entryKindKey = "world_entry_kind_hub_portal";
  let entryClassKey = "hub_portal";

  switch (districtKey) {
    case "arena_prime":
      if (hotspotKey === "ladder_bridge" || hotspotKey === "ranking_orbit") {
        entryKindKey = "world_entry_kind_ladder_console";
        entryClassKey = "ladder_console";
      } else if (hotspotKey === "diagnostics_rail" || hotspotKey === "tick_chamber") {
        entryKindKey = "world_entry_kind_telemetry_console";
        entryClassKey = "telemetry_console";
      } else {
        entryKindKey = "world_entry_kind_duel_console";
        entryClassKey = "duel_console";
      }
      break;
    case "mission_quarter":
      if (hotspotKey === "claim_dais") {
        entryKindKey = "world_entry_kind_claim_terminal";
        entryClassKey = "claim_terminal";
      } else if (hotspotKey === "streak_pulse" || hotspotKey === "contract_pulse") {
        entryKindKey = "world_entry_kind_streak_terminal";
        entryClassKey = "streak_terminal";
      } else {
        entryKindKey = "world_entry_kind_mission_terminal";
        entryClassKey = "mission_terminal";
      }
      break;
    case "exchange_district":
      if (hotspotKey === "rewards_vault") {
        entryKindKey = "world_entry_kind_rewards_vault";
        entryClassKey = "rewards_vault";
      } else if (hotspotKey === "payout_bay" || hotspotKey === "support_bay") {
        entryKindKey = "world_entry_kind_payout_terminal";
        entryClassKey = "payout_terminal";
      } else if (hotspotKey === "premium_lane") {
        entryKindKey = "world_entry_kind_premium_terminal";
        entryClassKey = "premium_terminal";
      } else {
        entryKindKey = "world_entry_kind_wallet_terminal";
        entryClassKey = "wallet_terminal";
      }
      break;
    case "ops_citadel":
      if (hotspotKey === "liveops_table") {
        entryKindKey = "world_entry_kind_dispatch_console";
        entryClassKey = "dispatch_console";
      } else if (hotspotKey === "runtime_dais" || hotspotKey === "flags_console" || hotspotKey === "bot_relay") {
        entryKindKey = "world_entry_kind_runtime_console";
        entryClassKey = "runtime_console";
      } else {
        entryKindKey = "world_entry_kind_queue_console";
        entryClassKey = "queue_console";
      }
      break;
    default:
      if (hotspotKey === "mission_desk" || hotspotKey === "discover_arc") {
        entryKindKey = "world_entry_kind_mission_terminal";
        entryClassKey = "mission_terminal";
      } else if (hotspotKey === "wallet_port") {
        entryKindKey = "world_entry_kind_wallet_terminal";
        entryClassKey = "wallet_terminal";
      } else if (hotspotKey === "rewards_cache") {
        entryKindKey = "world_entry_kind_rewards_vault";
        entryClassKey = "rewards_vault";
      }
      break;
  }

  const previewRows = interactionSheet.rows.slice(0, 3).map((row) => {
    const stepRow = flowStepMap.get(toText(row.label_key, ""));
    return {
      label_key: row.label_key,
      value: row.value,
      status_key: toText(stepRow?.status_key, interactionFlow.readiness_status_key || "ready")
    };
  });

  return {
    entry_key: `${districtKey}:${hotspotKey || "entry"}`,
    entry_kind_key: entryKindKey,
    entry_class_key: entryClassKey,
    status_key: toText(interactionFlow.readiness_status_key, "ready"),
    status_label_key: toText(interactionFlow.readiness_value_key, "world_flow_state_ready"),
    summary_label_key: toText(interactionSurface.hero_label_key, ""),
    summary_value: toText(interactionSurface.hero_value, ""),
    support_label_key: toText(interactionSurface.support_label_key, ""),
    support_value: toText(interactionSurface.support_value, ""),
    preview_rows: previewRows,
    primary_action_key: toText(interactionSurface.action_items?.[0]?.action_key, ""),
    primary_action_label_key: toText(interactionSurface.action_items?.[0]?.label_key, ""),
    action_count: toNum(interactionSurface.action_count, 0)
  };
}

function buildTerminalSignalRow(labelKey, value, statusKey = "ready") {
  const text = toText(value, "");
  if (!text) {
    return null;
  }
  return {
    label_key: labelKey,
    value: text,
    status_key: statusKey
  };
}

function buildDistrictInteractionTerminal(
  districtKey,
  activeHotspot,
  activeCluster,
  interactionSheet,
  interactionSurface,
  interactionFlow,
  interactionEntry
) {
  if (!activeHotspot || !interactionSheet?.rows?.length || !interactionSurface || !interactionFlow || !interactionEntry) {
    return null;
  }

  const hotspotKey = toText(activeHotspot.key, "");
  const surfaceClassKey = toText(interactionSurface.surface_class_key, "travel_portal");
  const previewRows = asList(interactionEntry.preview_rows).slice(0, 3);
  const flowRows = asList(interactionFlow.step_rows).slice(0, 3);
  const actionItems = asList(interactionSurface.action_items).slice(0, 3);
  const actionCount = actionItems.length;
  const routeCount = Math.max(1, toNum(activeCluster?.hotspot_count, 0));
  const secondaryCount = toNum(activeCluster?.secondary_count, 0);
  const clusterLabelKey = toText(activeCluster?.label_key, "");
  const clusterLabel = toText(activeCluster?.label, "");

  let terminalKindKey = interactionEntry.entry_kind_key || "world_entry_kind_hub_portal";
  let terminalClassKey = surfaceClassKey;

  switch (districtKey) {
    case "arena_prime":
      terminalClassKey = hotspotKey === "diagnostics_rail" || hotspotKey === "tick_chamber" ? "telemetry_console" : surfaceClassKey;
      break;
    case "mission_quarter":
      terminalClassKey = hotspotKey === "claim_dais" ? "loot_reveal" : surfaceClassKey;
      break;
    case "exchange_district":
      terminalClassKey =
        hotspotKey === "rewards_vault"
          ? "loot_reveal"
          : hotspotKey === "premium_lane"
            ? "premium_terminal"
            : hotspotKey === "payout_bay" || hotspotKey === "support_bay"
              ? "payout_terminal"
              : surfaceClassKey;
      break;
    case "ops_citadel":
      terminalClassKey = hotspotKey === "liveops_table" ? "dispatch_console" : surfaceClassKey;
      break;
    default:
      terminalKindKey = interactionEntry.entry_kind_key || "world_entry_kind_hub_portal";
      terminalClassKey = surfaceClassKey;
      break;
  }

  const signalRows = [
    buildTerminalSignalRow(
      toText(interactionEntry.summary_label_key, ""),
      toText(interactionEntry.summary_value, ""),
      toText(interactionEntry.status_key, "ready")
    ),
    buildTerminalSignalRow(
      toText(interactionEntry.support_label_key, ""),
      toText(interactionEntry.support_value, ""),
      toText(interactionFlow.stage_status_key, "ready")
    ),
    buildTerminalSignalRow("world_terminal_signal_actions", countText(actionCount), actionCount > 1 ? "live" : "ready"),
    buildTerminalSignalRow("world_terminal_signal_routes", countText(routeCount), secondaryCount > 0 ? "live" : "ready")
  ].filter(Boolean);

  return {
    terminal_key: `${districtKey}:${hotspotKey || "terminal"}`,
    terminal_kind_key: terminalKindKey,
    terminal_class_key: terminalClassKey,
    terminal_title_key: toText(activeHotspot.label_key, ""),
    terminal_title: toText(activeHotspot.label, ""),
    status_key: toText(interactionEntry.status_key, "ready"),
    status_label_key: toText(interactionEntry.status_label_key, "world_flow_state_ready"),
    intent_label_key: toText(interactionSurface.intent_label_key, ""),
    intent_tone_key: toText(interactionSurface.intent_tone_key, ""),
    hint_label_key: toText(interactionSurface.hint_label_key, ""),
    cluster_label_key: clusterLabelKey,
    cluster_label: clusterLabel,
    stage_label_key: toText(interactionFlow.stage_label_key, ""),
    stage_value_key: toText(interactionFlow.stage_value_key, ""),
    readiness_label_key: toText(interactionFlow.readiness_label_key, ""),
    readiness_value_key: toText(interactionFlow.readiness_value_key, ""),
    tempo_label_key: toText(interactionFlow.tempo_label_key, ""),
    tempo_value: toText(interactionFlow.tempo_value, ""),
    preview_rows: previewRows,
    flow_rows: flowRows,
    signal_rows: signalRows,
    action_items: actionItems,
    action_count: actionCount,
    route_count: routeCount
  };
}

function buildModalCard(labelKey, value, statusKey = "ready", toneKey = "") {
  const text = toText(value, "");
  if (!text) {
    return null;
  }
  return {
    card_key: `${labelKey}:${statusKey}:${toneKey || "tone"}`,
    label_key: labelKey,
    value: text,
    status_key: statusKey,
    tone_key: toneKey
  };
}

function buildModalProtocolActionItem(actionKey, labelKey, hintLabelKey = "", toneKey = "", intentProfileKey = "") {
  const normalizedActionKey = toText(actionKey, "");
  if (!normalizedActionKey) {
    return null;
  }
  return {
    item_key: `${labelKey}:${normalizedActionKey}`,
    action_key: normalizedActionKey,
    label_key: labelKey,
    hint_label_key: toText(hintLabelKey, ""),
    tone_key: toText(toneKey, ""),
    intent_profile_key: toText(intentProfileKey, "")
  };
}

function resolveProtocolPodFocusMeta(labelKey) {
  switch (labelKey) {
    case "world_modal_lane_duel_sync":
      return {
        entry_kind_key: "world_entry_kind_duel_console",
        sequence_kind_key: "world_modal_kind_duel_sequence",
        tempo_label_key: "world_sequence_tempo_burst",
        camera_profile_label_key: "world_camera_focus_strike",
        camera_radius_scale: 0.84,
        camera_focus_y_offset: 0.2,
        motion_scalar: 1.12
      };
    case "world_modal_lane_ladder_charge":
      return {
        entry_kind_key: "world_entry_kind_ladder_console",
        sequence_kind_key: "world_modal_kind_ladder_sequence",
        tempo_label_key: "world_sequence_tempo_charge",
        camera_profile_label_key: "world_camera_focus_charge",
        camera_radius_scale: 0.88,
        camera_focus_y_offset: 0.16,
        motion_scalar: 1.06
      };
    case "world_modal_lane_telemetry_scan":
    case "world_modal_lane_tick_window":
    case "world_modal_lane_risk_watch":
      return {
        entry_kind_key: "world_entry_kind_telemetry_console",
        sequence_kind_key: "world_modal_kind_telemetry_scan",
        tempo_label_key: "world_sequence_tempo_scan",
        camera_profile_label_key: "world_camera_focus_scan",
        camera_radius_scale: 0.94,
        camera_focus_y_offset: 0.1,
        motion_scalar: 0.94
      };
    case "world_modal_lane_offer_stack":
      return {
        entry_kind_key: "world_entry_kind_mission_terminal",
        sequence_kind_key: "world_modal_kind_mission_terminal",
        tempo_label_key: "world_sequence_tempo_stack",
        camera_profile_label_key: "world_camera_focus_stack",
        camera_radius_scale: 0.9,
        camera_focus_y_offset: 0.12,
        motion_scalar: 1
      };
    case "world_modal_lane_claim_lane":
      return {
        entry_kind_key: "world_entry_kind_claim_terminal",
        sequence_kind_key: "world_modal_kind_contract_sequence",
        tempo_label_key: "world_sequence_tempo_claim",
        camera_profile_label_key: "world_camera_focus_claim",
        camera_radius_scale: 0.88,
        camera_focus_y_offset: 0.14,
        motion_scalar: 1.04
      };
    case "world_modal_lane_contract_pulse":
      return {
        entry_kind_key: "world_entry_kind_mission_terminal",
        sequence_kind_key: "world_modal_kind_contract_sequence",
        tempo_label_key: "world_sequence_tempo_sync",
        camera_profile_label_key: "world_camera_focus_stack",
        camera_radius_scale: 0.92,
        camera_focus_y_offset: 0.12,
        motion_scalar: 0.98
      };
    case "world_modal_lane_streak_pulse":
      return {
        entry_kind_key: "world_entry_kind_streak_terminal",
        sequence_kind_key: "world_modal_kind_streak_sync",
        tempo_label_key: "world_sequence_tempo_sync",
        camera_profile_label_key: "world_camera_focus_watch",
        camera_radius_scale: 0.94,
        camera_focus_y_offset: 0.08,
        motion_scalar: 0.92
      };
    case "world_modal_lane_wallet_link":
      return {
        entry_kind_key: "world_entry_kind_wallet_terminal",
        sequence_kind_key: "world_modal_kind_wallet_terminal",
        tempo_label_key: "world_sequence_tempo_link",
        camera_profile_label_key: "world_camera_focus_route",
        camera_radius_scale: 0.9,
        camera_focus_y_offset: 0.12,
        motion_scalar: 0.94
      };
    case "world_modal_lane_payout_lane":
      return {
        entry_kind_key: "world_entry_kind_payout_terminal",
        sequence_kind_key: "world_modal_kind_payout_route",
        tempo_label_key: "world_sequence_tempo_route",
        camera_profile_label_key: "world_camera_focus_route",
        camera_radius_scale: 0.88,
        camera_focus_y_offset: 0.1,
        motion_scalar: 0.9
      };
    case "world_modal_lane_premium_lane":
      return {
        entry_kind_key: "world_entry_kind_premium_terminal",
        sequence_kind_key: "world_modal_kind_premium_unlock",
        tempo_label_key: "world_sequence_tempo_unlock",
        camera_profile_label_key: "world_camera_focus_route",
        camera_radius_scale: 0.9,
        camera_focus_y_offset: 0.12,
        motion_scalar: 0.96
      };
    case "world_modal_lane_route_matrix":
      return {
        entry_kind_key: "world_entry_kind_rewards_vault",
        sequence_kind_key: "world_modal_kind_payout_route",
        tempo_label_key: "world_sequence_tempo_route",
        camera_profile_label_key: "world_camera_focus_route",
        camera_radius_scale: 0.92,
        camera_focus_y_offset: 0.1,
        motion_scalar: 0.9
      };
    case "world_modal_lane_queue_review":
      return {
        entry_kind_key: "world_entry_kind_queue_console",
        sequence_kind_key: "world_modal_kind_queue_review",
        tempo_label_key: "world_sequence_tempo_watch",
        camera_profile_label_key: "world_camera_focus_watch",
        camera_radius_scale: 0.9,
        camera_focus_y_offset: 0.16,
        motion_scalar: 0.86
      };
    case "world_modal_lane_runtime_watch":
      return {
        entry_kind_key: "world_entry_kind_runtime_console",
        sequence_kind_key: "world_modal_kind_runtime_scan",
        tempo_label_key: "world_sequence_tempo_watch",
        camera_profile_label_key: "world_camera_focus_watch",
        camera_radius_scale: 0.94,
        camera_focus_y_offset: 0.14,
        motion_scalar: 0.84
      };
    case "world_modal_lane_dispatch_gate":
      return {
        entry_kind_key: "world_entry_kind_dispatch_console",
        sequence_kind_key: "world_modal_kind_dispatch_sequence",
        tempo_label_key: "world_sequence_tempo_dispatch",
        camera_profile_label_key: "world_camera_focus_dispatch",
        camera_radius_scale: 0.86,
        camera_focus_y_offset: 0.18,
        motion_scalar: 0.88
      };
    case "world_modal_lane_mission_queue":
      return {
        entry_kind_key: "world_entry_kind_mission_terminal",
        sequence_kind_key: "world_modal_kind_mission_terminal",
        tempo_label_key: "world_sequence_tempo_stack",
        camera_profile_label_key: "world_camera_focus_glide",
        camera_radius_scale: 0.96,
        camera_focus_y_offset: 0.08,
        motion_scalar: 0.96
      };
    case "world_modal_lane_season_arc":
    default:
      return {
        entry_kind_key: "world_entry_kind_hub_portal",
        sequence_kind_key: "world_modal_kind_travel_gate",
        tempo_label_key: "world_sequence_tempo_glide",
        camera_profile_label_key: "world_camera_focus_glide",
        camera_radius_scale: 1,
        camera_focus_y_offset: 0.06,
        motion_scalar: 0.94
      };
  }
}

function resolveProtocolMicroFlowMeta(labelKey) {
  const personalityMeta = buildProtocolMicroFlowPersonality(labelKey, {});
  const withPersonality = (meta) => ({
    ...meta,
    hud_density_profile_key: personalityMeta.hud_density_profile_key,
    rail_layout_key: personalityMeta.rail_layout_key,
    console_layout_key: personalityMeta.console_layout_key,
    modal_layout_key: personalityMeta.modal_layout_key,
    focus_hold_scalar: personalityMeta.focus_hold_scalar,
    hud_layout_key: personalityMeta.hud_layout_key,
    hud_emphasis_band_key: personalityMeta.hud_emphasis_band_key,
    camera_drift_scalar: personalityMeta.camera_drift_scalar,
    camera_tilt_scalar: personalityMeta.camera_tilt_scalar,
    camera_target_lift_scalar: personalityMeta.camera_target_lift_scalar,
    camera_orbit_bias_scalar: personalityMeta.camera_orbit_bias_scalar,
    actor_motion_scalar: personalityMeta.actor_motion_scalar,
    hotspot_motion_scalar: personalityMeta.hotspot_motion_scalar,
    ring_pulse_scalar: personalityMeta.ring_pulse_scalar,
    satellite_orbit_scalar: personalityMeta.satellite_orbit_scalar
  });
  switch (labelKey) {
    case "world_modal_kind_duel_sequence":
      return withPersonality({
        entry_kind_key: "world_entry_kind_duel_console",
        sequence_kind_key: "world_modal_kind_duel_sequence",
        tempo_label_key: "world_sequence_tempo_burst",
        camera_profile_label_key: "world_camera_focus_strike",
        director_pace_label_key: "world_director_pace_arena",
        hud_tone_label_key: "world_hud_tone_arena_prime",
        camera_radius_scale: 0.78,
        camera_focus_y_offset: 0.24,
        motion_scalar: 1.14,
        alpha_offset: -0.08,
        beta_offset: 0.03,
        focus_lerp_scalar: 1.24,
        radius_lerp_scalar: 1.18
      });
    case "world_modal_kind_ladder_sequence":
      return withPersonality({
        entry_kind_key: "world_entry_kind_ladder_console",
        sequence_kind_key: "world_modal_kind_ladder_sequence",
        tempo_label_key: "world_sequence_tempo_charge",
        camera_profile_label_key: "world_camera_focus_charge",
        director_pace_label_key: "world_director_pace_arena",
        hud_tone_label_key: "world_hud_tone_arena_prime",
        camera_radius_scale: 0.82,
        camera_focus_y_offset: 0.18,
        motion_scalar: 1.06,
        alpha_offset: -0.05,
        beta_offset: 0.02,
        focus_lerp_scalar: 1.14,
        radius_lerp_scalar: 1.12
      });
    case "world_modal_kind_telemetry_scan":
      return withPersonality({
        entry_kind_key: "world_entry_kind_telemetry_console",
        sequence_kind_key: "world_modal_kind_telemetry_scan",
        tempo_label_key: "world_sequence_tempo_scan",
        camera_profile_label_key: "world_camera_focus_scan",
        director_pace_label_key: "world_director_pace_arena",
        hud_tone_label_key: "world_hud_tone_arena_prime",
        camera_radius_scale: 0.88,
        camera_focus_y_offset: 0.12,
        motion_scalar: 0.92,
        alpha_offset: 0.02,
        beta_offset: -0.01,
        focus_lerp_scalar: 0.94,
        radius_lerp_scalar: 0.96
      });
    case "world_modal_kind_mission_terminal":
      return withPersonality({
        entry_kind_key: "world_entry_kind_mission_terminal",
        sequence_kind_key: "world_modal_kind_mission_terminal",
        tempo_label_key: "world_sequence_tempo_stack",
        camera_profile_label_key: "world_camera_focus_stack",
        director_pace_label_key: "world_director_pace_mission",
        hud_tone_label_key: "world_hud_tone_mission_quarter",
        camera_radius_scale: 0.86,
        camera_focus_y_offset: 0.14,
        motion_scalar: 0.98,
        alpha_offset: -0.03,
        beta_offset: 0.01,
        focus_lerp_scalar: 1.06,
        radius_lerp_scalar: 1.08
      });
    case "world_modal_kind_contract_sequence":
      return withPersonality({
        entry_kind_key: "world_entry_kind_claim_terminal",
        sequence_kind_key: "world_modal_kind_contract_sequence",
        tempo_label_key: "world_sequence_tempo_claim",
        camera_profile_label_key: "world_camera_focus_claim",
        director_pace_label_key: "world_director_pace_mission",
        hud_tone_label_key: "world_hud_tone_mission_quarter",
        camera_radius_scale: 0.84,
        camera_focus_y_offset: 0.16,
        motion_scalar: 1,
        alpha_offset: -0.04,
        beta_offset: 0.02,
        focus_lerp_scalar: 1.08,
        radius_lerp_scalar: 1.1
      });
    case "world_modal_kind_streak_sync":
      return withPersonality({
        entry_kind_key: "world_entry_kind_streak_terminal",
        sequence_kind_key: "world_modal_kind_streak_sync",
        tempo_label_key: "world_sequence_tempo_sync",
        camera_profile_label_key: "world_camera_focus_watch",
        director_pace_label_key: "world_director_pace_mission",
        hud_tone_label_key: "world_hud_tone_mission_quarter",
        camera_radius_scale: 0.9,
        camera_focus_y_offset: 0.1,
        motion_scalar: 0.9,
        alpha_offset: 0.01,
        beta_offset: -0.01,
        focus_lerp_scalar: 0.92,
        radius_lerp_scalar: 0.94
      });
    case "world_modal_kind_wallet_terminal":
      return withPersonality({
        entry_kind_key: "world_entry_kind_wallet_terminal",
        sequence_kind_key: "world_modal_kind_wallet_terminal",
        tempo_label_key: "world_sequence_tempo_link",
        camera_profile_label_key: "world_camera_focus_route",
        director_pace_label_key: "world_director_pace_exchange",
        hud_tone_label_key: "world_hud_tone_exchange_district",
        camera_radius_scale: 0.84,
        camera_focus_y_offset: 0.14,
        motion_scalar: 0.94,
        alpha_offset: -0.03,
        beta_offset: 0.01,
        focus_lerp_scalar: 1.02,
        radius_lerp_scalar: 1.04
      });
    case "world_modal_kind_payout_route":
      return withPersonality({
        entry_kind_key: "world_entry_kind_payout_terminal",
        sequence_kind_key: "world_modal_kind_payout_route",
        tempo_label_key: "world_sequence_tempo_route",
        camera_profile_label_key: "world_camera_focus_route",
        director_pace_label_key: "world_director_pace_exchange",
        hud_tone_label_key: "world_hud_tone_exchange_district",
        camera_radius_scale: 0.82,
        camera_focus_y_offset: 0.12,
        motion_scalar: 0.9,
        alpha_offset: -0.02,
        beta_offset: 0.01,
        focus_lerp_scalar: 0.98,
        radius_lerp_scalar: 1
      });
    case "world_modal_kind_premium_unlock":
      return withPersonality({
        entry_kind_key: "world_entry_kind_premium_terminal",
        sequence_kind_key: "world_modal_kind_premium_unlock",
        tempo_label_key: "world_sequence_tempo_unlock",
        camera_profile_label_key: "world_camera_focus_route",
        director_pace_label_key: "world_director_pace_exchange",
        hud_tone_label_key: "world_hud_tone_exchange_district",
        camera_radius_scale: 0.84,
        camera_focus_y_offset: 0.12,
        motion_scalar: 0.94,
        alpha_offset: -0.03,
        beta_offset: 0.01,
        focus_lerp_scalar: 1,
        radius_lerp_scalar: 1.04
      });
    case "world_modal_kind_queue_review":
      return withPersonality({
        entry_kind_key: "world_entry_kind_queue_console",
        sequence_kind_key: "world_modal_kind_queue_review",
        tempo_label_key: "world_sequence_tempo_watch",
        camera_profile_label_key: "world_camera_focus_watch",
        director_pace_label_key: "world_director_pace_ops",
        hud_tone_label_key: "world_hud_tone_ops_citadel",
        camera_radius_scale: 0.84,
        camera_focus_y_offset: 0.18,
        motion_scalar: 0.84,
        alpha_offset: 0.02,
        beta_offset: -0.02,
        focus_lerp_scalar: 0.92,
        radius_lerp_scalar: 0.96
      });
    case "world_modal_kind_runtime_scan":
      return withPersonality({
        entry_kind_key: "world_entry_kind_runtime_console",
        sequence_kind_key: "world_modal_kind_runtime_scan",
        tempo_label_key: "world_sequence_tempo_watch",
        camera_profile_label_key: "world_camera_focus_watch",
        director_pace_label_key: "world_director_pace_ops",
        hud_tone_label_key: "world_hud_tone_ops_citadel",
        camera_radius_scale: 0.88,
        camera_focus_y_offset: 0.16,
        motion_scalar: 0.82,
        alpha_offset: 0.01,
        beta_offset: -0.01,
        focus_lerp_scalar: 0.9,
        radius_lerp_scalar: 0.94
      });
    case "world_modal_kind_dispatch_sequence":
      return withPersonality({
        entry_kind_key: "world_entry_kind_dispatch_console",
        sequence_kind_key: "world_modal_kind_dispatch_sequence",
        tempo_label_key: "world_sequence_tempo_dispatch",
        camera_profile_label_key: "world_camera_focus_dispatch",
        director_pace_label_key: "world_director_pace_ops",
        hud_tone_label_key: "world_hud_tone_ops_citadel",
        camera_radius_scale: 0.8,
        camera_focus_y_offset: 0.2,
        motion_scalar: 0.86,
        alpha_offset: -0.06,
        beta_offset: 0.02,
        focus_lerp_scalar: 1.16,
        radius_lerp_scalar: 1.14
      });
    case "world_modal_kind_travel_gate":
    default:
      return withPersonality({
        entry_kind_key: "world_entry_kind_hub_portal",
        sequence_kind_key: "world_modal_kind_travel_gate",
        tempo_label_key: "world_sequence_tempo_glide",
        camera_profile_label_key: "world_camera_focus_glide",
        director_pace_label_key: "world_director_pace_hub",
        hud_tone_label_key: "world_hud_tone_central_hub",
        camera_radius_scale: 0.92,
        camera_focus_y_offset: 0.08,
        motion_scalar: 0.9,
        alpha_offset: 0.03,
        beta_offset: -0.01,
        focus_lerp_scalar: 0.96,
        radius_lerp_scalar: 0.98
      });
  }
}

function buildProtocolMicroFlowSequenceCards(labelKeyValue, statusKey, primaryRow, secondaryRow, tertiaryRow, focusMeta) {
  const cards = [
    primaryRow
      ? {
          card_key: `${labelKeyValue}:stage`,
          label_key: primaryRow.label_key || labelKeyValue,
          value: primaryRow.value || "",
          status_key: primaryRow.status_key || statusKey
        }
      : null,
    focusMeta.tempo_label_key
      ? {
          card_key: `${labelKeyValue}:tempo`,
          label_key: "world_modal_chip_tempo",
          value_key: focusMeta.tempo_label_key,
          value: focusMeta.tempo_label_key,
          status_key: statusKey
        }
      : null,
    focusMeta.director_pace_label_key
      ? {
          card_key: `${labelKeyValue}:director`,
          label_key: "world_modal_chip_director",
          value_key: focusMeta.director_pace_label_key,
          value: focusMeta.director_pace_label_key,
          status_key: tertiaryRow?.status_key || secondaryRow?.status_key || statusKey
        }
      : null
  ].filter(Boolean);
  return cards.slice(0, 3);
}

function buildProtocolPodMicroFlowCards(labelKey, statusKey, toneKey, sequenceRows, actionItems) {
  const primaryAction = actionItems[0] || null;
  const secondaryAction = actionItems[1] || primaryAction || null;
  const primaryRow = sequenceRows[0] || null;
  const secondaryRow = sequenceRows[1] || primaryRow || null;
  const tertiaryRow = sequenceRows[2] || secondaryRow || primaryRow || null;

  const buildCard = (cardKey, labelKeyValue, row, actionItem, cardToneKey = toneKey) => {
    if (!row?.value && !actionItem?.action_key) {
      return null;
    }
    const focusMeta = resolveProtocolMicroFlowMeta(labelKeyValue);
    const familyKey = toKeyToken(cardKey, "flow");
    return {
      microflow_key: `${labelKey}:${cardKey}`,
      family_key: familyKey,
      flow_key: `${familyKey}_flow`,
      label_key: labelKeyValue,
      value: row?.value || "",
      status_key: row?.status_key || statusKey,
      tone_key: toText(cardToneKey, ""),
      action_key: toText(actionItem?.action_key, ""),
      action_label_key: toText(actionItem?.label_key, ""),
      hint_label_key: toText(actionItem?.hint_label_key, ""),
      action_items: actionItem ? [actionItem] : [],
      rows: [row, secondaryRow, tertiaryRow].filter(Boolean).slice(0, 3),
      entry_kind_key: focusMeta.entry_kind_key,
      sequence_kind_key: focusMeta.sequence_kind_key,
      tempo_label_key: focusMeta.tempo_label_key,
      camera_profile_label_key: focusMeta.camera_profile_label_key,
      director_pace_label_key: focusMeta.director_pace_label_key,
      hud_tone_label_key: focusMeta.hud_tone_label_key,
      hud_density_profile_key: focusMeta.hud_density_profile_key,
      rail_layout_key: focusMeta.rail_layout_key,
      console_layout_key: focusMeta.console_layout_key,
      modal_layout_key: focusMeta.modal_layout_key,
      focus_hold_scalar: focusMeta.focus_hold_scalar,
      camera_radius_scale: focusMeta.camera_radius_scale,
      camera_focus_y_offset: focusMeta.camera_focus_y_offset,
      motion_scalar: focusMeta.motion_scalar,
      hud_layout_key: focusMeta.hud_layout_key,
      hud_emphasis_band_key: focusMeta.hud_emphasis_band_key,
      camera_drift_scalar: focusMeta.camera_drift_scalar,
      camera_tilt_scalar: focusMeta.camera_tilt_scalar,
      camera_target_lift_scalar: focusMeta.camera_target_lift_scalar,
      camera_orbit_bias_scalar: focusMeta.camera_orbit_bias_scalar,
      alpha_offset: focusMeta.alpha_offset,
      beta_offset: focusMeta.beta_offset,
      focus_lerp_scalar: focusMeta.focus_lerp_scalar,
      radius_lerp_scalar: focusMeta.radius_lerp_scalar,
      orbit_spin_scalar: focusMeta.orbit_spin_scalar,
      sway_scalar: focusMeta.sway_scalar,
      alpha_lerp_scalar: focusMeta.alpha_lerp_scalar,
      beta_lerp_scalar: focusMeta.beta_lerp_scalar,
      hud_emphasis_scalar: focusMeta.hud_emphasis_scalar,
      actor_motion_scalar: focusMeta.actor_motion_scalar,
      hotspot_motion_scalar: focusMeta.hotspot_motion_scalar,
      ring_pulse_scalar: focusMeta.ring_pulse_scalar,
      satellite_orbit_scalar: focusMeta.satellite_orbit_scalar,
      stage_label_key: row?.label_key || labelKeyValue,
      stage_value: row?.value || "",
      stage_status_key: row?.status_key || statusKey,
      sequence_rows: [row, secondaryRow, tertiaryRow].filter(Boolean).slice(0, 3),
      sequence_cards: buildProtocolMicroFlowSequenceCards(labelKeyValue, statusKey, row, secondaryRow, tertiaryRow, focusMeta)
    };
  };

  switch (labelKey) {
    case "world_modal_lane_duel_sync":
      return [
        buildCard("duel", "world_modal_kind_duel_sequence", primaryRow, primaryAction, "world_intent_tone_compete"),
        buildCard("telemetry", "world_modal_kind_telemetry_scan", secondaryRow, secondaryAction, "world_intent_tone_track")
      ].filter(Boolean);
    case "world_modal_lane_ladder_charge":
      return [
        buildCard("ladder", "world_modal_kind_ladder_sequence", primaryRow, primaryAction, "world_intent_tone_climb"),
        buildCard("scan", "world_modal_kind_telemetry_scan", secondaryRow, secondaryAction, "world_intent_tone_track")
      ].filter(Boolean);
    case "world_modal_lane_tick_window":
    case "world_modal_lane_telemetry_scan":
    case "world_modal_lane_risk_watch":
      return [
        buildCard("scan", "world_modal_kind_telemetry_scan", primaryRow, primaryAction, "world_intent_tone_track"),
        buildCard("sequence", "world_modal_kind_duel_sequence", secondaryRow, secondaryAction, "world_intent_tone_compete")
      ].filter(Boolean);
    case "world_modal_lane_offer_stack":
      return [
        buildCard("mission", "world_modal_kind_mission_terminal", primaryRow, primaryAction, "world_intent_tone_launch"),
        buildCard("contract", "world_modal_kind_contract_sequence", secondaryRow, secondaryAction, "world_intent_tone_launch")
      ].filter(Boolean);
    case "world_modal_lane_claim_lane":
    case "world_modal_lane_contract_pulse":
      return [
        buildCard("claim", "world_modal_kind_contract_sequence", primaryRow, primaryAction, "world_intent_tone_claim"),
        buildCard("stack", "world_modal_kind_mission_terminal", secondaryRow, secondaryAction, "world_intent_tone_launch")
      ].filter(Boolean);
    case "world_modal_lane_streak_pulse":
      return [
        buildCard("streak", "world_modal_kind_streak_sync", primaryRow, primaryAction, "world_intent_tone_claim"),
        buildCard("claim", "world_modal_kind_contract_sequence", secondaryRow, secondaryAction, "world_intent_tone_claim")
      ].filter(Boolean);
    case "world_modal_lane_wallet_link":
      return [
        buildCard("wallet", "world_modal_kind_wallet_terminal", primaryRow, primaryAction, "world_intent_tone_connect"),
        buildCard("route", "world_modal_kind_payout_route", secondaryRow, secondaryAction, "world_intent_tone_track")
      ].filter(Boolean);
    case "world_modal_lane_payout_lane":
      return [
        buildCard("payout", "world_modal_kind_payout_route", primaryRow, primaryAction, "world_intent_tone_payout"),
        buildCard("wallet", "world_modal_kind_wallet_terminal", secondaryRow, secondaryAction, "world_intent_tone_connect")
      ].filter(Boolean);
    case "world_modal_lane_premium_lane":
      return [
        buildCard("premium", "world_modal_kind_premium_unlock", primaryRow, primaryAction, "world_intent_tone_upgrade"),
        buildCard("route", "world_modal_kind_payout_route", secondaryRow, secondaryAction, "world_intent_tone_track")
      ].filter(Boolean);
    case "world_modal_lane_route_matrix":
      return [
        buildCard("route", "world_modal_kind_payout_route", primaryRow, primaryAction, "world_intent_tone_track"),
        buildCard("wallet", "world_modal_kind_wallet_terminal", secondaryRow, secondaryAction, "world_intent_tone_connect")
      ].filter(Boolean);
    case "world_modal_lane_queue_review":
      return [
        buildCard("queue", "world_modal_kind_queue_review", primaryRow, primaryAction, "world_intent_tone_review"),
        buildCard("runtime", "world_modal_kind_runtime_scan", secondaryRow, secondaryAction, "world_intent_tone_monitor")
      ].filter(Boolean);
    case "world_modal_lane_runtime_watch":
      return [
        buildCard("runtime", "world_modal_kind_runtime_scan", primaryRow, primaryAction, "world_intent_tone_monitor"),
        buildCard("dispatch", "world_modal_kind_dispatch_sequence", secondaryRow, secondaryAction, "world_intent_tone_dispatch")
      ].filter(Boolean);
    case "world_modal_lane_dispatch_gate":
      return [
        buildCard("dispatch", "world_modal_kind_dispatch_sequence", primaryRow, primaryAction, "world_intent_tone_dispatch"),
        buildCard("runtime", "world_modal_kind_runtime_scan", secondaryRow, secondaryAction, "world_intent_tone_monitor")
      ].filter(Boolean);
    case "world_modal_lane_mission_queue":
      return [
        buildCard("travel", "world_modal_kind_travel_gate", primaryRow, primaryAction, "world_intent_tone_travel"),
        buildCard("mission", "world_modal_kind_mission_terminal", secondaryRow, secondaryAction, "world_intent_tone_launch")
      ].filter(Boolean);
    case "world_modal_lane_season_arc":
    default:
      return [
        buildCard("travel", "world_modal_kind_travel_gate", primaryRow, primaryAction, "world_intent_tone_travel"),
        buildCard("watch", "world_modal_kind_telemetry_scan", secondaryRow, secondaryAction, "world_intent_tone_track")
      ].filter(Boolean);
  }
}

function buildModalProtocolPod(labelKey, value, statusKey = "ready", toneKey = "", options = {}) {
  const text = toText(value, "");
  if (!text) {
    return null;
  }
  const rows = asList(options.rows).filter(Boolean).slice(0, 3);
  const actionItems = asList(options.actionItems).filter(Boolean).slice(0, 2);
  const explicitFlowRows = asList(options.flowRows).filter(Boolean).slice(0, 3);
  const focusMeta = resolveProtocolPodFocusMeta(labelKey);
  const sequenceRows = [
    buildFlowStep(rows[0]?.label_key || labelKey, rows[0]?.value || text, rows[0]?.status_key || statusKey),
    ...explicitFlowRows,
    ...rows.slice(1)
  ]
    .filter(Boolean)
    .slice(0, 4);
  const primarySequenceRow = sequenceRows[0] || buildFlowStep(labelKey, text, statusKey);
  const microflowCards = buildProtocolPodMicroFlowCards(labelKey, statusKey, toneKey, sequenceRows, actionItems);
  return {
    pod_key: `${labelKey}:${statusKey}:${toneKey || "pod"}`,
    label_key: labelKey,
    value: text,
    status_key: statusKey,
    tone_key: toText(toneKey, ""),
    status_label_key: flowStatusLabelKey(statusKey),
    hint_label_key: toText(options.hintLabelKey, ""),
    rows,
    signal_rows: [
      buildTerminalSignalRow(labelKey, text, statusKey),
      buildTerminalSignalRow("world_terminal_signal_routes", String(Math.max(1, rows.length)), rows.length > 1 ? "live" : statusKey),
      buildTerminalSignalRow("world_terminal_signal_actions", String(Math.max(1, actionItems.length)), actionItems.length ? "ready" : statusKey)
    ].filter(Boolean),
    flow_rows: (explicitFlowRows.length ? explicitFlowRows : rows.slice(0, 2)).filter(Boolean),
    action_items: actionItems,
    entry_kind_key: focusMeta.entry_kind_key,
    sequence_kind_key: focusMeta.sequence_kind_key,
    tempo_label_key: focusMeta.tempo_label_key,
    camera_profile_label_key: focusMeta.camera_profile_label_key,
    camera_radius_scale: focusMeta.camera_radius_scale,
    camera_focus_y_offset: focusMeta.camera_focus_y_offset,
    motion_scalar: focusMeta.motion_scalar,
    stage_label_key: primarySequenceRow?.label_key || labelKey,
    stage_value: primarySequenceRow?.value || text,
    stage_status_key: primarySequenceRow?.status_key || statusKey,
    sequence_rows: sequenceRows,
    microflow_cards: microflowCards
  };
}

function buildDefaultProtocolPods(labelKey, value, statusKey, toneKey, previewRows, flowRows, actionItems) {
  return [
    buildModalProtocolPod(labelKey, value, statusKey, toneKey, {
      rows: previewRows,
      actionItems: actionItems.slice(0, 1)
    }),
    buildModalProtocolPod(
      flowRows[0]?.label_key || labelKey,
      flowRows[0]?.value || value,
      flowRows[0]?.status_key || statusKey,
      toneKey,
      {
        rows: flowRows.length ? flowRows : previewRows,
        actionItems: actionItems.slice(1, 2)
      }
    )
  ].filter(Boolean);
}

function buildModalProtocolCard(labelKey, value, statusKey = "ready", toneKey = "", actionKey = "", actionLabelKey = "", options = {}) {
  const text = toText(value, "");
  const normalizedActionKey = toText(actionKey, "");
  if (!text) {
    return null;
  }
  const defaultActionItem =
    normalizedActionKey && toText(actionLabelKey, "")
      ? buildModalProtocolActionItem(normalizedActionKey, actionLabelKey, labelKey, toneKey, "")
      : null;
  const actionItems = asList(options.actionItems).filter(Boolean);
  const previewRows = asList(options.previewRows).filter(Boolean).slice(0, 3);
  const flowRows = asList(options.flowRows).filter(Boolean).slice(0, 3);
  const signalRows = [
    buildTerminalSignalRow(labelKey, text, statusKey),
    buildTerminalSignalRow(
      "world_terminal_signal_routes",
      String(Math.max(1, previewRows.length + flowRows.length)),
      flowRows.length > 1 ? "live" : statusKey
    ),
    buildTerminalSignalRow(
      "world_terminal_signal_actions",
      String(Math.max(actionItems.length, defaultActionItem ? 1 : 0)),
      actionItems.length > 1 ? "live" : actionItems.length ? "ready" : statusKey
    )
  ].filter(Boolean);
  const trackRows = [
    buildFlowStep(labelKey, text, statusKey),
    ...flowRows.slice(0, 2)
  ].filter(Boolean);
  const resolvedActionItems = (actionItems.length ? actionItems : defaultActionItem ? [defaultActionItem] : []).slice(0, 3);
  const explicitFlowPods = asList(options.flowPods).filter(Boolean).slice(0, 3);
  return {
    card_key: `${labelKey}:${statusKey}:${normalizedActionKey || "passive"}`,
    label_key: labelKey,
    value: text,
    status_key: statusKey,
    tone_key: toneKey,
    action_key: normalizedActionKey,
    action_label_key: toText(actionLabelKey, ""),
    is_actionable: Boolean(normalizedActionKey),
    status_label_key: flowStatusLabelKey(statusKey),
    preview_rows: previewRows,
    flow_rows: flowRows,
    signal_rows: signalRows,
    track_rows: trackRows,
    flow_pods: (explicitFlowPods.length
      ? explicitFlowPods
      : buildDefaultProtocolPods(labelKey, text, statusKey, toneKey, previewRows, flowRows, resolvedActionItems)
    ).slice(0, 3),
    action_items: resolvedActionItems
  };
}

function buildDistrictInteractionModalCards(input, districtKey, activeHotspot) {
  if (!activeHotspot) {
    return [];
  }

  const homeFeed = asRecord(input.homeFeed);
  const season = asRecord(homeFeed.season);
  const mission = asRecord(homeFeed.mission);
  const walletQuick = asRecord(homeFeed.wallet_quick);
  const risk = asRecord(homeFeed.risk);
  const daily = asRecord(homeFeed.daily);
  const contract = asRecord(homeFeed.contract);
  const taskResult = asRecord(input.taskResult);
  const pvpRuntime = asRecord(input.pvpRuntime);
  const leagueOverview = asRecord(input.leagueOverview);
  const dailyDuel = asRecord(leagueOverview.daily_duel);
  const weeklyLadder = asRecord(leagueOverview.weekly_ladder);
  const pvpLive = asRecord(input.pvpLive);
  const diagnostics = asRecord(pvpLive.diagnostics);
  const tick = asRecord(pvpLive.tick);
  const vaultData = asRecord(input.vaultData);
  const walletSession = asRecord(vaultData.wallet_session);
  const payoutStatus = asRecord(vaultData.payout_status);
  const monetization = asRecord(vaultData.monetization_status);
  const routeStatus = asRecord(vaultData.route_status);
  const adminRuntime = asRecord(input.adminRuntime);
  const summary = asRecord(adminRuntime.summary);
  const queue = asList(adminRuntime.queue);
  const hotspotKey = toText(activeHotspot.key, "");

  switch (districtKey) {
    case "arena_prime": {
      const duelPhase = upperText(pvpRuntime.phase || dailyDuel.phase || "idle");
      const ladderCharge = percentText(weeklyLadder.completion_pct || weeklyLadder.rank_progress_pct);
      const diagnosticsBand = upperText(diagnostics.category || diagnostics.state || "clean");
      const tickTempo = toNum(tick.tempo_ms || tick.tick_ms, Number.NaN);
      return [
        buildModalCard("world_modal_lane_duel_sync", duelPhase, resolveFlowStatusKey(duelPhase, "live"), "world_intent_tone_compete"),
        buildModalCard("world_modal_lane_ladder_charge", ladderCharge, "ready", "world_intent_tone_climb"),
        buildModalCard(
          hotspotKey === "diagnostics_rail" || hotspotKey === "tick_chamber" ? "world_modal_lane_telemetry_scan" : "world_modal_lane_tick_window",
          Number.isFinite(tickTempo) ? `${Math.round(tickTempo)}ms` : diagnosticsBand,
          resolveFlowStatusKey(diagnosticsBand, "ready"),
          "world_intent_tone_track"
        )
      ].filter(Boolean);
    }
    case "mission_quarter": {
      const offerCount = countText(taskResult.offer_count || taskResult.offers_count || mission.offer_count || mission.active_count);
      const claimableCount = countText(taskResult.claimable_count || mission.claimable_count);
      const streakValue = countText(daily.streak_days || daily.streak);
      return [
        buildModalCard("world_modal_lane_offer_stack", offerCount, toNum(offerCount, 0) > 0 ? "live" : "idle", "world_intent_tone_launch"),
        buildModalCard(
          hotspotKey === "claim_dais" ? "world_modal_lane_claim_lane" : "world_modal_lane_contract_pulse",
          claimableCount || upperText(contract.band || contract.state || "open"),
          claimableCount ? "ready" : resolveFlowStatusKey(contract.band || contract.state, "watch"),
          hotspotKey === "claim_dais" ? "world_intent_tone_claim" : "world_intent_tone_launch"
        ),
        buildModalCard(
          "world_modal_lane_streak_pulse",
          streakValue ? `${streakValue}d` : "0d",
          toNum(streakValue, 0) > 0 ? "live" : "idle",
          "world_intent_tone_claim"
        )
      ].filter(Boolean);
    }
    case "exchange_district": {
      const walletLive = pickTruthy(walletSession, ["active", "linked"]);
      const payoutState = upperText(payoutStatus.state || payoutStatus.status || "ready");
      const routeState = upperText(routeStatus.state || routeStatus.health || "ready");
      const premiumState = pickTruthy(monetization, ["pass_active", "active", "premium_active"]) ? "ACTIVE" : "READY";
      return [
        buildModalCard("world_modal_lane_wallet_link", walletLive ? "LIVE" : "OPEN", walletLive ? "ready" : "watch", "world_intent_tone_connect"),
        buildModalCard(
          hotspotKey === "premium_lane" ? "world_modal_lane_premium_lane" : "world_modal_lane_payout_lane",
          hotspotKey === "premium_lane" ? premiumState : payoutState,
          resolveFlowStatusKey(hotspotKey === "premium_lane" ? premiumState : payoutState, "ready"),
          hotspotKey === "premium_lane" ? "world_intent_tone_upgrade" : "world_intent_tone_payout"
        ),
        buildModalCard("world_modal_lane_route_matrix", routeState, resolveFlowStatusKey(routeState, "ready"), "world_intent_tone_track")
      ].filter(Boolean);
    }
    case "ops_citadel": {
      const queueDepth = countText(queue.length);
      const sceneHealth = upperText(summary.scene_runtime_health_band_24h || summary.scene_health_band || "clear");
      const dispatchState = upperText(summary.live_ops_scheduler_state || summary.scheduler_state || "ready");
      return [
        buildModalCard("world_modal_lane_queue_review", queueDepth, toNum(queueDepth, 0) > 0 ? "live" : "ready", "world_intent_tone_review"),
        buildModalCard("world_modal_lane_runtime_watch", sceneHealth, resolveFlowStatusKey(sceneHealth, "watch"), "world_intent_tone_monitor"),
        buildModalCard("world_modal_lane_dispatch_gate", dispatchState, resolveFlowStatusKey(dispatchState, "ready"), "world_intent_tone_dispatch")
      ].filter(Boolean);
    }
    default: {
      const missionCount = countText(mission.active_count || mission.offer_count);
      const progress = percentText(season.progress_pct || season.progress || season.completion_pct);
      const walletState = pickTruthy(walletQuick, ["linked", "wallet_linked", "active"]) ? "LIVE" : "OPEN";
      return [
        buildModalCard("world_modal_lane_season_arc", progress, progress ? "live" : "ready", "world_intent_tone_travel"),
        buildModalCard(
          hotspotKey === "wallet_port" ? "world_modal_lane_wallet_link" : "world_modal_lane_mission_queue",
          hotspotKey === "wallet_port" ? walletState : missionCount,
          hotspotKey === "wallet_port" ? resolveFlowStatusKey(walletState, "watch") : toNum(missionCount, 0) > 0 ? "live" : "idle",
          hotspotKey === "wallet_port" ? "world_intent_tone_connect" : "world_intent_tone_launch"
        ),
        buildModalCard("world_modal_lane_risk_watch", upperText(risk.band || risk.state || "stable"), resolveFlowStatusKey(risk.band || risk.state, "ready"), "world_intent_tone_track")
      ].filter(Boolean);
    }
  }
}

function buildDistrictInteractionProtocolCards(input, districtKey, activeHotspot) {
  if (!activeHotspot) {
    return [];
  }

  const homeFeed = asRecord(input.homeFeed);
  const season = asRecord(homeFeed.season);
  const mission = asRecord(homeFeed.mission);
  const walletQuick = asRecord(homeFeed.wallet_quick);
  const risk = asRecord(homeFeed.risk);
  const daily = asRecord(homeFeed.daily);
  const contract = asRecord(homeFeed.contract);
  const taskResult = asRecord(input.taskResult);
  const pvpRuntime = asRecord(input.pvpRuntime);
  const leagueOverview = asRecord(input.leagueOverview);
  const dailyDuel = asRecord(leagueOverview.daily_duel);
  const weeklyLadder = asRecord(leagueOverview.weekly_ladder);
  const pvpLive = asRecord(input.pvpLive);
  const diagnostics = asRecord(pvpLive.diagnostics);
  const tick = asRecord(pvpLive.tick);
  const vaultData = asRecord(input.vaultData);
  const walletSession = asRecord(vaultData.wallet_session);
  const payoutStatus = asRecord(vaultData.payout_status);
  const monetization = asRecord(vaultData.monetization_status);
  const routeStatus = asRecord(vaultData.route_status);
  const adminRuntime = asRecord(input.adminRuntime);
  const summary = asRecord(adminRuntime.summary);
  const queue = asList(adminRuntime.queue);
  const hotspotKey = toText(activeHotspot.key, "");

  switch (districtKey) {
    case "arena_prime": {
      const duelPhase = upperText(pvpRuntime.phase || dailyDuel.phase || "idle");
      const ladderCharge = percentText(weeklyLadder.completion_pct || weeklyLadder.rank_progress_pct || weeklyLadder.progress_pct);
      const diagnosticsBand = upperText(diagnostics.category || diagnostics.state || diagnostics.band || "clean");
      const tickTempo = toNum(tick.tempo_ms || tick.tick_ms, Number.NaN);
      return [
        buildModalProtocolCard(
          "world_modal_protocol_duel_boot",
          duelPhase,
          resolveFlowStatusKey(duelPhase, "live"),
          "world_intent_tone_compete",
          SHELL_ACTION_KEY.PLAYER_PVP_DAILY_DUEL,
          "world_modal_protocol_action_enter",
          {
            previewRows: [
              buildFlowStep("world_sheet_metric_duel_phase", duelPhase, resolveFlowStatusKey(duelPhase, "live")),
              buildFlowStep(
                "world_sheet_metric_tick_tempo",
                Number.isFinite(tickTempo) ? `${Math.round(tickTempo)}ms` : "",
                resolveFlowStatusKey(tickTempo, "ready")
              )
            ],
            flowRows: [
              buildFlowStep("world_sheet_metric_ladder_charge", ladderCharge, resolveFlowStatusKey(ladderCharge, "ready")),
              buildFlowStep("world_sheet_metric_diag_band", diagnosticsBand, resolveFlowStatusKey(diagnosticsBand, "ready"))
            ],
            actionItems: [
              buildModalProtocolActionItem(
                SHELL_ACTION_KEY.PLAYER_PVP_DAILY_DUEL,
                "world_modal_protocol_action_enter",
                "world_modal_protocol_duel_boot",
                "world_intent_tone_compete"
              ),
              buildModalProtocolActionItem(
                SHELL_ACTION_KEY.PLAYER_PVP_WEEKLY_LADDER,
                "world_modal_protocol_action_route",
                "world_modal_protocol_ladder_seed",
                "world_intent_tone_climb"
              )
            ],
            flowPods: [
              buildModalProtocolPod("world_modal_lane_duel_sync", duelPhase, resolveFlowStatusKey(duelPhase, "live"), "world_intent_tone_compete", {
                rows: [
                  buildFlowStep("world_sheet_metric_duel_phase", duelPhase, resolveFlowStatusKey(duelPhase, "live")),
                  buildFlowStep(
                    "world_sheet_metric_tick_tempo",
                    Number.isFinite(tickTempo) ? `${Math.round(tickTempo)}ms` : "",
                    resolveFlowStatusKey(tickTempo, "ready")
                  )
                ],
                actionItems: [
                  buildModalProtocolActionItem(
                    SHELL_ACTION_KEY.PLAYER_PVP_DAILY_DUEL,
                    "world_modal_protocol_action_enter",
                    "world_modal_protocol_duel_boot",
                    "world_intent_tone_compete"
                  )
                ]
              }),
              buildModalProtocolPod("world_modal_lane_ladder_charge", ladderCharge, resolveFlowStatusKey(ladderCharge, "ready"), "world_intent_tone_climb", {
                rows: [
                  buildFlowStep("world_sheet_metric_ladder_charge", ladderCharge, resolveFlowStatusKey(ladderCharge, "ready")),
                  buildFlowStep("world_sheet_metric_diag_band", diagnosticsBand, resolveFlowStatusKey(diagnosticsBand, "ready"))
                ],
                actionItems: [
                  buildModalProtocolActionItem(
                    SHELL_ACTION_KEY.PLAYER_PVP_WEEKLY_LADDER,
                    "world_modal_protocol_action_route",
                    "world_modal_protocol_ladder_seed",
                    "world_intent_tone_climb"
                  )
                ]
              })
            ]
          }
        ),
        buildModalProtocolCard(
          "world_modal_protocol_ladder_seed",
          ladderCharge,
          resolveFlowStatusKey(ladderCharge, "ready"),
          "world_intent_tone_climb",
          SHELL_ACTION_KEY.PLAYER_PVP_WEEKLY_LADDER,
          "world_modal_protocol_action_route",
          {
            previewRows: [
              buildFlowStep("world_sheet_metric_ladder_charge", ladderCharge, resolveFlowStatusKey(ladderCharge, "ready")),
              buildFlowStep("world_sheet_metric_duel_phase", duelPhase, resolveFlowStatusKey(duelPhase, "live"))
            ],
            flowRows: [
              buildFlowStep("world_sheet_metric_diag_band", diagnosticsBand, resolveFlowStatusKey(diagnosticsBand, "ready")),
              buildFlowStep(
                "world_sheet_metric_tick_tempo",
                Number.isFinite(tickTempo) ? `${Math.round(tickTempo)}ms` : "",
                resolveFlowStatusKey(tickTempo, "ready")
              )
            ],
            actionItems: [
              buildModalProtocolActionItem(
                SHELL_ACTION_KEY.PLAYER_PVP_WEEKLY_LADDER,
                "world_modal_protocol_action_route",
                "world_modal_protocol_ladder_seed",
                "world_intent_tone_climb"
              ),
              buildModalProtocolActionItem(
                SHELL_ACTION_KEY.PLAYER_PVP_LEADERBOARD,
                "world_modal_protocol_action_scan",
                "world_modal_protocol_telemetry_mesh",
                "world_intent_tone_track"
              )
            ],
            flowPods: [
              buildModalProtocolPod("world_modal_lane_ladder_charge", ladderCharge, resolveFlowStatusKey(ladderCharge, "ready"), "world_intent_tone_climb", {
                rows: [
                  buildFlowStep("world_sheet_metric_ladder_charge", ladderCharge, resolveFlowStatusKey(ladderCharge, "ready")),
                  buildFlowStep("world_sheet_metric_duel_phase", duelPhase, resolveFlowStatusKey(duelPhase, "live"))
                ],
                actionItems: [
                  buildModalProtocolActionItem(
                    SHELL_ACTION_KEY.PLAYER_PVP_WEEKLY_LADDER,
                    "world_modal_protocol_action_route",
                    "world_modal_protocol_ladder_seed",
                    "world_intent_tone_climb"
                  )
                ]
              }),
              buildModalProtocolPod("world_modal_lane_tick_window", Number.isFinite(tickTempo) ? `${Math.round(tickTempo)}ms` : diagnosticsBand, resolveFlowStatusKey(diagnosticsBand || tickTempo, "ready"), "world_intent_tone_track", {
                rows: [
                  buildFlowStep(
                    "world_sheet_metric_tick_tempo",
                    Number.isFinite(tickTempo) ? `${Math.round(tickTempo)}ms` : "",
                    resolveFlowStatusKey(tickTempo, "ready")
                  ),
                  buildFlowStep("world_sheet_metric_diag_band", diagnosticsBand, resolveFlowStatusKey(diagnosticsBand, "ready"))
                ],
                actionItems: [
                  buildModalProtocolActionItem(
                    SHELL_ACTION_KEY.PLAYER_PVP_LEADERBOARD,
                    "world_modal_protocol_action_scan",
                    "world_modal_protocol_telemetry_mesh",
                    "world_intent_tone_track"
                  )
                ]
              })
            ]
          }
        ),
        buildModalProtocolCard(
          hotspotKey === "diagnostics_rail" || hotspotKey === "tick_chamber"
            ? "world_modal_protocol_telemetry_mesh"
            : "world_modal_protocol_tick_mesh",
          Number.isFinite(tickTempo) ? `${Math.round(tickTempo)}ms` : diagnosticsBand,
          resolveFlowStatusKey(diagnosticsBand || tickTempo, "ready"),
          "world_intent_tone_track",
          SHELL_ACTION_KEY.PLAYER_PVP_LEADERBOARD,
          "world_modal_protocol_action_scan",
          {
            previewRows: [
              buildFlowStep("world_sheet_metric_diag_band", diagnosticsBand, resolveFlowStatusKey(diagnosticsBand, "ready")),
              buildFlowStep(
                "world_sheet_metric_tick_tempo",
                Number.isFinite(tickTempo) ? `${Math.round(tickTempo)}ms` : "",
                resolveFlowStatusKey(tickTempo, "ready")
              )
            ],
            flowRows: [
              buildFlowStep("world_sheet_metric_duel_phase", duelPhase, resolveFlowStatusKey(duelPhase, "live")),
              buildFlowStep("world_sheet_metric_ladder_charge", ladderCharge, resolveFlowStatusKey(ladderCharge, "ready"))
            ],
            actionItems: [
              buildModalProtocolActionItem(
                SHELL_ACTION_KEY.PLAYER_PVP_LEADERBOARD,
                "world_modal_protocol_action_scan",
                hotspotKey === "diagnostics_rail" || hotspotKey === "tick_chamber"
                  ? "world_modal_protocol_telemetry_mesh"
                  : "world_modal_protocol_tick_mesh",
                "world_intent_tone_track"
              ),
              buildModalProtocolActionItem(
                SHELL_ACTION_KEY.PLAYER_PVP_DAILY_DUEL,
                "world_modal_protocol_action_enter",
                "world_modal_protocol_duel_boot",
                "world_intent_tone_compete"
              )
            ],
            flowPods: [
              buildModalProtocolPod(
                hotspotKey === "diagnostics_rail" || hotspotKey === "tick_chamber" ? "world_modal_lane_telemetry_scan" : "world_modal_lane_tick_window",
                Number.isFinite(tickTempo) ? `${Math.round(tickTempo)}ms` : diagnosticsBand,
                resolveFlowStatusKey(diagnosticsBand || tickTempo, "ready"),
                "world_intent_tone_track",
                {
                  rows: [
                    buildFlowStep("world_sheet_metric_diag_band", diagnosticsBand, resolveFlowStatusKey(diagnosticsBand, "ready")),
                    buildFlowStep(
                      "world_sheet_metric_tick_tempo",
                      Number.isFinite(tickTempo) ? `${Math.round(tickTempo)}ms` : "",
                      resolveFlowStatusKey(tickTempo, "ready")
                    )
                  ],
                  actionItems: [
                    buildModalProtocolActionItem(
                      SHELL_ACTION_KEY.PLAYER_PVP_LEADERBOARD,
                      "world_modal_protocol_action_scan",
                      hotspotKey === "diagnostics_rail" || hotspotKey === "tick_chamber"
                        ? "world_modal_protocol_telemetry_mesh"
                        : "world_modal_protocol_tick_mesh",
                      "world_intent_tone_track"
                    )
                  ]
                }
              ),
              buildModalProtocolPod("world_modal_lane_duel_sync", duelPhase, resolveFlowStatusKey(duelPhase, "live"), "world_intent_tone_compete", {
                rows: [
                  buildFlowStep("world_sheet_metric_duel_phase", duelPhase, resolveFlowStatusKey(duelPhase, "live")),
                  buildFlowStep("world_sheet_metric_ladder_charge", ladderCharge, resolveFlowStatusKey(ladderCharge, "ready"))
                ],
                actionItems: [
                  buildModalProtocolActionItem(
                    SHELL_ACTION_KEY.PLAYER_PVP_DAILY_DUEL,
                    "world_modal_protocol_action_enter",
                    "world_modal_protocol_duel_boot",
                    "world_intent_tone_compete"
                  )
                ]
              })
            ]
          }
        )
      ].filter(Boolean);
    }
    case "mission_quarter": {
      const offerCount = countText(taskResult.offer_count || taskResult.offers_count || mission.offer_count || mission.active_count);
      const claimableCount = countText(taskResult.claimable_count || mission.claimable_count);
      const contractBand = upperText(contract.band || contract.state || "open");
      const streakValue = countText(daily.streak_days || daily.streak);
      return [
        buildModalProtocolCard(
          "world_modal_protocol_offer_grid",
          offerCount || "0",
          toNum(offerCount, 0) > 0 ? "live" : "idle",
          "world_intent_tone_launch",
          SHELL_ACTION_KEY.PLAYER_TASKS_BOARD,
          "world_modal_protocol_action_open",
          {
            previewRows: [
              buildFlowStep("world_sheet_metric_offer_count", offerCount || "0", toNum(offerCount, 0) > 0 ? "live" : "idle"),
              buildFlowStep("world_sheet_metric_contract_band", contractBand, resolveFlowStatusKey(contractBand, "watch"))
            ],
            flowRows: [
              buildFlowStep("world_sheet_metric_claimable", claimableCount || "0", claimableCount ? "ready" : "idle"),
              buildFlowStep("world_sheet_metric_streak", streakValue ? `${streakValue}d` : "0d", toNum(streakValue, 0) > 0 ? "live" : "idle")
            ],
            actionItems: [
              buildModalProtocolActionItem(
                SHELL_ACTION_KEY.PLAYER_TASKS_BOARD,
                "world_modal_protocol_action_open",
                "world_modal_protocol_offer_grid",
                "world_intent_tone_launch"
              ),
              buildModalProtocolActionItem(
                SHELL_ACTION_KEY.PLAYER_TASKS_CLAIMS,
                "world_modal_protocol_action_claim",
                "world_modal_protocol_claim_sync",
                "world_intent_tone_claim"
              )
            ],
            flowPods: [
              buildModalProtocolPod("world_modal_lane_offer_stack", offerCount || "0", toNum(offerCount, 0) > 0 ? "live" : "idle", "world_intent_tone_launch", {
                rows: [
                  buildFlowStep("world_sheet_metric_offer_count", offerCount || "0", toNum(offerCount, 0) > 0 ? "live" : "idle"),
                  buildFlowStep("world_sheet_metric_contract_band", contractBand, resolveFlowStatusKey(contractBand, "watch"))
                ],
                actionItems: [
                  buildModalProtocolActionItem(
                    SHELL_ACTION_KEY.PLAYER_TASKS_BOARD,
                    "world_modal_protocol_action_open",
                    "world_modal_protocol_offer_grid",
                    "world_intent_tone_launch"
                  )
                ]
              }),
              buildModalProtocolPod("world_modal_lane_claim_lane", claimableCount || "0", claimableCount ? "ready" : "idle", "world_intent_tone_claim", {
                rows: [
                  buildFlowStep("world_sheet_metric_claimable", claimableCount || "0", claimableCount ? "ready" : "idle"),
                  buildFlowStep("world_sheet_metric_streak", streakValue ? `${streakValue}d` : "0d", toNum(streakValue, 0) > 0 ? "live" : "idle")
                ],
                actionItems: [
                  buildModalProtocolActionItem(
                    SHELL_ACTION_KEY.PLAYER_TASKS_CLAIMS,
                    "world_modal_protocol_action_claim",
                    "world_modal_protocol_claim_sync",
                    "world_intent_tone_claim"
                  )
                ]
              })
            ]
          }
        ),
        buildModalProtocolCard(
          hotspotKey === "claim_dais" ? "world_modal_protocol_claim_sync" : "world_modal_protocol_contract_sync",
          claimableCount || contractBand,
          claimableCount ? "ready" : resolveFlowStatusKey(contractBand, "watch"),
          hotspotKey === "claim_dais" ? "world_intent_tone_claim" : "world_intent_tone_launch",
          SHELL_ACTION_KEY.PLAYER_TASKS_CLAIMS,
          hotspotKey === "claim_dais" ? "world_modal_protocol_action_claim" : "world_modal_protocol_action_route",
          {
            previewRows: [
              buildFlowStep("world_sheet_metric_claimable", claimableCount || "0", claimableCount ? "ready" : "idle"),
              buildFlowStep("world_sheet_metric_contract_band", contractBand, resolveFlowStatusKey(contractBand, "watch"))
            ],
            flowRows: [
              buildFlowStep("world_sheet_metric_offer_count", offerCount || "0", toNum(offerCount, 0) > 0 ? "live" : "idle"),
              buildFlowStep("world_sheet_metric_streak", streakValue ? `${streakValue}d` : "0d", toNum(streakValue, 0) > 0 ? "live" : "idle")
            ],
            actionItems: [
              buildModalProtocolActionItem(
                SHELL_ACTION_KEY.PLAYER_TASKS_CLAIMS,
                hotspotKey === "claim_dais" ? "world_modal_protocol_action_claim" : "world_modal_protocol_action_route",
                hotspotKey === "claim_dais" ? "world_modal_protocol_claim_sync" : "world_modal_protocol_contract_sync",
                hotspotKey === "claim_dais" ? "world_intent_tone_claim" : "world_intent_tone_launch"
              ),
              buildModalProtocolActionItem(
                SHELL_ACTION_KEY.PLAYER_TASKS_BOARD,
                "world_modal_protocol_action_open",
                "world_modal_protocol_offer_grid",
                "world_intent_tone_launch"
              )
            ],
            flowPods: [
              buildModalProtocolPod(
                hotspotKey === "claim_dais" ? "world_modal_lane_claim_lane" : "world_modal_lane_contract_pulse",
                claimableCount || contractBand,
                claimableCount ? "ready" : resolveFlowStatusKey(contractBand, "watch"),
                hotspotKey === "claim_dais" ? "world_intent_tone_claim" : "world_intent_tone_launch",
                {
                  rows: [
                    buildFlowStep("world_sheet_metric_claimable", claimableCount || "0", claimableCount ? "ready" : "idle"),
                    buildFlowStep("world_sheet_metric_contract_band", contractBand, resolveFlowStatusKey(contractBand, "watch"))
                  ],
                  actionItems: [
                    buildModalProtocolActionItem(
                      SHELL_ACTION_KEY.PLAYER_TASKS_CLAIMS,
                      hotspotKey === "claim_dais" ? "world_modal_protocol_action_claim" : "world_modal_protocol_action_route",
                      hotspotKey === "claim_dais" ? "world_modal_protocol_claim_sync" : "world_modal_protocol_contract_sync",
                      hotspotKey === "claim_dais" ? "world_intent_tone_claim" : "world_intent_tone_launch"
                    )
                  ]
                }
              ),
              buildModalProtocolPod("world_modal_lane_offer_stack", offerCount || "0", toNum(offerCount, 0) > 0 ? "live" : "idle", "world_intent_tone_launch", {
                rows: [
                  buildFlowStep("world_sheet_metric_offer_count", offerCount || "0", toNum(offerCount, 0) > 0 ? "live" : "idle"),
                  buildFlowStep("world_sheet_metric_streak", streakValue ? `${streakValue}d` : "0d", toNum(streakValue, 0) > 0 ? "live" : "idle")
                ],
                actionItems: [
                  buildModalProtocolActionItem(
                    SHELL_ACTION_KEY.PLAYER_TASKS_BOARD,
                    "world_modal_protocol_action_open",
                    "world_modal_protocol_offer_grid",
                    "world_intent_tone_launch"
                  )
                ]
              })
            ]
          }
        ),
        buildModalProtocolCard(
          "world_modal_protocol_streak_guard",
          streakValue ? `${streakValue}d` : "0d",
          toNum(streakValue, 0) > 0 ? "live" : "idle",
          "world_intent_tone_claim",
          SHELL_ACTION_KEY.PLAYER_TASKS_BOARD,
          "world_modal_protocol_action_sync",
          {
            previewRows: [
              buildFlowStep("world_sheet_metric_streak", streakValue ? `${streakValue}d` : "0d", toNum(streakValue, 0) > 0 ? "live" : "idle"),
              buildFlowStep("world_sheet_metric_claimable", claimableCount || "0", claimableCount ? "ready" : "idle")
            ],
            flowRows: [
              buildFlowStep("world_sheet_metric_offer_count", offerCount || "0", toNum(offerCount, 0) > 0 ? "live" : "idle"),
              buildFlowStep("world_sheet_metric_contract_band", contractBand, resolveFlowStatusKey(contractBand, "watch"))
            ],
            actionItems: [
              buildModalProtocolActionItem(
                SHELL_ACTION_KEY.PLAYER_TASKS_BOARD,
                "world_modal_protocol_action_sync",
                "world_modal_protocol_streak_guard",
                "world_intent_tone_claim"
              ),
              buildModalProtocolActionItem(
                SHELL_ACTION_KEY.PLAYER_TASKS_CLAIMS,
                "world_modal_protocol_action_claim",
                "world_modal_protocol_claim_sync",
                "world_intent_tone_claim"
              )
            ],
            flowPods: [
              buildModalProtocolPod("world_modal_lane_streak_pulse", streakValue ? `${streakValue}d` : "0d", toNum(streakValue, 0) > 0 ? "live" : "idle", "world_intent_tone_claim", {
                rows: [
                  buildFlowStep("world_sheet_metric_streak", streakValue ? `${streakValue}d` : "0d", toNum(streakValue, 0) > 0 ? "live" : "idle"),
                  buildFlowStep("world_sheet_metric_claimable", claimableCount || "0", claimableCount ? "ready" : "idle")
                ],
                actionItems: [
                  buildModalProtocolActionItem(
                    SHELL_ACTION_KEY.PLAYER_TASKS_BOARD,
                    "world_modal_protocol_action_sync",
                    "world_modal_protocol_streak_guard",
                    "world_intent_tone_claim"
                  )
                ]
              }),
              buildModalProtocolPod("world_modal_lane_contract_pulse", contractBand, resolveFlowStatusKey(contractBand, "watch"), "world_intent_tone_launch", {
                rows: [
                  buildFlowStep("world_sheet_metric_contract_band", contractBand, resolveFlowStatusKey(contractBand, "watch")),
                  buildFlowStep("world_sheet_metric_offer_count", offerCount || "0", toNum(offerCount, 0) > 0 ? "live" : "idle")
                ],
                actionItems: [
                  buildModalProtocolActionItem(
                    SHELL_ACTION_KEY.PLAYER_TASKS_CLAIMS,
                    "world_modal_protocol_action_claim",
                    "world_modal_protocol_claim_sync",
                    "world_intent_tone_claim"
                  )
                ]
              })
            ]
          }
        )
      ].filter(Boolean);
    }
    case "exchange_district": {
      const walletLive = pickTruthy(walletSession, ["active", "linked"]);
      const walletQuickLive = pickTruthy(walletQuick, ["linked", "wallet_linked", "active"]);
      const payoutState = upperText(payoutStatus.state || payoutStatus.status || "ready");
      const routeState = upperText(routeStatus.state || routeStatus.health || "ready");
      const premiumState = pickTruthy(monetization, ["pass_active", "active", "premium_active"]) ? "ACTIVE" : "READY";
      return [
        buildModalProtocolCard(
          "world_modal_protocol_wallet_auth",
          walletLive || walletQuickLive ? "LIVE" : "OPEN",
          walletLive || walletQuickLive ? "ready" : "watch",
          "world_intent_tone_connect",
          SHELL_ACTION_KEY.PLAYER_WALLET_CONNECT,
          "world_modal_protocol_action_link",
          {
            previewRows: [
              buildFlowStep("world_sheet_metric_wallet_state", walletLive || walletQuickLive ? "LIVE" : "OPEN", walletLive || walletQuickLive ? "ready" : "watch"),
              buildFlowStep("world_sheet_metric_route_state", routeState, resolveFlowStatusKey(routeState, "ready"))
            ],
            flowRows: [
              buildFlowStep("world_sheet_metric_payout_state", payoutState, resolveFlowStatusKey(payoutState, "ready")),
              buildFlowStep("world_sheet_metric_premium_state", premiumState, resolveFlowStatusKey(premiumState, "ready"))
            ],
            actionItems: [
              buildModalProtocolActionItem(
                SHELL_ACTION_KEY.PLAYER_WALLET_CONNECT,
                "world_modal_protocol_action_link",
                "world_modal_protocol_wallet_auth",
                "world_intent_tone_connect"
              ),
              buildModalProtocolActionItem(
                SHELL_ACTION_KEY.PLAYER_REWARDS_PANEL,
                "world_modal_protocol_action_scan",
                "world_modal_protocol_route_matrix",
                "world_intent_tone_track"
              )
            ],
            flowPods: [
              buildModalProtocolPod("world_modal_lane_wallet_link", walletLive || walletQuickLive ? "LIVE" : "OPEN", walletLive || walletQuickLive ? "ready" : "watch", "world_intent_tone_connect", {
                rows: [
                  buildFlowStep("world_sheet_metric_wallet_state", walletLive || walletQuickLive ? "LIVE" : "OPEN", walletLive || walletQuickLive ? "ready" : "watch"),
                  buildFlowStep("world_sheet_metric_route_state", routeState, resolveFlowStatusKey(routeState, "ready"))
                ],
                actionItems: [
                  buildModalProtocolActionItem(
                    SHELL_ACTION_KEY.PLAYER_WALLET_CONNECT,
                    "world_modal_protocol_action_link",
                    "world_modal_protocol_wallet_auth",
                    "world_intent_tone_connect"
                  )
                ]
              }),
              buildModalProtocolPod("world_modal_lane_route_matrix", routeState, resolveFlowStatusKey(routeState, "ready"), "world_intent_tone_track", {
                rows: [
                  buildFlowStep("world_sheet_metric_route_state", routeState, resolveFlowStatusKey(routeState, "ready")),
                  buildFlowStep("world_sheet_metric_payout_state", payoutState, resolveFlowStatusKey(payoutState, "ready"))
                ],
                actionItems: [
                  buildModalProtocolActionItem(
                    SHELL_ACTION_KEY.PLAYER_REWARDS_PANEL,
                    "world_modal_protocol_action_scan",
                    "world_modal_protocol_route_matrix",
                    "world_intent_tone_track"
                  )
                ]
              })
            ]
          }
        ),
        buildModalProtocolCard(
          hotspotKey === "premium_lane" ? "world_modal_protocol_premium_unlock" : "world_modal_protocol_payout_route",
          hotspotKey === "premium_lane" ? premiumState : payoutState,
          resolveFlowStatusKey(hotspotKey === "premium_lane" ? premiumState : payoutState, "ready"),
          hotspotKey === "premium_lane" ? "world_intent_tone_upgrade" : "world_intent_tone_payout",
          hotspotKey === "premium_lane" ? SHELL_ACTION_KEY.PLAYER_REWARDS_PANEL : SHELL_ACTION_KEY.PLAYER_PAYOUT_REQUEST,
          hotspotKey === "premium_lane" ? "world_modal_protocol_action_upgrade" : "world_modal_protocol_action_route",
          {
            previewRows: [
              buildFlowStep(
                hotspotKey === "premium_lane" ? "world_sheet_metric_premium_state" : "world_sheet_metric_payout_state",
                hotspotKey === "premium_lane" ? premiumState : payoutState,
                resolveFlowStatusKey(hotspotKey === "premium_lane" ? premiumState : payoutState, "ready")
              ),
              buildFlowStep("world_sheet_metric_route_state", routeState, resolveFlowStatusKey(routeState, "ready"))
            ],
            flowRows: [
              buildFlowStep("world_sheet_metric_wallet_state", walletLive || walletQuickLive ? "LIVE" : "OPEN", walletLive || walletQuickLive ? "ready" : "watch"),
              buildFlowStep("world_sheet_metric_premium_state", premiumState, resolveFlowStatusKey(premiumState, "ready"))
            ],
            actionItems: [
              buildModalProtocolActionItem(
                hotspotKey === "premium_lane" ? SHELL_ACTION_KEY.PLAYER_REWARDS_PANEL : SHELL_ACTION_KEY.PLAYER_PAYOUT_REQUEST,
                hotspotKey === "premium_lane" ? "world_modal_protocol_action_upgrade" : "world_modal_protocol_action_route",
                hotspotKey === "premium_lane" ? "world_modal_protocol_premium_unlock" : "world_modal_protocol_payout_route",
                hotspotKey === "premium_lane" ? "world_intent_tone_upgrade" : "world_intent_tone_payout"
              ),
              buildModalProtocolActionItem(
                SHELL_ACTION_KEY.PLAYER_WALLET_CONNECT,
                "world_modal_protocol_action_link",
                "world_modal_protocol_wallet_auth",
                "world_intent_tone_connect"
              )
            ],
            flowPods: [
              buildModalProtocolPod(
                hotspotKey === "premium_lane" ? "world_modal_lane_premium_lane" : "world_modal_lane_payout_lane",
                hotspotKey === "premium_lane" ? premiumState : payoutState,
                resolveFlowStatusKey(hotspotKey === "premium_lane" ? premiumState : payoutState, "ready"),
                hotspotKey === "premium_lane" ? "world_intent_tone_upgrade" : "world_intent_tone_payout",
                {
                  rows: [
                    buildFlowStep(
                      hotspotKey === "premium_lane" ? "world_sheet_metric_premium_state" : "world_sheet_metric_payout_state",
                      hotspotKey === "premium_lane" ? premiumState : payoutState,
                      resolveFlowStatusKey(hotspotKey === "premium_lane" ? premiumState : payoutState, "ready")
                    ),
                    buildFlowStep("world_sheet_metric_route_state", routeState, resolveFlowStatusKey(routeState, "ready"))
                  ],
                  actionItems: [
                    buildModalProtocolActionItem(
                      hotspotKey === "premium_lane" ? SHELL_ACTION_KEY.PLAYER_REWARDS_PANEL : SHELL_ACTION_KEY.PLAYER_PAYOUT_REQUEST,
                      hotspotKey === "premium_lane" ? "world_modal_protocol_action_upgrade" : "world_modal_protocol_action_route",
                      hotspotKey === "premium_lane" ? "world_modal_protocol_premium_unlock" : "world_modal_protocol_payout_route",
                      hotspotKey === "premium_lane" ? "world_intent_tone_upgrade" : "world_intent_tone_payout"
                    )
                  ]
                }
              ),
              buildModalProtocolPod("world_modal_lane_wallet_link", walletLive || walletQuickLive ? "LIVE" : "OPEN", walletLive || walletQuickLive ? "ready" : "watch", "world_intent_tone_connect", {
                rows: [
                  buildFlowStep("world_sheet_metric_wallet_state", walletLive || walletQuickLive ? "LIVE" : "OPEN", walletLive || walletQuickLive ? "ready" : "watch"),
                  buildFlowStep("world_sheet_metric_premium_state", premiumState, resolveFlowStatusKey(premiumState, "ready"))
                ],
                actionItems: [
                  buildModalProtocolActionItem(
                    SHELL_ACTION_KEY.PLAYER_WALLET_CONNECT,
                    "world_modal_protocol_action_link",
                    "world_modal_protocol_wallet_auth",
                    "world_intent_tone_connect"
                  )
                ]
              })
            ]
          }
        ),
        buildModalProtocolCard(
          "world_modal_protocol_route_matrix",
          routeState,
          resolveFlowStatusKey(routeState, "ready"),
          "world_intent_tone_track",
          SHELL_ACTION_KEY.PLAYER_REWARDS_PANEL,
          "world_modal_protocol_action_scan",
          {
            previewRows: [
              buildFlowStep("world_sheet_metric_route_state", routeState, resolveFlowStatusKey(routeState, "ready")),
              buildFlowStep("world_sheet_metric_payout_state", payoutState, resolveFlowStatusKey(payoutState, "ready"))
            ],
            flowRows: [
              buildFlowStep("world_sheet_metric_wallet_state", walletLive || walletQuickLive ? "LIVE" : "OPEN", walletLive || walletQuickLive ? "ready" : "watch"),
              buildFlowStep("world_sheet_metric_premium_state", premiumState, resolveFlowStatusKey(premiumState, "ready"))
            ],
            actionItems: [
              buildModalProtocolActionItem(
                SHELL_ACTION_KEY.PLAYER_REWARDS_PANEL,
                "world_modal_protocol_action_scan",
                "world_modal_protocol_route_matrix",
                "world_intent_tone_track"
              ),
              buildModalProtocolActionItem(
                SHELL_ACTION_KEY.PLAYER_PAYOUT_REQUEST,
                "world_modal_protocol_action_route",
                "world_modal_protocol_payout_route",
                "world_intent_tone_payout"
              )
            ],
            flowPods: [
              buildModalProtocolPod("world_modal_lane_route_matrix", routeState, resolveFlowStatusKey(routeState, "ready"), "world_intent_tone_track", {
                rows: [
                  buildFlowStep("world_sheet_metric_route_state", routeState, resolveFlowStatusKey(routeState, "ready")),
                  buildFlowStep("world_sheet_metric_payout_state", payoutState, resolveFlowStatusKey(payoutState, "ready"))
                ],
                actionItems: [
                  buildModalProtocolActionItem(
                    SHELL_ACTION_KEY.PLAYER_REWARDS_PANEL,
                    "world_modal_protocol_action_scan",
                    "world_modal_protocol_route_matrix",
                    "world_intent_tone_track"
                  )
                ]
              }),
              buildModalProtocolPod("world_modal_lane_payout_lane", payoutState, resolveFlowStatusKey(payoutState, "ready"), "world_intent_tone_payout", {
                rows: [
                  buildFlowStep("world_sheet_metric_payout_state", payoutState, resolveFlowStatusKey(payoutState, "ready")),
                  buildFlowStep("world_sheet_metric_wallet_state", walletLive || walletQuickLive ? "LIVE" : "OPEN", walletLive || walletQuickLive ? "ready" : "watch")
                ],
                actionItems: [
                  buildModalProtocolActionItem(
                    SHELL_ACTION_KEY.PLAYER_PAYOUT_REQUEST,
                    "world_modal_protocol_action_route",
                    "world_modal_protocol_payout_route",
                    "world_intent_tone_payout"
                  )
                ]
              })
            ]
          }
        )
      ].filter(Boolean);
    }
    case "ops_citadel": {
      const queueDepth = countText(queue.length);
      const sceneHealth = upperText(summary.scene_runtime_health_band_24h || summary.scene_health_band || "clear");
      const dispatchState = upperText(summary.live_ops_scheduler_state || summary.scheduler_state || "ready");
      return [
        buildModalProtocolCard(
          "world_modal_protocol_queue_audit",
          queueDepth || "0",
          toNum(queueDepth, 0) > 0 ? "live" : "ready",
          "world_intent_tone_review",
          SHELL_ACTION_KEY.ADMIN_QUEUE_PANEL,
          "world_modal_protocol_action_review",
          {
            previewRows: [
              buildFlowStep("world_sheet_metric_queue_depth", queueDepth || "0", toNum(queueDepth, 0) > 0 ? "live" : "ready"),
              buildFlowStep("world_sheet_metric_scene_health", sceneHealth, resolveFlowStatusKey(sceneHealth, "watch"))
            ],
            flowRows: [
              buildFlowStep("world_sheet_metric_alerts", countText(summary.ops_alert_raised_24h || summary.alerts_24h || 0), "watch"),
              buildFlowStep("world_sheet_metric_liveops_sent", countText(summary.live_ops_sent_24h || summary.sent_24h || 0), "ready")
            ],
            actionItems: [
              buildModalProtocolActionItem(
                SHELL_ACTION_KEY.ADMIN_QUEUE_PANEL,
                "world_modal_protocol_action_review",
                "world_modal_protocol_queue_audit",
                "world_intent_tone_review"
              ),
              buildModalProtocolActionItem(
                SHELL_ACTION_KEY.ADMIN_RUNTIME_META,
                "world_modal_protocol_action_monitor",
                "world_modal_protocol_runtime_shield",
                "world_intent_tone_monitor"
              )
            ],
            flowPods: [
              buildModalProtocolPod("world_modal_lane_queue_review", queueDepth || "0", toNum(queueDepth, 0) > 0 ? "live" : "ready", "world_intent_tone_review", {
                rows: [
                  buildFlowStep("world_sheet_metric_queue_depth", queueDepth || "0", toNum(queueDepth, 0) > 0 ? "live" : "ready"),
                  buildFlowStep("world_sheet_metric_scene_health", sceneHealth, resolveFlowStatusKey(sceneHealth, "watch"))
                ],
                actionItems: [
                  buildModalProtocolActionItem(
                    SHELL_ACTION_KEY.ADMIN_QUEUE_PANEL,
                    "world_modal_protocol_action_review",
                    "world_modal_protocol_queue_audit",
                    "world_intent_tone_review"
                  )
                ]
              }),
              buildModalProtocolPod("world_modal_lane_runtime_watch", sceneHealth, resolveFlowStatusKey(sceneHealth, "watch"), "world_intent_tone_monitor", {
                rows: [
                  buildFlowStep("world_sheet_metric_scene_health", sceneHealth, resolveFlowStatusKey(sceneHealth, "watch")),
                  buildFlowStep("world_sheet_metric_alerts", countText(summary.ops_alert_raised_24h || summary.alerts_24h || 0), "watch")
                ],
                actionItems: [
                  buildModalProtocolActionItem(
                    SHELL_ACTION_KEY.ADMIN_RUNTIME_META,
                    "world_modal_protocol_action_monitor",
                    "world_modal_protocol_runtime_shield",
                    "world_intent_tone_monitor"
                  )
                ]
              })
            ]
          }
        ),
        buildModalProtocolCard(
          "world_modal_protocol_runtime_shield",
          sceneHealth,
          resolveFlowStatusKey(sceneHealth, "watch"),
          "world_intent_tone_monitor",
          SHELL_ACTION_KEY.ADMIN_RUNTIME_META,
          "world_modal_protocol_action_monitor",
          {
            previewRows: [
              buildFlowStep("world_sheet_metric_scene_health", sceneHealth, resolveFlowStatusKey(sceneHealth, "watch")),
              buildFlowStep("world_sheet_metric_alerts", countText(summary.ops_alert_raised_24h || summary.alerts_24h || 0), "watch")
            ],
            flowRows: [
              buildFlowStep("world_sheet_metric_liveops_sent", countText(summary.live_ops_sent_24h || summary.sent_24h || 0), "ready"),
              buildFlowStep("world_sheet_metric_queue_depth", queueDepth || "0", toNum(queueDepth, 0) > 0 ? "live" : "ready")
            ],
            actionItems: [
              buildModalProtocolActionItem(
                SHELL_ACTION_KEY.ADMIN_RUNTIME_META,
                "world_modal_protocol_action_monitor",
                "world_modal_protocol_runtime_shield",
                "world_intent_tone_monitor"
              ),
              buildModalProtocolActionItem(
                SHELL_ACTION_KEY.ADMIN_RUNTIME_FLAGS,
                "world_modal_protocol_action_route",
                "world_modal_protocol_runtime_shield",
                "world_intent_tone_monitor"
              )
            ],
            flowPods: [
              buildModalProtocolPod("world_modal_lane_runtime_watch", sceneHealth, resolveFlowStatusKey(sceneHealth, "watch"), "world_intent_tone_monitor", {
                rows: [
                  buildFlowStep("world_sheet_metric_scene_health", sceneHealth, resolveFlowStatusKey(sceneHealth, "watch")),
                  buildFlowStep("world_sheet_metric_alerts", countText(summary.ops_alert_raised_24h || summary.alerts_24h || 0), "watch")
                ],
                actionItems: [
                  buildModalProtocolActionItem(
                    SHELL_ACTION_KEY.ADMIN_RUNTIME_META,
                    "world_modal_protocol_action_monitor",
                    "world_modal_protocol_runtime_shield",
                    "world_intent_tone_monitor"
                  )
                ]
              }),
              buildModalProtocolPod("world_modal_lane_queue_review", queueDepth || "0", toNum(queueDepth, 0) > 0 ? "live" : "ready", "world_intent_tone_review", {
                rows: [
                  buildFlowStep("world_sheet_metric_queue_depth", queueDepth || "0", toNum(queueDepth, 0) > 0 ? "live" : "ready"),
                  buildFlowStep("world_sheet_metric_liveops_sent", countText(summary.live_ops_sent_24h || summary.sent_24h || 0), "ready")
                ],
                actionItems: [
                  buildModalProtocolActionItem(
                    SHELL_ACTION_KEY.ADMIN_RUNTIME_FLAGS,
                    "world_modal_protocol_action_route",
                    "world_modal_protocol_runtime_shield",
                    "world_intent_tone_monitor"
                  )
                ]
              })
            ]
          }
        ),
        buildModalProtocolCard(
          "world_modal_protocol_dispatch_guard",
          dispatchState,
          resolveFlowStatusKey(dispatchState, "ready"),
          "world_intent_tone_dispatch",
          SHELL_ACTION_KEY.ADMIN_LIVE_OPS_PANEL,
          "world_modal_protocol_action_dispatch",
          {
            previewRows: [
              buildFlowStep("world_sheet_metric_liveops_sent", countText(summary.live_ops_sent_24h || summary.sent_24h || 0), "ready"),
              buildFlowStep("world_sheet_metric_scene_health", sceneHealth, resolveFlowStatusKey(sceneHealth, "watch"))
            ],
            flowRows: [
              buildFlowStep("world_sheet_metric_queue_depth", queueDepth || "0", toNum(queueDepth, 0) > 0 ? "live" : "ready"),
              buildFlowStep("world_sheet_metric_alerts", countText(summary.ops_alert_raised_24h || summary.alerts_24h || 0), "watch")
            ],
            actionItems: [
              buildModalProtocolActionItem(
                SHELL_ACTION_KEY.ADMIN_LIVE_OPS_PANEL,
                "world_modal_protocol_action_dispatch",
                "world_modal_protocol_dispatch_guard",
                "world_intent_tone_dispatch"
              ),
              buildModalProtocolActionItem(
                SHELL_ACTION_KEY.ADMIN_RUNTIME_META,
                "world_modal_protocol_action_monitor",
                "world_modal_protocol_runtime_shield",
                "world_intent_tone_monitor"
              )
            ],
            flowPods: [
              buildModalProtocolPod("world_modal_lane_dispatch_gate", dispatchState, resolveFlowStatusKey(dispatchState, "ready"), "world_intent_tone_dispatch", {
                rows: [
                  buildFlowStep("world_sheet_metric_liveops_sent", countText(summary.live_ops_sent_24h || summary.sent_24h || 0), "ready"),
                  buildFlowStep("world_sheet_metric_scene_health", sceneHealth, resolveFlowStatusKey(sceneHealth, "watch"))
                ],
                actionItems: [
                  buildModalProtocolActionItem(
                    SHELL_ACTION_KEY.ADMIN_LIVE_OPS_PANEL,
                    "world_modal_protocol_action_dispatch",
                    "world_modal_protocol_dispatch_guard",
                    "world_intent_tone_dispatch"
                  )
                ]
              }),
              buildModalProtocolPod("world_modal_lane_runtime_watch", sceneHealth, resolveFlowStatusKey(sceneHealth, "watch"), "world_intent_tone_monitor", {
                rows: [
                  buildFlowStep("world_sheet_metric_scene_health", sceneHealth, resolveFlowStatusKey(sceneHealth, "watch")),
                  buildFlowStep("world_sheet_metric_alerts", countText(summary.ops_alert_raised_24h || summary.alerts_24h || 0), "watch")
                ],
                actionItems: [
                  buildModalProtocolActionItem(
                    SHELL_ACTION_KEY.ADMIN_RUNTIME_META,
                    "world_modal_protocol_action_monitor",
                    "world_modal_protocol_runtime_shield",
                    "world_intent_tone_monitor"
                  )
                ]
              })
            ]
          }
        )
      ].filter(Boolean);
    }
    default: {
      const missionCount = countText(mission.active_count || mission.offer_count);
      const progress = percentText(season.progress_pct || season.progress || season.completion_pct);
      const riskBand = upperText(risk.band || risk.state || "stable");
      const walletState = pickTruthy(walletQuick, ["linked", "wallet_linked", "active"]) ? "LIVE" : "OPEN";
      return [
        buildModalProtocolCard(
          "world_modal_protocol_travel_vector",
          progress || "0%",
          progress ? "live" : "ready",
          "world_intent_tone_travel",
          SHELL_ACTION_KEY.PLAYER_SEASON_HALL,
          "world_modal_protocol_action_route",
          {
            previewRows: [
              buildFlowStep("world_sheet_metric_progress", progress || "0%", progress ? "live" : "ready"),
              buildFlowStep("world_sheet_metric_active_missions", missionCount || "0", toNum(missionCount, 0) > 0 ? "live" : "idle")
            ],
            flowRows: [
              buildFlowStep("world_sheet_metric_risk_band", riskBand, resolveFlowStatusKey(riskBand, "ready")),
              buildFlowStep("world_sheet_metric_wallet_state", walletState, resolveFlowStatusKey(walletState, "watch"))
            ],
            actionItems: [
              buildModalProtocolActionItem(
                SHELL_ACTION_KEY.PLAYER_SEASON_HALL,
                "world_modal_protocol_action_route",
                "world_modal_protocol_travel_vector",
                "world_intent_tone_travel"
              ),
              buildModalProtocolActionItem(
                SHELL_ACTION_KEY.PLAYER_EVENTS_HALL,
                "world_modal_protocol_action_enter",
                "world_modal_protocol_travel_vector",
                "world_intent_tone_travel"
              )
            ],
            flowPods: [
              buildModalProtocolPod("world_modal_lane_season_arc", progress || "0%", progress ? "live" : "ready", "world_intent_tone_travel", {
                rows: [
                  buildFlowStep("world_sheet_metric_progress", progress || "0%", progress ? "live" : "ready"),
                  buildFlowStep("world_sheet_metric_active_missions", missionCount || "0", toNum(missionCount, 0) > 0 ? "live" : "idle")
                ],
                actionItems: [
                  buildModalProtocolActionItem(
                    SHELL_ACTION_KEY.PLAYER_SEASON_HALL,
                    "world_modal_protocol_action_route",
                    "world_modal_protocol_travel_vector",
                    "world_intent_tone_travel"
                  )
                ]
              }),
              buildModalProtocolPod("world_modal_lane_mission_queue", missionCount || "0", toNum(missionCount, 0) > 0 ? "live" : "idle", "world_intent_tone_launch", {
                rows: [
                  buildFlowStep("world_sheet_metric_active_missions", missionCount || "0", toNum(missionCount, 0) > 0 ? "live" : "idle"),
                  buildFlowStep("world_sheet_metric_risk_band", riskBand, resolveFlowStatusKey(riskBand, "ready"))
                ],
                actionItems: [
                  buildModalProtocolActionItem(
                    SHELL_ACTION_KEY.PLAYER_EVENTS_HALL,
                    "world_modal_protocol_action_enter",
                    "world_modal_protocol_travel_vector",
                    "world_intent_tone_travel"
                  )
                ]
              })
            ]
          }
        ),
        buildModalProtocolCard(
          hotspotKey === "wallet_port" ? "world_modal_protocol_wallet_auth" : "world_modal_protocol_mission_sync",
          hotspotKey === "wallet_port" ? walletState : missionCount || "0",
          hotspotKey === "wallet_port" ? resolveFlowStatusKey(walletState, "watch") : toNum(missionCount, 0) > 0 ? "live" : "idle",
          hotspotKey === "wallet_port" ? "world_intent_tone_connect" : "world_intent_tone_launch",
          hotspotKey === "wallet_port" ? SHELL_ACTION_KEY.PLAYER_WALLET_CONNECT : SHELL_ACTION_KEY.PLAYER_TASKS_BOARD,
          hotspotKey === "wallet_port" ? "world_modal_protocol_action_link" : "world_modal_protocol_action_open",
          {
            previewRows: [
              buildFlowStep(
                hotspotKey === "wallet_port" ? "world_sheet_metric_wallet_state" : "world_sheet_metric_active_missions",
                hotspotKey === "wallet_port" ? walletState : missionCount || "0",
                hotspotKey === "wallet_port" ? resolveFlowStatusKey(walletState, "watch") : toNum(missionCount, 0) > 0 ? "live" : "idle"
              ),
              buildFlowStep("world_sheet_metric_risk_band", riskBand, resolveFlowStatusKey(riskBand, "ready"))
            ],
            flowRows: [
              buildFlowStep("world_sheet_metric_progress", progress || "0%", progress ? "live" : "ready"),
              buildFlowStep("world_sheet_metric_wallet_state", walletState, resolveFlowStatusKey(walletState, "watch"))
            ],
            actionItems: [
              buildModalProtocolActionItem(
                hotspotKey === "wallet_port" ? SHELL_ACTION_KEY.PLAYER_WALLET_CONNECT : SHELL_ACTION_KEY.PLAYER_TASKS_BOARD,
                hotspotKey === "wallet_port" ? "world_modal_protocol_action_link" : "world_modal_protocol_action_open",
                hotspotKey === "wallet_port" ? "world_modal_protocol_wallet_auth" : "world_modal_protocol_mission_sync",
                hotspotKey === "wallet_port" ? "world_intent_tone_connect" : "world_intent_tone_launch"
              ),
              buildModalProtocolActionItem(
                SHELL_ACTION_KEY.PLAYER_STATUS_PANEL,
                "world_modal_protocol_action_scan",
                "world_modal_protocol_risk_watch",
                "world_intent_tone_track"
              )
            ],
            flowPods: [
              buildModalProtocolPod(
                hotspotKey === "wallet_port" ? "world_modal_lane_wallet_link" : "world_modal_lane_mission_queue",
                hotspotKey === "wallet_port" ? walletState : missionCount || "0",
                hotspotKey === "wallet_port" ? resolveFlowStatusKey(walletState, "watch") : toNum(missionCount, 0) > 0 ? "live" : "idle",
                hotspotKey === "wallet_port" ? "world_intent_tone_connect" : "world_intent_tone_launch",
                {
                  rows: [
                    buildFlowStep(
                      hotspotKey === "wallet_port" ? "world_sheet_metric_wallet_state" : "world_sheet_metric_active_missions",
                      hotspotKey === "wallet_port" ? walletState : missionCount || "0",
                      hotspotKey === "wallet_port" ? resolveFlowStatusKey(walletState, "watch") : toNum(missionCount, 0) > 0 ? "live" : "idle"
                    ),
                    buildFlowStep("world_sheet_metric_risk_band", riskBand, resolveFlowStatusKey(riskBand, "ready"))
                  ],
                  actionItems: [
                    buildModalProtocolActionItem(
                      hotspotKey === "wallet_port" ? SHELL_ACTION_KEY.PLAYER_WALLET_CONNECT : SHELL_ACTION_KEY.PLAYER_TASKS_BOARD,
                      hotspotKey === "wallet_port" ? "world_modal_protocol_action_link" : "world_modal_protocol_action_open",
                      hotspotKey === "wallet_port" ? "world_modal_protocol_wallet_auth" : "world_modal_protocol_mission_sync",
                      hotspotKey === "wallet_port" ? "world_intent_tone_connect" : "world_intent_tone_launch"
                    )
                  ]
                }
              ),
              buildModalProtocolPod("world_modal_lane_risk_watch", riskBand, resolveFlowStatusKey(riskBand, "ready"), "world_intent_tone_track", {
                rows: [
                  buildFlowStep("world_sheet_metric_risk_band", riskBand, resolveFlowStatusKey(riskBand, "ready")),
                  buildFlowStep("world_sheet_metric_progress", progress || "0%", progress ? "live" : "ready")
                ],
                actionItems: [
                  buildModalProtocolActionItem(
                    SHELL_ACTION_KEY.PLAYER_STATUS_PANEL,
                    "world_modal_protocol_action_scan",
                    "world_modal_protocol_risk_watch",
                    "world_intent_tone_track"
                  )
                ]
              })
            ]
          }
        ),
        buildModalProtocolCard(
          "world_modal_protocol_risk_watch",
          riskBand,
          resolveFlowStatusKey(riskBand, "ready"),
          "world_intent_tone_track",
          SHELL_ACTION_KEY.PLAYER_STATUS_PANEL,
          "world_modal_protocol_action_scan",
          {
            previewRows: [
              buildFlowStep("world_sheet_metric_risk_band", riskBand, resolveFlowStatusKey(riskBand, "ready")),
              buildFlowStep("world_sheet_metric_wallet_state", walletState, resolveFlowStatusKey(walletState, "watch"))
            ],
            flowRows: [
              buildFlowStep("world_sheet_metric_active_missions", missionCount || "0", toNum(missionCount, 0) > 0 ? "live" : "idle"),
              buildFlowStep("world_sheet_metric_progress", progress || "0%", progress ? "live" : "ready")
            ],
            actionItems: [
              buildModalProtocolActionItem(
                SHELL_ACTION_KEY.PLAYER_STATUS_PANEL,
                "world_modal_protocol_action_scan",
                "world_modal_protocol_risk_watch",
                "world_intent_tone_track"
              ),
              buildModalProtocolActionItem(
                SHELL_ACTION_KEY.PLAYER_SUPPORT_STATUS,
                "world_modal_protocol_action_monitor",
                "world_modal_protocol_risk_watch",
                "world_intent_tone_track"
              )
            ],
            flowPods: [
              buildModalProtocolPod("world_modal_lane_risk_watch", riskBand, resolveFlowStatusKey(riskBand, "ready"), "world_intent_tone_track", {
                rows: [
                  buildFlowStep("world_sheet_metric_risk_band", riskBand, resolveFlowStatusKey(riskBand, "ready")),
                  buildFlowStep("world_sheet_metric_wallet_state", walletState, resolveFlowStatusKey(walletState, "watch"))
                ],
                actionItems: [
                  buildModalProtocolActionItem(
                    SHELL_ACTION_KEY.PLAYER_STATUS_PANEL,
                    "world_modal_protocol_action_scan",
                    "world_modal_protocol_risk_watch",
                    "world_intent_tone_track"
                  )
                ]
              }),
              buildModalProtocolPod("world_modal_lane_season_arc", progress || "0%", progress ? "live" : "ready", "world_intent_tone_travel", {
                rows: [
                  buildFlowStep("world_sheet_metric_progress", progress || "0%", progress ? "live" : "ready"),
                  buildFlowStep("world_sheet_metric_active_missions", missionCount || "0", toNum(missionCount, 0) > 0 ? "live" : "idle")
                ],
                actionItems: [
                  buildModalProtocolActionItem(
                    SHELL_ACTION_KEY.PLAYER_SUPPORT_STATUS,
                    "world_modal_protocol_action_monitor",
                    "world_modal_protocol_risk_watch",
                    "world_intent_tone_track"
                  )
                ]
              })
            ]
          }
        )
      ].filter(Boolean);
    }
  }
}

function buildDistrictInteractionModal(input, districtKey, activeHotspot, interactionTerminal) {
  if (!activeHotspot || !interactionTerminal) {
    return null;
  }

  const hotspotKey = toText(activeHotspot.key, "");
  let modalKindKey = "world_modal_kind_travel_gate";
  let modalClassKey = "travel_gate";

  switch (districtKey) {
    case "arena_prime":
      if (hotspotKey === "ladder_bridge" || hotspotKey === "ranking_orbit") {
        modalKindKey = "world_modal_kind_ladder_sequence";
        modalClassKey = "ladder_sequence";
      } else if (hotspotKey === "diagnostics_rail" || hotspotKey === "tick_chamber") {
        modalKindKey = "world_modal_kind_telemetry_scan";
        modalClassKey = "telemetry_scan";
      } else {
        modalKindKey = "world_modal_kind_duel_sequence";
        modalClassKey = "duel_sequence";
      }
      break;
    case "mission_quarter":
      if (hotspotKey === "claim_dais") {
        modalKindKey = "world_modal_kind_loot_reveal";
        modalClassKey = "loot_reveal";
      } else if (hotspotKey === "streak_pulse" || hotspotKey === "contract_pulse") {
        modalKindKey = "world_modal_kind_streak_sync";
        modalClassKey = "streak_sync";
      } else {
        modalKindKey = "world_modal_kind_contract_sequence";
        modalClassKey = "contract_sequence";
      }
      break;
    case "exchange_district":
      if (hotspotKey === "rewards_vault") {
        modalKindKey = "world_modal_kind_loot_reveal";
        modalClassKey = "loot_reveal";
      } else if (hotspotKey === "premium_lane") {
        modalKindKey = "world_modal_kind_premium_unlock";
        modalClassKey = "premium_unlock";
      } else if (hotspotKey === "payout_bay" || hotspotKey === "support_bay") {
        modalKindKey = "world_modal_kind_payout_route";
        modalClassKey = "payout_route";
      } else {
        modalKindKey = "world_modal_kind_wallet_terminal";
        modalClassKey = "wallet_terminal";
      }
      break;
    case "ops_citadel":
      if (hotspotKey === "liveops_table") {
        modalKindKey = "world_modal_kind_dispatch_sequence";
        modalClassKey = "dispatch_sequence";
      } else if (hotspotKey === "runtime_dais" || hotspotKey === "flags_console" || hotspotKey === "bot_relay") {
        modalKindKey = "world_modal_kind_runtime_scan";
        modalClassKey = "runtime_scan";
      } else {
        modalKindKey = "world_modal_kind_queue_review";
        modalClassKey = "queue_review";
      }
      break;
    default:
      if (hotspotKey === "rewards_cache") {
        modalKindKey = "world_modal_kind_loot_reveal";
        modalClassKey = "loot_reveal";
      } else if (hotspotKey === "wallet_port") {
        modalKindKey = "world_modal_kind_wallet_terminal";
        modalClassKey = "wallet_terminal";
      } else if (hotspotKey === "mission_desk" || hotspotKey === "discover_arc") {
        modalKindKey = "world_modal_kind_mission_terminal";
        modalClassKey = "mission_terminal";
      }
      break;
  }

  const modalCards = buildDistrictInteractionModalCards(input, districtKey, activeHotspot);
  const protocolCards = buildDistrictInteractionProtocolCards(input, districtKey, activeHotspot);

  return {
    modal_key: `${districtKey}:${hotspotKey || "modal"}`,
    modal_kind_key: modalKindKey,
    modal_class_key: modalClassKey,
    status_key: toText(interactionTerminal.status_key, "ready"),
    status_label_key: toText(interactionTerminal.status_label_key, "world_flow_state_ready"),
    title_key: toText(interactionTerminal.terminal_title_key, ""),
    title: toText(interactionTerminal.terminal_title, ""),
    intent_label_key: toText(interactionTerminal.intent_label_key, ""),
    intent_tone_key: toText(interactionTerminal.intent_tone_key, ""),
    hint_label_key: toText(interactionTerminal.hint_label_key, ""),
    stage_label_key: toText(interactionTerminal.stage_label_key, ""),
    stage_value_key: toText(interactionTerminal.stage_value_key, ""),
    readiness_label_key: toText(interactionTerminal.readiness_label_key, ""),
    readiness_value_key: toText(interactionTerminal.readiness_value_key, ""),
    tempo_label_key: toText(interactionTerminal.tempo_label_key, ""),
    tempo_value: toText(interactionTerminal.tempo_value, ""),
    preview_rows: asList(interactionTerminal.preview_rows).slice(0, 3),
    flow_rows: asList(interactionTerminal.flow_rows).slice(0, 3),
    signal_rows: asList(interactionTerminal.signal_rows).slice(0, 4),
    modal_cards: modalCards,
    protocol_cards: protocolCards,
    action_items: asList(interactionTerminal.action_items).slice(0, 3),
    action_count: toNum(interactionTerminal.action_count, 0)
  };
}

function buildProtocolMicroFlowLiveState(sequenceKindKey, input) {
  const homeFeed = asRecord(input.homeFeed);
  const season = asRecord(homeFeed.season);
  const mission = asRecord(homeFeed.mission);
  const walletQuick = asRecord(homeFeed.wallet_quick);
  const daily = asRecord(homeFeed.daily);
  const contract = asRecord(homeFeed.contract);
  const taskResult = asRecord(input.taskResult);
  const pvpRuntime = asRecord(input.pvpRuntime);
  const leagueOverview = asRecord(input.leagueOverview);
  const dailyDuel = asRecord(leagueOverview.daily_duel);
  const weeklyLadder = asRecord(leagueOverview.weekly_ladder);
  const pvpLive = asRecord(input.pvpLive);
  const diagnostics = asRecord(pvpLive.diagnostics);
  const tick = asRecord(pvpLive.tick);
  const vaultData = asRecord(input.vaultData);
  const walletSession = asRecord(vaultData.wallet_session);
  const payoutStatus = asRecord(vaultData.payout_status);
  const monetization = asRecord(vaultData.monetization_status);
  const routeStatus = asRecord(vaultData.route_status);
  const adminRuntime = asRecord(input.adminRuntime);
  const summary = asRecord(adminRuntime.summary);
  const queue = asList(adminRuntime.queue);

  const walletLinked = pickTruthy(walletSession, ["active", "linked"]) || pickTruthy(walletQuick, ["linked", "wallet_linked", "active"]);
  const progress = percentText(season.progress_pct || season.progress || season.completion_pct);
  const missionCount = countText(taskResult.offer_count || taskResult.offers_count || mission.offer_count || mission.active_count);
  const claimableCount = countText(taskResult.claimable_count || mission.claimable_count);
  const streakDays = countText(daily.streak_days || daily.streak);
  const contractBand = upperText(contract.band || contract.state || "OPEN");
  const duelPhase = upperText(pvpRuntime.phase || dailyDuel.phase || "SYNC");
  const ladderCharge = percentText(weeklyLadder.completion_pct || weeklyLadder.rank_progress_pct);
  const diagBand = upperText(diagnostics.category || diagnostics.state || "CLEAN");
  const tickTempoValue = toNum(tick.tempo_ms || tick.tick_ms, Number.NaN);
  const tickTempo = Number.isFinite(tickTempoValue) ? `${Math.round(tickTempoValue)}ms` : "SYNC";
  const payoutState = upperText(payoutStatus.state || payoutStatus.status || "READY");
  const routeState = upperText(routeStatus.state || routeStatus.health || "READY");
  const premiumState = pickTruthy(monetization, ["pass_active", "active", "premium_active"]) ? "ACTIVE" : "READY";
  const sceneHealth = upperText(summary.scene_runtime_health_band_24h || summary.scene_health_band || "READY");
  const schedulerState = upperText(summary.live_ops_scheduler_state || summary.scheduler_state || "READY");
  const liveOpsSent = countText(summary.live_ops_sent_24h || summary.sent_24h);
  const alertCount = countText(summary.ops_alert_raised_24h || summary.alerts_24h);

  switch (sequenceKindKey) {
    case "world_modal_kind_duel_sequence":
      return {
        loop_status_key: resolveFlowStatusKey(duelPhase, "live"),
        loop_status_label_key: flowStatusLabelKey(resolveFlowStatusKey(duelPhase, "live")),
        loop_stage_value: duelPhase,
        loop_rows: [
          buildFlowStep("world_sheet_metric_duel_phase", duelPhase, resolveFlowStatusKey(duelPhase, "live")),
          buildFlowStep("world_sheet_metric_tick_tempo", tickTempo, "live"),
          buildFlowStep("world_sheet_metric_diag_band", diagBand, resolveFlowStatusKey(diagBand, "ready"))
        ].filter(Boolean),
        loop_signal_rows: [
          buildFlowStep("world_sheet_metric_ladder_charge", ladderCharge || "0%", ladderCharge ? "live" : "idle"),
          buildFlowStep("world_sheet_metric_diag_band", diagBand, resolveFlowStatusKey(diagBand, "ready"))
        ].filter(Boolean),
        loop_motion_scalar: duelPhase === "RESOLVE" ? 1.24 : 1.12,
        loop_radius_scale: duelPhase === "RESOLVE" ? 0.94 : 0.98,
        loop_focus_y_offset: duelPhase === "RESOLVE" ? 0.05 : 0.03,
        loop_alpha_offset: duelPhase === "RESOLVE" ? -0.06 : -0.03,
        loop_beta_offset: duelPhase === "RESOLVE" ? 0.03 : 0.01,
        loop_focus_lerp_scalar: duelPhase === "RESOLVE" ? 1.18 : 1.08,
        loop_radius_lerp_scalar: duelPhase === "RESOLVE" ? 1.16 : 1.08
      };
    case "world_modal_kind_ladder_sequence":
      return {
        loop_status_key: resolveFlowStatusKey(weeklyLadder.phase || ladderCharge, "live"),
        loop_status_label_key: flowStatusLabelKey(resolveFlowStatusKey(weeklyLadder.phase || ladderCharge, "live")),
        loop_stage_value: ladderCharge || upperText(weeklyLadder.phase || "LIVE"),
        loop_rows: [
          buildFlowStep("world_sheet_metric_ladder_charge", ladderCharge || "0%", ladderCharge ? "live" : "idle"),
          buildFlowStep("world_sheet_metric_duel_phase", duelPhase, resolveFlowStatusKey(duelPhase, "live")),
          buildFlowStep("world_sheet_metric_tick_tempo", tickTempo, "live")
        ].filter(Boolean),
        loop_signal_rows: [buildFlowStep("world_sheet_metric_diag_band", diagBand, resolveFlowStatusKey(diagBand, "ready"))].filter(Boolean),
        loop_motion_scalar: 1.08,
        loop_radius_scale: 0.98,
        loop_focus_y_offset: 0.02,
        loop_alpha_offset: -0.02,
        loop_beta_offset: 0.01,
        loop_focus_lerp_scalar: 1.04,
        loop_radius_lerp_scalar: 1.06
      };
    case "world_modal_kind_telemetry_scan":
      return {
        loop_status_key: resolveFlowStatusKey(diagBand, "watch"),
        loop_status_label_key: flowStatusLabelKey(resolveFlowStatusKey(diagBand, "watch")),
        loop_stage_value: diagBand,
        loop_rows: [
          buildFlowStep("world_sheet_metric_diag_band", diagBand, resolveFlowStatusKey(diagBand, "watch")),
          buildFlowStep("world_sheet_metric_tick_tempo", tickTempo, "live"),
          buildFlowStep("world_sheet_metric_ladder_charge", ladderCharge || "0%", ladderCharge ? "live" : "idle")
        ].filter(Boolean),
        loop_signal_rows: [buildFlowStep("world_sheet_metric_duel_phase", duelPhase, resolveFlowStatusKey(duelPhase, "live"))].filter(Boolean),
        loop_motion_scalar: 0.92,
        loop_radius_scale: 1.02,
        loop_focus_y_offset: 0.01,
        loop_alpha_offset: 0.02,
        loop_beta_offset: -0.01,
        loop_focus_lerp_scalar: 0.98,
        loop_radius_lerp_scalar: 0.96
      };
    case "world_modal_kind_mission_terminal":
      return {
        loop_status_key: toNum(missionCount, 0) > 0 ? "live" : "idle",
        loop_status_label_key: flowStatusLabelKey(toNum(missionCount, 0) > 0 ? "live" : "idle"),
        loop_stage_value: missionCount ? `${missionCount} LIVE` : "IDLE",
        loop_rows: [
          buildFlowStep("world_sheet_metric_offer_count", missionCount || "0", toNum(missionCount, 0) > 0 ? "live" : "idle"),
          buildFlowStep("world_sheet_metric_contract_band", contractBand, resolveFlowStatusKey(contractBand, "watch")),
          buildFlowStep("world_sheet_metric_claimable", claimableCount || "0", claimableCount ? "ready" : "idle")
        ].filter(Boolean),
        loop_signal_rows: [buildFlowStep("world_sheet_metric_streak", streakDays ? `${streakDays}d` : "0d", toNum(streakDays, 0) > 0 ? "live" : "idle")].filter(Boolean),
        loop_motion_scalar: toNum(missionCount, 0) > 0 ? 1.04 : 0.92,
        loop_radius_scale: toNum(missionCount, 0) > 0 ? 0.98 : 1.02,
        loop_focus_y_offset: 0.02,
        loop_alpha_offset: -0.02,
        loop_beta_offset: 0.01,
        loop_focus_lerp_scalar: 1.04,
        loop_radius_lerp_scalar: 1.02
      };
    case "world_modal_kind_contract_sequence":
      return {
        loop_status_key: claimableCount ? "ready" : resolveFlowStatusKey(contractBand, "watch"),
        loop_status_label_key: flowStatusLabelKey(claimableCount ? "ready" : resolveFlowStatusKey(contractBand, "watch")),
        loop_stage_value: claimableCount ? `${claimableCount} READY` : contractBand,
        loop_rows: [
          buildFlowStep("world_sheet_metric_claimable", claimableCount || "0", claimableCount ? "ready" : "idle"),
          buildFlowStep("world_sheet_metric_contract_band", contractBand, resolveFlowStatusKey(contractBand, "watch")),
          buildFlowStep("world_sheet_metric_streak", streakDays ? `${streakDays}d` : "0d", toNum(streakDays, 0) > 0 ? "live" : "idle")
        ].filter(Boolean),
        loop_signal_rows: [buildFlowStep("world_sheet_metric_offer_count", missionCount || "0", toNum(missionCount, 0) > 0 ? "live" : "idle")].filter(Boolean),
        loop_motion_scalar: claimableCount ? 1.12 : 0.98,
        loop_radius_scale: claimableCount ? 0.94 : 1,
        loop_focus_y_offset: claimableCount ? 0.04 : 0.02,
        loop_alpha_offset: claimableCount ? -0.04 : -0.02,
        loop_beta_offset: claimableCount ? 0.02 : 0.01,
        loop_focus_lerp_scalar: claimableCount ? 1.12 : 1,
        loop_radius_lerp_scalar: claimableCount ? 1.08 : 1
      };
    case "world_modal_kind_streak_sync":
      return {
        loop_status_key: toNum(streakDays, 0) > 0 ? "live" : "idle",
        loop_status_label_key: flowStatusLabelKey(toNum(streakDays, 0) > 0 ? "live" : "idle"),
        loop_stage_value: streakDays ? `${streakDays}D` : "0D",
        loop_rows: [
          buildFlowStep("world_sheet_metric_streak", streakDays ? `${streakDays}d` : "0d", toNum(streakDays, 0) > 0 ? "live" : "idle"),
          buildFlowStep("world_sheet_metric_claimable", claimableCount || "0", claimableCount ? "ready" : "idle"),
          buildFlowStep("world_sheet_metric_offer_count", missionCount || "0", toNum(missionCount, 0) > 0 ? "live" : "idle")
        ].filter(Boolean),
        loop_signal_rows: [buildFlowStep("world_sheet_metric_contract_band", contractBand, resolveFlowStatusKey(contractBand, "watch"))].filter(Boolean),
        loop_motion_scalar: toNum(streakDays, 0) > 0 ? 0.98 : 0.9,
        loop_radius_scale: 1,
        loop_focus_y_offset: 0.01,
        loop_alpha_offset: 0,
        loop_beta_offset: -0.01,
        loop_focus_lerp_scalar: 0.96,
        loop_radius_lerp_scalar: 0.96
      };
    case "world_modal_kind_wallet_terminal":
      return {
        loop_status_key: walletLinked ? "ready" : "watch",
        loop_status_label_key: flowStatusLabelKey(walletLinked ? "ready" : "watch"),
        loop_stage_value: walletLinked ? "LIVE" : "OPEN",
        loop_rows: [
          buildFlowStep("world_sheet_metric_wallet_state", walletLinked ? "LIVE" : "OPEN", walletLinked ? "ready" : "watch"),
          buildFlowStep("world_sheet_metric_route_state", routeState, resolveFlowStatusKey(routeState, "ready")),
          buildFlowStep("world_sheet_metric_payout_state", payoutState, resolveFlowStatusKey(payoutState, "ready"))
        ].filter(Boolean),
        loop_signal_rows: [buildFlowStep("world_sheet_metric_premium_state", premiumState, resolveFlowStatusKey(premiumState, "ready"))].filter(Boolean),
        loop_motion_scalar: walletLinked ? 0.96 : 1.02,
        loop_radius_scale: walletLinked ? 0.98 : 1.02,
        loop_focus_y_offset: 0.02,
        loop_alpha_offset: -0.01,
        loop_beta_offset: 0.01,
        loop_focus_lerp_scalar: 1.02,
        loop_radius_lerp_scalar: 1.02
      };
    case "world_modal_kind_payout_route":
      return {
        loop_status_key: resolveFlowStatusKey(payoutState || routeState, "ready"),
        loop_status_label_key: flowStatusLabelKey(resolveFlowStatusKey(payoutState || routeState, "ready")),
        loop_stage_value: payoutState || routeState,
        loop_rows: [
          buildFlowStep("world_sheet_metric_payout_state", payoutState, resolveFlowStatusKey(payoutState, "ready")),
          buildFlowStep("world_sheet_metric_route_state", routeState, resolveFlowStatusKey(routeState, "ready")),
          buildFlowStep("world_sheet_metric_wallet_state", walletLinked ? "LIVE" : "OPEN", walletLinked ? "ready" : "watch")
        ].filter(Boolean),
        loop_signal_rows: [buildFlowStep("world_sheet_metric_premium_state", premiumState, resolveFlowStatusKey(premiumState, "ready"))].filter(Boolean),
        loop_motion_scalar: payoutState === "LOCKED" ? 0.86 : 0.94,
        loop_radius_scale: payoutState === "LOCKED" ? 1.04 : 0.96,
        loop_focus_y_offset: 0.02,
        loop_alpha_offset: payoutState === "LOCKED" ? 0.02 : -0.02,
        loop_beta_offset: 0.01,
        loop_focus_lerp_scalar: payoutState === "LOCKED" ? 0.94 : 1.04,
        loop_radius_lerp_scalar: payoutState === "LOCKED" ? 0.94 : 1.06
      };
    case "world_modal_kind_premium_unlock":
      return {
        loop_status_key: resolveFlowStatusKey(premiumState, "ready"),
        loop_status_label_key: flowStatusLabelKey(resolveFlowStatusKey(premiumState, "ready")),
        loop_stage_value: premiumState,
        loop_rows: [
          buildFlowStep("world_sheet_metric_premium_state", premiumState, resolveFlowStatusKey(premiumState, "ready")),
          buildFlowStep("world_sheet_metric_route_state", routeState, resolveFlowStatusKey(routeState, "ready")),
          buildFlowStep("world_sheet_metric_wallet_state", walletLinked ? "LIVE" : "OPEN", walletLinked ? "ready" : "watch")
        ].filter(Boolean),
        loop_signal_rows: [buildFlowStep("world_sheet_metric_payout_state", payoutState, resolveFlowStatusKey(payoutState, "ready"))].filter(Boolean),
        loop_motion_scalar: premiumState === "ACTIVE" ? 1.02 : 0.96,
        loop_radius_scale: 0.96,
        loop_focus_y_offset: 0.02,
        loop_alpha_offset: -0.02,
        loop_beta_offset: 0.01,
        loop_focus_lerp_scalar: 1.02,
        loop_radius_lerp_scalar: 1.02
      };
    case "world_modal_kind_queue_review":
      return {
        loop_status_key: toNum(queue.length, 0) > 0 ? "live" : "ready",
        loop_status_label_key: flowStatusLabelKey(toNum(queue.length, 0) > 0 ? "live" : "ready"),
        loop_stage_value: countText(queue.length) || "0",
        loop_rows: [
          buildFlowStep("world_sheet_metric_queue_depth", countText(queue.length) || "0", toNum(queue.length, 0) > 0 ? "live" : "ready"),
          buildFlowStep("world_sheet_metric_scene_health", sceneHealth, resolveFlowStatusKey(sceneHealth, "watch")),
          buildFlowStep("world_sheet_metric_alerts", alertCount || "0", toNum(alertCount, 0) > 0 ? "watch" : "ready")
        ].filter(Boolean),
        loop_signal_rows: [buildFlowStep("world_sheet_metric_liveops_sent", liveOpsSent || "0", toNum(liveOpsSent, 0) > 0 ? "live" : "idle")].filter(Boolean),
        loop_motion_scalar: toNum(queue.length, 0) > 0 ? 0.92 : 0.84,
        loop_radius_scale: 1,
        loop_focus_y_offset: 0.02,
        loop_alpha_offset: 0.02,
        loop_beta_offset: -0.02,
        loop_focus_lerp_scalar: 0.96,
        loop_radius_lerp_scalar: 0.98
      };
    case "world_modal_kind_runtime_scan":
      return {
        loop_status_key: resolveFlowStatusKey(sceneHealth, "watch"),
        loop_status_label_key: flowStatusLabelKey(resolveFlowStatusKey(sceneHealth, "watch")),
        loop_stage_value: sceneHealth,
        loop_rows: [
          buildFlowStep("world_sheet_metric_scene_health", sceneHealth, resolveFlowStatusKey(sceneHealth, "watch")),
          buildFlowStep("world_sheet_metric_alerts", alertCount || "0", toNum(alertCount, 0) > 0 ? "watch" : "ready"),
          buildFlowStep("world_sheet_metric_liveops_sent", liveOpsSent || "0", toNum(liveOpsSent, 0) > 0 ? "live" : "idle")
        ].filter(Boolean),
        loop_signal_rows: [buildFlowStep("world_sheet_metric_queue_depth", countText(queue.length) || "0", toNum(queue.length, 0) > 0 ? "live" : "ready")].filter(Boolean),
        loop_motion_scalar: 0.84,
        loop_radius_scale: 1.02,
        loop_focus_y_offset: 0.03,
        loop_alpha_offset: 0.02,
        loop_beta_offset: -0.02,
        loop_focus_lerp_scalar: 0.92,
        loop_radius_lerp_scalar: 0.94
      };
    case "world_modal_kind_dispatch_sequence":
      return {
        loop_status_key: resolveFlowStatusKey(schedulerState, "watch"),
        loop_status_label_key: flowStatusLabelKey(resolveFlowStatusKey(schedulerState, "watch")),
        loop_stage_value: schedulerState,
        loop_rows: [
          buildFlowStep("world_sheet_metric_liveops_sent", liveOpsSent || "0", toNum(liveOpsSent, 0) > 0 ? "live" : "idle"),
          buildFlowStep("world_sheet_metric_alerts", alertCount || "0", toNum(alertCount, 0) > 0 ? "watch" : "ready"),
          buildFlowStep("world_sheet_metric_scene_health", sceneHealth, resolveFlowStatusKey(sceneHealth, "watch"))
        ].filter(Boolean),
        loop_signal_rows: [buildFlowStep("world_sheet_metric_queue_depth", countText(queue.length) || "0", toNum(queue.length, 0) > 0 ? "live" : "ready")].filter(Boolean),
        loop_motion_scalar: schedulerState === "ALERT" ? 1.02 : 0.92,
        loop_radius_scale: schedulerState === "ALERT" ? 0.94 : 0.98,
        loop_focus_y_offset: 0.04,
        loop_alpha_offset: -0.04,
        loop_beta_offset: 0.02,
        loop_focus_lerp_scalar: 1.08,
        loop_radius_lerp_scalar: 1.06
      };
    case "world_modal_kind_travel_gate":
    default:
      return {
        loop_status_key: progress ? "live" : "ready",
        loop_status_label_key: flowStatusLabelKey(progress ? "live" : "ready"),
        loop_stage_value: progress || (walletLinked ? "LIVE" : "OPEN"),
        loop_rows: [
          buildFlowStep("world_sheet_metric_progress", progress || "0%", progress ? "live" : "ready"),
          buildFlowStep("world_sheet_metric_active_missions", missionCount || "0", toNum(missionCount, 0) > 0 ? "live" : "idle"),
          buildFlowStep("world_sheet_metric_wallet_state", walletLinked ? "LIVE" : "OPEN", walletLinked ? "ready" : "watch")
        ].filter(Boolean),
        loop_signal_rows: [buildFlowStep("world_sheet_metric_risk_band", upperText(asRecord(homeFeed.risk).band || asRecord(homeFeed.risk).state || "STABLE"), "ready")].filter(Boolean),
        loop_motion_scalar: 0.96,
        loop_radius_scale: 1,
        loop_focus_y_offset: 0.01,
        loop_alpha_offset: 0.02,
        loop_beta_offset: -0.01,
        loop_focus_lerp_scalar: 0.98,
        loop_radius_lerp_scalar: 0.98
      };
  }
}

function buildProtocolMicroFlowPersonality(sequenceKindKey, input) {
  const scene = asRecord(input.scene);
  const sceneRuntime = asRecord(input.sceneRuntime);
  const capabilityProfile = asRecord(scene.capabilityProfile);
  const effectiveQuality = normalizeQuality(scene.effectiveQuality || sceneRuntime.effectiveQuality);
  const hudDensity = normalizeHudDensity(scene.hudDensity || sceneRuntime.hudDensity || capabilityProfile.effective_hud_density);
  const lowEndMode = Boolean(sceneRuntime.lowEndMode || capabilityProfile.low_end_mode || effectiveQuality === "low");
  const sceneProfile = toText(
    capabilityProfile.scene_profile || (lowEndMode ? "lite" : effectiveQuality === "high" ? "cinematic" : "balanced"),
    "balanced"
  );
  const compactMode = lowEndMode || hudDensity === "compact";
  const cinematicBoost = sceneProfile === "cinematic" ? 1.06 : sceneProfile === "lite" ? 0.94 : 1;
  const compactDamp = compactMode ? 0.94 : 1;
  const personality =
    {
      world_modal_kind_duel_sequence: {
        personality_key: "assault",
        personality_label_key: "world_personality_assault",
        personality_caption_key: "world_personality_caption_assault",
        personality_band_key: "aggressive",
        light_profile_key: "arena_flare",
        surface_glow_band_key: "hot",
        chrome_band_key: "strike",
        hud_density_profile_key: "focus",
        rail_layout_key: "arena_strike",
        console_layout_key: "arena_strike",
        modal_layout_key: "arena_focus",
        focus_hold_scalar: 1.14,
        light_intensity_scalar: 1.14,
        glow_intensity_scalar: 1.18,
        surface_glow_scalar: 1.16,
        chrome_opacity_scalar: 1.06,
        hud_layout_key: "arena_stack",
        hud_emphasis_band_key: "hot",
        camera_drift_scalar: 1.12,
        camera_tilt_scalar: 1.1,
        camera_target_lift_scalar: 1.1,
        camera_orbit_bias_scalar: 0.96,
        orbit_spin_scalar: 1.14,
        sway_scalar: 0.92,
        alpha_lerp_scalar: 1.16,
        beta_lerp_scalar: 1.12,
        hud_emphasis_scalar: 1.18,
        actor_motion_scalar: 1.18,
        hotspot_motion_scalar: 1.12,
        ring_pulse_scalar: 1.16,
        satellite_orbit_scalar: 1.14
      },
      world_modal_kind_ladder_sequence: {
        personality_key: "charge",
        personality_label_key: "world_personality_charge",
        personality_caption_key: "world_personality_caption_charge",
        personality_band_key: "aggressive",
        light_profile_key: "arena_flare",
        surface_glow_band_key: "warm",
        chrome_band_key: "strike",
        hud_density_profile_key: "focus",
        rail_layout_key: "arena_strike",
        console_layout_key: "arena_strike",
        modal_layout_key: "arena_focus",
        focus_hold_scalar: 1.08,
        light_intensity_scalar: 1.08,
        glow_intensity_scalar: 1.1,
        surface_glow_scalar: 1.08,
        chrome_opacity_scalar: 1.02,
        hud_layout_key: "arena_stack",
        hud_emphasis_band_key: "hot",
        camera_drift_scalar: 1.04,
        camera_tilt_scalar: 1.04,
        camera_target_lift_scalar: 1.04,
        camera_orbit_bias_scalar: 0.98,
        orbit_spin_scalar: 1.08,
        sway_scalar: 0.96,
        alpha_lerp_scalar: 1.08,
        beta_lerp_scalar: 1.06,
        hud_emphasis_scalar: 1.1,
        actor_motion_scalar: 1.1,
        hotspot_motion_scalar: 1.06,
        ring_pulse_scalar: 1.08,
        satellite_orbit_scalar: 1.08
      },
      world_modal_kind_telemetry_scan: {
        personality_key: "scan",
        personality_label_key: "world_personality_scan",
        personality_caption_key: "world_personality_caption_scan",
        personality_band_key: "precision",
        light_profile_key: "arena_scope",
        surface_glow_band_key: "cool",
        chrome_band_key: "scope",
        hud_density_profile_key: "scope",
        rail_layout_key: "arena_scope",
        console_layout_key: "arena_scope",
        modal_layout_key: "arena_scope",
        focus_hold_scalar: 0.94,
        light_intensity_scalar: 0.92,
        glow_intensity_scalar: 0.9,
        surface_glow_scalar: 0.92,
        chrome_opacity_scalar: 0.94,
        hud_layout_key: "arena_scope",
        hud_emphasis_band_key: "cool",
        camera_drift_scalar: 0.88,
        camera_tilt_scalar: 0.94,
        camera_target_lift_scalar: 0.96,
        camera_orbit_bias_scalar: 1.02,
        orbit_spin_scalar: 0.96,
        sway_scalar: 0.84,
        alpha_lerp_scalar: 0.94,
        beta_lerp_scalar: 0.92,
        hud_emphasis_scalar: 0.92,
        actor_motion_scalar: 0.94,
        hotspot_motion_scalar: 0.9,
        ring_pulse_scalar: 0.92,
        satellite_orbit_scalar: 0.9
      },
      world_modal_kind_mission_terminal: {
        personality_key: "stack",
        personality_label_key: "world_personality_stack",
        personality_caption_key: "world_personality_caption_stack",
        personality_band_key: "stack",
        light_profile_key: "mission_stack",
        surface_glow_band_key: "warm",
        chrome_band_key: "stack",
        hud_density_profile_key: "stack",
        rail_layout_key: "mission_stack",
        console_layout_key: "mission_stack",
        modal_layout_key: "mission_stack",
        focus_hold_scalar: 1,
        light_intensity_scalar: 1,
        glow_intensity_scalar: 1.02,
        surface_glow_scalar: 1.04,
        chrome_opacity_scalar: 1.02,
        hud_layout_key: "mission_stack",
        hud_emphasis_band_key: "warm",
        camera_drift_scalar: 0.94,
        camera_tilt_scalar: 0.98,
        camera_target_lift_scalar: 1,
        camera_orbit_bias_scalar: 1,
        orbit_spin_scalar: 1.02,
        sway_scalar: 0.9,
        alpha_lerp_scalar: 1.04,
        beta_lerp_scalar: 1,
        hud_emphasis_scalar: 1.04,
        actor_motion_scalar: 1.02,
        hotspot_motion_scalar: 1,
        ring_pulse_scalar: 1.02,
        satellite_orbit_scalar: 0.98
      },
      world_modal_kind_contract_sequence: {
        personality_key: "claim",
        personality_label_key: "world_personality_claim",
        personality_caption_key: "world_personality_caption_claim",
        personality_band_key: "stack",
        light_profile_key: "mission_stack",
        surface_glow_band_key: "hot",
        chrome_band_key: "stack",
        hud_density_profile_key: "stack",
        rail_layout_key: "mission_claim",
        console_layout_key: "mission_claim",
        modal_layout_key: "mission_stack",
        focus_hold_scalar: 1.08,
        light_intensity_scalar: 1.08,
        glow_intensity_scalar: 1.08,
        surface_glow_scalar: 1.1,
        chrome_opacity_scalar: 1.04,
        hud_layout_key: "mission_stack",
        hud_emphasis_band_key: "hot",
        camera_drift_scalar: 1.02,
        camera_tilt_scalar: 1.04,
        camera_target_lift_scalar: 1.08,
        camera_orbit_bias_scalar: 0.98,
        orbit_spin_scalar: 1.1,
        sway_scalar: 0.94,
        alpha_lerp_scalar: 1.12,
        beta_lerp_scalar: 1.08,
        hud_emphasis_scalar: 1.12,
        actor_motion_scalar: 1.08,
        hotspot_motion_scalar: 1.06,
        ring_pulse_scalar: 1.08,
        satellite_orbit_scalar: 1.02
      },
      world_modal_kind_streak_sync: {
        personality_key: "cadence",
        personality_label_key: "world_personality_cadence",
        personality_caption_key: "world_personality_caption_cadence",
        personality_band_key: "stack",
        light_profile_key: "mission_sync",
        surface_glow_band_key: "cool",
        chrome_band_key: "sync",
        hud_density_profile_key: "sync",
        rail_layout_key: "mission_sync",
        console_layout_key: "mission_sync",
        modal_layout_key: "mission_sync",
        focus_hold_scalar: 0.92,
        light_intensity_scalar: 0.9,
        glow_intensity_scalar: 0.94,
        surface_glow_scalar: 0.96,
        chrome_opacity_scalar: 0.94,
        hud_layout_key: "mission_sync",
        hud_emphasis_band_key: "cool",
        camera_drift_scalar: 0.86,
        camera_tilt_scalar: 0.9,
        camera_target_lift_scalar: 0.94,
        camera_orbit_bias_scalar: 1.02,
        orbit_spin_scalar: 0.94,
        sway_scalar: 0.88,
        alpha_lerp_scalar: 0.96,
        beta_lerp_scalar: 0.94,
        hud_emphasis_scalar: 0.96,
        actor_motion_scalar: 0.96,
        hotspot_motion_scalar: 0.94,
        ring_pulse_scalar: 0.94,
        satellite_orbit_scalar: 0.92
      },
      world_modal_kind_wallet_terminal: {
        personality_key: "route",
        personality_label_key: "world_personality_route",
        personality_caption_key: "world_personality_caption_route",
        personality_band_key: "route",
        light_profile_key: "exchange_ledger",
        surface_glow_band_key: "cool",
        chrome_band_key: "ledger",
        hud_density_profile_key: "ledger",
        rail_layout_key: "exchange_ledger",
        console_layout_key: "exchange_ledger",
        modal_layout_key: "exchange_route",
        focus_hold_scalar: 0.98,
        light_intensity_scalar: 0.96,
        glow_intensity_scalar: 1,
        surface_glow_scalar: 1,
        chrome_opacity_scalar: 1,
        hud_layout_key: "exchange_ledger",
        hud_emphasis_band_key: "cool",
        camera_drift_scalar: 0.92,
        camera_tilt_scalar: 0.96,
        camera_target_lift_scalar: 0.98,
        camera_orbit_bias_scalar: 1.02,
        orbit_spin_scalar: 0.98,
        sway_scalar: 0.9,
        alpha_lerp_scalar: 1.02,
        beta_lerp_scalar: 1,
        hud_emphasis_scalar: 1,
        actor_motion_scalar: 1,
        hotspot_motion_scalar: 0.98,
        ring_pulse_scalar: 1,
        satellite_orbit_scalar: 0.98
      },
      world_modal_kind_payout_route: {
        personality_key: "payout",
        personality_label_key: "world_personality_payout",
        personality_caption_key: "world_personality_caption_payout",
        personality_band_key: "route",
        light_profile_key: "exchange_ledger",
        surface_glow_band_key: "warm",
        chrome_band_key: "ledger",
        hud_density_profile_key: "ledger",
        rail_layout_key: "exchange_payout",
        console_layout_key: "exchange_ledger",
        modal_layout_key: "exchange_route",
        focus_hold_scalar: 1.02,
        light_intensity_scalar: 1.04,
        glow_intensity_scalar: 1.04,
        surface_glow_scalar: 1.06,
        chrome_opacity_scalar: 1.02,
        hud_layout_key: "exchange_ledger",
        hud_emphasis_band_key: "warm",
        camera_drift_scalar: 0.98,
        camera_tilt_scalar: 1,
        camera_target_lift_scalar: 1.04,
        camera_orbit_bias_scalar: 0.98,
        orbit_spin_scalar: 1,
        sway_scalar: 0.92,
        alpha_lerp_scalar: 1.04,
        beta_lerp_scalar: 1.02,
        hud_emphasis_scalar: 1.04,
        actor_motion_scalar: 1.02,
        hotspot_motion_scalar: 1,
        ring_pulse_scalar: 1.02,
        satellite_orbit_scalar: 1
      },
      world_modal_kind_premium_unlock: {
        personality_key: "premium",
        personality_label_key: "world_personality_premium",
        personality_caption_key: "world_personality_caption_premium",
        personality_band_key: "route",
        light_profile_key: "exchange_ledger",
        surface_glow_band_key: "warm",
        chrome_band_key: "premium",
        hud_density_profile_key: "ledger",
        rail_layout_key: "exchange_premium",
        console_layout_key: "exchange_ledger",
        modal_layout_key: "exchange_route",
        focus_hold_scalar: 1,
        light_intensity_scalar: 1.02,
        glow_intensity_scalar: 1.08,
        surface_glow_scalar: 1.08,
        chrome_opacity_scalar: 1.04,
        hud_layout_key: "exchange_ledger",
        hud_emphasis_band_key: "warm",
        camera_drift_scalar: 1,
        camera_tilt_scalar: 1.02,
        camera_target_lift_scalar: 1.02,
        camera_orbit_bias_scalar: 0.98,
        orbit_spin_scalar: 0.98,
        sway_scalar: 0.9,
        alpha_lerp_scalar: 1,
        beta_lerp_scalar: 0.98,
        hud_emphasis_scalar: 1.02,
        actor_motion_scalar: 1,
        hotspot_motion_scalar: 0.98,
        ring_pulse_scalar: 1,
        satellite_orbit_scalar: 0.98
      },
      world_modal_kind_queue_review: {
        personality_key: "watch",
        personality_label_key: "world_personality_watch",
        personality_caption_key: "world_personality_caption_watch",
        personality_band_key: "overwatch",
        light_profile_key: "ops_console",
        surface_glow_band_key: "low",
        chrome_band_key: "console",
        hud_density_profile_key: "console",
        rail_layout_key: "ops_watch",
        console_layout_key: "ops_grid",
        modal_layout_key: "ops_console",
        focus_hold_scalar: 0.9,
        light_intensity_scalar: 0.88,
        glow_intensity_scalar: 0.9,
        surface_glow_scalar: 0.9,
        chrome_opacity_scalar: 0.94,
        hud_layout_key: "ops_grid",
        hud_emphasis_band_key: "low",
        camera_drift_scalar: 0.82,
        camera_tilt_scalar: 0.88,
        camera_target_lift_scalar: 0.98,
        camera_orbit_bias_scalar: 1.04,
        orbit_spin_scalar: 0.92,
        sway_scalar: 0.82,
        alpha_lerp_scalar: 0.92,
        beta_lerp_scalar: 0.9,
        hud_emphasis_scalar: 0.94,
        actor_motion_scalar: 0.9,
        hotspot_motion_scalar: 0.88,
        ring_pulse_scalar: 0.9,
        satellite_orbit_scalar: 0.88
      },
      world_modal_kind_runtime_scan: {
        personality_key: "audit",
        personality_label_key: "world_personality_audit",
        personality_caption_key: "world_personality_caption_audit",
        personality_band_key: "overwatch",
        light_profile_key: "ops_console",
        surface_glow_band_key: "low",
        chrome_band_key: "scope",
        hud_density_profile_key: "console",
        rail_layout_key: "ops_watch",
        console_layout_key: "ops_grid",
        modal_layout_key: "ops_console",
        focus_hold_scalar: 0.88,
        light_intensity_scalar: 0.86,
        glow_intensity_scalar: 0.88,
        surface_glow_scalar: 0.88,
        chrome_opacity_scalar: 0.92,
        hud_layout_key: "ops_grid",
        hud_emphasis_band_key: "low",
        camera_drift_scalar: 0.8,
        camera_tilt_scalar: 0.86,
        camera_target_lift_scalar: 0.96,
        camera_orbit_bias_scalar: 1.06,
        orbit_spin_scalar: 0.9,
        sway_scalar: 0.8,
        alpha_lerp_scalar: 0.9,
        beta_lerp_scalar: 0.9,
        hud_emphasis_scalar: 0.9,
        actor_motion_scalar: 0.88,
        hotspot_motion_scalar: 0.86,
        ring_pulse_scalar: 0.88,
        satellite_orbit_scalar: 0.86
      },
      world_modal_kind_dispatch_sequence: {
        personality_key: "dispatch",
        personality_label_key: "world_personality_dispatch",
        personality_caption_key: "world_personality_caption_dispatch",
        personality_band_key: "overwatch",
        light_profile_key: "ops_console",
        surface_glow_band_key: "hot",
        chrome_band_key: "dispatch",
        hud_density_profile_key: "console",
        rail_layout_key: "ops_dispatch",
        console_layout_key: "ops_dispatch",
        modal_layout_key: "ops_dispatch",
        focus_hold_scalar: 1.08,
        light_intensity_scalar: 1.08,
        glow_intensity_scalar: 1.1,
        surface_glow_scalar: 1.1,
        chrome_opacity_scalar: 1.04,
        hud_layout_key: "ops_grid",
        hud_emphasis_band_key: "hot",
        camera_drift_scalar: 0.96,
        camera_tilt_scalar: 1.04,
        camera_target_lift_scalar: 1.08,
        camera_orbit_bias_scalar: 0.96,
        orbit_spin_scalar: 1.06,
        sway_scalar: 0.94,
        alpha_lerp_scalar: 1.08,
        beta_lerp_scalar: 1.04,
        hud_emphasis_scalar: 1.08,
        actor_motion_scalar: 1.04,
        hotspot_motion_scalar: 1,
        ring_pulse_scalar: 1.04,
        satellite_orbit_scalar: 1.02
      }
    }[sequenceKindKey] || {
      personality_key: "glide",
      personality_label_key: "world_personality_glide",
      personality_caption_key: "world_personality_caption_glide",
      personality_band_key: "glide",
      light_profile_key: "hub_glide",
      surface_glow_band_key: "cool",
      chrome_band_key: "glide",
      hud_density_profile_key: "spread",
      rail_layout_key: "hub_glide",
      console_layout_key: "hub_glide",
      modal_layout_key: "hub_glide",
      focus_hold_scalar: 0.96,
      light_intensity_scalar: 0.96,
      glow_intensity_scalar: 0.98,
      surface_glow_scalar: 0.98,
      chrome_opacity_scalar: 1,
      hud_layout_key: "hub_glide",
      hud_emphasis_band_key: "cool",
      camera_drift_scalar: 0.92,
      camera_tilt_scalar: 0.94,
      camera_target_lift_scalar: 0.94,
      camera_orbit_bias_scalar: 1.04,
      orbit_spin_scalar: 0.98,
      sway_scalar: 0.86,
      alpha_lerp_scalar: 0.98,
      beta_lerp_scalar: 0.96,
      hud_emphasis_scalar: 0.98,
      actor_motion_scalar: 0.98,
      hotspot_motion_scalar: 0.94,
      ring_pulse_scalar: 0.98,
      satellite_orbit_scalar: 0.96
    };

  const composition =
    {
      world_modal_kind_duel_sequence: {
        composition_profile_key: "arena_press",
        camera_frame_key: "arena_press",
        hud_anchor_key: "center",
        rail_anchor_key: "right",
        sheet_anchor_key: "left",
        entry_anchor_key: "left",
        console_anchor_key: "right",
        modal_anchor_key: "right",
        hud_focus_mode_key: "duel",
        rail_presence_key: "support",
        sheet_presence_key: "ambient",
        entry_presence_key: "lead",
        console_presence_key: "support",
        modal_presence_key: "lead",
        camera_fov_scalar: 0.94,
        focus_spread_scalar: 0.92,
        camera_heading_offset: 0.12,
        camera_target_x_offset: 0.18,
        camera_bank_scalar: 1.08,
        hud_width_scalar: 0.94,
        rail_width_scalar: 0.92,
        sheet_width_scalar: 0.9,
        entry_width_scalar: 0.94,
        console_width_scalar: 0.96,
        modal_width_scalar: 0.94,
        surface_gap_scalar: 0.92,
        surface_stack_scalar: 1.08
      },
      world_modal_kind_ladder_sequence: {
        composition_profile_key: "arena_charge",
        camera_frame_key: "arena_charge",
        hud_anchor_key: "center",
        rail_anchor_key: "right",
        sheet_anchor_key: "left",
        entry_anchor_key: "left",
        console_anchor_key: "right",
        modal_anchor_key: "right",
        hud_focus_mode_key: "ladder",
        rail_presence_key: "support",
        sheet_presence_key: "ambient",
        entry_presence_key: "support",
        console_presence_key: "lead",
        modal_presence_key: "support",
        camera_fov_scalar: 0.96,
        focus_spread_scalar: 0.96,
        camera_heading_offset: 0.08,
        camera_target_x_offset: 0.12,
        camera_bank_scalar: 1.05,
        hud_width_scalar: 0.96,
        rail_width_scalar: 0.94,
        sheet_width_scalar: 0.92,
        entry_width_scalar: 0.96,
        console_width_scalar: 0.98,
        modal_width_scalar: 0.96,
        surface_gap_scalar: 0.96,
        surface_stack_scalar: 1.04
      },
      world_modal_kind_telemetry_scan: {
        composition_profile_key: "arena_scope",
        camera_frame_key: "arena_scope",
        hud_anchor_key: "left",
        rail_anchor_key: "right",
        sheet_anchor_key: "left",
        entry_anchor_key: "left",
        console_anchor_key: "right",
        modal_anchor_key: "right",
        hud_focus_mode_key: "scope",
        rail_presence_key: "support",
        sheet_presence_key: "ambient",
        entry_presence_key: "ambient",
        console_presence_key: "lead",
        modal_presence_key: "support",
        camera_fov_scalar: 1.02,
        focus_spread_scalar: 1.06,
        camera_heading_offset: -0.04,
        camera_target_x_offset: 0.04,
        camera_bank_scalar: 0.94,
        hud_width_scalar: 1,
        rail_width_scalar: 0.96,
        sheet_width_scalar: 0.94,
        entry_width_scalar: 0.96,
        console_width_scalar: 1.02,
        modal_width_scalar: 1.02,
        surface_gap_scalar: 0.9,
        surface_stack_scalar: 0.96
      },
      world_modal_kind_mission_terminal: {
        composition_profile_key: "mission_stack",
        camera_frame_key: "mission_stack",
        hud_anchor_key: "left",
        rail_anchor_key: "right",
        sheet_anchor_key: "left",
        entry_anchor_key: "left",
        console_anchor_key: "right",
        modal_anchor_key: "right",
        hud_focus_mode_key: "mission",
        rail_presence_key: "support",
        sheet_presence_key: "lead",
        entry_presence_key: "lead",
        console_presence_key: "ambient",
        modal_presence_key: "support",
        camera_fov_scalar: 0.98,
        focus_spread_scalar: 1,
        camera_heading_offset: -0.04,
        camera_target_x_offset: -0.12,
        camera_bank_scalar: 0.98,
        hud_width_scalar: 0.98,
        rail_width_scalar: 0.96,
        sheet_width_scalar: 0.94,
        entry_width_scalar: 0.96,
        console_width_scalar: 0.98,
        modal_width_scalar: 0.98,
        surface_gap_scalar: 0.98,
        surface_stack_scalar: 1
      },
      world_modal_kind_contract_sequence: {
        composition_profile_key: "mission_claim",
        camera_frame_key: "mission_claim",
        hud_anchor_key: "left",
        rail_anchor_key: "right",
        sheet_anchor_key: "left",
        entry_anchor_key: "left",
        console_anchor_key: "right",
        modal_anchor_key: "right",
        hud_focus_mode_key: "claim",
        rail_presence_key: "support",
        sheet_presence_key: "support",
        entry_presence_key: "lead",
        console_presence_key: "ambient",
        modal_presence_key: "lead",
        camera_fov_scalar: 0.96,
        focus_spread_scalar: 0.96,
        camera_heading_offset: 0.02,
        camera_target_x_offset: -0.08,
        camera_bank_scalar: 1.02,
        hud_width_scalar: 0.96,
        rail_width_scalar: 0.94,
        sheet_width_scalar: 0.92,
        entry_width_scalar: 0.94,
        console_width_scalar: 0.96,
        modal_width_scalar: 0.96,
        surface_gap_scalar: 0.94,
        surface_stack_scalar: 1.06
      },
      world_modal_kind_streak_sync: {
        composition_profile_key: "mission_sync",
        camera_frame_key: "mission_sync",
        hud_anchor_key: "left",
        rail_anchor_key: "right",
        sheet_anchor_key: "left",
        entry_anchor_key: "left",
        console_anchor_key: "right",
        modal_anchor_key: "right",
        hud_focus_mode_key: "sync",
        rail_presence_key: "support",
        sheet_presence_key: "support",
        entry_presence_key: "support",
        console_presence_key: "ambient",
        modal_presence_key: "support",
        camera_fov_scalar: 1.01,
        focus_spread_scalar: 1.04,
        camera_heading_offset: -0.08,
        camera_target_x_offset: -0.18,
        camera_bank_scalar: 0.94,
        hud_width_scalar: 0.98,
        rail_width_scalar: 0.96,
        sheet_width_scalar: 0.94,
        entry_width_scalar: 0.94,
        console_width_scalar: 0.96,
        modal_width_scalar: 0.98,
        surface_gap_scalar: 0.9,
        surface_stack_scalar: 0.96
      },
      world_modal_kind_wallet_terminal: {
        composition_profile_key: "exchange_ledger",
        camera_frame_key: "exchange_ledger",
        hud_anchor_key: "center",
        rail_anchor_key: "right",
        sheet_anchor_key: "left",
        entry_anchor_key: "center",
        console_anchor_key: "right",
        modal_anchor_key: "right",
        hud_focus_mode_key: "ledger",
        rail_presence_key: "support",
        sheet_presence_key: "support",
        entry_presence_key: "lead",
        console_presence_key: "lead",
        modal_presence_key: "support",
        camera_fov_scalar: 1,
        focus_spread_scalar: 1.02,
        camera_heading_offset: 0.02,
        camera_target_x_offset: 0.04,
        camera_bank_scalar: 0.98,
        hud_width_scalar: 1,
        rail_width_scalar: 0.98,
        sheet_width_scalar: 0.96,
        entry_width_scalar: 0.98,
        console_width_scalar: 1,
        modal_width_scalar: 1,
        surface_gap_scalar: 0.96,
        surface_stack_scalar: 0.98
      },
      world_modal_kind_payout_route: {
        composition_profile_key: "exchange_payout",
        camera_frame_key: "exchange_route",
        hud_anchor_key: "center",
        rail_anchor_key: "right",
        sheet_anchor_key: "left",
        entry_anchor_key: "center",
        console_anchor_key: "right",
        modal_anchor_key: "right",
        hud_focus_mode_key: "payout",
        rail_presence_key: "support",
        sheet_presence_key: "ambient",
        entry_presence_key: "support",
        console_presence_key: "lead",
        modal_presence_key: "lead",
        camera_fov_scalar: 0.98,
        focus_spread_scalar: 0.98,
        camera_heading_offset: 0.06,
        camera_target_x_offset: 0.08,
        camera_bank_scalar: 1.02,
        hud_width_scalar: 0.98,
        rail_width_scalar: 0.96,
        sheet_width_scalar: 0.94,
        entry_width_scalar: 0.96,
        console_width_scalar: 0.98,
        modal_width_scalar: 0.98,
        surface_gap_scalar: 0.94,
        surface_stack_scalar: 1.02
      },
      world_modal_kind_premium_unlock: {
        composition_profile_key: "exchange_premium",
        camera_frame_key: "exchange_premium",
        hud_anchor_key: "center",
        rail_anchor_key: "right",
        sheet_anchor_key: "left",
        entry_anchor_key: "center",
        console_anchor_key: "right",
        modal_anchor_key: "right",
        hud_focus_mode_key: "premium",
        rail_presence_key: "support",
        sheet_presence_key: "ambient",
        entry_presence_key: "support",
        console_presence_key: "lead",
        modal_presence_key: "lead",
        camera_fov_scalar: 0.97,
        focus_spread_scalar: 0.98,
        camera_heading_offset: 0.04,
        camera_target_x_offset: 0.12,
        camera_bank_scalar: 1.04,
        hud_width_scalar: 0.98,
        rail_width_scalar: 0.96,
        sheet_width_scalar: 0.94,
        entry_width_scalar: 0.96,
        console_width_scalar: 0.98,
        modal_width_scalar: 0.98,
        surface_gap_scalar: 0.94,
        surface_stack_scalar: 1.02
      },
      world_modal_kind_queue_review: {
        composition_profile_key: "ops_watch",
        camera_frame_key: "ops_watch",
        hud_anchor_key: "right",
        rail_anchor_key: "right",
        sheet_anchor_key: "left",
        entry_anchor_key: "left",
        console_anchor_key: "right",
        modal_anchor_key: "right",
        hud_focus_mode_key: "watch",
        rail_presence_key: "lead",
        sheet_presence_key: "support",
        entry_presence_key: "ambient",
        console_presence_key: "lead",
        modal_presence_key: "support",
        camera_fov_scalar: 1.02,
        focus_spread_scalar: 1.06,
        camera_heading_offset: -0.08,
        camera_target_x_offset: -0.06,
        camera_bank_scalar: 0.92,
        hud_width_scalar: 1.02,
        rail_width_scalar: 0.98,
        sheet_width_scalar: 0.96,
        entry_width_scalar: 0.96,
        console_width_scalar: 1.02,
        modal_width_scalar: 1.04,
        surface_gap_scalar: 0.92,
        surface_stack_scalar: 0.94
      },
      world_modal_kind_runtime_scan: {
        composition_profile_key: "ops_scope",
        camera_frame_key: "ops_scope",
        hud_anchor_key: "right",
        rail_anchor_key: "right",
        sheet_anchor_key: "left",
        entry_anchor_key: "left",
        console_anchor_key: "right",
        modal_anchor_key: "right",
        hud_focus_mode_key: "scope",
        rail_presence_key: "support",
        sheet_presence_key: "ambient",
        entry_presence_key: "ambient",
        console_presence_key: "lead",
        modal_presence_key: "support",
        camera_fov_scalar: 1.04,
        focus_spread_scalar: 1.08,
        camera_heading_offset: -0.12,
        camera_target_x_offset: -0.1,
        camera_bank_scalar: 0.88,
        hud_width_scalar: 1.04,
        rail_width_scalar: 1,
        sheet_width_scalar: 0.98,
        entry_width_scalar: 0.98,
        console_width_scalar: 1.04,
        modal_width_scalar: 1.04,
        surface_gap_scalar: 0.9,
        surface_stack_scalar: 0.92
      },
      world_modal_kind_dispatch_sequence: {
        composition_profile_key: "ops_dispatch",
        camera_frame_key: "ops_dispatch",
        hud_anchor_key: "right",
        rail_anchor_key: "right",
        sheet_anchor_key: "left",
        entry_anchor_key: "left",
        console_anchor_key: "right",
        modal_anchor_key: "right",
        hud_focus_mode_key: "dispatch",
        rail_presence_key: "lead",
        sheet_presence_key: "ambient",
        entry_presence_key: "ambient",
        console_presence_key: "lead",
        modal_presence_key: "lead",
        camera_fov_scalar: 0.95,
        focus_spread_scalar: 0.94,
        camera_heading_offset: 0.1,
        camera_target_x_offset: 0.14,
        camera_bank_scalar: 1.1,
        hud_width_scalar: 0.96,
        rail_width_scalar: 0.94,
        sheet_width_scalar: 0.92,
        entry_width_scalar: 0.94,
        console_width_scalar: 0.96,
        modal_width_scalar: 0.96,
        surface_gap_scalar: 0.92,
        surface_stack_scalar: 1.08
      }
    }[sequenceKindKey] || {
      composition_profile_key: "hub_glide",
      camera_frame_key: "hub_glide",
      hud_anchor_key: "center",
      rail_anchor_key: "right",
      sheet_anchor_key: "left",
      entry_anchor_key: "left",
      console_anchor_key: "right",
      modal_anchor_key: "right",
      hud_focus_mode_key: "glide",
      rail_presence_key: "support",
      sheet_presence_key: "support",
      entry_presence_key: "lead",
      console_presence_key: "ambient",
      modal_presence_key: "ambient",
      camera_fov_scalar: 1.02,
      focus_spread_scalar: 1.06,
      camera_heading_offset: 0,
      camera_target_x_offset: 0,
      camera_bank_scalar: 1,
      hud_width_scalar: 1,
      rail_width_scalar: 1,
      sheet_width_scalar: 1,
      entry_width_scalar: 1,
      console_width_scalar: 1,
      modal_width_scalar: 1,
      surface_gap_scalar: 1,
      surface_stack_scalar: 0.96
    };

  return {
    ...personality,
    ...composition,
    density_label_key: compactMode ? "world_hud_density_compact" : "world_hud_density_expanded",
    light_profile_key: toText(personality.light_profile_key, "hub_glide"),
    surface_glow_band_key: toText(personality.surface_glow_band_key, "cool"),
    chrome_band_key: toText(personality.chrome_band_key, "glide"),
    hud_density_profile_key: toText(personality.hud_density_profile_key, "spread"),
    rail_layout_key: toText(personality.rail_layout_key, "hub_glide"),
    console_layout_key: toText(personality.console_layout_key, "hub_glide"),
    modal_layout_key: toText(personality.modal_layout_key, "hub_glide"),
    focus_hold_scalar: clamp(toNum(personality.focus_hold_scalar, 1), 0.86, 1.16),
    light_intensity_scalar: clamp(toNum(personality.light_intensity_scalar, 1) * cinematicBoost, 0.84, 1.2),
    glow_intensity_scalar: clamp(toNum(personality.glow_intensity_scalar, 1) * cinematicBoost, 0.82, 1.22),
    surface_glow_scalar: clamp(toNum(personality.surface_glow_scalar, 1) * cinematicBoost, 0.84, 1.22),
    chrome_opacity_scalar: clamp(toNum(personality.chrome_opacity_scalar, 1) * compactDamp, 0.9, 1.08),
    composition_profile_key: toText(composition.composition_profile_key, "hub_glide"),
    camera_frame_key: toText(composition.camera_frame_key, "hub_glide"),
    hud_anchor_key: toText(composition.hud_anchor_key, "center"),
    rail_anchor_key: toText(composition.rail_anchor_key, "right"),
    sheet_anchor_key: toText(composition.sheet_anchor_key, "left"),
    entry_anchor_key: toText(composition.entry_anchor_key, "left"),
    console_anchor_key: toText(composition.console_anchor_key, "right"),
    modal_anchor_key: toText(composition.modal_anchor_key, "right"),
    hud_focus_mode_key: toText(composition.hud_focus_mode_key, "glide"),
    rail_presence_key: toText(composition.rail_presence_key, "support"),
    sheet_presence_key: toText(composition.sheet_presence_key, "support"),
    entry_presence_key: toText(composition.entry_presence_key, "lead"),
    console_presence_key: toText(composition.console_presence_key, "ambient"),
    modal_presence_key: toText(composition.modal_presence_key, "ambient"),
    camera_fov_scalar: clamp(toNum(composition.camera_fov_scalar, 1) * (compactMode ? 1.02 : 1), 0.9, 1.08),
    focus_spread_scalar: clamp(toNum(composition.focus_spread_scalar, 1) * (compactMode ? 1.02 : 1), 0.88, 1.12),
    camera_heading_offset: clamp(toNum(composition.camera_heading_offset, 0), -0.18, 0.18),
    camera_target_x_offset: clamp(toNum(composition.camera_target_x_offset, 0), -0.22, 0.22),
    camera_bank_scalar: clamp(toNum(composition.camera_bank_scalar, 1), 0.84, 1.14),
    hud_width_scalar: clamp(toNum(composition.hud_width_scalar, 1) * compactDamp, 0.84, 1.08),
    rail_width_scalar: clamp(toNum(composition.rail_width_scalar, 1) * compactDamp, 0.84, 1.08),
    sheet_width_scalar: clamp(toNum(composition.sheet_width_scalar, 1) * compactDamp, 0.84, 1.08),
    entry_width_scalar: clamp(toNum(composition.entry_width_scalar, 1) * compactDamp, 0.84, 1.08),
    console_width_scalar: clamp(toNum(composition.console_width_scalar, 1) * compactDamp, 0.84, 1.08),
    modal_width_scalar: clamp(toNum(composition.modal_width_scalar, 1) * compactDamp, 0.84, 1.08),
    surface_gap_scalar: clamp(toNum(composition.surface_gap_scalar, 1) * compactDamp, 0.82, 1.12),
    surface_stack_scalar: clamp(toNum(composition.surface_stack_scalar, 1), 0.9, 1.16),
    hud_layout_key: toText(personality.hud_layout_key, "hub_glide"),
    hud_emphasis_band_key: toText(personality.hud_emphasis_band_key, "cool"),
    camera_drift_scalar: clamp(toNum(personality.camera_drift_scalar, 1) * compactDamp, 0.78, 1.16),
    camera_tilt_scalar: clamp(toNum(personality.camera_tilt_scalar, 1) * compactDamp, 0.82, 1.12),
    camera_target_lift_scalar: clamp(toNum(personality.camera_target_lift_scalar, 1), 0.9, 1.14),
    camera_orbit_bias_scalar: clamp(toNum(personality.camera_orbit_bias_scalar, 1) * compactDamp, 0.92, 1.08),
    orbit_spin_scalar: clamp(toNum(personality.orbit_spin_scalar, 1) * cinematicBoost * compactDamp, 0.82, 1.24),
    sway_scalar: clamp(toNum(personality.sway_scalar, 1) * compactDamp, 0.78, 1.12),
    alpha_lerp_scalar: clamp(toNum(personality.alpha_lerp_scalar, 1) * cinematicBoost, 0.84, 1.22),
    beta_lerp_scalar: clamp(toNum(personality.beta_lerp_scalar, 1) * cinematicBoost, 0.84, 1.18),
    hud_emphasis_scalar: clamp(toNum(personality.hud_emphasis_scalar, 1) * compactDamp, 0.88, 1.22),
    actor_motion_scalar: clamp(toNum(personality.actor_motion_scalar, 1) * cinematicBoost, 0.82, 1.24),
    hotspot_motion_scalar: clamp(toNum(personality.hotspot_motion_scalar, 1) * compactDamp, 0.8, 1.18),
    ring_pulse_scalar: clamp(toNum(personality.ring_pulse_scalar, 1) * cinematicBoost, 0.84, 1.2),
    satellite_orbit_scalar: clamp(
      toNum(personality.satellite_orbit_scalar, 1) * cinematicBoost * compactDamp,
      0.82,
      1.18
    )
  };
}

function enrichDistrictInteractionModal(interactionModal, input) {
  const modal = asRecord(interactionModal);
  if (!modal.modal_key || !Array.isArray(modal.protocol_cards) || !modal.protocol_cards.length) {
    return interactionModal;
  }
  const districtKey =
    toKeyToken(toText(modal.modal_key, "").split(":")[0], "") ||
    resolveDistrictKey(normalizeWorkspace(input.workspace), normalizeTab(input.tab));
  const buildContextActionItems = (items, actionContext) =>
    asList(items).map((item) => {
      return applyResolvedActionRiskMeta(
        item,
        {
          ...(asRecord(actionContext) || {}),
          context_lookup_required: true,
          context_lookup_resolved: true
        },
        item,
        {
          context_lookup_required: true,
          context_lookup_resolved: true
        }
      );
    });
  const enrichedProtocolCards = modal.protocol_cards.map((card) => {
    const protocolCard = asRecord(card);
    const flowPods = asList(protocolCard.flow_pods);
    if (!flowPods.length) {
      return card;
    }
    const enrichedFlowPods = flowPods.map((pod) => {
      const flowPod = asRecord(pod);
      const microflows = asList(flowPod.microflow_cards);
      if (!microflows.length) {
        return pod;
      }
      const enrichedMicroflows = microflows.map((flow) => {
        const microflow = asRecord(flow);
        const loopState = buildProtocolMicroFlowLiveState(toText(microflow.sequence_kind_key, ""), input);
        const loopPersonality = buildProtocolMicroFlowPersonality(toText(microflow.sequence_kind_key, ""), input);
        if (!loopState) {
          return flow;
        }
        const familyKey = resolveProtocolMicroFlowFamilyKey(microflow);
        const flowKey = resolveProtocolMicroFlowFlowKey({
          ...microflow,
          family_key: familyKey
        });
        const focusKey = buildProtocolMicroFlowFocusKey(districtKey, {
          ...microflow,
          family_key: familyKey,
          flow_key: flowKey
        });
        const riskKey = buildProtocolMicroFlowRiskKey(loopState, microflow);
        const riskFocusKey = focusKey && riskKey ? `${focusKey}|${riskKey}` : focusKey || riskKey || "";
        const riskBands = resolveProtocolMicroFlowRiskBands(loopState, microflow);
        const riskVisualMeta = buildProtocolMicroFlowRiskVisualMeta(loopState, microflow);
        const flowContextMeta = buildInteractionContextMeta(
          {
            ...flow,
            district_key: districtKey,
            family_key: familyKey,
            flow_key: flowKey,
            microflow_key: toText(microflow.microflow_key, ""),
            focus_key: focusKey,
            risk_key: riskKey,
            risk_focus_key: riskFocusKey,
            risk_health_band_key: riskBands.risk_health_band_key,
            risk_attention_band_key: riskBands.risk_attention_band_key,
            risk_trend_direction_key: riskBands.risk_trend_direction_key,
            entry_kind_key: toText(microflow.entry_kind_key, ""),
            sequence_kind_key: toText(microflow.sequence_kind_key, ""),
            context_lookup_required: true,
            context_lookup_resolved: true
          },
          microflow
        );
        const flowActionContext = asRecord(flowContextMeta.action_context);
        return applyResolvedActionRiskMeta(flow, flowContextMeta, flowActionContext, {
          action_items: buildContextActionItems(microflow.action_items, flowActionContext),
          district_key: districtKey,
          family_key: familyKey,
          flow_key: flowKey,
          focus_key: focusKey,
          risk_key: riskKey,
          risk_focus_key: riskFocusKey,
          risk_health_band_key: riskBands.risk_health_band_key,
          risk_attention_band_key: riskBands.risk_attention_band_key,
          risk_trend_direction_key: riskBands.risk_trend_direction_key,
          risk_light_band_key: riskVisualMeta.risk_light_band_key,
          risk_glow_band_key: riskVisualMeta.risk_glow_band_key,
          risk_motion_band_key: riskVisualMeta.risk_motion_band_key,
          risk_light_scalar: riskVisualMeta.risk_light_scalar,
          risk_glow_scalar: riskVisualMeta.risk_glow_scalar,
          risk_surface_glow_scalar: riskVisualMeta.risk_surface_glow_scalar,
          risk_chrome_scalar: riskVisualMeta.risk_chrome_scalar,
          risk_pulse_scalar: riskVisualMeta.risk_pulse_scalar,
          risk_motion_scalar: riskVisualMeta.risk_motion_scalar,
          context_lookup_required: true,
          context_lookup_resolved: true,
          contract_ready: flowContextMeta.contract_ready,
          contract_missing_keys: flowContextMeta.contract_missing_keys,
          loop_status_key: loopState.loop_status_key,
          loop_status_label_key: loopState.loop_status_label_key,
          loop_stage_value: loopState.loop_stage_value,
          loop_rows: asList(loopState.loop_rows).slice(0, 3),
          loop_signal_rows: asList(loopState.loop_signal_rows).slice(0, 2),
          stage_value: loopState.loop_stage_value || microflow.stage_value,
          stage_status_key: loopState.loop_status_key || microflow.stage_status_key,
          motion_scalar: toNum(microflow.motion_scalar, 1) * toNum(loopState.loop_motion_scalar, 1),
          camera_radius_scale: toNum(microflow.camera_radius_scale, 1) * toNum(loopState.loop_radius_scale, 1),
          camera_focus_y_offset: toNum(microflow.camera_focus_y_offset, 0) + toNum(loopState.loop_focus_y_offset, 0),
          alpha_offset: toNum(microflow.alpha_offset, 0) + toNum(loopState.loop_alpha_offset, 0),
          beta_offset: toNum(microflow.beta_offset, 0) + toNum(loopState.loop_beta_offset, 0),
          focus_lerp_scalar:
            toNum(microflow.focus_lerp_scalar, 1) *
            toNum(loopState.loop_focus_lerp_scalar, 1) *
            clamp(toNum(riskVisualMeta.risk_motion_scalar, 1), 0.92, 1.08),
          radius_lerp_scalar: toNum(microflow.radius_lerp_scalar, 1) * toNum(loopState.loop_radius_lerp_scalar, 1),
          personality_key: loopPersonality.personality_key,
          personality_label_key: loopPersonality.personality_label_key,
          personality_caption_key: loopPersonality.personality_caption_key,
          personality_band_key: loopPersonality.personality_band_key,
          density_label_key: loopPersonality.density_label_key,
          light_profile_key: loopPersonality.light_profile_key,
          surface_glow_band_key: loopPersonality.surface_glow_band_key,
          chrome_band_key: loopPersonality.chrome_band_key,
          composition_profile_key: loopPersonality.composition_profile_key,
          camera_frame_key: loopPersonality.camera_frame_key,
          hud_anchor_key: loopPersonality.hud_anchor_key,
          rail_anchor_key: loopPersonality.rail_anchor_key,
          sheet_anchor_key: loopPersonality.sheet_anchor_key,
          entry_anchor_key: loopPersonality.entry_anchor_key,
          console_anchor_key: loopPersonality.console_anchor_key,
          modal_anchor_key: loopPersonality.modal_anchor_key,
          hud_focus_mode_key: loopPersonality.hud_focus_mode_key,
          rail_presence_key: loopPersonality.rail_presence_key,
          sheet_presence_key: loopPersonality.sheet_presence_key,
          entry_presence_key: loopPersonality.entry_presence_key,
          console_presence_key: loopPersonality.console_presence_key,
          modal_presence_key: loopPersonality.modal_presence_key,
          hud_density_profile_key: loopPersonality.hud_density_profile_key,
          rail_layout_key: loopPersonality.rail_layout_key,
          console_layout_key: loopPersonality.console_layout_key,
          modal_layout_key: loopPersonality.modal_layout_key,
          focus_hold_scalar: loopPersonality.focus_hold_scalar,
          camera_heading_offset: loopPersonality.camera_heading_offset,
          camera_target_x_offset: loopPersonality.camera_target_x_offset,
          camera_bank_scalar: loopPersonality.camera_bank_scalar,
          camera_fov_scalar: loopPersonality.camera_fov_scalar,
          focus_spread_scalar: loopPersonality.focus_spread_scalar,
          hud_width_scalar: loopPersonality.hud_width_scalar,
          rail_width_scalar: loopPersonality.rail_width_scalar,
          sheet_width_scalar: loopPersonality.sheet_width_scalar,
          entry_width_scalar: loopPersonality.entry_width_scalar,
          console_width_scalar: loopPersonality.console_width_scalar,
          modal_width_scalar: loopPersonality.modal_width_scalar,
          surface_gap_scalar: loopPersonality.surface_gap_scalar,
          surface_stack_scalar: loopPersonality.surface_stack_scalar,
          light_intensity_scalar: loopPersonality.light_intensity_scalar,
          glow_intensity_scalar: loopPersonality.glow_intensity_scalar,
          surface_glow_scalar: loopPersonality.surface_glow_scalar,
          chrome_opacity_scalar: loopPersonality.chrome_opacity_scalar,
          hud_layout_key: loopPersonality.hud_layout_key,
          hud_emphasis_band_key: loopPersonality.hud_emphasis_band_key,
          camera_drift_scalar: loopPersonality.camera_drift_scalar,
          camera_tilt_scalar: loopPersonality.camera_tilt_scalar,
          camera_target_lift_scalar: loopPersonality.camera_target_lift_scalar,
          camera_orbit_bias_scalar: loopPersonality.camera_orbit_bias_scalar,
          orbit_spin_scalar: loopPersonality.orbit_spin_scalar,
          sway_scalar: loopPersonality.sway_scalar,
          alpha_lerp_scalar: loopPersonality.alpha_lerp_scalar,
          beta_lerp_scalar: loopPersonality.beta_lerp_scalar,
          hud_emphasis_scalar: loopPersonality.hud_emphasis_scalar,
          actor_motion_scalar: loopPersonality.actor_motion_scalar,
          hotspot_motion_scalar: loopPersonality.hotspot_motion_scalar,
          ring_pulse_scalar: loopPersonality.ring_pulse_scalar,
          satellite_orbit_scalar: loopPersonality.satellite_orbit_scalar
        });
      });
    const primaryMicroflow = asRecord(
      enrichedMicroflows.find((flow) => asRecord(flow).action_context) || enrichedMicroflows[0]
    );
    const podContextMeta = buildInteractionContextMeta(primaryMicroflow, pod);
    const podActionContext = asRecord(podContextMeta.action_context);
    return applyResolvedActionRiskMeta(pod, podContextMeta, podActionContext, {
      microflow_cards: enrichedMicroflows,
      context_lookup_required: true,
      context_lookup_resolved: true,
      contract_ready: podContextMeta.contract_ready,
      contract_missing_keys: podContextMeta.contract_missing_keys,
      action_items: buildContextActionItems(flowPod.action_items, podActionContext)
    });
  });
  const primaryPod = asRecord(enrichedFlowPods.find((pod) => asRecord(pod).action_context) || enrichedFlowPods[0]);
  const cardContextMeta = buildInteractionContextMeta(primaryPod, card);
  const cardActionContext = asRecord(cardContextMeta.action_context);
  return applyResolvedActionRiskMeta(card, cardContextMeta, cardActionContext, {
    flow_pods: enrichedFlowPods,
    context_lookup_required: true,
    context_lookup_resolved: true,
    contract_ready: cardContextMeta.contract_ready,
    contract_missing_keys: cardContextMeta.contract_missing_keys,
    action_items: buildContextActionItems(protocolCard.action_items, cardActionContext)
  });
});
  const enrichedModalCards = asList(modal.modal_cards).map((card) => {
    const modalCard = asRecord(card);
    const protocolCard = asRecord(
      enrichedProtocolCards.find((item) => {
        const protocolItem = asRecord(item);
        if (toText(protocolItem.label_key, "") === toText(modalCard.label_key, "")) {
          return true;
        }
        return asList(protocolItem.flow_pods).some(
          (pod) => toText(asRecord(pod).label_key, "") === toText(modalCard.label_key, "")
        );
      }) || {}
    );
    const protocolPod = asRecord(
      asList(protocolCard.flow_pods).find((pod) => toText(asRecord(pod).label_key, "") === toText(modalCard.label_key, "")) ||
        asList(protocolCard.flow_pods)[0] ||
        {}
    );
    const microflow = asRecord(
      asList(protocolPod.microflow_cards).find((flow) => asRecord(flow).action_context) ||
        asList(protocolPod.microflow_cards)[0] ||
        {}
    );
    const modalCardActionItems =
      asList(modalCard.action_items).length
        ? modalCard.action_items
        : asList(microflow.action_items).length
          ? microflow.action_items
          : asList(protocolPod.action_items).length
            ? protocolPod.action_items
            : protocolCard.action_items;
    const modalContextMeta = buildInteractionContextMeta(microflow, protocolPod);
    const modalActionContext = asRecord(modalContextMeta.action_context);
    return applyResolvedActionRiskMeta(card, modalContextMeta, modalActionContext, {
      protocol_card_key: toText(protocolCard.card_key, ""),
      protocol_pod_key: toText(protocolPod.pod_key, ""),
      action_items: buildContextActionItems(modalCardActionItems, modalActionContext),
      action_key: toText(microflow.action_key, toText(protocolCard.action_key, "")),
      action_label_key: toText(microflow.action_label_key, toText(protocolCard.action_label_key, "")),
      hint_label_key: toText(microflow.hint_label_key, toText(modalActionContext.hint_label_key, "")),
      family_key: toText(microflow.family_key, toText(protocolPod.family_key, toText(protocolCard.family_key, ""))),
      flow_key: toText(microflow.flow_key, toText(protocolPod.flow_key, toText(protocolCard.flow_key, ""))),
      context_lookup_required: true,
      context_lookup_resolved: true,
      contract_ready: modalContextMeta.contract_ready,
      contract_missing_keys: modalContextMeta.contract_missing_keys
    });
  });
  const primaryModalSource = asRecord(
    enrichedModalCards.find((card) => asRecord(card).action_context) ||
      enrichedProtocolCards.find((card) => asRecord(card).action_context) ||
      enrichedProtocolCards[0] ||
      {}
  );
  const modalRootContextMeta = buildInteractionContextMeta(primaryModalSource, modal);
  const modalRootActionContext = asRecord(modalRootContextMeta.action_context);
  return applyResolvedActionRiskMeta(interactionModal, modalRootContextMeta, modalRootActionContext, {
    modal_cards: enrichedModalCards,
    protocol_cards: enrichedProtocolCards,
    action_items: buildContextActionItems(modal.action_items, modalRootActionContext),
    context_lookup_required: true,
    context_lookup_resolved: true,
    contract_ready: modalRootContextMeta.contract_ready,
    contract_missing_keys: modalRootContextMeta.contract_missing_keys
  });
}

function buildInteractionActionContextLookup(interactionModal) {
  const modal = asRecord(interactionModal);
  const lookup = new Map();
  const register = (actionKey, source) => {
    const normalizedActionKey = toText(actionKey, "");
    if (!normalizedActionKey || lookup.has(normalizedActionKey)) {
      return;
    }
    const meta = buildInteractionContextMeta(source);
    if (!meta.family_key && !meta.flow_key && !meta.microflow_key && !meta.focus_key && !meta.risk_focus_key) {
      return;
    }
    lookup.set(normalizedActionKey, meta);
  };

  asList(modal.protocol_cards).forEach((card) => {
    const protocolCard = asRecord(card);
    asList(protocolCard.action_items).forEach((item) => register(asRecord(item).action_key, item));
    asList(protocolCard.flow_pods).forEach((pod) => {
      const protocolPod = asRecord(pod);
      asList(protocolPod.action_items).forEach((item) => register(asRecord(item).action_key, item));
      asList(protocolPod.microflow_cards).forEach((flow) => {
        const protocolFlow = asRecord(flow);
        register(protocolFlow.action_key, flow);
        asList(protocolFlow.action_items).forEach((item) => register(asRecord(item).action_key, item));
      });
    });
  });
  asList(modal.modal_cards).forEach((card) => {
    const modalCard = asRecord(card);
    register(modalCard.action_key, card);
    asList(modalCard.action_items).forEach((item) => register(asRecord(item).action_key, item));
  });
  return lookup;
}

function enrichInteractionActionItems(items, actionContextLookup) {
  return asList(items).map((item) => {
    const record = asRecord(item);
    const actionKey = toText(record.action_key, "");
    const meta =
      actionContextLookup instanceof Map && actionContextLookup.size ? actionContextLookup.get(actionKey) : null;
    const recordActionContext = asRecord(record.action_context);
    const recordRiskContext = asRecord(record.risk_context);
    const contextLookupRequired =
      Boolean(meta) ||
      typeof record.context_lookup_required === "boolean" ||
      typeof recordActionContext?.context_lookup_required === "boolean" ||
      typeof recordRiskContext?.context_lookup_required === "boolean"
        ? Boolean(
            meta ||
              record.context_lookup_required ||
              recordActionContext?.context_lookup_required ||
              recordRiskContext?.context_lookup_required
          )
        : false;
    const contextLookupResolved =
      Boolean(meta) ||
      typeof record.context_lookup_resolved === "boolean" ||
      typeof recordActionContext?.context_lookup_resolved === "boolean" ||
      typeof recordRiskContext?.context_lookup_resolved === "boolean"
        ? Boolean(
            meta ||
              record.context_lookup_resolved ||
              recordActionContext?.context_lookup_resolved ||
              recordRiskContext?.context_lookup_resolved
          )
        : !contextLookupRequired;
    const resolvedMeta = meta || buildInteractionContextMeta(record);
    const enriched = applyResolvedActionRiskMeta(item, resolvedMeta, record, {
      family_key: toText(resolvedMeta?.family_key, toText(record.family_key, "")),
      flow_key: toText(resolvedMeta?.flow_key, toText(record.flow_key, "")),
      microflow_key: toText(resolvedMeta?.microflow_key, toText(record.microflow_key, "")),
      focus_key: toText(resolvedMeta?.focus_key, toText(record.focus_key, "")),
      risk_key: toText(resolvedMeta?.risk_key, toText(record.risk_key, "")),
      risk_focus_key: toText(resolvedMeta?.risk_focus_key, toText(record.risk_focus_key, "")),
      risk_health_band_key: toText(resolvedMeta?.risk_health_band_key, toText(record.risk_health_band_key, "")),
      risk_attention_band_key: toText(resolvedMeta?.risk_attention_band_key, toText(record.risk_attention_band_key, "")),
      risk_trend_direction_key: toText(
        resolvedMeta?.risk_trend_direction_key,
        toText(record.risk_trend_direction_key, "")
      ),
      entry_kind_key: toText(resolvedMeta?.entry_kind_key, toText(record.entry_kind_key, "")),
      sequence_kind_key: toText(resolvedMeta?.sequence_kind_key, toText(record.sequence_kind_key, "")),
      action_context_signature: toText(
        resolvedMeta?.action_context_signature,
        toText(record.action_context_signature, "")
      ),
      risk_context_signature: toText(
        resolvedMeta?.risk_context_signature,
        toText(record.risk_context_signature, "")
      ),
      context_lookup_required: contextLookupRequired,
      context_lookup_resolved: contextLookupResolved
    });
    return {
      ...enriched,
      context_lookup_required: contextLookupRequired,
      context_lookup_resolved: contextLookupResolved,
      contract_ready:
        typeof resolvedMeta?.contract_ready === "boolean" ? resolvedMeta.contract_ready : enriched.contract_ready,
      contract_missing_keys: Array.isArray(resolvedMeta?.contract_missing_keys)
        ? resolvedMeta.contract_missing_keys
        : Array.isArray(enriched.contract_missing_keys)
          ? enriched.contract_missing_keys
          : []
    };
  });
}

export function buildDistrictWorldState(input = {}) {
  const workspace = normalizeWorkspace(input.workspace);
  const tab = normalizeTab(input.tab);
  const scene = asRecord(input.scene);
  const sceneRuntime = asRecord(input.sceneRuntime);
  const capabilityProfile = asRecord(scene.capabilityProfile);
  const effectiveQuality = normalizeQuality(scene.effectiveQuality || sceneRuntime.effectiveQuality);
  const hudDensity = normalizeHudDensity(scene.hudDensity || sceneRuntime.hudDensity || capabilityProfile.effective_hud_density);
  const lowEndMode = Boolean(sceneRuntime.lowEndMode || capabilityProfile.low_end_mode || effectiveQuality === "low");
  const reducedMotion = Boolean(scene.reducedMotion || capabilityProfile.effective_reduced_motion);
  const districtKey = toText(sceneRuntime.districtKey || resolveDistrictKey(workspace, tab), resolveDistrictKey(workspace, tab));
  const districtLabelKey = resolveDistrictLabelKey(districtKey);
  const districtTheme = resolveDistrictTheme(districtKey);
  const sceneProfile = toText(capabilityProfile.scene_profile || (lowEndMode ? "lite" : effectiveQuality === "high" ? "cinematic" : "balanced"));
  const allowSecondaryHotspots = !lowEndMode && hudDensity !== "compact" && sceneProfile !== "lite";
  const modeLabelKey = resolveModeKey(sceneProfile, lowEndMode);

  const rawNodes =
    workspace === "admin"
      ? buildAdminNodes(input)
      : tab === "pvp"
        ? buildPlayerPvpNodes(input)
        : tab === "tasks"
          ? buildPlayerTasksNodes(input)
          : tab === "vault"
            ? buildPlayerVaultNodes(input)
            : buildPlayerHomeNodes(input);

  const nodeLimit = lowEndMode ? 3 : rawNodes.length;
  const activeNodeKey = resolveActiveNodeKey(rawNodes.slice(0, nodeLimit), input.navigationContext, workspace, tab);
  const nodes = rawNodes.slice(0, nodeLimit).map((node) => ({
    ...node,
    is_active: node.key === activeNodeKey
  }));
  const ambientEnergy = clamp(nodes.reduce((sum, node) => sum + node.energy, 0) / Math.max(1, nodes.length), 0.18, 1);
  const hotNodes = nodes.filter((node) => node.status_key === "hot").length;
  const warnNodes = nodes.filter((node) => node.status_key === "warn").length;
  const activeNode = nodes.find((node) => node.key === activeNodeKey) || null;
  const actors = buildDistrictActors(districtKey, nodes, districtTheme, ambientEnergy, lowEndMode);
  const hotspots = buildDistrictHotspots(districtKey, nodes, districtTheme, ambientEnergy, lowEndMode, allowSecondaryHotspots);
  const activeHotspotKey = resolveActiveHotspotKey(hotspots, input.navigationContext, activeNode);
  const activeHotspot = hotspots.find((hotspot) => hotspot.key === activeHotspotKey) || null;
  const interactionClusters = buildInteractionClusters(actors, hotspots, activeHotspotKey);
  const activeCluster = interactionClusters.find((cluster) => cluster.is_active) || null;
  const cameraProfile = resolveDistrictCameraProfile(districtKey, lowEndMode, effectiveQuality, hudDensity, sceneProfile);
  const hudProfile = resolveDistrictHudProfile(districtKey, hudDensity, lowEndMode, sceneProfile);
  const directorProfile = resolveDistrictDirectorProfile(districtKey, hudDensity, lowEndMode, sceneProfile);
  const railProfile = resolveDistrictRailProfile(districtKey, hudDensity, lowEndMode, sceneProfile);
  const interactionSheet = buildDistrictInteractionSheet(input, districtKey, activeHotspot, activeCluster);
  const interactionSurface = buildDistrictInteractionSurface(districtKey, activeHotspot, activeCluster, interactionSheet);
  const interactionFlow = buildDistrictInteractionFlow(input, districtKey, activeHotspot, interactionSheet);
  const interactionEntry = buildDistrictInteractionEntry(districtKey, activeHotspot, interactionSurface, interactionFlow, interactionSheet);
  const interactionTerminal = buildDistrictInteractionTerminal(
    districtKey,
    activeHotspot,
    activeCluster,
    interactionSheet,
    interactionSurface,
    interactionFlow,
    interactionEntry
  );
  const interactionModal = enrichDistrictInteractionModal(
    buildDistrictInteractionModal(input, districtKey, activeHotspot, interactionTerminal),
    input
  );
  const actionContextLookup = buildInteractionActionContextLookup(interactionModal);
  const enrichedNodes = enrichInteractionActionItems(nodes, actionContextLookup).map((node) => ({
    ...node,
    is_active: node.key === activeNodeKey
  }));
  const enrichedHotspots = enrichInteractionActionItems(hotspots, actionContextLookup).map((hotspot) => ({
    ...hotspot,
    is_active: hotspot.key === activeHotspotKey
  }));
  const enrichedInteractionClusters = buildInteractionClusters(
    actors,
    enrichedHotspots.length ? enrichedHotspots : hotspots,
    activeHotspotKey
  ).map((cluster) => ({
    ...cluster,
    action_items: enrichInteractionActionItems(cluster.action_items, actionContextLookup),
    intent_slots: enrichInteractionActionItems(cluster.intent_slots, actionContextLookup)
  }));
  const enrichedActiveHotspot = enrichedHotspots.find((hotspot) => hotspot.key === activeHotspotKey) || null;
  const enrichedActiveCluster = enrichedInteractionClusters.find((cluster) => cluster.is_active) || null;
  const enrichedInteractionSurface = interactionSurface
    ? {
        ...interactionSurface,
        action_items: enrichInteractionActionItems(interactionSurface.action_items, actionContextLookup)
      }
    : interactionSurface;
  const enrichedInteractionTerminal = interactionTerminal
    ? {
        ...interactionTerminal,
        action_items: enrichInteractionActionItems(interactionTerminal.action_items, actionContextLookup)
      }
    : interactionTerminal;
  const enrichedInteractionModal = interactionModal
    ? {
        ...interactionModal,
        action_items: enrichInteractionActionItems(interactionModal.action_items, actionContextLookup)
      }
    : interactionModal;
  const primarySurfaceAction = asRecord(asList(enrichedInteractionSurface?.action_items)[0]);
  const primarySurfaceContext = asRecord(primarySurfaceAction.action_context);
  const rootInteractionMeta = buildInteractionContextMeta(
    {
      ...primarySurfaceAction,
      district_key: districtKey,
      family_key: toText(primarySurfaceContext.family_key || primarySurfaceAction.family_key, ""),
      flow_key: toText(primarySurfaceContext.flow_key || primarySurfaceAction.flow_key, ""),
      microflow_key: toText(primarySurfaceContext.microflow_key || primarySurfaceAction.microflow_key, ""),
      focus_key: toText(primarySurfaceContext.focus_key || primarySurfaceAction.focus_key, ""),
      risk_key: toText(primarySurfaceContext.risk_key || primarySurfaceAction.risk_key, ""),
      risk_focus_key: toText(primarySurfaceContext.risk_focus_key || primarySurfaceAction.risk_focus_key, ""),
      risk_health_band_key: toText(
        primarySurfaceContext.risk_health_band_key || primarySurfaceAction.risk_health_band_key,
        ""
      ),
      risk_attention_band_key: toText(
        primarySurfaceContext.risk_attention_band_key || primarySurfaceAction.risk_attention_band_key,
        ""
      ),
      risk_trend_direction_key: toText(
        primarySurfaceContext.risk_trend_direction_key || primarySurfaceAction.risk_trend_direction_key,
        ""
      ),
      entry_kind_key: toText(
        interactionEntry?.entry_kind_key || primarySurfaceContext.entry_kind_key || primarySurfaceAction.entry_kind_key,
        ""
      ),
      sequence_kind_key: toText(
        enrichedInteractionModal?.modal_kind_key ||
          primarySurfaceContext.sequence_kind_key ||
          primarySurfaceAction.sequence_kind_key,
        ""
      ),
      context_lookup_required: true,
      context_lookup_resolved: true
    },
    enrichedInteractionSurface || interactionEntry || enrichedInteractionModal || interactionTerminal || {}
  );
  const rootInteractionContext = {
    family_key: toText(rootInteractionMeta.family_key, ""),
    flow_key: toText(rootInteractionMeta.flow_key, ""),
    microflow_key: toText(rootInteractionMeta.microflow_key, ""),
    focus_key: toText(rootInteractionMeta.focus_key, ""),
    risk_key: toText(rootInteractionMeta.risk_key, ""),
    risk_focus_key: toText(rootInteractionMeta.risk_focus_key, ""),
    risk_health_band_key: toText(rootInteractionMeta.risk_health_band_key, ""),
    risk_attention_band_key: toText(rootInteractionMeta.risk_attention_band_key, ""),
    risk_trend_direction_key: toText(rootInteractionMeta.risk_trend_direction_key, ""),
    entry_kind_key: toText(rootInteractionMeta.entry_kind_key, ""),
    sequence_kind_key: toText(rootInteractionMeta.sequence_kind_key, "")
  };
  const rootResolvedActionContext = asRecord(rootInteractionMeta.action_context) || buildActionContextShape(rootInteractionMeta);
  const rootRiskContext = asRecord(rootInteractionMeta.risk_context) || buildRiskContextShape(rootInteractionMeta);
  const finalInteractionSheetBase = interactionSheet
    ? applyResolvedInteractionContext(
        interactionSheet,
        rootInteractionContext,
        rootResolvedActionContext,
        rootRiskContext
      )
    : interactionSheet;
  const finalInteractionSurfaceBase = enrichedInteractionSurface
    ? applyResolvedInteractionContext(
        enrichedInteractionSurface,
        rootInteractionContext,
        rootResolvedActionContext,
        rootRiskContext,
        {
          entry_kind_key: toText(
            enrichedInteractionSurface.entry_kind_key || rootInteractionContext.entry_kind_key,
            ""
          ),
          sequence_kind_key: toText(
            enrichedInteractionSurface.sequence_kind_key || rootInteractionContext.sequence_kind_key,
            ""
          )
        }
      )
    : enrichedInteractionSurface;
  const finalInteractionFlowBase = interactionFlow
    ? applyResolvedInteractionContext(
        interactionFlow,
        rootInteractionContext,
        rootResolvedActionContext,
        rootRiskContext,
        {
          entry_kind_key: toText(interactionFlow.entry_kind_key || rootInteractionContext.entry_kind_key, ""),
          sequence_kind_key: toText(
            interactionFlow.sequence_kind_key || rootInteractionContext.sequence_kind_key,
            ""
          )
        }
      )
    : interactionFlow;
  const finalInteractionEntryBase = interactionEntry
    ? applyResolvedInteractionContext(
        interactionEntry,
        rootInteractionContext,
        rootResolvedActionContext,
        rootRiskContext,
        {
          entry_kind_key: toText(interactionEntry.entry_kind_key || rootInteractionContext.entry_kind_key, ""),
          sequence_kind_key: toText(
            interactionEntry.sequence_kind_key || rootInteractionContext.sequence_kind_key,
            ""
          )
        }
      )
    : interactionEntry;
  const finalInteractionTerminalBase = enrichedInteractionTerminal
    ? applyResolvedInteractionContext(
        enrichedInteractionTerminal,
        rootInteractionContext,
        rootResolvedActionContext,
        rootRiskContext,
        {
          entry_kind_key: toText(
            enrichedInteractionTerminal.entry_kind_key || rootInteractionContext.entry_kind_key,
            ""
          )
        }
      )
    : enrichedInteractionTerminal;
  const finalInteractionModalBase = enrichedInteractionModal
    ? applyResolvedInteractionContext(
        enrichedInteractionModal,
        rootInteractionContext,
        rootResolvedActionContext,
        rootRiskContext,
        {
          entry_kind_key: toText(
            enrichedInteractionModal.entry_kind_key || rootInteractionContext.entry_kind_key,
            ""
          ),
          sequence_kind_key: toText(
            enrichedInteractionModal.modal_kind_key ||
              enrichedInteractionModal.sequence_kind_key ||
              rootInteractionContext.sequence_kind_key,
            ""
          )
        }
      )
    : enrichedInteractionModal;
  const primaryRootAction = asRecord(asList(finalInteractionSurfaceBase?.action_items)[0]);
  const primaryTerminalAction = asRecord(asList(finalInteractionTerminalBase?.action_items)[0]);
  const primaryModalAction = asRecord(asList(finalInteractionModalBase?.action_items)[0]);
  const finalInteractionSheet = attachPrimaryActionMeta(finalInteractionSheetBase, primaryRootAction, rootInteractionMeta);
  const finalInteractionSurface = attachPrimaryActionMeta(
    finalInteractionSurfaceBase,
    primaryRootAction,
    rootInteractionMeta
  );
  const finalInteractionFlow = attachPrimaryActionMeta(finalInteractionFlowBase, primaryRootAction, rootInteractionMeta);
  const finalInteractionEntry = attachPrimaryActionMeta(
    finalInteractionEntryBase,
    primaryRootAction,
    rootInteractionMeta
  );
  const finalInteractionTerminal = attachPrimaryActionMeta(
    finalInteractionTerminalBase,
    toText(primaryTerminalAction.action_key, "") ? primaryTerminalAction : primaryRootAction,
    rootInteractionMeta
  );
  const finalInteractionModal = attachPrimaryActionMeta(
    finalInteractionModalBase,
    toText(primaryModalAction.action_key, "") ? primaryModalAction : primaryRootAction,
    rootInteractionMeta
  );

  return {
    world_key: `${workspace}:${tab}:${districtKey}`,
    workspace,
    tab,
    district_key: districtKey,
    district_label_key: districtLabelKey,
    district_theme_key: districtTheme.theme_key,
    mode_label_key: modeLabelKey,
    scene_profile: sceneProfile,
    effective_quality: effectiveQuality,
    hud_density: hudDensity,
    low_end_mode: lowEndMode,
    reduced_motion: reducedMotion,
    ambient_energy: ambientEnergy,
    beacon_count: nodes.length,
    hot_nodes: hotNodes,
    warn_nodes: warnNodes,
    orbit_speed: lowEndMode || reducedMotion ? 0.00004 : effectiveQuality === "high" ? 0.00014 : 0.00009,
    camera_radius: cameraProfile.radius,
    hardware_scaling: lowEndMode ? 1.9 : effectiveQuality === "high" ? 1 : effectiveQuality === "medium" ? 1.25 : 1.6,
    active_node_key: activeNodeKey,
    active_node_label: toText(activeNode?.label, ""),
    active_node_label_key: toText(activeNode?.label_key, ""),
    active_action_key: toText(activeNode?.action_key, ""),
    camera_profile_key: cameraProfile.camera_profile_key,
    camera_profile: cameraProfile,
    hud_profile_key: hudProfile.hud_profile_key,
    hud_profile: hudProfile,
    director_profile_key: directorProfile.director_profile_key,
    director_profile: directorProfile,
    rail_profile_key: railProfile.rail_profile_key,
    rail_profile: railProfile,
    active_hotspot_key: activeHotspotKey,
    active_hotspot_label: toText(enrichedActiveHotspot?.label, ""),
    active_hotspot_label_key: toText(enrichedActiveHotspot?.label_key, ""),
    active_hotspot_hint_key: toText(enrichedActiveHotspot?.hint_label_key, ""),
    active_hotspot_interaction_kind: toText(enrichedActiveHotspot?.interaction_kind, ""),
    active_hotspot_intent_profile_key: toText(enrichedActiveHotspot?.intent_profile_key, ""),
    active_hotspot_intent_label_key: toText(enrichedActiveHotspot?.intent_profile?.intent_label_key, ""),
    active_hotspot_intent_tone_key: toText(enrichedActiveHotspot?.intent_profile?.intent_tone_key, ""),
    active_hotspot_cluster_key: toText(enrichedActiveHotspot?.cluster_key, ""),
    active_hotspot_is_secondary: Boolean(enrichedActiveHotspot?.is_secondary),
    active_cluster_key: toText(enrichedActiveCluster?.cluster_key, ""),
    active_cluster_label_key: toText(enrichedActiveCluster?.label_key, ""),
    active_cluster_label: toText(enrichedActiveCluster?.label, ""),
    active_cluster_primary_action_key: toText(enrichedActiveCluster?.primary_action_key, ""),
    active_cluster_primary_hint_key: toText(enrichedActiveCluster?.primary_hint_label_key, ""),
    active_cluster_secondary_count: toNum(enrichedActiveCluster?.secondary_count, 0),
    active_cluster_actions: asList(enrichedActiveCluster?.action_items),
    active_cluster_slot_count: toNum(enrichedActiveCluster?.intent_slots?.length, 0),
    interaction_sheet: finalInteractionSheet,
    interaction_surface: finalInteractionSurface,
    interaction_flow: finalInteractionFlow,
    interaction_entry: finalInteractionEntry,
    interaction_terminal: finalInteractionTerminal,
    interaction_modal: finalInteractionModal,
    theme: districtTheme,
    actors,
    interaction_cluster_count: enrichedInteractionClusters.length,
    interaction_clusters: enrichedInteractionClusters,
    hotspots: enrichedHotspots,
    nodes: enrichedNodes
  };
}
