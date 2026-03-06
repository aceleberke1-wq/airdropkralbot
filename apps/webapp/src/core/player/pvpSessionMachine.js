function asRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value;
}

function toNum(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function toTimestampMs(value) {
  if (value == null || value === "") {
    return 0;
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    if (numeric > 1_000_000_000_000) {
      return Math.floor(numeric);
    }
    if (numeric > 1_000_000_000) {
      return Math.floor(numeric * 1000);
    }
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function readSessionRoot(runtimePayload) {
  const root = asRecord(runtimePayload);
  const nested = asRecord(root.session);
  return Object.keys(nested).length ? nested : root;
}

function normalizeStatus(rawStatus) {
  return toText(rawStatus || "idle").toLowerCase();
}

function isClosedStatus(status) {
  return ["resolved", "completed", "finished", "closed", "ended", "expired"].includes(status);
}

function isLiveStatus(status) {
  return ["active", "running", "in_progress", "pending_action", "awaiting_action", "open", "started"].includes(status);
}

function normalizeExpectedAction(rawExpected) {
  const expected = toText(rawExpected || "").toLowerCase();
  if (["resolve", "finish", "complete", "close", "end"].includes(expected)) {
    return "resolve";
  }
  if (["strike", "action", "attack", "input"].includes(expected)) {
    return "strike";
  }
  return "none";
}

function resolveRefreshIntervalMs({ hasSession, closed, live, expectedAction, stale }) {
  if (!hasSession) {
    return 12000;
  }
  if (closed) {
    return 10000;
  }
  if (expectedAction === "resolve") {
    return 3000;
  }
  if (expectedAction === "strike") {
    return 3500;
  }
  if (stale && live) {
    return 2500;
  }
  if (live) {
    return 4500;
  }
  return 9000;
}

export function buildPvpSessionMachine(input = {}) {
  const runtime = asRecord(input.pvpRuntime);
  const session = readSessionRoot(runtime);
  const state = asRecord(session.state);
  const actionCount = asRecord(session.action_count);
  const nowMs = Math.max(0, toNum(input.nowMs || Date.now(), Date.now()));
  const sessionRef = toText(session.session_ref || state.session_ref || "");
  const status = normalizeStatus(session.status || state.status || state.phase || "idle");
  const selfActions = Math.max(0, toNum(actionCount.self || session.action_count_self || state.self_actions || 0));
  const nextExpected = toText(session.next_expected_action || state.next_expected_left || state.next_expected_action || "");
  const expectedAction = normalizeExpectedAction(nextExpected);
  const lastEventMs = Math.max(
    0,
    toTimestampMs(session.last_event_at || state.last_event_at || session.updated_at || state.updated_at || runtime.updated_at)
  );
  const serverTsMs = Math.max(
    0,
    toTimestampMs(session.server_ts || state.server_ts || runtime.server_ts || session.server_time || state.server_time)
  );
  const eventAgeMs = lastEventMs > 0 ? Math.max(0, nowMs - lastEventMs) : 0;
  const syncLagMs = serverTsMs > 0 ? Math.max(0, Math.abs(nowMs - serverTsMs)) : 0;
  const stale = eventAgeMs >= 15000 || syncLagMs >= 12000;
  const closed = isClosedStatus(status);
  const live = isLiveStatus(status) || (Boolean(sessionRef) && !closed);
  const canStart = !sessionRef || closed;
  const canRefreshState = Boolean(sessionRef);
  const canStrike = Boolean(sessionRef) && live && !closed && expectedAction !== "resolve";
  const canResolve =
    Boolean(sessionRef) &&
    live &&
    !closed &&
    (expectedAction === "resolve" || (expectedAction !== "strike" && selfActions > 0));
  const refreshIntervalMs = resolveRefreshIntervalMs({
    hasSession: Boolean(sessionRef),
    closed,
    live,
    expectedAction,
    stale
  });

  return {
    session_ref: sessionRef,
    status,
    self_actions: selfActions,
    next_expected_action: nextExpected,
    expected_action: expectedAction,
    next_action_seq: Math.max(1, selfActions + 1),
    last_event_age_ms: eventAgeMs,
    sync_lag_ms: syncLagMs,
    stale,
    refresh_interval_ms: refreshIntervalMs,
    should_refresh_now: Boolean(sessionRef) && live && !closed && stale,
    can_start: canStart,
    can_refresh_state: canRefreshState,
    can_strike: canStrike,
    can_resolve: canResolve
  };
}
