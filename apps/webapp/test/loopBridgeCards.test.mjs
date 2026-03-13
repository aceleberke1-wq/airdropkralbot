import test from "node:test";
import assert from "node:assert/strict";

import { resolveLoopBridgeMeta } from "../src/ui/loopBridgeCards.ts";

test("resolveLoopBridgeMeta returns the first meta-rich bridge item", () => {
  const meta = resolveLoopBridgeMeta(
    [
      { title: "empty", value: "--" },
      {
        title: "duel",
        value: "READY",
        focus_key: "arena_prime:duel:duel",
        risk_key: "yellow:watch:flat",
        risk_focus_key: "arena_prime:duel:duel|yellow:watch:flat",
        family_key: "duel",
        flow_key: "duel:duel",
        microflow_key: "duel",
        entry_kind_key: "world_entry_kind_duel_console",
        sequence_kind_key: "world_modal_kind_duel_sequence",
        action_context_signature:
          "duel:duel|arena_prime:duel:duel|world_entry_kind_duel_console|world_modal_kind_duel_sequence",
        risk_context_signature:
          "duel:duel|arena_prime:duel:duel|yellow:watch:flat|world_entry_kind_duel_console|world_modal_kind_duel_sequence"
      }
    ],
    [
      {
        title: "fallback",
        summary: "WAIT",
        gate: "WAIT"
      }
    ]
  );

  assert.ok(meta);
  assert.equal(meta.family_key, "duel");
  assert.equal(meta.microflow_key, "duel");
  assert.equal(meta.focus_key, "arena_prime:duel:duel");
  assert.equal(meta.risk_focus_key, "arena_prime:duel:duel|yellow:watch:flat");
});

test("resolveLoopBridgeMeta returns null when all collections are meta-empty", () => {
  const meta = resolveLoopBridgeMeta(
    [{ title: "empty", value: "--" }],
    [{ title: "panel", lines: ["-"] }]
  );

  assert.equal(meta, null);
});
