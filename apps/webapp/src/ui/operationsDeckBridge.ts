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
  return handled;
}

export function installOperationsDeckBridge(): void {
  window.__AKR_OPERATIONS_DECK__ = { render };
}
