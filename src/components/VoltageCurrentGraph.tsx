import { useMemo } from "react";
import {
  Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer,
  Tooltip, XAxis, YAxis, ReferenceLine,
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

export function VoltageCurrentGraph({ samples, timeUnit, currentUnit, peakCurrent }: Props) {
  const data = useMemo(
    () =>
      samples.map((s) => ({
        time: +convertTimeUnit(s.time, timeUnit).toFixed(timeUnit === "MS" ? 0 : 2),
        current: +convertCurrentUnit(s.current, currentUnit).toFixed(currentUnit === "mA" ? 0 : 3),
        phase: s.phase,
      })),
    [samples, timeUnit, currentUnit],
  );

  const tLabel = timeUnitLabel(timeUnit);
  const iLabel = currentUnitLabel(currentUnit);
  const peakDisplay = +convertCurrentUnit(peakCurrent, currentUnit).toFixed(currentUnit === "mA" ? 0 : 2);

  return (
    <div className="h-[440px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 16, right: 24, left: 8, bottom: 16 }}>
          <defs>
            <linearGradient id="currentFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fb923c" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#fb923c" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#334155" strokeDasharray="3 3" opacity={0.5} />
          <XAxis
            dataKey="time"
            stroke="#cbd5e1"
            tick={{ fill: "#cbd5e1", fontSize: 12, fontWeight: 600 }}
            label={{ value: `Time (${tLabel})`, position: "insideBottom", offset: -8, fill: "#e2e8f0", fontSize: 12, fontWeight: 700 }}
          />
          <YAxis
            stroke="#fb923c"
            tick={{ fill: "#fdba74", fontSize: 12, fontWeight: 600 }}
            label={{ value: `Current (${iLabel})`, angle: -90, position: "insideLeft", fill: "#fdba74", fontSize: 12, fontWeight: 700 }}
            domain={[0, "auto"]}
          />
          {peakDisplay > 0 && (
            <ReferenceLine
              y={peakDisplay}
              stroke="#f43f5e"
              strokeDasharray="4 4"
              label={{ value: `Peak ${peakDisplay} ${iLabel}`, fill: "#fda4af", fontSize: 11, position: "insideTopRight" }}
            />
          )}
          <Tooltip
            contentStyle={{
              background: "rgba(15,23,42,0.98)",
              border: "1px solid #475569",
              borderRadius: 8,
              fontSize: 12,
              color: "#f1f5f9",
            }}
            labelStyle={{ color: "#e2e8f0", fontWeight: 700 }}
            formatter={(value: number, _name, props) => [
              `${value} ${iLabel}`,
              `Current (${props.payload?.phase ?? ""})`,
            ]}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#e2e8f0" }} />
          <Area
            type="monotone"
            dataKey="current"
            name={`Reactor Current (${iLabel})`}
            stroke="#fb923c"
            strokeWidth={2.5}
            fill="url(#currentFill)"
            isAnimationActive
            animationDuration={300}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
