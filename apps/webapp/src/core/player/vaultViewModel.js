function asRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toNum(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function toBool(value) {
  return Boolean(value);
}

function computeRouteStats(routePayload) {
  const route = asRecord(routePayload);
  const routes = asArray(route.routes || route.items || route.path);
  let pending = 0;
  let ok = 0;
  let failed = 0;
  for (const row of routes) {
    const status = toText(asRecord(row).status || "").toLowerCase();
    if (["ok", "success", "completed"].includes(status)) {
      ok += 1;
      continue;
    }
    if (["failed", "error", "rejected"].includes(status)) {
      failed += 1;
      continue;
    }
    pending += 1;
  }
  return {
    total: routes.length,
    ok,
    failed,
    pending
  };
}

function normalizePassCatalog(rows) {
  return asArray(rows)
    .slice(0, 12)
    .map((row) => {
      const item = asRecord(row);
      return {
        pass_key: toText(item.pass_key || ""),
        title: toText(item.title || item.title_tr || item.title_en || item.pass_key || "pass"),
        duration_days: Math.max(1, toNum(item.duration_days || 1)),
        price_amount: Math.max(0, toNum(item.price_amount || 0)),
        price_currency: toText(item.price_currency || "SC"),
        effects: asRecord(item.effects)
      };
    })
    .filter((row) => Boolean(row.pass_key));
}

function normalizeCosmeticCatalog(rows) {
  return asArray(rows)
    .slice(0, 24)
    .map((row) => {
      const item = asRecord(row);
      return {
        item_key: toText(item.item_key || ""),
        title: toText(item.title || item.title_tr || item.title_en || item.item_key || "cosmetic"),
        category: toText(item.category || "cosmetic"),
        rarity: toText(item.rarity || "common"),
        price_amount: Math.max(0, toNum(item.price_amount || 0)),
        price_currency: toText(item.price_currency || "SC")
      };
    })
    .filter((row) => Boolean(row.item_key));
}

export function buildVaultViewModel(input = {}) {
  const root = asRecord(input.vaultData);
  const overview = asRecord(root.overview);
  const monetizationOverview = asRecord(root.monetization);
  const monetizationCatalog = asRecord(monetizationOverview.catalog);
  const monetizationOverviewStatus = asRecord(monetizationOverview.status);
  const tokenSummary = asRecord(overview.token_summary || root.summary || {});
  const routeStatus = asRecord(overview.route_status || root.route || {});
  const payoutPayload = asRecord(root.payout);
  const walletPayload = asRecord(root.wallet);
  const payoutStatus = asRecord(overview.payout_status || payoutPayload);
  const walletSession = asRecord(overview.wallet_session || walletPayload.wallet_session || walletPayload);
  const monetizationStatus = asRecord(overview.monetization_status || monetizationOverviewStatus || {});
  const playerEffects = asRecord(monetizationStatus.player_effects || monetizationOverview.active_effects || {});
  const spendSummary = asRecord(monetizationStatus.spend_summary || {});
  const cosmetics = asRecord(monetizationOverviewStatus.cosmetics || monetizationStatus.cosmetics || {});
  const activePasses = asArray(monetizationOverviewStatus.active_passes || monetizationStatus.active_passes);
  const passHistory = asArray(monetizationOverviewStatus.pass_history);
  const passCatalog = normalizePassCatalog(monetizationCatalog.pass_catalog);
  const cosmeticCatalog = normalizeCosmeticCatalog(monetizationCatalog.cosmetic_catalog);
  const quote = asRecord(root.quote);
  const buy = asRecord(root.buy);
  const submit = asRecord(root.submit);
  const payoutRequest = asRecord(root.payout_request);
  const passPurchase = asRecord(root.pass_purchase);
  const cosmeticPurchase = asRecord(root.cosmetic_purchase);
  const routeStats = computeRouteStats(routeStatus);

  const canRequestPayout =
    toBool(payoutStatus.can_request) || Math.max(0, toNum(payoutStatus.requestable_btc || payoutStatus.available_btc || 0)) > 0;

  return {
    summary: {
      token_symbol: toText(tokenSummary.symbol || tokenSummary.token_symbol || ""),
      token_chain: toText(tokenSummary.chain || ""),
      token_balance: Math.max(0, toNum(tokenSummary.balance || tokenSummary.amount || 0)),
      token_price_usd: Math.max(0, toNum(tokenSummary.price_usd || tokenSummary.quote_usd || tokenSummary.unit_price_usd || 0)),
      payout_can_request: canRequestPayout,
      payout_unlock_tier: toText(payoutStatus.unlock_tier || ""),
      payout_unlock_progress: Math.max(0, toNum(payoutStatus.unlock_progress || 0)),
      payout_requestable_btc: Math.max(0, toNum(payoutStatus.requestable_btc || 0)),
      payout_entitled_btc: Math.max(0, toNum(payoutStatus.entitled_btc || 0)),
      wallet_active: toBool(walletSession.active),
      wallet_chain: toText(walletSession.chain || ""),
      wallet_address_masked: toText(walletSession.address_masked || walletSession.address || ""),
      wallet_kyc_status: toText(walletSession.kyc_status || "unknown"),
      route_status: toText(routeStatus.status || routeStatus.phase || ""),
      route_total: routeStats.total,
      route_ok: routeStats.ok,
      route_failed: routeStats.failed,
      route_pending: routeStats.pending,
      monetization_enabled: toBool(monetizationStatus.enabled),
      monetization_tables_available: toBool(monetizationStatus.tables_available),
      active_pass_count: Math.max(
        0,
        toNum(monetizationStatus.active_pass_count || activePasses.length || asArray(monetizationStatus.active_passes).length || 0)
      ),
      pass_history_count: Math.max(0, passHistory.length),
      cosmetics_owned_count: Math.max(0, toNum(cosmetics.owned_count || 0)),
      cosmetics_recent_count: Math.max(0, asArray(cosmetics.recent).length),
      premium_active: toBool(playerEffects.premium_active),
      spend_sc: Math.max(0, toNum(spendSummary.SC || spendSummary.sc || 0)),
      spend_hc: Math.max(0, toNum(spendSummary.HC || spendSummary.hc || 0)),
      spend_rc: Math.max(0, toNum(spendSummary.RC || spendSummary.rc || 0))
    },
    catalog: {
      passes: passCatalog,
      cosmetics: cosmeticCatalog
    },
    latest: {
      quote_usd: Math.max(0, toNum(quote.usd || quote.usd_amount || quote.requested_usd || 0)),
      quote_token_amount: Math.max(
        0,
        toNum(quote.token_amount || quote.amount_out || quote.quote_token_amount || quote.expected_token_amount || 0)
      ),
      quote_rate: Math.max(0, toNum(quote.rate || quote.price || quote.unit_price || 0)),
      intent_request_id: Math.max(0, toNum(buy.request_id || buy.intent_request_id || 0)),
      intent_status: toText(buy.status || buy.state || ""),
      submit_request_id: Math.max(0, toNum(submit.request_id || submit.intent_request_id || 0)),
      submit_status: toText(submit.status || submit.tx_state || submit.route_status || ""),
      submit_tx_hash: toText(submit.tx_hash || submit.hash || ""),
      pass_purchase_key: toText(passPurchase.pass_key || ""),
      pass_purchase_ref: toText(passPurchase.purchase_ref || ""),
      pass_purchase_amount: Math.max(0, toNum(passPurchase.price_amount || 0)),
      pass_purchase_currency: toText(passPurchase.price_currency || ""),
      pass_purchase_status: toText(passPurchase.status || ""),
      cosmetic_purchase_key: toText(cosmeticPurchase.item_key || ""),
      cosmetic_purchase_ref: toText(cosmeticPurchase.purchase_ref || ""),
      cosmetic_purchase_amount: Math.max(0, toNum(cosmeticPurchase.amount_paid || 0)),
      cosmetic_purchase_currency: toText(cosmeticPurchase.currency || ""),
      cosmetic_purchase_rarity: toText(cosmeticPurchase.rarity || ""),
      payout_request_id: Math.max(0, toNum(payoutRequest.request_id || payoutStatus.latest_request_id || 0)),
      payout_request_status: toText(payoutRequest.status || payoutStatus.status || ""),
      payout_request_ref: toText(payoutRequest.request_ref || "")
    },
    has_data: Boolean(Object.keys(root).length)
  };
}
