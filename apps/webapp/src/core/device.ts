export type PerfTier = "low" | "normal" | "high";

function hashText(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function buildDeviceHash(): string {
  const ua = navigator.userAgent || "ua";
  const lang = navigator.language || "lang";
  const size = `${window.screen?.width || 0}x${window.screen?.height || 0}`;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "tz";
  return `dvc_${hashText(`${ua}|${lang}|${size}|${tz}`)}`;
}

export function detectPerfTier(): PerfTier {
  const cores = Number((navigator as any).hardwareConcurrency || 4);
  const memory = Number((navigator as any).deviceMemory || 4);
  const width = window.screen?.width || 1280;
  if (cores <= 4 || memory <= 4 || width <= 900) {
    return "low";
  }
  if (cores >= 10 && memory >= 8 && width >= 1920) {
    return "high";
  }
  return "normal";
}
