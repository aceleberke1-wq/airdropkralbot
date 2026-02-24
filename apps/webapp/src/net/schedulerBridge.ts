type SchedulerCallback = () => void;

type NetSchedulerBridge = {
  scheduleTimeout: (key: string, delayMs: number, cb: SchedulerCallback) => number;
  clearTimeout: (key: string) => void;
};

declare global {
  interface Window {
    __AKR_NET_SCHEDULER__?: NetSchedulerBridge;
  }
}

const timeouts = new Map<string, number>();

function clearTimeoutByKey(key: string): void {
  const k = String(key || "");
  const handle = timeouts.get(k);
  if (typeof handle === "number") {
    window.clearTimeout(handle);
    timeouts.delete(k);
  }
}

function scheduleTimeoutByKey(key: string, delayMs: number, cb: SchedulerCallback): number {
  const k = String(key || "");
  clearTimeoutByKey(k);
  const handle = window.setTimeout(() => {
    const active = timeouts.get(k);
    if (active === handle) {
      timeouts.delete(k);
    }
    try {
      cb();
    } catch {
      // Runtime callbacks already handle/report errors; bridge must stay noop-safe.
    }
  }, Math.max(0, Number(delayMs) || 0));
  timeouts.set(k, handle);
  return handle;
}

export function installNetSchedulerBridge(): void {
  window.__AKR_NET_SCHEDULER__ = {
    scheduleTimeout: scheduleTimeoutByKey,
    clearTimeout: clearTimeoutByKey
  };
}

