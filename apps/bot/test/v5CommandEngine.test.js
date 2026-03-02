const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeCommandContract,
  validateCommandRegistry
} = require("../../../packages/shared/src/v5/commandEngine");

test("normalizeCommandContract derives handler and min_role", () => {
  const row = normalizeCommandContract({
    key: "Story",
    aliases: ["guide"],
    description_tr: "hikaye",
    adminOnly: false,
    scenarios: ["help me start", "where to begin"],
    outcomes: ["shows onboarding flow"]
  });
  assert.equal(row.key, "story");
  assert.equal(row.handler, "story");
  assert.equal(row.min_role, "player");
  assert.deepEqual(row.aliases, ["guide"]);
  assert.deepEqual(row.scenarios, ["help me start", "where to begin"]);
  assert.deepEqual(row.outcomes, ["shows onboarding flow"]);
});

test("normalizeCommandContract provides deterministic fallbacks for missing contract text", () => {
  const row = normalizeCommandContract({
    key: "admin_queue",
    description_en: "Unified admin queue"
  });
  assert.equal(row.key, "admin_queue");
  assert.equal(row.handler, "admin_queue");
  assert.ok(Array.isArray(row.intents) && row.intents.length > 0);
  assert.ok(Array.isArray(row.scenarios) && row.scenarios.length > 0);
  assert.ok(Array.isArray(row.outcomes) && row.outcomes.length > 0);
});

test("validateCommandRegistry detects alias conflicts", () => {
  const result = validateCommandRegistry([
    { key: "story", aliases: ["guide"], description_tr: "a" },
    { key: "help", aliases: ["guide"], description_tr: "b" }
  ]);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((x) => x.startsWith("alias_conflict:guide")));
});

test("validateCommandRegistry rejects commands without descriptions", () => {
  const result = validateCommandRegistry([{ key: "help", aliases: [] }]);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((x) => x === "missing_description:help"));
});
