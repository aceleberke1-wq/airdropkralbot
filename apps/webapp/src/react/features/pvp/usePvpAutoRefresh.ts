import { useEffect, useRef } from "react";

type PvpAutoRefreshOptions = {
  enabled: boolean;
  sessionRef: string;
  refreshIntervalMs: number;
  shouldRefreshNow: boolean;
  authUid: string;
  authTs: string;
  authSig: string;
  onRefreshLive: (sessionRef: string) => void | Promise<void>;
  onRefreshLeague: () => void | Promise<void>;
};

export function usePvpAutoRefresh(options: PvpAutoRefreshOptions) {
  const liveRefreshRef = useRef(options.onRefreshLive);
  const leagueRefreshRef = useRef(options.onRefreshLeague);

  useEffect(() => {
    liveRefreshRef.current = options.onRefreshLive;
    leagueRefreshRef.current = options.onRefreshLeague;
  }, [options.onRefreshLive, options.onRefreshLeague]);

  useEffect(() => {
    if (!options.enabled) {
      return;
    }
    let turn = 0;
    if (options.shouldRefreshNow) {
      void liveRefreshRef.current(options.sessionRef);
    }
    const intervalMs = Math.max(2500, Number(options.refreshIntervalMs || 9000));
    const timer = window.setInterval(() => {
      turn += 1;
      void liveRefreshRef.current(options.sessionRef);
      if (turn % 3 === 0) {
        void leagueRefreshRef.current();
      }
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [
    options.enabled,
    options.sessionRef,
    options.refreshIntervalMs,
    options.shouldRefreshNow,
    options.authUid,
    options.authTs,
    options.authSig
  ]);
}
