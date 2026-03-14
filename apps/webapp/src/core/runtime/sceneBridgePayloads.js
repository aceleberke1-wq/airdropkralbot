import { buildPvpLiveViewModel } from "../player/pvpLiveViewModel.js";
import { buildHomeFeedViewModel } from "../player/homeFeedViewModel.js";
import { buildTasksViewModel } from "../player/tasksViewModel.js";
import { buildVaultViewModel } from "../player/vaultViewModel.js";
import { buildAssetRiskFocusRows, summarizeAssetRiskFocusRows } from "../admin/assetRuntimeRiskFocus.js";

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toNum(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, toNum(value, min)));
}

function mapDeckTone(value, fallback = "balanced") {
  const key = toText(value, fallback).toLowerCase();
  if (key === "advantage" || key === "safe") return "safe";
  if (key === "critical") return "critical";
  if (key === "pressure" || key === "aggressive") return "pressure";
  if (key === "neutral") return "neutral";
  return "balanced";
}

function mapRuntimeTone(value, fallback = "balanced") {
  const key = toText(value, fallback).toLowerCase();
  if (["critical", "pressure", "advantage", "balanced", "neutral"].includes(key)) return key;
  if (key === "safe") return "advantage";
  if (key === "aggressive") return "pressure";
  return "balanced";
}

function mapBadgeTone(value, fallback = "info") {
  const key = toText(value, fallback).toLowerCase();
  if (["warn", "default", "info"].includes(key)) return key;
  if (key === "critical") return "warn";
  if (key === "pressure") return "default";
  return "info";
}

function mapMeterPalette(value, fallback = "balanced") {
  const key = toText(value, fallback).toLowerCase();
  if (["neutral", "safe", "balanced", "aggressive", "critical"].includes(key)) return key;
  if (key === "pressure") return "aggressive";
  if (key === "advantage") return "safe";
  return "balanced";
}

function formatRelativeMinutes(expiresAt) {
  const stamp = Date.parse(String(expiresAt || ""));
  return Number.isFinite(stamp) ? Math.max(0, Math.round((stamp - Date.now()) / 60000)) : 0;
}

function readManifestSource(source) {
  const root = asRecord(source);
  const manifest = asRecord(root.asset_manifest);
  const summary = asRecord(manifest.summary || root.summary || manifest);
  return {
    available: manifest.available !== false && summary.available !== false,
    active_revision: asRecord(manifest.active_revision || root.active_revision),
    entries: asArray(manifest.entries || root.entries),
    summary
  };
}

function buildAssetMetrics(mutators, source) {
  const manifest = readManifestSource(source);
  const summary = manifest.summary;
  if (mutators?.computeAssetManifestMetrics && manifest.entries.length) {
    return mutators.computeAssetManifestMetrics({
      available: manifest.available,
      active_revision: manifest.active_revision,
      entries: manifest.entries.map((row) => ({
        asset_key: toText(asRecord(row).asset_key || asRecord(row).key || "asset"),
        exists_local: asRecord(row).exists_local !== false && asRecord(row).exists !== false,
        integrity_status: toText(
          asRecord(row).integrity_status || (asRecord(row).exists === false ? "missing" : "ok"),
          "unknown"
        )
      }))
    });
  }

  const totalEntries = Math.max(0, toNum(summary.total_assets || summary.total_entries || summary.total || 0));
  const readyEntries = Math.max(0, toNum(summary.ready_assets || summary.ready_entries || summary.ready || 0));
  const missingEntries = Math.max(
    0,
    toNum(summary.missing_assets || summary.missing_entries || summary.missing || totalEntries - readyEntries)
  );
  const integrityRatio = clamp(
    toNum(
      summary.integrity_ratio ||
        (totalEntries > 0
          ? toNum(summary.integrity_ok_assets || summary.integrity_ok_entries || readyEntries) / Math.max(1, totalEntries)
          : 0)
    )
  );
  const readyRatio = totalEntries > 0 ? clamp(readyEntries / totalEntries) : 0;
  const missingRatio = totalEntries > 0 ? clamp(missingEntries / totalEntries) : 0;
  const sourceMode = toText(manifest.active_revision.source || summary.source_mode || "fallback", "fallback");
  const manifestRevision = toText(
    manifest.active_revision.manifest_revision ||
      manifest.active_revision.state_json?.manifest_revision ||
      summary.active_revision ||
      summary.manifest_revision ||
      "local",
    "local"
  );
  const manifestHash = toText(manifest.active_revision.manifest_hash || summary.manifest_hash || "");
  const tone =
    totalEntries === 0
      ? "balanced"
      : missingEntries >= 2 || integrityRatio < 0.62
        ? "critical"
        : missingEntries > 0 || integrityRatio < 0.9
          ? "pressure"
          : "advantage";
  return {
    available: manifest.available,
    sourceMode,
    manifestRevision,
    manifestHash,
    hashShort: manifestHash ? manifestHash.slice(0, 10) : manifestRevision.slice(0, 10) || "local",
    activatedAt: manifest.active_revision.activated_at || manifest.active_revision.updated_at || manifest.active_revision.created_at || null,
    totalEntries,
    readyEntries,
    missingEntries,
    missingRatio,
    integrityOkEntries: Math.max(0, Math.round(integrityRatio * totalEntries)),
    integrityBadEntries: Math.max(0, totalEntries - Math.round(integrityRatio * totalEntries)),
    integrityUnknownEntries: 0,
    integrityRatio,
    readyRatio,
    tone
  };
}

function readWebappDomainSummary(source) {
  const root = asRecord(source);
  const localManifest = asRecord(root.local_manifest);
  const explicitSummary = asRecord(localManifest.webapp_domain_summary || root.webapp_domain_summary);
  if (Object.keys(explicitSummary).length) {
    return explicitSummary;
  }
  const runtimeLocation =
    typeof window !== "undefined" && window?.location
      ? window.location
      : globalThis?.location && typeof globalThis.location === "object"
        ? globalThis.location
        : null;
  const host = toText(runtimeLocation?.host || "");
  const pathname = toText(runtimeLocation?.pathname || "");
  const origin = toText(runtimeLocation?.origin || (host ? `https://${host}` : ""));
  if (!host && !origin) {
    return {};
  }
  const onWebappPath = pathname.toLowerCase().includes("/webapp");
  return {
    host,
    state_key: onWebappPath ? "ready" : "partial",
    dns_ready: Boolean(host),
    contract_ready: Boolean(host && onWebappPath),
    runtime_guard_matches_host: Boolean(host),
    public_url: origin ? `${origin}${pathname || "/webapp"}` : "",
    runtime_guard_base_url: origin || "",
    health_status_code: onWebappPath ? 200 : 0,
    webapp_status_code: onWebappPath ? 200 : 0,
    cname_targets: [],
    a_records: []
  };
}

function buildWebappDomainLine(webappDomainSummary, fallbackText = "DOMAIN telemetry bekleniyor") {
  const summary = asRecord(webappDomainSummary);
  const host = toText(summary.host || "");
  if (!host) {
    return fallbackText;
  }
  const stateKey = toText(summary.state_key || "missing", "missing").toUpperCase();
  const webappCode = Math.round(toNum(summary.webapp_status_code));
  const guardState = summary.runtime_guard_matches_host === false ? "DRIFT" : "MATCH";
  return `DOMAIN ${host} | ${stateKey} | WEBAPP ${webappCode} | GUARD ${guardState}`;
}

function buildSceneStatusPayload(profileMetrics, webappDomainSummary) {
  if (!profileMetrics) return null;
  const summary = asRecord(webappDomainSummary);
  const domainStateKey = toText(summary.state_key || "missing", "missing").toLowerCase();
  const domainHost = toText(summary.host || "");
  return {
    chips: [
      {
        id: "sceneDeckModeChip",
        text: `SCENE ${toText(profileMetrics.sceneMode, "PRO")}`,
        tone: mapDeckTone(profileMetrics.transportTone || profileMetrics.perfTone || "balanced"),
        level: clamp(profileMetrics.ladderActivity || 0.18)
      },
      {
        id: "sceneDeckPerfChip",
        text: `PERF ${toText(profileMetrics.perfTier, "NORMAL")}`,
        tone: mapDeckTone(profileMetrics.perfTone || "safe"),
        level: clamp((toNum(profileMetrics.fps) || 0) > 0 ? toNum(profileMetrics.fps) / 60 : 0.55)
      },
      {
        id: "sceneDeckAssetChip",
        text: `ASSET ${Math.round(clamp(profileMetrics.assetReadyRatio || profileMetrics.assetRatio || 0) * 100)}%`,
        tone: mapDeckTone(profileMetrics.assetRuntimeTone || "balanced"),
        level: clamp(profileMetrics.assetReadyRatio || profileMetrics.assetRatio || 0)
      },
      {
        id: "sceneDeckTransportChip",
        text: `PVP ${toText(profileMetrics.transport, "POLL")}`,
        tone: mapDeckTone(profileMetrics.transportTone || "balanced"),
        level: clamp(profileMetrics.pressureRatio || 0.18)
      },
      {
        id: "sceneDeckManifestChip",
        text: `REV ${toText(profileMetrics.manifestShort, "local")}`,
        tone: mapDeckTone((profileMetrics.manifestRiskRatio || 0) >= 0.45 ? "pressure" : "neutral"),
        level: clamp(1 - toNum(profileMetrics.manifestRiskRatio || 0))
      }
    ],
    profileLine: toText(profileMetrics.profileLine, "Profile telemetry bekleniyor."),
    domainLine: buildWebappDomainLine(summary),
    domainStateKey,
    domainHost,
    runtimeGuardMatchesHost: summary.runtime_guard_matches_host !== false,
    liteBadge: profileMetrics.liteBadge
      ? {
          shouldShow: Boolean(profileMetrics.liteBadge.shouldShow),
          text: toText(profileMetrics.liteBadge.text, "Lite Scene"),
          tone: profileMetrics.liteBadge.tone === "warn" ? "warn" : "info",
          mode: toText(profileMetrics.liteBadge.mode, "ok"),
          title: toText(profileMetrics.liteBadge.title, "")
        }
      : { shouldShow: false, text: "Lite Scene", tone: "info", mode: "ok", title: "" }
  };
}

function formatRuntimeKeyLabel(value, fallback = "-") {
  const text = toText(value, fallback)
    .replace(/^world_(entry|sequence|modal|loop)_kind_/, "")
    .replace(/^world_sheet_metric_/, "")
    .replace(/^loop_status_/, "")
    .replace(/^district_/, "")
    .replace(/^scene_/, "")
    .replace(/^player_/, "")
    .replace(/^admin_/, "")
    .replace(/_/g, " ")
    .trim();
  return text ? text.toUpperCase() : fallback;
}

function formatLoopStageValue(value) {
  const text = toText(value, "-");
  return text ? text.replace(/_/g, " ").toUpperCase() : "-";
}

function formatLoopRows(rows, fallback = "") {
  const source = asArray(rows)
    .map((row) => asRecord(row))
    .filter((row) => Object.keys(row).length > 0)
    .slice(0, 3);
  if (!source.length) {
    return fallback;
  }
  return source
    .map((row) => `${formatRuntimeKeyLabel(row.label_key || row.key || "metric", "METRIC")} ${toText(row.value, "-")}`.trim())
    .filter(Boolean)
    .join(" | ");
}

function resolveSelectedLoopFamilyKey(selectedLoop) {
  const row = asRecord(selectedLoop);
  const explicitFamilyKey = toText(row.familyKey || row.family_key, "").toLowerCase();
  if (explicitFamilyKey) {
    return explicitFamilyKey;
  }
  const explicitFocusKey = toText(row.focusKey || row.focus_key, "").toLowerCase();
  if (explicitFocusKey.split(":").length >= 3) {
    return toText(explicitFocusKey.split(":")[1], "").toLowerCase();
  }
  switch (toText(row.districtKey || row.district_key, "").toLowerCase()) {
    case "arena_prime":
      return "duel";
    case "mission_quarter":
      return "loot";
    case "exchange_district":
      return "wallet";
    case "ops_citadel":
      return "queue";
    case "central_hub":
      return "travel";
    default:
      return "";
  }
}

function buildSceneLoopDeckPayload(scene) {
  const selectedLoop = asRecord(scene?.selectedLoop);
  if (!selectedLoop) {
    return {
      lineText: "Loop state bekleniyor.",
      districtKey: "",
      loopStatusKey: "",
      loopStatusLabel: "",
      stageValue: "",
      entryKindKey: "",
      sequenceKindKey: "",
      microflowKey: "",
      focusKey: "",
      riskKey: "",
      riskFocusKey: "",
      protocolPodKey: "",
      familyKey: "",
      flowKey: "",
      personalityLabel: "",
      personalityCaption: "",
      densityLabel: "",
      activeAssetKey: "",
      activeAssetFamilyKey: "",
      activeAssetAnchorKind: "",
      activeAssetBundleKind: "",
      activeAssetVariantKey: "",
      activeAssetVariantRole: "",
      activeAssetVariantTier: "",
      activeAssetCandidateKey: "",
      activeAssetStateKey: "",
      activeAssetContractReady: false,
      activeAssetContractSignature: "",
      readyAssetCount: 0,
      selectedAssetCount: 0,
      loadedAssetCount: 0,
      riskHealthBandKey: "",
      riskAttentionBandKey: "",
      riskTrendDirectionKey: "",
      actionContextSignature: "",
      actionContext: null,
      riskContextSignature: "",
      riskContext: null,
      loopRows: [],
      loopSignalRows: [],
      sequenceRows: [],
      detailLine: "",
      signalLine: "",
      sequenceLine: ""
    };
  }
  const districtLabel = formatRuntimeKeyLabel(selectedLoop.districtKey, "DISTRICT");
  const entryLabel = formatRuntimeKeyLabel(selectedLoop.entryKindKey, "ENTRY");
  const statusLabel = formatRuntimeKeyLabel(
    selectedLoop.loopStatusLabelKey || selectedLoop.loopStatusKey,
    "IDLE"
  );
  const sequenceLabel = formatRuntimeKeyLabel(selectedLoop.sequenceKindKey, "LOOP");
  const stageLabel = formatLoopStageValue(selectedLoop.loopStageValue);
  const microflowLabel = formatRuntimeKeyLabel(selectedLoop.microflowKey, "FLOW");
  const personalityLabel = formatRuntimeKeyLabel(selectedLoop.personalityLabelKey || selectedLoop.personalityKey, "");
  const personalityCaption = formatRuntimeKeyLabel(selectedLoop.personalityCaptionKey, "");
  const densityLabel = formatRuntimeKeyLabel(selectedLoop.densityLabelKey, "");
  const selectedLoopFamilyKey = resolveSelectedLoopFamilyKey(selectedLoop);
  const loopMeta = buildLoopBridgeMeta(
    {
      ...selectedLoop,
      family_key: selectedLoopFamilyKey
    },
    selectedLoopFamilyKey
  );
  const providedActionContext = asRecord(selectedLoop.actionContext || selectedLoop.action_context);
  const providedRiskContext = asRecord(selectedLoop.riskContext || selectedLoop.risk_context);
  return {
    lineText: `${districtLabel} | ${entryLabel} | ${statusLabel}${personalityLabel ? ` | ${personalityLabel}` : ""} | ${sequenceLabel} ${stageLabel} | ${microflowLabel}`,
    districtKey: toText(selectedLoop.districtKey, ""),
    loopStatusKey: toText(selectedLoop.loopStatusKey, ""),
    loopStatusLabel: statusLabel,
    stageValue: stageLabel,
    entryKindKey: toText(selectedLoop.entryKindKey || selectedLoop.entry_kind_key || loopMeta.entry_kind_key, ""),
    sequenceKindKey: toText(
      selectedLoop.sequenceKindKey || selectedLoop.sequence_kind_key || loopMeta.sequence_kind_key,
      ""
    ),
    microflowKey: toText(selectedLoop.microflowKey || selectedLoop.microflow_key || loopMeta.microflow_key, ""),
    focusKey: toText(selectedLoop.focusKey || selectedLoop.focus_key || loopMeta.focus_key, ""),
    riskKey: toText(selectedLoop.riskKey || selectedLoop.risk_key || loopMeta.risk_key, ""),
    riskFocusKey: toText(selectedLoop.riskFocusKey || selectedLoop.risk_focus_key || loopMeta.risk_focus_key, ""),
    protocolPodKey: toText(selectedLoop.protocolPodKey, ""),
    familyKey: toText(selectedLoop.familyKey || selectedLoop.family_key || selectedLoopFamilyKey || loopMeta.family_key, ""),
    flowKey: toText(selectedLoop.flowKey || selectedLoop.flow_key || loopMeta.flow_key, ""),
    personalityLabel,
    personalityCaption,
    densityLabel,
    activeAssetKey: toText(selectedLoop.activeAssetKey || selectedLoop.active_asset_key, ""),
    activeAssetFamilyKey: toText(
      selectedLoop.activeAssetFamilyKey || selectedLoop.active_asset_family_key || selectedLoop.familyKey || selectedLoop.family_key,
      ""
    ),
    activeAssetAnchorKind: toText(selectedLoop.activeAssetAnchorKind || selectedLoop.active_asset_anchor_kind, ""),
    activeAssetBundleKind: toText(selectedLoop.activeAssetBundleKind || selectedLoop.active_asset_bundle_kind, ""),
    activeAssetVariantKey: toText(selectedLoop.activeAssetVariantKey || selectedLoop.active_asset_variant_key, ""),
    activeAssetVariantRole: toText(selectedLoop.activeAssetVariantRole || selectedLoop.active_asset_variant_role, ""),
    activeAssetVariantTier: toText(selectedLoop.activeAssetVariantTier || selectedLoop.active_asset_variant_tier, ""),
    activeAssetCandidateKey: toText(selectedLoop.activeAssetCandidateKey || selectedLoop.active_asset_candidate_key, ""),
    activeAssetStateKey: toText(selectedLoop.activeAssetStateKey || selectedLoop.active_asset_state_key, ""),
    activeAssetContractReady: Boolean(selectedLoop.activeAssetContractReady || selectedLoop.active_asset_contract_ready),
    activeAssetContractSignature: toText(
      selectedLoop.activeAssetContractSignature || selectedLoop.active_asset_contract_signature,
      ""
    ),
    readyAssetCount: Math.max(0, toNum(selectedLoop.readyAssetCount || selectedLoop.ready_asset_count || 0)),
    selectedAssetCount: Math.max(0, toNum(selectedLoop.selectedAssetCount || selectedLoop.selected_asset_count || 0)),
    loadedAssetCount: Math.max(0, toNum(selectedLoop.loadedAssetCount || selectedLoop.loaded_asset_count || 0)),
    riskHealthBandKey: toText(
      selectedLoop.riskHealthBandKey || selectedLoop.risk_health_band_key || loopMeta.risk_health_band_key,
      ""
    ),
    riskAttentionBandKey: toText(
      selectedLoop.riskAttentionBandKey || selectedLoop.risk_attention_band_key || loopMeta.risk_attention_band_key,
      ""
    ),
    riskTrendDirectionKey: toText(
      selectedLoop.riskTrendDirectionKey || selectedLoop.risk_trend_direction_key || loopMeta.risk_trend_direction_key,
      ""
    ),
    actionContextSignature: toText(
      selectedLoop.actionContextSignature || selectedLoop.action_context_signature || loopMeta.action_context_signature,
      ""
    ),
    actionContext: Object.keys(providedActionContext).length ? providedActionContext : loopMeta.action_context || null,
    riskContextSignature: toText(
      selectedLoop.riskContextSignature || selectedLoop.risk_context_signature || loopMeta.risk_context_signature,
      ""
    ),
    riskContext: Object.keys(providedRiskContext).length ? providedRiskContext : loopMeta.risk_context || null,
    loopRows: asArray(selectedLoop.loopRows).slice(0, 3),
    loopSignalRows: asArray(selectedLoop.loopSignalRows).slice(0, 3),
    sequenceRows: asArray(selectedLoop.sequenceRows).slice(0, 3),
    detailLine: formatLoopRows(selectedLoop.loopRows, "Loop detay bekleniyor."),
    signalLine: formatLoopRows(selectedLoop.loopSignalRows, "Signal detay bekleniyor."),
    sequenceLine: formatLoopRows(selectedLoop.sequenceRows, "Sequence detay bekleniyor.")
  };
}

function buildLoopMicroflowRailText(loopDeck) {
  const microflowLabel = formatRuntimeKeyLabel(loopDeck?.microflowKey, "WAIT");
  const podLabel = formatRuntimeKeyLabel(loopDeck?.protocolPodKey, "--");
  return `MICRO ${microflowLabel} | POD ${podLabel}`;
}

function findLoopRowByKey(rows, candidates) {
  const patterns = asArray(candidates)
    .map((item) => toText(item, "").toLowerCase())
    .filter(Boolean);
  if (!patterns.length) {
    return null;
  }
  return (
    asArray(rows)
      .map((row) => asRecord(row))
      .find((row) => {
        const key = toText(row.label_key || row.key || "", "").toLowerCase();
        return patterns.some((pattern) => key.includes(pattern));
      }) || null
  );
}

function readLoopRowValue(rows, candidates, fallback = "--") {
  return toText(findLoopRowByKey(rows, candidates)?.value, fallback);
}

function buildLoopMicroLine(label, primary, secondary) {
  return `${label} ${toText(primary, "--")} | ${toText(secondary, "--")}`.trim();
}

function buildLoopMicroDetail(...segments) {
  return segments
    .map((segment) => toText(segment, ""))
    .filter(Boolean)
    .join(" | ");
}

function buildLoopFocusKeyText(source, familyKey = "") {
  const row = asRecord(source);
  const explicit = toText(row.focusKey || row.focus_key, "");
  if (explicit) {
    return explicit.toLowerCase();
  }
  const focusText = toText(row.focusText, "");
  const embeddedMatch = focusText.match(/\bKEY\s+([A-Z0-9:_-]+)\b/i);
  if (embeddedMatch?.[1]) {
    return embeddedMatch[1].toLowerCase();
  }
  const districtKey = toText(row.districtKey || row.district_key, "").toLowerCase();
  const resolvedFamilyKey = toText(row.familyKey || row.family_key || familyKey, "").toLowerCase();
  const microflowKey = toText(row.microflowKey || row.microflow_key, "").toLowerCase();
  const parts = [districtKey, resolvedFamilyKey, microflowKey].filter(Boolean);
  return parts.length >= 2 ? parts.join(":") : "";
}

function buildLoopFocusDetail(source, familyKey, ...segments) {
  const focusKeyText = buildLoopFocusKeyText(source, familyKey);
  return buildLoopMicroDetail(...segments, focusKeyText ? `KEY ${focusKeyText}` : "");
}

function buildLoopAttentionDetail(...segments) {
  return buildLoopMicroDetail(...segments);
}

function buildLoopCadenceDetail(...segments) {
  return buildLoopMicroDetail(...segments);
}

function buildLoopHealthText(source) {
  const row = asRecord(source);
  return toText(row.gateText || row.summaryText || row.stateText, "HEALTH --");
}

function buildLoopAttentionText(source) {
  const row = asRecord(source);
  return toText(row.attentionText || row.pressureText || row.responseText, "ATTN --");
}

function buildLoopTrendText(source) {
  const row = asRecord(source);
  return toText(row.cadenceText || row.responseText || row.windowText, "TREND --");
}

function buildLoopRiskSummaryText(source) {
  const healthText = buildLoopHealthText(source);
  const attentionText = buildLoopAttentionText(source);
  const trendText = buildLoopTrendText(source);
  return `HEALTH ${healthText} | ATTN ${attentionText} | TREND ${trendText}`;
}

function buildLoopRiskComponentText(source) {
  const healthBandKey = inferLoopHealthBandKey(source);
  const attentionBandKey = inferLoopAttentionBandKey(source);
  const trendDirectionKey = inferLoopTrendDirectionKey(source);
  return `HB ${healthBandKey.toUpperCase()} | ATTN ${attentionBandKey.toUpperCase()} | TREND ${trendDirectionKey.toUpperCase()}`;
}

function buildLoopMicroflowText(source) {
  const row = asRecord(source);
  const explicit = toText(row.microflowText, "");
  if (explicit) {
    return explicit;
  }
  const derivedSource = [
    row.familyText,
    row.flowText,
    row.summaryText,
    row.gateText,
    row.stateText,
    row.leadText,
    row.windowText
  ]
    .map((value) => toText(value, ""))
    .filter(Boolean)
    .join(" | ");
  const match = derivedSource.match(/FLOW ([A-Z ]+? FLOW)\b/i);
  if (!match?.[1]) {
    return "MICRO WAIT | POD --";
  }
  const microflowLabel = match[1].trim().toUpperCase();
  const podLabel = microflowLabel === "DISPATCH FLOW" ? "--" : microflowLabel.replace(/\s+FLOW$/, " POD");
  return `MICRO ${microflowLabel} | POD ${podLabel}`;
}

function buildLoopRiskHeuristicText(source, ...fields) {
  const row = asRecord(source);
  return fields
    .map((field) => toText(row[field], ""))
    .filter(Boolean)
    .join(" | ")
    .toLowerCase();
}

function inferLoopHealthBandKey(source) {
  const explicit = toText(source?.riskHealthBand || source?.latest_health_band || source?.health_band, "").toLowerCase();
  if (explicit) {
    return explicit;
  }
  const text = buildLoopRiskHeuristicText(source, "summaryText", "stateText", "gateText", "detailText");
  const tone = toText(source?.tone, "").toLowerCase();
  if (
    text.includes("alert") ||
    text.includes("critical") ||
    text.includes("blocked") ||
    text.includes("reject") ||
    text.includes("manual") ||
    text.includes("fail") ||
    tone === "critical"
  ) {
    return "red";
  }
  if (
    text.includes("watch") ||
    text.includes("hot") ||
    text.includes("queue") ||
    text.includes("review") ||
    text.includes("pending") ||
    text.includes("pressure") ||
    tone === "pressure"
  ) {
    return "yellow";
  }
  if (
    text.includes("stable") ||
    text.includes("live") ||
    text.includes("open") ||
    text.includes("approved") ||
    text.includes("active") ||
    text.includes("clear") ||
    tone === "advantage"
  ) {
    return "green";
  }
  return "no_data";
}

function inferLoopAttentionBandKey(source) {
  const explicit = toText(source?.riskAttentionBand || source?.attention_band, "").toLowerCase();
  if (explicit) {
    return explicit;
  }
  const text = buildLoopRiskHeuristicText(source, "pressureText", "responseText", "signalText", "opsText");
  if (
    text.includes("alert") ||
    text.includes("critical") ||
    text.includes("blocked") ||
    text.includes("manual") ||
    text.includes("reject")
  ) {
    return "alert";
  }
  if (
    text.includes("watch") ||
    text.includes("hot") ||
    text.includes("queue") ||
    text.includes("pressure") ||
    text.includes("pending") ||
    text.includes("review")
  ) {
    return "watch";
  }
  if (
    text.includes("stable") ||
    text.includes("live") ||
    text.includes("open") ||
    text.includes("approved") ||
    text.includes("active") ||
    text.includes("clear")
  ) {
    return "stable";
  }
  return "no_data";
}

function inferLoopTrendDirectionKey(source) {
  const explicit = toText(source?.riskTrendDirection || source?.trend_direction, "").toLowerCase();
  if (explicit) {
    return explicit;
  }
  const text = buildLoopRiskHeuristicText(source, "cadenceText", "windowText", "responseText", "detailText");
  if (
    text.includes("degrading") ||
    text.includes("decline") ||
    text.includes("stalled") ||
    text.includes("blocked") ||
    text.includes("alert")
  ) {
    return "degrading";
  }
  if (text.includes("improving") || text.includes("recovered") || text.includes("clear trend")) {
    return "improving";
  }
  if (text.includes("steady") || text.includes("flat") || text.includes("stable")) {
    return "flat";
  }
  return "no_data";
}

function buildLoopRiskKeyText(source) {
  const row = asRecord(source);
  const explicit = toText(row.riskKey || row.risk_key, "");
  if (explicit) {
    return explicit.toLowerCase();
  }
  return `${inferLoopHealthBandKey(row)}:${inferLoopAttentionBandKey(row)}:${inferLoopTrendDirectionKey(row)}`;
}

function buildLoopRiskFocusKeyText(source, familyKey = "") {
  const focusKeyText = buildLoopFocusKeyText(source, familyKey);
  const riskKeyText = buildLoopRiskKeyText(source);
  if (focusKeyText && riskKeyText) {
    return `${focusKeyText}|${riskKeyText}`;
  }
  return focusKeyText || riskKeyText || "";
}

function buildLoopRiskContextSignatureText(source, familyKey = "") {
  const row = asRecord(source);
  const flowKeyText = buildLoopFlowKeyText(row, familyKey);
  const riskFocusKeyText = buildLoopRiskFocusKeyText(row, familyKey);
  const family_key =
    toText(row.familyKey || row.family_key, "").toLowerCase() ||
    toText(buildLoopFocusKeyText(row, familyKey).split(":")[1], "").toLowerCase() ||
    toText(familyKey, "").toLowerCase();
  const microflow_key =
    toText(row.microflowKey || row.microflow_key, "").toLowerCase() ||
    toText(buildLoopFocusKeyText(row, familyKey).split(":")[2], "").toLowerCase();
  const entryKindKeyText =
    toText(row.entryKindKey || row.entry_kind_key, "").toLowerCase() ||
    resolveLoopBridgeEntryKindKey(family_key, microflow_key);
  const sequenceKindKeyText =
    toText(row.sequenceKindKey || row.sequence_kind_key, "").toLowerCase() ||
    resolveLoopBridgeSequenceKindKey(family_key, microflow_key);
  return [flowKeyText, riskFocusKeyText, entryKindKeyText, sequenceKindKeyText].filter(Boolean).join("|");
}

function buildLoopActionContextSignatureText(source, familyKey = "") {
  const row = asRecord(source);
  const flowKeyText = buildLoopFlowKeyText(row, familyKey);
  const focusKeyText = buildLoopFocusKeyText(row, familyKey);
  const family_key =
    toText(row.familyKey || row.family_key, "").toLowerCase() ||
    toText(focusKeyText.split(":")[1], "").toLowerCase() ||
    toText(familyKey, "").toLowerCase();
  const microflow_key =
    toText(row.microflowKey || row.microflow_key, "").toLowerCase() ||
    toText(focusKeyText.split(":")[2], "").toLowerCase();
  const entryKindKeyText =
    toText(row.entryKindKey || row.entry_kind_key, "").toLowerCase() ||
    resolveLoopBridgeEntryKindKey(family_key, microflow_key);
  const sequenceKindKeyText =
    toText(row.sequenceKindKey || row.sequence_kind_key, "").toLowerCase() ||
    resolveLoopBridgeSequenceKindKey(family_key, microflow_key);
  return [flowKeyText, focusKeyText, entryKindKeyText, sequenceKindKeyText].filter(Boolean).join("|");
}

function buildLoopEntryKindKeyText(source, familyKey = "") {
  const row = asRecord(source);
  const family_key =
    toText(row.familyKey || row.family_key, "").toLowerCase() ||
    toText(buildLoopFocusKeyText(row, familyKey).split(":")[1], "").toLowerCase() ||
    toText(familyKey, "").toLowerCase();
  const microflow_key =
    toText(row.microflowKey || row.microflow_key, "").toLowerCase() ||
    toText(buildLoopFocusKeyText(row, familyKey).split(":")[2], "").toLowerCase();
  return (
    toText(row.entryKindKey || row.entry_kind_key, "").toLowerCase() ||
    resolveLoopBridgeEntryKindKey(family_key, microflow_key)
  );
}

function buildLoopSequenceKindKeyText(source, familyKey = "") {
  const row = asRecord(source);
  const family_key =
    toText(row.familyKey || row.family_key, "").toLowerCase() ||
    toText(buildLoopFocusKeyText(row, familyKey).split(":")[1], "").toLowerCase() ||
    toText(familyKey, "").toLowerCase();
  const microflow_key =
    toText(row.microflowKey || row.microflow_key, "").toLowerCase() ||
    toText(buildLoopFocusKeyText(row, familyKey).split(":")[2], "").toLowerCase();
  return (
    toText(row.sequenceKindKey || row.sequence_kind_key, "").toLowerCase() ||
    resolveLoopBridgeSequenceKindKey(family_key, microflow_key)
  );
}

function buildLoopFamilyKeyText(source, familyKey = "") {
  const row = asRecord(source);
  const focusKeyText = buildLoopFocusKeyText(row, familyKey);
  return (
    toText(row.familyKey || row.family_key, "").toLowerCase() ||
    toText(focusKeyText.split(":")[1], "").toLowerCase() ||
    toText(familyKey, "").toLowerCase()
  );
}

function buildLoopMicroflowKeyText(source, familyKey = "") {
  const row = asRecord(source);
  const focusKeyText = buildLoopFocusKeyText(row, familyKey);
  return (
    toText(row.microflowKey || row.microflow_key, "").toLowerCase() ||
    toText(focusKeyText.split(":")[2], "").toLowerCase()
  );
}

let currentLoopAssetContext = null;

function buildLoopAssetContextSource(source, familyKey = "") {
  const row = asRecord(source);
  const nested = asRecord(row.loopDeck);
  const asset_family_key = toText(
    row.activeAssetFamilyKey ||
      row.active_asset_family_key ||
      row.assetFamilyKey ||
      row.asset_family_key ||
      nested.activeAssetFamilyKey ||
      nested.active_asset_family_key ||
      nested.assetFamilyKey ||
      nested.asset_family_key ||
      buildLoopFamilyKeyText(row, familyKey),
    ""
  ).toLowerCase();
  const asset_key = toText(
    row.activeAssetKey ||
      row.active_asset_key ||
      row.assetKey ||
      row.asset_key ||
      nested.activeAssetKey ||
      nested.active_asset_key ||
      nested.assetKey ||
      nested.asset_key,
    ""
  ).toLowerCase();
  const asset_bundle_kind = toText(
    row.activeAssetBundleKind ||
      row.active_asset_bundle_kind ||
      row.assetBundleKind ||
      row.asset_bundle_kind ||
      nested.activeAssetBundleKind ||
      nested.active_asset_bundle_kind ||
      nested.assetBundleKind ||
      nested.asset_bundle_kind ||
      (asset_key ? "selected" : ""),
    ""
  ).toLowerCase();
  const asset_variant_key = toText(
    row.activeAssetVariantKey ||
      row.active_asset_variant_key ||
      row.assetVariantKey ||
      row.asset_variant_key ||
      row.variantKey ||
      row.variant_key ||
      nested.activeAssetVariantKey ||
      nested.active_asset_variant_key ||
      nested.assetVariantKey ||
      nested.asset_variant_key ||
      nested.variantKey ||
      nested.variant_key,
    ""
  ).toLowerCase();
  const asset_variant_role = toText(
    row.activeAssetVariantRole ||
      row.active_asset_variant_role ||
      row.assetVariantRole ||
      row.asset_variant_role ||
      row.variantRole ||
      row.variant_role ||
      nested.activeAssetVariantRole ||
      nested.active_asset_variant_role ||
      nested.assetVariantRole ||
      nested.asset_variant_role ||
      nested.variantRole ||
      nested.variant_role ||
      (asset_bundle_kind === "variation" ? "support" : asset_key ? "primary" : ""),
    ""
  ).toLowerCase();
  const asset_variant_tier = toText(
    row.activeAssetVariantTier ||
      row.active_asset_variant_tier ||
      row.assetVariantTier ||
      row.asset_variant_tier ||
      row.variantTier ||
      row.variant_tier ||
      nested.activeAssetVariantTier ||
      nested.active_asset_variant_tier ||
      nested.assetVariantTier ||
      nested.asset_variant_tier ||
      nested.variantTier ||
      nested.variant_tier ||
      (asset_bundle_kind === "variation" ? "secondary" : asset_key ? "primary" : ""),
    ""
  ).toLowerCase();
  const asset_state_key = toText(
    row.activeAssetStateKey ||
      row.active_asset_state_key ||
      row.assetStateKey ||
      row.asset_state_key ||
      nested.activeAssetStateKey ||
      nested.active_asset_state_key ||
      nested.assetStateKey ||
      nested.asset_state_key,
    ""
  ).toLowerCase();
  const asset_candidate_key = toText(
    row.activeAssetCandidateKey ||
      row.active_asset_candidate_key ||
      row.assetCandidateKey ||
      row.asset_candidate_key ||
      row.candidateKey ||
      row.candidate_key ||
      nested.activeAssetCandidateKey ||
      nested.active_asset_candidate_key ||
      nested.assetCandidateKey ||
      nested.asset_candidate_key ||
      nested.candidateKey ||
      nested.candidate_key,
    ""
  );
  const contractReadyValue =
    row.activeAssetContractReady ??
    row.active_asset_contract_ready ??
    row.assetContractReady ??
    row.asset_contract_ready ??
    nested.activeAssetContractReady ??
    nested.active_asset_contract_ready ??
    nested.assetContractReady ??
    nested.asset_contract_ready;
  const asset_contract_ready = typeof contractReadyValue === "boolean" ? contractReadyValue : asset_state_key === "ready";
  const asset_focus_key =
    asset_key && asset_family_key
      ? `${asset_family_key}:${asset_key}${asset_variant_key && asset_variant_key !== asset_key ? `:${asset_variant_key}` : ""}`
      : "";
  const asset_contract_signature = toText(
    row.activeAssetContractSignature ||
      row.active_asset_contract_signature ||
      row.assetContractSignature ||
      row.asset_contract_signature ||
      nested.activeAssetContractSignature ||
      nested.active_asset_contract_signature ||
      nested.assetContractSignature ||
      nested.asset_contract_signature,
    asset_key
      ? `${asset_family_key || "district"}:${asset_key}|${asset_state_key || "missing"}|${asset_candidate_key || "--"}`
      : ""
  );
  return {
    asset_key,
    asset_family_key,
    asset_bundle_kind,
    asset_variant_key,
    asset_variant_role,
    asset_variant_tier,
    asset_state_key,
    asset_candidate_key,
    asset_contract_ready,
    asset_contract_signature,
    asset_focus_key
  };
}

function resolveLoopAssetContext(source, familyKey = "") {
  const direct = buildLoopAssetContextSource(source, familyKey);
  if (direct.asset_key || direct.asset_contract_signature || direct.asset_variant_key || direct.asset_bundle_kind) {
    return direct;
  }
  return buildLoopAssetContextSource(currentLoopAssetContext, familyKey);
}

function setCurrentLoopAssetContext(source, familyKey = "") {
  currentLoopAssetContext = buildLoopAssetContextSource(source, familyKey);
  return currentLoopAssetContext;
}

function buildLoopAssetContractSignatureText(source, familyKey = "") {
  return toText(resolveLoopAssetContext(source, familyKey).asset_contract_signature, "");
}

function buildLoopContractContextText(source, familyKey = "") {
  const familyKeyText = buildLoopFamilyKeyText(source, familyKey);
  const microflowKeyText = buildLoopMicroflowKeyText(source, familyKey);
  const flowKeyText = buildLoopFlowKeyText(source, familyKey);
  const entryKindKeyText = buildLoopEntryKindKeyText(source, familyKey);
  const sequenceKindKeyText = buildLoopSequenceKindKeyText(source, familyKey);
  const assetContext = resolveLoopAssetContext(source, familyKey);
  return buildLoopMicroDetail(
    familyKeyText ? `FAMILY ${familyKeyText}` : "",
    microflowKeyText ? `MICRO ${microflowKeyText}` : "",
    flowKeyText ? `FLOW ${flowKeyText}` : "",
    entryKindKeyText ? `ENTRY ${entryKindKeyText}` : "",
    sequenceKindKeyText ? `SEQ ${sequenceKindKeyText}` : "",
    assetContext.asset_focus_key ? `ASSET ${assetContext.asset_focus_key}` : "",
    assetContext.asset_bundle_kind ? `BUNDLE ${assetContext.asset_bundle_kind}` : "",
    assetContext.asset_variant_key ? `VAR ${assetContext.asset_variant_key}` : ""
  );
}

function buildLoopContractSignatureText(source, familyKey = "") {
  const actionSignature = buildLoopActionContextSignatureText(source, familyKey);
  const riskSignature = buildLoopRiskContextSignatureText(source, familyKey);
  const assetSignature = buildLoopAssetContractSignatureText(source, familyKey);
  return buildLoopMicroDetail(
    actionSignature ? `ACS ${actionSignature}` : "",
    riskSignature ? `RCS ${riskSignature}` : "",
    assetSignature ? `ASIG ${assetSignature}` : ""
  );
}

function buildLoopFlowKeyText(source, familyKey = "") {
  const row = asRecord(source);
  const focusKeyText = buildLoopFocusKeyText(row, familyKey);
  const family_key =
    toText(row.familyKey || row.family_key, "").toLowerCase() ||
    toText(focusKeyText.split(":")[1], "").toLowerCase() ||
    toText(familyKey, "").toLowerCase();
  const microflow_key =
    toText(row.microflowKey || row.microflow_key, "").toLowerCase() ||
    toText(focusKeyText.split(":")[2], "").toLowerCase();
  if (family_key && microflow_key) {
    return `${family_key}:${microflow_key}`;
  }
  return family_key || microflow_key || "";
}

function normalizeLoopBridgeContextKey(value) {
  return toText(value, "")
    .toLowerCase()
    .replace(/^world_(entry|modal|sequence)_kind_/, "")
    .replace(/^world_modal_lane_/, "")
    .replace(/_(flow|pod|sequence|terminal|console|route)$/g, "")
    .replace(/__+/g, "_")
    .trim();
}

function resolveLoopBridgeEntryKindKey(familyKey, microflowKey) {
  const microflow = normalizeLoopBridgeContextKey(microflowKey);
  const family = normalizeLoopBridgeContextKey(familyKey);
  switch (microflow) {
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
  switch (family) {
    case "duel":
      return "world_entry_kind_duel_console";
    case "ladder":
      return "world_entry_kind_ladder_console";
    case "telemetry":
      return "world_entry_kind_telemetry_console";
    case "offer":
    case "loot":
      return "world_entry_kind_mission_terminal";
    case "claim":
      return "world_entry_kind_claim_terminal";
    case "streak":
      return "world_entry_kind_streak_terminal";
    case "wallet":
      return "world_entry_kind_wallet_terminal";
    case "payout":
      return "world_entry_kind_payout_terminal";
    case "route":
      return "world_entry_kind_rewards_vault";
    case "premium":
      return "world_entry_kind_premium_terminal";
    case "queue":
      return "world_entry_kind_queue_console";
    case "runtime":
      return "world_entry_kind_runtime_console";
    case "dispatch":
      return "world_entry_kind_dispatch_console";
    default:
      return "world_entry_kind_hub_portal";
  }
}

function resolveLoopBridgeSequenceKindKey(familyKey, microflowKey) {
  const microflow = normalizeLoopBridgeContextKey(microflowKey);
  const family = normalizeLoopBridgeContextKey(familyKey);
  switch (microflow) {
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
    case "route":
      return "world_modal_kind_payout_route";
    case "premium":
      return "world_modal_kind_premium_unlock";
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
  switch (family) {
    case "duel":
      return "world_modal_kind_duel_sequence";
    case "ladder":
      return "world_modal_kind_ladder_sequence";
    case "telemetry":
      return "world_modal_kind_telemetry_scan";
    case "offer":
    case "loot":
      return "world_modal_kind_mission_terminal";
    case "claim":
      return "world_modal_kind_contract_sequence";
    case "streak":
      return "world_modal_kind_streak_sync";
    case "wallet":
      return "world_modal_kind_wallet_terminal";
    case "payout":
    case "route":
      return "world_modal_kind_payout_route";
    case "premium":
      return "world_modal_kind_premium_unlock";
    case "queue":
      return "world_modal_kind_queue_review";
    case "runtime":
      return "world_modal_kind_runtime_scan";
    case "dispatch":
      return "world_modal_kind_dispatch_sequence";
    default:
      return "world_modal_kind_travel_gate";
  }
}

function buildLoopBridgeMeta(source, familyKey = "") {
  const row = asRecord(source);
  const focus_key = buildLoopFocusKeyText(row, familyKey);
  const risk_key = buildLoopRiskKeyText(row);
  const risk_focus_key = buildLoopRiskFocusKeyText(row, familyKey);
  const family_key =
    toText(row.familyKey || row.family_key, "").toLowerCase() ||
    toText(focus_key.split(":")[1], "").toLowerCase() ||
    toText(familyKey, "").toLowerCase();
  const microflow_key =
    toText(row.microflowKey || row.microflow_key, "").toLowerCase() ||
    toText(focus_key.split(":")[2], "").toLowerCase();
  const flow_key = buildLoopFlowKeyText(row, familyKey);
  const entry_kind_key =
    toText(row.entryKindKey || row.entry_kind_key, "").toLowerCase() ||
    resolveLoopBridgeEntryKindKey(family_key, microflow_key);
  const sequence_kind_key =
    toText(row.sequenceKindKey || row.sequence_kind_key, "").toLowerCase() ||
    resolveLoopBridgeSequenceKindKey(family_key, microflow_key);
  const risk_health_band_key = inferLoopHealthBandKey(row);
  const risk_attention_band_key = inferLoopAttentionBandKey(row);
  const risk_trend_direction_key = inferLoopTrendDirectionKey(row);
  const assetContext = resolveLoopAssetContext(row, familyKey);
  const action_context_signature = [flow_key, focus_key, entry_kind_key, sequence_kind_key]
    .filter(Boolean)
    .join("|");
  const risk_context_signature = [
    flow_key,
    focus_key,
    `${risk_health_band_key}:${risk_attention_band_key}:${risk_trend_direction_key}`,
    entry_kind_key,
    sequence_kind_key
  ]
    .filter(Boolean)
    .join("|");
  const action_context = {
    family_key,
    flow_key,
    microflow_key,
    focus_key,
    risk_key,
    risk_focus_key,
    risk_health_band_key,
    risk_attention_band_key,
    risk_trend_direction_key,
    asset_key: assetContext.asset_key,
    asset_family_key: assetContext.asset_family_key,
    asset_bundle_kind: assetContext.asset_bundle_kind,
    asset_variant_key: assetContext.asset_variant_key,
    asset_variant_role: assetContext.asset_variant_role,
    asset_variant_tier: assetContext.asset_variant_tier,
    asset_state_key: assetContext.asset_state_key,
    asset_contract_ready: assetContext.asset_contract_ready,
    asset_contract_signature: assetContext.asset_contract_signature,
    asset_focus_key: assetContext.asset_focus_key,
    entry_kind_key,
    sequence_kind_key,
    action_context_signature
  };
  const risk_context = {
    ...action_context,
    risk_context_signature
  };
  const contract_missing_keys = [
    ["flow_key", flow_key],
    ["focus_key", focus_key],
    ["risk_key", risk_key],
    ["risk_focus_key", risk_focus_key],
    ["entry_kind_key", entry_kind_key],
    ["sequence_kind_key", sequence_kind_key],
    ["action_context_signature", action_context_signature],
    ["risk_context_signature", risk_context_signature]
  ]
    .filter(([, value]) => !toText(value, ""))
    .map(([key]) => key);
  const contract_ready = contract_missing_keys.length === 0;
  const contract_state_key = contract_ready ? "ready" : "missing";
  action_context.contract_state_key = contract_state_key;
  action_context.contract_ready = contract_ready;
  action_context.contract_missing_keys = contract_missing_keys;
  risk_context.contract_state_key = contract_state_key;
  risk_context.contract_ready = contract_ready;
  risk_context.contract_missing_keys = contract_missing_keys;
  return {
    contract_ready,
    contract_missing_keys,
    contract_state_key,
    focus_key,
    risk_key,
    risk_focus_key,
    family_key,
    flow_key,
    microflow_key,
    risk_health_band_key,
    risk_attention_band_key,
    risk_trend_direction_key,
    asset_key: assetContext.asset_key,
    asset_family_key: assetContext.asset_family_key,
    asset_bundle_kind: assetContext.asset_bundle_kind,
    asset_variant_key: assetContext.asset_variant_key,
    asset_variant_role: assetContext.asset_variant_role,
    asset_variant_tier: assetContext.asset_variant_tier,
    asset_state_key: assetContext.asset_state_key,
    asset_contract_ready: assetContext.asset_contract_ready,
    asset_contract_signature: assetContext.asset_contract_signature,
    asset_focus_key: assetContext.asset_focus_key,
    entry_kind_key,
    sequence_kind_key,
    action_context_signature,
    risk_context_signature,
    action_context,
    risk_context
  };
}

function applyLoopBridgeMeta(items, source, familyKey = "") {
  const meta = buildLoopBridgeMeta(source, familyKey);
  return asArray(items).map((item) => ({
    ...asRecord(item),
    ...meta
  }));
}

function normalizeLoopFlowPanelTitles(titles) {
  const source = Array.isArray(titles) ? titles : [];
  return [
    toText(source[0], "COMMAND"),
    toText(source[1], "STATE"),
    toText(source[2], "SIGNAL")
  ];
}

function buildLoopBridgeCard(title, value, tone, hint = "") {
  return {
    title: toText(title, "FLOW"),
    value: toText(value, "--"),
    tone: toText(tone, "neutral"),
    hint: toText(hint, "")
  };
}

function buildLoopBridgeCards(...cards) {
  return cards
    .map((card) => asRecord(card))
    .filter((card) => toText(card.title || "") && toText(card.value || ""))
    .slice(0, 4);
}

function buildLoopBridgeBlock(title, summary, gate, tone, hint = "") {
  return {
    title: toText(title, "FLOW"),
    summary: toText(summary, "--"),
    gate: toText(gate, "--"),
    tone: toText(tone, "neutral"),
    hint: toText(hint, "")
  };
}

function buildLoopBridgeBlocks(...blocks) {
  return blocks
    .map((block) => asRecord(block))
    .filter((block) => toText(block.title || "") && toText(block.summary || ""))
    .slice(0, 3);
}

function buildLoopFamilyBridgeBundle(tone, rails) {
  const source = { ...asRecord(rails), tone };
  const riskSummaryText = buildLoopRiskSummaryText(source);
  const riskKeyText = buildLoopRiskKeyText(source);
  const focusKeyText = buildLoopFocusKeyText(source);
  const riskFocusKeyText = buildLoopRiskFocusKeyText(source);
  return {
    cards: applyLoopBridgeMeta(buildLoopBridgeCards(
      buildLoopBridgeCard(
        "SUMMARY",
        source.summaryText,
        tone,
        buildLoopMicroDetail(source.familyText, focusKeyText ? `FOCUS ${focusKeyText}` : "")
      ),
      buildLoopBridgeCard("GATE", source.gateText, tone, source.flowText),
      buildLoopBridgeCard(
        "RISK",
        riskSummaryText,
        tone,
        buildLoopMicroDetail(riskKeyText ? `RISK ${riskKeyText}` : "", riskFocusKeyText ? `RFK ${riskFocusKeyText}` : "")
      )
    ), source),
    blocks: applyLoopBridgeMeta(buildLoopBridgeBlocks(
      buildLoopBridgeBlock(
        "FLOW",
        source.familyText,
        source.flowText,
        tone,
        buildLoopMicroDetail(source.summaryText, focusKeyText ? `FOCUS ${focusKeyText}` : "")
      ),
      buildLoopBridgeBlock("GATE", source.summaryText, source.gateText, tone, source.windowText),
      buildLoopBridgeBlock(
        "RISK",
        buildLoopHealthText(source),
        buildLoopAttentionText(source),
        tone,
        buildLoopMicroDetail(riskKeyText ? `RISK ${riskKeyText}` : "", riskFocusKeyText ? `RFK ${riskFocusKeyText}` : "")
      )
    ), source)
  };
}

function buildLoopFlowFamilyBridgeBundle(tone, rails, titles) {
  const source = { ...asRecord(rails), tone };
  const riskSummaryText = buildLoopRiskSummaryText(source);
  const riskKeyText = buildLoopRiskKeyText(source);
  const focusKeyText = buildLoopFocusKeyText(source);
  const riskFocusKeyText = buildLoopRiskFocusKeyText(source);
  const [entryTitle, stateTitle, resolveTitle] = normalizeLoopFlowPanelTitles(titles);
  return {
    cards: applyLoopBridgeMeta(buildLoopBridgeCards(
      buildLoopBridgeCard(
        entryTitle,
        source.leadText || source.flowText,
        tone,
        buildLoopMicroDetail(source.gateText || source.summaryText, focusKeyText ? `FOCUS ${focusKeyText}` : "")
      ),
      buildLoopBridgeCard(stateTitle, source.stateText || source.summaryText, tone, source.stageText || source.detailText),
      buildLoopBridgeCard(
        "RISK",
        riskSummaryText,
        tone,
        buildLoopMicroDetail(riskKeyText ? `RISK ${riskKeyText}` : "", riskFocusKeyText ? `RFK ${riskFocusKeyText}` : "")
      )
    ), source),
    blocks: applyLoopBridgeMeta(buildLoopBridgeBlocks(
      buildLoopBridgeBlock(
        entryTitle,
        source.focusText || source.familyText,
        source.flowText || source.summaryText,
        tone,
        buildLoopMicroDetail(source.gateText || source.detailText, focusKeyText ? `FOCUS ${focusKeyText}` : "")
      ),
      buildLoopBridgeBlock(resolveTitle, source.windowText || source.summaryText, source.summaryText || source.stateText, tone, source.attentionText || source.cadenceText),
      buildLoopBridgeBlock(
        "RISK",
        riskSummaryText,
        source.signalText || source.pressureText,
        tone,
        buildLoopMicroDetail(riskKeyText ? `RISK ${riskKeyText}` : "", riskFocusKeyText ? `RFK ${riskFocusKeyText}` : "")
      )
    ), source)
  };
}

function buildLoopRiskBridgeBundle(tone, rails) {
  const source = { ...asRecord(rails), tone };
  const riskComponentText = buildLoopRiskComponentText(source);
  const riskKeyText = buildLoopRiskKeyText(source);
  const focusKeyText = buildLoopFocusKeyText(source);
  const riskFocusKeyText = buildLoopRiskFocusKeyText(source);
  const riskHintText = buildLoopMicroDetail(
    focusKeyText ? `FOCUS ${focusKeyText}` : "",
    riskKeyText ? `RISK ${riskKeyText}` : "",
    riskFocusKeyText ? `RFK ${riskFocusKeyText}` : ""
  );
  return {
    cards: applyLoopBridgeMeta(buildLoopBridgeCards(
      buildLoopBridgeCard("HEALTH", buildLoopHealthText(source), tone, source.stateText || source.summaryText),
      buildLoopBridgeCard("ATTN", buildLoopAttentionText(source), tone, source.pressureText || source.signalText),
      buildLoopBridgeCard("TREND", buildLoopTrendText(source), tone, source.windowText || source.cadenceText),
      buildLoopBridgeCard("MICRO", buildLoopMicroflowText(source), tone, riskHintText)
    ), source),
    blocks: applyLoopBridgeMeta(buildLoopBridgeBlocks(
      buildLoopBridgeBlock("HEALTH", buildLoopHealthText(source), source.stateText || source.summaryText, tone, source.gateText || source.leadText),
      buildLoopBridgeBlock("ATTN", buildLoopAttentionText(source), source.pressureText || source.signalText, tone, source.responseText || source.opsText),
      buildLoopBridgeBlock("TREND", buildLoopTrendText(source), source.windowText || source.flowText, tone, riskHintText)
    ), source)
  };
}

function buildLoopFlowFamilyPanels(tone, rails, titles) {
  const source = { ...asRecord(rails), tone };
  const riskComponentText = buildLoopRiskComponentText(source);
  const riskKeyText = buildLoopRiskKeyText(source);
  const focusKeyText = buildLoopFocusKeyText(source);
  const riskFocusKeyText = buildLoopRiskFocusKeyText(source);
  const contractContextText = buildLoopContractContextText(source);
  const contractSignatureText = buildLoopContractSignatureText(source);
  const [commandTitle, stateTitle, signalTitle] = normalizeLoopFlowPanelTitles(titles);
  return applyLoopBridgeMeta([
    {
      title: commandTitle,
      tone,
      hint: toText(source.familyText, ""),
      lines: [
        toText(source.leadText, "LEAD --"),
        toText(source.windowText, "WINDOW --"),
        buildLoopMicroDetail(toText(source.flowText, "FLOW --"), focusKeyText ? `FOCUS ${focusKeyText}` : "")
      ]
    },
    {
      title: stateTitle,
      tone,
      hint: toText(source.gateText, ""),
      lines: [
        toText(source.stateText || source.summaryText, "STATE --"),
        buildLoopHealthText(source),
        toText(source.stageText || source.detailText, "STAGE --")
      ]
    },
    {
      title: signalTitle,
      tone,
      hint: toText(source.opsText || source.responseText || source.pressureText, ""),
      lines: [
        toText(source.pressureText, "PRESSURE --"),
        buildLoopAttentionText(source),
        buildLoopTrendText(source),
        buildLoopMicroDetail(riskComponentText, buildLoopRiskSummaryText(source)),
        `RISK ${riskKeyText}`,
        riskFocusKeyText ? `RFK ${riskFocusKeyText}` : "",
        contractContextText,
        contractSignatureText
      ]
    }
  ], source);
}

function buildLoopRiskPanels(tone, rails) {
  const source = { ...asRecord(rails), tone };
  const microflowText = buildLoopMicroflowText(source);
  const riskComponentText = buildLoopRiskComponentText(source);
  const riskKeyText = buildLoopRiskKeyText(source);
  const focusKeyText = buildLoopFocusKeyText(source);
  const riskFocusKeyText = buildLoopRiskFocusKeyText(source);
  const contractContextText = buildLoopContractContextText(source);
  const contractSignatureText = buildLoopContractSignatureText(source);
  return applyLoopBridgeMeta([
    {
      title: "HEALTH",
      tone,
      hint: toText(source.stateText || source.summaryText, ""),
      lines: [
        buildLoopHealthText(source),
        toText(source.stateText || source.summaryText, "STATE --"),
        toText(source.gateText || source.leadText, "GATE --"),
        buildLoopMicroDetail(microflowText, focusKeyText ? `FOCUS ${focusKeyText}` : ""),
        buildLoopMicroDetail(riskComponentText, buildLoopRiskSummaryText(source)),
        `RISK ${riskKeyText}`,
        riskFocusKeyText ? `RFK ${riskFocusKeyText}` : "",
        contractContextText,
        contractSignatureText
      ]
    },
    {
      title: "ATTN",
      tone,
      hint: toText(source.pressureText || source.signalText, ""),
      lines: [
        buildLoopAttentionText(source),
        toText(source.pressureText || source.signalText, "PRESSURE --"),
        toText(source.responseText || source.opsText, "RESPONSE --"),
        buildLoopMicroDetail(microflowText, focusKeyText ? `FOCUS ${focusKeyText}` : ""),
        buildLoopMicroDetail(riskComponentText, buildLoopRiskSummaryText(source)),
        `RISK ${riskKeyText}`,
        riskFocusKeyText ? `RFK ${riskFocusKeyText}` : "",
        contractContextText,
        contractSignatureText
      ]
    },
    {
      title: "TREND",
      tone,
      hint: toText(source.cadenceText || source.windowText, ""),
      lines: [
        buildLoopTrendText(source),
        toText(source.windowText || source.flowText, "WINDOW --"),
        toText(source.detailText || source.stageText, "DETAIL --"),
        buildLoopMicroDetail(microflowText, focusKeyText ? `FOCUS ${focusKeyText}` : ""),
        buildLoopMicroDetail(riskComponentText, buildLoopRiskSummaryText(source)),
        `RISK ${riskKeyText}`,
        riskFocusKeyText ? `RFK ${riskFocusKeyText}` : "",
        contractContextText,
        contractSignatureText
      ]
    }
  ], source);
}

function normalizeLoopSubflowPanelTitles(titles) {
  const source = Array.isArray(titles) ? titles : [];
  return [
    toText(source[0], "ENTRY"),
    toText(source[1], "STATE"),
    toText(source[2], "OPS")
  ];
}

const LOOP_FAMILY_TITLES = Object.freeze({
  duel: ["STANCE", "STATUS", "RESOLVE"],
  ladder: ["RANK", "STATUS", "PUSH"],
  telemetry: ["SCAN", "STATUS", "TRACE"],
  loot: ["OFFER", "STATE", "REVEAL"],
  offer: ["OFFER", "STATUS", "STACK"],
  claim: ["CLAIM", "STATUS", "PROOF"],
  streak: ["STREAK", "STATUS", "SYNC"],
  wallet: ["LINK", "STATE", "ROUTE"],
  payout: ["REQUEST", "STATE", "PROOF"],
  route: ["ROUTE", "STATE", "COVERAGE"],
  premium: ["PASS", "STATE", "PERK"],
  queue: ["QUEUE", "STATUS", "REVIEW"],
  runtime: ["RUNTIME", "STATUS", "HEALTH"],
  dispatch: ["QUEUE", "HEALTH", "RELEASE"]
});

function buildLoopSubflowPanels(tone, rails, titles) {
  const source = { ...asRecord(rails), tone };
  const riskComponentText = buildLoopRiskComponentText(source);
  const riskKeyText = buildLoopRiskKeyText(source);
  const focusKeyText = buildLoopFocusKeyText(source);
  const riskFocusKeyText = buildLoopRiskFocusKeyText(source);
  const contractContextText = buildLoopContractContextText(source);
  const contractSignatureText = buildLoopContractSignatureText(source);
  const [entryTitle, stateTitle, opsTitle] = normalizeLoopSubflowPanelTitles(titles);
  return applyLoopBridgeMeta([
    {
      title: entryTitle,
      tone,
      hint: toText(source.focusText, ""),
      lines: [
        toText(source.leadText, "LEAD --"),
        buildLoopMicroDetail(toText(source.flowText, "FLOW --"), focusKeyText ? `FOCUS ${focusKeyText}` : ""),
        toText(source.windowText, "WINDOW --")
      ]
    },
    {
      title: stateTitle,
      tone,
      hint: toText(source.stageText || source.stateText, ""),
      lines: [
        toText(source.stateText, "STATE --"),
        buildLoopHealthText(source),
        buildLoopAttentionText(source)
      ]
    },
    {
      title: opsTitle,
      tone,
      hint: toText(source.detailText, ""),
      lines: [
        toText(source.opsText, "OPS --"),
        toText(source.signalText || source.pressureText, "SIGNAL --"),
        riskComponentText,
        buildLoopMicroDetail(buildLoopRiskSummaryText(source)),
        `RISK ${riskKeyText}`,
        riskFocusKeyText ? `RFK ${riskFocusKeyText}` : "",
        contractContextText,
        contractSignatureText
      ]
    }
  ], source);
}

function buildLoopSubflowBundle(tone, rails, titles) {
  const source = asRecord(rails);
  const focusKeyText = buildLoopFocusKeyText(source);
  const riskKeyText = buildLoopRiskKeyText(source);
  const riskFocusKeyText = buildLoopRiskFocusKeyText(source);
  const [entryTitle, stateTitle, opsTitle] = normalizeLoopSubflowPanelTitles(titles);
  return {
    cards: applyLoopBridgeMeta(buildLoopBridgeCards(
      buildLoopBridgeCard(
        entryTitle,
        source.leadText || source.flowText,
        tone,
        buildLoopMicroDetail(source.focusText || source.gateText, focusKeyText ? `FOCUS ${focusKeyText}` : "")
      ),
      buildLoopBridgeCard(stateTitle, source.stateText || source.summaryText, tone, source.stageText || source.windowText),
      buildLoopBridgeCard(
        "PRESS",
        source.pressureText || source.signalText,
        tone,
        buildLoopMicroDetail(
          source.responseText || source.attentionText,
          riskKeyText ? `RISK ${riskKeyText}` : "",
          riskFocusKeyText ? `RFK ${riskFocusKeyText}` : ""
        )
      )
    ), source),
    blocks: applyLoopBridgeMeta(buildLoopBridgeBlocks(
      buildLoopBridgeBlock(
        entryTitle,
        source.flowText || source.familyText,
        source.gateText || source.summaryText,
        tone,
        buildLoopMicroDetail(source.focusText, focusKeyText ? `FOCUS ${focusKeyText}` : "")
      ),
      buildLoopBridgeBlock(opsTitle, source.windowText || source.summaryText, source.responseText || source.attentionText, tone, source.stageText),
      buildLoopBridgeBlock(
        "OPS",
        source.opsText || source.detailText,
        source.signalText || source.pressureText,
        tone,
        buildLoopMicroDetail(source.detailText, riskKeyText ? `RISK ${riskKeyText}` : "", riskFocusKeyText ? `RFK ${riskFocusKeyText}` : "")
      )
    ), source),
    panels: buildLoopSubflowPanels(tone, source, titles)
  };
}

function resolveLoopFamilyTone(...values) {
  const text = values
    .map((value) => toText(value, ""))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!text) {
    return "neutral";
  }
  if (
    text.includes("critical") ||
    text.includes("blocked") ||
    text.includes("reject") ||
    text.includes("error") ||
    text.includes("manual") ||
    text.includes("degraded")
  ) {
    return "critical";
  }
  if (
    text.includes("watch") ||
    text.includes("partial") ||
    text.includes("mixed") ||
    text.includes("review") ||
    text.includes("open") ||
    text.includes("submit") ||
    text.includes("hot") ||
    text.includes("alert")
  ) {
    return "pressure";
  }
  if (
    text.includes("active") ||
    text.includes("live") ||
    text.includes("approved") ||
    text.includes("ready") ||
    text.includes("pass") ||
    text.includes("stable") ||
    text.includes("ok")
  ) {
    return "advantage";
  }
  return "balanced";
}

function buildPvpLoopMicroPanels(loopDeck, active) {
  setCurrentLoopAssetContext(loopDeck);
  if (!active) {
    const panels = {
      duelText: "DUEL | WAIT",
      ladderText: "LADDER | WAIT",
      telemetryText: "TELEMETRY | WAIT",
      duelTone: "neutral",
      ladderTone: "neutral",
      telemetryTone: "neutral",
      duelFocusText: "ENTRY WAIT | FOCUS WAIT | PERSONA --",
      ladderFocusText: "SEQ WAIT | FOCUS WAIT | FLOW WAIT",
      telemetryFocusText: "PERSONA WAIT | FOCUS -- | FLOW WAIT",
      duelStageText: "STAGE -- | STATUS -- | FLOW WAIT",
      ladderStageText: "STAGE -- | STATUS -- | FLOW WAIT",
      telemetryStageText: "STAGE -- | STATUS -- | SEQ WAIT",
      duelOpsText: "ENTRY WAIT | STATUS -- | QUEUE --",
      ladderOpsText: "SEQ WAIT | CHARGE -- | TICK --",
      telemetryOpsText: "PERSONA WAIT | DIAG -- | RISK --",
      duelStateText: "FLOW WAIT | ENTRY WAIT | PHASE --",
      ladderStateText: "FLOW WAIT | SEQ WAIT | STAGE --",
      telemetryStateText: "FLOW WAIT | PERSONA WAIT | SEQ --",
      duelSignalText: "QUEUE -- | FLOW WAIT | RISK --",
      ladderSignalText: "CHARGE -- | TICK -- | FLOW WAIT",
      telemetrySignalText: "DIAG -- | RISK -- | FLOW WAIT",
      duelDetailText: "Queue ve sync detay bekleniyor.",
      ladderDetailText: "Ladder snapshot bekleniyor.",
      telemetryDetailText: "Reject ve asset telemetry bekleniyor.",
      duelFamilyText: "DUEL FLOW | WAIT | STAGE --",
      duelFlowText: "ENTRY WAIT | SEQ WAIT | PERSONA --",
      duelSummaryText: "FLOW WAIT | STATUS -- | PERSONA --",
      duelGateText: "QUEUE -- | RISK -- | ENTRY WAIT",
      duelLeadText: "ENTRY WAIT | FLOW WAIT | SEQ WAIT",
      duelWindowText: "PHASE -- | STATUS -- | PERSONA --",
      duelPressureText: "QUEUE -- | RISK -- | DIAG --",
      duelResponseText: "PHASE -- | FLOW WAIT | ENTRY WAIT",
      duelAttentionText: "RISK -- | QUEUE -- | PHASE --",
      duelCadenceText: "ENTRY WAIT | FLOW WAIT | PERSONA --",
      duelMicroflowText: "MICRO WAIT | POD --",
      duelCards: buildLoopBridgeCards(
        buildLoopBridgeCard("PHASE", "WAIT | STATUS --", "neutral"),
        buildLoopBridgeCard("QUEUE", "Q -- | RISK --", "neutral"),
        buildLoopBridgeCard("PERSONA", "SYNC | ENTRY WAIT", "neutral")
      ),
      duelBlocks: buildLoopBridgeBlocks(
        buildLoopBridgeBlock("FLOW", "WAIT | STATUS --", "ENTRY WAIT | SEQ WAIT", "neutral", "PERSONA --"),
        buildLoopBridgeBlock("GATE", "QUEUE -- | RISK --", "FLOW WAIT | RESPONSE --", "neutral", "PHASE --"),
        buildLoopBridgeBlock("ATTN", "RISK -- | QUEUE --", "CADENCE --", "neutral", "WINDOW --")
      ),
      ladderFamilyText: "FLOW WAIT | STATUS -- | CHARGE --",
      ladderFlowText: "SEQ WAIT | FLOW WAIT | CHARGE --",
      ladderSummaryText: "CHARGE -- | TICK -- | FLOW WAIT",
      ladderGateText: "CHARGE -- | ENTRY WAIT | STATUS --",
      ladderLeadText: "SEQ WAIT | FLOW WAIT | TICK --",
      ladderWindowText: "CHARGE -- | TICK -- | STATUS --",
      ladderPressureText: "CHARGE -- | TICK -- | RISK --",
      ladderResponseText: "TICK -- | FLOW WAIT | SEQ WAIT",
      ladderAttentionText: "CHARGE -- | TICK -- | FLOW WAIT",
      ladderCadenceText: "SEQ WAIT | FLOW WAIT | CHARGE --",
      ladderMicroflowText: "MICRO WAIT | POD --",
      telemetryFamilyText: "FLOW WAIT | STATUS -- | DIAG --",
      telemetryFlowText: "PERSONA WAIT | SEQ WAIT | FLOW WAIT",
      telemetrySummaryText: "DIAG -- | RISK -- | FLOW WAIT",
      telemetryGateText: "DIAG -- | ENTRY WAIT | STATUS --",
      telemetryLeadText: "PERSONA WAIT | FLOW WAIT | DIAG --",
      telemetryWindowText: "DIAG -- | RISK -- | STATUS --",
      telemetryPressureText: "DIAG -- | RISK -- | QUEUE --",
      telemetryResponseText: "DIAG -- | FLOW WAIT | PERSONA WAIT",
      telemetryAttentionText: "DIAG -- | RISK -- | FLOW WAIT",
      telemetryCadenceText: "PERSONA WAIT | FLOW WAIT | SEQ WAIT",
      telemetryMicroflowText: "MICRO WAIT | POD --"
    };
    const ladderBundle = buildLoopFamilyBridgeBundle(panels.ladderTone, {
      familyText: panels.ladderFamilyText,
      flowText: panels.ladderFlowText,
      summaryText: panels.ladderSummaryText,
      gateText: panels.ladderGateText,
      windowText: panels.ladderWindowText,
      pressureText: panels.ladderPressureText,
      responseText: panels.ladderResponseText,
      attentionText: panels.ladderAttentionText,
      cadenceText: panels.ladderCadenceText
    });
    const telemetryBundle = buildLoopFamilyBridgeBundle(panels.telemetryTone, {
      familyText: panels.telemetryFamilyText,
      flowText: panels.telemetryFlowText,
      summaryText: panels.telemetrySummaryText,
      gateText: panels.telemetryGateText,
      windowText: panels.telemetryWindowText,
      pressureText: panels.telemetryPressureText,
      responseText: panels.telemetryResponseText,
      attentionText: panels.telemetryAttentionText,
      cadenceText: panels.telemetryCadenceText
    });
    const duelFlowBundle = buildLoopFlowFamilyBridgeBundle(panels.duelTone, {
      familyText: panels.duelFamilyText,
      flowText: panels.duelFlowText,
      summaryText: panels.duelSummaryText,
      gateText: panels.duelGateText,
      leadText: panels.duelLeadText,
      windowText: panels.duelWindowText,
      pressureText: panels.duelPressureText,
      responseText: panels.duelResponseText,
      attentionText: panels.duelAttentionText,
      cadenceText: panels.duelCadenceText,
      focusText: panels.duelFocusText,
      stageText: panels.duelStageText,
      stateText: panels.duelStateText,
      opsText: panels.duelOpsText,
      signalText: panels.duelSignalText,
      detailText: panels.duelDetailText
    }, LOOP_FAMILY_TITLES.duel);
    const ladderFlowBundle = buildLoopFlowFamilyBridgeBundle(panels.ladderTone, {
      familyText: panels.ladderFamilyText,
      flowText: panels.ladderFlowText,
      summaryText: panels.ladderSummaryText,
      gateText: panels.ladderGateText,
      leadText: panels.ladderLeadText,
      windowText: panels.ladderWindowText,
      pressureText: panels.ladderPressureText,
      responseText: panels.ladderResponseText,
      attentionText: panels.ladderAttentionText,
      cadenceText: panels.ladderCadenceText,
      focusText: panels.ladderFocusText,
      stageText: panels.ladderStageText,
      stateText: panels.ladderStateText,
      opsText: panels.ladderOpsText,
      signalText: panels.ladderSignalText,
      detailText: panels.ladderDetailText
    }, LOOP_FAMILY_TITLES.ladder);
    const telemetryFlowBundle = buildLoopFlowFamilyBridgeBundle(panels.telemetryTone, {
      familyText: panels.telemetryFamilyText,
      flowText: panels.telemetryFlowText,
      summaryText: panels.telemetrySummaryText,
      gateText: panels.telemetryGateText,
      leadText: panels.telemetryLeadText,
      windowText: panels.telemetryWindowText,
      pressureText: panels.telemetryPressureText,
      responseText: panels.telemetryResponseText,
      attentionText: panels.telemetryAttentionText,
      cadenceText: panels.telemetryCadenceText,
      focusText: panels.telemetryFocusText,
      stageText: panels.telemetryStageText,
      stateText: panels.telemetryStateText,
      opsText: panels.telemetryOpsText,
      signalText: panels.telemetrySignalText,
      detailText: panels.telemetryDetailText
    }, LOOP_FAMILY_TITLES.telemetry);
    panels.ladderCards = ladderBundle.cards;
    panels.ladderBlocks = ladderBundle.blocks;
    panels.telemetryCards = telemetryBundle.cards;
    panels.telemetryBlocks = telemetryBundle.blocks;
    panels.ladderFlowCards = ladderFlowBundle.cards;
    panels.ladderFlowBlocks = ladderFlowBundle.blocks;
    const ladderRiskBundle = buildLoopRiskBridgeBundle(panels.ladderTone, {
      familyText: panels.ladderFamilyText,
      flowText: panels.ladderFlowText,
      summaryText: panels.ladderSummaryText,
      gateText: panels.ladderGateText,
      leadText: panels.ladderLeadText,
      windowText: panels.ladderWindowText,
      pressureText: panels.ladderPressureText,
      responseText: panels.ladderResponseText,
      attentionText: panels.ladderAttentionText,
      cadenceText: panels.ladderCadenceText,
      focusText: panels.ladderFocusText,
      stateText: panels.ladderStateText,
      stageText: panels.ladderStageText,
      opsText: panels.ladderOpsText,
      signalText: panels.ladderSignalText,
      detailText: panels.ladderDetailText
    });
    panels.ladderRiskCards = ladderRiskBundle.cards;
    panels.ladderRiskBlocks = ladderRiskBundle.blocks;
    panels.ladderFlowPanels = buildLoopFlowFamilyPanels(panels.ladderTone, {
      familyText: panels.ladderFamilyText,
      flowText: panels.ladderFlowText,
      summaryText: panels.ladderSummaryText,
      gateText: panels.ladderGateText,
      leadText: panels.ladderLeadText,
      windowText: panels.ladderWindowText,
      pressureText: panels.ladderPressureText,
      responseText: panels.ladderResponseText,
      attentionText: panels.ladderAttentionText,
      cadenceText: panels.ladderCadenceText,
      focusText: panels.ladderFocusText,
      stateText: panels.ladderStateText,
      stageText: panels.ladderStageText,
      opsText: panels.ladderOpsText,
      signalText: panels.ladderSignalText,
      detailText: panels.ladderDetailText
    }, ["RANK", "STATUS", "PUSH"]);
    panels.ladderRiskPanels = buildLoopRiskPanels(panels.ladderTone, {
      familyText: panels.ladderFamilyText,
      flowText: panels.ladderFlowText,
      summaryText: panels.ladderSummaryText,
      gateText: panels.ladderGateText,
      leadText: panels.ladderLeadText,
      windowText: panels.ladderWindowText,
      pressureText: panels.ladderPressureText,
      responseText: panels.ladderResponseText,
      attentionText: panels.ladderAttentionText,
      cadenceText: panels.ladderCadenceText,
      focusText: panels.ladderFocusText,
      stateText: panels.ladderStateText,
      stageText: panels.ladderStageText,
      opsText: panels.ladderOpsText,
      signalText: panels.ladderSignalText,
      detailText: panels.ladderDetailText
    });
    const ladderSubflowBundle = buildLoopSubflowBundle(panels.ladderTone, {
      familyText: panels.ladderFamilyText,
      flowText: panels.ladderFlowText,
      summaryText: panels.ladderSummaryText,
      gateText: panels.ladderGateText,
      leadText: panels.ladderLeadText,
      windowText: panels.ladderWindowText,
      pressureText: panels.ladderPressureText,
      responseText: panels.ladderResponseText,
      attentionText: panels.ladderAttentionText,
      cadenceText: panels.ladderCadenceText,
      focusText: panels.ladderFocusText,
      stageText: panels.ladderStageText,
      stateText: panels.ladderStateText,
      opsText: panels.ladderOpsText,
      signalText: panels.ladderSignalText,
      detailText: panels.ladderDetailText
    }, LOOP_FAMILY_TITLES.ladder);
    panels.ladderSubflowCards = ladderSubflowBundle.cards;
    panels.ladderSubflowBlocks = ladderSubflowBundle.blocks;
    panels.ladderSubflowPanels = ladderSubflowBundle.panels;
    panels.telemetryFlowCards = telemetryFlowBundle.cards;
    panels.telemetryFlowBlocks = telemetryFlowBundle.blocks;
    const telemetryRiskBundle = buildLoopRiskBridgeBundle(panels.telemetryTone, {
      familyText: panels.telemetryFamilyText,
      flowText: panels.telemetryFlowText,
      summaryText: panels.telemetrySummaryText,
      gateText: panels.telemetryGateText,
      leadText: panels.telemetryLeadText,
      windowText: panels.telemetryWindowText,
      pressureText: panels.telemetryPressureText,
      responseText: panels.telemetryResponseText,
      attentionText: panels.telemetryAttentionText,
      cadenceText: panels.telemetryCadenceText,
      focusText: panels.telemetryFocusText,
      stateText: panels.telemetryStateText,
      stageText: panels.telemetryStageText,
      opsText: panels.telemetryOpsText,
      signalText: panels.telemetrySignalText,
      detailText: panels.telemetryDetailText
    });
    panels.telemetryRiskCards = telemetryRiskBundle.cards;
    panels.telemetryRiskBlocks = telemetryRiskBundle.blocks;
    panels.telemetryFlowPanels = buildLoopFlowFamilyPanels(panels.telemetryTone, {
      familyText: panels.telemetryFamilyText,
      flowText: panels.telemetryFlowText,
      summaryText: panels.telemetrySummaryText,
      gateText: panels.telemetryGateText,
      leadText: panels.telemetryLeadText,
      windowText: panels.telemetryWindowText,
      pressureText: panels.telemetryPressureText,
      responseText: panels.telemetryResponseText,
      attentionText: panels.telemetryAttentionText,
      cadenceText: panels.telemetryCadenceText,
      focusText: panels.telemetryFocusText,
      stateText: panels.telemetryStateText,
      stageText: panels.telemetryStageText,
      opsText: panels.telemetryOpsText,
      signalText: panels.telemetrySignalText,
      detailText: panels.telemetryDetailText
    }, ["SCAN", "STATUS", "TRACE"]);
    panels.telemetryRiskPanels = buildLoopRiskPanels(panels.telemetryTone, {
      familyText: panels.telemetryFamilyText,
      flowText: panels.telemetryFlowText,
      summaryText: panels.telemetrySummaryText,
      gateText: panels.telemetryGateText,
      leadText: panels.telemetryLeadText,
      windowText: panels.telemetryWindowText,
      pressureText: panels.telemetryPressureText,
      responseText: panels.telemetryResponseText,
      attentionText: panels.telemetryAttentionText,
      cadenceText: panels.telemetryCadenceText,
      focusText: panels.telemetryFocusText,
      stateText: panels.telemetryStateText,
      stageText: panels.telemetryStageText,
      opsText: panels.telemetryOpsText,
      signalText: panels.telemetrySignalText,
      detailText: panels.telemetryDetailText
    });
    const telemetrySubflowBundle = buildLoopSubflowBundle(panels.telemetryTone, {
      familyText: panels.telemetryFamilyText,
      flowText: panels.telemetryFlowText,
      summaryText: panels.telemetrySummaryText,
      gateText: panels.telemetryGateText,
      leadText: panels.telemetryLeadText,
      windowText: panels.telemetryWindowText,
      pressureText: panels.telemetryPressureText,
      responseText: panels.telemetryResponseText,
      attentionText: panels.telemetryAttentionText,
      cadenceText: panels.telemetryCadenceText,
      focusText: panels.telemetryFocusText,
      stageText: panels.telemetryStageText,
      stateText: panels.telemetryStateText,
      opsText: panels.telemetryOpsText,
      signalText: panels.telemetrySignalText,
      detailText: panels.telemetryDetailText
    }, LOOP_FAMILY_TITLES.telemetry);
    panels.telemetrySubflowCards = telemetrySubflowBundle.cards;
    panels.telemetrySubflowBlocks = telemetrySubflowBundle.blocks;
    panels.telemetrySubflowPanels = telemetrySubflowBundle.panels;
    panels.duelFlowCards = duelFlowBundle.cards;
    panels.duelFlowBlocks = duelFlowBundle.blocks;
    panels.duelFlowPanels = buildLoopFlowFamilyPanels(panels.duelTone, {
      familyText: panels.duelFamilyText,
      flowText: panels.duelFlowText,
      summaryText: panels.duelSummaryText,
      gateText: panels.duelGateText,
      leadText: panels.duelLeadText,
      windowText: panels.duelWindowText,
      pressureText: panels.duelPressureText,
      responseText: panels.duelResponseText,
      attentionText: panels.duelAttentionText,
      cadenceText: panels.duelCadenceText,
      focusText: panels.duelFocusText,
      stateText: panels.duelStateText,
      stageText: panels.duelStageText,
      opsText: panels.duelOpsText,
      signalText: panels.duelSignalText,
      detailText: panels.duelDetailText
    }, ["STANCE", "STATUS", "RESOLVE"]);
    const duelSubflowBundle = buildLoopSubflowBundle(panels.duelTone, {
      familyText: panels.duelFamilyText,
      flowText: panels.duelFlowText,
      summaryText: panels.duelSummaryText,
      gateText: panels.duelGateText,
      leadText: panels.duelLeadText,
      windowText: panels.duelWindowText,
      pressureText: panels.duelPressureText,
      responseText: panels.duelResponseText,
      attentionText: panels.duelAttentionText,
      cadenceText: panels.duelCadenceText,
      focusText: panels.duelFocusText,
      stageText: panels.duelStageText,
      stateText: panels.duelStateText,
      opsText: panels.duelOpsText,
      signalText: panels.duelSignalText,
      detailText: panels.duelDetailText
    }, LOOP_FAMILY_TITLES.duel);
    panels.duelSubflowCards = duelSubflowBundle.cards;
    panels.duelSubflowBlocks = duelSubflowBundle.blocks;
    panels.duelSubflowPanels = duelSubflowBundle.panels;
    return panels;
  }
  const sharedRows = [...loopDeck.loopRows, ...loopDeck.loopSignalRows];
  const stageValue = toText(loopDeck.stageValue, "--");
  const statusLabel = toText(loopDeck.loopStatusLabel, "IDLE");
  const tickTempo = readLoopRowValue(sharedRows, ["tick_tempo"], "--");
  const diagBand = readLoopRowValue(sharedRows, ["diag_band"], "--");
  const riskBand = readLoopRowValue(sharedRows, ["risk_band"], "--");
  const ladderCharge = readLoopRowValue(sharedRows, ["ladder_charge"], "--");
  const queueDepth = readLoopRowValue(sharedRows, ["queue_depth"], "--");
  const entryLabel = formatRuntimeKeyLabel(loopDeck.entryKindKey, "ENTRY");
  const sequenceLabel = formatRuntimeKeyLabel(loopDeck.sequenceKindKey, "LOOP");
  const microflowLabel = formatRuntimeKeyLabel(loopDeck.microflowKey, "FLOW");
  const microflowRailText = buildLoopMicroflowRailText(loopDeck);
  const personalityLabel = toText(loopDeck.personalityLabel, "");
  const duelPhase = readLoopRowValue(loopDeck.sequenceRows, ["duel_phase"], stageValue);
  const panels = {
    duelText: buildLoopMicroLine(
      "DUEL",
      duelPhase,
      statusLabel
    ),
    ladderText: buildLoopMicroLine(
      "LADDER",
      ladderCharge,
      tickTempo
    ),
    telemetryText: buildLoopMicroLine(
      "TELEMETRY",
      diagBand,
      readLoopRowValue(sharedRows, ["risk_band", "tick_tempo"], "--")
    ),
    duelTone: resolveLoopFamilyTone(statusLabel, riskBand, duelPhase),
    ladderTone: resolveLoopFamilyTone(ladderCharge, tickTempo, statusLabel, stageValue),
    telemetryTone: resolveLoopFamilyTone(diagBand, riskBand, personalityLabel),
    duelFocusText: buildLoopFocusDetail(
      loopDeck,
      "duel",
      `ENTRY ${entryLabel}`,
      `FOCUS ${microflowLabel}`,
      `PERSONA ${personalityLabel || "SYNC"}`
    ),
    ladderFocusText: buildLoopFocusDetail(loopDeck, "ladder", `SEQ ${sequenceLabel}`, `FOCUS ${microflowLabel}`, `CHARGE ${ladderCharge}`),
    telemetryFocusText: buildLoopFocusDetail(
      loopDeck,
      "telemetry",
      `PERSONA ${personalityLabel || "SYNC"}`,
      `FOCUS ${diagBand}`,
      `FLOW ${microflowLabel}`
    ),
    duelStageText: buildLoopMicroDetail(`STAGE ${duelPhase}`, `STATUS ${statusLabel}`, `FLOW ${microflowLabel}`),
    ladderStageText: buildLoopMicroDetail(`STAGE ${stageValue}`, `STATUS ${statusLabel}`, `FLOW ${microflowLabel}`),
    telemetryStageText: buildLoopMicroDetail(`STAGE ${stageValue}`, `STATUS ${statusLabel}`, `SEQ ${sequenceLabel}`),
    duelOpsText: buildLoopMicroDetail(`ENTRY ${entryLabel}`, `STATUS ${statusLabel}`, `QUEUE ${queueDepth}`),
    ladderOpsText: buildLoopMicroDetail(`SEQ ${sequenceLabel}`, `CHARGE ${ladderCharge}`, `TICK ${tickTempo}`),
    telemetryOpsText: buildLoopMicroDetail(
      `PERSONA ${personalityLabel || "SYNC"}`,
      `DIAG ${diagBand}`,
      `RISK ${riskBand}`
    ),
    duelStateText: buildLoopMicroDetail(
      `FLOW ${microflowLabel}`,
      `ENTRY ${entryLabel}`,
      `PHASE ${duelPhase}`
    ),
    ladderStateText: buildLoopMicroDetail(`FLOW ${microflowLabel}`, `SEQ ${sequenceLabel}`, `STAGE ${stageValue}`),
    telemetryStateText: buildLoopMicroDetail(
      `FLOW ${microflowLabel}`,
      `PERSONA ${personalityLabel || "SYNC"}`,
      `SEQ ${sequenceLabel}`
    ),
    duelSignalText: buildLoopMicroDetail(
      `QUEUE ${queueDepth}`,
      `FLOW ${statusLabel}`,
      `RISK ${riskBand}`
    ),
    ladderSignalText: buildLoopMicroDetail(`CHARGE ${ladderCharge}`, `TICK ${tickTempo}`, `FLOW ${microflowLabel}`),
    telemetrySignalText: buildLoopMicroDetail(`DIAG ${diagBand}`, `RISK ${riskBand}`, `FLOW ${microflowLabel}`),
    duelDetailText: buildLoopMicroDetail(
      `QUEUE ${queueDepth}`,
      `RISK ${riskBand}`,
      entryLabel
    ),
    duelFamilyText: buildLoopMicroDetail(`FLOW ${microflowLabel}`, `STATUS ${statusLabel}`, `STAGE ${duelPhase}`),
    duelFlowText: buildLoopMicroDetail(
      `ENTRY ${entryLabel}`,
      `SEQ ${sequenceLabel}`,
      `PERSONA ${personalityLabel || "SYNC"}`
    ),
    duelSummaryText: buildLoopMicroDetail(`FLOW ${microflowLabel}`, `STATUS ${statusLabel}`, `PERSONA ${personalityLabel || "SYNC"}`),
    duelGateText: buildLoopMicroDetail(
      `QUEUE ${queueDepth}`,
      `RISK ${riskBand}`,
      `ENTRY ${entryLabel}`
    ),
    duelLeadText: buildLoopMicroDetail(`ENTRY ${entryLabel}`, `FLOW ${microflowLabel}`, sequenceLabel),
    duelWindowText: buildLoopMicroDetail(`PHASE ${duelPhase}`, `STATUS ${statusLabel}`, `PERSONA ${personalityLabel || "SYNC"}`),
    duelPressureText: buildLoopMicroDetail(
      `QUEUE ${queueDepth}`,
      `RISK ${riskBand}`,
      `DIAG ${diagBand}`
    ),
    duelResponseText: buildLoopMicroDetail(`PHASE ${duelPhase}`, `FLOW ${statusLabel}`, `ENTRY ${entryLabel}`),
    duelMicroflowText: microflowRailText,
    duelCards: buildLoopBridgeCards(
      buildLoopBridgeCard("PHASE", `${duelPhase} | ${statusLabel}`, resolveLoopFamilyTone(duelPhase, statusLabel), `FLOW ${microflowLabel}`),
      buildLoopBridgeCard("QUEUE", `Q ${queueDepth} | RISK ${riskBand}`, resolveLoopFamilyTone(queueDepth, riskBand), `ENTRY ${entryLabel}`),
      buildLoopBridgeCard(
        "PERSONA",
        `${personalityLabel || "SYNC"} | ${entryLabel}`,
        resolveLoopFamilyTone(personalityLabel || "SYNC", entryLabel),
        `SEQ ${sequenceLabel}`
      )
    ),
    duelBlocks: buildLoopBridgeBlocks(
      buildLoopBridgeBlock(
        "FLOW",
        buildLoopMicroDetail(`FLOW ${microflowLabel}`, `STATUS ${statusLabel}`, `STAGE ${duelPhase}`),
        buildLoopMicroDetail(`ENTRY ${entryLabel}`, `SEQ ${sequenceLabel}`, `PERSONA ${personalityLabel || "SYNC"}`),
        resolveLoopFamilyTone(duelPhase, statusLabel, personalityLabel),
        buildLoopMicroDetail(`PHASE ${duelPhase}`, `QUEUE ${queueDepth}`, `RISK ${riskBand}`)
      ),
      buildLoopBridgeBlock(
        "GATE",
        buildLoopMicroDetail(`QUEUE ${queueDepth}`, `RISK ${riskBand}`, `ENTRY ${entryLabel}`),
        buildLoopMicroDetail(`PHASE ${duelPhase}`, `FLOW ${statusLabel}`, `ENTRY ${entryLabel}`),
        resolveLoopFamilyTone(queueDepth, riskBand, statusLabel),
        buildLoopMicroDetail(`WINDOW ${duelPhase}`, `PERSONA ${personalityLabel || "SYNC"}`, `DIAG ${diagBand}`)
      ),
      buildLoopBridgeBlock(
        "ATTN",
        buildLoopAttentionDetail(`RISK ${riskBand}`, `QUEUE ${queueDepth}`, `PHASE ${duelPhase}`),
        buildLoopCadenceDetail(`ENTRY ${entryLabel}`, `FLOW ${microflowLabel}`, `PERSONA ${personalityLabel || "SYNC"}`),
        resolveLoopFamilyTone(riskBand, queueDepth, diagBand),
        buildLoopMicroDetail(`DIAG ${diagBand}`, `SEQ ${sequenceLabel}`, `FLOW ${microflowLabel}`)
      )
    ),
    ladderFamilyText: buildLoopMicroDetail(`FLOW ${microflowLabel}`, `STATUS ${statusLabel}`, `CHARGE ${ladderCharge}`),
    ladderFlowText: buildLoopMicroDetail(`SEQ ${sequenceLabel}`, `FLOW ${microflowLabel}`, `CHARGE ${ladderCharge}`),
    ladderSummaryText: buildLoopMicroDetail(`CHARGE ${ladderCharge}`, `TICK ${tickTempo}`, `FLOW ${microflowLabel}`),
    ladderGateText: buildLoopMicroDetail(`CHARGE ${ladderCharge}`, `ENTRY ${entryLabel}`, `STATUS ${statusLabel}`),
    ladderLeadText: buildLoopMicroDetail(`SEQ ${sequenceLabel}`, `FLOW ${microflowLabel}`, `TICK ${tickTempo}`),
    ladderWindowText: buildLoopMicroDetail(`CHARGE ${ladderCharge}`, `TICK ${tickTempo}`, `STATUS ${statusLabel}`),
    ladderPressureText: buildLoopMicroDetail(`CHARGE ${ladderCharge}`, `TICK ${tickTempo}`, `RISK ${riskBand}`),
    ladderResponseText: buildLoopMicroDetail(`TICK ${tickTempo}`, `FLOW ${statusLabel}`, `SEQ ${sequenceLabel}`),
    ladderAttentionText: buildLoopAttentionDetail(`CHARGE ${ladderCharge}`, `TICK ${tickTempo}`, `FLOW ${microflowLabel}`),
    ladderCadenceText: buildLoopCadenceDetail(`SEQ ${sequenceLabel}`, `FLOW ${microflowLabel}`, `CHARGE ${ladderCharge}`),
    ladderMicroflowText: microflowRailText,
    ladderDetailText: buildLoopMicroDetail(`CHARGE ${ladderCharge}`, `TICK ${tickTempo}`, sequenceLabel),
    telemetryFamilyText: buildLoopMicroDetail(`FLOW ${microflowLabel}`, `STATUS ${statusLabel}`, `DIAG ${diagBand}`),
    telemetryFlowText: buildLoopMicroDetail(`PERSONA ${personalityLabel || "SYNC"}`, `SEQ ${sequenceLabel}`, `FLOW ${microflowLabel}`),
    telemetrySummaryText: buildLoopMicroDetail(`DIAG ${diagBand}`, `RISK ${riskBand}`, `FLOW ${microflowLabel}`),
    telemetryGateText: buildLoopMicroDetail(`DIAG ${diagBand}`, `ENTRY ${entryLabel}`, `STATUS ${statusLabel}`),
    telemetryLeadText: buildLoopMicroDetail(`PERSONA ${personalityLabel || "SYNC"}`, `FLOW ${microflowLabel}`, `DIAG ${diagBand}`),
    telemetryWindowText: buildLoopMicroDetail(`DIAG ${diagBand}`, `RISK ${riskBand}`, `STATUS ${statusLabel}`),
    telemetryPressureText: buildLoopMicroDetail(`DIAG ${diagBand}`, `RISK ${riskBand}`, `QUEUE ${queueDepth}`),
    telemetryResponseText: buildLoopMicroDetail(`DIAG ${diagBand}`, `FLOW ${statusLabel}`, `PERSONA ${personalityLabel || "SYNC"}`),
    telemetryAttentionText: buildLoopAttentionDetail(`DIAG ${diagBand}`, `RISK ${riskBand}`, `FLOW ${microflowLabel}`),
    telemetryCadenceText: buildLoopCadenceDetail(`PERSONA ${personalityLabel || "SYNC"}`, `FLOW ${microflowLabel}`, `SEQ ${sequenceLabel}`),
    telemetryMicroflowText: microflowRailText,
    telemetryDetailText: buildLoopMicroDetail(`DIAG ${diagBand}`, `RISK ${riskBand}`, personalityLabel),
    duelAttentionText: buildLoopAttentionDetail(`RISK ${riskBand}`, `QUEUE ${readLoopRowValue(sharedRows, ["queue_depth"], "--")}`, `PHASE ${duelPhase}`),
    duelCadenceText: buildLoopCadenceDetail(`ENTRY ${entryLabel}`, `FLOW ${microflowLabel}`, `PERSONA ${personalityLabel || "SYNC"}`)
  };
  const ladderBundle = buildLoopFamilyBridgeBundle(panels.ladderTone, {
    familyText: panels.ladderFamilyText,
    flowText: panels.ladderFlowText,
    summaryText: panels.ladderSummaryText,
    gateText: panels.ladderGateText,
    windowText: panels.ladderWindowText,
    pressureText: panels.ladderPressureText,
    responseText: panels.ladderResponseText,
    attentionText: panels.ladderAttentionText,
    cadenceText: panels.ladderCadenceText
  });
  const telemetryBundle = buildLoopFamilyBridgeBundle(panels.telemetryTone, {
    familyText: panels.telemetryFamilyText,
    flowText: panels.telemetryFlowText,
    summaryText: panels.telemetrySummaryText,
    gateText: panels.telemetryGateText,
    windowText: panels.telemetryWindowText,
    pressureText: panels.telemetryPressureText,
    responseText: panels.telemetryResponseText,
    attentionText: panels.telemetryAttentionText,
    cadenceText: panels.telemetryCadenceText
  });
  const duelFlowBundle = buildLoopFlowFamilyBridgeBundle(panels.duelTone, {
    entryKindKey: loopDeck.entryKindKey,
    sequenceKindKey: loopDeck.sequenceKindKey,
    microflowKey: loopDeck.microflowKey,
    focusKey: loopDeck.focusKey,
    riskKey: loopDeck.riskKey,
    riskFocusKey: loopDeck.riskFocusKey,
    protocolPodKey: loopDeck.protocolPodKey,
    familyText: panels.duelFamilyText,
    flowText: panels.duelFlowText,
    summaryText: panels.duelSummaryText,
    gateText: panels.duelGateText,
    leadText: panels.duelLeadText,
    windowText: panels.duelWindowText,
    pressureText: panels.duelPressureText,
    responseText: panels.duelResponseText,
    attentionText: panels.duelAttentionText,
    cadenceText: panels.duelCadenceText,
    focusText: panels.duelFocusText,
    stageText: panels.duelStageText,
    stateText: panels.duelStateText,
    opsText: panels.duelOpsText,
    signalText: panels.duelSignalText,
    detailText: panels.duelDetailText
  }, LOOP_FAMILY_TITLES.duel);
  const ladderFlowBundle = buildLoopFlowFamilyBridgeBundle(panels.ladderTone, {
    familyText: panels.ladderFamilyText,
    flowText: panels.ladderFlowText,
    summaryText: panels.ladderSummaryText,
    gateText: panels.ladderGateText,
    leadText: panels.ladderLeadText,
    windowText: panels.ladderWindowText,
    pressureText: panels.ladderPressureText,
    responseText: panels.ladderResponseText,
    attentionText: panels.ladderAttentionText,
    cadenceText: panels.ladderCadenceText,
    focusText: panels.ladderFocusText,
    stageText: panels.ladderStageText,
    stateText: panels.ladderStateText,
    opsText: panels.ladderOpsText,
    signalText: panels.ladderSignalText,
    detailText: panels.ladderDetailText
  }, LOOP_FAMILY_TITLES.ladder);
  const telemetryFlowBundle = buildLoopFlowFamilyBridgeBundle(panels.telemetryTone, {
    familyText: panels.telemetryFamilyText,
    flowText: panels.telemetryFlowText,
    summaryText: panels.telemetrySummaryText,
    gateText: panels.telemetryGateText,
    leadText: panels.telemetryLeadText,
    windowText: panels.telemetryWindowText,
    pressureText: panels.telemetryPressureText,
    responseText: panels.telemetryResponseText,
    attentionText: panels.telemetryAttentionText,
    cadenceText: panels.telemetryCadenceText,
    focusText: panels.telemetryFocusText,
    stageText: panels.telemetryStageText,
    stateText: panels.telemetryStateText,
    opsText: panels.telemetryOpsText,
    signalText: panels.telemetrySignalText,
    detailText: panels.telemetryDetailText
  }, LOOP_FAMILY_TITLES.telemetry);
  panels.ladderCards = ladderBundle.cards;
  panels.ladderBlocks = ladderBundle.blocks;
  panels.telemetryCards = telemetryBundle.cards;
  panels.telemetryBlocks = telemetryBundle.blocks;
  panels.ladderFlowCards = ladderFlowBundle.cards;
  panels.ladderFlowBlocks = ladderFlowBundle.blocks;
  const ladderRiskBundle = buildLoopRiskBridgeBundle(panels.ladderTone, {
    familyText: panels.ladderFamilyText,
    flowText: panels.ladderFlowText,
    summaryText: panels.ladderSummaryText,
    gateText: panels.ladderGateText,
    leadText: panels.ladderLeadText,
    windowText: panels.ladderWindowText,
    pressureText: panels.ladderPressureText,
    responseText: panels.ladderResponseText,
    attentionText: panels.ladderAttentionText,
    cadenceText: panels.ladderCadenceText,
    focusText: panels.ladderFocusText,
    stateText: panels.ladderStateText,
    stageText: panels.ladderStageText,
    opsText: panels.ladderOpsText,
    signalText: panels.ladderSignalText,
    detailText: panels.ladderDetailText
  });
  panels.ladderRiskCards = ladderRiskBundle.cards;
  panels.ladderRiskBlocks = ladderRiskBundle.blocks;
  panels.ladderFlowPanels = buildLoopFlowFamilyPanels(panels.ladderTone, {
    familyText: panels.ladderFamilyText,
    flowText: panels.ladderFlowText,
    summaryText: panels.ladderSummaryText,
    gateText: panels.ladderGateText,
    leadText: panels.ladderLeadText,
    windowText: panels.ladderWindowText,
    pressureText: panels.ladderPressureText,
    responseText: panels.ladderResponseText,
    attentionText: panels.ladderAttentionText,
    cadenceText: panels.ladderCadenceText,
    focusText: panels.ladderFocusText,
    stateText: panels.ladderStateText,
    stageText: panels.ladderStageText,
    opsText: panels.ladderOpsText,
    signalText: panels.ladderSignalText,
    detailText: panels.ladderDetailText
  }, ["RANK", "STATUS", "PUSH"]);
  panels.ladderRiskPanels = buildLoopRiskPanels(panels.ladderTone, {
    familyText: panels.ladderFamilyText,
    flowText: panels.ladderFlowText,
    summaryText: panels.ladderSummaryText,
    gateText: panels.ladderGateText,
    leadText: panels.ladderLeadText,
    windowText: panels.ladderWindowText,
    pressureText: panels.ladderPressureText,
    responseText: panels.ladderResponseText,
    attentionText: panels.ladderAttentionText,
    cadenceText: panels.ladderCadenceText,
    focusText: panels.ladderFocusText,
    stateText: panels.ladderStateText,
    stageText: panels.ladderStageText,
    opsText: panels.ladderOpsText,
    signalText: panels.ladderSignalText,
    detailText: panels.ladderDetailText
  });
  const ladderSubflowBundle = buildLoopSubflowBundle(panels.ladderTone, {
    familyText: panels.ladderFamilyText,
    flowText: panels.ladderFlowText,
    summaryText: panels.ladderSummaryText,
    gateText: panels.ladderGateText,
    leadText: panels.ladderLeadText,
    windowText: panels.ladderWindowText,
    pressureText: panels.ladderPressureText,
    responseText: panels.ladderResponseText,
    attentionText: panels.ladderAttentionText,
    cadenceText: panels.ladderCadenceText,
    focusText: panels.ladderFocusText,
    stageText: panels.ladderStageText,
    stateText: panels.ladderStateText,
    opsText: panels.ladderOpsText,
    signalText: panels.ladderSignalText,
    detailText: panels.ladderDetailText
  }, LOOP_FAMILY_TITLES.ladder);
  panels.ladderSubflowCards = ladderSubflowBundle.cards;
  panels.ladderSubflowBlocks = ladderSubflowBundle.blocks;
  panels.ladderSubflowPanels = ladderSubflowBundle.panels;
  panels.telemetryFlowCards = telemetryFlowBundle.cards;
  panels.telemetryFlowBlocks = telemetryFlowBundle.blocks;
  const telemetryRiskBundle = buildLoopRiskBridgeBundle(panels.telemetryTone, {
    familyText: panels.telemetryFamilyText,
    flowText: panels.telemetryFlowText,
    summaryText: panels.telemetrySummaryText,
    gateText: panels.telemetryGateText,
    leadText: panels.telemetryLeadText,
    windowText: panels.telemetryWindowText,
    pressureText: panels.telemetryPressureText,
    responseText: panels.telemetryResponseText,
    attentionText: panels.telemetryAttentionText,
    cadenceText: panels.telemetryCadenceText,
    focusText: panels.telemetryFocusText,
    stateText: panels.telemetryStateText,
    stageText: panels.telemetryStageText,
    opsText: panels.telemetryOpsText,
    signalText: panels.telemetrySignalText,
    detailText: panels.telemetryDetailText
  });
  panels.telemetryRiskCards = telemetryRiskBundle.cards;
  panels.telemetryRiskBlocks = telemetryRiskBundle.blocks;
  panels.telemetryFlowPanels = buildLoopFlowFamilyPanels(panels.telemetryTone, {
    familyText: panels.telemetryFamilyText,
    flowText: panels.telemetryFlowText,
    summaryText: panels.telemetrySummaryText,
    gateText: panels.telemetryGateText,
    leadText: panels.telemetryLeadText,
    windowText: panels.telemetryWindowText,
    pressureText: panels.telemetryPressureText,
    responseText: panels.telemetryResponseText,
    attentionText: panels.telemetryAttentionText,
    cadenceText: panels.telemetryCadenceText,
    focusText: panels.telemetryFocusText,
    stateText: panels.telemetryStateText,
    stageText: panels.telemetryStageText,
    opsText: panels.telemetryOpsText,
    signalText: panels.telemetrySignalText,
    detailText: panels.telemetryDetailText
  }, ["SCAN", "STATUS", "TRACE"]);
  panels.telemetryRiskPanels = buildLoopRiskPanels(panels.telemetryTone, {
    familyText: panels.telemetryFamilyText,
    flowText: panels.telemetryFlowText,
    summaryText: panels.telemetrySummaryText,
    gateText: panels.telemetryGateText,
    leadText: panels.telemetryLeadText,
    windowText: panels.telemetryWindowText,
    pressureText: panels.telemetryPressureText,
    responseText: panels.telemetryResponseText,
    attentionText: panels.telemetryAttentionText,
    cadenceText: panels.telemetryCadenceText,
    focusText: panels.telemetryFocusText,
    stateText: panels.telemetryStateText,
    stageText: panels.telemetryStageText,
    opsText: panels.telemetryOpsText,
    signalText: panels.telemetrySignalText,
    detailText: panels.telemetryDetailText
  });
  const telemetrySubflowBundle = buildLoopSubflowBundle(panels.telemetryTone, {
    familyText: panels.telemetryFamilyText,
    flowText: panels.telemetryFlowText,
    summaryText: panels.telemetrySummaryText,
    gateText: panels.telemetryGateText,
    leadText: panels.telemetryLeadText,
    windowText: panels.telemetryWindowText,
    pressureText: panels.telemetryPressureText,
    responseText: panels.telemetryResponseText,
    attentionText: panels.telemetryAttentionText,
    cadenceText: panels.telemetryCadenceText,
    focusText: panels.telemetryFocusText,
    stageText: panels.telemetryStageText,
    stateText: panels.telemetryStateText,
    opsText: panels.telemetryOpsText,
    signalText: panels.telemetrySignalText,
    detailText: panels.telemetryDetailText
  }, LOOP_FAMILY_TITLES.telemetry);
  panels.telemetrySubflowCards = telemetrySubflowBundle.cards;
  panels.telemetrySubflowBlocks = telemetrySubflowBundle.blocks;
  panels.telemetrySubflowPanels = telemetrySubflowBundle.panels;
  panels.duelFlowCards = duelFlowBundle.cards;
  panels.duelFlowBlocks = duelFlowBundle.blocks;
  const duelRiskBundle = buildLoopRiskBridgeBundle(panels.duelTone, {
    familyText: panels.duelFamilyText,
    flowText: panels.duelFlowText,
    summaryText: panels.duelSummaryText,
    gateText: panels.duelGateText,
    leadText: panels.duelLeadText,
    windowText: panels.duelWindowText,
    pressureText: panels.duelPressureText,
    responseText: panels.duelResponseText,
    attentionText: panels.duelAttentionText,
    cadenceText: panels.duelCadenceText,
    focusText: panels.duelFocusText,
    stateText: panels.duelStateText,
    stageText: panels.duelStageText,
    opsText: panels.duelOpsText,
    signalText: panels.duelSignalText,
    detailText: panels.duelDetailText
  });
  panels.duelRiskCards = duelRiskBundle.cards;
  panels.duelRiskBlocks = duelRiskBundle.blocks;
  panels.duelFlowPanels = buildLoopFlowFamilyPanels(panels.duelTone, {
    familyText: panels.duelFamilyText,
    flowText: panels.duelFlowText,
    summaryText: panels.duelSummaryText,
    gateText: panels.duelGateText,
    leadText: panels.duelLeadText,
    windowText: panels.duelWindowText,
    pressureText: panels.duelPressureText,
    responseText: panels.duelResponseText,
    attentionText: panels.duelAttentionText,
    cadenceText: panels.duelCadenceText,
    focusText: panels.duelFocusText,
    stateText: panels.duelStateText,
    stageText: panels.duelStageText,
    opsText: panels.duelOpsText,
    signalText: panels.duelSignalText,
    detailText: panels.duelDetailText
  }, ["STANCE", "STATUS", "RESOLVE"]);
  panels.duelRiskPanels = buildLoopRiskPanels(panels.duelTone, {
    familyText: panels.duelFamilyText,
    flowText: panels.duelFlowText,
    summaryText: panels.duelSummaryText,
    gateText: panels.duelGateText,
    leadText: panels.duelLeadText,
    windowText: panels.duelWindowText,
    pressureText: panels.duelPressureText,
    responseText: panels.duelResponseText,
    attentionText: panels.duelAttentionText,
    cadenceText: panels.duelCadenceText,
    focusText: panels.duelFocusText,
    stateText: panels.duelStateText,
    stageText: panels.duelStageText,
    opsText: panels.duelOpsText,
    signalText: panels.duelSignalText,
    detailText: panels.duelDetailText
  });
  const duelSubflowBundle = buildLoopSubflowBundle(panels.duelTone, {
    familyText: panels.duelFamilyText,
    flowText: panels.duelFlowText,
    summaryText: panels.duelSummaryText,
    gateText: panels.duelGateText,
    leadText: panels.duelLeadText,
    windowText: panels.duelWindowText,
    pressureText: panels.duelPressureText,
    responseText: panels.duelResponseText,
    attentionText: panels.duelAttentionText,
    cadenceText: panels.duelCadenceText,
    focusText: panels.duelFocusText,
    stageText: panels.duelStageText,
    stateText: panels.duelStateText,
    opsText: panels.duelOpsText,
    signalText: panels.duelSignalText,
    detailText: panels.duelDetailText
  }, LOOP_FAMILY_TITLES.duel);
  panels.duelSubflowCards = duelSubflowBundle.cards;
  panels.duelSubflowBlocks = duelSubflowBundle.blocks;
  panels.duelSubflowPanels = duelSubflowBundle.panels;
  return panels;
}

function buildVaultLoopMicroPanels(loopDeck, active) {
  setCurrentLoopAssetContext(loopDeck);
  if (!active) {
    const panels = {
      walletText: "WALLET | WAIT",
      payoutText: "PAYOUT | WAIT",
      routeText: "ROUTE | WAIT",
      premiumText: "PREMIUM | WAIT",
      walletTone: "neutral",
      payoutTone: "neutral",
      routeTone: "neutral",
      premiumTone: "neutral",
      walletFocusText: "ENTRY WAIT | FOCUS WAIT | FLOW WAIT",
      payoutFocusText: "SEQ WAIT | FOCUS WAIT | ROUTE --",
      routeFocusText: "PERSONA WAIT | FOCUS -- | FLOW WAIT",
      premiumFocusText: "ENTRY WAIT | FOCUS WAIT | FLOW WAIT",
      walletStageText: "STAGE -- | STATUS -- | ENTRY WAIT",
      payoutStageText: "STAGE -- | STATUS -- | SEQ WAIT",
      routeStageText: "STAGE -- | STATUS -- | PERSONA WAIT",
      premiumStageText: "STAGE -- | STATUS -- | PASS --",
      walletOpsText: "ENTRY WAIT | STATE -- | FLOW WAIT",
      payoutOpsText: "SEQ WAIT | PAYOUT -- | ROUTE --",
      routeOpsText: "PERSONA WAIT | ROUTE -- | FLOW WAIT",
      premiumOpsText: "ENTRY WAIT | PASS -- | STAGE --",
      walletStateText: "FLOW WAIT | ENTRY WAIT | STATE --",
      payoutStateText: "FLOW WAIT | SEQ WAIT | PAYOUT --",
      routeStateText: "FLOW WAIT | PERSONA WAIT | ROUTE --",
      premiumStateText: "FLOW WAIT | STAGE -- | PASS --",
      walletSignalText: "STATE -- | FLOW WAIT | ENTRY WAIT",
      payoutSignalText: "PAYOUT -- | ROUTE -- | FLOW WAIT",
      routeSignalText: "ROUTE -- | PERSONA WAIT | FLOW WAIT",
      premiumSignalText: "PASS -- | STAGE -- | FLOW WAIT",
      walletDetailText: "Wallet verification detay bekleniyor.",
      payoutDetailText: "Payout route detay bekleniyor.",
      routeDetailText: "Route quorum detay bekleniyor.",
      premiumDetailText: "Premium lane detay bekleniyor.",
      walletFamilyText: "PAYOUT FLOW | WAIT | STATE --",
      walletFlowText: "ENTRY WAIT | SEQ WAIT | ROUTE --",
      walletSummaryText: "FLOW WAIT | STATUS -- | PERSONA --",
      walletGateText: "STATE -- | ROUTE -- | ENTRY WAIT",
      walletLeadText: "ENTRY WAIT | FLOW WAIT | SEQ WAIT",
      walletWindowText: "STATE -- | PAYOUT -- | ROUTE --",
      walletPressureText: "STATE -- | ROUTE -- | PASS --",
      walletResponseText: "PAYOUT -- | FLOW WAIT | ENTRY WAIT",
      walletAttentionText: "STATE -- | ENTRY WAIT | FLOW WAIT",
      walletCadenceText: "ENTRY WAIT | FLOW WAIT | PERSONA --",
      walletMicroflowText: "MICRO WAIT | POD --",
      walletCards: buildLoopBridgeCards(
        buildLoopBridgeCard("WALLET", "STATE -- | FLOW WAIT", "neutral"),
        buildLoopBridgeCard("PAYOUT", "PAYOUT -- | ROUTE --", "neutral"),
        buildLoopBridgeCard("ROUTE", "ROUTE -- | ENTRY WAIT", "neutral")
      ),
      walletBlocks: buildLoopBridgeBlocks(
        buildLoopBridgeBlock("FLOW", "WAIT | STATUS --", "ENTRY WAIT | SEQ WAIT", "neutral", "ROUTE --"),
        buildLoopBridgeBlock("GATE", "STATE -- | ROUTE --", "PAYOUT -- | FLOW WAIT", "neutral", "PASS --"),
        buildLoopBridgeBlock("ATTN", "STATE -- | ENTRY WAIT", "CADENCE --", "neutral", "PERSONA --")
      ),
      payoutFamilyText: "FLOW WAIT | STATUS -- | PAYOUT --",
      payoutFlowText: "SEQ WAIT | FLOW WAIT | ROUTE --",
      payoutSummaryText: "PAYOUT -- | ROUTE -- | FLOW WAIT",
      payoutGateText: "PAYOUT -- | ENTRY WAIT | STATUS --",
      payoutLeadText: "SEQ WAIT | FLOW WAIT | PAYOUT --",
      payoutWindowText: "PAYOUT -- | ROUTE -- | STATUS --",
      payoutPressureText: "PAYOUT -- | ROUTE -- | PASS --",
      payoutResponseText: "PAYOUT -- | FLOW WAIT | SEQ WAIT",
      payoutAttentionText: "PAYOUT -- | ROUTE -- | FLOW WAIT",
      payoutCadenceText: "SEQ WAIT | FLOW WAIT | PAYOUT --",
      payoutMicroflowText: "MICRO WAIT | POD --",
      routeFamilyText: "FLOW WAIT | STATUS -- | ROUTE --",
      routeFlowText: "PERSONA WAIT | FLOW WAIT | SEQ WAIT",
      routeSummaryText: "ROUTE -- | WALLET -- | FLOW WAIT",
      routeGateText: "ROUTE -- | ENTRY WAIT | STATUS --",
      routeLeadText: "PERSONA WAIT | FLOW WAIT | ROUTE --",
      routeWindowText: "ROUTE -- | WALLET -- | STATUS --",
      routePressureText: "ROUTE -- | PAYOUT -- | PASS --",
      routeResponseText: "ROUTE -- | FLOW WAIT | PERSONA WAIT",
      routeAttentionText: "ROUTE -- | WALLET -- | FLOW WAIT",
      routeCadenceText: "PERSONA WAIT | FLOW WAIT | ROUTE --",
      routeMicroflowText: "MICRO WAIT | POD --",
      premiumFamilyText: "FLOW WAIT | STATUS -- | PASS --",
      premiumFlowText: "ENTRY WAIT | FLOW WAIT | STAGE --",
      premiumSummaryText: "PASS -- | STAGE -- | FLOW WAIT",
      premiumGateText: "PASS -- | ENTRY WAIT | STATUS --",
      premiumLeadText: "ENTRY WAIT | FLOW WAIT | PASS --",
      premiumWindowText: "PASS -- | STAGE -- | STATUS --",
      premiumPressureText: "PASS -- | PAYOUT -- | ROUTE --",
      premiumResponseText: "PASS -- | FLOW WAIT | ENTRY WAIT",
      premiumAttentionText: "PASS -- | STAGE -- | FLOW WAIT",
      premiumCadenceText: "ENTRY WAIT | FLOW WAIT | PASS --",
      premiumMicroflowText: "MICRO WAIT | POD --"
    };
    const payoutBundle = buildLoopFamilyBridgeBundle(panels.payoutTone, {
      familyText: panels.payoutFamilyText,
      flowText: panels.payoutFlowText,
      summaryText: panels.payoutSummaryText,
      gateText: panels.payoutGateText,
      windowText: panels.payoutWindowText,
      pressureText: panels.payoutPressureText,
      responseText: panels.payoutResponseText,
      attentionText: panels.payoutAttentionText,
      cadenceText: panels.payoutCadenceText
    });
    const routeBundle = buildLoopFamilyBridgeBundle(panels.routeTone, {
      familyText: panels.routeFamilyText,
      flowText: panels.routeFlowText,
      summaryText: panels.routeSummaryText,
      gateText: panels.routeGateText,
      windowText: panels.routeWindowText,
      pressureText: panels.routePressureText,
      responseText: panels.routeResponseText,
      attentionText: panels.routeAttentionText,
      cadenceText: panels.routeCadenceText
    });
    const premiumBundle = buildLoopFamilyBridgeBundle(panels.premiumTone, {
      familyText: panels.premiumFamilyText,
      flowText: panels.premiumFlowText,
      summaryText: panels.premiumSummaryText,
      gateText: panels.premiumGateText,
      windowText: panels.premiumWindowText,
      pressureText: panels.premiumPressureText,
      responseText: panels.premiumResponseText,
      attentionText: panels.premiumAttentionText,
      cadenceText: panels.premiumCadenceText
    });
    const walletFlowBundle = buildLoopFlowFamilyBridgeBundle(panels.walletTone, {
      familyText: panels.walletFamilyText,
      flowText: panels.walletFlowText,
      summaryText: panels.walletSummaryText,
      gateText: panels.walletGateText,
      leadText: panels.walletLeadText,
      windowText: panels.walletWindowText,
      pressureText: panels.walletPressureText,
      responseText: panels.walletResponseText,
      attentionText: panels.walletAttentionText,
      cadenceText: panels.walletCadenceText,
      focusText: panels.walletFocusText,
      stageText: panels.walletStageText,
      stateText: panels.walletStateText,
      opsText: panels.walletOpsText,
      signalText: panels.walletSignalText,
      detailText: panels.walletDetailText
    }, LOOP_FAMILY_TITLES.wallet);
    const payoutFlowBundle = buildLoopFlowFamilyBridgeBundle(panels.payoutTone, {
      familyText: panels.payoutFamilyText,
      flowText: panels.payoutFlowText,
      summaryText: panels.payoutSummaryText,
      gateText: panels.payoutGateText,
      leadText: panels.payoutLeadText,
      windowText: panels.payoutWindowText,
      pressureText: panels.payoutPressureText,
      responseText: panels.payoutResponseText,
      attentionText: panels.payoutAttentionText,
      cadenceText: panels.payoutCadenceText,
      focusText: panels.payoutFocusText,
      stageText: panels.payoutStageText,
      stateText: panels.payoutStateText,
      opsText: panels.payoutOpsText,
      signalText: panels.payoutSignalText,
      detailText: panels.payoutDetailText
    }, LOOP_FAMILY_TITLES.payout);
    const routeFlowBundle = buildLoopFlowFamilyBridgeBundle(panels.routeTone, {
      familyText: panels.routeFamilyText,
      flowText: panels.routeFlowText,
      summaryText: panels.routeSummaryText,
      gateText: panels.routeGateText,
      leadText: panels.routeLeadText,
      windowText: panels.routeWindowText,
      pressureText: panels.routePressureText,
      responseText: panels.routeResponseText,
      attentionText: panels.routeAttentionText,
      cadenceText: panels.routeCadenceText,
      focusText: panels.routeFocusText,
      stageText: panels.routeStageText,
      stateText: panels.routeStateText,
      opsText: panels.routeOpsText,
      signalText: panels.routeSignalText,
      detailText: panels.routeDetailText
    }, LOOP_FAMILY_TITLES.route);
    const premiumFlowBundle = buildLoopFlowFamilyBridgeBundle(panels.premiumTone, {
      familyText: panels.premiumFamilyText,
      flowText: panels.premiumFlowText,
      summaryText: panels.premiumSummaryText,
      gateText: panels.premiumGateText,
      leadText: panels.premiumLeadText,
      windowText: panels.premiumWindowText,
      pressureText: panels.premiumPressureText,
      responseText: panels.premiumResponseText,
      attentionText: panels.premiumAttentionText,
      cadenceText: panels.premiumCadenceText,
      focusText: panels.premiumFocusText,
      stageText: panels.premiumStageText,
      stateText: panels.premiumStateText,
      opsText: panels.premiumOpsText,
      signalText: panels.premiumSignalText,
      detailText: panels.premiumDetailText
    }, LOOP_FAMILY_TITLES.premium);
    panels.payoutCards = payoutBundle.cards;
    panels.payoutBlocks = payoutBundle.blocks;
    panels.routeCards = routeBundle.cards;
    panels.routeBlocks = routeBundle.blocks;
    panels.premiumCards = premiumBundle.cards;
    panels.premiumBlocks = premiumBundle.blocks;
    panels.payoutFlowCards = payoutFlowBundle.cards;
    panels.payoutFlowBlocks = payoutFlowBundle.blocks;
    panels.payoutFlowPanels = buildLoopFlowFamilyPanels(panels.payoutTone, {
      familyText: panels.payoutFamilyText,
      flowText: panels.payoutFlowText,
      summaryText: panels.payoutSummaryText,
      gateText: panels.payoutGateText,
      leadText: panels.payoutLeadText,
      windowText: panels.payoutWindowText,
      pressureText: panels.payoutPressureText,
      responseText: panels.payoutResponseText,
      attentionText: panels.payoutAttentionText,
      cadenceText: panels.payoutCadenceText,
      focusText: panels.payoutFocusText,
      stateText: panels.payoutStateText,
      stageText: panels.payoutStageText,
      opsText: panels.payoutOpsText,
      signalText: panels.payoutSignalText,
      detailText: panels.payoutDetailText
    }, ["REQUEST", "STATE", "PROOF"]);
    const payoutSubflowBundle = buildLoopSubflowBundle(panels.payoutTone, {
      familyText: panels.payoutFamilyText,
      flowText: panels.payoutFlowText,
      summaryText: panels.payoutSummaryText,
      gateText: panels.payoutGateText,
      leadText: panels.payoutLeadText,
      windowText: panels.payoutWindowText,
      pressureText: panels.payoutPressureText,
      responseText: panels.payoutResponseText,
      attentionText: panels.payoutAttentionText,
      cadenceText: panels.payoutCadenceText,
      focusText: panels.payoutFocusText,
      stageText: panels.payoutStageText,
      stateText: panels.payoutStateText,
      opsText: panels.payoutOpsText,
      signalText: panels.payoutSignalText,
      detailText: panels.payoutDetailText
    }, LOOP_FAMILY_TITLES.payout);
    panels.payoutSubflowCards = payoutSubflowBundle.cards;
    panels.payoutSubflowBlocks = payoutSubflowBundle.blocks;
    panels.payoutSubflowPanels = payoutSubflowBundle.panels;
    panels.routeFlowCards = routeFlowBundle.cards;
    panels.routeFlowBlocks = routeFlowBundle.blocks;
    panels.routeFlowPanels = buildLoopFlowFamilyPanels(panels.routeTone, {
      familyText: panels.routeFamilyText,
      flowText: panels.routeFlowText,
      summaryText: panels.routeSummaryText,
      gateText: panels.routeGateText,
      leadText: panels.routeLeadText,
      windowText: panels.routeWindowText,
      pressureText: panels.routePressureText,
      responseText: panels.routeResponseText,
      attentionText: panels.routeAttentionText,
      cadenceText: panels.routeCadenceText,
      focusText: panels.routeFocusText,
      stateText: panels.routeStateText,
      stageText: panels.routeStageText,
      opsText: panels.routeOpsText,
      signalText: panels.routeSignalText,
      detailText: panels.routeDetailText
    }, ["ROUTE", "STATE", "COVERAGE"]);
    const routeSubflowBundle = buildLoopSubflowBundle(panels.routeTone, {
      familyText: panels.routeFamilyText,
      flowText: panels.routeFlowText,
      summaryText: panels.routeSummaryText,
      gateText: panels.routeGateText,
      leadText: panels.routeLeadText,
      windowText: panels.routeWindowText,
      pressureText: panels.routePressureText,
      responseText: panels.routeResponseText,
      attentionText: panels.routeAttentionText,
      cadenceText: panels.routeCadenceText,
      focusText: panels.routeFocusText,
      stageText: panels.routeStageText,
      stateText: panels.routeStateText,
      opsText: panels.routeOpsText,
      signalText: panels.routeSignalText,
      detailText: panels.routeDetailText
    }, LOOP_FAMILY_TITLES.route);
    panels.routeSubflowCards = routeSubflowBundle.cards;
    panels.routeSubflowBlocks = routeSubflowBundle.blocks;
    panels.routeSubflowPanels = routeSubflowBundle.panels;
    panels.premiumFlowCards = premiumFlowBundle.cards;
    panels.premiumFlowBlocks = premiumFlowBundle.blocks;
    panels.premiumFlowPanels = buildLoopFlowFamilyPanels(panels.premiumTone, {
      familyText: panels.premiumFamilyText,
      flowText: panels.premiumFlowText,
      summaryText: panels.premiumSummaryText,
      gateText: panels.premiumGateText,
      leadText: panels.premiumLeadText,
      windowText: panels.premiumWindowText,
      pressureText: panels.premiumPressureText,
      responseText: panels.premiumResponseText,
      attentionText: panels.premiumAttentionText,
      cadenceText: panels.premiumCadenceText,
      focusText: panels.premiumFocusText,
      stateText: panels.premiumStateText,
      stageText: panels.premiumStageText,
      opsText: panels.premiumOpsText,
      signalText: panels.premiumSignalText,
      detailText: panels.premiumDetailText
    }, ["PASS", "STATE", "PERK"]);
    const premiumSubflowBundle = buildLoopSubflowBundle(panels.premiumTone, {
      familyText: panels.premiumFamilyText,
      flowText: panels.premiumFlowText,
      summaryText: panels.premiumSummaryText,
      gateText: panels.premiumGateText,
      leadText: panels.premiumLeadText,
      windowText: panels.premiumWindowText,
      pressureText: panels.premiumPressureText,
      responseText: panels.premiumResponseText,
      attentionText: panels.premiumAttentionText,
      cadenceText: panels.premiumCadenceText,
      focusText: panels.premiumFocusText,
      stageText: panels.premiumStageText,
      stateText: panels.premiumStateText,
      opsText: panels.premiumOpsText,
      signalText: panels.premiumSignalText,
      detailText: panels.premiumDetailText
    }, LOOP_FAMILY_TITLES.premium);
    panels.premiumSubflowCards = premiumSubflowBundle.cards;
    panels.premiumSubflowBlocks = premiumSubflowBundle.blocks;
    panels.premiumSubflowPanels = premiumSubflowBundle.panels;
    panels.walletFlowCards = walletFlowBundle.cards;
    panels.walletFlowBlocks = walletFlowBundle.blocks;
    panels.walletFlowPanels = buildLoopFlowFamilyPanels(panels.walletTone, {
      familyText: panels.walletFamilyText,
      flowText: panels.walletFlowText,
      summaryText: panels.walletSummaryText,
      gateText: panels.walletGateText,
      leadText: panels.walletLeadText,
      windowText: panels.walletWindowText,
      pressureText: panels.walletPressureText,
      responseText: panels.walletResponseText,
      attentionText: panels.walletAttentionText,
      cadenceText: panels.walletCadenceText,
      focusText: panels.walletFocusText,
      stateText: panels.walletStateText,
      stageText: panels.walletStageText,
      opsText: panels.walletOpsText,
      signalText: panels.walletSignalText,
      detailText: panels.walletDetailText
    });
    const walletSubflowBundle = buildLoopSubflowBundle(panels.walletTone, {
      familyText: panels.walletFamilyText,
      flowText: panels.walletFlowText,
      summaryText: panels.walletSummaryText,
      gateText: panels.walletGateText,
      leadText: panels.walletLeadText,
      windowText: panels.walletWindowText,
      pressureText: panels.walletPressureText,
      responseText: panels.walletResponseText,
      attentionText: panels.walletAttentionText,
      cadenceText: panels.walletCadenceText,
      focusText: panels.walletFocusText,
      stageText: panels.walletStageText,
      stateText: panels.walletStateText,
      opsText: panels.walletOpsText,
      signalText: panels.walletSignalText,
      detailText: panels.walletDetailText
    }, LOOP_FAMILY_TITLES.wallet);
    panels.walletSubflowCards = walletSubflowBundle.cards;
    panels.walletSubflowBlocks = walletSubflowBundle.blocks;
    panels.walletSubflowPanels = walletSubflowBundle.panels;
    return panels;
  }
  const sharedRows = [...loopDeck.loopRows, ...loopDeck.loopSignalRows];
  const walletState = readLoopRowValue(sharedRows, ["wallet_state"], loopDeck.stageValue || "--");
  const payoutState = readLoopRowValue(sharedRows, ["payout_state"], "--");
  const routeState = readLoopRowValue(sharedRows, ["route_state"], "--");
  const premiumState = readLoopRowValue(sharedRows, ["premium_state"], "--");
  const entryLabel = formatRuntimeKeyLabel(loopDeck.entryKindKey, "ENTRY");
  const sequenceLabel = formatRuntimeKeyLabel(loopDeck.sequenceKindKey, "LOOP");
  const microflowLabel = formatRuntimeKeyLabel(loopDeck.microflowKey, "FLOW");
  const microflowRailText = buildLoopMicroflowRailText(loopDeck);
  const personalityCaption = toText(loopDeck.personalityCaption, "");
  const stageValue = toText(loopDeck.stageValue || loopDeck.loopStatusLabel || "--", "--");
  const loopStatusLabel = toText(loopDeck.loopStatusLabel || "IDLE", "IDLE");
  const panels = {
    walletText: buildLoopMicroLine("WALLET", walletState, loopStatusLabel),
    payoutText: buildLoopMicroLine("PAYOUT", payoutState, routeState),
    routeText: buildLoopMicroLine("ROUTE", routeState, walletState),
    premiumText: buildLoopMicroLine("PREMIUM", premiumState, stageValue),
    walletTone: resolveLoopFamilyTone(walletState, loopStatusLabel),
    payoutTone: resolveLoopFamilyTone(payoutState, routeState, stageValue),
    routeTone: resolveLoopFamilyTone(routeState, personalityCaption, loopStatusLabel),
    premiumTone: resolveLoopFamilyTone(premiumState, stageValue, loopStatusLabel),
    walletFocusText: buildLoopFocusDetail(loopDeck, "wallet", `ENTRY ${entryLabel}`, `FOCUS ${walletState}`, `FLOW ${microflowLabel}`),
    payoutFocusText: buildLoopFocusDetail(loopDeck, "payout", `SEQ ${sequenceLabel}`, `FOCUS ${payoutState}`, `ROUTE ${routeState}`),
    routeFocusText: buildLoopFocusDetail(
      loopDeck,
      "route",
      `PERSONA ${personalityCaption || "SYNC"}`,
      `FOCUS ${routeState}`,
      `FLOW ${microflowLabel}`
    ),
    premiumFocusText: buildLoopFocusDetail(loopDeck, "premium", `ENTRY ${entryLabel}`, `FOCUS ${premiumState}`, `FLOW ${microflowLabel}`),
    walletStageText: buildLoopMicroDetail(`STAGE ${stageValue}`, `STATUS ${loopStatusLabel}`, `ENTRY ${entryLabel}`),
    payoutStageText: buildLoopMicroDetail(`STAGE ${stageValue}`, `STATUS ${loopStatusLabel}`, `SEQ ${sequenceLabel}`),
    routeStageText: buildLoopMicroDetail(
      `STAGE ${stageValue}`,
      `STATUS ${loopStatusLabel}`,
      `PERSONA ${personalityCaption || "SYNC"}`
    ),
    premiumStageText: buildLoopMicroDetail(`STAGE ${stageValue}`, `STATUS ${loopStatusLabel}`, `PASS ${premiumState}`),
    walletOpsText: buildLoopMicroDetail(`ENTRY ${entryLabel}`, `STATE ${walletState}`, `FLOW ${loopStatusLabel}`),
    payoutOpsText: buildLoopMicroDetail(`SEQ ${sequenceLabel}`, `PAYOUT ${payoutState}`, `ROUTE ${routeState}`),
    routeOpsText: buildLoopMicroDetail(
      `PERSONA ${personalityCaption || "SYNC"}`,
      `ROUTE ${routeState}`,
      `FLOW ${microflowLabel}`
    ),
    premiumOpsText: buildLoopMicroDetail(
      `ENTRY ${entryLabel}`,
      `PASS ${premiumState}`,
      `STAGE ${stageValue}`
    ),
    walletStateText: buildLoopMicroDetail(`FLOW ${microflowLabel}`, `ENTRY ${entryLabel}`, `STATE ${walletState}`),
    payoutStateText: buildLoopMicroDetail(`FLOW ${microflowLabel}`, `SEQ ${sequenceLabel}`, `PAYOUT ${payoutState}`),
    routeStateText: buildLoopMicroDetail(
      `FLOW ${microflowLabel}`,
      `PERSONA ${personalityCaption || "SYNC"}`,
      `ROUTE ${routeState}`
    ),
    premiumStateText: buildLoopMicroDetail(
      `FLOW ${microflowLabel}`,
      `STAGE ${stageValue}`,
      `PASS ${premiumState}`
    ),
    walletSignalText: buildLoopMicroDetail(`STATE ${walletState}`, `FLOW ${loopStatusLabel}`, `ENTRY ${entryLabel}`),
    payoutSignalText: buildLoopMicroDetail(`PAYOUT ${payoutState}`, `ROUTE ${routeState}`, `FLOW ${microflowLabel}`),
    routeSignalText: buildLoopMicroDetail(
      `ROUTE ${routeState}`,
      `PERSONA ${personalityCaption || "SYNC"}`,
      `FLOW ${microflowLabel}`
    ),
    premiumSignalText: buildLoopMicroDetail(
      `PASS ${premiumState}`,
      `STAGE ${stageValue}`,
      `FLOW ${microflowLabel}`
    ),
    walletDetailText: buildLoopMicroDetail(`STATE ${walletState}`, `FLOW ${loopStatusLabel}`, entryLabel),
    payoutDetailText: buildLoopMicroDetail(`PAYOUT ${payoutState}`, `ROUTE ${routeState}`, sequenceLabel),
    routeDetailText: buildLoopMicroDetail(`ROUTE ${routeState}`, `WALLET ${walletState}`, personalityCaption),
    premiumDetailText: buildLoopMicroDetail(
      `PASS ${premiumState}`,
      `STAGE ${stageValue}`,
      entryLabel
    ),
    walletFamilyText: buildLoopMicroDetail(`FLOW ${microflowLabel}`, `STATUS ${loopStatusLabel}`, `STATE ${walletState}`),
    walletFlowText: buildLoopMicroDetail(`ENTRY ${entryLabel}`, `SEQ ${sequenceLabel}`, `ROUTE ${routeState}`),
    walletSummaryText: buildLoopMicroDetail(
      `FLOW ${microflowLabel}`,
      `STATUS ${loopStatusLabel}`,
      `PERSONA ${personalityCaption || "SYNC"}`
    ),
    walletGateText: buildLoopMicroDetail(`STATE ${walletState}`, `ROUTE ${routeState}`, `ENTRY ${entryLabel}`),
    walletLeadText: buildLoopMicroDetail(`ENTRY ${entryLabel}`, `FLOW ${microflowLabel}`, sequenceLabel),
    walletWindowText: buildLoopMicroDetail(`STATE ${walletState}`, `PAYOUT ${payoutState}`, `ROUTE ${routeState}`),
    walletPressureText: buildLoopMicroDetail(`STATE ${walletState}`, `ROUTE ${routeState}`, `PASS ${premiumState}`),
    walletResponseText: buildLoopMicroDetail(`PAYOUT ${payoutState}`, `FLOW ${loopStatusLabel}`, `ENTRY ${entryLabel}`),
    walletAttentionText: buildLoopAttentionDetail(`STATE ${walletState}`, `ENTRY ${entryLabel}`, `FLOW ${loopStatusLabel}`),
    walletCadenceText: buildLoopCadenceDetail(`ENTRY ${entryLabel}`, `FLOW ${microflowLabel}`, `PERSONA ${personalityCaption || "SYNC"}`),
    walletMicroflowText: microflowRailText,
    walletCards: buildLoopBridgeCards(
      buildLoopBridgeCard("WALLET", `${walletState} | ${loopStatusLabel}`, resolveLoopFamilyTone(walletState, loopStatusLabel), `ENTRY ${entryLabel}`),
      buildLoopBridgeCard("PAYOUT", `${payoutState} | ${routeState}`, resolveLoopFamilyTone(payoutState, routeState), `SEQ ${sequenceLabel}`),
      buildLoopBridgeCard("ROUTE", `${routeState} | ${entryLabel}`, resolveLoopFamilyTone(routeState, entryLabel), `FLOW ${microflowLabel}`)
    ),
    walletBlocks: buildLoopBridgeBlocks(
      buildLoopBridgeBlock(
        "FLOW",
        buildLoopMicroDetail(`FLOW ${microflowLabel}`, `STATUS ${loopStatusLabel}`, `STATE ${walletState}`),
        buildLoopMicroDetail(`ENTRY ${entryLabel}`, `SEQ ${sequenceLabel}`, `ROUTE ${routeState}`),
        resolveLoopFamilyTone(walletState, loopStatusLabel, routeState),
        buildLoopMicroDetail(`PAYOUT ${payoutState}`, `PASS ${premiumState}`, `PERSONA ${personalityCaption || "SYNC"}`)
      ),
      buildLoopBridgeBlock(
        "GATE",
        buildLoopMicroDetail(`STATE ${walletState}`, `ROUTE ${routeState}`, `ENTRY ${entryLabel}`),
        buildLoopMicroDetail(`PAYOUT ${payoutState}`, `FLOW ${loopStatusLabel}`, `ENTRY ${entryLabel}`),
        resolveLoopFamilyTone(routeState, payoutState, walletState),
        buildLoopMicroDetail(`WINDOW ${walletState}`, `PAYOUT ${payoutState}`, `ROUTE ${routeState}`)
      ),
      buildLoopBridgeBlock(
        "ATTN",
        buildLoopAttentionDetail(`STATE ${walletState}`, `ENTRY ${entryLabel}`, `FLOW ${loopStatusLabel}`),
        buildLoopCadenceDetail(`ENTRY ${entryLabel}`, `FLOW ${microflowLabel}`, `PERSONA ${personalityCaption || "SYNC"}`),
        resolveLoopFamilyTone(walletState, premiumState, routeState),
        buildLoopMicroDetail(`PASS ${premiumState}`, `SEQ ${sequenceLabel}`, `FLOW ${microflowLabel}`)
      )
    ),
    payoutFamilyText: buildLoopMicroDetail(`FLOW ${microflowLabel}`, `STATUS ${loopStatusLabel}`, `PAYOUT ${payoutState}`),
    payoutFlowText: buildLoopMicroDetail(`SEQ ${sequenceLabel}`, `FLOW ${microflowLabel}`, `ROUTE ${routeState}`),
    payoutSummaryText: buildLoopMicroDetail(`PAYOUT ${payoutState}`, `ROUTE ${routeState}`, `FLOW ${microflowLabel}`),
    payoutGateText: buildLoopMicroDetail(`PAYOUT ${payoutState}`, `ENTRY ${entryLabel}`, `STATUS ${loopStatusLabel}`),
    payoutLeadText: buildLoopMicroDetail(`SEQ ${sequenceLabel}`, `FLOW ${microflowLabel}`, `PAYOUT ${payoutState}`),
    payoutWindowText: buildLoopMicroDetail(`PAYOUT ${payoutState}`, `ROUTE ${routeState}`, `STATUS ${loopStatusLabel}`),
    payoutPressureText: buildLoopMicroDetail(`PAYOUT ${payoutState}`, `ROUTE ${routeState}`, `PASS ${premiumState}`),
    payoutResponseText: buildLoopMicroDetail(`PAYOUT ${payoutState}`, `FLOW ${loopStatusLabel}`, `SEQ ${sequenceLabel}`),
    payoutAttentionText: buildLoopAttentionDetail(`PAYOUT ${payoutState}`, `ROUTE ${routeState}`, `FLOW ${microflowLabel}`),
    payoutCadenceText: buildLoopCadenceDetail(`SEQ ${sequenceLabel}`, `FLOW ${microflowLabel}`, `PAYOUT ${payoutState}`),
    payoutMicroflowText: microflowRailText,
    routeFamilyText: buildLoopMicroDetail(`FLOW ${microflowLabel}`, `STATUS ${loopStatusLabel}`, `ROUTE ${routeState}`),
    routeFlowText: buildLoopMicroDetail(`PERSONA ${personalityCaption || "SYNC"}`, `FLOW ${microflowLabel}`, `SEQ ${sequenceLabel}`),
    routeSummaryText: buildLoopMicroDetail(`ROUTE ${routeState}`, `WALLET ${walletState}`, `FLOW ${microflowLabel}`),
    routeGateText: buildLoopMicroDetail(`ROUTE ${routeState}`, `ENTRY ${entryLabel}`, `STATUS ${loopStatusLabel}`),
    routeLeadText: buildLoopMicroDetail(`PERSONA ${personalityCaption || "SYNC"}`, `FLOW ${microflowLabel}`, `ROUTE ${routeState}`),
    routeWindowText: buildLoopMicroDetail(`ROUTE ${routeState}`, `WALLET ${walletState}`, `STATUS ${loopStatusLabel}`),
    routePressureText: buildLoopMicroDetail(`ROUTE ${routeState}`, `PAYOUT ${payoutState}`, `PASS ${premiumState}`),
    routeResponseText: buildLoopMicroDetail(`ROUTE ${routeState}`, `FLOW ${loopStatusLabel}`, `PERSONA ${personalityCaption || "SYNC"}`),
    routeAttentionText: buildLoopAttentionDetail(`ROUTE ${routeState}`, `WALLET ${walletState}`, `FLOW ${microflowLabel}`),
    routeCadenceText: buildLoopCadenceDetail(`PERSONA ${personalityCaption || "SYNC"}`, `FLOW ${microflowLabel}`, `ROUTE ${routeState}`),
    routeMicroflowText: microflowRailText,
    premiumFamilyText: buildLoopMicroDetail(`FLOW ${microflowLabel}`, `STATUS ${loopStatusLabel}`, `PASS ${premiumState}`),
    premiumFlowText: buildLoopMicroDetail(`ENTRY ${entryLabel}`, `FLOW ${microflowLabel}`, `STAGE ${stageValue}`),
    premiumSummaryText: buildLoopMicroDetail(`PASS ${premiumState}`, `STAGE ${stageValue}`, `FLOW ${microflowLabel}`),
    premiumGateText: buildLoopMicroDetail(`PASS ${premiumState}`, `ENTRY ${entryLabel}`, `STATUS ${loopStatusLabel}`),
    premiumLeadText: buildLoopMicroDetail(`ENTRY ${entryLabel}`, `FLOW ${microflowLabel}`, `PASS ${premiumState}`),
    premiumWindowText: buildLoopMicroDetail(`PASS ${premiumState}`, `STAGE ${stageValue}`, `STATUS ${loopStatusLabel}`),
    premiumPressureText: buildLoopMicroDetail(`PASS ${premiumState}`, `PAYOUT ${payoutState}`, `ROUTE ${routeState}`),
    premiumResponseText: buildLoopMicroDetail(`PASS ${premiumState}`, `FLOW ${loopStatusLabel}`, `ENTRY ${entryLabel}`),
    premiumAttentionText: buildLoopAttentionDetail(`PASS ${premiumState}`, `STAGE ${stageValue}`, `FLOW ${microflowLabel}`),
    premiumCadenceText: buildLoopCadenceDetail(`ENTRY ${entryLabel}`, `FLOW ${microflowLabel}`, `PASS ${premiumState}`),
    premiumMicroflowText: microflowRailText
  };
  const payoutBundle = buildLoopFamilyBridgeBundle(panels.payoutTone, {
    familyText: panels.payoutFamilyText,
    flowText: panels.payoutFlowText,
    summaryText: panels.payoutSummaryText,
    gateText: panels.payoutGateText,
    windowText: panels.payoutWindowText,
    pressureText: panels.payoutPressureText,
    responseText: panels.payoutResponseText,
    attentionText: panels.payoutAttentionText,
    cadenceText: panels.payoutCadenceText
  });
  const routeBundle = buildLoopFamilyBridgeBundle(panels.routeTone, {
    familyText: panels.routeFamilyText,
    flowText: panels.routeFlowText,
    summaryText: panels.routeSummaryText,
    gateText: panels.routeGateText,
    windowText: panels.routeWindowText,
    pressureText: panels.routePressureText,
    responseText: panels.routeResponseText,
    attentionText: panels.routeAttentionText,
    cadenceText: panels.routeCadenceText
  });
  const premiumBundle = buildLoopFamilyBridgeBundle(panels.premiumTone, {
    familyText: panels.premiumFamilyText,
    flowText: panels.premiumFlowText,
    summaryText: panels.premiumSummaryText,
    gateText: panels.premiumGateText,
    windowText: panels.premiumWindowText,
    pressureText: panels.premiumPressureText,
    responseText: panels.premiumResponseText,
    attentionText: panels.premiumAttentionText,
    cadenceText: panels.premiumCadenceText
  });
  const walletFlowBundle = buildLoopFlowFamilyBridgeBundle(panels.walletTone, {
    familyText: panels.walletFamilyText,
    flowText: panels.walletFlowText,
    summaryText: panels.walletSummaryText,
    gateText: panels.walletGateText,
    leadText: panels.walletLeadText,
    windowText: panels.walletWindowText,
    pressureText: panels.walletPressureText,
    responseText: panels.walletResponseText,
    attentionText: panels.walletAttentionText,
    cadenceText: panels.walletCadenceText,
    focusText: panels.walletFocusText,
    stageText: panels.walletStageText,
    stateText: panels.walletStateText,
    opsText: panels.walletOpsText,
    signalText: panels.walletSignalText,
    detailText: panels.walletDetailText
  }, LOOP_FAMILY_TITLES.wallet);
  const payoutFlowBundle = buildLoopFlowFamilyBridgeBundle(panels.payoutTone, {
    familyText: panels.payoutFamilyText,
    flowText: panels.payoutFlowText,
    summaryText: panels.payoutSummaryText,
    gateText: panels.payoutGateText,
    leadText: panels.payoutLeadText,
    windowText: panels.payoutWindowText,
    pressureText: panels.payoutPressureText,
    responseText: panels.payoutResponseText,
    attentionText: panels.payoutAttentionText,
    cadenceText: panels.payoutCadenceText,
    focusText: panels.payoutFocusText,
    stageText: panels.payoutStageText,
    stateText: panels.payoutStateText,
    opsText: panels.payoutOpsText,
    signalText: panels.payoutSignalText,
    detailText: panels.payoutDetailText
  }, LOOP_FAMILY_TITLES.payout);
  const routeFlowBundle = buildLoopFlowFamilyBridgeBundle(panels.routeTone, {
    familyText: panels.routeFamilyText,
    flowText: panels.routeFlowText,
    summaryText: panels.routeSummaryText,
    gateText: panels.routeGateText,
    leadText: panels.routeLeadText,
    windowText: panels.routeWindowText,
    pressureText: panels.routePressureText,
    responseText: panels.routeResponseText,
    attentionText: panels.routeAttentionText,
    cadenceText: panels.routeCadenceText,
    focusText: panels.routeFocusText,
    stageText: panels.routeStageText,
    stateText: panels.routeStateText,
    opsText: panels.routeOpsText,
    signalText: panels.routeSignalText,
    detailText: panels.routeDetailText
  }, LOOP_FAMILY_TITLES.route);
  const premiumFlowBundle = buildLoopFlowFamilyBridgeBundle(panels.premiumTone, {
    familyText: panels.premiumFamilyText,
    flowText: panels.premiumFlowText,
    summaryText: panels.premiumSummaryText,
    gateText: panels.premiumGateText,
    leadText: panels.premiumLeadText,
    windowText: panels.premiumWindowText,
    pressureText: panels.premiumPressureText,
    responseText: panels.premiumResponseText,
    attentionText: panels.premiumAttentionText,
    cadenceText: panels.premiumCadenceText,
    focusText: panels.premiumFocusText,
    stageText: panels.premiumStageText,
    stateText: panels.premiumStateText,
    opsText: panels.premiumOpsText,
    signalText: panels.premiumSignalText,
    detailText: panels.premiumDetailText
  }, LOOP_FAMILY_TITLES.premium);
  panels.payoutCards = payoutBundle.cards;
  panels.payoutBlocks = payoutBundle.blocks;
  panels.routeCards = routeBundle.cards;
  panels.routeBlocks = routeBundle.blocks;
  panels.premiumCards = premiumBundle.cards;
  panels.premiumBlocks = premiumBundle.blocks;
  panels.payoutFlowCards = payoutFlowBundle.cards;
  panels.payoutFlowBlocks = payoutFlowBundle.blocks;
  panels.payoutFlowPanels = buildLoopFlowFamilyPanels(panels.payoutTone, {
    familyText: panels.payoutFamilyText,
    flowText: panels.payoutFlowText,
    summaryText: panels.payoutSummaryText,
    gateText: panels.payoutGateText,
    leadText: panels.payoutLeadText,
    windowText: panels.payoutWindowText,
    pressureText: panels.payoutPressureText,
    responseText: panels.payoutResponseText,
    attentionText: panels.payoutAttentionText,
    cadenceText: panels.payoutCadenceText,
    focusText: panels.payoutFocusText,
    stateText: panels.payoutStateText,
    stageText: panels.payoutStageText,
    opsText: panels.payoutOpsText,
    signalText: panels.payoutSignalText,
    detailText: panels.payoutDetailText
  }, ["REQUEST", "STATE", "PROOF"]);
  const payoutSubflowBundle = buildLoopSubflowBundle(panels.payoutTone, {
    familyText: panels.payoutFamilyText,
    flowText: panels.payoutFlowText,
    summaryText: panels.payoutSummaryText,
    gateText: panels.payoutGateText,
    leadText: panels.payoutLeadText,
    windowText: panels.payoutWindowText,
    pressureText: panels.payoutPressureText,
    responseText: panels.payoutResponseText,
    attentionText: panels.payoutAttentionText,
    cadenceText: panels.payoutCadenceText,
    focusText: panels.payoutFocusText,
    stageText: panels.payoutStageText,
    stateText: panels.payoutStateText,
    opsText: panels.payoutOpsText,
    signalText: panels.payoutSignalText,
    detailText: panels.payoutDetailText
  }, LOOP_FAMILY_TITLES.payout);
  panels.payoutSubflowCards = payoutSubflowBundle.cards;
  panels.payoutSubflowBlocks = payoutSubflowBundle.blocks;
  panels.payoutSubflowPanels = payoutSubflowBundle.panels;
  panels.routeFlowCards = routeFlowBundle.cards;
  panels.routeFlowBlocks = routeFlowBundle.blocks;
  panels.routeFlowPanels = buildLoopFlowFamilyPanels(panels.routeTone, {
    familyText: panels.routeFamilyText,
    flowText: panels.routeFlowText,
    summaryText: panels.routeSummaryText,
    gateText: panels.routeGateText,
    leadText: panels.routeLeadText,
    windowText: panels.routeWindowText,
    pressureText: panels.routePressureText,
    responseText: panels.routeResponseText,
    attentionText: panels.routeAttentionText,
    cadenceText: panels.routeCadenceText,
    focusText: panels.routeFocusText,
    stateText: panels.routeStateText,
    stageText: panels.routeStageText,
    opsText: panels.routeOpsText,
    signalText: panels.routeSignalText,
    detailText: panels.routeDetailText
  }, ["ROUTE", "STATE", "COVERAGE"]);
  const routeSubflowBundle = buildLoopSubflowBundle(panels.routeTone, {
    familyText: panels.routeFamilyText,
    flowText: panels.routeFlowText,
    summaryText: panels.routeSummaryText,
    gateText: panels.routeGateText,
    leadText: panels.routeLeadText,
    windowText: panels.routeWindowText,
    pressureText: panels.routePressureText,
    responseText: panels.routeResponseText,
    attentionText: panels.routeAttentionText,
    cadenceText: panels.routeCadenceText,
    focusText: panels.routeFocusText,
    stageText: panels.routeStageText,
    stateText: panels.routeStateText,
    opsText: panels.routeOpsText,
    signalText: panels.routeSignalText,
    detailText: panels.routeDetailText
  }, LOOP_FAMILY_TITLES.route);
  panels.routeSubflowCards = routeSubflowBundle.cards;
  panels.routeSubflowBlocks = routeSubflowBundle.blocks;
  panels.routeSubflowPanels = routeSubflowBundle.panels;
  panels.premiumFlowCards = premiumFlowBundle.cards;
  panels.premiumFlowBlocks = premiumFlowBundle.blocks;
  panels.premiumFlowPanels = buildLoopFlowFamilyPanels(panels.premiumTone, {
    familyText: panels.premiumFamilyText,
    flowText: panels.premiumFlowText,
    summaryText: panels.premiumSummaryText,
    gateText: panels.premiumGateText,
    leadText: panels.premiumLeadText,
    windowText: panels.premiumWindowText,
    pressureText: panels.premiumPressureText,
    responseText: panels.premiumResponseText,
    attentionText: panels.premiumAttentionText,
    cadenceText: panels.premiumCadenceText,
    focusText: panels.premiumFocusText,
    stateText: panels.premiumStateText,
    stageText: panels.premiumStageText,
    opsText: panels.premiumOpsText,
    signalText: panels.premiumSignalText,
    detailText: panels.premiumDetailText
  }, ["PASS", "STATE", "PERK"]);
  const premiumSubflowBundle = buildLoopSubflowBundle(panels.premiumTone, {
    familyText: panels.premiumFamilyText,
    flowText: panels.premiumFlowText,
    summaryText: panels.premiumSummaryText,
    gateText: panels.premiumGateText,
    leadText: panels.premiumLeadText,
    windowText: panels.premiumWindowText,
    pressureText: panels.premiumPressureText,
    responseText: panels.premiumResponseText,
    attentionText: panels.premiumAttentionText,
    cadenceText: panels.premiumCadenceText,
    focusText: panels.premiumFocusText,
    stageText: panels.premiumStageText,
    stateText: panels.premiumStateText,
    opsText: panels.premiumOpsText,
    signalText: panels.premiumSignalText,
    detailText: panels.premiumDetailText
  }, LOOP_FAMILY_TITLES.premium);
  panels.premiumSubflowCards = premiumSubflowBundle.cards;
  panels.premiumSubflowBlocks = premiumSubflowBundle.blocks;
  panels.premiumSubflowPanels = premiumSubflowBundle.panels;
  panels.walletFlowCards = walletFlowBundle.cards;
  panels.walletFlowBlocks = walletFlowBundle.blocks;
  const walletRiskBundle = buildLoopRiskBridgeBundle(panels.walletTone, {
    familyText: panels.walletFamilyText,
    flowText: panels.walletFlowText,
    summaryText: panels.walletSummaryText,
    gateText: panels.walletGateText,
    leadText: panels.walletLeadText,
    windowText: panels.walletWindowText,
    pressureText: panels.walletPressureText,
    responseText: panels.walletResponseText,
    attentionText: panels.walletAttentionText,
    cadenceText: panels.walletCadenceText,
    focusText: panels.walletFocusText,
    stateText: panels.walletStateText,
    stageText: panels.walletStageText,
    opsText: panels.walletOpsText,
    signalText: panels.walletSignalText,
    detailText: panels.walletDetailText
  }, ["LINK", "STATE", "ROUTE"]);
  panels.walletRiskCards = walletRiskBundle.cards;
  panels.walletRiskBlocks = walletRiskBundle.blocks;
  panels.walletFlowPanels = buildLoopFlowFamilyPanels(panels.walletTone, {
    familyText: panels.walletFamilyText,
    flowText: panels.walletFlowText,
    summaryText: panels.walletSummaryText,
    gateText: panels.walletGateText,
    leadText: panels.walletLeadText,
    windowText: panels.walletWindowText,
    pressureText: panels.walletPressureText,
    responseText: panels.walletResponseText,
    attentionText: panels.walletAttentionText,
    cadenceText: panels.walletCadenceText,
    focusText: panels.walletFocusText,
    stateText: panels.walletStateText,
    stageText: panels.walletStageText,
    opsText: panels.walletOpsText,
    signalText: panels.walletSignalText,
    detailText: panels.walletDetailText
  }, ["LINK", "STATE", "ROUTE"]);
  panels.walletRiskPanels = buildLoopRiskPanels(panels.walletTone, {
    familyText: panels.walletFamilyText,
    flowText: panels.walletFlowText,
    summaryText: panels.walletSummaryText,
    gateText: panels.walletGateText,
    leadText: panels.walletLeadText,
    windowText: panels.walletWindowText,
    pressureText: panels.walletPressureText,
    responseText: panels.walletResponseText,
    attentionText: panels.walletAttentionText,
    cadenceText: panels.walletCadenceText,
    focusText: panels.walletFocusText,
    stateText: panels.walletStateText,
    stageText: panels.walletStageText,
    opsText: panels.walletOpsText,
    signalText: panels.walletSignalText,
    detailText: panels.walletDetailText
  }, ["LINK", "STATE", "ROUTE"]);
  const walletSubflowBundle = buildLoopSubflowBundle(panels.walletTone, {
    familyText: panels.walletFamilyText,
    flowText: panels.walletFlowText,
    summaryText: panels.walletSummaryText,
    gateText: panels.walletGateText,
    leadText: panels.walletLeadText,
    windowText: panels.walletWindowText,
    pressureText: panels.walletPressureText,
    responseText: panels.walletResponseText,
    attentionText: panels.walletAttentionText,
    cadenceText: panels.walletCadenceText,
    focusText: panels.walletFocusText,
    stageText: panels.walletStageText,
    stateText: panels.walletStateText,
    opsText: panels.walletOpsText,
    signalText: panels.walletSignalText,
    detailText: panels.walletDetailText
  }, LOOP_FAMILY_TITLES.wallet);
  panels.walletSubflowCards = walletSubflowBundle.cards;
  panels.walletSubflowBlocks = walletSubflowBundle.blocks;
  panels.walletSubflowPanels = walletSubflowBundle.panels;
  const payoutRiskBundle = buildLoopRiskBridgeBundle(panels.payoutTone, {
    familyText: panels.payoutFamilyText,
    flowText: panels.payoutFlowText,
    summaryText: panels.payoutSummaryText,
    gateText: panels.payoutGateText,
    leadText: panels.payoutLeadText,
    windowText: panels.payoutWindowText,
    pressureText: panels.payoutPressureText,
    responseText: panels.payoutResponseText,
    attentionText: panels.payoutAttentionText,
    cadenceText: panels.payoutCadenceText,
    focusText: panels.payoutFocusText,
    stateText: panels.payoutStateText,
    stageText: panels.payoutStageText,
    opsText: panels.payoutOpsText,
    signalText: panels.payoutSignalText,
    detailText: panels.payoutDetailText
  });
  panels.payoutRiskCards = payoutRiskBundle.cards;
  panels.payoutRiskBlocks = payoutRiskBundle.blocks;
  panels.payoutRiskPanels = buildLoopRiskPanels(panels.payoutTone, {
    familyText: panels.payoutFamilyText,
    flowText: panels.payoutFlowText,
    summaryText: panels.payoutSummaryText,
    gateText: panels.payoutGateText,
    leadText: panels.payoutLeadText,
    windowText: panels.payoutWindowText,
    pressureText: panels.payoutPressureText,
    responseText: panels.payoutResponseText,
    attentionText: panels.payoutAttentionText,
    cadenceText: panels.payoutCadenceText,
    focusText: panels.payoutFocusText,
    stateText: panels.payoutStateText,
    stageText: panels.payoutStageText,
    opsText: panels.payoutOpsText,
    signalText: panels.payoutSignalText,
    detailText: panels.payoutDetailText
  });
  const routeRiskBundle = buildLoopRiskBridgeBundle(panels.routeTone, {
    familyText: panels.routeFamilyText,
    flowText: panels.routeFlowText,
    summaryText: panels.routeSummaryText,
    gateText: panels.routeGateText,
    leadText: panels.routeLeadText,
    windowText: panels.routeWindowText,
    pressureText: panels.routePressureText,
    responseText: panels.routeResponseText,
    attentionText: panels.routeAttentionText,
    cadenceText: panels.routeCadenceText,
    focusText: panels.routeFocusText,
    stateText: panels.routeStateText,
    stageText: panels.routeStageText,
    opsText: panels.routeOpsText,
    signalText: panels.routeSignalText,
    detailText: panels.routeDetailText
  });
  panels.routeRiskCards = routeRiskBundle.cards;
  panels.routeRiskBlocks = routeRiskBundle.blocks;
  panels.routeRiskPanels = buildLoopRiskPanels(panels.routeTone, {
    familyText: panels.routeFamilyText,
    flowText: panels.routeFlowText,
    summaryText: panels.routeSummaryText,
    gateText: panels.routeGateText,
    leadText: panels.routeLeadText,
    windowText: panels.routeWindowText,
    pressureText: panels.routePressureText,
    responseText: panels.routeResponseText,
    attentionText: panels.routeAttentionText,
    cadenceText: panels.routeCadenceText,
    focusText: panels.routeFocusText,
    stateText: panels.routeStateText,
    stageText: panels.routeStageText,
    opsText: panels.routeOpsText,
    signalText: panels.routeSignalText,
    detailText: panels.routeDetailText
  });
  const premiumRiskBundle = buildLoopRiskBridgeBundle(panels.premiumTone, {
    familyText: panels.premiumFamilyText,
    flowText: panels.premiumFlowText,
    summaryText: panels.premiumSummaryText,
    gateText: panels.premiumGateText,
    leadText: panels.premiumLeadText,
    windowText: panels.premiumWindowText,
    pressureText: panels.premiumPressureText,
    responseText: panels.premiumResponseText,
    attentionText: panels.premiumAttentionText,
    cadenceText: panels.premiumCadenceText,
    focusText: panels.premiumFocusText,
    stateText: panels.premiumStateText,
    stageText: panels.premiumStageText,
    opsText: panels.premiumOpsText,
    signalText: panels.premiumSignalText,
    detailText: panels.premiumDetailText
  });
  panels.premiumRiskCards = premiumRiskBundle.cards;
  panels.premiumRiskBlocks = premiumRiskBundle.blocks;
  panels.premiumRiskPanels = buildLoopRiskPanels(panels.premiumTone, {
    familyText: panels.premiumFamilyText,
    flowText: panels.premiumFlowText,
    summaryText: panels.premiumSummaryText,
    gateText: panels.premiumGateText,
    leadText: panels.premiumLeadText,
    windowText: panels.premiumWindowText,
    pressureText: panels.premiumPressureText,
    responseText: panels.premiumResponseText,
    attentionText: panels.premiumAttentionText,
    cadenceText: panels.premiumCadenceText,
    focusText: panels.premiumFocusText,
    stateText: panels.premiumStateText,
    stageText: panels.premiumStageText,
    opsText: panels.premiumOpsText,
    signalText: panels.premiumSignalText,
    detailText: panels.premiumDetailText
  });
  return panels;
}

function buildAdminLoopMicroPanels(loopDeck, active) {
  setCurrentLoopAssetContext(loopDeck);
  if (!active) {
    const panels = {
      queueText: "QUEUE | WAIT",
      runtimeText: "RUNTIME | WAIT",
      dispatchText: "DISPATCH | WAIT",
      queueTone: "neutral",
      runtimeTone: "neutral",
      dispatchTone: "neutral",
      queueFocusText: "ENTRY WAIT | FOCUS WAIT | FLOW WAIT",
      runtimeFocusText: "SEQ WAIT | FOCUS WAIT | ALERT --",
      dispatchFocusText: "ENTRY WAIT | FOCUS WAIT | STAGE --",
      queueStageText: "STAGE -- | STATUS -- | ENTRY WAIT",
      runtimeStageText: "STAGE -- | STATUS -- | SEQ WAIT",
      dispatchStageText: "STAGE -- | STATUS -- | SENT --",
      queueOpsText: "ENTRY WAIT | QUEUE -- | FLOW WAIT",
      runtimeOpsText: "SEQ WAIT | HEALTH -- | ALERT --",
      dispatchOpsText: "ENTRY WAIT | SENT -- | STAGE --",
      queueStateText: "FLOW WAIT | ENTRY WAIT | QUEUE --",
      runtimeStateText: "FLOW WAIT | SEQ WAIT | HEALTH --",
      dispatchStateText: "FLOW WAIT | STAGE -- | SENT --",
      queueSignalText: "QUEUE -- | FLOW WAIT | ENTRY WAIT",
      runtimeSignalText: "HEALTH -- | ALERT -- | FLOW WAIT",
      dispatchSignalText: "SENT -- | STAGE -- | FLOW WAIT",
      queueDetailText: "Queue action detay bekleniyor.",
      runtimeDetailText: "Runtime diagnostics bekleniyor.",
      dispatchDetailText: "Dispatch gate detay bekleniyor.",
      dispatchFamilyText: "DISPATCH FLOW | WAIT | ALERT --",
      dispatchFlowText: "ENTRY WAIT | SEQ WAIT | SENT --",
      dispatchSummaryText: "FLOW WAIT | STATUS -- | ALERT --",
      dispatchGateText: "SENT -- | STAGE -- | ENTRY WAIT",
      dispatchLeadText: "ENTRY WAIT | FLOW WAIT | SEQ WAIT",
      dispatchWindowText: "SENT -- | ALERT -- | HEALTH --",
      dispatchPressureText: "ALERT -- | HEALTH -- | QUEUE --",
      dispatchResponseText: "SENT -- | FLOW WAIT | ENTRY WAIT",
      dispatchAttentionText: "ALERT -- | SENT -- | STAGE --",
      dispatchCadenceText: "ENTRY WAIT | FLOW WAIT | SENT --",
      dispatchMicroflowText: "MICRO WAIT | POD --",
      dispatchCards: buildLoopBridgeCards(
        buildLoopBridgeCard("SENT", "0 | STAGE --", "neutral"),
        buildLoopBridgeCard("ALERT", "0 | HEALTH --", "neutral"),
        buildLoopBridgeCard("QUEUE", "0 | ENTRY WAIT", "neutral")
      ),
      dispatchBlocks: buildLoopBridgeBlocks(
        buildLoopBridgeBlock("FLOW", "WAIT | STATUS --", "ENTRY WAIT | SEQ WAIT", "neutral", "ALERT --"),
        buildLoopBridgeBlock("GATE", "SENT -- | STAGE --", "HEALTH -- | FLOW WAIT", "neutral", "QUEUE --"),
        buildLoopBridgeBlock("ATTN", "ALERT -- | SENT --", "CADENCE --", "neutral", "HEALTH --")
      ),
      queueFamilyText: "FLOW WAIT | STATUS -- | QUEUE --",
      queueFlowText: "ENTRY WAIT | FLOW WAIT | SEQ WAIT",
      queueSummaryText: "QUEUE -- | STATUS -- | FLOW WAIT",
      queueGateText: "QUEUE -- | ENTRY WAIT | STATUS --",
      queueLeadText: "ENTRY WAIT | FLOW WAIT | QUEUE --",
      queueWindowText: "QUEUE -- | STATUS -- | HEALTH --",
      queuePressureText: "QUEUE -- | ALERT -- | HEALTH --",
      queueResponseText: "QUEUE -- | FLOW WAIT | ENTRY WAIT",
      queueAttentionText: "QUEUE -- | ALERT -- | FLOW WAIT",
      queueCadenceText: "ENTRY WAIT | FLOW WAIT | QUEUE --",
      queueMicroflowText: "MICRO WAIT | POD --",
      runtimeFamilyText: "FLOW WAIT | STATUS -- | HEALTH --",
      runtimeFlowText: "SEQ WAIT | FLOW WAIT | ALERT --",
      runtimeSummaryText: "HEALTH -- | ALERT -- | FLOW WAIT",
      runtimeGateText: "HEALTH -- | ENTRY WAIT | STATUS --",
      runtimeLeadText: "SEQ WAIT | FLOW WAIT | HEALTH --",
      runtimeWindowText: "HEALTH -- | ALERT -- | STATUS --",
      runtimePressureText: "HEALTH -- | ALERT -- | QUEUE --",
      runtimeResponseText: "HEALTH -- | FLOW WAIT | SEQ WAIT",
      runtimeAttentionText: "HEALTH -- | ALERT -- | FLOW WAIT",
      runtimeCadenceText: "SEQ WAIT | FLOW WAIT | HEALTH --",
      runtimeMicroflowText: "MICRO WAIT | POD --"
    };
    const queueBundle = buildLoopFamilyBridgeBundle(panels.queueTone, {
      familyText: panels.queueFamilyText,
      flowText: panels.queueFlowText,
      summaryText: panels.queueSummaryText,
      gateText: panels.queueGateText,
      windowText: panels.queueWindowText,
      pressureText: panels.queuePressureText,
      responseText: panels.queueResponseText,
      attentionText: panels.queueAttentionText,
      cadenceText: panels.queueCadenceText
    });
    const runtimeBundle = buildLoopFamilyBridgeBundle(panels.runtimeTone, {
      familyText: panels.runtimeFamilyText,
      flowText: panels.runtimeFlowText,
      summaryText: panels.runtimeSummaryText,
      gateText: panels.runtimeGateText,
      windowText: panels.runtimeWindowText,
      pressureText: panels.runtimePressureText,
      responseText: panels.runtimeResponseText,
      attentionText: panels.runtimeAttentionText,
      cadenceText: panels.runtimeCadenceText
    });
    const dispatchFlowBundle = buildLoopFlowFamilyBridgeBundle(panels.dispatchTone, {
      familyText: panels.dispatchFamilyText,
      flowText: panels.dispatchFlowText,
      summaryText: panels.dispatchSummaryText,
      gateText: panels.dispatchGateText,
      leadText: panels.dispatchLeadText,
      windowText: panels.dispatchWindowText,
      pressureText: panels.dispatchPressureText,
      responseText: panels.dispatchResponseText,
      attentionText: panels.dispatchAttentionText,
      cadenceText: panels.dispatchCadenceText,
      focusText: panels.dispatchFocusText,
      stageText: panels.dispatchStageText,
      stateText: panels.dispatchStateText,
      opsText: panels.dispatchOpsText,
      signalText: panels.dispatchSignalText,
      detailText: panels.dispatchDetailText
    }, LOOP_FAMILY_TITLES.dispatch);
    const queueFlowBundle = buildLoopFlowFamilyBridgeBundle(panels.queueTone, {
      familyText: panels.queueFamilyText,
      flowText: panels.queueFlowText,
      summaryText: panels.queueSummaryText,
      gateText: panels.queueGateText,
      leadText: panels.queueLeadText,
      windowText: panels.queueWindowText,
      pressureText: panels.queuePressureText,
      responseText: panels.queueResponseText,
      attentionText: panels.queueAttentionText,
      cadenceText: panels.queueCadenceText,
      focusText: panels.queueFocusText,
      stageText: panels.queueStageText,
      stateText: panels.queueStateText,
      opsText: panels.queueOpsText,
      signalText: panels.queueSignalText,
      detailText: panels.queueDetailText
    }, LOOP_FAMILY_TITLES.queue);
    const runtimeFlowBundle = buildLoopFlowFamilyBridgeBundle(panels.runtimeTone, {
      familyText: panels.runtimeFamilyText,
      flowText: panels.runtimeFlowText,
      summaryText: panels.runtimeSummaryText,
      gateText: panels.runtimeGateText,
      leadText: panels.runtimeLeadText,
      windowText: panels.runtimeWindowText,
      pressureText: panels.runtimePressureText,
      responseText: panels.runtimeResponseText,
      attentionText: panels.runtimeAttentionText,
      cadenceText: panels.runtimeCadenceText,
      focusText: panels.runtimeFocusText,
      stageText: panels.runtimeStageText,
      stateText: panels.runtimeStateText,
      opsText: panels.runtimeOpsText,
      signalText: panels.runtimeSignalText,
      detailText: panels.runtimeDetailText
    }, LOOP_FAMILY_TITLES.runtime);
    panels.queueCards = queueBundle.cards;
    panels.queueBlocks = queueBundle.blocks;
    panels.runtimeCards = runtimeBundle.cards;
    panels.runtimeBlocks = runtimeBundle.blocks;
    panels.queueFlowCards = queueFlowBundle.cards;
    panels.queueFlowBlocks = queueFlowBundle.blocks;
    panels.queueFlowPanels = buildLoopFlowFamilyPanels(panels.queueTone, {
      familyText: panels.queueFamilyText,
      flowText: panels.queueFlowText,
      summaryText: panels.queueSummaryText,
      gateText: panels.queueGateText,
      leadText: panels.queueLeadText,
      windowText: panels.queueWindowText,
      pressureText: panels.queuePressureText,
      responseText: panels.queueResponseText,
      attentionText: panels.queueAttentionText,
      cadenceText: panels.queueCadenceText,
      focusText: panels.queueFocusText,
      stateText: panels.queueStateText,
      stageText: panels.queueStageText,
      opsText: panels.queueOpsText,
      signalText: panels.queueSignalText,
      detailText: panels.queueDetailText
    }, ["QUEUE", "STATUS", "REVIEW"]);
    const queueSubflowBundle = buildLoopSubflowBundle(panels.queueTone, {
      familyText: panels.queueFamilyText,
      flowText: panels.queueFlowText,
      summaryText: panels.queueSummaryText,
      gateText: panels.queueGateText,
      leadText: panels.queueLeadText,
      windowText: panels.queueWindowText,
      pressureText: panels.queuePressureText,
      responseText: panels.queueResponseText,
      attentionText: panels.queueAttentionText,
      cadenceText: panels.queueCadenceText,
      focusText: panels.queueFocusText,
      stageText: panels.queueStageText,
      stateText: panels.queueStateText,
      opsText: panels.queueOpsText,
      signalText: panels.queueSignalText,
      detailText: panels.queueDetailText
    }, LOOP_FAMILY_TITLES.queue);
    panels.queueSubflowCards = queueSubflowBundle.cards;
    panels.queueSubflowBlocks = queueSubflowBundle.blocks;
    panels.queueSubflowPanels = queueSubflowBundle.panels;
    panels.runtimeFlowCards = runtimeFlowBundle.cards;
    panels.runtimeFlowBlocks = runtimeFlowBundle.blocks;
    panels.runtimeFlowPanels = buildLoopFlowFamilyPanels(panels.runtimeTone, {
      familyText: panels.runtimeFamilyText,
      flowText: panels.runtimeFlowText,
      summaryText: panels.runtimeSummaryText,
      gateText: panels.runtimeGateText,
      leadText: panels.runtimeLeadText,
      windowText: panels.runtimeWindowText,
      pressureText: panels.runtimePressureText,
      responseText: panels.runtimeResponseText,
      attentionText: panels.runtimeAttentionText,
      cadenceText: panels.runtimeCadenceText,
      focusText: panels.runtimeFocusText,
      stateText: panels.runtimeStateText,
      stageText: panels.runtimeStageText,
      opsText: panels.runtimeOpsText,
      signalText: panels.runtimeSignalText,
      detailText: panels.runtimeDetailText
    }, ["RUNTIME", "STATUS", "HEALTH"]);
    const runtimeSubflowBundle = buildLoopSubflowBundle(panels.runtimeTone, {
      familyText: panels.runtimeFamilyText,
      flowText: panels.runtimeFlowText,
      summaryText: panels.runtimeSummaryText,
      gateText: panels.runtimeGateText,
      leadText: panels.runtimeLeadText,
      windowText: panels.runtimeWindowText,
      pressureText: panels.runtimePressureText,
      responseText: panels.runtimeResponseText,
      attentionText: panels.runtimeAttentionText,
      cadenceText: panels.runtimeCadenceText,
      focusText: panels.runtimeFocusText,
      stageText: panels.runtimeStageText,
      stateText: panels.runtimeStateText,
      opsText: panels.runtimeOpsText,
      signalText: panels.runtimeSignalText,
      detailText: panels.runtimeDetailText
    }, LOOP_FAMILY_TITLES.runtime);
    panels.runtimeSubflowCards = runtimeSubflowBundle.cards;
    panels.runtimeSubflowBlocks = runtimeSubflowBundle.blocks;
    panels.runtimeSubflowPanels = runtimeSubflowBundle.panels;
    panels.dispatchFlowCards = dispatchFlowBundle.cards;
    panels.dispatchFlowBlocks = dispatchFlowBundle.blocks;
    panels.dispatchFlowPanels = buildLoopFlowFamilyPanels(panels.dispatchTone, {
      familyText: panels.dispatchFamilyText,
      flowText: panels.dispatchFlowText,
      summaryText: panels.dispatchSummaryText,
      gateText: panels.dispatchGateText,
      leadText: panels.dispatchLeadText,
      windowText: panels.dispatchWindowText,
      pressureText: panels.dispatchPressureText,
      responseText: panels.dispatchResponseText,
      attentionText: panels.dispatchAttentionText,
      cadenceText: panels.dispatchCadenceText,
      focusText: panels.dispatchFocusText,
      stateText: panels.dispatchStateText,
      stageText: panels.dispatchStageText,
      opsText: panels.dispatchOpsText,
      signalText: panels.dispatchSignalText,
      detailText: panels.dispatchDetailText
    }, ["QUEUE", "HEALTH", "RELEASE"]);
    const dispatchSubflowBundle = buildLoopSubflowBundle(panels.dispatchTone, {
      familyText: panels.dispatchFamilyText,
      flowText: panels.dispatchFlowText,
      summaryText: panels.dispatchSummaryText,
      gateText: panels.dispatchGateText,
      leadText: panels.dispatchLeadText,
      windowText: panels.dispatchWindowText,
      pressureText: panels.dispatchPressureText,
      responseText: panels.dispatchResponseText,
      attentionText: panels.dispatchAttentionText,
      cadenceText: panels.dispatchCadenceText,
      focusText: panels.dispatchFocusText,
      stageText: panels.dispatchStageText,
      stateText: panels.dispatchStateText,
      opsText: panels.dispatchOpsText,
      signalText: panels.dispatchSignalText,
      detailText: panels.dispatchDetailText
    }, LOOP_FAMILY_TITLES.dispatch);
    panels.dispatchSubflowCards = dispatchSubflowBundle.cards;
    panels.dispatchSubflowBlocks = dispatchSubflowBundle.blocks;
    panels.dispatchSubflowPanels = dispatchSubflowBundle.panels;
    return panels;
  }
  const sharedRows = [...loopDeck.loopRows, ...loopDeck.loopSignalRows];
  const queueDepth = readLoopRowValue(sharedRows, ["queue_depth"], "0");
  const sceneHealth = readLoopRowValue(sharedRows, ["scene_health"], "--");
  const alertCount = readLoopRowValue(sharedRows, ["alerts"], "0");
  const liveOpsSent = readLoopRowValue(sharedRows, ["liveops_sent"], "0");
  const entryLabel = formatRuntimeKeyLabel(loopDeck.entryKindKey, "ENTRY");
  const sequenceLabel = formatRuntimeKeyLabel(loopDeck.sequenceKindKey, "LOOP");
  const microflowLabel = formatRuntimeKeyLabel(loopDeck.microflowKey, "FLOW");
  const microflowRailText = buildLoopMicroflowRailText(loopDeck);
  const stageValue = toText(loopDeck.stageValue || loopDeck.loopStatusLabel || "--", "--");
  const loopStatusLabel = toText(loopDeck.loopStatusLabel || "IDLE", "IDLE");
  const panels = {
    queueText: buildLoopMicroLine(
      "QUEUE",
      queueDepth,
      loopStatusLabel
    ),
    runtimeText: buildLoopMicroLine(
      "RUNTIME",
      sceneHealth,
      `ALERT ${alertCount}`
    ),
    dispatchText: buildLoopMicroLine(
      "DISPATCH",
      liveOpsSent,
      stageValue
    ),
    queueTone: resolveLoopFamilyTone(queueDepth, loopStatusLabel),
    runtimeTone: resolveLoopFamilyTone(sceneHealth, alertCount, loopStatusLabel),
    dispatchTone: resolveLoopFamilyTone(liveOpsSent, stageValue, loopStatusLabel),
    queueFocusText: buildLoopFocusDetail(loopDeck, "queue", `ENTRY ${entryLabel}`, `FOCUS ${queueDepth}`, `FLOW ${microflowLabel}`),
    runtimeFocusText: buildLoopFocusDetail(loopDeck, "runtime", `SEQ ${sequenceLabel}`, `FOCUS ${sceneHealth}`, `ALERT ${alertCount}`),
    dispatchFocusText: buildLoopFocusDetail(loopDeck, "dispatch", `ENTRY ${entryLabel}`, `FOCUS ${liveOpsSent}`, `STAGE ${stageValue}`),
    queueStageText: buildLoopMicroDetail(`STAGE ${stageValue}`, `STATUS ${loopStatusLabel}`, `ENTRY ${entryLabel}`),
    runtimeStageText: buildLoopMicroDetail(`STAGE ${stageValue}`, `STATUS ${loopStatusLabel}`, `SEQ ${sequenceLabel}`),
    dispatchStageText: buildLoopMicroDetail(`STAGE ${stageValue}`, `STATUS ${loopStatusLabel}`, `SENT ${liveOpsSent}`),
    queueOpsText: buildLoopMicroDetail(`ENTRY ${entryLabel}`, `QUEUE ${queueDepth}`, `FLOW ${loopStatusLabel}`),
    runtimeOpsText: buildLoopMicroDetail(`SEQ ${sequenceLabel}`, `HEALTH ${sceneHealth}`, `ALERT ${alertCount}`),
    dispatchOpsText: buildLoopMicroDetail(
      `ENTRY ${entryLabel}`,
      `SENT ${liveOpsSent}`,
      `STAGE ${stageValue}`
    ),
    queueStateText: buildLoopMicroDetail(`FLOW ${microflowLabel}`, `ENTRY ${entryLabel}`, `QUEUE ${queueDepth}`),
    runtimeStateText: buildLoopMicroDetail(`FLOW ${microflowLabel}`, `SEQ ${sequenceLabel}`, `HEALTH ${sceneHealth}`),
    dispatchStateText: buildLoopMicroDetail(
      `FLOW ${microflowLabel}`,
      `STAGE ${stageValue}`,
      `SENT ${liveOpsSent}`
    ),
    queueSignalText: buildLoopMicroDetail(`QUEUE ${queueDepth}`, `FLOW ${microflowLabel}`, `ENTRY ${entryLabel}`),
    runtimeSignalText: buildLoopMicroDetail(`HEALTH ${sceneHealth}`, `ALERT ${alertCount}`, `FLOW ${microflowLabel}`),
    dispatchSignalText: buildLoopMicroDetail(
      `SENT ${liveOpsSent}`,
      `STAGE ${stageValue}`,
      `FLOW ${microflowLabel}`
    ),
    queueDetailText: buildLoopMicroDetail(`DEPTH ${queueDepth}`, `FLOW ${loopStatusLabel}`, microflowLabel),
    runtimeDetailText: buildLoopMicroDetail(`HEALTH ${sceneHealth}`, `ALERT ${alertCount}`, sequenceLabel),
    dispatchDetailText: buildLoopMicroDetail(
      `SENT ${liveOpsSent}`,
      `STAGE ${stageValue}`,
      entryLabel
    ),
    dispatchFamilyText: buildLoopMicroDetail(`FLOW ${microflowLabel}`, `STATUS ${loopStatusLabel}`, `ALERT ${alertCount}`),
    dispatchFlowText: buildLoopMicroDetail(`ENTRY ${entryLabel}`, `SEQ ${sequenceLabel}`, `SENT ${liveOpsSent}`),
    dispatchSummaryText: buildLoopMicroDetail(`FLOW ${microflowLabel}`, `STATUS ${loopStatusLabel}`, `ALERT ${alertCount}`),
    dispatchGateText: buildLoopMicroDetail(`SENT ${liveOpsSent}`, `STAGE ${stageValue}`, `ENTRY ${entryLabel}`),
    dispatchLeadText: buildLoopMicroDetail(`ENTRY ${entryLabel}`, `FLOW ${microflowLabel}`, sequenceLabel),
    dispatchWindowText: buildLoopMicroDetail(`SENT ${liveOpsSent}`, `ALERT ${alertCount}`, `HEALTH ${sceneHealth}`),
    dispatchPressureText: buildLoopMicroDetail(`ALERT ${alertCount}`, `HEALTH ${sceneHealth}`, `QUEUE ${queueDepth}`),
    dispatchResponseText: buildLoopMicroDetail(`SENT ${liveOpsSent}`, `FLOW ${loopStatusLabel}`, `ENTRY ${entryLabel}`),
    dispatchAttentionText: buildLoopAttentionDetail(`ALERT ${alertCount}`, `SENT ${liveOpsSent}`, `STAGE ${stageValue}`),
    dispatchCadenceText: buildLoopCadenceDetail(`ENTRY ${entryLabel}`, `FLOW ${microflowLabel}`, `SENT ${liveOpsSent}`),
    dispatchMicroflowText: microflowRailText,
    dispatchCards: buildLoopBridgeCards(
      buildLoopBridgeCard("SENT", `${liveOpsSent} | ${stageValue}`, resolveLoopFamilyTone(liveOpsSent, stageValue), `ENTRY ${entryLabel}`),
      buildLoopBridgeCard("ALERT", `${alertCount} | ${sceneHealth}`, resolveLoopFamilyTone(alertCount, sceneHealth), `SEQ ${sequenceLabel}`),
      buildLoopBridgeCard("QUEUE", `${queueDepth} | ${entryLabel}`, resolveLoopFamilyTone(queueDepth, entryLabel), `FLOW ${microflowLabel}`)
    ),
    dispatchBlocks: buildLoopBridgeBlocks(
      buildLoopBridgeBlock(
        "FLOW",
        buildLoopMicroDetail(`FLOW ${microflowLabel}`, `STATUS ${loopStatusLabel}`, `ALERT ${alertCount}`),
        buildLoopMicroDetail(`ENTRY ${entryLabel}`, `SEQ ${sequenceLabel}`, `SENT ${liveOpsSent}`),
        resolveLoopFamilyTone(liveOpsSent, alertCount, loopStatusLabel),
        buildLoopMicroDetail(`HEALTH ${sceneHealth}`, `QUEUE ${queueDepth}`, `STAGE ${stageValue}`)
      ),
      buildLoopBridgeBlock(
        "GATE",
        buildLoopMicroDetail(`SENT ${liveOpsSent}`, `STAGE ${stageValue}`, `ENTRY ${entryLabel}`),
        buildLoopMicroDetail(`SENT ${liveOpsSent}`, `FLOW ${loopStatusLabel}`, `ENTRY ${entryLabel}`),
        resolveLoopFamilyTone(alertCount, sceneHealth, liveOpsSent),
        buildLoopMicroDetail(`ALERT ${alertCount}`, `HEALTH ${sceneHealth}`, `QUEUE ${queueDepth}`)
      ),
      buildLoopBridgeBlock(
        "ATTN",
        buildLoopAttentionDetail(`ALERT ${alertCount}`, `SENT ${liveOpsSent}`, `STAGE ${stageValue}`),
        buildLoopCadenceDetail(`ENTRY ${entryLabel}`, `FLOW ${microflowLabel}`, `SENT ${liveOpsSent}`),
        resolveLoopFamilyTone(alertCount, queueDepth, sceneHealth),
        buildLoopMicroDetail(`QUEUE ${queueDepth}`, `SEQ ${sequenceLabel}`, `FLOW ${microflowLabel}`)
      )
    ),
    queueFamilyText: buildLoopMicroDetail(`FLOW ${microflowLabel}`, `STATUS ${loopStatusLabel}`, `QUEUE ${queueDepth}`),
    queueFlowText: buildLoopMicroDetail(`ENTRY ${entryLabel}`, `FLOW ${microflowLabel}`, `SEQ ${sequenceLabel}`),
    queueSummaryText: buildLoopMicroDetail(`QUEUE ${queueDepth}`, `STATUS ${loopStatusLabel}`, `FLOW ${microflowLabel}`),
    queueGateText: buildLoopMicroDetail(`QUEUE ${queueDepth}`, `ENTRY ${entryLabel}`, `STATUS ${loopStatusLabel}`),
    queueLeadText: buildLoopMicroDetail(`ENTRY ${entryLabel}`, `FLOW ${microflowLabel}`, `QUEUE ${queueDepth}`),
    queueWindowText: buildLoopMicroDetail(`QUEUE ${queueDepth}`, `STATUS ${loopStatusLabel}`, `HEALTH ${sceneHealth}`),
    queuePressureText: buildLoopMicroDetail(`QUEUE ${queueDepth}`, `ALERT ${alertCount}`, `HEALTH ${sceneHealth}`),
    queueResponseText: buildLoopMicroDetail(`QUEUE ${queueDepth}`, `FLOW ${loopStatusLabel}`, `ENTRY ${entryLabel}`),
    queueAttentionText: buildLoopAttentionDetail(`QUEUE ${queueDepth}`, `ALERT ${alertCount}`, `FLOW ${microflowLabel}`),
    queueCadenceText: buildLoopCadenceDetail(`ENTRY ${entryLabel}`, `FLOW ${microflowLabel}`, `QUEUE ${queueDepth}`),
    queueMicroflowText: microflowRailText,
    runtimeFamilyText: buildLoopMicroDetail(`FLOW ${microflowLabel}`, `STATUS ${loopStatusLabel}`, `HEALTH ${sceneHealth}`),
    runtimeFlowText: buildLoopMicroDetail(`SEQ ${sequenceLabel}`, `FLOW ${microflowLabel}`, `ALERT ${alertCount}`),
    runtimeSummaryText: buildLoopMicroDetail(`HEALTH ${sceneHealth}`, `ALERT ${alertCount}`, `FLOW ${microflowLabel}`),
    runtimeGateText: buildLoopMicroDetail(`HEALTH ${sceneHealth}`, `ENTRY ${entryLabel}`, `STATUS ${loopStatusLabel}`),
    runtimeLeadText: buildLoopMicroDetail(`SEQ ${sequenceLabel}`, `FLOW ${microflowLabel}`, `HEALTH ${sceneHealth}`),
    runtimeWindowText: buildLoopMicroDetail(`HEALTH ${sceneHealth}`, `ALERT ${alertCount}`, `STATUS ${loopStatusLabel}`),
    runtimePressureText: buildLoopMicroDetail(`HEALTH ${sceneHealth}`, `ALERT ${alertCount}`, `QUEUE ${queueDepth}`),
    runtimeResponseText: buildLoopMicroDetail(`HEALTH ${sceneHealth}`, `FLOW ${loopStatusLabel}`, `SEQ ${sequenceLabel}`),
    runtimeAttentionText: buildLoopAttentionDetail(`HEALTH ${sceneHealth}`, `ALERT ${alertCount}`, `FLOW ${microflowLabel}`),
    runtimeCadenceText: buildLoopCadenceDetail(`SEQ ${sequenceLabel}`, `FLOW ${microflowLabel}`, `HEALTH ${sceneHealth}`),
    runtimeMicroflowText: microflowRailText
  };
  const queueBundle = buildLoopFamilyBridgeBundle(panels.queueTone, {
    familyText: panels.queueFamilyText,
    flowText: panels.queueFlowText,
    summaryText: panels.queueSummaryText,
    gateText: panels.queueGateText,
    windowText: panels.queueWindowText,
    pressureText: panels.queuePressureText,
    responseText: panels.queueResponseText,
    attentionText: panels.queueAttentionText,
    cadenceText: panels.queueCadenceText
  });
  const runtimeBundle = buildLoopFamilyBridgeBundle(panels.runtimeTone, {
    familyText: panels.runtimeFamilyText,
    flowText: panels.runtimeFlowText,
    summaryText: panels.runtimeSummaryText,
    gateText: panels.runtimeGateText,
    windowText: panels.runtimeWindowText,
    pressureText: panels.runtimePressureText,
    responseText: panels.runtimeResponseText,
    attentionText: panels.runtimeAttentionText,
    cadenceText: panels.runtimeCadenceText
  });
  const dispatchFlowBundle = buildLoopFlowFamilyBridgeBundle(panels.dispatchTone, {
    entryKindKey: loopDeck.entryKindKey,
    sequenceKindKey: loopDeck.sequenceKindKey,
    microflowKey: loopDeck.microflowKey,
    focusKey: loopDeck.focusKey,
    riskKey: loopDeck.riskKey,
    riskFocusKey: loopDeck.riskFocusKey,
    protocolPodKey: loopDeck.protocolPodKey,
    familyText: panels.dispatchFamilyText,
    flowText: panels.dispatchFlowText,
    summaryText: panels.dispatchSummaryText,
    gateText: panels.dispatchGateText,
    leadText: panels.dispatchLeadText,
    windowText: panels.dispatchWindowText,
    pressureText: panels.dispatchPressureText,
    responseText: panels.dispatchResponseText,
    attentionText: panels.dispatchAttentionText,
    cadenceText: panels.dispatchCadenceText,
    focusText: panels.dispatchFocusText,
    stageText: panels.dispatchStageText,
    stateText: panels.dispatchStateText,
    opsText: panels.dispatchOpsText,
    signalText: panels.dispatchSignalText,
    detailText: panels.dispatchDetailText
  }, LOOP_FAMILY_TITLES.dispatch);
  const queueFlowBundle = buildLoopFlowFamilyBridgeBundle(panels.queueTone, {
    familyText: panels.queueFamilyText,
    flowText: panels.queueFlowText,
    summaryText: panels.queueSummaryText,
    gateText: panels.queueGateText,
    leadText: panels.queueLeadText,
    windowText: panels.queueWindowText,
    pressureText: panels.queuePressureText,
    responseText: panels.queueResponseText,
    attentionText: panels.queueAttentionText,
    cadenceText: panels.queueCadenceText,
    focusText: panels.queueFocusText,
    stageText: panels.queueStageText,
    stateText: panels.queueStateText,
    opsText: panels.queueOpsText,
    signalText: panels.queueSignalText,
    detailText: panels.queueDetailText
  }, LOOP_FAMILY_TITLES.queue);
  const runtimeFlowBundle = buildLoopFlowFamilyBridgeBundle(panels.runtimeTone, {
    familyText: panels.runtimeFamilyText,
    flowText: panels.runtimeFlowText,
    summaryText: panels.runtimeSummaryText,
    gateText: panels.runtimeGateText,
    leadText: panels.runtimeLeadText,
    windowText: panels.runtimeWindowText,
    pressureText: panels.runtimePressureText,
    responseText: panels.runtimeResponseText,
    attentionText: panels.runtimeAttentionText,
    cadenceText: panels.runtimeCadenceText,
    focusText: panels.runtimeFocusText,
    stageText: panels.runtimeStageText,
    stateText: panels.runtimeStateText,
    opsText: panels.runtimeOpsText,
    signalText: panels.runtimeSignalText,
    detailText: panels.runtimeDetailText
  }, LOOP_FAMILY_TITLES.runtime);
  panels.queueCards = queueBundle.cards;
  panels.queueBlocks = queueBundle.blocks;
  panels.runtimeCards = runtimeBundle.cards;
  panels.runtimeBlocks = runtimeBundle.blocks;
  panels.queueFlowCards = queueFlowBundle.cards;
  panels.queueFlowBlocks = queueFlowBundle.blocks;
  panels.queueFlowPanels = buildLoopFlowFamilyPanels(panels.queueTone, {
    familyText: panels.queueFamilyText,
    flowText: panels.queueFlowText,
    summaryText: panels.queueSummaryText,
    gateText: panels.queueGateText,
    leadText: panels.queueLeadText,
    windowText: panels.queueWindowText,
    pressureText: panels.queuePressureText,
    responseText: panels.queueResponseText,
    attentionText: panels.queueAttentionText,
    cadenceText: panels.queueCadenceText,
    focusText: panels.queueFocusText,
    stateText: panels.queueStateText,
    stageText: panels.queueStageText,
    opsText: panels.queueOpsText,
    signalText: panels.queueSignalText,
    detailText: panels.queueDetailText
  }, ["QUEUE", "STATUS", "REVIEW"]);
  const queueSubflowBundle = buildLoopSubflowBundle(panels.queueTone, {
    familyText: panels.queueFamilyText,
    flowText: panels.queueFlowText,
    summaryText: panels.queueSummaryText,
    gateText: panels.queueGateText,
    leadText: panels.queueLeadText,
    windowText: panels.queueWindowText,
    pressureText: panels.queuePressureText,
    responseText: panels.queueResponseText,
    attentionText: panels.queueAttentionText,
    cadenceText: panels.queueCadenceText,
    focusText: panels.queueFocusText,
    stageText: panels.queueStageText,
    stateText: panels.queueStateText,
    opsText: panels.queueOpsText,
    signalText: panels.queueSignalText,
    detailText: panels.queueDetailText
  }, LOOP_FAMILY_TITLES.queue);
  panels.queueSubflowCards = queueSubflowBundle.cards;
  panels.queueSubflowBlocks = queueSubflowBundle.blocks;
  panels.queueSubflowPanels = queueSubflowBundle.panels;
  panels.runtimeFlowCards = runtimeFlowBundle.cards;
  panels.runtimeFlowBlocks = runtimeFlowBundle.blocks;
  panels.runtimeFlowPanels = buildLoopFlowFamilyPanels(panels.runtimeTone, {
    familyText: panels.runtimeFamilyText,
    flowText: panels.runtimeFlowText,
    summaryText: panels.runtimeSummaryText,
    gateText: panels.runtimeGateText,
    leadText: panels.runtimeLeadText,
    windowText: panels.runtimeWindowText,
    pressureText: panels.runtimePressureText,
    responseText: panels.runtimeResponseText,
    attentionText: panels.runtimeAttentionText,
    cadenceText: panels.runtimeCadenceText,
    focusText: panels.runtimeFocusText,
    stateText: panels.runtimeStateText,
    stageText: panels.runtimeStageText,
    opsText: panels.runtimeOpsText,
    signalText: panels.runtimeSignalText,
    detailText: panels.runtimeDetailText
  }, ["RUNTIME", "STATUS", "HEALTH"]);
  const runtimeSubflowBundle = buildLoopSubflowBundle(panels.runtimeTone, {
    familyText: panels.runtimeFamilyText,
    flowText: panels.runtimeFlowText,
    summaryText: panels.runtimeSummaryText,
    gateText: panels.runtimeGateText,
    leadText: panels.runtimeLeadText,
    windowText: panels.runtimeWindowText,
    pressureText: panels.runtimePressureText,
    responseText: panels.runtimeResponseText,
    attentionText: panels.runtimeAttentionText,
    cadenceText: panels.runtimeCadenceText,
    focusText: panels.runtimeFocusText,
    stageText: panels.runtimeStageText,
    stateText: panels.runtimeStateText,
    opsText: panels.runtimeOpsText,
    signalText: panels.runtimeSignalText,
    detailText: panels.runtimeDetailText
  }, LOOP_FAMILY_TITLES.runtime);
  panels.runtimeSubflowCards = runtimeSubflowBundle.cards;
  panels.runtimeSubflowBlocks = runtimeSubflowBundle.blocks;
  panels.runtimeSubflowPanels = runtimeSubflowBundle.panels;
  const queueRiskBundle = buildLoopRiskBridgeBundle(panels.queueTone, {
    familyText: panels.queueFamilyText,
    flowText: panels.queueFlowText,
    summaryText: panels.queueSummaryText,
    gateText: panels.queueGateText,
    leadText: panels.queueLeadText,
    windowText: panels.queueWindowText,
    pressureText: panels.queuePressureText,
    responseText: panels.queueResponseText,
    attentionText: panels.queueAttentionText,
    cadenceText: panels.queueCadenceText,
    focusText: panels.queueFocusText,
    stateText: panels.queueStateText,
    stageText: panels.queueStageText,
    opsText: panels.queueOpsText,
    signalText: panels.queueSignalText,
    detailText: panels.queueDetailText
  });
  panels.queueRiskCards = queueRiskBundle.cards;
  panels.queueRiskBlocks = queueRiskBundle.blocks;
  panels.queueRiskPanels = buildLoopRiskPanels(panels.queueTone, {
    familyText: panels.queueFamilyText,
    flowText: panels.queueFlowText,
    summaryText: panels.queueSummaryText,
    gateText: panels.queueGateText,
    leadText: panels.queueLeadText,
    windowText: panels.queueWindowText,
    pressureText: panels.queuePressureText,
    responseText: panels.queueResponseText,
    attentionText: panels.queueAttentionText,
    cadenceText: panels.queueCadenceText,
    focusText: panels.queueFocusText,
    stateText: panels.queueStateText,
    stageText: panels.queueStageText,
    opsText: panels.queueOpsText,
    signalText: panels.queueSignalText,
    detailText: panels.queueDetailText
  });
  const runtimeRiskBundle = buildLoopRiskBridgeBundle(panels.runtimeTone, {
    familyText: panels.runtimeFamilyText,
    flowText: panels.runtimeFlowText,
    summaryText: panels.runtimeSummaryText,
    gateText: panels.runtimeGateText,
    leadText: panels.runtimeLeadText,
    windowText: panels.runtimeWindowText,
    pressureText: panels.runtimePressureText,
    responseText: panels.runtimeResponseText,
    attentionText: panels.runtimeAttentionText,
    cadenceText: panels.runtimeCadenceText,
    focusText: panels.runtimeFocusText,
    stateText: panels.runtimeStateText,
    stageText: panels.runtimeStageText,
    opsText: panels.runtimeOpsText,
    signalText: panels.runtimeSignalText,
    detailText: panels.runtimeDetailText
  });
  panels.runtimeRiskCards = runtimeRiskBundle.cards;
  panels.runtimeRiskBlocks = runtimeRiskBundle.blocks;
  panels.runtimeRiskPanels = buildLoopRiskPanels(panels.runtimeTone, {
    familyText: panels.runtimeFamilyText,
    flowText: panels.runtimeFlowText,
    summaryText: panels.runtimeSummaryText,
    gateText: panels.runtimeGateText,
    leadText: panels.runtimeLeadText,
    windowText: panels.runtimeWindowText,
    pressureText: panels.runtimePressureText,
    responseText: panels.runtimeResponseText,
    attentionText: panels.runtimeAttentionText,
    cadenceText: panels.runtimeCadenceText,
    focusText: panels.runtimeFocusText,
    stateText: panels.runtimeStateText,
    stageText: panels.runtimeStageText,
    opsText: panels.runtimeOpsText,
    signalText: panels.runtimeSignalText,
    detailText: panels.runtimeDetailText
  });
  panels.dispatchFlowCards = dispatchFlowBundle.cards;
  panels.dispatchFlowBlocks = dispatchFlowBundle.blocks;
  const dispatchRiskBundle = buildLoopRiskBridgeBundle(panels.dispatchTone, {
    familyText: panels.dispatchFamilyText,
    flowText: panels.dispatchFlowText,
    summaryText: panels.dispatchSummaryText,
    gateText: panels.dispatchGateText,
    leadText: panels.dispatchLeadText,
    windowText: panels.dispatchWindowText,
    pressureText: panels.dispatchPressureText,
    responseText: panels.dispatchResponseText,
    attentionText: panels.dispatchAttentionText,
    cadenceText: panels.dispatchCadenceText,
    focusText: panels.dispatchFocusText,
    stateText: panels.dispatchStateText,
    stageText: panels.dispatchStageText,
    opsText: panels.dispatchOpsText,
    signalText: panels.dispatchSignalText,
    detailText: panels.dispatchDetailText
  });
  panels.dispatchRiskCards = dispatchRiskBundle.cards;
  panels.dispatchRiskBlocks = dispatchRiskBundle.blocks;
  panels.dispatchFlowPanels = buildLoopFlowFamilyPanels(panels.dispatchTone, {
    familyText: panels.dispatchFamilyText,
    flowText: panels.dispatchFlowText,
    summaryText: panels.dispatchSummaryText,
    gateText: panels.dispatchGateText,
    leadText: panels.dispatchLeadText,
    windowText: panels.dispatchWindowText,
    pressureText: panels.dispatchPressureText,
    responseText: panels.dispatchResponseText,
    attentionText: panels.dispatchAttentionText,
    cadenceText: panels.dispatchCadenceText,
    focusText: panels.dispatchFocusText,
    stateText: panels.dispatchStateText,
    stageText: panels.dispatchStageText,
    opsText: panels.dispatchOpsText,
    signalText: panels.dispatchSignalText,
    detailText: panels.dispatchDetailText
  }, ["QUEUE", "HEALTH", "RELEASE"]);
  panels.dispatchRiskPanels = buildLoopRiskPanels(panels.dispatchTone, {
    familyText: panels.dispatchFamilyText,
    flowText: panels.dispatchFlowText,
    summaryText: panels.dispatchSummaryText,
    gateText: panels.dispatchGateText,
    leadText: panels.dispatchLeadText,
    windowText: panels.dispatchWindowText,
    pressureText: panels.dispatchPressureText,
    responseText: panels.dispatchResponseText,
    attentionText: panels.dispatchAttentionText,
    cadenceText: panels.dispatchCadenceText,
    focusText: panels.dispatchFocusText,
    stateText: panels.dispatchStateText,
    stageText: panels.dispatchStageText,
    opsText: panels.dispatchOpsText,
    signalText: panels.dispatchSignalText,
    detailText: panels.dispatchDetailText
  });
  const dispatchSubflowBundle = buildLoopSubflowBundle(panels.dispatchTone, {
    familyText: panels.dispatchFamilyText,
    flowText: panels.dispatchFlowText,
    summaryText: panels.dispatchSummaryText,
    gateText: panels.dispatchGateText,
    leadText: panels.dispatchLeadText,
    windowText: panels.dispatchWindowText,
    pressureText: panels.dispatchPressureText,
    responseText: panels.dispatchResponseText,
    attentionText: panels.dispatchAttentionText,
    cadenceText: panels.dispatchCadenceText,
    focusText: panels.dispatchFocusText,
    stageText: panels.dispatchStageText,
    stateText: panels.dispatchStateText,
    opsText: panels.dispatchOpsText,
    signalText: panels.dispatchSignalText,
    detailText: panels.dispatchDetailText
  }, LOOP_FAMILY_TITLES.dispatch);
  panels.dispatchSubflowCards = dispatchSubflowBundle.cards;
  panels.dispatchSubflowBlocks = dispatchSubflowBundle.blocks;
  panels.dispatchSubflowPanels = dispatchSubflowBundle.panels;
  return panels;
}

function buildOperationsLoopMicroPanels(loopDeck, active) {
  setCurrentLoopAssetContext(loopDeck);
  if (!active) {
    const panels = {
      offerText: "OFFER | WAIT",
      claimText: "CLAIM | WAIT",
      streakText: "STREAK | WAIT",
      lootText: "LOOT | WAIT",
      offerTone: "neutral",
      claimTone: "neutral",
      streakTone: "neutral",
      lootTone: "neutral",
      offerFocusText: "ENTRY WAIT | FOCUS WAIT | FLOW WAIT",
      claimFocusText: "SEQ WAIT | FOCUS WAIT | STAGE --",
      streakFocusText: "PERSONA WAIT | FOCUS WAIT | FLOW WAIT",
      lootFocusText: "ENTRY WAIT | FOCUS WAIT | FLOW WAIT",
      offerStageText: "STAGE -- | STATUS -- | ENTRY WAIT",
      claimStageText: "STAGE -- | STATUS -- | SEQ WAIT",
      streakStageText: "STAGE -- | STATUS -- | PERSONA WAIT",
      lootStageText: "STAGE -- | STATUS -- | CLAIM --",
      offerOpsText: "ENTRY WAIT | OFFER -- | BAND --",
      claimOpsText: "SEQ WAIT | CLAIM -- | BAND --",
      streakOpsText: "PERSONA WAIT | STREAK -- | OFFER --",
      lootOpsText: "ENTRY WAIT | CLAIM -- | BAND --",
      offerStateText: "FLOW WAIT | ENTRY WAIT | OFFER --",
      claimStateText: "FLOW WAIT | SEQ WAIT | CLAIM --",
      streakStateText: "FLOW WAIT | PERSONA WAIT | STREAK --",
      lootStateText: "FLOW WAIT | CLAIM -- | BAND --",
      offerSignalText: "OFFER -- | BAND -- | FLOW WAIT",
      claimSignalText: "CLAIM -- | STAGE -- | FLOW WAIT",
      streakSignalText: "STREAK -- | OFFER -- | FLOW WAIT",
      lootSignalText: "CLAIM -- | BAND -- | FLOW WAIT",
      offerDetailText: "Offer grid detay bekleniyor.",
      claimDetailText: "Claim lane detay bekleniyor.",
      streakDetailText: "Streak pulse detay bekleniyor.",
      lootDetailText: "Loot reveal detay bekleniyor.",
      lootFamilyText: "CLAIM FLOW | WAIT | BAND --",
      lootFlowText: "ENTRY WAIT | SEQ WAIT | CLAIM --",
      lootSummaryText: "FLOW WAIT | STATUS -- | PERSONA --",
      lootGateText: "CLAIM -- | BAND -- | ENTRY WAIT",
      lootLeadText: "ENTRY WAIT | FLOW WAIT | SEQ WAIT",
      lootWindowText: "CLAIM -- | OFFER -- | STREAK --",
      lootPressureText: "CLAIM -- | BAND -- | OFFER --",
      lootResponseText: "STREAK -- | FLOW WAIT | ENTRY WAIT",
      lootAttentionText: "CLAIM -- | BAND -- | ENTRY WAIT",
      lootCadenceText: "ENTRY WAIT | FLOW WAIT | CLAIM --",
      lootMicroflowText: "MICRO WAIT | POD --",
      lootCards: buildLoopBridgeCards(
        buildLoopBridgeCard("CLAIM", "0 READY | STAGE --", "neutral"),
        buildLoopBridgeCard("OFFER", "0 LIVE | BAND --", "neutral"),
        buildLoopBridgeCard("STREAK", "0d | FLOW WAIT", "neutral")
      ),
      lootBlocks: buildLoopBridgeBlocks(
        buildLoopBridgeBlock("FLOW", "WAIT | STATUS --", "ENTRY WAIT | SEQ WAIT", "neutral", "BAND --"),
        buildLoopBridgeBlock("GATE", "CLAIM -- | BAND --", "STREAK -- | FLOW WAIT", "neutral", "OFFER --"),
        buildLoopBridgeBlock("ATTN", "CLAIM -- | BAND --", "CADENCE --", "neutral", "STREAK --")
      ),
      offerFamilyText: "FLOW WAIT | STATUS -- | OFFER --",
      offerFlowText: "ENTRY WAIT | FLOW WAIT | BAND --",
      offerSummaryText: "OFFER -- | BAND -- | FLOW WAIT",
      offerGateText: "OFFER -- | ENTRY WAIT | STATUS --",
      offerLeadText: "ENTRY WAIT | FLOW WAIT | OFFER --",
      offerWindowText: "OFFER -- | BAND -- | STATUS --",
      offerPressureText: "OFFER -- | BAND -- | CLAIM --",
      offerResponseText: "OFFER -- | FLOW WAIT | ENTRY WAIT",
      offerAttentionText: "OFFER -- | BAND -- | FLOW WAIT",
      offerCadenceText: "ENTRY WAIT | FLOW WAIT | OFFER --",
      offerMicroflowText: "MICRO WAIT | POD --",
      claimFamilyText: "FLOW WAIT | STATUS -- | CLAIM --",
      claimFlowText: "SEQ WAIT | FLOW WAIT | STAGE --",
      claimSummaryText: "CLAIM -- | STAGE -- | FLOW WAIT",
      claimGateText: "CLAIM -- | ENTRY WAIT | STATUS --",
      claimLeadText: "SEQ WAIT | FLOW WAIT | CLAIM --",
      claimWindowText: "CLAIM -- | STAGE -- | STATUS --",
      claimPressureText: "CLAIM -- | BAND -- | OFFER --",
      claimResponseText: "CLAIM -- | FLOW WAIT | SEQ WAIT",
      claimAttentionText: "CLAIM -- | STAGE -- | FLOW WAIT",
      claimCadenceText: "SEQ WAIT | FLOW WAIT | CLAIM --",
      claimMicroflowText: "MICRO WAIT | POD --",
      streakFamilyText: "FLOW WAIT | STATUS -- | STREAK --",
      streakFlowText: "PERSONA WAIT | FLOW WAIT | OFFER --",
      streakSummaryText: "STREAK -- | OFFER -- | FLOW WAIT",
      streakGateText: "STREAK -- | ENTRY WAIT | STATUS --",
      streakLeadText: "PERSONA WAIT | FLOW WAIT | STREAK --",
      streakWindowText: "STREAK -- | OFFER -- | STATUS --",
      streakPressureText: "STREAK -- | OFFER -- | BAND --",
      streakResponseText: "STREAK -- | FLOW WAIT | PERSONA WAIT",
      streakAttentionText: "STREAK -- | OFFER -- | FLOW WAIT",
      streakCadenceText: "PERSONA WAIT | FLOW WAIT | STREAK --",
      streakMicroflowText: "MICRO WAIT | POD --"
    };
    const lootFlowBundle = buildLoopFlowFamilyBridgeBundle(panels.lootTone, {
      familyText: panels.lootFamilyText,
      flowText: panels.lootFlowText,
      summaryText: panels.lootSummaryText,
      gateText: panels.lootGateText,
      leadText: panels.lootLeadText,
      windowText: panels.lootWindowText,
      pressureText: panels.lootPressureText,
      responseText: panels.lootResponseText,
      attentionText: panels.lootAttentionText,
      cadenceText: panels.lootCadenceText,
      focusText: panels.lootFocusText,
      stageText: panels.lootStageText,
      stateText: panels.lootStateText,
      opsText: panels.lootOpsText,
      signalText: panels.lootSignalText,
      detailText: panels.lootDetailText
    }, LOOP_FAMILY_TITLES.loot);
    const offerBundle = buildLoopFamilyBridgeBundle(panels.offerTone, {
      familyText: panels.offerFamilyText,
      flowText: panels.offerFlowText,
      summaryText: panels.offerSummaryText,
      gateText: panels.offerGateText,
      windowText: panels.offerWindowText,
      pressureText: panels.offerPressureText,
      responseText: panels.offerResponseText,
      attentionText: panels.offerAttentionText,
      cadenceText: panels.offerCadenceText
    });
    const claimBundle = buildLoopFamilyBridgeBundle(panels.claimTone, {
      familyText: panels.claimFamilyText,
      flowText: panels.claimFlowText,
      summaryText: panels.claimSummaryText,
      gateText: panels.claimGateText,
      windowText: panels.claimWindowText,
      pressureText: panels.claimPressureText,
      responseText: panels.claimResponseText,
      attentionText: panels.claimAttentionText,
      cadenceText: panels.claimCadenceText
    });
    const streakBundle = buildLoopFamilyBridgeBundle(panels.streakTone, {
      familyText: panels.streakFamilyText,
      flowText: panels.streakFlowText,
      summaryText: panels.streakSummaryText,
      gateText: panels.streakGateText,
      windowText: panels.streakWindowText,
      pressureText: panels.streakPressureText,
      responseText: panels.streakResponseText,
      attentionText: panels.streakAttentionText,
      cadenceText: panels.streakCadenceText
    });
    const offerFlowBundle = buildLoopFlowFamilyBridgeBundle(panels.offerTone, {
      familyText: panels.offerFamilyText,
      flowText: panels.offerFlowText,
      summaryText: panels.offerSummaryText,
      gateText: panels.offerGateText,
      leadText: panels.offerLeadText,
      windowText: panels.offerWindowText,
      pressureText: panels.offerPressureText,
      responseText: panels.offerResponseText,
      attentionText: panels.offerAttentionText,
      cadenceText: panels.offerCadenceText,
      focusText: panels.offerFocusText,
      stageText: panels.offerStageText,
      stateText: panels.offerStateText,
      opsText: panels.offerOpsText,
      signalText: panels.offerSignalText,
      detailText: panels.offerDetailText
    }, LOOP_FAMILY_TITLES.offer);
    const claimFlowBundle = buildLoopFlowFamilyBridgeBundle(panels.claimTone, {
      familyText: panels.claimFamilyText,
      flowText: panels.claimFlowText,
      summaryText: panels.claimSummaryText,
      gateText: panels.claimGateText,
      leadText: panels.claimLeadText,
      windowText: panels.claimWindowText,
      pressureText: panels.claimPressureText,
      responseText: panels.claimResponseText,
      attentionText: panels.claimAttentionText,
      cadenceText: panels.claimCadenceText,
      focusText: panels.claimFocusText,
      stageText: panels.claimStageText,
      stateText: panels.claimStateText,
      opsText: panels.claimOpsText,
      signalText: panels.claimSignalText,
      detailText: panels.claimDetailText
    }, LOOP_FAMILY_TITLES.claim);
    const streakFlowBundle = buildLoopFlowFamilyBridgeBundle(panels.streakTone, {
      familyText: panels.streakFamilyText,
      flowText: panels.streakFlowText,
      summaryText: panels.streakSummaryText,
      gateText: panels.streakGateText,
      leadText: panels.streakLeadText,
      windowText: panels.streakWindowText,
      pressureText: panels.streakPressureText,
      responseText: panels.streakResponseText,
      attentionText: panels.streakAttentionText,
      cadenceText: panels.streakCadenceText,
      focusText: panels.streakFocusText,
      stageText: panels.streakStageText,
      stateText: panels.streakStateText,
      opsText: panels.streakOpsText,
      signalText: panels.streakSignalText,
      detailText: panels.streakDetailText
    }, LOOP_FAMILY_TITLES.streak);
    panels.offerCards = offerBundle.cards;
    panels.offerBlocks = offerBundle.blocks;
    panels.claimCards = claimBundle.cards;
    panels.claimBlocks = claimBundle.blocks;
    panels.streakCards = streakBundle.cards;
    panels.streakBlocks = streakBundle.blocks;
    panels.offerFlowCards = offerFlowBundle.cards;
    panels.offerFlowBlocks = offerFlowBundle.blocks;
    panels.offerFlowPanels = buildLoopFlowFamilyPanels(panels.offerTone, {
      familyText: panels.offerFamilyText,
      flowText: panels.offerFlowText,
      summaryText: panels.offerSummaryText,
      gateText: panels.offerGateText,
      leadText: panels.offerLeadText,
      windowText: panels.offerWindowText,
      pressureText: panels.offerPressureText,
      responseText: panels.offerResponseText,
      attentionText: panels.offerAttentionText,
      cadenceText: panels.offerCadenceText,
      focusText: panels.offerFocusText,
      stateText: panels.offerStateText,
      stageText: panels.offerStageText,
      opsText: panels.offerOpsText,
      signalText: panels.offerSignalText,
      detailText: panels.offerDetailText
    }, ["OFFER", "STATUS", "STACK"]);
    const offerSubflowBundle = buildLoopSubflowBundle(panels.offerTone, {
      familyText: panels.offerFamilyText,
      flowText: panels.offerFlowText,
      summaryText: panels.offerSummaryText,
      gateText: panels.offerGateText,
      leadText: panels.offerLeadText,
      windowText: panels.offerWindowText,
      pressureText: panels.offerPressureText,
      responseText: panels.offerResponseText,
      attentionText: panels.offerAttentionText,
      cadenceText: panels.offerCadenceText,
      focusText: panels.offerFocusText,
      stageText: panels.offerStageText,
      stateText: panels.offerStateText,
      opsText: panels.offerOpsText,
      signalText: panels.offerSignalText,
      detailText: panels.offerDetailText
    }, LOOP_FAMILY_TITLES.offer);
    panels.offerSubflowCards = offerSubflowBundle.cards;
    panels.offerSubflowBlocks = offerSubflowBundle.blocks;
    panels.offerSubflowPanels = offerSubflowBundle.panels;
    panels.claimFlowCards = claimFlowBundle.cards;
    panels.claimFlowBlocks = claimFlowBundle.blocks;
    panels.claimFlowPanels = buildLoopFlowFamilyPanels(panels.claimTone, {
      familyText: panels.claimFamilyText,
      flowText: panels.claimFlowText,
      summaryText: panels.claimSummaryText,
      gateText: panels.claimGateText,
      leadText: panels.claimLeadText,
      windowText: panels.claimWindowText,
      pressureText: panels.claimPressureText,
      responseText: panels.claimResponseText,
      attentionText: panels.claimAttentionText,
      cadenceText: panels.claimCadenceText,
      focusText: panels.claimFocusText,
      stateText: panels.claimStateText,
      stageText: panels.claimStageText,
      opsText: panels.claimOpsText,
      signalText: panels.claimSignalText,
      detailText: panels.claimDetailText
    }, ["CLAIM", "STATUS", "PROOF"]);
    const claimSubflowBundle = buildLoopSubflowBundle(panels.claimTone, {
      familyText: panels.claimFamilyText,
      flowText: panels.claimFlowText,
      summaryText: panels.claimSummaryText,
      gateText: panels.claimGateText,
      leadText: panels.claimLeadText,
      windowText: panels.claimWindowText,
      pressureText: panels.claimPressureText,
      responseText: panels.claimResponseText,
      attentionText: panels.claimAttentionText,
      cadenceText: panels.claimCadenceText,
      focusText: panels.claimFocusText,
      stageText: panels.claimStageText,
      stateText: panels.claimStateText,
      opsText: panels.claimOpsText,
      signalText: panels.claimSignalText,
      detailText: panels.claimDetailText
    }, LOOP_FAMILY_TITLES.claim);
    panels.claimSubflowCards = claimSubflowBundle.cards;
    panels.claimSubflowBlocks = claimSubflowBundle.blocks;
    panels.claimSubflowPanels = claimSubflowBundle.panels;
    panels.streakFlowCards = streakFlowBundle.cards;
    panels.streakFlowBlocks = streakFlowBundle.blocks;
    panels.streakFlowPanels = buildLoopFlowFamilyPanels(panels.streakTone, {
      familyText: panels.streakFamilyText,
      flowText: panels.streakFlowText,
      summaryText: panels.streakSummaryText,
      gateText: panels.streakGateText,
      leadText: panels.streakLeadText,
      windowText: panels.streakWindowText,
      pressureText: panels.streakPressureText,
      responseText: panels.streakResponseText,
      attentionText: panels.streakAttentionText,
      cadenceText: panels.streakCadenceText,
      focusText: panels.streakFocusText,
      stateText: panels.streakStateText,
      stageText: panels.streakStageText,
      opsText: panels.streakOpsText,
      signalText: panels.streakSignalText,
      detailText: panels.streakDetailText
    }, ["STREAK", "STATUS", "SYNC"]);
    const streakSubflowBundle = buildLoopSubflowBundle(panels.streakTone, {
      familyText: panels.streakFamilyText,
      flowText: panels.streakFlowText,
      summaryText: panels.streakSummaryText,
      gateText: panels.streakGateText,
      leadText: panels.streakLeadText,
      windowText: panels.streakWindowText,
      pressureText: panels.streakPressureText,
      responseText: panels.streakResponseText,
      attentionText: panels.streakAttentionText,
      cadenceText: panels.streakCadenceText,
      focusText: panels.streakFocusText,
      stageText: panels.streakStageText,
      stateText: panels.streakStateText,
      opsText: panels.streakOpsText,
      signalText: panels.streakSignalText,
      detailText: panels.streakDetailText
    }, LOOP_FAMILY_TITLES.streak);
    panels.streakSubflowCards = streakSubflowBundle.cards;
    panels.streakSubflowBlocks = streakSubflowBundle.blocks;
    panels.streakSubflowPanels = streakSubflowBundle.panels;
    panels.lootFlowCards = lootFlowBundle.cards;
    panels.lootFlowBlocks = lootFlowBundle.blocks;
    panels.lootFlowPanels = buildLoopFlowFamilyPanels(panels.lootTone, {
      familyText: panels.lootFamilyText,
      flowText: panels.lootFlowText,
      summaryText: panels.lootSummaryText,
      gateText: panels.lootGateText,
      leadText: panels.lootLeadText,
      windowText: panels.lootWindowText,
      pressureText: panels.lootPressureText,
      responseText: panels.lootResponseText,
      attentionText: panels.lootAttentionText,
      cadenceText: panels.lootCadenceText,
      focusText: panels.lootFocusText,
      stateText: panels.lootStateText,
      stageText: panels.lootStageText,
      opsText: panels.lootOpsText,
      signalText: panels.lootSignalText,
      detailText: panels.lootDetailText
    }, ["OFFER", "STATE", "REVEAL"]);
    panels.lootRiskPanels = buildLoopRiskPanels(panels.lootTone, {
      familyText: panels.lootFamilyText,
      flowText: panels.lootFlowText,
      summaryText: panels.lootSummaryText,
      gateText: panels.lootGateText,
      leadText: panels.lootLeadText,
      windowText: panels.lootWindowText,
      pressureText: panels.lootPressureText,
      responseText: panels.lootResponseText,
      attentionText: panels.lootAttentionText,
      cadenceText: panels.lootCadenceText,
      focusText: panels.lootFocusText,
      stateText: panels.lootStateText,
      stageText: panels.lootStageText,
      opsText: panels.lootOpsText,
      signalText: panels.lootSignalText,
      detailText: panels.lootDetailText
    });
    const lootSubflowBundle = buildLoopSubflowBundle(panels.lootTone, {
      familyText: panels.lootFamilyText,
      flowText: panels.lootFlowText,
      summaryText: panels.lootSummaryText,
      gateText: panels.lootGateText,
      leadText: panels.lootLeadText,
      windowText: panels.lootWindowText,
      pressureText: panels.lootPressureText,
      responseText: panels.lootResponseText,
      attentionText: panels.lootAttentionText,
      cadenceText: panels.lootCadenceText,
      focusText: panels.lootFocusText,
      stageText: panels.lootStageText,
      stateText: panels.lootStateText,
      opsText: panels.lootOpsText,
      signalText: panels.lootSignalText,
      detailText: panels.lootDetailText
    }, LOOP_FAMILY_TITLES.loot);
    panels.lootSubflowCards = lootSubflowBundle.cards;
    panels.lootSubflowBlocks = lootSubflowBundle.blocks;
    panels.lootSubflowPanels = lootSubflowBundle.panels;
    return panels;
  }
  const sharedRows = [...loopDeck.loopRows, ...loopDeck.loopSignalRows];
  const offerCount = readLoopRowValue(sharedRows, ["offer_count", "active_missions"], "0");
  const claimableCount = readLoopRowValue(sharedRows, ["claimable"], "0");
  const streakValue = readLoopRowValue(sharedRows, ["streak"], "0d");
  const contractBand = readLoopRowValue(sharedRows, ["contract_band"], "--");
  const entryLabel = formatRuntimeKeyLabel(loopDeck.entryKindKey, "ENTRY");
  const sequenceLabel = formatRuntimeKeyLabel(loopDeck.sequenceKindKey, "LOOP");
  const microflowLabel = formatRuntimeKeyLabel(loopDeck.microflowKey, "FLOW");
  const microflowRailText = buildLoopMicroflowRailText(loopDeck);
  const personalityCaption = toText(loopDeck.personalityCaption, "");
  const stageValue = toText(loopDeck.stageValue || loopDeck.loopStatusLabel || "--", "--");
  const loopStatusLabel = toText(loopDeck.loopStatusLabel || "IDLE", "IDLE");
  const offerValue = `${Math.max(0, Math.round(toNum(offerCount, 0)))} LIVE`;
  const claimValue = `${Math.max(0, Math.round(toNum(claimableCount, 0)))} READY`;
  const lootValue = toNum(claimableCount, 0) > 0 ? claimValue : contractBand;
  const panels = {
    offerText: buildLoopMicroLine("OFFER", offerValue, contractBand || loopStatusLabel),
    claimText: buildLoopMicroLine("CLAIM", claimValue, stageValue),
    streakText: buildLoopMicroLine("STREAK", streakValue, loopStatusLabel),
    lootText: buildLoopMicroLine("LOOT", lootValue, contractBand || stageValue),
    offerTone: resolveLoopFamilyTone(offerValue, contractBand, loopStatusLabel),
    claimTone: resolveLoopFamilyTone(claimValue, stageValue, contractBand),
    streakTone: resolveLoopFamilyTone(streakValue, loopStatusLabel, personalityCaption),
    lootTone: resolveLoopFamilyTone(lootValue, contractBand, stageValue, loopStatusLabel),
    offerFocusText: buildLoopFocusDetail(loopDeck, "offer", `ENTRY ${entryLabel}`, `FOCUS ${offerValue}`, `FLOW ${microflowLabel}`),
    claimFocusText: buildLoopFocusDetail(loopDeck, "claim", `SEQ ${sequenceLabel}`, `FOCUS ${claimValue}`, `STAGE ${stageValue}`),
    streakFocusText: buildLoopFocusDetail(
      loopDeck,
      "streak",
      `PERSONA ${personalityCaption || "SYNC"}`,
      `FOCUS ${streakValue}`,
      `FLOW ${microflowLabel}`
    ),
    lootFocusText: buildLoopFocusDetail(loopDeck, "loot", `ENTRY ${entryLabel}`, `FOCUS ${lootValue}`, `FLOW ${microflowLabel}`),
    offerStageText: buildLoopMicroDetail(`STAGE ${stageValue}`, `STATUS ${loopStatusLabel}`, `ENTRY ${entryLabel}`),
    claimStageText: buildLoopMicroDetail(`STAGE ${stageValue}`, `STATUS ${loopStatusLabel}`, `SEQ ${sequenceLabel}`),
    streakStageText: buildLoopMicroDetail(
      `STAGE ${stageValue}`,
      `STATUS ${loopStatusLabel}`,
      `PERSONA ${personalityCaption || "SYNC"}`
    ),
    lootStageText: buildLoopMicroDetail(`STAGE ${stageValue}`, `STATUS ${loopStatusLabel}`, `CLAIM ${claimValue}`),
    offerOpsText: buildLoopMicroDetail(`ENTRY ${entryLabel}`, `OFFER ${offerValue}`, `BAND ${contractBand}`),
    claimOpsText: buildLoopMicroDetail(`SEQ ${sequenceLabel}`, `CLAIM ${claimValue}`, `BAND ${contractBand}`),
    streakOpsText: buildLoopMicroDetail(
      `PERSONA ${personalityCaption || "SYNC"}`,
      `STREAK ${streakValue}`,
      `OFFER ${offerValue}`
    ),
    lootOpsText: buildLoopMicroDetail(`ENTRY ${entryLabel}`, `CLAIM ${claimValue}`, `BAND ${contractBand}`),
    offerStateText: buildLoopMicroDetail(`FLOW ${microflowLabel}`, `ENTRY ${entryLabel}`, `OFFER ${offerValue}`),
    claimStateText: buildLoopMicroDetail(`FLOW ${microflowLabel}`, `SEQ ${sequenceLabel}`, `CLAIM ${claimValue}`),
    streakStateText: buildLoopMicroDetail(
      `FLOW ${microflowLabel}`,
      `PERSONA ${personalityCaption || "SYNC"}`,
      `STREAK ${streakValue}`
    ),
    lootStateText: buildLoopMicroDetail(`FLOW ${microflowLabel}`, `CLAIM ${claimValue}`, `BAND ${contractBand}`),
    offerSignalText: buildLoopMicroDetail(`OFFER ${offerValue}`, `BAND ${contractBand}`, `FLOW ${microflowLabel}`),
    claimSignalText: buildLoopMicroDetail(`CLAIM ${claimValue}`, `STAGE ${stageValue}`, `FLOW ${microflowLabel}`),
    streakSignalText: buildLoopMicroDetail(`STREAK ${streakValue}`, `OFFER ${offerValue}`, `FLOW ${microflowLabel}`),
    lootSignalText: buildLoopMicroDetail(`CLAIM ${claimValue}`, `BAND ${contractBand}`, `FLOW ${microflowLabel}`),
    offerDetailText: buildLoopMicroDetail(`OFFER ${offerValue}`, `BAND ${contractBand}`, entryLabel),
    claimDetailText: buildLoopMicroDetail(`CLAIM ${claimValue}`, `STAGE ${stageValue}`, sequenceLabel),
    streakDetailText: buildLoopMicroDetail(`STREAK ${streakValue}`, `OFFER ${offerValue}`, personalityCaption),
    lootDetailText: buildLoopMicroDetail(`CLAIM ${claimValue}`, `BAND ${contractBand}`, entryLabel),
    lootFamilyText: buildLoopMicroDetail(`FLOW ${microflowLabel}`, `STATUS ${loopStatusLabel}`, `BAND ${contractBand}`),
    lootFlowText: buildLoopMicroDetail(`ENTRY ${entryLabel}`, `SEQ ${sequenceLabel}`, `CLAIM ${claimValue}`),
    lootSummaryText: buildLoopMicroDetail(
      `FLOW ${microflowLabel}`,
      `STATUS ${loopStatusLabel}`,
      `PERSONA ${personalityCaption || "SYNC"}`
    ),
    lootGateText: buildLoopMicroDetail(`CLAIM ${claimValue}`, `BAND ${contractBand}`, `ENTRY ${entryLabel}`),
    lootLeadText: buildLoopMicroDetail(`ENTRY ${entryLabel}`, `FLOW ${microflowLabel}`, sequenceLabel),
    lootWindowText: buildLoopMicroDetail(`CLAIM ${claimValue}`, `OFFER ${offerValue}`, `STREAK ${streakValue}`),
    lootPressureText: buildLoopMicroDetail(`CLAIM ${claimValue}`, `BAND ${contractBand}`, `OFFER ${offerValue}`),
    lootResponseText: buildLoopMicroDetail(`STREAK ${streakValue}`, `FLOW ${loopStatusLabel}`, `ENTRY ${entryLabel}`),
    lootAttentionText: buildLoopAttentionDetail(`CLAIM ${claimValue}`, `BAND ${contractBand}`, `ENTRY ${entryLabel}`),
    lootCadenceText: buildLoopCadenceDetail(`ENTRY ${entryLabel}`, `FLOW ${microflowLabel}`, `CLAIM ${claimValue}`),
    lootMicroflowText: microflowRailText,
    lootCards: buildLoopBridgeCards(
      buildLoopBridgeCard("CLAIM", `${claimValue} | ${stageValue}`, resolveLoopFamilyTone(claimValue, stageValue), `SEQ ${sequenceLabel}`),
      buildLoopBridgeCard("OFFER", `${offerValue} | ${contractBand}`, resolveLoopFamilyTone(offerValue, contractBand), `ENTRY ${entryLabel}`),
      buildLoopBridgeCard(
        "STREAK",
        `${streakValue} | ${personalityCaption || "SYNC"}`,
        resolveLoopFamilyTone(streakValue, personalityCaption || "SYNC"),
        `FLOW ${microflowLabel}`
      )
    ),
    lootBlocks: buildLoopBridgeBlocks(
      buildLoopBridgeBlock(
        "FLOW",
        buildLoopMicroDetail(`FLOW ${microflowLabel}`, `STATUS ${loopStatusLabel}`, `BAND ${contractBand}`),
        buildLoopMicroDetail(`ENTRY ${entryLabel}`, `SEQ ${sequenceLabel}`, `CLAIM ${claimValue}`),
        resolveLoopFamilyTone(claimValue, contractBand, loopStatusLabel),
        buildLoopMicroDetail(`OFFER ${offerValue}`, `STREAK ${streakValue}`, `PERSONA ${personalityCaption || "SYNC"}`)
      ),
      buildLoopBridgeBlock(
        "GATE",
        buildLoopMicroDetail(`CLAIM ${claimValue}`, `BAND ${contractBand}`, `ENTRY ${entryLabel}`),
        buildLoopMicroDetail(`STREAK ${streakValue}`, `FLOW ${loopStatusLabel}`, `ENTRY ${entryLabel}`),
        resolveLoopFamilyTone(contractBand, claimValue, offerValue),
        buildLoopMicroDetail(`WINDOW ${claimValue}`, `OFFER ${offerValue}`, `STREAK ${streakValue}`)
      ),
      buildLoopBridgeBlock(
        "ATTN",
        buildLoopAttentionDetail(`CLAIM ${claimValue}`, `BAND ${contractBand}`, `ENTRY ${entryLabel}`),
        buildLoopCadenceDetail(`ENTRY ${entryLabel}`, `FLOW ${microflowLabel}`, `CLAIM ${claimValue}`),
        resolveLoopFamilyTone(claimValue, streakValue, contractBand),
        buildLoopMicroDetail(`STREAK ${streakValue}`, `OFFER ${offerValue}`, `FLOW ${microflowLabel}`)
      )
    ),
    offerFamilyText: buildLoopMicroDetail(`FLOW ${microflowLabel}`, `STATUS ${loopStatusLabel}`, `OFFER ${offerValue}`),
    offerFlowText: buildLoopMicroDetail(`ENTRY ${entryLabel}`, `FLOW ${microflowLabel}`, `BAND ${contractBand}`),
    offerSummaryText: buildLoopMicroDetail(`OFFER ${offerValue}`, `BAND ${contractBand}`, `FLOW ${microflowLabel}`),
    offerGateText: buildLoopMicroDetail(`OFFER ${offerValue}`, `ENTRY ${entryLabel}`, `STATUS ${loopStatusLabel}`),
    offerLeadText: buildLoopMicroDetail(`ENTRY ${entryLabel}`, `FLOW ${microflowLabel}`, `OFFER ${offerValue}`),
    offerWindowText: buildLoopMicroDetail(`OFFER ${offerValue}`, `BAND ${contractBand}`, `STATUS ${loopStatusLabel}`),
    offerPressureText: buildLoopMicroDetail(`OFFER ${offerValue}`, `BAND ${contractBand}`, `CLAIM ${claimValue}`),
    offerResponseText: buildLoopMicroDetail(`OFFER ${offerValue}`, `FLOW ${loopStatusLabel}`, `ENTRY ${entryLabel}`),
    offerAttentionText: buildLoopAttentionDetail(`OFFER ${offerValue}`, `BAND ${contractBand}`, `FLOW ${microflowLabel}`),
    offerCadenceText: buildLoopCadenceDetail(`ENTRY ${entryLabel}`, `FLOW ${microflowLabel}`, `OFFER ${offerValue}`),
    offerMicroflowText: microflowRailText,
    claimFamilyText: buildLoopMicroDetail(`FLOW ${microflowLabel}`, `STATUS ${loopStatusLabel}`, `CLAIM ${claimValue}`),
    claimFlowText: buildLoopMicroDetail(`SEQ ${sequenceLabel}`, `FLOW ${microflowLabel}`, `STAGE ${stageValue}`),
    claimSummaryText: buildLoopMicroDetail(`CLAIM ${claimValue}`, `STAGE ${stageValue}`, `FLOW ${microflowLabel}`),
    claimGateText: buildLoopMicroDetail(`CLAIM ${claimValue}`, `ENTRY ${entryLabel}`, `STATUS ${loopStatusLabel}`),
    claimLeadText: buildLoopMicroDetail(`SEQ ${sequenceLabel}`, `FLOW ${microflowLabel}`, `CLAIM ${claimValue}`),
    claimWindowText: buildLoopMicroDetail(`CLAIM ${claimValue}`, `STAGE ${stageValue}`, `STATUS ${loopStatusLabel}`),
    claimPressureText: buildLoopMicroDetail(`CLAIM ${claimValue}`, `BAND ${contractBand}`, `OFFER ${offerValue}`),
    claimResponseText: buildLoopMicroDetail(`CLAIM ${claimValue}`, `FLOW ${loopStatusLabel}`, `SEQ ${sequenceLabel}`),
    claimAttentionText: buildLoopAttentionDetail(`CLAIM ${claimValue}`, `STAGE ${stageValue}`, `FLOW ${microflowLabel}`),
    claimCadenceText: buildLoopCadenceDetail(`SEQ ${sequenceLabel}`, `FLOW ${microflowLabel}`, `CLAIM ${claimValue}`),
    claimMicroflowText: microflowRailText,
    streakFamilyText: buildLoopMicroDetail(`FLOW ${microflowLabel}`, `STATUS ${loopStatusLabel}`, `STREAK ${streakValue}`),
    streakFlowText: buildLoopMicroDetail(`PERSONA ${personalityCaption || "SYNC"}`, `FLOW ${microflowLabel}`, `OFFER ${offerValue}`),
    streakSummaryText: buildLoopMicroDetail(`STREAK ${streakValue}`, `OFFER ${offerValue}`, `FLOW ${microflowLabel}`),
    streakGateText: buildLoopMicroDetail(`STREAK ${streakValue}`, `ENTRY ${entryLabel}`, `STATUS ${loopStatusLabel}`),
    streakLeadText: buildLoopMicroDetail(`PERSONA ${personalityCaption || "SYNC"}`, `FLOW ${microflowLabel}`, `STREAK ${streakValue}`),
    streakWindowText: buildLoopMicroDetail(`STREAK ${streakValue}`, `OFFER ${offerValue}`, `STATUS ${loopStatusLabel}`),
    streakPressureText: buildLoopMicroDetail(`STREAK ${streakValue}`, `OFFER ${offerValue}`, `BAND ${contractBand}`),
    streakResponseText: buildLoopMicroDetail(`STREAK ${streakValue}`, `FLOW ${loopStatusLabel}`, `PERSONA ${personalityCaption || "SYNC"}`),
    streakAttentionText: buildLoopAttentionDetail(`STREAK ${streakValue}`, `OFFER ${offerValue}`, `FLOW ${microflowLabel}`),
    streakCadenceText: buildLoopCadenceDetail(`PERSONA ${personalityCaption || "SYNC"}`, `FLOW ${microflowLabel}`, `STREAK ${streakValue}`),
    streakMicroflowText: microflowRailText
  };
  const lootFlowBundle = buildLoopFlowFamilyBridgeBundle(panels.lootTone, {
    entryKindKey: loopDeck.entryKindKey,
    sequenceKindKey: loopDeck.sequenceKindKey,
    microflowKey: loopDeck.microflowKey,
    focusKey: loopDeck.focusKey,
    riskKey: loopDeck.riskKey,
    riskFocusKey: loopDeck.riskFocusKey,
    protocolPodKey: loopDeck.protocolPodKey,
    familyText: panels.lootFamilyText,
    flowText: panels.lootFlowText,
    summaryText: panels.lootSummaryText,
    gateText: panels.lootGateText,
    leadText: panels.lootLeadText,
    windowText: panels.lootWindowText,
    pressureText: panels.lootPressureText,
    responseText: panels.lootResponseText,
    attentionText: panels.lootAttentionText,
    cadenceText: panels.lootCadenceText,
    focusText: panels.lootFocusText,
    stageText: panels.lootStageText,
    stateText: panels.lootStateText,
    opsText: panels.lootOpsText,
    signalText: panels.lootSignalText,
    detailText: panels.lootDetailText
  }, LOOP_FAMILY_TITLES.loot);
  const offerBundle = buildLoopFamilyBridgeBundle(panels.offerTone, {
    familyText: panels.offerFamilyText,
    flowText: panels.offerFlowText,
    summaryText: panels.offerSummaryText,
    gateText: panels.offerGateText,
    windowText: panels.offerWindowText,
    pressureText: panels.offerPressureText,
    responseText: panels.offerResponseText,
    attentionText: panels.offerAttentionText,
    cadenceText: panels.offerCadenceText
  });
  const claimBundle = buildLoopFamilyBridgeBundle(panels.claimTone, {
    familyText: panels.claimFamilyText,
    flowText: panels.claimFlowText,
    summaryText: panels.claimSummaryText,
    gateText: panels.claimGateText,
    windowText: panels.claimWindowText,
    pressureText: panels.claimPressureText,
    responseText: panels.claimResponseText,
    attentionText: panels.claimAttentionText,
    cadenceText: panels.claimCadenceText
  });
  const streakBundle = buildLoopFamilyBridgeBundle(panels.streakTone, {
    familyText: panels.streakFamilyText,
    flowText: panels.streakFlowText,
    summaryText: panels.streakSummaryText,
    gateText: panels.streakGateText,
    windowText: panels.streakWindowText,
    pressureText: panels.streakPressureText,
    responseText: panels.streakResponseText,
    attentionText: panels.streakAttentionText,
    cadenceText: panels.streakCadenceText
  });
  const offerFlowBundle = buildLoopFlowFamilyBridgeBundle(panels.offerTone, {
    familyText: panels.offerFamilyText,
    flowText: panels.offerFlowText,
    summaryText: panels.offerSummaryText,
    gateText: panels.offerGateText,
    leadText: panels.offerLeadText,
    windowText: panels.offerWindowText,
    pressureText: panels.offerPressureText,
    responseText: panels.offerResponseText,
    attentionText: panels.offerAttentionText,
    cadenceText: panels.offerCadenceText,
    focusText: panels.offerFocusText,
    stageText: panels.offerStageText,
    stateText: panels.offerStateText,
    opsText: panels.offerOpsText,
    signalText: panels.offerSignalText,
    detailText: panels.offerDetailText
  }, LOOP_FAMILY_TITLES.offer);
  const claimFlowBundle = buildLoopFlowFamilyBridgeBundle(panels.claimTone, {
    familyText: panels.claimFamilyText,
    flowText: panels.claimFlowText,
    summaryText: panels.claimSummaryText,
    gateText: panels.claimGateText,
    leadText: panels.claimLeadText,
    windowText: panels.claimWindowText,
    pressureText: panels.claimPressureText,
    responseText: panels.claimResponseText,
    attentionText: panels.claimAttentionText,
    cadenceText: panels.claimCadenceText,
    focusText: panels.claimFocusText,
    stageText: panels.claimStageText,
    stateText: panels.claimStateText,
    opsText: panels.claimOpsText,
    signalText: panels.claimSignalText,
    detailText: panels.claimDetailText
  }, LOOP_FAMILY_TITLES.claim);
  const streakFlowBundle = buildLoopFlowFamilyBridgeBundle(panels.streakTone, {
    familyText: panels.streakFamilyText,
    flowText: panels.streakFlowText,
    summaryText: panels.streakSummaryText,
    gateText: panels.streakGateText,
    leadText: panels.streakLeadText,
    windowText: panels.streakWindowText,
    pressureText: panels.streakPressureText,
    responseText: panels.streakResponseText,
    attentionText: panels.streakAttentionText,
    cadenceText: panels.streakCadenceText,
    focusText: panels.streakFocusText,
    stageText: panels.streakStageText,
    stateText: panels.streakStateText,
    opsText: panels.streakOpsText,
    signalText: panels.streakSignalText,
    detailText: panels.streakDetailText
  }, LOOP_FAMILY_TITLES.streak);
  panels.offerCards = offerBundle.cards;
  panels.offerBlocks = offerBundle.blocks;
  panels.claimCards = claimBundle.cards;
  panels.claimBlocks = claimBundle.blocks;
  panels.streakCards = streakBundle.cards;
  panels.streakBlocks = streakBundle.blocks;
  panels.offerFlowCards = offerFlowBundle.cards;
  panels.offerFlowBlocks = offerFlowBundle.blocks;
  panels.offerFlowPanels = buildLoopFlowFamilyPanels(panels.offerTone, {
    familyText: panels.offerFamilyText,
    flowText: panels.offerFlowText,
    summaryText: panels.offerSummaryText,
    gateText: panels.offerGateText,
    leadText: panels.offerLeadText,
    windowText: panels.offerWindowText,
    pressureText: panels.offerPressureText,
    responseText: panels.offerResponseText,
    attentionText: panels.offerAttentionText,
    cadenceText: panels.offerCadenceText,
    focusText: panels.offerFocusText,
    stateText: panels.offerStateText,
    stageText: panels.offerStageText,
    opsText: panels.offerOpsText,
    signalText: panels.offerSignalText,
    detailText: panels.offerDetailText
  }, ["OFFER", "STATUS", "STACK"]);
  const offerSubflowBundle = buildLoopSubflowBundle(panels.offerTone, {
    familyText: panels.offerFamilyText,
    flowText: panels.offerFlowText,
    summaryText: panels.offerSummaryText,
    gateText: panels.offerGateText,
    leadText: panels.offerLeadText,
    windowText: panels.offerWindowText,
    pressureText: panels.offerPressureText,
    responseText: panels.offerResponseText,
    attentionText: panels.offerAttentionText,
    cadenceText: panels.offerCadenceText,
    focusText: panels.offerFocusText,
    stageText: panels.offerStageText,
    stateText: panels.offerStateText,
    opsText: panels.offerOpsText,
    signalText: panels.offerSignalText,
    detailText: panels.offerDetailText
  }, LOOP_FAMILY_TITLES.offer);
  panels.offerSubflowCards = offerSubflowBundle.cards;
  panels.offerSubflowBlocks = offerSubflowBundle.blocks;
  panels.offerSubflowPanels = offerSubflowBundle.panels;
  panels.claimFlowCards = claimFlowBundle.cards;
  panels.claimFlowBlocks = claimFlowBundle.blocks;
  panels.claimFlowPanels = buildLoopFlowFamilyPanels(panels.claimTone, {
    familyText: panels.claimFamilyText,
    flowText: panels.claimFlowText,
    summaryText: panels.claimSummaryText,
    gateText: panels.claimGateText,
    leadText: panels.claimLeadText,
    windowText: panels.claimWindowText,
    pressureText: panels.claimPressureText,
    responseText: panels.claimResponseText,
    attentionText: panels.claimAttentionText,
    cadenceText: panels.claimCadenceText,
    focusText: panels.claimFocusText,
    stateText: panels.claimStateText,
    stageText: panels.claimStageText,
    opsText: panels.claimOpsText,
    signalText: panels.claimSignalText,
    detailText: panels.claimDetailText
  }, ["CLAIM", "STATUS", "PROOF"]);
  const claimSubflowBundle = buildLoopSubflowBundle(panels.claimTone, {
    familyText: panels.claimFamilyText,
    flowText: panels.claimFlowText,
    summaryText: panels.claimSummaryText,
    gateText: panels.claimGateText,
    leadText: panels.claimLeadText,
    windowText: panels.claimWindowText,
    pressureText: panels.claimPressureText,
    responseText: panels.claimResponseText,
    attentionText: panels.claimAttentionText,
    cadenceText: panels.claimCadenceText,
    focusText: panels.claimFocusText,
    stageText: panels.claimStageText,
    stateText: panels.claimStateText,
    opsText: panels.claimOpsText,
    signalText: panels.claimSignalText,
    detailText: panels.claimDetailText
  }, LOOP_FAMILY_TITLES.claim);
  panels.claimSubflowCards = claimSubflowBundle.cards;
  panels.claimSubflowBlocks = claimSubflowBundle.blocks;
  panels.claimSubflowPanels = claimSubflowBundle.panels;
  panels.streakFlowCards = streakFlowBundle.cards;
  panels.streakFlowBlocks = streakFlowBundle.blocks;
  panels.streakFlowPanels = buildLoopFlowFamilyPanels(panels.streakTone, {
    familyText: panels.streakFamilyText,
    flowText: panels.streakFlowText,
    summaryText: panels.streakSummaryText,
    gateText: panels.streakGateText,
    leadText: panels.streakLeadText,
    windowText: panels.streakWindowText,
    pressureText: panels.streakPressureText,
    responseText: panels.streakResponseText,
    attentionText: panels.streakAttentionText,
    cadenceText: panels.streakCadenceText,
    focusText: panels.streakFocusText,
    stateText: panels.streakStateText,
    stageText: panels.streakStageText,
    opsText: panels.streakOpsText,
    signalText: panels.streakSignalText,
    detailText: panels.streakDetailText
  }, ["STREAK", "STATUS", "SYNC"]);
  const streakSubflowBundle = buildLoopSubflowBundle(panels.streakTone, {
    familyText: panels.streakFamilyText,
    flowText: panels.streakFlowText,
    summaryText: panels.streakSummaryText,
    gateText: panels.streakGateText,
    leadText: panels.streakLeadText,
    windowText: panels.streakWindowText,
    pressureText: panels.streakPressureText,
    responseText: panels.streakResponseText,
    attentionText: panels.streakAttentionText,
    cadenceText: panels.streakCadenceText,
    focusText: panels.streakFocusText,
    stageText: panels.streakStageText,
    stateText: panels.streakStateText,
    opsText: panels.streakOpsText,
    signalText: panels.streakSignalText,
    detailText: panels.streakDetailText
  }, LOOP_FAMILY_TITLES.streak);
  panels.streakSubflowCards = streakSubflowBundle.cards;
  panels.streakSubflowBlocks = streakSubflowBundle.blocks;
  panels.streakSubflowPanels = streakSubflowBundle.panels;
  const offerRiskBundle = buildLoopRiskBridgeBundle(panels.offerTone, {
    familyText: panels.offerFamilyText,
    flowText: panels.offerFlowText,
    summaryText: panels.offerSummaryText,
    gateText: panels.offerGateText,
    leadText: panels.offerLeadText,
    windowText: panels.offerWindowText,
    pressureText: panels.offerPressureText,
    responseText: panels.offerResponseText,
    attentionText: panels.offerAttentionText,
    cadenceText: panels.offerCadenceText,
    focusText: panels.offerFocusText,
    stateText: panels.offerStateText,
    stageText: panels.offerStageText,
    opsText: panels.offerOpsText,
    signalText: panels.offerSignalText,
    detailText: panels.offerDetailText
  });
  panels.offerRiskCards = offerRiskBundle.cards;
  panels.offerRiskBlocks = offerRiskBundle.blocks;
  panels.offerRiskPanels = buildLoopRiskPanels(panels.offerTone, {
    familyText: panels.offerFamilyText,
    flowText: panels.offerFlowText,
    summaryText: panels.offerSummaryText,
    gateText: panels.offerGateText,
    leadText: panels.offerLeadText,
    windowText: panels.offerWindowText,
    pressureText: panels.offerPressureText,
    responseText: panels.offerResponseText,
    attentionText: panels.offerAttentionText,
    cadenceText: panels.offerCadenceText,
    focusText: panels.offerFocusText,
    stateText: panels.offerStateText,
    stageText: panels.offerStageText,
    opsText: panels.offerOpsText,
    signalText: panels.offerSignalText,
    detailText: panels.offerDetailText
  });
  const claimRiskBundle = buildLoopRiskBridgeBundle(panels.claimTone, {
    familyText: panels.claimFamilyText,
    flowText: panels.claimFlowText,
    summaryText: panels.claimSummaryText,
    gateText: panels.claimGateText,
    leadText: panels.claimLeadText,
    windowText: panels.claimWindowText,
    pressureText: panels.claimPressureText,
    responseText: panels.claimResponseText,
    attentionText: panels.claimAttentionText,
    cadenceText: panels.claimCadenceText,
    focusText: panels.claimFocusText,
    stateText: panels.claimStateText,
    stageText: panels.claimStageText,
    opsText: panels.claimOpsText,
    signalText: panels.claimSignalText,
    detailText: panels.claimDetailText
  });
  panels.claimRiskCards = claimRiskBundle.cards;
  panels.claimRiskBlocks = claimRiskBundle.blocks;
  panels.claimRiskPanels = buildLoopRiskPanels(panels.claimTone, {
    familyText: panels.claimFamilyText,
    flowText: panels.claimFlowText,
    summaryText: panels.claimSummaryText,
    gateText: panels.claimGateText,
    leadText: panels.claimLeadText,
    windowText: panels.claimWindowText,
    pressureText: panels.claimPressureText,
    responseText: panels.claimResponseText,
    attentionText: panels.claimAttentionText,
    cadenceText: panels.claimCadenceText,
    focusText: panels.claimFocusText,
    stateText: panels.claimStateText,
    stageText: panels.claimStageText,
    opsText: panels.claimOpsText,
    signalText: panels.claimSignalText,
    detailText: panels.claimDetailText
  });
  const streakRiskBundle = buildLoopRiskBridgeBundle(panels.streakTone, {
    familyText: panels.streakFamilyText,
    flowText: panels.streakFlowText,
    summaryText: panels.streakSummaryText,
    gateText: panels.streakGateText,
    leadText: panels.streakLeadText,
    windowText: panels.streakWindowText,
    pressureText: panels.streakPressureText,
    responseText: panels.streakResponseText,
    attentionText: panels.streakAttentionText,
    cadenceText: panels.streakCadenceText,
    focusText: panels.streakFocusText,
    stateText: panels.streakStateText,
    stageText: panels.streakStageText,
    opsText: panels.streakOpsText,
    signalText: panels.streakSignalText,
    detailText: panels.streakDetailText
  });
  panels.streakRiskCards = streakRiskBundle.cards;
  panels.streakRiskBlocks = streakRiskBundle.blocks;
  panels.streakRiskPanels = buildLoopRiskPanels(panels.streakTone, {
    familyText: panels.streakFamilyText,
    flowText: panels.streakFlowText,
    summaryText: panels.streakSummaryText,
    gateText: panels.streakGateText,
    leadText: panels.streakLeadText,
    windowText: panels.streakWindowText,
    pressureText: panels.streakPressureText,
    responseText: panels.streakResponseText,
    attentionText: panels.streakAttentionText,
    cadenceText: panels.streakCadenceText,
    focusText: panels.streakFocusText,
    stateText: panels.streakStateText,
    stageText: panels.streakStageText,
    opsText: panels.streakOpsText,
    signalText: panels.streakSignalText,
    detailText: panels.streakDetailText
  });
  panels.lootFlowCards = lootFlowBundle.cards;
  panels.lootFlowBlocks = lootFlowBundle.blocks;
  const lootRiskBundle = buildLoopRiskBridgeBundle(panels.lootTone, {
    familyText: panels.lootFamilyText,
    flowText: panels.lootFlowText,
    summaryText: panels.lootSummaryText,
    gateText: panels.lootGateText,
    leadText: panels.lootLeadText,
    windowText: panels.lootWindowText,
    pressureText: panels.lootPressureText,
    responseText: panels.lootResponseText,
    attentionText: panels.lootAttentionText,
    cadenceText: panels.lootCadenceText,
    focusText: panels.lootFocusText,
    stateText: panels.lootStateText,
    stageText: panels.lootStageText,
    opsText: panels.lootOpsText,
    signalText: panels.lootSignalText,
    detailText: panels.lootDetailText
  });
  panels.lootRiskCards = lootRiskBundle.cards;
  panels.lootRiskBlocks = lootRiskBundle.blocks;
  panels.lootFlowPanels = buildLoopFlowFamilyPanels(panels.lootTone, {
    entryKindKey: loopDeck.entryKindKey,
    sequenceKindKey: loopDeck.sequenceKindKey,
    microflowKey: loopDeck.microflowKey,
    focusKey: loopDeck.focusKey,
    riskKey: loopDeck.riskKey,
    riskFocusKey: loopDeck.riskFocusKey,
    protocolPodKey: loopDeck.protocolPodKey,
    familyText: panels.lootFamilyText,
    flowText: panels.lootFlowText,
    summaryText: panels.lootSummaryText,
    gateText: panels.lootGateText,
    leadText: panels.lootLeadText,
    windowText: panels.lootWindowText,
    pressureText: panels.lootPressureText,
    responseText: panels.lootResponseText,
    attentionText: panels.lootAttentionText,
    cadenceText: panels.lootCadenceText,
    focusText: panels.lootFocusText,
    stateText: panels.lootStateText,
    stageText: panels.lootStageText,
    opsText: panels.lootOpsText,
    signalText: panels.lootSignalText,
    detailText: panels.lootDetailText
  }, ["OFFER", "STATE", "REVEAL"]);
  panels.lootRiskPanels = buildLoopRiskPanels(panels.lootTone, {
    familyText: panels.lootFamilyText,
    flowText: panels.lootFlowText,
    summaryText: panels.lootSummaryText,
    gateText: panels.lootGateText,
    leadText: panels.lootLeadText,
    windowText: panels.lootWindowText,
    pressureText: panels.lootPressureText,
    responseText: panels.lootResponseText,
    attentionText: panels.lootAttentionText,
    cadenceText: panels.lootCadenceText,
    focusText: panels.lootFocusText,
    stateText: panels.lootStateText,
    stageText: panels.lootStageText,
    opsText: panels.lootOpsText,
    signalText: panels.lootSignalText,
    detailText: panels.lootDetailText
  });
  const lootSubflowBundle = buildLoopSubflowBundle(panels.lootTone, {
    familyText: panels.lootFamilyText,
    flowText: panels.lootFlowText,
    summaryText: panels.lootSummaryText,
    gateText: panels.lootGateText,
    leadText: panels.lootLeadText,
    windowText: panels.lootWindowText,
    pressureText: panels.lootPressureText,
    responseText: panels.lootResponseText,
    attentionText: panels.lootAttentionText,
    cadenceText: panels.lootCadenceText,
    focusText: panels.lootFocusText,
    stageText: panels.lootStageText,
    stateText: panels.lootStateText,
    opsText: panels.lootOpsText,
    signalText: panels.lootSignalText,
    detailText: panels.lootDetailText
  }, LOOP_FAMILY_TITLES.loot);
  panels.lootSubflowCards = lootSubflowBundle.cards;
  panels.lootSubflowBlocks = lootSubflowBundle.blocks;
  panels.lootSubflowPanels = lootSubflowBundle.panels;
  return panels;
}

function buildDomainLoopPanelPayload(scene, domainKey) {
  const loopDeck = buildSceneLoopDeckPayload(scene);
  const domainConfig = {
    pvp: {
      districtKey: "arena_prime",
      standbyLabel: "PVP STANDBY",
      activeLabel: "ARENA LOOP"
    },
    vault: {
      districtKey: "exchange_district",
      standbyLabel: "VAULT STANDBY",
      activeLabel: "VAULT LOOP"
    },
    tasks: {
      districtKey: "mission_quarter",
      standbyLabel: "TASK STANDBY",
      activeLabel: "MISSION LOOP"
    },
    admin: {
      districtKey: "ops_citadel",
      standbyLabel: "OPS STANDBY",
      activeLabel: "OPS LOOP"
    }
  }[domainKey] || {
    districtKey: "",
    standbyLabel: "LOOP STANDBY",
    activeLabel: "LOOP ACTIVE"
  };
  if (!loopDeck.districtKey) {
    return {
      lineText: `${domainConfig.standbyLabel} | WAIT`,
      hintText: "Scene loop focus bekleniyor.",
      focusLineText: "FLOW | WAIT",
      opsLineText: "WAIT | FLOW IDLE",
      opsHintText: "District flow aktif degil.",
      statusLineText: "IDLE | FLOW WAIT",
      detailLineText: "Loop detay bekleniyor.",
      signalLineText: "Signal detay bekleniyor.",
      sequenceLineText: "Sequence detay bekleniyor.",
      active: false
    };
  }
  const districtMatches = domainConfig.districtKey === loopDeck.districtKey;
  const districtLabel = formatRuntimeKeyLabel(loopDeck.districtKey, "DISTRICT");
  const entryLabel = formatRuntimeKeyLabel(loopDeck.entryKindKey, "ENTRY");
  const sequenceLabel = formatRuntimeKeyLabel(loopDeck.sequenceKindKey, "LOOP");
  const microflowLabel = formatRuntimeKeyLabel(loopDeck.microflowKey, "FLOW");
  return {
    lineText: districtMatches
      ? `${domainConfig.activeLabel} | ${microflowLabel}${loopDeck.personalityLabel ? ` | ${loopDeck.personalityLabel}` : ""} | ${loopDeck.loopStatusLabel} | ${loopDeck.stageValue}`
      : `${domainConfig.standbyLabel} | ${districtLabel} ${loopDeck.loopStatusLabel}`,
    hintText: districtMatches
      ? `${entryLabel} | ${sequenceLabel}${loopDeck.densityLabel ? ` | ${loopDeck.densityLabel}` : ""}`
      : `Focus ${districtLabel} | ${entryLabel} | ${microflowLabel}`,
    focusLineText: districtMatches
      ? `${districtLabel} | ${microflowLabel}${loopDeck.personalityLabel ? ` | ${loopDeck.personalityLabel}` : ""} | ${entryLabel}`
      : `TRACK ${districtLabel} | ${microflowLabel}`,
    opsLineText: districtMatches
      ? `${loopDeck.loopStatusLabel} | ${loopDeck.stageValue} | ${microflowLabel}`
      : `FOCUS ${districtLabel} | ${loopDeck.loopStatusLabel}`,
    opsHintText: `${entryLabel} | ${sequenceLabel}${loopDeck.personalityCaption ? ` | ${loopDeck.personalityCaption}` : ""} | ${microflowLabel}`,
    statusLineText: `${loopDeck.loopStatusLabel} | ${loopDeck.stageValue} | ${entryLabel}`,
    detailLineText: loopDeck.detailLine,
    signalLineText: loopDeck.signalLine,
    sequenceLineText: loopDeck.sequenceLine,
    active: districtMatches
  };
}
function buildSceneTelemetryPayload(mutators, input) {
  if (!mutators?.computeSceneAlarmMetrics || !mutators?.computeSceneIntegrityOverlayMetrics) return null;
  const alarmMetrics = mutators.computeSceneAlarmMetrics(input);
  const integrityMetrics = mutators.computeSceneIntegrityOverlayMetrics(input);
  return {
    alarm: {
      tone: mapRuntimeTone(alarmMetrics.tone || "balanced"),
      category: toText(alarmMetrics.rejectCategory || "none", "none"),
      recent: Boolean(alarmMetrics.recentReject),
      stress: clamp(alarmMetrics.severity || 0),
      flash: clamp(alarmMetrics.sceneAlarmFlash || 0),
      badgeText: toText(alarmMetrics.alarmBadgeText, "SCENE OK"),
      badgeTone: mapBadgeTone(alarmMetrics.alarmBadgeTone || "info"),
      lineText: toText(alarmMetrics.alarmLineText, "Scene alarm telemetry bekleniyor."),
      hintText: toText(alarmMetrics.alarmHintText, "Scene guidance bekleniyor."),
      meterPct: Math.round(clamp(alarmMetrics.severity || 0) * 100),
      meterPalette: mapMeterPalette(alarmMetrics.tone || "balanced"),
      chips: [
        {
          id: "sceneAlarmPressureChip",
          text: `PRES ${Math.round(clamp(alarmMetrics.ladderPressure || 0) * 100)}%`,
          tone: mapRuntimeTone(alarmMetrics.tone || "balanced"),
          level: clamp(alarmMetrics.ladderPressure || 0)
        },
        {
          id: "sceneAlarmAssetChip",
          text: `AST ${Math.round(clamp(alarmMetrics.assetReadyRatio || 0) * 100)}%`,
          tone: mapRuntimeTone(
            (alarmMetrics.assetReadyRatio || 0) < 0.5
              ? "critical"
              : (alarmMetrics.assetReadyRatio || 0) < 0.8
                ? "pressure"
                : "advantage"
          ),
          level: clamp(alarmMetrics.assetReadyRatio || 0)
        },
        {
          id: "sceneAlarmRejectChip",
          text: toText(alarmMetrics.rejectShort || "REJ --", "REJ --"),
          tone: mapRuntimeTone(alarmMetrics.rejectTone || "neutral"),
          level: clamp(alarmMetrics.rejectSeverity || 0)
        },
        {
          id: "sceneAlarmFreshChip",
          text: `FRESH ${Math.round(clamp(alarmMetrics.ladderFreshness || 0) * 100)}%`,
          tone: mapRuntimeTone((alarmMetrics.ladderFreshness || 0) < 0.35 ? "critical" : "balanced"),
          level: clamp(alarmMetrics.ladderFreshness || 0)
        }
      ]
    },
    integrity: {
      visible: Boolean(integrityMetrics.active),
      tone: mapRuntimeTone(integrityMetrics.tone || "balanced"),
      state: integrityMetrics.active ? "active" : "idle",
      sweep: clamp(integrityMetrics.integritySweep || 0),
      flash: clamp(integrityMetrics.integrityFlash || 0),
      badgeText: toText(integrityMetrics.integrityBadgeText, "SCENE STABLE"),
      badgeTone: mapBadgeTone(integrityMetrics.integrityBadgeTone || "info"),
      lineText: toText(integrityMetrics.integrityLineText, "Asset integrity telemetry bekleniyor."),
      meterPct: Math.round(clamp(integrityMetrics.severity || 0) * 100),
      meterPalette: mapMeterPalette(integrityMetrics.tone || "balanced"),
      chips: [
        {
          id: "sceneIntegrityOverlayAssetChip",
          text: `AST ${Math.round(clamp(integrityMetrics.readyRatio || 0) * 100)}%`,
          tone: mapRuntimeTone((integrityMetrics.readyRatio || 0) < 0.5 ? "critical" : "advantage"),
          level: clamp(integrityMetrics.readyRatio || 0)
        },
        {
          id: "sceneIntegrityOverlayIntegrityChip",
          text: `INT ${Math.round(clamp(integrityMetrics.integrityRatio || 0) * 100)}%`,
          tone: mapRuntimeTone((integrityMetrics.integrityRatio || 0) < 0.65 ? "pressure" : "advantage"),
          level: clamp(integrityMetrics.integrityRatio || 0)
        },
        {
          id: "sceneIntegrityOverlaySyncChip",
          text: `SYNC ${Math.round(clamp(integrityMetrics.syncRatio || 0) * 100)}%`,
          tone: mapRuntimeTone((integrityMetrics.syncRatio || 0) < 0.65 ? "pressure" : "balanced"),
          level: clamp(integrityMetrics.syncRatio || 0)
        },
        {
          id: "sceneIntegrityOverlayRejectChip",
          text: toText(integrityMetrics.rejectChipText, "REJ --"),
          tone: mapRuntimeTone(integrityMetrics.rejectChipTone || "neutral"),
          level: clamp(integrityMetrics.rejectChipLevel || 0)
        }
      ]
    }
  };
}

function buildPvpLeaderboardPayload(pvpView) {
  const rows = asArray(pvpView?.leaderboard);
  if (!rows.length) return null;
  const summary = asRecord(pvpView?.summary);
  const acceptRate = clamp(toNum(summary.accept_rate_pct) / 100);
  const pressure = clamp(1 - acceptRate);
  const freshness = clamp(1 - toNum(summary.p95_latency_ms) / 600);
  const tone = pressure >= 0.64 ? "critical" : pressure >= 0.36 ? "pressure" : "advantage";
  const leaderSpread = rows.length > 1 ? Math.abs(toNum(rows[0].rating) - toNum(rows[rows.length - 1].rating)) : 0;
  return {
    tone,
    badgeText: `TOP ${rows.length}`,
    badgeTone: mapBadgeTone(tone),
    lineText: `Transport ${toText(summary.transport, "poll").toUpperCase()} | Tick ${Math.round(toNum(summary.tick_ms))}ms | Accept ${Math.round(toNum(summary.accept_rate_pct))}%`,
    heatPct: Math.round(clamp(rows.length / 10) * 100),
    freshPct: Math.round(freshness * 100),
    heatPalette: mapMeterPalette(tone),
    freshPalette: mapMeterPalette(freshness < 0.45 ? "critical" : "safe"),
    leaderPressure: pressure,
    chips: {
      spread: {
        text: `SPREAD ${Math.round(leaderSpread)}`,
        tone: pressure >= 0.64 ? "critical" : "balanced",
        level: clamp(leaderSpread / 500)
      },
      volume: {
        text: `VOL ${rows.length}`,
        tone: rows.length >= 8 ? "advantage" : "balanced",
        level: clamp(rows.length / 12)
      },
      fresh: {
        text: `FRESH ${Math.round(freshness * 100)}%`,
        tone: freshness < 0.45 ? "critical" : freshness < 0.75 ? "pressure" : "advantage",
        level: freshness
      },
      transport: {
        text: toText(summary.transport, "poll").toUpperCase(),
        tone: pressure >= 0.64 ? "pressure" : "neutral",
        level: acceptRate
      }
    }
  };
}

function buildAssetManifestStripPayload(assetMetrics, loopDeck, webappDomainSummary) {
  if (!assetMetrics || toNum(assetMetrics.totalEntries) <= 0) return null;
  const domainSummary = asRecord(webappDomainSummary);
  const domainStateKey = toText(domainSummary.state_key || "missing", "missing").toLowerCase();
  const assetFamilyKey = toText(loopDeck?.activeAssetFamilyKey || loopDeck?.familyKey, "");
  const assetKey = toText(loopDeck?.activeAssetKey, "");
  const assetAnchorKind = toText(loopDeck?.activeAssetAnchorKind, "");
  const assetBundleKind = toText(loopDeck?.activeAssetBundleKind, "");
  const assetVariantKey = toText(loopDeck?.activeAssetVariantKey, "");
  const assetVariantRole = toText(loopDeck?.activeAssetVariantRole, "");
  const assetVariantTier = toText(loopDeck?.activeAssetVariantTier, "");
  const assetStateKey = toText(loopDeck?.activeAssetStateKey, "");
  const assetContractSignature = toText(loopDeck?.activeAssetContractSignature, "");
  const assetContractReady = Boolean(loopDeck?.activeAssetContractReady);
  const readyCount = Math.max(0, toNum(loopDeck?.readyAssetCount || 0));
  const selectedCount = Math.max(0, toNum(loopDeck?.selectedAssetCount || 0));
  const loadedCount = Math.max(0, toNum(loopDeck?.loadedAssetCount || 0));
  const assetVariantText = assetVariantKey && assetVariantKey !== assetKey ? ` | VAR ${assetVariantKey}` : "";
  const assetBundleText = assetBundleKind
    ? ` | ${assetBundleKind}${assetVariantRole ? `/${assetVariantRole}` : ""}${assetVariantTier ? `/${assetVariantTier}` : ""}`
    : "";
  return {
    tone: mapRuntimeTone(assetMetrics.tone || "balanced"),
    badgeText: `ASSET ${toNum(assetMetrics.readyEntries)}/${toNum(assetMetrics.totalEntries)}`,
    badgeTone: mapBadgeTone(assetMetrics.tone || "info"),
    lineText: `Missing ${toNum(assetMetrics.missingEntries)} | Integrity ${Math.round(clamp(assetMetrics.integrityRatio) * 100)}%`,
    hintText: `Manifest ${toText(assetMetrics.manifestRevision, "local")} | source ${toText(assetMetrics.sourceMode, "fallback")}${assetContractSignature ? ` | SIG ${assetContractSignature}` : ""}`,
    selectionLineText:
      assetKey || selectedCount
        ? `ACTIVE ${assetFamilyKey || "district"}:${assetKey || "--"} | ${loadedCount}/${selectedCount || Math.max(1, loadedCount)} | ${assetStateKey || "missing"} | ${assetAnchorKind || "manifest"}${assetBundleText}${assetVariantText}`
        : "ACTIVE district asset bekleniyor",
    domainLineText: buildWebappDomainLine(domainSummary),
    domainStateKey,
    domainHost: toText(domainSummary.host || ""),
    runtimeGuardMatchesHost: domainSummary.runtime_guard_matches_host !== false,
    assetStateKey,
    assetContractReady,
    assetContractSignature,
    assetBundleKind,
    assetVariantKey,
    assetVariantRole,
    assetVariantTier,
    readyAssetCount: readyCount,
    selectedAssetCount: selectedCount,
    readyPct: Math.round(clamp(assetMetrics.readyRatio) * 100),
    integrityPct: Math.round(clamp(assetMetrics.integrityRatio) * 100),
    readyPalette: mapMeterPalette(assetMetrics.tone || "balanced"),
    integrityPalette: mapMeterPalette((assetMetrics.integrityRatio || 0) < 0.7 ? "critical" : "safe"),
    manifestReady: clamp(assetMetrics.readyRatio),
    manifestIntegrity: clamp(assetMetrics.integrityRatio),
    manifestRisk: clamp(assetMetrics.missingRatio),
    chips: {
      source: { text: `SRC ${toText(assetMetrics.sourceMode, "fallback").toUpperCase()}`, tone: "neutral", level: 0.4 },
      revision: { text: `REV ${toText(assetMetrics.hashShort || assetMetrics.manifestRevision || "local")}`, tone: "balanced", level: 0.5 },
      ready: {
        text: `READY ${Math.round(clamp(assetMetrics.readyRatio) * 100)}%`,
        tone: (assetMetrics.readyRatio || 0) < 0.7 ? "pressure" : "advantage",
        level: clamp(assetMetrics.readyRatio)
      },
      integrity: {
        text: `INT ${Math.round(clamp(assetMetrics.integrityRatio) * 100)}%`,
        tone: (assetMetrics.integrityRatio || 0) < 0.7 ? "critical" : "advantage",
        level: clamp(assetMetrics.integrityRatio)
      },
      host: {
        text: `HOST ${domainStateKey.toUpperCase()}`,
        tone: domainStateKey === "ready" ? "advantage" : domainStateKey === "partial" ? "pressure" : "critical",
        level: clamp(domainSummary.contract_ready ? 1 : domainSummary.dns_ready ? 0.6 : 0.2)
      },
      asset: {
        text: `AST ${assetContractReady ? "READY" : assetStateKey ? assetStateKey.toUpperCase() : "MISS"} ${readyCount}/${selectedCount || Math.max(1, readyCount)}`,
        tone: assetContractReady ? "advantage" : assetStateKey === "partial" ? "pressure" : "critical",
        level: clamp(selectedCount ? readyCount / Math.max(1, selectedCount) : 0)
      }
    }
  };
}

function normalizePvpAction(value, fallback = "strike") {
  const key = toText(value, fallback).toLowerCase();
  if (!key) return fallback;
  if (key.includes("guard") || key.includes("block")) return "guard";
  if (key.includes("charge") || key.includes("focus")) return "charge";
  if (key.includes("resolve") || key.includes("finish")) return "resolve";
  return "strike";
}

function resolvePvpRuntimeTone(threatRatio, freshnessRatio, queueRatio, latestReject) {
  const rejectHits = toNum(asRecord(latestReject).hit_count || 0);
  if (rejectHits >= 3 || threatRatio >= 0.76) return "critical";
  if (queueRatio >= 0.46 || freshnessRatio < 0.4 || threatRatio >= 0.46) return "pressure";
  if (freshnessRatio >= 0.72 && threatRatio < 0.28) return "advantage";
  return "balanced";
}

function toObjectiveTone(kind) {
  const key = toText(kind, "neutral").toLowerCase();
  if (key === "advantage" || key === "safe" || key === "ready") return "advantage";
  if (key === "pressure" || key === "warn") return "warning";
  if (key === "critical" || key === "danger") return "danger";
  return "neutral";
}

function buildPvpRuntimePayload(rawRuntime, rawLive, pvpView, scene, assetMetrics) {
  const runtimeRoot = asRecord(rawRuntime);
  const session = asRecord(runtimeRoot.session || runtimeRoot);
  const sessionState = asRecord(session.state);
  const liveRoot = asRecord(rawLive);
  const liveTickRoot = asRecord(liveRoot.tick);
  const liveTick = asRecord(liveTickRoot.tick);
  const liveTickState = asRecord(liveTick.state_json);
  const liveShadow = asRecord(liveTickRoot.shadow || liveTick.shadow || liveTickState.shadow);
  const summary = asRecord(pvpView.summary);
  const league = asRecord(pvpView.league);
  const dailyDuel = asRecord(league.daily_duel);
  const weeklyLadder = asRecord(league.weekly_ladder);
  const seasonArcBoss = asRecord(league.season_arc_boss);
  const sessionSnapshot = asRecord(league.session_snapshot);
  const trendRows = asArray(league.trend);
  const latestReject = asRecord(asArray(pvpView.reject_mix)[0]);
  const loopDeck = buildSceneLoopDeckPayload(scene);
  const loopPanel = buildDomainLoopPanelPayload(scene, "pvp");
  const loopMicro = buildPvpLoopMicroPanels(loopDeck, loopPanel.active);
  const reducedMotion = Boolean(asRecord(scene).reducedMotion);
  const lowEndMode = Boolean(asRecord(scene).lowEndMode || asRecord(scene).capabilityProfile?.low_end_mode);
  const effectiveQuality = toText(asRecord(scene).effectiveQuality || "medium", "medium").toLowerCase();
  const acceptRate = clamp(toNum(summary.accept_rate_pct) / 100);
  const freshnessRatio = clamp(1 - toNum(summary.p95_latency_ms) / 650);
  const selfScore = Math.max(0, toNum(summary.self_score));
  const opponentScore = Math.max(0, toNum(summary.opponent_score));
  const selfActions = Math.max(0, toNum(summary.self_actions));
  const opponentActions = Math.max(0, toNum(summary.opponent_actions));
  const tickMs = Math.max(0, toNum(summary.tick_ms));
  const actionWindowMs = Math.max(0, toNum(summary.action_window_ms || session.action_window_ms || liveTick.action_window_ms));
  const tickSeq = Math.max(0, toNum(liveTick.tick_seq || summary.server_tick || liveTickRoot.tick_seq));
  const queueDelta = Math.max(0, selfActions - opponentActions);
  const scoreDelta = selfScore - opponentScore;
  const pressureRatio = clamp((toNum(summary.p95_latency_ms) / 550) * 0.58 + (1 - acceptRate) * 0.42);
  const heatRatio = clamp((selfActions + opponentActions) / 18);
  const queueRatio = clamp(queueDelta / 8);
  const syncRatio = clamp(acceptRate * 0.6 + freshnessRatio * 0.4);
  const dominanceRatio = clamp((selfScore + 2) / Math.max(4, selfScore + opponentScore + 4));
  const clutchRatio = clamp(selfActions / Math.max(4, toNum(session.resolve_threshold || 6) || 6));
  const expectedAction = normalizePvpAction(
    summary.next_expected_action || session.next_expected_action || sessionState.next_expected_action || sessionState.next_expected_left || "strike"
  );
  const shadowAction = normalizePvpAction(liveShadow.input_action || sessionState.shadow_last_action || expectedAction);
  const runtimeTone = resolvePvpRuntimeTone(pressureRatio, freshnessRatio, queueRatio, latestReject);
  const phaseText = toText(summary.session_status || liveTickRoot.phase || liveTick.phase || "idle", "idle").toUpperCase();
  const dominanceState = dominanceRatio >= 0.58 ? "lead" : dominanceRatio <= 0.42 ? "trail" : "even";
  const pressureState = pressureRatio >= 0.72 ? "critical" : pressureRatio >= 0.48 ? "high" : pressureRatio >= 0.26 ? "medium" : "low";
  const radarReplay = [
    toText(liveShadow.input_action) ? { input_action: normalizePvpAction(liveShadow.input_action), accepted: liveShadow.accepted !== false, seq: tickSeq || 1 } : null,
    toText(sessionState.shadow_last_action)
      ? {
          input_action: normalizePvpAction(sessionState.shadow_last_action),
          accepted: sessionState.shadow_last_accept !== false,
          seq: Math.max(1, tickSeq - 1)
        }
      : null,
    expectedAction
      ? {
          input_action: expectedAction,
          accepted: latestReject.hit_count <= 0,
          seq: Math.max(1, tickSeq + 1)
        }
      : null
  ].filter(Boolean);
  const latestTrend = asRecord(trendRows[0]);
  const rejectReason = toText(latestReject.reason_code || sessionState.last_reject_reason || "clean", "clean").toUpperCase();
  const rejectTone = latestReject.hit_count > 0 ? runtimeTone : freshnessRatio < 0.5 ? "pressure" : "advantage";
  const recoveryRatio = clamp(syncRatio * 0.55 + (1 - queueRatio) * 0.45);
  const backoffMs =
    rejectReason === "SEQUENCE" || rejectReason === "WINDOW" ? Math.max(180, Math.round(actionWindowMs * 0.5)) : Math.max(120, Math.round(actionWindowMs * 0.24));
  const directiveLabel =
    rejectReason === "SEQUENCE"
      ? "DIR RESET_SEQ"
      : rejectReason === "WINDOW"
        ? "DIR RESYNC"
        : rejectReason === "AUTH"
          ? "DIR VERIFY"
          : `DIR ${expectedAction.toUpperCase()}`;
  const rejectSolution =
    rejectReason === "SEQUENCE"
      ? "Action sequence drift tespit edildi. Queue temizleyip yeni sirayla devam et."
      : rejectReason === "WINDOW"
        ? "Window disina tasma var. Tick penceresine yaklasip expected aksiyonu bekle."
        : rejectReason === "AUTH"
          ? "Session auth yenilenmeli. Runtime state ve wallet/session bagini dogrula."
          : latestReject.hit_count > 0
            ? `Son reject ${rejectReason}. Queue baskisini dusurup ${expectedAction.toUpperCase()} ile ritmi toparla.`
            : "Reject akisi temiz. Accept rate ve sync farkini bu banttan izle.";

  const timelineRows = [
    {
      tone: "tick",
      label: `SESSION ${phaseText}`,
      metaText: `Tick ${Math.round(tickMs)}ms | Window ${Math.round(actionWindowMs)}ms`,
      isLatest: true
    },
    Object.keys(dailyDuel).length
      ? {
          tone: dailyDuel.progress_pct >= 100 ? "resolve" : "action",
          label: `DAILY ${Math.round(toNum(dailyDuel.wins))}W/${Math.round(toNum(dailyDuel.losses))}L`,
          metaText: `Progress ${Math.round(toNum(dailyDuel.progress_pct))}% | Win ${Math.round(toNum(dailyDuel.win_rate_pct))}%`
        }
      : null,
    Object.keys(weeklyLadder).length
      ? {
          tone: Boolean(weeklyLadder.promotion_zone) ? "resolve" : "action",
          label: `LADDER #${Math.round(toNum(weeklyLadder.rank))} ${toText(weeklyLadder.tier, "UNRANKED").toUpperCase()}`,
          metaText: `Points ${Math.round(toNum(weeklyLadder.points))}`
        }
      : null,
    Object.keys(seasonArcBoss).length
      ? {
          tone: toNum(seasonArcBoss.hp_pct) <= 25 ? "resolve" : "tick",
          label: `BOSS ${toText(seasonArcBoss.phase, "IDLE").toUpperCase()}`,
          metaText: `${toText(seasonArcBoss.stage, "stage")} | HP ${Math.round(toNum(seasonArcBoss.hp_pct))}%`
        }
      : null,
    latestReject.hit_count > 0
      ? {
          tone: "reject",
          label: `REJECT ${rejectReason}`,
          metaText: `Hits ${Math.round(toNum(latestReject.hit_count))} | Accept ${Math.round(acceptRate * 100)}%`
        }
      : null,
    Object.keys(latestTrend).length
      ? {
          tone: toText(latestTrend.result) === "win" ? "resolve" : "action",
          label: `LAST ${toText(latestTrend.result, "session").toUpperCase()}`,
          metaText: `Delta ${Math.round(toNum(latestTrend.rating_delta))} | ${Math.round(toNum(latestTrend.score_self))}-${Math.round(toNum(latestTrend.score_opponent))}`
        }
      : null
  ].filter(Boolean);

  const replayRows = [
    ...radarReplay.map((row, idx) => ({
      tone: normalizePvpAction(row.input_action, "strike"),
      text: `${row.accepted === false ? "x" : "+"}${normalizePvpAction(row.input_action, "strike").toUpperCase()}`,
      isLatest: idx === 0
    })),
    Object.keys(latestTrend).length
      ? {
          tone: "resolve",
          text: `${toText(latestTrend.result, "session").toUpperCase()} ${Math.round(toNum(latestTrend.rating_delta)) >= 0 ? "+" : ""}${Math.round(
            toNum(latestTrend.rating_delta)
          )}`
        }
      : null
  ].filter(Boolean);

  const actionHistogram = radarReplay.reduce(
    (acc, row) => {
      const key = normalizePvpAction(row.input_action, "strike");
      if (key === "guard") acc.guard += 1;
      else if (key === "charge") acc.charge += 1;
      else acc.strike += 1;
      return acc;
    },
    { strike: 0, guard: 0, charge: 0 }
  );
  const latestReplay = asRecord(radarReplay[0]);
  const latestAction = normalizePvpAction(latestReplay.input_action || expectedAction, expectedAction);
  const latestAccepted = latestReplay.accepted !== false;
  const scoreTotal = Math.max(1, selfScore + opponentScore);
  const selfScoreRatio = clamp(selfScore / scoreTotal);
  const oppScoreRatio = clamp(opponentScore / scoreTotal);
  const cadenceTotal = Math.max(1, actionHistogram.strike + actionHistogram.guard + actionHistogram.charge);
  const strikeRatio = clamp(actionHistogram.strike / cadenceTotal);
  const guardRatio = clamp(actionHistogram.guard / cadenceTotal);
  const chargeRatio = clamp(actionHistogram.charge / cadenceTotal);
  const pressureClass =
    pressureRatio >= 0.72 ? "pressure-critical" : pressureRatio >= 0.52 ? "pressure-high" : pressureRatio >= 0.28 ? "pressure-medium" : "pressure-low";
  const urgency = pressureRatio >= 0.72 ? "critical" : pressureRatio >= 0.48 ? "spike" : freshnessRatio < 0.55 ? "watch" : "steady";
  const recommendation =
    pressureRatio >= 0.72
      ? "safe"
      : toNum(dailyDuel.progress_pct) >= 100 || dominanceRatio >= 0.6
        ? "aggressive"
        : "balanced";
  const bossTone = toNum(seasonArcBoss.hp_pct) <= 25 ? "critical" : toNum(seasonArcBoss.hp_pct) <= 55 ? "pressure" : "stable";
  const cameraMode =
    lowEndMode || effectiveQuality === "low"
      ? "tactical"
      : runtimeTone === "critical"
        ? "chase"
        : pressureRatio >= 0.46
          ? "tactical"
          : "broadcast";

  return {
    radar: {
      tone: mapRuntimeTone(runtimeTone),
      flowRatio: clamp(syncRatio),
      clutchVector: clamp(clutchRatio),
      queueRatio: clamp(queueRatio),
      driftRatio: clamp(Math.abs(scoreDelta) / 24),
      reducedMotion,
      replay: radarReplay,
      tickSeq,
      badgeText: phaseText,
      lineText: `Sweep ${Math.round(clamp(pressureRatio) * 100)}% | Drift ${Math.round(scoreDelta)} | Queue ${Math.round(queueDelta)}`,
      hintText: `Next ${expectedAction.toUpperCase()} | Transport ${toText(summary.transport, "poll").toUpperCase()}`,
      duelFlowLineText: `FLOW ${Math.round(clamp(syncRatio) * 100)}% | ${toText(runtimeTone, "balanced").toUpperCase()}`,
      duelFlowPct: Math.round(clamp(syncRatio) * 100),
      clutchLineText: `VECTOR ${Math.round(clamp(clutchRatio) * 100)}% | ${expectedAction.toUpperCase()}`,
      clutchPct: Math.round(clamp(clutchRatio) * 100)
    },
    rejectIntel: {
      root: {
        tone: mapRuntimeTone(rejectTone),
        category: toText(latestReject.reason_code || "none", "none").toLowerCase(),
        recent: latestReject.hit_count > 0,
        risk: clamp(Math.max(pressureRatio, queueRatio)),
        sweep: clamp(1 - freshnessRatio),
        flash: latestReject.hit_count > 0 ? 0.5 : 0
      },
      badge: {
        text: latestReject.hit_count > 0 ? `REJ ${rejectReason}` : "CLEAN",
        tone: latestReject.hit_count > 0 ? "warn" : "info"
      },
      texts: {
        line: latestReject.hit_count > 0 ? `Reject ${rejectReason} | Accept ${Math.round(acceptRate * 100)}% | Lat ${Math.round(toNum(summary.p95_latency_ms))}ms` : `Reject path clean | Accept ${Math.round(acceptRate * 100)}% | Sync ${Math.round(syncRatio * 100)}%`,
        hint: `Window ${Math.round(actionWindowMs)}ms | Queue ${Math.round(queueDelta)} | Asset ${Math.round(clamp(assetMetrics.readyRatio) * 100)}%`,
        plan: `Plan: ${directiveLabel} ve ${expectedAction.toUpperCase()} aksiyonu ile ritmi koru.`,
        solution: rejectSolution
      },
      actionPanel: {
        tone: mapRuntimeTone(rejectTone),
        category: toText(latestReject.reason_code || "none", "none").toLowerCase()
      },
      chips: {
        reason: {
          id: "pvpRejectIntelReasonChip",
          text: `REJ ${rejectReason}`,
          tone: mapRuntimeTone(rejectTone),
          level: clamp(Math.max(pressureRatio, queueRatio))
        },
        fresh: {
          id: "pvpRejectIntelFreshChip",
          text: `FRESH ${Math.round(freshnessRatio * 100)}%`,
          tone: mapRuntimeTone(freshnessRatio < 0.45 ? "critical" : freshnessRatio < 0.75 ? "pressure" : "advantage"),
          level: freshnessRatio
        },
        window: {
          id: "pvpRejectIntelWindowChip",
          text: `WND ${Math.round(actionWindowMs)}ms`,
          tone: mapRuntimeTone(actionWindowMs < 500 ? "pressure" : "balanced"),
          level: clamp(actionWindowMs / 1400)
        },
        asset: {
          id: "pvpRejectIntelAssetChip",
          text: `AST ${Math.round(clamp(assetMetrics.readyRatio) * 100)}%`,
          tone: mapRuntimeTone(assetMetrics.readyRatio < 0.65 ? "pressure" : "advantage"),
          level: clamp(assetMetrics.readyRatio)
        },
        directive: {
          id: "pvpRejectIntelDirectiveChip",
          text: directiveLabel,
          tone: mapRuntimeTone(rejectTone),
          level: clamp(Math.max(pressureRatio, 0.2))
        },
        expected: {
          id: "pvpRejectIntelExpectedChip",
          text: `EXP ${expectedAction.toUpperCase()}`,
          tone: "balanced",
          level: 0.5
        },
        queue: {
          id: "pvpRejectIntelQueueChip",
          text: `Q ${Math.round(queueDelta)}`,
          tone: mapRuntimeTone(queueRatio > 0.45 ? "pressure" : "advantage"),
          level: clamp(queueRatio)
        },
        backoff: {
          id: "pvpRejectIntelBackoffChip",
          text: `BACKOFF ${Math.round(backoffMs)}ms`,
          tone: mapRuntimeTone(backoffMs > 420 ? "pressure" : "balanced"),
          level: clamp(backoffMs / 1200)
        },
        sync: {
          id: "pvpRejectIntelSyncChip",
          text: `SYNC ${Math.round(syncRatio * 100)}%`,
          tone: mapRuntimeTone(syncRatio < 0.45 ? "critical" : syncRatio < 0.72 ? "pressure" : "advantage"),
          level: clamp(syncRatio)
        }
      },
      meters: {
        recoveryPct: Math.round(clamp(recoveryRatio) * 100),
        riskPct: Math.round(clamp(Math.max(pressureRatio, queueRatio)) * 100),
        recoveryPalette: mapMeterPalette(recoveryRatio < 0.45 ? "pressure" : "safe"),
        riskPalette: mapMeterPalette(rejectTone)
      }
    },
    director: {
      cinematic: {
        tone: mapRuntimeTone(runtimeTone),
        phaseBadgeText: phaseText,
        lineText: `Director | Sync ${Math.round(syncRatio * 100)}% | Heat ${Math.round(heatRatio * 100)}%`,
        hintText: `Tick ${Math.round(tickMs)}ms | Window ${Math.round(actionWindowMs)}ms | Next ${expectedAction.toUpperCase()}`,
        meterPct: Math.round(clamp(syncRatio * 0.55 + (1 - pressureRatio) * 0.45) * 100),
        reducedMotion
      },
      momentum: {
        selfLineText: `${Math.round(dominanceRatio * 100)}% | YOU ${Math.round(selfScore)} / ${Math.round(selfActions)} act`,
        selfMeterPct: Math.round(clamp(dominanceRatio) * 100),
        selfPalette: mapMeterPalette(runtimeTone === "critical" ? "aggressive" : dominanceRatio >= 0.55 ? "safe" : "balanced"),
        oppLineText: `${Math.round((1 - dominanceRatio) * 100)}% | OPP ${Math.round(opponentScore)} / ${Math.round(opponentActions)} act`,
        oppMeterPct: Math.round(clamp(1 - dominanceRatio) * 100),
        oppPalette: mapMeterPalette(dominanceRatio <= 0.45 ? "critical" : "balanced"),
        primaryCard: {
          label: "Daily Duel",
          value: `${Math.round(toNum(dailyDuel.wins))}W/${Math.round(toNum(dailyDuel.losses))}L`,
          meta: `${Math.round(toNum(dailyDuel.progress_pct))}% | Win ${Math.round(toNum(dailyDuel.win_rate_pct))}%`,
          tone: toObjectiveTone(toNum(dailyDuel.progress_pct) >= 100 ? "advantage" : runtimeTone)
        },
        secondaryCard: {
          label: "Weekly Ladder",
          value: `#${Math.round(toNum(weeklyLadder.rank))} | ${Math.round(toNum(weeklyLadder.points))} pts`,
          meta: `${toText(weeklyLadder.tier, "UNRANKED").toUpperCase()} | ${Boolean(weeklyLadder.promotion_zone) ? "PROMOTION" : "STABLE"}`,
          tone: toObjectiveTone(Boolean(weeklyLadder.promotion_zone) ? "advantage" : "neutral")
        },
        riskCard: {
          label: "Arc Boss",
          value: `${toText(seasonArcBoss.phase, "IDLE").toUpperCase()} ${toText(seasonArcBoss.stage, "")}`.trim(),
          meta: `HP ${Math.round(toNum(seasonArcBoss.hp_pct))}% | Attempts ${Math.round(toNum(seasonArcBoss.attempts))}`,
          tone: toObjectiveTone(toNum(seasonArcBoss.hp_pct) <= 25 ? "warning" : latestReject.hit_count > 0 ? "danger" : "neutral")
        },
        pulseObjectives: latestReject.hit_count > 0 || toNum(dailyDuel.progress_pct) >= 100,
        reducedMotion
      },
      loopLineText: loopPanel.lineText,
      loopHintText: loopPanel.hintText
    },
    events: {
      timelineRows,
      replayRows,
      timelineLimit: 8,
      replayLimit: 10,
      reducedMotion
    },
    duel: {
      tick: {
        lineText: `Tick ${Math.round(tickMs)}ms | Window ${Math.round(actionWindowMs)}ms | Server ${Math.round(toNum(summary.server_tick))}`,
        urgency: runtimeTone === "balanced" ? "neutral" : mapRuntimeTone(runtimeTone),
        live: Boolean(toText(summary.session_ref)),
        reducedMotion
      },
      theater: {
        rootTone: runtimeTone === "balanced" ? "neutral" : mapRuntimeTone(runtimeTone),
        syncLineText: `SYNC ${Math.round(syncRatio * 100)}% | Accept ${Math.round(acceptRate * 100)}%`,
        syncLineTone: syncRatio < 0.45 ? "critical" : syncRatio < 0.72 ? "pressure" : "advantage",
        syncHintText: `Transport ${toText(summary.transport, "poll").toUpperCase()} | Median ${Math.round(toNum(summary.median_latency_ms))}ms`,
        syncPct: Math.round(syncRatio * 100),
        syncPalette: mapMeterPalette(syncRatio < 0.45 ? "critical" : syncRatio < 0.72 ? "pressure" : "safe"),
        overheatLineText: `HEAT ${Math.round(heatRatio * 100)}% | Lat ${Math.round(toNum(summary.p95_latency_ms))}ms`,
        overheatLineTone: pressureRatio >= 0.72 ? "critical" : pressureRatio >= 0.45 ? "pressure" : "advantage",
        overheatHintText: latestReject.hit_count > 0 ? `Reject ${rejectReason} aktif` : "Queue ve latency bandi stabil.",
        overheatPct: Math.round(pressureRatio * 100),
        overheatPalette: mapMeterPalette(runtimeTone),
        clutchLineText: `RESOLVE ${Math.round(clutchRatio * 100)}% | Next ${expectedAction.toUpperCase()}`,
        clutchLineTone: clutchRatio < 0.4 ? "pressure" : "advantage",
        clutchHintText: `Self ${Math.round(selfActions)} | Opp ${Math.round(opponentActions)} | Snapshot #${Math.round(toNum(sessionSnapshot.rank))}`,
        clutchPct: Math.round(clutchRatio * 100),
        clutchPalette: mapMeterPalette(clutchRatio < 0.4 ? "pressure" : "safe"),
        stanceLineText: `SCORE ${Math.round(selfScore)}-${Math.round(opponentScore)} | Queue ${Math.round(queueDelta)}`,
        stanceLineTone: dominanceRatio < 0.42 ? "critical" : dominanceRatio < 0.55 ? "pressure" : "advantage",
        stanceHintText: `${toText(sessionSnapshot.last_result, "trend").toUpperCase()} | Games ${Math.round(toNum(sessionSnapshot.games_played))}`,
        stancePct: Math.round(dominanceRatio * 100),
        stancePalette: mapMeterPalette(dominanceRatio < 0.42 ? "critical" : dominanceRatio < 0.55 ? "pressure" : "safe"),
        reducedMotion
      }
    },
    combatHud: {
      pressureClass,
      urgency,
      recommendation,
      chainLineText: `CHAIN ${phaseText} | ${latestAction.toUpperCase()} ${latestAccepted ? "LOCK" : "MISS"}`,
      chainTrail: radarReplay.map((row, idx) => ({
        action: normalizePvpAction(row.input_action, "strike"),
        accepted: row.accepted !== false,
        tone:
          row.accepted === false
            ? "critical"
            : normalizePvpAction(row.input_action, "strike") === "guard"
              ? "safe"
              : normalizePvpAction(row.input_action, "strike") === "charge"
                ? "balanced"
                : "aggressive",
        isLatest: idx === 0
      })),
      energy: Math.round(clamp(syncRatio * 0.55 + dominanceRatio * 0.45) * 100),
      reactorLineText: `NEXUS ${runtimeTone.toUpperCase()} | Sync ${Math.round(syncRatio * 100)}%`,
      reactorHintText: `Accept ${Math.round(acceptRate * 100)}% | Fresh ${Math.round(freshnessRatio * 100)}% | Asset ${Math.round(
        clamp(assetMetrics.readyRatio) * 100
      )}%`,
      reactorPalette: mapMeterPalette(syncRatio < 0.45 ? "critical" : syncRatio < 0.72 ? "pressure" : "safe"),
      strategyLineText: `Mode ${recommendation.toUpperCase()} | Next ${expectedAction.toUpperCase()} | Rank #${Math.round(toNum(sessionSnapshot.rank))}`,
      timelineLineText: `Beklenen ${expectedAction.toUpperCase()} | Son ${latestAction.toUpperCase()} | Tick ${Math.round(tickMs)}ms`,
      timelineBadgeText: latestAccepted ? phaseText : `REJ ${rejectReason}`,
      timelineBadgeWarn: !latestAccepted || latestReject.hit_count > 0,
      timelineMeterPct: Math.round(clamp(syncRatio * 0.6 + clutchRatio * 0.4) * 100),
      timelineHintText: `Queue ${Math.round(queueDelta)} | Window ${Math.round(actionWindowMs)}ms | Shadow ${shadowAction.toUpperCase()}`,
      timelinePalette: mapMeterPalette(runtimeTone),
      queuePressurePct: Math.round(clamp(queueRatio) * 100),
      pressureRatioPct: Math.round(clamp(pressureRatio) * 100),
      syncDelta: Math.round((syncRatio - 0.5) * 200),
      expectedAction,
      latestAction,
      latestAccepted,
      actionCounts: actionHistogram,
      fluxLineText: `Score ${Math.round(selfScore)}-${Math.round(opponentScore)} | Delta ${Math.round(scoreDelta)}`,
      fluxHintText: `Self ${Math.round(selfActions)} act | Opp ${Math.round(opponentActions)} act | Session ${toText(summary.session_ref || "-", "-")}`,
      fluxTone: mapRuntimeTone(scoreDelta < -4 ? "critical" : scoreDelta < 0 ? "pressure" : scoreDelta > 6 ? "advantage" : "balanced"),
      fluxSelfPct: Math.round(selfScoreRatio * 100),
      fluxOppPct: Math.round(oppScoreRatio * 100),
      fluxSyncPct: Math.round(syncRatio * 100),
      fluxSelfPalette: mapMeterPalette(scoreDelta >= 0 ? "safe" : "pressure"),
      fluxOppPalette: mapMeterPalette(scoreDelta >= 0 ? "pressure" : "critical"),
      fluxSyncPalette: mapMeterPalette(syncRatio < 0.45 ? "critical" : "safe"),
      cadenceLineText: `STR ${actionHistogram.strike} | GRD ${actionHistogram.guard} | CHG ${actionHistogram.charge}`,
      cadenceHintText: `Cadence ${Math.round(strikeRatio * 100)} / ${Math.round(guardRatio * 100)} / ${Math.round(chargeRatio * 100)} | Shadow ${shadowAction.toUpperCase()}`,
      cadenceTone: mapRuntimeTone(runtimeTone),
      cadenceStrikePct: Math.round(strikeRatio * 100),
      cadenceGuardPct: Math.round(guardRatio * 100),
      cadenceChargePct: Math.round(chargeRatio * 100),
      cadenceStrikePalette: mapMeterPalette(strikeRatio >= 0.5 ? "aggressive" : "balanced"),
      cadenceGuardPalette: mapMeterPalette(guardRatio >= 0.34 ? "safe" : "balanced"),
      cadenceChargePalette: mapMeterPalette(chargeRatio >= 0.34 ? "balanced" : "neutral"),
      bossLineText: `${bossTone.toUpperCase()} | HP ${Math.round(toNum(seasonArcBoss.hp_pct))}% | Attempts ${Math.round(toNum(seasonArcBoss.attempts))}`,
      bossTone,
      bossMeterPct: Math.round(clamp(1 - toNum(seasonArcBoss.hp_pct) / 100) * 100),
      bossPalette: mapMeterPalette(toNum(seasonArcBoss.hp_pct) <= 25 ? "critical" : toNum(seasonArcBoss.hp_pct) <= 55 ? "pressure" : "safe"),
      overdriveLineText: `HEAT ${Math.round(heatRatio * 100)}% | THREAT ${Math.round(pressureRatio * 100)}% | PVP ${Math.round(
        clamp(clutchRatio * 0.55 + dominanceRatio * 0.45) * 100
      )}% | CAM ${cameraMode.toUpperCase()}`,
      overdriveHintText: `Daily ${Math.round(toNum(dailyDuel.progress_pct))}% | Ladder ${Math.round(toNum(weeklyLadder.points))} pts | Boss ${Math.round(
        toNum(seasonArcBoss.hp_pct)
      )}%`,
      overdriveTone: mapRuntimeTone(runtimeTone),
      overdriveHeatPct: Math.round(heatRatio * 100),
      overdriveThreatPct: Math.round(pressureRatio * 100),
      overdrivePvpPct: Math.round(clamp(clutchRatio * 0.55 + dominanceRatio * 0.45) * 100),
      overdriveImpulsePct: Math.round(clamp((cameraMode === "chase" ? 0.86 : cameraMode === "tactical" ? 0.62 : 0.44)) * 100),
      overdriveHeatPalette: mapMeterPalette(heatRatio > 0.72 ? "critical" : heatRatio > 0.45 ? "pressure" : "balanced"),
      overdriveThreatPalette: mapMeterPalette(runtimeTone),
      overdrivePvpPalette: mapMeterPalette(dominanceRatio >= 0.55 ? "safe" : "balanced"),
      overdriveImpulsePalette: mapMeterPalette(cameraMode === "chase" ? "critical" : cameraMode === "tactical" ? "pressure" : "safe"),
      matrixLineText: `SYNC ${Math.round(syncRatio * 100)}% | THERMAL ${Math.round(heatRatio * 100)}% | SHIELD ${Math.round(
        (1 - queueRatio) * 100
      )}% | CLUTCH ${Math.round(clutchRatio * 100)}%`,
      matrixHintText: `Asset ${Math.round(clamp(assetMetrics.readyRatio) * 100)}% | Integrity ${Math.round(
        clamp(assetMetrics.integrityRatio) * 100
      )}% | Fresh ${Math.round(freshnessRatio * 100)}%`,
      matrixTone: mapRuntimeTone(syncRatio < 0.45 ? "critical" : queueRatio > 0.46 ? "pressure" : "advantage"),
      matrixSyncPct: Math.round(syncRatio * 100),
      matrixThermalPct: Math.round(heatRatio * 100),
      matrixShieldPct: Math.round((1 - queueRatio) * 100),
      matrixClutchPct: Math.round(clutchRatio * 100),
      matrixSyncPalette: mapMeterPalette(syncRatio < 0.45 ? "critical" : "safe"),
      matrixThermalPalette: mapMeterPalette(heatRatio > 0.72 ? "critical" : heatRatio > 0.45 ? "pressure" : "balanced"),
      matrixShieldPalette: mapMeterPalette(queueRatio > 0.5 ? "critical" : "safe"),
      matrixClutchPalette: mapMeterPalette(clutchRatio < 0.4 ? "pressure" : "safe"),
      alertPrimaryLabel: `NEXT ${expectedAction.toUpperCase()}`,
      alertPrimaryTone: runtimeTone === "critical" ? "aggressive" : "balanced",
      alertSecondaryLabel: latestReject.hit_count > 0 ? `REJ ${rejectReason}` : `FLOW ${runtimeTone.toUpperCase()}`,
      alertSecondaryTone: latestReject.hit_count > 0 ? "critical" : runtimeTone === "advantage" ? "safe" : "balanced",
      alertTertiaryLabel: `${toText(summary.transport, "poll").toUpperCase()} ${Math.round(tickMs)}ms`,
      alertTertiaryTone: freshnessRatio < 0.45 ? "aggressive" : "neutral",
      alertHintText: `Snapshot #${Math.round(toNum(sessionSnapshot.rank))} | ${Math.round(toNum(sessionSnapshot.wins))}W/${Math.round(
        toNum(sessionSnapshot.losses)
      )}L | Last ${toText(sessionSnapshot.last_result, "trend").toUpperCase()}`,
      rejectCategory: toText(latestReject.reason_code || "none", "none").toLowerCase(),
      rejectTone: mapRuntimeTone(rejectTone),
      ladderTone: mapRuntimeTone(Boolean(weeklyLadder.promotion_zone) ? "advantage" : runtimeTone),
      ladderPressurePct: Math.round((1 - freshnessRatio) * 100),
      ladderFreshnessPct: Math.round(freshnessRatio * 100),
      assetTone: mapRuntimeTone(assetMetrics.tone || "balanced"),
      assetRiskPct: Math.round(clamp(assetMetrics.missingRatio) * 100),
      assetReadyPct: Math.round(clamp(assetMetrics.readyRatio) * 100),
      assetSyncPct: Math.round(clamp(assetMetrics.integrityRatio) * 100),
      loopLineText: loopPanel.lineText,
      loopHintText: loopPanel.opsHintText,
      loopFocusText: loopPanel.focusLineText,
      loopOpsLineText: loopPanel.opsLineText,
      loopSequenceText: loopPanel.sequenceLineText,
      loopStateText: loopPanel.statusLineText,
      loopDetailText: loopPanel.detailLineText,
      loopSignalText: loopPanel.signalLineText,
      loopDuelText: loopMicro.duelText,
      loopLadderText: loopMicro.ladderText,
      loopTelemetryText: loopMicro.telemetryText,
      loopDuelTone: loopMicro.duelTone,
      loopLadderTone: loopMicro.ladderTone,
      loopTelemetryTone: loopMicro.telemetryTone,
      loopDuelFocusText: loopMicro.duelFocusText,
      loopLadderFocusText: loopMicro.ladderFocusText,
      loopTelemetryFocusText: loopMicro.telemetryFocusText,
      loopDuelStageText: loopMicro.duelStageText,
      loopLadderStageText: loopMicro.ladderStageText,
      loopTelemetryStageText: loopMicro.telemetryStageText,
      loopDuelOpsText: loopMicro.duelOpsText,
      loopLadderOpsText: loopMicro.ladderOpsText,
      loopTelemetryOpsText: loopMicro.telemetryOpsText,
      loopDuelStateText: loopMicro.duelStateText,
      loopLadderStateText: loopMicro.ladderStateText,
      loopTelemetryStateText: loopMicro.telemetryStateText,
      loopDuelSignalText: loopMicro.duelSignalText,
      loopLadderSignalText: loopMicro.ladderSignalText,
      loopTelemetrySignalText: loopMicro.telemetrySignalText,
      loopDuelDetailText: loopMicro.duelDetailText,
      loopLadderDetailText: loopMicro.ladderDetailText,
      loopTelemetryDetailText: loopMicro.telemetryDetailText,
      loopDuelFamilyText: loopMicro.duelFamilyText,
      loopDuelFlowText: loopMicro.duelFlowText,
      loopDuelSummaryText: loopMicro.duelSummaryText,
      loopDuelGateText: loopMicro.duelGateText,
      loopDuelLeadText: loopMicro.duelLeadText,
      loopDuelWindowText: loopMicro.duelWindowText,
      loopDuelPressureText: loopMicro.duelPressureText,
      loopDuelResponseText: loopMicro.duelResponseText,
      loopDuelAttentionText: loopMicro.duelAttentionText,
      loopDuelCadenceText: loopMicro.duelCadenceText,
      loopDuelMicroflowText: loopMicro.duelMicroflowText,
      loopDuelCards: loopMicro.duelCards,
      loopDuelBlocks: loopMicro.duelBlocks,
      loopDuelFlowCards: loopMicro.duelFlowCards,
      loopDuelFlowBlocks: loopMicro.duelFlowBlocks,
      loopDuelRiskCards: loopMicro.duelRiskCards,
      loopDuelRiskBlocks: loopMicro.duelRiskBlocks,
      loopDuelFlowPanels: loopMicro.duelFlowPanels,
      loopDuelRiskPanels: loopMicro.duelRiskPanels,
      loopDuelSubflowCards: loopMicro.duelSubflowCards,
      loopDuelSubflowBlocks: loopMicro.duelSubflowBlocks,
      loopDuelSubflowPanels: loopMicro.duelSubflowPanels,
      loopLadderFamilyText: loopMicro.ladderFamilyText,
      loopLadderFlowText: loopMicro.ladderFlowText,
      loopLadderSummaryText: loopMicro.ladderSummaryText,
      loopLadderGateText: loopMicro.ladderGateText,
      loopLadderLeadText: loopMicro.ladderLeadText,
      loopLadderWindowText: loopMicro.ladderWindowText,
      loopLadderPressureText: loopMicro.ladderPressureText,
      loopLadderResponseText: loopMicro.ladderResponseText,
      loopLadderAttentionText: loopMicro.ladderAttentionText,
      loopLadderCadenceText: loopMicro.ladderCadenceText,
      loopLadderMicroflowText: loopMicro.ladderMicroflowText,
      loopLadderCards: loopMicro.ladderCards,
      loopLadderBlocks: loopMicro.ladderBlocks,
      loopLadderFlowCards: loopMicro.ladderFlowCards,
      loopLadderFlowBlocks: loopMicro.ladderFlowBlocks,
      loopLadderFlowPanels: loopMicro.ladderFlowPanels,
      loopLadderRiskCards: loopMicro.ladderRiskCards,
      loopLadderRiskBlocks: loopMicro.ladderRiskBlocks,
      loopLadderRiskPanels: loopMicro.ladderRiskPanels,
      loopLadderSubflowCards: loopMicro.ladderSubflowCards,
      loopLadderSubflowBlocks: loopMicro.ladderSubflowBlocks,
      loopLadderSubflowPanels: loopMicro.ladderSubflowPanels,
      loopTelemetryFamilyText: loopMicro.telemetryFamilyText,
      loopTelemetryFlowText: loopMicro.telemetryFlowText,
      loopTelemetrySummaryText: loopMicro.telemetrySummaryText,
      loopTelemetryGateText: loopMicro.telemetryGateText,
      loopTelemetryLeadText: loopMicro.telemetryLeadText,
      loopTelemetryWindowText: loopMicro.telemetryWindowText,
      loopTelemetryPressureText: loopMicro.telemetryPressureText,
      loopTelemetryResponseText: loopMicro.telemetryResponseText,
      loopTelemetryAttentionText: loopMicro.telemetryAttentionText,
      loopTelemetryCadenceText: loopMicro.telemetryCadenceText,
      loopTelemetryMicroflowText: loopMicro.telemetryMicroflowText,
      loopTelemetryCards: loopMicro.telemetryCards,
      loopTelemetryBlocks: loopMicro.telemetryBlocks,
      loopTelemetryFlowCards: loopMicro.telemetryFlowCards,
      loopTelemetryFlowBlocks: loopMicro.telemetryFlowBlocks,
      loopTelemetryFlowPanels: loopMicro.telemetryFlowPanels,
      loopTelemetryRiskCards: loopMicro.telemetryRiskCards,
      loopTelemetryRiskBlocks: loopMicro.telemetryRiskBlocks,
      loopTelemetryRiskPanels: loopMicro.telemetryRiskPanels,
      loopTelemetrySubflowCards: loopMicro.telemetrySubflowCards,
      loopTelemetrySubflowBlocks: loopMicro.telemetrySubflowBlocks,
      loopTelemetrySubflowPanels: loopMicro.telemetrySubflowPanels
    },
    camera: {
      mode: {
        key: cameraMode,
        text: `${cameraMode.toUpperCase()} | Drift ${Math.round(clamp(Math.abs(scoreDelta) / 24) * 100)}%`
      },
      focus: {
        text: `Focus ${expectedAction.toUpperCase()} | ${phaseText} | ${lowEndMode ? "LITE" : effectiveQuality.toUpperCase()}`
      },
      energy: {
        pct: Math.round(clamp(syncRatio * 0.45 + freshnessRatio * 0.25 + dominanceRatio * 0.3) * 100)
      }
    },
    roundDirector: {
      heat: {
        phase:
          phaseText === "ACTIVE"
            ? pressureRatio >= 0.72
              ? "critical"
              : heatRatio >= 0.5
                ? "overdrive"
                : "engage"
            : "warmup",
        text: `${Math.round(heatRatio * 100)}% | ${phaseText}`,
        pct: Math.round(heatRatio * 100)
      },
      tempo: {
        text: `${Math.round(syncRatio * 100)}% | Tick ${Math.round(tickMs)}ms`,
        pct: Math.round(syncRatio * 100)
      },
      dominance: {
        state: dominanceState,
        text: `YOU ${Math.round(selfScore)} - ${Math.round(opponentScore)} OPP | ${dominanceState.toUpperCase()}`,
        pct: Math.round(dominanceRatio * 100)
      },
      pressure: {
        state: pressureState,
        text: `${Math.round(pressureRatio * 100)}% | Queue ${Math.round(queueDelta)}`,
        pct: Math.round(pressureRatio * 100)
      }
    }
  };
}

function formatRewardPreview(source) {
  const item = asRecord(source);
  const reward = asRecord(item.reward || asRecord(item.meta).reward);
  const directPreview = toText(item.reward_preview || item.rewardPreview || "");
  if (directPreview) {
    return directPreview;
  }
  const sc = Math.max(0, toNum(item.reward_sc || reward.sc));
  const rc = Math.max(0, toNum(item.reward_rc || reward.rc));
  const hc = Math.max(0, toNum(item.reward_hc || reward.hc));
  const parts = [];
  if (sc > 0) parts.push(`SC +${Math.round(sc)}`);
  if (rc > 0) parts.push(`RC +${Math.round(rc)}`);
  if (hc > 0) parts.push(`HC +${Math.round(hc * 100) / 100}`);
  return parts.length ? parts.join(" | ") : "Reward verisi yok";
}

function buildOperationsDeckEvents(root, homeView) {
  const rows = asArray(root.events).slice(0, 4).map((row) => {
    const item = asRecord(row);
    return {
      label: toText(item.event_type || item.label || "event"),
      time: toText(item.event_at || item.time || ""),
      hint: toText(asRecord(item.meta).reason || asRecord(item.meta).status || item.hint || "")
    };
  });
  const summary = asRecord(homeView.summary);
  if (toNum(summary.season_days_left) > 0) {
    rows.push({
      label: "season",
      time: `D-${Math.round(toNum(summary.season_days_left))}`,
      hint: `Points ${Math.round(toNum(summary.season_points))} | Ready ${Math.round(toNum(summary.mission_ready))}`
    });
  }
  if (summary.wallet_active) {
    rows.push({
      label: "wallet",
      time: toText(summary.wallet_chain || "TON", "TON"),
      hint: `KYC ${toText(summary.wallet_kyc_status || "unknown", "unknown").toUpperCase()}`
    });
  }
  return rows.slice(0, 6);
}

function buildOperationsDeckPayload(data, taskResult, homeFeed, scene) {
  const root = asRecord(data);
  const homeView = buildHomeFeedViewModel({
    homeFeed: asRecord(homeFeed),
    bootstrap: root
  });
  const tasksView = buildTasksViewModel({
    offers: root.offers,
    missions: asRecord(root.missions).list || root.missions,
    attempts: root.attempts,
    daily: root.daily,
    taskResult
  });
  const contract = asRecord(asRecord(homeFeed).contract);
  const risk = asRecord(asRecord(homeFeed).risk);
  const activeAttempt = asRecord(asRecord(root.attempts).active || contract.active_attempt);
  const revealableAttempt = asRecord(asRecord(root.attempts).revealable || contract.revealable_attempt);
  const events = buildOperationsDeckEvents(root, homeView);
  const loopDeck = buildSceneLoopDeckPayload(scene);
  const loopPanel = buildDomainLoopPanelPayload(scene, "tasks");
  const loopMicro = buildOperationsLoopMicroPanels(loopDeck, loopPanel.active);
  return {
    offers: {
      badgeText: `${toNum(tasksView.summary.offers_total || contract.offers_total)} aktif`,
      emptyText: "Acil gorev yok.",
      items: asArray(root.offers)
        .slice(0, 4)
        .map((row) => {
          const item = asRecord(row);
          return {
            id: toNum(item.id),
            title: toText(item.title || item.label || item.task_type, "task").toUpperCase(),
            family: toText(item.task_type || item.family || "task", "task"),
            durationMinutes: formatRelativeMinutes(item.expires_at),
            difficultyPct: toNum(item.difficulty),
            rewardPreview: formatRewardPreview(item),
            remainingMins: formatRelativeMinutes(item.expires_at)
          };
        })
    },
    missions: {
      badgeText: `${toNum(homeView.summary?.mission_ready || tasksView.summary.missions_ready)} hazir`,
      emptyText: "Misyon verisi yok.",
      items: asArray(tasksView.missions).slice(0, 5).map((row) => ({
        key: toText(row.mission_key),
        title: toText(row.title, row.mission_key),
        status: row.claimed ? "ALINDI" : row.completed ? "HAZIR" : "DEVAM",
        progressText: row.claimed ? "Claim tamamlandi" : row.completed ? "Claim bekliyor" : "Mission aktif",
        canClaim: Boolean(row.can_claim)
      }))
    },
    attempts: {
      activeText: Object.keys(activeAttempt).length
        ? `${toText(activeAttempt.task_type || activeAttempt.id || "aktif", "aktif").toUpperCase()} | Fill ${Math.round(
            toNum(homeView.summary?.task_fill_pct)
          )}%`
        : `Yok | Fill ${Math.round(toNum(homeView.summary?.task_fill_pct))}%`,
      revealText: Object.keys(revealableAttempt).length
        ? `${toText(revealableAttempt.task_type || revealableAttempt.id || "reveal", "reveal").toUpperCase()} | Risk ${toText(
            risk.band || risk.status || "stable",
            "stable"
          ).toUpperCase()}`
        : `Yok | Ready ${Math.round(toNum(homeView.summary?.mission_ready))}`
    },
    events: {
      emptyText: "Event akisi bos.",
      items: events
    },
      pulse: {
        lineText: `Streak ${Math.round(toNum(homeView.summary?.streak))} | D-${Math.round(toNum(homeView.summary?.season_days_left))} | Tasks ${Math.round(
          toNum(homeView.summary?.tasks_done)
        )}/${Math.round(toNum(homeView.summary?.daily_cap))}`,
        hintText: `SC ${Math.round(toNum(homeView.summary?.sc_earned))} | RC ${Math.round(toNum(homeView.summary?.rc_earned))} | Wallet ${
          asRecord(homeView.summary).wallet_active ? "LIVE" : "OFF"
        } | ${asRecord(homeView.summary).premium_active ? "PREMIUM" : "BASE"}`,
        chips: [
        {
          id: "tasksPulseStreakChip",
          text: `STR ${Math.round(toNum(homeView.summary?.streak))}`,
          tone: toNum(homeView.summary?.streak) >= 5 ? "safe" : "neutral",
          level: clamp(toNum(homeView.summary?.streak) / 10)
        },
        {
          id: "tasksPulseSeasonChip",
          text: `D-${Math.round(toNum(homeView.summary?.season_days_left))}`,
          tone: toNum(homeView.summary?.season_days_left) <= 3 ? "pressure" : "balanced",
          level: clamp(1 - toNum(homeView.summary?.season_days_left) / 14)
        },
        {
          id: "tasksPulseEconomyChip",
          text: `SC ${Math.round(toNum(homeView.summary?.sc_earned))} | RC ${Math.round(toNum(homeView.summary?.rc_earned))}`,
          tone: toNum(homeView.summary?.rc_earned) > 0 ? "advantage" : "balanced",
          level: clamp((toNum(homeView.summary?.sc_earned) + toNum(homeView.summary?.rc_earned) * 2) / 40)
        },
        {
          id: "tasksPulseWalletChip",
          text: asRecord(homeView.summary).wallet_active ? `WL ${toText(homeView.summary?.wallet_chain, "TON").toUpperCase()}` : "WL OFF",
          tone: asRecord(homeView.summary).wallet_active ? "safe" : "pressure",
          level: asRecord(homeView.summary).wallet_active ? 0.88 : 0.22
          }
        ]
      },
      loop: {
        lineText: loopPanel.lineText,
        hintText: loopPanel.hintText,
        focusText: loopPanel.focusLineText,
        opsText: loopPanel.opsLineText,
        statusText: loopPanel.statusLineText,
        detailText: loopPanel.detailLineText,
        signalText: loopPanel.signalLineText,
        sequenceText: loopPanel.sequenceLineText,
        districtKey: loopDeck.districtKey,
        loopStatusKey: loopDeck.loopStatusKey,
        loopStatusLabel: loopDeck.loopStatusLabel,
        stageValue: loopDeck.stageValue,
        entryKindKey: loopDeck.entryKindKey,
        sequenceKindKey: loopDeck.sequenceKindKey,
        microflowKey: loopDeck.microflowKey,
        offerText: loopMicro.offerText,
        claimText: loopMicro.claimText,
        streakText: loopMicro.streakText,
        lootText: loopMicro.lootText,
        offerTone: loopMicro.offerTone,
        claimTone: loopMicro.claimTone,
        streakTone: loopMicro.streakTone,
        lootTone: loopMicro.lootTone,
        offerFocusText: loopMicro.offerFocusText,
        claimFocusText: loopMicro.claimFocusText,
        streakFocusText: loopMicro.streakFocusText,
        lootFocusText: loopMicro.lootFocusText,
        offerStageText: loopMicro.offerStageText,
        claimStageText: loopMicro.claimStageText,
        streakStageText: loopMicro.streakStageText,
        lootStageText: loopMicro.lootStageText,
        offerOpsText: loopMicro.offerOpsText,
        claimOpsText: loopMicro.claimOpsText,
        streakOpsText: loopMicro.streakOpsText,
        lootOpsText: loopMicro.lootOpsText,
        offerStateText: loopMicro.offerStateText,
        claimStateText: loopMicro.claimStateText,
        streakStateText: loopMicro.streakStateText,
        lootStateText: loopMicro.lootStateText,
        offerSignalText: loopMicro.offerSignalText,
        claimSignalText: loopMicro.claimSignalText,
        streakSignalText: loopMicro.streakSignalText,
        lootSignalText: loopMicro.lootSignalText,
        offerDetailText: loopMicro.offerDetailText,
        claimDetailText: loopMicro.claimDetailText,
        streakDetailText: loopMicro.streakDetailText,
        lootDetailText: loopMicro.lootDetailText,
        offerFamilyText: loopMicro.offerFamilyText,
        offerFlowText: loopMicro.offerFlowText,
        offerSummaryText: loopMicro.offerSummaryText,
        offerGateText: loopMicro.offerGateText,
        offerLeadText: loopMicro.offerLeadText,
        offerWindowText: loopMicro.offerWindowText,
        offerPressureText: loopMicro.offerPressureText,
        offerResponseText: loopMicro.offerResponseText,
        offerAttentionText: loopMicro.offerAttentionText,
        offerCadenceText: loopMicro.offerCadenceText,
        offerMicroflowText: loopMicro.offerMicroflowText,
        offerCards: loopMicro.offerCards,
        offerBlocks: loopMicro.offerBlocks,
        offerFlowCards: loopMicro.offerFlowCards,
        offerFlowBlocks: loopMicro.offerFlowBlocks,
        offerFlowPanels: loopMicro.offerFlowPanels,
        offerRiskCards: loopMicro.offerRiskCards,
        offerRiskBlocks: loopMicro.offerRiskBlocks,
        offerRiskPanels: loopMicro.offerRiskPanels,
        offerSubflowCards: loopMicro.offerSubflowCards,
        offerSubflowBlocks: loopMicro.offerSubflowBlocks,
        offerSubflowPanels: loopMicro.offerSubflowPanels,
        claimFamilyText: loopMicro.claimFamilyText,
        claimFlowText: loopMicro.claimFlowText,
        claimSummaryText: loopMicro.claimSummaryText,
        claimGateText: loopMicro.claimGateText,
        claimLeadText: loopMicro.claimLeadText,
        claimWindowText: loopMicro.claimWindowText,
        claimPressureText: loopMicro.claimPressureText,
        claimResponseText: loopMicro.claimResponseText,
        claimAttentionText: loopMicro.claimAttentionText,
        claimCadenceText: loopMicro.claimCadenceText,
        claimMicroflowText: loopMicro.claimMicroflowText,
        claimCards: loopMicro.claimCards,
        claimBlocks: loopMicro.claimBlocks,
        claimFlowCards: loopMicro.claimFlowCards,
        claimFlowBlocks: loopMicro.claimFlowBlocks,
        claimFlowPanels: loopMicro.claimFlowPanels,
        claimRiskCards: loopMicro.claimRiskCards,
        claimRiskBlocks: loopMicro.claimRiskBlocks,
        claimRiskPanels: loopMicro.claimRiskPanels,
        claimSubflowCards: loopMicro.claimSubflowCards,
        claimSubflowBlocks: loopMicro.claimSubflowBlocks,
        claimSubflowPanels: loopMicro.claimSubflowPanels,
        streakFamilyText: loopMicro.streakFamilyText,
        streakFlowText: loopMicro.streakFlowText,
        streakSummaryText: loopMicro.streakSummaryText,
        streakGateText: loopMicro.streakGateText,
        streakLeadText: loopMicro.streakLeadText,
        streakWindowText: loopMicro.streakWindowText,
        streakPressureText: loopMicro.streakPressureText,
        streakResponseText: loopMicro.streakResponseText,
        streakAttentionText: loopMicro.streakAttentionText,
        streakCadenceText: loopMicro.streakCadenceText,
        streakMicroflowText: loopMicro.streakMicroflowText,
        streakCards: loopMicro.streakCards,
        streakBlocks: loopMicro.streakBlocks,
        streakFlowCards: loopMicro.streakFlowCards,
        streakFlowBlocks: loopMicro.streakFlowBlocks,
        streakFlowPanels: loopMicro.streakFlowPanels,
        streakRiskCards: loopMicro.streakRiskCards,
        streakRiskBlocks: loopMicro.streakRiskBlocks,
        streakRiskPanels: loopMicro.streakRiskPanels,
        streakSubflowCards: loopMicro.streakSubflowCards,
        streakSubflowBlocks: loopMicro.streakSubflowBlocks,
        streakSubflowPanels: loopMicro.streakSubflowPanels,
        lootFamilyText: loopMicro.lootFamilyText,
        lootFlowText: loopMicro.lootFlowText,
        lootSummaryText: loopMicro.lootSummaryText,
        lootGateText: loopMicro.lootGateText,
        lootLeadText: loopMicro.lootLeadText,
        lootWindowText: loopMicro.lootWindowText,
        lootPressureText: loopMicro.lootPressureText,
        lootResponseText: loopMicro.lootResponseText,
        lootAttentionText: loopMicro.lootAttentionText,
        lootCadenceText: loopMicro.lootCadenceText,
        lootMicroflowText: loopMicro.lootMicroflowText,
        lootCards: loopMicro.lootCards,
        lootBlocks: loopMicro.lootBlocks,
        lootFlowCards: loopMicro.lootFlowCards,
        lootFlowBlocks: loopMicro.lootFlowBlocks,
        lootRiskCards: loopMicro.lootRiskCards,
        lootRiskBlocks: loopMicro.lootRiskBlocks,
        lootFlowPanels: loopMicro.lootFlowPanels,
        lootRiskPanels: loopMicro.lootRiskPanels,
        lootSubflowCards: loopMicro.lootSubflowCards,
        lootSubflowBlocks: loopMicro.lootSubflowBlocks,
        lootSubflowPanels: loopMicro.lootSubflowPanels
      }
    };
  }

function buildTokenOverviewPayload(vaultRoot, vaultView, scene) {
  const root = asRecord(vaultRoot);
  const overview = asRecord(root.overview);
  const routeStatus = asRecord(overview.route_status || root.route);
  const chains = asArray(routeStatus.chains);
  const summary = asRecord(vaultView.summary);
  const latest = asRecord(vaultView.latest);
  const loopDeck = buildSceneLoopDeckPayload(scene);
  const loopPanel = buildDomainLoopPanelPayload(scene, "vault");
  const loopMicro = buildVaultLoopMicroPanels(loopDeck, loopPanel.active);
  const selectedChain = toText(summary.token_chain || summary.wallet_chain || (chains[0] && chains[0].chain) || "TON", "TON");
  const quoteUsd = Number(toNum(latest.quote_usd)).toFixed(2);
  const routeSummary = `Routes ${Math.floor(toNum(summary.route_ok))}/${Math.floor(toNum(summary.route_total))}`;
  const walletState = summary.wallet_active
    ? `${toText(summary.wallet_chain || selectedChain, selectedChain).toUpperCase()} LIVE`
    : "WALLET OFF";
  const premiumState = summary.premium_active
    ? `PASS ${Math.round(toNum(summary.active_pass_count || 0))}`
    : "PASS OFF";
  const payoutState = summary.payout_can_request
    ? `${Number(toNum(summary.payout_requestable_btc)).toFixed(6)} BTC READY`
    : `UNLOCK ${toText(summary.payout_unlock_tier, "LOCK")}`;
  const hintText = !summary.wallet_active
    ? "Wallet bagla, sonra quote veya payout akisini ac."
    : toText(summary.wallet_kyc_status, "unknown").toLowerCase() === "blocked"
      ? "Wallet bagli ama KYC bloklu; payout ve submit akisi kilitli."
      : toText(latest.submit_status || latest.payout_request_status || latest.intent_status, "")
        ? `${toText(latest.submit_status || latest.payout_request_status || latest.intent_status, "idle").toUpperCase()} | ${payoutState}`
        : `${walletState} | ${premiumState} | ${payoutState}`;
  return {
    symbol: toText(summary.token_symbol, "NXT"),
    balanceText: Number(toNum(summary.token_balance)).toFixed(4),
    summaryText: `${Number(toNum(summary.token_balance)).toFixed(4)} ${toText(summary.token_symbol, "NXT")} | ${walletState}`,
    rateText: `$${Number(toNum(summary.token_price_usd)).toFixed(6)} / ${toText(summary.token_symbol, "NXT")} | Quote $${quoteUsd}`,
    mintableText:
      toNum(latest.quote_token_amount) > 0
        ? `${Number(toNum(latest.quote_token_amount)).toFixed(4)} ${toText(summary.token_symbol, "NXT")} | $${quoteUsd}`
        : payoutState,
    unitsText: `${routeSummary} | ${premiumState} | RC ${Math.round(toNum(summary.spend_rc || 0))}`,
    hintText,
    chainOptions: chains.map((row) => ({
      chain: toText(asRecord(row).chain || "TON", "TON"),
      payCurrency: toText(asRecord(row).pay_currency || asRecord(row).currency || "", "")
    })),
    selectedChain,
    loopLineText: loopPanel.lineText,
    loopHintText: loopPanel.hintText,
    loopFocusText: loopPanel.focusLineText,
    loopOpsLineText: loopPanel.opsLineText,
    loopOpsHintText: loopPanel.opsHintText,
    loopSequenceText: loopPanel.sequenceLineText,
    loopStateText: loopPanel.statusLineText,
    loopDetailText: loopPanel.detailLineText,
    loopSignalText: loopPanel.signalLineText,
    loopWalletText: loopMicro.walletText,
    loopPayoutText: loopMicro.payoutText,
    loopRouteText: loopMicro.routeText,
    loopPremiumText: loopMicro.premiumText,
    loopWalletTone: loopMicro.walletTone,
    loopPayoutTone: loopMicro.payoutTone,
    loopRouteTone: loopMicro.routeTone,
    loopPremiumTone: loopMicro.premiumTone,
    loopWalletFocusText: loopMicro.walletFocusText,
    loopPayoutFocusText: loopMicro.payoutFocusText,
    loopRouteFocusText: loopMicro.routeFocusText,
    loopPremiumFocusText: loopMicro.premiumFocusText,
    loopWalletStageText: loopMicro.walletStageText,
    loopPayoutStageText: loopMicro.payoutStageText,
    loopRouteStageText: loopMicro.routeStageText,
    loopPremiumStageText: loopMicro.premiumStageText,
    loopWalletOpsText: loopMicro.walletOpsText,
    loopPayoutOpsText: loopMicro.payoutOpsText,
    loopRouteOpsText: loopMicro.routeOpsText,
    loopPremiumOpsText: loopMicro.premiumOpsText,
    loopWalletStateText: loopMicro.walletStateText,
    loopPayoutStateText: loopMicro.payoutStateText,
    loopRouteStateText: loopMicro.routeStateText,
    loopPremiumStateText: loopMicro.premiumStateText,
    loopWalletSignalText: loopMicro.walletSignalText,
    loopPayoutSignalText: loopMicro.payoutSignalText,
    loopRouteSignalText: loopMicro.routeSignalText,
    loopPremiumSignalText: loopMicro.premiumSignalText,
    loopWalletDetailText: loopMicro.walletDetailText,
    loopPayoutDetailText: loopMicro.payoutDetailText,
    loopRouteDetailText: loopMicro.routeDetailText,
    loopPremiumDetailText: loopMicro.premiumDetailText,
    loopWalletFamilyText: loopMicro.walletFamilyText,
    loopWalletFlowText: loopMicro.walletFlowText,
    loopWalletSummaryText: loopMicro.walletSummaryText,
    loopWalletGateText: loopMicro.walletGateText,
    loopWalletLeadText: loopMicro.walletLeadText,
    loopWalletWindowText: loopMicro.walletWindowText,
    loopWalletPressureText: loopMicro.walletPressureText,
    loopWalletResponseText: loopMicro.walletResponseText,
    loopWalletAttentionText: loopMicro.walletAttentionText,
    loopWalletCadenceText: loopMicro.walletCadenceText,
    loopWalletMicroflowText: loopMicro.walletMicroflowText,
    loopWalletCards: loopMicro.walletCards,
    loopWalletBlocks: loopMicro.walletBlocks,
    loopWalletFlowCards: loopMicro.walletFlowCards,
    loopWalletFlowBlocks: loopMicro.walletFlowBlocks,
    loopWalletRiskCards: loopMicro.walletRiskCards,
    loopWalletRiskBlocks: loopMicro.walletRiskBlocks,
    loopWalletFlowPanels: loopMicro.walletFlowPanels,
    loopWalletRiskPanels: loopMicro.walletRiskPanels,
    loopWalletSubflowCards: loopMicro.walletSubflowCards,
    loopWalletSubflowBlocks: loopMicro.walletSubflowBlocks,
    loopWalletSubflowPanels: loopMicro.walletSubflowPanels,
    loopPayoutCards: loopMicro.payoutCards,
    loopPayoutBlocks: loopMicro.payoutBlocks,
    loopRouteCards: loopMicro.routeCards,
    loopRouteBlocks: loopMicro.routeBlocks,
    loopPremiumCards: loopMicro.premiumCards,
    loopPremiumBlocks: loopMicro.premiumBlocks,
    loopPayoutFamilyText: loopMicro.payoutFamilyText,
    loopPayoutFlowText: loopMicro.payoutFlowText,
    loopPayoutSummaryText: loopMicro.payoutSummaryText,
    loopPayoutGateText: loopMicro.payoutGateText,
    loopPayoutLeadText: loopMicro.payoutLeadText,
    loopPayoutWindowText: loopMicro.payoutWindowText,
    loopPayoutPressureText: loopMicro.payoutPressureText,
    loopPayoutResponseText: loopMicro.payoutResponseText,
    loopPayoutAttentionText: loopMicro.payoutAttentionText,
    loopPayoutCadenceText: loopMicro.payoutCadenceText,
    loopPayoutMicroflowText: loopMicro.payoutMicroflowText,
    loopRouteFamilyText: loopMicro.routeFamilyText,
    loopRouteFlowText: loopMicro.routeFlowText,
    loopRouteSummaryText: loopMicro.routeSummaryText,
    loopRouteGateText: loopMicro.routeGateText,
    loopRouteLeadText: loopMicro.routeLeadText,
    loopRouteWindowText: loopMicro.routeWindowText,
    loopRoutePressureText: loopMicro.routePressureText,
    loopRouteResponseText: loopMicro.routeResponseText,
    loopRouteAttentionText: loopMicro.routeAttentionText,
    loopRouteCadenceText: loopMicro.routeCadenceText,
    loopRouteMicroflowText: loopMicro.routeMicroflowText,
    loopPremiumFamilyText: loopMicro.premiumFamilyText,
    loopPremiumFlowText: loopMicro.premiumFlowText,
    loopPremiumSummaryText: loopMicro.premiumSummaryText,
    loopPremiumGateText: loopMicro.premiumGateText,
    loopPremiumLeadText: loopMicro.premiumLeadText,
    loopPremiumWindowText: loopMicro.premiumWindowText,
    loopPremiumPressureText: loopMicro.premiumPressureText,
    loopPremiumResponseText: loopMicro.premiumResponseText,
    loopPremiumAttentionText: loopMicro.premiumAttentionText,
    loopPremiumCadenceText: loopMicro.premiumCadenceText,
    loopPremiumMicroflowText: loopMicro.premiumMicroflowText,
    loopPayoutFlowCards: loopMicro.payoutFlowCards,
    loopPayoutFlowBlocks: loopMicro.payoutFlowBlocks,
    loopPayoutFlowPanels: loopMicro.payoutFlowPanels,
    loopPayoutRiskCards: loopMicro.payoutRiskCards,
    loopPayoutRiskBlocks: loopMicro.payoutRiskBlocks,
    loopPayoutRiskPanels: loopMicro.payoutRiskPanels,
    loopPayoutSubflowCards: loopMicro.payoutSubflowCards,
    loopPayoutSubflowBlocks: loopMicro.payoutSubflowBlocks,
    loopPayoutSubflowPanels: loopMicro.payoutSubflowPanels,
    loopRouteFlowCards: loopMicro.routeFlowCards,
    loopRouteFlowBlocks: loopMicro.routeFlowBlocks,
    loopRouteFlowPanels: loopMicro.routeFlowPanels,
    loopRouteRiskCards: loopMicro.routeRiskCards,
    loopRouteRiskBlocks: loopMicro.routeRiskBlocks,
    loopRouteRiskPanels: loopMicro.routeRiskPanels,
    loopRouteSubflowCards: loopMicro.routeSubflowCards,
    loopRouteSubflowBlocks: loopMicro.routeSubflowBlocks,
    loopRouteSubflowPanels: loopMicro.routeSubflowPanels,
    loopPremiumFlowCards: loopMicro.premiumFlowCards,
    loopPremiumFlowBlocks: loopMicro.premiumFlowBlocks,
    loopPremiumFlowPanels: loopMicro.premiumFlowPanels,
    loopPremiumRiskCards: loopMicro.premiumRiskCards,
    loopPremiumRiskBlocks: loopMicro.premiumRiskBlocks,
    loopPremiumRiskPanels: loopMicro.premiumRiskPanels,
    loopPremiumSubflowCards: loopMicro.premiumSubflowCards,
    loopPremiumSubflowBlocks: loopMicro.premiumSubflowBlocks,
    loopPremiumSubflowPanels: loopMicro.premiumSubflowPanels,
    statusChips: [
      {
        id: "tokenWalletChip",
        text: summary.wallet_active ? `WL ${toText(summary.wallet_kyc_status, "unknown").toUpperCase()}` : "WL OFF",
        tone: summary.wallet_active ? (toText(summary.wallet_kyc_status, "unknown").toLowerCase() === "approved" ? "safe" : "balanced") : "neutral",
        level: summary.wallet_active ? 0.88 : 0.2
      },
      {
        id: "tokenPayoutChip",
        text: summary.payout_can_request ? "PAY OPEN" : `PAY ${toText(summary.payout_unlock_tier, "LOCK").toUpperCase()}`,
        tone: summary.payout_can_request ? "safe" : "pressure",
        level: summary.payout_can_request ? 0.92 : clamp(toNum(summary.payout_unlock_progress) / 100)
      },
      {
        id: "tokenPremiumChip",
        text: summary.premium_active ? `PASS ${Math.round(toNum(summary.active_pass_count || 0))}` : "PASS OFF",
        tone: summary.premium_active ? "advantage" : "neutral",
        level: clamp(toNum(summary.active_pass_count || 0) / 4)
      },
      {
        id: "tokenRouteSummaryChip",
        text: `ROUTE ${Math.round(toNum(summary.route_ok))}/${Math.round(toNum(summary.route_total))}`,
        tone: toNum(summary.route_ok) > 0 ? "balanced" : "critical",
        level: clamp(toNum(summary.route_ok) / Math.max(1, toNum(summary.route_total)))
      }
    ],
    buyDisabled:
      !Boolean(summary.wallet_active) ||
      toNum(summary.route_ok) <= 0 ||
      toText(summary.wallet_kyc_status, "unknown").toLowerCase() === "blocked"
  };
}
function buildTokenTreasuryPayload(mutators, vaultRoot, vaultView) {
  if (
    !mutators?.computeTokenRouteRuntimeMetrics ||
    !mutators?.computeTokenLifecycleMetrics ||
    !mutators?.computeTokenDirectorMetrics ||
    !mutators?.computeTreasuryRuntimeMetrics
  ) {
    return null;
  }
  const root = asRecord(vaultRoot);
  const overview = asRecord(root.overview);
  const routeStatus = asRecord(overview.route_status || root.route);
  const tokenSummary = asRecord(overview.token_summary || root.summary);
  const quoteData = asRecord(root.quote);
  const buy = asRecord(root.buy);
  const submit = asRecord(root.submit);
  const payout = asRecord(root.payout);
  const summary = asRecord(vaultView.summary);
  const latest = asRecord(vaultView.latest);
  const selectedChain = toText(tokenSummary.chain || quoteData.chain || "TON", "TON");
  const routeMetrics = mutators.computeTokenRouteRuntimeMetrics({
    chains: asArray(routeStatus.chains),
    quoteData,
    payoutGate: asRecord(routeStatus.payout_gate || payout.payout_gate),
    selectedChain
  });
  const lifecycleMetrics = mutators.computeTokenLifecycleMetrics({
    lifecycle: {
      status: toText(submit.status || buy.status || payout.status || "none"),
      progress: Object.keys(submit).length ? 0.72 : Object.keys(buy).length || Object.keys(quoteData).length ? 0.38 : 0.08
    },
    route: routeMetrics,
    quoteData,
    tokenData: tokenSummary,
    quoteReady: Boolean(Object.keys(quoteData).length),
    hasRequest: Boolean(Object.keys(buy).length || Object.keys(submit).length),
    providerCount: toNum(asRecord(quoteData.quote_quorum).provider_count),
    okProviderCount: toNum(asRecord(quoteData.quote_quorum).ok_provider_count),
    agreementRatio: toNum(asRecord(quoteData.quote_quorum).agreement_ratio)
  });
  const treasuryMetrics = mutators.computeTreasuryRuntimeMetrics({
    token: {
      payout_gate: asRecord(quoteData.payout_gate || tokenSummary.payout_gate),
      auto_policy: asRecord(root.dynamic_auto_policy || routeStatus.auto_policy)
    },
    queues: {
      external_api_health: asArray(routeStatus.external_api_health),
      token_manual_queue: asArray(routeStatus.token_manual_queue),
      token_auto_decisions: asArray(routeStatus.token_auto_decisions),
      payout_queue: asArray(routeStatus.payout_queue)
    },
    routing: {
      total_routes: asArray(routeStatus.chains).length,
      enabled_routes: asArray(routeStatus.chains).filter((row) => asRecord(row).enabled !== false).length
    },
    routeChains: asArray(routeStatus.chains),
    pendingPayoutCount: toNum(asRecord(vaultView.summary).route_pending || 0)
  });
  const directorMetrics = mutators.computeTokenDirectorMetrics({
    quoteReady: Boolean(Object.keys(quoteData).length),
    hasRequest: Boolean(Object.keys(buy).length),
    txSeen: Boolean(toText(submit.tx_hash)),
    gateOpen: Boolean(routeMetrics.gateOpen),
    latestStatus: toText(submit.status || buy.status || payout.status || "none"),
    routeCoverage: routeMetrics.routeCoverage,
    verifyConfidence: lifecycleMetrics.verifyConfidence,
    providerRatio: lifecycleMetrics.providerRatio,
    timeoutRatio: clamp(
      1 - toNum(asRecord(quoteData.quote_quorum).ok_provider_count) / Math.max(1, toNum(asRecord(quoteData.quote_quorum).provider_count || 1))
    ),
    staleRatio: 0,
    queuePressure: treasuryMetrics.queuePressure,
    riskScore: clamp(1 - routeMetrics.quorumRatio),
    manualQueueCount: treasuryMetrics.manualQueueCount,
    autoDecisionCount: treasuryMetrics.autoDecisionCount,
    pendingPayoutCount: treasuryMetrics.pendingPayoutCount
  });

  const routeRows = asArray(routeStatus.chains).slice(0, 6).map((row) => {
    const item = asRecord(row);
    const enabled = item.enabled !== false;
    const chain = toText(item.chain || "TON", "TON");
    return {
      title: chain,
      meta: `${toText(item.pay_currency || item.currency || "-")} | ${enabled ? "enabled" : "disabled"} | KYC ${toText(
        summary.wallet_kyc_status || "unknown",
        "unknown"
      ).toUpperCase()}`,
      tone: enabled ? (chain.toUpperCase() === selectedChain.toUpperCase() ? "ready" : "warn") : "missing",
      chip: enabled ? (chain.toUpperCase() === selectedChain.toUpperCase() ? "ACTIVE" : "LIVE") : "OFF",
      selected: chain.toUpperCase() === selectedChain.toUpperCase()
    };
  });

  const lifecycleRows = [
    {
      title: `Quote ${Object.keys(quoteData).length ? "ready" : "waiting"}`,
      meta: `Rate ${Number(toNum(quoteData.rate || quoteData.price || 0)).toFixed(6)} | Chain ${selectedChain}`,
      tone: Object.keys(quoteData).length ? "ready" : "warn",
      chip: Object.keys(quoteData).length ? "QUOTE" : "WAIT"
    },
    {
      title: `Intent ${toText(buy.status || "idle", "idle")}`,
      meta: `Req ${toText(buy.request_id || buy.intent_request_id || "-")}`,
      tone: Object.keys(buy).length ? "ready" : "warn",
      chip: Object.keys(buy).length ? "REQ" : "IDLE"
    },
    {
      title: `Submit ${toText(submit.status || "idle", "idle")}`,
      meta: `TX ${toText(submit.tx_hash || "-")}`,
      tone: toText(submit.tx_hash) ? "ready" : Object.keys(submit).length ? "warn" : "missing",
      chip: toText(submit.tx_hash) ? "TX" : Object.keys(submit).length ? "PEND" : "NONE"
    },
    {
      title: `Payout ${toText(payout.status || "idle", "idle")}`,
      meta: `Requestable ${Number(toNum(summary.payout_requestable_btc)).toFixed(6)} BTC`,
      tone: summary.payout_can_request ? "ready" : "warn",
      chip: summary.payout_can_request ? "OPEN" : "LOCK"
    },
    {
      title: `Premium ${summary.premium_active ? "active" : "idle"}`,
      meta: `Pass ${Math.round(toNum(summary.active_pass_count))} | Cosmetics ${Math.round(toNum(summary.cosmetics_owned_count || 0))}`,
      tone: summary.premium_active ? "ready" : "warn",
      chip: summary.premium_active ? "PASS" : "OFF"
    }
  ];

  const directorRows = [
    {
      title: `Next ${toText(directorMetrics.nextStepLabel, "Quote Al")}`,
      meta: `Verify ${toText(directorMetrics.verifyStateLabel, "WAIT")}`,
      tone: directorMetrics.tone === "critical" ? "missing" : directorMetrics.tone === "pressure" ? "warn" : "ready",
      chip: toText(directorMetrics.nextStepKey || "quote", "quote").toUpperCase()
    },
    {
      title: `Queue ${Math.round(toNum(directorMetrics.manualQueueCount || 0))}`,
      meta: `Auto ${Math.round(toNum(directorMetrics.autoDecisionCount || 0))} | Payout ${Math.round(toNum(directorMetrics.pendingPayoutCount || 0))}`,
      tone: toNum(directorMetrics.queuePressure) > 0.5 ? "warn" : "ready",
      chip: `RISK ${Math.round(clamp(directorMetrics.riskRatio) * 100)}%`
    },
    {
      title: `Wallet ${summary.wallet_active ? "live" : "offline"}`,
      meta: `${toText(summary.wallet_chain || selectedChain, selectedChain).toUpperCase()} | ${toText(summary.wallet_address_masked || "-", "-")} | KYC ${toText(
        summary.wallet_kyc_status || "unknown",
        "unknown"
      ).toUpperCase()}`,
      tone: summary.wallet_active ? "ready" : "missing",
      chip: summary.wallet_active ? "LINK" : "OFF"
    },
    {
      title: `Rewards ${summary.premium_active ? "boosted" : "base"}`,
      meta: `SC ${Math.round(toNum(summary.spend_sc || 0))} | RC ${Math.round(toNum(summary.spend_rc || 0))} | HC ${Math.round(
        toNum(summary.spend_hc || 0)
      )}`,
      tone: summary.premium_active ? "ready" : "warn",
      chip: summary.premium_active ? "BOOST" : "BASE"
    }
  ];

  return {
    pulse: {
      tone: mapRuntimeTone(treasuryMetrics.tone || "balanced"),
      badgeText: treasuryMetrics.gateOpen ? "TREASURY LIVE" : "TREASURY LOCK",
      badgeTone: mapBadgeTone(treasuryMetrics.gateOpen ? "info" : "warn"),
      stateLineText: `Routes ${treasuryMetrics.enabledRoutes}/${treasuryMetrics.totalRoutes} | API ${treasuryMetrics.apiOk}/${treasuryMetrics.apiTotal} | ${toText(
        summary.wallet_chain || selectedChain,
        selectedChain
      ).toUpperCase()}`,
      gateLineText: `Gate ${treasuryMetrics.gateOpen ? "OPEN" : "LOCKED"} | Payout ${Number(toNum(summary.payout_requestable_btc)).toFixed(6)} BTC`,
      curveLineText: `Coverage ${Math.round(clamp(treasuryMetrics.routeCoverage) * 100)}% | Auto ${treasuryMetrics.autoPolicyEnabled ? "ON" : "OFF"} | Pass ${Math.round(
        toNum(summary.active_pass_count)
      )}`,
      quorumLineText: `Quorum ${toText(routeMetrics.quorumDecision, "WAIT")} | Agree ${Math.round(clamp(routeMetrics.agreementRatio) * 100)}% | KYC ${toText(
        summary.wallet_kyc_status || "unknown",
        "unknown"
      ).toUpperCase()}`,
      policyLineText: `${directorMetrics.nextStepLabel} | ${directorMetrics.verifyStateLabel} | ${toText(
        latest.submit_status || latest.payout_request_status || latest.intent_status || "idle",
        "idle"
      ).toUpperCase()}`,
      chips: [
        { id: "treasuryPulseGateChip", text: treasuryMetrics.gateOpen ? "GATE OPEN" : "GATE LOCK", tone: treasuryMetrics.gateOpen ? "safe" : "critical", level: treasuryMetrics.gateOpen ? 0.92 : 0.24 },
        { id: "treasuryPulseRouteChip", text: `ROUTE ${treasuryMetrics.enabledRoutes}/${treasuryMetrics.totalRoutes}`, tone: routeMetrics.routeCoverage < 0.5 ? "aggressive" : "balanced", level: clamp(routeMetrics.routeCoverage) },
        { id: "treasuryPulseApiChip", text: `API ${treasuryMetrics.apiOk}/${treasuryMetrics.apiTotal || 0}`, tone: treasuryMetrics.apiRatio < 0.5 ? "aggressive" : "safe", level: clamp(treasuryMetrics.apiRatio) },
        { id: "treasuryPulseQueueChip", text: `PAY ${summary.payout_can_request ? "OPEN" : "LOCK"}`, tone: summary.payout_can_request ? "safe" : "neutral", level: clamp(summary.payout_can_request ? 0.88 : treasuryMetrics.queuePressure) },
        { id: "treasuryPulsePolicyChip", text: `STEP ${directorMetrics.nextStepKey.toUpperCase()} | ${summary.premium_active ? "BOOST" : "BASE"}`, tone: directorMetrics.tone === "critical" ? "aggressive" : directorMetrics.tone === "pressure" ? "balanced" : "safe", level: clamp(directorMetrics.readinessRatio) }
      ],
      meters: [
        { id: "treasuryPulseRouteMeter", pct: Math.round(clamp(routeMetrics.routeCoverage) * 100), palette: mapMeterPalette(routeMetrics.tone) },
        { id: "treasuryPulseVerifyMeter", pct: Math.round(clamp(lifecycleMetrics.verifyConfidence) * 100), palette: mapMeterPalette(lifecycleMetrics.tone) },
        { id: "treasuryPulseRiskMeter", pct: Math.round(clamp(directorMetrics.riskRatio) * 100), palette: mapMeterPalette(directorMetrics.tone) }
      ]
    },
    route: {
      tone: mapRuntimeTone(routeMetrics.tone || "balanced"),
      routeCoverage: clamp(routeMetrics.routeCoverage),
      quorumRatio: clamp(routeMetrics.quorumRatio),
      badgeText: `ROUTE ${routeMetrics.enabledRoutes}/${routeMetrics.totalRoutes}`,
      badgeTone: mapBadgeTone(routeMetrics.tone || "info"),
      lineText: `Selected ${selectedChain} | Providers ${routeMetrics.okProviderCount}/${routeMetrics.providerCount} | Gate ${routeMetrics.gateOpen ? "OPEN" : "LOCK"}`,
      chips: [
        { id: "tokenRouteGateChip", text: routeMetrics.gateOpen ? "GATE OPEN" : "GATE LOCK", tone: mapRuntimeTone(routeMetrics.gateOpen ? "advantage" : "pressure"), level: routeMetrics.gateOpen ? 0.92 : 0.28 },
        { id: "tokenRouteCoverageChip", text: `COV ${Math.round(clamp(routeMetrics.routeCoverage) * 100)}%`, tone: mapRuntimeTone(routeMetrics.tone), level: clamp(routeMetrics.routeCoverage) },
        { id: "tokenRouteQuorumChip", text: `QUOR ${Math.round(clamp(routeMetrics.quorumRatio) * 100)}%`, tone: mapRuntimeTone(routeMetrics.quorumRatio < 0.45 ? "pressure" : "advantage"), level: clamp(routeMetrics.quorumRatio) },
        { id: "tokenRouteChainChip", text: selectedChain.toUpperCase(), tone: "balanced", level: 0.5 }
      ],
      meters: [
        { id: "tokenRouteCoverageMeter", pct: Math.round(clamp(routeMetrics.routeCoverage) * 100), palette: mapMeterPalette(routeMetrics.tone) },
        { id: "tokenRouteQuorumMeter", pct: Math.round(clamp(routeMetrics.quorumRatio) * 100), palette: mapMeterPalette(routeMetrics.quorumRatio < 0.45 ? "critical" : "safe") }
      ],
      rows: routeRows,
      emptyText: "Route verisi yok."
    },
    txLifecycle: {
      tone: mapRuntimeTone(lifecycleMetrics.tone || "balanced"),
      progressRatio: clamp(lifecycleMetrics.progressRatio),
      verifyConfidence: clamp(lifecycleMetrics.verifyConfidence),
      badgeText: toText(lifecycleMetrics.status || "idle", "idle").toUpperCase(),
      badgeTone: mapBadgeTone(lifecycleMetrics.tone || "info"),
      lineText: `Providers ${lifecycleMetrics.okProviderCount}/${lifecycleMetrics.providerCount} | Agreement ${Math.round(clamp(lifecycleMetrics.agreementRatio) * 100)}%`,
      signalLineText: `Route ${Math.round(clamp(lifecycleMetrics.routeCoverage) * 100)}% | Gate ${lifecycleMetrics.gateOpen ? "OPEN" : "LOCK"}`,
      chips: [
        { id: "tokenTxLifecycleVerifyChip", text: `VERIFY ${Math.round(clamp(lifecycleMetrics.verifyConfidence) * 100)}%`, tone: mapRuntimeTone(lifecycleMetrics.verifyConfidence < 0.45 ? "pressure" : "advantage"), level: clamp(lifecycleMetrics.verifyConfidence) },
        { id: "tokenTxLifecycleProviderChip", text: `P ${lifecycleMetrics.okProviderCount}/${lifecycleMetrics.providerCount}`, tone: mapRuntimeTone(lifecycleMetrics.providerRatio < 0.45 ? "pressure" : "balanced"), level: clamp(lifecycleMetrics.providerRatio) },
        { id: "tokenTxLifecycleStatusChip", text: toText(lifecycleMetrics.status || "none", "none").toUpperCase(), tone: mapRuntimeTone(lifecycleMetrics.tone), level: clamp(lifecycleMetrics.progressRatio) }
      ],
      meters: [
        { id: "tokenTxLifecycleProgressMeter", pct: Math.round(clamp(lifecycleMetrics.progressRatio) * 100), palette: mapMeterPalette(lifecycleMetrics.tone) },
        { id: "tokenTxLifecycleVerifyMeter", pct: Math.round(clamp(lifecycleMetrics.verifyConfidence) * 100), palette: mapMeterPalette(lifecycleMetrics.verifyConfidence < 0.45 ? "critical" : "safe") }
      ],
      rows: lifecycleRows,
      emptyText: "Token lifecycle verisi yok."
    },
    actionDirector: {
      tone: mapRuntimeTone(directorMetrics.tone || "balanced"),
      readinessRatio: clamp(directorMetrics.readinessRatio),
      riskRatio: clamp(directorMetrics.riskRatio),
      badgeText: toText(directorMetrics.nextStepKey || "quote", "quote").toUpperCase(),
      badgeTone: mapBadgeTone(directorMetrics.tone || "info"),
      lineText: `Next ${toText(directorMetrics.nextStepLabel, "Quote Al")}`,
      stepLineText: `Verify ${toText(directorMetrics.verifyStateLabel, "WAIT")} | Queue ${Math.round(toNum(directorMetrics.manualQueueCount || 0))}`,
      chips: [
        { id: "tokenActionDirectorReadyChip", text: `READY ${Math.round(clamp(directorMetrics.readinessRatio) * 100)}%`, tone: mapRuntimeTone(directorMetrics.readinessRatio < 0.45 ? "pressure" : "advantage"), level: clamp(directorMetrics.readinessRatio) },
        { id: "tokenActionDirectorRiskChip", text: `RISK ${Math.round(clamp(directorMetrics.riskRatio) * 100)}%`, tone: mapRuntimeTone(directorMetrics.tone), level: clamp(directorMetrics.riskRatio) },
        { id: "tokenActionDirectorQueueChip", text: `QUEUE ${Math.round(toNum(directorMetrics.manualQueueCount || 0))}`, tone: mapRuntimeTone((directorMetrics.queuePressure || 0) > 0.5 ? "pressure" : "balanced"), level: clamp(directorMetrics.queuePressure || 0) }
      ],
      meters: [
        { id: "tokenActionDirectorReadyMeter", pct: Math.round(clamp(directorMetrics.readinessRatio) * 100), palette: mapMeterPalette(directorMetrics.readinessRatio < 0.45 ? "pressure" : "safe") },
        { id: "tokenActionDirectorRiskMeter", pct: Math.round(clamp(directorMetrics.riskRatio) * 100), palette: mapMeterPalette(directorMetrics.tone) }
      ],
      rows: directorRows,
      emptyText: "Director verisi yok."
    }
  };
}
function buildAdminRuntimePayload(adminRuntime, adminPanels, scene) {
  const summary = asRecord(adminRuntime?.summary);
  const queue = asArray(adminRuntime?.queue);
  const deploy = asRecord(adminPanels?.deploy_status);
  const bot = asRecord(adminPanels?.runtime_bot);
  const latest = asRecord(bot.latest);
  const featureFlags = asRecord(summary.feature_flags);
  const sourceMode = toText(asRecord(summary.runtime_flags).source_mode || deploy.bundle_mode || "runtime");
  const loopDeck = buildSceneLoopDeckPayload(scene);
  const loopPanel = buildDomainLoopPanelPayload(scene, "admin");
  const loopMicro = buildAdminLoopMicroPanels(loopDeck, loopPanel.active);
  return {
    lineText: `Queue ${queue.length} | Bundle ${toText(deploy.bundle_mode || deploy.webapp_bundle_mode || "unknown")} | Flags ${Object.keys(featureFlags).length}`,
    eventsLineText: `Bot ${toText(latest.state_key || latest.status || "idle")} | Lock ${latest.lock_acquired === true ? "yes" : "no"} | Source ${sourceMode}`,
    loopLineText: loopPanel.lineText,
    loopHintText: loopPanel.hintText,
    loopFocusText: loopPanel.focusLineText,
    loopOpsLineText: loopPanel.opsLineText,
    loopOpsHintText: loopPanel.opsHintText,
    loopSequenceText: loopPanel.sequenceLineText,
    loopStateText: loopPanel.statusLineText,
    loopDetailText: loopPanel.detailLineText,
    loopSignalText: loopPanel.signalLineText,
    loopQueueText: loopMicro.queueText,
    loopRuntimeText: loopMicro.runtimeText,
    loopDispatchText: loopMicro.dispatchText,
    loopQueueTone: loopMicro.queueTone,
    loopRuntimeTone: loopMicro.runtimeTone,
    loopDispatchTone: loopMicro.dispatchTone,
    loopQueueFocusText: loopMicro.queueFocusText,
    loopRuntimeFocusText: loopMicro.runtimeFocusText,
    loopDispatchFocusText: loopMicro.dispatchFocusText,
    loopQueueStageText: loopMicro.queueStageText,
    loopRuntimeStageText: loopMicro.runtimeStageText,
    loopDispatchStageText: loopMicro.dispatchStageText,
    loopQueueOpsText: loopMicro.queueOpsText,
    loopRuntimeOpsText: loopMicro.runtimeOpsText,
    loopDispatchOpsText: loopMicro.dispatchOpsText,
    loopQueueStateText: loopMicro.queueStateText,
    loopRuntimeStateText: loopMicro.runtimeStateText,
    loopDispatchStateText: loopMicro.dispatchStateText,
    loopQueueSignalText: loopMicro.queueSignalText,
    loopRuntimeSignalText: loopMicro.runtimeSignalText,
    loopDispatchSignalText: loopMicro.dispatchSignalText,
    loopQueueDetailText: loopMicro.queueDetailText,
    loopRuntimeDetailText: loopMicro.runtimeDetailText,
    loopDispatchDetailText: loopMicro.dispatchDetailText,
    loopQueueFamilyText: loopMicro.queueFamilyText,
    loopQueueFlowText: loopMicro.queueFlowText,
    loopQueueSummaryText: loopMicro.queueSummaryText,
    loopQueueGateText: loopMicro.queueGateText,
    loopQueueLeadText: loopMicro.queueLeadText,
    loopQueueWindowText: loopMicro.queueWindowText,
    loopQueuePressureText: loopMicro.queuePressureText,
    loopQueueResponseText: loopMicro.queueResponseText,
    loopQueueAttentionText: loopMicro.queueAttentionText,
    loopQueueCadenceText: loopMicro.queueCadenceText,
    loopQueueMicroflowText: loopMicro.queueMicroflowText,
    loopQueueCards: loopMicro.queueCards,
    loopQueueBlocks: loopMicro.queueBlocks,
    loopQueueFlowCards: loopMicro.queueFlowCards,
    loopQueueFlowBlocks: loopMicro.queueFlowBlocks,
    loopQueueFlowPanels: loopMicro.queueFlowPanels,
    loopQueueRiskCards: loopMicro.queueRiskCards,
    loopQueueRiskBlocks: loopMicro.queueRiskBlocks,
    loopQueueRiskPanels: loopMicro.queueRiskPanels,
    loopQueueSubflowCards: loopMicro.queueSubflowCards,
    loopQueueSubflowBlocks: loopMicro.queueSubflowBlocks,
    loopQueueSubflowPanels: loopMicro.queueSubflowPanels,
    loopRuntimeFamilyText: loopMicro.runtimeFamilyText,
    loopRuntimeFlowText: loopMicro.runtimeFlowText,
    loopRuntimeSummaryText: loopMicro.runtimeSummaryText,
    loopRuntimeGateText: loopMicro.runtimeGateText,
    loopRuntimeLeadText: loopMicro.runtimeLeadText,
    loopRuntimeWindowText: loopMicro.runtimeWindowText,
    loopRuntimePressureText: loopMicro.runtimePressureText,
    loopRuntimeResponseText: loopMicro.runtimeResponseText,
    loopRuntimeAttentionText: loopMicro.runtimeAttentionText,
    loopRuntimeCadenceText: loopMicro.runtimeCadenceText,
    loopRuntimeMicroflowText: loopMicro.runtimeMicroflowText,
    loopRuntimeCards: loopMicro.runtimeCards,
    loopRuntimeBlocks: loopMicro.runtimeBlocks,
    loopRuntimeFlowCards: loopMicro.runtimeFlowCards,
    loopRuntimeFlowBlocks: loopMicro.runtimeFlowBlocks,
    loopRuntimeFlowPanels: loopMicro.runtimeFlowPanels,
    loopRuntimeRiskCards: loopMicro.runtimeRiskCards,
    loopRuntimeRiskBlocks: loopMicro.runtimeRiskBlocks,
    loopRuntimeRiskPanels: loopMicro.runtimeRiskPanels,
    loopRuntimeSubflowCards: loopMicro.runtimeSubflowCards,
    loopRuntimeSubflowBlocks: loopMicro.runtimeSubflowBlocks,
    loopRuntimeSubflowPanels: loopMicro.runtimeSubflowPanels,
    loopDispatchFamilyText: loopMicro.dispatchFamilyText,
    loopDispatchFlowText: loopMicro.dispatchFlowText,
    loopDispatchSummaryText: loopMicro.dispatchSummaryText,
    loopDispatchGateText: loopMicro.dispatchGateText,
    loopDispatchLeadText: loopMicro.dispatchLeadText,
    loopDispatchWindowText: loopMicro.dispatchWindowText,
    loopDispatchPressureText: loopMicro.dispatchPressureText,
    loopDispatchResponseText: loopMicro.dispatchResponseText,
    loopDispatchAttentionText: loopMicro.dispatchAttentionText,
    loopDispatchCadenceText: loopMicro.dispatchCadenceText,
    loopDispatchMicroflowText: loopMicro.dispatchMicroflowText,
    loopDispatchCards: loopMicro.dispatchCards,
    loopDispatchBlocks: loopMicro.dispatchBlocks,
    loopDispatchFlowCards: loopMicro.dispatchFlowCards,
    loopDispatchFlowBlocks: loopMicro.dispatchFlowBlocks,
    loopDispatchRiskCards: loopMicro.dispatchRiskCards,
    loopDispatchRiskBlocks: loopMicro.dispatchRiskBlocks,
    loopDispatchFlowPanels: loopMicro.dispatchFlowPanels,
    loopDispatchRiskPanels: loopMicro.dispatchRiskPanels,
    loopDispatchSubflowCards: loopMicro.dispatchSubflowCards,
    loopDispatchSubflowBlocks: loopMicro.dispatchSubflowBlocks,
    loopDispatchSubflowPanels: loopMicro.dispatchSubflowPanels
  };
}

function buildAdminAssetStatusPayload(adminPanels) {
  const assets = asRecord(adminPanels?.assets);
  const metrics = asRecord(adminPanels?.metrics);
  const summary = asRecord(assets.summary);
  const localManifest = asRecord(assets.local_manifest);
  const familyAssetSummary = asRecord(localManifest.district_family_asset_summary);
  const familyAssetVariationSummary = asRecord(localManifest.district_family_asset_variation_summary);
  const familyAssetRows = asArray(localManifest.district_family_asset_rows).map((row) => asRecord(row));
  const familyAssetVariationRows = asArray(localManifest.district_family_asset_variation_rows).map((row) => asRecord(row));
  const familyAssetFocusSummary = asRecord(localManifest.district_family_asset_focus_summary);
  const familyAssetFocusRows = asArray(localManifest.district_family_asset_focus_rows).map((row) => asRecord(row));
  const familyAssetVariationFocusRows = asArray(localManifest.district_family_asset_variation_focus_rows).map((row) => asRecord(row));
  const familyAssetRuntimeSummary = asRecord(localManifest.district_family_asset_runtime_summary);
  const familyAssetRuntimeRows = asArray(localManifest.district_family_asset_runtime_rows).map((row) => asRecord(row));
  const familyAssetVariationRuntimeSummary = asRecord(localManifest.district_family_asset_variation_runtime_summary);
  const familyAssetVariationRuntimeRows = asArray(localManifest.district_family_asset_variation_runtime_rows).map((row) => asRecord(row));
  const assetRiskFocusRows = buildAssetRiskFocusRows({ metrics, localManifest, limit: 5 });
  const assetRiskFocusSummary = summarizeAssetRiskFocusRows(assetRiskFocusRows);
  const assetMicroflowRiskFocusRows = buildAssetRiskFocusRows({ metrics, localManifest, scope: "microflow", limit: 5 });
  const assetMicroflowRiskFocusSummary = summarizeAssetRiskFocusRows(assetMicroflowRiskFocusRows);
  const assetRiskFocusDailyRows = buildAssetRiskFocusRows({ metrics, localManifest, daily: true, limit: 5 });
  const assetRiskFocusDailySummary = summarizeAssetRiskFocusRows(assetRiskFocusDailyRows);
  const selectedBundleSummary = asRecord(localManifest.selected_bundle_summary);
  const selectedBundleRows = asArray(localManifest.selected_bundle_rows).map((row) => asRecord(row));
  const selectedByDistrict = new Map(
    selectedBundleRows
      .map((row) => [toText(row.district_key), row])
      .filter(([districtKey]) => Boolean(districtKey))
  );
  const districtRows = asArray(localManifest.district_bundle_rows).slice(0, 5).map((row) => {
    const item = asRecord(row);
    const selected = asRecord(selectedByDistrict.get(toText(item.district_key)));
    const stateKey = toText(item.state_key || "missing", "missing").toLowerCase();
    const readyCount = Math.round(toNum(item.bundle_ready_count));
    const assetCount = Math.round(toNum(item.bundle_asset_count));
    const candidateCount = Math.round(toNum(item.candidate_count));
    const selectedFamily = toText(selected.family_key || "--", "--");
    const selectedAsset = toText(selected.asset_key || "");
    return {
      title: toText(item.district_key || "district", "district"),
      meta: `bundle ${readyCount}/${assetCount} | intake ${candidateCount} | mode ${toText(asArray(item.ingest_modes)[0] || "--")}${selectedAsset ? ` | ${selectedFamily}:${selectedAsset}` : ""}`,
      chip: stateKey.toUpperCase(),
      tone: stateKey === "ready" ? "ready" : "missing"
    };
  });
  const familyRiskRows = assetRiskFocusRows.slice(0, 5).map((row) => {
    const stateKey = toText(row.combined_state_key || row.runtime_state_key || "missing", "missing").toLowerCase();
    return {
      title: toText(row.focus_key || `${toText(row.district_key)}:${toText(row.family_key)}:${toText(row.asset_key)}`, "asset"),
      meta: `HB ${toText(row.risk_health_band_key || "--").toUpperCase()} | ATTN ${toText(row.risk_attention_band_key || "--").toUpperCase()} | TREND ${toText(
        row.risk_trend_direction_key || "--"
      ).toUpperCase()} | ${toText(row.asset_risk_contract_signature || "--")}`,
      chip: stateKey.toUpperCase(),
      tone: stateKey === "missing" ? "missing" : stateKey === "partial" ? "watch" : stateKey === "intake_ready" ? "balanced" : "ready"
    };
  });
  const familyRuntimeRows = familyAssetRuntimeRows.slice(0, 5).map((row) => {
    const stateKey = toText(row.runtime_state_key || row.state_key || "missing", "missing").toLowerCase();
    return {
      title: toText(row.focus_key || `${toText(row.district_key)}:${toText(row.family_key)}:${toText(row.asset_key)}`, "asset"),
      meta: `${toText(row.runtime_contract_signature || "--")} | host ${toText(row.domain_state_key || "--")} | ${toText(
        row.file_name || row.asset_key || "-"
      )}`,
      chip: stateKey.toUpperCase(),
      tone: stateKey === "missing" ? "missing" : stateKey === "partial" ? "watch" : stateKey === "intake_ready" ? "balanced" : "ready"
    };
  });
  const variationRuntimeRows = familyAssetVariationRuntimeRows.slice(0, 3).map((row) => {
    const stateKey = toText(row.runtime_state_key || row.state_key || "missing", "missing").toLowerCase();
    return {
      title: toText(row.focus_key || `${toText(row.district_key)}:${toText(row.family_key)}:${toText(row.variant_key || row.asset_key)}`, "variation"),
      meta: `${toText(row.variant_role || "--").toUpperCase()} | ${toText(row.runtime_contract_signature || "--")} | ${toText(row.file_name || row.asset_key || "-")}`,
      chip: stateKey.toUpperCase(),
      tone: stateKey === "missing" ? "missing" : stateKey === "partial" ? "watch" : stateKey === "intake_ready" ? "balanced" : "ready"
    };
  });
  const familyFocusRows = familyAssetFocusRows.slice(0, 5).map((row) => {
    const stateKey = toText(row.state_key || "missing", "missing").toLowerCase();
    return {
      title: toText(row.focus_key || `${toText(row.district_key)}:${toText(row.family_key)}:${toText(row.asset_key)}`, "asset"),
      meta: `${toText(row.asset_contract_signature || "--")} | ${toText(row.file_name || row.asset_key || "-")}`,
      chip: stateKey.toUpperCase(),
      tone: stateKey === "missing" ? "missing" : stateKey === "partial" ? "watch" : "ready"
    };
  });
  const variationFocusRows = familyAssetVariationFocusRows.slice(0, 2).map((row) => {
    const stateKey = toText(row.state_key || "missing", "missing").toLowerCase();
    return {
      title: toText(row.focus_key || `${toText(row.district_key)}:${toText(row.family_key)}:${toText(row.variant_key || row.asset_key)}`, "variation"),
      meta: `${toText(row.variant_role || "--").toUpperCase()} | ${toText(row.asset_contract_signature || "--")} | ${toText(row.file_name || row.asset_key || "-")}`,
      chip: stateKey.toUpperCase(),
      tone: stateKey === "missing" ? "missing" : stateKey === "partial" ? "watch" : "ready"
    };
  });
  const familyRows = familyAssetRows.slice(0, 5).map((row) => {
    const stateKey = toText(row.state_key || "missing", "missing").toLowerCase();
    return {
      title: toText(row.focus_key || `${toText(row.district_key)}:${toText(row.family_key)}:${toText(row.asset_key)}`, "asset"),
      meta: `${toText(row.file_name || row.asset_key || "-")} | ${toText(row.candidate_key || "--")} | ${toText(
        row.provider_label || row.provider_key || "--"
      )}`,
      chip: stateKey.toUpperCase(),
      tone: stateKey === "ready" ? "ready" : stateKey === "partial" ? "watch" : "missing"
    };
  });
  const fileRows = asArray(localManifest.rows).slice(0, 8).map((row) => {
    const item = asRecord(row);
    const exists = item.exists !== false;
    return {
      title: toText(item.asset_key || item.asset_path || "asset"),
      meta: `${toText(item.relative_path || item.path || "-")} | ${toText(item.mode || item.category || "runtime")}`,
      chip: exists ? "READY" : "MISS",
      tone: exists ? "ready" : "missing"
    };
  });
  const activeManifest = asRecord(assets.active_manifest);
  const microSummaryText = toNum(assetMicroflowRiskFocusSummary.row_count)
    ? ` | micro ${Math.round(toNum(assetMicroflowRiskFocusSummary.contract_ready_count || assetMicroflowRiskFocusSummary.row_count))}/${Math.round(
        toNum(assetMicroflowRiskFocusSummary.row_count)
      )}`
    : "";
  const dailySummaryText = toNum(assetRiskFocusDailySummary.row_count)
    ? ` | daily ${Math.round(toNum(assetRiskFocusDailySummary.contract_ready_count || assetRiskFocusDailySummary.row_count))}/${Math.round(
        toNum(assetRiskFocusDailySummary.row_count)
      )}`
    : "";
  return {
    summaryLineText: `Assets: ready ${Math.round(toNum(summary.ready_assets))}/${Math.round(toNum(summary.total_assets))} | family ${Math.round(toNum(
      familyAssetSummary.ready_count || familyAssetSummary.row_count
    ))}/${Math.round(toNum(familyAssetSummary.row_count))} | focus ${Math.round(
      toNum(familyAssetFocusSummary.contract_ready_count || familyAssetFocusSummary.row_count)
    )}/${Math.round(toNum(familyAssetFocusSummary.row_count))} | runtime ${Math.round(
      toNum(familyAssetRuntimeSummary.contract_ready_count || familyAssetRuntimeSummary.row_count)
    )}/${Math.round(toNum(familyAssetRuntimeSummary.row_count))} | variation ${Math.round(
      toNum(familyAssetVariationSummary.ready_count || familyAssetVariationSummary.row_count)
    )}/${Math.round(toNum(familyAssetVariationSummary.row_count))} | vruntime ${Math.round(
      toNum(familyAssetVariationRuntimeSummary.contract_ready_count || familyAssetVariationRuntimeSummary.row_count)
    )}/${Math.round(toNum(familyAssetVariationRuntimeSummary.row_count))} | risk ${Math.round(
      toNum(assetRiskFocusSummary.contract_ready_count || assetRiskFocusSummary.row_count)
    )}/${Math.round(toNum(assetRiskFocusSummary.row_count))}${microSummaryText}${dailySummaryText} | missing ${Math.round(
      toNum(summary.missing_assets)
    )}`,
    revisionLineText: `Manifest: ${toText(activeManifest.manifest_revision || activeManifest.state_json?.manifest_revision || "local")} | updated ${toText(activeManifest.updated_at, "-")}`,
    rows: familyRiskRows.length
      ? familyRiskRows.concat(variationRuntimeRows, familyRuntimeRows, variationFocusRows, familyFocusRows, familyRows, districtRows, fileRows).slice(0, 8)
      : variationRuntimeRows.length
      ? variationRuntimeRows.concat(familyRuntimeRows, variationFocusRows, familyFocusRows, familyRows, districtRows, fileRows).slice(0, 8)
      : familyRuntimeRows.length
      ? familyRuntimeRows.concat(variationFocusRows, familyFocusRows, familyRows, districtRows, fileRows).slice(0, 8)
      : variationFocusRows.length
      ? variationFocusRows.concat(familyFocusRows, familyRows, districtRows, fileRows).slice(0, 8)
      : familyFocusRows.length
      ? familyFocusRows.concat(familyRows, districtRows, fileRows).slice(0, 8)
      : familyRows.length
        ? familyRows.concat(districtRows, fileRows).slice(0, 8)
        : districtRows.length
          ? districtRows.concat(fileRows).slice(0, 8)
          : fileRows,
    emptyText: "Asset kaydi bulunmuyor"
  };
}

function buildAdminAssetRuntimePayload(mutators, adminPanels) {
  const assets = asRecord(adminPanels?.assets);
  const kpiMetrics = asRecord(adminPanels?.metrics);
  const localManifest = asRecord(assets.local_manifest);
  const webappDomainSummary = asRecord(localManifest.webapp_domain_summary);
  const districtBundleSummary = asRecord(localManifest.district_bundle_summary);
  const familyAssetSummary = asRecord(localManifest.district_family_asset_summary);
  const familyAssetVariationSummary = asRecord(localManifest.district_family_asset_variation_summary);
  const familyAssetFocusSummary = asRecord(localManifest.district_family_asset_focus_summary);
  const familyAssetRuntimeSummary = asRecord(localManifest.district_family_asset_runtime_summary);
  const familyAssetVariationRuntimeSummary = asRecord(localManifest.district_family_asset_variation_runtime_summary);
  const selectedBundleSummary = asRecord(localManifest.selected_bundle_summary);
  const selectedBundleRows = asArray(localManifest.selected_bundle_rows).map((row) => asRecord(row));
  const variationBundleRows = asArray(localManifest.variation_bundle_rows).map((row) => asRecord(row));
  const districtBundleRows = asArray(localManifest.district_bundle_rows).map((row) => asRecord(row));
  const familyAssetRows = asArray(localManifest.district_family_asset_rows).map((row) => asRecord(row));
  const familyAssetFocusRows = asArray(localManifest.district_family_asset_focus_rows).map((row) => asRecord(row));
  const familyAssetRuntimeRows = asArray(localManifest.district_family_asset_runtime_rows).map((row) => asRecord(row));
  const familyAssetVariationRuntimeRows = asArray(localManifest.district_family_asset_variation_runtime_rows).map((row) => asRecord(row));
  const assetRiskFocusRows = buildAssetRiskFocusRows({ metrics: kpiMetrics, localManifest, limit: 5 });
  const assetRiskFocusSummary = summarizeAssetRiskFocusRows(assetRiskFocusRows);
  const assetMicroflowRiskFocusRows = buildAssetRiskFocusRows({ metrics: kpiMetrics, localManifest, scope: "microflow", limit: 5 });
  const assetMicroflowRiskFocusSummary = summarizeAssetRiskFocusRows(assetMicroflowRiskFocusRows);
  const assetMicroflowRiskFocusDailyRows = buildAssetRiskFocusRows({
    metrics: kpiMetrics,
    localManifest,
    scope: "microflow",
    daily: true,
    limit: 5
  });
  const assetMicroflowRiskFocusDailySummary = summarizeAssetRiskFocusRows(assetMicroflowRiskFocusDailyRows);
  const rows = asArray(localManifest.rows).map((row) => ({
    asset_key: toText(asRecord(row).asset_key || "asset"),
    exists_local: asRecord(row).exists !== false,
    integrity_status: asRecord(row).exists === false ? "missing" : "ok"
  }));
  const metrics = buildAssetMetrics(mutators, {
    asset_manifest: {
      available: true,
      active_revision: asRecord(assets.active_manifest),
      entries: rows,
      summary: asRecord(assets.summary)
    }
  });
  const selectedSummaryText = assetMicroflowRiskFocusRows.length
    ? assetMicroflowRiskFocusRows
        .slice(0, 3)
        .map(
          (row) =>
            `${toText(row.focus_key || "--")}:${toText(row.scope_key || row.microflow_key || "--")}:${toText(
              row.combined_state_key || row.runtime_state_key || "--"
            )}`
        )
        .filter(Boolean)
        .join(" | ")
    : assetRiskFocusRows.length
    ? assetRiskFocusRows
        .slice(0, 3)
        .map((row) => `${toText(row.focus_key || "--")}:${toText(row.combined_state_key || row.runtime_state_key || "--")}`)
        .filter(Boolean)
        .join(" | ")
    : familyAssetRuntimeRows.length
    ? familyAssetRuntimeRows
        .slice(0, 3)
        .map((row) => `${toText(row.focus_key || "--")}:${toText(row.runtime_state_key || row.state_key || "--")}`)
        .filter(Boolean)
        .join(" | ")
    : familyAssetFocusRows.length
    ? familyAssetFocusRows
        .slice(0, 3)
        .map((row) => `${toText(row.focus_key || "--")}:${toText(row.state_key || "--")}`)
        .filter(Boolean)
        .join(" | ")
    : familyAssetRows.length
    ? familyAssetRows
        .slice(0, 3)
        .map((row) => `${toText(row.focus_key || "--")}:${toText(row.state_key || "--")}`)
        .filter(Boolean)
        .join(" | ")
    : selectedBundleRows
    .slice(0, 3)
    .map((row) => `${toText(row.district_key || "--")}:${toText(row.family_key || "--")}:${toText(row.asset_key || "--")}`)
    .filter(Boolean)
    .join(" | ");
  const variationSummaryText = familyAssetVariationRuntimeRows.length
    ? familyAssetVariationRuntimeRows
        .slice(0, 3)
        .map((row) => `${toText(row.focus_key || "--")}:${toText(row.runtime_state_key || row.state_key || "--")}`)
        .filter(Boolean)
        .join(" | ")
    : variationBundleRows
        .slice(0, 3)
        .map((row) => `${toText(row.district_key || "--")}:${toText(row.family_key || "--")}:${toText(row.variant_key || row.asset_key || "--")}`)
        .filter(Boolean)
        .join(" | ");
  const focusDistrict = districtBundleRows.find((row) => toText(row.state_key) === "ready") || districtBundleRows[0] || {};
  const focusSelectedRow =
    assetMicroflowRiskFocusRows.find((row) => toText(row.district_key) === toText(focusDistrict.district_key)) ||
    assetMicroflowRiskFocusRows[0] ||
    assetRiskFocusRows.find((row) => toText(row.district_key) === toText(focusDistrict.district_key)) ||
    assetRiskFocusRows[0] ||
    familyAssetRuntimeRows.find((row) => toText(row.district_key) === toText(focusDistrict.district_key)) ||
    familyAssetRuntimeRows[0] ||
    familyAssetFocusRows.find((row) => toText(row.district_key) === toText(focusDistrict.district_key)) ||
    familyAssetFocusRows[0] ||
    familyAssetRows.find((row) => toText(row.district_key) === toText(focusDistrict.district_key)) ||
    familyAssetRows[0] ||
    selectedBundleRows.find((row) => toText(row.district_key) === toText(focusDistrict.district_key)) ||
    selectedBundleRows[0] ||
    {};
  const domainStateKey = toText(webappDomainSummary.state_key || "missing", "missing").toLowerCase();
  const domainHost = toText(webappDomainSummary.host || "--", "--");
  const domainCnameTarget = toText(asArray(webappDomainSummary.cname_targets)[0] || asArray(webappDomainSummary.a_records)[0] || "--", "--");
  const focusDailyRiskRow =
    assetMicroflowRiskFocusDailyRows.find(
      (row) =>
        toText(row.focus_key) === toText(focusSelectedRow.focus_key) &&
        toText(row.scope_key || row.microflow_key) === toText(focusSelectedRow.scope_key || focusSelectedRow.microflow_key)
    ) || assetMicroflowRiskFocusDailyRows[0] || {};
  const microSummaryText = toNum(assetMicroflowRiskFocusSummary.row_count)
    ? ` | Micro ${Math.round(
        toNum(assetMicroflowRiskFocusSummary.contract_ready_count || assetMicroflowRiskFocusSummary.row_count)
      )}/${Math.round(toNum(assetMicroflowRiskFocusSummary.row_count))}`
    : "";
  const dailySummaryText = toNum(assetMicroflowRiskFocusDailySummary.row_count)
    ? ` | Daily ${Math.round(
        toNum(assetMicroflowRiskFocusDailySummary.contract_ready_count || assetMicroflowRiskFocusDailySummary.row_count)
      )}/${Math.round(toNum(assetMicroflowRiskFocusDailySummary.row_count))}`
    : "";
  const domainLineText = `DOMAIN ${domainHost} | ${domainStateKey.toUpperCase()} | HEALTH ${Math.round(
    toNum(webappDomainSummary.health_status_code)
  )} | WEBAPP ${Math.round(toNum(webappDomainSummary.webapp_status_code))} | TARGET ${domainCnameTarget}`;
  return {
    tone: mapRuntimeTone(metrics.tone || "balanced"),
    readyRatio: clamp(metrics.readyRatio),
    syncRatio: clamp(metrics.integrityRatio),
    signalLineText: `Ready ${Math.round(clamp(metrics.readyRatio) * 100)}% | Integrity ${Math.round(clamp(metrics.integrityRatio) * 100)}% | Bundles ${Math.round(toNum(districtBundleSummary.ready_count))}/${Math.max(1, Math.round(toNum(districtBundleSummary.district_count)))} | Family ${Math.round(toNum(familyAssetSummary.ready_count || familyAssetSummary.row_count))}/${Math.max(1, Math.round(toNum(familyAssetSummary.row_count)))} | Focus ${Math.round(toNum(familyAssetFocusSummary.contract_ready_count || familyAssetFocusSummary.row_count))}/${Math.max(1, Math.round(toNum(familyAssetFocusSummary.row_count)))} | Runtime ${Math.round(toNum(familyAssetRuntimeSummary.contract_ready_count || familyAssetRuntimeSummary.row_count))}/${Math.max(1, Math.round(toNum(familyAssetRuntimeSummary.row_count)))} | Variation ${Math.round(toNum(familyAssetVariationSummary.ready_count || familyAssetVariationSummary.row_count))}/${Math.max(1, Math.round(toNum(familyAssetVariationSummary.row_count)))} | VRuntime ${Math.round(toNum(familyAssetVariationRuntimeSummary.contract_ready_count || familyAssetVariationRuntimeSummary.row_count))}/${Math.max(1, Math.round(toNum(familyAssetVariationRuntimeSummary.row_count)))} | Risk ${Math.round(toNum(assetRiskFocusSummary.contract_ready_count || assetRiskFocusSummary.row_count))}/${Math.max(1, Math.round(toNum(assetRiskFocusSummary.row_count)))}${microSummaryText}${dailySummaryText}`,
    selectionLineText: selectedSummaryText
      ? `SELECT ${selectedSummaryText}${variationSummaryText ? ` | VAR ${variationSummaryText}` : ""}`
      : variationSummaryText
      ? `SELECT VAR ${variationSummaryText}`
      : "SELECT bundle telemetry bekleniyor",
    domainLineText,
    riskLineText: toText(focusSelectedRow.asset_key)
      ? `RISK ${toText(focusSelectedRow.focus_key || "--")} | MICRO ${toText(
          focusSelectedRow.scope_key || focusSelectedRow.microflow_key || "--"
        )} | ${toText(focusSelectedRow.risk_key || "--")}${toText(focusDailyRiskRow.day) ? ` | DAY ${toText(focusDailyRiskRow.day)}` : ""} | FLOW ${toText(
          focusSelectedRow.flow_key || "--"
        )} | ${toText(focusSelectedRow.asset_risk_contract_signature || focusSelectedRow.risk_context_signature || "--")}`
      : "RISK district asset bekleniyor",
    focusLineText: toText(focusSelectedRow.asset_key)
      ? `FOCUS ${toText(focusSelectedRow.focus_key || `${toText(focusSelectedRow.district_key || "--")}:${toText(focusSelectedRow.family_key || "--")}:${toText(focusSelectedRow.asset_key || "--")}`)} | ${toText(focusSelectedRow.runtime_state_key || focusSelectedRow.state_key || "--")} | HOST ${toText(focusSelectedRow.domain_state_key || domainStateKey || "--")} | ${toText(
          focusSelectedRow.runtime_contract_signature ||
            focusSelectedRow.asset_contract_signature ||
            focusSelectedRow.candidate_key ||
            "--"
        )}`
      : "FOCUS district asset bekleniyor",
    chips: [
      { id: "adminAssetReadyChip", text: `READY ${Math.round(clamp(metrics.readyRatio) * 100)}%`, tone: mapRuntimeTone(metrics.readyRatio < 0.7 ? "pressure" : "advantage"), level: clamp(metrics.readyRatio) },
      { id: "adminAssetSyncChip", text: `SYNC ${Math.round(clamp(metrics.integrityRatio) * 100)}%`, tone: mapRuntimeTone(metrics.integrityRatio < 0.7 ? "critical" : "advantage"), level: clamp(metrics.integrityRatio) },
      { id: "adminAssetDistrictChip", text: `DIST ${Math.round(toNum(districtBundleSummary.ready_count))}/${Math.round(toNum(districtBundleSummary.district_count))}`, tone: mapRuntimeTone(toNum(districtBundleSummary.partial_count) > 0 ? "pressure" : "advantage"), level: clamp(toNum(districtBundleSummary.district_count) ? toNum(districtBundleSummary.ready_count) / Math.max(1, toNum(districtBundleSummary.district_count)) : 0) },
      {
        id: "adminAssetFocusChip",
        text: `FOCUS ${Math.round(toNum(familyAssetRuntimeSummary.contract_ready_count || familyAssetRuntimeSummary.row_count))}/${Math.round(toNum(familyAssetRuntimeSummary.row_count || familyAssetFocusSummary.row_count))}`,
        tone: mapRuntimeTone(
          toNum(familyAssetRuntimeSummary.missing_count) > 0 ? "critical" : toNum(familyAssetRuntimeSummary.partial_count) > 0 ? "pressure" : "advantage"
        ),
        level: clamp(
          toNum(familyAssetRuntimeSummary.row_count)
            ? toNum(familyAssetRuntimeSummary.contract_ready_count) / Math.max(1, toNum(familyAssetRuntimeSummary.row_count))
          : 0
        )
      },
      {
        id: "adminAssetVariationChip",
        text: `VAR ${Math.round(toNum(familyAssetVariationRuntimeSummary.contract_ready_count || familyAssetVariationRuntimeSummary.row_count))}/${Math.round(toNum(familyAssetVariationRuntimeSummary.row_count))}`,
        tone: mapRuntimeTone(
          toNum(familyAssetVariationRuntimeSummary.missing_count) > 0
            ? "critical"
            : toNum(familyAssetVariationRuntimeSummary.partial_count) > 0
            ? "pressure"
            : "advantage"
        ),
        level: clamp(
          toNum(familyAssetVariationRuntimeSummary.row_count)
            ? toNum(familyAssetVariationRuntimeSummary.contract_ready_count) / Math.max(1, toNum(familyAssetVariationRuntimeSummary.row_count))
            : 0
        )
      },
      {
        id: "adminAssetRiskChip",
        text: `RISK ${Math.round(toNum(assetRiskFocusSummary.contract_ready_count || assetRiskFocusSummary.row_count))}/${Math.round(toNum(assetRiskFocusSummary.row_count))}`,
        tone: mapRuntimeTone(
          toNum(assetRiskFocusSummary.alert_count) > 0 ? "critical" : toNum(assetRiskFocusSummary.partial_count) > 0 ? "pressure" : "advantage"
        ),
        level: clamp(
          toNum(assetRiskFocusSummary.row_count)
            ? toNum(assetRiskFocusSummary.contract_ready_count) / Math.max(1, toNum(assetRiskFocusSummary.row_count))
            : 0
        )
      },
      {
        id: "adminAssetHostChip",
        text: `HOST ${domainStateKey.toUpperCase()}`,
        tone: mapRuntimeTone(domainStateKey === "ready" ? "advantage" : domainStateKey === "partial" ? "pressure" : "critical"),
        level: clamp(webappDomainSummary.contract_ready ? 1 : webappDomainSummary.dns_ready ? 0.6 : 0.2)
      },
      { id: "adminAssetRevisionChip", text: `REV ${toText(metrics.manifestRevision || "local").slice(0, 10)}`, tone: "balanced", level: 0.5 }
    ],
    meters: [
      { id: "adminAssetReadyMeter", pct: Math.round(clamp(metrics.readyRatio) * 100), palette: mapMeterPalette(metrics.readyRatio < 0.7 ? "pressure" : "safe") },
      { id: "adminAssetSyncMeter", pct: Math.round(clamp(metrics.integrityRatio) * 100), palette: mapMeterPalette(metrics.integrityRatio < 0.7 ? "critical" : "safe") }
    ]
  };
}

function scoreTruthStatus(value) {
  const key = toText(value, "unknown").toLowerCase();
  if (key === "pass" || key === "real" || key === "ready") return 1;
  if (key === "partial" || key === "mixed" || key === "degraded") return 0.55;
  if (key === "procedural") return 0.4;
  if (key === "fail" || key === "critical" || key === "blocked") return 0.1;
  return 0.3;
}

function buildAdminAuditPayload(adminPanels) {
  const phase = asRecord(adminPanels?.audit_phase_status);
  const integrity = asRecord(adminPanels?.audit_data_integrity);
  const truthMap = asRecord(integrity.truth_map);
  const truthEntries = Object.entries(truthMap);
  const truthScore = truthEntries.length
    ? clamp(truthEntries.reduce((sum, [, row]) => sum + scoreTruthStatus(asRecord(row).status), 0) / truthEntries.length)
    : 0.35;
  const phaseStatus = toText(phase.phase_status || "unknown", "unknown").toLowerCase();
  const phaseHealth = phaseStatus === "pass" ? 0.92 : phaseStatus === "partial" ? 0.58 : phaseStatus === "fail" ? 0.16 : 0.34;
  const tone = phaseStatus === "fail" || truthScore < 0.35 ? "critical" : phaseStatus === "partial" || truthScore < 0.65 ? "pressure" : "advantage";
  const runtimeFlags = asRecord(integrity.runtime_flags);
  const sceneAssets = asRecord(truthMap.scene_assets);
  const treasury = asRecord(truthMap.treasury);
  const botRuntime = asRecord(truthMap.bot_runtime);
  return {
    tone: mapRuntimeTone(tone),
    phaseHealth,
    truthScore,
    phaseChipText: `PHASE ${phaseStatus.toUpperCase() || "UNKNOWN"}`,
    phaseChipTone: mapBadgeTone(tone),
    signalLineText: `Bundle ${toText(phase.bundle_mode || asRecord(truthMap.webapp_ui).bundle_mode || "unknown")} | Flag source ${toText(runtimeFlags.source_mode || phase.flag_source_mode || "env_locked")}`,
    hintLineText: `Scene ${toText(sceneAssets.status || "unknown")} | Treasury ${toText(treasury.status || "unknown")} | Bot ${toText(botRuntime.status || "unknown")}`,
    chips: [
      { id: "adminAuditBundleChip", text: `BUNDLE ${toText(phase.bundle_mode || asRecord(truthMap.webapp_ui).bundle_mode || "unknown").toUpperCase()}`, tone: mapRuntimeTone(asRecord(truthMap.webapp_ui).status || tone), level: scoreTruthStatus(asRecord(truthMap.webapp_ui).status) },
      { id: "adminAuditRuntimeChip", text: `BOT ${toText(botRuntime.status || "unknown").toUpperCase()}`, tone: mapRuntimeTone(botRuntime.status === "degraded" ? "pressure" : "advantage"), level: scoreTruthStatus(botRuntime.status) },
      { id: "adminAuditAssetChip", text: `ASSET ${toText(sceneAssets.status || "unknown").toUpperCase()}`, tone: mapRuntimeTone(sceneAssets.status === "mixed" ? "pressure" : sceneAssets.status === "procedural" ? "critical" : "advantage"), level: scoreTruthStatus(sceneAssets.status) },
      { id: "adminAuditTreasuryChip", text: `TREAS ${toText(treasury.status || "unknown").toUpperCase()}`, tone: mapRuntimeTone(treasury.status === "partial" ? "pressure" : treasury.status === "real" ? "advantage" : "critical"), level: scoreTruthStatus(treasury.status) }
    ],
    meters: [
      { id: "adminAuditHealthMeter", pct: Math.round(clamp(phaseHealth) * 100), palette: mapMeterPalette(tone) },
      { id: "adminAuditTruthMeter", pct: Math.round(clamp(truthScore) * 100), palette: mapMeterPalette(truthScore < 0.35 ? "critical" : truthScore < 0.65 ? "pressure" : "safe") }
    ]
  };
}

function buildPlayerBridgePayloads(options = {}) {
  const mutators = asRecord(options.mutators);
  const data = asRecord(options.data);
  const homeFeed = asRecord(options.homeFeed);
  const vaultRoot = asRecord(options.vaultData);
  const scene = asRecord(options.scene);
  const sceneRuntime = asRecord(options.sceneRuntime);
  const pvpLive = asRecord(options.pvpLive);
  const pvpView = buildPvpLiveViewModel({
    pvpRuntime: options.pvpRuntime,
    leagueOverview: options.leagueOverview,
    liveLeaderboard: asRecord(pvpLive.leaderboard),
    liveDiagnostics: asRecord(pvpLive.diagnostics),
    liveTick: asRecord(pvpLive.tick)
  });
  const vaultView = buildVaultViewModel({ vaultData: vaultRoot });
  const assetMetrics = buildAssetMetrics(mutators, data);
  const webappDomainSummary = readWebappDomainSummary(data);
  const pvpRuntimePayloads = buildPvpRuntimePayload(options.pvpRuntime, pvpLive, pvpView, scene, assetMetrics);
  const profileMetrics = mutators.computeSceneEffectiveProfile
    ? mutators.computeSceneEffectiveProfile({
        sceneMode: sceneRuntime.lowEndMode ? "lite" : sceneRuntime.effectiveQuality === "high" ? "pro" : "standard",
        perfTier: toText(asRecord(scene.capabilityProfile).perf_tier || sceneRuntime.effectiveQuality || "normal"),
        fps: toNum(asRecord(scene.capabilityProfile).fps_avg || 0),
        assetsText: `Assets: ${assetMetrics.readyEntries}/${Math.max(1, assetMetrics.totalEntries)}`,
        assetRuntime: { readyRatio: assetMetrics.readyRatio, syncRatio: assetMetrics.integrityRatio, tone: assetMetrics.tone, manifestRevision: assetMetrics.manifestRevision, sourceMode: assetMetrics.sourceMode },
        manifestMeta: { integrityRatio: assetMetrics.integrityRatio, readyRatio: assetMetrics.readyRatio, tone: assetMetrics.tone, manifestRevision: assetMetrics.manifestRevision, sourceMode: assetMetrics.sourceMode },
        telemetryReadyAssets: assetMetrics.readyEntries,
        telemetryTotalAssets: assetMetrics.totalEntries,
        telemetrySceneMode: sceneRuntime.lowEndMode ? "LITE" : "FULL",
        telemetryManifestRevision: assetMetrics.manifestRevision,
        telemetryManifestProvider: assetMetrics.sourceMode,
        transport: toText(asRecord(pvpView.summary).transport || "poll"),
        pvpStatus: toText(asRecord(pvpView.summary).session_status || "idle"),
        ladderActivity: clamp(asArray(pvpView.leaderboard).length / 10),
        combatHeat: clamp((toNum(asRecord(pvpView.summary).self_actions) + toNum(asRecord(pvpView.summary).opponent_actions)) / 20),
        threatRatio: clamp((toNum(asRecord(pvpView.summary).p95_latency_ms) / 550) * 0.58 + (1 - clamp(toNum(asRecord(pvpView.summary).accept_rate_pct) / 100)) * 0.42),
        hudDensity: toText(scene.hudDensity || "normal"),
        postFxLevel: sceneRuntime.effectiveQuality === "high" ? 0.92 : sceneRuntime.effectiveQuality === "medium" ? 0.66 : 0.3
      })
    : null;
  const latestReject = asRecord(asArray(pvpView.reject_mix)[0]);
  const telemetryInput = {
    diagnostics: asRecord(asRecord(asRecord(pvpLive.diagnostics).diagnostics)),
    ladder: {
      pressure: clamp(1 - clamp(toNum(asRecord(pvpView.summary).accept_rate_pct) / 100)),
      freshnessRatio: clamp(1 - toNum(asRecord(pvpView.summary).p95_latency_ms) / 650),
      activityRatio: clamp(asArray(pvpView.leaderboard).length / 10)
    },
    assetRuntime: { readyRatio: assetMetrics.readyRatio, syncRatio: assetMetrics.integrityRatio, dbReadyRatio: assetMetrics.readyRatio },
    assetManifest: { readyRatio: assetMetrics.readyRatio, integrityRatio: assetMetrics.integrityRatio, missingRatio: assetMetrics.missingRatio, manifestRevision: assetMetrics.manifestRevision },
    telemetry: { latencyAvgMs: toNum(asRecord(pvpView.summary).median_latency_ms), assetReadyCount: assetMetrics.readyEntries, assetTotalCount: assetMetrics.totalEntries, manifestRevision: assetMetrics.manifestRevision },
    pvp: {
      lastRejectReason: toText(latestReject.reason_code || asRecord(options.pvpRuntime).last_reject_reason || ""),
      lastRejected: Boolean(toText(latestReject.reason_code || asRecord(options.pvpRuntime).last_reject_reason || "")),
      lastActionAt: Date.parse(toText(asArray(pvpView.leaderboard)[0]?.last_match_at || "")) || 0
    },
    queueSize: Math.max(0, toNum(asRecord(pvpView.summary).self_actions) - toNum(asRecord(pvpView.summary).opponent_actions)),
    windowMs: toNum(asRecord(pvpView.summary).action_window_ms || 800),
    latencyMs: toNum(asRecord(pvpView.summary).p95_latency_ms || 0),
    heatRatio: clamp((toNum(asRecord(pvpView.summary).self_actions) + toNum(asRecord(pvpView.summary).opponent_actions)) / 20),
    threatRatio: clamp((toNum(asRecord(pvpView.summary).p95_latency_ms) / 550) * 0.58 + (1 - clamp(toNum(asRecord(pvpView.summary).accept_rate_pct) / 100)) * 0.42),
    nowMs: Date.now()
  };

  const sceneLoopDeck = buildSceneLoopDeckPayload(scene);
  const sceneAssetVariantText =
    sceneLoopDeck.activeAssetVariantKey && sceneLoopDeck.activeAssetVariantKey !== sceneLoopDeck.activeAssetKey
      ? ` | VAR ${sceneLoopDeck.activeAssetVariantKey}`
      : "";
  const sceneAssetBundleText = sceneLoopDeck.activeAssetBundleKind
    ? ` | ${sceneLoopDeck.activeAssetBundleKind}${sceneLoopDeck.activeAssetVariantRole ? `/${sceneLoopDeck.activeAssetVariantRole}` : ""}${sceneLoopDeck.activeAssetVariantTier ? `/${sceneLoopDeck.activeAssetVariantTier}` : ""}`
    : "";
  return {
    sceneStatus: {
      ...(buildSceneStatusPayload(profileMetrics, webappDomainSummary) || {}),
      loopLine: sceneLoopDeck.lineText,
      assetLine:
        sceneLoopDeck.activeAssetKey || sceneLoopDeck.selectedAssetCount
          ? `ASSET ${sceneLoopDeck.loadedAssetCount}/${Math.max(1, sceneLoopDeck.selectedAssetCount)} | ${sceneLoopDeck.activeAssetFamilyKey || sceneLoopDeck.familyKey || "district"}:${sceneLoopDeck.activeAssetKey || "--"} | ${sceneLoopDeck.activeAssetStateKey || "missing"} | ${sceneLoopDeck.activeAssetAnchorKind || "manifest"}${sceneAssetBundleText}${sceneAssetVariantText}`
          : "ASSET district bundle bekleniyor.",
      actionContext: sceneLoopDeck.actionContext,
      actionContextSignature: sceneLoopDeck.actionContextSignature,
      loopContext: sceneLoopDeck.riskContext,
      riskContextSignature: sceneLoopDeck.riskContextSignature,
      focusKey: sceneLoopDeck.focusKey,
      riskKey: sceneLoopDeck.riskKey,
      riskFocusKey: sceneLoopDeck.riskFocusKey,
      familyKey: sceneLoopDeck.familyKey,
      flowKey: sceneLoopDeck.flowKey,
      microflowKey: sceneLoopDeck.microflowKey,
      assetKey: sceneLoopDeck.activeAssetKey,
      assetFamilyKey: sceneLoopDeck.activeAssetFamilyKey,
      assetAnchorKind: sceneLoopDeck.activeAssetAnchorKind,
      assetBundleKind: sceneLoopDeck.activeAssetBundleKind,
      assetVariantKey: sceneLoopDeck.activeAssetVariantKey,
      assetVariantRole: sceneLoopDeck.activeAssetVariantRole,
      assetVariantTier: sceneLoopDeck.activeAssetVariantTier,
      assetCandidateKey: sceneLoopDeck.activeAssetCandidateKey,
      assetStateKey: sceneLoopDeck.activeAssetStateKey,
      assetContractReady: sceneLoopDeck.activeAssetContractReady,
      assetContractSignature: sceneLoopDeck.activeAssetContractSignature,
      readyAssetCount: sceneLoopDeck.readyAssetCount,
      selectedAssetCount: sceneLoopDeck.selectedAssetCount,
      loadedAssetCount: sceneLoopDeck.loadedAssetCount,
      domainStateKey: toText(webappDomainSummary.state_key || "missing", "missing").toLowerCase(),
      domainHost: toText(webappDomainSummary.host || ""),
      runtimeGuardMatchesHost: webappDomainSummary.runtime_guard_matches_host !== false,
      entryKindKey: sceneLoopDeck.entryKindKey,
      sequenceKindKey: sceneLoopDeck.sequenceKindKey,
      riskHealthBandKey: sceneLoopDeck.riskHealthBandKey,
      riskAttentionBandKey: sceneLoopDeck.riskAttentionBandKey,
      riskTrendDirectionKey: sceneLoopDeck.riskTrendDirectionKey
    },
    sceneTelemetry: buildSceneTelemetryPayload(mutators, telemetryInput),
    publicTelemetry: {
      assetManifest: buildAssetManifestStripPayload(assetMetrics, sceneLoopDeck, webappDomainSummary),
      pvpLeaderboard: buildPvpLeaderboardPayload(pvpView)
    },
    pvpRadar: pvpRuntimePayloads.radar,
    pvpRejectIntel: pvpRuntimePayloads.rejectIntel,
    pvpDirector: pvpRuntimePayloads.director,
    pvpEvents: pvpRuntimePayloads.events,
    pvpDuel: pvpRuntimePayloads.duel,
    combatHud: pvpRuntimePayloads.combatHud,
    cameraDirector: pvpRuntimePayloads.camera,
    pvpRoundDirector: pvpRuntimePayloads.roundDirector,
    operations: buildOperationsDeckPayload(data, options.taskResult, homeFeed, scene),
    tokenOverview: buildTokenOverviewPayload(vaultRoot, vaultView, scene),
    tokenTreasury: buildTokenTreasuryPayload(mutators, vaultRoot, vaultView)
  };
}

function buildAdminBridgePayloads(options = {}) {
  const mutators = asRecord(options.mutators);
  const adminPanels = asRecord(options.adminPanels);
  return {
    runtime: buildAdminRuntimePayload(options.adminRuntime, adminPanels, options.scene),
    assetStatus: buildAdminAssetStatusPayload(adminPanels),
    assetRuntime: buildAdminAssetRuntimePayload(mutators, adminPanels),
    auditRuntime: buildAdminAuditPayload(adminPanels)
  };
}

export { buildAssetMetrics, buildPlayerBridgePayloads, buildAdminBridgePayloads };


