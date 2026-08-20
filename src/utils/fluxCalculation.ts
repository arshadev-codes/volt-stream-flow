import type { TauResult } from "./tauCalculation";

/**
 * The second "sample" — one linked-flux point per sample inside the
 * trustworthy (smooth) window that tauCalculation.ts identified.
 *
 * new_timestamp / linked_flux are the two new fields RawPoint already had
 * reserved for this — this is where they actually get filled in.
 */
export interface FluxSamplePoint {
  new_timestamp: number; // ms, same timestamp as the source raw sample
  current: number;
  linked_flux: number;   // psi'(t) — accumulated flux since t=0 (eq. B7, flipped)
  psi: number;            // psi(i) — remaining flux at this current (magnetic characteristic, eq. B7/B9 raw form)
}

/**
 * IEC 60076-6 Annex B.7.1 — same algorithm as the prototype's computeFlux,
 * ported onto RawPoint/TauResult:
 *   1. B9 — seed the flux remaining at the last trustworthy sample (the "tail").
 *   2. B7 — walk backward through the smooth window, accumulating flux chunks.
 *   3. Flip to chronological order and convert psi (remaining) -> psi' (accumulated since t=0).
 *
 * @param tauResult  Output of calculateTau() — must have a locked tau and non-empty smoothData.
 * @param R          Test object resistance (ohms).
 */
export function calculateFlux(tauResult: TauResult, R: number): FluxSamplePoint[] {
  const { smoothData, tau: lockedTau, finalCurrent } = tauResult;

  if (!R || R <= 0 || lockedTau === null || finalCurrent === null || smoothData.length < 2) {
    return [];
  }

  const anchorIndex = smoothData.length - 1;

  // ---- B9: flux remaining at the anchor (last trustworthy) point ----
  let currentFlux = lockedTau * R * finalCurrent;

  const raw: { timestamp: number; current: number; linked_flux: number }[] = [];

  raw.push({
    timestamp: smoothData[anchorIndex].timestamp,
    current: smoothData[anchorIndex].current,
    linked_flux: currentFlux,
  });

  // ---- B7: walk backward, accumulating flux chunks toward t=0 ----
  for (let i = anchorIndex; i > 0; i--) {
    const currentSample = smoothData[i];
    const previousSampleInTime = smoothData[i - 1]; // one step closer to t=0

    const dt = (currentSample.timestamp - previousSampleInTime.timestamp) / 1000; // ms -> s
    const fluxChunk = R * currentSample.current * dt;

    currentFlux = currentFlux + fluxChunk;

    raw.push({
      timestamp: previousSampleInTime.timestamp,
      current: previousSampleInTime.current,
      linked_flux: currentFlux,
    });
  }

  // ---- Flip to chronological order (was built backward) ----
  raw.reverse();

  // ---- Convert psi (remaining) -> psi' (accumulated since t=0): psi'(t) = psi0 - psi(t) ----
  const psi0 = raw[0].linked_flux;

  return raw.map((point) => ({
    new_timestamp: point.timestamp,
    current: point.current,
    linked_flux: +(psi0 - point.linked_flux).toFixed(6), // psi'(t) — this is what the Flux vs Time graph plots
    psi: +point.linked_flux.toFixed(6),                   // psi(i) — this is what the Flux Curve (magnetic characteristic) plots
  }));
}
