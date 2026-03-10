import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildDistrictWorldState } from "../../../core/runtime/districtWorldState.js";
import { t, type Lang } from "../../i18n";

type BabylonDistrictSceneHostProps = {
  lang: Lang;
  workspace: "player" | "admin";
  tab: "home" | "pvp" | "tasks" | "vault";
  navigationContext: Record<string, unknown> | null;
  scene: Record<string, unknown>;
  sceneRuntime: Record<string, unknown>;
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
  };
  onNodeAction?: (payload: {
    actionKey: string;
    nodeKey: string;
    laneKey: string;
    label: string;
    labelKey?: string;
    sourceType?: string;
    actorKey?: string;
    interactionKind?: string;
    clusterKey?: string;
    isSecondary?: boolean;
    workspace: "player" | "admin";
    tab: "home" | "pvp" | "tasks" | "vault";
    districtKey: string;
  }) => void;
};

type BabylonSceneHandle = {
  dispose: () => void;
};

type HoverPreview = {
  key: string;
  label: string;
  labelKey: string;
  hintLabelKey: string;
  interactionKind: string;
  sourceType: string;
};

type ClusterActionItem = {
  key: string;
  label: string;
  label_key: string;
  action_key: string;
  actor_key: string;
  cluster_key: string;
  hint_label_key: string;
  interaction_kind: string;
  is_secondary: boolean;
};

async function loadBabylonSceneModules() {
  const [
    { Engine },
    { Scene },
    { ArcRotateCamera },
    { Vector3 },
    { Color3, Color4 },
    { HemisphericLight },
    { PointLight },
    { GlowLayer },
    { CreateDisc },
    { CreateBox },
    { CreateTorus },
    { CreateCylinder },
    { CreateSphere },
    { StandardMaterial }
  ] = await Promise.all([
    import("@babylonjs/core/Engines/engine"),
    import("@babylonjs/core/scene"),
    import("@babylonjs/core/Cameras/arcRotateCamera"),
    import("@babylonjs/core/Maths/math.vector"),
    import("@babylonjs/core/Maths/math.color"),
    import("@babylonjs/core/Lights/hemisphericLight"),
    import("@babylonjs/core/Lights/pointLight"),
    import("@babylonjs/core/Layers/glowLayer"),
    import("@babylonjs/core/Meshes/Builders/discBuilder"),
    import("@babylonjs/core/Meshes/Builders/boxBuilder"),
    import("@babylonjs/core/Meshes/Builders/torusBuilder"),
    import("@babylonjs/core/Meshes/Builders/cylinderBuilder"),
    import("@babylonjs/core/Meshes/Builders/sphereBuilder"),
    import("@babylonjs/core/Materials/standardMaterial")
  ]);
  return {
    ArcRotateCamera,
    Color3,
    Color4,
    CreateBox,
    CreateCylinder,
    CreateDisc,
    CreateSphere,
    CreateTorus,
    Engine,
    GlowLayer,
    HemisphericLight,
    PointLight,
    Scene,
    StandardMaterial,
    Vector3
  };
}

export function BabylonDistrictSceneHost(props: BabylonDistrictSceneHostProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<"idle" | "ready" | "failed">("idle");
  const [hoverPreview, setHoverPreview] = useState<HoverPreview | null>(null);
  const [hoveredClusterKeyState, setHoveredClusterKeyState] = useState("");
  const worldState = useMemo(
    () =>
      buildDistrictWorldState({
        workspace: props.workspace,
        tab: props.tab,
        scene: props.scene,
        sceneRuntime: props.sceneRuntime,
        navigationContext: props.navigationContext,
        data: props.data,
        homeFeed: props.homeFeed,
        taskResult: props.taskResult,
        pvpRuntime: props.pvpRuntime,
        leagueOverview: props.leagueOverview,
        pvpLive: props.pvpLive,
        vaultData: props.vaultData,
        adminRuntime: props.adminRuntime
      }),
    [
      props.adminRuntime,
      props.data,
      props.homeFeed,
      props.leagueOverview,
      props.navigationContext,
      props.pvpLive,
      props.pvpRuntime,
      props.scene,
      props.sceneRuntime,
      props.tab,
      props.taskResult,
      props.vaultData,
      props.workspace
    ]
  );
  const worldSignature = useMemo(
    () =>
      JSON.stringify({
        world_key: worldState.world_key,
        effective_quality: worldState.effective_quality,
        hud_density: worldState.hud_density,
        low_end_mode: worldState.low_end_mode,
        reduced_motion: worldState.reduced_motion,
        district_theme_key: worldState.district_theme_key,
        director_profile_key: worldState.director_profile_key,
        active_node_key: worldState.active_node_key,
        camera_profile_key: worldState.camera_profile_key,
        active_hotspot_key: worldState.active_hotspot_key,
        active_hotspot_cluster_key: worldState.active_hotspot_cluster_key,
        active_cluster_key: worldState.active_cluster_key,
        ambient_energy: worldState.ambient_energy,
        actors: worldState.actors.map((actor) => ({
          key: actor.key,
          kind: actor.kind,
          energy: actor.energy
        })),
        hotspots: worldState.hotspots.map((hotspot) => ({
          key: hotspot.key,
          action_key: hotspot.action_key,
          is_active: hotspot.is_active,
          is_secondary: hotspot.is_secondary,
          cluster_key: hotspot.cluster_key,
          energy: hotspot.energy
        })),
        interaction_clusters: worldState.interaction_clusters.map((cluster) => ({
          cluster_key: cluster.cluster_key,
          hotspot_count: cluster.hotspot_count,
          secondary_count: cluster.secondary_count,
          is_active: cluster.is_active,
          energy: cluster.energy
        })),
        nodes: worldState.nodes.map((node) => ({
          key: node.key,
          action_key: node.action_key,
          is_active: node.is_active,
          energy: node.energy,
          status_key: node.status_key,
          metric: node.metric
        }))
      }),
    [worldState]
  );
  const focusedCluster = useMemo(() => {
    const focusClusterKey = hoveredClusterKeyState || worldState.active_cluster_key;
    if (!focusClusterKey) {
      return null;
    }
    return worldState.interaction_clusters.find((cluster) => cluster.cluster_key === focusClusterKey) || null;
  }, [hoveredClusterKeyState, worldState.active_cluster_key, worldState.interaction_clusters]);
  const focusedClusterActions = useMemo(
    () => ((focusedCluster?.action_items as Array<ClusterActionItem> | undefined) || []).filter((item) => item.action_key),
    [focusedCluster]
  );

  const triggerSceneAction = useCallback(
    (payload: {
      actionKey: string;
      nodeKey: string;
      laneKey: string;
      label: string;
      labelKey?: string;
      sourceType?: string;
      actorKey?: string;
      interactionKind?: string;
      clusterKey?: string;
      isSecondary?: boolean;
      workspace: "player" | "admin";
      tab: "home" | "pvp" | "tasks" | "vault";
      districtKey: string;
    }) => {
      props.onNodeAction?.(payload);
    },
    [props.onNodeAction]
  );

  useEffect(() => {
    let disposed = false;
    let handle: BabylonSceneHandle | null = null;
    let hoveredHotspotKey = "";
    let hoveredClusterKey = "";

    const buildScene = async () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      try {
        const BABYLON = await loadBabylonSceneModules();
        if (disposed) {
          return;
        }
        const {
          ArcRotateCamera,
          Color3,
          Color4,
          CreateBox,
          CreateCylinder,
          CreateDisc,
          CreateSphere,
          CreateTorus,
          Engine,
          GlowLayer,
          HemisphericLight,
          PointLight,
          Scene,
          StandardMaterial,
          Vector3
        } = BABYLON;

        const engine = new Engine(
          canvas,
          worldState.effective_quality === "high" && !worldState.low_end_mode,
          {
            preserveDrawingBuffer: false,
            stencil: false,
            antialias: worldState.effective_quality === "high" && !worldState.low_end_mode,
            powerPreference: worldState.low_end_mode ? "low-power" : "high-performance"
          },
          false
        );
        engine.setHardwareScalingLevel(worldState.hardware_scaling);

        const scene = new Scene(engine);
        scene.clearColor = new Color4(0, 0, 0, 0);
        const theme = worldState.theme;
        const cameraProfile = worldState.camera_profile;
        const directorProfile = worldState.director_profile;
        const activeHotspot =
          worldState.hotspots.find((hotspot) => hotspot.key === worldState.active_hotspot_key) || worldState.hotspots[0] || null;
        const hotspotMap = new Map(worldState.hotspots.map((hotspot) => [hotspot.key, hotspot]));

        const camera = new ArcRotateCamera(
          "akrDistrictCamera",
          cameraProfile.alpha_base,
          cameraProfile.beta_base,
          cameraProfile.radius,
          new Vector3(0, cameraProfile.target_y, 0),
          scene
        );
        camera.lowerRadiusLimit = cameraProfile.radius - cameraProfile.lower_radius_delta;
        camera.upperRadiusLimit = cameraProfile.radius + cameraProfile.upper_radius_delta;
        camera.wheelDeltaPercentage = 0.01;
        camera.panningSensibility = 0;

        const hemi = new HemisphericLight("akrDistrictHemi", new Vector3(0, 1, 0), scene);
        hemi.intensity = worldState.low_end_mode ? 0.7 : 0.92;

        const point = new PointLight("akrDistrictPoint", new Vector3(0, 3.2, 0), scene);
        point.intensity = 1.2 + worldState.ambient_energy * 0.6;
        point.diffuse = Color3.FromHexString(theme.light_hex);

        if (!worldState.low_end_mode) {
          const glow = new GlowLayer("akrDistrictGlow", scene, {
            mainTextureFixedSize: worldState.effective_quality === "high" ? 1024 : 512,
            blurKernelSize: 32
          });
          glow.intensity = worldState.effective_quality === "high" ? 0.48 : 0.22;
        }

        const ground = CreateDisc(
          "akrDistrictGround",
          {
            radius: worldState.workspace === "admin" ? 5.6 : 5,
            tessellation: worldState.low_end_mode ? 36 : 64
          },
          scene
        );
        ground.rotation.x = Math.PI / 2;
        const groundMaterial = new StandardMaterial("akrDistrictGroundMaterial", scene);
        groundMaterial.alpha = 0.86;
        groundMaterial.diffuseColor = Color3.FromHexString(theme.ground_hex);
        groundMaterial.emissiveColor = Color3.FromHexString(theme.ground_glow_hex);
        ground.material = groundMaterial;

        const ring = CreateTorus(
          "akrDistrictRing",
          {
            diameter: theme.orbit_radius * 2.45,
            thickness: 0.08,
            tessellation: worldState.low_end_mode ? 44 : 72
          },
          scene
        );
        ring.rotation.x = Math.PI / 2;
        const ringMaterial = new StandardMaterial("akrDistrictRingMaterial", scene);
        ringMaterial.diffuseColor = Color3.FromHexString(theme.ground_glow_hex);
        ringMaterial.emissiveColor = Color3.FromHexString(theme.ring_hex);
        ring.material = ringMaterial;

        let outerRing: any = null;
        if (!worldState.low_end_mode) {
          outerRing = CreateTorus(
            "akrDistrictOuterRing",
            {
              diameter: theme.orbit_radius * 2.9,
              thickness: 0.05,
              tessellation: 48
            },
            scene
          );
          outerRing.rotation.x = Math.PI / 2.4;
          outerRing.rotation.z = districtTilt(theme.theme_key);
          const outerRingMaterial = new StandardMaterial("akrDistrictOuterRingMaterial", scene);
          outerRingMaterial.diffuseColor = Color3.FromHexString(theme.ring_secondary_hex);
          outerRingMaterial.emissiveColor = Color3.FromHexString(theme.ring_secondary_hex);
          outerRing.material = outerRingMaterial;
        }

        const coreColumn = CreateCylinder(
          "akrDistrictCoreColumn",
          { height: worldState.workspace === "admin" ? 1.45 : 1.2, diameter: 0.5, tessellation: worldState.low_end_mode ? 8 : 16 },
          scene
        );
        coreColumn.position.y = 0.52;
        const coreColumnMaterial = new StandardMaterial("akrDistrictCoreColumnMaterial", scene);
        coreColumnMaterial.diffuseColor = Color3.FromHexString(theme.ground_glow_hex);
        coreColumnMaterial.emissiveColor = Color3.FromHexString(theme.ring_secondary_hex);
        coreColumn.material = coreColumnMaterial;

        const coreOrb = CreateSphere(
          "akrDistrictCoreOrb",
          {
            diameter: worldState.workspace === "admin" ? 1.25 : 1.1,
            segments: worldState.low_end_mode ? 10 : 18
          },
          scene
        );
        coreOrb.position.y = 1.35;
        const coreOrbMaterial = new StandardMaterial("akrDistrictCoreOrbMaterial", scene);
        coreOrbMaterial.diffuseColor = Color3.FromHexString(theme.ground_glow_hex);
        coreOrbMaterial.emissiveColor = Color3.FromHexString(theme.core_hex);
        coreOrb.material = coreOrbMaterial;

        const satellites = Array.from({ length: theme.satellite_count }, (_, index) => {
          const angle = (Math.PI * 2 * index) / Math.max(1, theme.satellite_count);
          const orb = CreateSphere(
            `akrDistrictSatellite-${index}`,
            {
              diameter: worldState.low_end_mode ? 0.12 : 0.16,
              segments: worldState.low_end_mode ? 6 : 12
            },
            scene
          );
          orb.position = new Vector3(
            Math.cos(angle) * theme.satellite_radius,
            theme.satellite_height,
            Math.sin(angle) * theme.satellite_radius
          );
          const material = new StandardMaterial(`akrDistrictSatelliteMaterial-${index}`, scene);
          material.diffuseColor = Color3.FromHexString(theme.satellite_hex);
          material.emissiveColor = Color3.FromHexString(theme.satellite_hex);
          orb.material = material;
          return { orb, baseAngle: angle };
        });

        const actorHandles = worldState.actors.flatMap((actor) =>
          createDistrictActorHandles({
            actor,
            scene,
            theme,
            lowEndMode: worldState.low_end_mode,
            CreateBox,
            CreateCylinder,
            CreateSphere,
            CreateTorus,
            StandardMaterial,
            Color3,
            Vector3
          })
        );

        const clusterHandles = worldState.interaction_clusters.map((cluster, index) => {
          const primaryHotspot =
            hotspotMap.get(cluster.active_hotspot_key) ||
            hotspotMap.get(cluster.primary_hotspot_key) ||
            hotspotMap.get(cluster.hotspot_keys[0]) ||
            null;
          const typedPrimaryHotspot = (primaryHotspot || null) as Record<string, any> | null;
          const ring = CreateTorus(
            `akrDistrictClusterRing-${cluster.cluster_key}`,
            {
              diameter: cluster.orbit_radius * 2,
              thickness: cluster.is_active ? 0.07 : 0.04,
              tessellation: worldState.low_end_mode ? 24 : 38
            },
            scene
          );
          ring.rotation.x = Math.PI / 2;
          ring.position = new Vector3(cluster.x, cluster.y + 0.16, cluster.z);
          const ringMaterial = new StandardMaterial(`akrDistrictClusterRingMaterial-${cluster.cluster_key}`, scene);
          ringMaterial.diffuseColor = Color3.FromHexString(typedPrimaryHotspot?.accent_hex || theme.ring_hex);
          ringMaterial.emissiveColor = Color3.FromHexString(
            cluster.is_active ? theme.core_hex : typedPrimaryHotspot?.accent_hex || theme.ring_hex
          );
          ring.material = ringMaterial;

          const satellites = cluster.hotspot_keys
            .map((hotspotKey, hotspotIndex) => {
              const hotspot = hotspotMap.get(hotspotKey) as Record<string, any> | undefined;
              if (!hotspot) {
                return null;
              }
              const orb = CreateSphere(
                `akrDistrictClusterOrb-${cluster.cluster_key}-${hotspot.key}`,
                {
                  diameter: hotspot.is_secondary ? 0.12 : 0.16,
                  segments: worldState.low_end_mode ? 5 : 8
                },
                scene
              );
              const material = new StandardMaterial(`akrDistrictClusterOrbMaterial-${cluster.cluster_key}-${hotspot.key}`, scene);
              material.diffuseColor = Color3.FromHexString(hotspot.accent_hex);
              material.emissiveColor = Color3.FromHexString(hotspot.is_active ? theme.core_hex : hotspot.accent_hex);
              orb.material = material;
              return { orb, hotspot, hotspotIndex };
            })
            .filter(Boolean) as Array<{ orb: any; hotspot: Record<string, any>; hotspotIndex: number }>;

          return {
            cluster,
            ring,
            satellites,
            animate: (now: number, motionScalar: number) => {
              const focusClusterKey = hoveredClusterKey || worldState.active_cluster_key;
              const isFocused = focusClusterKey === cluster.cluster_key;
              ring.rotation.z = now * (0.18 + index * 0.03) * motionScalar * directorProfile.cluster_spin_scalar;
              const ringScale = isFocused ? 1.06 : cluster.is_active ? 1.03 : 1;
              ring.scaling.setAll(ringScale);
              satellites.forEach((entry) => {
                const angle =
                  (Math.PI * 2 * entry.hotspotIndex) / Math.max(1, satellites.length) +
                  now * (0.4 + entry.hotspotIndex * 0.06) * motionScalar * directorProfile.cluster_spin_scalar;
                const radius = cluster.orbit_radius * (entry.hotspot.is_secondary ? 0.84 : 1);
                entry.orb.position.x = cluster.x + Math.cos(angle) * radius;
                entry.orb.position.z = cluster.z + Math.sin(angle) * radius;
                entry.orb.position.y =
                  cluster.y +
                  0.18 +
                  Math.sin(now * (1 + entry.hotspotIndex * 0.12)) * 0.04 * motionScalar +
                  (isFocused ? 0.06 : 0);
                const scale =
                  1 +
                  Math.sin(now * (1.2 + entry.hotspotIndex * 0.14)) * 0.06 * motionScalar +
                  (entry.hotspot.is_active ? 0.14 : 0) +
                  (isFocused ? 0.08 : 0);
                entry.orb.scaling.setAll(scale);
              });
            }
          };
        });

        const hotspotHandles = worldState.hotspots.map((hotspot, index) => {
          const ring = CreateTorus(
            `akrDistrictHotspotRing-${hotspot.key}`,
            {
              diameter: hotspot.ring_radius * 2,
              thickness: hotspot.is_active ? 0.08 : hotspot.is_secondary ? 0.034 : 0.05,
              tessellation: worldState.low_end_mode ? 22 : 34
            },
            scene
          );
          ring.rotation.x = Math.PI / 2;
          ring.position = new Vector3(hotspot.x, hotspot.y, hotspot.z);
          const ringMaterial = new StandardMaterial(`akrDistrictHotspotRingMaterial-${hotspot.key}`, scene);
          ringMaterial.diffuseColor = Color3.FromHexString(hotspot.accent_hex);
          ringMaterial.emissiveColor = Color3.FromHexString(hotspot.is_active ? theme.core_hex : hotspot.accent_hex);
          ring.material = ringMaterial;

          const pad = CreateDisc(
            `akrDistrictHotspotPad-${hotspot.key}`,
            {
              radius: hotspot.radius,
              tessellation: worldState.low_end_mode ? 24 : 40
            },
            scene
          );
          pad.rotation.x = Math.PI / 2;
          pad.position = new Vector3(hotspot.x, hotspot.y + 0.02, hotspot.z);
          const padMaterial = new StandardMaterial(`akrDistrictHotspotPadMaterial-${hotspot.key}`, scene);
          padMaterial.alpha = hotspot.is_active ? 0.42 : hotspot.is_secondary ? 0.15 : 0.22;
          padMaterial.diffuseColor = Color3.FromHexString(hotspot.accent_hex);
          padMaterial.emissiveColor = Color3.FromHexString(hotspot.is_active ? theme.ring_secondary_hex : hotspot.accent_hex);
          pad.material = padMaterial;

          const beacon = CreateSphere(
            `akrDistrictHotspotBeacon-${hotspot.key}`,
            {
              diameter: hotspot.is_active ? 0.24 : hotspot.is_secondary ? 0.14 : 0.18,
              segments: worldState.low_end_mode ? 6 : 10
            },
            scene
          );
          beacon.position = new Vector3(hotspot.x, hotspot.y + 0.28, hotspot.z);
          const beaconMaterial = new StandardMaterial(`akrDistrictHotspotBeaconMaterial-${hotspot.key}`, scene);
          beaconMaterial.diffuseColor = Color3.FromHexString(theme.ground_glow_hex);
          beaconMaterial.emissiveColor = Color3.FromHexString(hotspot.is_active ? theme.core_hex : hotspot.accent_hex);
          beacon.material = beaconMaterial;

          const metadata = {
            actionKey: hotspot.action_key,
            nodeKey: hotspot.key,
            laneKey: hotspot.actor_key,
            label: hotspot.label,
            labelKey: hotspot.label_key,
            hintLabelKey: hotspot.hint_label_key,
            sourceType: hotspot.source_type,
            actorKey: hotspot.actor_key,
            interactionKind: hotspot.interaction_kind,
            clusterKey: hotspot.cluster_key,
            isSecondary: hotspot.is_secondary
          };
          [ring, pad, beacon].forEach((mesh) => {
            mesh.isPickable = Boolean(hotspot.action_key);
            mesh.metadata = metadata;
          });

          return {
            animate: (now: number, motionScalar: number) => {
              ring.rotation.z = now * (0.25 + index * 0.03) * motionScalar * directorProfile.cluster_spin_scalar;
              beacon.position.y = hotspot.y + 0.28 + Math.sin(now * (1.1 + index * 0.17)) * 0.06 * motionScalar;
              const isHovered = hoveredHotspotKey === hotspot.key;
              const pulse =
                1 +
                Math.sin(now * (1.3 + index * 0.14)) * (hotspot.is_secondary ? 0.05 : 0.08) * motionScalar +
                (hotspot.is_active ? 0.12 : 0) +
                (isHovered ? 0.08 : 0);
              beacon.scaling.setAll(pulse);
              pad.scaling.setAll(1 + Math.sin(now * (0.9 + index * 0.13)) * 0.04 * motionScalar + (isHovered ? 0.06 : 0));
            }
          };
        });

        const nodeHandles = worldState.nodes.map((node, index) => {
          const angle = (Math.PI * 2 * index) / Math.max(1, worldState.nodes.length);
          const radius = theme.orbit_radius;
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          const isActive = Boolean(node.is_active);

          const pillar = CreateCylinder(
            `akrDistrictNodePillar-${node.key}`,
            {
              height: 1 + node.energy * 1.7 + (isActive ? 0.3 : 0),
              diameter: isActive ? 0.3 : 0.24,
              tessellation: worldState.low_end_mode ? 8 : 14
            },
            scene
          );
          pillar.position = new Vector3(x, 0.48 + pillar.scaling.y * 0.12, z);

          const orb = CreateSphere(
            `akrDistrictNodeOrb-${node.key}`,
            { diameter: 0.38 + node.energy * 0.5 + (isActive ? 0.14 : 0), segments: worldState.low_end_mode ? 8 : 16 },
            scene
          );
          orb.position = new Vector3(x, 1.25 + node.energy * 0.8, z);

          const pillarMaterial = new StandardMaterial(`akrDistrictNodePillarMaterial-${node.key}`, scene);
          pillarMaterial.diffuseColor = Color3.FromHexString(isActive ? theme.ring_secondary_hex : theme.ground_hex);
          pillarMaterial.emissiveColor = Color3.FromHexString(isActive ? theme.core_hex : node.accent_hex);
          pillar.material = pillarMaterial;

          const orbMaterial = new StandardMaterial(`akrDistrictNodeOrbMaterial-${node.key}`, scene);
          orbMaterial.diffuseColor = Color3.FromHexString(isActive ? theme.core_hex : node.accent_hex);
          orbMaterial.emissiveColor = Color3.FromHexString(isActive ? theme.ring_hex : node.accent_hex);
          orb.material = orbMaterial;

          let halo: any = null;
          if (!worldState.low_end_mode) {
            halo = CreateTorus(
              `akrDistrictNodeHalo-${node.key}`,
              { diameter: 0.7 + node.energy * 0.46 + (isActive ? 0.12 : 0), thickness: isActive ? 0.06 : 0.04, tessellation: 24 },
              scene
            );
            halo.rotation.x = Math.PI / 2;
            halo.position = new Vector3(x, 0.12 + node.energy * 0.18, z);
            const haloMaterial = new StandardMaterial(`akrDistrictNodeHaloMaterial-${node.key}`, scene);
            haloMaterial.diffuseColor = Color3.FromHexString(isActive ? theme.ring_secondary_hex : node.accent_hex);
            haloMaterial.emissiveColor = Color3.FromHexString(isActive ? theme.ring_secondary_hex : node.accent_hex);
            halo.material = haloMaterial;
          }

          const interactiveMeshes = [pillar, orb, halo].filter(Boolean);
          const metadata = {
            actionKey: node.action_key,
            nodeKey: node.key,
            laneKey: node.laneKey,
            label: node.label,
            labelKey: node.label_key,
            hintLabelKey: "world_hotspot_hint_open",
            sourceType: "district_scene_node",
            actorKey: "",
            interactionKind: "open",
            clusterKey: node.key,
            isSecondary: false
          };
          interactiveMeshes.forEach((mesh) => {
            mesh.isPickable = Boolean(node.action_key);
            mesh.metadata = metadata;
          });

          return { node, pillar, orb, halo, angle, isActive };
        });

        scene.hoverCursor = "pointer";
        scene.onPointerMove = (_event, pickInfo) => {
          const metadata = pickInfo?.pickedMesh?.metadata || null;
          const actionKey = String(metadata?.actionKey || "").trim();
          canvas.style.cursor = actionKey ? "pointer" : "default";
          if (!actionKey) {
            hoveredHotspotKey = "";
            hoveredClusterKey = "";
            setHoveredClusterKeyState((prev) => (prev ? "" : prev));
            setHoverPreview((prev) => (prev ? null : prev));
            return;
          }
          const nextHotspotKey =
            String(metadata?.sourceType || "") === "district_scene_hotspot"
              ? String(metadata?.nodeKey || "")
              : String(
                  worldState.hotspots.find((hotspot) => hotspot.action_key === actionKey)?.key ||
                    metadata?.nodeKey ||
                    ""
                );
          hoveredHotspotKey = nextHotspotKey;
          hoveredClusterKey = String(metadata?.clusterKey || "");
          setHoveredClusterKeyState((prev) => {
            const nextClusterKey = String(metadata?.clusterKey || "");
            return prev === nextClusterKey ? prev : nextClusterKey;
          });
          setHoverPreview((prev) => {
            const next = {
              key: String(metadata?.nodeKey || ""),
              label: String(metadata?.label || ""),
              labelKey: String(metadata?.labelKey || ""),
              hintLabelKey: String(metadata?.hintLabelKey || "world_hotspot_hint_open"),
              interactionKind: String(metadata?.interactionKind || "open"),
              sourceType: String(metadata?.sourceType || "district_scene_node")
            };
            if (
              prev &&
              prev.key === next.key &&
              prev.labelKey === next.labelKey &&
              prev.hintLabelKey === next.hintLabelKey &&
              prev.sourceType === next.sourceType
            ) {
              return prev;
            }
            return next;
          });
        };
        scene.onPointerDown = (_event, pickInfo) => {
          const metadata = pickInfo?.pickedMesh?.metadata || null;
          const actionKey = String(metadata?.actionKey || "").trim();
          if (!actionKey) {
            return;
          }
          triggerSceneAction({
            actionKey,
            nodeKey: String(metadata?.nodeKey || ""),
            laneKey: String(metadata?.laneKey || ""),
            label: String(metadata?.label || ""),
            labelKey: String(metadata?.labelKey || ""),
            sourceType: String(metadata?.sourceType || "district_scene_node"),
            actorKey: String(metadata?.actorKey || ""),
            interactionKind: String(metadata?.interactionKind || "open"),
            clusterKey: String(metadata?.clusterKey || ""),
            isSecondary: Boolean(metadata?.isSecondary),
            workspace: props.workspace,
            tab: props.tab,
            districtKey: worldState.district_key
          });
        };

        const resize = () => engine.resize();
        window.addEventListener("resize", resize);

        engine.runRenderLoop(() => {
          const now = performance.now() * 0.001;
          const motionScalar = (worldState.reduced_motion ? 0.22 : 1) * directorProfile.motion_scalar;
          const focusHotspot =
            worldState.hotspots.find((hotspot) => hotspot.key === hoveredHotspotKey) || activeHotspot;
          ring.rotation.z = now * worldState.orbit_speed * 22 * directorProfile.orbit_spin_scalar;
          if (outerRing) {
            outerRing.rotation.y = now * worldState.orbit_speed * 14 * directorProfile.orbit_spin_scalar;
          }
          coreOrb.position.y = 1.2 + Math.sin(now * 1.4) * 0.12 * motionScalar * directorProfile.node_pulse_scalar;
          const orbScale =
            1 + worldState.ambient_energy * 0.16 + Math.sin(now * 1.7) * 0.04 * motionScalar * directorProfile.node_pulse_scalar;
          coreOrb.scaling.setAll(orbScale);
          point.intensity = 1.1 + worldState.ambient_energy * 0.6 + Math.sin(now) * 0.08 * motionScalar;
          const targetAlpha =
            cameraProfile.alpha_base +
            now * worldState.orbit_speed * cameraProfile.orbit_scalar +
            (focusHotspot?.camera_alpha_offset || 0);
          const targetBeta =
            cameraProfile.beta_base +
            Math.sin(now * 0.32) * 0.03 * cameraProfile.sway_scalar * motionScalar +
            (focusHotspot?.camera_beta_offset || 0);
          camera.alpha += (targetAlpha - camera.alpha) * cameraProfile.alpha_lerp;
          camera.beta += (targetBeta - camera.beta) * cameraProfile.beta_lerp;
          if (focusHotspot) {
            camera.target.x += (focusHotspot.x - camera.target.x) * cameraProfile.focus_lerp;
            camera.target.y += (focusHotspot.focus_y - camera.target.y) * cameraProfile.focus_lerp;
            camera.target.z += (focusHotspot.z - camera.target.z) * cameraProfile.focus_lerp;
            const desiredRadius = cameraProfile.radius * focusHotspot.camera_radius_scale;
            camera.radius += (desiredRadius - camera.radius) * cameraProfile.radius_lerp;
          }
          satellites.forEach((entry, index) => {
            const radiusPulse = theme.satellite_radius + Math.sin(now * (0.8 + index * 0.07)) * 0.06 * motionScalar;
            entry.orb.position.x =
              Math.cos(entry.baseAngle + now * worldState.orbit_speed * 10 * directorProfile.orbit_spin_scalar) * radiusPulse;
            entry.orb.position.z =
              Math.sin(entry.baseAngle + now * worldState.orbit_speed * 10 * directorProfile.orbit_spin_scalar) * radiusPulse;
            entry.orb.position.y = theme.satellite_height + Math.sin(now * (1 + index * 0.09)) * 0.06 * motionScalar;
          });
          actorHandles.forEach((entry, index) => {
            entry.animate?.(now, motionScalar, index);
          });
          clusterHandles.forEach((entry) => {
            entry.animate(now, motionScalar);
          });
          hotspotHandles.forEach((entry) => {
            entry.animate(now, motionScalar);
          });
          nodeHandles.forEach((entry, index) => {
            const activePulse = entry.isActive ? 0.16 : 0.04;
            entry.orb.position.y =
              1.15 +
              entry.node.energy * 0.95 +
              Math.sin(now * (1.2 + index * 0.17)) * (0.18 + activePulse) * motionScalar * directorProfile.node_pulse_scalar;
            entry.pillar.scaling.y =
              1 + entry.node.energy * 0.65 + Math.sin(now * (0.8 + index * 0.11)) * 0.04 * motionScalar * directorProfile.node_pulse_scalar;
            entry.orb.scaling.setAll(
              1 +
                Math.sin(now * (1.4 + index * 0.12)) * activePulse * motionScalar * directorProfile.node_pulse_scalar +
                (entry.isActive ? 0.12 : 0)
            );
            if (entry.halo) {
              entry.halo.rotation.z =
                now * (0.42 + index * 0.06 + (entry.isActive ? 0.18 : 0)) * motionScalar * directorProfile.cluster_spin_scalar;
            }
          });
          scene.render();
        });

        handle = {
          dispose: () => {
            window.removeEventListener("resize", resize);
            canvas.style.cursor = "default";
            scene.onPointerMove = null;
            scene.onPointerDown = null;
            scene.dispose();
            engine.dispose();
          }
        };
        setStatus("ready");
      } catch {
        if (!disposed) {
          setStatus("failed");
        }
      }
    };

    setStatus("idle");
    void buildScene();

    return () => {
      disposed = true;
      handle?.dispose();
    };
  }, [props.tab, props.workspace, triggerSceneAction, worldSignature, worldState]);

  return (
    <div className="akrSceneWorldLayer" data-status={status} data-district={worldState.district_key}>
      <canvas
        ref={canvasRef}
        className="akrSceneWorldCanvas"
        aria-label={`${t(props.lang, "world_scene_title")} ${t(props.lang, worldState.district_label_key as never)}`}
      />
      <div className="akrSceneWorldHud akrGlass">
        <strong>{t(props.lang, worldState.district_label_key as never)}</strong>
        <span>{t(props.lang, worldState.mode_label_key as never)}</span>
        {worldState.hud_profile.show_density_chip ? (
          <span>{t(props.lang, worldState.hud_profile.density_label_key as never)}</span>
        ) : null}
        <span>{t(props.lang, worldState.director_profile.pace_label_key as never)}</span>
        <span>{t(props.lang, worldState.hud_profile.tone_label_key as never)}</span>
        <span>{props.workspace === "admin" ? "OPS" : props.tab.toUpperCase()}</span>
        <span>
          {worldState.beacon_count} / {worldState.hot_nodes + worldState.warn_nodes}
        </span>
        {worldState.hud_profile.show_caption ? (
          <span>{t(props.lang, worldState.hud_profile.caption_label_key as never)}</span>
        ) : null}
        {worldState.active_hotspot_label ? (
          <span className="akrSceneWorldFocus">
            {hoverPreview?.labelKey
              ? t(props.lang, hoverPreview.labelKey as never)
              : hoverPreview?.label || (worldState.active_hotspot_label_key
                  ? t(props.lang, worldState.active_hotspot_label_key as never)
                  : worldState.active_hotspot_label)}
          </span>
        ) : null}
        {worldState.active_hotspot_hint_key || hoverPreview?.hintLabelKey ? (
          <span className="akrSceneWorldFocus">
            {t(props.lang, (hoverPreview?.hintLabelKey || worldState.active_hotspot_hint_key) as never)}
          </span>
        ) : null}
        {worldState.hud_profile.show_node_label && worldState.active_node_label ? (
          <span className="akrSceneWorldFocus">
            {worldState.active_node_label_key ? t(props.lang, worldState.active_node_label_key as never) : worldState.active_node_label}
          </span>
        ) : null}
      </div>
      {focusedClusterActions.length ? (
        <div className="akrSceneWorldRail akrGlass">
          <div className="akrSceneWorldRailHeader">
            <strong>
              {focusedCluster?.label_key ? t(props.lang, focusedCluster.label_key as never) : focusedCluster?.label || ""}
            </strong>
            <span>
              {focusedCluster?.hotspot_count} {t(props.lang, "world_interaction_routes" as never)}
            </span>
          </div>
          <div className="akrSceneWorldRailActions">
            {focusedClusterActions.map((action) => (
              <button
                key={action.key}
                type="button"
                className={`akrSceneWorldAction ${action.is_secondary ? "isSecondary" : "isPrimary"}`}
                onClick={() =>
                  triggerSceneAction({
                    actionKey: action.action_key,
                    nodeKey: action.key,
                    laneKey: focusedCluster?.cluster_key || "",
                    label: action.label,
                    labelKey: action.label_key,
                    sourceType: "district_scene_cluster_action",
                    actorKey: action.actor_key,
                    interactionKind: action.interaction_kind,
                    clusterKey: action.cluster_key,
                    isSecondary: action.is_secondary,
                    workspace: props.workspace,
                    tab: props.tab,
                    districtKey: worldState.district_key
                  })
                }
              >
                <span className="akrSceneWorldActionMeta">
                  {t(props.lang, (action.is_secondary ? "world_interaction_secondary" : "world_interaction_primary") as never)}
                </span>
                <strong>{action.label_key ? t(props.lang, action.label_key as never) : action.label}</strong>
                <span>{t(props.lang, action.hint_label_key as never)}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function districtTilt(themeKey: string) {
  switch (themeKey) {
    case "arena_prime":
      return Math.PI / 4.4;
    case "mission_quarter":
      return Math.PI / 6;
    case "exchange_district":
      return Math.PI / 3.6;
    case "ops_citadel":
      return Math.PI / 5.2;
    default:
      return Math.PI / 7;
  }
}

type DistrictActorHandle = {
  animate?: (now: number, motionScalar: number, index: number) => void;
};

function createStandardActorMaterial({
  scene,
  StandardMaterial,
  Color3,
  diffuseHex,
  emissiveHex
}: {
  scene: any;
  StandardMaterial: any;
  Color3: any;
  diffuseHex: string;
  emissiveHex: string;
}) {
  const material = new StandardMaterial(`akrDistrictActorMaterial-${diffuseHex}-${emissiveHex}`, scene);
  material.diffuseColor = Color3.FromHexString(diffuseHex);
  material.emissiveColor = Color3.FromHexString(emissiveHex);
  return material;
}

function createDistrictActorHandles({
  actor,
  scene,
  theme,
  lowEndMode,
  CreateBox,
  CreateCylinder,
  CreateSphere,
  CreateTorus,
  StandardMaterial,
  Color3,
  Vector3
}: {
  actor: any;
  scene: any;
  theme: Record<string, unknown>;
  lowEndMode: boolean;
  CreateBox: any;
  CreateCylinder: any;
  CreateSphere: any;
  CreateTorus: any;
  StandardMaterial: any;
  Color3: any;
  Vector3: any;
}): DistrictActorHandle[] {
  const baseMaterial = createStandardActorMaterial({
    scene,
    StandardMaterial,
    Color3,
    diffuseHex: String(actor.accent_hex || theme.ground_glow_hex || "#103254"),
    emissiveHex: String(actor.glow_hex || actor.accent_hex || theme.ring_hex || "#52bfff")
  });

  const capMaterial = createStandardActorMaterial({
    scene,
    StandardMaterial,
    Color3,
    diffuseHex: String(theme.ground_glow_hex || actor.accent_hex || "#103254"),
    emissiveHex: String(theme.core_hex || actor.glow_hex || "#d6f6ff")
  });

  const handles: DistrictActorHandle[] = [];
  const x = Number(actor.x || 0);
  const y = Number(actor.y || 0);
  const z = Number(actor.z || 0);
  const width = Number(actor.width || 0.4);
  const height = Number(actor.height || 1);
  const depth = Number(actor.depth || width);
  const energy = Number(actor.energy || 0.3);
  const rotationY = Number(actor.rotation_y || 0);

  if (actor.kind === "gate") {
    const left = CreateBox(`${actor.key}-left`, { width: 0.22, height, depth }, scene);
    const right = CreateBox(`${actor.key}-right`, { width: 0.22, height, depth }, scene);
    const lintel = CreateBox(`${actor.key}-lintel`, { width, height: 0.18, depth }, scene);
    left.position = new Vector3(x - width / 2.4, y, z);
    right.position = new Vector3(x + width / 2.4, y, z);
    lintel.position = new Vector3(x, y + height / 2.1, z);
    [left, right, lintel].forEach((mesh) => {
      mesh.rotation.y = rotationY;
      mesh.material = baseMaterial;
    });
    handles.push({
      animate: (now, motionScalar) => {
        lintel.position.y = y + height / 2.1 + Math.sin(now * 1.1) * 0.04 * motionScalar;
      }
    });
  } else if (actor.kind === "arch") {
    const arch = CreateTorus(
      `${actor.key}-arch`,
      { diameter: width, thickness: Math.max(depth, 0.1), tessellation: lowEndMode ? 26 : 42 },
      scene
    );
    arch.position = new Vector3(x, y, z);
    arch.rotation.y = rotationY;
    arch.material = baseMaterial;
    handles.push({
      animate: (now, motionScalar, index) => {
        arch.rotation.z = now * (0.18 + index * 0.02) * motionScalar;
      }
    });
  } else if (actor.kind === "rail") {
    const rail = CreateBox(`${actor.key}-rail`, { width, height: Math.max(height, 0.12), depth }, scene);
    rail.position = new Vector3(x, y, z);
    rail.rotation.y = rotationY;
    rail.material = baseMaterial;
    handles.push({
      animate: (now, motionScalar) => {
        rail.scaling.x = 1 + Math.sin(now * 0.9) * 0.03 * motionScalar;
      }
    });
  } else if (actor.kind === "array") {
    const spine = CreateBox(`${actor.key}-spine`, { width, height: Math.max(height * 0.18, 0.12), depth }, scene);
    spine.position = new Vector3(x, y, z);
    spine.material = baseMaterial;
    const sensors = [-1, 0, 1].map((offset, index) => {
      const orb = CreateSphere(
        `${actor.key}-sensor-${index}`,
        { diameter: lowEndMode ? 0.18 : 0.24, segments: lowEndMode ? 6 : 10 },
        scene
      );
      orb.position = new Vector3(x + offset * (width / 3.2), y + 0.42, z);
      orb.material = capMaterial;
      return orb;
    });
    handles.push({
      animate: (now, motionScalar) => {
        sensors.forEach((orb: any, index: number) => {
          orb.position.y = y + 0.42 + Math.sin(now * (1 + index * 0.18)) * 0.05 * motionScalar;
        });
      }
    });
  } else {
    const shaft =
      actor.kind === "terminal" || actor.kind === "vault"
        ? CreateBox(`${actor.key}-shaft`, { width, height, depth }, scene)
        : CreateCylinder(
            `${actor.key}-shaft`,
            { height, diameter: Math.max(width, depth), tessellation: lowEndMode ? 8 : 14 },
            scene
          );
    shaft.position = new Vector3(x, y, z);
    shaft.rotation.y = rotationY;
    shaft.material = baseMaterial;

    const cap = CreateSphere(
      `${actor.key}-cap`,
      { diameter: actor.kind === "watchtower" ? 0.34 : 0.28, segments: lowEndMode ? 6 : 12 },
      scene
    );
    cap.position = new Vector3(x, y + height / 2 + 0.28, z);
    cap.material = capMaterial;

    if (actor.kind === "blade_tower") {
      const blade = CreateTorus(
        `${actor.key}-blade`,
        { diameter: Math.max(width * 2.6, 0.9), thickness: 0.06, tessellation: lowEndMode ? 20 : 32 },
        scene
      );
      blade.position = new Vector3(x, y + height / 2, z);
      blade.rotation.x = Math.PI / 2;
      blade.material = capMaterial;
      handles.push({
        animate: (now, motionScalar, index) => {
          blade.rotation.z = now * (0.55 + index * 0.03) * motionScalar;
          cap.position.y = y + height / 2 + 0.28 + Math.sin(now * 1.3) * 0.04 * motionScalar;
        }
      });
    } else {
      handles.push({
        animate: (now, motionScalar, index) => {
          cap.position.y = y + height / 2 + 0.28 + Math.sin(now * (1 + index * 0.11)) * (0.04 + energy * 0.03) * motionScalar;
          if (actor.kind === "spine" || actor.kind === "watchtower") {
            shaft.scaling.y = 1 + Math.sin(now * (0.72 + index * 0.09)) * 0.03 * motionScalar;
          }
        }
      });
    }
  }

  return handles;
}
