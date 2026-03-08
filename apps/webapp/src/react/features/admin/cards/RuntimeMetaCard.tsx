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
  const sceneRuntimeDailyBreakdown = asRows(props.metricsData?.scene_runtime_daily_breakdown_7d);
  const sceneRuntimeQualityBreakdown = asRows(props.metricsData?.scene_runtime_quality_breakdown_24h);
  const sceneRuntimePerfBreakdown = asRows(props.metricsData?.scene_runtime_perf_breakdown_24h);
  const sceneRuntimeDeviceBreakdown = asRows(props.metricsData?.scene_runtime_device_breakdown_24h);
  const sceneRuntimeProfileBreakdown = asRows(props.metricsData?.scene_runtime_profile_breakdown_24h);
  const liveOpsKpi = asRecord((props.opsKpiRunData as Record<string, unknown> | null)?.live_ops_campaign) ||
    asRecord((props.opsKpiData as Record<string, unknown> | null)?.live_ops_campaign);
  const localeBreakdown = asRows(liveOpsKpi?.locale_breakdown);
  const segmentBreakdown = asRows(liveOpsKpi?.segment_breakdown);
  const surfaceBreakdown = asRows(liveOpsKpi?.surface_breakdown);
  const variantBreakdown = asRows(liveOpsKpi?.variant_breakdown);
  const cohortBreakdown = asRows(liveOpsKpi?.cohort_breakdown);
  const dailyBreakdown = asRows(liveOpsKpi?.daily_breakdown);

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
        </div>
        <SceneDailyTrendList title={t(props.lang, "admin_runtime_scene_daily_title")} rows={sceneRuntimeDailyBreakdown} />
        <BreakdownList title={t(props.lang, "admin_runtime_scene_quality_title")} rows={sceneRuntimeQualityBreakdown} />
        <BreakdownList title={t(props.lang, "admin_runtime_scene_perf_title")} rows={sceneRuntimePerfBreakdown} />
        <BreakdownList title={t(props.lang, "admin_runtime_scene_device_title")} rows={sceneRuntimeDeviceBreakdown} />
        <BreakdownList title={t(props.lang, "admin_runtime_scene_profile_title")} rows={sceneRuntimeProfileBreakdown} />
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
