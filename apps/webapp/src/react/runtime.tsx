import React from "react";
import { createRoot } from "react-dom/client";
import { fetchBootstrapV2, readWebAppAuth } from "./api";
import { normalizeLang } from "./i18n";
import { ReactWebAppV1 } from "./App";

function resolveUiModeOverride(search = window.location.search): string {
  const qs = new URLSearchParams(search);
  return String(qs.get("ui") || "")
    .trim()
    .toLowerCase();
}

function shouldEnableReactByPayload(payload: any): boolean {
  const runtimeFlags = payload?.data?.runtime_flags_effective || payload?.data?.feature_flags || {};
  const reactEnabled = Boolean(runtimeFlags?.WEBAPP_REACT_V1_ENABLED);
  const variant = String(payload?.data?.experiment?.variant || "control").toLowerCase();
  return reactEnabled && variant === "treatment";
}

export async function mountReactWebAppV1(): Promise<boolean> {
  const auth = readWebAppAuth();
  if (!auth) {
    return false;
  }

  const override = resolveUiModeOverride();
  if (override === "legacy") {
    return false;
  }

  let payload: any = null;
  try {
    payload = await fetchBootstrapV2(auth, normalizeLang(new URLSearchParams(window.location.search).get("lang") || "tr"));
  } catch {
    return false;
  }
  if (!payload?.success || !payload?.data) {
    return false;
  }

  const forceReact = override === "react";
  const enabled = forceReact || shouldEnableReactByPayload(payload);
  if (!enabled) {
    return false;
  }

  document.body.classList.add("akrReactModeBody");
  document.body.innerHTML = "";
  const rootNode = document.createElement("div");
  rootNode.id = "akr-react-root";
  document.body.appendChild(rootNode);

  const root = createRoot(rootNode);
  root.render(<ReactWebAppV1 auth={auth} bootstrap={payload} />);
  return true;
}
