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
      }
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
      assetSyncPct: Math.round(clamp(assetMetrics.integrityRatio) * 100)
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

function buildOperationsDeckPayload(data, taskResult, homeFeed) {
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
    }
  };
}

function buildTokenOverviewPayload(vaultRoot, vaultView) {
  const root = asRecord(vaultRoot);
  const overview = asRecord(root.overview);
  const routeStatus = asRecord(overview.route_status || root.route);
  const chains = asArray(routeStatus.chains);
  const summary = asRecord(vaultView.summary);
  const latest = asRecord(vaultView.latest);
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
function buildAdminRuntimePayload(adminRuntime, adminPanels) {
  const summary = asRecord(adminRuntime?.summary);
  const queue = asArray(adminRuntime?.queue);
  const deploy = asRecord(adminPanels?.deploy_status);
  const bot = asRecord(adminPanels?.runtime_bot);
  const latest = asRecord(bot.latest);
  const featureFlags = asRecord(summary.feature_flags);
  const sourceMode = toText(asRecord(summary.runtime_flags).source_mode || deploy.bundle_mode || "runtime");
  return {
    lineText: `Queue ${queue.length} | Bundle ${toText(deploy.bundle_mode || deploy.webapp_bundle_mode || "unknown")} | Flags ${Object.keys(featureFlags).length}`,
    eventsLineText: `Bot ${toText(latest.state_key || latest.status || "idle")} | Lock ${latest.lock_acquired === true ? "yes" : "no"} | Source ${sourceMode}`
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
    sceneStatus: buildSceneStatusPayload(profileMetrics),
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
    operations: buildOperationsDeckPayload(data, options.taskResult, homeFeed),
    tokenOverview: buildTokenOverviewPayload(vaultRoot, vaultView),
    tokenTreasury: buildTokenTreasuryPayload(mutators, vaultRoot, vaultView)
  };
}

function buildAdminBridgePayloads(options = {}) {
  const mutators = asRecord(options.mutators);
  const adminPanels = asRecord(options.adminPanels);
  return {
    runtime: buildAdminRuntimePayload(options.adminRuntime, adminPanels),
    assetStatus: buildAdminAssetStatusPayload(adminPanels),
    assetRuntime: buildAdminAssetRuntimePayload(mutators, adminPanels),
    auditRuntime: buildAdminAuditPayload(adminPanels)
  };
}

export { buildAssetMetrics, buildPlayerBridgePayloads, buildAdminBridgePayloads };
