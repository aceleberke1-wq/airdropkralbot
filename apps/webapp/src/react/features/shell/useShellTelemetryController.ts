import { useCallback, useEffect, useMemo, useRef } from "react";
import { buildRouteKey, buildUiEventRecord, UI_EVENT_KEY, UI_FUNNEL_KEY, UI_SURFACE_KEY } from "../../../core/telemetry/uiEventTaxonomy";
import { createUiAnalyticsClient, type UiAnalyticsClient } from "../../analytics";
import { normalizeLang, type Lang } from "../../i18n";
import type { AnalyticsConfig, LaunchContext, TabKey, WebAppAuth } from "../../types";

type ShellTelemetryControllerOptions = {
  activeAuth: WebAppAuth;
  lang: Lang;
  tab: TabKey;
  workspace: "player" | "admin";
  data: Record<string, any> | null | undefined;
  launchContext?: LaunchContext | null;
};

function resolveAnalyticsConfig(raw: unknown): AnalyticsConfig | null {
  const row = raw && typeof raw === "object" ? (raw as Partial<AnalyticsConfig>) : null;
  const sessionRef = String(row?.session_ref || "").trim();
  if (!sessionRef) return null;
  return {
    session_ref: sessionRef,
    flush_interval_ms: Math.max(1000, Number(row?.flush_interval_ms || 6000)),
    max_batch_size: Math.max(1, Number(row?.max_batch_size || 40)),
    sample_rate: Math.max(0, Math.min(1, Number(row?.sample_rate || 1)))
  };
}

export function useShellTelemetryController(options: ShellTelemetryControllerOptions) {
  const analyticsRef = useRef<UiAnalyticsClient | null>(null);
  const telemetryTabKey = options.workspace === "admin" ? "admin" : options.tab;
  const telemetryRouteKey = useMemo(
    () => buildRouteKey(options.workspace, telemetryTabKey),
    [options.workspace, telemetryTabKey]
  );

  const trackUiEvent = useCallback(
    (row: Record<string, unknown>) => {
      if (!analyticsRef.current) return;
      const rawPayload = row.payload_json && typeof row.payload_json === "object" ? (row.payload_json as Record<string, unknown>) : {};
      const launchEventKey = String(options.launchContext?.launch_event_key || "").trim();
      analyticsRef.current.track(
        buildUiEventRecord({
          tab_key: telemetryTabKey,
          route_key: telemetryRouteKey,
          ...row,
          payload_json: launchEventKey
            ? {
                ...rawPayload,
                launch_event_key: launchEventKey
              }
            : rawPayload,
        })
      );
    },
    [options.launchContext?.launch_event_key, telemetryTabKey, telemetryRouteKey]
  );

  useEffect(() => {
    if (!options.data) return;
    const cfg = resolveAnalyticsConfig(options.data.analytics);
    if (!cfg) return;
    const client = createUiAnalyticsClient({
      auth: options.activeAuth,
      config: cfg,
      language: normalizeLang(options.lang),
      variantKey: options.data.experiment?.variant === "treatment" ? "treatment" : "control",
      experimentKey: String(options.data.experiment?.key || "webapp_react_v1"),
      cohortBucket: Number(options.data.experiment?.cohort_bucket || 0),
      tabKey: telemetryTabKey,
      routeKey: telemetryRouteKey
    });
    analyticsRef.current = client;
    client.track(
      buildUiEventRecord({
        event_key: UI_EVENT_KEY.SHELL_OPEN,
        panel_key: UI_SURFACE_KEY.SHELL,
        funnel_key: options.workspace === "admin" ? UI_FUNNEL_KEY.ADMIN_OPS : UI_FUNNEL_KEY.PLAYER_LOOP,
        surface_key: UI_SURFACE_KEY.SHELL,
        payload_json: {
          workspace: options.workspace,
          tab: options.tab,
          ui_version: String(options.data?.ui_shell?.ui_version || "react_v1"),
          launch_event_key: String(options.launchContext?.launch_event_key || "")
        },
        event_value: 1
      })
    );
    return () => client.dispose();
  }, [options.activeAuth.uid, options.activeAuth.ts, options.activeAuth.sig, options.data, options.launchContext?.launch_event_key]);

  useEffect(() => {
    if (!analyticsRef.current) return;
    analyticsRef.current.setContext({
      language: normalizeLang(options.lang),
      tabKey: telemetryTabKey,
      routeKey: telemetryRouteKey
    });
  }, [options.lang, telemetryTabKey, telemetryRouteKey]);

  return {
    trackUiEvent
  };
}
