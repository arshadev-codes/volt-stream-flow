import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Download, CheckCircle2, XCircle, Circle, Search, Loader2, Maximize2 } from "lucide-react";
import { GraphModal } from "@/components/GraphModal";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { BrandHeader } from "@/components/BrandHeader";
import { VoltageCurrentGraph } from "@/components/VoltageCurrentGraph";
import { useTheme } from "@/hooks/useTheme";
import { useTestObjects } from "@/hooks/useTestObjects";
import type { TestObject, TestReport, TestStatus } from "@/types/testObject";
import { exportReportPdf } from "@/utils/pdfReport";

gsap.registerPlugin(ScrollTrigger);

export const Route = createFileRoute("/reports")({
  component: ReportsPage,
  head: () => ({
    meta: [
      { title: "Reports — Electrosoft Automation RLTS" },
      { name: "description", content: "View, inspect and export reactor test reports." },
    ],
  }),
});

type Filter = "all" | TestStatus;
type SortBy = "modifiedAt" | "createdAt";
const PAGE_LIMIT = 100;

function ReportsPage() {
  const { theme, toggle } = useTheme();
  const { objects, fetchReport } = useTestObjects();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("modifiedAt");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  // Lazy-loaded selected report
  const [report, setReport] = useState<TestReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return objects
      .filter((o) => {
        if (filter !== "all" && o.status !== filter) return false;
        if (s && !`${o.serialNumber} ${o.name} ${o.workOrder} ${o.customerName}`.toLowerCase().includes(s)) return false;
        return true;
      })
      .sort((a, b) => (sortBy === "modifiedAt" ? b.modifiedAt - a.modifiedAt : b.createdAt - a.createdAt))
      .slice(0, PAGE_LIMIT);
  }, [objects, filter, q, sortBy]);

  const selected = selectedId ? objects.find((o) => o.id === selectedId) ?? null : null;

  // Fetch report ONLY when an object is selected (lazy)
  useEffect(() => {
    if (!selectedId || !selected || selected.status === "pending") {
      setReport(null);
      return;
    }
    let cancelled = false;
    setLoadingReport(true);
    fetchReport(selectedId).then((r) => {
      if (cancelled) return;
      setReport(r ?? null);
      setLoadingReport(false);
    });
    return () => { cancelled = true; };
  }, [selectedId, selected?.status, fetchReport]);

  // GSAP scroll-triggered reveal for list cards
  const listScope = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!listScope.current) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>("[data-report-card]").forEach((el, i) => {
        gsap.fromTo(
          el,
          { autoAlpha: 0, y: 14 },
          {
            autoAlpha: 1, y: 0, duration: 0.45, delay: Math.min(i * 0.012, 0.25), ease: "power2.out",
            scrollTrigger: { trigger: el, start: "top 95%", toggleActions: "play none none none" },
          },
        );
      });
    }, listScope);
    return () => ctx.revert();
  }, [list.length]);

  return (
    <div className="min-h-screen text-foreground">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 lg:px-8">
        <BrandHeader theme={theme} onToggleTheme={toggle} />

        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="grid gap-6 lg:grid-cols-[380px_1fr]"
        >
          <div className="panel flex flex-col p-4">
            <div className="flex items-center justify-between gap-2 font-display text-sm font-bold uppercase tracking-[0.2em]">
              <span className="inline-flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-500" /> Reports
              </span>
              <span className="rounded-sm border border-border bg-card px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                {list.length}{objects.length > PAGE_LIMIT ? ` / ${objects.length}` : ""}
              </span>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search serial, name, WO, customer"
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>

            <div className="mt-3 flex gap-1">
              {(["all", "pending", "passed", "failed"] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex-1 rounded-md border px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest transition ${
                    filter === f
                      ? "border-amber-500 bg-amber-500/15 text-amber-500"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Sort</span>
              {([
                { k: "modifiedAt", label: "Modified" },
                { k: "createdAt", label: "Created" },
              ] as { k: SortBy; label: string }[]).map(({ k, label }) => (
                <label
                  key={k}
                  className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest transition ${
                    sortBy === k
                      ? "border-amber-500 bg-amber-500/15 text-amber-500"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={sortBy === k}
                    onChange={() => setSortBy(k)}
                    className="h-3 w-3"
                    style={{ accentColor: "var(--peak)" }}
                  />
                  {label}
                </label>
              ))}
            </div>

            <div className="mt-2 px-1 pb-2 pt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Sorted by {sortBy === "modifiedAt" ? "modified" : "created"} date · showing latest {PAGE_LIMIT}
            </div>

            <div ref={listScope} className="max-h-[62vh] space-y-1.5 overflow-auto pr-1">
              {list.length === 0 && (
                <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  No test objects match.
                </div>
              )}
              {list.map((o) => (
                <button
                  key={o.id}
                  data-report-card
                  onClick={() => { setSelectedId(o.id); setShowRaw(false); }}
                  className={`flex w-full items-start justify-between gap-2 rounded-md border px-3 py-2.5 text-left transition will-change-transform ${
                    selectedId === o.id
                      ? "border-amber-500/60 bg-amber-500/10"
                      : "border-border bg-card hover:bg-accent"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
                      <StatusIcon status={o.status} /> {o.serialNumber}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">{o.name}</div>
                    <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span title="Modified">M: {fmtDate(o.modifiedAt)}</span>
                      <span className="mx-1 opacity-50">·</span>
                      <span title="Created">C: {fmtDate(o.createdAt)}</span>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-sm border border-border bg-card px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    {o.status}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="panel p-6">
            <AnimatePresence mode="wait">
              {!selected ? (
                <Empty key="empty" />
              ) : selected.status === "pending" ? (
                <Pending key={`p-${selected.id}`} object={selected} />
              ) : loadingReport || !report ? (
                <LoadingReport key={`l-${selected.id}`} />
              ) : (
                <motion.div
                  key={`r-${selected.id}`}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35 }}
                >
                  <ReportDetail
                    object={selected}
                    report={report}
                    showRaw={showRaw}
                    onToggleRaw={setShowRaw}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { year: "2-digit", month: "short", day: "2-digit" });
}

function StatusIcon({ status }: { status: TestStatus }) {
  if (status === "passed") return <CheckCircle2 className="h-3.5 w-3.5 text-[var(--ok)]" />;
  if (status === "failed") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  return <Circle className="h-3.5 w-3.5 text-muted-foreground" />;
}

function Empty() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex h-full min-h-[40vh] flex-col items-center justify-center text-center text-muted-foreground">
      <FileText className="mb-2 h-10 w-10 opacity-40" />
      <div className="text-sm">Select a test object to view its report.</div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-widest opacity-60">
        Data is fetched on demand
      </div>
    </motion.div>
  );
}

function Pending({ object }: { object: TestObject }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex h-full min-h-[40vh] flex-col items-center justify-center text-center text-muted-foreground">
      <Circle className="mb-2 h-10 w-10 opacity-40" />
      <div className="text-sm">
        <span className="font-semibold text-foreground">{object.serialNumber}</span> has not been tested yet.
      </div>
      <div className="mt-1 text-xs">Go to Testing and run a test for this object.</div>
    </motion.div>
  );
}

function LoadingReport() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex h-full min-h-[40vh] flex-col items-center justify-center text-center text-muted-foreground">
      <Loader2 className="mb-2 h-8 w-8 animate-spin text-amber-500" />
      <div className="font-mono text-[11px] uppercase tracking-widest">Fetching report data…</div>
    </motion.div>
  );
}

function ReportDetail({
  object, report, showRaw, onToggleRaw,
}: { object: TestObject; report: TestReport; showRaw: boolean; onToggleRaw: (v: boolean) => void }) {
  const hasRaw = report.rawResult.length > 0;
  const points = showRaw && hasRaw
    ? report.rawResult
    : (report.analysisResult?.length ? report.analysisResult : report.rawResult);
  const datasetLabel = showRaw && hasRaw
    ? `RAW · 0.25 MS · ${report.rawResult.length} pts`
    : `ANALYSIS · 1 MS · ${report.analysisResult.length} pts`;

  const [expand, setExpand] = useState(false);
  const [xRange, setXRange] = useState<[number, number] | null>(null);
  const [exporting, setExporting] = useState(false);

  // Reset zoom-aware range when the underlying dataset switches
  useEffect(() => { setXRange(null); }, [report.completedAt, showRaw]);

  const doExport = async () => {
    if (exporting) return;
    setExporting(true);
    const toastId = toast.loading("Generating PDF report…", {
      description: xRange ? "Including the currently zoomed time window." : "Including the full recorded curve.",
    });
    try {
      await exportReportPdf(object, report, { xRangeMs: xRange ?? undefined });
      toast.success("PDF exported", { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error("PDF export failed", { id: toastId, description: (e as Error).message });
    } finally {
      setExporting(false);
    }
  };

  const graphView = (
    <VoltageCurrentGraph
      points={points}
      timeUnit="MS"
      currentUnit="A"
      peakCurrent={report.peakCurrent}
      datasetLabel={datasetLabel}
      onRangeChange={setXRange}
    />
  );

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-wrap items-start justify-between gap-3"
      >
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">Test Object</div>
          <h2 className="font-display text-xl font-bold tracking-wide text-foreground">
            {object.serialNumber} · {object.name}
          </h2>
          <div className="mt-1 font-mono text-[11px] text-muted-foreground">
            Modified {new Date(report.completedAt).toLocaleString()} · Created {new Date(object.createdAt).toLocaleDateString()}
            {object.workOrder ? ` · WO ${object.workOrder}` : ""}
            {object.customerName ? ` · ${object.customerName}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-md border px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest ${
            report.status === "passed"
              ? "border-[var(--ok)]/60 bg-[var(--ok)]/15 text-[var(--ok)]"
              : "border-destructive/60 bg-destructive/15 text-destructive"
          }`}>{report.status}</span>
          {xRange && (
            <span className="hidden rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-amber-500 md:inline">
              ZOOM · {xRange[0].toFixed(0)}–{xRange[1].toFixed(0)} ms
            </span>
          )}
          <button
            onClick={doExport}
            disabled={exporting}
            aria-busy={exporting}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-background transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
          >
            {exporting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" /> {xRange ? "Export Zoom PDF" : "Export PDF"}
              </>
            )}
          </button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <Mini label="Peak" value={`${report.peakCurrent.toFixed(2)} A`} />
        <Mini label="Duration" value={`${report.durationS.toFixed(2)} s`} />
        <Mini label="Raw Samples" value={hasRaw ? String(report.rawResult.length) : "—"} />
        <Mini label="Analysis Pts" value={String(report.analysisResult.length)} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 }}
        className="rounded-md border border-border bg-card p-4"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="font-display text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Recorded Linearity Curve
          </div>
          <div className="flex items-center gap-2">
            <label
              className={`inline-flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-foreground ${
                hasRaw ? "cursor-pointer hover:bg-accent" : "cursor-not-allowed opacity-50"
              }`}
              title={hasRaw ? "" : "Raw data not stored for this report"}
            >
              <input
                type="checkbox"
                checked={showRaw && hasRaw}
                disabled={!hasRaw}
                onChange={(e) => onToggleRaw(e.target.checked)}
                className="h-3.5 w-3.5"
                style={{ accentColor: "var(--peak)" }}
              />
              Show Raw Data
            </label>
            <button
              onClick={() => setExpand(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-foreground transition hover:bg-accent"
            >
              <Maximize2 className="h-3.5 w-3.5" /> View
            </button>
          </div>
        </div>
        {graphView}
      </motion.div>

      <GraphModal open={expand} onClose={() => setExpand(false)} title={`${object.serialNumber} · Linearity Curve`}>
        {graphView}
      </GraphModal>

      <motion.details
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.4 }}
        className="rounded-md border border-border bg-card p-4 text-sm" open
      >
        <summary className="cursor-pointer font-semibold text-foreground">Job & object details</summary>
        <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[12px] text-muted-foreground">
          <div>Project: <span className="text-foreground">{object.projectName || "—"}</span></div>
          <div>Customer: <span className="text-foreground">{object.customerName || "—"}</span></div>
          <div>Work Order: <span className="text-foreground">{object.workOrder || "—"}</span></div>
          <div>Manufacturer: <span className="text-foreground">{object.manufacturer || "—"}</span></div>
          <div>Frequency: <span className="text-foreground">{object.frequency ?? "—"} Hz</span></div>
          <div>Rated V: <span className="text-foreground">{object.ratedVoltage} V</span></div>
          <div>Max V: <span className="text-foreground">{object.maxVoltage} V</span></div>
          <div>Rated I: <span className="text-foreground">{object.ratedCurrent} A</span></div>
          <div>Peak I: <span className="text-foreground">{object.peakCurrent} A</span></div>
          <div>Inductance: <span className="text-foreground">{object.inductance ?? "—"} mH</span></div>
          {object.notes && <div className="col-span-2">Notes: <span className="text-foreground">{object.notes}</span></div>}
        </div>
      </motion.details>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="rounded-md border border-border bg-card p-3 transition hover:border-amber-500/40"
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-lg font-bold tabular-nums text-foreground">{value}</div>
    </motion.div>
  );
}
