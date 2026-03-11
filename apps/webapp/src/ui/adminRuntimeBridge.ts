import { resolveLoopRailTone } from "../core/runtime/loopRailTone.js";
import { renderLoopBridgeBlocks, renderLoopBridgeCards, renderLoopBridgePanels, type LoopBridgeBlock, type LoopBridgeCard, type LoopBridgePanel } from "./loopBridgeCards.js";

type RuntimeBridgePayload = {
  lineText: string;
  eventsLineText: string;
  loopLineText?: string;
  loopHintText?: string;
  loopFocusText?: string;
  loopOpsLineText?: string;
  loopOpsHintText?: string;
  loopSequenceText?: string;
  loopStateText?: string;
  loopDetailText?: string;
  loopSignalText?: string;
  loopQueueText?: string;
  loopRuntimeText?: string;
  loopDispatchText?: string;
  loopQueueTone?: string;
  loopRuntimeTone?: string;
  loopDispatchTone?: string;
  loopQueueFocusText?: string;
  loopRuntimeFocusText?: string;
  loopDispatchFocusText?: string;
  loopQueueStageText?: string;
  loopRuntimeStageText?: string;
  loopDispatchStageText?: string;
  loopQueueOpsText?: string;
  loopRuntimeOpsText?: string;
  loopDispatchOpsText?: string;
  loopQueueStateText?: string;
  loopRuntimeStateText?: string;
  loopDispatchStateText?: string;
  loopQueueSignalText?: string;
  loopRuntimeSignalText?: string;
  loopDispatchSignalText?: string;
  loopQueueDetailText?: string;
  loopRuntimeDetailText?: string;
  loopDispatchDetailText?: string;
  loopQueueFamilyText?: string;
  loopQueueFlowText?: string;
  loopQueueSummaryText?: string;
  loopQueueGateText?: string;
  loopQueueLeadText?: string;
  loopQueueWindowText?: string;
  loopQueuePressureText?: string;
  loopQueueResponseText?: string;
  loopQueueAttentionText?: string;
  loopQueueCadenceText?: string;
  loopQueueCards?: LoopBridgeCard[];
  loopQueueBlocks?: LoopBridgeBlock[];
  loopQueueFlowCards?: LoopBridgeCard[];
  loopQueueFlowBlocks?: LoopBridgeBlock[];
  loopQueueFlowPanels?: LoopBridgePanel[];
  loopRuntimeFamilyText?: string;
  loopRuntimeFlowText?: string;
  loopRuntimeSummaryText?: string;
  loopRuntimeGateText?: string;
  loopRuntimeLeadText?: string;
  loopRuntimeWindowText?: string;
  loopRuntimePressureText?: string;
  loopRuntimeResponseText?: string;
  loopRuntimeAttentionText?: string;
  loopRuntimeCadenceText?: string;
  loopRuntimeCards?: LoopBridgeCard[];
  loopRuntimeBlocks?: LoopBridgeBlock[];
  loopRuntimeFlowCards?: LoopBridgeCard[];
  loopRuntimeFlowBlocks?: LoopBridgeBlock[];
  loopRuntimeFlowPanels?: LoopBridgePanel[];
  loopDispatchFamilyText?: string;
  loopDispatchFlowText?: string;
  loopDispatchSummaryText?: string;
  loopDispatchGateText?: string;
  loopDispatchLeadText?: string;
  loopDispatchWindowText?: string;
  loopDispatchPressureText?: string;
  loopDispatchResponseText?: string;
  loopDispatchAttentionText?: string;
  loopDispatchCadenceText?: string;
  loopDispatchCards?: LoopBridgeCard[];
  loopDispatchBlocks?: LoopBridgeBlock[];
  loopDispatchFlowCards?: LoopBridgeCard[];
  loopDispatchFlowBlocks?: LoopBridgeBlock[];
  loopDispatchFlowPanels?: LoopBridgePanel[];
};

type AdminRuntimeBridge = {
  render: (payload: RuntimeBridgePayload) => boolean;
};

declare global {
  interface Window {
    __AKR_ADMIN_RUNTIME__?: AdminRuntimeBridge;
  }
}

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function pulseOnce(node: HTMLElement | null, className = "enter"): void {
  if (!node) {
    return;
  }
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
  const anyNode = node as any;
  const key = `_${className}Timer`;
  if (anyNode[key]) {
    clearTimeout(anyNode[key]);
  }
  anyNode[key] = setTimeout(() => {
    node.classList.remove(className);
    anyNode[key] = null;
  }, 280);
}

function setTone(node: HTMLElement | null, tone: unknown): void {
  if (!node) {
    return;
  }
  node.dataset.tone = String(tone || "neutral").toLowerCase() || "neutral";
}

function setChipTone(node: HTMLElement | null, tone: unknown): void {
  if (!node) {
    return;
  }
  const nextTone = String(tone || "neutral").toLowerCase() || "neutral";
  node.classList.remove("neutral", "info", "safe", "advantage", "balanced", "pressure", "aggressive", "critical");
  node.classList.add(nextTone);
}

function render(payload: RuntimeBridgePayload): boolean {
  const line = byId<HTMLElement>("adminRuntimeLine");
  const eventsLine = byId<HTMLElement>("adminRuntimeEvents");
  const loopLine = byId<HTMLElement>("adminRuntimeLoopLine");
  const loopHint = byId<HTMLElement>("adminRuntimeLoopHint");
  const loopFocus = byId<HTMLElement>("adminRuntimeLoopFocus");
  const loopOpsLine = byId<HTMLElement>("adminRuntimeLoopOpsLine");
  const loopOpsHint = byId<HTMLElement>("adminRuntimeLoopOpsHint");
  const loopSequence = byId<HTMLElement>("adminRuntimeLoopSequence");
  const loopState = byId<HTMLElement>("adminRuntimeLoopState");
  const loopDetail = byId<HTMLElement>("adminRuntimeLoopDetail");
  const loopSignal = byId<HTMLElement>("adminRuntimeLoopSignal");
  const loopQueue = byId<HTMLElement>("adminRuntimeLoopQueue");
  const loopQueuePanel = byId<HTMLElement>("adminRuntimeLoopQueuePanel");
  const loopQueueCards = byId<HTMLElement>("adminRuntimeLoopQueueCards");
  const loopQueueBlocks = byId<HTMLElement>("adminRuntimeLoopQueueBlocks");
  const loopQueueFlowCards = byId<HTMLElement>("adminRuntimeLoopQueueFlowCards");
  const loopQueueFlowBlocks = byId<HTMLElement>("adminRuntimeLoopQueueFlowBlocks");
  const loopQueueFlowPanels = byId<HTMLElement>("adminRuntimeLoopQueueFlowPanels");
  const loopQueueFocus = byId<HTMLElement>("adminRuntimeLoopQueueFocus");
  const loopQueueStage = byId<HTMLElement>("adminRuntimeLoopQueueStage");
  const loopRuntime = byId<HTMLElement>("adminRuntimeLoopRuntime");
  const loopRuntimePanel = byId<HTMLElement>("adminRuntimeLoopRuntimePanel");
  const loopRuntimeCards = byId<HTMLElement>("adminRuntimeLoopRuntimeCards");
  const loopRuntimeBlocks = byId<HTMLElement>("adminRuntimeLoopRuntimeBlocks");
  const loopRuntimeFlowCards = byId<HTMLElement>("adminRuntimeLoopRuntimeFlowCards");
  const loopRuntimeFlowBlocks = byId<HTMLElement>("adminRuntimeLoopRuntimeFlowBlocks");
  const loopRuntimeFlowPanels = byId<HTMLElement>("adminRuntimeLoopRuntimeFlowPanels");
  const loopRuntimeFocus = byId<HTMLElement>("adminRuntimeLoopRuntimeFocus");
  const loopRuntimeStage = byId<HTMLElement>("adminRuntimeLoopRuntimeStage");
  const loopDispatch = byId<HTMLElement>("adminRuntimeLoopDispatch");
  const loopDispatchPanel = byId<HTMLElement>("adminRuntimeLoopDispatchPanel");
  const loopDispatchCards = byId<HTMLElement>("adminRuntimeLoopDispatchCards");
  const loopDispatchBlocks = byId<HTMLElement>("adminRuntimeLoopDispatchBlocks");
  const loopDispatchFlowCards = byId<HTMLElement>("adminRuntimeLoopDispatchFlowCards");
  const loopDispatchFlowBlocks = byId<HTMLElement>("adminRuntimeLoopDispatchFlowBlocks");
  const loopDispatchFlowPanels = byId<HTMLElement>("adminRuntimeLoopDispatchFlowPanels");
  const loopDispatchFocus = byId<HTMLElement>("adminRuntimeLoopDispatchFocus");
  const loopDispatchStage = byId<HTMLElement>("adminRuntimeLoopDispatchStage");
  const loopQueueState = byId<HTMLElement>("adminRuntimeLoopQueueState");
  const loopRuntimeState = byId<HTMLElement>("adminRuntimeLoopRuntimeState");
  const loopDispatchState = byId<HTMLElement>("adminRuntimeLoopDispatchState");
  const loopQueueOps = byId<HTMLElement>("adminRuntimeLoopQueueOps");
  const loopRuntimeOps = byId<HTMLElement>("adminRuntimeLoopRuntimeOps");
  const loopDispatchOps = byId<HTMLElement>("adminRuntimeLoopDispatchOps");
  const loopQueueSignal = byId<HTMLElement>("adminRuntimeLoopQueueSignal");
  const loopRuntimeSignal = byId<HTMLElement>("adminRuntimeLoopRuntimeSignal");
  const loopDispatchSignal = byId<HTMLElement>("adminRuntimeLoopDispatchSignal");
  const loopQueueDetail = byId<HTMLElement>("adminRuntimeLoopQueueDetail");
  const loopRuntimeDetail = byId<HTMLElement>("adminRuntimeLoopRuntimeDetail");
  const loopDispatchDetail = byId<HTMLElement>("adminRuntimeLoopDispatchDetail");
  const loopQueueFamily = byId<HTMLElement>("adminRuntimeLoopQueueFamily");
  const loopQueueFlow = byId<HTMLElement>("adminRuntimeLoopQueueFlow");
  const loopQueueSummary = byId<HTMLElement>("adminRuntimeLoopQueueSummary");
  const loopQueueGate = byId<HTMLElement>("adminRuntimeLoopQueueGate");
  const loopQueueLead = byId<HTMLElement>("adminRuntimeLoopQueueLead");
  const loopQueueWindow = byId<HTMLElement>("adminRuntimeLoopQueueWindow");
  const loopQueuePressure = byId<HTMLElement>("adminRuntimeLoopQueuePressure");
  const loopQueueResponse = byId<HTMLElement>("adminRuntimeLoopQueueResponse");
  const loopQueueAttention = byId<HTMLElement>("adminRuntimeLoopQueueAttention");
  const loopQueueCadence = byId<HTMLElement>("adminRuntimeLoopQueueCadence");
  const loopRuntimeFamily = byId<HTMLElement>("adminRuntimeLoopRuntimeFamily");
  const loopRuntimeFlow = byId<HTMLElement>("adminRuntimeLoopRuntimeFlow");
  const loopRuntimeSummary = byId<HTMLElement>("adminRuntimeLoopRuntimeSummary");
  const loopRuntimeGate = byId<HTMLElement>("adminRuntimeLoopRuntimeGate");
  const loopRuntimeLead = byId<HTMLElement>("adminRuntimeLoopRuntimeLead");
  const loopRuntimeWindow = byId<HTMLElement>("adminRuntimeLoopRuntimeWindow");
  const loopRuntimePressure = byId<HTMLElement>("adminRuntimeLoopRuntimePressure");
  const loopRuntimeResponse = byId<HTMLElement>("adminRuntimeLoopRuntimeResponse");
  const loopRuntimeAttention = byId<HTMLElement>("adminRuntimeLoopRuntimeAttention");
  const loopRuntimeCadence = byId<HTMLElement>("adminRuntimeLoopRuntimeCadence");
  const loopDispatchFamily = byId<HTMLElement>("adminRuntimeLoopDispatchFamily");
  const loopDispatchFlow = byId<HTMLElement>("adminRuntimeLoopDispatchFlow");
  const loopDispatchSummary = byId<HTMLElement>("adminRuntimeLoopDispatchSummary");
  const loopDispatchGate = byId<HTMLElement>("adminRuntimeLoopDispatchGate");
  const loopDispatchLead = byId<HTMLElement>("adminRuntimeLoopDispatchLead");
  const loopDispatchWindow = byId<HTMLElement>("adminRuntimeLoopDispatchWindow");
  const loopDispatchPressure = byId<HTMLElement>("adminRuntimeLoopDispatchPressure");
  const loopDispatchResponse = byId<HTMLElement>("adminRuntimeLoopDispatchResponse");
  const loopDispatchAttention = byId<HTMLElement>("adminRuntimeLoopDispatchAttention");
  const loopDispatchCadence = byId<HTMLElement>("adminRuntimeLoopDispatchCadence");
  if (!line || !eventsLine || !loopLine || !loopHint || !loopFocus || !loopOpsLine || !loopOpsHint || !loopSequence || !loopState || !loopDetail || !loopSignal) {
    return false;
  }
  line.textContent = String(payload.lineText || "Bot Runtime: -");
  eventsLine.textContent = String(payload.eventsLineText || "Runtime events: kayit yok");
  loopLine.textContent = String(payload.loopLineText || "OPS LOOP | WAIT");
  loopHint.textContent = String(payload.loopHintText || "Scene loop focus bekleniyor.");
  loopFocus.textContent = String(payload.loopFocusText || "FLOW | WAIT");
  loopOpsLine.textContent = String(payload.loopOpsLineText || "WAIT | FLOW IDLE");
  loopOpsHint.textContent = String(payload.loopOpsHintText || "District flow aktif degil.");
  loopSequence.textContent = String(payload.loopSequenceText || "Sequence detay bekleniyor.");
  loopState.textContent = String(payload.loopStateText || "IDLE | FLOW WAIT");
  loopDetail.textContent = String(payload.loopDetailText || "Loop detay bekleniyor.");
  loopSignal.textContent = String(payload.loopSignalText || "Signal detay bekleniyor.");
  if (loopQueue) {
    loopQueue.textContent = String(payload.loopQueueText || "QUEUE | WAIT");
  }
  setTone(loopQueuePanel, payload.loopQueueTone);
  renderLoopBridgeCards(loopQueueCards, payload.loopQueueCards);
  renderLoopBridgeBlocks(loopQueueBlocks, payload.loopQueueBlocks);
  renderLoopBridgeCards(loopQueueFlowCards, payload.loopQueueFlowCards);
  renderLoopBridgeBlocks(loopQueueFlowBlocks, payload.loopQueueFlowBlocks);
  renderLoopBridgePanels(loopQueueFlowPanels, payload.loopQueueFlowPanels);
  if (loopQueueFocus) {
    loopQueueFocus.textContent = String(payload.loopQueueFocusText || "ENTRY WAIT | FOCUS WAIT | FLOW WAIT");
  }
  if (loopQueueStage) {
    loopQueueStage.textContent = String(payload.loopQueueStageText || "STAGE -- | STATUS -- | ENTRY WAIT");
  }
  if (loopRuntime) {
    loopRuntime.textContent = String(payload.loopRuntimeText || "RUNTIME | WAIT");
  }
  setTone(loopRuntimePanel, payload.loopRuntimeTone);
  renderLoopBridgeCards(loopRuntimeCards, payload.loopRuntimeCards);
  renderLoopBridgeBlocks(loopRuntimeBlocks, payload.loopRuntimeBlocks);
  renderLoopBridgeCards(loopRuntimeFlowCards, payload.loopRuntimeFlowCards);
  renderLoopBridgeBlocks(loopRuntimeFlowBlocks, payload.loopRuntimeFlowBlocks);
  renderLoopBridgePanels(loopRuntimeFlowPanels, payload.loopRuntimeFlowPanels);
  if (loopRuntimeFocus) {
    loopRuntimeFocus.textContent = String(payload.loopRuntimeFocusText || "SEQ WAIT | FOCUS WAIT | ALERT --");
  }
  if (loopRuntimeStage) {
    loopRuntimeStage.textContent = String(payload.loopRuntimeStageText || "STAGE -- | STATUS -- | SEQ WAIT");
  }
  if (loopDispatch) {
    loopDispatch.textContent = String(payload.loopDispatchText || "DISPATCH | WAIT");
  }
  setTone(loopDispatchPanel, payload.loopDispatchTone);
  if (loopDispatchFocus) {
    loopDispatchFocus.textContent = String(payload.loopDispatchFocusText || "ENTRY WAIT | FOCUS WAIT | STAGE --");
  }
  if (loopDispatchStage) {
    loopDispatchStage.textContent = String(payload.loopDispatchStageText || "STAGE -- | STATUS -- | SENT --");
  }
  if (loopQueueState) {
    loopQueueState.textContent = String(payload.loopQueueStateText || "FLOW WAIT | ENTRY WAIT | QUEUE --");
  }
  if (loopRuntimeState) {
    loopRuntimeState.textContent = String(payload.loopRuntimeStateText || "FLOW WAIT | SEQ WAIT | HEALTH --");
  }
  if (loopDispatchState) {
    loopDispatchState.textContent = String(payload.loopDispatchStateText || "FLOW WAIT | STAGE -- | SENT --");
  }
  if (loopQueueOps) {
    loopQueueOps.textContent = String(payload.loopQueueOpsText || "ENTRY WAIT | QUEUE -- | FLOW WAIT");
  }
  if (loopRuntimeOps) {
    loopRuntimeOps.textContent = String(payload.loopRuntimeOpsText || "SEQ WAIT | HEALTH -- | ALERT --");
  }
  if (loopDispatchOps) {
    loopDispatchOps.textContent = String(payload.loopDispatchOpsText || "ENTRY WAIT | SENT -- | STAGE --");
  }
  if (loopQueueSignal) {
    loopQueueSignal.textContent = String(payload.loopQueueSignalText || "QUEUE -- | FLOW WAIT | ENTRY WAIT");
  }
  if (loopRuntimeSignal) {
    loopRuntimeSignal.textContent = String(payload.loopRuntimeSignalText || "HEALTH -- | ALERT -- | FLOW WAIT");
  }
  if (loopDispatchSignal) {
    loopDispatchSignal.textContent = String(payload.loopDispatchSignalText || "SENT -- | STAGE -- | FLOW WAIT");
  }
  if (loopQueueDetail) {
    loopQueueDetail.textContent = String(payload.loopQueueDetailText || "Queue action detay bekleniyor.");
  }
  if (loopQueueFamily) {
    loopQueueFamily.textContent = String(payload.loopQueueFamilyText || "FLOW --");
  }
  if (loopQueueFlow) {
    loopQueueFlow.textContent = String(payload.loopQueueFlowText || "ENTRY --");
  }
  if (loopQueueSummary) {
    loopQueueSummary.textContent = String(payload.loopQueueSummaryText || "SUMMARY --");
  }
  if (loopQueueGate) {
    loopQueueGate.textContent = String(payload.loopQueueGateText || "GATE --");
  }
  if (loopQueueLead) {
    loopQueueLead.textContent = String(payload.loopQueueLeadText || "LEAD --");
  }
  if (loopQueueWindow) {
    loopQueueWindow.textContent = String(payload.loopQueueWindowText || "WINDOW --");
  }
  if (loopQueuePressure) {
    loopQueuePressure.textContent = String(payload.loopQueuePressureText || "PRESSURE --");
  }
  if (loopQueueResponse) {
    loopQueueResponse.textContent = String(payload.loopQueueResponseText || "RESPONSE --");
  }
  if (loopQueueAttention) {
    loopQueueAttention.textContent = String(payload.loopQueueAttentionText || "ATTN --");
  }
  if (loopQueueCadence) {
    loopQueueCadence.textContent = String(payload.loopQueueCadenceText || "CADENCE --");
  }
  setChipTone(loopQueueFamily, resolveLoopRailTone(payload.loopQueueTone, "family"));
  setChipTone(loopQueueFlow, resolveLoopRailTone(payload.loopQueueTone, "flow"));
  setChipTone(loopQueueSummary, resolveLoopRailTone(payload.loopQueueTone, "summary"));
  setChipTone(loopQueueGate, resolveLoopRailTone(payload.loopQueueTone, "gate"));
  setChipTone(loopQueueLead, resolveLoopRailTone(payload.loopQueueTone, "lead"));
  setChipTone(loopQueueWindow, resolveLoopRailTone(payload.loopQueueTone, "window"));
  setChipTone(loopQueuePressure, resolveLoopRailTone(payload.loopQueueTone, "pressure"));
  setChipTone(loopQueueResponse, resolveLoopRailTone(payload.loopQueueTone, "response"));
  setChipTone(loopQueueAttention, resolveLoopRailTone(payload.loopQueueTone, "attention"));
  setChipTone(loopQueueCadence, resolveLoopRailTone(payload.loopQueueTone, "cadence"));
  if (loopRuntimeDetail) {
    loopRuntimeDetail.textContent = String(payload.loopRuntimeDetailText || "Runtime diagnostics bekleniyor.");
  }
  if (loopRuntimeFamily) {
    loopRuntimeFamily.textContent = String(payload.loopRuntimeFamilyText || "FLOW --");
  }
  if (loopRuntimeFlow) {
    loopRuntimeFlow.textContent = String(payload.loopRuntimeFlowText || "ENTRY --");
  }
  if (loopRuntimeSummary) {
    loopRuntimeSummary.textContent = String(payload.loopRuntimeSummaryText || "SUMMARY --");
  }
  if (loopRuntimeGate) {
    loopRuntimeGate.textContent = String(payload.loopRuntimeGateText || "GATE --");
  }
  if (loopRuntimeLead) {
    loopRuntimeLead.textContent = String(payload.loopRuntimeLeadText || "LEAD --");
  }
  if (loopRuntimeWindow) {
    loopRuntimeWindow.textContent = String(payload.loopRuntimeWindowText || "WINDOW --");
  }
  if (loopRuntimePressure) {
    loopRuntimePressure.textContent = String(payload.loopRuntimePressureText || "PRESSURE --");
  }
  if (loopRuntimeResponse) {
    loopRuntimeResponse.textContent = String(payload.loopRuntimeResponseText || "RESPONSE --");
  }
  if (loopRuntimeAttention) {
    loopRuntimeAttention.textContent = String(payload.loopRuntimeAttentionText || "ATTN --");
  }
  if (loopRuntimeCadence) {
    loopRuntimeCadence.textContent = String(payload.loopRuntimeCadenceText || "CADENCE --");
  }
  setChipTone(loopRuntimeFamily, resolveLoopRailTone(payload.loopRuntimeTone, "family"));
  setChipTone(loopRuntimeFlow, resolveLoopRailTone(payload.loopRuntimeTone, "flow"));
  setChipTone(loopRuntimeSummary, resolveLoopRailTone(payload.loopRuntimeTone, "summary"));
  setChipTone(loopRuntimeGate, resolveLoopRailTone(payload.loopRuntimeTone, "gate"));
  setChipTone(loopRuntimeLead, resolveLoopRailTone(payload.loopRuntimeTone, "lead"));
  setChipTone(loopRuntimeWindow, resolveLoopRailTone(payload.loopRuntimeTone, "window"));
  setChipTone(loopRuntimePressure, resolveLoopRailTone(payload.loopRuntimeTone, "pressure"));
  setChipTone(loopRuntimeResponse, resolveLoopRailTone(payload.loopRuntimeTone, "response"));
  setChipTone(loopRuntimeAttention, resolveLoopRailTone(payload.loopRuntimeTone, "attention"));
  setChipTone(loopRuntimeCadence, resolveLoopRailTone(payload.loopRuntimeTone, "cadence"));
  if (loopDispatchDetail) {
    loopDispatchDetail.textContent = String(payload.loopDispatchDetailText || "Dispatch gate detay bekleniyor.");
  }
  if (loopDispatchFamily) {
    loopDispatchFamily.textContent = String(payload.loopDispatchFamilyText || "FLOW --");
  }
  if (loopDispatchFlow) {
    loopDispatchFlow.textContent = String(payload.loopDispatchFlowText || "ENTRY --");
  }
  if (loopDispatchSummary) {
    loopDispatchSummary.textContent = String(payload.loopDispatchSummaryText || "SUMMARY --");
  }
  if (loopDispatchGate) {
    loopDispatchGate.textContent = String(payload.loopDispatchGateText || "GATE --");
  }
  if (loopDispatchLead) {
    loopDispatchLead.textContent = String(payload.loopDispatchLeadText || "LEAD --");
  }
  if (loopDispatchWindow) {
    loopDispatchWindow.textContent = String(payload.loopDispatchWindowText || "WINDOW --");
  }
  if (loopDispatchPressure) {
    loopDispatchPressure.textContent = String(payload.loopDispatchPressureText || "PRESSURE --");
  }
  if (loopDispatchResponse) {
    loopDispatchResponse.textContent = String(payload.loopDispatchResponseText || "RESPONSE --");
  }
  if (loopDispatchAttention) {
    loopDispatchAttention.textContent = String(payload.loopDispatchAttentionText || "ATTN --");
  }
  if (loopDispatchCadence) {
    loopDispatchCadence.textContent = String(payload.loopDispatchCadenceText || "CADENCE --");
  }
  renderLoopBridgeCards(loopDispatchCards, payload.loopDispatchCards);
  renderLoopBridgeBlocks(loopDispatchBlocks, payload.loopDispatchBlocks);
  renderLoopBridgeCards(loopDispatchFlowCards, payload.loopDispatchFlowCards);
  renderLoopBridgeBlocks(loopDispatchFlowBlocks, payload.loopDispatchFlowBlocks);
  renderLoopBridgePanels(loopDispatchFlowPanels, payload.loopDispatchFlowPanels);
  setChipTone(loopDispatchFamily, resolveLoopRailTone(payload.loopDispatchTone, "family"));
  setChipTone(loopDispatchFlow, resolveLoopRailTone(payload.loopDispatchTone, "flow"));
  setChipTone(loopDispatchSummary, resolveLoopRailTone(payload.loopDispatchTone, "summary"));
  setChipTone(loopDispatchGate, resolveLoopRailTone(payload.loopDispatchTone, "gate"));
  setChipTone(loopDispatchLead, resolveLoopRailTone(payload.loopDispatchTone, "lead"));
  setChipTone(loopDispatchWindow, resolveLoopRailTone(payload.loopDispatchTone, "window"));
  setChipTone(loopDispatchPressure, resolveLoopRailTone(payload.loopDispatchTone, "pressure"));
  setChipTone(loopDispatchResponse, resolveLoopRailTone(payload.loopDispatchTone, "response"));
  setChipTone(loopDispatchAttention, resolveLoopRailTone(payload.loopDispatchTone, "attention"));
  setChipTone(loopDispatchCadence, resolveLoopRailTone(payload.loopDispatchTone, "cadence"));
  pulseOnce(line);
  pulseOnce(eventsLine);
  pulseOnce(loopLine);
  pulseOnce(loopHint);
  pulseOnce(loopFocus);
  pulseOnce(loopOpsLine);
  pulseOnce(loopOpsHint);
  pulseOnce(loopSequence);
  pulseOnce(loopState);
  pulseOnce(loopDetail);
  pulseOnce(loopSignal);
  pulseOnce(loopQueue);
  pulseOnce(loopQueueFocus);
  pulseOnce(loopQueueStage);
  pulseOnce(loopRuntime);
  pulseOnce(loopRuntimeFocus);
  pulseOnce(loopRuntimeStage);
  pulseOnce(loopDispatch);
  pulseOnce(loopDispatchFocus);
  pulseOnce(loopDispatchStage);
  pulseOnce(loopQueueDetail);
  pulseOnce(loopQueueLead);
  pulseOnce(loopQueueWindow);
  pulseOnce(loopQueuePressure);
  pulseOnce(loopQueueResponse);
  pulseOnce(loopQueueAttention);
  pulseOnce(loopQueueCadence);
  pulseOnce(loopRuntimeDetail);
  pulseOnce(loopRuntimeLead);
  pulseOnce(loopRuntimeWindow);
  pulseOnce(loopRuntimePressure);
  pulseOnce(loopRuntimeResponse);
  pulseOnce(loopRuntimeAttention);
  pulseOnce(loopRuntimeCadence);
  pulseOnce(loopDispatchDetail);
  pulseOnce(loopDispatchFamily);
  pulseOnce(loopDispatchFlow);
  pulseOnce(loopDispatchSummary);
  pulseOnce(loopDispatchGate);
  pulseOnce(loopDispatchPressure);
  pulseOnce(loopDispatchResponse);
  pulseOnce(loopDispatchAttention);
  pulseOnce(loopDispatchCadence);
  return true;
}

export function installAdminRuntimeBridge(): void {
  window.__AKR_ADMIN_RUNTIME__ = { render };
}
