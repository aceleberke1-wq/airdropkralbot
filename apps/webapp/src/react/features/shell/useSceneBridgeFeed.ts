import { useEffect } from "react";
import { buildAdminBridgePayloads, buildPlayerBridgePayloads } from "../../../core/runtime/sceneBridgePayloads.js";

type SceneBridgeFeedOptions = {
  enabled: boolean;
  workspace: "player" | "admin";
  tab: "home" | "pvp" | "tasks" | "vault";
  scene: Record<string, unknown> | null;
  sceneRuntime: Record<string, unknown> | null;
  data: Record<string, unknown> | null;
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
    options.taskResult,
    options.pvpRuntime,
    options.leagueOverview,
    options.pvpLive,
    options.vaultData,
    options.adminRuntime,
    options.adminPanels
  ]);
}
