import { buildPvpLiveViewModel } from "../player/pvpLiveViewModel.js";
import { buildHomeFeedViewModel } from "../player/homeFeedViewModel.js";
import { buildTasksViewModel } from "../player/tasksViewModel.js";
import { buildVaultViewModel } from "../player/vaultViewModel.js";

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

function buildSceneStatusPayload(profileMetrics) {
  if (!profileMetrics) return null;
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
      personalityLabel: "",
      personalityCaption: "",
      densityLabel: "",
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
  return {
    lineText: `${districtLabel} | ${entryLabel} | ${statusLabel}${personalityLabel ? ` | ${personalityLabel}` : ""} | ${sequenceLabel} ${stageLabel} | ${microflowLabel}`,
    districtKey: toText(selectedLoop.districtKey, ""),
    loopStatusKey: toText(selectedLoop.loopStatusKey, ""),
    loopStatusLabel: statusLabel,
    stageValue: stageLabel,
    entryKindKey: toText(selectedLoop.entryKindKey, ""),
    sequenceKindKey: toText(selectedLoop.sequenceKindKey, ""),
    microflowKey: toText(selectedLoop.microflowKey, ""),
    personalityLabel,
    personalityCaption,
    densityLabel,
    loopRows: asArray(selectedLoop.loopRows).slice(0, 3),
    loopSignalRows: asArray(selectedLoop.loopSignalRows).slice(0, 3),
    sequenceRows: asArray(selectedLoop.sequenceRows).slice(0, 3),
    detailLine: formatLoopRows(selectedLoop.loopRows, "Loop detay bekleniyor."),
    signalLine: formatLoopRows(selectedLoop.loopSignalRows, "Signal detay bekleniyor."),
    sequenceLine: formatLoopRows(selectedLoop.sequenceRows, "Sequence detay bekleniyor.")
  };
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

function buildLoopAttentionDetail(...segments) {
  return buildLoopMicroDetail(...segments);
}

function buildLoopCadenceDetail(...segments) {
  return buildLoopMicroDetail(...segments);
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
  const source = asRecord(rails);
  return {
    cards: buildLoopBridgeCards(
      buildLoopBridgeCard("SUMMARY", source.summaryText, tone, source.familyText),
      buildLoopBridgeCard("GATE", source.gateText, tone, source.flowText),
      buildLoopBridgeCard("ATTN", source.attentionText || source.cadenceText, tone, source.pressureText || source.responseText)
    ),
    blocks: buildLoopBridgeBlocks(
      buildLoopBridgeBlock("FLOW", source.familyText, source.flowText, tone, source.summaryText),
      buildLoopBridgeBlock("GATE", source.summaryText, source.gateText, tone, source.windowText),
      buildLoopBridgeBlock("PULSE", source.attentionText || "ATTN --", source.cadenceText || "CADENCE --", tone, source.responseText || source.pressureText)
    )
  };
}

function buildLoopFlowFamilyBridgeBundle(tone, rails) {
  const source = asRecord(rails);
  return {
    cards: buildLoopBridgeCards(
      buildLoopBridgeCard("ENTRY", source.leadText || source.flowText, tone, source.gateText || source.summaryText),
      buildLoopBridgeCard("STATE", source.stateText || source.summaryText, tone, source.stageText || source.detailText),
      buildLoopBridgeCard("PULSE", source.pressureText || source.responseText, tone, source.attentionText || source.cadenceText)
    ),
    blocks: buildLoopBridgeBlocks(
      buildLoopBridgeBlock("FOCUS", source.focusText || source.familyText, source.flowText || source.summaryText, tone, source.gateText || source.detailText),
      buildLoopBridgeBlock("WINDOW", source.windowText || source.summaryText, source.summaryText || source.stateText, tone, source.attentionText || source.cadenceText),
      buildLoopBridgeBlock("DETAIL", source.detailText || source.opsText, source.opsText || source.signalText, tone, source.responseText || source.pressureText)
    )
  };
}

function buildLoopFlowFamilyPanels(tone, rails) {
  const source = asRecord(rails);
  return [
    {
      title: "COMMAND",
      tone,
      hint: toText(source.familyText, ""),
      lines: [
        toText(source.leadText, "LEAD --"),
        toText(source.windowText, "WINDOW --"),
        toText(source.flowText, "FLOW --")
      ]
    },
    {
      title: "STATE",
      tone,
      hint: toText(source.gateText, ""),
      lines: [
        toText(source.stateText || source.summaryText, "STATE --"),
        toText(source.summaryText, "SUMMARY --"),
        toText(source.stageText || source.detailText, "STAGE --")
      ]
    },
    {
      title: "SIGNAL",
      tone,
      hint: toText(source.responseText || source.pressureText, ""),
      lines: [
        toText(source.pressureText, "PRESSURE --"),
        toText(source.attentionText || source.cadenceText, "ATTN --"),
        toText(source.opsText || source.signalText || source.detailText, "OPS --")
      ]
    }
  ];
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
      telemetryFamilyText: "FLOW WAIT | STATUS -- | DIAG --",
      telemetryFlowText: "PERSONA WAIT | SEQ WAIT | FLOW WAIT",
      telemetrySummaryText: "DIAG -- | RISK -- | FLOW WAIT",
      telemetryGateText: "DIAG -- | ENTRY WAIT | STATUS --",
      telemetryLeadText: "PERSONA WAIT | FLOW WAIT | DIAG --",
      telemetryWindowText: "DIAG -- | RISK -- | STATUS --",
      telemetryPressureText: "DIAG -- | RISK -- | QUEUE --",
      telemetryResponseText: "DIAG -- | FLOW WAIT | PERSONA WAIT",
      telemetryAttentionText: "DIAG -- | RISK -- | FLOW WAIT",
      telemetryCadenceText: "PERSONA WAIT | FLOW WAIT | SEQ WAIT"
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
    });
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
    });
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
    });
    panels.ladderCards = ladderBundle.cards;
    panels.ladderBlocks = ladderBundle.blocks;
    panels.telemetryCards = telemetryBundle.cards;
    panels.telemetryBlocks = telemetryBundle.blocks;
    panels.ladderFlowCards = ladderFlowBundle.cards;
    panels.ladderFlowBlocks = ladderFlowBundle.blocks;
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
      stateText: panels.ladderStateText,
      stageText: panels.ladderStageText,
      opsText: panels.ladderOpsText,
      signalText: panels.ladderSignalText,
      detailText: panels.ladderDetailText
    });
    panels.telemetryFlowCards = telemetryFlowBundle.cards;
    panels.telemetryFlowBlocks = telemetryFlowBundle.blocks;
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
      stateText: panels.telemetryStateText,
      stageText: panels.telemetryStageText,
      opsText: panels.telemetryOpsText,
      signalText: panels.telemetrySignalText,
      detailText: panels.telemetryDetailText
    });
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
      stateText: panels.duelStateText,
      stageText: panels.duelStageText,
      opsText: panels.duelOpsText,
      signalText: panels.duelSignalText,
      detailText: panels.duelDetailText
    });
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
    duelFocusText: buildLoopMicroDetail(
      `ENTRY ${entryLabel}`,
      `FOCUS ${microflowLabel}`,
      `PERSONA ${personalityLabel || "SYNC"}`
    ),
    ladderFocusText: buildLoopMicroDetail(`SEQ ${sequenceLabel}`, `FOCUS ${microflowLabel}`, `CHARGE ${ladderCharge}`),
    telemetryFocusText: buildLoopMicroDetail(
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
  });
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
  });
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
  });
  panels.ladderCards = ladderBundle.cards;
  panels.ladderBlocks = ladderBundle.blocks;
  panels.telemetryCards = telemetryBundle.cards;
  panels.telemetryBlocks = telemetryBundle.blocks;
  panels.ladderFlowCards = ladderFlowBundle.cards;
  panels.ladderFlowBlocks = ladderFlowBundle.blocks;
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
    stateText: panels.ladderStateText,
    stageText: panels.ladderStageText,
    opsText: panels.ladderOpsText,
    signalText: panels.ladderSignalText,
    detailText: panels.ladderDetailText
  });
  panels.telemetryFlowCards = telemetryFlowBundle.cards;
  panels.telemetryFlowBlocks = telemetryFlowBundle.blocks;
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
    stateText: panels.telemetryStateText,
    stageText: panels.telemetryStageText,
    opsText: panels.telemetryOpsText,
    signalText: panels.telemetrySignalText,
    detailText: panels.telemetryDetailText
  });
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
    stateText: panels.duelStateText,
    stageText: panels.duelStageText,
    opsText: panels.duelOpsText,
    signalText: panels.duelSignalText,
    detailText: panels.duelDetailText
  });
  return panels;
}

function buildVaultLoopMicroPanels(loopDeck, active) {
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
      premiumFamilyText: "FLOW WAIT | STATUS -- | PASS --",
      premiumFlowText: "ENTRY WAIT | FLOW WAIT | STAGE --",
      premiumSummaryText: "PASS -- | STAGE -- | FLOW WAIT",
      premiumGateText: "PASS -- | ENTRY WAIT | STATUS --",
      premiumLeadText: "ENTRY WAIT | FLOW WAIT | PASS --",
      premiumWindowText: "PASS -- | STAGE -- | STATUS --",
      premiumPressureText: "PASS -- | PAYOUT -- | ROUTE --",
      premiumResponseText: "PASS -- | FLOW WAIT | ENTRY WAIT",
      premiumAttentionText: "PASS -- | STAGE -- | FLOW WAIT",
      premiumCadenceText: "ENTRY WAIT | FLOW WAIT | PASS --"
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
    });
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
    });
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
    });
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
    });
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
      stateText: panels.payoutStateText,
      stageText: panels.payoutStageText,
      opsText: panels.payoutOpsText,
      signalText: panels.payoutSignalText,
      detailText: panels.payoutDetailText
    });
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
      stateText: panels.routeStateText,
      stageText: panels.routeStageText,
      opsText: panels.routeOpsText,
      signalText: panels.routeSignalText,
      detailText: panels.routeDetailText
    });
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
      stateText: panels.premiumStateText,
      stageText: panels.premiumStageText,
      opsText: panels.premiumOpsText,
      signalText: panels.premiumSignalText,
      detailText: panels.premiumDetailText
    });
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
      stateText: panels.walletStateText,
      stageText: panels.walletStageText,
      opsText: panels.walletOpsText,
      signalText: panels.walletSignalText,
      detailText: panels.walletDetailText
    });
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
    walletFocusText: buildLoopMicroDetail(`ENTRY ${entryLabel}`, `FOCUS ${walletState}`, `FLOW ${microflowLabel}`),
    payoutFocusText: buildLoopMicroDetail(`SEQ ${sequenceLabel}`, `FOCUS ${payoutState}`, `ROUTE ${routeState}`),
    routeFocusText: buildLoopMicroDetail(
      `PERSONA ${personalityCaption || "SYNC"}`,
      `FOCUS ${routeState}`,
      `FLOW ${microflowLabel}`
    ),
    premiumFocusText: buildLoopMicroDetail(`ENTRY ${entryLabel}`, `FOCUS ${premiumState}`, `FLOW ${microflowLabel}`),
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
    premiumFamilyText: buildLoopMicroDetail(`FLOW ${microflowLabel}`, `STATUS ${loopStatusLabel}`, `PASS ${premiumState}`),
    premiumFlowText: buildLoopMicroDetail(`ENTRY ${entryLabel}`, `FLOW ${microflowLabel}`, `STAGE ${stageValue}`),
    premiumSummaryText: buildLoopMicroDetail(`PASS ${premiumState}`, `STAGE ${stageValue}`, `FLOW ${microflowLabel}`),
    premiumGateText: buildLoopMicroDetail(`PASS ${premiumState}`, `ENTRY ${entryLabel}`, `STATUS ${loopStatusLabel}`),
    premiumLeadText: buildLoopMicroDetail(`ENTRY ${entryLabel}`, `FLOW ${microflowLabel}`, `PASS ${premiumState}`),
    premiumWindowText: buildLoopMicroDetail(`PASS ${premiumState}`, `STAGE ${stageValue}`, `STATUS ${loopStatusLabel}`),
    premiumPressureText: buildLoopMicroDetail(`PASS ${premiumState}`, `PAYOUT ${payoutState}`, `ROUTE ${routeState}`),
    premiumResponseText: buildLoopMicroDetail(`PASS ${premiumState}`, `FLOW ${loopStatusLabel}`, `ENTRY ${entryLabel}`),
    premiumAttentionText: buildLoopAttentionDetail(`PASS ${premiumState}`, `STAGE ${stageValue}`, `FLOW ${microflowLabel}`),
    premiumCadenceText: buildLoopCadenceDetail(`ENTRY ${entryLabel}`, `FLOW ${microflowLabel}`, `PASS ${premiumState}`)
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
  });
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
  });
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
  });
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
  });
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
    stateText: panels.payoutStateText,
    stageText: panels.payoutStageText,
    opsText: panels.payoutOpsText,
    signalText: panels.payoutSignalText,
    detailText: panels.payoutDetailText
  });
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
    stateText: panels.routeStateText,
    stageText: panels.routeStageText,
    opsText: panels.routeOpsText,
    signalText: panels.routeSignalText,
    detailText: panels.routeDetailText
  });
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
    stateText: panels.premiumStateText,
    stageText: panels.premiumStageText,
    opsText: panels.premiumOpsText,
    signalText: panels.premiumSignalText,
    detailText: panels.premiumDetailText
  });
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
    stateText: panels.walletStateText,
    stageText: panels.walletStageText,
    opsText: panels.walletOpsText,
    signalText: panels.walletSignalText,
    detailText: panels.walletDetailText
  });
  return panels;
}

function buildAdminLoopMicroPanels(loopDeck, active) {
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
      runtimeFamilyText: "FLOW WAIT | STATUS -- | HEALTH --",
      runtimeFlowText: "SEQ WAIT | FLOW WAIT | ALERT --",
      runtimeSummaryText: "HEALTH -- | ALERT -- | FLOW WAIT",
      runtimeGateText: "HEALTH -- | ENTRY WAIT | STATUS --",
      runtimeLeadText: "SEQ WAIT | FLOW WAIT | HEALTH --",
      runtimeWindowText: "HEALTH -- | ALERT -- | STATUS --",
      runtimePressureText: "HEALTH -- | ALERT -- | QUEUE --",
      runtimeResponseText: "HEALTH -- | FLOW WAIT | SEQ WAIT",
      runtimeAttentionText: "HEALTH -- | ALERT -- | FLOW WAIT",
      runtimeCadenceText: "SEQ WAIT | FLOW WAIT | HEALTH --"
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
    });
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
    });
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
    });
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
      stateText: panels.queueStateText,
      stageText: panels.queueStageText,
      opsText: panels.queueOpsText,
      signalText: panels.queueSignalText,
      detailText: panels.queueDetailText
    });
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
      stateText: panels.runtimeStateText,
      stageText: panels.runtimeStageText,
      opsText: panels.runtimeOpsText,
      signalText: panels.runtimeSignalText,
      detailText: panels.runtimeDetailText
    });
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
      stateText: panels.dispatchStateText,
      stageText: panels.dispatchStageText,
      opsText: panels.dispatchOpsText,
      signalText: panels.dispatchSignalText,
      detailText: panels.dispatchDetailText
    });
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
    queueFocusText: buildLoopMicroDetail(`ENTRY ${entryLabel}`, `FOCUS ${queueDepth}`, `FLOW ${microflowLabel}`),
    runtimeFocusText: buildLoopMicroDetail(`SEQ ${sequenceLabel}`, `FOCUS ${sceneHealth}`, `ALERT ${alertCount}`),
    dispatchFocusText: buildLoopMicroDetail(`ENTRY ${entryLabel}`, `FOCUS ${liveOpsSent}`, `STAGE ${stageValue}`),
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
    runtimeFamilyText: buildLoopMicroDetail(`FLOW ${microflowLabel}`, `STATUS ${loopStatusLabel}`, `HEALTH ${sceneHealth}`),
    runtimeFlowText: buildLoopMicroDetail(`SEQ ${sequenceLabel}`, `FLOW ${microflowLabel}`, `ALERT ${alertCount}`),
    runtimeSummaryText: buildLoopMicroDetail(`HEALTH ${sceneHealth}`, `ALERT ${alertCount}`, `FLOW ${microflowLabel}`),
    runtimeGateText: buildLoopMicroDetail(`HEALTH ${sceneHealth}`, `ENTRY ${entryLabel}`, `STATUS ${loopStatusLabel}`),
    runtimeLeadText: buildLoopMicroDetail(`SEQ ${sequenceLabel}`, `FLOW ${microflowLabel}`, `HEALTH ${sceneHealth}`),
    runtimeWindowText: buildLoopMicroDetail(`HEALTH ${sceneHealth}`, `ALERT ${alertCount}`, `STATUS ${loopStatusLabel}`),
    runtimePressureText: buildLoopMicroDetail(`HEALTH ${sceneHealth}`, `ALERT ${alertCount}`, `QUEUE ${queueDepth}`),
    runtimeResponseText: buildLoopMicroDetail(`HEALTH ${sceneHealth}`, `FLOW ${loopStatusLabel}`, `SEQ ${sequenceLabel}`),
    runtimeAttentionText: buildLoopAttentionDetail(`HEALTH ${sceneHealth}`, `ALERT ${alertCount}`, `FLOW ${microflowLabel}`),
    runtimeCadenceText: buildLoopCadenceDetail(`SEQ ${sequenceLabel}`, `FLOW ${microflowLabel}`, `HEALTH ${sceneHealth}`)
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
  });
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
  });
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
  });
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
    stateText: panels.queueStateText,
    stageText: panels.queueStageText,
    opsText: panels.queueOpsText,
    signalText: panels.queueSignalText,
    detailText: panels.queueDetailText
  });
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
    stateText: panels.runtimeStateText,
    stageText: panels.runtimeStageText,
    opsText: panels.runtimeOpsText,
    signalText: panels.runtimeSignalText,
    detailText: panels.runtimeDetailText
  });
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
    stateText: panels.dispatchStateText,
    stageText: panels.dispatchStageText,
    opsText: panels.dispatchOpsText,
    signalText: panels.dispatchSignalText,
    detailText: panels.dispatchDetailText
  });
  return panels;
}

function buildOperationsLoopMicroPanels(loopDeck, active) {
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
      streakFamilyText: "FLOW WAIT | STATUS -- | STREAK --",
      streakFlowText: "PERSONA WAIT | FLOW WAIT | OFFER --",
      streakSummaryText: "STREAK -- | OFFER -- | FLOW WAIT",
      streakGateText: "STREAK -- | ENTRY WAIT | STATUS --",
      streakLeadText: "PERSONA WAIT | FLOW WAIT | STREAK --",
      streakWindowText: "STREAK -- | OFFER -- | STATUS --",
      streakPressureText: "STREAK -- | OFFER -- | BAND --",
      streakResponseText: "STREAK -- | FLOW WAIT | PERSONA WAIT",
      streakAttentionText: "STREAK -- | OFFER -- | FLOW WAIT",
      streakCadenceText: "PERSONA WAIT | FLOW WAIT | STREAK --"
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
    });
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
    });
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
    });
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
    });
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
      stateText: panels.offerStateText,
      stageText: panels.offerStageText,
      opsText: panels.offerOpsText,
      signalText: panels.offerSignalText,
      detailText: panels.offerDetailText
    });
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
      stateText: panels.claimStateText,
      stageText: panels.claimStageText,
      opsText: panels.claimOpsText,
      signalText: panels.claimSignalText,
      detailText: panels.claimDetailText
    });
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
      stateText: panels.streakStateText,
      stageText: panels.streakStageText,
      opsText: panels.streakOpsText,
      signalText: panels.streakSignalText,
      detailText: panels.streakDetailText
    });
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
      stateText: panels.lootStateText,
      stageText: panels.lootStageText,
      opsText: panels.lootOpsText,
      signalText: panels.lootSignalText,
      detailText: panels.lootDetailText
    });
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
    offerFocusText: buildLoopMicroDetail(`ENTRY ${entryLabel}`, `FOCUS ${offerValue}`, `FLOW ${microflowLabel}`),
    claimFocusText: buildLoopMicroDetail(`SEQ ${sequenceLabel}`, `FOCUS ${claimValue}`, `STAGE ${stageValue}`),
    streakFocusText: buildLoopMicroDetail(
      `PERSONA ${personalityCaption || "SYNC"}`,
      `FOCUS ${streakValue}`,
      `FLOW ${microflowLabel}`
    ),
    lootFocusText: buildLoopMicroDetail(`ENTRY ${entryLabel}`, `FOCUS ${lootValue}`, `FLOW ${microflowLabel}`),
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
    streakFamilyText: buildLoopMicroDetail(`FLOW ${microflowLabel}`, `STATUS ${loopStatusLabel}`, `STREAK ${streakValue}`),
    streakFlowText: buildLoopMicroDetail(`PERSONA ${personalityCaption || "SYNC"}`, `FLOW ${microflowLabel}`, `OFFER ${offerValue}`),
    streakSummaryText: buildLoopMicroDetail(`STREAK ${streakValue}`, `OFFER ${offerValue}`, `FLOW ${microflowLabel}`),
    streakGateText: buildLoopMicroDetail(`STREAK ${streakValue}`, `ENTRY ${entryLabel}`, `STATUS ${loopStatusLabel}`),
    streakLeadText: buildLoopMicroDetail(`PERSONA ${personalityCaption || "SYNC"}`, `FLOW ${microflowLabel}`, `STREAK ${streakValue}`),
    streakWindowText: buildLoopMicroDetail(`STREAK ${streakValue}`, `OFFER ${offerValue}`, `STATUS ${loopStatusLabel}`),
    streakPressureText: buildLoopMicroDetail(`STREAK ${streakValue}`, `OFFER ${offerValue}`, `BAND ${contractBand}`),
    streakResponseText: buildLoopMicroDetail(`STREAK ${streakValue}`, `FLOW ${loopStatusLabel}`, `PERSONA ${personalityCaption || "SYNC"}`),
    streakAttentionText: buildLoopAttentionDetail(`STREAK ${streakValue}`, `OFFER ${offerValue}`, `FLOW ${microflowLabel}`),
    streakCadenceText: buildLoopCadenceDetail(`PERSONA ${personalityCaption || "SYNC"}`, `FLOW ${microflowLabel}`, `STREAK ${streakValue}`)
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
  });
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
  });
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
  });
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
  });
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
    stateText: panels.offerStateText,
    stageText: panels.offerStageText,
    opsText: panels.offerOpsText,
    signalText: panels.offerSignalText,
    detailText: panels.offerDetailText
  });
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
    stateText: panels.claimStateText,
    stageText: panels.claimStageText,
    opsText: panels.claimOpsText,
    signalText: panels.claimSignalText,
    detailText: panels.claimDetailText
  });
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
    stateText: panels.streakStateText,
    stageText: panels.streakStageText,
    opsText: panels.streakOpsText,
    signalText: panels.streakSignalText,
    detailText: panels.streakDetailText
  });
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
    stateText: panels.lootStateText,
    stageText: panels.lootStageText,
    opsText: panels.lootOpsText,
    signalText: panels.lootSignalText,
    detailText: panels.lootDetailText
  });
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

function buildAssetManifestStripPayload(assetMetrics) {
  if (!assetMetrics || toNum(assetMetrics.totalEntries) <= 0) return null;
  return {
    tone: mapRuntimeTone(assetMetrics.tone || "balanced"),
    badgeText: `ASSET ${toNum(assetMetrics.readyEntries)}/${toNum(assetMetrics.totalEntries)}`,
    badgeTone: mapBadgeTone(assetMetrics.tone || "info"),
    lineText: `Missing ${toNum(assetMetrics.missingEntries)} | Integrity ${Math.round(clamp(assetMetrics.integrityRatio) * 100)}%`,
    hintText: `Manifest ${toText(assetMetrics.manifestRevision, "local")} | source ${toText(assetMetrics.sourceMode, "fallback")}`,
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
      loopDuelCards: loopMicro.duelCards,
      loopDuelBlocks: loopMicro.duelBlocks,
      loopDuelFlowCards: loopMicro.duelFlowCards,
      loopDuelFlowBlocks: loopMicro.duelFlowBlocks,
      loopDuelFlowPanels: loopMicro.duelFlowPanels,
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
      loopLadderCards: loopMicro.ladderCards,
      loopLadderBlocks: loopMicro.ladderBlocks,
      loopLadderFlowCards: loopMicro.ladderFlowCards,
      loopLadderFlowBlocks: loopMicro.ladderFlowBlocks,
      loopLadderFlowPanels: loopMicro.ladderFlowPanels,
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
      loopTelemetryCards: loopMicro.telemetryCards,
      loopTelemetryBlocks: loopMicro.telemetryBlocks,
      loopTelemetryFlowCards: loopMicro.telemetryFlowCards,
      loopTelemetryFlowBlocks: loopMicro.telemetryFlowBlocks,
      loopTelemetryFlowPanels: loopMicro.telemetryFlowPanels
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
        offerCards: loopMicro.offerCards,
        offerBlocks: loopMicro.offerBlocks,
        offerFlowCards: loopMicro.offerFlowCards,
        offerFlowBlocks: loopMicro.offerFlowBlocks,
        offerFlowPanels: loopMicro.offerFlowPanels,
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
        claimCards: loopMicro.claimCards,
        claimBlocks: loopMicro.claimBlocks,
        claimFlowCards: loopMicro.claimFlowCards,
        claimFlowBlocks: loopMicro.claimFlowBlocks,
        claimFlowPanels: loopMicro.claimFlowPanels,
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
        streakCards: loopMicro.streakCards,
        streakBlocks: loopMicro.streakBlocks,
        streakFlowCards: loopMicro.streakFlowCards,
        streakFlowBlocks: loopMicro.streakFlowBlocks,
        streakFlowPanels: loopMicro.streakFlowPanels,
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
        lootCards: loopMicro.lootCards,
        lootBlocks: loopMicro.lootBlocks,
        lootFlowCards: loopMicro.lootFlowCards,
        lootFlowBlocks: loopMicro.lootFlowBlocks,
        lootFlowPanels: loopMicro.lootFlowPanels
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
    loopWalletCards: loopMicro.walletCards,
    loopWalletBlocks: loopMicro.walletBlocks,
    loopWalletFlowCards: loopMicro.walletFlowCards,
    loopWalletFlowBlocks: loopMicro.walletFlowBlocks,
    loopWalletFlowPanels: loopMicro.walletFlowPanels,
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
    loopPayoutFlowCards: loopMicro.payoutFlowCards,
    loopPayoutFlowBlocks: loopMicro.payoutFlowBlocks,
    loopPayoutFlowPanels: loopMicro.payoutFlowPanels,
    loopRouteFlowCards: loopMicro.routeFlowCards,
    loopRouteFlowBlocks: loopMicro.routeFlowBlocks,
    loopRouteFlowPanels: loopMicro.routeFlowPanels,
    loopPremiumFlowCards: loopMicro.premiumFlowCards,
    loopPremiumFlowBlocks: loopMicro.premiumFlowBlocks,
    loopPremiumFlowPanels: loopMicro.premiumFlowPanels,
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
    loopQueueCards: loopMicro.queueCards,
    loopQueueBlocks: loopMicro.queueBlocks,
    loopQueueFlowCards: loopMicro.queueFlowCards,
    loopQueueFlowBlocks: loopMicro.queueFlowBlocks,
    loopQueueFlowPanels: loopMicro.queueFlowPanels,
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
    loopRuntimeCards: loopMicro.runtimeCards,
    loopRuntimeBlocks: loopMicro.runtimeBlocks,
    loopRuntimeFlowCards: loopMicro.runtimeFlowCards,
    loopRuntimeFlowBlocks: loopMicro.runtimeFlowBlocks,
    loopRuntimeFlowPanels: loopMicro.runtimeFlowPanels,
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
    loopDispatchCards: loopMicro.dispatchCards,
    loopDispatchBlocks: loopMicro.dispatchBlocks,
    loopDispatchFlowCards: loopMicro.dispatchFlowCards,
    loopDispatchFlowBlocks: loopMicro.dispatchFlowBlocks,
    loopDispatchFlowPanels: loopMicro.dispatchFlowPanels
  };
}

function buildAdminAssetStatusPayload(adminPanels) {
  const assets = asRecord(adminPanels?.assets);
  const summary = asRecord(assets.summary);
  const localManifest = asRecord(assets.local_manifest);
  const rows = asArray(localManifest.rows).slice(0, 8).map((row) => {
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
  return {
    summaryLineText: `Assets: ready ${Math.round(toNum(summary.ready_assets))}/${Math.round(toNum(summary.total_assets))} | missing ${Math.round(toNum(summary.missing_assets))}`,
    revisionLineText: `Manifest: ${toText(activeManifest.manifest_revision || activeManifest.state_json?.manifest_revision || "local")} | updated ${toText(activeManifest.updated_at, "-")}`,
    rows,
    emptyText: "Asset kaydi bulunmuyor"
  };
}

function buildAdminAssetRuntimePayload(mutators, adminPanels) {
  const assets = asRecord(adminPanels?.assets);
  const localManifest = asRecord(assets.local_manifest);
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
  return {
    tone: mapRuntimeTone(metrics.tone || "balanced"),
    readyRatio: clamp(metrics.readyRatio),
    syncRatio: clamp(metrics.integrityRatio),
    signalLineText: `Ready ${Math.round(clamp(metrics.readyRatio) * 100)}% | Integrity ${Math.round(clamp(metrics.integrityRatio) * 100)}% | Missing ${Math.round(toNum(metrics.missingEntries))}`,
    chips: [
      { id: "adminAssetReadyChip", text: `READY ${Math.round(clamp(metrics.readyRatio) * 100)}%`, tone: mapRuntimeTone(metrics.readyRatio < 0.7 ? "pressure" : "advantage"), level: clamp(metrics.readyRatio) },
      { id: "adminAssetSyncChip", text: `SYNC ${Math.round(clamp(metrics.integrityRatio) * 100)}%`, tone: mapRuntimeTone(metrics.integrityRatio < 0.7 ? "critical" : "advantage"), level: clamp(metrics.integrityRatio) },
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

  return {
    sceneStatus: {
      ...(buildSceneStatusPayload(profileMetrics) || {}),
      loopLine: buildSceneLoopDeckPayload(scene).lineText
    },
    sceneTelemetry: buildSceneTelemetryPayload(mutators, telemetryInput),
    publicTelemetry: {
      assetManifest: buildAssetManifestStripPayload(assetMetrics),
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
