type MeterPalette = "neutral" | "safe" | "balanced" | "aggressive" | "critical";

type TickPayload = {
  lineText: string;
  urgency: "neutral" | "advantage" | "pressure" | "critical";
  live: boolean;
  reducedMotion?: boolean;
};

type CadencePayload = {
  tone: "neutral" | "advantage" | "pressure" | "critical";
  pulseLineText: string;
  cadenceLineText: string;
  cadenceHintText: string;
  pulsePct: number;
  pulsePalette: MeterPalette;
  windowPct: number;
  windowPalette: MeterPalette;
  strikePct: number;
  strikePalette: MeterPalette;
  guardPct: number;
  guardPalette: MeterPalette;
  chargePct: number;
  chargePalette: MeterPalette;
  driftPct: number;
  driftPalette: MeterPalette;
  reducedMotion?: boolean;
};

type TheaterPayload = {
  rootTone: "neutral" | "advantage" | "pressure" | "critical";
  syncLineText: string;
  syncLineTone: "advantage" | "pressure" | "critical";
  syncHintText: string;
  syncPct: number;
  syncPalette: MeterPalette;
  overheatLineText: string;
  overheatLineTone: "advantage" | "pressure" | "critical";
  overheatHintText: string;
  overheatPct: number;
  overheatPalette: MeterPalette;
  clutchLineText: string;
  clutchLineTone: "advantage" | "pressure" | "critical";
  clutchHintText: string;
  clutchPct: number;
  clutchPalette: MeterPalette;
  stanceLineText: string;
  stanceLineTone: "advantage" | "pressure" | "critical";
  stanceHintText: string;
  stancePct: number;
  stancePalette: MeterPalette;
  reducedMotion?: boolean;
};

type PvpDuelBridgePayload = {
  tick?: TickPayload;
  cadence?: CadencePayload;
  theater?: TheaterPayload;
};

type PvpDuelBridge = {
  render: (payload: PvpDuelBridgePayload) => boolean;
};

declare global {
  interface Window {
    __AKR_PVP_DUEL__?: PvpDuelBridge;
  }
}

const METER_PALETTES: Record<MeterPalette, { start: string; end: string; glow: string }> = Object.freeze({
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

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function asNum(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function setMeterPalette(element: HTMLElement | null, paletteKey: MeterPalette): void {
  if (!element?.style) {
    return;
  }
  const palette = METER_PALETTES[paletteKey] || METER_PALETTES.neutral;
  element.style.setProperty("--meter-start", palette.start);
  element.style.setProperty("--meter-end", palette.end);
  element.style.setProperty("--meter-glow", palette.glow);
}

function setMeter(element: HTMLElement | null, pct: number, palette: MeterPalette): void {
  if (!element) {
    return;
  }
  element.style.width = `${Math.round(clamp(asNum(pct), 0, 100))}%`;
  setMeterPalette(element, palette);
}

function pulseOnce(node: HTMLElement | null, className: string, reducedMotion?: boolean): void {
  if (!node || reducedMotion) {
    return;
  }
  node.classList.remove(className);
  // reflow to replay animation
  void node.offsetWidth;
  node.classList.add(className);
  const anyNode = node as any;
  const timerKey = `_${className}Timer`;
  if (anyNode[timerKey]) {
    clearTimeout(anyNode[timerKey]);
  }
  anyNode[timerKey] = setTimeout(() => {
    node.classList.remove(className);
    anyNode[timerKey] = null;
  }, 280);
}

function renderTick(payload: TickPayload): boolean {
  const line = byId<HTMLElement>("pvpTickLive");
  if (!line) {
    return false;
  }
  line.classList.remove("urgency-critical", "urgency-pressure", "urgency-advantage");
  line.textContent = String(payload.lineText || "Tick: bekleniyor");
  line.classList.toggle("live", Boolean(payload.live));
  if (payload.urgency === "critical") {
    line.classList.add("urgency-critical");
  } else if (payload.urgency === "pressure") {
    line.classList.add("urgency-pressure");
  } else if (payload.urgency === "advantage") {
    line.classList.add("urgency-advantage");
  }
  pulseOnce(line, "enter", payload.reducedMotion);
  return true;
}

function renderCadence(payload: CadencePayload): boolean {
  const pulseLine = byId<HTMLElement>("pvpPulseLine");
  const pulseMeter = byId<HTMLElement>("pvpPulseMeter");
  const windowMeter = byId<HTMLElement>("pvpWindowMeter");
  const cadenceLine = byId<HTMLElement>("pvpCadenceLine");
  const cadenceHint = byId<HTMLElement>("pvpCadenceHint");
  const cadenceStrikeMeter = byId<HTMLElement>("pvpCadenceStrikeMeter");
  const cadenceGuardMeter = byId<HTMLElement>("pvpCadenceGuardMeter");
  const cadenceChargeMeter = byId<HTMLElement>("pvpCadenceChargeMeter");
  const cadenceDriftMeter = byId<HTMLElement>("pvpCadenceDriftMeter");
  if (
    !pulseLine ||
    !pulseMeter ||
    !windowMeter ||
    !cadenceLine ||
    !cadenceHint ||
    !cadenceStrikeMeter ||
    !cadenceGuardMeter ||
    !cadenceChargeMeter ||
    !cadenceDriftMeter
  ) {
    return false;
  }

  if (payload.tone === "neutral") {
    pulseLine.removeAttribute("data-tone");
    cadenceLine.removeAttribute("data-tone");
  } else {
    pulseLine.dataset.tone = payload.tone;
    cadenceLine.dataset.tone = payload.tone;
  }
  pulseLine.textContent = String(payload.pulseLineText || "Phase 0% | Window 80%");
  cadenceLine.textContent = String(payload.cadenceLineText || "STR 0 | GRD 0 | CHG 0");
  cadenceHint.textContent = String(payload.cadenceHintText || "Cadence bekleniyor.");
  setMeter(pulseMeter, payload.pulsePct, payload.pulsePalette);
  setMeter(windowMeter, payload.windowPct, payload.windowPalette);
  setMeter(cadenceStrikeMeter, payload.strikePct, payload.strikePalette);
  setMeter(cadenceGuardMeter, payload.guardPct, payload.guardPalette);
  setMeter(cadenceChargeMeter, payload.chargePct, payload.chargePalette);
  setMeter(cadenceDriftMeter, payload.driftPct, payload.driftPalette);
  pulseOnce(pulseLine, "enter", payload.reducedMotion);
  return true;
}

function renderTheater(payload: TheaterPayload): boolean {
  const root = byId<HTMLElement>("pvpTheaterStrip");
  const syncLine = byId<HTMLElement>("pvpSyncLine");
  const syncMeter = byId<HTMLElement>("pvpSyncMeter");
  const syncHint = byId<HTMLElement>("pvpSyncHint");
  const overheatLine = byId<HTMLElement>("pvpOverheatLine");
  const overheatMeter = byId<HTMLElement>("pvpOverheatMeter");
  const overheatHint = byId<HTMLElement>("pvpOverheatHint");
  const clutchLine = byId<HTMLElement>("pvpClutchLine");
  const clutchMeter = byId<HTMLElement>("pvpClutchMeter");
  const clutchHint = byId<HTMLElement>("pvpClutchHint");
  const stanceLine = byId<HTMLElement>("pvpStanceLine");
  const stanceMeter = byId<HTMLElement>("pvpStanceMeter");
  const stanceHint = byId<HTMLElement>("pvpStanceHint");
  if (
    !syncLine ||
    !syncMeter ||
    !syncHint ||
    !overheatLine ||
    !overheatMeter ||
    !overheatHint ||
    !clutchLine ||
    !clutchMeter ||
    !clutchHint ||
    !stanceLine ||
    !stanceMeter ||
    !stanceHint
  ) {
    return false;
  }

  if (root) {
    if (payload.rootTone === "neutral") {
      root.removeAttribute("data-tone");
    } else {
      root.dataset.tone = payload.rootTone;
    }
    pulseOnce(root, "enter", payload.reducedMotion);
  }

  syncLine.dataset.tone = payload.syncLineTone;
  syncLine.textContent = String(payload.syncLineText || "SYNC 50% | EVEN");
  syncHint.textContent = String(payload.syncHintText || "-");
  setMeter(syncMeter, payload.syncPct, payload.syncPalette);

  overheatLine.dataset.tone = payload.overheatLineTone;
  overheatLine.textContent = String(payload.overheatLineText || "Heat 0% | Stable");
  overheatHint.textContent = String(payload.overheatHintText || "-");
  setMeter(overheatMeter, payload.overheatPct, payload.overheatPalette);

  clutchLine.dataset.tone = payload.clutchLineTone;
  clutchLine.textContent = String(payload.clutchLineText || "Window 0% | Resolve LOCK");
  clutchHint.textContent = String(payload.clutchHintText || "-");
  setMeter(clutchMeter, payload.clutchPct, payload.clutchPalette);

  stanceLine.dataset.tone = payload.stanceLineTone;
  stanceLine.textContent = String(payload.stanceLineText || "STR 0 | GRD 0 | CHG 0");
  stanceHint.textContent = String(payload.stanceHintText || "-");
  setMeter(stanceMeter, payload.stancePct, payload.stancePalette);
  return true;
}

export function installPvpDuelBridge(): void {
  window.__AKR_PVP_DUEL__ = {
    render(payload: PvpDuelBridgePayload): boolean {
      let handled = false;
      if (payload.tick) {
        handled = renderTick(payload.tick) || handled;
      }
      if (payload.cadence) {
        handled = renderCadence(payload.cadence) || handled;
      }
      if (payload.theater) {
        handled = renderTheater(payload.theater) || handled;
      }
      return handled;
    }
  };
}
