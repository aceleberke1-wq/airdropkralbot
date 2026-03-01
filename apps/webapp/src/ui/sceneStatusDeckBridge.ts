type SceneDeckTone = "neutral" | "safe" | "balanced" | "pressure" | "critical";

type SceneDeckChipPayload = {
  id: string;
  text: string;
  tone?: SceneDeckTone;
  level?: number;
};

type SceneLiteBadgePayload = {
  shouldShow: boolean;
  text: string;
  tone?: "info" | "warn";
  mode?: string;
  title?: string;
};

export type SceneStatusDeckBridgePayload = {
  chips: SceneDeckChipPayload[];
  profileLine?: string;
  liteBadge?: SceneLiteBadgePayload;
};

type SceneStatusDeckBridge = {
  render: (payload: SceneStatusDeckBridgePayload) => boolean;
};

declare global {
  interface Window {
    __AKR_SCENE_STATUS_DECK__?: SceneStatusDeckBridge;
  }
}

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function asNum(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function setChipTone(node: HTMLElement, tone: SceneDeckTone): void {
  node.classList.remove("tone-neutral", "tone-safe", "tone-balanced", "tone-pressure", "tone-critical");
  node.classList.add(`tone-${tone}`);
}

function renderChip(chip: SceneDeckChipPayload): void {
  const node = byId<HTMLElement>(chip.id);
  if (!node) {
    return;
  }
  node.textContent = String(chip.text || "-");
  setChipTone(node, String(chip.tone || "neutral") as SceneDeckTone);
  node.style.setProperty("--chip-level", clamp(asNum(chip.level ?? 0.2), 0, 1).toFixed(3));
}

function renderLiteBadge(payload: SceneLiteBadgePayload | undefined): void {
  const node = byId<HTMLElement>("liteSceneBadge");
  if (!node) {
    return;
  }
  if (!payload || !payload.shouldShow) {
    node.classList.add("hidden");
    return;
  }
  node.classList.remove("hidden", "warn", "info");
  node.classList.add(payload.tone === "warn" ? "warn" : "info");
  node.dataset.mode = String(payload.mode || "ok");
  node.textContent = String(payload.text || "Lite Scene");
  node.title = String(payload.title || "");
}

function render(payload: SceneStatusDeckBridgePayload): boolean {
  const deck = byId<HTMLElement>("sceneStatusDeck");
  if (!deck || !payload || !Array.isArray(payload.chips)) {
    return false;
  }
  payload.chips.forEach(renderChip);
  const profileLineNode = byId<HTMLElement>("sceneProfileLine");
  if (profileLineNode && payload.profileLine) {
    profileLineNode.textContent = String(payload.profileLine);
  }
  renderLiteBadge(payload.liteBadge);
  return true;
}

export function installSceneStatusDeckBridge(): void {
  window.__AKR_SCENE_STATUS_DECK__ = { render };
}

