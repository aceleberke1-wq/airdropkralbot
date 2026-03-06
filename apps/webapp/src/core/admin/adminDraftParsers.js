function parseJson(text, fallback) {
  try {
    return {
      ok: true,
      value: JSON.parse(String(text || fallback))
    };
  } catch (_err) {
    return {
      ok: false,
      value: null
    };
  }
}

function normalizeBooleanFlagMap(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(input).filter((entry) => typeof entry[1] === "boolean")
  );
}

export function parseDynamicPolicySegmentsDraft(draftText) {
  const parsed = parseJson(draftText, "[]");
  if (!parsed.ok) {
    return { ok: false, error: "dynamic_policy_invalid_json", segments: [] };
  }
  if (!Array.isArray(parsed.value)) {
    return { ok: false, error: "segments_required", segments: [] };
  }
  if (parsed.value.length <= 0) {
    return { ok: false, error: "segments_required", segments: [] };
  }
  const normalized = [];
  for (const row of parsed.value) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return { ok: false, error: "segment_key_required", segments: [] };
    }
    const segmentKey = String(row.segment_key || "").trim();
    if (segmentKey.length < 3) {
      return { ok: false, error: "segment_key_required", segments: [] };
    }
    normalized.push({
      ...row,
      segment_key: segmentKey
    });
  }
  return { ok: true, error: "", segments: normalized };
}

export function parseRuntimeFlagsDraft(draftText) {
  const parsed = parseJson(draftText, "{}");
  if (!parsed.ok || !parsed.value || typeof parsed.value !== "object" || Array.isArray(parsed.value)) {
    return {
      ok: false,
      error: "runtime_flags_invalid_json",
      source_mode: undefined,
      source_json: undefined,
      flags: {}
    };
  }
  const raw = parsed.value;
  const sourceModeRaw = String(raw.source_mode || "").trim();
  const sourceMode =
    sourceModeRaw === "env_locked" || sourceModeRaw === "db_override"
      ? sourceModeRaw
      : sourceModeRaw
        ? "__invalid__"
        : "";
  if (sourceMode === "__invalid__") {
    return {
      ok: false,
      error: "runtime_flags_source_mode_invalid",
      source_mode: undefined,
      source_json: undefined,
      flags: {}
    };
  }
  const sourceJson =
    raw.source_json && typeof raw.source_json === "object" && !Array.isArray(raw.source_json)
      ? raw.source_json
      : undefined;
  const flagsCandidate =
    raw.flags && typeof raw.flags === "object" && !Array.isArray(raw.flags) ? raw.flags : raw;
  const boolFlags = normalizeBooleanFlagMap(flagsCandidate);
  if (Object.keys(boolFlags).length <= 0) {
    return {
      ok: false,
      error: "runtime_flags_boolean_required",
      source_mode: undefined,
      source_json: undefined,
      flags: {}
    };
  }
  return {
    ok: true,
    error: "",
    source_mode: sourceMode || undefined,
    source_json: sourceJson,
    flags: boolFlags
  };
}

export function parseBotReconcileDraft(draftText) {
  const parsed = parseJson(draftText, "{}");
  if (!parsed.ok || !parsed.value || typeof parsed.value !== "object" || Array.isArray(parsed.value)) {
    return {
      ok: false,
      error: "runtime_bot_invalid_json",
      state_key: "",
      reason: "",
      force_stop: undefined
    };
  }
  const stateKey = String(parsed.value.state_key || "").trim();
  if (!stateKey) {
    return {
      ok: false,
      error: "state_key_required",
      state_key: "",
      reason: "",
      force_stop: undefined
    };
  }
  return {
    ok: true,
    error: "",
    state_key: stateKey,
    reason: String(parsed.value.reason || "").trim(),
    force_stop: typeof parsed.value.force_stop === "boolean" ? parsed.value.force_stop : undefined
  };
}
