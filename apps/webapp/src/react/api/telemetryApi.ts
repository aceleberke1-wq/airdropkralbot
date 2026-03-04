import type { UiEventBatchRequest, UiEventBatchResponse } from "../types";
import { postJson } from "./common";

export async function postUiEventsBatch(payload: UiEventBatchRequest): Promise<UiEventBatchResponse> {
  return postJson<UiEventBatchResponse>("/webapp/api/v2/telemetry/ui-events/batch", payload);
}
