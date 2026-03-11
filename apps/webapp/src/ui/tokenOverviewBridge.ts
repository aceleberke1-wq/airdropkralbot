import { resolveLoopRailTone } from "../core/runtime/loopRailTone.js";
import { renderLoopBridgeBlocks, renderLoopBridgeCards, type LoopBridgeBlock, type LoopBridgeCard } from "./loopBridgeCards.js";

type ChainOption = {
  chain: string;
  payCurrency: string;
};

type StatusChip = {
  id: string;
  text: string;
  tone?: string;
  level?: number;
};

export type TokenOverviewBridgePayload = {
  symbol: string;
  balanceText: string;
  summaryText: string;
  rateText: string;
  mintableText: string;
  unitsText: string;
  hintText: string;
  chainOptions: ChainOption[];
  selectedChain: string;
  buyDisabled: boolean;
  statusChips?: StatusChip[];
  loopLineText?: string;
  loopHintText?: string;
  loopFocusText?: string;
  loopOpsLineText?: string;
  loopOpsHintText?: string;
  loopSequenceText?: string;
  loopStateText?: string;
  loopDetailText?: string;
  loopSignalText?: string;
  loopWalletText?: string;
  loopPayoutText?: string;
  loopRouteText?: string;
  loopPremiumText?: string;
  loopWalletTone?: string;
  loopPayoutTone?: string;
  loopRouteTone?: string;
  loopPremiumTone?: string;
  loopWalletFocusText?: string;
  loopPayoutFocusText?: string;
  loopRouteFocusText?: string;
  loopPremiumFocusText?: string;
  loopWalletStageText?: string;
  loopPayoutStageText?: string;
  loopRouteStageText?: string;
  loopPremiumStageText?: string;
  loopWalletOpsText?: string;
  loopPayoutOpsText?: string;
  loopRouteOpsText?: string;
  loopPremiumOpsText?: string;
  loopWalletStateText?: string;
  loopPayoutStateText?: string;
  loopRouteStateText?: string;
  loopPremiumStateText?: string;
  loopWalletSignalText?: string;
  loopPayoutSignalText?: string;
  loopRouteSignalText?: string;
  loopPremiumSignalText?: string;
  loopWalletDetailText?: string;
  loopPayoutDetailText?: string;
  loopRouteDetailText?: string;
  loopPremiumDetailText?: string;
  loopWalletFamilyText?: string;
  loopWalletFlowText?: string;
  loopWalletSummaryText?: string;
  loopWalletGateText?: string;
  loopWalletLeadText?: string;
  loopWalletWindowText?: string;
  loopWalletPressureText?: string;
  loopWalletResponseText?: string;
  loopWalletAttentionText?: string;
  loopWalletCadenceText?: string;
  loopWalletCards?: LoopBridgeCard[];
  loopWalletBlocks?: LoopBridgeBlock[];
  loopPayoutFamilyText?: string;
  loopPayoutFlowText?: string;
  loopPayoutSummaryText?: string;
  loopPayoutGateText?: string;
  loopPayoutLeadText?: string;
  loopPayoutWindowText?: string;
  loopPayoutPressureText?: string;
  loopPayoutResponseText?: string;
  loopPayoutAttentionText?: string;
  loopPayoutCadenceText?: string;
  loopRouteFamilyText?: string;
  loopRouteFlowText?: string;
  loopRouteSummaryText?: string;
  loopRouteGateText?: string;
  loopRouteLeadText?: string;
  loopRouteWindowText?: string;
  loopRoutePressureText?: string;
  loopRouteResponseText?: string;
  loopRouteAttentionText?: string;
  loopRouteCadenceText?: string;
  loopPremiumFamilyText?: string;
  loopPremiumFlowText?: string;
  loopPremiumSummaryText?: string;
  loopPremiumGateText?: string;
  loopPremiumLeadText?: string;
  loopPremiumWindowText?: string;
  loopPremiumPressureText?: string;
  loopPremiumResponseText?: string;
  loopPremiumAttentionText?: string;
  loopPremiumCadenceText?: string;
};

type TokenOverviewBridge = {
  render: (payload: TokenOverviewBridgePayload) => boolean;
};

declare global {
  interface Window {
    __AKR_TOKEN_OVERVIEW__?: TokenOverviewBridge;
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

function setTone(node: HTMLElement | null, tone: unknown): void {
  if (!node) {
    return;
  }
  node.dataset.tone = safeText(tone, "neutral").toLowerCase() || "neutral";
}

function setChipTone(node: HTMLElement | null, tone: unknown): void {
  if (!node) {
    return;
  }
  const nextTone = safeText(tone, "neutral").toLowerCase() || "neutral";
  node.classList.remove("neutral", "info", "safe", "advantage", "balanced", "pressure", "aggressive", "critical");
  node.classList.add(nextTone);
}

function render(payload: TokenOverviewBridgePayload): boolean {
  const badge = byId<HTMLElement>("tokenBadge");
  const balance = byId<HTMLElement>("balToken");
  const summary = byId<HTMLElement>("tokenSummary");
  const rate = byId<HTMLElement>("tokenRate");
  const mintable = byId<HTMLElement>("tokenMintable");
  const units = byId<HTMLElement>("tokenUnits");
  const hint = byId<HTMLElement>("tokenHint");
  const loopLine = byId<HTMLElement>("tokenLoopLine");
  const loopHint = byId<HTMLElement>("tokenLoopHint");
  const loopFocus = byId<HTMLElement>("tokenLoopFocus");
  const loopOpsLine = byId<HTMLElement>("tokenLoopOpsLine");
  const loopOpsHint = byId<HTMLElement>("tokenLoopOpsHint");
  const loopSequence = byId<HTMLElement>("tokenLoopSequence");
  const loopState = byId<HTMLElement>("tokenLoopState");
  const loopDetail = byId<HTMLElement>("tokenLoopDetail");
  const loopSignal = byId<HTMLElement>("tokenLoopSignal");
  const loopWallet = byId<HTMLElement>("tokenLoopWallet");
  const loopWalletPanel = byId<HTMLElement>("tokenLoopWalletPanel");
  const loopWalletCards = byId<HTMLElement>("tokenLoopWalletCards");
  const loopWalletBlocks = byId<HTMLElement>("tokenLoopWalletBlocks");
  const loopWalletFocus = byId<HTMLElement>("tokenLoopWalletFocus");
  const loopWalletStage = byId<HTMLElement>("tokenLoopWalletStage");
  const loopPayout = byId<HTMLElement>("tokenLoopPayout");
  const loopPayoutPanel = byId<HTMLElement>("tokenLoopPayoutPanel");
  const loopPayoutFocus = byId<HTMLElement>("tokenLoopPayoutFocus");
  const loopPayoutStage = byId<HTMLElement>("tokenLoopPayoutStage");
  const loopRoute = byId<HTMLElement>("tokenLoopRoute");
  const loopRoutePanel = byId<HTMLElement>("tokenLoopRoutePanel");
  const loopRouteFocus = byId<HTMLElement>("tokenLoopRouteFocus");
  const loopRouteStage = byId<HTMLElement>("tokenLoopRouteStage");
  const loopPremium = byId<HTMLElement>("tokenLoopPremium");
  const loopPremiumPanel = byId<HTMLElement>("tokenLoopPremiumPanel");
  const loopPremiumFocus = byId<HTMLElement>("tokenLoopPremiumFocus");
  const loopPremiumStage = byId<HTMLElement>("tokenLoopPremiumStage");
  const loopWalletState = byId<HTMLElement>("tokenLoopWalletState");
  const loopPayoutState = byId<HTMLElement>("tokenLoopPayoutState");
  const loopRouteState = byId<HTMLElement>("tokenLoopRouteState");
  const loopPremiumState = byId<HTMLElement>("tokenLoopPremiumState");
  const loopWalletOps = byId<HTMLElement>("tokenLoopWalletOps");
  const loopPayoutOps = byId<HTMLElement>("tokenLoopPayoutOps");
  const loopRouteOps = byId<HTMLElement>("tokenLoopRouteOps");
  const loopPremiumOps = byId<HTMLElement>("tokenLoopPremiumOps");
  const loopWalletSignal = byId<HTMLElement>("tokenLoopWalletSignal");
  const loopPayoutSignal = byId<HTMLElement>("tokenLoopPayoutSignal");
  const loopRouteSignal = byId<HTMLElement>("tokenLoopRouteSignal");
  const loopPremiumSignal = byId<HTMLElement>("tokenLoopPremiumSignal");
  const loopWalletDetail = byId<HTMLElement>("tokenLoopWalletDetail");
  const loopPayoutDetail = byId<HTMLElement>("tokenLoopPayoutDetail");
  const loopRouteDetail = byId<HTMLElement>("tokenLoopRouteDetail");
  const loopPremiumDetail = byId<HTMLElement>("tokenLoopPremiumDetail");
  const loopWalletFamily = byId<HTMLElement>("tokenLoopWalletFamily");
  const loopWalletFlow = byId<HTMLElement>("tokenLoopWalletFlow");
  const loopWalletSummary = byId<HTMLElement>("tokenLoopWalletSummary");
  const loopWalletGate = byId<HTMLElement>("tokenLoopWalletGate");
  const loopWalletLead = byId<HTMLElement>("tokenLoopWalletLead");
  const loopWalletWindow = byId<HTMLElement>("tokenLoopWalletWindow");
  const loopWalletPressure = byId<HTMLElement>("tokenLoopWalletPressure");
  const loopWalletResponse = byId<HTMLElement>("tokenLoopWalletResponse");
  const loopWalletAttention = byId<HTMLElement>("tokenLoopWalletAttention");
  const loopWalletCadence = byId<HTMLElement>("tokenLoopWalletCadence");
  const loopPayoutFamily = byId<HTMLElement>("tokenLoopPayoutFamily");
  const loopPayoutFlow = byId<HTMLElement>("tokenLoopPayoutFlow");
  const loopPayoutSummary = byId<HTMLElement>("tokenLoopPayoutSummary");
  const loopPayoutGate = byId<HTMLElement>("tokenLoopPayoutGate");
  const loopPayoutLead = byId<HTMLElement>("tokenLoopPayoutLead");
  const loopPayoutWindow = byId<HTMLElement>("tokenLoopPayoutWindow");
  const loopPayoutPressure = byId<HTMLElement>("tokenLoopPayoutPressure");
  const loopPayoutResponse = byId<HTMLElement>("tokenLoopPayoutResponse");
  const loopPayoutAttention = byId<HTMLElement>("tokenLoopPayoutAttention");
  const loopPayoutCadence = byId<HTMLElement>("tokenLoopPayoutCadence");
  const loopRouteFamily = byId<HTMLElement>("tokenLoopRouteFamily");
  const loopRouteFlow = byId<HTMLElement>("tokenLoopRouteFlow");
  const loopRouteSummary = byId<HTMLElement>("tokenLoopRouteSummary");
  const loopRouteGate = byId<HTMLElement>("tokenLoopRouteGate");
  const loopRouteLead = byId<HTMLElement>("tokenLoopRouteLead");
  const loopRouteWindow = byId<HTMLElement>("tokenLoopRouteWindow");
  const loopRoutePressure = byId<HTMLElement>("tokenLoopRoutePressure");
  const loopRouteResponse = byId<HTMLElement>("tokenLoopRouteResponse");
  const loopRouteAttention = byId<HTMLElement>("tokenLoopRouteAttention");
  const loopRouteCadence = byId<HTMLElement>("tokenLoopRouteCadence");
  const loopPremiumFamily = byId<HTMLElement>("tokenLoopPremiumFamily");
  const loopPremiumFlow = byId<HTMLElement>("tokenLoopPremiumFlow");
  const loopPremiumSummary = byId<HTMLElement>("tokenLoopPremiumSummary");
  const loopPremiumGate = byId<HTMLElement>("tokenLoopPremiumGate");
  const loopPremiumLead = byId<HTMLElement>("tokenLoopPremiumLead");
  const loopPremiumWindow = byId<HTMLElement>("tokenLoopPremiumWindow");
  const loopPremiumPressure = byId<HTMLElement>("tokenLoopPremiumPressure");
  const loopPremiumResponse = byId<HTMLElement>("tokenLoopPremiumResponse");
  const loopPremiumAttention = byId<HTMLElement>("tokenLoopPremiumAttention");
  const loopPremiumCadence = byId<HTMLElement>("tokenLoopPremiumCadence");
  const chainSelect = byId<HTMLSelectElement>("tokenChainSelect");
  const buyBtn = byId<HTMLButtonElement>("tokenBuyBtn");

  if (!badge || !balance || !summary || !rate || !mintable || !units || !hint || !loopLine || !loopHint || !loopFocus || !loopOpsLine || !loopOpsHint || !loopSequence || !loopState || !loopDetail || !loopSignal || !chainSelect || !buyBtn) {
    return false;
  }

  badge.textContent = safeText(payload.symbol, "NXT");
  balance.textContent = safeText(payload.balanceText, "0.0000");
  summary.textContent = safeText(payload.summaryText, "0.0000 NXT");
  rate.textContent = safeText(payload.rateText, "$0.000000 / NXT");
  mintable.textContent = safeText(payload.mintableText, "0.0000 NXT");
  units.textContent = safeText(payload.unitsText, "Unify Units: 0");
  hint.textContent = safeText(payload.hintText, "Talep olustur, odeme yap, tx hash gonder, admin onayi bekle.");
  loopLine.textContent = safeText(payload.loopLineText, "VAULT LOOP | WAIT");
  loopHint.textContent = safeText(payload.loopHintText, "Scene loop focus bekleniyor.");
  loopFocus.textContent = safeText(payload.loopFocusText, "FLOW | WAIT");
  loopOpsLine.textContent = safeText(payload.loopOpsLineText, "WAIT | FLOW IDLE");
  loopOpsHint.textContent = safeText(payload.loopOpsHintText, "District flow aktif degil.");
  loopSequence.textContent = safeText(payload.loopSequenceText, "Sequence detay bekleniyor.");
  loopState.textContent = safeText(payload.loopStateText, "IDLE | FLOW WAIT");
  loopDetail.textContent = safeText(payload.loopDetailText, "Loop detay bekleniyor.");
  loopSignal.textContent = safeText(payload.loopSignalText, "Signal detay bekleniyor.");
  if (loopWallet) {
    loopWallet.textContent = safeText(payload.loopWalletText, "WALLET | WAIT");
  }
  setTone(loopWalletPanel, payload.loopWalletTone);
  if (loopWalletFocus) {
    loopWalletFocus.textContent = safeText(payload.loopWalletFocusText, "ENTRY WAIT | FOCUS WAIT | FLOW WAIT");
  }
  if (loopWalletStage) {
    loopWalletStage.textContent = safeText(payload.loopWalletStageText, "STAGE -- | STATUS -- | ENTRY WAIT");
  }
  if (loopPayout) {
    loopPayout.textContent = safeText(payload.loopPayoutText, "PAYOUT | WAIT");
  }
  setTone(loopPayoutPanel, payload.loopPayoutTone);
  if (loopPayoutFocus) {
    loopPayoutFocus.textContent = safeText(payload.loopPayoutFocusText, "SEQ WAIT | FOCUS WAIT | ROUTE --");
  }
  if (loopPayoutStage) {
    loopPayoutStage.textContent = safeText(payload.loopPayoutStageText, "STAGE -- | STATUS -- | SEQ WAIT");
  }
  if (loopRoute) {
    loopRoute.textContent = safeText(payload.loopRouteText, "ROUTE | WAIT");
  }
  setTone(loopRoutePanel, payload.loopRouteTone);
  if (loopRouteFocus) {
    loopRouteFocus.textContent = safeText(payload.loopRouteFocusText, "PERSONA WAIT | FOCUS -- | FLOW WAIT");
  }
  if (loopRouteStage) {
    loopRouteStage.textContent = safeText(payload.loopRouteStageText, "STAGE -- | STATUS -- | PERSONA WAIT");
  }
  if (loopPremium) {
    loopPremium.textContent = safeText(payload.loopPremiumText, "PREMIUM | WAIT");
  }
  setTone(loopPremiumPanel, payload.loopPremiumTone);
  if (loopPremiumFocus) {
    loopPremiumFocus.textContent = safeText(payload.loopPremiumFocusText, "ENTRY WAIT | FOCUS WAIT | FLOW WAIT");
  }
  if (loopPremiumStage) {
    loopPremiumStage.textContent = safeText(payload.loopPremiumStageText, "STAGE -- | STATUS -- | PASS --");
  }
  if (loopWalletState) {
    loopWalletState.textContent = safeText(payload.loopWalletStateText, "FLOW WAIT | ENTRY WAIT | STATE --");
  }
  if (loopPayoutState) {
    loopPayoutState.textContent = safeText(payload.loopPayoutStateText, "FLOW WAIT | SEQ WAIT | PAYOUT --");
  }
  if (loopRouteState) {
    loopRouteState.textContent = safeText(payload.loopRouteStateText, "FLOW WAIT | PERSONA WAIT | ROUTE --");
  }
  if (loopPremiumState) {
    loopPremiumState.textContent = safeText(payload.loopPremiumStateText, "FLOW WAIT | STAGE -- | PASS --");
  }
  if (loopWalletOps) {
    loopWalletOps.textContent = safeText(payload.loopWalletOpsText, "ENTRY WAIT | STATE -- | FLOW WAIT");
  }
  if (loopPayoutOps) {
    loopPayoutOps.textContent = safeText(payload.loopPayoutOpsText, "SEQ WAIT | PAYOUT -- | ROUTE --");
  }
  if (loopRouteOps) {
    loopRouteOps.textContent = safeText(payload.loopRouteOpsText, "PERSONA WAIT | ROUTE -- | FLOW WAIT");
  }
  if (loopPremiumOps) {
    loopPremiumOps.textContent = safeText(payload.loopPremiumOpsText, "ENTRY WAIT | PASS -- | STAGE --");
  }
  if (loopWalletSignal) {
    loopWalletSignal.textContent = safeText(payload.loopWalletSignalText, "STATE -- | FLOW WAIT | ENTRY WAIT");
  }
  if (loopPayoutSignal) {
    loopPayoutSignal.textContent = safeText(payload.loopPayoutSignalText, "PAYOUT -- | ROUTE -- | FLOW WAIT");
  }
  if (loopRouteSignal) {
    loopRouteSignal.textContent = safeText(payload.loopRouteSignalText, "ROUTE -- | PERSONA WAIT | FLOW WAIT");
  }
  if (loopPremiumSignal) {
    loopPremiumSignal.textContent = safeText(payload.loopPremiumSignalText, "PASS -- | STAGE -- | FLOW WAIT");
  }
  if (loopWalletDetail) {
    loopWalletDetail.textContent = safeText(payload.loopWalletDetailText, "Wallet verification detay bekleniyor.");
  }
  if (loopWalletFamily) {
    loopWalletFamily.textContent = safeText(payload.loopWalletFamilyText, "FLOW --");
  }
  if (loopWalletFlow) {
    loopWalletFlow.textContent = safeText(payload.loopWalletFlowText, "ENTRY --");
  }
  if (loopWalletSummary) {
    loopWalletSummary.textContent = safeText(payload.loopWalletSummaryText, "SUMMARY --");
  }
  if (loopWalletGate) {
    loopWalletGate.textContent = safeText(payload.loopWalletGateText, "GATE --");
  }
  if (loopWalletLead) {
    loopWalletLead.textContent = safeText(payload.loopWalletLeadText, "LEAD --");
  }
  if (loopWalletWindow) {
    loopWalletWindow.textContent = safeText(payload.loopWalletWindowText, "WINDOW --");
  }
  if (loopWalletPressure) {
    loopWalletPressure.textContent = safeText(payload.loopWalletPressureText, "PRESSURE --");
  }
  if (loopWalletResponse) {
    loopWalletResponse.textContent = safeText(payload.loopWalletResponseText, "RESPONSE --");
  }
  if (loopWalletAttention) {
    loopWalletAttention.textContent = safeText(payload.loopWalletAttentionText, "ATTN --");
  }
  if (loopWalletCadence) {
    loopWalletCadence.textContent = safeText(payload.loopWalletCadenceText, "CADENCE --");
  }
  renderLoopBridgeCards(loopWalletCards, payload.loopWalletCards);
  renderLoopBridgeBlocks(loopWalletBlocks, payload.loopWalletBlocks);
  setChipTone(loopWalletFamily, resolveLoopRailTone(payload.loopWalletTone, "family"));
  setChipTone(loopWalletFlow, resolveLoopRailTone(payload.loopWalletTone, "flow"));
  setChipTone(loopWalletSummary, resolveLoopRailTone(payload.loopWalletTone, "summary"));
  setChipTone(loopWalletGate, resolveLoopRailTone(payload.loopWalletTone, "gate"));
  setChipTone(loopWalletLead, resolveLoopRailTone(payload.loopWalletTone, "lead"));
  setChipTone(loopWalletWindow, resolveLoopRailTone(payload.loopWalletTone, "window"));
  setChipTone(loopWalletPressure, resolveLoopRailTone(payload.loopWalletTone, "pressure"));
  setChipTone(loopWalletResponse, resolveLoopRailTone(payload.loopWalletTone, "response"));
  setChipTone(loopWalletAttention, resolveLoopRailTone(payload.loopWalletTone, "attention"));
  setChipTone(loopWalletCadence, resolveLoopRailTone(payload.loopWalletTone, "cadence"));
  if (loopPayoutDetail) {
    loopPayoutDetail.textContent = safeText(payload.loopPayoutDetailText, "Payout route detay bekleniyor.");
  }
  if (loopPayoutFamily) {
    loopPayoutFamily.textContent = safeText(payload.loopPayoutFamilyText, "FLOW --");
  }
  if (loopPayoutFlow) {
    loopPayoutFlow.textContent = safeText(payload.loopPayoutFlowText, "ENTRY --");
  }
  if (loopPayoutSummary) {
    loopPayoutSummary.textContent = safeText(payload.loopPayoutSummaryText, "SUMMARY --");
  }
  if (loopPayoutGate) {
    loopPayoutGate.textContent = safeText(payload.loopPayoutGateText, "GATE --");
  }
  if (loopPayoutLead) {
    loopPayoutLead.textContent = safeText(payload.loopPayoutLeadText, "LEAD --");
  }
  if (loopPayoutWindow) {
    loopPayoutWindow.textContent = safeText(payload.loopPayoutWindowText, "WINDOW --");
  }
  if (loopPayoutPressure) {
    loopPayoutPressure.textContent = safeText(payload.loopPayoutPressureText, "PRESSURE --");
  }
  if (loopPayoutResponse) {
    loopPayoutResponse.textContent = safeText(payload.loopPayoutResponseText, "RESPONSE --");
  }
  if (loopPayoutAttention) {
    loopPayoutAttention.textContent = safeText(payload.loopPayoutAttentionText, "ATTN --");
  }
  if (loopPayoutCadence) {
    loopPayoutCadence.textContent = safeText(payload.loopPayoutCadenceText, "CADENCE --");
  }
  setChipTone(loopPayoutFamily, resolveLoopRailTone(payload.loopPayoutTone, "family"));
  setChipTone(loopPayoutFlow, resolveLoopRailTone(payload.loopPayoutTone, "flow"));
  setChipTone(loopPayoutSummary, resolveLoopRailTone(payload.loopPayoutTone, "summary"));
  setChipTone(loopPayoutGate, resolveLoopRailTone(payload.loopPayoutTone, "gate"));
  setChipTone(loopPayoutLead, resolveLoopRailTone(payload.loopPayoutTone, "lead"));
  setChipTone(loopPayoutWindow, resolveLoopRailTone(payload.loopPayoutTone, "window"));
  setChipTone(loopPayoutPressure, resolveLoopRailTone(payload.loopPayoutTone, "pressure"));
  setChipTone(loopPayoutResponse, resolveLoopRailTone(payload.loopPayoutTone, "response"));
  setChipTone(loopPayoutAttention, resolveLoopRailTone(payload.loopPayoutTone, "attention"));
  setChipTone(loopPayoutCadence, resolveLoopRailTone(payload.loopPayoutTone, "cadence"));
  if (loopRouteDetail) {
    loopRouteDetail.textContent = safeText(payload.loopRouteDetailText, "Route quorum detay bekleniyor.");
  }
  if (loopRouteFamily) {
    loopRouteFamily.textContent = safeText(payload.loopRouteFamilyText, "FLOW --");
  }
  if (loopRouteFlow) {
    loopRouteFlow.textContent = safeText(payload.loopRouteFlowText, "ENTRY --");
  }
  if (loopRouteSummary) {
    loopRouteSummary.textContent = safeText(payload.loopRouteSummaryText, "SUMMARY --");
  }
  if (loopRouteGate) {
    loopRouteGate.textContent = safeText(payload.loopRouteGateText, "GATE --");
  }
  if (loopRouteLead) {
    loopRouteLead.textContent = safeText(payload.loopRouteLeadText, "LEAD --");
  }
  if (loopRouteWindow) {
    loopRouteWindow.textContent = safeText(payload.loopRouteWindowText, "WINDOW --");
  }
  if (loopRoutePressure) {
    loopRoutePressure.textContent = safeText(payload.loopRoutePressureText, "PRESSURE --");
  }
  if (loopRouteResponse) {
    loopRouteResponse.textContent = safeText(payload.loopRouteResponseText, "RESPONSE --");
  }
  if (loopRouteAttention) {
    loopRouteAttention.textContent = safeText(payload.loopRouteAttentionText, "ATTN --");
  }
  if (loopRouteCadence) {
    loopRouteCadence.textContent = safeText(payload.loopRouteCadenceText, "CADENCE --");
  }
  setChipTone(loopRouteFamily, resolveLoopRailTone(payload.loopRouteTone, "family"));
  setChipTone(loopRouteFlow, resolveLoopRailTone(payload.loopRouteTone, "flow"));
  setChipTone(loopRouteSummary, resolveLoopRailTone(payload.loopRouteTone, "summary"));
  setChipTone(loopRouteGate, resolveLoopRailTone(payload.loopRouteTone, "gate"));
  setChipTone(loopRouteLead, resolveLoopRailTone(payload.loopRouteTone, "lead"));
  setChipTone(loopRouteWindow, resolveLoopRailTone(payload.loopRouteTone, "window"));
  setChipTone(loopRoutePressure, resolveLoopRailTone(payload.loopRouteTone, "pressure"));
  setChipTone(loopRouteResponse, resolveLoopRailTone(payload.loopRouteTone, "response"));
  setChipTone(loopRouteAttention, resolveLoopRailTone(payload.loopRouteTone, "attention"));
  setChipTone(loopRouteCadence, resolveLoopRailTone(payload.loopRouteTone, "cadence"));
  if (loopPremiumDetail) {
    loopPremiumDetail.textContent = safeText(payload.loopPremiumDetailText, "Premium lane detay bekleniyor.");
  }
  if (loopPremiumFamily) {
    loopPremiumFamily.textContent = safeText(payload.loopPremiumFamilyText, "FLOW --");
  }
  if (loopPremiumFlow) {
    loopPremiumFlow.textContent = safeText(payload.loopPremiumFlowText, "ENTRY --");
  }
  if (loopPremiumSummary) {
    loopPremiumSummary.textContent = safeText(payload.loopPremiumSummaryText, "SUMMARY --");
  }
  if (loopPremiumGate) {
    loopPremiumGate.textContent = safeText(payload.loopPremiumGateText, "GATE --");
  }
  if (loopPremiumLead) {
    loopPremiumLead.textContent = safeText(payload.loopPremiumLeadText, "LEAD --");
  }
  if (loopPremiumWindow) {
    loopPremiumWindow.textContent = safeText(payload.loopPremiumWindowText, "WINDOW --");
  }
  if (loopPremiumPressure) {
    loopPremiumPressure.textContent = safeText(payload.loopPremiumPressureText, "PRESSURE --");
  }
  if (loopPremiumResponse) {
    loopPremiumResponse.textContent = safeText(payload.loopPremiumResponseText, "RESPONSE --");
  }
  if (loopPremiumAttention) {
    loopPremiumAttention.textContent = safeText(payload.loopPremiumAttentionText, "ATTN --");
  }
  if (loopPremiumCadence) {
    loopPremiumCadence.textContent = safeText(payload.loopPremiumCadenceText, "CADENCE --");
  }
  setChipTone(loopPremiumFamily, resolveLoopRailTone(payload.loopPremiumTone, "family"));
  setChipTone(loopPremiumFlow, resolveLoopRailTone(payload.loopPremiumTone, "flow"));
  setChipTone(loopPremiumSummary, resolveLoopRailTone(payload.loopPremiumTone, "summary"));
  setChipTone(loopPremiumGate, resolveLoopRailTone(payload.loopPremiumTone, "gate"));
  setChipTone(loopPremiumLead, resolveLoopRailTone(payload.loopPremiumTone, "lead"));
  setChipTone(loopPremiumWindow, resolveLoopRailTone(payload.loopPremiumTone, "window"));
  setChipTone(loopPremiumPressure, resolveLoopRailTone(payload.loopPremiumTone, "pressure"));
  setChipTone(loopPremiumResponse, resolveLoopRailTone(payload.loopPremiumTone, "response"));
  setChipTone(loopPremiumAttention, resolveLoopRailTone(payload.loopPremiumTone, "attention"));
  setChipTone(loopPremiumCadence, resolveLoopRailTone(payload.loopPremiumTone, "cadence"));

  const options = Array.isArray(payload.chainOptions) ? payload.chainOptions : [];
  chainSelect.innerHTML = options
    .map((item) => `<option value="${safeText(item.chain)}">${safeText(item.chain)} (${safeText(item.payCurrency, "-")})</option>`)
    .join("");

  if (options.length > 0) {
    const selected = safeText(payload.selectedChain);
    const hasSelected = selected && options.some((item) => safeText(item.chain) === selected);
    chainSelect.value = hasSelected ? selected : safeText(options[0].chain);
  }

  (Array.isArray(payload.statusChips) ? payload.statusChips : []).forEach((chip) => {
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

  buyBtn.disabled = Boolean(payload.buyDisabled);
  return true;
}

export function installTokenOverviewBridge(): void {
  window.__AKR_TOKEN_OVERVIEW__ = { render };
}
