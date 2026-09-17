import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Boxes, Plus, Trash2, Pencil, X, CheckCircle2, XCircle, Circle, Lock } from "lucide-react";
import { BrandHeader } from "@/components/BrandHeader";
import { useTheme } from "@/hooks/useTheme";
import { useTestObjects } from "@/hooks/useTestObjects";
import type { TestObject, TestStatus, PhaseCount, PowerUnit, VoltageUnit, ResLeadsUnit } from "@/types/testObject";
import {
  computeRatedPowerVA,
  computeRatedAcRmsCurrent,
  computeResAt20DegC,
  computeIdcForLinearityTest,
  computeRatedVoltageV,
  PU_LINEARITY,
} from "@/utils/reactorCalcs";
import { useSettings } from "@/hooks/useSettings";

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
  projectName: "",
  customerName: "",
  workOrder: "",
  frequency: 50,
  inductance: 0,
  notes: "",

  // Nameplate data (linearity report)
  ratedPowerValue: 0,
  ratedPowerUnit: "MVAR" as PowerUnit,
  ratedVoltageNameplate: 0,
  ratedVoltageUnit: "V" as VoltageUnit,
  phases: 3 as PhaseCount,
  resAtRefTemp: 0,
  refTempForRes: 75,
  // NOTE: renamed from "resIncreaseByLeads" -> "resIncreaseByLeadsPu" so this
  // key matches what the JSX below actually reads/writes AND what
  // pdfReport.tsx / reactorCalcs.computeUltimateDcVoltage read on the
  // TestObject. Previously these were different names, so the value never
  // made it through and always showed "—" on the report.
  resIncreaseByLeadsPu: 0,
  resIncreaseByLeadsUnit: "%" as ResLeadsUnit,
};

function SetupPage() {
  const { theme, toggle } = useTheme();
  const { objects, create, update: updateObject, remove } = useTestObjects();
  const { settings } = useSettings();
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);

  const update = <K extends keyof typeof EMPTY>(k: K, v: typeof EMPTY[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  /**
   * Loads an existing object's values back into the form for editing.
   * NOTE: the original "unit" chosen for Rated Voltage and Res Increase
   * by Leads isn't stored (only the already-converted base value is), so
   * those two unit dropdowns reset to their defaults (V / %) here — the
   * underlying numeric value is still correct either way.
   */
  const objectToForm = (o: TestObject): typeof EMPTY => ({
    serialNumber: o.serialNumber,
    name: o.name ?? "",
    manufacturer: o.manufacturer ?? "",
    projectName: o.projectName ?? "",
    customerName: o.customerName ?? "",
    workOrder: o.workOrder ?? "",
    frequency: o.frequency ?? 0,
    inductance: o.inductance ?? 0,
    notes: o.notes ?? "",

    ratedPowerValue: o.ratedPowerValue ?? 0,
    ratedPowerUnit: (o.ratedPowerUnit as PowerUnit) ?? "MVAR",
    ratedVoltageNameplate: o.ratedVoltageNameplate ?? 0,
    ratedVoltageUnit: "V",
    phases: (o.phases as PhaseCount) ?? 3,
    resAtRefTemp: o.resAtRefTemp ?? 0,
    refTempForRes: o.refTempForRes ?? 75,
    resIncreaseByLeadsPu: o.resIncreaseByLeadsPu ?? 0,
    resIncreaseByLeadsUnit: "%",
  });

  const startEdit = (o: TestObject) => {
    setForm(objectToForm(o));
    setEditingId(o.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setForm(EMPTY);
    setEditingId(null);
  };

  // ---- Locked, computed nameplate fields (live preview) ----
  const ratedPowerVA = useMemo(
    () => computeRatedPowerVA(Number(form.ratedPowerValue) || 0, form.ratedPowerUnit),
    [form.ratedPowerValue, form.ratedPowerUnit],
  );
  const ratedVoltageV = useMemo(
    () => computeRatedVoltageV(Number(form.ratedVoltageNameplate) || 0, form.ratedVoltageUnit),
    [form.ratedVoltageNameplate, form.ratedVoltageUnit],
  );
  const ratedAcRmsCurrent = useMemo(
    () => computeRatedAcRmsCurrent(ratedPowerVA, ratedVoltageV, form.phases),
    [ratedPowerVA, ratedVoltageV, form.phases],
  );
  const resAt20DegC = useMemo(
    () => computeResAt20DegC(Number(form.resAtRefTemp) || 0, Number(form.refTempForRes) || 0),
    [form.resAtRefTemp, form.refTempForRes],
  );
  const currentMultiplier = settings.currentMultiplier || PU_LINEARITY;
  const idcForLinearityTest = useMemo(
    () => computeIdcForLinearityTest(ratedAcRmsCurrent, currentMultiplier),
    [ratedAcRmsCurrent, currentMultiplier],
  );

  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.serialNumber.trim()) {
      alert("Serial number is required.");
      return;
    }

    // Engineering fields that feed the report's calculations (Idc, tau,
    // flux, etc.) — allowed to be blank/0 before this, which meant a test
    // object could silently save with zeroed-out downstream numbers.
    const missing: string[] = [];
    if (!form.ratedPowerValue) missing.push("Rated Power");
    if (!form.ratedVoltageNameplate) missing.push("Rated Voltage");
    if (!form.frequency) missing.push("Frequency");
    if (!form.inductance) missing.push("Inductance");
    if (!form.resAtRefTemp) missing.push("Res/ph at Ref Temp");
    if (!form.refTempForRes && form.refTempForRes !== 0) missing.push("Ref Temp for Res");

    if (missing.length > 0) {
      alert(`Please fill in the following required fields before creating the object:\n\n${missing.join("\n")}`);
      return;
    }

    setSaving(true);
    const payload = {
      serialNumber: form.serialNumber.trim(),
      name: form.name.trim(),
      manufacturer: form.manufacturer.trim() || undefined,
      projectName: form.projectName.trim(),
      customerName: form.customerName.trim(),
      workOrder: form.workOrder.trim(),

      // FIX: these three are required on TestObject but were never being
      // set here, so rated_voltage / rated_current always saved as 0.
      ratedVoltage: ratedVoltageV || 0,
      maxVoltage: ratedVoltageV || 0,
      ratedCurrent: ratedAcRmsCurrent || 0,

      frequency: Number(form.frequency) || undefined,
      inductance: Number(form.inductance) || undefined,
      notes: form.notes.trim() || undefined,

      ratedPowerValue: Number(form.ratedPowerValue) || undefined,
      ratedPowerUnit: form.ratedPowerUnit,
      ratedPowerVA: ratedPowerVA || undefined,

      ratedVoltageNameplate: ratedVoltageV || undefined,

      phases: (Number(form.phases) as PhaseCount) || undefined,
      resAtRefTemp: Number(form.resAtRefTemp) || undefined,
      refTempForRes: Number(form.refTempForRes) || undefined,
      resIncreaseByLeadsPu: Number(form.resIncreaseByLeadsPu) || undefined,

      ratedAcRmsCurrent: ratedAcRmsCurrent || undefined,
      resAt20DegC: resAt20DegC || undefined,
      idcForLinearityTest: idcForLinearityTest || undefined,
    };

    const result = editingId
      ? await updateObject(editingId, payload)
      : await create(payload);
    setSaving(false);

    if (!result.ok) {
      alert(result.error);
      return;
    }
    setForm(EMPTY);
    setEditingId(null);
  };

  return (
    <div className="min-h-screen text-foreground">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 lg:px-8">
        <BrandHeader theme={theme} onToggleTheme={toggle} />

        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <form onSubmit={submit} className="panel space-y-4 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.2em]">
                {editingId ? <Pencil className="h-4 w-4 text-amber-500" /> : <Plus className="h-4 w-4 text-amber-500" />}
                {editingId ? "Edit Test Object" : "Create Test Object"}
              </div>
              {editingId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-accent"
                >
                  <X className="h-3 w-3" /> Cancel
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Serial Number *" value={form.serialNumber} onChange={(v) => update("serialNumber", v)} placeholder="RX-001" />
              <Field label="Description" value={form.name} onChange={(v) => update("name", v)} placeholder="Reactor Unit A" />
              <Field label="Project Name" value={form.projectName} onChange={(v) => update("projectName", v)} placeholder="Substation Upgrade" />
              <Field label="Customer Name" value={form.customerName} onChange={(v) => update("customerName", v)} placeholder="Acme Power Co." />
              <Field label="Work Order" value={form.workOrder} onChange={(v) => update("workOrder", v)} placeholder="WO-2026-0421" />
              {/* <Field label="Manufacturer" value={form.manufacturer} onChange={(v) => update("manufacturer", v)} placeholder="Optional" /> */}
              <Field label="Frequency (Hz)" type="number" value={form.frequency} onChange={(v) => update("frequency", Number(v))} />
              <Field label="Inductance (H)" type="number" value={form.inductance} onChange={(v) => update("inductance", Number(v))} />

              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Rated Power</span>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    value={form.ratedPowerValue}
                    onChange={(e) => update("ratedPowerValue", Number(e.target.value))}
                    placeholder="150"
                    className="w-full min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                  />
                  <select
                    value={form.ratedPowerUnit}
                    onChange={(e) => update("ratedPowerUnit", e.target.value as PowerUnit)}
                    className="w-24 shrink-0 rounded-md border border-border bg-card px-2 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="VAR">VAR</option>
                    <option value="KVAR">KVAR</option>
                    <option value="MVAR">MVAr</option>
                  </select>
                </div>
              </label>

              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Rated Voltage</span>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    value={form.ratedVoltageNameplate}
                    onChange={(e) => update("ratedVoltageNameplate", Number(e.target.value))}
                    placeholder="420000"
                    className="w-full min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                  />
                  <select
                    value={form.ratedVoltageUnit}
                    onChange={(e) => update("ratedVoltageUnit", e.target.value as VoltageUnit)}
                    className="w-20 shrink-0 rounded-md border border-border bg-card px-2 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="V">V</option>
                    <option value="kV">kV</option>
                    <option value="MV">MV</option>
                  </select>
                </div>
              </label>

              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">No. of Phases</span>
                <select
                  value={form.phases}
                  onChange={(e) => update("phases", Number(e.target.value) as PhaseCount)}
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value={1}>1 (Single Phase)</option>
                  <option value={3}>3 (Three Phase)</option>
                </select>
              </label>

              <Field label="Res/ph at Ref Temp (Ω)" type="number" value={form.resAtRefTemp} onChange={(v) => update("resAtRefTemp", Number(v))} />
              <Field label="Ref Temp for Res (°C)" type="number" value={form.refTempForRes} onChange={(v) => update("refTempForRes", Number(v))} />

              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Res Increase by Leads</span>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    value={form.resIncreaseByLeadsPu}
                    onChange={(e) => update("resIncreaseByLeadsPu", Number(e.target.value))}
                    placeholder="e.g. 1.1"
                    className="w-full min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                  />
                  <select
                    value={form.resIncreaseByLeadsUnit}
                    onChange={(e) => update("resIncreaseByLeadsUnit", e.target.value as ResLeadsUnit)}
                    className="w-20 shrink-0 rounded-md border border-border bg-card px-2 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="Ω">Ω</option>
                    <option value="%">%</option>
                  </select>
                </div>
              </label>

              <LockedField label="Rated AC RMS Current, A" value={ratedAcRmsCurrent} />
              <LockedField label="Res/ph @ 20°C, Ω" value={resAt20DegC} />
              <LockedField label="Idc for Linearity Test, A" value={idcForLinearityTest} />
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
              disabled={saving}
              className="w-full rounded-md bg-amber-500 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-background hover:brightness-110 disabled:opacity-60"
            >
              {saving ? "Saving..." : editingId ? "Update Object" : "Create Object"}
            </button>
          </form>

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
                      {o.name && <span className="truncate text-sm text-muted-foreground">· {o.name}</span>}
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                      {o.workOrder ? `WO ${o.workOrder}` : ""}
                      {o.customerName ? ` · ${o.customerName}` : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      onClick={() => startEdit(o)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => confirm(`Delete ${o.serialNumber}? Its report will also be deleted.`) && remove(o.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
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
}: { label: string; value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string }) {
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

/** Read-only, calculated field — value is derived, never typed by the user. */
function LockedField({ label, value }: { label: string; value: number }) {
  return (
    <div className="block">
      <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
        <Lock className="h-2.5 w-2.5" /> {label}
      </span>
      <div className="w-full cursor-not-allowed select-none rounded-md border border-dashed border-border bg-card/60 px-3 py-2 font-mono text-sm text-foreground/80 opacity-90">
        {value ? value.toFixed(4) : "—"}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: TestStatus }) {
  if (status === "passed") return <CheckCircle2 className="h-4 w-4 text-[var(--ok)]" />;
  if (status === "failed") return <XCircle className="h-4 w-4 text-destructive" />;
  return <Circle className="h-4 w-4 text-muted-foreground" />;
}