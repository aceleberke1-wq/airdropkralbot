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

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || "").trim();
    if (!token.startsWith("--")) continue;
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

function parseBool(value, fallback = false) {
  if (value == null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function resolveBaseUrl(inputRaw) {
  const input = String(inputRaw || "").trim();
  if (!input) return "";
  let normalized = input.replace(/\/+$/, "");
  normalized = normalized.replace(/\/webapp$/i, "");
  return normalized;
}

function evaluateRuntimeHealth(payload = {}, options = {}) {
  const checks = [];
  const requireBot = options.requireBot === true;
  const maxLagSec = Math.max(15, Math.min(600, toNumber(options.maxLagSec, 45)));
  const healthOk = Boolean(payload?.ok);
  const botRuntime = payload?.bot_runtime || {};

  const push = (status, metric, observed, threshold, note = "") => {
    checks.push({ status, metric, observed, threshold, note });
  };

  push(healthOk ? "pass" : "fail", "health_ok", healthOk, "true");

  if (!botRuntime || typeof botRuntime !== "object") {
    push(requireBot ? "fail" : "warn", "bot_runtime_payload", "missing", "object");
    const failedChecks = checks.filter((row) => row.status === "fail").length;
    const warnedChecks = checks.filter((row) => row.status === "warn").length;
    return {
      ok: failedChecks === 0,
      failed_checks: failedChecks,
      warned_checks: warnedChecks,
      checks
    };
  }

  const alive = Boolean(botRuntime.alive);
  const lockAcquired = Boolean(botRuntime.lock_acquired);
  const mode = String(botRuntime.mode || "");
  const lagSec = toNumber(botRuntime.heartbeat_lag_sec, -1);
  const stale = Boolean(botRuntime.stale);

  if (!requireBot) {
    push("pass", "bot_required", false, "false");
  } else {
    push(alive ? "pass" : "fail", "bot_alive", alive, "true");
    push(lockAcquired ? "pass" : "fail", "bot_lock_acquired", lockAcquired, "true");
    push(mode === "polling" ? "pass" : "fail", "bot_mode", mode || "unknown", "polling");
    if (lagSec < 0) {
      push("fail", "bot_heartbeat_lag_sec", "missing", `<= ${maxLagSec}`);
    } else {
      push(lagSec <= maxLagSec ? "pass" : "fail", "bot_heartbeat_lag_sec", lagSec, `<= ${maxLagSec}`);
    }
    push(stale ? "fail" : "pass", "bot_stale", stale, "false");
  }

  const failedChecks = checks.filter((row) => row.status === "fail").length;
  const warnedChecks = checks.filter((row) => row.status === "warn").length;
  return {
    ok: failedChecks === 0,
    failed_checks: failedChecks,
    warned_checks: warnedChecks,
    checks
  };
}

async function fetchHealth(baseUrl, timeoutMs) {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  let timeoutHandle = null;
  if (controller) {
    timeoutHandle = setTimeout(() => {
      try {
        controller.abort();
      } catch {}
    }, timeoutMs);
  }
  try {
    const res = await fetch(`${baseUrl}/health`, {
      cache: "no-store",
      ...(controller ? { signal: controller.signal } : {})
    });
    const data = await res.json().catch(() => ({}));
    return {
      status: res.status,
      ok: res.ok,
      payload: data
    };
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function notifyTelegram(alertText, token, adminId) {
  const botToken = String(token || "").trim();
  const chatId = String(adminId || "").trim();
  if (!botToken || !chatId) {
    return { sent: false, reason: "telegram_credentials_missing" };
  }
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: alertText,
      disable_web_page_preview: true
    })
  });
  const payload = await res.json().catch(() => ({}));
  return {
    sent: Boolean(res.ok && payload?.ok),
    status: res.status,
    reason: res.ok ? "" : String(payload?.description || `status_${res.status}`)
  };
}

function formatAlert(baseUrl, health, evaluation) {
  const failed = (evaluation?.checks || []).filter((row) => row.status === "fail");
  const lines = [
    "V5 Runtime Guard ALERT",
    `base=${baseUrl}`,
    `health_status=${Number(health?.status || 0)}`,
    `failed_checks=${failed.length}`
  ];
  for (const row of failed.slice(0, 8)) {
    lines.push(`- ${row.metric}: observed=${row.observed} threshold=${row.threshold}`);
  }
  return lines.join("\n");
}

async function runRuntimeGuard(args = {}) {
  const baseUrl = resolveBaseUrl(args.base_url ?? args.baseUrl ?? process.env.RUNTIME_GUARD_BASE_URL ?? process.env.WEBAPP_PUBLIC_URL);
  if (!baseUrl) {
    throw new Error("missing_base_url: use --base_url or WEBAPP_PUBLIC_URL");
  }

  const timeoutMs = Math.max(2000, Math.min(60000, toNumber(args.timeout_ms ?? args.timeoutMs ?? "12000", 12000)));
  const maxLagSec = Math.max(15, Math.min(600, toNumber(args.max_heartbeat_lag_sec ?? args.maxHeartbeatLagSec ?? "45", 45)));
  const requireBot = parseBool(args.require_bot ?? args.requireBot ?? process.env.BOT_ENABLED, true);
  const reportEnabled = parseBool(args.emit_report ?? args.emitReport ?? process.env.V5_RUNTIME_GUARD_EMIT_REPORT, true);
  const notifyEnabled = parseBool(args.notify_telegram ?? args.notifyTelegram ?? process.env.V5_RUNTIME_GUARD_NOTIFY_TELEGRAM, false);
  const applyExitCode = parseBool(args.apply_exit_code ?? args.applyExitCode, true);

  const health = await fetchHealth(baseUrl, timeoutMs);
  const evaluation = evaluateRuntimeHealth(health.payload, {
    requireBot,
    maxLagSec
  });

  const output = {
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    timeout_ms: timeoutMs,
    require_bot: requireBot,
    max_heartbeat_lag_sec: maxLagSec,
    health_status_code: Number(health.status || 0),
    health_ok: Boolean(health.ok),
    evaluation,
    bot_runtime: health.payload?.bot_runtime || null
  };

  let reportPath = "";
  if (reportEnabled) {
    const outDir = path.join(repoRoot, "docs");
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").replace("T", "_");
    const stamped = path.join(outDir, `V5_RUNTIME_GUARD_${stamp}.json`);
    const latest = path.join(outDir, "V5_RUNTIME_GUARD_latest.json");
    fs.writeFileSync(stamped, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    fs.writeFileSync(latest, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    reportPath = stamped;
  }

  let telegram = { sent: false, reason: "" };
  if (!evaluation.ok && notifyEnabled) {
    telegram = await notifyTelegram(
      formatAlert(baseUrl, health, evaluation),
      process.env.BOT_TOKEN || "",
      process.env.ADMIN_TELEGRAM_ID || ""
    );
    output.telegram_alert = telegram;
  }

  console.log(
    `[runtime-guard] ok=${Boolean(evaluation.ok)} failed=${Number(evaluation.failed_checks || 0)} warned=${Number(
      evaluation.warned_checks || 0
    )} base=${baseUrl}`
  );
  if (reportPath) {
    console.log(`[runtime-guard] report=${reportPath}`);
  }
  if (notifyEnabled) {
    console.log(`[runtime-guard] telegram_sent=${Boolean(telegram.sent)} reason=${String(telegram.reason || "")}`);
  }
  if (!evaluation.ok && applyExitCode) {
    process.exitCode = 1;
  }
  return output;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runRuntimeGuard(parseArgs(process.argv.slice(2))).catch((err) => {
    console.error("[err] v5_runtime_guard failed:", err?.message || err);
    process.exitCode = 1;
  });
}

export { parseArgs, parseBool, toNumber, resolveBaseUrl, evaluateRuntimeHealth, runRuntimeGuard };
