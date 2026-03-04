import type { UiPreferencesPatch, UiPreferencesResponse, WebAppAuth } from "../types";
import { getJson, postJson, withAuthQuery } from "./common";

export async function fetchUiPreferencesV2(auth: WebAppAuth): Promise<UiPreferencesResponse> {
  const query = withAuthQuery(auth);
  return getJson<UiPreferencesResponse>(`/webapp/api/v2/ui/preferences?${query}`);
}

export async function postUiPreferencesV2(auth: WebAppAuth, patch: UiPreferencesPatch): Promise<UiPreferencesResponse> {
  return postJson<UiPreferencesResponse>("/webapp/api/v2/ui/preferences", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    ...patch
  });
}
