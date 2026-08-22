import { useEffect, useCallback, useRef, useState } from "react";
import type { RawPoint, ReactorPhase, InterlockStatus } from "@/types/sample";
import {
  subscribeReactorEvents,
  subscribeReactorConnected,
  isReactorConnected,
} from "@/services/reactorConnectionManager";
import { analyzeRaw } from "@/services/analysis";

const DEFAULT_INTERLOCK: InterlockStatus = {
  acbOn: false,
  acbTrip: false,
  emgHealthy: false,
  dcTrip: false,
  canArm: false,
};

export function useReactorTesting() {
  const [raw, setRaw] = useState<RawPoint[]>([]);
  const [analysis, setAnalysis] = useState<RawPoint[]>([]);
  const [phase, setPhase] = useState<ReactorPhase>("idle");
  const [connected, setConnected] = useState(isReactorConnected());
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [duration, setDuration] = useState(0);
  const [peakCurrent, setPeakCurrent] = useState(0);
  const [interlock, setInterlock] = useState<InterlockStatus>(DEFAULT_INTERLOCK);
  const [abortReason, setAbortReason] = useState<string | null>(null);
  const [hardwareFault, setHardwareFault] = useState<string | null>(null);

  const rawRef = useRef<RawPoint[]>([]);
  const peakRef = useRef(0);

  const reset = useCallback(() => {
    rawRef.current = [];
    peakRef.current = 0;
    setRaw([]);
    setAnalysis([]);
    setDuration(0);
    setStartedAt(null);
    setPeakCurrent(0);
    setPhase("idle");
    setAbortReason(null);
  }, []);

  useEffect(() => {
    const unsubEvents = subscribeReactorEvents((e) => {
      if (e.interlock) {
        setInterlock(e.interlock);
      }

      if (e.hardwareFault) {
        setHardwareFault(e.hardwareFault);
      }
      if (e.hardwareRecovered) {
        setHardwareFault(null);
      }

      if (e.reset) {
        rawRef.current = [];
        peakRef.current = 0;
        setRaw([]);
        setAnalysis([]);
        setPeakCurrent(0);
        setDuration(0);
        setStartedAt(Date.now());
        setPhase("ramp_up");
        setAbortReason(null);
        return;
      }

      if (e.batch.length) {
        rawRef.current = rawRef.current.concat(e.batch);

        let batchMax = peakRef.current;
        for (const p of e.batch as RawPoint[]) {
          if (p.current > batchMax) batchMax = p.current;
        }

        const last = e.batch[e.batch.length - 1] as RawPoint & { peak?: number };
        if (typeof last.peak === "number" && last.peak > batchMax) {
          batchMax = last.peak;
        }

        if (batchMax > peakRef.current) {
          peakRef.current = batchMax;
          setPeakCurrent(batchMax);
        }

        setRaw(rawRef.current);
      }

      if (e.phase === "completed") {
        setPhase("completed");
        setAnalysis(analyzeRaw(rawRef.current));

        if (typeof e.finalPeak === "number" && e.finalPeak > peakRef.current) {
          peakRef.current = e.finalPeak;
          setPeakCurrent(e.finalPeak);
        }

        // Only a real interlock trip carries a reason — a normal
        // TestStopped completion leaves this null.
        if (e.abortReason) {
          setAbortReason(e.abortReason);
        }
      }
    });

    const unsubConnected = subscribeReactorConnected(setConnected);

    return () => {
      unsubEvents();
      unsubConnected();
    };
  }, []);

  useEffect(() => {
    if (!startedAt || phase !== "ramp_up") return;
    const id = setInterval(() => setDuration((Date.now() - startedAt) / 1000), 200);
    return () => clearInterval(id);
  }, [startedAt, phase]);

  const latest = raw[raw.length - 1];

  return {
    raw, analysis, phase, connected, duration,
    latestCurrent: latest?.current ?? 0,
    latestVoltage: latest?.voltage ?? 0,
    peakCurrent,
    totalSamples: raw.length,
    interlock,
    abortReason,
    hardwareFault,
    reset,
  };
}