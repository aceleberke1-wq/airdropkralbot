type BadgeTone = "warn" | "default" | "info";

type StripChip = {
  text: string;
  tone?: string;
  level?: number;
};

type AssetManifestStripPayload = {
  tone?: string;
  badgeText?: string;
  badgeTone?: BadgeTone;
  lineText?: string;
  hintText?: string;
  selectionLineText?: string;
  readyPct?: number;
  integrityPct?: number;
  readyPalette?: string;
  integrityPalette?: string;
  manifestReady?: number;
  manifestIntegrity?: number;
  manifestRisk?: number;
  chips?: {
    source?: StripChip;
    revision?: StripChip;
    ready?: StripChip;
    integrity?: StripChip;
  };
};

type PvpLeaderboardStripPayload = {
  tone?: string;
  badgeText?: string;
  badgeTone?: BadgeTone;
  lineText?: string;
  heatPct?: number;
  freshPct?: number;
  heatPalette?: string;
  freshPalette?: string;
  leaderPressure?: number;
  chips?: {
    spread?: StripChip;
    volume?: StripChip;
    fresh?: StripChip;
    transport?: StripChip;
  };
};

type PublicTelemetryBridge = {
  renderAssetManifest: (payload: AssetManifestStripPayload) => boolean;
  renderPvpLeaderboard: (payload: PvpLeaderboardStripPayload) => boolean;
};

type MeterPalette = "neutral" | "safe" | "balanced" | "aggressive" | "critical";

const METER_PALETTES: Record<MeterPalette, { start: string; end: string; glow: string }> = Object.freeze({
  neutral: { start: "#3df8c2", end: "#ffb85c", glow: "rgba(61, 248, 194, 0.42)" },
  safe: { start: "#70ffa0", end: "#3df8c2", glow: "rgba(112, 255, 160, 0.38)" },
  balanced: { start: "#7fd6ff", end: "#3df8c2", glow: "rgba(127, 214, 255, 0.4)" },
  aggressive: { start: "#ff5d7d", end: "#ffb85c", glow: "rgba(255, 93, 125, 0.44)" },
  critical: { start: "#ff416d", end: "#ffc266", glow: "rgba(255, 93, 125, 0.56)" }
});

declare global {
  interface Window {
    __AKR_PUBLIC_TELEMETRY__?: PublicTelemetryBridge;
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

function setBadge(node: HTMLElement | null, text: string | undefined, tone: BadgeTone | undefined): void {
  if (!node) {
    return;
  }
  node.textContent = String(text || "");
  node.className = tone === "warn" ? "badge warn" : tone === "default" ? "badge" : "badge info";
}

function setChip(node: HTMLElement | null, chip: StripChip | undefined): void {
  if (!node) {
    return;
  }
  node.textContent = String(chip?.text || "-");
  node.classList.remove("neutral", "balanced", "advantage", "pressure", "critical");
  node.classList.add(String(chip?.tone || "neutral"));
  node.style.setProperty("--chip-level", clamp(asNum(chip?.level), 0, 1).toFixed(3));
}

function setMeterPalette(node: HTMLElement | null, paletteKey: string | undefined): void {
  if (!node?.style) {
    return;
  }
  const key = String(paletteKey || "neutral").toLowerCase() as MeterPalette;
  const palette = METER_PALETTES[key] || METER_PALETTES.neutral;
  node.style.setProperty("--meter-start", palette.start);
  node.style.setProperty("--meter-end", palette.end);
  node.style.setProperty("--meter-glow", palette.glow);
}

function setMeter(node: HTMLElement | null, pct: number | undefined, paletteKey: string | undefined): void {
  if (!node) {
    return;
  }
  node.style.width = `${Math.round(clamp(asNum(pct), 0, 100))}%`;
  setMeterPalette(node, paletteKey);
}

function renderAssetManifest(payload: AssetManifestStripPayload): boolean {
  const host = byId<HTMLElement>("assetManifestStrip");
  const badge = byId<HTMLElement>("assetManifestBadge");
  const line = byId<HTMLElement>("assetManifestLine");
  const hint = byId<HTMLElement>("assetManifestHint");
  const selection = byId<HTMLElement>("assetManifestSelectionLine");
  const readyMeter = byId<HTMLElement>("assetManifestReadyMeter");
  const integrityMeter = byId<HTMLElement>("assetManifestIntegrityMeter");
  if (!host || !badge || !line || !hint || !readyMeter || !integrityMeter) {
    return false;
  }
  host.dataset.tone = String(payload.tone || "neutral");
  host.style.setProperty("--manifest-ready", clamp(asNum(payload.manifestReady), 0, 1).toFixed(3));
  host.style.setProperty("--manifest-integrity", clamp(asNum(payload.manifestIntegrity), 0, 1).toFixed(3));
  host.style.setProperty("--manifest-risk", clamp(asNum(payload.manifestRisk), 0, 1).toFixed(3));
  setBadge(badge, payload.badgeText, payload.badgeTone);
  line.textContent = String(payload.lineText || "");
  hint.textContent = String(payload.hintText || "");
  if (selection) {
    selection.textContent = String(payload.selectionLineText || "ACTIVE district asset bekleniyor");
  }
  setChip(byId("assetManifestSourceChip"), payload.chips?.source);
  setChip(byId("assetManifestRevisionChip"), payload.chips?.revision);
  setChip(byId("assetManifestReadyChip"), payload.chips?.ready);
  setChip(byId("assetManifestIntegrityChip"), payload.chips?.integrity);
  setMeter(readyMeter, payload.readyPct, payload.readyPalette);
  setMeter(integrityMeter, payload.integrityPct, payload.integrityPalette);
  return true;
}

function renderPvpLeaderboard(payload: PvpLeaderboardStripPayload): boolean {
  const host = byId<HTMLElement>("pvpLeaderboardStrip");
  const badge = byId<HTMLElement>("pvpLeaderBadge");
  const line = byId<HTMLElement>("pvpLeaderLine");
  const heatMeter = byId<HTMLElement>("pvpLeaderHeatMeter");
  const freshMeter = byId<HTMLElement>("pvpLeaderFreshMeter");
  if (!host || !badge || !line || !heatMeter || !freshMeter) {
    return false;
  }
  host.dataset.tone = String(payload.tone || "neutral");
  host.style.setProperty("--leader-pressure", clamp(asNum(payload.leaderPressure), 0, 1).toFixed(3));
  setBadge(badge, payload.badgeText, payload.badgeTone);
  line.textContent = String(payload.lineText || "");
  setChip(byId("pvpLeaderSpreadChip"), payload.chips?.spread);
  setChip(byId("pvpLeaderVolumeChip"), payload.chips?.volume);
  setChip(byId("pvpLeaderFreshChip"), payload.chips?.fresh);
  setChip(byId("pvpLeaderTransportChip"), payload.chips?.transport);
  setMeter(heatMeter, payload.heatPct, payload.heatPalette);
  setMeter(freshMeter, payload.freshPct, payload.freshPalette);
  return true;
}

export function installPublicTelemetryStripsBridge(): void {
  window.__AKR_PUBLIC_TELEMETRY__ = {
    renderAssetManifest,
    renderPvpLeaderboard
  };
}
