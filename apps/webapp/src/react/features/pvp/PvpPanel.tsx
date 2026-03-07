import { t, type Lang } from "../../i18n";
import { buildPvpLiveViewModel } from "../../../core/player/pvpLiveViewModel.js";

type PvpPanelProps = {
  lang: Lang;
  advanced: boolean;
  pvpRuntime: Record<string, unknown> | null;
  leagueOverview: Record<string, unknown> | null;
  liveLeaderboard: Record<string, unknown> | null;
  liveDiagnostics: Record<string, unknown> | null;
  liveTick: Record<string, unknown> | null;
  canStart: boolean;
  canRefreshState: boolean;
  canStrike: boolean;
  canResolve: boolean;
  onStart: () => void;
  onRefreshState: () => void;
  onRefreshLeague: () => void;
  onRefreshLive: () => void;
  onStrike: () => void;
  onResolve: () => void;
};

export function PvpPanel(props: PvpPanelProps) {
  const view = buildPvpLiveViewModel({
    pvpRuntime: props.pvpRuntime,
    leagueOverview: props.leagueOverview,
    liveLeaderboard: props.liveLeaderboard,
    liveDiagnostics: props.liveDiagnostics,
    liveTick: props.liveTick
  });
  const summary = view.summary;
  const league = view.league;

  return (
    <section className="akrCard akrCardWide">
      <div className="akrActionRow">
        <button className="akrBtn akrBtnAccent" disabled={!props.canStart} onClick={props.onStart}>
          {t(props.lang, "pvp_start")}
        </button>
        <button className="akrBtn akrBtnGhost" disabled={!props.canRefreshState} onClick={props.onRefreshState}>
          {t(props.lang, "pvp_refresh")}
        </button>
        <button className="akrBtn akrBtnGhost" onClick={props.onRefreshLeague}>
          {t(props.lang, "pvp_refresh_league")}
        </button>
        <button className="akrBtn akrBtnGhost" onClick={props.onRefreshLive}>
          {t(props.lang, "pvp_refresh_live")}
        </button>
        <button className="akrBtn akrBtnGhost" disabled={!props.canStrike} onClick={props.onStrike}>
          Strike
        </button>
        <button className="akrBtn akrBtnGhost" disabled={!props.canResolve} onClick={props.onResolve}>
          Resolve
        </button>
      </div>
      <h3>{t(props.lang, "pvp_runtime_title")}</h3>
      <div className="akrChipRow">
        <span className="akrChip">Session: {summary.session_ref || "-"}</span>
        <span className="akrChip">Status: {summary.session_status || "-"}</span>
        <span className="akrChip">Transport: {summary.transport || "-"}</span>
        <span className="akrChip">Tick: {Math.floor(summary.server_tick)}</span>
        <span className="akrChip">Tick ms: {Math.floor(summary.tick_ms)}</span>
        <span className="akrChip">Action ms: {Math.floor(summary.action_window_ms)}</span>
        <span className="akrChip">Accept: {Math.round(summary.accept_rate_pct)}%</span>
        <span className="akrChip">P95: {Math.floor(summary.p95_latency_ms)}ms</span>
        <span className="akrChip">Score: {Math.floor(summary.self_score)}-{Math.floor(summary.opponent_score)}</span>
        <span className="akrChip">Actions: {Math.floor(summary.self_actions)}/{Math.floor(summary.opponent_actions)}</span>
        <span className="akrChip">Next: {summary.next_expected_action || "-"}</span>
        <span className="akrChip">Window: {view.diagnostics_window || "-"}</span>
      </div>

      <h3>{t(props.lang, "pvp_league_title")}</h3>
      <div className="akrSplit">
        <section className="akrMiniPanel" data-akr-focus-key="daily_duel">
          <h4>{t(props.lang, "pvp_daily_duel_title")}</h4>
          <div className="akrChipRow">
            <span className="akrChip">{league.daily_duel.status || "-"}</span>
            <span className="akrChip">
              {Math.floor(league.daily_duel.wins)}W/{Math.floor(league.daily_duel.losses)}L
            </span>
            <span className="akrChip">Progress {Math.floor(league.daily_duel.progress_pct)}%</span>
            <span className="akrChip">Win {Math.floor(league.daily_duel.win_rate_pct)}%</span>
          </div>
        </section>
        <section className="akrMiniPanel" data-akr-panel-key="rank" data-akr-focus-key="weekly_ladder">
          <h4>{t(props.lang, "pvp_weekly_ladder_title")}</h4>
          <div className="akrChipRow">
            <span className="akrChip">Tier {league.weekly_ladder.tier || "-"}</span>
            <span className="akrChip">Rank #{Math.floor(league.weekly_ladder.rank)}</span>
            <span className="akrChip">Points {Math.floor(league.weekly_ladder.points)}</span>
            <span className="akrChip">{league.weekly_ladder.promotion_zone ? "promotion_zone" : "stable_zone"}</span>
          </div>
        </section>
      </div>
      <section className="akrMiniPanel" data-akr-focus-key="arc_boss">
        <h4>{t(props.lang, "pvp_arc_boss_title")}</h4>
        <div className="akrChipRow">
          <span className="akrChip">{league.season_arc_boss.phase || "-"}</span>
          <span className="akrChip">{league.season_arc_boss.stage || "-"}</span>
          <span className="akrChip">HP {Math.floor(league.season_arc_boss.hp_pct)}%</span>
          <span className="akrChip">Attempts {Math.floor(league.season_arc_boss.attempts)}</span>
          <span className="akrChip">Rating {Math.floor(league.session_snapshot.rating)}</span>
          <span className="akrChip">Snapshot Rank #{Math.floor(league.session_snapshot.rank)}</span>
          <span className="akrChip">
            Snapshot {Math.floor(league.session_snapshot.wins)}W/{Math.floor(league.session_snapshot.losses)}L
          </span>
        </div>
      </section>

      <h3>{t(props.lang, "pvp_trend_title")}</h3>
      {league.trend.length ? (
        <ul className="akrList">
          {league.trend.map((row) => (
            <li key={row.session_ref}>
              <strong>{row.session_ref}</strong>
              <span>
                {row.result} | dR {Math.floor(row.rating_delta)} | {Math.floor(row.score_self)}-{Math.floor(row.score_opponent)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="akrMuted">{t(props.lang, "pvp_trend_empty")}</p>
      )}

      <h3 data-akr-panel-key="leaderboard" data-akr-focus-key="leaderboard">{t(props.lang, "pvp_leaderboard_title")}</h3>
      {view.leaderboard.length ? (
        <ul className="akrList">
          {view.leaderboard.map((row) => (
            <li key={`${row.rank}_${row.public_name}`}>
              <strong>
                #{row.rank} {row.public_name}
              </strong>
              <span>
                R {Math.floor(row.rating)} | 24h {Math.floor(row.matches_24h)} | Total {Math.floor(row.matches_total)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="akrMuted">{t(props.lang, "pvp_live_empty")}</p>
      )}

      <h3>{t(props.lang, "pvp_reject_mix_title")}</h3>
      {view.reject_mix.length ? (
        <ul className="akrList">
          {view.reject_mix.map((row) => (
            <li key={`${row.reason_code}_${row.hit_count}`}>
              <strong>{row.reason_code}</strong>
              <span>{Math.floor(row.hit_count)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="akrMuted">{t(props.lang, "pvp_live_reject_empty")}</p>
      )}

      {props.advanced ? (
        <>
          <h3>{t(props.lang, "pvp_league_title")}</h3>
          <pre className="akrJsonBlock">{JSON.stringify(props.leagueOverview || null, null, 2)}</pre>
          <h3>{t(props.lang, "pvp_live_title")}</h3>
          <pre className="akrJsonBlock">{JSON.stringify(props.liveLeaderboard || null, null, 2)}</pre>
          <pre className="akrJsonBlock">{JSON.stringify(props.liveDiagnostics || null, null, 2)}</pre>
          <pre className="akrJsonBlock">{JSON.stringify(props.liveTick || null, null, 2)}</pre>
          <pre className="akrJsonBlock">{JSON.stringify(props.pvpRuntime || null, null, 2)}</pre>
        </>
      ) : null}
    </section>
  );
}
