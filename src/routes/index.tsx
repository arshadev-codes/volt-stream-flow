import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Activity, Cpu, Gauge, Timer, Zap, TrendingUp } from "lucide-react";
import { TestController } from "@/components/TestController";
import { VoltageCurrentGraph } from "@/components/VoltageCurrentGraph";
import { StatCard } from "@/components/StatCard";
import { useReactorTesting } from "@/hooks/useReactorTesting";
import type { CurrentUnit, ReactorPhase, TimeUnit } from "@/types/sample";
import { convertCurrentUnit, currentUnitLabel } from "@/utils/unitConversion";

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Reactor Linearity Testing System" },
      { name: "description", content: "Real-time reactor excitation rise, peak hold, and decay monitoring." },
    ],
  }),
});

const PHASE_LABEL: Record<ReactorPhase, string> = {
  idle: "Idle",
  ramp_up: "Ramp Up",
  peak: "Peak Hold",
  decay: "Decay",
  completed: "Completed",
};

function Dashboard() {
  const [timeUnit, setTimeUnit] = useState<TimeUnit>("S");
  const [currentUnit, setCurrentUnit] = useState<CurrentUnit>("A");

  const {
    samples, phase, duration,
    latestCurrent, peakCurrent, totalSamples,
    start, stop, reset,
  } = useReactorTesting();

  const fmtCurrent = (v: number) =>
    convertCurrentUnit(v, currentUnit).toFixed(currentUnit === "mA" ? 0 : 2);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 lg:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-700/60 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-orange-400">
              <Zap className="h-3.5 w-3.5" />
              RLTS · v2.0
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-50">
              Reactor Linearity Testing System
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Excitation rise, peak hold, and discharge decay simulation —
              architecture ready for PLC / Modbus TCP / WebSocket data.
            </p>
          </div>
          <div className="rounded-md border border-slate-700 bg-slate-800/60 px-3 py-1.5 font-mono text-xs text-slate-300">
            REACTOR-01 · 100A peak · 230V nominal
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Current" value={fmtCurrent(latestCurrent)} unit={currentUnitLabel(currentUnit)} accent="current" />
          <StatCard label="Peak Current" value={fmtCurrent(peakCurrent)} unit={currentUnitLabel(currentUnit)} accent="peak" />
          <StatCard label="Phase" value={PHASE_LABEL[phase]} accent="phase" />
          <StatCard label="Test Duration" value={duration.toFixed(1)} unit="s" accent="duration" />
          <StatCard label="Total Samples" value={totalSamples} accent="samples" />
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

        <div className="rounded-xl border border-slate-700/70 bg-slate-900/80 p-5 shadow-xl backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
              <Gauge className="h-4 w-4 text-orange-400" />
              Reactor Current Linearity Curve
            </div>
            <div className="flex items-center gap-4 text-[11px] font-semibold text-slate-300">
              <Legend color="#fb923c" label="Reactor Current" />
              <Legend color="#f43f5e" label="Peak Reference" dashed />
            </div>
          </div>
          <VoltageCurrentGraph
            samples={samples}
            timeUnit={timeUnit}
            currentUnit={currentUnit}
            peakCurrent={peakCurrent}
          />
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-700/60 pt-4 text-xs text-slate-400">
          <div className="flex items-center gap-2"><Cpu className="h-3.5 w-3.5" /> Simulation source · 200 ms tick · buffer 200</div>
          <div className="flex items-center gap-2"><TrendingUp className="h-3.5 w-3.5" /> Ramp · Peak Hold · Decay</div>
          <div className="flex items-center gap-2"><Activity className="h-3.5 w-3.5" /> Swap service layer for PLC / Modbus / WebSocket</div>
          <div className="flex items-center gap-2"><Timer className="h-3.5 w-3.5" /> Multi-channel ready</div>
        </footer>
      </div>
    </div>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-0.5 w-4"
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
