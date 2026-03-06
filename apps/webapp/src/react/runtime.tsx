import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { fetchBootstrapV2, readWebAppAuth } from "./api";
import { normalizeLang } from "./i18n";
import { ReactWebAppV1 } from "./App";
import { appStore } from "./redux/store";

function ensureRootNode(): HTMLElement {
  const existing = document.getElementById("akr-react-root");
  if (existing) {
    return existing;
  }
  const rootNode = document.createElement("div");
  rootNode.id = "akr-react-root";
  document.body.innerHTML = "";
  document.body.appendChild(rootNode);
  return rootNode;
}

function mountFatal(message: string): void {
  const rootNode = ensureRootNode();
  rootNode.innerHTML = `
    <section style="min-height:100vh;display:grid;place-items:center;background:#070b14;color:#e7edf7;font-family:'Space Grotesk',sans-serif;padding:24px;">
      <div style="max-width:640px;border:1px solid rgba(132,180,255,.25);background:rgba(8,16,30,.78);padding:20px;border-radius:14px;">
        <h1 style="margin:0 0 8px;font-size:24px;">React Runtime Boot Failed</h1>
        <p style="margin:0 0 14px;opacity:.9;line-height:1.5;">${message}</p>
        <button id="akr-retry-btn" style="border:0;border-radius:10px;padding:10px 14px;background:#38d0ff;color:#041320;font-weight:700;cursor:pointer;">Retry</button>
      </div>
    </section>
  `;
  const retry = document.getElementById("akr-retry-btn");
  if (retry) {
    retry.addEventListener("click", () => window.location.reload());
  }
}

export async function mountReactWebAppV1(): Promise<void> {
  document.body.classList.add("akrReactModeBody");
  const auth = readWebAppAuth();
  if (!auth) {
    mountFatal("Missing Telegram auth query. Expected uid, ts, sig.");
    return;
  }
  const language = normalizeLang(new URLSearchParams(window.location.search).get("lang") || "tr");
  const payload = await fetchBootstrapV2(auth, language).catch(() => null);
  if (!payload?.success || !payload?.data) {
    mountFatal(`Bootstrap failed: ${String(payload?.error || "bootstrap_failed")}`);
    return;
  }
  const root = createRoot(ensureRootNode());
  root.render(
    <Provider store={appStore}>
      <ReactWebAppV1 auth={auth} bootstrap={payload} />
    </Provider>
  );
}
