import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Activity, Cpu, Gauge, Timer } from "lucide-react";
import { TestController } from "@/components/TestController";
import { VoltageCurrentGraph } from "@/components/VoltageCurrentGraph";
import { StatCard } from "@/components/StatCard";
import { useVoltageTesting } from "@/hooks/useVoltageTesting";
import type { CurrentUnit, TimeUnit } from "@/types/sample";
import {
  convertCurrentUnit, currentUnitLabel,
} from "@/utils/unitConversion";

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Linear Voltage Testing System" },
      { name: "description", content: "Real-time voltage and current monitoring dashboard." },
    ],
  }),
});

function Dashboard() {
  const [timeUnit, setTimeUnit] = useState<TimeUnit>("S");
  const [currentUnit, setCurrentUnit] = useState<CurrentUnit>("A");

  const {
    samples, status, duration,
    latestVoltage, latestCurrent, totalSamples,
    start, stop, clear,
  } = useVoltageTesting();

  const displayCurrent = convertCurrentUnit(latestCurrent, currentUnit).toFixed(
    currentUnit === "mA" ? 0 : 3,
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(56,189,248,0.08),_transparent_60%)] bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 lg:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border/40 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-sky-400">
              <Activity className="h-3.5 w-3.5" />
              LVTS · v1.0
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Linear Voltage Testing System
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Real-time monitoring of voltage and current channels. Mock generator active —
              ready for WebSocket / REST replacement.
            </p>
          </div>
          <div className="font-mono text-xs text-slate-500">
            CH-01 · 50 Hz · 230V nominal
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Voltage" value={latestVoltage.toFixed(2)} unit="V" accent="voltage" />
          <StatCard label="Current" value={displayCurrent} unit={currentUnitLabel(currentUnit)} accent="current" />
          <StatCard label="Total Samples" value={totalSamples} />
          <StatCard label="Duration" value={duration.toFixed(1)} unit="s" />
        </div>

        <TestController
          status={status}
          timeUnit={timeUnit}
          currentUnit={currentUnit}
          onStart={start}
          onStop={stop}
          onClear={clear}
          onTimeUnitChange={setTimeUnit}
          onCurrentUnitChange={setCurrentUnit}
        />

        <div className="rounded-lg border border-border/60 bg-card/60 p-4 backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Gauge className="h-4 w-4 text-sky-400" />
              Live Signal
            </div>
            <div className="flex items-center gap-4 text-[11px] text-slate-400">
              <Legend color="#38bdf8" label="Voltage" />
              <Legend color="#fb923c" label="Current" />
            </div>
          </div>
          <VoltageCurrentGraph
            samples={samples}
            timeUnit={timeUnit}
            currentUnit={currentUnit}
          />
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 pt-4 text-xs text-slate-500">
          <div className="flex items-center gap-2"><Cpu className="h-3.5 w-3.5" /> Mock source · 500 ms tick · buffer 100</div>
          <div className="flex items-center gap-2"><Timer className="h-3.5 w-3.5" /> Architecture ready for WS / REST / multi-channel</div>
        </footer>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
