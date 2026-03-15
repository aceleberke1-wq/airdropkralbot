const test = require("node:test");
const assert = require("node:assert/strict");
const messages = require("../src/messages");
const { buildPlayKeyboard } = require("../src/ui/keyboards");
const { getCommandRegistry } = require("../src/commands/registry");
const { buildHelpCards } = require("../src/commands/helpCards");

test("formatGuide renders English copy when lang is en", () => {
  const text = messages.formatGuide(
    {
      profile: { public_name: "Alice", kingdom_tier: 2, current_streak: 5 },
      daily: { tasksDone: 1, dailyCap: 5 },
      offers: [{ id: 1 }],
      balances: { RC: 3 }
    },
    { lang: "en" }
  );

  assert.match(text, /\*Nexus Guide\*/);
  assert.match(text, /Best Next Move/);
  assert.doesNotMatch(text, /Nexus Rehber/);
});

test("formatOnboard renders English copy when lang is en", () => {
  const text = messages.formatOnboard(
    {
      profile: { public_name: "Bob", kingdom_tier: 1 },
      balances: { SC: 10, HC: 2, RC: 1 },
      daily: { tasksDone: 2, dailyCap: 5, scEarned: 7 },
      season: { seasonId: 9, daysLeft: 12 },
      token: { symbol: "NXT", balance: 1.2345, spotUsd: 0.00012 }
    },
    { lang: "en" }
  );

  assert.match(text, /\*Onboard \/\/ 3 Steps\*/);
  assert.match(text, /Player: \*/);
  assert.doesNotMatch(text, /Onboard \/\/ 3 Adim/);
});

test("buildPlayKeyboard uses English labels for en locale", () => {
  const keyboard = buildPlayKeyboard("https://example.com/app", "en");
  const rows = keyboard?.reply_markup?.inline_keyboard || [];
  const labels = rows.flat().map((button) => button.text);

  assert.deepEqual(labels, ["\ud83c\udfae Open Arena 3D", "\ud83c\udf10 Open in Browser", "\u21a9\ufe0f Back to Bot Panel"]);
});

test("help index rendering stays within budget and includes navigation hints", () => {
  const cards = buildHelpCards(getCommandRegistry()).slice(0, 6);
  const text = messages.formatHelpIndex({
    lang: "tr",
    categoryLabel: "Core Loop",
    categories: [
      { key: "core_loop", label: "Core Loop", active: true },
      { key: "economy", label: "Ekonomi", active: false }
    ],
    items: cards,
    page: 1,
    totalPages: 1,
    totalItems: cards.length
  });

  assert.ok(text.length <= 1800);
  assert.match(text, /\*Komut Merkezi \/\/ Indeks\*/);
  assert.match(text, /\/help <komut>/);
});

test("help command card keeps TR/EN limits", () => {
  const cards = buildHelpCards(getCommandRegistry());
  const tokenCard = cards.find((row) => row.key === "token");
  assert.ok(tokenCard);

  const trText = messages.formatHelpCommandCard(tokenCard, { lang: "tr", categoryLabel: "Ekonomi" });
  const enText = messages.formatHelpCommandCard(tokenCard, { lang: "en", categoryLabel: "Economy" });

  assert.ok(trText.length <= 2400);
  assert.ok(enText.length <= 1400);
  assert.match(trText, /\*Operasyon Akisi\*/);
  assert.match(enText, /\*Operation Flow\*/);
  assert.match(trText, /\*Kullanim\*/);
  assert.match(enText, /\*Syntax\*/);
});

test("help not-found and access-denied templates are explicit", () => {
  const notFound = messages.formatHelpNotFound({
    lang: "tr",
    query: "tokn",
    suggestions: ["token", "tasks"]
  });
  assert.match(notFound, /Help Sorgusu Bulunamadi/);
  assert.match(notFound, /\/token/);

  const denied = messages.formatHelpAccessDenied({
    lang: "tr",
    commandKey: "admin_freeze",
    alternatives: ["status", "ops"]
  });
  assert.match(denied, /admin kapsamindadir/);
  assert.match(denied, /\/status/);
});
