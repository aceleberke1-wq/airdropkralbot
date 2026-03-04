import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildSnapshot, parseArgs, toNumber, pct } from "./v5_kpi_snapshot.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

function parseBool(value, fallback = false) {
  if (value == null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

function parseThresholds(args = {}) {
  return {
    min_command_events_24h: Math.max(0, toNumber(args.min_command_events_24h, 1)),
    min_queue_success_rate_pct: Math.max(0, Math.min(100, toNumber(args.min_queue_success_rate_pct, 80))),
    max_queue_failed_rate_pct: Math.max(0, Math.min(100, toNumber(args.max_queue_failed_rate_pct, 25))),
    max_queue_queued_events: Math.max(0, toNumber(args.max_queue_queued_events, 3)),
    max_tx_verify_error_rate_pct: Math.max(0, Math.min(100, toNumber(args.max_tx_verify_error_rate_pct, 20))),
    max_idempotency_conflict_events_24h: Math.max(0, toNumber(args.max_idempotency_conflict_events_24h, 3)),
    max_invalid_action_request_id_events_24h: Math.max(0, toNumber(args.max_invalid_action_request_id_events_24h, 1)),
    max_snapshot_age_sec: Math.max(60, toNumber(args.max_snapshot_age_sec, 1800)),
    require_queue_events: parseBool(args.require_queue_events, false),
    require_tx_verify_events: parseBool(args.require_tx_verify_events, false),
    require_command_events: parseBool(args.require_command_events, true)
  };
}

function computeSnapshotFreshnessSec(snapshot) {
  const explicitFreshness = toNumber(snapshot?.freshness_sec, -1);
  const generatedAtRaw = String(snapshot?.generated_at || "").trim();
  const generatedAtMs = generatedAtRaw ? Date.parse(generatedAtRaw) : NaN;
  const derivedFreshness = Number.isFinite(generatedAtMs) && generatedAtMs > 0 ? Math.max(0, Math.floor((Date.now() - generatedAtMs) / 1000)) : -1;
  if (explicitFreshness >= 0 && derivedFreshness >= 0) {
    return Math.max(Math.round(explicitFreshness), derivedFreshness);
  }
  if (explicitFreshness >= 0) {
    return Math.max(0, Math.round(explicitFreshness));
  }
  if (derivedFreshness >= 0) {
    return derivedFreshness;
  }
  return -1;
}

function evaluateCanary(snapshot, thresholds) {
  const checks = [];
  const pushCheck = (status, metric, observed, threshold, note = "") => {
    checks.push({
      status,
      metric,
      observed,
      threshold,
      note
    });
  };

  const kpis = snapshot?.kpis && typeof snapshot.kpis === "object" ? snapshot.kpis : {};
  const queue = snapshot?.details?.queue_actions && typeof snapshot.details.queue_actions === "object" ? snapshot.details.queue_actions : {};
  const txSubmit = snapshot?.details?.tx_submit && typeof snapshot.details.tx_submit === "object" ? snapshot.details.tx_submit : {};
  const freshnessSec = computeSnapshotFreshnessSec(snapshot);

  if (freshnessSec < 0) {
    pushCheck("warn", "snapshot_freshness_sec", "unknown", `<= ${thresholds.max_snapshot_age_sec}`, "snapshot generated_at missing or invalid.");
  } else if (freshnessSec > thresholds.max_snapshot_age_sec) {
    pushCheck("fail", "snapshot_freshness_sec", freshnessSec, `<= ${thresholds.max_snapshot_age_sec}`, "snapshot is stale.");
  } else {
    pushCheck("pass", "snapshot_freshness_sec", freshnessSec, `<= ${thresholds.max_snapshot_age_sec}`);
  }

  const commandEvents = toNumber(kpis.command_events_24h, 0);
  if (thresholds.require_command_events && commandEvents < thresholds.min_command_events_24h) {
    pushCheck("fail", "command_events_24h", commandEvents, `>= ${thresholds.min_command_events_24h}`, "Slash telemetry check failed.");
  } else {
    pushCheck("pass", "command_events_24h", commandEvents, `>= ${thresholds.min_command_events_24h}`);
  }

  const queueTotal = toNumber(queue.total_events, 0);
  const queueSuccess = toNumber(queue.success_events, 0);
  const queueFailed = toNumber(queue.failed_events, 0);
  const queueQueued = toNumber(queue.queued_events, 0);
  const queueSuccessRate = pct(queueSuccess, queueTotal);
  const queueFailedRate = pct(queueFailed, queueTotal);
  if (queueTotal <= 0) {
    const status = thresholds.require_queue_events ? "fail" : "warn";
    pushCheck(status, "queue_action_events_24h", queueTotal, thresholds.require_queue_events ? "> 0" : "optional", "No queue events in selected window.");
  } else {
    if (queueSuccessRate < thresholds.min_queue_success_rate_pct) {
      pushCheck("fail", "queue_success_rate_pct", queueSuccessRate, `>= ${thresholds.min_queue_success_rate_pct}`);
    } else {
      pushCheck("pass", "queue_success_rate_pct", queueSuccessRate, `>= ${thresholds.min_queue_success_rate_pct}`);
    }

    if (queueFailedRate > thresholds.max_queue_failed_rate_pct) {
      pushCheck("fail", "queue_failed_rate_pct", queueFailedRate, `<= ${thresholds.max_queue_failed_rate_pct}`);
    } else {
      pushCheck("pass", "queue_failed_rate_pct", queueFailedRate, `<= ${thresholds.max_queue_failed_rate_pct}`);
    }
  }

  if (queueQueued > thresholds.max_queue_queued_events) {
    pushCheck("fail", "queue_queued_events", queueQueued, `<= ${thresholds.max_queue_queued_events}`);
  } else {
    pushCheck("pass", "queue_queued_events", queueQueued, `<= ${thresholds.max_queue_queued_events}`);
  }

  const txVerifyEvents = toNumber(kpis.tx_verify_events_24h, toNumber(txSubmit.verify_events, 0));
  const txVerifyErrorRate = toNumber(kpis.tx_verify_error_rate_pct, pct(toNumber(txSubmit.verify_error_events, 0), txVerifyEvents));
  if (txVerifyEvents <= 0) {
    const status = thresholds.require_tx_verify_events ? "fail" : "warn";
    pushCheck(status, "tx_verify_events_24h", txVerifyEvents, thresholds.require_tx_verify_events ? "> 0" : "optional", "No tx verify samples.");
  } else if (txVerifyErrorRate > thresholds.max_tx_verify_error_rate_pct) {
    pushCheck("fail", "tx_verify_error_rate_pct", txVerifyErrorRate, `<= ${thresholds.max_tx_verify_error_rate_pct}`);
  } else {
    pushCheck("pass", "tx_verify_error_rate_pct", txVerifyErrorRate, `<= ${thresholds.max_tx_verify_error_rate_pct}`);
  }

  const idempotencyConflicts = toNumber(kpis.idempotency_conflict_events_24h, 0);
  const invalidActionRequestId = toNumber(kpis.invalid_action_request_id_events_24h, 0);
  if (idempotencyConflicts > thresholds.max_idempotency_conflict_events_24h) {
    pushCheck("fail", "idempotency_conflict_events_24h", idempotencyConflicts, `<= ${thresholds.max_idempotency_conflict_events_24h}`);
  } else {
    pushCheck("pass", "idempotency_conflict_events_24h", idempotencyConflicts, `<= ${thresholds.max_idempotency_conflict_events_24h}`);
  }
  if (invalidActionRequestId > thresholds.max_invalid_action_request_id_events_24h) {
    pushCheck("fail", "invalid_action_request_id_events_24h", invalidActionRequestId, `<= ${thresholds.max_invalid_action_request_id_events_24h}`);
  } else {
    pushCheck("pass", "invalid_action_request_id_events_24h", invalidActionRequestId, `<= ${thresholds.max_invalid_action_request_id_events_24h}`);
  }

  const failed = checks.filter((row) => row.status === "fail").length;
  const warned = checks.filter((row) => row.status === "warn").length;
  return {
    ok: failed === 0,
    failed_checks: failed,
    warned_checks: warned,
    checks
  };
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeGuardOutputs(resultPayload) {
  const outDir = path.join(repoRoot, "docs");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(
    2,
    "0"
  )}_${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}${String(
    now.getUTCSeconds()
  ).padStart(2, "0")}Z`;
  const stampedPath = path.join(outDir, `V5_CANARY_GUARD_${stamp}.json`);
  const latestPath = path.join(outDir, "V5_CANARY_GUARD_latest.json");
  fs.writeFileSync(stampedPath, `${JSON.stringify(resultPayload, null, 2)}\n`, "utf8");
  fs.writeFileSync(latestPath, `${JSON.stringify(resultPayload, null, 2)}\n`, "utf8");
  return { stampedPath, latestPath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const refreshSnapshot = parseBool(args.refresh_snapshot, false);
  const windowHours = Math.max(1, Math.min(168, toNumber(args.hours, 24)));
  const snapshotPath = args.snapshot
    ? path.resolve(String(args.snapshot))
    : path.join(repoRoot, "docs", "V5_KPI_SNAPSHOT_latest.json");
  const thresholds = parseThresholds(args);

  const snapshot = refreshSnapshot ? await buildSnapshot({ windowHours }) : readJsonFile(snapshotPath);
  const evaluation = evaluateCanary(snapshot, thresholds);

  const payload = {
    generated_at: new Date().toISOString(),
    source_snapshot: refreshSnapshot ? "in_memory_buildSnapshot" : snapshotPath,
    snapshot_generated_at: String(snapshot?.generated_at || ""),
    window_hours: toNumber(snapshot?.window_hours, windowHours),
    thresholds,
    evaluation
  };
  const outputs = writeGuardOutputs(payload);

  console.log(`[canary] ok=${evaluation.ok} failed=${evaluation.failed_checks} warned=${evaluation.warned_checks}`);
  for (const check of evaluation.checks) {
    const note = check.note ? ` | ${check.note}` : "";
    console.log(`[${check.status}] ${check.metric} observed=${check.observed} threshold=${check.threshold}${note}`);
  }
  console.log(`[canary] report: ${outputs.stampedPath}`);
  console.log(`[canary] latest: ${outputs.latestPath}`);

  if (!evaluation.ok) {
    process.exitCode = 1;
  }
}

export { evaluateCanary, parseThresholds, computeSnapshotFreshnessSec };

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  main().catch((err) => {
    console.error("[err] v5_canary_guard failed:", err?.message || err);
    process.exitCode = 1;
  });
}
