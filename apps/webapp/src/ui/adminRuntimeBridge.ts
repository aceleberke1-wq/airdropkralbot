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
  const loopQueueFocus = byId<HTMLElement>("adminRuntimeLoopQueueFocus");
  const loopQueueStage = byId<HTMLElement>("adminRuntimeLoopQueueStage");
  const loopRuntime = byId<HTMLElement>("adminRuntimeLoopRuntime");
  const loopRuntimePanel = byId<HTMLElement>("adminRuntimeLoopRuntimePanel");
  const loopRuntimeFocus = byId<HTMLElement>("adminRuntimeLoopRuntimeFocus");
  const loopRuntimeStage = byId<HTMLElement>("adminRuntimeLoopRuntimeStage");
  const loopDispatch = byId<HTMLElement>("adminRuntimeLoopDispatch");
  const loopDispatchPanel = byId<HTMLElement>("adminRuntimeLoopDispatchPanel");
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
  if (loopRuntimeDetail) {
    loopRuntimeDetail.textContent = String(payload.loopRuntimeDetailText || "Runtime diagnostics bekleniyor.");
  }
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
  pulseOnce(loopRuntimeDetail);
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
