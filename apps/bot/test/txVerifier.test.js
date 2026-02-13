const test = require("node:test");
const assert = require("node:assert/strict");
const txVerifier = require("../src/services/txVerifier");

test("validateTxHash applies chain formats", () => {
  const btc = txVerifier.validateTxHash("btc", "0x".padEnd(66, "a"));
  assert.equal(btc.ok, true);
  assert.equal(btc.normalizedHash.length, 64);

  const eth = txVerifier.validateTxHash("eth", "a".repeat(64));
  assert.equal(eth.ok, true);
  assert.ok(eth.normalizedHash.startsWith("0x"));

  const trxInvalid = txVerifier.validateTxHash("trx", "xyz");
  assert.equal(trxInvalid.ok, false);
  assert.equal(trxInvalid.reason, "invalid_tx_hash_format");
});

test("verifyOnchain returns skipped when disabled", async () => {
  const result = await txVerifier.verifyOnchain("ETH", "0x".padEnd(66, "a"), { enabled: false });
  assert.equal(result.status, "skipped");
});

