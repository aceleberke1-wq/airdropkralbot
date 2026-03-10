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
    metric: toText(input.metric, "--"),
    energy,
    status_key: statusKey,
    accent_hex: statusColor(statusKey)
  };
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
      metric: `${Math.round(seasonEnergy * 100)}%`,
      energy: seasonEnergy
    }),
    buildNode({
      key: "mission_lane",
      laneKey: "tasks",
      label: "Mission Lane",
      metric: `${Math.round(missionEnergy * 100)}%`,
      energy: missionEnergy
    }),
    buildNode({
      key: "wallet_lane",
      laneKey: "vault",
      label: "Wallet Lane",
      metric: pickTruthy(walletQuick, ["linked", "wallet_linked", "active"]) ? "LIVE" : "LOCKED",
      energy: walletEnergy
    }),
    buildNode({
      key: "risk_lane",
      laneKey: "risk",
      label: "Risk Pulse",
      metric: toText(risk.band || risk.state || "stable").toUpperCase(),
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
      metric: toText(session.phase || dailyDuel.phase || "idle").toUpperCase(),
      energy: clamp(Math.max(pickNumber(session, ["tempo_pct", "pressure_pct"], 0) / 100, 0.44), 0.18, 1)
    }),
    buildNode({
      key: "ladder_spire",
      laneKey: "pvp_weekly_ladder",
      label: "Weekly Ladder",
      metric: `${Math.round(clamp(pickNumber(weeklyLadder, ["completion_pct", "rank_progress_pct"], 36) / 100, 0.18, 1) * 100)}%`,
      energy: clamp(Math.max(pickNumber(weeklyLadder, ["completion_pct", "rank_progress_pct"], 0) / 100, 0.36), 0.18, 1)
    }),
    buildNode({
      key: "diagnostic_array",
      laneKey: "pvp_diagnostics",
      label: "Diagnostics",
      metric: toText(diagnostics.category || diagnostics.state || "clean").toUpperCase(),
      energy: clamp(Math.max(pickNumber(diagnostics, ["risk_pct", "reject_pct"], 0) / 100, 0.24), 0.12, 1),
      statusKey: toText(diagnostics.category || diagnostics.state || "").toLowerCase().includes("clean") ? "good" : ""
    }),
    buildNode({
      key: "tick_theater",
      laneKey: "pvp_tick",
      label: "Tick Theater",
      metric: `${Math.max(0, Math.round(pickNumber(tick, ["tempo_ms", "tick_ms"], 0)))}ms`,
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
      metric: String(Math.max(0, pickNumber(taskResult, ["offer_count", "offers_count"], pickNumber(mission, ["offer_count", "active_count"], 0)))),
      energy: clamp(Math.max(pickNumber(taskResult, ["offer_count", "offers_count"], pickNumber(mission, ["offer_count", "active_count"], 0)) / 4, 0.24), 0.12, 1)
    }),
    buildNode({
      key: "streak_tower",
      laneKey: "daily_streak",
      label: "Streak Tower",
      metric: `${Math.max(0, Math.round(pickNumber(daily, ["streak_days", "streak"], 0)))}d`,
      energy: clamp(Math.max(pickNumber(daily, ["streak_days", "streak"], 0) / 7, 0.18), 0.12, 1)
    }),
    buildNode({
      key: "claim_bridge",
      laneKey: "mission_claim",
      label: "Claim Bridge",
      metric: String(Math.max(0, pickNumber(taskResult, ["claimable_count"], pickNumber(mission, ["claimable_count"], 0)))),
      energy: clamp(Math.max(pickNumber(taskResult, ["claimable_count"], pickNumber(mission, ["claimable_count"], 0)) / 3, 0.18), 0.12, 1)
    }),
    buildNode({
      key: "contract_spire",
      laneKey: "contract",
      label: "Contract Pulse",
      metric: toText(contract.band || contract.state || "open").toUpperCase(),
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
      metric: pickTruthy(walletSession, ["active", "linked"]) ? "LIVE" : "OPEN",
      energy: pickTruthy(walletSession, ["active", "linked"]) ? 0.78 : 0.32
    }),
    buildNode({
      key: "payout_lift",
      laneKey: "payout",
      label: "Payout Lift",
      metric: toText(payoutStatus.state || payoutStatus.status || "idle").toUpperCase(),
      energy: clamp(Math.max(pickNumber(payoutStatus, ["readiness_pct", "eligible_pct"], 0) / 100, 0.24), 0.12, 1)
    }),
    buildNode({
      key: "premium_arcade",
      laneKey: "premium",
      label: "Premium Pass",
      metric: pickTruthy(monetization, ["pass_active", "active", "premium_active"]) ? "ACTIVE" : "READY",
      energy: pickTruthy(monetization, ["pass_active", "active", "premium_active"]) ? 0.7 : 0.3
    }),
    buildNode({
      key: "route_engine",
      laneKey: "route",
      label: "Route Engine",
      metric: toText(routeStatus.state || routeStatus.health || "ready").toUpperCase(),
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
      metric: String(queueCount),
      energy: clamp(Math.max(queueCount / 8, 0.22), 0.12, 1),
      statusKey: queueCount >= 6 ? "warn" : ""
    }),
    buildNode({
      key: "runtime_core",
      laneKey: "admin_runtime",
      label: "Runtime Core",
      metric: sceneHealth.toUpperCase(),
      energy: clamp(Math.max(pickNumber(summary, ["scene_runtime_ready_rate_24h"], 0) / 100, 0.34), 0.12, 1),
      statusKey: sceneHealth === "alert" ? "hot" : sceneHealth === "watch" ? "warn" : "good"
    }),
    buildNode({
      key: "liveops_spine",
      laneKey: "admin_liveops",
      label: "LiveOps Spine",
      metric: schedulerState.toUpperCase(),
      energy: clamp(Math.max(pickNumber(summary, ["live_ops_sent_24h", "sent_24h"], 0) / 20, 0.24), 0.12, 1)
    }),
    buildNode({
      key: "audit_orbit",
      laneKey: "admin_audit",
      label: "Audit Orbit",
      metric: String(Math.max(0, pickNumber(summary, ["ops_alert_raised_24h", "alerts_24h"], 0))),
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
  const nodes = rawNodes.slice(0, nodeLimit);
  const ambientEnergy = clamp(nodes.reduce((sum, node) => sum + node.energy, 0) / Math.max(1, nodes.length), 0.18, 1);
  const hotNodes = nodes.filter((node) => node.status_key === "hot").length;
  const warnNodes = nodes.filter((node) => node.status_key === "warn").length;

  return {
    world_key: `${workspace}:${tab}:${districtKey}`,
    workspace,
    tab,
    district_key: districtKey,
    district_label_key: districtLabelKey,
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
    camera_radius: workspace === "admin" ? 10.2 : tab === "pvp" ? 9.4 : 10.8,
    hardware_scaling: lowEndMode ? 1.9 : effectiveQuality === "high" ? 1 : effectiveQuality === "medium" ? 1.25 : 1.6,
    nodes
  };
}
