const test = require("node:test");
const assert = require("node:assert/strict");
const payoutStore = require("../src/stores/payoutStore");
const messages = require("../src/messages");

test("createRequest returns null on unique conflict", async () => {
  const db = {
    async query(sql) {
      if (sql.includes("INSERT INTO payout_requests")) {
        const err = new Error("duplicate");
        err.code = "23505";
        throw err;
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };

  const row = await payoutStore.createRequest(db, {
    userId: 1,
    currency: "BTC",
    amount: 0.0002,
    addressType: "BTC_MAIN",
    addressHash: "hash",
    cooldownHours: 72
  });

  assert.equal(row, null);
});

test("formatPayout renders dynamic entitlement and tx hash", () => {
  const text = messages.formatPayout({
    entitledBtc: 0.00123456,
    thresholdBtc: 0.0001,
    cooldownUntil: "2026-02-11T11:12:13.000Z",
    canRequest: false,
    latest: {
      id: 12,
      status: "paid",
      amount: 0.0005,
      tx_hash: "abc123tx"
    }
  });

  assert.match(text, /Entitlement: \*0\.00123456 BTC\*/);
  assert.match(text, /Son Talep: #12 paid 0\.00050000 BTC/);
  assert.match(text, /TX: abc123tx/);
});
