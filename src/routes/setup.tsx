import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Boxes, Plus, Trash2, CheckCircle2, XCircle, Circle } from "lucide-react";
import { BrandHeader } from "@/components/BrandHeader";
import { useTheme } from "@/hooks/useTheme";
import { useTestObjects } from "@/hooks/useTestObjects";
import type { TestStatus } from "@/types/testObject";

export const Route = createFileRoute("/setup")({
  component: SetupPage,
  head: () => ({
    meta: [
      { title: "Test Objects — Electrosoft Automation RLTS" },
      { name: "description", content: "Create and manage reactor test objects." },
    ],
  }),
});

const EMPTY = {
  serialNumber: "",
  name: "",
  manufacturer: "",
  ratedVoltage: 230,
  maxVoltage: 250,
  ratedCurrent: 50,
  peakCurrent: 100,
  frequency: 50,
  inductance: 0,
  notes: "",
};

function SetupPage() {
  const { theme, toggle } = useTheme();
  const { objects, create, remove } = useTestObjects();
  const [form, setForm] = useState(EMPTY);

  const update = <K extends keyof typeof EMPTY>(k: K, v: typeof EMPTY[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.serialNumber.trim() || !form.name.trim()) {
      alert("Serial number and name are required.");
      return;
    }
    create({
      serialNumber: form.serialNumber.trim(),
      name: form.name.trim(),
      manufacturer: form.manufacturer.trim() || undefined,
      ratedVoltage: Number(form.ratedVoltage),
      maxVoltage: Number(form.maxVoltage),
      ratedCurrent: Number(form.ratedCurrent),
      peakCurrent: Number(form.peakCurrent),
      frequency: Number(form.frequency) || undefined,
      inductance: Number(form.inductance) || undefined,
      notes: form.notes.trim() || undefined,
    });
    setForm(EMPTY);
  };

  return (
    <div className="min-h-screen text-foreground">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 lg:px-8">
        <BrandHeader theme={theme} onToggleTheme={toggle} />

        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          {/* Form */}
          <form onSubmit={submit} className="panel space-y-4 p-6">
            <div className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.2em]">
              <Plus className="h-4 w-4 text-amber-500" />
              Create Test Object
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Serial Number *" value={form.serialNumber} onChange={(v) => update("serialNumber", v)} placeholder="RX-001" />
              <Field label="Name *"          value={form.name}         onChange={(v) => update("name", v)} placeholder="Reactor Unit A" />
              <Field label="Manufacturer"    value={form.manufacturer} onChange={(v) => update("manufacturer", v)} placeholder="Optional" />
              <Field label="Frequency (Hz)"  type="number" value={form.frequency}    onChange={(v) => update("frequency", Number(v))} />
              <Field label="Rated Voltage (V)" type="number" value={form.ratedVoltage} onChange={(v) => update("ratedVoltage", Number(v))} />
              <Field label="Max Voltage (V)"   type="number" value={form.maxVoltage}   onChange={(v) => update("maxVoltage", Number(v))} />
              <Field label="Rated Current (A)" type="number" value={form.ratedCurrent} onChange={(v) => update("ratedCurrent", Number(v))} />
              <Field label="Peak Current (A)"  type="number" value={form.peakCurrent}  onChange={(v) => update("peakCurrent", Number(v))} />
              <Field label="Inductance (mH)"   type="number" value={form.inductance}   onChange={(v) => update("inductance", Number(v))} />
            </div>

            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Notes</span>
              <textarea
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                rows={3}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                placeholder="Optional"
              />
            </label>

            <button
              type="submit"
              className="w-full rounded-md bg-amber-500 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-background hover:brightness-110"
            >
              Create Object
            </button>
          </form>

          {/* List */}
          <div className="panel p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.2em]">
                <Boxes className="h-4 w-4 text-amber-500" />
                All Test Objects
              </div>
              <span className="rounded-sm border border-border bg-card px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                {objects.length}
              </span>
            </div>

            <div className="space-y-2">
              {objects.length === 0 && (
                <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No test objects yet. Create one to get started.
                </div>
              )}
              {objects.map((o) => (
                <div key={o.id} className="flex items-start justify-between gap-3 rounded-md border border-border bg-card p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusIcon status={o.status} />
                      <span className="truncate font-semibold text-foreground">{o.serialNumber}</span>
                      <span className="truncate text-sm text-muted-foreground">· {o.name}</span>
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                      {o.peakCurrent} A peak · {o.maxVoltage} V max
                      {o.manufacturer ? ` · ${o.manufacturer}` : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => confirm(`Delete ${o.serialNumber}? Its report will also be deleted.`) && remove(o.id)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder,
}: {
  label: string; value: string | number; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
      />
    </label>
  );
}

function StatusIcon({ status }: { status: TestStatus }) {
  if (status === "passed") return <CheckCircle2 className="h-4 w-4 text-[var(--ok)]" />;
  if (status === "failed") return <XCircle className="h-4 w-4 text-destructive" />;
  return <Circle className="h-4 w-4 text-muted-foreground" />;
}
