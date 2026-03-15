import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { fetchBootstrapV2, readWebAppAuth } from "./api";
import { normalizeLang } from "./i18n";
import { ReactWebAppV1 } from "./App";
import { appStore } from "./redux/store";
import * as navigationContract from "../core/shared/navigationContract.js";

const { decodeStartAppPayload, resolveLaunchTarget } = navigationContract;
const BOOTSTRAP_FETCH_TIMEOUT_MS = 25000;

type FatalBoundaryProps = {
  children: React.ReactNode;
};

type FatalBoundaryState = {
  errorMessage: string;
  errorStack: string;
  componentStack: string;
};

class FatalBoundary extends React.Component<FatalBoundaryProps, FatalBoundaryState> {
  state: FatalBoundaryState = {
    errorMessage: "",
    errorStack: "",
    componentStack: ""
  };

  static getDerivedStateFromError(error: unknown): FatalBoundaryState {
    return {
      errorMessage: error instanceof Error ? error.message : "react_runtime_unknown_error",
      errorStack: error instanceof Error ? String(error.stack || "") : "",
      componentStack: ""
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error("[webapp-runtime-boundary]", error, info);
    this.setState({
      errorStack: error instanceof Error ? String(error.stack || "") : "",
      componentStack: String(info?.componentStack || "")
    });
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
            {this.state.componentStack ? (
              <pre
                style={{
                  margin: "0 0 14px",
                  padding: 12,
                  borderRadius: 10,
                  background: "rgba(3,9,18,.88)",
                  color: "#8fb7ff",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 12,
                  lineHeight: 1.45,
                  whiteSpace: "pre-wrap"
                }}
              >
                {this.state.componentStack}
              </pre>
            ) : null}
            {this.state.errorStack ? (
              <details style={{ margin: "0 0 14px", opacity: 0.92 }}>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>Stack</summary>
                <pre
                  style={{
                    margin: "10px 0 0",
                    padding: 12,
                    borderRadius: 10,
                    background: "rgba(3,9,18,.88)",
                    color: "#8fb7ff",
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 12,
                    lineHeight: 1.45,
                    whiteSpace: "pre-wrap"
                  }}
                >
                  {this.state.errorStack}
                </pre>
              </details>
            ) : null}
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
    <style>
      @keyframes akrPulse { 0%,100%{opacity:.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.08)} }
      @keyframes akrGlow { 0%{box-shadow:0 0 20px rgba(56,208,255,.15)} 50%{box-shadow:0 0 40px rgba(56,208,255,.35)} 100%{box-shadow:0 0 20px rgba(56,208,255,.15)} }
      @keyframes akrFadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    </style>
    <section style="min-height:100vh;display:grid;place-items:center;background:linear-gradient(160deg,#030918 0%,#0a1628 40%,#0f1d35 100%);color:#e7edf7;font-family:'Space Grotesk',sans-serif;padding:24px;">
      <div style="max-width:480px;border:1px solid rgba(132,180,255,.2);background:rgba(8,16,30,.82);backdrop-filter:blur(16px);padding:32px;border-radius:20px;text-align:center;animation:akrFadeIn .5s ease-out,akrGlow 3s ease-in-out infinite;">
        <div style="font-size:48px;margin-bottom:16px;animation:akrPulse 2s ease-in-out infinite;">🏰</div>
        <h1 style="margin:0 0 8px;font-size:22px;background:linear-gradient(135deg,#38d0ff,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">AirdropKral Arena</h1>
        <p style="margin:0 0 20px;opacity:.7;font-size:13px;line-height:1.5;">${message}</p>
        <button id="akr-retry-btn" style="border:0;border-radius:12px;padding:12px 28px;background:linear-gradient(135deg,#38d0ff,#6366f1);color:#fff;font-weight:700;font-size:14px;cursor:pointer;transition:transform .15s,box-shadow .15s;box-shadow:0 4px 20px rgba(56,208,255,.3);">
          🔄 Yeniden Dene
        </button>
      </div>
    </section>
  `;
  const retry = document.getElementById("akr-retry-btn");
  if (retry) {
    retry.addEventListener("click", () => window.location.reload());
    retry.addEventListener("mouseenter", () => { retry.style.transform = "scale(1.05)"; });
    retry.addEventListener("mouseleave", () => { retry.style.transform = "scale(1)"; });
  }
}

function mountPending(message: string): void {
  const rootNode = ensureRootNode();
  rootNode.innerHTML = `
    <style>
      @keyframes akrSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      @keyframes akrPulse { 0%,100%{opacity:.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.08)} }
      @keyframes akrFadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    </style>
    <section style="min-height:100vh;display:grid;place-items:center;background:linear-gradient(160deg,#030918 0%,#0a1628 40%,#0f1d35 100%);color:#e7edf7;font-family:'Space Grotesk',sans-serif;padding:24px;">
      <div style="max-width:480px;border:1px solid rgba(132,180,255,.15);background:rgba(8,16,30,.65);backdrop-filter:blur(16px);padding:32px;border-radius:20px;text-align:center;animation:akrFadeIn .5s ease-out;">
        <div style="font-size:48px;margin-bottom:16px;animation:akrPulse 2s ease-in-out infinite;">🏰</div>
        <h1 style="margin:0 0 8px;font-size:22px;background:linear-gradient(135deg,#38d0ff,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">AirdropKral Arena</h1>
        <p style="margin:0 0 16px;opacity:.7;font-size:13px;line-height:1.5;">${message}</p>
        <div style="width:32px;height:32px;margin:0 auto;border:3px solid rgba(56,208,255,.2);border-top-color:#38d0ff;border-radius:50%;animation:akrSpin .8s linear infinite;"></div>
      </div>
    </section>
  `;
}

async function fetchBootstrapWithTimeout(auth: Parameters<typeof fetchBootstrapV2>[0], language: NonNullable<Parameters<typeof fetchBootstrapV2>[1]>) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort("bootstrap_timeout"), BOOTSTRAP_FETCH_TIMEOUT_MS);
  try {
    return await fetchBootstrapV2(auth, language, { signal: controller.signal });
  } catch (err) {
    const isAbort =
      Boolean(err) &&
      typeof err === "object" &&
      (String((err as { name?: string }).name || "") === "AbortError" ||
        String((err as { message?: string }).message || "").toLowerCase().includes("abort"));
    if (isAbort) {
      return {
        success: false,
        error: "bootstrap_timeout"
      };
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
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
  mountPending("Connecting to live runtime...");
  const payload = await fetchBootstrapWithTimeout(auth, language).catch((err) => {
    const message = err instanceof Error ? err.message : String(err || "bootstrap_failed");
    mountFatal(`Bootstrap failed before response: ${message}`);
    return null;
  });
  if (!payload?.success || !payload?.data) {
    const errorCode = String(payload?.error || "bootstrap_failed");
    if (errorCode === "bootstrap_timeout") {
      mountFatal("Bootstrap timed out while waiting for live runtime. Please retry.");
      return;
    }
    mountFatal(`Bootstrap failed: ${errorCode}`);
    return;
  }
  const launchContext = resolveLaunchContext(window.location.search);
  const prefs = payload.data.ui_prefs && typeof payload.data.ui_prefs === "object" ? payload.data.ui_prefs : {};
  const prefsJson = prefs.prefs_json && typeof prefs.prefs_json === "object" ? prefs.prefs_json : {};
  const launchedWorkspace = launchContext.workspace === "admin" ? "admin" : "player";
  const launchedAdvancedView =
    launchedWorkspace === "admin"
      ? typeof prefsJson.advanced_view === "boolean"
        ? Boolean(prefsJson.advanced_view)
        : Boolean(payload.data?.ux?.advanced_enabled)
      : false;
  payload.data = {
    ...payload.data,
    launch_context: launchContext,
    ui_prefs: {
      ...prefs,
      prefs_json: {
        ...prefsJson,
        last_tab: launchContext.tab || prefsJson.last_tab || "home",
        workspace: launchedWorkspace,
        advanced_view: launchedAdvancedView
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
