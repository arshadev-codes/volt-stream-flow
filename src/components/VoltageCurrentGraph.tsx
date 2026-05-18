import { useMemo } from "react";
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import type { CurrentUnit, Sample, TimeUnit } from "@/types/sample";
import {
  convertCurrentUnit, convertTimeUnit, currentUnitLabel, timeUnitLabel,
} from "@/utils/unitConversion";

interface Props {
  samples: Sample[];
  timeUnit: TimeUnit;
  currentUnit: CurrentUnit;
}

export function VoltageCurrentGraph({ samples, timeUnit, currentUnit }: Props) {
  const data = useMemo(
    () =>
      samples.map((s) => ({
        time: +convertTimeUnit(s.time, timeUnit).toFixed(timeUnit === "MS" ? 0 : 2),
        voltage: s.voltage,
        current: +convertCurrentUnit(s.current, currentUnit).toFixed(currentUnit === "mA" ? 0 : 3),
      })),
    [samples, timeUnit, currentUnit],
  );

  const tLabel = timeUnitLabel(timeUnit);
  const iLabel = currentUnitLabel(currentUnit);

  return (
    <div className="h-[420px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
          <CartesianGrid stroke="hsl(var(--chart-grid))" strokeDasharray="3 3" />
          <XAxis
            dataKey="time"
            stroke="#64748b"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            label={{ value: `Time (${tLabel})`, position: "insideBottom", offset: -2, fill: "#94a3b8", fontSize: 11 }}
          />
          <YAxis
            yAxisId="v"
            domain={[200, 250]}
            stroke="#38bdf8"
            tick={{ fill: "#38bdf8", fontSize: 11 }}
            label={{ value: "Voltage (V)", angle: -90, position: "insideLeft", fill: "#38bdf8", fontSize: 11 }}
          />
          <YAxis
            yAxisId="i"
            orientation="right"
            domain={currentUnit === "mA" ? [0, 5500] : [0, 5.5]}
            stroke="#fb923c"
            tick={{ fill: "#fb923c", fontSize: 11 }}
            label={{ value: `Current (${iLabel})`, angle: 90, position: "insideRight", fill: "#fb923c", fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(15,23,42,0.95)",
              border: "1px solid rgba(148,163,184,0.2)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#cbd5e1" }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            yAxisId="v"
            type="monotone"
            dataKey="voltage"
            name={`Voltage (V)`}
            stroke="#38bdf8"
            strokeWidth={2}
            dot={false}
            isAnimationActive
            animationDuration={350}
          />
          <Line
            yAxisId="i"
            type="monotone"
            dataKey="current"
            name={`Current (${iLabel})`}
            stroke="#fb923c"
            strokeWidth={2}
            dot={false}
            isAnimationActive
            animationDuration={350}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
