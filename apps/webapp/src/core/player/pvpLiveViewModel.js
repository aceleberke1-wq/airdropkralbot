function asRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toNum(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function readSessionRoot(runtimePayload) {
  const root = asRecord(runtimePayload);
  const nested = asRecord(root.session);
  return Object.keys(nested).length ? nested : root;
}

function normalizeLeaderboardRows(inputRows, fallbackRows) {
  const source = asArray(inputRows).length ? asArray(inputRows) : asArray(fallbackRows);
  return source.slice(0, 12).map((row, idx) => {
    const item = asRecord(row);
    const userId = toNum(item.user_id || item.userId || 0);
    return {
      rank: Math.max(1, toNum(item.rank || idx + 1, idx + 1)),
      public_name: toText(item.public_name || item.name || "", userId > 0 ? `u${userId}` : `u${idx + 1}`),
      rating: Math.max(0, toNum(item.rating || item.rank_score || 0)),
      matches_24h: Math.max(0, toNum(item.matches_24h || item.daily_matches || 0)),
      matches_total: Math.max(0, toNum(item.matches_total || item.total_matches || 0)),
      last_match_at: toText(item.last_match_at || item.updated_at || "")
    };
  });
}

function normalizeRejectMix(rows) {
  return asArray(rows).slice(0, 8).map((row) => {
    const item = asRecord(row);
    return {
      reason_code: toText(item.reason_code || item.reason || "unknown"),
      hit_count: Math.max(0, toNum(item.hit_count || item.count || 0))
    };
  });
}

function toRatePct(value) {
  const raw = toNum(value, 0);
  if (raw <= 1) {
    return Math.max(0, raw * 100);
  }
  return Math.max(0, raw);
}

function toPct(value) {
  return Math.max(0, Math.min(100, toRatePct(value)));
}

function normalizeTrend(rows) {
  return asArray(rows).slice(0, 10).map((row, idx) => {
    const item = asRecord(row);
    return {
      session_ref: toText(item.session_ref || item.ref || `session_${idx + 1}`),
      result: toText(item.result || item.status || "unknown"),
      rating_delta: toNum(item.rating_delta || item.delta || 0),
      score_self: Math.max(0, toNum(item.score_self || item.self_score || 0)),
      score_opponent: Math.max(0, toNum(item.score_opponent || item.opponent_score || 0))
    };
  });
}

export function buildPvpLiveViewModel(input = {}) {
  const runtimePayload = asRecord(input.pvpRuntime);
  const runtimeSession = readSessionRoot(runtimePayload);
  const runtimeState = asRecord(runtimeSession.state);
  const leagueOverview = asRecord(input.leagueOverview);
  const liveLeaderboard = asRecord(input.liveLeaderboard);
  const liveDiagnostics = asRecord(input.liveDiagnostics);
  const liveTickRoot = asRecord(input.liveTick);
  const liveTick = asRecord(liveTickRoot.tick);
  const diagnosticsWindow = asRecord(liveDiagnostics.diagnostics);
  const tickStats = asRecord(liveDiagnostics.tick_stats);
  const dailyDuel = asRecord(leagueOverview.daily_duel);
  const weeklyLadder = asRecord(leagueOverview.weekly_ladder);
  const seasonArcBoss = asRecord(leagueOverview.season_arc_boss);
  const sessionSnapshot = asRecord(leagueOverview.session_snapshot);

  const sessionRef = toText(runtimeSession.session_ref || liveTick.session_ref || liveTickRoot.session_ref || "");
  const sessionStatus = toText(runtimeSession.status || liveTick.phase || "idle");
  const transport = toText(
    liveTick.transport || liveTickRoot.transport || runtimeSession.transport || liveLeaderboard.transport || liveDiagnostics.transport,
    "poll"
  );
  const tickMs = Math.max(0, toNum(liveTick.tick_ms || liveTickRoot.tick_ms || runtimeSession.tick_ms || 0));
  const actionWindowMs = Math.max(
    0,
    toNum(liveTick.action_window_ms || liveTickRoot.action_window_ms || runtimeSession.action_window_ms || 0)
  );
  const serverTick = Math.max(
    0,
    toNum(
      liveTick.tick_seq ||
        runtimeState.server_tick ||
        liveTick.server_tick ||
        liveTickRoot.server_tick ||
        liveDiagnostics.server_tick ||
        liveLeaderboard.server_tick ||
        0
    )
  );
  const selfScore = Math.max(0, toNum(asRecord(runtimeSession.score).self || runtimeSession.score_self || 0));
  const opponentScore = Math.max(0, toNum(asRecord(runtimeSession.score).opponent || runtimeSession.score_opponent || 0));
  const selfActions = Math.max(0, toNum(asRecord(runtimeSession.action_count).self || runtimeSession.action_count_self || 0));
  const opponentActions = Math.max(
    0,
    toNum(asRecord(runtimeSession.action_count).opponent || runtimeSession.action_count_opponent || 0)
  );
  const acceptRatePct = toRatePct(liveDiagnostics.accept_rate);
  const p95LatencyMs = Math.max(0, toNum(diagnosticsWindow.p95_latency_ms || 0));
  const medianLatencyMs = Math.max(0, toNum(diagnosticsWindow.median_latency_ms || 0));
  const avgTickMs = Math.max(0, toNum(tickStats.avg_tick_ms || 0));
  const avgActionWindowMs = Math.max(0, toNum(tickStats.avg_action_window_ms || 0));
  const leaderboardRows = normalizeLeaderboardRows(liveLeaderboard.leaderboard, leagueOverview.leaderboard_snippet);
  const rejectMix = normalizeRejectMix(liveDiagnostics.reject_mix);
  const trendRows = normalizeTrend(leagueOverview.last_session_trend);
  const dailyWins = Math.max(0, toNum(dailyDuel.wins || dailyDuel.win_count || 0));
  const dailyLosses = Math.max(0, toNum(dailyDuel.losses || dailyDuel.loss_count || 0));
  const dailyTotal = Math.max(0, dailyWins + dailyLosses);
  const dailyWinRate = dailyTotal > 0 ? (dailyWins / dailyTotal) * 100 : toRatePct(dailyDuel.win_rate_pct || dailyDuel.win_rate || 0);

  return {
    summary: {
      session_ref: sessionRef,
      session_status: sessionStatus,
      opponent_type: toText(runtimeSession.opponent_type || "unknown"),
      transport,
      tick_ms: tickMs,
      action_window_ms: actionWindowMs,
      server_tick: serverTick,
      accept_rate_pct: acceptRatePct,
      p95_latency_ms: p95LatencyMs,
      median_latency_ms: medianLatencyMs,
      avg_tick_ms: avgTickMs,
      avg_action_window_ms: avgActionWindowMs,
      self_score: selfScore,
      opponent_score: opponentScore,
      self_actions: selfActions,
      opponent_actions: opponentActions,
      next_expected_action: toText(runtimeSession.next_expected_action || runtimeState.next_expected_left || "")
    },
    league: {
      daily_duel: {
        status: toText(dailyDuel.status || dailyDuel.phase || "idle"),
        wins: dailyWins,
        losses: dailyLosses,
        progress_pct: toPct(dailyDuel.progress_pct || dailyDuel.completion_pct || dailyDuel.progress || 0),
        win_rate_pct: Math.max(0, Math.min(100, dailyWinRate))
      },
      weekly_ladder: {
        rank: Math.max(0, toNum(weeklyLadder.rank || weeklyLadder.position || 0)),
        points: Math.max(0, toNum(weeklyLadder.points || weeklyLadder.score || 0)),
        tier: toText(weeklyLadder.tier || weeklyLadder.division || "unranked"),
        promotion_zone: Boolean(weeklyLadder.promotion_zone || weeklyLadder.is_promotion_zone)
      },
      season_arc_boss: {
        phase: toText(seasonArcBoss.phase || seasonArcBoss.status || "idle"),
        stage: toText(seasonArcBoss.stage || seasonArcBoss.boss_key || ""),
        hp_pct: toPct(seasonArcBoss.hp_pct || seasonArcBoss.health_pct || seasonArcBoss.progress_pct || 0),
        attempts: Math.max(0, toNum(seasonArcBoss.attempts || seasonArcBoss.run_count || 0))
      },
      session_snapshot: {
        rating: Math.max(0, toNum(sessionSnapshot.rating || 0)),
        rank: Math.max(0, toNum(sessionSnapshot.rank || 0)),
        games_played: Math.max(0, toNum(sessionSnapshot.games_played || 0)),
        wins: Math.max(0, toNum(sessionSnapshot.wins || 0)),
        losses: Math.max(0, toNum(sessionSnapshot.losses || 0)),
        last_result: toText(sessionSnapshot.last_result || "")
      },
      trend: trendRows
    },
    leaderboard: leaderboardRows,
    reject_mix: rejectMix,
    diagnostics_window: toText(liveDiagnostics.window || diagnosticsWindow.bucket_window || ""),
    has_live_data: Boolean(leaderboardRows.length || rejectMix.length || serverTick > 0 || sessionRef)
  };
}
