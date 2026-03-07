import type { AdminApiResponse, AdminQueueActionRequest, WebAppAuth } from "../types";
import { getJson, postJson, withAuthQuery } from "./common";

export async function fetchAdminBootstrapV2(auth: WebAppAuth): Promise<AdminApiResponse> {
  const query = withAuthQuery(auth);
  return getJson<AdminApiResponse>(`/webapp/api/v2/admin/bootstrap?${query}`);
}

export async function fetchAdminUnifiedQueueV2(auth: WebAppAuth, limit = 60): Promise<AdminApiResponse> {
  const query = withAuthQuery(auth, {
    limit: Math.max(1, Math.min(200, Number(limit || 60)))
  });
  return getJson<AdminApiResponse>(`/webapp/api/v2/admin/queue/unified?${query}`);
}

export async function postAdminQueueActionV2(
  auth: WebAppAuth,
  payload: AdminQueueActionRequest
): Promise<AdminApiResponse> {
  return postJson<AdminApiResponse>("/webapp/api/v2/admin/queue/action", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    ...payload
  });
}

export async function fetchAdminMetricsV2(auth: WebAppAuth): Promise<AdminApiResponse> {
  const query = withAuthQuery(auth);
  return getJson<AdminApiResponse>(`/webapp/api/v2/admin/metrics?${query}`);
}

export async function fetchAdminLiveOpsCampaignV2(auth: WebAppAuth): Promise<AdminApiResponse> {
  const query = withAuthQuery(auth);
  return getJson<AdminApiResponse>(`/webapp/api/v2/admin/live-ops/campaign?${query}`);
}

export async function postAdminLiveOpsCampaignV2(
  auth: WebAppAuth,
  payload: Record<string, unknown>
): Promise<AdminApiResponse> {
  return postJson<AdminApiResponse>("/webapp/api/v2/admin/live-ops/campaign", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    ...payload
  });
}

export async function postAdminLiveOpsCampaignDispatchV2(
  auth: WebAppAuth,
  payload: Record<string, unknown>
): Promise<AdminApiResponse> {
  return postJson<AdminApiResponse>("/webapp/api/v2/admin/live-ops/campaign/dispatch", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    ...payload
  });
}

export async function fetchAdminRuntimeFlagsV2(auth: WebAppAuth): Promise<AdminApiResponse> {
  const query = withAuthQuery(auth);
  return getJson<AdminApiResponse>(`/webapp/api/v2/admin/runtime/flags?${query}`);
}

export async function postAdminRuntimeFlagsV2(
  auth: WebAppAuth,
  payload: Record<string, unknown>
): Promise<AdminApiResponse> {
  return postJson<AdminApiResponse>("/webapp/api/v2/admin/runtime/flags", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    ...payload
  });
}

export async function fetchAdminRuntimeBotV2(auth: WebAppAuth, stateKey = "", limit = 30): Promise<AdminApiResponse> {
  const query = withAuthQuery(auth, {
    state_key: String(stateKey || "").trim() || undefined,
    limit: Math.max(1, Math.min(100, Number(limit || 30)))
  });
  return getJson<AdminApiResponse>(`/webapp/api/v2/admin/runtime/bot?${query}`);
}

export async function postAdminRuntimeBotReconcileV2(
  auth: WebAppAuth,
  payload: Record<string, unknown>
): Promise<AdminApiResponse> {
  return postJson<AdminApiResponse>("/webapp/api/v2/admin/runtime/bot/reconcile", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    ...payload
  });
}

export async function fetchAdminDeployStatusV2(auth: WebAppAuth): Promise<AdminApiResponse> {
  const query = withAuthQuery(auth);
  return getJson<AdminApiResponse>(`/webapp/api/v2/admin/runtime/deploy/status?${query}`);
}

export async function fetchAdminAssetsStatusV2(auth: WebAppAuth): Promise<AdminApiResponse> {
  const query = withAuthQuery(auth);
  return getJson<AdminApiResponse>(`/webapp/api/v2/admin/assets/status?${query}`);
}

export async function postAdminAssetsReloadV2(auth: WebAppAuth): Promise<AdminApiResponse> {
  return postJson<AdminApiResponse>("/webapp/api/v2/admin/assets/reload", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig
  });
}

export async function fetchAdminAuditPhaseStatusV2(auth: WebAppAuth): Promise<AdminApiResponse> {
  const query = withAuthQuery(auth);
  return getJson<AdminApiResponse>(`/webapp/api/v2/admin/runtime/audit/phase-status?${query}`);
}

export async function fetchAdminAuditDataIntegrityV2(auth: WebAppAuth): Promise<AdminApiResponse> {
  const query = withAuthQuery(auth);
  return getJson<AdminApiResponse>(`/webapp/api/v2/admin/runtime/audit/data-integrity?${query}`);
}
