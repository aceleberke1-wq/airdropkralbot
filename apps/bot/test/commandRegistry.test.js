const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getCommandRegistry,
  toTelegramCommands,
  getPrimaryCommands,
  buildAliasLookup
} = require("../src/commands/registry");

test("registry commands keep key and localized descriptions", () => {
  const registry = getCommandRegistry();
  assert.ok(registry.length > 0);
  for (const item of registry) {
    assert.ok(item.key);
    assert.ok(item.description_tr || item.description_en);
    assert.ok(item.handler, `missing handler for ${item.key}`);
    assert.ok(item.min_role, `missing min_role for ${item.key}`);
    assert.ok(Array.isArray(item.intents) && item.intents.length > 0, `missing intents for ${item.key}`);
    assert.ok(Array.isArray(item.scenarios) && item.scenarios.length > 0, `missing scenarios for ${item.key}`);
    assert.ok(Array.isArray(item.outcomes) && item.outcomes.length > 0, `missing outcomes for ${item.key}`);
  }
});

test("primary commands are consistent between help and setMyCommands payload", () => {
  const registry = getCommandRegistry();
  const primary = getPrimaryCommands(registry);
  const telegram = toTelegramCommands(registry, "tr");
  const telegramKeys = new Set(telegram.map((x) => x.command));
  for (const cmd of primary) {
    assert.ok(telegramKeys.has(cmd.key), `missing primary command in setMyCommands: ${cmd.key}`);
    assert.ok(Array.isArray(cmd.scenarios) && cmd.scenarios.length > 0, `missing scenarios for ${cmd.key}`);
    assert.ok(Array.isArray(cmd.outcomes) && cmd.outcomes.length > 0, `missing outcomes for ${cmd.key}`);
  }
});

test("legacy aliases map to new command keys", () => {
  const lookup = buildAliasLookup(getCommandRegistry());
  assert.equal(lookup.get("payout"), "vault");
  assert.equal(lookup.get("raid"), "pvp");
  assert.equal(lookup.get("guide"), "story");
  assert.equal(lookup.get("dil"), "lang");
  assert.equal(lookup.get("language"), "lang");
});
