/**
 * Storage for test objects + reports.
 *
 * - When Supabase is configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
 *   set), calls the Supabase-backed API (see ./api.ts).
 * - Otherwise falls back to localStorage so the app keeps working
 *   without a backend.
 *
 * Every TestObject field now has its own dedicated Supabase column (no
 * more JSON blob for setup metadata) so everything is directly visible
 * and queryable in the Table Editor.
 *
 *   - raw_result, analysis_result, calculated_results stay as JSON —
 *     those genuinely are structured/array data (samples, curves), not
 *     flat scalar fields, so a JSON column is the right fit for them.
 *
 * serial_number is enforced unique both here (fast local/pre-flight
 * check) and at the database level (real guarantee, race-condition safe).
 */
import type { CalculatedResults, TestObject, TestReport, TestStatus } from "@/types/testObject";
import { api, isApiEnabled } from "./api";
import { getSettings } from "./settings";

const OBJ_KEY = "esa.testObjects.v2";
const REP_KEY = "esa.testReports.v2";

type Listener = () => void;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());

let objCache: TestObject[] | null = null;
let repCache: TestReport[] | null = null;

function readLs<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T) : fallback; }
  catch { return fallback; }
}
function writeLs<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function safeJson(s: any) { try { return typeof s === "string" ? JSON.parse(s) : s; } catch { return null; } }

/* ---------- Mapping helpers (API row <-> TestObject) ---------- */

function rowToObject(row: any): TestObject {
  const created = row.created_at ? new Date(row.created_at).getTime() : Date.now();
  const modified = row.modified_at
    ? new Date(row.modified_at).getTime()
    : (row.completed_at ? new Date(row.completed_at).getTime() : created);
  return {
    id: String(row.id),
    serialNumber: row.serial_number,
    name: row.name ?? row.serial_number,
    manufacturer: row.manufacturer ?? undefined,
    projectName: row.project_name ?? "",
    customerName: row.customer_name ?? "",
    workOrder: row.work_order ?? "",

    ratedVoltage: Number(row.rated_voltage) || 0,
    maxVoltage: Number(row.max_voltage ?? row.rated_voltage) || 0,
    ratedCurrent: Number(row.rated_current) || 0,
    frequency: row.frequency ?? undefined,
    inductance: row.inductance ?? undefined,
    notes: row.notes ?? undefined,

    ratedPowerValue: row.rated_power_value ?? undefined,
    ratedPowerUnit: row.rated_power_unit ?? undefined,
    ratedPowerVA: row.rated_power_va ?? undefined,
    ratedVoltageNameplate: row.rated_voltage_nameplate ?? undefined,
    phases: row.phases ?? undefined,
    resAtRefTemp: row.res_at_ref_temp ?? undefined,
    refTempForRes: row.ref_temp_for_res ?? undefined,
    resIncreaseByLeadsPu: row.res_increase_by_leads_pu ?? undefined,

    ratedAcRmsCurrent: row.rated_ac_rms_current ?? undefined,
    resAt20DegC: row.res_at20_deg_c ?? undefined,
    idcForLinearityTest: row.idc_for_linearity_test ?? undefined,
    desiredTimeToReachIdc: row.desired_time_to_reach_idc ?? undefined,

    createdAt: created,
    modifiedAt: modified,
    status: (row.status as TestStatus) ?? "pending",
  };
}

/** Maps a TestObject onto Supabase column names for insert/update. */
function objectToRow(o: Partial<TestObject>) {
  return {
    serial_number: o.serialNumber,
    name: o.name,
    manufacturer: o.manufacturer,
    project_name: o.projectName,
    customer_name: o.customerName,
    work_order: o.workOrder,

    rated_voltage: o.ratedVoltage,
    max_voltage: o.maxVoltage,
    rated_current: o.ratedCurrent,
    frequency: o.frequency,
    inductance: o.inductance,
    notes: o.notes,

    rated_power_value: o.ratedPowerValue,
    rated_power_unit: o.ratedPowerUnit,
    rated_power_va: o.ratedPowerVA,
    rated_voltage_nameplate: o.ratedVoltageNameplate,
    phases: o.phases,
    res_at_ref_temp: o.resAtRefTemp,
    ref_temp_for_res: o.refTempForRes,
    res_increase_by_leads_pu: o.resIncreaseByLeadsPu,

    rated_ac_rms_current: o.ratedAcRmsCurrent,
    res_at20_deg_c: o.resAt20DegC,
    idc_for_linearity_test: o.idcForLinearityTest,
    desired_time_to_reach_idc: o.desiredTimeToReachIdc,
  };
}

/* ---------- Test objects ---------- */

export function listObjects(): TestObject[] {
  if (objCache) return objCache;
  objCache = readLs<TestObject[]>(OBJ_KEY, []).sort((a, b) => b.createdAt - a.createdAt);
  if (isApiEnabled()) {
    api.listObjects().then((rows) => {
      objCache = rows.map(rowToObject).sort((a, b) => b.createdAt - a.createdAt);
      writeLs(OBJ_KEY, objCache);
      emit();
    }).catch(console.error);
  }
  return objCache;
}

export function getObject(id: string): TestObject | undefined {
  return listObjects().find((o) => o.id === id);
}

export type CreateResult =
  | { ok: true; object: TestObject }
  | { ok: false; error: string };

/**
 * Creates a test object. Rejects with a friendly error (instead of
 * silently failing) if the serial number is already taken — checked both
 * locally (fast) and, when Supabase is on, against the database (the real
 * guarantee, since two people could submit the same serial at once).
 */
export async function createObject(
  input: Omit<TestObject, "id" | "createdAt" | "modifiedAt" | "status">,
): Promise<CreateResult> {
  const serial = input.serialNumber.trim();

  const dupLocal = listObjects().find(
    (o) => o.serialNumber.trim().toLowerCase() === serial.toLowerCase(),
  );
  if (dupLocal) {
    return { ok: false, error: `Serial number "${serial}" already exists.` };
  }

  const now = Date.now();
  const obj: TestObject = { ...input, serialNumber: serial, id: crypto.randomUUID(), createdAt: now, modifiedAt: now, status: "pending" };

  if (isApiEnabled()) {
    try {
      const existing = await api.findBySerial(serial);
      if (existing) {
        return { ok: false, error: `Serial number "${serial}" already exists.` };
      }
      const row = await api.createObject({ ...objectToRow(obj), status: "pending" });
      obj.id = String(row.id);
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      const isDuplicate = /duplicate|unique/i.test(msg);
      return {
        ok: false,
        error: isDuplicate
          ? `Serial number "${serial}" already exists.`
          : "Failed to save to the database. Check your connection and try again.",
      };
    }
  }

  const all = [obj, ...listObjects()];
  objCache = all;
  writeLs(OBJ_KEY, all);
  emit();
  return { ok: true, object: obj };
}

/**
 * Edits an existing test object's fields. Works at any time, even after a
 * report already exists for it — editing setup fields doesn't touch
 * raw_result/analysis_result/calculated_results, so a saved report is
 * never lost by editing the object it belongs to.
 */
export async function updateObject(
  id: string,
  patch: Omit<TestObject, "id" | "createdAt" | "modifiedAt" | "status">,
): Promise<CreateResult> {
  const existing = getObject(id);
  if (!existing) return { ok: false, error: "Test object not found." };

  const serial = patch.serialNumber.trim();
  const dupLocal = listObjects().find(
    (o) => o.id !== id && o.serialNumber.trim().toLowerCase() === serial.toLowerCase(),
  );
  if (dupLocal) {
    return { ok: false, error: `Serial number "${serial}" already exists.` };
  }

  const updated: TestObject = { ...existing, ...patch, serialNumber: serial, modifiedAt: Date.now() };

  if (isApiEnabled()) {
    try {
      const remoteDup = await api.findBySerial(serial);
      if (remoteDup && String(remoteDup.id) !== id) {
        return { ok: false, error: `Serial number "${serial}" already exists.` };
      }
      await api.updateObject(id, objectToRow(updated));
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      const isDuplicate = /duplicate|unique/i.test(msg);
      return {
        ok: false,
        error: isDuplicate
          ? `Serial number "${serial}" already exists.`
          : "Failed to update the database. Check your connection and try again.",
      };
    }
  }

  const all = listObjects().map((o) => (o.id === id ? updated : o));
  objCache = all;
  writeLs(OBJ_KEY, all);
  emit();
  return { ok: true, object: updated };
}

export function updateObjectStatus(id: string, status: TestStatus, modifiedAt?: number) {
  const all = listObjects().map((o) =>
    o.id === id ? { ...o, status, modifiedAt: modifiedAt ?? o.modifiedAt } : o,
  );
  objCache = all;
  writeLs(OBJ_KEY, all);
  emit();

  if (isApiEnabled()) {
    api.updateObject(id, {
      status,
      ...(modifiedAt ? { completed_at: new Date(modifiedAt).toISOString() } : {}),
    }).catch(console.error);
  }
}

export function deleteObject(id: string) {
  objCache = listObjects().filter((o) => o.id !== id);
  repCache = listReports().filter((r) => r.objectId !== id);
  writeLs(OBJ_KEY, objCache);
  writeLs(REP_KEY, repCache);
  emit();
  if (isApiEnabled()) api.deleteObject(id).catch(console.error);
}

/* ---------- Reports ---------- */

export function listReports(): TestReport[] {
  if (!repCache) repCache = readLs<TestReport[]>(REP_KEY, []);
  return repCache;
}
export function getReport(objectId: string): TestReport | undefined {
  return listReports().find((r) => r.objectId === objectId);
}

export function saveReport(report: TestReport) {
  const storeRaw = getSettings().storeRawData;
  const persisted: TestReport = storeRaw ? report : { ...report, rawResult: [] };

  const others = listReports().filter((r) => r.objectId !== persisted.objectId);
  repCache = [persisted, ...others];
  writeLs(REP_KEY, repCache);
  updateObjectStatus(persisted.objectId, persisted.status, persisted.completedAt);
  emit();

  if (isApiEnabled()) {
    api.updateObject(persisted.objectId, {
      status: persisted.status,
      peak_current: persisted.peakCurrent,
      duration_s: persisted.durationS,
      completed_at: new Date(persisted.completedAt).toISOString(),
      raw_result: storeRaw ? JSON.stringify(report.rawResult) : "[]",
      analysis_result: JSON.stringify(persisted.analysisResult),
      calculated_results: persisted.calculatedResults
        ? JSON.stringify(persisted.calculatedResults)
        : null,
    }).catch(console.error);
  }
}

export async function fetchReport(objectId: string): Promise<TestReport | undefined> {
  const local = getReport(objectId);
  if (!isApiEnabled()) return local;
  try {
    const row: any = await api.getObject(objectId);
    if (!row) return local;
    const points = safeJson(row.analysis_result) ?? [];
    const raw = safeJson(row.raw_result) ?? [];
    const calculatedResults: CalculatedResults | undefined =
      safeJson(row.calculated_results) ?? local?.calculatedResults;
    const merged: TestReport = {
      objectId,
      status: (row.status ?? local?.status ?? "passed") as Exclude<TestStatus, "pending">,
      rawResult: Array.isArray(raw) ? raw : [],
      analysisResult: Array.isArray(points) ? points : (local?.analysisResult ?? []),
      calculatedResults,
      peakCurrent: Number(row.peak_current ?? local?.peakCurrent ?? 0),
      durationS: Number(row.duration_s ?? local?.durationS ?? 0),
      completedAt: row.completed_at
        ? new Date(row.completed_at).getTime()
        : Number(local?.completedAt ?? Date.now()),
    };
    const others = listReports().filter((r) => r.objectId !== objectId);
    repCache = [merged, ...others];
    writeLs(REP_KEY, repCache);
    emit();
    return merged;
  } catch (e) {
    console.error(e);
    return local;
  }
}

/* ---------- Subscriptions ---------- */

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === OBJ_KEY || e.key === REP_KEY) { objCache = null; repCache = null; listener(); }
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}