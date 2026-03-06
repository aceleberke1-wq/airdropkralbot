import type { UiPreferencesPatch, UiPreferencesResponse, WebAppAuth } from "../types";
import { getJson, postJson, withAuthQuery } from "./common";
import { parseUiPreferencesResponse } from "../../core/contracts/v2Validators.js";

export async function fetchUiPreferencesV2(auth: WebAppAuth): Promise<UiPreferencesResponse> {
  const query = withAuthQuery(auth);
  const response = await getJson<UiPreferencesResponse>(`/webapp/api/v2/ui/preferences?${query}`);
  return parseUiPreferencesResponse(response) as UiPreferencesResponse;
}

export async function postUiPreferencesV2(auth: WebAppAuth, patch: UiPreferencesPatch): Promise<UiPreferencesResponse> {
  const response = await postJson<UiPreferencesResponse>("/webapp/api/v2/ui/preferences", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    ...patch
  });
  return parseUiPreferencesResponse(response) as UiPreferencesResponse;
}
