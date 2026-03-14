import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function loadModule() {
  const target = pathToFileURL(
    path.join(process.cwd(), "apps", "webapp", "src", "core", "runtime", "sceneBridgePayloads.js")
  ).href;
  return import(target);
}

function createMutators() {
  return {
    computeAssetManifestMetrics() {
      return {
        available: true,
        sourceMode: "cdn",
        manifestRevision: "rev_42",
        manifestHash: "hash_rev_42",
        hashShort: "hash_rev_4",
        totalEntries: 4,
        readyEntries: 3,
        missingEntries: 1,
        missingRatio: 0.25,
        integrityOkEntries: 3,
        integrityBadEntries: 1,
        integrityUnknownEntries: 0,
        integrityRatio: 0.75,
        readyRatio: 0.75,
        tone: "pressure"
      };
    },
    computeSceneEffectiveProfile() {
      return {
        sceneMode: "PRO",
        transportTone: "balanced",
        perfTone: "advantage",
        perfTier: "high",
        fps: 60,
        assetReadyRatio: 0.75,
        assetRuntimeTone: "pressure",
        transport: "socket",
        pressureRatio: 0.22,
        manifestShort: "rev_42",
        manifestRiskRatio: 0.25,
        profileLine: "Profile online",
        liteBadge: {
          shouldShow: false,
          text: "Lite Scene",
          tone: "info",
          mode: "ok",
          title: ""
        },
        ladderActivity: 0.66
      };
    },
    computeSceneAlarmMetrics() {
      return {
        tone: "pressure",
        rejectCategory: "latency",
        recentReject: true,
        severity: 0.41,
        sceneAlarmFlash: 0.2,
        alarmBadgeText: "SCENE WARN",
        alarmBadgeTone: "warn",
        alarmLineText: "Latency elevated",
        alarmHintText: "Retry window open",
        ladderPressure: 0.44,
        assetReadyRatio: 0.75,
        rejectShort: "LAT 42",
        rejectTone: "pressure",
        rejectSeverity: 0.4,
        ladderFreshness: 0.72
      };
    },
    computeSceneIntegrityOverlayMetrics() {
      return {
        active: true,
        tone: "balanced",
        integritySweep: 0.58,
        integrityFlash: 0.12,
        integrityBadgeText: "SCENE STABLE",
        integrityBadgeTone: "info",
        integrityLineText: "Manifest synced",
        severity: 0.18,
        readyRatio: 0.75,
        integrityRatio: 0.75,
        syncRatio: 0.8,
        rejectChipText: "REJ LOW",
        rejectChipTone: "neutral",
        rejectChipLevel: 0.15
      };
    },
    computeTokenRouteRuntimeMetrics() {
      return {
        tone: "balanced",
        enabledRoutes: 2,
        totalRoutes: 3,
        providerCount: 3,
        okProviderCount: 2,
        gateOpen: true,
        routeCoverage: 0.67,
        quorumRatio: 0.74,
        quorumDecision: "agree",
        agreementRatio: 0.74
      };
    },
    computeTokenLifecycleMetrics() {
      return {
        tone: "balanced",
        verifyConfidence: 0.81,
        providerRatio: 0.67
      };
    },
    computeTreasuryRuntimeMetrics() {
      return {
        tone: "balanced",
        gateOpen: true,
        enabledRoutes: 2,
        totalRoutes: 3,
        apiOk: 2,
        apiTotal: 3,
        apiRatio: 0.67,
        routeCoverage: 0.67,
        autoPolicyEnabled: true,
        manualQueueCount: 1,
        autoDecisionCount: 2,
        pendingPayoutCount: 1,
        queuePressure: 0.33
      };
    },
    computeTokenDirectorMetrics() {
      return {
        tone: "balanced",
        readinessRatio: 0.72,
        riskRatio: 0.28,
        nextStepLabel: "Submit Tx",
        nextStepKey: "submit",
        verifyStateLabel: "VERIFY",
        manualQueueCount: 1,
        autoDecisionCount: 2,
        pendingPayoutCount: 1,
        queuePressure: 0.33
      };
    }
  };
}

test("buildPlayerBridgePayloads produces live player bridge payloads from real shell state", async () => {
  const mod = await loadModule();
  const payloads = mod.buildPlayerBridgePayloads({
    mutators: createMutators(),
    data: {
      asset_manifest: {
        available: true,
        active_revision: { manifest_revision: "rev_42", source: "cdn" },
        entries: [
          { asset_key: "hub.glb", exists_local: true, integrity_status: "ok" },
          { asset_key: "pvp.glb", exists_local: true, integrity_status: "ok" },
          { asset_key: "vault.glb", exists_local: false, integrity_status: "missing" }
        ],
        summary: { total_assets: 4, ready_assets: 3, missing_assets: 1, integrity_ratio: 0.75 }
      },
      local_manifest: {
        webapp_domain_summary: {
          host: "webapp.k99-exchange.xyz",
          state_key: "ready",
          dns_ready: true,
          contract_ready: true,
          runtime_guard_matches_host: true,
          webapp_status_code: 200
        }
      },
      offers: [
        {
          id: 11,
          task_type: "raid",
          difficulty: 72,
          expires_at: "2099-03-10T12:00:00.000Z",
          reward_preview: "SC +18 | RC +4"
        }
      ],
      missions: {
        list: [{ mission_key: "mission_alpha", title: "Mission Alpha", completed: true, can_claim: true }]
      },
      attempts: {
        active: { task_type: "raid" },
        revealable: { task_type: "forge" }
      },
      events: [{ event_type: "event_countdown", event_at: "2099-03-10T13:00:00.000Z", meta: { status: "live" } }]
    },
    homeFeed: {
      profile: { public_name: "Kral", kingdom_tier: 3, current_streak: 6 },
      season: { season_id: 12, days_left: 4, points: 188 },
      daily: { tasks_done: 3, daily_cap: 5, sc_earned: 18, rc_earned: 4, hc_earned: 1 },
      risk: { status: "watch" },
      mission: { total: 1, ready: 1, open: 1 },
      contract: {
        offers_total: 1,
        active_attempt: { task_type: "raid" },
        revealable_attempt: { task_type: "forge" }
      },
      wallet_quick: {
        active: true,
        chain: "TON",
        address_masked: "UQ...999",
        kyc_status: "approved"
      },
      monetization_quick: {
        enabled: true,
        premium_active: true,
        active_pass_count: 2,
        spend_summary: { SC: 84, RC: 12, HC: 3 }
      }
    },
    taskResult: { accepted_offer_id: 11 },
    pvpRuntime: {
      session_ref: "sess_1",
      status: "active",
      transport: "socket",
      tick_ms: 48,
      action_window_ms: 900,
      ttl_sec_left: 22,
      action_count: { self: 3, opponent: 2 },
      state: {
        shadow_last_action: "guard",
        shadow_last_accept: false,
        last_reject_reason: "timeout"
      }
    },
    leagueOverview: {
      daily_duel: { status: "active", wins: 3, losses: 1, progress_pct: 75, win_rate_pct: 75 },
      weekly_ladder: { rank: 8, points: 1840, tier: "platinum", promotion_zone: true },
      season_arc_boss: { phase: "live", stage: "hydra", hp_pct: 38, attempts: 4 },
      session_snapshot: { rating: 1442, rank: 18, games_played: 29, wins: 17, losses: 12, last_result: "win" },
      last_session_trend: [{ session_ref: "prev_1", result: "win", rating_delta: 12, score_self: 18, score_opponent: 14 }],
      leaderboard_snippet: [
        { rank: 1, user_id: 101, public_name: "alpha", rating: 1280, last_match_at: "2099-03-10T12:00:00.000Z" },
        { rank: 2, user_id: 102, public_name: "beta", rating: 1190, last_match_at: "2099-03-10T11:59:00.000Z" }
      ]
    },
    pvpLive: {
      leaderboard: {
        transport: "socket",
        leaderboard: [
          { rank: 1, public_name: "alpha", rating: 1280, last_match_at: "2099-03-10T12:00:00.000Z" },
          { rank: 2, public_name: "beta", rating: 1190, last_match_at: "2099-03-10T11:59:00.000Z" }
        ]
      },
      diagnostics: {
        diagnostics: { p95_latency_ms: 145, median_latency_ms: 92 },
        accept_rate: 0.82,
        reject_mix: [{ reason_code: "timeout", hit_count: 2 }]
      },
      tick: {
        tick: {
          tick_ms: 48,
          tick_seq: 27,
          state_json: {
            shadow: { input_action: "charge", accepted: true, score_delta: 4 }
          }
        },
        transport: "socket",
        shadow: { input_action: "charge", accepted: true, score_delta: 4 }
      }
    },
    vaultData: {
      overview: {
        token_summary: { symbol: "NXT", chain: "TON", balance: 420, price_usd: 0.0321 },
        route_status: {
          chains: [
            { chain: "TON", enabled: true, pay_currency: "TON" },
            { chain: "BTC", enabled: true, pay_currency: "BTC" },
            { chain: "SOL", enabled: false, pay_currency: "SOL" }
          ]
        },
        payout_status: { can_request: true, requestable_btc: 0.00123, unlock_tier: "T2" },
        wallet_session: { active: true, chain: "TON", address_masked: "UQ...999", kyc_status: "approved" },
        monetization_status: {
          enabled: true,
          player_effects: { premium_active: true },
          active_pass_count: 1,
          spend_summary: { SC: 21, RC: 8, HC: 1 },
          cosmetics: { owned_count: 4 }
        }
      },
      monetization: {
        status: {
          enabled: true,
          active_passes: [{ pass_key: "pass_alpha" }],
          cosmetics: { owned_count: 4 },
          spend_summary: { SC: 21, RC: 8, HC: 1 }
        },
        active_effects: { premium_active: true }
      },
      quote: { rate: 31.2, quote_quorum: { provider_count: 3, ok_provider_count: 2, agreement_ratio: 0.74 } },
      buy: { request_id: 77, status: "intent_created" },
      submit: { status: "submitted", tx_hash: "0xabc" }
    },
    scene: {
      hudDensity: "normal",
      capabilityProfile: { perf_tier: "high", fps_avg: 60 },
      selectedLoop: {
        districtKey: "arena_prime",
        protocolCardKey: "arena_protocol",
        protocolPodKey: "duel_pod",
        microflowKey: "duel_flow",
        activeAssetKey: "arena_trophy",
        activeAssetFamilyKey: "duel",
        activeAssetAnchorKind: "cluster",
        activeAssetCandidateKey: "arena_khronos_cesium_man",
        activeAssetStateKey: "ready",
        activeAssetContractReady: true,
        activeAssetContractSignature: "arena_prime:duel:arena_trophy|ready|arena_khronos_cesium_man",
        readyAssetCount: 4,
        selectedAssetCount: 4,
        loadedAssetCount: 4,
        entryKindKey: "world_entry_kind_duel_console",
        sequenceKindKey: "world_modal_kind_duel_sequence",
        personalityKey: "assault",
        personalityLabelKey: "world_personality_assault",
        personalityCaptionKey: "world_personality_caption_assault",
        densityLabelKey: "world_hud_density_expanded",
        loopStatusKey: "active",
        loopStatusLabelKey: "loop_status_active",
        loopStageValue: "engage",
        loopRows: [
          { label_key: "world_sheet_metric_queue_depth", value: "3", status_key: "live" },
          { label_key: "world_sheet_metric_risk_band", value: "WATCH", status_key: "watch" }
        ],
        loopSignalRows: [{ label_key: "world_sheet_metric_diag_band", value: "HOT", status_key: "watch" }],
        sequenceRows: [{ label_key: "world_sheet_metric_duel_phase", value: "ENGAGE", status_key: "live" }]
      }
    },
    sceneRuntime: {
      lowEndMode: false,
      effectiveQuality: "high"
    }
  });

  assert.equal(payloads.sceneStatus.profileLine, "Profile online");
  assert.match(payloads.sceneStatus.loopLine, /ARENA PRIME/);
  assert.equal(payloads.sceneStatus.focusKey, "arena_prime:duel:duel_flow");
  assert.equal(payloads.sceneStatus.riskKey, "no_data:no_data:no_data");
  assert.equal(payloads.sceneStatus.riskFocusKey, "arena_prime:duel:duel_flow|no_data:no_data:no_data");
  assert.equal(payloads.sceneStatus.familyKey, "duel");
  assert.equal(payloads.sceneStatus.flowKey, "duel:duel_flow");
  assert.equal(payloads.sceneStatus.microflowKey, "duel_flow");
  assert.equal(payloads.sceneStatus.assetKey, "arena_trophy");
  assert.equal(payloads.sceneStatus.assetFamilyKey, "duel");
  assert.equal(payloads.sceneStatus.assetAnchorKind, "cluster");
  assert.equal(payloads.sceneStatus.assetCandidateKey, "arena_khronos_cesium_man");
  assert.equal(payloads.sceneStatus.assetStateKey, "ready");
  assert.equal(payloads.sceneStatus.assetContractReady, true);
  assert.equal(payloads.sceneStatus.assetContractSignature, "arena_prime:duel:arena_trophy|ready|arena_khronos_cesium_man");
  assert.equal(payloads.sceneStatus.readyAssetCount, 4);
  assert.equal(payloads.sceneStatus.selectedAssetCount, 4);
  assert.equal(payloads.sceneStatus.loadedAssetCount, 4);
  assert.equal(payloads.sceneStatus.domainLine, "DOMAIN webapp.k99-exchange.xyz | READY | WEBAPP 200 | GUARD MATCH");
  assert.equal(payloads.sceneStatus.domainStateKey, "ready");
  assert.equal(payloads.sceneStatus.domainHost, "webapp.k99-exchange.xyz");
  assert.equal(payloads.sceneStatus.runtimeGuardMatchesHost, true);
  assert.equal(payloads.sceneStatus.assetLine, "ASSET 4/4 | duel:arena_trophy | ready | cluster");
  assert.equal(payloads.sceneStatus.entryKindKey, "world_entry_kind_duel_console");
  assert.equal(payloads.sceneStatus.sequenceKindKey, "world_modal_kind_duel_sequence");
  assert.equal(payloads.sceneStatus.riskHealthBandKey, "no_data");
  assert.equal(payloads.sceneStatus.riskAttentionBandKey, "no_data");
  assert.equal(payloads.sceneStatus.riskTrendDirectionKey, "no_data");
  assert.equal(
    payloads.sceneStatus.actionContextSignature,
    "duel:duel_flow|arena_prime:duel:duel_flow|world_entry_kind_duel_console|world_modal_kind_duel_sequence"
  );
  assert.equal(
    payloads.sceneStatus.riskContextSignature,
    "duel:duel_flow|arena_prime:duel:duel_flow|no_data:no_data:no_data|world_entry_kind_duel_console|world_modal_kind_duel_sequence"
  );
  assert.deepEqual(payloads.sceneStatus.actionContext, {
    family_key: "duel",
    flow_key: "duel:duel_flow",
    microflow_key: "duel_flow",
    focus_key: "arena_prime:duel:duel_flow",
    risk_key: "no_data:no_data:no_data",
    risk_focus_key: "arena_prime:duel:duel_flow|no_data:no_data:no_data",
    risk_health_band_key: "no_data",
    risk_attention_band_key: "no_data",
    risk_trend_direction_key: "no_data",
    asset_key: "arena_trophy",
    asset_family_key: "duel",
    asset_bundle_kind: "selected",
    asset_variant_key: "",
    asset_variant_role: "primary",
    asset_variant_tier: "primary",
    asset_state_key: "ready",
    asset_contract_ready: true,
    asset_contract_signature: "arena_prime:duel:arena_trophy|ready|arena_khronos_cesium_man",
    asset_focus_key: "duel:arena_trophy",
    entry_kind_key: "world_entry_kind_duel_console",
    sequence_kind_key: "world_modal_kind_duel_sequence",
    action_context_signature:
      "duel:duel_flow|arena_prime:duel:duel_flow|world_entry_kind_duel_console|world_modal_kind_duel_sequence",
    contract_state_key: "ready",
    contract_ready: true,
    contract_missing_keys: []
  });
  assert.deepEqual(payloads.sceneStatus.loopContext, {
    family_key: "duel",
    flow_key: "duel:duel_flow",
    microflow_key: "duel_flow",
    focus_key: "arena_prime:duel:duel_flow",
    risk_key: "no_data:no_data:no_data",
    risk_focus_key: "arena_prime:duel:duel_flow|no_data:no_data:no_data",
    risk_health_band_key: "no_data",
    risk_attention_band_key: "no_data",
    risk_trend_direction_key: "no_data",
    asset_key: "arena_trophy",
    asset_family_key: "duel",
    asset_bundle_kind: "selected",
    asset_variant_key: "",
    asset_variant_role: "primary",
    asset_variant_tier: "primary",
    asset_state_key: "ready",
    asset_contract_ready: true,
    asset_contract_signature: "arena_prime:duel:arena_trophy|ready|arena_khronos_cesium_man",
    asset_focus_key: "duel:arena_trophy",
    entry_kind_key: "world_entry_kind_duel_console",
    sequence_kind_key: "world_modal_kind_duel_sequence",
    action_context_signature:
      "duel:duel_flow|arena_prime:duel:duel_flow|world_entry_kind_duel_console|world_modal_kind_duel_sequence",
    risk_context_signature:
      "duel:duel_flow|arena_prime:duel:duel_flow|no_data:no_data:no_data|world_entry_kind_duel_console|world_modal_kind_duel_sequence",
    contract_state_key: "ready",
    contract_ready: true,
    contract_missing_keys: []
  });
  assert.equal(payloads.sceneTelemetry.alarm.badgeText, "SCENE WARN");
  assert.equal(payloads.publicTelemetry.assetManifest.badgeText, "ASSET 3/4");
  assert.equal(payloads.publicTelemetry.assetManifest.selectionLineText, "ACTIVE duel:arena_trophy | 4/4 | ready | cluster");
  assert.equal(payloads.publicTelemetry.assetManifest.assetStateKey, "ready");
  assert.equal(payloads.publicTelemetry.assetManifest.assetContractReady, true);
  assert.equal(
    payloads.publicTelemetry.assetManifest.assetContractSignature,
    "arena_prime:duel:arena_trophy|ready|arena_khronos_cesium_man"
  );
  assert.equal(payloads.publicTelemetry.assetManifest.readyAssetCount, 4);
  assert.equal(payloads.publicTelemetry.assetManifest.selectedAssetCount, 4);
  assert.equal(
    payloads.publicTelemetry.assetManifest.domainLineText,
    "DOMAIN webapp.k99-exchange.xyz | READY | WEBAPP 200 | GUARD MATCH"
  );
  assert.equal(payloads.publicTelemetry.assetManifest.domainStateKey, "ready");
  assert.equal(payloads.publicTelemetry.assetManifest.domainHost, "webapp.k99-exchange.xyz");
  assert.equal(payloads.publicTelemetry.assetManifest.runtimeGuardMatchesHost, true);
  assert.equal(payloads.publicTelemetry.assetManifest.chips.host.text, "HOST READY");
  assert.equal(payloads.publicTelemetry.pvpLeaderboard.badgeText, "TOP 2");
  assert.equal(payloads.pvpDirector.cinematic.phaseBadgeText, "ACTIVE");
  assert.match(payloads.pvpDirector.loopLineText, /ARENA LOOP/);
  assert.match(payloads.pvpDirector.loopHintText, /DUEL CONSOLE/);
  assert.equal(payloads.pvpRejectIntel.badge.text, "REJ TIMEOUT");
  assert.equal(payloads.pvpEvents.timelineRows.length, 6);
  assert.equal(payloads.pvpDuel.tick.live, true);
  assert.equal(payloads.combatHud.timelineBadgeText, "ACTIVE");
  assert.equal(payloads.combatHud.chainTrail.length, 3);
  assert.match(payloads.combatHud.loopLineText, /ARENA LOOP/);
  assert.match(payloads.combatHud.loopLineText, /PERSONALITY ASSAULT|WORLD PERSONALITY ASSAULT/i);
  assert.match(payloads.combatHud.loopOpsLineText, /ACTIVE|ENGAGE|DUEL/);
  assert.match(payloads.combatHud.loopFocusText, /ARENA PRIME|DUEL|ENTRY|PERSONALITY ASSAULT/i);
  assert.match(payloads.combatHud.loopSequenceText, /DUEL PHASE ENGAGE/i);
  assert.match(payloads.combatHud.loopStateText, /ACTIVE|ENGAGE|DUEL/i);
  assert.match(payloads.combatHud.loopDuelFocusText, /KEY arena_prime:duel:duel_flow/i);
  assert.equal(payloads.combatHud.loopDuelCards?.length, 3);
  assert.equal(payloads.combatHud.loopDuelCards?.[0]?.title, "PHASE");
  assert.match(payloads.combatHud.loopDuelCards?.[0]?.value || "", /ENGAGE|ACTIVE/i);
  assert.equal(payloads.combatHud.loopDuelFlowCards?.length, 3);
  assert.equal(payloads.combatHud.loopDuelFlowCards?.[0]?.title, "STANCE");
  assert.match(payloads.combatHud.loopDuelFlowCards?.[0]?.value || "", /DUEL CONSOLE|DUEL FLOW/i);
  assert.match(payloads.combatHud.loopDuelFlowCards?.[0]?.hint || "", /FOCUS arena_prime:duel:duel_flow/i);
  assert.equal(payloads.combatHud.loopDuelFlowCards?.[0]?.focus_key, "arena_prime:duel:duel_flow");
  assert.equal(payloads.combatHud.loopDuelFlowCards?.[0]?.contract_ready, true);
  assert.equal(payloads.combatHud.loopDuelFlowCards?.[0]?.contract_state_key, "ready");
  assert.deepEqual(payloads.combatHud.loopDuelFlowCards?.[0]?.contract_missing_keys, []);
  assert.equal(payloads.combatHud.loopDuelFlowCards?.[0]?.flow_key, "duel:duel_flow");
  assert.equal(payloads.combatHud.loopDuelFlowCards?.[0]?.entry_kind_key, "world_entry_kind_duel_console");
  assert.equal(payloads.combatHud.loopDuelFlowCards?.[0]?.sequence_kind_key, "world_modal_kind_duel_sequence");
  assert.equal(payloads.combatHud.loopDuelFlowCards?.[0]?.risk_health_band_key, "yellow");
  assert.equal(payloads.combatHud.loopDuelFlowCards?.[0]?.risk_attention_band_key, "watch");
  assert.equal(payloads.combatHud.loopDuelFlowCards?.[0]?.risk_trend_direction_key, "no_data");
  assert.match(payloads.combatHud.loopDuelFlowCards?.[0]?.risk_key || "", /^[a-z_]+:[a-z_]+:[a-z_]+$/i);
  assert.match(
    payloads.combatHud.loopDuelFlowCards?.[0]?.risk_focus_key || "",
    /^arena_prime:duel:duel_flow\|[a-z_]+:[a-z_]+:[a-z_]+$/i
  );
  assert.equal(payloads.combatHud.loopDuelFlowCards?.[0]?.risk_context?.flow_key, "duel:duel_flow");
  assert.equal(payloads.combatHud.loopDuelFlowCards?.[0]?.risk_context?.focus_key, "arena_prime:duel:duel_flow");
  assert.equal(payloads.combatHud.loopDuelFlowCards?.[0]?.risk_context?.risk_health_band_key, "yellow");
  assert.equal(payloads.combatHud.loopDuelFlowCards?.[0]?.risk_context?.risk_attention_band_key, "watch");
  assert.equal(payloads.combatHud.loopDuelFlowCards?.[0]?.risk_context?.entry_kind_key, "world_entry_kind_duel_console");
  assert.equal(
    payloads.combatHud.loopDuelFlowCards?.[0]?.risk_context?.sequence_kind_key,
    "world_modal_kind_duel_sequence"
  );
  assert.equal(
    payloads.combatHud.loopDuelFlowCards?.[0]?.action_context_signature,
    "duel:duel_flow|arena_prime:duel:duel_flow|world_entry_kind_duel_console|world_modal_kind_duel_sequence"
  );
  assert.equal(
    payloads.combatHud.loopDuelFlowCards?.[0]?.action_context?.action_context_signature,
    "duel:duel_flow|arena_prime:duel:duel_flow|world_entry_kind_duel_console|world_modal_kind_duel_sequence"
  );
  assert.equal(
    payloads.combatHud.loopDuelFlowCards?.[0]?.risk_context_signature,
    "duel:duel_flow|arena_prime:duel:duel_flow|yellow:watch:no_data|world_entry_kind_duel_console|world_modal_kind_duel_sequence"
  );
  assert.equal(
    payloads.combatHud.loopDuelFlowCards?.[0]?.risk_context?.risk_context_signature,
    "duel:duel_flow|arena_prime:duel:duel_flow|yellow:watch:no_data|world_entry_kind_duel_console|world_modal_kind_duel_sequence"
  );
  assert.equal(payloads.combatHud.loopDuelFlowCards?.[2]?.title, "RISK");
  assert.equal(payloads.combatHud.loopDuelFlowBlocks?.length, 3);
  assert.equal(payloads.combatHud.loopDuelFlowBlocks?.[2]?.title, "RISK");
  assert.equal(payloads.combatHud.loopDuelFlowBlocks?.[0]?.contract_ready, true);
  assert.equal(payloads.combatHud.loopDuelFlowBlocks?.[0]?.contract_state_key, "ready");
  assert.deepEqual(payloads.combatHud.loopDuelFlowBlocks?.[0]?.contract_missing_keys, []);
  assert.equal(payloads.combatHud.loopDuelFlowBlocks?.[0]?.focus_key, "arena_prime:duel:duel_flow");
  assert.equal(payloads.combatHud.loopDuelFlowPanels?.length, 3);
  assert.equal(payloads.combatHud.loopDuelFlowPanels?.[0]?.title, "STANCE");
  assert.equal(payloads.combatHud.loopDuelFlowPanels?.[1]?.title, "STATUS");
  assert.equal(payloads.combatHud.loopDuelFlowPanels?.[2]?.title, "RESOLVE");
  assert.equal(payloads.combatHud.loopDuelFlowPanels?.[0]?.contract_ready, true);
  assert.equal(payloads.combatHud.loopDuelFlowPanels?.[0]?.contract_state_key, "ready");
  assert.deepEqual(payloads.combatHud.loopDuelFlowPanels?.[0]?.contract_missing_keys, []);
  assert.equal(payloads.combatHud.loopDuelFlowPanels?.[2]?.focus_key, "arena_prime:duel:duel_flow");
  assert.equal(payloads.combatHud.loopDuelRiskCards?.length, 4);
  assert.equal(payloads.combatHud.loopDuelRiskCards?.[0]?.title, "HEALTH");
  assert.equal(payloads.combatHud.loopDuelRiskCards?.[0]?.contract_ready, true);
  assert.equal(payloads.combatHud.loopDuelRiskCards?.[0]?.contract_state_key, "ready");
  assert.deepEqual(payloads.combatHud.loopDuelRiskCards?.[0]?.contract_missing_keys, []);
  assert.equal(payloads.combatHud.loopDuelRiskCards?.[1]?.title, "ATTN");
  assert.equal(payloads.combatHud.loopDuelRiskCards?.[2]?.title, "TREND");
  assert.equal(payloads.combatHud.loopDuelRiskCards?.[3]?.title, "MICRO");
  assert.equal(payloads.combatHud.loopDuelRiskBlocks?.length, 3);
  assert.equal(payloads.combatHud.loopDuelRiskBlocks?.[0]?.title, "HEALTH");
  assert.equal(payloads.combatHud.loopDuelRiskBlocks?.[1]?.title, "ATTN");
  assert.equal(payloads.combatHud.loopDuelRiskBlocks?.[2]?.title, "TREND");
  assert.equal(payloads.combatHud.loopDuelRiskPanels?.length, 3);
  assert.equal(payloads.combatHud.loopDuelRiskPanels?.[0]?.title, "HEALTH");
  assert.equal(payloads.combatHud.loopDuelRiskPanels?.[1]?.title, "ATTN");
  assert.equal(payloads.combatHud.loopDuelRiskPanels?.[2]?.title, "TREND");
  assert.match(payloads.combatHud.loopDuelRiskPanels?.[0]?.lines?.[0] || "", /WATCH|ACTIVE|HEALTH/i);
  assert.match(payloads.combatHud.loopDuelRiskPanels?.[2]?.lines?.[3] || "", /MICRO DUEL FLOW \| POD DUEL POD/i);
  assert.match(payloads.combatHud.loopDuelRiskPanels?.[2]?.lines?.[4] || "", /HB [A-Z_]+ \| ATTN [A-Z_]+ \| TREND [A-Z_]+/i);
  assert.match(payloads.combatHud.loopDuelRiskPanels?.[2]?.lines?.[4] || "", /HEALTH .*ATTN .*TREND /i);
  assert.match(payloads.combatHud.loopDuelRiskPanels?.[2]?.lines?.[5] || "", /^RISK [a-z_]+:[a-z_]+:[a-z_]+$/i);
  assert.match(
    payloads.combatHud.loopDuelRiskPanels?.[2]?.lines?.[6] || "",
    /^RFK arena_prime:duel:duel_flow\|[a-z_]+:[a-z_]+:[a-z_]+$/i
  );
  assert.match(
    payloads.combatHud.loopDuelRiskCards?.[3]?.hint || "",
    /FOCUS arena_prime:duel:duel_flow \| RISK [a-z_]+:[a-z_]+:[a-z_]+/i
  );
  assert.match(
    payloads.combatHud.loopDuelRiskBlocks?.[2]?.hint || "",
    /FOCUS arena_prime:duel:duel_flow \| RISK [a-z_]+:[a-z_]+:[a-z_]+/i
  );
  assert.match(payloads.combatHud.loopDuelRiskPanels?.[2]?.lines?.[7] || "", /FAMILY duel/i);
  assert.match(payloads.combatHud.loopDuelRiskPanels?.[2]?.lines?.[7] || "", /MICRO duel_flow/i);
  assert.match(payloads.combatHud.loopDuelRiskPanels?.[2]?.lines?.[7] || "", /FLOW duel:duel_flow/i);
  assert.match(payloads.combatHud.loopDuelRiskPanels?.[2]?.lines?.[7] || "", /ENTRY world_entry_kind_duel_console/i);
  assert.match(payloads.combatHud.loopDuelRiskPanels?.[2]?.lines?.[7] || "", /SEQ world_modal_kind_duel_sequence/i);
  assert.match(payloads.combatHud.loopDuelFlowPanels?.[1]?.lines?.[1] || "", /HEALTH|ENTRY|FLOW/i);
  assert.match(payloads.combatHud.loopDuelFlowPanels?.[2]?.lines?.[1] || "", /ATTN|ENGAGE|WATCH|FLOW/i);
  assert.match(payloads.combatHud.loopDuelFlowPanels?.[2]?.lines?.[2] || "", /TREND|SEQ|FLOW|HEALTH/i);
  assert.match(payloads.combatHud.loopDuelFlowPanels?.[2]?.lines?.[3] || "", /HEALTH .*ATTN .*TREND /i);
  assert.match(
    payloads.combatHud.loopDuelFlowPanels?.[2]?.lines?.[5] || "",
    /^RFK arena_prime:duel:duel_flow\|[a-z_]+:[a-z_]+:[a-z_]+$/i
  );
  assert.match(
    payloads.combatHud.loopDuelFlowPanels?.[2]?.lines?.[6] || "",
    /^FAMILY duel \| MICRO duel_flow \| FLOW duel:duel_flow \| ENTRY world_entry_kind_duel_console \| SEQ world_modal_kind_duel_sequence(?: \| ASSET .+)?$/i
  );
  assert.match(
    payloads.combatHud.loopDuelFlowPanels?.[2]?.lines?.[7] || "",
    /^ACS duel:duel_flow\|arena_prime:duel:duel_flow\|world_entry_kind_duel_console\|world_modal_kind_duel_sequence \| RCS duel:duel_flow\|arena_prime:duel:duel_flow\|[a-z_]+:[a-z_]+:[a-z_]+\|world_entry_kind_duel_console\|world_modal_kind_duel_sequence(?: \| ASIG .+)?$/i
  );
  assert.equal(payloads.combatHud.loopDuelSubflowCards?.length, 3);
  assert.equal(payloads.combatHud.loopDuelSubflowCards?.[0]?.title, "STANCE");
  assert.match(payloads.combatHud.loopDuelSubflowCards?.[0]?.hint || "", /FOCUS arena_prime:duel:duel_flow/i);
  assert.match(
    payloads.combatHud.loopDuelSubflowCards?.[2]?.hint || "",
    /RFK arena_prime:duel:duel_flow\|[a-z_]+:[a-z_]+:[a-z_]+/i
  );
  assert.equal(payloads.combatHud.loopDuelSubflowBlocks?.length, 3);
  assert.equal(payloads.combatHud.loopDuelSubflowBlocks?.[0]?.title, "STANCE");
  assert.match(
    payloads.combatHud.loopDuelSubflowBlocks?.[2]?.hint || "",
    /RFK arena_prime:duel:duel_flow\|[a-z_]+:[a-z_]+:[a-z_]+/i
  );
  assert.equal(payloads.combatHud.loopDuelSubflowPanels?.length, 3);
  assert.equal(payloads.combatHud.loopDuelSubflowPanels?.[0]?.title, "STANCE");
  assert.equal(payloads.combatHud.loopDuelSubflowPanels?.[1]?.title, "STATUS");
  assert.equal(payloads.combatHud.loopDuelSubflowPanels?.[2]?.title, "RESOLVE");
  assert.match(payloads.combatHud.loopDuelSubflowPanels?.[1]?.lines?.[1] || "", /HEALTH|FLOW|ENTRY/i);
  assert.match(payloads.combatHud.loopDuelSubflowPanels?.[1]?.lines?.[2] || "", /ATTN|ENGAGE|FLOW|HEALTH/i);
  assert.match(payloads.combatHud.loopDuelSubflowPanels?.[2]?.lines?.[2] || "", /TREND|SEQ|FLOW|HEALTH/i);
  assert.match(payloads.combatHud.loopDuelSubflowPanels?.[2]?.lines?.[3] || "", /HEALTH .*ATTN .*TREND /i);
  assert.match(
    payloads.combatHud.loopDuelSubflowPanels?.[2]?.lines?.[5] || "",
    /^RFK arena_prime:duel:duel_flow\|[a-z_]+:[a-z_]+:[a-z_]+$/i
  );
  assert.equal(payloads.combatHud.loopDuelBlocks?.length, 3);
  assert.equal(payloads.combatHud.loopDuelBlocks?.[0]?.title, "FLOW");
  assert.match(payloads.combatHud.loopDuelBlocks?.[0]?.summary || "", /ACTIVE|ENGAGE|FLOW/i);
  assert.match(payloads.combatHud.loopDetailText, /QUEUE DEPTH 3|RISK BAND WATCH/i);
  assert.match(payloads.combatHud.loopSignalText, /DIAG BAND HOT/i);
  assert.match(payloads.combatHud.loopDuelText, /DUEL ENGAGE \| ACTIVE/i);
  assert.match(payloads.combatHud.loopLadderText, /LADDER -- \| --/i);
  assert.match(payloads.combatHud.loopTelemetryText, /TELEMETRY HOT \| WATCH/i);
  assert.equal(payloads.combatHud.loopDuelTone, "pressure");
  assert.equal(payloads.combatHud.loopTelemetryTone, "pressure");
  assert.match(payloads.combatHud.loopDuelFocusText, /ENTRY DUEL CONSOLE \| FOCUS DUEL FLOW \| PERSONA (WORLD )?PERSONALITY ASSAULT/i);
  assert.match(payloads.combatHud.loopDuelStageText, /STAGE ENGAGE \| STATUS ACTIVE \| FLOW DUEL FLOW/i);
  assert.match(payloads.combatHud.loopTelemetryFocusText, /PERSONA (WORLD )?PERSONALITY ASSAULT \| FOCUS HOT \| FLOW DUEL FLOW/i);
  assert.match(payloads.combatHud.loopTelemetryStageText, /STAGE ENGAGE \| STATUS ACTIVE \| SEQ DUEL SEQUENCE/i);
  assert.match(payloads.combatHud.loopDuelStateText, /FLOW DUEL FLOW \| ENTRY DUEL CONSOLE \| PHASE ENGAGE/i);
  assert.match(payloads.combatHud.loopLadderStateText, /FLOW DUEL FLOW \| SEQ DUEL SEQUENCE \| STAGE ENGAGE/i);
  assert.match(
    payloads.combatHud.loopTelemetryStateText,
    /FLOW DUEL FLOW \| PERSONA (WORLD )?PERSONALITY ASSAULT \| SEQ DUEL SEQUENCE/i
  );
  assert.match(payloads.combatHud.loopDuelOpsText, /ENTRY DUEL CONSOLE \| STATUS ACTIVE \| QUEUE 3/i);
  assert.match(payloads.combatHud.loopLadderOpsText, /SEQ DUEL SEQUENCE \| CHARGE -- \| TICK --/i);
  assert.match(payloads.combatHud.loopTelemetryOpsText, /PERSONA (WORLD )?PERSONALITY ASSAULT \| DIAG HOT \| RISK WATCH/i);
  assert.match(payloads.combatHud.loopDuelSignalText, /QUEUE 3 \| FLOW ACTIVE \| RISK WATCH/i);
  assert.match(payloads.combatHud.loopLadderSignalText, /CHARGE -- \| TICK -- \| FLOW DUEL FLOW/i);
  assert.match(payloads.combatHud.loopTelemetrySignalText, /DIAG HOT \| RISK WATCH \| FLOW DUEL FLOW/i);
  assert.match(payloads.combatHud.loopDuelDetailText, /QUEUE 3 \| RISK WATCH \| DUEL CONSOLE/i);
  assert.match(payloads.combatHud.loopDuelFamilyText, /FLOW DUEL FLOW \| STATUS ACTIVE \| STAGE ENGAGE/i);
  assert.match(payloads.combatHud.loopDuelFlowText, /ENTRY DUEL CONSOLE \| SEQ DUEL SEQUENCE \| PERSONA (WORLD )?PERSONALITY ASSAULT/i);
  assert.match(payloads.combatHud.loopDuelSummaryText, /FLOW DUEL FLOW \| STATUS ACTIVE \| PERSONA (WORLD )?PERSONALITY ASSAULT/i);
  assert.match(payloads.combatHud.loopDuelGateText, /QUEUE 3 \| RISK WATCH \| ENTRY DUEL CONSOLE/i);
  assert.match(payloads.combatHud.loopDuelLeadText, /ENTRY DUEL CONSOLE \| FLOW DUEL FLOW \| DUEL SEQUENCE/i);
  assert.match(payloads.combatHud.loopDuelWindowText, /PHASE ENGAGE \| STATUS ACTIVE \| PERSONA (WORLD )?PERSONALITY ASSAULT/i);
  assert.match(payloads.combatHud.loopDuelPressureText, /QUEUE 3 \| RISK WATCH \| DIAG HOT/i);
  assert.match(payloads.combatHud.loopDuelMicroflowText, /MICRO DUEL FLOW \| POD DUEL POD/i);
  assert.equal(payloads.operations.loop.lootMicroflowText, "MICRO WAIT | POD --");
  assert.equal(payloads.tokenOverview.loopWalletMicroflowText, "MICRO WAIT | POD --");
  assert.match(payloads.combatHud.loopDuelResponseText, /PHASE ENGAGE \| FLOW ACTIVE \| ENTRY DUEL CONSOLE/i);
  assert.match(payloads.combatHud.loopDuelAttentionText, /RISK WATCH \| QUEUE 3 \| PHASE ENGAGE/i);
  assert.match(payloads.combatHud.loopDuelCadenceText, /ENTRY DUEL CONSOLE \| FLOW DUEL FLOW \| PERSONA (WORLD )?PERSONALITY ASSAULT/i);
  assert.match(payloads.combatHud.loopLadderFamilyText, /FLOW DUEL FLOW \| STATUS ACTIVE \| CHARGE --/i);
  assert.match(payloads.combatHud.loopLadderFlowText, /SEQ DUEL SEQUENCE \| FLOW DUEL FLOW \| CHARGE --/i);
  assert.match(payloads.combatHud.loopLadderSummaryText, /CHARGE -- \| TICK -- \| FLOW DUEL FLOW/i);
  assert.match(payloads.combatHud.loopLadderGateText, /CHARGE -- \| ENTRY DUEL CONSOLE \| STATUS ACTIVE/i);
  assert.match(payloads.combatHud.loopLadderLeadText, /SEQ DUEL SEQUENCE \| FLOW DUEL FLOW \| TICK --/i);
  assert.match(payloads.combatHud.loopLadderWindowText, /CHARGE -- \| TICK -- \| STATUS ACTIVE/i);
  assert.match(payloads.combatHud.loopLadderPressureText, /CHARGE -- \| TICK -- \| RISK WATCH/i);
  assert.match(payloads.combatHud.loopLadderResponseText, /TICK -- \| FLOW ACTIVE \| SEQ DUEL SEQUENCE/i);
  assert.match(payloads.combatHud.loopLadderAttentionText, /CHARGE -- \| TICK -- \| FLOW DUEL FLOW/i);
  assert.match(payloads.combatHud.loopLadderCadenceText, /SEQ DUEL SEQUENCE \| FLOW DUEL FLOW \| CHARGE --/i);
  assert.equal(payloads.combatHud.loopLadderFlowCards?.length, 3);
  assert.equal(payloads.combatHud.loopLadderFlowBlocks?.length, 3);
  assert.equal(payloads.combatHud.loopLadderFlowPanels?.length, 3);
  assert.equal(payloads.combatHud.loopLadderFlowPanels?.[0]?.title, "RANK");
  assert.equal(payloads.combatHud.loopLadderFlowPanels?.[1]?.title, "STATUS");
  assert.equal(payloads.combatHud.loopLadderFlowPanels?.[2]?.title, "PUSH");
  assert.equal(payloads.combatHud.loopLadderRiskCards?.length, 4);
  assert.equal(payloads.combatHud.loopLadderRiskCards?.[0]?.title, "HEALTH");
  assert.equal(payloads.combatHud.loopLadderRiskCards?.[3]?.title, "MICRO");
  assert.equal(payloads.combatHud.loopLadderRiskBlocks?.length, 3);
  assert.equal(payloads.combatHud.loopLadderRiskBlocks?.[2]?.title, "TREND");
  assert.equal(payloads.combatHud.loopLadderRiskPanels?.length, 3);
  assert.equal(payloads.combatHud.loopLadderRiskPanels?.[1]?.title, "ATTN");
  assert.match(payloads.combatHud.loopLadderRiskPanels?.[2]?.lines?.[3] || "", /MICRO DUEL FLOW \| POD DUEL POD/i);
  assert.match(payloads.combatHud.loopLadderRiskPanels?.[2]?.lines?.[4] || "", /HEALTH .*ATTN .*TREND /i);
  assert.match(payloads.combatHud.loopLadderRiskPanels?.[2]?.lines?.[5] || "", /^RISK [a-z_]+:[a-z_]+:[a-z_]+$/i);
  assert.equal(payloads.combatHud.loopLadderSubflowCards?.length, 3);
  assert.equal(payloads.combatHud.loopLadderSubflowCards?.[0]?.title, "RANK");
  assert.equal(payloads.combatHud.loopLadderSubflowCards?.[0]?.focus_key, "arena_prime:duel:duel_flow");
  assert.equal(payloads.combatHud.loopLadderSubflowCards?.[0]?.flow_key, "duel:duel_flow");
  assert.equal(payloads.combatHud.loopLadderSubflowCards?.[0]?.risk_context?.flow_key, "duel:duel_flow");
  assert.equal(payloads.combatHud.loopLadderSubflowBlocks?.length, 3);
  assert.equal(payloads.combatHud.loopLadderSubflowBlocks?.[0]?.title, "RANK");
  assert.equal(payloads.combatHud.loopLadderSubflowPanels?.length, 3);
  assert.equal(payloads.combatHud.loopLadderSubflowPanels?.[0]?.title, "RANK");
  assert.equal(payloads.combatHud.loopLadderSubflowPanels?.[1]?.title, "STATUS");
  assert.equal(payloads.combatHud.loopLadderSubflowPanels?.[2]?.title, "PUSH");
  assert.match(
    payloads.combatHud.loopLadderSubflowPanels?.[2]?.risk_focus_key || "",
    /^arena_prime:duel:duel_flow\|[a-z_]+:[a-z_]+:[a-z_]+$/i
  );
  assert.match(
    payloads.combatHud.loopLadderSubflowPanels?.[2]?.lines?.[6] || "",
    /^FAMILY duel \| MICRO duel_flow \| FLOW duel:duel_flow \| ENTRY world_entry_kind_duel_console \| SEQ world_modal_kind_duel_sequence(?: \| ASSET .+)?$/i
  );
  assert.match(payloads.combatHud.loopTelemetryFamilyText, /FLOW DUEL FLOW \| STATUS ACTIVE \| DIAG HOT/i);
  assert.match(payloads.combatHud.loopTelemetryFlowText, /PERSONA (WORLD )?PERSONALITY ASSAULT \| SEQ DUEL SEQUENCE \| FLOW DUEL FLOW/i);
  assert.match(payloads.combatHud.loopTelemetrySummaryText, /DIAG HOT \| RISK WATCH \| FLOW DUEL FLOW/i);
  assert.match(payloads.combatHud.loopTelemetryGateText, /DIAG HOT \| ENTRY DUEL CONSOLE \| STATUS ACTIVE/i);
  assert.match(
    payloads.combatHud.loopTelemetryLeadText,
    /PERSONA (WORLD )?PERSONALITY ASSAULT \| FLOW DUEL FLOW \| DIAG HOT/i
  );
  assert.match(payloads.combatHud.loopTelemetryWindowText, /DIAG HOT \| RISK WATCH \| STATUS ACTIVE/i);
  assert.match(payloads.combatHud.loopTelemetryPressureText, /DIAG HOT \| RISK WATCH \| QUEUE 3/i);
  assert.match(
    payloads.combatHud.loopTelemetryResponseText,
    /DIAG HOT \| FLOW ACTIVE \| PERSONA (WORLD )?PERSONALITY ASSAULT/i
  );
  assert.match(payloads.combatHud.loopTelemetryAttentionText, /DIAG HOT \| RISK WATCH \| FLOW DUEL FLOW/i);
  assert.match(
    payloads.combatHud.loopTelemetryCadenceText,
    /PERSONA (WORLD )?PERSONALITY ASSAULT \| FLOW DUEL FLOW \| SEQ DUEL SEQUENCE/i
  );
  assert.equal(payloads.combatHud.loopTelemetryFlowCards?.length, 3);
  assert.equal(payloads.combatHud.loopTelemetryFlowBlocks?.length, 3);
  assert.equal(payloads.combatHud.loopTelemetryFlowPanels?.length, 3);
  assert.equal(payloads.combatHud.loopTelemetryFlowPanels?.[0]?.title, "SCAN");
  assert.equal(payloads.combatHud.loopTelemetryFlowPanels?.[1]?.title, "STATUS");
  assert.equal(payloads.combatHud.loopTelemetryFlowPanels?.[2]?.title, "TRACE");
  assert.equal(payloads.combatHud.loopTelemetryRiskCards?.length, 4);
  assert.equal(payloads.combatHud.loopTelemetryRiskCards?.[0]?.title, "HEALTH");
  assert.equal(payloads.combatHud.loopTelemetryRiskCards?.[3]?.title, "MICRO");
  assert.equal(payloads.combatHud.loopTelemetryRiskBlocks?.length, 3);
  assert.equal(payloads.combatHud.loopTelemetryRiskBlocks?.[1]?.title, "ATTN");
  assert.equal(payloads.combatHud.loopTelemetryRiskPanels?.length, 3);
  assert.equal(payloads.combatHud.loopTelemetryRiskPanels?.[2]?.title, "TREND");
  assert.match(payloads.combatHud.loopTelemetryRiskPanels?.[2]?.lines?.[3] || "", /MICRO DUEL FLOW \| POD DUEL POD/i);
  assert.match(payloads.combatHud.loopTelemetryRiskPanels?.[2]?.lines?.[4] || "", /HEALTH .*ATTN .*TREND /i);
  assert.equal(payloads.combatHud.loopTelemetrySubflowCards?.length, 3);
  assert.equal(payloads.combatHud.loopTelemetrySubflowCards?.[0]?.title, "SCAN");
  assert.equal(payloads.combatHud.loopTelemetrySubflowBlocks?.length, 3);
  assert.equal(payloads.combatHud.loopTelemetrySubflowBlocks?.[0]?.title, "SCAN");
  assert.equal(payloads.combatHud.loopTelemetrySubflowPanels?.length, 3);
  assert.equal(payloads.combatHud.loopTelemetrySubflowPanels?.[0]?.title, "SCAN");
  assert.equal(payloads.combatHud.loopTelemetrySubflowPanels?.[1]?.title, "STATUS");
  assert.equal(payloads.combatHud.loopTelemetrySubflowPanels?.[2]?.title, "TRACE");
  assert.match(payloads.combatHud.loopLadderDetailText, /CHARGE -- \| TICK -- \| DUEL SEQUENCE/i);
  assert.match(payloads.combatHud.loopTelemetryDetailText, /DIAG HOT \| RISK WATCH \| (WORLD )?PERSONALITY ASSAULT/i);
  assert.equal(payloads.cameraDirector.mode.key, "broadcast");
  assert.match(payloads.cameraDirector.focus.text, /ACTIVE/);
  assert.equal(payloads.pvpRoundDirector.heat.phase, "engage");
  assert.equal(payloads.pvpRadar.replay.length, 3);
  assert.equal(payloads.operations.offers.items.length, 1);
  assert.equal(payloads.operations.offers.items[0].rewardPreview, "SC +18 | RC +4");
  assert.match(payloads.operations.attempts.activeText, /Fill 60%/);
  assert.equal(payloads.operations.events.items.at(-1).label, "wallet");
  assert.match(payloads.operations.pulse.lineText, /Streak 6/);
  assert.equal(payloads.operations.pulse.chips[2].text, "SC 18 | RC 4");
  assert.equal(payloads.tokenOverview.symbol, "NXT");
  assert.match(payloads.tokenOverview.summaryText, /TON LIVE/);
  assert.match(payloads.tokenOverview.unitsText, /PASS 1/);
  assert.match(payloads.tokenOverview.loopLineText, /VAULT STANDBY|VAULT LOOP/);
  assert.match(payloads.tokenOverview.loopHintText, /ARENA PRIME|DUEL CONSOLE|Scene loop focus/i);
  assert.match(payloads.tokenOverview.loopFocusText, /ARENA PRIME|DUEL/i);
  assert.match(payloads.tokenOverview.loopOpsLineText, /FOCUS|WAIT|FLOW/i);
  assert.match(payloads.tokenOverview.loopOpsHintText, /DUEL|ENTRY|FLOW|Scene/i);
  assert.match(payloads.tokenOverview.loopSequenceText, /DUEL PHASE ENGAGE/i);
  assert.match(payloads.tokenOverview.loopStateText, /ACTIVE|ENGAGE|DUEL/i);
  assert.match(payloads.tokenOverview.loopDetailText, /QUEUE DEPTH 3|RISK BAND WATCH/i);
  assert.match(payloads.tokenOverview.loopSignalText, /DIAG BAND HOT/i);
  assert.equal(payloads.tokenOverview.loopWalletText, "WALLET | WAIT");
  assert.equal(payloads.tokenOverview.loopPayoutText, "PAYOUT | WAIT");
  assert.equal(payloads.tokenOverview.loopRouteText, "ROUTE | WAIT");
  assert.equal(payloads.tokenOverview.loopPremiumText, "PREMIUM | WAIT");
  assert.equal(payloads.tokenOverview.loopWalletFocusText, "ENTRY WAIT | FOCUS WAIT | FLOW WAIT");
  assert.equal(payloads.tokenOverview.loopPremiumStageText, "STAGE -- | STATUS -- | PASS --");
  assert.equal(payloads.tokenOverview.loopWalletOpsText, "ENTRY WAIT | STATE -- | FLOW WAIT");
  assert.equal(payloads.tokenOverview.loopPayoutOpsText, "SEQ WAIT | PAYOUT -- | ROUTE --");
  assert.equal(payloads.tokenOverview.loopRouteOpsText, "PERSONA WAIT | ROUTE -- | FLOW WAIT");
  assert.equal(payloads.tokenOverview.loopPremiumOpsText, "ENTRY WAIT | PASS -- | STAGE --");
  assert.equal(payloads.tokenOverview.loopWalletDetailText, "Wallet verification detay bekleniyor.");
  assert.equal(payloads.tokenOverview.loopPayoutDetailText, "Payout route detay bekleniyor.");
  assert.equal(payloads.tokenOverview.loopRouteDetailText, "Route quorum detay bekleniyor.");
  assert.equal(payloads.tokenOverview.loopPremiumDetailText, "Premium lane detay bekleniyor.");
  assert.equal(payloads.tokenOverview.statusChips[1].text, "PAY OPEN");
  assert.equal(payloads.tokenTreasury.route.badgeText, "ROUTE 2/3");
  assert.equal(payloads.tokenTreasury.actionDirector.badgeText, "SUBMIT");
  assert.match(payloads.tokenTreasury.pulse.gateLineText, /0.001230 BTC/);
  assert.equal(payloads.tokenTreasury.txLifecycle.rows.at(-1).chip, "PASS");
});

test("buildPlayerBridgePayloads surfaces active vault loop micro panels from selected exchange flow", async () => {
  const mod = await loadModule();
  const payloads = mod.buildPlayerBridgePayloads({
    mutators: createMutators(),
    vaultData: {
      overview: {
        token_summary: { symbol: "NXT", chain: "TON", balance: 320, price_usd: 0.0311 },
        route_status: { status: "live", chains: [{ chain: "TON", enabled: true, pay_currency: "TON" }] },
        payout_status: { can_request: true, requestable_btc: 0.00088, unlock_tier: "T2" },
        wallet_session: { active: true, chain: "TON", address_masked: "UQ...222", kyc_status: "approved" },
        monetization_status: {
          enabled: true,
          player_effects: { premium_active: true },
          active_pass_count: 1,
          spend_summary: { SC: 14, RC: 6, HC: 1 }
        }
      },
      monetization: {
        status: {
          enabled: true,
          active_passes: [{ pass_key: "pass_alpha" }],
          cosmetics: { owned_count: 2 },
          spend_summary: { SC: 14, RC: 6, HC: 1 }
        },
        active_effects: { premium_active: true }
      }
    },
    scene: {
      selectedLoop: {
        districtKey: "exchange_district",
        protocolCardKey: "vault_protocol",
        protocolPodKey: "payout_pod",
        microflowKey: "payout_flow",
        entryKindKey: "world_entry_kind_payout_terminal",
        sequenceKindKey: "world_modal_kind_payout_route",
        personalityKey: "steady",
        personalityLabelKey: "steady",
        personalityCaptionKey: "stable_route",
        densityLabelKey: "world_hud_density_compact",
        loopStatusKey: "live",
        loopStatusLabelKey: "loop_status_live",
        loopStageValue: "submit",
        loopRows: [
          { label_key: "world_sheet_metric_wallet_state", value: "APPROVED", status_key: "live" },
          { label_key: "world_sheet_metric_payout_state", value: "OPEN", status_key: "live" },
          { label_key: "world_sheet_metric_route_state", value: "2/3", status_key: "watch" }
        ],
        loopSignalRows: [{ label_key: "world_sheet_metric_premium_state", value: "ACTIVE", status_key: "live" }],
        sequenceRows: [{ label_key: "world_sheet_metric_route_state", value: "2/3", status_key: "watch" }]
      }
    },
    sceneRuntime: {
      lowEndMode: false,
      effectiveQuality: "high"
    }
  });

  assert.match(payloads.tokenOverview.loopLineText, /VAULT LOOP/);
  assert.match(payloads.tokenOverview.loopWalletText, /WALLET APPROVED \| LIVE/i);
  assert.match(payloads.tokenOverview.loopPayoutText, /PAYOUT OPEN \| 2\/3/i);
  assert.match(payloads.tokenOverview.loopRouteText, /ROUTE 2\/3 \| APPROVED/i);
  assert.match(payloads.tokenOverview.loopPremiumText, /PREMIUM ACTIVE \| SUBMIT/i);
  assert.equal(payloads.tokenOverview.loopWalletTone, "advantage");
  assert.equal(payloads.tokenOverview.loopPayoutTone, "pressure");
  assert.match(payloads.tokenOverview.loopWalletFocusText, /ENTRY PAYOUT TERMINAL \| FOCUS APPROVED \| FLOW PAYOUT FLOW/i);
  assert.match(payloads.tokenOverview.loopWalletFocusText, /KEY exchange_district:wallet:payout_flow/i);
  assert.match(payloads.tokenOverview.loopPayoutFocusText, /SEQ PAYOUT ROUTE \| FOCUS OPEN \| ROUTE 2\/3/i);
  assert.match(payloads.tokenOverview.loopRouteFocusText, /PERSONA STABLE ROUTE \| FOCUS 2\/3 \| FLOW PAYOUT FLOW/i);
  assert.match(payloads.tokenOverview.loopPremiumStageText, /STAGE SUBMIT \| STATUS LIVE \| PASS ACTIVE/i);
  assert.match(payloads.tokenOverview.loopWalletStateText, /FLOW PAYOUT FLOW \| ENTRY PAYOUT TERMINAL \| STATE APPROVED/i);
  assert.match(payloads.tokenOverview.loopPayoutStateText, /FLOW PAYOUT FLOW \| SEQ PAYOUT ROUTE \| PAYOUT OPEN/i);
  assert.match(payloads.tokenOverview.loopRouteStateText, /FLOW PAYOUT FLOW \| PERSONA STABLE ROUTE \| ROUTE 2\/3/i);
  assert.match(payloads.tokenOverview.loopPremiumStateText, /FLOW PAYOUT FLOW \| STAGE SUBMIT \| PASS ACTIVE/i);
  assert.match(payloads.tokenOverview.loopWalletOpsText, /ENTRY PAYOUT TERMINAL \| STATE APPROVED \| FLOW LIVE/i);
  assert.match(payloads.tokenOverview.loopPayoutOpsText, /SEQ PAYOUT ROUTE \| PAYOUT OPEN \| ROUTE 2\/3/i);
  assert.match(payloads.tokenOverview.loopRouteOpsText, /PERSONA STABLE ROUTE \| ROUTE 2\/3 \| FLOW PAYOUT FLOW/i);
  assert.match(payloads.tokenOverview.loopPremiumOpsText, /ENTRY PAYOUT TERMINAL \| PASS ACTIVE \| STAGE SUBMIT/i);
  assert.match(payloads.tokenOverview.loopWalletSignalText, /STATE APPROVED \| FLOW LIVE \| ENTRY PAYOUT TERMINAL/i);
  assert.match(payloads.tokenOverview.loopPayoutSignalText, /PAYOUT OPEN \| ROUTE 2\/3 \| FLOW PAYOUT FLOW/i);
  assert.match(payloads.tokenOverview.loopRouteSignalText, /ROUTE 2\/3 \| PERSONA STABLE ROUTE \| FLOW PAYOUT FLOW/i);
  assert.match(payloads.tokenOverview.loopPremiumSignalText, /PASS ACTIVE \| STAGE SUBMIT \| FLOW PAYOUT FLOW/i);
  assert.match(payloads.tokenOverview.loopWalletDetailText, /STATE APPROVED \| FLOW LIVE \| PAYOUT TERMINAL/i);
  assert.match(payloads.tokenOverview.loopWalletFamilyText, /FLOW PAYOUT FLOW \| STATUS LIVE \| STATE APPROVED/i);
  assert.match(payloads.tokenOverview.loopWalletFlowText, /ENTRY PAYOUT TERMINAL \| SEQ PAYOUT ROUTE \| ROUTE 2\/3/i);
  assert.match(payloads.tokenOverview.loopWalletSummaryText, /FLOW PAYOUT FLOW \| STATUS LIVE \| PERSONA STABLE ROUTE/i);
  assert.match(payloads.tokenOverview.loopWalletGateText, /STATE APPROVED \| ROUTE 2\/3 \| ENTRY PAYOUT TERMINAL/i);
  assert.match(payloads.tokenOverview.loopWalletLeadText, /ENTRY PAYOUT TERMINAL \| FLOW PAYOUT FLOW \| PAYOUT ROUTE/i);
  assert.match(payloads.tokenOverview.loopWalletWindowText, /STATE APPROVED \| PAYOUT OPEN \| ROUTE 2\/3/i);
  assert.match(payloads.tokenOverview.loopWalletPressureText, /STATE APPROVED \| ROUTE 2\/3 \| PASS ACTIVE/i);
  assert.match(payloads.tokenOverview.loopWalletMicroflowText, /MICRO PAYOUT FLOW \| POD PAYOUT POD/i);
  assert.match(payloads.tokenOverview.loopWalletResponseText, /PAYOUT OPEN \| FLOW LIVE \| ENTRY PAYOUT TERMINAL/i);
  assert.match(payloads.tokenOverview.loopWalletAttentionText, /STATE APPROVED \| ENTRY PAYOUT TERMINAL \| FLOW LIVE/i);
  assert.match(payloads.tokenOverview.loopWalletCadenceText, /ENTRY PAYOUT TERMINAL \| FLOW PAYOUT FLOW \| PERSONA STABLE ROUTE/i);
  assert.match(payloads.tokenOverview.loopPayoutFamilyText, /FLOW PAYOUT FLOW \| STATUS LIVE \| PAYOUT OPEN/i);
  assert.match(payloads.tokenOverview.loopPayoutFlowText, /SEQ PAYOUT ROUTE \| FLOW PAYOUT FLOW \| ROUTE 2\/3/i);
  assert.match(payloads.tokenOverview.loopPayoutSummaryText, /PAYOUT OPEN \| ROUTE 2\/3 \| FLOW PAYOUT FLOW/i);
  assert.match(payloads.tokenOverview.loopPayoutGateText, /PAYOUT OPEN \| ENTRY PAYOUT TERMINAL \| STATUS LIVE/i);
  assert.match(payloads.tokenOverview.loopPayoutLeadText, /SEQ PAYOUT ROUTE \| FLOW PAYOUT FLOW \| PAYOUT OPEN/i);
  assert.match(payloads.tokenOverview.loopPayoutWindowText, /PAYOUT OPEN \| ROUTE 2\/3 \| STATUS LIVE/i);
  assert.match(payloads.tokenOverview.loopPayoutPressureText, /PAYOUT OPEN \| ROUTE 2\/3 \| PASS ACTIVE/i);
  assert.match(payloads.tokenOverview.loopPayoutResponseText, /PAYOUT OPEN \| FLOW LIVE \| SEQ PAYOUT ROUTE/i);
  assert.match(payloads.tokenOverview.loopPayoutAttentionText, /PAYOUT OPEN \| ROUTE 2\/3 \| FLOW PAYOUT FLOW/i);
  assert.match(payloads.tokenOverview.loopPayoutCadenceText, /SEQ PAYOUT ROUTE \| FLOW PAYOUT FLOW \| PAYOUT OPEN/i);
  assert.equal(payloads.tokenOverview.loopPayoutFlowCards?.length, 3);
  assert.equal(payloads.tokenOverview.loopPayoutFlowBlocks?.length, 3);
  assert.equal(payloads.tokenOverview.loopPayoutFlowPanels?.length, 3);
  assert.equal(payloads.tokenOverview.loopPayoutFlowPanels?.[0]?.title, "REQUEST");
  assert.match(payloads.tokenOverview.loopPayoutFlowCards?.[0]?.hint || "", /FOCUS exchange_district:wallet:payout_flow/i);
  assert.equal(payloads.tokenOverview.loopPayoutFlowPanels?.[1]?.title, "STATE");
  assert.equal(payloads.tokenOverview.loopPayoutFlowPanels?.[2]?.title, "PROOF");
  assert.equal(payloads.tokenOverview.loopPayoutRiskCards?.length, 4);
  assert.equal(payloads.tokenOverview.loopPayoutRiskCards?.[0]?.title, "HEALTH");
  assert.equal(payloads.tokenOverview.loopPayoutRiskCards?.[3]?.title, "MICRO");
  assert.equal(payloads.tokenOverview.loopPayoutRiskBlocks?.length, 3);
  assert.equal(payloads.tokenOverview.loopPayoutRiskBlocks?.[1]?.title, "ATTN");
  assert.equal(payloads.tokenOverview.loopPayoutRiskPanels?.length, 3);
  assert.equal(payloads.tokenOverview.loopPayoutRiskPanels?.[2]?.title, "TREND");
  assert.match(payloads.tokenOverview.loopPayoutRiskPanels?.[2]?.lines?.[3] || "", /MICRO PAYOUT FLOW \| POD PAYOUT POD/i);
  assert.match(payloads.tokenOverview.loopPayoutRiskPanels?.[2]?.lines?.[4] || "", /HEALTH .*ATTN .*TREND /i);
  assert.equal(payloads.tokenOverview.loopPayoutFlowCards?.[2]?.title, "RISK");
  assert.equal(payloads.tokenOverview.loopPayoutFlowBlocks?.[2]?.title, "RISK");
  assert.match(payloads.tokenOverview.loopPayoutFlowPanels?.[2]?.lines?.[3] || "", /HEALTH .*ATTN .*TREND /i);
  assert.equal(payloads.tokenOverview.loopPayoutSubflowCards?.length, 3);
  assert.equal(payloads.tokenOverview.loopPayoutSubflowCards?.[0]?.title, "REQUEST");
  assert.equal(payloads.tokenOverview.loopPayoutSubflowBlocks?.length, 3);
  assert.equal(payloads.tokenOverview.loopPayoutSubflowBlocks?.[0]?.title, "REQUEST");
  assert.equal(payloads.tokenOverview.loopPayoutSubflowPanels?.length, 3);
  assert.equal(payloads.tokenOverview.loopPayoutSubflowPanels?.[0]?.title, "REQUEST");
  assert.equal(payloads.tokenOverview.loopPayoutSubflowPanels?.[1]?.title, "STATE");
  assert.equal(payloads.tokenOverview.loopPayoutSubflowPanels?.[2]?.title, "PROOF");
  assert.match(payloads.tokenOverview.loopPayoutSubflowPanels?.[2]?.lines?.[3] || "", /HEALTH .*ATTN .*TREND /i);
  assert.match(
    payloads.tokenOverview.loopPayoutSubflowPanels?.[2]?.lines?.[6] || "",
    /^FAMILY wallet \| MICRO payout_flow \| FLOW wallet:payout_flow \| ENTRY world_entry_kind_payout_terminal \| SEQ world_modal_kind_payout_route(?: \| ASSET .+)?$/i
  );
  assert.match(payloads.tokenOverview.loopRouteFamilyText, /FLOW PAYOUT FLOW \| STATUS LIVE \| ROUTE 2\/3/i);
  assert.match(payloads.tokenOverview.loopRouteFlowText, /PERSONA STABLE ROUTE \| FLOW PAYOUT FLOW \| SEQ PAYOUT ROUTE/i);
  assert.match(payloads.tokenOverview.loopRouteSummaryText, /ROUTE 2\/3 \| WALLET APPROVED \| FLOW PAYOUT FLOW/i);
  assert.match(payloads.tokenOverview.loopRouteGateText, /ROUTE 2\/3 \| ENTRY PAYOUT TERMINAL \| STATUS LIVE/i);
  assert.match(payloads.tokenOverview.loopRouteLeadText, /PERSONA STABLE ROUTE \| FLOW PAYOUT FLOW \| ROUTE 2\/3/i);
  assert.match(payloads.tokenOverview.loopRouteWindowText, /ROUTE 2\/3 \| WALLET APPROVED \| STATUS LIVE/i);
  assert.match(payloads.tokenOverview.loopRoutePressureText, /ROUTE 2\/3 \| PAYOUT OPEN \| PASS ACTIVE/i);
  assert.match(payloads.tokenOverview.loopRouteResponseText, /ROUTE 2\/3 \| FLOW LIVE \| PERSONA STABLE ROUTE/i);
  assert.match(payloads.tokenOverview.loopRouteAttentionText, /ROUTE 2\/3 \| WALLET APPROVED \| FLOW PAYOUT FLOW/i);
  assert.match(payloads.tokenOverview.loopRouteCadenceText, /PERSONA STABLE ROUTE \| FLOW PAYOUT FLOW \| ROUTE 2\/3/i);
  assert.equal(payloads.tokenOverview.loopRouteFlowCards?.length, 3);
  assert.equal(payloads.tokenOverview.loopRouteFlowBlocks?.length, 3);
  assert.equal(payloads.tokenOverview.loopRouteFlowPanels?.length, 3);
  assert.equal(payloads.tokenOverview.loopRouteFlowPanels?.[0]?.title, "ROUTE");
  assert.equal(payloads.tokenOverview.loopRouteFlowPanels?.[1]?.title, "STATE");
  assert.equal(payloads.tokenOverview.loopRouteFlowPanels?.[2]?.title, "COVERAGE");
  assert.equal(payloads.tokenOverview.loopRouteRiskCards?.length, 4);
  assert.equal(payloads.tokenOverview.loopRouteRiskCards?.[0]?.title, "HEALTH");
  assert.equal(payloads.tokenOverview.loopRouteRiskCards?.[3]?.title, "MICRO");
  assert.equal(payloads.tokenOverview.loopRouteRiskBlocks?.length, 3);
  assert.equal(payloads.tokenOverview.loopRouteRiskBlocks?.[2]?.title, "TREND");
  assert.equal(payloads.tokenOverview.loopRouteRiskPanels?.length, 3);
  assert.equal(payloads.tokenOverview.loopRouteRiskPanels?.[1]?.title, "ATTN");
  assert.match(payloads.tokenOverview.loopRouteRiskPanels?.[2]?.lines?.[3] || "", /MICRO PAYOUT FLOW \| POD PAYOUT POD/i);
  assert.match(payloads.tokenOverview.loopRouteRiskPanels?.[2]?.lines?.[4] || "", /HEALTH .*ATTN .*TREND /i);
  assert.equal(payloads.tokenOverview.loopRouteSubflowCards?.length, 3);
  assert.equal(payloads.tokenOverview.loopRouteSubflowCards?.[0]?.title, "ROUTE");
  assert.equal(payloads.tokenOverview.loopRouteSubflowBlocks?.length, 3);
  assert.equal(payloads.tokenOverview.loopRouteSubflowBlocks?.[0]?.title, "ROUTE");
  assert.equal(payloads.tokenOverview.loopRouteSubflowPanels?.length, 3);
  assert.equal(payloads.tokenOverview.loopRouteSubflowPanels?.[0]?.title, "ROUTE");
  assert.equal(payloads.tokenOverview.loopRouteSubflowPanels?.[1]?.title, "STATE");
  assert.equal(payloads.tokenOverview.loopRouteSubflowPanels?.[2]?.title, "COVERAGE");
  assert.match(payloads.tokenOverview.loopPremiumFamilyText, /FLOW PAYOUT FLOW \| STATUS LIVE \| PASS ACTIVE/i);
  assert.match(payloads.tokenOverview.loopPremiumFlowText, /ENTRY PAYOUT TERMINAL \| FLOW PAYOUT FLOW \| STAGE SUBMIT/i);
  assert.match(payloads.tokenOverview.loopPremiumSummaryText, /PASS ACTIVE \| STAGE SUBMIT \| FLOW PAYOUT FLOW/i);
  assert.match(payloads.tokenOverview.loopPremiumGateText, /PASS ACTIVE \| ENTRY PAYOUT TERMINAL \| STATUS LIVE/i);
  assert.match(payloads.tokenOverview.loopPremiumLeadText, /ENTRY PAYOUT TERMINAL \| FLOW PAYOUT FLOW \| PASS ACTIVE/i);
  assert.match(payloads.tokenOverview.loopPremiumWindowText, /PASS ACTIVE \| STAGE SUBMIT \| STATUS LIVE/i);
  assert.match(payloads.tokenOverview.loopPremiumPressureText, /PASS ACTIVE \| PAYOUT OPEN \| ROUTE 2\/3/i);
  assert.match(payloads.tokenOverview.loopPremiumResponseText, /PASS ACTIVE \| FLOW LIVE \| ENTRY PAYOUT TERMINAL/i);
  assert.match(payloads.tokenOverview.loopPremiumAttentionText, /PASS ACTIVE \| STAGE SUBMIT \| FLOW PAYOUT FLOW/i);
  assert.match(payloads.tokenOverview.loopPremiumCadenceText, /ENTRY PAYOUT TERMINAL \| FLOW PAYOUT FLOW \| PASS ACTIVE/i);
  assert.equal(payloads.tokenOverview.loopPremiumFlowCards?.length, 3);
  assert.equal(payloads.tokenOverview.loopPremiumFlowBlocks?.length, 3);
  assert.equal(payloads.tokenOverview.loopPremiumFlowPanels?.length, 3);
  assert.equal(payloads.tokenOverview.loopPremiumFlowPanels?.[0]?.title, "PASS");
  assert.equal(payloads.tokenOverview.loopPremiumFlowPanels?.[1]?.title, "STATE");
  assert.equal(payloads.tokenOverview.loopPremiumFlowPanels?.[2]?.title, "PERK");
  assert.equal(payloads.tokenOverview.loopPremiumRiskCards?.length, 4);
  assert.equal(payloads.tokenOverview.loopPremiumRiskCards?.[0]?.title, "HEALTH");
  assert.equal(payloads.tokenOverview.loopPremiumRiskCards?.[3]?.title, "MICRO");
  assert.equal(payloads.tokenOverview.loopPremiumRiskBlocks?.length, 3);
  assert.equal(payloads.tokenOverview.loopPremiumRiskBlocks?.[1]?.title, "ATTN");
  assert.equal(payloads.tokenOverview.loopPremiumRiskPanels?.length, 3);
  assert.equal(payloads.tokenOverview.loopPremiumRiskPanels?.[2]?.title, "TREND");
  assert.match(payloads.tokenOverview.loopPremiumRiskPanels?.[2]?.lines?.[3] || "", /MICRO PAYOUT FLOW \| POD PAYOUT POD/i);
  assert.match(payloads.tokenOverview.loopPremiumRiskPanels?.[2]?.lines?.[4] || "", /HEALTH .*ATTN .*TREND /i);
  assert.equal(payloads.tokenOverview.loopPremiumSubflowCards?.length, 3);
  assert.equal(payloads.tokenOverview.loopPremiumSubflowCards?.[0]?.title, "PASS");
  assert.equal(payloads.tokenOverview.loopPremiumSubflowBlocks?.length, 3);
  assert.equal(payloads.tokenOverview.loopPremiumSubflowBlocks?.[0]?.title, "PASS");
  assert.equal(payloads.tokenOverview.loopPremiumSubflowPanels?.length, 3);
  assert.equal(payloads.tokenOverview.loopPremiumSubflowPanels?.[0]?.title, "PASS");
  assert.equal(payloads.tokenOverview.loopPremiumSubflowPanels?.[1]?.title, "STATE");
  assert.equal(payloads.tokenOverview.loopPremiumSubflowPanels?.[2]?.title, "PERK");
  assert.match(payloads.tokenOverview.loopPayoutDetailText, /PAYOUT OPEN \| ROUTE 2\/3 \| PAYOUT ROUTE/i);
  assert.match(payloads.tokenOverview.loopRouteDetailText, /ROUTE 2\/3 \| WALLET APPROVED \| STABLE ROUTE/i);
  assert.match(payloads.tokenOverview.loopPremiumDetailText, /PASS ACTIVE \| STAGE SUBMIT \| PAYOUT TERMINAL/i);
  assert.equal(payloads.tokenOverview.loopWalletCards?.length, 3);
  assert.equal(payloads.tokenOverview.loopWalletCards?.[0]?.title, "WALLET");
  assert.match(payloads.tokenOverview.loopWalletCards?.[0]?.value || "", /APPROVED|LIVE/i);
  assert.equal(payloads.tokenOverview.loopWalletFlowCards?.length, 3);
  assert.equal(payloads.tokenOverview.loopWalletFlowCards?.[0]?.title, "LINK");
  assert.match(payloads.tokenOverview.loopWalletFlowCards?.[0]?.value || "", /WALLET TERMINAL|PAYOUT TERMINAL|PAYOUT FLOW/i);
  assert.equal(payloads.tokenOverview.loopWalletFlowCards?.[0]?.focus_key, "exchange_district:wallet:payout_flow");
  assert.equal(payloads.tokenOverview.loopWalletFlowCards?.[0]?.flow_key, "wallet:payout_flow");
  assert.equal(payloads.tokenOverview.loopWalletFlowCards?.[0]?.risk_health_band_key, "green");
  assert.equal(payloads.tokenOverview.loopWalletFlowCards?.[0]?.risk_attention_band_key, "stable");
  assert.equal(payloads.tokenOverview.loopWalletFlowCards?.[0]?.risk_trend_direction_key, "flat");
  assert.match(
    payloads.tokenOverview.loopWalletFlowCards?.[0]?.risk_focus_key || "",
    /^exchange_district:wallet:payout_flow\|[a-z_]+:[a-z_]+:[a-z_]+$/i
  );
  assert.equal(payloads.tokenOverview.loopWalletFlowCards?.[0]?.risk_context?.flow_key, "wallet:payout_flow");
  assert.equal(
    payloads.tokenOverview.loopWalletFlowCards?.[0]?.risk_context?.focus_key,
    "exchange_district:wallet:payout_flow"
  );
  assert.equal(payloads.tokenOverview.loopWalletFlowCards?.[0]?.risk_context?.entry_kind_key, "world_entry_kind_payout_terminal");
  assert.equal(
    payloads.tokenOverview.loopWalletFlowCards?.[0]?.risk_context?.sequence_kind_key,
    "world_modal_kind_payout_route"
  );
  assert.equal(
    payloads.tokenOverview.loopWalletFlowCards?.[0]?.action_context_signature,
    "wallet:payout_flow|exchange_district:wallet:payout_flow|world_entry_kind_payout_terminal|world_modal_kind_payout_route"
  );
  assert.equal(
    payloads.tokenOverview.loopWalletFlowCards?.[0]?.action_context?.action_context_signature,
    "wallet:payout_flow|exchange_district:wallet:payout_flow|world_entry_kind_payout_terminal|world_modal_kind_payout_route"
  );
  assert.equal(
    payloads.tokenOverview.loopWalletFlowCards?.[0]?.risk_context_signature,
    "wallet:payout_flow|exchange_district:wallet:payout_flow|green:stable:flat|world_entry_kind_payout_terminal|world_modal_kind_payout_route"
  );
  assert.equal(
    payloads.tokenOverview.loopWalletFlowCards?.[0]?.risk_context?.risk_context_signature,
    "wallet:payout_flow|exchange_district:wallet:payout_flow|green:stable:flat|world_entry_kind_payout_terminal|world_modal_kind_payout_route"
  );
  assert.equal(payloads.tokenOverview.loopWalletFlowCards?.[0]?.contract_state_key, "ready");
  assert.equal(payloads.tokenOverview.loopWalletFlowBlocks?.length, 3);
  assert.equal(payloads.tokenOverview.loopWalletFlowPanels?.length, 3);
  assert.equal(payloads.tokenOverview.loopWalletFlowPanels?.[0]?.title, "LINK");
  assert.equal(payloads.tokenOverview.loopWalletFlowPanels?.[1]?.title, "STATE");
  assert.equal(payloads.tokenOverview.loopWalletFlowPanels?.[2]?.title, "ROUTE");
  assert.equal(payloads.tokenOverview.loopWalletRiskCards?.length, 4);
  assert.equal(payloads.tokenOverview.loopWalletRiskCards?.[0]?.title, "HEALTH");
  assert.equal(payloads.tokenOverview.loopWalletRiskCards?.[1]?.title, "ATTN");
  assert.equal(payloads.tokenOverview.loopWalletRiskCards?.[2]?.title, "TREND");
  assert.equal(payloads.tokenOverview.loopWalletRiskCards?.[3]?.title, "MICRO");
  assert.equal(payloads.tokenOverview.loopWalletRiskBlocks?.length, 3);
  assert.equal(payloads.tokenOverview.loopWalletRiskBlocks?.[0]?.title, "HEALTH");
  assert.equal(payloads.tokenOverview.loopWalletRiskBlocks?.[1]?.title, "ATTN");
  assert.equal(payloads.tokenOverview.loopWalletRiskBlocks?.[2]?.title, "TREND");
  assert.equal(payloads.tokenOverview.loopWalletRiskPanels?.length, 3);
  assert.equal(payloads.tokenOverview.loopWalletRiskPanels?.[0]?.title, "HEALTH");
  assert.equal(payloads.tokenOverview.loopWalletRiskPanels?.[1]?.title, "ATTN");
  assert.equal(payloads.tokenOverview.loopWalletRiskPanels?.[2]?.title, "TREND");
  assert.match(payloads.tokenOverview.loopWalletRiskPanels?.[1]?.lines?.[1] || "", /ROUTE|APPROVED|OPEN|PRESSURE/i);
  assert.match(payloads.tokenOverview.loopWalletRiskPanels?.[2]?.lines?.[3] || "", /MICRO PAYOUT FLOW \| POD PAYOUT POD/i);
  assert.match(payloads.tokenOverview.loopWalletRiskPanels?.[2]?.lines?.[4] || "", /HEALTH .*ATTN .*TREND /i);
  assert.match(payloads.tokenOverview.loopWalletRiskPanels?.[2]?.lines?.[5] || "", /^RISK [a-z_]+:[a-z_]+:[a-z_]+$/i);
  assert.match(
    payloads.tokenOverview.loopWalletRiskPanels?.[2]?.lines?.[6] || "",
    /^RFK exchange_district:wallet:payout_flow\|[a-z_]+:[a-z_]+:[a-z_]+$/i
  );
  assert.match(
    payloads.tokenOverview.loopWalletRiskCards?.[3]?.hint || "",
    /FOCUS exchange_district:wallet:payout_flow \| RISK [a-z_]+:[a-z_]+:[a-z_]+/i
  );
  assert.equal(payloads.tokenOverview.loopWalletSubflowCards?.length, 3);
  assert.equal(payloads.tokenOverview.loopWalletSubflowCards?.[0]?.title, "LINK");
  assert.equal(payloads.tokenOverview.loopWalletSubflowBlocks?.length, 3);
  assert.equal(payloads.tokenOverview.loopWalletSubflowBlocks?.[0]?.title, "LINK");
  assert.equal(payloads.tokenOverview.loopWalletSubflowPanels?.length, 3);
  assert.equal(payloads.tokenOverview.loopWalletSubflowPanels?.[0]?.title, "LINK");
  assert.equal(payloads.tokenOverview.loopWalletSubflowPanels?.[1]?.title, "STATE");
  assert.equal(payloads.tokenOverview.loopWalletSubflowPanels?.[2]?.title, "ROUTE");
  assert.equal(payloads.tokenOverview.loopWalletBlocks?.length, 3);
  assert.equal(payloads.tokenOverview.loopWalletBlocks?.[0]?.title, "FLOW");
  assert.match(payloads.tokenOverview.loopWalletBlocks?.[0]?.summary || "", /APPROVED|LIVE|FLOW/i);
});

test("buildPlayerBridgePayloads surfaces active tasks loop micro panels from selected mission flow", async () => {
  const mod = await loadModule();
  const payloads = mod.buildPlayerBridgePayloads({
    mutators: createMutators(),
    data: {
      offers: [{ id: 21, task_type: "raid", difficulty: 55, expires_at: "2099-03-10T12:00:00.000Z" }],
      missions: { list: [{ mission_key: "mission_sigma", title: "Mission Sigma", completed: true, can_claim: true }] },
      attempts: { active: { task_type: "raid" }, revealable: { task_type: "claim" } }
    },
    homeFeed: {
      mission: { offer_count: 4, claimable_count: 2, active_count: 4 },
      daily: { streak: 7, tasks_done: 4, daily_cap: 5, sc_earned: 22, rc_earned: 6 },
      contract: { band: "watch", state: "watch" }
    },
    taskResult: { offer_count: 4, claimable_count: 2 },
    scene: {
      selectedLoop: {
        districtKey: "mission_quarter",
        protocolCardKey: "mission_protocol",
        protocolPodKey: "claim_pod",
        microflowKey: "claim_flow",
        entryKindKey: "world_entry_kind_claim_terminal",
        sequenceKindKey: "world_modal_kind_contract_sequence",
        personalityKey: "cadence",
        personalityLabelKey: "world_personality_cadence",
        personalityCaptionKey: "world_personality_caption_cadence",
        densityLabelKey: "world_hud_density_expanded",
        loopStatusKey: "ready",
        loopStatusLabelKey: "loop_status_ready",
        loopStageValue: "2 READY",
        loopRows: [
          { label_key: "world_sheet_metric_claimable", value: "2", status_key: "ready" },
          { label_key: "world_sheet_metric_contract_band", value: "WATCH", status_key: "watch" },
          { label_key: "world_sheet_metric_streak", value: "7d", status_key: "live" }
        ],
        loopSignalRows: [{ label_key: "world_sheet_metric_offer_count", value: "4", status_key: "live" }],
        sequenceRows: [{ label_key: "world_sheet_metric_claimable", value: "2", status_key: "ready" }]
      }
    },
    sceneRuntime: {
      lowEndMode: false,
      effectiveQuality: "high"
    }
  });

  assert.match(payloads.operations.loop.lineText, /MISSION LOOP/i);
  assert.match(payloads.operations.loop.hintText, /CLAIM TERMINAL|CONTRACT SEQUENCE/i);
  assert.match(payloads.operations.loop.offerText, /OFFER 4 LIVE \| WATCH/i);
  assert.match(payloads.operations.loop.claimText, /CLAIM 2 READY \| 2 READY/i);
  assert.match(payloads.operations.loop.streakText, /STREAK 7d \| READY/i);
  assert.match(payloads.operations.loop.lootText, /LOOT 2 READY \| WATCH/i);
  assert.equal(payloads.operations.loop.offerTone, "pressure");
  assert.equal(payloads.operations.loop.claimTone, "pressure");
  assert.equal(payloads.operations.loop.streakTone, "advantage");
  assert.equal(payloads.operations.loop.lootTone, "pressure");
  assert.match(payloads.operations.loop.offerFocusText, /ENTRY CLAIM TERMINAL \| FOCUS 4 LIVE \| FLOW CLAIM FLOW/i);
  assert.match(payloads.operations.loop.claimFocusText, /SEQ CONTRACT SEQUENCE \| FOCUS 2 READY \| STAGE 2 READY/i);
  assert.match(
    payloads.operations.loop.streakFocusText,
    /PERSONA (WORLD )?PERSONALITY CAPTION CADENCE \| FOCUS 7d \| FLOW CLAIM FLOW/i
  );
  assert.match(payloads.operations.loop.lootFocusText, /KEY mission_quarter:loot:claim_flow/i);
  assert.match(payloads.operations.loop.lootStageText, /STAGE 2 READY \| STATUS READY \| CLAIM 2 READY/i);
  assert.match(payloads.operations.loop.offerStateText, /FLOW CLAIM FLOW \| ENTRY CLAIM TERMINAL \| OFFER 4 LIVE/i);
  assert.match(payloads.operations.loop.claimStateText, /FLOW CLAIM FLOW \| SEQ CONTRACT SEQUENCE \| CLAIM 2 READY/i);
  assert.match(
    payloads.operations.loop.streakStateText,
    /FLOW CLAIM FLOW \| PERSONA (WORLD )?PERSONALITY CAPTION CADENCE \| STREAK 7d/i
  );
  assert.match(payloads.operations.loop.lootStateText, /FLOW CLAIM FLOW \| CLAIM 2 READY \| BAND WATCH/i);
  assert.match(payloads.operations.loop.offerOpsText, /ENTRY CLAIM TERMINAL \| OFFER 4 LIVE \| BAND WATCH/i);
  assert.match(payloads.operations.loop.claimOpsText, /SEQ CONTRACT SEQUENCE \| CLAIM 2 READY \| BAND WATCH/i);
  assert.match(
    payloads.operations.loop.streakOpsText,
    /PERSONA (WORLD )?PERSONALITY CAPTION CADENCE \| STREAK 7d \| OFFER 4 LIVE/i
  );
  assert.match(payloads.operations.loop.lootOpsText, /ENTRY CLAIM TERMINAL \| CLAIM 2 READY \| BAND WATCH/i);
  assert.match(payloads.operations.loop.offerSignalText, /OFFER 4 LIVE \| BAND WATCH \| FLOW CLAIM FLOW/i);
  assert.match(payloads.operations.loop.claimSignalText, /CLAIM 2 READY \| STAGE 2 READY \| FLOW CLAIM FLOW/i);
  assert.match(payloads.operations.loop.streakSignalText, /STREAK 7d \| OFFER 4 LIVE \| FLOW CLAIM FLOW/i);
  assert.match(payloads.operations.loop.lootSignalText, /CLAIM 2 READY \| BAND WATCH \| FLOW CLAIM FLOW/i);
  assert.match(payloads.operations.loop.offerDetailText, /OFFER 4 LIVE \| BAND WATCH \| CLAIM TERMINAL/i);
  assert.match(payloads.operations.loop.claimDetailText, /CLAIM 2 READY \| STAGE 2 READY \| CONTRACT SEQUENCE/i);
  assert.match(payloads.operations.loop.lootDetailText, /CLAIM 2 READY \| BAND WATCH \| CLAIM TERMINAL/i);
  assert.match(payloads.operations.loop.lootFamilyText, /FLOW CLAIM FLOW \| STATUS READY \| BAND WATCH/i);
  assert.match(payloads.operations.loop.lootFlowText, /ENTRY CLAIM TERMINAL \| SEQ CONTRACT SEQUENCE \| CLAIM 2 READY/i);
  assert.match(
    payloads.operations.loop.lootSummaryText,
    /FLOW CLAIM FLOW \| STATUS READY \| PERSONA (WORLD )?PERSONALITY CAPTION CADENCE/i
  );
  assert.match(payloads.operations.loop.lootGateText, /CLAIM 2 READY \| BAND WATCH \| ENTRY CLAIM TERMINAL/i);
  assert.match(payloads.operations.loop.lootLeadText, /ENTRY CLAIM TERMINAL \| FLOW CLAIM FLOW \| CONTRACT SEQUENCE/i);
  assert.match(payloads.operations.loop.lootWindowText, /CLAIM 2 READY \| OFFER 4 LIVE \| STREAK 7d/i);
  assert.match(payloads.operations.loop.lootPressureText, /CLAIM 2 READY \| BAND WATCH \| OFFER 4 LIVE/i);
  assert.match(payloads.operations.loop.lootMicroflowText, /MICRO CLAIM FLOW \| POD CLAIM POD/i);
  assert.match(payloads.operations.loop.lootResponseText, /STREAK 7d \| FLOW READY \| ENTRY CLAIM TERMINAL/i);
  assert.match(payloads.operations.loop.lootAttentionText, /CLAIM 2 READY \| BAND WATCH \| ENTRY CLAIM TERMINAL/i);
  assert.match(payloads.operations.loop.lootCadenceText, /ENTRY CLAIM TERMINAL \| FLOW CLAIM FLOW \| CLAIM 2 READY/i);
  assert.match(payloads.operations.loop.offerFamilyText, /FLOW CLAIM FLOW \| STATUS READY \| OFFER 4 LIVE/i);
  assert.match(payloads.operations.loop.offerFlowText, /ENTRY CLAIM TERMINAL \| FLOW CLAIM FLOW \| BAND WATCH/i);
  assert.match(payloads.operations.loop.offerSummaryText, /OFFER 4 LIVE \| BAND WATCH \| FLOW CLAIM FLOW/i);
  assert.match(payloads.operations.loop.offerGateText, /OFFER 4 LIVE \| ENTRY CLAIM TERMINAL \| STATUS READY/i);
  assert.match(payloads.operations.loop.offerLeadText, /ENTRY CLAIM TERMINAL \| FLOW CLAIM FLOW \| OFFER 4 LIVE/i);
  assert.match(payloads.operations.loop.offerWindowText, /OFFER 4 LIVE \| BAND WATCH \| STATUS READY/i);
  assert.match(payloads.operations.loop.offerPressureText, /OFFER 4 LIVE \| BAND WATCH \| CLAIM 2 READY/i);
  assert.match(payloads.operations.loop.offerResponseText, /OFFER 4 LIVE \| FLOW READY \| ENTRY CLAIM TERMINAL/i);
  assert.match(payloads.operations.loop.offerAttentionText, /OFFER 4 LIVE \| BAND WATCH \| FLOW CLAIM FLOW/i);
  assert.match(payloads.operations.loop.offerCadenceText, /ENTRY CLAIM TERMINAL \| FLOW CLAIM FLOW \| OFFER 4 LIVE/i);
  assert.equal(payloads.operations.loop.offerFlowCards?.length, 3);
  assert.equal(payloads.operations.loop.offerFlowBlocks?.length, 3);
  assert.equal(payloads.operations.loop.offerFlowPanels?.length, 3);
  assert.equal(payloads.operations.loop.offerFlowPanels?.[0]?.title, "OFFER");
  assert.match(payloads.operations.loop.offerFlowCards?.[0]?.hint || "", /FOCUS mission_quarter:loot:claim_flow/i);
  assert.equal(payloads.operations.loop.offerFlowPanels?.[1]?.title, "STATUS");
  assert.equal(payloads.operations.loop.offerFlowPanels?.[2]?.title, "STACK");
  assert.equal(payloads.operations.loop.offerRiskCards?.length, 4);
  assert.equal(payloads.operations.loop.offerRiskCards?.[0]?.title, "HEALTH");
  assert.equal(payloads.operations.loop.offerRiskCards?.[3]?.title, "MICRO");
  assert.equal(payloads.operations.loop.offerRiskBlocks?.length, 3);
  assert.equal(payloads.operations.loop.offerRiskBlocks?.[2]?.title, "TREND");
  assert.equal(payloads.operations.loop.offerRiskPanels?.length, 3);
  assert.equal(payloads.operations.loop.offerRiskPanels?.[1]?.title, "ATTN");
  assert.match(payloads.operations.loop.offerRiskPanels?.[2]?.lines?.[3] || "", /MICRO CLAIM FLOW \| POD CLAIM POD/i);
  assert.match(payloads.operations.loop.offerRiskPanels?.[2]?.lines?.[4] || "", /HEALTH .*ATTN .*TREND /i);
  assert.equal(payloads.operations.loop.offerSubflowCards?.length, 3);
  assert.equal(payloads.operations.loop.offerSubflowCards?.[0]?.title, "OFFER");
  assert.equal(payloads.operations.loop.offerSubflowBlocks?.length, 3);
  assert.equal(payloads.operations.loop.offerSubflowBlocks?.[0]?.title, "OFFER");
  assert.equal(payloads.operations.loop.offerSubflowPanels?.length, 3);
  assert.equal(payloads.operations.loop.offerSubflowPanels?.[0]?.title, "OFFER");
  assert.equal(payloads.operations.loop.offerSubflowPanels?.[1]?.title, "STATUS");
  assert.equal(payloads.operations.loop.offerSubflowPanels?.[2]?.title, "STACK");
  assert.match(payloads.operations.loop.claimFamilyText, /FLOW CLAIM FLOW \| STATUS READY \| CLAIM 2 READY/i);
  assert.match(payloads.operations.loop.claimFlowText, /SEQ CONTRACT SEQUENCE \| FLOW CLAIM FLOW \| STAGE 2 READY/i);
  assert.match(payloads.operations.loop.claimSummaryText, /CLAIM 2 READY \| STAGE 2 READY \| FLOW CLAIM FLOW/i);
  assert.match(payloads.operations.loop.claimGateText, /CLAIM 2 READY \| ENTRY CLAIM TERMINAL \| STATUS READY/i);
  assert.match(payloads.operations.loop.claimLeadText, /SEQ CONTRACT SEQUENCE \| FLOW CLAIM FLOW \| CLAIM 2 READY/i);
  assert.match(payloads.operations.loop.claimWindowText, /CLAIM 2 READY \| STAGE 2 READY \| STATUS READY/i);
  assert.match(payloads.operations.loop.claimPressureText, /CLAIM 2 READY \| BAND WATCH \| OFFER 4 LIVE/i);
  assert.match(payloads.operations.loop.claimResponseText, /CLAIM 2 READY \| FLOW READY \| SEQ CONTRACT SEQUENCE/i);
  assert.match(payloads.operations.loop.claimAttentionText, /CLAIM 2 READY \| STAGE 2 READY \| FLOW CLAIM FLOW/i);
  assert.match(payloads.operations.loop.claimCadenceText, /SEQ CONTRACT SEQUENCE \| FLOW CLAIM FLOW \| CLAIM 2 READY/i);
  assert.equal(payloads.operations.loop.claimFlowCards?.length, 3);
  assert.equal(payloads.operations.loop.claimFlowBlocks?.length, 3);
  assert.equal(payloads.operations.loop.claimFlowPanels?.length, 3);
  assert.equal(payloads.operations.loop.claimFlowPanels?.[0]?.title, "CLAIM");
  assert.equal(payloads.operations.loop.claimFlowPanels?.[1]?.title, "STATUS");
  assert.equal(payloads.operations.loop.claimFlowPanels?.[2]?.title, "PROOF");
  assert.equal(payloads.operations.loop.claimRiskCards?.length, 4);
  assert.equal(payloads.operations.loop.claimRiskCards?.[0]?.title, "HEALTH");
  assert.equal(payloads.operations.loop.claimRiskCards?.[3]?.title, "MICRO");
  assert.equal(payloads.operations.loop.claimRiskBlocks?.length, 3);
  assert.equal(payloads.operations.loop.claimRiskBlocks?.[1]?.title, "ATTN");
  assert.equal(payloads.operations.loop.claimRiskPanels?.length, 3);
  assert.equal(payloads.operations.loop.claimRiskPanels?.[2]?.title, "TREND");
  assert.match(payloads.operations.loop.claimRiskPanels?.[2]?.lines?.[3] || "", /MICRO CLAIM FLOW \| POD CLAIM POD/i);
  assert.match(payloads.operations.loop.claimRiskPanels?.[2]?.lines?.[4] || "", /HEALTH .*ATTN .*TREND /i);
  assert.equal(payloads.operations.loop.claimSubflowCards?.length, 3);
  assert.equal(payloads.operations.loop.claimSubflowCards?.[0]?.title, "CLAIM");
  assert.equal(payloads.operations.loop.claimSubflowBlocks?.length, 3);
  assert.equal(payloads.operations.loop.claimSubflowBlocks?.[0]?.title, "CLAIM");
  assert.equal(payloads.operations.loop.claimSubflowPanels?.length, 3);
  assert.equal(payloads.operations.loop.claimSubflowPanels?.[0]?.title, "CLAIM");
  assert.equal(payloads.operations.loop.claimSubflowPanels?.[1]?.title, "STATUS");
  assert.equal(payloads.operations.loop.claimSubflowPanels?.[2]?.title, "PROOF");
  assert.match(payloads.operations.loop.streakFamilyText, /FLOW CLAIM FLOW \| STATUS READY \| STREAK 7d/i);
  assert.match(
    payloads.operations.loop.streakFlowText,
    /PERSONA (WORLD )?PERSONALITY CAPTION CADENCE \| FLOW CLAIM FLOW \| OFFER 4 LIVE/i
  );
  assert.match(payloads.operations.loop.streakSummaryText, /STREAK 7d \| OFFER 4 LIVE \| FLOW CLAIM FLOW/i);
  assert.match(payloads.operations.loop.streakGateText, /STREAK 7d \| ENTRY CLAIM TERMINAL \| STATUS READY/i);
  assert.match(
    payloads.operations.loop.streakLeadText,
    /PERSONA (WORLD )?PERSONALITY CAPTION CADENCE \| FLOW CLAIM FLOW \| STREAK 7d/i
  );
  assert.match(payloads.operations.loop.streakWindowText, /STREAK 7d \| OFFER 4 LIVE \| STATUS READY/i);
  assert.match(payloads.operations.loop.streakPressureText, /STREAK 7d \| OFFER 4 LIVE \| BAND WATCH/i);
  assert.match(
    payloads.operations.loop.streakResponseText,
    /STREAK 7d \| FLOW READY \| PERSONA (WORLD )?PERSONALITY CAPTION CADENCE/i
  );
  assert.match(payloads.operations.loop.streakAttentionText, /STREAK 7d \| OFFER 4 LIVE \| FLOW CLAIM FLOW/i);
  assert.match(
    payloads.operations.loop.streakCadenceText,
    /PERSONA (WORLD )?PERSONALITY CAPTION CADENCE \| FLOW CLAIM FLOW \| STREAK 7d/i
  );
  assert.equal(payloads.operations.loop.streakFlowCards?.length, 3);
  assert.equal(payloads.operations.loop.streakFlowBlocks?.length, 3);
  assert.equal(payloads.operations.loop.streakFlowPanels?.length, 3);
  assert.equal(payloads.operations.loop.streakFlowPanels?.[0]?.title, "STREAK");
  assert.equal(payloads.operations.loop.streakFlowPanels?.[1]?.title, "STATUS");
  assert.equal(payloads.operations.loop.streakFlowPanels?.[2]?.title, "SYNC");
  assert.equal(payloads.operations.loop.streakRiskCards?.length, 4);
  assert.equal(payloads.operations.loop.streakRiskCards?.[0]?.title, "HEALTH");
  assert.equal(payloads.operations.loop.streakRiskCards?.[3]?.title, "MICRO");
  assert.equal(payloads.operations.loop.streakRiskBlocks?.length, 3);
  assert.equal(payloads.operations.loop.streakRiskBlocks?.[1]?.title, "ATTN");
  assert.equal(payloads.operations.loop.streakRiskPanels?.length, 3);
  assert.equal(payloads.operations.loop.streakRiskPanels?.[2]?.title, "TREND");
  assert.match(payloads.operations.loop.streakRiskPanels?.[2]?.lines?.[3] || "", /MICRO CLAIM FLOW \| POD CLAIM POD/i);
  assert.match(payloads.operations.loop.streakRiskPanels?.[2]?.lines?.[4] || "", /HEALTH .*ATTN .*TREND /i);
  assert.equal(payloads.operations.loop.streakSubflowCards?.length, 3);
  assert.equal(payloads.operations.loop.streakSubflowCards?.[0]?.title, "STREAK");
  assert.equal(payloads.operations.loop.streakSubflowBlocks?.length, 3);
  assert.equal(payloads.operations.loop.streakSubflowBlocks?.[0]?.title, "STREAK");
  assert.equal(payloads.operations.loop.streakSubflowPanels?.length, 3);
  assert.equal(payloads.operations.loop.streakSubflowPanels?.[0]?.title, "STREAK");
  assert.equal(payloads.operations.loop.streakSubflowPanels?.[1]?.title, "STATUS");
  assert.equal(payloads.operations.loop.streakSubflowPanels?.[2]?.title, "SYNC");
  assert.equal(payloads.operations.loop.lootCards?.length, 3);
  assert.equal(payloads.operations.loop.lootCards?.[0]?.title, "CLAIM");
  assert.match(payloads.operations.loop.lootCards?.[0]?.value || "", /2 READY/i);
  assert.equal(payloads.operations.loop.lootFlowCards?.length, 3);
  assert.equal(payloads.operations.loop.lootFlowCards?.[0]?.title, "OFFER");
  assert.match(payloads.operations.loop.lootFlowCards?.[0]?.value || "", /MISSION TERMINAL|CONTRACT SEQUENCE|CLAIM/i);
  assert.equal(payloads.operations.loop.lootFlowBlocks?.length, 3);
  assert.equal(payloads.operations.loop.lootFlowPanels?.length, 3);
  assert.equal(payloads.operations.loop.lootFlowPanels?.[0]?.title, "OFFER");
  assert.equal(payloads.operations.loop.lootFlowPanels?.[1]?.title, "STATE");
  assert.equal(payloads.operations.loop.lootFlowPanels?.[2]?.title, "REVEAL");
  assert.equal(payloads.operations.loop.lootFlowPanels?.[0]?.focus_key, "mission_quarter:loot:claim_flow");
  assert.equal(payloads.operations.loop.lootFlowPanels?.[0]?.entry_kind_key, "world_entry_kind_claim_terminal");
  assert.equal(payloads.operations.loop.lootFlowPanels?.[0]?.sequence_kind_key, "world_modal_kind_contract_sequence");
  assert.equal(payloads.operations.loop.lootRiskCards?.length, 4);
  assert.equal(payloads.operations.loop.lootRiskCards?.[0]?.title, "HEALTH");
  assert.equal(payloads.operations.loop.lootRiskCards?.[1]?.title, "ATTN");
  assert.equal(payloads.operations.loop.lootRiskCards?.[2]?.title, "TREND");
  assert.equal(payloads.operations.loop.lootRiskCards?.[3]?.title, "MICRO");
  assert.equal(payloads.operations.loop.lootRiskBlocks?.length, 3);
  assert.equal(payloads.operations.loop.lootRiskBlocks?.[0]?.title, "HEALTH");
  assert.equal(payloads.operations.loop.lootRiskBlocks?.[1]?.title, "ATTN");
  assert.equal(payloads.operations.loop.lootRiskBlocks?.[2]?.title, "TREND");
  assert.equal(payloads.operations.loop.lootRiskPanels?.length, 3);
  assert.equal(payloads.operations.loop.lootRiskPanels?.[0]?.title, "HEALTH");
  assert.equal(payloads.operations.loop.lootRiskPanels?.[1]?.title, "ATTN");
  assert.equal(payloads.operations.loop.lootRiskPanels?.[2]?.title, "TREND");
  assert.match(payloads.operations.loop.lootRiskPanels?.[0]?.lines?.[0] || "", /READY|WATCH|HEALTH/i);
  assert.match(payloads.operations.loop.lootRiskPanels?.[2]?.lines?.[3] || "", /MICRO CLAIM FLOW \| POD CLAIM POD/i);
  assert.match(payloads.operations.loop.lootRiskPanels?.[2]?.lines?.[4] || "", /HEALTH .*ATTN .*TREND /i);
  assert.match(
    payloads.operations.loop.lootRiskPanels?.[2]?.lines?.[6] || "",
    /^RFK mission_quarter:loot:claim_flow\|[a-z_]+:[a-z_]+:[a-z_]+$/i
  );
  assert.equal(payloads.operations.loop.lootFlowCards?.[2]?.title, "RISK");
  assert.equal(payloads.operations.loop.lootFlowBlocks?.[2]?.title, "RISK");
  assert.match(payloads.operations.loop.lootFlowPanels?.[2]?.lines?.[3] || "", /HEALTH .*ATTN .*TREND /i);
  assert.match(
    payloads.operations.loop.lootFlowPanels?.[2]?.lines?.[5] || "",
    /^RFK mission_quarter:loot:claim_flow\|[a-z_]+:[a-z_]+:[a-z_]+$/i
  );
  assert.equal(payloads.operations.loop.lootSubflowCards?.length, 3);
  assert.equal(payloads.operations.loop.lootSubflowCards?.[0]?.title, "OFFER");
  assert.equal(payloads.operations.loop.lootSubflowBlocks?.length, 3);
  assert.equal(payloads.operations.loop.lootSubflowBlocks?.[0]?.title, "OFFER");
  assert.equal(payloads.operations.loop.lootSubflowPanels?.length, 3);
  assert.equal(payloads.operations.loop.lootSubflowPanels?.[0]?.title, "OFFER");
  assert.equal(payloads.operations.loop.lootSubflowPanels?.[1]?.title, "STATE");
  assert.equal(payloads.operations.loop.lootSubflowPanels?.[2]?.title, "REVEAL");
  assert.match(payloads.operations.loop.lootSubflowPanels?.[2]?.lines?.[3] || "", /HEALTH .*ATTN .*TREND /i);
  assert.match(
    payloads.operations.loop.lootSubflowPanels?.[2]?.lines?.[5] || "",
    /^RFK mission_quarter:loot:claim_flow\|[a-z_]+:[a-z_]+:[a-z_]+$/i
  );
  assert.equal(payloads.operations.loop.lootBlocks?.length, 3);
  assert.equal(payloads.operations.loop.lootBlocks?.[0]?.title, "FLOW");
  assert.match(payloads.operations.loop.lootBlocks?.[0]?.summary || "", /READY|WATCH|FLOW/i);
});

test("buildAdminBridgePayloads produces runtime, asset and audit cards from admin state", async () => {
  const mod = await loadModule();
  const payloads = mod.buildAdminBridgePayloads({
    mutators: createMutators(),
    adminRuntime: {
      summary: {
        feature_flags: { WEBAPP_REACT_V1_ENABLED: true, LIVE_OPS_CHAT_ENABLED: true },
        runtime_flags: { source_mode: "db" }
      },
      queue: [{ request_id: "pay_1" }, { request_id: "tok_2" }]
    },
    adminPanels: {
      deploy_status: { bundle_mode: "react_only" },
      runtime_bot: { latest: { state_key: "running", lock_acquired: true } },
      metrics: {
        scene_loop_district_family_attention_priority_7d: [
          {
            district_key: "exchange_district",
            loop_family_key: "wallet",
            focus_key: "exchange_district:wallet_link:wallet",
            flow_key: "wallet_link:wallet",
            risk_key: "red:alert:no_data",
            risk_focus_key: "exchange_district:wallet_link:wallet|red:alert:no_data",
            latest_health_band: "red",
            attention_band: "alert",
            trend_direction: "no_data",
            priority_score: 3500,
            contract_ready: true,
            risk_context: {
              family_key: "wallet",
              microflow_key: "wallet",
              flow_key: "wallet_link:wallet",
              focus_key: "exchange_district:wallet_link:wallet",
              risk_key: "red:alert:no_data",
              risk_focus_key: "exchange_district:wallet_link:wallet|red:alert:no_data",
              risk_health_band_key: "red",
              risk_attention_band_key: "alert",
              risk_trend_direction_key: "no_data",
              risk_context_signature:
                "wallet_link:wallet|exchange_district:wallet_link:wallet|red:alert:no_data|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal",
              contract_ready: true
            },
            action_context: {
              family_key: "wallet",
              microflow_key: "wallet",
              flow_key: "wallet_link:wallet",
              focus_key: "exchange_district:wallet_link:wallet",
              entry_kind_key: "world_entry_kind_wallet_terminal",
              sequence_kind_key: "world_modal_kind_wallet_terminal",
              action_context_signature:
                "wallet_link:wallet|exchange_district:wallet_link:wallet|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal"
            }
          },
          {
            district_key: "arena_prime",
            loop_family_key: "duel",
            focus_key: "arena_prime:duel_sync:duel",
            flow_key: "duel_sync:duel",
            risk_key: "yellow:watch:improving",
            risk_focus_key: "arena_prime:duel_sync:duel|yellow:watch:improving",
            latest_health_band: "yellow",
            attention_band: "watch",
            trend_direction: "improving",
            priority_score: 2100,
            contract_ready: true,
            risk_context: {
              family_key: "duel",
              microflow_key: "duel",
              flow_key: "duel_sync:duel",
              focus_key: "arena_prime:duel_sync:duel",
              risk_key: "yellow:watch:improving",
              risk_focus_key: "arena_prime:duel_sync:duel|yellow:watch:improving",
              risk_health_band_key: "yellow",
              risk_attention_band_key: "watch",
              risk_trend_direction_key: "improving",
              risk_context_signature:
                "duel_sync:duel|arena_prime:duel_sync:duel|yellow:watch:improving|world_entry_kind_duel_console|world_modal_kind_duel_sequence",
              contract_ready: true
            },
            action_context: {
              family_key: "duel",
              microflow_key: "duel",
              flow_key: "duel_sync:duel",
              focus_key: "arena_prime:duel_sync:duel",
              entry_kind_key: "world_entry_kind_duel_console",
              sequence_kind_key: "world_modal_kind_duel_sequence",
              action_context_signature:
                "duel_sync:duel|arena_prime:duel_sync:duel|world_entry_kind_duel_console|world_modal_kind_duel_sequence"
            }
          }
        ],
        scene_loop_district_microflow_risk_priority_7d: [
          {
            district_key: "exchange_district",
            loop_family_key: "wallet_link",
            loop_microflow_key: "wallet",
            focus_key: "exchange_district:wallet_link:wallet",
            flow_key: "wallet_link:wallet",
            risk_key: "red:alert:no_data",
            risk_focus_key: "exchange_district:wallet_link:wallet|red:alert:no_data",
            risk_health_band_key: "red",
            risk_attention_band_key: "alert",
            risk_trend_direction_key: "no_data",
            priority_score: 3500,
            contract_ready: true,
            risk_context: {
              family_key: "wallet_link",
              microflow_key: "wallet",
              flow_key: "wallet_link:wallet",
              focus_key: "exchange_district:wallet_link:wallet",
              risk_key: "red:alert:no_data",
              risk_focus_key: "exchange_district:wallet_link:wallet|red:alert:no_data",
              risk_health_band_key: "red",
              risk_attention_band_key: "alert",
              risk_trend_direction_key: "no_data",
              risk_context_signature:
                "wallet_link:wallet|exchange_district:wallet_link:wallet|red:alert:no_data|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal",
              contract_ready: true
            },
            action_context: {
              family_key: "wallet_link",
              microflow_key: "wallet",
              flow_key: "wallet_link:wallet",
              focus_key: "exchange_district:wallet_link:wallet",
              entry_kind_key: "world_entry_kind_wallet_terminal",
              sequence_kind_key: "world_modal_kind_wallet_terminal",
              action_context_signature:
                "wallet_link:wallet|exchange_district:wallet_link:wallet|world_entry_kind_wallet_terminal|world_modal_kind_wallet_terminal"
            }
          },
          {
            district_key: "arena_prime",
            loop_family_key: "duel_sync",
            loop_microflow_key: "duel",
            focus_key: "arena_prime:duel_sync:duel",
            flow_key: "duel_sync:duel",
            risk_key: "yellow:watch:improving",
            risk_focus_key: "arena_prime:duel_sync:duel|yellow:watch:improving",
            risk_health_band_key: "yellow",
            risk_attention_band_key: "watch",
            risk_trend_direction_key: "improving",
            priority_score: 2100,
            contract_ready: true,
            risk_context: {
              family_key: "duel_sync",
              microflow_key: "duel",
              flow_key: "duel_sync:duel",
              focus_key: "arena_prime:duel_sync:duel",
              risk_key: "yellow:watch:improving",
              risk_focus_key: "arena_prime:duel_sync:duel|yellow:watch:improving",
              risk_health_band_key: "yellow",
              risk_attention_band_key: "watch",
              risk_trend_direction_key: "improving",
              risk_context_signature:
                "duel_sync:duel|arena_prime:duel_sync:duel|yellow:watch:improving|world_entry_kind_duel_console|world_modal_kind_duel_sequence",
              contract_ready: true
            },
            action_context: {
              family_key: "duel_sync",
              microflow_key: "duel",
              flow_key: "duel_sync:duel",
              focus_key: "arena_prime:duel_sync:duel",
              entry_kind_key: "world_entry_kind_duel_console",
              sequence_kind_key: "world_modal_kind_duel_sequence",
              action_context_signature:
                "duel_sync:duel|arena_prime:duel_sync:duel|world_entry_kind_duel_console|world_modal_kind_duel_sequence"
            }
          }
        ],
        scene_loop_district_microflow_risk_priority_daily_7d: [
          {
            day: "2099-03-10",
            district_key: "exchange_district",
            loop_family_key: "wallet_link",
            loop_microflow_key: "wallet",
            focus_key: "exchange_district:wallet_link:wallet",
            flow_key: "wallet_link:wallet",
            risk_key: "red:alert:no_data",
            risk_focus_key: "exchange_district:wallet_link:wallet|red:alert:no_data",
            risk_health_band_key: "red",
            risk_attention_band_key: "alert",
            risk_trend_direction_key: "no_data",
            priority_score: 3500,
            contract_ready: true,
            risk_context: {
              family_key: "wallet_link",
              microflow_key: "wallet",
              flow_key: "wallet_link:wallet",
              focus_key: "exchange_district:wallet_link:wallet",
              risk_key: "red:alert:no_data",
              risk_focus_key: "exchange_district:wallet_link:wallet|red:alert:no_data",
              risk_health_band_key: "red",
              risk_attention_band_key: "alert",
              risk_trend_direction_key: "no_data",
              contract_ready: true
            }
          },
          {
            day: "2099-03-10",
            district_key: "arena_prime",
            loop_family_key: "duel_sync",
            loop_microflow_key: "duel",
            focus_key: "arena_prime:duel_sync:duel",
            flow_key: "duel_sync:duel",
            risk_key: "yellow:watch:improving",
            risk_focus_key: "arena_prime:duel_sync:duel|yellow:watch:improving",
            risk_health_band_key: "yellow",
            risk_attention_band_key: "watch",
            risk_trend_direction_key: "improving",
            priority_score: 2100,
            contract_ready: true,
            risk_context: {
              family_key: "duel_sync",
              microflow_key: "duel",
              flow_key: "duel_sync:duel",
              focus_key: "arena_prime:duel_sync:duel",
              risk_key: "yellow:watch:improving",
              risk_focus_key: "arena_prime:duel_sync:duel|yellow:watch:improving",
              risk_health_band_key: "yellow",
              risk_attention_band_key: "watch",
              risk_trend_direction_key: "improving",
              contract_ready: true
            }
          }
        ]
      },
      assets: {
        summary: { ready_assets: 3, total_assets: 4, missing_assets: 1, integrity_ratio: 0.75 },
        active_manifest: { manifest_revision: "rev_42", updated_at: "2099-03-10T12:00:00.000Z" },
        local_manifest: {
          webapp_domain_summary: {
            host: "webapp.k99-exchange.xyz",
            state_key: "ready",
            dns_ready: true,
            contract_ready: true,
            health_status_code: 200,
            webapp_status_code: 200,
            cname_targets: ["airdropkral-admin.onrender.com"],
            a_records: ["216.24.57.7", "216.24.57.251"],
            public_url: "https://webapp.k99-exchange.xyz/webapp",
            runtime_guard_base_url: "https://webapp.k99-exchange.xyz",
            runtime_guard_matches_host: true
          },
          selected_bundle_summary: { selected_count: 2, downloaded_count: 2, district_count: 2, verified_at: "2099-03-10" },
          selected_bundle_rows: [
            {
              district_key: "arena_prime",
              family_key: "duel",
              asset_key: "arena_trophy",
              file_name: "arena-trophy.glb",
              candidate_key: "arena_khronos_cesium_man",
              provider_label: "Khronos glTF Sample Models"
            },
            {
              district_key: "exchange_district",
              family_key: "wallet",
              asset_key: "exchange_artifact",
              file_name: "exchange-artifact.glb",
              candidate_key: "exchange_khronos_damaged_helmet",
              provider_label: "Khronos glTF Sample Models"
            }
          ],
          district_bundle_summary: { district_count: 2, ready_count: 1, partial_count: 1, intake_ready_count: 0 },
          district_bundle_rows: [
            {
              district_key: "arena_prime",
              state_key: "ready",
              bundle_ready_count: 3,
              bundle_asset_count: 3,
              candidate_count: 2,
              ingest_modes: ["direct_gltf"],
            },
            {
              district_key: "exchange_district",
              state_key: "partial",
              bundle_ready_count: 1,
              bundle_asset_count: 2,
              candidate_count: 2,
              ingest_modes: ["convert_to_glb"],
            }
          ],
          district_family_asset_summary: { row_count: 2, family_count: 2, ready_count: 1, partial_count: 1, intake_ready_count: 0 },
          district_family_asset_variation_summary: { row_count: 2, family_count: 2, variant_count: 2, ready_count: 2, partial_count: 0, missing_count: 0 },
          district_family_asset_focus_summary: { row_count: 2, contract_ready_count: 1, ready_count: 1, partial_count: 1, missing_count: 0 },
          district_family_asset_variation_focus_summary: { row_count: 2, contract_ready_count: 2, ready_count: 2, partial_count: 0, missing_count: 0 },
          district_family_asset_runtime_summary: {
            row_count: 2,
            contract_ready_count: 1,
            domain_ready_count: 2,
            guard_match_count: 2,
            ready_count: 1,
            partial_count: 1,
            missing_count: 0
          },
          district_family_asset_variation_runtime_summary: {
            row_count: 2,
            contract_ready_count: 2,
            domain_ready_count: 2,
            guard_match_count: 2,
            ready_count: 2,
            partial_count: 0,
            missing_count: 0
          },
          district_family_asset_rows: [
            {
              district_key: "arena_prime",
              family_key: "duel",
              asset_key: "arena_trophy",
              focus_key: "arena_prime:duel:arena_trophy",
              state_key: "ready",
              file_name: "arena-trophy.glb",
              candidate_key: "arena_khronos_cesium_man",
              provider_label: "Khronos glTF Sample Models"
            },
            {
              district_key: "exchange_district",
              family_key: "wallet",
              asset_key: "exchange_artifact",
              focus_key: "exchange_district:wallet:exchange_artifact",
              state_key: "partial",
              file_name: "exchange-artifact.glb",
              candidate_key: "exchange_khronos_damaged_helmet",
              provider_label: "Khronos glTF Sample Models"
            }
          ],
          district_family_asset_variation_rows: [
            {
              district_key: "arena_prime",
              family_key: "ladder",
              asset_key: "arena_scout",
              variant_key: "arena_ladder_scout",
              variant_role: "support",
              focus_key: "arena_prime:ladder:arena_ladder_scout",
              state_key: "ready",
              file_name: "arena-scout.glb",
              candidate_key: "arena_khronos_buggy_scout",
              provider_label: "Khronos glTF Sample Models"
            },
            {
              district_key: "exchange_district",
              family_key: "premium",
              asset_key: "exchange_vial",
              variant_key: "exchange_premium_vial",
              variant_role: "ambient",
              focus_key: "exchange_district:premium:exchange_premium_vial",
              state_key: "ready",
              file_name: "exchange-vial.glb",
              candidate_key: "exchange_khronos_waterbottle_vial",
              provider_label: "Khronos glTF Sample Models"
            }
          ],
          district_family_asset_focus_rows: [
            {
              district_key: "exchange_district",
              family_key: "wallet",
              asset_key: "exchange_artifact",
              focus_key: "exchange_district:wallet:exchange_artifact",
              state_key: "partial",
              file_name: "exchange-artifact.glb",
              asset_contract_signature: "exchange_district:wallet:exchange_artifact|partial|exchange_khronos_damaged_helmet"
            },
            {
              district_key: "arena_prime",
              family_key: "duel",
              asset_key: "arena_trophy",
              focus_key: "arena_prime:duel:arena_trophy",
              state_key: "ready",
              file_name: "arena-trophy.glb",
              asset_contract_signature: "arena_prime:duel:arena_trophy|ready|arena_khronos_cesium_man"
            }
          ],
          district_family_asset_variation_focus_rows: [
            {
              district_key: "arena_prime",
              family_key: "ladder",
              asset_key: "arena_scout",
              variant_key: "arena_ladder_scout",
              variant_role: "support",
              focus_key: "arena_prime:ladder:arena_ladder_scout",
              state_key: "ready",
              file_name: "arena-scout.glb",
              asset_contract_signature: "arena_prime:ladder:arena_ladder_scout|ready|arena_khronos_buggy_scout"
            },
            {
              district_key: "exchange_district",
              family_key: "premium",
              asset_key: "exchange_vial",
              variant_key: "exchange_premium_vial",
              variant_role: "ambient",
              focus_key: "exchange_district:premium:exchange_premium_vial",
              state_key: "ready",
              file_name: "exchange-vial.glb",
              asset_contract_signature: "exchange_district:premium:exchange_premium_vial|ready|exchange_khronos_waterbottle_vial"
            }
          ],
          district_family_asset_runtime_rows: [
            {
              district_key: "exchange_district",
              family_key: "wallet",
              asset_key: "exchange_artifact",
              focus_key: "exchange_district:wallet:exchange_artifact",
              state_key: "partial",
              runtime_state_key: "partial",
              file_name: "exchange-artifact.glb",
              domain_state_key: "ready",
              runtime_contract_ready: false,
              runtime_contract_signature:
                "exchange_district:wallet:exchange_artifact|partial|ready|guard_match|exchange_khronos_damaged_helmet",
              asset_contract_signature: "exchange_district:wallet:exchange_artifact|partial|exchange_khronos_damaged_helmet"
            },
            {
              district_key: "arena_prime",
              family_key: "duel",
              asset_key: "arena_trophy",
              focus_key: "arena_prime:duel:arena_trophy",
              state_key: "ready",
              runtime_state_key: "ready",
              file_name: "arena-trophy.glb",
              domain_state_key: "ready",
              runtime_contract_ready: true,
              runtime_contract_signature: "arena_prime:duel:arena_trophy|ready|ready|guard_match|arena_khronos_cesium_man",
              asset_contract_signature: "arena_prime:duel:arena_trophy|ready|arena_khronos_cesium_man"
            }
          ],
          district_family_asset_variation_runtime_rows: [
            {
              district_key: "arena_prime",
              family_key: "ladder",
              asset_key: "arena_scout",
              variant_key: "arena_ladder_scout",
              variant_role: "support",
              focus_key: "arena_prime:ladder:arena_ladder_scout",
              state_key: "ready",
              runtime_state_key: "ready",
              file_name: "arena-scout.glb",
              domain_state_key: "ready",
              runtime_contract_ready: true,
              runtime_contract_signature: "arena_prime:ladder:arena_ladder_scout|ready|ready|guard_match|arena_khronos_buggy_scout",
              asset_contract_signature: "arena_prime:ladder:arena_ladder_scout|ready|arena_khronos_buggy_scout"
            },
            {
              district_key: "exchange_district",
              family_key: "premium",
              asset_key: "exchange_vial",
              variant_key: "exchange_premium_vial",
              variant_role: "ambient",
              focus_key: "exchange_district:premium:exchange_premium_vial",
              state_key: "ready",
              runtime_state_key: "ready",
              file_name: "exchange-vial.glb",
              domain_state_key: "ready",
              runtime_contract_ready: true,
              runtime_contract_signature: "exchange_district:premium:exchange_premium_vial|ready|ready|guard_match|exchange_khronos_waterbottle_vial",
              asset_contract_signature: "exchange_district:premium:exchange_premium_vial|ready|exchange_khronos_waterbottle_vial"
            }
          ],
          rows: [
            { asset_key: "hub.glb", relative_path: "assets/hub.glb", mode: "runtime", exists: true },
            { asset_key: "vault.glb", relative_path: "assets/vault.glb", mode: "runtime", exists: false }
          ]
        }
      },
      audit_phase_status: { phase_status: "partial", bundle_mode: "react_only", flag_source_mode: "db" },
      audit_data_integrity: {
        runtime_flags: { source_mode: "db" },
        truth_map: {
          webapp_ui: { status: "pass", bundle_mode: "react_only" },
          scene_assets: { status: "mixed" },
          treasury: { status: "partial" },
          bot_runtime: { status: "degraded" }
        }
      }
    },
    scene: {
      selectedLoop: {
        districtKey: "ops_citadel",
        entryKindKey: "world_entry_kind_dispatch_console",
        sequenceKindKey: "world_modal_kind_dispatch_sequence",
        microflowKey: "dispatch_flow",
        loopStatusKey: "watch",
        loopStatusLabelKey: "loop_status_watch",
        loopStageValue: "ALERT",
        loopRows: [
          { label_key: "world_sheet_metric_liveops_sent", value: "12", status_key: "live" },
          { label_key: "world_sheet_metric_alerts", value: "3", status_key: "watch" },
          { label_key: "world_sheet_metric_scene_health", value: "WATCH", status_key: "watch" }
        ],
        loopSignalRows: [{ label_key: "world_sheet_metric_queue_depth", value: "2", status_key: "live" }],
        sequenceRows: [{ label_key: "world_sheet_metric_liveops_sent", value: "12", status_key: "live" }]
      }
    }
  });

  assert.match(payloads.runtime.lineText, /Queue 2/);
  assert.match(payloads.runtime.loopLineText, /OPS STANDBY|OPS LOOP/);
  assert.match(payloads.runtime.loopHintText, /Scene loop focus|ARENA PRIME|DISPATCH CONSOLE|DISPATCH SEQUENCE/i);
  assert.match(payloads.runtime.loopFocusText, /OPS CITADEL|DISPATCH FLOW|DISPATCH CONSOLE/i);
  assert.match(payloads.runtime.loopOpsLineText, /WATCH|ALERT|DISPATCH/i);
  assert.match(payloads.runtime.loopOpsHintText, /DISPATCH CONSOLE|DISPATCH SEQUENCE|DISPATCH FLOW/i);
  assert.match(payloads.runtime.loopSequenceText, /LIVEOPS SENT 12/i);
  assert.match(payloads.runtime.loopStateText, /WATCH|ALERT|DISPATCH CONSOLE/i);
  assert.match(payloads.runtime.loopDetailText, /LIVEOPS SENT 12|ALERTS 3|SCENE HEALTH WATCH/i);
  assert.match(payloads.runtime.loopSignalText, /QUEUE DEPTH 2/i);
  assert.match(payloads.runtime.loopQueueText, /QUEUE 2 \| WATCH/i);
  assert.match(payloads.runtime.loopRuntimeText, /RUNTIME WATCH \| ALERT 3/i);
  assert.match(payloads.runtime.loopDispatchText, /DISPATCH 12 \| ALERT/i);
  assert.equal(payloads.runtime.loopQueueTone, "pressure");
  assert.equal(payloads.runtime.loopRuntimeTone, "pressure");
  assert.match(payloads.runtime.loopQueueFocusText, /ENTRY DISPATCH CONSOLE \| FOCUS 2 \| FLOW DISPATCH FLOW/i);
  assert.match(payloads.runtime.loopQueueFocusText, /KEY ops_citadel:queue:dispatch_flow/i);
  assert.match(payloads.runtime.loopRuntimeFocusText, /SEQ DISPATCH SEQUENCE \| FOCUS WATCH \| ALERT 3/i);
  assert.match(payloads.runtime.loopDispatchStageText, /STAGE ALERT \| STATUS WATCH \| SENT 12/i);
  assert.match(payloads.runtime.loopQueueStateText, /FLOW DISPATCH FLOW \| ENTRY DISPATCH CONSOLE \| QUEUE 2/i);
  assert.match(payloads.runtime.loopRuntimeStateText, /FLOW DISPATCH FLOW \| SEQ DISPATCH SEQUENCE \| HEALTH WATCH/i);
  assert.match(payloads.runtime.loopDispatchStateText, /FLOW DISPATCH FLOW \| STAGE ALERT \| SENT 12/i);
  assert.match(payloads.runtime.loopQueueOpsText, /ENTRY DISPATCH CONSOLE \| QUEUE 2 \| FLOW WATCH/i);
  assert.match(payloads.runtime.loopRuntimeOpsText, /SEQ DISPATCH SEQUENCE \| HEALTH WATCH \| ALERT 3/i);
  assert.match(payloads.runtime.loopDispatchOpsText, /ENTRY DISPATCH CONSOLE \| SENT 12 \| STAGE ALERT/i);
  assert.match(payloads.runtime.loopQueueSignalText, /QUEUE 2 \| FLOW DISPATCH FLOW \| ENTRY DISPATCH CONSOLE/i);
  assert.match(payloads.runtime.loopRuntimeSignalText, /HEALTH WATCH \| ALERT 3 \| FLOW DISPATCH FLOW/i);
  assert.match(payloads.runtime.loopDispatchSignalText, /SENT 12 \| STAGE ALERT \| FLOW DISPATCH FLOW/i);
  assert.match(payloads.runtime.loopQueueDetailText, /DEPTH 2 \| FLOW WATCH \| DISPATCH FLOW/i);
  assert.match(payloads.runtime.loopRuntimeDetailText, /HEALTH WATCH \| ALERT 3 \| DISPATCH SEQUENCE/i);
  assert.match(payloads.runtime.loopDispatchDetailText, /SENT 12 \| STAGE ALERT \| DISPATCH CONSOLE/i);
  assert.match(payloads.runtime.loopDispatchFamilyText, /FLOW DISPATCH FLOW \| STATUS WATCH \| ALERT 3/i);
  assert.match(payloads.runtime.loopDispatchFlowText, /ENTRY DISPATCH CONSOLE \| SEQ DISPATCH SEQUENCE \| SENT 12/i);
  assert.match(payloads.runtime.loopDispatchSummaryText, /FLOW DISPATCH FLOW \| STATUS WATCH \| ALERT 3/i);
  assert.match(payloads.runtime.loopDispatchGateText, /SENT 12 \| STAGE ALERT \| ENTRY DISPATCH CONSOLE/i);
  assert.match(payloads.runtime.loopDispatchLeadText, /ENTRY DISPATCH CONSOLE \| FLOW DISPATCH FLOW \| DISPATCH SEQUENCE/i);
  assert.match(payloads.runtime.loopDispatchWindowText, /SENT 12 \| ALERT 3 \| HEALTH WATCH/i);
  assert.match(payloads.runtime.loopDispatchPressureText, /ALERT 3 \| HEALTH WATCH \| QUEUE 2/i);
  assert.match(payloads.runtime.loopDispatchMicroflowText, /MICRO DISPATCH FLOW \| POD --/i);
  assert.match(payloads.runtime.loopDispatchResponseText, /SENT 12 \| FLOW WATCH \| ENTRY DISPATCH CONSOLE/i);
  assert.match(payloads.runtime.loopDispatchAttentionText, /ALERT 3 \| SENT 12 \| STAGE ALERT/i);
  assert.match(payloads.runtime.loopDispatchCadenceText, /ENTRY DISPATCH CONSOLE \| FLOW DISPATCH FLOW \| SENT 12/i);
  assert.match(payloads.runtime.loopQueueFamilyText, /FLOW DISPATCH FLOW \| STATUS WATCH \| QUEUE 2/i);
  assert.match(payloads.runtime.loopQueueFlowText, /ENTRY DISPATCH CONSOLE \| FLOW DISPATCH FLOW \| SEQ DISPATCH SEQUENCE/i);
  assert.match(payloads.runtime.loopQueueSummaryText, /QUEUE 2 \| STATUS WATCH \| FLOW DISPATCH FLOW/i);
  assert.match(payloads.runtime.loopQueueGateText, /QUEUE 2 \| ENTRY DISPATCH CONSOLE \| STATUS WATCH/i);
  assert.match(payloads.runtime.loopQueueLeadText, /ENTRY DISPATCH CONSOLE \| FLOW DISPATCH FLOW \| QUEUE 2/i);
  assert.match(payloads.runtime.loopQueueWindowText, /QUEUE 2 \| STATUS WATCH \| HEALTH WATCH/i);
  assert.match(payloads.runtime.loopQueuePressureText, /QUEUE 2 \| ALERT 3 \| HEALTH WATCH/i);
  assert.match(payloads.runtime.loopQueueResponseText, /QUEUE 2 \| FLOW WATCH \| ENTRY DISPATCH CONSOLE/i);
  assert.match(payloads.runtime.loopQueueAttentionText, /QUEUE 2 \| ALERT 3 \| FLOW DISPATCH FLOW/i);
  assert.match(payloads.runtime.loopQueueCadenceText, /ENTRY DISPATCH CONSOLE \| FLOW DISPATCH FLOW \| QUEUE 2/i);
  assert.equal(payloads.runtime.loopQueueFlowCards?.length, 3);
  assert.equal(payloads.runtime.loopQueueFlowBlocks?.length, 3);
  assert.equal(payloads.runtime.loopQueueFlowPanels?.length, 3);
  assert.equal(payloads.runtime.loopQueueFlowPanels?.[0]?.title, "QUEUE");
  assert.match(payloads.runtime.loopQueueFlowCards?.[0]?.hint || "", /FOCUS ops_citadel:queue:dispatch_flow/i);
  assert.equal(payloads.runtime.loopQueueFlowPanels?.[1]?.title, "STATUS");
  assert.equal(payloads.runtime.loopQueueFlowPanels?.[2]?.title, "REVIEW");
  assert.equal(payloads.runtime.loopQueueRiskCards?.length, 4);
  assert.equal(payloads.runtime.loopQueueRiskCards?.[0]?.title, "HEALTH");
  assert.equal(payloads.runtime.loopQueueRiskCards?.[3]?.title, "MICRO");
  assert.equal(payloads.runtime.loopQueueRiskBlocks?.length, 3);
  assert.equal(payloads.runtime.loopQueueRiskBlocks?.[2]?.title, "TREND");
  assert.equal(payloads.runtime.loopQueueRiskPanels?.length, 3);
  assert.equal(payloads.runtime.loopQueueRiskPanels?.[1]?.title, "ATTN");
  assert.match(payloads.runtime.loopQueueRiskPanels?.[2]?.lines?.[3] || "", /MICRO DISPATCH FLOW \| POD --/i);
  assert.match(payloads.runtime.loopQueueRiskPanels?.[2]?.lines?.[4] || "", /HEALTH .*ATTN .*TREND /i);
  assert.match(payloads.runtime.loopQueueRiskPanels?.[2]?.lines?.[5] || "", /^RISK [a-z_]+:[a-z_]+:[a-z_]+$/i);
  assert.equal(payloads.runtime.loopQueueSubflowCards?.length, 3);
  assert.equal(payloads.runtime.loopQueueSubflowCards?.[0]?.title, "QUEUE");
  assert.equal(payloads.runtime.loopQueueSubflowBlocks?.length, 3);
  assert.equal(payloads.runtime.loopQueueSubflowBlocks?.[0]?.title, "QUEUE");
  assert.equal(payloads.runtime.loopQueueSubflowPanels?.length, 3);
  assert.equal(payloads.runtime.loopQueueSubflowPanels?.[0]?.title, "QUEUE");
  assert.equal(payloads.runtime.loopQueueSubflowPanels?.[1]?.title, "STATUS");
  assert.equal(payloads.runtime.loopQueueSubflowPanels?.[2]?.title, "REVIEW");
  assert.match(payloads.runtime.loopRuntimeFamilyText, /FLOW DISPATCH FLOW \| STATUS WATCH \| HEALTH WATCH/i);
  assert.match(payloads.runtime.loopRuntimeFlowText, /SEQ DISPATCH SEQUENCE \| FLOW DISPATCH FLOW \| ALERT 3/i);
  assert.match(payloads.runtime.loopRuntimeSummaryText, /HEALTH WATCH \| ALERT 3 \| FLOW DISPATCH FLOW/i);
  assert.match(payloads.runtime.loopRuntimeGateText, /HEALTH WATCH \| ENTRY DISPATCH CONSOLE \| STATUS WATCH/i);
  assert.match(payloads.runtime.loopRuntimeLeadText, /SEQ DISPATCH SEQUENCE \| FLOW DISPATCH FLOW \| HEALTH WATCH/i);
  assert.match(payloads.runtime.loopRuntimeWindowText, /HEALTH WATCH \| ALERT 3 \| STATUS WATCH/i);
  assert.match(payloads.runtime.loopRuntimePressureText, /HEALTH WATCH \| ALERT 3 \| QUEUE 2/i);
  assert.match(payloads.runtime.loopRuntimeResponseText, /HEALTH WATCH \| FLOW WATCH \| SEQ DISPATCH SEQUENCE/i);
  assert.match(payloads.runtime.loopRuntimeAttentionText, /HEALTH WATCH \| ALERT 3 \| FLOW DISPATCH FLOW/i);
  assert.match(payloads.runtime.loopRuntimeCadenceText, /SEQ DISPATCH SEQUENCE \| FLOW DISPATCH FLOW \| HEALTH WATCH/i);
  assert.equal(payloads.runtime.loopRuntimeFlowCards?.length, 3);
  assert.equal(payloads.runtime.loopRuntimeFlowBlocks?.length, 3);
  assert.equal(payloads.runtime.loopRuntimeFlowPanels?.length, 3);
  assert.equal(payloads.runtime.loopRuntimeFlowPanels?.[0]?.title, "RUNTIME");
  assert.equal(payloads.runtime.loopRuntimeFlowPanels?.[1]?.title, "STATUS");
  assert.equal(payloads.runtime.loopRuntimeFlowPanels?.[2]?.title, "HEALTH");
  assert.equal(payloads.runtime.loopRuntimeRiskCards?.length, 4);
  assert.equal(payloads.runtime.loopRuntimeRiskCards?.[0]?.title, "HEALTH");
  assert.equal(payloads.runtime.loopRuntimeRiskCards?.[3]?.title, "MICRO");
  assert.equal(payloads.runtime.loopRuntimeRiskBlocks?.length, 3);
  assert.equal(payloads.runtime.loopRuntimeRiskBlocks?.[1]?.title, "ATTN");
  assert.equal(payloads.runtime.loopRuntimeRiskPanels?.length, 3);
  assert.equal(payloads.runtime.loopRuntimeRiskPanels?.[2]?.title, "TREND");
  assert.match(payloads.runtime.loopRuntimeRiskPanels?.[2]?.lines?.[3] || "", /MICRO DISPATCH FLOW \| POD --/i);
  assert.match(payloads.runtime.loopRuntimeRiskPanels?.[2]?.lines?.[4] || "", /HEALTH .*ATTN .*TREND /i);
  assert.match(payloads.runtime.loopRuntimeRiskPanels?.[2]?.lines?.[5] || "", /^RISK [a-z_]+:[a-z_]+:[a-z_]+$/i);
  assert.equal(payloads.runtime.loopRuntimeSubflowCards?.length, 3);
  assert.equal(payloads.runtime.loopRuntimeSubflowCards?.[0]?.title, "RUNTIME");
  assert.equal(payloads.runtime.loopRuntimeSubflowBlocks?.length, 3);
  assert.equal(payloads.runtime.loopRuntimeSubflowBlocks?.[0]?.title, "RUNTIME");
  assert.equal(payloads.runtime.loopRuntimeSubflowPanels?.length, 3);
  assert.equal(payloads.runtime.loopRuntimeSubflowPanels?.[0]?.title, "RUNTIME");
  assert.equal(payloads.runtime.loopRuntimeSubflowPanels?.[1]?.title, "STATUS");
  assert.equal(payloads.runtime.loopRuntimeSubflowPanels?.[2]?.title, "HEALTH");
  assert.equal(payloads.runtime.loopDispatchCards?.length, 3);
  assert.equal(payloads.runtime.loopDispatchCards?.[0]?.title, "SENT");
  assert.match(payloads.runtime.loopDispatchCards?.[0]?.value || "", /12|ALERT/i);
  assert.equal(payloads.runtime.loopDispatchFlowCards?.length, 3);
  assert.equal(payloads.runtime.loopDispatchFlowCards?.[0]?.title, "QUEUE");
  assert.match(payloads.runtime.loopDispatchFlowCards?.[0]?.value || "", /DISPATCH CONSOLE|DISPATCH FLOW/i);
  assert.equal(payloads.runtime.loopDispatchFlowCards?.[0]?.focus_key, "ops_citadel:queue:dispatch_flow");
  assert.equal(payloads.runtime.loopDispatchFlowCards?.[0]?.flow_key, "queue:dispatch_flow");
  assert.equal(payloads.runtime.loopDispatchFlowCards?.[0]?.entry_kind_key, "world_entry_kind_dispatch_console");
  assert.equal(payloads.runtime.loopDispatchFlowCards?.[0]?.sequence_kind_key, "world_modal_kind_dispatch_sequence");
  assert.equal(payloads.runtime.loopDispatchFlowCards?.[0]?.risk_health_band_key, "red");
  assert.equal(payloads.runtime.loopDispatchFlowCards?.[0]?.risk_attention_band_key, "alert");
  assert.equal(payloads.runtime.loopDispatchFlowCards?.[0]?.risk_trend_direction_key, "degrading");
  assert.match(
    payloads.runtime.loopDispatchFlowCards?.[0]?.risk_focus_key || "",
    /^ops_citadel:queue:dispatch_flow\|[a-z_]+:[a-z_]+:[a-z_]+$/i
  );
  assert.equal(payloads.runtime.loopDispatchFlowCards?.[0]?.risk_context?.flow_key, "queue:dispatch_flow");
  assert.equal(payloads.runtime.loopDispatchFlowCards?.[0]?.risk_context?.focus_key, "ops_citadel:queue:dispatch_flow");
  assert.equal(
    payloads.runtime.loopDispatchFlowCards?.[0]?.risk_context?.entry_kind_key,
    "world_entry_kind_dispatch_console"
  );
  assert.equal(
    payloads.runtime.loopDispatchFlowCards?.[0]?.risk_context?.sequence_kind_key,
    "world_modal_kind_dispatch_sequence"
  );
  assert.equal(
    payloads.runtime.loopDispatchFlowCards?.[0]?.action_context_signature,
    "queue:dispatch_flow|ops_citadel:queue:dispatch_flow|world_entry_kind_dispatch_console|world_modal_kind_dispatch_sequence"
  );
  assert.equal(
    payloads.runtime.loopDispatchFlowCards?.[0]?.action_context?.action_context_signature,
    "queue:dispatch_flow|ops_citadel:queue:dispatch_flow|world_entry_kind_dispatch_console|world_modal_kind_dispatch_sequence"
  );
  assert.equal(
    payloads.runtime.loopDispatchFlowCards?.[0]?.risk_context_signature,
    "queue:dispatch_flow|ops_citadel:queue:dispatch_flow|red:alert:degrading|world_entry_kind_dispatch_console|world_modal_kind_dispatch_sequence"
  );
  assert.equal(
    payloads.runtime.loopDispatchFlowCards?.[0]?.risk_context?.risk_context_signature,
    "queue:dispatch_flow|ops_citadel:queue:dispatch_flow|red:alert:degrading|world_entry_kind_dispatch_console|world_modal_kind_dispatch_sequence"
  );
  assert.equal(payloads.runtime.loopDispatchFlowCards?.[0]?.contract_state_key, "ready");
  assert.equal(payloads.runtime.loopDispatchFlowBlocks?.length, 3);
  assert.equal(payloads.runtime.loopDispatchFlowPanels?.length, 3);
  assert.equal(payloads.runtime.loopDispatchFlowPanels?.[0]?.title, "QUEUE");
  assert.equal(payloads.runtime.loopDispatchFlowPanels?.[1]?.title, "HEALTH");
  assert.equal(payloads.runtime.loopDispatchFlowPanels?.[2]?.title, "RELEASE");
  assert.equal(payloads.runtime.loopDispatchRiskCards?.length, 4);
  assert.equal(payloads.runtime.loopDispatchRiskCards?.[0]?.title, "HEALTH");
  assert.equal(payloads.runtime.loopDispatchRiskCards?.[1]?.title, "ATTN");
  assert.equal(payloads.runtime.loopDispatchRiskCards?.[2]?.title, "TREND");
  assert.equal(payloads.runtime.loopDispatchRiskCards?.[3]?.title, "MICRO");
  assert.equal(payloads.runtime.loopDispatchRiskBlocks?.length, 3);
  assert.equal(payloads.runtime.loopDispatchRiskBlocks?.[0]?.title, "HEALTH");
  assert.equal(payloads.runtime.loopDispatchRiskBlocks?.[1]?.title, "ATTN");
  assert.equal(payloads.runtime.loopDispatchRiskBlocks?.[2]?.title, "TREND");
  assert.equal(payloads.runtime.loopDispatchRiskPanels?.length, 3);
  assert.equal(payloads.runtime.loopDispatchRiskPanels?.[0]?.title, "HEALTH");
  assert.equal(payloads.runtime.loopDispatchRiskPanels?.[1]?.title, "ATTN");
  assert.equal(payloads.runtime.loopDispatchRiskPanels?.[2]?.title, "TREND");
  assert.match(
    payloads.runtime.loopDispatchRiskPanels?.[0]?.lines?.[0] || "",
    /SENT 12|ALERT|WATCH|HEALTH|ENTRY DISPATCH CONSOLE/i,
  );
  assert.match(payloads.runtime.loopDispatchRiskPanels?.[2]?.lines?.[3] || "", /MICRO DISPATCH FLOW \| POD --/i);
  assert.match(payloads.runtime.loopDispatchRiskPanels?.[2]?.lines?.[4] || "", /HB [A-Z_]+ \| ATTN [A-Z_]+ \| TREND [A-Z_]+/i);
  assert.match(payloads.runtime.loopDispatchRiskPanels?.[2]?.lines?.[4] || "", /HEALTH .*ATTN .*TREND /i);
  assert.match(payloads.runtime.loopDispatchRiskPanels?.[2]?.lines?.[5] || "", /^RISK [a-z_]+:[a-z_]+:[a-z_]+$/i);
  assert.match(
    payloads.runtime.loopDispatchRiskPanels?.[2]?.lines?.[6] || "",
    /^RFK ops_citadel:queue:dispatch_flow\|[a-z_]+:[a-z_]+:[a-z_]+$/i
  );
  assert.match(
    payloads.runtime.loopDispatchRiskCards?.[3]?.hint || "",
    /FOCUS ops_citadel:queue:dispatch_flow \| RISK [a-z_]+:[a-z_]+:[a-z_]+/i
  );
  assert.match(payloads.runtime.loopDispatchFlowPanels?.[1]?.lines?.[1] || "", /HEALTH WATCH|FLOW DISPATCH FLOW|ENTRY DISPATCH CONSOLE/i);
  assert.match(payloads.runtime.loopDispatchFlowPanels?.[2]?.lines?.[1] || "", /HEALTH WATCH|ALERT 3|FLOW DISPATCH FLOW/i);
  assert.match(payloads.runtime.loopDispatchFlowPanels?.[2]?.lines?.[2] || "", /SEQ DISPATCH SEQUENCE|FLOW DISPATCH FLOW|HEALTH WATCH/i);
  assert.match(payloads.runtime.loopDispatchFlowPanels?.[2]?.lines?.[3] || "", /HEALTH .*ATTN .*TREND /i);
  assert.match(
    payloads.runtime.loopDispatchFlowPanels?.[2]?.lines?.[5] || "",
    /^RFK ops_citadel:queue:dispatch_flow\|[a-z_]+:[a-z_]+:[a-z_]+$/i
  );
  assert.equal(payloads.runtime.loopDispatchFlowCards?.[2]?.title, "RISK");
  assert.equal(payloads.runtime.loopDispatchFlowBlocks?.[2]?.title, "RISK");
  assert.equal(payloads.runtime.loopDispatchSubflowCards?.length, 3);
  assert.equal(payloads.runtime.loopDispatchSubflowCards?.[0]?.title, "QUEUE");
  assert.equal(payloads.runtime.loopDispatchSubflowBlocks?.length, 3);
  assert.equal(payloads.runtime.loopDispatchSubflowBlocks?.[0]?.title, "QUEUE");
  assert.equal(payloads.runtime.loopDispatchSubflowPanels?.length, 3);
  assert.equal(payloads.runtime.loopDispatchSubflowPanels?.[0]?.title, "QUEUE");
  assert.equal(payloads.runtime.loopDispatchSubflowPanels?.[1]?.title, "HEALTH");
  assert.equal(payloads.runtime.loopDispatchSubflowPanels?.[2]?.title, "RELEASE");
  assert.match(payloads.runtime.loopDispatchSubflowPanels?.[1]?.lines?.[1] || "", /HEALTH WATCH|FLOW DISPATCH FLOW|ENTRY DISPATCH CONSOLE/i);
  assert.match(payloads.runtime.loopDispatchSubflowPanels?.[1]?.lines?.[2] || "", /HEALTH WATCH|ALERT 3|FLOW DISPATCH FLOW/i);
  assert.match(payloads.runtime.loopDispatchSubflowPanels?.[2]?.lines?.[2] || "", /HB [A-Z_]+ \| ATTN [A-Z_]+ \| TREND [A-Z_]+/i);
  assert.match(payloads.runtime.loopDispatchSubflowPanels?.[2]?.lines?.[3] || "", /HEALTH .*ATTN .*TREND /i);
  assert.match(
    payloads.runtime.loopDispatchSubflowPanels?.[2]?.lines?.[5] || "",
    /^RFK ops_citadel:queue:dispatch_flow\|[a-z_]+:[a-z_]+:[a-z_]+$/i
  );
  assert.match(
    payloads.runtime.loopDispatchSubflowPanels?.[2]?.lines?.[6] || "",
    /^FAMILY queue \| MICRO dispatch_flow \| FLOW queue:dispatch_flow \| ENTRY world_entry_kind_dispatch_console \| SEQ world_modal_kind_dispatch_sequence(?: \| ASSET .+)?$/i
  );
  assert.equal(payloads.runtime.loopDispatchBlocks?.length, 3);
  assert.equal(payloads.runtime.loopDispatchBlocks?.[0]?.title, "FLOW");
  assert.match(payloads.runtime.loopDispatchBlocks?.[0]?.summary || "", /WATCH|ALERT|FLOW/i);
  assert.equal(payloads.assetStatus.rows.length, 8);
  assert.equal(payloads.assetStatus.rows[0].title, "exchange_district:wallet:exchange_artifact");
  assert.match(
    payloads.assetStatus.rows[0].meta,
    /HB RED \| ATTN ALERT \| TREND NO_DATA \| exchange_district:wallet:exchange_artifact\|partial\|ready\|guard_match\|exchange_khronos_damaged_helmet\|exchange_district:wallet_link:wallet\|red:alert:no_data/i
  );
  assert.equal(payloads.assetStatus.rows[1].title, "arena_prime:duel:arena_trophy");
  assert.equal(
    payloads.assetRuntime.signalLineText,
    "Ready 75% | Integrity 75% | Bundles 1/2 | Family 1/2 | Focus 1/2 | Runtime 1/2 | Variation 2/2 | VRuntime 2/2 | Risk 1/2 | Micro 1/2 | Daily 1/2"
  );
  assert.equal(
    payloads.assetRuntime.selectionLineText,
    "SELECT exchange_district:wallet:exchange_artifact:wallet:partial | arena_prime:duel:arena_trophy:duel:ready | VAR arena_prime:ladder:arena_ladder_scout:ready | exchange_district:premium:exchange_premium_vial:ready"
  );
  assert.equal(
    payloads.assetRuntime.domainLineText,
    "DOMAIN webapp.k99-exchange.xyz | READY | HEALTH 200 | WEBAPP 200 | TARGET airdropkral-admin.onrender.com"
  );
  assert.equal(
    payloads.assetRuntime.riskLineText,
    "RISK arena_prime:duel:arena_trophy | MICRO duel | yellow:watch:improving | DAY 2099-03-10 | FLOW duel_sync:duel | arena_prime:duel:arena_trophy|ready|ready|guard_match|arena_khronos_cesium_man|arena_prime:duel_sync:duel|yellow:watch:improving|duel_sync:duel|microflow:duel"
  );
  assert.equal(
    payloads.assetRuntime.focusLineText,
    "FOCUS arena_prime:duel:arena_trophy | ready | HOST ready | arena_prime:duel:arena_trophy|ready|ready|guard_match|arena_khronos_cesium_man"
  );
  assert.equal(payloads.assetRuntime.chips.length, 8);
  assert.equal(payloads.assetRuntime.chips[2].text, "DIST 1/2");
  assert.equal(payloads.assetRuntime.chips[3].text, "FOCUS 1/2");
  assert.equal(payloads.assetRuntime.chips[4].text, "VAR 2/2");
  assert.equal(payloads.assetRuntime.chips[5].text, "RISK 1/2");
  assert.equal(payloads.assetRuntime.chips[6].text, "HOST READY");
  assert.equal(payloads.auditRuntime.phaseChipText, "PHASE PARTIAL");
  assert.equal(payloads.auditRuntime.chips.length, 4);
});

test("buildPlayerBridgePayloads carries variation asset contracts into player scene and loop risk views", async () => {
  const mod = await loadModule();
  const payloads = mod.buildPlayerBridgePayloads({
    mutators: createMutators(),
    data: {
      asset_manifest: {
        available: true,
        active_revision: { manifest_revision: "rev_var_1", source: "cdn" },
        entries: [
          { asset_key: "arena_ladder_scout.glb", exists_local: true, integrity_status: "ok" },
          { asset_key: "arena_trophy.glb", exists_local: true, integrity_status: "ok" }
        ],
        summary: { total_assets: 2, ready_assets: 2, missing_assets: 0, integrity_ratio: 1 }
      },
      local_manifest: {
        webapp_domain_summary: {
          host: "webapp.k99-exchange.xyz",
          state_key: "ready",
          dns_ready: true,
          contract_ready: true,
          runtime_guard_matches_host: true,
          webapp_status_code: 200
        }
      }
    },
    scene: {
      hudDensity: "normal",
      capabilityProfile: { perf_tier: "high", fps_avg: 60 },
      selectedLoop: {
        districtKey: "arena_prime",
        protocolCardKey: "ladder_protocol",
        protocolPodKey: "ladder_pod",
        microflowKey: "ladder_flow",
        familyKey: "ladder",
        flowKey: "ladder:ladder_flow",
        focusKey: "arena_prime:ladder:ladder_flow",
        riskKey: "green:watch:stable",
        riskFocusKey: "arena_prime:ladder:ladder_flow|green:watch:stable",
        activeAssetKey: "arena_ladder_scout",
        activeAssetFamilyKey: "ladder",
        activeAssetAnchorKind: "cluster",
        activeAssetBundleKind: "variation",
        activeAssetVariantKey: "arena_ladder_scout",
        activeAssetVariantRole: "support",
        activeAssetVariantTier: "secondary",
        activeAssetCandidateKey: "arena_khronos_buggy_scout",
        activeAssetStateKey: "ready",
        activeAssetContractReady: true,
        activeAssetContractSignature: "arena_prime:ladder:arena_ladder_scout|ready|arena_khronos_buggy_scout",
        readyAssetCount: 2,
        selectedAssetCount: 2,
        loadedAssetCount: 2,
        entryKindKey: "world_entry_kind_ladder_console",
        sequenceKindKey: "world_modal_kind_ladder_sequence",
        loopStatusKey: "watch",
        loopStatusLabelKey: "loop_status_watch",
        loopStageValue: "review",
        loopRows: [{ label_key: "world_sheet_metric_ladder_rank", value: "8", status_key: "watch" }],
        loopSignalRows: [{ label_key: "world_sheet_metric_ladder_charge", value: "62", status_key: "watch" }],
        sequenceRows: [{ label_key: "world_sheet_metric_ladder_tick", value: "48", status_key: "live" }]
      }
    },
    sceneRuntime: {
      lowEndMode: false,
      effectiveQuality: "high"
    },
    pvpRuntime: {},
    leagueOverview: {},
    pvpLive: {},
    vaultData: {}
  });

  assert.equal(payloads.sceneStatus.assetBundleKind, "variation");
  assert.equal(payloads.sceneStatus.assetVariantKey, "arena_ladder_scout");
  assert.equal(payloads.sceneStatus.assetVariantRole, "support");
  assert.equal(payloads.sceneStatus.assetVariantTier, "secondary");
  assert.match(payloads.sceneStatus.assetLine || "", /variation\/support\/secondary/i);
  assert.equal(payloads.publicTelemetry.assetManifest.assetBundleKind, "variation");
  assert.equal(payloads.publicTelemetry.assetManifest.assetVariantKey, "arena_ladder_scout");
  assert.match(payloads.publicTelemetry.assetManifest.selectionLineText || "", /variation\/support\/secondary/i);
  assert.equal(payloads.combatHud.loopLadderRiskCards?.[0]?.asset_bundle_kind, "variation");
  assert.equal(payloads.combatHud.loopLadderRiskCards?.[0]?.asset_variant_key, "arena_ladder_scout");
  assert.equal(
    payloads.combatHud.loopLadderRiskCards?.[0]?.asset_contract_signature,
    "arena_prime:ladder:arena_ladder_scout|ready|arena_khronos_buggy_scout"
  );
  assert.match(
    (payloads.combatHud.loopLadderRiskPanels?.[0]?.lines || []).join(" | "),
    /ASSET ladder:arena_ladder_scout/i
  );
  assert.match(
    (payloads.combatHud.loopLadderRiskPanels?.[0]?.lines || []).join(" | "),
    /BUNDLE variation/i
  );
});
