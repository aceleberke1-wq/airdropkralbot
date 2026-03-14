function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toText(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function toNum(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeFamilyKey(value) {
  return toText(value).toLowerCase();
}

function familyRootKey(value) {
  const normalized = normalizeFamilyKey(value);
  if (!normalized) return "";
  return normalized.split(/[_-]/).filter(Boolean)[0] || normalized;
}

function familyMatchScore(assetFamilyKey, riskFamilyKey) {
  const assetKey = normalizeFamilyKey(assetFamilyKey);
  const riskKey = normalizeFamilyKey(riskFamilyKey);
  if (!assetKey || !riskKey) return 0;
  if (assetKey === riskKey) return 4;
  if (familyRootKey(assetKey) === familyRootKey(riskKey)) return 3;
  if (riskKey.startsWith(`${assetKey}_`) || riskKey.startsWith(`${assetKey}-`)) return 2;
  if (assetKey.startsWith(`${riskKey}_`) || assetKey.startsWith(`${riskKey}-`)) return 2;
  if (riskKey.includes(assetKey) || assetKey.includes(riskKey)) return 1;
  return 0;
}

function microflowMatchScore(assetFamilyKey, riskRow) {
  const row = asRecord(riskRow);
  const riskContext = asRecord(row.risk_context);
  const microflowKey = toText(row.loop_microflow_key || row.microflow_key || riskContext.microflow_key);
  const microflowScore = familyMatchScore(assetFamilyKey, microflowKey);
  if (microflowScore) {
    return microflowScore + 4;
  }
  const familyKey = toText(row.loop_family_key || row.family_key || riskContext.family_key);
  return familyMatchScore(assetFamilyKey, familyKey);
}

function buildAssetRuntimeRows(localManifest) {
  const manifest = asRecord(localManifest);
  return asArray(manifest.district_family_asset_runtime_rows).map((row) => asRecord(row));
}

function scoreAssetState(value) {
  const key = toText(value, "missing").toLowerCase();
  if (key === "missing") return 5;
  if (key === "partial") return 4;
  if (key === "intake_ready") return 3;
  if (key === "ready") return 1;
  return 0;
}

function scoreAttentionBand(value) {
  const key = toText(value, "no_data").toLowerCase();
  if (key === "alert") return 5;
  if (key === "watch") return 4;
  if (key === "warm") return 3;
  if (key === "cool") return 2;
  if (key === "low" || key === "live") return 1;
  return 0;
}

function scoreHealthBand(value) {
  const key = toText(value, "no_data").toLowerCase();
  if (key === "red") return 5;
  if (key === "yellow") return 3;
  if (key === "green") return 1;
  return 0;
}

function scoreDay(value) {
  const dayText = toText(value);
  if (!dayText) return 0;
  const timestamp = Date.parse(dayText);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function buildRiskSourceRows(metrics, { daily = false, scope = "family" } = {}) {
  const source = asRecord(metrics);
  if (scope === "microflow") {
    const preferred = daily
      ? source.scene_loop_district_microflow_risk_priority_daily_7d
      : source.scene_loop_district_microflow_risk_priority_7d;
    const fallbackRows = daily
      ? source.scene_loop_district_microflow_risk_rows_daily_7d
      : source.scene_loop_district_microflow_risk_rows_7d;
    const fallbackMatrix = daily
      ? source.scene_loop_district_microflow_risk_matrix_daily_7d
      : source.scene_loop_district_microflow_risk_matrix_7d;
    if (asArray(preferred).length) return asArray(preferred);
    if (asArray(fallbackRows).length) return asArray(fallbackRows);
    return asArray(fallbackMatrix);
  }
  const preferred = daily
    ? source.scene_loop_district_family_attention_priority_daily_7d
    : source.scene_loop_district_family_attention_priority_7d;
  const fallback = daily
    ? source.scene_loop_district_family_health_attention_trend_daily_matrix_7d
    : source.scene_loop_district_family_health_attention_trend_matrix_7d;
  return asArray(preferred).length ? asArray(preferred) : asArray(fallback);
}

function pickBestRiskRow(assetRow, riskRows, { scope = "family" } = {}) {
  const districtKey = toText(assetRow.district_key);
  const familyKey = toText(assetRow.family_key);
  let bestRow = null;
  let bestScore = -1;
  let bestDayScore = -1;
  asArray(riskRows).forEach((rawRow) => {
    const row = asRecord(rawRow);
    if (districtKey && toText(row.district_key) !== districtKey) {
      return;
    }
    const matchScore =
      scope === "microflow"
        ? microflowMatchScore(familyKey, row)
        : familyMatchScore(familyKey, row.loop_family_key || asRecord(row.risk_context).family_key);
    if (!matchScore) {
      return;
    }
    const rowScore =
      matchScore * 100000 +
      scoreAttentionBand(row.attention_band || asRecord(row.risk_context).risk_attention_band_key) * 1000 +
      scoreHealthBand(row.latest_health_band || row.health_band || asRecord(row.risk_context).risk_health_band_key) * 100 +
      (row.contract_ready === true ? 0 : 10) +
      toNum(row.priority_score || row.total_count || row.item_count || 0);
    const rowDayScore = scoreDay(row.day);
    if (rowScore > bestScore || (rowScore === bestScore && rowDayScore > bestDayScore)) {
      bestRow = row;
      bestScore = rowScore;
      bestDayScore = rowDayScore;
    }
  });
  return bestRow ? asRecord(bestRow) : null;
}

function resolveCombinedStateKey(assetStateKey, healthBandKey, attentionBandKey, runtimeReady, riskReady) {
  const assetState = toText(assetStateKey, "missing").toLowerCase();
  const healthBand = toText(healthBandKey).toLowerCase();
  const attentionBand = toText(attentionBandKey).toLowerCase();
  if (assetState === "missing") return "missing";
  if (assetState === "intake_ready") return "intake_ready";
  if (assetState === "partial") return "partial";
  if (healthBand === "red" || attentionBand === "alert") return "partial";
  if (runtimeReady && riskReady) return "ready";
  return "partial";
}

/**
 * @param {{
 *   metrics?: Record<string, unknown> | null,
 *   localManifest?: Record<string, unknown> | null,
 *   scope?: "family" | "microflow",
 *   daily?: boolean,
 *   limit?: number
 * }} [options]
 * @returns {Array<Record<string, unknown>>}
 */
export function buildAssetRiskFocusRows({ metrics, localManifest, scope = "family", daily = false, limit = 7 } = {}) {
  const manifest = asRecord(localManifest);
  const assetRuntimeRows = asArray(manifest.district_family_asset_runtime_rows).map((row) => asRecord(row));
  const normalizedScope = scope === "microflow" ? "microflow" : "family";
  const riskRows = buildRiskSourceRows(metrics, { daily, scope: normalizedScope });
  if (!assetRuntimeRows.length || !riskRows.length) {
    return [];
  }

  return assetRuntimeRows
    .map((assetRow) => {
      const riskRow = pickBestRiskRow(assetRow, riskRows, { scope: normalizedScope });
      const riskContext = asRecord(riskRow?.risk_context);
      const actionContext = asRecord(riskRow?.action_context);
      const familyKey = toText(riskRow?.loop_family_key || riskContext.family_key || assetRow.family_key);
      const microflowKey = toText(riskRow?.loop_microflow_key || riskContext.microflow_key);
      const flowKey = toText(riskRow?.flow_key || riskContext.flow_key);
      const focusKey = toText(riskRow?.focus_key || riskContext.focus_key);
      const healthBandKey = toText(
        riskContext.risk_health_band_key || riskRow?.latest_health_band || riskRow?.health_band,
        "no_data"
      ).toLowerCase();
      const attentionBandKey = toText(riskContext.risk_attention_band_key || riskRow?.attention_band, "no_data").toLowerCase();
      const trendDirectionKey = toText(
        riskContext.risk_trend_direction_key || riskRow?.trend_direction,
        "no_data"
      ).toLowerCase();
      const riskKey = toText(
        riskContext.risk_key || riskRow?.risk_key,
        [healthBandKey, attentionBandKey, trendDirectionKey].join(":")
      );
      const riskFocusKey = toText(riskContext.risk_focus_key || riskRow?.risk_focus_key);
      const runtimeContractReady = assetRow.runtime_contract_ready === true;
      const riskContractReady = riskRow?.contract_ready === true || riskContext.contract_ready === true;
      const combinedStateKey = resolveCombinedStateKey(
        assetRow.runtime_state_key || assetRow.state_key,
        healthBandKey,
        attentionBandKey,
        runtimeContractReady,
        riskContractReady
      );
      const scopeKey = toText(normalizedScope === "microflow" ? microflowKey || familyKey : familyKey);
      const assetRiskFocusKey = `${toText(assetRow.focus_key || "--")}|${riskKey || "no_data:no_data:no_data"}`;
      const baseContractSignature = [
        toText(assetRow.runtime_contract_signature || assetRow.asset_contract_signature || assetRow.focus_key),
        riskFocusKey || riskKey || "no_risk",
        flowKey || "--"
      ]
        .filter(Boolean)
        .join("|");
      const scopedContractSignature =
        normalizedScope === "family" && !daily
          ? baseContractSignature
          : [
              baseContractSignature,
              `${normalizedScope}:${scopeKey || "--"}`,
              daily ? `day:${toText(riskRow?.day || "--", "--")}` : ""
            ]
              .filter(Boolean)
              .join("|");
      return {
        scope_kind: normalizedScope,
        scope_key: scopeKey,
        day: toText(riskRow?.day),
        district_key: toText(assetRow.district_key),
        family_key: toText(assetRow.family_key),
        asset_key: toText(assetRow.asset_key),
        file_name: toText(assetRow.file_name || assetRow.asset_key),
        focus_key: toText(assetRow.focus_key),
        runtime_state_key: toText(assetRow.runtime_state_key || assetRow.state_key || "missing").toLowerCase(),
        runtime_contract_ready: runtimeContractReady,
        runtime_contract_signature: toText(assetRow.runtime_contract_signature || assetRow.asset_contract_signature),
        domain_state_key: toText(assetRow.domain_state_key || "missing").toLowerCase(),
        asset_contract_signature: toText(assetRow.asset_contract_signature),
        combined_state_key: combinedStateKey,
        combined_contract_ready: runtimeContractReady && riskContractReady,
        asset_risk_focus_key:
          normalizedScope === "family" && !daily
            ? assetRiskFocusKey
            : [assetRiskFocusKey, `${normalizedScope}:${scopeKey || "--"}`, daily ? `day:${toText(riskRow?.day || "--", "--")}` : ""]
                .filter(Boolean)
                .join("|"),
        asset_risk_contract_signature: scopedContractSignature,
        priority_score: toNum(riskRow?.priority_score || 0),
        flow_key: flowKey,
        microflow_key: microflowKey,
        risk_key: riskKey,
        risk_focus_key: riskFocusKey,
        risk_health_band_key: healthBandKey,
        risk_attention_band_key: attentionBandKey,
        risk_trend_direction_key: trendDirectionKey,
        entry_kind_key: toText(riskContext.entry_kind_key || riskRow?.entry_kind_key),
        sequence_kind_key: toText(riskContext.sequence_kind_key || riskRow?.sequence_kind_key),
        action_context_signature: toText(actionContext.action_context_signature || riskRow?.action_context_signature),
        risk_context_signature: toText(riskContext.risk_context_signature || riskRow?.risk_context_signature),
        contract_ready: riskContractReady,
        contract_state_key: toText(riskRow?.contract_state_key || riskContext.contract_state_key),
        context_lookup_resolved: riskRow?.context_lookup_resolved === true || riskContext.context_lookup_resolved === true,
        loop_family_key: familyKey,
        risk_context: {
          ...riskContext,
          family_key: familyKey || riskContext.family_key,
          microflow_key: microflowKey || riskContext.microflow_key,
          flow_key: flowKey || riskContext.flow_key,
          focus_key: focusKey || riskContext.focus_key,
          risk_key: riskKey || riskContext.risk_key,
          risk_focus_key: riskFocusKey || riskContext.risk_focus_key,
          risk_health_band_key: healthBandKey || riskContext.risk_health_band_key,
          risk_attention_band_key: attentionBandKey || riskContext.risk_attention_band_key,
          risk_trend_direction_key: trendDirectionKey || riskContext.risk_trend_direction_key,
          entry_kind_key: toText(riskContext.entry_kind_key || riskRow?.entry_kind_key),
          sequence_kind_key: toText(riskContext.sequence_kind_key || riskRow?.sequence_kind_key),
          contract_ready: riskContractReady
        },
        action_context: {
          ...actionContext,
          family_key: familyKey || actionContext.family_key,
          microflow_key: microflowKey || actionContext.microflow_key,
          flow_key: flowKey || actionContext.flow_key,
          focus_key: focusKey || actionContext.focus_key,
          entry_kind_key: toText(actionContext.entry_kind_key || riskRow?.entry_kind_key),
          sequence_kind_key: toText(actionContext.sequence_kind_key || riskRow?.sequence_kind_key),
          action_context_signature: toText(actionContext.action_context_signature || riskRow?.action_context_signature)
        }
      };
    })
    .sort((left, right) => {
      const severityLeft = Math.max(
        scoreAssetState(left.combined_state_key || left.runtime_state_key),
        scoreAttentionBand(left.risk_attention_band_key),
        scoreHealthBand(left.risk_health_band_key)
      );
      const severityRight = Math.max(
        scoreAssetState(right.combined_state_key || right.runtime_state_key),
        scoreAttentionBand(right.risk_attention_band_key),
        scoreHealthBand(right.risk_health_band_key)
      );
      if (severityRight !== severityLeft) {
        return severityRight - severityLeft;
      }
      const readyDelta = Number(Boolean(left.combined_contract_ready)) - Number(Boolean(right.combined_contract_ready));
      if (readyDelta) {
        return readyDelta;
      }
      const priorityDelta = toNum(right.priority_score) - toNum(left.priority_score);
      if (priorityDelta) {
        return priorityDelta;
      }
      return toText(left.asset_risk_focus_key).localeCompare(toText(right.asset_risk_focus_key));
    })
    .slice(0, Math.max(0, toNum(limit, 7)));
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @returns {{
 *   row_count: number,
 *   contract_ready_count: number,
 *   alert_count: number,
 *   partial_count: number,
 *   missing_count: number
 * }}
 */
export function summarizeAssetRiskFocusRows(rows) {
  const normalizedRows = asArray(rows).map((row) => asRecord(row));
  return {
    row_count: normalizedRows.length,
    contract_ready_count: normalizedRows.filter((row) => row.combined_contract_ready === true).length,
    alert_count: normalizedRows.filter(
      (row) =>
        toText(row.risk_attention_band_key) === "alert" ||
        toText(row.risk_health_band_key) === "red" ||
        toText(row.combined_state_key) === "missing"
    ).length,
    partial_count: normalizedRows.filter((row) => toText(row.combined_state_key) === "partial").length,
    missing_count: normalizedRows.filter((row) => toText(row.combined_state_key) === "missing").length
  };
}

function pickBestAssetRuntimeRow(riskRow, assetRuntimeRows, { scope = "family" } = {}) {
  const row = asRecord(riskRow);
  const riskContext = asRecord(row.risk_context);
  const districtKey = toText(row.district_key || riskContext.district_key);
  const familyKey = toText(row.loop_family_key || row.family_key || riskContext.family_key);
  const microflowKey = toText(row.loop_microflow_key || row.microflow_key || riskContext.microflow_key);
  let bestRow = null;
  let bestScore = -1;
  asArray(assetRuntimeRows).forEach((rawAssetRow) => {
    const assetRow = asRecord(rawAssetRow);
    if (districtKey && toText(assetRow.district_key) !== districtKey) {
      return;
    }
    const matchTarget = scope === "microflow" ? microflowKey || familyKey : familyKey;
    const matchScore = familyMatchScore(matchTarget, assetRow.family_key);
    if (!matchScore) {
      return;
    }
    const rowScore =
      matchScore * 100000 +
      scoreAssetState(assetRow.runtime_state_key || assetRow.state_key) * 1000 +
      (assetRow.runtime_contract_ready === true ? 0 : 10);
    if (rowScore > bestScore) {
      bestRow = assetRow;
      bestScore = rowScore;
    }
  });
  return bestRow ? asRecord(bestRow) : null;
}

/**
 * @param {{
 *   rows?: Array<Record<string, unknown>> | null,
 *   localManifest?: Record<string, unknown> | null,
 *   scope?: "family" | "microflow"
 * }} [options]
 * @returns {Array<Record<string, unknown>>}
 */
export function decorateRiskRowsWithAssetRuntime({ rows, localManifest, scope = "family" } = {}) {
  const normalizedRows = asArray(rows).map((row) => asRecord(row));
  const assetRuntimeRows = buildAssetRuntimeRows(localManifest);
  const normalizedScope = scope === "microflow" ? "microflow" : "family";
  if (!normalizedRows.length || !assetRuntimeRows.length) {
    return normalizedRows;
  }
  return normalizedRows.map((row) => {
    const assetRow = pickBestAssetRuntimeRow(row, assetRuntimeRows, { scope: normalizedScope });
    if (!assetRow) {
      return row;
    }
    return {
      ...row,
      asset_scope_kind: normalizedScope,
      asset_scope_key:
        normalizedScope === "microflow"
          ? toText(row.loop_microflow_key || row.microflow_key || asRecord(row.risk_context).microflow_key)
          : toText(row.loop_family_key || row.family_key || asRecord(row.risk_context).family_key),
      asset_key: toText(assetRow.asset_key),
      asset_family_key: toText(assetRow.family_key),
      asset_focus_key: toText(assetRow.focus_key),
      asset_state_key: toText(assetRow.state_key || assetRow.runtime_state_key),
      asset_runtime_state_key: toText(assetRow.runtime_state_key || assetRow.state_key),
      asset_contract_ready: assetRow.asset_contract_ready === true,
      asset_runtime_contract_ready: assetRow.runtime_contract_ready === true,
      asset_contract_signature: toText(assetRow.asset_contract_signature),
      asset_runtime_contract_signature: toText(assetRow.runtime_contract_signature),
      asset_domain_state_key: toText(assetRow.domain_state_key),
      asset_file_name: toText(assetRow.file_name || assetRow.asset_key)
    };
  });
}
