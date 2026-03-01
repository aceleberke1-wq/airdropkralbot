type ChainOption = {
  chain: string;
  payCurrency: string;
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

function render(payload: TokenOverviewBridgePayload): boolean {
  const badge = byId<HTMLElement>("tokenBadge");
  const balance = byId<HTMLElement>("balToken");
  const summary = byId<HTMLElement>("tokenSummary");
  const rate = byId<HTMLElement>("tokenRate");
  const mintable = byId<HTMLElement>("tokenMintable");
  const units = byId<HTMLElement>("tokenUnits");
  const hint = byId<HTMLElement>("tokenHint");
  const chainSelect = byId<HTMLSelectElement>("tokenChainSelect");
  const buyBtn = byId<HTMLButtonElement>("tokenBuyBtn");

  if (!badge || !balance || !summary || !rate || !mintable || !units || !hint || !chainSelect || !buyBtn) {
    return false;
  }

  badge.textContent = safeText(payload.symbol, "NXT");
  balance.textContent = safeText(payload.balanceText, "0.0000");
  summary.textContent = safeText(payload.summaryText, "0.0000 NXT");
  rate.textContent = safeText(payload.rateText, "$0.000000 / NXT");
  mintable.textContent = safeText(payload.mintableText, "0.0000 NXT");
  units.textContent = safeText(payload.unitsText, "Unify Units: 0");
  hint.textContent = safeText(payload.hintText, "Talep olustur, odeme yap, tx hash gonder, admin onayi bekle.");

  const options = Array.isArray(payload.chainOptions) ? payload.chainOptions : [];
  chainSelect.innerHTML = options
    .map((item) => `<option value="${safeText(item.chain)}">${safeText(item.chain)} (${safeText(item.payCurrency, "-")})</option>`)
    .join("");

  if (options.length > 0) {
    const selected = safeText(payload.selectedChain);
    const hasSelected = selected && options.some((item) => safeText(item.chain) === selected);
    chainSelect.value = hasSelected ? selected : safeText(options[0].chain);
  }

  buyBtn.disabled = Boolean(payload.buyDisabled);
  return true;
}

export function installTokenOverviewBridge(): void {
  window.__AKR_TOKEN_OVERVIEW__ = { render };
}
