import * as XLSX from "xlsx";
import type { TestObject, TestReport } from "@/types/testObject";

/**
 * Generates the client's "Shunt reactor data for linearity testing" report
 * as a downloadable .xlsx file, matching the column layout supplied by the
 * client (columns B through S).
 *
 * IMPORTANT — formulas used below are standard IEC/IEEE conventions and are
 * NOT yet confirmed against the client's exact methodology. Anything marked
 * "ASSUMPTION" should be verified before this is used for a real deliverable.
 */

const COPPER_TEMP_CONSTANT = 234.5; // ASSUMPTION: copper windings. Aluminum ≈ 225.

interface Calculated {
  ratedCurrent: number;       // G
  resAt20: number;            // K
  tau: number;                // L (sec)
  timeToSteadyState: number;  // O (sec)
  ultimateVoltage: number;    // Q (V)
  voltageForDesiredTime: number | null; // S (V) — null if inputs missing
}

function calculate(object: TestObject, report: TestReport): Calculated {
  const mvar = object.mvar ?? 0;
  const kv = object.lineKv ?? 0;
  const phases = object.phases ?? 3;
  const resRef = object.resAtRefTemp ?? 0;
  const refTemp = object.refTempForRes ?? 20;
  const inductance = object.inductance ?? 0; // Henries
  const resIncreasePu = object.resIncreaseByLeadsPu ?? 0;
  const desiredTime = object.desiredTimeToReachIdc;
  const idc = report.peakCurrent;

  // G — Rated AC RMS current from MVAr + kV + phase count.
  const ratedCurrent =
    kv > 0
      ? phases === 1
        ? (mvar * 1e6) / (kv * 1e3)
        : (mvar * 1e6) / (Math.sqrt(3) * kv * 1e3)
      : 0;

  // K — Resistance corrected to 20°C.
  const resAt20 =
    resRef > 0
      ? resRef * (COPPER_TEMP_CONSTANT + 20) / (COPPER_TEMP_CONSTANT + refTemp)
      : 0;

  // L — Time constant τ = L / R.
  const tau = resAt20 > 0 ? inductance / resAt20 : 0;

  // O — Time to steady state, conventionally 5τ.
  const timeToSteadyState = 5 * tau;

  // Effective resistance including lead-connection increase.
  const rEffective = resAt20 * (1 + resIncreasePu);

  // Q — Ultimate DC voltage at 5τ (steady-state V = I × R).
  const ultimateVoltage = idc * rEffective;

  // S — DC voltage required to reach Idc within the customer's desired time,
  // using the standard RL charging equation: I(t) = (V/R)(1 - e^(-t/τ)).
  let voltageForDesiredTime: number | null = null;
  if (desiredTime && desiredTime > 0 && tau > 0) {
    const factor = 1 - Math.exp(-desiredTime / tau);
    if (factor > 0) {
      voltageForDesiredTime = (idc * rEffective) / factor;
    }
  }

  return { ratedCurrent, resAt20, tau, timeToSteadyState, ultimateVoltage, voltageForDesiredTime };
}

/** Finds the voltage sample closest to a target elapsed time (ms), for cross-checking Q against real measured data. */
function voltageNearTime(report: TestReport, targetMs: number): number | null {
  const points = report.analysisResult.length ? report.analysisResult : report.rawResult;
  if (!points.length) return null;
  let closest = points[0];
  let bestDiff = Math.abs(points[0].timestamp - targetMs);
  for (const p of points) {
    const diff = Math.abs(p.timestamp - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      closest = p;
    }
  }
  return closest.voltage;
}

export function exportLinearityReportExcel(object: TestObject, report: TestReport) {
  const calc = calculate(object, report);

  // Cross-check the calculated "ultimate voltage" against the actual
  // measured voltage near 5τ, if the test ran long enough to reach it.
  const measuredAt5Tau = voltageNearTime(report, calc.timeToSteadyState * 1000);

  const headers = [
    "Sl. No.",
    "W. O. No.",
    "MVAr",
    "Line kV",
    "No. of phases",
    "Frequency, Hz",
    "Rated ac rms current, A",
    "Inductance, H",
    "Res/ph at ref temp, ohm",
    "Ref temp for res, deg C",
    "Res/ph @ 20 deg C, ohm",
    "τ = L/R @ 20 deg C, sec",
    "PU linearity",
    "Idc for linearity test, A",
    "Time to steady state, 5.τ, sec",
    "Res increase by connecting leads, PU",
    "Ultimate dc voltage at 5.τ, V",
    "Desired time to reach Idc, sec",
    "DC voltage to reach Idc in desired time, V",
  ];

  const row = [
    1, // Sl. No. — single-row export; increment manually for batch reports
    object.workOrder || "",
    object.mvar ?? "",
    object.lineKv ?? "",
    object.phases ?? "",
    object.frequency ?? "",
    round(calc.ratedCurrent, 2),
    object.inductance ?? "",
    object.resAtRefTemp ?? "",
    object.refTempForRes ?? "",
    round(calc.resAt20, 5),
    round(calc.tau, 4),
    "", // PU linearity — formula not yet confirmed, left blank intentionally
    round(report.peakCurrent, 2),
    round(calc.timeToSteadyState, 2),
    object.resIncreaseByLeadsPu ?? "",
    round(calc.ultimateVoltage, 2),
    object.desiredTimeToReachIdc ?? "",
    calc.voltageForDesiredTime !== null ? round(calc.voltageForDesiredTime, 2) : "",
  ];

  const sheetData = [
    ["Shunt reactor data for linearity testing"],
    [],
    headers,
    row,
  ];

  // Optional reference row: what the DAQ actually measured near 5τ, so the
  // calculated "Ultimate dc voltage" (Q) can be sanity-checked against reality.
  if (measuredAt5Tau !== null) {
    sheetData.push([]);
    sheetData.push(["Measured voltage near 5τ (for cross-check):", round(measuredAt5Tau, 2)]);
  }

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Reasonable column widths so the sheet is readable on open, not squished.
  ws["!cols"] = headers.map(() => ({ wch: 16 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Linearity Report");

  XLSX.writeFile(wb, `Linearity_Report_${object.serialNumber}.xlsx`);
}

function round(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}