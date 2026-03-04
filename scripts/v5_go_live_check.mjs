import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import dotenv from "dotenv";
import { buildSnapshot, parseArgs, toNumber } from "./v5_kpi_snapshot.mjs";
import { evaluateCanary, parseThresholds } from "./v5_canary_guard.mjs";
import { STAGE_CANARY_DEFAULTS } from "./v5_rollout_canary.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const envPath = path.join(repoRoot, ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

function parseBool(value, fallback = false) {
  if (value == null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

function resolveGoLiveStage(rawStage) {
  const stage = String(rawStage || "100").trim().toLowerCase();
  if (stage === "25" || stage === "rollout_25" || stage === "rollout25") {
    return { key: "rollout_25", cliStage: "25" };
  }
  if (stage === "admin" || stage === "admin_canary") {
    return { key: "admin_canary", cliStage: "admin" };
  }
  return { key: "rollout_100", cliStage: "100" };
}

function buildGoLiveThresholdInput(args = {}, stageKey = "rollout_100") {
  const defaults = STAGE_CANARY_DEFAULTS[stageKey] || STAGE_CANARY_DEFAULTS.rollout_100;
  return {
    min_command_events_24h:
      args.min_command_events_24h ?? process.env.V5_GOLIVE_MIN_COMMAND_EVENTS_24H ?? defaults.min_command_events_24h,
    min_queue_success_rate_pct:
      args.min_queue_success_rate_pct ??
      process.env.V5_GOLIVE_MIN_QUEUE_SUCCESS_RATE_PCT ??
      defaults.min_queue_success_rate_pct,
    max_queue_failed_rate_pct:
      args.max_queue_failed_rate_pct ??
      process.env.V5_GOLIVE_MAX_QUEUE_FAILED_RATE_PCT ??
      defaults.max_queue_failed_rate_pct,
    max_queue_queued_events:
      args.max_queue_queued_events ?? process.env.V5_GOLIVE_MAX_QUEUE_QUEUED_EVENTS ?? defaults.max_queue_queued_events,
    max_tx_verify_error_rate_pct:
      args.max_tx_verify_error_rate_pct ??
      process.env.V5_GOLIVE_MAX_TX_VERIFY_ERROR_RATE_PCT ??
      defaults.max_tx_verify_error_rate_pct,
    max_idempotency_conflict_events_24h:
      args.max_idempotency_conflict_events_24h ??
      process.env.V5_GOLIVE_MAX_IDEMPOTENCY_CONFLICT_EVENTS_24H ??
      defaults.max_idempotency_conflict_events_24h,
    max_invalid_action_request_id_events_24h:
      args.max_invalid_action_request_id_events_24h ??
      process.env.V5_GOLIVE_MAX_INVALID_ACTION_REQUEST_ID_EVENTS_24H ??
      defaults.max_invalid_action_request_id_events_24h,
    max_snapshot_age_sec:
      args.max_snapshot_age_sec ??
      process.env.V5_GOLIVE_MAX_SNAPSHOT_AGE_SEC ??
      defaults.max_snapshot_age_sec ??
      1800,
    require_command_events:
      args.require_command_events ?? process.env.V5_GOLIVE_REQUIRE_COMMAND_EVENTS ?? String(defaults.require_command_events),
    require_queue_events:
      args.require_queue_events ?? process.env.V5_GOLIVE_REQUIRE_QUEUE_EVENTS ?? String(defaults.require_queue_events),
    require_tx_verify_events:
      args.require_tx_verify_events ?? process.env.V5_GOLIVE_REQUIRE_TX_VERIFY_EVENTS ?? String(defaults.require_tx_verify_events)
  };
}

function buildReadinessHints(snapshot, thresholds) {
  const commandEvents = toNumber(snapshot?.kpis?.command_events_24h, 0);
  const queueEvents = toNumber(snapshot?.kpis?.queue_action_events_24h, 0);
  const minCommands = Math.max(0, toNumber(thresholds?.min_command_events_24h, 0));
  const commandRequired = parseBool(thresholds?.require_command_events, true);
  const queueRequired = parseBool(thresholds?.require_queue_events, false);

  const missingCommandEvents = commandRequired ? Math.max(0, minCommands - commandEvents) : 0;
  const missingQueueEvents = queueRequired && queueEvents <= 0 ? 1 : 0;

  return {
    command_events_24h: commandEvents,
    min_command_events_24h: minCommands,
    queue_action_events_24h: queueEvents,
    command_events_ready: missingCommandEvents === 0,
    queue_events_ready: missingQueueEvents === 0,
    missing_command_events: missingCommandEvents,
    missing_queue_events: missingQueueEvents
  };
}

function formatGoLiveMarkdown(payload) {
  const stage = String(payload?.stage || "rollout_100");
  const ready = Boolean(payload?.evaluation?.ok);
  const hints = payload?.readiness_hints || {};
  const checks = Array.isArray(payload?.evaluation?.checks) ? payload.evaluation.checks : [];
  const lines = [];
  lines.push("# V5 Go-Live Checklist");
  lines.push("");
  lines.push(`- Generated at: \`${String(payload?.generated_at || "")}\``);
  lines.push(`- Stage: \`${stage}\``);
  lines.push(`- Window: \`${Number(payload?.window_hours || 24)}h\``);
  lines.push(`- Ready: \`${ready ? "yes" : "no"}\``);
  lines.push("");
  lines.push("## Readiness");
  lines.push(
    `- Command events: \`${Number(hints.command_events_24h || 0)} / ${Number(hints.min_command_events_24h || 0)}\` (missing: \`${Number(
      hints.missing_command_events || 0
    )}\`)`
  );
  lines.push(
    `- Queue action events: \`${Number(hints.queue_action_events_24h || 0)}\` (missing: \`${Number(hints.missing_queue_events || 0)}\`)`
  );
  lines.push("");
  lines.push("## Checks");
  for (const check of checks) {
    const note = check?.note ? ` | ${String(check.note)}` : "";
    lines.push(
      `- [${String(check?.status || "unknown").toUpperCase()}] ${String(check?.metric || "metric")} observed=${String(
        check?.observed ?? ""
      )} threshold=${String(check?.threshold ?? "")}${note}`
    );
  }
  lines.push("");
  lines.push("## Next Actions");
  if (ready) {
    lines.push("- Strict gate passed. Safe to run strict rollout.");
  } else {
    if (Number(hints.missing_command_events || 0) > 0) {
      lines.push(`- Collect at least ${Number(hints.missing_command_events || 0)} real slash command events.`);
    }
    if (Number(hints.missing_queue_events || 0) > 0) {
      lines.push("- Produce at least 1 real queue action event.");
    }
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function runNodeScript(scriptPath, scriptArgs = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...scriptArgs], {
      cwd: repoRoot,
      stdio: "inherit",
      env: process.env
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      const normalizedCode = Number(code || 0);
      if (normalizedCode !== 0) {
        reject(new Error(`child_failed:${path.basename(scriptPath)}:${normalizedCode}`));
        return;
      }
      resolve(true);
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const stage = resolveGoLiveStage(args.stage || process.env.V5_GOLIVE_STAGE || "100");
  const autoRollout = parseBool(args.auto_rollout ?? process.env.V5_GOLIVE_AUTO_ROLLOUT, false);
  const runChain = parseBool(args.run_chain ?? process.env.V5_GOLIVE_RUN_CHAIN, false);
  const windowHours = Math.max(1, Math.min(168, toNumber(args.hours ?? process.env.V5_GOLIVE_WINDOW_HOURS, 24)));

  const snapshot = await buildSnapshot({ windowHours });
  const thresholdInput = buildGoLiveThresholdInput(args, stage.key);
  const thresholds = parseThresholds(thresholdInput);
  const evaluation = evaluateCanary(snapshot, thresholds);
  const readinessHints = buildReadinessHints(snapshot, thresholds);

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
  const reportPayload = {
    generated_at: now.toISOString(),
    stage: stage.key,
    rollout_stage_arg: stage.cliStage,
    window_hours: windowHours,
    snapshot_generated_at: String(snapshot?.generated_at || ""),
    thresholds,
    readiness_hints: readinessHints,
    evaluation
  };

  const jsonStampedPath = path.join(outDir, `V5_GOLIVE_CHECK_${stamp}.json`);
  const jsonLatestPath = path.join(outDir, "V5_GOLIVE_CHECK_latest.json");
  const mdStampedPath = path.join(outDir, `V5_GOLIVE_CHECK_${stamp}.md`);
  const mdLatestPath = path.join(outDir, "V5_GOLIVE_CHECK_latest.md");
  fs.writeFileSync(jsonStampedPath, `${JSON.stringify(reportPayload, null, 2)}\n`, "utf8");
  fs.writeFileSync(jsonLatestPath, `${JSON.stringify(reportPayload, null, 2)}\n`, "utf8");
  fs.writeFileSync(mdStampedPath, formatGoLiveMarkdown(reportPayload), "utf8");
  fs.writeFileSync(mdLatestPath, formatGoLiveMarkdown(reportPayload), "utf8");

  console.log(`[golive] stage=${stage.key} ready=${evaluation.ok} failed=${evaluation.failed_checks} warned=${evaluation.warned_checks}`);
  console.log(
    `[golive] command_events=${readinessHints.command_events_24h}/${readinessHints.min_command_events_24h} queue_events=${readinessHints.queue_action_events_24h}`
  );
  console.log(`[golive] report_json=${jsonStampedPath}`);
  console.log(`[golive] report_md=${mdStampedPath}`);

  if (!autoRollout) {
    if (!evaluation.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (!evaluation.ok) {
    console.error("[golive] auto rollout skipped: strict gate not ready");
    process.exitCode = 1;
    return;
  }

  const strictArgs = [
    "--canary_hours",
    String(windowHours),
    "--canary_require_command_events",
    "true",
    "--canary_require_queue_events",
    "true",
    "--canary_require_tx_verify_events",
    String(parseBool(thresholds.require_tx_verify_events, false)),
    "--canary_min_command_events_24h",
    String(toNumber(thresholds.min_command_events_24h, 0)),
    "--canary_min_queue_success_rate_pct",
    String(toNumber(thresholds.min_queue_success_rate_pct, 0)),
    "--canary_max_queue_failed_rate_pct",
    String(toNumber(thresholds.max_queue_failed_rate_pct, 100)),
    "--canary_max_queue_queued_events",
    String(toNumber(thresholds.max_queue_queued_events, 0)),
    "--canary_max_tx_verify_error_rate_pct",
    String(toNumber(thresholds.max_tx_verify_error_rate_pct, 100)),
    "--canary_max_idempotency_conflict_events_24h",
    String(toNumber(thresholds.max_idempotency_conflict_events_24h, 0)),
    "--canary_max_invalid_action_request_id_events_24h",
    String(toNumber(thresholds.max_invalid_action_request_id_events_24h, 0)),
    "--canary_max_snapshot_age_sec",
    String(toNumber(thresholds.max_snapshot_age_sec, 1800))
  ];

  if (runChain && stage.key === "rollout_100") {
    await runNodeScript(path.join("scripts", "v5_rollout_canary.mjs"), ["--stage", "25", ...strictArgs]);
    await new Promise((resolve) => setTimeout(resolve, 12_000));
    await runNodeScript(path.join("scripts", "v5_rollout_canary.mjs"), ["--stage", "100", ...strictArgs]);
    console.log("[golive] strict rollout chain completed: 25 -> 100");
    return;
  }

  await runNodeScript(path.join("scripts", "v5_rollout_canary.mjs"), ["--stage", stage.cliStage, ...strictArgs]);
  console.log(`[golive] strict rollout completed: stage=${stage.key}`);
}

export { resolveGoLiveStage, buildGoLiveThresholdInput, buildReadinessHints, formatGoLiveMarkdown };

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  main().catch((err) => {
    console.error("[err] v5_go_live_check failed:", err?.message || err);
    process.exitCode = 1;
  });
}
