import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function loadModule() {
  const target = pathToFileURL(
    path.join(process.cwd(), "apps", "webapp", "src", "core", "player", "shellPanelState.js")
  ).href;
  return import(target);
}

test("resolvePlayerShellPanelTarget maps settings route and language panel", async () => {
  const mod = await loadModule();

  assert.deepEqual(
    mod.resolvePlayerShellPanelTarget({
      tab: "home",
      launchContext: { route_key: "settings", panel_key: "language", focus_key: "accessibility" }
    }),
    {
      panel_key: "settings",
      source_panel_key: "language",
      focus_key: "accessibility",
      token: "settings:language:accessibility"
    }
  );
});

test("resolvePlayerShellPanelTarget maps support and discover panels only on home tab", async () => {
  const mod = await loadModule();

  assert.deepEqual(
    mod.resolvePlayerShellPanelTarget({
      tab: "home",
      launchContext: { route_key: "hub", panel_key: "support", focus_key: "faq_cards" }
    }),
    {
      panel_key: "support",
      source_panel_key: "support",
      focus_key: "faq_cards",
      token: "support:support:faq_cards"
    }
  );

  assert.deepEqual(
    mod.resolvePlayerShellPanelTarget({
      tab: "home",
      launchContext: { route_key: "hub", panel_key: "discover", focus_key: "command_center" }
    }),
    {
      panel_key: "discover",
      source_panel_key: "discover",
      focus_key: "command_center",
      token: "discover:discover:command_center"
    }
  );

  assert.equal(
    mod.resolvePlayerShellPanelTarget({
      tab: "vault",
      launchContext: { route_key: "settings", panel_key: "language", focus_key: "locale_override" }
    }),
    null
  );
});

test("resolvePlayerShellPanelTarget maps profile and status on home, rewards on vault", async () => {
  const mod = await loadModule();

  assert.deepEqual(
    mod.resolvePlayerShellPanelTarget({
      tab: "home",
      launchContext: { route_key: "hub", panel_key: "profile" }
    }),
    {
      panel_key: "profile",
      source_panel_key: "profile",
      focus_key: "identity",
      token: "profile:profile:identity"
    }
  );

  assert.deepEqual(
    mod.resolvePlayerShellPanelTarget({
      tab: "home",
      launchContext: { route_key: "hub", panel_key: "status" }
    }),
    {
      panel_key: "status",
      source_panel_key: "status",
      focus_key: "system_status",
      token: "status:status:system_status"
    }
  );

  assert.deepEqual(
    mod.resolvePlayerShellPanelTarget({
      tab: "vault",
      launchContext: { route_key: "vault", panel_key: "rewards" }
    }),
    {
      panel_key: "rewards",
      source_panel_key: "rewards",
      focus_key: "premium_pass",
      token: "rewards:rewards:premium_pass"
    }
  );

  assert.equal(
    mod.resolvePlayerShellPanelTarget({
      tab: "home",
      launchContext: { route_key: "vault", panel_key: "rewards" }
    }),
    null
  );
});
