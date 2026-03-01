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
  selected?: boolean;
};

type RoutePayload = {
  tone: Tone;
  routeCoverage: number;
  quorumRatio: number;
  badgeText: string;
  badgeTone: BadgeTone;
  lineText: string;
  chips: LiveChipPayload[];
  meters: MeterPayload[];
  rows: ListRowPayload[];
  emptyText?: string;
};

type TxLifecyclePayload = {
  tone: Tone;
  progressRatio: number;
  verifyConfidence: number;
  badgeText: string;
  badgeTone: BadgeTone;
  lineText: string;
  signalLineText: string;
  chips: LiveChipPayload[];
  meters: MeterPayload[];
  rows: ListRowPayload[];
  emptyText?: string;
};

type DirectorPayload = {
  tone: Tone;
  readinessRatio: number;
  riskRatio: number;
  badgeText: string;
  badgeTone: BadgeTone;
  lineText: string;
  stepLineText: string;
  chips: LiveChipPayload[];
  meters: MeterPayload[];
  rows: ListRowPayload[];
  emptyText?: string;
};

type TreasuryPulseChipTone = "neutral" | "safe" | "balanced" | "aggressive" | "critical";

type TreasuryPulseChipPayload = {
  id: string;
  text: string;
  tone: TreasuryPulseChipTone;
  level: number;
};

type TreasuryPulsePayload = {
  tone: Tone;
  badgeText: string;
  badgeTone: BadgeTone;
  stateLineText: string;
  gateLineText: string;
  curveLineText: string;
  quorumLineText: string;
  policyLineText: string;
  chips: TreasuryPulseChipPayload[];
  meters: MeterPayload[];
};

export type TokenTreasuryBridgePayload = {
  pulse?: TreasuryPulsePayload;
  route?: RoutePayload;
  txLifecycle?: TxLifecyclePayload;
  actionDirector?: DirectorPayload;
};

type TokenTreasuryBridge = {
  render: (payload: TokenTreasuryBridgePayload) => boolean;
};

declare global {
  interface Window {
    __AKR_TOKEN_TREASURY__?: TokenTreasuryBridge;
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

function setBadgeClass(node: HTMLElement | null, tone: BadgeTone): void {
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

function setTreasuryPulseChip(payload: TreasuryPulseChipPayload): void {
  const node = byId<HTMLElement>(payload.id);
  if (!node) {
    return;
  }
  node.textContent = String(payload.text || "--");
  node.className = "combatAlertChip";
  const tone = String(payload.tone || "neutral").toLowerCase();
  if (tone === "critical") {
    node.classList.add("critical");
  } else if (tone === "aggressive") {
    node.classList.add("aggressive");
  } else if (tone === "balanced") {
    node.classList.add("balanced");
  } else if (tone === "safe") {
    node.classList.add("safe");
  } else {
    node.classList.add("neutral");
  }
  node.style.setProperty("--chip-level", clamp(asNum(payload.level), 0, 1).toFixed(3));
}

function renderRowList(listId: string, rows: ListRowPayload[], emptyText?: string): void {
  const list = byId<HTMLElement>(listId);
  if (!list) {
    return;
  }
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
    const rowTone = row.tone === "missing" ? "missing" : "ready";
    li.className = `tokenRouteRow ${rowTone}${row.selected ? " selected" : ""}`;
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
    const el = byId<HTMLElement>(meter.id);
    setMeter(el, meter.pct, meter.palette);
  });
}

function renderPulse(pulse: TreasuryPulsePayload): boolean {
  const host = byId<HTMLElement>("tokenTreasuryPulseStrip");
  const badge = byId<HTMLElement>("treasuryStateBadge");
  const stateLine = byId<HTMLElement>("treasuryStateLine");
  const gateLine = byId<HTMLElement>("tokenGateLine");
  const curveLine = byId<HTMLElement>("tokenCurveLine");
  const quorumLine = byId<HTMLElement>("tokenQuorumLine");
  const policyLine = byId<HTMLElement>("tokenPolicyLine");
  if (!host || !badge || !stateLine || !gateLine || !curveLine || !quorumLine || !policyLine) {
    return false;
  }
  host.dataset.tone = String(pulse.tone || "neutral");
  badge.textContent = String(pulse.badgeText || "STABLE");
  setBadgeClass(badge, pulse.badgeTone || "info");
  stateLine.textContent = String(pulse.stateLineText || "Gate/curve/quorum degerleri yukleniyor.");
  gateLine.textContent = String(pulse.gateLineText || "CAP 0% | LOCKED");
  curveLine.textContent = String(pulse.curveLineText || "SUPPLY NORM 0.00");
  quorumLine.textContent = String(pulse.quorumLineText || "Provider 0/0");
  policyLine.textContent = String(pulse.policyLineText || "Risk 0% | AUTO OFF");
  pulseOnce(stateLine);
  (Array.isArray(pulse.chips) ? pulse.chips : []).forEach(setTreasuryPulseChip);
  applyMeters(pulse.meters || []);
  return true;
}

function renderRoute(route: RoutePayload): boolean {
  const host = byId<HTMLElement>("tokenRouteRuntimeStrip");
  const badge = byId<HTMLElement>("tokenRouteBadge");
  const line = byId<HTMLElement>("tokenRouteLine");
  if (!host || !badge || !line) {
    return false;
  }
  host.dataset.tone = String(route.tone || "neutral");
  host.style.setProperty("--route-coverage", clamp(route.routeCoverage, 0, 1).toFixed(3));
  host.style.setProperty("--route-quorum", clamp(route.quorumRatio, 0, 1).toFixed(3));
  badge.textContent = String(route.badgeText || "ROUTE");
  setBadgeClass(badge, route.badgeTone || "info");
  line.textContent = String(route.lineText || "Route telemetry trace");
  pulseOnce(line);
  (Array.isArray(route.chips) ? route.chips : []).forEach(setLiveChip);
  applyMeters(route.meters || []);
  renderRowList("tokenRouteList", route.rows || [], route.emptyText);
  return true;
}

function renderTxLifecycle(tx: TxLifecyclePayload): boolean {
  const host = byId<HTMLElement>("tokenTxLifecycleStrip");
  const badge = byId<HTMLElement>("tokenTxLifecycleBadge");
  const line = byId<HTMLElement>("tokenTxLifecycleLine");
  const signalLine = byId<HTMLElement>("tokenTxLifecycleSignalLine");
  if (!host || !badge || !line || !signalLine) {
    return false;
  }
  host.dataset.tone = String(tx.tone || "neutral");
  host.style.setProperty("--token-lifecycle-progress", clamp(tx.progressRatio, 0, 1).toFixed(3));
  host.style.setProperty("--token-lifecycle-verify", clamp(tx.verifyConfidence, 0, 1).toFixed(3));
  badge.textContent = String(tx.badgeText || "IDLE");
  setBadgeClass(badge, tx.badgeTone || "info");
  line.textContent = String(tx.lineText || "Lifecycle trace");
  signalLine.textContent = String(tx.signalLineText || "Verify trace");
  pulseOnce(line);
  pulseOnce(signalLine);
  (Array.isArray(tx.chips) ? tx.chips : []).forEach(setLiveChip);
  applyMeters(tx.meters || []);
  renderRowList("tokenTxLifecycleList", tx.rows || [], tx.emptyText);
  return true;
}

function renderActionDirector(director: DirectorPayload): boolean {
  const host = byId<HTMLElement>("tokenActionDirectorStrip");
  const badge = byId<HTMLElement>("tokenActionDirectorBadge");
  const line = byId<HTMLElement>("tokenActionDirectorLine");
  const stepLine = byId<HTMLElement>("tokenActionDirectorStepLine");
  if (!host || !badge || !line || !stepLine) {
    return false;
  }
  host.dataset.tone = String(director.tone || "neutral");
  host.style.setProperty("--token-director-ready", clamp(director.readinessRatio, 0, 1).toFixed(3));
  host.style.setProperty("--token-director-risk", clamp(director.riskRatio, 0, 1).toFixed(3));
  badge.textContent = String(director.badgeText || "IDLE");
  setBadgeClass(badge, director.badgeTone || "info");
  line.textContent = String(director.lineText || "Director trace");
  stepLine.textContent = String(director.stepLineText || "Next step trace");
  pulseOnce(line);
  pulseOnce(stepLine);
  (Array.isArray(director.chips) ? director.chips : []).forEach(setLiveChip);
  applyMeters(director.meters || []);
  renderRowList("tokenActionDirectorList", director.rows || [], director.emptyText);
  return true;
}

function render(payload: TokenTreasuryBridgePayload): boolean {
  let handled = false;
  if (payload?.pulse) {
    handled = renderPulse(payload.pulse) || handled;
  }
  if (payload?.route) {
    handled = renderRoute(payload.route) || handled;
  }
  if (payload?.txLifecycle) {
    handled = renderTxLifecycle(payload.txLifecycle) || handled;
  }
  if (payload?.actionDirector) {
    handled = renderActionDirector(payload.actionDirector) || handled;
  }
  return handled;
}

export function installTokenTreasuryBridge(): void {
  window.__AKR_TOKEN_TREASURY__ = { render };
}
