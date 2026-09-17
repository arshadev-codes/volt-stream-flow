import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Gauge, Maximize2, AlertTriangle, PlugZap, Loader2, CheckCircle2 } from "lucide-react";
import { TestController } from "@/components/TestController";
import { InterlockStatusPanel } from "@/components/InterlockStatusPanel";
import { VoltageCurrentGraph } from "@/components/VoltageCurrentGraph";
import { StatCard } from "@/components/StatCard";
import { BrandHeader } from "@/components/BrandHeader";
import { LoadingScreen } from "@/components/LoadingScreen";
import { TestObjectSearch } from "@/components/TestObjectSearch";
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
import { createAnalyzedSample } from "@/utils/createAnalyzedSample";
import {
  computeTimeConstant,
  computeTimeToSteadyState,
  computeUltimateDcVoltage,
  computeMagneticCharacteristicPu,
} from "@/utils/reactorCalcs";
import type { CalculatedResults } from "@/types/testObject";


export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Testing — Electrosoft Automation RLTS" },
      { name: "description", content: "Real-time reactor excitation rise and exponential decay monitoring." },
    ],
  }),
});

const ABORT_REASON_LABEL: Record<string, string> = {
  ACB_TRIP: "ACB Trip",
  DC_TRIP: "DC Trip",
};

interface ModbusProgress {
  active: boolean;
  key: string | null;
  name: string | null;
  attempt: number;
  maxRetries: number;
}

function Dashboard() {
  const [timeUnit, setTimeUnit] = useState<TimeUnit>("MS");
  const [currentUnit, setCurrentUnit] = useState<CurrentUnit>("A");
  const [showVoltage, setShowVoltage] = useState(false);
  const [showSmoothLine, setShowSmoothLine] = useState(false);
  const [expand, setExpand] = useState(false);

  // Shows a brief "Saved" confirmation banner after an auto-save fires —
  // there's no button anymore, so this is the only feedback the user gets
  // that something was actually written to the database.
  const [justSaved, setJustSaved] = useState<string | null>(null);

  const { theme, toggle } = useTheme();
  const { objects, saveReport, getReport, getObject } = useTestObjects();
  const { settings } = useSettings();
  const isLive = settings.dataSource === "live";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [setpointError, setSetpointError] = useState<string | null>(null);

  // Polled from GET /api/prepare-test/status while a prepare-test POST is
  // in flight, so the user sees exactly which register is being written
  // and how many retry attempts are left, instead of a silent wait.
  const [writeProgress, setWriteProgress] = useState<ModbusProgress | null>(null);
  const pollRef = useRef<number | null>(null);

  const startProgressPolling = () => {
    if (pollRef.current) return; // already polling, don't stack intervals
    pollRef.current = window.setInterval(() => {
      fetch("http://localhost:3000/api/prepare-test/status")
        .then((res) => res.json())
        .then((p: ModbusProgress) => {
          setWriteProgress(p?.active ? p : null);
        })
        .catch(() => {
          // Polling failure isn't itself an error worth surfacing — the
          // main prepare-test request's own .catch already handles that.
        });
    }, 250);
  };

  const stopProgressPolling = () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setWriteProgress(null);
  };

  // Stop polling if the component unmounts mid-request.
  useEffect(() => () => stopProgressPolling(), []);

  const {
    raw, analysis, phase, connected, duration,
    latestCurrent, peakCurrent, interlock, abortReason, hardwareFault, reset,
  } = useReactorTesting();

  const [abortReasonDismissed, setAbortReasonDismissed] = useState(false);
  useEffect(() => {
    setAbortReasonDismissed(false);
  }, [abortReason]);

  // Dummy simulation state — lives here (not lower down) because doSave()
  // below needs to read from it. Only rendered/usable when dataSource ===
  // "demo"; remove this whole hook + the UI block at the bottom of this
  // file once real hardware testing fully replaces the simulation.
  const sim = useDummySimulation();

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

  /**
   * Builds the frozen calculation snapshot (tau, timeConstant,
   * ultimateDcVoltage, magnetic characteristic, ...) and writes the report
   * to Supabase/localStorage. Always saves as "passed" — there is no
   * pass/fail decision anymore, this just persists whatever was recorded.
   */
  const doSave = (rawResult: typeof raw, analysisResult: typeof raw, peak: number, durationS: number) => {
    if (!selectedId) return;

    const obj = getObject(selectedId);
    let calculatedResults: CalculatedResults | undefined;
    if (obj && rawResult.length > 0) {
      const resAt20 = obj.resAt20DegC ?? 0;
      const { tau, breakPoint, fluxData } = createAnalyzedSample(rawResult, resAt20);
      const timeConstant = computeTimeConstant(obj.inductance ?? 0, resAt20);
      const timeToSteadyState = computeTimeToSteadyState(timeConstant);
      const ultimateDcVoltage = computeUltimateDcVoltage(
        obj.resIncreaseByLeadsPu ?? 0,
        obj.idcForLinearityTest ?? 0,
        obj.resAtRefTemp ?? 0,
      );
      const magneticCharacteristic = computeMagneticCharacteristicPu(
        fluxData,
        obj.inductance ?? 0,
        obj.ratedAcRmsCurrent ?? 0,
      );
      calculatedResults = {
        tau,
        timeConstant,
        timeToSteadyState,
        ultimateDcVoltage,
        breakPointCurrent: breakPoint?.current ?? null,
        breakPointTimeSec: breakPoint ? breakPoint.timestamp / 1000 : null,
        magneticCharacteristic,
      };
    }

    saveReport({
      objectId: selectedId,
      status: "passed",
      rawResult,
      analysisResult,
      calculatedResults,
      peakCurrent: peak,
      durationS,
      completedAt: Date.now(),
    });

    setJustSaved(obj?.serialNumber ?? selectedId);
    window.setTimeout(() => setJustSaved(null), 4000);
  };

  // ---- Auto-save: LIVE test ----
  // Fires exactly once per test run, the moment phase transitions INTO
  // "completed" (not on every render while it stays completed, and not
  // repeatedly if raw keeps the same length).
  const prevPhaseRef = useRef(phase);
  useEffect(() => {
    const justCompleted = prevPhaseRef.current !== "completed" && phase === "completed";
    prevPhaseRef.current = phase;

    if (justCompleted && selectedId && raw.length > 0) {
      doSave(raw, analysis.length ? analysis : raw, peakCurrent, duration);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, selectedId, raw.length]);

  // ---- Auto-save: SIMULATION ----
  // Fires exactly once per simulation run, the moment sim.active
  // transitions from true -> false (i.e. "Stop Simulation" was pressed),
  // as long as some points were actually recorded.
  const prevSimActiveRef = useRef(sim.active);
  useEffect(() => {
    const justStopped = prevSimActiveRef.current && !sim.active;
    prevSimActiveRef.current = sim.active;

    if (justStopped && selectedId && sim.points.length > 0) {
      doSave(sim.points, sim.points, sim.peak, sim.duration);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim.active, selectedId]);

  /**
   * Fires whenever a test object is selected (or cleared) in the search box.
   * Beyond updating which object is active, this pushes that object's
   * calculated Idc (idcForLinearityTest) to the Modbus bridge server, which
   * writes it into the Masibus controller's Set Value 1 register — this is
   * what actually moves the physical peak-current setpoint on the test bench.
   *
   * setpointError surfaces failures (device unreachable, write rejected,
   * server down) as a visible banner rather than only a console.error, so a
   * failed write can't go unnoticed mid-test. writeProgress (via polling)
   * surfaces what's happening WHILE the request is still running.
   */
  const handleSelectObject = (id: string | null) => {
    setSelectedId(id);

    if (id) {
      const obj = getObject(id);
      if (obj?.idcForLinearityTest) {
        startProgressPolling();

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
          })
          .finally(() => {
            stopProgressPolling();
          });
      }
    } else {
      setSetpointError(null);
      stopProgressPolling();
    }
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

          {/* Auto-save confirmation — the only feedback since there's no
             manual Save/Pass/Fail button anymore. */}
          {justSaved && (
            <div className="flex items-center gap-2 rounded-md border border-[var(--ok)]/40 bg-[var(--ok)]/10 px-4 py-2 font-mono text-xs text-[var(--ok)]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Report saved for {justSaved}.</span>
            </div>
          )}

          {/* Modbus write-in-progress banner — shows which register is being
             written right now and how many retry attempts are left, polled
             from the bridge server while prepare-test is in flight. */}
          {writeProgress?.active && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 font-mono text-xs text-foreground">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-500" />
              <span>
                Writing {writeProgress.name}... attempt {writeProgress.attempt} of {writeProgress.maxRetries}
                {writeProgress.maxRetries - writeProgress.attempt > 0 && (
                  <> ({writeProgress.maxRetries - writeProgress.attempt} retries left)</>
                )}
              </span>
            </div>
          )}

          {isLive && hardwareFault && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 font-mono text-xs text-destructive">
              <PlugZap className="h-4 w-4 shrink-0" />
              <span>Hardware connection lost: {hardwareFault} — attempting to reconnect...</span>
            </div>
          )}

          {abortReason && !abortReasonDismissed && (
            <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 font-mono text-xs text-amber-500">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Test aborted — {ABORT_REASON_LABEL[abortReason] ?? abortReason}</span>
              <button
                onClick={() => setAbortReasonDismissed(true)}
                className="ml-auto shrink-0 text-[10px] font-bold uppercase tracking-wider text-amber-500/70 hover:text-amber-500"
              >
                Dismiss
              </button>
            </div>
          )}

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
                  {sim.active ? "Stop Simulation (auto-saves)" : "Start Simulation"}
                </button>
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
    </>
  );
}