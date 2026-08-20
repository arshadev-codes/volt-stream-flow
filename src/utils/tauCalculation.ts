import type { RawPoint } from "@/types/sample";

/**
 * Result of locking onto a stable time-constant (tau) in the decay curve.
 *
 * The algorithm scans forward through the discharge (t >= 0) samples,
 * computing an instantaneous tau at each step (tau = i / (di/dt)).
 * Once a rolling window of tau values becomes stable (max-min <= avg * tolerance),
 * tau is "locked". From that point on, any sample whose tau drifts too far
 * from the locked value is treated as noise, and the curve is truncated there.
 */
export interface TauResult {
  tau: number | null;
  finalCurrent: number | null;
  lockIndex: number | null;
  firstIndex: number | null;
  breakAtIndex: number | null;
  decayValues: RawPoint[];   // all samples with timestamp >= 0
  smoothData: RawPoint[];    // the trustworthy slice used for flux calculation
}

/**
 * @param data        Raw samples (timestamp in ms, current in A).
 * @param tolerance   Fractional tau drift allowed before locking / before flagging noise.
 * @param windowSize  Fixed number of consecutive samples used to judge tau stability —
 *                    same meaning as in the original prototype (default 50 samples).
 */
export function calculateTau(
  data: RawPoint[],
  tolerance = 0.08,
  windowSize = 50,
): TauResult {
  const decayValues = data.filter((point) => point.timestamp >= 0);

  let lockedTau: number | null = null;
  let finalCurrent: number | null = null;
  let lockIndex: number | null = null;
  let firstIndex: number | null = null;
  let breakAtIndex: number | null = null;
  let noiseBreakHit = false; // tracks WHY the loop ended: real noise vs clean run to the end
  const tauValues: number[] = [];

  for (let i = 1; i < decayValues.length; i++) {
    const curr = decayValues[i];
    const prev = decayValues[i - 1];
    const di = curr.current - prev.current;
    const dt = (curr.timestamp - prev.timestamp) / 1000; // ms -> s
    const tau = Math.abs(curr.current / (di / dt || 1e-12));

    if (lockedTau === null) {
      tauValues.push(tau);
      if (tauValues.length > windowSize) tauValues.shift();

      if (tauValues.length === windowSize) {
        const sum = tauValues.reduce((a, b) => a + b, 0);
        const avgTau = sum / windowSize;
        const minTau = Math.min(...tauValues);
        const maxTau = Math.max(...tauValues);

        if (maxTau - minTau <= avgTau * tolerance) {
          lockedTau = avgTau;
          lockIndex = i;
          firstIndex = i - windowSize + 1;
        }
      }
    } else {
      const diffFromLocked = Math.abs(tau - lockedTau);

      if (diffFromLocked > lockedTau * tolerance) {
        finalCurrent = prev.current;
        breakAtIndex = i - 1; // last trustworthy sample before noise hit
        noiseBreakHit = true;
        break;
      }

      finalCurrent = curr.current;
    }
  }

  // Curve stayed clean all the way to the end (e.g. addNoise: false) — noise
  // never broke the lock, so treat the last sample as the end of the trustworthy window.
  if (lockedTau !== null && !noiseBreakHit) {
    finalCurrent = decayValues[decayValues.length - 1].current;
    breakAtIndex = decayValues.length - 1;
  }

  const smoothData =
    firstIndex !== null && breakAtIndex !== null
      ? decayValues.slice(firstIndex, breakAtIndex + 1)
      : [];

  return {
    tau: lockedTau,
    finalCurrent,
    lockIndex,
    firstIndex,
    breakAtIndex,
    decayValues,
    smoothData,
  };
}
