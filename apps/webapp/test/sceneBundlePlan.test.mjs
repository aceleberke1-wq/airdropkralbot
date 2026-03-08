import test from "node:test";
import assert from "node:assert/strict";

import { resolveSceneBundlePlan } from "../src/core/runtime/sceneBundlePlan.js";

test("resolveSceneBundlePlan keeps player home on core plus player surface", () => {
  const plan = resolveSceneBundlePlan({
    workspace: "player",
    tab: "home",
    effectiveQuality: "medium",
    profileKey: "player_home_medium"
  });

  assert.equal(plan.district_key, "central_hub");
  assert.deepEqual(plan.bundles, ["runtime_core", "player_surface"]);
  assert.deepEqual(plan.skipped_bundles, []);
});

test("resolveSceneBundlePlan degrades low-end pvp by skipping cinematic bundle", () => {
  const plan = resolveSceneBundlePlan({
    workspace: "player",
    tab: "pvp",
    effectiveQuality: "low",
    lowEndMode: true,
    profileKey: "player_pvp_low"
  });

  assert.equal(plan.district_key, "arena_prime");
  assert.deepEqual(plan.bundles, ["runtime_core", "player_surface", "pvp_core"]);
  assert.deepEqual(plan.skipped_bundles, ["pvp_cinematic"]);
});

test("resolveSceneBundlePlan routes admin workspace to ops surface bundle", () => {
  const plan = resolveSceneBundlePlan({
    workspace: "admin",
    tab: "vault",
    effectiveQuality: "high",
    profileKey: "admin_ops_high"
  });

  assert.equal(plan.district_key, "ops_citadel");
  assert.deepEqual(plan.bundles, ["runtime_core", "admin_surface"]);
});
