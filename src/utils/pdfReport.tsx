import type { ReactNode } from "react";
import {
  pdf, Document, Page, Text, View, StyleSheet, Svg, Path, Line, Circle, Rect,
  Defs, LinearGradient, Stop, Image,
} from "@react-pdf/renderer";
import type { TestObject, TestReport } from "@/types/testObject";
import type { RawPoint } from "@/types/sample";
import {
  computeTimeConstant,
  computeTimeToSteadyState,
  computeUltimateDcVoltage,
  computePeakDcPoint,
  computeMagneticCharacteristicPu,
  computeVoltageAtTimestamp,
  PU_LINEARITY,
} from "@/utils/reactorCalcs";
import { createAnalyzedSample } from "@/utils/createAnalyzedSample";
import { Buffer } from "buffer";

/**
 * Reactor Linearity Test Report — sharp/flat redesign (2026).
 *
 * WHITE-LABELED FOR THE CUSTOMER (Atlanta Electronics). Electrosoft
 * branding is intentionally minimal — a small logo in the footer of
 * every page, plus a larger logo mark at the top of the cover page only.
 *
 * GRAPH PARITY — the 4-graph page does NOT recompute flux/tau itself.
 * It calls the exact same pipeline the in-app tabs use:
 *   createAnalyzedSample(points, R)  ->  { rawDisplay, fluxData, breakPoint }
 *   computeMagneticCharacteristicPu(fluxData, inductance, ratedAcRmsCurrent)
 * This guarantees the PDF always matches the app, including any future
 * changes to tauCalculation.ts / fluxCalculation.ts — there is no
 * duplicate flux math living in this file to drift out of sync.
 *
 * REPORT OPTIONS (new) — the export dialog now collects a `ReportOptions`
 * object (see below) that controls:
 *   - graphs.rawWaveform / rawWaveformLog / fluxTime / fluxCurve:
 *     which of the 4 graphs actually render on the "Recorded Linearity
 *     Curves" page. Any subset (including none, 1, 2, 3, or all 4) is
 *     supported — StackedGraphs conditionally renders each GraphCard, so
 *     the page simply has fewer/more blocks and reflows normally via
 *     react-pdf's `wrap`. There is no fixed-height layout anywhere on
 *     this page, so nothing breaks or leaves dead space regardless of
 *     how many graphs are selected.
 *   - showBreakPoint: toggles the "Break" dot + label on the raw-waveform
 *     and log charts (existing tauCalculation.ts noise-break marker).
 *   - showSteadyState: toggles a dashed HORIZONTAL reference line at the
 *     current level reached at calc.timeToSteadyState, matching the
 *     threshold-line style already used elsewhere in the app (NOT a
 *     vertical time marker — that was wrong in an earlier pass of this
 *     file). The current level is looked up via findCurrentAtTimestamp()
 *     below. Under the currently-active Option 1 in computeReportFields(),
 *     timeToSteadyState is literally the Break point's timestamp, so with
 *     both toggles on, the line will currently pass right through the
 *     Break dot. They're independent rendering paths on purpose, so
 *     flipping computeReportFields() back to the Option 2 (5*tau) formula
 *     later will make them diverge without any further changes here.
 * exportReportPdf() defaults to DEFAULT_REPORT_OPTIONS (all 4 graphs,
 * both markers on) if no options are passed, so existing call sites that
 * don't yet pass a 4th argument keep working unchanged.
 *
 * LOGO — LOGO_SRC must point to a real file inside /public
 * (e.g. public/logo-black.png), case-sensitive, committed to the repo.
 * If it isn't there, react-pdf silently fails to render the <Image> and
 * you just see the text with no mark next to it. Flip SHOW_LOGO to false
 * to disable rendering entirely without touching layout while you sort
 * out the correct path/filename. If you use a base64 data URI instead,
 * keep it on one unbroken string and verify it renders in a browser tab
 * before wiring it in — copy/paste across multiple edits is error-prone
 * and silently corrupts the image.
 *
 * "NO DATA CAPTURED YET" — if the 4-graph page renders empty, that is NOT
 * a bug in this file. It means report.rawResult / report.analysisResult
 * arrived here as empty arrays — fixed upstream (see Dashboard doSave()).
 *
 * SIGN-OFF DATA — exportReportPdf() requires a `signOff` argument.
 * The caller is expected to collect this via a dialog (see
 * ExportSignOffDialog.tsx) BEFORE calling this function. Every field in
 * SignOffData is optional at the dialog level — Tested By's designation
 * is always fixed to "Test Engineer", everything else may be left blank
 * and prints as a blank line so the role/name can be filled in by hand
 * after printing. Format on the page is "<Designation> : <Name>" (a
 * single colon, not "  :-  ").
 *
 * IDC NOTATION — "Idc" is rendered everywhere via the <Idc /> helper
 * component below, which prints "I" at full size followed by "dc" at
 * ~62% size, matching the I_dc notation used in the reference Excel
 * sheet. react-pdf has no real <sub> tag, so this is the standard
 * fake-subscript trick: nest a smaller-fontSize <Text> run inside the
 * parent <Text>. <Idc /> returns a fragment (not its own <Text>), so it
 * always inherits color/fontFamily from whichever <Text> it's placed in
 * — just pass it the surrounding text's fontSize.
 *
 * PAGE LAYOUT (current order):
 *   1. Cover Page          — logo, company, and a tabular block of
 *                             Serial Number, Work Order, Reactor Name,
 *                             Project, Customer, Test Engineer, Test
 *                             Date, and Report Generated date, followed
 *                             by the Conclusion. The pass/fail status
 *                             pill that used to sit under the title has
 *                             been removed — the conclusion paragraph
 *                             already states PASSED/FAILED in prose.
 *   2. Reactor Nameplate & Linearity Data (raw nameplate inputs), then
 *      Key Metrics (values derived FROM the graph/analysis pipeline) —
 *      Nameplate now renders ABOVE Key Metrics on this shared page.
 *      Units in this table print as "171.830 A" (no parentheses), with
 *      Ohm -> Ω and C -> °C substituted where the unit has a real symbol.
 *   3. Recorded Linearity Curves (0-4 stacked graphs, per ReportOptions)
 *      followed immediately by Approval & Sign-Off.
 *   4. Raw Acquisition Data (only if raw samples were recorded).
 */

export interface SignOffInfo {
  /** Job title / role printed next to the name. */
  designation: string;
  /** Person's name. Optional for all three roles. */
  name: string;
}

export interface SignOffData {
  /** Designation is always forced to "Test Engineer" by the export dialog. */
  testedBy: SignOffInfo;
  /** Optional — leave designation/name blank to print a blank sign-off line. */
  verifiedBy: SignOffInfo;
  /** Optional — leave designation/name blank to print a blank sign-off line. */
  approvedBy: SignOffInfo;
}

/** Which of the 4 "Recorded Linearity Curves" graphs to render. Any
 *  combination is valid, including all-false (a "no graphs selected"
 *  notice prints instead of an empty page). */
export interface ReportGraphSelection {
  /** Graph 1 — full-range charge + discharge current (linear scale). */
  rawWaveform: boolean;
  /** Graph 2 — discharge-only current, logarithmic Y scale. */
  rawWaveformLog: boolean;
  /** Graph 3 — linked flux vs. time during discharge. */
  fluxTime: boolean;
  /** Graph 4 — magnetic characteristic (per-unit flux vs. per-unit current). */
  fluxCurve: boolean;
}

export interface ReportOptions {
  graphs: ReportGraphSelection;
  /** Show the "Break" dot + label (tauCalculation.ts noise-lock point) on graphs 1 & 2. */
  showBreakPoint: boolean;
  /** Show a dashed vertical "Steady State" reference line on graphs 1 & 2. */
  showSteadyState: boolean;
}

export const DEFAULT_REPORT_OPTIONS: ReportOptions = {
  graphs: { rawWaveform: true, rawWaveformLog: true, fluxTime: true, fluxCurve: true },
  showBreakPoint: true,
  showSteadyState: true,
};

export async function exportReportPdf(
  object: TestObject,
  report: TestReport,
  signOff: SignOffData,
  options: ReportOptions = DEFAULT_REPORT_OPTIONS,
) {
  const blob = await pdf(
    <ReportDocument object={object} report={report} signOff={signOff} options={options} />,
  ).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Report_${object.serialNumber}_${report.status}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ============================== THEME ============================== */
if (typeof window !== "undefined" && !window.Buffer) {
  window.Buffer = Buffer;
}

const C = {
  accent: "#B45309",
  success: "#0F766E",
  danger: "#B91C1C",

  ink: "#0F172A",
  ink2: "#334155",
  // Previously lighter grey tones (#64748B / #94A3B8) read as "dull" in print.
  // Darkened to near-black so labels, footers, and secondary text stay crisp.
  mute: "#0F172A",
  muteLight: "#1E293B",

  line: "#94A3B8",
  lineStrong: "#475569",
  lineDark: "#1E293B",

  soft: "#F8FAFC",
  soft2: "#F1F5F9",
  white: "#FFFFFF",

  successSoft: "#ECFDF5",
  dangerSoft: "#FEF2F2",

  current: "#B45309",
  voltage: "#0369A1",
  breakDot: "#0F172A",
};

const PAGE_PAD = 40;
const FONT = "Helvetica";
const FONT_BOLD = "Helvetica-Bold";
const FONT_OBLIQUE = "Helvetica-Oblique";

const LOGO_SRC = "/logo-black.png";
const SHOW_LOGO = true;

const s = StyleSheet.create({
  page: {
    // Header shrunk from 44 -> 34 to match the footer's visual weight
    // (see s.headerBar / s.footer below); paddingTop trimmed to match,
    // keeping roughly the same ~14-16pt breathing room below the rule.
    paddingTop: 48,
    paddingBottom: 54,
    paddingHorizontal: PAGE_PAD,
    fontSize: 9.5,
    color: C.ink,
    fontFamily: FONT,
    backgroundColor: C.white,
  },
  coverPage: {
    padding: 0,
    fontFamily: FONT,
    backgroundColor: C.white,
  },

  headerBar: {
    position: "absolute", top: 0, left: 0, right: 0, height: 34,
    paddingHorizontal: PAGE_PAD, paddingTop: 10,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    // 1px to match the footer's borderTopWidth exactly — was 1.2 (heavier
    // than the footer rule, which read as visually mismatched weight).
    borderBottomWidth: 1, borderBottomColor: C.lineDark,
  },
  brand: { fontSize: 10, fontFamily: FONT_BOLD, color: C.ink, letterSpacing: 0.6 },
  brandSub: { fontSize: 6.3, fontFamily: FONT_BOLD, color: C.mute, letterSpacing: 1.6, marginTop: 1 },
  footer: {
    position: "absolute", left: PAGE_PAD, right: PAGE_PAD, bottom: 20,
    borderTopWidth: 1, borderTopColor: C.lineStrong, paddingTop: 7,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  footerLeft: { flexDirection: "row", alignItems: "center", gap: 5 },
  footerText: { color: C.mute, fontSize: 6.6 },

  eyebrow: { fontSize: 7.2, color: C.accent, fontFamily: FONT_BOLD, letterSpacing: 2.4 },
  title: { fontSize: 17, fontFamily: FONT_BOLD, color: C.ink },
  subtitle: { fontSize: 10.5, fontFamily: FONT_BOLD, color: C.ink2, marginTop: 1 },
  sectionTitle: {
    fontSize: 9.5, fontFamily: FONT_BOLD, color: C.ink,
    textTransform: "uppercase", letterSpacing: 1.4,
    marginTop: 20, marginBottom: 9,
    borderLeftWidth: 2.5, borderLeftColor: C.lineDark, paddingLeft: 8,
  },
  sectionSub: { fontSize: 8, color: C.mute, marginTop: -6, marginBottom: 10, paddingLeft: 11 },

  row: { flexDirection: "row" },

  hero: {
    borderWidth: 1.2, borderColor: C.lineDark,
    backgroundColor: C.soft, padding: 14,
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    marginBottom: 14,
  },
  metaLine: { fontSize: 12.5, color: C.mute, marginTop: 7.5 },
  metaStrong: { fontFamily: FONT_BOLD, color: C.ink2 },

  badgePill: {
    flexDirection: "row", alignItems: "center", alignSelf: "flex-start",
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1.2, marginBottom: 6,
  },
  badgeDot: { width: 5, height: 5, marginRight: 5 },
  badgePillText: { fontSize: 7.6, fontFamily: FONT_BOLD, letterSpacing: 0.8 },

  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  kpiCard: {
    width: "31.8%",
    borderWidth: 1.5, borderColor: C.lineDark, borderTopWidth: 2.5,
    backgroundColor: C.white, paddingVertical: 10, paddingHorizontal: 11,
    marginBottom: 8,
  },
  kpiLabel: {
    fontSize: 6.6, fontFamily: FONT_BOLD, color: C.mute,
    textTransform: "uppercase", letterSpacing: 1, marginBottom: 5,
  },
  kpiValueRow: { flexDirection: "row", alignItems: "flex-end" },
  kpiValue: { fontSize: 19, fontFamily: FONT_BOLD, color: C.ink },
  kpiUnit: { fontSize: 8, fontFamily: FONT_BOLD, color: C.mute, marginLeft: 3, marginBottom: 2 },

  card: { borderWidth: 1.2, borderColor: C.lineDark, backgroundColor: C.white },
  cardPad: { padding: 12 },

  dataRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 6, paddingHorizontal: 11,
    borderBottomWidth: 0.75, borderBottomColor: C.lineStrong,
  },
  dataRowLast: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 6, paddingHorizontal: 11,
  },
  dataRowZebra: { backgroundColor: C.soft },
  dataLabel: { flex: 1.35, fontSize: 8.4, color: C.mute },
  dataValueWrap: { flex: 1, flexDirection: "row", justifyContent: "flex-end", alignItems: "center" },
  dataValue: { fontSize: 9, fontFamily: FONT_BOLD, color: C.ink, textAlign: "right" },

  legendRow: { flexDirection: "row", alignItems: "center", gap: 4 },

  conclusionBox: {
    borderWidth: 1.2, borderColor: C.lineDark, borderLeftWidth: 3,
    padding: 13, backgroundColor: C.soft,
  },
  conclusionText: { fontSize: 12, color: C.ink2, lineHeight: 1.55 },

  statCard: {
    flex: 1, borderWidth: 1.2, borderColor: C.lineDark,
    backgroundColor: C.white, paddingVertical: 8, paddingHorizontal: 10,
  },
  statLabel: { fontSize: 6.4, fontFamily: FONT_BOLD, color: C.mute, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 },
  statValue: { fontSize: 13, fontFamily: FONT_BOLD, color: C.ink },

  signBox: {
    flex: 1, borderWidth: 1.2, borderColor: C.lineDark,
    padding: 12, minHeight: 115,
  },
  signRole: { fontSize: 7.4, fontFamily: FONT_BOLD, color: C.ink2, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 },
  signLine: { borderBottomWidth: 1, borderBottomColor: C.lineDark, marginBottom: 4 },
  signMeta: { fontSize: 6.6, color: C.muteLight, textTransform: "uppercase", letterSpacing: 0.8 },

  /* Cover-page info table — a bigger, bolder tabular block for the
     Serial Number / Work Order / Reactor Name / etc. group, distinct
     from the compact DataCard used elsewhere in the report. */
  coverInfoCard: {
    borderWidth: 1.4, borderColor: C.lineDark, backgroundColor: C.white,
  },
  coverInfoRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 9, paddingHorizontal: 14,
    borderBottomWidth: 0.75, borderBottomColor: C.lineStrong,
  },
  coverInfoRowLast: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 9, paddingHorizontal: 14,
  },
  coverInfoRowZebra: { backgroundColor: C.soft },
  coverInfoLabel: {
    flex: 1, fontSize: 9, fontFamily: FONT_BOLD, color: C.mute,
    textTransform: "uppercase", letterSpacing: 0.8,
  },
  coverInfoValue: { flex: 1.3, fontSize: 11.5, fontFamily: FONT_BOLD, color: C.ink, textAlign: "right" },
});

/* ============================== HELPERS ============================== */

function fmt(n?: number, decimals = 3): string {
  if (n === undefined || n === null || Number.isNaN(n) || n === 0) return "\u2014";
  return n.toFixed(decimals);
}
function fmtInt(n?: number): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "\u2014";
  return String(n);
}
function fmtEngineering(n: number | undefined, unit: string, decimals = 2): string {
  if (n === undefined || n === null || Number.isNaN(n) || n === 0) return "\u2014";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(decimals)} M${unit}`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(decimals)} k${unit}`;
  return `${n.toFixed(decimals)} ${unit}`;
}

/** Units that have a real symbol get substituted here. Only "C" -> "°C"
 *  is safe to substitute: the degree sign (U+00B0) is part of the
 *  WinAnsiEncoding that react-pdf's built-in "Helvetica" font uses, so it
 *  always renders correctly. The Ohm symbol (Greek Omega, U+03A9) is NOT
 *  in that encoding — printing it with the built-in font silently
 *  produces a blank/wrong glyph. Rendering Ω correctly would require
 *  Font.register()-ing a Unicode TTF (e.g. from Google Fonts) instead of
 *  relying on the base14 Helvetica, which isn't done here to avoid a new
 *  network/font dependency — so Ohm stays spelled out as text. */
const UNIT_SYMBOLS: Record<string, string> = {
  C: "\u00B0C", // °C
};
function unitSymbol(unit: string): string {
  return UNIT_SYMBOLS[unit] ?? unit;
}

/** Formats "<number> <unit>" — no parentheses, unit substituted with its
 *  symbol where one exists (see UNIT_SYMBOLS). Used so the unit lives in
 *  the value column instead of being appended to the row label. */
function fmtWithUnit(n: number | undefined, unit: string, decimals = 3): string {
  const num = fmt(n, decimals);
  if (num === "\u2014") return num;
  return `${num} ${unitSymbol(unit)}`;
}
function formatNum(n: number) {
  return n.toLocaleString();
}

/**
 * Renders "I" followed by "dc" at ~62% font size — the fake-subscript
 * trick used throughout this file to match the I_dc notation from the
 * reference Excel sheet. Always place this INSIDE an existing <Text>;
 * it returns a fragment (no wrapping <Text>/color of its own), so it
 * inherits color/fontFamily from whatever <Text> it sits inside. Pass
 * fontSize equal to the surrounding text's fontSize so the subscript
 * scales correctly wherever it's used (KPI labels, conclusion prose,
 * nameplate rows, etc).
 */
function Idc({ fontSize }: { fontSize: number }) {
  return (
    <>
      I<Text style={{ fontSize: fontSize * 0.62 }}>dc</Text>
    </>
  );
}

interface Row { label: string; value: string; }

function DataRow({ row, index, last }: { row: Row; index: number; last?: boolean }) {
  const zebra = index % 2 === 1 ? s.dataRowZebra : {};
  return (
    <View style={[last ? s.dataRowLast : s.dataRow, zebra]}>
      <Text style={s.dataLabel}>{row.label}</Text>
      <View style={s.dataValueWrap}>
        <Text style={s.dataValue}>{row.value}</Text>
      </View>
    </View>
  );
}

function DataCard({ rows }: { rows: Row[] }) {
  return (
    <View style={s.card}>
      {rows.map((r, i) => (
        <DataRow key={i} row={r} index={i} last={i === rows.length - 1} />
      ))}
    </View>
  );
}

/** Bigger, bolder tabular block used only on the cover page for the
 *  Serial Number / Work Order / Reactor Name / etc. group. */
function CoverInfoRow({ row, index, last }: { row: Row; index: number; last?: boolean }) {
  const zebra = index % 2 === 1 ? s.coverInfoRowZebra : {};
  return (
    <View style={[last ? s.coverInfoRowLast : s.coverInfoRow, zebra]}>
      <Text style={s.coverInfoLabel}>{row.label}</Text>
      <Text style={s.coverInfoValue}>{row.value}</Text>
    </View>
  );
}

function CoverInfoCard({ rows }: { rows: Row[] }) {
  return (
    <View style={s.coverInfoCard}>
      {rows.map((r, i) => (
        <CoverInfoRow key={i} row={r} index={i} last={i === rows.length - 1} />
      ))}
    </View>
  );
}

function SectionTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <>
      <Text style={s.sectionTitle}>{children}</Text>
      {sub && <Text style={s.sectionSub}>{sub}</Text>}
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[s.statCard, { borderTopWidth: 2.5, borderTopColor: color }]}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}

function KpiCard({ label, value, unit, accent, style }: { label: ReactNode; value: string; unit?: string; accent: string; style?: object }) {
  return (
    <View style={[s.kpiCard, { borderTopColor: accent }, style]}>
      <Text style={s.kpiLabel}>{label}</Text>
      <View style={s.kpiValueRow}>
        <Text style={s.kpiValue}>{value}</Text>
        {unit && <Text style={s.kpiUnit}>{unit}</Text>}
      </View>
    </View>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: "success" | "danger" | "neutral" }) {
  const bg = tone === "success" ? C.successSoft : tone === "danger" ? C.dangerSoft : C.soft2;
  const fg = tone === "success" ? C.success : tone === "danger" ? C.danger : C.ink2;
  return (
    <View style={[s.badgePill, { backgroundColor: bg, borderColor: fg }]}>
      <View style={[s.badgeDot, { backgroundColor: fg }]} />
      <Text style={[s.badgePillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

/** If SHOW_LOGO is off, renders nothing instead of a broken/blank image box. */
function Logo({ width = 20, height = 10 }: { width?: number; height?: number }) {
  if (!SHOW_LOGO) return null;
  return <Image src={LOGO_SRC} style={{ width, height, objectFit: "contain" }} />;
}

/* ============================== COMPUTED FIELDS ============================== */

interface ComputedFields {
  timeConstant: number;
  timeToSteadyState: number;
  ultimateDcVoltage: number;
  peakDc: { timeSec: number; voltage: number };
}

function computeReportFields(object: TestObject, report: TestReport): ComputedFields {
  const timeConstant = computeTimeConstant(object.inductance ?? 0, object.resAt20DegC ?? 0);

  const testPoints = report.analysisResult.length ? report.analysisResult : report.rawResult;
  const peakDc = computePeakDcPoint(testPoints);

  // Needed for the Option 1 ("locked tau") versions below — same pipeline
  // the 4-graph page runs, so breakPoint here is identical to the "Break"
  // dot shown on the raw waveform chart.
  const analyzed = createAnalyzedSample(testPoints, object.resAtRefTemp ?? object.resAt20DegC ?? 0);
  const breakPoint = analyzed.breakPoint;

  // ── TIME TO STEADY STATE ──────────────────────────────────────────
  // OPTION 1 (original) — timestamp of the first locked tau ("Break" point).
  const timeToSteadyState = breakPoint ? breakPoint.timestamp / 1000 : 0;

  // OPTION 2 (current, active) — 5 x tau (standard RL settling rule).
  // const timeToSteadyState = computeTimeToSteadyState(timeConstant);

  // ── ULTIMATE DC VOLTAGE AT STEADY STATE ───────────────────────────
  // OPTION 1 (original) — actual recorded voltage at the locked-tau timestamp.
  const ultimateDcVoltage = breakPoint
    ? computeVoltageAtTimestamp(testPoints, breakPoint.timestamp)
    : 0;

  // OPTION 2 (current, active) — calculated via formula.
  // const ultimateDcVoltage = computeUltimateDcVoltage(
  //   object.resIncreaseByLeadsPu ?? 0,
  //   object.idcForLinearityTest ?? 0,
  //   object.resAtRefTemp ?? 0,
  // );

  return { timeConstant, timeToSteadyState, ultimateDcVoltage, peakDc };
}

/**
 * Decay duration = total recorded test duration minus the time it took to
 * reach the peak / Idc point. i.e. everything that happens AFTER the
 * current peaks and starts decaying back down.
 */
function computeDecayDuration(report: TestReport, calc: ComputedFields): number {
  return Math.max(report.durationS - calc.peakDc.timeSec, 0);
}

/** Linear-interpolation lookup for the current value at a given timestamp
 *  (ms) within a RawPoint[] series — same technique as
 *  computeVoltageAtTimestamp() in reactorCalcs.ts, but for current, since
 *  no equivalent helper exists there yet. Used to find the current level
 *  for the "Steady State" horizontal reference line (see ChartCard). */
function findCurrentAtTimestamp(points: RawPoint[], timestampMs: number): number | null {
  if (!points.length) return null;
  if (timestampMs <= points[0].timestamp) return points[0].current;
  for (let i = 1; i < points.length; i++) {
    if (points[i].timestamp >= timestampMs) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const span = p1.timestamp - p0.timestamp || 1;
      const frac = (timestampMs - p0.timestamp) / span;
      return p0.current + (p1.current - p0.current) * frac;
    }
  }
  return points[points.length - 1].current;
}

/**
 * Returns the conclusion paragraph as a ReactNode instead of a plain
 * string so the "Idc" inside it can render with the subscript styling
 * (see <Idc />). Both branches contain exactly one "Idc" mention, so the
 * sentence is split into: text-before + <Idc /> + text-after.
 */
function buildConclusion(object: TestObject, report: TestReport, calc: ComputedFields): ReactNode {
  const passed = report.status === "passed";
  const idc = object.idcForLinearityTest ?? 0;
  const pctOfIdc = idc > 0 ? (report.peakCurrent / idc) * 100 : 0;

  if (passed) {
    return (
      <>
        {`The unit under test achieved a peak current of ${report.peakCurrent.toFixed(2)} A, ` +
          `${pctOfIdc ? pctOfIdc.toFixed(1) : "\u2014"}% of the computed `}
        <Idc fontSize={12} />
        {` target of ${fmt(idc, 2)} A ` +
          `(PU Linearity ${(object.puLinearity ?? PU_LINEARITY)}\u00d7 rated current). The recorded curve reached its peak at ` +
          `${calc.peakDc.timeSec.toFixed(2)} sec with an applied DC voltage of ${calc.peakDc.voltage.toFixed(1)} V, ` +
          `against a computed time constant (tau) of ${calc.timeConstant.toFixed(3)} sec and an ultimate DC voltage ` +
          `of ${fmt(calc.ultimateDcVoltage, 1)} V. Based on these results, ${object.serialNumber} is assessed as ` +
          `PASSED for linearity per IEC 60076-6.`}
      </>
    );
  }
  return (
    <>
      {`The unit under test recorded a peak current of ${report.peakCurrent.toFixed(2)} A against a computed `}
      <Idc fontSize={12} />
      {` target of ${fmt(idc, 2)} A. This test run has been marked FAILED. Review the recorded current-rise curve ` +
        `against the computed reference parameters (tau = ${calc.timeConstant.toFixed(3)} sec, ultimate DC voltage ` +
        `= ${fmt(calc.ultimateDcVoltage, 1)} V) before scheduling a re-test.`}
    </>
  );
}

/* ============================== NAMEPLATE ROWS ============================== */

/**
 * Units live in the VALUE column ("171.830 A") instead of being
 * appended to the label, and without parentheses. Ohm/Celsius print
 * with their real symbol (Ω / °C) via fmtWithUnit -> unitSymbol().
 */
function buildNameplateRows(object: TestObject, calc: ComputedFields): Row[] {
  const unitLabel = object.ratedPowerUnit === "MVAR" ? "MVAr" : object.ratedPowerUnit ?? "";
  return [
    { label: "Serial Number", value: object.serialNumber || "\u2014" },
    { label: "Work Order", value: object.workOrder || "\u2014" },
    {
      label: "Rated Power",
      value: object.ratedPowerValue ? `${fmt(object.ratedPowerValue, 2)} ${unitLabel}` : "\u2014",
    },
    { label: "Rated Voltage (Nameplate)", value: fmtEngineering(object.ratedVoltageNameplate, "V") },
    { label: "No. of Phases", value: fmtInt(object.phases) },
    { label: "Frequency", value: fmtWithUnit(object.frequency, "Hz", 1) },
    { label: "Rated AC RMS Current", value: fmtWithUnit(object.ratedAcRmsCurrent, "A") },
    { label: "Inductance", value: fmtWithUnit(object.inductance, "H", 4) },
    { label: "Resistance/Phase at Ref Temp", value: fmtWithUnit(object.resAtRefTemp, "Ohm") },
    { label: "Reference Temp for Resistance", value: fmtWithUnit(object.refTempForRes, "C", 1) },
    { label: "Resistance/Phase at 20C", value: fmtWithUnit(object.resAt20DegC, "Ohm") },
    { label: "Resistance Increase by Leads", value: fmtWithUnit(object.resIncreaseByLeadsPu, "PU", 4) },
  ];
}

/* ============================== COVER PAGE ============================== */
/**
 * Header content order (per spec): Logo -> Company name -> tabular info
 * block (Serial Number, Work Order, Reactor Name, Project, Customer,
 * Test Engineer, Test Date, Report Generated). The Test Conclusion
 * lives at the bottom of this page. The PASSED/FAILED status pill that
 * used to sit right under the title has been removed — the conclusion
 * paragraph already states pass/fail in prose, so the pill was
 * redundant per spec.
 */
function CoverPage({
  object, report, calc, conclusion, generated, completed, hasRaw, signOff,
}: {
  object: TestObject; report: TestReport; calc: ComputedFields; conclusion: ReactNode;
  generated: string; completed: string; hasRaw: boolean; signOff: SignOffData;
}) {
  const passed = report.status === "passed";
  const statusColor = passed ? C.success : C.danger;

  const infoRows: Row[] = [
    { label: "Serial Number", value: object.serialNumber || "\u2014" },
    { label: "Work Order", value: object.workOrder || "\u2014" },
    { label: "Reactor Name", value: object.name || "Reactor Unit" },
    { label: "Project", value: object.projectName || "\u2014" },
    { label: "Customer", value: object.customerName || "\u2014" },
    { label: "Test Engineer", value: signOff.testedBy.name || "\u2014" },
    { label: "Test Date", value: completed },
    { label: "Report Generated", value: generated },
  ];

  return (
    <Page size="A4" style={s.coverPage}>
      <View style={{ height: 3, backgroundColor: C.accent }} />

      <View style={{ paddingHorizontal: 44, paddingTop: 40, paddingBottom: 26, borderBottomWidth: 1.2, borderBottomColor: C.lineDark }}>
        {/* 1. Logo */}
        {SHOW_LOGO && (
          <View style={{ marginBottom: 14 }}>
            <Logo width={150} height={72} />
          </View>
        )}

        {/* 2. Company name */}
        <Text style={{ fontSize: 19, fontFamily: FONT_BOLD, color: C.ink, letterSpacing: 0.6, marginBottom: 14 }}>
          ATLANTA ELECTRONICS
        </Text>

        {/* 3. Tabular info block — replaces the old plain-text meta lines. */}
        <View style={{ marginBottom: 16 }}>
          <CoverInfoCard rows={infoRows} />
        </View>

        <Text style={{ color: C.accent, fontSize: 14, fontFamily: FONT_BOLD, letterSpacing: 2, marginBottom: 4, marginTop: 10 }}>
          REACTOR LINEARITY TEST REPORT
        </Text>
        {/* Status pill intentionally removed here — see comment above. */}
      </View>

      <View style={{ paddingHorizontal: 44, paddingTop: 24, flex: 1 }}>
        {object.notes && (
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 7.2, fontFamily: FONT_BOLD, color: C.mute, letterSpacing: 1.6, marginBottom: 8 }}>
              NOTES
            </Text>
            <View style={[s.card, s.cardPad]}>
              <Text style={{ fontSize: 9, color: C.ink2, lineHeight: 1.5 }}>{object.notes}</Text>
            </View>
          </View>
        )}

        <Text style={{ fontSize: 12, fontFamily: FONT_BOLD, color: C.mute, letterSpacing: 1.6, marginBottom: 8 }}>
          TEST OVERVIEW
        </Text>
        <View style={[s.conclusionBox, { borderLeftColor: statusColor }]}>
          <Text style={s.conclusionText}>{conclusion}</Text>
        </View>
      </View>

      <View style={{ borderTopWidth: 1.2, borderTopColor: C.lineDark, paddingHorizontal: 44, paddingVertical: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 6.6, color: C.mute, opacity: 0.6 }}>
          System generated report using ReactorX by Electrosoft Automation Pvt.Ltd.
        </Text>
        <Text style={{ fontSize: 7.3, color: C.mute }}>
          Generated {generated} &middot; ID {object.id.slice(0, 8).toUpperCase()}
        </Text>
      </View>
    </Page>
  );
}

/* ============================== NAMEPLATE + KEY METRICS PAGE ============================== */
/**
 * Reactor Nameplate & Linearity Data (raw nameplate inputs) now renders
 * ABOVE Key Metrics (values derived from the graph/analysis pipeline)
 * on this shared page — order swapped per spec. Any value that appears
 * in Key Metrics is intentionally NOT repeated in the nameplate table
 * above — see buildNameplateRows().
 */
function KeyMetricsAndNameplatePage({
  object, report, calc, generated, npLeft, npRight,
}: {
  object: TestObject; report: TestReport; calc: ComputedFields; generated: string;
  npLeft: Row[]; npRight: Row[];
}) {
  const decayDuration = computeDecayDuration(report, calc);

  return (
    <Page size="A4" style={s.page} wrap>
      <Header />
      <Footer generated={generated} object={object} />

      <SectionTitle >
        Reactor Technical Specification &amp; Linearity Data
      </SectionTitle>
      <View style={[s.row, { gap: 10 }]} wrap={false}>
        <View style={{ flex: 1 }}>
          <DataCard rows={npLeft} />
        </View>
        <View style={{ flex: 1 }}>
          <DataCard rows={npRight} />
        </View>
      </View>

      <SectionTitle >
        Key Metrics
      </SectionTitle>

      <View style={s.kpiGrid}>
        <KpiCard label={<>Actual <Idc fontSize={6.6} /></>} value={report.peakCurrent.toFixed(2)} unit="A" accent={C.accent} />
        <KpiCard label={<>Target <Idc fontSize={6.6} /></>} value={fmt(object.idcForLinearityTest, 2)} unit="A" accent={C.accent} />
        <KpiCard label="Total Test Duration" value={report.durationS.toFixed(2)} unit="s" accent={C.accent} />

        <KpiCard label={<>Time to Reach Actual<Idc fontSize={6.6} /></>} value={calc.peakDc.timeSec.toFixed(2)} unit="s" accent={C.ink2} />
        <KpiCard label={<>DC Voltage at Peak<Idc fontSize={6.6} /></>} value={calc.peakDc.voltage.toFixed(1)} unit="V" accent={C.ink2} />
        <KpiCard label="Decay Duration" value={decayDuration.toFixed(2)} unit="s" accent={C.ink2} />

        <KpiCard label="Time Constant (tau)" value={calc.timeConstant.toFixed(3)} unit="s" accent={C.ink2} />
        <KpiCard label="Time to Steady State" value={calc.timeToSteadyState.toFixed(2)} unit="s" accent={C.ink2} />
        <KpiCard label="Ultimate DC Voltage at TAU" value={fmt(calc.ultimateDcVoltage, 1)} unit="V" accent={C.ink2} />
      </View>
    </Page>
  );
}

/* ============================== DOCUMENT ============================== */

function ReportDocument({
  object, report, signOff, options,
}: {
  object: TestObject; report: TestReport; signOff: SignOffData; options: ReportOptions;
}) {
  const generated = new Date().toLocaleString();
  const completed = new Date(report.completedAt).toLocaleString();
  const hasRaw = report.rawResult.length > 0;
  const graphPoints = report.analysisResult.length ? report.analysisResult : report.rawResult;

  const calc = computeReportFields(object, report);
  const conclusion = buildConclusion(object, report, calc);

  // "Steady State" line — a HORIZONTAL reference line at the current
  // level reached at calc.timeToSteadyState (matches the threshold-line
  // style already used elsewhere in the app; NOT a vertical time marker).
  // Looked up from the actual recorded/analyzed points, not assumed to
  // equal the Break point's current, so this stays correct even if
  // computeReportFields() is later switched to the Option 2 (5*tau)
  // formula for timeToSteadyState.
  const steadyStateTimestampMs = calc.timeToSteadyState * 1000;
  const steadyStateCurrent =
    calc.timeToSteadyState > 0 ? findCurrentAtTimestamp(graphPoints, steadyStateTimestampMs) : null;

  const decayDuration = computeDecayDuration(report, calc);
  const npRows = buildNameplateRows(object, calc);
  const npHalf = Math.ceil(npRows.length / 2);
  const npLeft = npRows.slice(0, npHalf);
  const npRight = npRows.slice(npHalf);
  // Pad the shorter column with blank rows so both nameplate cards render
  // at the same height (odd row counts would otherwise leave one card
  // visibly shorter than the other).
  while (npRight.length < npLeft.length) {
    npRight.push({ label: "", value: "" });
  }

  return (
    <Document title={`Reactor Test Report - ${object.serialNumber}`} author="Electrosoft Automation">
      <CoverPage
        object={object} report={report} calc={calc} conclusion={conclusion}
        generated={generated} completed={completed} hasRaw={hasRaw} signOff={signOff}
      />

      <KeyMetricsAndNameplatePage
        object={object} report={report} calc={calc} generated={generated}
        npLeft={npLeft} npRight={npRight}
      />

      <Page size="A4" style={s.page} wrap>
        <Header />
        <Footer generated={generated} object={object} />

        <SectionTitle>Recorded Linearity Curves</SectionTitle>

        <StackedGraphs
          points={graphPoints}
          peak={report.peakCurrent}
          resistance={object.resAtRefTemp ?? object.resAt20DegC}
          inductance={object.inductance}
          ratedAcRmsCurrent={object.ratedAcRmsCurrent}
          options={options}
          steadyStateCurrent={steadyStateCurrent}
        />

        <SectionTitle >
          Approval &amp; Sign-Off
        </SectionTitle>
        <View style={[s.row, { gap: 10 }]} wrap={false}>
          <SignOffBlock role="Tested By" info={signOff.testedBy} />
          <SignOffBlock role="Verified By" info={signOff.verifiedBy} />
          <SignOffBlock role="Approved By" info={signOff.approvedBy} />
        </View>
      </Page>

      {hasRaw && (
        <Page size="A4" style={s.page} wrap>
          <Header />
          <Footer generated={generated} object={object} />

          <SectionTitle>Raw Acquisition Data</SectionTitle>
          <Text style={{ fontSize: 8, color: C.mute, marginTop: -6, marginBottom: 10 }}>
            {formatNum(report.rawResult.length)} samples recorded &middot; downsampled for plot below.
          </Text>

          <ChartCard
            points={report.rawResult}
            peak={report.peakCurrent}
            height={250}
            scale="linear"
          />

          <SectionTitle>Analysis Sample (first 30 of {report.analysisResult.length})</SectionTitle>
          <SampleTable points={report.analysisResult.slice(0, 30)} />
        </Page>
      )}
    </Document>
  );
}

/* ============================== HEADER / FOOTER / SIGN-OFF ============================== */

function Header() {
  return (
    <View style={s.headerBar} fixed>
      <View>
        <Text style={s.brand}>REACTOR LINEARITY TEST REPORT</Text>
      </View>
    </View>
  );
}

/**
 * Plain text credit line, no logo — the logo only appears on the cover
 * page. The serial-number / timestamp line has been removed per spec;
 * only the module credit and page number remain.
 */
function Footer({ generated, object }: { generated: string; object: TestObject }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>System generated report using ReactorX by Electrosoft Automation Pvt.Ltd.</Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
    </View>
  );
}

/**
 * Prints "<Designation> : <Name>" for the role (Date has been removed
 * entirely per spec) — a single colon with a space on each side, e.g.
 * "Test Engineer : Arbaaz Shaikh" (previously "  :-  "). Followed by a
 * blank Signature line that always prints regardless of whether a name
 * was entered — the typed name does not replace the need for a physical
 * signature after printing.
 */
function SignOffBlock({ role, info }: { role: string; info: SignOffInfo }) {
  const hasDesignation = !!info.designation && info.designation.trim().length > 0;
  const hasName = !!info.name && info.name.trim().length > 0;

  return (
    <View style={s.signBox}>
      <Text style={s.signRole}>{role}</Text>

      <Text style={{ fontSize: 8.2, color: C.ink2 }}>
        <Text style={{ fontFamily: FONT_BOLD, color: C.ink }}>
          {hasDesignation ? info.designation : "Designation"}
        </Text>
        {" : "}
        {hasName ? info.name : ""}
      </Text>

      <View style={[s.signLine, { marginTop: 40, width: "80%" }]} />
      <Text style={s.signMeta}>Signature</Text>
    </View>
  );
}

/* ============================== SAMPLE TABLE ============================== */

function SampleTable({ points }: { points: RawPoint[] }) {
  return (
    <View style={{ borderWidth: 1.2, borderColor: C.lineDark, overflow: "hidden" }}>
      <View style={[s.row, { backgroundColor: C.soft2, paddingVertical: 7, paddingHorizontal: 10, borderBottomWidth: 1.2, borderBottomColor: C.lineDark }]}>
        <Text style={{ flex: 1, fontFamily: FONT_BOLD, color: C.ink2, fontSize: 7.3, letterSpacing: 0.5 }}>TIME (ms)</Text>
        <Text style={{ flex: 1, fontFamily: FONT_BOLD, color: C.ink2, fontSize: 7.3, letterSpacing: 0.5 }}>VOLTAGE (V)</Text>
        <Text style={{ flex: 1, fontFamily: FONT_BOLD, color: C.ink2, fontSize: 7.3, letterSpacing: 0.5 }}>CURRENT (A)</Text>
        <Text style={{ flex: 1, fontFamily: FONT_BOLD, color: C.ink2, fontSize: 7.3, letterSpacing: 0.5 }}>PHASE (rad)</Text>
      </View>
      {points.map((p, i) => (
        <View
          key={i}
          style={[s.row, { paddingVertical: 4.8, paddingHorizontal: 10, backgroundColor: i % 2 ? C.soft : C.white }]}
        >
          <Text style={{ flex: 1, fontSize: 8, color: C.ink2 }}>{p.timestamp.toFixed(2)}</Text>
          <Text style={{ flex: 1, fontSize: 8, color: C.ink2 }}>{p.voltage.toFixed(2)}</Text>
          <Text style={{ flex: 1, fontSize: 8, color: C.ink2 }}>{p.current.toFixed(3)}</Text>
          <Text style={{ flex: 1, fontSize: 8, color: C.ink2 }}>{p.phase.toFixed(3)}</Text>
        </View>
      ))}
    </View>
  );
}

/* ============================== CHARTS ============================== */

const CHART_W = 515;
// Trimmed from { l:48, r:24, t:16, b:30 } — was leaving noticeable dead
// space at the top/bottom of every GraphCard box.
const PAD = { l: 48, r: 24, t: 13, b: 24 };

function downsampleRaw<T extends { timestamp: number }>(points: T[], target = 600): T[] {
  if (points.length <= target) return points;
  const stride = Math.max(1, Math.ceil(points.length / target));
  const out: T[] = [];
  for (let i = 0; i < points.length; i += stride) out.push(points[i]);
  if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1]);
  return out;
}

interface BreakMarker { timestamp: number; current: number; }

function GraphCard({
  title, subtitle, children, accent = C.lineDark,
}: { title: string; subtitle?: string; children: ReactNode; accent?: string }) {
  return (
    // Box shrunk (padding 12->9, marginBottom 14->9) — was leaving each
    // graph noticeably taller than it needed to be, which was both the
    // "unnecessarily big box" complaint and the reason 2-graph reports
    // pushed Approval & Sign-Off onto the next page. A colored top
    // border (matching each chart's line color) replaces the plain grey
    // one for a bit more visual polish.
    <View style={[s.card, { padding: 9, marginBottom: 9, borderTopWidth: 2.5, borderTopColor: accent }]} wrap={false}>
      <Text style={{ fontSize: 8, fontFamily: FONT_BOLD, color: C.ink, letterSpacing: 0.3, marginBottom: subtitle ? 2 : 6 }}>
        {title}
      </Text>
      {subtitle && (
        <Text style={{ fontSize: 6.6, color: C.mute, marginBottom: 6, fontFamily: FONT_OBLIQUE }}>
          {subtitle}
        </Text>
      )}
      {children}
    </View>
  );
}

/** Raw current-vs-time chart (linear or log Y). Optionally overlays:
 *   - the "Break" marker at the point tauCalculation.ts flagged noise
 *     (dot + "Break" label), controlled by the `breakPoint` prop.
 *   - a dashed HORIZONTAL "Steady State" reference line at the current
 *     level given by `steadyStateCurrent`, controlled independently —
 *     matches the style of the threshold line already used in the app,
 *     not a vertical time marker. */
function ChartCard({
  points, peak, height = 220, scale = "linear", breakPoint, steadyStateCurrent,
}: {
  points: RawPoint[]; peak: number; height?: number;
  scale?: "linear" | "log"; breakPoint?: BreakMarker | null;
  steadyStateCurrent?: number | null;
}) {
  const CHART_H = height;

  if (points.length < 2) {
    return (
      <View style={{ height: CHART_H, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: C.mute, fontSize: 9 }}>No data captured yet.</Text>
      </View>
    );
  }

  const slim = downsampleRaw(points, 600);

  const tMin = slim[0].timestamp || 0;
  const tMax = slim[slim.length - 1].timestamp || 1;
  const recordedMax = Math.max(...slim.map((p) => p.current), 0.01);

  const innerW = CHART_W - PAD.l - PAD.r;
  const innerH = CHART_H - PAD.t - PAD.b;
  const sx = (t: number) => PAD.l + ((t - tMin) / (tMax - tMin || 1)) * innerW;

  let syI: (i: number) => number;
  let yTicks: number[];
  let iMax: number;

  if (scale === "log") {
    const floor = 1;
    iMax = Math.max(recordedMax, peak, floor) * 1.3;
    const logMax = Math.log10(iMax);
    const logMin = Math.log10(floor);
    syI = (i: number) => {
      const v = Math.max(i, floor);
      const frac = (Math.log10(v) - logMin) / (logMax - logMin || 1);
      return PAD.t + innerH - frac * innerH;
    };
    yTicks = [];
    let t = floor;
    while (t <= iMax) { yTicks.push(t); t *= 10; }
  } else {
    iMax = recordedMax * 1.15;
    syI = (i: number) => PAD.t + innerH - (i / iMax) * innerH;
    yTicks = Array.from({ length: 6 }, (_, i) => (iMax * (5 - i)) / 5);
  }

  const clampY = (v: number) => (scale === "log" ? Math.max(v, 1) : v);
  const linePath = slim
    .map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.timestamp).toFixed(1)},${syI(clampY(p.current)).toFixed(1)}`)
    .join(" ");
  const areaPath =
    `M${sx(slim[0].timestamp).toFixed(1)},${(PAD.t + innerH).toFixed(1)} ` +
    slim.map((p) => `L${sx(p.timestamp).toFixed(1)},${syI(clampY(p.current)).toFixed(1)}`).join(" ") +
    ` L${sx(slim[slim.length - 1].timestamp).toFixed(1)},${(PAD.t + innerH).toFixed(1)} Z`;

  const xVals = Array.from({ length: 7 }, (_, i) => tMin + ((tMax - tMin) * i) / 6);
  const gradId = `fill-${scale}`;

  const breakVisible =
    !!breakPoint && breakPoint.timestamp >= tMin && breakPoint.timestamp <= tMax;
  const breakX = breakVisible ? sx(breakPoint!.timestamp) : 0;
  const breakY = breakVisible ? syI(clampY(breakPoint!.current)) : 0;

  const steadyVisible = steadyStateCurrent != null && Number.isFinite(steadyStateCurrent);
  const steadyYRaw = steadyVisible ? syI(clampY(steadyStateCurrent!)) : 0;
  // Clamp to the plot area — a steady-state current outside the visible
  // range (e.g. slightly above iMax's headroom) should still draw at the
  // edge rather than disappear or poke out of the chart box.
  const steadyY = Math.min(Math.max(steadyYRaw, PAD.t), PAD.t + innerH);

  return (
    <View>
      <Svg width={CHART_W} height={CHART_H}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.current} stopOpacity={0.3} />
            <Stop offset="1" stopColor={C.current} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>

        <Rect x={PAD.l} y={PAD.t} width={innerW} height={innerH} fill={C.soft} stroke={C.lineDark} strokeWidth={0.9} />

        {yTicks.map((_, i) => {
          const y = PAD.t + (innerH * i) / (yTicks.length - 1 || 1);
          return <Line key={`gy${i}`} x1={PAD.l} y1={y} x2={PAD.l + innerW} y2={y} stroke={C.line} strokeWidth={0.4} strokeDasharray="2,2" />;
        })}

        <Path d={areaPath} fill={`url(#${gradId})`} />
        <Path d={linePath} stroke={C.current} strokeWidth={1.6} fill="none" />

        {steadyVisible && (
          <Line
            x1={PAD.l} y1={steadyY} x2={PAD.l + innerW} y2={steadyY}
            stroke={C.success} strokeWidth={0.9} strokeDasharray="4,2"
          />
        )}

        {breakVisible && (
          <Circle cx={breakX} cy={breakY} r={2.6} fill={C.breakDot} stroke={C.white} strokeWidth={0.8} />
        )}

        <Line x1={PAD.l} y1={PAD.t + innerH} x2={PAD.l + innerW} y2={PAD.t + innerH} stroke={C.lineDark} strokeWidth={0.9} />
        <Line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + innerH} stroke={C.lineDark} strokeWidth={0.9} />
      </Svg>

      {yTicks.map((v, i) => {
        // Position each label using the SAME scale function (syI) that
        // plots the curve, instead of assuming uniform spacing by index.
        // For the log scale in particular, yTicks is built low-to-high
        // ([1, 10, 100, ...]) but the curve places low current values
        // near the bottom and high values near the top (see syI above)
        // — indexing top-to-bottom by array order (the old approach)
        // printed the axis labels in reverse order relative to the
        // plotted curve on export. syI(v) always matches the curve.
        const y = syI(v) - 3;
        return (
          <Text key={`yl${i}`} style={{ position: "absolute", left: 2, top: y + 8, fontSize: 6.2, color: C.current, width: PAD.l - 6, textAlign: "right" }}>
            {v >= 100 ? v.toFixed(0) : v.toFixed(scale === "log" ? 0 : 1)}
          </Text>
        );
      })}

      {xVals.map((v, i) => {
        const raw = sx(v) - 16;
        const x = Math.max(PAD.l - 6, Math.min(raw, PAD.l + innerW - 26));
        const align = i === 0 ? "left" : i === xVals.length - 1 ? "right" : "center";
        return (
          <Text key={`xl${i}`} style={{ position: "absolute", left: x, top: PAD.t + innerH + 14, fontSize: 6.2, color: C.mute, width: 32, textAlign: align }}>
            {v < 1000 ? `${v.toFixed(0)}ms` : `${(v / 1000).toFixed(1)}s`}
          </Text>
        );
      })}

      {breakVisible && (
        <Text style={{ position: "absolute", left: breakX - 12, top: breakY - 12, fontSize: 6.2, color: C.ink, fontFamily: FONT_BOLD }}>
          Break
        </Text>
      )}

      {steadyVisible && (
        <Text
          style={{
            position: "absolute",
            left: PAD.l + innerW - 70,
            top: steadyY - 8,
            width: 70,
            fontSize: 6.2, color: C.success, fontFamily: FONT_BOLD, textAlign: "right",
          }}
        >
          Steady State
        </Text>
      )}

      {/* {peak > 0 && (
        <Text style={{ position: "absolute", right: PAD.r + 2, top: PAD.t, fontSize: 6.4, color: C.accent, fontFamily: FONT_BOLD }}>
          Peak {peak.toFixed(2)} A
        </Text>
      )} */}
    </View>
  );
}

/** Flux vs Time — plots fluxData.new_timestamp vs fluxData.linked_flux
 *  exactly as returned by calculateFlux(), no recomputation. */
function FluxTimeChart({
  fluxData, height = 220,
}: { fluxData: { new_timestamp: number; linked_flux: number }[]; height?: number }) {
  const CHART_H = height;

  if (fluxData.length < 2) {
    return (
      <View style={{ height: CHART_H, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: C.mute, fontSize: 9 }}>No data captured yet.</Text>
      </View>
    );
  }

  const xVals = fluxData.map((p) => p.new_timestamp);
  const yVals = fluxData.map((p) => p.linked_flux);
  const xMin = Math.min(...xVals);
  const xMax = Math.max(...xVals) || 1;
  const yMax = Math.max(...yVals) * 1.1 || 1;

  const innerW = CHART_W - PAD.l - PAD.r;
  const innerH = CHART_H - PAD.t - PAD.b;
  const sx = (v: number) => PAD.l + ((v - xMin) / (xMax - xMin || 1)) * innerW;
  const sy = (v: number) => PAD.t + innerH - (v / yMax) * innerH;

  const path = fluxData
    .map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.new_timestamp).toFixed(1)},${sy(p.linked_flux).toFixed(1)}`)
    .join(" ");
  const areaPath =
    `M${sx(fluxData[0].new_timestamp).toFixed(1)},${(PAD.t + innerH).toFixed(1)} ` +
    fluxData.map((p) => `L${sx(p.new_timestamp).toFixed(1)},${sy(p.linked_flux).toFixed(1)}`).join(" ") +
    ` L${sx(fluxData[fluxData.length - 1].new_timestamp).toFixed(1)},${(PAD.t + innerH).toFixed(1)} Z`;

  const yTicks = Array.from({ length: 6 }, (_, i) => (yMax * (5 - i)) / 5);
  const xTicks = Array.from({ length: 7 }, (_, i) => xMin + ((xMax - xMin) * i) / 6);

  return (
    <View>
      <Svg width={CHART_W} height={CHART_H}>
        <Defs>
          <LinearGradient id="flux-fill-t" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.voltage} stopOpacity={0.28} />
            <Stop offset="1" stopColor={C.voltage} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>

        <Rect x={PAD.l} y={PAD.t} width={innerW} height={innerH} fill={C.soft} stroke={C.lineDark} strokeWidth={0.9} />

        {yTicks.map((_, i) => {
          const y = PAD.t + (innerH * i) / (yTicks.length - 1 || 1);
          return <Line key={`gy${i}`} x1={PAD.l} y1={y} x2={PAD.l + innerW} y2={y} stroke={C.line} strokeWidth={0.4} strokeDasharray="2,2" />;
        })}

        <Path d={areaPath} fill="url(#flux-fill-t)" />
        <Path d={path} stroke={C.voltage} strokeWidth={1.6} fill="none" />

        <Line x1={PAD.l} y1={PAD.t + innerH} x2={PAD.l + innerW} y2={PAD.t + innerH} stroke={C.lineDark} strokeWidth={0.9} />
        <Line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + innerH} stroke={C.lineDark} strokeWidth={0.9} />
      </Svg>

      {yTicks.map((v, i) => {
        const y = PAD.t + (innerH * i) / (yTicks.length - 1 || 1) - 3;
        return (
          <Text key={`yl${i}`} style={{ position: "absolute", left: 2, top: y + 8, fontSize: 6.2, color: C.voltage, width: PAD.l - 6, textAlign: "right" }}>
            {v.toFixed(v >= 10 ? 0 : 2)}
          </Text>
        );
      })}

      {xTicks.map((v, i) => {
        const raw = sx(v) - 16;
        const x = Math.max(PAD.l - 6, Math.min(raw, PAD.l + innerW - 26));
        const align = i === 0 ? "left" : i === xTicks.length - 1 ? "right" : "center";
        return (
          <Text key={`xl${i}`} style={{ position: "absolute", left: x, top: PAD.t + innerH + 14, fontSize: 6.2, color: C.mute, width: 32, textAlign: align }}>
            {v < 1000 ? `${v.toFixed(0)}ms` : `${(v / 1000).toFixed(1)}s`}
          </Text>
        );
      })}
    </View>
  );
}

/** Flux Curve (Linear) — per-unit magnetic characteristic, plots
 *  computeMagneticCharacteristicPu() output (CurrentPu, FluxPU) exactly
 *  as computed. Since this comes from the tau-locked decay-only window,
 *  current is already monotonic, so no binning/zigzag correction is
 *  needed for the curve itself — but the ARRAY ORDER follows the decay
 *  in time, i.e. index 0 = peak (highest current/flux), last index =
 *  near-zero (end of decay). That matters for the "t" arrow below.
 *
 *  Matches the IEC 60076-6 reference figure via a small arrow + italic
 *  "t" label. The arrow is anchored to whichever point has the MAX
 *  CurrentPu (found by VALUE, not array index — the decay ordering
 *  above means that isn't always puData[0] or puData[last]).
 *
 *  The tail offset is computed RELATIVE to the anchor and clamped to the
 *  space actually available above/left of it (not to a fixed absolute
 *  page coordinate). Clamping to a fixed coordinate is what caused the
 *  earlier bug: when the anchor point sat close to the top of the plot
 *  (a common case — the curve's highest point is only ~9% of innerH
 *  below PAD.t once the 1.1x headroom on yMax is accounted for), the old
 *  `Math.max(anchorY - 22, PAD.t + 12)` could clamp the tail to a Y
 *  BELOW the anchor, inverting the arrow, sending the arrowhead off in
 *  the wrong direction, and pushing the "t" label up into (or past) the
 *  "LINKED FLUX (p.u.)" corner caption above the chart. Deriving the
 *  offset from the anchor guarantees the tail is always strictly
 *  up-and-left of the anchor, however close the anchor sits to the edge. */
function FluxCurrentChart({
  puData, height = 220,
}: { puData: { CurrentPu: number; FluxPU: number }[]; height?: number }) {
  const CHART_H = height;

  if (puData.length < 2) {
    return (
      <View style={{ height: CHART_H, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: C.mute, fontSize: 9 }}>No data captured yet.</Text>
      </View>
    );
  }

  const xVals = puData.map((p) => p.CurrentPu);
  const yVals = puData.map((p) => p.FluxPU);
  const xMin = 0;
  const xMax = Math.max(...xVals) * 1.1 || 1;
  const yMax = Math.max(...yVals) * 1.1 || 1;

  // Extra bottom room for the "CURRENT (p.u.)" axis caption + extra top
  // room for the "LINKED FLUX (p.u.)" corner label, on top of the usual
  // PAD.t/PAD.b — this chart is drawn ~15px taller than the other three
  // (see the `height` passed to it in StackedGraphs) to fit both without
  // crowding the tick labels.
  const innerW = CHART_W - PAD.l - PAD.r;
  const innerH = CHART_H - PAD.t - PAD.b - 12;
  const sx = (v: number) => PAD.l + ((v - xMin) / (xMax - xMin || 1)) * innerW;
  const sy = (v: number) => PAD.t + innerH - (v / yMax) * innerH;

  const path = puData
    .map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.CurrentPu).toFixed(1)},${sy(p.FluxPU).toFixed(1)}`)
    .join(" ");
  const areaPath =
    `M${sx(puData[0].CurrentPu).toFixed(1)},${(PAD.t + innerH).toFixed(1)} ` +
    puData.map((p) => `L${sx(p.CurrentPu).toFixed(1)},${sy(p.FluxPU).toFixed(1)}`).join(" ") +
    ` L${sx(puData[puData.length - 1].CurrentPu).toFixed(1)},${(PAD.t + innerH).toFixed(1)} Z`;

  const yTicks = Array.from({ length: 6 }, (_, i) => (yMax * (5 - i)) / 5);
  const xTicks = Array.from({ length: 7 }, (_, i) => xMin + ((xMax - xMin) * i) / 6);

  // Anchor the arrow to the point with the highest CurrentPu, found by
  // VALUE — not puData[0] or puData[length-1], since the decay-ordered
  // array could put that point at either end depending on the run.
  const anchorPt = puData.reduce((max, p) => (p.CurrentPu > max.CurrentPu ? p : max), puData[0]);
  const anchorX = sx(anchorPt.CurrentPu);
  const anchorY = sy(anchorPt.FluxPU);

  // Desired tail offset (up-and-left of the anchor), shrunk to whatever
  // room is actually available before the plot's left/top edge instead
  // of being clamped to an absolute coordinate. This keeps the arrow
  // direction correct (tail always above-left of the anchor) no matter
  // how close the anchor sits to a corner.
  const DESIRED_OFFSET_X = 34;
  const DESIRED_OFFSET_Y = 22;
  const MIN_OFFSET = 6;
  const availableOffsetX = Math.max(anchorX - (PAD.l + 8), MIN_OFFSET);
  const availableOffsetY = Math.max(anchorY - (PAD.t + 16), MIN_OFFSET);
  const offsetX = Math.min(DESIRED_OFFSET_X, availableOffsetX);
  const offsetY = Math.min(DESIRED_OFFSET_Y, availableOffsetY);
  const arrowTailX = anchorX - offsetX;
  const arrowTailY = anchorY - offsetY;

  // Arrowhead ticks computed from the real tail->head direction vector
  // (rotated ±25°) instead of hardcoded signs, so they always point
  // backward along the line regardless of where the anchor lands.
  const dx = anchorX - arrowTailX;
  const dy = anchorY - arrowTailY;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const backX = -dx / len;
  const backY = -dy / len;
  const rotate = (vx: number, vy: number, deg: number) => {
    const a = (deg * Math.PI) / 180;
    return [vx * Math.cos(a) - vy * Math.sin(a), vx * Math.sin(a) + vy * Math.cos(a)];
  };
  const headLen = 5.5;
  const [t1x, t1y] = rotate(backX, backY, 24);
  const [t2x, t2y] = rotate(backX, backY, -24);
  const tick1 = `${(anchorX + t1x * headLen).toFixed(1)},${(anchorY + t1y * headLen).toFixed(1)}`;
  const tick2 = `${(anchorX + t2x * headLen).toFixed(1)},${(anchorY + t2y * headLen).toFixed(1)}`;

  return (
    <View>
      <Svg width={CHART_W} height={CHART_H}>
        <Defs>
          <LinearGradient id="flux-fill-i" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.voltage} stopOpacity={0.28} />
            <Stop offset="1" stopColor={C.voltage} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>

        <Rect x={PAD.l} y={PAD.t} width={innerW} height={innerH} fill={C.soft} stroke={C.lineDark} strokeWidth={0.9} />

        {yTicks.map((_, i) => {
          const y = PAD.t + (innerH * i) / (yTicks.length - 1 || 1);
          return <Line key={`gy${i}`} x1={PAD.l} y1={y} x2={PAD.l + innerW} y2={y} stroke={C.line} strokeWidth={0.4} strokeDasharray="2,2" />;
        })}

        <Path d={areaPath} fill="url(#flux-fill-i)" />
        <Path d={path} stroke={C.voltage} strokeWidth={1.6} fill="none" />

        {/* "t" direction arrow, anchored at the curve's peak/high-value
            point — mirrors the IEC reference figure. */}
        <Line x1={arrowTailX} y1={arrowTailY} x2={anchorX} y2={anchorY} stroke={C.ink} strokeWidth={0.8} />
        <Path
          d={`M${anchorX.toFixed(1)},${anchorY.toFixed(1)} L${tick1} M${anchorX.toFixed(1)},${anchorY.toFixed(1)} L${tick2}`}
          stroke={C.ink} strokeWidth={0.8} fill="none"
        />

        <Line x1={PAD.l} y1={PAD.t + innerH} x2={PAD.l + innerW} y2={PAD.t + innerH} stroke={C.lineDark} strokeWidth={0.9} />
        <Line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + innerH} stroke={C.lineDark} strokeWidth={0.9} />
      </Svg>

      {yTicks.map((v, i) => {
        const y = PAD.t + (innerH * i) / (yTicks.length - 1 || 1) - 3;
        return (
          <Text key={`yl${i}`} style={{ position: "absolute", left: 2, top: y + 8, fontSize: 6.2, color: C.voltage, width: PAD.l - 6, textAlign: "right" }}>
            {v.toFixed(3)}
          </Text>
        );
      })}

      {xTicks.map((v, i) => {
        const raw = sx(v) - 16;
        const x = Math.max(PAD.l - 6, Math.min(raw, PAD.l + innerW - 26));
        const align = i === 0 ? "left" : i === xTicks.length - 1 ? "right" : "center";
        return (
          <Text key={`xl${i}`} style={{ position: "absolute", left: x, top: PAD.t + innerH + 14, fontSize: 6.2, color: C.mute, width: 32, textAlign: align }}>
            {v.toFixed(2)}
          </Text>
        );
      })}

      <Text
        style={{
          position: "absolute",
          left: arrowTailX - 4,
          top: arrowTailY - 10,
          fontSize: 8.5,
          fontFamily: FONT_OBLIQUE,
          color: C.ink,
        }}
      >
        t
      </Text>

      {/* Axis captions, matching the IEC reference figure's labeled axes. */}
      <Text
        style={{
          position: "absolute", left: PAD.l, top: PAD.t + innerH + 24, width: innerW,
          textAlign: "center", fontSize: 6.4, color: C.mute, fontFamily: FONT_BOLD, letterSpacing: 0.6,
        }}
      >
        CURRENT (p.u.)
      </Text>
      <Text
        style={{
          position: "absolute", left: PAD.l, top: PAD.t - 11,
          fontSize: 6.2, color: C.mute, fontFamily: FONT_BOLD, letterSpacing: 0.6,
        }}
      >
        LINKED FLUX (p.u.)
      </Text>
    </View>
  );
}

/** 0-4 graphs, stacked one below another (full page width), same names/
 *  order/data-source as the in-app tabs (LinearityGraphTabs.tsx):
 *    1. RAW WAVEFORM         -> analyzed.rawDisplay (full range, incl. rise phase)
 *    2. RAW WAVEFORM (LOG)   -> analyzed.rawDisplay filtered to timestamp >= 0
 *    3. FLUX VS TIME         -> analyzed.fluxData (new_timestamp, linked_flux)
 *    4. FLUX CURVE (LINEAR)  -> computeMagneticCharacteristicPu(analyzed.fluxData, ...)
 *  All four come from ONE createAnalyzedSample() call — same pipeline the
 *  app's LinearityGraphTabs component runs, so the numbers are identical.
 *
 *  `options.graphs` controls which of the 4 GraphCards actually render.
 *  Each is an independent View with wrap={false} and no fixed height, so
 *  any subset renders cleanly with normal top-to-bottom flow — nothing
 *  here assumes exactly 4 graphs are present. `options.showBreakPoint`
 *  / `options.showSteadyState` are forwarded to graphs 1 & 2 only (the
 *  two time-based waveform charts); they don't apply to the flux charts.
 *
 *  Approval & Sign-Off is rendered by the caller directly below this
 *  component, on the same page. */
function StackedGraphs({
  points, peak, resistance, inductance, ratedAcRmsCurrent, options, steadyStateCurrent,
}: {
  points: RawPoint[]; peak: number;
  resistance?: number; inductance?: number; ratedAcRmsCurrent?: number;
  options: ReportOptions;
  steadyStateCurrent?: number | null;
}) {
  if (points.length < 2) {
    return (
      <View style={{ height: 220, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: C.mute, fontSize: 9 }}>No data captured yet.</Text>
      </View>
    );
  }

  const { graphs, showBreakPoint, showSteadyState } = options;
  const noGraphsSelected =
    !graphs.rawWaveform && !graphs.rawWaveformLog && !graphs.fluxTime && !graphs.fluxCurve;

  if (noGraphsSelected) {
    return (
      <View style={[s.card, { padding: 14, marginBottom: 14 }]}>
        <Text style={{ fontSize: 9, color: C.mute }}>
          No graphs were selected for this report.
        </Text>
      </View>
    );
  }

  const analyzed = createAnalyzedSample(points, resistance ?? 0);
  const puData = computeMagneticCharacteristicPu(
    analyzed.fluxData,
    inductance ?? 0,
    ratedAcRmsCurrent ?? 0,
  );

  const dischargeOnly = analyzed.rawDisplay.filter((p) => p.timestamp >= 0);
  const fluxUnavailable = !resistance || analyzed.fluxData.length < 2;
  const puUnavailable = !inductance || !ratedAcRmsCurrent || puData.length < 2;

  const breakPointForCharts = showBreakPoint ? analyzed.breakPoint : null;
  const steadyStateForCharts = showSteadyState ? steadyStateCurrent ?? null : null;

  // Heights trimmed from a flat 220 -> 195 (210 for the flux-curve chart,
  // which needs a little extra room for its two axis captions) — shaves
  // real height off every box on the page, which is what let a 2-graph
  // selection fit Approval & Sign-Off on the same page again.
  return (
    <View>
      {graphs.rawWaveform && (
        <GraphCard title=" Graph Of the charge and discharge current" accent={C.current}>
          <ChartCard
            points={analyzed.rawDisplay}
            peak={peak}
            height={195}
            scale="linear"
            breakPoint={breakPointForCharts}
            steadyStateCurrent={steadyStateForCharts}
          />
        </GraphCard>
      )}

      {graphs.rawWaveformLog && (
        <GraphCard title="Graph Of the discharge current With logarithmic current scaling" accent={C.current}>
          <ChartCard
            points={dischargeOnly}
            peak={peak}
            height={195}
            scale="log"
            breakPoint={breakPointForCharts}
            steadyStateCurrent={steadyStateForCharts}
          />
        </GraphCard>
      )}

      {graphs.fluxTime && (
        <GraphCard
          title=" Calculated linked flux during discharge period"
          accent={C.voltage}
          subtitle={fluxUnavailable
            ? "Resistance not set on this object, or tau never locked — flux curve is empty."
            : undefined}
        >
          <FluxTimeChart fluxData={analyzed.fluxData} height={195} />
        </GraphCard>
      )}

      {graphs.fluxCurve && (
        <GraphCard
          title="Magnetic characteristic"
          accent={C.voltage}
          subtitle={puUnavailable
            ? "Inductance or rated AC RMS current not set on this object — per-unit curve is empty."
            : undefined}
        >
          <FluxCurrentChart puData={puData} height={210} />
        </GraphCard>
      )}
    </View>
  );
}