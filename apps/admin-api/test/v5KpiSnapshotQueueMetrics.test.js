const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function loadSnapshotModule() {
  const target = pathToFileURL(path.join(process.cwd(), "scripts", "v5_kpi_snapshot.mjs")).href;
  return import(target);
}

test("normalizeQueueActionStats maps completed/failed/queued counters", async () => {
  const snapshot = await loadSnapshotModule();
  const out = snapshot.normalizeQueueActionStats({
    total_events: "10",
    success_events: "6",
    non_ok_events: "4",
    completed_events: "5",
    failed_events: "3",
    queued_events: "1",
    ok_events: "1"
  });
  assert.deepEqual(out, {
    total_events: 10,
    success_events: 6,
    non_ok_events: 3,
    pending_events: 1,
    completed_events: 5,
    failed_events: 3,
    queued_events: 1,
    ok_events: 1,
    success_rate: 60,
    pending_rate: 10,
    failure_rate: 30
  });
});

test("normalizeQueueFailureReasons returns deterministic reason rows", async () => {
  const snapshot = await loadSnapshotModule();
  const rows = snapshot.normalizeQueueFailureReasons([
    { result_code: "policy_hold", error_code: "admin_cooldown_active", http_status: "409", exception_class: "", event_count: "4" },
    { result_code: "", error_code: "", http_status: "", exception_class: "", event_count: "1" }
  ]);
  assert.deepEqual(rows, [
    {
      reason: "admin_cooldown_active",
      result_code: "policy_hold",
      error_code: "admin_cooldown_active",
      http_status: 409,
      exception_class: null,
      event_count: 4
    },
    {
      reason: "unknown",
      result_code: null,
      error_code: null,
      http_status: null,
      exception_class: null,
      event_count: 1
    }
  ]);
});
