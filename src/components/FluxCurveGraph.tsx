import { useMemo } from "react";
import { Area, ComposedChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CurrentUnit } from "@/types/sample";
import { convertCurrentUnit, currentUnitLabel } from "@/utils/unitConversion";
import type { FluxSamplePoint } from "@/utils/fluxCalculation";
import type { MagneticCharacteristicsPoint } from "@/utils/reactorCalcs";

interface Props {
  fluxData: FluxSamplePoint[];
  currentUnit: CurrentUnit;
  resistance?: number;
  scale: "linear" | "log";
  puData?: MagneticCharacteristicsPoint[];
  /** Locked time constant from createAnalyzedSample() — null means tau never
   *  locked (not a clean exponential decay), distinct from "no data yet". */
  tau?: number | null;
  /** Whether any raw samples were captured at all, regardless of whether
   *  tau locked onto them. */
  hasRawSamples?: boolean;
}

export function FluxCurveGraph({ fluxData, currentUnit, resistance, scale, puData, tau, hasRawSamples }: Props) {
  const iLabel = currentUnitLabel(currentUnit);
  const isPu = !!puData && puData.length >= 2;

  const data = useMemo(() => {
    if (isPu) {
      return puData!
        .map((p) => ({ current: +p.CurrentPu.toFixed(5), psi: +p.FluxPU.toFixed(5) }))
        .filter((d) => (scale === "log" ? d.current > 0 : true))
        .sort((a, b) => a.current - b.current);
    }
    return fluxData
      .map((f) => ({
        current: +convertCurrentUnit(f.current, currentUnit).toFixed(4),
        psi: f.psi,
      }))
      .filter((d) => (scale === "log" ? d.current > 0 : true))
      .sort((a, b) => a.current - b.current);
  }, [fluxData, puData, isPu, currentUnit, scale]);

  if (!isPu && !resistance) {
    return (
      <div className="flex h-[460px] w-full items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
        No resistance (R) set on this test object — flux curve can't be calculated.
      </div>
    );
  }

  if (data.length < 2) {
    const message = hasRawSamples && tau === null
      ? "Tau did not lock — this doesn't look like a clean exponential decay. Check the reactor is connected, or review the raw waveform tab."
      : "No data captured yet.";

    return (
      <div className="flex h-[460px] w-full items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
        {message}
      </div>
    );
  }

  const xLabel = isPu ? "Current (p.u.)" : `Current (${iLabel})`;
  const yLabel = isPu ? "Linked Flux ψ (p.u.)" : "ψ (Wb-turns)";
  const headerText = isPu
    ? `ψ vs i — per-unit (IEC 60076-6 Figure B.6)`
    : `ψ vs i (${scale} scale) — IEC 60076-6 Annex B.7.1 · R = ${resistance} Ω`;

  return (
    <div className="h-[460px] w-full">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        {headerText}
      </div>
      <ResponsiveContainer width="100%" height="92%">
        <ComposedChart data={data} margin={{ top: 20, right: 32, left: 12, bottom: 24 }}>
          <defs>
            <linearGradient id="psiFillCurrent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="var(--current)" stopOpacity={0.55} />
              <stop offset="100%" stopColor="var(--current)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--grid-line)" strokeDasharray="2 4" />
          <XAxis
            type="number" dataKey="current" scale={scale} allowDataOverflow
            domain={scale === "log" ? ["auto", "auto"] : [0, "auto"]}
            stroke="var(--muted-foreground)"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            label={{
              value: xLabel, position: "insideBottom", offset: -10,
              fill: "var(--foreground)", fontSize: 12, fontWeight: 700, fontFamily: "var(--font-display)",
            }}
          />
          <YAxis
            type="number" dataKey="psi" stroke="var(--current)"
            tick={{ fill: "var(--current)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            label={{
              value: yLabel, angle: -90, position: "insideLeft",
              fill: "var(--current)", fontSize: 12, fontWeight: 700, fontFamily: "var(--font-display)",
            }}
          />
          <Tooltip
            contentStyle={{
              background: "color-mix(in oklab, var(--popover) 96%, transparent)",
              border: "1px solid var(--border)", borderRadius: 6, fontSize: 12,
              fontFamily: "var(--font-mono)", color: "var(--popover-foreground)",
            }}
            formatter={((v: unknown) => [isPu ? `${v} pu` : `${v} Wb-t`, "ψ"]) as never}
            labelFormatter={(v) => `i = ${v} ${isPu ? "pu" : iLabel}`}
          />
          <Area
            type="monotone"
            dataKey="psi"
            stroke="var(--current)"
            strokeWidth={2.2}
            fill="url(#psiFillCurrent)"
            isAnimationActive={false}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}