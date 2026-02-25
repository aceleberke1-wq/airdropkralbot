type AssetManifestMetrics = {
  available: boolean;
  sourceMode: string;
  manifestRevision: string;
  manifestHash: string;
  hashShort: string;
  activatedAt: string | null;
  totalEntries: number;
  readyEntries: number;
  missingEntries: number;
  missingRatio: number;
  integrityOkEntries: number;
  integrityBadEntries: number;
  integrityUnknownEntries: number;
  integrityRatio: number;
  readyRatio: number;
  tone: string;
};

type PvpLeaderboardState = {
  list: any[];
  meta: {
    transport: string;
    server_tick: number;
    limit: number;
  };
};

type SceneEffectiveProfile = {
  sceneMode: string;
  perfTier: string;
  fps: number;
  readyAssets: number;
  totalAssets: number;
  isLite: boolean;
  assetRatio: number;
  transport: string;
  pvpStatus: string;
  manifestRevision: string;
  manifestShort: string;
  manifestSource: string;
  ladderActivity: number;
  pressureRatio: number;
  manifestSyncRatio: number;
  assetSyncRatio: number;
  assetReadyRatio: number;
  assetRuntimeTone: string;
  manifestRiskRatio: number;
  perfTone: string;
  transportTone: string;
  profileLine: string;
  liteBadge: {
    shouldShow: boolean;
    text: string;
    tone: "warn" | "info";
    mode: "lite" | "watch" | "ok";
    title: string;
  };
};

type ProviderRuntimeMetrics = {
  providerTotal: number;
  providerOk: number;
  timeoutCount: number;
  providerRatio: number;
  timeoutRatio: number;
  avgLatency: number;
  latestAgeSec: number | null;
  staleRatio: number;
  autoApproveCount: number;
  autoRejectCount: number;
  queuePressure: number;
  tone: string;
  latestStatus: string;
};

type TokenRouteRuntimeMetrics = {
  totalRoutes: number;
  enabledRoutes: number;
  missingRoutes: number;
  routeCoverage: number;
  providerCount: number;
  okProviderCount: number;
  agreementRatio: number;
  providerRatio: number;
  quorumRatio: number;
  quorumDecision: string;
  selectedChain: string;
  gateOpen: boolean;
  tone: string;
};

type TokenLifecycleMetrics = {
  status: string;
  progressRatio: number;
  verifyConfidence: number;
  providerCount: number;
  okProviderCount: number;
  agreementRatio: number;
  providerRatio: number;
  routeCoverage: number;
  gateOpen: boolean;
  tone: string;
};

type TokenDirectorMetrics = {
  nextStepKey: string;
  nextStepLabel: string;
  verifyStateLabel: string;
  readinessRatio: number;
  riskRatio: number;
  routeCoverage: number;
  verifyConfidence: number;
  providerRatio: number;
  timeoutRatio: number;
  staleRatio: number;
  queuePressure: number;
  gateOpen: boolean;
  manualQueueCount: number;
  autoDecisionCount: number;
  pendingPayoutCount: number;
  tone: string;
};

type DecisionTraceMetrics = {
  sampleCount: number;
  approveCount: number;
  rejectCount: number;
  fallbackCount: number;
  manualQueueCount: number;
  payoutQueueCount: number;
  avgRisk: number;
  rejectRatio: number;
  approveRatio: number;
  decisionFlow: number;
  riskPressure: number;
  topReason: string;
  topReasonCount: number;
  manualPressure: number;
  tone: string;
  reasonEntries: Array<[string, number]>;
};

type TreasuryRuntimeMetrics = {
  totalRoutes: number;
  enabledRoutes: number;
  routeCoverage: number;
  routeMissing: number;
  gateOpen: boolean;
  apiTotal: number;
  apiOk: number;
  apiRatio: number;
  apiLatencyAvg: number;
  manualQueueCount: number;
  autoDecisionCount: number;
  pendingPayoutCount: number;
  queuePressure: number;
  autoPolicyEnabled: boolean;
  tone: string;
};

type SceneAlarmMetrics = {
  ladderPressure: number;
  ladderFreshness: number;
  ladderActivity: number;
  assetReadyRatio: number;
  assetSyncRatio: number;
  assetIntegrityRatio: number;
  assetMismatch: number;
  queueSize: number;
  queueRatio: number;
  windowSafety: number;
  driftRatio: number;
  rejectCategory: string;
  rejectLabel: string;
  rejectHint: string;
  rejectShort: string;
  rejectTone: string;
  rejectSeverity: number;
  recentReject: boolean;
  rejectFreshness: number;
  severity: number;
  tone: string;
  sceneAlarmFlash: number;
  alarmBadgeText: string;
  alarmBadgeTone: "warn" | "default" | "info";
  alarmLineText: string;
  alarmHintText: string;
  rejectCode: string;
};

type V3StateMutatorBridge = {
  computeAssetManifestMetrics: (manifestPayload: any) => AssetManifestMetrics;
  computePvpLeaderboardState: (payloadData: any, currentTransport?: string) => PvpLeaderboardState;
  computeSceneEffectiveProfile: (input: any) => SceneEffectiveProfile;
  computeProviderRuntimeMetrics: (rows: any[], decisions: any[], nowMs?: number) => ProviderRuntimeMetrics;
  computeTokenRouteRuntimeMetrics: (input: any) => TokenRouteRuntimeMetrics;
  computeTokenLifecycleMetrics: (input: any) => TokenLifecycleMetrics;
  computeTokenDirectorMetrics: (input: any) => TokenDirectorMetrics;
  computeDecisionTraceMetrics: (decisions: any[], manualQueue: any[], payoutQueue: any[]) => DecisionTraceMetrics;
  computeTreasuryRuntimeMetrics: (input: any) => TreasuryRuntimeMetrics;
  computeSceneAlarmMetrics: (input: any) => SceneAlarmMetrics;
};

declare global {
  interface Window {
    __AKR_STATE_MUTATORS__?: V3StateMutatorBridge;
  }
}

function asNum(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function asString(value: unknown, fallback = ""): string {
  const text = String(value ?? "");
  return text || fallback;
}

function classifyRejectReasonBridge(reason: unknown): {
  category: string;
  label: string;
  hint: string;
  shortLabel: string;
  tone: string;
} {
  const raw = asString(reason).trim().toLowerCase();
  if (!raw) {
    return { category: "none", label: "No Reject", hint: "Reject kaydi yok.", shortLabel: "NONE", tone: "neutral" };
  }
  if (/duplicate|replay/.test(raw)) {
    return { category: "duplicate", label: "Duplicate/Replay", hint: "Ayni aksiyon tekrarlandi. Yeni tick bekle.", shortLabel: "DUP", tone: "pressure" };
  }
  if (/stale|expired|timeout/.test(raw)) {
    return { category: "stale", label: "Stale Tick", hint: "Tick zamani gecti. State/tick yenile.", shortLabel: "STA", tone: "pressure" };
  }
  if (/auth|signature|sig|uid|ts/.test(raw)) {
    return { category: "auth", label: "Auth/Signature", hint: "Mini App auth yenile ve tekrar dene.", shortLabel: "AUTH", tone: "critical" };
  }
  if (/sequence|seq/.test(raw)) {
    return { category: "sequence", label: "Sequence Drift", hint: "action_seq sirasi bozuk. Queue temizle.", shortLabel: "SEQ", tone: "critical" };
  }
  if (/window|latency|late|early/.test(raw)) {
    return { category: "window", label: "Timing Window", hint: "Aksiyon pencere disi. Tick ritmine don.", shortLabel: "WND", tone: "critical" };
  }
  if (/session|match/.test(raw)) {
    return { category: "session", label: "Session Drift", hint: "Duel state sync al ve sessioni dogrula.", shortLabel: "SES", tone: "pressure" };
  }
  if (/invalid|unexpected|action/.test(raw)) {
    return { category: "invalid", label: "Invalid Action", hint: "Expected aksiyona geri don.", shortLabel: "INV", tone: "pressure" };
  }
  return { category: "unknown", label: "Unknown Reject", hint: "Queue ve state sync kontrolu yap.", shortLabel: "UNK", tone: "pressure" };
}

function computeAssetManifestMetrics(manifestPayload: any): AssetManifestMetrics {
  const data = manifestPayload && typeof manifestPayload === "object" ? manifestPayload : {};
  const revision = data.active_revision && typeof data.active_revision === "object" ? data.active_revision : null;
  const entries = Array.isArray(data.entries) ? data.entries : [];
  const totalEntries = entries.length;
  const readyEntries = entries.filter((row) => row && row.exists_local === true).length;
  const missingEntries = Math.max(0, totalEntries - readyEntries);
  const integrityBuckets = entries.reduce(
    (acc, row) => {
      const raw = String(row?.integrity_status || "").toLowerCase();
      if (!raw) {
        acc.unknown += 1;
      } else if (/(ok|pass|ready|valid|verified)/.test(raw)) {
        acc.ok += 1;
      } else if (/(missing|mismatch|fail|error|bad)/.test(raw)) {
        acc.bad += 1;
      } else {
        acc.unknown += 1;
      }
      return acc;
    },
    { ok: 0, bad: 0, unknown: 0 }
  );
  const integrityKnownTotal = Math.max(0, integrityBuckets.ok + integrityBuckets.bad);
  const integrityRatio =
    totalEntries > 0
      ? integrityKnownTotal > 0
        ? clamp(integrityBuckets.ok / integrityKnownTotal, 0, 1)
        : readyEntries > 0
          ? clamp(readyEntries / Math.max(1, totalEntries), 0, 1)
          : 0
      : 0;
  const readyRatio = totalEntries > 0 ? clamp(readyEntries / totalEntries, 0, 1) : 0;
  const missingRatio = totalEntries > 0 ? clamp(missingEntries / totalEntries, 0, 1) : 0;
  const sourceMode = asString(revision?.source || (data.available ? "registry" : "fallback") || "fallback");
  const manifestRevision = asString(revision?.manifest_revision || data.manifest_revision || "local");
  const manifestHash = asString(revision?.manifest_hash || "");
  const tone =
    missingEntries >= 2 || (totalEntries > 0 && integrityRatio < 0.62)
      ? "critical"
      : missingEntries > 0 || (totalEntries > 0 && integrityRatio < 0.9)
        ? "pressure"
        : totalEntries > 0
          ? "advantage"
          : "balanced";
  return {
    available: data.available !== false,
    sourceMode,
    manifestRevision,
    manifestHash,
    hashShort: manifestHash ? manifestHash.slice(0, 10) : "--",
    activatedAt: revision?.activated_at || revision?.updated_at || revision?.created_at || null,
    totalEntries,
    readyEntries,
    missingEntries,
    missingRatio,
    integrityOkEntries: integrityBuckets.ok,
    integrityBadEntries: integrityBuckets.bad,
    integrityUnknownEntries: integrityBuckets.unknown,
    integrityRatio,
    readyRatio,
    tone
  };
}

function computePvpLeaderboardState(payloadData: any, currentTransport = "poll"): PvpLeaderboardState {
  const data = payloadData && typeof payloadData === "object" ? payloadData : {};
  const list = Array.isArray(data.leaderboard) ? data.leaderboard : [];
  return {
    list,
    meta: {
      transport: asString(data.transport || currentTransport || "poll").toLowerCase() || "poll",
      server_tick: asNum(data.server_tick || Date.now()),
      limit: list.length
    }
  };
}

function computeSceneEffectiveProfile(input: any): SceneEffectiveProfile {
  const data = input && typeof input === "object" ? input : {};
  const sceneMode = asString(data.sceneMode || "pro").toUpperCase();
  const perfTier = asString(data.perfTier || "normal").toUpperCase();
  const fps = Math.max(0, Math.round(asNum(data.fps || 0)));
  const assetsText = asString(data.assetsText || "Assets: -");
  const assetRuntime = data.assetRuntime && typeof data.assetRuntime === "object" ? data.assetRuntime : {};
  const manifestMeta = data.manifestMeta && typeof data.manifestMeta === "object" ? data.manifestMeta : {};
  const telemetryReadyAssets = asNum(data.telemetryReadyAssets || 0);
  const telemetryTotalAssets = asNum(data.telemetryTotalAssets || 0);
  const telemetrySceneMode = asString(data.telemetrySceneMode || "").toUpperCase();
  const assetReadyMatch = assetsText.match(/Assets:\s*(\d+)\/(\d+)/i);
  const readyAssets = telemetryTotalAssets > 0 ? telemetryReadyAssets : assetReadyMatch ? asNum(assetReadyMatch[1]) : 0;
  const totalAssets = telemetryTotalAssets > 0 ? Math.max(1, telemetryTotalAssets) : assetReadyMatch ? Math.max(1, asNum(assetReadyMatch[2])) : 1;
  const isLite = telemetrySceneMode
    ? telemetrySceneMode.includes("LITE")
    : assetsText.toUpperCase().includes("LITE") || assetsText.toLowerCase().includes("fallback");
  const assetRatio = clamp(readyAssets / Math.max(1, totalAssets), 0, 1);
  const transport = asString(data.transport || "poll").toUpperCase();
  const pvpStatus = asString(data.pvpStatus || "idle").toLowerCase();
  const manifestRevision = asString(
    assetRuntime.manifestRevision || manifestMeta.manifestRevision || data.telemetryManifestRevision || "local"
  );
  const manifestShort = manifestRevision.length > 10 ? manifestRevision.slice(0, 10) : manifestRevision;
  const manifestSource = asString(
    assetRuntime.sourceMode || manifestMeta.sourceMode || data.telemetryManifestProvider || "fallback"
  );
  const ladderActivity = clamp(asNum(data.ladderActivity || 0), 0, 1);
  const pressureRatio = clamp(asNum(data.combatHeat || 0) * 0.45 + asNum(data.threatRatio || 0) * 0.55, 0, 1);
  const manifestSyncRatio = clamp(asNum(manifestMeta.integrityRatio ?? 1), 0, 1);
  const assetSyncRatio = clamp(asNum(assetRuntime.syncRatio ?? manifestSyncRatio ?? 1), 0, 1);
  const assetReadyRatio = clamp(asNum(assetRuntime.readyRatio ?? manifestMeta.readyRatio ?? assetRatio), 0, 1);
  const assetRuntimeTone = asString(assetRuntime.tone || manifestMeta.tone || (isLite ? "pressure" : "balanced")).toLowerCase();
  const manifestRiskRatio = clamp((1 - assetReadyRatio) * 0.42 + (1 - assetSyncRatio) * 0.36 + (1 - manifestSyncRatio) * 0.22, 0, 1);
  const perfTone =
    fps > 0 && fps < 28 ? "critical" : fps > 0 && fps < 40 ? "pressure" : perfTier === "LOW" ? "pressure" : "safe";
  const transportTone =
    pvpStatus === "resolved"
      ? "balanced"
      : pvpStatus === "active"
        ? pressureRatio > 0.68
          ? "critical"
          : pressureRatio > 0.42
            ? "pressure"
            : "balanced"
        : "neutral";
  const hudDensity = asString(data.hudDensity || "full");
  const postFx = Number(asNum(data.postFxLevel || 0.9)).toFixed(2);
  const liteBadge = (() => {
    const shouldShow = isLite || manifestRiskRatio >= 0.2;
    let text = "Lite Scene";
    let tone: "warn" | "info" = "info";
    let mode: "lite" | "watch" | "ok" = "ok";
    if (isLite) {
      const reasonText =
        manifestRiskRatio >= 0.6
          ? `Risk ${Math.round(manifestRiskRatio * 100)}`
          : assetReadyRatio < 0.95
            ? `Ready ${Math.round(assetReadyRatio * 100)}%`
            : `Int ${Math.round(assetSyncRatio * 100)}%`;
      text = `Lite Scene | ${reasonText}`;
      tone = manifestRiskRatio >= 0.5 ? "warn" : "info";
      mode = "lite";
    } else if (manifestRiskRatio >= 0.2) {
      text = `Asset Watch | ${Math.round((1 - assetSyncRatio) * 100)}% drift`;
      tone = manifestRiskRatio >= 0.48 ? "warn" : "info";
      mode = "watch";
    }
    return {
      shouldShow,
      text,
      tone,
      mode,
      title:
        `scene=${sceneMode} perf=${perfTier} ladder=${Math.round(ladderActivity * 100)}% ` +
        `ready=${Math.round(assetReadyRatio * 100)}% sync=${Math.round(assetSyncRatio * 100)}% ` +
        `manifest=${manifestShort} ${manifestSource}`
    };
  })();
  return {
    sceneMode,
    perfTier,
    fps,
    readyAssets,
    totalAssets,
    isLite,
    assetRatio,
    transport,
    pvpStatus,
    manifestRevision,
    manifestShort,
    manifestSource,
    ladderActivity,
    pressureRatio,
    manifestSyncRatio,
    assetSyncRatio,
    assetReadyRatio,
    assetRuntimeTone,
    manifestRiskRatio,
    perfTone,
    transportTone,
    profileLine:
      `Profile: hud ${hudDensity} | postfx ${postFx} | rev ${manifestShort} | ` +
      `assets ${readyAssets}/${totalAssets} | int ${Math.round(assetSyncRatio * 100)}%`,
    liteBadge
  };
}

function computeProviderRuntimeMetrics(rowsInput: any[], decisionsInput: any[], nowMs = Date.now()): ProviderRuntimeMetrics {
  const rows = Array.isArray(rowsInput) ? rowsInput : [];
  const decisions = Array.isArray(decisionsInput) ? decisionsInput : [];
  const providerTotal = rows.length;
  const providerOk = rows.filter((row) => row && row.ok === true).length;
  const timeoutCount = rows.filter((row) => {
    const code = asString(row?.error_code).toLowerCase();
    const message = asString(row?.error_message).toLowerCase();
    return code.includes("timeout") || message.includes("timeout") || message.includes("timed out");
  }).length;
  const providerRatio = providerTotal > 0 ? clamp(providerOk / providerTotal, 0, 1) : 0.35;
  const timeoutRatio = providerTotal > 0 ? clamp(timeoutCount / providerTotal, 0, 1) : 0;
  const avgLatency = providerTotal > 0 ? rows.reduce((sum, row) => sum + asNum(row?.latency_ms || 0), 0) / providerTotal : 0;
  const latest = rows[0] || null;
  const latestAgeSec =
    latest?.checked_at ? Math.max(0, Math.round((nowMs - new Date(latest.checked_at).getTime()) / 1000)) : null;
  const staleRatio = latestAgeSec == null ? 0.3 : clamp(latestAgeSec / 180, 0, 1);
  const recentDecisions = decisions.slice(0, 4);
  const autoApproveCount = recentDecisions.filter((d) => asString(d?.decision).toLowerCase().includes("approve")).length;
  const autoRejectCount = recentDecisions.filter((d) => asString(d?.decision).toLowerCase().includes("reject")).length;
  const queuePressure = clamp(timeoutRatio * 0.35 + (1 - providerRatio) * 0.4 + staleRatio * 0.25, 0, 1);
  const tone =
    providerTotal === 0
      ? "neutral"
      : providerRatio < 0.35 || timeoutRatio > 0.5 || staleRatio > 0.9
        ? "critical"
        : providerRatio < 0.7 || timeoutRatio > 0.2 || staleRatio > 0.5
          ? "pressure"
          : "advantage";
  const latestStatus = latest ? `${latest.ok ? "OK" : "FAIL"} ${asNum(latest.status_code || 0) || "-"}` : "WAIT";
  return {
    providerTotal,
    providerOk,
    timeoutCount,
    providerRatio,
    timeoutRatio,
    avgLatency,
    latestAgeSec,
    staleRatio,
    autoApproveCount,
    autoRejectCount,
    queuePressure,
    tone,
    latestStatus
  };
}

function computeTokenRouteRuntimeMetrics(input: any): TokenRouteRuntimeMetrics {
  const data = input && typeof input === "object" ? input : {};
  const chains = Array.isArray(data.chains) ? data.chains : [];
  const quoteData = data.quoteData && typeof data.quoteData === "object" ? data.quoteData : {};
  const payoutGate = data.payoutGate && typeof data.payoutGate === "object" ? data.payoutGate : {};
  const selectedChain = asString(data.selectedChain || quoteData.chain || "").toUpperCase();
  const selectedRoute =
    chains.find((row) => asString(row?.chain).toUpperCase() === selectedChain) || null;
  const totalRoutes = chains.length;
  const enabledRoutes = chains.filter((row) => row && row.enabled).length;
  const missingRoutes = Math.max(0, totalRoutes - enabledRoutes);
  const routeCoverage = totalRoutes > 0 ? clamp(enabledRoutes / totalRoutes, 0, 1) : 0;
  const payAddress = asString(quoteData.pay_address || selectedRoute?.address || "").trim();
  const gate = quoteData.payout_gate && typeof quoteData.payout_gate === "object" ? quoteData.payout_gate : payoutGate;
  const gateOpen = gate?.allowed === true;
  const quorum = quoteData.quote_quorum && typeof quoteData.quote_quorum === "object" ? quoteData.quote_quorum : {};
  const providerCount = Math.max(0, Math.floor(asNum(quorum.provider_count || 0)));
  const okProviderCount = Math.max(0, Math.floor(asNum(quorum.ok_provider_count || 0)));
  const agreementRatio = clamp(asNum(quorum.agreement_ratio || 0), 0, 1);
  const providerRatio = providerCount > 0 ? clamp(okProviderCount / providerCount, 0, 1) : 0;
  const quorumRatio =
    providerCount > 0 ? clamp(providerRatio * 0.58 + agreementRatio * 0.42, 0, 1) : routeCoverage > 0 ? 0.35 : 0;
  const quorumDecision = asString(quorum.decision || "WAIT").toUpperCase() || "WAIT";
  const tone =
    totalRoutes === 0 || enabledRoutes === 0
      ? "critical"
      : !selectedRoute && selectedChain
        ? "pressure"
        : selectedRoute && !selectedRoute.enabled
          ? "critical"
          : quoteData && Object.keys(quoteData).length > 0 && !payAddress
            ? "pressure"
            : missingRoutes > 0 || (providerCount > 0 && quorumRatio < 0.45)
              ? "pressure"
              : gateOpen
                ? "advantage"
                : "balanced";
  return {
    totalRoutes,
    enabledRoutes,
    missingRoutes,
    routeCoverage,
    providerCount,
    okProviderCount,
    agreementRatio,
    providerRatio,
    quorumRatio,
    quorumDecision,
    selectedChain,
    gateOpen,
    tone
  };
}

function computeTokenLifecycleMetrics(input: any): TokenLifecycleMetrics {
  const data = input && typeof input === "object" ? input : {};
  const lifecycle = data.lifecycle && typeof data.lifecycle === "object" ? data.lifecycle : {};
  const route = data.route && typeof data.route === "object" ? data.route : {};
  const quoteData = data.quoteData && typeof data.quoteData === "object" ? data.quoteData : {};
  const tokenData = data.tokenData && typeof data.tokenData === "object" ? data.tokenData : {};
  const quoteReady = Boolean(data.quoteReady);
  const hasRequest = Boolean(data.hasRequest);
  const providerCount = Math.max(0, Math.floor(asNum(data.providerCount ?? quoteData?.quote_quorum?.provider_count ?? 0)));
  const okProviderCount = Math.max(0, Math.floor(asNum(data.okProviderCount ?? quoteData?.quote_quorum?.ok_provider_count ?? 0)));
  const agreementRatio = clamp(asNum(data.agreementRatio ?? quoteData?.quote_quorum?.agreement_ratio ?? 0), 0, 1);
  const providerRatio =
    providerCount > 0 ? clamp(okProviderCount / providerCount, 0, 1) : clamp(asNum(route.quorumRatio || 0), 0, 1);
  const verifyConfidence = clamp(providerRatio * 0.56 + agreementRatio * 0.44, 0, 1);
  const routeCoverage = clamp(asNum(route.routeCoverage || 0), 0, 1);
  const gateOpen =
    route.gateOpen === true || quoteData?.payout_gate?.allowed === true || tokenData?.payout_gate?.allowed === true;
  const progressRatio = clamp(
    Math.max(
      asNum(lifecycle.progress || 0),
      quoteReady ? 0.18 : 0.08,
      hasRequest ? (asNum(lifecycle.progress || 0.38) || 0.38) : 0
    ),
    0,
    1
  );
  const status = asString(lifecycle.status || "").toLowerCase() || "none";
  const tone =
    asString(lifecycle.tone) === "critical"
      ? "critical"
      : !gateOpen
        ? "pressure"
        : hasRequest && status === "approved"
          ? "advantage"
          : hasRequest && status === "tx_submitted" && verifyConfidence < 0.35
            ? "pressure"
            : hasRequest && status === "tx_submitted"
              ? "balanced"
              : quoteReady
                ? "balanced"
                : "neutral";
  return {
    status,
    progressRatio,
    verifyConfidence,
    providerCount,
    okProviderCount,
    agreementRatio,
    providerRatio,
    routeCoverage,
    gateOpen,
    tone
  };
}

function computeTokenDirectorMetrics(input: any): TokenDirectorMetrics {
  const data = input && typeof input === "object" ? input : {};
  const quoteReady = Boolean(data.quoteReady);
  const hasRequest = Boolean(data.hasRequest);
  const txSeen = Boolean(data.txSeen);
  const gateOpen = Boolean(data.gateOpen);
  const latestStatus = asString(data.latestStatus || "none").toLowerCase();
  const routeCoverage = clamp(asNum(data.routeCoverage || 0), 0, 1);
  const verifyConfidence = clamp(asNum(data.verifyConfidence || 0), 0, 1);
  const providerRatio = clamp(asNum(data.providerRatio || 0), 0, 1);
  const timeoutRatio = clamp(asNum(data.timeoutRatio || 0), 0, 1);
  const staleRatio = clamp(asNum(data.staleRatio || 0), 0, 1);
  const queuePressure = clamp(asNum(data.queuePressure || 0), 0, 1);
  const riskScore = clamp(asNum(data.riskScore || 0), 0, 1);
  const manualQueueCount = Math.max(0, Math.floor(asNum(data.manualQueueCount || 0)));
  const autoDecisionCount = Math.max(0, Math.floor(asNum(data.autoDecisionCount || 0)));
  const pendingPayoutCount = Math.max(0, Math.floor(asNum(data.pendingPayoutCount || 0)));

  let nextStepKey = "quote";
  let nextStepLabel = "Quote Al";
  let verifyStateLabel = "VERIFY WAIT";
  if (!gateOpen) {
    nextStepKey = "gate";
    nextStepLabel = "Gate Acilmasini Bekle";
    verifyStateLabel = "GATE LOCK";
  } else if (!quoteReady) {
    nextStepKey = "quote";
    nextStepLabel = "Quote Al / Zincir Sec";
    verifyStateLabel = "VERIFY WAIT";
  } else if (!hasRequest) {
    nextStepKey = "request";
    nextStepLabel = "Alim Talebi Olustur";
    verifyStateLabel = "REQ NEEDED";
  } else if (latestStatus === "rejected" || latestStatus === "failed") {
    nextStepKey = "review";
    nextStepLabel = "Talep Gozden Gecir / Yeni Talep";
    verifyStateLabel = "REJECTED";
  } else if (!txSeen) {
    nextStepKey = "tx";
    nextStepLabel = "TX Hash Gonder";
    verifyStateLabel = "TX WAIT";
  } else if (latestStatus === "approved") {
    nextStepKey = "settled";
    nextStepLabel = "Settled / Yeni Quote";
    verifyStateLabel = "SETTLED";
  } else if (verifyConfidence < 0.6) {
    nextStepKey = "verify";
    nextStepLabel = "Verify / Quorum Bekle";
    verifyStateLabel = "VERIFY LOW";
  } else {
    nextStepKey = "decision";
    nextStepLabel = "Admin Karar / Auto Policy";
    verifyStateLabel = "VERIFY OK";
  }

  const readinessRatio = clamp(
    (gateOpen ? 0.26 : 0.04) +
      routeCoverage * 0.2 +
      (quoteReady ? 0.12 : 0) +
      (hasRequest ? 0.12 : 0) +
      (txSeen ? 0.12 : 0) +
      verifyConfidence * 0.1 +
      providerRatio * 0.04 +
      (latestStatus === "approved" ? 0.12 : 0),
    0,
    1
  );
  const delayRisk = clamp(
    timeoutRatio * 0.24 +
      staleRatio * 0.16 +
      queuePressure * 0.22 +
      (1 - providerRatio) * 0.14 +
      (1 - routeCoverage) * 0.08 +
      (gateOpen ? 0 : 0.2) +
      riskScore * 0.12 +
      (manualQueueCount > 0 ? Math.min(0.14, manualQueueCount / 40) : 0),
    0,
    1
  );
  const tone =
    nextStepKey === "gate" || latestStatus === "rejected" || delayRisk >= 0.74
      ? "critical"
      : delayRisk >= 0.46 || nextStepKey === "verify" || nextStepKey === "decision"
        ? "pressure"
        : readinessRatio >= 0.72
          ? "advantage"
          : "balanced";
  return {
    nextStepKey,
    nextStepLabel,
    verifyStateLabel,
    readinessRatio,
    riskRatio: delayRisk,
    routeCoverage,
    verifyConfidence,
    providerRatio,
    timeoutRatio,
    staleRatio,
    queuePressure,
    gateOpen,
    manualQueueCount,
    autoDecisionCount,
    pendingPayoutCount,
    tone
  };
}

function computeDecisionTraceMetrics(decisionsInput: any[], manualQueueInput: any[], payoutQueueInput: any[]): DecisionTraceMetrics {
  const decisions = Array.isArray(decisionsInput) ? decisionsInput : [];
  const manualQueue = Array.isArray(manualQueueInput) ? manualQueueInput : [];
  const payoutQueue = Array.isArray(payoutQueueInput) ? payoutQueueInput : [];
  const recent = decisions.slice(0, 20);
  const approveCount = recent.filter((row) => /approve|approved|auto_approved/i.test(asString(row?.decision))).length;
  const rejectCount = recent.filter((row) => /reject|rejected|deny|failed/i.test(asString(row?.decision))).length;
  const fallbackCount = recent.filter((row) => /fallback|skip|manual/i.test(asString(row?.decision))).length;
  const avgRisk =
    recent.length > 0 ? recent.reduce((sum, row) => sum + clamp(asNum(row?.risk_score || 0), 0, 1), 0) / recent.length : 0;
  const reasonBuckets = recent.reduce((acc, row) => {
    const reason = asString(row?.reason).toLowerCase();
    const plus = (k: string) => {
      acc[k] = (acc[k] || 0) + 1;
    };
    if (!reason) plus("none");
    if (/risk/.test(reason)) plus("risk");
    if (/velocity|rate/.test(reason)) plus("velocity");
    if (/verify|quorum|provider|oracle/.test(reason)) plus("verify");
    if (/gate|cap/.test(reason)) plus("gate");
    if (/tx|hash|chain/.test(reason)) plus("tx");
    if (/manual|review/.test(reason)) plus("manual");
    if (!/(risk|velocity|rate|verify|quorum|provider|oracle|gate|cap|tx|hash|chain|manual|review)/.test(reason)) plus("other");
    return acc;
  }, {} as Record<string, number>);
  const reasonEntries = Object.entries(reasonBuckets).sort((a, b) => Number(b[1]) - Number(a[1])) as Array<[string, number]>;
  const topReason = reasonEntries[0]?.[0] || "none";
  const topReasonCount = Number(reasonEntries[0]?.[1] || 0);
  const manualPressure = clamp((manualQueue.length * 0.65 + payoutQueue.length * 0.35) / 18, 0, 1);
  const rejectRatio = recent.length > 0 ? clamp(rejectCount / recent.length, 0, 1) : 0;
  const approveRatio = recent.length > 0 ? clamp(approveCount / recent.length, 0, 1) : 0;
  const decisionFlow = clamp((recent.length / 20) * 0.35 + approveRatio * 0.25 + (1 - rejectRatio) * 0.2 + (1 - manualPressure) * 0.2, 0, 1);
  const riskPressure = clamp(avgRisk * 0.46 + rejectRatio * 0.24 + manualPressure * 0.2 + clamp(topReasonCount / 8, 0, 1) * 0.1, 0, 1);
  const tone =
    recent.length === 0 && manualQueue.length === 0 && payoutQueue.length === 0
      ? "neutral"
      : riskPressure >= 0.72 || manualPressure >= 0.75
        ? "critical"
        : riskPressure >= 0.44 || manualPressure >= 0.42
          ? "pressure"
          : "advantage";
  return {
    sampleCount: recent.length,
    approveCount,
    rejectCount,
    fallbackCount,
    manualQueueCount: manualQueue.length,
    payoutQueueCount: payoutQueue.length,
    avgRisk,
    rejectRatio,
    approveRatio,
    decisionFlow,
    riskPressure,
    topReason,
    topReasonCount,
    manualPressure,
    tone,
    reasonEntries
  };
}

function computeTreasuryRuntimeMetrics(input: any): TreasuryRuntimeMetrics {
  const data = input && typeof input === "object" ? input : {};
  const token = data.token && typeof data.token === "object" ? data.token : {};
  const queues = data.queues && typeof data.queues === "object" ? data.queues : {};
  const routing = data.routing && typeof data.routing === "object" ? data.routing : {};
  const routeChains = Array.isArray(data.routeChains) ? data.routeChains : Array.isArray(routing.chains) ? routing.chains : [];
  const totalRoutes = Math.max(0, asNum(routing.total_routes || routeChains.length));
  const enabledRoutes = Math.max(0, asNum(routing.enabled_routes || routeChains.filter((row: any) => row?.enabled).length));
  const routeCoverage = totalRoutes > 0 ? clamp(enabledRoutes / totalRoutes, 0, 1) : 0;
  const routeMissing = Math.max(0, totalRoutes - enabledRoutes);
  const gate = token.payout_gate && typeof token.payout_gate === "object" ? token.payout_gate : {};
  const gateOpen = gate.allowed === true;
  const apiRows = Array.isArray(queues.external_api_health) ? queues.external_api_health : [];
  const apiTotal = apiRows.length;
  const apiOk = apiRows.filter((row) => row && row.ok === true).length;
  const apiRatio = apiTotal > 0 ? clamp(apiOk / apiTotal, 0, 1) : 0.35;
  const apiLatencyAvg = apiTotal > 0 ? apiRows.reduce((sum, row) => sum + asNum(row?.latency_ms || 0), 0) / apiTotal : 0;
  const manualQueueCount = Array.isArray(queues.token_manual_queue) ? queues.token_manual_queue.length : 0;
  const autoDecisionCount = Array.isArray(queues.token_auto_decisions) ? queues.token_auto_decisions.length : 0;
  const pendingPayoutCount = Array.isArray(queues.payout_queue) ? queues.payout_queue.length : Math.max(0, asNum(data.pendingPayoutCount || 0));
  const queuePressure = clamp(
    (manualQueueCount * 0.45 + pendingPayoutCount * 0.35 + Math.max(0, autoDecisionCount - 8) * 0.2) / 12,
    0,
    1
  );
  const autoPolicy = token.auto_policy && typeof token.auto_policy === "object" ? token.auto_policy : {};
  const autoPolicyEnabled = autoPolicy.enabled === true;
  const tone =
    totalRoutes === 0 || enabledRoutes === 0
      ? "critical"
      : routeMissing > 0 || !gateOpen || apiRatio < 0.5
        ? apiRatio < 0.25 || routeMissing >= 2
          ? "critical"
          : "pressure"
        : queuePressure > 0.7
          ? "pressure"
          : "advantage";
  return {
    totalRoutes,
    enabledRoutes,
    routeCoverage,
    routeMissing,
    gateOpen,
    apiTotal,
    apiOk,
    apiRatio,
    apiLatencyAvg,
    manualQueueCount,
    autoDecisionCount,
    pendingPayoutCount,
    queuePressure,
    autoPolicyEnabled,
    tone
  };
}

function computeSceneAlarmMetrics(input: any): SceneAlarmMetrics {
  const data = input && typeof input === "object" ? input : {};
  const diagnostics = data.diagnostics && typeof data.diagnostics === "object" ? data.diagnostics : {};
  const ladder = data.ladder && typeof data.ladder === "object" ? data.ladder : {};
  const assetRuntime = data.assetRuntime && typeof data.assetRuntime === "object" ? data.assetRuntime : {};
  const assetManifest = data.assetManifest && typeof data.assetManifest === "object" ? data.assetManifest : {};
  const telemetry = data.telemetry && typeof data.telemetry === "object" ? data.telemetry : {};
  const pvp = data.pvp && typeof data.pvp === "object" ? data.pvp : {};
  const nowMs = asNum(data.nowMs || Date.now());

  const queueSize = Math.max(0, Math.floor(asNum(data.queueSize || 0)));
  const windowMs = Math.max(80, asNum(data.windowMs || 800));
  const latencyMs = Math.max(0, asNum(data.latencyMs || diagnostics.latency_ms || telemetry.latencyAvgMs || 0));
  const windowSafety = clamp((windowMs - latencyMs) / Math.max(1, windowMs), 0, 1);
  const driftRatio = clamp(Math.abs(asNum(data.drift || diagnostics.score_drift || 0)) / 6, 0, 1);

  const ladderPressure = clamp(asNum(data.ladderPressure ?? ladder.pressure ?? 0), 0, 1);
  const ladderFreshness = clamp(asNum(data.ladderFreshness ?? ladder.freshnessRatio ?? 0), 0, 1);
  const ladderActivity = clamp(asNum(data.ladderActivity ?? ladder.activityRatio ?? 0), 0, 1);

  const assetReadyRatio = clamp(
    asNum(
      data.assetReadyRatio ??
        assetRuntime.readyRatio ??
        assetManifest.readyRatio ??
        (asNum(telemetry.assetTotalCount || 0) > 0
          ? asNum(telemetry.assetReadyCount || 0) / Math.max(1, asNum(telemetry.assetTotalCount || 0))
          : 1)
    ),
    0,
    1
  );
  const assetSyncRatio = clamp(asNum(data.assetSyncRatio ?? assetRuntime.syncRatio ?? assetManifest.readyRatio ?? 1), 0, 1);
  const assetIntegrityRatio = clamp(
    asNum(data.assetIntegrityRatio ?? assetManifest.integrityRatio ?? assetRuntime.dbReadyRatio ?? assetRuntime.syncRatio ?? assetReadyRatio),
    0,
    1
  );
  const assetMismatch = clamp((1 - assetIntegrityRatio) * 0.46 + (1 - assetSyncRatio) * 0.3 + (1 - assetReadyRatio) * 0.24, 0, 1);

  const rejectInfo = classifyRejectReasonBridge(pvp.lastRejectReason);
  const rejectCategory = asString(rejectInfo.category || "none", "none");
  const lastActionAt = Math.max(0, asNum(pvp.lastActionAt || 0));
  const rejectAgeMs = lastActionAt > 0 ? Math.max(0, nowMs - lastActionAt) : Number.MAX_SAFE_INTEGER;
  const recentReject = Boolean(pvp.lastRejected) && rejectCategory !== "none" && rejectAgeMs < 12000;
  const rejectFreshness = recentReject ? clamp(1 - rejectAgeMs / 12000, 0, 1) : 0;

  const queueRatio = clamp(queueSize / 8, 0, 1);
  const heatRatio = clamp(asNum(data.heatRatio ?? telemetry.combatHeat ?? 0), 0, 1);
  const threatRatio = clamp(asNum(data.threatRatio ?? telemetry.threatRatio ?? 0), 0, 1);
  const rejectSeverityMap: Record<string, number> = {
    none: 0.08,
    duplicate: 0.24,
    stale: 0.32,
    invalid: 0.44,
    session: 0.52,
    sequence: 0.66,
    window: 0.72,
    auth: 0.8,
    unknown: 0.58
  };
  const rejectSeverity = clamp(asNum(rejectSeverityMap[rejectCategory] ?? rejectSeverityMap.unknown), 0, 1);

  const severity = clamp(
    heatRatio * 0.16 +
      threatRatio * 0.18 +
      ladderPressure * 0.19 +
      (1 - ladderFreshness) * 0.08 +
      ladderActivity * 0.08 +
      assetMismatch * 0.21 +
      queueRatio * 0.05 +
      (1 - windowSafety) * 0.08 +
      driftRatio * 0.04 +
      (recentReject ? 0.11 + rejectSeverity * 0.14 + rejectFreshness * 0.06 : rejectSeverity * 0.02),
    0,
    1
  );

  let tone = "advantage";
  if (recentReject && (rejectCategory === "window" || rejectCategory === "sequence" || rejectCategory === "auth")) {
    tone = "critical";
  } else if (severity >= 0.68 || assetMismatch >= 0.55) {
    tone = "critical";
  } else if (severity >= 0.36 || ladderPressure >= 0.56 || assetMismatch >= 0.28) {
    tone = "pressure";
  }

  const sceneAlarmFlash = recentReject ? clamp(0.28 + rejectFreshness * 0.72, 0, 1) : severity > 0.55 ? 0.2 : 0;
  const rejectCodeMap: Record<string, string> = {
    window: "WND",
    sequence: "SEQ",
    duplicate: "DUP",
    stale: "STA",
    auth: "AUTH",
    session: "SES",
    invalid: "INV",
    unknown: "UNK",
    none: "--"
  };
  const alarmBadgeText =
    tone === "critical" ? (recentReject ? "SCENE ALERT" : "SCENE RISK") : tone === "pressure" ? "SCENE WATCH" : "SCENE OK";
  const alarmBadgeTone: "warn" | "default" | "info" = tone === "critical" ? "warn" : tone === "pressure" ? "default" : "info";
  const alarmLineText = recentReject
    ? `Reject ${asString(rejectInfo.label || rejectCategory || "unknown")} | queue ${queueSize} | wnd ${Math.round(windowSafety * 100)}% | asset int ${Math.round(assetIntegrityRatio * 100)}%`
    : `Scene ${tone.toUpperCase()} | ladder ${Math.round(ladderPressure * 100)}% | asset risk ${Math.round(assetMismatch * 100)}% | heat ${Math.round(heatRatio * 100)}%`;
  const alarmHintText = recentReject
    ? asString(rejectInfo.hint || "Reject tespit edildi. Queue drift ve tick penceresini stabilize et, sonra expected aksiyona don.")
    : tone === "critical"
      ? "Asset integrity / ladder pressure / reject birikimi sahneyi stress moduna tasiyor. Window ve queue kontrolu oncelikli."
      : tone === "pressure"
        ? "Scene watch modunda: ladder baskisi ve asset sync durumunu izle, reject cikarsa ritmi kis."
        : "Scene stabil: ladder taze, asset sync saglam, reject baskisi dusuk.";

  return {
    ladderPressure,
    ladderFreshness,
    ladderActivity,
    assetReadyRatio,
    assetSyncRatio,
    assetIntegrityRatio,
    assetMismatch,
    queueSize,
    queueRatio,
    windowSafety,
    driftRatio,
    rejectCategory,
    rejectLabel: rejectInfo.label,
    rejectHint: rejectInfo.hint,
    rejectShort: rejectInfo.shortLabel,
    rejectTone: rejectInfo.tone,
    rejectSeverity,
    recentReject,
    rejectFreshness,
    severity,
    tone,
    sceneAlarmFlash,
    alarmBadgeText,
    alarmBadgeTone,
    alarmLineText,
    alarmHintText,
    rejectCode: asString(rejectCodeMap[rejectCategory] || "UNK")
  };
}

export function installV3StateMutatorBridge(): void {
  window.__AKR_STATE_MUTATORS__ = {
    computeAssetManifestMetrics,
    computePvpLeaderboardState,
    computeSceneEffectiveProfile,
    computeProviderRuntimeMetrics,
    computeTokenRouteRuntimeMetrics,
    computeTokenLifecycleMetrics,
    computeTokenDirectorMetrics,
    computeDecisionTraceMetrics,
    computeTreasuryRuntimeMetrics,
    computeSceneAlarmMetrics
  };
}
