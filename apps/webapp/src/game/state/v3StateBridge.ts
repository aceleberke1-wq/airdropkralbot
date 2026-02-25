type AssetManifestMetrics = {
  available: boolean;
  sourceMode: string;
  manifestRevision: string;
  manifestHash: string;
  hashShort: string;
  activatedAt: string | null;
  totalEntries: number;
  readyEntries: number;
  missingEntries: number;
  missingRatio: number;
  integrityOkEntries: number;
  integrityBadEntries: number;
  integrityUnknownEntries: number;
  integrityRatio: number;
  readyRatio: number;
  tone: string;
};

type PvpLeaderboardState = {
  list: any[];
  meta: {
    transport: string;
    server_tick: number;
    limit: number;
  };
};

type V3StateMutatorBridge = {
  computeAssetManifestMetrics: (manifestPayload: any) => AssetManifestMetrics;
  computePvpLeaderboardState: (payloadData: any, currentTransport?: string) => PvpLeaderboardState;
};

declare global {
  interface Window {
    __AKR_STATE_MUTATORS__?: V3StateMutatorBridge;
  }
}

function asNum(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function asString(value: unknown, fallback = ""): string {
  const text = String(value ?? "");
  return text || fallback;
}

function computeAssetManifestMetrics(manifestPayload: any): AssetManifestMetrics {
  const data = manifestPayload && typeof manifestPayload === "object" ? manifestPayload : {};
  const revision = data.active_revision && typeof data.active_revision === "object" ? data.active_revision : null;
  const entries = Array.isArray(data.entries) ? data.entries : [];
  const totalEntries = entries.length;
  const readyEntries = entries.filter((row) => row && row.exists_local === true).length;
  const missingEntries = Math.max(0, totalEntries - readyEntries);
  const integrityBuckets = entries.reduce(
    (acc, row) => {
      const raw = String(row?.integrity_status || "").toLowerCase();
      if (!raw) {
        acc.unknown += 1;
      } else if (/(ok|pass|ready|valid|verified)/.test(raw)) {
        acc.ok += 1;
      } else if (/(missing|mismatch|fail|error|bad)/.test(raw)) {
        acc.bad += 1;
      } else {
        acc.unknown += 1;
      }
      return acc;
    },
    { ok: 0, bad: 0, unknown: 0 }
  );
  const integrityKnownTotal = Math.max(0, integrityBuckets.ok + integrityBuckets.bad);
  const integrityRatio =
    totalEntries > 0
      ? integrityKnownTotal > 0
        ? clamp(integrityBuckets.ok / integrityKnownTotal, 0, 1)
        : readyEntries > 0
          ? clamp(readyEntries / Math.max(1, totalEntries), 0, 1)
          : 0
      : 0;
  const readyRatio = totalEntries > 0 ? clamp(readyEntries / totalEntries, 0, 1) : 0;
  const missingRatio = totalEntries > 0 ? clamp(missingEntries / totalEntries, 0, 1) : 0;
  const sourceMode = asString(revision?.source || (data.available ? "registry" : "fallback") || "fallback");
  const manifestRevision = asString(revision?.manifest_revision || data.manifest_revision || "local");
  const manifestHash = asString(revision?.manifest_hash || "");
  const tone =
    missingEntries >= 2 || (totalEntries > 0 && integrityRatio < 0.62)
      ? "critical"
      : missingEntries > 0 || (totalEntries > 0 && integrityRatio < 0.9)
        ? "pressure"
        : totalEntries > 0
          ? "advantage"
          : "balanced";
  return {
    available: data.available !== false,
    sourceMode,
    manifestRevision,
    manifestHash,
    hashShort: manifestHash ? manifestHash.slice(0, 10) : "--",
    activatedAt: revision?.activated_at || revision?.updated_at || revision?.created_at || null,
    totalEntries,
    readyEntries,
    missingEntries,
    missingRatio,
    integrityOkEntries: integrityBuckets.ok,
    integrityBadEntries: integrityBuckets.bad,
    integrityUnknownEntries: integrityBuckets.unknown,
    integrityRatio,
    readyRatio,
    tone
  };
}

function computePvpLeaderboardState(payloadData: any, currentTransport = "poll"): PvpLeaderboardState {
  const data = payloadData && typeof payloadData === "object" ? payloadData : {};
  const list = Array.isArray(data.leaderboard) ? data.leaderboard : [];
  return {
    list,
    meta: {
      transport: asString(data.transport || currentTransport || "poll").toLowerCase() || "poll",
      server_tick: asNum(data.server_tick || Date.now()),
      limit: list.length
    }
  };
}

export function installV3StateMutatorBridge(): void {
  window.__AKR_STATE_MUTATORS__ = {
    computeAssetManifestMetrics,
    computePvpLeaderboardState
  };
}

