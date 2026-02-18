type TelemetryRenderInput = {
  fps: number;
  frameTimeMs: number;
  latencyMs: number;
  transport: string;
  tickMs: number;
  qualityMode: string;
  heat: number;
  threat: number;
};

type TelemetryDeckBridge = {
  render: (input: TelemetryRenderInput) => void;
  reset: () => void;
};

declare global {
  interface Window {
    __AKR_TELEMETRY_DECK__?: TelemetryDeckBridge;
  }
}

const MAX_HISTORY = 84;

const series = {
  fps: [] as number[],
  latency: [] as number[],
  heat: [] as number[],
  threat: [] as number[]
};

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function asNum(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pushSeries(target: number[], value: number): number[] {
  target.push(asNum(value));
  if (target.length > MAX_HISTORY) {
    target.splice(0, target.length - MAX_HISTORY);
  }
  return target;
}

function drawSeries(
  ctx: CanvasRenderingContext2D,
  values: number[],
  color: string,
  maxValue: number,
  chartTop: number,
  chartWidth: number,
  chartHeight: number
) {
  if (!values.length) return;
  const maxSafe = Math.max(1, asNum(maxValue));
  const stepX = values.length > 1 ? chartWidth / (values.length - 1) : chartWidth;
  ctx.beginPath();
  values.forEach((value, index) => {
    const x = index * stepX;
    const ratio = clamp(asNum(value) / maxSafe, 0, 1);
    const y = chartTop + chartHeight - ratio * chartHeight;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowBlur = 10;
  ctx.shadowColor = color;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawTelemetryCanvas() {
  const canvas = byId<HTMLCanvasElement>("telemetryCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const hostWidth = Math.max(320, Math.floor(canvas.clientWidth || canvas.width || 960));
  const hostHeight = Math.max(96, Math.floor(canvas.clientHeight || canvas.height || 132));
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  const targetW = Math.floor(hostWidth * dpr);
  const targetH = Math.floor(hostHeight * dpr);
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, hostWidth, hostHeight);

  const gradient = ctx.createLinearGradient(0, 0, 0, hostHeight);
  gradient.addColorStop(0, "rgba(12, 26, 58, 0.96)");
  gradient.addColorStop(1, "rgba(8, 15, 34, 0.64)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, hostWidth, hostHeight);

  const chartLeft = 14;
  const chartTop = 12;
  const chartWidth = hostWidth - 28;
  const chartHeight = hostHeight - 24;

  ctx.strokeStyle = "rgba(150, 175, 236, 0.18)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = chartTop + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(chartLeft, y);
    ctx.lineTo(chartLeft + chartWidth, y);
    ctx.stroke();
  }

  drawSeries(ctx, series.fps, "#49f7bf", 90, chartTop, chartWidth, chartHeight);
  drawSeries(ctx, series.latency, "#7ca8ff", 220, chartTop, chartWidth, chartHeight);
  drawSeries(
    ctx,
    series.heat.map((value) => value * 100),
    "#ffbf59",
    100,
    chartTop,
    chartWidth,
    chartHeight
  );
  drawSeries(
    ctx,
    series.threat.map((value) => value * 100),
    "#ff5d84",
    100,
    chartTop,
    chartWidth,
    chartHeight
  );

  ctx.fillStyle = "rgba(189, 207, 255, 0.75)";
  ctx.font = '11px "IBM Plex Mono", monospace';
  ctx.fillText("FPS", chartLeft + 2, chartTop + 10);
  ctx.fillText("LAT", chartLeft + 42, chartTop + 10);
  ctx.fillText("HEAT", chartLeft + 82, chartTop + 10);
  ctx.fillText("THREAT", chartLeft + 128, chartTop + 10);
}

function render(input: TelemetryRenderInput) {
  const heatPct = Math.round(clamp(asNum(input.heat), 0, 1) * 100);
  const threatPct = Math.round(clamp(asNum(input.threat), 0, 1) * 100);
  const fps = asNum(input.fps);
  const latencyMs = asNum(input.latencyMs);
  const frameTimeMs = asNum(input.frameTimeMs);

  pushSeries(series.fps, fps);
  pushSeries(series.latency, latencyMs);
  pushSeries(series.heat, asNum(input.heat));
  pushSeries(series.threat, asNum(input.threat));

  const modeLine = byId<HTMLElement>("runtimeModeLine");
  if (modeLine) {
    modeLine.textContent = `Transport ${String(input.transport || "poll").toUpperCase()} | Tick ${asNum(
      input.tickMs || 1000
    )}ms`;
  }
  const perfLine = byId<HTMLElement>("runtimePerfLine");
  if (perfLine) {
    perfLine.textContent = `FPS ${Math.round(fps)} | ${Math.round(frameTimeMs)}ms`;
  }
  const latencyLine = byId<HTMLElement>("runtimeLatencyLine");
  if (latencyLine) {
    latencyLine.textContent = `Net ${Math.round(latencyMs)}ms | Perf ${String(input.qualityMode || "auto").toUpperCase()}`;
  }
  const heatLine = byId<HTMLElement>("combatHeatLine");
  if (heatLine) {
    heatLine.textContent = `${heatPct}%`;
  }
  const heatHint = byId<HTMLElement>("combatHeatHint");
  if (heatHint) {
    heatHint.textContent = heatPct >= 75 ? "Momentum penceresi acik" : heatPct >= 45 ? "Denge modu korunuyor" : "Ritim toplaniyor";
  }
  const heatMeter = byId<HTMLElement>("combatHeatMeter");
  if (heatMeter) {
    heatMeter.style.width = `${heatPct}%`;
  }
  const threatLine = byId<HTMLElement>("threatLine");
  if (threatLine) {
    threatLine.textContent = `Risk ${threatPct}%`;
  }
  const threatHint = byId<HTMLElement>("threatHint");
  if (threatHint) {
    threatHint.textContent =
      threatPct >= 78 ? "Kritik anomali: SAFE cizgisine don" : threatPct >= 45 ? "Kontrat baskisi yukseliyor" : "Stabil pencere";
  }
  const threatMeter = byId<HTMLElement>("threatMeter");
  if (threatMeter) {
    threatMeter.style.width = `${threatPct}%`;
  }
  const badge = byId<HTMLElement>("telemetryBadge");
  if (badge) {
    if (threatPct >= 78) {
      badge.textContent = "CRITICAL";
      badge.className = "badge warn";
    } else if (heatPct >= 68) {
      badge.textContent = "PRESSURE";
      badge.className = "badge";
    } else {
      badge.textContent = "LIVE";
      badge.className = "badge info";
    }
  }
  drawTelemetryCanvas();
}

function reset() {
  series.fps = [];
  series.latency = [];
  series.heat = [];
  series.threat = [];
  drawTelemetryCanvas();
}

export function installTelemetryDeckBridge() {
  window.__AKR_TELEMETRY_DECK__ = {
    render,
    reset
  };
  window.addEventListener("resize", drawTelemetryCanvas);
}

