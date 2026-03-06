import type { PvpMutationResponse, PvpSessionStateResponse, WebAppAuth } from "../types";
import { getJson, postJson, withAuthQuery } from "./common";
import { parsePvpMutationResponse, parsePvpSessionStateResponse } from "../../core/contracts/v2Validators.js";
import { resolveActionRequestId } from "../../core/shared/actionRequestId.js";

type PvpStartPayload = {
  action_request_id?: string;
  mode_suggested?: "safe" | "balanced" | "aggressive";
  transport?: "poll" | "ws";
};

type PvpActionPayload = {
  session_ref: string;
  action_seq: number;
  input_action: string;
  latency_ms?: number;
  client_ts?: number;
  action_request_id?: string;
};

type PvpResolvePayload = {
  session_ref: string;
  action_request_id?: string;
};

export async function startPvpSessionV2(auth: WebAppAuth, payload: PvpStartPayload = {}): Promise<PvpMutationResponse> {
  const actionRequestId = resolveActionRequestId(payload.action_request_id, "", "pvp_start");
  const response = await postJson<PvpMutationResponse>("/webapp/api/v2/pvp/session/start", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    action_request_id: actionRequestId,
    mode_suggested: payload.mode_suggested || "balanced",
    transport: payload.transport || "poll"
  });
  return parsePvpMutationResponse(response) as PvpMutationResponse;
}

export async function applyPvpSessionActionV2(auth: WebAppAuth, payload: PvpActionPayload): Promise<PvpMutationResponse> {
  const actionRequestId = resolveActionRequestId(payload.action_request_id, "", "pvp_action");
  const response = await postJson<PvpMutationResponse>("/webapp/api/v2/pvp/session/action", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    session_ref: String(payload.session_ref || ""),
    action_seq: Math.max(1, Number(payload.action_seq || 1)),
    input_action: String(payload.input_action || ""),
    latency_ms: Number(payload.latency_ms || 0),
    client_ts: Number(payload.client_ts || Date.now()),
    action_request_id: actionRequestId
  });
  return parsePvpMutationResponse(response) as PvpMutationResponse;
}

export async function resolvePvpSessionV2(auth: WebAppAuth, payload: PvpResolvePayload): Promise<PvpMutationResponse> {
  const actionRequestId = resolveActionRequestId(payload.action_request_id, "", "pvp_resolve");
  const response = await postJson<PvpMutationResponse>("/webapp/api/v2/pvp/session/resolve", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    session_ref: String(payload.session_ref || ""),
    action_request_id: actionRequestId
  });
  return parsePvpMutationResponse(response) as PvpMutationResponse;
}

export async function fetchPvpSessionStateV2(auth: WebAppAuth, sessionRef = ""): Promise<PvpSessionStateResponse> {
  const query = withAuthQuery(auth, {
    session_ref: String(sessionRef || "").trim() || undefined
  });
  const response = await getJson<PvpSessionStateResponse>(`/webapp/api/v2/pvp/session/state?${query}`);
  return parsePvpSessionStateResponse(response) as PvpSessionStateResponse;
}
