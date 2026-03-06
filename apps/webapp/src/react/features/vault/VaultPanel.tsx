import { buildVaultViewModel } from "../../../core/player/vaultViewModel.js";
import { t, type Lang } from "../../i18n";

type VaultPanelProps = {
  lang: Lang;
  advanced: boolean;
  vaultData: Record<string, unknown>;
  quoteUsd: string;
  quoteChain: string;
  submitRequestId: string;
  submitTxHash: string;
  walletChain: string;
  walletAddress: string;
  walletChallengeRef: string;
  walletSignature: string;
  payoutCurrency: string;
  onRefresh: () => void;
  onQuote: () => void;
  onBuyIntent: () => void;
  onSubmitTx: () => void;
  onWalletChallenge: () => void;
  onWalletVerify: () => void;
  onWalletUnlink: () => void;
  onPayoutRequest: () => void;
  onPassPurchase: (passKey: string, paymentCurrency?: string) => void;
  onCosmeticPurchase: (itemKey: string, paymentCurrency?: string) => void;
  walletChallengeLoading: boolean;
  walletVerifyLoading: boolean;
  walletUnlinkLoading: boolean;
  payoutRequestLoading: boolean;
  passPurchaseLoading: boolean;
  cosmeticPurchaseLoading: boolean;
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

export function VaultPanel(props: VaultPanelProps) {
  const view = buildVaultViewModel({
    vaultData: props.vaultData
  });
  const summary = view.summary;
  const catalog = view.catalog;
  const latest = view.latest;

  return (
    <section className="akrCard akrCardWide">
      <div className="akrActionRow">
        <button className="akrBtn akrBtnGhost" onClick={props.onRefresh}>
          {t(props.lang, "vault_refresh")}
        </button>
        <button className="akrBtn akrBtnGhost" onClick={props.onQuote}>
          {t(props.lang, "vault_quote")}
        </button>
        <button className="akrBtn akrBtnAccent" onClick={props.onBuyIntent}>
          {t(props.lang, "vault_buy_intent")}
        </button>
        <button className="akrBtn akrBtnGhost" onClick={props.onSubmitTx}>
          {t(props.lang, "vault_submit_tx")}
        </button>
      </div>
      <div className="akrChipRow">
        <span className="akrChip">{summary.token_symbol || "-"}</span>
        <span className="akrChip">{summary.token_chain || "-"}</span>
        <span className="akrChip">Bal {Math.floor(summary.token_balance)}</span>
        <span className="akrChip">Price ${summary.token_price_usd.toFixed(4)}</span>
        <span className="akrChip">{summary.wallet_active ? "wallet_on" : "wallet_off"}</span>
        <span className="akrChip">{summary.wallet_chain || "-"}</span>
        <span className="akrChip">{summary.wallet_kyc_status || "-"}</span>
      </div>
      <div className="akrInputRow">
        <input value={props.quoteUsd} onChange={(e) => props.onQuoteUsdChange(e.target.value)} aria-label="quote-usd" />
        <input value={props.quoteChain} onChange={(e) => props.onQuoteChainChange(e.target.value)} aria-label="quote-chain" />
        <input
          value={props.submitRequestId}
          onChange={(e) => props.onSubmitRequestIdChange(e.target.value)}
          aria-label="submit-request-id"
        />
        <input value={props.submitTxHash} onChange={(e) => props.onSubmitTxHashChange(e.target.value)} aria-label="submit-tx-hash" />
      </div>

      <div className="akrSplit">
        <section className="akrMiniPanel">
          <h4>{t(props.lang, "vault_wallet_title")}</h4>
          <div className="akrChipRow">
            <span className="akrChip">{summary.wallet_active ? "active" : "inactive"}</span>
            <span className="akrChip">{summary.wallet_chain || "-"}</span>
            <span className="akrChip">{summary.wallet_kyc_status || "-"}</span>
          </div>
          <p className="akrMuted">{summary.wallet_address_masked || "-"}</p>
          <div className="akrInputRow">
            <input
              value={props.walletChain}
              onChange={(e) => props.onWalletChainChange(e.target.value)}
              aria-label="wallet-chain"
            />
            <input
              value={props.walletAddress}
              onChange={(e) => props.onWalletAddressChange(e.target.value)}
              aria-label="wallet-address"
            />
            <input
              value={props.walletChallengeRef}
              onChange={(e) => props.onWalletChallengeRefChange(e.target.value)}
              aria-label="wallet-challenge-ref"
            />
            <input
              value={props.walletSignature}
              onChange={(e) => props.onWalletSignatureChange(e.target.value)}
              aria-label="wallet-signature"
            />
          </div>
          <div className="akrActionRow">
            <button className="akrBtn akrBtnGhost" disabled={props.walletChallengeLoading} onClick={props.onWalletChallenge}>
              {t(props.lang, "vault_wallet_challenge")}
            </button>
            <button className="akrBtn akrBtnAccent" disabled={props.walletVerifyLoading} onClick={props.onWalletVerify}>
              {t(props.lang, "vault_wallet_verify")}
            </button>
            <button className="akrBtn akrBtnGhost" disabled={props.walletUnlinkLoading} onClick={props.onWalletUnlink}>
              {t(props.lang, "vault_wallet_unlink")}
            </button>
          </div>
          <h4>{t(props.lang, "vault_route_title")}</h4>
          <div className="akrChipRow">
            <span className="akrChip">{summary.route_status || "-"}</span>
            <span className="akrChip">Total {Math.floor(summary.route_total)}</span>
            <span className="akrChip">OK {Math.floor(summary.route_ok)}</span>
            <span className="akrChip">Pending {Math.floor(summary.route_pending)}</span>
            <span className="akrChip">Failed {Math.floor(summary.route_failed)}</span>
          </div>
        </section>

        <section className="akrMiniPanel">
          <h4>{t(props.lang, "vault_payout_title")}</h4>
          <div className="akrChipRow">
            <span className="akrChip">{summary.payout_can_request ? "can_request" : "locked"}</span>
            <span className="akrChip">{summary.payout_unlock_tier || "-"}</span>
            <span className="akrChip">Progress {Math.floor(summary.payout_unlock_progress * 100)}%</span>
            <span className="akrChip">Req {summary.payout_requestable_btc.toFixed(8)} BTC</span>
            <span className="akrChip">Entitled {summary.payout_entitled_btc.toFixed(8)} BTC</span>
          </div>
          <div className="akrInputRow">
            <input
              value={props.payoutCurrency}
              onChange={(e) => props.onPayoutCurrencyChange(e.target.value)}
              aria-label="payout-currency"
            />
          </div>
          <div className="akrActionRow">
            <button className="akrBtn akrBtnAccent" disabled={props.payoutRequestLoading} onClick={props.onPayoutRequest}>
              {t(props.lang, "vault_payout_request")}
            </button>
          </div>
          <h4>{t(props.lang, "vault_monetization_title")}</h4>
          <div className="akrChipRow">
            <span className="akrChip">{summary.monetization_enabled ? "enabled" : "disabled"}</span>
            <span className="akrChip">{summary.monetization_tables_available ? "tables_ready" : "tables_missing"}</span>
            <span className="akrChip">{summary.premium_active ? "premium" : "standard"}</span>
            <span className="akrChip">Pass {Math.floor(summary.active_pass_count)}</span>
            <span className="akrChip">Pass History {Math.floor(summary.pass_history_count)}</span>
            <span className="akrChip">Owned Cosmetics {Math.floor(summary.cosmetics_owned_count)}</span>
            <span className="akrChip">Recent Cosmetics {Math.floor(summary.cosmetics_recent_count)}</span>
            <span className="akrChip">SC {Math.floor(summary.spend_sc)}</span>
            <span className="akrChip">RC {Math.floor(summary.spend_rc)}</span>
            <span className="akrChip">HC {Math.floor(summary.spend_hc)}</span>
          </div>
        </section>
      </div>
      <div className="akrSplit">
        <section className="akrMiniPanel">
          <h4>{t(props.lang, "vault_pass_catalog_title")}</h4>
          {catalog.passes.length ? (
            <ul className="akrList">
              {catalog.passes.map((row) => (
                <li key={`pass_${row.pass_key}`}>
                  <strong>
                    {row.title} ({row.duration_days}d)
                  </strong>
                  <span>
                    {row.price_amount} {row.price_currency}
                    <button
                      className="akrBtn akrBtnAccent"
                      disabled={props.passPurchaseLoading}
                      onClick={() => props.onPassPurchase(row.pass_key, row.price_currency)}
                    >
                      {t(props.lang, "vault_purchase_pass")}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="akrMuted">{t(props.lang, "vault_catalog_empty")}</p>
          )}
        </section>
        <section className="akrMiniPanel">
          <h4>{t(props.lang, "vault_cosmetic_catalog_title")}</h4>
          {catalog.cosmetics.length ? (
            <ul className="akrList">
              {catalog.cosmetics.map((row) => (
                <li key={`cosmetic_${row.item_key}`}>
                  <strong>
                    {row.title} ({row.rarity})
                  </strong>
                  <span>
                    {row.price_amount} {row.price_currency}
                    <button
                      className="akrBtn akrBtnAccent"
                      disabled={props.cosmeticPurchaseLoading}
                      onClick={() => props.onCosmeticPurchase(row.item_key, row.price_currency)}
                    >
                      {t(props.lang, "vault_purchase_cosmetic")}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="akrMuted">{t(props.lang, "vault_catalog_empty")}</p>
          )}
        </section>
      </div>

      <section className="akrMiniPanel">
        <h4>{t(props.lang, "vault_last_tx_title")}</h4>
        <div className="akrChipRow">
          <span className="akrChip">Quote USD {latest.quote_usd.toFixed(2)}</span>
          <span className="akrChip">Quote Token {latest.quote_token_amount.toFixed(4)}</span>
          <span className="akrChip">Rate {latest.quote_rate.toFixed(6)}</span>
          <span className="akrChip">Intent #{Math.floor(latest.intent_request_id)}</span>
          <span className="akrChip">{latest.intent_status || "-"}</span>
          <span className="akrChip">Submit #{Math.floor(latest.submit_request_id)}</span>
          <span className="akrChip">{latest.submit_status || "-"}</span>
          <span className="akrChip">Pass {latest.pass_purchase_key || "-"}</span>
          <span className="akrChip">
            {latest.pass_purchase_amount.toFixed(2)} {latest.pass_purchase_currency || "-"}
          </span>
          <span className="akrChip">{latest.pass_purchase_status || "-"}</span>
          <span className="akrChip">Cosmetic {latest.cosmetic_purchase_key || "-"}</span>
          <span className="akrChip">
            {latest.cosmetic_purchase_amount.toFixed(2)} {latest.cosmetic_purchase_currency || "-"}
          </span>
          <span className="akrChip">{latest.cosmetic_purchase_rarity || "-"}</span>
          <span className="akrChip">Payout #{Math.floor(latest.payout_request_id)}</span>
          <span className="akrChip">{latest.payout_request_status || "-"}</span>
        </div>
        <p className="akrMuted">
          {latest.submit_tx_hash || "-"} | {latest.pass_purchase_ref || "-"} | {latest.cosmetic_purchase_ref || "-"} |{" "}
          {latest.payout_request_ref || "-"}
        </p>
      </section>

      {!view.has_data ? <p className="akrMuted">{t(props.lang, "vault_empty")}</p> : null}

      {props.advanced ? <pre className="akrJsonBlock">{JSON.stringify(props.vaultData || {}, null, 2)}</pre> : null}
    </section>
  );
}
