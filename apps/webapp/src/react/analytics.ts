import { postUiEventsBatch } from "./api";
import type { AnalyticsConfig, UiEventRecord, WebAppAuth } from "./types";
import { normalizeLang, type Lang } from "./i18n";

type AnalyticsContext = {
  auth: WebAppAuth;
  config: AnalyticsConfig;
  language: Lang;
  variantKey: "control" | "treatment";
  experimentKey: string;
  cohortBucket: number;
  tabKey: string;
  routeKey: string;
};

export type UiAnalyticsClient = {
  track: (event: UiEventRecord) => void;
  flush: () => Promise<void>;
  setContext: (patch: Partial<AnalyticsContext>) => void;
  dispose: () => void;
};

function makeBatchId(): string {
  return `ui_batch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createUiAnalyticsClient(initial: AnalyticsContext): UiAnalyticsClient {
  let ctx = { ...initial };
  let queue: UiEventRecord[] = [];
  let timer: number | null = null;

  const schedule = () => {
    if (timer != null) {
      window.clearTimeout(timer);
    }
    timer = window.setTimeout(() => {
      void flush();
    }, Math.max(1000, Number(ctx.config.flush_interval_ms || 6000)));
  };

  const flush = async () => {
    if (queue.length <= 0) {
      return;
    }
    const payloadEvents = queue.slice(0, Math.max(1, Number(ctx.config.max_batch_size || 40)));
    queue = queue.slice(payloadEvents.length);
    try {
      const res = await postUiEventsBatch({
        uid: ctx.auth.uid,
        ts: ctx.auth.ts,
        sig: ctx.auth.sig,
        session_ref: String(ctx.config.session_ref || ""),
        language: normalizeLang(ctx.language),
        tab_key: ctx.tabKey,
        route_key: ctx.routeKey,
        variant_key: ctx.variantKey,
        experiment_key: ctx.experimentKey,
        cohort_bucket: Number(ctx.cohortBucket || 0),
        idempotency_key: makeBatchId(),
        events: payloadEvents
      });
      if (res?.session?.ts && res.session.sig) {
        ctx.auth = {
          uid: String(res.session.uid || ctx.auth.uid),
          ts: String(res.session.ts || ctx.auth.ts),
          sig: String(res.session.sig || ctx.auth.sig)
        };
      }
    } catch {
      // Analytics must be best-effort and non-blocking.
    } finally {
      if (queue.length > 0) {
        schedule();
      }
    }
  };

  const track = (event: UiEventRecord) => {
    const sample = Number(ctx.config.sample_rate || 1);
    if (sample < 1 && Math.random() > sample) {
      return;
    }
    queue.push({
      ...event,
      tab_key: event.tab_key || ctx.tabKey,
      route_key: event.route_key || ctx.routeKey,
      variant_key: event.variant_key || ctx.variantKey,
      experiment_key: event.experiment_key || ctx.experimentKey,
      cohort_bucket: Number.isFinite(Number(event.cohort_bucket)) ? Number(event.cohort_bucket) : ctx.cohortBucket,
      client_ts: event.client_ts || new Date().toISOString()
    });
    if (queue.length >= Math.max(1, Number(ctx.config.max_batch_size || 40))) {
      void flush();
      return;
    }
    schedule();
  };

  const setContext = (patch: Partial<AnalyticsContext>) => {
    ctx = {
      ...ctx,
      ...patch,
      auth: {
        ...ctx.auth,
        ...(patch.auth || {})
      },
      config: {
        ...ctx.config,
        ...(patch.config || {})
      }
    };
  };

  const dispose = () => {
    if (timer != null) {
      window.clearTimeout(timer);
      timer = null;
    }
    void flush();
  };

  return {
    track,
    flush,
    setContext,
    dispose
  };
}
