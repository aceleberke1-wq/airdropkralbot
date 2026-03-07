"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createChatTrustNotificationService } = require("../src/services/chatTrustNotificationService");

function createPoolStub() {
  return {
    async connect() {
      return {
        release() {}
      };
    }
  };
}

test("chat trust notification service sends payout update with canonical mini app buttons", async () => {
  const sentPayloads = [];
  const service = createChatTrustNotificationService({
    pool: createPoolStub(),
    getProfileByUserId: async () => ({
      user_id: 7,
      telegram_id: 777,
      locale: "en"
    }),
    fetchImpl: async (_url, options) => {
      sentPayloads.push(JSON.parse(String(options.body || "{}")));
      return {
        ok: true
      };
    },
    botToken: "bot_token",
    botUsername: "airdropkral_2026_bot",
    webappPublicUrl: "https://example.com/app",
    webappHmacSecret: "secret",
    resolveWebappVersion: async () => ({ version: "abc123" }),
    logger: () => {}
  });

  const result = await service.sendTrustNotification({
    kind: "payout",
    decision: "paid",
    userId: 7,
    request: {
      id: 18,
      user_id: 7,
      currency: "BTC",
      amount: 0.00052,
      tx_hash: "btc_tx_hash_123"
    }
  });

  assert.equal(result.sent, true);
  assert.equal(sentPayloads.length, 1);
  assert.equal(sentPayloads[0].chat_id, 777);
  assert.match(sentPayloads[0].text, /\*Payout Update\*/);
  assert.equal(sentPayloads[0].reply_markup.inline_keyboard.length, 2);
  const firstButton = sentPayloads[0].reply_markup.inline_keyboard[0][0];
  assert.ok(firstButton.web_app.url.includes("route_key=vault"));
  assert.ok(firstButton.web_app.url.includes("launch_event_key=launch.alert.payout_update_payout_lane.open"));
});
