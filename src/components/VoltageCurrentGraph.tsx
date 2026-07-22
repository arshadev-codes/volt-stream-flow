import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import uPlot, { type Options, type AlignedData } from "uplot";
import "uplot/dist/uPlot.min.css";
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
  /** Called whenever the visible X range changes (in the units displayed). */
  onRangeChange?: (range: [number, number] | null) => void;
}

export interface VoltageCurrentGraphRef {
  /** Reset the X-axis to the full recorded range. */
  resetZoom: () => void;
}

/**
 * Read a CSS custom property from a DOM element with a sensible fallback.
 * uPlot needs concrete colors (no `var(--x)`), so we resolve them at runtime.
 */
function cssVar(el: HTMLElement, name: string, fallback: string) {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

export const VoltageCurrentGraph = forwardRef<VoltageCurrentGraphRef, Props>(
  ({
    points,
    timeUnit,
    currentUnit,
    peakCurrent,
    showCurrent = true,
    showVoltage = true,
    datasetLabel,
    onRangeChange,
  }, ref) => {
    const wrapRef = useRef<HTMLDivElement>(null);
    const plotRef = useRef<uPlot | null>(null);
    const [hover, setHover] = useState<{ t: number; v: number; c: number } | null>(null);
    const [zoomed, setZoomed] = useState(false);
    const userZoomedRef = useRef(false);
    // Live refs so uPlot hooks always see the current base range, not the range
    // captured when the plot instance was created.
    const baseXMinRef = useRef(0);
    const baseXMaxRef = useRef(1);

    // ----- transform points -> AlignedData -----
    const { data, baseXMin, baseXMax, peakDisplay, tLabel, iLabel } = useMemo(() => {
      const t = new Float64Array(points.length);
      const c = new Float64Array(points.length);
      const v = new Float64Array(points.length);
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        t[i] = timeUnit === "MS" ? p.timestamp : p.timestamp / 1000;
        c[i] = convertCurrentUnit(p.current, currentUnit);
        v[i] = p.voltage;
      }
      const xMin = points.length ? t[0] : 0;
      const xMax = points.length ? t[t.length - 1] : 1;
      return {
        data: [t, c, v] as unknown as AlignedData,
        baseXMin: xMin,
        baseXMax: xMax === xMin ? xMin + 1 : xMax,
        peakDisplay: +convertCurrentUnit(peakCurrent, currentUnit).toFixed(currentUnit === "mA" ? 0 : 2),
        tLabel: timeUnitLabel(timeUnit),
        iLabel: currentUnitLabel(currentUnit),
      };
    }, [points, timeUnit, currentUnit, peakCurrent]);

    // Expose a reset method so the parent can force a full-range view on demand.
    useImperativeHandle(ref, () => ({
      resetZoom: () => {
        const u = plotRef.current;
        if (!u) return;
        userZoomedRef.current = false;
        u.setScale("x", { min: baseXMin, max: baseXMax });
      },
    }), [baseXMin, baseXMax]);

    // ----- build / rebuild plot when units, visibility, or label change -----
    useEffect(() => {
      const wrap = wrapRef.current;
      if (!wrap) return;

      // Tear down any previous instance.
      plotRef.current?.destroy();
      plotRef.current = null;
      userZoomedRef.current = false;

      const COLORS = {
        grid: cssVar(wrap, "--grid-line", "rgba(148,163,184,0.18)"),
        axis: cssVar(wrap, "--muted-foreground", "#64748B"),
        fg: cssVar(wrap, "--foreground", "#0F172A"),
        current: cssVar(wrap, "--current", "#EA580C"),
        voltage: cssVar(wrap, "--voltage", "#0EA5E9"),
        peak: cssVar(wrap, "--peak", "#F59E0B"),
        bg: cssVar(wrap, "--card", "#0B1220"),
      };

      const opts: Options = {
        width: wrap.clientWidth || 800,
        height: 460,
        pxAlign: false,
        cursor: {
          drag: { x: true, y: false, uni: 20 }, // box-drag to zoom in
          focus: { prox: 24 },
          points: { size: 7 },
        },
        legend: { show: false },
        scales: {
          x: { time: false },
          y: { auto: true },
          v: { auto: true },
        },
        axes: [
          {
            stroke: COLORS.axis,
            grid: { stroke: COLORS.grid, width: 1, dash: [2, 4] },
            ticks: { stroke: COLORS.grid, width: 1 },
            font: '11px "JetBrains Mono", ui-monospace, monospace',
            labelFont: '700 12px "Montserrat", ui-sans-serif',
            label: `Time (${tLabel})`,
            labelGap: 6,
            values: (_u, splits) =>
              splits.map((s) => (timeUnit === "MS" ? s.toFixed(0) : s.toFixed(2))),
          },
          {
            scale: "y",
            stroke: COLORS.current,
            grid: { stroke: COLORS.grid, width: 1, dash: [2, 4] },
            ticks: { stroke: COLORS.grid, width: 1 },
            font: '11px "JetBrains Mono", ui-monospace, monospace',
            labelFont: `700 12px "Montserrat", ui-sans-serif`,
            label: `Current (${iLabel})`,
            labelGap: 6,
            values: (_u, splits) =>
              splits.map((s) => (currentUnit === "mA" ? s.toFixed(0) : s.toFixed(2))),
          },
          {
            scale: "v",
            side: 1,
            stroke: COLORS.voltage,
            grid: { show: false },
            ticks: { stroke: COLORS.grid, width: 1 },
            font: '11px "JetBrains Mono", ui-monospace, monospace',
            labelFont: '700 12px "Montserrat", ui-sans-serif',
            label: "Voltage (V)",
            labelGap: 6,
            values: (_u, splits) => splits.map((s) => s.toFixed(0)),
          },
        ],
        series: [
          {},
          {
            label: `Current (${iLabel})`,
            stroke: COLORS.current,
            width: 2,
            fill: (u) => {
              const ctx = u.ctx;
              const grd = ctx.createLinearGradient(0, u.bbox.top, 0, u.bbox.top + u.bbox.height);
              grd.addColorStop(0, hexToRgba(COLORS.current, 0.45));
              grd.addColorStop(1, hexToRgba(COLORS.current, 0.0));
              return grd;
            },
            scale: "y",
            show: showCurrent,
            points: { show: false },
          },
          {
            label: "Voltage (V)",
            stroke: COLORS.voltage,
            width: 1.4,
            dash: [4, 4],
            scale: "v",
            show: showVoltage,
            points: { show: false },
          },
        ],
        hooks: {
          // draw peak reference line on top of plot
          draw: [
            (u) => {
              if (peakDisplay <= 0) return;
              const yPx = u.valToPos(peakDisplay, "y", true);
              if (!Number.isFinite(yPx)) return;
              const ctx = u.ctx;
              ctx.save();
              ctx.beginPath();
              ctx.setLineDash([6, 4]);
              ctx.strokeStyle = COLORS.peak;
              ctx.lineWidth = 1.2;
              ctx.moveTo(u.bbox.left, yPx);
              ctx.lineTo(u.bbox.left + u.bbox.width, yPx);
              ctx.stroke();
              ctx.setLineDash([]);
              ctx.fillStyle = COLORS.peak;
              ctx.font = '700 10px "JetBrains Mono", ui-monospace, monospace';
              ctx.textAlign = "right";
              ctx.textBaseline = "bottom";
              ctx.fillText(`PEAK ${peakDisplay} ${iLabel}`, u.bbox.left + u.bbox.width - 6, yPx - 3);
              ctx.restore();
            },
          ],
          setCursor: [
            (u) => {
              const i = u.cursor.idx;
              if (i == null || i < 0) { setHover(null); return; }
              const xs = u.data[0] as unknown as Float64Array;
              const cs = u.data[1] as unknown as Float64Array;
              const vs = u.data[2] as unknown as Float64Array;
              if (!xs || !xs.length) { setHover(null); return; }
              setHover({ t: xs[i], c: cs[i], v: vs[i] });
            },
          ],
          setScale: [
            (u, key) => {
              if (key !== "x") return;
              const bMin = baseXMinRef.current;
              const bMax = baseXMaxRef.current;
              const [min, max] = u.scales.x.min != null && u.scales.x.max != null
                ? [u.scales.x.min, u.scales.x.max]
                : [bMin, bMax];
              const span = Math.max(bMax - bMin, 1e-9);
              const tol = span * 1e-6;
              const isZoomed = !(min <= bMin + tol && max >= bMax - tol);
              setZoomed(isZoomed);
              userZoomedRef.current = isZoomed;
              onRangeChange?.(isZoomed ? [min, max] : null);
            },
          ],
        },
      };

      const u = new uPlot(opts, data, wrap);
      plotRef.current = u;

      // initial autoscale
      u.setScale("x", { min: baseXMin, max: baseXMax });

      // ResizeObserver -> smooth resize
      const ro = new ResizeObserver(() => {
        const w = wrap.clientWidth;
        if (w > 0) u.setSize({ width: w, height: 460 });
      });
      ro.observe(wrap);

      return () => {
        ro.disconnect();
        u.destroy();
        plotRef.current = null;
      };
      // Rebuild on these structural changes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeUnit, currentUnit, showCurrent, showVoltage]);

    // ----- push new data without rebuilding -----
    const prevPointsLenRef = useRef(0);
    useEffect(() => {
      const u = plotRef.current;
      if (!u) return;

      // Keep base-range refs current so uPlot hooks compare against fresh bounds.
      baseXMinRef.current = baseXMin;
      baseXMaxRef.current = baseXMax;

      const prevMin = u.scales.x.min;
      const prevMax = u.scales.x.max;
      const prevLen = prevPointsLenRef.current;
      prevPointsLenRef.current = points.length;

      // A shrink in sample count means a new test / clear -> force full range.
      const isReset = points.length < prevLen;
      if (isReset) {
        userZoomedRef.current = false;
        setZoomed(false);
        onRangeChange?.(null);
      }

      // If the user has actively zoomed, keep that window and clamp it to the new data bounds.
      // Otherwise, always snap to the full recorded range so the live trace never appears zoomed in.
      u.setData(data, !userZoomedRef.current);
      if (!isReset && userZoomedRef.current && prevMin != null && prevMax != null) {
        const clampedMin = Math.max(prevMin, baseXMin);
        const clampedMax = Math.min(prevMax, baseXMax);
        if (clampedMax > clampedMin) {
          u.setScale("x", { min: clampedMin, max: clampedMax });
        } else {
          u.setScale("x", { min: baseXMin, max: baseXMax });
        }
      } else {
        u.setScale("x", { min: baseXMin, max: baseXMax });
      }
    }, [data, baseXMin, baseXMax]);

    // ----- wheel zoom: in always; out only until we reach the full base range -----
    const onWheel = useCallback(
      (e: WheelEvent) => {
        const u = plotRef.current;
        if (!u) return;
        e.preventDefault();

        const rect = u.over.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        if (cx < 0 || cx > rect.width) return;

        const curMin = u.scales.x.min ?? baseXMin;
        const curMax = u.scales.x.max ?? baseXMax;
        const span = curMax - curMin;
        const baseSpan = baseXMax - baseXMin;

        const zoomIn = e.deltaY < 0;
        // If already at full range and trying to zoom out, do nothing.
        if (!zoomIn && span >= baseSpan - 1e-9) return;

        const factor = zoomIn ? 0.82 : 1 / 0.82;
        let newSpan = span * factor;
        // Clamp zoom-out so we never overshoot the original full span.
        if (!zoomIn && newSpan > baseSpan) newSpan = baseSpan;
        // Sensible inner limit
        newSpan = Math.max(newSpan, baseSpan * 1e-4);

        const anchor = u.posToVal(cx, "x");
        const frac = (anchor - curMin) / span;

        let newMin = anchor - frac * newSpan;
        let newMax = newMin + newSpan;

        // Clamp to base range
        if (newMin < baseXMin) { newMin = baseXMin; newMax = newMin + newSpan; }
        if (newMax > baseXMax) { newMax = baseXMax; newMin = newMax - newSpan; }
        if (newMin < baseXMin) newMin = baseXMin;

        userZoomedRef.current = true;
        u.setScale("x", { min: newMin, max: newMax });
      },
      [baseXMin, baseXMax],
    );

    useEffect(() => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      wrap.addEventListener("wheel", onWheel, { passive: false });
      return () => wrap.removeEventListener("wheel", onWheel);
    }, [onWheel]);

    const reset = useCallback(() => {
      const u = plotRef.current;
      if (!u) return;
      userZoomedRef.current = false;
      u.setScale("x", { min: baseXMin, max: baseXMax });
    }, [baseXMin, baseXMax]);

    const xRange = plotRef.current
      ? [plotRef.current.scales.x.min ?? baseXMin, plotRef.current.scales.x.max ?? baseXMax]
      : [baseXMin, baseXMax];

    return (
      <div className="relative">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          {datasetLabel ? (
            <div className="inline-block rounded-sm border border-border bg-card/60 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
              {datasetLabel}
            </div>
          ) : <div />}

          <div className="flex items-center gap-2">
            {hover && (
              <div className="hidden items-center gap-3 rounded-md border border-border bg-card/80 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:inline-flex">
                <span>t <span className="ml-1 text-foreground">{timeUnit === "MS" ? hover.t.toFixed(1) : hover.t.toFixed(3)} {tLabel}</span></span>
                <span style={{ color: "var(--current)" }}>I <span className="ml-1">{currentUnit === "mA" ? hover.c.toFixed(0) : hover.c.toFixed(2)} {iLabel}</span></span>
                <span style={{ color: "var(--voltage)" }}>V <span className="ml-1">{hover.v.toFixed(1)} V</span></span>
              </div>
            )}
            <span className="hidden items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:inline-flex">
              <ZoomIn className="h-3 w-3" /> Scroll · Drag-X · Reset
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

        <div
          ref={wrapRef}
          className="uplot-wrap w-full overflow-hidden rounded-md border border-border bg-card/40 select-none"
          style={{ height: 460 }}
        />

        <div className="mt-1 flex items-center justify-between px-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          <span>
            X: {(timeUnit === "MS" ? xRange[0].toFixed(0) : xRange[0].toFixed(2))} → {(timeUnit === "MS" ? xRange[1].toFixed(0) : xRange[1].toFixed(2))} {tLabel}
          </span>
          <span>Samples: {points.length.toLocaleString()}</span>
        </div>
      </div>
    );
  },
);

VoltageCurrentGraph.displayName = "VoltageCurrentGraph";

/** Convert a hex (#rrggbb), rgb(...) or named css color to rgba with given alpha. */
function hexToRgba(input: string, alpha: number): string {
  const s = input.trim();
  if (s.startsWith("#")) {
    const h = s.slice(1);
    const n = h.length === 3
      ? h.split("").map((c) => c + c).join("")
      : h.padEnd(6, "0").slice(0, 6);
    const r = parseInt(n.slice(0, 2), 16);
    const g = parseInt(n.slice(2, 4), 16);
    const b = parseInt(n.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  if (s.startsWith("rgb")) {
    return s.replace(/^rgba?\(([^)]+)\)/, (_m, body) => {
      const parts = body.split(",").map((p: string) => p.trim());
      return `rgba(${parts[0]},${parts[1]},${parts[2]},${alpha})`;
    });
  }
  return `rgba(234,88,12,${alpha})`;
}
