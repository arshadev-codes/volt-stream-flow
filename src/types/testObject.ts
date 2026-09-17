import type { RawPoint } from "./sample";

export const TestStatus = {
  Pending: "pending",
  Passed: "passed",
  Failed: "failed",
} as const;
export type TestStatus = typeof TestStatus[keyof typeof TestStatus];

export type PhaseCount = 1 | 3;
export type PowerUnit = "VAR" | "KVAR" | "MVAR";
export type VoltageUnit = "V" | "kV" | "MV";
export type ResLeadsUnit = "Ω" | "%";

export interface TestObject {
  id: string;
  serialNumber: string;
  name: string;
  manufacturer?: string;

  /** Job context */
  projectName: string;
  customerName: string;
  workOrder: string;

  ratedVoltage: number;
  maxVoltage: number;
  ratedCurrent: number;
  frequency?: number;
  inductance?: number; // Henries (full value, not mH)
  notes?: string;

  /* ---------- Reactor nameplate data (for linearity report) ---------- */

  /** Raw number the user typed, e.g. 150 */
  ratedPowerValue?: number;
  /** Unit the user selected for ratedPowerValue */
  ratedPowerUnit?: PowerUnit;
  /** Computed: ratedPowerValue converted to VA (x1 / x1,000 / x1,000,000) */
  ratedPowerVA?: number;
  /** Rated voltage entered specifically for the nameplate/linearity current calc, V (e.g. 420,000 for a 420 kV reactor) — independent of the general ratedVoltage field above. */
  ratedVoltageNameplate?: number;

  phases?: PhaseCount;
  resAtRefTemp?: number;         // Ω, "Res/ph at ref temp"
  refTempForRes?: number;        // °C, "Ref temp for res"
  resIncreaseByLeadsPu?: number; // PU, e.g. 0.02 for 2%

  /** Computed, locked: ratedPowerVA / (ratedVoltageNameplate * (phases===3 ? √3 : 1)) */
  ratedAcRmsCurrent?: number;
  /** Computed, locked: resAtRefTemp corrected to 20°C (copper, k=234.5) */
  resAt20DegC?: number;
  /** Computed, locked: ratedAcRmsCurrent * 1.5 * √2 */
  idcForLinearityTest?: number;

  /* ---------- Customer-supplied test targets (entered at creation) ---------- */
  desiredTimeToReachIdc?: number; // sec, "Desired time to reach Idc"

  createdAt: number;
  /** Updated whenever a test is conducted (= report.completedAt). Defaults to createdAt. */
  modifiedAt: number;
  status: TestStatus;
}

export interface MagneticCharacteristicsPoint {
  CurrentPu: number;
  FluxPU: number;
}

/**
 * Snapshot of every derived/calculated value for a completed test, frozen
 * at the moment the report is saved. Stored permanently (not recomputed
 * from raw_result each time a report is reopened) so historical reports
 * stay accurate even if the calculation formulas change later.
 */
export interface CalculatedResults {
  /** Locked time constant from calculateTau(), seconds. Null if it never locked. */
  tau: number | null;
  /** L / R @ 20°C, seconds. */
  timeConstant: number;
  /** 5 x timeConstant, seconds. */
  timeToSteadyState: number;
  /** resIncreaseByLeadsPu x idcForLinearityTest x resAtRefTemp, V. */
  ultimateDcVoltage: number;
  /** Current at the point tau-lock broke (noise boundary), A. Null if never broke. */
  breakPointCurrent: number | null;
  /** Timestamp (seconds) of the break point. Null if never broke. */
  breakPointTimeSec: number | null;
  /** Per-unit magnetic characteristic curve (flux vs current), for the flux-curve graph. */
  magneticCharacteristic: MagneticCharacteristicsPoint[];
}

export interface TestReport {
  objectId: string;
  status: Exclude<TestStatus, "pending">;
  /** Serialized JSON array as captured by the acquisition loop (0.25 ms cadence). */
  rawResult: RawPoint[];
  /** Median-of-4 downsampled dataset (1 ms cadence) computed after completion. */
  analysisResult: RawPoint[];
  /** Frozen calculation snapshot — see CalculatedResults. Optional only for
   *  backward compatibility with reports saved before this field existed. */
  calculatedResults?: CalculatedResults;
  peakCurrent: number;
  durationS: number;
  completedAt: number;
}