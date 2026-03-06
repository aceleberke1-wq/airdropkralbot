"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");
const { registerWebappV2GrowthRoutes } = require("../src/routes/webapp/v2/growthRoutes");
const {
  HomeFeedV2Schema,
  MonetizationOverviewV2Schema,
  PvpLeagueOverviewV2Schema,
  VaultOverviewV2Schema
} = require("../../../packages/shared/src/contracts/v2");

function createApp() {
  const app = Fastify();
  registerWebappV2GrowthRoutes(app, {
    proxyWebAppApiV1: async (_request, reply, options = {}) => {
      const targetPath = String(options.targetPath || "");
      if (targetPath === "/webapp/api/v2/monetization/status") {
        const payload = options.transform
          ? options.transform({
              success: true,
              data: {
                monetization: {
                  enabled: true,
                  tables_available: true,
                  pass_catalog: [{ pass_key: "gold" }],
                  cosmetic_catalog: [{ item_key: "skin_1" }],
                  active_passes: [{ pass_key: "gold" }],
                  cosmetics: { owned_count: 1 },
                  spend_summary: { SC: 100 },
                  player_effects: { premium_active: true }
                }
              }
            })
          : { success: true, data: {} };
        reply.send(payload);
        return;
      }
      const bootstrapPayload = {
        success: true,
        data: {
          profile: { public_name: "Player" },
          season: { season_id: 2 },
          daily: { tasks_done: 1 },
          offers: [{ id: 1 }],
          attempts: { active: null, revealable: null },
          missions: { total: 2, ready: 1, open: 1, list: [{ mission_key: "m1" }] },
          wallet_session: { active: true, chain: "TON", address_masked: "UQ...123", kyc_status: "verified" },
          kyc_status: { status: "verified" },
          monetization: {
            enabled: true,
            active_passes: [{ pass_key: "gold" }],
            spend_summary: { SC: 10 },
            player_effects: { premium_active: true }
          },
          command_catalog: [{ key: "play", description_tr: "oyna", description_en: "play" }],
          pvp_content: { daily_duel: { score: 10 }, weekly_ladder: { rank: 1 }, season_arc_boss: { hp: 90 } },
          arena: { rating: 1000, rank: 2, games_played: 3, wins: 2, losses: 1, last_result: "win", leaderboard: [] },
          token: { symbol: "NXT" },
          payout_lock: { can_request: true }
        }
      };
      reply.send(options.transform ? options.transform(bootstrapPayload) : bootstrapPayload);
    }
  });
  return app;
}

test("v2 home feed transforms bootstrap payload", async () => {
  const app = createApp();
  const res = await app.inject({
    method: "GET",
    url: "/webapp/api/v2/home/feed?uid=1&ts=1&sig=s"
  });
  assert.equal(res.statusCode, 200);
  const payload = res.json();
  assert.equal(payload.success, true);
  assert.equal(payload.data.api_version, "v2");
  assert.equal(payload.data.mission.ready, 1);
  assert.equal(payload.data.wallet_quick.active, true);
  const contractData = HomeFeedV2Schema.parse(payload.data);
  assert.equal(contractData.api_version, "v2");
  assert.ok(Array.isArray(contractData.command_hint));
  await app.close();
});

test("v2 league overview returns contract compatible payload", async () => {
  const app = createApp();
  const res = await app.inject({
    method: "GET",
    url: "/webapp/api/v2/pvp/league/overview?uid=1&ts=1&sig=s"
  });
  assert.equal(res.statusCode, 200);
  const payload = res.json();
  assert.equal(payload.success, true);
  const contractData = PvpLeagueOverviewV2Schema.parse(payload.data);
  assert.equal(contractData.api_version, "v2");
  assert.ok(Array.isArray(contractData.leaderboard_snippet));
  await app.close();
});

test("v2 vault overview and monetization overview return additive payloads", async () => {
  const app = createApp();
  const vault = await app.inject({
    method: "GET",
    url: "/webapp/api/v2/vault/overview?uid=1&ts=1&sig=s"
  });
  const monetization = await app.inject({
    method: "GET",
    url: "/webapp/api/v2/monetization/overview?uid=1&ts=1&sig=s"
  });
  assert.equal(vault.statusCode, 200);
  assert.equal(monetization.statusCode, 200);
  assert.equal(vault.json().data.api_version, "v2");
  assert.equal(monetization.json().data.status.enabled, true);
  const vaultContract = VaultOverviewV2Schema.parse(vault.json().data);
  const monetizationContract = MonetizationOverviewV2Schema.parse(monetization.json().data);
  assert.equal(vaultContract.api_version, "v2");
  assert.equal(monetizationContract.api_version, "v2");
  await app.close();
});
