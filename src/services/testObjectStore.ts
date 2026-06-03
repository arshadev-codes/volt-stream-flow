/**
 * Storage for test objects + reports.
 *
 * - When VITE_API_BASE_URL is set, calls the MySQL-backed HTTP API.
 * - Otherwise falls back to localStorage so the app keeps working
 *   without a backend running.
 *
 * The API shape mirrors the local shape so consuming code does not care.
 */
import type { TestObject, TestReport, TestStatus } from "@/types/testObject";
import { api, isApiEnabled } from "./api";

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

/* ---------- Mapping helpers (API row <-> TestObject) ---------- */

function rowToObject(row: any): TestObject {
  const meta = safeJson(row.analysis_result)?.meta ?? {};
  return {
    id: String(row.id),
    serialNumber: row.serial_number,
    name: meta.name ?? row.serial_number,
    manufacturer: meta.manufacturer,
    projectName: row.project_name ?? "",
    customerName: row.customer_name ?? "",
    workOrder: row.work_order ?? "",
    ratedVoltage: Number(row.rated_voltage) || 0,
    maxVoltage: Number(meta.maxVoltage ?? row.rated_voltage) || 0,
    ratedCurrent: Number(row.rated_current) || 0,
    peakCurrent: Number(meta.peakCurrent ?? row.rated_current) || 0,
    frequency: meta.frequency,
    inductance: meta.inductance,
    notes: meta.notes,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    status: (meta.status as TestStatus) ?? "pending",
  };
}
function safeJson(s: any) { try { return typeof s === "string" ? JSON.parse(s) : s; } catch { return null; } }

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

export function createObject(input: Omit<TestObject, "id" | "createdAt" | "status">): TestObject {
  const obj: TestObject = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    status: "pending",
  };
  const all = [obj, ...listObjects()];
  objCache = all;
  writeLs(OBJ_KEY, all);
  emit();

  if (isApiEnabled()) {
    api.createObject({
      serial_number: obj.serialNumber,
      rated_voltage: obj.ratedVoltage,
      rated_current: obj.ratedCurrent,
      project_name: obj.projectName,
      customer_name: obj.customerName,
      work_order: obj.workOrder,
      analysis_result: JSON.stringify({ meta: stripMeta(obj) }),
    }).then((row) => {
      // Adopt server id for future updates.
      const updated = listObjects().map((o) => (o.id === obj.id ? { ...o, id: String(row.id) } : o));
      objCache = updated;
      writeLs(OBJ_KEY, updated);
      emit();
    }).catch(console.error);
  }
  return obj;
}

function stripMeta(o: TestObject) {
  return {
    name: o.name, manufacturer: o.manufacturer, maxVoltage: o.maxVoltage, peakCurrent: o.peakCurrent,
    frequency: o.frequency, inductance: o.inductance, notes: o.notes, status: o.status,
  };
}

export function updateObjectStatus(id: string, status: TestStatus) {
  const all = listObjects().map((o) => (o.id === id ? { ...o, status } : o));
  objCache = all;
  writeLs(OBJ_KEY, all);
  emit();
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
  const others = listReports().filter((r) => r.objectId !== report.objectId);
  repCache = [report, ...others];
  writeLs(REP_KEY, repCache);
  updateObjectStatus(report.objectId, report.status);
  emit();

  if (isApiEnabled()) {
    const obj = getObject(report.objectId);
    api.saveResults(report.objectId, {
      raw_result: JSON.stringify(report.rawResult),
      analysis_result: JSON.stringify({
        points: report.analysisResult,
        meta: { ...(obj ? stripMeta(obj) : {}), status: report.status,
                peakCurrent: report.peakCurrent, durationS: report.durationS,
                completedAt: report.completedAt },
      }),
    }).catch(console.error);
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
