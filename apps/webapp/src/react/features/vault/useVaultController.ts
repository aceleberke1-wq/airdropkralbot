import { useCallback } from "react";
import type { WebAppAuth } from "../../types";
import { buildActionRequestId } from "../../api";
import { UI_ECONOMY_EVENT_KEY, UI_FUNNEL_KEY, UI_SURFACE_KEY } from "../../../core/telemetry/uiEventTaxonomy";
import type { RunRetriableApiCall } from "../shared/useRetriableAction";

type MutationRunner = (payload: Record<string, unknown>) => { unwrap: () => Promise<any> };

type VaultControllerOptions = {
  activeAuth: WebAppAuth;
  quoteUsd: string;
  quoteChain: string;
  submitRequestId: string;
  submitTxHash: string;
  walletChain: string;
  walletAddress: string;
  walletChallengeRef: string;
  walletSignature: string;
  payoutCurrency: string;
  runRetriableApiCall: RunRetriableApiCall;
  setError: (next: string) => void;
  setVaultData: (updater: (prev: any) => any) => void;
  setWalletChallengeRef: (next: string) => void;
  refreshVault: () => Promise<void> | void;
  loadTokenQuote: MutationRunner;
  tokenBuyIntent: MutationRunner;
  tokenSubmitTx: MutationRunner;
  walletChallenge: MutationRunner;
  walletVerify: MutationRunner;
  walletUnlink: MutationRunner;
  payoutRequest: MutationRunner;
  monetizationPassPurchase: MutationRunner;
  monetizationCosmeticPurchase: MutationRunner;
};

export function useVaultController(options: VaultControllerOptions) {
  const handleTokenQuote = useCallback(async () => {
    const payload = await options.runRetriableApiCall(
      async () =>
        options.loadTokenQuote({
          auth: options.activeAuth,
          usd: Number(options.quoteUsd || 0),
          chain: options.quoteChain
        }).unwrap(),
      "token_quote_failed",
      {
        maxAttempts: 2,
        baseDelayMs: 140,
        telemetry: {
          panelKey: UI_SURFACE_KEY.PANEL_VAULT,
          funnelKey: UI_FUNNEL_KEY.TOKEN_REVENUE,
          surfaceKey: UI_SURFACE_KEY.PANEL_VAULT,
          economyEventKey: UI_ECONOMY_EVENT_KEY.TOKEN_QUOTE,
          actionKey: "token_quote",
          txState: "quote"
        }
      }
    );
    if (!payload?.success) return;
    options.setVaultData((prev: any) => ({ ...prev, quote: payload.data || null }));
  }, [options]);

  const handleTokenBuyIntent = useCallback(async () => {
    const actionRequestId = buildActionRequestId("buy");
    const payload = await options.runRetriableApiCall(
      async () =>
        options.tokenBuyIntent({
          auth: options.activeAuth,
          usd_amount: Number(options.quoteUsd || 0),
          chain: options.quoteChain,
          action_request_id: actionRequestId
        }).unwrap(),
      "token_buy_intent_failed",
      {
        maxAttempts: 3,
        baseDelayMs: 200,
        telemetry: {
          panelKey: UI_SURFACE_KEY.PANEL_VAULT,
          funnelKey: UI_FUNNEL_KEY.TOKEN_REVENUE,
          surfaceKey: UI_SURFACE_KEY.PANEL_VAULT,
          economyEventKey: UI_ECONOMY_EVENT_KEY.TOKEN_BUY_INTENT,
          actionKey: "token_buy_intent",
          txState: "intent"
        }
      }
    );
    if (!payload?.success) return;
    options.setVaultData((prev: any) => ({ ...prev, buy: payload.data || null }));
    await options.refreshVault();
  }, [options]);

  const handleTokenSubmitTx = useCallback(async () => {
    const actionRequestId = buildActionRequestId("submit");
    const payload = await options.runRetriableApiCall(
      async () =>
        options.tokenSubmitTx({
          auth: options.activeAuth,
          request_id: Number(options.submitRequestId || 0),
          tx_hash: options.submitTxHash,
          action_request_id: actionRequestId
        }).unwrap(),
      "token_submit_failed",
      {
        maxAttempts: 3,
        baseDelayMs: 220,
        telemetry: {
          panelKey: UI_SURFACE_KEY.PANEL_VAULT,
          funnelKey: UI_FUNNEL_KEY.TOKEN_REVENUE,
          surfaceKey: UI_SURFACE_KEY.PANEL_VAULT,
          economyEventKey: UI_ECONOMY_EVENT_KEY.TOKEN_SUBMIT_TX,
          actionKey: "token_submit_tx",
          txState: "submit"
        }
      }
    );
    if (!payload?.success) return;
    options.setVaultData((prev: any) => ({ ...prev, submit: payload.data || null }));
    await options.refreshVault();
  }, [options]);

  const handleWalletChallenge = useCallback(async () => {
    const chain = String(options.walletChain || "").trim().toUpperCase();
    const address = String(options.walletAddress || "").trim();
    if (!chain || !address) {
      options.setError("wallet_input_missing");
      return;
    }
    const payload = await options.runRetriableApiCall(
      async () =>
        options.walletChallenge({
          auth: options.activeAuth,
          chain,
          address,
          statement: "AirdropKralBot wallet link challenge"
        }).unwrap(),
      "wallet_challenge_failed",
      {
        maxAttempts: 2,
        baseDelayMs: 180,
        telemetry: {
          panelKey: UI_SURFACE_KEY.PANEL_VAULT,
          funnelKey: UI_FUNNEL_KEY.VAULT_LOOP,
          surfaceKey: UI_SURFACE_KEY.PANEL_VAULT,
          actionKey: "wallet_challenge",
          txState: "challenge"
        }
      }
    );
    if (!payload?.success) return;
    const payloadData = (payload.data as Record<string, unknown> | undefined) || {};
    const challenge = (payloadData.challenge as Record<string, unknown> | undefined) || null;
    const challengeRef = String((challenge?.challenge_ref as string | undefined) || "").trim();
    if (challengeRef) {
      options.setWalletChallengeRef(challengeRef);
    }
    options.setVaultData((prev: any) => ({
      ...prev,
      wallet_challenge: challenge
    }));
  }, [options]);

  const handleWalletVerify = useCallback(async () => {
    const chain = String(options.walletChain || "").trim().toUpperCase();
    const address = String(options.walletAddress || "").trim();
    const challengeRef = String(options.walletChallengeRef || "").trim();
    const signature = String(options.walletSignature || "").trim();
    if (!chain || !address || !challengeRef || !signature) {
      options.setError("wallet_verify_input_missing");
      return;
    }
    const payload = await options.runRetriableApiCall(
      async () =>
        options.walletVerify({
          auth: options.activeAuth,
          challenge_ref: challengeRef,
          chain,
          address,
          signature
        }).unwrap(),
      "wallet_verify_failed",
      {
        maxAttempts: 2,
        baseDelayMs: 180,
        telemetry: {
          panelKey: UI_SURFACE_KEY.PANEL_VAULT,
          funnelKey: UI_FUNNEL_KEY.VAULT_LOOP,
          surfaceKey: UI_SURFACE_KEY.PANEL_VAULT,
          actionKey: "wallet_verify",
          txState: "verify"
        }
      }
    );
    if (!payload?.success) return;
    const payloadData = (payload.data as Record<string, unknown> | undefined) || {};
    options.setVaultData((prev: any) => ({
      ...prev,
      wallet_verify: payloadData,
      wallet: payloadData
    }));
    await options.refreshVault();
  }, [options]);

  const handleWalletUnlink = useCallback(async () => {
    const chain = String(options.walletChain || "").trim().toUpperCase();
    const address = String(options.walletAddress || "").trim();
    const payload = await options.runRetriableApiCall(
      async () =>
        options.walletUnlink({
          auth: options.activeAuth,
          chain: chain || undefined,
          address: address || undefined,
          reason: "user_requested_unlink"
        }).unwrap(),
      "wallet_unlink_failed",
      {
        maxAttempts: 2,
        baseDelayMs: 180,
        telemetry: {
          panelKey: UI_SURFACE_KEY.PANEL_VAULT,
          funnelKey: UI_FUNNEL_KEY.VAULT_LOOP,
          surfaceKey: UI_SURFACE_KEY.PANEL_VAULT,
          actionKey: "wallet_unlink",
          txState: "unlink"
        }
      }
    );
    if (!payload?.success) return;
    const payloadData = (payload.data as Record<string, unknown> | undefined) || {};
    options.setVaultData((prev: any) => ({
      ...prev,
      wallet_unlink: payloadData,
      wallet: payloadData
    }));
    await options.refreshVault();
  }, [options]);

  const handlePayoutRequest = useCallback(async () => {
    const currency = String(options.payoutCurrency || "BTC").trim().toUpperCase() || "BTC";
    const payload = await options.runRetriableApiCall(
      async () =>
        options.payoutRequest({
          auth: options.activeAuth,
          currency
        }).unwrap(),
      "payout_request_failed",
      {
        maxAttempts: 3,
        baseDelayMs: 200,
        telemetry: {
          panelKey: UI_SURFACE_KEY.PANEL_VAULT,
          funnelKey: UI_FUNNEL_KEY.VAULT_LOOP,
          surfaceKey: UI_SURFACE_KEY.PANEL_VAULT,
          economyEventKey: UI_ECONOMY_EVENT_KEY.PAYOUT_REQUEST,
          actionKey: "payout_request",
          txState: "request"
        }
      }
    );
    if (!payload?.success) return;
    const payloadData = (payload.data as Record<string, unknown> | undefined) || {};
    options.setVaultData((prev: any) => ({
      ...prev,
      payout_request: payloadData,
      payout: payloadData
    }));
    await options.refreshVault();
  }, [options]);

  const handlePassPurchase = useCallback(
    async (passKey: string, paymentCurrency?: string) => {
      const safePassKey = String(passKey || "").trim();
      if (!safePassKey) return;
      const purchaseRef = buildActionRequestId("pass_purchase");
      const payload = await options.runRetriableApiCall(
        async () =>
          options.monetizationPassPurchase({
            auth: options.activeAuth,
            pass_key: safePassKey,
            payment_currency: paymentCurrency ? String(paymentCurrency).toUpperCase() : undefined,
            purchase_ref: purchaseRef
          }).unwrap(),
        "pass_purchase_failed",
        {
          maxAttempts: 3,
          baseDelayMs: 220,
          telemetry: {
            panelKey: UI_SURFACE_KEY.PANEL_VAULT,
            funnelKey: UI_FUNNEL_KEY.TOKEN_REVENUE,
            surfaceKey: UI_SURFACE_KEY.PANEL_VAULT,
            economyEventKey: UI_ECONOMY_EVENT_KEY.PASS_PURCHASE,
            actionKey: "monetization_pass_purchase",
            txState: "purchase"
          }
        }
      );
      if (!payload?.success) return;
      const payloadData = (payload.data as Record<string, unknown> | undefined) || {};
      options.setVaultData((prev: any) => ({
        ...prev,
        pass_purchase: (payloadData.purchase as Record<string, unknown> | undefined) || null,
        monetization: (payloadData.monetization as Record<string, unknown> | undefined) || prev?.monetization || null
      }));
      await options.refreshVault();
    },
    [options]
  );

  const handleCosmeticPurchase = useCallback(
    async (itemKey: string, paymentCurrency?: string) => {
      const safeItemKey = String(itemKey || "").trim();
      if (!safeItemKey) return;
      const purchaseRef = buildActionRequestId("cosmetic_purchase");
      const payload = await options.runRetriableApiCall(
        async () =>
          options.monetizationCosmeticPurchase({
            auth: options.activeAuth,
            item_key: safeItemKey,
            payment_currency: paymentCurrency ? String(paymentCurrency).toUpperCase() : undefined,
            purchase_ref: purchaseRef
          }).unwrap(),
        "cosmetic_purchase_failed",
        {
          maxAttempts: 3,
          baseDelayMs: 220,
          telemetry: {
            panelKey: UI_SURFACE_KEY.PANEL_VAULT,
            funnelKey: UI_FUNNEL_KEY.TOKEN_REVENUE,
            surfaceKey: UI_SURFACE_KEY.PANEL_VAULT,
            economyEventKey: UI_ECONOMY_EVENT_KEY.COSMETIC_PURCHASE,
            actionKey: "monetization_cosmetic_purchase",
            txState: "purchase"
          }
        }
      );
      if (!payload?.success) return;
      const payloadData = (payload.data as Record<string, unknown> | undefined) || {};
      options.setVaultData((prev: any) => ({
        ...prev,
        cosmetic_purchase: (payloadData.purchase as Record<string, unknown> | undefined) || null,
        monetization: (payloadData.monetization as Record<string, unknown> | undefined) || prev?.monetization || null
      }));
      await options.refreshVault();
    },
    [options]
  );

  return {
    handleTokenQuote,
    handleTokenBuyIntent,
    handleTokenSubmitTx,
    handleWalletChallenge,
    handleWalletVerify,
    handleWalletUnlink,
    handlePayoutRequest,
    handlePassPurchase,
    handleCosmeticPurchase
  };
}
