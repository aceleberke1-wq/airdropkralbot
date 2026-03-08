"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveLiveOpsSceneGate } = require("../../../packages/shared/src/liveOpsSceneGate.cjs");

test("resolveLiveOpsSceneGate blocks scheduler on alert band", () => {
  const gate = resolveLiveOpsSceneGate(
    {
      total_24h: 10,
      alarm_state_7d: "alert"
    },
    {
      targeting: {
        max_recipients: 40
      }
    }
  );

  assert.equal(gate.scene_gate_state, "alert");
  assert.equal(gate.scene_gate_effect, "blocked");
  assert.equal(gate.scene_gate_reason, "scene_runtime_alert_blocked");
  assert.equal(gate.scene_gate_recipient_cap, 0);
  assert.equal(gate.ready_for_auto_dispatch, false);
});

test("resolveLiveOpsSceneGate caps scheduler on watch band", () => {
  const gate = resolveLiveOpsSceneGate(
    {
      total_24h: 10,
      alarm_state_7d: "watch"
    },
    {
      targeting: {
        max_recipients: 40
      }
    }
  );

  assert.equal(gate.scene_gate_state, "watch");
  assert.equal(gate.scene_gate_effect, "capped");
  assert.equal(gate.scene_gate_reason, "scene_runtime_watch_capped");
  assert.equal(gate.scene_gate_recipient_cap, 20);
  assert.equal(gate.ready_for_auto_dispatch, true);
});
