import { SHELL_ACTION_KEY } from "../navigation/shellActions.js";

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function toText(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function toNum(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeWorkspace(value) {
  return String(value || "").trim().toLowerCase() === "admin" ? "admin" : "player";
}

function normalizeTab(value) {
  const key = String(value || "").trim().toLowerCase();
  return ["home", "pvp", "tasks", "vault"].includes(key) ? key : "home";
}

function normalizeQuality(value) {
  const key = String(value || "").trim().toLowerCase();
  return ["high", "medium", "low"].includes(key) ? key : "medium";
}

function normalizeHudDensity(value) {
  return String(value || "").trim().toLowerCase() === "compact" ? "compact" : "normal";
}

function resolveDistrictKey(workspace, tab) {
  if (workspace === "admin") {
    return "ops_citadel";
  }
  if (tab === "pvp") {
    return "arena_prime";
  }
  if (tab === "tasks") {
    return "mission_quarter";
  }
  if (tab === "vault") {
    return "exchange_district";
  }
  return "central_hub";
}

function resolveDistrictLabelKey(districtKey) {
  switch (districtKey) {
    case "arena_prime":
      return "world_district_arena_prime";
    case "mission_quarter":
      return "world_district_mission_quarter";
    case "exchange_district":
      return "world_district_exchange_district";
    case "ops_citadel":
      return "world_district_ops_citadel";
    default:
      return "world_district_central_hub";
  }
}

function resolveDistrictTheme(districtKey) {
  switch (districtKey) {
    case "arena_prime":
      return {
        theme_key: "arena_prime",
        ground_hex: "#2f1320",
        ground_glow_hex: "#5a1f34",
        ring_hex: "#ff6f91",
        ring_secondary_hex: "#ffb45d",
        core_hex: "#ffd1df",
        light_hex: "#ff7c8d",
        satellite_hex: "#ff9f6e",
        satellite_count: 5,
        satellite_radius: 1.6,
        satellite_height: 1.5,
        orbit_radius: 3.4,
        camera_radius: 9.2
      };
    case "mission_quarter":
      return {
        theme_key: "mission_quarter",
        ground_hex: "#2e260f",
        ground_glow_hex: "#544522",
        ring_hex: "#ffd36f",
        ring_secondary_hex: "#ffb45d",
        core_hex: "#fff3c7",
        light_hex: "#ffd36f",
        satellite_hex: "#ffe39a",
        satellite_count: 4,
        satellite_radius: 1.9,
        satellite_height: 1.35,
        orbit_radius: 3.15,
        camera_radius: 10.4
      };
    case "exchange_district":
      return {
        theme_key: "exchange_district",
        ground_hex: "#0c2a24",
        ground_glow_hex: "#15483d",
        ring_hex: "#2fffb5",
        ring_secondary_hex: "#6cf6e8",
        core_hex: "#caffef",
        light_hex: "#35f1c9",
        satellite_hex: "#6cf6e8",
        satellite_count: 6,
        satellite_radius: 1.95,
        satellite_height: 1.45,
        orbit_radius: 3.3,
        camera_radius: 10.5
      };
    case "ops_citadel":
      return {
        theme_key: "ops_citadel",
        ground_hex: "#10263b",
        ground_glow_hex: "#1a4259",
        ring_hex: "#45ffca",
        ring_secondary_hex: "#8ef4ff",
        core_hex: "#d5fff4",
        light_hex: "#45ffca",
        satellite_hex: "#8ef4ff",
        satellite_count: 4,
        satellite_radius: 2.1,
        satellite_height: 1.8,
        orbit_radius: 3.7,
        camera_radius: 10.2
      };
    default:
      return {
        theme_key: "central_hub",
        ground_hex: "#0e2a44",
        ground_glow_hex: "#103254",
        ring_hex: "#00d6ff",
        ring_secondary_hex: "#7be6ff",
        core_hex: "#d6f6ff",
        light_hex: "#5ad7ff",
        satellite_hex: "#7be6ff",
        satellite_count: 3,
        satellite_radius: 1.75,
        satellite_height: 1.4,
        orbit_radius: 3.25,
        camera_radius: 10.8
      };
  }
}

function resolveDistrictCameraProfile(districtKey, lowEndMode, effectiveQuality, hudDensity, sceneProfile) {
  const compact = lowEndMode || effectiveQuality === "low" || hudDensity === "compact" || sceneProfile === "lite";
  const cinematic = !compact && sceneProfile === "cinematic";
  switch (districtKey) {
    case "arena_prime":
      return {
        camera_profile_key: "arena_focus",
        alpha_base: -Math.PI / 2.45,
        beta_base: compact ? Math.PI / 3.3 : Math.PI / 3.55,
        radius: compact ? 8.8 : 9.4,
        target_y: 1,
        lower_radius_delta: 0.9,
        upper_radius_delta: 1.25,
        orbit_scalar: compact ? 13 : cinematic ? 24 : 20,
        sway_scalar: compact ? 0.64 : cinematic ? 1.14 : 0.96,
        focus_lerp: compact ? 0.04 : 0.07,
        radius_lerp: compact ? 0.03 : 0.06,
        alpha_lerp: compact ? 0.026 : cinematic ? 0.072 : 0.05,
        beta_lerp: compact ? 0.024 : cinematic ? 0.066 : 0.045
      };
    case "mission_quarter":
      return {
        camera_profile_key: "mission_sweep",
        alpha_base: -Math.PI / 1.95,
        beta_base: compact ? Math.PI / 3.15 : Math.PI / 3.35,
        radius: compact ? 9.7 : 10.4,
        target_y: 0.9,
        lower_radius_delta: 1,
        upper_radius_delta: 1.3,
        orbit_scalar: compact ? 9 : cinematic ? 18 : 14,
        sway_scalar: compact ? 0.5 : cinematic ? 0.92 : 0.74,
        focus_lerp: compact ? 0.035 : 0.06,
        radius_lerp: compact ? 0.028 : 0.05,
        alpha_lerp: compact ? 0.022 : cinematic ? 0.06 : 0.042,
        beta_lerp: compact ? 0.02 : cinematic ? 0.056 : 0.038
      };
    case "exchange_district":
      return {
        camera_profile_key: "exchange_orbit",
        alpha_base: -Math.PI / 2.05,
        beta_base: compact ? Math.PI / 3.2 : Math.PI / 3.42,
        radius: compact ? 9.8 : 10.6,
        target_y: 0.85,
        lower_radius_delta: 1,
        upper_radius_delta: 1.35,
        orbit_scalar: compact ? 11 : cinematic ? 20 : 16,
        sway_scalar: compact ? 0.54 : cinematic ? 1 : 0.82,
        focus_lerp: compact ? 0.038 : 0.065,
        radius_lerp: compact ? 0.03 : 0.055,
        alpha_lerp: compact ? 0.024 : cinematic ? 0.064 : 0.046,
        beta_lerp: compact ? 0.022 : cinematic ? 0.06 : 0.042
      };
    case "ops_citadel":
      return {
        camera_profile_key: "ops_overwatch",
        alpha_base: -Math.PI / 1.82,
        beta_base: compact ? Math.PI / 3.05 : Math.PI / 3.18,
        radius: compact ? 9.4 : 10.1,
        target_y: 1.15,
        lower_radius_delta: 0.95,
        upper_radius_delta: 1.2,
        orbit_scalar: compact ? 7 : cinematic ? 13 : 11,
        sway_scalar: compact ? 0.38 : cinematic ? 0.72 : 0.58,
        focus_lerp: compact ? 0.03 : 0.05,
        radius_lerp: compact ? 0.024 : 0.04,
        alpha_lerp: compact ? 0.02 : cinematic ? 0.05 : 0.036,
        beta_lerp: compact ? 0.018 : cinematic ? 0.046 : 0.032
      };
    default:
      return {
        camera_profile_key: "hub_glide",
        alpha_base: -Math.PI / 2.08,
        beta_base: compact ? Math.PI / 3.05 : Math.PI / 3.15,
        radius: compact ? 10 : 10.8,
        target_y: 0.8,
        lower_radius_delta: 1.05,
        upper_radius_delta: 1.2,
        orbit_scalar: compact ? 11 : cinematic ? 20 : 16,
        sway_scalar: compact ? 0.46 : cinematic ? 0.82 : 0.66,
        focus_lerp: compact ? 0.035 : 0.058,
        radius_lerp: compact ? 0.026 : 0.046,
        alpha_lerp: compact ? 0.022 : cinematic ? 0.056 : 0.04,
        beta_lerp: compact ? 0.02 : cinematic ? 0.052 : 0.036
      };
  }
}

function resolveDistrictHudProfile(districtKey, hudDensity, lowEndMode, sceneProfile) {
  const compact = lowEndMode || hudDensity === "compact" || sceneProfile === "lite";
  const shared = {
    density_label_key: compact ? "world_hud_density_compact" : "world_hud_density_expanded",
    compact_mode: compact,
    show_caption: !compact,
    show_node_label: !compact,
    show_density_chip: true
  };
  switch (districtKey) {
    case "arena_prime":
      return {
        ...shared,
        hud_profile_key: "arena_prime",
        tone_label_key: "world_hud_tone_arena_prime",
        caption_label_key: "world_hud_caption_arena_prime"
      };
    case "mission_quarter":
      return {
        ...shared,
        hud_profile_key: "mission_quarter",
        tone_label_key: "world_hud_tone_mission_quarter",
        caption_label_key: "world_hud_caption_mission_quarter"
      };
    case "exchange_district":
      return {
        ...shared,
        hud_profile_key: "exchange_district",
        tone_label_key: "world_hud_tone_exchange_district",
        caption_label_key: "world_hud_caption_exchange_district"
      };
    case "ops_citadel":
      return {
        ...shared,
        hud_profile_key: "ops_citadel",
        tone_label_key: "world_hud_tone_ops_citadel",
        caption_label_key: "world_hud_caption_ops_citadel"
      };
    default:
      return {
        ...shared,
        hud_profile_key: "central_hub",
        tone_label_key: "world_hud_tone_central_hub",
        caption_label_key: "world_hud_caption_central_hub"
      };
  }
}

function resolveDistrictDirectorProfile(districtKey, hudDensity, lowEndMode, sceneProfile) {
  const compact = lowEndMode || hudDensity === "compact" || sceneProfile === "lite";
  switch (districtKey) {
    case "arena_prime":
      return {
        director_profile_key: "arena_vector",
        pace_label_key: "world_director_pace_arena",
        motion_scalar: compact ? 0.82 : 1.18,
        orbit_spin_scalar: compact ? 0.82 : 1.22,
        cluster_spin_scalar: compact ? 0.76 : 1.18,
        node_pulse_scalar: compact ? 0.78 : 1.16
      };
    case "mission_quarter":
      return {
        director_profile_key: "mission_vector",
        pace_label_key: "world_director_pace_mission",
        motion_scalar: compact ? 0.68 : 0.94,
        orbit_spin_scalar: compact ? 0.7 : 0.9,
        cluster_spin_scalar: compact ? 0.66 : 0.88,
        node_pulse_scalar: compact ? 0.74 : 0.96
      };
    case "exchange_district":
      return {
        director_profile_key: "exchange_vector",
        pace_label_key: "world_director_pace_exchange",
        motion_scalar: compact ? 0.74 : 1.02,
        orbit_spin_scalar: compact ? 0.78 : 1.04,
        cluster_spin_scalar: compact ? 0.76 : 1,
        node_pulse_scalar: compact ? 0.78 : 1.02
      };
    case "ops_citadel":
      return {
        director_profile_key: "ops_vector",
        pace_label_key: "world_director_pace_ops",
        motion_scalar: compact ? 0.58 : 0.82,
        orbit_spin_scalar: compact ? 0.58 : 0.78,
        cluster_spin_scalar: compact ? 0.56 : 0.72,
        node_pulse_scalar: compact ? 0.66 : 0.84
      };
    default:
      return {
        director_profile_key: "hub_vector",
        pace_label_key: "world_director_pace_hub",
        motion_scalar: compact ? 0.7 : 0.96,
        orbit_spin_scalar: compact ? 0.74 : 0.98,
        cluster_spin_scalar: compact ? 0.72 : 0.94,
        node_pulse_scalar: compact ? 0.76 : 0.98
      };
  }
}

function resolveDistrictRailProfile(districtKey, hudDensity, lowEndMode, sceneProfile) {
  const compact = lowEndMode || hudDensity === "compact" || sceneProfile === "lite";
  const shared = {
    compact,
    rail_layout_key: compact ? "compact_stack" : "stack",
    show_caption: !compact
  };
  switch (districtKey) {
    case "arena_prime":
      return {
        ...shared,
        rail_profile_key: "arena_prime",
        rail_label_key: "world_rail_label_arena_prime",
        rail_caption_key: "world_rail_caption_arena_prime"
      };
    case "mission_quarter":
      return {
        ...shared,
        rail_profile_key: "mission_quarter",
        rail_label_key: "world_rail_label_mission_quarter",
        rail_caption_key: "world_rail_caption_mission_quarter"
      };
    case "exchange_district":
      return {
        ...shared,
        rail_profile_key: "exchange_district",
        rail_label_key: "world_rail_label_exchange_district",
        rail_caption_key: "world_rail_caption_exchange_district"
      };
    case "ops_citadel":
      return {
        ...shared,
        rail_profile_key: "ops_citadel",
        rail_label_key: "world_rail_label_ops_citadel",
        rail_caption_key: "world_rail_caption_ops_citadel"
      };
    default:
      return {
        ...shared,
        rail_profile_key: "central_hub",
        rail_label_key: "world_rail_label_central_hub",
        rail_caption_key: "world_rail_caption_central_hub"
      };
  }
}

function resolveInteractionIntentProfile(interactionKind, isSecondary) {
  const kind = toText(interactionKind, "open");
  const secondary = Boolean(isSecondary);
  switch (kind) {
    case "travel":
      return {
        intent_profile_key: secondary ? "travel_secondary" : "travel_primary",
        intent_label_key: "world_intent_travel",
        intent_tone_key: "world_intent_tone_travel",
        rail_class_key: secondary ? "travel_secondary" : "travel_primary",
        pulse_scalar: secondary ? 0.9 : 1.12
      };
    case "launch":
      return {
        intent_profile_key: secondary ? "launch_secondary" : "launch_primary",
        intent_label_key: "world_intent_launch",
        intent_tone_key: "world_intent_tone_launch",
        rail_class_key: secondary ? "launch_secondary" : "launch_primary",
        pulse_scalar: secondary ? 0.94 : 1.08
      };
    case "connect":
      return {
        intent_profile_key: secondary ? "connect_secondary" : "connect_primary",
        intent_label_key: "world_intent_connect",
        intent_tone_key: "world_intent_tone_connect",
        rail_class_key: secondary ? "connect_secondary" : "connect_primary",
        pulse_scalar: secondary ? 0.9 : 1
      };
    case "payout":
      return {
        intent_profile_key: secondary ? "payout_secondary" : "payout_primary",
        intent_label_key: "world_intent_payout",
        intent_tone_key: "world_intent_tone_payout",
        rail_class_key: secondary ? "payout_secondary" : "payout_primary",
        pulse_scalar: secondary ? 0.9 : 1.02
      };
    case "upgrade":
      return {
        intent_profile_key: secondary ? "upgrade_secondary" : "upgrade_primary",
        intent_label_key: "world_intent_upgrade",
        intent_tone_key: "world_intent_tone_upgrade",
        rail_class_key: secondary ? "upgrade_secondary" : "upgrade_primary",
        pulse_scalar: secondary ? 0.92 : 1.04
      };
    case "compete":
      return {
        intent_profile_key: secondary ? "compete_secondary" : "compete_primary",
        intent_label_key: "world_intent_compete",
        intent_tone_key: "world_intent_tone_compete",
        rail_class_key: secondary ? "compete_secondary" : "compete_primary",
        pulse_scalar: secondary ? 0.94 : 1.16
      };
    case "climb":
      return {
        intent_profile_key: secondary ? "climb_secondary" : "climb_primary",
        intent_label_key: "world_intent_climb",
        intent_tone_key: "world_intent_tone_climb",
        rail_class_key: secondary ? "climb_secondary" : "climb_primary",
        pulse_scalar: secondary ? 0.9 : 1.06
      };
    case "review":
      return {
        intent_profile_key: secondary ? "review_secondary" : "review_primary",
        intent_label_key: "world_intent_review",
        intent_tone_key: "world_intent_tone_review",
        rail_class_key: secondary ? "review_secondary" : "review_primary",
        pulse_scalar: secondary ? 0.84 : 0.94
      };
    case "track":
      return {
        intent_profile_key: secondary ? "track_secondary" : "track_primary",
        intent_label_key: "world_intent_track",
        intent_tone_key: "world_intent_tone_track",
        rail_class_key: secondary ? "track_secondary" : "track_primary",
        pulse_scalar: secondary ? 0.86 : 0.98
      };
    case "claim":
      return {
        intent_profile_key: secondary ? "claim_secondary" : "claim_primary",
        intent_label_key: "world_intent_claim",
        intent_tone_key: "world_intent_tone_claim",
        rail_class_key: secondary ? "claim_secondary" : "claim_primary",
        pulse_scalar: secondary ? 0.9 : 1.02
      };
    case "monitor":
      return {
        intent_profile_key: secondary ? "monitor_secondary" : "monitor_primary",
        intent_label_key: "world_intent_monitor",
        intent_tone_key: "world_intent_tone_monitor",
        rail_class_key: secondary ? "monitor_secondary" : "monitor_primary",
        pulse_scalar: secondary ? 0.84 : 0.92
      };
    case "dispatch":
      return {
        intent_profile_key: secondary ? "dispatch_secondary" : "dispatch_primary",
        intent_label_key: "world_intent_dispatch",
        intent_tone_key: "world_intent_tone_dispatch",
        rail_class_key: secondary ? "dispatch_secondary" : "dispatch_primary",
        pulse_scalar: secondary ? 0.9 : 1.04
      };
    default:
      return {
        intent_profile_key: secondary ? "open_secondary" : "open_primary",
        intent_label_key: "world_intent_open",
        intent_tone_key: "world_intent_tone_open",
        rail_class_key: secondary ? "open_secondary" : "open_primary",
        pulse_scalar: secondary ? 0.84 : 0.94
      };
  }
}

function resolveModeKey(sceneProfile, lowEndMode) {
  if (lowEndMode || sceneProfile === "lite") {
    return "world_scene_mode_lite";
  }
  if (sceneProfile === "cinematic") {
    return "world_scene_mode_cinematic";
  }
  return "world_scene_mode_balanced";
}

function pickNumber(source, candidates, fallback = 0) {
  const record = asRecord(source);
  for (const key of candidates) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      const value = toNum(record[key], Number.NaN);
      if (Number.isFinite(value)) {
        return value;
      }
    }
  }
  return fallback;
}

function pickTruthy(source, candidates) {
  const record = asRecord(source);
  return candidates.some((key) => Boolean(record[key]));
}

function resolveStatusFromEnergy(energy, preferred = "") {
  const explicit = String(preferred || "").trim().toLowerCase();
  if (["good", "warn", "hot", "neutral"].includes(explicit)) {
    return explicit;
  }
  if (energy >= 0.82) {
    return "hot";
  }
  if (energy >= 0.58) {
    return "warn";
  }
  if (energy >= 0.34) {
    return "good";
  }
  return "neutral";
}

function statusColor(statusKey) {
  switch (statusKey) {
    case "hot":
      return "#ff6f91";
    case "warn":
      return "#ffb45d";
    case "good":
      return "#29ffbf";
    default:
      return "#52bfff";
  }
}

function buildNode(input) {
  const energy = clamp(toNum(input.energy, 0), 0.08, 1);
  const statusKey = resolveStatusFromEnergy(energy, input.statusKey);
  return {
    key: toText(input.key, "node"),
    laneKey: toText(input.laneKey, "lane"),
    label: toText(input.label, "Node"),
    label_key: toText(input.labelKey, ""),
    metric: toText(input.metric, "--"),
    action_key: toText(input.actionKey, ""),
    energy,
    status_key: statusKey,
    accent_hex: statusColor(statusKey)
  };
}

function buildActor(input) {
  return {
    key: toText(input.key, "actor"),
    kind: toText(input.kind, "tower"),
    accent_hex: toText(input.accentHex, "#52bfff"),
    glow_hex: toText(input.glowHex, input.accentHex || "#52bfff"),
    x: toNum(input.x, 0),
    y: toNum(input.y, 0),
    z: toNum(input.z, 0),
    width: clamp(toNum(input.width, 0.5), 0.08, 8),
    height: clamp(toNum(input.height, 0.5), 0.08, 8),
    depth: clamp(toNum(input.depth, 0.5), 0.08, 8),
    energy: clamp(toNum(input.energy, 0.3), 0.08, 1),
    rotation_y: toNum(input.rotationY, 0)
  };
}

function buildHotspot(input) {
  const intentProfile = resolveInteractionIntentProfile(input.interactionKind, input.isSecondary);
  return {
    key: toText(input.key, "hotspot"),
    label: toText(input.label, "Hotspot"),
    label_key: toText(input.labelKey, ""),
    source_type: "district_scene_hotspot",
    action_key: toText(input.actionKey, ""),
    actor_key: toText(input.actorKey, ""),
    cluster_key: toText(input.clusterKey || input.actorKey, toText(input.actorKey, "")),
    interaction_kind: toText(input.interactionKind, "open"),
    intent_profile_key: intentProfile.intent_profile_key,
    intent_profile: intentProfile,
    hint_label_key: toText(input.hintLabelKey, "world_hotspot_hint_open"),
    is_secondary: Boolean(input.isSecondary),
    x: toNum(input.x, 0),
    y: toNum(input.y, 0),
    z: toNum(input.z, 0),
    focus_y: toNum(input.focusY, toNum(input.y, 0.16) + 0.52),
    radius: clamp(toNum(input.radius, 0.42), 0.12, 4),
    ring_radius: clamp(toNum(input.ringRadius, toNum(input.radius, 0.42) * 1.55), 0.18, 6),
    camera_radius_scale: clamp(toNum(input.cameraRadiusScale, 1), 0.7, 1.25),
    camera_alpha_offset: clamp(toNum(input.cameraAlphaOffset, 0), -0.45, 0.45),
    camera_beta_offset: clamp(toNum(input.cameraBetaOffset, 0), -0.18, 0.18),
    accent_hex: toText(input.accentHex, "#52bfff"),
    energy: clamp(toNum(input.energy, 0.3), 0.08, 1)
  };
}

function finalizeHotspots(hotspots) {
  const counts = new Map();
  hotspots.forEach((hotspot) => {
    const clusterKey = toText(hotspot.cluster_key || hotspot.actor_key || hotspot.key, hotspot.key);
    counts.set(clusterKey, (counts.get(clusterKey) || 0) + 1);
  });
  const seen = new Map();
  return hotspots.map((hotspot) => {
    const clusterKey = toText(hotspot.cluster_key || hotspot.actor_key || hotspot.key, hotspot.key);
    const clusterIndex = seen.get(clusterKey) || 0;
    seen.set(clusterKey, clusterIndex + 1);
    return {
      ...hotspot,
      cluster_key: clusterKey,
      cluster_index: clusterIndex,
      cluster_size: counts.get(clusterKey) || 1
    };
  });
}

function buildInteractionClusters(actors, hotspots, activeHotspotKey) {
  const actorMap = new Map(actors.map((actor) => [actor.key, actor]));
  const grouped = new Map();
  hotspots.forEach((hotspot) => {
    const clusterKey = toText(hotspot.cluster_key || hotspot.actor_key || hotspot.key, hotspot.key);
    const current = grouped.get(clusterKey) || {
      cluster_key: clusterKey,
      actor_key: toText(hotspot.actor_key, clusterKey),
      label: toText(hotspot.label, "Cluster"),
      label_key: toText(hotspot.label_key, ""),
      primary_hotspot_key: toText(hotspot.key, ""),
      active_hotspot_key: "",
      primary_action_key: toText(hotspot.action_key, ""),
      primary_hint_label_key: toText(hotspot.hint_label_key, "world_hotspot_hint_open"),
      primary_interaction_kind: toText(hotspot.interaction_kind, "open"),
      hotspot_keys: [],
      action_items: [],
      hotspot_count: 0,
      secondary_count: 0,
      energy: 0,
      x: toNum(hotspot.x, 0),
      y: toNum(hotspot.y, 0.2),
      z: toNum(hotspot.z, 0)
    };
    current.hotspot_keys.push(hotspot.key);
    current.action_items.push({
      key: toText(hotspot.key, ""),
      label: toText(hotspot.label, ""),
      label_key: toText(hotspot.label_key, ""),
      action_key: toText(hotspot.action_key, ""),
      actor_key: toText(hotspot.actor_key, ""),
      cluster_key: clusterKey,
      hint_label_key: toText(hotspot.hint_label_key, "world_hotspot_hint_open"),
      interaction_kind: toText(hotspot.interaction_kind, "open"),
      intent_profile_key: toText(hotspot.intent_profile_key, ""),
      intent_profile: asRecord(hotspot.intent_profile),
      is_secondary: Boolean(hotspot.is_secondary)
    });
    current.hotspot_count += 1;
    current.secondary_count += hotspot.is_secondary ? 1 : 0;
    current.energy = clamp(Math.max(current.energy, toNum(hotspot.energy, 0.2)), 0.08, 1);
    if (!hotspot.is_secondary && !current.label_key) {
      current.label = toText(hotspot.label, current.label);
      current.label_key = toText(hotspot.label_key, current.label_key);
      current.primary_hotspot_key = toText(hotspot.key, current.primary_hotspot_key);
      current.primary_action_key = toText(hotspot.action_key, current.primary_action_key);
      current.primary_hint_label_key = toText(hotspot.hint_label_key, current.primary_hint_label_key);
      current.primary_interaction_kind = toText(hotspot.interaction_kind, current.primary_interaction_kind);
    }
    if (hotspot.key === activeHotspotKey) {
      current.active_hotspot_key = hotspot.key;
      current.label = toText(hotspot.label, current.label);
      current.label_key = toText(hotspot.label_key, current.label_key);
    }
    grouped.set(clusterKey, current);
  });
  return Array.from(grouped.values()).map((cluster) => {
    const actor = actorMap.get(cluster.actor_key);
    const actionItems = asList(cluster.action_items)
      .filter((item) => toText(item.action_key, "") !== "")
      .sort((left, right) => {
        const leftSecondary = Boolean(left.is_secondary);
        const rightSecondary = Boolean(right.is_secondary);
        if (leftSecondary !== rightSecondary) {
          return leftSecondary ? 1 : -1;
        }
        return toText(left.label_key || left.label, "").localeCompare(toText(right.label_key || right.label, ""));
      });
    const intentSlots = actionItems.map((item, slotIndex) => ({
      ...item,
      slot_key: `${cluster.cluster_key}:${item.key}`,
      slot_index: slotIndex,
      slot_count: actionItems.length,
      band_key: item.is_secondary ? "outer" : "inner",
      orbit_scale: item.is_secondary ? 1.22 : 1,
      size_scalar: item.is_secondary ? 0.82 : 1,
      angle_offset_scalar: (Math.PI * 2 * slotIndex) / Math.max(1, actionItems.length)
    }));
    return {
      ...cluster,
      x: toNum(actor?.x, cluster.x),
      y: toNum(actor?.y, cluster.y + 0.44),
      z: toNum(actor?.z, cluster.z),
      orbit_radius: clamp(0.56 + cluster.hotspot_count * 0.18, 0.52, 1.28),
      is_active: cluster.active_hotspot_key !== "",
      action_items: actionItems,
      intent_slots: intentSlots
    };
  });
}

function actorEnergy(nodes, index, fallback = 0.3) {
  return clamp(toNum(nodes[index]?.energy, fallback), 0.08, 1);
}

function buildDistrictActors(districtKey, nodes, theme, ambientEnergy, lowEndMode) {
  const sharedGlow = theme.ring_secondary_hex;
  const sharedCore = theme.core_hex;

  switch (districtKey) {
    case "arena_prime":
      return [
        buildActor({
          key: "arena_crown_east",
          kind: "blade_tower",
          x: 4.25,
          y: 1.2,
          z: 0,
          width: 0.46,
          height: 2.8 + actorEnergy(nodes, 0, ambientEnergy),
          depth: 0.46,
          accentHex: theme.ring_hex,
          glowHex: sharedGlow,
          energy: actorEnergy(nodes, 0, ambientEnergy)
        }),
        buildActor({
          key: "arena_crown_west",
          kind: "blade_tower",
          x: -4.25,
          y: 1.1,
          z: 0,
          width: 0.42,
          height: 2.5 + actorEnergy(nodes, 1, ambientEnergy),
          depth: 0.42,
          accentHex: theme.ring_secondary_hex,
          glowHex: sharedCore,
          energy: actorEnergy(nodes, 1, ambientEnergy)
        }),
        buildActor({
          key: "arena_hazard_arc",
          kind: "arch",
          x: 0,
          y: 1.7,
          z: 0,
          width: 3.8,
          height: 3.8,
          depth: 0.18,
          accentHex: sharedGlow,
          glowHex: sharedGlow,
          energy: clamp(ambientEnergy + 0.08, 0.08, 1),
          rotationY: Math.PI / 2
        }),
        buildActor({
          key: "arena_spine",
          kind: "spine",
          x: 0,
          y: 1.15,
          z: -3.9,
          width: 0.28,
          height: 2 + actorEnergy(nodes, 2, ambientEnergy),
          depth: 0.28,
          accentHex: theme.light_hex,
          glowHex: sharedCore,
          energy: actorEnergy(nodes, 2, ambientEnergy)
        })
      ];
    case "mission_quarter":
      return [
        buildActor({
          key: "mission_terminal_alpha",
          kind: "terminal",
          x: -3.7,
          y: 0.9,
          z: -1.4,
          width: 0.9,
          height: 1.8,
          depth: 0.9,
          accentHex: theme.ring_hex,
          glowHex: sharedCore,
          energy: actorEnergy(nodes, 0, ambientEnergy)
        }),
        buildActor({
          key: "mission_terminal_beta",
          kind: "terminal",
          x: 3.7,
          y: 0.9,
          z: -1.1,
          width: 0.82,
          height: 1.65,
          depth: 0.82,
          accentHex: theme.ring_secondary_hex,
          glowHex: sharedGlow,
          energy: actorEnergy(nodes, 1, ambientEnergy)
        }),
        buildActor({
          key: "mission_contract_spine",
          kind: "spine",
          x: 0,
          y: 1.25,
          z: 3.95,
          width: 0.24,
          height: 2.2 + actorEnergy(nodes, 3, ambientEnergy),
          depth: 0.24,
          accentHex: theme.light_hex,
          glowHex: sharedCore,
          energy: actorEnergy(nodes, 3, ambientEnergy)
        })
      ];
    case "exchange_district":
      return [
        buildActor({
          key: "exchange_vault_west",
          kind: "vault",
          x: -4.05,
          y: 1.1,
          z: 0.6,
          width: 0.78,
          height: 2.2,
          depth: 0.78,
          accentHex: theme.ring_hex,
          glowHex: sharedCore,
          energy: actorEnergy(nodes, 0, ambientEnergy)
        }),
        buildActor({
          key: "exchange_vault_east",
          kind: "vault",
          x: 4.05,
          y: 1.1,
          z: -0.6,
          width: 0.78,
          height: 2.2,
          depth: 0.78,
          accentHex: theme.ring_secondary_hex,
          glowHex: sharedGlow,
          energy: actorEnergy(nodes, 1, ambientEnergy)
        }),
        buildActor({
          key: "exchange_route_rail",
          kind: "rail",
          x: 0,
          y: 0.45,
          z: 3.8,
          width: 5.8,
          height: 0.16,
          depth: 0.22,
          accentHex: theme.light_hex,
          glowHex: sharedGlow,
          energy: clamp(ambientEnergy + 0.06, 0.08, 1)
        }),
        buildActor({
          key: "exchange_pass_arc",
          kind: "arch",
          x: 0,
          y: 1.5,
          z: -3.6,
          width: 3.1,
          height: 3.1,
          depth: 0.16,
          accentHex: sharedGlow,
          glowHex: sharedCore,
          energy: actorEnergy(nodes, 2, ambientEnergy),
          rotationY: Math.PI / 6
        })
      ];
    case "ops_citadel":
      return [
        buildActor({
          key: "ops_watchtower_west",
          kind: "watchtower",
          x: -4.2,
          y: 1.25,
          z: -0.8,
          width: 0.64,
          height: 2.7 + actorEnergy(nodes, 0, ambientEnergy),
          depth: 0.64,
          accentHex: theme.ring_hex,
          glowHex: sharedGlow,
          energy: actorEnergy(nodes, 0, ambientEnergy)
        }),
        buildActor({
          key: "ops_watchtower_east",
          kind: "watchtower",
          x: 4.2,
          y: 1.2,
          z: 0.8,
          width: 0.6,
          height: 2.5 + actorEnergy(nodes, 1, ambientEnergy),
          depth: 0.6,
          accentHex: theme.ring_secondary_hex,
          glowHex: sharedCore,
          energy: actorEnergy(nodes, 1, ambientEnergy)
        }),
        buildActor({
          key: "ops_signal_array",
          kind: "array",
          x: 0,
          y: 1.05,
          z: -4.05,
          width: 3.6,
          height: 1.2,
          depth: 0.2,
          accentHex: theme.light_hex,
          glowHex: sharedGlow,
          energy: actorEnergy(nodes, 2, ambientEnergy)
        }),
        buildActor({
          key: "ops_audit_spine",
          kind: "spine",
          x: 0,
          y: 1.25,
          z: 4.1,
          width: 0.24,
          height: 2.4 + actorEnergy(nodes, 3, ambientEnergy),
          depth: 0.24,
          accentHex: sharedCore,
          glowHex: sharedCore,
          energy: actorEnergy(nodes, 3, ambientEnergy)
        })
      ];
    default:
      return [
        buildActor({
          key: "hub_gate_north",
          kind: "gate",
          x: 0,
          y: 1.1,
          z: -4.05,
          width: 3.2,
          height: 2.2,
          depth: 0.28,
          accentHex: theme.ring_hex,
          glowHex: sharedGlow,
          energy: actorEnergy(nodes, 0, ambientEnergy)
        }),
        buildActor({
          key: "hub_gate_south",
          kind: "gate",
          x: 0,
          y: 1.05,
          z: 4.05,
          width: 2.8,
          height: 2,
          depth: 0.24,
          accentHex: theme.ring_secondary_hex,
          glowHex: sharedCore,
          energy: actorEnergy(nodes, 1, ambientEnergy)
        }),
        buildActor({
          key: "hub_guidance_arch",
          kind: "arch",
          x: 0,
          y: 1.55,
          z: 0,
          width: 3.4,
          height: 3.4,
          depth: 0.14,
          accentHex: theme.light_hex,
          glowHex: sharedGlow,
          energy: clamp(ambientEnergy, 0.08, 1),
          rotationY: Math.PI / 8
        })
      ].slice(0, lowEndMode ? 2 : 3);
  }
}

function buildDistrictHotspots(districtKey, nodes, theme, ambientEnergy, lowEndMode, allowSecondaryHotspots) {
  const compactRadius = lowEndMode ? 0.34 : 0.42;
  const expanded = !lowEndMode && allowSecondaryHotspots;
  switch (districtKey) {
    case "arena_prime":
      return finalizeHotspots([
        buildHotspot({
          key: "duel_pit",
          label: "Duel Pit",
          labelKey: "world_hotspot_duel_pit",
          actionKey: nodes[0]?.action_key,
          actorKey: "arena_hazard_arc",
          interactionKind: "compete",
          hintLabelKey: "world_hotspot_hint_compete",
          x: 0,
          y: 0.2,
          z: 0.1,
          focusY: 0.9,
          cameraRadiusScale: 0.9,
          cameraBetaOffset: -0.02,
          radius: compactRadius + 0.06,
          accentHex: theme.ring_hex,
          energy: actorEnergy(nodes, 0, ambientEnergy)
        }),
        ...(expanded
          ? [
              buildHotspot({
                key: "arena_event_gate",
                label: "Event Gate",
                labelKey: "world_hotspot_arena_event_gate",
                actionKey: SHELL_ACTION_KEY.PLAYER_EVENTS_HALL,
                actorKey: "arena_hazard_arc",
                interactionKind: "travel",
                hintLabelKey: "world_hotspot_hint_travel",
                isSecondary: true,
                x: 1.1,
                y: 0.18,
                z: -1.15,
                focusY: 0.88,
                cameraRadiusScale: 0.94,
                cameraAlphaOffset: -0.08,
                cameraBetaOffset: -0.015,
                radius: compactRadius - 0.08,
                accentHex: theme.ring_secondary_hex,
                energy: actorEnergy(nodes, 0, ambientEnergy)
              })
            ]
          : []),
        buildHotspot({
          key: "ladder_bridge",
          label: "Ladder Bridge",
          labelKey: "world_hotspot_ladder_bridge",
          actionKey: nodes[1]?.action_key,
          actorKey: "arena_crown_east",
          interactionKind: "climb",
          hintLabelKey: "world_hotspot_hint_climb",
          x: 4.25,
          y: 0.18,
          z: 0.9,
          focusY: 0.84,
          cameraRadiusScale: 0.92,
          cameraAlphaOffset: 0.05,
          radius: compactRadius,
          accentHex: theme.ring_secondary_hex,
          energy: actorEnergy(nodes, 1, ambientEnergy)
        }),
        ...(expanded
          ? [
              buildHotspot({
                key: "ranking_orbit",
                label: "Ranking Orbit",
                labelKey: "world_hotspot_ranking_orbit",
                actionKey: SHELL_ACTION_KEY.PLAYER_PVP_LEADERBOARD,
                actorKey: "arena_crown_east",
                interactionKind: "review",
                hintLabelKey: "world_hotspot_hint_review",
                isSecondary: true,
                x: 3.3,
                y: 0.16,
                z: -0.95,
                focusY: 0.78,
                cameraRadiusScale: 0.97,
                cameraAlphaOffset: 0.08,
                cameraBetaOffset: 0.01,
                radius: compactRadius - 0.08,
                accentHex: theme.light_hex,
                energy: actorEnergy(nodes, 1, ambientEnergy)
              })
            ]
          : []),
        buildHotspot({
          key: "diagnostics_rail",
          label: "Diagnostics Rail",
          labelKey: "world_hotspot_diagnostics_rail",
          actionKey: nodes[2]?.action_key,
          actorKey: "arena_spine",
          interactionKind: "review",
          hintLabelKey: "world_hotspot_hint_review",
          x: 0,
          y: 0.14,
          z: -3.35,
          focusY: 0.72,
          cameraRadiusScale: 0.96,
          cameraAlphaOffset: -0.03,
          radius: compactRadius - 0.04,
          accentHex: theme.light_hex,
          energy: actorEnergy(nodes, 2, ambientEnergy)
        }),
        ...(expanded && nodes[3]?.action_key
          ? [
              buildHotspot({
                key: "tick_chamber",
                label: "Tick Chamber",
                labelKey: "world_hotspot_tick_chamber",
                actionKey: nodes[3]?.action_key,
                actorKey: "arena_spine",
                interactionKind: "launch",
                hintLabelKey: "world_hotspot_hint_launch",
                isSecondary: true,
                x: -1.15,
                y: 0.14,
                z: -2.65,
                focusY: 0.72,
                cameraRadiusScale: 1,
                cameraAlphaOffset: -0.11,
                radius: compactRadius - 0.1,
                accentHex: theme.ring_hex,
                energy: actorEnergy(nodes, 3, ambientEnergy)
              })
            ]
          : [])
      ]);
    case "mission_quarter":
      return finalizeHotspots([
        buildHotspot({
          key: "offer_desk",
          label: "Offer Desk",
          labelKey: "world_hotspot_offer_desk",
          actionKey: nodes[0]?.action_key,
          actorKey: "mission_terminal_alpha",
          interactionKind: "launch",
          hintLabelKey: "world_hotspot_hint_launch",
          x: -3.7,
          y: 0.12,
          z: -1.4,
          focusY: 0.78,
          cameraRadiusScale: 0.94,
          radius: compactRadius,
          accentHex: theme.ring_hex,
          energy: actorEnergy(nodes, 0, ambientEnergy)
        }),
        ...(expanded
          ? [
              buildHotspot({
                key: "briefing_arc",
                label: "Briefing Arc",
                labelKey: "world_hotspot_briefing_arc",
                actionKey: SHELL_ACTION_KEY.PLAYER_DISCOVER_CENTER,
                actorKey: "mission_terminal_alpha",
                interactionKind: "review",
                hintLabelKey: "world_hotspot_hint_review",
                isSecondary: true,
                x: -2.7,
                y: 0.12,
                z: -2.35,
                focusY: 0.8,
                cameraRadiusScale: 0.98,
                cameraAlphaOffset: -0.07,
                radius: compactRadius - 0.08,
                accentHex: theme.ring_secondary_hex,
                energy: actorEnergy(nodes, 0, ambientEnergy)
              })
            ]
          : []),
        buildHotspot({
          key: "streak_pulse",
          label: "Streak Pulse",
          labelKey: "world_hotspot_streak_pulse",
          actionKey: nodes[1]?.action_key,
          actorKey: "mission_terminal_beta",
          interactionKind: "track",
          hintLabelKey: "world_hotspot_hint_track",
          x: 3.7,
          y: 0.12,
          z: -1.1,
          focusY: 0.76,
          cameraRadiusScale: 0.95,
          radius: compactRadius - 0.02,
          accentHex: theme.ring_secondary_hex,
          energy: actorEnergy(nodes, 1, ambientEnergy)
        }),
        buildHotspot({
          key: "claim_dais",
          label: "Claim Dais",
          labelKey: "world_hotspot_claim_dais",
          actionKey: nodes[2]?.action_key,
          actorKey: "mission_contract_spine",
          interactionKind: "claim",
          hintLabelKey: "world_hotspot_hint_claim",
          x: 0,
          y: 0.14,
          z: 3.45,
          focusY: 0.78,
          cameraRadiusScale: 0.92,
          radius: compactRadius,
          accentHex: theme.light_hex,
          energy: actorEnergy(nodes, 2, ambientEnergy)
        }),
        ...(expanded && nodes[3]?.action_key
          ? [
              buildHotspot({
                key: "contract_pulse",
                label: "Contract Pulse",
                labelKey: "world_hotspot_contract_pulse",
                actionKey: nodes[3]?.action_key,
                actorKey: "mission_contract_spine",
                interactionKind: "track",
                hintLabelKey: "world_hotspot_hint_track",
                isSecondary: true,
                x: 1.05,
                y: 0.16,
                z: 2.55,
                focusY: 0.8,
                cameraRadiusScale: 0.98,
                cameraAlphaOffset: 0.09,
                radius: compactRadius - 0.08,
                accentHex: theme.ring_hex,
                energy: actorEnergy(nodes, 3, ambientEnergy)
              })
            ]
          : [])
      ]);
    case "exchange_district":
      return finalizeHotspots([
        buildHotspot({
          key: "wallet_dock",
          label: "Wallet Dock",
          labelKey: "world_hotspot_wallet_dock",
          actionKey: nodes[0]?.action_key,
          actorKey: "exchange_vault_west",
          interactionKind: "connect",
          hintLabelKey: "world_hotspot_hint_connect",
          x: -4.05,
          y: 0.14,
          z: 0.9,
          focusY: 0.78,
          cameraRadiusScale: 0.95,
          radius: compactRadius,
          accentHex: theme.ring_hex,
          energy: actorEnergy(nodes, 0, ambientEnergy)
        }),
        ...(expanded
          ? [
              buildHotspot({
                key: "rewards_vault",
                label: "Rewards Vault",
                labelKey: "world_hotspot_rewards_vault",
                actionKey: SHELL_ACTION_KEY.PLAYER_REWARDS_PANEL,
                actorKey: "exchange_vault_west",
                interactionKind: "claim",
                hintLabelKey: "world_hotspot_hint_claim",
                isSecondary: true,
                x: -2.9,
                y: 0.12,
                z: -0.8,
                focusY: 0.78,
                cameraRadiusScale: 1,
                cameraAlphaOffset: -0.08,
                radius: compactRadius - 0.08,
                accentHex: theme.ring_secondary_hex,
                energy: actorEnergy(nodes, 2, ambientEnergy)
              })
            ]
          : []),
        buildHotspot({
          key: "payout_bay",
          label: "Payout Bay",
          labelKey: "world_hotspot_payout_bay",
          actionKey: nodes[1]?.action_key,
          actorKey: "exchange_vault_east",
          interactionKind: "payout",
          hintLabelKey: "world_hotspot_hint_payout",
          x: 4.05,
          y: 0.14,
          z: -0.9,
          focusY: 0.82,
          cameraRadiusScale: 0.93,
          radius: compactRadius,
          accentHex: theme.ring_secondary_hex,
          energy: actorEnergy(nodes, 1, ambientEnergy)
        }),
        ...(expanded
          ? [
              buildHotspot({
                key: "support_bay",
                label: "Support Bay",
                labelKey: "world_hotspot_support_bay",
                actionKey: SHELL_ACTION_KEY.PLAYER_SUPPORT_STATUS,
                actorKey: "exchange_vault_east",
                interactionKind: "review",
                hintLabelKey: "world_hotspot_hint_review",
                isSecondary: true,
                x: 2.95,
                y: 0.14,
                z: 1.1,
                focusY: 0.78,
                cameraRadiusScale: 0.98,
                cameraAlphaOffset: 0.08,
                radius: compactRadius - 0.08,
                accentHex: theme.light_hex,
                energy: actorEnergy(nodes, 1, ambientEnergy)
              })
            ]
          : []),
        buildHotspot({
          key: "premium_lane",
          label: "Premium Lane",
          labelKey: "world_hotspot_premium_lane",
          actionKey: nodes[2]?.action_key,
          actorKey: "exchange_pass_arc",
          interactionKind: "upgrade",
          hintLabelKey: "world_hotspot_hint_upgrade",
          x: 0,
          y: 0.16,
          z: -3.1,
          focusY: 0.86,
          cameraRadiusScale: 0.9,
          radius: compactRadius - 0.02,
          accentHex: theme.light_hex,
          energy: actorEnergy(nodes, 2, ambientEnergy)
        })
      ]);
    case "ops_citadel":
      return finalizeHotspots([
        buildHotspot({
          key: "queue_gate",
          label: "Queue Gate",
          labelKey: "world_hotspot_queue_gate",
          actionKey: nodes[0]?.action_key,
          actorKey: "ops_watchtower_west",
          interactionKind: "review",
          hintLabelKey: "world_hotspot_hint_review",
          x: -4.15,
          y: 0.16,
          z: -0.2,
          focusY: 0.82,
          cameraRadiusScale: 0.96,
          radius: compactRadius,
          accentHex: theme.ring_hex,
          energy: actorEnergy(nodes, 0, ambientEnergy)
        }),
        ...(expanded
          ? [
              buildHotspot({
                key: "policy_lens",
                label: "Policy Lens",
                labelKey: "world_hotspot_policy_lens",
                actionKey: SHELL_ACTION_KEY.ADMIN_POLICY_PANEL,
                actorKey: "ops_watchtower_west",
                interactionKind: "review",
                hintLabelKey: "world_hotspot_hint_review",
                isSecondary: true,
                x: -2.9,
                y: 0.14,
                z: 1.15,
                focusY: 0.8,
                cameraRadiusScale: 0.99,
                cameraAlphaOffset: -0.08,
                radius: compactRadius - 0.08,
                accentHex: theme.ring_secondary_hex,
                energy: actorEnergy(nodes, 0, ambientEnergy)
              })
            ]
          : []),
        buildHotspot({
          key: "runtime_dais",
          label: "Runtime Dais",
          labelKey: "world_hotspot_runtime_dais",
          actionKey: nodes[1]?.action_key,
          actorKey: "ops_watchtower_east",
          interactionKind: "monitor",
          hintLabelKey: "world_hotspot_hint_monitor",
          x: 4.15,
          y: 0.16,
          z: 0.2,
          focusY: 0.84,
          cameraRadiusScale: 0.94,
          radius: compactRadius,
          accentHex: theme.ring_secondary_hex,
          energy: actorEnergy(nodes, 1, ambientEnergy)
        }),
        ...(expanded
          ? [
              buildHotspot({
                key: "flags_console",
                label: "Flags Console",
                labelKey: "world_hotspot_flags_console",
                actionKey: SHELL_ACTION_KEY.ADMIN_RUNTIME_FLAGS,
                actorKey: "ops_watchtower_east",
                interactionKind: "monitor",
                hintLabelKey: "world_hotspot_hint_monitor",
                isSecondary: true,
                x: 2.95,
                y: 0.14,
                z: -1.05,
                focusY: 0.8,
                cameraRadiusScale: 1,
                cameraAlphaOffset: 0.08,
                radius: compactRadius - 0.08,
                accentHex: theme.light_hex,
                energy: actorEnergy(nodes, 1, ambientEnergy)
              })
            ]
          : []),
        buildHotspot({
          key: "liveops_table",
          label: "LiveOps Table",
          labelKey: "world_hotspot_liveops_table",
          actionKey: nodes[2]?.action_key,
          actorKey: "ops_signal_array",
          interactionKind: "dispatch",
          hintLabelKey: "world_hotspot_hint_dispatch",
          x: 0,
          y: 0.16,
          z: -3.45,
          focusY: 0.86,
          cameraRadiusScale: 0.92,
          radius: compactRadius - 0.02,
          accentHex: theme.light_hex,
          energy: actorEnergy(nodes, 2, ambientEnergy)
        }),
        ...(expanded
          ? [
              buildHotspot({
                key: "bot_relay",
                label: "Bot Relay",
                labelKey: "world_hotspot_bot_relay",
                actionKey: SHELL_ACTION_KEY.ADMIN_RUNTIME_BOT,
                actorKey: "ops_signal_array",
                interactionKind: "monitor",
                hintLabelKey: "world_hotspot_hint_monitor",
                isSecondary: true,
                x: 1.05,
                y: 0.15,
                z: -2.35,
                focusY: 0.84,
                cameraRadiusScale: 0.98,
                cameraAlphaOffset: 0.1,
                radius: compactRadius - 0.08,
                accentHex: theme.ring_hex,
                energy: actorEnergy(nodes, 2, ambientEnergy)
              })
            ]
          : [])
      ]);
    default:
      return finalizeHotspots([
        buildHotspot({
          key: "season_gate",
          label: "Season Gate",
          labelKey: "world_hotspot_season_gate",
          actionKey: nodes[0]?.action_key,
          actorKey: "hub_gate_north",
          interactionKind: "travel",
          hintLabelKey: "world_hotspot_hint_travel",
          x: 0,
          y: 0.16,
          z: -3.45,
          focusY: 0.8,
          cameraRadiusScale: 0.92,
          radius: compactRadius,
          accentHex: theme.ring_hex,
          energy: actorEnergy(nodes, 0, ambientEnergy)
        }),
        ...(expanded
          ? [
              buildHotspot({
                key: "events_portal",
                label: "Events Portal",
                labelKey: "world_hotspot_events_portal",
                actionKey: SHELL_ACTION_KEY.PLAYER_EVENTS_HALL,
                actorKey: "hub_gate_north",
                interactionKind: "travel",
                hintLabelKey: "world_hotspot_hint_travel",
                isSecondary: true,
                x: 1.2,
                y: 0.16,
                z: -2.55,
                focusY: 0.8,
                cameraRadiusScale: 0.98,
                cameraAlphaOffset: -0.08,
                radius: compactRadius - 0.08,
                accentHex: theme.ring_secondary_hex,
                energy: actorEnergy(nodes, 0, ambientEnergy)
              })
            ]
          : []),
        buildHotspot({
          key: "mission_desk",
          label: "Mission Desk",
          labelKey: "world_hotspot_mission_desk",
          actionKey: nodes[1]?.action_key,
          actorKey: "hub_guidance_arch",
          interactionKind: "launch",
          hintLabelKey: "world_hotspot_hint_launch",
          x: -2.35,
          y: 0.16,
          z: 1.55,
          focusY: 0.76,
          cameraRadiusScale: 0.96,
          radius: compactRadius - 0.02,
          accentHex: theme.ring_secondary_hex,
          energy: actorEnergy(nodes, 1, ambientEnergy)
        }),
        ...(expanded
          ? [
              buildHotspot({
                key: "discover_arc",
                label: "Discover Arc",
                labelKey: "world_hotspot_discover_arc",
                actionKey: SHELL_ACTION_KEY.PLAYER_DISCOVER_CENTER,
                actorKey: "hub_guidance_arch",
                interactionKind: "review",
                hintLabelKey: "world_hotspot_hint_review",
                isSecondary: true,
                x: -1.15,
                y: 0.16,
                z: 2.35,
                focusY: 0.78,
                cameraRadiusScale: 0.98,
                cameraAlphaOffset: 0.08,
                radius: compactRadius - 0.08,
                accentHex: theme.light_hex,
                energy: actorEnergy(nodes, 1, ambientEnergy)
              })
            ]
          : []),
        buildHotspot({
          key: "wallet_port",
          label: "Wallet Port",
          labelKey: "world_hotspot_wallet_port",
          actionKey: nodes[2]?.action_key,
          actorKey: "hub_gate_south",
          interactionKind: "connect",
          hintLabelKey: "world_hotspot_hint_connect",
          x: 2.35,
          y: 0.16,
          z: 1.55,
          focusY: 0.76,
          cameraRadiusScale: 0.96,
          radius: compactRadius - 0.02,
          accentHex: theme.light_hex,
          energy: actorEnergy(nodes, 2, ambientEnergy)
        }),
        ...(expanded
          ? [
              buildHotspot({
                key: "rewards_cache",
                label: "Rewards Cache",
                labelKey: "world_hotspot_rewards_cache",
                actionKey: SHELL_ACTION_KEY.PLAYER_REWARDS_PANEL,
                actorKey: "hub_gate_south",
                interactionKind: "claim",
                hintLabelKey: "world_hotspot_hint_claim",
                isSecondary: true,
                x: 1.15,
                y: 0.16,
                z: 2.35,
                focusY: 0.78,
                cameraRadiusScale: 0.98,
                cameraAlphaOffset: -0.08,
                radius: compactRadius - 0.08,
                accentHex: theme.ring_hex,
                energy: actorEnergy(nodes, 2, ambientEnergy)
              })
            ]
          : [])
      ]);
  }
}

function resolveFallbackActiveNodeKey(workspace, tab) {
  if (workspace === "admin") {
    return "queue_bastion";
  }
  if (tab === "pvp") {
    return "duel_core";
  }
  if (tab === "tasks") {
    return "offers_terminal";
  }
  if (tab === "vault") {
    return "wallet_gate";
  }
  return "season_arc";
}

function resolveActiveNodeKey(nodes, navigationContext, workspace, tab) {
  const context = asRecord(navigationContext);
  const actionKey = toText(context.shell_action_key || context.action_key || "");
  if (actionKey) {
    const byAction = nodes.find((node) => node.action_key === actionKey);
    if (byAction) {
      return byAction.key;
    }
  }

  const panelKey = toText(context.panel_key || "");
  if (panelKey) {
    const byPanel = nodes.find((node) => panelKey.includes(String(node.laneKey || "")) || String(node.laneKey || "").includes(panelKey));
    if (byPanel) {
      return byPanel.key;
    }
  }

  return resolveFallbackActiveNodeKey(workspace, tab);
}

function resolveActiveHotspotKey(hotspots, navigationContext, activeNode) {
  const context = asRecord(navigationContext);
  const actionKey = toText(context.shell_action_key || context.action_key || activeNode?.action_key || "");
  if (actionKey) {
    const byAction = hotspots.find((hotspot) => hotspot.action_key === actionKey);
    if (byAction) {
      return byAction.key;
    }
  }
  return toText(hotspots[0]?.key, "");
}

function buildPlayerHomeNodes(input) {
  const homeFeed = asRecord(input.homeFeed);
  const season = asRecord(homeFeed.season);
  const mission = asRecord(homeFeed.mission);
  const walletQuick = asRecord(homeFeed.wallet_quick);
  const risk = asRecord(homeFeed.risk);
  const commandHints = asList(homeFeed.command_hint);
  const seasonEnergy = clamp(
    Math.max(
      pickNumber(season, ["progress_pct", "progress", "completion_pct"], 0) / 100,
      pickNumber(season, ["heat_pct", "power_pct"], 0) / 100,
      commandHints.length ? 0.36 : 0.2
    ),
    0.18,
    1
  );
  const missionEnergy = clamp(
    Math.max(
      pickNumber(mission, ["active_count", "offer_count", "pending_count"], 0) / 5,
      pickNumber(mission, ["completion_pct"], 0) / 100
    ),
    0.16,
    1
  );
  const walletEnergy = clamp(
    pickTruthy(walletQuick, ["linked", "wallet_linked", "active"]) ? 0.72 : 0.28,
    0.18,
    1
  );
  const riskEnergy = clamp(
    Math.max(
      pickNumber(risk, ["score_pct", "heat_pct"], 0) / 100,
      ["warn", "review", "high"].includes(toText(risk.band || risk.state || "").toLowerCase()) ? 0.72 : 0.24
    ),
    0.12,
    1
  );
  return [
    buildNode({
      key: "season_arc",
      laneKey: "season",
      label: "Season Arc",
      labelKey: "world_node_season_arc",
      metric: `${Math.round(seasonEnergy * 100)}%`,
      actionKey: SHELL_ACTION_KEY.PLAYER_SEASON_HALL,
      energy: seasonEnergy
    }),
    buildNode({
      key: "mission_lane",
      laneKey: "tasks",
      label: "Mission Lane",
      labelKey: "world_node_mission_lane",
      metric: `${Math.round(missionEnergy * 100)}%`,
      actionKey: SHELL_ACTION_KEY.PLAYER_TASKS_BOARD,
      energy: missionEnergy
    }),
    buildNode({
      key: "wallet_lane",
      laneKey: "vault",
      label: "Wallet Lane",
      labelKey: "world_node_wallet_lane",
      metric: pickTruthy(walletQuick, ["linked", "wallet_linked", "active"]) ? "LIVE" : "LOCKED",
      actionKey: SHELL_ACTION_KEY.PLAYER_WALLET_CONNECT,
      energy: walletEnergy
    }),
    buildNode({
      key: "risk_lane",
      laneKey: "risk",
      label: "Risk Pulse",
      labelKey: "world_node_risk_lane",
      metric: toText(risk.band || risk.state || "stable").toUpperCase(),
      actionKey: SHELL_ACTION_KEY.PLAYER_SUPPORT_STATUS,
      energy: riskEnergy,
      statusKey: riskEnergy >= 0.7 ? "warn" : "good"
    })
  ];
}

function buildPlayerPvpNodes(input) {
  const pvpRuntime = asRecord(input.pvpRuntime);
  const leagueOverview = asRecord(input.leagueOverview);
  const pvpLive = asRecord(input.pvpLive);
  const session = asRecord(pvpRuntime.session || pvpRuntime);
  const dailyDuel = asRecord(leagueOverview.daily_duel);
  const weeklyLadder = asRecord(leagueOverview.weekly_ladder);
  const diagnostics = asRecord(pvpLive.diagnostics);
  const tick = asRecord(pvpLive.tick);
  return [
    buildNode({
      key: "duel_core",
      laneKey: "pvp_daily_duel",
      label: "Daily Duel",
      labelKey: "world_node_duel_core",
      metric: toText(session.phase || dailyDuel.phase || "idle").toUpperCase(),
      actionKey: SHELL_ACTION_KEY.PLAYER_PVP_DAILY_DUEL,
      energy: clamp(Math.max(pickNumber(session, ["tempo_pct", "pressure_pct"], 0) / 100, 0.44), 0.18, 1)
    }),
    buildNode({
      key: "ladder_spire",
      laneKey: "pvp_weekly_ladder",
      label: "Weekly Ladder",
      labelKey: "world_node_ladder_spire",
      metric: `${Math.round(clamp(pickNumber(weeklyLadder, ["completion_pct", "rank_progress_pct"], 36) / 100, 0.18, 1) * 100)}%`,
      actionKey: SHELL_ACTION_KEY.PLAYER_PVP_WEEKLY_LADDER,
      energy: clamp(Math.max(pickNumber(weeklyLadder, ["completion_pct", "rank_progress_pct"], 0) / 100, 0.36), 0.18, 1)
    }),
    buildNode({
      key: "diagnostic_array",
      laneKey: "pvp_diagnostics",
      label: "Diagnostics",
      labelKey: "world_node_diagnostic_array",
      metric: toText(diagnostics.category || diagnostics.state || "clean").toUpperCase(),
      actionKey: SHELL_ACTION_KEY.PLAYER_PVP_LEADERBOARD,
      energy: clamp(Math.max(pickNumber(diagnostics, ["risk_pct", "reject_pct"], 0) / 100, 0.24), 0.12, 1),
      statusKey: toText(diagnostics.category || diagnostics.state || "").toLowerCase().includes("clean") ? "good" : ""
    }),
    buildNode({
      key: "tick_theater",
      laneKey: "pvp_tick",
      label: "Tick Theater",
      labelKey: "world_node_tick_theater",
      metric: `${Math.max(0, Math.round(pickNumber(tick, ["tempo_ms", "tick_ms"], 0)))}ms`,
      actionKey: SHELL_ACTION_KEY.PLAYER_PVP_DAILY_DUEL,
      energy: clamp(Math.max(1 - pickNumber(tick, ["tempo_ms", "tick_ms"], 1000) / 1400, 0.22), 0.12, 1)
    })
  ];
}

function buildPlayerTasksNodes(input) {
  const taskResult = asRecord(input.taskResult);
  const homeFeed = asRecord(input.homeFeed);
  const mission = asRecord(homeFeed.mission);
  const daily = asRecord(homeFeed.daily);
  const contract = asRecord(homeFeed.contract);
  return [
    buildNode({
      key: "offers_terminal",
      laneKey: "tasks_offers",
      label: "Offer Grid",
      labelKey: "world_node_offers_terminal",
      metric: String(Math.max(0, pickNumber(taskResult, ["offer_count", "offers_count"], pickNumber(mission, ["offer_count", "active_count"], 0)))),
      actionKey: SHELL_ACTION_KEY.PLAYER_TASKS_BOARD,
      energy: clamp(Math.max(pickNumber(taskResult, ["offer_count", "offers_count"], pickNumber(mission, ["offer_count", "active_count"], 0)) / 4, 0.24), 0.12, 1)
    }),
    buildNode({
      key: "streak_tower",
      laneKey: "daily_streak",
      label: "Streak Tower",
      labelKey: "world_node_streak_tower",
      metric: `${Math.max(0, Math.round(pickNumber(daily, ["streak_days", "streak"], 0)))}d`,
      actionKey: SHELL_ACTION_KEY.PLAYER_TASKS_BOARD,
      energy: clamp(Math.max(pickNumber(daily, ["streak_days", "streak"], 0) / 7, 0.18), 0.12, 1)
    }),
    buildNode({
      key: "claim_bridge",
      laneKey: "mission_claim",
      label: "Claim Bridge",
      labelKey: "world_node_claim_bridge",
      metric: String(Math.max(0, pickNumber(taskResult, ["claimable_count"], pickNumber(mission, ["claimable_count"], 0)))),
      actionKey: SHELL_ACTION_KEY.PLAYER_TASKS_CLAIMS,
      energy: clamp(Math.max(pickNumber(taskResult, ["claimable_count"], pickNumber(mission, ["claimable_count"], 0)) / 3, 0.18), 0.12, 1)
    }),
    buildNode({
      key: "contract_spire",
      laneKey: "contract",
      label: "Contract Pulse",
      labelKey: "world_node_contract_spire",
      metric: toText(contract.band || contract.state || "open").toUpperCase(),
      actionKey: SHELL_ACTION_KEY.PLAYER_TASKS_CLAIMS,
      energy: clamp(Math.max(pickNumber(contract, ["completion_pct", "heat_pct"], 0) / 100, 0.28), 0.12, 1)
    })
  ];
}

function buildPlayerVaultNodes(input) {
  const vaultData = asRecord(input.vaultData);
  const walletSession = asRecord(vaultData.wallet_session);
  const payoutStatus = asRecord(vaultData.payout_status);
  const monetization = asRecord(vaultData.monetization_status);
  const routeStatus = asRecord(vaultData.route_status);
  return [
    buildNode({
      key: "wallet_gate",
      laneKey: "wallet",
      label: "Wallet Gate",
      labelKey: "world_node_wallet_gate",
      metric: pickTruthy(walletSession, ["active", "linked"]) ? "LIVE" : "OPEN",
      actionKey: SHELL_ACTION_KEY.PLAYER_WALLET_CONNECT,
      energy: pickTruthy(walletSession, ["active", "linked"]) ? 0.78 : 0.32
    }),
    buildNode({
      key: "payout_lift",
      laneKey: "payout",
      label: "Payout Lift",
      labelKey: "world_node_payout_lift",
      metric: toText(payoutStatus.state || payoutStatus.status || "idle").toUpperCase(),
      actionKey: SHELL_ACTION_KEY.PLAYER_PAYOUT_REQUEST,
      energy: clamp(Math.max(pickNumber(payoutStatus, ["readiness_pct", "eligible_pct"], 0) / 100, 0.24), 0.12, 1)
    }),
    buildNode({
      key: "premium_arcade",
      laneKey: "premium",
      label: "Premium Pass",
      labelKey: "world_node_premium_arcade",
      metric: pickTruthy(monetization, ["pass_active", "active", "premium_active"]) ? "ACTIVE" : "READY",
      actionKey: SHELL_ACTION_KEY.PLAYER_REWARDS_PANEL,
      energy: pickTruthy(monetization, ["pass_active", "active", "premium_active"]) ? 0.7 : 0.3
    }),
    buildNode({
      key: "route_engine",
      laneKey: "route",
      label: "Route Engine",
      labelKey: "world_node_route_engine",
      metric: toText(routeStatus.state || routeStatus.health || "ready").toUpperCase(),
      actionKey: SHELL_ACTION_KEY.PLAYER_REWARDS_PANEL,
      energy: clamp(Math.max(pickNumber(routeStatus, ["coverage_pct", "completion_pct"], 0) / 100, 0.26), 0.12, 1)
    })
  ];
}

function buildAdminNodes(input) {
  const adminRuntime = asRecord(input.adminRuntime);
  const summary = asRecord(adminRuntime.summary);
  const queue = asList(adminRuntime.queue);
  const queueCount = queue.length;
  const schedulerState = toText(summary.live_ops_scheduler_state || summary.scheduler_state || "ready");
  const sceneHealth = toText(summary.scene_runtime_health_band_24h || summary.scene_health_band || "clear");
  return [
    buildNode({
      key: "queue_bastion",
      laneKey: "admin_queue",
      label: "Queue Bastion",
      labelKey: "world_node_queue_bastion",
      metric: String(queueCount),
      actionKey: SHELL_ACTION_KEY.ADMIN_QUEUE_PANEL,
      energy: clamp(Math.max(queueCount / 8, 0.22), 0.12, 1),
      statusKey: queueCount >= 6 ? "warn" : ""
    }),
    buildNode({
      key: "runtime_core",
      laneKey: "admin_runtime",
      label: "Runtime Core",
      labelKey: "world_node_runtime_core",
      metric: sceneHealth.toUpperCase(),
      actionKey: SHELL_ACTION_KEY.ADMIN_RUNTIME_META,
      energy: clamp(Math.max(pickNumber(summary, ["scene_runtime_ready_rate_24h"], 0) / 100, 0.34), 0.12, 1),
      statusKey: sceneHealth === "alert" ? "hot" : sceneHealth === "watch" ? "warn" : "good"
    }),
    buildNode({
      key: "liveops_spine",
      laneKey: "admin_liveops",
      label: "LiveOps Spine",
      labelKey: "world_node_liveops_spine",
      metric: schedulerState.toUpperCase(),
      actionKey: SHELL_ACTION_KEY.ADMIN_LIVE_OPS_PANEL,
      energy: clamp(Math.max(pickNumber(summary, ["live_ops_sent_24h", "sent_24h"], 0) / 20, 0.24), 0.12, 1)
    }),
    buildNode({
      key: "audit_orbit",
      laneKey: "admin_audit",
      label: "Audit Orbit",
      labelKey: "world_node_audit_orbit",
      metric: String(Math.max(0, pickNumber(summary, ["ops_alert_raised_24h", "alerts_24h"], 0))),
      actionKey: SHELL_ACTION_KEY.ADMIN_RUNTIME_META,
      energy: clamp(Math.max(pickNumber(summary, ["ops_alert_raised_24h", "alerts_24h"], 0) / 5, 0.18), 0.12, 1),
      statusKey: pickNumber(summary, ["ops_alert_raised_24h", "alerts_24h"], 0) > 0 ? "warn" : "good"
    })
  ];
}

function metricRow(labelKey, value) {
  const text = toText(value, "");
  if (!text) {
    return null;
  }
  return {
    label_key: labelKey,
    value: text
  };
}

function percentText(value) {
  const parsed = toNum(value, Number.NaN);
  if (!Number.isFinite(parsed)) {
    return "";
  }
  return `${Math.max(0, Math.round(parsed))}%`;
}

function countText(value) {
  const parsed = toNum(value, Number.NaN);
  if (!Number.isFinite(parsed)) {
    return "";
  }
  return String(Math.max(0, Math.round(parsed)));
}

function upperText(value) {
  return toText(value, "").toUpperCase();
}

function buildDistrictInteractionSheet(input, districtKey, activeHotspot, activeCluster) {
  if (!activeHotspot) {
    return null;
  }

  const homeFeed = asRecord(input.homeFeed);
  const season = asRecord(homeFeed.season);
  const mission = asRecord(homeFeed.mission);
  const walletQuick = asRecord(homeFeed.wallet_quick);
  const risk = asRecord(homeFeed.risk);
  const daily = asRecord(homeFeed.daily);
  const contract = asRecord(homeFeed.contract);
  const taskResult = asRecord(input.taskResult);
  const pvpRuntime = asRecord(input.pvpRuntime);
  const leagueOverview = asRecord(input.leagueOverview);
  const dailyDuel = asRecord(leagueOverview.daily_duel);
  const weeklyLadder = asRecord(leagueOverview.weekly_ladder);
  const pvpLive = asRecord(input.pvpLive);
  const diagnostics = asRecord(pvpLive.diagnostics);
  const tick = asRecord(pvpLive.tick);
  const vaultData = asRecord(input.vaultData);
  const walletSession = asRecord(vaultData.wallet_session);
  const payoutStatus = asRecord(vaultData.payout_status);
  const monetization = asRecord(vaultData.monetization_status);
  const routeStatus = asRecord(vaultData.route_status);
  const adminRuntime = asRecord(input.adminRuntime);
  const summary = asRecord(adminRuntime.summary);
  const queue = asList(adminRuntime.queue);

  let rows = [];
  let variantKey = districtKey;

  switch (districtKey) {
    case "arena_prime":
      rows = [
        metricRow("world_sheet_metric_duel_phase", upperText(pvpRuntime.phase || dailyDuel.phase)),
        metricRow("world_sheet_metric_ladder_charge", percentText(weeklyLadder.completion_pct || weeklyLadder.rank_progress_pct)),
        metricRow("world_sheet_metric_diag_band", upperText(diagnostics.category || diagnostics.state)),
        metricRow("world_sheet_metric_tick_tempo", toNum(tick.tempo_ms || tick.tick_ms, Number.NaN) ? `${Math.round(toNum(tick.tempo_ms || tick.tick_ms, 0))}ms` : "")
      ].filter(Boolean);
      break;
    case "mission_quarter":
      rows = [
        metricRow("world_sheet_metric_offer_count", countText(taskResult.offer_count || taskResult.offers_count || mission.offer_count || mission.active_count)),
        metricRow("world_sheet_metric_streak", countText(daily.streak_days || daily.streak) ? `${countText(daily.streak_days || daily.streak)}d` : ""),
        metricRow("world_sheet_metric_claimable", countText(taskResult.claimable_count || mission.claimable_count)),
        metricRow("world_sheet_metric_contract_band", upperText(contract.band || contract.state))
      ].filter(Boolean);
      break;
    case "exchange_district":
      rows = [
        metricRow("world_sheet_metric_wallet_state", pickTruthy(walletSession, ["active", "linked"]) ? "LIVE" : "OPEN"),
        metricRow("world_sheet_metric_payout_state", upperText(payoutStatus.state || payoutStatus.status)),
        metricRow(
          "world_sheet_metric_premium_state",
          pickTruthy(monetization, ["pass_active", "active", "premium_active"]) ? "ACTIVE" : "READY"
        ),
        metricRow("world_sheet_metric_route_state", upperText(routeStatus.state || routeStatus.health))
      ].filter(Boolean);
      break;
    case "ops_citadel":
      rows = [
        metricRow("world_sheet_metric_queue_depth", countText(queue.length)),
        metricRow("world_sheet_metric_scene_health", upperText(summary.scene_runtime_health_band_24h || summary.scene_health_band)),
        metricRow("world_sheet_metric_liveops_sent", countText(summary.live_ops_sent_24h || summary.sent_24h)),
        metricRow("world_sheet_metric_alerts", countText(summary.ops_alert_raised_24h || summary.alerts_24h))
      ].filter(Boolean);
      break;
    default:
      rows = [
        metricRow("world_sheet_metric_progress", percentText(season.progress_pct || season.progress || season.completion_pct)),
        metricRow("world_sheet_metric_active_missions", countText(mission.active_count || mission.offer_count)),
        metricRow("world_sheet_metric_wallet_state", pickTruthy(walletQuick, ["linked", "wallet_linked", "active"]) ? "LIVE" : "OPEN"),
        metricRow("world_sheet_metric_risk_band", upperText(risk.band || risk.state))
      ].filter(Boolean);
      variantKey = "central_hub";
      break;
  }

  return {
    sheet_key: `${districtKey}:${toText(activeHotspot.key, "sheet")}`,
    variant_key: variantKey,
    title_key: toText(activeHotspot.label_key, ""),
    title: toText(activeHotspot.label, ""),
    intent_label_key: toText(activeHotspot.intent_profile?.intent_label_key, ""),
    intent_tone_key: toText(activeHotspot.intent_profile?.intent_tone_key, ""),
    cluster_label_key: toText(activeCluster?.label_key, ""),
    cluster_label: toText(activeCluster?.label, ""),
    rows
  };
}

export function buildDistrictWorldState(input = {}) {
  const workspace = normalizeWorkspace(input.workspace);
  const tab = normalizeTab(input.tab);
  const scene = asRecord(input.scene);
  const sceneRuntime = asRecord(input.sceneRuntime);
  const capabilityProfile = asRecord(scene.capabilityProfile);
  const effectiveQuality = normalizeQuality(scene.effectiveQuality || sceneRuntime.effectiveQuality);
  const hudDensity = normalizeHudDensity(scene.hudDensity || sceneRuntime.hudDensity || capabilityProfile.effective_hud_density);
  const lowEndMode = Boolean(sceneRuntime.lowEndMode || capabilityProfile.low_end_mode || effectiveQuality === "low");
  const reducedMotion = Boolean(scene.reducedMotion || capabilityProfile.effective_reduced_motion);
  const districtKey = toText(sceneRuntime.districtKey || resolveDistrictKey(workspace, tab), resolveDistrictKey(workspace, tab));
  const districtLabelKey = resolveDistrictLabelKey(districtKey);
  const districtTheme = resolveDistrictTheme(districtKey);
  const sceneProfile = toText(capabilityProfile.scene_profile || (lowEndMode ? "lite" : effectiveQuality === "high" ? "cinematic" : "balanced"));
  const allowSecondaryHotspots = !lowEndMode && hudDensity !== "compact" && sceneProfile !== "lite";
  const modeLabelKey = resolveModeKey(sceneProfile, lowEndMode);

  const rawNodes =
    workspace === "admin"
      ? buildAdminNodes(input)
      : tab === "pvp"
        ? buildPlayerPvpNodes(input)
        : tab === "tasks"
          ? buildPlayerTasksNodes(input)
          : tab === "vault"
            ? buildPlayerVaultNodes(input)
            : buildPlayerHomeNodes(input);

  const nodeLimit = lowEndMode ? 3 : rawNodes.length;
  const activeNodeKey = resolveActiveNodeKey(rawNodes.slice(0, nodeLimit), input.navigationContext, workspace, tab);
  const nodes = rawNodes.slice(0, nodeLimit).map((node) => ({
    ...node,
    is_active: node.key === activeNodeKey
  }));
  const ambientEnergy = clamp(nodes.reduce((sum, node) => sum + node.energy, 0) / Math.max(1, nodes.length), 0.18, 1);
  const hotNodes = nodes.filter((node) => node.status_key === "hot").length;
  const warnNodes = nodes.filter((node) => node.status_key === "warn").length;
  const activeNode = nodes.find((node) => node.key === activeNodeKey) || null;
  const actors = buildDistrictActors(districtKey, nodes, districtTheme, ambientEnergy, lowEndMode);
  const hotspots = buildDistrictHotspots(districtKey, nodes, districtTheme, ambientEnergy, lowEndMode, allowSecondaryHotspots);
  const activeHotspotKey = resolveActiveHotspotKey(hotspots, input.navigationContext, activeNode);
  const activeHotspot = hotspots.find((hotspot) => hotspot.key === activeHotspotKey) || null;
  const interactionClusters = buildInteractionClusters(actors, hotspots, activeHotspotKey);
  const activeCluster = interactionClusters.find((cluster) => cluster.is_active) || null;
  const cameraProfile = resolveDistrictCameraProfile(districtKey, lowEndMode, effectiveQuality, hudDensity, sceneProfile);
  const hudProfile = resolveDistrictHudProfile(districtKey, hudDensity, lowEndMode, sceneProfile);
  const directorProfile = resolveDistrictDirectorProfile(districtKey, hudDensity, lowEndMode, sceneProfile);
  const railProfile = resolveDistrictRailProfile(districtKey, hudDensity, lowEndMode, sceneProfile);
  const interactionSheet = buildDistrictInteractionSheet(input, districtKey, activeHotspot, activeCluster);

  return {
    world_key: `${workspace}:${tab}:${districtKey}`,
    workspace,
    tab,
    district_key: districtKey,
    district_label_key: districtLabelKey,
    district_theme_key: districtTheme.theme_key,
    mode_label_key: modeLabelKey,
    scene_profile: sceneProfile,
    effective_quality: effectiveQuality,
    hud_density: hudDensity,
    low_end_mode: lowEndMode,
    reduced_motion: reducedMotion,
    ambient_energy: ambientEnergy,
    beacon_count: nodes.length,
    hot_nodes: hotNodes,
    warn_nodes: warnNodes,
    orbit_speed: lowEndMode || reducedMotion ? 0.00004 : effectiveQuality === "high" ? 0.00014 : 0.00009,
    camera_radius: cameraProfile.radius,
    hardware_scaling: lowEndMode ? 1.9 : effectiveQuality === "high" ? 1 : effectiveQuality === "medium" ? 1.25 : 1.6,
    active_node_key: activeNodeKey,
    active_node_label: toText(activeNode?.label, ""),
    active_node_label_key: toText(activeNode?.label_key, ""),
    active_action_key: toText(activeNode?.action_key, ""),
    camera_profile_key: cameraProfile.camera_profile_key,
    camera_profile: cameraProfile,
    hud_profile_key: hudProfile.hud_profile_key,
    hud_profile: hudProfile,
    director_profile_key: directorProfile.director_profile_key,
    director_profile: directorProfile,
    rail_profile_key: railProfile.rail_profile_key,
    rail_profile: railProfile,
    active_hotspot_key: activeHotspotKey,
    active_hotspot_label: toText(activeHotspot?.label, ""),
    active_hotspot_label_key: toText(activeHotspot?.label_key, ""),
    active_hotspot_hint_key: toText(activeHotspot?.hint_label_key, ""),
    active_hotspot_interaction_kind: toText(activeHotspot?.interaction_kind, ""),
    active_hotspot_intent_profile_key: toText(activeHotspot?.intent_profile_key, ""),
    active_hotspot_intent_label_key: toText(activeHotspot?.intent_profile?.intent_label_key, ""),
    active_hotspot_intent_tone_key: toText(activeHotspot?.intent_profile?.intent_tone_key, ""),
    active_hotspot_cluster_key: toText(activeHotspot?.cluster_key, ""),
    active_hotspot_is_secondary: Boolean(activeHotspot?.is_secondary),
    active_cluster_key: toText(activeCluster?.cluster_key, ""),
    active_cluster_label_key: toText(activeCluster?.label_key, ""),
    active_cluster_label: toText(activeCluster?.label, ""),
    active_cluster_primary_action_key: toText(activeCluster?.primary_action_key, ""),
    active_cluster_primary_hint_key: toText(activeCluster?.primary_hint_label_key, ""),
    active_cluster_secondary_count: toNum(activeCluster?.secondary_count, 0),
    active_cluster_actions: asList(activeCluster?.action_items),
    active_cluster_slot_count: toNum(activeCluster?.intent_slots?.length, 0),
    interaction_sheet: interactionSheet,
    theme: districtTheme,
    actors,
    interaction_cluster_count: interactionClusters.length,
    interaction_clusters: interactionClusters,
    hotspots: hotspots.map((hotspot) => ({
      ...hotspot,
      is_active: hotspot.key === activeHotspotKey
    })),
    nodes
  };
}
