import { t, type Lang } from "../../../i18n";
import { SHELL_ACTION_KEY } from "../../../../core/navigation/shellActions.js";
import { buildLiveOpsCampaignPreflight } from "../../../../core/admin/liveOpsCampaignPreflight.js";

type LiveOpsCampaignCardProps = {
  lang: Lang;
  liveOpsCampaignData: Record<string, unknown> | null;
  liveOpsCampaignDispatchData: Record<string, unknown> | null;
  liveOpsCampaignDraft: string;
  liveOpsCampaignError: string;
  liveOpsCampaignApprovalError: string;
  liveOpsCampaignDispatchError: string;
  liveOpsCampaignSaving: boolean;
  liveOpsCampaignApprovaling: boolean;
  liveOpsCampaignDispatching: boolean;
  onLiveOpsCampaignDraftChange: (value: string) => void;
  onRefreshLiveOpsCampaign: () => void;
  onSaveLiveOpsCampaign: () => void;
  onRequestLiveOpsCampaignApproval: () => void;
  onApproveLiveOpsCampaign: () => void;
  onRevokeLiveOpsCampaignApproval: () => void;
  onDryRunLiveOpsCampaign: () => void;
  onDispatchLiveOpsCampaign: () => void;
  onSurfaceAction: (sectionKey: string, slotKey: string, fallbackActionKey: string, sourcePanelKey?: string) => void;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object") : [];
}

function asText(value: unknown, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function asCount(value: unknown) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? String(num) : "0";
}

function toPct(value: unknown) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) {
    return "0%";
  }
  return `${Math.round(Math.max(0, num) * 100)}%`;
}

function formatWarningCode(value: string) {
  return asText(value, "-").replace(/_/g, " ");
}

function formatBucketCode(value: string) {
  return asText(value, "unknown").replace(/_/g, " ");
}

function formatTimelineActionLabel(lang: Lang, value: string) {
  const actionKey = asText(value, "")
    .replace(/^live_ops_campaign_/, "")
    .trim();
  const dictionary: Record<string, Parameters<typeof t>[1]> = {
    save: "admin_live_ops_action_save",
    request: "admin_live_ops_action_request",
    approve: "admin_live_ops_action_approve",
    revoke: "admin_live_ops_action_revoke",
    scheduler_skip: "admin_live_ops_action_scheduler_skip",
    ops_alert: "admin_live_ops_action_ops_alert",
    dry_run: "admin_live_ops_action_dry_run",
    dispatch: "admin_live_ops_action_dispatch"
  };
  return dictionary[actionKey] ? t(lang, dictionary[actionKey]) : formatWarningCode(actionKey || "unknown");
}

function formatGuidanceModeLabel(lang: Lang, value: string) {
  const dictionary: Record<string, Parameters<typeof t>[1]> = {
    protective: "admin_live_ops_guidance_mode_protective",
    balanced: "admin_live_ops_guidance_mode_balanced",
    aggressive: "admin_live_ops_guidance_mode_aggressive"
  };
  return dictionary[value] ? t(lang, dictionary[value]) : formatWarningCode(value || "balanced");
}

function BreakdownList(props: { title: string; rows: Array<Record<string, unknown>> }) {
  if (!props.rows.length) {
    return <p className="akrMuted">{props.title}: -</p>;
  }
  return (
    <section className="akrMiniPanel">
      <h4>{props.title}</h4>
      <ul className="akrList">
        {props.rows.map((row, index) => (
          <li key={`${asText(row.bucket_key, "unknown")}_${index}`}>
            <span>{formatBucketCode(asText(row.bucket_key, "unknown"))}</span>
            <strong>{asCount(row.item_count)}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PressureWarningList(props: { title: string; rows: Array<Record<string, unknown>>; lang: Lang }) {
  if (!props.rows.length) {
    return <p className="akrMuted">{props.title}: -</p>;
  }
  return (
    <section className="akrMiniPanel">
      <h4>{props.title}</h4>
      <ul className="akrList">
        {props.rows.map((row, index) => (
          <li key={`${asText(row.dimension, "dimension")}_${asText(row.bucket_key, "unknown")}_${index}`}>
            <span>
              {formatBucketCode(asText(row.dimension, "dimension"))}: {formatBucketCode(asText(row.bucket_key, "unknown"))}
            </span>
            <strong>
              {asCount(row.item_count)} | {t(props.lang, "admin_live_ops_pressure_match_label")}:{" "}
              {row.matches_target === true ? t(props.lang, "admin_live_ops_bool_yes") : t(props.lang, "admin_live_ops_bool_no")}
            </strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CapSplitList(props: { title: string; rows: Array<Record<string, unknown>> }) {
  if (!props.rows.length) {
    return <p className="akrMuted">{props.title}: -</p>;
  }
  return (
    <section className="akrMiniPanel">
      <h4>{props.title}</h4>
      <ul className="akrList">
        {props.rows.map((row, index) => (
          <li key={`${asText(row.bucket_key, "unknown")}_${index}`}>
            <span>{formatBucketCode(asText(row.bucket_key, "unknown"))}</span>
            <strong>
              {asCount(row.suggested_recipient_cap)} / {asCount(row.item_count)}
            </strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

function GuidanceModeList(props: { title: string; rows: Array<Record<string, unknown>>; lang: Lang }) {
  if (!props.rows.length) {
    return <p className="akrMuted">{props.title}: -</p>;
  }
  return (
    <section className="akrMiniPanel">
      <h4>{props.title}</h4>
      <ul className="akrList">
        {props.rows.map((row, index) => (
          <li key={`${asText(row.mode_key, "mode")}_${index}`}>
            <span>{formatGuidanceModeLabel(props.lang, asText(row.mode_key, "balanced"))}</span>
            <strong>
              {asCount(row.suggested_recipient_cap)} | {formatWarningCode(asText(row.reason_code))} |{" "}
              {asCount(row.delta_vs_recommended)}
            </strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SkipDailyTrendList(props: { title: string; rows: Array<Record<string, unknown>> }) {
  if (!props.rows.length) {
    return <p className="akrMuted">{props.title}: -</p>;
  }
  return (
    <section className="akrMiniPanel">
      <h4>{props.title}</h4>
      <ul className="akrList">
        {props.rows.map((row, index) => (
          <li key={`${asText(row.day, "day")}_${index}`}>
            <span>{asText(row.day)}</span>
            <strong>{asCount(row.skip_count)}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

function OpsAlertDailyTrendList(props: { title: string; rows: Array<Record<string, unknown>> }) {
  if (!props.rows.length) {
    return <p className="akrMuted">{props.title}: -</p>;
  }
  return (
    <section className="akrMiniPanel">
      <h4>{props.title}</h4>
      <ul className="akrList">
        {props.rows.map((row, index) => (
          <li key={`${asText(row.day, "day")}_${index}`}>
            <span>{asText(row.day)}</span>
            <strong>
              {asCount(row.alert_count)} / {asCount(row.telegram_sent_count)} / {asCount(row.effective_cap_delta_sum)} /{" "}
              {asCount(row.effective_cap_delta_max)}
            </strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SelectionDailyTrendList(props: { title: string; rows: Array<Record<string, unknown>> }) {
  if (!props.rows.length) {
    return <p className="akrMuted">{props.title}: -</p>;
  }
  return (
    <section className="akrMiniPanel">
      <h4>{props.title}</h4>
      <ul className="akrList">
        {props.rows.map((row, index) => (
          <li key={`${asText(row.day, "day")}_${index}`}>
            <span>{asText(row.day)}</span>
            <strong>
              {asCount(row.dispatch_count)} / {asCount(row.query_strategy_applied_count)} / {asCount(row.prefilter_applied_count)} / {asCount(row.prefilter_delta_sum)} /{" "}
              {asCount(row.selected_focus_matches)} / {asCount(row.prioritized_focus_matches)}
            </strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function LiveOpsCampaignCard(props: LiveOpsCampaignCardProps) {
  const snapshot = asRecord(props.liveOpsCampaignData);
  const approvalSummary = asRecord(snapshot.approval_summary);
  const schedulerSummary = asRecord(snapshot.scheduler_summary);
  const schedulerRecommendation = asRecord(schedulerSummary.recipient_cap_recommendation);
  const schedulerTargetingGuidance = asRecord(schedulerSummary.targeting_guidance);
  const schedulerSkipSummary = asRecord(snapshot.scheduler_skip_summary);
  const versionHistory = asArray(snapshot.version_history);
  const dispatchHistory = asArray(snapshot.dispatch_history);
  const operatorTimeline = asArray(snapshot.operator_timeline);
  const deliverySummary = asRecord(snapshot.delivery_summary);
  const sceneRuntimeSummary = asRecord(snapshot.scene_runtime_summary);
  const taskSummary = asRecord(snapshot.task_summary);
  const taskSelectionSummary = asRecord(taskSummary.selection_summary);
  const taskSelectionQueryStrategy = asRecord(taskSelectionSummary.query_strategy_summary);
  const taskSelectionPrefilter = asRecord(taskSelectionSummary.prefilter_summary);
  const selectionTrendSummary = asRecord(snapshot.selection_trend_summary);
  const opsAlertSummary = asRecord(snapshot.ops_alert_summary);
  const opsAlertTrendSummary = asRecord(snapshot.ops_alert_trend_summary);
  const warnings = Array.isArray(approvalSummary.warnings) ? approvalSummary.warnings.map((row) => String(row || "").trim()).filter(Boolean) : [];
  const localeBreakdown = asArray(deliverySummary.locale_breakdown);
  const segmentBreakdown = asArray(deliverySummary.segment_breakdown);
  const surfaceBreakdown = asArray(deliverySummary.surface_breakdown);
  const variantBreakdown = asArray(deliverySummary.variant_breakdown);
  const cohortBreakdown = asArray(deliverySummary.cohort_breakdown);
  const dailyBreakdown = asArray(deliverySummary.daily_breakdown);
  const schedulerSkipDailyBreakdown = asArray(schedulerSkipSummary.daily_breakdown);
  const schedulerSkipReasonBreakdown = asArray(schedulerSkipSummary.reason_breakdown);
  const sceneDailyBreakdown = asArray(sceneRuntimeSummary.daily_breakdown_7d);
  const sceneBandBreakdown = asArray(sceneRuntimeSummary.band_breakdown_7d);
  const sceneQualityBreakdown = asArray(sceneRuntimeSummary.quality_breakdown_24h);
  const scenePerfBreakdown = asArray(sceneRuntimeSummary.perf_breakdown_24h);
  const opsAlertTrendDailyBreakdown = asArray(opsAlertTrendSummary.daily_breakdown);
  const opsAlertTrendReasonBreakdown = asArray(opsAlertTrendSummary.reason_breakdown);
  const opsAlertTrendLocaleBreakdown = asArray(opsAlertTrendSummary.locale_breakdown);
  const opsAlertTrendSegmentBreakdown = asArray(opsAlertTrendSummary.segment_breakdown);
  const opsAlertTrendSurfaceBreakdown = asArray(opsAlertTrendSummary.surface_breakdown);
  const opsAlertTrendVariantBreakdown = asArray(opsAlertTrendSummary.variant_breakdown);
  const opsAlertTrendCohortBreakdown = asArray(opsAlertTrendSummary.cohort_breakdown);
  const selectionTrendDailyBreakdown = asArray(selectionTrendSummary.daily_breakdown);
  const selectionTrendQueryReasons = asArray(selectionTrendSummary.query_strategy_reason_breakdown);
  const selectionTrendSegmentReasons = asArray(selectionTrendSummary.segment_strategy_reason_breakdown);
  const selectionTrendPrefilterReasons = asArray(selectionTrendSummary.prefilter_reason_breakdown);
  const sceneAlarmReasons = Array.isArray(sceneRuntimeSummary.alarm_reasons_7d)
    ? sceneRuntimeSummary.alarm_reasons_7d.map((row) => String(row || "").trim()).filter(Boolean)
    : [];
  const sceneWorstDay = asRecord(sceneRuntimeSummary.worst_day_7d);
  const preflight = buildLiveOpsCampaignPreflight(
    props.liveOpsCampaignDraft || "{}",
    sceneRuntimeSummary,
    schedulerSkipSummary,
    opsAlertTrendSummary
  );
  const preflightRecommendation = asRecord(preflight.recipient_cap_recommendation);
  const preflightPressureFocus = asRecord(preflight.pressure_focus);
  const preflightPressureEscalation = asRecord(preflight.pressure_escalation);
  const preflightTargetingGuidance = asRecord(preflight.targeting_guidance);
  const preflightPressureWarnings = asArray(preflightPressureFocus.warning_rows);
  const preflightLocaleCapSplit = asArray(preflightPressureFocus.locale_cap_split);
  const preflightVariantCapSplit = asArray(preflightPressureFocus.variant_cap_split);
  const preflightCohortCapSplit = asArray(preflightPressureFocus.cohort_cap_split);
  const preflightGuidanceModes = asArray(preflightTargetingGuidance.mode_rows);
  const liveReady = approvalSummary.live_dispatch_ready === true;
  const approvalState = asText(approvalSummary.approval_state);
  const scheduleState = asText(approvalSummary.schedule_state);

  return (
    <section className="akrCard akrCardWide" data-akr-panel-key="panel_admin_live_ops" data-akr-focus-key="campaign_editor">
      <h3>{t(props.lang, "admin_live_ops_title")}</h3>
      <div className="akrActionRow">
        <button className="akrBtn akrBtnGhost" onClick={props.onRefreshLiveOpsCampaign}>
          {t(props.lang, "admin_live_ops_refresh")}
        </button>
        <button
          className="akrBtn akrBtnGhost"
          onClick={() => props.onSurfaceAction("admin_live_ops", "queue", SHELL_ACTION_KEY.ADMIN_QUEUE_PANEL, "panel_admin_live_ops")}
        >
          {t(props.lang, "admin_nav_queue")}
        </button>
        <button
          className="akrBtn akrBtnGhost"
          onClick={() => props.onSurfaceAction("admin_live_ops", "policy", SHELL_ACTION_KEY.ADMIN_POLICY_PANEL, "panel_admin_live_ops")}
        >
          {t(props.lang, "admin_nav_policy")}
        </button>
        <button
          className="akrBtn akrBtnGhost"
          onClick={() => props.onSurfaceAction("admin_live_ops", "runtime", SHELL_ACTION_KEY.ADMIN_RUNTIME_META, "panel_admin_live_ops")}
        >
          {t(props.lang, "admin_nav_runtime")}
        </button>
        <button className="akrBtn akrBtnAccent" onClick={props.onSaveLiveOpsCampaign} disabled={props.liveOpsCampaignSaving}>
          {props.liveOpsCampaignSaving ? t(props.lang, "admin_live_ops_saving") : t(props.lang, "admin_live_ops_save")}
        </button>
        <button className="akrBtn akrBtnGhost" onClick={props.onRequestLiveOpsCampaignApproval} disabled={props.liveOpsCampaignApprovaling}>
          {props.liveOpsCampaignApprovaling ? t(props.lang, "admin_live_ops_approval_running") : t(props.lang, "admin_live_ops_request_approval")}
        </button>
        <button className="akrBtn akrBtnGhost" onClick={props.onApproveLiveOpsCampaign} disabled={props.liveOpsCampaignApprovaling}>
          {props.liveOpsCampaignApprovaling ? t(props.lang, "admin_live_ops_approval_running") : t(props.lang, "admin_live_ops_approve")}
        </button>
        <button className="akrBtn akrBtnGhost" onClick={props.onRevokeLiveOpsCampaignApproval} disabled={props.liveOpsCampaignApprovaling}>
          {props.liveOpsCampaignApprovaling ? t(props.lang, "admin_live_ops_approval_running") : t(props.lang, "admin_live_ops_revoke")}
        </button>
        <button className="akrBtn akrBtnGhost" onClick={props.onDryRunLiveOpsCampaign} disabled={props.liveOpsCampaignDispatching}>
          {props.liveOpsCampaignDispatching ? t(props.lang, "admin_live_ops_dispatching") : t(props.lang, "admin_live_ops_dry_run")}
        </button>
        <button className="akrBtn akrBtnAccent" onClick={props.onDispatchLiveOpsCampaign} disabled={props.liveOpsCampaignDispatching}>
          {props.liveOpsCampaignDispatching ? t(props.lang, "admin_live_ops_dispatching") : t(props.lang, "admin_live_ops_dispatch")}
        </button>
      </div>
      <textarea
        className="akrTextarea"
        value={props.liveOpsCampaignDraft}
        onChange={(e) => props.onLiveOpsCampaignDraftChange(e.target.value)}
        aria-label="live-ops-campaign-draft"
        spellCheck={false}
      />
      {props.liveOpsCampaignError ? <p className="akrErrorLine">{props.liveOpsCampaignError}</p> : null}
      {props.liveOpsCampaignApprovalError ? <p className="akrErrorLine">{props.liveOpsCampaignApprovalError}</p> : null}
      {props.liveOpsCampaignDispatchError ? <p className="akrErrorLine">{props.liveOpsCampaignDispatchError}</p> : null}
      <section className="akrMiniPanel" data-akr-focus-key="scheduler_preflight">
        <h4>{t(props.lang, "admin_live_ops_preflight_title")}</h4>
        {preflight.ok ? (
          <>
            <div className="akrChipRow">
              <span className="akrChip">
                {t(props.lang, "admin_live_ops_segment_label")}: {asText(preflight.segment_key)}
              </span>
              <span className="akrChip">
                {t(props.lang, "admin_live_ops_recipients_label")}: {asCount(preflight.max_recipients)}
              </span>
              <span className="akrChip">
                {t(props.lang, "admin_live_ops_scheduler_scene_state_label")}: {asText(preflight.gate?.scene_gate_state)}
              </span>
              <span className="akrChip">
                {t(props.lang, "admin_live_ops_scheduler_scene_effect_label")}: {asText(preflight.gate?.scene_gate_effect)}
              </span>
              <span className="akrChip">
                {t(props.lang, "admin_live_ops_scheduler_scene_cap_label")}: {asCount(preflight.gate?.scene_gate_recipient_cap)}
              </span>
              <span className="akrChip">
                {t(props.lang, "admin_live_ops_skip_24h")}: {asCount(preflight.recent_skip_24h)}
              </span>
              <span className="akrChip">
                {t(props.lang, "admin_live_ops_skip_7d")}: {asCount(preflight.recent_skip_7d)}
              </span>
              <span className="akrChip">
                {t(props.lang, "admin_live_ops_skip_pressure_label")}: {asText(preflight.recent_skip_pressure)}
              </span>
              <span className="akrChip">
                {t(props.lang, "admin_live_ops_recommend_cap_label")}: {asCount(preflightRecommendation.recommended_recipient_cap)}
              </span>
              <span className="akrChip">
                {t(props.lang, "admin_live_ops_recommend_delta_label")}: {asCount(preflightRecommendation.effective_cap_delta)}
              </span>
              <span className="akrChip">
                {t(props.lang, "admin_live_ops_recommend_pressure_label")}: {asText(preflightRecommendation.pressure_band)}
              </span>
              <span className="akrChip">
                {t(props.lang, "admin_live_ops_recommend_experiment_label")}: {asText(preflightRecommendation.experiment_key)}
              </span>
            </div>
            <p className="akrMutedLine">
              {t(props.lang, "admin_live_ops_preflight_note")} {asText(preflight.gate?.scene_gate_reason, "-")}
            </p>
            <p className="akrMutedLine">
              {t(props.lang, "admin_live_ops_skip_reason_label")}: {asText(preflight.latest_skip_reason)} | {t(props.lang, "admin_live_ops_skip_at_label")}:{" "}
              {asText(preflight.latest_skip_at)}
            </p>
            <p className="akrMutedLine">
              {t(props.lang, "admin_live_ops_recommend_reason_label")}: {asText(preflightRecommendation.reason)} |{" "}
              {t(props.lang, "admin_live_ops_recommend_focus_label")}: {asText(preflightRecommendation.segment_key, "-")} /{" "}
              {asText(preflightRecommendation.locale_bucket, "-")} / {asText(preflightRecommendation.surface_bucket, "-")}
            </p>
            <p className="akrMutedLine">
              {t(props.lang, "admin_live_ops_guidance_default_label")}: {formatGuidanceModeLabel(props.lang, asText(preflightTargetingGuidance.default_mode, "balanced"))} |{" "}
              {t(props.lang, "admin_live_ops_guidance_state_label")}: {asText(preflightTargetingGuidance.guidance_state)} |{" "}
              {t(props.lang, "admin_live_ops_guidance_reason_label")}: {asText(preflightTargetingGuidance.guidance_reason)}
            </p>
            <p className="akrMutedLine">
              {t(props.lang, "admin_live_ops_escalation_band_label")}: {asText(preflightPressureEscalation.escalation_band)} |{" "}
              {t(props.lang, "admin_live_ops_escalation_focus_label")}: {asText(preflightPressureEscalation.focus_dimension, "-")} /{" "}
              {asText(preflightPressureEscalation.focus_bucket, "-")} | {t(props.lang, "admin_live_ops_escalation_share_label")}:{" "}
              {toPct(preflightPressureEscalation.focus_share_of_recommended_cap)}
            </p>
            <div className="akrSplit">
              <PressureWarningList
                title={t(props.lang, "admin_live_ops_pressure_warning_title")}
                rows={preflightPressureWarnings}
                lang={props.lang}
              />
              <CapSplitList title={t(props.lang, "admin_live_ops_pressure_split_locale_title")} rows={preflightLocaleCapSplit} />
            </div>
            <div className="akrSplit">
              <CapSplitList title={t(props.lang, "admin_live_ops_pressure_split_variant_title")} rows={preflightVariantCapSplit} />
              <CapSplitList title={t(props.lang, "admin_live_ops_pressure_split_cohort_title")} rows={preflightCohortCapSplit} />
            </div>
            <GuidanceModeList
              title={t(props.lang, "admin_live_ops_guidance_modes_title")}
              rows={preflightGuidanceModes}
              lang={props.lang}
            />
          </>
        ) : (
          <p className="akrErrorLine">{preflight.error}</p>
        )}
      </section>
      <div className="akrSplit">
        <section className="akrMiniPanel" data-akr-focus-key="approval_gate">
          <h4>{t(props.lang, "admin_live_ops_gate_title")}</h4>
          <p className="akrValue">{liveReady ? t(props.lang, "admin_live_ops_gate_ready") : t(props.lang, "admin_live_ops_gate_blocked")}</p>
          <ul className="akrList">
            <li>
              <span>{t(props.lang, "admin_live_ops_status_label")}</span>
              <strong>{asText(approvalSummary.status)}</strong>
            </li>
            <li>
              <span>{t(props.lang, "admin_live_ops_segment_label")}</span>
              <strong>{asText(approvalSummary.segment_key)}</strong>
            </li>
            <li>
              <span>{t(props.lang, "admin_live_ops_recipients_label")}</span>
              <strong>{asCount(approvalSummary.max_recipients)}</strong>
            </li>
            <li>
              <span>{t(props.lang, "admin_live_ops_approval_state_label")}</span>
              <strong>{approvalState}</strong>
            </li>
            <li>
              <span>{t(props.lang, "admin_live_ops_schedule_state_label")}</span>
              <strong>{scheduleState}</strong>
            </li>
            <li>
              <span>{t(props.lang, "admin_live_ops_schedule_start_label")}</span>
              <strong>{asText(approvalSummary.schedule_start_at)}</strong>
            </li>
            <li>
              <span>{t(props.lang, "admin_live_ops_schedule_end_label")}</span>
              <strong>{asText(approvalSummary.schedule_end_at)}</strong>
            </li>
            <li>
              <span>{t(props.lang, "admin_live_ops_last_saved_label")}</span>
              <strong>{asText(approvalSummary.last_saved_at)}</strong>
            </li>
            <li>
              <span>{t(props.lang, "admin_live_ops_last_dispatch_label")}</span>
              <strong>{asText(approvalSummary.last_dispatch_at)}</strong>
            </li>
            <li>
              <span>{t(props.lang, "admin_live_ops_approved_by_label")}</span>
              <strong>#{asCount(approvalSummary.approval_approved_by)}</strong>
            </li>
          </ul>
          {warnings.length ? (
            <>
              <h4>{t(props.lang, "admin_live_ops_warnings_title")}</h4>
              <ul className="akrList">
                {warnings.map((warning) => (
                  <li key={warning}>
                    <span>{formatWarningCode(warning)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
        <section className="akrMiniPanel" data-akr-focus-key="dispatch_history">
          <h4>{t(props.lang, "admin_live_ops_dispatch_history_title")}</h4>
          {dispatchHistory.length ? (
            <ul className="akrList">
              {dispatchHistory.map((row, index) => (
                <li key={`${asText(row.dispatch_ref, "dispatch")}_${index}`}>
                  <span>
                    {asText(row.action)} | {asText(row.segment_key)} | {t(props.lang, row.dry_run === true ? "admin_live_ops_mode_dry_run" : "admin_live_ops_mode_live")}
                  </span>
                  <strong>
                    {asCount(row.sent)}/{asCount(row.attempted)} @ {asText(row.created_at)}
                  </strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="akrMuted">{t(props.lang, "admin_live_ops_no_history")}</p>
          )}
        </section>
      </div>
      <section className="akrMiniPanel" data-akr-focus-key="scheduler_summary">
        <h4>{t(props.lang, "admin_live_ops_scheduler_title")}</h4>
        <ul className="akrList">
          <li>
            <span>{t(props.lang, "admin_live_ops_scheduler_window_label")}</span>
            <strong>{asText(schedulerSummary.window_key)}</strong>
          </li>
          <li>
            <span>{t(props.lang, "admin_live_ops_scheduler_ready_label")}</span>
            <strong>{schedulerSummary.ready_for_auto_dispatch === true ? t(props.lang, "admin_live_ops_bool_yes") : t(props.lang, "admin_live_ops_bool_no")}</strong>
          </li>
          <li>
            <span>{t(props.lang, "admin_live_ops_scheduler_scene_state_label")}</span>
            <strong>{asText(schedulerSummary.scene_gate_state)}</strong>
          </li>
          <li>
            <span>{t(props.lang, "admin_live_ops_scheduler_scene_effect_label")}</span>
            <strong>{asText(schedulerSummary.scene_gate_effect)}</strong>
          </li>
          <li>
            <span>{t(props.lang, "admin_live_ops_scheduler_scene_cap_label")}</span>
            <strong>{asCount(schedulerSummary.scene_gate_recipient_cap)}</strong>
          </li>
          <li>
            <span>{t(props.lang, "admin_live_ops_recommend_cap_label")}</span>
            <strong>{asCount(schedulerRecommendation.recommended_recipient_cap)}</strong>
          </li>
          <li>
            <span>{t(props.lang, "admin_live_ops_recommend_delta_label")}</span>
            <strong>{asCount(schedulerRecommendation.effective_cap_delta)}</strong>
          </li>
          <li>
            <span>{t(props.lang, "admin_live_ops_recommend_pressure_label")}</span>
            <strong>{asText(schedulerRecommendation.pressure_band)}</strong>
          </li>
          <li>
            <span>{t(props.lang, "admin_live_ops_recommend_reason_label")}</span>
            <strong>{asText(schedulerRecommendation.reason)}</strong>
          </li>
          <li>
            <span>{t(props.lang, "admin_live_ops_guidance_default_label")}</span>
            <strong>{formatGuidanceModeLabel(props.lang, asText(schedulerTargetingGuidance.default_mode, "balanced"))}</strong>
          </li>
          <li>
            <span>{t(props.lang, "admin_live_ops_guidance_state_label")}</span>
            <strong>{asText(schedulerTargetingGuidance.guidance_state)}</strong>
          </li>
          <li>
            <span>{t(props.lang, "admin_live_ops_guidance_reason_label")}</span>
            <strong>{asText(schedulerTargetingGuidance.guidance_reason)}</strong>
          </li>
          <li>
            <span>{t(props.lang, "admin_live_ops_scheduler_already_sent_label")}</span>
            <strong>{schedulerSummary.already_dispatched_for_window === true ? t(props.lang, "admin_live_ops_bool_yes") : t(props.lang, "admin_live_ops_bool_no")}</strong>
          </li>
          <li>
            <span>{t(props.lang, "admin_live_ops_scheduler_latest_label")}</span>
            <strong>{asText(schedulerSummary.latest_auto_dispatch_at)}</strong>
          </li>
          <li>
            <span>{t(props.lang, "admin_live_ops_scheduler_reason_label")}</span>
            <strong>{asText(schedulerSummary.latest_auto_dispatch_reason)}</strong>
          </li>
        </ul>
        <p className="akrMutedLine">
          {t(props.lang, "admin_live_ops_recommend_focus_label")}: {asText(schedulerTargetingGuidance.focus_dimension, "-")} /{" "}
          {asText(schedulerTargetingGuidance.focus_bucket, "-")} | {t(props.lang, "admin_live_ops_escalation_share_label")}:{" "}
          {toPct(schedulerTargetingGuidance.focus_share_of_recommended_cap)}
        </p>
      </section>
      <section className="akrMiniPanel" data-akr-focus-key="scheduler_skip_summary">
        <h4>{t(props.lang, "admin_live_ops_skip_title")}</h4>
        <div className="akrChipRow">
          <span className="akrChip">
            {t(props.lang, "admin_live_ops_skip_24h")}: {asCount(schedulerSkipSummary.skipped_24h)}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_live_ops_skip_7d")}: {asCount(schedulerSkipSummary.skipped_7d)}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_live_ops_skip_reason_label")}: {asText(schedulerSkipSummary.latest_skip_reason)}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_live_ops_skip_at_label")}: {asText(schedulerSkipSummary.latest_skip_at)}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_live_ops_skip_alarm_label")}: {asText(schedulerSkipSummary.alarm_state)}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_live_ops_skip_alarm_reason_label")}: {asText(schedulerSkipSummary.alarm_reason)}
          </span>
        </div>
        <div className="akrSplit">
          <SkipDailyTrendList title={t(props.lang, "admin_live_ops_skip_daily_title")} rows={schedulerSkipDailyBreakdown} />
          <BreakdownList title={t(props.lang, "admin_live_ops_skip_reason_title")} rows={schedulerSkipReasonBreakdown} />
        </div>
      </section>
      <section className="akrMiniPanel" data-akr-focus-key="task_summary">
        <h4>{t(props.lang, "admin_live_ops_task_title")}</h4>
        <div className="akrChipRow">
          <span className="akrChip">
            {t(props.lang, "admin_live_ops_task_ok_label")}:{" "}
            {taskSummary.ok === true ? t(props.lang, "admin_live_ops_bool_yes") : t(props.lang, "admin_live_ops_bool_no")}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_live_ops_task_skipped_label")}:{" "}
            {taskSummary.skipped === true ? t(props.lang, "admin_live_ops_bool_yes") : t(props.lang, "admin_live_ops_bool_no")}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_live_ops_task_age_label")}: {taskSummary.artifact_found === true ? asText(taskSummary.artifact_age_min) : "-"}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_live_ops_task_generated_label")}: {asText(taskSummary.artifact_generated_at)}
          </span>
        </div>
        <ul className="akrList">
          <li>
            <span>{t(props.lang, "admin_live_ops_task_reason_label")}</span>
            <strong>{asText(taskSummary.reason)}</strong>
          </li>
          <li>
            <span>{t(props.lang, "admin_live_ops_task_dispatch_label")}</span>
            <strong>{asText(taskSummary.dispatch_ref)}</strong>
          </li>
          <li>
            <span>{t(props.lang, "admin_live_ops_task_source_label")}</span>
            <strong>{asText(taskSummary.dispatch_source)}</strong>
          </li>
          <li>
            <span>{t(props.lang, "admin_live_ops_scheduler_scene_state_label")}</span>
            <strong>{asText(taskSummary.scene_gate_state)}</strong>
          </li>
          <li>
            <span>{t(props.lang, "admin_live_ops_scheduler_scene_effect_label")}</span>
            <strong>{asText(taskSummary.scene_gate_effect)}</strong>
          </li>
          <li>
            <span>{t(props.lang, "admin_live_ops_scheduler_scene_cap_label")}</span>
            <strong>{asCount(taskSummary.scene_gate_recipient_cap)}</strong>
          </li>
          <li>
            <span>{t(props.lang, "admin_live_ops_task_scene_reason_label")}</span>
            <strong>{asText(taskSummary.scene_gate_reason)}</strong>
          </li>
          <li>
            <span>{t(props.lang, "admin_live_ops_task_recommend_cap_label")}</span>
            <strong>{asCount(taskSummary.recommended_recipient_cap)}</strong>
          </li>
          <li>
            <span>{t(props.lang, "admin_live_ops_task_recommend_delta_label")}</span>
            <strong>{asCount(taskSummary.effective_cap_delta)}</strong>
          </li>
          <li>
            <span>{t(props.lang, "admin_live_ops_recommend_pressure_label")}</span>
            <strong>{asText(taskSummary.recommendation_pressure_band)}</strong>
          </li>
          <li>
            <span>{t(props.lang, "admin_live_ops_task_recommend_reason_label")}</span>
            <strong>{asText(taskSummary.recommendation_reason)}</strong>
          </li>
        </ul>
        <div className="akrChipRow">
          <span className="akrChip">
            {t(props.lang, "admin_live_ops_selection_mode_label")}: {formatGuidanceModeLabel(props.lang, asText(taskSelectionSummary.guidance_mode, "balanced"))}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_live_ops_selection_state_label")}: {asText(taskSelectionSummary.guidance_state)}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_live_ops_selection_prioritized_label")}: {asCount(taskSelectionSummary.prioritized_candidates)}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_live_ops_selection_selected_label")}: {asCount(taskSelectionSummary.selected_candidates)}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_live_ops_selection_prefilter_label")}:{" "}
            {taskSelectionPrefilter.applied === true ? t(props.lang, "admin_live_ops_bool_yes") : t(props.lang, "admin_live_ops_bool_no")}
          </span>
        </div>
        <div className="akrStack">
          <p className="akrMutedLine">
            {t(props.lang, "admin_live_ops_selection_reason_label")}: {asText(taskSelectionSummary.guidance_reason)} |{" "}
            {t(props.lang, "admin_live_ops_selection_focus_label")}: {asText(taskSelectionSummary.focus_dimension)} /{" "}
            {asText(taskSelectionSummary.focus_bucket)} /{" "}
            {taskSelectionSummary.focus_matches_target === true ? t(props.lang, "admin_live_ops_bool_yes") : t(props.lang, "admin_live_ops_bool_no")}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_live_ops_selection_locale_label")}: {asCount(taskSelectionSummary.selected_top_locale_matches)} /{" "}
            {asCount(taskSelectionSummary.prioritized_top_locale_matches)} | {t(props.lang, "admin_live_ops_selection_variant_label")}:{" "}
            {asCount(taskSelectionSummary.selected_top_variant_matches)} / {asCount(taskSelectionSummary.prioritized_top_variant_matches)} |{" "}
            {t(props.lang, "admin_live_ops_selection_cohort_label")}: {asCount(taskSelectionSummary.selected_top_cohort_matches)} /{" "}
            {asCount(taskSelectionSummary.prioritized_top_cohort_matches)}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_live_ops_selection_focus_match_label")}: {asCount(taskSelectionSummary.selected_focus_matches)} /{" "}
            {asCount(taskSelectionSummary.prioritized_focus_matches)}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_live_ops_selection_query_label")}:{" "}
            {taskSelectionQueryStrategy.applied === true ? t(props.lang, "admin_live_ops_bool_yes") : t(props.lang, "admin_live_ops_bool_no")} |{" "}
            {t(props.lang, "admin_live_ops_selection_query_reason_label")}: {asText(taskSelectionQueryStrategy.reason, "-")} /{" "}
            {asText(taskSelectionQueryStrategy.locale_strategy_reason, "-")} / {asText(taskSelectionQueryStrategy.segment_strategy_reason, "-")}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_live_ops_selection_query_window_label")}: {asText(taskSelectionQueryStrategy.mode_key, "balanced")} /{" "}
            {asText(taskSelectionQueryStrategy.segment_key, "-")} / x{asCount(taskSelectionQueryStrategy.pool_limit_multiplier)} /{" "}
            {asText(taskSelectionQueryStrategy.exclude_locale_prefix, "-")}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_live_ops_selection_query_caps_label")}: active {asCount(taskSelectionQueryStrategy.active_within_days_cap)} | inactive{" "}
            {asCount(taskSelectionQueryStrategy.inactive_hours_floor)} | max-age {asCount(taskSelectionQueryStrategy.max_age_days_cap)} | offer{" "}
            {asCount(taskSelectionQueryStrategy.offer_age_days_cap)}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_live_ops_selection_prefilter_focus_label")}: {asText(taskSelectionPrefilter.dimension, "-")} /{" "}
            {asText(taskSelectionPrefilter.bucket, "-")} | {t(props.lang, "admin_live_ops_selection_prefilter_count_label")}:{" "}
            {asCount(taskSelectionPrefilter.candidates_after)} / {asCount(taskSelectionPrefilter.candidates_before)} |{" "}
            {t(props.lang, "admin_live_ops_selection_prefilter_reason_label")}: {asText(taskSelectionPrefilter.reason, "-")}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_live_ops_selection_trend_dispatch_label")}: {asCount(selectionTrendSummary.dispatches_24h)} /{" "}
            {asCount(selectionTrendSummary.dispatches_7d)} | {t(props.lang, "admin_live_ops_selection_trend_query_label")}: {asCount(selectionTrendSummary.query_strategy_applied_24h)} /{" "}
            {asCount(selectionTrendSummary.query_strategy_applied_7d)} | {t(props.lang, "admin_live_ops_selection_trend_prefilter_label")}:{" "}
            {asCount(selectionTrendSummary.prefilter_applied_24h)} / {asCount(selectionTrendSummary.prefilter_applied_7d)} |{" "}
            {t(props.lang, "admin_live_ops_selection_trend_delta_label")}: {asCount(selectionTrendSummary.prefilter_delta_24h)} /{" "}
            {asCount(selectionTrendSummary.prefilter_delta_7d)}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_live_ops_selection_trend_focus_label")}: {asCount(selectionTrendSummary.selected_focus_matches_24h)} /{" "}
            {asCount(selectionTrendSummary.prioritized_focus_matches_24h)} | {t(props.lang, "admin_live_ops_selection_trend_latest_label")}:{" "}
            {asText(selectionTrendSummary.latest_guidance_mode, "balanced")} / {asText(selectionTrendSummary.latest_focus_dimension, "-")} /{" "}
            {asText(selectionTrendSummary.latest_focus_bucket, "-")} / {asText(selectionTrendSummary.latest_query_strategy_reason, "-")} /{" "}
            {asText(selectionTrendSummary.latest_segment_strategy_reason, "-")} / {asText(selectionTrendSummary.latest_prefilter_reason, "-")}
          </p>
        </div>
        <SelectionDailyTrendList title={t(props.lang, "admin_live_ops_selection_trend_daily_title")} rows={selectionTrendDailyBreakdown} />
        <BreakdownList title={t(props.lang, "admin_live_ops_selection_trend_query_reason_title")} rows={selectionTrendQueryReasons} />
        <BreakdownList title={t(props.lang, "admin_live_ops_selection_trend_segment_reason_title")} rows={selectionTrendSegmentReasons} />
        <BreakdownList title={t(props.lang, "admin_live_ops_selection_trend_reason_title")} rows={selectionTrendPrefilterReasons} />
      </section>
      <section className="akrMiniPanel" data-akr-focus-key="ops_alert_summary">
        <h4>{t(props.lang, "admin_live_ops_ops_alert_title")}</h4>
        <div className="akrChipRow">
          <span className="akrChip">
            {t(props.lang, "admin_live_ops_ops_alert_state_label")}: {asText(opsAlertSummary.alarm_state)}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_live_ops_ops_alert_notify_label")}:{" "}
            {opsAlertSummary.should_notify === true ? t(props.lang, "admin_live_ops_bool_yes") : t(props.lang, "admin_live_ops_bool_no")}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_live_ops_ops_alert_sent_label")}:{" "}
            {opsAlertSummary.telegram_sent === true ? t(props.lang, "admin_live_ops_bool_yes") : t(props.lang, "admin_live_ops_bool_no")}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_live_ops_ops_alert_age_label")}:{" "}
            {opsAlertSummary.artifact_found === true ? asText(opsAlertSummary.artifact_age_min) : "-"}
          </span>
        </div>
        <ul className="akrList">
          <li>
            <span>{t(props.lang, "admin_live_ops_ops_alert_reason_label")}</span>
            <strong>{asText(opsAlertSummary.notification_reason)}</strong>
          </li>
          <li>
            <span>{t(props.lang, "admin_live_ops_ops_alert_focus_escalation_label")}</span>
            <strong>
              {asText(opsAlertSummary.pressure_focus_escalation_band)} / {asText(opsAlertSummary.pressure_focus_escalation_reason)} /{" "}
              {asText(opsAlertSummary.pressure_focus_escalation_dimension)} / {asText(opsAlertSummary.pressure_focus_escalation_bucket)}
            </strong>
          </li>
          <li>
            <span>{t(props.lang, "admin_live_ops_ops_alert_sent_at_label")}</span>
            <strong>{asText(opsAlertSummary.telegram_sent_at)}</strong>
          </li>
        </ul>
        <div className="akrChipRow">
          <span className="akrChip">
            {t(props.lang, "admin_live_ops_ops_alert_raised_24h_label")}: {asCount(opsAlertTrendSummary.raised_24h)}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_live_ops_ops_alert_raised_7d_label")}: {asCount(opsAlertTrendSummary.raised_7d)}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_live_ops_ops_alert_sent_24h_label")}: {asCount(opsAlertTrendSummary.telegram_sent_24h)}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_live_ops_ops_alert_sent_7d_label")}: {asCount(opsAlertTrendSummary.telegram_sent_7d)}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_live_ops_ops_alert_delta_24h_label")}: {asCount(opsAlertTrendSummary.effective_cap_delta_24h)}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_live_ops_ops_alert_delta_7d_label")}: {asCount(opsAlertTrendSummary.effective_cap_delta_7d)}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_live_ops_ops_alert_experiment_label")}: {asText(opsAlertTrendSummary.experiment_key)}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_live_ops_ops_alert_delta_latest_label")}: {asCount(opsAlertTrendSummary.latest_effective_cap_delta)}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_live_ops_ops_alert_delta_max_label")}: {asCount(opsAlertTrendSummary.max_effective_cap_delta_7d)}
          </span>
        </div>
        <p className="akrMutedLine">
          {t(props.lang, "admin_live_ops_ops_alert_latest_label")}: {asText(opsAlertTrendSummary.latest_alert_at)} |{" "}
          {t(props.lang, "admin_live_ops_ops_alert_state_label")}: {asText(opsAlertTrendSummary.latest_alarm_state)} |{" "}
          {t(props.lang, "admin_live_ops_ops_alert_reason_label")}: {asText(opsAlertTrendSummary.latest_notification_reason)}
        </p>
        <p className="akrMutedLine">
          {t(props.lang, "admin_live_ops_ops_alert_focus_escalation_label")}: {asText(opsAlertSummary.pressure_focus_escalation_band)} /{" "}
          {asText(opsAlertSummary.pressure_focus_escalation_reason)} | {t(props.lang, "admin_live_ops_ops_alert_focus_share_label")}:{" "}
          {toPct(opsAlertSummary.pressure_focus_escalation_share)} | {t(props.lang, "admin_live_ops_ops_alert_focus_delta_ratio_label")}:{" "}
          {toPct(opsAlertSummary.pressure_focus_effective_delta_ratio)}
        </p>
        <div className="akrSplit">
          <OpsAlertDailyTrendList title={t(props.lang, "admin_live_ops_ops_alert_daily_title")} rows={opsAlertTrendDailyBreakdown} />
          <BreakdownList title={t(props.lang, "admin_live_ops_ops_alert_reason_title")} rows={opsAlertTrendReasonBreakdown} />
        </div>
        <div className="akrSplit">
          <BreakdownList title={t(props.lang, "admin_live_ops_ops_alert_locale_title")} rows={opsAlertTrendLocaleBreakdown} />
          <BreakdownList title={t(props.lang, "admin_live_ops_ops_alert_segment_title")} rows={opsAlertTrendSegmentBreakdown} />
        </div>
        <div className="akrSplit">
          <BreakdownList title={t(props.lang, "admin_live_ops_ops_alert_surface_title")} rows={opsAlertTrendSurfaceBreakdown} />
          <BreakdownList title={t(props.lang, "admin_live_ops_ops_alert_variant_title")} rows={opsAlertTrendVariantBreakdown} />
        </div>
        <BreakdownList title={t(props.lang, "admin_live_ops_ops_alert_cohort_title")} rows={opsAlertTrendCohortBreakdown} />
      </section>
      <section className="akrMiniPanel" data-akr-focus-key="scene_runtime_summary">
        <h4>{t(props.lang, "admin_runtime_scene_title")}</h4>
        <div className="akrChipRow">
          <span className="akrChip">
            {t(props.lang, "admin_runtime_scene_health")}: {asText(sceneRuntimeSummary.health_band_24h)}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_scene_alarm")}: {asText(sceneRuntimeSummary.alarm_state_7d)}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_scene_trend")}: {asText(sceneRuntimeSummary.trend_direction_7d)} (
            {toPct(sceneRuntimeSummary.trend_delta_ready_rate_7d)})
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_scene_ready_rate")}: {toPct(sceneRuntimeSummary.ready_rate_24h)}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_scene_failure_rate")}: {toPct(sceneRuntimeSummary.failure_rate_24h)}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_scene_low_end")}: {asCount(sceneRuntimeSummary.low_end_24h)} (
            {toPct(sceneRuntimeSummary.low_end_share_24h)})
          </span>
        </div>
        <p className="akrMutedLine">
          {t(props.lang, "admin_runtime_scene_worst_day")}: {asText(sceneWorstDay?.day)} | ready {toPct(sceneWorstDay?.ready_rate)} | fail{" "}
          {toPct(sceneWorstDay?.failure_rate)} | {asText(sceneWorstDay?.health_band)}
        </p>
        <div className="akrSplit">
          <section className="akrMiniPanel">
            <h4>{t(props.lang, "admin_runtime_scene_daily_title")}</h4>
            {sceneDailyBreakdown.length ? (
              <ul className="akrList">
                {sceneDailyBreakdown.map((row, index) => (
                  <li key={`${asText(row.day, "day")}_${index}`}>
                    <span>{asText(row.day)}</span>
                    <strong>
                      {toPct(row.ready_rate)} / {toPct(row.failure_rate)}
                    </strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="akrMuted">{t(props.lang, "admin_live_ops_no_history")}</p>
            )}
          </section>
          <section className="akrMiniPanel">
            <h4>{t(props.lang, "admin_runtime_scene_band_title")}</h4>
            {sceneBandBreakdown.length ? (
              <ul className="akrList">
                {sceneBandBreakdown.map((row, index) => (
                  <li key={`${asText(row.bucket_key, "unknown")}_${index}`}>
                    <span>{formatBucketCode(asText(row.bucket_key, "unknown"))}</span>
                    <strong>{asCount(row.item_count)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="akrMuted">{t(props.lang, "admin_live_ops_no_history")}</p>
            )}
          </section>
        </div>
        <div className="akrSplit">
          <section className="akrMiniPanel">
            <h4>{t(props.lang, "admin_runtime_scene_quality_title")}</h4>
            {sceneQualityBreakdown.length ? (
              <ul className="akrList">
                {sceneQualityBreakdown.map((row, index) => (
                  <li key={`${asText(row.bucket_key, "unknown")}_${index}`}>
                    <span>{formatBucketCode(asText(row.bucket_key, "unknown"))}</span>
                    <strong>{asCount(row.item_count)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="akrMuted">{t(props.lang, "admin_live_ops_no_history")}</p>
            )}
          </section>
          <section className="akrMiniPanel">
            <h4>{t(props.lang, "admin_runtime_scene_perf_title")}</h4>
            {scenePerfBreakdown.length ? (
              <ul className="akrList">
                {scenePerfBreakdown.map((row, index) => (
                  <li key={`${asText(row.bucket_key, "unknown")}_${index}`}>
                    <span>{formatBucketCode(asText(row.bucket_key, "unknown"))}</span>
                    <strong>{asCount(row.item_count)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="akrMuted">{t(props.lang, "admin_live_ops_no_history")}</p>
            )}
          </section>
        </div>
        {sceneAlarmReasons.length ? (
          <div className="akrStack">
            <strong>{t(props.lang, "admin_runtime_scene_alarm_reasons")}</strong>
            <div className="akrChipRow">
              {sceneAlarmReasons.map((reason) => (
                <span className="akrChip" key={`scene_alarm_${reason}`}>
                  {formatWarningCode(reason)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </section>
      <section className="akrMiniPanel" data-akr-focus-key="operator_timeline">
        <h4>{t(props.lang, "admin_live_ops_timeline_title")}</h4>
        {operatorTimeline.length ? (
          <ul className="akrList">
            {operatorTimeline.map((row, index) => (
              <li key={`${asText(row.action, "timeline")}_${asText(row.created_at, index.toString())}_${index}`}>
                <span>
                  #{asCount(row.admin_id)} {formatTimelineActionLabel(props.lang, asText(row.action, ""))} | {asText(row.status)} |{" "}
                  {asText(row.approval_state)} | {asText(row.schedule_state)}
                </span>
                <strong>
                  v{asCount(row.campaign_version)} @ {asText(row.created_at)}
                </strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="akrMuted">{t(props.lang, "admin_live_ops_no_history")}</p>
        )}
      </section>
      <section className="akrMiniPanel" data-akr-focus-key="delivery_summary">
        <h4>{t(props.lang, "admin_live_ops_delivery_title")}</h4>
        <ul className="akrList">
          <li>
            <span>{t(props.lang, "admin_live_ops_delivery_24h")}</span>
            <strong>{asCount(deliverySummary.sent_24h)}</strong>
          </li>
          <li>
            <span>{t(props.lang, "admin_live_ops_delivery_7d")}</span>
            <strong>{asCount(deliverySummary.sent_7d)}</strong>
          </li>
          <li>
            <span>{t(props.lang, "admin_live_ops_delivery_unique")}</span>
            <strong>{asCount(deliverySummary.unique_users_7d)}</strong>
          </li>
        </ul>
        <section className="akrMiniPanel">
          <h4>{t(props.lang, "admin_live_ops_daily_breakdown_title")}</h4>
          {dailyBreakdown.length ? (
            <ul className="akrList">
              {dailyBreakdown.map((row, index) => (
                <li key={`${asText(row.day, "day")}_${index}`}>
                  <span>{asText(row.day)}</span>
                  <strong>
                    {asCount(row.sent_count)} / {asCount(row.unique_users)}
                  </strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="akrMuted">{t(props.lang, "admin_live_ops_no_history")}</p>
          )}
        </section>
        <div className="akrSplit">
          <section className="akrMiniPanel">
            <h4>{t(props.lang, "admin_live_ops_locale_breakdown_title")}</h4>
            {localeBreakdown.length ? (
              <ul className="akrList">
                {localeBreakdown.map((row, index) => (
                  <li key={`${asText(row.bucket_key, "unknown")}_${index}`}>
                    <span>{formatBucketCode(asText(row.bucket_key, "unknown"))}</span>
                    <strong>{asCount(row.item_count)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="akrMuted">{t(props.lang, "admin_live_ops_no_history")}</p>
            )}
          </section>
          <section className="akrMiniPanel">
            <h4>{t(props.lang, "admin_live_ops_segment_breakdown_title")}</h4>
            {segmentBreakdown.length ? (
              <ul className="akrList">
                {segmentBreakdown.map((row, index) => (
                  <li key={`${asText(row.bucket_key, "unknown")}_${index}`}>
                    <span>{formatBucketCode(asText(row.bucket_key, "unknown"))}</span>
                    <strong>{asCount(row.item_count)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="akrMuted">{t(props.lang, "admin_live_ops_no_history")}</p>
            )}
          </section>
        </div>
        <section className="akrMiniPanel">
          <h4>{t(props.lang, "admin_live_ops_surface_breakdown_title")}</h4>
          {surfaceBreakdown.length ? (
            <ul className="akrList">
              {surfaceBreakdown.map((row, index) => (
                <li key={`${asText(row.bucket_key, "unknown")}_${index}`}>
                  <span>{formatBucketCode(asText(row.bucket_key, "unknown"))}</span>
                  <strong>{asCount(row.item_count)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="akrMuted">{t(props.lang, "admin_live_ops_no_history")}</p>
          )}
        </section>
        <div className="akrSplit">
          <section className="akrMiniPanel">
            <h4>{t(props.lang, "admin_live_ops_variant_breakdown_title")}</h4>
            {variantBreakdown.length ? (
              <ul className="akrList">
                {variantBreakdown.map((row, index) => (
                  <li key={`${asText(row.bucket_key, "unknown")}_${index}`}>
                    <span>{formatBucketCode(asText(row.bucket_key, "unknown"))}</span>
                    <strong>{asCount(row.item_count)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="akrMuted">{t(props.lang, "admin_live_ops_no_history")}</p>
            )}
          </section>
          <section className="akrMiniPanel">
            <h4>{t(props.lang, "admin_live_ops_cohort_breakdown_title")}</h4>
            {cohortBreakdown.length ? (
              <ul className="akrList">
                {cohortBreakdown.map((row, index) => (
                  <li key={`${asText(row.bucket_key, "unknown")}_${index}`}>
                    <span>{formatBucketCode(asText(row.bucket_key, "unknown"))}</span>
                    <strong>{asCount(row.item_count)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="akrMuted">{t(props.lang, "admin_live_ops_no_history")}</p>
            )}
          </section>
        </div>
      </section>
      <section className="akrMiniPanel" data-akr-focus-key="version_history">
        <h4>{t(props.lang, "admin_live_ops_versions_title")}</h4>
        {versionHistory.length ? (
          <ul className="akrList">
            {versionHistory.map((row, index) => (
              <li key={`${asText(row.version, "0")}_${index}`}>
                <span>
                  v{asCount(row.version)} | {asText(row.status)} | {asText(row.segment_key)}
                </span>
                <strong>
                  {asText(row.updated_at)} | #{asCount(row.updated_by)}
                </strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="akrMuted">{t(props.lang, "admin_live_ops_no_history")}</p>
        )}
      </section>
      <h3>{t(props.lang, "admin_live_ops_latest_title")}</h3>
      <pre className="akrJsonBlock">{JSON.stringify(snapshot, null, 2)}</pre>
      <h3>{t(props.lang, "admin_live_ops_dispatch_dump_title")}</h3>
      <pre className="akrJsonBlock">{JSON.stringify(props.liveOpsCampaignDispatchData || {}, null, 2)}</pre>
    </section>
  );
}
