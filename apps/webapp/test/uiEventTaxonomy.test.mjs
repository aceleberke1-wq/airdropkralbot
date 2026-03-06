import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function loadTaxonomyModule() {
  const target = pathToFileURL(
    path.join(process.cwd(), "apps", "webapp", "src", "core", "telemetry", "uiEventTaxonomy.js")
  ).href;
  return import(target);
}

test("buildRouteKey normalizes workspace and tab", async () => {
  const taxonomy = await loadTaxonomyModule();
  assert.equal(taxonomy.buildRouteKey("player", "pvp"), "player_pvp");
  assert.equal(taxonomy.buildRouteKey("admin", "home"), "admin_home");
  assert.equal(taxonomy.buildRouteKey("admin", "unknown"), "admin_admin");
});

test("buildUiEventRecord enforces safe key formats and defaults", async () => {
  const taxonomy = await loadTaxonomyModule();
  const event = taxonomy.buildUiEventRecord({
    event_key: "Action Success",
    tab_key: "PVP",
    panel_key: "panel pvp",
    route_key: "player/pvp",
    funnel_key: "pvp loop",
    surface_key: "panel pvp",
    economy_event_key: "token quote",
    tx_state: "Intent!",
    event_value: 2
  });
  assert.equal(event.event_key, "action_success");
  assert.equal(event.tab_key, "pvp");
  assert.equal(event.panel_key, "panel_pvp");
  assert.equal(event.route_key, "player_pvp");
  assert.equal(event.funnel_key, "pvp_loop");
  assert.equal(event.surface_key, "panel_pvp");
  assert.equal(event.economy_event_key, "token_quote");
  assert.equal(event.tx_state, "intent_");
  assert.equal(event.event_value, 2);
});

test("taxonomy constants expose required loop keys", async () => {
  const taxonomy = await loadTaxonomyModule();
  assert.equal(taxonomy.UI_FUNNEL_KEY.PVP_LOOP, "pvp_loop");
  assert.equal(taxonomy.UI_SURFACE_KEY.PANEL_VAULT, "panel_vault");
  assert.equal(taxonomy.UI_ECONOMY_EVENT_KEY.TOKEN_SUBMIT_TX, "token_submit_tx");
});
