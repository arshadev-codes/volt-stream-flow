import { useEffect, useCallback, useRef, useState } from "react";
import type { RawPoint, ReactorPhase, InterlockStatus } from "@/types/sample";
import { createSignalRSource, type HardwareSource } from "@/services/signalRSource";
import { analyzeRaw } from "@/services/analysis";

const HUB_URL = "https://localhost:7115/hubs/linearity";

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
  const [connected, setConnected] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [duration, setDuration] = useState(0);
  const [peakCurrent, setPeakCurrent] = useState(0);
  const [interlock, setInterlock] = useState<InterlockStatus>(DEFAULT_INTERLOCK);

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
  }, []);

  useEffect(() => {
    const src: HardwareSource = createSignalRSource({ hubUrl: HUB_URL });

    const unsub = src.subscribe((e) => {
      if (e.interlock) {
        setInterlock(e.interlock);
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
        return;
      }

      if (e.batch.length) {
        rawRef.current = rawRef.current.concat(e.batch);

        // Pinpoint accurate peak: scan EVERY sample in the batch, not just
        // the last one. A 100ms batch (~500 samples at 5kHz) can easily
        // have its true peak mid-batch rather than at the final sample —
        // relying on just the last point's `peak` field misses that.
        let batchMax = peakRef.current;
        for (const p of e.batch as RawPoint[]) {
          if (p.current > batchMax) batchMax = p.current;
        }

        // Cross-check against the backend's own running peak (sent on the
        // last sample of the batch) in case it disagrees — take whichever
        // is higher, since either source undercounting means we lose the
        // true peak.
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

        // Final cross-check against the backend's finalPeak, in case the
        // true peak occurred in a sample that was never batched (e.g. right
        // at test-abort boundary).
        if (typeof e.finalPeak === "number" && e.finalPeak > peakRef.current) {
          peakRef.current = e.finalPeak;
          setPeakCurrent(e.finalPeak);
        }
      }
    });

    src
      .connect()
      .then(() => setConnected(true))
      .catch(() => setConnected(false));

    return () => {
      unsub();
      src.disconnect();
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
    reset,
  };
}