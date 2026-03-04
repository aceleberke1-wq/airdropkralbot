import type {
  BootstrapV2Payload,
  UiEventBatchRequest,
  UiEventBatchResponse,
  WebAppAuth
} from "./types";
import { normalizeLang, type Lang } from "./i18n";

function buildQuery(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null) {
      return;
    }
    search.set(key, String(value));
  });
  return search.toString();
}

export function readWebAppAuth(search = window.location.search): WebAppAuth | null {
  const qs = new URLSearchParams(search);
  const uid = String(qs.get("uid") || "").trim();
  const ts = String(qs.get("ts") || "").trim();
  const sig = String(qs.get("sig") || "").trim();
  if (!uid || !ts || !sig) {
    return null;
  }
  return { uid, ts, sig };
}

async function readJson<T>(res: Response): Promise<T> {
  const payload = (await res.json().catch(() => ({}))) as T;
  return payload;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  return readJson<T>(res);
}

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return readJson<T>(res);
}

export async function fetchBootstrapV2(auth: WebAppAuth, language: Lang = "tr"): Promise<BootstrapV2Payload> {
  const query = buildQuery({
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    lang: normalizeLang(language),
    scope: "player",
    include_admin: "1"
  });
  return getJson<BootstrapV2Payload>(`/webapp/api/v2/bootstrap?${query}`);
}

export async function fetchAdminBootstrapV2(auth: WebAppAuth): Promise<any> {
  const query = buildQuery({
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig
  });
  return getJson<any>(`/webapp/api/v2/admin/bootstrap?${query}`);
}

export async function fetchAdminUnifiedQueueV2(auth: WebAppAuth, limit = 40): Promise<any> {
  const query = buildQuery({
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    limit: String(Math.max(1, Math.min(200, Number(limit || 40))))
  });
  return getJson<any>(`/webapp/api/v2/admin/queue/unified?${query}`);
}

export async function startPvpSession(auth: WebAppAuth): Promise<any> {
  return postJson<any>("/webapp/api/pvp/session/start", {
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    request_id: `react_pvp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    mode_suggested: "balanced",
    transport: "poll"
  });
}

export async function fetchPvpSessionState(auth: WebAppAuth): Promise<any> {
  const query = buildQuery({
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig
  });
  return getJson<any>(`/webapp/api/pvp/session/state?${query}`);
}

export async function postUiEventsBatch(payload: UiEventBatchRequest): Promise<UiEventBatchResponse> {
  return postJson<UiEventBatchResponse>("/webapp/api/v2/telemetry/ui-events/batch", payload);
}
