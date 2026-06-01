import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FileText, Download, CheckCircle2, XCircle, Circle, Search } from "lucide-react";
import { BrandHeader } from "@/components/BrandHeader";
import { VoltageCurrentGraph } from "@/components/VoltageCurrentGraph";
import { useTheme } from "@/hooks/useTheme";
import { useTestObjects } from "@/hooks/useTestObjects";
import type { TestObject, TestReport, TestStatus } from "@/types/testObject";
import { exportReportPdf } from "@/utils/pdfReport";

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

function ReportsPage() {
  const { theme, toggle } = useTheme();
  const { objects, getReport } = useTestObjects();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return objects.filter((o) => {
      if (filter !== "all" && o.status !== filter) return false;
      if (s && !`${o.serialNumber} ${o.name}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [objects, filter, q]);

  const selected = selectedId ? objects.find((o) => o.id === selectedId) ?? null : null;
  const report = selected ? getReport(selected.id) : undefined;

  return (
    <div className="min-h-screen text-foreground">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 lg:px-8">
        <BrandHeader theme={theme} onToggleTheme={toggle} />

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          {/* Sidebar list */}
          <div className="panel flex flex-col p-4">
            <div className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.2em]">
              <FileText className="h-4 w-4 text-amber-500" />
              Reports
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by serial or name"
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

            <div className="mt-3 max-h-[60vh] space-y-1.5 overflow-auto pr-1">
              {list.length === 0 && (
                <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  No test objects match.
                </div>
              )}
              {list.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setSelectedId(o.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left transition ${
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
                  </div>
                  <span className="shrink-0 rounded-sm border border-border bg-card px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    {o.status}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Detail */}
          <div className="panel p-6">
            {!selected ? (
              <Empty />
            ) : selected.status === "pending" || !report ? (
              <Pending object={selected} />
            ) : (
              <ReportDetail object={selected} report={report} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: TestStatus }) {
  if (status === "passed") return <CheckCircle2 className="h-3.5 w-3.5 text-[var(--ok)]" />;
  if (status === "failed") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  return <Circle className="h-3.5 w-3.5 text-muted-foreground" />;
}

function Empty() {
  return (
    <div className="flex h-full min-h-[40vh] flex-col items-center justify-center text-center text-muted-foreground">
      <FileText className="mb-2 h-10 w-10 opacity-40" />
      <div className="text-sm">Select a test object to view its report.</div>
    </div>
  );
}

function Pending({ object }: { object: TestObject }) {
  return (
    <div className="flex h-full min-h-[40vh] flex-col items-center justify-center text-center text-muted-foreground">
      <Circle className="mb-2 h-10 w-10 opacity-40" />
      <div className="text-sm">
        <span className="font-semibold text-foreground">{object.serialNumber}</span> has not been tested yet.
      </div>
      <div className="mt-1 text-xs">Go to Testing and run a test for this object.</div>
    </div>
  );
}

function ReportDetail({ object, report }: { object: TestObject; report: TestReport }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
            Test Object
          </div>
          <h2 className="font-display text-xl font-bold tracking-wide text-foreground">
            {object.serialNumber} · {object.name}
          </h2>
          <div className="mt-1 font-mono text-[11px] text-muted-foreground">
            {new Date(report.completedAt).toLocaleString()}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-md border px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest ${
              report.status === "passed"
                ? "border-[var(--ok)]/60 bg-[var(--ok)]/15 text-[var(--ok)]"
                : "border-destructive/60 bg-destructive/15 text-destructive"
            }`}
          >
            {report.status}
          </span>
          <button
            onClick={() => exportReportPdf(object, report)}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-background hover:brightness-110"
          >
            <Download className="h-3.5 w-3.5" /> Export PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Mini label="Peak" value={`${report.peakCurrent.toFixed(2)} A`} />
        <Mini label="Duration" value={`${report.durationS.toFixed(2)} s`} />
        <Mini label="Samples" value={String(report.samples.length)} />
        <Mini label="Max Voltage" value={`${object.maxVoltage} V`} />
      </div>

      <div className="rounded-md border border-border bg-card p-4">
        <div className="mb-3 font-display text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Recorded Linearity Curve
        </div>
        <VoltageCurrentGraph
          samples={report.samples}
          timeUnit="S"
          currentUnit="A"
          peakCurrent={report.peakCurrent}
        />
      </div>

      <details className="rounded-md border border-border bg-card p-4 text-sm">
        <summary className="cursor-pointer font-semibold text-foreground">Object specifications</summary>
        <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[12px] text-muted-foreground">
          <div>Manufacturer: <span className="text-foreground">{object.manufacturer || "—"}</span></div>
          <div>Frequency: <span className="text-foreground">{object.frequency ?? "—"} Hz</span></div>
          <div>Rated V: <span className="text-foreground">{object.ratedVoltage} V</span></div>
          <div>Max V: <span className="text-foreground">{object.maxVoltage} V</span></div>
          <div>Rated I: <span className="text-foreground">{object.ratedCurrent} A</span></div>
          <div>Peak I: <span className="text-foreground">{object.peakCurrent} A</span></div>
          <div>Inductance: <span className="text-foreground">{object.inductance ?? "—"} mH</span></div>
          {object.notes && <div className="col-span-2">Notes: <span className="text-foreground">{object.notes}</span></div>}
        </div>
      </details>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-lg font-bold tabular-nums text-foreground">{value}</div>
    </div>
  );
}
