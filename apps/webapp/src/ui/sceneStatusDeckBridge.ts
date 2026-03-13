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
  loopLine?: string;
  liteBadge?: SceneLiteBadgePayload;
  actionContextSignature?: string;
  riskContextSignature?: string;
  focusKey?: string;
  riskKey?: string;
  riskFocusKey?: string;
  familyKey?: string;
  flowKey?: string;
  microflowKey?: string;
  entryKindKey?: string;
  sequenceKindKey?: string;
  riskHealthBandKey?: string;
  riskAttentionBandKey?: string;
  riskTrendDirectionKey?: string;
  actionContext?: {
    family_key?: string;
    flow_key?: string;
    microflow_key?: string;
    focus_key?: string;
    risk_key?: string;
    risk_focus_key?: string;
    action_context_signature?: string;
    risk_health_band_key?: string;
    risk_attention_band_key?: string;
    risk_trend_direction_key?: string;
    entry_kind_key?: string;
    sequence_kind_key?: string;
  } | null;
  loopContext?: {
    family_key?: string;
    flow_key?: string;
    microflow_key?: string;
    focus_key?: string;
    risk_key?: string;
    risk_focus_key?: string;
    risk_context_signature?: string;
    risk_health_band_key?: string;
    risk_attention_band_key?: string;
    risk_trend_direction_key?: string;
    entry_kind_key?: string;
    sequence_kind_key?: string;
  } | null;
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
  const loopContext = payload.loopContext || {};
  const actionContext = payload.actionContext || {};
  const actionContextSignature = String(
    payload.actionContextSignature || actionContext.action_context_signature || ""
  ).trim();
  const riskContextSignature = String(payload.riskContextSignature || loopContext.risk_context_signature || "").trim();
  const focusKey = String(payload.focusKey || actionContext.focus_key || loopContext.focus_key || "").trim();
  const riskKey = String(payload.riskKey || actionContext.risk_key || loopContext.risk_key || "").trim();
  const riskFocusKey = String(payload.riskFocusKey || actionContext.risk_focus_key || loopContext.risk_focus_key || "").trim();
  const familyKey = String(payload.familyKey || actionContext.family_key || loopContext.family_key || "").trim();
  const flowKey = String(payload.flowKey || actionContext.flow_key || loopContext.flow_key || "").trim();
  const microflowKey = String(payload.microflowKey || actionContext.microflow_key || loopContext.microflow_key || "").trim();
  const entryKindKey = String(payload.entryKindKey || actionContext.entry_kind_key || loopContext.entry_kind_key || "").trim();
  const sequenceKindKey = String(payload.sequenceKindKey || actionContext.sequence_kind_key || loopContext.sequence_kind_key || "").trim();
  const riskHealthBandKey = String(
    payload.riskHealthBandKey || actionContext.risk_health_band_key || loopContext.risk_health_band_key || ""
  ).trim();
  const riskAttentionBandKey = String(
    payload.riskAttentionBandKey || actionContext.risk_attention_band_key || loopContext.risk_attention_band_key || ""
  ).trim();
  const riskTrendDirectionKey = String(
    payload.riskTrendDirectionKey || actionContext.risk_trend_direction_key || loopContext.risk_trend_direction_key || ""
  ).trim();

  deck.dataset.actionContextSignature = actionContextSignature;
  deck.dataset.riskContextSignature = riskContextSignature;
  deck.dataset.focusKey = focusKey;
  deck.dataset.riskKey = riskKey;
  deck.dataset.riskFocusKey = riskFocusKey;
  deck.dataset.familyKey = familyKey;
  deck.dataset.flowKey = flowKey;
  deck.dataset.microflowKey = microflowKey;
  deck.dataset.entryKindKey = entryKindKey;
  deck.dataset.sequenceKindKey = sequenceKindKey;
  deck.dataset.riskHealthBandKey = riskHealthBandKey;
  deck.dataset.riskAttentionBandKey = riskAttentionBandKey;
  deck.dataset.riskTrendDirectionKey = riskTrendDirectionKey;
  payload.chips.forEach(renderChip);
  const profileLineNode = byId<HTMLElement>("sceneProfileLine");
  if (profileLineNode && payload.profileLine) {
    profileLineNode.textContent = String(payload.profileLine);
  }
  const loopLineNode = byId<HTMLElement>("sceneLoopLine");
  if (loopLineNode) {
    loopLineNode.textContent = String(payload.loopLine || "Loop state bekleniyor.");
    loopLineNode.dataset.actionContextSignature = actionContextSignature;
    loopLineNode.dataset.riskContextSignature = riskContextSignature;
    loopLineNode.dataset.focusKey = focusKey;
    loopLineNode.dataset.riskKey = riskKey;
    loopLineNode.dataset.riskFocusKey = riskFocusKey;
    loopLineNode.dataset.familyKey = familyKey;
    loopLineNode.dataset.flowKey = flowKey;
    loopLineNode.dataset.microflowKey = microflowKey;
    loopLineNode.dataset.entryKindKey = entryKindKey;
    loopLineNode.dataset.sequenceKindKey = sequenceKindKey;
    loopLineNode.dataset.riskHealthBandKey = riskHealthBandKey;
    loopLineNode.dataset.riskAttentionBandKey = riskAttentionBandKey;
    loopLineNode.dataset.riskTrendDirectionKey = riskTrendDirectionKey;
    const titleParts = [];
    if (actionContextSignature) {
      titleParts.push(`ACS ${actionContextSignature}`);
    }
    if (riskContextSignature) {
      titleParts.push(`RCS ${riskContextSignature}`);
    }
    loopLineNode.title = titleParts.join(" | ");
  }
  renderLiteBadge(payload.liteBadge);
  return true;
}

export function installSceneStatusDeckBridge(): void {
  window.__AKR_SCENE_STATUS_DECK__ = { render };
}
