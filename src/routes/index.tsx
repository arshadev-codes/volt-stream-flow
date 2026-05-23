import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Activity, Cpu, Gauge, Timer, TrendingUp } from "lucide-react";
import { TestController } from "@/components/TestController";
import { VoltageCurrentGraph } from "@/components/VoltageCurrentGraph";
import { StatCard } from "@/components/StatCard";
import { BrandHeader } from "@/components/BrandHeader";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useReactorTesting } from "@/hooks/useReactorTesting";
import { useTheme } from "@/hooks/useTheme";
import type { CurrentUnit, ReactorPhase, TimeUnit } from "@/types/sample";
import { convertCurrentUnit, currentUnitLabel } from "@/utils/unitConversion";

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Electrosoft Automation — Reactor Linearity Testing System" },
      { name: "description", content: "Real-time reactor excitation rise and exponential decay monitoring." },
    ],
  }),
});

// const PHASE_LABEL: Record<ReactorPhase, string> = {
//   idle: "Idle",
//   ramp_up: "Charging",
//   decay: "Discharging",
//   completed: "Completed",
// };

function Dashboard() {
  const [timeUnit, setTimeUnit] = useState<TimeUnit>("S");
  const [currentUnit, setCurrentUnit] = useState<CurrentUnit>("A");
  const { theme, toggle } = useTheme();

  const {
    samples, phase, duration,
    latestCurrent, peakCurrent, totalSamples,
    start, stop, reset,
  } = useReactorTesting();

  const fmtCurrent = (v: number) =>
    convertCurrentUnit(v, currentUnit).toFixed(currentUnit === "mA" ? 0 : 2);

  return (
    <>
      <LoadingScreen />
      <div className="min-h-screen text-foreground">
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 lg:px-8">
          <BrandHeader theme={theme} onToggleTheme={toggle} />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Live Current"  value={fmtCurrent(latestCurrent)} unit={currentUnitLabel(currentUnit)} accent="current" />
            <StatCard label="Peak Current"  value={fmtCurrent(peakCurrent)}   unit={currentUnitLabel(currentUnit)} accent="peak" />
            {/* <StatCard label="Phase"         value={PHASE_LABEL[phase]} accent="phase" /> */}
            <StatCard label="Test Duration" value={duration.toFixed(2)} unit="s" accent="duration" />
            {/* <StatCard label="Sample Buffer" value={totalSamples} unit="/200" accent="samples" /> */}
          </div>

          <TestController
            status={phase}
            timeUnit={timeUnit}
            currentUnit={currentUnit}
            onStart={start}
            onStop={stop}
            onClear={reset}
            onTimeUnitChange={setTimeUnit}
            onCurrentUnitChange={setCurrentUnit}
          />

          <div className="panel p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.2em] text-foreground">
                <Gauge className="h-4 w-4 text-[var(--current)]" />
                Reactor Linearity Curve
              </div>
              <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                <LegendChip color="var(--current)" label="Current" />
                <LegendChip color="var(--voltage)" label="Voltage" dashed />
                <LegendChip color="var(--peak)"    label="Peak Ref" dashed />
              </div>
            </div>
            <VoltageCurrentGraph
              samples={samples}
              timeUnit={timeUnit}
              currentUnit={currentUnit}
              peakCurrent={peakCurrent}
            />
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {/* <div className="flex items-center gap-2"><Cpu        className="h-3.5 w-3.5" /> Simulation · 80 ms tick · buffer 200</div>
            <div className="flex items-center gap-2"><TrendingUp className="h-3.5 w-3.5" /> Exponential rise · decay</div>
            <div className="flex items-center gap-2"><Activity   className="h-3.5 w-3.5" /> PLC / Modbus / WebSocket ready</div>
            <div className="flex items-center gap-2"><Timer      className="h-3.5 w-3.5" /> Multi-channel ready</div> */}
          </footer>

          <div className="pt-1 text-center font-mono text-[10px] tracking-[0.3em] text-muted-foreground">
            © {new Date().getFullYear()} ELECTROSOFT AUTOMATION · RLTS v2.1
          </div>
        </div>
      </div>
    </>
  );
}

function LegendChip({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-0.5 w-5"
        style={{
          background: dashed
            ? `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 8px)`
            : color,
        }}
      />
      {label}
    </span>
  );
}
