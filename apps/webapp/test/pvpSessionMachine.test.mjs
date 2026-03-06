import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function loadModule() {
  const target = pathToFileURL(
    path.join(process.cwd(), "apps", "webapp", "src", "core", "player", "pvpSessionMachine.js")
  ).href;
  return import(target);
}

test("buildPvpSessionMachine returns idle defaults for empty runtime", async () => {
  const mod = await loadModule();
  const fsm = mod.buildPvpSessionMachine({});

  assert.equal(fsm.session_ref, "");
  assert.equal(fsm.status, "idle");
  assert.equal(fsm.next_action_seq, 1);
  assert.equal(fsm.can_start, true);
  assert.equal(fsm.can_strike, false);
  assert.equal(fsm.can_resolve, false);
});

test("buildPvpSessionMachine computes action sequence and controls for active session", async () => {
  const mod = await loadModule();
  const fsm = mod.buildPvpSessionMachine({
    pvpRuntime: {
      session: {
        session_ref: "sess_123",
        status: "active",
        action_count: { self: 2, opponent: 1 }
      }
    }
  });

  assert.equal(fsm.session_ref, "sess_123");
  assert.equal(fsm.status, "active");
  assert.equal(fsm.next_action_seq, 3);
  assert.equal(fsm.can_start, false);
  assert.equal(fsm.can_strike, true);
  assert.equal(fsm.can_resolve, true);
});

test("buildPvpSessionMachine closes strike/resolve for resolved sessions", async () => {
  const mod = await loadModule();
  const fsm = mod.buildPvpSessionMachine({
    pvpRuntime: {
      session_ref: "sess_456",
      status: "resolved",
      action_count_self: 5
    }
  });

  assert.equal(fsm.can_start, true);
  assert.equal(fsm.can_refresh_state, true);
  assert.equal(fsm.can_strike, false);
  assert.equal(fsm.can_resolve, false);
});

test("buildPvpSessionMachine respects expected resolve action guard", async () => {
  const mod = await loadModule();
  const nowMs = Date.UTC(2026, 2, 6, 10, 0, 0);
  const fsm = mod.buildPvpSessionMachine({
    nowMs,
    pvpRuntime: {
      session: {
        session_ref: "sess_789",
        status: "running",
        action_count: { self: 0 },
        next_expected_action: "resolve",
        updated_at: new Date(nowMs - 1000).toISOString()
      }
    }
  });

  assert.equal(fsm.expected_action, "resolve");
  assert.equal(fsm.can_strike, false);
  assert.equal(fsm.can_resolve, true);
  assert.equal(fsm.refresh_interval_ms, 3000);
});

test("buildPvpSessionMachine marks stale session and accelerates refresh cadence", async () => {
  const mod = await loadModule();
  const nowMs = Date.UTC(2026, 2, 6, 10, 0, 0);
  const staleAt = new Date(nowMs - 30000).toISOString();
  const fsm = mod.buildPvpSessionMachine({
    nowMs,
    pvpRuntime: {
      session: {
        session_ref: "sess_stale_1",
        status: "active",
        action_count: { self: 1 },
        updated_at: staleAt
      }
    }
  });

  assert.equal(fsm.stale, true);
  assert.equal(fsm.should_refresh_now, true);
  assert.equal(fsm.refresh_interval_ms, 2500);
  assert.ok(fsm.last_event_age_ms >= 30000);
});
