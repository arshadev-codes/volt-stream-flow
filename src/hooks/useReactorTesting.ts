import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactorSample, ReactorPhase } from "@/types/sample";
import { createReactorSource, type ReactorSource } from "@/services/reactorSimulation";

const MAX_SAMPLES = 200;

interface Options {
  source?: ReactorSource;
  maxSamples?: number;
}

/**
 * Owns the reactor test lifecycle. UI components stay dumb — they read state
 * and call the returned actions.
 */
export function useReactorTesting(options: Options = {}) {
  const { maxSamples = MAX_SAMPLES } = options;
  const [samples, setSamples] = useState<ReactorSample[]>([]);
  const [phase, setPhase] = useState<ReactorPhase>("idle");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [duration, setDuration] = useState(0);
  const [peakCurrent, setPeakCurrent] = useState(0);

  const unsubRef = useRef<(() => void) | null>(null);
  const sourceRef = useRef<ReactorSource | null>(options.source ?? null);

  const stop = useCallback(() => {
    // Soft-stop: trigger early decay rather than killing the stream.
    sourceRef.current?.triggerDecay();
  }, []);

  const reset = useCallback(() => {
    unsubRef.current?.();
    unsubRef.current = null;
    sourceRef.current = null;
    setSamples([]);
    setDuration(0);
    setStartedAt(null);
    setPeakCurrent(0);
    setPhase("idle");
  }, []);

  const start = useCallback(() => {
    if (unsubRef.current) return;
    setSamples([]);
    setPeakCurrent(0);
    setDuration(0);
    setStartedAt(Date.now());
    setPhase("ramp_up");

    const src = options.source ?? createReactorSource();
    sourceRef.current = src;

    unsubRef.current = src.subscribe((e) => {
      setPhase(e.phase);
      if (!e.sample) return;
      setSamples((prev) => {
        const next = [...prev, e.sample!];
        return next.length > maxSamples ? next.slice(next.length - maxSamples) : next;
      });
      setPeakCurrent((p) => Math.max(p, e.sample!.current));
    });
  }, [maxSamples, options.source]);

  useEffect(() => {
    if (!startedAt || phase === "idle" || phase === "completed") return;
    const id = setInterval(() => setDuration((Date.now() - startedAt) / 1000), 250);
    return () => clearInterval(id);
  }, [startedAt, phase]);

  useEffect(() => () => unsubRef.current?.(), []);

  const latest = samples[samples.length - 1];

  return {
    samples,
    phase,
    duration,
    latestCurrent: latest?.current ?? 0,
    latestVoltage: latest?.voltage ?? 0,
    peakCurrent,
    totalSamples: samples.length,
    start,
    stop,
    reset,
  };
}
