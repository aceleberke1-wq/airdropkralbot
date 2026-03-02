import crypto from "node:crypto";

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`missing_env:${name}`);
  }
  return value;
}

function signPayload(secret, uid, ts) {
  return crypto.createHmac("sha256", secret).update(`${uid}.${ts}`).digest("hex");
}

function buildAuth(secret, uid) {
  const ts = Date.now().toString();
  return {
    uid: String(uid),
    ts,
    sig: signPayload(secret, uid, ts)
  };
}

async function postJson(baseUrl, path, payload) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(`request_failed:${path}:${data?.error || res.status}`);
  }
  return data;
}

async function main() {
  const baseUrl = String(process.env.ADMIN_API_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
  const secret = requireEnv("WEBAPP_HMAC_SECRET");
  const adminUid = requireEnv("ADMIN_TELEGRAM_ID");

  const rollbackFlags = {
    UX_V4_ENABLED: false,
    PAYOUT_RELEASE_V1_ENABLED: false,
    WEBAPP_PLAYER_MODE_DEFAULT: false,
    I18N_V1_ENABLED: false
  };

  const runtimeRes = await postJson(baseUrl, "/webapp/api/admin/runtime/flags", {
    ...buildAuth(secret, adminUid),
    source_mode: "db_override",
    source_json: {
      rollout: {
        version: "v4",
        stage: "rollback",
        rollout_pct: 0,
        updated_at: new Date().toISOString()
      }
    },
    flags: rollbackFlags
  });

  const payoutRes = await postJson(baseUrl, "/webapp/api/admin/economy/payout-release", {
    ...buildAuth(secret, adminUid),
    enabled: false
  });

  const effectiveFlags = runtimeRes?.data?.effective_flags || {};
  const payoutRelease = payoutRes?.data?.payout_release || {};
  console.log("[ok] v4 rollback completed");
  console.log(`[flags] UX_V4=${Boolean(effectiveFlags.UX_V4_ENABLED)} PAYOUT_RELEASE_V1=${Boolean(effectiveFlags.PAYOUT_RELEASE_V1_ENABLED)}`);
  console.log(`[payout_release] enabled=${Boolean(payoutRelease.enabled)}`);
}

main().catch((err) => {
  console.error("[err] v4 rollback failed:", err?.message || err);
  process.exitCode = 1;
});
