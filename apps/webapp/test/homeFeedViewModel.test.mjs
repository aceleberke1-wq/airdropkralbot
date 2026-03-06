import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function loadModule() {
  const target = pathToFileURL(
    path.join(process.cwd(), "apps", "webapp", "src", "core", "player", "homeFeedViewModel.js")
  ).href;
  return import(target);
}

test("buildHomeFeedViewModel maps home feed fields and mission preview", async () => {
  const mod = await loadModule();
  const vm = mod.buildHomeFeedViewModel({
    homeFeed: {
      profile: { public_name: "neo", kingdom_tier: 4, current_streak: 8 },
      season: { season_id: 2, days_left: 11, points: 4200 },
      daily: { tasks_done: 3, daily_cap: 5, sc_earned: 120, rc_earned: 7, hc_earned: 1 },
      mission: {
        total: 3,
        ready: 1,
        open: 2,
        list_preview: [{ mission_key: "m1", title: "Mission 1", completed: true, claimed: false }]
      },
      wallet_quick: { active: true, chain: "TON", address_masked: "UQ...123", kyc_status: "verified" },
      monetization_quick: {
        enabled: true,
        premium_active: true,
        active_pass_count: 2,
        spend_summary: { SC: 120, RC: 8, HC: 1 }
      },
      command_hint: [{ key: "play", description: "start session" }]
    }
  });

  assert.equal(vm.summary.player_name, "neo");
  assert.equal(vm.summary.task_fill_pct, 60);
  assert.equal(vm.summary.wallet_active, true);
  assert.equal(vm.summary.active_pass_count, 2);
  assert.equal(vm.mission_preview.length, 1);
  assert.equal(vm.command_hints[0].key, "play");
  assert.equal(vm.has_data, true);
});

test("buildHomeFeedViewModel falls back to bootstrap command catalog", async () => {
  const mod = await loadModule();
  const vm = mod.buildHomeFeedViewModel({
    bootstrap: {
      command_catalog: [{ key: "vault", description_tr: "kasa" }]
    }
  });

  assert.equal(vm.command_hints.length, 1);
  assert.equal(vm.command_hints[0].key, "vault");
});

test("buildHomeFeedViewModel handles empty payload safely", async () => {
  const mod = await loadModule();
  const vm = mod.buildHomeFeedViewModel({});

  assert.equal(vm.summary.player_name, "unknown");
  assert.equal(vm.command_hints.length, 0);
  assert.equal(vm.has_data, false);
});

