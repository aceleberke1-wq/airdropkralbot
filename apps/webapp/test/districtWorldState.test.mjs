import test from "node:test";
import assert from "node:assert/strict";
import { buildDistrictWorldState } from "../src/core/runtime/districtWorldState.js";
import { SHELL_ACTION_KEY } from "../../../packages/shared/src/shellActionCatalog.js";

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
  assert.equal(state.nodes[0].action_key, SHELL_ACTION_KEY.PLAYER_SEASON_HALL);
  assert.equal(state.nodes[1].key, "mission_lane");
  assert.equal(state.nodes[2].metric, "LIVE");
  assert.equal(state.nodes[2].action_key, SHELL_ACTION_KEY.PLAYER_WALLET_CONNECT);
  assert.equal(state.district_theme_key, "central_hub");
  assert.equal(state.active_node_key, "season_arc");
  assert.equal(state.camera_profile_key, "hub_glide");
  assert.equal(state.hud_profile_key, "central_hub");
  assert.equal(state.active_hotspot_key, "season_gate");
  assert.equal(state.active_hotspot_hint_key, "world_hotspot_hint_travel");
  assert.equal(state.actors.length, 3);
  assert.deepEqual(
    state.actors.map((actor) => actor.kind),
    ["gate", "gate", "arch"]
  );
  assert.deepEqual(
    state.hotspots.map((hotspot) => hotspot.key),
    ["season_gate", "mission_desk", "wallet_port"]
  );
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
  assert.equal(state.nodes[0].action_key, SHELL_ACTION_KEY.PLAYER_PVP_DAILY_DUEL);
  assert.equal(state.district_theme_key, "arena_prime");
  assert.equal(state.camera_profile_key, "arena_focus");
  assert.equal(state.hud_profile_key, "arena_prime");
  assert.deepEqual(
    state.actors.map((actor) => actor.kind),
    ["blade_tower", "blade_tower", "arch", "spine"]
  );
  assert.deepEqual(
    state.hotspots.map((hotspot) => hotspot.key),
    ["duel_pit", "ladder_bridge", "diagnostics_rail"]
  );
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
  assert.equal(state.nodes[0].action_key, SHELL_ACTION_KEY.ADMIN_QUEUE_PANEL);
  assert.equal(state.nodes[1].status_key, "warn");
  assert.equal(state.district_theme_key, "ops_citadel");
  assert.equal(state.camera_profile_key, "ops_overwatch");
  assert.equal(state.hud_profile_key, "ops_citadel");
  assert.deepEqual(
    state.actors.map((actor) => actor.kind),
    ["watchtower", "watchtower", "array", "spine"]
  );
  assert.deepEqual(
    state.hotspots.map((hotspot) => hotspot.key),
    ["queue_gate", "runtime_dais", "liveops_table"]
  );
});

test("buildDistrictWorldState marks active node from navigation context shell action", () => {
  const state = buildDistrictWorldState({
    workspace: "player",
    tab: "vault",
    scene: {
      effectiveQuality: "medium",
      capabilityProfile: {
        scene_profile: "balanced"
      }
    },
    navigationContext: {
      shell_action_key: SHELL_ACTION_KEY.PLAYER_PAYOUT_REQUEST
    },
    vaultData: {
      wallet_session: { active: true },
      payout_status: { state: "ready", readiness_pct: 82 },
      monetization_status: { premium_active: false },
      route_status: { state: "ready", coverage_pct: 61 }
    }
  });

  assert.equal(state.active_node_key, "payout_lift");
  assert.equal(state.active_action_key, SHELL_ACTION_KEY.PLAYER_PAYOUT_REQUEST);
  assert.equal(state.active_node_label_key, "world_node_payout_lift");
  assert.equal(state.active_hotspot_key, "payout_bay");
  assert.equal(state.active_hotspot_label_key, "world_hotspot_payout_bay");
  assert.equal(state.active_hotspot_hint_key, "world_hotspot_hint_payout");
  assert.equal(state.camera_profile.radius, state.camera_radius);
  assert.equal(state.nodes.find((node) => node.key === "payout_lift")?.is_active, true);
  assert.equal(state.hotspots.find((hotspot) => hotspot.key === "payout_bay")?.is_active, true);
  assert.deepEqual(
    state.actors.map((actor) => actor.kind),
    ["vault", "vault", "rail", "arch"]
  );
});
