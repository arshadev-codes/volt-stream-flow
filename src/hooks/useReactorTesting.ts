import { useCallback, useEffect, useRef, useState } from "react";
import type { RawPoint } from "@/types/sample";
import { createReactorSource, type ReactorSource, type ReactorPhaseRuntime } from "@/services/reactorSimulation";
import { analyzeRaw } from "@/services/analysis";

export type Phase = "idle" | ReactorPhaseRuntime;

/**
 * Owns the reactor test lifecycle: streams RawPoint batches in real time,
 * tracks duration / peak, and computes the median-of-4 analysis dataset
 * the moment the test completes.
 */
export function useReactorTesting() {
  const [raw, setRaw] = useState<RawPoint[]>([]);
  const [analysis, setAnalysis] = useState<RawPoint[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [duration, setDuration] = useState(0);
  const [peakCurrent, setPeakCurrent] = useState(0);

  const sourceRef = useRef<ReactorSource | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const rawRef = useRef<RawPoint[]>([]);

  const stop = useCallback(() => { sourceRef.current?.triggerDecay(); }, []);

  const reset = useCallback(() => {
    unsubRef.current?.();
    unsubRef.current = null;
    sourceRef.current = null;
    rawRef.current = [];
    setRaw([]);
    setAnalysis([]);
    setDuration(0);
    setStartedAt(null);
    setPeakCurrent(0);
    setPhase("idle");
  }, []);

  const start = useCallback(() => {
    if (unsubRef.current) return;
    rawRef.current = [];
    setRaw([]);
    setAnalysis([]);
    setPeakCurrent(0);
    setDuration(0);
    setStartedAt(Date.now());
    setPhase("ramp_up");

    const src = createReactorSource();
    sourceRef.current = src;

    unsubRef.current = src.subscribe((e) => {
      if (e.batch.length) {
        rawRef.current = rawRef.current.concat(e.batch);
        let p = 0;
        for (const pt of e.batch) if (pt.current > p) p = pt.current;
        setPeakCurrent((prev) => (p > prev ? p : prev));
        // Throttle React updates by mutating ref & swapping reference.
        setRaw(rawRef.current);
      }
      if (e.phase === "completed") {
        setPhase("completed");
        setAnalysis(analyzeRaw(rawRef.current));
      } else {
        setPhase(e.phase);
      }
    });
  }, []);

  useEffect(() => {
    if (!startedAt || phase === "idle" || phase === "completed") return;
    const id = setInterval(() => setDuration((Date.now() - startedAt) / 1000), 200);
    return () => clearInterval(id);
  }, [startedAt, phase]);

  useEffect(() => () => unsubRef.current?.(), []);

  const latest = raw[raw.length - 1];

  return {
    raw,
    analysis,
    phase,
    duration,
    latestCurrent: latest?.current ?? 0,
    latestVoltage: latest?.voltage ?? 0,
    peakCurrent,
    totalSamples: raw.length,
    start, stop, reset,
  };
}
