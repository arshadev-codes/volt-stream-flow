import { useCallback, useEffect, useRef, useState } from "react";
import type { Sample, TestStatus } from "@/types/sample";
import { createMockSampleSource, type SampleSource } from "@/services/mockGenerator";

const MAX_SAMPLES = 100;

interface Options {
  /** Inject a different source (WebSocket/REST) later without changing the hook. */
  source?: SampleSource;
  maxSamples?: number;
}

/**
 * Owns the test lifecycle: start/stop/clear, sample buffer, and status.
 * UI components stay dumb — they read state and call the returned actions.
 */
export function useVoltageTesting(options: Options = {}) {
  const { source, maxSamples = MAX_SAMPLES } = options;
  const [samples, setSamples] = useState<Sample[]>([]);
  const [status, setStatus] = useState<TestStatus>("idle");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [duration, setDuration] = useState(0);

  const unsubRef = useRef<(() => void) | null>(null);
  const sourceRef = useRef<SampleSource>(source ?? createMockSampleSource());

  const stop = useCallback(() => {
    unsubRef.current?.();
    unsubRef.current = null;
    setStatus((s) => (s === "running" ? "stopped" : s));
  }, []);

  const start = useCallback(() => {
    if (unsubRef.current) return;
    setStatus("running");
    setStartedAt(Date.now());
    unsubRef.current = sourceRef.current.subscribe((sample) => {
      setSamples((prev) => {
        const next = [...prev, sample];
        return next.length > maxSamples ? next.slice(next.length - maxSamples) : next;
      });
    });
  }, [maxSamples]);

  const clear = useCallback(() => {
    setSamples([]);
    setDuration(0);
    setStartedAt(null);
    if (status !== "running") setStatus("idle");
  }, [status]);

  // Track elapsed duration while running.
  useEffect(() => {
    if (status !== "running" || startedAt == null) return;
    const id = setInterval(() => setDuration((Date.now() - startedAt) / 1000), 250);
    return () => clearInterval(id);
  }, [status, startedAt]);

  // Cleanup on unmount.
  useEffect(() => () => unsubRef.current?.(), []);

  const latest = samples[samples.length - 1];

  return {
    samples,
    status,
    duration,
    latestVoltage: latest?.voltage ?? 0,
    latestCurrent: latest?.current ?? 0,
    totalSamples: samples.length,
    start,
    stop,
    clear,
  };
}
