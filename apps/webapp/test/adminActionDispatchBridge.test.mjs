import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function loadBridgeModule() {
  const target = pathToFileURL(path.join(process.cwd(), "apps", "webapp", "src", "core", "admin", "actionDispatchBridge.js")).href;
  return import(target);
}

test("normalizeActionRequestId validates format", async () => {
  const bridge = await loadBridgeModule();
  assert.equal(bridge.normalizeActionRequestId(" admin_123 "), "admin_123");
  assert.equal(bridge.normalizeActionRequestId("bad id"), "");
  assert.equal(bridge.normalizeActionRequestId("x"), "");
});

test("resolveActionRequestId prioritizes explicit then pending then generated", async () => {
  const bridge = await loadBridgeModule();
  assert.equal(
    bridge.resolveActionRequestId("explicit_12345", "pending_54321", "x"),
    "explicit_12345"
  );
  assert.equal(
    bridge.resolveActionRequestId("", "pending_54321", "x"),
    "pending_54321"
  );
  const generated = bridge.resolveActionRequestId("", "", "bridge_test");
  assert.match(generated, /^bridge_test_/);
});

test("isRetriableAdminFetchError recognizes timeout and network failures", async () => {
  const bridge = await loadBridgeModule();
  assert.equal(bridge.isRetriableAdminFetchError({ name: "AbortError" }), true);
  assert.equal(bridge.isRetriableAdminFetchError({ message: "Failed to fetch" }), true);
  assert.equal(bridge.isRetriableAdminFetchError({ message: "Validation error" }), false);
});
