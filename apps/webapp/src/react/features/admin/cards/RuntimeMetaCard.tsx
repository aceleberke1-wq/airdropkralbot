import { t, type Lang } from "../../../i18n";

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
};

function readNum(source: Record<string, unknown> | null, key: string): number {
  if (!source) return 0;
  const value = Number(source[key] || 0);
  return Number.isFinite(value) ? value : 0;
}

function toPct(value: number): string {
  return `${Math.round(Math.max(0, value) * 100)}%`;
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

  return (
    <section className="akrCard akrCardWide" data-akr-panel-key="panel_admin_runtime" data-akr-focus-key="runtime_meta">
      <h3>{t(props.lang, "admin_runtime_meta_title")}</h3>
      <div className="akrActionRow">
        <button className="akrBtn akrBtnGhost" onClick={props.onRefreshRuntimeMeta}>
          {t(props.lang, "admin_runtime_meta_refresh")}
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
