import type { PhaseCount, PowerUnit , VoltageUnit, ResLeadsUnit } from "@/types/testObject";
import type { RawPoint } from "@/types/sample";

const SQRT3 = Math.sqrt(3);
const SQRT2 = Math.sqrt(2);
/** Resistance temp-correction constant for annealed copper (k=234.5). */
const COPPER_K = 234.5;

/** Target PU Linearity factor used by the test standard — single source of truth. */
export const PU_LINEARITY = 1.5;

export function powerUnitMultiplier(unit: PowerUnit): number {
  switch (unit) {
    case "VAR": return 1;
    case "KVAR": return 1_000;
    case "MVAR": return 1_000_000;
    default: return 1;
  }
}

export function computeRatedVoltageV(value: number, unit: VoltageUnit): number {
  const multiplier = unit === "MV" ? 1_000_000 : unit === "kV" ? 1_000 : 1;
  return value * multiplier;
}

/** Rated power in VA from the entered value + selected unit. */
export function computeRatedPowerVA(value: number, unit: PowerUnit): number {
  if (!value || value <= 0) return 0;
  return value * powerUnitMultiplier(unit);
}

/**
 * Rated AC RMS current, A = Q / (V × √3) for 3-phase, Q / V for 1-phase.
 * Q = ratedPowerVA, V = ratedVoltageNameplate.
 *
 * Verified example: 150 MVAr, 420 kV, 3-phase -> 150,000,000 / (420,000 x 1.7320508) = 206.19 A
 */
export function computeRatedAcRmsCurrent(
  ratedPowerVA: number,
  ratedVoltageNameplate: number,
  phases?: PhaseCount,
): number {
  if (!ratedPowerVA || !ratedVoltageNameplate) return 0;
  const denom = phases === 3 ? ratedVoltageNameplate * SQRT3 : ratedVoltageNameplate;
  return denom > 0 ? ratedPowerVA / denom : 0;
}

/**
 * Inductance, H = RatedVoltageNameplate² × phases / (6 × RatedPowerVA × π × Frequency).
 *
 * Verified against the reference sheet: 420 kV, 125 MVAr, 3-phase, 50 Hz -> 4.4920 H.
 * This is OPT-IN: the Setup form still defaults to manual entry (testing phase, no live
 * DAQ current yet, so this can't be cross-checked against a real magnetizing curve). Once
 * live current data is flowing, flip the form's "Auto-calculate" toggle to use this instead.
 */
export function computeInductance(
  ratedVoltageNameplate: number,
  ratedPowerVA: number,
  phases: number,
  frequency: number,
): number {
  if (!ratedVoltageNameplate || !ratedPowerVA || !frequency) return 0;
  return (ratedVoltageNameplate ** 2 * phases) / (6 * ratedPowerVA * Math.PI * frequency);
}

/**
 * Resistance corrected to 20°C from a reading taken at a reference temperature.
 * R20 = Rref × (k + 20) / (k + Tref), copper k = 234.5.
 */
export function computeResAt20DegC(resAtRefTemp: number, refTempForRes: number): number {
  if (!resAtRefTemp || refTempForRes === undefined || refTempForRes === null) return 0;
  const denom = COPPER_K + refTempForRes;
  return denom > 0 ? resAtRefTemp * (COPPER_K + 20) / denom : 0;
}

/** Idc for linearity test, A = Rated AC RMS Current × multiplier × √2.
 *  multiplier defaults to the standard PU_LINEARITY (1.5) but can be
 *  overridden from Settings (unlocked "Current Multiplier" field). */
export function computeIdcForLinearityTest(ratedAcRmsCurrent: number, multiplier: number = PU_LINEARITY): number {
  if (!ratedAcRmsCurrent) return 0;
  return ratedAcRmsCurrent * multiplier * SQRT2;
}

/**
 * Resistance increase from connecting leads, converted to an absolute ohm value.
 *   - unit "%"  -> treated as a percentage OF resAtRefTemp (e.g. 2 means 2% of resAtRefTemp)
 *   - unit "Ω"  -> the entered value IS already the ohm increase, used as-is
 *
 * Result is what gets added on top of resistance elsewhere (e.g. resAt20DegC)
 * to get the effective resistance used in the DC voltage calculations.
 */
export function computeResIncreaseByLeads(
  resAtRefTemp: number,
  value: number,
  unit: ResLeadsUnit,
): number {
  if (!resAtRefTemp || !value) return 0;
  return unit === "%" ? resAtRefTemp * (value / 100) : value;
}

/**
 * Time constant, τ = L / R @ 20°C, in seconds.
 */
export function computeTimeConstant(inductance: number, resAt20DegC: number): number {
  if (!inductance || !resAt20DegC) return 0;
  return inductance / resAt20DegC;
}

/**
 * Time to steady state = 5 × τ (standard RL "5 time-constants" settling rule).
 */
export function computeTimeToSteadyState(timeConstant: number): number {
  if (!timeConstant) return 0;
  return 5 * timeConstant;
}

/**
 * Ultimate DC voltage at 5×τ (steady state), V
 *   = Resistance Increase by Leads (PU) × Idc for Linearity Test (A) × Res/ph at Ref Temp (Ω)
 *
 * NOTE: this reads object.resIncreaseByLeadsPu — confirm that field is actually
 * populated on the TestObject before relying on this (see naming-mismatch note
 * from setup.tsx submit()).
 */
export function computeUltimateDcVoltage(
  resIncreaseByLeadsPu: number,
  idcForLinearityTest: number,
  resAtRefTemp: number,
): number {
  if (!resIncreaseByLeadsPu || !idcForLinearityTest || !resAtRefTemp) return 0;
  return resIncreaseByLeadsPu * idcForLinearityTest * resAtRefTemp;
}

/**
 * Finds the sample where current hits its peak (≈ Idc) during a test run,
 * and returns the elapsed time (seconds) and the voltage recorded at that
 * instant. Feeds "Desired Time to Reach Idc" and "DC Voltage to Reach Idc
 * in Desired Time" directly from the actual recorded test data.
 */
export interface PeakDcPoint {
  timeSec: number;
  voltage: number;
}

export function computePeakDcPoint(points: RawPoint[]): PeakDcPoint {
  if (!points.length) return { timeSec: 0, voltage: 0 };
  let peak = points[0];
  for (const p of points) {
    if (p.current > peak.current) peak = p;
  }
  return { timeSec: peak.timestamp / 1000, voltage: peak.voltage };
}

/**
 * Finds the recorded raw point closest to a given timestamp (ms) and
 * returns its voltage. Used for the "locked tau" versions of Time to
 * Steady State / Ultimate DC Voltage (see reportPdf.tsx computeReportFields
 * Option 1) — reads the ACTUAL recorded voltage at that instant instead of
 * computing it from the formula.
 */
export function computeVoltageAtTimestamp(points: RawPoint[], timestampMs: number): number {
  if (!points.length) return 0;
  let closest = points[0];
  let closestDiff = Math.abs(points[0].timestamp - timestampMs);
  for (const p of points) {
    const diff = Math.abs(p.timestamp - timestampMs);
    if (diff < closestDiff) {
      closest = p;
      closestDiff = diff;
    }
  }
  return closest.voltage;
}

/**
 * Differential inductance vs current — R * (i / di/dt), per IEC 60076-6 eq. B8.
 * Used only for the Saturation Rate graph (flattening marks the linear region);
 * this is NOT the same as flux (psi) — that's computed separately in
 * tauCalculation.ts + fluxCalculation.ts, which is the shared pipeline every
 * other graph reads from. This function stays intentionally small/separate
 * since it needs the raw di/dt curve shape, not the tau-locked/flux result.
 */
export interface IncrementalInductancePoint {
  timestamp: number;
  current: number;
  incrementalL: number;
}

export function computeIncrementalInductance(points: RawPoint[], R: number): IncrementalInductancePoint[] {
  if (!R || R <= 0 || points.length < 2) return [];

  const n = points.length;
  const t = points.map((p) => p.timestamp / 1000); // seconds
  const i = points.map((p) => p.current);

  const didt = new Array(n).fill(0);
  for (let k = 0; k < n; k++) {
    if (k === 0) didt[k] = (i[1] - i[0]) / (t[1] - t[0] || 1e-9);
    else if (k === n - 1) didt[k] = (i[n - 1] - i[n - 2]) / (t[n - 1] - t[n - 2] || 1e-9);
    else didt[k] = (i[k + 1] - i[k - 1]) / (t[k + 1] - t[k - 1] || 1e-9);
  }

  // Ignore points where di/dt is too small to divide by safely — these occur
  // right at the current waveform's peak (turning point) and produce
  // meaningless huge/near-infinite spikes.
  const didtThreshold = Math.max(...i) * 0.02; // tune as needed


  return points.map((p, k) => ({
    timestamp: p.timestamp,
    current: i[k],
    incrementalL: Math.abs(didt[k]) < didtThreshold ? NaN : R * (i[k] / didt[k]),
  }));
}


  export interface MagneticCharacteristicsPoint {
    CurrentPu : number ;
    FluxPU : number ;
  }

  export function computeMagneticCharacteristicPu(
  fluxData: { current: number; psi: number }[],
  inductance: number,
  ratedAcRmsCurrent: number,
): MagneticCharacteristicsPoint[] {
  if (!inductance || !ratedAcRmsCurrent || fluxData.length < 2) return [];

  const iBase = ratedAcRmsCurrent * Math.SQRT2;
  const psiBase = inductance * iBase;

  if (iBase <= 0 || psiBase <= 0) return [];

  return fluxData.map((f) => ({
    CurrentPu: f.current / iBase,
    FluxPU: f.psi / psiBase,
  }));
}