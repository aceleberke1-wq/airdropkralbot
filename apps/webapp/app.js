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
      summary: null
    },
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
    }
  };

  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  if (tg) {
    tg.expand();
    tg.ready();
    tg.setHeaderColor("#0d1635");
    tg.setBackgroundColor("#0b112a");
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function asNum(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
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

  function tokenDecimals(token) {
    return Math.max(2, Math.min(8, Number(token?.decimals || 4)));
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

  async function loadAssetManifest() {
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

    return { ring, ringOuter, core, glow, pulseShell, shards, shardMeta, shardDummy: dummy };
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
    if (!state.sim.active || !state.sim.awaiting) {
      return;
    }

    const good = action === state.sim.expected;
    if (good) {
      state.sim.hits += 1;
      state.sim.combo += 1;
      state.sim.score += 8 + Math.min(12, state.sim.combo * 2);
      setSimPrompt(`Perfect ${action.toUpperCase()} +${8 + Math.min(12, state.sim.combo * 2)}`, "ok");
      triggerArenaPulse(action === "strike" ? "aggressive" : action === "guard" ? "safe" : "balanced");
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
    if (action === "open_missions") return "/missions";
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

  function triggerArenaPulse(tone) {
    if (!state.arena) return;
    const palette = {
      safe: 0x70ffa0,
      balanced: 0x3df8c2,
      aggressive: 0xff5679,
      reveal: 0xffb85c,
      info: 0xa6c3ff
    };
    const color = palette[tone] || palette.info;
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
      triggerArenaPulse(payload.mode || (action === "reveal_latest" ? "reveal" : "info"));
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
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
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
    try {
      const apiData = await postActionApi(action, payload);
      if (apiData) {
        triggerArenaPulse(payload.mode || (action === "reveal_latest" ? "reveal" : "info"));
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
    const res = await fetch(`/webapp/api/arena/leaderboard?${query}`);
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
    if (requests.length > 0) {
      const latest = requests[0];
      byId("tokenHint").textContent = `Son talep #${latest.id} ${String(latest.status || "").toUpperCase()} (${asNum(latest.usd_amount).toFixed(2)} USD)`;
    } else {
      byId("tokenHint").textContent = "Talep olustur, odeme yap, tx hash gonder, admin onayi bekle.";
    }

    const chainSelect = byId("tokenChainSelect");
    const chains = Array.isArray(safe.purchase?.chains) ? safe.purchase.chains : [];
    const current = chainSelect.value || "";
    chainSelect.innerHTML = chains
      .filter((x) => x.enabled)
      .map((x) => `<option value="${x.chain}">${x.chain} (${x.pay_currency})</option>`)
      .join("");

    if (!chainSelect.value && chains.length > 0) {
      chainSelect.value = String(chains[0].chain || "");
    }
    if (current && [...chainSelect.options].some((o) => o.value === current)) {
      chainSelect.value = current;
    }
    byId("tokenBuyBtn").disabled = chainSelect.options.length === 0;
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
    const freeze = summary.freeze || {};
    const token = summary.token || {};
    const gate = token.payout_gate || {};
    byId("adminBadge").textContent = freeze.freeze ? "FREEZE ON" : "ADMIN";
    byId("adminBadge").className = freeze.freeze ? "badge warn" : "badge info";
    byId("adminMeta").textContent = `Users ${asNum(summary.total_users)} | Active ${asNum(summary.active_attempts)}`;
    byId("adminTokenCap").textContent = `Cap $${asNum(token.market_cap_usd).toFixed(2)} | Gate ${gate.allowed ? "OPEN" : "LOCKED"} (${asNum(gate.current).toFixed(2)} / ${asNum(gate.min).toFixed(2)})`;
    byId("adminQueue").textContent = `Queue: payout ${asNum(summary.pending_payout_count)} | token ${asNum(summary.pending_token_count)}`;
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
    return payload.data;
  }

  async function postAdmin(path, extraBody = {}) {
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

  function render(payload) {
    state.data = payload.data;
    const data = payload.data;
    const profile = data.profile;
    const balances = data.balances;
    const daily = data.daily;
    const season = data.season;
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
    const arenaReady = data.arena?.ready !== false;
    byId("arenaRating").textContent = arenaReady ? `${asNum(data.arena?.rating || 1000)}` : "N/A";
    byId("arenaRank").textContent = arenaReady ? `#${asNum(data.arena?.rank || 0) || "-"}` : "#-";
    renderToken(data.token || {});
    renderAdmin(data.admin || {});

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
    updateArenaStatus(hasReveal ? "Reveal Hazir" : hasActive ? "Deneme Suruyor" : "Yeni Gorev Sec", hasReveal ? "" : "warn");

    if (state.arena) {
      const hue = clamp(180 - riskScore * 100, 20, 190);
      state.arena.core.material.color.setHSL(hue / 360, 0.85, 0.58);
    }
  }

  async function loadBootstrap() {
    const query = new URLSearchParams(state.auth).toString();
    const res = await fetch(`/webapp/api/bootstrap?${query}`);
    if (!res.ok) {
      throw new Error(`bootstrap_failed:${res.status}`);
    }
    const payload = await res.json();
    if (!payload.success) {
      throw new Error(payload.error || "bootstrap_failed");
    }
    renewAuth(payload);
    render(payload);
  }

  async function rerollTasks() {
    const requestId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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
    const payload = await res.json();
    if (!res.ok || !payload.success) {
      throw new Error(payload.error || `reroll_failed:${res.status}`);
    }
    renewAuth(payload);
    triggerArenaPulse("info");
    showToast("Gorev paneli yenilendi");
    await loadBootstrap();
  }

  function bindUi() {
    byId("refreshBtn").addEventListener("click", () => {
      loadBootstrap().then(() => showToast("Panel yenilendi")).catch(showError);
    });
    byId("rerollBtn").addEventListener("click", () => rerollTasks().catch(showError));

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
    byId("tokenMintBtn").addEventListener("click", () => {
      performAction("mint_token").catch(showError);
    });
    byId("tokenBuyBtn").addEventListener("click", () => {
      const usdAmount = asNum(byId("tokenUsdInput").value || 0);
      const chain = String(byId("tokenChainSelect").value || "").toUpperCase();
      performAction("buy_token", { usd_amount: usdAmount, chain }).catch(showError);
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

    const fallback = createFallbackArena(scene);
    let modelRoot = null;
    const mixers = [];
    const manifest = await loadAssetManifest();
    const modelPath = String(manifest?.models?.arena_core || "");
    if (modelPath) {
      const model = await tryLoadArenaModel(scene, modelPath);
      if (model) {
        modelRoot = model.root;
        mixers.push(...model.mixers);
      }
    }

    const stars = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({ color: 0xb2d5ff, size: 0.03 })
    );
    const count = 2200;
    const coords = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i += 3) {
      coords[i] = (Math.random() - 0.5) * 54;
      coords[i + 1] = (Math.random() - 0.5) * 34;
      coords[i + 2] = (Math.random() - 0.5) * 30;
    }
    stars.geometry.setAttribute("position", new THREE.BufferAttribute(coords, 3));
    scene.add(stars);

    const pointer = { x: 0, y: 0 };
    window.addEventListener("pointermove", (event) => {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
    });

    function resize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    resize();
    window.addEventListener("resize", resize);

    const clock = new THREE.Clock();
    function tick() {
      const dt = clock.getDelta();
      const t = performance.now() * 0.001;
      fallback.core.rotation.x = t * 0.15;
      fallback.core.rotation.y = t * 0.28;
      fallback.ring.rotation.z = t * 0.21;
      fallback.ringOuter.rotation.z = -t * 0.16;
      fallback.pulseShell.rotation.y = t * 0.05;
      stars.rotation.y = t * 0.02;

      if (fallback.shards && fallback.shardMeta && fallback.shardDummy) {
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

      if (modelRoot) {
        modelRoot.rotation.y += dt * 0.35;
      }
      for (const mixer of mixers) {
        mixer.update(dt);
      }
      camera.position.x += ((pointer.x * 1.1) - camera.position.x) * 0.02;
      camera.position.y += ((-pointer.y * 0.6) - camera.position.y + 1.5) * 0.02;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    }
    tick();

    state.arena = {
      renderer,
      scene,
      camera,
      ring: fallback.ring,
      ringOuter: fallback.ringOuter,
      core: fallback.core,
      glow: fallback.glow,
      pulseShell: fallback.pulseShell,
      shards: fallback.shards,
      modelRoot,
      mixers
    };
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
      token_tables_missing: "Token migration eksik, DB migrate calistir.",
      token_disabled: "Token sistemi su an kapali.",
      purchase_below_min: "USD miktari min sinirin altinda.",
      purchase_above_max: "USD miktari max siniri asti.",
      unsupported_chain: "Desteklenmeyen zincir secildi.",
      chain_address_missing: "Bu zincir icin odeme adresi tanimli degil.",
      market_cap_gate: "Payout market-cap gate nedeniyle su an kapali.",
      admin_required: "Bu islem admin hesabi gerektirir.",
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
    await initThree();
    bindUi();
    gsap.from(".card, .panel", { y: 18, opacity: 0, stagger: 0.05, duration: 0.38, ease: "power2.out" });
    await loadBootstrap();
    showToast("Nexus baglandi");
  }

  boot().catch(showError);
})();
