import { parseArgs, toNumber } from "./v5_kpi_snapshot.mjs";
import { buildKpiBundle } from "./v5_kpi_bundle.mjs";
import { ensureTxVerifyCanary } from "./v5_tx_verify_canary.mjs";
import { runRuntimeGuard } from "./v5_runtime_guard.mjs";

function parseBool(value, fallback = false) {
  if (value == null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCycle(options) {
  const started = Date.now();
  if (options.runtimeGuardEnabled) {
    const runtimeGuardArgs = {
      max_heartbeat_lag_sec: options.runtimeGuardMaxHeartbeatLagSec,
      require_bot: options.runtimeGuardRequireBot,
      emit_report: options.runtimeGuardEmitReport,
      notify_telegram: options.runtimeGuardNotifyTelegram,
      apply_exit_code: "false"
    };
    if (String(options.runtimeGuardBaseUrl || "").trim()) {
      runtimeGuardArgs.base_url = String(options.runtimeGuardBaseUrl).trim();
    }
    const runtimeGuard = await runRuntimeGuard(runtimeGuardArgs);
    console.log(
      `[cycle] runtime_guard ok=${Boolean(runtimeGuard?.evaluation?.ok)} failed=${Number(
        runtimeGuard?.evaluation?.failed_checks || 0
      )}`
    );
  }
  if (options.txVerifyCanaryEnabled) {
    const canary = await ensureTxVerifyCanary({
      windowHours: options.txVerifyCanaryWindowHours,
      minEvents: options.txVerifyCanaryMinEvents
    });
    console.log(
      `[cycle] tx_verify_canary ok=${Boolean(canary.ok)} inserted=${Boolean(canary.inserted)} reason=${String(
        canary.reason || "unknown"
      )}`
    );
  }
  const result = await buildKpiBundle(options);
  const elapsedMs = Date.now() - started;
  console.log(
    `[cycle] elapsed_ms=${elapsedMs} json=${result.output.jsonLatest} md=${result.output.mdLatest} slo_inserted=${Number(
      result.slo?.inserted || 0
    )}`
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const intervalMin = Math.max(5, Math.min(1440, toNumber(args.interval_min ?? args.intervalMin, 360)));
  const once = parseBool(args.once, false);
  const options = {
    hoursShort: args.hours_short ?? args.hoursShort ?? "24",
    hoursLong: args.hours_long ?? args.hoursLong ?? "72",
    trendDays: args.trend_days ?? args.trendDays ?? "7",
    emitSlo: args.emit_slo ?? args.emitSlo ?? "true",
    txVerifyCanaryEnabled: parseBool(
      args.tx_verify_canary_enabled ?? args.txVerifyCanaryEnabled ?? process.env.V5_TX_VERIFY_CANARY_ENABLED,
      true
    ),
    txVerifyCanaryWindowHours: args.tx_verify_canary_window_hours ?? args.txVerifyCanaryWindowHours ?? "24",
    txVerifyCanaryMinEvents: args.tx_verify_canary_min_events ?? args.txVerifyCanaryMinEvents ?? "1",
    runtimeGuardEnabled: parseBool(
      args.runtime_guard_enabled ?? args.runtimeGuardEnabled ?? process.env.V5_RUNTIME_GUARD_ENABLED,
      true
    ),
    runtimeGuardBaseUrl:
      args.runtime_guard_base_url ??
      args.runtimeGuardBaseUrl ??
      process.env.RUNTIME_GUARD_BASE_URL ??
      process.env.WEBAPP_PUBLIC_URL ??
      "",
    runtimeGuardMaxHeartbeatLagSec:
      args.runtime_guard_max_heartbeat_lag_sec ?? args.runtimeGuardMaxHeartbeatLagSec ?? "45",
    runtimeGuardRequireBot: args.runtime_guard_require_bot ?? args.runtimeGuardRequireBot ?? process.env.BOT_ENABLED ?? "1",
    runtimeGuardEmitReport: args.runtime_guard_emit_report ?? args.runtimeGuardEmitReport ?? "true",
    runtimeGuardNotifyTelegram: args.runtime_guard_notify_telegram ?? args.runtimeGuardNotifyTelegram ?? "false"
  };

  await runCycle(options);
  if (once) {
    console.log("[ok] v5_kpi_daemon completed once");
    return;
  }

  const intervalMs = intervalMin * 60 * 1000;
  console.log(`[info] v5_kpi_daemon started interval_min=${intervalMin}`);
  while (true) {
    await sleep(intervalMs);
    await runCycle(options);
  }
}

main().catch((err) => {
  console.error("[err] v5_kpi_daemon failed:", err?.message || err);
  process.exitCode = 1;
});
