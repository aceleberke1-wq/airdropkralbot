import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import dotenv from "dotenv";
import pg from "pg";

const require = createRequire(import.meta.url);
const { buildPgPoolConfig } = require("../packages/shared/src/v5/dbConnection");
const {
  resolveLiveOpsDispatchArtifactPaths,
  resolveLiveOpsOpsAlertArtifactPaths
} = require("../packages/shared/src/runtimeArtifactPaths");
const { LIVE_OPS_CAMPAIGN_CONFIG_KEY } = require("../packages/shared/src/liveOpsCampaignContract");
const { resolveLiveOpsPressureEscalation } = require("../packages/shared/src/liveOpsSceneGate.cjs");
const { Pool } = pg;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const envPath = path.join(repoRoot, ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || "").trim();
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || String(next).startsWith("--")) {
      out[key] = "true";
      continue;
    }
    out[key] = String(next);
    i += 1;
  }
  return out;
}

function parseBool(value, fallback = false) {
  if (value == null || value === "") {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readJsonSafe(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function normalizeOpsAlarm(source = {}) {
  const raw = source && typeof source === "object" && !Array.isArray(source) ? source : {};
  const state = String(raw.state || raw.alarm_state || "clear").trim().toLowerCase();
  return {
    state: ["clear", "watch", "alert"].includes(state) ? state : "clear",
    reason: String(raw.reason || raw.alarm_reason || "").trim(),
    skipped_24h: Math.max(0, Number(raw.skipped_24h || 0)),
    skipped_7d: Math.max(0, Number(raw.skipped_7d || 0)),
    latest_skip_reason: String(raw.latest_skip_reason || "").trim(),
    latest_skip_at: raw.latest_skip_at || null
  };
}

function buildAlertFingerprint(alarm) {
  const safeAlarm = normalizeOpsAlarm(alarm);
  return [
    safeAlarm.state,
    safeAlarm.reason || "-",
    safeAlarm.latest_skip_reason || "-",
    safeAlarm.latest_skip_at || "-"
  ].join("|");
}

function evaluateOpsAlert(dispatchArtifact, previousAlertArtifact, options = {}) {
  const schedulerSkip = normalizeOpsAlarm(dispatchArtifact?.scheduler_skip_summary || dispatchArtifact?.ops_alarm || {});
  const targetingGuidance =
    dispatchArtifact?.scheduler_summary && typeof dispatchArtifact.scheduler_summary === "object"
      ? dispatchArtifact.scheduler_summary.targeting_guidance || {}
      : {};
  const selectionSummary =
    dispatchArtifact?.selection_summary && typeof dispatchArtifact.selection_summary === "object"
      ? dispatchArtifact.selection_summary
      : {};
  const selectionTrend =
    dispatchArtifact?.selection_trend_summary && typeof dispatchArtifact.selection_trend_summary === "object"
      ? dispatchArtifact.selection_trend_summary
      : dispatchArtifact?.selection_trend && typeof dispatchArtifact.selection_trend === "object"
        ? dispatchArtifact.selection_trend
        : {};
  const selectionPrefilter =
    selectionSummary?.prefilter_summary && typeof selectionSummary.prefilter_summary === "object"
      ? selectionSummary.prefilter_summary
      : {};
  const recipientCapRecommendation =
    dispatchArtifact?.scheduler_summary && typeof dispatchArtifact.scheduler_summary === "object"
      ? dispatchArtifact.scheduler_summary.recipient_cap_recommendation || {}
      : {};
  const pressureFocusSummary =
    dispatchArtifact?.pressure_focus_summary && typeof dispatchArtifact.pressure_focus_summary === "object"
      ? dispatchArtifact.pressure_focus_summary
      : {};
  const warningRows = Array.isArray(pressureFocusSummary.warning_rows) ? pressureFocusSummary.warning_rows : [];
  const localeCapSplit = Array.isArray(pressureFocusSummary.locale_cap_split) ? pressureFocusSummary.locale_cap_split : [];
  const variantCapSplit = Array.isArray(pressureFocusSummary.variant_cap_split) ? pressureFocusSummary.variant_cap_split : [];
  const cohortCapSplit = Array.isArray(pressureFocusSummary.cohort_cap_split) ? pressureFocusSummary.cohort_cap_split : [];
  const queryStrategyReasonBreakdown = Array.isArray(selectionTrend.query_strategy_reason_breakdown)
    ? selectionTrend.query_strategy_reason_breakdown
    : [];
  const segmentStrategyReasonBreakdown = Array.isArray(selectionTrend.segment_strategy_reason_breakdown)
    ? selectionTrend.segment_strategy_reason_breakdown
    : [];
  const topWarning = warningRows[0] && typeof warningRows[0] === "object" ? warningRows[0] : {};
  const topLocaleSplit = localeCapSplit[0] && typeof localeCapSplit[0] === "object" ? localeCapSplit[0] : {};
  const topVariantSplit = variantCapSplit[0] && typeof variantCapSplit[0] === "object" ? variantCapSplit[0] : {};
  const topCohortSplit = cohortCapSplit[0] && typeof cohortCapSplit[0] === "object" ? cohortCapSplit[0] : {};
  const topQueryStrategyReason = queryStrategyReasonBreakdown[0] && typeof queryStrategyReasonBreakdown[0] === "object"
    ? queryStrategyReasonBreakdown[0]
    : {};
  const topSegmentStrategyReason = segmentStrategyReasonBreakdown[0] && typeof segmentStrategyReasonBreakdown[0] === "object"
    ? segmentStrategyReasonBreakdown[0]
    : {};
  const previous = previousAlertArtifact && typeof previousAlertArtifact === "object" ? previousAlertArtifact : {};
  const previousEvaluation = previous.evaluation && typeof previous.evaluation === "object" ? previous.evaluation : {};
  const previousFingerprint = String(previousEvaluation.fingerprint || "").trim();
  const previousSentAt = String(previous.telegram?.sent_at || "").trim();
  const notifyOnWatch = options.notifyOnWatch === true;
  const cooldownMinutes = Math.max(15, Number(options.cooldownMinutes || 180));
  const now = options.now instanceof Date ? options.now : new Date();
  const recommendationPressure = String(recipientCapRecommendation.pressure_band || "clear").trim().toLowerCase();
  const recommendedCap = Math.max(0, Number(recipientCapRecommendation.recommended_recipient_cap || 0));
  const effectiveCapDelta = Math.max(0, Number(recipientCapRecommendation.effective_cap_delta || 0));
  const prefilterCandidatesBefore = Math.max(0, Number(selectionPrefilter.candidates_before || 0));
  const prefilterCandidatesAfter = Math.max(0, Number(selectionPrefilter.candidates_after || 0));
  const prefilterReductionCount =
    prefilterCandidatesBefore > prefilterCandidatesAfter ? prefilterCandidatesBefore - prefilterCandidatesAfter : 0;
  const prefilterReductionShare =
    prefilterCandidatesBefore > 0 && prefilterReductionCount > 0
      ? prefilterReductionCount / prefilterCandidatesBefore
      : 0;
  const pressureEscalation = resolveLiveOpsPressureEscalation(pressureFocusSummary, recipientCapRecommendation);
  const fingerprint = buildAlertFingerprint(schedulerSkip);
  let shouldNotify = false;
  let notificationReason = "state_clear";

  if (schedulerSkip.state === "alert") {
    shouldNotify = true;
    notificationReason = "alert_state";
  } else if (schedulerSkip.state === "watch" && recommendationPressure === "alert") {
    shouldNotify = true;
    notificationReason = "watch_state_pressure";
  } else if (schedulerSkip.state === "watch" && pressureEscalation.escalation_band === "alert") {
    shouldNotify = true;
    notificationReason = String(pressureEscalation.reason || "watch_state_focus_pressure").trim() || "watch_state_focus_pressure";
  } else if (
    schedulerSkip.state === "watch" &&
    selectionPrefilter.applied === true &&
    prefilterReductionShare >= 0.5 &&
    effectiveCapDelta > 0
  ) {
    shouldNotify = true;
    notificationReason = "watch_state_prefilter_pressure";
  } else if (schedulerSkip.state === "watch" && notifyOnWatch) {
    shouldNotify = true;
    notificationReason = "watch_state";
  }

  if (shouldNotify && previousFingerprint && previousFingerprint === fingerprint && previousSentAt) {
    const lastSentAt = new Date(previousSentAt);
    if (!Number.isNaN(lastSentAt.getTime())) {
      const ageMinutes = (now.getTime() - lastSentAt.getTime()) / 60000;
      if (Number.isFinite(ageMinutes) && ageMinutes < cooldownMinutes) {
        shouldNotify = false;
        notificationReason = "cooldown_active";
      }
    }
  }

  return {
    alarm_state: schedulerSkip.state,
    alarm_reason: schedulerSkip.reason,
    skipped_24h: schedulerSkip.skipped_24h,
    skipped_7d: schedulerSkip.skipped_7d,
    latest_skip_reason: schedulerSkip.latest_skip_reason,
    latest_skip_at: schedulerSkip.latest_skip_at,
    recommendation_pressure_band: recommendationPressure,
    recommended_recipient_cap: recommendedCap,
    effective_cap_delta: effectiveCapDelta,
    recommendation_reason: String(recipientCapRecommendation.reason || "").trim(),
    targeting_guidance_mode: String(targetingGuidance.default_mode || selectionSummary.guidance_mode || "balanced").trim(),
    targeting_guidance_state: String(targetingGuidance.guidance_state || selectionSummary.guidance_state || "clear").trim(),
    targeting_guidance_reason: String(targetingGuidance.guidance_reason || selectionSummary.guidance_reason || "").trim(),
    pressure_focus_band: String(pressureFocusSummary.pressure_band || "clear").trim().toLowerCase(),
    pressure_focus_warning_dimension: String(topWarning.dimension || "").trim(),
    pressure_focus_warning_bucket: String(topWarning.bucket_key || "").trim(),
    pressure_focus_warning_matches_target: topWarning.matches_target === true,
    pressure_focus_locale_bucket: String(topLocaleSplit.bucket_key || "").trim(),
    pressure_focus_locale_cap: Math.max(0, Number(topLocaleSplit.suggested_recipient_cap || 0)),
    pressure_focus_variant_bucket: String(topVariantSplit.bucket_key || "").trim(),
    pressure_focus_variant_cap: Math.max(0, Number(topVariantSplit.suggested_recipient_cap || 0)),
    pressure_focus_cohort_bucket: String(topCohortSplit.bucket_key || "").trim(),
    pressure_focus_cohort_cap: Math.max(0, Number(topCohortSplit.suggested_recipient_cap || 0)),
    pressure_focus_escalation_band: String(pressureEscalation.escalation_band || "clear").trim().toLowerCase(),
    pressure_focus_escalation_reason: String(pressureEscalation.reason || "").trim(),
    pressure_focus_escalation_dimension: String(pressureEscalation.focus_dimension || "").trim(),
    pressure_focus_escalation_bucket: String(pressureEscalation.focus_bucket || "").trim(),
    pressure_focus_escalation_share: Math.max(0, Number(pressureEscalation.focus_share_of_recommended_cap || 0)),
    pressure_focus_escalation_matches_target: pressureEscalation.focus_matches_target === true,
    pressure_focus_effective_delta_ratio: Math.max(0, Number(pressureEscalation.effective_cap_delta_ratio || 0)),
    selection_focus_dimension: String(selectionSummary.focus_dimension || "").trim(),
    selection_focus_bucket: String(selectionSummary.focus_bucket || "").trim(),
    selection_focus_selected_matches: Math.max(0, Number(selectionSummary.selected_focus_matches || 0)),
    selection_prioritized_focus_matches: Math.max(0, Number(selectionSummary.prioritized_focus_matches || 0)),
    selection_query_strategy_applied_24h: Math.max(0, Number(selectionTrend.query_strategy_applied_24h || 0)),
    selection_query_strategy_applied_7d: Math.max(0, Number(selectionTrend.query_strategy_applied_7d || 0)),
    selection_latest_query_strategy_reason: String(selectionTrend.latest_query_strategy_reason || "").trim(),
    selection_latest_segment_strategy_reason: String(selectionTrend.latest_segment_strategy_reason || "").trim(),
    selection_top_query_strategy_reason: String(topQueryStrategyReason.bucket_key || "").trim(),
    selection_top_query_strategy_reason_count: Math.max(0, Number(topQueryStrategyReason.item_count || 0)),
    selection_top_segment_strategy_reason: String(topSegmentStrategyReason.bucket_key || "").trim(),
    selection_top_segment_strategy_reason_count: Math.max(0, Number(topSegmentStrategyReason.item_count || 0)),
    selection_prefilter_applied: selectionPrefilter.applied === true,
    selection_prefilter_dimension: String(selectionPrefilter.dimension || "").trim(),
    selection_prefilter_bucket: String(selectionPrefilter.bucket || "").trim(),
    selection_prefilter_reason: String(selectionPrefilter.reason || "").trim(),
    selection_prefilter_candidates_before: prefilterCandidatesBefore,
    selection_prefilter_candidates_after: prefilterCandidatesAfter,
    selection_prefilter_reduction_count: prefilterReductionCount,
    selection_prefilter_reduction_share: Math.max(0, Number(prefilterReductionShare || 0)),
    notify_on_watch: notifyOnWatch,
    cooldown_minutes: cooldownMinutes,
    previous_fingerprint: previousFingerprint,
    fingerprint,
    should_notify: shouldNotify,
    notification_reason: notificationReason
  };
}

function formatOpsAlertMessage(dispatchArtifact = {}, evaluation = {}) {
  const scheduler = dispatchArtifact?.scheduler_summary && typeof dispatchArtifact.scheduler_summary === "object"
    ? dispatchArtifact.scheduler_summary
    : {};
  const recommendation =
    scheduler.recipient_cap_recommendation && typeof scheduler.recipient_cap_recommendation === "object"
      ? scheduler.recipient_cap_recommendation
      : {};
  const lines = [
    "LiveOps Scheduler Alarm",
    `state=${String(evaluation.alarm_state || "clear")}`,
    `reason=${String(evaluation.alarm_reason || "-")}`,
    `skip_24h=${Math.max(0, Number(evaluation.skipped_24h || 0))}`,
    `skip_7d=${Math.max(0, Number(evaluation.skipped_7d || 0))}`,
    `latest_skip=${String(evaluation.latest_skip_reason || "-")}`,
    `latest_skip_at=${String(evaluation.latest_skip_at || "-")}`,
    `scene_gate=${String(scheduler.scene_gate_state || "no_data")}/${String(scheduler.scene_gate_effect || "open")}`,
    `scene_reason=${String(scheduler.scene_gate_reason || "-")}`,
    `recommended_cap=${Math.max(0, Number(recommendation.recommended_recipient_cap || 0))}`,
    `effective_cap_delta=${Math.max(0, Number(recommendation.effective_cap_delta || 0))}`,
    `pressure_band=${String(recommendation.pressure_band || "clear")}`,
    `pressure_reason=${String(recommendation.reason || "-")}`,
    `guidance_mode=${String(evaluation.targeting_guidance_mode || "-")}`,
    `guidance_state=${String(evaluation.targeting_guidance_state || "-")}`,
    `guidance_reason=${String(evaluation.targeting_guidance_reason || "-")}`,
    `pressure_focus=${String(recommendation.segment_key || "-")}/${String(recommendation.locale_bucket || "-")}/${String(
      recommendation.surface_bucket || "-"
    )}`,
    `focus_warning=${String(evaluation.pressure_focus_warning_dimension || "-")}/${String(evaluation.pressure_focus_warning_bucket || "-")}/${String(
      evaluation.pressure_focus_warning_matches_target === true ? "match" : "nomatch"
    )}`,
    `focus_locale_cap=${String(evaluation.pressure_focus_locale_bucket || "-")}:${Math.max(0, Number(evaluation.pressure_focus_locale_cap || 0))}`,
    `focus_variant_cap=${String(evaluation.pressure_focus_variant_bucket || "-")}:${Math.max(0, Number(evaluation.pressure_focus_variant_cap || 0))}`,
    `focus_escalation=${String(evaluation.pressure_focus_escalation_band || "-")}/${String(
      evaluation.pressure_focus_escalation_reason || "-"
    )}/${String(evaluation.pressure_focus_escalation_dimension || "-")}/${String(evaluation.pressure_focus_escalation_bucket || "-")}`,
    `selection_focus=${String(evaluation.selection_focus_dimension || "-")}/${String(evaluation.selection_focus_bucket || "-")}:${Math.max(
      0,
      Number(evaluation.selection_focus_selected_matches || 0)
    )}/${Math.max(0, Number(evaluation.selection_prioritized_focus_matches || 0))}`,
    `selection_query_trend=${Math.max(0, Number(evaluation.selection_query_strategy_applied_24h || 0))}/${Math.max(
      0,
      Number(evaluation.selection_query_strategy_applied_7d || 0)
    )}`,
    `selection_query_reason=${String(evaluation.selection_latest_query_strategy_reason || "-")}/${String(
      evaluation.selection_top_query_strategy_reason || "-"
    )}:${Math.max(0, Number(evaluation.selection_top_query_strategy_reason_count || 0))}`,
    `selection_segment_reason=${String(evaluation.selection_latest_segment_strategy_reason || "-")}/${String(
      evaluation.selection_top_segment_strategy_reason || "-"
    )}:${Math.max(0, Number(evaluation.selection_top_segment_strategy_reason_count || 0))}`,
    `selection_prefilter=${String(evaluation.selection_prefilter_applied === true ? "on" : "off")}/${String(
      evaluation.selection_prefilter_dimension || "-"
    )}/${String(evaluation.selection_prefilter_bucket || "-")}:${Math.max(0, Number(evaluation.selection_prefilter_candidates_after || 0))}/${Math.max(
      0,
      Number(evaluation.selection_prefilter_candidates_before || 0)
    )}`,
    `selection_prefilter_reason=${String(evaluation.selection_prefilter_reason || "-")}`,
    `selection_prefilter_reduction=${Math.round(Math.max(0, Number(evaluation.selection_prefilter_reduction_share || 0)) * 100)}%`,
    `focus_delta_ratio=${Math.round(Math.max(0, Number(evaluation.pressure_focus_effective_delta_ratio || 0)) * 100)}%`,
    `campaign=${String(dispatchArtifact.campaign_key || "-")}`,
    `dispatch_reason=${String(dispatchArtifact.reason || "-")}`
  ];
  return lines.join("\n");
}

async function postTelegramAlert(fetchImpl, botToken, chatId, text) {
  const token = String(botToken || "").trim();
  const targetChat = String(chatId || "").trim();
  if (!token || !targetChat) {
    return { attempted: false, sent: false, reason: "telegram_credentials_missing", sent_at: null };
  }
  const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: targetChat,
      text: String(text || ""),
      disable_web_page_preview: true
    })
  });
  const payload = await res.json().catch(() => ({}));
  return {
    attempted: true,
    sent: Boolean(res.ok && payload?.ok),
    status: Number(res.status || 0),
    reason: res.ok ? "" : String(payload?.description || `status_${res.status}`),
    sent_at: res.ok ? new Date().toISOString() : null
  };
}

function shouldRecordOpsAlertAudit(evaluation = {}, previousAlertArtifact = {}, telegram = {}) {
  const currentState = String(evaluation.alarm_state || "clear").trim();
  if (!currentState || currentState === "clear") {
    return false;
  }
  const previousFingerprint = String(previousAlertArtifact?.evaluation?.fingerprint || "").trim();
  const currentFingerprint = String(evaluation.fingerprint || "").trim();
  if (telegram.sent === true) {
    return true;
  }
  return !previousFingerprint || previousFingerprint !== currentFingerprint;
}

async function insertOpsAlertAudit(pool, payload) {
  if (!pool || typeof pool.connect !== "function") {
    return {
      attempted: false,
      recorded: false,
      reason: "pool_missing",
      created_at: null
    };
  }
  const client = await pool.connect();
  try {
    const createdAt = new Date().toISOString();
    await client.query(
      `INSERT INTO admin_audit (admin_id, action, target, payload_json)
       VALUES ($1, 'live_ops_campaign_ops_alert', $2, $3::jsonb);`,
      [Number(payload.admin_id || 0), `config:${LIVE_OPS_CAMPAIGN_CONFIG_KEY}`, JSON.stringify(payload)]
    );
    return {
      attempted: true,
      recorded: true,
      reason: "",
      created_at: createdAt
    };
  } finally {
    client.release();
  }
}

async function runLiveOpsOpsAlert(args = {}, deps = {}) {
  const fetchImpl = deps.fetchImpl || global.fetch?.bind(globalThis);
  const now = typeof deps.nowFactory === "function" ? deps.nowFactory() : new Date();
  const runtimeRepoRoot = String(deps.repoRoot || repoRoot).trim();
  const dispatchArtifactPaths = resolveLiveOpsDispatchArtifactPaths(runtimeRepoRoot);
  const alertArtifactPaths = resolveLiveOpsOpsAlertArtifactPaths(runtimeRepoRoot);
  const dispatchArtifact = readJsonSafe(dispatchArtifactPaths.latestJsonPath);
  const previousAlertArtifact = readJsonSafe(alertArtifactPaths.latestJsonPath);
  const notifyEnabled = parseBool(args.notify_telegram ?? args.notifyTelegram ?? process.env.V5_LIVE_OPS_NOTIFY_TELEGRAM, true);
  const notifyOnWatch = parseBool(args.notify_on_watch ?? args.notifyOnWatch ?? process.env.V5_LIVE_OPS_NOTIFY_WATCH, false);
  const cooldownMinutes = Math.max(
    15,
    toNumber(args.cooldown_minutes ?? args.cooldownMinutes ?? process.env.V5_LIVE_OPS_NOTIFY_COOLDOWN_MIN, 180)
  );
  const applyExitCode = parseBool(args.apply_exit_code ?? args.applyExitCode, true);
  const recordOpsAlertAudit =
    typeof deps.recordOpsAlertAudit === "function"
      ? deps.recordOpsAlertAudit
      : async (payload) => insertOpsAlertAudit(deps.pool, payload);

  if (!dispatchArtifact) {
    const output = {
      ok: false,
      generated_at: now.toISOString(),
      reason: "dispatch_artifact_missing",
      dispatch_artifact_path: dispatchArtifactPaths.latestJsonPath,
      evaluation: {
        alarm_state: "clear",
        should_notify: false,
        notification_reason: "dispatch_artifact_missing"
      },
      telegram: {
        attempted: false,
        sent: false,
        reason: "dispatch_artifact_missing",
        sent_at: null
      }
    };
    if (applyExitCode) {
      process.exitCode = 1;
    }
    return output;
  }

  const evaluation = evaluateOpsAlert(dispatchArtifact, previousAlertArtifact, {
    now,
    notifyOnWatch,
    cooldownMinutes
  });
  let telegram = {
    attempted: false,
    sent: false,
    reason: notifyEnabled ? "notification_not_required" : "notify_disabled",
    sent_at: null
  };

  if (evaluation.should_notify && notifyEnabled) {
    if (typeof fetchImpl !== "function") {
      telegram = {
        attempted: false,
        sent: false,
        reason: "fetch_missing",
        sent_at: null
      };
    } else {
      telegram = await postTelegramAlert(
        fetchImpl,
        deps.botToken ?? process.env.BOT_TOKEN ?? "",
        deps.adminTelegramId ?? process.env.ADMIN_TELEGRAM_ID ?? "",
        formatOpsAlertMessage(dispatchArtifact, evaluation)
      );
    }
  }

  let audit = {
    attempted: false,
    recorded: false,
    reason: "state_clear",
    created_at: null
  };
  if (shouldRecordOpsAlertAudit(evaluation, previousAlertArtifact, telegram)) {
    const campaignContext =
      dispatchArtifact && dispatchArtifact.campaign_context && typeof dispatchArtifact.campaign_context === "object"
        ? dispatchArtifact.campaign_context
        : {};
    const auditPayload = {
      admin_id: Math.max(
        0,
        toNumber(args.admin_id ?? args.adminId ?? process.env.LIVE_OPS_ALERT_ADMIN_ID ?? process.env.LIVE_OPS_SCHEDULER_ADMIN_ID, 0)
      ),
      campaign_key: String(dispatchArtifact.campaign_key || "").trim(),
      campaign_version: Math.max(0, Number(dispatchArtifact.version || 0)),
      dispatch_ref: String(dispatchArtifact.dispatch_ref || "").trim(),
      dispatch_reason: String(dispatchArtifact.reason || "").trim(),
      reason: String(evaluation.notification_reason || "").trim(),
      alarm_state: String(evaluation.alarm_state || "clear").trim(),
      alarm_reason: String(evaluation.alarm_reason || "").trim(),
      skipped_24h: Math.max(0, Number(evaluation.skipped_24h || 0)),
      skipped_7d: Math.max(0, Number(evaluation.skipped_7d || 0)),
      latest_skip_reason: String(evaluation.latest_skip_reason || "").trim(),
      latest_skip_at: evaluation.latest_skip_at || null,
      should_notify: evaluation.should_notify === true,
      fingerprint: String(evaluation.fingerprint || "").trim(),
      scene_gate_state: String(dispatchArtifact?.scheduler_summary?.scene_gate_state || "no_data").trim() || "no_data",
      scene_gate_effect: String(dispatchArtifact?.scheduler_summary?.scene_gate_effect || "open").trim() || "open",
      scene_gate_reason: String(dispatchArtifact?.scheduler_summary?.scene_gate_reason || "").trim(),
      experiment_key: String(campaignContext.experiment_key || "webapp_react_v1").trim() || "webapp_react_v1",
      locale_bucket: String(campaignContext.locale_bucket || "").trim(),
      segment_key: String(campaignContext.segment_key || dispatchArtifact.segment_key || "").trim(),
      surface_bucket: String(campaignContext.surface_bucket || "").trim(),
      variant_bucket: String(campaignContext.variant_bucket || "").trim(),
      cohort_bucket: String(campaignContext.cohort_bucket || "").trim(),
      recommendation_pressure_band: String(evaluation.recommendation_pressure_band || "clear").trim() || "clear",
      recommended_recipient_cap: Math.max(0, Number(evaluation.recommended_recipient_cap || 0)),
      effective_cap_delta: Math.max(0, Number(evaluation.effective_cap_delta || 0)),
      recommendation_reason: String(evaluation.recommendation_reason || "").trim(),
      targeting_guidance_mode: String(evaluation.targeting_guidance_mode || "balanced").trim() || "balanced",
      targeting_guidance_state: String(evaluation.targeting_guidance_state || "clear").trim() || "clear",
      targeting_guidance_reason: String(evaluation.targeting_guidance_reason || "").trim(),
      pressure_focus_band: String(evaluation.pressure_focus_band || "clear").trim() || "clear",
      pressure_focus_warning_dimension: String(evaluation.pressure_focus_warning_dimension || "").trim(),
      pressure_focus_warning_bucket: String(evaluation.pressure_focus_warning_bucket || "").trim(),
      pressure_focus_warning_matches_target: evaluation.pressure_focus_warning_matches_target === true,
      pressure_focus_locale_bucket: String(evaluation.pressure_focus_locale_bucket || "").trim(),
      pressure_focus_locale_cap: Math.max(0, Number(evaluation.pressure_focus_locale_cap || 0)),
      pressure_focus_variant_bucket: String(evaluation.pressure_focus_variant_bucket || "").trim(),
      pressure_focus_variant_cap: Math.max(0, Number(evaluation.pressure_focus_variant_cap || 0)),
      pressure_focus_cohort_bucket: String(evaluation.pressure_focus_cohort_bucket || "").trim(),
      pressure_focus_cohort_cap: Math.max(0, Number(evaluation.pressure_focus_cohort_cap || 0)),
      pressure_focus_escalation_band: String(evaluation.pressure_focus_escalation_band || "clear").trim() || "clear",
      pressure_focus_escalation_reason: String(evaluation.pressure_focus_escalation_reason || "").trim(),
      pressure_focus_escalation_dimension: String(evaluation.pressure_focus_escalation_dimension || "").trim(),
      pressure_focus_escalation_bucket: String(evaluation.pressure_focus_escalation_bucket || "").trim(),
      pressure_focus_escalation_share: Math.max(0, Number(evaluation.pressure_focus_escalation_share || 0)),
      pressure_focus_escalation_matches_target: evaluation.pressure_focus_escalation_matches_target === true,
      pressure_focus_effective_delta_ratio: Math.max(0, Number(evaluation.pressure_focus_effective_delta_ratio || 0)),
      selection_focus_dimension: String(evaluation.selection_focus_dimension || "").trim(),
      selection_focus_bucket: String(evaluation.selection_focus_bucket || "").trim(),
      selection_focus_selected_matches: Math.max(0, Number(evaluation.selection_focus_selected_matches || 0)),
      selection_prioritized_focus_matches: Math.max(0, Number(evaluation.selection_prioritized_focus_matches || 0)),
      selection_query_strategy_applied_24h: Math.max(0, Number(evaluation.selection_query_strategy_applied_24h || 0)),
      selection_query_strategy_applied_7d: Math.max(0, Number(evaluation.selection_query_strategy_applied_7d || 0)),
      selection_latest_query_strategy_reason: String(evaluation.selection_latest_query_strategy_reason || "").trim(),
      selection_latest_segment_strategy_reason: String(evaluation.selection_latest_segment_strategy_reason || "").trim(),
      selection_top_query_strategy_reason: String(evaluation.selection_top_query_strategy_reason || "").trim(),
      selection_top_query_strategy_reason_count: Math.max(0, Number(evaluation.selection_top_query_strategy_reason_count || 0)),
      selection_top_segment_strategy_reason: String(evaluation.selection_top_segment_strategy_reason || "").trim(),
      selection_top_segment_strategy_reason_count: Math.max(0, Number(evaluation.selection_top_segment_strategy_reason_count || 0)),
      selection_prefilter_applied: evaluation.selection_prefilter_applied === true,
      selection_prefilter_dimension: String(evaluation.selection_prefilter_dimension || "").trim(),
      selection_prefilter_bucket: String(evaluation.selection_prefilter_bucket || "").trim(),
      selection_prefilter_reason: String(evaluation.selection_prefilter_reason || "").trim(),
      selection_prefilter_candidates_before: Math.max(0, Number(evaluation.selection_prefilter_candidates_before || 0)),
      selection_prefilter_candidates_after: Math.max(0, Number(evaluation.selection_prefilter_candidates_after || 0)),
      selection_prefilter_reduction_count: Math.max(0, Number(evaluation.selection_prefilter_reduction_count || 0)),
      selection_prefilter_reduction_share: Math.max(0, Number(evaluation.selection_prefilter_reduction_share || 0)),
      telegram_sent: telegram.sent === true,
      telegram_reason: String(telegram.reason || "").trim(),
      telegram_sent_at: telegram.sent_at || null
    };
    try {
      audit = await recordOpsAlertAudit(auditPayload);
    } catch (err) {
      audit = {
        attempted: true,
        recorded: false,
        reason: String(err?.message || "ops_alert_audit_failed"),
        created_at: null
      };
    }
  }

  const output = {
    ok: !evaluation.should_notify || telegram.sent === true || telegram.reason === "cooldown_active",
    generated_at: now.toISOString(),
    reason: evaluation.notification_reason,
    dispatch_artifact_path: dispatchArtifactPaths.latestJsonPath,
    evaluation,
    telegram,
    audit
  };

  if (!fs.existsSync(alertArtifactPaths.outDir)) {
    fs.mkdirSync(alertArtifactPaths.outDir, { recursive: true });
  }
  fs.writeFileSync(alertArtifactPaths.latestJsonPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  if (!output.ok && applyExitCode) {
    process.exitCode = 1;
  }

  console.log(
    `[liveops-ops-alert] alarm=${String(evaluation.alarm_state)} notify=${Boolean(evaluation.should_notify)} sent=${Boolean(
      telegram.sent
    )} reason=${String(output.reason || "")}`
  );
  console.log(`[liveops-ops-alert] report=${alertArtifactPaths.latestJsonPath}`);
  return output;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const databaseUrl = String(process.env.DATABASE_URL || "").trim();
  let pool = null;
  if (databaseUrl) {
    pool = new Pool(
      buildPgPoolConfig({
        databaseUrl,
        sslEnabled: process.env.DATABASE_SSL === "1",
        rejectUnauthorized: false
      })
    );
  }
  runLiveOpsOpsAlert(parseArgs(process.argv.slice(2)), { pool })
    .catch((err) => {
      console.error("[err] v5_live_ops_ops_alert failed:", err?.message || err);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (pool) {
        await pool.end();
      }
    });
}

export { parseArgs, parseBool, toNumber, evaluateOpsAlert, formatOpsAlertMessage, shouldRecordOpsAlertAudit, runLiveOpsOpsAlert };
