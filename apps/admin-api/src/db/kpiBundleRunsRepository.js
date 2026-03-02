"use strict";

const { firstRow, toBoolean } = require("./sql");

function createKpiBundleRunsRepository({ pool, logger }) {
  if (!pool || typeof pool.query !== "function") {
    throw new Error("kpi_bundle_runs_repository_requires_pool");
  }

  let tableExistsCache = {
    checkedAt: 0,
    exists: false
  };

  async function hasRunsTable() {
    const now = Date.now();
    if (now - tableExistsCache.checkedAt < 30000) {
      return tableExistsCache.exists;
    }
    try {
      const res = await pool.query("SELECT to_regclass('public.v5_kpi_bundle_runs') IS NOT NULL AS ok;");
      const exists = toBoolean(firstRow(res, {}).ok, false);
      tableExistsCache = { checkedAt: now, exists };
      return exists;
    } catch (err) {
      if (logger && typeof logger.warn === "function") {
        logger.warn({ err: String(err?.message || err) }, "kpi_runs_table_check_failed");
      }
      tableExistsCache = { checkedAt: now, exists: false };
      return false;
    }
  }

  async function insertRun(row) {
    if (!(await hasRunsTable())) {
      return { persisted: false, reason: "table_missing" };
    }
    await pool.query(
      `INSERT INTO v5_kpi_bundle_runs
         (run_ref, requested_by, status, trigger_source, config_json, output_json, started_at, finished_at, duration_ms, error_text)
       VALUES
         ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::timestamptz, $8::timestamptz, $9, $10);`,
      [
        String(row.run_ref || ""),
        Number(row.requested_by || 0),
        String(row.status || "failed"),
        String(row.trigger_source || "webapp_v2_admin_ops"),
        JSON.stringify(row.config_json || {}),
        JSON.stringify(row.output_json || {}),
        String(row.started_at || new Date().toISOString()),
        String(row.finished_at || new Date().toISOString()),
        Math.max(0, Math.round(Number(row.duration_ms || 0))),
        row.error_text ? String(row.error_text).slice(0, 2000) : null
      ]
    );
    return { persisted: true };
  }

  return {
    hasRunsTable,
    insertRun
  };
}

module.exports = {
  createKpiBundleRunsRepository
};
