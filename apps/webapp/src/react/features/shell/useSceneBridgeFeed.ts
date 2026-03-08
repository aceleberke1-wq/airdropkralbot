import { useEffect } from "react";
import { buildAdminBridgePayloads, buildPlayerBridgePayloads } from "../../../core/runtime/sceneBridgePayloads.js";

type SceneBridgeFeedOptions = {
  enabled: boolean;
  workspace: "player" | "admin";
  tab: "home" | "pvp" | "tasks" | "vault";
  scene: Record<string, unknown> | null;
  sceneRuntime: Record<string, unknown> | null;
  data: Record<string, unknown> | null;
  homeFeed: Record<string, unknown> | null;
  taskResult: Record<string, unknown> | null;
  pvpRuntime: Record<string, unknown> | null;
  leagueOverview: Record<string, unknown> | null;
  pvpLive: {
    leaderboard: Record<string, unknown> | null;
    diagnostics: Record<string, unknown> | null;
    tick: Record<string, unknown> | null;
  };
  vaultData: Record<string, unknown> | null;
  adminRuntime: {
    summary: Record<string, unknown> | null;
    queue: Array<Record<string, unknown>>;
  } | null;
  adminPanels: Record<string, unknown> | null;
};

const METER_PALETTES: Record<string, { start: string; end: string; glow: string }> = {
  neutral: { start: "#3df8c2", end: "#ffb85c", glow: "rgba(61, 248, 194, 0.42)" },
  safe: { start: "#70ffa0", end: "#3df8c2", glow: "rgba(112, 255, 160, 0.38)" },
  balanced: { start: "#7fd6ff", end: "#3df8c2", glow: "rgba(127, 214, 255, 0.4)" },
  aggressive: { start: "#ff5d7d", end: "#ffb85c", glow: "rgba(255, 93, 125, 0.44)" },
  critical: { start: "#ff416d", end: "#ffc266", glow: "rgba(255, 93, 125, 0.56)" }
};

function byId<T extends HTMLElement>(id: string) {
  return document.getElementById(id) as T | null;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function setMeter(node: HTMLElement | null, pct: number, paletteKey = "balanced") {
  if (!node?.style) {
    return;
  }
  const palette = METER_PALETTES[String(paletteKey || "balanced").toLowerCase()] || METER_PALETTES.balanced;
  node.style.width = `${Math.round(clamp(Number(pct || 0)))}%`;
  node.style.setProperty("--meter-start", palette.start);
  node.style.setProperty("--meter-end", palette.end);
  node.style.setProperty("--meter-glow", palette.glow);
}

function renderPvpRadarTelemetry(payload: Record<string, unknown> | null | undefined) {
  if (!payload) {
    return;
  }
  const root = byId<HTMLElement>("pvpRadarStrip");
  const badge = byId<HTMLElement>("pvpRadarToneBadge");
  const line = byId<HTMLElement>("pvpRadarLine");
  const hint = byId<HTMLElement>("pvpRadarHint");
  const flowLine = byId<HTMLElement>("pvpDuelFlowLine");
  const flowMeter = byId<HTMLElement>("pvpDuelFlowMeter");
  const clutchLine = byId<HTMLElement>("pvpClutchVectorLine");
  const clutchMeter = byId<HTMLElement>("pvpClutchVectorMeter");
  if (!root || !badge || !line || !hint || !flowLine || !flowMeter || !clutchLine || !clutchMeter) {
    return;
  }
  const tone = String(payload.tone || "neutral").toLowerCase();
  root.dataset.tone = tone;
  badge.textContent = String(payload.badgeText || "IDLE");
  badge.className = tone === "critical" ? "badge warn" : tone === "advantage" ? "badge" : "badge info";
  line.textContent = String(payload.lineText || "-");
  hint.textContent = String(payload.hintText || "-");
  flowLine.textContent = String(payload.duelFlowLineText || "-");
  clutchLine.textContent = String(payload.clutchLineText || "-");
  setMeter(flowMeter, Number(payload.duelFlowPct || 0), tone === "advantage" ? "safe" : tone === "critical" ? "critical" : "balanced");
  setMeter(clutchMeter, Number(payload.clutchPct || 0), tone === "critical" ? "aggressive" : "balanced");
}

function renderPlayerBridges(payloads: ReturnType<typeof buildPlayerBridgePayloads>) {
  const anyWindow = window as any;
  if (payloads.sceneStatus && anyWindow.__AKR_SCENE_STATUS_DECK__?.render) {
    anyWindow.__AKR_SCENE_STATUS_DECK__.render(payloads.sceneStatus);
  }
  if (payloads.sceneTelemetry && anyWindow.__AKR_SCENE_TELEMETRY__?.render) {
    anyWindow.__AKR_SCENE_TELEMETRY__.render(payloads.sceneTelemetry);
  }
  if (payloads.publicTelemetry?.assetManifest && anyWindow.__AKR_PUBLIC_TELEMETRY__?.renderAssetManifest) {
    anyWindow.__AKR_PUBLIC_TELEMETRY__.renderAssetManifest(payloads.publicTelemetry.assetManifest);
  }
  if (payloads.publicTelemetry?.pvpLeaderboard && anyWindow.__AKR_PUBLIC_TELEMETRY__?.renderPvpLeaderboard) {
    anyWindow.__AKR_PUBLIC_TELEMETRY__.renderPvpLeaderboard(payloads.publicTelemetry.pvpLeaderboard);
  }
  if (payloads.operations && anyWindow.__AKR_OPERATIONS_DECK__?.render) {
    anyWindow.__AKR_OPERATIONS_DECK__.render(payloads.operations);
  }
  if (payloads.tokenOverview && anyWindow.__AKR_TOKEN_OVERVIEW__?.render) {
    anyWindow.__AKR_TOKEN_OVERVIEW__.render(payloads.tokenOverview);
  }
  if (payloads.tokenTreasury && anyWindow.__AKR_TOKEN_TREASURY__?.render) {
    anyWindow.__AKR_TOKEN_TREASURY__.render(payloads.tokenTreasury);
  }
  if (payloads.pvpRadar) {
    renderPvpRadarTelemetry(payloads.pvpRadar as Record<string, unknown>);
    const radarCanvas = byId<HTMLCanvasElement>("pvpRadarCanvas");
    if (radarCanvas && anyWindow.__AKR_PVP_RADAR__?.draw) {
      anyWindow.__AKR_PVP_RADAR__.draw(radarCanvas, payloads.pvpRadar);
    }
  }
  if (payloads.pvpRejectIntel && anyWindow.__AKR_PVP_REJECT_INTEL__?.render) {
    anyWindow.__AKR_PVP_REJECT_INTEL__.render(payloads.pvpRejectIntel);
  }
  if (payloads.pvpDirector && anyWindow.__AKR_PVP_DIRECTOR__?.render) {
    anyWindow.__AKR_PVP_DIRECTOR__.render(payloads.pvpDirector);
  }
  if (payloads.pvpEvents && anyWindow.__AKR_PVP_EVENTS__?.render) {
    anyWindow.__AKR_PVP_EVENTS__.render(payloads.pvpEvents);
  }
  if (payloads.pvpDuel && anyWindow.__AKR_PVP_DUEL__?.render) {
    anyWindow.__AKR_PVP_DUEL__.render(payloads.pvpDuel);
  }
  if (payloads.combatHud && anyWindow.__AKR_COMBAT_HUD__?.render) {
    anyWindow.__AKR_COMBAT_HUD__.render(payloads.combatHud);
  }
  if (payloads.cameraDirector && anyWindow.__AKR_CAMERA_DIRECTOR__?.render) {
    anyWindow.__AKR_CAMERA_DIRECTOR__.render(payloads.cameraDirector);
  }
  if (payloads.pvpRoundDirector && anyWindow.__AKR_ROUND_DIRECTOR__?.render) {
    anyWindow.__AKR_ROUND_DIRECTOR__.render(payloads.pvpRoundDirector);
  }
}

function renderAdminBridges(payloads: ReturnType<typeof buildAdminBridgePayloads>) {
  const anyWindow = window as any;
  if (payloads.runtime && anyWindow.__AKR_ADMIN_RUNTIME__?.render) {
    anyWindow.__AKR_ADMIN_RUNTIME__.render(payloads.runtime);
  }
  if (payloads.assetStatus && anyWindow.__AKR_ADMIN_ASSET_STATUS__?.render) {
    anyWindow.__AKR_ADMIN_ASSET_STATUS__.render(payloads.assetStatus);
  }
  if (payloads.assetRuntime && anyWindow.__AKR_ADMIN_ASSET_RUNTIME__?.render) {
    anyWindow.__AKR_ADMIN_ASSET_RUNTIME__.render(payloads.assetRuntime);
  }
  if (payloads.auditRuntime && anyWindow.__AKR_ADMIN_AUDIT_RUNTIME__?.render) {
    anyWindow.__AKR_ADMIN_AUDIT_RUNTIME__.render(payloads.auditRuntime);
  }
}

export function useSceneBridgeFeed(options: SceneBridgeFeedOptions) {
  useEffect(() => {
    if (!options.enabled || typeof window === "undefined") {
      return;
    }
    const anyWindow = window as any;
    const mutators = anyWindow.__AKR_STATE_MUTATORS__;
    if (!mutators) {
      return;
    }

    if (options.workspace === "player") {
      const payloads = buildPlayerBridgePayloads({
        mutators,
        data: options.data || {},
        homeFeed: options.homeFeed || {},
        taskResult: options.taskResult || {},
        pvpRuntime: options.pvpRuntime || {},
        leagueOverview: options.leagueOverview || {},
        pvpLive: options.pvpLive || {},
        vaultData: options.vaultData || {},
        scene: options.scene || {},
        sceneRuntime: options.sceneRuntime || {}
      });
      renderPlayerBridges(payloads);
      return;
    }

    const payloads = buildAdminBridgePayloads({
      mutators,
      adminRuntime: options.adminRuntime || { summary: null, queue: [] },
      adminPanels: options.adminPanels || {}
    });
    renderAdminBridges(payloads);
  }, [
    options.enabled,
    options.workspace,
    options.tab,
    options.scene,
    options.sceneRuntime,
    options.data,
    options.homeFeed,
    options.taskResult,
    options.pvpRuntime,
    options.leagueOverview,
    options.pvpLive,
    options.vaultData,
    options.adminRuntime,
    options.adminPanels
  ]);
}
