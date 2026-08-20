import { useState } from "react";
import type { TestObject, TestReport } from "@/types/testObject";
import {
  exportReportPdf,
  DEFAULT_REPORT_OPTIONS,
  type SignOffData,
  type ReportOptions,
} from "@/utils/pdfReport";

/**
 * Modal shown when the user clicks "Export PDF". Collects:
 *
 *   1. Sign-off details (Tested By / Verified By / Approved By) — every
 *      field here is OPTIONAL. Tested By's Designation is locked to
 *      "Test Engineer" (not user-editable) but its Name, and all of
 *      Verified By / Approved By, may be left blank. A blank field
 *      prints as a blank line in the PDF for a handwritten signature
 *      after printing. There is no validation blocking export — the
 *      user can hit "Export PDF" with everything empty.
 *
 *   2. Report contents — which of the 4 graphs to include, and whether
 *      to show the Break Point / Steady State markers on the two
 *      waveform graphs. Defaults to DEFAULT_REPORT_OPTIONS (everything
 *      on) so the common case is a single click.
 *
 * Wire this in wherever the old "Export PDF" button called
 * exportReportPdf(object, report, signOff) directly — the 4th
 * `options` argument is optional on exportReportPdf() (defaults to
 * DEFAULT_REPORT_OPTIONS), so any other existing call site that hasn't
 * been updated yet keeps working unchanged.
 */

const TESTED_BY_DESIGNATION = "Test Engineer";

interface ExportSignOffDialogProps {
  object: TestObject;
  report: TestReport;
  open: boolean;
  onClose: () => void;
}

export function ExportSignOffDialog({ object, report, open, onClose }: ExportSignOffDialogProps) {
  const [testedByName, setTestedByName] = useState("");

  const [verifiedByDesignation, setVerifiedByDesignation] = useState("");
  const [verifiedByName, setVerifiedByName] = useState("");

  const [approvedByDesignation, setApprovedByDesignation] = useState("");
  const [approvedByName, setApprovedByName] = useState("");

  // Report contents — default to "everything on" (matches prior behavior
  // before these options existed).
  const [includeRawWaveform, setIncludeRawWaveform] = useState(
    DEFAULT_REPORT_OPTIONS.graphs.rawWaveform,
  );
  const [includeRawWaveformLog, setIncludeRawWaveformLog] = useState(
    DEFAULT_REPORT_OPTIONS.graphs.rawWaveformLog,
  );
  const [includeFluxTime, setIncludeFluxTime] = useState(
    DEFAULT_REPORT_OPTIONS.graphs.fluxTime,
  );
  const [includeFluxCurve, setIncludeFluxCurve] = useState(
    DEFAULT_REPORT_OPTIONS.graphs.fluxCurve,
  );
  const [showBreakPoint, setShowBreakPoint] = useState(DEFAULT_REPORT_OPTIONS.showBreakPoint);
  const [showSteadyState, setShowSteadyState] = useState(DEFAULT_REPORT_OPTIONS.showSteadyState);

  // Only used for genuine export failures (e.g. PDF generation throwing) —
  // there is no field-level "required" validation anymore.
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  if (!open) return null;

  const resetAndClose = () => {
    setError(null);
    onClose();
  };

  const handleExport = async () => {
    setError(null);

    const signOff: SignOffData = {
      testedBy: { designation: TESTED_BY_DESIGNATION, name: testedByName.trim() },
      verifiedBy: { designation: verifiedByDesignation.trim(), name: verifiedByName.trim() },
      approvedBy: { designation: approvedByDesignation.trim(), name: approvedByName.trim() },
    };

    const options: ReportOptions = {
      graphs: {
        rawWaveform: includeRawWaveform,
        rawWaveformLog: includeRawWaveformLog,
        fluxTime: includeFluxTime,
        fluxCurve: includeFluxCurve,
      },
      showBreakPoint,
      showSteadyState,
    };

    try {
      setExporting(true);
      await exportReportPdf(object, report, signOff, options);
      resetAndClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export PDF.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-label="Export report options">
      <div style={styles.modal}>
        <h2 style={styles.title}>Export Report</h2>
        <p style={styles.helpText}>
          Everything below is optional. Names and designations print in the Approval &amp;
          Sign-Off section of the PDF, directly below the graphs — leave a name blank to print a
          blank line for a handwritten signature after printing.
        </p>

        {/* Tested By */}
        <fieldset style={styles.fieldset}>
          <legend style={styles.legend}>Tested By</legend>
          <div style={styles.fieldRow}>
            <label style={styles.label}>
              Designation
              <input value={TESTED_BY_DESIGNATION} disabled style={{ ...styles.input, ...styles.inputDisabled }} />
            </label>
            <label style={styles.label}>
              Name
              <input
                value={testedByName}
                onChange={(e) => setTestedByName(e.target.value)}
                placeholder="Optional"
                style={styles.input}
              />
            </label>
          </div>
        </fieldset>

        {/* Verified By */}
        <fieldset style={styles.fieldset}>
          <legend style={styles.legend}>Verified By</legend>
          <div style={styles.fieldRow}>
            <label style={styles.label}>
              Designation
              <input
                value={verifiedByDesignation}
                onChange={(e) => setVerifiedByDesignation(e.target.value)}
                placeholder="e.g. Quality Manager"
                style={styles.input}
              />
            </label>
            <label style={styles.label}>
              Name
              <input
                value={verifiedByName}
                onChange={(e) => setVerifiedByName(e.target.value)}
                placeholder="Optional"
                style={styles.input}
              />
            </label>
          </div>
        </fieldset>

        {/* Approved By */}
        <fieldset style={styles.fieldset}>
          <legend style={styles.legend}>Approved By</legend>
          <div style={styles.fieldRow}>
            <label style={styles.label}>
              Designation
              <input
                value={approvedByDesignation}
                onChange={(e) => setApprovedByDesignation(e.target.value)}
                placeholder="e.g. Engineering Head"
                style={styles.input}
              />
            </label>
            <label style={styles.label}>
              Name
              <input
                value={approvedByName}
                onChange={(e) => setApprovedByName(e.target.value)}
                placeholder="Optional"
                style={styles.input}
              />
            </label>
          </div>
        </fieldset>

        {/* Report contents */}
        <fieldset style={styles.fieldset}>
          <legend style={styles.legend}>Graphs to Include</legend>
          <div style={styles.checkGrid}>
            <label style={styles.checkRow}>
              <input
                type="checkbox"
                style={styles.checkbox}
                checked={includeRawWaveform}
                onChange={(e) => setIncludeRawWaveform(e.target.checked)}
              />
              Charge &amp; discharge current
            </label>
            <label style={styles.checkRow}>
              <input
                type="checkbox"
                style={styles.checkbox}
                checked={includeRawWaveformLog}
                onChange={(e) => setIncludeRawWaveformLog(e.target.checked)}
              />
              Discharge current (log scale)
            </label>
            <label style={styles.checkRow}>
              <input
                type="checkbox"
                style={styles.checkbox}
                checked={includeFluxTime}
                onChange={(e) => setIncludeFluxTime(e.target.checked)}
              />
              Linked flux vs. time
            </label>
            <label style={styles.checkRow}>
              <input
                type="checkbox"
                style={styles.checkbox}
                checked={includeFluxCurve}
                onChange={(e) => setIncludeFluxCurve(e.target.checked)}
              />
              Magnetic characteristic
            </label>
          </div>
        </fieldset>

        {/* Markers */}
        <fieldset style={styles.fieldset}>
          <legend style={styles.legend}>Markers</legend>
          <div style={styles.checkGrid}>
            <label style={styles.checkRow}>
              <input
                type="checkbox"
                style={styles.checkbox}
                checked={showBreakPoint}
                onChange={(e) => setShowBreakPoint(e.target.checked)}
              />
              Show Break point
            </label>
            <label style={styles.checkRow}>
              <input
                type="checkbox"
                style={styles.checkbox}
                checked={showSteadyState}
                onChange={(e) => setShowSteadyState(e.target.checked)}
              />
              Show Steady State line
            </label>
          </div>
        </fieldset>

        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.actions}>
          <button onClick={resetAndClose} style={styles.secondaryBtn} disabled={exporting}>
            Cancel
          </button>
          <button onClick={handleExport} style={styles.primaryBtn} disabled={exporting}>
            {exporting ? "Exporting\u2026" : "Export PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.55)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    padding: 16,
  },
  modal: {
    width: 560, maxWidth: "94vw", maxHeight: "90vh", overflowY: "auto",
    backgroundColor: "#FFFFFF", borderRadius: 10, padding: "22px 24px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.25)", fontFamily: "system-ui, sans-serif",
    boxSizing: "border-box",
  },
  title: { fontSize: 17, fontWeight: 700, color: "#0F172A", margin: "0 0 8px" },
  helpText: { fontSize: 12.5, color: "#475569", lineHeight: 1.5, margin: "0 0 18px" },
  fieldset: { border: "1px solid #E2E8F0", borderRadius: 8, padding: "12px 14px", margin: "0 0 14px" },
  legend: { fontSize: 12, fontWeight: 700, color: "#0F172A", padding: "0 6px" },
  fieldRow: {
    display: "flex", flexWrap: "wrap", gap: 12, marginTop: 4,
  },
  label: {
    flex: "1 1 200px", minWidth: 180,
    display: "flex", flexDirection: "column",
    fontSize: 11.5, color: "#334155", fontWeight: 600, gap: 4,
  },
  input: {
    fontSize: 13, padding: "7px 9px", borderRadius: 6, border: "1px solid #CBD5E1",
    fontWeight: 400, color: "#0F172A", outline: "none", boxSizing: "border-box", width: "100%",
  },
  inputDisabled: { backgroundColor: "#F1F5F9", color: "#64748B" },
  checkGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 16, rowGap: 10, marginTop: 4,
  },
  checkRow: {
    display: "flex", alignItems: "center", gap: 8,
    fontSize: 12.5, color: "#334155", fontWeight: 500, cursor: "pointer",
  },
  checkbox: { width: 15, height: 15, cursor: "pointer", flexShrink: 0 },
  error: { fontSize: 12.5, color: "#B91C1C", margin: "4px 0 10px" },
  actions: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 },
  secondaryBtn: {
    padding: "9px 16px", borderRadius: 7, border: "1px solid #CBD5E1",
    backgroundColor: "#FFFFFF", color: "#334155", fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
  primaryBtn: {
    padding: "9px 16px", borderRadius: 7, border: "none",
    backgroundColor: "#B45309", color: "#FFFFFF", fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
};