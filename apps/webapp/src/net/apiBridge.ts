type AuthPayload = {
  uid: string;
  ts: string;
  sig: string;
};

type FetchJsonOptions = {
  cache?: RequestCache;
};

type NetApiBridge = {
  fetchActiveAssetManifestMeta: (auth: AuthPayload, extra?: Record<string, string>) => Promise<any>;
  fetchTokenQuote: (auth: AuthPayload, usdAmount: number, chain: string) => Promise<any>;
  fetchAdminQueues: (auth: AuthPayload) => Promise<any>;
};

declare global {
  interface Window {
    __AKR_NET_API__?: NetApiBridge;
  }
}

function asString(value: unknown): string {
  return String(value ?? "");
}

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildQuery(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    search.set(key, asString(value));
  });
  return search.toString();
}

async function fetchJson(pathWithQuery: string, options: FetchJsonOptions = {}): Promise<any> {
  const res = await fetch(pathWithQuery, {
    cache: options.cache || "default"
  });
  const payload = await res.json();
  if (!res.ok || !payload?.success) {
    const err = new Error(payload?.error || `request_failed:${res.status}`);
    (err as any).code = res.status;
    throw err;
  }
  return payload;
}

async function fetchActiveAssetManifestMeta(
  auth: AuthPayload,
  extra: Record<string, string> = {}
): Promise<any> {
  const query = buildQuery({
    uid: auth?.uid,
    ts: auth?.ts,
    sig: auth?.sig,
    include_entries: "1",
    limit: "200",
    ...extra
  });
  return fetchJson(`/webapp/api/assets/manifest/active?${query}`, { cache: "no-store" });
}

async function fetchTokenQuote(auth: AuthPayload, usdAmount: number, chain: string): Promise<any> {
  const query = buildQuery({
    uid: auth?.uid,
    ts: auth?.ts,
    sig: auth?.sig,
    usd: String(asNumber(usdAmount)),
    chain: asString(chain).toUpperCase()
  });
  return fetchJson(`/webapp/api/token/quote?${query}`);
}

async function fetchAdminQueues(auth: AuthPayload): Promise<any> {
  const query = buildQuery({
    uid: auth?.uid,
    ts: auth?.ts,
    sig: auth?.sig
  });
  return fetchJson(`/webapp/api/admin/queues?${query}`);
}

export function installNetApiBridge(): void {
  window.__AKR_NET_API__ = {
    fetchActiveAssetManifestMeta,
    fetchTokenQuote,
    fetchAdminQueues
  };
}

