import { buildDeviceHash, detectPerfTier } from "../core/device";

type PerfPayload = {
  uid: string;
  ts: string;
  sig: string;
  device_hash: string;
  ui_mode: string;
  quality_mode: string;
  reduced_motion: boolean;
  large_text: boolean;
  sound_enabled: boolean;
  platform: string;
  gpu_tier: string;
  cpu_tier: string;
  memory_tier: string;
  fps_avg: number;
  frame_time_ms: number;
  latency_avg_ms: number;
  dropped_frames: number;
  gpu_time_ms: number;
  cpu_time_ms: number;
  profile_json: Record<string, unknown>;
};

const bridgeState = {
  deviceHash: buildDeviceHash(),
  perfTier: detectPerfTier(),
  posted: false
};

export function installPerfBridge(): void {
  const globalAny = window as any;
  globalAny.__AKR_V32_PERF__ = {
    deviceHash: bridgeState.deviceHash,
    perfTier: bridgeState.perfTier,
    async post(payload: PerfPayload) {
      if (!payload.uid || !payload.ts || !payload.sig) {
        return;
      }
      try {
        await fetch("/webapp/api/telemetry/perf-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        bridgeState.posted = true;
      } catch {
        // Best-effort telemetry bridge.
      }
    }
  };
}
