import type { BootstrapV2Payload, LangPrefInput, PlayerActionResponse, WebAppAuth, WebAppApiResponse } from "../types";
import { normalizeLang, type Lang } from "../i18n";
import { getJson, postJson, withAuthQuery } from "./common";
import { parsePlayerActionResponse } from "../../core/contracts/v2Validators.js";
import { resolveActionRequestId } from "../../core/shared/actionRequestId.js";

type PlayerActionMutation = {
  action_request_id?: string;
};

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
  const actionRequestId = resolveActionRequestId(payload.action_request_id, "", "accept");
  const response = await postJson<PlayerActionResponse>("/webapp/api/v2/actions/accept", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    offer_id: Math.max(1, Number(payload.offer_id || 0)),
    action_request_id: actionRequestId
  });
  return parsePlayerActionResponse(response) as PlayerActionResponse;
}

export async function postCompleteActionV2(
  auth: WebAppAuth,
  payload: { attempt_id?: number; mode?: string } & PlayerActionMutation
): Promise<PlayerActionResponse> {
  const actionRequestId = resolveActionRequestId(payload.action_request_id, "", "complete");
  const response = await postJson<PlayerActionResponse>("/webapp/api/v2/actions/complete", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    attempt_id: Number(payload.attempt_id || 0) > 0 ? Number(payload.attempt_id) : undefined,
    mode: payload.mode ? String(payload.mode) : undefined,
    action_request_id: actionRequestId
  });
  return parsePlayerActionResponse(response) as PlayerActionResponse;
}

export async function postRevealActionV2(
  auth: WebAppAuth,
  payload: { attempt_id?: number } & PlayerActionMutation = {}
): Promise<PlayerActionResponse> {
  const actionRequestId = resolveActionRequestId(payload.action_request_id, "", "reveal");
  const response = await postJson<PlayerActionResponse>("/webapp/api/v2/actions/reveal", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    attempt_id: Number(payload.attempt_id || 0) > 0 ? Number(payload.attempt_id) : undefined,
    action_request_id: actionRequestId
  });
  return parsePlayerActionResponse(response) as PlayerActionResponse;
}

export async function postClaimMissionV2(
  auth: WebAppAuth,
  payload: { mission_key: string } & PlayerActionMutation
): Promise<PlayerActionResponse> {
  const actionRequestId = resolveActionRequestId(payload.action_request_id, "", "mission");
  const response = await postJson<PlayerActionResponse>("/webapp/api/v2/actions/claim-mission", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    mission_key: String(payload.mission_key || "").trim(),
    action_request_id: actionRequestId
  });
  return parsePlayerActionResponse(response) as PlayerActionResponse;
}

export async function postTasksRerollV2(
  auth: WebAppAuth,
  payload: PlayerActionMutation = {}
): Promise<PlayerActionResponse> {
  const actionRequestId = resolveActionRequestId(payload.action_request_id, "", "reroll");
  const response = await postJson<PlayerActionResponse>("/webapp/api/v2/tasks/reroll", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    action_request_id: actionRequestId
  });
  return parsePlayerActionResponse(response) as PlayerActionResponse;
}

export function normalizeLanguageInput(input: LangPrefInput): Lang {
  return normalizeLang(input);
}

export type { WebAppApiResponse };
