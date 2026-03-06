"use strict";

function requireDependency(deps, key, type = "function") {
  const value = deps[key];
  if (type === "function" && typeof value !== "function") {
    throw new Error(`registerWebappV2MonetizationRoutes requires ${key}`);
  }
  if (type === "object" && (!value || typeof value !== "object")) {
    throw new Error(`registerWebappV2MonetizationRoutes requires ${key}`);
  }
  return value;
}

function registerWebappV2MonetizationRoutes(fastify, deps = {}) {
  const pool = requireDependency(deps, "pool", "object");
  const verifyWebAppAuth = requireDependency(deps, "verifyWebAppAuth", "function");
  const issueWebAppSession = requireDependency(deps, "issueWebAppSession", "function");
  const normalizeLanguage = requireDependency(deps, "normalizeLanguage", "function");
  const getProfileByTelegram = requireDependency(deps, "getProfileByTelegram", "function");
  const loadFeatureFlags = requireDependency(deps, "loadFeatureFlags", "function");
  const buildMonetizationSummary = requireDependency(deps, "buildMonetizationSummary", "function");
  const getFreezeState = requireDependency(deps, "getFreezeState", "function");
  const isFeatureEnabled = requireDependency(deps, "isFeatureEnabled", "function");
  const hasMonetizationTables = requireDependency(deps, "hasMonetizationTables", "function");
  const ensureDefaultPassProducts = requireDependency(deps, "ensureDefaultPassProducts", "function");
  const getPassProductForUpdate = requireDependency(deps, "getPassProductForUpdate", "function");
  const normalizeMonetizationCurrency = requireDependency(deps, "normalizeMonetizationCurrency", "function");
  const toPositiveNumber = requireDependency(deps, "toPositiveNumber", "function");
  const deterministicUuid = requireDependency(deps, "deterministicUuid", "function");
  const economyStore = requireDependency(deps, "economyStore", "object");
  const insertUserPassPurchase = requireDependency(deps, "insertUserPassPurchase", "function");
  const shopStore = requireDependency(deps, "shopStore", "object");
  const riskStore = requireDependency(deps, "riskStore", "object");
  const mapUserPassView = requireDependency(deps, "mapUserPassView", "function");
  const getCosmeticCatalogItem = requireDependency(deps, "getCosmeticCatalogItem", "function");
  const insertCosmeticPurchase = requireDependency(deps, "insertCosmeticPurchase", "function");
  const mapCosmeticPurchaseView = requireDependency(deps, "mapCosmeticPurchaseView", "function");
  const requireWebAppAdmin = requireDependency(deps, "requireWebAppAdmin", "function");

  if (typeof economyStore.debitCurrency !== "function" || typeof economyStore.getBalances !== "function") {
    throw new Error("registerWebappV2MonetizationRoutes requires economyStore.debitCurrency and economyStore.getBalances");
  }
  if (typeof shopStore.addOrExtendEffect !== "function") {
    throw new Error("registerWebappV2MonetizationRoutes requires shopStore.addOrExtendEffect");
  }
  if (typeof riskStore.insertBehaviorEvent !== "function") {
    throw new Error("registerWebappV2MonetizationRoutes requires riskStore.insertBehaviorEvent");
  }

  fastify.get("/webapp/api/v2/monetization/catalog", async (request, reply) => {
    const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
    if (!auth.ok) {
      reply.code(401).send({ success: false, error: auth.reason });
      return;
    }
    const lang = normalizeLanguage(String(request.query.lang || "tr"), "tr");
    const client = await pool.connect();
    try {
      const profile = await getProfileByTelegram(client, auth.uid);
      if (!profile) {
        reply.code(404).send({ success: false, error: "user_not_started" });
        return;
      }
      const featureFlags = await loadFeatureFlags(client);
      const summary = await buildMonetizationSummary(client, {
        featureFlags,
        userId: profile.user_id,
        lang
      });
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: {
          api_version: "v2",
          language: lang,
          enabled: Boolean(summary.enabled),
          tables_available: Boolean(summary.tables_available),
          pass_catalog: Array.isArray(summary.pass_catalog) ? summary.pass_catalog : [],
          cosmetic_catalog: Array.isArray(summary.cosmetic_catalog) ? summary.cosmetic_catalog : [],
          player_effects: summary.player_effects || {
            premium_active: false,
            sc_boost_multiplier: 0,
            season_bonus_multiplier: 0
          },
          active_pass_count: Array.isArray(summary.active_passes) ? summary.active_passes.length : 0,
          updated_at: summary.updated_at || new Date().toISOString()
        }
      });
    } catch (err) {
      if (err.code === "42P01") {
        reply.code(503).send({ success: false, error: "monetization_tables_missing" });
        return;
      }
      throw err;
    } finally {
      client.release();
    }
  });

  fastify.get("/webapp/api/v2/monetization/status", async (request, reply) => {
    const auth = verifyWebAppAuth(request.query.uid, request.query.ts, request.query.sig);
    if (!auth.ok) {
      reply.code(401).send({ success: false, error: auth.reason });
      return;
    }
    const lang = normalizeLanguage(String(request.query.lang || "tr"), "tr");
    const client = await pool.connect();
    try {
      const profile = await getProfileByTelegram(client, auth.uid);
      if (!profile) {
        reply.code(404).send({ success: false, error: "user_not_started" });
        return;
      }
      const featureFlags = await loadFeatureFlags(client);
      const summary = await buildMonetizationSummary(client, {
        featureFlags,
        userId: profile.user_id,
        lang
      });
      reply.send({
        success: true,
        session: issueWebAppSession(auth.uid),
        data: {
          api_version: "v2",
          language: lang,
          monetization: summary
        }
      });
    } catch (err) {
      if (err.code === "42P01") {
        reply.code(503).send({ success: false, error: "monetization_tables_missing" });
        return;
      }
      throw err;
    } finally {
      client.release();
    }
  });

  fastify.post(
    "/webapp/api/v2/monetization/pass/purchase",
    {
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig", "pass_key"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            pass_key: { type: "string", minLength: 3, maxLength: 64 },
            payment_currency: { type: "string", minLength: 2, maxLength: 8 },
            purchase_ref: { type: "string", minLength: 6, maxLength: 120 }
          }
        }
      }
    },
    async (request, reply) => {
      const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
      if (!auth.ok) {
        reply.code(401).send({ success: false, error: auth.reason });
        return;
      }
      const passKey = String(request.body.pass_key || "").trim().toLowerCase();
      if (!passKey) {
        reply.code(400).send({ success: false, error: "pass_key_invalid" });
        return;
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const profile = await getProfileByTelegram(client, auth.uid);
        if (!profile) {
          await client.query("ROLLBACK");
          reply.code(404).send({ success: false, error: "user_not_started" });
          return;
        }
        const freeze = await getFreezeState(client);
        if (freeze.freeze) {
          await client.query("ROLLBACK");
          reply.code(409).send({ success: false, error: "freeze_mode", reason: freeze.reason });
          return;
        }
        const featureFlags = await loadFeatureFlags(client);
        if (!isFeatureEnabled(featureFlags, "MONETIZATION_CORE_V1_ENABLED")) {
          await client.query("ROLLBACK");
          reply.code(409).send({ success: false, error: "monetization_feature_disabled" });
          return;
        }
        const tables = await hasMonetizationTables(client);
        if (!tables.all) {
          await client.query("ROLLBACK");
          reply.code(503).send({ success: false, error: "monetization_tables_missing" });
          return;
        }

        await ensureDefaultPassProducts(client);
        const product = await getPassProductForUpdate(client, passKey);
        if (!product || product.active === false) {
          await client.query("ROLLBACK");
          reply.code(404).send({ success: false, error: "pass_product_not_found" });
          return;
        }
        const productCurrency = normalizeMonetizationCurrency(product.price_currency, "SC");
        const paymentCurrency = normalizeMonetizationCurrency(request.body.payment_currency || productCurrency, productCurrency);
        if (paymentCurrency !== productCurrency) {
          await client.query("ROLLBACK");
          reply.code(409).send({ success: false, error: "pass_currency_mismatch" });
          return;
        }
        const priceAmount = toPositiveNumber(product.price_amount, 0);
        if (priceAmount <= 0) {
          await client.query("ROLLBACK");
          reply.code(409).send({ success: false, error: "pass_price_invalid" });
          return;
        }

        const purchaseRefInput = String(request.body.purchase_ref || "").trim();
        const purchaseRef =
          purchaseRefInput ||
          deterministicUuid(`v5_pass_purchase:${profile.user_id}:${passKey}:${Date.now()}:${Math.random()}`);
        const debit = await economyStore.debitCurrency(client, {
          userId: profile.user_id,
          currency: paymentCurrency,
          amount: priceAmount,
          reason: "v5_pass_purchase",
          refEventId: deterministicUuid(`v5_pass_debit:${purchaseRef}`),
          meta: {
            source: "webapp",
            pass_key: passKey,
            purchase_ref: purchaseRef
          }
        });
        if (!debit.applied) {
          await client.query("ROLLBACK");
          if (debit.reason === "insufficient_balance") {
            reply.code(409).send({ success: false, error: "insufficient_balance" });
            return;
          }
          reply.code(409).send({ success: false, error: debit.reason || "pass_debit_failed" });
          return;
        }

        const effects = product.effects_json && typeof product.effects_json === "object" ? product.effects_json : {};
        const durationDays = Math.max(1, Number(product.duration_days || 1));
        const purchase = await insertUserPassPurchase(client, {
          user_id: profile.user_id,
          pass_key: passKey,
          duration_days: durationDays,
          purchase_ref: purchaseRef,
          payload_json: {
            source: "webapp",
            pass_key: passKey,
            price_amount: priceAmount,
            price_currency: paymentCurrency,
            effects
          }
        });

        await shopStore.addOrExtendEffect(client, {
          userId: profile.user_id,
          effectKey: String(effects.effect_key || "premium_pass"),
          level: 1,
          durationHours: durationDays * 24,
          meta: {
            ...effects,
            pass_key: passKey,
            purchase_ref: purchaseRef
          }
        });

        await riskStore.insertBehaviorEvent(client, profile.user_id, "webapp_pass_purchase", {
          pass_key: passKey,
          purchase_ref: purchaseRef,
          price_amount: priceAmount,
          price_currency: paymentCurrency
        }).catch((err) => {
          if (err.code !== "42P01") {
            throw err;
          }
        });

        const monetization = await buildMonetizationSummary(client, {
          featureFlags,
          userId: profile.user_id,
          lang: request.body.lang || "tr"
        });
        const balances = await economyStore.getBalances(client, profile.user_id);
        await client.query("COMMIT");
        reply.send({
          success: true,
          session: issueWebAppSession(auth.uid),
          data: {
            api_version: "v2",
            purchase: mapUserPassView(purchase),
            balances,
            monetization
          }
        });
      } catch (err) {
        await client.query("ROLLBACK");
        if (err.code === "42P01") {
          reply.code(503).send({ success: false, error: "monetization_tables_missing" });
          return;
        }
        if (err.code === "23505") {
          reply.code(409).send({ success: false, error: "idempotency_conflict" });
          return;
        }
        throw err;
      } finally {
        client.release();
      }
    }
  );

  fastify.post(
    "/webapp/api/v2/monetization/cosmetic/purchase",
    {
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig", "item_key"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            item_key: { type: "string", minLength: 3, maxLength: 96 },
            payment_currency: { type: "string", minLength: 2, maxLength: 8 },
            purchase_ref: { type: "string", minLength: 6, maxLength: 120 }
          }
        }
      }
    },
    async (request, reply) => {
      const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
      if (!auth.ok) {
        reply.code(401).send({ success: false, error: auth.reason });
        return;
      }
      const itemKey = String(request.body.item_key || "").trim().toLowerCase();
      if (!itemKey) {
        reply.code(400).send({ success: false, error: "item_key_invalid" });
        return;
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const profile = await getProfileByTelegram(client, auth.uid);
        if (!profile) {
          await client.query("ROLLBACK");
          reply.code(404).send({ success: false, error: "user_not_started" });
          return;
        }
        const freeze = await getFreezeState(client);
        if (freeze.freeze) {
          await client.query("ROLLBACK");
          reply.code(409).send({ success: false, error: "freeze_mode", reason: freeze.reason });
          return;
        }
        const featureFlags = await loadFeatureFlags(client);
        if (!isFeatureEnabled(featureFlags, "MONETIZATION_CORE_V1_ENABLED")) {
          await client.query("ROLLBACK");
          reply.code(409).send({ success: false, error: "monetization_feature_disabled" });
          return;
        }
        const tables = await hasMonetizationTables(client);
        if (!tables.all) {
          await client.query("ROLLBACK");
          reply.code(503).send({ success: false, error: "monetization_tables_missing" });
          return;
        }

        const item = getCosmeticCatalogItem(itemKey);
        if (!item) {
          await client.query("ROLLBACK");
          reply.code(404).send({ success: false, error: "cosmetic_item_not_found" });
          return;
        }
        const productCurrency = normalizeMonetizationCurrency(item.price_currency, "SC");
        const paymentCurrency = normalizeMonetizationCurrency(request.body.payment_currency || productCurrency, productCurrency);
        if (paymentCurrency !== productCurrency) {
          await client.query("ROLLBACK");
          reply.code(409).send({ success: false, error: "cosmetic_currency_mismatch" });
          return;
        }
        const priceAmount = toPositiveNumber(item.price_amount, 0);
        if (priceAmount <= 0) {
          await client.query("ROLLBACK");
          reply.code(409).send({ success: false, error: "cosmetic_price_invalid" });
          return;
        }

        const purchaseRefInput = String(request.body.purchase_ref || "").trim();
        const purchaseRef =
          purchaseRefInput ||
          deterministicUuid(`v5_cosmetic_purchase:${profile.user_id}:${itemKey}:${Date.now()}:${Math.random()}`);
        const debit = await economyStore.debitCurrency(client, {
          userId: profile.user_id,
          currency: paymentCurrency,
          amount: priceAmount,
          reason: "v5_cosmetic_purchase",
          refEventId: deterministicUuid(`v5_cosmetic_debit:${purchaseRef}`),
          meta: {
            source: "webapp",
            item_key: itemKey,
            purchase_ref: purchaseRef
          }
        });
        if (!debit.applied) {
          await client.query("ROLLBACK");
          if (debit.reason === "insufficient_balance") {
            reply.code(409).send({ success: false, error: "insufficient_balance" });
            return;
          }
          reply.code(409).send({ success: false, error: debit.reason || "cosmetic_debit_failed" });
          return;
        }

        const purchase = await insertCosmeticPurchase(client, {
          user_id: profile.user_id,
          item_key: itemKey,
          category: String(item.category || "cosmetic"),
          amount_paid: priceAmount,
          currency: paymentCurrency,
          purchase_ref: purchaseRef,
          payload_json: {
            source: "webapp",
            rarity: String(item.rarity || "common")
          }
        });

        await riskStore.insertBehaviorEvent(client, profile.user_id, "webapp_cosmetic_purchase", {
          item_key: itemKey,
          purchase_ref: purchaseRef,
          amount_paid: priceAmount,
          currency: paymentCurrency
        }).catch((err) => {
          if (err.code !== "42P01") {
            throw err;
          }
        });

        const monetization = await buildMonetizationSummary(client, {
          featureFlags,
          userId: profile.user_id,
          lang: request.body.lang || "tr"
        });
        const balances = await economyStore.getBalances(client, profile.user_id);
        await client.query("COMMIT");
        reply.send({
          success: true,
          session: issueWebAppSession(auth.uid),
          data: {
            api_version: "v2",
            purchase: mapCosmeticPurchaseView(purchase),
            balances,
            monetization
          }
        });
      } catch (err) {
        await client.query("ROLLBACK");
        if (err.code === "42P01") {
          reply.code(503).send({ success: false, error: "monetization_tables_missing" });
          return;
        }
        if (err.code === "23505") {
          reply.code(409).send({ success: false, error: "idempotency_conflict" });
          return;
        }
        throw err;
      } finally {
        client.release();
      }
    }
  );

  fastify.post(
    "/webapp/api/v2/admin/monetization/fee-event",
    {
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig", "event_ref", "fee_kind", "gross_amount", "fee_amount", "fee_currency"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            event_ref: { type: "string", minLength: 6, maxLength: 128 },
            fee_kind: { type: "string", minLength: 2, maxLength: 40 },
            gross_amount: { type: "number", minimum: 0 },
            fee_amount: { type: "number", minimum: 0 },
            fee_currency: { type: "string", minLength: 2, maxLength: 8 },
            user_id: { type: "integer", minimum: 1 },
            payload_json: { type: "object" }
          }
        }
      }
    },
    async (request, reply) => {
      const auth = verifyWebAppAuth(request.body.uid, request.body.ts, request.body.sig);
      if (!auth.ok) {
        reply.code(401).send({ success: false, error: auth.reason });
        return;
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const adminProfile = await requireWebAppAdmin(client, reply, auth.uid);
        if (!adminProfile) {
          await client.query("ROLLBACK");
          return;
        }
        const featureFlags = await loadFeatureFlags(client);
        if (!isFeatureEnabled(featureFlags, "MONETIZATION_CORE_V1_ENABLED")) {
          await client.query("ROLLBACK");
          reply.code(409).send({ success: false, error: "monetization_feature_disabled" });
          return;
        }
        const tables = await hasMonetizationTables(client);
        if (!tables.all) {
          await client.query("ROLLBACK");
          reply.code(503).send({ success: false, error: "monetization_tables_missing" });
          return;
        }

        const eventRef = String(request.body.event_ref || "").trim();
        const targetUserId = Number(request.body.user_id || adminProfile.user_id || 0);
        const feeCurrency = normalizeMonetizationCurrency(request.body.fee_currency, "SC");
        const payloadJson = request.body.payload_json && typeof request.body.payload_json === "object"
          ? request.body.payload_json
          : {};
        const inserted = await client.query(
          `INSERT INTO v5_marketplace_fee_events (
             event_ref,
             user_id,
             fee_kind,
             gross_amount,
             fee_amount,
             fee_currency,
             payload_json
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
           RETURNING event_ref, user_id, fee_kind, gross_amount, fee_amount, fee_currency, payload_json, created_at;`,
          [
            eventRef,
            targetUserId,
            String(request.body.fee_kind || ""),
            Math.max(0, Number(request.body.gross_amount || 0)),
            Math.max(0, Number(request.body.fee_amount || 0)),
            feeCurrency,
            JSON.stringify(payloadJson)
          ]
        );
        const row = inserted.rows?.[0] || null;
        await client.query(
          `INSERT INTO admin_audit (admin_id, action, target, payload_json)
           VALUES ($1, 'monetization_fee_event', $2, $3::jsonb);`,
          [
            Number(auth.uid),
            `fee_event:${eventRef}`,
            JSON.stringify({
              user_id: targetUserId,
              fee_kind: String(request.body.fee_kind || ""),
              fee_amount: Math.max(0, Number(request.body.fee_amount || 0)),
              fee_currency: feeCurrency
            })
          ]
        );
        await client.query("COMMIT");
        reply.send({
          success: true,
          session: issueWebAppSession(auth.uid),
          data: {
            api_version: "v2",
            event: {
              event_ref: String(row?.event_ref || eventRef),
              user_id: Number(row?.user_id || targetUserId),
              fee_kind: String(row?.fee_kind || request.body.fee_kind || ""),
              gross_amount: Number(row?.gross_amount || request.body.gross_amount || 0),
              fee_amount: Number(row?.fee_amount || request.body.fee_amount || 0),
              fee_currency: String(row?.fee_currency || feeCurrency),
              created_at: row?.created_at || new Date().toISOString()
            }
          }
        });
      } catch (err) {
        await client.query("ROLLBACK");
        if (err.code === "42P01") {
          reply.code(503).send({ success: false, error: "monetization_tables_missing" });
          return;
        }
        if (err.code === "23505") {
          reply.code(409).send({ success: false, error: "idempotency_conflict" });
          return;
        }
        throw err;
      } finally {
        client.release();
      }
    }
  );
}

module.exports = {
  registerWebappV2MonetizationRoutes
};
