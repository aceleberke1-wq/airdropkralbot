import { useEffect, useMemo, useRef } from "react";
import {
  fetchAdminBootstrapV2,
  fetchAdminUnifiedQueueV2,
  fetchBootstrapV2,
  fetchPvpSessionState,
  startPvpSession
} from "./api";
import { createUiAnalyticsClient, type UiAnalyticsClient } from "./analytics";
import { normalizeLang, t, tabLabel } from "./i18n";
import { useReactShellStore } from "./store";
import type { BootstrapV2Payload, TabKey, WebAppAuth } from "./types";
import "./styles.css";

type ReactWebAppV1Props = {
  auth: WebAppAuth;
  bootstrap: BootstrapV2Payload;
};

function safeNum(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function shortTime(iso: string): string {
  if (!iso) {
    return "-";
  }
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) {
    return "-";
  }
  return d.toLocaleTimeString();
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
    if (!data) {
      return;
    }
    const analytics = createUiAnalyticsClient({
      auth,
      config: data.analytics || {
        session_ref: `react_${Date.now()}`,
        flush_interval_ms: 6000,
        max_batch_size: 40,
        sample_rate: 1
      },
      language: normalizeLang(lang),
      variantKey: data.experiment?.variant === "treatment" ? "treatment" : "control",
      experimentKey: String(data.experiment?.key || "webapp_react_v1"),
      cohortBucket: Math.max(0, Math.min(99, Number(data.experiment?.cohort_bucket || 0))),
      tabKey: tab,
      routeKey: `${workspace}_${tab}`
    });
    analytics.track({
      event_key: "react_shell_open",
      panel_key: "shell",
      event_value: 1
    });
    analyticsRef.current = analytics;
    return () => {
      analytics.dispose();
      analyticsRef.current = null;
    };
  }, [auth, data, lang, tab, workspace]);

  const isAdmin = Boolean(data?.admin?.is_admin);
  const tabs = useMemo<TabKey[]>(
    () => (Array.isArray(data?.ui_shell?.tabs) && data?.ui_shell?.tabs.length ? data.ui_shell.tabs : ["home", "pvp", "tasks", "vault"]),
    [data?.ui_shell?.tabs]
  );

  const refreshBootstrap = async () => {
    if (!auth.uid || !auth.ts || !auth.sig) {
      return;
    }
    setLoading(true);
    setError("");
    analyticsRef.current?.track({ event_key: "refresh_click", panel_key: "topbar", event_value: 1 });
    const payload = await fetchBootstrapV2(auth, normalizeLang(lang));
    if (!payload.success || !payload.data) {
      setError(String(payload.error || "bootstrap_failed"));
      setLoading(false);
      return;
    }
    if (payload.session?.uid && payload.session?.ts && payload.session?.sig) {
      setAuth({
        uid: String(payload.session.uid),
        ts: String(payload.session.ts),
        sig: String(payload.session.sig)
      });
    }
    setBootstrap(payload.data);
  };

  const handleTab = (nextTab: TabKey) => {
    setTab(nextTab);
    analyticsRef.current?.setContext({
      tabKey: nextTab,
      routeKey: `${workspace}_${nextTab}`
    });
    analyticsRef.current?.track({
      event_key: "tab_open",
      tab_key: nextTab,
      panel_key: `${workspace}_tab`,
      event_value: 1
    });
  };

  const handleLangToggle = () => {
    const next = normalizeLang(lang) === "tr" ? "en" : "tr";
    setLang(next);
    analyticsRef.current?.track({
      event_key: "lang_toggle",
      panel_key: "topbar",
      event_value: next === "en" ? 1 : 0
    });
  };

  const handleWorkspace = async (next: "player" | "admin") => {
    setWorkspace(next);
    analyticsRef.current?.setContext({
      routeKey: `${next}_${tab}`
    });
    analyticsRef.current?.track({
      event_key: "workspace_switch",
      panel_key: "workspace",
      event_value: next === "admin" ? 1 : 0
    });
    if (next === "admin" && isAdmin) {
      const [summaryPayload, queuePayload] = await Promise.all([
        fetchAdminBootstrapV2(auth),
        fetchAdminUnifiedQueueV2(auth, 60)
      ]);
      setAdminRuntime(summaryPayload?.data || null, queuePayload?.data?.items || []);
    }
  };

  const handlePvpStart = async () => {
    analyticsRef.current?.track({
      event_key: "pvp_start_click",
      tab_key: "pvp",
      panel_key: "pvp_actions",
      event_value: 1
    });
    await startPvpSession(auth).catch(() => null);
    const state = await fetchPvpSessionState(auth).catch(() => null);
    setPvpRuntime(state?.data?.session || null);
  };

  const handlePvpRefresh = async () => {
    analyticsRef.current?.track({
      event_key: "pvp_refresh_click",
      tab_key: "pvp",
      panel_key: "pvp_actions",
      event_value: 1
    });
    const state = await fetchPvpSessionState(auth).catch(() => null);
    setPvpRuntime(state?.data?.session || null);
  };

  const profile = data?.profile || {};
  const balances = data?.balances || {};
  const season = data?.season || {};
  const daily = data?.daily || {};

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
          <button className="akrBtn akrBtnGhost" onClick={refreshBootstrap}>
            {t(lang, "refresh")}
          </button>
          <button className="akrBtn akrBtnGhost" onClick={toggleAdvanced}>
            {advanced ? t(lang, "advanced_on") : t(lang, "advanced_off")}
          </button>
          <button className="akrBtn akrBtnGhost" onClick={handleLangToggle}>
            {t(lang, "language")}: {String(lang).toUpperCase()}
          </button>
          <button className="akrBtn akrBtnAccent" onClick={() => void handleWorkspace(workspace === "player" ? "admin" : "player")}>
            {workspace === "player" ? t(lang, "workspace_admin") : t(lang, "workspace_player")}
          </button>
        </div>
      </header>

      <section className="akrMetaStrip akrGlass">
        <span>{t(lang, "variant")}: {data?.experiment?.variant || "control"}</span>
        <span>{t(lang, "analytics")}: {data?.analytics?.session_ref || "-"}</span>
        <span>
          {t(lang, "quality")}: {String(data?.ui_prefs?.quality_mode || "auto").toUpperCase()}
        </span>
      </section>

      {workspace === "player" && (
        <>
          <nav className="akrTabs">
            {tabs.map((entry) => (
              <button
                key={entry}
                className={`akrTab ${tab === entry ? "isActive" : ""}`}
                onClick={() => handleTab(entry)}
              >
                {tabLabel(lang, entry)}
              </button>
            ))}
          </nav>

          <main className="akrPanelGrid">
            {tab === "home" && (
              <section className="akrCard akrCardWide">
                <h2>{t(lang, "home_overview")}</h2>
                <p className="akrHeroName">{String(profile.public_name || "Kral")}</p>
                <p className="akrMuted">
                  Tier {String(profile.kingdom_tier || "-")} | Streak {safeNum(profile.current_streak)}
                </p>
                <div className="akrChipRow">
                  <span className="akrChip">SC {safeNum(balances.SC).toFixed(0)}</span>
                  <span className="akrChip">HC {safeNum(balances.HC).toFixed(0)}</span>
                  <span className="akrChip">RC {safeNum(balances.RC).toFixed(0)}</span>
                  <span className="akrChip">NXT {safeNum(balances.NXT).toFixed(0)}</span>
                </div>
                <div className="akrSplit">
                  <div>
                    <h3>{t(lang, "home_season")}</h3>
                    <p className="akrValue">S{safeNum(season.season_id)} · {safeNum(season.days_left)}d</p>
                    <p className="akrMuted">SP {safeNum(season.points).toFixed(0)}</p>
                  </div>
                  <div>
                    <h3>{t(lang, "home_daily")}</h3>
                    <p className="akrValue">{safeNum(daily.tasks_done)} / {safeNum(daily.daily_cap)}</p>
                    <p className="akrMuted">
                      {safeNum(daily.sc_earned)} SC · {safeNum(daily.rc_earned)} RC
                    </p>
                  </div>
                </div>
              </section>
            )}

            {tab === "pvp" && (
              <section className="akrCard akrCardWide">
                <h2>{t(lang, "pvp_title")}</h2>
                <p className="akrMuted">Realtime state source: authoritative API</p>
                <div className="akrActionRow">
                  <button className="akrBtn akrBtnAccent" onClick={() => void handlePvpStart()}>
                    {t(lang, "pvp_start")}
                  </button>
                  <button className="akrBtn akrBtnGhost" onClick={() => void handlePvpRefresh()}>
                    {t(lang, "pvp_refresh")}
                  </button>
                </div>
                <pre className="akrJsonBlock">{JSON.stringify(pvpRuntime.session || data?.pvp_content || {}, null, 2)}</pre>
              </section>
            )}

            {tab === "tasks" && (
              <section className="akrCard akrCardWide">
                <h2>{t(lang, "tasks_title")}</h2>
                <p className="akrMuted">
                  Ready {safeNum(data?.missions?.ready)} / Total {safeNum(data?.missions?.total)}
                </p>
                <ul className="akrList">
                  {(data?.missions?.list || []).slice(0, advanced ? 20 : 8).map((row: any, idx) => (
                    <li key={`${idx}_${String(row?.key || row?.task_key || "task")}`}>
                      <strong>{String(row?.title || row?.task_key || row?.id || "task")}</strong>
                      <span>{String(row?.status || row?.state || "open")}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {tab === "vault" && (
              <section className="akrCard akrCardWide">
                <h2>{t(lang, "vault_title")}</h2>
                <pre className="akrJsonBlock">{JSON.stringify({ token: data?.token || {}, payout_lock: data?.payout_lock || {} }, null, 2)}</pre>
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
                <button className="akrBtn akrBtnGhost" onClick={() => void handleWorkspace("admin")}>
                  {t(lang, "admin_refresh")}
                </button>
                <p className="akrMuted">Updated: {shortTime(adminRuntime.updatedAt)}</p>
                <pre className="akrJsonBlock">{JSON.stringify(adminRuntime.summary || data?.admin?.summary || {}, null, 2)}</pre>
              </>
            )}
          </section>
          {isAdmin && (
            <section className="akrCard akrCardWide">
              <h3>Unified Queue</h3>
              <ul className="akrList">
                {(adminRuntime.queue || []).slice(0, advanced ? 100 : 20).map((row, idx) => (
                  <li key={`${idx}_${String(row?.queue_key || row?.request_id || "row")}`}>
                    <strong>{String(row?.kind || "-")} #{safeNum(row?.request_id).toFixed(0)}</strong>
                    <span>{String(row?.status || "pending")}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </main>
      )}

      {loading && <div className="akrToast">{t(lang, "loading")}</div>}
      {error && !loading && (
        <div className="akrToast akrToastError">
          {t(lang, "error_prefix")}: {error}
        </div>
      )}

      {onboardingVisible && (
        <div className="akrOnboardingOverlay">
          <div className="akrOnboardingCard">
            <p className="akrKicker">React V1</p>
            <h2>{t(lang, "onboarding_title")}</h2>
            <p>{t(lang, "onboarding_body")}</p>
            <ol>
              <li>{t(lang, "onboarding_step_1")}</li>
              <li>{t(lang, "onboarding_step_2")}</li>
              <li>{t(lang, "onboarding_step_3")}</li>
            </ol>
            <button
              className="akrBtn akrBtnAccent"
              onClick={() => {
                hideOnboarding();
                analyticsRef.current?.track({
                  event_key: "onboarding_complete",
                  panel_key: "onboarding",
                  event_value: 1
                });
              }}
            >
              {t(lang, "onboarding_continue")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
