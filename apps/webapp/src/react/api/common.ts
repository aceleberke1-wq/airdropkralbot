import { normalizeLang, type Lang } from "../i18n";
import type { WebAppAuth, WebAppApiResponse } from "../types";

export function buildQuery(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === "") {
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

export function buildActionRequestId(prefix = "react"): string {
  const safePrefix = String(prefix || "react")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]/g, "_")
    .slice(0, 32) || "react";
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${safePrefix}_${stamp}_${rand}`;
}

export async function readJson<T>(res: Response): Promise<T> {
  return (await res.json().catch(() => ({}))) as T;
}

export async function getJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    cache: "no-store",
    ...init
  });
  return readJson<T>(res);
}

export async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return readJson<T>(res);
}

export function withAuthQuery(auth: WebAppAuth, extra: Record<string, unknown> = {}): string {
  return buildQuery({
    uid: auth.uid,
    ts: auth.ts,
    sig: auth.sig,
    ...extra
  });
}

export function normalizeApiLang(value: unknown): Lang {
  return normalizeLang(value);
}

export function isApiSuccess<T>(payload: WebAppApiResponse<T> | null | undefined): payload is WebAppApiResponse<T> {
  return Boolean(payload && payload.success);
}
