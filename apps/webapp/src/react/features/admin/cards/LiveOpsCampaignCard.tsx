import { t, type Lang } from "../../../i18n";
import { SHELL_ACTION_KEY } from "../../../../core/navigation/shellActions.js";

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
    dry_run: "admin_live_ops_action_dry_run",
    dispatch: "admin_live_ops_action_dispatch"
  };
  return dictionary[actionKey] ? t(lang, dictionary[actionKey]) : formatWarningCode(actionKey || "unknown");
}

export function LiveOpsCampaignCard(props: LiveOpsCampaignCardProps) {
  const snapshot = asRecord(props.liveOpsCampaignData);
  const approvalSummary = asRecord(snapshot.approval_summary);
  const schedulerSummary = asRecord(snapshot.scheduler_summary);
  const versionHistory = asArray(snapshot.version_history);
  const dispatchHistory = asArray(snapshot.dispatch_history);
  const operatorTimeline = asArray(snapshot.operator_timeline);
  const deliverySummary = asRecord(snapshot.delivery_summary);
  const warnings = Array.isArray(approvalSummary.warnings) ? approvalSummary.warnings.map((row) => String(row || "").trim()).filter(Boolean) : [];
  const localeBreakdown = asArray(deliverySummary.locale_breakdown);
  const segmentBreakdown = asArray(deliverySummary.segment_breakdown);
  const surfaceBreakdown = asArray(deliverySummary.surface_breakdown);
  const variantBreakdown = asArray(deliverySummary.variant_breakdown);
  const cohortBreakdown = asArray(deliverySummary.cohort_breakdown);
  const dailyBreakdown = asArray(deliverySummary.daily_breakdown);
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
