import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyPvpSessionActionV2,
  buildActionRequestId,
  fetchAdminAssetsStatusV2,
  fetchAdminBootstrapV2,
  fetchAdminMetricsV2,
  fetchAdminUnifiedQueueV2,
  fetchBootstrapV2,
  fetchPvpSessionStateV2,
  fetchTokenQuoteV2,
  fetchTokenRouteStatusV2,
  fetchTokenSummaryV2,
  postAcceptActionV2,
  postAdminQueueActionV2,
  postClaimMissionV2,
  postCompleteActionV2,
  postRevealActionV2,
  postTasksRerollV2,
  postTokenBuyIntentV2,
  postTokenSubmitTxV2,
  postUiPreferencesV2,
  resolvePvpSessionV2,
  startPvpSessionV2
} from "./api";
import { createUiAnalyticsClient, type UiAnalyticsClient } from "./analytics";
import { normalizeLang, t, tabLabel } from "./i18n";
import { useReactShellStore } from "./store";
import type { AdminQueueActionRequest, AnalyticsConfig, BootstrapV2Payload, TabKey, WebAppApiResponse, WebAppAuth } from "./types";
import "./styles.css";

type ReactWebAppV1Props = {
  auth: WebAppAuth;
  bootstrap: BootstrapV2Payload;
};

function resolveAnalyticsConfig(raw: unknown): AnalyticsConfig | null {
  const row = raw && typeof raw === "object" ? (raw as Partial<AnalyticsConfig>) : null;
  const sessionRef = String(row?.session_ref || "").trim();
  if (!sessionRef) return null;
  return {
    session_ref: sessionRef,
    flush_interval_ms: Math.max(1000, Number(row?.flush_interval_ms || 6000)),
    max_batch_size: Math.max(1, Number(row?.max_batch_size || 40)),
    sample_rate: Math.max(0, Math.min(1, Number(row?.sample_rate || 1)))
  };
}

function asError(payload: WebAppApiResponse | null | undefined, fallback = "request_failed"): string {
  return String(payload?.error || payload?.message || fallback);
}

function readSessionRef(payload: any): string {
  return String(payload?.session?.session_ref || payload?.session_ref || "").trim();
}

export function ReactWebAppV1(props: ReactWebAppV1Props) {
  const analyticsRef = useRef<UiAnalyticsClient | null>(null);
  const {
    auth,
    data,
    tab,
    workspace,
    lang,
    advanced,
    loading,
    error,
    onboardingVisible,
    adminRuntime,
    pvpRuntime,
    setBootstrap,
    patchData,
    setAuth,
    setTab,
    setWorkspace,
    setLang,
    toggleAdvanced,
    hideOnboarding,
    setLoading,
    setError,
    setAdminRuntime,
    setPvpRuntime
  } = useReactShellStore();

  const [taskResult, setTaskResult] = useState<any>(null);
  const [vaultData, setVaultData] = useState<any>({});
  const [quoteUsd, setQuoteUsd] = useState("10");
  const [quoteChain, setQuoteChain] = useState("TON");
  const [submitRequestId, setSubmitRequestId] = useState("");
  const [submitTxHash, setSubmitTxHash] = useState("");
  const [adminPanels, setAdminPanels] = useState<any>({});
  const [queueAction, setQueueAction] = useState<any>({
    action_key: "payout_pay",
    kind: "payout_request",
    request_id: "",
    tx_hash: "",
    reason: "",
    confirm_token: ""
  });

  const isAdmin = Boolean(data?.admin?.is_admin);
  const tabs = useMemo<TabKey[]>(
    () => (Array.isArray(data?.ui_shell?.tabs) && data?.ui_shell?.tabs.length ? data.ui_shell.tabs : ["home", "pvp", "tasks", "vault"]),
    [data?.ui_shell?.tabs]
  );

  const applySession = (payload: any) => {
    if (payload?.session?.uid && payload?.session?.ts && payload?.session?.sig) {
      setAuth({
        uid: String(payload.session.uid),
        ts: String(payload.session.ts),
        sig: String(payload.session.sig)
      });
    }
  };

  const syncPrefs = async (patch: Record<string, unknown>) => {
    const res = await postUiPreferencesV2(auth, patch).catch(() => null);
    if (!res?.success || !res.data?.ui_preferences) return;
    applySession(res);
    patchData({ ui_prefs: res.data.ui_preferences });
  };

  useEffect(() => {
    setAuth(props.auth);
    if (props.bootstrap?.success && props.bootstrap.data) {
      setBootstrap(props.bootstrap.data);
    } else {
      setLoading(false);
      setError(String(props.bootstrap?.error || "bootstrap_failed"));
    }
  }, [props.auth, props.bootstrap, setAuth, setBootstrap, setError, setLoading]);

  useEffect(() => {
    if (!data) return;
    const cfg = resolveAnalyticsConfig(data.analytics);
    if (!cfg) return;
    const client = createUiAnalyticsClient({
      auth,
      config: cfg,
      language: normalizeLang(lang),
      variantKey: data.experiment?.variant === "treatment" ? "treatment" : "control",
      experimentKey: String(data.experiment?.key || "webapp_react_v1"),
      cohortBucket: Number(data.experiment?.cohort_bucket || 0),
      tabKey: tab,
      routeKey: `${workspace}_${tab}`
    });
    analyticsRef.current = client;
    client.track({ event_key: "react_shell_open", panel_key: "shell", event_value: 1 });
    return () => client.dispose();
  }, [auth, data, lang, tab, workspace]);

  const refreshBootstrap = async () => {
    setLoading(true);
    setError("");
    const payload = await fetchBootstrapV2(auth, normalizeLang(lang)).catch(() => null);
    if (!payload?.success || !payload.data) {
      setLoading(false);
      setError(asError(payload, "bootstrap_failed"));
      return;
    }
    applySession(payload);
    setBootstrap(payload.data);
  };

  const refreshAdmin = async () => {
    const [summary, queue, metrics, assets] = await Promise.all([
      fetchAdminBootstrapV2(auth).catch(() => null),
      fetchAdminUnifiedQueueV2(auth, 80).catch(() => null),
      fetchAdminMetricsV2(auth).catch(() => null),
      fetchAdminAssetsStatusV2(auth).catch(() => null)
    ]);
    applySession(summary);
    setAdminRuntime(summary?.data || null, queue?.data?.items || []);
    setAdminPanels({ metrics: metrics?.data || null, assets: assets?.data || null });
  };

  const runMutation = async (runner: () => Promise<any>, fallback: string) => {
    setLoading(true);
    setError("");
    const res = await runner().catch(() => null);
    applySession(res);
    if (!res?.success) {
      setLoading(false);
      setError(asError(res, fallback));
      return;
    }
    setTaskResult(res.data || null);
    await refreshBootstrap();
  };

  const refreshVault = async () => {
    const [summary, route] = await Promise.all([fetchTokenSummaryV2(auth).catch(() => null), fetchTokenRouteStatusV2(auth).catch(() => null)]);
    applySession(summary);
    setVaultData((prev: any) => ({ ...prev, summary: summary?.data || null, route: route?.data || null }));
  };

  const runQueueAction = async () => {
    const payload: AdminQueueActionRequest = {
      action_key: String(queueAction.action_key || ""),
      kind: String(queueAction.kind || "") || undefined,
      request_id: Math.max(1, Number(queueAction.request_id || 0)),
      action_request_id: buildActionRequestId("admin_queue"),
      tx_hash: String(queueAction.tx_hash || "") || undefined,
      reason: String(queueAction.reason || "") || undefined,
      confirm_token: String(queueAction.confirm_token || "") || undefined
    };
    const res = await postAdminQueueActionV2(auth, payload).catch(() => null);
    applySession(res);
    if (!res?.success) {
      setError(asError(res, "admin_queue_action_failed"));
      return;
    }
    await refreshAdmin();
  };

  const handleWorkspace = async (next: "player" | "admin") => {
    setWorkspace(next);
    void syncPrefs({ workspace: next });
    if (next === "admin" && isAdmin) {
      await refreshAdmin();
    }
  };

  const pvpSessionRef = readSessionRef(pvpRuntime.session);
  const pvpNextSeq = Number((pvpRuntime.session as any)?.session?.action_count?.self || 0) + 1;

  return (
    <div className="akrReactRoot">
      <div className="akrBgAura" />
      <header className="akrTopbar akrGlass">
        <div className="akrBrand">
          <p className="akrKicker">AirdropKralBot</p>
          <h1>{t(lang, "app_title")}</h1>
          <p className="akrMuted">{t(lang, "app_subtitle")}</p>
        </div>
        <div className="akrTopbarActions">
          <button className="akrBtn akrBtnGhost" onClick={() => void refreshBootstrap()}>{t(lang, "refresh")}</button>
          <button className="akrBtn akrBtnGhost" onClick={() => { const next = !advanced; toggleAdvanced(); void syncPrefs({ advanced_view: next }); }}>
            {advanced ? t(lang, "advanced_on") : t(lang, "advanced_off")}
          </button>
          <button className="akrBtn akrBtnGhost" onClick={() => { const next = normalizeLang(lang) === "tr" ? "en" : "tr"; setLang(next); void syncPrefs({ language: next }); }}>
            {t(lang, "language")}: {String(lang).toUpperCase()}
          </button>
          <button className="akrBtn akrBtnAccent" onClick={() => void handleWorkspace(workspace === "player" ? "admin" : "player")}>
            {workspace === "player" ? t(lang, "workspace_admin") : t(lang, "workspace_player")}
          </button>
        </div>
      </header>

      <section className="akrMetaStrip akrGlass">
        <span>{t(lang, "variant")}: {data?.experiment?.variant || "-"}</span>
        <span>{t(lang, "analytics")}: {data?.analytics?.session_ref || "-"}</span>
      </section>

      {workspace === "player" && (
        <>
          <nav className="akrTabs">
            {tabs.map((entry) => (
              <button key={entry} className={`akrTab ${tab === entry ? "isActive" : ""}`} onClick={() => { setTab(entry); void syncPrefs({ last_tab: entry }); }}>
                {tabLabel(lang, entry)}
              </button>
            ))}
          </nav>
          <main className="akrPanelGrid">
            {tab === "home" && <section className="akrCard akrCardWide"><pre className="akrJsonBlock">{JSON.stringify(data || {}, null, 2)}</pre></section>}
            {tab === "pvp" && (
              <section className="akrCard akrCardWide">
                <div className="akrActionRow">
                  <button className="akrBtn akrBtnAccent" onClick={() => void startPvpSessionV2(auth, { action_request_id: buildActionRequestId("pvp_start") }).then((r) => { applySession(r); if (r?.success) setPvpRuntime(r.data || null); })}>{t(lang, "pvp_start")}</button>
                  <button className="akrBtn akrBtnGhost" onClick={() => void fetchPvpSessionStateV2(auth, pvpSessionRef).then((r) => { applySession(r); if (r?.success) setPvpRuntime(r.data || null); })}>{t(lang, "pvp_refresh")}</button>
                  <button className="akrBtn akrBtnGhost" disabled={!pvpSessionRef} onClick={() => void applyPvpSessionActionV2(auth, { session_ref: pvpSessionRef, action_seq: pvpNextSeq, input_action: "strike" }).then((r) => { applySession(r); if (r?.success) setPvpRuntime(r.data || null); })}>Strike</button>
                  <button className="akrBtn akrBtnGhost" disabled={!pvpSessionRef} onClick={() => void resolvePvpSessionV2(auth, { session_ref: pvpSessionRef }).then((r) => { applySession(r); if (r?.success) setPvpRuntime(r.data || null); })}>Resolve</button>
                </div>
                <pre className="akrJsonBlock">{JSON.stringify(pvpRuntime.session || null, null, 2)}</pre>
              </section>
            )}
            {tab === "tasks" && (
              <section className="akrCard akrCardWide">
                <div className="akrActionRow">
                  <button className="akrBtn akrBtnGhost" onClick={() => void runMutation(() => postTasksRerollV2(auth), "tasks_reroll_failed")}>Reroll</button>
                  <button className="akrBtn akrBtnGhost" onClick={() => void runMutation(() => postCompleteActionV2(auth, { mode: "balanced", action_request_id: buildActionRequestId("complete") }), "task_complete_failed")}>Complete</button>
                  <button className="akrBtn akrBtnAccent" onClick={() => void runMutation(() => postRevealActionV2(auth, { action_request_id: buildActionRequestId("reveal") }), "task_reveal_failed")}>Reveal</button>
                </div>
                <ul className="akrList">
                  {((data as any)?.offers || []).map((row: any) => (
                    <li key={`offer_${String(row.id || "")}`}>
                      <strong>{String(row.task_type || "task")}</strong>
                      <button className="akrBtn akrBtnGhost" onClick={() => void runMutation(() => postAcceptActionV2(auth, { offer_id: Number(row.id || 0), action_request_id: buildActionRequestId("accept") }), "task_accept_failed")}>Accept</button>
                    </li>
                  ))}
                </ul>
                <ul className="akrList">
                  {((data?.missions?.list as any[]) || []).map((row: any, idx) => {
                    const key = String(row?.mission_key || row?.key || "");
                    const canClaim = Boolean(row?.completed && !row?.claimed && key);
                    return (
                      <li key={`${idx}_${key}`}>
                        <strong>{String(row?.title || key || "mission")}</strong>
                        {canClaim && <button className="akrBtn akrBtnGhost" onClick={() => void runMutation(() => postClaimMissionV2(auth, { mission_key: key, action_request_id: buildActionRequestId("claim") }), "mission_claim_failed")}>Claim</button>}
                      </li>
                    );
                  })}
                </ul>
                <pre className="akrJsonBlock">{JSON.stringify(taskResult, null, 2)}</pre>
              </section>
            )}
            {tab === "vault" && (
              <section className="akrCard akrCardWide">
                <div className="akrActionRow">
                  <button className="akrBtn akrBtnGhost" onClick={() => void refreshVault()}>Refresh</button>
                  <button className="akrBtn akrBtnGhost" onClick={() => void fetchTokenQuoteV2(auth, { usd: Number(quoteUsd || 0), chain: quoteChain }).then((r) => setVaultData((prev: any) => ({ ...prev, quote: r?.data || null })))}>Quote</button>
                  <button className="akrBtn akrBtnAccent" onClick={() => void postTokenBuyIntentV2(auth, { usd_amount: Number(quoteUsd || 0), chain: quoteChain, action_request_id: buildActionRequestId("buy") }).then((r) => { applySession(r); setVaultData((prev: any) => ({ ...prev, buy: r?.data || null })); })}>Buy Intent</button>
                  <button className="akrBtn akrBtnGhost" onClick={() => void postTokenSubmitTxV2(auth, { request_id: Number(submitRequestId || 0), tx_hash: submitTxHash, action_request_id: buildActionRequestId("submit") }).then((r) => { applySession(r); setVaultData((prev: any) => ({ ...prev, submit: r?.data || null })); })}>Submit Tx</button>
                </div>
                <div className="akrInputRow">
                  <input value={quoteUsd} onChange={(e) => setQuoteUsd(e.target.value)} aria-label="quote-usd" />
                  <input value={quoteChain} onChange={(e) => setQuoteChain(e.target.value)} aria-label="quote-chain" />
                  <input value={submitRequestId} onChange={(e) => setSubmitRequestId(e.target.value)} aria-label="submit-request-id" />
                  <input value={submitTxHash} onChange={(e) => setSubmitTxHash(e.target.value)} aria-label="submit-tx-hash" />
                </div>
                <pre className="akrJsonBlock">{JSON.stringify(vaultData, null, 2)}</pre>
              </section>
            )}
          </main>
        </>
      )}

      {workspace === "admin" && (
        <main className="akrPanelGrid">
          <section className="akrCard akrCardWide">
            <h2>{t(lang, "admin_title")}</h2>
            {!isAdmin && <p className="akrErrorLine">{t(lang, "admin_access_denied")}</p>}
            {isAdmin && (
              <>
                <button className="akrBtn akrBtnGhost" onClick={() => void refreshAdmin()}>{t(lang, "admin_refresh")}</button>
                <pre className="akrJsonBlock">{JSON.stringify(adminRuntime.summary || {}, null, 2)}</pre>
                <div className="akrInputRow">
                  <input value={queueAction.action_key} onChange={(e) => setQueueAction((p: any) => ({ ...p, action_key: e.target.value }))} aria-label="queue-action-key" />
                  <input value={queueAction.kind} onChange={(e) => setQueueAction((p: any) => ({ ...p, kind: e.target.value }))} aria-label="queue-kind" />
                  <input value={queueAction.request_id} onChange={(e) => setQueueAction((p: any) => ({ ...p, request_id: e.target.value }))} aria-label="queue-request-id" />
                  <input value={queueAction.tx_hash} onChange={(e) => setQueueAction((p: any) => ({ ...p, tx_hash: e.target.value }))} aria-label="queue-tx-hash" />
                  <input value={queueAction.reason} onChange={(e) => setQueueAction((p: any) => ({ ...p, reason: e.target.value }))} aria-label="queue-reason" />
                  <input value={queueAction.confirm_token} onChange={(e) => setQueueAction((p: any) => ({ ...p, confirm_token: e.target.value }))} aria-label="queue-confirm-token" />
                </div>
                <button className="akrBtn akrBtnAccent" onClick={() => void runQueueAction()}>Queue Action</button>
                <ul className="akrList">
                  {(adminRuntime.queue || []).slice(0, advanced ? 100 : 25).map((row, idx) => (
                    <li key={`${idx}_${String(row?.request_id || row?.queue_key || "q")}`}>
                      <strong>{String(row?.kind || "request")}</strong>
                      <span>{String(row?.status || "unknown")}</span>
                    </li>
                  ))}
                </ul>
                <pre className="akrJsonBlock">{JSON.stringify(adminPanels, null, 2)}</pre>
              </>
            )}
          </section>
        </main>
      )}

      {loading && <div className="akrToast">{t(lang, "loading")}</div>}
      {error && !loading && <div className="akrToast akrToastError">{t(lang, "error_prefix")}: {error}</div>}

      {onboardingVisible && (
        <div className="akrOnboardingOverlay">
          <div className="akrOnboardingCard">
            <p className="akrKicker">React V1</p>
            <h2>{t(lang, "onboarding_title")}</h2>
            <p>{t(lang, "onboarding_body")}</p>
            <button className="akrBtn akrBtnAccent" onClick={() => { hideOnboarding(); void syncPrefs({ onboarding_completed: true }); }}>{t(lang, "onboarding_continue")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
