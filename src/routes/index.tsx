import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Gauge, Maximize2 } from "lucide-react";
import { TestController } from "@/components/TestController";
import { VoltageCurrentGraph } from "@/components/VoltageCurrentGraph";
import { StatCard } from "@/components/StatCard";
import { BrandHeader } from "@/components/BrandHeader";
import { LoadingScreen } from "@/components/LoadingScreen";
import { TestObjectSearch } from "@/components/TestObjectSearch";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { GraphModal } from "@/components/GraphModal";
import { useReactorTesting } from "@/hooks/useReactorTesting";
import { motion } from "framer-motion";
import { useTheme } from "@/hooks/useTheme";
import { useTestObjects } from "@/hooks/useTestObjects";
import type { CurrentUnit, TimeUnit } from "@/types/sample";
import { convertCurrentUnit, currentUnitLabel } from "@/utils/unitConversion";

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Testing — Electrosoft Automation RLTS" },
      { name: "description", content: "Real-time reactor excitation rise and exponential decay monitoring." },
    ],
  }),
});

function Dashboard() {
  const [timeUnit, setTimeUnit] = useState<TimeUnit>("MS");
  const [currentUnit, setCurrentUnit] = useState<CurrentUnit>("A");
  const [showCurrent, setShowCurrent] = useState(true);
  const [showVoltage, setShowVoltage] = useState(true);
  const [expand, setExpand] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [pendingPassFail, setPendingPassFail] = useState(false);

  const { theme, toggle } = useTheme();
  const { objects, saveReport, getReport, getObject } = useTestObjects();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const {
    raw, analysis, phase, duration,
    latestCurrent, peakCurrent,
    start, stop, reset,
  } = useReactorTesting();

  const selectedObject = selectedId ? getObject(selectedId) : null;
  const hasExistingReport = selectedId ? !!getReport(selectedId) : false;

  // While running, always render from raw (real-time). After completion, default to analysis.
  const isRunning = phase === "ramp_up" || phase === "decay";
  const usingRaw = isRunning ? true : showRaw;
  const points = usingRaw ? raw : (analysis.length ? analysis : raw);
  const datasetLabel = isRunning
    ? "RAW · LIVE 0.25 MS"
    : usingRaw
      ? `RAW · 0.25 MS · ${raw.length} pts`
      : `ANALYSIS · 1 MS · ${analysis.length} pts`;

  const fmtCurrent = (v: number) =>
    convertCurrentUnit(v, currentUnit).toFixed(currentUnit === "mA" ? 0 : 2);

  const beginTest = () => {
    if (!selectedId) { alert("Select a test object from the search bar first."); return; }
    if (hasExistingReport) { setConfirmOverwrite(true); return; }
    reset(); start();
  };

  const confirmedStart = () => { setConfirmOverwrite(false); reset(); start(); };

  useEffect(() => {
    if (phase === "completed" && selectedId && raw.length > 0) setPendingPassFail(true);
  }, [phase, selectedId, raw.length]);

  const finalize = (status: "passed" | "failed") => {
    if (!selectedId) return;
    saveReport({
      objectId: selectedId,
      status,
      rawResult: raw,
      analysisResult: analysis,
      peakCurrent,
      durationS: duration,
      completedAt: Date.now(),
    });
    setPendingPassFail(false);
  };

  const graphView = (
    <VoltageCurrentGraph
      points={points}
      timeUnit={timeUnit}
      currentUnit={currentUnit}
      peakCurrent={peakCurrent}
      showCurrent={showCurrent}
      showVoltage={showVoltage}
      datasetLabel={datasetLabel}
    />
  );

  return (
    <>
      <LoadingScreen />
      <div className="min-h-screen text-foreground">
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 lg:px-8">
          <BrandHeader theme={theme} onToggleTheme={toggle} />

          <div className="panel flex flex-wrap items-center justify-between gap-4 p-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">Active Test Object</div>
              <div className="mt-1 text-sm font-semibold text-foreground">
                {selectedObject ? `${selectedObject.serialNumber} · ${selectedObject.name}` : "None selected"}
              </div>
              {selectedObject && (
                <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                  {selectedObject.peakCurrent} A peak · {selectedObject.maxVoltage} V max
                  {selectedObject.workOrder && <> · WO {selectedObject.workOrder}</>}
                  {hasExistingReport && (
                    <span className="ml-2 rounded-sm border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-amber-500">
                      report exists
                    </span>
                  )}
                </div>
              )}
            </div>
            <TestObjectSearch objects={objects} selectedId={selectedId} onSelect={setSelectedId} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Live Current"  value={fmtCurrent(latestCurrent)} unit={currentUnitLabel(currentUnit)} accent="current" />
            <StatCard label="Peak Current"  value={fmtCurrent(peakCurrent)}   unit={currentUnitLabel(currentUnit)} accent="peak" />
            <StatCard label="Test Duration" value={duration.toFixed(2)} unit="s" accent="duration" />
          </div>

          <TestController
            status={phase}
            timeUnit={timeUnit}
            currentUnit={currentUnit}
            onStart={beginTest}
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
              <div className="flex flex-wrap items-center gap-3">
                <ChannelToggle label="Current" color="var(--current)" checked={showCurrent} onChange={setShowCurrent} />
                <ChannelToggle label="Voltage" color="var(--voltage)" checked={showVoltage} onChange={setShowVoltage} />
                <ChannelToggle
                  label="Show Raw Data"
                  color="var(--peak)"
                  checked={showRaw}
                  onChange={setShowRaw}
                  disabled={isRunning || analysis.length === 0}
                  title={isRunning ? "Live raw stream is already showing" : analysis.length === 0 ? "Run a test first" : ""}
                />
                <button
                  onClick={() => setExpand(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-foreground transition hover:bg-accent"
                >
                  <Maximize2 className="h-3.5 w-3.5" /> View
                </button>
              </div>
            </div>
            {graphView}
          </div>

          <div className="pt-1 text-center font-mono text-[10px] tracking-[0.3em] text-muted-foreground">
            © {new Date().getFullYear()} ELECTROSOFT AUTOMATION · RLTS v2.2
          </div>
        </div>
      </div>

      <GraphModal open={expand} onClose={() => setExpand(false)} title="Reactor Linearity Curve">
        {graphView}
      </GraphModal>

      <ConfirmDialog
        open={confirmOverwrite}
        title="Overwrite existing report?"
        description={
          <>
            A report already exists for{" "}
            <span className="font-semibold text-foreground">{selectedObject?.serialNumber}</span>.
            Running a new test will <strong className="text-destructive">overwrite</strong> the previously
            stored data. Continue?
          </>
        }
        destructive
        confirmLabel="Overwrite & Start"
        onCancel={() => setConfirmOverwrite(false)}
        onConfirm={confirmedStart}
      />

      {pendingPassFail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-md">
          <div className="panel w-full max-w-md p-6 text-center">
            <h2 className="font-display text-lg font-bold tracking-wide text-foreground">Mark Test Result</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Test for <span className="font-semibold text-foreground">{selectedObject?.serialNumber}</span> completed.
              Save it as Passed or Failed?
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button onClick={() => finalize("failed")} className="rounded-md bg-destructive px-5 py-2 text-xs font-bold uppercase tracking-widest text-destructive-foreground hover:brightness-110">Failed</button>
              <button onClick={() => finalize("passed")} className="rounded-md bg-[var(--ok)] px-5 py-2 text-xs font-bold uppercase tracking-widest text-background hover:brightness-110">Passed</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ChannelToggle({
  label, color, checked, onChange, disabled, title,
}: { label: string; color: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; title?: string }) {
  return (
    <label
      title={title}
      className={`inline-flex select-none items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-foreground ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-accent"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5"
        style={{ accentColor: color }}
      />
      <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      {label}
    </label>
  );
}
