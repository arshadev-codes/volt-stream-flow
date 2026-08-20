import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import {
  Area, Line, ComposedChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis, ReferenceLine, ReferenceDot,
} from "recharts";
import type { CurrentUnit, RawPoint, TimeUnit } from "@/types/sample";
import { convertCurrentUnit, currentUnitLabel, timeUnitLabel } from "@/utils/unitConversion";
import type { BreakPoint } from "@/utils/createAnalyzedSample";

interface Props {
  /** Raw points; may include an optional i_smooth field (set only within
   *  the tau-locked window) so the highlighted overlay line can be drawn. */
  points: (RawPoint & { i_smooth?: number })[];
  rawPoints?: RawPoint[];
  timeUnit: TimeUnit;
  currentUnit: CurrentUnit;
  peakCurrent: number;
  datasetLabel?: string;
  yScale?: "linear" | "log";
  /** Where tau lock broke / noise was detected — rendered as a dot. */
  breakPoint?: BreakPoint | null;
  /** Show the voltage overlay line — off by default. Draws from p.voltage,
   *  so once real hardware sends non-zero voltage this just works with no code change. */
  showVoltage?: boolean;
  /** Show the tau-locked "smooth region" highlight overlay — off by default. */
  showSmoothLine?: boolean;
}

function timeInDisplayUnit(timestampMs: number, unit: TimeUnit): number {
  return unit === "MS" ? timestampMs : timestampMs / 1000;
}

function buildTicks(minTime: number, maxTime: number, unit: TimeUnit): number[] {
  if (!isFinite(maxTime) || maxTime <= minTime) return [minTime];
  const span = maxTime - minTime;
  const fiveInUnit = unit === "MS" ? 5000 : 5;
  const stepFine   = unit === "MS" ? 500  : 0.5;
  const stepCoarse = unit === "MS" ? 1000 : 1;
  const step = span <= fiveInUnit ? stepFine : stepCoarse;

  const start = Math.floor(minTime / step) * step;
  const end = Math.ceil(maxTime / step) * step;
  const out: number[] = [];
  for (let t = start; t <= end + 1e-9; t += step) {
    out.push(+t.toFixed(unit === "MS" ? 0 : 2));
  }
  return out;
}

type Domain = [number, number];

function toChartPoint(p: RawPoint & { i_smooth?: number }, timeUnit: TimeUnit, currentUnit: CurrentUnit) {
  return {
    time:    +timeInDisplayUnit(p.timestamp, timeUnit).toFixed(timeUnit === "MS" ? 0 : 3),
    current: +convertCurrentUnit(p.current, currentUnit).toFixed(currentUnit === "mA" ? 0 : 3),
    voltage: +p.voltage.toFixed(3),
    i_smooth: p.i_smooth === undefined
      ? undefined
      : +convertCurrentUnit(p.i_smooth, currentUnit).toFixed(currentUnit === "mA" ? 0 : 3),
  };
}

export function VoltageCurrentGraph({
  points, rawPoints, timeUnit, currentUnit, peakCurrent, datasetLabel, yScale = "linear", breakPoint,
  showVoltage = false, showSmoothLine = false,
}: Props) {
  const fullData = useMemo(
    () => points.map((p) => toChartPoint(p, timeUnit, currentUnit)),
    [points, timeUnit, currentUnit],
  );

  const fullMinT = fullData.length ? fullData[0].time : 0;
  const fullMaxT = fullData.length ? fullData[fullData.length - 1].time : 1;

  const tLabel = timeUnitLabel(timeUnit);
  const iLabel = currentUnitLabel(currentUnit);
  const peakDisplay = +convertCurrentUnit(peakCurrent, currentUnit).toFixed(currentUnit === "mA" ? 0 : 2);

  const [zoom, setZoom] = useState<Domain | null>(null);

  const clampDomain = useCallback((d: Domain): Domain => {
    const totalSpan = fullMaxT - fullMinT || 1;
    const minSpan = totalSpan * 0.005;
    let [lo, hi] = d;
    if (!isFinite(lo) || !isFinite(hi)) return [fullMinT, fullMaxT];
    let span = Math.max(hi - lo, minSpan);
    let mid = (lo + hi) / 2;
    mid = Math.min(Math.max(mid, fullMinT + span / 2), fullMaxT - span / 2);
    lo = Math.max(fullMinT, mid - span / 2);
    hi = Math.min(fullMaxT, mid + span / 2);
    if (hi - lo < minSpan || hi <= lo) return [fullMinT, fullMaxT];
    return [lo, hi];
  }, [fullMinT, fullMaxT]);

  const domain: Domain = zoom ?? [fullMinT, fullMaxT];

  const data = useMemo(() => {
  if (!zoom) return fullData;
  const [lo, hi] = zoom;

  const filteredFull = fullData.filter(
    (d) => d.time >= lo - 1e-6 && d.time <= hi + 1e-6
  );

  if (rawPoints && rawPoints.length) {
    const detailed = rawPoints
      .filter((p) => {
        const t = timeInDisplayUnit(p.timestamp, timeUnit);
        return t >= lo - 1e-6 && t <= hi + 1e-6;
      })
      .map((p) => toChartPoint(p, timeUnit, currentUnit));

    if (detailed.length) {
      // rawPoints jahan tak cover karta hai, uske baad ka gap
      // fullData se fill karo taaki tail/steady-state na chhute
      const rawMaxT = timeInDisplayUnit(
        rawPoints[rawPoints.length - 1].timestamp,
        timeUnit
      );
      const tailFromFull = fullData.filter(
        (d) => d.time > rawMaxT && d.time <= hi + 1e-6
      );
      return [...detailed, ...tailFromFull];
    }
  }

  return filteredFull.length ? filteredFull : fullData;
}, [zoom, fullData, rawPoints, timeUnit, currentUnit]);

  const visibleCurrentMax = useMemo(() => {
    if (!data.length) return peakDisplay || 1;
    return Math.max(...data.map((d) => d.current), 0);
  }, [data, peakDisplay]);

  const leftDomain: [number, number] = zoom
    ? [0, Math.max(visibleCurrentMax, 0.001) * 1.1]
    : [0, Math.max(fullData.length ? Math.max(...fullData.map((d) => d.current)) : 0, peakDisplay) * 1.08];

  const logTicks = useMemo(() => {
    if (yScale !== "log") return undefined;
    const maxVal = Math.max(data.length ? Math.max(...data.map((d) => d.current)) : 1, peakDisplay, 1);
    const arr: number[] = [];
    let t = 1;
    while (t <= maxVal * 2) {
      arr.push(t);
      t *= 10;
    }
    return arr;
  }, [yScale, data, peakDisplay]);

  const ticks = useMemo(() => buildTicks(domain[0], domain[1], timeUnit), [domain, timeUnit]);

  const containerRef = useRef<HTMLDivElement>(null);
  const pinchStateRef = useRef<{ startDist: number; startDomain: Domain } | null>(null);
  const gestureActiveRef = useRef(false);

  const zoomAround = useCallback((center: number, factor: number, base: Domain) => {
    const [lo, hi] = base;
    const span = hi - lo;
    const newSpan = Math.max(span * factor, (fullMaxT - fullMinT) * 0.005);
    const ratio = (center - lo) / (span || 1);
    const newLo = center - newSpan * ratio;
    const newHi = newLo + newSpan;
    return clampDomain([newLo, newHi]);
  }, [clampDomain, fullMaxT, fullMinT]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return;
      const relX = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const base = zoom ?? [fullMinT, fullMaxT];
      const center = base[0] + relX * (base[1] - base[0]);
      const factor = e.deltaY > 0 ? 1.15 : 0.87;
      const next = zoomAround(center, factor, base);
      if (next[0] <= fullMinT + 1e-6 && next[1] >= fullMaxT - 1e-6) setZoom(null);
      else setZoom(next);
    };

    const dist = (touches: TouchList) => {
      const [a, b] = [touches[0], touches[1]];
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    };

    const onTouchStart = (e: TouchEvent) => {
      gestureActiveRef.current = true;
      document.body.style.overflow = "hidden";
      if (e.touches.length === 2) {
        e.preventDefault();
        pinchStateRef.current = { startDist: dist(e.touches), startDomain: zoom ?? [fullMinT, fullMaxT] };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (gestureActiveRef.current) e.preventDefault();
      if (e.touches.length === 2 && pinchStateRef.current) {
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0) return;
        const currentDist = dist(e.touches);
        const { startDist, startDomain } = pinchStateRef.current;
        if (startDist <= 0) return;
        const factor = startDist / currentDist;
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const relX = Math.min(1, Math.max(0, (midX - rect.left) / rect.width));
        const center = startDomain[0] + relX * (startDomain[1] - startDomain[0]);
        const next = zoomAround(center, factor, startDomain);
        if (next[0] <= fullMinT + 1e-6 && next[1] >= fullMaxT - 1e-6) setZoom(null);
        else setZoom(next);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchStateRef.current = null;
      if (e.touches.length === 0) {
        gestureActiveRef.current = false;
        document.body.style.overflow = "";
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: false });
    el.addEventListener("touchcancel", onTouchEnd, { passive: false });

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      document.body.style.overflow = "";
    };
  }, [zoom, fullMinT, fullMaxT, zoomAround]);

  const resetZoom = useCallback(() => setZoom(null), []);

  if (!points.length) {
    return (
      <div className="flex h-[460px] w-full items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
        No data captured yet.
      </div>
    );
  }

  return (
    <div className="h-[460px] w-full" style={{ minHeight: 460 }}>
      <div className="mb-2 flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          Scroll or pinch on the graph to zoom
        </div>
        <div className="flex items-center gap-2">
          {zoom && (
            <button
              onClick={resetZoom}
              className="rounded-sm border border-border bg-card px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-foreground hover:bg-accent"
            >
              Reset Zoom
            </button>
          )}
          {datasetLabel && (
            <span className="rounded-sm border border-border bg-card px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {datasetLabel}
            </span>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        onDoubleClick={resetZoom}
        style={{ touchAction: "none", overscrollBehavior: "contain", height: 460 - 28, minHeight: 300, width: "100%", overflow: "hidden", position: "relative" }}
      >
        <ResponsiveContainer width="100%" height="100%" minHeight={300}>
          <ComposedChart data={data} margin={{ top: 20, right: 32, left: 12, bottom: 24 }}>
            <defs>
              <linearGradient id="currentFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="var(--current)" stopOpacity={0.55} />
                <stop offset="100%" stopColor="var(--current)" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="var(--grid-line)" strokeDasharray="2 4" />

            <XAxis
              type="number" dataKey="time" domain={domain} allowDataOverflow ticks={ticks}
              stroke="var(--muted-foreground)"
              tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontFamily: "var(--font-mono)" }}
              tickFormatter={(v) => (timeUnit === "MS" ? `${v}` : v.toFixed(1))}
              label={{ value: `Time (${tLabel})`, position: "insideBottom", offset: -10, fill: "var(--foreground)", fontSize: 12, fontWeight: 700, fontFamily: "var(--font-display)" }}
            />
            <YAxis
              scale={yScale}
              domain={yScale === "log" ? [1, "auto"] : leftDomain}
              ticks={logTicks}
              allowDataOverflow
              stroke="var(--current)"
              tick={{ fill: "var(--current)", fontSize: 11, fontFamily: "var(--font-mono)" }}
              tickFormatter={(v) => Number(v).toFixed(0)}
              label={{ value: `Current (${iLabel})`, angle: -90, position: "insideLeft", fill: "var(--current)", fontSize: 12, fontWeight: 700, fontFamily: "var(--font-display)" }}
            />

            {showVoltage && (
              <YAxis
                yAxisId="voltage" orientation="right"
                stroke="#38bdf8"
                tick={{ fill: "#38bdf8", fontSize: 11, fontFamily: "var(--font-mono)" }}
                label={{ value: "Voltage (V)", angle: 90, position: "insideRight", fill: "#38bdf8", fontSize: 12, fontWeight: 700, fontFamily: "var(--font-display)" }}
              />
            )}

            {peakDisplay > 0 && (
              <ReferenceLine
                y={peakDisplay} stroke="var(--peak)" strokeDasharray="4 4"
                label={{ value: `Peak ${peakDisplay} ${iLabel}`, fill: "var(--peak)", fontSize: 11, fontFamily: "var(--font-mono)", position: "insideTopRight" }}
              />
            )}

            <Tooltip
              contentStyle={{ background: "color-mix(in oklab, var(--popover) 96%, transparent)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--popover-foreground)", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}
              labelStyle={{ color: "var(--foreground)", fontWeight: 700 }}
              labelFormatter={(v) => `t = ${timeUnit === "MS" ? v : Number(v).toFixed(3)} ${tLabel}`}
              formatter={((value: unknown) => [`${value} ${iLabel}`, "Current"]) as never}
            />

            <Area
              type="monotone" dataKey="current" name={`Current (${iLabel})`}
              stroke="var(--current)" strokeWidth={2.4} fill="url(#currentFill)"
              isAnimationActive={false} dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--background)" }}
            />

            {/* Highlighted locked/trustworthy tau window — only shown when the checkbox is on */}
            {showSmoothLine && (
              <Line
                type="monotone" dataKey="i_smooth" name="Locked / smooth region"
                stroke="#00e5ff" strokeWidth={3.5} dot={false} connectNulls={false}
                isAnimationActive={false}
              />
            )}

            {/* Voltage overlay — off by default. Reads p.voltage directly, so once
                real hardware sends non-zero voltage this appears automatically,
                no code change needed. */}
            {showVoltage && (
              <Line
                yAxisId="voltage" type="monotone" dataKey="voltage" name="Voltage (V)"
                stroke="#38bdf8" strokeWidth={2} dot={false}
                isAnimationActive={false}
              />
            )}

            {breakPoint && (
              <ReferenceDot
                x={+timeInDisplayUnit(breakPoint.timestamp, timeUnit).toFixed(timeUnit === "MS" ? 0 : 3)}
                y={+convertCurrentUnit(breakPoint.current, currentUnit).toFixed(currentUnit === "mA" ? 0 : 3)}
                r={6} fill="black" stroke="white"
                label={{ value: "Break", position: "top", fill: "var(--foreground)", fontSize: 11 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-1 flex items-center justify-between px-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        <span>
          Window: {timeUnit === "MS" ? domain[0].toFixed(0) : domain[0].toFixed(2)} → {timeUnit === "MS" ? domain[1].toFixed(0) : domain[1].toFixed(2)} {tLabel}
        </span>
        <span>{data.length} packets in view</span>
      </div>
    </div>
  );
}