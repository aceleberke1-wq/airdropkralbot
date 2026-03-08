import { useEffect, useMemo, useRef, useState } from "react";
import { resolveSceneBundlePlan } from "../../../core/runtime/sceneBundlePlan.js";

type SceneRuntimeLoaderOptions = {
  workspace: "player" | "admin";
  tab: "home" | "pvp" | "tasks" | "vault";
  trackUiEvent: (payload: Record<string, unknown>) => void;
  scene: {
    effectiveQuality: string;
    capabilityProfile: Record<string, unknown> | null;
  };
};

type SceneRuntimeStatus = {
  phase: "idle" | "preparing" | "ready" | "error";
  workspace: "player" | "admin";
  tab: "home" | "pvp" | "tasks" | "vault";
  districtKey: string;
  profileKey: string;
  effectiveQuality: string;
  lowEndMode: boolean;
  loadedBundles: string[];
  skippedBundles: string[];
  error: string;
};

const installedBundles = new Set<string>();

const bundleInstallers: Record<string, () => Promise<void>> = {
  runtime_core: async () => {
    const [apiBridge, schedulerBridge, perfBridge, stateBridge] = await Promise.all([
      import("../../../net/apiBridge"),
      import("../../../net/schedulerBridge"),
      import("../../../telemetry/bridge"),
      import("../../../game/state/v3StateBridge")
    ]);
    apiBridge.installNetApiBridge();
    schedulerBridge.installNetSchedulerBridge();
    perfBridge.installPerfBridge();
    stateBridge.installV3StateMutatorBridge();
  },
  player_surface: async () => {
    const [opsDeck, publicStrips, sceneStatus, sceneTelemetry, telemetryDeck] = await Promise.all([
      import("../../../ui/operationsDeckBridge"),
      import("../../../ui/publicTelemetryStripsBridge"),
      import("../../../ui/sceneStatusDeckBridge"),
      import("../../../ui/sceneTelemetryBridge"),
      import("../../../ui/telemetryDeck")
    ]);
    opsDeck.installOperationsDeckBridge();
    publicStrips.installPublicTelemetryStripsBridge();
    sceneStatus.installSceneStatusDeckBridge();
    sceneTelemetry.installSceneTelemetryBridge();
    telemetryDeck.installTelemetryDeckBridge();
  },
  pvp_core: async () => {
    const [combatHud, rejectIntel, pvpEvent, pvpRadar, roundDirector] = await Promise.all([
      import("../../../ui/combatHudBridge"),
      import("../../../ui/pvpRejectIntelBridge"),
      import("../../../ui/pvpEventBridge"),
      import("../../../ui/pvpRadarBridge"),
      import("../../../ui/roundDirectorBridge")
    ]);
    combatHud.installCombatHudBridge();
    rejectIntel.installPvpRejectIntelBridge();
    pvpEvent.installPvpEventBridge();
    pvpRadar.installPvpRadarBridge();
    roundDirector.installRoundDirectorBridge();
  },
  pvp_cinematic: async () => {
    const [combatFx, pvpDuel, pvpDirector, cameraDirector] = await Promise.all([
      import("../../../ui/combatFxBridge"),
      import("../../../ui/pvpDuelBridge"),
      import("../../../ui/pvpDirectorBridge"),
      import("../../../ui/cameraDirectorBridge")
    ]);
    combatFx.installCombatFxBridge();
    pvpDuel.installPvpDuelBridge();
    pvpDirector.installPvpDirectorBridge();
    cameraDirector.installCameraDirectorBridge();
  },
  vault_surface: async () => {
    const [tokenOverview, tokenTreasury] = await Promise.all([
      import("../../../ui/tokenOverviewBridge"),
      import("../../../ui/tokenTreasuryBridge")
    ]);
    tokenOverview.installTokenOverviewBridge();
    tokenTreasury.installTokenTreasuryBridge();
  },
  admin_surface: async () => {
    const [adminOverview, adminRuntime, adminTreasury, adminAssetStatus, adminAssetRuntime, adminAuditRuntime] = await Promise.all([
      import("../../../ui/adminOverviewBridge"),
      import("../../../ui/adminRuntimeBridge"),
      import("../../../ui/adminTreasuryBridge"),
      import("../../../ui/adminAssetStatusBridge"),
      import("../../../ui/adminAssetRuntimeBridge"),
      import("../../../ui/adminAuditRuntimeBridge")
    ]);
    adminOverview.installAdminOverviewBridge();
    adminRuntime.installAdminRuntimeBridge();
    adminTreasury.installAdminTreasuryBridge();
    adminAssetStatus.installAdminAssetStatusBridge();
    adminAssetRuntime.installAdminAssetRuntimeBridge();
    adminAuditRuntime.installAdminAuditRuntimeBridge();
  }
};

async function ensureBundleInstalled(bundleKey: string): Promise<void> {
  if (installedBundles.has(bundleKey)) {
    return;
  }
  const install = bundleInstallers[bundleKey];
  if (!install) {
    throw new Error(`scene_bundle_unknown:${bundleKey}`);
  }
  await install();
  installedBundles.add(bundleKey);
}

export function useSceneRuntimeLoader(options: SceneRuntimeLoaderOptions) {
  const [status, setStatus] = useState<SceneRuntimeStatus>({
    phase: "idle",
    workspace: options.workspace,
    tab: options.tab,
    districtKey: "central_hub",
    profileKey: "",
    effectiveQuality: "medium",
    lowEndMode: false,
    loadedBundles: [],
    skippedBundles: [],
    error: ""
  });
  const readyTelemetryRef = useRef<string>("");
  const plan = useMemo(
    () =>
      resolveSceneBundlePlan({
        workspace: options.workspace,
        tab: options.tab,
        effectiveQuality: options.scene.effectiveQuality,
        profileKey: String(options.scene.capabilityProfile?.profile_key || ""),
        lowEndMode: Boolean(options.scene.capabilityProfile?.low_end_mode)
      }),
    [options.scene.capabilityProfile, options.scene.effectiveQuality, options.tab, options.workspace]
  );

  useEffect(() => {
    let cancelled = false;
    const requestKey = `${plan.workspace}:${plan.tab}:${plan.profile_key}:${plan.bundles.join(",")}:${plan.skipped_bundles.join(",")}`;
    const planWorkspace = plan.workspace as SceneRuntimeStatus["workspace"];
    const planTab = plan.tab as SceneRuntimeStatus["tab"];

    setStatus({
      phase: "preparing",
      workspace: planWorkspace,
      tab: planTab,
      districtKey: plan.district_key,
      profileKey: plan.profile_key,
      effectiveQuality: plan.effective_quality,
      lowEndMode: plan.low_end_mode,
      loadedBundles: [],
      skippedBundles: plan.skipped_bundles,
      error: ""
    });

    const run = async () => {
      const loadedBundles: string[] = [];
      try {
        for (const bundleKey of plan.bundles) {
          await ensureBundleInstalled(bundleKey);
          loadedBundles.push(bundleKey);
          if (!cancelled) {
            setStatus((prev) => ({
              ...prev,
              phase: "preparing",
              loadedBundles: [...loadedBundles]
            }));
          }
        }
        if (cancelled) {
          return;
        }
        setStatus({
          phase: "ready",
          workspace: planWorkspace,
          tab: planTab,
          districtKey: plan.district_key,
          profileKey: plan.profile_key,
          effectiveQuality: plan.effective_quality,
          lowEndMode: plan.low_end_mode,
          loadedBundles,
          skippedBundles: plan.skipped_bundles,
          error: ""
        });
        if (readyTelemetryRef.current !== requestKey) {
          readyTelemetryRef.current = requestKey;
          options.trackUiEvent({
            event_key: "runtime.scene.ready",
            panel_key: "shell",
            surface_key: "shell",
            payload_json: {
              workspace: plan.workspace,
              tab: plan.tab,
              district_key: plan.district_key,
              profile_key: plan.profile_key,
              effective_quality: plan.effective_quality,
              low_end_mode: plan.low_end_mode,
              loaded_bundles: loadedBundles,
              skipped_bundles: plan.skipped_bundles
            }
          });
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : "scene_runtime_failed";
        setStatus({
          phase: "error",
          workspace: planWorkspace,
          tab: planTab,
          districtKey: plan.district_key,
          profileKey: plan.profile_key,
          effectiveQuality: plan.effective_quality,
          lowEndMode: plan.low_end_mode,
          loadedBundles,
          skippedBundles: plan.skipped_bundles,
          error: message
        });
        options.trackUiEvent({
          event_key: "runtime.scene.failed",
          panel_key: "shell",
          surface_key: "shell",
          payload_json: {
            workspace: plan.workspace,
            tab: plan.tab,
            district_key: plan.district_key,
            profile_key: plan.profile_key,
            effective_quality: plan.effective_quality,
            error: message,
            loaded_bundles: loadedBundles
          }
        });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [options.trackUiEvent, plan]);

  return { sceneRuntime: status };
}
