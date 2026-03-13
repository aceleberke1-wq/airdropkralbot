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
  assert.equal(state.hud_density, "normal");
  assert.equal(state.hud_profile.density_label_key, "world_hud_density_expanded");
  assert.equal(state.director_profile_key, "hub_vector");
  assert.equal(state.director_profile.pace_label_key, "world_director_pace_hub");
  assert.equal(state.rail_profile_key, "central_hub");
  assert.equal(state.rail_profile.rail_label_key, "world_rail_label_central_hub");
  assert.equal(state.active_hotspot_key, "season_gate");
  assert.equal(state.active_hotspot_hint_key, "world_hotspot_hint_travel");
  assert.equal(state.active_hotspot_intent_profile_key, "travel_primary");
  assert.equal(state.active_hotspot_intent_label_key, "world_intent_travel");
  assert.equal(state.nodes[0].family_key, "travel");
  assert.equal(state.nodes[0].flow_key, "travel_flow");
  assert.equal(state.nodes[0].microflow_key, "world_modal_lane_season_arc:travel");
  assert.equal(state.nodes[0].focus_key, "central_hub:travel:travel_flow");
  assert.equal(state.nodes[0].risk_key, "green:stable:flat");
  assert.equal(state.nodes[0].risk_focus_key, "central_hub:travel:travel_flow|green:stable:flat");
  assert.equal(state.nodes[0].entry_kind_key, "world_entry_kind_hub_portal");
  assert.equal(state.nodes[0].sequence_kind_key, "world_modal_kind_travel_gate");
  assert.equal(state.nodes[0].action_context?.focus_key, "central_hub:travel:travel_flow");
  assert.equal(state.nodes[0].risk_context?.risk_focus_key, "central_hub:travel:travel_flow|green:stable:flat");
  assert.equal(
    state.nodes[0].action_context_signature,
    "travel_flow|central_hub:travel:travel_flow|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(
    state.nodes[0].risk_context_signature,
    "travel_flow|central_hub:travel:travel_flow|green:stable:flat|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(state.hotspots[0].family_key, "travel");
  assert.equal(state.hotspots[0].flow_key, "travel_flow");
  assert.equal(state.hotspots[0].microflow_key, "world_modal_lane_season_arc:travel");
  assert.equal(state.hotspots[0].focus_key, "central_hub:travel:travel_flow");
  assert.equal(state.hotspots[0].risk_key, "green:stable:flat");
  assert.equal(state.hotspots[0].risk_focus_key, "central_hub:travel:travel_flow|green:stable:flat");
  assert.equal(state.hotspots[0].entry_kind_key, "world_entry_kind_hub_portal");
  assert.equal(state.hotspots[0].sequence_kind_key, "world_modal_kind_travel_gate");
  assert.equal(state.hotspots[0].action_context?.focus_key, "central_hub:travel:travel_flow");
  assert.equal(state.hotspots[0].risk_context?.risk_focus_key, "central_hub:travel:travel_flow|green:stable:flat");
  assert.equal(
    state.hotspots[0].action_context_signature,
    "travel_flow|central_hub:travel:travel_flow|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(
    state.hotspots[0].risk_context_signature,
    "travel_flow|central_hub:travel:travel_flow|green:stable:flat|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(state.interaction_sheet.title_key, "world_hotspot_season_gate");
  assert.equal(state.interaction_sheet.rows.length, 4);
  assert.equal(state.interaction_sheet.rows[0].label_key, "world_sheet_metric_progress");
  assert.equal(state.interaction_sheet.family_key, "travel");
  assert.equal(state.interaction_sheet.flow_key, "travel_flow");
  assert.equal(state.interaction_sheet.focus_key, "central_hub:travel:travel_flow");
  assert.equal(state.interaction_sheet.risk_focus_key, "central_hub:travel:travel_flow|green:stable:flat");
  assert.equal(state.interaction_sheet.entry_kind_key, "world_entry_kind_hub_portal");
  assert.equal(state.interaction_sheet.sequence_kind_key, "world_modal_kind_travel_gate");
  assert.equal(state.interaction_sheet.action_context?.district_key, "central_hub");
  assert.equal(state.interaction_sheet.action_context?.focus_key, "central_hub:travel:travel_flow");
  assert.equal(state.interaction_sheet.action_context?.risk_focus_key, "central_hub:travel:travel_flow|green:stable:flat");
  assert.equal(
    state.interaction_sheet.action_context_signature,
    "travel_flow|central_hub:travel:travel_flow|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(
    state.interaction_sheet.risk_context_signature,
    "travel_flow|central_hub:travel:travel_flow|green:stable:flat|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(state.interaction_surface.surface_kind_key, "world_surface_kind_travel_portal");
  assert.equal(state.interaction_surface.hero_label_key, "world_sheet_metric_progress");
  assert.equal(state.interaction_surface.family_key, "travel");
  assert.equal(state.interaction_surface.flow_key, "travel_flow");
  assert.equal(state.interaction_surface.focus_key, "central_hub:travel:travel_flow");
  assert.equal(state.interaction_surface.risk_focus_key, "central_hub:travel:travel_flow|green:stable:flat");
  assert.equal(state.interaction_surface.entry_kind_key, "world_entry_kind_hub_portal");
  assert.equal(state.interaction_surface.sequence_kind_key, "world_modal_kind_travel_gate");
  assert.equal(state.interaction_surface.action_context?.district_key, "central_hub");
  assert.equal(state.interaction_surface.action_context?.focus_key, "central_hub:travel:travel_flow");
  assert.equal(
    state.interaction_surface.action_context?.risk_focus_key,
    "central_hub:travel:travel_flow|green:stable:flat"
  );
  assert.equal(
    state.interaction_surface.action_context_signature,
    "travel_flow|central_hub:travel:travel_flow|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(
    state.interaction_surface.action_context?.action_context_signature,
    "travel_flow|central_hub:travel:travel_flow|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(state.interaction_surface.risk_context?.district_key, "central_hub");
  assert.equal(state.interaction_surface.risk_context?.focus_key, "central_hub:travel:travel_flow");
  assert.equal(
    state.interaction_surface.risk_context?.risk_focus_key,
    "central_hub:travel:travel_flow|green:stable:flat"
  );
  assert.equal(state.interaction_surface.risk_context?.entry_kind_key, "world_entry_kind_hub_portal");
  assert.equal(state.interaction_surface.risk_context?.sequence_kind_key, "world_modal_kind_travel_gate");
  assert.equal(
    state.interaction_surface.risk_context_signature,
    "travel_flow|central_hub:travel:travel_flow|green:stable:flat|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(
    state.interaction_surface.risk_context?.risk_context_signature,
    "travel_flow|central_hub:travel:travel_flow|green:stable:flat|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(state.interaction_surface.contract_ready, true);
  assert.deepEqual(state.interaction_surface.contract_missing_keys, []);
  assert.equal(state.interaction_surface.action_context?.contract_ready, true);
  assert.deepEqual(state.interaction_surface.action_context?.contract_missing_keys, []);
  assert.equal(state.interaction_surface.risk_context?.contract_ready, true);
  assert.deepEqual(state.interaction_surface.risk_context?.contract_missing_keys, []);
  assert.equal(state.interaction_surface.action_items[0].action_key, SHELL_ACTION_KEY.PLAYER_SEASON_HALL);
  assert.equal(state.interaction_surface.action_items[0].family_key, "travel");
  assert.equal(state.interaction_surface.action_items[0].flow_key, "travel_flow");
  assert.equal(state.interaction_surface.action_items[0].microflow_key, "world_modal_lane_season_arc:travel");
  assert.equal(state.interaction_surface.action_items[0].focus_key, "central_hub:travel:travel_flow");
  assert.equal(state.interaction_surface.action_items[0].contract_ready, true);
  assert.deepEqual(state.interaction_surface.action_items[0].contract_missing_keys, []);
  assert.equal(state.interaction_surface.action_items[0].action_context?.contract_ready, true);
  assert.deepEqual(state.interaction_surface.action_items[0].action_context?.contract_missing_keys, []);
  assert.equal(state.interaction_surface.action_items[0].risk_context?.contract_ready, true);
  assert.deepEqual(state.interaction_surface.action_items[0].risk_context?.contract_missing_keys, []);
  assert.equal(
    state.interaction_surface.action_items[0].risk_focus_key,
    "central_hub:travel:travel_flow|green:stable:flat"
  );
  assert.equal(state.interaction_flow.flow_kind_key, "world_flow_kind_travel");
  assert.equal(state.interaction_flow.stage_value_key, "world_flow_state_live");
  assert.equal(state.interaction_flow.family_key, "travel");
  assert.equal(state.interaction_flow.flow_key, "travel_flow");
  assert.equal(state.interaction_flow.focus_key, "central_hub:travel:travel_flow");
  assert.equal(state.interaction_flow.risk_focus_key, "central_hub:travel:travel_flow|green:stable:flat");
  assert.equal(state.interaction_flow.entry_kind_key, "world_entry_kind_hub_portal");
  assert.equal(state.interaction_flow.sequence_kind_key, "world_modal_kind_travel_gate");
  assert.equal(
    state.interaction_flow.action_context_signature,
    "travel_flow|central_hub:travel:travel_flow|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(
    state.interaction_flow.action_context?.action_context_signature,
    "travel_flow|central_hub:travel:travel_flow|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(
    state.interaction_flow.risk_context_signature,
    "travel_flow|central_hub:travel:travel_flow|green:stable:flat|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(
    state.interaction_flow.risk_context?.risk_context_signature,
    "travel_flow|central_hub:travel:travel_flow|green:stable:flat|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(state.interaction_flow.contract_ready, true);
  assert.deepEqual(state.interaction_flow.contract_missing_keys, []);
  assert.equal(state.interaction_flow.step_rows[0].label_key, "world_sheet_metric_progress");
  assert.equal(state.interaction_entry.entry_kind_key, "world_entry_kind_hub_portal");
  assert.equal(state.interaction_entry.status_label_key, "world_flow_state_ready");
  assert.equal(state.interaction_entry.family_key, "travel");
  assert.equal(state.interaction_entry.flow_key, "travel_flow");
  assert.equal(state.interaction_entry.focus_key, "central_hub:travel:travel_flow");
  assert.equal(state.interaction_entry.risk_focus_key, "central_hub:travel:travel_flow|green:stable:flat");
  assert.equal(state.interaction_entry.sequence_kind_key, "world_modal_kind_travel_gate");
  assert.equal(state.interaction_entry.action_context?.district_key, "central_hub");
  assert.equal(state.interaction_entry.action_context?.focus_key, "central_hub:travel:travel_flow");
  assert.equal(
    state.interaction_entry.action_context?.risk_focus_key,
    "central_hub:travel:travel_flow|green:stable:flat"
  );
  assert.equal(
    state.interaction_entry.action_context_signature,
    "travel_flow|central_hub:travel:travel_flow|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(
    state.interaction_entry.risk_context_signature,
    "travel_flow|central_hub:travel:travel_flow|green:stable:flat|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(state.interaction_entry.preview_rows[0].label_key, "world_sheet_metric_progress");
  assert.equal(state.interaction_terminal.terminal_kind_key, "world_entry_kind_hub_portal");
  assert.equal(state.interaction_terminal.terminal_class_key, "travel_portal");
  assert.equal(state.interaction_terminal.family_key, "travel");
  assert.equal(state.interaction_terminal.flow_key, "travel_flow");
  assert.equal(state.interaction_terminal.focus_key, "central_hub:travel:travel_flow");
  assert.equal(state.interaction_terminal.risk_focus_key, "central_hub:travel:travel_flow|green:stable:flat");
  assert.equal(state.interaction_terminal.sequence_kind_key, "world_modal_kind_travel_gate");
  assert.equal(state.interaction_terminal.action_context?.district_key, "central_hub");
  assert.equal(state.interaction_terminal.action_context?.focus_key, "central_hub:travel:travel_flow");
  assert.equal(
    state.interaction_terminal.action_context?.risk_focus_key,
    "central_hub:travel:travel_flow|green:stable:flat"
  );
  assert.equal(
    state.interaction_terminal.action_context_signature,
    "travel_flow|central_hub:travel:travel_flow|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(
    state.interaction_terminal.risk_context_signature,
    "travel_flow|central_hub:travel:travel_flow|green:stable:flat|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(state.interaction_terminal.signal_rows[0].label_key, "world_sheet_metric_progress");
  assert.equal(state.interaction_terminal.signal_rows[2].label_key, "world_terminal_signal_actions");
  assert.equal(state.interaction_terminal.preview_rows[0].label_key, "world_sheet_metric_progress");
  assert.equal(state.interaction_terminal.flow_rows[0].label_key, "world_sheet_metric_progress");
  assert.equal(state.interaction_terminal.action_items[0].focus_key, "central_hub:travel:travel_flow");
  assert.equal(
    state.interaction_terminal.action_items[0].risk_focus_key,
    "central_hub:travel:travel_flow|green:stable:flat"
  );
  assert.equal(state.interaction_terminal.action_items[0].contract_ready, true);
  assert.equal(
    state.interaction_terminal.action_items[0].action_context?.action_context_signature,
    "travel_flow|central_hub:travel:travel_flow|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(
    state.interaction_terminal.action_items[0].risk_context?.risk_context_signature,
    "travel_flow|central_hub:travel:travel_flow|green:stable:flat|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(state.interaction_modal.modal_kind_key, "world_modal_kind_travel_gate");
  assert.equal(state.interaction_modal.modal_class_key, "travel_gate");
  assert.equal(state.interaction_modal.family_key, "travel");
  assert.equal(state.interaction_modal.flow_key, "travel_flow");
  assert.equal(state.interaction_modal.focus_key, "central_hub:travel:travel_flow");
  assert.equal(state.interaction_modal.risk_focus_key, "central_hub:travel:travel_flow|green:stable:flat");
  assert.equal(state.interaction_modal.entry_kind_key, "world_entry_kind_hub_portal");
  assert.equal(state.interaction_modal.sequence_kind_key, "world_modal_kind_travel_gate");
  assert.equal(state.interaction_modal.action_context?.district_key, "central_hub");
  assert.equal(state.interaction_modal.action_context?.focus_key, "central_hub:travel:travel_flow");
  assert.equal(state.interaction_modal.action_context?.risk_focus_key, "central_hub:travel:travel_flow|green:stable:flat");
  assert.equal(state.interaction_modal.action_context?.contract_ready, true);
  assert.deepEqual(state.interaction_modal.action_context?.contract_missing_keys, []);
  assert.equal(state.interaction_modal.risk_context?.contract_ready, true);
  assert.deepEqual(state.interaction_modal.risk_context?.contract_missing_keys, []);
  assert.equal(
    state.interaction_modal.action_context_signature,
    "travel_flow|central_hub:travel:travel_flow|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(
    state.interaction_modal.risk_context_signature,
    "travel_flow|central_hub:travel:travel_flow|green:stable:flat|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(state.interaction_modal.signal_rows[2].label_key, "world_terminal_signal_actions");
  assert.equal(state.interaction_modal.action_items[0].focus_key, "central_hub:travel:travel_flow");
  assert.equal(
    state.interaction_modal.action_items[0].risk_focus_key,
    "central_hub:travel:travel_flow|green:stable:flat"
  );
  assert.equal(state.interaction_modal.action_items[0].contract_ready, true);
  assert.equal(
    state.interaction_modal.action_items[0].action_context?.action_context_signature,
    "travel_flow|central_hub:travel:travel_flow|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(
    state.interaction_modal.action_items[0].risk_context?.risk_context_signature,
    "travel_flow|central_hub:travel:travel_flow|green:stable:flat|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(state.interaction_modal.modal_cards[0].label_key, "world_modal_lane_season_arc");
  assert.equal(state.interaction_modal.modal_cards[1].label_key, "world_modal_lane_mission_queue");
  assert.equal(state.interaction_modal.modal_cards[0].focus_key, "central_hub:travel:travel_flow");
  assert.equal(state.interaction_modal.modal_cards[0].risk_focus_key, "central_hub:travel:travel_flow|green:stable:flat");
  assert.equal(state.interaction_modal.modal_cards[0].risk_health_band_key, "green");
  assert.equal(state.interaction_modal.modal_cards[0].risk_attention_band_key, "stable");
  assert.equal(state.interaction_modal.modal_cards[0].risk_trend_direction_key, "flat");
  assert.equal(state.interaction_modal.modal_cards[0].entry_kind_key, "world_entry_kind_hub_portal");
  assert.equal(state.interaction_modal.modal_cards[0].sequence_kind_key, "world_modal_kind_travel_gate");
  assert.equal(state.interaction_modal.modal_cards[0].action_context?.focus_key, "central_hub:travel:travel_flow");
  assert.equal(state.interaction_modal.modal_cards[0].action_context?.entry_kind_key, "world_entry_kind_hub_portal");
  assert.equal(state.interaction_modal.modal_cards[0].action_context?.sequence_kind_key, "world_modal_kind_travel_gate");
  assert.equal(state.interaction_modal.modal_cards[0].risk_context?.district_key, "central_hub");
  assert.equal(state.interaction_modal.modal_cards[0].risk_context?.focus_key, "central_hub:travel:travel_flow");
  assert.equal(
    state.interaction_modal.modal_cards[0].risk_context?.risk_focus_key,
    "central_hub:travel:travel_flow|green:stable:flat"
  );
  assert.equal(
    state.interaction_modal.modal_cards[0].action_context_signature,
    "travel_flow|central_hub:travel:travel_flow|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(
    state.interaction_modal.modal_cards[0].action_context?.action_context_signature,
    "travel_flow|central_hub:travel:travel_flow|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(
    state.interaction_modal.modal_cards[0].risk_context_signature,
    "travel_flow|central_hub:travel:travel_flow|green:stable:flat|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(
    state.interaction_modal.modal_cards[0].risk_context?.risk_context_signature,
    "travel_flow|central_hub:travel:travel_flow|green:stable:flat|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(state.interaction_modal.modal_cards[0].contract_ready, true);
  assert.deepEqual(state.interaction_modal.modal_cards[0].contract_missing_keys, []);
  assert.equal(state.interaction_modal.modal_cards[0].context_lookup_required, true);
  assert.equal(state.interaction_modal.modal_cards[0].context_lookup_resolved, true);
  assert.equal(state.interaction_modal.modal_cards[0].action_context?.contract_ready, true);
  assert.equal(state.interaction_modal.modal_cards[0].action_context?.context_lookup_required, true);
  assert.equal(state.interaction_modal.modal_cards[0].action_context?.context_lookup_resolved, true);
  assert.equal(state.interaction_modal.modal_cards[0].risk_context?.contract_ready, true);
  assert.equal(state.interaction_modal.modal_cards[0].risk_context?.context_lookup_required, true);
  assert.equal(state.interaction_modal.modal_cards[0].risk_context?.context_lookup_resolved, true);
  assert.equal(state.interaction_modal.modal_cards[0].protocol_card_key, state.interaction_modal.protocol_cards[0].card_key);
  assert.equal(state.interaction_modal.modal_cards[0].protocol_pod_key, state.interaction_modal.protocol_cards[0].flow_pods[0].pod_key);
  assert.equal(
    state.interaction_modal.modal_cards[0].microflow_key,
    state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].microflow_key
  );
  assert.equal(state.interaction_modal.modal_cards[0].family_key, "travel");
  assert.equal(state.interaction_modal.modal_cards[0].flow_key, "travel_flow");
  assert.equal(state.interaction_modal.modal_cards[0].action_items[0].focus_key, "central_hub:travel:travel_flow");
  assert.equal(
    state.interaction_modal.modal_cards[0].action_items[0].risk_focus_key,
    "central_hub:travel:travel_flow|green:stable:flat"
  );
  assert.equal(state.interaction_modal.modal_cards[0].action_items[0].entry_kind_key, "world_entry_kind_hub_portal");
  assert.equal(state.interaction_modal.modal_cards[0].action_items[0].sequence_kind_key, "world_modal_kind_travel_gate");
  assert.equal(state.interaction_modal.modal_cards[0].action_items[0].contract_ready, true);
  assert.equal(
    state.interaction_modal.modal_cards[0].action_items[0].action_context?.action_context_signature,
    "travel_flow|central_hub:travel:travel_flow|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(
    state.interaction_modal.modal_cards[0].action_items[0].risk_context?.risk_context_signature,
    "travel_flow|central_hub:travel:travel_flow|green:stable:flat|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(state.interaction_modal.protocol_cards[0].label_key, "world_modal_protocol_travel_vector");
  assert.equal(state.interaction_modal.protocol_cards[0].action_key, SHELL_ACTION_KEY.PLAYER_SEASON_HALL);
  assert.equal(state.interaction_modal.protocol_cards[2].label_key, "world_modal_protocol_risk_watch");
  assert.equal(state.interaction_modal.protocol_cards[0].preview_rows[0].label_key, "world_sheet_metric_progress");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_rows[1].label_key, "world_sheet_metric_wallet_state");
  assert.equal(state.interaction_modal.protocol_cards[0].signal_rows[0].label_key, "world_modal_protocol_travel_vector");
  assert.equal(state.interaction_modal.protocol_cards[0].track_rows[1].label_key, "world_sheet_metric_risk_band");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].label_key, "world_modal_lane_season_arc");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[1].label_key, "world_modal_lane_mission_queue");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].signal_rows[0].label_key, "world_modal_lane_season_arc");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[1].flow_rows[0].label_key, "world_sheet_metric_active_missions");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].entry_kind_key, "world_entry_kind_hub_portal");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].sequence_kind_key, "world_modal_kind_travel_gate");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].tempo_label_key, "world_sequence_tempo_glide");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].sequence_rows[0].label_key, "world_sheet_metric_progress");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].label_key, "world_modal_kind_travel_gate");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].family_key, "travel");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].flow_key, "travel_flow");
  assert.equal(state.interaction_modal.protocol_cards[0].focus_key, "central_hub:travel:travel_flow");
  assert.equal(state.interaction_modal.protocol_cards[0].risk_focus_key, "central_hub:travel:travel_flow|green:stable:flat");
  assert.equal(state.interaction_modal.protocol_cards[0].risk_health_band_key, "green");
  assert.equal(state.interaction_modal.protocol_cards[0].risk_attention_band_key, "stable");
  assert.equal(state.interaction_modal.protocol_cards[0].risk_trend_direction_key, "flat");
  assert.equal(state.interaction_modal.protocol_cards[0].entry_kind_key, "world_entry_kind_hub_portal");
  assert.equal(state.interaction_modal.protocol_cards[0].sequence_kind_key, "world_modal_kind_travel_gate");
  assert.equal(state.interaction_modal.protocol_cards[0].action_context?.focus_key, "central_hub:travel:travel_flow");
  assert.equal(state.interaction_modal.protocol_cards[0].action_context?.entry_kind_key, "world_entry_kind_hub_portal");
  assert.equal(state.interaction_modal.protocol_cards[0].action_context?.sequence_kind_key, "world_modal_kind_travel_gate");
  assert.equal(state.interaction_modal.protocol_cards[0].context_lookup_required, true);
  assert.equal(state.interaction_modal.protocol_cards[0].context_lookup_resolved, true);
  assert.equal(state.interaction_modal.protocol_cards[0].contract_ready, true);
  assert.deepEqual(state.interaction_modal.protocol_cards[0].contract_missing_keys, []);
  assert.equal(state.interaction_modal.protocol_cards[0].action_context?.context_lookup_required, true);
  assert.equal(state.interaction_modal.protocol_cards[0].action_context?.context_lookup_resolved, true);
  assert.equal(state.interaction_modal.protocol_cards[0].action_context?.contract_ready, true);
  assert.deepEqual(state.interaction_modal.protocol_cards[0].action_context?.contract_missing_keys, []);
  assert.equal(state.interaction_modal.protocol_cards[0].risk_context?.district_key, "central_hub");
  assert.equal(state.interaction_modal.protocol_cards[0].risk_context?.focus_key, "central_hub:travel:travel_flow");
  assert.equal(state.interaction_modal.protocol_cards[0].risk_context?.contract_ready, true);
  assert.deepEqual(state.interaction_modal.protocol_cards[0].risk_context?.contract_missing_keys, []);
  assert.equal(
    state.interaction_modal.protocol_cards[0].risk_context?.risk_focus_key,
    "central_hub:travel:travel_flow|green:stable:flat"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[0].action_context_signature,
    "travel_flow|central_hub:travel:travel_flow|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[0].action_context?.action_context_signature,
    "travel_flow|central_hub:travel:travel_flow|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[0].risk_context_signature,
    "travel_flow|central_hub:travel:travel_flow|green:stable:flat|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[0].risk_context?.risk_context_signature,
    "travel_flow|central_hub:travel:travel_flow|green:stable:flat|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].focus_key, "central_hub:travel:travel_flow");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].risk_focus_key, "central_hub:travel:travel_flow|green:stable:flat");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].risk_health_band_key, "green");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].risk_attention_band_key, "stable");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].risk_trend_direction_key, "flat");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].context_lookup_required, true);
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].context_lookup_resolved, true);
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].contract_ready, true);
  assert.deepEqual(state.interaction_modal.protocol_cards[0].flow_pods[0].contract_missing_keys, []);
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].action_context?.context_lookup_required, true);
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].action_context?.context_lookup_resolved, true);
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].action_context?.contract_ready, true);
  assert.deepEqual(state.interaction_modal.protocol_cards[0].flow_pods[0].action_context?.contract_missing_keys, []);
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].action_context?.focus_key, "central_hub:travel:travel_flow");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].action_context?.entry_kind_key, "world_entry_kind_hub_portal");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].action_context?.sequence_kind_key, "world_modal_kind_travel_gate");
  assert.equal(
    state.interaction_modal.protocol_cards[0].flow_pods[0].risk_context?.focus_key,
    "central_hub:travel:travel_flow"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[0].flow_pods[0].risk_context?.risk_focus_key,
    "central_hub:travel:travel_flow|green:stable:flat"
  );
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].risk_context?.contract_ready, true);
  assert.deepEqual(state.interaction_modal.protocol_cards[0].flow_pods[0].risk_context?.contract_missing_keys, []);
  assert.equal(
    state.interaction_modal.protocol_cards[0].flow_pods[0].action_context_signature,
    "travel_flow|central_hub:travel:travel_flow|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[0].flow_pods[0].risk_context_signature,
    "travel_flow|central_hub:travel:travel_flow|green:stable:flat|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].focus_key, "central_hub:travel:travel_flow");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].risk_key, "green:stable:flat");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].context_lookup_required, true);
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].context_lookup_resolved, true);
  assert.equal(
    state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].action_context?.context_lookup_required,
    true
  );
  assert.equal(
    state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].action_context?.context_lookup_resolved,
    true
  );
  assert.equal(
    state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].risk_focus_key,
    "central_hub:travel:travel_flow|green:stable:flat"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].action_context?.focus_key,
    "central_hub:travel:travel_flow"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].action_context?.risk_focus_key,
    "central_hub:travel:travel_flow|green:stable:flat"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].action_context_signature,
    "travel_flow|central_hub:travel:travel_flow|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].action_context?.action_context_signature,
    "travel_flow|central_hub:travel:travel_flow|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].risk_context?.focus_key,
    "central_hub:travel:travel_flow"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].risk_context?.risk_focus_key,
    "central_hub:travel:travel_flow|green:stable:flat"
  );
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].risk_health_band_key, "green");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].risk_attention_band_key, "stable");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].risk_trend_direction_key, "flat");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].risk_light_band_key, "stable");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].risk_glow_band_key, "stable");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].risk_motion_band_key, "steady");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].risk_light_scalar, 1);
  assert.equal(
    state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].action_items[0].focus_key,
    "central_hub:travel:travel_flow"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].action_items[0].risk_focus_key,
    "central_hub:travel:travel_flow|green:stable:flat"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].action_items[0].entry_kind_key,
    "world_entry_kind_hub_portal"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].action_items[0].sequence_kind_key,
    "world_modal_kind_travel_gate"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].action_items[0].contract_ready,
    true
  );
  assert.equal(
    state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].action_items[0].action_context?.action_context_signature,
    "travel_flow|central_hub:travel:travel_flow|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].action_items[0].risk_context?.risk_context_signature,
    "travel_flow|central_hub:travel:travel_flow|green:stable:flat|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].risk_glow_scalar, 1);
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].risk_motion_scalar, 1);
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].entry_kind_key, "world_entry_kind_hub_portal");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].director_pace_label_key, "world_director_pace_hub");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].hud_tone_label_key, "world_hud_tone_central_hub");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].personality_label_key, "world_personality_glide");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].personality_band_key, "glide");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].light_profile_key, "hub_glide");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].surface_glow_band_key, "cool");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].chrome_band_key, "glide");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].composition_profile_key, "hub_glide");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].camera_frame_key, "hub_glide");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].hud_anchor_key, "center");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].rail_anchor_key, "right");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].hud_focus_mode_key, "glide");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].entry_presence_key, "lead");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].console_presence_key, "ambient");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].hud_density_profile_key, "spread");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].rail_layout_key, "hub_glide");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].modal_layout_key, "hub_glide");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].hud_layout_key, "hub_glide");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].hud_emphasis_band_key, "cool");
  assert.ok(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].focus_hold_scalar < 1);
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].camera_heading_offset, 0);
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].camera_target_x_offset, 0);
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].camera_bank_scalar, 1);
  assert.ok(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].camera_fov_scalar > 1);
  assert.ok(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].focus_spread_scalar > 1);
  assert.ok(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].surface_stack_scalar < 1);
  assert.ok(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].light_intensity_scalar > 0.95);
  assert.ok(
    state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].glow_intensity_scalar >=
      state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].light_intensity_scalar
  );
  assert.ok(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].actor_motion_scalar > 1);
  assert.ok(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].camera_orbit_bias_scalar > 1);
  assert.ok(
    state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].actor_motion_scalar >
      state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].hotspot_motion_scalar
  );
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].sequence_rows[0].label_key, "world_sheet_metric_progress");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].sequence_cards[1].label_key, "world_modal_chip_tempo");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].loop_stage_value, "62%");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].loop_rows[1].label_key, "world_sheet_metric_active_missions");
  assert.equal(state.interaction_modal.protocol_cards[1].action_items[0].action_key, SHELL_ACTION_KEY.PLAYER_TASKS_BOARD);
  assert.equal(state.interaction_modal.protocol_cards[1].action_items[0].family_key, "travel");
  assert.equal(state.interaction_modal.protocol_cards[1].action_items[0].flow_key, "travel_flow");
  assert.equal(state.interaction_modal.protocol_cards[1].action_items[0].microflow_key, "world_modal_lane_mission_queue:travel");
  assert.equal(state.interaction_modal.protocol_cards[1].action_items[0].focus_key, "central_hub:travel:travel_flow");
  assert.equal(state.interaction_modal.protocol_cards[1].action_items[0].contract_ready, true);
  assert.deepEqual(state.interaction_modal.protocol_cards[1].action_items[0].contract_missing_keys, []);
  assert.equal(state.interaction_modal.protocol_cards[1].action_items[0].context_lookup_required, true);
  assert.equal(state.interaction_modal.protocol_cards[1].action_items[0].context_lookup_resolved, true);
  assert.equal(
    state.interaction_modal.protocol_cards[1].action_items[0].action_context?.context_lookup_required,
    true
  );
  assert.equal(
    state.interaction_modal.protocol_cards[1].action_items[0].action_context?.context_lookup_resolved,
    true
  );
  assert.equal(
    state.interaction_modal.protocol_cards[1].action_items[0].action_context_signature,
    "travel_flow|central_hub:travel:travel_flow|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[1].action_items[0].risk_context_signature,
    "travel_flow|central_hub:travel:travel_flow|green:stable:flat|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[1].action_items[0].action_context?.action_context_signature,
    "travel_flow|central_hub:travel:travel_flow|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[1].action_items[0].risk_context?.risk_context_signature,
    "travel_flow|central_hub:travel:travel_flow|green:stable:flat|world_entry_kind_hub_portal|world_modal_kind_travel_gate"
  );
  assert.equal(state.active_cluster_key, "hub_gate_north");
  assert.equal(state.interaction_cluster_count, 3);
  assert.equal(state.active_cluster_slot_count, 2);
  assert.equal(state.actors.length, 3);
  assert.deepEqual(
    state.actors.map((actor) => actor.kind),
    ["gate", "gate", "arch"]
  );
  assert.deepEqual(
    state.hotspots.map((hotspot) => hotspot.key),
    ["season_gate", "events_portal", "mission_desk", "discover_arc", "wallet_port", "rewards_cache"]
  );
  assert.equal(state.hotspots.find((hotspot) => hotspot.key === "events_portal")?.is_secondary, true);
  assert.equal(state.hotspots.find((hotspot) => hotspot.key === "events_portal")?.cluster_size, 2);
  assert.equal(state.interaction_clusters.find((cluster) => cluster.cluster_key === "hub_gate_north")?.hotspot_count, 2);
  assert.equal(state.interaction_clusters.find((cluster) => cluster.cluster_key === "hub_gate_north")?.is_active, true);
  assert.equal(state.active_cluster_actions.length, 2);
  assert.equal(state.active_cluster_actions[0].action_key, SHELL_ACTION_KEY.PLAYER_SEASON_HALL);
  assert.equal(state.active_cluster_actions[0].intent_profile.intent_label_key, "world_intent_travel");
  assert.equal(state.active_cluster_actions[1].is_secondary, true);
  assert.equal(state.interaction_clusters.find((cluster) => cluster.cluster_key === "hub_gate_north")?.intent_slots.length, 2);
  assert.equal(state.interaction_clusters.find((cluster) => cluster.cluster_key === "hub_gate_north")?.intent_slots[0].band_key, "inner");
  assert.equal(state.interaction_clusters.find((cluster) => cluster.cluster_key === "hub_gate_north")?.intent_slots[1].band_key, "outer");
  assert.equal(
    state.interaction_clusters.find((cluster) => cluster.cluster_key === "hub_gate_north")?.action_items[0].focus_key,
    "central_hub:travel:travel_flow"
  );
  assert.equal(
    state.interaction_clusters.find((cluster) => cluster.cluster_key === "hub_gate_north")?.action_items[0].risk_focus_key,
    "central_hub:travel:travel_flow|green:stable:flat"
  );
  assert.equal(
    state.interaction_clusters.find((cluster) => cluster.cluster_key === "hub_gate_north")?.action_items[0].entry_kind_key,
    "world_entry_kind_hub_portal"
  );
  assert.equal(
    state.interaction_clusters.find((cluster) => cluster.cluster_key === "hub_gate_north")?.action_items[0].sequence_kind_key,
    "world_modal_kind_travel_gate"
  );
  assert.equal(
    state.interaction_clusters.find((cluster) => cluster.cluster_key === "hub_gate_north")?.action_items[0].action_context_signature,
    "central_hub|travel|travel_flow|world_modal_lane_season_arc:travel|central_hub:travel:travel_flow|travel_gate|travel_gate"
  );
  assert.equal(
    state.interaction_clusters.find((cluster) => cluster.cluster_key === "hub_gate_north")?.action_items[0].contract_ready,
    true
  );
  assert.equal(
    state.interaction_clusters.find((cluster) => cluster.cluster_key === "hub_gate_north")?.intent_slots[0].focus_key,
    "central_hub:travel:travel_flow"
  );
  assert.equal(
    state.interaction_clusters.find((cluster) => cluster.cluster_key === "hub_gate_north")?.intent_slots[0].entry_kind_key,
    "world_entry_kind_hub_portal"
  );
  assert.equal(
    state.interaction_clusters.find((cluster) => cluster.cluster_key === "hub_gate_north")?.intent_slots[0].sequence_kind_key,
    "world_modal_kind_travel_gate"
  );
  assert.equal(
    state.interaction_clusters.find((cluster) => cluster.cluster_key === "hub_gate_north")?.intent_slots[0].contract_ready,
    true
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
  assert.equal(state.director_profile_key, "arena_vector");
  assert.equal(state.rail_profile_key, "arena_prime");
  assert.equal(state.interaction_sheet.title_key, "world_hotspot_duel_pit");
  assert.equal(state.interaction_sheet.rows[0].label_key, "world_sheet_metric_duel_phase");
  assert.equal(state.interaction_sheet.family_key, "duel");
  assert.equal(state.interaction_sheet.flow_key, "duel_flow");
  assert.equal(state.interaction_sheet.focus_key, "arena_prime:duel:duel_flow");
  assert.equal(state.interaction_sheet.risk_focus_key, "arena_prime:duel:duel_flow|green:stable:flat");
  assert.equal(state.interaction_sheet.entry_kind_key, "world_entry_kind_duel_console");
  assert.equal(state.interaction_sheet.sequence_kind_key, "world_modal_kind_duel_sequence");
  assert.equal(state.interaction_sheet.action_context?.district_key, "arena_prime");
  assert.equal(state.interaction_sheet.action_context?.focus_key, "arena_prime:duel:duel_flow");
  assert.equal(state.interaction_surface.surface_kind_key, "world_surface_kind_arena_console");
  assert.equal(state.interaction_surface.hero_label_key, "world_sheet_metric_duel_phase");
  assert.equal(state.interaction_surface.family_key, "duel");
  assert.equal(state.interaction_surface.flow_key, "duel_flow");
  assert.equal(state.interaction_surface.focus_key, "arena_prime:duel:duel_flow");
  assert.equal(state.interaction_surface.risk_focus_key, "arena_prime:duel:duel_flow|green:stable:flat");
  assert.equal(state.interaction_surface.entry_kind_key, "world_entry_kind_duel_console");
  assert.equal(state.interaction_surface.sequence_kind_key, "world_modal_kind_duel_sequence");
  assert.equal(state.interaction_surface.action_context?.district_key, "arena_prime");
  assert.equal(state.interaction_surface.action_context?.focus_key, "arena_prime:duel:duel_flow");
  assert.equal(
    state.interaction_surface.action_context?.risk_focus_key,
    "arena_prime:duel:duel_flow|green:stable:flat"
  );
  assert.equal(state.interaction_surface.risk_context?.district_key, "arena_prime");
  assert.equal(state.interaction_surface.risk_context?.focus_key, "arena_prime:duel:duel_flow");
  assert.equal(
    state.interaction_surface.risk_context?.risk_focus_key,
    "arena_prime:duel:duel_flow|green:stable:flat"
  );
  assert.equal(state.interaction_flow.flow_kind_key, "world_flow_kind_arena_loop");
  assert.equal(state.interaction_flow.readiness_value_key, "world_flow_state_ready");
  assert.equal(state.interaction_flow.family_key, "duel");
  assert.equal(state.interaction_flow.flow_key, "duel_flow");
  assert.equal(state.interaction_flow.focus_key, "arena_prime:duel:duel_flow");
  assert.equal(state.interaction_flow.risk_focus_key, "arena_prime:duel:duel_flow|green:stable:flat");
  assert.equal(state.interaction_flow.entry_kind_key, "world_entry_kind_duel_console");
  assert.equal(state.interaction_flow.sequence_kind_key, "world_modal_kind_duel_sequence");
  assert.equal(state.interaction_entry.entry_kind_key, "world_entry_kind_duel_console");
  assert.equal(state.interaction_entry.status_label_key, "world_flow_state_ready");
  assert.equal(state.interaction_entry.family_key, "duel");
  assert.equal(state.interaction_entry.flow_key, "duel_flow");
  assert.equal(state.interaction_entry.focus_key, "arena_prime:duel:duel_flow");
  assert.equal(state.interaction_entry.risk_focus_key, "arena_prime:duel:duel_flow|green:stable:flat");
  assert.equal(state.interaction_entry.sequence_kind_key, "world_modal_kind_duel_sequence");
  assert.equal(state.interaction_entry.action_context?.district_key, "arena_prime");
  assert.equal(state.interaction_entry.action_context?.focus_key, "arena_prime:duel:duel_flow");
  assert.equal(
    state.interaction_entry.action_context?.risk_focus_key,
    "arena_prime:duel:duel_flow|green:stable:flat"
  );
  assert.equal(state.interaction_terminal.terminal_kind_key, "world_entry_kind_duel_console");
  assert.equal(state.interaction_terminal.terminal_class_key, "arena_console");
  assert.equal(state.interaction_terminal.family_key, "duel");
  assert.equal(state.interaction_terminal.flow_key, "duel_flow");
  assert.equal(state.interaction_terminal.focus_key, "arena_prime:duel:duel_flow");
  assert.equal(state.interaction_terminal.risk_focus_key, "arena_prime:duel:duel_flow|green:stable:flat");
  assert.equal(state.interaction_terminal.sequence_kind_key, "world_modal_kind_duel_sequence");
  assert.equal(state.interaction_terminal.action_context?.district_key, "arena_prime");
  assert.equal(state.interaction_terminal.action_context?.focus_key, "arena_prime:duel:duel_flow");
  assert.equal(
    state.interaction_terminal.action_context?.risk_focus_key,
    "arena_prime:duel:duel_flow|green:stable:flat"
  );
  assert.equal(state.interaction_terminal.flow_rows[0].label_key, "world_sheet_metric_duel_phase");
  assert.equal(state.interaction_modal.modal_kind_key, "world_modal_kind_duel_sequence");
  assert.equal(state.interaction_modal.modal_class_key, "duel_sequence");
  assert.equal(state.interaction_modal.family_key, "duel");
  assert.equal(state.interaction_modal.flow_key, "duel_flow");
  assert.equal(state.interaction_modal.focus_key, "arena_prime:duel:duel_flow");
  assert.equal(state.interaction_modal.risk_focus_key, "arena_prime:duel:duel_flow|green:stable:flat");
  assert.equal(state.interaction_modal.entry_kind_key, "world_entry_kind_duel_console");
  assert.equal(state.interaction_modal.sequence_kind_key, "world_modal_kind_duel_sequence");
  assert.equal(state.interaction_modal.action_context?.district_key, "arena_prime");
  assert.equal(state.interaction_modal.action_context?.focus_key, "arena_prime:duel:duel_flow");
  assert.equal(state.interaction_modal.modal_cards[0].label_key, "world_modal_lane_duel_sync");
  assert.equal(state.interaction_modal.modal_cards[2].label_key, "world_modal_lane_tick_window");
  assert.equal(state.interaction_modal.modal_cards[0].focus_key, "arena_prime:duel:duel_flow");
  assert.equal(state.interaction_modal.modal_cards[0].risk_focus_key, "arena_prime:duel:duel_flow|green:stable:flat");
  assert.equal(state.interaction_modal.modal_cards[0].risk_health_band_key, "green");
  assert.equal(state.interaction_modal.modal_cards[0].risk_attention_band_key, "stable");
  assert.equal(state.interaction_modal.modal_cards[0].risk_trend_direction_key, "flat");
  assert.equal(state.interaction_modal.modal_cards[0].entry_kind_key, "world_entry_kind_duel_console");
  assert.equal(state.interaction_modal.modal_cards[0].sequence_kind_key, "world_modal_kind_duel_sequence");
  assert.equal(state.interaction_modal.modal_cards[0].action_context?.entry_kind_key, "world_entry_kind_duel_console");
  assert.equal(state.interaction_modal.modal_cards[0].action_context?.sequence_kind_key, "world_modal_kind_duel_sequence");
  assert.equal(
    state.interaction_modal.modal_cards[0].action_context_signature,
    "duel_flow|arena_prime:duel:duel_flow|world_entry_kind_duel_console|world_modal_kind_duel_sequence"
  );
  assert.equal(
    state.interaction_modal.modal_cards[0].risk_context_signature,
    "duel_flow|arena_prime:duel:duel_flow|green:stable:flat|world_entry_kind_duel_console|world_modal_kind_duel_sequence"
  );
  assert.equal(state.interaction_modal.modal_cards[0].protocol_card_key, state.interaction_modal.protocol_cards[0].card_key);
  assert.equal(state.interaction_modal.modal_cards[0].protocol_pod_key, state.interaction_modal.protocol_cards[0].flow_pods[0].pod_key);
  assert.equal(state.interaction_modal.modal_cards[0].family_key, "duel");
  assert.equal(state.interaction_modal.modal_cards[0].flow_key, "duel_flow");
  assert.equal(state.interaction_modal.protocol_cards[0].label_key, "world_modal_protocol_duel_boot");
  assert.equal(state.interaction_modal.protocol_cards[1].action_key, SHELL_ACTION_KEY.PLAYER_PVP_WEEKLY_LADDER);
  assert.equal(state.interaction_modal.protocol_cards[2].label_key, "world_modal_protocol_tick_mesh");
  assert.equal(state.interaction_modal.protocol_cards[0].preview_rows[0].label_key, "world_sheet_metric_duel_phase");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_rows[1].label_key, "world_sheet_metric_ladder_charge");
  assert.equal(state.interaction_modal.protocol_cards[0].signal_rows[2].label_key, "world_terminal_signal_actions");
  assert.equal(state.interaction_modal.protocol_cards[2].track_rows[0].label_key, "world_modal_protocol_tick_mesh");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].label_key, "world_modal_lane_duel_sync");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].label_key, "world_modal_lane_tick_window");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].signal_rows[2].label_key, "world_terminal_signal_actions");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].flow_rows[0].label_key, "world_sheet_metric_diag_band");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].entry_kind_key, "world_entry_kind_duel_console");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].sequence_kind_key, "world_modal_kind_duel_sequence");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].tempo_label_key, "world_sequence_tempo_burst");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].camera_profile_label_key, "world_camera_focus_scan");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].label_key, "world_modal_kind_duel_sequence");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].family_key, "duel");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].flow_key, "duel_flow");
  assert.equal(state.interaction_modal.protocol_cards[0].focus_key, "arena_prime:duel:duel_flow");
  assert.equal(state.interaction_modal.protocol_cards[0].risk_focus_key, "arena_prime:duel:duel_flow|green:stable:flat");
  assert.equal(state.interaction_modal.protocol_cards[0].risk_health_band_key, "green");
  assert.equal(state.interaction_modal.protocol_cards[0].risk_attention_band_key, "stable");
  assert.equal(state.interaction_modal.protocol_cards[0].risk_trend_direction_key, "flat");
  assert.equal(state.interaction_modal.protocol_cards[0].entry_kind_key, "world_entry_kind_duel_console");
  assert.equal(state.interaction_modal.protocol_cards[0].sequence_kind_key, "world_modal_kind_duel_sequence");
  assert.equal(state.interaction_modal.protocol_cards[0].action_context?.focus_key, "arena_prime:duel:duel_flow");
  assert.equal(state.interaction_modal.protocol_cards[0].action_context?.entry_kind_key, "world_entry_kind_duel_console");
  assert.equal(state.interaction_modal.protocol_cards[0].action_context?.sequence_kind_key, "world_modal_kind_duel_sequence");
  assert.equal(state.interaction_modal.protocol_cards[0].contract_ready, true);
  assert.deepEqual(state.interaction_modal.protocol_cards[0].contract_missing_keys, []);
  assert.equal(state.interaction_modal.protocol_cards[0].action_context?.contract_ready, true);
  assert.deepEqual(state.interaction_modal.protocol_cards[0].action_context?.contract_missing_keys, []);
  assert.equal(state.interaction_modal.protocol_cards[0].risk_context?.district_key, "arena_prime");
  assert.equal(state.interaction_modal.protocol_cards[0].risk_context?.focus_key, "arena_prime:duel:duel_flow");
  assert.equal(state.interaction_modal.protocol_cards[0].risk_context?.contract_ready, true);
  assert.deepEqual(state.interaction_modal.protocol_cards[0].risk_context?.contract_missing_keys, []);
  assert.equal(
    state.interaction_modal.protocol_cards[0].action_context_signature,
    "duel_flow|arena_prime:duel:duel_flow|world_entry_kind_duel_console|world_modal_kind_duel_sequence"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[0].action_context?.action_context_signature,
    "duel_flow|arena_prime:duel:duel_flow|world_entry_kind_duel_console|world_modal_kind_duel_sequence"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[0].risk_context?.risk_focus_key,
    "arena_prime:duel:duel_flow|green:stable:flat"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[0].risk_context_signature,
    "duel_flow|arena_prime:duel:duel_flow|green:stable:flat|world_entry_kind_duel_console|world_modal_kind_duel_sequence"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[0].risk_context?.risk_context_signature,
    "duel_flow|arena_prime:duel:duel_flow|green:stable:flat|world_entry_kind_duel_console|world_modal_kind_duel_sequence"
  );
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].focus_key, "arena_prime:duel:duel_flow");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].risk_focus_key, "arena_prime:duel:duel_flow|green:stable:flat");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].risk_health_band_key, "green");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].risk_attention_band_key, "stable");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].risk_trend_direction_key, "flat");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].contract_ready, true);
  assert.deepEqual(state.interaction_modal.protocol_cards[0].flow_pods[0].contract_missing_keys, []);
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].action_context?.contract_ready, true);
  assert.deepEqual(state.interaction_modal.protocol_cards[0].flow_pods[0].action_context?.contract_missing_keys, []);
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].action_context?.focus_key, "arena_prime:duel:duel_flow");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].action_context?.entry_kind_key, "world_entry_kind_duel_console");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].action_context?.sequence_kind_key, "world_modal_kind_duel_sequence");
  assert.equal(
    state.interaction_modal.protocol_cards[0].flow_pods[0].risk_context?.focus_key,
    "arena_prime:duel:duel_flow"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[0].flow_pods[0].risk_context?.risk_focus_key,
    "arena_prime:duel:duel_flow|green:stable:flat"
  );
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].risk_context?.contract_ready, true);
  assert.deepEqual(state.interaction_modal.protocol_cards[0].flow_pods[0].risk_context?.contract_missing_keys, []);
  assert.equal(
    state.interaction_modal.protocol_cards[0].flow_pods[0].risk_context_signature,
    "duel_flow|arena_prime:duel:duel_flow|green:stable:flat|world_entry_kind_duel_console|world_modal_kind_duel_sequence"
  );
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].focus_key, "arena_prime:duel:duel_flow");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].risk_key, "green:stable:flat");
  assert.equal(
    state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].risk_focus_key,
    "arena_prime:duel:duel_flow|green:stable:flat"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].action_context?.focus_key,
    "arena_prime:duel:duel_flow"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].action_context?.risk_focus_key,
    "arena_prime:duel:duel_flow|green:stable:flat"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].risk_context?.focus_key,
    "arena_prime:duel:duel_flow"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].risk_context?.risk_focus_key,
    "arena_prime:duel:duel_flow|green:stable:flat"
  );
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].risk_health_band_key, "green");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].risk_attention_band_key, "stable");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].risk_trend_direction_key, "flat");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].camera_profile_label_key, "world_camera_focus_strike");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].director_pace_label_key, "world_director_pace_arena");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].personality_label_key, "world_personality_assault");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].personality_band_key, "aggressive");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].light_profile_key, "arena_flare");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].surface_glow_band_key, "hot");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].chrome_band_key, "strike");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].composition_profile_key, "arena_press");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].camera_frame_key, "arena_press");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].hud_anchor_key, "center");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].modal_anchor_key, "right");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].hud_focus_mode_key, "duel");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].entry_presence_key, "lead");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].sheet_presence_key, "ambient");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].hud_density_profile_key, "focus");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].rail_layout_key, "arena_strike");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].modal_layout_key, "arena_focus");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].hud_layout_key, "arena_stack");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].hud_emphasis_band_key, "hot");
  assert.ok(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].focus_hold_scalar > 1);
  assert.ok(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].camera_heading_offset > 0);
  assert.ok(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].camera_target_x_offset > 0);
  assert.ok(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].camera_bank_scalar > 1);
  assert.ok(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].camera_fov_scalar < 1);
  assert.ok(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].focus_spread_scalar < 1);
  assert.ok(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].surface_stack_scalar > 1);
  assert.ok(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].light_intensity_scalar > 1);
  assert.ok(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].glow_intensity_scalar > 1);
  assert.ok(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].orbit_spin_scalar > 1);
  assert.ok(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].ring_pulse_scalar > 1);
  assert.ok(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].satellite_orbit_scalar > 1);
  assert.ok(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].camera_drift_scalar > 1);
  assert.ok(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].camera_target_lift_scalar > 1);
  assert.ok(
    state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].actor_motion_scalar >
      state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].hotspot_motion_scalar
  );
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].sequence_cards[2].value_key, "world_director_pace_arena");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].loop_stage_value, "STRIKE");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].microflow_cards[0].loop_rows[1].label_key, "world_sheet_metric_tick_tempo");
  assert.equal(state.interaction_modal.protocol_cards[1].action_items[1].action_key, SHELL_ACTION_KEY.PLAYER_PVP_LEADERBOARD);
  assert.equal(state.interaction_modal.protocol_cards[1].action_items[1].family_key, "ladder");
  assert.equal(state.interaction_modal.protocol_cards[1].action_items[1].flow_key, "ladder_flow");
  assert.equal(state.interaction_modal.protocol_cards[1].action_items[1].microflow_key, "world_modal_lane_ladder_charge:ladder");
  assert.equal(state.interaction_modal.protocol_cards[1].action_items[1].focus_key, "arena_prime:ladder:ladder_flow");
  assert.equal(state.hud_profile.compact_mode, true);
  assert.equal(state.interaction_cluster_count, 3);
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
  assert.equal(state.nodes[0].family_key, "queue");
  assert.equal(state.nodes[0].flow_key, "queue_flow");
  assert.equal(state.nodes[0].microflow_key, "world_modal_lane_queue_review:queue");
  assert.equal(state.nodes[0].focus_key, "ops_citadel:queue:queue_flow");
  assert.equal(state.nodes[0].entry_kind_key, "world_entry_kind_queue_console");
  assert.equal(state.nodes[0].sequence_kind_key, "world_modal_kind_queue_review");
  assert.equal(state.nodes[0].action_context?.focus_key, "ops_citadel:queue:queue_flow");
  assert.equal(
    state.nodes[0].action_context_signature,
    "queue_flow|ops_citadel:queue:queue_flow|world_entry_kind_queue_console|world_modal_kind_queue_review"
  );
  assert.equal(state.district_theme_key, "ops_citadel");
  assert.equal(state.camera_profile_key, "ops_overwatch");
  assert.equal(state.hud_profile_key, "ops_citadel");
  assert.equal(state.director_profile_key, "ops_vector");
  assert.equal(state.rail_profile_key, "ops_citadel");
  assert.equal(state.interaction_sheet.title_key, "world_hotspot_queue_gate");
  assert.equal(state.interaction_sheet.rows[0].label_key, "world_sheet_metric_queue_depth");
  assert.equal(state.interaction_sheet.family_key, "queue");
  assert.equal(state.interaction_sheet.flow_key, "queue_flow");
  assert.equal(state.interaction_sheet.focus_key, "ops_citadel:queue:queue_flow");
  assert.equal(state.interaction_sheet.risk_focus_key, "ops_citadel:queue:queue_flow|yellow:watch:flat");
  assert.equal(state.interaction_sheet.entry_kind_key, "world_entry_kind_queue_console");
  assert.equal(state.interaction_sheet.sequence_kind_key, "world_modal_kind_queue_review");
  assert.equal(state.interaction_sheet.action_context?.district_key, "ops_citadel");
  assert.equal(state.interaction_sheet.action_context?.focus_key, "ops_citadel:queue:queue_flow");
  assert.equal(
    state.interaction_sheet.action_context_signature,
    "queue_flow|ops_citadel:queue:queue_flow|world_entry_kind_queue_console|world_modal_kind_queue_review"
  );
  assert.equal(
    state.interaction_sheet.risk_context_signature,
    "queue_flow|ops_citadel:queue:queue_flow|yellow:watch:flat|world_entry_kind_queue_console|world_modal_kind_queue_review"
  );
  assert.equal(state.interaction_surface.surface_kind_key, "world_surface_kind_ops_console");
  assert.equal(state.interaction_surface.hero_label_key, "world_sheet_metric_queue_depth");
  assert.equal(state.interaction_surface.family_key, "queue");
  assert.equal(state.interaction_surface.flow_key, "queue_flow");
  assert.equal(state.interaction_surface.focus_key, "ops_citadel:queue:queue_flow");
  assert.equal(state.interaction_surface.risk_focus_key, "ops_citadel:queue:queue_flow|yellow:watch:flat");
  assert.equal(state.interaction_surface.entry_kind_key, "world_entry_kind_queue_console");
  assert.equal(state.interaction_surface.sequence_kind_key, "world_modal_kind_queue_review");
  assert.equal(state.interaction_surface.action_context?.district_key, "ops_citadel");
  assert.equal(state.interaction_surface.action_context?.focus_key, "ops_citadel:queue:queue_flow");
  assert.equal(
    state.interaction_surface.action_context?.risk_focus_key,
    "ops_citadel:queue:queue_flow|yellow:watch:flat"
  );
  assert.equal(state.interaction_flow.flow_kind_key, "world_flow_kind_ops_loop");
  assert.equal(state.interaction_flow.readiness_value_key, "world_flow_state_watch");
  assert.equal(state.interaction_flow.family_key, "queue");
  assert.equal(state.interaction_flow.flow_key, "queue_flow");
  assert.equal(state.interaction_flow.focus_key, "ops_citadel:queue:queue_flow");
  assert.equal(state.interaction_flow.risk_focus_key, "ops_citadel:queue:queue_flow|yellow:watch:flat");
  assert.equal(state.interaction_flow.entry_kind_key, "world_entry_kind_queue_console");
  assert.equal(state.interaction_flow.sequence_kind_key, "world_modal_kind_queue_review");
  assert.equal(
    state.interaction_flow.action_context_signature,
    "queue_flow|ops_citadel:queue:queue_flow|world_entry_kind_queue_console|world_modal_kind_queue_review"
  );
  assert.equal(
    state.interaction_flow.action_context?.action_context_signature,
    "queue_flow|ops_citadel:queue:queue_flow|world_entry_kind_queue_console|world_modal_kind_queue_review"
  );
  assert.equal(
    state.interaction_flow.risk_context_signature,
    "queue_flow|ops_citadel:queue:queue_flow|yellow:watch:flat|world_entry_kind_queue_console|world_modal_kind_queue_review"
  );
  assert.equal(
    state.interaction_flow.risk_context?.risk_context_signature,
    "queue_flow|ops_citadel:queue:queue_flow|yellow:watch:flat|world_entry_kind_queue_console|world_modal_kind_queue_review"
  );
  assert.equal(state.interaction_flow.contract_ready, true);
  assert.deepEqual(state.interaction_flow.contract_missing_keys, []);
  assert.equal(state.interaction_entry.entry_kind_key, "world_entry_kind_queue_console");
  assert.equal(state.interaction_entry.status_label_key, "world_flow_state_watch");
  assert.equal(state.interaction_entry.family_key, "queue");
  assert.equal(state.interaction_entry.flow_key, "queue_flow");
  assert.equal(state.interaction_entry.focus_key, "ops_citadel:queue:queue_flow");
  assert.equal(state.interaction_entry.risk_focus_key, "ops_citadel:queue:queue_flow|yellow:watch:flat");
  assert.equal(state.interaction_entry.sequence_kind_key, "world_modal_kind_queue_review");
  assert.equal(state.interaction_entry.action_context?.district_key, "ops_citadel");
  assert.equal(state.interaction_entry.action_context?.focus_key, "ops_citadel:queue:queue_flow");
  assert.equal(
    state.interaction_entry.action_context?.risk_focus_key,
    "ops_citadel:queue:queue_flow|yellow:watch:flat"
  );
  assert.equal(
    state.interaction_entry.action_context_signature,
    "queue_flow|ops_citadel:queue:queue_flow|world_entry_kind_queue_console|world_modal_kind_queue_review"
  );
  assert.equal(
    state.interaction_entry.risk_context_signature,
    "queue_flow|ops_citadel:queue:queue_flow|yellow:watch:flat|world_entry_kind_queue_console|world_modal_kind_queue_review"
  );
  assert.equal(state.interaction_terminal.terminal_kind_key, "world_entry_kind_queue_console");
  assert.equal(state.interaction_terminal.terminal_class_key, "ops_console");
  assert.equal(state.interaction_terminal.family_key, "queue");
  assert.equal(state.interaction_terminal.flow_key, "queue_flow");
  assert.equal(state.interaction_terminal.focus_key, "ops_citadel:queue:queue_flow");
  assert.equal(state.interaction_terminal.risk_focus_key, "ops_citadel:queue:queue_flow|yellow:watch:flat");
  assert.equal(state.interaction_terminal.sequence_kind_key, "world_modal_kind_queue_review");
  assert.equal(state.interaction_terminal.action_context?.district_key, "ops_citadel");
  assert.equal(state.interaction_terminal.action_context?.focus_key, "ops_citadel:queue:queue_flow");
  assert.equal(
    state.interaction_terminal.action_context?.risk_focus_key,
    "ops_citadel:queue:queue_flow|yellow:watch:flat"
  );
  assert.equal(
    state.interaction_terminal.action_context_signature,
    "queue_flow|ops_citadel:queue:queue_flow|world_entry_kind_queue_console|world_modal_kind_queue_review"
  );
  assert.equal(
    state.interaction_terminal.risk_context_signature,
    "queue_flow|ops_citadel:queue:queue_flow|yellow:watch:flat|world_entry_kind_queue_console|world_modal_kind_queue_review"
  );
  assert.equal(state.interaction_terminal.signal_rows[1].label_key, "world_sheet_metric_scene_health");
  assert.equal(state.interaction_terminal.action_items[0].focus_key, "ops_citadel:queue:queue_flow");
  assert.equal(
    state.interaction_terminal.action_items[0].risk_focus_key,
    "ops_citadel:queue:queue_flow|yellow:watch:flat"
  );
  assert.equal(state.interaction_terminal.action_items[0].contract_ready, true);
  assert.equal(
    state.interaction_terminal.action_items[0].action_context?.action_context_signature,
    "queue_flow|ops_citadel:queue:queue_flow|world_entry_kind_queue_console|world_modal_kind_queue_review"
  );
  assert.equal(
    state.interaction_terminal.action_items[0].risk_context?.risk_context_signature,
    "queue_flow|ops_citadel:queue:queue_flow|yellow:watch:flat|world_entry_kind_queue_console|world_modal_kind_queue_review"
  );
  assert.equal(state.interaction_modal.modal_kind_key, "world_modal_kind_queue_review");
  assert.equal(state.interaction_modal.modal_class_key, "queue_review");
  assert.equal(state.interaction_modal.family_key, "queue");
  assert.equal(state.interaction_modal.flow_key, "queue_flow");
  assert.equal(state.interaction_modal.focus_key, "ops_citadel:queue:queue_flow");
  assert.equal(state.interaction_modal.risk_focus_key, "ops_citadel:queue:queue_flow|yellow:watch:flat");
  assert.equal(state.interaction_modal.entry_kind_key, "world_entry_kind_queue_console");
  assert.equal(state.interaction_modal.sequence_kind_key, "world_modal_kind_queue_review");
  assert.equal(state.interaction_modal.action_context?.district_key, "ops_citadel");
  assert.equal(state.interaction_modal.action_context?.focus_key, "ops_citadel:queue:queue_flow");
  assert.equal(
    state.interaction_modal.action_context_signature,
    "queue_flow|ops_citadel:queue:queue_flow|world_entry_kind_queue_console|world_modal_kind_queue_review"
  );
  assert.equal(
    state.interaction_modal.risk_context_signature,
    "queue_flow|ops_citadel:queue:queue_flow|yellow:watch:flat|world_entry_kind_queue_console|world_modal_kind_queue_review"
  );
  assert.equal(state.interaction_modal.action_context?.contract_ready, true);
  assert.deepEqual(state.interaction_modal.action_context?.contract_missing_keys, []);
  assert.equal(state.interaction_modal.risk_context?.contract_ready, true);
  assert.deepEqual(state.interaction_modal.risk_context?.contract_missing_keys, []);
  assert.equal(state.interaction_modal.action_items[0].focus_key, "ops_citadel:queue:queue_flow");
  assert.equal(
    state.interaction_modal.action_items[0].risk_focus_key,
    "ops_citadel:queue:queue_flow|yellow:watch:flat"
  );
  assert.equal(state.interaction_modal.action_items[0].contract_ready, true);
  assert.equal(
    state.interaction_modal.action_items[0].action_context?.action_context_signature,
    "queue_flow|ops_citadel:queue:queue_flow|world_entry_kind_queue_console|world_modal_kind_queue_review"
  );
  assert.equal(
    state.interaction_modal.action_items[0].risk_context?.risk_context_signature,
    "queue_flow|ops_citadel:queue:queue_flow|yellow:watch:flat|world_entry_kind_queue_console|world_modal_kind_queue_review"
  );
  assert.equal(state.interaction_modal.modal_cards[0].label_key, "world_modal_lane_queue_review");
  assert.equal(state.interaction_modal.modal_cards[2].label_key, "world_modal_lane_dispatch_gate");
  assert.equal(state.interaction_modal.modal_cards[2].focus_key, "ops_citadel:dispatch:dispatch_flow");
  assert.equal(state.interaction_modal.modal_cards[2].risk_focus_key, "ops_citadel:dispatch:dispatch_flow|yellow:watch:flat");
  assert.equal(state.interaction_modal.modal_cards[2].risk_health_band_key, "yellow");
  assert.equal(state.interaction_modal.modal_cards[2].risk_attention_band_key, "watch");
  assert.equal(state.interaction_modal.modal_cards[2].risk_trend_direction_key, "flat");
  assert.equal(state.interaction_modal.modal_cards[2].entry_kind_key, "world_entry_kind_dispatch_console");
  assert.equal(state.interaction_modal.modal_cards[2].sequence_kind_key, "world_modal_kind_dispatch_sequence");
  assert.equal(state.interaction_modal.modal_cards[2].protocol_card_key, state.interaction_modal.protocol_cards[2].card_key);
  assert.equal(state.interaction_modal.modal_cards[2].protocol_pod_key, state.interaction_modal.protocol_cards[2].flow_pods[0].pod_key);
  assert.equal(state.interaction_modal.modal_cards[2].family_key, "dispatch");
  assert.equal(state.interaction_modal.modal_cards[2].flow_key, "dispatch_flow");
  assert.equal(state.interaction_modal.protocol_cards[0].label_key, "world_modal_protocol_queue_audit");
  assert.equal(state.interaction_modal.protocol_cards[2].action_key, SHELL_ACTION_KEY.ADMIN_LIVE_OPS_PANEL);
  assert.equal(state.interaction_modal.protocol_cards[0].preview_rows[0].label_key, "world_sheet_metric_queue_depth");
  assert.equal(state.interaction_modal.protocol_cards[1].flow_rows[0].label_key, "world_sheet_metric_liveops_sent");
  assert.equal(state.interaction_modal.protocol_cards[0].signal_rows[1].label_key, "world_terminal_signal_routes");
  assert.equal(state.interaction_modal.protocol_cards[2].track_rows[1].label_key, "world_sheet_metric_queue_depth");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].label_key, "world_modal_lane_queue_review");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].label_key, "world_modal_lane_dispatch_gate");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].signal_rows[1].label_key, "world_terminal_signal_routes");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].flow_rows[1].label_key, "world_sheet_metric_scene_health");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].entry_kind_key, "world_entry_kind_queue_console");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].sequence_kind_key, "world_modal_kind_dispatch_sequence");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].tempo_label_key, "world_sequence_tempo_dispatch");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].label_key, "world_modal_kind_dispatch_sequence");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].family_key, "dispatch");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].flow_key, "dispatch_flow");
  assert.equal(state.interaction_modal.protocol_cards[2].focus_key, "ops_citadel:dispatch:dispatch_flow");
  assert.equal(state.interaction_modal.protocol_cards[2].risk_focus_key, "ops_citadel:dispatch:dispatch_flow|yellow:watch:flat");
  assert.equal(state.interaction_modal.protocol_cards[2].risk_health_band_key, "yellow");
  assert.equal(state.interaction_modal.protocol_cards[2].risk_attention_band_key, "watch");
  assert.equal(state.interaction_modal.protocol_cards[2].risk_trend_direction_key, "flat");
  assert.equal(state.interaction_modal.protocol_cards[2].entry_kind_key, "world_entry_kind_dispatch_console");
  assert.equal(state.interaction_modal.protocol_cards[2].sequence_kind_key, "world_modal_kind_dispatch_sequence");
  assert.equal(state.interaction_modal.protocol_cards[2].action_context?.focus_key, "ops_citadel:dispatch:dispatch_flow");
  assert.equal(state.interaction_modal.protocol_cards[2].contract_ready, true);
  assert.deepEqual(state.interaction_modal.protocol_cards[2].contract_missing_keys, []);
  assert.equal(state.interaction_modal.protocol_cards[2].action_context?.contract_ready, true);
  assert.deepEqual(state.interaction_modal.protocol_cards[2].action_context?.contract_missing_keys, []);
  assert.equal(
    state.interaction_modal.protocol_cards[2].action_context_signature,
    "dispatch_flow|ops_citadel:dispatch:dispatch_flow|world_entry_kind_dispatch_console|world_modal_kind_dispatch_sequence"
  );
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].focus_key, "ops_citadel:dispatch:dispatch_flow");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].risk_focus_key, "ops_citadel:dispatch:dispatch_flow|yellow:watch:flat");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].risk_health_band_key, "yellow");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].risk_attention_band_key, "watch");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].risk_trend_direction_key, "flat");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].action_context?.focus_key, "ops_citadel:dispatch:dispatch_flow");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].contract_ready, true);
  assert.deepEqual(state.interaction_modal.protocol_cards[2].flow_pods[0].contract_missing_keys, []);
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].action_context?.contract_ready, true);
  assert.deepEqual(state.interaction_modal.protocol_cards[2].flow_pods[0].action_context?.contract_missing_keys, []);
  assert.equal(
    state.interaction_modal.protocol_cards[2].flow_pods[0].action_context_signature,
    "dispatch_flow|ops_citadel:dispatch:dispatch_flow|world_entry_kind_dispatch_console|world_modal_kind_dispatch_sequence"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[2].flow_pods[0].risk_context_signature,
    "dispatch_flow|ops_citadel:dispatch:dispatch_flow|yellow:watch:flat|world_entry_kind_dispatch_console|world_modal_kind_dispatch_sequence"
  );
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].focus_key, "ops_citadel:dispatch:dispatch_flow");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].risk_key, "yellow:watch:flat");
  assert.equal(
    state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].risk_focus_key,
    "ops_citadel:dispatch:dispatch_flow|yellow:watch:flat"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].action_context?.focus_key,
    "ops_citadel:dispatch:dispatch_flow"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].action_context?.risk_focus_key,
    "ops_citadel:dispatch:dispatch_flow|yellow:watch:flat"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].action_context_signature,
    "dispatch_flow|ops_citadel:dispatch:dispatch_flow|world_entry_kind_dispatch_console|world_modal_kind_dispatch_sequence"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].action_context?.action_context_signature,
    "dispatch_flow|ops_citadel:dispatch:dispatch_flow|world_entry_kind_dispatch_console|world_modal_kind_dispatch_sequence"
  );
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].risk_health_band_key, "yellow");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].risk_attention_band_key, "watch");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].risk_trend_direction_key, "flat");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].risk_light_band_key, "watch");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].risk_glow_band_key, "watch");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].risk_motion_band_key, "alerted");
  assert.ok(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].risk_light_scalar > 1);
  assert.ok(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].risk_glow_scalar > 1);
  assert.ok(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].risk_motion_scalar > 1);
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].entry_kind_key, "world_entry_kind_dispatch_console");
  assert.equal(
    state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].risk_context_signature,
    "dispatch_flow|ops_citadel:dispatch:dispatch_flow|yellow:watch:flat|world_entry_kind_dispatch_console|world_modal_kind_dispatch_sequence"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].risk_context?.risk_context_signature,
    "dispatch_flow|ops_citadel:dispatch:dispatch_flow|yellow:watch:flat|world_entry_kind_dispatch_console|world_modal_kind_dispatch_sequence"
  );
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].hud_tone_label_key, "world_hud_tone_ops_citadel");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].personality_label_key, "world_personality_dispatch");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].personality_band_key, "overwatch");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].light_profile_key, "ops_console");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].surface_glow_band_key, "hot");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].chrome_band_key, "dispatch");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].composition_profile_key, "ops_dispatch");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].camera_frame_key, "ops_dispatch");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].hud_anchor_key, "right");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].console_anchor_key, "right");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].hud_focus_mode_key, "dispatch");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].rail_presence_key, "lead");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].sheet_presence_key, "ambient");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].hud_density_profile_key, "console");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].rail_layout_key, "ops_dispatch");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].modal_layout_key, "ops_dispatch");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].hud_layout_key, "ops_grid");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].hud_emphasis_band_key, "hot");
  assert.ok(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].focus_hold_scalar > 1);
  assert.ok(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].camera_heading_offset > 0);
  assert.ok(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].camera_target_x_offset > 0);
  assert.ok(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].camera_bank_scalar > 1);
  assert.ok(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].camera_fov_scalar < 1);
  assert.ok(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].focus_spread_scalar < 1);
  assert.ok(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].surface_stack_scalar > 1);
  assert.ok(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].light_intensity_scalar > 1);
  assert.ok(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].glow_intensity_scalar > 1);
  assert.ok(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].ring_pulse_scalar > 1);
  assert.ok(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].camera_target_lift_scalar > 1);
  assert.ok(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].camera_orbit_bias_scalar < 1);
  assert.ok(
    state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].actor_motion_scalar >
      state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].hotspot_motion_scalar
  );
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].loop_stage_value, "READY");
  assert.equal(state.interaction_modal.protocol_cards[2].flow_pods[0].microflow_cards[0].loop_rows[0].label_key, "world_sheet_metric_liveops_sent");
  assert.equal(state.interaction_modal.protocol_cards[1].action_items[1].action_key, SHELL_ACTION_KEY.ADMIN_RUNTIME_FLAGS);
  assert.equal(state.interaction_modal.protocol_cards[1].action_items[1].family_key, "runtime");
  assert.equal(state.interaction_modal.protocol_cards[1].action_items[1].flow_key, "runtime_flow");
  assert.equal(state.interaction_modal.protocol_cards[1].action_items[1].microflow_key, "world_modal_lane_runtime_watch:runtime");
  assert.equal(state.interaction_modal.protocol_cards[1].action_items[1].focus_key, "ops_citadel:runtime:runtime_flow");
  assert.equal(
    state.interaction_modal.protocol_cards[1].action_items[1].action_context_signature,
    "runtime_flow|ops_citadel:runtime:runtime_flow|world_entry_kind_runtime_console|world_modal_kind_runtime_scan"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[1].action_items[1].risk_context_signature,
    "runtime_flow|ops_citadel:runtime:runtime_flow|yellow:watch:flat|world_entry_kind_runtime_console|world_modal_kind_runtime_scan"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[1].action_items[1].action_context?.action_context_signature,
    "runtime_flow|ops_citadel:runtime:runtime_flow|world_entry_kind_runtime_console|world_modal_kind_runtime_scan"
  );
  assert.equal(
    state.interaction_modal.protocol_cards[1].action_items[1].risk_context?.risk_context_signature,
    "runtime_flow|ops_citadel:runtime:runtime_flow|yellow:watch:flat|world_entry_kind_runtime_console|world_modal_kind_runtime_scan"
  );
  assert.equal(state.interaction_cluster_count, 3);
  assert.deepEqual(
    state.actors.map((actor) => actor.kind),
    ["watchtower", "watchtower", "array", "spine"]
  );
  assert.deepEqual(
    state.hotspots.map((hotspot) => hotspot.key),
    ["queue_gate", "policy_lens", "runtime_dais", "flags_console", "liveops_table", "bot_relay"]
  );
  assert.equal(state.hotspots.find((hotspot) => hotspot.key === "policy_lens")?.cluster_size, 2);
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
  assert.equal(state.active_hotspot_cluster_key, "exchange_vault_east");
  assert.equal(state.active_cluster_key, "exchange_vault_east");
  assert.equal(state.interaction_surface.surface_kind_key, "world_surface_kind_vault_terminal");
  assert.equal(state.interaction_surface.hero_label_key, "world_sheet_metric_wallet_state");
  assert.equal(state.interaction_flow.flow_kind_key, "world_flow_kind_vault_loop");
  assert.equal(state.interaction_flow.stage_value_key, "world_flow_state_ready");
  assert.equal(state.interaction_entry.entry_kind_key, "world_entry_kind_payout_terminal");
  assert.equal(state.interaction_entry.status_label_key, "world_flow_state_ready");
  assert.equal(state.interaction_terminal.terminal_kind_key, "world_entry_kind_payout_terminal");
  assert.equal(state.interaction_terminal.terminal_class_key, "payout_terminal");
  assert.equal(state.interaction_terminal.signal_rows[1].label_key, "world_sheet_metric_payout_state");
  assert.equal(state.interaction_modal.modal_kind_key, "world_modal_kind_payout_route");
  assert.equal(state.interaction_modal.modal_class_key, "payout_route");
  assert.equal(state.interaction_modal.modal_cards[0].label_key, "world_modal_lane_wallet_link");
  assert.equal(state.interaction_modal.modal_cards[1].label_key, "world_modal_lane_payout_lane");
  assert.equal(state.interaction_modal.protocol_cards[0].label_key, "world_modal_protocol_wallet_auth");
  assert.equal(state.interaction_modal.protocol_cards[1].action_key, SHELL_ACTION_KEY.PLAYER_PAYOUT_REQUEST);
  assert.equal(state.interaction_modal.protocol_cards[2].label_key, "world_modal_protocol_route_matrix");
  assert.equal(state.interaction_modal.protocol_cards[0].preview_rows[0].label_key, "world_sheet_metric_wallet_state");
  assert.equal(state.interaction_modal.protocol_cards[1].flow_rows[0].label_key, "world_sheet_metric_wallet_state");
  assert.equal(state.interaction_modal.protocol_cards[0].signal_rows[0].label_key, "world_modal_protocol_wallet_auth");
  assert.equal(state.interaction_modal.protocol_cards[2].track_rows[2].label_key, "world_sheet_metric_premium_state");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].label_key, "world_modal_lane_wallet_link");
  assert.equal(state.interaction_modal.protocol_cards[1].flow_pods[0].label_key, "world_modal_lane_payout_lane");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].signal_rows[0].label_key, "world_modal_lane_wallet_link");
  assert.equal(state.interaction_modal.protocol_cards[1].flow_pods[0].flow_rows[0].label_key, "world_sheet_metric_payout_state");
  assert.equal(state.interaction_modal.protocol_cards[0].flow_pods[0].entry_kind_key, "world_entry_kind_wallet_terminal");
  assert.equal(state.interaction_modal.protocol_cards[1].flow_pods[0].sequence_kind_key, "world_modal_kind_payout_route");
  assert.equal(state.interaction_modal.protocol_cards[1].flow_pods[0].tempo_label_key, "world_sequence_tempo_route");
  assert.equal(state.interaction_modal.protocol_cards[1].flow_pods[0].microflow_cards[0].label_key, "world_modal_kind_payout_route");
  assert.equal(state.interaction_modal.protocol_cards[1].flow_pods[0].microflow_cards[0].entry_kind_key, "world_entry_kind_payout_terminal");
  assert.equal(state.interaction_modal.protocol_cards[2].action_items[1].action_key, SHELL_ACTION_KEY.PLAYER_PAYOUT_REQUEST);
  assert.equal(state.camera_profile.radius, state.camera_radius);
  assert.equal(state.nodes.find((node) => node.key === "payout_lift")?.is_active, true);
  assert.equal(state.hotspots.find((hotspot) => hotspot.key === "payout_bay")?.is_active, true);
  assert.deepEqual(
    state.actors.map((actor) => actor.kind),
    ["vault", "vault", "rail", "arch"]
  );
  assert.deepEqual(
    state.hotspots.map((hotspot) => hotspot.key),
    ["wallet_dock", "rewards_vault", "payout_bay", "support_bay", "premium_lane"]
  );
});

test("buildDistrictWorldState collapses secondary hotspots on compact hud density", () => {
  const state = buildDistrictWorldState({
    workspace: "player",
    tab: "home",
    scene: {
      effectiveQuality: "high",
      capabilityProfile: {
        scene_profile: "cinematic",
        effective_hud_density: "compact"
      }
    },
    homeFeed: {
      season: { progress_pct: 62 },
      mission: { active_count: 3 },
      wallet_quick: { linked: true }
    }
  });

  assert.equal(state.hud_density, "compact");
  assert.equal(state.hud_profile.compact_mode, true);
  assert.deepEqual(
    state.hotspots.map((hotspot) => hotspot.key),
    ["season_gate", "mission_desk", "wallet_port"]
  );
  assert.equal(state.active_cluster_actions.length, 1);
});
