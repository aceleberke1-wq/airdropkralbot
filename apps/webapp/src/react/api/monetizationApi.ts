import type { MonetizationOverview, MonetizationPurchasePayload, WebAppApiResponse, WebAppAuth } from "../types";
import { getJson, postJson, withAuthQuery } from "./common";
import { parseMonetizationOverviewResponse, parseMonetizationPurchaseResponse } from "../../core/contracts/v2Validators.js";

export async function fetchMonetizationOverviewV2(
  auth: WebAppAuth
): Promise<WebAppApiResponse<MonetizationOverview>> {
  const query = withAuthQuery(auth);
  const response = await getJson<WebAppApiResponse<MonetizationOverview>>(`/webapp/api/v2/monetization/overview?${query}`);
  return parseMonetizationOverviewResponse(response) as WebAppApiResponse<MonetizationOverview>;
}

export async function fetchMonetizationCatalogV2(auth: WebAppAuth, lang: "tr" | "en" = "tr"): Promise<WebAppApiResponse> {
  const query = withAuthQuery(auth, { lang });
  return getJson<WebAppApiResponse>(`/webapp/api/v2/monetization/catalog?${query}`);
}

export async function fetchMonetizationStatusV2(auth: WebAppAuth, lang: "tr" | "en" = "tr"): Promise<WebAppApiResponse> {
  const query = withAuthQuery(auth, { lang });
  return getJson<WebAppApiResponse>(`/webapp/api/v2/monetization/status?${query}`);
}

export async function postPassPurchaseV2(
  auth: WebAppAuth,
  payload: { pass_key: string; payment_currency?: string; purchase_ref?: string }
): Promise<WebAppApiResponse<MonetizationPurchasePayload>> {
  const response = await postJson<WebAppApiResponse<MonetizationPurchasePayload>>("/webapp/api/v2/monetization/pass/purchase", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    pass_key: String(payload.pass_key || "").trim(),
    payment_currency: payload.payment_currency ? String(payload.payment_currency).toUpperCase() : undefined,
    purchase_ref: payload.purchase_ref ? String(payload.purchase_ref).trim() : undefined
  });
  return parseMonetizationPurchaseResponse(response) as WebAppApiResponse<MonetizationPurchasePayload>;
}

export async function postCosmeticPurchaseV2(
  auth: WebAppAuth,
  payload: { item_key: string; payment_currency?: string; purchase_ref?: string }
): Promise<WebAppApiResponse<MonetizationPurchasePayload>> {
  const response = await postJson<WebAppApiResponse<MonetizationPurchasePayload>>("/webapp/api/v2/monetization/cosmetic/purchase", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    item_key: String(payload.item_key || "").trim(),
    payment_currency: payload.payment_currency ? String(payload.payment_currency).toUpperCase() : undefined,
    purchase_ref: payload.purchase_ref ? String(payload.purchase_ref).trim() : undefined
  });
  return parseMonetizationPurchaseResponse(response) as WebAppApiResponse<MonetizationPurchasePayload>;
}
