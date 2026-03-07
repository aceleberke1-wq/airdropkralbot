import * as telemetryContract from "../../../../../packages/shared/src/telemetryContract.js";

const {
  UI_EVENT_KEY,
  UI_FUNNEL_KEY,
  UI_SURFACE_KEY,
  UI_ECONOMY_EVENT_KEY,
  buildUiEventRecord: sharedBuildUiEventRecord,
  resolveRouteKey
} = telemetryContract;

export { UI_EVENT_KEY, UI_FUNNEL_KEY, UI_SURFACE_KEY, UI_ECONOMY_EVENT_KEY };

export function buildRouteKey(workspace, tab) {
  return resolveRouteKey({ workspace, tab });
}

export function buildUiEventRecord(input = {}) {
  const event = sharedBuildUiEventRecord(input);
  return {
    ...event,
    variant_key: event?.variant_key === "treatment" ? "treatment" : "control"
  };
}
