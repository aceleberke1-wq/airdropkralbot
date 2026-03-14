import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { fetchBootstrapV2, readWebAppAuth } from "./api";
import { normalizeLang } from "./i18n";
import { ReactWebAppV1 } from "./App";
import { appStore } from "./redux/store";
import * as navigationContract from "../core/shared/navigationContract.js";

const { decodeStartAppPayload, resolveLaunchTarget } = navigationContract;

type FatalBoundaryProps = {
  children: React.ReactNode;
};

type FatalBoundaryState = {
  errorMessage: string;
};

class FatalBoundary extends React.Component<FatalBoundaryProps, FatalBoundaryState> {
  state: FatalBoundaryState = {
    errorMessage: ""
  };

  static getDerivedStateFromError(error: unknown): FatalBoundaryState {
    return {
      errorMessage: error instanceof Error ? error.message : "react_runtime_unknown_error"
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error("[webapp-runtime-boundary]", error, info);
  }

  render() {
    if (this.state.errorMessage) {
      return (
        <section
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            background: "#070b14",
            color: "#e7edf7",
            fontFamily: "'Space Grotesk', sans-serif",
            padding: 24
          }}
        >
          <div
            style={{
              maxWidth: 640,
              border: "1px solid rgba(132,180,255,.25)",
              background: "rgba(8,16,30,.78)",
              padding: 20,
              borderRadius: 14
            }}
          >
            <h1 style={{ margin: "0 0 8px", fontSize: 24 }}>React Runtime Render Failed</h1>
            <p style={{ margin: "0 0 14px", opacity: 0.9, lineHeight: 1.5 }}>{this.state.errorMessage}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                border: 0,
                borderRadius: 10,
                padding: "10px 14px",
                background: "#38d0ff",
                color: "#041320",
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              Retry
            </button>
          </div>
        </section>
      );
    }
    return this.props.children;
  }
}

function resolveLaunchContext(search: string) {
  const qs = new URLSearchParams(search);
  const startapp = String(qs.get("startapp") || "").trim();
  const decoded = startapp ? decodeStartAppPayload(startapp) : null;
  const launchEventKey = String(qs.get("launch_event_key") || "").trim();
  const shellActionKey = String(qs.get("shell_action_key") || "").trim();
  const target = resolveLaunchTarget({
    routeKey: String(qs.get("route_key") || decoded?.route_key || "").trim(),
    panelKey: String(qs.get("panel_key") || decoded?.panel_key || "").trim(),
    focusKey: String(qs.get("focus_key") || decoded?.focus_key || "").trim()
  });
  return {
    ...target,
    launch_event_key: launchEventKey,
    shell_action_key: shellActionKey
  };
}

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
  window.addEventListener("error", (event) => {
    const message = event?.error instanceof Error ? event.error.message : String(event?.message || "window_error");
    mountFatal(`Unhandled error: ${message}`);
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason;
    const message = reason instanceof Error ? reason.message : String(reason || "unhandled_promise_rejection");
    mountFatal(`Unhandled rejection: ${message}`);
  });
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
  const launchContext = resolveLaunchContext(window.location.search);
  const prefs = payload.data.ui_prefs && typeof payload.data.ui_prefs === "object" ? payload.data.ui_prefs : {};
  const prefsJson = prefs.prefs_json && typeof prefs.prefs_json === "object" ? prefs.prefs_json : {};
  payload.data = {
    ...payload.data,
    launch_context: launchContext,
    ui_prefs: {
      ...prefs,
      prefs_json: {
        ...prefsJson,
        last_tab: launchContext.tab || prefsJson.last_tab || "home",
        workspace: launchContext.workspace || prefsJson.workspace || "player"
      }
    }
  };
  const root = createRoot(ensureRootNode());
  root.render(
    <FatalBoundary>
      <Provider store={appStore}>
        <ReactWebAppV1 auth={auth} bootstrap={payload} />
      </Provider>
    </FatalBoundary>
  );
}
