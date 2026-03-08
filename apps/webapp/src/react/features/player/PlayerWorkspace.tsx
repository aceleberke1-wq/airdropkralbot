import { Suspense, lazy } from "react";
import type { Lang } from "../../i18n";
import type { BootstrapV2Payload, TabKey } from "../../types";
import { resolveShellActionTarget } from "../../../core/navigation/shellActions.js";
import { usePlayerNavigationController } from "./usePlayerNavigationController";
import { PlayerTabs } from "../shell/PlayerTabs";

const HomePanel = lazy(async () => {
  const mod = await import("../home/HomePanel");
  return { default: mod.HomePanel };
});

const PvpPanel = lazy(async () => {
  const mod = await import("../pvp/PvpPanel");
  return { default: mod.PvpPanel };
});

const PlayerShellPanel = lazy(async () => {
  const mod = await import("./PlayerShellPanel");
  return { default: mod.PlayerShellPanel };
});

const TasksPanel = lazy(async () => {
  const mod = await import("../tasks/TasksPanel");
  return { default: mod.TasksPanel };
});

const VaultPanel = lazy(async () => {
  const mod = await import("../vault/VaultPanel");
  return { default: mod.VaultPanel };
});

type PlayerWorkspaceProps = {
  lang: Lang;
  tab: TabKey;
  tabs: TabKey[];
  advanced: boolean;
  reducedMotion: boolean;
  sceneProfile: {
    qualityMode: string;
    effectiveQuality: string;
    hudDensity: string;
    perfTier: string;
    deviceClass: string;
    sceneProfile: string;
  };
  data: BootstrapV2Payload["data"] | undefined;
  homeFeed: Record<string, unknown> | null;
  pvpRuntime: Record<string, unknown> | null;
  leagueOverview: Record<string, unknown> | null;
  pvpLive: {
    leaderboard: Record<string, unknown> | null;
    diagnostics: Record<string, unknown> | null;
    tick: Record<string, unknown> | null;
  };
  pvpCapabilities: {
    canStart: boolean;
    canRefreshState: boolean;
    canStrike: boolean;
    canResolve: boolean;
  };
  taskResult: Record<string, unknown> | null;
  vaultData: Record<string, unknown> | null;
  quoteUsd: string;
  quoteChain: string;
  submitRequestId: string;
  submitTxHash: string;
  walletChain: string;
  walletAddress: string;
  walletChallengeRef: string;
  walletSignature: string;
  payoutCurrency: string;
  walletChallengeLoading: boolean;
  walletVerifyLoading: boolean;
  walletUnlinkLoading: boolean;
  payoutRequestLoading: boolean;
  passPurchaseLoading: boolean;
  cosmeticPurchaseLoading: boolean;
  trackUiEvent: (payload: Record<string, unknown>) => void;
  onTabChange: (next: TabKey) => void;
  onToggleReducedMotion: (next: boolean) => void;
  onToggleLargeText: (next: boolean) => void;
  onToggleLanguage: (next: Lang) => void;
  onRefreshHome: () => void;
  onPvpStart: () => void;
  onPvpRefreshState: () => void;
  onPvpRefreshLeague: () => void;
  onPvpRefreshLive: () => void;
  onPvpStrike: () => void;
  onPvpResolve: () => void;
  onTasksReroll: () => void;
  onTaskComplete: () => void;
  onTaskReveal: () => void;
  onTaskAccept: (offerId: number) => void;
  onMissionClaim: (missionKey: string) => void;
  onVaultRefresh: () => void;
  onTokenQuote: () => void;
  onTokenBuyIntent: () => void;
  onTokenSubmitTx: () => void;
  onWalletChallenge: () => void;
  onWalletVerify: () => void;
  onWalletUnlink: () => void;
  onPayoutRequest: () => void;
  onPassPurchase: (passKey: string, paymentCurrency: string) => void;
  onCosmeticPurchase: (itemKey: string, paymentCurrency: string) => void;
  onQuoteUsdChange: (value: string) => void;
  onQuoteChainChange: (value: string) => void;
  onSubmitRequestIdChange: (value: string) => void;
  onSubmitTxHashChange: (value: string) => void;
  onWalletChainChange: (value: string) => void;
  onWalletAddressChange: (value: string) => void;
  onWalletChallengeRefChange: (value: string) => void;
  onWalletSignatureChange: (value: string) => void;
  onPayoutCurrencyChange: (value: string) => void;
};

function PlayerPanelFallback(props: { label: string }) {
  return (
    <section className="akrCard akrCardWide">
      <p className="akrKicker">{props.label}</p>
      <h3>Loading panel</h3>
      <p className="akrMuted">Active district surface is streaming in.</p>
    </section>
  );
}

export function PlayerWorkspace(props: PlayerWorkspaceProps) {
  const { activePanelKey, activeFocusKey, closePanel, routeToTarget } = usePlayerNavigationController({
    tab: props.tab,
    reducedMotion: props.reducedMotion,
    onTabChange: props.onTabChange,
    trackUiEvent: props.trackUiEvent
  });
  const runShellAction = (actionKey: string, sourcePanelKey = "") => {
    const target = resolveShellActionTarget(actionKey);
    if (!target || target.workspace !== "player") {
      return;
    }
    routeToTarget({
      routeKey: target.route_key,
      panelKey: target.panel_key,
      focusKey: target.focus_key,
      tab: target.tab,
      actionKey: target.action_key,
      sourcePanelKey
    });
  };

  return (
    <>
      <PlayerTabs lang={props.lang} tab={props.tab} tabs={props.tabs} onChange={props.onTabChange} />
      <main className="akrPanelGrid">
        {(props.tab === "home" || props.tab === "vault") && activePanelKey ? (
          <Suspense fallback={<PlayerPanelFallback label="shell" />}>
            <PlayerShellPanel
              lang={props.lang}
              panelKey={activePanelKey}
              focusKey={activeFocusKey}
              data={props.data || null}
              sceneProfile={props.sceneProfile}
              homeFeed={props.homeFeed}
              vaultData={props.vaultData}
              onClose={closePanel}
              onShellAction={runShellAction}
              onTabChange={props.onTabChange}
              onRouteTarget={routeToTarget}
              onToggleReducedMotion={props.onToggleReducedMotion}
              onToggleLargeText={props.onToggleLargeText}
              onToggleLanguage={props.onToggleLanguage}
            />
          </Suspense>
        ) : null}
        {props.tab === "home" && (
          <Suspense fallback={<PlayerPanelFallback label="home" />}>
            <HomePanel
              lang={props.lang}
              advanced={props.advanced}
              homeFeed={props.homeFeed}
              data={props.data}
              onRefresh={props.onRefreshHome}
              onShellAction={runShellAction}
              onRouteTarget={routeToTarget}
            />
          </Suspense>
        )}
        {props.tab === "pvp" && (
          <Suspense fallback={<PlayerPanelFallback label="pvp" />}>
            <PvpPanel
              lang={props.lang}
              advanced={props.advanced}
              pvpRuntime={props.pvpRuntime}
              leagueOverview={props.leagueOverview}
              liveLeaderboard={props.pvpLive.leaderboard}
              liveDiagnostics={props.pvpLive.diagnostics}
              liveTick={props.pvpLive.tick}
              canStart={props.pvpCapabilities.canStart}
              canRefreshState={props.pvpCapabilities.canRefreshState}
              canStrike={props.pvpCapabilities.canStrike}
              canResolve={props.pvpCapabilities.canResolve}
              onStart={props.onPvpStart}
              onRefreshState={props.onPvpRefreshState}
              onRefreshLeague={props.onPvpRefreshLeague}
              onRefreshLive={props.onPvpRefreshLive}
              onStrike={props.onPvpStrike}
              onResolve={props.onPvpResolve}
              onShellAction={runShellAction}
            />
          </Suspense>
        )}
        {props.tab === "tasks" && (
          <Suspense fallback={<PlayerPanelFallback label="tasks" />}>
            <TasksPanel
              lang={props.lang}
              advanced={props.advanced}
              offers={((props.data as any)?.offers || []) as Array<Record<string, unknown>>}
              missions={((props.data?.missions?.list as any[]) || []) as Array<Record<string, unknown>>}
              attempts={(props.data?.attempts as Record<string, unknown> | null) || null}
              daily={(props.data?.daily as Record<string, unknown> | null) || null}
              taskResult={props.taskResult}
              onReroll={props.onTasksReroll}
              onComplete={props.onTaskComplete}
              onReveal={props.onTaskReveal}
              onAccept={props.onTaskAccept}
              onClaim={props.onMissionClaim}
              onShellAction={runShellAction}
            />
          </Suspense>
        )}
        {props.tab === "vault" && (
          <Suspense fallback={<PlayerPanelFallback label="vault" />}>
            <VaultPanel
              lang={props.lang}
              advanced={props.advanced}
              vaultData={props.vaultData}
              quoteUsd={props.quoteUsd}
              quoteChain={props.quoteChain}
              submitRequestId={props.submitRequestId}
              submitTxHash={props.submitTxHash}
              walletChain={props.walletChain}
              walletAddress={props.walletAddress}
              walletChallengeRef={props.walletChallengeRef}
              walletSignature={props.walletSignature}
              payoutCurrency={props.payoutCurrency}
              onRefresh={props.onVaultRefresh}
              onQuote={props.onTokenQuote}
              onBuyIntent={props.onTokenBuyIntent}
              onSubmitTx={props.onTokenSubmitTx}
              onWalletChallenge={props.onWalletChallenge}
              onWalletVerify={props.onWalletVerify}
              onWalletUnlink={props.onWalletUnlink}
              onPayoutRequest={props.onPayoutRequest}
              onPassPurchase={props.onPassPurchase}
              onCosmeticPurchase={props.onCosmeticPurchase}
              walletChallengeLoading={props.walletChallengeLoading}
              walletVerifyLoading={props.walletVerifyLoading}
              walletUnlinkLoading={props.walletUnlinkLoading}
              payoutRequestLoading={props.payoutRequestLoading}
              passPurchaseLoading={props.passPurchaseLoading}
              cosmeticPurchaseLoading={props.cosmeticPurchaseLoading}
              onShellAction={runShellAction}
              onQuoteUsdChange={props.onQuoteUsdChange}
              onQuoteChainChange={props.onQuoteChainChange}
              onSubmitRequestIdChange={props.onSubmitRequestIdChange}
              onSubmitTxHashChange={props.onSubmitTxHashChange}
              onWalletChainChange={props.onWalletChainChange}
              onWalletAddressChange={props.onWalletAddressChange}
              onWalletChallengeRefChange={props.onWalletChallengeRefChange}
              onWalletSignatureChange={props.onWalletSignatureChange}
              onPayoutCurrencyChange={props.onPayoutCurrencyChange}
            />
          </Suspense>
        )}
      </main>
    </>
  );
}
