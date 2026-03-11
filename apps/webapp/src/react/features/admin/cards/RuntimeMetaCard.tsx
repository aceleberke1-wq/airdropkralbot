import { t, type Lang } from "../../../i18n";
import { SHELL_ACTION_KEY } from "../../../../core/navigation/shellActions.js";

type RuntimeMetaCardProps = {
  lang: Lang;
  metricsData: Record<string, unknown> | null;
  opsKpiData: Record<string, unknown> | null;
  opsKpiRunData: Record<string, unknown> | null;
  opsKpiRunError: string;
  opsKpiRunning: boolean;
  deployStatusData: Record<string, unknown> | null;
  assetsStatusData: Record<string, unknown> | null;
  assetsReloading: boolean;
  auditPhaseStatusData: Record<string, unknown> | null;
  auditIntegrityData: Record<string, unknown> | null;
  onRefreshRuntimeMeta: () => void;
  onRefreshOpsKpi: () => void;
  onRunOpsKpi: () => void;
  onReloadAssets: () => void;
  onSurfaceAction: (sectionKey: string, slotKey: string, fallbackActionKey: string, sourcePanelKey?: string) => void;
};

function readNum(source: Record<string, unknown> | null, key: string): number {
  if (!source) return 0;
  const value = Number(source[key] || 0);
  return Number.isFinite(value) ? value : 0;
}

function readText(source: Record<string, unknown> | null, key: string): string {
  if (!source) return "";
  return String(source[key] || "");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asRows(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && !Array.isArray(row))
    : [];
}

function toPct(value: number): string {
  return `${Math.round(Math.max(0, value) * 100)}%`;
}

function formatStamp(value: unknown): string {
  const raw = String(value || "").trim();
  return raw || "-";
}

function AlarmReasonList(props: { title: string; rows: string[] }) {
  if (!props.rows.length) {
    return (
      <div>
        <strong>{props.title}</strong>
        <p className="akrMutedLine">-</p>
      </div>
    );
  }
  return (
    <div>
      <strong>{props.title}</strong>
      <div className="akrChipRow">
        {props.rows.map((row) => (
          <span className="akrChip" key={`${props.title}_${row}`}>
            {row}
          </span>
        ))}
      </div>
    </div>
  );
}

function BreakdownList(props: { title: string; rows: Array<Record<string, unknown>> }) {
  if (!props.rows.length) {
    return (
      <div>
        <strong>{props.title}</strong>
        <p className="akrMutedLine">-</p>
      </div>
    );
  }
  return (
    <div>
      <strong>{props.title}</strong>
      <div className="akrChipRow">
        {props.rows.slice(0, 6).map((row, index) => (
          <span className="akrChip" key={`${props.title}_${String(row.bucket_key || index)}`}>
            {String(row.bucket_key || "unknown")}: {Math.floor(Number(row.item_count || 0))}
          </span>
        ))}
      </div>
    </div>
  );
}

function SceneDailyTrendList(props: { title: string; rows: Array<Record<string, unknown>> }) {
  if (!props.rows.length) {
    return (
      <div>
        <strong>{props.title}</strong>
        <p className="akrMutedLine">-</p>
      </div>
    );
  }
  return (
    <div>
      <strong>{props.title}</strong>
      <div className="akrStack">
        {props.rows.slice(0, 7).map((row, index) => (
          <p className="akrMutedLine" key={`${props.title}_${String(row.day || index)}`}>
            {String(row.day || "-")} | total {Math.floor(Number(row.total_count || 0))} | ready{" "}
            {Math.floor(Number(row.ready_count || 0))} | fail {Math.floor(Number(row.failed_count || 0))} | low-end{" "}
            {Math.floor(Number(row.low_end_count || 0))}
          </p>
        ))}
      </div>
    </div>
  );
}

function SceneLoopDailyTrendList(props: { title: string; rows: Array<Record<string, unknown>> }) {
  if (!props.rows.length) {
    return (
      <div>
        <strong>{props.title}</strong>
        <p className="akrMutedLine">-</p>
      </div>
    );
  }
  return (
    <div>
      <strong>{props.title}</strong>
      <div className="akrStack">
        {props.rows.slice(0, 7).map((row, index) => (
          <p className="akrMutedLine" key={`${props.title}_${String(row.day || index)}`}>
            {String(row.day || "-")} | loops {Math.floor(Number(row.total_count || 0))} | districts{" "}
            {Math.floor(Number(row.district_count || 0))} | live {Math.floor(Number(row.live_count || 0))} | blocked{" "}
            {Math.floor(Number(row.blocked_count || 0))} | {String(row.health_band || "no_data")}
          </p>
        ))}
      </div>
    </div>
  );
}

function SceneLoopDistrictMatrixList(props: { title: string; rows: Array<Record<string, unknown>> }) {
  if (!props.rows.length) {
    return (
      <div>
        <strong>{props.title}</strong>
        <p className="akrMutedLine">-</p>
      </div>
    );
  }
  return (
    <div>
      <strong>{props.title}</strong>
      <div className="akrStack">
        {props.rows.slice(0, 8).map((row, index) => (
          <p className="akrMutedLine" key={`${props.title}_${String(row.district_key || index)}`}>
            {String(row.district_key || "-")} | latest {String(row.latest_health_band || row.health_band || "no_data")} | trend{" "}
            {String(row.trend_direction || "no_data")} ({Math.floor(Number(row.trend_delta || 0))}) | loops{" "}
            {Math.floor(Number(row.total_count || 0))} | live {Math.floor(Number(row.live_count || 0))} | blocked{" "}
            {Math.floor(Number(row.blocked_count || 0))} | attn {String(row.attention_band || "no_data")} | G/Y/R {Math.floor(Number(row.green_days || 0))}/
            {Math.floor(Number(row.yellow_days || 0))}/{Math.floor(Number(row.red_days || 0))}
          </p>
        ))}
      </div>
    </div>
  );
}

function SceneLoopDistrictFamilyMatrixList(props: { title: string; rows: Array<Record<string, unknown>> }) {
  if (!props.rows.length) {
    return (
      <div>
        <strong>{props.title}</strong>
        <p className="akrMutedLine">-</p>
      </div>
    );
  }
  return (
    <div>
      <strong>{props.title}</strong>
      <div className="akrStack">
        {props.rows.slice(0, 12).map((row, index) => (
          <p
            className="akrMutedLine"
            key={`${props.title}_${String(row.district_key || index)}_${String(row.loop_family_key || "family")}`}
          >
            {String(row.district_key || "-")} / {String(row.loop_family_key || "-")} | latest{" "}
            {String(row.latest_health_band || row.health_band || "no_data")} | trend {String(row.trend_direction || "no_data")} (
            {Math.floor(Number(row.trend_delta || 0))}) | loops {Math.floor(Number(row.total_count || 0))} | live{" "}
            {Math.floor(Number(row.live_count || 0))} | blocked {Math.floor(Number(row.blocked_count || 0))} | attn{" "}
            {String(row.attention_band || "no_data")} | G/Y/R {Math.floor(Number(row.green_days || 0))}/
            {Math.floor(Number(row.yellow_days || 0))}/{Math.floor(Number(row.red_days || 0))}
          </p>
        ))}
      </div>
    </div>
  );
}

function SkipDailyTrendList(props: { title: string; rows: Array<Record<string, unknown>> }) {
  if (!props.rows.length) {
    return (
      <div>
        <strong>{props.title}</strong>
        <p className="akrMutedLine">-</p>
      </div>
    );
  }
  return (
    <div>
      <strong>{props.title}</strong>
      <div className="akrStack">
        {props.rows.slice(0, 7).map((row, index) => (
          <p className="akrMutedLine" key={`${props.title}_${String(row.day || index)}`}>
            {String(row.day || "-")} | skip {Math.floor(Number(row.skip_count || 0))}
          </p>
        ))}
      </div>
    </div>
  );
}

function SelectionDailyTrendList(props: { title: string; rows: Array<Record<string, unknown>> }) {
  if (!props.rows.length) {
    return (
      <div>
        <strong>{props.title}</strong>
        <p className="akrMutedLine">-</p>
      </div>
    );
  }
  return (
    <div>
      <strong>{props.title}</strong>
      <div className="akrStack">
        {props.rows.slice(0, 7).map((row, index) => (
          <p className="akrMutedLine" key={`${props.title}_${String(row.day || index)}`}>
            {String(row.day || "-")} | dispatch {Math.floor(Number(row.dispatch_count || 0))} | query {Math.floor(Number(row.query_strategy_applied_count || 0))} | prefilter{" "}
            {Math.floor(Number(row.prefilter_applied_count || 0))} | delta {Math.floor(Number(row.prefilter_delta_sum || 0))} | focus{" "}
            {Math.floor(Number(row.selected_focus_matches || 0))}/{Math.floor(Number(row.prioritized_focus_matches || 0))}
          </p>
        ))}
      </div>
    </div>
  );
}

function SelectionAdjustmentDailyTrendList(props: { title: string; rows: Array<Record<string, unknown>> }) {
  if (!props.rows.length) {
    return (
      <div>
        <strong>{props.title}</strong>
        <p className="akrMutedLine">-</p>
      </div>
    );
  }
  return (
    <div>
      <strong>{props.title}</strong>
      <div className="akrStack">
        {props.rows.slice(0, 7).map((row, index) => (
          <p className="akrMutedLine" key={`${props.title}_${String(row.day || index)}`}>
            {String(row.day || "-")} | count {Math.floor(Number(row.adjustment_count || 0))} | delta{" "}
            {Math.floor(Number(row.total_delta_sum || 0))} | max {Math.floor(Number(row.max_delta_value || 0))}
          </p>
        ))}
      </div>
    </div>
  );
}

function SelectionFamilyDailyTrendList(props: { title: string; rows: Array<Record<string, unknown>> }) {
  if (!props.rows.length) {
    return (
      <div>
        <strong>{props.title}</strong>
        <p className="akrMutedLine">-</p>
      </div>
    );
  }
  return (
    <div>
      <strong>{props.title}</strong>
      <div className="akrStack">
        {props.rows.slice(0, 7).map((row, index) => (
          <p className="akrMutedLine" key={`${props.title}_${String(row.day || index)}_${String(row.bucket_key || "")}`}>
            {String(row.day || "-")} | {String(row.bucket_key || "-")} | {Math.floor(Number(row.item_count || 0))}
          </p>
        ))}
      </div>
    </div>
  );
}

function SelectionFamilyRiskDailyTrendList(props: { title: string; rows: Array<Record<string, unknown>> }) {
  if (!props.rows.length) {
    return (
      <div>
        <strong>{props.title}</strong>
        <p className="akrMutedLine">-</p>
      </div>
    );
  }
  return (
    <div>
      <strong>{props.title}</strong>
      <div className="akrStack">
        {props.rows.slice(0, 7).map((row, index) => (
          <p className="akrMutedLine" key={`${props.title}_${String(row.day || index)}_${String(row.risk_bucket || "")}`}>
            {String(row.day || "-")} | {String(row.risk_state || "-")} | {String(row.risk_dimension || "-")} / {String(row.risk_bucket || "-")} |{" "}
            {Math.floor(Number(row.risk_score || 0))} | {String(row.query_family || "-")} / {String(row.segment_family || "-")} /{" "}
            {String(row.field_family || "-")} | D {Math.floor(Number(row.query_match_days || 0))} / {Math.floor(Number(row.segment_match_days || 0))} /{" "}
            {Math.floor(Number(row.field_match_days || 0))} | W {Math.floor(Number(row.query_weight || 0))} / {Math.floor(Number(row.segment_weight || 0))} /{" "}
            {Math.floor(Number(row.field_weight || 0))} | P {String(row.query_segment_path || "-")} / {String(row.adjustment_segment_path || "-")}
          </p>
        ))}
      </div>
    </div>
  );
}

function QueryStrategyAdjustmentList(props: { title: string; rows: Array<Record<string, unknown>> }) {
  if (!props.rows.length) {
    return (
      <div>
        <strong>{props.title}</strong>
        <p className="akrMutedLine">-</p>
      </div>
    );
  }
  return (
    <div>
      <strong>{props.title}</strong>
      <div className="akrStack">
        {props.rows.slice(0, 7).map((row, index) => (
          <p className="akrMutedLine" key={`${props.title}_${String(row.field_key || index)}`}>
            {String(row.field_key || "-")} | {Math.floor(Number(row.before_value || 0))} {"->"} {Math.floor(Number(row.after_value || 0))} |{" "}
            {String(row.direction_key || "-")} | {String(row.reason_code || "-")}
          </p>
        ))}
      </div>
    </div>
  );
}

export function RuntimeMetaCard(props: RuntimeMetaCardProps) {
  const qualityScore = readNum(props.metricsData, "ui_event_quality_score_24h");
  const intent = readNum(props.metricsData, "funnel_intent_24h");
  const submit = readNum(props.metricsData, "funnel_tx_submit_24h");
  const approved = readNum(props.metricsData, "funnel_approved_24h");
  const intentToSubmit = readNum(props.metricsData, "funnel_intent_to_submit_rate_24h");
  const submitToApproved = readNum(props.metricsData, "funnel_submit_to_approved_rate_24h");
  const qualityBand = String(props.metricsData?.ui_event_quality_band_24h || "unknown");
  const funnelBand = String(props.metricsData?.funnel_conversion_band_24h || "unknown");
  const sceneRuntimeReady = readNum(props.metricsData, "scene_runtime_ready_24h");
  const sceneRuntimeFailed = readNum(props.metricsData, "scene_runtime_failed_24h");
  const sceneRuntimeTotal = readNum(props.metricsData, "scene_runtime_total_24h");
  const sceneRuntimeLowEnd = readNum(props.metricsData, "scene_runtime_low_end_24h");
  const sceneRuntimeReadyRate = readNum(props.metricsData, "scene_runtime_ready_rate_24h");
  const sceneRuntimeFailureRate = readNum(props.metricsData, "scene_runtime_failure_rate_24h");
  const sceneRuntimeLowEndShare = readNum(props.metricsData, "scene_runtime_low_end_share_24h");
  const sceneRuntimeAvgBundles = readNum(props.metricsData, "scene_runtime_avg_loaded_bundles_24h");
  const sceneRuntimeHealthBand = String(props.metricsData?.scene_runtime_health_band_24h || "no_data");
  const sceneRuntimeReadyRate7dAvg = readNum(props.metricsData, "scene_runtime_ready_rate_7d_avg");
  const sceneRuntimeFailureRate7dAvg = readNum(props.metricsData, "scene_runtime_failure_rate_7d_avg");
  const sceneRuntimeLowEndShare7dAvg = readNum(props.metricsData, "scene_runtime_low_end_share_7d_avg");
  const sceneRuntimeTrendDirection = readText(props.metricsData, "scene_runtime_trend_direction_7d") || "no_data";
  const sceneRuntimeTrendDelta = readNum(props.metricsData, "scene_runtime_trend_delta_ready_rate_7d");
  const sceneRuntimeAlarmState = readText(props.metricsData, "scene_runtime_alarm_state_7d") || "no_data";
  const sceneRuntimeAlarmReasons = Array.isArray(props.metricsData?.scene_runtime_alarm_reasons_7d)
    ? (props.metricsData?.scene_runtime_alarm_reasons_7d as unknown[]).map((row) => String(row || "")).filter(Boolean)
    : [];
  const sceneRuntimeBandBreakdown = asRows(props.metricsData?.scene_runtime_band_breakdown_7d);
  const sceneRuntimeWorstDay = asRecord(props.metricsData?.scene_runtime_worst_day_7d);
  const sceneRuntimeDailyBreakdown = asRows(props.metricsData?.scene_runtime_daily_breakdown_7d);
  const sceneRuntimeQualityBreakdown = asRows(props.metricsData?.scene_runtime_quality_breakdown_24h);
  const sceneRuntimePerfBreakdown = asRows(props.metricsData?.scene_runtime_perf_breakdown_24h);
  const sceneRuntimeDeviceBreakdown = asRows(props.metricsData?.scene_runtime_device_breakdown_24h);
  const sceneRuntimeProfileBreakdown = asRows(props.metricsData?.scene_runtime_profile_breakdown_24h);
  const sceneLoopEvents24h = readNum(props.metricsData, "scene_loop_events_24h");
  const sceneLoopLive24h = readNum(props.metricsData, "scene_loop_live_24h");
  const sceneLoopBlocked24h = readNum(props.metricsData, "scene_loop_blocked_24h");
  const sceneLoopDistrictCoverage24h = readNum(props.metricsData, "scene_loop_district_coverage_24h");
  const sceneLoopLiveShare24h = readNum(props.metricsData, "scene_loop_live_share_24h");
  const sceneLoopBlockedShare24h = readNum(props.metricsData, "scene_loop_blocked_share_24h");
  const sceneLoopHealthBand24h = readText(props.metricsData, "scene_loop_health_band_24h") || "no_data";
  const sceneLoopEvents7d = readNum(props.metricsData, "scene_loop_events_7d");
  const sceneLoopTrendDirection7d = readText(props.metricsData, "scene_loop_trend_direction_7d") || "no_data";
  const sceneLoopTrendDelta7d = readNum(props.metricsData, "scene_loop_trend_delta_7d");
  const sceneLoopAlarmState7d = readText(props.metricsData, "scene_loop_alarm_state_7d") || "no_data";
  const sceneLoopAlarmReasons7d = Array.isArray(props.metricsData?.scene_loop_alarm_reasons_7d)
    ? (props.metricsData?.scene_loop_alarm_reasons_7d as unknown[]).map((row) => String(row || "")).filter(Boolean)
    : [];
  const sceneLoopBandBreakdown7d = asRows(props.metricsData?.scene_loop_band_breakdown_7d);
  const sceneLoopPeakDay7d = asRecord(props.metricsData?.scene_loop_peak_day_7d);
  const sceneLoopDailyBreakdown = asRows(props.metricsData?.scene_loop_daily_breakdown_7d);
  const sceneLoopDistrictMatrix = asRows(props.metricsData?.scene_loop_district_matrix_7d);
  const sceneLoopDistrictLatestBandBreakdown = asRows(props.metricsData?.scene_loop_district_latest_band_breakdown_7d);
  const sceneLoopDistrictTrendBreakdown = asRows(props.metricsData?.scene_loop_district_trend_breakdown_7d);
  const sceneLoopDistrictHealthTrendBreakdown = asRows(props.metricsData?.scene_loop_district_health_trend_breakdown_7d);
  const sceneLoopDistrictAttentionBreakdown = asRows(props.metricsData?.scene_loop_district_attention_breakdown_7d);
  const sceneLoopDistrictBreakdown = asRows(props.metricsData?.scene_loop_district_breakdown_24h);
  const sceneLoopFamilyBreakdown = asRows(props.metricsData?.scene_loop_family_breakdown_24h);
  const sceneLoopStatusBreakdown = asRows(props.metricsData?.scene_loop_status_breakdown_24h);
  const sceneLoopSequenceBreakdown = asRows(props.metricsData?.scene_loop_sequence_breakdown_24h);
  const sceneLoopEntryBreakdown = asRows(props.metricsData?.scene_loop_entry_breakdown_24h);
  const sceneLoopDistrictFamilyMatrix = asRows(props.metricsData?.scene_loop_district_family_matrix_7d);
  const sceneLoopDistrictFamilyLatestBandBreakdown = asRows(props.metricsData?.scene_loop_district_family_latest_band_breakdown_7d);
  const sceneLoopDistrictFamilyTrendBreakdown = asRows(props.metricsData?.scene_loop_district_family_trend_breakdown_7d);
  const sceneLoopDistrictFamilyHealthTrendBreakdown = asRows(
    props.metricsData?.scene_loop_district_family_health_trend_breakdown_7d
  );
  const sceneLoopDistrictFamilyAttentionBreakdown = asRows(props.metricsData?.scene_loop_district_family_attention_breakdown_7d);
  const sceneLoopDistrictFamilyHealthAttentionBreakdown = asRows(
    props.metricsData?.scene_loop_district_family_health_attention_breakdown_7d
  );
  const sceneLoopDistrictFamilyAttentionTrendBreakdown = asRows(
    props.metricsData?.scene_loop_district_family_attention_trend_breakdown_7d
  );
  const sceneLoopDistrictFamilyHealthAttentionTrendBreakdown = asRows(
    props.metricsData?.scene_loop_district_family_health_attention_trend_breakdown_7d
  );
  const sceneLoopDistrictFamilyHealthAttentionTrendMatrix = asRows(
    props.metricsData?.scene_loop_district_family_health_attention_trend_matrix_7d
  );
  const liveOpsKpi = asRecord((props.opsKpiRunData as Record<string, unknown> | null)?.live_ops_campaign) ||
    asRecord((props.opsKpiData as Record<string, unknown> | null)?.live_ops_campaign);
  const liveOpsSceneRuntime = asRecord(liveOpsKpi?.scene_runtime);
  const localeBreakdown = asRows(liveOpsKpi?.locale_breakdown);
  const segmentBreakdown = asRows(liveOpsKpi?.segment_breakdown);
  const surfaceBreakdown = asRows(liveOpsKpi?.surface_breakdown);
  const variantBreakdown = asRows(liveOpsKpi?.variant_breakdown);
  const cohortBreakdown = asRows(liveOpsKpi?.cohort_breakdown);
  const dailyBreakdown = asRows(liveOpsKpi?.daily_breakdown);
  const schedulerSkip = asRecord(liveOpsKpi?.scheduler_skip);
  const opsAlert = asRecord(liveOpsKpi?.ops_alert);
  const opsAlertTrend = asRecord(liveOpsKpi?.ops_alert_trend);
  const recipientCapRecommendation = asRecord(liveOpsKpi?.recipient_cap_recommendation);
  const targetingGuidance = asRecord(liveOpsKpi?.targeting_guidance);
  const selectionSummary = asRecord(liveOpsKpi?.selection_summary);
  const selectionQueryStrategy = asRecord(selectionSummary?.query_strategy_summary);
  const selectionQueryAdjustments = asRows(selectionQueryStrategy?.adjustment_rows);
  const selectionTrend = asRecord(liveOpsKpi?.selection_trend);
  const selectionPrefilter = asRecord(selectionSummary?.prefilter_summary);
  const schedulerSkipDaily = asRows(schedulerSkip?.daily_breakdown);
  const schedulerSkipReasons = asRows(schedulerSkip?.reason_breakdown);
  const opsAlertLocaleBreakdown = asRows(opsAlertTrend?.locale_breakdown);
  const opsAlertSegmentBreakdown = asRows(opsAlertTrend?.segment_breakdown);
  const opsAlertSurfaceBreakdown = asRows(opsAlertTrend?.surface_breakdown);
  const opsAlertVariantBreakdown = asRows(opsAlertTrend?.variant_breakdown);
  const opsAlertCohortBreakdown = asRows(opsAlertTrend?.cohort_breakdown);
  const selectionTrendDaily = asRows(selectionTrend?.daily_breakdown);
  const selectionTrendAdjustmentDaily = asRows(selectionTrend?.query_adjustment_daily_breakdown);
  const selectionTrendQueryReasons = asRows(selectionTrend?.query_strategy_reason_breakdown);
  const selectionTrendAdjustmentFields = asRows(selectionTrend?.query_adjustment_field_breakdown);
  const selectionTrendAdjustmentFieldFamilies = asRows(selectionTrend?.query_adjustment_field_family_breakdown);
  const selectionTrendAdjustmentReasons = asRows(selectionTrend?.query_adjustment_reason_breakdown);
  const selectionTrendQueryFamilies = asRows(selectionTrend?.query_strategy_family_breakdown);
  const selectionTrendQueryPaths = asRows(selectionTrend?.query_strategy_segment_path_breakdown);
  const selectionTrendAdjustmentQueryFamilies = asRows(selectionTrend?.query_adjustment_query_family_breakdown);
  const selectionTrendQueryFamilyDaily = asRows(selectionTrend?.query_strategy_family_daily_breakdown);
  const selectionTrendQueryPathDaily = asRows(selectionTrend?.query_strategy_segment_path_daily_breakdown);
  const selectionTrendAdjustmentQueryFamilyDaily = asRows(selectionTrend?.query_adjustment_query_family_daily_breakdown);
  const selectionTrendSegmentReasons = asRows(selectionTrend?.segment_strategy_reason_breakdown);
  const selectionTrendAdjustmentSegmentFamilies = asRows(selectionTrend?.query_adjustment_segment_family_breakdown);
  const selectionTrendAdjustmentPaths = asRows(selectionTrend?.query_adjustment_segment_path_breakdown);
  const selectionTrendSegmentFamilies = asRows(selectionTrend?.segment_strategy_family_breakdown);
  const selectionTrendSegmentFamilyDaily = asRows(selectionTrend?.segment_strategy_family_daily_breakdown);
  const selectionTrendAdjustmentSegmentFamilyDaily = asRows(selectionTrend?.query_adjustment_segment_family_daily_breakdown);
  const selectionTrendAdjustmentFieldFamilyDaily = asRows(selectionTrend?.query_adjustment_field_family_daily_breakdown);
  const selectionTrendAdjustmentPathDaily = asRows(selectionTrend?.query_adjustment_segment_path_daily_breakdown);
  const selectionTrendFamilyRiskDaily = asRows(selectionTrend?.family_risk_daily_breakdown);
  const selectionTrendFamilyRiskFieldBandDaily = asRows(selectionTrend?.family_risk_field_family_band_daily_breakdown);
  const selectionTrendFamilyRiskQueryPathBandDaily = asRows(selectionTrend?.family_risk_query_segment_path_band_daily_breakdown);
  const selectionTrendFamilyRiskAdjustmentPathBandDaily = asRows(
    selectionTrend?.family_risk_adjustment_segment_path_band_daily_breakdown
  );
  const selectionTrendFamilyRiskBands = asRows(selectionTrend?.family_risk_band_breakdown);
  const selectionTrendFamilyRiskDimensions = asRows(selectionTrend?.family_risk_dimension_breakdown);
  const selectionTrendFamilyRiskFieldFamilies = asRows(selectionTrend?.family_risk_field_family_breakdown);
  const selectionTrendFamilyRiskQueryPaths = asRows(selectionTrend?.family_risk_query_segment_path_breakdown);
  const selectionTrendFamilyRiskAdjustmentPaths = asRows(selectionTrend?.family_risk_adjustment_segment_path_breakdown);
  const selectionTrendFamilyRiskFieldBands = asRows(selectionTrend?.family_risk_field_family_band_breakdown);
  const selectionTrendFamilyRiskQueryPathBands = asRows(selectionTrend?.family_risk_query_segment_path_band_breakdown);
  const selectionTrendFamilyRiskAdjustmentPathBands = asRows(selectionTrend?.family_risk_adjustment_segment_path_band_breakdown);
  const selectionTrendReasons = asRows(selectionTrend?.prefilter_reason_breakdown);

  return (
    <section className="akrCard akrCardWide" data-akr-panel-key="panel_admin_runtime" data-akr-focus-key="runtime_meta">
      <h3>{t(props.lang, "admin_runtime_meta_title")}</h3>
      <div className="akrActionRow">
        <button className="akrBtn akrBtnGhost" onClick={props.onRefreshRuntimeMeta}>
          {t(props.lang, "admin_runtime_meta_refresh")}
        </button>
        <button
          className="akrBtn akrBtnGhost"
          onClick={() => props.onSurfaceAction("admin_runtime_meta", "queue", SHELL_ACTION_KEY.ADMIN_QUEUE_PANEL, "panel_admin_runtime")}
        >
          {t(props.lang, "admin_nav_queue")}
        </button>
        <button
          className="akrBtn akrBtnGhost"
          onClick={() => props.onSurfaceAction("admin_runtime_meta", "policy", SHELL_ACTION_KEY.ADMIN_POLICY_PANEL, "panel_admin_runtime")}
        >
          {t(props.lang, "admin_nav_policy")}
        </button>
        <button
          className="akrBtn akrBtnGhost"
          onClick={() => props.onSurfaceAction("admin_runtime_meta", "bot", SHELL_ACTION_KEY.ADMIN_RUNTIME_BOT, "panel_admin_runtime")}
        >
          {t(props.lang, "admin_nav_bot")}
        </button>
        <button
          className="akrBtn akrBtnGhost"
          onClick={() => props.onSurfaceAction("admin_runtime_meta", "live_ops", SHELL_ACTION_KEY.ADMIN_LIVE_OPS_PANEL, "panel_admin_runtime")}
        >
          {t(props.lang, "admin_nav_live_ops")}
        </button>
        <button className="akrBtn akrBtnAccent" onClick={props.onReloadAssets} disabled={props.assetsReloading}>
          {props.assetsReloading ? t(props.lang, "admin_runtime_assets_reloading") : t(props.lang, "admin_runtime_assets_reload")}
        </button>
      </div>
      <h3>{t(props.lang, "admin_runtime_kpi_title")}</h3>
      <div className="akrActionRow">
        <button className="akrBtn akrBtnGhost" onClick={props.onRefreshOpsKpi}>
          {t(props.lang, "admin_runtime_kpi_refresh")}
        </button>
        <button className="akrBtn akrBtnAccent" onClick={props.onRunOpsKpi} disabled={props.opsKpiRunning}>
          {props.opsKpiRunning ? t(props.lang, "admin_runtime_kpi_running") : t(props.lang, "admin_runtime_kpi_run")}
        </button>
      </div>
      <div className="akrChipRow">
        <span className="akrChip">Quality: {toPct(qualityScore)}</span>
        <span className="akrChip">Q-Band: {qualityBand}</span>
        <span className="akrChip">Intent: {Math.floor(intent)}</span>
        <span className="akrChip">Submit: {Math.floor(submit)}</span>
        <span className="akrChip">Approved: {Math.floor(approved)}</span>
        <span className="akrChip">I-&gt;S: {toPct(intentToSubmit)}</span>
        <span className="akrChip">S-&gt;A: {toPct(submitToApproved)}</span>
        <span className="akrChip">Funnel Band: {funnelBand}</span>
      </div>
      <section className="akrMiniPanel" data-akr-focus-key="scene_runtime_kpi">
        <h3>{t(props.lang, "admin_runtime_scene_title")}</h3>
        <div className="akrChipRow">
          <span className="akrChip">
            {t(props.lang, "admin_runtime_scene_ready")}: {Math.floor(sceneRuntimeReady)}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_scene_failed")}: {Math.floor(sceneRuntimeFailed)}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_scene_total")}: {Math.floor(sceneRuntimeTotal)}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_scene_ready_rate")}: {toPct(sceneRuntimeReadyRate)}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_scene_failure_rate")}: {toPct(sceneRuntimeFailureRate)}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_scene_low_end")}: {Math.floor(sceneRuntimeLowEnd)} ({toPct(sceneRuntimeLowEndShare)})
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_scene_loaded_bundles")}: {sceneRuntimeAvgBundles.toFixed(2)}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_scene_health")}: {sceneRuntimeHealthBand}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_scene_trend")}: {sceneRuntimeTrendDirection} ({toPct(sceneRuntimeTrendDelta)})
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_scene_alarm")}: {sceneRuntimeAlarmState}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_scene_ready_avg")}: {toPct(sceneRuntimeReadyRate7dAvg)}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_scene_failure_avg")}: {toPct(sceneRuntimeFailureRate7dAvg)}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_scene_low_end_avg")}: {toPct(sceneRuntimeLowEndShare7dAvg)}
          </span>
        </div>
        <div className="akrStack">
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_scene_worst_day")}: {formatStamp(sceneRuntimeWorstDay?.day)} | ready{" "}
            {toPct(Number(sceneRuntimeWorstDay?.ready_rate || 0))} | fail {toPct(Number(sceneRuntimeWorstDay?.failure_rate || 0))} |{" "}
            {String(sceneRuntimeWorstDay?.health_band || "no_data")}
          </p>
        </div>
        <SceneDailyTrendList title={t(props.lang, "admin_runtime_scene_daily_title")} rows={sceneRuntimeDailyBreakdown} />
        <BreakdownList title={t(props.lang, "admin_runtime_scene_band_title")} rows={sceneRuntimeBandBreakdown} />
        <BreakdownList title={t(props.lang, "admin_runtime_scene_quality_title")} rows={sceneRuntimeQualityBreakdown} />
        <BreakdownList title={t(props.lang, "admin_runtime_scene_perf_title")} rows={sceneRuntimePerfBreakdown} />
        <BreakdownList title={t(props.lang, "admin_runtime_scene_device_title")} rows={sceneRuntimeDeviceBreakdown} />
        <BreakdownList title={t(props.lang, "admin_runtime_scene_profile_title")} rows={sceneRuntimeProfileBreakdown} />
        <AlarmReasonList title={t(props.lang, "admin_runtime_scene_alarm_reasons")} rows={sceneRuntimeAlarmReasons} />
      </section>
      <section className="akrMiniPanel" data-akr-focus-key="scene_loop_kpi">
        <h3>{t(props.lang, "admin_runtime_scene_loop_title")}</h3>
        <div className="akrChipRow">
          <span className="akrChip">
            {t(props.lang, "admin_runtime_scene_loop_events_24h")}: {Math.floor(sceneLoopEvents24h)}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_scene_loop_events_7d")}: {Math.floor(sceneLoopEvents7d)}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_scene_loop_live_24h")}: {Math.floor(sceneLoopLive24h)} ({toPct(sceneLoopLiveShare24h)})
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_scene_loop_blocked_24h")}: {Math.floor(sceneLoopBlocked24h)} ({toPct(sceneLoopBlockedShare24h)})
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_scene_loop_coverage_24h")}: {Math.floor(sceneLoopDistrictCoverage24h)}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_scene_loop_health_24h")}: {sceneLoopHealthBand24h}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_scene_loop_trend_7d")}: {sceneLoopTrendDirection7d} ({Math.floor(sceneLoopTrendDelta7d)})
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_scene_loop_alarm_7d")}: {sceneLoopAlarmState7d}
          </span>
        </div>
        <div className="akrStack">
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_scene_loop_peak_day_7d")}: {formatStamp(sceneLoopPeakDay7d?.day)} | loops{" "}
            {Math.floor(Number(sceneLoopPeakDay7d?.total_count || 0))} | districts {Math.floor(Number(sceneLoopPeakDay7d?.district_count || 0))} |{" "}
            {String(sceneLoopPeakDay7d?.health_band || "no_data")}
          </p>
        </div>
        <SceneLoopDailyTrendList title={t(props.lang, "admin_runtime_scene_loop_daily_title")} rows={sceneLoopDailyBreakdown} />
        <SceneLoopDistrictMatrixList
          title={t(props.lang, "admin_runtime_scene_loop_district_matrix_title")}
          rows={sceneLoopDistrictMatrix}
        />
        <BreakdownList
          title={t(props.lang, "admin_runtime_scene_loop_district_latest_band_title")}
          rows={sceneLoopDistrictLatestBandBreakdown}
        />
        <BreakdownList
          title={t(props.lang, "admin_runtime_scene_loop_district_trend_title")}
          rows={sceneLoopDistrictTrendBreakdown}
        />
        <BreakdownList
          title={t(props.lang, "admin_runtime_scene_loop_district_health_trend_title")}
          rows={sceneLoopDistrictHealthTrendBreakdown}
        />
        <BreakdownList
          title={t(props.lang, "admin_runtime_scene_loop_attention_title")}
          rows={sceneLoopDistrictAttentionBreakdown}
        />
        <BreakdownList title={t(props.lang, "admin_runtime_scene_loop_band_title")} rows={sceneLoopBandBreakdown7d} />
        <BreakdownList title={t(props.lang, "admin_runtime_scene_loop_district_title")} rows={sceneLoopDistrictBreakdown} />
        <BreakdownList title={t(props.lang, "admin_runtime_scene_loop_family_title")} rows={sceneLoopFamilyBreakdown} />
        <BreakdownList title={t(props.lang, "admin_runtime_scene_loop_status_title")} rows={sceneLoopStatusBreakdown} />
        <BreakdownList title={t(props.lang, "admin_runtime_scene_loop_sequence_title")} rows={sceneLoopSequenceBreakdown} />
        <BreakdownList title={t(props.lang, "admin_runtime_scene_loop_entry_title")} rows={sceneLoopEntryBreakdown} />
        <SceneLoopDistrictFamilyMatrixList
          title={t(props.lang, "admin_runtime_scene_loop_district_family_matrix_title")}
          rows={sceneLoopDistrictFamilyMatrix}
        />
        <BreakdownList
          title={t(props.lang, "admin_runtime_scene_loop_district_family_latest_band_title")}
          rows={sceneLoopDistrictFamilyLatestBandBreakdown}
        />
        <BreakdownList
          title={t(props.lang, "admin_runtime_scene_loop_district_family_trend_title")}
          rows={sceneLoopDistrictFamilyTrendBreakdown}
        />
        <BreakdownList
          title={t(props.lang, "admin_runtime_scene_loop_district_family_health_trend_title")}
          rows={sceneLoopDistrictFamilyHealthTrendBreakdown}
        />
        <BreakdownList
          title={t(props.lang, "admin_runtime_scene_loop_district_family_attention_title")}
          rows={sceneLoopDistrictFamilyAttentionBreakdown}
        />
        <BreakdownList
          title={t(props.lang, "admin_runtime_scene_loop_district_family_health_attention_title")}
          rows={sceneLoopDistrictFamilyHealthAttentionBreakdown}
        />
        <BreakdownList
          title={t(props.lang, "admin_runtime_scene_loop_district_family_attention_trend_title")}
          rows={sceneLoopDistrictFamilyAttentionTrendBreakdown}
        />
        <BreakdownList
          title={t(props.lang, "admin_runtime_scene_loop_district_family_health_attention_trend_title")}
          rows={sceneLoopDistrictFamilyHealthAttentionTrendBreakdown}
        />
        <SceneLoopDistrictFamilyMatrixList
          title={t(props.lang, "admin_runtime_scene_loop_district_family_health_attention_trend_matrix_title")}
          rows={sceneLoopDistrictFamilyHealthAttentionTrendMatrix}
        />
        <AlarmReasonList title={t(props.lang, "admin_runtime_scene_loop_alarm_reasons_7d")} rows={sceneLoopAlarmReasons7d} />
      </section>
      <section className="akrMiniPanel" data-akr-focus-key="live_ops_kpi">
        <h3>{t(props.lang, "admin_runtime_live_ops_kpi_title")}</h3>
        <div className="akrChipRow">
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_campaign_label")}: {readText(liveOpsKpi, "campaign_key") || "-"}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_sent_24h")}: {Math.floor(readNum(liveOpsKpi, "sent_24h"))}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_sent_7d")}: {Math.floor(readNum(liveOpsKpi, "sent_7d"))}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_unique_7d")}: {Math.floor(readNum(liveOpsKpi, "unique_users_7d"))}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_ready_label")}:{" "}
            {liveOpsKpi?.ready_for_auto_dispatch ? t(props.lang, "admin_live_ops_bool_yes") : t(props.lang, "admin_live_ops_bool_no")}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_schedule_label")}: {readText(liveOpsKpi, "schedule_state") || "-"}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_approval_label")}: {readText(liveOpsKpi, "approval_state") || "-"}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_experiment_label")}: {readText(liveOpsKpi, "experiment_key") || "-"}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_skip_24h")}: {Math.floor(readNum(schedulerSkip, "skipped_24h"))}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_skip_7d")}: {Math.floor(readNum(schedulerSkip, "skipped_7d"))}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_skip_reason_label")}: {readText(schedulerSkip, "latest_skip_reason") || "-"}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_skip_alarm_label")}: {readText(schedulerSkip, "alarm_state") || "-"}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_skip_alarm_reason_label")}: {readText(schedulerSkip, "alarm_reason") || "-"}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_ops_alert_label")}: {readText(opsAlert, "alarm_state") || "-"}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_ops_alert_sent_label")}:{" "}
            {opsAlert?.telegram_sent ? t(props.lang, "admin_live_ops_bool_yes") : t(props.lang, "admin_live_ops_bool_no")}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_ops_alert_raised_24h_label")}: {Math.floor(readNum(opsAlertTrend, "raised_24h"))}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_ops_alert_raised_7d_label")}: {Math.floor(readNum(opsAlertTrend, "raised_7d"))}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_ops_alert_delta_24h_label")}: {Math.floor(readNum(opsAlertTrend, "effective_cap_delta_24h"))}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_ops_alert_delta_7d_label")}: {Math.floor(readNum(opsAlertTrend, "effective_cap_delta_7d"))}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_ops_alert_query_trend_label")}: {Math.floor(readNum(opsAlert, "selection_query_strategy_applied_24h"))} /{" "}
            {Math.floor(readNum(opsAlert, "selection_query_strategy_applied_7d"))}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_recommend_cap_label")}: {Math.floor(readNum(recipientCapRecommendation, "recommended_recipient_cap"))}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_guidance_mode_label")}: {readText(targetingGuidance, "default_mode") || "-"}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_guidance_state_label")}: {readText(targetingGuidance, "guidance_state") || "-"}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_selection_mode_label")}: {readText(selectionSummary, "guidance_mode") || "-"}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_selection_state_label")}: {readText(selectionSummary, "guidance_state") || "-"}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_selection_prefilter_label")}:{" "}
            {selectionPrefilter?.applied ? t(props.lang, "admin_live_ops_bool_yes") : t(props.lang, "admin_live_ops_bool_no")}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_selection_trend_dispatch_label")}: {Math.floor(readNum(selectionTrend, "dispatches_7d"))}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_selection_trend_query_label")}: {Math.floor(readNum(selectionTrend, "query_strategy_applied_7d"))}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_selection_trend_prefilter_label")}: {Math.floor(readNum(selectionTrend, "prefilter_applied_7d"))}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_selection_query_label")}:{" "}
            {selectionQueryStrategy?.applied ? t(props.lang, "admin_live_ops_bool_yes") : t(props.lang, "admin_live_ops_bool_no")}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_selection_trend_delta_label")}: {Math.floor(readNum(selectionTrend, "prefilter_delta_7d"))}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_recommend_delta_label")}: {Math.floor(readNum(recipientCapRecommendation, "effective_cap_delta"))}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_recommend_pressure_label")}: {readText(recipientCapRecommendation, "pressure_band") || "-"}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_ops_alert_experiment_label")}: {readText(opsAlertTrend, "experiment_key") || "-"}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_live_ops_ops_alert_delta_max_label")}: {Math.floor(readNum(opsAlertTrend, "max_effective_cap_delta_7d"))}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_live_ops_scheduler_scene_effect_label")}: {readText(liveOpsKpi, "scene_gate_effect") || "-"}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_scene_health")}: {readText(liveOpsSceneRuntime, "health_band_24h") || "-"}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_scene_trend")}: {readText(liveOpsSceneRuntime, "trend_direction_7d") || "-"}
          </span>
          <span className="akrChip">
            {t(props.lang, "admin_runtime_scene_alarm")}: {readText(liveOpsSceneRuntime, "alarm_state_7d") || "-"}
          </span>
        </div>
        <div className="akrStack">
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_live_ops_latest_dispatch_label")}: {formatStamp(liveOpsKpi?.latest_dispatch_at)} /{" "}
            {readText(liveOpsKpi, "latest_dispatch_ref") || "-"}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_live_ops_latest_auto_label")}: {formatStamp(liveOpsKpi?.latest_auto_dispatch_at)} /{" "}
            {readText(liveOpsKpi, "latest_auto_dispatch_ref") || "-"}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_live_ops_ops_alert_reason_label")}: {readText(opsAlert, "notification_reason") || "-"} |{" "}
            {t(props.lang, "admin_runtime_live_ops_ops_alert_sent_at_label")}: {formatStamp(opsAlert?.telegram_sent_at)}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_live_ops_ops_alert_focus_escalation_label")}: {readText(opsAlert, "pressure_focus_escalation_band") || "-"} /{" "}
            {readText(opsAlert, "pressure_focus_escalation_reason") || "-"} / {readText(opsAlert, "pressure_focus_escalation_dimension") || "-"} /{" "}
            {readText(opsAlert, "pressure_focus_escalation_bucket") || "-"}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_live_ops_ops_alert_latest_label")}: {formatStamp(opsAlertTrend?.latest_alert_at)} |{" "}
            {t(props.lang, "admin_runtime_live_ops_ops_alert_reason_label")}: {readText(opsAlertTrend, "latest_notification_reason") || "-"}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_live_ops_ops_alert_focus_share_label")}: {toPct(readNum(opsAlert, "pressure_focus_escalation_share"))} |{" "}
            {t(props.lang, "admin_runtime_live_ops_ops_alert_focus_delta_ratio_label")}: {toPct(readNum(opsAlert, "pressure_focus_effective_delta_ratio"))}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_live_ops_ops_alert_query_reason_label")}: {readText(opsAlert, "selection_latest_query_strategy_reason") || "-"} /{" "}
            {readText(opsAlert, "selection_top_query_strategy_reason") || "-"} ({Math.floor(readNum(opsAlert, "selection_top_query_strategy_reason_count"))}) |{" "}
            {t(props.lang, "admin_runtime_live_ops_ops_alert_segment_reason_label")}: {readText(opsAlert, "selection_latest_segment_strategy_reason") || "-"} /{" "}
            {readText(opsAlert, "selection_top_segment_strategy_reason") || "-"} ({Math.floor(readNum(opsAlert, "selection_top_segment_strategy_reason_count"))})
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_live_ops_ops_alert_query_family_label")}: {readText(opsAlert, "selection_latest_query_strategy_family") || "-"} /{" "}
            {readText(opsAlert, "selection_top_query_strategy_family") || "-"} | {t(props.lang, "admin_runtime_live_ops_ops_alert_segment_family_label")}:{" "}
            {readText(opsAlert, "selection_latest_segment_strategy_family") || "-"} / {readText(opsAlert, "selection_top_segment_strategy_family") || "-"}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_live_ops_ops_alert_query_adjustment_label")}:{" "}
            {opsAlert?.selection_query_adjustment_applied ? t(props.lang, "admin_live_ops_bool_yes") : t(props.lang, "admin_live_ops_bool_no")} /{" "}
            {Math.floor(readNum(opsAlert, "selection_query_adjustment_count"))} / {Math.floor(readNum(opsAlert, "selection_query_adjustment_total_delta"))} /{" "}
            {readText(opsAlert, "selection_query_adjustment_top_field") || "-"} / {readText(opsAlert, "selection_query_adjustment_top_reason") || "-"} /{" "}
            {Math.floor(readNum(opsAlert, "selection_query_adjustment_top_after_value"))}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_live_ops_ops_alert_query_adjustment_pressure_label")}: {readText(opsAlert, "selection_query_adjustment_escalation_band") || "-"} /{" "}
            {readText(opsAlert, "selection_query_adjustment_escalation_reason") || "-"} / {readText(opsAlert, "selection_query_adjustment_escalation_dimension") || "-"} /{" "}
            {readText(opsAlert, "selection_query_adjustment_escalation_bucket") || "-"} / {readText(opsAlert, "selection_query_adjustment_escalation_field") || "-"} /{" "}
            {readText(opsAlert, "selection_query_adjustment_field_family") || "-"} |{" "}
            {t(props.lang, "admin_runtime_live_ops_ops_alert_query_adjustment_score_label")}: {Math.floor(readNum(opsAlert, "selection_query_adjustment_escalation_score"))} |{" "}
            {t(props.lang, "admin_runtime_live_ops_ops_alert_query_adjustment_weights_label")}: {Math.floor(readNum(opsAlert, "selection_query_adjustment_daily_weight"))} /{" "}
            {Math.floor(readNum(opsAlert, "selection_query_adjustment_top_delta_weight"))} / {Math.floor(readNum(opsAlert, "selection_query_adjustment_total_delta_weight"))} /{" "}
            {Math.floor(readNum(opsAlert, "selection_query_adjustment_field_weight"))} / {Math.floor(readNum(opsAlert, "selection_query_adjustment_field_family_weight"))} /{" "}
            {Math.floor(readNum(opsAlert, "selection_query_adjustment_query_family_match_days"))} / {Math.floor(readNum(opsAlert, "selection_query_adjustment_segment_family_match_days"))} /{" "}
            {Math.floor(readNum(opsAlert, "selection_query_adjustment_field_family_match_days"))} | B{" "}
            {readText(opsAlert, "selection_query_adjustment_band_signal") || "-"} / {Math.floor(readNum(opsAlert, "selection_query_adjustment_band_weight"))} /{" "}
            {Math.floor(readNum(opsAlert, "selection_query_adjustment_band_match_days"))}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_live_ops_ops_alert_selection_family_pressure_label")}: {readText(opsAlert, "selection_family_escalation_band") || "-"} /{" "}
            {readText(opsAlert, "selection_family_escalation_reason") || "-"} / {readText(opsAlert, "selection_family_escalation_dimension") || "-"} /{" "}
            {readText(opsAlert, "selection_family_escalation_bucket") || "-"} | {t(props.lang, "admin_runtime_live_ops_ops_alert_selection_family_score_label")}:{" "}
            {Math.floor(readNum(opsAlert, "selection_family_escalation_score"))} | {t(props.lang, "admin_runtime_live_ops_ops_alert_selection_family_daily_label")}:{" "}
            {Math.floor(readNum(opsAlert, "selection_family_daily_weight"))} / {Math.floor(readNum(opsAlert, "selection_query_family_match_days"))} /{" "}
            {Math.floor(readNum(opsAlert, "selection_segment_family_match_days"))} / {Math.floor(readNum(opsAlert, "selection_field_family_match_days"))} | Q{" "}
            {Math.floor(readNum(opsAlert, "selection_query_family_weight"))} / S {Math.floor(readNum(opsAlert, "selection_segment_family_weight"))} / F{" "}
            {Math.floor(readNum(opsAlert, "selection_field_family_weight"))} | B {readText(opsAlert, "selection_family_band_signal") || "-"} /{" "}
            {Math.floor(readNum(opsAlert, "selection_family_band_weight"))} / {Math.floor(readNum(opsAlert, "selection_family_band_match_days"))}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_live_ops_recommend_reason_label")}: {readText(recipientCapRecommendation, "reason") || "-"} |{" "}
            {t(props.lang, "admin_runtime_live_ops_recommend_focus_label")}: {readText(recipientCapRecommendation, "segment_key") || "-"} /{" "}
            {readText(recipientCapRecommendation, "locale_bucket") || "-"} / {readText(recipientCapRecommendation, "surface_bucket") || "-"}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_live_ops_guidance_mode_label")}: {readText(targetingGuidance, "default_mode") || "-"} |{" "}
            {t(props.lang, "admin_runtime_live_ops_guidance_state_label")}: {readText(targetingGuidance, "guidance_state") || "-"} |{" "}
            {t(props.lang, "admin_runtime_live_ops_guidance_reason_label")}: {readText(targetingGuidance, "guidance_reason") || "-"}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_live_ops_guidance_focus_label")}: {readText(targetingGuidance, "focus_dimension") || "-"} /{" "}
            {readText(targetingGuidance, "focus_bucket") || "-"} | {t(props.lang, "admin_runtime_live_ops_guidance_focus_share_label")}:{" "}
            {toPct(readNum(targetingGuidance, "focus_share_of_recommended_cap"))}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_live_ops_selection_reason_label")}: {readText(selectionSummary, "guidance_reason") || "-"} |{" "}
            {t(props.lang, "admin_runtime_live_ops_selection_focus_label")}: {readText(selectionSummary, "focus_dimension") || "-"} /{" "}
            {readText(selectionSummary, "focus_bucket") || "-"}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_live_ops_selection_count_label")}: {Math.floor(readNum(selectionSummary, "selected_candidates"))} /{" "}
            {Math.floor(readNum(selectionSummary, "prioritized_candidates"))} | {t(props.lang, "admin_runtime_live_ops_selection_locale_label")}:{" "}
            {Math.floor(readNum(selectionSummary, "selected_top_locale_matches"))} / {Math.floor(readNum(selectionSummary, "prioritized_top_locale_matches"))} |{" "}
            {t(props.lang, "admin_runtime_live_ops_selection_variant_label")}: {Math.floor(readNum(selectionSummary, "selected_top_variant_matches"))} /{" "}
            {Math.floor(readNum(selectionSummary, "prioritized_top_variant_matches"))}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_live_ops_selection_focus_match_label")}: {Math.floor(readNum(selectionSummary, "selected_focus_matches"))} /{" "}
            {Math.floor(readNum(selectionSummary, "prioritized_focus_matches"))}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_live_ops_selection_query_label")}:{" "}
            {selectionQueryStrategy?.applied ? t(props.lang, "admin_live_ops_bool_yes") : t(props.lang, "admin_live_ops_bool_no")} |{" "}
            {t(props.lang, "admin_runtime_live_ops_selection_query_reason_label")}: {readText(selectionQueryStrategy, "reason") || "-"} /{" "}
            {readText(selectionQueryStrategy, "locale_strategy_reason") || "-"} / {readText(selectionQueryStrategy, "segment_strategy_reason") || "-"}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_live_ops_selection_query_family_label")}: {readText(selectionQueryStrategy, "strategy_family") || "-"} /{" "}
            {readText(selectionQueryStrategy, "locale_strategy_family") || "-"} / {readText(selectionQueryStrategy, "segment_strategy_family") || "-"}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_live_ops_selection_query_path_label")}: {readText(selectionQueryStrategy, "strategy_segment_path_key") || "-"} /{" "}
            {t(props.lang, "admin_runtime_live_ops_selection_adjustment_path_label")}: {readText(selectionQueryStrategy, "adjustment_segment_path_key") || "-"}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_live_ops_selection_query_risk_label")}: {readText(selectionQueryStrategy, "family_risk_state") || "-"} /{" "}
            {readText(selectionQueryStrategy, "family_risk_reason") || "-"} / {readText(selectionQueryStrategy, "family_risk_dimension") || "-"} /{" "}
            {readText(selectionQueryStrategy, "family_risk_bucket") || "-"} | {t(props.lang, "admin_runtime_live_ops_selection_query_risk_weight_label")}:{" "}
            {Math.floor(readNum(selectionQueryStrategy, "family_risk_weight"))} / {Math.floor(readNum(selectionQueryStrategy, "family_risk_match_days"))} |{" "}
            {t(props.lang, "admin_runtime_live_ops_selection_query_risk_tightened_label")}:{" "}
            {selectionQueryStrategy?.family_risk_tightened ? t(props.lang, "admin_live_ops_bool_yes") : t(props.lang, "admin_live_ops_bool_no")}
          </p>
          <QueryStrategyAdjustmentList
            title={t(props.lang, "admin_runtime_live_ops_selection_query_adjustments_title")}
            rows={selectionQueryAdjustments}
          />
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_live_ops_selection_query_window_label")}: {readText(selectionQueryStrategy, "mode_key") || "-"} /{" "}
            {readText(selectionQueryStrategy, "segment_key") || "-"} / x{Math.floor(readNum(selectionQueryStrategy, "pool_limit_multiplier") || 0)} /{" "}
            {readText(selectionQueryStrategy, "exclude_locale_prefix") || "-"}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_live_ops_selection_query_caps_label")}: active {Math.floor(readNum(selectionQueryStrategy, "active_within_days_cap"))} | inactive{" "}
            {Math.floor(readNum(selectionQueryStrategy, "inactive_hours_floor"))} | max-age {Math.floor(readNum(selectionQueryStrategy, "max_age_days_cap"))} | offer{" "}
            {Math.floor(readNum(selectionQueryStrategy, "offer_age_days_cap"))}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_live_ops_selection_prefilter_focus_label")}: {readText(selectionPrefilter, "dimension") || "-"} /{" "}
            {readText(selectionPrefilter, "bucket") || "-"} | {t(props.lang, "admin_runtime_live_ops_selection_prefilter_count_label")}:{" "}
            {Math.floor(readNum(selectionPrefilter, "candidates_after"))} / {Math.floor(readNum(selectionPrefilter, "candidates_before"))} |{" "}
            {t(props.lang, "admin_runtime_live_ops_selection_prefilter_reason_label")}: {readText(selectionPrefilter, "reason") || "-"}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_live_ops_selection_trend_dispatch_label")}: {Math.floor(readNum(selectionTrend, "dispatches_24h"))} /{" "}
            {Math.floor(readNum(selectionTrend, "dispatches_7d"))} | {t(props.lang, "admin_runtime_live_ops_selection_trend_query_label")}:{" "}
            {Math.floor(readNum(selectionTrend, "query_strategy_applied_24h"))} / {Math.floor(readNum(selectionTrend, "query_strategy_applied_7d"))} |{" "}
            {t(props.lang, "admin_runtime_live_ops_selection_trend_prefilter_label")}:{" "}
            {Math.floor(readNum(selectionTrend, "prefilter_applied_24h"))} / {Math.floor(readNum(selectionTrend, "prefilter_applied_7d"))} |{" "}
            {t(props.lang, "admin_runtime_live_ops_selection_trend_delta_label")}: {Math.floor(readNum(selectionTrend, "prefilter_delta_24h"))} /{" "}
            {Math.floor(readNum(selectionTrend, "prefilter_delta_7d"))}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_live_ops_selection_trend_adjustment_label")}: {Math.floor(readNum(selectionTrend, "query_adjustment_applied_24h"))} /{" "}
            {Math.floor(readNum(selectionTrend, "query_adjustment_applied_7d"))} | {t(props.lang, "admin_runtime_live_ops_selection_trend_adjustment_delta_label")}:{" "}
            {Math.floor(readNum(selectionTrend, "query_adjustment_total_delta_24h"))} / {Math.floor(readNum(selectionTrend, "query_adjustment_total_delta_7d"))} |{" "}
            {t(props.lang, "admin_runtime_live_ops_selection_trend_adjustment_latest_label")}: {readText(selectionTrend, "latest_query_adjustment_field") || "-"} /{" "}
            {readText(selectionTrend, "latest_query_adjustment_field_family") || "-"} / {readText(selectionTrend, "latest_query_adjustment_reason") || "-"} /{" "}
            {Math.floor(readNum(selectionTrend, "latest_query_adjustment_total_delta"))}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_live_ops_selection_trend_focus_label")}: {Math.floor(readNum(selectionTrend, "selected_focus_matches_24h"))} /{" "}
            {Math.floor(readNum(selectionTrend, "prioritized_focus_matches_24h"))} | {t(props.lang, "admin_runtime_live_ops_selection_trend_latest_label")}:{" "}
            {readText(selectionTrend, "latest_guidance_mode") || "-"} / {readText(selectionTrend, "latest_focus_dimension") || "-"} /{" "}
            {readText(selectionTrend, "latest_focus_bucket") || "-"} / {readText(selectionTrend, "latest_query_strategy_reason") || "-"} /{" "}
            {readText(selectionTrend, "latest_segment_strategy_reason") || "-"} / {readText(selectionTrend, "latest_prefilter_reason") || "-"}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_live_ops_selection_trend_family_risk_label")}: {readText(selectionTrend, "latest_family_risk_state") || "-"} /{" "}
            {readText(selectionTrend, "latest_family_risk_reason") || "-"} / {readText(selectionTrend, "latest_family_risk_dimension") || "-"} /{" "}
            {readText(selectionTrend, "latest_family_risk_bucket") || "-"} | {Math.floor(readNum(selectionTrend, "latest_family_risk_score"))}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_live_ops_selection_trend_family_risk_path_label")}: {readText(selectionTrend, "latest_family_risk_query_segment_path") || "-"} /{" "}
            {readText(selectionTrend, "latest_family_risk_adjustment_segment_path") || "-"}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_live_ops_selection_trend_query_path_label")}: {readText(selectionTrend, "latest_query_strategy_segment_path") || "-"} /{" "}
            {t(props.lang, "admin_runtime_live_ops_selection_trend_adjustment_path_label")}: {readText(selectionTrend, "latest_query_adjustment_segment_path") || "-"}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_live_ops_ops_alert_delta_24h_label")}: {Math.floor(readNum(opsAlertTrend, "effective_cap_delta_24h"))} |{" "}
            {t(props.lang, "admin_runtime_live_ops_ops_alert_delta_7d_label")}: {Math.floor(readNum(opsAlertTrend, "effective_cap_delta_7d"))} |{" "}
            {t(props.lang, "admin_runtime_live_ops_ops_alert_delta_max_label")}: {Math.floor(readNum(opsAlertTrend, "max_effective_cap_delta_7d"))}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_live_ops_recommend_delta_label")}: {Math.floor(readNum(recipientCapRecommendation, "effective_cap_delta"))} |{" "}
            {t(props.lang, "admin_runtime_live_ops_ops_alert_delta_max_label")}: {Math.floor(readNum(opsAlertTrend, "max_effective_cap_delta_7d"))}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_live_ops_scheduler_scene_state_label")}: {readText(liveOpsKpi, "scene_gate_state") || "-"} /{" "}
            {t(props.lang, "admin_live_ops_scheduler_scene_cap_label")}: {Math.floor(readNum(liveOpsKpi, "scene_gate_recipient_cap"))}
          </p>
          <p className="akrMutedLine">
            {t(props.lang, "admin_runtime_scene_ready_avg")}: {toPct(readNum(liveOpsSceneRuntime, "ready_rate_7d_avg"))} |{" "}
            {t(props.lang, "admin_runtime_scene_failure_avg")}: {toPct(readNum(liveOpsSceneRuntime, "failure_rate_7d_avg"))}
          </p>
          {readText(liveOpsKpi, "scene_gate_reason") ? <p className="akrMutedLine">{readText(liveOpsKpi, "scene_gate_reason")}</p> : null}
          {readText(liveOpsKpi, "error_code") ? <p className="akrErrorLine">{readText(liveOpsKpi, "error_code")}</p> : null}
        </div>
        <BreakdownList
          title={t(props.lang, "admin_runtime_live_ops_daily_title")}
          rows={dailyBreakdown.map((row) => ({
            bucket_key: `${String(row.day || "-")}`,
            item_count: Number(row.sent_count || 0)
          }))}
        />
        <BreakdownList title={t(props.lang, "admin_runtime_live_ops_locale_title")} rows={localeBreakdown} />
        <BreakdownList title={t(props.lang, "admin_runtime_live_ops_segment_title")} rows={segmentBreakdown} />
        <BreakdownList title={t(props.lang, "admin_runtime_live_ops_surface_title")} rows={surfaceBreakdown} />
        <BreakdownList title={t(props.lang, "admin_runtime_live_ops_variant_title")} rows={variantBreakdown} />
        <BreakdownList title={t(props.lang, "admin_runtime_live_ops_cohort_title")} rows={cohortBreakdown} />
        <SelectionDailyTrendList title={t(props.lang, "admin_runtime_live_ops_selection_daily_title")} rows={selectionTrendDaily} />
        <SelectionAdjustmentDailyTrendList
          title={t(props.lang, "admin_runtime_live_ops_selection_adjustment_daily_title")}
          rows={selectionTrendAdjustmentDaily}
        />
        <SelectionFamilyDailyTrendList
          title={t(props.lang, "admin_runtime_live_ops_selection_query_family_daily_title")}
          rows={selectionTrendQueryFamilyDaily}
        />
        <SelectionFamilyDailyTrendList
          title={t(props.lang, "admin_runtime_live_ops_selection_query_path_daily_title")}
          rows={selectionTrendQueryPathDaily}
        />
        <SelectionFamilyDailyTrendList
          title={t(props.lang, "admin_runtime_live_ops_selection_adjustment_query_family_daily_title")}
          rows={selectionTrendAdjustmentQueryFamilyDaily}
        />
        <SelectionFamilyDailyTrendList
          title={t(props.lang, "admin_runtime_live_ops_selection_segment_family_daily_title")}
          rows={selectionTrendSegmentFamilyDaily}
        />
        <SelectionFamilyDailyTrendList
          title={t(props.lang, "admin_runtime_live_ops_selection_adjustment_segment_family_daily_title")}
          rows={selectionTrendAdjustmentSegmentFamilyDaily}
        />
        <SelectionFamilyDailyTrendList
          title={t(props.lang, "admin_runtime_live_ops_selection_adjustment_field_family_daily_title")}
          rows={selectionTrendAdjustmentFieldFamilyDaily}
        />
        <SelectionFamilyDailyTrendList
          title={t(props.lang, "admin_runtime_live_ops_selection_adjustment_path_daily_title")}
          rows={selectionTrendAdjustmentPathDaily}
        />
        <SelectionFamilyRiskDailyTrendList
          title={t(props.lang, "admin_runtime_live_ops_selection_family_risk_daily_title")}
          rows={selectionTrendFamilyRiskDaily}
        />
        <SelectionFamilyDailyTrendList
          title={t(props.lang, "admin_runtime_live_ops_selection_family_risk_field_band_daily_title")}
          rows={selectionTrendFamilyRiskFieldBandDaily}
        />
        <SelectionFamilyDailyTrendList
          title={t(props.lang, "admin_runtime_live_ops_selection_family_risk_query_path_band_daily_title")}
          rows={selectionTrendFamilyRiskQueryPathBandDaily}
        />
        <SelectionFamilyDailyTrendList
          title={t(props.lang, "admin_runtime_live_ops_selection_family_risk_adjustment_path_band_daily_title")}
          rows={selectionTrendFamilyRiskAdjustmentPathBandDaily}
        />
        <BreakdownList title={t(props.lang, "admin_runtime_live_ops_selection_adjustment_field_breakdown_title")} rows={selectionTrendAdjustmentFields} />
        <BreakdownList title={t(props.lang, "admin_runtime_live_ops_selection_adjustment_field_family_breakdown_title")} rows={selectionTrendAdjustmentFieldFamilies} />
        <BreakdownList title={t(props.lang, "admin_runtime_live_ops_selection_adjustment_reason_breakdown_title")} rows={selectionTrendAdjustmentReasons} />
        <BreakdownList title={t(props.lang, "admin_runtime_live_ops_selection_query_reason_breakdown_title")} rows={selectionTrendQueryReasons} />
        <BreakdownList title={t(props.lang, "admin_runtime_live_ops_selection_adjustment_query_family_breakdown_title")} rows={selectionTrendAdjustmentQueryFamilies} />
        <BreakdownList title={t(props.lang, "admin_runtime_live_ops_selection_query_family_breakdown_title")} rows={selectionTrendQueryFamilies} />
        <BreakdownList title={t(props.lang, "admin_runtime_live_ops_selection_query_path_breakdown_title")} rows={selectionTrendQueryPaths} />
        <BreakdownList title={t(props.lang, "admin_runtime_live_ops_selection_segment_reason_breakdown_title")} rows={selectionTrendSegmentReasons} />
        <BreakdownList title={t(props.lang, "admin_runtime_live_ops_selection_adjustment_segment_family_breakdown_title")} rows={selectionTrendAdjustmentSegmentFamilies} />
        <BreakdownList title={t(props.lang, "admin_runtime_live_ops_selection_segment_family_breakdown_title")} rows={selectionTrendSegmentFamilies} />
        <BreakdownList title={t(props.lang, "admin_runtime_live_ops_selection_adjustment_path_breakdown_title")} rows={selectionTrendAdjustmentPaths} />
        <BreakdownList title={t(props.lang, "admin_runtime_live_ops_selection_family_risk_band_title")} rows={selectionTrendFamilyRiskBands} />
        <BreakdownList title={t(props.lang, "admin_runtime_live_ops_selection_family_risk_dimension_title")} rows={selectionTrendFamilyRiskDimensions} />
        <BreakdownList title={t(props.lang, "admin_runtime_live_ops_selection_family_risk_field_title")} rows={selectionTrendFamilyRiskFieldFamilies} />
        <BreakdownList title={t(props.lang, "admin_runtime_live_ops_selection_family_risk_query_path_title")} rows={selectionTrendFamilyRiskQueryPaths} />
        <BreakdownList title={t(props.lang, "admin_runtime_live_ops_selection_family_risk_adjustment_path_title")} rows={selectionTrendFamilyRiskAdjustmentPaths} />
        <BreakdownList title={t(props.lang, "admin_runtime_live_ops_selection_family_risk_field_band_title")} rows={selectionTrendFamilyRiskFieldBands} />
        <BreakdownList title={t(props.lang, "admin_runtime_live_ops_selection_family_risk_query_path_band_title")} rows={selectionTrendFamilyRiskQueryPathBands} />
        <BreakdownList title={t(props.lang, "admin_runtime_live_ops_selection_family_risk_adjustment_path_band_title")} rows={selectionTrendFamilyRiskAdjustmentPathBands} />
        <BreakdownList title={t(props.lang, "admin_runtime_live_ops_selection_reason_breakdown_title")} rows={selectionTrendReasons} />
        <SkipDailyTrendList title={t(props.lang, "admin_runtime_live_ops_skip_daily_title")} rows={schedulerSkipDaily} />
        <BreakdownList title={t(props.lang, "admin_runtime_live_ops_skip_reason_title")} rows={schedulerSkipReasons} />
        <BreakdownList title={t(props.lang, "admin_runtime_live_ops_ops_alert_locale_title")} rows={opsAlertLocaleBreakdown} />
        <BreakdownList title={t(props.lang, "admin_runtime_live_ops_ops_alert_segment_title")} rows={opsAlertSegmentBreakdown} />
        <BreakdownList title={t(props.lang, "admin_runtime_live_ops_ops_alert_surface_title")} rows={opsAlertSurfaceBreakdown} />
        <BreakdownList title={t(props.lang, "admin_runtime_live_ops_ops_alert_variant_title")} rows={opsAlertVariantBreakdown} />
        <BreakdownList title={t(props.lang, "admin_runtime_live_ops_ops_alert_cohort_title")} rows={opsAlertCohortBreakdown} />
      </section>
      {props.opsKpiRunError ? <p className="akrErrorLine">{props.opsKpiRunError}</p> : null}
      <pre className="akrJsonBlock">{JSON.stringify(props.metricsData || {}, null, 2)}</pre>
      <pre className="akrJsonBlock">{JSON.stringify(props.opsKpiData || {}, null, 2)}</pre>
      <pre className="akrJsonBlock">{JSON.stringify(props.opsKpiRunData || {}, null, 2)}</pre>
      <pre className="akrJsonBlock">{JSON.stringify(props.deployStatusData || {}, null, 2)}</pre>
      <pre className="akrJsonBlock">{JSON.stringify(props.assetsStatusData || {}, null, 2)}</pre>
      <pre className="akrJsonBlock">{JSON.stringify(props.auditPhaseStatusData || {}, null, 2)}</pre>
      <pre className="akrJsonBlock">{JSON.stringify(props.auditIntegrityData || {}, null, 2)}</pre>
    </section>
  );
}
