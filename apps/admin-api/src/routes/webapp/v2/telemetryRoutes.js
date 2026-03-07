"use strict";

const { normalizeLanguage } = require("../../../../../../packages/shared/src/localeContract");
const {
  DEFAULT_EXPERIMENT_KEY,
  DEFAULT_VARIANT_CONTROL,
  buildUiEventIdempotencyKey,
  buildUiEventIngestId,
  normalizeUiEventBatch
} = require("../../../services/webapp/reactV1Service");

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_EVENTS_PER_WINDOW = 220;
const MAX_EVENTS_PER_BATCH = 80;

const rateMemory = new Map();

function compactRateMemory(now = Date.now()) {
  for (const [key, entry] of rateMemory.entries()) {
    if (!entry || Number(entry.resetAt || 0) <= now) {
      rateMemory.delete(key);
    }
  }
}

function enforceUiEventsRateLimit(uid, incomingCount, now = Date.now()) {
  const safeUid = Math.max(0, Number(uid || 0));
  const count = Math.max(0, Number(incomingCount || 0));
  const key = `u:${safeUid}`;
  compactRateMemory(now);
  const existing = rateMemory.get(key) || {
    count: 0,
    resetAt: now + RATE_LIMIT_WINDOW_MS
  };
  if (Number(existing.resetAt || 0) <= now) {
    existing.count = 0;
    existing.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }
  if (existing.count + count > RATE_LIMIT_EVENTS_PER_WINDOW) {
    const retrySec = Math.max(1, Math.ceil((Number(existing.resetAt || now + RATE_LIMIT_WINDOW_MS) - now) / 1000));
    return {
      ok: false,
      retry_after_sec: retrySec,
      limit: RATE_LIMIT_EVENTS_PER_WINDOW
    };
  }
  existing.count += count;
  rateMemory.set(key, existing);
  return {
    ok: true,
    retry_after_sec: 0,
    limit: RATE_LIMIT_EVENTS_PER_WINDOW
  };
}

function registerWebappV2TelemetryRoutes(fastify, deps = {}) {
  const pool = deps.pool;
  const verifyWebAppAuth = deps.verifyWebAppAuth;
  const issueWebAppSession = deps.issueWebAppSession;
  const getProfileByTelegram = deps.getProfileByTelegram;

  if (!pool || typeof pool.connect !== "function") {
    throw new Error("registerWebappV2TelemetryRoutes requires pool");
  }
  if (typeof verifyWebAppAuth !== "function") {
    throw new Error("registerWebappV2TelemetryRoutes requires verifyWebAppAuth");
  }
  if (typeof issueWebAppSession !== "function") {
    throw new Error("registerWebappV2TelemetryRoutes requires issueWebAppSession");
  }
  if (typeof getProfileByTelegram !== "function") {
    throw new Error("registerWebappV2TelemetryRoutes requires getProfileByTelegram");
  }

  fastify.post(
    "/webapp/api/v2/telemetry/ui-events/batch",
    {
      schema: {
        body: {
          type: "object",
          required: ["uid", "ts", "sig", "session_ref", "events"],
          properties: {
            uid: { type: "string" },
            ts: { type: "string" },
            sig: { type: "string" },
            session_ref: { type: "string", minLength: 3, maxLength: 120 },
            language: { type: "string", maxLength: 8 },
            tab_key: { type: "string", maxLength: 40 },
            panel_key: { type: "string", maxLength: 64 },
            route_key: { type: "string", maxLength: 80 },
            focus_key: { type: "string", maxLength: 80 },
            funnel_key: { type: "string", maxLength: 64 },
            surface_key: { type: "string", maxLength: 64 },
            economy_event_key: { type: "string", maxLength: 80 },
            value_usd: { type: "number", minimum: 0 },
            tx_state: { type: "string", maxLength: 32 },
            variant_key: { type: "string", maxLength: 24 },
            experiment_key: { type: "string", maxLength: 80 },
            cohort_bucket: { type: "integer", minimum: 0, maximum: 99 },
            idempotency_key: { type: "string", maxLength: 180 },
            events: {
              type: "array",
              minItems: 1,
              maxItems: MAX_EVENTS_PER_BATCH,
              items: {
                type: "object",
                properties: {
                  event_key: { type: "string", maxLength: 80 },
                  tab_key: { type: "string", maxLength: 40 },
                  panel_key: { type: "string", maxLength: 64 },
                  route_key: { type: "string", maxLength: 80 },
                  focus_key: { type: "string", maxLength: 80 },
                  funnel_key: { type: "string", maxLength: 64 },
                  surface_key: { type: "string", maxLength: 64 },
                  economy_event_key: { type: "string", maxLength: 80 },
                  value_usd: { type: "number", minimum: 0 },
                  tx_state: { type: "string", maxLength: 32 },
                  event_value: { type: "number" },
                  payload_json: { type: "object" },
                  client_ts: { anyOf: [{ type: "string" }, { type: "number" }] },
                  variant_key: { type: "string", maxLength: 24 },
                  experiment_key: { type: "string", maxLength: 80 },
                  cohort_bucket: { type: "integer", minimum: 0, maximum: 99 }
                }
              }
            }
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

      const eventsRaw = Array.isArray(request.body.events) ? request.body.events : [];
      if (eventsRaw.length <= 0) {
        reply.code(400).send({ success: false, error: "events_required" });
        return;
      }
      if (eventsRaw.length > MAX_EVENTS_PER_BATCH) {
        reply.code(400).send({ success: false, error: "events_batch_too_large" });
        return;
      }

      const rateState = enforceUiEventsRateLimit(auth.uid, eventsRaw.length);
      if (!rateState.ok) {
        reply.code(429).send({
          success: false,
          error: "ui_events_rate_limited",
          data: {
            retry_after_sec: Number(rateState.retry_after_sec || 1),
            limit: Number(rateState.limit || RATE_LIMIT_EVENTS_PER_WINDOW)
          }
        });
        return;
      }

      const defaults = {
        tab_key: String(request.body.tab_key || "home"),
        panel_key: String(request.body.panel_key || "default"),
        route_key: String(request.body.route_key || ""),
        focus_key: String(request.body.focus_key || ""),
        funnel_key: String(request.body.funnel_key || ""),
        surface_key: String(request.body.surface_key || ""),
        economy_event_key: String(request.body.economy_event_key || ""),
        value_usd: Number(request.body.value_usd || 0),
        tx_state: String(request.body.tx_state || ""),
        variant_key: String(request.body.variant_key || DEFAULT_VARIANT_CONTROL),
        experiment_key: String(request.body.experiment_key || DEFAULT_EXPERIMENT_KEY),
        cohort_bucket: Number(request.body.cohort_bucket || 0)
      };

      const normalized = normalizeUiEventBatch(eventsRaw, defaults);
      const validEvents = normalized.accepted;
      const rejectedCount = normalized.rejected;
      if (validEvents.length <= 0) {
        reply.send({
          success: true,
          session: issueWebAppSession(auth.uid),
          data: {
            accepted_count: 0,
            rejected_count: rejectedCount,
            ingest_id: ""
          }
        });
        return;
      }

      const sessionRef = String(request.body.session_ref || "")
        .trim()
        .slice(0, 120);
      const language = normalizeLanguage(request.body.language, "tr");
      const ingestId = buildUiEventIngestId(auth.uid, sessionRef, validEvents.length);
      const batchIdempotencyKey = buildUiEventIdempotencyKey(
        auth.uid,
        sessionRef,
        validEvents,
        String(request.body.idempotency_key || "")
      );

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const profile = await getProfileByTelegram(client, auth.uid);
        if (!profile) {
          await client.query("ROLLBACK");
          reply.code(404).send({ success: false, error: "user_not_started" });
          return;
        }

        for (let i = 0; i < validEvents.length; i += 1) {
          const event = validEvents[i];
          const eventIdempotencyKey = `${batchIdempotencyKey}:${i}`;
          const payloadJson = event.payload_json && typeof event.payload_json === "object" ? { ...event.payload_json } : {};
          if (event.focus_key) {
            payloadJson.focus_key = String(event.focus_key);
          }
          await client.query(
            `INSERT INTO v5_webapp_ui_events (
               uid,
               session_ref,
               tab_key,
               panel_key,
               event_key,
               event_value,
               language,
               payload_json,
               route_key,
               funnel_key,
               surface_key,
               economy_event_key,
               value_usd,
               tx_state,
               variant_key,
               experiment_key,
               cohort_bucket,
               ingest_id,
               idempotency_key,
               client_ts,
               event_seq
             )
             VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20::timestamptz, $21
             );`,
            [
              Number(auth.uid || 0),
              sessionRef,
              String(event.tab_key || "home"),
              String(event.panel_key || "default"),
              String(event.event_key || ""),
              Number(event.event_value || 0),
              language,
              JSON.stringify(payloadJson),
              String(event.route_key || ""),
              String(event.funnel_key || ""),
              String(event.surface_key || ""),
              String(event.economy_event_key || ""),
              Number(event.value_usd || 0),
              String(event.tx_state || ""),
              String(event.variant_key || DEFAULT_VARIANT_CONTROL),
              String(event.experiment_key || DEFAULT_EXPERIMENT_KEY),
              Math.max(0, Math.min(99, Number(event.cohort_bucket || 0))),
              ingestId,
              eventIdempotencyKey,
              String(event.client_ts || new Date().toISOString()),
              i + 1
            ]
          );
        }

        await client.query("COMMIT");
        reply.send({
          success: true,
          session: issueWebAppSession(auth.uid),
          data: {
            accepted_count: validEvents.length,
            rejected_count: rejectedCount,
            ingest_id: ingestId
          }
        });
      } catch (err) {
        await client.query("ROLLBACK");
        if (err.code === "23505") {
          reply.code(409).send({ success: false, error: "idempotency_conflict" });
          return;
        }
        if (err.code === "42P01" || err.code === "42703") {
          reply.code(503).send({ success: false, error: "ui_events_tables_missing" });
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
  registerWebappV2TelemetryRoutes
};
