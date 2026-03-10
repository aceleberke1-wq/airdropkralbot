import { useEffect, useMemo, useRef, useState } from "react";
import { buildDistrictWorldState } from "../../../core/runtime/districtWorldState.js";
import { t, type Lang } from "../../i18n";

type BabylonDistrictSceneHostProps = {
  lang: Lang;
  workspace: "player" | "admin";
  tab: "home" | "pvp" | "tasks" | "vault";
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
    import("@babylonjs/core/Meshes/Builders/torusBuilder"),
    import("@babylonjs/core/Meshes/Builders/cylinderBuilder"),
    import("@babylonjs/core/Meshes/Builders/sphereBuilder"),
    import("@babylonjs/core/Materials/standardMaterial")
  ]);
  return {
    ArcRotateCamera,
    Color3,
    Color4,
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
        ambient_energy: worldState.ambient_energy,
        nodes: worldState.nodes.map((node) => ({
          key: node.key,
          action_key: node.action_key,
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
        point.diffuse = Color3.FromHexString("#5ad7ff");

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
        groundMaterial.diffuseColor = Color3.FromHexString(worldState.workspace === "admin" ? "#11294c" : "#0e2a44");
        groundMaterial.emissiveColor = Color3.FromHexString(worldState.workspace === "admin" ? "#153f63" : "#103254");
        ground.material = groundMaterial;

        const ring = CreateTorus(
          "akrDistrictRing",
          {
            diameter: worldState.workspace === "admin" ? 9.2 : 8.4,
            thickness: 0.08,
            tessellation: worldState.low_end_mode ? 44 : 72
          },
          scene
        );
        ring.rotation.x = Math.PI / 2;
        const ringMaterial = new StandardMaterial("akrDistrictRingMaterial", scene);
        ringMaterial.diffuseColor = Color3.FromHexString("#0f2440");
        ringMaterial.emissiveColor = Color3.FromHexString(worldState.workspace === "admin" ? "#2fffb5" : "#00d6ff");
        ring.material = ringMaterial;

        const coreColumn = CreateCylinder(
          "akrDistrictCoreColumn",
          { height: 1.2, diameter: 0.5, tessellation: worldState.low_end_mode ? 8 : 16 },
          scene
        );
        coreColumn.position.y = 0.52;
        const coreColumnMaterial = new StandardMaterial("akrDistrictCoreColumnMaterial", scene);
        coreColumnMaterial.diffuseColor = Color3.FromHexString("#16304f");
        coreColumnMaterial.emissiveColor = Color3.FromHexString("#1e4166");
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
        coreOrbMaterial.diffuseColor = Color3.FromHexString("#1b3858");
        coreOrbMaterial.emissiveColor = Color3.FromHexString(worldState.workspace === "admin" ? "#45ffca" : "#7be6ff");
        coreOrb.material = coreOrbMaterial;

        const nodeHandles = worldState.nodes.map((node, index) => {
          const angle = (Math.PI * 2 * index) / Math.max(1, worldState.nodes.length);
          const radius = worldState.workspace === "admin" ? 3.6 : 3.25;
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;

          const pillar = CreateCylinder(
            `akrDistrictNodePillar-${node.key}`,
            { height: 1 + node.energy * 1.7, diameter: 0.24, tessellation: worldState.low_end_mode ? 8 : 14 },
            scene
          );
          pillar.position = new Vector3(x, 0.48 + pillar.scaling.y * 0.12, z);

          const orb = CreateSphere(
            `akrDistrictNodeOrb-${node.key}`,
            { diameter: 0.38 + node.energy * 0.5, segments: worldState.low_end_mode ? 8 : 16 },
            scene
          );
          orb.position = new Vector3(x, 1.25 + node.energy * 0.8, z);

          const pillarMaterial = new StandardMaterial(`akrDistrictNodePillarMaterial-${node.key}`, scene);
          pillarMaterial.diffuseColor = Color3.FromHexString("#122946");
          pillarMaterial.emissiveColor = Color3.FromHexString(node.accent_hex);
          pillar.material = pillarMaterial;

          const orbMaterial = new StandardMaterial(`akrDistrictNodeOrbMaterial-${node.key}`, scene);
          orbMaterial.diffuseColor = Color3.FromHexString(node.accent_hex);
          orbMaterial.emissiveColor = Color3.FromHexString(node.accent_hex);
          orb.material = orbMaterial;

          let halo: any = null;
          if (!worldState.low_end_mode) {
            halo = CreateTorus(
              `akrDistrictNodeHalo-${node.key}`,
              { diameter: 0.7 + node.energy * 0.46, thickness: 0.04, tessellation: 24 },
              scene
            );
            halo.rotation.x = Math.PI / 2;
            halo.position = new Vector3(x, 0.12 + node.energy * 0.18, z);
            const haloMaterial = new StandardMaterial(`akrDistrictNodeHaloMaterial-${node.key}`, scene);
            haloMaterial.diffuseColor = Color3.FromHexString(node.accent_hex);
            haloMaterial.emissiveColor = Color3.FromHexString(node.accent_hex);
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

          return { node, pillar, orb, halo, angle };
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
          coreOrb.position.y = 1.2 + Math.sin(now * 1.4) * 0.12 * motionScalar;
          const orbScale = 1 + worldState.ambient_energy * 0.16 + Math.sin(now * 1.7) * 0.04 * motionScalar;
          coreOrb.scaling.setAll(orbScale);
          point.intensity = 1.1 + worldState.ambient_energy * 0.6 + Math.sin(now) * 0.08 * motionScalar;
          camera.alpha = -Math.PI / 2.1 + now * worldState.orbit_speed * 18;
          nodeHandles.forEach((entry, index) => {
            entry.orb.position.y = 1.15 + entry.node.energy * 0.95 + Math.sin(now * (1.2 + index * 0.17)) * 0.18 * motionScalar;
            entry.pillar.scaling.y = 1 + entry.node.energy * 0.65 + Math.sin(now * (0.8 + index * 0.11)) * 0.04 * motionScalar;
            if (entry.halo) {
              entry.halo.rotation.z = now * (0.42 + index * 0.06) * motionScalar;
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
      </div>
    </div>
  );
}
