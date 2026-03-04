import type { PvpMutationResponse, PvpSessionStateResponse, WebAppAuth } from "../types";
import { buildActionRequestId, getJson, postJson, withAuthQuery } from "./common";

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

function resolveActionRequestId(raw: string | undefined, prefix: string): string {
  const value = String(raw || "").trim();
  return value || buildActionRequestId(prefix);
}

export async function startPvpSessionV2(auth: WebAppAuth, payload: PvpStartPayload = {}): Promise<PvpMutationResponse> {
  const actionRequestId = resolveActionRequestId(payload.action_request_id, "pvp_start");
  return postJson<PvpMutationResponse>("/webapp/api/v2/pvp/session/start", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    action_request_id: actionRequestId,
    mode_suggested: payload.mode_suggested || "balanced",
    transport: payload.transport || "poll"
  });
}

export async function applyPvpSessionActionV2(auth: WebAppAuth, payload: PvpActionPayload): Promise<PvpMutationResponse> {
  return postJson<PvpMutationResponse>("/webapp/api/v2/pvp/session/action", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    session_ref: String(payload.session_ref || ""),
    action_seq: Math.max(1, Number(payload.action_seq || 1)),
    input_action: String(payload.input_action || ""),
    latency_ms: Number(payload.latency_ms || 0),
    client_ts: Number(payload.client_ts || Date.now()),
    action_request_id: payload.action_request_id ? resolveActionRequestId(payload.action_request_id, "pvp_action") : undefined
  });
}

export async function resolvePvpSessionV2(auth: WebAppAuth, payload: PvpResolvePayload): Promise<PvpMutationResponse> {
  return postJson<PvpMutationResponse>("/webapp/api/v2/pvp/session/resolve", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    session_ref: String(payload.session_ref || ""),
    action_request_id: payload.action_request_id ? resolveActionRequestId(payload.action_request_id, "pvp_resolve") : undefined
  });
}

export async function fetchPvpSessionStateV2(auth: WebAppAuth, sessionRef = ""): Promise<PvpSessionStateResponse> {
  const query = withAuthQuery(auth, {
    session_ref: String(sessionRef || "").trim() || undefined
  });
  return getJson<PvpSessionStateResponse>(`/webapp/api/v2/pvp/session/state?${query}`);
}
