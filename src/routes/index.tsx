import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Gauge, Maximize2, AlertTriangle } from "lucide-react";
import { TestController } from "@/components/TestController";
import { InterlockStatusPanel } from "@/components/InterlockStatusPanel";
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
import { useSettings } from "@/hooks/useSettings";
import type { CurrentUnit, TimeUnit } from "@/types/sample";
import { convertCurrentUnit, currentUnitLabel } from "@/utils/unitConversion";
import { LinearityGraphTabs } from "@/components/LinearityGraphTabs";
import { useDummySimulation } from "@/hooks/useDummySimulation";


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
  const [showVoltage, setShowVoltage] = useState(false);
  const [showSmoothLine, setShowSmoothLine] = useState(false);
  const [expand, setExpand] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<"passed" | "failed" | null>(null);
  const [pendingPassFail, setPendingPassFail] = useState(false);

  const { theme, toggle } = useTheme();
  const { objects, saveReport, getReport, getObject } = useTestObjects();
  const { settings } = useSettings();
  const isLive = settings.dataSource === "live";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [setpointError, setSetpointError] = useState<string | null>(null);

  const {
    raw, analysis, phase, connected, duration,
    latestCurrent, peakCurrent, interlock, reset,
  } = useReactorTesting();

  // Dummy simulation state — lives here (not lower down) because doSave()
  // below needs to read from it. Only rendered/usable when dataSource ===
  // "demo"; remove this whole hook + the UI block at the bottom of this
  // file once real hardware testing fully replaces the simulation.
  const sim = useDummySimulation();

  // If the user flips to live mode while a simulation is running, stop it —
  // the panel/button that would normally stop it is about to disappear.
  useEffect(() => {
    if (isLive && sim.active) {
      sim.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive]);

  const selectedObject = selectedId ? getObject(selectedId) : null;
  const hasExistingReport = selectedId ? !!getReport(selectedId) : false;

  const isRunning = phase === "ramp_up";
  const points = isRunning ? raw : (analysis.length ? analysis : raw);
  const datasetLabel = isRunning
    ? "RAW · LIVE"
    : `ANALYSIS · ${analysis.length} pts`;

  const fmtCurrent = (v: number) =>
    convertCurrentUnit(v, currentUnit).toFixed(currentUnit === "mA" ? 0 : 2);

  // Real-hardware completion path (untouched).
  useEffect(() => {
    if (phase === "completed" && selectedId && raw.length > 0) setPendingPassFail(true);
  }, [phase, selectedId, raw.length]);

  /**
   * Fires whenever a test object is selected (or cleared) in the search box.
   * Beyond updating which object is active, this pushes that object's
   * calculated Idc (idcForLinearityTest) to the Modbus bridge server, which
   * writes it into the Masibus controller's Set Value 1 register — this is
   * what actually moves the physical peak-current setpoint on the test bench.
   *
   * setpointError surfaces failures (device unreachable, write rejected,
   * server down) as a visible banner rather than only a console.error, so a
   * failed write can't go unnoticed mid-test.
   */
  const handleSelectObject = (id: string | null) => {
    setSelectedId(id);

    if (id) {
      const obj = getObject(id);
      if (obj?.idcForLinearityTest) {
        fetch("http://localhost:3000/api/prepare-test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idc: obj.idcForLinearityTest }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              setSetpointError(null);
              return;
            }

            const failedDefaults = [
              ...(data.currentMeterDefaults ?? []),
              ...(data.voltageMeterDefaults ?? []),
            ].filter((r: { success: boolean }) => !r.success);

            const parts: string[] = [];
            if (failedDefaults.length > 0) {
              parts.push(
                `${failedDefaults.length} register(s) failed to reset: ` +
                failedDefaults.map((r: { name: string; error: string }) => `${r.name} (${r.error})`).join(", ")
              );
            }
            if (data.idcSetpoint && !data.idcSetpoint.success) {
              parts.push(`Idc setpoint failed: ${data.idcSetpoint.error}`);
            }
            if (data.error) {
              parts.push(data.error);
            }

            setSetpointError(parts.join(" · ") || "Unknown error preparing the test bench.");
          })
          .catch((err) => {
            setSetpointError(`Could not reach test bench server: ${err.message}`);
          });
      }
    } else {
      setSetpointError(null);
    }
  };

  const doSave = (status: "passed" | "failed") => {
    if (!selectedId) return;

    // Only ever prefer sim data in demo mode. Gating on isLive (not just
    // sim.points.length) means a leftover simulation run from before you
    // switched to live can never silently get saved over a real test.
    const usingSim = !isLive && sim.points.length > 0;

    saveReport({
      objectId: selectedId,
      status,
      rawResult: usingSim ? sim.points : raw,
      analysisResult: usingSim ? sim.points : analysis,
      peakCurrent: usingSim ? sim.peak : peakCurrent,
      durationS: usingSim ? sim.duration : duration,
      completedAt: Date.now(),
    });
    setPendingPassFail(false);
    setConfirmOverwrite(false);
    setPendingStatus(null);
  };

  const finalize = (status: "passed" | "failed") => {
    if (!selectedId) return;
    if (hasExistingReport) {
      setPendingStatus(status);
      setConfirmOverwrite(true);
      return;
    }
    doSave(status);
  };

  const showSim = !isLive && sim.active;

  const graphView = (
    <LinearityGraphTabs
      points={showSim ? sim.points : points}
      rawPoints={showSim ? sim.points : raw}
      timeUnit={timeUnit}
      currentUnit={currentUnit}
      peakCurrent={showSim ? sim.peak : peakCurrent}
      datasetLabel={showSim ? "SIMULATED · DUMMY DATA" : datasetLabel}
      resistance={showSim ? sim.resistance : selectedObject?.resAtRefTemp}
      inductance={selectedObject?.inductance ?? 4.49}
      ratedAcRmsCurrent={selectedObject?.ratedAcRmsCurrent ?? 171.8}
      showVoltage={showVoltage}
      showSmoothLine={showSmoothLine}
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
                  {selectedObject.idcForLinearityTest?.toFixed(2) ?? "—"} A target · {selectedObject.maxVoltage} V max
                  {selectedObject.workOrder && <> · WO {selectedObject.workOrder}</>}
                  {hasExistingReport && (
                    <span className="ml-2 rounded-sm border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-amber-500">
                      report exists
                    </span>
                  )}
                </div>
              )}
            </div>
            <TestObjectSearch objects={objects} selectedId={selectedId} onSelect={handleSelectObject} />
          </div>

          {setpointError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 font-mono text-xs text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{setpointError}</span>
              <button
                onClick={() => setSetpointError(null)}
                className="ml-auto shrink-0 text-[10px] font-bold uppercase tracking-wider text-destructive/70 hover:text-destructive"
              >
                Dismiss
              </button>
            </div>
          )}

          {isRunning && !selectedId && (
            <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 font-mono text-xs text-amber-500">
              <AlertTriangle className="h-4 w-4" />
              Bench test is running but no test object is selected — this run won't be saved to a report.
            </div>
          )}

          <InterlockStatusPanel status={interlock} />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Live Current"  value={fmtCurrent(latestCurrent)} unit={currentUnitLabel(currentUnit)} accent="current" />
            <StatCard label="Peak Current"  value={fmtCurrent(peakCurrent)}   unit={currentUnitLabel(currentUnit)} accent="peak" />
            <StatCard label="Test Duration" value={duration.toFixed(2)} unit="s" accent="duration" />
          </div>

          <TestController
            status={phase}
            // In demo mode there's no hardware to connect to by design, so
            // don't show a "disconnected" state for it — only report the
            // real connection status when we're actually meant to be live.
            connected={isLive ? connected : true}
            timeUnit={timeUnit}
            currentUnit={currentUnit}
            onClear={reset}
            onTimeUnitChange={setTimeUnit}
            onCurrentUnitChange={setCurrentUnit}
            canArm={interlock.canArm}
            showVoltage={showVoltage}
            onShowVoltageChange={setShowVoltage}
            showSmoothLine={showSmoothLine}
            onShowSmoothLineChange={setShowSmoothLine}
          />

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="panel p-5"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.2em] text-foreground">
                <Gauge className="h-4 w-4 text-[var(--current)]" />
                Reactor Linearity Curve
              </div>
              <button
                onClick={() => setExpand(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-foreground transition hover:bg-accent"
              >
                <Maximize2 className="h-3.5 w-3.5" /> View
              </button>
            </div>
            {graphView}
          </motion.div>

          {/* DUMMY SIMULATION PANEL — only shown in demo mode. Remove this
             whole block (and the useDummySimulation hook + all sim.*
             references above) once real hardware testing fully replaces
             the simulation. */}
          {!isLive && (
            <div className="panel flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="font-mono text-[11px] text-muted-foreground">
                Dummy Mode · R (Ω):{" "}
                <input
                  type="number" step="0.001" value={sim.resistance}
                  onChange={(e) => sim.setResistance(parseFloat(e.target.value) || 0)}
                  className="w-24 rounded-sm border border-border bg-card px-2 py-1 text-foreground"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={sim.active ? sim.stop : sim.start}
                  className="rounded-md bg-[var(--current)] px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest text-background hover:brightness-110"
                >
                  {sim.active ? "Stop Simulation" : "Start Simulation"}
                </button>
                {sim.points.length > 0 && (
                  <button
                    onClick={() => selectedId && setPendingPassFail(true)}
                    disabled={!selectedId}
                    className="rounded-md bg-[var(--ok)] px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest text-background hover:brightness-110 disabled:opacity-40"
                  >
                    Save Simulation
                  </button>
                )}
              </div>
            </div>
          )}

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
            Saving this run will <strong className="text-destructive">overwrite</strong> the previously
            stored data. Continue?
          </>
        }
        destructive
        confirmLabel="Overwrite & Save"
        onCancel={() => { setConfirmOverwrite(false); setPendingStatus(null); }}
        onConfirm={() => pendingStatus && doSave(pendingStatus)}
      />

      {pendingPassFail && !confirmOverwrite && (
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