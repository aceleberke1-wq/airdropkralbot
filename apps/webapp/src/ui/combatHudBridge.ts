type CombatTrailRow = {
  action: string;
  accepted: boolean;
  tone: string;
  isLatest: boolean;
};

type CombatCounts = {
  strike: number;
  guard: number;
  charge: number;
};

type CombatHudPayload = {
  pressureClass: string;
  urgency: string;
  recommendation: string;
  chainLineText: string;
  chainTrail: CombatTrailRow[];
  energy: number;
  reactorLineText: string;
  reactorHintText: string;
  reactorPalette: string;
  strategyLineText: string;
  timelineLineText: string;
  timelineBadgeText: string;
  timelineBadgeWarn: boolean;
  timelineMeterPct: number;
  timelineHintText: string;
  timelinePalette: string;
  queuePressurePct: number;
  pressureRatioPct: number;
  syncDelta: number;
  expectedAction: string;
  latestAction: string;
  latestAccepted: boolean;
  actionCounts: CombatCounts;
  fluxLineText: string;
  fluxHintText: string;
  fluxTone: string;
  fluxSelfPct: number;
  fluxOppPct: number;
  fluxSyncPct: number;
  fluxSelfPalette: string;
  fluxOppPalette: string;
  fluxSyncPalette: string;
  cadenceLineText: string;
  cadenceHintText: string;
  cadenceTone: string;
  cadenceStrikePct: number;
  cadenceGuardPct: number;
  cadenceChargePct: number;
  cadenceStrikePalette: string;
  cadenceGuardPalette: string;
  cadenceChargePalette: string;
  bossLineText: string;
  bossTone: string;
  bossMeterPct: number;
  bossPalette: string;
  overdriveLineText: string;
  overdriveHintText: string;
  overdriveTone: string;
  overdriveHeatPct: number;
  overdriveThreatPct: number;
  overdrivePvpPct: number;
  overdriveImpulsePct: number;
  overdriveHeatPalette: string;
  overdriveThreatPalette: string;
  overdrivePvpPalette: string;
  overdriveImpulsePalette: string;
  matrixLineText: string;
  matrixHintText: string;
  matrixTone: string;
  matrixSyncPct: number;
  matrixThermalPct: number;
  matrixShieldPct: number;
  matrixClutchPct: number;
  matrixSyncPalette: string;
  matrixThermalPalette: string;
  matrixShieldPalette: string;
  matrixClutchPalette: string;
  alertPrimaryLabel: string;
  alertPrimaryTone: string;
  alertSecondaryLabel: string;
  alertSecondaryTone: string;
  alertTertiaryLabel: string;
  alertTertiaryTone: string;
  alertHintText: string;
};

type CombatHudBridge = {
  render: (payload: CombatHudPayload) => boolean;
};

const METER_PALETTES: Record<string, { start: string; end: string; glow: string }> = Object.freeze({
  neutral: {
    start: "#3df8c2",
    end: "#ffb85c",
    glow: "rgba(61, 248, 194, 0.42)"
  },
  safe: {
    start: "#70ffa0",
    end: "#3df8c2",
    glow: "rgba(112, 255, 160, 0.38)"
  },
  balanced: {
    start: "#7fd6ff",
    end: "#3df8c2",
    glow: "rgba(127, 214, 255, 0.4)"
  },
  aggressive: {
    start: "#ff5d7d",
    end: "#ffb85c",
    glow: "rgba(255, 93, 125, 0.44)"
  },
  critical: {
    start: "#ff416d",
    end: "#ffc266",
    glow: "rgba(255, 93, 125, 0.56)"
  }
});

declare global {
  interface Window {
    __AKR_COMBAT_HUD__?: CombatHudBridge;
  }
}

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function asNum(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function setMeterPalette(element: HTMLElement | null, paletteKey: string): void {
  if (!element?.style) {
    return;
  }
  const key = String(paletteKey || "neutral").toLowerCase();
  const palette = METER_PALETTES[key] || METER_PALETTES.neutral;
  element.style.setProperty("--meter-start", palette.start);
  element.style.setProperty("--meter-end", palette.end);
  element.style.setProperty("--meter-glow", palette.glow);
}

function setMeter(element: HTMLElement | null, pct: number, palette: string): void {
  if (!element) {
    return;
  }
  const safePct = clamp(asNum(pct), 0, 100);
  element.style.width = `${Math.round(safePct)}%`;
  setMeterPalette(element, palette);
}

function setNodeFlash(node: HTMLElement): void {
  node.classList.add("flash");
  const anyNode = node as any;
  if (anyNode._flashTimer) {
    clearTimeout(anyNode._flashTimer);
  }
  anyNode._flashTimer = setTimeout(() => {
    node.classList.remove("flash");
    anyNode._flashTimer = null;
  }, 260);
}

function render(payload: CombatHudPayload): boolean {
  const panelRoot = byId("combatHudPanel") || document.querySelector<HTMLElement>(".combatHudPanel");
  const chainLine = byId("combatChainLine");
  const chainTrail = byId("combatChainTrail");
  const reactorLine = byId("pulseReactorLine");
  const reactorMeter = byId("pulseReactorMeter");
  const reactorHint = byId("pulseReactorHint");
  const strategyLine = byId("pulseStrategyLine");
  const timelineLine = byId("combatTimelineLine");
  const timelineBadge = byId("combatTimelineBadge");
  const timelineMeter = byId("combatTimelineMeter");
  const timelineHint = byId("combatTimelineHint");
  const timelineNodeStrike = byId("combatTimelineNodeStrike");
  const timelineNodeGuard = byId("combatTimelineNodeGuard");
  const timelineNodeCharge = byId("combatTimelineNodeCharge");
  const fluxLine = byId("combatFluxLine");
  const fluxHint = byId("combatFluxHint");
  const fluxSelfMeter = byId("combatFluxSelfMeter");
  const fluxOppMeter = byId("combatFluxOppMeter");
  const fluxSyncMeter = byId("combatFluxSyncMeter");
  const cadenceLine = byId("combatCadenceLine");
  const cadenceHint = byId("combatCadenceHint");
  const cadenceStrikeMeter = byId("combatCadenceStrikeMeter");
  const cadenceGuardMeter = byId("combatCadenceGuardMeter");
  const cadenceChargeMeter = byId("combatCadenceChargeMeter");
  const bossPressureLine = byId("bossPressureLine");
  const bossPressureMeter = byId("bossPressureMeter");
  const overdriveLine = byId("combatOverdriveLine");
  const overdriveHint = byId("combatOverdriveHint");
  const overdriveHeatMeter = byId("combatOverdriveHeatMeter");
  const overdriveThreatMeter = byId("combatOverdriveThreatMeter");
  const overdrivePvpMeter = byId("combatOverdrivePvpMeter");
  const overdriveImpulseMeter = byId("combatOverdriveImpulseMeter");
  const matrixLine = byId("combatMatrixLine");
  const matrixHint = byId("combatMatrixHint");
  const matrixSyncMeter = byId("combatMatrixSyncMeter");
  const matrixThermalMeter = byId("combatMatrixThermalMeter");
  const matrixShieldMeter = byId("combatMatrixShieldMeter");
  const matrixClutchMeter = byId("combatMatrixClutchMeter");
  const matrixCell = matrixLine?.closest(".combatReactorCell") as HTMLElement | null;
  const alertPrimaryChip = byId("combatAlertPrimaryChip");
  const alertSecondaryChip = byId("combatAlertSecondaryChip");
  const alertTertiaryChip = byId("combatAlertTertiaryChip");
  const alertHint = byId("combatAlertHint");

  if (!panelRoot || !chainLine || !chainTrail || !timelineLine || !timelineBadge || !timelineMeter) {
    return false;
  }

  panelRoot.classList.remove("pressure-low", "pressure-medium", "pressure-high", "pressure-critical");
  panelRoot.classList.add(payload.pressureClass || "pressure-low");
  panelRoot.dataset.urgency = String(payload.urgency || "steady");
  panelRoot.dataset.recommendation = String(payload.recommendation || "balanced").toLowerCase();
  panelRoot.dataset.overdrive = String(payload.overdriveTone || "steady");
  panelRoot.dataset.matrix = String(payload.matrixTone || "steady");
  panelRoot.dataset.expectedAction = String(payload.expectedAction || "auto");
  panelRoot.dataset.latestAccepted = payload.latestAccepted === false ? "0" : "1";
  panelRoot.style.setProperty("--combat-panel-queue", (clamp(asNum(payload.queuePressurePct) / 100, 0, 1)).toFixed(3));
  panelRoot.style.setProperty("--combat-panel-pressure", (clamp(asNum(payload.pressureRatioPct) / 100, 0, 1)).toFixed(3));
  panelRoot.style.setProperty("--combat-panel-boss", (clamp(asNum(payload.bossMeterPct) / 100, 0, 1)).toFixed(3));
  panelRoot.style.setProperty("--combat-panel-sync", clamp((asNum(payload.syncDelta) + 100) / 200, 0, 1).toFixed(3));
  panelRoot.style.setProperty(
    "--combat-panel-overdrive",
    clamp((asNum(payload.overdrivePvpPct) / 100) * 0.7 + (asNum(payload.overdriveImpulsePct) / 100) * 0.3, 0, 1).toFixed(3)
  );

  chainLine.textContent = String(payload.chainLineText || "CHAIN IDLE");
  chainTrail.innerHTML = "";
  if (!Array.isArray(payload.chainTrail) || !payload.chainTrail.length) {
    const empty = document.createElement("span");
    empty.className = "trailChip muted";
    empty.textContent = "bekleniyor";
    chainTrail.appendChild(empty);
  } else {
    payload.chainTrail.forEach((row) => {
      const chip = document.createElement("span");
      chip.className = `trailChip ${String(row.tone || "info").toLowerCase()}${row.isLatest ? " enter" : ""}`;
      const prefix = row.accepted === false ? "x" : "+";
      chip.textContent = `${prefix}${String(row.action || "pulse").toUpperCase()}`;
      chainTrail.appendChild(chip);
    });
  }

  if (reactorLine) {
    reactorLine.textContent = String(payload.reactorLineText || "NEXUS READY");
  }
  setMeter(reactorMeter, payload.energy, payload.reactorPalette);
  if (reactorHint) {
    reactorHint.textContent = String(payload.reactorHintText || "");
  }
  if (strategyLine) {
    strategyLine.textContent = String(payload.strategyLineText || "");
    strategyLine.dataset.urgency = String(payload.urgency || "steady");
    strategyLine.dataset.recommendation = String(payload.recommendation || "balanced").toLowerCase();
  }

  timelineLine.textContent = String(payload.timelineLineText || "Beklenen: AUTO | Son: CHAIN IDLE");
  timelineBadge.textContent = String(payload.timelineBadgeText || "IDLE");
  timelineBadge.className = payload.timelineBadgeWarn ? "badge warn" : "badge info";
  setMeter(timelineMeter, payload.timelineMeterPct, payload.timelinePalette);
  if (timelineHint) {
    timelineHint.textContent = String(payload.timelineHintText || "");
  }

  if (fluxLine) {
    fluxLine.textContent = String(payload.fluxLineText || "");
    fluxLine.dataset.tone = String(payload.fluxTone || "steady");
  }
  if (fluxHint) {
    fluxHint.textContent = String(payload.fluxHintText || "");
  }
  setMeter(fluxSelfMeter, payload.fluxSelfPct, payload.fluxSelfPalette);
  setMeter(fluxOppMeter, payload.fluxOppPct, payload.fluxOppPalette);
  setMeter(fluxSyncMeter, payload.fluxSyncPct, payload.fluxSyncPalette);

  if (cadenceLine) {
    cadenceLine.textContent = String(payload.cadenceLineText || "");
    cadenceLine.dataset.tone = String(payload.cadenceTone || "steady");
  }
  if (cadenceHint) {
    cadenceHint.textContent = String(payload.cadenceHintText || "");
  }
  setMeter(cadenceStrikeMeter, payload.cadenceStrikePct, payload.cadenceStrikePalette);
  setMeter(cadenceGuardMeter, payload.cadenceGuardPct, payload.cadenceGuardPalette);
  setMeter(cadenceChargeMeter, payload.cadenceChargePct, payload.cadenceChargePalette);

  if (bossPressureLine) {
    bossPressureLine.textContent = String(payload.bossLineText || "STABLE | HP -- | TTL --");
    bossPressureLine.dataset.tone = String(payload.bossTone || "stable");
  }
  setMeter(bossPressureMeter, payload.bossMeterPct, payload.bossPalette);

  if (overdriveLine) {
    overdriveLine.textContent = String(payload.overdriveLineText || "HEAT 0% | THREAT 0% | PVP 0% | CAM 0%");
    overdriveLine.dataset.tone = String(payload.overdriveTone || "steady");
  }
  if (overdriveHint) {
    overdriveHint.textContent = String(payload.overdriveHintText || "");
    overdriveHint.dataset.tone = String(payload.overdriveTone || "steady");
  }
  setMeter(overdriveHeatMeter, payload.overdriveHeatPct, payload.overdriveHeatPalette);
  setMeter(overdriveThreatMeter, payload.overdriveThreatPct, payload.overdriveThreatPalette);
  setMeter(overdrivePvpMeter, payload.overdrivePvpPct, payload.overdrivePvpPalette);
  setMeter(overdriveImpulseMeter, payload.overdriveImpulsePct, payload.overdriveImpulsePalette);
  if (matrixLine) {
    matrixLine.textContent = String(payload.matrixLineText || "SYNC 0% | THERMAL 0% | SHIELD 0% | CLUTCH 0%");
    matrixLine.dataset.tone = String(payload.matrixTone || "steady");
  }
  if (matrixHint) {
    matrixHint.textContent = String(payload.matrixHintText || "");
    matrixHint.dataset.tone = String(payload.matrixTone || "steady");
  }
  if (matrixCell) {
    matrixCell.dataset.tone = String(payload.matrixTone || "steady");
  }
  setMeter(matrixSyncMeter, payload.matrixSyncPct, payload.matrixSyncPalette);
  setMeter(matrixThermalMeter, payload.matrixThermalPct, payload.matrixThermalPalette);
  setMeter(matrixShieldMeter, payload.matrixShieldPct, payload.matrixShieldPalette);
  setMeter(matrixClutchMeter, payload.matrixClutchPct, payload.matrixClutchPalette);

  const applyAlertChip = (node: HTMLElement | null, label: string, toneKey: string) => {
    if (!node) {
      return;
    }
    node.textContent = String(label || "FLOW HOLD");
    node.className = "combatAlertChip";
    const safeTone = String(toneKey || "neutral").toLowerCase();
    node.classList.add(
      safeTone === "critical"
        ? "critical"
        : safeTone === "aggressive" || safeTone === "pressure"
          ? "aggressive"
          : safeTone === "safe"
            ? "safe"
            : safeTone === "balanced" || safeTone === "advantage"
              ? "balanced"
              : "neutral"
    );
  };
  applyAlertChip(alertPrimaryChip, payload.alertPrimaryLabel, payload.alertPrimaryTone);
  applyAlertChip(alertSecondaryChip, payload.alertSecondaryLabel, payload.alertSecondaryTone);
  applyAlertChip(alertTertiaryChip, payload.alertTertiaryLabel, payload.alertTertiaryTone);
  if (alertHint) {
    alertHint.textContent = String(payload.alertHintText || "");
    alertHint.dataset.tone = String(payload.alertPrimaryTone || "steady").toLowerCase();
  }

  const nodeMap: Record<string, HTMLElement | null> = {
    strike: timelineNodeStrike,
    guard: timelineNodeGuard,
    charge: timelineNodeCharge
  };
  Object.entries(nodeMap).forEach(([actionKey, node]) => {
    if (!node) {
      return;
    }
    node.classList.remove("expected", "active", "success", "reject", "recent", "flash");
    const count = payload.actionCounts?.[actionKey as keyof CombatCounts] || 0;
    if (count > 0) {
      node.classList.add("recent");
    }
    const nodeHeat = clamp(
      (count / 6) * 0.62 +
        (payload.expectedAction === actionKey ? 0.2 : 0) +
        (payload.latestAction === actionKey ? 0.24 : 0) +
        (payload.latestAction === actionKey && payload.latestAccepted === false ? 0.18 : 0),
      0,
      1
    );
    node.dataset.weight = nodeHeat >= 0.78 ? "critical" : nodeHeat >= 0.52 ? "high" : nodeHeat >= 0.24 ? "mid" : "low";
    node.dataset.flow =
      payload.latestAction === actionKey
        ? payload.latestAccepted === false
          ? "reject"
          : "resolve"
        : payload.expectedAction === actionKey
          ? "expected"
          : count > 0
            ? "recent"
            : "idle";
    node.style.setProperty("--node-heat", nodeHeat.toFixed(3));
    node.style.setProperty("--node-stack", String(count));
    node.style.setProperty(
      "--node-glow-alpha",
      (
        payload.latestAction === actionKey && payload.latestAccepted === false
          ? 0.42
          : payload.expectedAction === actionKey
            ? 0.34
            : 0.18 + nodeHeat * 0.18
      ).toFixed(3)
    );
    if (payload.expectedAction === actionKey) {
      node.classList.add("expected");
    }
    if (payload.latestAction === actionKey) {
      node.classList.add("active");
      node.classList.add(payload.latestAccepted ? "success" : "reject");
      setNodeFlash(node);
    }
  });

  return true;
}

export function installCombatHudBridge(): void {
  window.__AKR_COMBAT_HUD__ = {
    render
  };
}
