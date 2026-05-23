import { useMemo } from "react";
import {
  Area, ComposedChart, CartesianGrid, Legend, ResponsiveContainer,
  Tooltip, XAxis, YAxis, ReferenceLine, Line,
} from "recharts";
import type { CurrentUnit, ReactorSample, TimeUnit } from "@/types/sample";
import {
  convertCurrentUnit, convertTimeUnit, currentUnitLabel, timeUnitLabel,
} from "@/utils/unitConversion";

interface Props {
  samples: ReactorSample[];
  timeUnit: TimeUnit;
  currentUnit: CurrentUnit;
  peakCurrent: number;
}

/**
 * X-axis ticks:
 *  - duration ≤ 5 (display units): 0.5 step  → 0, 0.5, 1.0, ...
 *  - duration  > 5: 1.0 step                 → 0, 1, 2, ...
 * Adapts automatically to MS (×1000).
 */
function buildTicks(maxTime: number, unit: TimeUnit): number[] {
  if (!isFinite(maxTime) || maxTime <= 0) return [0];
  const fiveInUnit = unit === "MS" ? 5000 : 5;
  const stepFine   = unit === "MS" ? 500  : 0.5;
  const stepCoarse = unit === "MS" ? 1000 : 1;
  const step = maxTime <= fiveInUnit ? stepFine : stepCoarse;

  const end = Math.ceil(maxTime / step) * step;
  const out: number[] = [];
  for (let t = 0; t <= end + 1e-9; t += step) {
    out.push(+t.toFixed(unit === "MS" ? 0 : 2));
  }
  return out;
}

export function VoltageCurrentGraph({ samples, timeUnit, currentUnit, peakCurrent }: Props) {
  const { data, ticks, maxT } = useMemo(() => {
    const d = samples.map((s) => ({
      time:    +convertTimeUnit(s.time, timeUnit).toFixed(timeUnit === "MS" ? 0 : 3),
      current: +convertCurrentUnit(s.current, currentUnit).toFixed(currentUnit === "mA" ? 0 : 3),
      voltage: s.voltage ?? null,
      phase:   s.phase,
    }));
    const m = d.length ? d[d.length - 1].time : 0;
    return { data: d, ticks: buildTicks(m, timeUnit), maxT: m };
  }, [samples, timeUnit, currentUnit]);

  const tLabel = timeUnitLabel(timeUnit);
  const iLabel = currentUnitLabel(currentUnit);
  const peakDisplay = +convertCurrentUnit(peakCurrent, currentUnit).toFixed(currentUnit === "mA" ? 0 : 2);

  return (
    <div className="h-[460px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 20, right: 32, left: 12, bottom: 24 }}>
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
            domain={[0, ticks[ticks.length - 1] || "auto"]}
            ticks={ticks}
            stroke="var(--muted-foreground)"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            tickFormatter={(v) => (timeUnit === "MS" ? `${v}` : v.toFixed(1))}
            label={{
              value: `Time (${tLabel})`,
              position: "insideBottom",
              offset: -10,
              fill: "var(--foreground)",
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "var(--font-display)",
            }}
          />
          <YAxis
            yAxisId="left"
            stroke="var(--current)"
            tick={{ fill: "var(--current)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            label={{
              value: `Current (${iLabel})`,
              angle: -90,
              position: "insideLeft",
              fill: "var(--current)",
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "var(--font-display)",
            }}
            domain={[0, "auto"]}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="var(--voltage)"
            tick={{ fill: "var(--voltage)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            label={{
              value: "Voltage (V)",
              angle: 90,
              position: "insideRight",
              fill: "var(--voltage)",
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "var(--font-display)",
            }}
            domain={["auto", "auto"]}
          />

          {peakDisplay > 0 && (
            <ReferenceLine
              yAxisId="left"
              y={peakDisplay}
              stroke="var(--peak)"
              strokeDasharray="4 4"
              label={{
                value: `Peak ${peakDisplay} ${iLabel}`,
                fill: "var(--peak)",
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                position: "insideTopRight",
              }}
            />
          )}

          <Tooltip
            contentStyle={{
              background: "color-mix(in oklab, var(--popover) 96%, transparent)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              color: "var(--popover-foreground)",
              boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)",
            }}
            labelStyle={{ color: "var(--foreground)", fontWeight: 700 }}
            labelFormatter={(v) => `t = ${timeUnit === "MS" ? v : Number(v).toFixed(3)} ${tLabel}`}
            formatter={((value: unknown, name: unknown) => {
              const n = String(name).toLowerCase();
              const unit = n.includes("voltage") ? "V" : iLabel;
              return [`${value} ${unit}`, name];
            }) as never}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)", paddingTop: 8 }}
            iconType="line"
          />

          <Area
            yAxisId="left"
            type="monotone"
            dataKey="current"
            name={`Current (${iLabel})`}
            stroke="var(--current)"
            strokeWidth={2.4}
            fill="url(#currentFill)"
            isAnimationActive={false}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--background)" }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="voltage"
            name="Voltage (V)"
            stroke="var(--voltage)"
            strokeWidth={1.4}
            strokeDasharray="3 3"
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-1 flex items-center justify-between px-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        <span>Window: 0 → {timeUnit === "MS" ? maxT : maxT.toFixed(2)} {tLabel}</span>
        <span>Tick: {timeUnit === "MS" ? (maxT <= 5000 ? "500 ms" : "1000 ms") : (maxT <= 5 ? "0.5 s" : "1.0 s")}</span>
      </div>
    </div>
  );
}
