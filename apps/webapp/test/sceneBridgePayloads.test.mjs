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
  assert.equal(payloads.sceneTelemetry.alarm.badgeText, "SCENE WARN");
  assert.equal(payloads.publicTelemetry.assetManifest.badgeText, "ASSET 3/4");
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
  assert.match(payloads.combatHud.loopDuelResponseText, /PHASE ENGAGE \| FLOW ACTIVE \| ENTRY DUEL CONSOLE/i);
  assert.match(payloads.combatHud.loopDuelAttentionText, /RISK WATCH \| QUEUE 3 \| PHASE ENGAGE/i);
  assert.match(payloads.combatHud.loopDuelCadenceText, /ENTRY DUEL CONSOLE \| FLOW DUEL FLOW \| PERSONA (WORLD )?PERSONALITY ASSAULT/i);
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
  assert.match(payloads.tokenOverview.loopWalletResponseText, /PAYOUT OPEN \| FLOW LIVE \| ENTRY PAYOUT TERMINAL/i);
  assert.match(payloads.tokenOverview.loopWalletAttentionText, /STATE APPROVED \| ENTRY PAYOUT TERMINAL \| FLOW LIVE/i);
  assert.match(payloads.tokenOverview.loopWalletCadenceText, /ENTRY PAYOUT TERMINAL \| FLOW PAYOUT FLOW \| PERSONA STABLE ROUTE/i);
  assert.match(payloads.tokenOverview.loopPayoutDetailText, /PAYOUT OPEN \| ROUTE 2\/3 \| PAYOUT ROUTE/i);
  assert.match(payloads.tokenOverview.loopRouteDetailText, /ROUTE 2\/3 \| WALLET APPROVED \| STABLE ROUTE/i);
  assert.match(payloads.tokenOverview.loopPremiumDetailText, /PASS ACTIVE \| STAGE SUBMIT \| PAYOUT TERMINAL/i);
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
  assert.match(payloads.operations.loop.lootResponseText, /STREAK 7d \| FLOW READY \| ENTRY CLAIM TERMINAL/i);
  assert.match(payloads.operations.loop.lootAttentionText, /CLAIM 2 READY \| BAND WATCH \| ENTRY CLAIM TERMINAL/i);
  assert.match(payloads.operations.loop.lootCadenceText, /ENTRY CLAIM TERMINAL \| FLOW CLAIM FLOW \| CLAIM 2 READY/i);
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
      assets: {
        summary: { ready_assets: 3, total_assets: 4, missing_assets: 1, integrity_ratio: 0.75 },
        active_manifest: { manifest_revision: "rev_42", updated_at: "2099-03-10T12:00:00.000Z" },
        local_manifest: {
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
  assert.match(payloads.runtime.loopDispatchResponseText, /SENT 12 \| FLOW WATCH \| ENTRY DISPATCH CONSOLE/i);
  assert.match(payloads.runtime.loopDispatchAttentionText, /ALERT 3 \| SENT 12 \| STAGE ALERT/i);
  assert.match(payloads.runtime.loopDispatchCadenceText, /ENTRY DISPATCH CONSOLE \| FLOW DISPATCH FLOW \| SENT 12/i);
  assert.equal(payloads.assetStatus.rows.length, 2);
  assert.equal(payloads.assetRuntime.signalLineText, "Ready 75% | Integrity 75% | Missing 1");
  assert.equal(payloads.auditRuntime.phaseChipText, "PHASE PARTIAL");
  assert.equal(payloads.auditRuntime.chips.length, 4);
});
