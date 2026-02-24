type MeterPalette = "neutral" | "safe" | "balanced" | "aggressive" | "critical";

type Tone = "neutral" | "advantage" | "pressure" | "critical";

type LiveChipPayload = {
  id: string;
  text: string;
  tone: Tone | "info";
  level: number;
};

type ResolveBurstPayload = {
  visible: boolean;
  tone: Tone;
  state: "idle" | "cooldown" | "active";
  energy: number;
  flash: number;
  badgeText: string;
  badgeTone: "info" | "warn" | "default";
  lineText: string;
  meterPct: number;
  meterPalette: MeterPalette;
  chips: LiveChipPayload[];
};

type CombatFxPayload = {
  tone: Tone;
  intense: boolean;
  burst: number;
  stress: number;
  window: number;
  asset: number;
  badgeText: string;
  badgeTone: "info" | "warn" | "default";
  lineText: string;
  burstMeterPct: number;
  stressMeterPct: number;
  burstPalette: MeterPalette;
  stressPalette: MeterPalette;
  chips: LiveChipPayload[];
};

export type CombatFxBridgePayload = {
  resolve?: ResolveBurstPayload;
  fx?: CombatFxPayload;
};

type CombatFxBridge = {
  render: (payload: CombatFxBridgePayload) => boolean;
};

declare global {
  interface Window {
    __AKR_COMBAT_FX__?: CombatFxBridge;
  }
}

const METER_PALETTES: Record<MeterPalette, { start: string; end: string; glow: string }> = Object.freeze({
  neutral: { start: "#3df8c2", end: "#ffb85c", glow: "rgba(61, 248, 194, 0.42)" },
  safe: { start: "#70ffa0", end: "#3df8c2", glow: "rgba(112, 255, 160, 0.38)" },
  balanced: { start: "#7fd6ff", end: "#3df8c2", glow: "rgba(127, 214, 255, 0.4)" },
  aggressive: { start: "#ff5d7d", end: "#ffb85c", glow: "rgba(255, 93, 125, 0.44)" },
  critical: { start: "#ff416d", end: "#ffc266", glow: "rgba(255, 93, 125, 0.56)" }
});

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

function pulseOnce(node: HTMLElement | null, className = "enter"): void {
  if (!node) {
    return;
  }
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
  const anyNode = node as any;
  const key = `_${className}Timer`;
  if (anyNode[key]) {
    clearTimeout(anyNode[key]);
  }
  anyNode[key] = setTimeout(() => {
    node.classList.remove(className);
    anyNode[key] = null;
  }, 280);
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

function setBadgeClass(node: HTMLElement | null, tone: "info" | "warn" | "default"): void {
  if (!node) {
    return;
  }
  if (tone === "warn") {
    node.className = "badge warn";
    return;
  }
  if (tone === "info") {
    node.className = "badge info";
    return;
  }
  node.className = "badge";
}

function setLiveChip(payload: LiveChipPayload): void {
  const el = byId<HTMLElement>(payload.id);
  if (!el) {
    return;
  }
  const tone = String(payload.tone || "neutral").toLowerCase();
  el.textContent = String(payload.text || "--");
  el.classList.remove("critical", "pressure", "advantage", "balanced", "neutral", "info");
  if (tone !== "default") {
    el.classList.add(tone);
  }
  el.style.setProperty("--chip-level", clamp(asNum(payload.level), 0, 1).toFixed(3));
}

function renderResolve(resolve: ResolveBurstPayload): boolean {
  const root = byId<HTMLElement>("resolveBurstBanner");
  const badge = byId<HTMLElement>("resolveBurstBadge");
  const line = byId<HTMLElement>("resolveBurstLine");
  const meter = byId<HTMLElement>("resolveBurstMeter");
  if (!root || !badge || !line || !meter) {
    return false;
  }

  root.classList.toggle("hidden", !resolve.visible);
  root.dataset.tone = String(resolve.tone || "advantage");
  root.dataset.state = String(resolve.state || "idle");
  root.style.setProperty("--resolve-energy", clamp(resolve.energy, 0, 1).toFixed(3));
  root.style.setProperty("--resolve-flash", clamp(resolve.flash, 0, 1).toFixed(3));

  badge.textContent = String(resolve.badgeText || "COMBAT TRACE");
  setBadgeClass(badge, resolve.badgeTone || "info");
  line.textContent = String(resolve.lineText || "Resolve trace");
  pulseOnce(line);

  setMeter(meter, resolve.meterPct, resolve.meterPalette || "balanced");
  (Array.isArray(resolve.chips) ? resolve.chips : []).forEach(setLiveChip);
  return true;
}

function renderFx(fx: CombatFxPayload): boolean {
  const root = byId<HTMLElement>("combatFxOverlay");
  const badge = byId<HTMLElement>("combatFxOverlayBadge");
  const line = byId<HTMLElement>("combatFxOverlayLine");
  const burstMeter = byId<HTMLElement>("combatFxBurstMeter");
  const stressMeter = byId<HTMLElement>("combatFxStressMeter");
  if (!root || !badge || !line || !burstMeter || !stressMeter) {
    return false;
  }

  root.dataset.tone = String(fx.tone || "neutral");
  root.dataset.intense = fx.intense ? "1" : "0";
  root.style.setProperty("--fx-burst", clamp(fx.burst, 0, 1).toFixed(3));
  root.style.setProperty("--fx-stress", clamp(fx.stress, 0, 1).toFixed(3));
  root.style.setProperty("--fx-window", clamp(fx.window, 0, 1).toFixed(3));
  root.style.setProperty("--fx-asset", clamp(fx.asset, 0, 1).toFixed(3));

  badge.textContent = String(fx.badgeText || "FX STABLE");
  setBadgeClass(badge, fx.badgeTone || "info");
  line.textContent = String(fx.lineText || "FX trace");
  pulseOnce(line);

  setMeter(burstMeter, fx.burstMeterPct, fx.burstPalette || "balanced");
  setMeter(stressMeter, fx.stressMeterPct, fx.stressPalette || "balanced");
  (Array.isArray(fx.chips) ? fx.chips : []).forEach(setLiveChip);
  return true;
}

function render(payload: CombatFxBridgePayload): boolean {
  let handled = false;
  if (payload && payload.resolve) {
    handled = renderResolve(payload.resolve) || handled;
  }
  if (payload && payload.fx) {
    handled = renderFx(payload.fx) || handled;
  }
  return handled;
}

export function installCombatFxBridge(): void {
  window.__AKR_COMBAT_FX__ = {
    render
  };
}

