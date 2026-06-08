import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import {
  Area, ComposedChart, CartesianGrid, Legend, ResponsiveContainer,
  Tooltip, XAxis, YAxis, ReferenceLine, Line,
} from "recharts";
import { RotateCcw, ZoomIn } from "lucide-react";
import type { CurrentUnit, RawPoint, TimeUnit } from "@/types/sample";
import { convertCurrentUnit, currentUnitLabel, timeUnitLabel } from "@/utils/unitConversion";

interface Props {
  points: RawPoint[];
  timeUnit: TimeUnit;
  currentUnit: CurrentUnit;
  peakCurrent: number;
  showCurrent?: boolean;
  showVoltage?: boolean;
  datasetLabel?: string;
}

function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = Math.ceil(arr.length / max);
  const out: T[] = [];
  for (let i = 0; i < arr.length; i += step) out.push(arr[i]);
  if (out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1]);
  return out;
}
const MAX_PLOT = 600;

function buildTicks(min: number, max: number, unit: TimeUnit): number[] {
  if (!isFinite(max) || max <= min) return [min];
  const span = max - min;
  const targetCount = 10;
  // Pick a nice step
  const rawStep = span / targetCount;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const nice = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  const step = nice * mag;
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let t = start; t <= max + 1e-9; t += step) {
    out.push(+t.toFixed(unit === "MS" ? 1 : 4));
  }
  return out;
}

type Domain = [number, number];

export function VoltageCurrentGraph({
  points, timeUnit, currentUnit, peakCurrent,
  showCurrent = true, showVoltage = true, datasetLabel,
}: Props) {
  // ----- transform raw points to chart data -----
  const { data, baseX, baseYL, baseYR } = useMemo(() => {
    const slim = downsample(points, MAX_PLOT);
    const d = slim.map((p) => {
      const tSec = p.timestamp / 1000;
      return {
        time: +(timeUnit === "MS" ? p.timestamp : tSec).toFixed(timeUnit === "MS" ? 1 : 4),
        current: +convertCurrentUnit(p.current, currentUnit).toFixed(currentUnit === "mA" ? 1 : 3),
        voltage: +p.voltage.toFixed(2),
      };
    });
    if (!d.length) {
      return { data: d, baseX: [0, 1] as Domain, baseYL: [0, 1] as Domain, baseYR: [0, 1] as Domain };
    }
    const xs = d.map((p) => p.time);
    const cs = d.map((p) => p.current);
    const vs = d.map((p) => p.voltage);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const cMin = Math.min(0, ...cs), cMax = Math.max(...cs) * 1.05 || 1;
    const vMin = Math.min(...vs), vMax = Math.max(...vs);
    const vPad = (vMax - vMin) * 0.08 || 1;
    return {
      data: d,
      baseX: [xMin, xMax] as Domain,
      baseYL: [cMin, cMax] as Domain,
      baseYR: [vMin - vPad, vMax + vPad] as Domain,
    };
  }, [points, timeUnit, currentUnit]);

  // ----- zoom state -----
  const [xDom, setXDom] = useState<Domain | null>(null);
  const [yLDom, setYLDom] = useState<Domain | null>(null);
  const [yRDom, setYRDom] = useState<Domain | null>(null);

  // Reset when underlying data changes substantially (new test, etc.)
  useEffect(() => {
    setXDom(null); setYLDom(null); setYRDom(null);
  }, [points.length === 0]);

  const reset = () => { setXDom(null); setYLDom(null); setYRDom(null); };

  const xCurr = xDom ?? baseX;
  const yLCurr = yLDom ?? baseYL;
  const yRCurr = yRDom ?? baseYR;

  // ----- wheel zoom anchored at cursor -----
  const containerRef = useRef<HTMLDivElement>(null);
  // Approximate chart plot rect (recharts margins): left=64 right=64 top=20 bottom=44
  const MARGIN = { left: 64, right: 64, top: 20, bottom: 44 };

  const onWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!containerRef.current || !data.length) return;
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const plotW = rect.width  - MARGIN.left - MARGIN.right;
    const plotH = rect.height - MARGIN.top  - MARGIN.bottom;
    const inPlotX = px >= MARGIN.left && px <= rect.width - MARGIN.right;
    const inPlotY = py >= MARGIN.top  && py <= rect.height - MARGIN.bottom;

    const factor = e.deltaY < 0 ? 0.85 : 1 / 0.85; // zoom in / out
    const zoomDomain = (d: Domain, anchorFrac: number): Domain => {
      const [lo, hi] = d;
      const span = hi - lo;
      const newSpan = Math.max(span * factor, 1e-9);
      const anchor = lo + anchorFrac * span;
      let nLo = anchor - anchorFrac * newSpan;
      let nHi = nLo + newSpan;
      return [nLo, nHi];
    };

    if (e.shiftKey || !inPlotY) {
      // X-only
      const fx = Math.max(0, Math.min(1, (px - MARGIN.left) / plotW));
      setXDom(zoomDomain(xCurr, fx));
    } else if (e.altKey || !inPlotX) {
      // Y-only (left axis primary; mirror right)
      const fy = 1 - Math.max(0, Math.min(1, (py - MARGIN.top) / plotH));
      setYLDom(zoomDomain(yLCurr, fy));
      setYRDom(zoomDomain(yRCurr, fy));
    } else {
      // Zoom both
      const fx = Math.max(0, Math.min(1, (px - MARGIN.left) / plotW));
      const fy = 1 - Math.max(0, Math.min(1, (py - MARGIN.top) / plotH));
      setXDom(zoomDomain(xCurr, fx));
      setYLDom(zoomDomain(yLCurr, fy));
      setYRDom(zoomDomain(yRCurr, fy));
    }
  }, [data.length, xCurr, yLCurr, yRCurr]);

  // attach non-passive wheel listener so preventDefault works
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => onWheel(e as unknown as React.WheelEvent<HTMLDivElement>);
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [onWheel]);

  const ticks = useMemo(() => buildTicks(xCurr[0], xCurr[1], timeUnit), [xCurr, timeUnit]);
  const tLabel = timeUnitLabel(timeUnit);
  const iLabel = currentUnitLabel(currentUnit);
  const peakDisplay = +convertCurrentUnit(peakCurrent, currentUnit).toFixed(currentUnit === "mA" ? 0 : 2);
  const zoomed = !!(xDom || yLDom || yRDom);

  return (
    <div className="relative">
      <div className="mb-2 flex items-center justify-between gap-3">
        {datasetLabel ? (
          <div className="inline-block rounded-sm border border-border bg-card/60 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
            {datasetLabel}
          </div>
        ) : <div />}
        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:inline-flex items-center gap-1">
            <ZoomIn className="h-3 w-3" /> Scroll = zoom · Shift = X · Alt = Y
          </span>
          {zoomed && (
            <button
              onClick={reset}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-foreground transition hover:bg-accent"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
        </div>
      </div>

      <div ref={containerRef} className="h-[460px] w-full cursor-crosshair select-none">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: MARGIN.top, right: MARGIN.right, left: MARGIN.left - 52, bottom: MARGIN.bottom - 20 }}>
            <defs>
              <linearGradient id="currentFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="var(--current)" stopOpacity={0.55} />
                <stop offset="100%" stopColor="var(--current)" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="var(--grid-line)" strokeDasharray="2 4" />

            <XAxis
              type="number"
              dataKey="time"
              domain={xCurr}
              ticks={ticks}
              allowDataOverflow
              stroke="var(--muted-foreground)"
              tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontFamily: "var(--font-mono)" }}
              tickFormatter={(v) => (timeUnit === "MS" ? `${Number(v).toFixed(0)}` : Number(v).toFixed(2))}
              label={{
                value: `Time (${tLabel})`, position: "insideBottom", offset: -10,
                fill: "var(--foreground)", fontSize: 12, fontWeight: 700,
                fontFamily: "var(--font-display)",
              }}
            />
            <YAxis
              yAxisId="left"
              domain={yLCurr}
              allowDataOverflow
              stroke="var(--current)"
              tick={{ fill: "var(--current)", fontSize: 11, fontFamily: "var(--font-mono)" }}
              label={{
                value: `Current (${iLabel})`, angle: -90, position: "insideLeft",
                fill: "var(--current)", fontSize: 12, fontWeight: 700, fontFamily: "var(--font-display)",
              }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={yRCurr}
              allowDataOverflow
              stroke="var(--voltage)"
              tick={{ fill: "var(--voltage)", fontSize: 11, fontFamily: "var(--font-mono)" }}
              label={{
                value: "Voltage (V)", angle: 90, position: "insideRight",
                fill: "var(--voltage)", fontSize: 12, fontWeight: 700, fontFamily: "var(--font-display)",
              }}
            />

            {peakDisplay > 0 && (
              <ReferenceLine
                yAxisId="left" y={peakDisplay} stroke="var(--peak)" strokeDasharray="4 4"
                label={{
                  value: `Peak ${peakDisplay} ${iLabel}`, fill: "var(--peak)",
                  fontSize: 11, fontFamily: "var(--font-mono)", position: "insideTopRight",
                }}
              />
            )}

            <Tooltip
              contentStyle={{
                background: "color-mix(in oklab, var(--popover) 96%, transparent)",
                border: "1px solid var(--border)", borderRadius: 6, fontSize: 12,
                fontFamily: "var(--font-mono)", color: "var(--popover-foreground)",
                boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)",
              }}
              labelStyle={{ color: "var(--foreground)", fontWeight: 700 }}
              labelFormatter={(v) => `t = ${timeUnit === "MS" ? Number(v).toFixed(1) : Number(v).toFixed(3)} ${tLabel}`}
              formatter={((value: unknown, name: unknown) => {
                const n = String(name).toLowerCase();
                const unit = n.includes("voltage") ? "V" : iLabel;
                return [`${value} ${unit}`, name];
              }) as never}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)", paddingTop: 22 }}
              iconType="line"
            />

            {showCurrent && (
              <Area
                yAxisId="left" type="monotone" dataKey="current"
                name={`Current (${iLabel})`}
                stroke="var(--current)" strokeWidth={2.4} fill="url(#currentFill)"
                isAnimationActive={false} dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--background)" }}
              />
            )}
            {showVoltage && (
              <Line
                yAxisId="right" type="monotone" dataKey="voltage"
                name="Voltage (V)" stroke="var(--voltage)" strokeWidth={1.4}
                strokeDasharray="3 3" dot={false} isAnimationActive={false} connectNulls
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-1 flex items-center justify-between px-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        <span>
          X: {(timeUnit === "MS" ? xCurr[0].toFixed(0) : xCurr[0].toFixed(2))} → {(timeUnit === "MS" ? xCurr[1].toFixed(0) : xCurr[1].toFixed(2))} {tLabel}
        </span>
        <span>Points: {data.length} / {points.length}</span>
      </div>
    </div>
  );
}
