import { t, type Lang } from "../../i18n";
import { buildPvpLiveViewModel } from "../../../core/player/pvpLiveViewModel.js";
import { SHELL_ACTION_KEY } from "../../../core/navigation/shellActions.js";

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
  onShellAction: (actionKey: string, sourcePanelKey?: string) => void;
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
  const pressureLevel =
    summary.p95_latency_ms >= 1200 || summary.accept_rate_pct < 45
      ? "critical"
      : summary.p95_latency_ms >= 800 || summary.accept_rate_pct < 60
        ? "high"
        : summary.p95_latency_ms >= 400 || summary.accept_rate_pct < 78
          ? "medium"
          : "low";

  return (
    <section className="akrCard akrCardWide akrArenaPanel">
      <div className="akrGameHero akrArenaHero">
        <div className="akrGameHeroCopy">
          <p className="akrKicker">{t(props.lang, "pvp_hub_kicker")}</p>
          <h2>{t(props.lang, "pvp_hub_title")}</h2>
          <p>{t(props.lang, "pvp_hub_body")}</p>
        </div>
        <div className="akrGameHeroStats">
          <span className="akrChip">{summary.session_status || "-"}</span>
          <span className="akrChip">R {Math.floor(league.session_snapshot.rating)}</span>
          <span className="akrChip">#{Math.floor(league.weekly_ladder.rank)}</span>
          <span className="akrChip">{Math.floor(league.daily_duel.win_rate_pct)}%</span>
        </div>
      </div>

      <div className="akrActionRow">
        <button className="akrBtn akrBtnAccent" disabled={!props.canStart} onClick={props.onStart}>
          {t(props.lang, "pvp_start")}
        </button>
        <button className="akrBtn akrBtnGhost" disabled={!props.canRefreshState} onClick={props.onRefreshState}>
          {t(props.lang, "pvp_refresh")}
        </button>
        <button className="akrBtn akrBtnGhost" disabled={!props.canStrike} onClick={props.onStrike}>
          {t(props.lang, "pvp_strike")}
        </button>
        <button className="akrBtn akrBtnGhost" disabled={!props.canResolve} onClick={props.onResolve}>
          {t(props.lang, "pvp_resolve")}
        </button>
        <button
          className="akrBtn akrBtnGhost"
          onClick={() => props.onShellAction(SHELL_ACTION_KEY.PLAYER_PVP_DAILY_DUEL, "panel_pvp")}
        >
          {t(props.lang, "pvp_focus_daily_duel")}
        </button>
        <button
          className="akrBtn akrBtnGhost"
          onClick={() => props.onShellAction(SHELL_ACTION_KEY.PLAYER_PVP_WEEKLY_LADDER, "panel_pvp")}
        >
          {t(props.lang, "pvp_focus_weekly_ladder")}
        </button>
        <button
          className="akrBtn akrBtnGhost"
          onClick={() => props.onShellAction(SHELL_ACTION_KEY.PLAYER_PVP_LEADERBOARD, "panel_pvp")}
        >
          {t(props.lang, "pvp_focus_leaderboard")}
        </button>
        <button className="akrBtn akrBtnGhost" onClick={props.onRefreshLeague}>
          {t(props.lang, "pvp_refresh_league")}
        </button>
        <button className="akrBtn akrBtnGhost" onClick={props.onRefreshLive}>
          {t(props.lang, "pvp_refresh_live")}
        </button>
      </div>
      <div className="pvpMomentumStrip">
        <section className="pvpMomentumCell">
          <p className="akrKicker">{t(props.lang, "pvp_live_clash_title")}</p>
          <h4>{summary.session_ref || t(props.lang, "pvp_session_idle")}</h4>
          <p className="akrMuted">
            {summary.session_status || "-"} | {summary.next_expected_action || t(props.lang, "pvp_session_waiting")}
          </p>
        </section>
        <section className="pvpMomentumCell">
          <p className="akrKicker">{t(props.lang, "pvp_live_score_title")}</p>
          <h4>
            {Math.floor(summary.self_score)} - {Math.floor(summary.opponent_score)}
          </h4>
          <p className="akrMuted">
            {Math.floor(summary.self_actions)} / {Math.floor(summary.opponent_actions)} {t(props.lang, "pvp_action_count_label")}
          </p>
        </section>
        <section className="pvpMomentumCell">
          <p className="akrKicker">{t(props.lang, "pvp_live_tempo_title")}</p>
          <h4>{Math.floor(summary.accept_rate_pct)}%</h4>
          <p className="akrMuted">
            {Math.floor(summary.tick_ms)}ms tick | {Math.floor(summary.action_window_ms)}ms {t(props.lang, "pvp_window_label")}
          </p>
        </section>
        <section className="pvpMomentumCell">
          <p className="akrKicker">{t(props.lang, "pvp_live_link_title")}</p>
          <h4>{summary.transport || "-"}</h4>
          <p className="akrMuted">P95 {Math.floor(summary.p95_latency_ms)}ms</p>
        </section>
      </div>

      <div className="pvpObjectiveGrid">
        <article className={`pvpObjectiveCard ${league.daily_duel.win_rate_pct >= 55 ? "advantage pulse" : "neutral"}`} data-akr-focus-key="daily_duel">
          <p className="label">{t(props.lang, "pvp_daily_duel_title")}</p>
          <p className="value">
            {Math.floor(league.daily_duel.wins)}W / {Math.floor(league.daily_duel.losses)}L
          </p>
          <p className="micro">
            {league.daily_duel.status || "-"} | {Math.floor(league.daily_duel.progress_pct)}%
          </p>
        </article>
        <article className={`pvpObjectiveCard ${league.weekly_ladder.promotion_zone ? "advantage" : "neutral"}`} data-akr-focus-key="weekly_ladder">
          <p className="label">{t(props.lang, "pvp_weekly_ladder_title")}</p>
          <p className="value">
            #{Math.floor(league.weekly_ladder.rank)} | {league.weekly_ladder.tier || "-"}
          </p>
          <p className="micro">{Math.floor(league.weekly_ladder.points)} {t(props.lang, "pvp_points_label")}</p>
        </article>
        <article className={`pvpObjectiveCard ${league.season_arc_boss.hp_pct <= 25 ? "danger" : league.season_arc_boss.hp_pct <= 55 ? "warning" : "neutral"}`} data-akr-focus-key="arc_boss">
          <p className="label">{t(props.lang, "pvp_arc_boss_title")}</p>
          <p className="value">{league.season_arc_boss.phase || "-"}</p>
          <p className="micro">
            {league.season_arc_boss.stage || "-"} | HP {Math.floor(league.season_arc_boss.hp_pct)}%
          </p>
        </article>
        <article className="pvpObjectiveCard neutral">
          <p className="label">{t(props.lang, "pvp_snapshot_title")}</p>
          <p className="value">
            R {Math.floor(league.session_snapshot.rating)} | #{Math.floor(league.session_snapshot.rank)}
          </p>
          <p className="micro">
            {Math.floor(league.session_snapshot.wins)}W / {Math.floor(league.session_snapshot.losses)}L
          </p>
        </article>
      </div>

      <div className={`combatHudPanel pressure-${pressureLevel}`}>
        <section className="combatHudCell">
          <p className="akrKicker">{t(props.lang, "pvp_pressure_title")}</p>
          <strong>{t(props.lang, `pvp_pressure_${pressureLevel}` as any)}</strong>
          <span className="akrMuted">{view.diagnostics_window || "-"}</span>
        </section>
        <section className="combatHudCell">
          <p className="akrKicker">{t(props.lang, "pvp_window_title")}</p>
          <strong>{Math.floor(summary.action_window_ms)}ms</strong>
          <span className="akrMuted">{t(props.lang, "pvp_window_caption")}</span>
        </section>
        <section className="combatHudCell">
          <p className="akrKicker">{t(props.lang, "pvp_transport_title")}</p>
          <strong>{summary.transport || "-"}</strong>
          <span className="akrMuted">Tick #{Math.floor(summary.server_tick)}</span>
        </section>
        <section className="combatHudCell">
          <p className="akrKicker">{t(props.lang, "pvp_next_call_title")}</p>
          <strong>{summary.next_expected_action || t(props.lang, "pvp_session_waiting")}</strong>
          <span className="akrMuted">{t(props.lang, "pvp_next_call_caption")}</span>
        </section>
      </div>

      <div className="pvpTheaterStrip">
        <section className="pvpTheaterCell" data-akr-panel-key="leaderboard" data-akr-focus-key="leaderboard">
          <h3>{t(props.lang, "pvp_leaderboard_title")}</h3>
          {view.leaderboard.length ? (
            <ul className="akrList">
              {view.leaderboard.slice(0, 5).map((row) => (
                <li key={`${row.rank}_${row.public_name}`}>
                  <strong>
                    #{row.rank} {row.public_name}
                  </strong>
                  <span>
                    R {Math.floor(row.rating)} | {Math.floor(row.matches_24h)} {t(props.lang, "pvp_matches_24h_label")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="akrMuted">{t(props.lang, "pvp_live_empty")}</p>
          )}
        </section>
        <section className="pvpTheaterCell">
          <h3>{t(props.lang, "pvp_recent_clashes_title")}</h3>
          {league.trend.length ? (
            <ul className="akrList">
              {league.trend.slice(0, 5).map((row) => (
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
        </section>
      </div>

      {props.advanced ? (
        <>
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
          </div>
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
