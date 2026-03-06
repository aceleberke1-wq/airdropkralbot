import { useCallback } from "react";
import { fetchTokenRouteStatusV2, fetchTokenSummaryV2 } from "../../api";
import { UI_EVENT_KEY, UI_FUNNEL_KEY, UI_SURFACE_KEY } from "../../../core/telemetry/uiEventTaxonomy";
import type { WebAppApiResponse, WebAppAuth } from "../../types";

type RefetchableQuery = {
  refetch: () => Promise<any>;
};

type VaultRefreshControllerOptions = {
  hasActiveAuth: boolean;
  activeAuth: WebAppAuth;
  trackUiEvent: (payload: Record<string, unknown>) => void;
  applySession: (payload: any) => void;
  setVaultData: (updater: (prev: any) => any) => void;
  vaultOverviewQuery: RefetchableQuery;
  monetizationOverviewQuery: RefetchableQuery;
  walletSessionQuery: RefetchableQuery;
  payoutStatusQuery: RefetchableQuery;
};

export function useVaultRefreshController(options: VaultRefreshControllerOptions) {
  const refreshVault = useCallback(async () => {
    if (!options.hasActiveAuth) return;
    options.trackUiEvent({
      event_key: UI_EVENT_KEY.REFRESH_REQUEST,
      panel_key: UI_SURFACE_KEY.PANEL_VAULT,
      funnel_key: UI_FUNNEL_KEY.VAULT_LOOP,
      surface_key: UI_SURFACE_KEY.PANEL_VAULT,
      payload_json: { target: "vault_overview" }
    });
    const [overviewRefetch, summary, route, monetizationRefetch, walletRefetch, payoutRefetch] = await Promise.all([
      options.vaultOverviewQuery.refetch().catch(() => null),
      fetchTokenSummaryV2(options.activeAuth).catch(() => null),
      fetchTokenRouteStatusV2(options.activeAuth).catch(() => null),
      options.monetizationOverviewQuery.refetch().catch(() => null),
      options.walletSessionQuery.refetch().catch(() => null),
      options.payoutStatusQuery.refetch().catch(() => null)
    ]);
    const overview = (overviewRefetch?.data || null) as WebAppApiResponse | null;
    const monetization = (monetizationRefetch?.data || null) as WebAppApiResponse | null;
    const wallet = (walletRefetch?.data || null) as WebAppApiResponse | null;
    const payout = (payoutRefetch?.data || null) as WebAppApiResponse | null;
    options.applySession(summary);
    options.setVaultData((prev: any) => ({
      ...prev,
      overview: overview?.data || null,
      summary: summary?.data || null,
      route: route?.data || null,
      monetization: monetization?.data || null,
      wallet: wallet?.data || null,
      payout: payout?.data || null
    }));
    options.trackUiEvent({
      event_key:
        overview?.success || monetization?.success ? UI_EVENT_KEY.REFRESH_SUCCESS : UI_EVENT_KEY.REFRESH_FAILED,
      panel_key: UI_SURFACE_KEY.PANEL_VAULT,
      funnel_key: UI_FUNNEL_KEY.VAULT_LOOP,
      surface_key: UI_SURFACE_KEY.PANEL_VAULT,
      payload_json: {
        target: "vault_overview",
        overview_success: Boolean(overview?.success),
        monetization_success: Boolean(monetization?.success),
        wallet_success: Boolean(wallet?.success),
        payout_success: Boolean(payout?.success)
      }
    });
  }, [options]);

  return {
    refreshVault
  };
}
