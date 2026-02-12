const test = require("node:test");
const assert = require("node:assert/strict");
const economyStore = require("../src/stores/economyStore");
const { computeNextStreak } = require("../src/stores/userStore");

test("streak decay same day and missed days scenarios", () => {
  const now = new Date("2026-02-11T12:00:00Z");

  const sameDay = computeNextStreak({
    currentStreak: 10,
    lastActionAt: "2026-02-11T01:00:00Z",
    now,
    decayPerDay: 1
  });
  assert.equal(sameDay, 10);

  const nextDay = computeNextStreak({
    currentStreak: 10,
    lastActionAt: "2026-02-10T23:00:00Z",
    now,
    decayPerDay: 1
  });
  assert.equal(nextDay, 11);

  const missedDays = computeNextStreak({
    currentStreak: 10,
    lastActionAt: "2026-02-08T01:00:00Z",
    now,
    decayPerDay: 2
  });
  assert.equal(missedDays, 7);
});

test("creditCurrency is idempotent on duplicate ref_event_id", async () => {
  const calls = [];
  let inserted = false;
  const db = {
    async query(sql) {
      if (sql.includes("INSERT INTO currency_ledger")) {
        calls.push("insert_ledger");
        if (inserted) {
          const err = new Error("duplicate");
          err.code = "23505";
          throw err;
        }
        inserted = true;
        return { rows: [] };
      }
      if (sql.includes("INSERT INTO currency_balances")) {
        calls.push("update_balance");
        return { rows: [{ balance: "5" }] };
      }
      if (sql.includes("INSERT INTO daily_counters")) {
        calls.push("update_daily");
        return { rows: [] };
      }
      if (sql.includes("SELECT balance")) {
        calls.push("select_balance");
        return { rows: [{ balance: "5" }] };
      }
      throw new Error(`Unexpected SQL in test: ${sql}`);
    }
  };

  const first = await economyStore.creditCurrency(db, {
    userId: 1,
    currency: "SC",
    amount: 5,
    reason: "test",
    meta: {},
    refEventId: "11111111-1111-5111-8111-111111111111"
  });
  const second = await economyStore.creditCurrency(db, {
    userId: 1,
    currency: "SC",
    amount: 5,
    reason: "test",
    meta: {},
    refEventId: "11111111-1111-5111-8111-111111111111"
  });

  assert.equal(first.applied, true);
  assert.equal(second.applied, false);
  assert.deepEqual(calls, [
    "insert_ledger",
    "update_balance",
    "update_daily",
    "insert_ledger",
    "select_balance"
  ]);
});
