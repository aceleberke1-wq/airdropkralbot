"use strict";

function toNum(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || String(fallback ?? "").trim();
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

function toRate(numerator, denominator) {
  const top = Math.max(0, toNum(numerator, 0));
  const bottom = Math.max(0, toNum(denominator, 0));
  if (bottom <= 0) {
    return 0;
  }
  return Number((top / bottom).toFixed(4));
}

function resolveQualityBand(score) {
  const safe = clamp(toNum(score, 0), 0, 1);
  if (safe >= 0.97) return "green";
  if (safe >= 0.92) return "yellow";
  return "red";
}

function resolveConversionBand(intentToSubmitRate, submitToApprovedRate, intentCount) {
  const submitRate = clamp(toNum(intentToSubmitRate, 0), 0, 1);
  const approveRate = clamp(toNum(submitToApprovedRate, 0), 0, 1);
  const count = Math.max(0, Math.floor(toNum(intentCount, 0)));
  if (count < 20) {
    return "low_volume";
  }
  if (submitRate >= 0.55 && approveRate >= 0.55) {
    return "green";
  }
  if (submitRate >= 0.35 && approveRate >= 0.35) {
    return "yellow";
  }
  return "red";
}

function normalizeBreakdownRows(rows, limit = 6) {
  const source = Array.isArray(rows) ? rows : [];
  return source
    .map((row) => ({
      bucket_key: String(row?.bucket_key || "unknown"),
      item_count: Math.max(0, Math.floor(toNum(row?.item_count, 0)))
    }))
    .filter((row) => row.bucket_key)
    .slice(0, Math.max(1, Math.floor(toNum(limit, 6))));
}

function normalizeSceneDailyRows(rows, limit = 7) {
  const source = Array.isArray(rows) ? rows : [];
  return source
    .map((row) => ({
      day: String(row?.day || ""),
      total_count: Math.max(0, Math.floor(toNum(row?.total_count, 0))),
      ready_count: Math.max(0, Math.floor(toNum(row?.ready_count, 0))),
      failed_count: Math.max(0, Math.floor(toNum(row?.failed_count, 0))),
      low_end_count: Math.max(0, Math.floor(toNum(row?.low_end_count, 0)))
    }))
    .filter((row) => row.day)
    .map((row) => {
      const readyRate = toRate(row.ready_count, row.total_count);
      const failureRate = toRate(row.failed_count, row.total_count);
      const lowEndShare = toRate(row.low_end_count, row.total_count);
      return {
        ...row,
        ready_rate: readyRate,
        failure_rate: failureRate,
        low_end_share: lowEndShare,
        health_band: resolveSceneRuntimeHealthBand(readyRate, row.total_count, row.failed_count)
      };
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 7))));
}

function normalizeSceneLoopDailyRows(rows, limit = 7) {
  const source = Array.isArray(rows) ? rows : [];
  return source
    .map((row) => ({
      day: String(row?.day || ""),
      total_count: Math.max(0, Math.floor(toNum(row?.total_count, 0))),
      district_count: Math.max(0, Math.floor(toNum(row?.district_count, 0))),
      live_count: Math.max(0, Math.floor(toNum(row?.live_count, 0))),
      blocked_count: Math.max(0, Math.floor(toNum(row?.blocked_count, 0)))
    }))
    .filter((row) => row.day)
    .map((row) => {
      const liveShare = toRate(row.live_count, row.total_count);
      const blockedShare = toRate(row.blocked_count, row.total_count);
      return {
        ...row,
        live_share: liveShare,
        blocked_share: blockedShare,
        health_band: resolveSceneLoopHealthBand(row.total_count, row.district_count, liveShare, blockedShare)
      };
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 7))));
}

function normalizeSceneLoopDistrictDailyRows(rows, limit = 42) {
  const source = Array.isArray(rows) ? rows : [];
  return source
    .map((row) => ({
      day: String(row?.day || ""),
      district_key: String(row?.district_key || "unknown"),
      total_count: Math.max(0, Math.floor(toNum(row?.total_count, 0))),
      live_count: Math.max(0, Math.floor(toNum(row?.live_count, 0))),
      blocked_count: Math.max(0, Math.floor(toNum(row?.blocked_count, 0)))
    }))
    .filter((row) => row.day && row.district_key)
    .map((row) => {
      const liveShare = toRate(row.live_count, row.total_count);
      const blockedShare = toRate(row.blocked_count, row.total_count);
      return {
        ...row,
        live_share: liveShare,
        blocked_share: blockedShare,
        health_band: resolveSceneLoopDistrictHealthBand(row.total_count, liveShare, blockedShare)
      };
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 42))));
}

function normalizeSceneLoopFamilyKey(value) {
  return String(value || "unknown")
    .trim()
    .toLowerCase()
    .replace(/^world_(entry|modal|sequence)_kind_/, "")
    .replace(/^world_modal_lane_/, "")
    .replace(/_(flow|pod|sequence|terminal|console|route)$/g, "")
    .replace(/__+/g, "_") || "unknown";
}

function normalizeSceneLoopMicroflowKey(value) {
  const source = String(value || "unknown").trim().toLowerCase();
  if (!source) {
    return "unknown";
  }
  const tail = source.includes(":") ? source.split(":").pop() || source : source;
  const normalized =
    tail
      .replace(/^world_(entry|modal|sequence)_kind_/, "")
      .replace(/^world_modal_lane_/, "")
      .replace(/_(flow|pod|sequence|terminal|console|route)$/g, "")
      .replace(/__+/g, "_")
      .trim() || normalizeSceneLoopFamilyKey(source);
  return normalized || "unknown";
}

function normalizeSceneLoopMicroflowFamilyKey(value) {
  const source = String(value || "unknown").trim().toLowerCase();
  if (!source) {
    return "unknown";
  }
  const head = source.includes(":") ? source.split(":")[0] || source : source;
  return normalizeSceneLoopFamilyKey(head);
}

function resolveSceneLoopMicroflowEntryKindKey(loopMicroflowKey, loopFamilyKey) {
  const microflowKey = normalizeSceneLoopMicroflowKey(loopMicroflowKey);
  const familyKey = normalizeSceneLoopMicroflowFamilyKey(loopFamilyKey ?? loopMicroflowKey);
  switch (microflowKey) {
    case "duel":
      return "world_entry_kind_duel_console";
    case "ladder":
      return "world_entry_kind_ladder_console";
    case "telemetry":
    case "tick":
      return "world_entry_kind_telemetry_console";
    case "offer":
    case "mission":
      return "world_entry_kind_mission_terminal";
    case "claim":
      return "world_entry_kind_claim_terminal";
    case "streak":
      return "world_entry_kind_streak_terminal";
    case "wallet":
      return "world_entry_kind_wallet_terminal";
    case "payout":
      return "world_entry_kind_payout_terminal";
    case "premium":
      return "world_entry_kind_premium_terminal";
    case "route":
      return "world_entry_kind_rewards_vault";
    case "queue":
      return "world_entry_kind_queue_console";
    case "runtime":
      return "world_entry_kind_runtime_console";
    case "dispatch":
      return "world_entry_kind_dispatch_console";
    case "travel":
    case "season":
      return "world_entry_kind_hub_portal";
    default:
      break;
  }
  switch (familyKey) {
    case "duel_sync":
      return "world_entry_kind_duel_console";
    case "ladder_charge":
      return "world_entry_kind_ladder_console";
    case "telemetry_scan":
    case "tick_window":
    case "risk_watch":
      return "world_entry_kind_telemetry_console";
    case "offer_stack":
    case "mission_queue":
      return "world_entry_kind_mission_terminal";
    case "claim_lane":
      return "world_entry_kind_claim_terminal";
    case "contract_pulse":
      return "world_entry_kind_mission_terminal";
    case "streak_pulse":
      return "world_entry_kind_streak_terminal";
    case "wallet_link":
      return "world_entry_kind_wallet_terminal";
    case "payout_lane":
      return "world_entry_kind_payout_terminal";
    case "premium_lane":
      return "world_entry_kind_premium_terminal";
    case "route_matrix":
      return "world_entry_kind_rewards_vault";
    case "queue_review":
      return "world_entry_kind_queue_console";
    case "runtime_watch":
      return "world_entry_kind_runtime_console";
    case "dispatch_gate":
      return "world_entry_kind_dispatch_console";
    case "season_arc":
      return "world_entry_kind_hub_portal";
    default:
      return "world_entry_kind_hub_portal";
  }
}

function resolveSceneLoopMicroflowSequenceKindKey(loopMicroflowKey, loopFamilyKey) {
  const microflowKey = normalizeSceneLoopMicroflowKey(loopMicroflowKey);
  const familyKey = normalizeSceneLoopMicroflowFamilyKey(loopFamilyKey ?? loopMicroflowKey);
  switch (microflowKey) {
    case "duel":
      return "world_modal_kind_duel_sequence";
    case "ladder":
      return "world_modal_kind_ladder_sequence";
    case "telemetry":
    case "tick":
      return "world_modal_kind_telemetry_scan";
    case "offer":
    case "mission":
      return "world_modal_kind_mission_terminal";
    case "claim":
      return "world_modal_kind_contract_sequence";
    case "streak":
      return "world_modal_kind_streak_sync";
    case "wallet":
      return "world_modal_kind_wallet_terminal";
    case "payout":
      return "world_modal_kind_payout_route";
    case "premium":
      return "world_modal_kind_premium_unlock";
    case "route":
      return "world_modal_kind_payout_route";
    case "queue":
      return "world_modal_kind_queue_review";
    case "runtime":
      return "world_modal_kind_runtime_scan";
    case "dispatch":
      return "world_modal_kind_dispatch_sequence";
    case "travel":
    case "season":
      return "world_modal_kind_travel_gate";
    default:
      break;
  }
  switch (familyKey) {
    case "duel_sync":
      return "world_modal_kind_duel_sequence";
    case "ladder_charge":
      return "world_modal_kind_ladder_sequence";
    case "telemetry_scan":
    case "tick_window":
    case "risk_watch":
      return "world_modal_kind_telemetry_scan";
    case "offer_stack":
    case "mission_queue":
      return "world_modal_kind_mission_terminal";
    case "claim_lane":
    case "contract_pulse":
      return "world_modal_kind_contract_sequence";
    case "streak_pulse":
      return "world_modal_kind_streak_sync";
    case "wallet_link":
      return "world_modal_kind_wallet_terminal";
    case "payout_lane":
    case "route_matrix":
      return "world_modal_kind_payout_route";
    case "premium_lane":
      return "world_modal_kind_premium_unlock";
    case "queue_review":
      return "world_modal_kind_queue_review";
    case "runtime_watch":
      return "world_modal_kind_runtime_scan";
    case "dispatch_gate":
      return "world_modal_kind_dispatch_sequence";
    case "season_arc":
      return "world_modal_kind_travel_gate";
    default:
      return "world_modal_kind_travel_gate";
  }
}

function resolveSceneLoopMicroflowFlowKey(loopMicroflowKey, loopFamilyKey) {
  const microflowKey = normalizeSceneLoopMicroflowKey(loopMicroflowKey);
  const familyKey = normalizeSceneLoopMicroflowFamilyKey(loopFamilyKey ?? loopMicroflowKey);
  return `${familyKey}:${microflowKey}`;
}

function buildSceneLoopRiskContextSignature(flowKey, riskFocusKey, entryKindKey, sequenceKindKey) {
  return [
    String(flowKey || "").trim(),
    String(riskFocusKey || "").trim(),
    String(entryKindKey || "").trim(),
    String(sequenceKindKey || "").trim()
  ]
    .filter(Boolean)
    .join("|");
}

function buildSceneLoopActionContextSignature(flowKey, focusKey, entryKindKey, sequenceKindKey) {
  return [
    String(flowKey || "").trim(),
    String(focusKey || "").trim(),
    String(entryKindKey || "").trim(),
    String(sequenceKindKey || "").trim()
  ]
    .filter(Boolean)
    .join("|");
}

function isSceneLoopRiskContextReady(context) {
  const source = context && typeof context === "object" ? context : {};
  const requiredValues = [
    source.district_key,
    source.family_key,
    source.flow_key,
    source.microflow_key,
    source.focus_key,
    source.risk_key,
    source.risk_focus_key,
    source.entry_kind_key,
    source.sequence_kind_key,
    source.action_context_signature,
    source.risk_context_signature
  ];
  return requiredValues.every((value) => {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized && normalized !== "unknown";
  });
}

function buildSceneLoopRiskContextMissingKeys(context) {
  const source = context && typeof context === "object" ? context : {};
  const fields = [
    "district_key",
    "family_key",
    "flow_key",
    "microflow_key",
    "focus_key",
    "risk_key",
    "risk_focus_key",
    "entry_kind_key",
    "sequence_kind_key",
    "action_context_signature",
    "risk_context_signature"
  ];
  return fields.filter((key) => {
    const normalized = String(source[key] || "").trim().toLowerCase();
    return !normalized || normalized === "unknown";
  });
}

function buildSceneLoopRiskContext(row) {
  const source = row && typeof row === "object" ? row : {};
  const actionContextSource = asRecord(source.action_context);
  const riskContextSource = asRecord(source.risk_context);
  const contextLookupRequired =
    typeof source?.context_lookup_required === "boolean"
      ? source.context_lookup_required
      : typeof actionContextSource?.context_lookup_required === "boolean"
        ? actionContextSource.context_lookup_required
        : typeof riskContextSource?.context_lookup_required === "boolean"
          ? riskContextSource.context_lookup_required
          : false;
  const contextLookupResolved =
    typeof source?.context_lookup_resolved === "boolean"
      ? source.context_lookup_resolved
      : typeof actionContextSource?.context_lookup_resolved === "boolean"
        ? actionContextSource.context_lookup_resolved
        : typeof riskContextSource?.context_lookup_resolved === "boolean"
          ? riskContextSource.context_lookup_resolved
          : !contextLookupRequired;
  const districtKey = toText(
    riskContextSource?.district_key,
    toText(actionContextSource?.district_key, String(source?.district_key || "unknown"))
  );
  const loopFamilyKey = normalizeSceneLoopMicroflowFamilyKey(
    riskContextSource?.family_key ??
      actionContextSource?.family_key ??
      source?.loop_family_key ??
      source?.family_key ??
      source?.loop_microflow_key
  );
  const loopMicroflowKey = normalizeSceneLoopMicroflowKey(
    riskContextSource?.microflow_key ??
      actionContextSource?.microflow_key ??
      source?.loop_microflow_key ??
      source?.microflow_key
  );
  const flowKey = toText(
    riskContextSource?.flow_key,
    toText(
      actionContextSource?.flow_key,
      toText(source?.flow_key, resolveSceneLoopMicroflowFlowKey(loopMicroflowKey, loopFamilyKey))
    )
  );
  const latestHealthBand = toText(
    riskContextSource?.risk_health_band_key,
    toText(
      actionContextSource?.risk_health_band_key,
      String(source?.latest_health_band || source?.health_band || "no_data")
    )
  );
  const attentionBand = toText(
    riskContextSource?.risk_attention_band_key,
    toText(actionContextSource?.risk_attention_band_key, String(source?.attention_band || "no_data"))
  );
  const trendDirection = toText(
    riskContextSource?.risk_trend_direction_key,
    toText(actionContextSource?.risk_trend_direction_key, String(source?.trend_direction || "no_data"))
  );
  const focusKey = toText(
    riskContextSource?.focus_key,
    toText(actionContextSource?.focus_key, toText(source?.focus_key, `${districtKey}:${loopFamilyKey}:${loopMicroflowKey}`))
  );
  const riskKey = toText(
    riskContextSource?.risk_key,
    toText(actionContextSource?.risk_key, String(source?.risk_key || `${latestHealthBand}:${attentionBand}:${trendDirection}`))
  );
  const entryKindKey = toText(
    riskContextSource?.entry_kind_key,
    toText(
      actionContextSource?.entry_kind_key,
      toText(source?.entry_kind_key, resolveSceneLoopMicroflowEntryKindKey(loopMicroflowKey, loopFamilyKey))
    )
  );
  const sequenceKindKey = toText(
    riskContextSource?.sequence_kind_key,
    toText(
      actionContextSource?.sequence_kind_key,
      toText(source?.sequence_kind_key, resolveSceneLoopMicroflowSequenceKindKey(loopMicroflowKey, loopFamilyKey))
    )
  );
  const riskFocusKey = toText(
    riskContextSource?.risk_focus_key,
    toText(actionContextSource?.risk_focus_key, toText(source?.risk_focus_key, `${focusKey}|${riskKey}`))
  );
  const riskContextSignature = buildSceneLoopRiskContextSignature(
    flowKey,
    riskFocusKey,
    entryKindKey,
    sequenceKindKey
  );
  const actionContextSignature = buildSceneLoopActionContextSignature(
    flowKey,
    focusKey,
    entryKindKey,
    sequenceKindKey
  );
  const actionContext = {
    district_key: districtKey,
    family_key: loopFamilyKey,
    flow_key: flowKey,
    microflow_key: loopMicroflowKey,
    focus_key: focusKey,
    risk_key: riskKey,
    risk_focus_key: riskFocusKey,
    risk_health_band_key: latestHealthBand,
    risk_attention_band_key: attentionBand,
    risk_trend_direction_key: trendDirection,
    entry_kind_key: entryKindKey,
    sequence_kind_key: sequenceKindKey,
    action_context_signature: toText(
      actionContextSource?.action_context_signature,
      toText(riskContextSource?.action_context_signature, toText(source?.action_context_signature, actionContextSignature))
    )
  };
  const riskContext = {
    ...actionContext,
    risk_context_signature: toText(
      riskContextSource?.risk_context_signature,
      toText(actionContextSource?.risk_context_signature, toText(source?.risk_context_signature, riskContextSignature))
    )
  };
  actionContext.context_lookup_required = contextLookupRequired;
  actionContext.context_lookup_resolved = contextLookupResolved;
  riskContext.context_lookup_required = contextLookupRequired;
  riskContext.context_lookup_resolved = contextLookupResolved;
  const computedContractReady = isSceneLoopRiskContextReady({
    ...riskContext,
    action_context_signature: actionContext.action_context_signature
  });
  const computedContractMissingKeys = buildSceneLoopRiskContextMissingKeys({
    ...riskContext,
    action_context_signature: actionContext.action_context_signature
  });
  const explicitContractReady =
    typeof source?.contract_ready === "boolean"
      ? source.contract_ready
      : typeof actionContextSource?.contract_ready === "boolean"
        ? actionContextSource.contract_ready
        : typeof riskContextSource?.contract_ready === "boolean"
          ? riskContextSource.contract_ready
          : undefined;
  const explicitContractStateKey = toText(
    source?.contract_state_key,
    toText(actionContextSource?.contract_state_key, toText(riskContextSource?.contract_state_key, ""))
  );
  const explicitContractMissingKeys = [
    ...(Array.isArray(source?.contract_missing_keys) ? source.contract_missing_keys : []),
    ...(Array.isArray(actionContextSource?.contract_missing_keys) ? actionContextSource.contract_missing_keys : []),
    ...(Array.isArray(riskContextSource?.contract_missing_keys) ? riskContextSource.contract_missing_keys : [])
  ]
    .map((value) => toText(value, ""))
    .filter(Boolean);
  const contractMissingKeys = [
    ...computedContractMissingKeys,
    ...explicitContractMissingKeys,
    ...(contextLookupRequired && !contextLookupResolved ? ["action_context_lookup"] : [])
  ];
  const dedupedContractMissingKeys = [...new Set(contractMissingKeys)];
  const contractReady =
    computedContractReady &&
    explicitContractReady !== false &&
    dedupedContractMissingKeys.length === 0;
  const contractStateKey =
    explicitContractReady === false
      ? "missing"
      : explicitContractStateKey || (contractReady ? "ready" : "missing");
  actionContext.contract_state_key = contractStateKey;
  actionContext.contract_ready = contractReady;
  actionContext.contract_missing_keys = dedupedContractMissingKeys;
  riskContext.contract_state_key = contractStateKey;
  riskContext.contract_ready = contractReady;
  riskContext.contract_missing_keys = dedupedContractMissingKeys;
  return {
    district_key: districtKey,
    loop_family_key: loopFamilyKey,
    family_key: loopFamilyKey,
    flow_key: flowKey,
    loop_microflow_key: loopMicroflowKey,
    microflow_key: loopMicroflowKey,
    focus_key: focusKey,
    latest_health_band: latestHealthBand,
    attention_band: attentionBand,
    trend_direction: trendDirection,
    risk_health_band_key: latestHealthBand,
    risk_attention_band_key: attentionBand,
    risk_trend_direction_key: trendDirection,
    risk_key: riskKey,
    risk_focus_key: riskFocusKey,
    context_lookup_required: contextLookupRequired,
    context_lookup_resolved: contextLookupResolved,
    contract_state_key: contractStateKey,
    contract_ready: contractReady,
    contract_missing_keys: dedupedContractMissingKeys,
    action_context_signature: actionContext.action_context_signature,
    risk_context_signature: riskContext.risk_context_signature,
    entry_kind_key: entryKindKey,
    sequence_kind_key: sequenceKindKey,
    action_context: actionContext,
    risk_context: riskContext
  };
}

function normalizeSceneLoopDistrictFamilyDailyRows(rows, limit = 84) {
  const source = Array.isArray(rows) ? rows : [];
  return source
    .map((row) => {
      const sourceRow = row && typeof row === "object" ? row : {};
      const actionContextSource = asRecord(sourceRow.action_context);
      const riskContextSource = asRecord(sourceRow.risk_context);
      const contractMissingKeys = [
        ...(Array.isArray(sourceRow.contract_missing_keys) ? sourceRow.contract_missing_keys : []),
        ...(Array.isArray(actionContextSource?.contract_missing_keys) ? actionContextSource.contract_missing_keys : []),
        ...(Array.isArray(riskContextSource?.contract_missing_keys) ? riskContextSource.contract_missing_keys : [])
      ]
        .map((value) => toText(value, ""))
        .filter(Boolean);
      return {
        day: String(sourceRow.day || ""),
        district_key: String(sourceRow.district_key || "unknown"),
        loop_family_key: normalizeSceneLoopFamilyKey(sourceRow.loop_family_key),
        loop_microflow_key: normalizeSceneLoopMicroflowKey(
          sourceRow.loop_microflow_key ?? sourceRow.microflow_key ?? sourceRow.loop_family_key
        ),
        flow_key: toText(sourceRow.flow_key, ""),
        focus_key: toText(sourceRow.focus_key, ""),
        risk_key: toText(sourceRow.risk_key, ""),
        risk_focus_key: toText(sourceRow.risk_focus_key, ""),
        entry_kind_key: toText(sourceRow.entry_kind_key, ""),
        sequence_kind_key: toText(sourceRow.sequence_kind_key, ""),
        action_context_signature: toText(sourceRow.action_context_signature, ""),
        risk_context_signature: toText(sourceRow.risk_context_signature, ""),
        contract_state_key: toText(sourceRow.contract_state_key, ""),
        contract_ready:
          typeof sourceRow.contract_ready === "boolean" ? sourceRow.contract_ready : undefined,
        contract_missing_keys: contractMissingKeys,
        context_lookup_required:
          typeof sourceRow.context_lookup_required === "boolean"
            ? sourceRow.context_lookup_required
            : typeof actionContextSource?.context_lookup_required === "boolean"
              ? actionContextSource.context_lookup_required
              : typeof riskContextSource?.context_lookup_required === "boolean"
                ? riskContextSource.context_lookup_required
                : undefined,
        context_lookup_resolved:
          typeof sourceRow.context_lookup_resolved === "boolean"
            ? sourceRow.context_lookup_resolved
            : typeof actionContextSource?.context_lookup_resolved === "boolean"
              ? actionContextSource.context_lookup_resolved
              : typeof riskContextSource?.context_lookup_resolved === "boolean"
                ? riskContextSource.context_lookup_resolved
                : undefined,
        action_context: actionContextSource,
        risk_context: riskContextSource,
        total_count: Math.max(0, Math.floor(toNum(sourceRow.total_count, 0))),
        live_count: Math.max(0, Math.floor(toNum(sourceRow.live_count, 0))),
        blocked_count: Math.max(0, Math.floor(toNum(sourceRow.blocked_count, 0)))
      };
    })
    .filter((row) => row.day && row.district_key && row.loop_family_key)
    .map((row) => {
      const liveShare = toRate(row.live_count, row.total_count);
      const blockedShare = toRate(row.blocked_count, row.total_count);
      return {
        ...row,
        live_share: liveShare,
        blocked_share: blockedShare,
        health_band: resolveSceneLoopDistrictHealthBand(row.total_count, liveShare, blockedShare)
      };
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 84))));
}

function normalizeSceneLoopDistrictMicroflowDailyRows(rows, limit = 126) {
  const source = Array.isArray(rows) ? rows : [];
  return source
    .map((row) => {
      const sourceRow = row && typeof row === "object" ? row : {};
      const actionContextSource = asRecord(sourceRow.action_context);
      const riskContextSource = asRecord(sourceRow.risk_context);
      const contractMissingKeys = [
        ...(Array.isArray(sourceRow.contract_missing_keys) ? sourceRow.contract_missing_keys : []),
        ...(Array.isArray(actionContextSource?.contract_missing_keys) ? actionContextSource.contract_missing_keys : []),
        ...(Array.isArray(riskContextSource?.contract_missing_keys) ? riskContextSource.contract_missing_keys : [])
      ]
        .map((value) => toText(value, ""))
        .filter(Boolean);
      return {
        day: String(sourceRow.day || ""),
        district_key: String(sourceRow.district_key || "unknown"),
        loop_family_key: normalizeSceneLoopMicroflowFamilyKey(sourceRow.loop_family_key ?? sourceRow.loop_microflow_key),
        loop_microflow_key: normalizeSceneLoopMicroflowKey(sourceRow.loop_microflow_key),
        flow_key: toText(sourceRow.flow_key, ""),
        focus_key: toText(sourceRow.focus_key, ""),
        risk_key: toText(sourceRow.risk_key, ""),
        risk_focus_key: toText(sourceRow.risk_focus_key, ""),
        entry_kind_key: toText(sourceRow.entry_kind_key, ""),
        sequence_kind_key: toText(sourceRow.sequence_kind_key, ""),
        action_context_signature: toText(sourceRow.action_context_signature, ""),
        risk_context_signature: toText(sourceRow.risk_context_signature, ""),
        contract_state_key: toText(sourceRow.contract_state_key, ""),
        contract_ready:
          typeof sourceRow.contract_ready === "boolean" ? sourceRow.contract_ready : undefined,
        contract_missing_keys: [...new Set(contractMissingKeys)],
        action_context: actionContextSource && Object.keys(actionContextSource).length ? actionContextSource : null,
        risk_context: riskContextSource && Object.keys(riskContextSource).length ? riskContextSource : null,
        total_count: Math.max(0, Math.floor(toNum(sourceRow.total_count, 0))),
        live_count: Math.max(0, Math.floor(toNum(sourceRow.live_count, 0))),
        blocked_count: Math.max(0, Math.floor(toNum(sourceRow.blocked_count, 0)))
      };
    })
    .filter((row) => row.day && row.district_key && row.loop_microflow_key)
    .map((row) => {
      const liveShare = toRate(row.live_count, row.total_count);
      const blockedShare = toRate(row.blocked_count, row.total_count);
      return {
        ...row,
        live_share: liveShare,
        blocked_share: blockedShare,
        health_band: resolveSceneLoopDistrictHealthBand(row.total_count, liveShare, blockedShare)
      };
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 126))));
}

function toSceneLoopFamilyRowsFromMicroflow(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    loop_family_key: normalizeSceneLoopMicroflowFamilyKey(row?.loop_family_key ?? row?.loop_microflow_key)
  }));
}

function shouldPromoteSceneLoopRepresentative(current, day, priorityScore, context) {
  const currentRow = current && typeof current === "object" ? current : null;
  if (!currentRow) {
    return true;
  }
  const nextDay = String(day || "");
  const currentDay = String(currentRow.latest_day || currentRow.day || "");
  if (!currentDay) {
    return true;
  }
  if (nextDay && nextDay.localeCompare(currentDay) > 0) {
    return true;
  }
  if (nextDay && currentDay && nextDay.localeCompare(currentDay) < 0) {
    return false;
  }
  const nextReady = context?.contract_ready === true;
  const currentReady = currentRow.contract_ready === true;
  if (nextReady !== currentReady) {
    return nextReady;
  }
  const nextLookupResolved = context?.context_lookup_resolved === true;
  const currentLookupResolved = currentRow.context_lookup_resolved === true;
  if (nextLookupResolved !== currentLookupResolved) {
    return nextLookupResolved;
  }
  return Math.max(0, Math.floor(toNum(priorityScore, 0))) > Math.max(0, Math.floor(toNum(currentRow.priority_score, 0)));
}

function compareSceneLoopContractStrength(left, right) {
  const leftReady = left?.contract_ready === true ? 1 : 0;
  const rightReady = right?.contract_ready === true ? 1 : 0;
  if (rightReady !== leftReady) {
    return rightReady - leftReady;
  }
  const leftLookupResolved = left?.context_lookup_resolved === true ? 1 : 0;
  const rightLookupResolved = right?.context_lookup_resolved === true ? 1 : 0;
  if (rightLookupResolved !== leftLookupResolved) {
    return rightLookupResolved - leftLookupResolved;
  }
  return 0;
}

function compareSceneLoopRowsByDayAndContract(left, right, direction = "desc") {
  const leftDay = String(left?.day || left?.latest_day || "");
  const rightDay = String(right?.day || right?.latest_day || "");
  const dayGap =
    direction === "asc" ? leftDay.localeCompare(rightDay) : rightDay.localeCompare(leftDay);
  if (dayGap !== 0) {
    return dayGap;
  }
  const contractGap = compareSceneLoopContractStrength(left, right);
  if (contractGap !== 0) {
    return contractGap;
  }
  const totalGap = toNum(right?.total_count, 0) - toNum(left?.total_count, 0);
  if (Math.abs(totalGap) > 0.0001) {
    return totalGap;
  }
  return `${String(left?.district_key || "")}:${String(left?.loop_family_key || "")}:${String(left?.loop_microflow_key || "")}`.localeCompare(
    `${String(right?.district_key || "")}:${String(right?.loop_family_key || "")}:${String(right?.loop_microflow_key || "")}`
  );
}

function mapSceneLoopFamilyRowToMicroflow(row) {
  const source = row && typeof row === "object" ? row : {};
  const actionContextSource = asRecord(source.action_context);
  const riskContextSource = asRecord(source.risk_context);
  const {
    loop_family_key,
    action_context,
    risk_context,
    action_context_signature,
    risk_context_signature,
    focus_key,
    risk_key,
    risk_focus_key,
    entry_kind_key,
    sequence_kind_key,
    ...rest
  } = source;
  const rawMicroflowKey =
    source.loop_microflow_key ??
    riskContextSource?.microflow_key ??
    actionContextSource?.microflow_key ??
    loop_family_key;
  const loopFamilyKey = normalizeSceneLoopFamilyKey(loop_family_key);
  const loopMicroflowKey = normalizeSceneLoopMicroflowKey(rawMicroflowKey);
  const context = buildSceneLoopRiskContext({
    ...source,
    loop_family_key: loopFamilyKey,
    loop_microflow_key: loopMicroflowKey,
    latest_health_band: source.latest_health_band ?? source.health_band,
    attention_band: source.attention_band,
    trend_direction: source.trend_direction
  });
  return {
    ...rest,
    ...context,
    loop_family_key: loopFamilyKey,
    loop_microflow_key: loopMicroflowKey
  };
}

function resolveSceneLoopDistrictHealthBand(totalCount, liveShare, blockedShare) {
  const total = Math.max(0, Math.floor(toNum(totalCount, 0)));
  const live = clamp(toNum(liveShare, 0), 0, 1);
  const blocked = clamp(toNum(blockedShare, 0), 0, 1);
  if (total <= 0) {
    return "no_data";
  }
  if (live >= 0.8 && blocked <= 0.15 && total >= 8) {
    return "green";
  }
  if (live >= 0.45 && blocked <= 0.35 && total >= 3) {
    return "yellow";
  }
  return "red";
}

function resolveSceneLoopHealthBand(totalCount, districtCount, liveShare, blockedShare) {
  const total = Math.max(0, Math.floor(toNum(totalCount, 0)));
  const districts = Math.max(0, Math.floor(toNum(districtCount, 0)));
  const live = clamp(toNum(liveShare, 0), 0, 1);
  const blocked = clamp(toNum(blockedShare, 0), 0, 1);
  if (total <= 0) {
    return "no_data";
  }
  if (live >= 0.55 && districts >= 3 && blocked <= 0.2 && total >= 8) {
    return "green";
  }
  if (live >= 0.3 && districts >= 2 && blocked <= 0.45 && total >= 3) {
    return "yellow";
  }
  return "red";
}

function resolveSceneLoopTrendDirection(latestCount, earliestCount, sampleCount) {
  if (Math.max(0, Math.floor(toNum(sampleCount, 0))) < 2) {
    return "no_data";
  }
  const latest = Math.max(0, Math.floor(toNum(latestCount, 0)));
  const earliest = Math.max(0, Math.floor(toNum(earliestCount, 0)));
  const delta = latest - earliest;
  if (delta >= 4 || latest >= Math.ceil(earliest * 1.25)) return "improving";
  if (delta <= -4 || latest <= Math.floor(earliest * 0.75)) return "degrading";
  return "stable";
}

function buildSceneLoopBandBreakdown(rows) {
  const counters = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = String(row?.health_band || "no_data");
    counters.set(key, (counters.get(key) || 0) + 1);
  });
  return Array.from(counters.entries())
    .map(([bucket_key, item_count]) => ({
      bucket_key,
      item_count: Math.max(0, Math.floor(toNum(item_count, 0)))
    }))
    .sort((left, right) => right.item_count - left.item_count || String(left.bucket_key).localeCompare(String(right.bucket_key)));
}

function resolveSceneLoopAlarmState(rows) {
  const source = Array.isArray(rows) ? rows : [];
  if (!source.length) {
    return "no_data";
  }
  const latest = source[0] || {};
  const redDays = source.filter((row) => row?.health_band === "red").length;
  const yellowDays = source.filter((row) => row?.health_band === "yellow").length;
  if (latest.health_band === "red" || redDays >= 2 || toNum(latest.blocked_share, 0) >= 0.45) {
    return "alert";
  }
  if (latest.health_band === "yellow" || yellowDays >= 3 || toNum(latest.district_count, 0) <= 1) {
    return "watch";
  }
  return "clear";
}

function buildSceneLoopAlarmReasons(rows) {
  const source = Array.isArray(rows) ? rows : [];
  if (!source.length) {
    return [];
  }
  const latest = source[0] || {};
  const reasons = [];
  if (toNum(latest.blocked_share, 0) >= 0.45) {
    reasons.push("latest_blocked_share_spike");
  }
  if (toNum(latest.live_share, 0) <= 0.25) {
    reasons.push("latest_live_share_drop");
  }
  if (toNum(latest.district_count, 0) <= 1) {
    reasons.push("latest_district_coverage_low");
  }
  if (source.filter((row) => row?.health_band === "red").length >= 2) {
    reasons.push("repeated_red_days");
  }
  if (!reasons.length && latest.health_band === "yellow") {
    reasons.push("latest_watch_band");
  }
  return reasons.slice(0, 4);
}

function buildSceneLoopDistrictMatrix(rows, limit = 8) {
  const source = Array.isArray(rows) ? rows : [];
  const grouped = new Map();
  source.forEach((row) => {
    const districtKey = String(row?.district_key || "unknown");
    if (!grouped.has(districtKey)) {
      grouped.set(districtKey, []);
    }
    grouped.get(districtKey).push(row);
  });
  return Array.from(grouped.entries())
    .map(([district_key, districtRows]) => {
      const sortedRows = [...districtRows].sort(
        (left, right) => String(right.day || "").localeCompare(String(left.day || ""))
      );
      const totalCount = sortedRows.reduce((sum, row) => sum + Math.max(0, Math.floor(toNum(row.total_count, 0))), 0);
      const liveCount = sortedRows.reduce((sum, row) => sum + Math.max(0, Math.floor(toNum(row.live_count, 0))), 0);
      const blockedCount = sortedRows.reduce((sum, row) => sum + Math.max(0, Math.floor(toNum(row.blocked_count, 0))), 0);
      const liveShare = toRate(liveCount, totalCount);
      const blockedShare = toRate(blockedCount, totalCount);
      const latestRow = sortedRows[0] || null;
      const earliestRow = sortedRows[sortedRows.length - 1] || null;
      const dayCount = sortedRows.length;
      const greenDays = sortedRows.filter((row) => String(row?.health_band || "") === "green").length;
      const yellowDays = sortedRows.filter((row) => String(row?.health_band || "") === "yellow").length;
      const redDays = sortedRows.filter((row) => String(row?.health_band || "") === "red").length;
      return {
        district_key,
        total_count: totalCount,
        live_count: liveCount,
        blocked_count: blockedCount,
        live_share: liveShare,
        blocked_share: blockedShare,
        day_count: dayCount,
        latest_day: latestRow?.day || null,
        latest_total_count: Math.max(0, Math.floor(toNum(latestRow?.total_count, 0))),
        latest_health_band: String(latestRow?.health_band || "no_data"),
        green_days: greenDays,
        yellow_days: yellowDays,
        red_days: redDays,
        health_band: resolveSceneLoopDistrictHealthBand(totalCount, liveShare, blockedShare),
        attention_band: resolveSceneLoopDistrictAttentionBand(
          String(latestRow?.health_band || "no_data"),
          resolveSceneLoopTrendDirection(latestRow?.total_count, earliestRow?.total_count, sortedRows.length),
          blockedShare
        ),
        trend_direction: resolveSceneLoopTrendDirection(
          latestRow?.total_count,
          earliestRow?.total_count,
          sortedRows.length
        ),
        trend_delta: Math.max(
          -9999,
          Math.min(9999, Math.floor(toNum(latestRow?.total_count, 0) - toNum(earliestRow?.total_count, 0)))
        )
      };
    })
    .sort((left, right) => {
      const totalGap = toNum(right.total_count, 0) - toNum(left.total_count, 0);
      if (Math.abs(totalGap) > 0.0001) return totalGap;
      return String(left.district_key || "").localeCompare(String(right.district_key || ""));
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 8))));
}

function buildSceneLoopDistrictFamilyMatrix(rows, limit = 12) {
  const source = Array.isArray(rows) ? rows : [];
  const grouped = new Map();
  source.forEach((row) => {
    const districtKey = String(row?.district_key || "unknown");
    const loopFamilyKey = normalizeSceneLoopFamilyKey(row?.loop_family_key);
    const compositeKey = `${districtKey}:${loopFamilyKey}`;
    if (!grouped.has(compositeKey)) {
      grouped.set(compositeKey, []);
    }
    grouped.get(compositeKey).push(row);
  });
  return Array.from(grouped.entries())
    .map(([compositeKey, familyRows]) => {
      const [district_key, loop_family_key] = compositeKey.split(":");
      const sortedRows = [...familyRows].sort((left, right) => compareSceneLoopRowsByDayAndContract(left, right, "desc"));
      const earliestRows = [...familyRows].sort((left, right) => compareSceneLoopRowsByDayAndContract(left, right, "asc"));
      const totalCount = sortedRows.reduce((sum, row) => sum + Math.max(0, Math.floor(toNum(row.total_count, 0))), 0);
      const liveCount = sortedRows.reduce((sum, row) => sum + Math.max(0, Math.floor(toNum(row.live_count, 0))), 0);
      const blockedCount = sortedRows.reduce((sum, row) => sum + Math.max(0, Math.floor(toNum(row.blocked_count, 0))), 0);
      const liveShare = toRate(liveCount, totalCount);
      const blockedShare = toRate(blockedCount, totalCount);
      const latestRow = sortedRows[0] || null;
      const earliestRow = earliestRows[0] || null;
      const greenDays = sortedRows.filter((row) => String(row?.health_band || "") === "green").length;
      const yellowDays = sortedRows.filter((row) => String(row?.health_band || "") === "yellow").length;
      const redDays = sortedRows.filter((row) => String(row?.health_band || "") === "red").length;
      const latestHealthBand = String(latestRow?.health_band || "no_data");
      const trendDirection = resolveSceneLoopTrendDirection(
        latestRow?.total_count,
        earliestRow?.total_count,
        sortedRows.length
      );
      const attentionBand = resolveSceneLoopDistrictAttentionBand(
        latestHealthBand,
        trendDirection,
        blockedShare
      );
      const context = buildSceneLoopRiskContext({
        ...(latestRow && typeof latestRow === "object" ? latestRow : {}),
        district_key,
        loop_family_key,
        loop_microflow_key: latestRow?.loop_microflow_key ?? latestRow?.microflow_key ?? loop_family_key,
        latest_health_band: latestHealthBand,
        attention_band: attentionBand,
        trend_direction: trendDirection
      });
      return {
        ...context,
        district_key,
        loop_family_key,
        total_count: totalCount,
        live_count: liveCount,
        blocked_count: blockedCount,
        live_share: liveShare,
        blocked_share: blockedShare,
        day_count: sortedRows.length,
        latest_day: latestRow?.day || null,
        latest_total_count: Math.max(0, Math.floor(toNum(latestRow?.total_count, 0))),
        latest_health_band: latestHealthBand,
        green_days: greenDays,
        yellow_days: yellowDays,
        red_days: redDays,
        health_band: resolveSceneLoopDistrictHealthBand(totalCount, liveShare, blockedShare),
        attention_band: attentionBand,
        trend_direction: trendDirection,
        trend_delta: Math.max(
          -9999,
          Math.min(9999, Math.floor(toNum(latestRow?.total_count, 0) - toNum(earliestRow?.total_count, 0)))
        )
      };
    })
    .sort((left, right) => {
      const totalGap = toNum(right.total_count, 0) - toNum(left.total_count, 0);
      if (Math.abs(totalGap) > 0.0001) return totalGap;
      const contractGap = compareSceneLoopContractStrength(left, right);
      if (contractGap !== 0) return contractGap;
      return `${String(left.district_key || "")}:${String(left.loop_family_key || "")}`.localeCompare(
        `${String(right.district_key || "")}:${String(right.loop_family_key || "")}`
      );
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 12))));
}

function buildSceneLoopDistrictFamilyLatestBandBreakdown(rows) {
  const counters = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = String(row?.latest_health_band || row?.health_band || "no_data");
    const day = String(row?.latest_day || row?.day || "");
    const totalCount = Math.max(0, Math.floor(toNum(row?.total_count, 0)));
    const context = buildSceneLoopRiskContext(row);
    if (!counters.has(key)) {
      counters.set(key, {
        bucket_key: key,
        item_count: 0,
        total_count: 0,
        latest_day: day || null,
        priority_score: 0,
        ...context
      });
    }
    const current = counters.get(key);
    current.item_count = Math.max(0, Math.floor(toNum(current.item_count, 0)) + 1);
    const priorityScore = Math.max(0, Math.floor(toNum(row?.priority_score, totalCount)));
    if (shouldPromoteSceneLoopRepresentative(current, day, priorityScore, context)) {
      Object.assign(current, context);
      current.latest_day = day || null;
      current.total_count = totalCount;
    }
    current.priority_score = Math.max(toNum(current.priority_score, 0), priorityScore);
  });
  return Array.from(counters.values()).sort((left, right) => {
    const itemGap = toNum(right.item_count, 0) - toNum(left.item_count, 0);
    if (Math.abs(itemGap) > 0.0001) return itemGap;
    const contractGap = compareSceneLoopContractStrength(left, right);
    if (contractGap !== 0) return contractGap;
    return String(left.bucket_key).localeCompare(String(right.bucket_key));
  });
}

function buildSceneLoopDistrictFamilyTrendBreakdown(rows) {
  const counters = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = String(row?.trend_direction || "no_data");
    const day = String(row?.latest_day || row?.day || "");
    const totalCount = Math.max(0, Math.floor(toNum(row?.total_count, 0)));
    const context = buildSceneLoopRiskContext(row);
    if (!counters.has(key)) {
      counters.set(key, {
        bucket_key: key,
        item_count: 0,
        total_count: 0,
        latest_day: day || null,
        priority_score: 0,
        ...context
      });
    }
    const current = counters.get(key);
    current.item_count = Math.max(0, Math.floor(toNum(current.item_count, 0)) + 1);
    const priorityScore = Math.max(0, Math.floor(toNum(row?.priority_score, totalCount)));
    if (shouldPromoteSceneLoopRepresentative(current, day, priorityScore, context)) {
      Object.assign(current, context);
      current.latest_day = day || null;
      current.total_count = totalCount;
    }
    current.priority_score = Math.max(toNum(current.priority_score, 0), priorityScore);
  });
  return Array.from(counters.values()).sort((left, right) => {
    const itemGap = toNum(right.item_count, 0) - toNum(left.item_count, 0);
    if (Math.abs(itemGap) > 0.0001) return itemGap;
    const contractGap = compareSceneLoopContractStrength(left, right);
    if (contractGap !== 0) return contractGap;
    return String(left.bucket_key).localeCompare(String(right.bucket_key));
  });
}

function buildSceneLoopDistrictFamilyHealthTrendBreakdown(rows) {
  const counters = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const latestBand = String(row?.latest_health_band || row?.health_band || "no_data");
    const trend = String(row?.trend_direction || "no_data");
    const key = `${latestBand}:${trend}`;
    const day = String(row?.latest_day || row?.day || "");
    const totalCount = Math.max(0, Math.floor(toNum(row?.total_count, 0)));
    const context = buildSceneLoopRiskContext(row);
    if (!counters.has(key)) {
      counters.set(key, {
        bucket_key: key,
        item_count: 0,
        total_count: 0,
        latest_day: day || null,
        priority_score: 0,
        ...context
      });
    }
    const current = counters.get(key);
    current.item_count = Math.max(0, Math.floor(toNum(current.item_count, 0)) + 1);
    const priorityScore = Math.max(0, Math.floor(toNum(row?.priority_score, totalCount)));
    if (shouldPromoteSceneLoopRepresentative(current, day, priorityScore, context)) {
      Object.assign(current, context);
      current.latest_day = day || null;
      current.total_count = totalCount;
    }
    current.priority_score = Math.max(toNum(current.priority_score, 0), priorityScore);
  });
  return Array.from(counters.values()).sort((left, right) => {
    const itemGap = toNum(right.item_count, 0) - toNum(left.item_count, 0);
    if (Math.abs(itemGap) > 0.0001) return itemGap;
    const contractGap = compareSceneLoopContractStrength(left, right);
    if (contractGap !== 0) return contractGap;
    return String(left.bucket_key).localeCompare(String(right.bucket_key));
  });
}

function buildSceneLoopDistrictFamilyAttentionBreakdown(rows) {
  const counters = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = String(row?.attention_band || "no_data");
    const day = String(row?.latest_day || row?.day || "");
    const totalCount = Math.max(0, Math.floor(toNum(row?.total_count, 0)));
    const context = buildSceneLoopRiskContext(row);
    if (!counters.has(key)) {
      counters.set(key, {
        bucket_key: key,
        item_count: 0,
        total_count: 0,
        latest_day: day || null,
        priority_score: 0,
        ...context
      });
    }
    const current = counters.get(key);
    current.item_count = Math.max(0, Math.floor(toNum(current.item_count, 0)) + 1);
    const priorityScore = Math.max(0, Math.floor(toNum(row?.priority_score, totalCount)));
    if (shouldPromoteSceneLoopRepresentative(current, day, priorityScore, context)) {
      Object.assign(current, context);
      current.latest_day = day || null;
      current.total_count = totalCount;
    }
    current.priority_score = Math.max(toNum(current.priority_score, 0), priorityScore);
  });
  return Array.from(counters.values()).sort((left, right) => {
    const itemGap = toNum(right.item_count, 0) - toNum(left.item_count, 0);
    if (Math.abs(itemGap) > 0.0001) return itemGap;
    const contractGap = compareSceneLoopContractStrength(left, right);
    if (contractGap !== 0) return contractGap;
    return String(left.bucket_key).localeCompare(String(right.bucket_key));
  });
}

function buildSceneLoopDistrictFamilyHealthAttentionBreakdown(rows) {
  const counters = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const latestBand = String(row?.latest_health_band || row?.health_band || "no_data");
    const attention = String(row?.attention_band || "no_data");
    const key = `${latestBand}:${attention}`;
    const day = String(row?.latest_day || row?.day || "");
    const totalCount = Math.max(0, Math.floor(toNum(row?.total_count, 0)));
    const context = buildSceneLoopRiskContext(row);
    if (!counters.has(key)) {
      counters.set(key, {
        bucket_key: key,
        item_count: 0,
        total_count: 0,
        latest_day: day || null,
        ...context
      });
    }
    const current = counters.get(key);
    current.item_count = Math.max(0, Math.floor(toNum(current.item_count, 0)) + 1);
    const priorityScore = Math.max(0, Math.floor(toNum(row?.priority_score, totalCount)));
    if (shouldPromoteSceneLoopRepresentative(current, day, priorityScore, context)) {
      Object.assign(current, context);
      current.latest_day = day || null;
      current.total_count = totalCount;
    }
    current.priority_score = Math.max(toNum(current.priority_score, 0), priorityScore);
  });
  return Array.from(counters.values()).sort((left, right) => {
    const itemGap = toNum(right.item_count, 0) - toNum(left.item_count, 0);
    if (Math.abs(itemGap) > 0.0001) return itemGap;
    const contractGap = compareSceneLoopContractStrength(left, right);
    if (contractGap !== 0) return contractGap;
    return String(left.bucket_key).localeCompare(String(right.bucket_key));
  });
}

function buildSceneLoopDistrictFamilyAttentionTrendBreakdown(rows) {
  const counters = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const attention = String(row?.attention_band || "no_data");
    const trend = String(row?.trend_direction || "no_data");
    const key = `${attention}:${trend}`;
    const day = String(row?.latest_day || row?.day || "");
    const totalCount = Math.max(0, Math.floor(toNum(row?.total_count, 0)));
    const context = buildSceneLoopRiskContext(row);
    if (!counters.has(key)) {
      counters.set(key, {
        bucket_key: key,
        item_count: 0,
        total_count: 0,
        latest_day: day || null,
        ...context
      });
    }
    const current = counters.get(key);
    current.item_count = Math.max(0, Math.floor(toNum(current.item_count, 0)) + 1);
    const priorityScore = Math.max(0, Math.floor(toNum(row?.priority_score, totalCount)));
    if (shouldPromoteSceneLoopRepresentative(current, day, priorityScore, context)) {
      Object.assign(current, context);
      current.latest_day = day || null;
      current.total_count = totalCount;
    }
    current.priority_score = Math.max(toNum(current.priority_score, 0), priorityScore);
  });
  return Array.from(counters.values()).sort((left, right) => {
    const itemGap = toNum(right.item_count, 0) - toNum(left.item_count, 0);
    if (Math.abs(itemGap) > 0.0001) return itemGap;
    const contractGap = compareSceneLoopContractStrength(left, right);
    if (contractGap !== 0) return contractGap;
    return String(left.bucket_key).localeCompare(String(right.bucket_key));
  });
}

function buildSceneLoopDistrictFamilyHealthAttentionTrendBreakdown(rows) {
  const counters = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const latestBand = String(row?.latest_health_band || row?.health_band || "no_data");
    const attention = String(row?.attention_band || "no_data");
    const trend = String(row?.trend_direction || "no_data");
    const key = `${latestBand}:${attention}:${trend}`;
    const day = String(row?.latest_day || row?.day || "");
    const totalCount = Math.max(0, Math.floor(toNum(row?.total_count, 0)));
    const context = buildSceneLoopRiskContext(row);
    if (!counters.has(key)) {
      counters.set(key, {
        bucket_key: key,
        item_count: 0,
        total_count: 0,
        latest_day: day || null,
        ...context
      });
    }
    const current = counters.get(key);
    current.item_count = Math.max(0, Math.floor(toNum(current.item_count, 0)) + 1);
    const priorityScore = Math.max(0, Math.floor(toNum(row?.priority_score, totalCount)));
    if (shouldPromoteSceneLoopRepresentative(current, day, priorityScore, context)) {
      Object.assign(current, context);
      current.latest_day = day || null;
      current.total_count = totalCount;
    }
    current.priority_score = Math.max(toNum(current.priority_score, 0), priorityScore);
  });
  return Array.from(counters.values()).sort((left, right) => {
    const itemGap = toNum(right.item_count, 0) - toNum(left.item_count, 0);
    if (Math.abs(itemGap) > 0.0001) return itemGap;
    const contractGap = compareSceneLoopContractStrength(left, right);
    if (contractGap !== 0) return contractGap;
    return String(left.bucket_key).localeCompare(String(right.bucket_key));
  });
}

function rankSceneLoopAttentionBand(value) {
  const key = String(value || "no_data");
  if (key === "alert") return 3;
  if (key === "watch") return 2;
  if (key === "stable") return 1;
  return 0;
}

function rankSceneLoopHealthBand(value) {
  const key = String(value || "no_data");
  if (key === "red") return 3;
  if (key === "yellow") return 2;
  if (key === "green") return 1;
  return 0;
}

function rankSceneLoopTrendDirection(value) {
  const key = String(value || "no_data");
  if (key === "degrading") return 3;
  if (key === "no_data") return 2;
  if (key === "flat") return 1;
  if (key === "improving") return 0;
  return 0;
}

function buildSceneLoopPriorityScore(attentionRank, healthRank, trendRank, totalCount) {
  return (
    Math.max(0, Math.floor(toNum(attentionRank, 0))) * 1000 +
    Math.max(0, Math.floor(toNum(healthRank, 0))) * 100 +
    Math.max(0, Math.floor(toNum(trendRank, 0))) * 10 +
    Math.min(9, Math.max(0, Math.floor(toNum(totalCount, 0))))
  );
}

function buildSceneLoopDistrictFamilyHealthAttentionTrendMatrix(rows, limit = 12) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const latestHealthBand = String(row?.latest_health_band || row?.health_band || "no_data");
      const attentionBand = String(row?.attention_band || "no_data");
      const trendDirection = String(row?.trend_direction || "no_data");
      const context = buildSceneLoopRiskContext({
        ...(row && typeof row === "object" ? row : {}),
        loop_microflow_key: row?.loop_microflow_key ?? row?.microflow_key ?? row?.loop_family_key,
        latest_health_band: latestHealthBand,
        attention_band: attentionBand,
        trend_direction: trendDirection
      });
      return {
        ...context,
        district_key: String(row?.district_key || "unknown"),
        loop_family_key: normalizeSceneLoopFamilyKey(row?.loop_family_key),
        latest_health_band: latestHealthBand,
        attention_band: attentionBand,
        trend_direction: trendDirection,
        trend_delta: Math.floor(toNum(row?.trend_delta, 0)),
        total_count: Math.max(0, Math.floor(toNum(row?.total_count, 0))),
        live_count: Math.max(0, Math.floor(toNum(row?.live_count, 0))),
        blocked_count: Math.max(0, Math.floor(toNum(row?.blocked_count, 0))),
        attention_rank: rankSceneLoopAttentionBand(attentionBand),
        health_rank: rankSceneLoopHealthBand(latestHealthBand),
        trend_rank: rankSceneLoopTrendDirection(trendDirection)
      };
    })
    .sort((left, right) => {
      const attentionGap = toNum(right.attention_rank, 0) - toNum(left.attention_rank, 0);
      if (Math.abs(attentionGap) > 0.0001) return attentionGap;
      const healthGap = toNum(right.health_rank, 0) - toNum(left.health_rank, 0);
      if (Math.abs(healthGap) > 0.0001) return healthGap;
      const trendGap = toNum(right.trend_rank, 0) - toNum(left.trend_rank, 0);
      if (Math.abs(trendGap) > 0.0001) return trendGap;
      const contractGap = compareSceneLoopContractStrength(left, right);
      if (contractGap !== 0) return contractGap;
      const totalGap = toNum(right.total_count, 0) - toNum(left.total_count, 0);
      if (Math.abs(totalGap) > 0.0001) return totalGap;
      return `${String(left.district_key || "")}:${String(left.loop_family_key || "")}`.localeCompare(
        `${String(right.district_key || "")}:${String(right.loop_family_key || "")}`
      );
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 12))));
}

function buildSceneLoopDistrictFamilyAttentionPriority(rows, limit = 12) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const latestHealthBand = String(row?.latest_health_band || row?.health_band || "no_data");
      const attentionBand = String(row?.attention_band || "no_data");
      const trendDirection = String(row?.trend_direction || "no_data");
      const context = buildSceneLoopRiskContext({
        ...(row && typeof row === "object" ? row : {}),
        loop_microflow_key: row?.loop_microflow_key ?? row?.microflow_key ?? row?.loop_family_key,
        latest_health_band: latestHealthBand,
        attention_band: attentionBand,
        trend_direction: trendDirection
      });
      const attentionRank = rankSceneLoopAttentionBand(attentionBand);
      const healthRank = rankSceneLoopHealthBand(latestHealthBand);
      const trendRank = rankSceneLoopTrendDirection(trendDirection);
      const totalCount = Math.max(0, Math.floor(toNum(row?.total_count, 0)));
      return {
        ...context,
        district_key: String(row?.district_key || "unknown"),
        loop_family_key: normalizeSceneLoopFamilyKey(row?.loop_family_key),
        latest_health_band: latestHealthBand,
        attention_band: attentionBand,
        trend_direction: trendDirection,
        trend_delta: Math.floor(toNum(row?.trend_delta, 0)),
        total_count: totalCount,
        live_count: Math.max(0, Math.floor(toNum(row?.live_count, 0))),
        blocked_count: Math.max(0, Math.floor(toNum(row?.blocked_count, 0))),
        priority_score: buildSceneLoopPriorityScore(attentionRank, healthRank, trendRank, totalCount),
        attention_rank: attentionRank,
        health_rank: healthRank,
        trend_rank: trendRank
      };
    })
    .sort((left, right) => {
      const priorityGap = toNum(right.priority_score, 0) - toNum(left.priority_score, 0);
      if (Math.abs(priorityGap) > 0.0001) return priorityGap;
      const contractGap = compareSceneLoopContractStrength(left, right);
      if (contractGap !== 0) return contractGap;
      const totalGap = toNum(right.total_count, 0) - toNum(left.total_count, 0);
      if (Math.abs(totalGap) > 0.0001) return totalGap;
      return `${String(left.district_key || "")}:${String(left.loop_family_key || "")}`.localeCompare(
        `${String(right.district_key || "")}:${String(right.loop_family_key || "")}`
      );
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 12))));
}

function buildSceneLoopDistrictFamilyHealthAttentionTrendDailyBreakdown(rows, limit = 18) {
  const source = Array.isArray(rows) ? rows : [];
  const grouped = new Map();
  source.forEach((row) => {
    const districtKey = String(row?.district_key || "unknown");
    const loopFamilyKey = normalizeSceneLoopFamilyKey(row?.loop_family_key);
    const compositeKey = `${districtKey}:${loopFamilyKey}`;
    if (!grouped.has(compositeKey)) {
      grouped.set(compositeKey, []);
    }
    grouped.get(compositeKey).push(row);
  });
  const output = [];
  grouped.forEach((familyRows, compositeKey) => {
    const [district_key, loop_family_key] = compositeKey.split(":");
    const sortedRows = [...familyRows].sort((left, right) => String(right.day || "").localeCompare(String(left.day || "")));
    sortedRows.forEach((row, index) => {
      const liveCount = Math.max(0, Math.floor(toNum(row?.live_count, 0)));
      const blockedCount = Math.max(0, Math.floor(toNum(row?.blocked_count, 0)));
      const totalCount = Math.max(0, Math.floor(toNum(row?.total_count, 0)));
      const liveShare = toRate(liveCount, totalCount);
      const blockedShare = toRate(blockedCount, totalCount);
      const olderRow = sortedRows[index + 1] || null;
      const trendDirection = resolveSceneLoopTrendDirection(totalCount, olderRow?.total_count, olderRow ? 2 : 1);
      const latestHealthBand = resolveSceneLoopDistrictHealthBand(totalCount, liveShare, blockedShare);
      const attentionBand = resolveSceneLoopDistrictAttentionBand(latestHealthBand, trendDirection, blockedShare);
      const context = buildSceneLoopRiskContext({
        ...(row && typeof row === "object" ? row : {}),
        district_key,
        loop_family_key,
        loop_microflow_key: row?.loop_microflow_key ?? loop_family_key,
        latest_health_band: latestHealthBand,
        attention_band: attentionBand,
        trend_direction: trendDirection
      });
      output.push({
        ...context,
        day: String(row?.day || ""),
        district_key,
        loop_family_key,
        total_count: totalCount,
        live_count: liveCount,
        blocked_count: blockedCount,
        live_share: liveShare,
        blocked_share: blockedShare,
        latest_health_band: latestHealthBand,
        attention_band: attentionBand,
        trend_direction: trendDirection,
        trend_delta: Math.max(
          -9999,
          Math.min(9999, Math.floor(toNum(row?.total_count, 0) - toNum(olderRow?.total_count, 0)))
        )
      });
    });
  });
  return output
    .sort((left, right) => {
      const dayOrder = String(right.day || "").localeCompare(String(left.day || ""));
      if (dayOrder !== 0) return dayOrder;
      const attentionGap = rankSceneLoopAttentionBand(right.attention_band) - rankSceneLoopAttentionBand(left.attention_band);
      if (attentionGap !== 0) return attentionGap;
      const healthGap = rankSceneLoopHealthBand(right.latest_health_band) - rankSceneLoopHealthBand(left.latest_health_band);
      if (healthGap !== 0) return healthGap;
      const trendGap = rankSceneLoopTrendDirection(right.trend_direction) - rankSceneLoopTrendDirection(left.trend_direction);
      if (trendGap !== 0) return trendGap;
      const contractGap = compareSceneLoopContractStrength(left, right);
      if (contractGap !== 0) return contractGap;
      const totalGap = toNum(right.total_count, 0) - toNum(left.total_count, 0);
      if (Math.abs(totalGap) > 0.0001) return totalGap;
      return `${String(left.district_key || "")}:${String(left.loop_family_key || "")}`.localeCompare(
        `${String(right.district_key || "")}:${String(right.loop_family_key || "")}`
      );
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 18))));
}

function buildSceneLoopDistrictFamilyHealthAttentionTrendDailyMatrix(rows, limit = 18) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const latestHealthBand = String(row?.latest_health_band || row?.health_band || "no_data");
      const attentionBand = String(row?.attention_band || "no_data");
      const trendDirection = String(row?.trend_direction || "no_data");
      const context = buildSceneLoopRiskContext({
        ...(row && typeof row === "object" ? row : {}),
        loop_microflow_key: row?.loop_microflow_key ?? row?.microflow_key ?? row?.loop_family_key,
        latest_health_band: latestHealthBand,
        attention_band: attentionBand,
        trend_direction: trendDirection
      });
      return {
        ...context,
        day: String(row?.day || ""),
        district_key: String(row?.district_key || "unknown"),
        loop_family_key: normalizeSceneLoopFamilyKey(row?.loop_family_key),
        latest_health_band: latestHealthBand,
        attention_band: attentionBand,
        trend_direction: trendDirection,
        trend_delta: Math.max(-9999, Math.min(9999, Math.floor(toNum(row?.trend_delta, 0)))),
        total_count: Math.max(0, Math.floor(toNum(row?.total_count, 0))),
        live_count: Math.max(0, Math.floor(toNum(row?.live_count, 0))),
        blocked_count: Math.max(0, Math.floor(toNum(row?.blocked_count, 0))),
        attention_rank: rankSceneLoopAttentionBand(attentionBand),
        health_rank: rankSceneLoopHealthBand(latestHealthBand),
        trend_rank: rankSceneLoopTrendDirection(trendDirection)
      };
    })
    .sort((left, right) => {
      const dayOrder = String(right.day || "").localeCompare(String(left.day || ""));
      if (dayOrder !== 0) return dayOrder;
      const attentionGap = toNum(right.attention_rank, 0) - toNum(left.attention_rank, 0);
      if (Math.abs(attentionGap) > 0.0001) return attentionGap;
      const healthGap = toNum(right.health_rank, 0) - toNum(left.health_rank, 0);
      if (Math.abs(healthGap) > 0.0001) return healthGap;
      const trendGap = toNum(right.trend_rank, 0) - toNum(left.trend_rank, 0);
      if (Math.abs(trendGap) > 0.0001) return trendGap;
      const contractGap = compareSceneLoopContractStrength(left, right);
      if (contractGap !== 0) return contractGap;
      const totalGap = toNum(right.total_count, 0) - toNum(left.total_count, 0);
      if (Math.abs(totalGap) > 0.0001) return totalGap;
      return `${String(left.district_key || "")}:${String(left.loop_family_key || "")}`.localeCompare(
        `${String(right.district_key || "")}:${String(right.loop_family_key || "")}`
      );
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 18))));
}

function buildSceneLoopDistrictFamilyAttentionPriorityDaily(rows, limit = 18) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const latestHealthBand = String(row?.latest_health_band || row?.health_band || "no_data");
      const attentionBand = String(row?.attention_band || "no_data");
      const trendDirection = String(row?.trend_direction || "no_data");
      const context = buildSceneLoopRiskContext({
        ...(row && typeof row === "object" ? row : {}),
        loop_microflow_key: row?.loop_microflow_key ?? row?.microflow_key ?? row?.loop_family_key,
        latest_health_band: latestHealthBand,
        attention_band: attentionBand,
        trend_direction: trendDirection
      });
      const attentionRank = rankSceneLoopAttentionBand(attentionBand);
      const healthRank = rankSceneLoopHealthBand(latestHealthBand);
      const trendRank = rankSceneLoopTrendDirection(trendDirection);
      const totalCount = Math.max(0, Math.floor(toNum(row?.total_count, 0)));
      return {
        ...context,
        day: String(row?.day || ""),
        district_key: String(row?.district_key || "unknown"),
        loop_family_key: normalizeSceneLoopFamilyKey(row?.loop_family_key),
        latest_health_band: latestHealthBand,
        attention_band: attentionBand,
        trend_direction: trendDirection,
        trend_delta: Math.floor(toNum(row?.trend_delta, 0)),
        total_count: totalCount,
        live_count: Math.max(0, Math.floor(toNum(row?.live_count, 0))),
        blocked_count: Math.max(0, Math.floor(toNum(row?.blocked_count, 0))),
        priority_score: buildSceneLoopPriorityScore(attentionRank, healthRank, trendRank, totalCount),
        attention_rank: attentionRank,
        health_rank: healthRank,
        trend_rank: trendRank
      };
    })
    .sort((left, right) => {
      const dayOrder = String(right.day || "").localeCompare(String(left.day || ""));
      if (dayOrder !== 0) return dayOrder;
      const priorityGap = toNum(right.priority_score, 0) - toNum(left.priority_score, 0);
      if (Math.abs(priorityGap) > 0.0001) return priorityGap;
      const contractGap = compareSceneLoopContractStrength(left, right);
      if (contractGap !== 0) return contractGap;
      const totalGap = toNum(right.total_count, 0) - toNum(left.total_count, 0);
      if (Math.abs(totalGap) > 0.0001) return totalGap;
      return `${String(left.district_key || "")}:${String(left.loop_family_key || "")}`.localeCompare(
        `${String(right.district_key || "")}:${String(right.loop_family_key || "")}`
      );
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 18))));
}

function buildSceneLoopDistrictMicroflowMatrix(rows, limit = 18) {
  const source = Array.isArray(rows) ? rows : [];
  const grouped = new Map();
  source.forEach((row) => {
    const districtKey = String(row?.district_key || "unknown");
    const loopMicroflowKey = normalizeSceneLoopMicroflowKey(row?.loop_microflow_key);
    const loopFamilyKey = normalizeSceneLoopMicroflowFamilyKey(row?.loop_family_key ?? row?.loop_microflow_key);
    const compositeKey = `${districtKey}:${loopMicroflowKey}`;
    if (!grouped.has(compositeKey)) {
      grouped.set(compositeKey, { districtKey, loopMicroflowKey, loopFamilyKey, rows: [] });
    }
    grouped.get(compositeKey).rows.push(row);
  });
  return Array.from(grouped.values())
    .map(({ districtKey, loopMicroflowKey, loopFamilyKey, rows: microflowRows }) => {
      const sortedRows = [...microflowRows].sort((left, right) => String(right.day || "").localeCompare(String(left.day || "")));
      const totalCount = sortedRows.reduce((sum, row) => sum + Math.max(0, Math.floor(toNum(row.total_count, 0))), 0);
      const liveCount = sortedRows.reduce((sum, row) => sum + Math.max(0, Math.floor(toNum(row.live_count, 0))), 0);
      const blockedCount = sortedRows.reduce((sum, row) => sum + Math.max(0, Math.floor(toNum(row.blocked_count, 0))), 0);
      const liveShare = toRate(liveCount, totalCount);
      const blockedShare = toRate(blockedCount, totalCount);
      const latestRow = sortedRows[0] || null;
      const earliestRow = sortedRows[sortedRows.length - 1] || null;
      const latestHealthBand = String(latestRow?.health_band || "no_data");
      const trendDirection = resolveSceneLoopTrendDirection(
        latestRow?.total_count,
        earliestRow?.total_count,
        sortedRows.length
      );
      const greenDays = sortedRows.filter((row) => String(row?.health_band || "") === "green").length;
      const yellowDays = sortedRows.filter((row) => String(row?.health_band || "") === "yellow").length;
      const redDays = sortedRows.filter((row) => String(row?.health_band || "") === "red").length;
      const attentionBand = resolveSceneLoopDistrictAttentionBand(latestHealthBand, trendDirection, blockedShare);
      const latestRowSource = latestRow && typeof latestRow === "object" ? latestRow : {};
      const context = buildSceneLoopRiskContext({
        ...latestRowSource,
        district_key: districtKey,
        loop_family_key: loopFamilyKey,
        loop_microflow_key: loopMicroflowKey,
        latest_health_band: latestHealthBand,
        attention_band: attentionBand,
        trend_direction: trendDirection
      });
      return {
        ...context,
        district_key: districtKey,
        loop_family_key: loopFamilyKey,
        loop_microflow_key: loopMicroflowKey,
        total_count: totalCount,
        live_count: liveCount,
        blocked_count: blockedCount,
        live_share: liveShare,
        blocked_share: blockedShare,
        day_count: sortedRows.length,
        latest_day: latestRow?.day || null,
        latest_total_count: Math.max(0, Math.floor(toNum(latestRow?.total_count, 0))),
        latest_health_band: latestHealthBand,
        green_days: greenDays,
        yellow_days: yellowDays,
        red_days: redDays,
        health_band: resolveSceneLoopDistrictHealthBand(totalCount, liveShare, blockedShare),
        attention_band: attentionBand,
        trend_direction: trendDirection,
        trend_delta: Math.max(
          -9999,
          Math.min(9999, Math.floor(toNum(latestRow?.total_count, 0) - toNum(earliestRow?.total_count, 0)))
        )
      };
    })
    .sort((left, right) => {
      const totalGap = toNum(right.total_count, 0) - toNum(left.total_count, 0);
      if (Math.abs(totalGap) > 0.0001) return totalGap;
      return `${String(left.district_key || "")}:${String(left.loop_microflow_key || "")}`.localeCompare(
        `${String(right.district_key || "")}:${String(right.loop_microflow_key || "")}`
      );
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 18))));
}

function buildSceneLoopDistrictMicroflowHealthAttentionBreakdown(rows, limit = 18) {
  const counters = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const latestBand = String(row?.latest_health_band || row?.health_band || "no_data");
    const attention = String(row?.attention_band || "no_data");
    const key = `${latestBand}:${attention}`;
    const day = String(row?.latest_day || row?.day || "");
    const totalCount = Math.max(0, Math.floor(toNum(row?.total_count, 0)));
    const context = buildSceneLoopRiskContext(row);
    if (!counters.has(key)) {
      counters.set(key, {
        bucket_key: key,
        item_count: 0,
        total_count: 0,
        latest_day: day || null,
        ...context
      });
    }
    const current = counters.get(key);
    current.item_count = Math.max(0, Math.floor(toNum(current.item_count, 0)) + 1);
    current.total_count = Math.max(toNum(current.total_count, 0), totalCount);
    const latestDay = String(current.latest_day || "");
    const shouldReplace =
      !latestDay ||
      (day && day.localeCompare(latestDay) > 0) ||
      (day === latestDay && totalCount > toNum(current.total_count, 0));
    if (shouldReplace) {
      Object.assign(current, context);
      current.latest_day = day || null;
    }
  });
  return Array.from(counters.values())
    .sort((left, right) => right.item_count - left.item_count || String(left.bucket_key).localeCompare(String(right.bucket_key)))
    .slice(0, Math.max(1, Math.floor(toNum(limit, 18))));
}

function buildSceneLoopDistrictMicroflowAttentionTrendBreakdown(rows, limit = 18) {
  const counters = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const attention = String(row?.attention_band || "no_data");
    const trend = String(row?.trend_direction || "no_data");
    const key = `${attention}:${trend}`;
    const day = String(row?.latest_day || row?.day || "");
    const totalCount = Math.max(0, Math.floor(toNum(row?.total_count, 0)));
    const context = buildSceneLoopRiskContext(row);
    if (!counters.has(key)) {
      counters.set(key, {
        bucket_key: key,
        item_count: 0,
        total_count: 0,
        latest_day: day || null,
        ...context
      });
    }
    const current = counters.get(key);
    current.item_count = Math.max(0, Math.floor(toNum(current.item_count, 0)) + 1);
    current.total_count = Math.max(toNum(current.total_count, 0), totalCount);
    const latestDay = String(current.latest_day || "");
    const shouldReplace =
      !latestDay ||
      (day && day.localeCompare(latestDay) > 0) ||
      (day === latestDay && totalCount > toNum(current.total_count, 0));
    if (shouldReplace) {
      Object.assign(current, context);
      current.latest_day = day || null;
    }
  });
  return Array.from(counters.values())
    .sort((left, right) => right.item_count - left.item_count || String(left.bucket_key).localeCompare(String(right.bucket_key)))
    .slice(0, Math.max(1, Math.floor(toNum(limit, 18))));
}

function buildSceneLoopDistrictMicroflowHealthAttentionTrendBreakdown(rows, limit = 18) {
  const counters = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const latestBand = String(row?.latest_health_band || row?.health_band || "no_data");
    const attention = String(row?.attention_band || "no_data");
    const trend = String(row?.trend_direction || "no_data");
    const key = `${latestBand}:${attention}:${trend}`;
    const day = String(row?.latest_day || row?.day || "");
    const totalCount = Math.max(0, Math.floor(toNum(row?.total_count, 0)));
    const context = buildSceneLoopRiskContext(row);
    if (!counters.has(key)) {
      counters.set(key, {
        bucket_key: key,
        item_count: 0,
        total_count: 0,
        latest_day: day || null,
        ...context
      });
    }
    const current = counters.get(key);
    current.item_count = Math.max(0, Math.floor(toNum(current.item_count, 0)) + 1);
    current.total_count = Math.max(toNum(current.total_count, 0), totalCount);
    const latestDay = String(current.latest_day || "");
    const shouldReplace =
      !latestDay ||
      (day && day.localeCompare(latestDay) > 0) ||
      (day === latestDay && totalCount > toNum(current.total_count, 0));
    if (shouldReplace) {
      Object.assign(current, context);
      current.latest_day = day || null;
    }
  });
  return Array.from(counters.values())
    .sort((left, right) => right.item_count - left.item_count || String(left.bucket_key).localeCompare(String(right.bucket_key)))
    .slice(0, Math.max(1, Math.floor(toNum(limit, 18))));
}

function buildSceneLoopDistrictMicroflowHealthAttentionTrendMatrix(rows, limit = 18) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const latestHealthBand = String(row?.latest_health_band || row?.health_band || "no_data");
      const attentionBand = String(row?.attention_band || "no_data");
      const trendDirection = String(row?.trend_direction || "no_data");
      const context = buildSceneLoopRiskContext({
        ...(row && typeof row === "object" ? row : {}),
        latest_health_band: latestHealthBand,
        attention_band: attentionBand,
        trend_direction: trendDirection
      });
      return {
        ...context,
        district_key: String(row?.district_key || "unknown"),
        loop_family_key: normalizeSceneLoopMicroflowFamilyKey(row?.loop_family_key ?? row?.loop_microflow_key),
        loop_microflow_key: normalizeSceneLoopMicroflowKey(row?.loop_microflow_key),
        latest_health_band: latestHealthBand,
        attention_band: attentionBand,
        trend_direction: trendDirection,
        trend_delta: Math.floor(toNum(row?.trend_delta, 0)),
        total_count: Math.max(0, Math.floor(toNum(row?.total_count, 0))),
        live_count: Math.max(0, Math.floor(toNum(row?.live_count, 0))),
        blocked_count: Math.max(0, Math.floor(toNum(row?.blocked_count, 0))),
        attention_rank: rankSceneLoopAttentionBand(attentionBand),
        health_rank: rankSceneLoopHealthBand(latestHealthBand),
        trend_rank: rankSceneLoopTrendDirection(trendDirection)
      };
    })
    .sort((left, right) => {
      const attentionGap = toNum(right.attention_rank, 0) - toNum(left.attention_rank, 0);
      if (Math.abs(attentionGap) > 0.0001) return attentionGap;
      const healthGap = toNum(right.health_rank, 0) - toNum(left.health_rank, 0);
      if (Math.abs(healthGap) > 0.0001) return healthGap;
      const trendGap = toNum(right.trend_rank, 0) - toNum(left.trend_rank, 0);
      if (Math.abs(trendGap) > 0.0001) return trendGap;
      const totalGap = toNum(right.total_count, 0) - toNum(left.total_count, 0);
      if (Math.abs(totalGap) > 0.0001) return totalGap;
      return `${String(left.district_key || "")}:${String(left.loop_microflow_key || "")}`.localeCompare(
        `${String(right.district_key || "")}:${String(right.loop_microflow_key || "")}`
      );
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 18))));
}

function buildSceneLoopDistrictMicroflowHealthAttentionTrendDailyBreakdown(rows, limit = 24) {
  const source = Array.isArray(rows) ? rows : [];
  const grouped = new Map();
  source.forEach((row) => {
    const districtKey = String(row?.district_key || "unknown");
    const loopMicroflowKey = normalizeSceneLoopMicroflowKey(row?.loop_microflow_key);
    const loopFamilyKey = normalizeSceneLoopMicroflowFamilyKey(row?.loop_family_key ?? row?.loop_microflow_key);
    const compositeKey = `${districtKey}:${loopMicroflowKey}`;
    if (!grouped.has(compositeKey)) {
      grouped.set(compositeKey, { districtKey, loopMicroflowKey, loopFamilyKey, rows: [] });
    }
    grouped.get(compositeKey).rows.push(row);
  });
  const output = [];
  grouped.forEach(({ districtKey, loopMicroflowKey, loopFamilyKey, rows: microflowRows }) => {
    const sortedRows = [...microflowRows].sort((left, right) => String(right.day || "").localeCompare(String(left.day || "")));
    sortedRows.forEach((row, index) => {
      const liveCount = Math.max(0, Math.floor(toNum(row?.live_count, 0)));
      const blockedCount = Math.max(0, Math.floor(toNum(row?.blocked_count, 0)));
      const totalCount = Math.max(0, Math.floor(toNum(row?.total_count, 0)));
      const liveShare = toRate(liveCount, totalCount);
      const blockedShare = toRate(blockedCount, totalCount);
      const olderRow = sortedRows[index + 1] || null;
      const trendDirection = resolveSceneLoopTrendDirection(totalCount, olderRow?.total_count, olderRow ? 2 : 1);
      const latestHealthBand = resolveSceneLoopDistrictHealthBand(totalCount, liveShare, blockedShare);
      const attentionBand = resolveSceneLoopDistrictAttentionBand(latestHealthBand, trendDirection, blockedShare);
      const actionContextSource = asRecord(row?.action_context);
      const riskContextSource = asRecord(row?.risk_context);
      const flowKey = toText(
        row?.flow_key,
        toText(
          riskContextSource?.flow_key,
          toText(actionContextSource?.flow_key, resolveSceneLoopMicroflowFlowKey(loopMicroflowKey, loopFamilyKey))
        )
      );
      const focusKey = toText(
        row?.focus_key,
        toText(riskContextSource?.focus_key, toText(actionContextSource?.focus_key, `${districtKey}:${loopFamilyKey}:${loopMicroflowKey}`))
      );
      const entryKindKey = toText(
        row?.entry_kind_key,
        toText(
          riskContextSource?.entry_kind_key,
          toText(actionContextSource?.entry_kind_key, resolveSceneLoopMicroflowEntryKindKey(loopMicroflowKey, loopFamilyKey))
        )
      );
      const sequenceKindKey = toText(
        row?.sequence_kind_key,
        toText(
          riskContextSource?.sequence_kind_key,
          toText(actionContextSource?.sequence_kind_key, resolveSceneLoopMicroflowSequenceKindKey(loopMicroflowKey, loopFamilyKey))
        )
      );
      const actionContextSignature = toText(
        row?.action_context_signature,
        toText(
          actionContextSource?.action_context_signature,
          toText(
            riskContextSource?.action_context_signature,
            buildSceneLoopActionContextSignature(flowKey, focusKey, entryKindKey, sequenceKindKey)
          )
        )
      );
      const explicitContractStateKey = toText(
        row?.contract_state_key,
        toText(actionContextSource?.contract_state_key, toText(riskContextSource?.contract_state_key, ""))
      );
      const explicitContractReady =
        typeof row?.contract_ready === "boolean"
          ? row.contract_ready
          : typeof actionContextSource?.contract_ready === "boolean"
            ? actionContextSource.contract_ready
            : typeof riskContextSource?.contract_ready === "boolean"
              ? riskContextSource.contract_ready
              : undefined;
      const explicitContractMissingKeys = [
        ...(Array.isArray(row?.contract_missing_keys) ? row.contract_missing_keys : []),
        ...(Array.isArray(actionContextSource?.contract_missing_keys) ? actionContextSource.contract_missing_keys : []),
        ...(Array.isArray(riskContextSource?.contract_missing_keys) ? riskContextSource.contract_missing_keys : [])
      ]
        .map((value) => toText(value, ""))
        .filter(Boolean);
      const contextLookupRequired =
        typeof row?.context_lookup_required === "boolean"
          ? row.context_lookup_required
          : typeof actionContextSource?.context_lookup_required === "boolean"
            ? actionContextSource.context_lookup_required
            : typeof riskContextSource?.context_lookup_required === "boolean"
              ? riskContextSource.context_lookup_required
              : false;
      const contextLookupResolved =
        typeof row?.context_lookup_resolved === "boolean"
          ? row.context_lookup_resolved
          : typeof actionContextSource?.context_lookup_resolved === "boolean"
            ? actionContextSource.context_lookup_resolved
            : typeof riskContextSource?.context_lookup_resolved === "boolean"
              ? riskContextSource.context_lookup_resolved
              : !contextLookupRequired;
      const context = buildSceneLoopRiskContext({
        district_key: districtKey,
        loop_family_key: loopFamilyKey,
        loop_microflow_key: loopMicroflowKey,
        flow_key: flowKey,
        focus_key: focusKey,
        entry_kind_key: entryKindKey,
        sequence_kind_key: sequenceKindKey,
        latest_health_band: latestHealthBand,
        attention_band: attentionBand,
        trend_direction: trendDirection,
        action_context_signature: actionContextSignature,
        context_lookup_required: contextLookupRequired,
        context_lookup_resolved: contextLookupResolved,
        contract_state_key: explicitContractStateKey,
        contract_ready: explicitContractReady,
        contract_missing_keys: explicitContractMissingKeys,
        action_context: {
          district_key: districtKey,
          family_key: loopFamilyKey,
          flow_key: flowKey,
          microflow_key: loopMicroflowKey,
          focus_key: focusKey,
          entry_kind_key: entryKindKey,
          sequence_kind_key: sequenceKindKey,
          action_context_signature: actionContextSignature,
          context_lookup_required: contextLookupRequired,
          context_lookup_resolved: contextLookupResolved,
          contract_state_key: explicitContractStateKey,
          contract_ready: explicitContractReady,
          contract_missing_keys: explicitContractMissingKeys
        },
        risk_context: {
          district_key: districtKey,
          family_key: loopFamilyKey,
          flow_key: flowKey,
          microflow_key: loopMicroflowKey,
          focus_key: focusKey,
          entry_kind_key: entryKindKey,
          sequence_kind_key: sequenceKindKey,
          risk_health_band_key: latestHealthBand,
          risk_attention_band_key: attentionBand,
          risk_trend_direction_key: trendDirection,
          context_lookup_required: contextLookupRequired,
          context_lookup_resolved: contextLookupResolved,
          contract_state_key: explicitContractStateKey,
          contract_ready: explicitContractReady,
          contract_missing_keys: explicitContractMissingKeys
        }
      });
      output.push({
        ...context,
        day: String(row?.day || ""),
        district_key: districtKey,
        loop_family_key: loopFamilyKey,
        loop_microflow_key: loopMicroflowKey,
        total_count: totalCount,
        live_count: liveCount,
        blocked_count: blockedCount,
        live_share: liveShare,
        blocked_share: blockedShare,
        latest_health_band: latestHealthBand,
        attention_band: attentionBand,
        trend_direction: trendDirection,
        trend_delta: Math.max(
          -9999,
          Math.min(9999, Math.floor(toNum(row?.total_count, 0) - toNum(olderRow?.total_count, 0)))
        )
      });
    });
  });
  return output
    .sort((left, right) => {
      const dayOrder = String(right.day || "").localeCompare(String(left.day || ""));
      if (dayOrder !== 0) return dayOrder;
      const attentionGap = rankSceneLoopAttentionBand(right.attention_band) - rankSceneLoopAttentionBand(left.attention_band);
      if (attentionGap !== 0) return attentionGap;
      const healthGap = rankSceneLoopHealthBand(right.latest_health_band) - rankSceneLoopHealthBand(left.latest_health_band);
      if (healthGap !== 0) return healthGap;
      const trendGap = rankSceneLoopTrendDirection(right.trend_direction) - rankSceneLoopTrendDirection(left.trend_direction);
      if (trendGap !== 0) return trendGap;
      const contractGap = compareSceneLoopContractStrength(left, right);
      if (contractGap !== 0) return contractGap;
      const totalGap = toNum(right.total_count, 0) - toNum(left.total_count, 0);
      if (Math.abs(totalGap) > 0.0001) return totalGap;
      return `${String(left.district_key || "")}:${String(left.loop_microflow_key || "")}`.localeCompare(
        `${String(right.district_key || "")}:${String(right.loop_microflow_key || "")}`
      );
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 24))));
}

function buildSceneLoopDistrictMicroflowHealthAttentionTrendDailyMatrix(rows, limit = 24) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const latestHealthBand = String(row?.latest_health_band || row?.health_band || "no_data");
      const attentionBand = String(row?.attention_band || "no_data");
      const trendDirection = String(row?.trend_direction || "no_data");
      const context = buildSceneLoopRiskContext({
        ...(row && typeof row === "object" ? row : {}),
        latest_health_band: latestHealthBand,
        attention_band: attentionBand,
        trend_direction: trendDirection
      });
      return {
        ...context,
        day: String(row?.day || ""),
        district_key: String(row?.district_key || "unknown"),
        loop_family_key: normalizeSceneLoopMicroflowFamilyKey(row?.loop_family_key ?? row?.loop_microflow_key),
        loop_microflow_key: normalizeSceneLoopMicroflowKey(row?.loop_microflow_key),
        latest_health_band: latestHealthBand,
        attention_band: attentionBand,
        trend_direction: trendDirection,
        trend_delta: Math.max(-9999, Math.min(9999, Math.floor(toNum(row?.trend_delta, 0)))),
        total_count: Math.max(0, Math.floor(toNum(row?.total_count, 0))),
        live_count: Math.max(0, Math.floor(toNum(row?.live_count, 0))),
        blocked_count: Math.max(0, Math.floor(toNum(row?.blocked_count, 0))),
        attention_rank: rankSceneLoopAttentionBand(attentionBand),
        health_rank: rankSceneLoopHealthBand(latestHealthBand),
        trend_rank: rankSceneLoopTrendDirection(trendDirection)
      };
    })
    .sort((left, right) => {
      const dayOrder = String(right.day || "").localeCompare(String(left.day || ""));
      if (dayOrder !== 0) return dayOrder;
      const attentionGap = toNum(right.attention_rank, 0) - toNum(left.attention_rank, 0);
      if (Math.abs(attentionGap) > 0.0001) return attentionGap;
      const healthGap = toNum(right.health_rank, 0) - toNum(left.health_rank, 0);
      if (Math.abs(healthGap) > 0.0001) return healthGap;
      const trendGap = toNum(right.trend_rank, 0) - toNum(left.trend_rank, 0);
      if (Math.abs(trendGap) > 0.0001) return trendGap;
      const contractGap = compareSceneLoopContractStrength(left, right);
      if (contractGap !== 0) return contractGap;
      const totalGap = toNum(right.total_count, 0) - toNum(left.total_count, 0);
      if (Math.abs(totalGap) > 0.0001) return totalGap;
      return `${String(left.district_key || "")}:${String(left.loop_microflow_key || "")}`.localeCompare(
        `${String(right.district_key || "")}:${String(right.loop_microflow_key || "")}`
      );
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 24))));
}

function buildSceneLoopDistrictMicroflowAttentionPriority(rows, limit = 18) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const latestHealthBand = String(row?.latest_health_band || row?.health_band || "no_data");
      const attentionBand = String(row?.attention_band || "no_data");
      const trendDirection = String(row?.trend_direction || "no_data");
      const context = buildSceneLoopRiskContext({
        ...(row && typeof row === "object" ? row : {}),
        latest_health_band: latestHealthBand,
        attention_band: attentionBand,
        trend_direction: trendDirection
      });
      const attentionRank = rankSceneLoopAttentionBand(attentionBand);
      const healthRank = rankSceneLoopHealthBand(latestHealthBand);
      const trendRank = rankSceneLoopTrendDirection(trendDirection);
      const totalCount = Math.max(0, Math.floor(toNum(row?.total_count, 0)));
      return {
        ...context,
        district_key: String(row?.district_key || "unknown"),
        loop_family_key: normalizeSceneLoopMicroflowFamilyKey(row?.loop_family_key ?? row?.loop_microflow_key),
        loop_microflow_key: normalizeSceneLoopMicroflowKey(row?.loop_microflow_key),
        latest_health_band: latestHealthBand,
        attention_band: attentionBand,
        trend_direction: trendDirection,
        trend_delta: Math.floor(toNum(row?.trend_delta, 0)),
        total_count: totalCount,
        live_count: Math.max(0, Math.floor(toNum(row?.live_count, 0))),
        blocked_count: Math.max(0, Math.floor(toNum(row?.blocked_count, 0))),
        priority_score: buildSceneLoopPriorityScore(attentionRank, healthRank, trendRank, totalCount),
        attention_rank: attentionRank,
        health_rank: healthRank,
        trend_rank: trendRank
      };
    })
    .sort((left, right) => {
      const priorityGap = toNum(right.priority_score, 0) - toNum(left.priority_score, 0);
      if (Math.abs(priorityGap) > 0.0001) return priorityGap;
      const totalGap = toNum(right.total_count, 0) - toNum(left.total_count, 0);
      if (Math.abs(totalGap) > 0.0001) return totalGap;
      return `${String(left.district_key || "")}:${String(left.loop_microflow_key || "")}`.localeCompare(
        `${String(right.district_key || "")}:${String(right.loop_microflow_key || "")}`
      );
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 18))));
}

function buildSceneLoopDistrictMicroflowAttentionPriorityDaily(rows, limit = 24) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const latestHealthBand = String(row?.latest_health_band || row?.health_band || "no_data");
      const attentionBand = String(row?.attention_band || "no_data");
      const trendDirection = String(row?.trend_direction || "no_data");
      const context = buildSceneLoopRiskContext({
        ...(row && typeof row === "object" ? row : {}),
        latest_health_band: latestHealthBand,
        attention_band: attentionBand,
        trend_direction: trendDirection
      });
      const attentionRank = rankSceneLoopAttentionBand(attentionBand);
      const healthRank = rankSceneLoopHealthBand(latestHealthBand);
      const trendRank = rankSceneLoopTrendDirection(trendDirection);
      const totalCount = Math.max(0, Math.floor(toNum(row?.total_count, 0)));
      return {
        day: String(row?.day || ""),
        ...context,
        district_key: String(row?.district_key || "unknown"),
        loop_family_key: normalizeSceneLoopMicroflowFamilyKey(row?.loop_family_key ?? row?.loop_microflow_key),
        loop_microflow_key: normalizeSceneLoopMicroflowKey(row?.loop_microflow_key),
        latest_health_band: latestHealthBand,
        attention_band: attentionBand,
        trend_direction: trendDirection,
        trend_delta: Math.floor(toNum(row?.trend_delta, 0)),
        total_count: totalCount,
        live_count: Math.max(0, Math.floor(toNum(row?.live_count, 0))),
        blocked_count: Math.max(0, Math.floor(toNum(row?.blocked_count, 0))),
        priority_score: buildSceneLoopPriorityScore(attentionRank, healthRank, trendRank, totalCount),
        attention_rank: attentionRank,
        health_rank: healthRank,
        trend_rank: trendRank
      };
    })
    .sort((left, right) => {
      const dayOrder = String(right.day || "").localeCompare(String(left.day || ""));
      if (dayOrder !== 0) return dayOrder;
      const priorityGap = toNum(right.priority_score, 0) - toNum(left.priority_score, 0);
      if (Math.abs(priorityGap) > 0.0001) return priorityGap;
      const contractGap = compareSceneLoopContractStrength(left, right);
      if (contractGap !== 0) return contractGap;
      const totalGap = toNum(right.total_count, 0) - toNum(left.total_count, 0);
      if (Math.abs(totalGap) > 0.0001) return totalGap;
      return `${String(left.district_key || "")}:${String(left.loop_microflow_key || "")}`.localeCompare(
        `${String(right.district_key || "")}:${String(right.loop_microflow_key || "")}`
      );
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 24))));
}

function buildSceneLoopDistrictMicroflowRiskRows(rows, limit = 18) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const context = buildSceneLoopRiskContext(row);
      const attentionRank = rankSceneLoopAttentionBand(context.attention_band);
      const healthRank = rankSceneLoopHealthBand(context.latest_health_band);
      const trendRank = rankSceneLoopTrendDirection(context.trend_direction);
      const totalCount = Math.max(0, Math.floor(toNum(row?.total_count, 0)));
      return {
        ...context,
        trend_delta: Math.floor(toNum(row?.trend_delta, 0)),
        total_count: totalCount,
        live_count: Math.max(0, Math.floor(toNum(row?.live_count, 0))),
        blocked_count: Math.max(0, Math.floor(toNum(row?.blocked_count, 0))),
        priority_score: buildSceneLoopPriorityScore(attentionRank, healthRank, trendRank, totalCount),
        attention_rank: attentionRank,
        health_rank: healthRank,
        trend_rank: trendRank
      };
    })
    .sort((left, right) => {
      const priorityGap = toNum(right.priority_score, 0) - toNum(left.priority_score, 0);
      if (Math.abs(priorityGap) > 0.0001) return priorityGap;
      const totalGap = toNum(right.total_count, 0) - toNum(left.total_count, 0);
      if (Math.abs(totalGap) > 0.0001) return totalGap;
      return `${String(left.district_key || "")}:${String(left.loop_microflow_key || "")}`.localeCompare(
        `${String(right.district_key || "")}:${String(right.loop_microflow_key || "")}`
      );
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 18))));
}

function buildSceneLoopDistrictMicroflowRiskRowsDaily(rows, limit = 24) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const context = buildSceneLoopRiskContext(row);
      const attentionRank = rankSceneLoopAttentionBand(context.attention_band);
      const healthRank = rankSceneLoopHealthBand(context.latest_health_band);
      const trendRank = rankSceneLoopTrendDirection(context.trend_direction);
      const totalCount = Math.max(0, Math.floor(toNum(row?.total_count, 0)));
      return {
        day: String(row?.day || ""),
        ...context,
        trend_delta: Math.floor(toNum(row?.trend_delta, 0)),
        total_count: totalCount,
        live_count: Math.max(0, Math.floor(toNum(row?.live_count, 0))),
        blocked_count: Math.max(0, Math.floor(toNum(row?.blocked_count, 0))),
        priority_score: buildSceneLoopPriorityScore(attentionRank, healthRank, trendRank, totalCount),
        attention_rank: attentionRank,
        health_rank: healthRank,
        trend_rank: trendRank
      };
    })
    .sort((left, right) => {
      const dayOrder = String(right.day || "").localeCompare(String(left.day || ""));
      if (dayOrder !== 0) return dayOrder;
      const priorityGap = toNum(right.priority_score, 0) - toNum(left.priority_score, 0);
      if (Math.abs(priorityGap) > 0.0001) return priorityGap;
      const contractGap = compareSceneLoopContractStrength(left, right);
      if (contractGap !== 0) return contractGap;
      const totalGap = toNum(right.total_count, 0) - toNum(left.total_count, 0);
      if (Math.abs(totalGap) > 0.0001) return totalGap;
      return `${String(left.district_key || "")}:${String(left.loop_microflow_key || "")}`.localeCompare(
        `${String(right.district_key || "")}:${String(right.loop_microflow_key || "")}`
      );
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 24))));
}

function buildSceneLoopDistrictMicroflowRiskMatrix(rows, limit = 18) {
  const grouped = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const context = buildSceneLoopRiskContext(row);
    const riskKey = String(context.risk_key || "no_data:no_data:no_data");
    const day = String(row?.day || "");
    const compositeKey = `${context.district_key}:${context.loop_family_key}:${context.loop_microflow_key}:${riskKey}`;
    if (!grouped.has(compositeKey)) {
      grouped.set(compositeKey, {
        ...context,
        trend_delta: Math.floor(toNum(row?.trend_delta, 0)),
        total_count: Math.max(0, Math.floor(toNum(row?.total_count, 0))),
        live_count: Math.max(0, Math.floor(toNum(row?.live_count, 0))),
        blocked_count: Math.max(0, Math.floor(toNum(row?.blocked_count, 0))),
        priority_score: Math.max(0, Math.floor(toNum(row?.priority_score, 0))),
        item_count: 0,
        day_count: 0,
        latest_day: day || null
      });
    }
    const current = grouped.get(compositeKey);
    current.item_count = Math.max(0, Math.floor(toNum(current.item_count, 0)) + 1);
    current.day_count = Math.max(0, Math.floor(toNum(current.day_count, 0)) + 1);
    if (shouldPromoteSceneLoopRepresentative(current, day, row?.priority_score, context)) {
      current.latest_day = day || null;
      Object.assign(current, context);
      current.latest_health_band = String(row?.latest_health_band || row?.health_band || "no_data");
      current.attention_band = String(row?.attention_band || "no_data");
      current.trend_direction = String(row?.trend_direction || "no_data");
      current.trend_delta = Math.floor(toNum(row?.trend_delta, 0));
      current.total_count = Math.max(0, Math.floor(toNum(row?.total_count, 0)));
      current.live_count = Math.max(0, Math.floor(toNum(row?.live_count, 0)));
      current.blocked_count = Math.max(0, Math.floor(toNum(row?.blocked_count, 0)));
    }
    current.priority_score = Math.max(current.priority_score, Math.max(0, Math.floor(toNum(row?.priority_score, 0))));
  });
  return [...grouped.values()]
    .sort((left, right) => {
      const priorityGap = toNum(right.priority_score, 0) - toNum(left.priority_score, 0);
      if (Math.abs(priorityGap) > 0.0001) return priorityGap;
      const dayGap = toNum(right.day_count, 0) - toNum(left.day_count, 0);
      if (Math.abs(dayGap) > 0.0001) return dayGap;
      const itemGap = toNum(right.item_count, 0) - toNum(left.item_count, 0);
      if (Math.abs(itemGap) > 0.0001) return itemGap;
      return `${String(left.district_key || "")}:${String(left.loop_microflow_key || "")}:${String(left.risk_key || "")}`.localeCompare(
        `${String(right.district_key || "")}:${String(right.loop_microflow_key || "")}:${String(right.risk_key || "")}`
      );
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 18))));
}

function buildSceneLoopDistrictMicroflowRiskMatrixDaily(rows, limit = 24) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      day: String(row?.day || ""),
      ...buildSceneLoopRiskContext(row),
      trend_delta: Math.floor(toNum(row?.trend_delta, 0)),
      total_count: Math.max(0, Math.floor(toNum(row?.total_count, 0))),
      live_count: Math.max(0, Math.floor(toNum(row?.live_count, 0))),
      blocked_count: Math.max(0, Math.floor(toNum(row?.blocked_count, 0))),
      priority_score: Math.max(0, Math.floor(toNum(row?.priority_score, 0))),
      item_count: 1,
      day_count: 1
    }))
    .sort((left, right) => {
      const dayOrder = String(right.day || "").localeCompare(String(left.day || ""));
      if (dayOrder !== 0) return dayOrder;
      const priorityGap = toNum(right.priority_score, 0) - toNum(left.priority_score, 0);
      if (Math.abs(priorityGap) > 0.0001) return priorityGap;
      const contractGap = compareSceneLoopContractStrength(left, right);
      if (contractGap !== 0) return contractGap;
      const totalGap = toNum(right.total_count, 0) - toNum(left.total_count, 0);
      if (Math.abs(totalGap) > 0.0001) return totalGap;
      return `${String(left.district_key || "")}:${String(left.loop_microflow_key || "")}:${String(left.risk_key || "")}`.localeCompare(
        `${String(right.district_key || "")}:${String(right.loop_microflow_key || "")}:${String(right.risk_key || "")}`
      );
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 24))));
}

function buildSceneLoopDistrictMicroflowRiskPriority(rows, limit = 18) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      ...buildSceneLoopRiskContext(row),
      trend_delta: Math.floor(toNum(row?.trend_delta, 0)),
      total_count: Math.max(0, Math.floor(toNum(row?.total_count, 0))),
      live_count: Math.max(0, Math.floor(toNum(row?.live_count, 0))),
      blocked_count: Math.max(0, Math.floor(toNum(row?.blocked_count, 0))),
      priority_score: Math.max(0, Math.floor(toNum(row?.priority_score, 0))),
      item_count: Math.max(0, Math.floor(toNum(row?.item_count, 0))),
      day_count: Math.max(0, Math.floor(toNum(row?.day_count, 0))),
      latest_day: row?.latest_day ? String(row.latest_day) : null
    }))
    .sort((left, right) => {
      const priorityGap = toNum(right.priority_score, 0) - toNum(left.priority_score, 0);
      if (Math.abs(priorityGap) > 0.0001) return priorityGap;
      const dayGap = toNum(right.day_count, 0) - toNum(left.day_count, 0);
      if (Math.abs(dayGap) > 0.0001) return dayGap;
      const itemGap = toNum(right.item_count, 0) - toNum(left.item_count, 0);
      if (Math.abs(itemGap) > 0.0001) return itemGap;
      return `${String(left.district_key || "")}:${String(left.loop_microflow_key || "")}:${String(left.risk_key || "")}`.localeCompare(
        `${String(right.district_key || "")}:${String(right.loop_microflow_key || "")}:${String(right.risk_key || "")}`
      );
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 18))));
}

function buildSceneLoopDistrictMicroflowRiskPriorityDaily(rows, limit = 24) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      day: String(row?.day || ""),
      ...buildSceneLoopRiskContext(row),
      trend_delta: Math.floor(toNum(row?.trend_delta, 0)),
      total_count: Math.max(0, Math.floor(toNum(row?.total_count, 0))),
      live_count: Math.max(0, Math.floor(toNum(row?.live_count, 0))),
      blocked_count: Math.max(0, Math.floor(toNum(row?.blocked_count, 0))),
      priority_score: Math.max(0, Math.floor(toNum(row?.priority_score, 0))),
      item_count: Math.max(0, Math.floor(toNum(row?.item_count, 1))),
      day_count: Math.max(0, Math.floor(toNum(row?.day_count, 1)))
    }))
    .sort((left, right) => {
      const dayOrder = String(right.day || "").localeCompare(String(left.day || ""));
      if (dayOrder !== 0) return dayOrder;
      const priorityGap = toNum(right.priority_score, 0) - toNum(left.priority_score, 0);
      if (Math.abs(priorityGap) > 0.0001) return priorityGap;
      const contractGap = compareSceneLoopContractStrength(left, right);
      if (contractGap !== 0) return contractGap;
      const totalGap = toNum(right.total_count, 0) - toNum(left.total_count, 0);
      if (Math.abs(totalGap) > 0.0001) return totalGap;
      return `${String(left.district_key || "")}:${String(left.loop_microflow_key || "")}:${String(left.risk_key || "")}`.localeCompare(
        `${String(right.district_key || "")}:${String(right.loop_microflow_key || "")}:${String(right.risk_key || "")}`
      );
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 24))));
}

function buildSceneLoopDistrictMicroflowRiskFocus(rows, limit = 12) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      ...buildSceneLoopRiskContext(row),
      trend_delta: Math.floor(toNum(row?.trend_delta, 0)),
      total_count: Math.max(0, Math.floor(toNum(row?.total_count, 0))),
      live_count: Math.max(0, Math.floor(toNum(row?.live_count, 0))),
      blocked_count: Math.max(0, Math.floor(toNum(row?.blocked_count, 0))),
      priority_score: Math.max(0, Math.floor(toNum(row?.priority_score, 0))),
      item_count: Math.max(0, Math.floor(toNum(row?.item_count, 0))),
      day_count: Math.max(0, Math.floor(toNum(row?.day_count, 0))),
      latest_day: row?.latest_day ? String(row.latest_day) : null
    }))
    .sort((left, right) => {
      const priorityGap = toNum(right.priority_score, 0) - toNum(left.priority_score, 0);
      if (Math.abs(priorityGap) > 0.0001) return priorityGap;
      const dayGap = toNum(right.day_count, 0) - toNum(left.day_count, 0);
      if (Math.abs(dayGap) > 0.0001) return dayGap;
      const itemGap = toNum(right.item_count, 0) - toNum(left.item_count, 0);
      if (Math.abs(itemGap) > 0.0001) return itemGap;
      return String(left.focus_key || "").localeCompare(String(right.focus_key || ""));
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 12))));
}

function buildSceneLoopDistrictMicroflowRiskFocusDaily(rows, limit = 18) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      day: String(row?.day || ""),
      ...buildSceneLoopRiskContext(row),
      trend_delta: Math.floor(toNum(row?.trend_delta, 0)),
      total_count: Math.max(0, Math.floor(toNum(row?.total_count, 0))),
      live_count: Math.max(0, Math.floor(toNum(row?.live_count, 0))),
      blocked_count: Math.max(0, Math.floor(toNum(row?.blocked_count, 0))),
      priority_score: Math.max(0, Math.floor(toNum(row?.priority_score, 0))),
      item_count: Math.max(0, Math.floor(toNum(row?.item_count, 1))),
      day_count: Math.max(0, Math.floor(toNum(row?.day_count, 1)))
    }))
    .sort((left, right) => {
      const dayOrder = String(right.day || "").localeCompare(String(left.day || ""));
      if (dayOrder !== 0) return dayOrder;
      const priorityGap = toNum(right.priority_score, 0) - toNum(left.priority_score, 0);
      if (Math.abs(priorityGap) > 0.0001) return priorityGap;
      const contractGap = compareSceneLoopContractStrength(left, right);
      if (contractGap !== 0) return contractGap;
      const totalGap = toNum(right.total_count, 0) - toNum(left.total_count, 0);
      if (Math.abs(totalGap) > 0.0001) return totalGap;
      return String(left.focus_key || "").localeCompare(String(right.focus_key || ""));
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 18))));
}

function buildSceneLoopDistrictMicroflowRiskBreakdown(rows, limit = 18) {
  const counters = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = String(row?.risk_key || "no_data:no_data:no_data");
    const day = String(row?.day || "");
    const priorityScore = Math.max(0, Math.floor(toNum(row?.priority_score, 0)));
    const context = buildSceneLoopRiskContext(row);
    if (!counters.has(key)) {
      counters.set(key, {
        bucket_key: key,
        item_count: 0,
        priority_score: 0,
        latest_day: day || null,
        ...context
      });
    }
    const current = counters.get(key);
    current.item_count = Math.max(0, Math.floor(toNum(current.item_count, 0)) + 1);
    const shouldReplace = shouldPromoteSceneLoopRepresentative(current, day, priorityScore, context);
    if (shouldReplace) {
      Object.assign(current, context);
      current.latest_day = day || null;
    }
    current.priority_score = Math.max(toNum(current.priority_score, 0), priorityScore);
  });
  return [...counters.values()]
    .sort((left, right) => {
      const itemGap = toNum(right.item_count, 0) - toNum(left.item_count, 0);
      if (Math.abs(itemGap) > 0.0001) return itemGap;
      const contractGap = compareSceneLoopContractStrength(left, right);
      if (contractGap !== 0) return contractGap;
      return String(left.bucket_key || "").localeCompare(String(right.bucket_key || ""));
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 18))));
}

function buildSceneLoopDistrictMicroflowRiskBreakdownDaily(rows, limit = 24) {
  const counters = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const day = String(row?.day || "");
    const bucketKey = String(row?.risk_key || "no_data:no_data:no_data");
    const compositeKey = `${day}:${bucketKey}`;
    const priorityScore = Math.max(0, Math.floor(toNum(row?.priority_score, 0)));
    const context = buildSceneLoopRiskContext(row);
    if (!counters.has(compositeKey)) {
      counters.set(compositeKey, {
        day,
        bucket_key: bucketKey,
        item_count: 0,
        priority_score: 0,
        ...context
      });
    }
    const current = counters.get(compositeKey);
    current.item_count = Math.max(0, Math.floor(toNum(current.item_count, 0)) + 1);
    if (shouldPromoteSceneLoopRepresentative(current, day, priorityScore, context)) {
      Object.assign(current, context);
    }
    current.priority_score = Math.max(toNum(current.priority_score, 0), priorityScore);
  });
  return [...counters.values()]
    .sort((left, right) => {
      const dayOrder = String(right.day || "").localeCompare(String(left.day || ""));
      if (dayOrder !== 0) return dayOrder;
      const itemGap = toNum(right.item_count, 0) - toNum(left.item_count, 0);
      if (Math.abs(itemGap) > 0.0001) return itemGap;
      const contractGap = compareSceneLoopContractStrength(left, right);
      if (contractGap !== 0) return contractGap;
      return String(left.bucket_key || "").localeCompare(String(right.bucket_key || ""));
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 24))));
}

function buildSceneLoopDimensionBreakdown(rows, field, limit = 18) {
  const counters = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = String(row?.[field] || "unknown");
    const day = String(row?.day || "");
    const priorityScore = Math.max(0, Math.floor(toNum(row?.priority_score, 0)));
    const context = buildSceneLoopRiskContext(row);
    if (!counters.has(key)) {
      counters.set(key, {
        bucket_key: key,
        item_count: 0,
        priority_score: 0,
        latest_day: day || null,
        ...context
      });
    }
    const current = counters.get(key);
    current.item_count = Math.max(0, Math.floor(toNum(current.item_count, 0)) + 1);
    const shouldReplace = shouldPromoteSceneLoopRepresentative(current, day, priorityScore, context);
    if (shouldReplace) {
      Object.assign(current, context);
      current.latest_day = day || null;
    }
    current.priority_score = Math.max(toNum(current.priority_score, 0), priorityScore);
  });
  return [...counters.values()]
    .sort((left, right) => {
      const itemGap = toNum(right.item_count, 0) - toNum(left.item_count, 0);
      if (Math.abs(itemGap) > 0.0001) return itemGap;
      const contractGap = compareSceneLoopContractStrength(left, right);
      if (contractGap !== 0) return contractGap;
      return String(left.bucket_key || "").localeCompare(String(right.bucket_key || ""));
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 18))));
}

function buildSceneLoopDimensionBreakdownDaily(rows, field, limit = 24) {
  const counters = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const day = String(row?.day || "");
    const bucketKey = String(row?.[field] || "unknown");
    const compositeKey = `${day}:${bucketKey}`;
    const priorityScore = Math.max(0, Math.floor(toNum(row?.priority_score, 0)));
    const context = buildSceneLoopRiskContext(row);
    if (!counters.has(compositeKey)) {
      counters.set(compositeKey, {
        day,
        bucket_key: bucketKey,
        item_count: 0,
        priority_score: 0,
        ...context
      });
    }
    const current = counters.get(compositeKey);
    current.item_count = Math.max(0, Math.floor(toNum(current.item_count, 0)) + 1);
    if (shouldPromoteSceneLoopRepresentative(current, day, priorityScore, context)) {
      Object.assign(current, context);
    }
    current.priority_score = Math.max(toNum(current.priority_score, 0), priorityScore);
  });
  return [...counters.values()]
    .sort((left, right) => {
      const dayOrder = String(right.day || "").localeCompare(String(left.day || ""));
      if (dayOrder !== 0) return dayOrder;
      const itemGap = toNum(right.item_count, 0) - toNum(left.item_count, 0);
      if (Math.abs(itemGap) > 0.0001) return itemGap;
      const contractGap = compareSceneLoopContractStrength(left, right);
      if (contractGap !== 0) return contractGap;
      return String(left.bucket_key || "").localeCompare(String(right.bucket_key || ""));
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 24))));
}

function buildSceneLoopDimensionRiskMatrix(rows, field, limit = 18) {
  const grouped = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const context = buildSceneLoopRiskContext(row);
    const bucketKey = String(row?.[field] || "unknown");
    const riskKey = String(context.risk_key || "no_data:no_data:no_data");
    const day = String(row?.day || "");
    const compositeKey = `${bucketKey}:${riskKey}`;
    if (!grouped.has(compositeKey)) {
      grouped.set(compositeKey, {
        ...context,
        bucket_key: bucketKey,
        risk_key: riskKey,
        latest_health_band: String(context.latest_health_band || row?.health_band || "no_data"),
        attention_band: String(context.attention_band || "no_data"),
        trend_direction: String(context.trend_direction || "no_data"),
        trend_delta: Math.floor(toNum(row?.trend_delta, 0)),
        total_count: Math.max(0, Math.floor(toNum(row?.total_count, 0))),
        live_count: Math.max(0, Math.floor(toNum(row?.live_count, 0))),
        blocked_count: Math.max(0, Math.floor(toNum(row?.blocked_count, 0))),
        priority_score: Math.max(0, Math.floor(toNum(row?.priority_score, 0))),
        item_count: 0,
        day_count: 0,
        latest_day: day || null
      });
    }
    const current = grouped.get(compositeKey);
    current.item_count = Math.max(0, Math.floor(toNum(current.item_count, 0)) + 1);
    if (day) {
      current.day_count = Math.max(0, Math.floor(toNum(current.day_count, 0)) + 1);
    }
    if (shouldPromoteSceneLoopRepresentative(current, day, row?.priority_score, context)) {
      Object.assign(current, context);
      current.latest_day = day || null;
      current.latest_health_band = String(context.latest_health_band || row?.health_band || "no_data");
      current.attention_band = String(context.attention_band || "no_data");
      current.trend_direction = String(context.trend_direction || "no_data");
      current.trend_delta = Math.floor(toNum(row?.trend_delta, 0));
      current.total_count = Math.max(0, Math.floor(toNum(row?.total_count, 0)));
      current.live_count = Math.max(0, Math.floor(toNum(row?.live_count, 0)));
      current.blocked_count = Math.max(0, Math.floor(toNum(row?.blocked_count, 0)));
    }
    current.priority_score = Math.max(current.priority_score, Math.max(0, Math.floor(toNum(row?.priority_score, 0))));
  });
  return [...grouped.values()]
    .sort((left, right) => {
      const priorityGap = toNum(right.priority_score, 0) - toNum(left.priority_score, 0);
      if (Math.abs(priorityGap) > 0.0001) return priorityGap;
      const dayGap = toNum(right.day_count, 0) - toNum(left.day_count, 0);
      if (Math.abs(dayGap) > 0.0001) return dayGap;
      const itemGap = toNum(right.item_count, 0) - toNum(left.item_count, 0);
      if (Math.abs(itemGap) > 0.0001) return itemGap;
      return `${String(left.bucket_key || "")}:${String(left.risk_key || "")}`.localeCompare(
        `${String(right.bucket_key || "")}:${String(right.risk_key || "")}`
      );
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 18))));
}

function buildSceneLoopDimensionRiskMatrixDaily(rows, field, limit = 24) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const context = buildSceneLoopRiskContext(row);
      return {
        day: String(row?.day || ""),
        ...context,
        bucket_key: String(row?.[field] || "unknown"),
        risk_key: String(context.risk_key || "no_data:no_data:no_data"),
        latest_health_band: String(context.latest_health_band || row?.health_band || "no_data"),
        attention_band: String(context.attention_band || "no_data"),
        trend_direction: String(context.trend_direction || "no_data"),
        trend_delta: Math.floor(toNum(row?.trend_delta, 0)),
        total_count: Math.max(0, Math.floor(toNum(row?.total_count, 0))),
        live_count: Math.max(0, Math.floor(toNum(row?.live_count, 0))),
        blocked_count: Math.max(0, Math.floor(toNum(row?.blocked_count, 0))),
        priority_score: Math.max(0, Math.floor(toNum(row?.priority_score, 0))),
        item_count: 1,
        day_count: 1
      };
    })
    .sort((left, right) => {
      const dayOrder = String(right.day || "").localeCompare(String(left.day || ""));
      if (dayOrder !== 0) return dayOrder;
      const priorityGap = toNum(right.priority_score, 0) - toNum(left.priority_score, 0);
      if (Math.abs(priorityGap) > 0.0001) return priorityGap;
      const contractGap = compareSceneLoopContractStrength(left, right);
      if (contractGap !== 0) return contractGap;
      const totalGap = toNum(right.total_count, 0) - toNum(left.total_count, 0);
      if (Math.abs(totalGap) > 0.0001) return totalGap;
      return `${String(left.bucket_key || "")}:${String(left.risk_key || "")}`.localeCompare(
        `${String(right.bucket_key || "")}:${String(right.risk_key || "")}`
      );
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 24))));
}

function buildSceneLoopDimensionPriority(rows, field, limit = 18) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      ...buildSceneLoopRiskContext(row),
      bucket_key: String(row?.[field] || "unknown"),
      [field]: String(row?.[field] || "unknown"),
      trend_delta: Math.floor(toNum(row?.trend_delta, 0)),
      total_count: Math.max(0, Math.floor(toNum(row?.total_count, 0))),
      live_count: Math.max(0, Math.floor(toNum(row?.live_count, 0))),
      blocked_count: Math.max(0, Math.floor(toNum(row?.blocked_count, 0))),
      priority_score: Math.max(0, Math.floor(toNum(row?.priority_score, 0))),
      item_count: Math.max(0, Math.floor(toNum(row?.item_count, 0))),
      day_count: Math.max(0, Math.floor(toNum(row?.day_count, 0))),
      latest_day: row?.latest_day ? String(row.latest_day) : null
    }))
    .sort((left, right) => {
      const priorityGap = toNum(right.priority_score, 0) - toNum(left.priority_score, 0);
      if (Math.abs(priorityGap) > 0.0001) return priorityGap;
      const dayGap = toNum(right.day_count, 0) - toNum(left.day_count, 0);
      if (Math.abs(dayGap) > 0.0001) return dayGap;
      const itemGap = toNum(right.item_count, 0) - toNum(left.item_count, 0);
      if (Math.abs(itemGap) > 0.0001) return itemGap;
      return `${String(left.district_key || "")}:${String(left[field] || left.bucket_key || "")}:${String(left.risk_key || "")}`.localeCompare(
        `${String(right.district_key || "")}:${String(right[field] || right.bucket_key || "")}:${String(right.risk_key || "")}`
      );
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 18))));
}

function buildSceneLoopDimensionPriorityDaily(rows, field, limit = 24) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      day: String(row?.day || ""),
      ...buildSceneLoopRiskContext(row),
      bucket_key: String(row?.[field] || "unknown"),
      [field]: String(row?.[field] || "unknown"),
      trend_delta: Math.floor(toNum(row?.trend_delta, 0)),
      total_count: Math.max(0, Math.floor(toNum(row?.total_count, 0))),
      live_count: Math.max(0, Math.floor(toNum(row?.live_count, 0))),
      blocked_count: Math.max(0, Math.floor(toNum(row?.blocked_count, 0))),
      priority_score: Math.max(0, Math.floor(toNum(row?.priority_score, 0))),
      item_count: Math.max(0, Math.floor(toNum(row?.item_count, 1))),
      day_count: Math.max(0, Math.floor(toNum(row?.day_count, 1)))
    }))
    .sort((left, right) => {
      const dayOrder = String(right.day || "").localeCompare(String(left.day || ""));
      if (dayOrder !== 0) return dayOrder;
      const priorityGap = toNum(right.priority_score, 0) - toNum(left.priority_score, 0);
      if (Math.abs(priorityGap) > 0.0001) return priorityGap;
      const contractGap = compareSceneLoopContractStrength(left, right);
      if (contractGap !== 0) return contractGap;
      const totalGap = toNum(right.total_count, 0) - toNum(left.total_count, 0);
      if (Math.abs(totalGap) > 0.0001) return totalGap;
      return `${String(left.district_key || "")}:${String(left[field] || left.bucket_key || "")}:${String(left.risk_key || "")}`.localeCompare(
        `${String(right.district_key || "")}:${String(right[field] || right.bucket_key || "")}:${String(right.risk_key || "")}`
      );
    })
    .slice(0, Math.max(1, Math.floor(toNum(limit, 24))));
}

function resolveSceneLoopDistrictAttentionBand(latestHealthBand, trendDirection, blockedShare) {
  const latestBand = String(latestHealthBand || "no_data");
  const trend = String(trendDirection || "no_data");
  const blocked = clamp(toNum(blockedShare, 0), 0, 1);
  if (latestBand === "red" || (trend === "degrading" && blocked >= 0.25)) {
    return "alert";
  }
  if (latestBand === "yellow" || trend === "degrading" || blocked >= 0.18) {
    return "watch";
  }
  if (latestBand === "green" || trend === "improving" || trend === "stable") {
    return "clear";
  }
  return "no_data";
}

function buildSceneLoopDistrictAttentionBreakdown(rows) {
  const counters = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = String(row?.attention_band || "no_data");
    counters.set(key, (counters.get(key) || 0) + 1);
  });
  return Array.from(counters.entries())
    .map(([bucket_key, item_count]) => ({
      bucket_key,
      item_count: Math.max(0, Math.floor(toNum(item_count, 0)))
    }))
    .sort((left, right) => right.item_count - left.item_count || String(left.bucket_key).localeCompare(String(right.bucket_key)));
}

function buildSceneLoopDistrictLatestBandBreakdown(rows) {
  const counters = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = String(row?.latest_health_band || row?.health_band || "no_data");
    counters.set(key, (counters.get(key) || 0) + 1);
  });
  return Array.from(counters.entries())
    .map(([bucket_key, item_count]) => ({
      bucket_key,
      item_count: Math.max(0, Math.floor(toNum(item_count, 0)))
    }))
    .sort((left, right) => right.item_count - left.item_count || String(left.bucket_key).localeCompare(String(right.bucket_key)));
}

function buildSceneLoopDistrictTrendBreakdown(rows) {
  const counters = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = String(row?.trend_direction || "no_data");
    counters.set(key, (counters.get(key) || 0) + 1);
  });
  return Array.from(counters.entries())
    .map(([bucket_key, item_count]) => ({
      bucket_key,
      item_count: Math.max(0, Math.floor(toNum(item_count, 0)))
    }))
    .sort((left, right) => right.item_count - left.item_count || String(left.bucket_key).localeCompare(String(right.bucket_key)));
}

function buildSceneLoopDistrictHealthTrendBreakdown(rows) {
  const counters = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const latestBand = String(row?.latest_health_band || row?.health_band || "no_data");
    const trend = String(row?.trend_direction || "no_data");
    const key = `${latestBand}:${trend}`;
    counters.set(key, (counters.get(key) || 0) + 1);
  });
  return Array.from(counters.entries())
    .map(([bucket_key, item_count]) => ({
      bucket_key,
      item_count: Math.max(0, Math.floor(toNum(item_count, 0)))
    }))
    .sort((left, right) => right.item_count - left.item_count || String(left.bucket_key).localeCompare(String(right.bucket_key)));
}

function resolveSceneTrendDirection(latestReadyRate, earliestReadyRate, sampleCount) {
  if (Math.max(0, Math.floor(toNum(sampleCount, 0))) < 2) {
    return "no_data";
  }
  const delta = clamp(toNum(latestReadyRate, 0) - toNum(earliestReadyRate, 0), -1, 1);
  if (delta >= 0.03) return "improving";
  if (delta <= -0.03) return "degrading";
  return "stable";
}

function buildSceneBandBreakdown(rows) {
  const counters = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const key = String(row?.health_band || "no_data");
    counters.set(key, (counters.get(key) || 0) + 1);
  });
  return Array.from(counters.entries())
    .map(([bucket_key, item_count]) => ({
      bucket_key,
      item_count: Math.max(0, Math.floor(toNum(item_count, 0)))
    }))
    .sort((left, right) => right.item_count - left.item_count || String(left.bucket_key).localeCompare(String(right.bucket_key)));
}

function resolveSceneAlarmState(rows) {
  const source = Array.isArray(rows) ? rows : [];
  if (!source.length) {
    return "no_data";
  }
  const latest = source[0] || {};
  const redDays = source.filter((row) => row?.health_band === "red").length;
  const yellowDays = source.filter((row) => row?.health_band === "yellow").length;
  if (latest.health_band === "red" || redDays >= 2 || toNum(latest.failure_rate, 0) >= 0.12) {
    return "alert";
  }
  if (latest.health_band === "yellow" || yellowDays >= 3 || toNum(latest.low_end_share, 0) >= 0.45) {
    return "watch";
  }
  return "clear";
}

function buildSceneAlarmReasons(rows) {
  const source = Array.isArray(rows) ? rows : [];
  if (!source.length) {
    return [];
  }
  const latest = source[0] || {};
  const reasons = [];
  if (toNum(latest.failure_rate, 0) >= 0.12) {
    reasons.push("latest_failure_spike");
  }
  if (toNum(latest.ready_rate, 0) <= 0.9) {
    reasons.push("latest_ready_drop");
  }
  if (toNum(latest.low_end_share, 0) >= 0.45) {
    reasons.push("latest_low_end_pressure");
  }
  if (source.filter((row) => row?.health_band === "red").length >= 2) {
    reasons.push("repeated_red_days");
  }
  if (!reasons.length && latest.health_band === "yellow") {
    reasons.push("latest_watch_band");
  }
  return reasons.slice(0, 4);
}

function resolveSceneRuntimeHealthBand(readyRate, totalCount, failedCount) {
  const safeReadyRate = clamp(toNum(readyRate, 0), 0, 1);
  const total = Math.max(0, Math.floor(toNum(totalCount, 0)));
  const failed = Math.max(0, Math.floor(toNum(failedCount, 0)));
  if (total <= 0) {
    return "no_data";
  }
  if (safeReadyRate >= 0.96 && failed <= 3) {
    return "green";
  }
  if (safeReadyRate >= 0.9) {
    return "yellow";
  }
  return "red";
}

function enrichWebappRevenueMetrics(rawMetrics = {}) {
  const metrics = rawMetrics && typeof rawMetrics === "object" ? rawMetrics : {};
  const uiIngested = Math.max(0, Math.floor(toNum(metrics.ui_events_ingested_24h, 0)));
  const uiValid = Math.max(0, Math.floor(toNum(metrics.ui_events_valid_24h, 0)));
  const qualityScore = uiIngested > 0 ? Number((uiValid / uiIngested).toFixed(4)) : 1;
  const intent = Math.max(0, Math.floor(toNum(metrics.funnel_intent_24h, 0)));
  const submit = Math.max(0, Math.floor(toNum(metrics.funnel_tx_submit_24h, 0)));
  const approved = Math.max(0, Math.floor(toNum(metrics.funnel_approved_24h, 0)));
  const intentToSubmitRate = toRate(submit, intent);
  const submitToApprovedRate = toRate(approved, submit);

  metrics.ui_events_ingested_24h = uiIngested;
  metrics.ui_events_valid_24h = uiValid;
  metrics.ui_events_with_funnel_24h = Math.max(0, Math.floor(toNum(metrics.ui_events_with_funnel_24h, 0)));
  metrics.ui_events_value_usd_24h = Number(toNum(metrics.ui_events_value_usd_24h, 0).toFixed(8));
  metrics.ui_event_quality_score_24h = qualityScore;
  metrics.ui_event_quality_band_24h = resolveQualityBand(qualityScore);

  metrics.funnel_intent_24h = intent;
  metrics.funnel_tx_submit_24h = submit;
  metrics.funnel_approved_24h = approved;
  metrics.funnel_pass_purchase_24h = Math.max(0, Math.floor(toNum(metrics.funnel_pass_purchase_24h, 0)));
  metrics.funnel_cosmetic_purchase_24h = Math.max(0, Math.floor(toNum(metrics.funnel_cosmetic_purchase_24h, 0)));
  metrics.funnel_value_usd_24h = Number(toNum(metrics.funnel_value_usd_24h, 0).toFixed(8));
  metrics.funnel_intent_to_submit_rate_24h = intentToSubmitRate;
  metrics.funnel_submit_to_approved_rate_24h = submitToApprovedRate;
  metrics.funnel_conversion_band_24h = resolveConversionBand(intentToSubmitRate, submitToApprovedRate, intent);

  const sceneReady = Math.max(0, Math.floor(toNum(metrics.scene_runtime_ready_24h, 0)));
  const sceneFailed = Math.max(0, Math.floor(toNum(metrics.scene_runtime_failed_24h, 0)));
  const sceneLowEnd = Math.max(0, Math.floor(toNum(metrics.scene_runtime_low_end_24h, 0)));
  const sceneTotal = sceneReady + sceneFailed;
  const sceneReadyRate = toRate(sceneReady, sceneTotal);
  const sceneFailureRate = toRate(sceneFailed, sceneTotal);
  const sceneLowEndShare = toRate(sceneLowEnd, sceneTotal);
  metrics.scene_runtime_ready_24h = sceneReady;
  metrics.scene_runtime_failed_24h = sceneFailed;
  metrics.scene_runtime_low_end_24h = sceneLowEnd;
  metrics.scene_runtime_total_24h = sceneTotal;
  metrics.scene_runtime_ready_rate_24h = sceneReadyRate;
  metrics.scene_runtime_failure_rate_24h = sceneFailureRate;
  metrics.scene_runtime_low_end_share_24h = sceneLowEndShare;
  metrics.scene_runtime_avg_loaded_bundles_24h = Number(toNum(metrics.scene_runtime_avg_loaded_bundles_24h, 0).toFixed(2));
  metrics.scene_runtime_health_band_24h = resolveSceneRuntimeHealthBand(sceneReadyRate, sceneTotal, sceneFailed);
  metrics.scene_runtime_quality_breakdown_24h = normalizeBreakdownRows(metrics.scene_runtime_quality_breakdown_24h);
  metrics.scene_runtime_perf_breakdown_24h = normalizeBreakdownRows(metrics.scene_runtime_perf_breakdown_24h);
  metrics.scene_runtime_device_breakdown_24h = normalizeBreakdownRows(metrics.scene_runtime_device_breakdown_24h);
  metrics.scene_runtime_profile_breakdown_24h = normalizeBreakdownRows(metrics.scene_runtime_profile_breakdown_24h);
  metrics.scene_loop_events_24h = Math.max(0, Math.floor(toNum(metrics.scene_loop_events_24h, 0)));
  metrics.scene_loop_live_24h = Math.max(0, Math.floor(toNum(metrics.scene_loop_live_24h, 0)));
  metrics.scene_loop_blocked_24h = Math.max(0, Math.floor(toNum(metrics.scene_loop_blocked_24h, 0)));
  metrics.scene_loop_district_coverage_24h = Math.max(0, Math.floor(toNum(metrics.scene_loop_district_coverage_24h, 0)));
  metrics.scene_loop_daily_breakdown_7d = normalizeSceneLoopDailyRows(metrics.scene_loop_daily_breakdown_7d);
  metrics.scene_loop_district_daily_breakdown_7d = normalizeSceneLoopDistrictDailyRows(
    metrics.scene_loop_district_daily_breakdown_7d
  );
  metrics.scene_loop_district_family_daily_breakdown_7d = normalizeSceneLoopDistrictFamilyDailyRows(
    metrics.scene_loop_district_family_daily_breakdown_7d
  );
  metrics.scene_loop_district_microflow_daily_breakdown_7d = normalizeSceneLoopDistrictMicroflowDailyRows(
    metrics.scene_loop_district_microflow_daily_breakdown_7d
  );
  metrics.scene_loop_events_7d = metrics.scene_loop_daily_breakdown_7d.reduce(
    (sum, row) => sum + Math.max(0, Math.floor(toNum(row.total_count, 0))),
    0
  );
  metrics.scene_loop_live_share_24h = toRate(metrics.scene_loop_live_24h, metrics.scene_loop_events_24h);
  metrics.scene_loop_blocked_share_24h = toRate(metrics.scene_loop_blocked_24h, metrics.scene_loop_events_24h);
  metrics.scene_loop_health_band_24h = resolveSceneLoopHealthBand(
    metrics.scene_loop_events_24h,
    metrics.scene_loop_district_coverage_24h,
    metrics.scene_loop_live_share_24h,
    metrics.scene_loop_blocked_share_24h
  );
  const sceneLoopRows = metrics.scene_loop_daily_breakdown_7d;
  const latestSceneLoopDay = sceneLoopRows[0] || null;
  const earliestSceneLoopDay = sceneLoopRows[sceneLoopRows.length - 1] || null;
  metrics.scene_loop_trend_direction_7d = resolveSceneLoopTrendDirection(
    latestSceneLoopDay?.total_count,
    earliestSceneLoopDay?.total_count,
    sceneLoopRows.length
  );
  metrics.scene_loop_trend_delta_7d = Math.max(
    -9999,
    Math.min(9999, Math.floor(toNum(latestSceneLoopDay?.total_count, 0) - toNum(earliestSceneLoopDay?.total_count, 0)))
  );
  metrics.scene_loop_alarm_state_7d = resolveSceneLoopAlarmState(sceneLoopRows);
  metrics.scene_loop_alarm_reasons_7d = buildSceneLoopAlarmReasons(sceneLoopRows);
  metrics.scene_loop_band_breakdown_7d = buildSceneLoopBandBreakdown(sceneLoopRows);
  metrics.scene_loop_peak_day_7d =
    sceneLoopRows.length > 0
      ? [...sceneLoopRows].sort((left, right) => {
          const totalGap = toNum(right.total_count, 0) - toNum(left.total_count, 0);
          if (Math.abs(totalGap) > 0.0001) return totalGap;
          return String(right.day || "").localeCompare(String(left.day || ""));
        })[0]
      : null;
  metrics.scene_loop_district_matrix_7d = buildSceneLoopDistrictMatrix(metrics.scene_loop_district_daily_breakdown_7d);
  metrics.scene_loop_district_latest_band_breakdown_7d = buildSceneLoopDistrictLatestBandBreakdown(
    metrics.scene_loop_district_matrix_7d
  );
  metrics.scene_loop_district_trend_breakdown_7d = buildSceneLoopDistrictTrendBreakdown(
    metrics.scene_loop_district_matrix_7d
  );
  metrics.scene_loop_district_health_trend_breakdown_7d = buildSceneLoopDistrictHealthTrendBreakdown(
    metrics.scene_loop_district_matrix_7d
  );
  metrics.scene_loop_district_attention_breakdown_7d = buildSceneLoopDistrictAttentionBreakdown(
    metrics.scene_loop_district_matrix_7d
  );
  metrics.scene_loop_district_breakdown_24h = normalizeBreakdownRows(metrics.scene_loop_district_breakdown_24h);
  metrics.scene_loop_family_breakdown_24h = normalizeBreakdownRows(
    (Array.isArray(metrics.scene_loop_family_breakdown_24h) ? metrics.scene_loop_family_breakdown_24h : []).map((row) => ({
      ...row,
      bucket_key: normalizeSceneLoopFamilyKey(row?.bucket_key)
    }))
  );
  metrics.scene_loop_microflow_breakdown_24h = normalizeBreakdownRows(
    (Array.isArray(metrics.scene_loop_microflow_breakdown_24h) ? metrics.scene_loop_microflow_breakdown_24h : []).map((row) => ({
      ...row,
      bucket_key: normalizeSceneLoopMicroflowKey(row?.bucket_key)
    })),
    10
  );
  metrics.scene_loop_status_breakdown_24h = normalizeBreakdownRows(metrics.scene_loop_status_breakdown_24h);
  metrics.scene_loop_sequence_breakdown_24h = normalizeBreakdownRows(metrics.scene_loop_sequence_breakdown_24h);
  metrics.scene_loop_entry_breakdown_24h = normalizeBreakdownRows(metrics.scene_loop_entry_breakdown_24h);
  metrics.scene_loop_district_family_matrix_7d = buildSceneLoopDistrictFamilyMatrix(
    metrics.scene_loop_district_family_daily_breakdown_7d
  );
  metrics.scene_loop_district_family_latest_band_breakdown_7d = buildSceneLoopDistrictFamilyLatestBandBreakdown(
    metrics.scene_loop_district_family_matrix_7d
  );
  metrics.scene_loop_district_family_trend_breakdown_7d = buildSceneLoopDistrictFamilyTrendBreakdown(
    metrics.scene_loop_district_family_matrix_7d
  );
  metrics.scene_loop_district_family_health_trend_breakdown_7d = buildSceneLoopDistrictFamilyHealthTrendBreakdown(
    metrics.scene_loop_district_family_matrix_7d
  );
  metrics.scene_loop_district_family_attention_breakdown_7d = buildSceneLoopDistrictFamilyAttentionBreakdown(
    metrics.scene_loop_district_family_matrix_7d
  );
  metrics.scene_loop_district_family_health_attention_breakdown_7d = buildSceneLoopDistrictFamilyHealthAttentionBreakdown(
    metrics.scene_loop_district_family_matrix_7d
  );
  metrics.scene_loop_district_family_attention_trend_breakdown_7d = buildSceneLoopDistrictFamilyAttentionTrendBreakdown(
    metrics.scene_loop_district_family_matrix_7d
  );
  metrics.scene_loop_district_family_health_attention_trend_breakdown_7d =
    buildSceneLoopDistrictFamilyHealthAttentionTrendBreakdown(metrics.scene_loop_district_family_matrix_7d);
  metrics.scene_loop_district_family_health_attention_trend_matrix_7d =
    buildSceneLoopDistrictFamilyHealthAttentionTrendMatrix(metrics.scene_loop_district_family_matrix_7d);
  metrics.scene_loop_district_family_health_attention_trend_daily_breakdown_7d =
    buildSceneLoopDistrictFamilyHealthAttentionTrendDailyBreakdown(metrics.scene_loop_district_family_daily_breakdown_7d);
  metrics.scene_loop_district_family_health_attention_trend_daily_matrix_7d =
    buildSceneLoopDistrictFamilyHealthAttentionTrendDailyMatrix(
      metrics.scene_loop_district_family_health_attention_trend_daily_breakdown_7d
    );
  metrics.scene_loop_district_family_attention_priority_7d = buildSceneLoopDistrictFamilyAttentionPriority(
    metrics.scene_loop_district_family_health_attention_trend_matrix_7d
  );
  metrics.scene_loop_district_family_attention_priority_daily_7d = buildSceneLoopDistrictFamilyAttentionPriorityDaily(
    metrics.scene_loop_district_family_health_attention_trend_daily_matrix_7d
  );
  metrics.scene_loop_district_microflow_matrix_7d = buildSceneLoopDistrictMicroflowMatrix(
    metrics.scene_loop_district_microflow_daily_breakdown_7d
  );
  metrics.scene_loop_district_microflow_latest_band_breakdown_7d = buildSceneLoopDistrictFamilyLatestBandBreakdown(
    metrics.scene_loop_district_microflow_matrix_7d
  );
  metrics.scene_loop_district_microflow_trend_breakdown_7d = buildSceneLoopDistrictFamilyTrendBreakdown(
    metrics.scene_loop_district_microflow_matrix_7d
  );
  metrics.scene_loop_district_microflow_attention_breakdown_7d = buildSceneLoopDistrictFamilyAttentionBreakdown(
    metrics.scene_loop_district_microflow_matrix_7d
  );
  metrics.scene_loop_district_microflow_health_attention_breakdown_7d =
    buildSceneLoopDistrictMicroflowHealthAttentionBreakdown(metrics.scene_loop_district_microflow_matrix_7d);
  metrics.scene_loop_district_microflow_attention_trend_breakdown_7d =
    buildSceneLoopDistrictMicroflowAttentionTrendBreakdown(metrics.scene_loop_district_microflow_matrix_7d);
  metrics.scene_loop_district_microflow_health_attention_trend_breakdown_7d =
    buildSceneLoopDistrictMicroflowHealthAttentionTrendBreakdown(metrics.scene_loop_district_microflow_matrix_7d);
  metrics.scene_loop_district_microflow_health_attention_trend_matrix_7d =
    buildSceneLoopDistrictMicroflowHealthAttentionTrendMatrix(metrics.scene_loop_district_microflow_matrix_7d);
  metrics.scene_loop_district_microflow_health_attention_trend_daily_breakdown_7d =
    buildSceneLoopDistrictMicroflowHealthAttentionTrendDailyBreakdown(metrics.scene_loop_district_microflow_daily_breakdown_7d);
  metrics.scene_loop_district_microflow_health_attention_trend_daily_matrix_7d =
    buildSceneLoopDistrictMicroflowHealthAttentionTrendDailyMatrix(
      metrics.scene_loop_district_microflow_health_attention_trend_daily_breakdown_7d
    );
  metrics.scene_loop_district_microflow_attention_priority_7d = buildSceneLoopDistrictMicroflowAttentionPriority(
    metrics.scene_loop_district_microflow_health_attention_trend_matrix_7d
  );
  metrics.scene_loop_district_microflow_attention_priority_daily_7d = buildSceneLoopDistrictMicroflowAttentionPriorityDaily(
    metrics.scene_loop_district_microflow_health_attention_trend_daily_matrix_7d
  );
  metrics.scene_loop_district_microflow_risk_rows_7d = buildSceneLoopDistrictMicroflowRiskRows(
    metrics.scene_loop_district_microflow_health_attention_trend_matrix_7d
  );
  metrics.scene_loop_district_microflow_risk_rows_daily_7d = buildSceneLoopDistrictMicroflowRiskRowsDaily(
    metrics.scene_loop_district_microflow_health_attention_trend_daily_matrix_7d
  );
  metrics.scene_loop_district_microflow_risk_matrix_7d = buildSceneLoopDistrictMicroflowRiskMatrix(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d
  );
  metrics.scene_loop_district_microflow_risk_matrix_daily_7d = buildSceneLoopDistrictMicroflowRiskMatrixDaily(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d
  );
  metrics.scene_loop_district_microflow_risk_priority_7d = buildSceneLoopDistrictMicroflowRiskPriority(
    metrics.scene_loop_district_microflow_risk_matrix_7d
  );
  metrics.scene_loop_district_microflow_risk_priority_daily_7d = buildSceneLoopDistrictMicroflowRiskPriorityDaily(
    metrics.scene_loop_district_microflow_risk_matrix_daily_7d
  );
  metrics.scene_loop_district_microflow_risk_focus_7d = buildSceneLoopDistrictMicroflowRiskFocus(
    metrics.scene_loop_district_microflow_risk_priority_7d
  );
  metrics.scene_loop_district_microflow_risk_focus_daily_7d = buildSceneLoopDistrictMicroflowRiskFocusDaily(
    metrics.scene_loop_district_microflow_risk_priority_daily_7d
  );
  metrics.scene_loop_district_microflow_risk_focus_key_breakdown_7d = buildSceneLoopDimensionBreakdown(
    metrics.scene_loop_district_microflow_risk_rows_7d,
    "focus_key"
  );
  metrics.scene_loop_district_microflow_risk_focus_key_breakdown_daily_7d = buildSceneLoopDimensionBreakdownDaily(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "focus_key"
  );
  metrics.scene_loop_district_microflow_risk_focus_key_matrix_7d = buildSceneLoopDimensionRiskMatrix(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "focus_key"
  );
  metrics.scene_loop_district_microflow_risk_focus_key_matrix_daily_7d = buildSceneLoopDimensionRiskMatrixDaily(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "focus_key"
  );
  metrics.scene_loop_district_microflow_risk_flow_key_breakdown_7d = buildSceneLoopDimensionBreakdown(
    metrics.scene_loop_district_microflow_risk_rows_7d,
    "flow_key"
  );
  metrics.scene_loop_district_microflow_risk_flow_key_breakdown_daily_7d = buildSceneLoopDimensionBreakdownDaily(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "flow_key"
  );
  metrics.scene_loop_district_microflow_risk_flow_key_matrix_7d = buildSceneLoopDimensionRiskMatrix(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "flow_key"
  );
  metrics.scene_loop_district_microflow_risk_flow_key_matrix_daily_7d = buildSceneLoopDimensionRiskMatrixDaily(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "flow_key"
  );
  metrics.scene_loop_district_microflow_risk_flow_key_priority_7d = buildSceneLoopDimensionPriority(
    metrics.scene_loop_district_microflow_risk_matrix_7d,
    "flow_key"
  );
  metrics.scene_loop_district_microflow_risk_flow_key_priority_daily_7d = buildSceneLoopDimensionPriorityDaily(
    metrics.scene_loop_district_microflow_risk_matrix_daily_7d,
    "flow_key"
  );
  metrics.scene_loop_district_microflow_risk_entry_kind_breakdown_7d = buildSceneLoopDimensionBreakdown(
    metrics.scene_loop_district_microflow_risk_rows_7d,
    "entry_kind_key"
  );
  metrics.scene_loop_district_microflow_risk_entry_kind_breakdown_daily_7d = buildSceneLoopDimensionBreakdownDaily(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "entry_kind_key"
  );
  metrics.scene_loop_district_microflow_risk_entry_kind_matrix_7d = buildSceneLoopDimensionRiskMatrix(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "entry_kind_key"
  );
  metrics.scene_loop_district_microflow_risk_entry_kind_matrix_daily_7d = buildSceneLoopDimensionRiskMatrixDaily(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "entry_kind_key"
  );
  metrics.scene_loop_district_microflow_risk_entry_kind_priority_7d = buildSceneLoopDimensionPriority(
    metrics.scene_loop_district_microflow_risk_rows_7d,
    "entry_kind_key"
  );
  metrics.scene_loop_district_microflow_risk_entry_kind_priority_daily_7d = buildSceneLoopDimensionPriorityDaily(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "entry_kind_key"
  );
  metrics.scene_loop_district_microflow_risk_sequence_kind_breakdown_7d = buildSceneLoopDimensionBreakdown(
    metrics.scene_loop_district_microflow_risk_rows_7d,
    "sequence_kind_key"
  );
  metrics.scene_loop_district_microflow_risk_sequence_kind_breakdown_daily_7d = buildSceneLoopDimensionBreakdownDaily(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "sequence_kind_key"
  );
  metrics.scene_loop_district_microflow_risk_sequence_kind_matrix_7d = buildSceneLoopDimensionRiskMatrix(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "sequence_kind_key"
  );
  metrics.scene_loop_district_microflow_risk_sequence_kind_matrix_daily_7d = buildSceneLoopDimensionRiskMatrixDaily(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "sequence_kind_key"
  );
  metrics.scene_loop_district_microflow_risk_sequence_kind_priority_7d = buildSceneLoopDimensionPriority(
    metrics.scene_loop_district_microflow_risk_rows_7d,
    "sequence_kind_key"
  );
  metrics.scene_loop_district_microflow_risk_sequence_kind_priority_daily_7d = buildSceneLoopDimensionPriorityDaily(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "sequence_kind_key"
  );
  metrics.scene_loop_district_microflow_risk_signature_breakdown_7d = buildSceneLoopDimensionBreakdown(
    metrics.scene_loop_district_microflow_risk_rows_7d,
    "risk_context_signature"
  );
  metrics.scene_loop_district_microflow_risk_signature_breakdown_daily_7d = buildSceneLoopDimensionBreakdownDaily(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "risk_context_signature"
  );
  metrics.scene_loop_district_microflow_risk_signature_matrix_7d = buildSceneLoopDimensionRiskMatrix(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "risk_context_signature"
  );
  metrics.scene_loop_district_microflow_risk_signature_matrix_daily_7d = buildSceneLoopDimensionRiskMatrixDaily(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "risk_context_signature"
  );
  metrics.scene_loop_district_microflow_risk_signature_priority_7d = buildSceneLoopDimensionPriority(
    metrics.scene_loop_district_microflow_risk_matrix_7d,
    "risk_context_signature"
  );
  metrics.scene_loop_district_microflow_risk_signature_priority_daily_7d = buildSceneLoopDimensionPriorityDaily(
    metrics.scene_loop_district_microflow_risk_matrix_daily_7d,
    "risk_context_signature"
  );
  metrics.scene_loop_district_microflow_risk_action_signature_breakdown_7d = buildSceneLoopDimensionBreakdown(
    metrics.scene_loop_district_microflow_risk_rows_7d,
    "action_context_signature"
  );
  metrics.scene_loop_district_microflow_risk_action_signature_breakdown_daily_7d = buildSceneLoopDimensionBreakdownDaily(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "action_context_signature"
  );
  metrics.scene_loop_district_microflow_risk_action_signature_matrix_7d = buildSceneLoopDimensionRiskMatrix(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "action_context_signature"
  );
  metrics.scene_loop_district_microflow_risk_action_signature_matrix_daily_7d = buildSceneLoopDimensionRiskMatrixDaily(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "action_context_signature"
  );
  metrics.scene_loop_district_microflow_risk_action_signature_priority_7d = buildSceneLoopDimensionPriority(
    metrics.scene_loop_district_microflow_risk_matrix_7d,
    "action_context_signature"
  );
  metrics.scene_loop_district_microflow_risk_action_signature_priority_daily_7d = buildSceneLoopDimensionPriorityDaily(
    metrics.scene_loop_district_microflow_risk_matrix_daily_7d,
    "action_context_signature"
  );
  metrics.scene_loop_district_microflow_risk_contract_state_breakdown_7d = buildSceneLoopDimensionBreakdown(
    metrics.scene_loop_district_microflow_risk_rows_7d,
    "contract_state_key"
  );
  metrics.scene_loop_district_microflow_risk_contract_state_breakdown_daily_7d = buildSceneLoopDimensionBreakdownDaily(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "contract_state_key"
  );
  metrics.scene_loop_district_microflow_risk_contract_state_matrix_7d = buildSceneLoopDimensionRiskMatrix(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "contract_state_key"
  );
  metrics.scene_loop_district_microflow_risk_contract_state_matrix_daily_7d = buildSceneLoopDimensionRiskMatrixDaily(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "contract_state_key"
  );
  metrics.scene_loop_district_microflow_risk_contract_state_priority_7d = buildSceneLoopDimensionPriority(
    metrics.scene_loop_district_microflow_risk_matrix_7d,
    "contract_state_key"
  );
  metrics.scene_loop_district_microflow_risk_contract_state_priority_daily_7d = buildSceneLoopDimensionPriorityDaily(
    metrics.scene_loop_district_microflow_risk_matrix_daily_7d,
    "contract_state_key"
  );
  metrics.scene_loop_district_microflow_risk_latest_band_breakdown_7d = buildSceneLoopDistrictFamilyLatestBandBreakdown(
    metrics.scene_loop_district_microflow_risk_matrix_7d
  );
  metrics.scene_loop_district_microflow_risk_health_band_breakdown_7d = buildSceneLoopDimensionBreakdown(
    metrics.scene_loop_district_microflow_risk_rows_7d,
    "latest_health_band"
  );
  metrics.scene_loop_district_microflow_risk_health_band_breakdown_daily_7d = buildSceneLoopDimensionBreakdownDaily(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "latest_health_band"
  );
  metrics.scene_loop_district_microflow_risk_health_band_matrix_7d = buildSceneLoopDimensionRiskMatrix(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "latest_health_band"
  );
  metrics.scene_loop_district_microflow_risk_health_band_matrix_daily_7d = buildSceneLoopDimensionRiskMatrixDaily(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "latest_health_band"
  );
  metrics.scene_loop_district_microflow_risk_attention_breakdown_7d = buildSceneLoopDistrictFamilyAttentionBreakdown(
    metrics.scene_loop_district_microflow_risk_matrix_7d
  );
  metrics.scene_loop_district_microflow_risk_attention_band_breakdown_7d = buildSceneLoopDimensionBreakdown(
    metrics.scene_loop_district_microflow_risk_rows_7d,
    "attention_band"
  );
  metrics.scene_loop_district_microflow_risk_attention_band_breakdown_daily_7d = buildSceneLoopDimensionBreakdownDaily(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "attention_band"
  );
  metrics.scene_loop_district_microflow_risk_attention_band_matrix_7d = buildSceneLoopDimensionRiskMatrix(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "attention_band"
  );
  metrics.scene_loop_district_microflow_risk_attention_band_matrix_daily_7d = buildSceneLoopDimensionRiskMatrixDaily(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "attention_band"
  );
  metrics.scene_loop_district_microflow_risk_trend_breakdown_7d = buildSceneLoopDistrictFamilyTrendBreakdown(
    metrics.scene_loop_district_microflow_risk_matrix_7d
  );
  metrics.scene_loop_district_microflow_risk_trend_direction_breakdown_7d = buildSceneLoopDimensionBreakdown(
    metrics.scene_loop_district_microflow_risk_rows_7d,
    "trend_direction"
  );
  metrics.scene_loop_district_microflow_risk_trend_direction_breakdown_daily_7d = buildSceneLoopDimensionBreakdownDaily(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "trend_direction"
  );
  metrics.scene_loop_district_microflow_risk_trend_direction_matrix_7d = buildSceneLoopDimensionRiskMatrix(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "trend_direction"
  );
  metrics.scene_loop_district_microflow_risk_trend_direction_matrix_daily_7d = buildSceneLoopDimensionRiskMatrixDaily(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "trend_direction"
  );
  metrics.scene_loop_district_microflow_risk_health_attention_trend_breakdown_7d =
    buildSceneLoopDistrictMicroflowHealthAttentionTrendBreakdown(metrics.scene_loop_district_microflow_risk_matrix_7d);
  metrics.scene_loop_district_microflow_risk_health_attention_trend_daily_matrix_7d =
    buildSceneLoopDistrictMicroflowHealthAttentionTrendDailyBreakdown(
      metrics.scene_loop_district_microflow_risk_matrix_daily_7d
    );
  metrics.scene_loop_district_microflow_risk_breakdown_7d = buildSceneLoopDistrictMicroflowRiskBreakdown(
    metrics.scene_loop_district_microflow_risk_rows_7d
  );
  metrics.scene_loop_district_microflow_risk_breakdown_daily_7d = buildSceneLoopDistrictMicroflowRiskBreakdownDaily(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d
  );
  metrics.scene_loop_district_microflow_risk_district_breakdown_7d = buildSceneLoopDimensionBreakdown(
    metrics.scene_loop_district_microflow_risk_rows_7d,
    "district_key"
  );
  metrics.scene_loop_district_microflow_risk_district_breakdown_daily_7d = buildSceneLoopDimensionBreakdownDaily(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "district_key"
  );
  metrics.scene_loop_district_microflow_risk_family_breakdown_7d = buildSceneLoopDimensionBreakdown(
    metrics.scene_loop_district_microflow_risk_rows_7d,
    "loop_family_key"
  );
  metrics.scene_loop_district_microflow_risk_family_breakdown_daily_7d = buildSceneLoopDimensionBreakdownDaily(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "loop_family_key"
  );
  metrics.scene_loop_district_microflow_risk_microflow_breakdown_7d = buildSceneLoopDimensionBreakdown(
    metrics.scene_loop_district_microflow_risk_rows_7d,
    "loop_microflow_key"
  );
  metrics.scene_loop_district_microflow_risk_microflow_breakdown_daily_7d = buildSceneLoopDimensionBreakdownDaily(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "loop_microflow_key"
  );
  metrics.scene_loop_district_microflow_risk_district_matrix_7d = buildSceneLoopDimensionRiskMatrix(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "district_key"
  );
  metrics.scene_loop_district_microflow_risk_district_matrix_daily_7d = buildSceneLoopDimensionRiskMatrixDaily(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "district_key"
  );
  metrics.scene_loop_district_microflow_risk_family_matrix_7d = buildSceneLoopDimensionRiskMatrix(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "loop_family_key"
  );
  metrics.scene_loop_district_microflow_risk_family_matrix_daily_7d = buildSceneLoopDimensionRiskMatrixDaily(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "loop_family_key"
  );
  metrics.scene_loop_district_microflow_risk_microflow_matrix_7d = buildSceneLoopDimensionRiskMatrix(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "loop_microflow_key"
  );
  metrics.scene_loop_district_microflow_risk_microflow_matrix_daily_7d = buildSceneLoopDimensionRiskMatrixDaily(
    metrics.scene_loop_district_microflow_risk_rows_daily_7d,
    "loop_microflow_key"
  );
  metrics.scene_runtime_daily_breakdown_7d = normalizeSceneDailyRows(metrics.scene_runtime_daily_breakdown_7d);
  const sceneDailyRows = metrics.scene_runtime_daily_breakdown_7d;
  const latestSceneDay = sceneDailyRows[0] || null;
  const earliestSceneDay = sceneDailyRows[sceneDailyRows.length - 1] || null;
  const sceneReadyRate7dAvg = sceneDailyRows.length
    ? Number(
        (
          sceneDailyRows.reduce((sum, row) => sum + toNum(row.ready_rate, 0), 0) /
          Math.max(1, sceneDailyRows.length)
        ).toFixed(4)
      )
    : 0;
  const sceneFailureRate7dAvg = sceneDailyRows.length
    ? Number(
        (
          sceneDailyRows.reduce((sum, row) => sum + toNum(row.failure_rate, 0), 0) /
          Math.max(1, sceneDailyRows.length)
        ).toFixed(4)
      )
    : 0;
  const sceneLowEndShare7dAvg = sceneDailyRows.length
    ? Number(
        (
          sceneDailyRows.reduce((sum, row) => sum + toNum(row.low_end_share, 0), 0) /
          Math.max(1, sceneDailyRows.length)
        ).toFixed(4)
      )
    : 0;
  const sceneTrendDirection = resolveSceneTrendDirection(
    latestSceneDay?.ready_rate,
    earliestSceneDay?.ready_rate,
    sceneDailyRows.length
  );
  const sceneTrendDelta = Number(
    clamp(toNum(latestSceneDay?.ready_rate, 0) - toNum(earliestSceneDay?.ready_rate, 0), -1, 1).toFixed(4)
  );
  const sceneAlarmState = resolveSceneAlarmState(sceneDailyRows);
  const sceneAlarmReasons = buildSceneAlarmReasons(sceneDailyRows);
  const sceneBandBreakdown = buildSceneBandBreakdown(sceneDailyRows);
  const worstSceneDay =
    sceneDailyRows.length > 0
      ? [...sceneDailyRows]
          .sort((left, right) => {
            const failureGap = toNum(right.failure_rate, 0) - toNum(left.failure_rate, 0);
            if (Math.abs(failureGap) > 0.0001) return failureGap;
            const readyGap = toNum(left.ready_rate, 0) - toNum(right.ready_rate, 0);
            if (Math.abs(readyGap) > 0.0001) return readyGap;
            return String(right.day || "").localeCompare(String(left.day || ""));
          })[0]
      : null;
  metrics.scene_runtime_ready_rate_7d_avg = sceneReadyRate7dAvg;
  metrics.scene_runtime_failure_rate_7d_avg = sceneFailureRate7dAvg;
  metrics.scene_runtime_low_end_share_7d_avg = sceneLowEndShare7dAvg;
  metrics.scene_runtime_trend_direction_7d = sceneTrendDirection;
  metrics.scene_runtime_trend_delta_ready_rate_7d = sceneTrendDelta;
  metrics.scene_runtime_alarm_state_7d = sceneAlarmState;
  metrics.scene_runtime_alarm_reasons_7d = sceneAlarmReasons;
  metrics.scene_runtime_band_breakdown_7d = sceneBandBreakdown;
  metrics.scene_runtime_worst_day_7d = worstSceneDay
    ? {
        day: String(worstSceneDay.day || ""),
        total_count: Math.max(0, Math.floor(toNum(worstSceneDay.total_count, 0))),
        ready_count: Math.max(0, Math.floor(toNum(worstSceneDay.ready_count, 0))),
        failed_count: Math.max(0, Math.floor(toNum(worstSceneDay.failed_count, 0))),
        low_end_count: Math.max(0, Math.floor(toNum(worstSceneDay.low_end_count, 0))),
        ready_rate: toNum(worstSceneDay.ready_rate, 0),
        failure_rate: toNum(worstSceneDay.failure_rate, 0),
        low_end_share: toNum(worstSceneDay.low_end_share, 0),
        health_band: String(worstSceneDay.health_band || "no_data")
      }
    : null;
  return metrics;
}

module.exports = {
  toRate,
  resolveQualityBand,
  resolveConversionBand,
  resolveSceneRuntimeHealthBand,
  resolveSceneTrendDirection,
  resolveSceneAlarmState,
  normalizeBreakdownRows,
  normalizeSceneDailyRows,
  normalizeSceneLoopDailyRows,
  normalizeSceneLoopDistrictDailyRows,
  normalizeSceneLoopDistrictMicroflowDailyRows,
  normalizeSceneLoopFamilyKey,
  normalizeSceneLoopMicroflowKey,
  normalizeSceneLoopMicroflowFamilyKey,
  buildSceneLoopRiskContext,
  resolveSceneLoopHealthBand,
  resolveSceneLoopDistrictHealthBand,
  resolveSceneLoopDistrictAttentionBand,
  buildSceneLoopDistrictLatestBandBreakdown,
  buildSceneLoopDistrictTrendBreakdown,
  buildSceneLoopDistrictHealthTrendBreakdown,
  buildSceneLoopDistrictAttentionBreakdown,
  buildSceneLoopDistrictFamilyMatrix,
  buildSceneLoopDistrictFamilyLatestBandBreakdown,
  buildSceneLoopDistrictFamilyTrendBreakdown,
  buildSceneLoopDistrictFamilyHealthTrendBreakdown,
  buildSceneLoopDistrictFamilyAttentionBreakdown,
  buildSceneLoopDistrictFamilyHealthAttentionBreakdown,
  buildSceneLoopDistrictFamilyAttentionTrendBreakdown,
  buildSceneLoopDistrictFamilyHealthAttentionTrendBreakdown,
  buildSceneLoopDistrictFamilyHealthAttentionTrendMatrix,
  buildSceneLoopDistrictFamilyHealthAttentionTrendDailyBreakdown,
  buildSceneLoopDistrictFamilyHealthAttentionTrendDailyMatrix,
  buildSceneLoopDistrictFamilyAttentionPriority,
  buildSceneLoopDistrictFamilyAttentionPriorityDaily,
  buildSceneLoopDistrictMicroflowMatrix,
  buildSceneLoopDistrictMicroflowHealthAttentionBreakdown,
  buildSceneLoopDistrictMicroflowAttentionTrendBreakdown,
  buildSceneLoopDistrictMicroflowHealthAttentionTrendBreakdown,
  buildSceneLoopDistrictMicroflowHealthAttentionTrendMatrix,
  buildSceneLoopDistrictMicroflowHealthAttentionTrendDailyBreakdown,
  buildSceneLoopDistrictMicroflowHealthAttentionTrendDailyMatrix,
  buildSceneLoopDistrictMicroflowAttentionPriority,
  buildSceneLoopDistrictMicroflowAttentionPriorityDaily,
  buildSceneLoopDistrictMicroflowRiskRowsDaily,
  buildSceneLoopDistrictMicroflowRiskPriorityDaily,
  buildSceneLoopDistrictMicroflowRiskMatrix,
  buildSceneLoopDistrictMicroflowRiskMatrixDaily,
  buildSceneLoopDistrictMicroflowRiskBreakdown,
  buildSceneLoopDistrictMicroflowRiskBreakdownDaily,
  buildSceneLoopDimensionBreakdown,
  buildSceneLoopDimensionBreakdownDaily,
  buildSceneLoopDimensionPriority,
  buildSceneLoopDimensionPriorityDaily,
  buildSceneLoopDimensionRiskMatrix,
  buildSceneLoopDimensionRiskMatrixDaily,
  resolveSceneLoopTrendDirection,
  buildSceneBandBreakdown,
  buildSceneLoopBandBreakdown,
  buildSceneLoopDistrictMatrix,
  buildSceneAlarmReasons,
  buildSceneLoopAlarmReasons,
  resolveSceneLoopAlarmState,
  enrichWebappRevenueMetrics
};
