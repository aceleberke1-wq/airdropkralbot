import type { DynamicAutoPolicy, WebAppApiResponse, WebAppAuth } from "../types";
import { getJson, postJson, withAuthQuery } from "./common";

type DynamicPolicyPreviewInput = {
  token_symbol?: string;
  risk_score?: number;
  velocity_per_hour?: number;
  usd_amount?: number;
  kyc_status?: string;
  gate_open?: boolean;
};

type DynamicPolicyUpsertPayload = {
  token_symbol?: string;
  replace_missing?: boolean;
  reason?: string;
  note?: string;
  segments: Array<Record<string, unknown>>;
};

export async function fetchAdminDynamicAutoPolicyV2(
  auth: WebAppAuth,
  preview: DynamicPolicyPreviewInput = {}
): Promise<WebAppApiResponse<DynamicAutoPolicy>> {
  const query = withAuthQuery(auth, {
    token_symbol: preview.token_symbol ? String(preview.token_symbol).toUpperCase() : undefined,
    risk_score: Number.isFinite(Number(preview.risk_score)) ? Number(preview.risk_score) : undefined,
    velocity_per_hour: Number.isFinite(Number(preview.velocity_per_hour))
      ? Number(preview.velocity_per_hour)
      : undefined,
    usd_amount: Number.isFinite(Number(preview.usd_amount)) ? Number(preview.usd_amount) : undefined,
    kyc_status: preview.kyc_status ? String(preview.kyc_status).toLowerCase() : undefined,
    gate_open:
      typeof preview.gate_open === "boolean"
        ? preview.gate_open
          ? "1"
          : "0"
        : undefined
  });
  return getJson<WebAppApiResponse<DynamicAutoPolicy>>(`/webapp/api/v2/admin/token/auto-policy/dynamic?${query}`);
}

export async function postAdminDynamicAutoPolicyV2(
  auth: WebAppAuth,
  payload: DynamicPolicyUpsertPayload
): Promise<WebAppApiResponse<DynamicAutoPolicy>> {
  return postJson<WebAppApiResponse<DynamicAutoPolicy>>("/webapp/api/v2/admin/token/auto-policy/dynamic", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    token_symbol: payload.token_symbol ? String(payload.token_symbol).toUpperCase() : undefined,
    replace_missing: payload.replace_missing !== false,
    reason: payload.reason ? String(payload.reason) : undefined,
    note: payload.note ? String(payload.note) : undefined,
    segments: Array.isArray(payload.segments) ? payload.segments : []
  });
}

