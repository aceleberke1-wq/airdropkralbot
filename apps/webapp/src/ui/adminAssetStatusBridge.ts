type RowPayload = {
  title: string;
  meta: string;
  chip: string;
  tone: "ready" | "missing";
};

type AssetStatusBridgePayload = {
  summaryLineText: string;
  revisionLineText: string;
  rows: RowPayload[];
  emptyText?: string;
};

type AdminAssetStatusBridge = {
  render: (payload: AssetStatusBridgePayload) => boolean;
};

declare global {
  interface Window {
    __AKR_ADMIN_ASSET_STATUS__?: AdminAssetStatusBridge;
  }
}

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function render(payload: AssetStatusBridgePayload): boolean {
  const summaryLine = byId<HTMLElement>("adminAssetSummary");
  const revisionLine = byId<HTMLElement>("adminManifestRevision");
  const list = byId<HTMLElement>("adminAssetList");
  if (!summaryLine || !revisionLine || !list) {
    return false;
  }
  summaryLine.textContent = String(payload.summaryLineText || "Assets: ready 0/0 | missing 0");
  revisionLine.textContent = String(payload.revisionLineText || "Manifest: local | updated -");
  list.innerHTML = "";
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  if (rows.length === 0) {
    const empty = document.createElement("li");
    empty.className = "muted";
    empty.textContent = payload.emptyText || "Asset kaydi bulunmuyor";
    list.appendChild(empty);
    return true;
  }
  rows.forEach((row) => {
    const item = document.createElement("li");
    item.className = `adminAssetRow ${row.tone === "ready" ? "ready" : "missing"}`;

    const body = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = String(row.title || "asset");
    const meta = document.createElement("p");
    meta.className = "adminAssetMeta";
    meta.textContent = String(row.meta || "-");
    body.appendChild(title);
    body.appendChild(meta);

    const stateChip = document.createElement("span");
    stateChip.className = `adminAssetState ${row.tone === "ready" ? "ready" : "missing"}`;
    stateChip.textContent = String(row.chip || (row.tone === "ready" ? "READY" : "MISSING"));

    item.appendChild(body);
    item.appendChild(stateChip);
    list.appendChild(item);
  });
  return true;
}

export function installAdminAssetStatusBridge(): void {
  window.__AKR_ADMIN_ASSET_STATUS__ = { render };
}
