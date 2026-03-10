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

export function buildDistrictWorldState(input = {}) {
  const workspace = normalizeWorkspace(input.workspace);
  const tab = normalizeTab(input.tab);
  const scene = asRecord(input.scene);
  const sceneRuntime = asRecord(input.sceneRuntime);
  const capabilityProfile = asRecord(scene.capabilityProfile);
  const effectiveQuality = normalizeQuality(scene.effectiveQuality || sceneRuntime.effectiveQuality);
  const lowEndMode = Boolean(sceneRuntime.lowEndMode || capabilityProfile.low_end_mode || effectiveQuality === "low");
  const reducedMotion = Boolean(scene.reducedMotion || capabilityProfile.effective_reduced_motion);
  const districtKey = toText(sceneRuntime.districtKey || resolveDistrictKey(workspace, tab), resolveDistrictKey(workspace, tab));
  const districtLabelKey = resolveDistrictLabelKey(districtKey);
  const districtTheme = resolveDistrictTheme(districtKey);
  const sceneProfile = toText(capabilityProfile.scene_profile || (lowEndMode ? "lite" : effectiveQuality === "high" ? "cinematic" : "balanced"));
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
    low_end_mode: lowEndMode,
    reduced_motion: reducedMotion,
    ambient_energy: ambientEnergy,
    beacon_count: nodes.length,
    hot_nodes: hotNodes,
    warn_nodes: warnNodes,
    orbit_speed: lowEndMode || reducedMotion ? 0.00004 : effectiveQuality === "high" ? 0.00014 : 0.00009,
    camera_radius: districtTheme.camera_radius,
    hardware_scaling: lowEndMode ? 1.9 : effectiveQuality === "high" ? 1 : effectiveQuality === "medium" ? 1.25 : 1.6,
    active_node_key: activeNodeKey,
    active_node_label: toText(activeNode?.label, ""),
    active_node_label_key: toText(activeNode?.label_key, ""),
    active_action_key: toText(activeNode?.action_key, ""),
    theme: districtTheme,
    actors,
    nodes
  };
}
