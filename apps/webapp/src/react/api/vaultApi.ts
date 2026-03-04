import type { TokenActionResponse, TokenQueryResponse, WebAppAuth } from "../types";
import { buildActionRequestId, getJson, postJson, withAuthQuery } from "./common";

function resolveActionRequestId(raw: string | undefined, prefix: string): string {
  const value = String(raw || "").trim();
  return value || buildActionRequestId(prefix);
}

export async function fetchTokenSummaryV2(auth: WebAppAuth): Promise<TokenQueryResponse> {
  const query = withAuthQuery(auth);
  return getJson<TokenQueryResponse>(`/webapp/api/v2/token/summary?${query}`);
}

export async function fetchTokenQuoteV2(
  auth: WebAppAuth,
  payload: { usd: number; chain: string; request_ref?: string; request_id?: number }
): Promise<TokenQueryResponse> {
  const query = withAuthQuery(auth, {
    usd: Number(payload.usd || 0),
    chain: String(payload.chain || "").trim().toUpperCase(),
    request_ref: payload.request_ref ? String(payload.request_ref) : undefined,
    request_id: Number(payload.request_id || 0) > 0 ? Number(payload.request_id) : undefined
  });
  return getJson<TokenQueryResponse>(`/webapp/api/v2/token/quote?${query}`);
}

export async function postTokenMintV2(
  auth: WebAppAuth,
  payload: { amount?: number; action_request_id?: string } = {}
): Promise<TokenActionResponse> {
  return postJson<TokenActionResponse>("/webapp/api/v2/token/mint", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    amount: Number(payload.amount || 0) > 0 ? Number(payload.amount) : undefined,
    action_request_id: resolveActionRequestId(payload.action_request_id, "token_mint")
  });
}

export async function postTokenBuyIntentV2(
  auth: WebAppAuth,
  payload: { usd_amount: number; chain: string; action_request_id?: string }
): Promise<TokenActionResponse> {
  return postJson<TokenActionResponse>("/webapp/api/v2/token/buy-intent", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    usd_amount: Number(payload.usd_amount || 0),
    chain: String(payload.chain || "").trim().toUpperCase(),
    action_request_id: resolveActionRequestId(payload.action_request_id, "token_buy")
  });
}

export async function postTokenSubmitTxV2(
  auth: WebAppAuth,
  payload: { request_id: number; tx_hash: string; action_request_id?: string }
): Promise<TokenActionResponse> {
  return postJson<TokenActionResponse>("/webapp/api/v2/token/submit-tx", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    request_id: Math.max(1, Number(payload.request_id || 0)),
    tx_hash: String(payload.tx_hash || "").trim(),
    action_request_id: resolveActionRequestId(payload.action_request_id, "token_submit")
  });
}

export async function fetchTokenRouteStatusV2(auth: WebAppAuth): Promise<TokenQueryResponse> {
  const query = withAuthQuery(auth);
  return getJson<TokenQueryResponse>(`/webapp/api/v2/token/route/status?${query}`);
}

export async function fetchTokenDecisionTracesV2(auth: WebAppAuth, limit = 40): Promise<TokenQueryResponse> {
  const query = withAuthQuery(auth, {
    limit: Math.max(5, Math.min(100, Number(limit || 40)))
  });
  return getJson<TokenQueryResponse>(`/webapp/api/v2/token/decision/traces?${query}`);
}
