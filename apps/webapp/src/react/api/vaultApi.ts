import type { TokenActionResponse, TokenQueryResponse, VaultOverview, WebAppApiResponse, WebAppAuth } from "../types";
import { getJson, postJson, withAuthQuery } from "./common";
import {
  parseTokenActionResponse,
  parseTokenQueryResponse,
  parseVaultOverviewResponse
} from "../../core/contracts/v2Validators.js";
import { resolveActionRequestId } from "../../core/shared/actionRequestId.js";

export async function fetchTokenSummaryV2(auth: WebAppAuth): Promise<TokenQueryResponse> {
  const query = withAuthQuery(auth);
  const response = await getJson<TokenQueryResponse>(`/webapp/api/v2/token/summary?${query}`);
  return parseTokenQueryResponse(response) as TokenQueryResponse;
}

export async function fetchVaultOverviewV2(auth: WebAppAuth): Promise<WebAppApiResponse<VaultOverview>> {
  const query = withAuthQuery(auth);
  const response = await getJson<WebAppApiResponse<VaultOverview>>(`/webapp/api/v2/vault/overview?${query}`);
  return parseVaultOverviewResponse(response) as WebAppApiResponse<VaultOverview>;
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
  const response = await getJson<TokenQueryResponse>(`/webapp/api/v2/token/quote?${query}`);
  return parseTokenQueryResponse(response) as TokenQueryResponse;
}

export async function postTokenMintV2(
  auth: WebAppAuth,
  payload: { amount?: number; action_request_id?: string } = {}
): Promise<TokenActionResponse> {
  const actionRequestId = resolveActionRequestId(payload.action_request_id, "", "token_mint");
  const response = await postJson<TokenActionResponse>("/webapp/api/v2/token/mint", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    amount: Number(payload.amount || 0) > 0 ? Number(payload.amount) : undefined,
    action_request_id: actionRequestId
  });
  return parseTokenActionResponse(response) as TokenActionResponse;
}

export async function postTokenBuyIntentV2(
  auth: WebAppAuth,
  payload: { usd_amount: number; chain: string; action_request_id?: string }
): Promise<TokenActionResponse> {
  const actionRequestId = resolveActionRequestId(payload.action_request_id, "", "token_buy");
  const response = await postJson<TokenActionResponse>("/webapp/api/v2/token/buy-intent", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    usd_amount: Number(payload.usd_amount || 0),
    chain: String(payload.chain || "").trim().toUpperCase(),
    action_request_id: actionRequestId
  });
  return parseTokenActionResponse(response) as TokenActionResponse;
}

export async function postTokenSubmitTxV2(
  auth: WebAppAuth,
  payload: { request_id: number; tx_hash: string; action_request_id?: string }
): Promise<TokenActionResponse> {
  const actionRequestId = resolveActionRequestId(payload.action_request_id, "", "token_submit");
  const response = await postJson<TokenActionResponse>("/webapp/api/v2/token/submit-tx", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    request_id: Math.max(1, Number(payload.request_id || 0)),
    tx_hash: String(payload.tx_hash || "").trim(),
    action_request_id: actionRequestId
  });
  return parseTokenActionResponse(response) as TokenActionResponse;
}

export async function fetchTokenRouteStatusV2(auth: WebAppAuth): Promise<TokenQueryResponse> {
  const query = withAuthQuery(auth);
  const response = await getJson<TokenQueryResponse>(`/webapp/api/v2/token/route/status?${query}`);
  return parseTokenQueryResponse(response) as TokenQueryResponse;
}

export async function fetchTokenDecisionTracesV2(auth: WebAppAuth, limit = 40): Promise<TokenQueryResponse> {
  const query = withAuthQuery(auth, {
    limit: Math.max(5, Math.min(100, Number(limit || 40)))
  });
  const response = await getJson<TokenQueryResponse>(`/webapp/api/v2/token/decision/traces?${query}`);
  return parseTokenQueryResponse(response) as TokenQueryResponse;
}
