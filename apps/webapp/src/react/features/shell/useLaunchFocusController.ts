import { useEffect, useMemo, useRef } from "react";
import type { LaunchContext, TabKey, WorkspaceKey } from "../../types";

type LaunchFocusOptions = {
  launchContext: LaunchContext | null;
  workspace: WorkspaceKey;
  tab: TabKey;
  reducedMotion: boolean;
  requestKey?: string | number;
  enableFocus?: boolean;
};

function sanitizeKey(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function escapeSelectorValue(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, "\\$&");
}

function humanizeKey(value: unknown): string {
  const key = sanitizeKey(value);
  if (!key) return "";
  return key
    .split(/[_:-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function useLaunchFocusController(options: LaunchFocusOptions) {
  const appliedRef = useRef("");

  const launchSummary = useMemo(() => {
    const launchContext = options.launchContext;
    if (!launchContext) {
      return null;
    }
    const routeKey = sanitizeKey(launchContext.route_key);
    const panelKey = sanitizeKey(launchContext.panel_key);
    const focusKey = sanitizeKey(launchContext.focus_key);
    const workspace = sanitizeKey(launchContext.workspace || options.workspace);
    const tab = sanitizeKey(launchContext.tab || options.tab);
    if (!routeKey && !panelKey && !focusKey) {
      return null;
    }
    return {
      routeKey,
      panelKey,
      focusKey,
      workspace,
      tab,
      routeLabel: humanizeKey(routeKey),
      panelLabel: humanizeKey(panelKey),
      focusLabel: humanizeKey(focusKey)
    };
  }, [options.launchContext, options.workspace, options.tab]);

  useEffect(() => {
    if (options.enableFocus === false) {
      return;
    }
    if (!launchSummary) {
      return;
    }
    if (launchSummary.workspace && launchSummary.workspace !== sanitizeKey(options.workspace)) {
      return;
    }
    if (launchSummary.tab && launchSummary.tab !== sanitizeKey(options.tab)) {
      return;
    }

    const token = `${String(options.requestKey || "")}:${launchSummary.workspace}:${launchSummary.tab}:${launchSummary.panelKey}:${launchSummary.focusKey}`;
    if (!launchSummary.panelKey && !launchSummary.focusKey) {
      return;
    }
    if (appliedRef.current === token) {
      return;
    }

    const candidates = [];
    if (launchSummary.focusKey) {
      candidates.push(`[data-akr-focus-key="${escapeSelectorValue(launchSummary.focusKey)}"]`);
    }
    if (launchSummary.panelKey) {
      candidates.push(`[data-akr-panel-key="${escapeSelectorValue(launchSummary.panelKey)}"]`);
    }

    const target = candidates
      .map((selector) => document.querySelector(selector))
      .find((node): node is HTMLElement => node instanceof HTMLElement);

    if (!target) {
      return;
    }

    appliedRef.current = token;
    target.classList.add("isLaunchFocus");
    target.scrollIntoView({
      behavior: options.reducedMotion ? "auto" : "smooth",
      block: "start",
      inline: "nearest"
    });
    const timeoutId = window.setTimeout(() => {
      target.classList.remove("isLaunchFocus");
    }, 2600);
    return () => {
      window.clearTimeout(timeoutId);
      target.classList.remove("isLaunchFocus");
    };
  }, [launchSummary, options.workspace, options.tab, options.reducedMotion, options.requestKey, options.enableFocus]);

  return {
    launchSummary
  };
}
