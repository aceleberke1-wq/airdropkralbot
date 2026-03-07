"use strict";

function escapeMarkdown(value) {
  return String(value || "").replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

function normalizeTrustMessageLanguage(lang = "tr") {
  return String(lang || "tr").toLowerCase().startsWith("en") ? "en" : "tr";
}

function formatTokenDecisionUpdate(request, options = {}) {
  const lang = normalizeTrustMessageLanguage(options.lang);
  const decision = String(options.decision || request?.status || "updated").trim().toLowerCase();
  const symbol = escapeMarkdown(String(request?.token_symbol || options.tokenSymbol || "NXT").toUpperCase());
  const chain = escapeMarkdown(String(request?.chain || "-").toUpperCase());
  const tokenAmount = Number(request?.token_amount || 0).toFixed(4);
  const usdAmount = Number(request?.usd_amount || 0).toFixed(2);
  const txHash = String(options.txHash || request?.tx_hash || "").trim();
  const reviewNote = String(options.reason || request?.admin_note || "").trim();
  const requestId = Number(request?.id || 0);
  const statusLabel =
    decision === "approved"
      ? lang === "en"
        ? "approved"
        : "onaylandi"
      : decision === "rejected"
        ? lang === "en"
          ? "rejected"
          : "reddedildi"
        : escapeMarkdown(decision || "updated");
  if (lang === "en") {
    return (
      `*Token Treasury Update*\n` +
      `Request: *#${requestId}*\n` +
      `Status: *${statusLabel}*\n` +
      `Delivery: *${tokenAmount} ${symbol}*\n` +
      `Payment: *${usdAmount} USD*\n` +
      `Chain: *${chain}*` +
      (txHash ? `\nTX: \`${escapeMarkdown(txHash)}\`` : "") +
      (reviewNote ? `\nReview note: *${escapeMarkdown(reviewNote)}*` : "") +
      `\n\n` +
      (decision === "approved"
        ? "Balance credit is recorded. Open Wallet Panel for the live balance and Support for proof."
        : "This token request is closed. Open Support if you need the next safe step.")
    );
  }
  return (
    `*Token Treasury Guncellemesi*\n` +
    `Talep: *#${requestId}*\n` +
    `Durum: *${statusLabel}*\n` +
    `Teslim: *${tokenAmount} ${symbol}*\n` +
    `Odeme: *${usdAmount} USD*\n` +
    `Zincir: *${chain}*` +
    (txHash ? `\nTX: \`${escapeMarkdown(txHash)}\`` : "") +
    (reviewNote ? `\nInceleme notu: *${escapeMarkdown(reviewNote)}*` : "") +
    `\n\n` +
    (decision === "approved"
      ? "Bakiye kredisi kaydedildi. Canli bakiye icin Wallet Paneli, proof icin Destek panelini ac."
      : "Bu token talebi kapatildi. Sonraki guvenli adim icin Destek panelini ac.")
  );
}

function formatPayoutDecisionUpdate(request, options = {}) {
  const lang = normalizeTrustMessageLanguage(options.lang);
  const decision = String(options.decision || request?.status || "updated").trim().toLowerCase();
  const currency = escapeMarkdown(String(request?.currency || "BTC").toUpperCase());
  const amount = Number(request?.amount || 0).toFixed(8);
  const txHash = String(options.txHash || request?.tx_hash || "").trim();
  const reviewNote = String(options.reason || request?.admin_note || "").trim();
  const requestId = Number(request?.id || 0);
  const statusLabel =
    decision === "paid"
      ? lang === "en"
        ? "paid"
        : "odendi"
      : decision === "rejected"
        ? lang === "en"
          ? "rejected"
          : "reddedildi"
        : escapeMarkdown(decision || "updated");
  if (lang === "en") {
    return (
      `*Payout Update*\n` +
      `Request: *#${requestId}*\n` +
      `Status: *${statusLabel}*\n` +
      `Amount: *${amount} ${currency}*` +
      (txHash ? `\nTX: \`${escapeMarkdown(txHash)}\`` : "") +
      (reviewNote ? `\nReview note: *${escapeMarkdown(reviewNote)}*` : "") +
      `\n\n` +
      (decision === "paid"
        ? "Transfer proof is recorded. Open the Payout Screen for status and Support for follow-up."
        : "This payout request is closed. Open Support if you need the next safe step.")
    );
  }
  return (
    `*Cekim Guncellemesi*\n` +
    `Talep: *#${requestId}*\n` +
    `Durum: *${statusLabel}*\n` +
    `Miktar: *${amount} ${currency}*` +
    (txHash ? `\nTX: \`${escapeMarkdown(txHash)}\`` : "") +
    (reviewNote ? `\nInceleme notu: *${escapeMarkdown(reviewNote)}*` : "") +
    `\n\n` +
    (decision === "paid"
      ? "Transfer proof kaydedildi. Durum icin Payout ekranini, takip icin Destek panelini ac."
      : "Bu cekim talebi kapatildi. Sonraki guvenli adim icin Destek panelini ac.")
  );
}

module.exports = {
  escapeMarkdown,
  normalizeTrustMessageLanguage,
  formatTokenDecisionUpdate,
  formatPayoutDecisionUpdate
};
