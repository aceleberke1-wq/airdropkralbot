import test from "node:test";
import assert from "node:assert/strict";
import { buildLaunchContextToken, normalizeLaunchContext } from "../src/core/navigation/launchContextState.js";

test("normalizeLaunchContext resolves canonical player and admin targets", () => {
  assert.deepEqual(normalizeLaunchContext({ route_key: "settings", panel_key: "language", focus_key: "locale_override" }), {
    route_key: "settings",
    panel_key: "language",
    focus_key: "locale_override",
    launch_event_key: "",
    workspace: "player",
    tab: "home"
  });

  assert.deepEqual(normalizeLaunchContext({ panel_key: "panel_admin_queue" }), {
    route_key: "admin",
    panel_key: "panel_admin_queue",
    focus_key: "",
    launch_event_key: "",
    workspace: "admin",
    tab: "home"
  });
});

test("buildLaunchContextToken stays stable for equivalent launch contexts", () => {
  const fromSnake = buildLaunchContextToken({
    route_key: "vault",
    panel_key: "payout",
    focus_key: "request",
    launch_event_key: "launch.command.payout.open",
    workspace: "player",
    tab: "vault"
  });
  const fromCamel = buildLaunchContextToken({
    routeKey: "vault",
    panelKey: "payout",
    focusKey: "request",
    launchEventKey: "launch.command.payout.open",
    workspace: "player",
    tab: "vault"
  });

  assert.equal(fromSnake, "vault:payout:request:launch.command.payout.open:player:vault");
  assert.equal(fromSnake, fromCamel);
});

test("normalizeLaunchContext returns null for empty input", () => {
  assert.equal(normalizeLaunchContext(null), null);
  assert.equal(buildLaunchContextToken(null), "");
});
