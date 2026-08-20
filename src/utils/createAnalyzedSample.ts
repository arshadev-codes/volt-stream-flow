import type { RawPoint } from "@/types/sample";
import { calculateTau } from "./tauCalculation";
import { calculateFlux, type FluxSamplePoint } from "./fluxCalculation";

export interface BreakPoint {
  timestamp: number;
  current: number;
}

/** One point for the raw waveform graph — same as RawPoint, plus an optional
 *  i_smooth value that's only set inside the locked/trustworthy window, so
 *  the graph can draw it as a separate highlighted overlay line. */
export interface RawDisplayPoint extends RawPoint {
  i_smooth?: number;
}

export interface AnalyzedResult {
  /** Raw points with i_smooth attached, for the highlighted overlay on Chart 1. */
  rawDisplay: RawDisplayPoint[];
  /** The two new-sample points (new_timestamp, linked_flux, psi) — Chart 2 & 3 data. */
  fluxData: FluxSamplePoint[];
  /** Where the algorithm detected noise / lost trustworthy tau lock — the black dot on Chart 1. */
  breakPoint: BreakPoint | null;
  /** Locked tau value (seconds), or null if it never locked. */
  tau: number | null;
}

/**
 * Runs calculateTau then calculateFlux, and shapes the results for the graphs.
 * This is the one place the pipeline runs — graphs just render what comes out,
 * they don't recompute anything themselves.
 */
export function createAnalyzedSample(raw: RawPoint[], R: number): AnalyzedResult {
  const tauResult = calculateTau(raw);

  // TEMP DEBUG — remove once tau locking is tuned for real data
  // console.log("[tau debug]", {
  //   locked: tauResult.tau,
  //   lockIndex: tauResult.lockIndex,
  //   breakAtIndex: tauResult.breakAtIndex,
  //   smoothDataLength: tauResult.smoothData.length,
  //   decayValuesLength: tauResult.decayValues.length,
  // });

  const fluxData = calculateFlux(tauResult, R);

  // Build breakPoint the same way the prototype did.
  let breakPoint: BreakPoint | null = null;
  if (tauResult.breakAtIndex !== null && tauResult.decayValues[tauResult.breakAtIndex]) {
    const p = tauResult.decayValues[tauResult.breakAtIndex];
    breakPoint = { timestamp: p.timestamp, current: p.current };
  }

  // Mark i_smooth on every raw point that falls inside the locked window,
  // so the raw waveform graph can overlay it as a highlighted line.
  const smoothTimestamps = new Set(tauResult.smoothData.map((p) => p.timestamp));
  const rawDisplay: RawDisplayPoint[] = raw.map((p) => ({
    ...p,
    i_smooth: smoothTimestamps.has(p.timestamp) ? p.current : undefined,
  }));

  return { rawDisplay, fluxData, breakPoint, tau: tauResult.tau };
}
