import { useCallback } from "react";
import type { WebAppAuth } from "../../types";
import { buildActionRequestId } from "../../api";
import { UI_FUNNEL_KEY, UI_SURFACE_KEY } from "../../../core/telemetry/uiEventTaxonomy";

type MutationRunner = (payload: Record<string, unknown>) => { unwrap: () => Promise<any> };

type RunMutation = (
  runner: (attempt: number) => Promise<any>,
  fallback: string,
  telemetry?: {
    panelKey?: string;
    funnelKey?: string;
    surfaceKey?: string;
    economyEventKey?: string;
    txState?: string;
    actionKey?: string;
  }
) => Promise<void>;

type TasksControllerOptions = {
  activeAuth: WebAppAuth;
  runMutation: RunMutation;
  acceptAction: MutationRunner;
  completeAction: MutationRunner;
  revealAction: MutationRunner;
  claimMissionAction: MutationRunner;
  tasksRerollAction: MutationRunner;
};

export function useTasksController(options: TasksControllerOptions) {
  const handleTasksReroll = useCallback(async () => {
    const actionRequestId = buildActionRequestId("reroll");
    await options.runMutation(
      async () =>
        options.tasksRerollAction({
          auth: options.activeAuth,
          action_request_id: actionRequestId
        }).unwrap(),
      "tasks_reroll_failed",
      {
        panelKey: UI_SURFACE_KEY.PANEL_TASKS,
        funnelKey: UI_FUNNEL_KEY.TASKS_LOOP,
        surfaceKey: UI_SURFACE_KEY.PANEL_TASKS,
        actionKey: "tasks_reroll"
      }
    );
  }, [options]);

  const handleTaskComplete = useCallback(async () => {
    const actionRequestId = buildActionRequestId("complete");
    await options.runMutation(
      async () =>
        options.completeAction({
          auth: options.activeAuth,
          mode: "balanced",
          action_request_id: actionRequestId
        }).unwrap(),
      "task_complete_failed",
      {
        panelKey: UI_SURFACE_KEY.PANEL_TASKS,
        funnelKey: UI_FUNNEL_KEY.TASKS_LOOP,
        surfaceKey: UI_SURFACE_KEY.PANEL_TASKS,
        actionKey: "tasks_complete"
      }
    );
  }, [options]);

  const handleTaskReveal = useCallback(async () => {
    const actionRequestId = buildActionRequestId("reveal");
    await options.runMutation(
      async () =>
        options.revealAction({
          auth: options.activeAuth,
          action_request_id: actionRequestId
        }).unwrap(),
      "task_reveal_failed",
      {
        panelKey: UI_SURFACE_KEY.PANEL_TASKS,
        funnelKey: UI_FUNNEL_KEY.TASKS_LOOP,
        surfaceKey: UI_SURFACE_KEY.PANEL_TASKS,
        actionKey: "tasks_reveal"
      }
    );
  }, [options]);

  const handleTaskAccept = useCallback(
    async (offerId: number) => {
      const actionRequestId = buildActionRequestId("accept");
      await options.runMutation(
        async () =>
          options.acceptAction({
            auth: options.activeAuth,
            offer_id: offerId,
            action_request_id: actionRequestId
          }).unwrap(),
        "task_accept_failed",
        {
          panelKey: UI_SURFACE_KEY.PANEL_TASKS,
          funnelKey: UI_FUNNEL_KEY.TASKS_LOOP,
          surfaceKey: UI_SURFACE_KEY.PANEL_TASKS,
          actionKey: "tasks_accept_offer"
        }
      );
    },
    [options]
  );

  const handleMissionClaim = useCallback(
    async (missionKey: string) => {
      const actionRequestId = buildActionRequestId("claim");
      await options.runMutation(
        async () =>
          options.claimMissionAction({
            auth: options.activeAuth,
            mission_key: missionKey,
            action_request_id: actionRequestId
          }).unwrap(),
        "mission_claim_failed",
        {
          panelKey: UI_SURFACE_KEY.PANEL_TASKS,
          funnelKey: UI_FUNNEL_KEY.TASKS_LOOP,
          surfaceKey: UI_SURFACE_KEY.PANEL_TASKS,
          actionKey: "tasks_claim_mission"
        }
      );
    },
    [options]
  );

  return {
    handleTasksReroll,
    handleTaskComplete,
    handleTaskReveal,
    handleTaskAccept,
    handleMissionClaim
  };
}
