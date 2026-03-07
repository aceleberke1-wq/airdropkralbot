import { t, type Lang } from "../../../i18n";

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
};

export function AdminQueueCard(props: AdminQueueCardProps) {
  return (
    <section className="akrCard akrCardWide" data-akr-panel-key="panel_admin_queue" data-akr-focus-key="queue_action">
      <h3>{t(props.lang, "admin_queue_title")}</h3>
      <button className="akrBtn akrBtnGhost" onClick={props.onRefresh}>
        {t(props.lang, "admin_refresh")}
      </button>
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
          aria-label="queue-tx-hash"
        />
        <input
          value={props.queueAction.reason}
          onChange={(e) => props.onQueueActionChange({ reason: e.target.value })}
          aria-label="queue-reason"
        />
        <input
          value={props.queueAction.confirm_token}
          onChange={(e) => props.onQueueActionChange({ confirm_token: e.target.value })}
          aria-label="queue-confirm-token"
        />
      </div>
      <button className="akrBtn akrBtnAccent" onClick={props.onRunQueueAction}>
        {t(props.lang, "admin_queue_run_action")}
      </button>
      <ul className="akrList">
        {(props.adminRuntime.queue || []).slice(0, props.advanced ? 100 : 25).map((row, idx) => (
          <li key={`${idx}_${String(row?.request_id || row?.queue_key || "q")}`}>
            <strong>{String(row?.kind || "request")}</strong>
            <span>{String(row?.status || "unknown")}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
