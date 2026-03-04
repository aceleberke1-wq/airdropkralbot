import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import dotenv from "dotenv";
import { Pool } from "pg";
import { buildSnapshot, parseArgs, toNumber, pct } from "./v5_kpi_snapshot.mjs";

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

function isoDay(date) {
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildDaySeries(days = 7) {
  const out = [];
  const count = Math.max(1, Math.min(30, Number(days || 7)));
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    d.setUTCDate(d.getUTCDate() - i);
    out.push(isoDay(d));
  }
  return out;
}

async function hasTable(db, tableName) {
  const normalized = String(tableName || "").trim().toLowerCase();
  if (!/^[a-z0-9_]+$/.test(normalized)) return false;
  const res = await db.query("SELECT to_regclass($1) IS NOT NULL AS ok;", [`public.${normalized}`]);
  return Boolean(res.rows?.[0]?.ok);
}

async function readWeeklyTrend(pool, trendDays = 7) {
  const safeDays = Math.max(1, Math.min(30, Number(trendDays || 7)));
  const intervalExpr = `${safeDays} day`;
  const days = buildDaySeries(safeDays);

  const exists = {
    monetizationLedger: await hasTable(pool, "v5_monetization_ledger"),
    payoutRequests: await hasTable(pool, "payout_requests"),
    userPasses: await hasTable(pool, "v5_user_passes"),
    cosmeticPurchases: await hasTable(pool, "v5_cosmetic_purchases"),
    marketplaceFees: await hasTable(pool, "v5_marketplace_fee_events")
  };

  const revenueRows = exists.monetizationLedger
    ? await pool
        .query(
          `SELECT
             date_trunc('day', created_at)::date AS day_date,
             COALESCE(SUM(amount), 0)::numeric AS revenue_amount,
             COUNT(*)::bigint AS revenue_events
           FROM v5_monetization_ledger
           WHERE created_at >= now() - ($1::interval)
             AND status = 'recorded'
           GROUP BY day_date
           ORDER BY day_date ASC;`,
          [intervalExpr]
        )
        .then((res) => res.rows || [])
    : [];

  const revenueByKind = exists.monetizationLedger
    ? await pool
        .query(
          `SELECT
             event_kind,
             COUNT(*)::bigint AS event_count,
             COALESCE(SUM(amount), 0)::numeric AS amount_total
           FROM v5_monetization_ledger
           WHERE created_at >= now() - ($1::interval)
             AND status = 'recorded'
           GROUP BY event_kind
           ORDER BY event_kind ASC;`,
          [intervalExpr]
        )
        .then((res) => res.rows || [])
    : [];

  const payoutRows = exists.payoutRequests
    ? await pool
        .query(
          `SELECT
             date_trunc('day', created_at)::date AS day_date,
             COUNT(*)::bigint AS total_requests,
             COUNT(*) FILTER (WHERE status = 'rejected')::bigint AS rejected_requests,
             COUNT(*) FILTER (WHERE status = 'paid')::bigint AS paid_requests
           FROM payout_requests
           WHERE created_at >= now() - ($1::interval)
           GROUP BY day_date
           ORDER BY day_date ASC;`,
          [intervalExpr]
        )
        .then((res) => res.rows || [])
    : [];

  const passRows = exists.userPasses
    ? await pool
        .query(
          `SELECT
             COUNT(*)::bigint AS activations,
             COUNT(DISTINCT user_id)::bigint AS buyers
           FROM v5_user_passes
           WHERE created_at >= now() - ($1::interval);`,
          [intervalExpr]
        )
        .then((res) => res.rows?.[0] || {})
    : {};

  const cosmeticRows = exists.cosmeticPurchases
    ? await pool
        .query(
          `SELECT
             COUNT(*)::bigint AS purchases,
             COUNT(DISTINCT user_id)::bigint AS buyers,
             COALESCE(SUM(amount_paid), 0)::numeric AS amount_total
           FROM v5_cosmetic_purchases
           WHERE created_at >= now() - ($1::interval);`,
          [intervalExpr]
        )
        .then((res) => res.rows?.[0] || {})
    : {};

  const feeRows = exists.marketplaceFees
    ? await pool
        .query(
          `SELECT
             COUNT(*)::bigint AS events,
             COALESCE(SUM(fee_amount), 0)::numeric AS fee_total
           FROM v5_marketplace_fee_events
           WHERE created_at >= now() - ($1::interval);`,
          [intervalExpr]
        )
        .then((res) => res.rows?.[0] || {})
    : {};

  const revenueByDay = new Map(
    revenueRows.map((row) => [
      isoDay(row.day_date),
      {
        revenue_amount: toNumber(row.revenue_amount, 0),
        revenue_events: toNumber(row.revenue_events, 0)
      }
    ])
  );
  const payoutByDay = new Map(
    payoutRows.map((row) => [
      isoDay(row.day_date),
      {
        total_requests: toNumber(row.total_requests, 0),
        rejected_requests: toNumber(row.rejected_requests, 0),
        paid_requests: toNumber(row.paid_requests, 0)
      }
    ])
  );

  const merged = days.map((dayKey) => {
    const revenue = revenueByDay.get(dayKey) || { revenue_amount: 0, revenue_events: 0 };
    const payout = payoutByDay.get(dayKey) || { total_requests: 0, rejected_requests: 0, paid_requests: 0 };
    return {
      day: dayKey,
      revenue_amount: Number(revenue.revenue_amount.toFixed(8)),
      revenue_events: revenue.revenue_events,
      payout_total_requests: payout.total_requests,
      payout_rejected_requests: payout.rejected_requests,
      payout_paid_requests: payout.paid_requests,
      payout_rejected_rate_pct: pct(payout.rejected_requests, payout.total_requests)
    };
  });

  const revenueTotal7d = Number(merged.reduce((acc, row) => acc + toNumber(row.revenue_amount, 0), 0).toFixed(8));
  const payoutRequests7d = merged.reduce((acc, row) => acc + toNumber(row.payout_total_requests, 0), 0);
  const payoutRejected7d = merged.reduce((acc, row) => acc + toNumber(row.payout_rejected_requests, 0), 0);

  return {
    trend_days: safeDays,
    by_day: merged,
    totals: {
      revenue_amount: revenueTotal7d,
      payout_total_requests: payoutRequests7d,
      payout_rejected_requests: payoutRejected7d,
      payout_rejected_rate_pct: pct(payoutRejected7d, payoutRequests7d)
    },
    monetization: {
      by_kind: revenueByKind.map((row) => ({
        event_kind: String(row.event_kind || ""),
        event_count: toNumber(row.event_count, 0),
        amount_total: Number(toNumber(row.amount_total, 0).toFixed(8))
      })),
      pass: {
        activations: toNumber(passRows.activations, 0),
        buyers: toNumber(passRows.buyers, 0)
      },
      cosmetic: {
        purchases: toNumber(cosmeticRows.purchases, 0),
        buyers: toNumber(cosmeticRows.buyers, 0),
        amount_total: Number(toNumber(cosmeticRows.amount_total, 0).toFixed(8))
      },
      marketplace_fee: {
        events: toNumber(feeRows.events, 0),
        fee_total: Number(toNumber(feeRows.fee_total, 0).toFixed(8))
      }
    },
    sources: exists
  };
}

function renderMarkdownReport(bundle) {
  const now = String(bundle.generated_at || new Date().toISOString());
  const short = bundle.snapshots?.h24 || {};
  const long = bundle.snapshots?.h72 || {};
  const weekly = bundle.weekly || {};
  const daily = Array.isArray(weekly.by_day) ? weekly.by_day : [];
  const lines = [];
  lines.push("# V5 KPI Bundle Report");
  lines.push("");
  lines.push(`Generated at: ${now}`);
  lines.push(`Window set: 24h + 72h + ${Number(weekly.trend_days || 7)}d`);
  lines.push("");
  lines.push("## KPI Overview");
  lines.push("");
  lines.push("| Metric | 24h | 72h |");
  lines.push("|---|---:|---:|");
  lines.push(`| Command events | ${toNumber(short.kpis?.command_events_24h, 0)} | ${toNumber(long.kpis?.command_events_24h, 0)} |`);
  lines.push(
    `| Unknown intent rate % | ${toNumber(short.kpis?.unknown_intent_rate_pct, 0)} | ${toNumber(long.kpis?.unknown_intent_rate_pct, 0)} |`
  );
  lines.push(
    `| Payout rejected rate % | ${toNumber(short.kpis?.payout_rejected_rate_pct, 0)} | ${toNumber(long.kpis?.payout_rejected_rate_pct, 0)} |`
  );
  lines.push(
    `| Wallet verify rate % | ${toNumber(short.kpis?.wallet_challenge_verify_rate_pct, 0)} | ${toNumber(long.kpis?.wallet_challenge_verify_rate_pct, 0)} |`
  );
  lines.push(
    `| Audit coverage proxy % | ${toNumber(short.kpis?.audit_coverage_proxy_pct, 0)} | ${toNumber(long.kpis?.audit_coverage_proxy_pct, 0)} |`
  );
  lines.push(
    `| TX verify error rate % | ${toNumber(short.kpis?.tx_verify_error_rate_pct, 0)} | ${toNumber(long.kpis?.tx_verify_error_rate_pct, 0)} |`
  );
  lines.push(
    `| Idempotency conflicts | ${toNumber(short.kpis?.idempotency_conflict_events_24h, 0)} | ${toNumber(long.kpis?.idempotency_conflict_events_24h, 0)} |`
  );
  lines.push(
    `| Invalid action request id | ${toNumber(short.kpis?.invalid_action_request_id_events_24h, 0)} | ${toNumber(
      long.kpis?.invalid_action_request_id_events_24h,
      0
    )} |`
  );
  const shortQueueTotal = toNumber(short.details?.queue_actions?.total_events, 0);
  const longQueueTotal = toNumber(long.details?.queue_actions?.total_events, 0);
  const shortQueueSuccess = toNumber(short.details?.queue_actions?.success_events, 0);
  const longQueueSuccess = toNumber(long.details?.queue_actions?.success_events, 0);
  lines.push(
    `| Queue success rate % | ${toNumber(short.details?.queue_actions?.success_rate, pct(shortQueueSuccess, shortQueueTotal))} | ${toNumber(
      long.details?.queue_actions?.success_rate,
      pct(longQueueSuccess, longQueueTotal)
    )} |`
  );
  lines.push(
    `| Queue pending rate % | ${toNumber(short.details?.queue_actions?.pending_rate, pct(short.details?.queue_actions?.queued_events, shortQueueTotal))} | ${toNumber(
      long.details?.queue_actions?.pending_rate,
      pct(long.details?.queue_actions?.queued_events, longQueueTotal)
    )} |`
  );
  lines.push(
    `| Queue failure rate % | ${toNumber(short.details?.queue_actions?.failure_rate, pct(short.details?.queue_actions?.failed_events, shortQueueTotal))} | ${toNumber(
      long.details?.queue_actions?.failure_rate,
      pct(long.details?.queue_actions?.failed_events, longQueueTotal)
    )} |`
  );
  lines.push(`| Queue completed events | ${toNumber(short.details?.queue_actions?.completed_events, 0)} | ${toNumber(long.details?.queue_actions?.completed_events, 0)} |`);
  lines.push(`| Queue failed events | ${toNumber(short.details?.queue_actions?.failed_events, 0)} | ${toNumber(long.details?.queue_actions?.failed_events, 0)} |`);
  lines.push(`| Queue queued events | ${toNumber(short.details?.queue_actions?.queued_events, 0)} | ${toNumber(long.details?.queue_actions?.queued_events, 0)} |`);
  lines.push("");
  const queueReasons = Array.isArray(short.details?.queue_failure_reasons) ? short.details.queue_failure_reasons : [];
  if (queueReasons.length > 0) {
    lines.push("## Queue Failure Reasons (24h)");
    lines.push("");
    lines.push("| Reason | Result Code | Error Code | HTTP | Exception | Events |");
    lines.push("|---|---|---|---:|---|---:|");
    for (const row of queueReasons.slice(0, 10)) {
      lines.push(
        `| ${String(row.reason || "unknown")} | ${String(row.result_code || "-")} | ${String(row.error_code || "-")} | ${String(
          row.http_status || "-"
        )} | ${String(row.exception_class || "-")} | ${toNumber(row.event_count, 0)} |`
      );
    }
    lines.push("");
  }

  lines.push("## Weekly Revenue / Dispute Trend");
  lines.push("");
  lines.push("| Day | Revenue | Payout Requests | Rejected | Rejected % |");
  lines.push("|---|---:|---:|---:|---:|");
  for (const row of daily) {
    lines.push(
      `| ${String(row.day || "")} | ${Number(toNumber(row.revenue_amount, 0).toFixed(8))} | ${toNumber(
        row.payout_total_requests,
        0
      )} | ${toNumber(row.payout_rejected_requests, 0)} | ${toNumber(row.payout_rejected_rate_pct, 0)} |`
    );
  }
  lines.push("");
  lines.push("## Weekly Summary");
  lines.push("");
  lines.push(`- Revenue total: ${toNumber(weekly.totals?.revenue_amount, 0)}`);
  lines.push(`- Payout request total: ${toNumber(weekly.totals?.payout_total_requests, 0)}`);
  lines.push(`- Payout rejected total: ${toNumber(weekly.totals?.payout_rejected_requests, 0)}`);
  lines.push(`- Payout rejected rate %: ${toNumber(weekly.totals?.payout_rejected_rate_pct, 0)}`);
  lines.push(`- Pass activations: ${toNumber(weekly.monetization?.pass?.activations, 0)}`);
  lines.push(`- Cosmetic purchases: ${toNumber(weekly.monetization?.cosmetic?.purchases, 0)}`);
  lines.push(`- Marketplace fee events: ${toNumber(weekly.monetization?.marketplace_fee?.events, 0)}`);
  return `${lines.join("\n")}\n`;
}

async function emitSloMetrics(pool, bundle) {
  const hasSlo = await hasTable(pool, "v5_operational_slo_metrics");
  if (!hasSlo) {
    return { inserted: 0, skipped: true };
  }

  const rows = [];
  const pushMetric = (metricKey, metricValue, sampleSize, windowKey, payload = {}) => {
    rows.push({
      metricKey: String(metricKey),
      metricValue: Number(toNumber(metricValue, 0)),
      sampleSize: Math.max(0, Math.round(toNumber(sampleSize, 0))),
      windowKey: String(windowKey),
      payload
    });
  };

  const s24 = bundle.snapshots?.h24 || {};
  const s72 = bundle.snapshots?.h72 || {};
  const w7 = bundle.weekly || {};

  pushMetric("unknown_intent_rate_pct", s24.kpis?.unknown_intent_rate_pct, s24.kpis?.unknown_intent_events_24h, "24h", {
    source: "v5_kpi_bundle"
  });
  pushMetric("unknown_intent_rate_pct", s72.kpis?.unknown_intent_rate_pct, s72.kpis?.unknown_intent_events_24h, "72h", {
    source: "v5_kpi_bundle"
  });
  pushMetric("payout_rejected_rate_pct", s24.kpis?.payout_rejected_rate_pct, s24.kpis?.payout_requests_24h, "24h", {
    source: "v5_kpi_bundle"
  });
  pushMetric("payout_rejected_rate_pct", s72.kpis?.payout_rejected_rate_pct, s72.kpis?.payout_requests_24h, "72h", {
    source: "v5_kpi_bundle"
  });
  pushMetric("audit_coverage_proxy_pct", s24.kpis?.audit_coverage_proxy_pct, s24.kpis?.queue_action_events_24h, "24h", {
    source: "v5_kpi_bundle"
  });
  pushMetric(
    "tx_verify_error_rate_pct",
    s24.kpis?.tx_verify_error_rate_pct,
    toNumber(s24.kpis?.tx_verify_events_24h, 0),
    "24h",
    { source: "v5_kpi_bundle" }
  );
  pushMetric(
    "idempotency_conflict_events_24h",
    s24.kpis?.idempotency_conflict_events_24h,
    s24.kpis?.queue_action_events_24h,
    "24h",
    { source: "v5_kpi_bundle" }
  );
  pushMetric(
    "wallet_challenge_verify_rate_pct",
    s24.kpis?.wallet_challenge_verify_rate_pct,
    toNumber(s24.details?.wallet?.issued_challenges, 0),
    "24h",
    { source: "v5_kpi_bundle" }
  );
  pushMetric("revenue_amount", w7.totals?.revenue_amount, w7.totals?.revenue_amount, "7d", { source: "v5_kpi_bundle" });
  pushMetric(
    "payout_dispute_rate_pct",
    w7.totals?.payout_rejected_rate_pct,
    w7.totals?.payout_total_requests,
    "7d",
    { source: "v5_kpi_bundle" }
  );

  for (const metric of rows) {
    await pool.query(
      `INSERT INTO v5_operational_slo_metrics
         (metric_key, metric_value, sample_size, window_key, payload_json, measured_at)
       VALUES
         ($1, $2, $3, $4, $5::jsonb, now());`,
      [metric.metricKey, metric.metricValue, metric.sampleSize, metric.windowKey, JSON.stringify(metric.payload || {})]
    );
  }

  return { inserted: rows.length, skipped: false };
}

async function buildKpiBundle(opts = {}) {
  const hoursShort = Math.max(1, Math.min(168, toNumber(opts.hoursShort, 24)));
  const hoursLong = Math.max(hoursShort, Math.min(168, toNumber(opts.hoursLong, 72)));
  const trendDays = Math.max(1, Math.min(30, toNumber(opts.trendDays, 7)));
  const emitSlo = parseBool(opts.emitSlo, true);

  const snapshot24 = await buildSnapshot({ windowHours: hoursShort });
  const snapshot72 = await buildSnapshot({ windowHours: hoursLong });

  const databaseUrl = String(process.env.DATABASE_URL || "").trim();
  if (!databaseUrl) {
    throw new Error("missing_env:DATABASE_URL");
  }
  const useSsl = String(process.env.DATABASE_SSL || "").trim() === "1";
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined
  });

  try {
    const weekly = await readWeeklyTrend(pool, trendDays);
    const bundle = {
      generated_at: new Date().toISOString(),
      config: {
        hours_short: hoursShort,
        hours_long: hoursLong,
        trend_days: trendDays,
        emit_slo: emitSlo
      },
      snapshots: {
        h24: snapshot24,
        h72: snapshot72
      },
      weekly
    };

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
    const jsonPath = path.join(outDir, `V5_KPI_BUNDLE_${stamp}.json`);
    const mdPath = path.join(outDir, `V5_KPI_BUNDLE_${stamp}.md`);
    const jsonLatest = path.join(outDir, "V5_KPI_BUNDLE_latest.json");
    const mdLatest = path.join(outDir, "V5_KPI_BUNDLE_latest.md");

    fs.writeFileSync(jsonPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
    fs.writeFileSync(jsonLatest, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
    const md = renderMarkdownReport(bundle);
    fs.writeFileSync(mdPath, md, "utf8");
    fs.writeFileSync(mdLatest, md, "utf8");

    const slo = emitSlo ? await emitSloMetrics(pool, bundle) : { inserted: 0, skipped: true };
    return {
      bundle,
      output: {
        jsonPath,
        mdPath,
        jsonLatest,
        mdLatest
      },
      slo
    };
  } finally {
    await pool.end().catch(() => {});
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await buildKpiBundle({
    hoursShort: args.hours_short ?? args.hoursShort,
    hoursLong: args.hours_long ?? args.hoursLong,
    trendDays: args.trend_days ?? args.trendDays,
    emitSlo: args.emit_slo ?? args.emitSlo
  });
  console.log(`[ok] KPI bundle generated: ${result.output.jsonPath}`);
  console.log(`[ok] KPI markdown generated: ${result.output.mdPath}`);
  console.log(
    `[summary] unknown_intent_24h=${toNumber(result.bundle.snapshots?.h24?.kpis?.unknown_intent_rate_pct, 0)} unknown_intent_72h=${toNumber(
      result.bundle.snapshots?.h72?.kpis?.unknown_intent_rate_pct,
      0
    )} payout_rejected_rate_7d=${toNumber(result.bundle.weekly?.totals?.payout_rejected_rate_pct, 0)} slo_inserted=${Number(
      result.slo?.inserted || 0
    )}`
  );
}

export { buildKpiBundle };

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  main().catch((err) => {
    console.error("[err] v5_kpi_bundle failed:", err?.message || err);
    process.exitCode = 1;
  });
}
