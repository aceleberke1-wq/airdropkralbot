const test = require("node:test");
const assert = require("node:assert/strict");
const { getCommandRegistry } = require("../src/commands/registry");
const { buildIntentIndex, resolveIntent, normalizeMode } = require("../src/commands/intentRouter");

test("intent router resolves TR text and mode aliases", () => {
  const index = buildIntentIndex(getCommandRegistry());
  const intent = resolveIntent("arena raid saldirgan", index);
  assert.ok(intent);
  assert.equal(intent.commandKey, "pvp");
  assert.equal(intent.mode, "aggressive");
});

test("intent router resolves EN text for vault and admin queue", () => {
  const index = buildIntentIndex(getCommandRegistry());
  const vaultIntent = resolveIntent("withdraw now", index);
  assert.ok(vaultIntent);
  assert.equal(vaultIntent.commandKey, "vault");

  const adminIntent = resolveIntent("admin queue", index);
  assert.ok(adminIntent);
  assert.equal(adminIntent.commandKey, "admin_queue");
});

test("normalizeMode keeps safe/balanced/aggressive mapping stable", () => {
  assert.equal(normalizeMode("temkinli"), "safe");
  assert.equal(normalizeMode("dengeli"), "balanced");
  assert.equal(normalizeMode("saldirgan"), "aggressive");
});

test("intent router tolerates minor typo for single-word commands", () => {
  const index = buildIntentIndex(getCommandRegistry());
  const intent = resolveIntent("walet", index);
  assert.ok(intent);
  assert.equal(intent.commandKey, "wallet");
});

test("intent router resolves command phrases inside natural sentence", () => {
  const index = buildIntentIndex(getCommandRegistry());
  const intent = resolveIntent("lutfen aggressive arena raid baslat", index);
  assert.ok(intent);
  assert.equal(intent.commandKey, "pvp");
  assert.equal(intent.mode, "aggressive");
});

test("intent router resolves typo and alias even when token is not first", () => {
  const index = buildIntentIndex(getCommandRegistry());
  const typoIntent = resolveIntent("abi walet panelini ac", index);
  assert.ok(typoIntent);
  assert.equal(typoIntent.commandKey, "wallet");

  const aliasIntent = resolveIntent("abi payout panelini ac", index);
  assert.ok(aliasIntent);
  assert.equal(aliasIntent.commandKey, "vault");
});

test("intent router resolves language command with argument", () => {
  const index = buildIntentIndex(getCommandRegistry());
  const intent = resolveIntent("dil en yap", index);
  assert.ok(intent);
  assert.equal(intent.commandKey, "lang");
  assert.ok(String(intent.argsText || "").includes("en"));
});
