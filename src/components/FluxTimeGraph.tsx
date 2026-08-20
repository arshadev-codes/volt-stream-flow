import { useMemo } from "react";
import { Area, ComposedChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TimeUnit } from "@/types/sample";
import { timeUnitLabel } from "@/utils/unitConversion";
import type { FluxSamplePoint } from "@/utils/fluxCalculation";

interface Props {
  /** Pre-computed flux samples from createAnalyzedSample() — this graph just plots them. */
  fluxData: FluxSamplePoint[];
  timeUnit: TimeUnit;
  resistance?: number;
}

export function FluxTimeGraph({ fluxData, timeUnit, resistance }: Props) {
  const tLabel = timeUnitLabel(timeUnit);

  const data = useMemo(() => {
    return fluxData.map((f) => ({
      time: timeUnit === "MS" ? f.new_timestamp : f.new_timestamp / 1000,
      psi: f.linked_flux, // ψ'(t) — accumulated flux since t=0
    }));
  }, [fluxData, timeUnit]);

  if (!resistance || data.length < 2) {
    return (
      <div className="flex h-[460px] w-full items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
        {!resistance ? "No resistance (R) set." : "No data captured yet."}
      </div>
    );
  }

  return (
    <div className="h-[460px] w-full">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        ψ vs Time — IEC 60076-6 Fig B.5 · R = {resistance} Ω
      </div>
      <ResponsiveContainer width="100%" height="92%">
        <ComposedChart data={data} margin={{ top: 20, right: 32, left: 12, bottom: 24 }}>
          <defs>
            <linearGradient id="psiFillTime" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="var(--current)" stopOpacity={0.55} />
              <stop offset="100%" stopColor="var(--current)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--grid-line)" strokeDasharray="2 4" />
          <XAxis
            type="number" dataKey="time" domain={["auto", "auto"]}
            stroke="var(--muted-foreground)"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            label={{
              value: `Time (${tLabel})`, position: "insideBottom", offset: -10,
              fill: "var(--foreground)", fontSize: 12, fontWeight: 700, fontFamily: "var(--font-display)",
            }}
          />
          <YAxis
            type="number" dataKey="psi" stroke="var(--current)"
            tick={{ fill: "var(--current)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            label={{
              value: "ψ Linked Flux (Wb-turns)", angle: -90, position: "insideLeft",
              fill: "var(--current)", fontSize: 12, fontWeight: 700, fontFamily: "var(--font-display)",
            }}
          />
          <Tooltip
            contentStyle={{
              background: "color-mix(in oklab, var(--popover) 96%, transparent)",
              border: "1px solid var(--border)", borderRadius: 6, fontSize: 12,
              fontFamily: "var(--font-mono)", color: "var(--popover-foreground)",
            }}
          />
          <Area
            type="monotone"
            dataKey="psi"
            stroke="var(--current)"
            strokeWidth={2.2}
            fill="url(#psiFillTime)"
            isAnimationActive={false}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}