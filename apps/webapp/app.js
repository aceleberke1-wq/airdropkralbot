(() => {
  const qs = new URLSearchParams(window.location.search);
  const state = {
    auth: {
      uid: qs.get("uid") || "",
      ts: qs.get("ts") || "",
      sig: qs.get("sig") || ""
    },
    bot: qs.get("bot") || "airdropkral_2026_bot",
    data: null,
    admin: {
      isAdmin: false,
      summary: null,
      runtime: null,
      assets: null
    },
    suggestion: null,
    arena: null,
    sim: {
      active: false,
      timer: null,
      pulseTimer: null,
      expected: "",
      awaiting: false,
      score: 0,
      combo: 0,
      hits: 0,
      misses: 0,
      secondsLeft: 0
    },
    v3: {
      appState: "idle",
      session: null,
      queue: [],
      draining: false,
      raidSession: null,
      raidQueue: [],
      raidDraining: false,
      raidAuthAvailable: null,
      arenaAuthAvailable: null,
      pvpSession: null,
      pvpQueue: [],
      pvpDraining: false,
      pvpAuthAvailable: null,
      pvpTransport: "poll",
      pvpTickMs: 1000,
      pvpActionWindowMs: 800,
      pvpTickMeta: null,
      pvpLiveTimer: null,
      pvpLiveErrors: 0,
      pvpLeaderboard: [],
      pvpTimelineSessionRef: "",
      pvpTimeline: [],
      pvpReplay: [],
      lastRoundAlertKey: "",
      lastRoundAlertAt: 0,
      lastPvpObjectiveKey: "",
      lastPvpCineKey: "",
      lastPvpCinePulseAt: 0,
      combatChain: [],
      combatEnergy: 0,
      pulseTone: "info",
      pulseLabel: "NEXUS READY",
      pulseAt: 0,
      tokenQuote: null,
      quoteTimer: null,
      featureFlags: {}
    },
    telemetry: {
      deviceHash: "",
      perfTier: "normal",
      fpsAvg: 0,
      frameTimeMs: 0,
      latencyAvgMs: 0,
      droppedFrames: 0,
      gpuTimeMs: 0,
      cpuTimeMs: 0,
      fpsHistory: [],
      latencyHistory: [],
      heatHistory: [],
      threatHistory: [],
      combatHeat: 0,
      threatRatio: 0,
      raidBossPressure: 0,
      raidBossTone: "stable",
      sceneMood: "balanced",
      scenePostFxLevel: 0.9,
      sceneHudDensity: "full",
      manifestRevision: "local",
      manifestProvider: "fallback",
      perfTimer: null,
      sceneTimer: null,
      lastPerfPostAt: 0,
      lastScenePostAt: 0
    },
    intro: {
      seenKey: "airdropkral_intro_seen_v2",
      visible: false
    },
    ui: {
      qualityMode: "auto",
      autoQualityMode: "normal",
      cameraMode: "broadcast",
      sceneMode: "pro",
      hudDensity: "full",
      reducedMotion: false,
      largeText: false,
      storageKeys: {
        quality: "airdropkral_ui_quality_v1",
        cameraMode: "airdropkral_ui_camera_mode_v1",
        sceneMode: "airdropkral_ui_scene_mode_v1",
        hudDensity: "airdropkral_ui_hud_density_v1",
        reducedMotion: "airdropkral_ui_reduced_motion_v1",
        largeText: "airdropkral_ui_large_text_v1"
      },
      pulseTimer: null,
      lastTimelinePulseAt: 0,
      overlayTimer: null,
      combatHudRenderAt: 0,
      combatHitTimer: null
    },
    audio: {
      enabled: true,
      ready: false,
      cues: {}
    }
  };

  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  if (tg) {
    tg.expand();
    tg.ready();
    tg.setHeaderColor("#0d1635");
    tg.setBackgroundColor("#0b112a");
  }

  const QUALITY_PROFILES = Object.freeze({
    low: {
      key: "low",
      pixelRatioCap: 1.05,
      starCount: 900,
      starSize: 0.02,
      enableShards: false,
      pointerLerp: 0.011,
      cameraDrift: 0.45
    },
    normal: {
      key: "normal",
      pixelRatioCap: 1.6,
      starCount: 1800,
      starSize: 0.028,
      enableShards: true,
      pointerLerp: 0.018,
      cameraDrift: 0.8
    },
    high: {
      key: "high",
      pixelRatioCap: 2,
      starCount: 2800,
      starSize: 0.034,
      enableShards: true,
      pointerLerp: 0.024,
      cameraDrift: 1.05
    }
  });

  const SCENE_MODE_VALUES = Object.freeze(["pro", "lite", "cinematic", "minimal"]);
  const HUD_DENSITY_VALUES = Object.freeze(["compact", "full", "extended"]);
  const CAMERA_MODE_VALUES = Object.freeze(["broadcast", "tactical", "chase"]);
  const PVP_TIMELINE_LIMIT = 32;
  const PVP_REPLAY_LIMIT = 14;
  const COMBAT_CHAIN_LIMIT = 10;
  const METER_PALETTES = Object.freeze({
    neutral: {
      start: "#3df8c2",
      end: "#ffb85c",
      glow: "rgba(61, 248, 194, 0.42)"
    },
    safe: {
      start: "#70ffa0",
      end: "#3df8c2",
      glow: "rgba(112, 255, 160, 0.38)"
    },
    balanced: {
      start: "#7fd6ff",
      end: "#3df8c2",
      glow: "rgba(127, 214, 255, 0.4)"
    },
    aggressive: {
      start: "#ff5d7d",
      end: "#ffb85c",
      glow: "rgba(255, 93, 125, 0.44)"
    },
    critical: {
      start: "#ff416d",
      end: "#ffc266",
      glow: "rgba(255, 93, 125, 0.56)"
    }
  });

  function byId(id) {
    return document.getElementById(id);
  }

  function setAssetModeLine(text) {
    const el = byId("assetModeLine");
    const liteBadge = byId("liteSceneBadge");
    if (!el) {
      return;
    }
    const value = String(text || "Assets: -");
    el.textContent = value;
    if (liteBadge) {
      const isLite = value.toUpperCase().includes("LITE") || value.toLowerCase().includes("fallback");
      liteBadge.classList.toggle("hidden", !isLite);
    }
  }

  function getPerfBridge() {
    const bridge = window.__AKR_V32_PERF__;
    if (!bridge || typeof bridge !== "object") {
      return null;
    }
    return bridge;
  }

  function getTelemetryDeckBridge() {
    const bridge = window.__AKR_TELEMETRY_DECK__;
    if (!bridge || typeof bridge !== "object") {
      return null;
    }
    if (typeof bridge.render !== "function") {
      return null;
    }
    return bridge;
  }

  function getPvpRadarBridge() {
    const bridge = window.__AKR_PVP_RADAR__;
    if (!bridge || typeof bridge !== "object") {
      return null;
    }
    if (typeof bridge.draw !== "function") {
      return null;
    }
    return bridge;
  }

  function getCombatHudBridge() {
    const bridge = window.__AKR_COMBAT_HUD__;
    if (!bridge || typeof bridge !== "object") {
      return null;
    }
    if (typeof bridge.render !== "function") {
      return null;
    }
    return bridge;
  }

  function initPerfBridge() {
    const bridge = getPerfBridge();
    if (!bridge) {
      state.telemetry.deviceHash = "legacy";
      state.telemetry.perfTier = "normal";
      return;
    }
    state.telemetry.deviceHash = String(bridge.deviceHash || "legacy");
    state.telemetry.perfTier = String(bridge.perfTier || "normal");
  }

  function initAudioBank() {
    const HowlCtor = window.Howl;
    if (typeof HowlCtor !== "function") {
      state.audio.ready = false;
      return;
    }
    const base = {
      html5: false,
      volume: 0.24
    };
    try {
      state.audio.cues = {
        safe: new HowlCtor({ ...base, src: ["https://cdn.jsdelivr.net/gh/jshawl/AudioFX@master/sounds/sfx/confirm.mp3"] }),
        balanced: new HowlCtor({ ...base, src: ["https://cdn.jsdelivr.net/gh/jshawl/AudioFX@master/sounds/sfx/select.mp3"] }),
        aggressive: new HowlCtor({ ...base, src: ["https://cdn.jsdelivr.net/gh/jshawl/AudioFX@master/sounds/sfx/error.mp3"] }),
        reveal: new HowlCtor({ ...base, src: ["https://cdn.jsdelivr.net/gh/jshawl/AudioFX@master/sounds/sfx/powerup.mp3"] }),
        info: new HowlCtor({ ...base, src: ["https://cdn.jsdelivr.net/gh/jshawl/AudioFX@master/sounds/sfx/tick.mp3"] })
      };
      state.audio.ready = true;
    } catch (_) {
      state.audio.ready = false;
      state.audio.cues = {};
    }
  }

  function playAudioCue(tone = "info") {
    if (!state.audio.enabled || !state.audio.ready || state.ui.reducedMotion) {
      return;
    }
    const cue = state.audio.cues[tone] || state.audio.cues.info;
    if (!cue || typeof cue.play !== "function") {
      return;
    }
    try {
      cue.play();
    } catch (_) {}
  }

  function asNum(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getGsap() {
    if (window.gsap && typeof window.gsap.to === "function") {
      return window.gsap;
    }
    return null;
  }

  function animateMeterWidth(element, pct, duration = 0.42) {
    if (!element) {
      return;
    }
    const value = clamp(asNum(pct), 0, 100);
    const gsap = getGsap();
    if (!gsap || state.ui.reducedMotion) {
      element.style.width = `${value}%`;
      return;
    }
    gsap.killTweensOf(element);
    gsap.to(element, {
      width: `${value}%`,
      duration,
      ease: "power2.out"
    });
  }

  function animateTextSwap(element, text) {
    if (!element) {
      return;
    }
    const next = String(text || "");
    if (element.textContent === next) {
      return;
    }
    const gsap = getGsap();
    if (!gsap || state.ui.reducedMotion) {
      element.textContent = next;
      return;
    }
    gsap.killTweensOf(element);
    gsap.to(element, {
      opacity: 0.24,
      y: 3,
      duration: 0.08,
      onComplete: () => {
        element.textContent = next;
        gsap.to(element, {
          opacity: 1,
          y: 0,
          duration: 0.16,
          ease: "power2.out"
        });
      }
    });
  }

  function pct(value, max) {
    const safeMax = Math.max(1, asNum(max));
    return clamp(Math.round((asNum(value) / safeMax) * 100), 0, 100);
  }

  function formatTime(value) {
    if (!value) {
      return "-";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "-";
    }
    return date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  }

  function setMeterPalette(element, paletteKey = "neutral") {
    if (!element || !element.style) {
      return;
    }
    const key = String(paletteKey || "neutral").toLowerCase();
    const palette = METER_PALETTES[key] || METER_PALETTES.neutral;
    element.style.setProperty("--meter-start", String(palette.start || METER_PALETTES.neutral.start));
    element.style.setProperty("--meter-end", String(palette.end || METER_PALETTES.neutral.end));
    element.style.setProperty("--meter-glow", String(palette.glow || METER_PALETTES.neutral.glow));
  }

  function formatBytesShort(value) {
    const bytes = Math.max(0, Number(value || 0));
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return "0 B";
    }
    if (bytes < 1024) return `${Math.round(bytes)} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function tokenDecimals(token) {
    return Math.max(2, Math.min(8, Number(token?.decimals || 4)));
  }

  function readStorage(key, fallback = "") {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch {}
  }

  function getEffectiveQualityMode() {
    if (state.ui.qualityMode !== "auto") {
      return state.ui.qualityMode;
    }
    return state.ui.autoQualityMode || "normal";
  }

  function sceneModeLabel(mode = state.ui.sceneMode) {
    const key = String(mode || "pro").toLowerCase();
    if (key === "lite") return "LITE";
    if (key === "cinematic") return "CINEMATIC";
    if (key === "minimal") return "MINIMAL";
    return "PRO";
  }

  function cameraModeLabel(mode = state.ui.cameraMode) {
    const key = String(mode || "broadcast").toLowerCase();
    if (key === "tactical") return "Tactical";
    if (key === "chase") return "Chase";
    return "Broadcast";
  }

  function normalizeHudDensity(value, fallback = "full") {
    const key = String(value || fallback || "full").toLowerCase();
    if (HUD_DENSITY_VALUES.includes(key)) {
      return key;
    }
    return String(fallback || "full").toLowerCase();
  }

  function getQualityProfile(modeKey = null) {
    const key = String(modeKey || getEffectiveQualityMode() || "normal").toLowerCase();
    const base = QUALITY_PROFILES[key] || QUALITY_PROFILES.normal;
    const sceneMode = String(state.ui.sceneMode || "pro").toLowerCase();
    if (sceneMode === "minimal") {
      return { ...QUALITY_PROFILES.low, key: `${base.key}_minimal`, enableShards: false, cameraDrift: 0.35 };
    }
    if (sceneMode === "lite") {
      return {
        ...base,
        key: `${base.key}_lite`,
        starCount: Math.max(600, Math.round(base.starCount * 0.65)),
        starSize: Math.max(0.018, base.starSize * 0.85),
        enableShards: Boolean(base.enableShards && base.key !== "low"),
        cameraDrift: base.cameraDrift * 0.82
      };
    }
    if (sceneMode === "cinematic") {
      return {
        ...base,
        key: `${base.key}_cinematic`,
        starCount: Math.round(base.starCount * 1.15),
        starSize: base.starSize * 1.08,
        pointerLerp: Math.max(0.01, base.pointerLerp * 0.9),
        cameraDrift: base.cameraDrift * 1.2
      };
    }
    return base;
  }

  function qualityButtonLabel() {
    if (state.ui.qualityMode === "auto") {
      return `Perf: Auto (${getEffectiveQualityMode()})`;
    }
    return `Perf: ${state.ui.qualityMode}`;
  }

  function applyUiClasses() {
    const body = document.body;
    const effective = getEffectiveQualityMode();
    const cameraMode = String(state.ui.cameraMode || "broadcast").toLowerCase();
    const sceneMode = String(state.ui.sceneMode || "pro").toLowerCase();
    const hudDensity = normalizeHudDensity(state.ui.hudDensity, "full");
    state.ui.cameraMode = CAMERA_MODE_VALUES.includes(cameraMode) ? cameraMode : "broadcast";
    state.ui.hudDensity = hudDensity;
    state.telemetry.sceneHudDensity = hudDensity;
    body.classList.toggle("reduced-motion", state.ui.reducedMotion);
    body.classList.toggle("large-type", state.ui.largeText);
    body.classList.toggle("quality-low", effective === "low");
    body.classList.toggle("quality-high", effective === "high");
    body.classList.toggle("quality-normal", effective === "normal");
    body.classList.toggle("scene-pro", sceneMode === "pro");
    body.classList.toggle("scene-lite", sceneMode === "lite");
    body.classList.toggle("scene-cinematic", sceneMode === "cinematic");
    body.classList.toggle("scene-minimal", sceneMode === "minimal");
    body.classList.toggle("hud-compact", hudDensity === "compact");
    body.classList.toggle("hud-full", hudDensity === "full");
    body.classList.toggle("hud-extended", hudDensity === "extended");
    body.dataset.cameraMode = state.ui.cameraMode;

    const qualityBtn = byId("qualityToggleBtn");
    if (qualityBtn) {
      qualityBtn.textContent = qualityButtonLabel();
      qualityBtn.dataset.active = state.ui.qualityMode === "auto" ? "0" : "1";
    }
    const motionBtn = byId("motionToggleBtn");
    if (motionBtn) {
      motionBtn.textContent = state.ui.reducedMotion ? "Motion: Azaltildi" : "Motion: Acik";
      motionBtn.dataset.active = state.ui.reducedMotion ? "1" : "0";
    }
    const typeBtn = byId("typeToggleBtn");
    if (typeBtn) {
      typeBtn.textContent = state.ui.largeText ? "Yazi: Buyuk" : "Yazi: Normal";
      typeBtn.dataset.active = state.ui.largeText ? "1" : "0";
    }
    const cameraBtn = byId("cameraModeToggleBtn");
    if (cameraBtn) {
      cameraBtn.textContent = `Cam: ${cameraModeLabel(state.ui.cameraMode)}`;
      cameraBtn.dataset.active = state.ui.cameraMode;
    }
    const sceneBtn = byId("sceneModeToggleBtn");
    if (sceneBtn) {
      sceneBtn.textContent = `Scene: ${sceneModeLabel(sceneMode)}`;
      sceneBtn.dataset.active = sceneMode;
    }
    const sceneLine = byId("sceneModeLine");
    if (sceneLine) {
      sceneLine.textContent = `Scene: ${sceneModeLabel(sceneMode)}`;
    }
    const sceneProfileLine = byId("sceneProfileLine");
    if (sceneProfileLine) {
      sceneProfileLine.textContent = `Profile: hud ${hudDensity} | postfx ${Number(state.telemetry.scenePostFxLevel || 0.9).toFixed(2)} | ${String(
        state.telemetry.manifestRevision || "local"
      )}`;
    }
    const runtimeSceneLine = byId("runtimeSceneLine");
    if (runtimeSceneLine) {
      runtimeSceneLine.textContent = `HUD ${hudDensity} | PostFX ${Number(state.telemetry.scenePostFxLevel || 0.9).toFixed(
        2
      )} | Cam ${cameraModeLabel(state.ui.cameraMode).toUpperCase()} | ${String(state.telemetry.sceneMood || "balanced").toUpperCase()}`;
    }
  }

  function persistUiPrefs() {
    writeStorage(state.ui.storageKeys.quality, state.ui.qualityMode);
    writeStorage(state.ui.storageKeys.cameraMode, state.ui.cameraMode);
    writeStorage(state.ui.storageKeys.sceneMode, state.ui.sceneMode);
    writeStorage(state.ui.storageKeys.hudDensity, normalizeHudDensity(state.ui.hudDensity, "full"));
    writeStorage(state.ui.storageKeys.reducedMotion, state.ui.reducedMotion ? "1" : "0");
    writeStorage(state.ui.storageKeys.largeText, state.ui.largeText ? "1" : "0");
  }

  function loadUiPrefs() {
    const quality = String(readStorage(state.ui.storageKeys.quality, "auto") || "auto").toLowerCase();
    if (["auto", "high", "low", "normal"].includes(quality)) {
      state.ui.qualityMode = quality === "normal" ? "auto" : quality;
    }
    const cameraMode = String(readStorage(state.ui.storageKeys.cameraMode, "broadcast") || "broadcast").toLowerCase();
    if (CAMERA_MODE_VALUES.includes(cameraMode)) {
      state.ui.cameraMode = cameraMode;
    }
    const sceneMode = String(readStorage(state.ui.storageKeys.sceneMode, "pro") || "pro").toLowerCase();
    if (SCENE_MODE_VALUES.includes(sceneMode)) {
      state.ui.sceneMode = sceneMode;
    }
    const hudDensity = normalizeHudDensity(readStorage(state.ui.storageKeys.hudDensity, "full"), "full");
    state.ui.hudDensity = hudDensity;
    state.telemetry.sceneHudDensity = hudDensity;
    state.ui.reducedMotion = readStorage(state.ui.storageKeys.reducedMotion, "0") === "1";
    state.ui.largeText = readStorage(state.ui.storageKeys.largeText, "0") === "1";
    applyUiClasses();
  }

  function applyArenaQualityProfile(profile = null) {
    const arena = state.arena;
    if (!arena || !arena.renderer) {
      return;
    }
    const nextProfile = profile || getQualityProfile();
    arena.qualityProfile = nextProfile;
    const ratioCap = state.ui.reducedMotion ? Math.min(1.2, nextProfile.pixelRatioCap) : nextProfile.pixelRatioCap;
    arena.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ratioCap));
    if (arena.starsMaterial) {
      arena.starsMaterial.size = nextProfile.starSize;
    }
    if (arena.stars && arena.stars.geometry && typeof arena.stars.geometry.setDrawRange === "function") {
      arena.stars.geometry.setDrawRange(0, nextProfile.starCount);
    }
    if (arena.shards) {
      arena.shards.visible = Boolean(nextProfile.enableShards && !state.ui.reducedMotion);
    }
    if (Array.isArray(arena.drones)) {
      const maxVisible =
        state.ui.reducedMotion || nextProfile.key === "low"
          ? 4
          : nextProfile.key === "normal"
            ? Math.min(8, arena.drones.length)
            : arena.drones.length;
      arena.drones.forEach((drone, index) => {
        if (!drone) {
          return;
        }
        drone.visible = index < maxVisible;
      });
    }
    if (Array.isArray(arena.pylons)) {
      const maxVisible =
        state.ui.reducedMotion || nextProfile.key === "low"
          ? Math.min(4, arena.pylons.length)
          : nextProfile.key === "normal"
            ? Math.min(7, arena.pylons.length)
            : arena.pylons.length;
      arena.pylons.forEach((pylon, index) => {
        if (!pylon) {
          return;
        }
        pylon.visible = index < maxVisible;
      });
    }
    if (arena.floorGrid) {
      arena.floorGrid.visible = nextProfile.key !== "low" || !state.ui.reducedMotion;
    }
    if (Array.isArray(arena.tracerBeams)) {
      const maxVisible =
        state.ui.reducedMotion || nextProfile.key === "low"
          ? Math.min(4, arena.tracerBeams.length)
          : nextProfile.key === "normal"
            ? Math.min(9, arena.tracerBeams.length)
            : arena.tracerBeams.length;
      arena.tracerLimit = maxVisible;
      arena.tracerBeams.forEach((beam, index) => {
        if (!beam) {
          return;
        }
        if (index >= maxVisible) {
          beam.visible = false;
          if (Array.isArray(arena.tracerMeta) && arena.tracerMeta[index]) {
            arena.tracerMeta[index].life = 0;
            arena.tracerMeta[index].maxLife = 0;
          }
        }
      });
    }
    if (Array.isArray(arena.impactNodes)) {
      const maxVisible =
        state.ui.reducedMotion || nextProfile.key === "low"
          ? Math.min(5, arena.impactNodes.length)
          : nextProfile.key === "normal"
            ? Math.min(8, arena.impactNodes.length)
            : arena.impactNodes.length;
      arena.impactLimit = maxVisible;
      arena.impactNodes.forEach((node, index) => {
        if (!node) {
          return;
        }
        if (index >= maxVisible) {
          node.visible = false;
          if (Array.isArray(arena.impactMeta) && arena.impactMeta[index]) {
            arena.impactMeta[index].life = 0;
            arena.impactMeta[index].maxLife = 0;
          }
        }
      });
    }
    if (Array.isArray(arena.duelBridgeSegments)) {
      const maxVisible =
        state.ui.reducedMotion || nextProfile.key === "low"
          ? Math.min(4, arena.duelBridgeSegments.length)
          : nextProfile.key === "normal"
            ? Math.min(8, arena.duelBridgeSegments.length)
            : arena.duelBridgeSegments.length;
      arena.duelBridgeSegments.forEach((segment, index) => {
        if (!segment) {
          return;
        }
        segment.visible = index < maxVisible;
      });
    }
    if (Array.isArray(arena.duelBands)) {
      const maxVisible =
        state.ui.reducedMotion || nextProfile.key === "low"
          ? Math.min(2, arena.duelBands.length)
          : nextProfile.key === "normal"
            ? Math.min(3, arena.duelBands.length)
            : arena.duelBands.length;
      arena.duelBands.forEach((band, index) => {
        if (!band) {
          return;
        }
        band.visible = index < maxVisible;
      });
    }
    if (Array.isArray(arena.stormRibbons)) {
      const maxVisible =
        state.ui.reducedMotion || nextProfile.key === "low"
          ? Math.min(2, arena.stormRibbons.length)
          : nextProfile.key === "normal"
            ? Math.min(4, arena.stormRibbons.length)
            : arena.stormRibbons.length;
      arena.stormRibbons.forEach((ribbon, index) => {
        if (!ribbon) {
          return;
        }
        ribbon.visible = index < maxVisible;
      });
    }
    if (Array.isArray(arena.raidBeacons)) {
      const maxVisible =
        state.ui.reducedMotion || nextProfile.key === "low"
          ? Math.min(3, arena.raidBeacons.length)
          : nextProfile.key === "normal"
            ? Math.min(5, arena.raidBeacons.length)
            : arena.raidBeacons.length;
      arena.raidBeacons.forEach((beacon, index) => {
        if (!beacon) {
          return;
        }
        beacon.visible = index < maxVisible;
      });
    }
    applyUiClasses();
  }

  function cycleQualityMode() {
    const nextMap = {
      auto: "high",
      high: "low",
      low: "auto"
    };
    state.ui.qualityMode = nextMap[state.ui.qualityMode] || "auto";
    if (state.ui.qualityMode !== "auto") {
      state.ui.autoQualityMode = "normal";
    }
    persistUiPrefs();
    applyArenaQualityProfile();
    schedulePerfProfile(true);
    showToast(`Performans modu: ${qualityButtonLabel()}`);
  }

  function cycleCameraMode() {
    const current = String(state.ui.cameraMode || "broadcast").toLowerCase();
    const idx = Math.max(0, CAMERA_MODE_VALUES.indexOf(current));
    const next = CAMERA_MODE_VALUES[(idx + 1) % CAMERA_MODE_VALUES.length];
    state.ui.cameraMode = next;
    persistUiPrefs();
    applyUiClasses();
    scheduleSceneProfileSync(true);
    showToast(`Kamera modu: ${cameraModeLabel(next)}`);
  }

  function cycleSceneMode() {
    const current = String(state.ui.sceneMode || "pro").toLowerCase();
    const idx = Math.max(0, SCENE_MODE_VALUES.indexOf(current));
    const next = SCENE_MODE_VALUES[(idx + 1) % SCENE_MODE_VALUES.length];
    state.ui.sceneMode = next;
    persistUiPrefs();
    applyArenaQualityProfile();
    schedulePerfProfile(true);
    scheduleSceneProfileSync(true);
    showToast(`Scene modu: ${sceneModeLabel(next)}`);
  }

  function toggleMotion() {
    state.ui.reducedMotion = !state.ui.reducedMotion;
    persistUiPrefs();
    applyArenaQualityProfile();
    schedulePerfProfile(true);
    scheduleSceneProfileSync(true);
    showToast(state.ui.reducedMotion ? "Motion azaltildi" : "Motion acildi");
  }

  function toggleLargeText() {
    state.ui.largeText = !state.ui.largeText;
    persistUiPrefs();
    applyUiClasses();
    schedulePerfProfile(true);
    scheduleSceneProfileSync(true);
    showToast(state.ui.largeText ? "Buyuk yazi modu acik" : "Yazi boyutu normale dondu");
  }

  function markLatency(valueMs) {
    const latency = Math.max(0, asNum(valueMs));
    if (!state.telemetry.latencyAvgMs) {
      state.telemetry.latencyAvgMs = latency;
      return;
    }
    state.telemetry.latencyAvgMs = state.telemetry.latencyAvgMs * 0.84 + latency * 0.16;
  }

  async function postPerfProfile(force = false) {
    const bridge = getPerfBridge();
    if (!bridge || typeof bridge.post !== "function") {
      return;
    }
    const now = Date.now();
    const intervalMs = 45_000;
    if (!force && now - state.telemetry.lastPerfPostAt < intervalMs) {
      return;
    }
    if (!state.auth.uid || !state.auth.ts || !state.auth.sig) {
      return;
    }
    state.telemetry.lastPerfPostAt = now;
    const qualityMode = state.ui.qualityMode === "auto" ? getEffectiveQualityMode() : state.ui.qualityMode;
    await bridge.post({
      uid: state.auth.uid,
      ts: state.auth.ts,
      sig: state.auth.sig,
      device_hash: state.telemetry.deviceHash || "legacy",
      ui_mode: "hardcore",
      quality_mode: qualityMode,
      reduced_motion: Boolean(state.ui.reducedMotion),
      large_text: Boolean(state.ui.largeText),
      sound_enabled: true,
      platform: "telegram_web",
      gpu_tier: String(state.telemetry.perfTier || "normal"),
      cpu_tier: String(state.telemetry.perfTier || "normal"),
      memory_tier: String(state.telemetry.perfTier || "normal"),
      fps_avg: Number(state.telemetry.fpsAvg || 0),
      frame_time_ms: Number(state.telemetry.frameTimeMs || 0),
      latency_avg_ms: Number(state.telemetry.latencyAvgMs || 0),
      dropped_frames: Number(state.telemetry.droppedFrames || 0),
      gpu_time_ms: Number(state.telemetry.gpuTimeMs || 0),
      cpu_time_ms: Number(state.telemetry.cpuTimeMs || 0),
      profile_json: {
        quality_mode: qualityMode,
        auto_quality_mode: state.ui.autoQualityMode,
        app_state: state.v3.appState
      }
    });
  }

  function sceneModeProfile(sceneMode = state.ui.sceneMode) {
    const key = String(sceneMode || "pro").toLowerCase();
    if (key === "minimal") {
      return { motionIntensity: 0.45, postfxLevel: 0.2, hudDensity: "compact" };
    }
    if (key === "lite") {
      return { motionIntensity: 0.72, postfxLevel: 0.55, hudDensity: "compact" };
    }
    if (key === "cinematic") {
      return { motionIntensity: 1.25, postfxLevel: 1.2, hudDensity: "extended" };
    }
    return { motionIntensity: 1, postfxLevel: 0.9, hudDensity: "full" };
  }

  async function postSceneProfile(force = false) {
    const now = Date.now();
    const intervalMs = 55_000;
    if (!force && now - state.telemetry.lastScenePostAt < intervalMs) {
      return;
    }
    if (!state.auth.uid || !state.auth.ts || !state.auth.sig) {
      return;
    }
    state.telemetry.lastScenePostAt = now;
    const sceneProfile = sceneModeProfile(state.ui.sceneMode);
    const perfProfile = String(getEffectiveQualityMode() || "normal").toLowerCase();
    const qualityMode = String(state.ui.qualityMode || "auto").toLowerCase();
    const payload = {
      uid: state.auth.uid,
      ts: state.auth.ts,
      sig: state.auth.sig,
      scene_key: "nexus_arena",
      scene_mode: String(state.ui.sceneMode || "pro"),
      perf_profile: ["low", "normal", "high"].includes(perfProfile) ? perfProfile : "normal",
      quality_mode: ["auto", "low", "normal", "high"].includes(qualityMode) ? qualityMode : "auto",
      reduced_motion: Boolean(state.ui.reducedMotion),
      large_text: Boolean(state.ui.largeText),
      motion_intensity: sceneProfile.motionIntensity,
      postfx_level: sceneProfile.postfxLevel,
      hud_density: sceneProfile.hudDensity,
      prefs_json: {
        auto_quality_mode: state.ui.autoQualityMode,
        camera_mode: state.ui.cameraMode,
        perf_tier: state.telemetry.perfTier,
        source: "webapp_v35"
      }
    };
    const t0 = performance.now();
    const res = await fetch("/webapp/api/scene/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    markLatency(performance.now() - t0);
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.success) {
      throw new Error(body?.error || `scene_profile_post_failed:${res.status}`);
    }
    renewAuth(body);
  }

  function scheduleSceneProfileSync(force = false) {
    if (state.telemetry.sceneTimer) {
      clearTimeout(state.telemetry.sceneTimer);
      state.telemetry.sceneTimer = null;
    }
    const delay = force ? 280 : 950;
    state.telemetry.sceneTimer = setTimeout(() => {
      postSceneProfile(force).catch(() => {});
    }, delay);
  }

  function schedulePerfProfile(force = false) {
    if (state.telemetry.perfTimer) {
      clearTimeout(state.telemetry.perfTimer);
      state.telemetry.perfTimer = null;
    }
    const delay = force ? 300 : 1200;
    state.telemetry.perfTimer = setTimeout(() => {
      postPerfProfile(force).catch(() => {});
      scheduleSceneProfileSync(false);
    }, delay);
  }

  function renewAuth(payload) {
    if (!payload || !payload.session) return;
    state.auth.uid = String(payload.session.uid || state.auth.uid);
    state.auth.ts = String(payload.session.ts || state.auth.ts);
    state.auth.sig = String(payload.session.sig || state.auth.sig);
  }

  function showToast(message, isError = false) {
    const toast = byId("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.style.borderColor = isError ? "rgba(255, 86, 121, 0.7)" : "rgba(162, 186, 255, 0.4)";
    toast.classList.add("show");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toast.classList.remove("show");
    }, 1800);
  }

  function pushCombatTicker(message, tone = "info") {
    const line = byId("combatEventTicker");
    if (!line) {
      return;
    }
    const text = String(message || "").trim();
    if (!text) {
      return;
    }
    line.textContent = text;
    line.dataset.tone = String(tone || "info");
    line.classList.add("live");
    if (pushCombatTicker._timer) {
      clearTimeout(pushCombatTicker._timer);
      pushCombatTicker._timer = null;
    }
    pushCombatTicker._timer = setTimeout(() => {
      line.classList.remove("live");
      line.dataset.tone = "idle";
    }, 1100);
  }

  function spawnHudBurst(tone = "info", label = "") {
    const layer = byId("fxBurstLayer");
    if (!layer || state.ui.reducedMotion) {
      return;
    }
    const pulseTone = String(tone || "info");
    const burst = document.createElement("div");
    burst.className = `fxBurst ${pulseTone}`;
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 720;
    const px = 24 + Math.random() * Math.max(80, w - 48);
    const py = 26 + Math.random() * Math.max(80, h - 52);
    burst.style.left = `${px}px`;
    burst.style.top = `${py}px`;
    layer.appendChild(burst);

    if (label) {
      const txt = document.createElement("span");
      txt.className = `fxLabel ${pulseTone}`;
      txt.textContent = String(label || "").slice(0, 28);
      txt.style.left = `${px + 8}px`;
      txt.style.top = `${py + 8}px`;
      layer.appendChild(txt);
      const gsap = getGsap();
      if (gsap) {
        gsap.fromTo(
          txt,
          { opacity: 0, y: 0, scale: 0.92 },
          { opacity: 1, y: -12, scale: 1, duration: 0.18, ease: "power2.out" }
        );
        gsap.to(txt, {
          opacity: 0,
          y: -34,
          duration: 0.56,
          ease: "power2.in",
          delay: 0.24,
          onComplete: () => txt.remove()
        });
      } else {
        setTimeout(() => txt.remove(), 700);
      }
    }

    const gsap = getGsap();
    if (gsap) {
      gsap.fromTo(
        burst,
        { opacity: 0, scale: 0.2, rotate: -8 },
        { opacity: 1, scale: 1.05, rotate: 0, duration: 0.18, ease: "power2.out" }
      );
      gsap.to(burst, {
        opacity: 0,
        scale: 1.48,
        duration: 0.52,
        ease: "power2.in",
        delay: 0.14,
        onComplete: () => burst.remove()
      });
    } else {
      setTimeout(() => burst.remove(), 700);
    }
  }

  async function loadAssetManifest() {
    const parseVec3 = (value, fallback) => {
      if (!Array.isArray(value) || value.length !== 3) {
        return fallback.slice();
      }
      return value.map((item, index) => {
        const parsed = Number(item);
        if (!Number.isFinite(parsed)) {
          return fallback[index];
        }
        return parsed;
      });
    };

    const normalizeFromRegistry = (payload) => {
      if (!payload || typeof payload !== "object") {
        return null;
      }
      const entries = Array.isArray(payload.entries) ? payload.entries : [];
      if (!entries.length) {
        return null;
      }
      const models = {};
      for (const entry of entries) {
        const key = String(entry.asset_key || "").trim();
        if (!key) {
          continue;
        }
        const meta = entry.meta_json && typeof entry.meta_json === "object" ? entry.meta_json : {};
        const path = String(entry.asset_path || entry.fallback_path || "").trim();
        if (!path) {
          continue;
        }
        models[key] = {
          path,
          position: parseVec3(meta.position, [0, 0, 0]),
          rotation: parseVec3(meta.rotation, [0, 0, 0]),
          scale: parseVec3(meta.scale, [1, 1, 1])
        };
      }
      if (!Object.keys(models).length) {
        return null;
      }
      return {
        version: 1,
        models,
        source: {
          provider: "asset_registry",
          revision: String(payload.active_revision?.manifest_revision || "db")
        }
      };
    };

    const query = new URLSearchParams(state.auth || {}).toString();
    if (query) {
      try {
        const res = await fetch(`/webapp/api/assets/manifest/active?${query}`, { cache: "no-store" });
        if (res.ok) {
          const payload = await res.json();
          if (payload?.success) {
            const normalized = normalizeFromRegistry(payload.data);
            if (normalized) {
              return normalized;
            }
          }
        }
      } catch (_) {}
    }

    try {
      const res = await fetch("/webapp/assets/manifest.json", { cache: "no-store" });
      if (!res.ok) {
        return null;
      }
      const data = await res.json();
      if (!data || typeof data !== "object") {
        return null;
      }
      return data;
    } catch (err) {
      return null;
    }
  }

  function createFallbackArena(scene) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(5.7, 0.09, 20, 180),
      new THREE.MeshBasicMaterial({ color: 0x8aa7ff, transparent: true, opacity: 0.35 })
    );
    ring.rotation.x = 1.16;
    scene.add(ring);

    const ringOuter = new THREE.Mesh(
      new THREE.TorusGeometry(7.4, 0.06, 18, 180),
      new THREE.MeshBasicMaterial({ color: 0xff7ecb, transparent: true, opacity: 0.22 })
    );
    ringOuter.rotation.x = 1.27;
    scene.add(ringOuter);

    const floorGrid = new THREE.Mesh(
      new THREE.RingGeometry(6.8, 15.2, 96, 1),
      new THREE.MeshBasicMaterial({
        color: 0x6fa0ff,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide
      })
    );
    floorGrid.rotation.x = -Math.PI / 2;
    floorGrid.position.y = -1.75;
    scene.add(floorGrid);

    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.2, 3),
      new THREE.MeshStandardMaterial({
        color: 0x3df8c2,
        emissive: 0x112849,
        metalness: 0.52,
        roughness: 0.26,
        wireframe: false
      })
    );
    scene.add(core);

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(2.8, 40, 40),
      new THREE.MeshBasicMaterial({
        color: 0x3df8c2,
        transparent: true,
        opacity: 0.2
      })
    );
    scene.add(glow);

    const pulseShell = new THREE.Mesh(
      new THREE.SphereGeometry(3.6, 42, 42),
      new THREE.MeshBasicMaterial({
        color: 0x7fc5ff,
        transparent: true,
        opacity: 0.08,
        side: THREE.BackSide
      })
    );
    scene.add(pulseShell);

    const shardGeo = new THREE.TetrahedronGeometry(0.14, 0);
    const shardMat = new THREE.MeshStandardMaterial({
      color: 0xbfe1ff,
      emissive: 0x142a4d,
      roughness: 0.3,
      metalness: 0.6
    });
    const shardCount = 180;
    const shards = new THREE.InstancedMesh(shardGeo, shardMat, shardCount);
    const shardMeta = [];
    const dummy = new THREE.Object3D();
    for (let i = 0; i < shardCount; i += 1) {
      const r = 4.8 + Math.random() * 4.6;
      const angle = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 3.8;
      const speed = 0.12 + Math.random() * 0.33;
      const offset = Math.random() * Math.PI * 2;
      shardMeta.push({ r, angle, y, speed, offset });
      dummy.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
      dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      const s = 0.8 + Math.random() * 1.4;
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      shards.setMatrixAt(i, dummy.matrix);
    }
    shards.instanceMatrix.needsUpdate = true;
    scene.add(shards);

    const droneGeo = new THREE.OctahedronGeometry(0.22, 0);
    const droneMat = new THREE.MeshStandardMaterial({
      color: 0xbfe6ff,
      emissive: 0x10254c,
      roughness: 0.32,
      metalness: 0.74
    });
    const droneCount = 12;
    const drones = [];
    const droneMeta = [];
    for (let i = 0; i < droneCount; i += 1) {
      const drone = new THREE.Mesh(droneGeo, droneMat.clone());
      const radius = 3.6 + Math.random() * 3.4;
      const offset = Math.random() * Math.PI * 2;
      const altitude = -0.7 + Math.random() * 2.4;
      const speed = 0.35 + Math.random() * 0.95;
      drone.position.set(Math.cos(offset) * radius, altitude, Math.sin(offset) * radius);
      drone.scale.setScalar(0.75 + Math.random() * 0.55);
      scene.add(drone);
      drones.push(drone);
      droneMeta.push({ radius, offset, altitude, speed });
    }

    const pylons = [];
    const pylonMeta = [];
    const pylonCount = 10;
    for (let i = 0; i < pylonCount; i += 1) {
      const angle = (Math.PI * 2 * i) / pylonCount;
      const radius = 7.9 + (i % 2) * 1.15;
      const height = 0.9 + Math.random() * 1.9;
      const pylon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.14, height, 10, 1, true),
        new THREE.MeshStandardMaterial({
          color: 0xaecbff,
          emissive: 0x133168,
          roughness: 0.34,
          metalness: 0.78,
          transparent: true,
          opacity: 0.84
        })
      );
      pylon.position.set(Math.cos(angle) * radius, -1.24 + height / 2, Math.sin(angle) * radius);
      pylon.rotation.y = -angle;
      scene.add(pylon);
      pylons.push(pylon);
      pylonMeta.push({
        angle,
        radius,
        baseY: -1.24 + height / 2,
        height,
        pulse: 0.7 + Math.random() * 1.7,
        drift: Math.random() * Math.PI * 2
      });
    }

    const pulseWaves = [];
    for (let i = 0; i < 6; i += 1) {
      const wave = new THREE.Mesh(
        new THREE.TorusGeometry(3.8 + i * 0.36, 0.04, 14, 130),
        new THREE.MeshBasicMaterial({
          color: 0x9bc0ff,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide
        })
      );
      wave.rotation.x = Math.PI / 2;
      wave.visible = false;
      scene.add(wave);
      pulseWaves.push(wave);
    }

    const tracerBeams = [];
    const tracerMeta = [];
    const tracerGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 10, 1, true);
    for (let i = 0; i < 14; i += 1) {
      const beam = new THREE.Mesh(
        tracerGeo,
        new THREE.MeshBasicMaterial({
          color: 0x9ec4ff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );
      beam.visible = false;
      beam.renderOrder = 3;
      scene.add(beam);
      tracerBeams.push(beam);
      tracerMeta.push({ life: 0, maxLife: 0, width: 1, drift: Math.random() * Math.PI * 2 });
    }

    const impactNodes = [];
    const impactMeta = [];
    const impactGeo = new THREE.SphereGeometry(0.18, 14, 14);
    for (let i = 0; i < 12; i += 1) {
      const impact = new THREE.Mesh(
        impactGeo,
        new THREE.MeshBasicMaterial({
          color: 0x7fc5ff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );
      impact.visible = false;
      impact.renderOrder = 4;
      scene.add(impact);
      impactNodes.push(impact);
      impactMeta.push({ life: 0, maxLife: 0 });
    }

    const duelCoreGeo = new THREE.SphereGeometry(0.36, 18, 18);
    const duelCoreSelf = new THREE.Mesh(
      duelCoreGeo,
      new THREE.MeshStandardMaterial({
        color: 0x72d6ff,
        emissive: 0x153667,
        roughness: 0.2,
        metalness: 0.62
      })
    );
    duelCoreSelf.position.set(-3.2, -0.22, 0.84);
    scene.add(duelCoreSelf);

    const duelCoreOpp = new THREE.Mesh(
      duelCoreGeo,
      new THREE.MeshStandardMaterial({
        color: 0xff7f93,
        emissive: 0x5b182f,
        roughness: 0.24,
        metalness: 0.58
      })
    );
    duelCoreOpp.position.set(3.2, -0.22, 0.84);
    scene.add(duelCoreOpp);

    const duelHaloGeo = new THREE.TorusGeometry(0.62, 0.024, 12, 82);
    const duelHaloSelf = new THREE.Mesh(
      duelHaloGeo,
      new THREE.MeshBasicMaterial({
        color: 0x74d8ff,
        transparent: true,
        opacity: 0.28
      })
    );
    duelHaloSelf.position.copy(duelCoreSelf.position);
    duelHaloSelf.rotation.x = Math.PI / 2;
    scene.add(duelHaloSelf);

    const duelHaloOpp = new THREE.Mesh(
      duelHaloGeo,
      new THREE.MeshBasicMaterial({
        color: 0xff91a7,
        transparent: true,
        opacity: 0.28
      })
    );
    duelHaloOpp.position.copy(duelCoreOpp.position);
    duelHaloOpp.rotation.x = Math.PI / 2;
    scene.add(duelHaloOpp);

    const duelBridgeSegments = [];
    const duelBridgeMeta = [];
    const bridgeGeo = new THREE.CylinderGeometry(0.022, 0.022, 1.02, 10, 1, true);
    const bridgeCount = 11;
    for (let i = 0; i < bridgeCount; i += 1) {
      const bridge = new THREE.Mesh(
        bridgeGeo,
        new THREE.MeshBasicMaterial({
          color: 0x96c4ff,
          transparent: true,
          opacity: 0.2,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      );
      const t = bridgeCount <= 1 ? 0 : i / (bridgeCount - 1);
      const x = -2.78 + t * 5.56;
      bridge.position.set(x, -0.2, 0.84 + Math.sin(t * Math.PI) * 0.32);
      bridge.rotation.z = Math.PI / 2;
      bridge.scale.set(0.85, 0.72 + Math.sin(t * Math.PI) * 0.34, 0.85);
      bridge.renderOrder = 2;
      scene.add(bridge);
      duelBridgeSegments.push(bridge);
      duelBridgeMeta.push({
        x,
        baseY: -0.2,
        z: bridge.position.z,
        span: 0.72 + Math.sin(t * Math.PI) * 0.34,
        drift: Math.random() * Math.PI * 2,
        tempo: 0.95 + Math.random() * 0.8
      });
    }

    const duelBands = [];
    for (let i = 0; i < 4; i += 1) {
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(2.6 + i * 0.56, 0.035, 12, 136),
        new THREE.MeshBasicMaterial({
          color: 0x8db4ff,
          transparent: true,
          opacity: 0.08 + i * 0.02,
          side: THREE.DoubleSide
        })
      );
      band.rotation.x = Math.PI / 2;
      band.position.y = -0.9 + i * 0.2;
      scene.add(band);
      duelBands.push(band);
    }

    const stormRibbons = [];
    const stormRibbonMeta = [];
    for (let i = 0; i < 5; i += 1) {
      const ribbon = new THREE.Mesh(
        new THREE.TorusKnotGeometry(2.2 + i * 0.58, 0.035 + i * 0.004, 120, 16, i % 2 === 0 ? 2 : 3, 3),
        new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0x7bcfff : 0xff83a6,
          transparent: true,
          opacity: 0.12,
          blending: THREE.AdditiveBlending
        })
      );
      ribbon.position.set(0, -0.78 + i * 0.28, -0.8 + i * 0.32);
      ribbon.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      scene.add(ribbon);
      stormRibbons.push(ribbon);
      stormRibbonMeta.push({
        baseY: ribbon.position.y,
        baseScale: 0.9 + i * 0.06,
        spinX: 0.08 + Math.random() * 0.16,
        spinY: 0.1 + Math.random() * 0.18,
        spinZ: 0.06 + Math.random() * 0.12,
        pulse: 0.7 + Math.random() * 1.3,
        offset: Math.random() * Math.PI * 2
      });
    }

    const raidBeacons = [];
    const raidBeaconMeta = [];
    for (let i = 0; i < 8; i += 1) {
      const angle = (Math.PI * 2 * i) / 8;
      const radius = 5.6 + (i % 2) * 0.9;
      const beacon = new THREE.Mesh(
        new THREE.ConeGeometry(0.2, 1.45, 10, 1, true),
        new THREE.MeshStandardMaterial({
          color: 0x8bc7ff,
          emissive: 0x14376b,
          roughness: 0.28,
          metalness: 0.72,
          transparent: true,
          opacity: 0.72
        })
      );
      beacon.position.set(Math.cos(angle) * radius, -0.78, Math.sin(angle) * radius);
      beacon.rotation.y = -angle;
      beacon.scale.set(0.95, 1, 0.95);
      scene.add(beacon);
      raidBeacons.push(beacon);
      raidBeaconMeta.push({
        baseY: beacon.position.y,
        pulse: 0.8 + Math.random() * 1.2,
        phase: Math.random() * Math.PI * 2,
        radius,
        angle,
        drift: 0.08 + Math.random() * 0.18
      });
    }

    const bossCluster = new THREE.Group();
    bossCluster.position.set(0, -0.08, -1.15);
    scene.add(bossCluster);

    const bossCore = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.82, 2),
      new THREE.MeshStandardMaterial({
        color: 0xff8fa6,
        emissive: 0x4a172c,
        roughness: 0.22,
        metalness: 0.68
      })
    );
    bossCluster.add(bossCore);

    const bossAura = new THREE.Mesh(
      new THREE.SphereGeometry(1.28, 28, 28),
      new THREE.MeshBasicMaterial({
        color: 0xff9ab1,
        transparent: true,
        opacity: 0.14,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    bossCluster.add(bossAura);

    const bossShieldRings = [];
    const bossShieldMeta = [];
    for (let i = 0; i < 3; i += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.18 + i * 0.26, 0.028 + i * 0.004, 14, 100),
        new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? 0xff8da7 : 0x7bd4ff,
          transparent: true,
          opacity: 0.18 + i * 0.04,
          blending: THREE.AdditiveBlending
        })
      );
      ring.rotation.x = Math.PI / 2 + i * 0.24;
      ring.rotation.y = i * 0.42;
      ring.position.y = -0.06 + i * 0.06;
      bossCluster.add(ring);
      bossShieldRings.push(ring);
      bossShieldMeta.push({
        spin: (i % 2 === 0 ? 1 : -1) * (0.18 + i * 0.1 + Math.random() * 0.08),
        drift: Math.random() * Math.PI * 2,
        pulse: 0.8 + Math.random() * 1.4
      });
    }

    const bossSpikes = [];
    const bossSpikeMeta = [];
    for (let i = 0; i < 10; i += 1) {
      const angle = (Math.PI * 2 * i) / 10;
      const radius = 1.72 + (i % 2) * 0.22;
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(0.08, 0.56 + (i % 3) * 0.08, 8),
        new THREE.MeshStandardMaterial({
          color: 0xff97ac,
          emissive: 0x3f1728,
          roughness: 0.24,
          metalness: 0.72,
          transparent: true,
          opacity: 0.76
        })
      );
      spike.position.set(Math.cos(angle) * radius, -0.08 + (i % 4) * 0.06, Math.sin(angle) * radius);
      spike.lookAt(0, -0.02, 0);
      bossCluster.add(spike);
      bossSpikes.push(spike);
      bossSpikeMeta.push({
        angle,
        radius,
        baseY: spike.position.y,
        pulse: 0.9 + Math.random() * 1.3,
        drift: Math.random() * Math.PI * 2,
        orbit: 0.1 + Math.random() * 0.2
      });
    }

    return {
      ring,
      ringOuter,
      core,
      glow,
      pulseShell,
      shards,
      shardMeta,
      shardDummy: dummy,
      drones,
      droneMeta,
      pylons,
      pylonMeta,
      floorGrid,
      pulseWaves,
      pulseWaveCursor: 0,
      tracerBeams,
      tracerMeta,
      tracerCursor: 0,
      tracerLimit: tracerBeams.length,
      impactNodes,
      impactMeta,
      impactCursor: 0,
      impactLimit: impactNodes.length,
      duelCoreSelf,
      duelCoreOpp,
      duelHaloSelf,
      duelHaloOpp,
      duelBridgeSegments,
      duelBridgeMeta,
      duelBands,
      stormRibbons,
      stormRibbonMeta,
      raidBeacons,
      raidBeaconMeta,
      bossCluster,
      bossCore,
      bossAura,
      bossShieldRings,
      bossShieldMeta,
      bossSpikes,
      bossSpikeMeta
    };
  }

  async function tryLoadArenaModel(scene, targetPath) {
    if (!window.THREE || typeof window.THREE.GLTFLoader !== "function") {
      return null;
    }
    const loader = new window.THREE.GLTFLoader();
    return new Promise((resolve) => {
      loader.load(
        targetPath,
        (gltf) => {
          const root = gltf.scene || null;
          if (!root) {
            resolve(null);
            return;
          }
          root.position.set(0, 0, 0);
          root.scale.setScalar(2.0);
          scene.add(root);
          const mixers = [];
          if (Array.isArray(gltf.animations) && gltf.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(root);
            gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
            mixers.push(mixer);
          }
          resolve({ root, mixers });
        },
        undefined,
        () => resolve(null)
      );
    });
  }

  function simUi() {
    return {
      timer: byId("simTimer"),
      prompt: byId("simPrompt"),
      stats: byId("simStats"),
      startBtn: byId("simStartBtn"),
      strikeBtn: byId("simStrikeBtn"),
      guardBtn: byId("simGuardBtn"),
      chargeBtn: byId("simChargeBtn")
    };
  }

  function setSimPrompt(text, tone = "") {
    const ui = simUi();
    if (!ui.prompt) return;
    ui.prompt.textContent = text;
    ui.prompt.classList.remove("hot", "ok");
    if (tone) {
      ui.prompt.classList.add(tone);
    }
  }

  function renderSimStats() {
    const ui = simUi();
    if (!ui.stats || !ui.timer) return;
    ui.stats.textContent = `Skor ${state.sim.score} | Combo ${state.sim.combo} | Hit ${state.sim.hits} | Miss ${state.sim.misses}`;
    if (state.sim.active) {
      ui.timer.textContent = `Kalan ${state.sim.secondsLeft}s`;
      ui.startBtn.disabled = true;
    } else {
      ui.timer.textContent = "Hazir";
      ui.startBtn.disabled = false;
    }
    const interactive = state.sim.active;
    ui.strikeBtn.disabled = !interactive;
    ui.guardBtn.disabled = !interactive;
    ui.chargeBtn.disabled = !interactive;
  }

  function resetSimState() {
    if (state.sim.timer) {
      clearInterval(state.sim.timer);
    }
    if (state.sim.pulseTimer) {
      clearTimeout(state.sim.pulseTimer);
    }
    state.sim.active = false;
    state.sim.timer = null;
    state.sim.pulseTimer = null;
    state.sim.expected = "";
    state.sim.awaiting = false;
    state.sim.score = 0;
    state.sim.combo = 0;
    state.sim.hits = 0;
    state.sim.misses = 0;
    state.sim.secondsLeft = 0;
    setSimPrompt("Session baslat, pattern yakala, skorla otomatik resolve et.");
    renderSimStats();
  }

  function pickSimAction() {
    const pool = ["strike", "guard", "charge"];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function applySimInput(action) {
    if (state.v3.session && String(state.v3.session.status || "") === "active") {
      enqueueArenaAction(action)
        .then(async () => {
          const activeSession = state.v3.session;
          if (!activeSession) {
            return;
          }
          const actionCount = asNum(activeSession.action_count);
          const minResolve = Math.max(6, asNum(activeSession.state?.resolve_min_actions || 6));
          if (actionCount >= minResolve) {
            const resolved = await resolveArenaSession();
            const outcome = String(resolved?.outcome || resolved?.session?.result?.outcome || "near");
            showToast(`Auth resolve: ${outcome.toUpperCase()}`);
            triggerArenaPulse(outcome === "win" ? "reveal" : outcome === "near" ? "balanced" : "aggressive", {
              action,
              label: `ARENA RESOLVE ${String(outcome || "near").toUpperCase()}`
            });
            await loadBootstrap();
          }
        })
        .catch(showError);
      return;
    }

    if (!state.sim.active || !state.sim.awaiting) {
      return;
    }

    const good = action === state.sim.expected;
    if (good) {
      state.sim.hits += 1;
      state.sim.combo += 1;
      state.sim.score += 8 + Math.min(12, state.sim.combo * 2);
      setSimPrompt(`Perfect ${action.toUpperCase()} +${8 + Math.min(12, state.sim.combo * 2)}`, "ok");
      triggerArenaPulse(action === "strike" ? "aggressive" : action === "guard" ? "safe" : "balanced", {
        action,
        label: `SIM ${normalizePvpInputLabel(action)}`
      });
    } else {
      state.sim.misses += 1;
      state.sim.combo = 0;
      state.sim.score = Math.max(0, state.sim.score - 6);
      setSimPrompt(`Miss! Beklenen: ${state.sim.expected.toUpperCase()}`, "hot");
    }

    state.sim.awaiting = false;
    state.sim.expected = "";
    renderSimStats();
  }

  function simModeFromScore(score) {
    if (score >= 95) return "aggressive";
    if (score >= 45) return "balanced";
    return "safe";
  }

  async function ensureActiveAttemptForSimulator() {
    if (state.data?.attempts?.active) {
      return true;
    }

    let offer = state.data?.offers?.[0] || null;
    if (!offer) {
      await rerollTasks();
      offer = state.data?.offers?.[0] || null;
    }
    if (!offer) {
      return false;
    }

    await performAction("accept_offer", { offer_id: Number(offer.id) });
    return Boolean(state.data?.attempts?.active);
  }

  async function settleSimulation() {
    const mode = simModeFromScore(state.sim.score);
    const score = state.sim.score;
    setSimPrompt(`Resolve: ${mode.toUpperCase()} | skor ${score}`, "ok");
    showToast(`Simulator sonucu: ${mode} (${score})`);

    const ok = await ensureActiveAttemptForSimulator();
    if (!ok) {
      showToast("Simulator: aktif gorev acilamadi.", true);
      return;
    }

    await performAction("complete_latest", { mode });
    try {
      await performAction("reveal_latest");
    } catch (err) {
      const msg = String(err?.message || "");
      if (!["no_revealable_attempt", "attempt_not_ready"].includes(msg)) {
        throw err;
      }
    }

    const arenaReady = state.data?.arena?.ready !== false;
    const rc = asNum(state.data?.balances?.RC);
    const ticket = asNum(state.data?.arena?.ticket_cost_rc || 1);
    if (arenaReady && score >= 115 && rc >= ticket) {
      await performAction("arena_raid", { mode });
    }
  }

  function pulseSimulation() {
    if (!state.sim.active) {
      return;
    }
    if (state.sim.awaiting) {
      state.sim.misses += 1;
      state.sim.combo = 0;
      state.sim.score = Math.max(0, state.sim.score - 4);
      setSimPrompt(`Gec kaldin!`, "hot");
    }

    const next = pickSimAction();
    state.sim.expected = next;
    state.sim.awaiting = true;
    setSimPrompt(`Simdi: ${next.toUpperCase()}`, "hot");
    renderSimStats();

    state.sim.pulseTimer = setTimeout(() => {
      if (!state.sim.active) return;
      if (state.sim.awaiting && state.sim.expected === next) {
        state.sim.misses += 1;
        state.sim.combo = 0;
        state.sim.score = Math.max(0, state.sim.score - 4);
        state.sim.awaiting = false;
        state.sim.expected = "";
        setSimPrompt(`Timeout!`, "hot");
        renderSimStats();
      }
    }, 950);
  }

  async function startSimulation() {
    if (state.v3.session && String(state.v3.session.status || "") === "active") {
      const actionCount = asNum(state.v3.session.action_count);
      if (actionCount < 6) {
        showToast(`Auth session aktif. En az ${6 - actionCount} hamle daha gerekli.`, true);
        return;
      }
      const resolved = await resolveArenaSession();
      const outcome = String(resolved?.outcome || resolved?.session?.result?.outcome || "near");
      showToast(`Auth resolve: ${outcome.toUpperCase()}`);
      triggerArenaPulse(outcome === "win" ? "reveal" : outcome === "near" ? "balanced" : "aggressive", {
        label: `SIM RESOLVE ${String(outcome || "near").toUpperCase()}`
      });
      await loadBootstrap();
      return;
    }

    if (state.v3.arenaAuthAvailable !== false) {
      try {
        const suggested = chooseModeByRisk(state.data?.risk_score);
        await startArenaSession(suggested);
        showToast("Auth session basladi");
        triggerArenaPulse("info", { label: "AUTH SESSION START" });
        return;
      } catch (err) {
        const message = String(err?.message || "");
        if (
          message.includes("arena_auth_disabled") ||
          message.includes("arena_session_tables_missing") ||
          message.includes("session_not_active")
        ) {
          state.v3.arenaAuthAvailable = false;
        } else {
          throw err;
        }
      }
    }

    if (state.sim.active) {
      return;
    }
    resetSimState();
    state.sim.active = true;
    state.sim.secondsLeft = 20;
    renderSimStats();
    setSimPrompt("Combat session aktif. Patternleri yakala.");

    pulseSimulation();
    state.sim.timer = setInterval(async () => {
      state.sim.secondsLeft -= 1;
      if (state.sim.secondsLeft <= 0) {
        clearInterval(state.sim.timer);
        state.sim.timer = null;
        state.sim.active = false;
        state.sim.awaiting = false;
        state.sim.expected = "";
        renderSimStats();
        try {
          await settleSimulation();
        } catch (err) {
          showError(err);
        }
        return;
      }

      if (state.sim.secondsLeft % 2 === 0) {
        pulseSimulation();
      } else {
        renderSimStats();
      }
    }, 1000);
  }

  function commandForAction(action, payload = {}) {
    if (action === "open_tasks") return "/tasks";
    if (action === "open_daily") return "/daily";
    if (action === "open_kingdom") return "/kingdom";
    if (action === "open_wallet") return "/wallet";
    if (action === "open_token") return "/token";
    if (action === "open_war") return "/war";
    if (action === "open_nexus") return "/nexus";
    if (action === "open_contract") return "/contract";
    if (action === "open_missions") return "/missions";
    if (action === "open_leaderboard") return "/leaderboard";
    if (action === "open_pvp") return "/play";
    if (action === "open_play") return "/play";
    if (action === "open_status") return "/status";
    if (action === "open_payout") return "/payout";
    if (action === "complete_latest") return `/finish ${payload.mode || "balanced"}`;
    if (action === "reveal_latest") return "/reveal";
    if (action === "accept_offer") return "/tasks";
    if (action === "claim_mission") return "/missions";
    if (action === "arena_raid") return `/raid ${payload.mode || "balanced"}`;
    if (action === "arena_leaderboard") return "/arena_rank";
    if (action === "mint_token") return `/mint ${payload.amount || ""}`.trim();
    if (action === "buy_token") return `/buytoken ${payload.usd_amount || 5} ${payload.chain || "TON"}`;
    if (action === "submit_token_tx") return `/tx ${payload.request_id || "<id>"} ${payload.tx_hash || "<tx>"}`;
    return "/help";
  }

  async function copyToClipboard(text) {
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
      return false;
    }
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      return false;
    }
  }

  function buildPacket(action, extra = {}) {
    return {
      action,
      request_id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      client_ts: Date.now(),
      ...extra
    };
  }

  function setClientState(nextState) {
    const allowed = new Set(["idle", "task", "combat", "reveal", "warning"]);
    const normalized = allowed.has(String(nextState || "").toLowerCase())
      ? String(nextState || "").toLowerCase()
      : "idle";
    state.v3.appState = normalized;
    document.body.dataset.appState = normalized;
  }

  function syncArenaSessionUi(session) {
    state.v3.session = session || null;
    if (!session) {
      setClientState("idle");
      return;
    }
    const status = String(session.status || "active");
    if (status === "resolved") {
      setClientState("reveal");
    } else if (status === "active") {
      setClientState("combat");
    } else {
      setClientState("warning");
    }

    const expected = String(session.next_expected_action || "").toUpperCase();
    const score = asNum(session.score);
    const combo = asNum(session.combo_max);
    const hits = asNum(session.hits);
    const misses = asNum(session.misses);
    const ttl = asNum(session.ttl_sec_left);
    byId("simTimer").textContent = status === "active" ? `TTL ${ttl}s` : String(status || "hazir").toUpperCase();
    byId("simPrompt").textContent =
      status === "active"
        ? `Auth Session #${asNum(session.session_id)} | Beklenen: ${expected || "-"}`
        : `Session ${String(status || "idle").toUpperCase()} | Resolve hazir`;
    byId("simStats").textContent = `Skor ${score} | Combo ${combo} | Hit ${hits} | Miss ${misses}`;
    byId("simStartBtn").disabled = status === "active";
    const canInput = status === "active";
    byId("simStrikeBtn").disabled = !canInput;
    byId("simGuardBtn").disabled = !canInput;
    byId("simChargeBtn").disabled = !canInput;
  }

  async function fetchArenaSessionState(sessionRef = "") {
    const query = new URLSearchParams({
      uid: state.auth.uid,
      ts: state.auth.ts,
      sig: state.auth.sig
    });
    if (sessionRef) {
      query.set("session_ref", sessionRef);
    }
    const t0 = performance.now();
    const res = await fetch(`/webapp/api/arena/session/state?${query.toString()}`);
    markLatency(performance.now() - t0);
    const payload = await res.json();
    if (!res.ok || !payload.success) {
      const error = new Error(payload.error || `arena_session_state_failed:${res.status}`);
      error.code = res.status;
      throw error;
    }
    renewAuth(payload);
    state.v3.arenaAuthAvailable = true;
    const session = payload.data?.session || null;
    syncArenaSessionUi(session);
    return session;
  }

  async function startArenaSession(modeSuggested = "balanced") {
    const t0 = performance.now();
    const res = await fetch("/webapp/api/arena/session/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: state.auth.uid,
        ts: state.auth.ts,
        sig: state.auth.sig,
        request_id: `webapp_session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        mode_suggested: modeSuggested
      })
    });
    markLatency(performance.now() - t0);
    const payload = await res.json();
    if (!res.ok || !payload.success) {
      const error = new Error(payload.error || `arena_session_start_failed:${res.status}`);
      error.code = res.status;
      throw error;
    }
    renewAuth(payload);
    state.v3.arenaAuthAvailable = true;
    const session = payload.data?.session || null;
    syncArenaSessionUi(session);
    return session;
  }

  async function postArenaSessionAction(inputAction, queuedAt) {
    const session = state.v3.session;
    if (!session || !session.session_ref) {
      throw new Error("session_not_found");
    }
    const actionSeq = asNum(session.action_count) + 1;
    const latencyMs = Math.max(0, Date.now() - Number(queuedAt || Date.now()));
    const t0 = performance.now();
    const res = await fetch("/webapp/api/arena/session/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: state.auth.uid,
        ts: state.auth.ts,
        sig: state.auth.sig,
        session_ref: session.session_ref,
        action_seq: actionSeq,
        input_action: String(inputAction || "").toLowerCase(),
        latency_ms: latencyMs,
        client_ts: Date.now()
      })
    });
    markLatency(performance.now() - t0);
    const payload = await res.json();
    if (!res.ok || !payload.success) {
      const error = new Error(payload.error || `arena_session_action_failed:${res.status}`);
      error.code = res.status;
      throw error;
    }
    renewAuth(payload);
    state.v3.arenaAuthAvailable = true;
    syncArenaSessionUi(payload.data?.session || null);
    return payload.data || {};
  }

  async function drainArenaQueue() {
    if (state.v3.draining) {
      return;
    }
    state.v3.draining = true;
    try {
      while (state.v3.queue.length > 0) {
        const next = state.v3.queue.shift();
        await postArenaSessionAction(next.action, next.queuedAt);
      }
    } finally {
      state.v3.draining = false;
    }
  }

  async function enqueueArenaAction(action) {
    if (!state.v3.session || !state.v3.session.session_ref) {
      throw new Error("session_not_found");
    }
    state.v3.queue.push({
      action: String(action || "").toLowerCase(),
      queuedAt: Date.now()
    });
    await drainArenaQueue();
  }

  async function resolveArenaSession() {
    const session = state.v3.session;
    if (!session || !session.session_ref) {
      throw new Error("session_not_found");
    }
    const t0 = performance.now();
    const res = await fetch("/webapp/api/arena/session/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: state.auth.uid,
        ts: state.auth.ts,
        sig: state.auth.sig,
        session_ref: session.session_ref
      })
    });
    markLatency(performance.now() - t0);
    const payload = await res.json();
    if (!res.ok || !payload.success) {
      const error = new Error(payload.error || `arena_session_resolve_failed:${res.status}`);
      error.code = res.status;
      throw error;
    }
    renewAuth(payload);
    state.v3.arenaAuthAvailable = true;
    const resolved = payload.data || {};
    syncArenaSessionUi(resolved.session || null);
    return resolved;
  }

  function raidPlanForMode(mode) {
    const key = String(mode || "balanced").toLowerCase();
    if (key === "safe") {
      return ["guard", "guard", "strike", "charge", "guard", "strike"];
    }
    if (key === "aggressive") {
      return ["strike", "strike", "charge", "strike", "charge", "strike", "guard"];
    }
    return ["strike", "guard", "charge", "strike", "guard", "charge"];
  }

  function renderRaidTracker(session) {
    const waveLine = byId("raidWaveLine");
    const waveMeter = byId("raidWaveMeter");
    const bossLine = byId("raidBossLine");
    const hpLine = byId("raidHpLine");
    const hpMeter = byId("raidHpMeter");
    const damageLine = byId("raidDamageLine");
    const tempoLine = byId("raidTempoLine");
    const tempoMeter = byId("raidTempoMeter");
    const signalLine = byId("raidSignalLine");
    if (
      !waveLine ||
      !waveMeter ||
      !bossLine ||
      !hpLine ||
      !hpMeter ||
      !damageLine ||
      !tempoLine ||
      !tempoMeter ||
      !signalLine
    ) {
      return;
    }

    if (!session) {
      state.telemetry.raidBossPressure = 0;
      state.telemetry.raidBossTone = "stable";
      waveLine.textContent = "Wave 0/0";
      bossLine.textContent = "Boss: Beklemede";
      hpLine.textContent = "HP 0%";
      damageLine.textContent = "Damage 0 | Score 0";
      tempoLine.textContent = "Action 0 | TTL 0s";
      signalLine.textContent = "Signal: Stable";
      [waveLine, hpLine, tempoLine].forEach((el) => el.removeAttribute("data-tone"));
      animateMeterWidth(waveMeter, 0, 0.24);
      animateMeterWidth(hpMeter, 0, 0.24);
      animateMeterWidth(tempoMeter, 0, 0.24);
      setMeterPalette(waveMeter, "neutral");
      setMeterPalette(hpMeter, "neutral");
      setMeterPalette(tempoMeter, "neutral");
      return;
    }

    const bossCycle = session.boss_cycle || {};
    const state = session.state || {};
    const status = String(session.status || "active").toLowerCase();
    const outcome = String(session.result?.outcome || "").toLowerCase();

    const waveTotal = Math.max(1, asNum(bossCycle.wave_total || state.wave_total || 1));
    const waveIndexRaw = Math.max(1, asNum(bossCycle.wave_index || state.wave_index || 1));
    const waveIndex = Math.min(waveTotal, waveIndexRaw);
    const waveRatio = Math.max(0, Math.min(1, waveIndex / waveTotal));

    const hpTotal = Math.max(0, asNum(bossCycle.hp_total || state.hp_total || 0));
    const hpRemaining = Math.max(0, asNum(bossCycle.hp_remaining || state.hp_remaining || 0));
    const hpRatio = hpTotal > 0 ? Math.max(0, Math.min(1, hpRemaining / hpTotal)) : 1;
    const breakRatio = 1 - hpRatio;

    const actionCount = Math.max(0, asNum(session.action_count || 0));
    const maxActions = Math.max(1, asNum(state.max_actions || 12));
    const ttlSec = Math.max(0, asNum(session.ttl_sec_left || 0));
    const ttlBase = Math.max(45, asNum(state.ttl_sec || 90));
    const ttlDrainRatio = Math.max(0, Math.min(1, 1 - ttlSec / ttlBase));
    const tempoRatio = Math.max(0, Math.min(1, actionCount / maxActions * 0.62 + ttlDrainRatio * 0.38));
    const pressure = Math.max(0, Math.min(1, breakRatio * 0.52 + tempoRatio * 0.32 + (ttlSec <= 15 ? 0.16 : 0)));

    let tone = "advantage";
    if (status === "resolved" && outcome === "loss") {
      tone = "critical";
    } else if (status === "resolved" && outcome === "win") {
      tone = "advantage";
    } else if (pressure >= 0.78) {
      tone = "critical";
    } else if (pressure >= 0.5) {
      tone = "pressure";
    }
    state.telemetry.raidBossPressure = pressure;
    state.telemetry.raidBossTone = tone;

    const bossName = String(bossCycle.boss_name || session.contract_key || "Nexus Boss");
    const bossTier = String(bossCycle.tier || state.boss_tier || "-");
    const damageDone = asNum(session.result?.damage_done || state.damage_done || 0);
    const score = asNum(session.score || 0);

    waveLine.dataset.tone = tone;
    hpLine.dataset.tone = tone;
    tempoLine.dataset.tone = tone;

    waveLine.textContent = `Wave ${waveIndex}/${waveTotal}`;
    bossLine.textContent = `Boss: ${bossName} | Tier ${bossTier}`;
    hpLine.textContent = `HP ${Math.round(hpRatio * 100)}%`;
    damageLine.textContent = `Damage ${Math.round(damageDone)} | Score ${Math.round(score)}`;
    tempoLine.textContent = `Action ${actionCount}/${maxActions} | TTL ${ttlSec}s`;

    const signal =
      tone === "critical"
        ? "Signal: Critical | Guard + window sync"
        : tone === "pressure"
          ? "Signal: Pressure | Balanced cadence"
          : "Signal: Advantage | Strike chain";
    signalLine.textContent = signal;

    animateMeterWidth(waveMeter, waveRatio * 100, 0.24);
    animateMeterWidth(hpMeter, hpRatio * 100, 0.24);
    animateMeterWidth(tempoMeter, pressure * 100, 0.24);

    setMeterPalette(waveMeter, waveRatio >= 0.75 ? "safe" : waveRatio >= 0.4 ? "balanced" : "neutral");
    setMeterPalette(hpMeter, hpRatio >= 0.75 ? "aggressive" : hpRatio >= 0.35 ? "balanced" : "safe");
    setMeterPalette(tempoMeter, tone === "critical" ? "critical" : tone === "pressure" ? "aggressive" : "balanced");
  }

  function syncRaidSessionUi(session) {
    state.v3.raidSession = session || null;
    renderRaidTracker(session || null);
    if (!session) {
      return;
    }
    const status = String(session.status || "active");
    if (status === "resolved") {
      const result = session.result || {};
      const outcome = String(result.outcome || "resolved").toUpperCase();
      const reward = result.reward || {};
      updateArenaStatus(
        `Raid ${outcome} | +${asNum(reward.sc)} SC +${asNum(reward.rc)} RC`,
        outcome === "LOSS" ? "warn" : "info"
      );
      return;
    }
    const ttl = Math.max(0, asNum(session.ttl_sec_left || 0));
    const nextAction = String(session.next_expected_action || "-").toUpperCase();
    updateArenaStatus(`Raid Aktif | ${ttl}s | ${nextAction}`, "warn");
  }

  async function fetchRaidSessionState(sessionRef = "") {
    const query = new URLSearchParams({
      uid: state.auth.uid,
      ts: state.auth.ts,
      sig: state.auth.sig
    });
    if (sessionRef) {
      query.set("session_ref", sessionRef);
    }
    const t0 = performance.now();
    const res = await fetch(`/webapp/api/arena/raid/session/state?${query.toString()}`);
    markLatency(performance.now() - t0);
    const payload = await res.json();
    if (!res.ok || !payload.success) {
      const error = new Error(payload.error || `raid_session_state_failed:${res.status}`);
      error.code = res.status;
      throw error;
    }
    renewAuth(payload);
    state.v3.raidAuthAvailable = true;
    const session = payload.data?.session || null;
    syncRaidSessionUi(session);
    return session;
  }

  async function startRaidSession(modeSuggested = "balanced") {
    const t0 = performance.now();
    const res = await fetch("/webapp/api/arena/raid/session/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: state.auth.uid,
        ts: state.auth.ts,
        sig: state.auth.sig,
        request_id: `webapp_raid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        mode_suggested: modeSuggested
      })
    });
    markLatency(performance.now() - t0);
    const payload = await res.json();
    if (!res.ok || !payload.success) {
      const error = new Error(payload.error || `raid_session_start_failed:${res.status}`);
      error.code = res.status;
      throw error;
    }
    renewAuth(payload);
    state.v3.raidAuthAvailable = true;
    const session = payload.data?.session || null;
    syncRaidSessionUi(session);
    return session;
  }

  async function postRaidSessionAction(inputAction, queuedAt) {
    const session = state.v3.raidSession;
    if (!session || !session.session_ref) {
      throw new Error("raid_session_not_found");
    }
    const actionSeq = asNum(session.action_count) + 1;
    const latencyMs = Math.max(0, Date.now() - Number(queuedAt || Date.now()));
    const t0 = performance.now();
    const res = await fetch("/webapp/api/arena/raid/session/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: state.auth.uid,
        ts: state.auth.ts,
        sig: state.auth.sig,
        session_ref: session.session_ref,
        action_seq: actionSeq,
        input_action: String(inputAction || "").toLowerCase(),
        latency_ms: latencyMs,
        client_ts: Date.now()
      })
    });
    markLatency(performance.now() - t0);
    const payload = await res.json();
    if (!res.ok || !payload.success) {
      const error = new Error(payload.error || `raid_session_action_failed:${res.status}`);
      error.code = res.status;
      throw error;
    }
    renewAuth(payload);
    state.v3.raidAuthAvailable = true;
    syncRaidSessionUi(payload.data?.session || null);
    return payload.data || {};
  }

  async function resolveRaidSession() {
    const session = state.v3.raidSession;
    if (!session || !session.session_ref) {
      throw new Error("raid_session_not_found");
    }
    const t0 = performance.now();
    const res = await fetch("/webapp/api/arena/raid/session/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: state.auth.uid,
        ts: state.auth.ts,
        sig: state.auth.sig,
        session_ref: session.session_ref
      })
    });
    markLatency(performance.now() - t0);
    const payload = await res.json();
    if (!res.ok || !payload.success) {
      const error = new Error(payload.error || `raid_session_resolve_failed:${res.status}`);
      error.code = res.status;
      throw error;
    }
    renewAuth(payload);
    state.v3.raidAuthAvailable = true;
    const resolved = payload.data || {};
    syncRaidSessionUi(resolved.session || null);
    return resolved;
  }

  async function runAuthoritativeRaid(mode = "balanced") {
    const session = await startRaidSession(mode);
    if (!session || !session.session_ref) {
      throw new Error("raid_session_not_found");
    }
    const actionPlan = raidPlanForMode(mode);
    for (const action of actionPlan) {
      await postRaidSessionAction(action, Date.now());
    }
    const resolved = await resolveRaidSession();
    const result = resolved.result || {};
    const reward = result.reward || {};
    const outcome = String(result.outcome || "resolved");
    showToast(`Raid ${outcome} | +${asNum(reward.sc)} SC +${asNum(reward.rc)} RC`);
    triggerArenaPulse(mode, {
      label: `RAID ${String(outcome || "resolved").toUpperCase()}`
    });
    await loadBootstrap();
    return resolved;
  }

  function formatTimelineClock(value) {
    const stamp = Number(value || Date.now());
    const date = new Date(stamp);
    if (Number.isNaN(date.getTime())) {
      return "--:--:--";
    }
    return date.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  function normalizePvpInputLabel(value) {
    const clean = String(value || "").toLowerCase();
    if (clean === "strike") return "STRIKE";
    if (clean === "guard") return "GUARD";
    if (clean === "charge") return "CHARGE";
    if (clean === "resolve") return "RESOLVE";
    if (clean === "tick") return "TICK";
    return clean ? clean.toUpperCase() : "ACTION";
  }

  function actionToneForInput(value) {
    const clean = String(value || "").toLowerCase();
    if (clean === "strike") return "aggressive";
    if (clean === "guard") return "safe";
    if (clean === "charge") return "balanced";
    if (clean === "resolve") return "reveal";
    return "info";
  }

  function pvpReplayTone(inputAction, accepted = true) {
    const clean = String(inputAction || "").toLowerCase();
    if (!accepted) {
      return "reject";
    }
    if (clean === "strike") return "strike";
    if (clean === "guard") return "guard";
    if (clean === "charge") return "charge";
    if (clean === "resolve") return "resolve";
    return "guard";
  }

  function renderPvpReplayStrip() {
    const host = byId("pvpReplayStrip");
    if (!host) {
      return;
    }
    host.innerHTML = "";
    const replay = Array.isArray(state.v3.pvpReplay) ? state.v3.pvpReplay : [];
    if (!replay.length) {
      const empty = document.createElement("span");
      empty.className = "replayChip muted";
      empty.textContent = "Replay bos";
      host.appendChild(empty);
      return;
    }
    replay.slice(0, PVP_REPLAY_LIMIT).forEach((chip) => {
      const el = document.createElement("span");
      const tone = String(chip.tone || "guard");
      el.className = `replayChip ${tone}`;
      const scoreDelta = asNum(chip.scoreDelta || 0);
      const scoreSign = scoreDelta > 0 ? `+${scoreDelta}` : `${scoreDelta}`;
      const reason = String(chip.reason || "").trim().replace(/_/g, " ");
      const suffix = chip.accepted ? ` ${scoreSign}` : ` MISS${reason ? ` (${reason})` : ""}`;
      el.textContent = `${normalizePvpInputLabel(chip.input)} #${asNum(chip.seq || 0)}${suffix}`;
      host.appendChild(el);
    });
  }

  function renderPvpTimeline() {
    const host = byId("pvpTimelineList");
    const badge = byId("pvpTimelineBadge");
    if (!host) {
      return;
    }
    host.innerHTML = "";
    const timeline = Array.isArray(state.v3.pvpTimeline) ? state.v3.pvpTimeline : [];
    if (!timeline.length) {
      const empty = document.createElement("li");
      empty.className = "muted";
      empty.textContent = "Timeline bekleniyor";
      host.appendChild(empty);
      if (badge) {
        badge.textContent = "0 event";
        badge.className = "badge info";
      }
      return;
    }
    timeline.slice(0, PVP_TIMELINE_LIMIT).forEach((row, index) => {
      const item = document.createElement("li");
      const tone = String(row.tone || "tick");
      item.className = `pvpTimelineRow ${tone}`;
      const title = document.createElement("strong");
      title.textContent = String(row.label || "Event");
      const meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = `${formatTimelineClock(row.ts)} | ${String(row.meta || "-")}`;
      item.appendChild(title);
      item.appendChild(meta);
      host.appendChild(item);
      if (index === 0) {
        const gsap = getGsap();
        if (gsap && !state.ui.reducedMotion) {
          gsap.fromTo(
            item,
            { opacity: 0, y: -8, scale: 0.98 },
            { opacity: 1, y: 0, scale: 1, duration: 0.22, ease: "power2.out" }
          );
        }
      }
    });
    if (badge) {
      const latest = timeline[0];
      badge.textContent = `${timeline.length} event`;
      badge.className = String(latest?.tone || "") === "reject" ? "badge warn" : "badge info";
    }
  }

  function appendPvpTimelineEntry(entry) {
    if (!entry || typeof entry !== "object") {
      return;
    }
    const key = String(entry.key || "");
    if (key && state.v3.pvpTimeline.some((row) => String(row.key || "") === key)) {
      return;
    }
    const row = {
      key: key || `row:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
      tone: String(entry.tone || "tick"),
      label: String(entry.label || "Event"),
      meta: String(entry.meta || "-"),
      ts: Number(entry.ts || Date.now())
    };
    state.v3.pvpTimeline.unshift(row);
    if (state.v3.pvpTimeline.length > PVP_TIMELINE_LIMIT) {
      state.v3.pvpTimeline.splice(PVP_TIMELINE_LIMIT);
    }
    renderPvpTimeline();
    const tickerMeta = String(row.meta || "-").split("|")[0].trim();
    pushCombatTicker(
      `${row.label} - ${tickerMeta}`,
      row.tone === "reject" ? "aggressive" : row.tone === "resolve" ? "reveal" : "info"
    );
    const toneMap = {
      reject: "aggressive",
      resolve: "reveal",
      action: "balanced"
    };
    const pulseTone = toneMap[String(row.tone || "").toLowerCase()];
    const now = Date.now();
    if (pulseTone && now - asNum(state.ui.lastTimelinePulseAt || 0) > 680) {
      state.ui.lastTimelinePulseAt = now;
      triggerArenaPulse(pulseTone, { label: String(row.label || "PVP EVENT").slice(0, 30) });
    }
  }

  function normalizePulseTone(value) {
    const clean = String(value || "info").toLowerCase();
    if (clean === "safe" || clean === "balanced" || clean === "aggressive" || clean === "reveal") {
      return clean;
    }
    return "info";
  }

  function normalizeCombatAction(action) {
    const clean = String(action || "").toLowerCase();
    if (clean === "strike" || clean === "guard" || clean === "charge" || clean === "resolve") {
      return clean;
    }
    return "pulse";
  }

  function combatActionTone(action, accepted = true, tone = "info") {
    if (accepted === false) {
      return "reject";
    }
    const normalized = normalizeCombatAction(action);
    if (normalized === "pulse") {
      return normalizePulseTone(tone);
    }
    return normalized;
  }

  function renderCombatHudPanel() {
    const panelRoot = byId("combatHudPanel") || document.querySelector(".combatHudPanel");
    const chainLine = byId("combatChainLine");
    const chainTrail = byId("combatChainTrail");
    const reactorLine = byId("pulseReactorLine");
    const reactorMeter = byId("pulseReactorMeter");
    const reactorHint = byId("pulseReactorHint");
    const strategyLine = byId("pulseStrategyLine");
    const timelineLine = byId("combatTimelineLine");
    const timelineBadge = byId("combatTimelineBadge");
    const timelineMeter = byId("combatTimelineMeter");
    const timelineHint = byId("combatTimelineHint");
    const timelineNodeStrike = byId("combatTimelineNodeStrike");
    const timelineNodeGuard = byId("combatTimelineNodeGuard");
    const timelineNodeCharge = byId("combatTimelineNodeCharge");
    const fluxLine = byId("combatFluxLine");
    const fluxHint = byId("combatFluxHint");
    const fluxSelfMeter = byId("combatFluxSelfMeter");
    const fluxOppMeter = byId("combatFluxOppMeter");
    const fluxSyncMeter = byId("combatFluxSyncMeter");
    const cadenceLine = byId("combatCadenceLine");
    const cadenceHint = byId("combatCadenceHint");
    const cadenceStrikeMeter = byId("combatCadenceStrikeMeter");
    const cadenceGuardMeter = byId("combatCadenceGuardMeter");
    const cadenceChargeMeter = byId("combatCadenceChargeMeter");
    const bossPressureLine = byId("bossPressureLine");
    const bossPressureMeter = byId("bossPressureMeter");
    const chain = Array.isArray(state.v3.combatChain) ? state.v3.combatChain : [];
    const energy = clamp(asNum(state.v3.combatEnergy || 0), 0, 100);
    const tone = normalizePulseTone(state.v3.pulseTone || "info");
    const label = String(state.v3.pulseLabel || "NEXUS READY").slice(0, 26);
    const diagnostics = state.v3.pvpTickMeta?.diagnostics || {};
    const queuePressure = clamp(asNum(diagnostics.queue_pressure || 0), 0, 1);
    const urgency = String(diagnostics.urgency || state.arena?.pvpUrgency || "steady").toLowerCase();
    const recommendation = String(diagnostics.recommendation || state.arena?.pvpRecommendation || "balanced").toUpperCase();
    const selfMomentum = clamp(asNum(state.arena?.pvpMomentumSelf ?? 0.5), 0, 1);
    const oppMomentum = clamp(asNum(state.arena?.pvpMomentumOpp ?? 0.5), 0, 1);
    const syncDelta = Math.round((selfMomentum - oppMomentum) * 100);
    const syncState = syncDelta >= 18 ? "ADV" : syncDelta <= -18 ? "DEF" : "EVEN";
    const expectedActionRaw = String(
      state.v3.pvpSession?.next_expected_action || state.v3.session?.next_expected_action || state.sim.expected || ""
    ).toLowerCase();
    const expectedAction =
      expectedActionRaw === "strike" || expectedActionRaw === "guard" || expectedActionRaw === "charge"
        ? expectedActionRaw
        : "";
    const latest = chain[0] || null;
    const latestAction = latest ? normalizeCombatAction(latest.action) : "";
    const latestAccepted = latest ? latest.accepted !== false : true;
    const actionCounts = { strike: 0, guard: 0, charge: 0 };
    chain.slice(0, COMBAT_CHAIN_LIMIT).forEach((row) => {
      const key = normalizeCombatAction(row.action);
      if (Object.prototype.hasOwnProperty.call(actionCounts, key)) {
        actionCounts[key] += 1;
      }
    });
    const pressureRatio = clamp(
      energy / 100 * 0.42 + asNum(state.telemetry.threatRatio || 0) * 0.32 + queuePressure * 0.26,
      0,
      1
    );
    const raidSession = state.v3.raidSession || null;
    const raidState = raidSession?.state || {};
    const bossCycle = raidSession?.boss_cycle || {};
    const raidHpTotal = Math.max(0, asNum(bossCycle.hp_total || raidState.hp_total || 0));
    const raidHpRemaining = Math.max(0, asNum(bossCycle.hp_remaining || raidState.hp_remaining || 0));
    const raidHpRatio = raidHpTotal > 0 ? clamp(raidHpRemaining / raidHpTotal, 0, 1) : 1;
    const raidActionCount = Math.max(0, asNum(raidSession?.action_count || 0));
    const raidActionMax = Math.max(1, asNum(raidState.max_actions || 12));
    const raidTtlSec = Math.max(0, asNum(raidSession?.ttl_sec_left || 0));
    const raidTtlBase = Math.max(45, asNum(raidState.ttl_sec || 90));
    const raidTempo = clamp(raidActionCount / raidActionMax * 0.62 + clamp(1 - raidTtlSec / raidTtlBase, 0, 1) * 0.38, 0, 1);
    const bossPressure = raidSession
      ? clamp((1 - raidHpRatio) * 0.5 + raidTempo * 0.32 + pressureRatio * 0.18, 0, 1)
      : clamp(pressureRatio * 0.44 + queuePressure * 0.12, 0, 1);
    const bossTone = bossPressure >= 0.78 ? "critical" : bossPressure >= 0.46 ? "pressure" : "stable";
    state.telemetry.raidBossPressure = bossPressure;
    state.telemetry.raidBossTone = bossTone;

    const bridgeLatestAgeSec = latest ? Math.max(0, Math.round((Date.now() - asNum(latest.ts || Date.now())) / 1000)) : 0;
    const bridgeChainLineText = !latest
      ? "CHAIN IDLE"
      : `x${chain.length} | ${String(latest.action || "pulse").toUpperCase()} ${latestAccepted ? "LOCKED" : "REJECT"} | ${bridgeLatestAgeSec}s`;
    const bridgeChainTrail = chain.slice(0, COMBAT_CHAIN_LIMIT).map((row, index) => ({
      action: String(row.action || "pulse"),
      accepted: row.accepted !== false,
      tone: combatActionTone(row.action, row.accepted, row.tone),
      isLatest: index === 0
    }));
    const bridgeReactorPalette =
      tone === "aggressive"
        ? pressureRatio >= 0.78
          ? "critical"
          : "aggressive"
        : tone === "safe"
          ? "safe"
          : tone === "balanced"
            ? "balanced"
            : tone === "reveal"
              ? "critical"
              : pressureRatio >= 0.72
                ? "critical"
                : pressureRatio >= 0.52
                  ? "aggressive"
                  : "neutral";
    const bridgeHintMap = {
      safe: "Safe pencere: kontrollu cikis avantajli.",
      balanced: "Denge aktif: ritmi koru, combo biriktir.",
      aggressive: "Baski artiyor: guard veya hizli strike sec.",
      reveal: "Reveal penceresi acik: odul kilidini kapat.",
      info: "Nexus pulse bekleniyor."
    };
    const bridgeStrategyLineText = `Sync ${syncState} ${syncDelta > 0 ? `+${syncDelta}` : syncDelta} | Urgency ${urgency.toUpperCase()} | ${recommendation}`;
    const bridgeExpectedLine = expectedAction ? expectedAction.toUpperCase() : "AUTO";
    const bridgeLatestLine = latestAction ? `${latestAction.toUpperCase()} ${latestAccepted ? "OK" : "MISS"}` : "CHAIN IDLE";
    const bridgeTimelineLineText = `Beklenen: ${bridgeExpectedLine} | Son: ${bridgeLatestLine} | x${chain.length}`;
    const bridgeTimelineBadgeText = latest && !latestAccepted ? "MISS" : urgency.toUpperCase();
    const bridgeTimelineWarn = urgency === "critical" || (latest && !latestAccepted);
    const bridgeTimelineRatio = clamp(chain.length / Math.max(6, COMBAT_CHAIN_LIMIT) * 0.58 + energy / 100 * 0.42, 0, 1);
    let bridgeTimelinePalette = "neutral";
    if (latest && !latestAccepted) {
      bridgeTimelinePalette = "critical";
    } else if (pressureRatio >= 0.74) {
      bridgeTimelinePalette = "aggressive";
    } else if (expectedAction === "guard") {
      bridgeTimelinePalette = "safe";
    } else if (expectedAction === "charge") {
      bridgeTimelinePalette = "balanced";
    }
    const bridgeQueuePct = Math.round(queuePressure * 100);
    const bridgeTimelineHint = `Queue ${bridgeQueuePct}% | Sync ${syncState} ${syncDelta > 0 ? `+${syncDelta}` : syncDelta} | Oneri ${recommendation}`;
    const bridgeSyncGap = Math.abs(syncDelta);
    const bridgePressurePct = Math.round(pressureRatio * 100);
    const bridgeFluxHintMap = {
      critical: "Kritik pencere: queue sifirla, savunma odakli tek hamle resolve uygula.",
      pressure: "Baski artiyor: guard/charge dengesi ile zinciri koru.",
      advantage: "Avantaj sende: expected aksiyonla combo kilidi olustur.",
      steady: "Denge modu: riski dusuk tut, ritmi kontrollu surdur."
    };
    const bridgeFluxHintText = `${bridgeFluxHintMap[urgency] || bridgeFluxHintMap.steady} Gap ${bridgeSyncGap}% | Basinc ${bridgePressurePct}%`;
    const bridgeSyncRatio = clamp(1 - Math.abs(syncDelta) / 100, 0, 1);
    const bridgeCadenceWindow = Math.max(1, Math.min(COMBAT_CHAIN_LIMIT, 6));
    const bridgeStrikeRatio = clamp(actionCounts.strike / bridgeCadenceWindow + (expectedAction === "strike" ? 0.16 : 0), 0, 1);
    const bridgeGuardRatio = clamp(actionCounts.guard / bridgeCadenceWindow + (expectedAction === "guard" ? 0.16 : 0), 0, 1);
    const bridgeChargeRatio = clamp(actionCounts.charge / bridgeCadenceWindow + (expectedAction === "charge" ? 0.16 : 0), 0, 1);
    const bridgeDominantAction = (() => {
      if (bridgeStrikeRatio >= bridgeGuardRatio && bridgeStrikeRatio >= bridgeChargeRatio) {
        return "STRIKE";
      }
      if (bridgeGuardRatio >= bridgeChargeRatio) {
        return "GUARD";
      }
      return "CHARGE";
    })();
    const bridgeCadenceTone =
      !latestAccepted && latestAction
        ? "critical"
        : urgency === "critical"
          ? "critical"
          : urgency === "spike" || queuePressure >= 0.66
            ? "pressure"
            : bridgeDominantAction === (expectedAction || bridgeDominantAction).toUpperCase()
              ? "advantage"
              : "steady";
    const bridgeFocus = expectedAction ? expectedAction.toUpperCase() : bridgeDominantAction;
    const bridgeCadenceHintMap = {
      critical: `MISS algilandi: ${bridgeFocus} ile ritmi geri al, resolve penceresini koru.`,
      pressure: `Baski yuksek (${bridgeQueuePct}%): ${bridgeFocus} odagi ile cadence'i stabil tut.`,
      advantage: `Avantaj aktif: ${bridgeFocus} zinciri ile combo carpanini buyut.`,
      steady: `Stabil tempo: ${bridgeFocus} odakli devam edip enerjiyi dengede tut.`
    };
    const bridgeBossHpPct = Math.round(raidHpRatio * 100);
    const bridgeBossLabel = bossTone === "critical" ? "CRITICAL" : bossTone === "pressure" ? "PRESSURE" : "STABLE";
    const bridgeBossLineText = !raidSession ? "STABLE | HP -- | TTL --" : `${bridgeBossLabel} | HP ${bridgeBossHpPct}% | TTL ${raidTtlSec}s`;

    const combatHudBridge = getCombatHudBridge();
    if (combatHudBridge) {
      try {
        const handled = combatHudBridge.render({
          pressureClass:
            pressureRatio >= 0.78
              ? "pressure-critical"
              : pressureRatio >= 0.56
                ? "pressure-high"
                : pressureRatio >= 0.34
                  ? "pressure-medium"
                  : "pressure-low",
          urgency,
          recommendation,
          chainLineText: bridgeChainLineText,
          chainTrail: bridgeChainTrail,
          energy: Math.round(energy),
          reactorLineText: `${String(label || "NEXUS READY").toUpperCase()} | ${Math.round(energy)}%`,
          reactorHintText: bridgeHintMap[tone] || bridgeHintMap.info,
          reactorPalette: bridgeReactorPalette,
          strategyLineText: bridgeStrategyLineText,
          timelineLineText: bridgeTimelineLineText,
          timelineBadgeText: bridgeTimelineBadgeText,
          timelineBadgeWarn: bridgeTimelineWarn,
          timelineMeterPct: Math.round(bridgeTimelineRatio * 100),
          timelineHintText: bridgeTimelineHint,
          timelinePalette: bridgeTimelinePalette,
          expectedAction,
          latestAction,
          latestAccepted,
          actionCounts,
          fluxLineText: `SELF ${Math.round(selfMomentum * 100)} | OPP ${Math.round(oppMomentum * 100)} | ${syncState}`,
          fluxHintText: bridgeFluxHintText,
          fluxTone: urgency,
          fluxSelfPct: Math.round(selfMomentum * 100),
          fluxOppPct: Math.round(oppMomentum * 100),
          fluxSyncPct: Math.round(bridgeSyncRatio * 100),
          fluxSelfPalette: selfMomentum >= oppMomentum ? "balanced" : "safe",
          fluxOppPalette: oppMomentum > selfMomentum ? "aggressive" : "neutral",
          fluxSyncPalette: bridgeSyncRatio >= 0.68 ? "safe" : bridgeSyncRatio >= 0.44 ? "balanced" : "critical",
          cadenceLineText: `STR ${Math.round(bridgeStrikeRatio * 100)} | GRD ${Math.round(bridgeGuardRatio * 100)} | CHG ${Math.round(bridgeChargeRatio * 100)}`,
          cadenceHintText: bridgeCadenceHintMap[bridgeCadenceTone] || bridgeCadenceHintMap.steady,
          cadenceTone: bridgeCadenceTone,
          cadenceStrikePct: Math.round(bridgeStrikeRatio * 100),
          cadenceGuardPct: Math.round(bridgeGuardRatio * 100),
          cadenceChargePct: Math.round(bridgeChargeRatio * 100),
          cadenceStrikePalette: expectedAction === "strike" ? "aggressive" : "neutral",
          cadenceGuardPalette: expectedAction === "guard" ? "safe" : "neutral",
          cadenceChargePalette: expectedAction === "charge" ? "balanced" : "neutral",
          bossLineText: bridgeBossLineText,
          bossTone,
          bossMeterPct: Math.round(bossPressure * 100),
          bossPalette: bossTone === "critical" ? "critical" : bossTone === "pressure" ? "aggressive" : "safe"
        });
        if (handled) {
          return;
        }
      } catch (err) {
        console.warn("combat-hud-bridge-render-failed", err);
      }
    }

    if (panelRoot) {
      panelRoot.classList.remove("pressure-low", "pressure-medium", "pressure-high", "pressure-critical");
      const pressureClass =
        pressureRatio >= 0.78
          ? "pressure-critical"
          : pressureRatio >= 0.56
            ? "pressure-high"
            : pressureRatio >= 0.34
              ? "pressure-medium"
              : "pressure-low";
      panelRoot.classList.add(pressureClass);
      panelRoot.dataset.urgency = urgency;
      panelRoot.dataset.recommendation = recommendation.toLowerCase();
    }
    if (chainLine) {
      const last = chain[0];
      if (!last) {
        chainLine.textContent = "CHAIN IDLE";
      } else {
        const status = last.accepted === false ? "REJECT" : "LOCKED";
        const ageSec = Math.max(0, Math.round((Date.now() - asNum(last.ts || Date.now())) / 1000));
        chainLine.textContent = `x${chain.length} | ${String(last.action || "pulse").toUpperCase()} ${status} | ${ageSec}s`;
      }
    }
    if (chainTrail) {
      chainTrail.innerHTML = "";
      if (!chain.length) {
        const empty = document.createElement("span");
        empty.className = "trailChip muted";
        empty.textContent = "bekleniyor";
        chainTrail.appendChild(empty);
      } else {
        chain.slice(0, COMBAT_CHAIN_LIMIT).forEach((row, index) => {
          const chip = document.createElement("span");
          chip.className = `trailChip ${combatActionTone(row.action, row.accepted, row.tone)}${index === 0 ? " enter" : ""}`;
          const prefix = row.accepted === false ? "x" : "+";
          chip.textContent = `${prefix}${String(row.action || "pulse").toUpperCase()}`;
          chainTrail.appendChild(chip);
        });
      }
    }
    if (reactorLine) {
      reactorLine.textContent = `${String(label || "NEXUS READY").toUpperCase()} | ${Math.round(energy)}%`;
    }
    if (reactorMeter) {
      reactorMeter.style.width = `${energy}%`;
      const reactorPalette =
        tone === "aggressive"
          ? pressureRatio >= 0.78
            ? "critical"
            : "aggressive"
          : tone === "safe"
            ? "safe"
            : tone === "balanced"
              ? "balanced"
              : tone === "reveal"
                ? "critical"
                : pressureRatio >= 0.72
                  ? "critical"
                  : pressureRatio >= 0.52
                    ? "aggressive"
                    : "neutral";
      setMeterPalette(reactorMeter, reactorPalette);
    }
    if (reactorHint) {
      const hintMap = {
        safe: "Safe pencere: kontrollu cikis avantajli.",
        balanced: "Denge aktif: ritmi koru, combo biriktir.",
        aggressive: "Baski artiyor: guard veya hizli strike sec.",
        reveal: "Reveal penceresi acik: odul kilidini kapat.",
        info: "Nexus pulse bekleniyor."
      };
      reactorHint.textContent = hintMap[tone] || hintMap.info;
    }
    if (strategyLine) {
      strategyLine.textContent = `Sync ${syncState} ${syncDelta > 0 ? `+${syncDelta}` : syncDelta} | Urgency ${urgency.toUpperCase()} | ${recommendation}`;
      strategyLine.dataset.urgency = urgency;
      strategyLine.dataset.recommendation = recommendation.toLowerCase();
    }
    if (timelineLine) {
      const expectedLine = expectedAction ? expectedAction.toUpperCase() : "AUTO";
      const latestLine = latestAction ? `${latestAction.toUpperCase()} ${latestAccepted ? "OK" : "MISS"}` : "CHAIN IDLE";
      timelineLine.textContent = `Beklenen: ${expectedLine} | Son: ${latestLine} | x${chain.length}`;
    }
    if (timelineBadge) {
      const badgeState = latest && !latestAccepted ? "MISS" : urgency.toUpperCase();
      timelineBadge.textContent = badgeState;
      timelineBadge.className = urgency === "critical" || (latest && !latestAccepted) ? "badge warn" : "badge info";
    }
    if (timelineMeter) {
      const timelineRatio = clamp(chain.length / Math.max(6, COMBAT_CHAIN_LIMIT) * 0.58 + energy / 100 * 0.42, 0, 1);
      timelineMeter.style.width = `${Math.round(timelineRatio * 100)}%`;
      let palette = "neutral";
      if (latest && !latestAccepted) {
        palette = "critical";
      } else if (pressureRatio >= 0.74) {
        palette = "aggressive";
      } else if (expectedAction === "guard") {
        palette = "safe";
      } else if (expectedAction === "charge") {
        palette = "balanced";
      }
      setMeterPalette(timelineMeter, palette);
    }
    if (timelineHint) {
      const queuePct = Math.round(queuePressure * 100);
      timelineHint.textContent = `Queue ${queuePct}% | Sync ${syncState} ${syncDelta > 0 ? `+${syncDelta}` : syncDelta} | Oneri ${recommendation}`;
    }
    if (fluxLine) {
      fluxLine.textContent = `SELF ${Math.round(selfMomentum * 100)} | OPP ${Math.round(oppMomentum * 100)} | ${syncState}`;
      fluxLine.dataset.tone = urgency;
    }
    if (fluxHint) {
      const syncGap = Math.abs(syncDelta);
      const pressurePct = Math.round(pressureRatio * 100);
      const fluxHintMap = {
        critical: "Kritik pencere: queue sifirla, savunma odakli tek hamle resolve uygula.",
        pressure: "Baski artiyor: guard/charge dengesi ile zinciri koru.",
        advantage: "Avantaj sende: expected aksiyonla combo kilidi olustur.",
        steady: "Denge modu: riski dusuk tut, ritmi kontrollu surdur."
      };
      fluxHint.textContent = `${fluxHintMap[urgency] || fluxHintMap.steady} Gap ${syncGap}% | Basinc ${pressurePct}%`;
    }
    if (fluxSelfMeter) {
      fluxSelfMeter.style.width = `${Math.round(selfMomentum * 100)}%`;
      setMeterPalette(fluxSelfMeter, selfMomentum >= oppMomentum ? "balanced" : "safe");
    }
    if (fluxOppMeter) {
      fluxOppMeter.style.width = `${Math.round(oppMomentum * 100)}%`;
      setMeterPalette(fluxOppMeter, oppMomentum > selfMomentum ? "aggressive" : "neutral");
    }
    if (fluxSyncMeter) {
      const syncRatio = clamp(1 - Math.abs(syncDelta) / 100, 0, 1);
      fluxSyncMeter.style.width = `${Math.round(syncRatio * 100)}%`;
      setMeterPalette(fluxSyncMeter, syncRatio >= 0.68 ? "safe" : syncRatio >= 0.44 ? "balanced" : "critical");
    }
    const cadenceWindow = Math.max(1, Math.min(COMBAT_CHAIN_LIMIT, 6));
    const strikeRatio = clamp(actionCounts.strike / cadenceWindow + (expectedAction === "strike" ? 0.16 : 0), 0, 1);
    const guardRatio = clamp(actionCounts.guard / cadenceWindow + (expectedAction === "guard" ? 0.16 : 0), 0, 1);
    const chargeRatio = clamp(actionCounts.charge / cadenceWindow + (expectedAction === "charge" ? 0.16 : 0), 0, 1);
    const dominantAction = (() => {
      if (strikeRatio >= guardRatio && strikeRatio >= chargeRatio) {
        return "STRIKE";
      }
      if (guardRatio >= chargeRatio) {
        return "GUARD";
      }
      return "CHARGE";
    })();
    const cadenceTone =
      !latestAccepted && latestAction
        ? "critical"
        : urgency === "critical"
          ? "critical"
          : urgency === "spike" || queuePressure >= 0.66
            ? "pressure"
            : dominantAction === (expectedAction || dominantAction).toUpperCase()
              ? "advantage"
              : "steady";
    if (cadenceLine) {
      cadenceLine.textContent = `STR ${Math.round(strikeRatio * 100)} | GRD ${Math.round(guardRatio * 100)} | CHG ${Math.round(chargeRatio * 100)}`;
      cadenceLine.dataset.tone = cadenceTone;
    }
    if (cadenceHint) {
      const focus = expectedAction ? expectedAction.toUpperCase() : dominantAction;
      const queuePct = Math.round(queuePressure * 100);
      const cadenceHintMap = {
        critical: `MISS algilandi: ${focus} ile ritmi geri al, resolve penceresini koru.`,
        pressure: `Baski yuksek (${queuePct}%): ${focus} odagi ile cadence'i stabil tut.`,
        advantage: `Avantaj aktif: ${focus} zinciri ile combo carpanini buyut.`,
        steady: `Stabil tempo: ${focus} odakli devam edip enerjiyi dengede tut.`
      };
      cadenceHint.textContent = cadenceHintMap[cadenceTone] || cadenceHintMap.steady;
    }
    if (cadenceStrikeMeter) {
      cadenceStrikeMeter.style.width = `${Math.round(strikeRatio * 100)}%`;
      setMeterPalette(cadenceStrikeMeter, expectedAction === "strike" ? "aggressive" : "neutral");
    }
    if (cadenceGuardMeter) {
      cadenceGuardMeter.style.width = `${Math.round(guardRatio * 100)}%`;
      setMeterPalette(cadenceGuardMeter, expectedAction === "guard" ? "safe" : "neutral");
    }
    if (cadenceChargeMeter) {
      cadenceChargeMeter.style.width = `${Math.round(chargeRatio * 100)}%`;
      setMeterPalette(cadenceChargeMeter, expectedAction === "charge" ? "balanced" : "neutral");
    }
    if (bossPressureLine) {
      if (!raidSession) {
        bossPressureLine.textContent = `STABLE | HP -- | TTL --`;
        bossPressureLine.dataset.tone = "stable";
      } else {
        const bossHpPct = Math.round(raidHpRatio * 100);
        const bossLabel = bossTone === "critical" ? "CRITICAL" : bossTone === "pressure" ? "PRESSURE" : "STABLE";
        bossPressureLine.textContent = `${bossLabel} | HP ${bossHpPct}% | TTL ${raidTtlSec}s`;
        bossPressureLine.dataset.tone = bossTone;
      }
    }
    if (bossPressureMeter) {
      animateMeterWidth(bossPressureMeter, bossPressure * 100, 0.24);
      setMeterPalette(bossPressureMeter, bossTone === "critical" ? "critical" : bossTone === "pressure" ? "aggressive" : "safe");
    }
    const nodeMap = {
      strike: timelineNodeStrike,
      guard: timelineNodeGuard,
      charge: timelineNodeCharge
    };
    Object.entries(nodeMap).forEach(([actionKey, node]) => {
      if (!node) {
        return;
      }
      node.classList.remove("expected", "active", "success", "reject", "recent", "flash");
      if (actionCounts[actionKey] > 0) {
        node.classList.add("recent");
      }
      if (expectedAction === actionKey) {
        node.classList.add("expected");
      }
      if (latestAction === actionKey) {
        node.classList.add("active");
        node.classList.add(latestAccepted ? "success" : "reject");
        node.classList.add("flash");
        if (node._flashTimer) {
          clearTimeout(node._flashTimer);
        }
        node._flashTimer = setTimeout(() => {
          node.classList.remove("flash");
          node._flashTimer = null;
        }, 260);
      }
    });
  }

  function pushCombatChainEvent(action, options = {}) {
    const opts = options && typeof options === "object" ? options : {};
    const normalizedAction = normalizeCombatAction(action);
    const accepted = opts.accepted !== false;
    const tone = normalizePulseTone(opts.tone || "info");
    const entry = {
      action: normalizedAction,
      accepted,
      tone,
      ts: Number(opts.ts || Date.now())
    };
    state.v3.combatChain.unshift(entry);
    if (state.v3.combatChain.length > COMBAT_CHAIN_LIMIT) {
      state.v3.combatChain.splice(COMBAT_CHAIN_LIMIT);
    }
    const energyMap = {
      safe: 12,
      balanced: 15,
      aggressive: 18,
      reveal: 22,
      info: 10,
      reject: 8
    };
    const toneKey = combatActionTone(normalizedAction, accepted, tone);
    const delta = energyMap[toneKey] || energyMap.info;
    state.v3.combatEnergy = clamp(asNum(state.v3.combatEnergy || 0) * 0.9 + delta, 0, 100);
    renderCombatHudPanel();
  }

  function decayCombatHudState(dt) {
    const now = Date.now();
    let changed = false;
    const pulseAgeMs = now - asNum(state.v3.pulseAt || 0);
    if (pulseAgeMs > 700) {
      const decayRate = state.ui.reducedMotion ? 5.2 : 8.4;
      const nextEnergy = Math.max(0, asNum(state.v3.combatEnergy || 0) - dt * decayRate);
      if (Math.abs(nextEnergy - asNum(state.v3.combatEnergy || 0)) > 0.05) {
        state.v3.combatEnergy = nextEnergy;
        changed = true;
      }
    }
    if (Array.isArray(state.v3.combatChain) && state.v3.combatChain.length) {
      const ttlMs = state.ui.reducedMotion ? 12_000 : 18_000;
      const trimmed = state.v3.combatChain.filter((row) => now - asNum(row?.ts || now) <= ttlMs);
      if (trimmed.length !== state.v3.combatChain.length) {
        state.v3.combatChain = trimmed;
        changed = true;
      }
    }
    if (!changed) {
      return;
    }
    if (now - asNum(state.ui.combatHudRenderAt || 0) < 110) {
      return;
    }
    state.ui.combatHudRenderAt = now;
    renderCombatHudPanel();
  }

  function activateOverlayPip(action) {
    const map = {
      strike: byId("overlayPipStrike"),
      guard: byId("overlayPipGuard"),
      charge: byId("overlayPipCharge")
    };
    Object.values(map).forEach((node) => {
      if (node) {
        node.classList.remove("active");
      }
    });
    const key = String(action || "").toLowerCase();
    const target = map[key];
    if (!target) {
      return;
    }
    target.classList.add("active");
    if (target._deactivateTimer) {
      clearTimeout(target._deactivateTimer);
      target._deactivateTimer = null;
    }
    target._deactivateTimer = setTimeout(() => {
      target.classList.remove("active");
      target._deactivateTimer = null;
    }, 380);
  }

  function triggerCombatHitFeedback(action = "", accepted = true) {
    const body = document.body;
    if (!body) {
      return;
    }
    body.classList.remove("combat-hit-strike", "combat-hit-guard", "combat-hit-charge", "combat-hit-reject");
    const normalized = normalizeCombatAction(action);
    const feedbackClass =
      accepted === false
        ? "combat-hit-reject"
        : normalized === "strike"
          ? "combat-hit-strike"
          : normalized === "guard"
            ? "combat-hit-guard"
            : normalized === "charge"
              ? "combat-hit-charge"
              : "";
    if (!feedbackClass) {
      return;
    }
    body.classList.add(feedbackClass);
    if (state.ui.combatHitTimer) {
      clearTimeout(state.ui.combatHitTimer);
      state.ui.combatHitTimer = null;
    }
    state.ui.combatHitTimer = setTimeout(() => {
      body.classList.remove("combat-hit-strike", "combat-hit-guard", "combat-hit-charge", "combat-hit-reject");
      state.ui.combatHitTimer = null;
    }, accepted === false ? 360 : 280);
  }

  function updateCombatOverlay(tone = "info", label = "", action = "", accepted = true) {
    const root = byId("combatOverlay");
    if (!root) {
      return;
    }
    const normalizedTone = normalizePulseTone(tone);
    root.classList.remove("hidden");
    root.classList.remove("tone-safe", "tone-balanced", "tone-aggressive", "tone-reveal", "tone-info");
    root.classList.add(`tone-${normalizedTone}`);
    root.classList.add("live");
    root.classList.remove("action-strike", "action-guard", "action-charge", "action-reject");
    const normalizedAction = normalizeCombatAction(action);
    if (accepted === false) {
      root.classList.add("action-reject");
    } else if (normalizedAction === "strike" || normalizedAction === "guard" || normalizedAction === "charge") {
      root.classList.add(`action-${normalizedAction}`);
    }

    const labelEl = byId("combatOverlayLabel");
    if (labelEl) {
      const nextLabel = String(label || "NEXUS READY")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 34);
      animateTextSwap(labelEl, nextLabel || "NEXUS READY");
    }

    activateOverlayPip(action);
    triggerCombatHitFeedback(action, accepted);
    if (state.ui.overlayTimer) {
      clearTimeout(state.ui.overlayTimer);
      state.ui.overlayTimer = null;
    }
    const ttl = normalizedTone === "reveal" ? 1400 : 980;
    state.ui.overlayTimer = setTimeout(() => {
      root.classList.remove("live");
      state.ui.overlayTimer = null;
    }, ttl);
  }

  function pushPvpReplayEntry(entry) {
    if (!entry || typeof entry !== "object") {
      return;
    }
    const row = {
      seq: Number(entry.seq || 0),
      input: String(entry.input || "guard"),
      accepted: entry.accepted !== false,
      scoreDelta: Number(entry.scoreDelta || 0),
      tone: String(entry.tone || pvpReplayTone(entry.input, entry.accepted !== false))
    };
    state.v3.pvpReplay.unshift(row);
    if (state.v3.pvpReplay.length > PVP_REPLAY_LIMIT) {
      state.v3.pvpReplay.splice(PVP_REPLAY_LIMIT);
    }
    renderPvpReplayStrip();
  }

  function syncPvpReplayFromSession(session) {
    const actions = Array.isArray(session?.actions) ? session.actions.slice(-PVP_REPLAY_LIMIT) : [];
    if (!actions.length) {
      state.v3.pvpReplay = [];
      renderPvpReplayStrip();
      return;
    }
    state.v3.pvpReplay = actions
      .slice()
      .reverse()
      .map((action) => ({
        seq: Number(action.action_seq || 0),
        input: String(action.input_action || "guard"),
        accepted: Boolean(action.accepted),
        scoreDelta: Number(action.score_delta || 0),
        reason: String(action.reject_reason || action.action_json?.reject_reason || ""),
        tone: pvpReplayTone(action.input_action, Boolean(action.accepted))
      }));
    renderPvpReplayStrip();
  }

  function hydratePvpTimelineFromSession(session) {
    const sessionRef = String(session?.session_ref || "");
    if (!sessionRef) {
      return;
    }
    const actions = Array.isArray(session?.actions) ? session.actions.slice(-10) : [];
    actions.forEach((action) => {
      appendPvpTimelineEntry({
        key: `${sessionRef}:action:${asNum(action.action_seq || 0)}`,
        tone: action.accepted ? "action" : "reject",
        label: `${normalizePvpInputLabel(action.input_action)} ${action.accepted ? "OK" : "MISS"}`,
        meta: `#${asNum(action.action_seq || 0)} | d${asNum(action.score_delta || 0)} | ${String(action.actor_side || "-").toUpperCase()}${
          action.accepted
            ? ""
            : ` | ${String(action.reject_reason || action.action_json?.reject_reason || "rejected")
                .replace(/_/g, " ")
                .toUpperCase()}`
        }`,
        ts: new Date(action.created_at || Date.now()).getTime()
      });
    });
  }

  function resetPvpTimeline(session) {
    state.v3.pvpTimeline = [];
    const sessionRef = String(session?.session_ref || "");
    state.v3.pvpTimelineSessionRef = sessionRef;
    if (!sessionRef) {
      renderPvpTimeline();
      return;
    }
    appendPvpTimelineEntry({
      key: `${sessionRef}:start`,
      tone: "tick",
      label: "SESSION START",
      meta: `${String(session.transport || "poll").toUpperCase()} | Opp ${String(session.opponent_type || "shadow")}`,
      ts: Date.now()
    });
  }

  function updatePvpQueueLine() {
    const line = byId("pvpQueueLine");
    if (!line) {
      return;
    }
    line.textContent = `Input Queue ${state.v3.pvpQueue.length}`;
    renderPvpCadence(state.v3.pvpSession, state.v3.pvpTickMeta);
    renderPvpDuelTheater(state.v3.pvpSession, state.v3.pvpTickMeta);
    renderPvpCinematicDirector(state.v3.pvpSession, state.v3.pvpTickMeta);
  }

  function renderPvpTickLine(session = state.v3.pvpSession, tickMeta = state.v3.pvpTickMeta) {
    const line = byId("pvpTickLive");
    if (!line) {
      return;
    }
    line.classList.remove("urgency-critical", "urgency-pressure", "urgency-advantage");
    if (!session || !tickMeta) {
      line.textContent = "Tick: bekleniyor";
      line.classList.remove("live");
      return;
    }
    const phase = String(tickMeta.phase || session.status || "combat").toUpperCase();
    const seq = asNum(tickMeta.tick_seq || 0);
    const transport = String(tickMeta.transport || state.v3.pvpTransport || "poll").toUpperCase();
    const diagnostics = tickMeta.diagnostics || tickMeta.state_json?.diagnostics || {};
    const drift = asNum(diagnostics.score_drift || 0);
    const urgency = String(diagnostics.urgency || "steady").toUpperCase();
    const recommendation = String(diagnostics.recommendation || "balanced").toUpperCase();
    const shadow = tickMeta.shadow || tickMeta.state_json?.shadow || null;
    const shadowText = shadow
      ? ` | SH ${String(shadow.input_action || "-").toUpperCase()} ${Boolean(shadow.accepted) ? "OK" : "MISS"}`
      : "";
    line.textContent =
      `Tick #${seq} | ${phase} | ${transport} | Drift ${drift >= 0 ? "+" : ""}${drift} | ${urgency} | ${recommendation}` +
      shadowText;
    const urgencyKey = String(diagnostics.urgency || "").toLowerCase();
    if (urgencyKey === "critical") {
      line.classList.add("urgency-critical");
    } else if (urgencyKey === "pressure") {
      line.classList.add("urgency-pressure");
    } else if (urgencyKey === "advantage") {
      line.classList.add("urgency-advantage");
    }
    if (String(session.status || "").toLowerCase() === "active") {
      line.classList.add("live");
    } else {
      line.classList.remove("live");
    }
  }

  function renderPvpCadence(session = state.v3.pvpSession, tickMeta = state.v3.pvpTickMeta) {
    const pulseLine = byId("pvpPulseLine");
    const pulseMeter = byId("pvpPulseMeter");
    const windowMeter = byId("pvpWindowMeter");
    const cadenceLine = byId("pvpCadenceLine");
    const cadenceHint = byId("pvpCadenceHint");
    const cadenceStrikeMeter = byId("pvpCadenceStrikeMeter");
    const cadenceGuardMeter = byId("pvpCadenceGuardMeter");
    const cadenceChargeMeter = byId("pvpCadenceChargeMeter");
    const cadenceDriftMeter = byId("pvpCadenceDriftMeter");
    if (
      !pulseLine ||
      !cadenceLine ||
      !cadenceHint ||
      !pulseMeter ||
      !windowMeter ||
      !cadenceStrikeMeter ||
      !cadenceGuardMeter ||
      !cadenceChargeMeter ||
      !cadenceDriftMeter
    ) {
      return;
    }

    const resetTone = () => {
      pulseLine.removeAttribute("data-tone");
      cadenceLine.removeAttribute("data-tone");
    };

    if (!session) {
      resetTone();
      pulseLine.textContent = "Phase 0% | Window 80%";
      cadenceLine.textContent = "STR 0 | GRD 0 | CHG 0";
      cadenceHint.textContent = "Duel basladiginda aksiyon ritmi burada canli guncellenir.";
      animateMeterWidth(pulseMeter, 0, 0.18);
      animateMeterWidth(windowMeter, 0, 0.18);
      animateMeterWidth(cadenceStrikeMeter, 0, 0.18);
      animateMeterWidth(cadenceGuardMeter, 0, 0.18);
      animateMeterWidth(cadenceChargeMeter, 0, 0.18);
      animateMeterWidth(cadenceDriftMeter, 0, 0.18);
      [pulseMeter, windowMeter, cadenceStrikeMeter, cadenceGuardMeter, cadenceChargeMeter, cadenceDriftMeter].forEach((el) =>
        setMeterPalette(el, "neutral")
      );
      return;
    }

    const diagnostics = tickMeta?.diagnostics || tickMeta?.state_json?.diagnostics || {};
    const tickMs = Math.max(200, asNum(session.tick_ms || state.v3.pvpTickMs || 1000));
    const actionWindowMs = clamp(asNum(session.action_window_ms || state.v3.pvpActionWindowMs || 800), 80, tickMs);
    const windowRatio = clamp(actionWindowMs / tickMs, 0, 1);
    const queueSize = Math.max(0, asNum(state.v3.pvpQueue.length || 0));
    const queueRatio = clamp(queueSize / 8, 0, 1);
    const tickSeq = asNum(tickMeta?.tick_seq || 0);
    const phaseRatio = clamp((((Date.now() % tickMs) / tickMs) * 0.74 + ((tickSeq % 7) / 7) * 0.26), 0, 1);
    const driftRatio = clamp(Math.abs(asNum(diagnostics.score_drift || 0)) / 6, 0, 1);
    const urgencyKey = String(diagnostics.urgency || state.arena?.pvpUrgency || "steady").toLowerCase();
    const recommendedMode = String(
      diagnostics.recommendation || state.arena?.pvpRecommendation || "balanced"
    ).toLowerCase();
    const expectedAction = String(session.next_expected_action || state.sim.expected || "strike").toLowerCase();
    const replay = Array.isArray(state.v3.pvpReplay) ? state.v3.pvpReplay.slice(0, 12) : [];
    const counts = { strike: 0, guard: 0, charge: 0 };
    replay.forEach((row) => {
      const action = String(row?.input_action || row?.input || row?.action || "").toLowerCase();
      if (action.includes("guard")) counts.guard += 1;
      else if (action.includes("charge")) counts.charge += 1;
      else if (action.includes("strike")) counts.strike += 1;
    });
    if (counts.strike + counts.guard + counts.charge <= 0) {
      if (expectedAction.includes("guard")) counts.guard = 1;
      else if (expectedAction.includes("charge")) counts.charge = 1;
      else counts.strike = 1;
    }
    const cadenceTotal = Math.max(1, counts.strike + counts.guard + counts.charge);
    const strikeRatio = clamp(counts.strike / cadenceTotal, 0, 1);
    const guardRatio = clamp(counts.guard / cadenceTotal, 0, 1);
    const chargeRatio = clamp(counts.charge / cadenceTotal, 0, 1);

    const dominantAction =
      strikeRatio >= guardRatio && strikeRatio >= chargeRatio
        ? "STRIKE"
        : guardRatio >= chargeRatio
          ? "GUARD"
          : "CHARGE";
    const pressureRatio = clamp(queueRatio * 0.55 + driftRatio * 0.45, 0, 1);
    const tone =
      urgencyKey === "critical" || pressureRatio >= 0.78
        ? "critical"
        : urgencyKey === "pressure" || pressureRatio >= 0.44
          ? "pressure"
          : urgencyKey === "advantage"
            ? "advantage"
            : "neutral";
    if (tone === "neutral") {
      resetTone();
    } else {
      pulseLine.dataset.tone = tone;
      cadenceLine.dataset.tone = tone;
    }

    pulseLine.textContent = `Phase ${Math.round(phaseRatio * 100)}% | Window ${Math.round(windowRatio * 100)}% | Queue ${queueSize}`;
    cadenceLine.textContent = `STR ${Math.round(strikeRatio * 100)} | GRD ${Math.round(guardRatio * 100)} | CHG ${Math.round(
      chargeRatio * 100
    )}`;

    if (tone === "critical") {
      cadenceHint.textContent = `CRITICAL: ${dominantAction} bozuldu. ${expectedAction.toUpperCase()} penceresine hizli don.`;
    } else if (tone === "pressure") {
      cadenceHint.textContent = `Baski yukseliyor: ${dominantAction} agirlikli akis. Queue temizleyip ${recommendedMode.toUpperCase()} kal.`;
    } else if (tone === "advantage") {
      cadenceHint.textContent = `Ustunluk sende: ${dominantAction} ritmi korunuyor. ${expectedAction.toUpperCase()} ile zinciri uzat.`;
    } else {
      cadenceHint.textContent = `Stabil ritim: ${dominantAction} odakli. ${recommendedMode.toUpperCase()} modunda pencereyi kacirma.`;
    }

    animateMeterWidth(pulseMeter, phaseRatio * 100, 0.22);
    setMeterPalette(pulseMeter, tone === "critical" ? "critical" : tone === "pressure" ? "aggressive" : "balanced");
    animateMeterWidth(windowMeter, windowRatio * 100, 0.22);
    setMeterPalette(windowMeter, windowRatio >= 0.72 ? "safe" : windowRatio >= 0.5 ? "balanced" : "aggressive");
    animateMeterWidth(cadenceStrikeMeter, strikeRatio * 100, 0.2);
    setMeterPalette(cadenceStrikeMeter, expectedAction.includes("strike") ? "aggressive" : "neutral");
    animateMeterWidth(cadenceGuardMeter, guardRatio * 100, 0.2);
    setMeterPalette(cadenceGuardMeter, expectedAction.includes("guard") ? "safe" : "neutral");
    animateMeterWidth(cadenceChargeMeter, chargeRatio * 100, 0.2);
    setMeterPalette(cadenceChargeMeter, expectedAction.includes("charge") ? "balanced" : "neutral");
    animateMeterWidth(cadenceDriftMeter, driftRatio * 100, 0.22);
    setMeterPalette(cadenceDriftMeter, driftRatio >= 0.7 ? "critical" : driftRatio >= 0.4 ? "aggressive" : "safe");
  }

  function renderPvpDuelTheater(session = state.v3.pvpSession, tickMeta = state.v3.pvpTickMeta) {
    const root = byId("pvpTheaterStrip");
    const syncLine = byId("pvpSyncLine");
    const syncMeter = byId("pvpSyncMeter");
    const syncHint = byId("pvpSyncHint");
    const overheatLine = byId("pvpOverheatLine");
    const overheatMeter = byId("pvpOverheatMeter");
    const overheatHint = byId("pvpOverheatHint");
    const clutchLine = byId("pvpClutchLine");
    const clutchMeter = byId("pvpClutchMeter");
    const clutchHint = byId("pvpClutchHint");
    const stanceLine = byId("pvpStanceLine");
    const stanceMeter = byId("pvpStanceMeter");
    const stanceHint = byId("pvpStanceHint");
    if (
      !syncLine ||
      !syncMeter ||
      !syncHint ||
      !overheatLine ||
      !overheatMeter ||
      !overheatHint ||
      !clutchLine ||
      !clutchMeter ||
      !clutchHint ||
      !stanceLine ||
      !stanceMeter ||
      !stanceHint
    ) {
      return;
    }

    const clearTone = () => {
      [syncLine, overheatLine, clutchLine, stanceLine].forEach((el) => el.removeAttribute("data-tone"));
      if (root) {
        root.removeAttribute("data-tone");
      }
    };

    if (!session) {
      clearTone();
      syncLine.textContent = "SYNC 50% | EVEN";
      overheatLine.textContent = "Heat 0% | Stable";
      clutchLine.textContent = "Window 0% | Resolve LOCK";
      stanceLine.textContent = "STR 0 | GRD 0 | CHG 0";
      syncHint.textContent = "Senkron farkini dusur, expected aksiyonla ritmi kilitle.";
      overheatHint.textContent = "Queue ve drift artarsa overheat yukselir.";
      clutchHint.textContent = "Aksiyon eşiği ve TTL penceresini birlikte takip et.";
      stanceHint.textContent = "Dominant stance bozulursa guard ile tempo sabitle.";
      animateMeterWidth(syncMeter, 50, 0.2);
      animateMeterWidth(overheatMeter, 0, 0.2);
      animateMeterWidth(clutchMeter, 0, 0.2);
      animateMeterWidth(stanceMeter, 0, 0.2);
      setMeterPalette(syncMeter, "neutral");
      setMeterPalette(overheatMeter, "neutral");
      setMeterPalette(clutchMeter, "neutral");
      setMeterPalette(stanceMeter, "neutral");
      return;
    }

    const diagnostics = tickMeta?.diagnostics || tickMeta?.state_json?.diagnostics || {};
    const urgencyKey = String(diagnostics.urgency || state.arena?.pvpUrgency || "steady").toLowerCase();
    const recommendation = String(diagnostics.recommendation || state.arena?.pvpRecommendation || "balanced").toUpperCase();
    const scoreSelf = asNum(session.score?.self || 0);
    const scoreOpp = asNum(session.score?.opponent || 0);
    const comboSelf = asNum(session.combo?.self || 0);
    const comboOpp = asNum(session.combo?.opponent || 0);
    const actionsSelf = asNum(session.action_count?.self || 0);
    const actionsOpp = asNum(session.action_count?.opponent || 0);
    const ttlSecLeft = Math.max(0, asNum(session.ttl_sec_left || 0));
    const tickMs = Math.max(200, asNum(session.tick_ms || state.v3.pvpTickMs || 1000));
    const actionWindowMs = clamp(asNum(session.action_window_ms || state.v3.pvpActionWindowMs || 800), 80, tickMs);
    const windowRatio = clamp(actionWindowMs / tickMs, 0, 1);
    const queueRatio = clamp(asNum(state.v3.pvpQueue.length || 0) / 10, 0, 1);
    const driftRatio = clamp(Math.abs(asNum(diagnostics.score_drift || 0)) / 6, 0, 1);
    const latencyRatio = clamp(asNum(diagnostics.latency_ms || state.telemetry.latencyAvgMs || 0) / 900, 0, 1);

    const scoreMomentum = clamp(0.5 + (scoreSelf - scoreOpp) / 16 + (comboSelf - comboOpp) / 18 + (actionsSelf - actionsOpp) / 28, 0, 1);
    const momentumSelf = clamp(asNum(state.arena?.pvpMomentumSelf ?? scoreMomentum), 0, 1);
    const momentumOpp = clamp(asNum(state.arena?.pvpMomentumOpp ?? 1 - scoreMomentum), 0, 1);
    const syncDelta = Math.round((momentumSelf - momentumOpp) * 100);
    const syncRatio = clamp(1 - Math.abs(syncDelta) / 100, 0, 1);
    const syncState = syncDelta >= 16 ? "AHEAD" : syncDelta <= -16 ? "UNDER" : "EVEN";

    const overheatRatio = clamp(queueRatio * 0.4 + driftRatio * 0.34 + latencyRatio * 0.18 + (1 - windowRatio) * 0.08, 0, 1);
    const overheatState = overheatRatio >= 0.78 ? "CRITICAL" : overheatRatio >= 0.54 ? "WARM" : "STABLE";

    const resolveReadiness = clamp(actionsSelf / 6, 0, 1);
    const ttlRatio = clamp(ttlSecLeft / 60, 0, 1);
    const clutchRatio = clamp(resolveReadiness * 0.64 + ttlRatio * 0.36, 0, 1);
    const clutchState =
      resolveReadiness >= 1
        ? "READY"
        : ttlSecLeft <= 16
          ? "CRITICAL"
          : resolveReadiness >= 0.68
            ? "BUILD"
            : "LOCK";

    const replay = Array.isArray(state.v3.pvpReplay) ? state.v3.pvpReplay.slice(0, 12) : [];
    const counts = { strike: 0, guard: 0, charge: 0 };
    replay.forEach((row) => {
      const action = String(row?.input_action || row?.input || row?.action || "").toLowerCase();
      if (action.includes("guard")) counts.guard += 1;
      else if (action.includes("charge")) counts.charge += 1;
      else if (action.includes("strike")) counts.strike += 1;
    });
    const totalCount = Math.max(1, counts.strike + counts.guard + counts.charge);
    const strikeRatio = clamp(counts.strike / totalCount, 0, 1);
    const guardRatio = clamp(counts.guard / totalCount, 0, 1);
    const chargeRatio = clamp(counts.charge / totalCount, 0, 1);
    const dominantRatio = Math.max(strikeRatio, guardRatio, chargeRatio);
    const dominantAction =
      dominantRatio === strikeRatio ? "STR" : dominantRatio === guardRatio ? "GRD" : "CHG";
    const stancePressure = clamp((1 - dominantRatio) * 0.62 + overheatRatio * 0.24 + queueRatio * 0.14, 0, 1);

    const overallTone =
      String(session.status || "").toLowerCase() === "resolved"
        ? String(session.result?.outcome_for_viewer || "").toLowerCase() === "win"
          ? "advantage"
          : "critical"
        : urgencyKey === "critical" || overheatRatio >= 0.72
          ? "critical"
          : urgencyKey === "pressure" || overheatRatio >= 0.44 || stancePressure >= 0.58
            ? "pressure"
            : syncRatio >= 0.62 && clutchRatio >= 0.54
              ? "advantage"
              : "neutral";

    if (root) {
      root.dataset.tone = overallTone;
    }

    syncLine.dataset.tone = syncRatio >= 0.62 ? "advantage" : syncRatio >= 0.38 ? "pressure" : "critical";
    syncLine.textContent = `SYNC ${Math.round(syncRatio * 100)}% | ${syncState} ${syncDelta >= 0 ? `+${syncDelta}` : syncDelta}`;
    syncHint.textContent =
      syncRatio >= 0.64
        ? `Senkron iyi: ${recommendation} ritmiyle avantaj korunuyor.`
        : syncRatio >= 0.4
          ? "Senkron kiriliyor: beklenen aksiyona hizli don."
          : "Senkron kritik: GUARD ile pencereyi resetle, queue baskisini temizle.";

    overheatLine.dataset.tone = overheatRatio >= 0.72 ? "critical" : overheatRatio >= 0.44 ? "pressure" : "advantage";
    overheatLine.textContent = `Heat ${Math.round(overheatRatio * 100)}% | ${overheatState}`;
    overheatHint.textContent =
      overheatRatio >= 0.72
        ? "Overheat kritik: resolve yerine ritim temizleme yap."
        : overheatRatio >= 0.44
          ? "Heat yukseliyor: drift ve queue birikimini dusur."
          : "Core stabil: kontrollu strike-charge zinciri acik.";

    clutchLine.dataset.tone = clutchState === "READY" ? "advantage" : clutchState === "CRITICAL" ? "critical" : "pressure";
    clutchLine.textContent = `Window ${Math.round(clutchRatio * 100)}% | Resolve ${clutchState}`;
    clutchHint.textContent =
      clutchState === "READY"
        ? "Resolve penceresi acik: odulu kilitlemek icin cozum baslat."
        : clutchState === "CRITICAL"
          ? "TTL dusuk: riskli hamleleri kes, savunma + hizli finish."
          : `Resolve icin ${Math.max(0, 6 - actionsSelf)} aksiyon daha gerekli.`;

    stanceLine.dataset.tone = stancePressure >= 0.68 ? "critical" : stancePressure >= 0.44 ? "pressure" : "advantage";
    stanceLine.textContent = `STR ${Math.round(strikeRatio * 100)} | GRD ${Math.round(guardRatio * 100)} | CHG ${Math.round(chargeRatio * 100)}`;
    stanceHint.textContent =
      stancePressure >= 0.68
        ? "Stance dağiliyor: dominant aksiyona geri don, guard tamponu ac."
        : stancePressure >= 0.44
          ? `Baski orta: ${dominantAction} dominansi koruyup drift'i dusur.`
          : `${dominantAction} dominansi sabit, combo akisi temiz ilerliyor.`;

    animateMeterWidth(syncMeter, syncRatio * 100, 0.22);
    setMeterPalette(syncMeter, syncRatio >= 0.62 ? "safe" : syncRatio >= 0.38 ? "balanced" : "aggressive");
    animateMeterWidth(overheatMeter, overheatRatio * 100, 0.22);
    setMeterPalette(overheatMeter, overheatRatio >= 0.72 ? "critical" : overheatRatio >= 0.44 ? "aggressive" : "safe");
    animateMeterWidth(clutchMeter, clutchRatio * 100, 0.22);
    setMeterPalette(
      clutchMeter,
      clutchState === "READY" ? "safe" : clutchState === "CRITICAL" ? "critical" : clutchRatio >= 0.54 ? "balanced" : "aggressive"
    );
    animateMeterWidth(stanceMeter, stancePressure * 100, 0.22);
    setMeterPalette(stanceMeter, stancePressure >= 0.68 ? "critical" : stancePressure >= 0.44 ? "aggressive" : "balanced");
  }

  function renderPvpCinematicDirector(session = state.v3.pvpSession, tickMeta = state.v3.pvpTickMeta) {
    const root = byId("pvpCineStrip");
    const phaseBadge = byId("pvpCinePhaseBadge");
    const line = byId("pvpCineLine");
    const meter = byId("pvpCineMeter");
    const hint = byId("pvpCineHint");
    if (!root || !phaseBadge || !line || !meter || !hint) {
      if (state.arena) {
        state.arena.pvpCinematicIntensity = 0;
      }
      return;
    }

    const setTone = (tone = "neutral") => {
      root.dataset.tone = tone;
      if (tone === "neutral") {
        line.removeAttribute("data-tone");
      } else {
        line.dataset.tone = tone;
      }
      phaseBadge.className = tone === "critical" ? "badge warn" : tone === "advantage" ? "badge" : "badge info";
      setMeterPalette(meter, tone === "critical" ? "critical" : tone === "pressure" ? "aggressive" : tone === "advantage" ? "safe" : "balanced");
    };

    if (!session) {
      setTone("neutral");
      phaseBadge.textContent = "DUEL PHASE";
      line.textContent = "Cinematic Director | SYNC 50% | HEAT 0%";
      hint.textContent = "Tick akisina kilitlen, expected aksiyona hizli don.";
      animateMeterWidth(meter, 18, 0.2);
      if (state.arena) {
        state.arena.pvpCinematicIntensity = 0;
      }
      state.v3.lastPvpCineKey = "";
      return;
    }

    const status = String(session.status || "active").toLowerCase();
    const phase = String(tickMeta?.phase || status || "combat").toLowerCase();
    const phaseLabelMap = {
      queued: "MATCHMAKING",
      queue: "MATCHMAKING",
      active: "COMBAT",
      combat: "COMBAT",
      resolve: "RESOLVE",
      resolved: "RESOLVED",
      expired: "EXPIRED"
    };
    const phaseLabel = phaseLabelMap[phase] || phase.toUpperCase();
    const diagnostics = tickMeta?.diagnostics || tickMeta?.state_json?.diagnostics || {};
    const tickSeq = asNum(tickMeta?.tick_seq || 0);
    const queueSize = Math.max(0, asNum(state.v3.pvpQueue.length || 0));
    const queueRatio = clamp(queueSize / 8, 0, 1);
    const driftRatio = clamp(Math.abs(asNum(diagnostics.score_drift || 0)) / 7, 0, 1);
    const latencyRatio = clamp(asNum(diagnostics.latency_ms || state.telemetry.latencyAvgMs || 0) / 1000, 0, 1);
    const ttlSecLeft = Math.max(0, asNum(session.ttl_sec_left || 0));
    const ttlRatio = clamp(ttlSecLeft / 60, 0, 1);
    const actionsSelf = asNum(session.action_count?.self || 0);
    const resolveNeed = Math.max(0, 6 - actionsSelf);
    const resolveRatio = clamp(1 - resolveNeed / 6, 0, 1);
    const momentumSelf = clamp(asNum(state.arena?.pvpMomentumSelf ?? 0.5), 0, 1);
    const momentumOpp = clamp(asNum(state.arena?.pvpMomentumOpp ?? 0.5), 0, 1);
    const momentumDelta = momentumSelf - momentumOpp;
    const syncRatio = clamp(0.5 + momentumDelta * 0.5, 0, 1);
    const urgencyKey = String(diagnostics.urgency || state.arena?.pvpUrgency || "steady").toLowerCase();
    const recommendation = String(diagnostics.recommendation || state.arena?.pvpRecommendation || "balanced").toUpperCase();
    const heatRatio = clamp(queueRatio * 0.32 + driftRatio * 0.42 + latencyRatio * 0.26, 0, 1);
    const clutchRatio = clamp(resolveRatio * 0.62 + (1 - ttlRatio) * 0.38, 0, 1);
    let cineIntensity = clamp(syncRatio * 0.24 + heatRatio * 0.36 + clutchRatio * 0.4, 0, 1);

    let tone = "neutral";
    if (status === "resolved") {
      const outcome = String(session.result?.outcome_for_viewer || session.result?.outcome || "").toLowerCase();
      tone = outcome === "win" ? "advantage" : "critical";
      cineIntensity = outcome === "win" ? Math.max(cineIntensity, 0.78) : Math.max(cineIntensity, 0.86);
    } else if (urgencyKey === "critical" || ttlSecLeft <= 12 || heatRatio >= 0.72 || clutchRatio >= 0.84) {
      tone = "critical";
    } else if (urgencyKey === "pressure" || heatRatio >= 0.46 || queueRatio >= 0.5) {
      tone = "pressure";
    } else if (urgencyKey === "advantage" || syncRatio >= 0.62) {
      tone = "advantage";
    }

    setTone(tone);
    phaseBadge.textContent = `${phaseLabel} | #${tickSeq}`;
    line.textContent =
      `${phaseLabel} | Sync ${Math.round(syncRatio * 100)}% | Heat ${Math.round(heatRatio * 100)}% | ` +
      `Queue ${queueSize} | TTL ${ttlSecLeft}s`;

    if (tone === "critical") {
      hint.textContent = `KRITIK: ${resolveNeed > 0 ? `${resolveNeed} aksiyon` : "resolve"} penceresini kacirma, ${recommendation} ritmine don.`;
    } else if (tone === "pressure") {
      hint.textContent = `Baski artiyor: queue ${queueSize}, drift ${Math.round(driftRatio * 100)}%. ${recommendation} ile tempoyu sabitle.`;
    } else if (tone === "advantage") {
      hint.textContent = `Avantaj sende: senkron ${Math.round(syncRatio * 100)}%, resolve hazirlik ${Math.round(resolveRatio * 100)}%.`;
    } else {
      hint.textContent = `Stabil duel: expected aksiyona sadik kal, ${recommendation} modunda pencereyi koru.`;
    }

    animateMeterWidth(meter, cineIntensity * 100, 0.22);
    if (state.arena) {
      state.arena.pvpCinematicIntensity = cineIntensity;
    }

    const cinematicKey = `${phase}:${tone}:${Math.round(cineIntensity * 10)}:${resolveNeed}:${queueSize}`;
    const now = Date.now();
    if (
      status === "active" &&
      tone !== "neutral" &&
      cinematicKey !== state.v3.lastPvpCineKey &&
      now - asNum(state.v3.lastPvpCinePulseAt || 0) > 1400
    ) {
      state.v3.lastPvpCinePulseAt = now;
      state.v3.lastPvpCineKey = cinematicKey;
      triggerArenaPulse(tone === "critical" ? "aggressive" : tone === "pressure" ? "balanced" : "safe", {
        label: `PVP ${phaseLabel} ${Math.round(cineIntensity * 100)}%`
      });
    } else {
      state.v3.lastPvpCineKey = cinematicKey;
    }
  }

  function drawPvpRadarCanvas(canvas, options = {}) {
    if (!canvas) {
      return;
    }
    const bridge = getPvpRadarBridge();
    if (bridge) {
      try {
        const handled = bridge.draw(canvas, options);
        if (handled) {
          return;
        }
      } catch (err) {
        console.warn("pvp-radar-bridge-draw-failed", err);
      }
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    const width = Math.max(180, canvas.width || 360);
    const height = Math.max(110, canvas.height || 196);
    const cx = width * 0.5;
    const cy = height * 0.52;
    const maxRadius = Math.max(24, Math.min(width, height) * 0.4);
    const tone = String(options.tone || "neutral");
    const flowRatio = clamp(asNum(options.flowRatio), 0, 1);
    const clutchVector = clamp(asNum(options.clutchVector), 0, 1);
    const queueRatio = clamp(asNum(options.queueRatio), 0, 1);
    const driftRatio = clamp(asNum(options.driftRatio), 0, 1);
    const reducedMotion = Boolean(options.reducedMotion);
    const replay = Array.isArray(options.replay) ? options.replay.slice(0, 14) : [];
    const tickSeq = Math.max(0, asNum(options.tickSeq || 0));
    const nowMs = Date.now();
    const sweepSeed = reducedMotion ? tickSeq * 0.47 : nowMs / 900;
    const sweepAngle = (sweepSeed % (Math.PI * 2)) + queueRatio * 0.16;

    const toneGradientMap = {
      critical: ["rgba(28, 8, 18, 0.92)", "rgba(8, 8, 20, 0.94)"],
      pressure: ["rgba(24, 14, 8, 0.9)", "rgba(7, 10, 22, 0.94)"],
      advantage: ["rgba(8, 18, 17, 0.9)", "rgba(6, 11, 24, 0.94)"],
      neutral: ["rgba(8, 13, 30, 0.9)", "rgba(5, 9, 22, 0.94)"]
    };
    const [gradA, gradB] = toneGradientMap[tone] || toneGradientMap.neutral;
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, gradA);
    bg.addColorStop(1, gradB);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const gridColor = tone === "critical" ? "rgba(255, 94, 132, 0.22)" : "rgba(143, 184, 255, 0.18)";
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let ring = 1; ring <= 4; ring += 1) {
      const r = (maxRadius / 4) * ring;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - maxRadius - 10, cy);
    ctx.lineTo(cx + maxRadius + 10, cy);
    ctx.moveTo(cx, cy - maxRadius - 10);
    ctx.lineTo(cx, cy + maxRadius + 10);
    ctx.stroke();

    const sweepGradient = ctx.createRadialGradient(cx, cy, maxRadius * 0.1, cx, cy, maxRadius * 1.2);
    const sweepColor =
      tone === "critical"
        ? "rgba(255, 86, 121, 0.36)"
        : tone === "pressure"
          ? "rgba(255, 189, 111, 0.34)"
          : tone === "advantage"
            ? "rgba(112, 255, 160, 0.34)"
            : "rgba(124, 214, 255, 0.3)";
    sweepGradient.addColorStop(0, sweepColor);
    sweepGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = sweepGradient;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, maxRadius * 1.08, sweepAngle - 0.26, sweepAngle + 0.26);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = tone === "critical" ? "rgba(255, 135, 161, 0.84)" : "rgba(151, 221, 255, 0.8)";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweepAngle) * maxRadius * 1.06, cy + Math.sin(sweepAngle) * maxRadius * 1.06);
    ctx.stroke();

    replay.forEach((row, idx) => {
      const action = String(row?.input_action || row?.input || row?.action || "strike").toLowerCase();
      const accepted = Boolean(row?.accepted);
      const seq = Math.max(1, asNum(row?.seq || idx + 1));
      const hashSeed =
        seq * 0.37 +
        action
          .split("")
          .reduce((acc, ch) => acc + ch.charCodeAt(0), 0) *
          0.013;
      const angle = (hashSeed % (Math.PI * 2)) + driftRatio * 0.55;
      const radius = clamp(maxRadius * (0.24 + (idx / Math.max(1, replay.length - 1)) * 0.72), maxRadius * 0.2, maxRadius * 0.96);
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      const fill =
        action.includes("guard")
          ? accepted
            ? "rgba(112, 255, 160, 0.86)"
            : "rgba(255, 152, 171, 0.84)"
          : action.includes("charge")
            ? accepted
              ? "rgba(124, 214, 255, 0.86)"
              : "rgba(255, 180, 120, 0.84)"
            : accepted
              ? "rgba(255, 206, 120, 0.86)"
              : "rgba(255, 102, 136, 0.88)";
      ctx.fillStyle = fill;
      ctx.shadowBlur = accepted ? 8 : 12;
      ctx.shadowColor = fill;
      ctx.beginPath();
      ctx.arc(x, y, accepted ? 3.2 : 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    const vectorAngle = -Math.PI * 0.5 + flowRatio * Math.PI * 1.2;
    const vectorRadius = maxRadius * (0.22 + clutchVector * 0.62);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.66)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(vectorAngle) * vectorRadius, cy + Math.sin(vectorAngle) * vectorRadius);
    ctx.stroke();

    ctx.fillStyle = tone === "critical" ? "rgba(255, 134, 164, 0.96)" : "rgba(146, 252, 208, 0.95)";
    ctx.beginPath();
    ctx.arc(cx, cy, 4.3 + flowRatio * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  function renderPvpRadar(session = state.v3.pvpSession, tickMeta = state.v3.pvpTickMeta) {
    const root = byId("pvpRadarStrip");
    const toneBadge = byId("pvpRadarToneBadge");
    const canvas = byId("pvpRadarCanvas");
    const line = byId("pvpRadarLine");
    const hint = byId("pvpRadarHint");
    const flowLine = byId("pvpDuelFlowLine");
    const flowMeter = byId("pvpDuelFlowMeter");
    const clutchLine = byId("pvpClutchVectorLine");
    const clutchMeter = byId("pvpClutchVectorMeter");
    if (!root || !toneBadge || !canvas || !line || !hint || !flowLine || !flowMeter || !clutchLine || !clutchMeter) {
      return;
    }

    const setTone = (tone = "neutral") => {
      const safeTone = ["neutral", "advantage", "pressure", "critical"].includes(String(tone)) ? String(tone) : "neutral";
      root.dataset.tone = safeTone;
      toneBadge.className = safeTone === "critical" ? "badge warn" : safeTone === "advantage" ? "badge" : "badge info";
      toneBadge.textContent =
        safeTone === "critical" ? "CRITICAL" : safeTone === "pressure" ? "PRESSURE" : safeTone === "advantage" ? "ADVANTAGE" : "NEUTRAL";
    };

    if (!session) {
      setTone("neutral");
      animateTextSwap(line, "Sweep 0% | Drift 0 | Queue 0");
      animateTextSwap(hint, "Radar feed bekleniyor.");
      animateTextSwap(flowLine, "FLOW 0% | STABLE");
      animateTextSwap(clutchLine, "VECTOR 0% | LOCK");
      animateMeterWidth(flowMeter, 0, 0.2);
      animateMeterWidth(clutchMeter, 0, 0.2);
      setMeterPalette(flowMeter, "neutral");
      setMeterPalette(clutchMeter, "neutral");
      drawPvpRadarCanvas(canvas, {
        tone: "neutral",
        flowRatio: 0,
        clutchVector: 0,
        queueRatio: 0,
        driftRatio: 0,
        replay: [],
        reducedMotion: state.ui.reducedMotion,
        tickSeq: 0
      });
      return;
    }

    const diagnostics = tickMeta?.diagnostics || tickMeta?.state_json?.diagnostics || {};
    const queueSize = Math.max(0, asNum(state.v3.pvpQueue.length || 0));
    const queueRatio = clamp(queueSize / 10, 0, 1);
    const drift = asNum(diagnostics.score_drift || 0);
    const driftRatio = clamp(Math.abs(drift) / 6, 0, 1);
    const latencyRatio = clamp(asNum(diagnostics.latency_ms || state.telemetry.latencyAvgMs || 0) / 1000, 0, 1);
    const scoreSelf = asNum(session.score?.self || 0);
    const scoreOpp = asNum(session.score?.opponent || 0);
    const comboSelf = asNum(session.combo?.self || 0);
    const comboOpp = asNum(session.combo?.opponent || 0);
    const actionsSelf = asNum(session.action_count?.self || 0);
    const ttlSecLeft = Math.max(0, asNum(session.ttl_sec_left || 0));
    const ttlRatio = clamp(ttlSecLeft / 60, 0, 1);
    const resolveReadiness = clamp(actionsSelf / 6, 0, 1);
    const momentumBase = clamp(0.5 + (scoreSelf - scoreOpp) / 16 + (comboSelf - comboOpp) / 16, 0, 1);
    const momentumSelf = clamp(asNum(state.arena?.pvpMomentumSelf ?? momentumBase), 0, 1);
    const momentumOpp = clamp(asNum(state.arena?.pvpMomentumOpp ?? 1 - momentumBase), 0, 1);
    const flowRatio = clamp(momentumSelf * 0.64 + (1 - momentumOpp) * 0.24 + (1 - latencyRatio) * 0.12, 0, 1);
    const clutchVector = clamp(resolveReadiness * 0.52 + (1 - ttlRatio) * 0.22 + (1 - queueRatio) * 0.26, 0, 1);
    const sweepRatio = clamp(flowRatio * 0.58 + (1 - queueRatio) * 0.24 + (1 - driftRatio) * 0.18, 0, 1);
    const status = String(session.status || "active").toLowerCase();
    const urgency = String(diagnostics.urgency || state.arena?.pvpUrgency || "steady").toLowerCase();
    const riskPulse = clamp(driftRatio * 0.42 + queueRatio * 0.34 + latencyRatio * 0.24, 0, 1);
    const vectorState = resolveReadiness >= 1 ? "RESOLVE" : ttlSecLeft <= 16 ? "TIME CRIT" : clutchVector >= 0.58 ? "PUSH" : "LOCK";
    const flowState = flowRatio >= 0.66 ? "PUSH" : flowRatio >= 0.46 ? "STABLE" : "DROP";

    let tone = "neutral";
    if (status === "resolved") {
      const outcome = String(session.result?.outcome_for_viewer || session.result?.outcome || "").toLowerCase();
      tone = outcome === "win" ? "advantage" : "critical";
    } else if (urgency === "critical" || riskPulse >= 0.72 || ttlSecLeft <= 12) {
      tone = "critical";
    } else if (urgency === "pressure" || riskPulse >= 0.46 || queueRatio >= 0.5) {
      tone = "pressure";
    } else if (flowRatio >= 0.6 && clutchVector >= 0.5) {
      tone = "advantage";
    }
    setTone(tone);

    animateTextSwap(line, `Sweep ${Math.round(sweepRatio * 100)}% | Drift ${drift >= 0 ? "+" : ""}${Math.round(drift)} | Queue ${queueSize}`);
    if (tone === "critical") {
      animateTextSwap(hint, "Radar kilitlendi: queue temizle, guard ile ritmi stabil tut.");
    } else if (tone === "pressure") {
      animateTextSwap(hint, "Baski yukseliyor: expected aksiyonu kacirmadan pencereyi tut.");
    } else if (tone === "advantage") {
      animateTextSwap(hint, "Avantaj sende: flow koru, resolve penceresini kilitle.");
    } else {
      animateTextSwap(hint, "Stabil feed: duel flow ve clutch vector dengede.");
    }

    animateTextSwap(flowLine, `FLOW ${Math.round(flowRatio * 100)}% | ${flowState}`);
    animateTextSwap(clutchLine, `VECTOR ${Math.round(clutchVector * 100)}% | ${vectorState}`);
    animateMeterWidth(flowMeter, flowRatio * 100, 0.22);
    animateMeterWidth(clutchMeter, clutchVector * 100, 0.22);
    setMeterPalette(flowMeter, flowRatio >= 0.66 ? "safe" : flowRatio >= 0.46 ? "balanced" : "aggressive");
    setMeterPalette(clutchMeter, clutchVector >= 0.58 ? "safe" : clutchVector >= 0.4 ? "balanced" : "critical");

    drawPvpRadarCanvas(canvas, {
      tone,
      flowRatio,
      clutchVector,
      queueRatio,
      driftRatio,
      replay: state.v3.pvpReplay,
      reducedMotion: state.ui.reducedMotion,
      tickSeq: asNum(tickMeta?.tick_seq || 0)
    });
  }

  function paintPvpObjectiveCard(card, label, value, meta, tone = "neutral") {
    if (!card) {
      return;
    }
    const safeTone = ["neutral", "advantage", "warning", "danger"].includes(String(tone)) ? String(tone) : "neutral";
    card.className = `pvpObjectiveCard ${safeTone}`;
    const labelEl = card.querySelector(".label");
    const valueEl = card.querySelector(".value");
    const metaEl = card.querySelector(".micro");
    if (labelEl) labelEl.textContent = String(label || "-");
    if (valueEl) valueEl.textContent = String(value || "-");
    if (metaEl) metaEl.textContent = String(meta || "-");
  }

  function renderPvpMomentumAndObjectives(session = state.v3.pvpSession) {
    const selfLine = byId("pvpMomentumSelfLine");
    const selfMeter = byId("pvpMomentumSelfMeter");
    const oppLine = byId("pvpMomentumOppLine");
    const oppMeter = byId("pvpMomentumOppMeter");
    const primaryCard = byId("pvpObjectivePrimary");
    const secondaryCard = byId("pvpObjectiveSecondary");
    const riskCard = byId("pvpObjectiveRisk");

    if (!session) {
      if (selfLine) selfLine.textContent = "50% | EVEN";
      if (oppLine) oppLine.textContent = "50% | EVEN";
      if (selfMeter) {
        animateMeterWidth(selfMeter, 50, 0.2);
        setMeterPalette(selfMeter, "neutral");
      }
      if (oppMeter) {
        animateMeterWidth(oppMeter, 50, 0.2);
        setMeterPalette(oppMeter, "neutral");
      }
      paintPvpObjectiveCard(primaryCard, "Hedef 1", "Pattern Hazir", "Beklenen aksiyonla ritmi tut.", "neutral");
      paintPvpObjectiveCard(secondaryCard, "Hedef 2", "Resolve Penceresi", "6+ aksiyonla duel cozumunu ac.", "neutral");
      paintPvpObjectiveCard(riskCard, "Risk Komutu", "Kontrol Modu", "Baski artarsa GUARD ile dengele.", "neutral");
      if (state.arena) {
        state.arena.pvpMomentumSelf = 0.5;
        state.arena.pvpMomentumOpp = 0.5;
        state.arena.pvpPressure = 0.25;
        state.arena.pvpUrgency = "steady";
        state.arena.pvpRecommendation = "balanced";
      }
      return;
    }

    const scoreSelf = asNum(session.score?.self || 0);
    const scoreOpp = asNum(session.score?.opponent || 0);
    const comboSelf = asNum(session.combo?.self || 0);
    const comboOpp = asNum(session.combo?.opponent || 0);
    const actionsSelf = asNum(session.action_count?.self || 0);
    const actionsOpp = asNum(session.action_count?.opponent || 0);
    const ttl = asNum(session.ttl_sec_left || 0);
    const scoreDelta = scoreSelf - scoreOpp;
    const comboDelta = comboSelf - comboOpp;
    const actionDelta = actionsSelf - actionsOpp;
    const diagnostics = state.v3.pvpTickMeta?.diagnostics || {};
    const queuePressureDiag = clamp(asNum(diagnostics.queue_pressure || 0), 0, 1);
    const pressureRatio = clamp(
      asNum(state.telemetry.threatRatio || 0) * 0.35 +
        clamp(asNum(state.v3.pvpQueue.length || 0) / 8, 0, 1) * 0.25 +
        queuePressureDiag * 0.4,
      0,
      1
    );

    const momentumSelf = clamp(0.5 + scoreDelta / 14 + comboDelta / 16 + actionDelta / 20 - pressureRatio * 0.16, 0, 1);
    const momentumOpp = clamp(1 - momentumSelf, 0, 1);
    const selfState = momentumSelf >= 0.62 ? "AHEAD" : momentumSelf <= 0.38 ? "UNDER" : "EVEN";
    const oppState = momentumOpp >= 0.62 ? "AHEAD" : momentumOpp <= 0.38 ? "UNDER" : "EVEN";
    const urgencyKey = String(diagnostics.urgency || "steady").toLowerCase();
    const recommendedMode = String(diagnostics.recommendation || "balanced").toUpperCase();
    const contractMode = String(diagnostics.contract_mode || "open").toUpperCase();
    const anomalyBias = String(diagnostics.anomaly_bias || "none").toUpperCase();
    const shadow = state.v3.pvpTickMeta?.shadow || null;

    if (selfLine) selfLine.textContent = `${Math.round(momentumSelf * 100)}% | ${selfState}`;
    if (oppLine) oppLine.textContent = `${Math.round(momentumOpp * 100)}% | ${oppState}`;
    if (selfMeter) {
      animateMeterWidth(selfMeter, momentumSelf * 100, 0.24);
      setMeterPalette(selfMeter, momentumSelf >= 0.62 ? "safe" : momentumSelf >= 0.45 ? "balanced" : "aggressive");
    }
    if (oppMeter) {
      animateMeterWidth(oppMeter, momentumOpp * 100, 0.24);
      setMeterPalette(oppMeter, momentumOpp >= 0.62 ? "aggressive" : momentumOpp >= 0.45 ? "balanced" : "safe");
    }

    const expected = normalizePvpInputLabel(String(session.next_expected_action || "strike"));
    const objectivePrimaryTone = expected === "GUARD" ? "advantage" : expected === "CHARGE" ? "warning" : "neutral";
    paintPvpObjectiveCard(
      primaryCard,
      "Hedef 1",
      `Pattern: ${expected}`,
      `Mode ${recommendedMode} | Kontrat ${contractMode}`,
      urgencyKey === "advantage" ? "advantage" : objectivePrimaryTone
    );

    const actionsToResolve = Math.max(0, 6 - actionsSelf);
    const resolveTone = actionsToResolve <= 1 ? "advantage" : actionsToResolve <= 3 ? "warning" : "neutral";
    paintPvpObjectiveCard(
      secondaryCard,
      "Hedef 2",
      actionsToResolve <= 0 ? "Resolve Hazir" : `Resolve icin ${actionsToResolve}`,
      `TTL ${ttl}s | Aksiyon ${actionsSelf}-${actionsOpp} | Bias ${anomalyBias}`,
      ttl <= 18 || urgencyKey === "critical" ? "danger" : resolveTone
    );

    const riskTone =
      urgencyKey === "critical"
        ? "danger"
        : urgencyKey === "pressure"
          ? "warning"
          : pressureRatio >= 0.72
            ? "danger"
            : pressureRatio >= 0.44
              ? "warning"
              : "advantage";
    const riskHint =
      pressureRatio >= 0.72
        ? "Baski yuksek: GUARD + SAFE resolve pencereye don."
        : pressureRatio >= 0.44
          ? "Baski artiyor: tempoyu dengele, queue biriktirme."
          : "Kontrol sende: STRIKE + CHARGE ile momentum topla.";
    paintPvpObjectiveCard(
      riskCard,
      "Risk Komutu",
      `Baski ${Math.round(pressureRatio * 100)}%`,
      shadow
        ? `${riskHint} | Shadow ${String(shadow.input_action || "-").toUpperCase()} ${
            Boolean(shadow.accepted) ? "OK" : "MISS"
          }`
        : riskHint,
      riskTone
    );

    const objectiveKey = `${expected}:${actionsToResolve}:${Math.round(pressureRatio * 100)}:${selfState}:${urgencyKey}`;
    if (objectiveKey !== state.v3.lastPvpObjectiveKey) {
      state.v3.lastPvpObjectiveKey = objectiveKey;
      [primaryCard, secondaryCard, riskCard].forEach((card) => {
        if (!card) {
          return;
        }
        card.classList.add("pulse");
        setTimeout(() => card.classList.remove("pulse"), 220);
      });
    }
    if (state.arena) {
      state.arena.pvpMomentumSelf = momentumSelf;
      state.arena.pvpMomentumOpp = momentumOpp;
      state.arena.pvpPressure = pressureRatio;
      state.arena.pvpUrgency = urgencyKey;
      state.arena.pvpRecommendation = String(diagnostics.recommendation || "balanced").toLowerCase();
    }
  }

  function stopPvpLiveLoop() {
    if (state.v3.pvpLiveTimer) {
      clearTimeout(state.v3.pvpLiveTimer);
      state.v3.pvpLiveTimer = null;
    }
  }

  function queuePvpLiveLoop(delayMs = 900) {
    stopPvpLiveLoop();
    const delay = Math.max(450, Math.min(2200, asNum(delayMs || 900)));
    state.v3.pvpLiveTimer = setTimeout(async () => {
      state.v3.pvpLiveTimer = null;
      const session = state.v3.pvpSession;
      if (!session || String(session.status || "").toLowerCase() !== "active" || !session.session_ref) {
        renderPvpTickLine(session, state.v3.pvpTickMeta);
        return;
      }
      try {
        await fetchPvpMatchTick(String(session.session_ref || ""));
        state.v3.pvpLiveErrors = 0;
      } catch (err) {
        state.v3.pvpLiveErrors += 1;
        if (state.v3.pvpLiveErrors >= 2) {
          try {
            await fetchPvpSessionState(String(session.session_ref || ""));
            state.v3.pvpLiveErrors = 0;
          } catch (_) {}
        }
      } finally {
        const nextSession = state.v3.pvpSession;
        if (nextSession && String(nextSession.status || "").toLowerCase() === "active") {
          queuePvpLiveLoop(state.v3.pvpTickMs || 1000);
        }
      }
    }, delay);
  }

  function ensurePvpLiveLoop() {
    const session = state.v3.pvpSession;
    if (session && String(session.status || "").toLowerCase() === "active" && session.session_ref) {
      queuePvpLiveLoop(state.v3.pvpTickMs || 1000);
      return;
    }
    stopPvpLiveLoop();
  }

  function stopTransientTimers() {
    stopPvpLiveLoop();
    if (state.ui.pulseTimer) {
      clearTimeout(state.ui.pulseTimer);
      state.ui.pulseTimer = null;
    }
    if (state.v3.quoteTimer) {
      clearTimeout(state.v3.quoteTimer);
      state.v3.quoteTimer = null;
    }
    if (state.telemetry.perfTimer) {
      clearTimeout(state.telemetry.perfTimer);
      state.telemetry.perfTimer = null;
    }
    if (state.telemetry.sceneTimer) {
      clearTimeout(state.telemetry.sceneTimer);
      state.telemetry.sceneTimer = null;
    }
  }

  function bindPageLifecycle() {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stopPvpLiveLoop();
        return;
      }
      ensurePvpLiveLoop();
      if (state.v3.pvpSession?.session_ref) {
        fetchPvpSessionState(String(state.v3.pvpSession.session_ref)).catch(() => {});
      }
    });
    window.addEventListener("beforeunload", () => {
      stopTransientTimers();
    });
  }

  function renderPvpLeaderboard(list = []) {
    const host = byId("pvpBoardList");
    if (!host) {
      return;
    }
    const rows = Array.isArray(list) ? list : [];
    if (!rows.length) {
      host.innerHTML = `<li class="muted">Liderlik verisi henuz yok.</li>`;
      return;
    }
    host.innerHTML = rows
      .slice(0, 8)
      .map((row) => {
        const rank = asNum(row.rank || 0) || "-";
        const name = String(row.public_name || `u${asNum(row.user_id || 0)}`);
        const rating = asNum(row.rating || 1000);
        const total = asNum(row.matches_total || 0);
        const last = formatTime(row.last_match_at);
        return `
          <li class="pvpBoardRow">
            <strong>#${rank} ${name}</strong>
            <span class="time">R ${rating}</span>
            <span class="time">${total} mac</span>
            <span class="time">${last}</span>
          </li>
        `;
      })
      .join("");
  }

  function setPvpPanelState(status = "idle", outcome = "") {
    const panel = document.querySelector(".pvpPanel");
    if (!panel) {
      return;
    }
    panel.classList.remove("engaged", "resolved-win", "resolved-loss");
    const cleanStatus = String(status || "").toLowerCase();
    const cleanOutcome = String(outcome || "").toLowerCase();
    if (cleanStatus === "active") {
      panel.classList.add("engaged");
      return;
    }
    if (cleanStatus === "resolved") {
      if (cleanOutcome === "win") {
        panel.classList.add("resolved-win");
      } else if (cleanOutcome === "loss") {
        panel.classList.add("resolved-loss");
      }
    }
  }

  function syncPvpSessionUi(session, meta = {}) {
    state.v3.pvpSession = session || null;
    state.v3.pvpTickMeta = meta && meta.tick ? meta.tick : state.v3.pvpTickMeta;
    const sessionRef = String(session?.session_ref || "");
    if (sessionRef && sessionRef !== state.v3.pvpTimelineSessionRef) {
      resetPvpTimeline(session);
      hydratePvpTimelineFromSession(session);
    } else if (!sessionRef && state.v3.pvpTimelineSessionRef) {
      state.v3.pvpTimelineSessionRef = "";
      state.v3.pvpTimeline = [];
      state.v3.pvpReplay = [];
    }
    const statusBadge = byId("pvpStatus");
    if (!statusBadge) {
      return;
    }
    const transport = String((session && session.transport) || meta.transport || state.v3.pvpTransport || "poll");
    const tickMs = asNum((session && session.tick_ms) || meta.tick_ms || state.v3.pvpTickMs || 1000);
    const actionWindowMs = asNum(
      (session && session.action_window_ms) || meta.action_window_ms || state.v3.pvpActionWindowMs || 800
    );
    state.v3.pvpTransport = transport || "poll";
    state.v3.pvpTickMs = tickMs || 1000;
    state.v3.pvpActionWindowMs = actionWindowMs || 800;

    byId("pvpTransport").textContent = String(state.v3.pvpTransport || "poll").toUpperCase();
    byId("pvpTick").textContent = `${asNum(state.v3.pvpTickMs)} ms`;
    byId("pvpWindow").textContent = `${asNum(state.v3.pvpActionWindowMs)} ms`;
    updatePvpQueueLine();

    const startBtn = byId("pvpStartBtn");
    const refreshBtn = byId("pvpRefreshBtn");
    const resolveBtn = byId("pvpResolveBtn");
    const strikeBtn = byId("pvpStrikeBtn");
    const guardBtn = byId("pvpGuardBtn");
    const chargeBtn = byId("pvpChargeBtn");

    if (!session) {
      state.v3.pvpTickMeta = null;
      setPvpPanelState("idle");
      statusBadge.textContent = "Duel Hazir";
      statusBadge.className = "badge info";
      byId("pvpSessionLine").textContent = "Session yok";
      byId("pvpExpected").textContent = "-";
      animateTextSwap(byId("pvpStats"), "Skor 0-0 | Combo 0-0 | Hamle 0-0");
      animateTextSwap(byId("pvpLastOutcome"), "Sonuc bekleniyor");
      if (startBtn) startBtn.disabled = false;
      if (refreshBtn) refreshBtn.disabled = false;
      if (resolveBtn) resolveBtn.disabled = true;
      if (strikeBtn) strikeBtn.disabled = true;
      if (guardBtn) guardBtn.disabled = true;
      if (chargeBtn) chargeBtn.disabled = true;
      renderPvpTimeline();
      renderPvpReplayStrip();
      renderPvpTickLine(null, null);
      renderPvpMomentumAndObjectives(null);
      renderPvpCadence(null, null);
      renderPvpDuelTheater(null, null);
      renderPvpCinematicDirector(null, null);
      renderPvpRadar(null, null);
      ensurePvpLiveLoop();
      renderTelemetryDeck(state.data || {});
      return;
    }

    const status = String(session.status || "active").toLowerCase();
    const outcome = String(session.result?.outcome_for_viewer || "").toLowerCase();
    setPvpPanelState(status, outcome);
    syncPvpReplayFromSession(session);
    if (status === "resolved") {
      statusBadge.textContent = outcome ? `Duel ${outcome.toUpperCase()}` : "Duel Cozuldu";
      statusBadge.className = outcome === "win" ? "badge" : outcome === "loss" ? "badge warn" : "badge info";
      appendPvpTimelineEntry({
        key: `${sessionRef}:resolve:${Number(session.result?.id || 0)}`,
        tone: "resolve",
        label: `RESOLVE ${String(outcome || session.result?.outcome || "done").toUpperCase()}`,
        meta: `R ${asNum(session.result?.rating_delta || 0)} | +${asNum(session.result?.reward?.sc || 0)} SC`,
        ts: Date.now()
      });
    } else if (status === "active") {
      statusBadge.textContent = "Duel Aktif";
      statusBadge.className = "badge warn";
    } else if (status === "expired") {
      statusBadge.textContent = "Session Expired";
      statusBadge.className = "badge warn";
    } else {
      statusBadge.textContent = status.toUpperCase();
      statusBadge.className = "badge info";
    }

    const viewerSide = String(session.viewer_side || "left").toUpperCase();
    byId("pvpSessionLine").textContent = `#${asNum(session.session_id)} | ${viewerSide} | ${sessionRef.slice(0, 14) || "-"}`;
    byId("pvpExpected").textContent = String(session.next_expected_action || "-").toUpperCase();
    animateTextSwap(
      byId("pvpStats"),
      `Skor ${asNum(session.score?.self)}-${asNum(session.score?.opponent)} | ` +
        `Combo ${asNum(session.combo?.self)}-${asNum(session.combo?.opponent)} | ` +
        `Hamle ${asNum(session.action_count?.self)}-${asNum(session.action_count?.opponent)}`
    );

    const reward = session.result?.reward || {};
    if (status === "resolved") {
      animateTextSwap(
        byId("pvpLastOutcome"),
        `Sonuc ${String(session.result?.outcome_for_viewer || session.result?.outcome || "-").toUpperCase()} | ` +
          `+${asNum(reward.sc)} SC +${asNum(reward.rc)} RC | Rating ${
            asNum(session.result?.rating_delta) >= 0 ? "+" : ""
          }${asNum(session.result?.rating_delta)}`
      );
    } else {
      animateTextSwap(
        byId("pvpLastOutcome"),
        `TTL ${asNum(session.ttl_sec_left)}s | Opp ${String(session.opponent_type || "shadow")}`
      );
    }

    const canInput = status === "active";
    if (startBtn) startBtn.disabled = canInput;
    if (refreshBtn) refreshBtn.disabled = false;
    if (resolveBtn) {
      resolveBtn.disabled = !canInput || asNum(session.action_count?.self) < 6;
      resolveBtn.textContent = canInput
        ? `Dueli Coz (${Math.max(0, 6 - asNum(session.action_count?.self))})`
        : "Dueli Coz";
    }
    if (strikeBtn) strikeBtn.disabled = !canInput;
    if (guardBtn) guardBtn.disabled = !canInput;
    if (chargeBtn) chargeBtn.disabled = !canInput;
    renderPvpTimeline();
    renderPvpTickLine(session, state.v3.pvpTickMeta);
    renderPvpMomentumAndObjectives(session);
    renderPvpCadence(session, state.v3.pvpTickMeta);
    renderPvpDuelTheater(session, state.v3.pvpTickMeta);
    renderPvpCinematicDirector(session, state.v3.pvpTickMeta);
    renderPvpRadar(session, state.v3.pvpTickMeta);
    ensurePvpLiveLoop();
    renderCombatHudPanel();
    renderTelemetryDeck(state.data || {});
  }

  async function fetchPvpSessionState(sessionRef = "") {
    const query = new URLSearchParams({
      uid: state.auth.uid,
      ts: state.auth.ts,
      sig: state.auth.sig
    });
    if (sessionRef) {
      query.set("session_ref", sessionRef);
    }
    const t0 = performance.now();
    const res = await fetch(`/webapp/api/pvp/session/state?${query.toString()}`);
    markLatency(performance.now() - t0);
    const payload = await res.json();
    if (!res.ok || !payload.success) {
      const error = new Error(payload.error || `pvp_session_state_failed:${res.status}`);
      error.code = res.status;
      throw error;
    }
    renewAuth(payload);
    state.v3.pvpAuthAvailable = true;
    const data = payload.data || {};
    const session = data.session || null;
    syncPvpSessionUi(session, data);
    return session;
  }

  async function fetchPvpMatchTick(sessionRef) {
    const cleanSessionRef = String(sessionRef || "").trim();
    if (!cleanSessionRef) {
      throw new Error("session_ref_required");
    }
    const query = new URLSearchParams({
      uid: state.auth.uid,
      ts: state.auth.ts,
      sig: state.auth.sig,
      session_ref: cleanSessionRef
    }).toString();
    const t0 = performance.now();
    const res = await fetch(`/webapp/api/pvp/match/tick?${query}`);
    markLatency(performance.now() - t0);
    const payload = await res.json();
    if (!res.ok || !payload.success) {
      const error = new Error(payload.error || `pvp_match_tick_failed:${res.status}`);
      error.code = res.status;
      throw error;
    }
    renewAuth(payload);
    const data = payload.data || {};
    state.v3.pvpTickMeta = data.tick || null;
    syncPvpSessionUi(data.session || null, data);
    if (data.tick && data.tick.session_ref) {
      const diagnostics = data.diagnostics || data.tick?.diagnostics || {};
      const drift = asNum(diagnostics.score_drift || 0);
      const recommendation = String(diagnostics.recommendation || "balanced").toUpperCase();
      const shadow = data.shadow || data.tick?.shadow || null;
      appendPvpTimelineEntry({
        key: `${String(data.tick.session_ref)}:tick:${asNum(data.tick.tick_seq || 0)}`,
        tone: "tick",
        label: `TICK #${asNum(data.tick.tick_seq || 0)}`,
        meta:
          `${String(data.tick.phase || "combat").toUpperCase()} | ${String(data.tick.transport || "poll").toUpperCase()} | ` +
          `DRIFT ${drift >= 0 ? "+" : ""}${drift} | ${recommendation}` +
          (shadow
            ? ` | SH ${String(shadow.input_action || "-").toUpperCase()} ${
                Boolean(shadow.accepted) ? "OK" : "MISS"
              }`
            : ""),
        ts: Number(data.tick.server_tick || Date.now())
      });
    }
    return data;
  }

  async function startPvpSession(modeSuggested = "balanced") {
    const t0 = performance.now();
    const res = await fetch("/webapp/api/pvp/session/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: state.auth.uid,
        ts: state.auth.ts,
        sig: state.auth.sig,
        request_id: `webapp_pvp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        mode_suggested: modeSuggested,
        transport: "poll"
      })
    });
    markLatency(performance.now() - t0);
    const payload = await res.json();
    if (!res.ok || !payload.success) {
      const error = new Error(payload.error || `pvp_session_start_failed:${res.status}`);
      error.code = res.status;
      throw error;
    }
    renewAuth(payload);
    state.v3.pvpAuthAvailable = true;
    const data = payload.data || {};
    const session = data.session || null;
    syncPvpSessionUi(session, data);
    return session;
  }

  async function postPvpSessionAction(inputAction, queuedAt) {
    const session = state.v3.pvpSession;
    if (!session || !session.session_ref) {
      throw new Error("pvp_session_not_found");
    }
    const actionSeq = asNum(session.action_count?.self) + 1;
    const latencyMs = Math.max(0, Date.now() - Number(queuedAt || Date.now()));
    const t0 = performance.now();
    const res = await fetch("/webapp/api/pvp/session/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: state.auth.uid,
        ts: state.auth.ts,
        sig: state.auth.sig,
        session_ref: session.session_ref,
        action_seq: actionSeq,
        input_action: String(inputAction || "").toLowerCase(),
        latency_ms: latencyMs,
        client_ts: Date.now()
      })
    });
    markLatency(performance.now() - t0);
    const payload = await res.json();
    if (!res.ok || !payload.success) {
      const error = new Error(payload.error || `pvp_session_action_failed:${res.status}`);
      error.code = res.status;
      throw error;
    }
    renewAuth(payload);
    state.v3.pvpAuthAvailable = true;
    const data = payload.data || {};
    syncPvpSessionUi(data.session || null, data);
    if (data.action && !data.duplicate) {
      appendPvpTimelineEntry({
        key: `${String(data.session?.session_ref || session.session_ref)}:action:${asNum(data.action.action_seq || 0)}`,
        tone: data.action.accepted ? "action" : "reject",
        label: `${normalizePvpInputLabel(inputAction)} ${data.action.accepted ? "OK" : "MISS"}`,
        meta: `#${asNum(data.action.action_seq || 0)} | d${asNum(data.action.score_delta || 0)} | exp ${String(
          data.action.expected_action || "-"
        ).toUpperCase()}${
          data.action.accepted
            ? ""
            : ` | ${String(data.action.reject_reason || "rejected").replace(/_/g, " ").toUpperCase()}`
        }`,
        ts: Date.now()
      });
      pushPvpReplayEntry({
        seq: asNum(data.action.action_seq || 0),
        input: inputAction,
        accepted: Boolean(data.action.accepted),
        scoreDelta: asNum(data.action.score_delta || 0),
        reason: String(data.action.reject_reason || "")
      });
      triggerArenaPulse(data.action.accepted ? actionToneForInput(inputAction) : "aggressive", {
        action: inputAction,
        accepted: Boolean(data.action.accepted),
        label: data.action.accepted
          ? `PVP ${normalizePvpInputLabel(inputAction)} +${asNum(data.action.score_delta || 0)}`
          : `PVP REJECT ${String(data.action.reject_reason || "invalid").replace(/_/g, " ").toUpperCase()}`
      });
    }
    return data;
  }

  async function drainPvpQueue() {
    if (state.v3.pvpDraining) {
      return;
    }
    state.v3.pvpDraining = true;
    try {
      while (state.v3.pvpQueue.length > 0) {
        const next = state.v3.pvpQueue.shift();
        updatePvpQueueLine();
        await postPvpSessionAction(next.action, next.queuedAt);
      }
    } finally {
      state.v3.pvpDraining = false;
      updatePvpQueueLine();
    }
  }

  async function enqueuePvpAction(action) {
    const session = state.v3.pvpSession;
    if (!session || !session.session_ref) {
      throw new Error("pvp_session_not_found");
    }
    state.v3.pvpQueue.push({
      action: String(action || "").toLowerCase(),
      queuedAt: Date.now()
    });
    updatePvpQueueLine();
    await drainPvpQueue();
  }

  async function resolvePvpSession() {
    const session = state.v3.pvpSession;
    if (!session || !session.session_ref) {
      throw new Error("pvp_session_not_found");
    }
    const t0 = performance.now();
    const res = await fetch("/webapp/api/pvp/session/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: state.auth.uid,
        ts: state.auth.ts,
        sig: state.auth.sig,
        session_ref: session.session_ref
      })
    });
    markLatency(performance.now() - t0);
    const payload = await res.json();
    if (!res.ok || !payload.success) {
      const error = new Error(payload.error || `pvp_session_resolve_failed:${res.status}`);
      error.code = res.status;
      throw error;
    }
    renewAuth(payload);
    state.v3.pvpAuthAvailable = true;
    const data = payload.data || {};
    syncPvpSessionUi(data.session || null, data);
    if (data.session?.result) {
      pushPvpReplayEntry({
        seq: asNum(data.session?.action_count?.self || 0),
        input: "resolve",
        accepted: true,
        scoreDelta: asNum(data.session?.result?.rating_delta || 0),
        tone: "resolve"
      });
    }
    return data;
  }

  async function loadPvpLeaderboard() {
    const query = new URLSearchParams({
      uid: state.auth.uid,
      ts: state.auth.ts,
      sig: state.auth.sig,
      limit: "10"
    }).toString();
    const t0 = performance.now();
    const res = await fetch(`/webapp/api/pvp/leaderboard/live?${query}`);
    markLatency(performance.now() - t0);
    const payload = await res.json();
    if (!res.ok || !payload.success) {
      const error = new Error(payload.error || `pvp_leaderboard_failed:${res.status}`);
      error.code = res.status;
      throw error;
    }
    renewAuth(payload);
    const data = payload.data || {};
    const list = Array.isArray(data.leaderboard) ? data.leaderboard : [];
    state.v3.pvpLeaderboard = list;
    renderPvpLeaderboard(list);
    return list;
  }

  function setHudPulseTone(tone = "info") {
    const body = document.body;
    if (!body) {
      return;
    }
    body.classList.remove("pulse-safe", "pulse-balanced", "pulse-aggressive", "pulse-reveal", "pulse-info");
    body.classList.add(`pulse-${tone}`);
    if (state.ui.pulseTimer) {
      clearTimeout(state.ui.pulseTimer);
      state.ui.pulseTimer = null;
    }
    state.ui.pulseTimer = setTimeout(() => {
      body.classList.remove("pulse-safe", "pulse-balanced", "pulse-aggressive", "pulse-reveal", "pulse-info");
      state.ui.pulseTimer = null;
    }, 560);
  }

  function triggerArenaPulse(tone, options = {}) {
    const pulseTone = normalizePulseTone(tone);
    const opts = options && typeof options === "object" ? options : {};
    const action = String(opts.action || "").toLowerCase();
    const accepted = opts.accepted !== false;
    playAudioCue(pulseTone);
    const burstLabels = {
      safe: "SAFE WINDOW",
      balanced: "BALANCE LOCK",
      aggressive: "PRESSURE SPIKE",
      reveal: "REVEAL SURGE",
      info: "NEXUS PING"
    };
    const burstLabel = String(opts.label || burstLabels[pulseTone] || burstLabels.info)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 34);
    state.v3.pulseTone = pulseTone;
    state.v3.pulseLabel = burstLabel;
    state.v3.pulseAt = Date.now();
    pushCombatChainEvent(action || "pulse", {
      tone: pulseTone,
      accepted,
      ts: state.v3.pulseAt
    });
    spawnHudBurst(pulseTone, burstLabel);
    pushCombatTicker(`Nexus pulse: ${burstLabel.toLowerCase()}`, pulseTone);
    updateCombatOverlay(pulseTone, burstLabel, action, accepted);
    if (!state.arena) {
      setHudPulseTone(pulseTone);
      return;
    }
    const palette = {
      safe: 0x70ffa0,
      balanced: 0x3df8c2,
      aggressive: 0xff5679,
      reveal: 0xffb85c,
      info: 0xa6c3ff
    };
    const color = palette[pulseTone] || palette.info;
    if (state.arena.glow && state.arena.glow.material) {
      state.arena.glow.material.color.setHex(color);
      state.arena.glow.material.opacity = 0.95;
      gsap.to(state.arena.glow.material, { opacity: 0.2, duration: 0.65, ease: "power2.out" });
    }
    if (state.arena.pulseShell && state.arena.pulseShell.material) {
      state.arena.pulseShell.material.color.setHex(color);
      state.arena.pulseShell.material.opacity = 0.5;
      gsap.fromTo(
        state.arena.pulseShell.scale,
        { x: 1, y: 1, z: 1 },
        { x: 1.2, y: 1.2, z: 1.2, duration: 0.45, ease: "power2.out", yoyo: true, repeat: 1 }
      );
      gsap.to(state.arena.pulseShell.material, { opacity: 0.08, duration: 0.8, ease: "power2.out" });
    }

    const pulseWaves = Array.isArray(state.arena.pulseWaves) ? state.arena.pulseWaves : [];
    if (pulseWaves.length) {
      const cursor = Number(state.arena.pulseWaveCursor || 0) % pulseWaves.length;
      const wave = pulseWaves[cursor];
      state.arena.pulseWaveCursor = (cursor + 1) % pulseWaves.length;
      if (wave && wave.material) {
        wave.visible = true;
        wave.material.color.setHex(color);
        wave.material.opacity = 0.72;
        wave.scale.setScalar(0.88);
        gsap.to(wave.scale, { x: 1.42, y: 1.42, z: 1.42, duration: 0.5, ease: "power2.out" });
        gsap.to(wave.material, {
          opacity: 0,
          duration: 0.56,
          ease: "power2.in",
          onComplete: () => {
            wave.visible = false;
            wave.scale.setScalar(1);
          }
        });
      }
    }

    const tracerBeams = Array.isArray(state.arena.tracerBeams) ? state.arena.tracerBeams : [];
    const tracerMeta = Array.isArray(state.arena.tracerMeta) ? state.arena.tracerMeta : [];
    const tracerLimit = Math.max(0, Math.min(asNum(state.arena.tracerLimit || tracerBeams.length), tracerBeams.length));
    if (tracerLimit > 0 && tracerMeta.length) {
      const burstByTone = {
        safe: 1,
        balanced: 2,
        aggressive: 4,
        reveal: 3,
        info: 1
      };
      const pulseCount = state.ui.reducedMotion ? 1 : burstByTone[pulseTone] || 1;
      const source = new THREE.Vector3();
      const target = new THREE.Vector3();
      const direction = new THREE.Vector3();
      const midpoint = new THREE.Vector3();
      const up = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < pulseCount; i += 1) {
        const cursor = Number(state.arena.tracerCursor || 0) % tracerLimit;
        const beam = tracerBeams[cursor];
        const meta = tracerMeta[cursor];
        state.arena.tracerCursor = (cursor + 1) % tracerLimit;
        if (!beam || !meta || !beam.material) {
          continue;
        }
        const startRadius = 1.9 + Math.random() * 1.8;
        const endRadius = 6.4 + Math.random() * 3.2;
        const startAngle = Math.random() * Math.PI * 2;
        const sweep = (0.44 + Math.random() * 0.92) * (Math.random() > 0.5 ? 1 : -1);
        const yJitter = (Math.random() - 0.5) * (state.ui.reducedMotion ? 0.5 : 1.15);
        source.set(Math.cos(startAngle) * startRadius, -0.32 + yJitter * 0.55, Math.sin(startAngle) * startRadius);
        target.set(Math.cos(startAngle + sweep) * endRadius, 0.4 + yJitter, Math.sin(startAngle + sweep) * endRadius);
        direction.copy(target).sub(source);
        const length = Math.max(0.6, direction.length());
        midpoint.copy(source).add(target).multiplyScalar(0.5);
        beam.position.copy(midpoint);
        beam.quaternion.setFromUnitVectors(up, direction.normalize());
        const width =
          pulseTone === "aggressive"
            ? 1.6
            : pulseTone === "reveal"
              ? 1.38
              : pulseTone === "balanced"
                ? 1.18
                : 1.04;
        beam.scale.set(width, length, width);
        beam.material.color.setHex(accepted ? color : 0xff4f6d);
        beam.material.opacity = accepted ? 0.8 : 0.68;
        beam.visible = true;
        meta.life = state.ui.reducedMotion ? 0.2 : 0.32 + Math.random() * 0.14;
        meta.maxLife = meta.life;
        meta.width = width;
      }
    }

    const impactNodes = Array.isArray(state.arena.impactNodes) ? state.arena.impactNodes : [];
    const impactMeta = Array.isArray(state.arena.impactMeta) ? state.arena.impactMeta : [];
    const impactLimit = Math.max(0, Math.min(asNum(state.arena.impactLimit || impactNodes.length), impactNodes.length));
    if (impactLimit > 0 && impactMeta.length) {
      const burstByTone = {
        safe: 1,
        balanced: 2,
        aggressive: 3,
        reveal: 3,
        info: 1
      };
      const impactCount = state.ui.reducedMotion ? 1 : burstByTone[pulseTone] || 1;
      for (let i = 0; i < impactCount; i += 1) {
        const cursor = Number(state.arena.impactCursor || 0) % impactLimit;
        const node = impactNodes[cursor];
        const meta = impactMeta[cursor];
        state.arena.impactCursor = (cursor + 1) % impactLimit;
        if (!node || !meta || !node.material) {
          continue;
        }
        const angle = Math.random() * Math.PI * 2;
        const radius = 2.6 + Math.random() * 5.1;
        node.position.set(Math.cos(angle) * radius, -0.4 + Math.random() * 2.0, Math.sin(angle) * radius);
        node.scale.setScalar(state.ui.reducedMotion ? 0.58 : 0.42);
        node.material.color.setHex(accepted ? color : 0xff4f6d);
        node.material.opacity = accepted ? 0.78 : 0.64;
        node.visible = true;
        meta.life = state.ui.reducedMotion ? 0.22 : 0.34 + Math.random() * 0.16;
        meta.maxLife = meta.life;
      }
    }

    gsap.fromTo(
      state.arena.ring.scale,
      { x: 1, y: 1, z: 1 },
      { x: 1.12, y: 1.12, z: 1.12, yoyo: true, repeat: 1, duration: 0.24, ease: "power2.out" }
    );
    if (state.arena.ringOuter) {
      gsap.fromTo(
        state.arena.ringOuter.scale,
        { x: 1, y: 1, z: 1 },
        { x: 1.08, y: 1.08, z: 1.08, yoyo: true, repeat: 1, duration: 0.28, ease: "power2.out" }
      );
    }
    if (!state.ui.reducedMotion && state.arena.camera) {
      const camera = state.arena.camera;
      const baseX = camera.position.x;
      const baseY = camera.position.y;
      const shake = pulseTone === "aggressive" ? 0.14 : pulseTone === "reveal" ? 0.1 : 0.06;
      const impulseBoost = pulseTone === "aggressive" ? 0.52 : pulseTone === "reveal" ? 0.42 : pulseTone === "balanced" ? 0.3 : 0.24;
      state.arena.cameraImpulse = Math.min(1.6, asNum(state.arena.cameraImpulse || 0) + impulseBoost);
      gsap.to(camera.position, {
        x: baseX + (Math.random() - 0.5) * shake,
        y: baseY + (Math.random() - 0.5) * shake,
        duration: 0.08,
        yoyo: true,
        repeat: 1,
        ease: "power1.inOut"
      });
    }
    if (Array.isArray(state.arena.drones) && !state.ui.reducedMotion) {
      state.arena.drones.forEach((drone, index) => {
        if (!drone) {
          return;
        }
        const delay = index * 0.01;
        gsap.to(drone.scale, {
          x: drone.scale.x * 1.14,
          y: drone.scale.y * 1.14,
          z: drone.scale.z * 1.14,
          duration: 0.14,
          yoyo: true,
          repeat: 1,
          delay,
          ease: "power1.out"
        });
      });
    }
    if (state.arena.floorGrid?.material) {
      state.arena.floorGrid.material.opacity = Math.max(asNum(state.arena.floorGrid.material.opacity || 0.14), 0.34);
      gsap.to(state.arena.floorGrid.material, { opacity: 0.14, duration: 0.52, ease: "power2.out" });
    }
    if (Array.isArray(state.arena.pylons) && !state.ui.reducedMotion) {
      state.arena.pylons.forEach((pylon, index) => {
        if (!pylon) {
          return;
        }
        const delay = index * 0.012;
        gsap.fromTo(
          pylon.scale,
          { x: pylon.scale.x, y: pylon.scale.y, z: pylon.scale.z },
          {
            x: pylon.scale.x * 1.08,
            y: pylon.scale.y * 1.22,
            z: pylon.scale.z * 1.08,
            duration: 0.18,
            yoyo: true,
            repeat: 1,
            ease: "power2.out",
            delay
          }
        );
      });
    }
    if (state.arena.duelCoreSelf && state.arena.duelCoreSelf.material) {
      state.arena.duelCoreSelf.material.color.setHex(pulseTone === "aggressive" ? 0xff6f8c : pulseTone === "reveal" ? 0xffca73 : 0x6fd7ff);
      gsap.fromTo(
        state.arena.duelCoreSelf.scale,
        { x: state.arena.duelCoreSelf.scale.x, y: state.arena.duelCoreSelf.scale.y, z: state.arena.duelCoreSelf.scale.z },
        {
          x: state.arena.duelCoreSelf.scale.x * 1.14,
          y: state.arena.duelCoreSelf.scale.y * 1.14,
          z: state.arena.duelCoreSelf.scale.z * 1.14,
          duration: 0.2,
          yoyo: true,
          repeat: 1,
          ease: "power2.out"
        }
      );
    }
    if (state.arena.duelCoreOpp && state.arena.duelCoreOpp.material) {
      state.arena.duelCoreOpp.material.color.setHex(pulseTone === "safe" ? 0x71ffad : pulseTone === "reveal" ? 0xffca73 : 0xff8ba3);
      gsap.fromTo(
        state.arena.duelCoreOpp.scale,
        { x: state.arena.duelCoreOpp.scale.x, y: state.arena.duelCoreOpp.scale.y, z: state.arena.duelCoreOpp.scale.z },
        {
          x: state.arena.duelCoreOpp.scale.x * 1.1,
          y: state.arena.duelCoreOpp.scale.y * 1.1,
          z: state.arena.duelCoreOpp.scale.z * 1.1,
          duration: 0.2,
          yoyo: true,
          repeat: 1,
          ease: "power2.out"
        }
      );
    }
    if (Array.isArray(state.arena.duelBridgeSegments)) {
      const bridgeFlash = pulseTone === "aggressive" ? 0xff6a8d : pulseTone === "reveal" ? 0xffcc80 : 0x84cbff;
      state.arena.duelBridgeSegments.forEach((segment, idx) => {
        if (!segment || !segment.material) {
          return;
        }
        segment.material.color.setHex(bridgeFlash);
        segment.material.opacity = Math.max(asNum(segment.material.opacity || 0), 0.42);
        gsap.to(segment.material, {
          opacity: 0.16,
          delay: idx * 0.012,
          duration: 0.34,
          ease: "power2.out"
        });
      });
    }
    if (Array.isArray(state.arena.stormRibbons)) {
      state.arena.stormRibbons.forEach((ribbon, index) => {
        if (!ribbon || !ribbon.material) {
          return;
        }
        ribbon.material.color.setHex(accepted ? color : 0xff4f6d);
        ribbon.material.opacity = Math.max(asNum(ribbon.material.opacity || 0.08), pulseTone === "aggressive" ? 0.48 : 0.38);
        const pulseScale = pulseTone === "aggressive" ? 1.2 : pulseTone === "reveal" ? 1.14 : 1.08;
        gsap.fromTo(
          ribbon.scale,
          { x: ribbon.scale.x, y: ribbon.scale.y, z: ribbon.scale.z },
          {
            x: ribbon.scale.x * pulseScale,
            y: ribbon.scale.y * pulseScale,
            z: ribbon.scale.z * pulseScale,
            duration: 0.2,
            yoyo: true,
            repeat: 1,
            ease: "power2.out",
            delay: index * 0.02
          }
        );
      });
    }
    if (Array.isArray(state.arena.raidBeacons) && !state.ui.reducedMotion) {
      state.arena.raidBeacons.forEach((beacon, index) => {
        if (!beacon || !beacon.material) {
          return;
        }
        beacon.material.color.setHex(accepted ? color : 0xff4f6d);
        if (beacon.material.emissive?.setHex) {
          beacon.material.emissive.setHex(accepted ? color : 0xff4f6d);
        }
        gsap.fromTo(
          beacon.scale,
          { x: beacon.scale.x, y: beacon.scale.y, z: beacon.scale.z },
          {
            x: beacon.scale.x * 1.08,
            y: beacon.scale.y * 1.32,
            z: beacon.scale.z * 1.08,
            duration: 0.18,
            yoyo: true,
            repeat: 1,
            delay: index * 0.015,
            ease: "power2.out"
          }
        );
      });
    }
    if (state.arena.bossCore && state.arena.bossCore.material) {
      const bossFlash = pulseTone === "aggressive" ? 0xff6a8d : pulseTone === "reveal" ? 0xffca73 : pulseTone === "safe" ? 0x72ffb0 : 0x7bcfff;
      state.arena.bossCore.material.color.setHex(bossFlash);
      if (state.arena.bossCore.material.emissive?.setHex) {
        state.arena.bossCore.material.emissive.setHex(bossFlash);
      }
      gsap.fromTo(
        state.arena.bossCore.scale,
        { x: state.arena.bossCore.scale.x, y: state.arena.bossCore.scale.y, z: state.arena.bossCore.scale.z },
        {
          x: state.arena.bossCore.scale.x * (pulseTone === "aggressive" ? 1.24 : 1.16),
          y: state.arena.bossCore.scale.y * (pulseTone === "aggressive" ? 1.24 : 1.16),
          z: state.arena.bossCore.scale.z * (pulseTone === "aggressive" ? 1.24 : 1.16),
          duration: 0.18,
          yoyo: true,
          repeat: 1,
          ease: "power2.out"
        }
      );
    }
    if (state.arena.bossAura?.material) {
      state.arena.bossAura.material.color.setHex(accepted ? color : 0xff4f6d);
      state.arena.bossAura.material.opacity = Math.max(asNum(state.arena.bossAura.material.opacity || 0.1), pulseTone === "aggressive" ? 0.5 : 0.4);
      gsap.fromTo(
        state.arena.bossAura.scale,
        { x: state.arena.bossAura.scale.x, y: state.arena.bossAura.scale.y, z: state.arena.bossAura.scale.z },
        {
          x: state.arena.bossAura.scale.x * (pulseTone === "aggressive" ? 1.32 : 1.2),
          y: state.arena.bossAura.scale.y * (pulseTone === "aggressive" ? 1.32 : 1.2),
          z: state.arena.bossAura.scale.z * (pulseTone === "aggressive" ? 1.32 : 1.2),
          duration: 0.22,
          yoyo: true,
          repeat: 1,
          ease: "power2.out"
        }
      );
      gsap.to(state.arena.bossAura.material, { opacity: 0.14, duration: 0.36, ease: "power2.out" });
    }
    if (Array.isArray(state.arena.bossShieldRings)) {
      state.arena.bossShieldRings.forEach((ring, index) => {
        if (!ring || !ring.material) {
          return;
        }
        ring.material.color.setHex(accepted ? color : 0xff4f6d);
        ring.material.opacity = Math.max(asNum(ring.material.opacity || 0.16), pulseTone === "aggressive" ? 0.62 : 0.48);
        gsap.to(ring.material, { opacity: 0.2, duration: 0.42, delay: index * 0.02, ease: "power2.out" });
        if (!state.ui.reducedMotion) {
          gsap.fromTo(
            ring.scale,
            { x: ring.scale.x, y: ring.scale.y, z: ring.scale.z },
            {
              x: ring.scale.x * 1.12,
              y: ring.scale.y * 1.12,
              z: ring.scale.z * 1.12,
              duration: 0.2,
              yoyo: true,
              repeat: 1,
              delay: index * 0.02,
              ease: "power2.out"
            }
          );
        }
      });
    }
    if (Array.isArray(state.arena.bossSpikes) && !state.ui.reducedMotion) {
      state.arena.bossSpikes.forEach((spike, index) => {
        if (!spike || !spike.material) {
          return;
        }
        spike.material.color.setHex(accepted ? color : 0xff4f6d);
        if (spike.material.emissive?.setHex) {
          spike.material.emissive.setHex(accepted ? color : 0xff4f6d);
        }
        gsap.fromTo(
          spike.scale,
          { x: spike.scale.x, y: spike.scale.y, z: spike.scale.z },
          {
            x: spike.scale.x * 1.08,
            y: spike.scale.y * 1.18,
            z: spike.scale.z * 1.08,
            duration: 0.16,
            yoyo: true,
            repeat: 1,
            delay: index * 0.012,
            ease: "power2.out"
          }
        );
      });
    }

    const sideModelMap = state.arena.sideModelMap || {};
    const enemyRig = sideModelMap.enemy_rig || null;
    const rewardCrate = sideModelMap.reward_crate || null;
    const ambientFx = sideModelMap.ambient_fx || null;
    if (!state.ui.reducedMotion && enemyRig) {
      const enemyKick = pulseTone === "aggressive" ? 0.2 : pulseTone === "reveal" ? 0.14 : 0.1;
      gsap.fromTo(
        enemyRig.rotation,
        { x: enemyRig.rotation.x, y: enemyRig.rotation.y, z: enemyRig.rotation.z },
        {
          x: enemyRig.rotation.x + enemyKick * 0.4,
          y: enemyRig.rotation.y + enemyKick,
          z: enemyRig.rotation.z + enemyKick * 0.24,
          duration: 0.2,
          yoyo: true,
          repeat: 1,
          ease: "power2.out"
        }
      );
    }
    if (!state.ui.reducedMotion && rewardCrate && (pulseTone === "reveal" || action === "charge")) {
      const yNow = rewardCrate.position.y;
      gsap.fromTo(
        rewardCrate.position,
        { y: yNow },
        { y: yNow + 0.42, duration: 0.16, yoyo: true, repeat: 1, ease: "power2.out" }
      );
      gsap.fromTo(
        rewardCrate.scale,
        { x: rewardCrate.scale.x, y: rewardCrate.scale.y, z: rewardCrate.scale.z },
        {
          x: rewardCrate.scale.x * 1.08,
          y: rewardCrate.scale.y * 1.08,
          z: rewardCrate.scale.z * 1.08,
          duration: 0.18,
          yoyo: true,
          repeat: 1,
          ease: "power2.out"
        }
      );
    }
    if (!state.ui.reducedMotion && ambientFx) {
      gsap.fromTo(
        ambientFx.scale,
        { x: ambientFx.scale.x, y: ambientFx.scale.y, z: ambientFx.scale.z },
        {
          x: ambientFx.scale.x * 1.04,
          y: ambientFx.scale.y * 1.04,
          z: ambientFx.scale.z * 1.04,
          duration: 0.22,
          yoyo: true,
          repeat: 1,
          ease: "power1.out"
        }
      );
    }
    setHudPulseTone(pulseTone);
  }

  async function fallbackToCommand(action, payload = {}) {
    const command = commandForAction(action, payload);
    const copied = await copyToClipboard(command);
    const link = `https://t.me/${state.bot}`;
    window.open(link, "_blank");
    showToast(copied ? `Komut kopyalandi: ${command}` : `Botta calistir: ${command}`);
  }

  async function sendBotAction(action, payload = {}) {
    const packet = buildPacket(action, payload);
    if (tg && typeof tg.sendData === "function") {
      tg.sendData(JSON.stringify(packet));
      showToast("Aksiyon bota gonderildi");
      triggerArenaPulse(payload.mode || (action === "reveal_latest" ? "reveal" : "info"), {
        action,
        label: `BOT ACTION ${String(action || "event").replace(/_/g, " ").toUpperCase()}`
      });
      setTimeout(() => {
        loadBootstrap().catch(() => {});
      }, 1400);
      return;
    }
    await fallbackToCommand(action, payload);
  }

  function actionApiPath(action) {
    if (action === "accept_offer") return "/webapp/api/actions/accept";
    if (action === "claim_mission") return "/webapp/api/actions/claim_mission";
    if (action === "complete_latest") return "/webapp/api/actions/complete";
    if (action === "reveal_latest") return "/webapp/api/actions/reveal";
    if (action === "arena_raid") return "/webapp/api/arena/raid";
    if (action === "mint_token") return "/webapp/api/token/mint";
    if (action === "buy_token") return "/webapp/api/token/buy_intent";
    if (action === "submit_token_tx") return "/webapp/api/token/submit_tx";
    return "";
  }

  async function postActionApi(action, payload = {}) {
    const path = actionApiPath(action);
    if (!path) return null;
    const body = {
      uid: state.auth.uid,
      ts: state.auth.ts,
      sig: state.auth.sig,
      ...payload
    };
    const t0 = performance.now();
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    markLatency(performance.now() - t0);
    const result = await response.json();
    if (!response.ok || !result.success) {
      const error = new Error(result.error || `action_failed:${response.status}`);
      error.code = response.status;
      throw error;
    }
    renewAuth(result);
    return result.data || null;
  }

  function actionToast(action, data) {
    if (action === "accept_offer") {
      return data?.duplicate ? "Gorev zaten aktif." : "Gorev baslatildi.";
    }
    if (action === "complete_latest") {
      if (data?.duplicate) return "Bu deneme zaten tamamlanmis.";
      const mode = String(data?.mode_label || "Dengeli");
      const result = String(data?.result || "pending");
      return `Tamamlandi: ${result} | Mod ${mode}`;
    }
    if (action === "reveal_latest") {
      if (data?.duplicate) return "Reveal zaten acilmis.";
      return `Loot: ${String(data?.tier || "common")} | +${asNum(data?.reward?.sc)} SC`;
    }
    if (action === "arena_raid") {
      if (data?.duplicate) return "Raid zaten islenmis.";
      return `Arena ${String(data?.run?.outcome || "win")} | Rating ${asNum(data?.rating_after)}`;
    }
    if (action === "mint_token") {
      const amount = asNum(data?.plan?.tokenAmount || data?.plan?.token_amount);
      const symbol = String(data?.snapshot?.token?.symbol || state.data?.token?.symbol || "TOKEN");
      return `Mint tamamlandi: +${amount} ${symbol}`;
    }
    if (action === "buy_token") {
      const reqId = asNum(data?.request?.id || 0);
      const tokenAmount = asNum(data?.request?.token_amount || data?.quote?.tokenAmount || 0);
      const symbol = String(data?.token?.symbol || state.data?.token?.symbol || "TOKEN");
      return `Talep #${reqId} olustu: ${tokenAmount} ${symbol}`;
    }
    if (action === "submit_token_tx") {
      const reqId = asNum(data?.request?.id || 0);
      return `TX kaydedildi (#${reqId})`;
    }
    if (action === "claim_mission") {
      const status = String(data?.status || "");
      const reward = data?.mission?.reward || {};
      if (status === "claimed") {
        return `Misyon odulu alindi: +${asNum(reward.sc)} SC +${asNum(reward.rc)} RC`;
      }
      if (status === "already_claimed") {
        return "Bu misyon odulu zaten alinmis.";
      }
      if (status === "not_ready") {
        return "Misyon henuz hazir degil.";
      }
      if (status === "not_found") {
        return "Misyon bulunamadi.";
      }
      return "Misyon durumu guncellendi.";
    }
    return "Aksiyon tamamlandi.";
  }

  async function performAction(action, payload = {}) {
    if (action === "arena_raid") {
      const raidEnabled = Boolean(state.v3.featureFlags?.RAID_AUTH_ENABLED);
      if (raidEnabled) {
        try {
          await runAuthoritativeRaid(payload.mode || chooseModeByRisk(asNum(state.data?.risk_score || 0)));
          return;
        } catch (err) {
          const message = String(err?.message || "");
          const shouldFallback =
            message.includes("raid_auth_disabled") ||
            message.includes("raid_session_tables_missing") ||
            Number(err?.code || 0) === 404;
          if (!shouldFallback) {
            throw err;
          }
        }
      }
    }

    try {
      const apiData = await postActionApi(action, payload);
      if (apiData) {
        triggerArenaPulse(payload.mode || (action === "reveal_latest" ? "reveal" : "info"), {
          action,
          label: `ACTION ${String(action || "event").replace(/_/g, " ").toUpperCase()}`
        });
        showToast(actionToast(action, apiData));
        await loadBootstrap();
        return;
      }
    } catch (err) {
      const message = String(err?.message || "");
      const isRouteMissing =
        Number(err?.code || 0) === 404 && (message.toLowerCase().includes("not found") || message.toLowerCase().includes("route"));
      if (!isRouteMissing) {
        throw err;
      }
    }
    await sendBotAction(action, payload);
  }

  async function loadArenaLeaderboard() {
    const query = new URLSearchParams(state.auth).toString();
    const t0 = performance.now();
    const res = await fetch(`/webapp/api/arena/leaderboard?${query}`);
    markLatency(performance.now() - t0);
    const payload = await res.json();
    if (!res.ok || !payload.success) {
      throw new Error(payload.error || `arena_leaderboard_failed:${res.status}`);
    }
    renewAuth(payload);
    const board = payload.data || {};
    const leaders = (board.leaderboard || []).slice(0, 5);
    if (leaders.length > 0) {
      const preview = leaders.map((x, i) => `${i + 1}) ${x.public_name} ${Math.floor(asNum(x.rating))}`).join(" | ");
      showToast(`Arena Top: ${preview}`);
    } else {
      showToast("Arena top listesi bos.");
    }
  }

  function formatStatusClass(status) {
    if (status === "HAZIR") return "badge";
    if (status === "ALINDI") return "badge info";
    return "badge warn";
  }

  function renderOffers(offers) {
    const host = byId("offersList");
    byId("offerBadge").textContent = `${offers.length} aktif`;
    if (!offers.length) {
      host.innerHTML = `<p class="muted">Acil gorev yok. Panel yenileyebilirsin.</p>`;
      return;
    }
    host.innerHTML = offers
      .map((task) => {
        const expireMins = Math.max(0, Math.ceil((new Date(task.expires_at).getTime() - Date.now()) / 60000));
        return `
          <article class="offer">
            <div class="offerTop">
              <h4>${task.title} <small>[${String(task.family || "core").toUpperCase()}]</small></h4>
              <span class="badge info">ID ${task.id}</span>
            </div>
            <p class="muted">Sure ${asNum(task.duration_minutes)} dk | Zorluk ${(asNum(task.difficulty) * 100).toFixed(0)}%</p>
            <p class="muted">Odul ${task.reward_preview} | Kalan ${expireMins} dk</p>
            <div class="offerActions">
              <button class="btn accent startOfferBtn" data-offer="${task.id}">Gorevi Baslat</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderMissions(missions) {
    const list = missions.list || [];
    byId("missionBadge").textContent = `${asNum(missions.ready)} hazir`;
    const host = byId("missionsList");
    if (!list.length) {
      host.innerHTML = `<p class="muted">Misyon verisi yok.</p>`;
      return;
    }
    host.innerHTML = list
      .map((m) => {
        const status = m.claimed ? "ALINDI" : m.completed ? "HAZIR" : "DEVAM";
        const claimButton =
          m.completed && !m.claimed
            ? `<div class="missionActions"><button class="btn accent claimMissionBtn" data-mission-key="${m.key}">Odulu Al</button></div>`
            : "";
        return `
          <article class="mission">
            <div class="offerTop">
              <h4>${m.title}</h4>
              <span class="${formatStatusClass(status)}">${status}</span>
            </div>
            <p class="muted">${asNum(m.progress)}/${asNum(m.target)} | ${m.description}</p>
            ${claimButton}
          </article>
        `;
      })
      .join("");
  }

  function renderAttempts(attempts) {
    const active = attempts?.active;
    const revealable = attempts?.revealable;
    byId("activeAttempt").textContent = active
      ? `${active.task_title} (#${active.id}) | ${formatTime(active.started_at)}`
      : "Yok";
    byId("revealAttempt").textContent = revealable
      ? `${revealable.task_title} (#${revealable.id}) | ${formatTime(revealable.completed_at)}`
      : "Yok";
  }

  function renderEvents(events) {
    const host = byId("eventFeed");
    if (!events || events.length === 0) {
      host.innerHTML = `<li>Event akisi bos.</li>`;
      return;
    }
    host.innerHTML = events
      .map((event) => {
        const label = String(event.event_type || "event").replace(/_/g, " ");
        const time = formatTime(event.event_at);
        const meta = event.meta && typeof event.meta === "object" ? event.meta : {};
        const hint =
          meta.play_mode || meta.tier || meta.result
            ? ` | ${String(meta.play_mode || meta.tier || meta.result)}`
            : "";
        return `<li><strong>${label}</strong><span class="time">${time}</span><span class="time">${hint}</span></li>`;
      })
      .join("");
  }

  async function fetchTokenQuote(usdAmount, chain) {
    const usd = asNum(usdAmount);
    const chainKey = String(chain || "").toUpperCase();
    if (!usd || !chainKey) {
      return null;
    }
    const query = new URLSearchParams({
      uid: state.auth.uid,
      ts: state.auth.ts,
      sig: state.auth.sig,
      usd: String(usd),
      chain: chainKey
    }).toString();
    const res = await fetch(`/webapp/api/token/quote?${query}`);
    const payload = await res.json();
    if (!res.ok || !payload.success) {
      const error = new Error(payload.error || `token_quote_failed:${res.status}`);
      error.code = res.status;
      throw error;
    }
    renewAuth(payload);
    return payload.data || null;
  }

  async function refreshTokenQuote() {
    const usd = asNum(byId("tokenUsdInput").value || 0);
    const chain = String(byId("tokenChainSelect").value || "").toUpperCase();
    if (!usd || !chain) {
      state.v3.tokenQuote = null;
      return;
    }
    const quote = await fetchTokenQuote(usd, chain);
    state.v3.tokenQuote = quote;
    if (quote && quote.quote) {
      const gate = quote.gate || {};
      const q = quote.quote || {};
      const symbol = String(q.tokenSymbol || state.data?.token?.symbol || "NXT");
      byId("tokenHint").textContent =
        `Quote: $${asNum(q.usdAmount).toFixed(2)} -> ${asNum(q.tokenAmount).toFixed(4)} ${symbol} ` +
        `(${chain}) | min ${asNum(q.tokenMinReceive).toFixed(4)} | Gate ${gate.allowed ? "OPEN" : "LOCKED"}`;
    }
  }

  function scheduleTokenQuote() {
    if (state.v3.quoteTimer) {
      clearTimeout(state.v3.quoteTimer);
    }
    state.v3.quoteTimer = setTimeout(() => {
      refreshTokenQuote().catch((err) => {
        const msg = String(err?.message || "");
        if (
          msg.includes("unsupported_chain") ||
          msg.includes("chain_address_missing") ||
          msg.includes("purchase_below_min") ||
          msg.includes("purchase_above_max")
        ) {
          state.v3.tokenQuote = null;
          byId("tokenHint").textContent = "Quote alinmadi. Zincir veya USD miktarini kontrol et.";
          return;
        }
        showError(err);
      });
    }, 300);
  }

  function renderToken(token) {
    const safe = token && typeof token === "object" ? token : {};
    const symbol = String(safe.symbol || "NXT").toUpperCase();
    const decimals = tokenDecimals(safe);
    const balance = asNum(safe.balance);
    const mintable = asNum(safe.mintable_from_balances);
    const units = asNum(safe.unified_units);

    byId("tokenBadge").textContent = symbol;
    byId("balToken").textContent = balance.toFixed(decimals);
    byId("tokenSummary").textContent = `${balance.toFixed(decimals)} ${symbol}`;
    const marketCap = asNum(safe.market_cap_usd);
    const gate = safe.payout_gate || {};
    byId("tokenRate").textContent = `$${asNum(safe.usd_price).toFixed(6)} / ${symbol} | Cap $${marketCap.toFixed(2)} | Gate ${gate.allowed ? "OPEN" : "LOCKED"}`;
    byId("tokenMintable").textContent = `${mintable.toFixed(decimals)} ${symbol}`;
    byId("tokenUnits").textContent = `Unify Units: ${units.toFixed(2)}`;

    const requests = Array.isArray(safe.requests) ? safe.requests : [];
    if (state.v3.tokenQuote?.quote) {
      const quote = state.v3.tokenQuote.quote;
      const gate = state.v3.tokenQuote.gate || {};
      byId("tokenHint").textContent =
        `Quote: $${asNum(quote.usdAmount).toFixed(2)} -> ${asNum(quote.tokenAmount).toFixed(4)} ${String(
          quote.tokenSymbol || symbol
        )} | Gate ${gate.allowed ? "OPEN" : "LOCKED"}`;
    } else if (requests.length > 0) {
      const latest = requests[0];
      byId("tokenHint").textContent = `Son talep #${latest.id} ${String(latest.status || "").toUpperCase()} (${asNum(latest.usd_amount).toFixed(2)} USD)`;
    } else {
      byId("tokenHint").textContent = "Talep olustur, odeme yap, tx hash gonder, admin onayi bekle.";
    }

    const chainSelect = byId("tokenChainSelect");
    const chains = Array.isArray(safe.purchase?.chains) ? safe.purchase.chains : [];
    const current = chainSelect.value || "";
    const enabledChains = chains.filter((x) => x.enabled);
    chainSelect.innerHTML = enabledChains
      .map((x) => `<option value="${x.chain}">${x.chain} (${x.pay_currency})</option>`)
      .join("");

    if (!chainSelect.value && enabledChains.length > 0) {
      chainSelect.value = String(enabledChains[0].chain || "");
    }
    if (current && [...chainSelect.options].some((o) => o.value === current)) {
      chainSelect.value = current;
    }
    byId("tokenBuyBtn").disabled = chainSelect.options.length === 0;
    if (enabledChains.length === 0) {
      byId("tokenHint").textContent = "Zincir odeme adresleri tanimli degil. Admin env kontrol etmeli.";
    } else {
      scheduleTokenQuote();
    }
  }

  function renderAdmin(adminData) {
    const panel = byId("adminPanel");
    if (!panel) return;
    const info = adminData && typeof adminData === "object" ? adminData : {};
    const isAdmin = Boolean(info.is_admin);
    state.admin.isAdmin = isAdmin;
    state.admin.summary = info.summary || null;

    if (!isAdmin) {
      panel.classList.add("hidden");
      return;
    }

    panel.classList.remove("hidden");
    const summary = info.summary || {};
    const runtime = summary.bot_runtime || state.admin.runtime || null;
    const metrics = summary.metrics || {};
    const queues = summary.queues || {};
    const manualTokenQueue = Array.isArray(queues.token_manual_queue) ? queues.token_manual_queue.length : 0;
    const autoDecisions = Array.isArray(queues.token_auto_decisions) ? queues.token_auto_decisions.length : 0;
    const freeze = summary.freeze || {};
    const token = summary.token || {};
    const gate = token.payout_gate || {};
    const curve = token.curve || {};
    const autoPolicy = token.auto_policy || {};
    byId("adminBadge").textContent = freeze.freeze ? "FREEZE ON" : "ADMIN";
    byId("adminBadge").className = freeze.freeze ? "badge warn" : "badge info";
    byId("adminMeta").textContent = `Users ${asNum(summary.total_users)} | Active ${asNum(summary.active_attempts)}`;
    byId("adminTokenCap").textContent = `Cap $${asNum(token.market_cap_usd).toFixed(2)} | Gate ${gate.allowed ? "OPEN" : "LOCKED"} (${asNum(gate.current).toFixed(2)} / ${asNum(gate.min).toFixed(2)})`;
    byId("adminMetrics").textContent =
      `24s: active ${asNum(metrics.users_active_24h)} | start ${asNum(metrics.attempts_started_24h)} | complete ${asNum(metrics.attempts_completed_24h)} | reveal ${asNum(metrics.reveals_24h)} | token $${asNum(metrics.token_usd_volume_24h).toFixed(2)}`;
    byId("adminQueue").textContent =
      `Queue: payout ${asNum(summary.pending_payout_count)} | token ${asNum(summary.pending_token_count)}` +
      ` | manual ${manualTokenQueue} | auto ${autoDecisions}`;
    state.admin.runtime = runtime || null;
    renderAdminRuntime(runtime);
    renderAdminAssetStatus(state.admin.assets);
    const spot = asNum(token.spot_usd || token.usd_price || 0);
    const minCap = asNum(gate.min);
    const targetMax = asNum(gate.targetMax);
    const curveFloor = asNum(curve.admin_floor_usd);
    const curveBase = asNum(curve.base_usd);
    const curveK = asNum(curve.k);
    const curveDemand = asNum(curve.demand_factor);
    const curveDivisor = asNum(curve.supply_norm_divisor);
    const autoUsdLimit = asNum(autoPolicy.auto_usd_limit);
    const autoRisk = asNum(autoPolicy.risk_threshold);
    const autoVelocity = asNum(autoPolicy.velocity_per_hour);
    byId("adminTokenPriceInput").value = spot > 0 ? spot.toFixed(8) : "";
    byId("adminTokenGateMinInput").value = minCap > 0 ? String(Math.floor(minCap)) : "";
    byId("adminTokenGateMaxInput").value = targetMax > 0 ? String(Math.floor(targetMax)) : "";
    byId("adminCurveEnabledInput").value = curve.enabled ? "1" : "0";
    byId("adminCurveFloorInput").value = curveFloor > 0 ? curveFloor.toFixed(8) : "";
    byId("adminCurveBaseInput").value = curveBase > 0 ? curveBase.toFixed(8) : "";
    byId("adminCurveKInput").value = curveK >= 0 ? String(curveK) : "";
    byId("adminCurveDemandInput").value = curveDemand > 0 ? String(curveDemand) : "";
    byId("adminCurveDivisorInput").value = curveDivisor > 0 ? String(Math.floor(curveDivisor)) : "";
    byId("adminAutoPolicyEnabledInput").value = autoPolicy.enabled ? "1" : "0";
    byId("adminAutoUsdLimitInput").value = autoUsdLimit > 0 ? String(autoUsdLimit) : "";
    byId("adminAutoRiskInput").value = autoRisk >= 0 ? String(autoRisk) : "";
    byId("adminAutoVelocityInput").value = autoVelocity > 0 ? String(Math.floor(autoVelocity)) : "";
  }

  function formatRuntimeTime(value) {
    if (!value) {
      return "-";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "-";
    }
    return date.toISOString().slice(11, 19);
  }

  function renderAdminRuntime(runtimeData) {
    const line = byId("adminRuntimeLine");
    const eventsLine = byId("adminRuntimeEvents");
    if (!line || !eventsLine) {
      return;
    }

    const runtime = runtimeData && typeof runtimeData === "object" ? runtimeData : {};
    const health = runtime.health || {};
    const stateRow = runtime.state || runtime.runtime_state || {};
    const events = Array.isArray(runtime.events)
      ? runtime.events
      : Array.isArray(runtime.recent_events)
        ? runtime.recent_events
        : [];

    const mode = String(stateRow.mode || "unknown");
    const alive = health.alive === true || stateRow.alive === true;
    const lock = health.lock_acquired === true || stateRow.lock_acquired === true;
    const hb = formatRuntimeTime(health.last_heartbeat_at || stateRow.last_heartbeat_at);
    line.textContent = `Bot Runtime: ${alive ? "ON" : "OFF"} | ${lock ? "LOCK" : "NOLOCK"} | ${mode} | hb ${hb}`;

    if (events.length === 0) {
      eventsLine.textContent = "Runtime events: kayit yok";
      return;
    }
    const preview = events
      .slice(0, 3)
      .map((event) => String(event.event_type || event.type || "runtime"))
      .join(" | ");
    eventsLine.textContent = `Runtime events: ${preview}`;
  }

  function renderAdminAssetStatus(assetsData) {
    const summaryLine = byId("adminAssetSummary");
    const revisionLine = byId("adminManifestRevision");
    const list = byId("adminAssetList");
    if (!summaryLine || !revisionLine) {
      return;
    }

    const payload = assetsData && typeof assetsData === "object" ? assetsData : {};
    const summary = payload.summary || {};
    const total = asNum(summary.total_assets);
    const ready = asNum(summary.ready_assets);
    const missing = asNum(summary.missing_assets);
    summaryLine.textContent = `Assets: ready ${ready}/${total} | missing ${missing}`;

    const manifest = payload.active_manifest || payload.local_manifest || {};
    const revision = String(manifest.manifest_revision || manifest.revision || "local");
    const updatedAt = formatRuntimeTime(manifest.updated_at || manifest.generated_at);
    revisionLine.textContent = `Manifest: ${revision} | updated ${updatedAt}`;

    if (!list) {
      return;
    }
    list.innerHTML = "";

    const rows = Array.isArray(payload?.local_manifest?.rows)
      ? payload.local_manifest.rows
      : Array.isArray(payload?.db_registry)
        ? payload.db_registry
        : [];

    if (!rows.length) {
      const empty = document.createElement("li");
      empty.className = "muted";
      empty.textContent = "Asset kaydi bulunmuyor";
      list.appendChild(empty);
      return;
    }

    rows.slice(0, 12).forEach((row) => {
      const key = String(row.asset_key || row.key || "asset");
      const exists = row.exists === true || String(row.load_status || "").toLowerCase() === "ready";
      const size = formatBytesShort(row.size_bytes || row.bytes_size || 0);
      const path = String(row.web_path || row.manifest_path || row.asset_path || "").trim();
      const item = document.createElement("li");
      item.className = `adminAssetRow ${exists ? "ready" : "missing"}`;

      const body = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = key;
      const meta = document.createElement("p");
      meta.className = "adminAssetMeta";
      meta.textContent = `${size}${path ? ` | ${path}` : ""}`;
      body.appendChild(title);
      body.appendChild(meta);

      const stateChip = document.createElement("span");
      stateChip.className = `adminAssetState ${exists ? "ready" : "missing"}`;
      stateChip.textContent = exists ? "READY" : "MISSING";

      item.appendChild(body);
      item.appendChild(stateChip);
      list.appendChild(item);
    });
  }

  async function fetchAdminSummary() {
    const query = new URLSearchParams(state.auth).toString();
    const res = await fetch(`/webapp/api/admin/summary?${query}`);
    const payload = await res.json();
    if (!res.ok || !payload.success) {
      throw new Error(payload.error || `admin_summary_failed:${res.status}`);
    }
    renewAuth(payload);
    renderAdmin({
      is_admin: true,
      summary: payload.data
    });
    try {
      const queues = await fetchAdminQueues();
      if (state.admin.summary && typeof state.admin.summary === "object") {
        state.admin.summary.queues = queues;
        renderAdmin({ is_admin: true, summary: state.admin.summary });
      }
    } catch (_) {}
    try {
      const runtime = await fetchAdminRuntime();
      if (state.admin.summary && typeof state.admin.summary === "object") {
        state.admin.summary.bot_runtime = runtime;
        renderAdmin({ is_admin: true, summary: state.admin.summary });
      }
    } catch (_) {}
    try {
      await fetchAdminAssetStatus();
      if (state.admin.summary && typeof state.admin.summary === "object") {
        renderAdmin({ is_admin: true, summary: state.admin.summary });
      }
    } catch (_) {}
    return payload.data;
  }

  async function fetchAdminQueues() {
    const query = new URLSearchParams(state.auth).toString();
    const res = await fetch(`/webapp/api/admin/queues?${query}`);
    const payload = await res.json();
    if (!res.ok || !payload.success) {
      throw new Error(payload.error || `admin_queues_failed:${res.status}`);
    }
    renewAuth(payload);
    return payload.data || {};
  }

  async function fetchAdminMetrics() {
    const query = new URLSearchParams(state.auth).toString();
    const res = await fetch(`/webapp/api/admin/metrics?${query}`);
    const payload = await res.json();
    if (!res.ok || !payload.success) {
      throw new Error(payload.error || `admin_metrics_failed:${res.status}`);
    }
    renewAuth(payload);
    if (state.admin.summary && typeof state.admin.summary === "object") {
      state.admin.summary.metrics = payload.data || {};
      renderAdmin({ is_admin: true, summary: state.admin.summary });
    }
    return payload.data || {};
  }

  async function fetchAdminRuntime(limit = 20) {
    const query = new URLSearchParams({
      ...state.auth,
      limit: String(Math.max(1, Math.min(100, Number(limit || 20))))
    }).toString();
    const res = await fetch(`/webapp/api/admin/runtime/bot?${query}`);
    const payload = await res.json();
    if (!res.ok || !payload.success) {
      throw new Error(payload.error || `admin_runtime_failed:${res.status}`);
    }
    renewAuth(payload);
    state.admin.runtime = payload.data || null;
    renderAdminRuntime(state.admin.runtime);
    return state.admin.runtime;
  }

  async function fetchAdminAssetStatus() {
    const query = new URLSearchParams(state.auth).toString();
    const res = await fetch(`/webapp/api/admin/assets/status?${query}`);
    const payload = await res.json();
    if (!res.ok || !payload.success) {
      throw new Error(payload.error || `admin_assets_status_failed:${res.status}`);
    }
    renewAuth(payload);
    state.admin.assets = payload.data || null;
    renderAdminAssetStatus(state.admin.assets);
    return state.admin.assets;
  }

  async function reloadAdminAssets() {
    const payload = await postAdmin("/webapp/api/admin/assets/reload");
    state.admin.assets = payload || null;
    renderAdminAssetStatus(state.admin.assets);
    return state.admin.assets;
  }

  async function reconcileAdminRuntime(reason, forceStop = false) {
    const payload = await postAdmin("/webapp/api/admin/runtime/bot/reconcile", {
      reason: reason || "manual_runtime_reconcile",
      force_stop: Boolean(forceStop)
    });
    state.admin.runtime = {
      health: payload.health_after || {},
      runtime_state: payload.runtime_state || null,
      recent_events: payload.recent_events || []
    };
    renderAdminRuntime(state.admin.runtime);
    return payload;
  }

  async function postAdmin(path, extraBody = {}) {
    const t0 = performance.now();
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: state.auth.uid,
        ts: state.auth.ts,
        sig: state.auth.sig,
      ...extraBody
      })
    });
    markLatency(performance.now() - t0);
    const payload = await res.json();
    if (!res.ok || !payload.success) {
      throw new Error(payload.error || `admin_action_failed:${res.status}`);
    }
    renewAuth(payload);
    return payload.data || {};
  }

  function updateArenaStatus(text, style = "warn") {
    const badge = byId("arenaStatus");
    badge.textContent = text;
    badge.className = `badge ${style}`;
  }

  function chooseModeByRisk(riskScore) {
    const risk = asNum(riskScore);
    if (risk >= 0.35) return "safe";
    if (risk >= 0.18) return "balanced";
    return "aggressive";
  }

  function pickBestOffer(offers) {
    const list = Array.isArray(offers) ? offers : [];
    if (list.length === 0) return null;
    return list
      .slice()
      .sort((a, b) => {
        const rewardA = asNum(String(a.reward_preview || "0").match(/(\d+)\s*-\s*(\d+)/)?.[2] || 0);
        const rewardB = asNum(String(b.reward_preview || "0").match(/(\d+)\s*-\s*(\d+)/)?.[2] || 0);
        if (rewardB !== rewardA) return rewardB - rewardA;
        return asNum(a.difficulty) - asNum(b.difficulty);
      })[0];
  }

  function computeMacroProgress(season) {
    const points = asNum(season?.points);
    const momentum = clamp(Math.round(Math.log10(points + 1) * 36), 0, 100);
    const timePressure = clamp(100 - asNum(season?.days_left) * 2, 0, 40);
    return clamp(momentum + timePressure, 0, 100);
  }

  function computeSuggestion(data) {
    const attempts = data.attempts || {};
    const offers = data.offers || [];
    const missions = data.missions || { list: [] };
    const balances = data.balances || {};
    const riskScore = asNum(data.risk_score || 0);
    const nexus = data.nexus || {};
    const contract = data.contract || {};
    const freeze = Boolean(data.admin?.summary?.freeze?.freeze);

    if (freeze) {
      return {
        action: "open_status",
        payload: {},
        label: "Bakim Durumunu Ac",
        stateLabel: "Freeze",
        style: "warn",
        summary: "Sistem freeze modunda. Gorev dagitimi gecici durur."
      };
    }

    if (attempts.revealable) {
      const attempt = attempts.revealable;
      return {
        action: "reveal_latest",
        payload: {},
        label: "Reveal Ac",
        stateLabel: "Reveal",
        style: "",
        summary: `${attempt.task_title || "deneme"} tamam. Odulu ac ve yeni turu baslat.`
      };
    }

    if (attempts.active) {
      const mode = String(contract.required_mode || nexus.preferred_mode || chooseModeByRisk(riskScore));
      const modeLabel = mode === "safe" ? "Temkinli" : mode === "aggressive" ? "Saldirgan" : "Dengeli";
      return {
        action: "complete_latest",
        payload: { mode },
        label: `${modeLabel} Bitir`,
        stateLabel: "Aktif Deneme",
        style: "info",
        summary: `Aktif deneme var. Risk ${(riskScore * 100).toFixed(0)}% icin ${modeLabel.toLowerCase()} cikis onerildi.`
      };
    }

    const claimable = (missions.list || []).find((m) => m.completed && !m.claimed);
    if (claimable) {
      return {
        action: "claim_mission",
        payload: { mission_key: claimable.key },
        label: "Misyon Odulu Al",
        stateLabel: "Misyon Hazir",
        style: "info",
        summary: `${claimable.title} odulu alinmamis. SC/RC akisini hizlandir.`
      };
    }

    if (offers.length > 0) {
      const best = pickBestOffer(offers);
      return {
        action: "accept_offer",
        payload: { offer_id: Number(best?.id || offers[0].id) },
        label: `Gorev Baslat #${Number(best?.id || offers[0].id)}`,
        stateLabel: "Gorev Acik",
        style: "info",
        summary: `${best?.title || "Gorev"} gorevi acik. Kontrat modu: ${String(contract.required_mode || "balanced")}.`
      };
    }

    if (asNum(balances.RC) >= 1) {
      return {
        action: "reroll_tasks",
        payload: {},
        label: "Panel Yenile (1 RC)",
        stateLabel: "Reroll",
        style: "warn",
        summary: "Aktif gorev yok. RC kullanip yeni lineup cek."
      };
    }

    return {
      action: "open_tasks",
      payload: {},
      label: "Gorev Havuzunu Ac",
      stateLabel: "Beklemede",
      style: "warn",
      summary: "Gorev dongusunu yeniden baslat. Sonraki odul reveal ile gelir."
    };
  }

  function renderDirector(data) {
    const suggestion = computeSuggestion(data);
    state.suggestion = suggestion;
    const daily = data.daily || {};
    const season = data.season || {};
    const nexus = data.nexus || {};
    const contract = data.contract || {};
    const attempts = data.attempts || {};
    const offers = data.offers || [];

    const directorState = byId("directorState");
    const directorSummary = byId("directorSummary");
    const directorScenario = byId("directorScenarioLine");
    const directorMechanic = byId("directorMechanicLine");
    const runSuggestedBtn = byId("runSuggestedBtn");

    animateTextSwap(directorState, suggestion.stateLabel);
    if (directorState) {
      directorState.className = `badge ${suggestion.style || "info"}`.trim();
    }

    const summaryText = nexus.title
      ? `${suggestion.summary} | ${nexus.title}: ${String(nexus.subtitle || "").trim() || "pulse aktif"} | Kontrat ${String(
          contract.title || "-"
        )}`
      : suggestion.summary;
    animateTextSwap(directorSummary, summaryText);
    animateTextSwap(runSuggestedBtn, suggestion.label);

    const scenario =
      state.telemetry.sceneMood === "critical"
        ? "Senaryo: kritik baski. SAFE ve GUARD penceresine don."
        : state.telemetry.sceneMood === "aggressive"
          ? "Senaryo: yuksek tempo. Strike + Charge ritmini koru."
          : state.telemetry.sceneMood === "safe"
            ? "Senaryo: kontrollu ilerleme. Kontrat stabil kazanci zorla."
            : "Senaryo: dengeli rota. Reveal penceresini optimize et.";
    const mechanic = `Mekanik: ${String(contract.required_mode || "balanced").toUpperCase()} | ${String(
      contract.require_result || "success_or_near"
    ).toUpperCase()} | Risk ${(asNum(data.risk_score || 0) * 100).toFixed(0)}%`;
    animateTextSwap(directorScenario, scenario);
    animateTextSwap(directorMechanic, mechanic);

    const microPct = attempts.revealable ? 100 : attempts.active ? 68 : offers.length > 0 ? 24 : 6;
    const mesoPct = pct(asNum(daily.tasks_done), asNum(daily.daily_cap));
    const macroPct = computeMacroProgress(season);

    byId("loopMicroLine").textContent =
      attempts.revealable ? "Reveal Hazir" : attempts.active ? "Deneme Acik" : offers.length > 0 ? "Gorev Secimi" : "Panel Bos";
    byId("loopMesoLine").textContent = `${asNum(daily.tasks_done)}/${asNum(daily.daily_cap)} gunluk`;
    byId("loopMacroLine").textContent = `S${season.season_id || 0} | ${asNum(season.points)} SP`;

    animateMeterWidth(byId("loopMicroMeter"), microPct, 0.3);
    animateMeterWidth(byId("loopMesoMeter"), mesoPct, 0.35);
    animateMeterWidth(byId("loopMacroMeter"), macroPct, 0.4);
  }

  function renderContract(contract) {
    const safe = contract && typeof contract === "object" ? contract : {};
    const matched = Boolean(safe.match?.matched);
    byId("contractBadge").textContent = matched ? "HIT" : "AKTIF";
    byId("contractBadge").className = matched ? "badge" : "badge info";
    byId("contractTitle").textContent = String(safe.title || "Nexus Contract");
    byId("contractSubtitle").textContent = String(safe.subtitle || "Gunluk kontrat");
    byId("contractTarget").textContent = `${String(safe.required_mode || "balanced").toUpperCase()} | ${String(
      safe.require_result || "success_or_near"
    ).toUpperCase()}`;
    byId("contractObjective").textContent = String(safe.objective || "-");
    byId("contractBoost").textContent = `SC x${asNum(safe.sc_multiplier || 1).toFixed(2)}`;
    byId("contractMeta").textContent = `+${asNum(safe.rc_flat_bonus || 0)} RC | +${asNum(safe.season_bonus || 0)} SP | +${asNum(
      safe.war_bonus || 0
    )} War`;
  }

  function pushTelemetrySeries(series, value, maxLen = 84) {
    if (!Array.isArray(series)) {
      return [];
    }
    const num = asNum(value);
    series.push(Number.isFinite(num) ? num : 0);
    if (series.length > maxLen) {
      series.splice(0, series.length - maxLen);
    }
    return series;
  }

  function computeCombatHeat(data) {
    const safe = data && typeof data === "object" ? data : {};
    const attempts = safe.attempts || {};
    const riskScore = clamp(asNum(safe.risk_score || 0), 0, 1);
    const pvpCombo = asNum(state.v3.pvpSession?.combo?.self || 0);
    const simCombo = asNum(state.sim.combo || 0);
    const activeLoad = attempts.active ? 0.26 : 0.04;
    const revealBoost = attempts.revealable ? 0.22 : 0.02;
    const queuePressure = clamp(asNum(state.v3.pvpQueue.length) / 8, 0, 1) * 0.16;
    const comboPressure = clamp(Math.max(pvpCombo, simCombo) / 9, 0, 1) * 0.24;
    return clamp(riskScore * 0.32 + activeLoad + revealBoost + comboPressure + queuePressure, 0, 1);
  }

  function computeThreatRatio(data) {
    const safe = data && typeof data === "object" ? data : {};
    const riskScore = clamp(asNum(safe.risk_score || 0), 0, 1);
    const nexusPressure = clamp(asNum(safe.nexus?.pressure_pct || 0) / 100, 0, 1);
    const freeze = Boolean(safe.admin?.summary?.freeze?.freeze) ? 0.35 : 0;
    const pvpStatus = String(state.v3.pvpSession?.status || "").toLowerCase();
    const pvpWeight = pvpStatus === "active" ? 0.16 : pvpStatus === "resolved" ? 0.08 : 0.02;
    return clamp(riskScore * 0.54 + nexusPressure * 0.26 + pvpWeight + freeze, 0, 1);
  }

  function resolveSceneMood(data, heat, threat) {
    const safe = data && typeof data === "object" ? data : {};
    const requiredMode = String(safe.contract?.required_mode || "").toLowerCase();
    if (threat >= 0.78) {
      return "critical";
    }
    if (heat >= 0.72 || requiredMode === "aggressive") {
      return "aggressive";
    }
    if (requiredMode === "safe") {
      return "safe";
    }
    if (heat >= 0.4 || threat >= 0.42) {
      return "balanced";
    }
    return "idle";
  }

  function applySceneMood(data, heat, threat) {
    const mood = resolveSceneMood(data, heat, threat);
    state.telemetry.combatHeat = clamp(heat, 0, 1);
    state.telemetry.threatRatio = clamp(threat, 0, 1);
    state.telemetry.sceneMood = mood;
    const postFxBase = asNum(state.telemetry.scenePostFxLevel || 0.9);
    const moodBoost = mood === "critical" ? 0.42 : mood === "aggressive" ? 0.26 : mood === "balanced" ? 0.14 : mood === "safe" ? -0.08 : -0.16;
    const targetPostFx = clamp(postFxBase + moodBoost + state.telemetry.threatRatio * 0.18, 0.15, 2.35);
    if (state.arena) {
      const arena = state.arena;
      arena.moodTarget = mood;
      arena.targetPostFx = targetPostFx;
      arena.targetHeat = state.telemetry.combatHeat;
      arena.targetThreat = state.telemetry.threatRatio;
    }

    const root = document.documentElement;
    root.style.setProperty("--hud-heat", String(state.telemetry.combatHeat.toFixed(3)));
    root.style.setProperty("--hud-threat", String(state.telemetry.threatRatio.toFixed(3)));
    document.body.dataset.sceneMood = mood;
  }

  function drawTelemetrySeries(ctx, values, color, maxValue, chartHeight, chartWidth, offsetTop) {
    if (!Array.isArray(values) || values.length === 0) {
      return;
    }
    const maxSafe = Math.max(1, asNum(maxValue));
    const stepX = values.length > 1 ? chartWidth / (values.length - 1) : chartWidth;
    ctx.beginPath();
    values.forEach((value, index) => {
      const x = index * stepX;
      const ratio = clamp(asNum(value) / maxSafe, 0, 1);
      const y = offsetTop + chartHeight - ratio * chartHeight;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function drawTelemetryCanvas() {
    const canvas = byId("telemetryCanvas");
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    const hostWidth = Math.max(320, Math.floor(canvas.clientWidth || canvas.width || 960));
    const hostHeight = Math.max(96, Math.floor(canvas.clientHeight || canvas.height || 132));
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    const targetW = Math.floor(hostWidth * dpr);
    const targetH = Math.floor(hostHeight * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, hostWidth, hostHeight);

    const gradient = ctx.createLinearGradient(0, 0, 0, hostHeight);
    gradient.addColorStop(0, "rgba(12, 26, 58, 0.96)");
    gradient.addColorStop(1, "rgba(8, 15, 34, 0.64)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, hostWidth, hostHeight);

    const chartLeft = 14;
    const chartTop = 12;
    const chartWidth = hostWidth - 28;
    const chartHeight = hostHeight - 24;

    ctx.strokeStyle = "rgba(150, 175, 236, 0.18)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const y = chartTop + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(chartLeft, y);
      ctx.lineTo(chartLeft + chartWidth, y);
      ctx.stroke();
    }

    const fpsValues = state.telemetry.fpsHistory || [];
    const latencyValues = state.telemetry.latencyHistory || [];
    const heatValues = state.telemetry.heatHistory || [];
    const threatValues = state.telemetry.threatHistory || [];
    drawTelemetrySeries(ctx, fpsValues, "#49f7bf", 90, chartHeight, chartWidth, chartTop);
    drawTelemetrySeries(ctx, latencyValues, "#7ca8ff", 220, chartHeight, chartWidth, chartTop);
    drawTelemetrySeries(ctx, heatValues.map((v) => v * 100), "#ffbf59", 100, chartHeight, chartWidth, chartTop);
    drawTelemetrySeries(ctx, threatValues.map((v) => v * 100), "#ff5d84", 100, chartHeight, chartWidth, chartTop);

    ctx.fillStyle = "rgba(189, 207, 255, 0.75)";
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.fillText("FPS", chartLeft + 2, chartTop + 10);
    ctx.fillText("LAT", chartLeft + 42, chartTop + 10);
    ctx.fillText("HEAT", chartLeft + 82, chartTop + 10);
    ctx.fillText("THREAT", chartLeft + 128, chartTop + 10);
  }

  function renderCombatHudStrip(data, heat, threat) {
    const safe = data && typeof data === "object" ? data : {};
    const session = state.v3.pvpSession || {};
    const simCombo = asNum(state.sim.combo || 0);
    const pvpCombo = asNum(session?.combo?.self || 0);
    const comboPeak = Math.max(simCombo, pvpCombo);
    const comboHeat = clamp(comboPeak / 10, 0, 1);
    const queuePressure = clamp(asNum(state.v3.pvpQueue.length) / 10, 0, 1);
    const tickMs = Math.max(1, asNum(state.v3.pvpTickMs || 1000));
    const latency = asNum(state.telemetry.latencyAvgMs || 0);
    const actionWindowMs = Math.max(1, asNum(state.v3.pvpActionWindowMs || 800));
    const windowRatio = clamp((actionWindowMs - latency) / actionWindowMs, 0, 1);
    const anomaly = clamp((threat * 0.68 + queuePressure * 0.22 + (1 - windowRatio) * 0.3), 0, 1);

    const comboLine = byId("comboHeatLine");
    if (comboLine) {
      comboLine.textContent = `${Math.round(comboHeat * 100)}% | Combo ${comboPeak}`;
    }
    const comboMeter = byId("comboHeatMeter");
    if (comboMeter) {
      animateMeterWidth(comboMeter, comboHeat * 100, 0.28);
    }

    const windowLine = byId("windowPressureLine");
    if (windowLine) {
      windowLine.textContent = `${Math.round(windowRatio * 100)}% | Tick ${tickMs}ms`;
    }
    const windowMeter = byId("windowPressureMeter");
    if (windowMeter) {
      animateMeterWidth(windowMeter, windowRatio * 100, 0.3);
    }

    const anomalyLine = byId("anomalyPulseLine");
    if (anomalyLine) {
      const anomalyTone = anomaly >= 0.78 ? "CRITICAL" : anomaly >= 0.48 ? "VOLATILE" : "STABLE";
      anomalyLine.textContent = `${anomalyTone} | Risk ${Math.round(threat * 100)}%`;
      anomalyLine.dataset.tone = anomalyTone.toLowerCase();
    }
    const anomalyMeter = byId("anomalyPulseMeter");
    if (anomalyMeter) {
      animateMeterWidth(anomalyMeter, anomaly * 100, 0.34);
    }

    if (anomaly >= 0.78) {
      pushCombatTicker("Anomali yuksek: SAFE cikis onerildi", "aggressive");
    } else if (comboHeat >= 0.72 && heat >= 0.55) {
      pushCombatTicker("Combo penceresi acildi: REVEAL/RUSH sinyali", "balanced");
    }
  }

  function renderRoundDirectorStrip(data, heat, threat) {
    const safe = data && typeof data === "object" ? data : {};
    const session = state.v3.pvpSession || {};
    const scoreSelf = asNum(session?.score?.self || 0);
    const scoreOpp = asNum(session?.score?.opponent || 0);
    const scoreDelta = scoreSelf - scoreOpp;
    const tickMs = Math.max(1, asNum(state.v3.pvpTickMs || 1000));
    const latency = Math.max(0, asNum(state.telemetry.latencyAvgMs || 0));
    const queueSize = Math.max(0, asNum(state.v3.pvpQueue.length || 0));
    const comboSelf = asNum(session?.combo?.self || 0);
    const comboOpp = asNum(session?.combo?.opponent || 0);
    const comboNet = comboSelf - comboOpp;
    const windowMs = Math.max(1, asNum(state.v3.pvpActionWindowMs || 800));
    const windowRatio = clamp((windowMs - latency) / windowMs, 0, 1);
    const tempoRatio = clamp((1100 - tickMs) / 420, 0, 1) * 0.58 + windowRatio * 0.42;
    const pressure = clamp(threat * 0.6 + (1 - windowRatio) * 0.22 + clamp(queueSize / 8, 0, 1) * 0.18, 0, 1);
    const dominance = clamp(0.5 + scoreDelta / 12 + comboNet / 18, 0, 1);
    const roundHeat = clamp(heat * 0.66 + clamp(Math.max(comboSelf, state.sim.combo || 0) / 10, 0, 1) * 0.34, 0, 1);
    const roundPhase = roundHeat >= 0.82 ? "critical" : roundHeat >= 0.62 ? "overdrive" : roundHeat >= 0.4 ? "engage" : "warmup";
    const dominanceState = dominance >= 0.62 ? "ahead" : dominance <= 0.38 ? "behind" : "even";
    const pressureState = pressure >= 0.7 ? "high" : pressure >= 0.4 ? "mid" : "low";

    const heatLine = byId("roundHeatLine");
    if (heatLine) {
      heatLine.dataset.phase = roundPhase;
      heatLine.textContent = `${Math.round(roundHeat * 100)}% | ${roundPhase.toUpperCase()}`;
    }
    const heatMeter = byId("roundHeatMeter");
    if (heatMeter) {
      animateMeterWidth(heatMeter, roundHeat * 100, 0.3);
    }

    const tempoLine = byId("roundTempoLine");
    if (tempoLine) {
      tempoLine.textContent = `${Math.round(tempoRatio * 100)}% | Tick ${tickMs}ms`;
    }
    const tempoMeter = byId("roundTempoMeter");
    if (tempoMeter) {
      animateMeterWidth(tempoMeter, tempoRatio * 100, 0.3);
    }

    const dominanceLine = byId("roundDominanceLine");
    if (dominanceLine) {
      dominanceLine.dataset.dominance = dominanceState;
      const dominanceLabel = dominanceState === "ahead" ? "AHEAD" : dominanceState === "behind" ? "UNDER" : "EVEN";
      dominanceLine.textContent = `YOU ${scoreSelf} - ${scoreOpp} OPP | ${dominanceLabel}`;
    }
    const dominanceMeter = byId("roundDominanceMeter");
    if (dominanceMeter) {
      animateMeterWidth(dominanceMeter, dominance * 100, 0.34);
    }

    const pressureLine = byId("roundPressureLine");
    if (pressureLine) {
      pressureLine.dataset.pressure = pressureState;
      pressureLine.textContent = `${Math.round(pressure * 100)}% | Queue ${queueSize}`;
    }
    const pressureMeter = byId("roundPressureMeter");
    if (pressureMeter) {
      animateMeterWidth(pressureMeter, pressure * 100, 0.34);
    }

    const alertKey = `${roundPhase}:${dominanceState}:${pressureState}`;
    const now = Date.now();
    if (alertKey !== state.v3.lastRoundAlertKey && now - asNum(state.v3.lastRoundAlertAt || 0) > 3600) {
      state.v3.lastRoundAlertKey = alertKey;
      state.v3.lastRoundAlertAt = now;
      if (pressureState === "high" && dominanceState !== "ahead") {
        pushCombatTicker("Duel baskisi yuksek: GUARD/SAFE penceresi", "aggressive");
      } else if (roundPhase === "overdrive" && dominanceState === "ahead") {
        pushCombatTicker("Overdrive aktif: REVEAL veya RUSH ile kapat", "reveal");
      } else if (roundPhase === "engage") {
        pushCombatTicker("Engage fazi: dengeyi koru, combo biriktir", "balanced");
      }
    }
  }

  function resolveCameraDynamics(mode, heat, threat, cinematicIntensity) {
    if (mode === "tactical") {
      return {
        drift: clamp(0.22 + heat * 0.34, 0.2, 0.78),
        energy: clamp((heat * 0.42 + threat * 0.28 + cinematicIntensity * 0.18) * 100, 8, 92),
        focus: "Tactical lock aktif, pencereler daha net."
      };
    }
    if (mode === "chase") {
      return {
        drift: clamp(0.58 + heat * 0.56 + cinematicIntensity * 0.22, 0.5, 1.42),
        energy: clamp((heat * 0.55 + threat * 0.25 + cinematicIntensity * 0.3) * 100, 16, 100),
        focus: "Chase takibi aktif, ani vuruslar one cikiyor."
      };
    }
    return {
      drift: clamp(0.34 + heat * 0.4 + cinematicIntensity * 0.15, 0.3, 1.02),
      energy: clamp((heat * 0.47 + threat * 0.31 + cinematicIntensity * 0.2) * 100, 10, 96),
      focus: "Broadcast acisi dengeli, kontrat hizi izleniyor."
    };
  }

  function renderCameraDirector(data, heat, threat) {
    const safe = data && typeof data === "object" ? data : {};
    const mode = String(state.ui.cameraMode || "broadcast").toLowerCase();
    const validMode = CAMERA_MODE_VALUES.includes(mode) ? mode : "broadcast";
    state.ui.cameraMode = validMode;
    const queueSize = Math.max(
      0,
      asNum((state.v3.queue || []).length) + asNum((state.v3.pvpQueue || []).length) + asNum((state.v3.raidQueue || []).length)
    );
    const windowMs = Math.max(200, asNum(state.v3.pvpActionWindowMs || 800));
    const cinematicIntensity = clamp(asNum(state.arena?.pvpCinematicIntensity || 0), 0, 1.6);
    const dynamics = resolveCameraDynamics(validMode, heat, threat, cinematicIntensity);

    const modeLine = byId("cameraModeLine");
    if (modeLine) {
      modeLine.dataset.mode = validMode;
      modeLine.textContent = `${cameraModeLabel(validMode).toUpperCase()} | Drift ${Math.round(dynamics.drift * 100)}%`;
    }

    const focusLine = byId("cameraFocusLine");
    if (focusLine) {
      const riskPct = Math.round(clamp(asNum(safe.risk_score || 0) * 100, 0, 100));
      focusLine.textContent = `${dynamics.focus} Queue ${queueSize} | Window ${windowMs}ms | Risk ${riskPct}%`;
    }

    const energyMeter = byId("cameraEnergyMeter");
    if (energyMeter) {
      animateMeterWidth(energyMeter, dynamics.energy, 0.32);
    }
  }

  function renderTelemetryDeck(data) {
    const safe = data && typeof data === "object" ? data : {};
    const fps = asNum(state.telemetry.fpsAvg || 0);
    const latency = asNum(state.telemetry.latencyAvgMs || 0);
    const frame = asNum(state.telemetry.frameTimeMs || 0);
    const transport = String(state.v3.pvpTransport || "poll").toUpperCase();
    const tickMs = asNum(state.v3.pvpTickMs || 1000);
    const heat = computeCombatHeat(safe);
    const threat = computeThreatRatio(safe);
    const heatPct = Math.round(heat * 100);
    const threatPct = Math.round(threat * 100);
    applySceneMood(safe, heat, threat);
    renderCombatHudStrip(safe, heat, threat);
    renderRoundDirectorStrip(safe, heat, threat);
    renderCameraDirector(safe, heat, threat);

    const deckBridge = getTelemetryDeckBridge();
    if (deckBridge) {
      deckBridge.render({
        fps,
        frameTimeMs: frame,
        latencyMs: latency,
        transport,
        tickMs,
        qualityMode: String(getEffectiveQualityMode() || "normal"),
        heat,
        threat
      });
      const runtimeSceneLine = byId("runtimeSceneLine");
      if (runtimeSceneLine) {
        runtimeSceneLine.textContent = `HUD ${String(state.telemetry.sceneHudDensity || "full")} | PostFX ${Number(
          state.telemetry.scenePostFxLevel || 0.9
        ).toFixed(2)} | Cam ${cameraModeLabel(state.ui.cameraMode).toUpperCase()} | Mood ${String(
          state.telemetry.sceneMood || "balanced"
        ).toUpperCase()}`;
      }
      return;
    }

    pushTelemetrySeries(state.telemetry.fpsHistory, fps);
    pushTelemetrySeries(state.telemetry.latencyHistory, latency);
    pushTelemetrySeries(state.telemetry.heatHistory, heat);
    pushTelemetrySeries(state.telemetry.threatHistory, threat);

    const modeLine = byId("runtimeModeLine");
    if (modeLine) {
      modeLine.textContent = `Transport ${transport} | Tick ${tickMs}ms`;
    }
    const perfLine = byId("runtimePerfLine");
    if (perfLine) {
      perfLine.textContent = `FPS ${Math.round(fps)} | ${Math.round(frame)}ms`;
    }
    const latencyLine = byId("runtimeLatencyLine");
    if (latencyLine) {
      latencyLine.textContent = `Net ${Math.round(latency)}ms | Perf ${String(getEffectiveQualityMode()).toUpperCase()}`;
    }
    const runtimeSceneLine = byId("runtimeSceneLine");
    if (runtimeSceneLine) {
      runtimeSceneLine.textContent = `HUD ${String(state.telemetry.sceneHudDensity || "full")} | PostFX ${Number(
        state.telemetry.scenePostFxLevel || 0.9
      ).toFixed(2)} | Cam ${cameraModeLabel(state.ui.cameraMode).toUpperCase()} | Mood ${String(
        state.telemetry.sceneMood || "balanced"
      ).toUpperCase()}`;
    }
    const heatLine = byId("combatHeatLine");
    if (heatLine) {
      heatLine.textContent = `${heatPct}%`;
    }
    const heatHint = byId("combatHeatHint");
    if (heatHint) {
      heatHint.textContent = heatPct >= 75 ? "Momentum penceresi acik" : heatPct >= 45 ? "Denge modu korunuyor" : "Ritim toplaniyor";
    }
    const heatMeter = byId("combatHeatMeter");
    if (heatMeter) {
      animateMeterWidth(heatMeter, heatPct, 0.34);
    }
    const threatLine = byId("threatLine");
    if (threatLine) {
      threatLine.textContent = `Risk ${threatPct}%`;
    }
    const threatHint = byId("threatHint");
    if (threatHint) {
      threatHint.textContent =
        threatPct >= 78 ? "Kritik anomali: SAFE cizgisine don" : threatPct >= 45 ? "Kontrat baskisi yukseliyor" : "Stabil pencere";
    }
    const threatMeter = byId("threatMeter");
    if (threatMeter) {
      animateMeterWidth(threatMeter, threatPct, 0.36);
    }
    const badge = byId("telemetryBadge");
    if (badge) {
      if (threatPct >= 78) {
        badge.textContent = "CRITICAL";
        badge.className = "badge warn";
      } else if (heatPct >= 68) {
        badge.textContent = "PRESSURE";
        badge.className = "badge";
      } else {
        badge.textContent = "LIVE";
        badge.className = "badge info";
      }
    }
    drawTelemetryCanvas();
  }

  async function runSuggestedAction() {
    const suggestion = state.suggestion;
    if (!suggestion) {
      showToast("Oneri hazir degil.", true);
      return;
    }
    if (suggestion.action === "reroll_tasks") {
      await rerollTasks();
      return;
    }
    if (suggestion.action === "open_play") {
      await sendBotAction("open_play");
      return;
    }
    if (suggestion.action === "open_leaderboard") {
      await sendBotAction("open_leaderboard");
      return;
    }
    await performAction(suggestion.action, suggestion.payload || {});
  }

  function render(payload) {
    state.data = payload.data;
    const data = payload.data;
    const profile = data.profile;
    const balances = data.balances;
    const daily = data.daily;
    const season = data.season;
    const nexus = data.nexus || {};
    const contract = data.contract || {};
    const war = data.war;
    const missions = data.missions;
    const riskScore = asNum(data.risk_score);

    byId("kingName").textContent = profile.public_name;
    byId("kingMeta").textContent = `Tier ${profile.kingdom_tier} | Streak ${profile.current_streak} gun`;
    byId("balSC").textContent = asNum(balances.SC).toFixed(0);
    byId("balHC").textContent = asNum(balances.HC).toFixed(0);
    byId("balRC").textContent = asNum(balances.RC).toFixed(0);
    byId("dailyLine").textContent = `${asNum(daily.tasks_done)} / ${asNum(daily.daily_cap)} gorev`;
    byId("dailyMeter").style.width = `${pct(daily.tasks_done, daily.daily_cap)}%`;
    byId("dailyEarned").textContent = `Bugun: ${asNum(daily.sc_earned)} SC | ${asNum(daily.rc_earned)} RC`;
    byId("seasonLine").textContent = `S${season.season_id} | ${season.days_left} gun | ${asNum(season.points)} SP`;
    byId("warLine").textContent = `War ${war.tier} | Havuz ${Math.floor(asNum(war.value))}`;
    byId("riskLine").textContent = `Risk ${(riskScore * 100).toFixed(0)}%`;
    byId("nexusLine").textContent = `Nexus ${String(nexus.title || "-")} | ${asNum(nexus.pressure_pct)}% | ${String(
      nexus.preferred_mode || "balanced"
    )}`;
    renderContract(contract);
    const arenaReady = data.arena?.ready !== false;
    byId("arenaRating").textContent = arenaReady ? `${asNum(data.arena?.rating || 1000)}` : "N/A";
    byId("arenaRank").textContent = arenaReady ? `#${asNum(data.arena?.rank || 0) || "-"}` : "#-";
    renderToken(data.token || {});
    renderAdmin(data.admin || {});
    renderDirector(data);
    renderTelemetryDeck(data);

    renderOffers(data.offers || []);
    renderMissions(missions || { list: [], ready: 0 });
    renderAttempts(data.attempts || {});
    renderEvents(data.events || []);

    const hasActive = Boolean(data.attempts?.active);
    const hasReveal = Boolean(data.attempts?.revealable);
    byId("finishSafeBtn").disabled = !hasActive;
    byId("finishBalancedBtn").disabled = !hasActive;
    byId("finishAggressiveBtn").disabled = !hasActive;
    byId("revealBtn").disabled = !hasReveal;
    const rcLow = asNum(data.balances?.RC) < asNum(data.arena?.ticket_cost_rc || 1);
    byId("raidSafeBtn").disabled = !arenaReady || rcLow;
    byId("raidBalancedBtn").disabled = !arenaReady || rcLow;
    byId("raidAggressiveBtn").disabled = !arenaReady || rcLow;
    byId("arenaBoardBtn").disabled = !arenaReady;
    const pvpFeatureEnabled = Boolean(state.v3.featureFlags?.ARENA_AUTH_ENABLED);
    const pvpStartBtn = byId("pvpStartBtn");
    const pvpRefreshBtn = byId("pvpRefreshBtn");
    const pvpResolveBtn = byId("pvpResolveBtn");
    if (pvpStartBtn) {
      pvpStartBtn.disabled = !pvpFeatureEnabled || rcLow;
    }
    if (pvpRefreshBtn) {
      pvpRefreshBtn.disabled = !pvpFeatureEnabled;
    }
    if (pvpResolveBtn && !state.v3.pvpSession) {
      pvpResolveBtn.disabled = true;
    }
    if (!pvpFeatureEnabled) {
      const pvpStatus = byId("pvpStatus");
      if (pvpStatus) {
        pvpStatus.textContent = "PvP Kapali";
        pvpStatus.className = "badge warn";
      }
      stopPvpLiveLoop();
      renderPvpTickLine(null, null);
    }
    updateArenaStatus(hasReveal ? "Reveal Hazir" : hasActive ? "Deneme Suruyor" : "Yeni Gorev Sec", hasReveal ? "" : "warn");

    if (state.arena) {
      const hue = clamp(180 - riskScore * 100, 20, 190);
      state.arena.core.material.color.setHSL(hue / 360, 0.85, 0.58);
    }
  }

  async function loadBootstrap() {
    const query = new URLSearchParams(state.auth).toString();
    const t0 = performance.now();
    const res = await fetch(`/webapp/api/bootstrap?${query}`);
    markLatency(performance.now() - t0);
    if (!res.ok) {
      throw new Error(`bootstrap_failed:${res.status}`);
    }
    const payload = await res.json();
    if (!payload.success) {
      throw new Error(payload.error || "bootstrap_failed");
    }
    renewAuth(payload);
    state.v3.featureFlags = payload.data?.feature_flags || {};
    if (payload.data?.perf_profile) {
      const perf = payload.data.perf_profile;
      state.telemetry.fpsAvg = asNum(perf.fps_avg || perf.fpsAvg || state.telemetry.fpsAvg);
      state.telemetry.frameTimeMs = asNum(perf.frame_time_ms || perf.frameTimeMs || state.telemetry.frameTimeMs);
      state.telemetry.latencyAvgMs = asNum(perf.latency_avg_ms || perf.latencyAvgMs || state.telemetry.latencyAvgMs);
      state.telemetry.perfTier = String(perf.gpu_tier || perf.gpuTier || state.telemetry.perfTier || "normal");
    }
    if (payload.data?.scene_profile) {
      const scene = payload.data.scene_profile;
      const sceneMode = String(scene.scene_mode || state.ui.sceneMode || "pro").toLowerCase();
      if (SCENE_MODE_VALUES.includes(sceneMode)) {
        state.ui.sceneMode = sceneMode;
      }
      const cameraMode = String(scene.prefs_json?.camera_mode || state.ui.cameraMode || "broadcast").toLowerCase();
      if (CAMERA_MODE_VALUES.includes(cameraMode)) {
        state.ui.cameraMode = cameraMode;
      }
      const perfProfile = String(scene.perf_profile || "").toLowerCase();
      if (["low", "normal", "high"].includes(perfProfile)) {
        state.ui.autoQualityMode = perfProfile;
      }
      const quality = String(scene.quality_mode || "").toLowerCase();
      if (["auto", "high", "normal", "low"].includes(quality)) {
        state.ui.qualityMode = quality === "normal" ? "auto" : quality;
      }
    }
    if (payload.data?.ui_prefs) {
      const prefs = payload.data.ui_prefs;
      const nextReduced = Boolean(prefs.reduced_motion);
      const nextLarge = Boolean(prefs.large_text);
      const quality = String(prefs.quality_mode || "").toLowerCase();
      if (["auto", "high", "normal", "low"].includes(quality)) {
        state.ui.qualityMode = quality === "normal" ? "auto" : quality;
      }
      const cameraMode = String(prefs.camera_mode || "").toLowerCase();
      if (CAMERA_MODE_VALUES.includes(cameraMode)) {
        state.ui.cameraMode = cameraMode;
      }
      state.ui.reducedMotion = nextReduced;
      state.ui.largeText = nextLarge;
      persistUiPrefs();
      applyUiClasses();
    }
    render(payload);
    try {
      await fetchArenaSessionState();
    } catch (err) {
      const message = String(err?.message || "");
      if (
        message.includes("arena_auth_disabled") ||
        message.includes("arena_session_tables_missing") ||
        message.includes("user_not_started")
      ) {
        state.v3.arenaAuthAvailable = false;
        syncArenaSessionUi(null);
      } else {
        throw err;
      }
    }
    try {
      await fetchRaidSessionState();
    } catch (err) {
      const message = String(err?.message || "");
      if (
        message.includes("raid_auth_disabled") ||
        message.includes("raid_session_tables_missing") ||
        message.includes("user_not_started")
      ) {
        state.v3.raidAuthAvailable = false;
        syncRaidSessionUi(null);
      } else {
        throw err;
      }
    }
    try {
      await fetchPvpSessionState();
    } catch (err) {
      const message = String(err?.message || "");
      if (
        message.includes("arena_auth_disabled") ||
        message.includes("pvp_session_tables_missing") ||
        message.includes("user_not_started")
      ) {
        state.v3.pvpAuthAvailable = false;
        syncPvpSessionUi(null, { transport: "poll", tick_ms: 1000, action_window_ms: 800 });
      } else {
        throw err;
      }
    }
    try {
      await loadPvpLeaderboard();
    } catch (err) {
      const message = String(err?.message || "");
      if (
        message.includes("arena_auth_disabled") ||
        message.includes("pvp_session_tables_missing") ||
        message.includes("user_not_started")
      ) {
        renderPvpLeaderboard([]);
      } else {
        throw err;
      }
    }
    schedulePerfProfile(true);
    scheduleSceneProfileSync(true);
  }

  async function rerollTasks() {
    const requestId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const t0 = performance.now();
    const res = await fetch("/webapp/api/tasks/reroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: state.auth.uid,
        ts: state.auth.ts,
        sig: state.auth.sig,
        request_id: requestId
      })
    });
    markLatency(performance.now() - t0);
    const payload = await res.json();
    if (!res.ok || !payload.success) {
      throw new Error(payload.error || `reroll_failed:${res.status}`);
    }
    renewAuth(payload);
    triggerArenaPulse("info", { label: "TASK PANEL REFRESH" });
    showToast("Gorev paneli yenilendi");
    await loadBootstrap();
  }

  function shouldShowIntroModal() {
    try {
      return localStorage.getItem(state.intro.seenKey) !== "1";
    } catch (err) {
      return true;
    }
  }

  function hideIntroModal(remember = false) {
    const modal = byId("introModal");
    if (!modal) return;
    if (remember) {
      try {
        localStorage.setItem(state.intro.seenKey, "1");
      } catch (err) {}
    }
    modal.classList.add("hidden");
    state.intro.visible = false;
  }

  function showIntroModal() {
    const modal = byId("introModal");
    if (!modal) return;
    modal.classList.remove("hidden");
    state.intro.visible = true;
    if (window.gsap && !state.ui.reducedMotion) {
      gsap.fromTo(modal.querySelector(".introCard"), { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.28, ease: "power2.out" });
    }
  }

  function bindUi() {
    byId("refreshBtn").addEventListener("click", () => {
      loadBootstrap().then(() => showToast("Panel yenilendi")).catch(showError);
    });
    byId("rerollBtn").addEventListener("click", () => rerollTasks().catch(showError));
    byId("qualityToggleBtn").addEventListener("click", () => {
      cycleQualityMode();
    });
    const cameraBtn = byId("cameraModeToggleBtn");
    if (cameraBtn) {
      cameraBtn.addEventListener("click", () => {
        cycleCameraMode();
      });
    }
    byId("sceneModeToggleBtn").addEventListener("click", () => {
      cycleSceneMode();
    });
    byId("motionToggleBtn").addEventListener("click", () => {
      toggleMotion();
    });
    byId("typeToggleBtn").addEventListener("click", () => {
      toggleLargeText();
    });
    byId("runSuggestedBtn").addEventListener("click", () => {
      runSuggestedAction().catch(showError);
    });
    byId("refreshDirectorBtn").addEventListener("click", () => {
      loadBootstrap().then(() => showToast("Yonlendirme guncellendi")).catch(showError);
    });
    byId("introStartBtn").addEventListener("click", () => {
      hideIntroModal(true);
      showToast("Nexus aktif");
    });
    byId("introSkipBtn").addEventListener("click", () => {
      hideIntroModal(true);
      showToast("Intro kaydedildi");
    });

    document.querySelectorAll(".cmd").forEach((button) => {
      button.addEventListener("click", () => {
        sendBotAction(button.dataset.action).catch(showError);
      });
    });

    byId("finishSafeBtn").addEventListener("click", () => {
      performAction("complete_latest", { mode: "safe" }).catch(showError);
    });
    byId("finishBalancedBtn").addEventListener("click", () => {
      performAction("complete_latest", { mode: "balanced" }).catch(showError);
    });
    byId("finishAggressiveBtn").addEventListener("click", () => {
      performAction("complete_latest", { mode: "aggressive" }).catch(showError);
    });
    byId("revealBtn").addEventListener("click", () => {
      performAction("reveal_latest").catch(showError);
    });
    byId("raidSafeBtn").addEventListener("click", () => {
      performAction("arena_raid", { mode: "safe" }).catch(showError);
    });
    byId("raidBalancedBtn").addEventListener("click", () => {
      performAction("arena_raid", { mode: "balanced" }).catch(showError);
    });
    byId("raidAggressiveBtn").addEventListener("click", () => {
      performAction("arena_raid", { mode: "aggressive" }).catch(showError);
    });
    byId("arenaBoardBtn").addEventListener("click", () => {
      loadArenaLeaderboard().catch(showError);
    });
    byId("pvpStartBtn").addEventListener("click", () => {
      const mode = chooseModeByRisk(asNum(state.data?.risk_score || 0));
      startPvpSession(mode)
        .then((session) => {
          const score = session?.score?.self;
          showToast(`PvP session acildi | ${String(mode).toUpperCase()} | Skor ${asNum(score)}`);
          triggerArenaPulse("aggressive", { label: "PVP SESSION START" });
        })
        .catch(showError);
    });
    byId("pvpRefreshBtn").addEventListener("click", () => {
      Promise.all([fetchPvpSessionState().catch(() => null), loadPvpLeaderboard().catch(() => [])])
        .then(() => showToast("PvP paneli guncellendi"))
        .catch(showError);
    });
    byId("pvpResolveBtn").addEventListener("click", () => {
      resolvePvpSession()
        .then((resolved) => {
          const outcome = String(
            resolved?.session?.result?.outcome_for_viewer || resolved?.session?.result?.outcome || "resolved"
          ).toUpperCase();
          showToast(`PvP resolve: ${outcome}`);
          triggerArenaPulse("reveal", { label: `PVP RESOLVE ${outcome}` });
          loadBootstrap().catch(() => {});
        })
        .catch(showError);
    });
    byId("pvpStrikeBtn").addEventListener("click", () => {
      enqueuePvpAction("strike")
        .then(() => triggerArenaPulse("aggressive", { action: "strike", label: "PVP STRIKE" }))
        .catch(showError);
    });
    byId("pvpGuardBtn").addEventListener("click", () => {
      enqueuePvpAction("guard")
        .then(() => triggerArenaPulse("safe", { action: "guard", label: "PVP GUARD" }))
        .catch(showError);
    });
    byId("pvpChargeBtn").addEventListener("click", () => {
      enqueuePvpAction("charge")
        .then(() => triggerArenaPulse("balanced", { action: "charge", label: "PVP CHARGE" }))
        .catch(showError);
    });
    byId("pvpBoardBtn").addEventListener("click", () => {
      loadPvpLeaderboard()
        .then((rows) => {
          if (rows.length > 0) {
            const top = rows
              .slice(0, 3)
              .map((x) => `#${asNum(x.rank)} ${String(x.public_name || `u${asNum(x.user_id || 0)}`)} ${asNum(x.rating)}`)
              .join(" | ");
            showToast(`PvP Top: ${top}`);
          } else {
            showToast("PvP liderlik bos.");
          }
        })
        .catch(showError);
    });
    byId("tokenMintBtn").addEventListener("click", () => {
      performAction("mint_token").catch(showError);
    });
    byId("tokenBuyBtn").addEventListener("click", () => {
      const usdAmount = asNum(byId("tokenUsdInput").value || 0);
      const chain = String(byId("tokenChainSelect").value || "").toUpperCase();
      performAction("buy_token", { usd_amount: usdAmount, chain }).catch(showError);
    });
    byId("tokenUsdInput").addEventListener("input", () => {
      scheduleTokenQuote();
    });
    byId("tokenChainSelect").addEventListener("change", () => {
      scheduleTokenQuote();
    });
    byId("tokenTxBtn").addEventListener("click", () => {
      const requestId = asNum(byId("tokenReqInput").value || 0);
      const txHash = String(byId("tokenTxInput").value || "").trim();
      if (!requestId || !txHash) {
        showToast("Talep ID ve tx hash gerekli.", true);
        return;
      }
      performAction("submit_token_tx", { request_id: requestId, tx_hash: txHash }).catch(showError);
    });

    byId("adminRefreshBtn").addEventListener("click", () => {
      fetchAdminSummary()
        .then(() => showToast("Admin panel yenilendi"))
        .catch(showError);
    });
    byId("adminMetricsBtn").addEventListener("click", () => {
      fetchAdminMetrics()
        .then(() => showToast("Admin metrikleri yenilendi"))
        .catch(showError);
    });
    byId("adminAssetsRefreshBtn").addEventListener("click", () => {
      fetchAdminAssetStatus()
        .then((data) => {
          const summary = data?.summary || {};
          showToast(`Asset durum: ${asNum(summary.ready_assets)}/${asNum(summary.total_assets)} ready`);
        })
        .catch(showError);
    });
    byId("adminAssetsReloadBtn").addEventListener("click", () => {
      reloadAdminAssets()
        .then((data) => {
          const summary = data?.summary || {};
          showToast(`Asset reload: ${asNum(summary.ready_assets)}/${asNum(summary.total_assets)} ready`);
        })
        .catch(showError);
    });
    byId("adminRuntimeRefreshBtn").addEventListener("click", () => {
      fetchAdminRuntime()
        .then(() => showToast("Runtime yenilendi"))
        .catch(showError);
    });
    byId("adminRuntimeReconcileBtn").addEventListener("click", () => {
      const reason = String(byId("adminRuntimeReason").value || "").trim() || "manual_runtime_reconcile";
      reconcileAdminRuntime(reason, false)
        .then((data) => {
          showToast(`Runtime reconcile: ${String(data.reconcile_status || "ok")}`);
        })
        .catch(showError);
    });
    byId("adminFreezeOnBtn").addEventListener("click", () => {
      const reason = String(byId("adminFreezeReason").value || "").trim();
      postAdmin("/webapp/api/admin/freeze", { freeze: true, reason })
        .then((data) => {
          renderAdmin({ is_admin: true, summary: data });
          showToast("Freeze acildi");
        })
        .catch(showError);
    });
    byId("adminFreezeOffBtn").addEventListener("click", () => {
      postAdmin("/webapp/api/admin/freeze", { freeze: false, reason: "" })
        .then((data) => {
          renderAdmin({ is_admin: true, summary: data });
          showToast("Freeze kapandi");
        })
        .catch(showError);
    });
    byId("adminTokenApproveBtn").addEventListener("click", () => {
      const requestId = asNum(byId("adminTokenRequestId").value || 0);
      if (!requestId) {
        showToast("Token talep ID gerekli.", true);
        return;
      }
      postAdmin("/webapp/api/admin/token/approve", { request_id: requestId })
        .then((data) => {
          renderAdmin({ is_admin: true, summary: data.summary || state.admin.summary });
          showToast(`Token #${requestId} onaylandi`);
          loadBootstrap().catch(() => {});
        })
        .catch(showError);
    });
    byId("adminTokenPriceSaveBtn").addEventListener("click", () => {
      const usdPrice = asNum(byId("adminTokenPriceInput").value || 0);
      if (!usdPrice) {
        showToast("Token fiyat gir.", true);
        return;
      }
      postAdmin("/webapp/api/admin/token/config", { usd_price: usdPrice })
        .then((summary) => {
          renderAdmin({ is_admin: true, summary });
          showToast("Token fiyat guncellendi");
          loadBootstrap().catch(() => {});
        })
        .catch(showError);
    });
    byId("adminTokenGateSaveBtn").addEventListener("click", () => {
      const minCap = asNum(byId("adminTokenGateMinInput").value || 0);
      const targetMax = asNum(byId("adminTokenGateMaxInput").value || 0);
      if (!minCap) {
        showToast("Gate min cap gerekli.", true);
        return;
      }
      if (targetMax && targetMax < minCap) {
        showToast("Target max, min capten buyuk olmali.", true);
        return;
      }
      postAdmin("/webapp/api/admin/token/config", {
        min_market_cap_usd: minCap,
        target_band_max_usd: targetMax || minCap * 2
      })
        .then((summary) => {
          renderAdmin({ is_admin: true, summary });
          showToast("Token gate guncellendi");
          loadBootstrap().catch(() => {});
        })
        .catch(showError);
    });
    byId("adminCurveSaveBtn").addEventListener("click", () => {
      const enabled = String(byId("adminCurveEnabledInput").value || "1") === "1";
      const adminFloorRaw = String(byId("adminCurveFloorInput").value || "").trim();
      const baseUsdRaw = String(byId("adminCurveBaseInput").value || "").trim();
      const kRaw = String(byId("adminCurveKInput").value || "").trim();
      const demandRaw = String(byId("adminCurveDemandInput").value || "").trim();
      const divisorRaw = String(byId("adminCurveDivisorInput").value || "").trim();
      const payload = { enabled };
      if (adminFloorRaw) payload.admin_floor_usd = asNum(adminFloorRaw);
      if (baseUsdRaw) payload.base_usd = asNum(baseUsdRaw);
      if (kRaw) payload.k = asNum(kRaw);
      if (demandRaw) payload.demand_factor = asNum(demandRaw);
      if (divisorRaw) payload.supply_norm_divisor = Math.floor(asNum(divisorRaw));
      postAdmin("/webapp/api/admin/token/curve", payload)
        .then((summary) => {
          renderAdmin({ is_admin: true, summary });
          showToast("Curve guncellendi");
          loadBootstrap().catch(() => {});
        })
        .catch(showError);
    });
    byId("adminAutoPolicySaveBtn").addEventListener("click", () => {
      const enabled = String(byId("adminAutoPolicyEnabledInput").value || "0") === "1";
      const autoUsdLimitRaw = String(byId("adminAutoUsdLimitInput").value || "").trim();
      const riskThresholdRaw = String(byId("adminAutoRiskInput").value || "").trim();
      const velocityPerHourRaw = String(byId("adminAutoVelocityInput").value || "").trim();
      const payload = { enabled };
      if (autoUsdLimitRaw) payload.auto_usd_limit = asNum(autoUsdLimitRaw);
      if (riskThresholdRaw) payload.risk_threshold = clamp(asNum(riskThresholdRaw), 0, 1);
      if (velocityPerHourRaw) payload.velocity_per_hour = Math.floor(asNum(velocityPerHourRaw));
      postAdmin("/webapp/api/admin/token/auto_policy", payload)
        .then((summary) => {
          renderAdmin({ is_admin: true, summary });
          showToast("Auto policy guncellendi");
          loadBootstrap().catch(() => {});
        })
        .catch(showError);
    });
    byId("adminTokenRejectBtn").addEventListener("click", () => {
      const requestId = asNum(byId("adminTokenRequestId").value || 0);
      if (!requestId) {
        showToast("Token talep ID gerekli.", true);
        return;
      }
      const reason = String(byId("adminFreezeReason").value || "").trim() || "rejected_by_admin";
      postAdmin("/webapp/api/admin/token/reject", { request_id: requestId, reason })
        .then((data) => {
          renderAdmin({ is_admin: true, summary: data.summary || state.admin.summary });
          showToast(`Token #${requestId} reddedildi`);
          loadBootstrap().catch(() => {});
        })
        .catch(showError);
    });
    byId("adminPayoutPayBtn").addEventListener("click", () => {
      const requestId = asNum(byId("adminPayoutRequestId").value || 0);
      const txHash = String(byId("adminPayoutTxHash").value || "").trim();
      if (!requestId || !txHash) {
        showToast("Payout ID ve TX hash gerekli.", true);
        return;
      }
      postAdmin("/webapp/api/admin/payout/pay", { request_id: requestId, tx_hash: txHash })
        .then((data) => {
          renderAdmin({ is_admin: true, summary: data.summary || state.admin.summary });
          showToast(`Payout #${requestId} paid`);
          loadBootstrap().catch(() => {});
        })
        .catch(showError);
    });
    byId("adminPayoutRejectBtn").addEventListener("click", () => {
      const requestId = asNum(byId("adminPayoutRequestId").value || 0);
      if (!requestId) {
        showToast("Payout talep ID gerekli.", true);
        return;
      }
      const reason = String(byId("adminFreezeReason").value || "").trim() || "rejected_by_admin";
      postAdmin("/webapp/api/admin/payout/reject", { request_id: requestId, reason })
        .then((data) => {
          renderAdmin({ is_admin: true, summary: data.summary || state.admin.summary });
          showToast(`Payout #${requestId} reddedildi`);
          loadBootstrap().catch(() => {});
        })
        .catch(showError);
    });
    byId("simStartBtn").addEventListener("click", () => {
      startSimulation().catch(showError);
    });
    byId("simStrikeBtn").addEventListener("click", () => {
      applySimInput("strike");
    });
    byId("simGuardBtn").addEventListener("click", () => {
      applySimInput("guard");
    });
    byId("simChargeBtn").addEventListener("click", () => {
      applySimInput("charge");
    });

    byId("offersList").addEventListener("click", (event) => {
      const target = event.target.closest(".startOfferBtn");
      if (!target) return;
      const offerId = Number(target.dataset.offer);
      if (!offerId) return;
      performAction("accept_offer", { offer_id: offerId }).catch(showError);
    });

    byId("missionsList").addEventListener("click", (event) => {
      const target = event.target.closest(".claimMissionBtn");
      if (!target) return;
      const missionKey = String(target.dataset.missionKey || "").trim();
      if (!missionKey) return;
      performAction("claim_mission", { mission_key: missionKey }).catch(showError);
    });

    resetSimState();
  }

  async function initThree() {
    if (!window.THREE) {
      return;
    }
    setAssetModeLine("Assets: loading...");
    const canvas = byId("bg3d");
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x070b1f, 12, 45);

    const camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.1, 120);
    camera.position.set(0, 1.5, 14);

    const ambient = new THREE.AmbientLight(0x7ab3ff, 0.7);
    const pointA = new THREE.PointLight(0x3df8c2, 1.25, 60);
    const pointB = new THREE.PointLight(0xff5679, 1.1, 60);
    pointA.position.set(4, 2, 7);
    pointB.position.set(-5, -2, 6);
    scene.add(ambient, pointA, pointB);

    const postFxReady = Boolean(
      THREE.EffectComposer &&
        THREE.RenderPass &&
        THREE.UnrealBloomPass &&
        THREE.ShaderPass &&
        THREE.RGBShiftShader &&
        window.innerWidth > 420
    );
    let composer = null;
    let bloomPass = null;
    let rgbShiftPass = null;
    if (postFxReady) {
      try {
        composer = new THREE.EffectComposer(renderer);
        const renderPass = new THREE.RenderPass(scene, camera);
        bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.38, 0.65, 0.55);
        bloomPass.strength = 0.38;
        bloomPass.radius = 0.65;
        bloomPass.threshold = 0.55;
        rgbShiftPass = new THREE.ShaderPass(THREE.RGBShiftShader);
        if (rgbShiftPass.uniforms && rgbShiftPass.uniforms.amount) {
          rgbShiftPass.uniforms.amount.value = 0.0007;
        }
        composer.addPass(renderPass);
        composer.addPass(bloomPass);
        composer.addPass(rgbShiftPass);
      } catch (err) {
        composer = null;
        bloomPass = null;
        rgbShiftPass = null;
      }
    }

    const fallback = createFallbackArena(scene);
    let modelRoot = null;
    const sideModels = [];
    const sideModelMap = {};
    const mixers = [];
    const profile = getQualityProfile();
    const manifest = await loadAssetManifest();
    const models = manifest?.models || {};
    const resolveModelEntry = (key) => {
      const entry = models[key];
      if (!entry) {
        return null;
      }
      if (typeof entry === "string") {
        return { path: entry };
      }
      if (entry && typeof entry === "object" && typeof entry.path === "string") {
        return entry;
      }
      return null;
    };
    const applyTransform = (node, entry, defaults = {}) => {
      if (!node) return;
      const pos = Array.isArray(entry?.position) ? entry.position : defaults.position || [0, 0, 0];
      const rot = Array.isArray(entry?.rotation) ? entry.rotation : defaults.rotation || [0, 0, 0];
      const scl = Array.isArray(entry?.scale) ? entry.scale : defaults.scale || [2, 2, 2];
      node.position.set(asNum(pos[0]), asNum(pos[1]), asNum(pos[2]));
      node.rotation.set(asNum(rot[0]), asNum(rot[1]), asNum(rot[2]));
      node.scale.set(asNum(scl[0]), asNum(scl[1]), asNum(scl[2]));
    };
    const requestedKeys = ["arena_core", "enemy_rig", "reward_crate", "ambient_fx"];
    let loadedAssetCount = 0;
    const coreEntry = resolveModelEntry("arena_core");
    if (coreEntry?.path) {
      const model = await tryLoadArenaModel(scene, String(coreEntry.path));
      if (model && model.root) {
        modelRoot = model.root;
        applyTransform(modelRoot, coreEntry, { scale: [2, 2, 2] });
        mixers.push(...model.mixers);
        loadedAssetCount += 1;
      }
    }
    for (const key of ["enemy_rig", "reward_crate", "ambient_fx"]) {
      const entry = resolveModelEntry(key);
      if (!entry?.path) {
        continue;
      }
      const model = await tryLoadArenaModel(scene, String(entry.path));
      if (model && model.root) {
        applyTransform(model.root, entry, { scale: [1.6, 1.6, 1.6] });
        sideModels.push(model.root);
        sideModelMap[key] = model.root;
        mixers.push(...model.mixers);
        loadedAssetCount += 1;
      }
    }
    const expectedAssetCount = requestedKeys.filter((key) => Boolean(resolveModelEntry(key)?.path)).length;
    const effectiveExpectedCount = Math.max(1, expectedAssetCount);
    const sceneMode = loadedAssetCount >= Math.max(2, expectedAssetCount) ? "PRO" : "LITE";
    setAssetModeLine(`Assets: ${loadedAssetCount}/${effectiveExpectedCount} ${sceneMode}`);

    const starsMaterial = new THREE.PointsMaterial({ color: 0xb2d5ff, size: profile.starSize });
    const stars = new THREE.Points(new THREE.BufferGeometry(), starsMaterial);
    const count = QUALITY_PROFILES.high.starCount;
    const coords = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i += 3) {
      coords[i] = (Math.random() - 0.5) * 54;
      coords[i + 1] = (Math.random() - 0.5) * 34;
      coords[i + 2] = (Math.random() - 0.5) * 30;
    }
    stars.geometry.setAttribute("position", new THREE.BufferAttribute(coords, 3));
    stars.geometry.setDrawRange(0, profile.starCount);
    scene.add(stars);

    const pointer = { x: 0, y: 0 };
    window.addEventListener("pointermove", (event) => {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
    });

    function resize() {
      applyArenaQualityProfile();
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      const pixelRatioCap = asNum(state.arena?.qualityProfile?.pixelRatioCap || profile.pixelRatioCap || 1.5);
      const targetDpr = Math.min(window.devicePixelRatio || 1, pixelRatioCap);
      renderer.setPixelRatio(Math.max(1, targetDpr));
      renderer.setSize(window.innerWidth, window.innerHeight);
      if (composer && typeof composer.setSize === "function") {
        composer.setSize(window.innerWidth, window.innerHeight);
      }
      drawTelemetryCanvas();
    }
    resize();
    window.addEventListener("resize", resize);

    const clock = new THREE.Clock();
    let fpsFrames = 0;
    let fpsWindowStart = performance.now();
    let lowFpsWindows = 0;
    let highFpsWindows = 0;
    function tick() {
      const dt = clock.getDelta();
      const t = performance.now() * 0.001;
      const activeProfile = state.arena?.qualityProfile || profile;
      fallback.core.rotation.x = t * 0.15;
      fallback.core.rotation.y = t * 0.28;
      fallback.ring.rotation.z = t * 0.21;
      fallback.ringOuter.rotation.z = -t * 0.16;
      fallback.pulseShell.rotation.y = t * 0.05;
      stars.rotation.y = t * 0.02;
      const mood = String(state.arena?.moodTarget || "balanced");
      const heat = clamp(asNum(state.arena?.targetHeat || state.telemetry.combatHeat || 0), 0, 1);
      const threat = clamp(asNum(state.arena?.targetThreat || state.telemetry.threatRatio || 0), 0, 1);
      const postFxTarget = clamp(asNum(state.arena?.targetPostFx || state.telemetry.scenePostFxLevel || 0.9), 0.15, 2.5);
      if (fallback.floorGrid?.material) {
        fallback.floorGrid.rotation.z = t * 0.035;
        const floorOpacityTarget = 0.1 + heat * 0.16 + (1 - threat) * 0.04;
        fallback.floorGrid.material.opacity += (floorOpacityTarget - fallback.floorGrid.material.opacity) * 0.06;
        if (fallback.floorGrid.material.color?.setHSL) {
          fallback.floorGrid.material.color.setHSL((200 + heat * 56 - threat * 32) / 360, 0.66, 0.62);
        }
      }
      const moodHueMap = {
        idle: 212,
        safe: 154,
        balanced: 186,
        aggressive: 338,
        critical: 356
      };
      const moodHue = moodHueMap[mood] ?? 186;
      const hue = (moodHue + Math.sin(t * 0.23 + threat * 2.4) * 8 + heat * 10) % 360;
      const fogColor = new THREE.Color().setHSL(hue / 360, 0.46 + heat * 0.18, 0.12 + (1 - threat) * 0.05);
      scene.fog.color.lerp(fogColor, 0.08);
      ambient.color.setHSL((hue + 42) / 360, 0.58, 0.62 + heat * 0.08);
      ambient.intensity += ((0.64 + heat * 0.52 - threat * 0.24) - ambient.intensity) * 0.06;
      pointA.color.setHSL((hue + 24) / 360, 0.82, 0.56);
      pointB.color.setHSL((hue + 196) / 360, 0.78, 0.56);
      pointA.intensity += ((1.08 + heat * 0.62) - pointA.intensity) * 0.09;
      pointB.intensity += ((0.95 + threat * 0.7) - pointB.intensity) * 0.09;
      if (state.arena?.core?.material?.emissive && typeof state.arena.core.material.emissive.setHSL === "function") {
        state.arena.core.material.emissive.setHSL((hue + 14) / 360, 0.68, 0.22 + heat * 0.24);
      }
      if (!state.ui.reducedMotion && state.arena?.core) {
        state.arena.core.scale.setScalar(1 + Math.sin(t * 2.1) * 0.015 * (1 + heat * 1.3));
      } else if (state.arena?.core) {
        state.arena.core.scale.setScalar(1);
      }

      if (activeProfile.enableShards && !state.ui.reducedMotion && fallback.shards && fallback.shardMeta && fallback.shardDummy) {
        const dummy = fallback.shardDummy;
        for (let i = 0; i < fallback.shardMeta.length; i += 1) {
          const meta = fallback.shardMeta[i];
          const angle = meta.angle + t * meta.speed + Math.sin(t * 0.5 + meta.offset) * 0.15;
          const radius = meta.r + Math.sin(t * 0.9 + meta.offset) * 0.2;
          dummy.position.set(Math.cos(angle) * radius, meta.y + Math.sin(t + meta.offset) * 0.2, Math.sin(angle) * radius);
          dummy.rotation.set(t * (0.25 + meta.speed), t * (0.38 + meta.speed), t * 0.2 + meta.offset);
          dummy.updateMatrix();
          fallback.shards.setMatrixAt(i, dummy.matrix);
        }
        fallback.shards.instanceMatrix.needsUpdate = true;
      }

      if (Array.isArray(fallback.drones) && Array.isArray(fallback.droneMeta)) {
        for (let i = 0; i < fallback.drones.length; i += 1) {
          const drone = fallback.drones[i];
          const meta = fallback.droneMeta[i];
          if (!drone || !meta) {
            continue;
          }
          const orbit = meta.offset + t * meta.speed;
          const hover = Math.sin(t * (0.9 + meta.speed * 0.5) + meta.offset) * 0.28;
          drone.position.x = Math.cos(orbit) * meta.radius;
          drone.position.z = Math.sin(orbit) * meta.radius;
          drone.position.y = meta.altitude + hover;
          drone.rotation.x = t * (0.8 + meta.speed * 0.3);
          drone.rotation.y = -t * (0.6 + meta.speed * 0.25);
          drone.rotation.z = t * 0.32;
          if (drone.material?.emissive) {
            drone.material.emissive.setHSL((hue + i * 7) / 360, 0.6, 0.12 + heat * 0.3);
          }
        }
      }

      if (Array.isArray(fallback.pylons) && Array.isArray(fallback.pylonMeta)) {
        for (let i = 0; i < fallback.pylons.length; i += 1) {
          const pylon = fallback.pylons[i];
          const meta = fallback.pylonMeta[i];
          if (!pylon || !meta) {
            continue;
          }
          const pulse = Math.sin(t * meta.pulse + meta.drift);
          const rise = pulse * (0.06 + heat * 0.08);
          pylon.position.y = meta.baseY + rise;
          pylon.scale.y = 1 + pulse * (0.04 + threat * 0.1);
          if (pylon.material?.emissive?.setHSL) {
            pylon.material.emissive.setHSL((hue + i * 11 + 20) / 360, 0.7, 0.12 + heat * 0.3 + threat * 0.14);
          }
          if (pylon.material) {
            const opacityTarget = 0.65 + heat * 0.3 + threat * 0.15;
            pylon.material.opacity += (opacityTarget - pylon.material.opacity) * 0.08;
          }
        }
      }

      const pvpSelf = clamp(asNum(state.arena?.pvpMomentumSelf ?? 0.5), 0, 1);
      const pvpOpp = clamp(asNum(state.arena?.pvpMomentumOpp ?? 0.5), 0, 1);
      const pvpPressure = clamp(asNum(state.arena?.pvpPressure ?? 0.25), 0, 1);
      const pvpCinematicIntensity = clamp(asNum(state.arena?.pvpCinematicIntensity ?? 0), 0, 1);
      const pvpUrgency = String(state.arena?.pvpUrgency || "steady").toLowerCase();
      const momentumDelta = pvpSelf - pvpOpp;
      const urgencyFactorMap = {
        steady: 0.16,
        advantage: 0.3,
        pressure: 0.56,
        critical: 0.92
      };
      const urgencyFactor = (urgencyFactorMap[pvpUrgency] ?? 0.24) + pvpCinematicIntensity * 0.34;
      const selfScale = 0.92 + pvpSelf * 0.42 + urgencyFactor * 0.12;
      const oppScale = 0.92 + pvpOpp * 0.42 + urgencyFactor * 0.12;
      if (fallback.duelCoreSelf) {
        const sway = state.ui.reducedMotion ? 0 : Math.sin(t * (1.3 + urgencyFactor * 0.8)) * (0.08 + pvpPressure * 0.08);
        fallback.duelCoreSelf.position.y = -0.22 + sway;
        fallback.duelCoreSelf.scale.setScalar(selfScale);
        fallback.duelCoreSelf.rotation.y += dt * (0.8 + pvpSelf * 0.9);
        if (fallback.duelCoreSelf.material?.emissive?.setHSL) {
          fallback.duelCoreSelf.material.emissive.setHSL((188 - momentumDelta * 26) / 360, 0.66, 0.18 + pvpSelf * 0.28 + pvpPressure * 0.08);
        }
      }
      if (fallback.duelCoreOpp) {
        const sway = state.ui.reducedMotion ? 0 : Math.sin(t * (1.22 + urgencyFactor * 0.7) + Math.PI) * (0.08 + pvpPressure * 0.08);
        fallback.duelCoreOpp.position.y = -0.22 + sway;
        fallback.duelCoreOpp.scale.setScalar(oppScale);
        fallback.duelCoreOpp.rotation.y -= dt * (0.8 + pvpOpp * 0.9);
        if (fallback.duelCoreOpp.material?.emissive?.setHSL) {
          fallback.duelCoreOpp.material.emissive.setHSL((340 + momentumDelta * 24) / 360, 0.7, 0.14 + pvpOpp * 0.3 + pvpPressure * 0.08);
        }
      }
      if (fallback.duelHaloSelf && fallback.duelCoreSelf) {
        fallback.duelHaloSelf.position.copy(fallback.duelCoreSelf.position);
        fallback.duelHaloSelf.rotation.z += dt * (0.64 + pvpSelf * 1.15);
        fallback.duelHaloSelf.scale.setScalar(1 + pvpSelf * 0.24 + urgencyFactor * 0.08);
        if (fallback.duelHaloSelf.material) {
          fallback.duelHaloSelf.material.opacity += ((0.2 + pvpSelf * 0.32 + pvpPressure * 0.1) - fallback.duelHaloSelf.material.opacity) * 0.1;
        }
      }
      if (fallback.duelHaloOpp && fallback.duelCoreOpp) {
        fallback.duelHaloOpp.position.copy(fallback.duelCoreOpp.position);
        fallback.duelHaloOpp.rotation.z -= dt * (0.64 + pvpOpp * 1.15);
        fallback.duelHaloOpp.scale.setScalar(1 + pvpOpp * 0.24 + urgencyFactor * 0.08);
        if (fallback.duelHaloOpp.material) {
          fallback.duelHaloOpp.material.opacity += ((0.2 + pvpOpp * 0.32 + pvpPressure * 0.1) - fallback.duelHaloOpp.material.opacity) * 0.1;
        }
      }
      if (Array.isArray(fallback.duelBridgeSegments) && Array.isArray(fallback.duelBridgeMeta)) {
        for (let i = 0; i < fallback.duelBridgeSegments.length; i += 1) {
          const bridge = fallback.duelBridgeSegments[i];
          const meta = fallback.duelBridgeMeta[i];
          if (!bridge || !meta || !bridge.material) {
            continue;
          }
          const wobble = Math.sin(t * meta.tempo + meta.drift) * (state.ui.reducedMotion ? 0.02 : 0.12);
          const bias = momentumDelta * 0.18 * (i / Math.max(1, fallback.duelBridgeSegments.length - 1) - 0.5);
          bridge.position.y = meta.baseY + wobble + bias;
          const scalePulse = 0.78 + Math.abs(momentumDelta) * 0.5 + pvpPressure * 0.44;
          bridge.scale.set(0.82 + pvpPressure * 0.24, meta.span * scalePulse, 0.82 + pvpPressure * 0.24);
          bridge.material.opacity = clamp(0.1 + pvpPressure * 0.34 + (1 - Math.abs(momentumDelta)) * 0.14, 0.08, 0.82);
          if (bridge.material.color?.setHSL) {
            bridge.material.color.setHSL((198 + momentumDelta * 44 + i * 2.4) / 360, 0.62, 0.6 - pvpPressure * 0.14);
          }
        }
      }
      if (Array.isArray(fallback.duelBands)) {
        for (let i = 0; i < fallback.duelBands.length; i += 1) {
          const band = fallback.duelBands[i];
          if (!band || !band.material) {
            continue;
          }
          const direction = i % 2 === 0 ? 1 : -1;
          band.rotation.z += dt * direction * (0.08 + urgencyFactor * 0.24 + i * 0.03);
          band.position.y = -0.9 + i * 0.2 + Math.sin(t * (0.8 + i * 0.15) + direction) * (state.ui.reducedMotion ? 0.015 : 0.08);
          const opacityTarget = 0.06 + pvpPressure * 0.18 + urgencyFactor * 0.08 + (i === 0 ? Math.abs(momentumDelta) * 0.08 : 0);
          band.material.opacity += (opacityTarget - asNum(band.material.opacity || 0)) * 0.09;
          if (band.material.color?.setHSL) {
            band.material.color.setHSL((212 + urgencyFactor * 48 + i * 5) / 360, 0.58, 0.58);
          }
        }
      }

      if (Array.isArray(fallback.stormRibbons) && Array.isArray(fallback.stormRibbonMeta)) {
        for (let i = 0; i < fallback.stormRibbons.length; i += 1) {
          const ribbon = fallback.stormRibbons[i];
          const meta = fallback.stormRibbonMeta[i];
          if (!ribbon || !meta || !ribbon.material) {
            continue;
          }
          ribbon.rotation.x += dt * (meta.spinX + urgencyFactor * 0.32);
          ribbon.rotation.y += dt * (meta.spinY + heat * 0.42 + pvpPressure * 0.25);
          ribbon.rotation.z += dt * (meta.spinZ + threat * 0.3);
          const pulse = Math.sin(t * meta.pulse + meta.offset);
          const yBoost = (state.ui.reducedMotion ? 0.04 : 0.14) * (0.5 + heat * 0.7 + pvpPressure * 0.4);
          ribbon.position.y = meta.baseY + pulse * yBoost;
          const scalePulse = meta.baseScale + pulse * (state.ui.reducedMotion ? 0.04 : 0.12) + urgencyFactor * 0.06;
          ribbon.scale.setScalar(scalePulse);
          const opacityTarget = clamp(0.08 + heat * 0.18 + pvpPressure * 0.16 + urgencyFactor * 0.1, 0.08, 0.62);
          ribbon.material.opacity += (opacityTarget - asNum(ribbon.material.opacity || 0)) * 0.1;
          if (ribbon.material.color?.setHSL) {
            ribbon.material.color.setHSL((hue + i * 16 + momentumDelta * 24) / 360, 0.72, 0.6 - pvpPressure * 0.12);
          }
        }
      }

      if (Array.isArray(fallback.raidBeacons) && Array.isArray(fallback.raidBeaconMeta)) {
        for (let i = 0; i < fallback.raidBeacons.length; i += 1) {
          const beacon = fallback.raidBeacons[i];
          const meta = fallback.raidBeaconMeta[i];
          if (!beacon || !meta || !beacon.material) {
            continue;
          }
          const pulse = Math.sin(t * meta.pulse + meta.phase);
          const orbit = meta.angle + Math.sin(t * meta.drift + meta.phase) * 0.05;
          beacon.position.x = Math.cos(orbit) * meta.radius;
          beacon.position.z = Math.sin(orbit) * meta.radius;
          beacon.position.y = meta.baseY + pulse * (state.ui.reducedMotion ? 0.03 : 0.1);
          beacon.scale.y = 1 + pulse * (0.12 + pvpPressure * 0.16 + urgencyFactor * 0.08);
          beacon.rotation.y = -orbit;
          const opacityTarget = clamp(0.48 + heat * 0.2 + urgencyFactor * 0.16, 0.3, 0.9);
          beacon.material.opacity += (opacityTarget - asNum(beacon.material.opacity || 0.7)) * 0.08;
          if (beacon.material.color?.setHSL) {
            beacon.material.color.setHSL((hue + 32 + i * 9) / 360, 0.7, 0.58);
          }
          if (beacon.material.emissive?.setHSL) {
            beacon.material.emissive.setHSL((hue + i * 11) / 360, 0.66, 0.16 + heat * 0.2 + pvpPressure * 0.12);
          }
        }
      }

      const raidSessionLive = state.v3.raidSession || null;
      const raidLiveState = raidSessionLive?.state || {};
      const raidLiveCycle = raidSessionLive?.boss_cycle || {};
      const raidLiveHpTotal = Math.max(0, asNum(raidLiveCycle.hp_total || raidLiveState.hp_total || 0));
      const raidLiveHpRemaining = Math.max(0, asNum(raidLiveCycle.hp_remaining || raidLiveState.hp_remaining || 0));
      const raidLiveHpRatio = raidLiveHpTotal > 0 ? clamp(raidLiveHpRemaining / raidLiveHpTotal, 0, 1) : 1;
      const raidLiveActions = Math.max(0, asNum(raidSessionLive?.action_count || 0));
      const raidLiveActionMax = Math.max(1, asNum(raidLiveState.max_actions || 12));
      const raidLiveTtlSec = Math.max(0, asNum(raidSessionLive?.ttl_sec_left || 0));
      const raidLiveTtlBase = Math.max(45, asNum(raidLiveState.ttl_sec || 90));
      const raidLiveTempo = clamp(
        raidLiveActions / raidLiveActionMax * 0.62 + clamp(1 - raidLiveTtlSec / raidLiveTtlBase, 0, 1) * 0.38,
        0,
        1
      );
      const raidBossPressure = raidSessionLive
        ? clamp((1 - raidLiveHpRatio) * 0.5 + raidLiveTempo * 0.32 + pvpPressure * 0.18, 0, 1)
        : clamp(asNum(state.telemetry.raidBossPressure || 0) * 0.72 + threat * 0.2 + pvpPressure * 0.12, 0, 1);
      const raidBossTone = raidBossPressure >= 0.78 ? "critical" : raidBossPressure >= 0.46 ? "pressure" : "stable";
      state.telemetry.raidBossPressure = raidBossPressure;
      state.telemetry.raidBossTone = raidBossTone;

      if (fallback.bossCluster) {
        const baseY = -0.08;
        const hover = Math.sin(t * (1.1 + raidBossPressure * 1.4)) * (state.ui.reducedMotion ? 0.03 : 0.12);
        fallback.bossCluster.position.y = baseY + hover;
        fallback.bossCluster.rotation.y += dt * (0.24 + raidBossPressure * 0.9 + pvpPressure * 0.24);
      }
      if (fallback.bossCore) {
        fallback.bossCore.rotation.x += dt * (0.3 + raidBossPressure * 0.7);
        fallback.bossCore.rotation.y += dt * (0.46 + raidBossPressure * 1.1);
        const scalePulse = 1 + Math.sin(t * (2 + raidBossPressure * 2.2)) * (state.ui.reducedMotion ? 0.02 : 0.08);
        fallback.bossCore.scale.setScalar(scalePulse + raidBossPressure * 0.12);
        if (fallback.bossCore.material?.emissive?.setHSL) {
          const bossHue = raidBossTone === "critical" ? 356 : raidBossTone === "pressure" ? 26 : 198;
          fallback.bossCore.material.emissive.setHSL(bossHue / 360, 0.74, 0.2 + raidBossPressure * 0.34);
        }
      }
      if (fallback.bossAura?.material) {
        const auraPulse = Math.sin(t * (1.8 + raidBossPressure * 1.6));
        const auraOpacityTarget = clamp(0.08 + raidBossPressure * 0.26 + (auraPulse + 1) * 0.04, 0.06, 0.54);
        fallback.bossAura.material.opacity += (auraOpacityTarget - asNum(fallback.bossAura.material.opacity || 0.12)) * 0.1;
        if (fallback.bossAura.material.color?.setHSL) {
          const auraHue = raidBossTone === "critical" ? 350 : raidBossTone === "pressure" ? 20 : 194;
          fallback.bossAura.material.color.setHSL(auraHue / 360, 0.7, 0.58);
        }
        if (!state.ui.reducedMotion) {
          const auraScale = 1 + auraPulse * 0.08 + raidBossPressure * 0.16;
          fallback.bossAura.scale.setScalar(auraScale);
        } else {
          fallback.bossAura.scale.setScalar(1 + raidBossPressure * 0.08);
        }
      }
      if (Array.isArray(fallback.bossShieldRings) && Array.isArray(fallback.bossShieldMeta)) {
        for (let i = 0; i < fallback.bossShieldRings.length; i += 1) {
          const ring = fallback.bossShieldRings[i];
          const meta = fallback.bossShieldMeta[i];
          if (!ring || !meta || !ring.material) {
            continue;
          }
          ring.rotation.z += dt * meta.spin * (1 + raidBossPressure * 1.4);
          ring.rotation.y += dt * 0.08 * (i % 2 === 0 ? 1 : -1);
          ring.position.y = -0.06 + i * 0.06 + Math.sin(t * meta.pulse + meta.drift) * (state.ui.reducedMotion ? 0.01 : 0.04);
          const ringOpacity = clamp(0.1 + raidBossPressure * 0.34 + (i + 1) * 0.03, 0.08, 0.78);
          ring.material.opacity += (ringOpacity - asNum(ring.material.opacity || 0.12)) * 0.1;
          if (ring.material.color?.setHSL) {
            const ringHue = raidBossTone === "critical" ? 352 : raidBossTone === "pressure" ? 24 : 198;
            ring.material.color.setHSL((ringHue + i * 8) / 360, 0.68, 0.62 - raidBossPressure * 0.08);
          }
        }
      }
      if (Array.isArray(fallback.bossSpikes) && Array.isArray(fallback.bossSpikeMeta)) {
        for (let i = 0; i < fallback.bossSpikes.length; i += 1) {
          const spike = fallback.bossSpikes[i];
          const meta = fallback.bossSpikeMeta[i];
          if (!spike || !meta || !spike.material) {
            continue;
          }
          const orbit = meta.angle + Math.sin(t * meta.orbit + meta.drift) * 0.08;
          spike.position.x = Math.cos(orbit) * meta.radius;
          spike.position.z = Math.sin(orbit) * meta.radius;
          spike.position.y = meta.baseY + Math.sin(t * meta.pulse + meta.drift) * (state.ui.reducedMotion ? 0.02 : 0.07);
          spike.lookAt(0, -0.04, 0);
          const spikeScale = 0.94 + raidBossPressure * 0.42 + Math.sin(t * (1.2 + meta.pulse) + meta.drift) * 0.08;
          spike.scale.setScalar(spikeScale);
          if (spike.material.emissive?.setHSL) {
            const spikeHue = raidBossTone === "critical" ? 354 : raidBossTone === "pressure" ? 22 : 196;
            spike.material.emissive.setHSL((spikeHue + i * 3) / 360, 0.74, 0.16 + raidBossPressure * 0.28);
          }
          spike.material.opacity = clamp(0.58 + raidBossPressure * 0.3, 0.4, 0.94);
        }
      }

      if (Array.isArray(fallback.tracerBeams) && Array.isArray(fallback.tracerMeta)) {
        const tracerLimit = Math.max(0, Math.min(asNum(state.arena?.tracerLimit || fallback.tracerBeams.length), fallback.tracerBeams.length));
        for (let i = 0; i < fallback.tracerBeams.length; i += 1) {
          const beam = fallback.tracerBeams[i];
          const meta = fallback.tracerMeta[i];
          if (!beam || !meta || !beam.material) {
            continue;
          }
          if (i >= tracerLimit) {
            beam.visible = false;
            meta.life = 0;
            meta.maxLife = 0;
            continue;
          }
          if (meta.life > 0) {
            meta.life = Math.max(0, meta.life - dt);
            const lifeRatio = meta.maxLife > 0 ? meta.life / meta.maxLife : 0;
            const width = asNum(meta.width || 1);
            beam.visible = true;
            beam.material.opacity = lifeRatio * (0.76 + heat * 0.16);
            const flare = 1 + (1 - lifeRatio) * 0.65;
            beam.scale.x = width * flare;
            beam.scale.z = width * flare;
            if (!state.ui.reducedMotion) {
              beam.rotation.y += dt * (0.4 + asNum(meta.drift || 0) * 0.08);
            }
            if (meta.life <= 0.0001) {
              beam.visible = false;
              beam.material.opacity = 0;
            }
          } else {
            beam.visible = false;
          }
        }
      }

      if (Array.isArray(fallback.impactNodes) && Array.isArray(fallback.impactMeta)) {
        const impactLimit = Math.max(0, Math.min(asNum(state.arena?.impactLimit || fallback.impactNodes.length), fallback.impactNodes.length));
        for (let i = 0; i < fallback.impactNodes.length; i += 1) {
          const node = fallback.impactNodes[i];
          const meta = fallback.impactMeta[i];
          if (!node || !meta || !node.material) {
            continue;
          }
          if (i >= impactLimit) {
            node.visible = false;
            meta.life = 0;
            meta.maxLife = 0;
            continue;
          }
          if (meta.life > 0) {
            meta.life = Math.max(0, meta.life - dt);
            const lifeRatio = meta.maxLife > 0 ? meta.life / meta.maxLife : 0;
            const scaleBoost = 1 + (1 - lifeRatio) * (state.ui.reducedMotion ? 0.45 : 1.2);
            node.visible = true;
            node.material.opacity = lifeRatio * (0.82 + heat * 0.1);
            node.scale.setScalar(scaleBoost);
            if (meta.life <= 0.0001) {
              node.visible = false;
              node.material.opacity = 0;
            }
          } else {
            node.visible = false;
          }
        }
      }

      decayCombatHudState(dt);
      if (state.arena) {
        const decayRate = state.ui.reducedMotion ? 0.42 : 0.28;
        state.arena.pvpCinematicIntensity = Math.max(0, pvpCinematicIntensity - dt * decayRate);
      }

      if (modelRoot) {
        const moodRate = mood === "critical" ? 0.54 : mood === "aggressive" ? 0.46 : mood === "safe" ? 0.24 : 0.35;
        modelRoot.rotation.y += dt * moodRate;
        modelRoot.position.y += (Math.sin(t * 1.6) * 0.08 - modelRoot.position.y) * 0.06;
      }
      for (const model of sideModels) {
        model.rotation.y += dt * 0.08;
        model.position.y += (Math.sin(t * 1.5 + model.position.x) * 0.05 - model.position.y) * 0.08;
      }
      for (const mixer of mixers) {
        mixer.update(dt);
      }
      const cameraMode = String(state.ui.cameraMode || "broadcast").toLowerCase();
      let cameraDriftMul = 1;
      let cameraLift = 1.5;
      let cameraPointerStrength = 0.52;
      let cameraDepthBase = 14;
      let cameraLerp = activeProfile.pointerLerp;
      let fovBase = 56;
      if (cameraMode === "tactical") {
        cameraDriftMul = 0.74;
        cameraLift = 1.86;
        cameraPointerStrength = 0.44;
        cameraDepthBase = 15.4;
        cameraLerp = Math.max(0.009, activeProfile.pointerLerp * 0.78);
        fovBase = 52;
      } else if (cameraMode === "chase") {
        cameraDriftMul = 1.28;
        cameraLift = 1.26;
        cameraPointerStrength = 0.66;
        cameraDepthBase = 12.8;
        cameraLerp = Math.min(0.038, activeProfile.pointerLerp * 1.35);
        fovBase = 60;
      }
      const cameraTargetX = pointer.x * activeProfile.cameraDrift * cameraDriftMul;
      const cameraTargetY = -pointer.y * (activeProfile.cameraDrift * cameraPointerStrength);
      const cameraTargetZ =
        cameraDepthBase +
        heat * (cameraMode === "tactical" ? 0.3 : cameraMode === "chase" ? -0.6 : -0.15) +
        pvpCinematicIntensity * (cameraMode === "chase" ? -0.45 : 0.18);
      camera.position.x += (cameraTargetX - camera.position.x) * cameraLerp;
      camera.position.y += (cameraTargetY - camera.position.y + cameraLift) * cameraLerp;
      camera.position.z += (cameraTargetZ - camera.position.z) * Math.max(0.03, Math.min(0.18, cameraLerp * 1.6));
      const cameraImpulse = asNum(state.arena?.cameraImpulse || 0);
      if (cameraImpulse > 0.0001 && !state.ui.reducedMotion) {
        camera.position.x += (Math.random() - 0.5) * cameraImpulse * 0.24;
        camera.position.y += (Math.random() - 0.5) * cameraImpulse * 0.17;
        camera.position.z += (Math.random() - 0.5) * cameraImpulse * 0.11;
        state.arena.cameraImpulse = Math.max(0, cameraImpulse - dt * (0.92 + heat * 0.74));
      } else if (state.arena?.cameraImpulse) {
        state.arena.cameraImpulse = 0;
      }
      const targetFov = fovBase + heat * 3.8 + Math.min(2.8, cameraImpulse * 14) + pvpCinematicIntensity * 3.2;
      camera.fov += (targetFov - camera.fov) * 0.08;
      camera.updateProjectionMatrix();
      camera.lookAt(0, 0, 0);
      if (composer && bloomPass && rgbShiftPass) {
        const motionBoost = state.ui.reducedMotion ? 0.5 : 1;
        bloomPass.strength +=
          ((0.26 + postFxTarget * 0.32 + heat * 0.4 + pvpCinematicIntensity * 0.2) * motionBoost - bloomPass.strength) * 0.08;
        bloomPass.radius += ((0.45 + postFxTarget * 0.18 + threat * 0.2) * motionBoost - bloomPass.radius) * 0.08;
        bloomPass.threshold += ((0.62 - heat * 0.16) - bloomPass.threshold) * 0.08;
        if (rgbShiftPass.uniforms && rgbShiftPass.uniforms.amount) {
          const currentAmount = asNum(rgbShiftPass.uniforms.amount.value || 0);
          const targetAmount = (0.0005 + threat * 0.0016 + heat * 0.0008 + pvpCinematicIntensity * 0.0009) * motionBoost;
          rgbShiftPass.uniforms.amount.value = currentAmount + (targetAmount - currentAmount) * 0.12;
        }
        composer.render();
      } else {
        renderer.render(scene, camera);
      }

      fpsFrames += 1;
      const now = performance.now();
      if (now - fpsWindowStart >= 1000) {
        const fps = (fpsFrames * 1000) / (now - fpsWindowStart);
        const frameTimeMs = fps > 0 ? 1000 / fps : 0;
        if (!state.telemetry.fpsAvg) {
          state.telemetry.fpsAvg = fps;
        } else {
          state.telemetry.fpsAvg = state.telemetry.fpsAvg * 0.82 + fps * 0.18;
        }
        if (!state.telemetry.frameTimeMs) {
          state.telemetry.frameTimeMs = frameTimeMs;
        } else {
          state.telemetry.frameTimeMs = state.telemetry.frameTimeMs * 0.82 + frameTimeMs * 0.18;
        }
        if (fps < 24) {
          state.telemetry.droppedFrames += 1;
        }
        fpsFrames = 0;
        fpsWindowStart = now;
        if (state.ui.qualityMode === "auto") {
          if (fps < 28) {
            lowFpsWindows += 1;
            highFpsWindows = 0;
            if (lowFpsWindows >= 3 && state.ui.autoQualityMode !== "low") {
              state.ui.autoQualityMode = "low";
              applyArenaQualityProfile(getQualityProfile("low"));
              showToast("Performans: Auto low moda gecti");
            }
          } else if (fps > 52) {
            highFpsWindows += 1;
            lowFpsWindows = 0;
            if (highFpsWindows >= 6 && state.ui.autoQualityMode === "low") {
              state.ui.autoQualityMode = "normal";
              applyArenaQualityProfile(getQualityProfile("normal"));
              showToast("Performans: Auto normal moda dondu");
            }
          } else {
            lowFpsWindows = 0;
            highFpsWindows = 0;
          }
        }
        schedulePerfProfile(false);
      }
      requestAnimationFrame(tick);
    }

    state.arena = {
      renderer,
      composer,
      bloomPass,
      rgbShiftPass,
      scene,
      camera,
      ring: fallback.ring,
      ringOuter: fallback.ringOuter,
      core: fallback.core,
      glow: fallback.glow,
      pulseShell: fallback.pulseShell,
      shards: fallback.shards,
      drones: fallback.drones,
      droneMeta: fallback.droneMeta,
      pylons: fallback.pylons,
      pylonMeta: fallback.pylonMeta,
      floorGrid: fallback.floorGrid,
      pulseWaves: fallback.pulseWaves,
      pulseWaveCursor: fallback.pulseWaveCursor,
      tracerBeams: fallback.tracerBeams,
      tracerMeta: fallback.tracerMeta,
      tracerCursor: fallback.tracerCursor,
      tracerLimit: fallback.tracerLimit,
      impactNodes: fallback.impactNodes,
      impactMeta: fallback.impactMeta,
      impactCursor: fallback.impactCursor,
      impactLimit: fallback.impactLimit,
      duelCoreSelf: fallback.duelCoreSelf,
      duelCoreOpp: fallback.duelCoreOpp,
      duelHaloSelf: fallback.duelHaloSelf,
      duelHaloOpp: fallback.duelHaloOpp,
      duelBridgeSegments: fallback.duelBridgeSegments,
      duelBridgeMeta: fallback.duelBridgeMeta,
      duelBands: fallback.duelBands,
      stormRibbons: fallback.stormRibbons,
      stormRibbonMeta: fallback.stormRibbonMeta,
      raidBeacons: fallback.raidBeacons,
      raidBeaconMeta: fallback.raidBeaconMeta,
      bossCluster: fallback.bossCluster,
      bossCore: fallback.bossCore,
      bossAura: fallback.bossAura,
      bossShieldRings: fallback.bossShieldRings,
      bossShieldMeta: fallback.bossShieldMeta,
      bossSpikes: fallback.bossSpikes,
      bossSpikeMeta: fallback.bossSpikeMeta,
      stars,
      starsMaterial,
      modelRoot,
      sideModels,
      sideModelMap,
      qualityProfile: profile,
      mixers,
      moodTarget: "balanced",
      cameraImpulse: 0,
      targetPostFx: asNum(state.telemetry.scenePostFxLevel || 0.9),
      targetHeat: 0,
      targetThreat: 0,
      pvpMomentumSelf: 0.5,
      pvpMomentumOpp: 0.5,
      pvpPressure: 0.25,
      pvpUrgency: "steady",
      pvpRecommendation: "balanced"
    };
    applyArenaQualityProfile(profile);
    tick();
  }

  function showError(err) {
    const raw = String(err?.message || err || "bilinmeyen_hata");
    const map = {
      no_pending_attempt: "Aktif deneme yok, once gorev baslat.",
      no_revealable_attempt: "Reveal icin tamamlanmis deneme yok.",
      freeze_mode: "Sistem bakim modunda.",
      offer_not_found: "Gorev karti bulunamadi.",
      attempt_not_found: "Deneme bulunamadi.",
      mission_key_invalid: "Misyon anahtari gecersiz.",
      insufficient_rc: "RC yetersiz, arena ticket alinmadi.",
      arena_cooldown: "Arena cooldown aktif, biraz bekle.",
      arena_tables_missing: "Arena tablolari migration bekliyor.",
      pvp_session_tables_missing: "PvP tablolari migration bekliyor.",
      pvp_session_not_found: "PvP oturumu bulunamadi.",
      pvp_ticket_error: "PvP ticket yazilamadi, tekrar dene.",
      raid_session_tables_missing: "Raid tablolari migration bekliyor.",
      raid_session_not_found: "Raid oturumu bulunamadi.",
      raid_auth_disabled: "Raid authoritative mod kapali.",
      raid_session_expired: "Raid oturumu zaman asimina ugradi.",
      raid_session_resolved: "Raid oturumu zaten cozuldu.",
      session_not_found: "Session bulunamadi, yeni duel baslat.",
      session_not_ready: "Resolve icin yeterli aksiyon yok.",
      session_not_active: "Session aktif degil.",
      invalid_action_seq: "Aksiyon sirasi gecersiz, paneli yenile.",
      session_expired: "Session suresi doldu, yeni duel ac.",
      token_tables_missing: "Token migration eksik, DB migrate calistir.",
      token_disabled: "Token sistemi su an kapali.",
      purchase_below_min: "USD miktari min sinirin altinda.",
      purchase_above_max: "USD miktari max siniri asti.",
      unsupported_chain: "Desteklenmeyen zincir secildi.",
      chain_address_missing: "Bu zincir icin odeme adresi tanimli degil.",
      market_cap_gate: "Payout market-cap gate nedeniyle su an kapali.",
      admin_required: "Bu islem admin hesabi gerektirir.",
      no_patch_fields: "Guncelleme icin en az bir alan gir.",
      invalid_gate_band: "Gate max degeri min degerden kucuk olamaz.",
      request_not_found: "Token talebi bulunamadi.",
      tx_hash_missing: "Token onayi icin tx hash zorunlu.",
      tx_hash_already_used: "Bu tx hash baska bir talepte kullanildi.",
      already_approved: "Talep zaten onayli.",
      already_rejected: "Talep reddedilmis."
    };
    const message = map[raw] || raw;
    showToast(`Hata: ${message}`, true);
  }

  async function boot() {
    initPerfBridge();
    loadUiPrefs();
    initAudioBank();
    await initThree();
    bindUi();
    bindPageLifecycle();
    renderCombatHudPanel();
    if (window.gsap && !state.ui.reducedMotion) {
      gsap.from(".card, .panel", { y: 18, opacity: 0, stagger: 0.05, duration: 0.38, ease: "power2.out" });
    }
    await loadBootstrap();
    if (shouldShowIntroModal()) {
      showIntroModal();
    }
    showToast("Nexus baglandi");
  }

  boot().catch(showError);
})();
