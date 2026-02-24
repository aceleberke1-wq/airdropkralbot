type MeterPalette = "neutral" | "safe" | "balanced" | "aggressive" | "critical";
type Tone = "neutral" | "advantage" | "pressure" | "critical";

type LiveChipPayload = {
  id: string;
  text: string;
  tone: Tone | "info" | "balanced";
  level: number;
};

type SceneAlarmPayload = {
  tone: Tone;
  category: string;
  recent: boolean;
  stress: number;
  flash: number;
  badgeText: string;
  badgeTone: "info" | "warn" | "default";
  lineText: string;
  hintText: string;
  meterPct: number;
  meterPalette: MeterPalette;
  chips: LiveChipPayload[];
};

type SceneIntegrityPayload = {
  visible: boolean;
  tone: Tone | "balanced";
  state: "active" | "idle";
  sweep: number;
  flash: number;
  badgeText: string;
  badgeTone: "info" | "warn" | "default";
  lineText: string;
  meterPct: number;
  meterPalette: MeterPalette;
  chips: LiveChipPayload[];
};

export type SceneTelemetryBridgePayload = {
  alarm?: SceneAlarmPayload;
  integrity?: SceneIntegrityPayload;
};

type SceneTelemetryBridge = {
  render: (payload: SceneTelemetryBridgePayload) => boolean;
};

declare global {
  interface Window {
    __AKR_SCENE_TELEMETRY__?: SceneTelemetryBridge;
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

function renderAlarm(alarm: SceneAlarmPayload): boolean {
  const root = byId<HTMLElement>("sceneAlarmStrip");
  const badge = byId<HTMLElement>("sceneAlarmBadge");
  const line = byId<HTMLElement>("sceneAlarmLine");
  const hint = byId<HTMLElement>("sceneAlarmHint");
  const meter = byId<HTMLElement>("sceneAlarmMeter");
  if (!root || !badge || !line || !hint || !meter) {
    return false;
  }

  root.dataset.tone = String(alarm.tone || "advantage");
  root.dataset.category = String(alarm.category || "none");
  root.dataset.recent = alarm.recent ? "1" : "0";
  root.style.setProperty("--scene-alarm-stress", clamp(alarm.stress, 0, 1).toFixed(3));
  root.style.setProperty("--scene-alarm-flash", clamp(alarm.flash, 0, 1).toFixed(3));

  badge.textContent = String(alarm.badgeText || "SCENE OK");
  setBadgeClass(badge, alarm.badgeTone || "info");
  line.textContent = String(alarm.lineText || "Scene telemetry trace");
  hint.textContent = String(alarm.hintText || "Scene telemetry guidance");
  pulseOnce(line);
  pulseOnce(hint);
  setMeter(meter, alarm.meterPct, alarm.meterPalette || "balanced");
  (Array.isArray(alarm.chips) ? alarm.chips : []).forEach(setLiveChip);
  return true;
}

function renderIntegrity(integrity: SceneIntegrityPayload): boolean {
  const root = byId<HTMLElement>("sceneIntegrityOverlay");
  const badge = byId<HTMLElement>("sceneIntegrityOverlayBadge");
  const line = byId<HTMLElement>("sceneIntegrityOverlayLine");
  const meter = byId<HTMLElement>("sceneIntegrityOverlayMeter");
  if (!root || !badge || !line || !meter) {
    return false;
  }

  root.classList.toggle("hidden", !integrity.visible);
  root.dataset.tone = String(integrity.tone || "balanced");
  root.dataset.state = String(integrity.state || "idle");
  root.style.setProperty("--scene-integrity-sweep", clamp(integrity.sweep, 0, 1).toFixed(3));
  root.style.setProperty("--scene-integrity-flash", clamp(integrity.flash, 0, 1).toFixed(3));

  badge.textContent = String(integrity.badgeText || "SCENE STABLE");
  setBadgeClass(badge, integrity.badgeTone || "info");
  line.textContent = String(integrity.lineText || "Scene integrity trace");
  pulseOnce(line);
  setMeter(meter, integrity.meterPct, integrity.meterPalette || "balanced");
  (Array.isArray(integrity.chips) ? integrity.chips : []).forEach(setLiveChip);
  return true;
}

function render(payload: SceneTelemetryBridgePayload): boolean {
  let handled = false;
  if (payload && payload.alarm) {
    handled = renderAlarm(payload.alarm) || handled;
  }
  if (payload && payload.integrity) {
    handled = renderIntegrity(payload.integrity) || handled;
  }
  return handled;
}

export function installSceneTelemetryBridge(): void {
  window.__AKR_SCENE_TELEMETRY__ = {
    render
  };
}

