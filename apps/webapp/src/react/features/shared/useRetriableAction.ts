import { useCallback } from "react";
import { runMutationWithBackoff } from "../../../core/player/mutationPolicy";
import { UI_EVENT_KEY, UI_FUNNEL_KEY, UI_SURFACE_KEY } from "../../../core/telemetry/uiEventTaxonomy";
import type { WebAppApiResponse } from "../../types";

export type RetriableActionTelemetry = {
  panelKey?: string;
  funnelKey?: string;
  surfaceKey?: string;
  economyEventKey?: string;
  txState?: string;
  actionKey?: string;
};

export type RunRetriableApiCall = (
  runner: (attempt: number) => Promise<any>,
  fallback: string,
  options?: {
    maxAttempts?: number;
    baseDelayMs?: number;
    telemetry?: RetriableActionTelemetry;
  }
) => Promise<WebAppApiResponse | null>;

type UseRetriableActionOptions = {
  trackUiEvent: (payload: Record<string, unknown>) => void;
  setError: (next: string) => void;
  applySession: (payload: any) => void;
  asError: (payload: WebAppApiResponse | null | undefined, fallback?: string) => string;
};

export function useRetriableAction(options: UseRetriableActionOptions) {
  const runRetriableApiCall: RunRetriableApiCall = useCallback(
    async (
      runner,
      fallback,
      config = {}
    ) => {
      options.setError("");
      const telemetry = config.telemetry || {};
      options.trackUiEvent({
        event_key: UI_EVENT_KEY.ACTION_REQUEST,
        panel_key: telemetry.panelKey || UI_SURFACE_KEY.SHELL,
        funnel_key: telemetry.funnelKey || UI_FUNNEL_KEY.PLAYER_LOOP,
        surface_key: telemetry.surfaceKey || UI_SURFACE_KEY.SHELL,
        economy_event_key: telemetry.economyEventKey || "",
        tx_state: telemetry.txState || "",
        payload_json: {
          action_key: telemetry.actionKey || fallback,
          fallback
        }
      });
      const outcome = await runMutationWithBackoff(
        async (attemptNo) => runner(Number(attemptNo || 1)),
        {
          maxAttempts: config.maxAttempts || 3,
          baseDelayMs: config.baseDelayMs || 220,
          jitterMs: 90,
          maxDelayMs: 1500,
          onRetry: ({ attempt, error }) => {
            options.trackUiEvent({
              event_key: UI_EVENT_KEY.ACTION_RETRY,
              panel_key: telemetry.panelKey || UI_SURFACE_KEY.SHELL,
              funnel_key: telemetry.funnelKey || UI_FUNNEL_KEY.PLAYER_LOOP,
              surface_key: telemetry.surfaceKey || UI_SURFACE_KEY.SHELL,
              economy_event_key: telemetry.economyEventKey || "",
              tx_state: telemetry.txState || "retrying",
              event_value: Number(attempt || 0),
              payload_json: {
                action_key: telemetry.actionKey || fallback,
                error_code: String(error?.code || "")
              }
            });
          }
        }
      );
      const payload = (outcome.payload || null) as WebAppApiResponse | null;
      options.applySession(payload);
      if (!outcome.ok || !payload?.success) {
        const code = String(outcome.error?.code || "").trim().toLowerCase();
        options.setError(options.asError(payload, code || fallback));
        options.trackUiEvent({
          event_key: UI_EVENT_KEY.ACTION_FAILED,
          panel_key: telemetry.panelKey || UI_SURFACE_KEY.SHELL,
          funnel_key: telemetry.funnelKey || UI_FUNNEL_KEY.PLAYER_LOOP,
          surface_key: telemetry.surfaceKey || UI_SURFACE_KEY.SHELL,
          economy_event_key: telemetry.economyEventKey || "",
          tx_state: telemetry.txState || "failed",
          event_value: Number(outcome.attempts || 0),
          payload_json: {
            action_key: telemetry.actionKey || fallback,
            error_code: code || fallback,
            status: Number(outcome.error?.status || 0)
          }
        });
        return null;
      }
      options.trackUiEvent({
        event_key: UI_EVENT_KEY.ACTION_SUCCESS,
        panel_key: telemetry.panelKey || UI_SURFACE_KEY.SHELL,
        funnel_key: telemetry.funnelKey || UI_FUNNEL_KEY.PLAYER_LOOP,
        surface_key: telemetry.surfaceKey || UI_SURFACE_KEY.SHELL,
        economy_event_key: telemetry.economyEventKey || "",
        tx_state: telemetry.txState || "ok",
        event_value: Number(outcome.attempts || 1),
        payload_json: {
          action_key: telemetry.actionKey || fallback,
          attempts: Number(outcome.attempts || 1)
        }
      });
      return payload;
    },
    [options]
  );

  return {
    runRetriableApiCall
  };
}
