type RadarRow = {
  input_action?: string;
  input?: string;
  action?: string;
  accepted?: boolean;
  seq?: number;
};

type RadarOptions = {
  tone?: string;
  flowRatio?: number;
  clutchVector?: number;
  queueRatio?: number;
  driftRatio?: number;
  reducedMotion?: boolean;
  replay?: RadarRow[];
  tickSeq?: number;
};

type PvpRadarBridge = {
  draw: (canvas: HTMLCanvasElement | null, options?: RadarOptions) => boolean;
};

declare global {
  interface Window {
    __AKR_PVP_RADAR__?: PvpRadarBridge;
  }
}

function asNum(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function drawLegacyLikeRadar(canvas: HTMLCanvasElement, options: RadarOptions = {}): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return false;
  }
  const width = Math.max(180, canvas.width || 360);
  const height = Math.max(110, canvas.height || 196);
  const cx = width * 0.5;
  const cy = height * 0.52;
  const maxRadius = Math.max(24, Math.min(width, height) * 0.4);
  const tone = String(options.tone || "neutral");
  const flowRatio = clamp(asNum(options.flowRatio), 0, 1);
  const clutchVector = clamp(asNum(options.clutchVector), 0, 1);
  const queueRatio = clamp(asNum(options.queueRatio), 0, 1);
  const driftRatio = clamp(asNum(options.driftRatio), 0, 1);
  const reducedMotion = Boolean(options.reducedMotion);
  const replay = Array.isArray(options.replay) ? options.replay.slice(0, 14) : [];
  const tickSeq = Math.max(0, asNum(options.tickSeq || 0));
  const nowMs = Date.now();
  const sweepSeed = reducedMotion ? tickSeq * 0.47 : nowMs / 900;
  const sweepAngle = (sweepSeed % (Math.PI * 2)) + queueRatio * 0.16;

  const toneGradientMap: Record<string, [string, string]> = {
    critical: ["rgba(28, 8, 18, 0.92)", "rgba(8, 8, 20, 0.94)"],
    pressure: ["rgba(24, 14, 8, 0.9)", "rgba(7, 10, 22, 0.94)"],
    advantage: ["rgba(8, 18, 17, 0.9)", "rgba(6, 11, 24, 0.94)"],
    neutral: ["rgba(8, 13, 30, 0.9)", "rgba(5, 9, 22, 0.94)"]
  };
  const [gradA, gradB] = toneGradientMap[tone] || toneGradientMap.neutral;
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, gradA);
  bg.addColorStop(1, gradB);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const gridColor = tone === "critical" ? "rgba(255, 94, 132, 0.22)" : "rgba(143, 184, 255, 0.18)";
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let ring = 1; ring <= 4; ring += 1) {
    const r = (maxRadius / 4) * ring;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - maxRadius - 10, cy);
  ctx.lineTo(cx + maxRadius + 10, cy);
  ctx.moveTo(cx, cy - maxRadius - 10);
  ctx.lineTo(cx, cy + maxRadius + 10);
  ctx.stroke();

  const sweepGradient = ctx.createRadialGradient(cx, cy, maxRadius * 0.1, cx, cy, maxRadius * 1.2);
  const sweepColor =
    tone === "critical"
      ? "rgba(255, 86, 121, 0.36)"
      : tone === "pressure"
        ? "rgba(255, 189, 111, 0.34)"
        : tone === "advantage"
          ? "rgba(112, 255, 160, 0.34)"
          : "rgba(124, 214, 255, 0.3)";
  sweepGradient.addColorStop(0, sweepColor);
  sweepGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = sweepGradient;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, maxRadius * 1.08, sweepAngle - 0.26, sweepAngle + 0.26);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = tone === "critical" ? "rgba(255, 135, 161, 0.84)" : "rgba(151, 221, 255, 0.8)";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(sweepAngle) * maxRadius * 1.06, cy + Math.sin(sweepAngle) * maxRadius * 1.06);
  ctx.stroke();

  replay.forEach((row, idx) => {
    const action = String(row?.input_action || row?.input || row?.action || "strike").toLowerCase();
    const accepted = Boolean(row?.accepted);
    const seq = Math.max(1, asNum(row?.seq || idx + 1));
    const hashSeed =
      seq * 0.37 +
      action
        .split("")
        .reduce((acc, ch) => acc + ch.charCodeAt(0), 0) *
        0.013;
    const angle = (hashSeed % (Math.PI * 2)) + driftRatio * 0.55;
    const radius = clamp(maxRadius * (0.24 + (idx / Math.max(1, replay.length - 1)) * 0.72), maxRadius * 0.2, maxRadius * 0.96);
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    const fill =
      action.includes("guard")
        ? accepted
          ? "rgba(112, 255, 160, 0.86)"
          : "rgba(255, 152, 171, 0.84)"
        : action.includes("charge")
          ? accepted
            ? "rgba(124, 214, 255, 0.86)"
            : "rgba(255, 180, 120, 0.84)"
          : accepted
            ? "rgba(255, 206, 120, 0.86)"
            : "rgba(255, 102, 136, 0.88)";
    ctx.fillStyle = fill;
    ctx.shadowBlur = accepted ? 8 : 12;
    ctx.shadowColor = fill;
    ctx.beginPath();
    ctx.arc(x, y, accepted ? 3.2 : 3.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  const vectorAngle = -Math.PI * 0.5 + flowRatio * Math.PI * 1.2;
  const vectorRadius = maxRadius * (0.22 + clutchVector * 0.62);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.66)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(vectorAngle) * vectorRadius, cy + Math.sin(vectorAngle) * vectorRadius);
  ctx.stroke();

  ctx.fillStyle = tone === "critical" ? "rgba(255, 134, 164, 0.96)" : "rgba(146, 252, 208, 0.95)";
  ctx.beginPath();
  ctx.arc(cx, cy, 4.3 + flowRatio * 1.8, 0, Math.PI * 2);
  ctx.fill();
  return true;
}

export function installPvpRadarBridge(): void {
  window.__AKR_PVP_RADAR__ = {
    draw(canvas, options = {}) {
      if (!canvas) {
        return false;
      }
      return drawLegacyLikeRadar(canvas, options);
    }
  };
}

