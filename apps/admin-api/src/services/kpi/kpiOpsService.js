"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { createKpiBundleRunsRepository } = require("../../db/kpiBundleRunsRepository");

function toInt(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function toBool(value, fallback) {
  if (value == null) {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function createRunRef() {
  return `kpi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function resolveKpiPaths(repoRootDir) {
  const docsDir = path.join(repoRootDir, "docs");
  return {
    scriptPath: path.join(repoRootDir, "scripts", "v5_kpi_bundle.mjs"),
    latestBundlePath: path.join(docsDir, "V5_KPI_BUNDLE_latest.json"),
    latestBundleMdPath: path.join(docsDir, "V5_KPI_BUNDLE_latest.md")
  };
}

function runNodeScript(scriptPath, args, options = {}) {
  const cwd = options.cwd || process.cwd();
  const timeoutMs = Math.max(10000, Number(options.timeoutMs || 180000));
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({
        code: Number(code ?? -1),
        signal: signal || "",
        stdout,
        stderr,
        duration_ms: Date.now() - startedAt
      });
    });
  });
}

function normalizeRunConfig(input = {}) {
  const hoursShort = toInt(input.hours_short, 24, 1, 168);
  const hoursLongDefault = Math.max(hoursShort, 72);
  const hoursLong = toInt(input.hours_long, hoursLongDefault, hoursShort, 168);
  const trendDays = toInt(input.trend_days, 7, 1, 30);
  const emitSlo = toBool(input.emit_slo, true);
  return {
    hours_short: hoursShort,
    hours_long: hoursLong,
    trend_days: trendDays,
    emit_slo: emitSlo
  };
}

function createKpiOpsService({ repoRootDir, pool, logger }) {
  if (!repoRootDir) {
    throw new Error("kpi_ops_service_requires_repo_root");
  }

  const repoRoot = path.resolve(repoRootDir);
  const paths = resolveKpiPaths(repoRoot);
  const repository = pool ? createKpiBundleRunsRepository({ pool, logger }) : null;

  async function getLatestBundle() {
    if (!fs.existsSync(paths.latestBundlePath)) {
      const err = new Error("kpi_bundle_not_found");
      err.code = "kpi_bundle_not_found";
      throw err;
    }
    const bundle = readJsonFile(paths.latestBundlePath);
    const stat = fs.statSync(paths.latestBundlePath);
    return {
      bundle,
      source_file: paths.latestBundlePath,
      markdown_file: paths.latestBundleMdPath,
      updated_at: stat.mtime.toISOString()
    };
  }

  async function runBundle({ requestedBy = 0, triggerSource = "webapp_v2_admin_ops", config = {} } = {}) {
    const runRef = createRunRef();
    const safeConfig = normalizeRunConfig(config);
    const args = [
      "--hours_short",
      String(safeConfig.hours_short),
      "--hours_long",
      String(safeConfig.hours_long),
      "--trend_days",
      String(safeConfig.trend_days),
      "--emit_slo",
      safeConfig.emit_slo ? "true" : "false"
    ];
    const startedAtIso = new Date().toISOString();
    const runResult = await runNodeScript(paths.scriptPath, args, {
      cwd: repoRoot
    });
    const finishedAtIso = new Date().toISOString();
    const status = runResult.code === 0 ? "success" : runResult.signal ? "timeout" : "failed";
    let bundlePayload = null;
    let readError = "";
    try {
      bundlePayload = await getLatestBundle();
    } catch (err) {
      readError = String(err?.message || err);
    }

    if (repository) {
      await repository.insertRun({
        run_ref: runRef,
        requested_by: requestedBy,
        status,
        trigger_source: triggerSource,
        config_json: safeConfig,
        output_json: {
          exit_code: runResult.code,
          signal: runResult.signal,
          stdout: String(runResult.stdout || "").slice(0, 4000),
          stderr: String(runResult.stderr || "").slice(0, 4000),
          bundle_generated_at: bundlePayload?.bundle?.generated_at || null
        },
        started_at: startedAtIso,
        finished_at: finishedAtIso,
        duration_ms: runResult.duration_ms,
        error_text: readError || (status === "success" ? "" : String(runResult.stderr || runResult.stdout || "").slice(0, 2000))
      });
    }

    return {
      run_ref: runRef,
      status,
      duration_ms: runResult.duration_ms,
      started_at: startedAtIso,
      finished_at: finishedAtIso,
      stdout: runResult.stdout,
      stderr: runResult.stderr,
      exit_code: runResult.code,
      signal: runResult.signal,
      snapshot: bundlePayload?.bundle || null,
      snapshot_meta: bundlePayload
        ? {
            source_file: bundlePayload.source_file,
            markdown_file: bundlePayload.markdown_file,
            updated_at: bundlePayload.updated_at
          }
        : null,
      read_error: readError || null
    };
  }

  return {
    getLatestBundle,
    runBundle
  };
}

module.exports = {
  createKpiOpsService
};
