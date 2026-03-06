import type { WebAppApiResponse, WebAppAuth } from "../types";
import { getJson, postJson, withAuthQuery } from "./common";
import { parsePayoutStatusResponse } from "../../core/contracts/v2Validators.js";

export async function fetchPayoutStatusV2(auth: WebAppAuth): Promise<WebAppApiResponse> {
  const query = withAuthQuery(auth);
  const response = await getJson<WebAppApiResponse>(`/webapp/api/v2/payout/status?${query}`);
  return parsePayoutStatusResponse(response) as WebAppApiResponse;
}

export async function postPayoutRequestV2(
  auth: WebAppAuth,
  payload: { currency?: string } = {}
): Promise<WebAppApiResponse> {
  return postJson<WebAppApiResponse>("/webapp/api/v2/payout/request", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    currency: String(payload.currency || "BTC").toUpperCase()
  });
}
