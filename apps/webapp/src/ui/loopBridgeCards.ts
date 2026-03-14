export type LoopBridgeCard = {
  title: string;
  value: string;
  hint?: string;
  tone?: string;
  contract_ready?: boolean;
  contract_missing_keys?: string[];
  action_context_signature?: string;
  risk_context_signature?: string;
  focus_key?: string;
  risk_key?: string;
  risk_focus_key?: string;
  family_key?: string;
  flow_key?: string;
  microflow_key?: string;
  asset_key?: string;
  asset_family_key?: string;
  asset_bundle_kind?: string;
  asset_variant_key?: string;
  asset_variant_role?: string;
  asset_variant_tier?: string;
  asset_state_key?: string;
  asset_contract_ready?: boolean;
  asset_contract_signature?: string;
  asset_focus_key?: string;
  risk_health_band_key?: string;
  risk_attention_band_key?: string;
  risk_trend_direction_key?: string;
  contract_state_key?: string;
  entry_kind_key?: string;
  sequence_kind_key?: string;
  action_context?: LoopBridgeActionContext;
  risk_context?: LoopBridgeRiskContext;
};

export type LoopBridgeBlock = {
  title: string;
  summary: string;
  gate: string;
  hint?: string;
  tone?: string;
  contract_ready?: boolean;
  contract_missing_keys?: string[];
  action_context_signature?: string;
  risk_context_signature?: string;
  focus_key?: string;
  risk_key?: string;
  risk_focus_key?: string;
  family_key?: string;
  flow_key?: string;
  microflow_key?: string;
  asset_key?: string;
  asset_family_key?: string;
  asset_bundle_kind?: string;
  asset_variant_key?: string;
  asset_variant_role?: string;
  asset_variant_tier?: string;
  asset_state_key?: string;
  asset_contract_ready?: boolean;
  asset_contract_signature?: string;
  asset_focus_key?: string;
  risk_health_band_key?: string;
  risk_attention_band_key?: string;
  risk_trend_direction_key?: string;
  contract_state_key?: string;
  entry_kind_key?: string;
  sequence_kind_key?: string;
  action_context?: LoopBridgeActionContext;
  risk_context?: LoopBridgeRiskContext;
};

export type LoopBridgePanel = {
  title: string;
  lines: string[];
  hint?: string;
  tone?: string;
  contract_ready?: boolean;
  contract_missing_keys?: string[];
  action_context_signature?: string;
  risk_context_signature?: string;
  focus_key?: string;
  risk_key?: string;
  risk_focus_key?: string;
  family_key?: string;
  flow_key?: string;
  microflow_key?: string;
  asset_key?: string;
  asset_family_key?: string;
  asset_bundle_kind?: string;
  asset_variant_key?: string;
  asset_variant_role?: string;
  asset_variant_tier?: string;
  asset_state_key?: string;
  asset_contract_ready?: boolean;
  asset_contract_signature?: string;
  asset_focus_key?: string;
  risk_health_band_key?: string;
  risk_attention_band_key?: string;
  risk_trend_direction_key?: string;
  contract_state_key?: string;
  entry_kind_key?: string;
  sequence_kind_key?: string;
  action_context?: LoopBridgeActionContext;
  risk_context?: LoopBridgeRiskContext;
};

export type LoopBridgeActionContext = {
  family_key?: string;
  flow_key?: string;
  microflow_key?: string;
  asset_key?: string;
  asset_family_key?: string;
  asset_bundle_kind?: string;
  asset_variant_key?: string;
  asset_variant_role?: string;
  asset_variant_tier?: string;
  asset_state_key?: string;
  asset_contract_ready?: boolean;
  asset_contract_signature?: string;
  asset_focus_key?: string;
  focus_key?: string;
  risk_key?: string;
  risk_focus_key?: string;
  risk_health_band_key?: string;
  risk_attention_band_key?: string;
  risk_trend_direction_key?: string;
  contract_state_key?: string;
  entry_kind_key?: string;
  sequence_kind_key?: string;
  action_context_signature?: string;
  contract_ready?: boolean;
  contract_missing_keys?: string[];
};

export type LoopBridgeRiskContext = LoopBridgeActionContext & {
  risk_context_signature?: string;
};

function safeText(value: unknown, fallback = ""): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeTone(value: unknown): string {
  const tone = safeText(value, "neutral").toLowerCase();
  if (tone === "safe") return "advantage";
  if (tone === "aggressive") return "pressure";
  if (["neutral", "balanced", "advantage", "pressure", "critical"].includes(tone)) {
    return tone;
  }
  return "neutral";
}

export type LoopBridgeMeta = {
  contract_ready?: boolean;
  contract_missing_keys?: string[];
  action_context_signature?: string;
  risk_context_signature?: string;
  focus_key?: string;
  risk_key?: string;
  risk_focus_key?: string;
  family_key?: string;
  flow_key?: string;
  microflow_key?: string;
  asset_key?: string;
  asset_family_key?: string;
  asset_bundle_kind?: string;
  asset_variant_key?: string;
  asset_variant_role?: string;
  asset_variant_tier?: string;
  asset_state_key?: string;
  asset_contract_ready?: boolean;
  asset_contract_signature?: string;
  asset_focus_key?: string;
  risk_health_band_key?: string;
  risk_attention_band_key?: string;
  risk_trend_direction_key?: string;
  contract_state_key?: string;
  entry_kind_key?: string;
  sequence_kind_key?: string;
  action_context?: LoopBridgeActionContext;
  risk_context?: LoopBridgeRiskContext;
};

const BRIDGE_META_DATASET_KEYS = [
  "contractReady",
  "contractMissingKeys",
  "actionContextSignature",
  "riskContextSignature",
  "focusKey",
  "riskKey",
  "riskFocusKey",
  "familyKey",
  "flowKey",
  "microflowKey",
  "assetKey",
  "assetFamilyKey",
  "assetBundleKind",
  "assetVariantKey",
  "assetVariantRole",
  "assetVariantTier",
  "assetStateKey",
  "assetContractReady",
  "assetContractSignature",
  "assetFocusKey",
  "riskHealthBandKey",
  "riskAttentionBandKey",
  "riskTrendDirectionKey",
  "contractStateKey",
  "entryKindKey",
  "sequenceKindKey"
];

function resetBridgeMeta(node: HTMLElement): void {
  BRIDGE_META_DATASET_KEYS.forEach((key) => {
    delete node.dataset[key];
  });
  node.classList.remove("is-contract-ready", "is-contract-missing");
}

function resolveBridgeContractReady(meta: LoopBridgeMeta): boolean {
  if (typeof meta.contract_ready === "boolean") {
    return meta.contract_ready;
  }
  const actionContext = meta.action_context ?? {};
  const riskContext = meta.risk_context ?? {};
  const flowKey = safeText(meta.flow_key || actionContext.flow_key || riskContext.flow_key);
  const focusKey = safeText(meta.focus_key || actionContext.focus_key || riskContext.focus_key);
  const riskKey = safeText(meta.risk_key || actionContext.risk_key || riskContext.risk_key);
  const riskFocusKey = safeText(
    meta.risk_focus_key || actionContext.risk_focus_key || riskContext.risk_focus_key
  );
  const entryKindKey = safeText(meta.entry_kind_key || actionContext.entry_kind_key || riskContext.entry_kind_key);
  const sequenceKindKey = safeText(
    meta.sequence_kind_key || actionContext.sequence_kind_key || riskContext.sequence_kind_key
  );
  const actionContextSignature = safeText(
    meta.action_context_signature || actionContext.action_context_signature
  );
  const riskContextSignature = safeText(
    meta.risk_context_signature || riskContext.risk_context_signature
  );
  return Boolean(
    flowKey &&
      focusKey &&
      riskKey &&
      riskFocusKey &&
      entryKindKey &&
      sequenceKindKey &&
      actionContextSignature &&
      riskContextSignature
  );
}

function applyBridgeMeta(article: HTMLElement, meta: LoopBridgeMeta): void {
  const contractReady = resolveBridgeContractReady(meta);
  article.dataset.contractReady = contractReady ? "true" : "false";
  article.classList.add(contractReady ? "is-contract-ready" : "is-contract-missing");
  const contractMissingKeys = Array.isArray(meta.contract_missing_keys)
    ? meta.contract_missing_keys.map((value) => safeText(value)).filter(Boolean)
    : [];
  if (contractMissingKeys.length) {
    article.dataset.contractMissingKeys = contractMissingKeys.join(",");
  }
  const actionContext = meta.action_context ?? {};
  const riskContext = meta.risk_context ?? {};
  const actionContextSignature = safeText(
    meta.action_context_signature || actionContext.action_context_signature
  );
  const riskContextSignature = safeText(meta.risk_context_signature || riskContext.risk_context_signature);
  const focusKey = safeText(meta.focus_key || actionContext.focus_key || riskContext.focus_key);
  const riskKey = safeText(meta.risk_key || actionContext.risk_key || riskContext.risk_key);
  const riskFocusKey = safeText(
    meta.risk_focus_key || actionContext.risk_focus_key || riskContext.risk_focus_key
  );
  const familyKey = safeText(meta.family_key || actionContext.family_key || riskContext.family_key);
  const flowKey = safeText(meta.flow_key || actionContext.flow_key || riskContext.flow_key);
  const microflowKey = safeText(
    meta.microflow_key || actionContext.microflow_key || riskContext.microflow_key
  );
  const assetKey = safeText(meta.asset_key || actionContext.asset_key || riskContext.asset_key);
  const assetFamilyKey = safeText(
    meta.asset_family_key || actionContext.asset_family_key || riskContext.asset_family_key
  );
  const assetBundleKind = safeText(
    meta.asset_bundle_kind || actionContext.asset_bundle_kind || riskContext.asset_bundle_kind
  );
  const assetVariantKey = safeText(
    meta.asset_variant_key || actionContext.asset_variant_key || riskContext.asset_variant_key
  );
  const assetVariantRole = safeText(
    meta.asset_variant_role || actionContext.asset_variant_role || riskContext.asset_variant_role
  );
  const assetVariantTier = safeText(
    meta.asset_variant_tier || actionContext.asset_variant_tier || riskContext.asset_variant_tier
  );
  const assetStateKey = safeText(
    meta.asset_state_key || actionContext.asset_state_key || riskContext.asset_state_key
  );
  const assetContractReadyRaw =
    meta.asset_contract_ready ?? actionContext.asset_contract_ready ?? riskContext.asset_contract_ready;
  const assetContractReady = typeof assetContractReadyRaw === "boolean" ? assetContractReadyRaw : undefined;
  const assetContractSignature = safeText(
    meta.asset_contract_signature ||
      actionContext.asset_contract_signature ||
      riskContext.asset_contract_signature
  );
  const assetFocusKey = safeText(
    meta.asset_focus_key || actionContext.asset_focus_key || riskContext.asset_focus_key
  );
  const riskHealthBandKey = safeText(
    meta.risk_health_band_key || actionContext.risk_health_band_key || riskContext.risk_health_band_key
  );
  const riskAttentionBandKey = safeText(
    meta.risk_attention_band_key ||
      actionContext.risk_attention_band_key ||
      riskContext.risk_attention_band_key
  );
  const riskTrendDirectionKey = safeText(
    meta.risk_trend_direction_key ||
      actionContext.risk_trend_direction_key ||
      riskContext.risk_trend_direction_key
  );
  const contractStateKey = safeText(
    meta.contract_state_key || actionContext.contract_state_key || riskContext.contract_state_key
  );
  const entryKindKey = safeText(meta.entry_kind_key || actionContext.entry_kind_key || riskContext.entry_kind_key);
  const sequenceKindKey = safeText(
    meta.sequence_kind_key || actionContext.sequence_kind_key || riskContext.sequence_kind_key
  );
  if (actionContextSignature) {
    article.dataset.actionContextSignature = actionContextSignature;
  }
  if (riskContextSignature) {
    article.dataset.riskContextSignature = riskContextSignature;
  }
  if (focusKey) {
    article.dataset.focusKey = focusKey;
  }
  if (riskKey) {
    article.dataset.riskKey = riskKey;
  }
  if (riskFocusKey) {
    article.dataset.riskFocusKey = riskFocusKey;
  }
  if (familyKey) {
    article.dataset.familyKey = familyKey;
  }
  if (flowKey) {
    article.dataset.flowKey = flowKey;
  }
  if (microflowKey) {
    article.dataset.microflowKey = microflowKey;
  }
  if (assetKey) {
    article.dataset.assetKey = assetKey;
  }
  if (assetFamilyKey) {
    article.dataset.assetFamilyKey = assetFamilyKey;
  }
  if (assetBundleKind) {
    article.dataset.assetBundleKind = assetBundleKind;
  }
  if (assetVariantKey) {
    article.dataset.assetVariantKey = assetVariantKey;
  }
  if (assetVariantRole) {
    article.dataset.assetVariantRole = assetVariantRole;
  }
  if (assetVariantTier) {
    article.dataset.assetVariantTier = assetVariantTier;
  }
  if (assetStateKey) {
    article.dataset.assetStateKey = assetStateKey;
  }
  if (typeof assetContractReady === "boolean") {
    article.dataset.assetContractReady = assetContractReady ? "true" : "false";
  }
  if (assetContractSignature) {
    article.dataset.assetContractSignature = assetContractSignature;
  }
  if (assetFocusKey) {
    article.dataset.assetFocusKey = assetFocusKey;
  }
  if (riskHealthBandKey) {
    article.dataset.riskHealthBandKey = riskHealthBandKey;
  }
  if (riskAttentionBandKey) {
    article.dataset.riskAttentionBandKey = riskAttentionBandKey;
  }
  if (riskTrendDirectionKey) {
    article.dataset.riskTrendDirectionKey = riskTrendDirectionKey;
  }
  if (contractStateKey) {
    article.dataset.contractStateKey = contractStateKey;
  }
  if (entryKindKey) {
    article.dataset.entryKindKey = entryKindKey;
  }
  if (sequenceKindKey) {
    article.dataset.sequenceKindKey = sequenceKindKey;
  }
}

function buildBridgeContextChips(meta: LoopBridgeMeta): string[] {
  const actionContext = meta.action_context ?? {};
  const riskContext = meta.risk_context ?? {};
  const chips: string[] = [];
  const pushChip = (label: string, value: unknown) => {
    const text = safeText(value);
    if (text) {
      chips.push(`${label} ${text}`);
    }
  };
  pushChip("FLOW", meta.flow_key || actionContext.flow_key || riskContext.flow_key);
  pushChip("ENTRY", meta.entry_kind_key || actionContext.entry_kind_key || riskContext.entry_kind_key);
  pushChip("SEQ", meta.sequence_kind_key || actionContext.sequence_kind_key || riskContext.sequence_kind_key);
  pushChip(
    "ASSET",
    meta.asset_focus_key || actionContext.asset_focus_key || riskContext.asset_focus_key
  );
  pushChip("VAR", meta.asset_variant_key || actionContext.asset_variant_key || riskContext.asset_variant_key);
  pushChip(
    "BUNDLE",
    meta.asset_bundle_kind || actionContext.asset_bundle_kind || riskContext.asset_bundle_kind
  );
  pushChip(
    "HB",
    meta.risk_health_band_key || actionContext.risk_health_band_key || riskContext.risk_health_band_key
  );
  pushChip(
    "ATTN",
    meta.risk_attention_band_key ||
      actionContext.risk_attention_band_key ||
      riskContext.risk_attention_band_key
  );
  pushChip(
    "TREND",
    meta.risk_trend_direction_key ||
      actionContext.risk_trend_direction_key ||
      riskContext.risk_trend_direction_key
  );
  pushChip("ACS", meta.action_context_signature || actionContext.action_context_signature);
  pushChip("RCS", meta.risk_context_signature || riskContext.risk_context_signature);
  return chips;
}

function renderBridgeContextRibbon(meta: LoopBridgeMeta): HTMLDivElement | null {
  const chips = buildBridgeContextChips(meta);
  if (!chips.length && typeof meta.contract_ready !== "boolean" && !meta.contract_state_key) {
    return null;
  }
  const container = document.createElement("div");
  container.className = "akrBridgeContextRibbon";
  const state = document.createElement("span");
  const contractReady = resolveBridgeContractReady(meta);
  state.className = `akrBridgeContextChip is-contract ${contractReady ? "is-ready" : "is-missing"}`;
  state.textContent = contractReady ? "READY" : "MISS";
  container.appendChild(state);
  chips.forEach((chipText) => {
    const chip = document.createElement("span");
    chip.className = "akrBridgeContextChip";
    chip.textContent = chipText;
    container.appendChild(chip);
  });
  return container;
}

function renderBridgeContractMeta(meta: LoopBridgeMeta): HTMLElement | null {
  const contractMissingKeys = Array.isArray(meta.contract_missing_keys)
    ? meta.contract_missing_keys.map((value) => safeText(value)).filter(Boolean)
    : [];
  if (!contractMissingKeys.length && typeof meta.contract_ready !== "boolean" && !meta.contract_state_key) {
    return null;
  }
  const line = document.createElement("p");
  line.className = "akrBridgeContractMeta";
  const contractReady = resolveBridgeContractReady(meta);
  const state = safeText(meta.contract_state_key, contractReady ? "ready" : "missing");
  line.textContent = contractMissingKeys.length
    ? `contract ${state} | miss ${contractMissingKeys.join(",")}`
    : `contract ${state}`;
  return line;
}

function hasBridgeMeta(meta: LoopBridgeMeta | null | undefined): boolean {
  if (!meta) {
    return false;
  }
  return Boolean(
    meta.contract_ready !== undefined ||
      (Array.isArray(meta.contract_missing_keys) && meta.contract_missing_keys.length) ||
      safeText(meta.action_context_signature) ||
      safeText(meta.risk_context_signature) ||
      safeText(meta.focus_key) ||
      safeText(meta.risk_key) ||
      safeText(meta.risk_focus_key) ||
      safeText(meta.family_key) ||
      safeText(meta.flow_key) ||
      safeText(meta.microflow_key) ||
      safeText(meta.asset_key) ||
      safeText(meta.asset_family_key) ||
      safeText(meta.asset_bundle_kind) ||
      safeText(meta.asset_variant_key) ||
      safeText(meta.asset_variant_role) ||
      safeText(meta.asset_variant_tier) ||
      safeText(meta.asset_state_key) ||
      safeText(meta.asset_contract_signature) ||
      safeText(meta.asset_focus_key) ||
      safeText(meta.risk_health_band_key) ||
      safeText(meta.risk_attention_band_key) ||
      safeText(meta.risk_trend_direction_key) ||
      safeText(meta.contract_state_key) ||
      safeText(meta.entry_kind_key) ||
      safeText(meta.sequence_kind_key) ||
      meta.action_context ||
      meta.risk_context
  );
}

export function resolveLoopBridgeMeta(
  ...collections: Array<Array<LoopBridgeMeta | null | undefined> | undefined>
): LoopBridgeMeta | null {
  for (const collection of collections) {
    if (!Array.isArray(collection)) {
      continue;
    }
    for (const item of collection) {
      if (hasBridgeMeta(item || null)) {
        return item || null;
      }
    }
  }
  return null;
}

export function applyLoopBridgeHostMeta(host: HTMLElement | null, meta: LoopBridgeMeta | null | undefined): void {
  if (!host) {
    return;
  }
  resetBridgeMeta(host);
  if (hasBridgeMeta(meta || null)) {
    applyBridgeMeta(host, meta || {});
  }
}

export function renderLoopBridgeCards(host: HTMLElement | null, cards: LoopBridgeCard[] | undefined): void {
  if (!host) {
    return;
  }
  host.innerHTML = "";
  const rows = Array.isArray(cards) ? cards.filter(Boolean).slice(0, 4) : [];
  if (!rows.length) {
    host.classList.add("hidden");
    return;
  }
  host.classList.remove("hidden");
  rows.forEach((card) => {
    const article = document.createElement("article");
    article.className = "akrBridgeFocusCard";
    article.dataset.tone = normalizeTone(card.tone);
    applyBridgeMeta(article, card);

    const title = document.createElement("span");
    title.textContent = safeText(card.title, "FLOW");

    const value = document.createElement("strong");
    value.textContent = safeText(card.value, "--");

    article.appendChild(title);
    article.appendChild(value);
    const ribbon = renderBridgeContextRibbon(card);
    if (ribbon) {
      article.appendChild(ribbon);
    }

    if (safeText(card.hint)) {
      const hint = document.createElement("em");
      hint.textContent = safeText(card.hint);
      article.appendChild(hint);
    }
    const contractMeta = renderBridgeContractMeta(card);
    if (contractMeta) {
      article.appendChild(contractMeta);
    }

    host.appendChild(article);
  });
}

export function renderLoopBridgeBlocks(host: HTMLElement | null, blocks: LoopBridgeBlock[] | undefined): void {
  if (!host) {
    return;
  }
  host.innerHTML = "";
  const rows = Array.isArray(blocks) ? blocks.filter(Boolean).slice(0, 3) : [];
  if (!rows.length) {
    host.classList.add("hidden");
    return;
  }
  host.classList.remove("hidden");
  rows.forEach((block) => {
    const article = document.createElement("article");
    article.className = "akrBridgeFlowBlock";
    article.dataset.tone = normalizeTone(block.tone);
    applyBridgeMeta(article, block);

    const title = document.createElement("span");
    title.textContent = safeText(block.title, "FLOW");

    const summary = document.createElement("strong");
    summary.textContent = safeText(block.summary, "--");

    const gate = document.createElement("p");
    gate.textContent = safeText(block.gate, "--");

    article.appendChild(title);
    article.appendChild(summary);
    article.appendChild(gate);
    const ribbon = renderBridgeContextRibbon(block);
    if (ribbon) {
      article.appendChild(ribbon);
    }

    if (safeText(block.hint)) {
      const hint = document.createElement("em");
      hint.textContent = safeText(block.hint);
      article.appendChild(hint);
    }
    const contractMeta = renderBridgeContractMeta(block);
    if (contractMeta) {
      article.appendChild(contractMeta);
    }

    host.appendChild(article);
  });
}

export function renderLoopBridgePanels(host: HTMLElement | null, panels: LoopBridgePanel[] | undefined): void {
  if (!host) {
    return;
  }
  host.innerHTML = "";
  const rows = Array.isArray(panels) ? panels.filter(Boolean).slice(0, 3) : [];
  if (!rows.length) {
    host.classList.add("hidden");
    return;
  }
  host.classList.remove("hidden");
  rows.forEach((panel) => {
    const article = document.createElement("article");
    article.className = "akrBridgeFlowPanel";
    article.dataset.tone = normalizeTone(panel.tone);
    applyBridgeMeta(article, panel);

    const title = document.createElement("span");
    title.textContent = safeText(panel.title, "FLOW");
    article.appendChild(title);

    const list = document.createElement("ul");
    list.className = "akrBridgeFlowPanelList";
    const lines = Array.isArray(panel.lines) ? panel.lines.filter(Boolean).slice(0, 7) : [];
    lines.forEach((lineText) => {
      const item = document.createElement("li");
      item.textContent = safeText(lineText, "--");
      list.appendChild(item);
    });
    article.appendChild(list);
    const ribbon = renderBridgeContextRibbon(panel);
    if (ribbon) {
      article.appendChild(ribbon);
    }

    if (safeText(panel.hint)) {
      const hint = document.createElement("em");
      hint.textContent = safeText(panel.hint);
      article.appendChild(hint);
    }
    const contractMeta = renderBridgeContractMeta(panel);
    if (contractMeta) {
      article.appendChild(contractMeta);
    }

    host.appendChild(article);
  });
}
