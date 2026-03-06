import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function loadModule() {
  const target = pathToFileURL(
    path.join(process.cwd(), "apps", "webapp", "src", "core", "player", "tasksViewModel.js")
  ).href;
  return import(target);
}

test("buildTasksViewModel maps offer/mission and attempts summary", async () => {
  const mod = await loadModule();
  const vm = mod.buildTasksViewModel({
    offers: [{ id: 1, task_type: "raid", difficulty: 3 }],
    missions: [
      { mission_key: "m1", title: "Mission 1", completed: true, claimed: false },
      { mission_key: "m2", title: "Mission 2", completed: true, claimed: true }
    ],
    attempts: {
      active: { id: 41, task_type: "raid" },
      revealable: { id: 40 }
    },
    daily: { tasks_done: 2, daily_cap: 5 },
    taskResult: { action_request_id: "req_1", snapshot: { ok: true } }
  });

  assert.equal(vm.summary.offers_total, 1);
  assert.equal(vm.summary.missions_total, 2);
  assert.equal(vm.summary.missions_ready, 1);
  assert.equal(vm.summary.missions_claimed, 1);
  assert.equal(vm.summary.active_attempt_id, 41);
  assert.equal(vm.summary.revealable_attempt_id, 40);
  assert.equal(vm.summary.daily_progress_pct, 40);
  assert.equal(vm.summary.last_action_request_id, "req_1");
  assert.equal(vm.summary.last_snapshot_present, true);
  assert.equal(vm.has_data, true);
});

test("buildTasksViewModel handles empty payload safely", async () => {
  const mod = await loadModule();
  const vm = mod.buildTasksViewModel();

  assert.equal(vm.summary.offers_total, 0);
  assert.equal(vm.summary.missions_total, 0);
  assert.equal(vm.summary.daily_progress_pct, 0);
  assert.equal(vm.has_data, false);
});

