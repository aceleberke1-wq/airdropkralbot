import type { BootstrapV2Payload, LangPrefInput, PlayerActionResponse, WebAppAuth, WebAppApiResponse } from "../types";
import { normalizeLang, type Lang } from "../i18n";
import { buildActionRequestId, getJson, postJson, withAuthQuery } from "./common";

type PlayerActionMutation = {
  action_request_id?: string;
};

function resolveActionRequestId(raw?: string, prefix = "player"): string {
  const value = String(raw || "").trim();
  return value || buildActionRequestId(prefix);
}

export async function fetchBootstrapV2(auth: WebAppAuth, language: Lang = "tr"): Promise<BootstrapV2Payload> {
  const query = withAuthQuery(auth, {
    lang: normalizeLang(language),
    scope: "player",
    include_admin: "1"
  });
  return getJson<BootstrapV2Payload>(`/webapp/api/v2/bootstrap?${query}`);
}

export async function postAcceptActionV2(
  auth: WebAppAuth,
  payload: { offer_id: number } & PlayerActionMutation
): Promise<PlayerActionResponse> {
  const actionRequestId = resolveActionRequestId(payload.action_request_id, "accept");
  return postJson<PlayerActionResponse>("/webapp/api/v2/actions/accept", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    offer_id: Math.max(1, Number(payload.offer_id || 0)),
    action_request_id: actionRequestId
  });
}

export async function postCompleteActionV2(
  auth: WebAppAuth,
  payload: { attempt_id?: number; mode?: string } & PlayerActionMutation
): Promise<PlayerActionResponse> {
  const actionRequestId = resolveActionRequestId(payload.action_request_id, "complete");
  return postJson<PlayerActionResponse>("/webapp/api/v2/actions/complete", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    attempt_id: Number(payload.attempt_id || 0) > 0 ? Number(payload.attempt_id) : undefined,
    mode: payload.mode ? String(payload.mode) : undefined,
    action_request_id: actionRequestId
  });
}

export async function postRevealActionV2(
  auth: WebAppAuth,
  payload: { attempt_id?: number } & PlayerActionMutation = {}
): Promise<PlayerActionResponse> {
  const actionRequestId = resolveActionRequestId(payload.action_request_id, "reveal");
  return postJson<PlayerActionResponse>("/webapp/api/v2/actions/reveal", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    attempt_id: Number(payload.attempt_id || 0) > 0 ? Number(payload.attempt_id) : undefined,
    action_request_id: actionRequestId
  });
}

export async function postClaimMissionV2(
  auth: WebAppAuth,
  payload: { mission_key: string } & PlayerActionMutation
): Promise<PlayerActionResponse> {
  const actionRequestId = resolveActionRequestId(payload.action_request_id, "mission");
  return postJson<PlayerActionResponse>("/webapp/api/v2/actions/claim-mission", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    mission_key: String(payload.mission_key || "").trim(),
    action_request_id: actionRequestId
  });
}

export async function postTasksRerollV2(
  auth: WebAppAuth,
  payload: PlayerActionMutation = {}
): Promise<PlayerActionResponse> {
  const actionRequestId = resolveActionRequestId(payload.action_request_id, "reroll");
  return postJson<PlayerActionResponse>("/webapp/api/v2/tasks/reroll", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    action_request_id: actionRequestId
  });
}

export function normalizeLanguageInput(input: LangPrefInput): Lang {
  return normalizeLang(input);
}

export type { WebAppApiResponse };
