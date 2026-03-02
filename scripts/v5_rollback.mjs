import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const envPath = path.join(repoRoot, ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`missing_env:${name}`);
  return value;
}

function sign(secret, uid, ts) {
  return crypto.createHmac("sha256", secret).update(`${uid}.${ts}`).digest("hex");
}

function buildAuth(secret, uid) {
  const ts = Date.now().toString();
  return {
    uid: String(uid),
    ts,
    sig: sign(secret, uid, ts)
  };
}

async function postJson(baseUrl, path, payload) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok && data.success !== false) {
    return data;
  }
  throw new Error(`request_failed:${path}:${data?.error || res.status}`);
}

function isConfirmationRequiredResponse(response) {
  if (!response || typeof response !== "object") return false;
  const error = String(response?.error || "").trim().toLowerCase();
  const token = String(response?.data?.confirm_token || "").trim();
  return error === "admin_confirmation_required" && token.length >= 16;
}

async function postJsonWithCriticalConfirm(baseUrl, path, payload) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok && data.success !== false) {
    return data;
  }

  if (res.status === 409 && isConfirmationRequiredResponse(data)) {
    const confirmToken = String(data?.data?.confirm_token || "").trim();
    const confirmedRes = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, confirm_token: confirmToken })
    });
    const confirmedData = await confirmedRes.json().catch(() => ({}));
    if (confirmedRes.ok && confirmedData.success !== false) {
      return confirmedData;
    }
    throw new Error(`request_failed:${path}:${confirmedData?.error || confirmedRes.status}`);
  }

  throw new Error(`request_failed:${path}:${data?.error || res.status}`);
}

async function main() {
  const baseUrl = String(process.env.ADMIN_API_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
  const secret = requireEnv("WEBAPP_HMAC_SECRET");
  const adminUid = requireEnv("ADMIN_TELEGRAM_ID");

  const runtimeRes = await postJson(baseUrl, "/webapp/api/admin/runtime/flags", {
    ...buildAuth(secret, adminUid),
    source_mode: "db_override",
    source_json: {
      rollout: {
        version: "v5",
        stage: "rollback",
        rollout_pct: 0,
        updated_at: new Date().toISOString()
      }
    },
    flags: {
      UX_V5_ENABLED: false,
      PAYOUT_RELEASE_V2_ENABLED: false,
      I18N_V2_ENABLED: false
    }
  });

  const payoutRes = await postJsonWithCriticalConfirm(baseUrl, "/webapp/api/v2/admin/economy/payout-release", {
    ...buildAuth(secret, adminUid),
    enabled: false
  });

  console.log("[ok] v5 rollback completed");
  console.log(`[flags] UX_V5=${Boolean(runtimeRes?.data?.effective_flags?.UX_V5_ENABLED)} PAYOUT_RELEASE_V2=${Boolean(runtimeRes?.data?.effective_flags?.PAYOUT_RELEASE_V2_ENABLED)}`);
  console.log(`[payout_release] enabled=${Boolean(payoutRes?.data?.payout_release?.enabled)}`);
}

main().catch((err) => {
  console.error("[err] v5 rollback failed:", err?.message || err);
  process.exitCode = 1;
});
