import { resolveLoopRailTone } from "../core/runtime/loopRailTone.js";
import { renderLoopBridgeBlocks, renderLoopBridgeCards, renderLoopBridgePanels, type LoopBridgeBlock, type LoopBridgeCard, type LoopBridgePanel } from "./loopBridgeCards.js";

type OfferItem = {
  id: number | string;
  title: string;
  family: string;
  durationMinutes: number;
  difficultyPct: number;
  rewardPreview: string;
  remainingMins: number;
};

type MissionItem = {
  key: string;
  title: string;
  status: string;
  progressText: string;
  canClaim: boolean;
};

type EventItem = {
  label: string;
  time: string;
  hint: string;
};

type PulseChip = {
  id: string;
  text: string;
  tone?: string;
  level?: number;
};

type LoopFamilyPanel = {
  text: string;
  tone?: string;
  cards?: LoopBridgeCard[];
  blocks?: LoopBridgeBlock[];
  familyText?: string;
  flowText?: string;
  summaryText?: string;
  gateText?: string;
  leadText?: string;
  windowText?: string;
  pressureText?: string;
  responseText?: string;
  focusText: string;
  stageText: string;
  stateText: string;
  opsText: string;
  signalText: string;
  detailText: string;
  attentionText?: string;
  cadenceText?: string;
};

type LoopPayload = {
  lineText: string;
  hintText: string;
  focusText: string;
  opsText: string;
  statusText: string;
  detailText: string;
  signalText: string;
  sequenceText: string;
  [key: string]: unknown;
};

export type OperationsDeckBridgePayload = {
  offers?: {
    badgeText: string;
    emptyText?: string;
    items: OfferItem[];
  };
  missions?: {
    badgeText: string;
    emptyText?: string;
    items: MissionItem[];
  };
  attempts?: {
    activeText: string;
    revealText: string;
  };
  events?: {
    emptyText?: string;
    items: EventItem[];
  };
  pulse?: {
    lineText: string;
    hintText: string;
    chips: PulseChip[];
  };
  loop?: LoopPayload;
};

type OperationsDeckBridge = {
  render: (payload: OperationsDeckBridgePayload) => boolean;
};

declare global {
  interface Window {
    __AKR_OPERATIONS_DECK__?: OperationsDeckBridge;
  }
}

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function safeText(value: unknown, fallback = ""): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function asNum(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clearNode(node: HTMLElement): void {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function renderOffers(payload: NonNullable<OperationsDeckBridgePayload["offers"]>): boolean {
  const host = byId<HTMLElement>("offersList");
  const badge = byId<HTMLElement>("offerBadge");
  if (!host || !badge) {
    return false;
  }
  badge.textContent = safeText(payload.badgeText, "0 aktif");
  clearNode(host);

  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = safeText(payload.emptyText, "Acil gorev yok. Panel yenileyebilirsin.");
    host.appendChild(empty);
    return true;
  }

  items.forEach((item) => {
    const article = document.createElement("article");
    article.className = "offer";

    const top = document.createElement("div");
    top.className = "offerTop";
    const title = document.createElement("h4");
    title.textContent = safeText(item.title, "Gorev");
    const family = document.createElement("small");
    family.textContent = `[${safeText(item.family, "core").toUpperCase()}]`;
    title.appendChild(document.createTextNode(" "));
    title.appendChild(family);
    const idBadge = document.createElement("span");
    idBadge.className = "badge info";
    idBadge.textContent = `ID ${safeText(item.id, "-")}`;
    top.appendChild(title);
    top.appendChild(idBadge);

    const line1 = document.createElement("p");
    line1.className = "muted";
    line1.textContent = `Sure ${asNum(item.durationMinutes)} dk | Zorluk ${asNum(item.difficultyPct).toFixed(0)}%`;

    const line2 = document.createElement("p");
    line2.className = "muted";
    line2.textContent = `Odul ${safeText(item.rewardPreview, "-")} | Kalan ${Math.max(0, Math.floor(asNum(item.remainingMins)))} dk`;

    const actions = document.createElement("div");
    actions.className = "offerActions";
    const btn = document.createElement("button");
    btn.className = "btn accent startOfferBtn";
    btn.dataset.offer = safeText(item.id);
    btn.textContent = "Gorevi Baslat";
    actions.appendChild(btn);

    article.appendChild(top);
    article.appendChild(line1);
    article.appendChild(line2);
    article.appendChild(actions);
    host.appendChild(article);
  });

  return true;
}

function missionStatusClass(status: string): string {
  const normalized = safeText(status).toUpperCase();
  if (normalized === "HAZIR") {
    return "badge";
  }
  if (normalized === "ALINDI") {
    return "badge info";
  }
  return "badge warn";
}

function renderMissions(payload: NonNullable<OperationsDeckBridgePayload["missions"]>): boolean {
  const host = byId<HTMLElement>("missionsList");
  const badge = byId<HTMLElement>("missionBadge");
  if (!host || !badge) {
    return false;
  }
  badge.textContent = safeText(payload.badgeText, "0 hazir");
  clearNode(host);

  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = safeText(payload.emptyText, "Misyon verisi yok.");
    host.appendChild(empty);
    return true;
  }

  items.forEach((item) => {
    const article = document.createElement("article");
    article.className = "mission";

    const top = document.createElement("div");
    top.className = "offerTop";
    const title = document.createElement("h4");
    title.textContent = safeText(item.title, "Misyon");
    const status = document.createElement("span");
    status.className = missionStatusClass(safeText(item.status));
    status.textContent = safeText(item.status, "DEVAM");
    top.appendChild(title);
    top.appendChild(status);

    const line = document.createElement("p");
    line.className = "muted";
    line.textContent = safeText(item.progressText, "0/0");

    article.appendChild(top);
    article.appendChild(line);

    if (item.canClaim) {
      const actions = document.createElement("div");
      actions.className = "missionActions";
      const btn = document.createElement("button");
      btn.className = "btn accent claimMissionBtn";
      btn.dataset.missionKey = safeText(item.key);
      btn.textContent = "Odulu Al";
      actions.appendChild(btn);
      article.appendChild(actions);
    }

    host.appendChild(article);
  });

  return true;
}

function renderAttempts(payload: NonNullable<OperationsDeckBridgePayload["attempts"]>): boolean {
  const activeNode = byId<HTMLElement>("activeAttempt");
  const revealNode = byId<HTMLElement>("revealAttempt");
  if (!activeNode || !revealNode) {
    return false;
  }
  activeNode.textContent = safeText(payload.activeText, "Yok");
  revealNode.textContent = safeText(payload.revealText, "Yok");
  return true;
}

function renderEvents(payload: NonNullable<OperationsDeckBridgePayload["events"]>): boolean {
  const host = byId<HTMLElement>("eventFeed");
  if (!host) {
    return false;
  }
  clearNode(host);

  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length === 0) {
    const li = document.createElement("li");
    li.textContent = safeText(payload.emptyText, "Event akisi bos.");
    host.appendChild(li);
    return true;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    const label = document.createElement("strong");
    label.textContent = safeText(item.label, "event");
    const time = document.createElement("span");
    time.className = "time";
    time.textContent = safeText(item.time);
    const hint = document.createElement("span");
    hint.className = "time";
    hint.textContent = safeText(item.hint);

    li.appendChild(label);
    li.appendChild(time);
    li.appendChild(hint);
    host.appendChild(li);
  });
  return true;
}

function renderPulse(payload: NonNullable<OperationsDeckBridgePayload["pulse"]>): boolean {
  const line = byId<HTMLElement>("tasksPulseLine");
  const hint = byId<HTMLElement>("tasksPulseHint");
  if (!line || !hint) {
    return false;
  }
  line.textContent = safeText(payload.lineText, "Progress pulse bekleniyor.");
  hint.textContent = safeText(payload.hintText, "Economy signal bekleniyor.");
  (Array.isArray(payload.chips) ? payload.chips : []).forEach((chip) => {
    const node = byId<HTMLElement>(safeText(chip.id));
    if (!node) {
      return;
    }
    const tone = safeText(chip.tone, "neutral").toLowerCase();
    node.textContent = safeText(chip.text, "--");
    node.className = "combatAlertChip";
    node.classList.add(tone || "neutral");
    node.style.setProperty("--chip-level", Math.max(0, Math.min(1, asNum(chip.level || 0))).toFixed(3));
  });
  return true;
}

function setPanelTone(id: string, tone: unknown): void {
  const node = byId<HTMLElement>(id);
  if (!node) {
    return;
  }
  node.dataset.tone = safeText(tone, "neutral").toLowerCase();
}

function setChipTone(id: string, tone: unknown): void {
  const node = byId<HTMLElement>(id);
  if (!node) {
    return;
  }
  const nextTone = safeText(tone, "neutral").toLowerCase();
  node.classList.remove("neutral", "info", "safe", "advantage", "balanced", "pressure", "aggressive", "critical");
  node.classList.add(nextTone || "neutral");
}

function setNodeText(id: string, value: unknown, fallback: string): void {
  const node = byId<HTMLElement>(id);
  if (!node) {
    return;
  }
  node.textContent = safeText(value, fallback);
}

function renderLoopFamily(prefix: string, payload: LoopFamilyPanel): void {
  setPanelTone(`${prefix}Panel`, payload.tone);
  setNodeText(prefix, payload.text, "WAIT");
  renderLoopBridgeCards(byId<HTMLElement>(`${prefix}Cards`), payload.cards);
  renderLoopBridgeBlocks(byId<HTMLElement>(`${prefix}Blocks`), payload.blocks);
  setNodeText(`${prefix}Family`, payload.familyText, "FLOW --");
  setNodeText(`${prefix}Flow`, payload.flowText, "ENTRY --");
  setNodeText(`${prefix}Summary`, payload.summaryText, "SUMMARY --");
  setNodeText(`${prefix}Gate`, payload.gateText, "GATE --");
  setNodeText(`${prefix}Lead`, payload.leadText, "LEAD --");
  setNodeText(`${prefix}Window`, payload.windowText, "WINDOW --");
  setNodeText(`${prefix}Pressure`, payload.pressureText, "PRESSURE --");
  setNodeText(`${prefix}Response`, payload.responseText, "RESPONSE --");
  setNodeText(`${prefix}Focus`, payload.focusText, "FOCUS WAIT");
  setNodeText(`${prefix}Stage`, payload.stageText, "STAGE --");
  setNodeText(`${prefix}State`, payload.stateText, "STATE --");
  setNodeText(`${prefix}Ops`, payload.opsText, "OPS --");
  setNodeText(`${prefix}Signal`, payload.signalText, "SIGNAL --");
  setNodeText(`${prefix}Detail`, payload.detailText, "Detay bekleniyor.");
  setNodeText(`${prefix}Attention`, payload.attentionText, "ATTN --");
  setNodeText(`${prefix}Cadence`, payload.cadenceText, "CADENCE --");
  setChipTone(`${prefix}Family`, resolveLoopRailTone(payload.tone, "family"));
  setChipTone(`${prefix}Flow`, resolveLoopRailTone(payload.tone, "flow"));
  setChipTone(`${prefix}Summary`, resolveLoopRailTone(payload.tone, "summary"));
  setChipTone(`${prefix}Gate`, resolveLoopRailTone(payload.tone, "gate"));
  setChipTone(`${prefix}Lead`, resolveLoopRailTone(payload.tone, "lead"));
  setChipTone(`${prefix}Window`, resolveLoopRailTone(payload.tone, "window"));
  setChipTone(`${prefix}Pressure`, resolveLoopRailTone(payload.tone, "pressure"));
  setChipTone(`${prefix}Response`, resolveLoopRailTone(payload.tone, "response"));
  setChipTone(`${prefix}Attention`, resolveLoopRailTone(payload.tone, "attention"));
  setChipTone(`${prefix}Cadence`, resolveLoopRailTone(payload.tone, "cadence"));
}

function readLoopFamily(payload: LoopPayload, familyKey: string): LoopFamilyPanel {
  const source = payload as Record<string, unknown>;
  const title = familyKey.charAt(0).toUpperCase() + familyKey.slice(1);
  return {
    text: safeText(source[`${familyKey}Text`], `${title.toUpperCase()} | WAIT`),
    tone: safeText(source[`${familyKey}Tone`], "neutral"),
    cards: Array.isArray(source[`${familyKey}Cards`]) ? (source[`${familyKey}Cards`] as LoopBridgeCard[]) : undefined,
    blocks: Array.isArray(source[`${familyKey}Blocks`]) ? (source[`${familyKey}Blocks`] as LoopBridgeBlock[]) : undefined,
    familyText: safeText(source[`${familyKey}FamilyText`], "FLOW --"),
    flowText: safeText(source[`${familyKey}FlowText`], "ENTRY --"),
    summaryText: safeText(source[`${familyKey}SummaryText`], "SUMMARY --"),
    gateText: safeText(source[`${familyKey}GateText`], "GATE --"),
    leadText: safeText(source[`${familyKey}LeadText`], "LEAD --"),
    windowText: safeText(source[`${familyKey}WindowText`], "WINDOW --"),
    pressureText: safeText(source[`${familyKey}PressureText`], "PRESSURE --"),
    responseText: safeText(source[`${familyKey}ResponseText`], "RESPONSE --"),
    focusText: safeText(source[`${familyKey}FocusText`], "FOCUS WAIT"),
    stageText: safeText(source[`${familyKey}StageText`], "STAGE --"),
    stateText: safeText(source[`${familyKey}StateText`], "STATE --"),
    opsText: safeText(source[`${familyKey}OpsText`], "OPS --"),
    signalText: safeText(source[`${familyKey}SignalText`], "SIGNAL --"),
    detailText: safeText(source[`${familyKey}DetailText`], "Detay bekleniyor."),
    attentionText: safeText(source[`${familyKey}AttentionText`], "ATTN --"),
    cadenceText: safeText(source[`${familyKey}CadenceText`], "CADENCE --")
  };
}

function renderLoop(payload: NonNullable<OperationsDeckBridgePayload["loop"]>): boolean {
  const line = byId<HTMLElement>("tasksLoopLine");
  const hint = byId<HTMLElement>("tasksLoopHint");
  const focus = byId<HTMLElement>("tasksLoopFocus");
  const ops = byId<HTMLElement>("tasksLoopOps");
  const status = byId<HTMLElement>("tasksLoopStatus");
  const detail = byId<HTMLElement>("tasksLoopDetail");
  const signal = byId<HTMLElement>("tasksLoopSignal");
  const sequence = byId<HTMLElement>("tasksLoopSequence");
  const lootFlowCards = byId<HTMLElement>("tasksLoopLootFlowCards");
  const lootFlowBlocks = byId<HTMLElement>("tasksLoopLootFlowBlocks");
  const lootFlowPanels = byId<HTMLElement>("tasksLoopLootFlowPanels");
  if (!line || !hint || !focus || !ops || !status || !detail || !signal || !sequence) {
    return false;
  }
  line.textContent = safeText(payload.lineText, "TASK STANDBY | WAIT");
  hint.textContent = safeText(payload.hintText, "Scene loop focus bekleniyor.");
  focus.textContent = safeText(payload.focusText, "FLOW | WAIT");
  ops.textContent = safeText(payload.opsText, "WAIT | FLOW IDLE");
  status.textContent = safeText(payload.statusText, "IDLE | FLOW WAIT");
  detail.textContent = safeText(payload.detailText, "Loop detay bekleniyor.");
  signal.textContent = safeText(payload.signalText, "Signal detay bekleniyor.");
  sequence.textContent = safeText(payload.sequenceText, "Sequence detay bekleniyor.");
  renderLoopFamily("tasksLoopOffer", readLoopFamily(payload, "offer"));
  renderLoopFamily("tasksLoopClaim", readLoopFamily(payload, "claim"));
  renderLoopFamily("tasksLoopStreak", readLoopFamily(payload, "streak"));
  renderLoopFamily("tasksLoopLoot", readLoopFamily(payload, "loot"));
  renderLoopBridgeCards(lootFlowCards, Array.isArray(payload.lootFlowCards) ? (payload.lootFlowCards as LoopBridgeCard[]) : undefined);
  renderLoopBridgeBlocks(lootFlowBlocks, Array.isArray(payload.lootFlowBlocks) ? (payload.lootFlowBlocks as LoopBridgeBlock[]) : undefined);
  renderLoopBridgePanels(lootFlowPanels, Array.isArray(payload.lootFlowPanels) ? (payload.lootFlowPanels as LoopBridgePanel[]) : undefined);
  return true;
}

function render(payload: OperationsDeckBridgePayload): boolean {
  let handled = false;
  if (payload?.offers) {
    handled = renderOffers(payload.offers) || handled;
  }
  if (payload?.missions) {
    handled = renderMissions(payload.missions) || handled;
  }
  if (payload?.attempts) {
    handled = renderAttempts(payload.attempts) || handled;
  }
  if (payload?.events) {
    handled = renderEvents(payload.events) || handled;
  }
  if (payload?.pulse) {
    handled = renderPulse(payload.pulse) || handled;
  }
  if (payload?.loop) {
    handled = renderLoop(payload.loop) || handled;
  }
  return handled;
}

export function installOperationsDeckBridge(): void {
  window.__AKR_OPERATIONS_DECK__ = { render };
}
