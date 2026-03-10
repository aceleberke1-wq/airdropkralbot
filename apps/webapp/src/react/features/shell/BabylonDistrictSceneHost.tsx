import { useEffect, useMemo, useRef, useState } from "react";
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
    workspace: "player" | "admin";
    tab: "home" | "pvp" | "tasks" | "vault";
    districtKey: string;
  }) => void;
};

type BabylonSceneHandle = {
  dispose: () => void;
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
        low_end_mode: worldState.low_end_mode,
        reduced_motion: worldState.reduced_motion,
        district_theme_key: worldState.district_theme_key,
        active_node_key: worldState.active_node_key,
        ambient_energy: worldState.ambient_energy,
        actors: worldState.actors.map((actor) => ({
          key: actor.key,
          kind: actor.kind,
          energy: actor.energy
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

  useEffect(() => {
    let disposed = false;
    let handle: BabylonSceneHandle | null = null;

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

        const camera = new ArcRotateCamera(
          "akrDistrictCamera",
          -Math.PI / 2.1,
          Math.PI / 3.1,
          worldState.camera_radius,
          new Vector3(0, 0.8, 0),
          scene
        );
        camera.lowerRadiusLimit = worldState.camera_radius - 1.1;
        camera.upperRadiusLimit = worldState.camera_radius + 1.1;
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
            label: node.label
          };
          interactiveMeshes.forEach((mesh) => {
            mesh.isPickable = Boolean(node.action_key);
            mesh.metadata = metadata;
          });

          return { node, pillar, orb, halo, angle, isActive };
        });

        scene.hoverCursor = "pointer";
        scene.onPointerMove = (_event, pickInfo) => {
          const actionKey = String(pickInfo?.pickedMesh?.metadata?.actionKey || "").trim();
          canvas.style.cursor = actionKey ? "pointer" : "default";
        };
        scene.onPointerDown = (_event, pickInfo) => {
          const metadata = pickInfo?.pickedMesh?.metadata || null;
          const actionKey = String(metadata?.actionKey || "").trim();
          if (!actionKey) {
            return;
          }
          props.onNodeAction?.({
            actionKey,
            nodeKey: String(metadata?.nodeKey || ""),
            laneKey: String(metadata?.laneKey || ""),
            label: String(metadata?.label || ""),
            workspace: props.workspace,
            tab: props.tab,
            districtKey: worldState.district_key
          });
        };

        const resize = () => engine.resize();
        window.addEventListener("resize", resize);

        engine.runRenderLoop(() => {
          const now = performance.now() * 0.001;
          const motionScalar = worldState.reduced_motion ? 0.22 : 1;
          ring.rotation.z = now * worldState.orbit_speed * 22;
          if (outerRing) {
            outerRing.rotation.y = now * worldState.orbit_speed * 14;
          }
          coreOrb.position.y = 1.2 + Math.sin(now * 1.4) * 0.12 * motionScalar;
          const orbScale = 1 + worldState.ambient_energy * 0.16 + Math.sin(now * 1.7) * 0.04 * motionScalar;
          coreOrb.scaling.setAll(orbScale);
          point.intensity = 1.1 + worldState.ambient_energy * 0.6 + Math.sin(now) * 0.08 * motionScalar;
          camera.alpha = -Math.PI / 2.1 + now * worldState.orbit_speed * 18;
          satellites.forEach((entry, index) => {
            const radiusPulse = theme.satellite_radius + Math.sin(now * (0.8 + index * 0.07)) * 0.06 * motionScalar;
            entry.orb.position.x = Math.cos(entry.baseAngle + now * worldState.orbit_speed * 10) * radiusPulse;
            entry.orb.position.z = Math.sin(entry.baseAngle + now * worldState.orbit_speed * 10) * radiusPulse;
            entry.orb.position.y = theme.satellite_height + Math.sin(now * (1 + index * 0.09)) * 0.06 * motionScalar;
          });
          actorHandles.forEach((entry, index) => {
            entry.animate?.(now, motionScalar, index);
          });
          nodeHandles.forEach((entry, index) => {
            const activePulse = entry.isActive ? 0.16 : 0.04;
            entry.orb.position.y =
              1.15 + entry.node.energy * 0.95 + Math.sin(now * (1.2 + index * 0.17)) * (0.18 + activePulse) * motionScalar;
            entry.pillar.scaling.y = 1 + entry.node.energy * 0.65 + Math.sin(now * (0.8 + index * 0.11)) * 0.04 * motionScalar;
            entry.orb.scaling.setAll(1 + Math.sin(now * (1.4 + index * 0.12)) * activePulse * motionScalar + (entry.isActive ? 0.12 : 0));
            if (entry.halo) {
              entry.halo.rotation.z = now * (0.42 + index * 0.06 + (entry.isActive ? 0.18 : 0)) * motionScalar;
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
  }, [worldSignature, worldState]);

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
        <span>{props.workspace === "admin" ? "OPS" : props.tab.toUpperCase()}</span>
        <span>
          {worldState.beacon_count} / {worldState.hot_nodes + worldState.warn_nodes}
        </span>
        {worldState.active_node_label ? (
          <span className="akrSceneWorldFocus">
            {worldState.active_node_label_key ? t(props.lang, worldState.active_node_label_key as never) : worldState.active_node_label}
          </span>
        ) : null}
      </div>
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
