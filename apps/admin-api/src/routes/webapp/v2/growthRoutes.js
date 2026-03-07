"use strict";

const {
  resolvePlayerCommandActionKey,
  resolvePlayerCommandNavigation
} = require("../../../../../../packages/shared/src/playerCommandNavigation");
const { buildPlayerSurfaceActions } = require("../../../../../../packages/shared/src/playerSurfaceActionCatalog");

function requireProxy(deps) {
  const proxyWebAppApiV1 = deps.proxyWebAppApiV1;
  if (typeof proxyWebAppApiV1 !== "function") {
    throw new Error("registerWebappV2GrowthRoutes requires proxyWebAppApiV1");
  }
  return proxyWebAppApiV1;
}

function asObject(value) {
  return value && typeof value === "object" ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeApiEnvelope(payload) {
  const row = asObject(payload);
  row.data = asObject(row.data);
  row.data.api_version = "v2";
  return row;
}

function toCommandHintPayload(rowItem, language) {
  const key = String(rowItem.key || "").trim().toLowerCase();
  const target = resolvePlayerCommandNavigation(key);
  const actionKey = String(resolvePlayerCommandActionKey(key) || "").trim().toLowerCase();
  return {
    key,
    description:
      language === "en"
        ? String(rowItem.description_en || rowItem.description || "")
        : String(rowItem.description_tr || rowItem.description || ""),
    ...(actionKey ? { action_key: actionKey, shell_action_key: actionKey } : {}),
    ...(target?.route_key ? { route_key: String(target.route_key) } : {}),
    ...(target?.panel_key ? { panel_key: String(target.panel_key) } : {}),
    ...(target?.focus_key ? { focus_key: String(target.focus_key) } : {}),
    ...(target?.tab ? { tab: String(target.tab) } : {})
  };
}

function toHomeFeedPayload(payload) {
  const row = normalizeApiEnvelope(payload);
  const data = asObject(row.data);
  const offers = asArray(data.offers);
  const attempts = asObject(data.attempts);
  const missions = asObject(data.missions);
  const missionList = asArray(missions.list);
  const monetization = asObject(data.monetization);
  const playerEffects = asObject(monetization.player_effects);
  const walletSession = asObject(data.wallet_session);
  const commandCatalog = asArray(data.command_catalog);
  const language = String(data.ux?.language || "tr").toLowerCase() === "en" ? "en" : "tr";

  row.data = {
    api_version: "v2",
    generated_at: new Date().toISOString(),
    profile: asObject(data.profile),
    season: asObject(data.season),
    daily: asObject(data.daily),
    contract: {
      offers_total: offers.length,
      active_attempt: attempts.active || null,
      revealable_attempt: attempts.revealable || null
    },
    risk: asObject(data.risk),
    mission: {
      total: Number(missions.total || missionList.length || 0),
      ready: Number(missions.ready || 0),
      open: Number(missions.open || 0),
      list_preview: missionList.slice(0, 6)
    },
    wallet_quick: {
      active: Boolean(walletSession.active),
      chain: String(walletSession.chain || ""),
      address_masked: String(walletSession.address_masked || walletSession.address || ""),
      kyc_status: String(data.kyc_status?.status || walletSession.kyc_status || "unknown")
    },
    monetization_quick: {
      enabled: Boolean(monetization.enabled),
      premium_active: Boolean(playerEffects.premium_active),
      active_pass_count: asArray(monetization.active_passes).length,
      spend_summary: asObject(monetization.spend_summary)
    },
    surface_actions: buildPlayerSurfaceActions(),
    command_hint: commandCatalog.slice(0, 5).map((rowItem) => toCommandHintPayload(asObject(rowItem), language))
  };
  return row;
}

function toLeagueOverviewPayload(payload) {
  const row = normalizeApiEnvelope(payload);
  const data = asObject(row.data);
  const pvpContent = asObject(data.pvp_content);
  const arena = asObject(data.arena);

  row.data = {
    api_version: "v2",
    generated_at: new Date().toISOString(),
    daily_duel: asObject(pvpContent.daily_duel),
    weekly_ladder: asObject(pvpContent.weekly_ladder),
    season_arc_boss: asObject(pvpContent.season_arc_boss),
    leaderboard_snippet: asArray(pvpContent.leaderboard).length
      ? asArray(pvpContent.leaderboard).slice(0, 12)
      : asArray(arena.leaderboard).slice(0, 12),
    last_session_trend: asArray(pvpContent.last_session_trend).length
      ? asArray(pvpContent.last_session_trend).slice(0, 12)
      : asArray(arena.recent_runs).slice(0, 12),
    session_snapshot: {
      rating: Number(arena.rating || 0),
      rank: Number(arena.rank || 0),
      games_played: Number(arena.games_played || 0),
      wins: Number(arena.wins || 0),
      losses: Number(arena.losses || 0),
      last_result: String(arena.last_result || "")
    }
  };
  return row;
}

function toVaultOverviewPayload(payload) {
  const row = normalizeApiEnvelope(payload);
  const data = asObject(row.data);
  const token = asObject(data.token);
  const payoutLock = asObject(data.payout_lock);
  const walletSession = asObject(data.wallet_session);
  const monetization = asObject(data.monetization);

  row.data = {
    api_version: "v2",
    generated_at: new Date().toISOString(),
    token_summary: token,
    route_status: asObject(token.route_status).routes ? asObject(token.route_status) : asObject(token.routing),
    payout_status: payoutLock,
    wallet_session: {
      active: Boolean(walletSession.active),
      chain: String(walletSession.chain || ""),
      address: String(walletSession.address || ""),
      address_masked: String(walletSession.address_masked || ""),
      linked_at: walletSession.linked_at || null,
      expires_at: walletSession.expires_at || null,
      session_ref: String(walletSession.session_ref || ""),
      kyc_status: String(walletSession.kyc_status || "unknown")
    },
    monetization_status: {
      enabled: Boolean(monetization.enabled),
      player_effects: asObject(monetization.player_effects),
      active_pass_count: asArray(monetization.active_passes).length,
      spend_summary: asObject(monetization.spend_summary),
      updated_at: monetization.updated_at || null
    }
  };
  return row;
}

function toMonetizationOverviewPayload(payload) {
  const row = normalizeApiEnvelope(payload);
  const monetization = asObject(row.data?.monetization);
  row.data = {
    api_version: "v2",
    generated_at: new Date().toISOString(),
    catalog: {
      pass_catalog: asArray(monetization.pass_catalog),
      cosmetic_catalog: asArray(monetization.cosmetic_catalog)
    },
    status: {
      enabled: Boolean(monetization.enabled),
      tables_available: Boolean(monetization.tables_available),
      active_passes: asArray(monetization.active_passes),
      pass_history: asArray(monetization.pass_history),
      cosmetics: asObject(monetization.cosmetics),
      spend_summary: asObject(monetization.spend_summary),
      updated_at: monetization.updated_at || null
    },
    active_effects: asObject(monetization.player_effects)
  };
  return row;
}

function registerWebappV2GrowthRoutes(fastify, deps = {}) {
  const proxyWebAppApiV1 = requireProxy(deps);

  fastify.get("/webapp/api/v2/home/feed", async (request, reply) => {
    await proxyWebAppApiV1(request, reply, {
      targetPath: "/webapp/api/v2/bootstrap",
      method: "GET",
      transform: (payload) => toHomeFeedPayload(payload)
    });
  });

  fastify.get("/webapp/api/v2/pvp/league/overview", async (request, reply) => {
    await proxyWebAppApiV1(request, reply, {
      targetPath: "/webapp/api/v2/bootstrap",
      method: "GET",
      transform: (payload) => toLeagueOverviewPayload(payload)
    });
  });

  fastify.get("/webapp/api/v2/vault/overview", async (request, reply) => {
    await proxyWebAppApiV1(request, reply, {
      targetPath: "/webapp/api/v2/bootstrap",
      method: "GET",
      transform: (payload) => toVaultOverviewPayload(payload)
    });
  });

  fastify.get("/webapp/api/v2/monetization/overview", async (request, reply) => {
    await proxyWebAppApiV1(request, reply, {
      targetPath: "/webapp/api/v2/monetization/status",
      method: "GET",
      transform: (payload) => toMonetizationOverviewPayload(payload)
    });
  });
}

module.exports = {
  registerWebappV2GrowthRoutes
};
