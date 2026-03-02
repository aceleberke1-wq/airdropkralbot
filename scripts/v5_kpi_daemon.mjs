import { parseArgs, toNumber } from "./v5_kpi_snapshot.mjs";
import { buildKpiBundle } from "./v5_kpi_bundle.mjs";

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
    emitSlo: args.emit_slo ?? args.emitSlo ?? "true"
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

