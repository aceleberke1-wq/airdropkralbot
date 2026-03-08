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
      capabilityProfile: { perf_tier: "high", fps_avg: 60 }
    },
    sceneRuntime: {
      lowEndMode: false,
      effectiveQuality: "high"
    }
  });

  assert.equal(payloads.sceneStatus.profileLine, "Profile online");
  assert.equal(payloads.sceneTelemetry.alarm.badgeText, "SCENE WARN");
  assert.equal(payloads.publicTelemetry.assetManifest.badgeText, "ASSET 3/4");
  assert.equal(payloads.publicTelemetry.pvpLeaderboard.badgeText, "TOP 2");
  assert.equal(payloads.pvpDirector.cinematic.phaseBadgeText, "ACTIVE");
  assert.equal(payloads.pvpRejectIntel.badge.text, "REJ TIMEOUT");
  assert.equal(payloads.pvpEvents.timelineRows.length, 6);
  assert.equal(payloads.pvpDuel.tick.live, true);
  assert.equal(payloads.combatHud.timelineBadgeText, "ACTIVE");
  assert.equal(payloads.combatHud.chainTrail.length, 3);
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
  assert.equal(payloads.tokenOverview.statusChips[1].text, "PAY OPEN");
  assert.equal(payloads.tokenTreasury.route.badgeText, "ROUTE 2/3");
  assert.equal(payloads.tokenTreasury.actionDirector.badgeText, "SUBMIT");
  assert.match(payloads.tokenTreasury.pulse.gateLineText, /0.001230 BTC/);
  assert.equal(payloads.tokenTreasury.txLifecycle.rows.at(-1).chip, "PASS");
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
    }
  });

  assert.match(payloads.runtime.lineText, /Queue 2/);
  assert.equal(payloads.assetStatus.rows.length, 2);
  assert.equal(payloads.assetRuntime.signalLineText, "Ready 75% | Integrity 75% | Missing 1");
  assert.equal(payloads.auditRuntime.phaseChipText, "PHASE PARTIAL");
  assert.equal(payloads.auditRuntime.chips.length, 4);
});
