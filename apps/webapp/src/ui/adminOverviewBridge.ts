type BadgeTone = "info" | "warn" | "default";

type AdminOverviewFormValues = {
  tokenPrice: string;
  gateMin: string;
  gateMax: string;
  curveEnabled: string;
  curveFloor: string;
  curveBase: string;
  curveK: string;
  curveDemand: string;
  curveDivisor: string;
  autoPolicyEnabled: string;
  autoUsdLimit: string;
  autoRisk: string;
  autoVelocity: string;
};

export type AdminOverviewBridgePayload = {
  badgeText: string;
  badgeTone: BadgeTone;
  metaText: string;
  tokenCapText: string;
  metricsText: string;
  queueText: string;
  form: AdminOverviewFormValues;
};

type AdminOverviewBridge = {
  render: (payload: AdminOverviewBridgePayload) => boolean;
};

declare global {
  interface Window {
    __AKR_ADMIN_OVERVIEW__?: AdminOverviewBridge;
  }
}

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function setBadgeClass(node: HTMLElement | null, tone: BadgeTone): void {
  if (!node) return;
  if (tone === "warn") {
    node.className = "badge warn";
    return;
  }
  if (tone === "info") {
    node.className = "badge info";
    return;
  }
  node.className = "badge";
}

function setText(id: string, text: string): void {
  const node = byId<HTMLElement>(id);
  if (!node) return;
  node.textContent = text;
}

function setInputValue(id: string, value: string): void {
  const node = byId<HTMLInputElement | HTMLSelectElement>(id);
  if (!node) return;
  node.value = value;
}

function render(payload: AdminOverviewBridgePayload): boolean {
  const badge = byId<HTMLElement>("adminBadge");
  if (!badge) {
    return false;
  }

  badge.textContent = String(payload.badgeText || "ADMIN");
  setBadgeClass(badge, payload.badgeTone || "info");

  setText("adminMeta", String(payload.metaText || ""));
  setText("adminTokenCap", String(payload.tokenCapText || ""));
  setText("adminMetrics", String(payload.metricsText || ""));
  setText("adminQueue", String(payload.queueText || ""));

  const form = payload.form || ({} as AdminOverviewFormValues);
  setInputValue("adminTokenPriceInput", String(form.tokenPrice || ""));
  setInputValue("adminTokenGateMinInput", String(form.gateMin || ""));
  setInputValue("adminTokenGateMaxInput", String(form.gateMax || ""));
  setInputValue("adminCurveEnabledInput", String(form.curveEnabled || ""));
  setInputValue("adminCurveFloorInput", String(form.curveFloor || ""));
  setInputValue("adminCurveBaseInput", String(form.curveBase || ""));
  setInputValue("adminCurveKInput", String(form.curveK || ""));
  setInputValue("adminCurveDemandInput", String(form.curveDemand || ""));
  setInputValue("adminCurveDivisorInput", String(form.curveDivisor || ""));
  setInputValue("adminAutoPolicyEnabledInput", String(form.autoPolicyEnabled || ""));
  setInputValue("adminAutoUsdLimitInput", String(form.autoUsdLimit || ""));
  setInputValue("adminAutoRiskInput", String(form.autoRisk || ""));
  setInputValue("adminAutoVelocityInput", String(form.autoVelocity || ""));

  return true;
}

export function installAdminOverviewBridge(): void {
  window.__AKR_ADMIN_OVERVIEW__ = { render };
}
