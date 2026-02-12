function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function scoreDuration(config, durationSec) {
  if (typeof durationSec !== "number" || Number.isNaN(durationSec)) {
    return 0;
  }
  const veryShort = Number(config.anti_abuse?.very_short_complete_sec || 4);
  const short = Number(config.anti_abuse?.short_complete_sec || 10);
  if (durationSec <= veryShort) {
    return 0.75;
  }
  if (durationSec <= short) {
    return 0.4;
  }
  return 0;
}

function scoreDensity(config, hourlyTasks) {
  const soft = Number(config.anti_abuse?.hourly_task_soft || 20);
  const hard = Number(config.anti_abuse?.hourly_task_hard || 40);
  const count = Number(hourlyTasks || 0);
  if (count > hard) {
    return 0.45;
  }
  if (count > soft) {
    return 0.22;
  }
  return 0;
}

function scoreDuplicateRatio(config, ratio) {
  const soft = Number(config.anti_abuse?.duplicate_ratio_soft || 0.1);
  const hard = Number(config.anti_abuse?.duplicate_ratio_hard || 0.2);
  const safeRatio = Number(ratio || 0);
  if (safeRatio >= hard) {
    return 0.35;
  }
  if (safeRatio >= soft) {
    return 0.16;
  }
  return 0;
}

function scoreEventType(eventType) {
  if (eventType === "callback_duplicate" || eventType === "reveal_duplicate") {
    return 0.25;
  }
  if (eventType === "callback_reveal") {
    return 0.05;
  }
  if (eventType === "callback_complete") {
    return 0.03;
  }
  return 0.01;
}

function computeSignal(config, eventType, context, snapshot) {
  const callbackTotal = Number(snapshot?.callback_total || 0);
  const callbackDuplicate = Number(snapshot?.callback_duplicate_total || 0);
  const duplicateRatio = callbackTotal > 0 ? callbackDuplicate / callbackTotal : 0;

  const signal =
    scoreEventType(eventType) +
    scoreDuration(config, context?.durationSec) +
    scoreDensity(config, snapshot?.task_complete_total) +
    scoreDuplicateRatio(config, duplicateRatio);

  return {
    signal: clamp(signal),
    duplicateRatio: clamp(duplicateRatio),
    callbackTotal,
    callbackDuplicate,
    hourlyTasks: Number(snapshot?.task_complete_total || 0),
    revealDuplicateTotal: Number(snapshot?.reveal_duplicate_total || 0)
  };
}

function computeNextRisk(config, previousRisk, signal) {
  const alpha = Number(config.anti_abuse?.ewma_alpha || 0.2);
  const prev = clamp(Number(previousRisk || 0));
  return clamp(prev * (1 - alpha) + clamp(signal) * alpha);
}

async function applyRiskEvent(db, riskStore, config, { userId, eventType, context }) {
  const state = await riskStore.getRiskState(db, userId);
  await riskStore.insertBehaviorEvent(db, userId, eventType, context || {});
  const snapshot = await riskStore.getHourlySnapshot(db, userId);

  const computed = computeSignal(config, eventType, context || {}, snapshot);
  const nextRisk = computeNextRisk(config, state.riskScore, computed.signal);

  const signals = {
    last_event: eventType,
    last_signal: computed.signal,
    callback_total_hourly: computed.callbackTotal,
    callback_duplicate_hourly: computed.callbackDuplicate,
    duplicate_ratio_hourly: computed.duplicateRatio,
    task_complete_hourly: computed.hourlyTasks,
    reveal_duplicate_hourly: computed.revealDuplicateTotal,
    updated_at: new Date().toISOString()
  };

  await riskStore.updateRiskState(db, userId, nextRisk, signals);
  return {
    risk: nextRisk,
    signal: computed.signal,
    snapshot: computed
  };
}

module.exports = {
  computeSignal,
  computeNextRisk,
  applyRiskEvent
};
