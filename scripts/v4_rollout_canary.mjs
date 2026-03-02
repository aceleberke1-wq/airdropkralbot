import crypto from "node:crypto";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || "").trim();
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || String(next).startsWith("--")) {
      out[key] = "true";
      continue;
    }
    out[key] = String(next);
    i += 1;
  }
  return out;
}

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
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const reason = data?.error || `${res.status}`;
    throw new Error(`request_failed:${path}:${reason}`);
  }
  return data;
}

function stageMeta(stageRaw) {
  const stage = String(stageRaw || "admin").toLowerCase();
  if (stage === "25" || stage === "rollout25") {
    return { key: "rollout_25", rolloutPct: 25, runRelease: true };
  }
  if (stage === "100" || stage === "rollout100" || stage === "full") {
    return { key: "rollout_100", rolloutPct: 100, runRelease: true };
  }
  return { key: "admin_canary", rolloutPct: 5, runRelease: false };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = String(process.env.ADMIN_API_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
  const secret = requireEnv("WEBAPP_HMAC_SECRET");
  const adminUid = requireEnv("ADMIN_TELEGRAM_ID");
  const stage = stageMeta(args.stage || process.env.V4_STAGE || "admin");
  const releaseRunLimit = Math.max(1, Math.min(200, Number(args.limit || process.env.V4_RELEASE_RUN_LIMIT || 25)));
  const applyRejections = String(args.apply_rejections || process.env.V4_RELEASE_APPLY_REJECTIONS || "false") === "true";

  const flags = {
    UX_V4_ENABLED: true,
    PAYOUT_RELEASE_V1_ENABLED: true,
    WEBAPP_PLAYER_MODE_DEFAULT: true,
    I18N_V1_ENABLED: true,
    PVP_POLL_PRIMARY: true
  };

  const runtimePayload = {
    ...buildAuth(secret, adminUid),
    source_mode: "db_override",
    source_json: {
      rollout: {
        version: "v4",
        stage: stage.key,
        rollout_pct: stage.rolloutPct,
        updated_at: new Date().toISOString()
      }
    },
    flags
  };
  const runtimeRes = await postJson(baseUrl, "/webapp/api/admin/runtime/flags", runtimePayload);

  const payoutReleasePayload = {
    ...buildAuth(secret, adminUid),
    enabled: true,
    mode: "tiered_drip",
    global_cap_min_usd: 20000000,
    daily_drip_pct_max: 0.005,
    tier_rules: [
      { tier: "T0", min_score: 0, drip_pct: 0 },
      { tier: "T1", min_score: 0.25, drip_pct: 0.002 },
      { tier: "T2", min_score: 0.5, drip_pct: 0.0035 },
      { tier: "T3", min_score: 0.75, drip_pct: 0.005 }
    ],
    score_weights: {
      volume30d: 0.65,
      mission30d: 0.25,
      tenure30d: 0.1
    }
  };
  const payoutRes = await postJson(baseUrl, "/webapp/api/admin/economy/payout-release", payoutReleasePayload);

  let releaseRunRes = null;
  if (stage.runRelease) {
    const runPayload = {
      ...buildAuth(secret, adminUid),
      limit: releaseRunLimit,
      apply_rejections: applyRejections
    };
    releaseRunRes = await postJson(baseUrl, "/webapp/api/admin/payout/release/run", runPayload);
  }

  const effectiveFlags = runtimeRes?.data?.effective_flags || {};
  const releaseSummary = payoutRes?.data?.payout_release || {};
  console.log(`[ok] v4 rollout stage=${stage.key} pct=${stage.rolloutPct}`);
  console.log(`[flags] UX_V4=${Boolean(effectiveFlags.UX_V4_ENABLED)} PAYOUT_RELEASE_V1=${Boolean(effectiveFlags.PAYOUT_RELEASE_V1_ENABLED)}`);
  console.log(
    `[payout_release] enabled=${Boolean(releaseSummary.enabled)} mode=${String(releaseSummary.mode || "tiered_drip")} min_cap=${Number(
      releaseSummary.global_cap_min_usd || 0
    )}`
  );
  if (releaseRunRes) {
    const stats = releaseRunRes?.data?.stats || {};
    console.log(
      `[release_run] processed=${Number(stats.processed || 0)} eligible=${Number(stats.eligible || 0)} approved=${Number(
        stats.auto_approved || 0
      )} rejected=${Number(stats.auto_rejected || 0)}`
    );
  } else {
    console.log("[release_run] skipped (admin canary stage)");
  }
}

main().catch((err) => {
  console.error("[err] v4 rollout failed:", err?.message || err);
  process.exitCode = 1;
});
