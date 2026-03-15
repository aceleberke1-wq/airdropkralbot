import { t, type Lang } from "../../../i18n";
import { SHELL_ACTION_KEY } from "../../../../core/navigation/shellActions.js";

type QueueActionState = {
  action_key: string;
  kind: string;
  request_id: string;
  tx_hash: string;
  reason: string;
  confirm_token: string;
};

type AdminQueueCardProps = {
  lang: Lang;
  advanced: boolean;
  adminRuntime: {
    summary: Record<string, unknown> | null;
    queue: Array<Record<string, unknown>>;
  };
  queueAction: QueueActionState;
  onQueueActionChange: (patch: Partial<QueueActionState>) => void;
  onRefresh: () => void;
  onRunQueueAction: () => void;
  onSurfaceAction: (sectionKey: string, slotKey: string, fallbackActionKey: string, sourcePanelKey?: string) => void;
};

function asText(value: unknown, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function asInt(value: unknown) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? Math.max(0, Math.round(num)) : 0;
}

function formatQueueKind(kind: string) {
  return asText(kind, "request").replace(/_/g, " ");
}

function formatQueueStatus(status: string) {
  return asText(status, "unknown").replace(/_/g, " ");
}

function formatAgeLabel(seconds: number) {
  if (seconds >= 3600) {
    return `${Math.round(seconds / 3600)}h`;
  }
  if (seconds >= 60) {
    return `${Math.round(seconds / 60)}m`;
  }
  return `${seconds}s`;
}

function requiresTxHash(actionKey: string) {
  return actionKey === "payout_pay";
}

function requiresReason(actionKey: string) {
  return actionKey === "payout_reject" || actionKey === "token_reject" || actionKey === "kyc_reject" || actionKey === "kyc_block";
}

function resolveQuickActions(kind: string) {
  if (kind === "payout_request") {
    return ["payout_pay", "payout_reject"];
  }
  if (kind === "token_manual_review" || kind === "token_auto_decision") {
    return ["token_approve", "token_reject"];
  }
  if (kind === "kyc_manual_review") {
    return ["kyc_approve", "kyc_reject", "kyc_block"];
  }
  return [];
}

function formatActionLabel(lang: Lang, actionKey: string) {
  switch (actionKey) {
    case "payout_pay":
      return t(lang, "admin_action_pay");
    case "payout_reject":
      return t(lang, "admin_action_reject");
    case "token_approve":
    case "kyc_approve":
      return t(lang, "admin_action_approve");
    case "token_reject":
    case "kyc_reject":
      return t(lang, "admin_action_reject");
    case "kyc_block":
      return t(lang, "admin_action_block");
    default:
      return asText(actionKey, "action");
  }
}

function countConfirmationRows(rows: Array<Record<string, unknown>>) {
  return rows.filter((row) => {
    const actionPolicy = row.action_policy && typeof row.action_policy === "object" ? row.action_policy : {};
    return Object.values(actionPolicy).some((policy) => Boolean(policy && typeof policy === "object" && (policy as any).confirmation_required));
  }).length;
}

function countHighPriorityRows(rows: Array<Record<string, unknown>>) {
  return rows.filter((row) => asInt(row.priority) >= 80).length;
}

export function AdminQueueCard(props: AdminQueueCardProps) {
  const queueRows = Array.isArray(props.adminRuntime.queue) ? props.adminRuntime.queue : [];
  const visibleRows = queueRows.slice(0, props.advanced ? 40 : 12);
  const selectedKind = String(props.queueAction.kind || "").trim().toLowerCase();
  const selectedRequestId = String(props.queueAction.request_id || "").trim();
  const selectedActionKey = String(props.queueAction.action_key || "").trim().toLowerCase();
  const selectedQuickActions = resolveQuickActions(selectedKind);
  const pendingCount = queueRows.length;
  const confirmationCount = countConfirmationRows(queueRows);
  const highPriorityCount = countHighPriorityRows(queueRows);

  const prefillAction = (row: Record<string, unknown>, actionKey?: string) => {
    const kind = String(row.kind || "").trim().toLowerCase();
    const nextActionKey = String(actionKey || resolveQuickActions(kind)[0] || props.queueAction.action_key || "").trim().toLowerCase();
    props.onQueueActionChange({
      action_key: nextActionKey,
      kind,
      request_id: String(row.request_id || ""),
      tx_hash: requiresTxHash(nextActionKey) ? props.queueAction.tx_hash : "",
      reason: requiresReason(nextActionKey) ? props.queueAction.reason : "",
      confirm_token: ""
    });
  };

  return (
    <section className="akrCard akrCardWide" data-akr-panel-key="panel_admin_queue" data-akr-focus-key="queue_action">
      <h3>{t(props.lang, "admin_queue_title")}</h3>
      <div className="akrActionRow">
        <button className="akrBtn akrBtnGhost" onClick={props.onRefresh}>
          {t(props.lang, "admin_refresh")}
        </button>
        {props.advanced ? (
          <>
            <button
              className="akrBtn akrBtnGhost"
              onClick={() => props.onSurfaceAction("admin_queue", "policy", SHELL_ACTION_KEY.ADMIN_POLICY_PANEL, "panel_admin_queue")}
            >
              {t(props.lang, "admin_nav_policy")}
            </button>
            <button
              className="akrBtn akrBtnGhost"
              onClick={() => props.onSurfaceAction("admin_queue", "runtime", SHELL_ACTION_KEY.ADMIN_RUNTIME_META, "panel_admin_queue")}
            >
              {t(props.lang, "admin_nav_runtime")}
            </button>
          </>
        ) : null}
      </div>

      <div className="akrChipRow">
        <span className="akrChip">
          {t(props.lang, "admin_queue_pending_count")}: {pendingCount}
        </span>
        <span className="akrChip">
          {t(props.lang, "admin_queue_confirmation_count")}: {confirmationCount}
        </span>
        <span className="akrChip">
          {t(props.lang, "admin_queue_high_priority_count")}: {highPriorityCount}
        </span>
      </div>

      {visibleRows.length ? (
        <ul className="akrList">
          {visibleRows.map((row, idx) => {
            const kind = String(row.kind || "").trim().toLowerCase();
            const actions = resolveQuickActions(kind);
            const requestId = asInt(row.request_id);
            const reasonText = asText(row.policy_reason_text || row.policy_reason_code, "-");
            return (
              <li key={`${idx}_${String(row?.request_id || row?.queue_key || "q")}`}>
                <span>
                  <strong>{formatQueueKind(kind)}</strong> #{requestId} | {formatQueueStatus(String(row.status || ""))} | P{asInt(row.priority)} |{" "}
                  {formatAgeLabel(asInt(row.queue_age_sec))}
                </span>
                <strong>{reasonText}</strong>
                {actions.length ? (
                  <div className="akrActionRow">
                    {actions.map((actionKey) => (
                      <button
                        key={`${requestId}_${actionKey}`}
                        className="akrBtn akrBtnGhost"
                        onClick={() => prefillAction(row, actionKey)}
                      >
                        {formatActionLabel(props.lang, actionKey)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="akrMuted">{t(props.lang, "admin_queue_empty")}</p>
      )}

      <section className="akrMiniPanel">
        <h4>{t(props.lang, "admin_queue_selected_title")}</h4>
        {selectedRequestId ? (
          <>
            <p className="akrMutedLine">
              {t(props.lang, "admin_queue_selected_request")}: #{selectedRequestId} | {formatQueueKind(selectedKind)} |{" "}
              {formatActionLabel(props.lang, selectedActionKey)}
            </p>
            {selectedQuickActions.length ? (
              <div className="akrActionRow">
                {selectedQuickActions.map((actionKey) => (
                  <button
                    key={`selected_${actionKey}`}
                    className={`akrBtn ${selectedActionKey === actionKey ? "akrBtnAccent" : "akrBtnGhost"}`}
                    onClick={() =>
                      props.onQueueActionChange({
                        action_key: actionKey,
                        tx_hash: requiresTxHash(actionKey) ? props.queueAction.tx_hash : "",
                        reason: requiresReason(actionKey) ? props.queueAction.reason : "",
                        confirm_token: ""
                      })
                    }
                  >
                    {formatActionLabel(props.lang, actionKey)}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="akrInputRow">
              {requiresTxHash(selectedActionKey) ? (
                <input
                  value={props.queueAction.tx_hash}
                  onChange={(e) => props.onQueueActionChange({ tx_hash: e.target.value })}
                  aria-label="queue-tx-hash"
                  placeholder={t(props.lang, "admin_queue_tx_hash")}
                />
              ) : null}
              {requiresReason(selectedActionKey) ? (
                <input
                  value={props.queueAction.reason}
                  onChange={(e) => props.onQueueActionChange({ reason: e.target.value })}
                  aria-label="queue-reason"
                  placeholder={t(props.lang, "admin_queue_reason")}
                />
              ) : null}
              {(props.advanced || String(props.queueAction.confirm_token || "").trim()) && (
                <input
                  value={props.queueAction.confirm_token}
                  onChange={(e) => props.onQueueActionChange({ confirm_token: e.target.value })}
                  aria-label="queue-confirm-token"
                  placeholder={t(props.lang, "admin_queue_confirm_token")}
                />
              )}
            </div>
            <button className="akrBtn akrBtnAccent" onClick={props.onRunQueueAction}>
              {t(props.lang, "admin_queue_run_action")}
            </button>
          </>
        ) : (
          <p className="akrMuted">{t(props.lang, "admin_queue_select_request")}</p>
        )}
      </section>

      {props.advanced ? (
        <>
          <pre className="akrJsonBlock">{JSON.stringify(props.adminRuntime.summary || {}, null, 2)}</pre>
          <div className="akrInputRow">
            <input
              value={props.queueAction.action_key}
              onChange={(e) => props.onQueueActionChange({ action_key: e.target.value })}
              aria-label="queue-action-key"
            />
            <input
              value={props.queueAction.kind}
              onChange={(e) => props.onQueueActionChange({ kind: e.target.value })}
              aria-label="queue-kind"
            />
            <input
              value={props.queueAction.request_id}
              onChange={(e) => props.onQueueActionChange({ request_id: e.target.value })}
              aria-label="queue-request-id"
            />
            <input
              value={props.queueAction.tx_hash}
              onChange={(e) => props.onQueueActionChange({ tx_hash: e.target.value })}
              aria-label="queue-tx-hash-advanced"
            />
            <input
              value={props.queueAction.reason}
              onChange={(e) => props.onQueueActionChange({ reason: e.target.value })}
              aria-label="queue-reason-advanced"
            />
            <input
              value={props.queueAction.confirm_token}
              onChange={(e) => props.onQueueActionChange({ confirm_token: e.target.value })}
              aria-label="queue-confirm-token-advanced"
            />
          </div>
        </>
      ) : null}
    </section>
  );
}
