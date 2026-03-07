import { buildTasksViewModel } from "../../../core/player/tasksViewModel.js";
import { t, type Lang } from "../../i18n";

type TasksPanelProps = {
  lang: Lang;
  advanced: boolean;
  offers: Array<Record<string, unknown>>;
  missions: Array<Record<string, unknown>>;
  attempts: Record<string, unknown> | null;
  daily: Record<string, unknown> | null;
  taskResult: Record<string, unknown> | null;
  onReroll: () => void;
  onComplete: () => void;
  onReveal: () => void;
  onAccept: (offerId: number) => void;
  onClaim: (missionKey: string) => void;
};

export function TasksPanel(props: TasksPanelProps) {
  const view = buildTasksViewModel({
    offers: props.offers,
    missions: props.missions,
    attempts: props.attempts,
    daily: props.daily,
    taskResult: props.taskResult
  });
  const summary = view.summary;

  return (
    <section className="akrCard akrCardWide">
      <div className="akrActionRow">
        <button className="akrBtn akrBtnGhost" onClick={props.onReroll}>
          {t(props.lang, "tasks_reroll")}
        </button>
        <button className="akrBtn akrBtnGhost" onClick={props.onComplete}>
          {t(props.lang, "tasks_complete")}
        </button>
        <button className="akrBtn akrBtnAccent" onClick={props.onReveal}>
          {t(props.lang, "tasks_reveal")}
        </button>
      </div>
      <div className="akrChipRow">
        <span className="akrChip">Offers {Math.floor(summary.offers_total)}</span>
        <span className="akrChip">Missions {Math.floor(summary.missions_total)}</span>
        <span className="akrChip">Ready {Math.floor(summary.missions_ready)}</span>
        <span className="akrChip">Claimed {Math.floor(summary.missions_claimed)}</span>
        <span className="akrChip">Open {Math.floor(summary.missions_open)}</span>
        <span className="akrChip">
          Daily {Math.floor(summary.daily_tasks_done)}/{Math.floor(summary.daily_cap)} ({Math.floor(summary.daily_progress_pct)}%)
        </span>
        <span className="akrChip">Attempt #{Math.floor(summary.active_attempt_id)}</span>
        <span className="akrChip">Reveal #{Math.floor(summary.revealable_attempt_id)}</span>
      </div>

      <div className="akrSplit">
        <section className="akrMiniPanel" data-akr-panel-key="quests" data-akr-focus-key="board">
          <h4>{t(props.lang, "tasks_offers_title")}</h4>
          {view.offers.length ? (
            <ul className="akrList">
              {view.offers.map((row) => (
                <li key={`offer_${String(row.id || "")}`}>
                  <strong>
                    {row.task_type} #{row.id}
                  </strong>
                  <span>
                    D{Math.floor(row.difficulty)}
                    <button className="akrBtn akrBtnGhost" onClick={() => props.onAccept(Number(row.id || 0))}>
                      {t(props.lang, "tasks_accept")}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="akrMuted">{t(props.lang, "tasks_offers_empty")}</p>
          )}
        </section>

        <section className="akrMiniPanel" data-akr-panel-key="claim" data-akr-focus-key="missions">
          <h4>{t(props.lang, "tasks_missions_title")}</h4>
          {view.missions.length ? (
            <ul className="akrList">
              {view.missions.map((row) => (
                <li key={row.mission_key || row.title}>
                  <strong>{row.title}</strong>
                  {row.can_claim ? (
                    <button className="akrBtn akrBtnGhost" onClick={() => props.onClaim(String(row.mission_key || ""))}>
                      {t(props.lang, "tasks_claim")}
                    </button>
                  ) : (
                    <span>{row.claimed ? "claimed" : row.completed ? "ready" : "open"}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="akrMuted">{t(props.lang, "tasks_missions_empty")}</p>
          )}
        </section>
      </div>

      {!view.has_data ? <p className="akrMuted">{t(props.lang, "tasks_empty")}</p> : null}

      {props.advanced ? (
        <>
          <pre className="akrJsonBlock">{JSON.stringify(props.taskResult || null, null, 2)}</pre>
          <pre className="akrJsonBlock">{JSON.stringify(props.attempts || null, null, 2)}</pre>
        </>
      ) : null}
    </section>
  );
}
