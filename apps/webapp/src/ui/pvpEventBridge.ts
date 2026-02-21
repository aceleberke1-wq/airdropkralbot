export type PvpEventTimelineRow = {
  tone: string;
  label: string;
  metaText: string;
  isLatest?: boolean;
};

export type PvpEventReplayRow = {
  tone: string;
  text: string;
  isLatest?: boolean;
};

export type PvpEventBridgePayload = {
  timelineRows: PvpEventTimelineRow[];
  replayRows: PvpEventReplayRow[];
  timelineLimit: number;
  replayLimit: number;
  reducedMotion: boolean;
};

export type PvpEventBridge = {
  render: (payload: PvpEventBridgePayload) => boolean;
};

declare global {
  interface Window {
    __AKR_PVP_EVENTS__?: PvpEventBridge;
  }
}

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function clearChildren(node: HTMLElement): void {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function markEnter(node: HTMLElement, reducedMotion: boolean): void {
  if (reducedMotion) {
    return;
  }
  node.classList.add("enter");
  setTimeout(() => {
    node.classList.remove("enter");
  }, 280);
}

function render(payload: PvpEventBridgePayload): boolean {
  const timelineHost = byId<HTMLElement>("pvpTimelineList");
  const timelineBadge = byId<HTMLElement>("pvpTimelineBadge");
  const replayHost = byId<HTMLElement>("pvpReplayStrip");
  if (!timelineHost || !replayHost) {
    return false;
  }

  clearChildren(timelineHost);
  const timelineRows = Array.isArray(payload.timelineRows)
    ? payload.timelineRows.slice(0, Math.max(1, Number(payload.timelineLimit || 15)))
    : [];
  if (!timelineRows.length) {
    const empty = document.createElement("li");
    empty.className = "muted";
    empty.textContent = "Timeline bekleniyor";
    timelineHost.appendChild(empty);
    if (timelineBadge) {
      timelineBadge.textContent = "0 event";
      timelineBadge.className = "badge info";
    }
  } else {
    timelineRows.forEach((row, index) => {
      const item = document.createElement("li");
      const tone = String(row.tone || "tick").toLowerCase();
      item.className = `pvpTimelineRow ${tone}`;

      const title = document.createElement("strong");
      title.textContent = String(row.label || "Event");

      const meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = String(row.metaText || "-");

      item.appendChild(title);
      item.appendChild(meta);
      timelineHost.appendChild(item);

      if (index === 0 || row.isLatest) {
        markEnter(item, Boolean(payload.reducedMotion));
      }
    });

    if (timelineBadge) {
      const latestTone = String(timelineRows[0]?.tone || "").toLowerCase();
      timelineBadge.textContent = `${timelineRows.length} event`;
      timelineBadge.className = latestTone === "reject" ? "badge warn" : "badge info";
    }
  }

  clearChildren(replayHost);
  const replayRows = Array.isArray(payload.replayRows)
    ? payload.replayRows.slice(0, Math.max(1, Number(payload.replayLimit || 12)))
    : [];
  if (!replayRows.length) {
    const empty = document.createElement("span");
    empty.className = "replayChip muted";
    empty.textContent = "Replay bos";
    replayHost.appendChild(empty);
  } else {
    replayRows.forEach((row, index) => {
      const chip = document.createElement("span");
      chip.className = `replayChip ${String(row.tone || "guard").toLowerCase()}`;
      chip.textContent = String(row.text || "ACTION");
      replayHost.appendChild(chip);
      if (index === 0 || row.isLatest) {
        markEnter(chip, Boolean(payload.reducedMotion));
      }
    });
  }

  return true;
}

export function installPvpEventBridge(): void {
  window.__AKR_PVP_EVENTS__ = {
    render
  };
}
