import type { RawPoint } from "@/types/sample";

export interface ExponentialDataOptions {
  samples?: number;
  tStart?: number;      // seconds
  tEnd?: number;         // seconds
  peak?: number;         // A
  tauRise?: number;      // seconds
  tauDecay?: number;     // seconds
  addNoise?: boolean;
  noiseStartTime?: number; // seconds
  noiseStrength?: number;  // fractional
}

/**
 * Direct port of the prototype's generateExponentialData — a clean
 * double-exponential curve (rising for t<0, decaying for t>0), with
 * optional noise injected only near the tail, to test whether
 * calculateTau correctly locks onto the clean region and detects the
 * noisy break point.
 *
 * Output uses RawPoint's ms timestamps (the prototype used seconds directly).
 */
export function generateExponentialData(opts: ExponentialDataOptions = {}): RawPoint[] {
  const {
    samples = 100,
    tStart = -3,
    tEnd = 17,
    peak = 20,
    tauRise = 1.3,
    tauDecay = 3.5,
    addNoise = true,
    noiseStartTime = 12,
    noiseStrength = 0.2,
  } = opts;

  const step = (tEnd - tStart) / (samples - 1);
  const points: RawPoint[] = [];

  for (let k = 0; k < samples; k++) {
    const t = tStart + k * step; // seconds
    let value: number;

    if (t < 0) {
      value = peak * Math.exp(t / tauRise);
    } else {
      value = peak * Math.exp(-t / tauDecay);
    }

    if (addNoise && t > noiseStartTime) {
      value += (Math.random() - 0.5) * value * noiseStrength;
    }

    points.push({
      timestamp: +(t * 1000).toFixed(3), // seconds -> ms, to match RawPoint
      current: +value.toFixed(4),
      voltage: 0,
      phase: 0,
      new_timestamp: 0,
      linked_flux: 0,
    });
  }

  return points;
}
