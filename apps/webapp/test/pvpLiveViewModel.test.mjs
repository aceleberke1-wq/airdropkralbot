import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function loadViewModelModule() {
  const target = pathToFileURL(
    path.join(process.cwd(), "apps", "webapp", "src", "core", "player", "pvpLiveViewModel.js")
  ).href;
  return import(target);
}

test("buildPvpLiveViewModel maps live payload into stable summary fields", async () => {
  const mod = await loadViewModelModule();
  const vm = mod.buildPvpLiveViewModel({
    pvpRuntime: {
      session: {
        session_ref: "sess_1",
        status: "active",
        transport: "poll",
        tick_ms: 900,
        action_window_ms: 700,
        opponent_type: "shadow",
        score: { self: 42, opponent: 35 },
        action_count: { self: 7, opponent: 6 },
        next_expected_action: "strike",
        state: { server_tick: 18 }
      }
    },
    leagueOverview: {
      daily_duel: { status: "open", wins: 3, losses: 1, progress_pct: 0.5 },
      weekly_ladder: { rank: 7, points: 320, tier: "gold", promotion_zone: true },
      season_arc_boss: { phase: "rage", stage: "hydra", hp_pct: 62, attempts: 4 },
      session_snapshot: { rating: 1500, rank: 8, wins: 11, losses: 4, last_result: "win" },
      last_session_trend: [{ session_ref: "sess_prev", result: "win", rating_delta: 12, score_self: 6, score_opponent: 4 }]
    },
    liveLeaderboard: {
      leaderboard: [
        { rank: 1, user_id: 10, public_name: "neo", rating: 1422, matches_24h: 12, matches_total: 140 },
        { rank: 2, user_id: 11, public_name: "trinity", rating: 1401, matches_24h: 9, matches_total: 134 }
      ]
    },
    liveDiagnostics: {
      window: "1h",
      accept_rate: 0.88,
      diagnostics: { p95_latency_ms: 280, median_latency_ms: 96 },
      tick_stats: { avg_tick_ms: 920, avg_action_window_ms: 705 },
      reject_mix: [{ reason_code: "late_input", hit_count: 3 }]
    },
    liveTick: {
      tick: { tick_seq: 19, phase: "combat" }
    }
  });

  assert.equal(vm.summary.session_ref, "sess_1");
  assert.equal(vm.summary.session_status, "active");
  assert.equal(vm.summary.server_tick, 19);
  assert.equal(vm.summary.accept_rate_pct, 88);
  assert.equal(vm.summary.p95_latency_ms, 280);
  assert.equal(vm.league.daily_duel.win_rate_pct, 75);
  assert.equal(vm.league.weekly_ladder.tier, "gold");
  assert.equal(vm.league.season_arc_boss.phase, "rage");
  assert.equal(vm.league.trend.length, 1);
  assert.equal(vm.league.trend[0].session_ref, "sess_prev");
  assert.equal(vm.leaderboard.length, 2);
  assert.equal(vm.reject_mix[0].reason_code, "late_input");
  assert.equal(vm.has_live_data, true);
});

test("buildPvpLiveViewModel falls back to league leaderboard snippet when live board is empty", async () => {
  const mod = await loadViewModelModule();
  const vm = mod.buildPvpLiveViewModel({
    leagueOverview: {
      leaderboard_snippet: [{ user_id: 99, public_name: "fallback", rating: 1200 }]
    },
    liveLeaderboard: {}
  });

  assert.equal(vm.leaderboard.length, 1);
  assert.equal(vm.leaderboard[0].public_name, "fallback");
});

test("buildPvpLiveViewModel handles empty payload safely", async () => {
  const mod = await loadViewModelModule();
  const vm = mod.buildPvpLiveViewModel();

  assert.equal(vm.summary.session_ref, "");
  assert.equal(vm.summary.transport, "poll");
  assert.equal(vm.summary.accept_rate_pct, 0);
  assert.equal(vm.league.daily_duel.status, "idle");
  assert.equal(vm.league.trend.length, 0);
  assert.equal(vm.leaderboard.length, 0);
  assert.equal(vm.reject_mix.length, 0);
  assert.equal(vm.has_live_data, false);
});
