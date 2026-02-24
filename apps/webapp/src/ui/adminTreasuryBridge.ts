type MeterPalette = "neutral" | "safe" | "balanced" | "aggressive" | "critical";
type Tone = "neutral" | "advantage" | "pressure" | "critical" | "balanced";
type BadgeTone = "info" | "warn" | "default";

type LiveChipPayload = {
  id: string;
  text: string;
  tone: Tone | "info";
  level: number;
};

type MeterPayload = {
  id: string;
  pct: number;
  palette: MeterPalette;
};

type ListRowPayload = {
  title: string;
  meta: string;
  tone: "ready" | "warn" | "missing";
  chip: string;
};

type TreasuryPayload = {
  tone: Tone;
  routeRatio: number;
  apiRatio: number;
  queueRatio: number;
  badgeText: string;
  badgeTone: BadgeTone;
  lineText: string;
  signalLineText: string;
  chips: LiveChipPayload[];
  meters: MeterPayload[];
  rows: ListRowPayload[];
  emptyText?: string;
};

type ProviderPayload = {
  tone: Tone;
  healthRatio: number;
  timeoutRatio: number;
  staleRatio: number;
  badgeText: string;
  badgeTone: BadgeTone;
  lineText: string;
  signalLineText: string;
  chips: LiveChipPayload[];
  meters: MeterPayload[];
  rows: ListRowPayload[];
  emptyText?: string;
};

type DecisionTracePayload = {
  tone: Tone;
  flowRatio: number;
  riskRatio: number;
  badgeText: string;
  badgeTone: BadgeTone;
  lineText: string;
  signalLineText: string;
  chips: LiveChipPayload[];
  meters: MeterPayload[];
  rows: ListRowPayload[];
  emptyText?: string;
};

export type AdminTreasuryBridgePayload = {
  treasury?: TreasuryPayload;
  provider?: ProviderPayload;
  decisionTrace?: DecisionTracePayload;
};

type AdminTreasuryBridge = {
  render: (payload: AdminTreasuryBridgePayload) => boolean;
};

declare global {
  interface Window {
    __AKR_ADMIN_TREASURY__?: AdminTreasuryBridge;
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
  if (!node) return;
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
  const anyNode = node as any;
  const key = `_${className}Timer`;
  if (anyNode[key]) clearTimeout(anyNode[key]);
  anyNode[key] = setTimeout(() => {
    node.classList.remove(className);
    anyNode[key] = null;
  }, 280);
}

function setBadgeClass(node: HTMLElement | null, tone: BadgeTone): void {
  if (!node) return;
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

function setMeterPalette(element: HTMLElement | null, paletteKey: MeterPalette): void {
  if (!element?.style) return;
  const palette = METER_PALETTES[paletteKey] || METER_PALETTES.neutral;
  element.style.setProperty("--meter-start", palette.start);
  element.style.setProperty("--meter-end", palette.end);
  element.style.setProperty("--meter-glow", palette.glow);
}

function setMeter(element: HTMLElement | null, pct: number, palette: MeterPalette): void {
  if (!element) return;
  element.style.width = `${Math.round(clamp(asNum(pct), 0, 100))}%`;
  setMeterPalette(element, palette);
}

function setLiveChip(payload: LiveChipPayload): void {
  const el = byId<HTMLElement>(payload.id);
  if (!el) return;
  const tone = String(payload.tone || "neutral").toLowerCase();
  el.textContent = String(payload.text || "--");
  el.classList.remove("critical", "pressure", "advantage", "balanced", "neutral", "info");
  if (tone !== "default") el.classList.add(tone);
  el.style.setProperty("--chip-level", clamp(asNum(payload.level), 0, 1).toFixed(3));
}

function renderRowList(listId: string, rows: ListRowPayload[], emptyText?: string): void {
  const list = byId<HTMLElement>(listId);
  if (!list) return;
  list.innerHTML = "";
  if (!rows.length) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = emptyText || "Veri bekleniyor.";
    list.appendChild(li);
    return;
  }
  rows.forEach((row) => {
    const li = document.createElement("li");
    li.className = `tokenRouteRow ${row.tone === "missing" ? "missing" : "ready"}`;
    const left = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = String(row.title || "-");
    const meta = document.createElement("p");
    meta.className = "micro";
    meta.textContent = String(row.meta || "-");
    left.appendChild(title);
    left.appendChild(meta);
    const chip = document.createElement("span");
    chip.className = `adminAssetState ${row.tone === "missing" ? "missing" : row.tone === "warn" ? "warn" : "ready"}`;
    chip.textContent = String(row.chip || "OK");
    li.appendChild(left);
    li.appendChild(chip);
    list.appendChild(li);
  });
}

function applyMeters(meters: MeterPayload[]): void {
  (Array.isArray(meters) ? meters : []).forEach((meter) => {
    setMeter(byId<HTMLElement>(meter.id), meter.pct, meter.palette);
  });
}

function renderTreasury(payload: TreasuryPayload): boolean {
  const host = byId<HTMLElement>("adminTreasuryRuntimeStrip");
  const badge = byId<HTMLElement>("adminTreasuryBadge");
  const line = byId<HTMLElement>("adminTreasuryLine");
  const signal = byId<HTMLElement>("adminTreasurySignalLine");
  if (!host || !badge || !line || !signal) return false;
  host.dataset.tone = String(payload.tone || "neutral");
  host.style.setProperty("--treasury-route", clamp(payload.routeRatio, 0, 1).toFixed(3));
  host.style.setProperty("--treasury-api", clamp(payload.apiRatio, 0, 1).toFixed(3));
  host.style.setProperty("--treasury-queue", clamp(payload.queueRatio, 0, 1).toFixed(3));
  badge.textContent = String(payload.badgeText || "TREASURY");
  setBadgeClass(badge, payload.badgeTone || "info");
  line.textContent = String(payload.lineText || "Treasury runtime");
  signal.textContent = String(payload.signalLineText || "Treasury signals");
  pulseOnce(line);
  pulseOnce(signal);
  (payload.chips || []).forEach(setLiveChip);
  applyMeters(payload.meters || []);
  renderRowList("adminTreasuryRouteList", payload.rows || [], payload.emptyText);
  return true;
}

function renderProvider(payload: ProviderPayload): boolean {
  const host = byId<HTMLElement>("adminProviderAlertStrip");
  const badge = byId<HTMLElement>("adminProviderBadge");
  const line = byId<HTMLElement>("adminProviderLine");
  const signal = byId<HTMLElement>("adminProviderSignalLine");
  if (!host || !badge || !line || !signal) return false;
  host.dataset.tone = String(payload.tone || "neutral");
  host.style.setProperty("--provider-health", clamp(payload.healthRatio, 0, 1).toFixed(3));
  host.style.setProperty("--provider-timeout", clamp(payload.timeoutRatio, 0, 1).toFixed(3));
  host.style.setProperty("--provider-stale", clamp(payload.staleRatio, 0, 1).toFixed(3));
  badge.textContent = String(payload.badgeText || "PROVIDER");
  setBadgeClass(badge, payload.badgeTone || "info");
  line.textContent = String(payload.lineText || "Provider runtime");
  signal.textContent = String(payload.signalLineText || "Provider signals");
  pulseOnce(line);
  pulseOnce(signal);
  (payload.chips || []).forEach(setLiveChip);
  applyMeters(payload.meters || []);
  renderRowList("adminProviderAlertList", payload.rows || [], payload.emptyText);
  return true;
}

function renderDecisionTrace(payload: DecisionTracePayload): boolean {
  const host = byId<HTMLElement>("adminDecisionTraceStrip");
  const badge = byId<HTMLElement>("adminDecisionTraceBadge");
  const line = byId<HTMLElement>("adminDecisionTraceLine");
  const signal = byId<HTMLElement>("adminDecisionTraceSignalLine");
  if (!host || !badge || !line || !signal) return false;
  host.dataset.tone = String(payload.tone || "neutral");
  host.style.setProperty("--decision-flow", clamp(payload.flowRatio, 0, 1).toFixed(3));
  host.style.setProperty("--decision-risk", clamp(payload.riskRatio, 0, 1).toFixed(3));
  badge.textContent = String(payload.badgeText || "TRACE");
  setBadgeClass(badge, payload.badgeTone || "info");
  line.textContent = String(payload.lineText || "Decision trace runtime");
  signal.textContent = String(payload.signalLineText || "Decision trace signals");
  pulseOnce(line);
  pulseOnce(signal);
  (payload.chips || []).forEach(setLiveChip);
  applyMeters(payload.meters || []);
  renderRowList("adminDecisionTraceList", payload.rows || [], payload.emptyText);
  return true;
}

function render(payload: AdminTreasuryBridgePayload): boolean {
  let handled = false;
  if (payload?.treasury) handled = renderTreasury(payload.treasury) || handled;
  if (payload?.provider) handled = renderProvider(payload.provider) || handled;
  if (payload?.decisionTrace) handled = renderDecisionTrace(payload.decisionTrace) || handled;
  return handled;
}

export function installAdminTreasuryBridge(): void {
  window.__AKR_ADMIN_TREASURY__ = { render };
}
