const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function loadRuntimeGuard() {
  const target = pathToFileURL(path.join(process.cwd(), "scripts", "v5_runtime_guard.mjs")).href;
  return import(target);
}

test("resolveBaseUrl strips trailing /webapp and slashes", async () => {
  const mod = await loadRuntimeGuard();
  assert.equal(mod.resolveBaseUrl("https://example.com/webapp"), "https://example.com");
  assert.equal(mod.resolveBaseUrl("https://example.com/webapp/"), "https://example.com");
  assert.equal(mod.resolveBaseUrl("https://example.com/"), "https://example.com");
});

test("evaluateRuntimeHealth passes healthy polling runtime", async () => {
  const mod = await loadRuntimeGuard();
  const evaluation = mod.evaluateRuntimeHealth(
    {
      ok: true,
      bot_runtime: {
        alive: true,
        lock_acquired: true,
        mode: "polling",
        heartbeat_lag_sec: 8,
        stale: false
      }
    },
    { requireBot: true, maxLagSec: 45 }
  );
  assert.equal(evaluation.ok, true);
  assert.equal(Number(evaluation.failed_checks || 0), 0);
});

test("evaluateRuntimeHealth fails when lock is not acquired", async () => {
  const mod = await loadRuntimeGuard();
  const evaluation = mod.evaluateRuntimeHealth(
    {
      ok: true,
      bot_runtime: {
        alive: true,
        lock_acquired: false,
        mode: "disabled",
        heartbeat_lag_sec: 120,
        stale: true
      }
    },
    { requireBot: true, maxLagSec: 45 }
  );
  assert.equal(evaluation.ok, false);
  assert.ok(Number(evaluation.failed_checks || 0) >= 1);
});

