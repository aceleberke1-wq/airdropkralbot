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
  loopOpsLineText?: string;
  loopOpsHintText?: string;
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
  const loopOpsLine = byId<HTMLElement>("tokenLoopOpsLine");
  const loopOpsHint = byId<HTMLElement>("tokenLoopOpsHint");
  const chainSelect = byId<HTMLSelectElement>("tokenChainSelect");
  const buyBtn = byId<HTMLButtonElement>("tokenBuyBtn");

  if (!badge || !balance || !summary || !rate || !mintable || !units || !hint || !loopLine || !loopHint || !loopOpsLine || !loopOpsHint || !chainSelect || !buyBtn) {
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
  loopOpsLine.textContent = safeText(payload.loopOpsLineText, "WAIT | FLOW IDLE");
  loopOpsHint.textContent = safeText(payload.loopOpsHintText, "District flow aktif degil.");

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
