const test = require("node:test");
const assert = require("node:assert/strict");
const messages = require("../src/messages");

test("formatPayoutDecisionUpdate renders Turkish paid trust copy with tx proof", () => {
  const text = messages.formatPayoutDecisionUpdate(
    {
      id: 18,
      currency: "BTC",
      amount: 0.00052,
      status: "paid",
      tx_hash: "btc_tx_hash_123"
    },
    { lang: "tr", decision: "paid" }
  );

  assert.match(text, /\*Cekim Guncellemesi\*/);
  assert.match(text, /Talep: \*#18\*/);
  assert.match(text, /Durum: \*odendi\*/);
  assert.match(text, /TX: `btc\\_tx\\_hash\\_123`/);
  assert.match(text, /Payout ekranini/);
});

test("formatPayoutDecisionUpdate renders English rejected copy with review note", () => {
  const text = messages.formatPayoutDecisionUpdate(
    {
      id: 41,
      currency: "BTC",
      amount: 0.00013,
      status: "rejected"
    },
    { lang: "en", decision: "rejected", reason: "risk_review_hold" }
  );

  assert.match(text, /\*Payout Update\*/);
  assert.match(text, /Status: \*rejected\*/);
  assert.match(text, /Review note: \*risk\\_review\\_hold\*/);
  assert.match(text, /Open Support/);
});

test("formatTokenDecisionUpdate renders Turkish approved wallet-oriented copy", () => {
  const text = messages.formatTokenDecisionUpdate(
    {
      id: 77,
      token_symbol: "NXT",
      chain: "TON",
      token_amount: 142.25,
      usd_amount: 12.5,
      status: "approved",
      tx_hash: "0xtonapproved"
    },
    { lang: "tr", decision: "approved" }
  );

  assert.match(text, /\*Token Treasury Guncellemesi\*/);
  assert.match(text, /Teslim: \*142\.2500 NXT\*/);
  assert.match(text, /Zincir: \*TON\*/);
  assert.match(text, /Wallet Paneli/);
});

test("formatTokenDecisionUpdate renders English rejected support copy", () => {
  const text = messages.formatTokenDecisionUpdate(
    {
      id: 91,
      token_symbol: "NXT",
      chain: "ETH",
      token_amount: 10,
      usd_amount: 4.75,
      status: "rejected"
    },
    { lang: "en", decision: "rejected", reason: "manual_review_required" }
  );

  assert.match(text, /\*Token Treasury Update\*/);
  assert.match(text, /Status: \*rejected\*/);
  assert.match(text, /Review note: \*manual\\_review\\_required\*/);
  assert.match(text, /Open Support/);
});
