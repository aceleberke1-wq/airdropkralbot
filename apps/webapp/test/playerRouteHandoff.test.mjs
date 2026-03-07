import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function loadModule() {
  const target = pathToFileURL(
    path.join(process.cwd(), "apps", "webapp", "src", "core", "player", "playerRouteHandoff.js")
  ).href;
  return import(target);
}

test("resolvePlayerRouteHandoff routes payout and wallet surfaces into vault tab", async () => {
  const mod = await loadModule();

  assert.deepEqual(
    mod.resolvePlayerRouteHandoff({
      panelKey: "wallet",
      focusKey: "connect"
    }),
    {
      route_key: "vault",
      panel_key: "wallet",
      focus_key: "connect",
      launch_event_key: "launch.internal.player_route_wallet.open",
      workspace: "player",
      tab: "vault"
    }
  );

  assert.deepEqual(
    mod.resolvePlayerRouteHandoff({
      panelKey: "payout",
      focusKey: "request"
    }),
    {
      route_key: "vault",
      panel_key: "payout",
      focus_key: "request",
      launch_event_key: "launch.internal.player_route_payout.open",
      workspace: "player",
      tab: "vault"
    }
  );
});

test("resolvePlayerRouteHandoff preserves player-side home support routes", async () => {
  const mod = await loadModule();

  assert.deepEqual(
    mod.resolvePlayerRouteHandoff({
      routeKey: "settings",
      panelKey: "support",
      focusKey: "faq_cards"
    }),
    {
      route_key: "settings",
      panel_key: "support",
      focus_key: "faq_cards",
      launch_event_key: "launch.internal.player_route_support.open",
      workspace: "player",
      tab: "home"
    }
  );
});
