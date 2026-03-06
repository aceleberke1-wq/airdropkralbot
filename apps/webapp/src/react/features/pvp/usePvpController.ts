import { useCallback } from "react";
import type { WebAppAuth } from "../../types";
import { buildActionRequestId } from "../../api";
import { UI_FUNNEL_KEY, UI_SURFACE_KEY } from "../../../core/telemetry/uiEventTaxonomy";
import type { RunRetriableApiCall } from "../shared/useRetriableAction";

type PvpSessionMachineLike = {
  session_ref?: string;
  next_action_seq?: number;
  can_start?: boolean;
  can_refresh_state?: boolean;
  can_strike?: boolean;
  can_resolve?: boolean;
};

type MutationRunner = (payload: Record<string, unknown>) => { unwrap: () => Promise<any> };

type PvpControllerOptions = {
  machine: PvpSessionMachineLike;
  activeAuth: WebAppAuth;
  runRetriableApiCall: RunRetriableApiCall;
  setError: (next: string) => void;
  setPvpRuntime: (next: any) => void;
  refreshPvpLive: (sessionRefHint?: string) => Promise<void> | void;
  pvpSessionStart: MutationRunner;
  pvpSessionAction: MutationRunner;
  pvpSessionResolve: MutationRunner;
  loadPvpSessionState: MutationRunner;
};

function readSessionRef(payload: any): string {
  return String(payload?.session?.session_ref || payload?.session_ref || "").trim();
}

export function usePvpController(options: PvpControllerOptions) {
  const sessionRef = String(options.machine?.session_ref || "").trim();
  const nextSeq = Math.max(1, Number(options.machine?.next_action_seq || 1));

  const handlePvpStart = useCallback(async () => {
    if (!options.machine?.can_start) {
      options.setError("pvp_session_already_active");
      return;
    }
    const actionRequestId = buildActionRequestId("pvp_start");
    const payload = await options.runRetriableApiCall(
      async () =>
        options.pvpSessionStart({
          auth: options.activeAuth,
          action_request_id: actionRequestId
        }).unwrap(),
      "pvp_start_failed",
      {
        maxAttempts: 3,
        baseDelayMs: 180,
        telemetry: {
          panelKey: UI_SURFACE_KEY.PANEL_PVP,
          funnelKey: UI_FUNNEL_KEY.PVP_LOOP,
          surfaceKey: UI_SURFACE_KEY.PANEL_PVP,
          actionKey: "pvp_session_start"
        }
      }
    );
    if (!payload?.success) return;
    options.setPvpRuntime(payload.data || null);
    await options.refreshPvpLive(readSessionRef(payload.data || null));
  }, [options]);

  const handlePvpRefreshState = useCallback(async () => {
    if (!options.machine?.can_refresh_state) {
      options.setError("pvp_session_missing");
      return;
    }
    const payload = await options.runRetriableApiCall(
      async () =>
        options.loadPvpSessionState({
          auth: options.activeAuth,
          session_ref: sessionRef
        }).unwrap(),
      "pvp_state_failed",
      {
        maxAttempts: 2,
        baseDelayMs: 140,
        telemetry: {
          panelKey: UI_SURFACE_KEY.PANEL_PVP,
          funnelKey: UI_FUNNEL_KEY.PVP_LOOP,
          surfaceKey: UI_SURFACE_KEY.PANEL_PVP,
          actionKey: "pvp_session_state"
        }
      }
    );
    if (!payload?.success) return;
    options.setPvpRuntime(payload.data || null);
    await options.refreshPvpLive(readSessionRef(payload.data || null));
  }, [options, sessionRef]);

  const handlePvpStrike = useCallback(async () => {
    if (!options.machine?.can_strike) {
      options.setError("pvp_action_not_allowed");
      return;
    }
    const actionRequestId = buildActionRequestId("pvp_action");
    const payload = await options.runRetriableApiCall(
      async () =>
        options.pvpSessionAction({
          auth: options.activeAuth,
          session_ref: sessionRef,
          action_seq: nextSeq,
          input_action: "strike",
          action_request_id: actionRequestId
        }).unwrap(),
      "pvp_action_failed",
      {
        maxAttempts: 3,
        baseDelayMs: 170,
        telemetry: {
          panelKey: UI_SURFACE_KEY.PANEL_PVP,
          funnelKey: UI_FUNNEL_KEY.PVP_LOOP,
          surfaceKey: UI_SURFACE_KEY.PANEL_PVP,
          actionKey: "pvp_session_action",
          txState: "strike"
        }
      }
    );
    if (!payload?.success) return;
    options.setPvpRuntime(payload.data || null);
    await options.refreshPvpLive(readSessionRef(payload.data || null));
  }, [nextSeq, options, sessionRef]);

  const handlePvpResolve = useCallback(async () => {
    if (!options.machine?.can_resolve) {
      options.setError("pvp_resolve_not_allowed");
      return;
    }
    const actionRequestId = buildActionRequestId("pvp_resolve");
    const payload = await options.runRetriableApiCall(
      async () =>
        options.pvpSessionResolve({
          auth: options.activeAuth,
          session_ref: sessionRef,
          action_request_id: actionRequestId
        }).unwrap(),
      "pvp_resolve_failed",
      {
        maxAttempts: 3,
        baseDelayMs: 170,
        telemetry: {
          panelKey: UI_SURFACE_KEY.PANEL_PVP,
          funnelKey: UI_FUNNEL_KEY.PVP_LOOP,
          surfaceKey: UI_SURFACE_KEY.PANEL_PVP,
          actionKey: "pvp_session_resolve"
        }
      }
    );
    if (!payload?.success) return;
    options.setPvpRuntime(payload.data || null);
    await options.refreshPvpLive(readSessionRef(payload.data || null));
  }, [options, sessionRef]);

  return {
    handlePvpStart,
    handlePvpRefreshState,
    handlePvpStrike,
    handlePvpResolve
  };
}
