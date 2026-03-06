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

function toBool(value) {
  return Boolean(value);
}

function normalizeOffers(rows) {
  return asArray(rows).slice(0, 12).map((row) => {
    const item = asRecord(row);
    return {
      id: Math.max(0, toNum(item.id || 0)),
      task_type: toText(item.task_type || "task"),
      difficulty: Math.max(0, toNum(item.difficulty || 0)),
      expires_at: toText(item.expires_at || "")
    };
  });
}

function normalizeMissions(rows) {
  return asArray(rows).slice(0, 16).map((row) => {
    const item = asRecord(row);
    const key = toText(item.mission_key || item.key || "");
    return {
      mission_key: key,
      title: toText(item.title || item.title_tr || item.title_en || key || "mission"),
      completed: toBool(item.completed),
      claimed: toBool(item.claimed),
      can_claim: Boolean(key && item.completed && !item.claimed)
    };
  });
}

export function buildTasksViewModel(input = {}) {
  const offers = normalizeOffers(input.offers);
  const missions = normalizeMissions(input.missions);
  const attempts = asRecord(input.attempts);
  const activeAttempt = asRecord(attempts.active);
  const revealableAttempt = asRecord(attempts.revealable);
  const daily = asRecord(input.daily);
  const taskResult = asRecord(input.taskResult);
  const missionsReady = missions.filter((row) => row.can_claim).length;
  const missionsClaimed = missions.filter((row) => row.claimed).length;
  const missionsOpen = missions.filter((row) => !row.claimed).length;
  const dailyTasksDone = Math.max(0, toNum(daily.tasks_done || 0));
  const dailyCap = Math.max(0, toNum(daily.daily_cap || 0));
  const dailyPct = dailyCap > 0 ? Math.min(100, Math.round((dailyTasksDone / dailyCap) * 100)) : 0;

  return {
    summary: {
      offers_total: offers.length,
      missions_total: missions.length,
      missions_ready: missionsReady,
      missions_claimed: missionsClaimed,
      missions_open: missionsOpen,
      daily_tasks_done: dailyTasksDone,
      daily_cap: dailyCap,
      daily_progress_pct: dailyPct,
      active_attempt_id: Math.max(0, toNum(activeAttempt.id || 0)),
      active_attempt_task_type: toText(activeAttempt.task_type || ""),
      revealable_attempt_id: Math.max(0, toNum(revealableAttempt.id || 0)),
      last_action_request_id: toText(taskResult.action_request_id || ""),
      last_snapshot_present: Boolean(taskResult.snapshot && typeof taskResult.snapshot === "object")
    },
    offers,
    missions,
    has_data: Boolean(offers.length || missions.length || Object.keys(activeAttempt).length || Object.keys(taskResult).length)
  };
}

