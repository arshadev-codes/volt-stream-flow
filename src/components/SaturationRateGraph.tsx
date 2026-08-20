import { useMemo } from "react";
import { Line, ComposedChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import type { CurrentUnit, RawPoint } from "@/types/sample";
import { convertCurrentUnit, currentUnitLabel } from "@/utils/unitConversion";
import { computeIncrementalInductance } from "@/utils/reactorCalcs";

interface Props {
  points: RawPoint[];
  currentUnit: CurrentUnit;
  resistance?: number;
}

export function SaturationRateGraph({ points, currentUnit, resistance }: Props) {
  const iLabel = currentUnitLabel(currentUnit);

  const data = useMemo(() => {
    if (!resistance) return [];
    return computeIncrementalInductance(points, resistance)
      .filter((f) => isFinite(f.incrementalL))
      .map((f) => ({
        current: +convertCurrentUnit(f.current, currentUnit).toFixed(4),
        L: +f.incrementalL.toFixed(6),
      }))
      .sort((a, b) => a.current - b.current);
  }, [points, resistance, currentUnit]);

  const linearEstimate = useMemo(() => {
    if (data.length < 5) return null;
    const tail = data.slice(0, Math.max(3, Math.floor(data.length * 0.2)));
    const vals = tail.map((d) => d.L).sort((a, b) => a - b);
    return vals[Math.floor(vals.length / 2)];
  }, [data]);

  const yDomain = useMemo(() => {
  if (!data.length) return [0, 1];
  const vals = data.map((d) => d.L).sort((a, b) => a - b);
  const lo = vals[Math.floor(vals.length * 0.02)];
  const hi = vals[Math.ceil(vals.length * 0.98) - 1];
  return [lo, hi];
}, [data]);

  if (!resistance) {
    return (
      <div className="flex h-[460px] w-full items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
        No resistance (R) set on this test object — saturation rate can't be calculated.
      </div>
    );
  }

  if (data.length < 2) {
    return (
      <div className="flex h-[460px] w-full items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
        No data captured yet.
      </div>
    );
  }

  return (
    <div className="h-[460px] w-full">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        −dψ/di vs i — flattening marks the linear region (eq. B8) · R = {resistance} Ω
      </div>
      <ResponsiveContainer width="100%" height="92%">
        <ComposedChart data={data} margin={{ top: 20, right: 32, left: 12, bottom: 24 }}>
          <CartesianGrid stroke="var(--grid-line)" strokeDasharray="2 4" />
          <XAxis
            type="number" dataKey="current" domain={[0, "auto"]} allowDataOverflow
            stroke="var(--muted-foreground)"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            label={{
              value: `Current (${iLabel})`, position: "insideBottom", offset: -10,
              fill: "var(--foreground)", fontSize: 12, fontWeight: 700, fontFamily: "var(--font-display)",
            }}
          />
          <YAxis
            type="number" dataKey="L" stroke="var(--current)"
            tick={{ fill: "var(--current)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            label={{
              value: "R·τ (incremental L)", angle: -90, position: "insideLeft",
              fill: "var(--current)", fontSize: 12, fontWeight: 700, fontFamily: "var(--font-display)",
            }}
          />
          {linearEstimate != null && (
            <ReferenceLine
              y={linearEstimate} stroke="var(--peak)" strokeDasharray="4 4"
              label={{ value: "≈ linear region", fill: "var(--peak)", fontSize: 11, position: "insideTopRight" }}
            />
          )}
          <Tooltip
            contentStyle={{
              background: "color-mix(in oklab, var(--popover) 96%, transparent)",
              border: "1px solid var(--border)", borderRadius: 6, fontSize: 12,
              fontFamily: "var(--font-mono)", color: "var(--popover-foreground)",
            }}
          />
          <Line type="monotone" dataKey="L" stroke="var(--current)" strokeWidth={2.2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}