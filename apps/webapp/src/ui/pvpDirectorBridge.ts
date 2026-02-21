type MeterPalette = "neutral" | "safe" | "balanced" | "aggressive" | "critical";

type CinematicPayload = {
  tone: string;
  phaseBadgeText: string;
  lineText: string;
  hintText: string;
  meterPct: number;
  reducedMotion?: boolean;
};

type ObjectiveCardPayload = {
  label: string;
  value: string;
  meta: string;
  tone: "neutral" | "advantage" | "warning" | "danger";
};

type MomentumPayload = {
  selfLineText: string;
  selfMeterPct: number;
  selfPalette: MeterPalette;
  oppLineText: string;
  oppMeterPct: number;
  oppPalette: MeterPalette;
  primaryCard: ObjectiveCardPayload;
  secondaryCard: ObjectiveCardPayload;
  riskCard: ObjectiveCardPayload;
  pulseObjectives?: boolean;
  reducedMotion?: boolean;
};

type PvpDirectorPayload = {
  cinematic?: CinematicPayload;
  momentum?: MomentumPayload;
};

type PvpDirectorBridge = {
  render: (payload: PvpDirectorPayload) => boolean;
};

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

declare global {
  interface Window {
    __AKR_PVP_DIRECTOR__?: PvpDirectorBridge;
  }
}

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

function setMeter(element: HTMLElement | null, pct: number, paletteKey: MeterPalette): void {
  if (!element) {
    return;
  }
  const ratio = clamp(asNum(pct), 0, 100);
  element.style.width = `${Math.round(ratio)}%`;
  setMeterPalette(element, paletteKey);
}

function runOneShotClass(node: HTMLElement, className: string, ms: number): void {
  node.classList.remove(className);
  // trigger reflow to restart animation class
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
  }, ms);
}

function paintObjectiveCard(card: HTMLElement | null, payload: ObjectiveCardPayload): void {
  if (!card) {
    return;
  }
  const tone = ["neutral", "advantage", "warning", "danger"].includes(String(payload.tone))
    ? payload.tone
    : "neutral";
  card.className = `pvpObjectiveCard ${tone}`;
  const labelEl = card.querySelector<HTMLElement>(".label");
  const valueEl = card.querySelector<HTMLElement>(".value");
  const metaEl = card.querySelector<HTMLElement>(".micro");
  if (labelEl) {
    labelEl.textContent = String(payload.label || "-");
  }
  if (valueEl) {
    valueEl.textContent = String(payload.value || "-");
  }
  if (metaEl) {
    metaEl.textContent = String(payload.meta || "-");
  }
}

function renderCinematic(payload: CinematicPayload): boolean {
  const root = byId<HTMLElement>("pvpCineStrip");
  const phaseBadge = byId<HTMLElement>("pvpCinePhaseBadge");
  const line = byId<HTMLElement>("pvpCineLine");
  const meter = byId<HTMLElement>("pvpCineMeter");
  const hint = byId<HTMLElement>("pvpCineHint");
  if (!root || !phaseBadge || !line || !meter || !hint) {
    return false;
  }

  const tone = String(payload.tone || "neutral").toLowerCase();
  root.dataset.tone = tone;
  if (tone === "neutral") {
    line.removeAttribute("data-tone");
  } else {
    line.dataset.tone = tone;
  }
  phaseBadge.className = tone === "critical" ? "badge warn" : tone === "advantage" ? "badge" : "badge info";
  phaseBadge.textContent = String(payload.phaseBadgeText || "DUEL PHASE");
  line.textContent = String(payload.lineText || "Cinematic Director | SYNC 50% | HEAT 0%");
  hint.textContent = String(payload.hintText || "Tick akisina kilitlen, expected aksiyona hizli don.");

  const palette: MeterPalette =
    tone === "critical" ? "critical" : tone === "pressure" ? "aggressive" : tone === "advantage" ? "safe" : "balanced";
  setMeter(meter, payload.meterPct, palette);

  if (!payload.reducedMotion) {
    runOneShotClass(root, "enter", 300);
  }
  return true;
}

function renderMomentum(payload: MomentumPayload): boolean {
  const selfLine = byId<HTMLElement>("pvpMomentumSelfLine");
  const selfMeter = byId<HTMLElement>("pvpMomentumSelfMeter");
  const oppLine = byId<HTMLElement>("pvpMomentumOppLine");
  const oppMeter = byId<HTMLElement>("pvpMomentumOppMeter");
  const primaryCard = byId<HTMLElement>("pvpObjectivePrimary");
  const secondaryCard = byId<HTMLElement>("pvpObjectiveSecondary");
  const riskCard = byId<HTMLElement>("pvpObjectiveRisk");
  if (!selfLine || !selfMeter || !oppLine || !oppMeter || !primaryCard || !secondaryCard || !riskCard) {
    return false;
  }

  selfLine.textContent = String(payload.selfLineText || "50% | EVEN");
  oppLine.textContent = String(payload.oppLineText || "50% | EVEN");
  setMeter(selfMeter, payload.selfMeterPct, payload.selfPalette || "neutral");
  setMeter(oppMeter, payload.oppMeterPct, payload.oppPalette || "neutral");

  paintObjectiveCard(primaryCard, payload.primaryCard);
  paintObjectiveCard(secondaryCard, payload.secondaryCard);
  paintObjectiveCard(riskCard, payload.riskCard);

  if (payload.pulseObjectives) {
    [primaryCard, secondaryCard, riskCard].forEach((card) => {
      card.classList.add("pulse");
      if (!payload.reducedMotion) {
        runOneShotClass(card, "enter", 280);
      }
      const anyCard = card as any;
      if (anyCard._pulseTimer) {
        clearTimeout(anyCard._pulseTimer);
      }
      anyCard._pulseTimer = setTimeout(() => {
        card.classList.remove("pulse");
        anyCard._pulseTimer = null;
      }, 240);
    });
  }
  return true;
}

export function installPvpDirectorBridge(): void {
  window.__AKR_PVP_DIRECTOR__ = {
    render(payload: PvpDirectorPayload): boolean {
      let handled = false;
      if (payload.cinematic) {
        handled = renderCinematic(payload.cinematic) || handled;
      }
      if (payload.momentum) {
        handled = renderMomentum(payload.momentum) || handled;
      }
      return handled;
    }
  };
}
