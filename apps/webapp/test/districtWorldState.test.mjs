import test from "node:test";
import assert from "node:assert/strict";
import { buildDistrictWorldState } from "../src/core/runtime/districtWorldState.js";

test("buildDistrictWorldState maps player home into central hub beacons", () => {
  const state = buildDistrictWorldState({
    workspace: "player",
    tab: "home",
    scene: {
      effectiveQuality: "high",
      capabilityProfile: {
        scene_profile: "cinematic"
      }
    },
    homeFeed: {
      season: { progress_pct: 62 },
      mission: { active_count: 3 },
      wallet_quick: { linked: true },
      risk: { band: "stable", score_pct: 21 },
      command_hint: [{ command_key: "play" }]
    }
  });

  assert.equal(state.district_key, "central_hub");
  assert.equal(state.mode_label_key, "world_scene_mode_cinematic");
  assert.equal(state.beacon_count, 4);
  assert.equal(state.nodes[0].key, "season_arc");
  assert.equal(state.nodes[1].key, "mission_lane");
  assert.equal(state.nodes[2].metric, "LIVE");
});

test("buildDistrictWorldState trims pvp nodes on low-end profile", () => {
  const state = buildDistrictWorldState({
    workspace: "player",
    tab: "pvp",
    scene: {
      effectiveQuality: "low",
      reducedMotion: true,
      capabilityProfile: {
        low_end_mode: true,
        scene_profile: "lite"
      }
    },
    pvpRuntime: {
      phase: "strike",
      tempo_pct: 84
    },
    leagueOverview: {
      daily_duel: { phase: "live" },
      weekly_ladder: { completion_pct: 78 }
    },
    pvpLive: {
      diagnostics: { category: "clean" },
      tick: { tempo_ms: 420 }
    }
  });

  assert.equal(state.district_key, "arena_prime");
  assert.equal(state.low_end_mode, true);
  assert.equal(state.beacon_count, 3);
  assert.equal(state.mode_label_key, "world_scene_mode_lite");
  assert.equal(state.nodes[0].key, "duel_core");
});

test("buildDistrictWorldState maps admin runtime into ops citadel", () => {
  const state = buildDistrictWorldState({
    workspace: "admin",
    tab: "home",
    scene: {
      effectiveQuality: "medium",
      capabilityProfile: {
        scene_profile: "balanced"
      }
    },
    adminRuntime: {
      summary: {
        scene_runtime_health_band_24h: "watch",
        live_ops_sent_24h: 12,
        ops_alert_raised_24h: 2
      },
      queue: [{ id: 1 }, { id: 2 }, { id: 3 }]
    }
  });

  assert.equal(state.district_key, "ops_citadel");
  assert.equal(state.beacon_count, 4);
  assert.equal(state.nodes[0].metric, "3");
  assert.equal(state.nodes[1].status_key, "warn");
});
