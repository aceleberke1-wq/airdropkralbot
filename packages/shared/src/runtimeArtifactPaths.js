"use strict";

const path = require("path");

function resolveRuntimeArtifactsDir(repoRootDir) {
  const repoRoot = path.resolve(String(repoRootDir || process.cwd()));
  const explicit = String(process.env.AKB_RUNTIME_ARTIFACT_DIR || "").trim();
  if (!explicit) {
    return path.join(repoRoot, ".runtime-artifacts");
  }
  if (path.isAbsolute(explicit)) {
    return explicit;
  }
  return path.resolve(repoRoot, explicit);
}

function resolveKpiBundleArtifactPaths(repoRootDir) {
  const rootDir = resolveRuntimeArtifactsDir(repoRootDir);
  const outDir = path.join(rootDir, "kpi");
  return {
    outDir,
    latestJsonPath: path.join(outDir, "V5_KPI_BUNDLE_latest.json"),
    latestMdPath: path.join(outDir, "V5_KPI_BUNDLE_latest.md")
  };
}

function resolveChatAlertArtifactPaths(repoRootDir) {
  const rootDir = resolveRuntimeArtifactsDir(repoRootDir);
  const outDir = path.join(rootDir, "alerts");
  return {
    outDir,
    latestJsonPath: path.join(outDir, "V5_CHAT_ALERT_DISPATCH_latest.json")
  };
}

function resolveLiveOpsDispatchArtifactPaths(repoRootDir) {
  const rootDir = resolveRuntimeArtifactsDir(repoRootDir);
  const outDir = path.join(rootDir, "liveops");
  return {
    outDir,
    latestJsonPath: path.join(outDir, "V5_LIVE_OPS_CAMPAIGN_DISPATCH_latest.json")
  };
}

module.exports = {
  resolveRuntimeArtifactsDir,
  resolveKpiBundleArtifactPaths,
  resolveChatAlertArtifactPaths,
  resolveLiveOpsDispatchArtifactPaths
};
