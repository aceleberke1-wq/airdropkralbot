const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const {
  resolveRuntimeArtifactsDir,
  resolveKpiBundleArtifactPaths,
  resolveChatAlertArtifactPaths
} = require("../../../packages/shared/src/runtimeArtifactPaths.js");

test("runtime artifact paths default under repo-local ignored directory", () => {
  const repoRoot = process.cwd();
  const rootDir = resolveRuntimeArtifactsDir(repoRoot);
  const kpi = resolveKpiBundleArtifactPaths(repoRoot);

  assert.equal(rootDir, path.join(repoRoot, ".runtime-artifacts"));
  assert.equal(kpi.outDir, path.join(repoRoot, ".runtime-artifacts", "kpi"));
  assert.equal(kpi.latestJsonPath, path.join(repoRoot, ".runtime-artifacts", "kpi", "V5_KPI_BUNDLE_latest.json"));
  assert.equal(kpi.latestMdPath, path.join(repoRoot, ".runtime-artifacts", "kpi", "V5_KPI_BUNDLE_latest.md"));
  const alerts = resolveChatAlertArtifactPaths(repoRoot);
  assert.equal(alerts.outDir, path.join(repoRoot, ".runtime-artifacts", "alerts"));
  assert.equal(alerts.latestJsonPath, path.join(repoRoot, ".runtime-artifacts", "alerts", "V5_CHAT_ALERT_DISPATCH_latest.json"));
});

test("runtime artifact paths honor explicit relative override", () => {
  const repoRoot = process.cwd();
  const previous = process.env.AKB_RUNTIME_ARTIFACT_DIR;
  process.env.AKB_RUNTIME_ARTIFACT_DIR = ".ops-output";

  try {
    const rootDir = resolveRuntimeArtifactsDir(repoRoot);
    assert.equal(rootDir, path.join(repoRoot, ".ops-output"));
  } finally {
    if (previous == null) {
      delete process.env.AKB_RUNTIME_ARTIFACT_DIR;
    } else {
      process.env.AKB_RUNTIME_ARTIFACT_DIR = previous;
    }
  }
});
