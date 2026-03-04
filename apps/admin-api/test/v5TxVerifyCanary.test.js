const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function loadTxCanary() {
  const target = pathToFileURL(path.join(process.cwd(), "scripts", "v5_tx_verify_canary.mjs")).href;
  return import(target);
}

test("shouldInsertSyntheticCanary returns false when floor already met", async () => {
  const mod = await loadTxCanary();
  assert.equal(
    mod.shouldInsertSyntheticCanary({
      verifyEvents: 3,
      minEvents: 1,
      forceInsert: false
    }),
    false
  );
});

test("shouldInsertSyntheticCanary returns true when below floor or forceInsert", async () => {
  const mod = await loadTxCanary();
  assert.equal(
    mod.shouldInsertSyntheticCanary({
      verifyEvents: 0,
      minEvents: 1,
      forceInsert: false
    }),
    true
  );
  assert.equal(
    mod.shouldInsertSyntheticCanary({
      verifyEvents: 5,
      minEvents: 1,
      forceInsert: true
    }),
    true
  );
});

